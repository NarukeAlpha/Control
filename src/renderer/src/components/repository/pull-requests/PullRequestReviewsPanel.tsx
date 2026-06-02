import type { JSX } from "react";

import type { PullRequestReviewSummary } from "@shared/github";

import { formatRelativeDate } from "@renderer/utils/format";

export function PullRequestReviewsPanel({
  reviews,
  visibleReviews,
  reviewStatus,
  reviewsRequested,
  reviewsAvailabilityMessage,
  loading,
  expanded,
  reviewLimit,
  changedFilesRepositoryNameWithOwner,
  onRequestReviews,
  onToggleReviews,
  onOpenPullRequestReviewCommit,
  onOpenExternal
}: {
  reviews: PullRequestReviewSummary[];
  visibleReviews: PullRequestReviewSummary[];
  reviewStatus: string | number;
  reviewsRequested: boolean;
  reviewsAvailabilityMessage: string | null;
  loading: boolean;
  expanded: boolean;
  reviewLimit: number;
  changedFilesRepositoryNameWithOwner: string | null;
  onRequestReviews(): void;
  onToggleReviews(): void;
  onOpenPullRequestReviewCommit(
    review: PullRequestReviewSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <article>
      <header>
        <h3>Reviews</h3>
        <span>{reviewsRequested ? reviewStatus : "not loaded"}</span>
      </header>
      <div className="pr-inspection-list">
        {!reviewsRequested && (
          <button type="button" onClick={onRequestReviews}>
            <small>Load reviews</small>
          </button>
        )}
        {visibleReviews.map((review) => (
          <div className="pr-file-row" key={review.id}>
            <div>
              <strong>
                {review.state} by {review.authorLogin ?? "unknown"}
              </strong>
              <small>
                {review.submittedAt ? formatRelativeDate(review.submittedAt) : "not submitted"}
                {review.commitSha ? ` · ${review.commitSha.slice(0, 7)}` : ""}
                {review.body ? ` · ${review.body}` : ""}
              </small>
            </div>
            <button
              type="button"
              disabled={!review.commitSha}
              title={review.commitSha ? undefined : "Review commit SHA unavailable."}
              onClick={() => {
                if (review.commitSha) {
                  onOpenPullRequestReviewCommit(review, changedFilesRepositoryNameWithOwner);
                }
              }}
            >
              Open commit tree
            </button>
            <button
              type="button"
              disabled={!review.htmlUrl}
              title={review.htmlUrl ? undefined : "Review URL unavailable."}
              onClick={() => {
                if (review.htmlUrl) {
                  onOpenExternal(review.htmlUrl);
                }
              }}
            >
              GitHub fallback
            </button>
          </div>
        ))}
        {reviewsRequested && reviews.length > reviewLimit && (
          <button type="button" onClick={onToggleReviews}>
            <small>{expanded ? "Show fewer" : `Show all ${reviews.length} reviews`}</small>
          </button>
        )}
        {reviewsRequested && !loading && reviewsAvailabilityMessage && (
          <div className="error-state">{reviewsAvailabilityMessage}</div>
        )}
        {reviewsRequested && !loading && !reviewsAvailabilityMessage && reviews.length === 0 && (
          <div className="empty-state">No reviews returned.</div>
        )}
      </div>
    </article>
  );
}
