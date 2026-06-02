import type { JSX } from "react";

import type { TimelineCommentSummary } from "@shared/github";

import type { MarkdownUrlContext } from "@renderer/components/MarkdownBody";
import { TimelineComment } from "@renderer/components/shared/TimelineComment";

interface TimelineThreadCommentActions {
  getDisabledReason(comment: TimelineCommentSummary): string | null;
  onEdit(comment: TimelineCommentSummary, body: string): void;
  onDelete(comment: TimelineCommentSummary): void;
}

export interface TimelineThreadProps {
  title: string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  body: string | null | undefined;
  comments: TimelineCommentSummary[];
  loading: boolean;
  availabilityMessage: string | null;
  emptyBody: string;
  markdownUrlContext?: MarkdownUrlContext;
  onOpenExternal(url: string): void;
  commentActions?: TimelineThreadCommentActions;
}

export function TimelineThread({
  title,
  authorLogin,
  authorAvatarUrl,
  createdAt,
  body,
  comments,
  loading,
  availabilityMessage,
  emptyBody,
  markdownUrlContext,
  onOpenExternal,
  commentActions
}: TimelineThreadProps): JSX.Element {
  return (
    <div className="timeline-thread" aria-label={title}>
      <TimelineComment
        authorLogin={authorLogin}
        authorAvatarUrl={authorAvatarUrl}
        createdAt={createdAt}
        body={body?.trim() || emptyBody}
        markdownUrlContext={markdownUrlContext}
        onOpenExternal={onOpenExternal}
      />
      {loading ? (
        <div className="loading-state">Loading discussion…</div>
      ) : availabilityMessage ? (
        <div className="error-state">{availabilityMessage}</div>
      ) : (
        comments.map((comment) => (
          <TimelineComment
            key={comment.id}
            authorLogin={comment.authorLogin}
            authorAvatarUrl={comment.authorAvatarUrl}
            createdAt={comment.createdAt}
            body={comment.body?.trim() || "No comment body."}
            disabledReason={commentActions?.getDisabledReason(comment) ?? null}
            markdownUrlContext={markdownUrlContext}
            onOpenExternal={onOpenExternal}
            onEdit={commentActions ? (nextBody) => commentActions.onEdit(comment, nextBody) : undefined}
            onDelete={commentActions ? () => commentActions.onDelete(comment) : undefined}
          />
        ))
      )}
    </div>
  );
}
