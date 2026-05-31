import { mkdirSync } from "node:fs";
import { join } from "node:path";

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
import { deleteAccountRecords, readLastAccount, saveAccountRecord } from "./accountStore";
import {
  clearAreaGateway as deleteAreaGateway,
  getAreaGateway as readAreaGateway,
  migrateLegacyAreaGatewayTokens,
  setAreaGateway as writeAreaGateway,
  type AreaGatewayRecord
} from "./areaGatewayStore";
import {
  clearAreaRepositories as deleteAreaRepositories,
  getAreaRepository as readAreaRepository,
  listAreaRepositories as readAreaRepositories,
  upsertAreaRepository as writeAreaRepository
} from "./areaRepositoryStore";
import {
  getAreaRepoSnapshot as readAreaRepoSnapshot,
  getAreaWorkspaceSnapshot as readAreaWorkspaceSnapshot,
  setAreaRepoSnapshot as writeAreaRepoSnapshot,
  setAreaWorkspaceSnapshot as writeAreaWorkspaceSnapshot
} from "./areaSnapshotStore";
import {
  createLocalArea as writeLocalArea,
  createSshArea as writeSshArea,
  ensureDefaultGitHubArea as writeDefaultGitHubArea,
  getArea as readArea,
  listAreas as readAreas,
  removeArea as deleteArea,
  selectArea as writeSelectedArea,
  updateArea as writeAreaUpdate,
  upsertArea as writeArea
} from "./areaStore";
import {
  clearAreaWorkspaces as deleteAreaWorkspaces,
  getAreaWorkspace as readAreaWorkspace,
  listAreaWorkspaces as readAreaWorkspaces,
  upsertAreaWorkspace as writeAreaWorkspace
} from "./areaWorkspaceStore";
import { clearCacheEntriesByPrefix, readCacheEntry, writeCacheEntry } from "./cacheStore";
import { createStorageDatabaseAdapter, type StorageDatabase } from "./database";
import {
  getGitHubRepository as readGitHubRepository,
  getGitHubRepositoryDetail as readGitHubRepositoryDetail,
  getGitHubRepositoryDetailWithMetadata as readGitHubRepositoryDetailWithMetadata,
  getGitHubRepositoryReadme as readGitHubRepositoryReadme,
  getGitHubRepositoryReadmeWithMetadata as readGitHubRepositoryReadmeWithMetadata,
  getGitHubRepositoryWithMetadata as readGitHubRepositoryWithMetadata,
  listGitHubRepositories as readGitHubRepositories,
  listGitHubRepositoriesWithMetadata as readGitHubRepositoriesWithMetadata,
  setGitHubRepositoriesWithStatusCache as writeGitHubRepositoriesWithStatusCache,
  upsertGitHubRepositoryDetail as writeGitHubRepositoryDetail,
  upsertGitHubRepositoryReadme as writeGitHubRepositoryReadme,
  upsertGitHubRepositorySummary as writeGitHubRepositorySummary,
  type CachedRepositoryList,
  type CachedRepositoryValue
} from "./githubRepositoryStore";
import { cacheExpiresAtIsExpired, mergeSettingsPatch, normalizeSettings } from "./localStoreHelpers";
import { MemoryLocalStore } from "./memoryStore";
import {
  listAreaRepositoryPins as readAreaRepositoryPins,
  listPinnedRepositories as readPinnedRepositories,
  migrateLegacyRepositoryPins,
  pinAreaRepository as writeAreaRepositoryPin,
  pinRepository as writeRepositoryPin,
  unpinAreaRepository as deleteAreaRepositoryPin,
  unpinRepository as deleteRepositoryPin
} from "./repositoryPinStore";
import {
  addRecentItem as writeRecentItem,
  listRecentItems as readRecentItems,
  migrateLegacyGitHubRecents
} from "./recentItemsStore";
import { runStorageSync } from "./runtime";
import { bootstrapSqliteSchema } from "./schema";
import { readSettings, writeSettings } from "./settingsStore";
import { setGatewayCredentials } from "../areas/gatewayCredentials";

export type { CachedRepositoryList, CachedRepositoryValue } from "./githubRepositoryStore";
export type { AreaGatewayRecord } from "./areaGatewayStore";

export interface CacheRecord {
  provider: string;
  cacheKey: string;
  payload: unknown;
  etag: string | null;
  expiresAt: string | null;
}

export interface CacheReadOptions {
  allowExpired?: boolean;
}

export interface CacheEntry<T> {
  payload: T;
  etag: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  isExpired: boolean;
}

export interface AreaRepositoryReadModelReplacement {
  summary: AreaRepositorySummary;
  detail: AreaRepositoryDetail | null;
}

export interface AreaWorkspaceReadModelReplacement {
  summary: AreaWorkspaceSummary;
  detail: AreaWorkspaceDetail | null;
}

export interface LocalStore {
  getSettings(): ControlSettings;
  updateSettings(settings: Partial<ControlSettings>): ControlSettings;
  saveAccount(provider: string, login: string, payload: unknown): void;
  deleteAccount(provider: string): void;
  getLastAccount<T>(provider: string): T | null;
  getCache<T>(provider: string, cacheKey: string, options?: CacheReadOptions): T | null;
  getCacheEntry<T>(provider: string, cacheKey: string): CacheEntry<T> | null;
  setCache(record: CacheRecord): void;
  clearCacheByPrefix(provider: string, cacheKeyPrefix: string): void;
  addRecentItem(kind: string, provider: string, itemKey: string, payload: unknown): void;
  listRecentItems(input?: LocalRecentListInput): LocalRecentItem[];
  ensureDefaultGitHubArea(accountLogin?: string | null): AreaSummary;
  createLocalArea(input: CreateLocalAreaInput): AreaSummary;
  createSshArea(input: CreateSshAreaInput): AreaSummary;
  updateArea(input: UpdateAreaInput): AreaSummary;
  upsertArea(area: AreaSummary): void;
  listAreas(): AreaSummary[];
  getArea(areaId: string): AreaSummary | null;
  selectArea(areaId: string): void;
  removeArea(areaId: string): void;
  getAreaGateway(areaId: string): AreaGatewayRecord | null;
  setAreaGateway(record: AreaGatewayRecord): void;
  clearAreaGateway(areaId: string): void;
  upsertAreaRepository(summary: AreaRepositorySummary, detail?: AreaRepositoryDetail | null): void;
  listAreaRepositories(input: ListAreaRepositoriesInput): AreaRepositorySummary[];
  getAreaRepository(input: AreaRepositoryInput): AreaRepositoryDetail | null;
  clearAreaRepositories(areaId: string): void;
  upsertAreaWorkspace(summary: AreaWorkspaceSummary, detail?: AreaWorkspaceDetail | null): void;
  replaceAreaReadModels(input: {
    areaId: string;
    repositories: AreaRepositoryReadModelReplacement[];
    workspaces: AreaWorkspaceReadModelReplacement[];
  }): void;
  listAreaWorkspaces(input: ListAreaWorkspacesInput): AreaWorkspaceSummary[];
  getAreaWorkspace(areaId: string, workspaceId: string): AreaWorkspaceDetail | null;
  clearAreaWorkspaces(areaId: string, repositoryId?: string | null): void;
  setAreaRepoSnapshot(areaId: string, repositoryId: string, snapshotKey: string, payload: unknown): void;
  getAreaRepoSnapshot<T>(areaId: string, repositoryId: string, snapshotKey: string): T | null;
  setAreaWorkspaceSnapshot(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string,
    payload: unknown
  ): void;
  getAreaWorkspaceSnapshot<T>(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string
  ): T | null;
  listGitHubRepositories(limit?: number): RepositorySummary[];
  listGitHubRepositoriesWithMetadata(limit?: number): CachedRepositoryList<RepositorySummary>;
  getGitHubRepository(id: string): RepositorySummary | null;
  getGitHubRepositoryWithMetadata(id: string): CachedRepositoryValue<RepositorySummary> | null;
  getGitHubRepositoryDetail(id: string): RepositoryDetail | null;
  getGitHubRepositoryDetailWithMetadata(id: string): CachedRepositoryValue<RepositoryDetail> | null;
  getGitHubRepositoryReadme(id: string): string | null;
  getGitHubRepositoryReadmeWithMetadata(id: string): CachedRepositoryValue<string | null> | null;
  upsertGitHubRepositorySummary(repository: RepositorySummary): void;
  upsertGitHubRepositoryDetail(repository: RepositoryDetail): void;
  upsertGitHubRepositoryReadme(id: string, readmeMarkdown: string | null): void;
  setGitHubRepositoriesWithStatusCache(input: {
    repositories: RepositorySummary[];
    cacheKey: string;
    result: RepositoryListResult;
    etag: string | null;
    expiresAt: string | null;
  }): void;
  pinRepository(nameWithOwner: string): void;
  unpinRepository(nameWithOwner: string): void;
  listPinnedRepositories(): string[];
  pinAreaRepository(input: RepositoryPinRecord): void;
  unpinAreaRepository(input: RepositoryPinRecord): void;
  listAreaRepositoryPins(): RepositoryPinRecord[];
  close(): void;
}

export async function createLocalStore(userDataPath: string): Promise<LocalStore> {
  const dbDir = join(userDataPath, "Control");
  mkdirSync(dbDir, { recursive: true });

  try {
    const sqlite = await import("better-sqlite3");
    const Database = sqlite.default;
    const db = createStorageDatabaseAdapter(new Database(join(dbDir, "control.sqlite")));
    const store = new SqliteLocalStore(db);
    await migrateLegacyAreaGatewayTokens(db, setGatewayCredentials);
    return store;
  } catch (error) {
    console.warn("Control SQLite store unavailable; using in-memory storage for this session.", error);
    return new MemoryLocalStore();
  }
}

class SqliteLocalStore implements LocalStore {
  constructor(private readonly db: StorageDatabase) {
    bootstrapSqliteSchema(this.db);
    this.ensureDefaultGitHubArea();
    migrateLegacyRepositoryPins(this.db);
    migrateLegacyGitHubRecents(this.db);
  }

  getSettings(): ControlSettings {
    return readSettings(this.db, normalizeSettings);
  }

  updateSettings(settings: Partial<ControlSettings>): ControlSettings {
    return runStorageSync("settings.write", () =>
      writeSettings(this.db, mergeSettingsPatch(this.getSettings(), settings))
    );
  }

  saveAccount(provider: string, login: string, payload: unknown): void {
    saveAccountRecord(this.db, provider, login, payload);
  }

  deleteAccount(provider: string): void {
    deleteAccountRecords(this.db, provider);
  }

  getLastAccount<T>(provider: string): T | null {
    return readLastAccount<T>(this.db, provider);
  }

  getCache<T>(provider: string, cacheKey: string, options: CacheReadOptions = {}): T | null {
    const entry = this.getCacheEntry<T>(provider, cacheKey);
    if (!entry || (!options.allowExpired && entry.isExpired)) {
      return null;
    }

    return entry.payload;
  }

  getCacheEntry<T>(provider: string, cacheKey: string): CacheEntry<T> | null {
    return readCacheEntry<T>(this.db, provider, cacheKey, cacheExpiresAtIsExpired);
  }

  setCache(record: CacheRecord): void {
    runStorageSync("cache.write", () => {
      writeCacheEntry(this.db, record);
    });
  }

  clearCacheByPrefix(provider: string, cacheKeyPrefix: string): void {
    runStorageSync("cache.clearByPrefix", () => {
      clearCacheEntriesByPrefix(this.db, provider, cacheKeyPrefix);
    });
  }

  addRecentItem(kind: string, provider: string, itemKey: string, payload: unknown): void {
    writeRecentItem(this.db, kind, provider, itemKey, payload);
  }

  listRecentItems(input: LocalRecentListInput = {}): LocalRecentItem[] {
    return readRecentItems(this.db, input);
  }

  ensureDefaultGitHubArea(accountLogin?: string | null): AreaSummary {
    return writeDefaultGitHubArea(this.db, accountLogin);
  }

  createLocalArea(input: CreateLocalAreaInput): AreaSummary {
    return writeLocalArea(this.db, input);
  }

  createSshArea(input: CreateSshAreaInput): AreaSummary {
    return writeSshArea(this.db, input);
  }

  updateArea(input: UpdateAreaInput): AreaSummary {
    return writeAreaUpdate(this.db, input);
  }

  upsertArea(area: AreaSummary): void {
    writeArea(this.db, area);
  }

  listAreas(): AreaSummary[] {
    return readAreas(this.db);
  }

  getArea(areaId: string): AreaSummary | null {
    return readArea(this.db, areaId);
  }

  selectArea(areaId: string): void {
    writeSelectedArea(this.db, areaId);
  }

  removeArea(areaId: string): void {
    deleteArea(this.db, areaId);
  }

  getAreaGateway(areaId: string): AreaGatewayRecord | null {
    return readAreaGateway(this.db, areaId);
  }

  setAreaGateway(record: AreaGatewayRecord): void {
    writeAreaGateway(this.db, record);
  }

  clearAreaGateway(areaId: string): void {
    deleteAreaGateway(this.db, areaId);
  }

  upsertAreaRepository(summary: AreaRepositorySummary, detail: AreaRepositoryDetail | null = null): void {
    writeAreaRepository(this.db, summary, detail);
  }

  listAreaRepositories(input: ListAreaRepositoriesInput): AreaRepositorySummary[] {
    return readAreaRepositories(this.db, input);
  }

  getAreaRepository(input: AreaRepositoryInput): AreaRepositoryDetail | null {
    return readAreaRepository(this.db, input);
  }

  clearAreaRepositories(areaId: string): void {
    deleteAreaRepositories(this.db, areaId);
  }

  upsertAreaWorkspace(summary: AreaWorkspaceSummary, detail: AreaWorkspaceDetail | null = null): void {
    writeAreaWorkspace(this.db, summary, detail);
  }

  replaceAreaReadModels(input: {
    areaId: string;
    repositories: AreaRepositoryReadModelReplacement[];
    workspaces: AreaWorkspaceReadModelReplacement[];
  }): void {
    this.db.transaction("areaReadModels.replace", () => {
      deleteAreaWorkspaces(this.db, input.areaId);
      deleteAreaRepositories(this.db, input.areaId);
      for (const repository of input.repositories) {
        writeAreaRepository(this.db, repository.summary, repository.detail);
      }
      for (const workspace of input.workspaces) {
        writeAreaWorkspace(this.db, workspace.summary, workspace.detail);
      }
    });
  }

  listAreaWorkspaces(input: ListAreaWorkspacesInput): AreaWorkspaceSummary[] {
    return readAreaWorkspaces(this.db, input);
  }

  getAreaWorkspace(areaId: string, workspaceId: string): AreaWorkspaceDetail | null {
    return readAreaWorkspace(this.db, areaId, workspaceId);
  }

  clearAreaWorkspaces(areaId: string, repositoryId: string | null = null): void {
    deleteAreaWorkspaces(this.db, areaId, repositoryId);
  }

  setAreaRepoSnapshot(areaId: string, repositoryId: string, snapshotKey: string, payload: unknown): void {
    writeAreaRepoSnapshot(this.db, areaId, repositoryId, snapshotKey, payload);
  }

  getAreaRepoSnapshot<T>(areaId: string, repositoryId: string, snapshotKey: string): T | null {
    return readAreaRepoSnapshot<T>(this.db, areaId, repositoryId, snapshotKey);
  }

  setAreaWorkspaceSnapshot(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string,
    payload: unknown
  ): void {
    writeAreaWorkspaceSnapshot(this.db, areaId, repositoryId, workspaceId, snapshotKey, payload);
  }

  getAreaWorkspaceSnapshot<T>(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string
  ): T | null {
    return readAreaWorkspaceSnapshot<T>(this.db, areaId, repositoryId, workspaceId, snapshotKey);
  }

  listGitHubRepositories(limit = 80): RepositorySummary[] {
    return readGitHubRepositories(this.db, limit);
  }

  listGitHubRepositoriesWithMetadata(limit = 80): CachedRepositoryList<RepositorySummary> {
    return readGitHubRepositoriesWithMetadata(this.db, limit);
  }

  getGitHubRepository(id: string): RepositorySummary | null {
    return readGitHubRepository(this.db, id);
  }

  getGitHubRepositoryWithMetadata(id: string): CachedRepositoryValue<RepositorySummary> | null {
    return readGitHubRepositoryWithMetadata(this.db, id);
  }

  getGitHubRepositoryDetail(id: string): RepositoryDetail | null {
    return readGitHubRepositoryDetail(this.db, id);
  }

  getGitHubRepositoryDetailWithMetadata(id: string): CachedRepositoryValue<RepositoryDetail> | null {
    return readGitHubRepositoryDetailWithMetadata(this.db, id);
  }

  getGitHubRepositoryReadme(id: string): string | null {
    return readGitHubRepositoryReadme(this.db, id);
  }

  getGitHubRepositoryReadmeWithMetadata(id: string): CachedRepositoryValue<string | null> | null {
    return readGitHubRepositoryReadmeWithMetadata(this.db, id);
  }

  upsertGitHubRepositorySummary(repository: RepositorySummary): void {
    writeGitHubRepositorySummary(this.db, repository);
  }

  upsertGitHubRepositoryDetail(repository: RepositoryDetail): void {
    writeGitHubRepositoryDetail(this.db, repository);
  }

  upsertGitHubRepositoryReadme(id: string, readmeMarkdown: string | null): void {
    writeGitHubRepositoryReadme(this.db, id, readmeMarkdown);
  }

  setGitHubRepositoriesWithStatusCache(input: {
    repositories: RepositorySummary[];
    cacheKey: string;
    result: RepositoryListResult;
    etag: string | null;
    expiresAt: string | null;
  }): void {
    runStorageSync("githubRepositories.writeStatusCache", () => {
      writeGitHubRepositoriesWithStatusCache(this.db, input);
    });
  }

  close(): void {
    this.db.close();
  }

  pinRepository(nameWithOwner: string): void {
    writeRepositoryPin(this.db, nameWithOwner);
  }

  unpinRepository(nameWithOwner: string): void {
    deleteRepositoryPin(this.db, nameWithOwner);
  }

  listPinnedRepositories(): string[] {
    return readPinnedRepositories(this.db);
  }

  pinAreaRepository(input: RepositoryPinRecord): void {
    writeAreaRepositoryPin(this.db, input);
  }

  unpinAreaRepository(input: RepositoryPinRecord): void {
    deleteAreaRepositoryPin(this.db, input);
  }

  listAreaRepositoryPins(): RepositoryPinRecord[] {
    return readAreaRepositoryPins(this.db);
  }
}
