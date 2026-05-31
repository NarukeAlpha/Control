import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";

import type {
  BranchListInput,
  BranchListResult,
  BranchSummary,
  GitHubReadAvailability,
  LanguageStat,
  RepoContentsInput,
  RepoContentsResult,
  RepoEntry,
  RepoFileContent,
  RepoFileContentInput,
  RepoFileContentResult,
  RepoListInput,
  RepoReadmeInput,
  RepoReadmeResult,
  RepoTreeEntry,
  RepoTreeInput,
  RepoTreeReadResult,
  RepoTreeResult,
  RepositoryAdministrationMetadata,
  RepositoryCounts,
  RepositoryDetail,
  RepositoryDetailResult,
  RepositoryForksInput,
  RepositoryForksResult,
  RepositoryListResult,
  RepositoryRef,
  TagListInput,
  TagListResult,
  TagSummary,
  ViewerRepositoryState,
  RepositorySummary
} from "@shared/github";
import {
  contentHasNullByte,
  fileNameFromPath,
  isNonImageBinaryPath,
  isPreviewableImagePath,
  maxPreviewBytes
} from "@shared/filePreviewPolicy";

const contentCommitMetadataLimit = 25;
const contentCommitFileStatsLimit = 8;

export interface OctokitRepositoryClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
  rest<T>(route: string, params: Record<string, unknown>): Promise<T>;
  restText(route: string, params: Record<string, unknown>): Promise<string>;
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
}

export class OctokitRepositoryDomain {
  constructor(
    private readonly client: OctokitRepositoryClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listRepositories(input: RepoListInput = {}): Promise<RepositorySummary[]> {
    const limit = input.limit ?? 50;
    const data = await this.client.graphql<{
      viewer: { repositories: { nodes: GitHubRepositoryNode[] } };
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

      ${repositorySummaryFragment}
    `,
      { limit }
    );

    return data.viewer.repositories.nodes.map(mapRepositorySummary);
  }

  async listRepositoriesWithStatus(input: RepoListInput = {}): Promise<RepositoryListResult> {
    try {
      return {
        items: await this.listRepositories(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    const data = await this.client.graphql<{
      repository: GitHubRepositoryNode & {
        url: string;
        homepageUrl: string | null;
        licenseInfo: { name: string; spdxId: string | null } | null;
        repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
        branches: { totalCount: number };
        tags: { totalCount: number };
        languages: GitHubLanguages;
        parent: GitHubRepositoryRefNode | null;
        viewerHasStarred: boolean;
        viewerSubscription: ViewerRepositoryState["subscription"];
        viewerPermission: string | null;
        isArchived: boolean;
        isDisabled: boolean;
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
          isArchived
          isDisabled
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
          pullRequests(states: OPEN) { totalCount }
          discussions { totalCount }
          releases { totalCount }
          primaryLanguage { name color }
          languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
            totalSize
            edges {
              size
              node { name color }
            }
          }
          parent {
            id
            name
            nameWithOwner
            url
            visibility
            isPrivate
            forkCount
            stargazerCount
            viewerPermission
            defaultBranchRef { name }
            owner { login }
          }
          viewerHasStarred
          viewerSubscription
          viewerPermission
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

    const summary = mapRepositorySummary(data.repository);
    const restMetadata = await this.getRepositoryRestMetadata(owner, repo);
    return {
      ...summary,
      homepageUrl: data.repository.homepageUrl,
      licenseName: data.repository.licenseInfo?.name ?? null,
      licenseSpdxId: data.repository.licenseInfo?.spdxId ?? null,
      topics: data.repository.repositoryTopics.nodes.map((node) => node.topic.name),
      branchCount: data.repository.branches.totalCount,
      tagCount: data.repository.tags.totalCount,
      readmeMarkdown: null,
      htmlUrl: data.repository.url,
      languages: mapLanguages(data.repository.languages),
      parent: restMetadata.parent ?? mapRepositoryRef(data.repository.parent),
      source: restMetadata.source,
      viewerState: {
        hasStarred: data.repository.viewerHasStarred,
        subscription: data.repository.viewerSubscription,
        permission: data.repository.viewerPermission,
        canAdminister: data.repository.viewerPermission === "ADMIN",
        canSubscribe: true
      },
      permissions: {
        viewerPermission: data.repository.viewerPermission,
        isArchived: data.repository.isArchived,
        isDisabled: data.repository.isDisabled
      },
      administrationAvailability: restMetadata.availability,
      administration:
        restMetadata.administration ??
        fallbackRepositoryAdministration({
          visibility: data.repository.visibility,
          defaultBranch: data.repository.defaultBranchRef?.name ?? null,
          isPrivate: data.repository.isPrivate,
          isArchived: data.repository.isArchived,
          isDisabled: data.repository.isDisabled,
          viewerPermission: data.repository.viewerPermission
        })
    };
  }

  async getRepositoryWithStatus(owner: string, repo: string): Promise<RepositoryDetailResult> {
    try {
      return {
        detail: await this.getRepository(owner, repo),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        detail: null,
        availability: this.mapError(error)
      };
    }
  }

  async listBranches(input: BranchListInput): Promise<BranchSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubBranch>(
      "GET /repos/{owner}/{repo}/branches",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 50
    );

    return data.map(mapBranch);
  }

  async listBranchesWithStatus(input: BranchListInput): Promise<BranchListResult> {
    try {
      return {
        items: await this.listBranches(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listTags(input: TagListInput): Promise<TagSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubTag>(
      "GET /repos/{owner}/{repo}/tags",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 50
    );

    return data.map(mapTag);
  }

  async listTagsWithStatus(input: TagListInput): Promise<TagListResult> {
    try {
      return {
        items: await this.listTags(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listTree(input: RepoTreeInput): Promise<RepoTreeResult> {
    const ref = input.ref ?? "HEAD";
    const data = await this.client.rest<GitHubTree>("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
      owner: input.owner,
      repo: input.repo,
      tree_sha: ref,
      recursive: input.recursive === false ? undefined : "1"
    });
    const entries = data.tree
      .map((entry) => mapTreeEntry(input.owner, input.repo, ref, entry))
      .filter((entry): entry is RepoTreeEntry => Boolean(entry))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return treeEntryTypeRank(a.type) - treeEntryTypeRank(b.type);
        }
        return a.path.localeCompare(b.path);
      });

    return {
      ref,
      truncated: data.truncated,
      entries: input.limit ? entries.slice(0, input.limit) : entries
    };
  }

  async listTreeWithStatus(input: RepoTreeInput): Promise<RepoTreeReadResult> {
    try {
      return {
        tree: await this.listTree(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        tree: null,
        availability: this.mapError(error)
      };
    }
  }

  async getReadme(input: RepoReadmeInput): Promise<RepoReadmeResult> {
    try {
      const markdown = await this.client.restText("GET /repos/{owner}/{repo}/readme", {
        owner: input.owner,
        repo: input.repo,
        ref: input.ref ?? undefined,
        headers: { accept: "application/vnd.github.raw" }
      });
      return { markdown, availability: { status: "available", message: null } };
    } catch (error) {
      if (isGitHubStatus(error, 404)) {
        return {
          markdown: null,
          availability: {
            status: "available",
            message: "GitHub did not return a README for this repository."
          }
        };
      }

      return {
        markdown: null,
        availability: this.mapError(error)
      };
    }
  }

  async listContents(input: RepoContentsInput): Promise<RepoEntry[]> {
    const route = input.path
      ? "GET /repos/{owner}/{repo}/contents/{path}"
      : "GET /repos/{owner}/{repo}/contents";
    const data = await this.client.rest<GitHubContentItem[] | GitHubContentItem>(route, {
      owner: input.owner,
      repo: input.repo,
      path: input.path || undefined,
      ref: input.ref ?? undefined
    });

    const items = Array.isArray(data) ? data : [data];
    const entries: RepoEntry[] = items
      .map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        sha: item.sha,
        size: typeof item.size === "number" ? item.size : null,
        htmlUrl: item.html_url ?? null,
        downloadUrl: item.download_url ?? null,
        lastCommitSha: null,
        lastCommitMessage: null,
        lastCommitAuthorLogin: null,
        lastCommitAuthorName: null,
        lastCommitAuthorAvatarUrl: null,
        lastAuthoredDate: null,
        lastCommittedDate: null,
        lastCommitDate: null,
        lastCommitHtmlUrl: null,
        lastCommitAdditions: null,
        lastCommitDeletions: null,
        lastCommitChanges: null,
        lastCommitAvailability: { status: "available", message: null } as GitHubReadAvailability
      }))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "dir" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    return this.enrichContentCommitMetadata(input, entries);
  }

  async listContentsWithStatus(input: RepoContentsInput): Promise<RepoContentsResult> {
    try {
      return {
        items: await this.listContents(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async getFileContent(input: RepoFileContentInput): Promise<RepoFileContent> {
    const [item, lastCommit] = await Promise.all([
      this.client.rest<GitHubContentItem>("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: input.owner,
        repo: input.repo,
        path: input.path,
        ref: input.ref ?? undefined
      }),
      this.getContentLastCommit(input, input.path, true)
    ]);
    const baseContent = repoFileContentBase(input, item, lastCommit);

    if (item.type !== "file") {
      return {
        ...baseContent,
        kind: "unavailable",
        content: null,
        encoding: null,
        message: `${item.type} entries are not regular files and cannot be previewed.`
      };
    }

    const size = typeof item.size === "number" ? item.size : null;
    if (size !== null && size > maxPreviewBytes) {
      return {
        ...baseContent,
        kind: "too_large",
        content: null,
        encoding: null,
        message: "File preview was skipped because the file exceeds the preview size limit."
      };
    }

    if (isPreviewableImagePath(item.path)) {
      return {
        ...baseContent,
        kind: "image",
        content: null,
        encoding: null,
        message: item.download_url ? null : "Image preview URL is unavailable."
      };
    }

    if (isNonImageBinaryPath(item.path)) {
      return {
        ...baseContent,
        kind: "binary",
        content: null,
        encoding: null,
        message: "Binary files are not previewed as text."
      };
    }

    try {
      const content = await this.client.restText("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: input.owner,
        repo: input.repo,
        path: input.path,
        ref: input.ref ?? undefined,
        headers: { accept: "application/vnd.github.raw" }
      });

      if (contentHasNullByte(content)) {
        return {
          ...baseContent,
          kind: "binary",
          content: null,
          encoding: null,
          message: "Binary-looking content is not previewed as text."
        };
      }

      return {
        ...baseContent,
        kind: "text",
        content,
        encoding: "utf-8",
        message: null
      };
    } catch (error) {
      const fallbackContent = decodeGitHubBase64Text(item);
      if (fallbackContent.ok) {
        return {
          ...baseContent,
          kind: "text",
          content: fallbackContent.content,
          encoding: "utf-8",
          message: null
        };
      }

      return {
        ...baseContent,
        kind: "unavailable",
        content: null,
        encoding: null,
        message:
          fallbackContent.message ??
          (error instanceof Error ? error.message : "File content could not be loaded.")
      };
    }
  }

  async getFileContentWithStatus(input: RepoFileContentInput): Promise<RepoFileContentResult> {
    try {
      return {
        item: await this.getFileContent(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        item: null,
        availability: this.mapError(error)
      };
    }
  }

  async listRepositoryForks(input: RepositoryForksInput): Promise<RepositoryForksResult> {
    try {
      const forks = await this.client.restPaginatedArray<GitHubRestRepositoryRef>(
        "GET /repos/{owner}/{repo}/forks",
        {
          owner: input.owner,
          repo: input.repo,
          sort: input.sort ?? "newest"
        },
        input.limit ?? 30
      );

      return {
        items: forks.map(mapRestRepositoryRef).filter((item): item is RepositoryRef => Boolean(item)),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  private async getRepositoryRestMetadata(
    owner: string,
    repo: string
  ): Promise<{
    parent: RepositoryRef | null;
    source: RepositoryRef | null;
    administration: RepositoryAdministrationMetadata | null;
    availability: GitHubReadAvailability;
  }> {
    try {
      const repository = await this.client.rest<GitHubRestRepository>("GET /repos/{owner}/{repo}", {
        owner,
        repo
      });

      return {
        parent: mapRestRepositoryRef(repository.parent ?? null),
        source: mapRestRepositoryRef(repository.source ?? null),
        administration: mapRestRepositoryAdministration(repository),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        parent: null,
        source: null,
        administration: null,
        availability: this.mapError(error)
      };
    }
  }

  private async enrichContentCommitMetadata(
    input: RepoContentsInput,
    entries: RepoEntry[]
  ): Promise<RepoEntry[]> {
    const fileStatsPaths = new Set(
      entries
        .filter((entry) => entry.type === "file")
        .slice(0, contentCommitFileStatsLimit)
        .map((entry) => entry.path)
    );
    const enriched = await Promise.all(
      entries.slice(0, contentCommitMetadataLimit).map(async (entry) => {
        const lastCommit = await this.getContentLastCommit(input, entry.path, fileStatsPaths.has(entry.path));
        return {
          ...entry,
          ...(lastCommit.metadata ?? {}),
          lastCommitAvailability: lastCommit.availability
        };
      })
    );

    const skippedAvailability = {
      status: "not_loaded",
      message: "Last-change metadata was not loaded for this large directory."
    } satisfies GitHubReadAvailability;
    const skippedEntries = entries.slice(contentCommitMetadataLimit).map((entry) => ({
      ...entry,
      lastCommitAvailability: skippedAvailability
    }));

    return [...enriched, ...skippedEntries];
  }

  private async getContentLastCommit(
    input: RepoContentsInput,
    path: string,
    includeFileStats: boolean
  ): Promise<RepoEntryCommitResult> {
    try {
      const commits = await this.client.restPaginatedArray<GitHubCommit>(
        "GET /repos/{owner}/{repo}/commits",
        {
          owner: input.owner,
          repo: input.repo,
          path,
          sha: input.ref ?? undefined
        },
        1
      );

      const metadata = mapRepoEntryCommit(commits[0] ?? null);
      const availability: GitHubReadAvailability = metadata
        ? { status: "available", message: null }
        : { status: "available", message: "GitHub returned no commits for this path." };
      if (!metadata?.lastCommitSha || !includeFileStats) {
        return { metadata, availability };
      }

      try {
        const commit = await this.client.rest<GitHubCommitDetail>("GET /repos/{owner}/{repo}/commits/{ref}", {
          owner: input.owner,
          repo: input.repo,
          ref: metadata.lastCommitSha
        });
        return {
          metadata: { ...metadata, ...mapRepoEntryCommitFileStats(commit.files ?? [], path) },
          availability
        };
      } catch {
        return { metadata, availability };
      }
    } catch (error) {
      return {
        metadata: null,
        availability: this.mapError(error)
      };
    }
  }
}

export const repositorySummaryFragment = `
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
    pullRequests(states: OPEN) { totalCount }
    discussions { totalCount }
    releases { totalCount }
    primaryLanguage { name color }
  }
`;

export function mapRepositorySummary(node: GitHubRepositoryNode): RepositorySummary {
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
    watcherCount: node.watchers?.totalCount ?? 0,
    openIssuesCount: node.issues?.totalCount ?? 0,
    counts: mapRepositoryCounts(node),
    primaryLanguage: node.primaryLanguage,
    updatedAt: node.updatedAt,
    pushedAt: node.pushedAt,
    avatarUrl: node.owner.avatarUrl,
    defaultBranch: node.defaultBranchRef?.name ?? null
  };
}

export function mapLanguages(languages: GitHubLanguages): LanguageStat[] {
  const total = languages.totalSize;
  return languages.edges.map((edge) => ({
    name: edge.node.name,
    color: edge.node.color,
    size: edge.size,
    percent: total > 0 ? (edge.size / total) * 100 : 0
  }));
}

function mapRepositoryCounts(node: GitHubRepositoryNode): RepositoryCounts {
  return {
    openIssues: node.issues?.totalCount ?? 0,
    openPullRequests: node.pullRequests?.totalCount ?? 0,
    discussions: node.discussions?.totalCount ?? 0,
    projects: node.projectsV2?.totalCount ?? 0,
    releases: node.releases?.totalCount ?? 0,
    forks: node.forkCount,
    stars: node.stargazerCount,
    watchers: node.watchers?.totalCount ?? 0
  };
}

function mapRepositoryRef(node: GitHubRepositoryRefNode | null): RepositoryRef | null {
  if (!node) {
    return null;
  }

  return {
    id: node.id,
    owner: node.owner.login,
    name: node.name,
    nameWithOwner: node.nameWithOwner,
    htmlUrl: node.url,
    defaultBranch: node.defaultBranchRef?.name ?? null,
    visibility: node.visibility ?? null,
    isPrivate: node.isPrivate ?? null,
    forkCount: node.forkCount ?? null,
    stargazerCount: node.stargazerCount ?? null,
    viewerPermission: node.viewerPermission ?? null
  };
}

function mapRestRepositoryRef(node: GitHubRestRepositoryRef | null): RepositoryRef | null {
  if (!node) {
    return null;
  }

  return {
    id: String(node.node_id ?? node.id),
    owner: node.owner.login,
    name: node.name,
    nameWithOwner: node.full_name,
    htmlUrl: node.html_url,
    defaultBranch: node.default_branch ?? null,
    visibility: node.visibility ?? (node.private ? "PRIVATE" : "PUBLIC"),
    isPrivate: node.private ?? null,
    forkCount: node.forks_count ?? null,
    stargazerCount: node.stargazers_count ?? null,
    viewerPermission: mapRestRepositoryPermission(node.permissions)
  };
}

function mapRestRepositoryPermission(
  permissions: GitHubRestRepositoryPermissions | null | undefined
): string | null {
  if (!permissions) {
    return null;
  }

  if (permissions.admin) {
    return "ADMIN";
  }
  if (permissions.maintain) {
    return "MAINTAIN";
  }
  if (permissions.push) {
    return "WRITE";
  }
  if (permissions.triage) {
    return "TRIAGE";
  }
  if (permissions.pull) {
    return "READ";
  }

  return null;
}

function mapViewerPermissionToRepositoryAdministrationPermissions(
  viewerPermission: string | null
): RepositoryAdministrationMetadata["viewerPermissions"] {
  switch (viewerPermission?.toUpperCase()) {
    case "ADMIN":
      return {
        admin: true,
        maintain: true,
        push: true,
        triage: true,
        pull: true
      };
    case "MAINTAIN":
      return {
        admin: false,
        maintain: true,
        push: true,
        triage: true,
        pull: true
      };
    case "WRITE":
      return {
        admin: false,
        maintain: false,
        push: true,
        triage: true,
        pull: true
      };
    case "TRIAGE":
      return {
        admin: false,
        maintain: false,
        push: false,
        triage: true,
        pull: true
      };
    case "READ":
      return {
        admin: false,
        maintain: false,
        push: false,
        triage: false,
        pull: true
      };
    default:
      return {
        admin: null,
        maintain: null,
        push: null,
        triage: null,
        pull: null
      };
  }
}

function mapRestRepositoryAdministration(repository: GitHubRestRepository): RepositoryAdministrationMetadata {
  const securityAndAnalysis = repository.security_and_analysis;

  return {
    visibility: repository.visibility ?? (repository.private ? "private" : "public"),
    defaultBranch: repository.default_branch ?? null,
    isPrivate: Boolean(repository.private),
    isArchived: Boolean(repository.archived),
    isDisabled: Boolean(repository.disabled),
    isTemplate: repository.is_template ?? null,
    allowForking: repository.allow_forking ?? null,
    webCommitSignoffRequired: repository.web_commit_signoff_required ?? null,
    features: {
      issues: repository.has_issues ?? null,
      projects: repository.has_projects ?? null,
      wiki: repository.has_wiki ?? null,
      discussions: repository.has_discussions ?? null
    },
    mergeSettings: {
      allowMergeCommit: repository.allow_merge_commit ?? null,
      allowSquashMerge: repository.allow_squash_merge ?? null,
      allowRebaseMerge: repository.allow_rebase_merge ?? null,
      allowAutoMerge: repository.allow_auto_merge ?? null,
      deleteBranchOnMerge: repository.delete_branch_on_merge ?? null,
      allowUpdateBranch: repository.allow_update_branch ?? null
    },
    viewerPermissions: {
      admin: repository.permissions?.admin ?? null,
      maintain: repository.permissions?.maintain ?? null,
      push: repository.permissions?.push ?? null,
      triage: repository.permissions?.triage ?? null,
      pull: repository.permissions?.pull ?? null
    },
    securityAndAnalysis: {
      advancedSecurity: securityAndAnalysis?.advanced_security?.status ?? null,
      codeSecurity: securityAndAnalysis?.code_security?.status ?? null,
      dependabotAlerts: securityAndAnalysis?.dependabot_alerts?.status ?? null,
      dependabotSecurityUpdates: securityAndAnalysis?.dependabot_security_updates?.status ?? null,
      secretScanning: securityAndAnalysis?.secret_scanning?.status ?? null,
      secretScanningPushProtection: securityAndAnalysis?.secret_scanning_push_protection?.status ?? null,
      secretScanningNonProviderPatterns:
        securityAndAnalysis?.secret_scanning_non_provider_patterns?.status ?? null,
      secretScanningValidityChecks: securityAndAnalysis?.secret_scanning_validity_checks?.status ?? null,
      secretScanningAiDetection: securityAndAnalysis?.secret_scanning_ai_detection?.status ?? null
    }
  };
}

function fallbackRepositoryAdministration(input: {
  visibility: string;
  defaultBranch: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isDisabled: boolean;
  viewerPermission: string | null;
}): RepositoryAdministrationMetadata {
  return {
    visibility: input.visibility,
    defaultBranch: input.defaultBranch,
    isPrivate: input.isPrivate,
    isArchived: input.isArchived,
    isDisabled: input.isDisabled,
    isTemplate: null,
    allowForking: null,
    webCommitSignoffRequired: null,
    features: {
      issues: null,
      projects: null,
      wiki: null,
      discussions: null
    },
    mergeSettings: {
      allowMergeCommit: null,
      allowSquashMerge: null,
      allowRebaseMerge: null,
      allowAutoMerge: null,
      deleteBranchOnMerge: null,
      allowUpdateBranch: null
    },
    viewerPermissions: mapViewerPermissionToRepositoryAdministrationPermissions(input.viewerPermission),
    securityAndAnalysis: {
      advancedSecurity: null,
      codeSecurity: null,
      dependabotAlerts: null,
      dependabotSecurityUpdates: null,
      secretScanning: null,
      secretScanningPushProtection: null,
      secretScanningNonProviderPatterns: null,
      secretScanningValidityChecks: null,
      secretScanningAiDetection: null
    }
  };
}

function mapBranch(branch: GitHubBranch): BranchSummary {
  return {
    name: branch.name,
    commitSha: branch.commit.sha,
    protected: branch.protected
  };
}

function mapTag(tag: GitHubTag): TagSummary {
  return {
    name: tag.name,
    commitSha: tag.commit.sha,
    zipballUrl: tag.zipball_url ?? null,
    tarballUrl: tag.tarball_url ?? null
  };
}

function mapTreeEntry(
  owner: string,
  repo: string,
  ref: string,
  entry: GitHubTreeEntry
): RepoTreeEntry | null {
  if (!entry.path || !entry.sha) {
    return null;
  }

  const type =
    entry.type === "tree"
      ? "dir"
      : entry.type === "blob"
        ? "file"
        : entry.type === "commit"
          ? "submodule"
          : null;
  if (!type) {
    return null;
  }

  const encodedPath = encodePath(entry.path);
  return {
    path: entry.path,
    type,
    sha: entry.sha,
    size: typeof entry.size === "number" ? entry.size : null,
    htmlUrl: `https://github.com/${owner}/${repo}/${type === "dir" ? "tree" : "blob"}/${encodeURIComponent(ref)}/${encodedPath}`
  };
}

function treeEntryTypeRank(type: RepoTreeEntry["type"]): number {
  return type === "dir" ? 0 : type === "file" ? 1 : 2;
}

type RepoEntryCommitMetadata = Pick<
  RepoEntry,
  | "lastCommitSha"
  | "lastCommitMessage"
  | "lastCommitAuthorLogin"
  | "lastCommitAuthorName"
  | "lastCommitAuthorAvatarUrl"
  | "lastAuthoredDate"
  | "lastCommittedDate"
  | "lastCommitDate"
  | "lastCommitHtmlUrl"
  | "lastCommitAdditions"
  | "lastCommitDeletions"
  | "lastCommitChanges"
>;

interface RepoEntryCommitResult {
  metadata: RepoEntryCommitMetadata | null;
  availability: GitHubReadAvailability;
}

function repoFileContentBase(
  input: RepoFileContentInput,
  item: GitHubContentItem,
  lastCommit: RepoEntryCommitResult
): Omit<RepoFileContent, "kind" | "content" | "encoding" | "message"> {
  const branch = encodeURIComponent(input.ref ?? "HEAD");
  return {
    path: item.path || input.path,
    name: item.name || fileNameFromPath(input.path),
    ref: input.ref ?? null,
    size: typeof item.size === "number" ? item.size : null,
    htmlUrl:
      item.html_url ??
      `https://github.com/${input.owner}/${input.repo}/blob/${branch}/${encodePath(item.path || input.path)}`,
    downloadUrl: item.download_url ?? null,
    ...(lastCommit.metadata ?? emptyRepoEntryCommitMetadata()),
    lastCommitAvailability: lastCommit.availability
  };
}

function decodeGitHubBase64Text(
  item: GitHubContentItem
): { ok: true; content: string } | { ok: false; message: string | null } {
  if (item.encoding !== "base64" || !item.content) {
    return {
      ok: false,
      message: item.encoding ? `Unsupported GitHub content encoding: ${item.encoding}.` : null
    };
  }

  const encoded = item.content.replace(/\s/g, "");
  if (encoded.length === 0 || encoded.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(encoded)) {
    return { ok: false, message: "GitHub returned invalid base64 file content." };
  }

  try {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64").replace(/=+$/u, "") !== encoded.replace(/=+$/u, "")) {
      return { ok: false, message: "GitHub returned invalid base64 file content." };
    }

    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (contentHasNullByte(content)) {
      return { ok: false, message: "Binary-looking content is not previewed as text." };
    }
    return { ok: true, content };
  } catch {
    return { ok: false, message: "GitHub file content could not be decoded as UTF-8." };
  }
}

function mapRepoEntryCommit(commit: GitHubCommit | null): RepoEntryCommitMetadata | null {
  if (!commit) {
    return null;
  }

  const messageHeadline = commit.commit.message.split("\n")[0]?.trim() || commit.commit.message;
  const authoredDate = commit.commit.author?.date ?? null;
  const committedDate = commit.commit.committer?.date ?? authoredDate;

  return {
    lastCommitSha: commit.sha,
    lastCommitMessage: messageHeadline,
    lastCommitAuthorLogin: commit.author?.login ?? null,
    lastCommitAuthorName: commit.commit.author?.name ?? commit.author?.login ?? null,
    lastCommitAuthorAvatarUrl: commit.author?.avatar_url ?? null,
    lastAuthoredDate: authoredDate,
    lastCommittedDate: committedDate,
    lastCommitDate: committedDate,
    lastCommitHtmlUrl: commit.html_url ?? null,
    lastCommitAdditions: null,
    lastCommitDeletions: null,
    lastCommitChanges: null
  };
}

function mapRepoEntryCommitFileStats(
  files: GitHubCommitFile[],
  path: string
): Pick<RepoEntryCommitMetadata, "lastCommitAdditions" | "lastCommitDeletions" | "lastCommitChanges"> {
  const file = files.find((item) => item.filename === path || item.previous_filename === path);

  return {
    lastCommitAdditions: file?.additions ?? null,
    lastCommitDeletions: file?.deletions ?? null,
    lastCommitChanges: file?.changes ?? null
  };
}

function emptyRepoEntryCommitMetadata(): RepoEntryCommitMetadata {
  return {
    lastCommitSha: null,
    lastCommitMessage: null,
    lastCommitAuthorLogin: null,
    lastCommitAuthorName: null,
    lastCommitAuthorAvatarUrl: null,
    lastAuthoredDate: null,
    lastCommittedDate: null,
    lastCommitDate: null,
    lastCommitHtmlUrl: null,
    lastCommitAdditions: null,
    lastCommitDeletions: null,
    lastCommitChanges: null
  };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isGitHubStatus(error: unknown, status: number): boolean {
  const errorRecord = error && typeof error === "object" ? (error as { status?: unknown }) : {};
  return errorRecord.status === status;
}

export interface GitHubRepositoryNode {
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
  owner: { login: string; avatarUrl: string | null };
  watchers?: { totalCount: number };
  issues?: { totalCount: number };
  pullRequests?: { totalCount: number };
  discussions?: { totalCount: number };
  projectsV2?: { totalCount: number } | null;
  releases?: { totalCount: number };
  primaryLanguage: { name: string; color: string | null } | null;
}

export interface GitHubLanguages {
  totalSize: number;
  edges: Array<{ size: number; node: { name: string; color: string | null } }>;
}

interface GitHubRepositoryRefNode {
  id: string;
  name: string;
  nameWithOwner: string;
  url: string;
  defaultBranchRef: { name: string } | null;
  owner: { login: string };
  visibility?: string | null;
  isPrivate?: boolean | null;
  forkCount?: number | null;
  stargazerCount?: number | null;
  viewerPermission?: string | null;
}

interface GitHubRestRepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}

interface GitHubRestRepositorySecurityAndAnalysisFeature {
  status?: string | null;
}

interface GitHubRestRepositorySecurityAndAnalysis {
  advanced_security?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  code_security?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  dependabot_alerts?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  dependabot_security_updates?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_push_protection?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_non_provider_patterns?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_validity_checks?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_ai_detection?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
}

interface GitHubRestRepositoryRef {
  id: number | string;
  node_id?: string | null;
  name: string;
  full_name: string;
  html_url: string;
  default_branch?: string | null;
  visibility?: string | null;
  private?: boolean | null;
  forks_count?: number | null;
  stargazers_count?: number | null;
  archived?: boolean | null;
  disabled?: boolean | null;
  is_template?: boolean | null;
  has_issues?: boolean | null;
  has_projects?: boolean | null;
  has_wiki?: boolean | null;
  has_discussions?: boolean | null;
  allow_merge_commit?: boolean | null;
  allow_squash_merge?: boolean | null;
  allow_rebase_merge?: boolean | null;
  allow_auto_merge?: boolean | null;
  delete_branch_on_merge?: boolean | null;
  allow_update_branch?: boolean | null;
  allow_forking?: boolean | null;
  web_commit_signoff_required?: boolean | null;
  security_and_analysis?: GitHubRestRepositorySecurityAndAnalysis | null;
  owner: { login: string };
  permissions?: GitHubRestRepositoryPermissions | null;
}

interface GitHubRestRepository extends GitHubRestRepositoryRef {
  parent?: GitHubRestRepositoryRef | null;
  source?: GitHubRestRepositoryRef | null;
}

interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

interface GitHubTag {
  name: string;
  commit: { sha: string };
  zipball_url?: string | null;
  tarball_url?: string | null;
}

interface GitHubTree {
  sha: string;
  truncated: boolean;
  tree: GitHubTreeEntry[];
}

interface GitHubTreeEntry {
  path?: string;
  type?: "blob" | "tree" | "commit";
  sha?: string;
  size?: number;
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  sha: string;
  size?: number;
  html_url?: string;
  download_url?: string | null;
  content?: string | null;
  encoding?: string | null;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author?: { name?: string | null; date?: string | null } | null;
    committer?: { name?: string | null; date?: string | null } | null;
  };
  author?: GitHubUser | null;
  html_url?: string | null;
}

interface GitHubCommitDetail extends GitHubCommit {
  files?: GitHubCommitFile[];
}

interface GitHubCommitFile {
  filename: string;
  previous_filename?: string | null;
  additions?: number | null;
  deletions?: number | null;
  changes?: number | null;
}

interface GitHubUser {
  login: string;
  avatar_url: string | null;
}
