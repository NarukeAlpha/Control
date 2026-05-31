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
import { useMemo, useRef, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

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
  sidebarRepositoryMetadataParts
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
}: {
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
}): JSX.Element {
  const api = useControlApi();
  const goHome = useUiStore((state) => state.goHome);
  const goToRepositories = useUiStore((state) => state.goToRepositories);
  const goToOrganizations = useUiStore((state) => state.goToOrganizations);
  const goToMailbox = useUiStore((state) => state.goToMailbox);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [localRepositoryDisplayLimit, setLocalRepositoryDisplayLimit] = useState(6);
  const [localRepositorySearchLimit, setLocalRepositorySearchLimit] = useState(50);
  const [remoteRepositorySearchLimit, setRemoteRepositorySearchLimit] = useState(8);
  const viewerLogin = appState?.viewer?.login ?? profile?.login ?? null;
  const githubReady = Boolean(appState?.github.authenticated);
  const viewerLoading = Boolean(appState?.github.authenticated && !appState.viewer && !profile);
  const footerAvatarUrl = appState?.viewer?.avatarUrl ?? profile?.avatarUrl ?? null;
  const footerLogin = appState?.viewer?.login ?? profile?.login ?? null;
  const footerName = appState?.viewer?.name ?? profile?.name ?? footerLogin;
  const selectedAreaSummary =
    areas.find((area) => area.id === selectedAreaId) ??
    areas.find((area) => area.selected) ??
    areas.find((area) => area.kind === "github") ??
    null;
  const browsingLocalArea = isGatewayAreaKind(selectedAreaSummary?.kind);
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
    const pinnedKeys = new Set(
      repositoryPinRecords.map((pin) => areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId))
    );
    return [...filteredRepositories].sort((left, right) => {
      const leftPinned = pinnedKeys.has(areaRepositoryPinKey(left.areaId, left.id, null));
      const rightPinned = pinnedKeys.has(areaRepositoryPinKey(right.areaId, right.id, null));
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName);
    });
  }, [localRepositories, normalizedRepositoryFilter, repositoryPinRecords]);
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
    estimateSize: () => 54,
    overscan: 8
  });

  return (
    <aside className="sidebar">
      <nav className="nav-list">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`nav-item ${isNavigationActive(route, item.label) ? "active" : ""}`}
              key={item.label}
              type="button"
              onClick={() => {
                if (item.key === "home") {
                  goHome();
                  return;
                }
                if (item.key === "repositories") {
                  goToRepositories();
                  return;
                }
                if (item.key === "organizations") {
                  goToOrganizations();
                  return;
                }
                goToMailbox();
              }}
              title={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <section className="repo-section">
        <div className="section-title-row">
          <span>{repositorySectionTitle}</span>
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
        <label className="sidebar-repo-filter">
          <Search size={14} />
          <input
            aria-label="Search repositories"
            placeholder="Search repositories"
            value={repositoryFilter}
            onChange={(event) => {
              setRepositoryFilter(event.target.value);
              setLocalRepositorySearchLimit(50);
              setRemoteRepositorySearchLimit(8);
            }}
          />
          {repositoryFilter && (
            <button
              type="button"
              aria-label="Clear repository filter"
              onClick={() => {
                setRepositoryFilter("");
                setLocalRepositorySearchLimit(50);
                setRemoteRepositorySearchLimit(8);
              }}
            >
              <X size={13} />
            </button>
          )}
        </label>

        <div className="repo-list" ref={parentRef}>
          {browsingLocalArea && localRepositoriesLoading && matchingAreaRepositories.length === 0 && (
            <div className="loading-state sidebar-empty-state">Scanning local repositories...</div>
          )}
          {browsingLocalArea && !localRepositoriesLoading && matchingAreaRepositories.length === 0 && (
            <div className="empty-state sidebar-empty-state">
              {normalizedRepositoryFilter
                ? "No local repositories match this filter."
                : "No repositories found in this Area yet."}
            </div>
          )}
          {browsingLocalArea &&
            matchingAreaRepositories.map((repository) => {
              const pinned = repositoryPinRecords.some(
                (pin) =>
                  areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId) ===
                  areaRepositoryPinKey(repository.areaId, repository.id, null)
              );
              return (
                <button
                  className={`repo-item local-repo-item ${selectedLocalRepositoryId === repository.id ? "selected" : ""}`}
                  key={repository.id}
                  type="button"
                  aria-label={`Open ${repository.displayName}`}
                  title={repository.path ?? repository.displayName}
                  onClick={() => onSelectLocalRepository(repository)}
                >
                  <span className="repo-avatar">{repository.kind === "jj" ? "J" : "G"}</span>
                  <span className="repo-copy">
                    <span className="repo-name">{repository.displayName}</span>
                    <span className="repo-meta">
                      {repository.connection?.nameWithOwner ?? repository.path ?? repository.kind}
                    </span>
                  </span>
                  {pinned ? (
                    <Pin size={13} />
                  ) : repository.connection ? (
                    <ExternalLink size={13} />
                  ) : (
                    <span className="repo-source">{repository.kind}</span>
                  )}
                </button>
              );
            })}
          {!browsingLocalArea && repositoriesLoading && sidebarRepositories.length === 0 && (
            <div className="loading-state sidebar-empty-state">Loading repositories…</div>
          )}
          {!browsingLocalArea && repositoriesError && sidebarRepositories.length === 0 && (
            <div className="error-state sidebar-empty-state">
              Repositories unavailable: {repositoriesError.message}
            </div>
          )}
          {!browsingLocalArea && repositoriesAvailabilityMessage && sidebarRepositories.length === 0 && (
            <div className="error-state sidebar-empty-state">{repositoriesAvailabilityMessage}</div>
          )}
          {!browsingLocalArea && remoteSearch.isFetching && normalizedRepositoryFilter && (
            <div className="loading-state sidebar-empty-state">Searching GitHub…</div>
          )}
          {!browsingLocalArea && remoteSearch.isError && normalizedRepositoryFilter && (
            <div className="error-state sidebar-empty-state">
              GitHub search unavailable
              {remoteSearch.error instanceof Error ? `: ${remoteSearch.error.message}` : "."}
            </div>
          )}
          {!browsingLocalArea && remoteSearchAvailabilityMessage && normalizedRepositoryFilter && (
            <div className="error-state sidebar-empty-state">{remoteSearchAvailabilityMessage}</div>
          )}
          {!browsingLocalArea && showCachedRepositorySearchStatus && (
            <div className="muted-row sidebar-empty-state">
              Cached mode: searching local repositories only.
            </div>
          )}
          {!browsingLocalArea && remoteSearchMayBeCapped && (
            <div className="muted-row sidebar-empty-state">GitHub results may be capped.</div>
          )}
          {!browsingLocalArea &&
            !repositoriesLoading &&
            !repositoriesError &&
            !repositoriesAvailabilityMessage &&
            !remoteSearch.isFetching &&
            !remoteSearch.isError &&
            !remoteSearchUnavailable &&
            sidebarRepositories.length === 0 &&
            !directRepositoryVisible && (
              <div className="empty-state sidebar-empty-state">
                {normalizedRepositoryFilter
                  ? "No repositories match this filter."
                  : "Pin repositories from a repository list."}
              </div>
            )}
          {directRepositoryVisible && exactRepositoryTarget && (
            <button
              className={`repo-item sidebar-direct-repo-item ${
                selectedRepository.toLowerCase() === exactRepositoryTarget.toLowerCase() ? "selected" : ""
              }`}
              type="button"
              aria-label={`Open ${exactRepositoryTarget} repository directly`}
              title={`Open ${exactRepositoryTarget} directly`}
              onClick={() => {
                onSelectRepository(exactRepositoryTarget);
                setRepositoryFilter("");
                setLocalRepositorySearchLimit(50);
                setRemoteRepositorySearchLimit(8);
              }}
            >
              <span className="repo-avatar">{exactRepositoryTarget.slice(0, 1).toUpperCase()}</span>
              <span className="repo-copy">
                <span className="repo-name">{exactRepositoryTarget}</span>
                <span className="repo-meta">Direct repository</span>
              </span>
              <span className="repo-source">Direct</span>
            </button>
          )}
          {sidebarRepositories.length > 0 && (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const { repository, source } = sidebarRepositories[virtualRow.index];
                const displayName = displayRepositoryShortcutName(repository, viewerLogin);
                const metadataParts = sidebarRepositoryMetadataParts(
                  repository,
                  source,
                  Boolean(normalizedRepositoryFilter)
                );
                const metadata = metadataParts.join(" · ");
                const rowLabel = metadata ? `${displayName}, ${metadata}` : displayName;
                return (
                  <button
                    className={`repo-item ${selectedRepository === repository.nameWithOwner ? "selected" : ""}`}
                    key={repository.id}
                    type="button"
                    aria-label={`Open ${rowLabel}`}
                    title={rowLabel}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                    onClick={() => onSelectRepository(repository.nameWithOwner)}
                  >
                    <span className="repo-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
                    <span className="repo-copy">
                      <span className="repo-name">{displayName}</span>
                      {metadata && <span className="repo-meta">{metadata}</span>}
                    </span>
                    {normalizedRepositoryFilter && source ? (
                      <span className="repo-source">{source}</span>
                    ) : (
                      repository.isPrivate && <Lock size={13} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {canLoadMoreLocalRepositories && (
            <button
              className="show-more"
              type="button"
              onClick={() =>
                setLocalRepositoryDisplayLimit((currentLimit) =>
                  Math.min(currentLimit + 6, localRepositoryLimit)
                )
              }
            >
              Load more repositories
            </button>
          )}
          {showingAllLoadedLocalRepositories && (
            <div className="muted-row sidebar-empty-state">All loaded repositories are shown.</div>
          )}
          {localRepositoryListLimitReached && (
            <div className="muted-row sidebar-empty-state">Local repository list cap reached.</div>
          )}
          {canLoadMoreLocalSearchResults && (
            <button
              className="show-more"
              type="button"
              onClick={() =>
                setLocalRepositorySearchLimit((currentLimit) =>
                  Math.min(currentLimit + 50, matchingLocalRepositories.length, maxRepositoryListLimit)
                )
              }
            >
              Load more local results
            </button>
          )}
          {showingAllLoadedLocalSearchResults && (
            <div className="muted-row sidebar-empty-state">All loaded local matches are shown.</div>
          )}
          {localSearchListLimitReached && (
            <div className="muted-row sidebar-empty-state">Local search result cap reached.</div>
          )}
          {canLoadMoreRemoteSearchResults && (
            <button
              className="show-more"
              type="button"
              onClick={() =>
                setRemoteRepositorySearchLimit((currentLimit) =>
                  Math.min(currentLimit + 8, maxRepositoryListLimit)
                )
              }
            >
              Load more GitHub results
            </button>
          )}
        </div>
      </section>

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
    </aside>
  );
}
