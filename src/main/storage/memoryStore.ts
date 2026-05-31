import type {
  AreaRepositoryDetail,
  AreaRepositoryInput,
  AreaRepositorySummary,
  AreaSummary,
  AreaWorkspaceDetail,
  AreaWorkspaceSummary,
  CreateLocalAreaInput,
  CreateSshAreaInput,
  ListAreaRepositoriesInput,
  ListAreaWorkspacesInput,
  UpdateAreaInput
} from "@shared/areas";
import type {
  ControlSettings,
  RepositoryDetail,
  RepositoryListResult,
  RepositorySummary
} from "@shared/github";
import type { LocalRecentItem, LocalRecentListInput, RepositoryPinRecord } from "@shared/local";

import type { AreaGatewayRecord } from "./areaGatewayStore";
import type { CachedRepositoryList, CachedRepositoryValue } from "./githubRepositoryStore";
import type { CacheEntry, CacheReadOptions, CacheRecord, LocalStore } from "./localStoreAdapter";
import {
  areaGatewaySummary,
  areaRepositoryDetailFromSummary,
  areaRepositoryPinKey,
  areaWorkspaceDetailFromSummary,
  createDefaultGitHubArea,
  defaultGitHubAreaId,
  defaultGitHubRepositoryId,
  localAreaId,
  localAreaLabel,
  mapRecentItemRow,
  normalizeAreaLimit,
  normalizeRecentLimit,
  oldestTimestamp,
  sshAreaId,
  sshAreaLabel,
  sshAreaSubtitle,
  updateAreaSummary,
  updatedGatewayRecord
} from "./mappers";
import { areaRepoSnapshotKey, areaWorkspaceSnapshotKey } from "./areaSnapshotStore";
import { stringifyStorageJson } from "./serializers";
import {
  cacheExpiresAtIsExpired,
  defaultSettings,
  mergeSettingsPatch,
  normalizeSettings
} from "./localStoreHelpers";

export class MemoryLocalStore implements LocalStore {
  private settings = defaultSettings;
  private readonly accounts = new Map<string, unknown>();
  private readonly cache = new Map<string, CacheRecord & { updatedAt: string }>();
  private readonly recentItems = new Map<
    string,
    { kind: string; provider: string; itemKey: string; payload: unknown; updatedAt: string }
  >();
  private readonly repositories = new Map<
    string,
    {
      summary: RepositorySummary;
      detail: RepositoryDetail | null;
      readme: string | null;
      syncedAt: string | null;
      detailSyncedAt: string | null;
      readmeSyncedAt: string | null;
    }
  >();
  private readonly areas = new Map<string, AreaSummary>();
  private readonly areaRepositories = new Map<
    string,
    { summary: AreaRepositorySummary; detail: AreaRepositoryDetail | null }
  >();
  private readonly areaWorkspaces = new Map<
    string,
    { summary: AreaWorkspaceSummary; detail: AreaWorkspaceDetail | null }
  >();
  private readonly areaGateways = new Map<string, AreaGatewayRecord>();
  private readonly areaRepoSnapshots = new Map<string, unknown>();
  private readonly areaWorkspaceSnapshots = new Map<string, unknown>();
  private readonly pinnedRepositories = new Set<string>();
  private readonly areaRepositoryPins = new Map<string, RepositoryPinRecord>();

  getSettings(): ControlSettings {
    return normalizeSettings({ ...this.settings });
  }

  updateSettings(settings: Partial<ControlSettings>): ControlSettings {
    this.settings = mergeSettingsPatch(this.getSettings(), settings);
    return this.getSettings();
  }

  saveAccount(provider: string, login: string, payload: unknown): void {
    const key = `${provider}:${login}`;
    this.accounts.delete(key);
    this.accounts.set(key, payload);
  }

  deleteAccount(provider: string): void {
    const prefix = `${provider}:`;
    for (const key of this.accounts.keys()) {
      if (key.startsWith(prefix)) {
        this.accounts.delete(key);
      }
    }
  }

  getLastAccount<T>(provider: string): T | null {
    const prefix = `${provider}:`;
    const entry = Array.from(this.accounts.entries())
      .reverse()
      .find(([key]) => key.startsWith(prefix));
    return entry ? (entry[1] as T) : null;
  }

  getCache<T>(provider: string, cacheKey: string, options: CacheReadOptions = {}): T | null {
    const entry = this.getCacheEntry<T>(provider, cacheKey);
    if (!entry || (!options.allowExpired && entry.isExpired)) {
      return null;
    }
    return entry.payload;
  }

  getCacheEntry<T>(provider: string, cacheKey: string): CacheEntry<T> | null {
    const record = this.cache.get(`${provider}:${cacheKey}`);
    if (!record) {
      return null;
    }
    return {
      payload: record.payload as T,
      etag: record.etag,
      expiresAt: record.expiresAt,
      updatedAt: record.updatedAt,
      isExpired: cacheExpiresAtIsExpired(record.expiresAt)
    };
  }

  setCache(record: CacheRecord): void {
    this.cache.set(`${record.provider}:${record.cacheKey}`, {
      ...record,
      updatedAt: new Date().toISOString()
    });
  }

  clearCacheByPrefix(provider: string, cacheKeyPrefix: string): void {
    const keyPrefix = `${provider}:${cacheKeyPrefix}`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  addRecentItem(kind: string, provider: string, itemKey: string, payload: unknown): void {
    this.recentItems.set(`${kind}:${provider}:${itemKey}`, {
      kind,
      provider,
      itemKey,
      payload,
      updatedAt: new Date().toISOString()
    });
  }

  listRecentItems(input: LocalRecentListInput = {}): LocalRecentItem[] {
    return [...this.recentItems.values()]
      .filter((item) => !input.kind || item.kind === input.kind)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, normalizeRecentLimit(input.limit))
      .map((item) =>
        mapRecentItemRow({
          ...item,
          payload: stringifyStorageJson("recentItems.memoryPayload", item.payload)
        })
      )
      .filter((item): item is LocalRecentItem => Boolean(item));
  }

  ensureDefaultGitHubArea(accountLogin?: string | null): AreaSummary {
    const existing = this.areas.get(defaultGitHubAreaId);
    const area = {
      ...createDefaultGitHubArea(
        accountLogin ?? existing?.accountLogin ?? null,
        existing?.selected ?? this.selectedAreaIsMissing()
      ),
      label: existing?.label ?? "GitHub",
      createdAt: existing?.createdAt ?? new Date().toISOString()
    };
    this.upsertArea(area);
    return this.areas.get(defaultGitHubAreaId) ?? area;
  }

  createLocalArea(input: CreateLocalAreaInput): AreaSummary {
    const now = new Date().toISOString();
    const area: AreaSummary = {
      id: localAreaId(input.rootPath),
      kind: "local",
      label: localAreaLabel(input.rootPath, input.label),
      subtitle: input.rootPath,
      rootPath: input.rootPath,
      accountLogin: null,
      gateway: null,
      health: { status: "scanning", message: "Scanning local repositories.", checkedAt: now },
      repositoryCount: 0,
      selected: false,
      createdAt: now,
      updatedAt: now
    };
    this.upsertArea(area);
    return this.areas.get(area.id) ?? area;
  }

  createSshArea(input: CreateSshAreaInput): AreaSummary {
    const now = new Date().toISOString();
    const host = input.host.trim();
    const rootPath = input.rootPath.trim();
    const username = input.username?.trim() || null;
    const port = input.port ?? null;
    const area: AreaSummary = {
      id: sshAreaId({ host, rootPath, username, port }),
      kind: "ssh",
      label: sshAreaLabel(host, input.label),
      subtitle: sshAreaSubtitle({ host, rootPath, username, port }),
      rootPath,
      accountLogin: null,
      gateway: null,
      health: { status: "scanning", message: "Starting remote gateway.", checkedAt: now },
      repositoryCount: 0,
      selected: false,
      createdAt: now,
      updatedAt: now
    };
    this.upsertArea(area);
    return this.areas.get(area.id) ?? area;
  }

  updateArea(input: UpdateAreaInput): AreaSummary {
    const existing = this.getArea(input.areaId);
    if (!existing) {
      throw new Error("Area does not exist.");
    }
    const updated = updateAreaSummary(existing, input, this.areaGateways.get(existing.id) ?? null);
    this.upsertArea(updated);
    const gateway = this.areaGateways.get(updated.id);
    if (gateway && (updated.kind === "local" || updated.kind === "ssh")) {
      const nextGateway = updatedGatewayRecord(gateway, updated, input);
      if (nextGateway) {
        this.areaGateways.set(updated.id, nextGateway);
      }
    }
    return this.getArea(updated.id) ?? updated;
  }

  upsertArea(area: AreaSummary): void {
    if (area.selected) {
      for (const [id, existing] of this.areas) {
        if (id !== area.id && existing.selected) {
          this.areas.set(id, { ...existing, selected: false, updatedAt: new Date().toISOString() });
        }
      }
    }
    const repositoryCount = [...this.areaRepositories.values()].filter(
      (record) => record.summary.areaId === area.id
    ).length;
    this.areas.set(area.id, { ...area, repositoryCount, updatedAt: new Date().toISOString() });
  }

  listAreas(): AreaSummary[] {
    return [...this.areas.values()]
      .map((area) => ({
        ...area,
        gateway: this.areaGateways.get(area.id) ? areaGatewaySummary(this.areaGateways.get(area.id)!) : null,
        repositoryCount: [...this.areaRepositories.values()].filter(
          (record) => record.summary.areaId === area.id
        ).length
      }))
      .sort((a, b) => Number(b.selected) - Number(a.selected) || a.label.localeCompare(b.label));
  }

  getArea(areaId: string): AreaSummary | null {
    return this.listAreas().find((area) => area.id === areaId) ?? null;
  }

  selectArea(areaId: string): void {
    if (!this.areas.has(areaId)) {
      throw new Error("Area does not exist.");
    }
    for (const [id, area] of this.areas) {
      this.areas.set(id, { ...area, selected: id === areaId, updatedAt: new Date().toISOString() });
    }
  }

  removeArea(areaId: string): void {
    const area = this.areas.get(areaId);
    if (!area || area.kind === "github") {
      return;
    }
    this.areas.delete(areaId);
    this.clearAreaRepositories(areaId);
    this.clearAreaWorkspaces(areaId);
    this.areaGateways.delete(areaId);
  }

  getAreaGateway(areaId: string): AreaGatewayRecord | null {
    return this.areaGateways.get(areaId) ?? null;
  }

  setAreaGateway(record: AreaGatewayRecord): void {
    this.areaGateways.set(record.areaId, record);
    const area = this.areas.get(record.areaId);
    if (area) {
      this.areas.set(record.areaId, {
        ...area,
        gateway: areaGatewaySummary(record),
        updatedAt: new Date().toISOString()
      });
    }
  }

  clearAreaGateway(areaId: string): void {
    this.areaGateways.delete(areaId);
    const area = this.areas.get(areaId);
    if (area) {
      this.areas.set(areaId, { ...area, gateway: null, updatedAt: new Date().toISOString() });
    }
  }

  upsertAreaRepository(summary: AreaRepositorySummary, detail: AreaRepositoryDetail | null = null): void {
    const existing = this.areaRepositories.get(summary.id);
    this.areaRepositories.set(summary.id, { summary, detail: detail ?? existing?.detail ?? null });
  }

  listAreaRepositories(input: ListAreaRepositoriesInput): AreaRepositorySummary[] {
    return [...this.areaRepositories.values()]
      .filter((record) => record.summary.areaId === input.areaId)
      .map((record) => record.summary)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, normalizeAreaLimit(input.limit, 500));
  }

  getAreaRepository(input: AreaRepositoryInput): AreaRepositoryDetail | null {
    const record = this.areaRepositories.get(input.repositoryId);
    if (!record || record.summary.areaId !== input.areaId) {
      return null;
    }
    return record.detail ?? areaRepositoryDetailFromSummary(record.summary);
  }

  clearAreaRepositories(areaId: string): void {
    for (const [id, record] of this.areaRepositories) {
      if (record.summary.areaId === areaId) {
        this.areaRepositories.delete(id);
      }
    }
  }

  upsertAreaWorkspace(summary: AreaWorkspaceSummary, detail: AreaWorkspaceDetail | null = null): void {
    const existing = this.areaWorkspaces.get(summary.id);
    this.areaWorkspaces.set(summary.id, { summary, detail: detail ?? existing?.detail ?? null });
  }

  replaceAreaReadModels(input: Parameters<LocalStore["replaceAreaReadModels"]>[0]): void {
    this.clearAreaWorkspaces(input.areaId);
    this.clearAreaRepositories(input.areaId);
    for (const repository of input.repositories) {
      this.upsertAreaRepository(repository.summary, repository.detail);
    }
    for (const workspace of input.workspaces) {
      this.upsertAreaWorkspace(workspace.summary, workspace.detail);
    }
  }

  listAreaWorkspaces(input: ListAreaWorkspacesInput): AreaWorkspaceSummary[] {
    return [...this.areaWorkspaces.values()]
      .filter(
        (record) =>
          record.summary.areaId === input.areaId &&
          (!input.repositoryId || record.summary.repositoryId === input.repositoryId)
      )
      .map((record) => record.summary)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getAreaWorkspace(areaId: string, workspaceId: string): AreaWorkspaceDetail | null {
    const record = this.areaWorkspaces.get(workspaceId);
    if (!record || record.summary.areaId !== areaId) {
      return null;
    }
    return record.detail ?? areaWorkspaceDetailFromSummary(record.summary);
  }

  clearAreaWorkspaces(areaId: string, repositoryId: string | null = null): void {
    for (const [id, record] of this.areaWorkspaces) {
      if (
        record.summary.areaId === areaId &&
        (!repositoryId || record.summary.repositoryId === repositoryId)
      ) {
        this.areaWorkspaces.delete(id);
      }
    }
  }

  setAreaRepoSnapshot(areaId: string, repositoryId: string, snapshotKey: string, payload: unknown): void {
    this.areaRepoSnapshots.set(areaRepoSnapshotKey(areaId, repositoryId, snapshotKey), payload);
  }

  getAreaRepoSnapshot<T>(areaId: string, repositoryId: string, snapshotKey: string): T | null {
    return (this.areaRepoSnapshots.get(areaRepoSnapshotKey(areaId, repositoryId, snapshotKey)) as T) ?? null;
  }

  setAreaWorkspaceSnapshot(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string,
    payload: unknown
  ): void {
    this.areaWorkspaceSnapshots.set(
      areaWorkspaceSnapshotKey(areaId, repositoryId, workspaceId, snapshotKey),
      payload
    );
  }

  getAreaWorkspaceSnapshot<T>(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string
  ): T | null {
    return (
      (this.areaWorkspaceSnapshots.get(
        areaWorkspaceSnapshotKey(areaId, repositoryId, workspaceId, snapshotKey)
      ) as T) ?? null
    );
  }

  listGitHubRepositories(limit = 80): RepositorySummary[] {
    return this.listGitHubRepositoriesWithMetadata(limit).items;
  }

  listGitHubRepositoriesWithMetadata(limit = 80): CachedRepositoryList<RepositorySummary> {
    const rows = [...this.repositories.values()]
      .sort(
        (a, b) =>
          (Date.parse(b.summary.pushedAt ?? b.summary.updatedAt ?? "0") || 0) -
          (Date.parse(a.summary.pushedAt ?? a.summary.updatedAt ?? "0") || 0)
      )
      .slice(0, limit);

    return {
      items: rows.map((record) => record.summary),
      syncedAt: oldestTimestamp(rows.map((record) => record.syncedAt))
    };
  }

  getGitHubRepository(id: string): RepositorySummary | null {
    return this.getGitHubRepositoryWithMetadata(id)?.value ?? null;
  }

  getGitHubRepositoryWithMetadata(id: string): CachedRepositoryValue<RepositorySummary> | null {
    const record = this.repositories.get(id);
    return record ? { value: record.summary, syncedAt: record.syncedAt } : null;
  }

  getGitHubRepositoryDetail(id: string): RepositoryDetail | null {
    return this.getGitHubRepositoryDetailWithMetadata(id)?.value ?? null;
  }

  getGitHubRepositoryDetailWithMetadata(id: string): CachedRepositoryValue<RepositoryDetail> | null {
    const record = this.repositories.get(id);
    return record?.detail ? { value: record.detail, syncedAt: record.detailSyncedAt } : null;
  }

  getGitHubRepositoryReadme(id: string): string | null {
    return this.getGitHubRepositoryReadmeWithMetadata(id)?.value ?? null;
  }

  getGitHubRepositoryReadmeWithMetadata(id: string): CachedRepositoryValue<string | null> | null {
    const record = this.repositories.get(id);
    return record ? { value: record.readme, syncedAt: record.readmeSyncedAt } : null;
  }

  upsertGitHubRepositorySummary(repository: RepositorySummary): void {
    const existing = this.repositories.get(repository.nameWithOwner);
    this.repositories.set(repository.nameWithOwner, {
      summary: repository,
      detail: existing?.detail ?? null,
      readme: existing?.readme ?? null,
      syncedAt: new Date().toISOString(),
      detailSyncedAt: existing?.detailSyncedAt ?? null,
      readmeSyncedAt: existing?.readmeSyncedAt ?? null
    });
  }

  upsertGitHubRepositoryDetail(repository: RepositoryDetail): void {
    const existing = this.repositories.get(repository.nameWithOwner);
    const syncedAt = new Date().toISOString();
    this.repositories.set(repository.nameWithOwner, {
      summary: repository,
      detail: repository,
      readme: repository.readmeMarkdown,
      syncedAt,
      detailSyncedAt: syncedAt,
      readmeSyncedAt: existing?.readmeSyncedAt ?? null
    });
  }

  upsertGitHubRepositoryReadme(id: string, readme: string | null): void {
    const existing = this.repositories.get(id);
    if (!existing) {
      return;
    }
    this.repositories.set(id, { ...existing, readme, readmeSyncedAt: new Date().toISOString() });
  }

  setGitHubRepositoriesWithStatusCache(input: {
    repositories: RepositorySummary[];
    cacheKey: string;
    result: RepositoryListResult;
    etag: string | null;
    expiresAt: string | null;
  }): void {
    for (const repository of input.repositories) {
      this.upsertGitHubRepositorySummary(repository);
    }
    this.setCache({
      provider: "github",
      cacheKey: input.cacheKey,
      payload: input.result,
      etag: input.etag,
      expiresAt: input.expiresAt
    });
  }

  pinRepository(nameWithOwner: string): void {
    this.pinnedRepositories.add(nameWithOwner);
    this.pinAreaRepository({
      areaId: defaultGitHubAreaId,
      repositoryId: defaultGitHubRepositoryId(nameWithOwner),
      workspaceId: null,
      nameWithOwner,
      createdAt: null
    });
  }

  unpinRepository(nameWithOwner: string): void {
    this.pinnedRepositories.delete(nameWithOwner);
    this.unpinAreaRepository({
      areaId: defaultGitHubAreaId,
      repositoryId: defaultGitHubRepositoryId(nameWithOwner),
      workspaceId: null,
      nameWithOwner,
      createdAt: null
    });
  }

  listPinnedRepositories(): string[] {
    return [...this.pinnedRepositories];
  }

  pinAreaRepository(input: RepositoryPinRecord): void {
    if (!input.areaId || !input.repositoryId) {
      return;
    }
    const key = areaRepositoryPinKey(input.areaId, input.repositoryId, input.workspaceId ?? null);
    this.areaRepositoryPins.set(key, {
      areaId: input.areaId,
      repositoryId: input.repositoryId,
      workspaceId: input.workspaceId ?? null,
      nameWithOwner: input.nameWithOwner ?? null,
      createdAt: input.createdAt ?? new Date().toISOString()
    });
  }

  unpinAreaRepository(input: RepositoryPinRecord): void {
    if (!input.areaId || !input.repositoryId) {
      return;
    }
    this.areaRepositoryPins.delete(
      areaRepositoryPinKey(input.areaId, input.repositoryId, input.workspaceId ?? null)
    );
  }

  listAreaRepositoryPins(): RepositoryPinRecord[] {
    return [...this.areaRepositoryPins.values()].sort(
      (a, b) => Date.parse(b.createdAt ?? "0") - Date.parse(a.createdAt ?? "0")
    );
  }

  close(): void {
    return;
  }

  private selectedAreaIsMissing(): boolean {
    return ![...this.areas.values()].some((area) => area.selected);
  }
}
