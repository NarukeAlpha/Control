import type { FormEvent, JSX } from "react";

import type { GitHubAction } from "@shared/github";

import { githubActionLabel } from "@renderer/components/repository/repositoryUi";

interface PullRequestCommentComposerProps {
  commentBody: string;
  pullCommentMutationActive: boolean;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  pullCommentDisabledReason: string | null;
  onCommentBodyChange(value: string): void;
  onSubmitComment(): void;
}

export function PullRequestCommentComposer({
  commentBody,
  pullCommentMutationActive,
  mutationPending,
  mutationSucceeded,
  mutationError,
  pullCommentDisabledReason,
  onCommentBodyChange,
  onSubmitComment
}: PullRequestCommentComposerProps): JSX.Element {
  function handleCommentSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (commentBody.trim() && !pullCommentDisabledReason) {
      onSubmitComment();
    }
  }

  return (
    <form className="comment-composer" onSubmit={handleCommentSubmit}>
      {pullCommentMutationActive && mutationPending && (
        <div className="loading-state">
          {githubActionLabel("addComment")} is running. The comment draft is locked until GitHub responds.
        </div>
      )}
      {pullCommentMutationActive && !mutationPending && mutationSucceeded && (
        <div className="success-state">
          {githubActionLabel("addComment")} completed. Pull request comments are refreshing.
        </div>
      )}
      {pullCommentMutationActive && !mutationPending && mutationError && (
        <div className="error-state">
          {githubActionLabel("addComment")} failed: {mutationError.message}
        </div>
      )}
      <textarea
        value={commentBody}
        disabled={Boolean(pullCommentDisabledReason)}
        onChange={(event) => onCommentBodyChange(event.target.value)}
        placeholder="Leave a comment"
      />
      <button
        className="dark-action"
        type="submit"
        disabled={!commentBody.trim() || Boolean(pullCommentDisabledReason)}
        title={pullCommentDisabledReason ?? (!commentBody.trim() ? "Comment body is required." : undefined)}
      >
        Comment
      </button>
      {pullCommentDisabledReason && (
        <small className="action-disabled-note">Comment unavailable: {pullCommentDisabledReason}</small>
      )}
    </form>
  );
}

export function PullRequestReviewActions({
  reviewBody,
  pullReviewMutationActive,
  submittedPullAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  selectedReviewDisabledReason,
  reviewCommentDisabledReason,
  onReviewBodyChange,
  onSubmitReview
}: {
  reviewBody: string;
  pullReviewMutationActive: boolean;
  submittedPullAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  selectedReviewDisabledReason: string | null;
  reviewCommentDisabledReason: string | null;
  onReviewBodyChange(value: string): void;
  onSubmitReview(action: GitHubAction, dangerous: boolean): void;
}): JSX.Element {
  return (
    <div className="comment-composer">
      {pullReviewMutationActive && mutationPending && submittedPullAction && (
        <div className="loading-state">
          {githubActionLabel(submittedPullAction)} is running. The review note is locked until GitHub
          responds.
        </div>
      )}
      {pullReviewMutationActive && !mutationPending && mutationSucceeded && submittedPullAction && (
        <div className="success-state">
          {githubActionLabel(submittedPullAction)} completed. Pull request reviews are refreshing.
        </div>
      )}
      {pullReviewMutationActive && !mutationPending && mutationError && submittedPullAction && (
        <div className="error-state">
          {githubActionLabel(submittedPullAction)} failed: {mutationError.message}
        </div>
      )}
      <textarea
        value={reviewBody}
        disabled={Boolean(selectedReviewDisabledReason)}
        title={selectedReviewDisabledReason ?? undefined}
        onChange={(event) => onReviewBodyChange(event.target.value)}
        placeholder="Review note"
      />
      <div>
        <button
          type="button"
          disabled={Boolean(selectedReviewDisabledReason)}
          title={selectedReviewDisabledReason ?? undefined}
          onClick={() => onSubmitReview("approvePullRequest", false)}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={Boolean(reviewCommentDisabledReason)}
          title={reviewCommentDisabledReason ?? undefined}
          onClick={() => onSubmitReview("commentPullRequestReview", false)}
        >
          Comment review
        </button>
        <button
          type="button"
          disabled={Boolean(selectedReviewDisabledReason)}
          title={selectedReviewDisabledReason ?? undefined}
          onClick={() => onSubmitReview("requestChanges", true)}
        >
          Request changes
        </button>
      </div>
      {(selectedReviewDisabledReason || reviewCommentDisabledReason) && (
        <small className="action-disabled-note">
          Review unavailable: {selectedReviewDisabledReason ?? reviewCommentDisabledReason}
        </small>
      )}
    </div>
  );
}

export function PullRequestMergeActions({
  pullActionLabel,
  pullActionDisabledReason,
  selectedMergeDisabledReason,
  onRunPullAction,
  onMerge
}: {
  pullActionLabel: string;
  pullActionDisabledReason: string | null;
  selectedMergeDisabledReason: string | null;
  onRunPullAction(): void;
  onMerge(): void;
}): JSX.Element {
  const mergeUnavailable = Boolean(selectedMergeDisabledReason);

  return (
    <section
      className={`pr-timeline-merge-box${mergeUnavailable ? " blocked" : " ready"}`}
      aria-label="Pull request merge actions"
    >
      <div className="pr-timeline-merge-marker" aria-hidden="true" />
      <div className="pr-timeline-merge-content">
        <strong>
          {mergeUnavailable ? "Pull request cannot be merged" : "Pull request is ready to merge"}
        </strong>
        <p>
          {selectedMergeDisabledReason
            ? `Merge unavailable: ${selectedMergeDisabledReason}`
            : "All visible requirements are satisfied. Merge this pull request or close it without merging."}
        </p>
      </div>
      <div className="pr-timeline-merge-actions">
        <button
          type="button"
          disabled={Boolean(pullActionDisabledReason)}
          title={pullActionDisabledReason ?? undefined}
          onClick={onRunPullAction}
        >
          {pullActionLabel}
        </button>
        <button
          className="dark-action"
          type="button"
          disabled={mergeUnavailable}
          title={selectedMergeDisabledReason ?? undefined}
          onClick={onMerge}
        >
          Merge pull request
        </button>
      </div>
    </section>
  );
}

export function PullRequestConversationActions({
  commentBody,
  reviewBody,
  pullActionLabel,
  pullCommentMutationActive,
  pullReviewMutationActive,
  submittedPullAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  pullCommentDisabledReason,
  selectedReviewDisabledReason,
  reviewCommentDisabledReason,
  pullActionDisabledReason,
  selectedMergeDisabledReason,
  onCommentBodyChange,
  onReviewBodyChange,
  onSubmitComment,
  onSubmitReview,
  onRunPullAction,
  onMerge
}: {
  commentBody: string;
  reviewBody: string;
  pullActionLabel: string;
  pullCommentMutationActive: boolean;
  pullReviewMutationActive: boolean;
  submittedPullAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  pullCommentDisabledReason: string | null;
  selectedReviewDisabledReason: string | null;
  reviewCommentDisabledReason: string | null;
  pullActionDisabledReason: string | null;
  selectedMergeDisabledReason: string | null;
  onCommentBodyChange(value: string): void;
  onReviewBodyChange(value: string): void;
  onSubmitComment(): void;
  onSubmitReview(action: GitHubAction, dangerous: boolean): void;
  onRunPullAction(): void;
  onMerge(): void;
}): JSX.Element {
  return (
    <>
      <PullRequestCommentComposer
        commentBody={commentBody}
        pullCommentMutationActive={pullCommentMutationActive}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        mutationError={mutationError}
        pullCommentDisabledReason={pullCommentDisabledReason}
        onCommentBodyChange={onCommentBodyChange}
        onSubmitComment={onSubmitComment}
      />
      <PullRequestReviewActions
        reviewBody={reviewBody}
        pullReviewMutationActive={pullReviewMutationActive}
        submittedPullAction={submittedPullAction}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        mutationError={mutationError}
        selectedReviewDisabledReason={selectedReviewDisabledReason}
        reviewCommentDisabledReason={reviewCommentDisabledReason}
        onReviewBodyChange={onReviewBodyChange}
        onSubmitReview={onSubmitReview}
      />
      <PullRequestMergeActions
        pullActionLabel={pullActionLabel}
        pullActionDisabledReason={pullActionDisabledReason}
        selectedMergeDisabledReason={selectedMergeDisabledReason}
        onRunPullAction={onRunPullAction}
        onMerge={onMerge}
      />
    </>
  );
}
