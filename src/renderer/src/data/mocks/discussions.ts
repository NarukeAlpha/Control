import type { DiscussionCategorySummary, DiscussionDetailResult, DiscussionSummary } from "@shared/github";

export const mockDiscussions: DiscussionSummary[] = Array.from({ length: 8 }, (_, index) => ({
  id: `D_${index}`,
  number: 200 + index,
  title: index % 2 === 0 ? "Swift 6 concurrency migration notes" : "Package manager ergonomics",
  authorLogin: index % 2 === 0 ? "swiftlang" : "community",
  authorAvatarUrl: null,
  category: index % 2 === 0 ? "Announcements" : "Q&A",
  body:
    index % 2 === 0
      ? "Tracking the migration notes and follow-up work for packages adopting Swift 6 concurrency."
      : "Collecting feedback on the package manager workflows that still take too many steps.",
  createdAt: new Date(Date.now() - index * 7_200_000).toISOString(),
  comments: 10 + index * 2,
  previewComments: [
    {
      id: `DC_${index}_1`,
      authorLogin: "maintainer",
      authorAvatarUrl: null,
      body: "This is now captured in the planning thread. Keep adding concrete migration examples here.",
      createdAt: new Date(Date.now() - index * 5_000_000).toISOString(),
      updatedAt: new Date(Date.now() - index * 5_000_000).toISOString(),
      htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}#discussioncomment-${index}1`
    },
    {
      id: `DC_${index}_2`,
      authorLogin: "contributor",
      authorAvatarUrl: null,
      body: "The latest nightly helped here, but the diagnostics still point at the wrong package target.",
      createdAt: new Date(Date.now() - index * 4_200_000).toISOString(),
      updatedAt: new Date(Date.now() - index * 4_200_000).toISOString(),
      htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}#discussioncomment-${index}2`
    }
  ],
  previewCommentsTruncated: true,
  answer:
    index % 2 === 1
      ? {
          id: `DCA_${index}`,
          authorLogin: "swiftlang",
          authorAvatarUrl: null,
          body: "Use the new package manifest setting and clear the derived data cache after upgrading.",
          createdAt: new Date(Date.now() - index * 4_000_000).toISOString(),
          updatedAt: new Date(Date.now() - index * 4_000_000).toISOString(),
          htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}#discussioncomment-answer-${index}`
        }
      : null,
  isAnswered: index % 2 === 1,
  upvotes: 14 + index,
  closed: false,
  locked: index === 3,
  updatedAt: new Date(Date.now() - index * 5_400_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}`
}));

export const mockDiscussionCategories: DiscussionCategorySummary[] = [
  {
    id: "DIC_announcements",
    name: "Announcements",
    emoji: ":mega:",
    description: "Project announcements and release notes",
    isAnswerable: false
  },
  {
    id: "DIC_qna",
    name: "Q&A",
    emoji: ":question:",
    description: "Questions that can have an accepted answer",
    isAnswerable: true
  }
];

export function mockDiscussionDetail(input: { discussionNumber: number }): DiscussionDetailResult {
  const discussion = mockDiscussions.find((item) => item.number === input.discussionNumber) ?? null;

  return {
    item: discussion
      ? {
          ...discussion,
          commentsList: discussion.previewComments.map((comment) => ({
            ...comment,
            replies: [],
            repliesTruncated: false
          })),
          commentsTruncated: discussion.previewCommentsTruncated
        }
      : null,
    availability: { status: "available", message: null }
  };
}
