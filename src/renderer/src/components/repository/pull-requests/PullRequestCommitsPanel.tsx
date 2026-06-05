import type { JSX } from "react";

import type { PullRequestCommitSummary } from "@shared/github";

import { formatRelativeDate } from "@renderer/utils/format";

export function PullRequestCommitsPanel({
  commits,
  visibleCommits,
  commitsRequested,
  commitsAvailabilityMessage,
  loading,
  expanded,
  commitLimit,
  changedFilesRepositoryNameWithOwner,
  onRequestCommits,
  onToggleCommits,
  onOpenPullRequestCommit,
  onOpenExternal
}: {
  commits: PullRequestCommitSummary[];
  visibleCommits: PullRequestCommitSummary[];
  commitsRequested: boolean;
  commitsAvailabilityMessage: string | null;
  loading: boolean;
  expanded: boolean;
  commitLimit: number;
  changedFilesRepositoryNameWithOwner: string | null;
  onRequestCommits(): void;
  onToggleCommits(): void;
  onOpenPullRequestCommit(
    commit: PullRequestCommitSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <article>
      <header>
        <h3>Commits</h3>
        <span>{commitsRequested ? commits.length : "not loaded"}</span>
      </header>
      <div className="pr-inspection-list">
        {!commitsRequested && (
          <button type="button" onClick={onRequestCommits}>
            <small>Load commits</small>
          </button>
        )}
        {visibleCommits.map((commit) => (
          <div className="pr-file-row" key={commit.sha}>
            <div>
              <strong>{commit.message}</strong>
              <small>
                {commit.sha.slice(0, 7)} · {commit.authorLogin ?? "unknown"} ·{" "}
                {commit.committedAt ? formatRelativeDate(commit.committedAt) : "unknown date"}
              </small>
            </div>
            <button
              type="button"
              onClick={() => onOpenPullRequestCommit(commit, changedFilesRepositoryNameWithOwner)}
            >
              Open tree in Control
            </button>
            <button
              type="button"
              disabled={!commit.htmlUrl}
              title={commit.htmlUrl ? undefined : "Commit URL unavailable."}
              onClick={() => {
                if (commit.htmlUrl) {
                  onOpenExternal(commit.htmlUrl);
                }
              }}
            >
              Open on GitHub
            </button>
          </div>
        ))}
        {commitsRequested && commits.length > commitLimit && (
          <button type="button" onClick={onToggleCommits}>
            <small>{expanded ? "Show fewer" : `Show all ${commits.length} commits`}</small>
          </button>
        )}
        {commitsRequested && !loading && commitsAvailabilityMessage && (
          <div className="error-state">{commitsAvailabilityMessage}</div>
        )}
        {commitsRequested && !loading && !commitsAvailabilityMessage && commits.length === 0 && (
          <div className="empty-state">No commits returned.</div>
        )}
      </div>
    </article>
  );
}
