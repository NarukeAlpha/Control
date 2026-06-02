import { RefreshCw, X } from "lucide-react";
import { useState, type JSX } from "react";

import type { AreaRepositorySummary, AreaSummary } from "@shared/areas";
import type { LocalRecentItem } from "@shared/local";

import { Metric } from "../shared/Metric";
import { formatRelativeDate } from "../../utils/format";

function localRecentKindLabel(kind: LocalRecentItem["kind"]): string {
  switch (kind) {
    case "repository":
      return "Repository";
    case "commit":
      return "Commit";
    case "issue":
      return "Issue";
    case "pullRequest":
      return "Pull request";
    case "discussion":
      return "Discussion";
    case "organization":
      return "Organization";
    case "team":
      return "Team";
    case "contributor":
      return "Contributor";
    case "project":
      return "Project";
    case "release":
      return "Release";
    case "releaseAsset":
      return "Asset";
    case "workflowRun":
      return "Workflow run";
    case "workflowArtifact":
      return "Artifact";
    case "securityItem":
      return "Security";
    case "wikiPage":
      return "Wiki";
    case "file":
      return "File";
    default:
      return "Local";
  }
}

function localRecentKindMark(kind: LocalRecentItem["kind"]): string {
  return localRecentKindLabel(kind).slice(0, 1);
}

function localRecentSubtitle(item: LocalRecentItem): string {
  return item.subtitle ?? item.repositoryNameWithOwner ?? item.repositoryId ?? item.url ?? "Local work";
}

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
  const dirtyRepositories = repositories.filter((repository) => repository.isDirty);
  const gitRepositories = repositories.filter(
    (repository) => repository.kind === "git" || repository.kind === "github"
  );
  const jjRepositories = repositories.filter((repository) => repository.kind === "jj");
  const recentLocalWork = recentItems
    .filter((item) => item.provider === "local" && item.areaId === area.id)
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
        <Metric label="Changed" value={dirtyRepositories.length} />
        <Metric label="Git" value={gitRepositories.length} />
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
              <p>{recentLocalWork.length ? "Latest local routes in this Area." : "No local recents yet."}</p>
            </div>
          </div>
          <div className="local-recent-list">
            {recentLocalWork.length ? (
              recentLocalWork.map((item) => (
                <button
                  key={`${item.kind}-${item.itemKey}`}
                  type="button"
                  className="local-recent-item"
                  onClick={() => onOpenRecent(item)}
                >
                  <span className="local-recent-icon">{localRecentKindMark(item.kind)}</span>
                  <span className="local-recent-copy">
                    <strong>{item.title}</strong>
                    <small>{localRecentSubtitle(item)}</small>
                  </span>
                  <span className="local-recent-meta">
                    <span className="state-chip">{localRecentKindLabel(item.kind)}</span>
                    <time dateTime={item.updatedAt}>{formatRelativeDate(item.updatedAt)}</time>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted-row">Open a local repository to add it here.</p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
