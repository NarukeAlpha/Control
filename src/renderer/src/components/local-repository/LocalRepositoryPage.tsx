import {
  CheckCircle2,
  CircleDot,
  Code2,
  ExternalLink,
  File as FileIcon,
  Folder,
  Gauge,
  GitBranch,
  GitFork,
  GitPullRequest,
  MoreHorizontal,
  Pin,
  PlayCircle,
  RefreshCw,
  Workflow
} from "lucide-react";
import type { JSX } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type {
  AreaFileContent,
  AreaFileEntry,
  AreaGatewayOperationInput,
  AreaGatewayOperationResult,
  AreaRepositoryDetail,
  AreaRepositorySummary,
  AreaSyncStatus
} from "@shared/areas";
import { useControlApi } from "../../hooks/useControlApi";
import type { AppRoute, LocalRepositoryTab } from "../../stores/uiStore";
import { readAvailabilityMessage } from "../repository/repositoryUi";

const localRepoTabs: Array<{ key: LocalRepositoryTab; label: string; icon: typeof Code2 }> = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "code", label: "Code", icon: Code2 },
  { key: "branches", label: "Branches", icon: GitBranch },
  { key: "bookmarks", label: "Bookmarks", icon: Pin },
  { key: "remotes", label: "Remotes", icon: GitFork },
  { key: "issues", label: "Issues", icon: CircleDot },
  { key: "pulls", label: "Pull requests", icon: GitPullRequest },
  { key: "actions", label: "Actions", icon: PlayCircle },
  { key: "sync", label: "Sync", icon: RefreshCw },
  { key: "status", label: "Status", icon: CheckCircle2 },
  { key: "activity", label: "Activity", icon: Workflow },
  { key: "workspaces", label: "Workspaces", icon: Folder },
  { key: "operations", label: "Operations", icon: MoreHorizontal }
];

function localRepositoryTabDisabledReason(
  detail: AreaRepositoryDetail,
  tab: LocalRepositoryTab
): string | null {
  if (
    detail.kind === "jj" &&
    detail.health.status === "error" &&
    (tab === "bookmarks" || tab === "operations")
  ) {
    return detail.health.message ?? "JJ is unavailable.";
  }
  return null;
}

export function LocalRepositoryPage({
  route,
  activeTab,
  activePath,
  pinned,
  pinBusy,
  onSelectTab,
  onOpenPath,
  onTogglePin,
  onOpenGitHub,
  onOpenExternal
}: {
  route: Extract<AppRoute, { kind: "localRepository" }>;
  activeTab: LocalRepositoryTab;
  activePath: string;
  pinned: boolean;
  pinBusy: boolean;
  onSelectTab(tab: LocalRepositoryTab): void;
  onOpenPath(entry: AreaFileEntry): void;
  onTogglePin(repository: AreaRepositorySummary, workspaceId: string | null): void;
  onOpenGitHub(nameWithOwner: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const api = useControlApi();
  const repository = useQuery({
    queryKey: ["area-repository", route.areaId, route.repositoryId],
    queryFn: () =>
      api.areas.getRepository({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null
      })
  });
  const workspaces = useQuery({
    queryKey: ["area-workspaces", route.areaId, route.repositoryId],
    queryFn: () => api.areas.listWorkspaces({ areaId: route.areaId, repositoryId: route.repositoryId })
  });
  const contents = useQuery({
    queryKey: ["area-contents", route.areaId, route.repositoryId, route.workspaceId ?? "none", activePath],
    queryFn: () =>
      api.areas.listContents({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        path: activePath
      }),
    enabled: activeTab === "code"
  });
  const fileContent = useQuery({
    queryKey: [
      "area-file-content",
      route.areaId,
      route.repositoryId,
      route.workspaceId ?? "none",
      activePath
    ],
    queryFn: () =>
      api.areas.getFileContent({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        path: activePath
      }),
    enabled: activeTab === "code" && activePath !== "."
  });
  const detail = repository.data;
  const workspaceItems = workspaces.data ?? detail?.workspaces ?? [];
  const githubConnection = detail?.connection ?? null;
  const localIssues = useQuery({
    queryKey: ["area-github-issues", route.areaId, route.repositoryId, route.workspaceId ?? "none"],
    queryFn: () =>
      api.areas.listGitHubIssues({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        state: "open",
        limit: 20
      }),
    enabled: activeTab === "issues" && Boolean(detail)
  });
  const localPulls = useQuery({
    queryKey: ["area-github-pulls", route.areaId, route.repositoryId, route.workspaceId ?? "none"],
    queryFn: () =>
      api.areas.listGitHubPullRequests({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        state: "open",
        limit: 20
      }),
    enabled: activeTab === "pulls" && Boolean(detail)
  });
  const localActions = useQuery({
    queryKey: ["area-github-actions", route.areaId, route.repositoryId, route.workspaceId ?? "none"],
    queryFn: () =>
      api.areas.listGitHubActions({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        limit: 20
      }),
    enabled: activeTab === "actions" && Boolean(detail)
  });
  const syncStatus = useQuery({
    queryKey: ["area-sync-status", route.areaId, route.repositoryId, route.workspaceId ?? "none"],
    queryFn: () =>
      api.areas.getSyncStatus({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null
      }),
    enabled: activeTab === "sync" && Boolean(detail)
  });
  const gatewayOperation = useMutation({
    mutationFn: async (kind: AreaGatewayOperationInput["kind"]) => {
      const preview = await api.areas.prepareGatewayOperation({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        kind
      });
      if (!window.confirm(`${preview.title}\n\n${preview.summary}`)) {
        return null;
      }
      return api.areas.runGatewayOperation({
        areaId: route.areaId,
        operationId: preview.id,
        confirmed: true
      });
    },
    onSuccess: async () => {
      await syncStatus.refetch();
      await repository.refetch();
    }
  });
  const localIssuesAvailabilityMessage = readAvailabilityMessage(
    "GitHub issues",
    localIssues.data?.availability ?? null
  );
  const localPullsAvailabilityMessage = readAvailabilityMessage(
    "GitHub pull requests",
    localPulls.data?.availability ?? null
  );
  const localActionsAvailabilityMessage = readAvailabilityMessage(
    "GitHub actions",
    localActions.data?.availability ?? null
  );
  const status = detail?.status;

  if (repository.isLoading) {
    return <div className="loading-state">Loading local repository...</div>;
  }
  if (repository.error || !detail) {
    return (
      <div className="error-state">
        Local repository unavailable
        {repository.error instanceof Error ? `: ${repository.error.message}` : "."}
      </div>
    );
  }

  return (
    <section className="local-repository-page">
      <header className="local-repository-header">
        <div>
          <div className="eyebrow-row">
            <span className="status-pill">{detail.kind.toUpperCase()}</span>
            {detail.capabilities.isGitBacked && <span className="status-pill">Git-backed</span>}
            {detail.capabilities.isColocated && <span className="status-pill">Colocated</span>}
            {githubConnection && <span className="status-pill">GitHub connected</span>}
          </div>
          <h1>{detail.displayName}</h1>
          {detail.path && <p className="muted-row">{detail.path}</p>}
          {detail.health.message && <p className="error-state">{detail.health.message}</p>}
        </div>
        <div className="button-row">
          <button
            className="icon-button"
            type="button"
            aria-label={pinned ? "Unpin local repository" : "Pin local repository"}
            title={pinned ? "Unpin local repository" : "Pin local repository"}
            disabled={pinBusy}
            onClick={() => onTogglePin(detail, route.workspaceId ?? null)}
          >
            <Pin size={16} fill={pinned ? "currentColor" : "none"} />
          </button>
          {githubConnection?.matchedGitHubAreaId && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => onOpenGitHub(githubConnection.nameWithOwner)}
            >
              Open in GitHub Area
            </button>
          )}
          {githubConnection && (
            <button
              className="icon-button"
              type="button"
              title="Open on GitHub"
              onClick={() => onOpenExternal(githubConnection.url)}
            >
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </header>

      <nav className="repo-tabs">
        {localRepoTabs.map((tab) => {
          const Icon = tab.icon;
          const disabledReason = localRepositoryTabDisabledReason(detail, tab.key);
          return (
            <button
              className={activeTab === tab.key ? "active" : ""}
              disabled={Boolean(disabledReason)}
              key={tab.key}
              type="button"
              title={disabledReason ?? tab.label}
              onClick={() => onSelectTab(tab.key)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "overview" && (
        <div className="local-repository-grid">
          <section className="glass-panel">
            <h2>Repository</h2>
            <dl className="definition-list">
              <div>
                <dt>Path</dt>
                <dd>{detail.path ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Current branch</dt>
                <dd>{detail.currentBranch ?? "None"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{status?.clean ? "Clean" : `${status?.dirtyCount ?? 0} changed`}</dd>
              </div>
              <div>
                <dt>Remote</dt>
                <dd>{githubConnection?.nameWithOwner ?? "No GitHub remote"}</dd>
              </div>
            </dl>
          </section>
          <section className="glass-panel">
            <h2>Workspaces</h2>
            {workspaceItems.length ? (
              <ul className="plain-list">
                {workspaceItems.map((workspace) => (
                  <li key={workspace.id}>
                    <strong>{workspace.name}</strong>
                    <span>{workspace.rootPath}</span>
                    {workspace.isStale && <span className="status-pill">Stale</span>}
                    {workspace.health.message && <small>{workspace.health.message}</small>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-row">No extra workspaces.</p>
            )}
          </section>
        </div>
      )}

      {activeTab === "code" && (
        <LocalCodePanel
          activePath={activePath}
          contents={contents.data ?? []}
          contentsLoading={contents.isLoading || contents.isFetching}
          contentsError={contents.error}
          fileContent={fileContent.data ?? null}
          fileLoading={fileContent.isLoading || fileContent.isFetching}
          onOpenPath={onOpenPath}
        />
      )}

      {activeTab === "branches" && (
        <LocalListPanel
          title="Branches"
          rows={detail.branches.map((branch) => `${branch.name}${branch.current ? " current" : ""}`)}
        />
      )}
      {activeTab === "bookmarks" && (
        <LocalListPanel
          title="Bookmarks"
          rows={detail.bookmarks.map(
            (bookmark) => `${bookmark.name}${bookmark.target ? ` ${bookmark.target}` : ""}`
          )}
        />
      )}
      {activeTab === "remotes" && (
        <LocalListPanel
          title="Remotes"
          rows={detail.remotes.map((remote) => `${remote.name} ${remote.fetchUrl ?? ""}`)}
        />
      )}
      {activeTab === "issues" && (
        <LocalListPanel
          title="GitHub Issues"
          rows={(localIssues.data?.items ?? []).map((issue) => `#${issue.number} ${issue.title}`)}
          emptyLabel={
            localIssuesAvailabilityMessage ??
            (githubConnection ? "No open issues." : "No GitHub remote is connected.")
          }
          loading={localIssues.isLoading || localIssues.isFetching}
          error={localIssues.error}
        />
      )}
      {activeTab === "pulls" && (
        <LocalListPanel
          title="GitHub Pull Requests"
          rows={(localPulls.data?.items ?? []).map((pull) => `#${pull.number} ${pull.title}`)}
          emptyLabel={
            localPullsAvailabilityMessage ??
            (githubConnection ? "No open pull requests." : "No GitHub remote is connected.")
          }
          loading={localPulls.isLoading || localPulls.isFetching}
          error={localPulls.error}
        />
      )}
      {activeTab === "actions" && (
        <LocalListPanel
          title="GitHub Actions"
          rows={(localActions.data?.items ?? []).map((run) => `${run.name} ${run.status ?? "unknown"}`)}
          emptyLabel={
            localActionsAvailabilityMessage ??
            (githubConnection ? "No workflow runs." : "No GitHub remote is connected.")
          }
          loading={localActions.isLoading || localActions.isFetching}
          error={localActions.error}
        />
      )}
      {activeTab === "sync" && (
        <LocalSyncPanel
          detail={detail}
          syncStatus={syncStatus.data ?? null}
          loading={syncStatus.isLoading || syncStatus.isFetching}
          error={syncStatus.error}
          operationPending={gatewayOperation.isPending}
          operationResult={gatewayOperation.data ?? null}
          onRunOperation={(kind) => gatewayOperation.mutate(kind)}
        />
      )}
      {activeTab === "status" && (
        <LocalListPanel
          title="Status"
          rows={detail.status.entries.map(
            (entry) => `${entry.indexStatus ?? ""}${entry.workingTreeStatus ?? ""} ${entry.path}`
          )}
          emptyLabel={detail.status.clean ? "Working tree is clean." : "No status entries."}
        />
      )}
      {activeTab === "activity" && (
        <LocalListPanel
          title="Activity"
          rows={detail.recentCommits.map((commit) => `${commit.shortId} ${commit.summary}`)}
        />
      )}
      {activeTab === "workspaces" && (
        <LocalListPanel
          title="Workspaces"
          rows={workspaceItems.map((workspace) => `${workspace.name} ${workspace.rootPath}`)}
        />
      )}
      {activeTab === "operations" && (
        <LocalListPanel
          title="Operations"
          rows={detail.recentOperations.map((operation) => `${operation.shortId} ${operation.description}`)}
        />
      )}
    </section>
  );
}

function LocalSyncPanel({
  detail,
  syncStatus,
  loading,
  error,
  operationPending,
  operationResult,
  onRunOperation
}: {
  detail: AreaRepositoryDetail;
  syncStatus: AreaSyncStatus | null;
  loading: boolean;
  error: Error | null;
  operationPending: boolean;
  operationResult: AreaGatewayOperationResult | null;
  onRunOperation(kind: AreaGatewayOperationInput["kind"]): void;
}): JSX.Element {
  const fetchKind = detail.kind === "jj" ? "jj.git.fetch" : "git.fetch";
  const pushKind = detail.kind === "jj" ? "jj.git.push" : "git.push";
  const canFetch = syncStatus?.capabilities.canFetch ?? Boolean(detail.remotes.length);
  const canPush = syncStatus?.capabilities.canPush ?? Boolean(detail.remotes.length);

  return (
    <section className="glass-panel local-sync-panel">
      <div className="section-title-row">
        <h2>Sync</h2>
        <div className="button-row">
          <button
            className="secondary-button"
            type="button"
            disabled={!canFetch || operationPending}
            onClick={() => onRunOperation(fetchKind)}
          >
            <RefreshCw size={15} /> Fetch
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!canPush || operationPending}
            onClick={() => onRunOperation(pushKind)}
          >
            <GitBranch size={15} /> Push
          </button>
        </div>
      </div>
      {loading && <div className="loading-state">Loading sync state...</div>}
      {error && <div className="error-state">Sync state unavailable: {error.message}</div>}
      {syncStatus && (
        <dl className="definition-list">
          <div>
            <dt>Provider</dt>
            <dd>{syncStatus.provider.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Current branch</dt>
            <dd>{syncStatus.currentBranch ?? "None"}</dd>
          </div>
          <div>
            <dt>Current bookmark</dt>
            <dd>{syncStatus.currentBookmark ?? "None"}</dd>
          </div>
          <div>
            <dt>Working copy</dt>
            <dd>{syncStatus.hasUncommittedChanges ? "Changed" : "Clean or unknown"}</dd>
          </div>
        </dl>
      )}
      <div className="local-file-list">
        {(syncStatus?.remotes.length ? syncStatus.remotes : fallbackRemoteSyncRows(detail)).map((remote) => (
          <div className="shortcut-item" key={remote.name}>
            <span className="repo-avatar">R</span>
            <span>
              <strong>{remote.name}</strong>
              <small>
                {remote.status}
                {remote.ahead !== null || remote.behind !== null
                  ? ` · ahead ${remote.ahead ?? 0} · behind ${remote.behind ?? 0}`
                  : ""}
              </small>
            </span>
          </div>
        ))}
      </div>
      {operationPending && <div className="loading-state">Running gateway operation...</div>}
      {operationResult && (
        <div className={operationResult.status === "succeeded" ? "muted-row" : "error-state"}>
          {operationResult.message}
        </div>
      )}
    </section>
  );
}

function LocalCodePanel({
  activePath,
  contents,
  contentsLoading,
  contentsError,
  fileContent,
  fileLoading,
  onOpenPath
}: {
  activePath: string;
  contents: AreaFileEntry[];
  contentsLoading: boolean;
  contentsError: Error | null;
  fileContent: AreaFileContent | null;
  fileLoading: boolean;
  onOpenPath(entry: AreaFileEntry): void;
}): JSX.Element {
  const textContent = fileContent?.kind === "text" ? fileContent.text : null;
  return (
    <section className="glass-panel local-code-panel">
      <div className="section-title-row">
        <h2>{activePath === "." ? "Files" : activePath}</h2>
      </div>
      {textContent !== null ? (
        <pre className="local-file-preview">{textContent}</pre>
      ) : (
        <>
          {fileLoading && <div className="loading-state">Loading file...</div>}
          {fileContent?.kind === "binary" && <div className="muted-row">{fileContent.message}</div>}
          {fileContent?.kind === "unavailable" && (
            <div className="muted-row">{fileContent.message ?? "File content is unavailable."}</div>
          )}
          {contentsLoading && <div className="loading-state">Loading directory...</div>}
          {contentsError && <div className="error-state">Directory unavailable: {contentsError.message}</div>}
          <div className="local-file-list">
            {contents.map((entry) => (
              <button key={entry.path} type="button" onClick={() => onOpenPath(entry)}>
                {entry.type === "dir" ? <Folder size={15} /> : <FileIcon size={15} />}
                <span>{entry.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function LocalListPanel({
  title,
  rows,
  emptyLabel = "Nothing to show.",
  loading = false,
  error = null
}: {
  title: string;
  rows: string[];
  emptyLabel?: string;
  loading?: boolean;
  error?: Error | null;
}): JSX.Element {
  return (
    <section className="glass-panel">
      <h2>{title}</h2>
      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : error ? (
        <div className="error-state">{error.message}</div>
      ) : rows.length ? (
        <ul className="plain-list">
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : (
        <p className="muted-row">{emptyLabel}</p>
      )}
    </section>
  );
}

function fallbackRemoteSyncRows(detail: AreaRepositoryDetail): AreaSyncStatus["remotes"] {
  return detail.remotes.map((remote) => ({
    name: remote.name,
    fetchUrl: remote.fetchUrl,
    pushUrl: remote.pushUrl,
    status: "unknown",
    ahead: detail.status.ahead,
    behind: detail.status.behind,
    lastFetchedAt: null,
    message: null
  }));
}
