import { Code2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type { RepositorySummary } from "@shared/github";

import {
  displayRepositoryName,
  repositoryMatchesQuery,
  repositoryNameWithOwnerInput,
  repositorySearchMetadataLabel,
  repositorySearchSourceLabel
} from "@renderer/components/repository/repositorySearch";
import { readAvailabilityMessage } from "@renderer/components/repository/repositoryUi";
import { useControlApi } from "@renderer/hooks/useControlApi";

const defaultAddRepositoryLocalLimit = 6;
const defaultAddRepositoryRemoteLimit = 12;
const maxAddRepositoryRemoteLimit = 100;

export function AddRepositoryDialog({
  repositories,
  viewerLogin,
  githubReady,
  onOpenRepository,
  onClose
}: {
  repositories: RepositorySummary[];
  viewerLogin: string | null;
  githubReady: boolean;
  onOpenRepository(nameWithOwner: string): void;
  onClose(): void;
}): JSX.Element {
  const api = useControlApi();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [localResultLimit, setLocalResultLimit] = useState(defaultAddRepositoryLocalLimit);
  const [remoteSearchLimit, setRemoteSearchLimit] = useState(defaultAddRepositoryRemoteLimit);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim();
  const allLocalMatches = useMemo(
    () => repositories.filter((repository) => repositoryMatchesQuery(repository, normalizedQuery)),
    [normalizedQuery, repositories]
  );
  const localMatches = useMemo(
    () => allLocalMatches.slice(0, localResultLimit),
    [allLocalMatches, localResultLimit]
  );
  const canLoadMoreLocalResults = localMatches.length < allLocalMatches.length;
  const localNames = useMemo(
    () => new Set(repositories.map((repository) => repository.nameWithOwner.toLowerCase())),
    [repositories]
  );
  const exactRepositoryTarget = repositoryNameWithOwnerInput(normalizedQuery);
  const remoteSearch = useQuery({
    queryKey: ["add-repository-search", normalizedQuery, remoteSearchLimit],
    queryFn: () => api.github.searchWithStatus({ query: normalizedQuery, limit: remoteSearchLimit }),
    enabled: githubReady && normalizedQuery.length > 1
  });
  const remoteSearchItems = remoteSearch.data?.items ?? [];
  const remoteSearchAvailabilityMessage = readAvailabilityMessage(
    "Repository search",
    remoteSearch.data?.availability ?? null
  );
  const remoteSearchUnavailable = remoteSearch.data
    ? remoteSearch.data.availability.status !== "available"
    : false;
  const remoteResults = remoteSearchItems.filter(
    (repository) => !localNames.has(repository.nameWithOwner.toLowerCase())
  );
  const canLoadMoreRemoteResults =
    githubReady &&
    remoteSearchLimit < maxAddRepositoryRemoteLimit &&
    remoteSearchItems.length >= remoteSearchLimit;
  const exactRepositoryResultVisible =
    exactRepositoryTarget !== null &&
    [...localMatches, ...remoteResults].some(
      (repository) => repository.nameWithOwner.toLowerCase() === exactRepositoryTarget.toLowerCase()
    );
  const directRepositoryVisible = exactRepositoryTarget !== null && !exactRepositoryResultVisible;
  const invalidRepositoryTarget =
    normalizedQuery.includes("/") && exactRepositoryTarget === null
      ? "Use the owner/repository format to open a repository directly."
      : null;
  const resultItems = useMemo(
    () => [
      ...localMatches.map((repository) => ({ repository, source: "Local" as const })),
      ...remoteResults.map((repository) => ({ repository, source: "GitHub" as const }))
    ],
    [localMatches, remoteResults]
  );
  const directResultCount = directRepositoryVisible ? 1 : 0;
  const resultCount = directResultCount + resultItems.length;
  const boundedActiveIndex = Math.min(Math.max(activeIndex, 0), Math.max(resultCount - 1, 0));
  const directResultActive = directRepositoryVisible && boundedActiveIndex === 0;
  const activeResult = resultItems[boundedActiveIndex - directResultCount] ?? null;
  const activeResultId = resultCount > 0 ? `add-repository-result-${boundedActiveIndex}` : undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function openRepository(nameWithOwner: string): void {
    onOpenRepository(nameWithOwner);
    onClose();
  }

  function renderRepositoryButton(
    repository: RepositorySummary,
    source: "Local" | "GitHub",
    index: number
  ): JSX.Element {
    return (
      <button
        className={index === boundedActiveIndex ? "active-finder-row" : ""}
        id={`add-repository-result-${index}`}
        key={`${source}-${repository.id}`}
        role="option"
        aria-selected={index === boundedActiveIndex}
        type="button"
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => openRepository(repository.nameWithOwner)}
      >
        <Code2 size={17} />
        <span>
          <strong>{displayRepositoryName(repository, viewerLogin)}</strong>
          <small>{repositorySearchMetadataLabel(repository)}</small>
        </span>
        <em>{repositorySearchSourceLabel(repository, source)}</em>
      </button>
    );
  }

  return (
    <div className="modal-backdrop command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Add repository"
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
              setLocalResultLimit(defaultAddRepositoryLocalLimit);
              setRemoteSearchLimit(defaultAddRepositoryRemoteLimit);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex(Math.min(boundedActiveIndex + 1, Math.max(resultCount - 1, 0)));
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
                setActiveIndex(Math.max(resultCount - 1, 0));
                return;
              }
              if (event.key === "Enter" && directResultActive && exactRepositoryTarget) {
                event.preventDefault();
                openRepository(exactRepositoryTarget);
                return;
              }
              if (event.key === "Enter" && activeResult) {
                event.preventDefault();
                openRepository(activeResult.repository.nameWithOwner);
                return;
              }
              if (event.key === "Enter" && exactRepositoryTarget && !exactRepositoryResultVisible) {
                event.preventDefault();
                openRepository(exactRepositoryTarget);
              }
            }}
            placeholder="Search owner/repository"
            aria-label="Repository search"
            aria-controls="add-repository-results"
            aria-activedescendant={activeResultId}
            aria-describedby="add-repository-instructions"
          />
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close add repository">
            <X size={17} />
          </button>
        </header>
        <span className="visually-hidden" id="add-repository-instructions">
          Use arrow keys to choose a repository and Enter to open it.
        </span>
        <div
          aria-label="Repository search results"
          className="command-palette-list"
          id="add-repository-results"
          role="listbox"
        >
          {!normalizedQuery && (
            <div className="empty-state">
              {githubReady
                ? "Search cached repositories first, then GitHub when local results are not enough."
                : "Cached mode: search local repositories. Sign in with GitHub to search remote repositories."}
            </div>
          )}
          {invalidRepositoryTarget && <div className="empty-state">{invalidRepositoryTarget}</div>}
          {directRepositoryVisible && (
            <button
              className={directResultActive ? "active-finder-row" : ""}
              id="add-repository-result-0"
              type="button"
              role="option"
              aria-selected={directResultActive}
              onMouseEnter={() => setActiveIndex(0)}
              onClick={() => openRepository(exactRepositoryTarget)}
            >
              <Code2 size={17} />
              <span>
                <strong>{exactRepositoryTarget}</strong>
                <small>
                  Open directly. Control will show missing repository or permission errors in-app.
                </small>
              </span>
              <em>Direct</em>
            </button>
          )}
          {localMatches.length > 0 && <div className="palette-section-title">Local cached repositories</div>}
          {localMatches.map((repository, index) =>
            renderRepositoryButton(repository, "Local", directResultCount + index)
          )}
          {remoteResults.length > 0 && <div className="palette-section-title">GitHub search results</div>}
          {remoteResults.map((repository, index) =>
            renderRepositoryButton(repository, "GitHub", directResultCount + localMatches.length + index)
          )}
          {canLoadMoreLocalResults && (
            <button
              className="show-more"
              type="button"
              onClick={() =>
                setLocalResultLimit((currentLimit) =>
                  Math.min(currentLimit + defaultAddRepositoryLocalLimit, allLocalMatches.length)
                )
              }
            >
              Load more local results
            </button>
          )}
          {canLoadMoreRemoteResults && (
            <button
              className="show-more"
              type="button"
              onClick={() =>
                setRemoteSearchLimit((currentLimit) =>
                  Math.min(currentLimit + defaultAddRepositoryRemoteLimit, maxAddRepositoryRemoteLimit)
                )
              }
            >
              Load more GitHub results
            </button>
          )}
          {!githubReady && normalizedQuery.length > 1 && (
            <div className="muted-row">Remote GitHub search is unavailable in cached mode.</div>
          )}
          {githubReady && remoteSearch.isFetching && <div className="muted-row">Searching GitHub...</div>}
          {remoteSearch.error && (
            <div className="error-state">
              GitHub repository search unavailable: {remoteSearch.error.message}
            </div>
          )}
          {remoteSearchAvailabilityMessage && (
            <div className="error-state">{remoteSearchAvailabilityMessage}</div>
          )}
          {normalizedQuery.length > 1 &&
            githubReady &&
            !remoteSearch.isFetching &&
            !remoteSearch.error &&
            !remoteSearchUnavailable &&
            !directRepositoryVisible &&
            localMatches.length === 0 &&
            remoteResults.length === 0 && <div className="muted-row">No repositories found.</div>}
        </div>
      </section>
    </div>
  );
}
