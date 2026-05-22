import type {
  AssignableUserSummary,
  GitHubReadAvailability,
  IssueDetail,
  IssueDetailInput,
  IssueDetailResult,
  IssueListInput,
  IssueListResult,
  IssueSummary,
  MilestoneSummary,
  TimelineCommentSummary
} from "@shared/github";

export interface OctokitIssueClient {
  rest<T>(route: string, params: Record<string, unknown>): Promise<T>;
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
}

export class OctokitIssueDomain {
  constructor(
    private readonly client: OctokitIssueClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listIssues(input: IssueListInput): Promise<IssueSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubIssue>(
      "GET /repos/{owner}/{repo}/issues",
      {
        owner: input.owner,
        repo: input.repo,
        state: input.state ?? "open"
      },
      input.limit ?? 50
    );
    return data.filter((issue) => !issue.pull_request).map(mapIssue);
  }

  async listIssuesWithStatus(input: IssueListInput): Promise<IssueListResult> {
    try {
      return {
        items: await this.listIssues(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async getIssueDetail(input: IssueDetailInput): Promise<IssueDetail> {
    const [issue, commentsResult] = await Promise.all([
      this.client.rest<GitHubIssue>("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner: input.owner,
        repo: input.repo,
        issue_number: input.issueNumber
      }),
      this.fetchIssueComments(input.owner, input.repo, input.issueNumber)
    ]);
    return {
      ...mapIssue(issue),
      body: issue.body ?? null,
      commentsList: commentsResult.items.map(mapTimelineComment),
      commentsAvailability: commentsResult.availability
    };
  }

  async getIssueDetailWithStatus(input: IssueDetailInput): Promise<IssueDetailResult> {
    try {
      return {
        detail: await this.getIssueDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        detail: null,
        availability: this.mapError(error)
      };
    }
  }

  private async fetchIssueComments(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<{ items: GitHubIssueComment[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.client.restPaginatedArray<GitHubIssueComment>(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner,
          repo,
          issue_number: issueNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }
}

function mapIssue(issue: GitHubIssue): IssueSummary {
  return {
    id: issue.id,
    nodeId: issue.node_id ?? null,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.state_reason ?? null,
    locked: issue.locked ?? false,
    authorLogin: issue.user?.login ?? null,
    authorAvatarUrl: issue.user?.avatar_url ?? null,
    comments: issue.comments,
    labels: issue.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color
    })),
    assignees: (issue.assignees ?? []).map(mapAssignableUser),
    milestone: mapIssueMilestone(issue.milestone),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    htmlUrl: issue.html_url
  };
}

function mapAssignableUser(user: GitHubAssignableUser): AssignableUserSummary {
  return {
    id: user.node_id ?? user.id,
    login: user.login,
    avatarUrl: user.avatar_url ?? null,
    htmlUrl: user.html_url ?? null
  };
}

function mapIssueMilestone(milestone: GitHubIssueMilestone | null | undefined): MilestoneSummary | null {
  if (!milestone) {
    return null;
  }

  return {
    id: milestone.node_id ?? milestone.id,
    number: milestone.number,
    title: milestone.title,
    description: milestone.description ?? null,
    state: milestone.state,
    dueOn: milestone.due_on ?? null,
    createdAt: milestone.created_at ?? null,
    updatedAt: milestone.updated_at ?? null,
    closedAt: milestone.closed_at ?? null,
    htmlUrl: milestone.html_url ?? null,
    openIssues: milestone.open_issues ?? null,
    closedIssues: milestone.closed_issues ?? null
  };
}

function mapTimelineComment(comment: GitHubIssueComment): TimelineCommentSummary {
  return {
    id: comment.id,
    authorLogin: comment.user?.login ?? null,
    authorAvatarUrl: comment.user?.avatar_url ?? null,
    body: comment.body ?? null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    htmlUrl: comment.html_url
  };
}

interface GitHubUser {
  login: string;
  avatar_url: string | null;
}

export interface GitHubIssue {
  id: number;
  node_id?: string | null;
  number: number;
  title: string;
  state: string;
  state_reason?: string | null;
  locked?: boolean | null;
  user: GitHubUser | null;
  body?: string | null;
  comments: number;
  labels: Array<{ id: number; name: string; color: string }>;
  assignees?: GitHubAssignableUser[];
  milestone?: GitHubIssueMilestone | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

interface GitHubAssignableUser {
  id: number | string;
  node_id?: string | null;
  login: string;
  avatar_url?: string | null;
  html_url?: string | null;
}

interface GitHubIssueMilestone {
  id: number | string;
  node_id?: string | null;
  number: number;
  title: string;
  description?: string | null;
  state: string;
  due_on?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  html_url?: string | null;
  open_issues?: number | null;
  closed_issues?: number | null;
}

interface GitHubIssueComment {
  id: number;
  user: GitHubUser | null;
  body: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}
