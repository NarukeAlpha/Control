import type { JSX } from "react";

import type { BranchProtectionSummary, PullRequestSummary } from "@shared/github";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";

function formatPullRequestReviewDecision(value: string | null | undefined): string {
  switch (value) {
    case "APPROVED":
      return "Approved";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "REVIEW_REQUIRED":
      return "Review required";
    default:
      return "Review unknown";
  }
}

function pullRequestReviewDecisionTone(value: string | null | undefined): string {
  if (value === "APPROVED") {
    return "success";
  }
  if (value === "CHANGES_REQUESTED" || value === "REVIEW_REQUIRED") {
    return "attention";
  }
  return "";
}

function settingStateLabel(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Enabled" : "Disabled";
}

export function PullRequestDetailHeader({
  selectedPull,
  selectedMerged,
  selectedReviewDecision,
  reviewDecisionAvailabilityMessage
}: {
  selectedPull: PullRequestSummary;
  selectedMerged: boolean | null;
  selectedReviewDecision: string | null;
  reviewDecisionAvailabilityMessage: string | null;
}): JSX.Element {
  return (
    <header className="thread-header pr-detail-header">
      <h2>{selectedPull.title}</h2>
      <small>
        #{selectedPull.number} by {selectedPull.authorLogin ?? "unknown"} · {selectedPull.headRefName} -&gt;{" "}
        {selectedPull.baseRefName}
      </small>
      <span className={`state-chip ${selectedPull.state === "open" ? "success" : ""}`}>
        {selectedPull.state}
      </span>
      {selectedMerged && <span className="state-chip success">Merged</span>}
      <span className={`state-chip ${pullRequestReviewDecisionTone(selectedReviewDecision)}`}>
        {formatPullRequestReviewDecision(selectedReviewDecision)}
      </span>
      {reviewDecisionAvailabilityMessage && (
        <small className="action-disabled-note">{reviewDecisionAvailabilityMessage}</small>
      )}
      {selectedPull.locked && <span className="state-chip attention">Locked</span>}
    </header>
  );
}

export function PullRequestDetailStatusSummary({
  selectedPull,
  selectedIsCrossRepository,
  selectedHeadRepository,
  selectedBaseRepository,
  selectedMaintainerCanModify,
  selectedMergeCommitSha,
  selectedMergedAt,
  selectedBranchSignals,
  selectedBaseProtection,
  selectedBaseProtectionBranchLabel,
  selectedBaseProtectionStatusLabel,
  selectedBaseProtectionStatusUnavailable,
  selectedBaseProtectionLoading,
  selectedBaseProtectionError,
  selectedBaseProtectionAvailabilityMessage,
  selectedBaseProtectionLoaded
}: {
  selectedPull: PullRequestSummary;
  selectedIsCrossRepository: boolean | null;
  selectedHeadRepository: string | null;
  selectedBaseRepository: string | null;
  selectedMaintainerCanModify: boolean | null;
  selectedMergeCommitSha: string | null;
  selectedMergedAt: string | null;
  selectedBranchSignals: string[];
  selectedBaseProtection: BranchProtectionSummary | null;
  selectedBaseProtectionBranchLabel: string;
  selectedBaseProtectionStatusLabel: string;
  selectedBaseProtectionStatusUnavailable: boolean;
  selectedBaseProtectionLoading: boolean;
  selectedBaseProtectionError: Error | null;
  selectedBaseProtectionAvailabilityMessage: string | null;
  selectedBaseProtectionLoaded: boolean;
}): JSX.Element {
  return (
    <>
      <div className="diff-summary">
        <span>{selectedPull.changedFiles} files changed</span>
        <span className="additions">+{formatCompactNumber(selectedPull.additions)}</span>
        <span className="deletions">-{formatCompactNumber(selectedPull.deletions)}</span>
        <span>{selectedPull.reviewComments} review comments</span>
        {selectedIsCrossRepository !== null && (
          <span>{selectedIsCrossRepository ? "Cross-repository" : "Same repository"}</span>
        )}
        {selectedHeadRepository && selectedBaseRepository && (
          <span>
            {selectedHeadRepository} -&gt; {selectedBaseRepository}
          </span>
        )}
        {selectedMaintainerCanModify !== null && (
          <span>
            {selectedMaintainerCanModify ? "Maintainer edits allowed" : "Maintainer edits disabled"}
          </span>
        )}
        {selectedMergeCommitSha && <span>Merge {selectedMergeCommitSha.slice(0, 7)}</span>}
        {selectedMergedAt && <span>Merged {formatRelativeDate(selectedMergedAt)}</span>}
        {selectedBranchSignals.map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>
      <div className="workflow-summary branch-protection-flags">
        <span
          className={`state-chip ${
            selectedBaseProtectionStatusUnavailable ? "attention" : selectedBaseProtection ? "success" : ""
          }`}
        >
          {selectedBaseProtectionBranchLabel}: <strong>{selectedBaseProtectionStatusLabel}</strong>
        </span>
        {selectedBaseProtectionLoading && <span>Loading branch protection…</span>}
        {selectedBaseProtectionError && (
          <span>Branch protection unavailable: {selectedBaseProtectionError.message}</span>
        )}
        {selectedBaseProtectionAvailabilityMessage && (
          <span>{selectedBaseProtectionAvailabilityMessage}</span>
        )}
        {!selectedBaseProtectionLoading &&
          !selectedBaseProtectionError &&
          !selectedBaseProtectionAvailabilityMessage &&
          selectedBaseProtectionLoaded &&
          !selectedBaseProtection && <span>No protection rules returned.</span>}
        {selectedBaseProtection && (
          <>
            <span>
              Required checks:{" "}
              {formatCompactNumber(selectedBaseProtection.requiredStatusCheckContexts.length)}
            </span>
            <span>Approvals: {selectedBaseProtection.requiredApprovingReviewCount ?? 0}</span>
            <span>Code owners: {settingStateLabel(selectedBaseProtection.requireCodeOwnerReviews)}</span>
            <span>
              Conversation resolution:{" "}
              {settingStateLabel(selectedBaseProtection.requiredConversationResolution)}
            </span>
            <span>Linear history: {settingStateLabel(selectedBaseProtection.requiredLinearHistory)}</span>
          </>
        )}
      </div>
    </>
  );
}

export function PullRequestDetailSummary({
  selectedPull,
  selectedMerged,
  selectedReviewDecision,
  reviewDecisionAvailabilityMessage,
  selectedIsCrossRepository,
  selectedHeadRepository,
  selectedBaseRepository,
  selectedMaintainerCanModify,
  selectedMergeCommitSha,
  selectedMergedAt,
  selectedBranchSignals,
  selectedBaseProtection,
  selectedBaseProtectionBranchLabel,
  selectedBaseProtectionStatusLabel,
  selectedBaseProtectionStatusUnavailable,
  selectedBaseProtectionLoading,
  selectedBaseProtectionError,
  selectedBaseProtectionAvailabilityMessage,
  selectedBaseProtectionLoaded
}: {
  selectedPull: PullRequestSummary;
  selectedMerged: boolean | null;
  selectedReviewDecision: string | null;
  reviewDecisionAvailabilityMessage: string | null;
  selectedIsCrossRepository: boolean | null;
  selectedHeadRepository: string | null;
  selectedBaseRepository: string | null;
  selectedMaintainerCanModify: boolean | null;
  selectedMergeCommitSha: string | null;
  selectedMergedAt: string | null;
  selectedBranchSignals: string[];
  selectedBaseProtection: BranchProtectionSummary | null;
  selectedBaseProtectionBranchLabel: string;
  selectedBaseProtectionStatusLabel: string;
  selectedBaseProtectionStatusUnavailable: boolean;
  selectedBaseProtectionLoading: boolean;
  selectedBaseProtectionError: Error | null;
  selectedBaseProtectionAvailabilityMessage: string | null;
  selectedBaseProtectionLoaded: boolean;
}): JSX.Element {
  return (
    <>
      <PullRequestDetailHeader
        selectedPull={selectedPull}
        selectedMerged={selectedMerged}
        selectedReviewDecision={selectedReviewDecision}
        reviewDecisionAvailabilityMessage={reviewDecisionAvailabilityMessage}
      />
      <PullRequestDetailStatusSummary
        selectedPull={selectedPull}
        selectedIsCrossRepository={selectedIsCrossRepository}
        selectedHeadRepository={selectedHeadRepository}
        selectedBaseRepository={selectedBaseRepository}
        selectedMaintainerCanModify={selectedMaintainerCanModify}
        selectedMergeCommitSha={selectedMergeCommitSha}
        selectedMergedAt={selectedMergedAt}
        selectedBranchSignals={selectedBranchSignals}
        selectedBaseProtection={selectedBaseProtection}
        selectedBaseProtectionBranchLabel={selectedBaseProtectionBranchLabel}
        selectedBaseProtectionStatusLabel={selectedBaseProtectionStatusLabel}
        selectedBaseProtectionStatusUnavailable={selectedBaseProtectionStatusUnavailable}
        selectedBaseProtectionLoading={selectedBaseProtectionLoading}
        selectedBaseProtectionError={selectedBaseProtectionError}
        selectedBaseProtectionAvailabilityMessage={selectedBaseProtectionAvailabilityMessage}
        selectedBaseProtectionLoaded={selectedBaseProtectionLoaded}
      />
    </>
  );
}
