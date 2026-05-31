import type {
  DiscussionCategoryListInput,
  DiscussionCategoryListResult,
  DiscussionCategorySummary,
  DiscussionDetail,
  DiscussionDetailInput,
  DiscussionDetailResult,
  DiscussionListInput,
  DiscussionListResult,
  DiscussionSummary,
  GitHubReadAvailability
} from "@shared/github";

export interface OctokitDiscussionClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
}

const githubGraphqlConnectionPageLimit = 100;
const defaultDiscussionDetailCommentsLimit = 100;
const defaultDiscussionDetailRepliesLimit = 20;
const maxDiscussionDetailCommentsLimit = 500;
const maxDiscussionDetailRepliesLimit = 500;

const discussionCommentNodeSelection = `
  id
  author { login avatarUrl }
  body
  createdAt
  updatedAt
  url
`;

export class OctokitDiscussionDomain {
  constructor(
    private readonly client: OctokitDiscussionClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    return this.fetchDiscussions(input);
  }

  async listDiscussionsWithStatus(input: DiscussionListInput): Promise<DiscussionListResult> {
    try {
      return {
        items: await this.fetchDiscussions(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listDiscussionCategoriesWithStatus(
    input: DiscussionCategoryListInput
  ): Promise<DiscussionCategoryListResult> {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);

    try {
      const data = await this.client.graphql<{
        repository: {
          discussionCategories: {
            nodes: DiscussionCategoryNode[];
          };
        };
      }>(
        `
        query RepositoryDiscussionCategories($owner: String!, $repo: String!, $limit: Int!) {
          repository(owner: $owner, name: $repo) {
            discussionCategories(first: $limit) {
              nodes {
                id
                name
                emoji
                description
                isAnswerable
              }
            }
          }
        }
      `,
        { owner: input.owner, repo: input.repo, limit }
      );

      return {
        items: data.repository.discussionCategories.nodes.map(mapDiscussionCategory),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async getDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetailResult> {
    try {
      return {
        item: await this.fetchDiscussionDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        item: null,
        availability: this.mapError(error)
      };
    }
  }

  private async fetchDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    const limit = input.limit ?? 30;
    const data = await this.client.graphql<{
      repository: {
        discussions: {
          nodes: GitHubDiscussionNode[];
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
              body
              createdAt
              updatedAt
              author { login avatarUrl }
              category { name }
              upvoteCount
              isAnswered
              closed
              locked
              answer {
                id
                author { login avatarUrl }
                body
                createdAt
                updatedAt
                url
              }
              comments(first: 20) {
                totalCount
                nodes {
                  id
                  author { login avatarUrl }
                  body
                  createdAt
                  updatedAt
                  url
                }
              }
            }
          }
        }
      }
    `,
      { owner: input.owner, repo: input.repo, limit }
    );

    return data.repository.discussions.nodes.map(mapDiscussionSummary);
  }

  private async fetchDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetail | null> {
    const commentsLimit = boundedGitHubGraphqlConnectionLimit(
      input.commentsLimit,
      defaultDiscussionDetailCommentsLimit,
      maxDiscussionDetailCommentsLimit
    );
    const repliesLimit = boundedGitHubGraphqlConnectionLimit(
      input.repliesLimit,
      defaultDiscussionDetailRepliesLimit,
      maxDiscussionDetailRepliesLimit
    );
    const allCommentNodes: GitHubDiscussionCommentNode[] = [];
    let discussionMeta: GitHubDiscussionNode | null = null;
    let totalComments = 0;
    let hasNextPage = true;
    let after: string | null = null;

    while (hasNextPage && allCommentNodes.length < commentsLimit) {
      const commentsPageSize = Math.min(
        githubGraphqlConnectionPageLimit,
        commentsLimit - allCommentNodes.length
      );
      const repliesPageSize = Math.min(githubGraphqlConnectionPageLimit, repliesLimit);
      type DiscussionDetailData = {
        repository: {
          discussion:
            | (GitHubDiscussionNode & {
                comments: GitHubDiscussionCommentConnection;
              })
            | null;
        };
      };
      const data: DiscussionDetailData = await this.client.graphql<DiscussionDetailData>(
        `
        query RepositoryDiscussionDetail(
          $owner: String!
          $repo: String!
          $number: Int!
          $commentsPageSize: Int!
          $commentsAfter: String
          $repliesPageSize: Int!
        ) {
          repository(owner: $owner, name: $repo) {
            discussion(number: $number) {
              id
              number
              title
              url
              body
              createdAt
              updatedAt
              author { login avatarUrl }
              category { name }
              upvoteCount
              isAnswered
              closed
              locked
              answer {
                ${discussionCommentNodeSelection}
              }
              comments(first: $commentsPageSize, after: $commentsAfter) {
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes {
                  ${discussionCommentNodeSelection}
                  replies(first: $repliesPageSize) {
                    totalCount
                    pageInfo { hasNextPage endCursor }
                    nodes {
                      ${discussionCommentNodeSelection}
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
          number: input.discussionNumber,
          commentsPageSize,
          commentsAfter: after,
          repliesPageSize
        }
      );

      const discussion = data.repository.discussion ?? undefined;
      if (!discussion) {
        return null;
      }

      discussionMeta ??= discussion;
      totalComments = discussion.comments.totalCount;
      allCommentNodes.push(...(discussion.comments.nodes ?? []));
      hasNextPage =
        allCommentNodes.length < commentsLimit && (discussion.comments.pageInfo?.hasNextPage ?? false);
      after = discussion.comments.pageInfo?.endCursor ?? null;
    }

    if (!discussionMeta) {
      return null;
    }

    const commentsList = await Promise.all(
      allCommentNodes.map(async (comment) => {
        const replyNodes = await this.fetchDiscussionCommentReplies(comment, repliesLimit);
        return {
          ...mapGraphqlDiscussionComment(comment),
          replies: replyNodes.map(mapGraphqlDiscussionComment),
          repliesTruncated: (comment.replies?.totalCount ?? replyNodes.length) > replyNodes.length
        };
      })
    );

    return {
      ...mapDiscussionSummary(discussionMeta),
      comments: totalComments,
      previewComments: commentsList,
      previewCommentsTruncated: totalComments > commentsList.length,
      commentsList,
      commentsTruncated: totalComments > commentsList.length
    };
  }

  private async fetchDiscussionCommentReplies(
    comment: GitHubDiscussionCommentNode,
    repliesLimit: number
  ): Promise<GitHubDiscussionCommentNode[]> {
    const initialReplies = comment.replies?.nodes ?? [];
    const totalReplies = comment.replies?.totalCount ?? initialReplies.length;
    const replies = initialReplies.slice(0, repliesLimit);
    let hasNextPage =
      replies.length < repliesLimit &&
      replies.length < totalReplies &&
      (comment.replies?.pageInfo?.hasNextPage ?? false);
    let after = comment.replies?.pageInfo?.endCursor ?? null;

    while (hasNextPage && after) {
      const repliesPageSize = Math.min(githubGraphqlConnectionPageLimit, repliesLimit - replies.length);
      const data = await this.client.graphql<{
        node: {
          replies: GitHubDiscussionCommentConnection;
        } | null;
      }>(
        `
        query DiscussionCommentReplies($commentId: ID!, $repliesPageSize: Int!, $after: String) {
          node(id: $commentId) {
            ... on DiscussionComment {
              replies(first: $repliesPageSize, after: $after) {
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes {
                  ${discussionCommentNodeSelection}
                }
              }
            }
          }
        }
        `,
        {
          commentId: comment.id,
          repliesPageSize,
          after
        }
      );
      const connection = data.node?.replies;
      const pageReplies = connection?.nodes ?? [];
      replies.push(...pageReplies);
      hasNextPage =
        replies.length < repliesLimit &&
        replies.length < (connection?.totalCount ?? totalReplies) &&
        (connection?.pageInfo?.hasNextPage ?? false);
      after = connection?.pageInfo?.endCursor ?? null;
    }

    return replies.slice(0, repliesLimit);
  }
}

function mapDiscussionSummary(discussion: GitHubDiscussionNode): DiscussionSummary {
  return {
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    authorLogin: discussion.author?.login ?? null,
    authorAvatarUrl: discussion.author?.avatarUrl ?? null,
    category: discussion.category?.name ?? null,
    body: discussion.body ?? null,
    createdAt: discussion.createdAt ?? discussion.updatedAt,
    comments: discussion.comments.totalCount,
    previewComments: (discussion.comments.nodes ?? []).map(mapGraphqlDiscussionComment),
    previewCommentsTruncated: discussion.comments.totalCount > (discussion.comments.nodes ?? []).length,
    answer: discussion.answer ? mapGraphqlDiscussionComment(discussion.answer) : null,
    isAnswered: discussion.isAnswered ?? null,
    upvotes: discussion.upvoteCount ?? 0,
    closed: discussion.closed ?? false,
    locked: discussion.locked ?? false,
    updatedAt: discussion.updatedAt,
    htmlUrl: discussion.url
  };
}

function mapGraphqlDiscussionComment(comment: GitHubDiscussionCommentNode) {
  return {
    id: comment.id,
    authorLogin: comment.author?.login ?? null,
    authorAvatarUrl: comment.author?.avatarUrl ?? null,
    body: comment.body ?? null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    htmlUrl: comment.url
  };
}

function boundedGitHubGraphqlConnectionLimit(
  value: number | undefined,
  fallback: number,
  max: number
): number {
  return Math.min(Math.max(value ?? fallback, 1), max);
}

function mapDiscussionCategory(category: DiscussionCategoryNode): DiscussionCategorySummary {
  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji ?? null,
    description: category.description ?? null,
    isAnswerable: category.isAnswerable ?? null
  };
}

interface DiscussionCategoryNode {
  id: string;
  name: string;
  emoji?: string | null;
  description?: string | null;
  isAnswerable?: boolean | null;
}

export interface GitHubDiscussionNode {
  id: string;
  number: number;
  title: string;
  url: string;
  body?: string | null;
  createdAt?: string;
  updatedAt: string;
  author: { login: string; avatarUrl?: string | null } | null;
  category: { name: string } | null;
  comments: {
    totalCount: number;
    nodes?: GitHubDiscussionCommentNode[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  };
  answer?: GitHubDiscussionCommentNode | null;
  isAnswered?: boolean | null;
  upvoteCount?: number;
  closed?: boolean;
  locked?: boolean;
}

export interface GitHubDiscussionCommentNode {
  id: string;
  author: { login: string; avatarUrl?: string | null } | null;
  body?: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
  replies?: GitHubDiscussionCommentConnection | null;
}

interface GitHubDiscussionCommentConnection {
  totalCount: number;
  nodes?: GitHubDiscussionCommentNode[];
  pageInfo?: { hasNextPage: boolean; endCursor: string | null };
}
