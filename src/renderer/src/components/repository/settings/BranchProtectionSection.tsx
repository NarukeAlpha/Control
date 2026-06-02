import type { FormEvent, JSX } from "react";

import type { BranchProtectionResult, GitHubAction, GitHubMutationFields } from "@shared/github";

import { branchProtectionMutationPayload, type BranchProtectionDraft } from "./useBranchProtectionDraft";

export function BranchProtectionSection({
  branch,
  branchProtection,
  loading,
  error,
  availabilityMessage,
  disabledReason,
  draft,
  onRequiresPullRequestReviewsChange,
  onRequiredApprovingReviewCountChange,
  onEnforceAdminsChange,
  onRequiredLinearHistoryChange,
  onRequiredConversationResolutionChange,
  onMutate
}: {
  branch: string | null;
  branchProtection: BranchProtectionResult | null;
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  disabledReason: string | null;
  draft: BranchProtectionDraft;
  onRequiresPullRequestReviewsChange(value: boolean): void;
  onRequiredApprovingReviewCountChange(value: string): void;
  onEnforceAdminsChange(value: boolean): void;
  onRequiredLinearHistoryChange(value: boolean): void;
  onRequiredConversationResolutionChange(value: boolean): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const disabled = Boolean(disabledReason);
  const exists = Boolean(branchProtection?.protection);
  const statusUnavailable = Boolean(error) || Boolean(availabilityMessage);
  const statusLabel =
    loading && !branchProtection
      ? "loading"
      : statusUnavailable
        ? "unavailable"
        : exists
          ? "protected"
          : "unprotected";

  function submitBranchProtection(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const payload = branchProtectionMutationPayload({ branch, branchProtection, draft });
    if (payload) {
      onMutate("updateBranchProtection", false, payload);
    }
  }

  function deleteBranchProtection(): void {
    if (disabled || !branch) {
      return;
    }
    onMutate("deleteBranchProtection", true, { branch });
  }

  return (
    <section className="repository-admin-section">
      <header>
        <div>
          <h3>Branch protection</h3>
          <small>{branch ?? "No branch selected"}</small>
        </div>
        <span className={`state-chip ${statusUnavailable ? "attention" : ""}`}>{statusLabel}</span>
      </header>
      {error && <div className="error-state">Branch protection unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      <form className="repository-admin-form" onSubmit={submitBranchProtection}>
        <label>
          Required approvals
          <input
            type="number"
            min="0"
            max="6"
            value={draft.requiredApprovingReviewCount}
            disabled={disabled || !draft.requiresPullRequestReviews}
            title={disabledReason ?? undefined}
            onChange={(event) => onRequiredApprovingReviewCountChange(event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.requiresPullRequestReviews}
            disabled={disabled}
            title={disabledReason ?? undefined}
            onChange={(event) => onRequiresPullRequestReviewsChange(event.target.checked)}
          />
          Require pull request reviews
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.enforceAdmins}
            disabled={disabled}
            title={disabledReason ?? undefined}
            onChange={(event) => onEnforceAdminsChange(event.target.checked)}
          />
          Enforce for admins
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.requiredLinearHistory}
            disabled={disabled}
            title={disabledReason ?? undefined}
            onChange={(event) => onRequiredLinearHistoryChange(event.target.checked)}
          />
          Require linear history
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.requiredConversationResolution}
            disabled={disabled}
            title={disabledReason ?? undefined}
            onChange={(event) => onRequiredConversationResolutionChange(event.target.checked)}
          />
          Require conversation resolution
        </label>
        <div className="repository-admin-actions">
          <button
            className="dark-action"
            type="submit"
            disabled={disabled}
            title={disabledReason ?? undefined}
          >
            {exists ? "Update branch protection" : "Create branch protection"}
          </button>
          <button
            type="button"
            disabled={disabled || !exists}
            title={
              !exists ? "This branch does not have protection to delete." : (disabledReason ?? undefined)
            }
            onClick={deleteBranchProtection}
          >
            Delete branch protection
          </button>
        </div>
        {disabledReason && <small className="action-disabled-note">{disabledReason}</small>}
      </form>
    </section>
  );
}
