import {
  Building2,
  Code2,
  ExternalLink,
  Home,
  Inbox,
  Lock,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  X
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

import type { AreaRepositorySummary, AreaSummary } from "@shared/areas";
import type { AppState, GitHubAccountProfile, RepositorySummary } from "@shared/github";
import type { RepositoryPinRecord } from "@shared/local";

import { areaRepositoryPinKey, isGatewayAreaKind } from "../areas/areaUi";
import {
  displayRepositoryShortcutName,
  maxRepositoryListLimit,
  repositoryMatchesQuery,
  repositoryNameWithOwnerInput,
  repositoryShortcutFromName,
  repositoryShortcutsFromPins,
  sidebarRepositoryMetadataParts,
  type RepositoryShortcut
} from "../repository/repositorySearch";
import { readAvailabilityMessage } from "../repository/repositoryUi";
import { useControlApi } from "../../hooks/useControlApi";
import { useUiStore, type AppRoute } from "../../stores/uiStore";

const navigation = [
  { key: "home", label: "Home", icon: Home },
  { key: "repositories", label: "Repositories", icon: Code2 },
  { key: "organizations", label: "Organizations", icon: Building2 },
  { key: "mailbox", label: "Mailbox", icon: Inbox }
] as const;
const githubOnlyNavigationKeys = new Set<(typeof navigation)[number]["key"]>(["organizations", "mailbox"]);

interface SidebarProps {
  appState?: AppState;
  profile?: GitHubAccountProfile;
  areas: AreaSummary[];
  selectedAreaId: string | null;
  localRepositories: AreaRepositorySummary[];
  localRepositoriesLoading: boolean;
  repositories: RepositorySummary[];
  repositoriesLoading: boolean;
  repositoriesError: Error | null;
  repositoriesAvailabilityMessage: string | null;
  pinnedRepositoryNames: string[];
  repositoryPinRecords: RepositoryPinRecord[];
  selectedRepository: string;
  route: AppRoute;
  onSelectLocalRepository(repository: AreaRepositorySummary): void;
  onSelectRepository(nameWithOwner: string): void;
  onOpenRepositorySearch(): void;
  onOpenAddRepository(): void;
  onOpenSettings(): void;
}

type SidebarRepositorySource = "Local" | "GitHub" | null;

interface SidebarRepositoryItem {
  repository: RepositoryShortcut;
  source: SidebarRepositorySource;
}

type SidebarRepositoryVirtualizer = ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
type SidebarRepositoryRenderModel = Omit<SidebarRepositoryModel, "parentRef" | "virtualizer">;

interface SidebarRepositoryModel {
  parentRef: React.RefObject<HTMLDivElement | null>;
  virtualizer: SidebarRepositoryVirtualizer;
  repositoryFilter: string;
  normalizedRepositoryFilter: string;
  selectedLocalRepositoryId: string | null;
  viewerLogin: string | null;
  browsingLocalArea: boolean;
  selectedAreaSupportsGitHubNavigation: boolean;
  matchingAreaRepositories: AreaRepositorySummary[];
  areaPinnedRepositoryKeys: Set<string>;
  sidebarRepositories: SidebarRepositoryItem[];
  repositorySectionTitle: string;
  localRepositoriesLoading: boolean;
  repositoriesLoading: boolean;
  repositoriesError: Error | null;
  repositoriesAvailabilityMessage: string | null;
  remoteSearchFetching: boolean;
  remoteSearchError: unknown;
  remoteSearchAvailabilityMessage: string | null;
  remoteSearchUnavailable: boolean;
  showCachedRepositorySearchStatus: boolean;
  remoteSearchMayBeCapped: boolean;
  directRepositoryVisible: boolean;
  exactRepositoryTarget: string | null;
  localRepositoryLimit: number;
  matchingLocalRepositoriesCount: number;
  canLoadMoreLocalRepositories: boolean;
  showingAllLoadedLocalRepositories: boolean;
  localRepositoryListLimitReached: boolean;
  canLoadMoreLocalSearchResults: boolean;
  showingAllLoadedLocalSearchResults: boolean;
  localSearchListLimitReached: boolean;
  canLoadMoreRemoteSearchResults: boolean;
  onRepositoryFilterChange(value: string): void;
  onClearRepositoryFilter(): void;
  onLoadMoreLocalRepositories(): void;
  onLoadMoreLocalSearchResults(): void;
  onLoadMoreRemoteSearchResults(): void;
}

function isNavigationActive(route: AppRoute, label: string): boolean {
  if (label === "Home") {
    return route.kind === "home";
  }
  if (label === "Repositories") {
    return route.kind === "repositories";
  }
  if (label === "Organizations") {
    return route.kind === "organizations";
  }
  if (label === "Mailbox") {
    return route.kind === "mailbox";
  }
  return false;
}

export function Sidebar({
  appState,
  profile,
  areas,
  selectedAreaId,
  localRepositories,
  localRepositoriesLoading,
  repositories,
  repositoriesLoading,
  repositoriesError,
  repositoriesAvailabilityMessage,
  pinnedRepositoryNames,
  repositoryPinRecords,
  selectedRepository,
  route,
  onSelectLocalRepository,
  onSelectRepository,
  onOpenRepositorySearch,
  onOpenAddRepository,
  onOpenSettings
}: SidebarProps): JSX.Element {
  const repositoryModel = useSidebarRepositoryModel({
    appState,
    profile,
    areas,
    selectedAreaId,
    localRepositories,
    localRepositoriesLoading,
    repositories,
    repositoriesLoading,
    repositoriesError,
    repositoriesAvailabilityMessage,
    pinnedRepositoryNames,
    repositoryPinRecords,
    route
  });

  return (
    <aside className="sidebar">
      <SidebarNavigation
        route={route}
        selectedAreaSupportsGitHubNavigation={repositoryModel.selectedAreaSupportsGitHubNavigation}
      />
      <SidebarRepositorySection
        model={repositoryModel}
        selectedRepository={selectedRepository}
        onSelectLocalRepository={onSelectLocalRepository}
        onSelectRepository={onSelectRepository}
        onOpenRepositorySearch={onOpenRepositorySearch}
        onOpenAddRepository={onOpenAddRepository}
      />
      <SidebarFooter appState={appState} profile={profile} onOpenSettings={onOpenSettings} />
    </aside>
  );
}

function useSidebarRepositoryModel({
  appState,
  profile,
  areas,
  selectedAreaId,
  localRepositories,
  localRepositoriesLoading,
  repositories,
  repositoriesLoading,
  repositoriesError,
  repositoriesAvailabilityMessage,
  pinnedRepositoryNames,
  repositoryPinRecords,
  route
}: Pick<
  SidebarProps,
  | "appState"
  | "profile"
  | "areas"
  | "selectedAreaId"
  | "localRepositories"
  | "localRepositoriesLoading"
  | "repositories"
  | "repositoriesLoading"
  | "repositoriesError"
  | "repositoriesAvailabilityMessage"
  | "pinnedRepositoryNames"
  | "repositoryPinRecords"
  | "route"
>): SidebarRepositoryModel {
  const api = useControlApi();
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [localRepositoryDisplayLimit, setLocalRepositoryDisplayLimit] = useState(6);
  const [localRepositorySearchLimit, setLocalRepositorySearchLimit] = useState(50);
  const [remoteRepositorySearchLimit, setRemoteRepositorySearchLimit] = useState(8);
  const viewerLogin = appState?.viewer?.login ?? profile?.login ?? null;
  const githubReady = Boolean(appState?.github.authenticated);
  const selectedAreaSummary =
    areas.find((area) => area.id === selectedAreaId) ??
    areas.find((area) => area.selected) ??
    areas.find((area) => area.kind === "github") ??
    null;
  const browsingLocalArea = isGatewayAreaKind(selectedAreaSummary?.kind);
  const selectedAreaSupportsGitHubNavigation =
    selectedAreaSummary === null || selectedAreaSummary.kind === "github";
  const selectedLocalRepositoryId = route.kind === "localRepository" ? route.repositoryId : null;
  const localPinnedRepositories = repositoryShortcutsFromPins(pinnedRepositoryNames, repositories);
  const trimmedRepositoryFilter = repositoryFilter.trim();
  const normalizedRepositoryFilter = trimmedRepositoryFilter.toLowerCase();
  const localRepositoryLimit = Math.min(repositories.length, maxRepositoryListLimit);
  const matchingLocalRepositories = useMemo(
    () =>
      normalizedRepositoryFilter
        ? repositories.filter((repository) => repositoryMatchesQuery(repository, normalizedRepositoryFilter))
        : [],
    [normalizedRepositoryFilter, repositories]
  );
  const visibleLocalSearchLimit = Math.min(
    localRepositorySearchLimit,
    matchingLocalRepositories.length,
    maxRepositoryListLimit
  );
  const matchingRepositories = useMemo(
    () =>
      matchingLocalRepositories
        .slice(0, visibleLocalSearchLimit)
        .map((repository) => repositoryShortcutFromName(repository.nameWithOwner, repository)),
    [matchingLocalRepositories, visibleLocalSearchLimit]
  );
  const areaPinnedRepositoryKeys = useMemo(
    () =>
      new Set(
        repositoryPinRecords.map((pin) => areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId))
      ),
    [repositoryPinRecords]
  );
  const matchingAreaRepositories = useMemo(() => {
    const filteredRepositories = normalizedRepositoryFilter
      ? localRepositories.filter((repository) =>
          [
            repository.displayName,
            repository.name,
            repository.path,
            repository.connection?.nameWithOwner
          ].some((value) => value?.toLowerCase().includes(normalizedRepositoryFilter))
        )
      : localRepositories;
    return sortedAreaRepositories(filteredRepositories, areaPinnedRepositoryKeys);
  }, [areaPinnedRepositoryKeys, localRepositories, normalizedRepositoryFilter]);
  const localRepositoryNames = useMemo(
    () => new Set(repositories.map((repository) => repository.nameWithOwner.toLowerCase())),
    [repositories]
  );
  const localMatchNames = useMemo(
    () => new Set(matchingRepositories.map((repository) => repository.nameWithOwner.toLowerCase())),
    [matchingRepositories]
  );
  const remoteSearch = useQuery({
    queryKey: ["sidebar-repository-search", trimmedRepositoryFilter, remoteRepositorySearchLimit],
    queryFn: () =>
      api.github.searchWithStatus({ query: trimmedRepositoryFilter, limit: remoteRepositorySearchLimit }),
    enabled: !browsingLocalArea && githubReady && trimmedRepositoryFilter.length > 1
  });
  const remoteSearchItems = remoteSearch.data?.items ?? [];
  const remoteSearchAvailabilityMessage = readAvailabilityMessage(
    "Repository search",
    remoteSearch.data?.availability ?? null
  );
  const remoteSearchUnavailable = remoteSearch.data
    ? remoteSearch.data.availability.status !== "available"
    : false;
  const remoteRepositories = remoteSearchItems.filter((repository) => {
    const repositoryName = repository.nameWithOwner.toLowerCase();
    return !localRepositoryNames.has(repositoryName) && !localMatchNames.has(repositoryName);
  });
  const exactRepositoryTarget = repositoryNameWithOwnerInput(trimmedRepositoryFilter);
  const directRepositoryVisible =
    !browsingLocalArea &&
    exactRepositoryTarget !== null &&
    !localRepositoryNames.has(exactRepositoryTarget.toLowerCase()) &&
    ![...matchingRepositories, ...remoteRepositories].some(
      (repository) => repository.nameWithOwner.toLowerCase() === exactRepositoryTarget.toLowerCase()
    );
  const defaultSidebarRepositories = localPinnedRepositories.length
    ? localPinnedRepositories
    : repositories
        .slice(0, Math.min(localRepositoryDisplayLimit, localRepositoryLimit))
        .map((repository) => repositoryShortcutFromName(repository.nameWithOwner, repository));
  const sidebarRepositories = browsingLocalArea
    ? []
    : normalizedRepositoryFilter
      ? [
          ...matchingRepositories.map((repository) => ({ repository, source: "Local" as const })),
          ...remoteRepositories.map((repository) => ({
            repository: repositoryShortcutFromName(repository.nameWithOwner, repository),
            source: "GitHub" as const
          }))
        ]
      : defaultSidebarRepositories.map((repository) => ({ repository, source: null }));
  const repositorySectionTitle = browsingLocalArea
    ? "Local repositories"
    : normalizedRepositoryFilter
      ? "Repository search"
      : localPinnedRepositories.length
        ? "Pinned repositories"
        : "Repositories";
  const showCachedRepositorySearchStatus =
    normalizedRepositoryFilter.length > 0 && !githubReady && !remoteSearch.isFetching;
  const canLoadMoreLocalRepositories =
    !browsingLocalArea &&
    !normalizedRepositoryFilter &&
    localPinnedRepositories.length === 0 &&
    localRepositoryDisplayLimit < localRepositoryLimit;
  const showingAllLoadedLocalRepositories =
    !browsingLocalArea &&
    !normalizedRepositoryFilter &&
    localPinnedRepositories.length === 0 &&
    repositories.length > 0 &&
    repositories.length <= maxRepositoryListLimit &&
    localRepositoryDisplayLimit >= localRepositoryLimit;
  const localRepositoryListLimitReached =
    !browsingLocalArea &&
    !normalizedRepositoryFilter &&
    localPinnedRepositories.length === 0 &&
    repositories.length > maxRepositoryListLimit &&
    localRepositoryDisplayLimit >= maxRepositoryListLimit;
  const canLoadMoreLocalSearchResults =
    !browsingLocalArea &&
    normalizedRepositoryFilter.length > 0 &&
    visibleLocalSearchLimit < Math.min(matchingLocalRepositories.length, maxRepositoryListLimit);
  const showingAllLoadedLocalSearchResults =
    !browsingLocalArea &&
    normalizedRepositoryFilter.length > 0 &&
    matchingLocalRepositories.length > 0 &&
    matchingLocalRepositories.length <= maxRepositoryListLimit &&
    visibleLocalSearchLimit >= Math.min(matchingLocalRepositories.length, maxRepositoryListLimit);
  const localSearchListLimitReached =
    !browsingLocalArea &&
    normalizedRepositoryFilter.length > 0 &&
    matchingLocalRepositories.length > maxRepositoryListLimit &&
    visibleLocalSearchLimit >= maxRepositoryListLimit;
  const remoteSearchMayBeCapped =
    !browsingLocalArea &&
    githubReady &&
    normalizedRepositoryFilter.length > 0 &&
    !remoteSearch.isFetching &&
    !remoteSearch.isError &&
    remoteSearchItems.length >= remoteRepositorySearchLimit;
  const canLoadMoreRemoteSearchResults =
    remoteSearchMayBeCapped && remoteRepositorySearchLimit < maxRepositoryListLimit;
  const virtualizer = useVirtualizer({
    count: sidebarRepositories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8
  });

  function resetRepositorySearchLimits(): void {
    setLocalRepositorySearchLimit(50);
    setRemoteRepositorySearchLimit(8);
  }

  function changeRepositoryFilter(value: string): void {
    setRepositoryFilter(value);
    resetRepositorySearchLimits();
  }

  function clearRepositoryFilter(): void {
    setRepositoryFilter("");
    resetRepositorySearchLimits();
  }

  function loadMoreLocalRepositories(): void {
    setLocalRepositoryDisplayLimit((currentLimit) => Math.min(currentLimit + 6, localRepositoryLimit));
  }

  function loadMoreLocalSearchResults(): void {
    setLocalRepositorySearchLimit((currentLimit) =>
      Math.min(currentLimit + 50, matchingLocalRepositories.length, maxRepositoryListLimit)
    );
  }

  function loadMoreRemoteSearchResults(): void {
    setRemoteRepositorySearchLimit((currentLimit) => Math.min(currentLimit + 8, maxRepositoryListLimit));
  }

  return {
    parentRef,
    virtualizer,
    repositoryFilter,
    normalizedRepositoryFilter,
    selectedLocalRepositoryId,
    viewerLogin,
    browsingLocalArea,
    selectedAreaSupportsGitHubNavigation,
    matchingAreaRepositories,
    areaPinnedRepositoryKeys,
    sidebarRepositories,
    repositorySectionTitle,
    localRepositoriesLoading,
    repositoriesLoading,
    repositoriesError,
    repositoriesAvailabilityMessage,
    remoteSearchFetching: remoteSearch.isFetching,
    remoteSearchError: remoteSearch.error,
    remoteSearchAvailabilityMessage,
    remoteSearchUnavailable,
    showCachedRepositorySearchStatus,
    remoteSearchMayBeCapped,
    directRepositoryVisible,
    exactRepositoryTarget,
    localRepositoryLimit,
    matchingLocalRepositoriesCount: matchingLocalRepositories.length,
    canLoadMoreLocalRepositories,
    showingAllLoadedLocalRepositories,
    localRepositoryListLimitReached,
    canLoadMoreLocalSearchResults,
    showingAllLoadedLocalSearchResults,
    localSearchListLimitReached,
    canLoadMoreRemoteSearchResults,
    onRepositoryFilterChange: changeRepositoryFilter,
    onClearRepositoryFilter: clearRepositoryFilter,
    onLoadMoreLocalRepositories: loadMoreLocalRepositories,
    onLoadMoreLocalSearchResults: loadMoreLocalSearchResults,
    onLoadMoreRemoteSearchResults: loadMoreRemoteSearchResults
  };
}

function SidebarNavigation({
  route,
  selectedAreaSupportsGitHubNavigation
}: {
  route: AppRoute;
  selectedAreaSupportsGitHubNavigation: boolean;
}): JSX.Element {
  const goHome = useUiStore((state) => state.goHome);
  const goToRepositories = useUiStore((state) => state.goToRepositories);
  const goToOrganizations = useUiStore((state) => state.goToOrganizations);
  const goToMailbox = useUiStore((state) => state.goToMailbox);
  const visibleNavigation = navigation.filter(
    (item) => !githubOnlyNavigationKeys.has(item.key) || selectedAreaSupportsGitHubNavigation
  );

  function openNavigationItem(key: (typeof navigation)[number]["key"]): void {
    if (key === "home") {
      goHome();
      return;
    }
    if (key === "repositories") {
      goToRepositories();
      return;
    }
    if (key === "organizations") {
      goToOrganizations();
      return;
    }
    goToMailbox();
  }

  return (
    <nav className="nav-list">
      {visibleNavigation.map((item) => (
        <SidebarNavigationItem
          key={item.label}
          item={item}
          active={isNavigationActive(route, item.label)}
          onOpen={openNavigationItem}
        />
      ))}
    </nav>
  );
}

function sortedAreaRepositories(
  repositories: AreaRepositorySummary[],
  pinnedKeys: Set<string>
): AreaRepositorySummary[] {
  const sorted = Array.from(repositories);

  sorted.sort((left, right) => {
    const leftPinned = pinnedKeys.has(areaRepositoryPinKey(left.areaId, left.id, null));
    const rightPinned = pinnedKeys.has(areaRepositoryPinKey(right.areaId, right.id, null));
    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }
    return left.displayName.localeCompare(right.displayName);
  });

  return sorted;
}

function SidebarNavigationItem({
  item,
  active,
  onOpen
}: {
  item: (typeof navigation)[number];
  active: boolean;
  onOpen(key: (typeof navigation)[number]["key"]): void;
}): JSX.Element {
  const Icon = item.icon;

  function openItem(): void {
    onOpen(item.key);
  }

  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      type="button"
      onClick={openItem}
      title={item.label}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </button>
  );
}

function SidebarRepositorySection({
  model,
  selectedRepository,
  onSelectLocalRepository,
  onSelectRepository,
  onOpenRepositorySearch,
  onOpenAddRepository
}: {
  model: SidebarRepositoryModel;
  selectedRepository: string;
  onSelectLocalRepository(repository: AreaRepositorySummary): void;
  onSelectRepository(nameWithOwner: string): void;
  onOpenRepositorySearch(): void;
  onOpenAddRepository(): void;
}): JSX.Element {
  return (
    <section className="repo-section">
      <SidebarRepositoryHeader
        title={model.repositorySectionTitle}
        onOpenRepositorySearch={onOpenRepositorySearch}
        onOpenAddRepository={onOpenAddRepository}
      />
      <SidebarRepositoryFilter
        value={model.repositoryFilter}
        onChange={model.onRepositoryFilterChange}
        onClear={model.onClearRepositoryFilter}
      />
      <SidebarRepositoryList
        model={model}
        selectedRepository={selectedRepository}
        onSelectLocalRepository={onSelectLocalRepository}
        onSelectRepository={onSelectRepository}
      />
    </section>
  );
}

function SidebarRepositoryHeader({
  title,
  onOpenRepositorySearch,
  onOpenAddRepository
}: {
  title: string;
  onOpenRepositorySearch(): void;
  onOpenAddRepository(): void;
}): JSX.Element {
  return (
    <div className="section-title-row">
      <span>{title}</span>
      <div className="icon-cluster">
        <button
          className="icon-button"
          type="button"
          aria-label="Search repositories"
          title="Search repositories"
          onClick={onOpenRepositorySearch}
        >
          <Search size={15} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Add repository"
          title="Add repository"
          onClick={onOpenAddRepository}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function SidebarRepositoryFilter({
  value,
  onChange,
  onClear
}: {
  value: string;
  onChange(value: string): void;
  onClear(): void;
}): JSX.Element {
  function changeFilter(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  return (
    <label className="sidebar-repo-filter">
      <Search size={14} />
      <input
        aria-label="Search repositories"
        placeholder="Search repositories"
        value={value}
        onChange={changeFilter}
      />
      {value && (
        <button type="button" aria-label="Clear repository filter" onClick={onClear}>
          <X size={13} />
        </button>
      )}
    </label>
  );
}

function SidebarRepositoryList({
  model,
  selectedRepository,
  onSelectLocalRepository,
  onSelectRepository
}: {
  model: SidebarRepositoryModel;
  selectedRepository: string;
  onSelectLocalRepository(repository: AreaRepositorySummary): void;
  onSelectRepository(nameWithOwner: string): void;
}): JSX.Element {
  const { parentRef, virtualizer, ...renderModel } = model;

  return (
    <div className="repo-list" ref={parentRef}>
      <SidebarRepositoryStatusMessages
        model={renderModel}
        selectedRepository={selectedRepository}
        onSelectRepository={onSelectRepository}
      />

      {renderModel.browsingLocalArea && (
        <LocalAreaRepositoryRows
          repositories={renderModel.matchingAreaRepositories}
          pinnedKeys={renderModel.areaPinnedRepositoryKeys}
          selectedLocalRepositoryId={renderModel.selectedLocalRepositoryId}
          onSelectLocalRepository={onSelectLocalRepository}
        />
      )}

      {!renderModel.browsingLocalArea && renderModel.sidebarRepositories.length > 0 && (
        <SidebarRepositoryVirtualRows
          repositories={renderModel.sidebarRepositories}
          virtualizer={virtualizer}
          selectedRepository={selectedRepository}
          viewerLogin={renderModel.viewerLogin}
          filtered={Boolean(renderModel.normalizedRepositoryFilter)}
          onSelectRepository={onSelectRepository}
        />
      )}

      <SidebarRepositoryLoadControls model={renderModel} />
    </div>
  );
}

function SidebarRepositoryStatusMessages({
  model,
  selectedRepository,
  onSelectRepository
}: {
  model: SidebarRepositoryRenderModel;
  selectedRepository: string;
  onSelectRepository(nameWithOwner: string): void;
}): JSX.Element {
  const noRemoteRows =
    !model.browsingLocalArea &&
    !model.repositoriesLoading &&
    !model.repositoriesError &&
    !model.repositoriesAvailabilityMessage &&
    !model.remoteSearchFetching &&
    !model.remoteSearchError &&
    !model.remoteSearchUnavailable &&
    model.sidebarRepositories.length === 0 &&
    !model.directRepositoryVisible;

  return (
    <>
      {model.browsingLocalArea &&
        model.localRepositoriesLoading &&
        model.matchingAreaRepositories.length === 0 && (
          <div className="loading-state sidebar-empty-state">Scanning local repositories…</div>
        )}
      {model.browsingLocalArea &&
        !model.localRepositoriesLoading &&
        model.matchingAreaRepositories.length === 0 && (
          <div className="empty-state sidebar-empty-state">
            {model.normalizedRepositoryFilter
              ? "No local repositories match this filter."
              : "No repositories found in this Area yet."}
          </div>
        )}
      {!model.browsingLocalArea && model.repositoriesLoading && model.sidebarRepositories.length === 0 && (
        <div className="loading-state sidebar-empty-state">Loading repositories…</div>
      )}
      {!model.browsingLocalArea && model.repositoriesError && model.sidebarRepositories.length === 0 && (
        <div className="error-state sidebar-empty-state">
          Repositories unavailable: {model.repositoriesError.message}
        </div>
      )}
      {!model.browsingLocalArea &&
        model.repositoriesAvailabilityMessage &&
        model.sidebarRepositories.length === 0 && (
          <div className="error-state sidebar-empty-state">{model.repositoriesAvailabilityMessage}</div>
        )}
      {!model.browsingLocalArea && model.remoteSearchFetching && model.normalizedRepositoryFilter && (
        <div className="loading-state sidebar-empty-state">Searching GitHub…</div>
      )}
      {!model.browsingLocalArea && model.remoteSearchError && model.normalizedRepositoryFilter && (
        <div className="error-state sidebar-empty-state">
          GitHub search unavailable
          {model.remoteSearchError instanceof Error ? `: ${model.remoteSearchError.message}` : "."}
        </div>
      )}
      {!model.browsingLocalArea &&
        model.remoteSearchAvailabilityMessage &&
        model.normalizedRepositoryFilter && (
          <div className="error-state sidebar-empty-state">{model.remoteSearchAvailabilityMessage}</div>
        )}
      {!model.browsingLocalArea && model.showCachedRepositorySearchStatus && (
        <div className="muted-row sidebar-empty-state">Cached mode: searching local repositories only.</div>
      )}
      {!model.browsingLocalArea && model.remoteSearchMayBeCapped && (
        <div className="muted-row sidebar-empty-state">GitHub results may be capped.</div>
      )}
      {noRemoteRows && (
        <div className="empty-state sidebar-empty-state">
          {model.normalizedRepositoryFilter
            ? "No repositories match this filter."
            : "Pin repositories from a repository list."}
        </div>
      )}
      {model.directRepositoryVisible && model.exactRepositoryTarget && (
        <DirectRepositoryRow
          nameWithOwner={model.exactRepositoryTarget}
          selected={selectedRepository.toLowerCase() === model.exactRepositoryTarget.toLowerCase()}
          onSelectRepository={onSelectRepository}
          onClearRepositoryFilter={model.onClearRepositoryFilter}
        />
      )}
    </>
  );
}

function LocalAreaRepositoryRows({
  repositories,
  pinnedKeys,
  selectedLocalRepositoryId,
  onSelectLocalRepository
}: {
  repositories: AreaRepositorySummary[];
  pinnedKeys: Set<string>;
  selectedLocalRepositoryId: string | null;
  onSelectLocalRepository(repository: AreaRepositorySummary): void;
}): JSX.Element {
  return (
    <>
      {repositories.map((repository) => (
        <LocalAreaRepositoryRow
          key={repository.id}
          repository={repository}
          pinned={pinnedKeys.has(areaRepositoryPinKey(repository.areaId, repository.id, null))}
          selected={selectedLocalRepositoryId === repository.id}
          onSelectLocalRepository={onSelectLocalRepository}
        />
      ))}
    </>
  );
}

function LocalAreaRepositoryRow({
  repository,
  pinned,
  selected,
  onSelectLocalRepository
}: {
  repository: AreaRepositorySummary;
  pinned: boolean;
  selected: boolean;
  onSelectLocalRepository(repository: AreaRepositorySummary): void;
}): JSX.Element {
  function selectRepository(): void {
    onSelectLocalRepository(repository);
  }

  return (
    <button
      className={`repo-item sidebar-repo-item local-repo-item ${selected ? "selected" : ""}`}
      type="button"
      aria-label={`Open ${repository.displayName}`}
      title={repository.path ?? repository.displayName}
      onClick={selectRepository}
    >
      <span className="repo-avatar">{repository.kind === "jj" ? "J" : "G"}</span>
      <span className="repo-copy">
        <span className="repo-name">{repository.displayName}</span>
        <span className="repo-meta">
          {repository.connection?.nameWithOwner ?? repository.path ?? repository.kind}
        </span>
      </span>
      <span className="repo-source-stack">
        {pinned && <Pin size={13} />}
        {repository.connection && <ExternalLink size={13} />}
        <span className="repo-source">{repository.kind.toUpperCase()}</span>
      </span>
    </button>
  );
}

function DirectRepositoryRow({
  nameWithOwner,
  selected,
  onSelectRepository,
  onClearRepositoryFilter
}: {
  nameWithOwner: string;
  selected: boolean;
  onSelectRepository(nameWithOwner: string): void;
  onClearRepositoryFilter(): void;
}): JSX.Element {
  function selectRepository(): void {
    onSelectRepository(nameWithOwner);
    onClearRepositoryFilter();
  }

  return (
    <button
      className={`repo-item sidebar-repo-item sidebar-direct-repo-item ${selected ? "selected" : ""}`}
      type="button"
      aria-label={`Open ${nameWithOwner} repository directly`}
      title={`Open ${nameWithOwner} directly`}
      onClick={selectRepository}
    >
      <span className="repo-avatar">{nameWithOwner.slice(0, 1).toUpperCase()}</span>
      <span className="repo-copy">
        <span className="repo-name">{nameWithOwner}</span>
        <span className="repo-meta">Direct repository</span>
      </span>
      <span className="repo-source-stack">
        <span className="repo-source">Direct</span>
      </span>
    </button>
  );
}

function SidebarRepositoryVirtualRows({
  repositories,
  virtualizer,
  selectedRepository,
  viewerLogin,
  filtered,
  onSelectRepository
}: {
  repositories: SidebarRepositoryItem[];
  virtualizer: SidebarRepositoryVirtualizer;
  selectedRepository: string;
  viewerLogin: string | null;
  filtered: boolean;
  onSelectRepository(nameWithOwner: string): void;
}): JSX.Element {
  return (
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = repositories[virtualRow.index];
        return (
          <SidebarRepositoryVirtualRow
            key={item.repository.id}
            item={item}
            virtualRow={virtualRow}
            selected={selectedRepository === item.repository.nameWithOwner}
            viewerLogin={viewerLogin}
            filtered={filtered}
            onSelectRepository={onSelectRepository}
          />
        );
      })}
    </div>
  );
}

function SidebarRepositoryVirtualRow({
  item,
  virtualRow,
  selected,
  viewerLogin,
  filtered,
  onSelectRepository
}: {
  item: SidebarRepositoryItem;
  virtualRow: VirtualItem;
  selected: boolean;
  viewerLogin: string | null;
  filtered: boolean;
  onSelectRepository(nameWithOwner: string): void;
}): JSX.Element {
  const { repository, source } = item;
  const displayName = displayRepositoryShortcutName(repository, viewerLogin);
  const metadataParts = sidebarRepositoryMetadataParts(repository, source, filtered);
  const metadata = metadataParts.join(" · ");
  const rowLabel = metadata ? `${displayName}, ${metadata}` : displayName;
  const sourceClassName = source ? `repo-item-${source.toLowerCase()}-source` : "repo-item-cached-source";
  const showSourceStack = Boolean((filtered && source) || repository.isPrivate);

  function selectRepository(): void {
    onSelectRepository(repository.nameWithOwner);
  }

  return (
    <button
      className={`repo-item sidebar-repo-item ${sourceClassName} ${selected ? "selected" : ""}`}
      type="button"
      aria-label={`Open ${rowLabel}`}
      title={rowLabel}
      style={{
        transform: `translateY(${virtualRow.start}px)`
      }}
      onClick={selectRepository}
    >
      <span className="repo-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
      <span className="repo-copy">
        <span className="repo-name">{displayName}</span>
        {metadata && <span className="repo-meta">{metadata}</span>}
      </span>
      {showSourceStack && (
        <span className="repo-source-stack">
          {filtered && source && <span className="repo-source">{source}</span>}
          {repository.isPrivate && <Lock size={13} />}
        </span>
      )}
    </button>
  );
}

function SidebarRepositoryLoadControls({ model }: { model: SidebarRepositoryRenderModel }): JSX.Element {
  return (
    <>
      {model.canLoadMoreLocalRepositories && (
        <button className="show-more" type="button" onClick={model.onLoadMoreLocalRepositories}>
          Load more repositories
        </button>
      )}
      {model.showingAllLoadedLocalRepositories && (
        <div className="muted-row sidebar-empty-state">All loaded repositories are shown.</div>
      )}
      {model.localRepositoryListLimitReached && (
        <div className="muted-row sidebar-empty-state">Local repository list cap reached.</div>
      )}
      {model.canLoadMoreLocalSearchResults && (
        <button className="show-more" type="button" onClick={model.onLoadMoreLocalSearchResults}>
          Load more local results
        </button>
      )}
      {model.showingAllLoadedLocalSearchResults && (
        <div className="muted-row sidebar-empty-state">All loaded local matches are shown.</div>
      )}
      {model.localSearchListLimitReached && (
        <div className="muted-row sidebar-empty-state">Local search result cap reached.</div>
      )}
      {model.canLoadMoreRemoteSearchResults && (
        <button className="show-more" type="button" onClick={model.onLoadMoreRemoteSearchResults}>
          Load more GitHub results
        </button>
      )}
    </>
  );
}

function SidebarFooter({
  appState,
  profile,
  onOpenSettings
}: {
  appState?: AppState;
  profile?: GitHubAccountProfile;
  onOpenSettings(): void;
}): JSX.Element {
  const viewerLoading = Boolean(appState?.github.authenticated && !appState.viewer && !profile);
  const footerAvatarUrl = appState?.viewer?.avatarUrl ?? profile?.avatarUrl ?? null;
  const footerLogin = appState?.viewer?.login ?? profile?.login ?? null;
  const footerName = appState?.viewer?.name ?? profile?.name ?? footerLogin;

  return (
    <button className="user-footer" type="button" onClick={onOpenSettings}>
      {footerAvatarUrl ? (
        <img src={footerAvatarUrl} alt="" />
      ) : (
        <span className={`avatar-placeholder ${viewerLoading ? "loading-avatar" : ""}`}>C</span>
      )}
      <span>
        <strong>{viewerLoading ? "Loading GitHub profile" : (footerName ?? "Set up Control")}</strong>
        <small>@{footerLogin ?? "github"}</small>
      </span>
      <MoreHorizontal size={18} />
    </button>
  );
}
