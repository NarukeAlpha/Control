import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import {
  OctokitPullRequestDomain,
  type GitHubPullRequest,
  type OctokitPullRequestClient
} from "./pullRequestDomain";

describe("OctokitPullRequestDomain", () => {
  it("loads pull request lists through the pull-request domain", async () => {
    const restPaginatedArray = vi.fn(
      async (_route: string, _params: Record<string, unknown>, _limit: number) => [
        pullRequestFixture({ number: 17, title: "Extract provider domain" })
      ]
    );
    const domain = new OctokitPullRequestDomain(
      createClient({
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(
      domain.listPullRequests({ owner: "NarukeAlpha", repo: "control", state: "all", limit: 7 })
    ).resolves.toEqual([
      expect.objectContaining({
        number: 17,
        title: "Extract provider domain",
        headRefName: "feature/provider-domain",
        baseRefName: "main"
      })
    ]);
    expect(restPaginatedArray).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/pulls",
      { owner: "NarukeAlpha", repo: "control", state: "all" },
      7
    );
  });

  it("maps pull-request list failures into statusful results", async () => {
    const domain = new OctokitPullRequestDomain(
      createClient({
        restPaginatedArray: async () => {
          throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(
      domain.listPullRequestsWithStatus({ owner: "NarukeAlpha", repo: "control" })
    ).resolves.toEqual({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });

  it("keeps monolithic detail compatible while exposing partial subresource availability", async () => {
    const pullRequest = pullRequestFixture({ number: 17, headSha: null });
    const rest = vi.fn(async (route: string, _params?: Record<string, unknown>) => {
      if (route.includes("/pulls/{pull_number}")) {
        return pullRequest;
      }
      if (route.includes("/issues/{issue_number}")) {
        return issueFixture();
      }
      throw new Error(`Unexpected REST route ${route}`);
    });
    const restPaginatedArray = vi.fn(
      async (route: string, _params?: Record<string, unknown>, _limit?: number) => {
        if (route.includes("/issues/{issue_number}/comments")) {
          return [issueCommentFixture()];
        }
        if (route.includes("/files")) {
          throw new Error("Files unavailable");
        }
        if (route.includes("/commits")) {
          return [pullRequestCommitFixture()];
        }
        if (route.includes("/reviews")) {
          return [pullRequestReviewFixture()];
        }
        if (route.includes("/pulls/{pull_number}/comments")) {
          return [pullRequestReviewCommentFixture()];
        }
        if (route.includes("/timeline")) {
          return [timelineEventFixture()];
        }
        throw new Error(`Unexpected paginated REST route ${route}`);
      }
    );
    const graphql = vi.fn(
      async (query: string, _variables?: Parameters<OctokitPullRequestClient["graphql"]>[1]) => {
        if (query.includes("PullRequestReviewThreadStates")) {
          return {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      id: "thread-1",
                      path: "src/main.ts",
                      isResolved: true,
                      isOutdated: false,
                      comments: {
                        nodes: [{ databaseId: 1001, replyTo: null }],
                        pageInfo: { hasNextPage: false, endCursor: null }
                      }
                    }
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null }
                }
              }
            }
          };
        }
        if (query.includes("PullRequestLinkedIssues")) {
          return {
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      number: 42,
                      title: "Track provider split",
                      state: "OPEN",
                      stateReason: null,
                      url: "https://github.com/NarukeAlpha/control/issues/42",
                      repository: { nameWithOwner: "NarukeAlpha/control" }
                    }
                  ]
                }
              }
            }
          };
        }
        if (query.includes("PullRequestReviewDecision")) {
          return { repository: { pullRequest: { reviewDecision: "APPROVED" } } };
        }
        throw new Error("Unexpected GraphQL query");
      }
    );
    const domain = new OctokitPullRequestDomain(
      createClient({
        graphql: async <T>(query: string, variables?: Parameters<OctokitPullRequestClient["graphql"]>[1]) =>
          (await graphql(query, variables)) as T,
        rest: async <T>(route: string, params: Record<string, unknown>) => (await rest(route, params)) as T,
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(
      domain.getPullRequestDetail({ owner: "NarukeAlpha", repo: "control", pullNumber: 17 })
    ).resolves.toEqual(
      expect.objectContaining({
        number: 17,
        title: "Extract provider domain",
        body: "Pull body",
        labels: [expect.objectContaining({ name: "cleanup" })],
        assignees: [expect.objectContaining({ login: "maintainer" })],
        commentsList: [expect.objectContaining({ body: "Issue comment" })],
        files: [],
        filesAvailability: { status: "error", message: "Files unavailable" },
        commitsList: [expect.objectContaining({ sha: "commit-sha" })],
        reviews: [expect.objectContaining({ state: "APPROVED" })],
        latestReviewState: "APPROVED",
        reviewDecision: "APPROVED",
        checks: [],
        checksAvailability: {
          status: "feature_disabled",
          message: "Pull request head SHA is unavailable."
        },
        reviewThreads: [
          expect.objectContaining({
            id: 1001,
            path: "src/main.ts",
            isResolved: true
          })
        ],
        linkedIssues: [expect.objectContaining({ number: 42 })],
        timelineEvents: [expect.objectContaining({ event: "cross-referenced" })]
      })
    );
  });

  it("keeps the compatibility detail route equivalent to composed subresource routes", async () => {
    const domain = createCompleteDomain();
    const input = { owner: "NarukeAlpha", repo: "control", pullNumber: 17 };

    const detail = await domain.getPullRequestDetail(input);
    const [overview, comments, files, commits, reviews, checks, reviewThreads, timeline, linkedIssues] =
      await Promise.all([
        domain.getPullRequestOverviewWithStatus(input),
        domain.listPullRequestCommentsWithStatus(input),
        domain.listPullRequestFilesWithStatus(input),
        domain.listPullRequestCommitsWithStatus(input),
        domain.listPullRequestReviewsWithStatus(input),
        domain.listPullRequestChecksWithStatus(input),
        domain.listPullRequestReviewThreadsWithStatus(input),
        domain.listPullRequestTimelineWithStatus(input),
        domain.listPullRequestLinkedIssuesWithStatus(input)
      ]);

    expect(overview.overview).toEqual(
      expect.objectContaining({
        number: detail.number,
        title: detail.title,
        body: detail.body,
        labels: detail.labels,
        assignees: detail.assignees,
        milestone: detail.milestone,
        requestedReviewers: detail.requestedReviewers,
        requestedTeams: detail.requestedTeams,
        latestReviewState: detail.latestReviewState,
        reviewDecision: detail.reviewDecision
      })
    );
    expect(comments.items).toEqual(detail.commentsList);
    expect(files.items).toEqual(detail.files);
    expect(commits.items).toEqual(detail.commitsList);
    expect(reviews.items).toEqual(detail.reviews);
    expect(checks.items).toEqual(detail.checks);
    expect(reviewThreads.items).toEqual(detail.reviewThreads);
    expect(timeline.items).toEqual(detail.timelineEvents);
    expect(linkedIssues.items).toEqual(detail.linkedIssues);
  });
});

function createClient(overrides: Partial<OctokitPullRequestClient>): OctokitPullRequestClient {
  return {
    graphql: async () => {
      throw new Error("Unexpected GraphQL request");
    },
    rest: async () => {
      throw new Error("Unexpected REST request");
    },
    restPaginatedArray: async () => {
      throw new Error("Unexpected paginated REST request");
    },
    restPaginatedWrapped: async () => {
      throw new Error("Unexpected wrapped paginated REST request");
    },
    ...overrides
  };
}

function createCompleteDomain(): OctokitPullRequestDomain {
  return new OctokitPullRequestDomain(
    createClient({
      graphql: async <T>(query: string) => completeGraphql(query) as T,
      rest: async <T>(route: string) => completeRest(route) as T,
      restPaginatedArray: async <T>(route: string) => completeRestPaginatedArray(route) as T[],
      restPaginatedWrapped: async <T>() => [checkRunFixture()] as T[]
    }),
    mapTestError
  );
}

function completeRest(route: string): unknown {
  if (route.includes("/pulls/{pull_number}")) {
    return pullRequestFixture({ number: 17 });
  }
  if (route.includes("/issues/{issue_number}")) {
    return issueFixture();
  }
  throw new Error(`Unexpected REST route ${route}`);
}

function completeRestPaginatedArray(route: string): unknown[] {
  if (route.includes("/issues/{issue_number}/comments")) {
    return [issueCommentFixture()];
  }
  if (route.includes("/files")) {
    return [pullRequestFileFixture()];
  }
  if (route.includes("/commits")) {
    return [pullRequestCommitFixture()];
  }
  if (route.includes("/reviews")) {
    return [pullRequestReviewFixture()];
  }
  if (route.includes("/pulls/{pull_number}/comments")) {
    return [pullRequestReviewCommentFixture()];
  }
  if (route.includes("/timeline")) {
    return [timelineEventFixture()];
  }
  throw new Error(`Unexpected paginated REST route ${route}`);
}

function completeGraphql(query: string): unknown {
  if (query.includes("PullRequestReviewThreadStates")) {
    return {
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [reviewThreadStateFixture()],
            pageInfo: { hasNextPage: false, endCursor: null }
          }
        }
      }
    };
  }
  if (query.includes("PullRequestLinkedIssues")) {
    return {
      repository: {
        pullRequest: {
          closingIssuesReferences: {
            nodes: [linkedIssueFixture()]
          }
        }
      }
    };
  }
  if (query.includes("PullRequestReviewDecision")) {
    return { repository: { pullRequest: { reviewDecision: "APPROVED" } } };
  }
  throw new Error("Unexpected GraphQL query");
}

function mapTestError(error: unknown): GitHubReadAvailability {
  return {
    status:
      error && typeof error === "object" && (error as { status?: unknown }).status === 403
        ? "rate_limited"
        : "error",
    message: error instanceof Error ? error.message : "failed"
  };
}

function pullRequestFixture(input: {
  number: number;
  title?: string;
  headSha?: string | null;
}): GitHubPullRequest {
  return {
    id: input.number,
    node_id: `PR_${input.number}`,
    number: input.number,
    title: input.title ?? "Extract provider domain",
    state: "open",
    merged: false,
    merged_at: null,
    draft: false,
    locked: false,
    user: { login: "author", avatar_url: "https://avatars.test/author" },
    body: "Pull body",
    comments: 1,
    review_comments: 1,
    additions: 10,
    deletions: 2,
    changed_files: 1,
    mergeable_state: "clean",
    merge_commit_sha: null,
    maintainer_can_modify: true,
    head: {
      ref: "feature/provider-domain",
      sha: input.headSha === undefined ? "head-sha" : input.headSha,
      repo: { full_name: "NarukeAlpha/control" }
    },
    base: { ref: "main", repo: { full_name: "NarukeAlpha/control" } },
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-02T00:00:00Z",
    html_url: `https://github.com/NarukeAlpha/control/pull/${input.number}`,
    requested_reviewers: [{ id: 2, login: "reviewer", avatar_url: null, html_url: null }],
    requested_teams: [{ id: 3, name: "Core", slug: "core", html_url: null }]
  };
}

function issueFixture() {
  return {
    id: 17,
    node_id: "I_17",
    number: 17,
    title: "Extract provider domain",
    state: "open",
    state_reason: null,
    locked: false,
    user: { login: "author", avatar_url: "https://avatars.test/author" },
    body: "Pull body",
    comments: 1,
    labels: [{ id: 1, name: "cleanup", color: "0366d6", description: "Cleanup" }],
    assignees: [{ id: 2, login: "maintainer", avatar_url: null, html_url: null }],
    milestone: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-02T00:00:00Z",
    html_url: "https://github.com/NarukeAlpha/control/pull/17",
    pull_request: {}
  };
}

function issueCommentFixture() {
  return {
    id: 901,
    user: { login: "commenter", avatar_url: null },
    body: "Issue comment",
    created_at: "2026-05-03T00:00:00Z",
    updated_at: "2026-05-03T00:00:00Z",
    html_url: "https://github.com/NarukeAlpha/control/pull/17#issuecomment-901"
  };
}

function pullRequestCommitFixture() {
  return {
    sha: "commit-sha",
    commit: {
      message: "Implement provider domain\n\nBody",
      author: { date: "2026-05-03T00:00:00Z" },
      committer: { date: "2026-05-03T00:00:00Z" }
    },
    author: { login: "author", avatar_url: null },
    html_url: "https://github.com/NarukeAlpha/control/commit/commit-sha"
  };
}

function pullRequestFileFixture() {
  return {
    filename: "src/main.ts",
    status: "modified",
    additions: 10,
    deletions: 2,
    changes: 12,
    patch: "@@",
    blob_url: "https://github.com/NarukeAlpha/control/blob/head-sha/src/main.ts",
    raw_url: "https://raw.githubusercontent.com/NarukeAlpha/control/head-sha/src/main.ts"
  };
}

function pullRequestReviewFixture() {
  return {
    id: 701,
    user: { login: "reviewer", avatar_url: null },
    state: "APPROVED",
    body: "Looks good",
    submitted_at: "2026-05-04T00:00:00Z",
    commit_id: "commit-sha",
    html_url: "https://github.com/NarukeAlpha/control/pull/17#pullrequestreview-701"
  };
}

function reviewThreadStateFixture() {
  return {
    id: "thread-1",
    path: "src/main.ts",
    isResolved: true,
    isOutdated: false,
    comments: {
      nodes: [{ databaseId: 1001, replyTo: null }],
      pageInfo: { hasNextPage: false, endCursor: null }
    }
  };
}

function linkedIssueFixture() {
  return {
    number: 42,
    title: "Track provider split",
    state: "OPEN",
    stateReason: null,
    url: "https://github.com/NarukeAlpha/control/issues/42",
    repository: { nameWithOwner: "NarukeAlpha/control" }
  };
}

function checkRunFixture() {
  return {
    id: 601,
    name: "typecheck",
    status: "completed",
    conclusion: "success",
    started_at: "2026-05-05T00:00:00Z",
    completed_at: "2026-05-05T00:01:00Z",
    html_url: "https://github.com/NarukeAlpha/control/actions/runs/601",
    details_url: "https://github.com/NarukeAlpha/control/actions/runs/601",
    app: { name: "GitHub Actions" },
    output: { title: "Typecheck", summary: "Passed" }
  };
}

function pullRequestReviewCommentFixture() {
  return {
    id: 1001,
    pull_request_review_id: 701,
    user: { login: "reviewer", avatar_url: null },
    body: "Review comment",
    path: "src/main.ts",
    diff_hunk: "@@",
    position: 1,
    original_position: 1,
    start_line: null,
    line: 10,
    side: "RIGHT",
    in_reply_to_id: null,
    created_at: "2026-05-04T00:00:00Z",
    updated_at: "2026-05-04T00:00:00Z",
    html_url: "https://github.com/NarukeAlpha/control/pull/17#discussion_r1001"
  };
}

function timelineEventFixture() {
  return {
    id: 801,
    event: "cross-referenced",
    actor: { login: "author", avatar_url: null },
    created_at: "2026-05-05T00:00:00Z",
    source: {
      issue: {
        number: 42,
        title: "Track provider split",
        html_url: "https://github.com/NarukeAlpha/control/issues/42",
        repository_url: "https://api.github.com/repos/NarukeAlpha/control"
      }
    }
  };
}
