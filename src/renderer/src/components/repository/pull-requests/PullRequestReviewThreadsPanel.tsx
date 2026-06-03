import type { JSX } from "react";

import type { PullRequestReviewThreadCommentSummary, PullRequestReviewThreadSummary } from "@shared/github";

import type { MarkdownUrlContext } from "@renderer/components/MarkdownBody";
import { TimelineComment } from "@renderer/components/shared/TimelineComment";

type RichPullRequestReviewThreadSummary = PullRequestReviewThreadSummary & {
  diffHunk?: string | null;
  line?: number | null;
  startLine?: number | null;
  side?: string | null;
  startSide?: string | null;
};

function pullRequestReviewThreadDiffHunk(thread: RichPullRequestReviewThreadSummary): string | null {
  return thread.diffHunk ?? thread.comments.find((comment) => comment.diffHunk)?.diffHunk ?? null;
}

function pullRequestReviewThreadDiffPreview(diffHunk: string | null): string | null {
  if (!diffHunk) {
    return null;
  }

  const maxDiffHunkPreviewLines = 12;
  const lines = diffHunk.split(/\r?\n/);
  const previewLines = lines.slice(0, maxDiffHunkPreviewLines);

  if (lines.length > maxDiffHunkPreviewLines) {
    previewLines.push(`... ${lines.length - maxDiffHunkPreviewLines} more lines`);
  }

  return previewLines.join("\n");
}

function pullRequestReviewThreadLocationParts(thread: RichPullRequestReviewThreadSummary): {
  path: string;
  lineSummary: string | null;
  side: string | null;
  startSide: string | null;
} {
  const firstComment = thread.comments[0];
  const startLine = thread.startLine ?? firstComment?.startLine ?? null;
  const line = thread.line ?? firstComment?.line ?? null;
  const side = thread.side ?? firstComment?.side ?? null;
  const startSide = thread.startSide ?? null;
  const lineSummary =
    startLine && line && startLine !== line
      ? `${startLine}-${line}`
      : line
        ? `${line}`
        : startLine
          ? `${startLine}`
          : null;

  return { path: thread.path, lineSummary, side, startSide };
}

export function PullRequestReviewThreadsPanel({
  reviewThreads,
  visibleReviewThreads,
  reviewThreadsRequested,
  reviewThreadsAvailabilityMessage,
  reviewThreadStatesAvailabilityMessage,
  loading,
  expanded,
  reviewThreadLimit,
  changedFilesRef,
  changedFilesRepositoryNameWithOwner,
  markdownUrlContext,
  reviewCommentActions,
  onRequestReviewThreads,
  onToggleReviewThreads,
  onOpenExternal,
  onOpenCodePath
}: {
  reviewThreads: PullRequestReviewThreadSummary[];
  visibleReviewThreads: PullRequestReviewThreadSummary[];
  reviewThreadsRequested: boolean;
  reviewThreadsAvailabilityMessage: string | null;
  reviewThreadStatesAvailabilityMessage: string | null;
  loading: boolean;
  expanded: boolean;
  reviewThreadLimit: number;
  changedFilesRef: string | null;
  changedFilesRepositoryNameWithOwner: string | null;
  markdownUrlContext?: MarkdownUrlContext;
  reviewCommentActions?: {
    getDisabledReason(comment: PullRequestReviewThreadCommentSummary): string | null;
    onEdit(comment: PullRequestReviewThreadCommentSummary, body: string): void;
    onDelete(comment: PullRequestReviewThreadCommentSummary): void;
  };
  onRequestReviewThreads(): void;
  onToggleReviewThreads(): void;
  onOpenExternal(url: string): void;
  onOpenCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
}): JSX.Element {
  return (
    <article>
      <header>
        <h3>Review threads</h3>
        <span>{reviewThreadsRequested ? reviewThreads.length : "not loaded"}</span>
      </header>
      <div className="pr-inspection-list">
        {!reviewThreadsRequested && (
          <button type="button" onClick={onRequestReviewThreads}>
            <small>Load review threads</small>
          </button>
        )}
        {visibleReviewThreads.map((thread) => {
          const richThread = thread as RichPullRequestReviewThreadSummary;
          const firstComment = thread.comments[0];
          const lastComment = thread.comments[thread.comments.length - 1];
          const location = pullRequestReviewThreadLocationParts(richThread);
          const diffHunk = pullRequestReviewThreadDiffHunk(richThread);
          const diffPreview = pullRequestReviewThreadDiffPreview(diffHunk);
          const openLine =
            richThread.line ?? firstComment?.line ?? richThread.startLine ?? firstComment?.startLine ?? null;

          return (
            <div className="timeline-thread" key={thread.id}>
              <div className="pr-file-row">
                <div>
                  <strong>{location.path}</strong>
                  <small>
                    {thread.isResolved !== null && (
                      <>
                        <span className={`state-chip ${thread.isResolved ? "success" : "attention"}`}>
                          {thread.isResolved ? "resolved" : "unresolved"}
                        </span>{" "}
                      </>
                    )}
                    {thread.isOutdated !== null && (
                      <>
                        <span className={`state-chip ${thread.isOutdated ? "attention" : "success"}`}>
                          {thread.isOutdated ? "outdated" : "current"}
                        </span>{" "}
                      </>
                    )}
                    {location.lineSummary ? `line ${location.lineSummary}` : "line unknown"}
                    {location.side ? ` · ${location.side.toLowerCase()} side` : ""}
                    {location.startSide && location.startSide !== location.side
                      ? ` · starts on ${location.startSide.toLowerCase()} side`
                      : ""}{" "}
                    · {thread.comments.length} comments
                  </small>
                </div>
                <button
                  type="button"
                  disabled={!changedFilesRef}
                  title={changedFilesRef ? undefined : "File reference unavailable."}
                  onClick={() =>
                    onOpenCodePath(
                      thread.path,
                      changedFilesRef,
                      null,
                      openLine,
                      changedFilesRepositoryNameWithOwner
                    )
                  }
                >
                  Open file in Control
                </button>
                <button
                  type="button"
                  disabled={!lastComment?.htmlUrl}
                  title={lastComment?.htmlUrl ? undefined : "Review thread URL unavailable."}
                  onClick={() => {
                    if (lastComment?.htmlUrl) {
                      onOpenExternal(lastComment.htmlUrl);
                    }
                  }}
                >
                  GitHub fallback
                </button>
              </div>
              {diffPreview && (
                <pre className="markdown-code-block">
                  <code>{diffPreview}</code>
                </pre>
              )}
              {thread.comments.map((comment) => (
                <TimelineComment
                  key={comment.id}
                  authorLogin={comment.authorLogin}
                  authorAvatarUrl={comment.authorAvatarUrl}
                  createdAt={comment.createdAt}
                  body={comment.body?.trim() || "No comment body."}
                  disabledReason={reviewCommentActions?.getDisabledReason(comment) ?? null}
                  markdownUrlContext={markdownUrlContext}
                  onOpenExternal={onOpenExternal}
                  onEdit={
                    reviewCommentActions ? (body) => reviewCommentActions.onEdit(comment, body) : undefined
                  }
                  onDelete={reviewCommentActions ? () => reviewCommentActions.onDelete(comment) : undefined}
                />
              ))}
            </div>
          );
        })}
        {reviewThreadsRequested && reviewThreads.length > reviewThreadLimit && (
          <button type="button" onClick={onToggleReviewThreads}>
            <small>{expanded ? "Show fewer" : `Show all ${reviewThreads.length} review threads`}</small>
          </button>
        )}
        {reviewThreadsRequested && !loading && reviewThreadsAvailabilityMessage && (
          <div className="error-state">{reviewThreadsAvailabilityMessage}</div>
        )}
        {reviewThreadsRequested && !loading && reviewThreadStatesAvailabilityMessage && (
          <div className="error-state">{reviewThreadStatesAvailabilityMessage}</div>
        )}
        {reviewThreadsRequested &&
          !loading &&
          !reviewThreadsAvailabilityMessage &&
          reviewThreads.length === 0 && <div className="empty-state">No review threads returned.</div>}
      </div>
    </article>
  );
}
