import type {
  AssignableUserSummary,
  GitHubReadAvailability,
  LabelSummary,
  MilestoneSummary,
  PullRequestCheckSummary,
  PullRequestChecksInput,
  PullRequestChecksResult,
  PullRequestCommitSummary,
  PullRequestCommitsInput,
  PullRequestCommitsResult,
  PullRequestCommentsInput,
  PullRequestCommentsResult,
  PullRequestDetail,
  PullRequestDetailInput,
  PullRequestDetailResult,
  PullRequestFileSummary,
  PullRequestFilesInput,
  PullRequestFilesResult,
  PullRequestLinkedIssuesInput,
  PullRequestLinkedIssuesResult,
  PullRequestLinkedIssueSummary,
  PullRequestListInput,
  PullRequestListResult,
  PullRequestOverviewInput,
  PullRequestOverviewResult,
  PullRequestRequestedTeamSummary,
  PullRequestReviewsInput,
  PullRequestReviewsResult,
  PullRequestReviewThreadsInput,
  PullRequestReviewThreadsResult,
  PullRequestReviewSummary,
  PullRequestReviewThreadCommentSummary,
  PullRequestReviewThreadSummary,
  PullRequestTimelineInput,
  PullRequestTimelineResult,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  TimelineCommentSummary
} from "@shared/github";

export interface OctokitPullRequestClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
  rest<T>(route: string, params: Record<string, unknown>): Promise<T>;
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
  restPaginatedWrapped<T, K extends string>(
    route: string,
    key: K,
    params: Record<string, unknown>,
    limit: number
  ): Promise<T[]>;
}

const pullRequestReviewThreadCommentNodeSelection = `
  databaseId
  replyTo {
    databaseId
  }
`;

export class OctokitPullRequestDomain {
  constructor(
    private readonly client: OctokitPullRequestClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubPullRequest>(
      "GET /repos/{owner}/{repo}/pulls",
      {
        owner: input.owner,
        repo: input.repo,
        state: input.state ?? "open"
      },
      input.limit ?? 50
    );
    return data.map(mapPullRequest);
  }

  async listPullRequestsWithStatus(input: PullRequestListInput): Promise<PullRequestListResult> {
    try {
      return {
        items: await this.listPullRequests(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async getPullRequestDetail(input: PullRequestDetailInput): Promise<PullRequestDetail> {
    const pullRequest = await this.client.rest<GitHubPullRequest>(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: input.owner,
        repo: input.repo,
        pull_number: input.pullNumber
      }
    );

    const [
      issue,
      commentsResult,
      filesResult,
      commitsResult,
      reviewsResult,
      reviewCommentsResult,
      reviewThreadStatesResult,
      checks,
      timeline,
      linkedIssues,
      reviewDecisionResult
    ] = await Promise.all([
      this.client.rest<GitHubIssue>("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner: input.owner,
        repo: input.repo,
        issue_number: input.pullNumber
      }),
      this.fetchIssueComments(input.owner, input.repo, input.pullNumber),
      this.fetchPullRequestFiles(input),
      this.fetchPullRequestCommits(input),
      this.fetchPullRequestReviews(input),
      this.fetchPullRequestReviewComments(input),
      this.fetchPullRequestReviewThreadStates(input),
      this.fetchPullRequestChecks(input.owner, input.repo, pullRequest.head?.sha ?? null),
      this.fetchPullRequestTimeline(input),
      this.fetchPullRequestLinkedIssues(input),
      this.fetchPullRequestReviewDecision(input)
    ]);
    const mappedReviews = reviewsResult.items.map(mapPullRequestReview);
    const reviewThreads = groupPullRequestReviewThreads(
      reviewCommentsResult.items,
      reviewThreadStatesResult.items
    );
    return {
      ...mapPullRequest(pullRequest),
      reviewDecision: reviewDecisionResult.reviewDecision,
      body: pullRequest.body ?? null,
      labels: issue.labels.map(mapLabel),
      assignees: (issue.assignees ?? []).map(mapAssignableUser),
      milestone: mapIssueMilestone(issue.milestone),
      commentsList: commentsResult.items.map(mapTimelineComment),
      commentsAvailability: commentsResult.availability,
      files: filesResult.items.map(mapPullRequestFile),
      filesAvailability: filesResult.availability,
      commitsList: commitsResult.items.map(mapPullRequestCommit),
      commitsAvailability: commitsResult.availability,
      requestedReviewers: (pullRequest.requested_reviewers ?? []).map(mapAssignableUser),
      requestedTeams: (pullRequest.requested_teams ?? []).map(mapRequestedTeam),
      reviews: mappedReviews,
      reviewsAvailability: reviewsResult.availability,
      latestReviewState: latestPullRequestReviewState(mappedReviews),
      reviewDecisionAvailability: reviewDecisionResult.availability,
      checks: checks.items,
      checksAvailability: checks.availability,
      reviewThreads,
      reviewThreadsAvailability: reviewCommentsResult.availability,
      reviewThreadStatesAvailability: reviewThreadStatesResult.availability,
      timelineEvents: timeline.items,
      timelineAvailability: timeline.availability,
      linkedIssues: linkedIssues.items,
      linkedIssuesAvailability: linkedIssues.availability
    };
  }

  async getPullRequestDetailWithStatus(input: PullRequestDetailInput): Promise<PullRequestDetailResult> {
    try {
      return {
        detail: await this.getPullRequestDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        detail: null,
        availability: this.mapError(error)
      };
    }
  }

  async getPullRequestOverviewWithStatus(
    input: PullRequestOverviewInput
  ): Promise<PullRequestOverviewResult> {
    try {
      const [pullRequest, issue, reviewsResult, reviewDecisionResult] = await Promise.all([
        this.client.rest<GitHubPullRequest>("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
        }),
        this.client.rest<GitHubIssue>("GET /repos/{owner}/{repo}/issues/{issue_number}", {
          owner: input.owner,
          repo: input.repo,
          issue_number: input.pullNumber
        }),
        this.fetchPullRequestReviews(input),
        this.fetchPullRequestReviewDecision(input)
      ]);
      const reviews = reviewsResult.items.map(mapPullRequestReview);

      return {
        overview: {
          ...mapPullRequest(pullRequest),
          reviewDecision: reviewDecisionResult.reviewDecision,
          body: pullRequest.body ?? null,
          labels: issue.labels.map(mapLabel),
          assignees: (issue.assignees ?? []).map(mapAssignableUser),
          milestone: mapIssueMilestone(issue.milestone),
          requestedReviewers: (pullRequest.requested_reviewers ?? []).map(mapAssignableUser),
          requestedTeams: (pullRequest.requested_teams ?? []).map(mapRequestedTeam),
          latestReviewState: latestPullRequestReviewState(reviews),
          reviewDecisionAvailability: reviewDecisionResult.availability
        },
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        overview: null,
        availability: this.mapError(error)
      };
    }
  }

  async listPullRequestCommentsWithStatus(
    input: PullRequestCommentsInput
  ): Promise<PullRequestCommentsResult> {
    const result = await this.fetchIssueComments(input.owner, input.repo, input.pullNumber);
    return {
      items: result.items.map(mapTimelineComment),
      availability: result.availability,
      pageInfo: null
    };
  }

  async listPullRequestFilesWithStatus(input: PullRequestFilesInput): Promise<PullRequestFilesResult> {
    const result = await this.fetchPullRequestFiles(input);
    return {
      items: result.items.map(mapPullRequestFile),
      availability: result.availability,
      pageInfo: null
    };
  }

  async listPullRequestCommitsWithStatus(input: PullRequestCommitsInput): Promise<PullRequestCommitsResult> {
    const result = await this.fetchPullRequestCommits(input);
    return {
      items: result.items.map(mapPullRequestCommit),
      availability: result.availability,
      pageInfo: null
    };
  }

  async listPullRequestReviewsWithStatus(input: PullRequestReviewsInput): Promise<PullRequestReviewsResult> {
    const result = await this.fetchPullRequestReviews(input);
    return {
      items: result.items.map(mapPullRequestReview),
      availability: result.availability,
      pageInfo: null
    };
  }

  async listPullRequestChecksWithStatus(input: PullRequestChecksInput): Promise<PullRequestChecksResult> {
    try {
      const pullRequest = await this.client.rest<GitHubPullRequest>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
        }
      );
      return this.fetchPullRequestChecks(input.owner, input.repo, pullRequest.head?.sha ?? null);
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listPullRequestReviewThreadsWithStatus(
    input: PullRequestReviewThreadsInput
  ): Promise<PullRequestReviewThreadsResult> {
    const [reviewCommentsResult, reviewThreadStatesResult] = await Promise.all([
      this.fetchPullRequestReviewComments(input),
      this.fetchPullRequestReviewThreadStates(input)
    ]);

    return {
      items: groupPullRequestReviewThreads(reviewCommentsResult.items, reviewThreadStatesResult.items),
      availability: reviewCommentsResult.availability,
      statesAvailability: reviewThreadStatesResult.availability,
      pageInfo: null
    };
  }

  async listPullRequestTimelineWithStatus(
    input: PullRequestTimelineInput
  ): Promise<PullRequestTimelineResult> {
    const result = await this.fetchPullRequestTimeline(input);
    return {
      items: result.items,
      availability: result.availability,
      pageInfo: null
    };
  }

  async listPullRequestLinkedIssuesWithStatus(
    input: PullRequestLinkedIssuesInput
  ): Promise<PullRequestLinkedIssuesResult> {
    return this.fetchPullRequestLinkedIssues(input);
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

  private async fetchPullRequestReviewComments(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestReviewComment[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.client.restPaginatedArray<GitHubPullRequestReviewComment>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
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

  private async fetchPullRequestReviewThreadStates(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestReviewThreadNode[]; availability: GitHubReadAvailability }> {
    try {
      const allNodes: GitHubPullRequestReviewThreadNode[] = [];
      let hasNextPage = true;
      let after: string | null = null;

      while (hasNextPage) {
        type ReviewThreadsData = {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: GitHubPullRequestReviewThreadNode[];
                pageInfo: { hasNextPage: boolean; endCursor: string | null };
              };
            } | null;
          } | null;
        };
        const data: ReviewThreadsData = await this.client.graphql<ReviewThreadsData>(
          `
          query PullRequestReviewThreadStates($owner: String!, $repo: String!, $number: Int!, $after: String) {
            repository(owner: $owner, name: $repo) {
              pullRequest(number: $number) {
                reviewThreads(first: 100, after: $after) {
                  pageInfo { hasNextPage endCursor }
                  nodes {
                    id
                    isResolved
                    isOutdated
                    path
                    comments(first: 100) {
                      pageInfo { hasNextPage endCursor }
                      nodes {
                        ${pullRequestReviewThreadCommentNodeSelection}
                      }
                    }
                  }
                }
              }
            }
          }
          `,
          {
            owner: input.owner,
            repo: input.repo,
            number: input.pullNumber,
            after
          }
        );

        const threads:
          | {
              nodes: GitHubPullRequestReviewThreadNode[];
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
            }
          | undefined = data.repository?.pullRequest?.reviewThreads ?? undefined;
        if (threads?.nodes) {
          const nodes = await Promise.all(
            threads.nodes.map((thread) => this.fetchRemainingPullRequestReviewThreadComments(thread))
          );
          allNodes.push(...nodes);
        }
        hasNextPage = threads?.pageInfo?.hasNextPage ?? false;
        after = threads?.pageInfo?.endCursor ?? null;
      }

      return {
        items: allNodes,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  private async fetchRemainingPullRequestReviewThreadComments(
    thread: GitHubPullRequestReviewThreadNode
  ): Promise<GitHubPullRequestReviewThreadNode> {
    const comments = [...thread.comments.nodes];
    let hasNextPage = thread.comments.pageInfo?.hasNextPage ?? false;
    let after = thread.comments.pageInfo?.endCursor ?? null;

    while (hasNextPage && after) {
      const data = await this.client.graphql<{
        node: {
          comments: {
            nodes: GitHubPullRequestReviewThreadCommentNode[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        } | null;
      }>(
        `
        query PullRequestReviewThreadComments($threadId: ID!, $after: String) {
          node(id: $threadId) {
            ... on PullRequestReviewThread {
              comments(first: 100, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  ${pullRequestReviewThreadCommentNodeSelection}
                }
              }
            }
          }
        }
        `,
        {
          threadId: thread.id,
          after
        }
      );
      const connection = data.node?.comments;
      comments.push(...(connection?.nodes ?? []));
      hasNextPage = connection?.pageInfo.hasNextPage ?? false;
      after = connection?.pageInfo.endCursor ?? null;
    }

    return {
      ...thread,
      comments: {
        ...thread.comments,
        nodes: comments
      }
    };
  }

  private async fetchPullRequestFiles(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestFile[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.client.restPaginatedArray<GitHubPullRequestFile>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
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

  private async fetchPullRequestCommits(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestCommit[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.client.restPaginatedArray<GitHubPullRequestCommit>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
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

  private async fetchPullRequestReviews(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestReview[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.client.restPaginatedArray<GitHubPullRequestReview>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
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

  private async fetchPullRequestLinkedIssues(
    input: PullRequestDetailInput
  ): Promise<{ items: PullRequestLinkedIssueSummary[]; availability: GitHubReadAvailability }> {
    try {
      const data = await this.client.graphql<{
        repository: {
          pullRequest: {
            closingIssuesReferences: {
              nodes: GitHubClosingIssueReferenceNode[];
            };
          } | null;
        } | null;
      }>(
        `
        query PullRequestLinkedIssues($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              closingIssuesReferences(first: 20) {
                nodes {
                  number
                  title
                  state
                  stateReason
                  url
                  repository {
                    nameWithOwner
                  }
                }
              }
            }
          }
        }
      `,
        { owner: input.owner, repo: input.repo, number: input.pullNumber }
      );
      return {
        items: (data.repository?.pullRequest?.closingIssuesReferences.nodes ?? []).map(
          mapPullRequestLinkedIssue
        ),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  private async fetchPullRequestTimeline(
    input: PullRequestDetailInput
  ): Promise<{ items: PullRequestTimelineEventSummary[]; availability: GitHubReadAvailability }> {
    try {
      const events = await this.client.restPaginatedArray<GitHubIssueTimelineEvent>(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
        {
          owner: input.owner,
          repo: input.repo,
          issue_number: input.pullNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items: events.map((event) => mapPullRequestTimelineEvent(event, input.owner, input.repo)),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  private async fetchPullRequestReviewDecision(
    input: PullRequestDetailInput
  ): Promise<{ reviewDecision: string | null; availability: GitHubReadAvailability }> {
    try {
      const data = await this.client.graphql<{
        repository: { pullRequest: { reviewDecision: string | null } | null } | null;
      }>(
        `
        query PullRequestReviewDecision($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              reviewDecision
            }
          }
        }
        `,
        { owner: input.owner, repo: input.repo, number: input.pullNumber }
      );
      return {
        reviewDecision: data.repository?.pullRequest?.reviewDecision ?? null,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        reviewDecision: null,
        availability: this.mapError(error)
      };
    }
  }

  private async fetchPullRequestChecks(
    owner: string,
    repo: string,
    ref: string | null
  ): Promise<{ items: PullRequestCheckSummary[]; availability: GitHubReadAvailability }> {
    if (!ref) {
      return {
        items: [],
        availability: { status: "feature_disabled", message: "Pull request head SHA is unavailable." }
      };
    }

    try {
      const checkRuns = await this.client.restPaginatedWrapped<GitHubCheckRun, "check_runs">(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
        "check_runs",
        {
          owner,
          repo,
          ref
        },
        100
      );
      return {
        items: checkRuns.map(mapPullRequestCheck),
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

export function mapPullRequest(pr: GitHubPullRequest): PullRequestSummary {
  const headRepositoryNameWithOwner = pr.head?.repo?.full_name ?? null;
  const baseRepositoryNameWithOwner = pr.base?.repo?.full_name ?? null;
  return {
    id: pr.id,
    nodeId: pr.node_id ?? null,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged ?? (pr.merged_at ? true : null),
    mergedAt: pr.merged_at ?? null,
    isDraft: pr.draft,
    locked: pr.locked ?? false,
    authorLogin: pr.user?.login ?? null,
    authorAvatarUrl: pr.user?.avatar_url ?? null,
    comments: pr.comments ?? 0,
    reviewComments: pr.review_comments ?? 0,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
    mergeableState: pr.mergeable_state ?? null,
    reviewDecision: null,
    mergeCommitSha: pr.merge_commit_sha ?? null,
    maintainerCanModify: pr.maintainer_can_modify ?? null,
    isCrossRepository:
      headRepositoryNameWithOwner && baseRepositoryNameWithOwner
        ? headRepositoryNameWithOwner !== baseRepositoryNameWithOwner
        : null,
    headRefName: pr.head?.ref ?? "",
    baseRefName: pr.base?.ref ?? "",
    headRepositoryNameWithOwner,
    baseRepositoryNameWithOwner,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url
  };
}

function mapLabel(label: GitHubLabel): LabelSummary {
  return {
    id: String(label.node_id ?? label.id),
    name: label.name,
    color: label.color,
    description: label.description ?? null
  };
}

function mapAssignableUser(user: GitHubAssignableUser): AssignableUserSummary {
  return {
    id: String(user.node_id ?? user.id),
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

function mapPullRequestTimelineEvent(
  event: GitHubIssueTimelineEvent,
  owner: string,
  repo: string
): PullRequestTimelineEventSummary {
  return {
    id: event.id ?? `${event.event}-${event.created_at ?? "unknown"}`,
    event: event.event,
    actorLogin: event.actor?.login ?? null,
    actorAvatarUrl: event.actor?.avatar_url ?? null,
    createdAt: event.created_at ?? null,
    commitSha: event.commit_id ?? null,
    labelName: event.label?.name ?? null,
    assigneeLogin: event.assignee?.login ?? null,
    requestedReviewerLogin: event.requested_reviewer?.login ?? null,
    requestedTeamName: event.requested_team?.name ?? null,
    milestoneTitle: event.milestone?.title ?? null,
    renameFrom: event.rename?.from ?? null,
    renameTo: event.rename?.to ?? null,
    sourceIssue: mapTimelineSourceIssue(event.source?.issue, owner, repo)
  };
}

function mapTimelineSourceIssue(
  issue: GitHubIssueTimelineSourceIssue | null | undefined,
  owner: string,
  repo: string
): PullRequestTimelineEventSummary["sourceIssue"] {
  if (!issue?.number) {
    return null;
  }

  return {
    number: issue.number,
    title: issue.title ?? null,
    htmlUrl: issue.html_url ?? null,
    repositoryNameWithOwner: repositoryNameWithOwnerFromApiUrl(issue.repository_url) ?? `${owner}/${repo}`
  };
}

function repositoryNameWithOwnerFromApiUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const match = /\/repos\/([^/]+)\/([^/?#]+)/.exec(url);
  if (!match) {
    return null;
  }

  return `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`;
}

function mapPullRequestLinkedIssue(issue: GitHubClosingIssueReferenceNode): PullRequestLinkedIssueSummary {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.stateReason ?? null,
    htmlUrl: issue.url ?? null,
    repositoryNameWithOwner: issue.repository?.nameWithOwner ?? null
  };
}

function mapPullRequestFile(file: GitHubPullRequestFile): PullRequestFileSummary {
  return {
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch ?? null,
    blobUrl: file.blob_url ?? null,
    rawUrl: file.raw_url ?? null
  };
}

function mapPullRequestCommit(commit: GitHubPullRequestCommit): PullRequestCommitSummary {
  const messageHeadline = commit.commit.message.split("\n")[0]?.trim() || commit.commit.message;
  return {
    sha: commit.sha,
    message: messageHeadline,
    authorLogin: commit.author?.login ?? null,
    authorAvatarUrl: commit.author?.avatar_url ?? null,
    committedAt: commit.commit.committer?.date ?? commit.commit.author?.date ?? "",
    htmlUrl: commit.html_url ?? null
  };
}

function mapPullRequestReview(review: GitHubPullRequestReview): PullRequestReviewSummary {
  return {
    id: review.id,
    authorLogin: review.user?.login ?? null,
    authorAvatarUrl: review.user?.avatar_url ?? null,
    state: review.state,
    body: review.body ?? null,
    submittedAt: review.submitted_at ?? null,
    commitSha: review.commit_id ?? null,
    htmlUrl: review.html_url ?? null
  };
}

function latestPullRequestReviewState(reviews: PullRequestReviewSummary[]): string | null {
  return (
    reviews
      .filter((review) => review.state !== "COMMENTED")
      .sort((a, b) => (Date.parse(b.submittedAt ?? "") || 0) - (Date.parse(a.submittedAt ?? "") || 0))[0]
      ?.state ?? null
  );
}

function mapPullRequestCheck(run: GitHubCheckRun): PullRequestCheckSummary {
  return {
    id: run.id,
    name: run.name,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    startedAt: run.started_at ?? null,
    completedAt: run.completed_at ?? null,
    htmlUrl: run.html_url ?? null,
    detailsUrl: run.details_url ?? null,
    appName: run.app?.name ?? null,
    outputTitle: run.output?.title ?? null,
    outputSummary: run.output?.summary ?? null
  };
}

function groupPullRequestReviewThreads(
  comments: GitHubPullRequestReviewComment[],
  threadStates: GitHubPullRequestReviewThreadNode[] = []
): PullRequestReviewThreadSummary[] {
  const threadComments = comments.map(mapPullRequestReviewThreadComment);
  const byThreadId = new Map<number, PullRequestReviewThreadCommentSummary[]>();
  const stateByThreadId = new Map<number, GitHubPullRequestReviewThreadNode>();

  for (const threadState of threadStates) {
    const rootComment = threadState.comments.nodes.find((comment) => comment.replyTo === null);
    const rootCommentId = rootComment?.databaseId ?? threadState.comments.nodes[0]?.databaseId ?? null;
    if (rootCommentId !== null) {
      stateByThreadId.set(rootCommentId, threadState);
    }
  }

  for (const comment of threadComments) {
    const threadId = comment.inReplyToId ?? comment.id;
    byThreadId.set(threadId, [...(byThreadId.get(threadId) ?? []), comment]);
  }

  return Array.from(byThreadId.entries()).map(([threadId, commentsInThread]) => {
    const root = commentsInThread.find((comment) => comment.id === threadId) ?? commentsInThread[0]!;
    const threadState =
      stateByThreadId.get(threadId) ??
      commentsInThread.map((comment) => stateByThreadId.get(comment.id)).find((state) => state !== undefined);
    return {
      id: threadId,
      path: threadState?.path ?? root.path,
      isResolved: threadState?.isResolved ?? null,
      isOutdated: threadState?.isOutdated ?? null,
      comments: commentsInThread.sort(
        (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)
      )
    };
  });
}

function mapPullRequestReviewThreadComment(
  comment: GitHubPullRequestReviewComment
): PullRequestReviewThreadCommentSummary {
  return {
    id: comment.id,
    reviewId: comment.pull_request_review_id ?? null,
    authorLogin: comment.user?.login ?? null,
    authorAvatarUrl: comment.user?.avatar_url ?? null,
    body: comment.body ?? null,
    path: comment.path,
    diffHunk: comment.diff_hunk ?? null,
    position: comment.position ?? null,
    originalPosition: comment.original_position ?? null,
    startLine: comment.start_line ?? null,
    line: comment.line ?? null,
    side: comment.side ?? null,
    inReplyToId: comment.in_reply_to_id ?? null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    htmlUrl: comment.html_url ?? null
  };
}

function mapRequestedTeam(team: GitHubRequestedTeam): PullRequestRequestedTeamSummary {
  return {
    id: team.node_id ?? team.id,
    name: team.name,
    slug: team.slug,
    htmlUrl: team.html_url ?? null
  };
}

export interface GitHubPullRequest {
  id: number | string;
  node_id?: string | null;
  number: number;
  title: string;
  state: string;
  merged?: boolean | null;
  merged_at?: string | null;
  draft: boolean;
  locked?: boolean | null;
  user: GitHubUser | null;
  body?: string | null;
  comments?: number | null;
  review_comments?: number | null;
  additions?: number | null;
  deletions?: number | null;
  changed_files?: number | null;
  mergeable_state?: string | null;
  merge_commit_sha?: string | null;
  maintainer_can_modify?: boolean | null;
  head?: {
    ref?: string | null;
    sha?: string | null;
    repo?: { full_name?: string | null } | null;
  } | null;
  base?: {
    ref?: string | null;
    repo?: { full_name?: string | null } | null;
  } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  requested_reviewers?: GitHubAssignableUser[] | null;
  requested_teams?: GitHubRequestedTeam[] | null;
}

interface GitHubUser {
  login: string;
  avatar_url: string | null;
}

interface GitHubLabel {
  id: number | string;
  node_id?: string | null;
  name: string;
  color: string;
  description?: string | null;
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

interface GitHubIssue {
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
  labels: GitHubLabel[];
  assignees?: GitHubAssignableUser[];
  milestone?: GitHubIssueMilestone | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

interface GitHubIssueComment {
  id: number;
  user: GitHubUser | null;
  body: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubIssueTimelineSourceIssue {
  number?: number | null;
  title?: string | null;
  html_url?: string | null;
  repository_url?: string | null;
}

interface GitHubIssueTimelineEvent {
  id?: number | string | null;
  event: string;
  actor?: GitHubUser | null;
  created_at?: string | null;
  commit_id?: string | null;
  label?: { name?: string | null } | null;
  assignee?: { login?: string | null } | null;
  requested_reviewer?: { login?: string | null } | null;
  requested_team?: { name?: string | null } | null;
  milestone?: { title?: string | null } | null;
  rename?: { from?: string | null; to?: string | null } | null;
  source?: { issue?: GitHubIssueTimelineSourceIssue | null } | null;
}

interface GitHubClosingIssueReferenceNode {
  number: number;
  title: string | null;
  state: string;
  stateReason?: string | null;
  url: string | null;
  repository: { nameWithOwner: string } | null;
}

interface GitHubRequestedTeam {
  id: number | string;
  node_id?: string | null;
  name: string;
  slug: string;
  html_url?: string | null;
}

interface GitHubPullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | null;
  blob_url?: string | null;
  raw_url?: string | null;
}

interface GitHubPullRequestCommit {
  sha: string;
  commit: {
    message: string;
    author?: { date?: string | null } | null;
    committer?: { date?: string | null } | null;
  };
  author?: GitHubUser | null;
  html_url?: string | null;
}

interface GitHubPullRequestReview {
  id: number;
  user: GitHubUser | null;
  state: string;
  body?: string | null;
  submitted_at?: string | null;
  commit_id?: string | null;
  html_url?: string | null;
}

interface GitHubPullRequestReviewComment {
  id: number;
  pull_request_review_id?: number | null;
  user: GitHubUser | null;
  body?: string | null;
  path: string;
  diff_hunk?: string | null;
  position?: number | null;
  original_position?: number | null;
  start_line?: number | null;
  line?: number | null;
  side?: string | null;
  in_reply_to_id?: number | null;
  created_at: string;
  updated_at: string;
  html_url?: string | null;
}

interface GitHubPullRequestReviewThreadNode {
  id: string;
  isResolved: boolean | null;
  isOutdated: boolean | null;
  path: string;
  comments: {
    nodes: GitHubPullRequestReviewThreadCommentNode[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface GitHubPullRequestReviewThreadCommentNode {
  databaseId: number | null;
  replyTo?: { databaseId: number | null } | null;
}

interface GitHubCheckRun {
  id: number;
  name: string;
  status?: string | null;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string | null;
  details_url?: string | null;
  app?: { name?: string | null } | null;
  output?: { title?: string | null; summary?: string | null } | null;
}
