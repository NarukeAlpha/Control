import { realpath } from "node:fs/promises";

import type {
  AreaActivityItem,
  AreaContentsInput,
  AreaFileContent,
  AreaFileContentInput,
  AreaFileEntry,
  AreaGatewayOperationInput,
  AreaGatewayOperationPreview,
  AreaGatewayOperationResult,
  AreaGatewayRunOperationInput,
  AreaGitHubIssuesInput,
  AreaGitHubListInput,
  AreaGitHubPullRequestsInput,
  AreaGitHubRepositoryInput,
  AreaRefInput,
  AreaRepositoryDetail,
  AreaRepositoryInput,
  AreaRepositorySummary,
  AreaSearchInput,
  AreaSearchResult,
  AreaSummary,
  AreaSyncStatus,
  AreaSyncStatusInput,
  AreaWorkspaceDetail,
  AreaWorkspaceSummary,
  CreateLocalAreaInput,
  CreateSshAreaInput,
  ListAreaRepositoriesInput,
  ListAreaWorkspacesInput,
  StopAreaGatewayInput,
  UpdateAreaInput
} from "@shared/areas";
import type {
  ContributorListResult,
  GitHubReadAvailability,
  IssueListResult,
  PullRequestListResult,
  ReleaseListResult,
  RepositoryDetailResult,
  WorkflowRunListResult
} from "@shared/github";

import type { GitHubProviderManager } from "../github/provider";
import type { AreaGatewayRecord, LocalStore } from "../storage";
import type { GatewayManager } from "./gatewayManager";
import { defaultGitHubAreaId } from "./areaIds";
import { discoverLocalRepositories } from "./localDiscovery";
import { readLocalFileContent, listLocalDirectory } from "./localFiles";
import { readGitRepository } from "./localGit";
import { readJjRepository } from "./jjAdapter";

export interface AreaManagerEvents {
  onAreasUpdated(event: { areaId: string | null }): void;
  onAreaRepositoryUpdated(event: { areaId: string; repositoryId: string | null }): void;
  onAreaWorkspaceUpdated(event: { areaId: string; repositoryId: string; workspaceId: string | null }): void;
}

export class AreaManager {
  constructor(
    private readonly store: LocalStore,
    private readonly github: GitHubProviderManager,
    private readonly events: AreaManagerEvents,
    private readonly gateway: GatewayManager | null = null
  ) {}

  async initialize(): Promise<void> {
    const appState = await this.github.createAppState();
    this.store.ensureDefaultGitHubArea(appState.github.user ?? appState.viewer?.login ?? null);
  }

  listAreas(): AreaSummary[] {
    this.store.ensureDefaultGitHubArea();
    return this.store.listAreas();
  }

  getArea(areaId: string): AreaSummary | null {
    this.store.ensureDefaultGitHubArea();
    return this.store.getArea(areaId);
  }

  selectArea(areaId: string): AreaSummary[] {
    this.store.selectArea(areaId);
    this.events.onAreasUpdated({ areaId });
    return this.listAreas();
  }

  async createLocalArea(input: CreateLocalAreaInput): Promise<AreaSummary> {
    const rootPath = await realpath(input.rootPath);
    const area = this.store.createLocalArea({ ...input, rootPath });
    this.gateway?.seedLocalArea(area);
    this.events.onAreasUpdated({ areaId: area.id });
    void this.refreshArea(area.id).catch((error) => {
      const current = this.store.getArea(area.id);
      if (!current) {
        return;
      }
      this.store.upsertArea({
        ...current,
        health: {
          status: "error",
          message: error instanceof Error ? error.message : "Local Area refresh failed.",
          checkedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      });
      this.events.onAreasUpdated({ areaId: area.id });
    });
    return area;
  }

  async createSshArea(input: CreateSshAreaInput): Promise<AreaSummary> {
    const area = this.store.createSshArea(input);
    this.gateway?.seedSshArea(area, input);
    this.events.onAreasUpdated({ areaId: area.id });
    void this.refreshArea(area.id).catch((error) => {
      const current = this.store.getArea(area.id);
      if (!current) {
        return;
      }
      this.store.upsertArea({
        ...current,
        health: {
          status: "error",
          message: error instanceof Error ? error.message : "SSH Area refresh failed.",
          checkedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      });
      this.events.onAreasUpdated({ areaId: area.id });
    });
    return area;
  }

  async updateArea(input: UpdateAreaInput): Promise<AreaSummary> {
    const existing = this.store.getArea(input.areaId);
    if (!existing) {
      throw new Error("Area does not exist.");
    }
    const gateway = this.store.getAreaGateway(input.areaId);
    const normalizedInput =
      existing.kind === "local" && input.rootPath
        ? { ...input, rootPath: await realpath(input.rootPath) }
        : input;
    const gatewayChanged = areaUpdateChangesGateway(existing, gateway, normalizedInput);
    if (gatewayChanged && this.gateway) {
      await this.gateway.stopGateway({ areaId: input.areaId }).catch(() => null);
    }

    const area = this.store.updateArea(normalizedInput);
    this.events.onAreasUpdated({ areaId: area.id });

    if (gatewayChanged && isGatewayAreaKind(area.kind)) {
      void this.refreshArea(area.id).catch((error) => {
        const current = this.store.getArea(area.id);
        if (!current) {
          return;
        }
        this.store.upsertArea({
          ...current,
          health: {
            status: "error",
            message: error instanceof Error ? error.message : "Area refresh failed.",
            checkedAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        });
        this.events.onAreasUpdated({ areaId: area.id });
      });
    }

    return area;
  }

  removeArea(areaId: string): AreaSummary[] {
    const existing = this.store.getArea(areaId);
    this.store.removeArea(areaId);
    if (existing?.selected && existing.kind !== "github") {
      const areas = this.store.listAreas();
      const fallback = areas.find((area) => area.kind === "github") ?? areas[0] ?? null;
      if (fallback) {
        this.store.selectArea(fallback.id);
      }
    }
    this.events.onAreasUpdated({ areaId });
    return this.listAreas();
  }

  async refreshArea(areaId: string): Promise<AreaSummary | null> {
    const area = this.store.getArea(areaId);
    if (!area) {
      return null;
    }
    if (area.kind === "github") {
      const appState = await this.github.createAppState();
      const refreshed = this.store.ensureDefaultGitHubArea(
        appState.github.user ?? appState.viewer?.login ?? null
      );
      this.events.onAreasUpdated({ areaId });
      return refreshed;
    }
    if ((area.kind === "local" || area.kind === "ssh") && this.gateway) {
      return this.refreshGatewayArea(area);
    }
    if (area.kind !== "local" || !area.rootPath) {
      return area;
    }
    return this.refreshLocalArea(area);
  }

  searchAreas(input: AreaSearchInput): AreaSearchResult {
    const query = input.query.trim().toLowerCase();
    const limit = typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.trunc(input.limit))) : 20;
    const areas = this.listAreas()
      .filter((area) => areaMatches(area, query))
      .slice(0, limit);
    const repositories = this.store
      .listAreas()
      .flatMap((area) => this.store.listAreaRepositories({ areaId: area.id, limit: 500 }))
      .filter((repository) => repositoryMatches(repository, query))
      .slice(0, limit);
    const workspaces = repositories
      .flatMap((repository) =>
        this.store.listAreaWorkspaces({ areaId: repository.areaId, repositoryId: repository.id })
      )
      .filter((workspace) => workspaceMatches(workspace, query))
      .slice(0, limit);
    return { areas, repositories, workspaces };
  }

  listRepositories(input: ListAreaRepositoriesInput): AreaRepositorySummary[] {
    return this.store.listAreaRepositories(input);
  }

  getRepository(input: AreaRepositoryInput): AreaRepositoryDetail | null {
    const detail = this.store.getAreaRepository(input);
    if (!detail) {
      return null;
    }
    return {
      ...detail,
      workspaces: this.store.listAreaWorkspaces({ areaId: input.areaId, repositoryId: input.repositoryId })
    };
  }

  async listContents(input: AreaContentsInput): Promise<AreaFileEntry[]> {
    const gatewayClient = this.gatewayClientForArea(input.areaId);
    if (gatewayClient) {
      return gatewayClient.listContents({
        repositoryId: input.repositoryId,
        workspaceId: input.workspaceId ?? null,
        path: input.path ?? "."
      });
    }
    const rootPath = this.resolveLocalRoot(input);
    return listLocalDirectory(rootPath, input.path ?? ".");
  }

  async getFileContent(input: AreaFileContentInput): Promise<AreaFileContent> {
    const gatewayClient = this.gatewayClientForArea(input.areaId);
    if (gatewayClient) {
      return gatewayClient.getFileContent({
        repositoryId: input.repositoryId,
        workspaceId: input.workspaceId ?? null,
        path: input.path
      });
    }
    const rootPath = this.resolveLocalRoot(input);
    return readLocalFileContent(rootPath, input.path);
  }

  listBranches(input: AreaRefInput): AreaRepositoryDetail["branches"] {
    return this.store.getAreaRepository(input)?.branches ?? [];
  }

  listRemotes(input: AreaRepositoryInput): AreaRepositoryDetail["remotes"] {
    return this.store.getAreaRepository(input)?.remotes ?? [];
  }

  getStatus(input: AreaRepositoryInput): AreaRepositoryDetail["status"] {
    return (
      this.store.getAreaRepository(input)?.status ?? {
        clean: null,
        dirtyCount: 0,
        untrackedCount: 0,
        conflictedCount: 0,
        ahead: null,
        behind: null,
        entries: []
      }
    );
  }

  listActivity(input: AreaRefInput): AreaActivityItem[] {
    const detail = this.store.getAreaRepository(input);
    if (!detail) {
      return [];
    }
    return [
      ...detail.recentCommits.map((commit) => ({
        id: commit.id,
        kind: "commit" as const,
        title: commit.summary,
        subtitle: commit.authorName,
        occurredAt: commit.authoredAt
      })),
      ...detail.recentOperations.map((operation) => ({
        id: operation.id,
        kind: "operation" as const,
        title: operation.description,
        subtitle: operation.user,
        occurredAt: operation.time
      }))
    ].slice(0, input.limit ?? 30);
  }

  listWorkspaces(input: ListAreaWorkspacesInput): AreaWorkspaceSummary[] {
    return this.store.listAreaWorkspaces(input);
  }

  getWorkspace(input: { areaId: string; workspaceId: string }): AreaWorkspaceDetail | null {
    return this.store.getAreaWorkspace(input.areaId, input.workspaceId);
  }

  async getGitHubRepository(input: AreaGitHubRepositoryInput): Promise<RepositoryDetailResult> {
    const githubInput = this.githubInputForAreaRepository(input);
    if (!githubInput) {
      return { detail: null, availability: unavailableGitHubEnrichment() };
    }
    return this.github.getRepositoryWithStatus(githubInput);
  }

  async listGitHubIssues(input: AreaGitHubIssuesInput): Promise<IssueListResult> {
    const githubInput = this.githubInputForAreaRepository(input);
    if (!githubInput) {
      return { items: [], availability: unavailableGitHubEnrichment() };
    }
    return this.github.listIssuesWithStatus({
      ...githubInput,
      state: input.state,
      limit: input.limit
    });
  }

  async listGitHubPullRequests(input: AreaGitHubPullRequestsInput): Promise<PullRequestListResult> {
    const githubInput = this.githubInputForAreaRepository(input);
    if (!githubInput) {
      return { items: [], availability: unavailableGitHubEnrichment() };
    }
    return this.github.listPullRequestsWithStatus({
      ...githubInput,
      state: input.state,
      limit: input.limit
    });
  }

  async listGitHubActions(input: AreaGitHubListInput): Promise<WorkflowRunListResult> {
    const githubInput = this.githubInputForAreaRepository(input);
    if (!githubInput) {
      return { items: [], availability: unavailableGitHubEnrichment() };
    }
    return this.github.listActionsWithStatus({ ...githubInput, limit: input.limit });
  }

  async listGitHubReleases(input: AreaGitHubListInput): Promise<ReleaseListResult> {
    const githubInput = this.githubInputForAreaRepository(input);
    if (!githubInput) {
      return { items: [], availability: unavailableGitHubEnrichment() };
    }
    return this.github.listReleasesWithStatus({ ...githubInput, limit: input.limit });
  }

  async listGitHubContributors(input: AreaGitHubListInput): Promise<ContributorListResult> {
    const githubInput = this.githubInputForAreaRepository(input);
    if (!githubInput) {
      return { items: [], availability: unavailableGitHubEnrichment() };
    }
    return this.github.listContributorsWithStatus({ ...githubInput, limit: input.limit });
  }

  async getSyncStatus(input: AreaSyncStatusInput): Promise<AreaSyncStatus> {
    const gatewayClient = this.gatewayClientForArea(input.areaId);
    if (!gatewayClient) {
      return fallbackSyncStatus(input, this.store.getAreaRepository(input));
    }
    return gatewayClient.getSyncStatus({
      repositoryId: input.repositoryId,
      workspaceId: input.workspaceId ?? null
    });
  }

  async prepareGatewayOperation(input: AreaGatewayOperationInput): Promise<AreaGatewayOperationPreview> {
    const gatewayClient = this.gatewayClientForArea(input.areaId);
    if (!gatewayClient) {
      throw new Error("This Area does not have a running gateway.");
    }
    return gatewayClient.prepareOperation(input);
  }

  async runGatewayOperation(input: AreaGatewayRunOperationInput): Promise<AreaGatewayOperationResult> {
    const gatewayClient = this.gatewayClientForArea(input.areaId);
    if (!gatewayClient) {
      throw new Error("This Area does not have a running gateway.");
    }
    const result = await gatewayClient.runOperation(input);
    void this.refreshArea(input.areaId).catch(() => undefined);
    return result;
  }

  async stopGateway(input: StopAreaGatewayInput): Promise<AreaSummary | null> {
    await this.gateway?.stopGateway(input);
    const area = this.store.getArea(input.areaId);
    if (area) {
      this.events.onAreasUpdated({ areaId: area.id });
    }
    return area;
  }

  private async refreshLocalArea(area: AreaSummary): Promise<AreaSummary> {
    if (!area.rootPath) {
      return area;
    }
    const startedAt = new Date().toISOString();
    this.store.upsertArea({
      ...area,
      health: { status: "scanning", message: "Scanning local repositories.", checkedAt: startedAt },
      updatedAt: startedAt
    });
    this.events.onAreasUpdated({ areaId: area.id });
    this.store.clearAreaWorkspaces(area.id);
    this.store.clearAreaRepositories(area.id);

    const candidates = await discoverLocalRepositories(area.rootPath);
    const matchedGitHubAreaId = this.store.getArea(defaultGitHubAreaId) ? defaultGitHubAreaId : null;
    for (const candidate of candidates) {
      if (candidate.kind === "jj") {
        const result = await readJjRepository({
          areaId: area.id,
          areaRootPath: area.rootPath,
          rootPath: candidate.rootPath,
          matchedGitHubAreaId
        });
        this.store.upsertAreaRepository(result.detail, result.detail);
        for (const workspace of result.workspaces) {
          this.store.upsertAreaWorkspace(workspace, {
            ...workspace,
            fileTree: [],
            readme: result.detail.readme,
            status: result.detail.status
          });
          this.events.onAreaWorkspaceUpdated({
            areaId: area.id,
            repositoryId: result.detail.id,
            workspaceId: workspace.id
          });
        }
        this.events.onAreaRepositoryUpdated({ areaId: area.id, repositoryId: result.detail.id });
        continue;
      }

      const detail = await readGitRepository({
        areaId: area.id,
        areaRootPath: area.rootPath,
        rootPath: candidate.rootPath,
        matchedGitHubAreaId
      });
      this.store.upsertAreaRepository(detail, detail);
      this.events.onAreaRepositoryUpdated({ areaId: area.id, repositoryId: detail.id });
    }

    const finishedAt = new Date().toISOString();
    const refreshed = {
      ...area,
      health: { status: "ready" as const, message: null, checkedAt: finishedAt },
      repositoryCount: candidates.length,
      updatedAt: finishedAt
    };
    this.store.upsertArea(refreshed);
    this.events.onAreasUpdated({ areaId: area.id });
    return this.store.getArea(area.id) ?? refreshed;
  }

  private async refreshGatewayArea(area: AreaSummary): Promise<AreaSummary> {
    const startedAt = new Date().toISOString();
    this.store.upsertArea({
      ...area,
      health: { status: "scanning", message: "Refreshing gateway repositories.", checkedAt: startedAt },
      updatedAt: startedAt
    });
    this.events.onAreasUpdated({ areaId: area.id });

    try {
      const record = await this.gateway?.ensureAreaGateway(area);
      const client = record ? this.gateway?.getClient(area.id) : null;
      if (!client) {
        throw new Error("Gateway client is unavailable.");
      }
      const repositories = await client.listRepositories();
      this.store.clearAreaWorkspaces(area.id);
      this.store.clearAreaRepositories(area.id);
      for (const repository of repositories) {
        const detail = await client.getRepository(repository.id).catch(() => null);
        this.store.upsertAreaRepository(repository, detail ?? null);
        this.events.onAreaRepositoryUpdated({ areaId: area.id, repositoryId: repository.id });
      }
      const finishedAt = new Date().toISOString();
      const refreshed = {
        ...area,
        health: { status: "ready" as const, message: null, checkedAt: finishedAt },
        repositoryCount: repositories.length,
        updatedAt: finishedAt
      };
      this.store.upsertArea(refreshed);
      this.events.onAreasUpdated({ areaId: area.id });
      return this.store.getArea(area.id) ?? refreshed;
    } catch (error) {
      if (area.kind === "local") {
        return this.refreshLocalArea(area);
      }
      const failedAt = new Date().toISOString();
      const refreshed = {
        ...area,
        health: {
          status: "error" as const,
          message: error instanceof Error ? error.message : "Gateway refresh failed.",
          checkedAt: failedAt
        },
        updatedAt: failedAt
      };
      this.store.upsertArea(refreshed);
      this.events.onAreasUpdated({ areaId: area.id });
      return this.store.getArea(area.id) ?? refreshed;
    }
  }

  private resolveLocalRoot(input: AreaRepositoryInput): string {
    if (input.workspaceId) {
      const workspace = this.store.getAreaWorkspace(input.areaId, input.workspaceId);
      if (!workspace) {
        throw new Error("Local workspace was not found.");
      }
      return workspace.rootPath;
    }
    const repository = this.store.getAreaRepository(input);
    if (!repository?.path) {
      throw new Error("Local repository was not found.");
    }
    return repository.path;
  }

  private githubInputForAreaRepository(
    input: AreaGitHubRepositoryInput
  ): { owner: string; repo: string; cacheOnly?: boolean; forceRefresh?: boolean } | null {
    const repository = this.store.getAreaRepository(input);
    const connection = repository?.connection;
    if (!connection || connection.status !== "connected") {
      return null;
    }
    return {
      owner: connection.owner,
      repo: connection.repo,
      cacheOnly: input.cacheOnly,
      forceRefresh: input.forceRefresh
    };
  }

  private gatewayClientForArea(areaId: string) {
    const area = this.store.getArea(areaId);
    if (!area || (area.kind !== "local" && area.kind !== "ssh")) {
      return null;
    }
    return this.gateway?.getClient(areaId) ?? null;
  }
}

function unavailableGitHubEnrichment(): GitHubReadAvailability {
  return {
    status: "not_loaded",
    message: "This local repository is not connected to a GitHub Area."
  };
}

function areaMatches(area: AreaSummary, query: string): boolean {
  return (
    !query || [area.label, area.subtitle, area.rootPath].some((value) => value?.toLowerCase().includes(query))
  );
}

function isGatewayAreaKind(kind: AreaSummary["kind"]): boolean {
  return kind === "local" || kind === "ssh";
}

function areaUpdateChangesGateway(
  area: AreaSummary,
  gateway: AreaGatewayRecord | null,
  input: UpdateAreaInput
): boolean {
  if (!gateway || area.kind === "github") {
    return false;
  }
  if (area.kind === "local") {
    return Boolean(input.rootPath && input.rootPath !== gateway.rootPath);
  }
  const nextRootPath = input.rootPath ?? gateway.rootPath;
  const nextHost = input.host ?? gateway.host;
  const nextUsername = input.username === undefined ? gateway.username : input.username;
  const nextPort = input.port === undefined ? gateway.port : input.port;
  return (
    nextRootPath !== gateway.rootPath ||
    nextHost !== gateway.host ||
    (nextUsername || null) !== (gateway.username || null) ||
    (nextPort ?? null) !== (gateway.port ?? null)
  );
}

function repositoryMatches(repository: AreaRepositorySummary, query: string): boolean {
  return (
    !query ||
    [
      repository.displayName,
      repository.name,
      repository.owner,
      repository.path,
      repository.connection?.nameWithOwner
    ].some((value) => value?.toLowerCase().includes(query))
  );
}

function workspaceMatches(workspace: AreaWorkspaceSummary, query: string): boolean {
  return !query || [workspace.name, workspace.rootPath].some((value) => value.toLowerCase().includes(query));
}

function fallbackSyncStatus(input: AreaSyncStatusInput, detail: AreaRepositoryDetail | null): AreaSyncStatus {
  return {
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    provider: detail?.kind === "jj" ? "jj" : "git",
    remotes:
      detail?.remotes.map((remote) => ({
        name: remote.name,
        fetchUrl: remote.fetchUrl,
        pushUrl: remote.pushUrl,
        status: "unknown",
        ahead: detail.status.ahead,
        behind: detail.status.behind,
        lastFetchedAt: null,
        message: null
      })) ?? [],
    defaultRemote: detail?.remotes[0]?.name ?? null,
    currentBranch: detail?.currentBranch ?? null,
    currentBookmark: detail?.bookmarks.find((bookmark) => bookmark.tracking)?.name ?? null,
    hasUncommittedChanges: detail?.isDirty ?? null,
    capabilities: {
      canFetch: Boolean(detail?.remotes.length),
      canPush: Boolean(detail?.remotes.length),
      canPull: detail?.kind === "git",
      canCreateBranch: detail?.kind === "git",
      canCreateBookmark: detail?.kind === "jj",
      canCommit: true,
      canUndo: detail?.kind === "jj"
    },
    updatedAt: detail?.updatedAt ?? null
  };
}
