import { Bell, Code2, Home, Plus, Search } from "lucide-react";
import { useMemo, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AreaRepositorySummary, AreaSummary } from "@shared/areas";
import type { AppState, RepositorySummary } from "@shared/github";

import { useControlApi } from "../../hooks/useControlApi";
import type { AppRoute } from "../../stores/uiStore";
import { AreaTopbarSelector } from "../areas/AreaTopbarSelector";
import {
  defaultRepositorySearchLocalLimit,
  defaultRepositorySearchRemoteLimit,
  maxRepositoryListLimit,
  repositoryMatchesQuery,
  repositoryNameWithOwnerInput,
  repositorySearchMetadataLabel
} from "../repository/repositorySearch";
import { readAvailabilityMessage } from "../repository/repositoryUi";

export function TopBar({
  viewer,
  route,
  areas,
  selectedAreaId,
  selectedRepository,
  repositories,
  githubReady,
  onSelectArea,
  onAddLocalArea,
  onAddSshArea,
  onEditArea,
  onDeleteArea,
  onGoRepository,
  onOpenRepository,
  onOpenLocalRepository,
  onOpenAddRepository,
  onOpenCommandPalette,
  onOpenHome,
  onOpenMailbox,
  onOpenSettings
}: {
  viewer: AppState["viewer"];
  route: AppRoute;
  areas: AreaSummary[];
  selectedAreaId: string | null;
  selectedRepository: string | null;
  repositories: RepositorySummary[];
  githubReady: boolean;
  onSelectArea(areaId: string): void;
  onAddLocalArea(): void;
  onAddSshArea(): void;
  onEditArea(area: AreaSummary): void;
  onDeleteArea(area: AreaSummary): void;
  onGoRepository(): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenLocalRepository(repository: AreaRepositorySummary): void;
  onOpenAddRepository(): void;
  onOpenCommandPalette(): void;
  onOpenHome(): void;
  onOpenMailbox(): void;
  onOpenSettings(): void;
}): JSX.Element {
  const api = useControlApi();
  const [query, setQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [localResultLimit, setLocalResultLimit] = useState(defaultRepositorySearchLocalLimit);
  const [remoteSearchLimit, setRemoteSearchLimit] = useState(defaultRepositorySearchRemoteLimit);
  const normalizedQuery = query.trim();
  const localMatches = useMemo(
    () => repositories.filter((repository) => repositoryMatchesQuery(repository, normalizedQuery)),
    [normalizedQuery, repositories]
  );
  const localResults = useMemo(
    () => localMatches.slice(0, localResultLimit),
    [localMatches, localResultLimit]
  );
  const canLoadMoreLocalResults = localResults.length < localMatches.length;
  const loadedRepositoryNames = useMemo(
    () => new Set(repositories.map((repository) => repository.nameWithOwner.toLowerCase())),
    [repositories]
  );
  const search = useQuery({
    queryKey: ["search", normalizedQuery, remoteSearchLimit],
    queryFn: () => api.github.searchWithStatus({ query: normalizedQuery, limit: remoteSearchLimit }),
    enabled: githubReady && normalizedQuery.length > 1
  });
  const searchItems = search.data?.items ?? [];
  const areaSearch = useQuery({
    queryKey: ["area-search", normalizedQuery],
    queryFn: () => api.areas.searchAreas({ query: normalizedQuery, limit: 8 }),
    enabled: normalizedQuery.length > 1
  });
  const areaRepositoryResults = areaSearch.data?.repositories ?? [];
  const searchAvailabilityMessage = readAvailabilityMessage(
    "Repository search",
    search.data?.availability ?? null
  );
  const searchUnavailable = search.data ? search.data.availability.status !== "available" : false;
  const remoteResults = searchItems.filter(
    (repository) => !loadedRepositoryNames.has(repository.nameWithOwner.toLowerCase())
  );
  const canLoadMoreRemoteResults =
    githubReady && remoteSearchLimit < maxRepositoryListLimit && searchItems.length >= remoteSearchLimit;
  const exactRepositoryTarget = repositoryNameWithOwnerInput(normalizedQuery);
  const exactRepositoryResultVisible =
    exactRepositoryTarget !== null &&
    [...localResults, ...remoteResults].some(
      (repository) => repository.nameWithOwner.toLowerCase() === exactRepositoryTarget.toLowerCase()
    );
  const directRepositoryVisible = exactRepositoryTarget !== null && !exactRepositoryResultVisible;
  const searchResults = useMemo(
    () => [
      ...localResults.map((repository) => ({ repository, source: "Local" as const })),
      ...remoteResults.map((repository) => ({ repository, source: "GitHub" as const }))
    ],
    [localResults, remoteResults]
  );
  const directSearchResultCount = directRepositoryVisible ? 1 : 0;
  const searchResultCount = directSearchResultCount + searchResults.length;
  const boundedSearchIndex = Math.max(0, Math.min(activeSearchIndex, Math.max(searchResultCount - 1, 0)));
  const directSearchResultActive = directRepositoryVisible && boundedSearchIndex === 0;
  const activeSearchResult = searchResults[boundedSearchIndex - directSearchResultCount] ?? null;
  const viewerLoading = githubReady && !viewer;
  const repositoryContext =
    route.kind === "repository" || route.kind === "codeBrowser" ? route.nameWithOwner : null;
  const contextButton =
    route.kind === "home"
      ? {
          label: "Home",
          title: "Open Home",
          ariaLabel: "Open Home",
          icon: <Home size={16} />,
          onClick: onOpenHome
        }
      : repositoryContext
        ? {
            label: repositoryContext.split("/")[1] ?? "Repo",
            title: `Open ${repositoryContext}`,
            ariaLabel: `Open ${repositoryContext}`,
            icon: <Code2 size={16} />,
            onClick: onGoRepository
          }
        : {
            label: null,
            title: selectedRepository ? `Open ${selectedRepository}` : "Select repository",
            ariaLabel: selectedRepository ? `Open ${selectedRepository}` : "Select repository",
            icon: <Code2 size={16} />,
            onClick: selectedRepository ? onGoRepository : onOpenCommandPalette
          };

  function openSearchResult(nameWithOwner: string): void {
    onOpenRepository(nameWithOwner);
    setQuery("");
    setActiveSearchIndex(0);
  }

  function openAreaRepositoryResult(repository: AreaRepositorySummary): void {
    onOpenLocalRepository(repository);
    setQuery("");
    setActiveSearchIndex(0);
  }

  return (
    <header className="topbar">
      <div className="titlebar-left">
        <AreaTopbarSelector
          areas={areas}
          selectedAreaId={selectedAreaId}
          onSelectArea={onSelectArea}
          onAddLocalArea={onAddLocalArea}
          onAddSshArea={onAddSshArea}
          onEditArea={onEditArea}
          onDeleteArea={onDeleteArea}
        />
      </div>

      <div className="search-wrap">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveSearchIndex(0);
            setLocalResultLimit(defaultRepositorySearchLocalLimit);
            setRemoteSearchLimit(defaultRepositorySearchRemoteLimit);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
              setActiveSearchIndex(0);
              setLocalResultLimit(defaultRepositorySearchLocalLimit);
              setRemoteSearchLimit(defaultRepositorySearchRemoteLimit);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveSearchIndex(Math.min(boundedSearchIndex + 1, Math.max(searchResultCount - 1, 0)));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveSearchIndex(Math.max(boundedSearchIndex - 1, 0));
              return;
            }
            if (event.key === "Enter" && directSearchResultActive && exactRepositoryTarget) {
              event.preventDefault();
              openSearchResult(exactRepositoryTarget);
              return;
            }
            if (event.key === "Enter" && activeSearchResult) {
              event.preventDefault();
              openSearchResult(activeSearchResult.repository.nameWithOwner);
            }
          }}
          placeholder="Search or jump to..."
          aria-label="Search or jump to"
        />
        <button
          className="search-hotkey-button"
          type="button"
          aria-label="Open command palette"
          onClick={onOpenCommandPalette}
        >
          <kbd>Cmd K</kbd>
        </button>
        {normalizedQuery.length > 1 && (
          <div className="search-popover">
            {directRepositoryVisible && (
              <button
                className={directSearchResultActive ? "active-finder-row" : ""}
                type="button"
                onMouseEnter={() => setActiveSearchIndex(0)}
                onClick={() => openSearchResult(exactRepositoryTarget)}
              >
                <span>{exactRepositoryTarget}</span>
                <small>Open directly · Direct</small>
              </button>
            )}
            {localResults.length > 0 && <div className="palette-section-title">Local repositories</div>}
            {localResults.map((result, index) => (
              <button
                className={boundedSearchIndex === directSearchResultCount + index ? "active-finder-row" : ""}
                key={result.id}
                type="button"
                onMouseEnter={() => setActiveSearchIndex(directSearchResultCount + index)}
                onClick={() => openSearchResult(result.nameWithOwner)}
              >
                <span>{result.nameWithOwner}</span>
                <small>{repositorySearchMetadataLabel(result)} · Local</small>
              </button>
            ))}
            {remoteResults.length > 0 && <div className="palette-section-title">GitHub search</div>}
            {remoteResults.map((result, index) => (
              <button
                className={
                  boundedSearchIndex === directSearchResultCount + localResults.length + index
                    ? "active-finder-row"
                    : ""
                }
                key={result.id}
                type="button"
                onMouseEnter={() =>
                  setActiveSearchIndex(directSearchResultCount + localResults.length + index)
                }
                onClick={() => openSearchResult(result.nameWithOwner)}
              >
                <span>{result.nameWithOwner}</span>
                <small>{repositorySearchMetadataLabel(result)} · GitHub</small>
              </button>
            ))}
            {areaRepositoryResults.length > 0 && <div className="palette-section-title">Areas</div>}
            {areaRepositoryResults.map((result) => (
              <button key={result.id} type="button" onClick={() => openAreaRepositoryResult(result)}>
                <span>{result.displayName}</span>
                <small>
                  {result.kind.toUpperCase()} ·{" "}
                  {result.connection?.nameWithOwner ?? result.path ?? "Local Area"}
                </small>
              </button>
            ))}
            {canLoadMoreLocalResults && (
              <button
                className="show-more"
                type="button"
                onClick={() =>
                  setLocalResultLimit((currentLimit) =>
                    Math.min(currentLimit + defaultRepositorySearchLocalLimit, localMatches.length)
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
                    Math.min(currentLimit + defaultRepositorySearchRemoteLimit, maxRepositoryListLimit)
                  )
                }
              >
                Load more GitHub results
              </button>
            )}
            {search.isFetching && <div className="muted-row">Searching GitHub...</div>}
            {search.error && (
              <div className="error-state">GitHub repository search unavailable: {search.error.message}</div>
            )}
            {searchAvailabilityMessage && <div className="error-state">{searchAvailabilityMessage}</div>}
            {!githubReady && <div className="muted-row">Remote search is unavailable in cached mode.</div>}
            {!search.isFetching &&
              !search.error &&
              !searchUnavailable &&
              !directRepositoryVisible &&
              localResults.length === 0 &&
              remoteResults.length === 0 && <div className="muted-row">No repositories found.</div>}
          </div>
        )}
      </div>

      <div className="top-actions">
        <button
          className="icon-button glass"
          type="button"
          title="Add repository"
          aria-label="Add repository"
          onClick={onOpenAddRepository}
        >
          <Plus size={19} />
        </button>
        <button
          className="icon-button glass"
          type="button"
          title="Notifications"
          aria-label="Notifications"
          onClick={onOpenMailbox}
        >
          <Bell size={18} />
        </button>
        <button
          className={`titlebar-action-button ${contextButton.label ? "" : "icon-only"}`}
          type="button"
          title={contextButton.title}
          aria-label={contextButton.ariaLabel}
          onClick={contextButton.onClick}
        >
          {contextButton.icon}
          {contextButton.label && <span>{contextButton.label}</span>}
        </button>
        <button className="avatar-button" type="button" onClick={onOpenSettings} title="Account settings">
          {viewer?.avatarUrl ? (
            <img src={viewer.avatarUrl} alt="" />
          ) : (
            <span className={`avatar-placeholder ${viewerLoading ? "loading-avatar" : ""}`}>C</span>
          )}
        </button>
      </div>
    </header>
  );
}
