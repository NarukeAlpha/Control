import { RefreshCw, X } from "lucide-react";
import { useState, type JSX } from "react";

import type { AreaRepositorySummary, AreaSummary } from "@shared/areas";
import type { LocalRecentItem } from "@shared/local";

import { Metric } from "../shared/Metric";

export function LocalAreaHome({
  area,
  repositories,
  repositoriesLoading,
  recentItems,
  onOpenRepository,
  onOpenRecent,
  onRefresh,
  onStopGateway
}: {
  area: AreaSummary;
  repositories: AreaRepositorySummary[];
  repositoriesLoading: boolean;
  recentItems: LocalRecentItem[];
  onOpenRepository(repository: AreaRepositorySummary): void;
  onOpenRecent(item: LocalRecentItem): void;
  onRefresh(): Promise<void>;
  onStopGateway(): Promise<void>;
}): JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const [stoppingGateway, setStoppingGateway] = useState(false);
  const connectedRepositories = repositories.filter((repository) => repository.connection);
  const dirtyRepositories = repositories.filter((repository) => repository.isDirty);
  const jjRepositories = repositories.filter((repository) => repository.kind === "jj");
  const recentLocalRepositories = recentItems
    .filter((item) => item.provider === "local" && item.kind === "repository" && item.areaId === area.id)
    .slice(0, 6);
  const visibleRepositories = [...repositories]
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt ?? left.scannedAt ?? "0") || 0;
      const rightTime = Date.parse(right.updatedAt ?? right.scannedAt ?? "0") || 0;
      return rightTime - leftTime || left.displayName.localeCompare(right.displayName);
    })
    .slice(0, 8);

  return (
    <section className="home-dashboard">
      <header className="account-hero">
        <span className="avatar-placeholder">{area.kind === "ssh" ? "S" : "L"}</span>
        <div>
          <h1>{area.label}</h1>
          <p>{area.rootPath ?? area.subtitle ?? "Area"}</p>
          {area.health.message && <small>{area.health.message}</small>}
          {area.gateway && <small>Gateway {area.gateway.status}</small>}
        </div>
        <div className="surface-header-actions">
          {area.gateway && area.gateway.status !== "stopped" && area.gateway.status !== "not-installed" && (
            <button
              type="button"
              disabled={stoppingGateway}
              onClick={() => {
                setStoppingGateway(true);
                void onStopGateway().finally(() => setStoppingGateway(false));
              }}
            >
              <X size={16} /> {stoppingGateway ? "Stopping" : "Stop gateway"}
            </button>
          )}
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void onRefresh().finally(() => setRefreshing(false));
            }}
          >
            <RefreshCw size={16} /> {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <section className="home-metrics">
        <Metric label="Repositories" value={repositories.length || area.repositoryCount} />
        <Metric label="GitHub remotes" value={connectedRepositories.length} />
        <Metric label="Changed" value={dirtyRepositories.length} />
        <Metric label="JJ" value={jjRepositories.length} />
      </section>

      <section className="home-grid">
        <div className="home-panel">
          <div className="surface-header">
            <div>
              <h2>Local repositories</h2>
              <p>
                {repositoriesLoading ? "Scanning local Area." : `${repositories.length} repositories loaded.`}
              </p>
            </div>
          </div>
          <div className="shortcut-list">
            {visibleRepositories.length ? (
              visibleRepositories.map((repository) => (
                <button
                  key={repository.id}
                  type="button"
                  className="shortcut-item"
                  onClick={() => onOpenRepository(repository)}
                >
                  <span className="repo-avatar">{repository.kind === "jj" ? "J" : "G"}</span>
                  <span>
                    <strong>{repository.displayName}</strong>
                    <small>
                      {repository.connection?.nameWithOwner ?? repository.path ?? repository.kind}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted-row">
                {repositoriesLoading ? "Scanning for local repositories." : "No local repositories found."}
              </p>
            )}
          </div>
        </div>

        <div className="home-panel">
          <div className="surface-header">
            <div>
              <h2>Recent local work</h2>
              <p>
                {recentLocalRepositories.length ? "Latest local repository routes." : "No local recents yet."}
              </p>
            </div>
          </div>
          <div className="shortcut-list">
            {recentLocalRepositories.length ? (
              recentLocalRepositories.map((item) => (
                <button
                  key={`${item.kind}-${item.itemKey}`}
                  type="button"
                  className="shortcut-item"
                  onClick={() => onOpenRecent(item)}
                >
                  <span className="repo-avatar">R</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle ?? item.repositoryNameWithOwner ?? item.repositoryId}</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted-row">Open a local repository to add it here.</p>
            )}
          </div>
        </div>

        <div className="home-panel">
          <div className="surface-header">
            <div>
              <h2>GitHub remotes</h2>
              <p>
                {connectedRepositories.length ? "Connected local repositories." : "No GitHub remotes found."}
              </p>
            </div>
          </div>
          <div className="shortcut-list">
            {connectedRepositories.length ? (
              connectedRepositories.slice(0, 6).map((repository) => (
                <button
                  key={repository.id}
                  type="button"
                  className="shortcut-item"
                  onClick={() => onOpenRepository(repository)}
                >
                  <span className="repo-avatar">
                    {repository.connection?.owner.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{repository.connection?.nameWithOwner}</strong>
                    <small>{repository.displayName}</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted-row">Add an origin remote to connect a local repository to GitHub.</p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
