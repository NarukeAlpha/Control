import { X } from "lucide-react";
import type { FormEvent, JSX } from "react";

import type { AssignableUserSummary, PullRequestRequestedTeamSummary } from "@shared/github";

export function PullRequestReviewerControls({
  requestedReviewers,
  requestedTeams,
  reviewerSuggestions,
  reviewerEntry,
  teamReviewerEntry,
  selectedReviewDisabledReason,
  reviewerRequestSubmitDisabledReason,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailabilityMessage,
  hiddenPullReviewerCount,
  onRemoveReviewer,
  onRemoveTeamReviewer,
  onAddReviewerSuggestion,
  onShowAllReviewers,
  onReviewerEntryChange,
  onTeamReviewerEntryChange,
  onSubmitReviewerRequest
}: {
  requestedReviewers: AssignableUserSummary[];
  requestedTeams: PullRequestRequestedTeamSummary[];
  reviewerSuggestions: AssignableUserSummary[];
  reviewerEntry: string;
  teamReviewerEntry: string;
  selectedReviewDisabledReason: string | null;
  reviewerRequestSubmitDisabledReason: string | null;
  assignableUsersLoading: boolean;
  assignableUsersError: Error | null;
  assignableUsersAvailabilityMessage: string | null;
  hiddenPullReviewerCount: number;
  onRemoveReviewer(login: string): void;
  onRemoveTeamReviewer(slug: string): void;
  onAddReviewerSuggestion(login: string): void;
  onShowAllReviewers(): void;
  onReviewerEntryChange(value: string): void;
  onTeamReviewerEntryChange(value: string): void;
  onSubmitReviewerRequest(): void;
}): JSX.Element {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!reviewerRequestSubmitDisabledReason) {
      onSubmitReviewerRequest();
    }
  }

  return (
    <div className="issue-metadata-controls">
      {(requestedReviewers.length > 0 || requestedTeams.length > 0) && (
        <div className="metadata-picker-options" aria-label="Requested reviewers">
          {requestedReviewers.map((reviewer) => (
            <button
              key={reviewer.id}
              type="button"
              aria-label={`Remove reviewer ${reviewer.login}`}
              title={selectedReviewDisabledReason ?? `Remove reviewer ${reviewer.login}`}
              disabled={Boolean(selectedReviewDisabledReason)}
              onClick={() => onRemoveReviewer(reviewer.login)}
            >
              <X size={13} />
              {reviewer.login}
            </button>
          ))}
          {requestedTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              aria-label={`Remove team reviewer ${team.slug}`}
              title={selectedReviewDisabledReason ?? `Remove team reviewer ${team.slug}`}
              disabled={Boolean(selectedReviewDisabledReason)}
              onClick={() => onRemoveTeamReviewer(team.slug)}
            >
              <X size={13} />
              {team.name}
            </button>
          ))}
        </div>
      )}
      {assignableUsersLoading && (
        <small className="action-disabled-note">Loading reviewer suggestions…</small>
      )}
      {assignableUsersError && (
        <small className="action-disabled-note">
          Reviewer suggestions unavailable: {assignableUsersError.message}
        </small>
      )}
      {!assignableUsersError && assignableUsersAvailabilityMessage && (
        <small className="action-disabled-note">{assignableUsersAvailabilityMessage}</small>
      )}
      {reviewerSuggestions.length > 0 && (
        <div className="metadata-picker-options" aria-label="Reviewer suggestions">
          {reviewerSuggestions.map((user) => (
            <button
              key={user.id}
              type="button"
              disabled={Boolean(selectedReviewDisabledReason)}
              title={selectedReviewDisabledReason ?? `Add reviewer ${user.login}`}
              onClick={() => onAddReviewerSuggestion(user.login)}
            >
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
              {user.login}
            </button>
          ))}
        </div>
      )}
      {!assignableUsersLoading && !assignableUsersError && hiddenPullReviewerCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onShowAllReviewers}>
            Show all reviewers
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label>
          Reviewers
          <input
            value={reviewerEntry}
            onChange={(event) => onReviewerEntryChange(event.target.value)}
            placeholder="GitHub usernames"
            disabled={Boolean(selectedReviewDisabledReason)}
            title={selectedReviewDisabledReason ?? undefined}
          />
        </label>
        <label>
          Teams
          <input
            value={teamReviewerEntry}
            onChange={(event) => onTeamReviewerEntryChange(event.target.value)}
            placeholder="team slugs"
            disabled={Boolean(selectedReviewDisabledReason)}
            title={selectedReviewDisabledReason ?? undefined}
          />
        </label>
        <button
          type="submit"
          disabled={Boolean(reviewerRequestSubmitDisabledReason)}
          title={reviewerRequestSubmitDisabledReason ?? undefined}
        >
          Request review
        </button>
      </form>
      {reviewerRequestSubmitDisabledReason && (
        <small className="action-disabled-note">
          Reviewer requests unavailable: {reviewerRequestSubmitDisabledReason}
        </small>
      )}
    </div>
  );
}
