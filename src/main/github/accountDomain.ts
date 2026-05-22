import type {
  AccountIssueListInput,
  AccountIssueListResult,
  AccountProfileInput,
  AccountProfileResult,
  AccountPullRequestListInput,
  AccountPullRequestListResult,
  AccountRepositoryInput,
  AccountRepositoryListResult,
  GitHubAccountProfile,
  GitHubReadAvailability,
  IssueSummary,
  MilestoneSummary,
  PullRequestSummary,
  RepositorySummary,
  Viewer
} from "@shared/github";
import {
  mapRepositorySummary,
  repositorySummaryFragment,
  type GitHubRepositoryNode
} from "./repositoryDomain";

export interface OctokitAccountClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
}

const githubProfileFragment = `
  ${repositorySummaryFragment}

  fragment GitHubProfileFields on User {
    id
    login
    name
    avatarUrl
    url
    bio
    company
    location
    websiteUrl
    followers { totalCount }
    following { totalCount }
    repositories { totalCount }
    starredRepositories { totalCount }
    status { emoji message }
    pinnedItems(first: $limit, types: REPOSITORY) {
      nodes {
        ... on Repository {
          ...RepositorySummaryFields
        }
      }
    }
  }
`;

export class OctokitAccountDomain {
  constructor(
    private readonly client: OctokitAccountClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async getViewer(): Promise<Viewer> {
    const data = await this.client.graphql<{
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

  async getAccountProfile(input: AccountProfileInput = {}): Promise<GitHubAccountProfile> {
    const limit = 6;

    if (input.login) {
      const data = await this.client.graphql<{ user: GitHubProfileNode | null }>(
        `
        query AccountProfile($login: String!, $limit: Int!) {
          user(login: $login) {
            ...GitHubProfileFields
          }
        }

        ${githubProfileFragment}
      `,
        { login: input.login, limit }
      );

      if (!data.user) {
        throw new Error(`GitHub user ${input.login} was not found.`);
      }

      return mapAccountProfile(data.user);
    }

    const data = await this.client.graphql<{ viewer: GitHubProfileNode }>(
      `
      query ViewerProfile($limit: Int!) {
        viewer {
          ...GitHubProfileFields
        }
      }

      ${githubProfileFragment}
    `,
      { limit }
    );

    return mapAccountProfile(data.viewer);
  }

  async getAccountProfileWithStatus(input: AccountProfileInput = {}): Promise<AccountProfileResult> {
    try {
      return {
        profile: await this.getAccountProfile(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        profile: null,
        availability: this.mapError(error)
      };
    }
  }

  async listAccountRepositories(input: AccountRepositoryInput = {}): Promise<RepositorySummary[]> {
    const limit = input.limit ?? 50;

    if (!input.login) {
      const data = await this.client.graphql<{
        viewer: { repositories: { nodes: GitHubRepositoryNode[] } };
      }>(
        `
        query ViewerAccountRepositories($limit: Int!) {
          viewer {
            repositories(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
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

    const data = await this.client.graphql<{
      user: { repositories: { nodes: GitHubRepositoryNode[] } } | null;
    }>(
      `
      query AccountRepositories($login: String!, $limit: Int!) {
        user(login: $login) {
          repositories(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              ...RepositorySummaryFields
            }
          }
        }
      }

      ${repositorySummaryFragment}
    `,
      { login: input.login, limit }
    );

    return data.user?.repositories.nodes.map(mapRepositorySummary) ?? [];
  }

  async listAccountRepositoriesWithStatus(
    input: AccountRepositoryInput = {}
  ): Promise<AccountRepositoryListResult> {
    try {
      return {
        items: await this.listAccountRepositories(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listAccountIssues(input: AccountIssueListInput = {}): Promise<IssueSummary[]> {
    const limit = input.limit ?? 30;
    const login = input.login ?? (await this.getViewer()).login;
    const state = input.state ?? "open";
    const stateQualifier = state === "all" ? "" : ` is:${state}`;
    const query = `is:issue${stateQualifier} involves:${login} archived:false sort:updated-desc`;
    const data = await this.client.graphql<{ search: { nodes: GitHubSearchIssueNode[] } }>(
      `
      query AccountIssues($searchQuery: String!, $limit: Int!) {
        search(query: $searchQuery, type: ISSUE, first: $limit) {
          nodes {
            ... on Issue {
              id
              number
              title
              state
              stateReason
              locked
              url
              createdAt
              updatedAt
              author { login avatarUrl }
              comments { totalCount }
              labels(first: 8) {
                nodes { id name color }
              }
              assignees(first: 8) {
                nodes { id login avatarUrl url }
              }
              milestone {
                id
                number
                title
                description
                state
                dueOn
                createdAt
                updatedAt
                closedAt
                url
              }
              repository { nameWithOwner }
            }
          }
        }
      }
    `,
      { searchQuery: query, limit }
    );

    return data.search.nodes.filter(Boolean).map(mapGraphqlIssue);
  }

  async listAccountIssuesWithStatus(input: AccountIssueListInput = {}): Promise<AccountIssueListResult> {
    try {
      return {
        items: await this.listAccountIssues(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listAccountPullRequests(input: AccountPullRequestListInput = {}): Promise<PullRequestSummary[]> {
    const limit = input.limit ?? 30;
    const login = input.login ?? (await this.getViewer()).login;
    const state = input.state ?? "open";
    const stateQualifier = state === "all" ? "" : ` is:${state}`;
    const query = `is:pr${stateQualifier} involves:${login} archived:false sort:updated-desc`;
    const data = await this.client.graphql<{ search: { nodes: GitHubSearchPullRequestNode[] } }>(
      `
      query AccountPullRequests($searchQuery: String!, $limit: Int!) {
        search(query: $searchQuery, type: ISSUE, first: $limit) {
          nodes {
            ... on PullRequest {
              id
              number
              title
              state
              merged
              mergedAt
              isDraft
              locked
              url
              createdAt
              updatedAt
              author { login avatarUrl }
              comments { totalCount }
              reviewThreads { totalCount }
              additions
              deletions
              changedFiles
              mergeStateStatus
              headRefName
              baseRefName
              headRepository { nameWithOwner }
              baseRepository { nameWithOwner }
              repository { nameWithOwner }
            }
          }
        }
      }
    `,
      { searchQuery: query, limit }
    );

    return data.search.nodes.filter(Boolean).map(mapGraphqlPullRequest);
  }

  async listAccountPullRequestsWithStatus(
    input: AccountPullRequestListInput = {}
  ): Promise<AccountPullRequestListResult> {
    try {
      return {
        items: await this.listAccountPullRequests(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }
}

function mapAccountProfile(node: GitHubProfileNode): GitHubAccountProfile {
  return {
    id: node.id,
    login: node.login,
    name: node.name,
    avatarUrl: node.avatarUrl,
    htmlUrl: node.url,
    bio: node.bio,
    company: node.company,
    location: node.location,
    websiteUrl: node.websiteUrl,
    followers: node.followers.totalCount,
    following: node.following.totalCount,
    repositoryCount: node.repositories.totalCount,
    starredRepositoryCount: node.starredRepositories.totalCount,
    status: node.status ? { emoji: node.status.emoji, message: node.status.message } : null,
    pinnedRepositories: node.pinnedItems.nodes.filter(Boolean).map(mapRepositorySummary)
  };
}

function mapGraphqlAssignableUser(user: GitHubGraphqlAssignableUser) {
  return {
    id: user.id,
    login: user.login,
    avatarUrl: user.avatarUrl ?? null,
    htmlUrl: user.url ?? null
  };
}

function mapGraphqlIssue(issue: GitHubSearchIssueNode): IssueSummary {
  return {
    id: issue.id,
    nodeId: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.stateReason ?? null,
    locked: issue.locked ?? false,
    authorLogin: issue.author?.login ?? null,
    authorAvatarUrl: issue.author?.avatarUrl ?? null,
    comments: issue.comments.totalCount,
    labels: issue.labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color
    })),
    assignees: issue.assignees.nodes.map(mapGraphqlAssignableUser),
    milestone: mapGraphqlMilestone(issue.milestone),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    htmlUrl: issue.url,
    repositoryNameWithOwner: issue.repository.nameWithOwner
  };
}

function mapGraphqlMilestone(
  milestone: GitHubSearchIssueNode["milestone"] | null | undefined
): MilestoneSummary | null {
  if (!milestone) {
    return null;
  }

  return {
    id: milestone.id,
    number: milestone.number,
    title: milestone.title,
    description: milestone.description ?? null,
    state: milestone.state,
    dueOn: milestone.dueOn ?? null,
    createdAt: milestone.createdAt ?? null,
    updatedAt: milestone.updatedAt ?? null,
    closedAt: milestone.closedAt ?? null,
    htmlUrl: milestone.url ?? null,
    openIssues: null,
    closedIssues: null
  };
}

function mapGraphqlPullRequest(pr: GitHubSearchPullRequestNode): PullRequestSummary {
  const headRepositoryNameWithOwner = pr.headRepository?.nameWithOwner ?? null;
  const baseRepositoryNameWithOwner = pr.baseRepository?.nameWithOwner ?? pr.repository.nameWithOwner;
  const isCrossRepository =
    headRepositoryNameWithOwner && baseRepositoryNameWithOwner
      ? headRepositoryNameWithOwner !== baseRepositoryNameWithOwner
      : null;

  return {
    id: pr.id,
    nodeId: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged,
    mergedAt: pr.mergedAt ?? null,
    isDraft: pr.isDraft,
    locked: pr.locked ?? false,
    authorLogin: pr.author?.login ?? null,
    authorAvatarUrl: pr.author?.avatarUrl ?? null,
    comments: pr.comments.totalCount,
    reviewComments: pr.reviewThreads.totalCount,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    mergeableState: normalizeGraphqlMergeStateStatus(pr.mergeStateStatus),
    reviewDecision: null,
    mergeCommitSha: null,
    maintainerCanModify: null,
    isCrossRepository,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    headRepositoryNameWithOwner,
    baseRepositoryNameWithOwner,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    htmlUrl: pr.url,
    repositoryNameWithOwner: pr.repository.nameWithOwner
  };
}

function normalizeGraphqlMergeStateStatus(status: string | null): string | null {
  return status?.toLowerCase() ?? null;
}

interface GitHubProfileNode {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  websiteUrl: string | null;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: { totalCount: number };
  starredRepositories: { totalCount: number };
  status: { emoji: string | null; message: string | null } | null;
  pinnedItems: { nodes: GitHubRepositoryNode[] };
}

interface GitHubGraphqlAssignableUser {
  id: string;
  login: string;
  avatarUrl: string | null;
  url: string | null;
}

interface GitHubSearchIssueNode {
  id: string;
  number: number;
  title: string;
  state: string;
  stateReason?: string | null;
  locked?: boolean | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatarUrl: string | null } | null;
  comments: { totalCount: number };
  labels: { nodes: Array<{ id: string; name: string; color: string }> };
  assignees: { nodes: GitHubGraphqlAssignableUser[] };
  milestone: {
    id: string;
    number: number;
    title: string;
    description: string | null;
    state: string;
    dueOn: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    closedAt: string | null;
    url: string | null;
  } | null;
  repository: { nameWithOwner: string };
}

interface GitHubSearchPullRequestNode {
  id: string;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  mergedAt?: string | null;
  isDraft: boolean;
  locked?: boolean | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatarUrl: string | null } | null;
  comments: { totalCount: number };
  reviewThreads: { totalCount: number };
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeStateStatus: string | null;
  headRefName: string;
  baseRefName: string;
  headRepository?: { nameWithOwner: string } | null;
  baseRepository?: { nameWithOwner: string } | null;
  repository: { nameWithOwner: string };
}
