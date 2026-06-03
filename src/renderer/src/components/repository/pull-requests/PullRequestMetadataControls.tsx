import { X } from "lucide-react";
import type { FormEvent, JSX } from "react";

import type {
  AssignableUserSummary,
  LabelSummary,
  MilestoneSummary,
  PullRequestDetail,
  PullRequestSummary
} from "@shared/github";

export function PullRequestMetadataControls({
  selectedPull,
  detail,
  selectedLabels,
  selectedAssignees,
  visibleLabels,
  visibleMilestones,
  assigneeSuggestions,
  labelEntry,
  assigneeEntry,
  selectedMetadataDisabledReason,
  pullMetadataSubmitDisabledReason,
  labelsLoading,
  labelsError,
  labelsAvailabilityMessage,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailabilityMessage,
  milestonesLoading,
  milestonesError,
  milestonesAvailabilityMessage,
  hiddenPullLabelCount,
  hiddenPullAssigneeCount,
  hiddenPullMilestoneCount,
  onRemoveLabel,
  onRemoveAssignee,
  onAddLabelSuggestion,
  onAddAssigneeSuggestion,
  onShowAllLabels,
  onShowAllAssignees,
  onShowAllMilestones,
  onMilestoneChange,
  onLabelEntryChange,
  onAssigneeEntryChange,
  onSubmitMetadata
}: {
  selectedPull: PullRequestSummary;
  detail: PullRequestDetail | null;
  selectedLabels: LabelSummary[];
  selectedAssignees: AssignableUserSummary[];
  visibleLabels: LabelSummary[];
  visibleMilestones: MilestoneSummary[];
  assigneeSuggestions: AssignableUserSummary[];
  labelEntry: string;
  assigneeEntry: string;
  selectedMetadataDisabledReason: string | null;
  pullMetadataSubmitDisabledReason: string | null;
  labelsLoading: boolean;
  labelsError: Error | null;
  labelsAvailabilityMessage: string | null;
  assignableUsersLoading: boolean;
  assignableUsersError: Error | null;
  assignableUsersAvailabilityMessage: string | null;
  milestonesLoading: boolean;
  milestonesError: Error | null;
  milestonesAvailabilityMessage: string | null;
  hiddenPullLabelCount: number;
  hiddenPullAssigneeCount: number;
  hiddenPullMilestoneCount: number;
  onRemoveLabel(name: string): void;
  onRemoveAssignee(login: string): void;
  onAddLabelSuggestion(name: string): void;
  onAddAssigneeSuggestion(login: string): void;
  onShowAllLabels(): void;
  onShowAllAssignees(): void;
  onShowAllMilestones(): void;
  onMilestoneChange(milestone: number | null): void;
  onLabelEntryChange(value: string): void;
  onAssigneeEntryChange(value: string): void;
  onSubmitMetadata(): void;
}): JSX.Element {
  function handleMetadataSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!pullMetadataSubmitDisabledReason) {
      onSubmitMetadata();
    }
  }

  return (
    <div className="issue-metadata-controls">
      <strong>Pull request metadata</strong>
      {(selectedLabels.length > 0 || selectedAssignees.length > 0 || detail?.milestone) && (
        <div className="label-stack label-row">
          {selectedLabels.map((label) => (
            <button
              key={label.id}
              type="button"
              aria-label={`Remove label ${label.name}`}
              title={selectedMetadataDisabledReason ?? `Remove label ${label.name}`}
              disabled={Boolean(selectedMetadataDisabledReason)}
              onClick={() => onRemoveLabel(label.name)}
            >
              <X size={13} />
              {label.name}
            </button>
          ))}
          {selectedAssignees.map((assignee) => (
            <button
              key={assignee.id}
              type="button"
              aria-label={`Remove assignee ${assignee.login}`}
              title={selectedMetadataDisabledReason ?? `Remove assignee ${assignee.login}`}
              disabled={Boolean(selectedMetadataDisabledReason)}
              onClick={() => onRemoveAssignee(assignee.login)}
            >
              <X size={13} />
              {assignee.login}
            </button>
          ))}
          {detail?.milestone && <span>Milestone {detail.milestone.title}</span>}
        </div>
      )}
      <div className="metadata-picker-options" aria-label="Available pull request labels">
        {labelsLoading && <small>Loading labels…</small>}
        {labelsError && <small>Could not load labels.</small>}
        {!labelsError && labelsAvailabilityMessage && <small>{labelsAvailabilityMessage}</small>}
        {!labelsLoading &&
          !labelsError &&
          visibleLabels.map((label) => (
            <button
              key={label.id}
              type="button"
              disabled={Boolean(selectedMetadataDisabledReason)}
              title={selectedMetadataDisabledReason ?? label.description ?? `Add ${label.name}`}
              onClick={() => onAddLabelSuggestion(label.name)}
            >
              <span style={{ backgroundColor: `#${label.color}` }} />
              {label.name}
            </button>
          ))}
      </div>
      {!labelsLoading && !labelsError && hiddenPullLabelCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onShowAllLabels}>
            Show all labels
          </button>
        </div>
      )}
      <div className="metadata-picker-options" aria-label="Assignable pull request users">
        {assignableUsersLoading && <small>Loading assignees…</small>}
        {assignableUsersError && <small>Could not load assignees.</small>}
        {!assignableUsersError && assignableUsersAvailabilityMessage && (
          <small>{assignableUsersAvailabilityMessage}</small>
        )}
        {!assignableUsersLoading &&
          !assignableUsersError &&
          assigneeSuggestions.map((user) => (
            <button
              key={user.id}
              type="button"
              disabled={Boolean(selectedMetadataDisabledReason)}
              title={selectedMetadataDisabledReason ?? `Assign ${user.login}`}
              onClick={() => onAddAssigneeSuggestion(user.login)}
            >
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
              {user.login}
            </button>
          ))}
      </div>
      {!assignableUsersLoading && !assignableUsersError && hiddenPullAssigneeCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onShowAllAssignees}>
            Show all assignees
          </button>
        </div>
      )}
      <label>
        Milestone
        <select
          key={`pull-milestone-${selectedPull.number}-${detail?.milestone?.number ?? "none"}`}
          defaultValue={detail?.milestone?.number ?? ""}
          disabled={Boolean(selectedMetadataDisabledReason) || milestonesLoading}
          onChange={(event) =>
            onMilestoneChange(event.currentTarget.value ? Number(event.currentTarget.value) : null)
          }
        >
          <option value="">No milestone</option>
          {visibleMilestones.map((milestone) => (
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
      {!milestonesLoading && !milestonesError && hiddenPullMilestoneCount > 0 && (
        <div className="table-action-row">
          <button type="button" onClick={onShowAllMilestones}>
            Show all milestones
          </button>
        </div>
      )}
      <form onSubmit={handleMetadataSubmit}>
        <label>
          Labels
          <input
            value={labelEntry}
            onChange={(event) => onLabelEntryChange(event.target.value)}
            placeholder="Add labels"
            disabled={Boolean(selectedMetadataDisabledReason)}
            title={selectedMetadataDisabledReason ?? undefined}
          />
        </label>
        <label>
          Assignees
          <input
            value={assigneeEntry}
            onChange={(event) => onAssigneeEntryChange(event.target.value)}
            placeholder="Add assignees"
            disabled={Boolean(selectedMetadataDisabledReason)}
            title={selectedMetadataDisabledReason ?? undefined}
          />
        </label>
        <button
          type="submit"
          disabled={Boolean(pullMetadataSubmitDisabledReason)}
          title={pullMetadataSubmitDisabledReason ?? undefined}
        >
          Update metadata
        </button>
      </form>
      {pullMetadataSubmitDisabledReason && (
        <small className="action-disabled-note">{pullMetadataSubmitDisabledReason}</small>
      )}
    </div>
  );
}
