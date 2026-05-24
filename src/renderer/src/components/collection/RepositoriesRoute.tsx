import { ExternalLink, Pin, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { JSX } from "react";

import { useRepositoryDirectory } from "../../hooks/useRepositoryDirectory";
import { formatRelativeDate } from "../../utils/format";
import { repositoryCollectionMetadataParts, readAvailabilityMessage } from "../repository/repositoryUi";
import {
  displayRepositoryName,
  maxRepositoryListLimit,
  repositoryActivityDate,
  repositoryNameWithOwnerInput,
  sortRepositoriesByActivity
} from "../repository/repositorySearch";
import { matchesCollectionFilter } from "./collectionUi";

export interface RepositoriesRouteProps {
  title: string;
  appReady: boolean;
  githubReady: boolean;
  repositoryListLimit: number;
  pinnedRepositoryNames: string[];
  repositoryPinBusy: boolean;
  repositoryPinError: Error | null;
  viewerLogin: string | null;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenAddRepository(): void;
  onExpandRepositories(): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
}

export function RepositoriesRoute({
  title,
  appReady,
  githubReady,
  repositoryListLimit,
  pinnedRepositoryNames,
  repositoryPinBusy,
  repositoryPinError,
  viewerLogin,
  onOpenExternal,
  onOpenRepository,
  onOpenAddRepository,
  onExpandRepositories,
  onToggleRepositoryPin
}: RepositoriesRouteProps): JSX.Element {
  const [collectionFilter, setCollectionFilter] = useState("");
  const repositories = useRepositoryDirectory(repositoryListLimit, {
    enabled: appReady,
    githubReady
  });
  const repositoryItems = useMemo(() => repositories.data?.items ?? [], [repositories.data]);
  const repositoriesAvailabilityMessage =
    repositories.data?.availability?.status === "stale"
      ? null
      : readAvailabilityMessage("Repositories", repositories.data?.availability ?? null);
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
  const showDirectRepositoryTarget = Boolean(directRepositoryTarget && !directRepositoryTargetAlreadyLoaded);
  const directRepositoryName = directRepositoryTarget?.split("/")[1] ?? null;
  const directRepositoryOwner = directRepositoryTarget?.split("/")[0] ?? null;
  const repositoryPinDisabledReason = repositoryPinBusy ? "Repository pin update is still running." : null;

  return (
    <section className="collection-view">
      <header>
        <h2>{title}</h2>
        <div className="collection-actions">
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
        {filteredRepositories.map((repository) => {
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
        {showDirectRepositoryTarget &&
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
        {(repositories.isLoading || repositories.isFetching) && repositoryItems.length === 0 && (
          <div className="loading-state">Loading GitHub repositories…</div>
        )}
        {repositories.error instanceof Error && (
          <div className="error-state">Could not load GitHub repositories: {repositories.error.message}</div>
        )}
        {repositoriesAvailabilityMessage && (
          <div className="error-state">{repositoriesAvailabilityMessage}</div>
        )}
        {!repositories.isLoading &&
          !repositories.isFetching &&
          !(repositories.error instanceof Error) &&
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
