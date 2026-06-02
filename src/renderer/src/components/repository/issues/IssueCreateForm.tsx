import { Plus } from "lucide-react";
import type { ChangeEvent, FormEvent, JSX } from "react";

import type { AssignableUserSummary, LabelSummary, MilestoneSummary } from "@shared/github";

import { githubActionLabel } from "@renderer/components/repository/repositoryUi";

interface IssueCreateFormProps {
  title: string;
  body: string;
  labelEntry: string;
  assigneeEntry: string;
  milestoneNumber: string;
  disabledReason: string | null;
  submitDisabledReason: string | null;
  mutationActive: boolean;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  labels: LabelSummary[];
  labelsLoading: boolean;
  labelsError: Error | null;
  labelsAvailabilityMessage: string | null;
  hiddenLabelCount: number;
  showAllLabels: boolean;
  totalLabelCount: number;
  assignableUsers: AssignableUserSummary[];
  assignableUsersLoading: boolean;
  assignableUsersError: Error | null;
  assignableUsersAvailabilityMessage: string | null;
  hiddenAssignableUserCount: number;
  showAllAssignableUsers: boolean;
  totalAssignableUserCount: number;
  milestones: MilestoneSummary[];
  milestonesLoading: boolean;
  milestonesError: Error | null;
  milestonesAvailabilityMessage: string | null;
  hiddenMilestoneCount: number;
  showAllMilestones: boolean;
  totalMilestoneCount: number;
  onTitleChange(value: string): void;
  onBodyChange(value: string): void;
  onLabelEntryChange(value: string): void;
  onAssigneeEntryChange(value: string): void;
  onMilestoneNumberChange(value: string): void;
  onAddLabel(name: string): void;
  onAddAssignee(login: string): void;
  onShowAllLabels(): void;
  onShowAllAssignableUsers(): void;
  onShowAllMilestones(): void;
  onSubmit(): void;
  onCancel(): void;
}

function LabelSuggestionButton({
  label,
  disabledReason,
  onAddLabel
}: {
  label: LabelSummary;
  disabledReason: string | null;
  onAddLabel(name: string): void;
}): JSX.Element {
  function handleAddLabel(): void {
    onAddLabel(label.name);
  }

  return (
    <button
      type="button"
      disabled={Boolean(disabledReason)}
      title={label.description ?? `Add ${label.name}`}
      onClick={handleAddLabel}
    >
      <span style={{ backgroundColor: `#${label.color}` }} />
      {label.name}
    </button>
  );
}

function AssignableUserSuggestionButton({
  user,
  disabledReason,
  onAddAssignee
}: {
  user: AssignableUserSummary;
  disabledReason: string | null;
  onAddAssignee(login: string): void;
}): JSX.Element {
  function handleAddAssignee(): void {
    onAddAssignee(user.login);
  }

  return (
    <button
      type="button"
      disabled={Boolean(disabledReason)}
      title={`Assign ${user.login}`}
      onClick={handleAddAssignee}
    >
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
      {user.login}
    </button>
  );
}

export function IssueCreateForm({
  title,
  body,
  labelEntry,
  assigneeEntry,
  milestoneNumber,
  disabledReason,
  submitDisabledReason,
  mutationActive,
  mutationPending,
  mutationSucceeded,
  mutationError,
  labels,
  labelsLoading,
  labelsError,
  labelsAvailabilityMessage,
  hiddenLabelCount,
  showAllLabels,
  totalLabelCount,
  assignableUsers,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailabilityMessage,
  hiddenAssignableUserCount,
  showAllAssignableUsers,
  totalAssignableUserCount,
  milestones,
  milestonesLoading,
  milestonesError,
  milestonesAvailabilityMessage,
  hiddenMilestoneCount,
  showAllMilestones,
  totalMilestoneCount,
  onTitleChange,
  onBodyChange,
  onLabelEntryChange,
  onAssigneeEntryChange,
  onMilestoneNumberChange,
  onAddLabel,
  onAddAssignee,
  onShowAllLabels,
  onShowAllAssignableUsers,
  onShowAllMilestones,
  onSubmit,
  onCancel
}: IssueCreateFormProps): JSX.Element {
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

  function handleLabelEntryChange(event: ChangeEvent<HTMLInputElement>): void {
    onLabelEntryChange(event.target.value);
  }

  function handleAssigneeEntryChange(event: ChangeEvent<HTMLInputElement>): void {
    onAssigneeEntryChange(event.target.value);
  }

  function handleMilestoneChange(event: ChangeEvent<HTMLSelectElement>): void {
    onMilestoneNumberChange(event.target.value);
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      <h2>Open a new issue</h2>
      {mutationActive && mutationPending && (
        <div className="loading-state">
          {githubActionLabel("createIssue")} is running. The draft is locked until GitHub responds.
        </div>
      )}
      {mutationActive && !mutationPending && mutationSucceeded && (
        <div className="success-state">
          {githubActionLabel("createIssue")} completed. Issue data is refreshing.
        </div>
      )}
      {mutationActive && !mutationPending && mutationError && (
        <div className="error-state">
          {githubActionLabel("createIssue")} failed: {mutationError.message}
        </div>
      )}
      <input
        value={title}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onChange={handleTitleChange}
        placeholder="Issue title"
      />
      <textarea
        value={body}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onChange={handleBodyChange}
        placeholder="Describe the problem"
      />
      <label>
        Labels
        <input
          value={labelEntry}
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          onChange={handleLabelEntryChange}
          placeholder="Labels for this issue"
        />
      </label>
      <div className="metadata-picker-options" aria-label="Issue labels for new issue">
        {labelsLoading && <small>Loading labels…</small>}
        {labelsError && <small>Could not load labels.</small>}
        {!labelsError && labelsAvailabilityMessage && <small>{labelsAvailabilityMessage}</small>}
        {!labelsLoading &&
          !labelsError &&
          labels.map((label) => (
            <LabelSuggestionButton
              key={label.id}
              label={label}
              disabledReason={disabledReason}
              onAddLabel={onAddLabel}
            />
          ))}
      </div>
      {!labelsLoading && !labelsError && hiddenLabelCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onShowAllLabels}>
            Show all labels
          </button>
        </div>
      )}
      {!labelsLoading && !labelsError && showAllLabels && totalLabelCount > 10 && (
        <div className="muted-row">Showing all {totalLabelCount} labels.</div>
      )}
      <label>
        Assignees
        <input
          value={assigneeEntry}
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          onChange={handleAssigneeEntryChange}
          placeholder="Assignees for this issue"
        />
      </label>
      <div className="metadata-picker-options" aria-label="Assignees for new issue">
        {assignableUsersLoading && <small>Loading assignable users…</small>}
        {assignableUsersError && <small>Could not load assignable users.</small>}
        {!assignableUsersError && assignableUsersAvailabilityMessage && (
          <small>{assignableUsersAvailabilityMessage}</small>
        )}
        {!assignableUsersLoading &&
          !assignableUsersError &&
          assignableUsers.map((user) => (
            <AssignableUserSuggestionButton
              key={user.id}
              user={user}
              disabledReason={disabledReason}
              onAddAssignee={onAddAssignee}
            />
          ))}
      </div>
      {!assignableUsersLoading && !assignableUsersError && hiddenAssignableUserCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onShowAllAssignableUsers}>
            Show all assignable users
          </button>
        </div>
      )}
      {!assignableUsersLoading &&
        !assignableUsersError &&
        showAllAssignableUsers &&
        totalAssignableUserCount > 10 && (
          <div className="muted-row">Showing all {totalAssignableUserCount} assignable users.</div>
        )}
      <label>
        Milestone
        <select
          value={milestoneNumber}
          disabled={Boolean(disabledReason)}
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
      {!milestonesLoading && !milestonesError && showAllMilestones && totalMilestoneCount > 10 && (
        <div className="muted-row">Showing all {totalMilestoneCount} milestones.</div>
      )}
      <div>
        <button
          className="dark-action"
          type="submit"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason ?? undefined}
        >
          <Plus size={16} /> Create issue
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {submitDisabledReason && (
          <small className="action-disabled-note">Issue creation unavailable: {submitDisabledReason}</small>
        )}
      </div>
    </form>
  );
}
