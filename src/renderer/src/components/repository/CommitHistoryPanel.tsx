import { ExternalLink, GitBranch } from "lucide-react";
import type { JSX } from "react";

import type { RepositoryCommitSummary } from "@shared/github";

import { formatRelativeDate } from "@renderer/utils/format";

export const maxCommitHistoryLimit = 100;

export function CommitHistoryPanel({
  title,
  subtitle,
  commits,
  loading,
  error,
  availabilityMessage,
  externalUrl,
  currentLimit,
  openCommitLabel = "Open in Control",
  onExpandCommits,
  onOpenCommit,
  onOpenExternal
}: {
  title: string;
  subtitle: string;
  commits: RepositoryCommitSummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage?: string | null;
  externalUrl?: string | null;
  currentLimit: number;
  openCommitLabel?: string;
  onExpandCommits(): void;
  onOpenCommit?(commit: RepositoryCommitSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const commitsLimitHit = commits.length >= currentLimit;
  const canExpandCommits = commitsLimitHit && currentLimit < maxCommitHistoryLimit;
  const historyStatus = loading
    ? commits.length > 0
      ? `Refreshing ${commits.length} commits`
      : "Loading commits"
    : error
      ? "Unavailable"
      : availabilityMessage
        ? "Unavailable"
        : commits.length === 0
          ? "No commits"
          : canExpandCommits
            ? `${commits.length}+ commits`
            : `${commits.length} commits`;

  return (
    <section className="readme-panel commit-history-panel">
      <header>
        <GitBranch size={17} />
        <span>{title}</span>
        <small>{subtitle}</small>
        <span className="state-chip">{historyStatus}</span>
        <button
          type="button"
          disabled={!externalUrl}
          title={externalUrl ? undefined : "GitHub history URL unavailable."}
          onClick={() => {
            if (externalUrl) {
              onOpenExternal(externalUrl);
            }
          }}
        >
          <ExternalLink size={14} /> Open GitHub fallback
        </button>
      </header>
      {loading && commits.length === 0 && <div className="loading-state">Loading commits…</div>}
      {error && <div className="error-state">Commit history unavailable: {error.message}</div>}
      {!loading && !error && availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && commits.length === 0 && (
        <div className="empty-state">History loaded, but GitHub returned no commits for this scope.</div>
      )}
      {commits.length > 0 && (
        <div className="commit-history-list">
          {commits.map((commit) =>
            onOpenCommit ? (
              <div className="commit-history-row" key={commit.sha}>
                {commit.authorAvatarUrl ? <img src={commit.authorAvatarUrl} alt="" /> : null}
                <span>
                  <strong>{commit.headline}</strong>
                  <small>
                    {commit.authorLogin ?? commit.authorName ?? "unknown"} · {commit.sha.slice(0, 7)}
                    {commit.verified ? " · verified" : ""}
                    {commit.parentCount > 1 ? ` · ${commit.parentCount} parents` : ""}
                  </small>
                </span>
                <time>{formatRelativeDate(commit.committedDate ?? commit.authoredDate)}</time>
                <div className="commit-history-row-actions">
                  <button type="button" onClick={() => onOpenCommit(commit)}>
                    {openCommitLabel}
                  </button>
                  <button
                    type="button"
                    disabled={!commit.htmlUrl}
                    title={commit.htmlUrl ? undefined : "Commit URL unavailable."}
                    onClick={() => commit.htmlUrl && onOpenExternal(commit.htmlUrl)}
                  >
                    GitHub fallback
                  </button>
                </div>
              </div>
            ) : (
              <button
                key={commit.sha}
                type="button"
                disabled={!commit.htmlUrl}
                title={commit.htmlUrl ? undefined : "Commit URL unavailable."}
                onClick={() => commit.htmlUrl && onOpenExternal(commit.htmlUrl)}
              >
                {commit.authorAvatarUrl ? <img src={commit.authorAvatarUrl} alt="" /> : null}
                <span>
                  <strong>{commit.headline}</strong>
                  <small>
                    {commit.authorLogin ?? commit.authorName ?? "unknown"} · {commit.sha.slice(0, 7)}
                    {commit.verified ? " · verified" : ""}
                    {commit.parentCount > 1 ? ` · ${commit.parentCount} parents` : ""}
                  </small>
                </span>
                <time>{formatRelativeDate(commit.committedDate ?? commit.authoredDate)}</time>
              </button>
            )
          )}
        </div>
      )}
      {canExpandCommits && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandCommits}>
            Load more commits
          </button>
        </div>
      )}
      {!canExpandCommits && commitsLimitHit && (
        <div className="muted-row">Showing the first {currentLimit} commits returned by GitHub.</div>
      )}
    </section>
  );
}
