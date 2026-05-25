import { ExternalLink, Pin, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { JSX } from "react";

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
import { matchesCollectionFilter } from "./collectionUi";

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
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenLocalRepository(repository: AreaRepositorySummary): void;
  onOpenAddRepository(): void;
  onExpandRepositories(): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
  onToggleAreaRepositoryPin(repository: AreaRepositorySummary): void;
  onRefreshRepositories(): Promise<void> | void;
  onRefreshSelectedArea(): void;
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
  onOpenExternal,
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

  return (
    <section className="collection-view">
      <header>
        <h2>{showingGitHubArea ? title : selectedAreaTitle}</h2>
        <div className="collection-actions">
          {showingGitHubArea && (
            <button
              type="button"
              title="Updated repository data"
              disabled={githubRepositoriesFetching}
              onClick={() => void onRefreshRepositories()}
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
      <div className="table-panel">
        <div className="table-action-row surface-filter-row">
          <label className="surface-filter">
            <Search size={16} />
            <input
              aria-label="Filter repositories"
              placeholder="Filter repositories"
              value={collectionFilter}
              onChange={(event) => setCollectionFilter(event.target.value)}
            />
          </label>
          {collectionFilter.trim() && (
            <button type="button" onClick={() => setCollectionFilter("")}>
              <X size={16} /> Clear
            </button>
          )}
        </div>
        {repositoryPinError && (
          <div className="error-state">Local repository pin update failed: {repositoryPinError.message}</div>
        )}
        {showingGitHubArea &&
          filteredRepositories.map((repository) => {
            const pinned = pinnedRepositoryNames.some(
              (nameWithOwner) => nameWithOwner.toLowerCase() === repository.nameWithOwner.toLowerCase()
            );
            const metadataParts = repositoryCollectionMetadataParts(repository);

            return (
              <div className="issue-row repository-row repository-row-with-actions" key={repository.id}>
                <button
                  className="repository-row-main"
                  type="button"
                  onClick={() => onOpenRepository(repository.nameWithOwner)}
                >
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
                    title={
                      repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.nameWithOwner}`
                    }
                    onClick={() => onToggleRepositoryPin(repository.nameWithOwner)}
                  >
                    <Pin size={15} />
                  </button>
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label={`Open GitHub fallback for ${repository.name}`}
                    title={`Open GitHub fallback for ${repository.nameWithOwner}`}
                    onClick={() => onOpenExternal(`https://github.com/${repository.nameWithOwner}`)}
                  >
                    <ExternalLink size={15} />
                  </button>
                </span>
              </div>
            );
          })}
        {!showingGitHubArea &&
          filteredLocalRepositories.map((repository) => {
            const pinned = pinnedAreaRepositoryKeys.has(
              areaRepositoryPinKey(repository.areaId, repository.id, null)
            );
            const secondary =
              repository.connection?.nameWithOwner ??
              repository.path ??
              `${repository.kind.toUpperCase()} repository`;
            const healthChip =
              repository.health.status === "ready"
                ? null
                : (repository.health.message ?? repository.health.status);
            const connection = repository.connection;

            return (
              <div className="issue-row repository-row repository-row-with-actions" key={repository.id}>
                <button
                  className="repository-row-main"
                  type="button"
                  onClick={() => onOpenLocalRepository(repository)}
                >
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
                    title={
                      repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.displayName}`
                    }
                    onClick={() => onToggleAreaRepositoryPin(repository)}
                  >
                    <Pin size={15} />
                  </button>
                  {connection && (
                    <button
                      className="pin-row-button"
                      type="button"
                      aria-label={`Open GitHub fallback for ${repository.displayName}`}
                      title={`Open GitHub fallback for ${connection.nameWithOwner}`}
                      onClick={() => onOpenExternal(connection.url)}
                    >
                      <ExternalLink size={15} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        {showingGitHubArea &&
          showDirectRepositoryTarget &&
          directRepositoryTarget &&
          directRepositoryName &&
          directRepositoryOwner && (
            <div
              className="issue-row repository-row repository-row-with-actions"
              key="direct-repository-target"
            >
              <button
                className="repository-row-main"
                type="button"
                onClick={() => {
                  onOpenRepository(directRepositoryTarget);
                  setCollectionFilter("");
                }}
              >
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
          )}
        {showingGitHubArea && canExpandRepositories && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandRepositories}>
              Load more repositories
            </button>
          </div>
        )}
        {showingGitHubArea && !canExpandRepositories && repositoriesLimitHit && (
          <div className="muted-row">
            Showing the first {repositoryListLimit} repositories returned by GitHub.
          </div>
        )}
        {showingGitHubArea &&
          (githubRepositoriesLoading || githubRepositoriesFetching) &&
          repositoryItems.length === 0 && <div className="loading-state">Loading GitHub repositories…</div>}
        {showingGitHubArea && githubRepositoriesError instanceof Error && (
          <div className="error-state">
            Could not load GitHub repositories: {githubRepositoriesError.message}
          </div>
        )}
        {showingGitHubArea && repositoriesAvailabilityMessage && (
          <div className="error-state">{repositoriesAvailabilityMessage}</div>
        )}
        {!showingGitHubArea && localRepositoriesLoading && filteredLocalRepositories.length === 0 && (
          <div className="loading-state">Scanning this Area for repositories.</div>
        )}
        {!showingGitHubArea &&
          selectedArea?.health.status !== "ready" &&
          selectedArea?.health.message &&
          filteredLocalRepositories.length > 0 && (
            <div className="error-state">{selectedArea.health.message}</div>
          )}
        {!showingGitHubArea && !localRepositoriesLoading && filteredLocalRepositories.length === 0 && (
          <div className={selectedArea?.health.status === "ready" ? "empty-state" : "error-state"}>
            {selectedArea?.health.message ??
              (localRepositories.length === 0
                ? "No repositories found in this Area."
                : "No repositories match this filter.")}
          </div>
        )}
        {showingGitHubArea &&
          !githubRepositoriesLoading &&
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
      </div>
    </section>
  );
}
