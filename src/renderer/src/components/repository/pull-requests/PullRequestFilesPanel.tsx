import type { JSX } from "react";

import type { PullRequestFileSummary } from "@shared/github";

import { formatCompactNumber } from "@renderer/utils/format";

export function PullRequestFilesPanel({
  files,
  visibleFiles,
  filesRequested,
  filesAvailabilityMessage,
  loading,
  expanded,
  fileLimit,
  changedFilesRef,
  changedFilesRepositoryNameWithOwner,
  onRequestFiles,
  onToggleFiles,
  onOpenExternal,
  onOpenCodePath
}: {
  files: PullRequestFileSummary[];
  visibleFiles: PullRequestFileSummary[];
  filesRequested: boolean;
  filesAvailabilityMessage: string | null;
  loading: boolean;
  expanded: boolean;
  fileLimit: number;
  changedFilesRef: string | null;
  changedFilesRepositoryNameWithOwner: string | null;
  onRequestFiles(): void;
  onToggleFiles(): void;
  onOpenExternal(url: string): void;
  onOpenCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
}): JSX.Element {
  return (
    <article>
      <header>
        <h3>Changed files</h3>
        <span>{filesRequested ? files.length : "not loaded"}</span>
      </header>
      <div className="pr-inspection-list">
        {!filesRequested && (
          <button type="button" onClick={onRequestFiles}>
            <small>Load changed files</small>
          </button>
        )}
        {visibleFiles.map((file) => (
          <div className="pr-file-row" key={file.filename}>
            <div>
              <strong>{file.filename}</strong>
              <small>
                {file.status} · +{formatCompactNumber(file.additions)} -{formatCompactNumber(file.deletions)}{" "}
                · {formatCompactNumber(file.changes)} changes
              </small>
            </div>
            <button
              type="button"
              disabled={!changedFilesRef}
              title={changedFilesRef ? undefined : "File reference unavailable."}
              onClick={() =>
                onOpenCodePath(
                  file.filename,
                  changedFilesRef,
                  file.blobUrl,
                  null,
                  changedFilesRepositoryNameWithOwner
                )
              }
            >
              Open in Control
            </button>
            <button
              type="button"
              disabled={!file.blobUrl}
              title={file.blobUrl ? undefined : "GitHub file URL unavailable."}
              onClick={() => {
                if (file.blobUrl) {
                  onOpenExternal(file.blobUrl);
                }
              }}
            >
              GitHub fallback
            </button>
            <button
              type="button"
              disabled={!file.rawUrl}
              title={file.rawUrl ? undefined : "Raw file URL unavailable."}
              onClick={() => {
                if (file.rawUrl) {
                  onOpenExternal(file.rawUrl);
                }
              }}
            >
              Open raw
            </button>
          </div>
        ))}
        {filesRequested && files.length > fileLimit && (
          <button type="button" onClick={onToggleFiles}>
            <small>{expanded ? "Show fewer" : `Show all ${files.length} changed files`}</small>
          </button>
        )}
        {filesRequested && !loading && filesAvailabilityMessage && (
          <div className="error-state">{filesAvailabilityMessage}</div>
        )}
        {filesRequested && !loading && !filesAvailabilityMessage && files.length === 0 && (
          <div className="empty-state">No changed files returned.</div>
        )}
      </div>
    </article>
  );
}
