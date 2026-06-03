import type { ChangeEvent, JSX } from "react";

type IssueStateAction = "closeIssue" | "reopenIssue";
type IssueCloseReason = "completed" | "not_planned";

interface IssueActionFooterProps {
  issueAction: IssueStateAction;
  issueActionLabel: string;
  closeReason: IssueCloseReason;
  disabledReason: string | null;
  onStartEditing(): void;
  onRunIssueAction(): void;
  onCloseReasonChange(reason: IssueCloseReason): void;
}

export function IssueActionFooter({
  issueAction,
  issueActionLabel,
  closeReason,
  disabledReason,
  onStartEditing,
  onRunIssueAction,
  onCloseReasonChange
}: IssueActionFooterProps): JSX.Element {
  function handleCloseReasonChange(event: ChangeEvent<HTMLSelectElement>): void {
    onCloseReasonChange(event.target.value === "not_planned" ? "not_planned" : "completed");
  }

  return (
    <div className="thread-actions">
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={onStartEditing}
      >
        Edit issue
      </button>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={onRunIssueAction}
      >
        {issueActionLabel}
      </button>
      {issueAction === "closeIssue" && (
        <select
          aria-label="Issue close reason"
          disabled={Boolean(disabledReason)}
          value={closeReason}
          onChange={handleCloseReasonChange}
        >
          <option value="completed">Completed</option>
          <option value="not_planned">Not planned</option>
        </select>
      )}
      {disabledReason && <small className="action-disabled-note">{disabledReason}</small>}
    </div>
  );
}
