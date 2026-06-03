import type { ChangeEvent, FormEvent, JSX } from "react";

import type { MilestoneSummary } from "@shared/github";

import { githubActionLabel } from "@renderer/components/repository/repositoryUi";

interface IssueEditFormProps {
  title: string;
  body: string;
  milestoneNumber: string;
  disabledReason: string | null;
  submitDisabledReason: string | null;
  mutationActive: boolean;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  milestones: MilestoneSummary[];
  milestonesLoading: boolean;
  milestonesError: Error | null;
  milestonesAvailabilityMessage: string | null;
  hiddenMilestoneCount: number;
  onTitleChange(value: string): void;
  onBodyChange(value: string): void;
  onMilestoneNumberChange(value: string): void;
  onShowAllMilestones(): void;
  onSubmit(): void;
  onCancel(): void;
}

export function IssueEditForm({
  title,
  body,
  milestoneNumber,
  disabledReason,
  submitDisabledReason,
  mutationActive,
  mutationPending,
  mutationSucceeded,
  mutationError,
  milestones,
  milestonesLoading,
  milestonesError,
  milestonesAvailabilityMessage,
  hiddenMilestoneCount,
  onTitleChange,
  onBodyChange,
  onMilestoneNumberChange,
  onShowAllMilestones,
  onSubmit,
  onCancel
}: IssueEditFormProps): JSX.Element {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>): void {
    onTitleChange(event.target.value);
  }

  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onBodyChange(event.target.value);
  }

  function handleMilestoneChange(event: ChangeEvent<HTMLSelectElement>): void {
    onMilestoneNumberChange(event.target.value);
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      {mutationActive && mutationPending && (
        <div className="loading-state">
          {githubActionLabel("editIssue")} is running. The edit is locked until GitHub responds.
        </div>
      )}
      {mutationActive && !mutationPending && mutationSucceeded && (
        <div className="success-state">
          {githubActionLabel("editIssue")} completed. Issue data is refreshing.
        </div>
      )}
      {mutationActive && !mutationPending && mutationError && (
        <div className="error-state">
          {githubActionLabel("editIssue")} failed: {mutationError.message}
        </div>
      )}
      <input
        value={title}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onChange={handleTitleChange}
        placeholder="Edit issue title"
      />
      <textarea
        value={body}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onChange={handleBodyChange}
        placeholder="Edit issue body"
      />
      <label>
        Milestone
        <select
          value={milestoneNumber}
          disabled={Boolean(disabledReason) || milestonesLoading}
          title={disabledReason ?? undefined}
          onChange={handleMilestoneChange}
        >
          <option value="">No milestone</option>
          {milestones.map((milestone) => (
            <option key={milestone.id} value={milestone.number}>
              {milestone.title}
            </option>
          ))}
        </select>
      </label>
      {milestonesLoading && <small className="action-disabled-note">Loading milestones…</small>}
      {milestonesError && (
        <small className="action-disabled-note">Could not load milestones: {milestonesError.message}</small>
      )}
      {!milestonesError && milestonesAvailabilityMessage && (
        <small className="action-disabled-note">{milestonesAvailabilityMessage}</small>
      )}
      {!milestonesLoading && !milestonesError && hiddenMilestoneCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onShowAllMilestones}>
            Show all milestones
          </button>
        </div>
      )}
      <div>
        <button
          className="dark-action"
          type="submit"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason ?? undefined}
        >
          Save issue
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {submitDisabledReason && <small className="action-disabled-note">{submitDisabledReason}</small>}
      </div>
    </form>
  );
}
