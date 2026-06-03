import { X } from "lucide-react";
import type { ChangeEvent, FormEvent, JSX } from "react";

import type { AssignableUserSummary, LabelSummary } from "@shared/github";

interface IssueMetadataControlsProps {
  selectedLabels: LabelSummary[];
  selectedAssignees: AssignableUserSummary[];
  visibleLabels: LabelSummary[];
  visibleAssignableUsers: AssignableUserSummary[];
  labelEntry: string;
  assigneeEntry: string;
  disabledReason: string | null;
  labelSubmitDisabledReason: string | null;
  assigneeSubmitDisabledReason: string | null;
  labelsLoading: boolean;
  labelsError: Error | null;
  labelsAvailabilityMessage: string | null;
  assignableUsersLoading: boolean;
  assignableUsersError: Error | null;
  assignableUsersAvailabilityMessage: string | null;
  hiddenLabelCount: number;
  hiddenAssignableUserCount: number;
  onRemoveLabel(name: string): void;
  onRemoveAssignee(login: string): void;
  onLabelEntryChange(value: string): void;
  onAssigneeEntryChange(value: string): void;
  onAddLabelSuggestion(name: string): void;
  onAddAssigneeSuggestion(login: string): void;
  onShowAllLabels(): void;
  onShowAllAssignableUsers(): void;
  onSubmitLabels(): void;
  onSubmitAssignees(): void;
}

function CurrentLabelButton({
  label,
  disabledReason,
  onRemoveLabel
}: {
  label: LabelSummary;
  disabledReason: string | null;
  onRemoveLabel(name: string): void;
}): JSX.Element {
  function handleRemoveLabel(): void {
    onRemoveLabel(label.name);
  }

  return (
    <button
      type="button"
      aria-label={`Remove label ${label.name}`}
      title={disabledReason ?? `Remove label ${label.name}`}
      disabled={Boolean(disabledReason)}
      onClick={handleRemoveLabel}
    >
      <X size={13} />
      {label.name}
    </button>
  );
}

function CurrentAssigneeButton({
  assignee,
  disabledReason,
  onRemoveAssignee
}: {
  assignee: AssignableUserSummary;
  disabledReason: string | null;
  onRemoveAssignee(login: string): void;
}): JSX.Element {
  function handleRemoveAssignee(): void {
    onRemoveAssignee(assignee.login);
  }

  return (
    <button
      type="button"
      aria-label={`Remove assignee ${assignee.login}`}
      title={disabledReason ?? `Remove assignee ${assignee.login}`}
      disabled={Boolean(disabledReason)}
      onClick={handleRemoveAssignee}
    >
      <X size={13} />
      {assignee.login}
    </button>
  );
}

function LabelSuggestionButton({
  label,
  disabledReason,
  onAddLabelSuggestion
}: {
  label: LabelSummary;
  disabledReason: string | null;
  onAddLabelSuggestion(name: string): void;
}): JSX.Element {
  function handleAddLabel(): void {
    onAddLabelSuggestion(label.name);
  }

  return (
    <button
      type="button"
      disabled={Boolean(disabledReason)}
      title={disabledReason ?? label.description ?? `Add ${label.name}`}
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
  onAddAssigneeSuggestion
}: {
  user: AssignableUserSummary;
  disabledReason: string | null;
  onAddAssigneeSuggestion(login: string): void;
}): JSX.Element {
  function handleAddAssignee(): void {
    onAddAssigneeSuggestion(user.login);
  }

  return (
    <button
      type="button"
      disabled={Boolean(disabledReason)}
      title={disabledReason ?? `Assign ${user.login}`}
      onClick={handleAddAssignee}
    >
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
      {user.login}
    </button>
  );
}

export function IssueMetadataControls({
  selectedLabels,
  selectedAssignees,
  visibleLabels,
  visibleAssignableUsers,
  labelEntry,
  assigneeEntry,
  disabledReason,
  labelSubmitDisabledReason,
  assigneeSubmitDisabledReason,
  labelsLoading,
  labelsError,
  labelsAvailabilityMessage,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailabilityMessage,
  hiddenLabelCount,
  hiddenAssignableUserCount,
  onRemoveLabel,
  onRemoveAssignee,
  onLabelEntryChange,
  onAssigneeEntryChange,
  onAddLabelSuggestion,
  onAddAssigneeSuggestion,
  onShowAllLabels,
  onShowAllAssignableUsers,
  onSubmitLabels,
  onSubmitAssignees
}: IssueMetadataControlsProps): JSX.Element {
  function handleLabelsSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmitLabels();
  }

  function handleAssigneesSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmitAssignees();
  }

  function handleLabelEntryChange(event: ChangeEvent<HTMLInputElement>): void {
    onLabelEntryChange(event.target.value);
  }

  function handleAssigneeEntryChange(event: ChangeEvent<HTMLInputElement>): void {
    onAssigneeEntryChange(event.target.value);
  }

  return (
    <div className="issue-metadata-controls">
      {selectedLabels.length > 0 && (
        <div className="metadata-picker-options" aria-label="Current labels">
          {selectedLabels.map((label) => (
            <CurrentLabelButton
              key={label.id}
              label={label}
              disabledReason={disabledReason}
              onRemoveLabel={onRemoveLabel}
            />
          ))}
        </div>
      )}
      {selectedAssignees.length > 0 && (
        <div className="metadata-picker-options" aria-label="Current assignees">
          {selectedAssignees.map((assignee) => (
            <CurrentAssigneeButton
              key={assignee.id}
              assignee={assignee}
              disabledReason={disabledReason}
              onRemoveAssignee={onRemoveAssignee}
            />
          ))}
        </div>
      )}
      <form onSubmit={handleLabelsSubmit}>
        <label>
          Labels
          <input
            value={labelEntry}
            onChange={handleLabelEntryChange}
            placeholder="Add labels"
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? undefined}
          />
        </label>
        <div className="metadata-picker-options" aria-label="Available labels">
          {labelsLoading && <small>Loading labels…</small>}
          {labelsError && <small>Could not load labels.</small>}
          {!labelsError && labelsAvailabilityMessage && <small>{labelsAvailabilityMessage}</small>}
          {!labelsLoading &&
            !labelsError &&
            visibleLabels.map((label) => (
              <LabelSuggestionButton
                key={label.id}
                label={label}
                disabledReason={disabledReason}
                onAddLabelSuggestion={onAddLabelSuggestion}
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
        <button
          type="submit"
          disabled={Boolean(labelSubmitDisabledReason)}
          title={labelSubmitDisabledReason ?? undefined}
        >
          Add labels
        </button>
        {labelSubmitDisabledReason && (
          <small className="action-disabled-note">{labelSubmitDisabledReason}</small>
        )}
      </form>
      <form onSubmit={handleAssigneesSubmit}>
        <label>
          Assignees
          <input
            value={assigneeEntry}
            onChange={handleAssigneeEntryChange}
            placeholder="Add assignees"
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? undefined}
          />
        </label>
        <div className="metadata-picker-options" aria-label="Assignable users">
          {assignableUsersLoading && <small>Loading assignable users…</small>}
          {assignableUsersError && <small>Could not load assignable users.</small>}
          {!assignableUsersError && assignableUsersAvailabilityMessage && (
            <small>{assignableUsersAvailabilityMessage}</small>
          )}
          {!assignableUsersLoading &&
            !assignableUsersError &&
            visibleAssignableUsers.map((user) => (
              <AssignableUserSuggestionButton
                key={user.id}
                user={user}
                disabledReason={disabledReason}
                onAddAssigneeSuggestion={onAddAssigneeSuggestion}
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
        <button
          type="submit"
          disabled={Boolean(assigneeSubmitDisabledReason)}
          title={assigneeSubmitDisabledReason ?? undefined}
        >
          Add assignees
        </button>
        {assigneeSubmitDisabledReason && (
          <small className="action-disabled-note">{assigneeSubmitDisabledReason}</small>
        )}
      </form>
    </div>
  );
}
