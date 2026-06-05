import { ExternalLink, GitPullRequest } from "lucide-react";
import type { JSX } from "react";

import type { PullRequestSummary, RepositoryDetail } from "@shared/github";

import { formatRelativeDate } from "@renderer/utils/format";

const maxPullRequestListLimit = 100;

function pullRequestReviewDecisionLabel(pull: PullRequestSummary): string | null {
  if (pull.reviewDecision === "APPROVED") {
    return "review approved";
  }
  if (pull.reviewDecision === "REVIEW_REQUIRED") {
    return "review required";
  }
  if (pull.reviewDecision === "CHANGES_REQUESTED") {
    return "changes requested";
  }
  return pull.reviewDecision ? `review ${pull.reviewDecision.toLowerCase().replaceAll("_", " ")}` : null;
}

function PullRequestListRow({
  repository,
  pull,
  active,
  onSelect,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  pull: PullRequestSummary;
  active: boolean;
  onSelect(pull: PullRequestSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const headRepositoryNameWithOwner = pull.headRepositoryNameWithOwner ?? null;
  const baseRepositoryNameWithOwner = pull.baseRepositoryNameWithOwner ?? null;
  const headRepositoryDiffers =
    Boolean(headRepositoryNameWithOwner) && headRepositoryNameWithOwner !== repository.nameWithOwner;
  const baseRepositoryDiffers =
    Boolean(baseRepositoryNameWithOwner) && baseRepositoryNameWithOwner !== repository.nameWithOwner;
  const isCrossRepository = pull.isCrossRepository ?? (headRepositoryDiffers || baseRepositoryDiffers);
  const sourceRepositoryLabel = headRepositoryNameWithOwner ?? "external source";
  const reviewDecisionLabel = pullRequestReviewDecisionLabel(pull);

  return (
    <div className={`issue-row thread-list-action-row ${active ? "active" : ""}`}>
      <button className="thread-list-row-main" type="button" onClick={() => onSelect(pull)}>
        <GitPullRequest size={17} />
        <div>
          <strong>{pull.title}</strong>
          <small>
            #{pull.number} by {pull.authorLogin ?? "unknown"} · {pull.headRefName} -&gt; {pull.baseRefName} ·{" "}
            {pull.changedFiles} files · {pull.comments} comments · {pull.reviewComments} review comments
            {isCrossRepository ? ` · source ${sourceRepositoryLabel}` : ""}
            {pull.mergedAt ? ` · merged ${formatRelativeDate(pull.mergedAt)}` : ""}
          </small>
        </div>
        <div className="thread-list-row-badges">
          {isCrossRepository && (
            <span className="state-chip attention" title={`Source repository: ${sourceRepositoryLabel}`}>
              {headRepositoryNameWithOwner ? `fork: ${headRepositoryNameWithOwner}` : "fork"}
            </span>
          )}
          <span className={`state-chip ${pull.mergeableState === "clean" ? "success" : ""}`}>
            {pull.isDraft ? "draft" : (pull.mergeableState ?? pull.state)}
          </span>
          {reviewDecisionLabel && <span className="state-chip">{reviewDecisionLabel}</span>}
          {pull.merged && <span className="state-chip success">merged</span>}
          <span className={`state-chip ${pull.state === "open" ? "success" : ""}`}>{pull.state}</span>
          {pull.locked && <span className="state-chip attention">locked</span>}
        </div>
      </button>
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open pull request ${pull.number} on GitHub`}
        title={`Open pull request #${pull.number} on GitHub`}
        onClick={() => onOpenExternal(pull.htmlUrl)}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

export function PullRequestList({
  repository,
  pulls,
  selectedPullNumber,
  creating,
  loading,
  availabilityMessage,
  filter,
  pullRequestListLimit,
  onSelect,
  onOpenExternal,
  onExpandPullRequests
}: {
  repository: RepositoryDetail;
  pulls: PullRequestSummary[];
  selectedPullNumber: number | null;
  creating: boolean;
  loading: boolean;
  availabilityMessage: string | null;
  filter: string;
  pullRequestListLimit: number;
  onSelect(pull: PullRequestSummary): void;
  onOpenExternal(url: string): void;
  onExpandPullRequests(): void;
}): JSX.Element {
  const unfilteredPullRequestListLimitHit = !filter.trim() && pulls.length >= pullRequestListLimit;

  return (
    <div className="thread-list">
      {loading && pulls.length === 0 && <div className="loading-state">Loading pull requests…</div>}
      {!loading && availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {pulls.map((pull) => (
        <PullRequestListRow
          key={pull.id}
          repository={repository}
          pull={pull}
          active={selectedPullNumber === pull.number && !creating}
          onSelect={onSelect}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!loading && pulls.length === 0 && (
        <div className="empty-state">
          {filter.trim()
            ? "No pull requests match this filter."
            : "No pull requests returned for this repository."}
        </div>
      )}
      {unfilteredPullRequestListLimitHit && pullRequestListLimit < maxPullRequestListLimit && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandPullRequests}>
            Load more pull requests
          </button>
        </div>
      )}
      {unfilteredPullRequestListLimitHit && pullRequestListLimit >= maxPullRequestListLimit && (
        <div className="muted-row">
          Showing the first {pullRequestListLimit} pull requests returned by GitHub.
        </div>
      )}
    </div>
  );
}
