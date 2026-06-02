import type { ChangeEvent, FormEvent, JSX } from "react";

import { githubActionLabel } from "@renderer/components/repository/repositoryUi";

interface IssueCommentComposerProps {
  commentBody: string;
  disabledReason: string | null;
  mutationActive: boolean;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onCommentBodyChange(value: string): void;
  onSubmit(): void;
}

export function IssueCommentComposer({
  commentBody,
  disabledReason,
  mutationActive,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onCommentBodyChange,
  onSubmit
}: IssueCommentComposerProps): JSX.Element {
  const emptyBodyReason = !commentBody.trim() ? "Comment body is required." : null;
  const submitDisabledReason = disabledReason ?? emptyBodyReason;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  function handleCommentBodyChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onCommentBodyChange(event.target.value);
  }

  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      {mutationActive && mutationPending && (
        <div className="loading-state">
          {githubActionLabel("addComment")} is running. The comment draft is locked until GitHub responds.
        </div>
      )}
      {mutationActive && !mutationPending && mutationSucceeded && (
        <div className="success-state">
          {githubActionLabel("addComment")} completed. Issue comments are refreshing.
        </div>
      )}
      {mutationActive && !mutationPending && mutationError && (
        <div className="error-state">
          {githubActionLabel("addComment")} failed: {mutationError.message}
        </div>
      )}
      <textarea
        value={commentBody}
        disabled={Boolean(disabledReason)}
        onChange={handleCommentBodyChange}
        placeholder="Leave a comment"
      />
      <button
        className="dark-action"
        type="submit"
        disabled={Boolean(submitDisabledReason)}
        title={submitDisabledReason ?? undefined}
      >
        Comment
      </button>
      {disabledReason && (
        <small className="action-disabled-note">Comment unavailable: {disabledReason}</small>
      )}
    </form>
  );
}
