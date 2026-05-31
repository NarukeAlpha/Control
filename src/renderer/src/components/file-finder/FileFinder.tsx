import { ChevronDown, File as FileIcon, Folder, GitBranch, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";

import type {
  BranchSummary,
  RepoTreeEntry,
  RepoTreeResult,
  RepositoryDetail,
  TagSummary
} from "@shared/github";

import { fileFinderMatchScore } from "./fileFinderSearch";

const defaultFileFinderResultLimit = 50;

export function FileFinder({
  repository,
  tree,
  githubReady,
  loading,
  error,
  availabilityMessage,
  branches,
  tags,
  refListLimit,
  maxRefListLimit,
  refsLoading,
  refsError,
  refsAvailabilityMessage,
  selectedRef,
  onClose,
  onSelectRef,
  onExpandRefs,
  onOpenEntry
}: {
  repository: RepositoryDetail;
  tree: RepoTreeResult | null;
  githubReady: boolean;
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  branches: BranchSummary[];
  tags: TagSummary[];
  refListLimit: number;
  maxRefListLimit: number;
  refsLoading: boolean;
  refsError: Error | null;
  refsAvailabilityMessage: string | null;
  selectedRef: string;
  onClose(): void;
  onSelectRef(ref: string): void;
  onExpandRefs(): void;
  onOpenEntry(entry: RepoTreeEntry): void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleResultLimit, setVisibleResultLimit] = useState(defaultFileFinderResultLimit);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const entries = useMemo(() => tree?.entries ?? [], [tree]);
  const matchedEntries = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, score: fileFinderMatchScore(entry, query) }))
        .filter((item): item is { entry: RepoTreeEntry; score: number } => item.score !== null)
        .sort((a, b) => a.score - b.score || a.entry.path.localeCompare(b.entry.path))
        .map((item) => item.entry),
    [entries, query]
  );
  const filteredEntries = useMemo(
    () => matchedEntries.slice(0, visibleResultLimit),
    [matchedEntries, visibleResultLimit]
  );
  const totalMatchCount = matchedEntries.length;
  const hasMoreMatches = filteredEntries.length < totalMatchCount;
  const displayedMatchCount = filteredEntries.length;
  const resultLimitNote =
    totalMatchCount > defaultFileFinderResultLimit
      ? `Showing ${displayedMatchCount} of ${totalMatchCount} local matches.`
      : null;
  const treeUnavailableReason =
    !githubReady && entries.length === 0
      ? "No cached repository tree is available. Sign in with GitHub to load Go to file results."
      : null;
  const cachedTreeNotice =
    !githubReady && entries.length > 0
      ? "Showing cached tree results. Sign in with GitHub to refresh this repository tree."
      : null;
  const boundedActiveIndex = Math.min(Math.max(activeIndex, 0), Math.max(filteredEntries.length - 1, 0));
  const activeEntry = filteredEntries[boundedActiveIndex];
  const activeResultId = activeEntry ? `file-finder-result-${boundedActiveIndex}` : undefined;
  const refOptions = [
    ...branches.map((branch) => ({ kind: "branch" as const, name: branch.name })),
    ...tags.map((tag) => ({ kind: "tag" as const, name: tag.name }))
  ];
  const hasSelectedRefOption = refOptions.some((option) => option.name === selectedRef);
  const refsExceedLoadedCounts =
    branches.length < repository.branchCount || tags.length < repository.tagCount;
  const canExpandRefs = refsExceedLoadedCounts && refListLimit < maxRefListLimit;
  const refsLimitNote =
    refsExceedLoadedCounts && refListLimit >= maxRefListLimit
      ? `Showing the first ${maxRefListLimit} refs.`
      : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function openActiveEntry(): void {
    if (activeEntry) {
      onOpenEntry(activeEntry);
    }
  }

  return (
    <div className="modal-backdrop command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette file-finder"
        role="dialog"
        aria-modal="true"
        aria-label="Go to file"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setVisibleResultLimit(defaultFileFinderResultLimit);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex(Math.min(boundedActiveIndex + 1, Math.max(filteredEntries.length - 1, 0)));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex(Math.max(boundedActiveIndex - 1, 0));
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                setActiveIndex(0);
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                setActiveIndex(Math.max(filteredEntries.length - 1, 0));
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                openActiveEntry();
              }
            }}
            placeholder={`Find a file in ${repository.nameWithOwner}`}
            aria-label="Go to file search"
            aria-controls="file-finder-results"
            aria-activedescendant={activeResultId}
            aria-describedby="file-finder-instructions"
          />
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close file finder">
            <X size={17} />
          </button>
        </header>
        <span className="visually-hidden" id="file-finder-instructions">
          Use arrow keys to choose a file and Enter to open it.
        </span>
        <div className="finder-meta">
          <label className="ref-picker file-finder-ref-picker">
            <GitBranch size={14} />
            <select
              aria-label="Go to file reference"
              disabled={refsLoading && refOptions.length === 0}
              value={selectedRef}
              onChange={(event) => {
                setActiveIndex(0);
                setVisibleResultLimit(defaultFileFinderResultLimit);
                onSelectRef(event.currentTarget.value);
              }}
            >
              {!hasSelectedRefOption && <option value={selectedRef}>{selectedRef}</option>}
              {branches.length > 0 && (
                <optgroup label="Branches">
                  {branches.map((branch) => (
                    <option key={`finder-branch-${branch.name}`} value={branch.name}>
                      {branch.name}
                      {branch.protected ? " (protected)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {tags.length > 0 && (
                <optgroup label="Tags">
                  {tags.map((tag) => (
                    <option key={`finder-tag-${tag.name}`} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown size={13} />
          </label>
          {refsError && (
            <span className="action-disabled-note">Branch and tag list unavailable: {refsError.message}</span>
          )}
          {refsAvailabilityMessage && <span className="action-disabled-note">{refsAvailabilityMessage}</span>}
          {canExpandRefs && (
            <button type="button" onClick={onExpandRefs}>
              Load more refs
            </button>
          )}
          {refsLimitNote && <span>{refsLimitNote}</span>}
          {cachedTreeNotice && <span>{cachedTreeNotice}</span>}
          {resultLimitNote && <span>{resultLimitNote}</span>}
          {tree?.truncated && <span>Large repository: showing GitHub's truncated tree.</span>}
        </div>
        <div
          aria-label={`Files in ${repository.nameWithOwner}`}
          className="command-palette-list"
          id="file-finder-results"
          role="listbox"
        >
          {loading && entries.length === 0 && <div className="loading-state">Loading repository tree...</div>}
          {treeUnavailableReason && <div className="empty-state">{treeUnavailableReason}</div>}
          {error && entries.length === 0 && (
            <div className="error-state">Could not load the repository tree: {error.message}</div>
          )}
          {error && entries.length > 0 && (
            <div className="error-state">Repository tree refresh failed: {error.message}</div>
          )}
          {!loading && !treeUnavailableReason && !error && availabilityMessage && (
            <div className="error-state">{availabilityMessage}</div>
          )}
          {!loading && !treeUnavailableReason && !error && !availabilityMessage && entries.length === 0 && (
            <div className="empty-state">No files returned for this repository tree.</div>
          )}
          {!loading &&
            !treeUnavailableReason &&
            !error &&
            !availabilityMessage &&
            entries.length > 0 &&
            filteredEntries.length === 0 && <div className="empty-state">No files match this search.</div>}
          {!loading &&
            filteredEntries.map((entry, index) => (
              <button
                className={index === boundedActiveIndex ? "active-finder-row" : ""}
                id={`file-finder-result-${index}`}
                key={`${entry.type}-${entry.path}`}
                role="option"
                aria-selected={index === boundedActiveIndex}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onOpenEntry(entry)}
              >
                {entry.type === "dir" ? <Folder size={17} /> : <FileIcon size={17} />}
                <span>
                  <strong>{entry.path.split("/").pop() ?? entry.path}</strong>
                  <small>{entry.path}</small>
                </span>
                <em>{entry.type}</em>
              </button>
            ))}
        </div>
        {!loading && hasMoreMatches && (
          <div className="muted-row">
            <button
              type="button"
              onClick={() => setVisibleResultLimit((limit) => limit + defaultFileFinderResultLimit)}
            >
              Load more matches
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
