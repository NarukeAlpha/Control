import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawn } from "node:child_process";

import type {
  ActionsInput,
  ContributorSummary,
  DiscussionListInput,
  DiscussionSummary,
  GhStatus,
  GitHubMutationInput,
  GitHubMutationResult,
  GitHubProvider,
  IssueListInput,
  IssueSummary,
  ProjectSummary,
  ProjectsInput,
  PullRequestListInput,
  PullRequestSummary,
  ReleaseSummary,
  ReleasesInput,
  RepoContentsInput,
  RepoDetailInput,
  RepoEntry,
  RepoListInput,
  RepositoryDetail,
  RepositorySummary,
  SearchInput,
  Viewer,
  WorkflowRunSummary
} from "@shared/github";

const githubApiVersion = "2026-03-10";
const githubHost = "github.com";

interface RunResult {
  stdout: string;
  stderr: string;
}

export async function resolveGhPath(configuredPath?: string | null): Promise<string | null> {
  const candidates = [
    configuredPath,
    ...((process.env.PATH ?? "").split(delimiter).filter(Boolean).map((directory) => join(directory, "gh"))),
    "/opt/homebrew/bin/gh",
    "/usr/local/bin/gh",
    "/usr/bin/gh"
  ].filter(Boolean) as string[];

  for (const candidate of [...new Set(candidates)]) {
    if (candidate.includes("/") && !existsSync(candidate)) {
      continue;
    }

    try {
      await run(candidate, ["--version"]);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

export async function getGhStatus(configuredPath?: string | null): Promise<GhStatus> {
  const path = await resolveGhPath(configuredPath);

  if (!path) {
    return {
      available: false,
      authenticated: false,
      path: null,
      user: null,
      error: "GitHub CLI was not found. Install gh or set the path in Settings."
    };
  }

  try {
    const result = await run(path, ["auth", "status", "--hostname", githubHost]);
    const combined = `${result.stdout}\n${result.stderr}`;
    const user = combined.match(/account\s+([^\s]+)/i)?.[1] ?? null;
    return {
      available: true,
      authenticated: true,
      path,
      user,
      error: null
    };
  } catch (error) {
    return {
      available: true,
      authenticated: false,
      path,
      user: null,
      error: error instanceof Error ? error.message : "GitHub CLI authentication failed."
    };
  }
}

export class GhCliProvider implements GitHubProvider {
  constructor(private readonly ghPath: string) {}

  async getViewer(): Promise<Viewer> {
    const data = await this.graphql<{
      viewer: {
        login: string;
        name: string | null;
        avatarUrl: string | null;
        url: string | null;
      };
    }>(`
      query Viewer {
        viewer {
          login
          name
          avatarUrl
          url
        }
      }
    `);

    return {
      login: data.viewer.login,
      name: data.viewer.name,
      avatarUrl: data.viewer.avatarUrl,
      htmlUrl: data.viewer.url
    };
  }

  async listRepositories(input: RepoListInput = {}): Promise<RepositorySummary[]> {
    const limit = input.limit ?? 50;
    const data = await this.graphql<{
      viewer: {
        repositories: {
          nodes: GitHubRepositoryNode[];
        };
      };
    }>(
      `
      query ViewerRepositories($limit: Int!) {
        viewer {
          repositories(
            first: $limit,
            orderBy: { field: UPDATED_AT, direction: DESC },
            affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
          ) {
            nodes {
              ...RepositorySummaryFields
            }
          }
        }
      }

      fragment RepositorySummaryFields on Repository {
        id
        name
        nameWithOwner
        description
        visibility
        isPrivate
        isFork
        stargazerCount
        forkCount
        updatedAt
        pushedAt
        defaultBranchRef { name }
        owner { login avatarUrl }
        watchers { totalCount }
        issues(states: OPEN) { totalCount }
        primaryLanguage { name color }
      }
    `,
      { limit }
    );

    return data.viewer.repositories.nodes.map(mapRepositorySummary);
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    const data = await this.graphql<{
      repository: GitHubRepositoryNode & {
        url: string;
        homepageUrl: string | null;
        licenseInfo: { name: string; spdxId: string | null } | null;
        repositoryTopics: {
          nodes: Array<{ topic: { name: string } }>;
        };
        branches: { totalCount: number };
        tags: { totalCount: number };
      };
    }>(
      `
      query RepositoryDetail($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          name
          nameWithOwner
          description
          visibility
          isPrivate
          isFork
          stargazerCount
          forkCount
          updatedAt
          pushedAt
          url
          homepageUrl
          defaultBranchRef { name }
          owner { login avatarUrl }
          watchers { totalCount }
          issues(states: OPEN) { totalCount }
          primaryLanguage { name color }
          licenseInfo { name spdxId }
          repositoryTopics(first: 16) {
            nodes { topic { name } }
          }
          branches: refs(refPrefix: "refs/heads/", first: 1) { totalCount }
          tags: refs(refPrefix: "refs/tags/", first: 1) { totalCount }
        }
      }
    `,
      { owner, repo }
    );

    const readmeMarkdown = await this.getReadme(owner, repo).catch(() => null);
    const summary = mapRepositorySummary(data.repository);

    return {
      ...summary,
      homepageUrl: data.repository.homepageUrl,
      licenseName: data.repository.licenseInfo?.name ?? null,
      licenseSpdxId: data.repository.licenseInfo?.spdxId ?? null,
      topics: data.repository.repositoryTopics.nodes.map((node) => node.topic.name),
      branchCount: data.repository.branches.totalCount,
      tagCount: data.repository.tags.totalCount,
      readmeMarkdown,
      htmlUrl: data.repository.url
    };
  }

  async listContents(input: RepoContentsInput): Promise<RepoEntry[]> {
    const encodedPath = input.path ? `/${encodePath(input.path)}` : "";
    const ref = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : "";
    const data = await this.rest<GitHubContentItem[] | GitHubContentItem>(
      "GET",
      `/repos/${input.owner}/${input.repo}/contents${encodedPath}${ref}`
    );

    const items = Array.isArray(data) ? data : [data];
    return items
      .map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        sha: item.sha,
        size: typeof item.size === "number" ? item.size : null,
        htmlUrl: item.html_url ?? null,
        downloadUrl: item.download_url ?? null,
        lastCommitMessage: null,
        lastCommitDate: null
      }))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "dir" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }

  async listIssues(input: IssueListInput): Promise<IssueSummary[]> {
    const state = input.state ?? "open";
    const data = await this.rest<GitHubIssue[]>(
      "GET",
      `/repos/${input.owner}/${input.repo}/issues?state=${state}&per_page=50`
    );

    return data.filter((issue) => !issue.pull_request).map(mapIssue);
  }

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]> {
    const state = input.state ?? "open";
    const data = await this.rest<GitHubPullRequest[]>(
      "GET",
      `/repos/${input.owner}/${input.repo}/pulls?state=${state}&per_page=50`
    );

    return data.map(mapPullRequest);
  }

  async listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    try {
      const limit = input.limit ?? 30;
      const data = await this.graphql<{
        repository: {
          discussions: {
            nodes: Array<{
              id: string;
              number: number;
              title: string;
              url: string;
              updatedAt: string;
              author: { login: string } | null;
              category: { name: string } | null;
              comments: { totalCount: number };
            }>;
          };
        };
      }>(
        `
        query RepositoryDiscussions($owner: String!, $repo: String!, $limit: Int!) {
          repository(owner: $owner, name: $repo) {
            discussions(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                id
                number
                title
                url
                updatedAt
                author { login }
                category { name }
                comments { totalCount }
              }
            }
          }
        }
      `,
        { owner: input.owner, repo: input.repo, limit }
      );

      return data.repository.discussions.nodes.map((discussion) => ({
        id: discussion.id,
        number: discussion.number,
        title: discussion.title,
        authorLogin: discussion.author?.login ?? null,
        category: discussion.category?.name ?? null,
        comments: discussion.comments.totalCount,
        updatedAt: discussion.updatedAt,
        htmlUrl: discussion.url
      }));
    } catch {
      return [];
    }
  }

  async listActions(input: ActionsInput): Promise<WorkflowRunSummary[]> {
    const perPage = input.limit ?? 30;
    const data = await this.rest<{ workflow_runs: GitHubWorkflowRun[] }>(
      "GET",
      `/repos/${input.owner}/${input.repo}/actions/runs?per_page=${perPage}`
    );

    return data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.name,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.head_branch,
      commitSha: run.head_sha,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url
    }));
  }

  async listProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    try {
      const limit = input.limit ?? 20;
      const data = await this.graphql<{
        repository: {
          projectsV2: {
            nodes: Array<{
              id: string;
              title: string;
              closed: boolean;
              updatedAt: string | null;
              url: string | null;
            }>;
          };
        };
      }>(
        `
        query RepositoryProjects($owner: String!, $repo: String!, $limit: Int!) {
          repository(owner: $owner, name: $repo) {
            projectsV2(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                id
                title
                closed
                updatedAt
                url
              }
            }
          }
        }
      `,
        { owner: input.owner, repo: input.repo, limit }
      );

      return data.repository.projectsV2.nodes.map((project) => ({
        id: project.id,
        title: project.title,
        closed: project.closed,
        updatedAt: project.updatedAt,
        htmlUrl: project.url
      }));
    } catch {
      return [];
    }
  }

  async listReleases(input: ReleasesInput): Promise<ReleaseSummary[]> {
    const perPage = input.limit ?? 20;
    const data = await this.rest<GitHubRelease[]>(
      "GET",
      `/repos/${input.owner}/${input.repo}/releases?per_page=${perPage}`
    );

    return data.map((release) => ({
      id: release.id,
      name: release.name,
      tagName: release.tag_name,
      isDraft: release.draft,
      isPrerelease: release.prerelease,
      publishedAt: release.published_at,
      htmlUrl: release.html_url
    }));
  }

  async listContributors(input: RepoDetailInput): Promise<ContributorSummary[]> {
    const data = await this.rest<GitHubContributor[]>(
      "GET",
      `/repos/${input.owner}/${input.repo}/contributors?per_page=24`
    );

    return data.map((contributor) => ({
      id: contributor.id,
      login: contributor.login,
      avatarUrl: contributor.avatar_url,
      htmlUrl: contributor.html_url,
      contributions: contributor.contributions
    }));
  }

  async search(input: SearchInput): Promise<RepositorySummary[]> {
    if (!input.query.trim()) {
      return [];
    }

    const limit = input.limit ?? 12;
    const data = await this.graphql<{
      search: {
        nodes: GitHubRepositoryNode[];
      };
    }>(
      `
      query RepositorySearch($query: String!, $limit: Int!) {
        search(query: $query, type: REPOSITORY, first: $limit) {
          nodes {
            ... on Repository {
              id
              name
              nameWithOwner
              description
              visibility
              isPrivate
              isFork
              stargazerCount
              forkCount
              updatedAt
              pushedAt
              defaultBranchRef { name }
              owner { login avatarUrl }
              watchers { totalCount }
              issues(states: OPEN) { totalCount }
              primaryLanguage { name color }
            }
          }
        }
      }
    `,
      { query: input.query, limit }
    );

    return data.search.nodes.filter(Boolean).map(mapRepositorySummary);
  }

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult> {
    const data = await this.performMutation(input);
    return {
      ok: true,
      action: input.action,
      message: `${input.action} completed.`,
      data
    } as TResult;
  }

  private async getReadme(owner: string, repo: string): Promise<string> {
    return this.restText("GET", `/repos/${owner}/${repo}/readme`, {
      accept: "application/vnd.github.raw"
    });
  }

  private async performMutation(input: GitHubMutationInput): Promise<unknown> {
    const { owner, repo, payload = {} } = input;
    const issueNumber = getNumber(payload, "issueNumber");
    const pullNumber = getNumber(payload, "pullNumber");
    const commentId = getNumber(payload, "commentId");
    const runId = getNumber(payload, "runId");
    const releaseId = getNumber(payload, "releaseId");

    switch (input.action) {
      case "star":
        return this.rest("PUT", `/user/starred/${owner}/${repo}`);
      case "unstar":
        return this.rest("DELETE", `/user/starred/${owner}/${repo}`);
      case "watch":
        return this.rest("PUT", `/repos/${owner}/${repo}/subscription`, { subscribed: true, ignored: false });
      case "unwatch":
        return this.rest("DELETE", `/repos/${owner}/${repo}/subscription`);
      case "fork":
        return this.rest("POST", `/repos/${owner}/${repo}/forks`, pick(payload, ["organization", "name", "default_branch_only"]));
      case "createIssue":
        return this.rest("POST", `/repos/${owner}/${repo}/issues`, pick(payload, ["title", "body", "labels", "assignees"]));
      case "editIssue":
        return this.rest(
          "PATCH",
          `/repos/${owner}/${repo}/issues/${issueNumber}`,
          pick(payload, ["title", "body", "state", "labels", "assignees", "milestone"])
        );
      case "closeIssue":
        return this.rest("PATCH", `/repos/${owner}/${repo}/issues/${issueNumber}`, { state: "closed" });
      case "reopenIssue":
        return this.rest("PATCH", `/repos/${owner}/${repo}/issues/${issueNumber}`, { state: "open" });
      case "addComment":
        return this.rest("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, pick(payload, ["body"]));
      case "editComment":
        return this.rest("PATCH", `/repos/${owner}/${repo}/issues/comments/${commentId}`, pick(payload, ["body"]));
      case "deleteComment":
        return this.rest("DELETE", `/repos/${owner}/${repo}/issues/comments/${commentId}`);
      case "addLabels":
        return this.rest("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, pick(payload, ["labels"]));
      case "setAssignees":
        return this.rest("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, pick(payload, ["assignees"]));
      case "mergePullRequest":
        return this.rest(
          "PUT",
          `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
          pick(payload, ["commit_title", "commit_message", "merge_method", "sha"])
        );
      case "closePullRequest":
        return this.rest("PATCH", `/repos/${owner}/${repo}/pulls/${pullNumber}`, { state: "closed" });
      case "reopenPullRequest":
        return this.rest("PATCH", `/repos/${owner}/${repo}/pulls/${pullNumber}`, { state: "open" });
      case "approvePullRequest":
        return this.rest("POST", `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
          body: typeof payload.body === "string" ? payload.body : "",
          event: "APPROVE"
        });
      case "requestChanges":
        return this.rest("POST", `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
          body: typeof payload.body === "string" ? payload.body : "Changes requested from Control.",
          event: "REQUEST_CHANGES"
        });
      case "rerunWorkflow":
        return this.rest("POST", `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`);
      case "cancelWorkflow":
        return this.rest("POST", `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`);
      case "createRelease":
        return this.rest(
          "POST",
          `/repos/${owner}/${repo}/releases`,
          pick(payload, ["tag_name", "target_commitish", "name", "body", "draft", "prerelease"])
        );
      case "editRelease":
        return this.rest(
          "PATCH",
          `/repos/${owner}/${repo}/releases/${releaseId}`,
          pick(payload, ["tag_name", "target_commitish", "name", "body", "draft", "prerelease", "make_latest"])
        );
      case "deleteRelease":
        return this.rest("DELETE", `/repos/${owner}/${repo}/releases/${releaseId}`);
      default:
        throw new Error(`Unsupported GitHub action: ${input.action}`);
    }
  }

  private async graphql<T>(query: string, variables: Record<string, string | number | boolean> = {}): Promise<T> {
    const args = ["api", "graphql", "--hostname", githubHost, "-f", `query=${query}`];
    for (const [key, value] of Object.entries(variables)) {
      args.push("-F", `${key}=${value}`);
    }

    const result = await run(this.ghPath, args);
    const parsed = JSON.parse(result.stdout) as { data?: T; errors?: Array<{ message: string }> };
    if (parsed.errors?.length) {
      throw new Error(parsed.errors.map((error) => error.message).join("; "));
    }
    if (!parsed.data) {
      throw new Error("GitHub GraphQL response did not include data.");
    }
    return parsed.data;
  }

  private async rest<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    options: { accept?: string } = {}
  ): Promise<T> {
    const text = await this.restText(method, endpoint, options, body);
    if (!text.trim()) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  }

  private async restText(
    method: string,
    endpoint: string,
    options: { accept?: string } = {},
    body?: Record<string, unknown>
  ): Promise<string> {
    const args = [
      "api",
      endpoint,
      "--hostname",
      githubHost,
      "--method",
      method,
      "-H",
      `X-GitHub-Api-Version: ${githubApiVersion}`,
      "-H",
      `Accept: ${options.accept ?? "application/vnd.github+json"}`
    ];

    let input: string | undefined;
    if (body && Object.keys(body).length > 0) {
      args.push("-H", "Content-Type: application/json", "--input", "-");
      input = JSON.stringify(body);
    }

    const result = await run(this.ghPath, args, input);
    return result.stdout;
  }
}

async function run(command: string, args: string[], input?: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        GH_HOST: githubHost
      },
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code ?? "unknown"}`));
    });

    if (input) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function getNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`GitHub action payload requires numeric ${key}.`);
  }
  return value;
}

function pick(payload: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    if (payload[key] !== undefined) {
      acc[key] = payload[key];
    }
    return acc;
  }, {});
}

function mapRepositorySummary(node: GitHubRepositoryNode): RepositorySummary {
  return {
    id: node.id,
    owner: node.owner.login,
    name: node.name,
    nameWithOwner: node.nameWithOwner,
    description: node.description,
    visibility: node.visibility,
    isPrivate: node.isPrivate,
    isFork: node.isFork,
    stargazerCount: node.stargazerCount,
    forkCount: node.forkCount,
    watcherCount: node.watchers.totalCount,
    openIssuesCount: node.issues.totalCount,
    primaryLanguage: node.primaryLanguage,
    updatedAt: node.updatedAt,
    pushedAt: node.pushedAt,
    avatarUrl: node.owner.avatarUrl,
    defaultBranch: node.defaultBranchRef?.name ?? null
  };
}

function mapIssue(issue: GitHubIssue): IssueSummary {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    authorLogin: issue.user?.login ?? null,
    authorAvatarUrl: issue.user?.avatar_url ?? null,
    comments: issue.comments,
    labels: issue.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color
    })),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    htmlUrl: issue.html_url
  };
}

function mapPullRequest(pr: GitHubPullRequest): PullRequestSummary {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    isDraft: pr.draft,
    authorLogin: pr.user?.login ?? null,
    authorAvatarUrl: pr.user?.avatar_url ?? null,
    comments: pr.comments ?? 0,
    reviewComments: pr.review_comments ?? 0,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
    mergeableState: pr.mergeable_state ?? null,
    headRefName: pr.head?.ref ?? "",
    baseRefName: pr.base?.ref ?? "",
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url
  };
}

interface GitHubRepositoryNode {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  visibility: string;
  isPrivate: boolean;
  isFork: boolean;
  stargazerCount: number;
  forkCount: number;
  updatedAt: string | null;
  pushedAt: string | null;
  defaultBranchRef: { name: string } | null;
  owner: {
    login: string;
    avatarUrl: string | null;
  };
  watchers: {
    totalCount: number;
  };
  issues: {
    totalCount: number;
  };
  primaryLanguage: {
    name: string;
    color: string | null;
  } | null;
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  sha: string;
  size?: number;
  html_url?: string;
  download_url?: string | null;
}

interface GitHubUser {
  login: string;
  avatar_url: string | null;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  user: GitHubUser | null;
  comments: number;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  user: GitHubUser | null;
  comments?: number;
  review_comments?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  mergeable_state?: string | null;
  head?: { ref: string };
  base?: { ref: string };
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubWorkflowRun {
  id: number;
  name: string;
  event: string;
  status: string | null;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubRelease {
  id: number;
  name: string | null;
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
}

interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string | null;
  html_url: string | null;
  contributions: number;
}
