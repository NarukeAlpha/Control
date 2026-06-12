import { Pin, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChangeEvent, JSX } from "react";

import type { AreaRepositorySummary, AreaSummary } from "@shared/areas";
import type { RepositorySummary } from "@shared/github";
import type { RepositoryPinRecord } from "@shared/local";

import { formatRelativeDate } from "../../utils/format";
import { repositoryCollectionMetadataParts, readAvailabilityMessage } from "../repository/repositoryUi";
import {
  displayRepositoryName,
  maxRepositoryListLimit,
  repositoryActivityDate,
  repositoryNameWithOwnerInput,
  sortRepositoriesByActivity
} from "../repository/repositorySearch";
import { areaKindLabel } from "../areas/areaSearchUi";
import { areaRepositoryPinKey } from "../areas/areaUi";
import { collectionRowClassName, matchesCollectionFilter } from "./collectionUi";

export interface RepositoriesRouteProps {
  title: string;
  repositoryListLimit: number;
  selectedArea: AreaSummary | null;
  githubRepositoryItems: RepositorySummary[];
  githubRepositoriesLoading: boolean;
  githubRepositoriesFetching: boolean;
  githubRepositoriesError: Error | null;
  githubRepositoriesAvailability: ReturnType<typeof readAvailabilityMessage>;
  localRepositories: AreaRepositorySummary[];
  localRepositoriesLoading: boolean;
  areaRepositoryPinRecords: RepositoryPinRecord[];
  pinnedRepositoryNames: string[];
  repositoryPinBusy: boolean;
  repositoryPinError: Error | null;
  viewerLogin: string | null;
  onOpenRepository(nameWithOwner: string): void;
  onOpenLocalRepository(repository: AreaRepositorySummary): void;
  onOpenAddRepository(): void;
  onExpandRepositories(): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
  onToggleAreaRepositoryPin(repository: AreaRepositorySummary): void;
  onRefreshRepositories(): Promise<void> | void;
  onRefreshSelectedArea(): void;
}

function RepositoriesRouteHeader({
  title,
  selectedAreaTitle,
  showingGitHubArea,
  githubRepositoriesFetching,
  onRefreshRepositories,
  onRefreshSelectedArea,
  onOpenAddRepository
}: {
  title: string;
  selectedAreaTitle: string;
  showingGitHubArea: boolean;
  githubRepositoriesFetching: boolean;
  onRefreshRepositories(): Promise<void> | void;
  onRefreshSelectedArea(): void;
  onOpenAddRepository(): void;
}): JSX.Element {
  function refreshRepositories(): void {
    void onRefreshRepositories();
  }

  return (
    <header>
      <h2>{showingGitHubArea ? title : selectedAreaTitle}</h2>
      <div className="collection-actions">
        {showingGitHubArea && (
          <button
            type="button"
            title="Updated repository data"
            disabled={githubRepositoriesFetching}
            onClick={refreshRepositories}
          >
            {githubRepositoriesFetching ? "Refreshing repositories" : "Refresh repositories"}
          </button>
        )}
        {!showingGitHubArea && (
          <button type="button" onClick={onRefreshSelectedArea}>
            Refresh Area
          </button>
        )}
        <button type="button" onClick={onOpenAddRepository}>
          <Plus size={16} /> Add repository
        </button>
      </div>
    </header>
  );
}

function RepositoryFilterRow({
  collectionFilter,
  onFilterChange
}: {
  collectionFilter: string;
  onFilterChange(value: string): void;
}): JSX.Element {
  function updateFilter(event: ChangeEvent<HTMLInputElement>): void {
    onFilterChange(event.currentTarget.value);
  }

  function clearFilter(): void {
    onFilterChange("");
  }

  return (
    <div className="table-action-row surface-filter-row">
      <label className="surface-filter">
        <Search size={16} />
        <input
          aria-label="Filter repositories"
          placeholder="Filter repositories"
          value={collectionFilter}
          onChange={updateFilter}
        />
      </label>
      {collectionFilter.trim() && (
        <button type="button" onClick={clearFilter}>
          <X size={16} /> Clear
        </button>
      )}
    </div>
  );
}

function GitHubRepositoryRow({
  repository,
  viewerLogin,
  pinned,
  repositoryPinDisabledReason,
  onOpenRepository,
  onToggleRepositoryPin
}: {
  repository: RepositorySummary;
  viewerLogin: string | null;
  pinned: boolean;
  repositoryPinDisabledReason: string | null;
  onOpenRepository(nameWithOwner: string): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
}): JSX.Element {
  const metadataParts = repositoryCollectionMetadataParts(repository);

  function openRepository(): void {
    onOpenRepository(repository.nameWithOwner);
  }

  function togglePin(): void {
    onToggleRepositoryPin(repository.nameWithOwner);
  }

  return (
    <div className={collectionRowClassName("repository-row", { withActions: true })}>
      <button className="repository-row-main" type="button" onClick={openRepository}>
        <span className="repo-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{displayRepositoryName(repository, viewerLogin)}</strong>
          <small>
            {repository.description ?? "Repository"} · updated{" "}
            {formatRelativeDate(repositoryActivityDate(repository))}
          </small>
          {metadataParts.length > 0 && (
            <small className="notification-detail-line">{metadataParts.join(" · ")}</small>
          )}
        </div>
        <span className="row-chip-stack">
          <span className="state-chip">{repository.visibility.toLowerCase()}</span>
          {repository.isFork && <span className="state-chip attention">fork</span>}
          {pinned && <span className="state-chip success">pinned</span>}
        </span>
      </button>
      <span className="row-action-stack">
        <button
          className={`pin-row-button ${pinned ? "selected-action" : ""}`}
          type="button"
          aria-label={`${pinned ? "Unpin" : "Pin"} ${repository.name}`}
          aria-pressed={pinned}
          disabled={Boolean(repositoryPinDisabledReason)}
          title={repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.nameWithOwner}`}
          onClick={togglePin}
        >
          <Pin size={15} />
        </button>
      </span>
    </div>
  );
}

function LocalRepositoryRow({
  repository,
  pinned,
  repositoryPinDisabledReason,
  onOpenLocalRepository,
  onToggleAreaRepositoryPin
}: {
  repository: AreaRepositorySummary;
  pinned: boolean;
  repositoryPinDisabledReason: string | null;
  onOpenLocalRepository(repository: AreaRepositorySummary): void;
  onToggleAreaRepositoryPin(repository: AreaRepositorySummary): void;
}): JSX.Element {
  const secondary =
    repository.connection?.nameWithOwner ?? repository.path ?? `${repository.kind.toUpperCase()} repository`;
  const healthChip =
    repository.health.status === "ready" ? null : (repository.health.message ?? repository.health.status);
  const connection = repository.connection;

  function openLocalRepository(): void {
    onOpenLocalRepository(repository);
  }

  function togglePin(): void {
    onToggleAreaRepositoryPin(repository);
  }

  return (
    <div className={collectionRowClassName("repository-row", { withActions: true })}>
      <button className="repository-row-main" type="button" onClick={openLocalRepository}>
        <span className="repo-avatar">{repository.displayName.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{repository.displayName}</strong>
          <small>{secondary}</small>
          {repository.health.message && (
            <small className="notification-detail-line">{repository.health.message}</small>
          )}
        </div>
        <span className="row-chip-stack">
          <span className="state-chip">{repository.kind.toUpperCase()}</span>
          {connection && <span className="state-chip success">GitHub {connection.status}</span>}
          {repository.isDirty && <span className="state-chip attention">dirty</span>}
          {healthChip && <span className="state-chip attention">{healthChip}</span>}
          {pinned && <span className="state-chip success">pinned</span>}
        </span>
      </button>
      <span className="row-action-stack">
        <button
          className={`pin-row-button ${pinned ? "selected-action" : ""}`}
          type="button"
          aria-label={`${pinned ? "Unpin" : "Pin"} ${repository.displayName}`}
          aria-pressed={pinned}
          disabled={Boolean(repositoryPinDisabledReason)}
          title={repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.displayName}`}
          onClick={togglePin}
        >
          <Pin size={15} />
        </button>
      </span>
    </div>
  );
}

function DirectRepositoryTargetRow({
  directRepositoryTarget,
  directRepositoryName,
  directRepositoryOwner,
  onOpenRepository,
  onClearFilter
}: {
  directRepositoryTarget: string;
  directRepositoryName: string;
  directRepositoryOwner: string;
  onOpenRepository(nameWithOwner: string): void;
  onClearFilter(): void;
}): JSX.Element {
  function openDirectRepository(): void {
    onOpenRepository(directRepositoryTarget);
    onClearFilter();
  }

  return (
    <div className={collectionRowClassName("repository-row", { withActions: true })}>
      <button className="repository-row-main" type="button" onClick={openDirectRepository}>
        <span className="repo-avatar">{directRepositoryOwner.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{directRepositoryName}</strong>
          <small>{directRepositoryTarget}</small>
        </div>
        <span className="row-chip-stack">
          <span className="state-chip">Direct</span>
        </span>
      </button>
    </div>
  );
}

function GitHubRepositoryStatus({
  repositoryListLimit,
  repositoryItems,
  filteredRepositories,
  repositoriesLimitHit,
  canExpandRepositories,
  githubRepositoriesLoading,
  githubRepositoriesFetching,
  githubRepositoriesError,
  repositoriesAvailabilityMessage,
  showDirectRepositoryTarget,
  onExpandRepositories
}: {
  repositoryListLimit: number;
  repositoryItems: RepositorySummary[];
  filteredRepositories: RepositorySummary[];
  repositoriesLimitHit: boolean;
  canExpandRepositories: boolean;
  githubRepositoriesLoading: boolean;
  githubRepositoriesFetching: boolean;
  githubRepositoriesError: Error | null;
  repositoriesAvailabilityMessage: ReturnType<typeof readAvailabilityMessage>;
  showDirectRepositoryTarget: boolean;
  onExpandRepositories(): void;
}): JSX.Element {
  return (
    <>
      {canExpandRepositories && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandRepositories}>
            Load more repositories
          </button>
        </div>
      )}
      {!canExpandRepositories && repositoriesLimitHit && (
        <div className="muted-row">
          Showing the first {repositoryListLimit} repositories returned by GitHub.
        </div>
      )}
      {(githubRepositoriesLoading || githubRepositoriesFetching) && repositoryItems.length === 0 && (
        <div className="loading-state">Loading GitHub repositories…</div>
      )}
      {githubRepositoriesError instanceof Error && (
        <div className="error-state">
          Could not load GitHub repositories: {githubRepositoriesError.message}
        </div>
      )}
      {repositoriesAvailabilityMessage && (
        <div className="error-state">{repositoriesAvailabilityMessage}</div>
      )}
      {!githubRepositoriesLoading &&
        !githubRepositoriesFetching &&
        !(githubRepositoriesError instanceof Error) &&
        !repositoriesAvailabilityMessage &&
        filteredRepositories.length === 0 &&
        !showDirectRepositoryTarget && (
          <div className="empty-state">
            {repositoryItems.length === 0
              ? "No repositories loaded from GitHub."
              : "No repositories match this filter."}
          </div>
        )}
    </>
  );
}

function LocalRepositoryStatus({
  selectedArea,
  localRepositories,
  filteredLocalRepositories,
  localRepositoriesLoading
}: {
  selectedArea: AreaSummary | null;
  localRepositories: AreaRepositorySummary[];
  filteredLocalRepositories: AreaRepositorySummary[];
  localRepositoriesLoading: boolean;
}): JSX.Element {
  return (
    <>
      {localRepositoriesLoading && filteredLocalRepositories.length === 0 && (
        <div className="loading-state">Scanning this Area for repositories.</div>
      )}
      {selectedArea?.health.status !== "ready" &&
        selectedArea?.health.message &&
        filteredLocalRepositories.length > 0 && (
          <div className="error-state">{selectedArea.health.message}</div>
        )}
      {!localRepositoriesLoading && filteredLocalRepositories.length === 0 && (
        <div className={selectedArea?.health.status === "ready" ? "empty-state" : "error-state"}>
          {selectedArea?.health.message ??
            (localRepositories.length === 0
              ? "No repositories found in this Area."
              : "No repositories match this filter.")}
        </div>
      )}
    </>
  );
}

export function RepositoriesRoute({
  title,
  repositoryListLimit,
  selectedArea,
  githubRepositoryItems,
  githubRepositoriesLoading,
  githubRepositoriesFetching,
  githubRepositoriesError,
  githubRepositoriesAvailability,
  localRepositories,
  localRepositoriesLoading,
  areaRepositoryPinRecords,
  pinnedRepositoryNames,
  repositoryPinBusy,
  repositoryPinError,
  viewerLogin,
  onOpenRepository,
  onOpenLocalRepository,
  onOpenAddRepository,
  onExpandRepositories,
  onToggleRepositoryPin,
  onToggleAreaRepositoryPin,
  onRefreshRepositories,
  onRefreshSelectedArea
}: RepositoriesRouteProps): JSX.Element {
  const [collectionFilter, setCollectionFilter] = useState("");
  const selectedAreaKind = selectedArea?.kind ?? "github";
  const showingGitHubArea = selectedAreaKind === "github";
  const repositoryItems = githubRepositoryItems;
  const repositoriesAvailabilityMessage = githubRepositoriesAvailability;
  const normalizedCollectionFilter = collectionFilter.trim().toLowerCase();
  const filteredRepositories = useMemo(
    () =>
      sortRepositoriesByActivity(repositoryItems).filter((repository) =>
        matchesCollectionFilter(
          [
            repository.name,
            repository.owner,
            repository.nameWithOwner,
            repository.description,
            repository.primaryLanguage?.name,
            repository.visibility
          ],
          normalizedCollectionFilter
        )
      ),
    [normalizedCollectionFilter, repositoryItems]
  );
  const pinnedAreaRepositoryKeys = useMemo(
    () =>
      new Set(
        areaRepositoryPinRecords.map((pin) =>
          areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId ?? null)
        )
      ),
    [areaRepositoryPinRecords]
  );
  const pinnedRepositoryNameSet = useMemo(
    () => new Set(pinnedRepositoryNames.map((nameWithOwner) => nameWithOwner.toLowerCase())),
    [pinnedRepositoryNames]
  );
  const filteredLocalRepositories = useMemo(
    () =>
      [...localRepositories]
        .filter((repository) =>
          matchesCollectionFilter(
            [
              repository.displayName,
              repository.name,
              repository.path,
              repository.kind,
              selectedArea?.label,
              repository.connection?.nameWithOwner,
              repository.connection?.status,
              repository.health.message,
              repository.health.status
            ],
            normalizedCollectionFilter
          )
        )
        .sort((left, right) => {
          const leftPinned = pinnedAreaRepositoryKeys.has(areaRepositoryPinKey(left.areaId, left.id, null));
          const rightPinned = pinnedAreaRepositoryKeys.has(
            areaRepositoryPinKey(right.areaId, right.id, null)
          );
          if (leftPinned !== rightPinned) {
            return leftPinned ? -1 : 1;
          }
          const leftReady = left.health.status === "ready";
          const rightReady = right.health.status === "ready";
          if (leftReady !== rightReady) {
            return leftReady ? -1 : 1;
          }
          const leftDate = Date.parse(left.updatedAt ?? left.scannedAt ?? "");
          const rightDate = Date.parse(right.updatedAt ?? right.scannedAt ?? "");
          if (!Number.isNaN(leftDate) || !Number.isNaN(rightDate)) {
            return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
          }
          return left.displayName.localeCompare(right.displayName);
        }),
    [localRepositories, normalizedCollectionFilter, pinnedAreaRepositoryKeys, selectedArea?.label]
  );
  const repositoriesLimitHit = repositoryItems.length >= repositoryListLimit;
  const canExpandRepositories = repositoriesLimitHit && repositoryListLimit < maxRepositoryListLimit;
  const directRepositoryTarget = repositoryNameWithOwnerInput(collectionFilter);
  const directRepositoryTargetAlreadyLoaded = directRepositoryTarget
    ? repositoryItems.some(
        (repository) => repository.nameWithOwner.toLowerCase() === directRepositoryTarget.toLowerCase()
      ) ||
      filteredRepositories.some(
        (repository) => repository.nameWithOwner.toLowerCase() === directRepositoryTarget.toLowerCase()
      )
    : false;
  const showDirectRepositoryTarget = Boolean(
    showingGitHubArea && directRepositoryTarget && !directRepositoryTargetAlreadyLoaded
  );
  const directRepositoryName = directRepositoryTarget?.split("/")[1] ?? null;
  const directRepositoryOwner = directRepositoryTarget?.split("/")[0] ?? null;
  const repositoryPinDisabledReason = repositoryPinBusy ? "Repository pin update is still running." : null;
  const selectedAreaTitle = selectedArea
    ? `${selectedArea.label} ${areaKindLabel(selectedArea.kind)} repositories`
    : title;

  function clearCollectionFilter(): void {
    setCollectionFilter("");
  }

  return (
    <section className="collection-view">
      <RepositoriesRouteHeader
        title={title}
        selectedAreaTitle={selectedAreaTitle}
        showingGitHubArea={showingGitHubArea}
        githubRepositoriesFetching={githubRepositoriesFetching}
        onRefreshRepositories={onRefreshRepositories}
        onRefreshSelectedArea={onRefreshSelectedArea}
        onOpenAddRepository={onOpenAddRepository}
      />
      <div className="table-panel">
        <RepositoryFilterRow collectionFilter={collectionFilter} onFilterChange={setCollectionFilter} />
        {repositoryPinError && (
          <div className="error-state">Local repository pin update failed: {repositoryPinError.message}</div>
        )}
        {showingGitHubArea &&
          filteredRepositories.map((repository) => (
            <GitHubRepositoryRow
              key={repository.id}
              repository={repository}
              viewerLogin={viewerLogin}
              pinned={pinnedRepositoryNameSet.has(repository.nameWithOwner.toLowerCase())}
              repositoryPinDisabledReason={repositoryPinDisabledReason}
              onOpenRepository={onOpenRepository}
              onToggleRepositoryPin={onToggleRepositoryPin}
            />
          ))}
        {!showingGitHubArea &&
          filteredLocalRepositories.map((repository) => (
            <LocalRepositoryRow
              key={repository.id}
              repository={repository}
              pinned={pinnedAreaRepositoryKeys.has(
                areaRepositoryPinKey(repository.areaId, repository.id, null)
              )}
              repositoryPinDisabledReason={repositoryPinDisabledReason}
              onOpenLocalRepository={onOpenLocalRepository}
              onToggleAreaRepositoryPin={onToggleAreaRepositoryPin}
            />
          ))}
        {showingGitHubArea &&
          showDirectRepositoryTarget &&
          directRepositoryTarget &&
          directRepositoryName &&
          directRepositoryOwner && (
            <DirectRepositoryTargetRow
              directRepositoryTarget={directRepositoryTarget}
              directRepositoryName={directRepositoryName}
              directRepositoryOwner={directRepositoryOwner}
              onOpenRepository={onOpenRepository}
              onClearFilter={clearCollectionFilter}
            />
          )}
        {showingGitHubArea ? (
          <GitHubRepositoryStatus
            repositoryListLimit={repositoryListLimit}
            repositoryItems={repositoryItems}
            filteredRepositories={filteredRepositories}
            repositoriesLimitHit={repositoriesLimitHit}
            canExpandRepositories={canExpandRepositories}
            githubRepositoriesLoading={githubRepositoriesLoading}
            githubRepositoriesFetching={githubRepositoriesFetching}
            githubRepositoriesError={githubRepositoriesError}
            repositoriesAvailabilityMessage={repositoriesAvailabilityMessage}
            showDirectRepositoryTarget={showDirectRepositoryTarget}
            onExpandRepositories={onExpandRepositories}
          />
        ) : (
          <LocalRepositoryStatus
            selectedArea={selectedArea}
            localRepositories={localRepositories}
            filteredLocalRepositories={filteredLocalRepositories}
            localRepositoriesLoading={localRepositoriesLoading}
          />
        )}
      </div>
    </section>
  );
}
