import type { JSX } from "react";

import type { PullRequestCheckSummary } from "@shared/github";

function parseWorkflowRunIdFromUrl(url: string | null | undefined): number | null {
  const match = url?.match(/\/actions\/runs\/(\d+)(?:[/?#]|$)/);
  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]);
}

export function PullRequestChecksPanel({
  checks,
  visibleChecks,
  checksRequested,
  checksAvailabilityMessage,
  loading,
  expanded,
  checkLimit,
  onRequestChecks,
  onToggleChecks,
  onOpenWorkflowRun,
  onOpenExternal
}: {
  checks: PullRequestCheckSummary[];
  visibleChecks: PullRequestCheckSummary[];
  checksRequested: boolean;
  checksAvailabilityMessage: string | null;
  loading: boolean;
  expanded: boolean;
  checkLimit: number;
  onRequestChecks(): void;
  onToggleChecks(): void;
  onOpenWorkflowRun(runId: number, url?: string | null): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <article>
      <header>
        <h3>Checks</h3>
        <span>{checksRequested ? checks.length : "not loaded"}</span>
      </header>
      <div className="pr-inspection-list">
        {!checksRequested && (
          <button type="button" onClick={onRequestChecks}>
            <small>Load checks</small>
          </button>
        )}
        {visibleChecks.map((check) => {
          const checkUrl = check.detailsUrl ?? check.htmlUrl;
          const workflowRunId =
            parseWorkflowRunIdFromUrl(check.detailsUrl) ?? parseWorkflowRunIdFromUrl(check.htmlUrl);

          return (
            <div className="pr-file-row" key={check.id}>
              <div>
                <strong>{check.name}</strong>
                <small>
                  {check.conclusion ?? check.status ?? "queued"} · {check.appName ?? "GitHub Checks"}
                  {check.outputSummary ? ` · ${check.outputSummary}` : ""}
                </small>
              </div>
              <button
                type="button"
                disabled={workflowRunId === null}
                title={
                  workflowRunId === null ? "This check does not expose a GitHub Actions run URL." : undefined
                }
                onClick={() => {
                  if (workflowRunId !== null) {
                    onOpenWorkflowRun(workflowRunId, checkUrl);
                  }
                }}
              >
                Open run in Control
              </button>
              <button
                type="button"
                disabled={!checkUrl}
                title={checkUrl ? undefined : "Check URL unavailable."}
                onClick={() => {
                  if (checkUrl) {
                    onOpenExternal(checkUrl);
                  }
                }}
              >
                GitHub fallback
              </button>
            </div>
          );
        })}
        {checksRequested && checks.length > checkLimit && (
          <button type="button" onClick={onToggleChecks}>
            <small>{expanded ? "Show fewer" : `Show all ${checks.length} checks`}</small>
          </button>
        )}
        {checksRequested && !loading && checksAvailabilityMessage && (
          <div className="error-state">{checksAvailabilityMessage}</div>
        )}
        {checksRequested && !loading && !checksAvailabilityMessage && checks.length === 0 && (
          <div className="empty-state">No check runs returned for this pull request.</div>
        )}
      </div>
    </article>
  );
}
