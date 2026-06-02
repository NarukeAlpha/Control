import type { JSX } from "react";

import type { PullRequestDetail, PullRequestSummary, TimelineCommentSummary } from "@shared/github";

import type { MarkdownUrlContext } from "@renderer/components/MarkdownBody";
import { readAvailabilityMessage } from "@renderer/components/repository/repositoryUi";
import { TimelineThread } from "@renderer/components/shared/TimelineThread";

export function PullRequestDiscussion({
  selectedPull,
  detail,
  loading,
  commentsRequested,
  markdownUrlContext,
  onRequestComments,
  onOpenExternal,
  commentActions
}: {
  selectedPull: PullRequestSummary;
  detail: PullRequestDetail | null;
  loading: boolean;
  commentsRequested: boolean;
  markdownUrlContext: MarkdownUrlContext;
  onRequestComments(): void;
  onOpenExternal(url: string): void;
  commentActions: {
    getDisabledReason(comment: TimelineCommentSummary): string | null;
    onEdit(comment: TimelineCommentSummary, body: string): void;
    onDelete(comment: TimelineCommentSummary): void;
  };
}): JSX.Element {
  const commentCount = detail?.comments ?? 0;

  return (
    <>
      {!commentsRequested && (
        <div className="table-action-row">
          <button type="button" onClick={onRequestComments}>
            Load discussion
          </button>
        </div>
      )}
      <TimelineThread
        title={`Pull request ${selectedPull.number} discussion`}
        authorLogin={detail?.authorLogin ?? selectedPull.authorLogin}
        authorAvatarUrl={detail?.authorAvatarUrl ?? selectedPull.authorAvatarUrl}
        createdAt={detail?.createdAt ?? selectedPull.createdAt}
        body={detail?.body}
        comments={commentsRequested ? (detail?.commentsList ?? []) : []}
        loading={commentsRequested && loading}
        availabilityMessage={
          commentsRequested
            ? readAvailabilityMessage("Pull request comments", detail?.commentsAvailability ?? null)
            : null
        }
        emptyBody="No pull request description provided."
        markdownUrlContext={markdownUrlContext}
        onOpenExternal={onOpenExternal}
        commentActions={commentActions}
      />
      {!commentsRequested && commentCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onRequestComments}>
            Load {commentCount} comments
          </button>
        </div>
      )}
    </>
  );
}
