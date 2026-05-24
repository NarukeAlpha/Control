import { ExternalLink, Eye } from "lucide-react";
import type { JSX } from "react";

import type { RepoFileBlameCommit, RepoFileBlameRange, RepoFileBlameResult } from "@shared/github";

import { formatRelativeDate } from "@renderer/utils/format";

import { readAvailabilityMessage } from "./repositoryUi";

export const expandedFileBlameRangeLimit = 100;

export function FileBlamePanel({
  blame,
  rangeLimit,
  loading,
  error,
  externalUrl,
  onExpandPreview,
  onOpenRange,
  onOpenCommit,
  onOpenExternal
}: {
  blame?: RepoFileBlameResult;
  rangeLimit: number;
  loading: boolean;
  error: Error | null;
  externalUrl?: string | null;
  onExpandPreview?(): void;
  onOpenRange?(range: RepoFileBlameRange): void;
  onOpenCommit?(commit: RepoFileBlameCommit): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const ranges = blame?.ranges ?? [];
  const availabilityMessage = readAvailabilityMessage("File blame", blame?.availability ?? null);
  const canExpandPreview =
    Boolean(blame?.truncated) && rangeLimit < expandedFileBlameRangeLimit && Boolean(onExpandPreview);
  const blameStatus = loading
    ? ranges.length > 0
      ? `Refreshing ${ranges.length} ranges`
      : "Loading ranges"
    : error || availabilityMessage
      ? "Unavailable"
      : ranges.length === 0
        ? "No ranges"
        : blame?.truncated
          ? `${ranges.length}+ ranges`
          : `${ranges.length} ranges`;

  return (
    <section className="readme-panel file-blame-panel">
      <header>
        <Eye size={17} />
        <span>Blame</span>
        <span className="state-chip">{blameStatus}</span>
        <button
          type="button"
          disabled={!externalUrl}
          title={externalUrl ? undefined : "GitHub blame URL unavailable."}
          onClick={() => {
            if (externalUrl) {
              onOpenExternal(externalUrl);
            }
          }}
        >
          <ExternalLink size={14} /> Open GitHub fallback
        </button>
        {canExpandPreview && (
          <button type="button" onClick={() => onExpandPreview?.()}>
            <Eye size={14} /> Load 100 ranges
          </button>
        )}
      </header>
      {loading && ranges.length === 0 && <div className="loading-state">Loading blame ranges...</div>}
      {error && <div className="error-state">File blame unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && ranges.length === 0 && (
        <div className="empty-state">Blame loaded, but GitHub returned no ranges for this file.</div>
      )}
      {ranges.length > 0 && (
        <div className="blame-range-list">
          {ranges.map((range) =>
            onOpenRange || onOpenCommit ? (
              <div
                className="blame-range-row"
                key={`${range.startingLine}-${range.endingLine}-${range.commit.sha}`}
              >
                <strong>
                  Lines {range.startingLine}-{range.endingLine}
                </strong>
                <span>{range.commit.headline}</span>
                <small>
                  {range.commit.authorLogin ?? range.commit.authorName ?? "unknown"} ·{" "}
                  {formatRelativeDate(range.commit.committedDate ?? range.commit.authoredDate)}
                </small>
                <code>{range.commit.sha.slice(0, 7)}</code>
                <div className="blame-range-row-actions">
                  {onOpenRange ? (
                    <button type="button" onClick={() => onOpenRange(range)}>
                      Open file at commit
                    </button>
                  ) : null}
                  {onOpenCommit ? (
                    <button type="button" onClick={() => onOpenCommit(range.commit)}>
                      Open commit in Control
                    </button>
                  ) : null}
                  {range.commit.htmlUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (range.commit.htmlUrl) {
                          onOpenExternal(range.commit.htmlUrl);
                        }
                      }}
                    >
                      GitHub fallback
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                type="button"
                key={`${range.startingLine}-${range.endingLine}-${range.commit.sha}`}
                disabled={!range.commit.htmlUrl}
                title={range.commit.htmlUrl ? undefined : "Commit URL unavailable."}
                onClick={() => range.commit.htmlUrl && onOpenExternal(range.commit.htmlUrl)}
              >
                <strong>
                  Lines {range.startingLine}-{range.endingLine}
                </strong>
                <span>{range.commit.headline}</span>
                <small>
                  {range.commit.authorLogin ?? range.commit.authorName ?? "unknown"} ·{" "}
                  {formatRelativeDate(range.commit.committedDate ?? range.commit.authoredDate)}
                </small>
                <code>{range.commit.sha.slice(0, 7)}</code>
              </button>
            )
          )}
        </div>
      )}
      {blame?.truncated && (
        <small className="action-disabled-note">
          {rangeLimit >= expandedFileBlameRangeLimit
            ? "Control is showing the first 100 blame ranges."
            : "Showing the first blame ranges only."}
        </small>
      )}
    </section>
  );
}
