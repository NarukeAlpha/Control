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
import { useEffect, useMemo, useState, type ChangeEvent, type JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AreaFileContent,
  AreaFileEntry,
  AreaGatewayOperationInput,
  AreaGatewayOperationResult,
  AreaRepositoryDetail,
  AreaRepositorySummary,
  AreaSyncStatus,
  AreaWorkspaceSummary
} from "@shared/areas";
import { useControlApi } from "../../hooks/useControlApi";
import type { AppRoute, LocalRepositoryTab } from "../../stores/uiStore";
import type { ConfirmAction } from "../dialogs/confirmation";
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

interface LocalGatewayOperationFeedback {
  kind: AreaGatewayOperationInput["kind"];
  result: AreaGatewayOperationResult | null;
  error: Error | null;
}

interface LocalRepositoryPageProps {
  route: Extract<AppRoute, { kind: "localRepository" }>;
  activeTab: LocalRepositoryTab;
  activePath: string;
  pinned: boolean;
  pinBusy: boolean;
  onSelectTab(tab: LocalRepositoryTab): void;
  onSelectWorkspace(workspaceId: string): void;
  onOpenPath(entry: AreaFileEntry): void;
  onTogglePin(repository: AreaRepositorySummary, workspaceId: string | null): void;
  onOpenGitHub(nameWithOwner: string): void;
  onOpenExternal(url: string): void;
  onConfirm: ConfirmAction;
  githubReady: boolean;
}

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

function useLocalRepositoryPageModel({
  route,
  activeTab,
  activePath,
  pinned,
  pinBusy,
  onSelectTab,
  onSelectWorkspace,
  onOpenPath,
  onTogglePin,
  onOpenGitHub,
  onOpenExternal,
  onConfirm,
  githubReady
}: LocalRepositoryPageProps) {
  const api = useControlApi();
  const queryClient = useQueryClient();
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
  const workspaceItems = useMemo(
    () => sortWorkspaces(workspaces.data ?? detail?.workspaces ?? []),
    [detail?.workspaces, workspaces.data]
  );
  const selectedWorkspace = route.workspaceId
    ? (workspaceItems.find((workspace) => workspace.id === route.workspaceId) ?? null)
    : null;
  const githubConnection = detail?.connection ?? null;
  const localIssues = useQuery({
    queryKey: ["area-github-issues", route.areaId, route.repositoryId, route.workspaceId ?? "none"],
    queryFn: () =>
      api.areas.listGitHubIssues({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        state: "open",
        limit: 20,
        cacheOnly: !githubReady
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
        limit: 20,
        cacheOnly: !githubReady
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
        limit: 20,
        cacheOnly: !githubReady
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
  const [lastOperationFeedback, setLastOperationFeedback] = useState<LocalGatewayOperationFeedback | null>(
    null
  );
  const gatewayOperation = useMutation({
    mutationFn: async (kind: AreaGatewayOperationInput["kind"]) => {
      const preview = await api.areas.prepareGatewayOperation({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null,
        kind
      });
      const confirmed = await onConfirm({
        title: preview.title,
        message: preview.summary,
        confirmLabel: "Run operation",
        tone: "danger"
      });
      if (!confirmed) {
        return { kind, result: null };
      }
      const result = await api.areas.runGatewayOperation({
        areaId: route.areaId,
        operationId: preview.id,
        confirmed: true
      });
      return { kind, result };
    },
    onSuccess: async (feedback) => {
      if (!feedback.result) {
        return;
      }

      setLastOperationFeedback({ kind: feedback.kind, result: feedback.result, error: null });
      const workspaceScope = [route.areaId, route.repositoryId, route.workspaceId ?? "none"] as const;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["area-repository", route.areaId, route.repositoryId] }),
        queryClient.invalidateQueries({ queryKey: ["area-workspaces", route.areaId, route.repositoryId] }),
        queryClient.invalidateQueries({ queryKey: ["area-contents", ...workspaceScope] }),
        queryClient.invalidateQueries({ queryKey: ["area-file-content", ...workspaceScope] }),
        queryClient.invalidateQueries({ queryKey: ["area-sync-status", ...workspaceScope] }),
        queryClient.invalidateQueries({ queryKey: ["area-github-issues", ...workspaceScope] }),
        queryClient.invalidateQueries({ queryKey: ["area-github-pulls", ...workspaceScope] }),
        queryClient.invalidateQueries({ queryKey: ["area-github-actions", ...workspaceScope] })
      ]);
    },
    onError: (error, kind) => {
      setLastOperationFeedback({
        kind,
        result: null,
        error: error instanceof Error ? error : new Error("Gateway operation failed.")
      });
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

  useEffect(() => {
    if (
      detail?.kind !== "jj" ||
      route.workspaceId ||
      workspaces.isLoading ||
      workspaces.isFetching ||
      workspaceItems.length === 0
    ) {
      return;
    }
    onSelectWorkspace(workspaceItems[0].id);
  }, [
    detail?.kind,
    onSelectWorkspace,
    route.workspaceId,
    workspaceItems,
    workspaces.isFetching,
    workspaces.isLoading
  ]);

  function runGatewayOperation(kind: AreaGatewayOperationInput["kind"]): void {
    gatewayOperation.mutate(kind);
  }

  return {
    route,
    activeTab,
    activePath,
    pinned,
    pinBusy,
    repositoryLoading: repository.isLoading,
    repositoryError: repository.error,
    detail,
    workspaceItems,
    selectedWorkspace,
    githubConnection,
    contents,
    fileContent,
    localIssues,
    localPulls,
    localActions,
    syncStatus,
    lastOperationFeedback,
    operationPending: gatewayOperation.isPending,
    localIssuesAvailabilityMessage,
    localPullsAvailabilityMessage,
    localActionsAvailabilityMessage,
    status,
    onSelectTab,
    onSelectWorkspace,
    onOpenPath,
    onTogglePin,
    onOpenGitHub,
    onOpenExternal,
    onRunOperation: runGatewayOperation
  };
}

export function LocalRepositoryPage(props: LocalRepositoryPageProps): JSX.Element {
  const model = useLocalRepositoryPageModel(props);

  if (model.repositoryLoading) {
    return <div className="loading-state">Loading local repository…</div>;
  }
  if (model.repositoryError || !model.detail) {
    return (
      <div className="error-state">
        Local repository unavailable
        {model.repositoryError instanceof Error ? `: ${model.repositoryError.message}` : "."}
      </div>
    );
  }

  return (
    <section className="local-repository-page">
      <LocalRepositoryHeader model={model} />
      <LocalRepositoryTabs
        activeTab={model.activeTab}
        detail={model.detail}
        onSelectTab={model.onSelectTab}
      />
      <LocalRepositoryTabContent model={model} />
    </section>
  );
}

function LocalRepositoryHeader({
  model
}: {
  model: ReturnType<typeof useLocalRepositoryPageModel>;
}): JSX.Element {
  const { detail, githubConnection, pinBusy, pinned, route, selectedWorkspace, workspaceItems } = model;

  function selectWorkspace(event: ChangeEvent<HTMLSelectElement>): void {
    if (event.target.value) {
      model.onSelectWorkspace(event.target.value);
    }
  }

  function toggleLocalRepositoryPin(): void {
    model.onTogglePin(detail!, route.workspaceId ?? null);
  }

  function openMatchedGitHubArea(): void {
    if (githubConnection) {
      model.onOpenGitHub(githubConnection.nameWithOwner);
    }
  }

  function openRepositoryOnGitHub(): void {
    if (githubConnection) {
      model.onOpenExternal(githubConnection.url);
    }
  }

  return (
    <header className="local-repository-header">
      <div>
        <div className="eyebrow-row">
          <span className="status-pill">{detail!.kind.toUpperCase()}</span>
          {detail!.capabilities.isGitBacked && <span className="status-pill">Git-backed</span>}
          {detail!.capabilities.isColocated && <span className="status-pill">Colocated</span>}
          {githubConnection && <span className="status-pill">GitHub connected</span>}
        </div>
        <h1>{detail!.displayName}</h1>
        {detail!.path && <p className="muted-row">{detail!.path}</p>}
        {detail!.health.message && <p className="error-state">{detail!.health.message}</p>}
        {detail!.kind === "jj" && route.workspaceId && !selectedWorkspace && (
          <p className="error-state">Local workspace was not found.</p>
        )}
      </div>
      <div className="button-row">
        {detail!.capabilities.supportsWorkspaces && workspaceItems.length > 0 && (
          <label className="local-workspace-select">
            <span>Workspace</span>
            <select value={route.workspaceId ?? ""} onChange={selectWorkspace}>
              {!route.workspaceId && <option value="">Repository root</option>}
              {workspaceItems.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                  {workspace.isStale ? " (stale)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="icon-button"
          type="button"
          aria-label={pinned ? "Unpin local repository" : "Pin local repository"}
          title={pinned ? "Unpin local repository" : "Pin local repository"}
          disabled={pinBusy}
          onClick={toggleLocalRepositoryPin}
        >
          <Pin size={16} fill={pinned ? "currentColor" : "none"} />
        </button>
        {githubConnection?.matchedGitHubAreaId && (
          <button className="secondary-button" type="button" onClick={openMatchedGitHubArea}>
            Open in GitHub Area
          </button>
        )}
        {githubConnection && (
          <button
            className="icon-button"
            type="button"
            title="Open on GitHub"
            onClick={openRepositoryOnGitHub}
          >
            <ExternalLink size={16} />
          </button>
        )}
      </div>
    </header>
  );
}

function LocalRepositoryTabs({
  activeTab,
  detail,
  onSelectTab
}: {
  activeTab: LocalRepositoryTab;
  detail: AreaRepositoryDetail;
  onSelectTab(tab: LocalRepositoryTab): void;
}): JSX.Element {
  return (
    <nav className="repo-tabs">
      {localRepoTabs.map((tab) => (
        <LocalRepositoryTabButton
          active={activeTab === tab.key}
          detail={detail}
          key={tab.key}
          tab={tab}
          onSelectTab={onSelectTab}
        />
      ))}
    </nav>
  );
}

function LocalRepositoryTabButton({
  active,
  detail,
  tab,
  onSelectTab
}: {
  active: boolean;
  detail: AreaRepositoryDetail;
  tab: (typeof localRepoTabs)[number];
  onSelectTab(tab: LocalRepositoryTab): void;
}): JSX.Element {
  const Icon = tab.icon;
  const disabledReason = localRepositoryTabDisabledReason(detail, tab.key);

  function selectRepositoryTab(): void {
    onSelectTab(tab.key);
  }

  return (
    <button
      className={active ? "active" : ""}
      disabled={Boolean(disabledReason)}
      type="button"
      title={disabledReason ?? tab.label}
      onClick={selectRepositoryTab}
    >
      <Icon size={15} />
      <span>{tab.label}</span>
    </button>
  );
}

function localBranchRow(branch: AreaRepositoryDetail["branches"][number]): string {
  return `${branch.name}${branch.current ? " current" : ""}`;
}

function localBookmarkRow(bookmark: AreaRepositoryDetail["bookmarks"][number]): string {
  return `${bookmark.name}${bookmark.target ? ` ${bookmark.target}` : ""}`;
}

function localRemoteRow(remote: AreaRepositoryDetail["remotes"][number]): string {
  return `${remote.name} ${remote.fetchUrl ?? ""}`;
}

function localStatusRow(entry: AreaRepositoryDetail["status"]["entries"][number]): string {
  return `${entry.indexStatus ?? ""}${entry.workingTreeStatus ?? ""} ${entry.path}`;
}

function localOperationRow(operation: AreaRepositoryDetail["recentOperations"][number]): string {
  return `${operation.shortId} ${operation.description}`;
}

function localStatusEmptyLabel(detail: AreaRepositoryDetail): string {
  if (!detail.status.clean) {
    return "No status entries.";
  }

  return detail.kind === "jj" ? "Working copy is clean." : "Working tree is clean.";
}

function localActivityRows(detail: AreaRepositoryDetail): string[] {
  const rows: string[] = [];

  for (const operation of detail.recentOperations) {
    rows.push(localOperationRow(operation));
  }
  for (const commit of detail.recentCommits) {
    rows.push(`${commit.shortId} ${commit.summary}`);
  }

  return rows;
}

function localWorkspaceRow(workspace: AreaWorkspaceSummary): string {
  const parts = [workspace.name, workspace.rootPath];

  if (workspace.isStale) {
    parts.push("stale");
  }
  if (workspace.sparseSummary) {
    parts.push(`sparse ${workspace.sparseSummary}`);
  }
  if (workspace.workingCopyChangeId) {
    parts.push(`change ${workspace.workingCopyChangeId}`);
  }
  if (workspace.workingCopyCommitId) {
    parts.push(`commit ${workspace.workingCopyCommitId}`);
  }
  if (workspace.health.message) {
    parts.push(workspace.health.message);
  }

  return parts.join(" · ");
}

function LocalRepositoryTabContent({
  model
}: {
  model: ReturnType<typeof useLocalRepositoryPageModel>;
}): JSX.Element | null {
  const { activeTab, detail, githubConnection, workspaceItems } = model;

  switch (activeTab) {
    case "overview":
      return <LocalRepositoryOverview model={model} />;
    case "code":
      return (
        <LocalCodePanel
          activePath={model.activePath}
          contents={model.contents.data ?? []}
          contentsLoading={model.contents.isLoading || model.contents.isFetching}
          contentsError={model.contents.error}
          fileContent={model.fileContent.data ?? null}
          fileLoading={model.fileContent.isLoading || model.fileContent.isFetching}
          onOpenPath={model.onOpenPath}
        />
      );
    case "branches":
      return <LocalListPanel title="Branches" rows={detail!.branches.map(localBranchRow)} />;
    case "bookmarks":
      return <LocalListPanel title="Bookmarks" rows={detail!.bookmarks.map(localBookmarkRow)} />;
    case "remotes":
      return <LocalListPanel title="Remotes" rows={detail!.remotes.map(localRemoteRow)} />;
    case "issues":
      return (
        <LocalListPanel
          title="GitHub Issues"
          rows={(model.localIssues.data?.items ?? []).map((issue) => `#${issue.number} ${issue.title}`)}
          emptyLabel={
            model.localIssuesAvailabilityMessage ??
            (githubConnection ? "No open issues." : "No GitHub remote is connected.")
          }
          loading={model.localIssues.isLoading || model.localIssues.isFetching}
          error={model.localIssues.error}
        />
      );
    case "pulls":
      return (
        <LocalListPanel
          title="GitHub Pull Requests"
          rows={(model.localPulls.data?.items ?? []).map((pull) => `#${pull.number} ${pull.title}`)}
          emptyLabel={
            model.localPullsAvailabilityMessage ??
            (githubConnection ? "No open pull requests." : "No GitHub remote is connected.")
          }
          loading={model.localPulls.isLoading || model.localPulls.isFetching}
          error={model.localPulls.error}
        />
      );
    case "actions":
      return (
        <LocalListPanel
          title="GitHub Actions"
          rows={(model.localActions.data?.items ?? []).map((run) => `${run.name} ${run.status ?? "unknown"}`)}
          emptyLabel={
            model.localActionsAvailabilityMessage ??
            (githubConnection ? "No workflow runs." : "No GitHub remote is connected.")
          }
          loading={model.localActions.isLoading || model.localActions.isFetching}
          error={model.localActions.error}
        />
      );
    case "sync":
      return (
        <LocalSyncPanel
          detail={detail!}
          syncStatus={model.syncStatus.data ?? null}
          loading={model.syncStatus.isLoading || model.syncStatus.isFetching}
          error={model.syncStatus.error}
          operationPending={model.operationPending}
          operationFeedback={model.lastOperationFeedback}
          onRunOperation={model.onRunOperation}
        />
      );
    case "status":
      return (
        <LocalListPanel
          title={detail!.kind === "jj" ? "Working-copy changes" : "Status"}
          rows={detail!.status.entries.map(localStatusRow)}
          emptyLabel={localStatusEmptyLabel(detail!)}
        />
      );
    case "activity":
      return <LocalListPanel title="Activity" rows={localActivityRows(detail!)} />;
    case "workspaces":
      return <LocalListPanel title="Workspaces" rows={workspaceItems.map(localWorkspaceRow)} />;
    case "operations":
      return <LocalListPanel title="Operations" rows={detail!.recentOperations.map(localOperationRow)} />;
  }
}

function LocalRepositoryOverview({
  model
}: {
  model: ReturnType<typeof useLocalRepositoryPageModel>;
}): JSX.Element {
  const { detail, githubConnection, selectedWorkspace, status, workspaceItems } = model;

  return (
    <div className="local-repository-grid">
      <section className="glass-panel">
        <h2>Repository</h2>
        <dl className="definition-list">
          <div>
            <dt>Path</dt>
            <dd>{detail!.path ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>{detail!.kind === "jj" ? "Working-copy change" : "Current branch"}</dt>
            <dd>
              {detail!.kind === "jj"
                ? (selectedWorkspace?.workingCopyChangeId ?? workspaceItems[0]?.workingCopyChangeId ?? "None")
                : (detail!.currentBranch ?? "None")}
            </dd>
          </div>
          {detail!.kind === "jj" && (
            <div>
              <dt>Working-copy commit</dt>
              <dd>
                {selectedWorkspace?.workingCopyCommitId ?? workspaceItems[0]?.workingCopyCommitId ?? "None"}
              </dd>
            </div>
          )}
          <div>
            <dt>Status</dt>
            <dd>{status?.clean ? "Clean" : `${status?.dirtyCount ?? 0} changed`}</dd>
          </div>
          {detail!.kind === "jj" && (
            <div>
              <dt>Latest operation</dt>
              <dd>{detail!.recentOperations[0]?.description ?? "No recent operation"}</dd>
            </div>
          )}
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
  );
}

function LocalSyncPanel({
  detail,
  syncStatus,
  loading,
  error,
  operationPending,
  operationFeedback,
  onRunOperation
}: {
  detail: AreaRepositoryDetail;
  syncStatus: AreaSyncStatus | null;
  loading: boolean;
  error: Error | null;
  operationPending: boolean;
  operationFeedback: LocalGatewayOperationFeedback | null;
  onRunOperation(kind: AreaGatewayOperationInput["kind"]): void;
}): JSX.Element {
  const fetchKind = detail.kind === "jj" ? "jj.git.fetch" : "git.fetch";
  const pushKind = detail.kind === "jj" ? "jj.git.push" : "git.push";
  const gatewayUnavailable = operationFeedback?.error?.message.includes("running gateway") ?? false;
  const canFetch =
    (syncStatus?.capabilities.canFetch ?? Boolean(detail.remotes.length)) && !gatewayUnavailable;
  const canPush = (syncStatus?.capabilities.canPush ?? Boolean(detail.remotes.length)) && !gatewayUnavailable;
  const operationResult = operationFeedback?.result ?? null;
  const operationError = operationFeedback?.error ?? null;

  function runFetchOperation(): void {
    onRunOperation(fetchKind);
  }

  function runPushOperation(): void {
    onRunOperation(pushKind);
  }

  return (
    <section className="glass-panel local-sync-panel">
      <div className="section-title-row">
        <h2>Sync</h2>
        <div className="button-row">
          <button
            className="secondary-button"
            type="button"
            disabled={!canFetch || operationPending}
            onClick={runFetchOperation}
          >
            <RefreshCw size={15} /> Fetch
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!canPush || operationPending}
            onClick={runPushOperation}
          >
            <GitBranch size={15} /> Push
          </button>
        </div>
      </div>
      {loading && <div className="loading-state">Loading sync state…</div>}
      {error && <div className="error-state">Sync state unavailable: {error.message}</div>}
      {syncStatus && (
        <dl className="definition-list">
          <div>
            <dt>Provider</dt>
            <dd>{syncStatus.provider.toUpperCase()}</dd>
          </div>
          <div>
            <dt>{detail.kind === "jj" ? "Current bookmark" : "Current branch"}</dt>
            <dd>
              {detail.kind === "jj"
                ? (syncStatus.currentBookmark ?? "None")
                : (syncStatus.currentBranch ?? "None")}
            </dd>
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
      {operationPending && <div className="loading-state">Running gateway operation…</div>}
      {gatewayUnavailable && (
        <div className="error-state">
          Gateway operations are unavailable until this Area has a running gateway.
        </div>
      )}
      {operationError && !gatewayUnavailable && (
        <div className="error-state">
          {operationFeedback?.kind}: {operationError.message}
        </div>
      )}
      {operationResult && (
        <div className={operationResult.status === "succeeded" ? "muted-row" : "error-state"}>
          {operationResult.message}
          {operationResult.stderr && <pre className="local-file-preview">{operationResult.stderr}</pre>}
          {operationResult.stdout && <pre className="local-file-preview">{operationResult.stdout}</pre>}
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
          {fileLoading && <div className="loading-state">Loading file…</div>}
          {fileContent?.kind === "binary" && <div className="muted-row">{fileContent.message}</div>}
          {fileContent?.kind === "unavailable" && (
            <div className="muted-row">{fileContent.message ?? "File content is unavailable."}</div>
          )}
          {contentsLoading && <div className="loading-state">Loading directory…</div>}
          {contentsError && <div className="error-state">Directory unavailable: {contentsError.message}</div>}
          <div className="local-file-list">
            {contents.map((entry) => (
              <LocalFileEntryRow key={entry.path} entry={entry} onOpenPath={onOpenPath} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function LocalFileEntryRow({
  entry,
  onOpenPath
}: {
  entry: AreaFileEntry;
  onOpenPath(entry: AreaFileEntry): void;
}): JSX.Element {
  function openLocalFileEntry(): void {
    onOpenPath(entry);
  }

  return (
    <button type="button" onClick={openLocalFileEntry}>
      {entry.type === "dir" ? <Folder size={15} /> : <FileIcon size={15} />}
      <span>{entry.name}</span>
    </button>
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
        <div className="loading-state">Loading…</div>
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

function sortWorkspaces(workspaces: AreaWorkspaceSummary[]): AreaWorkspaceSummary[] {
  const sortedWorkspaces = Array.from(workspaces);
  sortedWorkspaces.sort(
    (left, right) => left.name.localeCompare(right.name) || left.rootPath.localeCompare(right.rootPath)
  );

  return sortedWorkspaces;
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
