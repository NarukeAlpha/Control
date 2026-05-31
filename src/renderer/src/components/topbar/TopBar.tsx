import { Bell, Code2, Home, Plus, Search } from "lucide-react";
import { Fragment, useMemo, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AreaRepositorySummary, AreaSummary, AreaWorkspaceSummary } from "@shared/areas";
import type { AppState, RepositorySummary } from "@shared/github";

import { useControlApi } from "../../hooks/useControlApi";
import type { AppRoute } from "../../stores/uiStore";
import { AreaTopbarSelector } from "../areas/AreaTopbarSelector";
import {
  areaHealthLabel,
  areaRepositorySubtitle,
  areaKindLabel,
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
  onOpenWorkspace(workspace: AreaWorkspaceSummary): void;
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
  const viewerLoading = githubReady && !viewer;
  const repositoryContext =
    route.kind === "repository" || route.kind === "codeBrowser" ? route.nameWithOwner : null;
  const contextButton = repositoryContext
    ? {
        label: repositoryContext.split("/")[1] ?? "Repo",
        title: `Open ${repositoryContext}`,
        ariaLabel: `Open ${repositoryContext}`,
        icon: <Code2 size={16} />,
        onClick: onGoRepository
      }
    : selectedRepository
      ? {
          label: selectedRepository.split("/")[1] ?? "Repo",
          title: `Open ${selectedRepository}`,
          ariaLabel: `Open ${selectedRepository}`,
          icon: <Code2 size={16} />,
          onClick: onGoRepository
        }
      : route.kind === "home"
        ? {
            label: "Home",
            title: "Open Home",
            ariaLabel: "Open Home",
            icon: <Home size={16} />,
            onClick: onOpenHome
          }
        : {
            label: null,
            title: "Select repository",
            ariaLabel: "Select repository",
            icon: <Code2 size={16} />,
            onClick: onOpenCommandPalette
          };

  function openSearchResult(nameWithOwner: string): void {
    onOpenRepository(nameWithOwner);
    setQuery("");
    setActiveSearchIndex(0);
  }

  function openTopbarSearchResult(result: TopbarSearchResult): void {
    if (result.kind === "directRepository") {
      openSearchResult(result.nameWithOwner);
      return;
    }
    if (result.kind === "githubRepository") {
      openSearchResult(result.repository.nameWithOwner);
      return;
    }
    if (result.kind === "area") {
      onSelectArea(result.area.id);
      setQuery("");
      setActiveSearchIndex(0);
      return;
    }
    if (result.kind === "areaRepository") {
      onOpenLocalRepository(result.repository);
      setQuery("");
      setActiveSearchIndex(0);
      return;
    }
    onOpenWorkspace(result.workspace);
    setQuery("");
    setActiveSearchIndex(0);
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

  function topbarResultSubtitle(result: TopbarSearchResult): string {
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
            if (event.key === "Enter" && activeSearchResult) {
              event.preventDefault();
              openTopbarSearchResult(activeSearchResult);
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
            {searchResults.map((result, index) => {
              const group = topbarResultGroup(result);
              const previousGroup = index > 0 ? topbarResultGroup(searchResults[index - 1]) : null;
              return (
                <Fragment key={topbarResultKey(result)}>
                  {group !== previousGroup && <div className="palette-section-title">{group}</div>}
                  <button
                    className={boundedSearchIndex === index ? "active-finder-row" : ""}
                    type="button"
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => openTopbarSearchResult(result)}
                  >
                    <span>{topbarResultTitle(result)}</span>
                    <small>{topbarResultSubtitle(result)}</small>
                  </button>
                </Fragment>
              );
            })}
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
              remoteResults.length === 0 &&
              areaResults.length === 0 &&
              areaRepositoryResults.length === 0 &&
              workspaceResults.length === 0 && <div className="muted-row">No repositories found.</div>}
          </div>
        )}
      </div>

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
    </header>
  );
}
