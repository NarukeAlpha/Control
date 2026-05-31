import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import {
  OctokitDiscussionDomain,
  type GitHubDiscussionCommentNode,
  type GitHubDiscussionNode,
  type OctokitDiscussionClient
} from "./discussionDomain";

describe("OctokitDiscussionDomain", () => {
  it("loads discussion lists through the discussion domain", async () => {
    const graphql = vi.fn(
      async (_query: string, _variables?: Record<string, string | number | boolean | null>) => ({
        repository: {
          discussions: {
            nodes: [discussionFixture()]
          }
        }
      })
    );
    const domain = new OctokitDiscussionDomain(
      createClient({
        graphql: async <T>(query: string, variables?: Record<string, string | number | boolean | null>) =>
          (await graphql(query, variables)) as T
      }),
      mapTestError
    );

    await expect(domain.listDiscussions({ owner: "apple", repo: "swift", limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        number: 42,
        title: "Release planning",
        comments: 2,
        previewComments: [expect.objectContaining({ id: "DC_1" })]
      })
    ]);
    expect(graphql).toHaveBeenCalledWith(expect.stringContaining("RepositoryDiscussions"), {
      owner: "apple",
      repo: "swift",
      limit: 10
    });
  });

  it("loads categories with bounded limits", async () => {
    const graphql = vi.fn(
      async (_query: string, _variables?: Record<string, string | number | boolean | null>) => ({
        repository: {
          discussionCategories: {
            nodes: [
              {
                id: "DIC_kw",
                name: "Announcements",
                emoji: ":mega:",
                description: "Release notes",
                isAnswerable: false
              }
            ]
          }
        }
      })
    );
    const domain = new OctokitDiscussionDomain(
      createClient({
        graphql: async <T>(query: string, variables?: Record<string, string | number | boolean | null>) =>
          (await graphql(query, variables)) as T
      }),
      mapTestError
    );

    await expect(
      domain.listDiscussionCategoriesWithStatus({ owner: "apple", repo: "swift", limit: 500 })
    ).resolves.toEqual({
      items: [
        {
          id: "DIC_kw",
          name: "Announcements",
          emoji: ":mega:",
          description: "Release notes",
          isAnswerable: false
        }
      ],
      availability: { status: "available", message: null }
    });
    expect(graphql).toHaveBeenCalledWith(expect.stringContaining("RepositoryDiscussionCategories"), {
      owner: "apple",
      repo: "swift",
      limit: 100
    });
  });

  it("loads discussion detail and fetches overflow reply pages", async () => {
    const graphql = vi.fn(
      async (query: string, _variables?: Record<string, string | number | boolean | null>) => {
        if (query.includes("RepositoryDiscussionDetail")) {
          return {
            repository: {
              discussion: discussionFixture({
                comments: {
                  totalCount: 1,
                  nodes: [
                    discussionCommentFixture({
                      id: "DC_1",
                      replies: {
                        totalCount: 2,
                        nodes: [discussionCommentFixture({ id: "DCR_1" })],
                        pageInfo: { hasNextPage: true, endCursor: "reply-cursor" }
                      }
                    })
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null }
                }
              })
            }
          };
        }
        if (query.includes("DiscussionCommentReplies")) {
          return {
            node: {
              replies: {
                totalCount: 2,
                nodes: [discussionCommentFixture({ id: "DCR_2" })],
                pageInfo: { hasNextPage: false, endCursor: null }
              }
            }
          };
        }
        throw new Error("Unexpected GraphQL query");
      }
    );
    const domain = new OctokitDiscussionDomain(
      createClient({
        graphql: async <T>(query: string, variables?: Record<string, string | number | boolean | null>) =>
          (await graphql(query, variables)) as T
      }),
      mapTestError
    );

    await expect(
      domain.getDiscussionDetail({
        owner: "apple",
        repo: "swift",
        discussionNumber: 42,
        commentsLimit: 10,
        repliesLimit: 10
      })
    ).resolves.toEqual({
      item: expect.objectContaining({
        number: 42,
        commentsList: [
          expect.objectContaining({
            id: "DC_1",
            replies: [expect.objectContaining({ id: "DCR_1" }), expect.objectContaining({ id: "DCR_2" })],
            repliesTruncated: false
          })
        ],
        commentsTruncated: false
      }),
      availability: { status: "available", message: null }
    });
    expect(graphql).toHaveBeenCalledWith(expect.stringContaining("DiscussionCommentReplies"), {
      commentId: "DC_1",
      repliesPageSize: 9,
      after: "reply-cursor"
    });
  });

  it("maps discussion failures into statusful results", async () => {
    const domain = new OctokitDiscussionDomain(
      createClient({
        graphql: async () => {
          throw Object.assign(new Error("Resource not accessible by integration"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(domain.listDiscussionsWithStatus({ owner: "apple", repo: "swift" })).resolves.toEqual({
      items: [],
      availability: { status: "permission_denied", message: "Resource not accessible by integration" }
    });
  });
});

function createClient(overrides: Partial<OctokitDiscussionClient>): OctokitDiscussionClient {
  return {
    graphql: async () => {
      throw new Error("Unexpected GraphQL request");
    },
    ...overrides
  };
}

function mapTestError(error: unknown): GitHubReadAvailability {
  return {
    status:
      error && typeof error === "object" && (error as { status?: unknown }).status === 403
        ? "permission_denied"
        : "error",
    message: error instanceof Error ? error.message : "failed"
  };
}

function discussionFixture(input: Partial<GitHubDiscussionNode> = {}): GitHubDiscussionNode {
  return {
    id: "D_42",
    number: 42,
    title: "Release planning",
    url: "https://github.com/apple/swift/discussions/42",
    body: "Plan the next release.",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
    author: { login: "swiftlang", avatarUrl: null },
    category: { name: "Announcements" },
    comments: {
      totalCount: 2,
      nodes: [discussionCommentFixture({ id: "DC_1" })]
    },
    answer: null,
    isAnswered: false,
    upvoteCount: 3,
    closed: false,
    locked: false,
    ...input
  };
}

function discussionCommentFixture(
  input: Partial<GitHubDiscussionCommentNode> = {}
): GitHubDiscussionCommentNode {
  return {
    id: "DC_1",
    author: { login: "swiftlang", avatarUrl: null },
    body: "Looks good.",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    url: "https://github.com/apple/swift/discussions/42#discussioncomment-1",
    ...input
  };
}
