import { Bell, Code2, Home, Plus, Search } from "lucide-react";
import { Fragment, useMemo, useState, type ChangeEvent, type JSX, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AreaRepositorySummary, AreaSummary, AreaWorkspaceSummary } from "@shared/areas";
import type { AppState, RepositorySummary } from "@shared/github";

import { useControlApi } from "../../hooks/useControlApi";
import type { AppRoute } from "../../stores/uiStore";
import { AreaTopbarSelector } from "../areas/AreaTopbarSelector";
import {
  areaHealthLabel,
  areaKindLabel,
  areaRepositorySubtitle,
  workspaceSubtitle
} from "../areas/areaSearchUi";
import {
  defaultRepositorySearchLocalLimit,
  defaultRepositorySearchRemoteLimit,
  maxRepositoryListLimit,
  repositoryMatchesQuery,
  repositoryNameWithOwnerInput,
  repositorySearchMetadataLabel
} from "../repository/repositorySearch";
import { readAvailabilityMessage } from "../repository/repositoryUi";

type TopbarSearchResult =
  | { kind: "directRepository"; nameWithOwner: string }
  | { kind: "githubRepository"; repository: RepositorySummary; source: "Local" | "GitHub" }
  | { kind: "area"; area: AreaSummary }
  | { kind: "areaRepository"; repository: AreaRepositorySummary }
  | { kind: "workspace"; workspace: AreaWorkspaceSummary };

interface TopBarProps {
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
  onOpenWorkspace(workspace: AreaWorkspaceSummary): void;
  onOpenAddRepository(): void;
  onOpenCommandPalette(): void;
  onOpenHome(): void;
  onOpenMailbox(): void;
  onOpenSettings(): void;
}

interface TopbarContextButton {
  label: string | null;
  title: string;
  ariaLabel: string;
  icon: JSX.Element;
  onClick(): void;
}

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
  onOpenWorkspace,
  onOpenAddRepository,
  onOpenCommandPalette,
  onOpenHome,
  onOpenMailbox,
  onOpenSettings
}: TopBarProps): JSX.Element {
  const repositoryContext =
    route.kind === "repository" || route.kind === "codeBrowser" ? route.nameWithOwner : null;
  const contextButton = getTopbarContextButton({
    repositoryContext,
    route,
    selectedRepository,
    onGoRepository,
    onOpenCommandPalette,
    onOpenHome
  });

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

      <TopbarSearch
        areas={areas}
        repositories={repositories}
        githubReady={githubReady}
        onSelectArea={onSelectArea}
        onOpenRepository={onOpenRepository}
        onOpenLocalRepository={onOpenLocalRepository}
        onOpenWorkspace={onOpenWorkspace}
        onOpenCommandPalette={onOpenCommandPalette}
      />

      <TopbarActions
        viewer={viewer}
        viewerLoading={githubReady && !viewer}
        contextButton={contextButton}
        onOpenAddRepository={onOpenAddRepository}
        onOpenMailbox={onOpenMailbox}
        onOpenSettings={onOpenSettings}
      />
    </header>
  );
}

function TopbarSearch({
  areas,
  repositories,
  githubReady,
  onSelectArea,
  onOpenRepository,
  onOpenLocalRepository,
  onOpenWorkspace,
  onOpenCommandPalette
}: {
  areas: AreaSummary[];
  repositories: RepositorySummary[];
  githubReady: boolean;
  onSelectArea(areaId: string): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenLocalRepository(repository: AreaRepositorySummary): void;
  onOpenWorkspace(workspace: AreaWorkspaceSummary): void;
  onOpenCommandPalette(): void;
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
  const loadedRepositoryNames = useMemo(
    () => new Set(repositories.map((repository) => repository.nameWithOwner.toLowerCase())),
    [repositories]
  );
  const search = useQuery({
    queryKey: ["search", normalizedQuery, remoteSearchLimit],
    queryFn: () => api.github.searchWithStatus({ query: normalizedQuery, limit: remoteSearchLimit }),
    enabled: githubReady && normalizedQuery.length > 1
  });
  const areaSearch = useQuery({
    queryKey: ["area-search", normalizedQuery],
    queryFn: () => api.areas.searchAreas({ query: normalizedQuery, limit: 8 }),
    enabled: normalizedQuery.length > 1
  });
  const searchItems = search.data?.items ?? [];
  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const areaRepositoryResults = useMemo(
    () => areaSearch.data?.repositories ?? [],
    [areaSearch.data?.repositories]
  );
  const areaResults = useMemo(() => areaSearch.data?.areas ?? [], [areaSearch.data?.areas]);
  const workspaceResults = useMemo(() => areaSearch.data?.workspaces ?? [], [areaSearch.data?.workspaces]);
  const repositoryById = useMemo(
    () => new Map(areaRepositoryResults.map((repository) => [repository.id, repository])),
    [areaRepositoryResults]
  );
  const searchAvailabilityMessage = readAvailabilityMessage(
    "Repository search",
    search.data?.availability ?? null
  );
  const searchUnavailable = search.data ? search.data.availability.status !== "available" : false;
  const remoteResults = searchItems.filter(
    (repository) => !loadedRepositoryNames.has(repository.nameWithOwner.toLowerCase())
  );
  const canLoadMoreLocalResults = localResults.length < localMatches.length;
  const canLoadMoreRemoteResults =
    githubReady && remoteSearchLimit < maxRepositoryListLimit && searchItems.length >= remoteSearchLimit;
  const exactRepositoryTarget = repositoryNameWithOwnerInput(normalizedQuery);
  const exactRepositoryResultVisible =
    exactRepositoryTarget !== null &&
    [...localResults, ...remoteResults].some(
      (repository) => repository.nameWithOwner.toLowerCase() === exactRepositoryTarget.toLowerCase()
    );
  const directRepositoryVisible = exactRepositoryTarget !== null && !exactRepositoryResultVisible;
  const searchResults = useMemo<TopbarSearchResult[]>(
    () => [
      ...(directRepositoryVisible && exactRepositoryTarget
        ? [{ kind: "directRepository" as const, nameWithOwner: exactRepositoryTarget }]
        : []),
      ...localResults.map((repository) => ({
        kind: "githubRepository" as const,
        repository,
        source: "Local" as const
      })),
      ...remoteResults.map((repository) => ({
        kind: "githubRepository" as const,
        repository,
        source: "GitHub" as const
      })),
      ...areaResults.map((area) => ({ kind: "area" as const, area })),
      ...areaRepositoryResults.map((repository) => ({ kind: "areaRepository" as const, repository })),
      ...workspaceResults.map((workspace) => ({ kind: "workspace" as const, workspace }))
    ],
    [
      areaRepositoryResults,
      areaResults,
      directRepositoryVisible,
      exactRepositoryTarget,
      localResults,
      remoteResults,
      workspaceResults
    ]
  );
  const searchResultCount = searchResults.length;
  const boundedSearchIndex = Math.max(0, Math.min(activeSearchIndex, Math.max(searchResultCount - 1, 0)));
  const activeSearchResult = searchResults[boundedSearchIndex] ?? null;

  function resetSearchState(): void {
    setQuery("");
    setActiveSearchIndex(0);
    setLocalResultLimit(defaultRepositorySearchLocalLimit);
    setRemoteSearchLimit(defaultRepositorySearchRemoteLimit);
  }

  function openRepositorySearchResult(nameWithOwner: string): void {
    onOpenRepository(nameWithOwner);
    resetSearchState();
  }

  function openTopbarSearchResult(result: TopbarSearchResult): void {
    if (result.kind === "directRepository") {
      openRepositorySearchResult(result.nameWithOwner);
      return;
    }
    if (result.kind === "githubRepository") {
      openRepositorySearchResult(result.repository.nameWithOwner);
      return;
    }
    if (result.kind === "area") {
      onSelectArea(result.area.id);
      resetSearchState();
      return;
    }
    if (result.kind === "areaRepository") {
      onOpenLocalRepository(result.repository);
      resetSearchState();
      return;
    }
    onOpenWorkspace(result.workspace);
    resetSearchState();
  }

  function changeQuery(event: ChangeEvent<HTMLInputElement>): void {
    setQuery(event.target.value);
    setActiveSearchIndex(0);
    setLocalResultLimit(defaultRepositorySearchLocalLimit);
    setRemoteSearchLimit(defaultRepositorySearchRemoteLimit);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      resetSearchState();
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
    if (event.key === "Enter" && activeSearchResult) {
      event.preventDefault();
      openTopbarSearchResult(activeSearchResult);
    }
  }

  function loadMoreLocalResults(): void {
    setLocalResultLimit((currentLimit) =>
      Math.min(currentLimit + defaultRepositorySearchLocalLimit, localMatches.length)
    );
  }

  function loadMoreRemoteResults(): void {
    setRemoteSearchLimit((currentLimit) =>
      Math.min(currentLimit + defaultRepositorySearchRemoteLimit, maxRepositoryListLimit)
    );
  }

  return (
    <div className="search-wrap">
      <Search size={17} />
      <input
        value={query}
        onChange={changeQuery}
        onKeyDown={handleSearchKeyDown}
        placeholder="Search or jump to…"
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
        <TopbarSearchPopover
          searchResults={searchResults}
          boundedSearchIndex={boundedSearchIndex}
          areaById={areaById}
          repositoryById={repositoryById}
          canLoadMoreLocalResults={canLoadMoreLocalResults}
          canLoadMoreRemoteResults={canLoadMoreRemoteResults}
          searchFetching={search.isFetching}
          searchError={search.error}
          searchAvailabilityMessage={searchAvailabilityMessage}
          searchUnavailable={searchUnavailable}
          githubReady={githubReady}
          directRepositoryVisible={directRepositoryVisible}
          localResultsCount={localResults.length}
          remoteResultsCount={remoteResults.length}
          areaResultsCount={areaResults.length}
          areaRepositoryResultsCount={areaRepositoryResults.length}
          workspaceResultsCount={workspaceResults.length}
          onActivateSearchResult={setActiveSearchIndex}
          onOpenSearchResult={openTopbarSearchResult}
          onLoadMoreLocalResults={loadMoreLocalResults}
          onLoadMoreRemoteResults={loadMoreRemoteResults}
        />
      )}
    </div>
  );
}

function TopbarSearchPopover({
  searchResults,
  boundedSearchIndex,
  areaById,
  repositoryById,
  canLoadMoreLocalResults,
  canLoadMoreRemoteResults,
  searchFetching,
  searchError,
  searchAvailabilityMessage,
  searchUnavailable,
  githubReady,
  directRepositoryVisible,
  localResultsCount,
  remoteResultsCount,
  areaResultsCount,
  areaRepositoryResultsCount,
  workspaceResultsCount,
  onActivateSearchResult,
  onOpenSearchResult,
  onLoadMoreLocalResults,
  onLoadMoreRemoteResults
}: {
  searchResults: TopbarSearchResult[];
  boundedSearchIndex: number;
  areaById: Map<string, AreaSummary>;
  repositoryById: Map<string, AreaRepositorySummary>;
  canLoadMoreLocalResults: boolean;
  canLoadMoreRemoteResults: boolean;
  searchFetching: boolean;
  searchError: Error | null;
  searchAvailabilityMessage: string | null;
  searchUnavailable: boolean;
  githubReady: boolean;
  directRepositoryVisible: boolean;
  localResultsCount: number;
  remoteResultsCount: number;
  areaResultsCount: number;
  areaRepositoryResultsCount: number;
  workspaceResultsCount: number;
  onActivateSearchResult(index: number): void;
  onOpenSearchResult(result: TopbarSearchResult): void;
  onLoadMoreLocalResults(): void;
  onLoadMoreRemoteResults(): void;
}): JSX.Element {
  const hasNoResults =
    !searchFetching &&
    !searchError &&
    !searchUnavailable &&
    !directRepositoryVisible &&
    localResultsCount === 0 &&
    remoteResultsCount === 0 &&
    areaResultsCount === 0 &&
    areaRepositoryResultsCount === 0 &&
    workspaceResultsCount === 0;

  return (
    <div className="search-popover">
      {searchResults.map((result, index) => (
        <TopbarSearchResultRow
          key={topbarResultKey(result)}
          result={result}
          previousResult={index > 0 ? searchResults[index - 1] : null}
          index={index}
          active={boundedSearchIndex === index}
          areaById={areaById}
          repositoryById={repositoryById}
          onActivateSearchResult={onActivateSearchResult}
          onOpenSearchResult={onOpenSearchResult}
        />
      ))}
      {canLoadMoreLocalResults && (
        <button className="show-more" type="button" onClick={onLoadMoreLocalResults}>
          Load more local results
        </button>
      )}
      {canLoadMoreRemoteResults && (
        <button className="show-more" type="button" onClick={onLoadMoreRemoteResults}>
          Load more GitHub results
        </button>
      )}
      {searchFetching && <div className="muted-row">Searching GitHub…</div>}
      {searchError && (
        <div className="error-state">GitHub repository search unavailable: {searchError.message}</div>
      )}
      {searchAvailabilityMessage && <div className="error-state">{searchAvailabilityMessage}</div>}
      {!githubReady && <div className="muted-row">Remote search is unavailable in cached mode.</div>}
      {hasNoResults && <div className="muted-row">No repositories found.</div>}
    </div>
  );
}

function TopbarSearchResultRow({
  result,
  previousResult,
  index,
  active,
  areaById,
  repositoryById,
  onActivateSearchResult,
  onOpenSearchResult
}: {
  result: TopbarSearchResult;
  previousResult: TopbarSearchResult | null;
  index: number;
  active: boolean;
  areaById: Map<string, AreaSummary>;
  repositoryById: Map<string, AreaRepositorySummary>;
  onActivateSearchResult(index: number): void;
  onOpenSearchResult(result: TopbarSearchResult): void;
}): JSX.Element {
  const group = topbarResultGroup(result);
  const previousGroup = previousResult ? topbarResultGroup(previousResult) : null;

  function activateResult(): void {
    onActivateSearchResult(index);
  }

  function openResult(): void {
    onOpenSearchResult(result);
  }

  return (
    <Fragment>
      {group !== previousGroup && <div className="palette-section-title">{group}</div>}
      <button
        className={active ? "active-finder-row" : ""}
        type="button"
        onMouseEnter={activateResult}
        onClick={openResult}
      >
        <span>{topbarResultTitle(result)}</span>
        <small>{topbarResultSubtitle(result, areaById, repositoryById)}</small>
      </button>
    </Fragment>
  );
}

function TopbarActions({
  viewer,
  viewerLoading,
  contextButton,
  onOpenAddRepository,
  onOpenMailbox,
  onOpenSettings
}: {
  viewer: AppState["viewer"];
  viewerLoading: boolean;
  contextButton: TopbarContextButton;
  onOpenAddRepository(): void;
  onOpenMailbox(): void;
  onOpenSettings(): void;
}): JSX.Element {
  return (
    <div className="top-actions">
      <button
        className="icon-button glass"
        type="button"
        title="Create"
        aria-label="Create"
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
  );
}

function getTopbarContextButton({
  repositoryContext,
  route,
  selectedRepository,
  onGoRepository,
  onOpenCommandPalette,
  onOpenHome
}: {
  repositoryContext: string | null;
  route: AppRoute;
  selectedRepository: string | null;
  onGoRepository(): void;
  onOpenCommandPalette(): void;
  onOpenHome(): void;
}): TopbarContextButton {
  if (repositoryContext) {
    return {
      label: repositoryContext.split("/")[1] ?? "Repo",
      title: `Open ${repositoryContext}`,
      ariaLabel: `Open ${repositoryContext}`,
      icon: <Code2 size={16} />,
      onClick: onGoRepository
    };
  }
  if (selectedRepository) {
    return {
      label: selectedRepository.split("/")[1] ?? "Repo",
      title: `Open ${selectedRepository}`,
      ariaLabel: `Open ${selectedRepository}`,
      icon: <Code2 size={16} />,
      onClick: onGoRepository
    };
  }
  if (route.kind === "home") {
    return {
      label: "Home",
      title: "Open Home",
      ariaLabel: "Open Home",
      icon: <Home size={16} />,
      onClick: onOpenHome
    };
  }
  return {
    label: null,
    title: "Select repository",
    ariaLabel: "Select repository",
    icon: <Code2 size={16} />,
    onClick: onOpenCommandPalette
  };
}

function topbarResultKey(result: TopbarSearchResult): string {
  switch (result.kind) {
    case "directRepository":
      return `direct-${result.nameWithOwner}`;
    case "githubRepository":
      return `github-${result.source}-${result.repository.id}`;
    case "area":
      return `area-${result.area.id}`;
    case "areaRepository":
      return `area-repository-${result.repository.areaId}-${result.repository.id}`;
    case "workspace":
      return `workspace-${result.workspace.areaId}-${result.workspace.repositoryId}-${result.workspace.id}`;
  }
}

function topbarResultTitle(result: TopbarSearchResult): string {
  switch (result.kind) {
    case "directRepository":
      return result.nameWithOwner;
    case "githubRepository":
      return result.repository.nameWithOwner;
    case "area":
      return result.area.label;
    case "areaRepository":
      return result.repository.displayName;
    case "workspace":
      return result.workspace.name;
  }
}

function topbarResultSubtitle(
  result: TopbarSearchResult,
  areaById: Map<string, AreaSummary>,
  repositoryById: Map<string, AreaRepositorySummary>
): string {
  switch (result.kind) {
    case "directRepository":
      return "Open directly · Direct";
    case "githubRepository":
      return `${repositorySearchMetadataLabel(result.repository)} · ${result.source}`;
    case "area": {
      const health = areaHealthLabel(result.area.health);
      return [areaKindLabel(result.area.kind), result.area.subtitle ?? result.area.rootPath, health]
        .filter(Boolean)
        .join(" · ");
    }
    case "areaRepository":
      return areaRepositorySubtitle(result.repository, areaById);
    case "workspace":
      return workspaceSubtitle(result.workspace, repositoryById, areaById);
  }
}

function topbarResultGroup(result: TopbarSearchResult): string {
  switch (result.kind) {
    case "directRepository":
      return "Direct";
    case "githubRepository":
      return result.source === "Local" ? "Local repositories" : "GitHub search";
    case "area":
      return "Areas";
    case "areaRepository":
      return "Area repositories";
    case "workspace":
      return "Workspaces";
  }
}
