import type { JSX } from "react";

import type { PullRequestLinkedIssueSummary } from "@shared/github";

import type { PullRequestLinkedIssue } from "./PullRequestsTab.types";

export function PullRequestLinkedIssuesPanel({
  linkedIssues,
  linkedIssuesRequested,
  linkedIssuesAvailabilityMessage,
  loading,
  repositoryNameWithOwner,
  onRequestLinkedIssues,
  onOpenIssueReference
}: {
  linkedIssues: PullRequestLinkedIssueSummary[];
  linkedIssuesRequested: boolean;
  linkedIssuesAvailabilityMessage: string | null;
  loading: boolean;
  repositoryNameWithOwner: string | null;
  onRequestLinkedIssues(): void;
  onOpenIssueReference(issue: PullRequestLinkedIssue): void;
}): JSX.Element {
  return (
    <article>
      <header>
        <h3>Linked issues</h3>
        <span>{linkedIssuesRequested ? linkedIssues.length : "not loaded"}</span>
      </header>
      <div className="pr-inspection-list">
        {!linkedIssuesRequested && (
          <button type="button" onClick={onRequestLinkedIssues}>
            <small>Load linked issues</small>
          </button>
        )}
        {linkedIssuesRequested && loading && linkedIssues.length === 0 && (
          <div className="loading-state">Loading linked issues…</div>
        )}
        {linkedIssues.map((issue) => {
          const issueRepositoryNameWithOwner = issue.repositoryNameWithOwner ?? repositoryNameWithOwner;

          return (
            <div className="pr-file-row" key={`${issueRepositoryNameWithOwner ?? "unknown"}#${issue.number}`}>
              <div>
                <strong>
                  {issueRepositoryNameWithOwner
                    ? `${issueRepositoryNameWithOwner}#${issue.number}`
                    : `#${issue.number}`}{" "}
                  {issue.title ?? "Untitled issue"}
                </strong>
                <small>
                  {issue.state.toLowerCase()}
                  {issue.stateReason ? ` · ${issue.stateReason.toLowerCase()}` : ""}
                </small>
              </div>
              <button type="button" onClick={() => onOpenIssueReference(issue)}>
                Open issue in Control
              </button>
            </div>
          );
        })}
        {linkedIssuesRequested && !loading && linkedIssuesAvailabilityMessage && (
          <div className="error-state">{linkedIssuesAvailabilityMessage}</div>
        )}
        {linkedIssuesRequested &&
          !loading &&
          !linkedIssuesAvailabilityMessage &&
          linkedIssues.length === 0 && (
            <div className="empty-state">No closing issue references returned.</div>
          )}
      </div>
    </article>
  );
}
