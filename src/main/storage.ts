import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";

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
  ListAreaWorkspacesInput
} from "@shared/areas";
import type { ControlSettings, RepositoryDetail, RepositorySummary } from "@shared/github";
import type {
  LocalRecentItem,
  LocalRecentListInput,
  LocalRecentMetadata,
  RepositoryPinRecord
} from "@shared/local";

const defaultSettings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell"
};

interface CacheRecord {
  provider: string;
  cacheKey: string;
  payload: unknown;
  etag: string | null;
  expiresAt: string | null;
}

interface CacheReadOptions {
  allowExpired?: boolean;
}

export interface CacheEntry<T> {
  payload: T;
  etag: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  isExpired: boolean;
}

export interface CachedRepositoryList<T> {
  items: T[];
  syncedAt: string | null;
}

export interface CachedRepositoryValue<T> {
  value: T;
  syncedAt: string | null;
}

interface RecentItemRow {
  kind: string;
  provider: string;
  itemKey: string;
  payload: string;
  updatedAt: string;
}

interface AreaRow {
  id: string;
  kind: AreaSummary["kind"];
  label: string;
  subtitle: string | null;
  rootPath: string | null;
  accountLogin: string | null;
  selected: number;
  gatewayJson: string | null;
  healthJson: string;
  repositoryCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AreaRepositoryRow {
  summaryJson: string;
  detailJson: string | null;
}

interface AreaWorkspaceRow {
  summaryJson: string;
  detailJson: string | null;
}

export interface AreaGatewayRecord {
  areaId: string;
  rootPath: string;
  transport: "local" | "ssh";
  host: string | null;
  username: string | null;
  port: number | null;
  apiUrl: string | null;
  adminUrl: string | null;
  apiToken: string | null;
  adminToken: string | null;
  serviceName: string | null;
  version: string | null;
  status: "not-installed" | "starting" | "ready" | "stopped" | "error";
  pid: number | null;
  processId: number | null;
  message: string | null;
  installedAt: string | null;
  lastStartedAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string;
}

export interface LocalStore {
  getSettings(): ControlSettings;
  updateSettings(settings: Partial<ControlSettings>): ControlSettings;
  saveAccount(provider: string, login: string, payload: unknown): void;
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
  pinRepository(nameWithOwner: string): void;
  unpinRepository(nameWithOwner: string): void;
  listPinnedRepositories(): string[];
  pinAreaRepository(input: RepositoryPinRecord): void;
  unpinAreaRepository(input: RepositoryPinRecord): void;
  listAreaRepositoryPins(): RepositoryPinRecord[];
}

export async function createLocalStore(userDataPath: string): Promise<LocalStore> {
  const dbDir = join(userDataPath, "Control");
  mkdirSync(dbDir, { recursive: true });

  try {
    const sqlite = await import("better-sqlite3");
    const Database = sqlite.default;
    const db = new Database(join(dbDir, "control.sqlite"));
    return new SqliteLocalStore(db);
  } catch (error) {
    console.warn("Control SQLite store unavailable; using in-memory storage for this session.", error);
    return new MemoryLocalStore();
  }
}

class SqliteLocalStore implements LocalStore {
  constructor(private readonly db: import("better-sqlite3").Database) {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS accounts (
        provider TEXT NOT NULL,
        login TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (provider, login)
      );

      CREATE TABLE IF NOT EXISTS cache_entries (
        provider TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        etag TEXT,
        expires_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (provider, cache_key)
      );

      CREATE TABLE IF NOT EXISTS recent_items (
        kind TEXT NOT NULL,
        provider TEXT NOT NULL,
        item_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (kind, provider, item_key)
      );

      CREATE TABLE IF NOT EXISTS pinned_repositories (
        name_with_owner TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS areas (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        subtitle TEXT,
        root_path TEXT,
        account_login TEXT,
        selected INTEGER NOT NULL DEFAULT 0,
        health_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS area_repositories (
        id TEXT PRIMARY KEY,
        area_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        owner TEXT,
        display_name TEXT NOT NULL,
        path TEXT,
        default_branch TEXT,
        current_branch TEXT,
        is_dirty INTEGER,
        is_private INTEGER,
        description TEXT,
        connection_json TEXT,
        capabilities_json TEXT NOT NULL,
        health_json TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        detail_json TEXT,
        scanned_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS area_repositories_area_id_idx ON area_repositories(area_id);

      CREATE TABLE IF NOT EXISTS area_workspaces (
        id TEXT PRIMARY KEY,
        area_id TEXT NOT NULL,
        repository_id TEXT NOT NULL,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        is_stale INTEGER NOT NULL DEFAULT 0,
        summary_json TEXT NOT NULL,
        detail_json TEXT,
        scanned_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
        FOREIGN KEY (repository_id) REFERENCES area_repositories(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS area_workspaces_area_repo_idx
        ON area_workspaces(area_id, repository_id);

      CREATE TABLE IF NOT EXISTS area_gateways (
        area_id TEXT PRIMARY KEY,
        summary_json TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS area_repo_snapshots (
        area_id TEXT NOT NULL,
        repository_id TEXT NOT NULL,
        snapshot_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        expires_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (area_id, repository_id, snapshot_key)
      );

      CREATE TABLE IF NOT EXISTS area_workspace_snapshots (
        area_id TEXT NOT NULL,
        repository_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        snapshot_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        expires_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (area_id, repository_id, workspace_id, snapshot_key)
      );

      CREATE TABLE IF NOT EXISTS area_repository_pins (
        area_id TEXT NOT NULL,
        repository_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL DEFAULT '',
        name_with_owner TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (area_id, repository_id, workspace_id)
      );

      CREATE TABLE IF NOT EXISTS github_repositories (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        visibility TEXT NOT NULL,
        is_private INTEGER NOT NULL DEFAULT 0,
        is_fork INTEGER NOT NULL DEFAULT 0,
        default_branch TEXT,
        avatar_url TEXT,
        primary_language_json TEXT,
        counts_json TEXT NOT NULL,
        stargazer_count INTEGER NOT NULL DEFAULT 0,
        fork_count INTEGER NOT NULL DEFAULT 0,
        watcher_count INTEGER NOT NULL DEFAULT 0,
        open_issues_count INTEGER NOT NULL DEFAULT 0,
        pushed_at TEXT,
        updated_at TEXT,
        summary_json TEXT NOT NULL,
        detail_json TEXT,
        readme_markdown TEXT,
        languages_json TEXT,
        viewer_state_json TEXT,
        permissions_json TEXT,
        synced_at TEXT,
        detail_synced_at TEXT,
        readme_synced_at TEXT
      );
    `);
    this.ensureDefaultGitHubArea();
    this.migrateLegacyRepositoryPins();
    this.migrateLegacyGitHubRecents();
  }

  getSettings(): ControlSettings {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as Array<{
      key: string;
      value: string;
    }>;
    const stored = rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.key] = JSON.parse(row.value) as unknown;
      return acc;
    }, {});

    return normalizeSettings(stored);
  }

  updateSettings(settings: Partial<ControlSettings>): ControlSettings {
    const merged = {
      ...this.getSettings(),
      ...settings
    };

    const statement = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (@key, @value, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = this.db.transaction((entries: Array<[string, unknown]>) => {
      for (const [key, value] of entries) {
        statement.run({ key, value: JSON.stringify(value) });
      }
    });

    transaction(Object.entries(merged));
    return merged;
  }

  saveAccount(provider: string, login: string, payload: unknown): void {
    this.db
      .prepare(
        `INSERT INTO accounts (provider, login, payload, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(provider, login) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`
      )
      .run(provider, login, JSON.stringify(payload));
  }

  getLastAccount<T>(provider: string): T | null {
    const row = this.db
      .prepare("SELECT payload FROM accounts WHERE provider = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1")
      .get(provider) as { payload: string } | undefined;

    return row ? (JSON.parse(row.payload) as T) : null;
  }

  getCache<T>(provider: string, cacheKey: string, options: CacheReadOptions = {}): T | null {
    const entry = this.getCacheEntry<T>(provider, cacheKey);
    if (!entry || (!options.allowExpired && entry.isExpired)) {
      return null;
    }

    return entry.payload;
  }

  getCacheEntry<T>(provider: string, cacheKey: string): CacheEntry<T> | null {
    const row = this.db
      .prepare(
        `SELECT payload,
                etag,
                expires_at AS expiresAt,
                updated_at AS updatedAt
         FROM cache_entries
         WHERE provider = ? AND cache_key = ?`
      )
      .get(provider, cacheKey) as
      | { payload: string; etag: string | null; expiresAt: string | null; updatedAt: string | null }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      payload: JSON.parse(row.payload) as T,
      etag: row.etag,
      expiresAt: row.expiresAt,
      updatedAt: row.updatedAt,
      isExpired: cacheExpiresAtIsExpired(row.expiresAt)
    };
  }

  setCache(record: CacheRecord): void {
    this.db
      .prepare(
        `INSERT INTO cache_entries (provider, cache_key, payload, etag, expires_at, updated_at)
         VALUES (@provider, @cacheKey, @payload, @etag, @expiresAt, CURRENT_TIMESTAMP)
         ON CONFLICT(provider, cache_key) DO UPDATE SET
           payload = excluded.payload,
           etag = excluded.etag,
           expires_at = excluded.expires_at,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        provider: record.provider,
        cacheKey: record.cacheKey,
        payload: JSON.stringify(record.payload),
        etag: record.etag,
        expiresAt: record.expiresAt
      });
  }

  clearCacheByPrefix(provider: string, cacheKeyPrefix: string): void {
    this.db
      .prepare("DELETE FROM cache_entries WHERE provider = ? AND cache_key LIKE ?")
      .run(provider, `${cacheKeyPrefix}%`);
  }

  addRecentItem(kind: string, provider: string, itemKey: string, payload: unknown): void {
    this.db
      .prepare(
        `INSERT INTO recent_items (kind, provider, item_key, payload, updated_at)
         VALUES (?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(kind, provider, item_key) DO UPDATE SET
           payload = excluded.payload,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run(kind, provider, itemKey, JSON.stringify(payload));
  }

  listRecentItems(input: LocalRecentListInput = {}): LocalRecentItem[] {
    const limit = normalizeRecentLimit(input.limit);
    const rows = input.kind
      ? (this.db
          .prepare(
            `SELECT kind, provider, item_key AS itemKey, payload, updated_at AS updatedAt
             FROM recent_items
             WHERE provider IN ('github', 'local') AND kind = ?
             ORDER BY updated_at DESC, rowid DESC
             LIMIT ?`
          )
          .all(input.kind, limit) as RecentItemRow[])
      : (this.db
          .prepare(
            `SELECT kind, provider, item_key AS itemKey, payload, updated_at AS updatedAt
             FROM recent_items
             WHERE provider IN ('github', 'local')
             ORDER BY updated_at DESC, rowid DESC
             LIMIT ?`
          )
          .all(limit) as RecentItemRow[]);

    return rows.map((row) => mapRecentItemRow(row)).filter((item): item is LocalRecentItem => Boolean(item));
  }

  ensureDefaultGitHubArea(accountLogin?: string | null): AreaSummary {
    const existing = this.getArea(defaultGitHubAreaId);
    const selected =
      existing?.selected ?? !this.db.prepare("SELECT 1 FROM areas WHERE selected = 1 LIMIT 1").get();
    const area = createDefaultGitHubArea(accountLogin ?? existing?.accountLogin ?? null, selected);
    this.upsertArea({ ...area, createdAt: existing?.createdAt ?? area.createdAt });
    return this.getArea(defaultGitHubAreaId) ?? area;
  }

  createLocalArea(input: CreateLocalAreaInput): AreaSummary {
    const now = new Date().toISOString();
    const rootPath = input.rootPath;
    const area: AreaSummary = {
      id: localAreaId(rootPath),
      kind: "local",
      label: input.label?.trim() || basename(rootPath) || rootPath,
      subtitle: rootPath,
      rootPath,
      accountLogin: null,
      gateway: null,
      health: { status: "scanning", message: "Scanning local repositories.", checkedAt: now },
      repositoryCount: 0,
      selected: false,
      createdAt: now,
      updatedAt: now
    };
    this.upsertArea(area);
    return this.getArea(area.id) ?? area;
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
      label: input.label?.trim() || `${host}:${rootPath}`,
      subtitle: `${username ? `${username}@` : ""}${host}:${rootPath}`,
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
    return this.getArea(area.id) ?? area;
  }

  upsertArea(area: AreaSummary): void {
    if (area.selected) {
      this.db.prepare("UPDATE areas SET selected = 0 WHERE selected = 1 AND id != ?").run(area.id);
    }
    this.db
      .prepare(
        `INSERT INTO areas (
          id,
          kind,
          label,
          subtitle,
          root_path,
          account_login,
          selected,
          health_json,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @kind,
          @label,
          @subtitle,
          @rootPath,
          @accountLogin,
          @selected,
          @healthJson,
          COALESCE(@createdAt, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
          COALESCE(@updatedAt, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          label = excluded.label,
          subtitle = excluded.subtitle,
          root_path = excluded.root_path,
          account_login = excluded.account_login,
          selected = excluded.selected,
          health_json = excluded.health_json,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run(areaRowInput(area));
  }

  listAreas(): AreaSummary[] {
    const rows = this.db
      .prepare(
        `SELECT areas.id,
                areas.kind,
                areas.label,
                areas.subtitle,
                areas.root_path AS rootPath,
                areas.account_login AS accountLogin,
                areas.selected,
                area_gateways.summary_json AS gatewayJson,
                areas.health_json AS healthJson,
                COUNT(area_repositories.id) AS repositoryCount,
                areas.created_at AS createdAt,
                areas.updated_at AS updatedAt
         FROM areas
         LEFT JOIN area_repositories ON area_repositories.area_id = areas.id
         LEFT JOIN area_gateways ON area_gateways.area_id = areas.id
         GROUP BY areas.id
         ORDER BY areas.selected DESC, areas.kind ASC, areas.label ASC`
      )
      .all() as AreaRow[];
    return rows.map(mapAreaRow);
  }

  getArea(areaId: string): AreaSummary | null {
    const row = this.db
      .prepare(
        `SELECT areas.id,
                areas.kind,
                areas.label,
                areas.subtitle,
                areas.root_path AS rootPath,
                areas.account_login AS accountLogin,
                areas.selected,
                area_gateways.summary_json AS gatewayJson,
                areas.health_json AS healthJson,
                COUNT(area_repositories.id) AS repositoryCount,
                areas.created_at AS createdAt,
                areas.updated_at AS updatedAt
         FROM areas
         LEFT JOIN area_repositories ON area_repositories.area_id = areas.id
         LEFT JOIN area_gateways ON area_gateways.area_id = areas.id
         WHERE areas.id = ?
         GROUP BY areas.id`
      )
      .get(areaId) as AreaRow | undefined;
    return row ? mapAreaRow(row) : null;
  }

  selectArea(areaId: string): void {
    if (!this.getArea(areaId)) {
      throw new Error("Area does not exist.");
    }
    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE areas SET selected = 0 WHERE selected = 1").run();
      this.db
        .prepare("UPDATE areas SET selected = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(areaId);
    });
    transaction();
  }

  removeArea(areaId: string): void {
    this.db.prepare("DELETE FROM areas WHERE id = ? AND kind != 'github'").run(areaId);
  }

  getAreaGateway(areaId: string): AreaGatewayRecord | null {
    const row = this.db
      .prepare("SELECT record_json AS recordJson FROM area_gateways WHERE area_id = ?")
      .get(areaId) as { recordJson: string } | undefined;
    return row ? (JSON.parse(row.recordJson) as AreaGatewayRecord) : null;
  }

  setAreaGateway(record: AreaGatewayRecord): void {
    this.db
      .prepare(
        `INSERT INTO area_gateways (area_id, summary_json, record_json, updated_at)
         VALUES (@areaId, @summaryJson, @recordJson, CURRENT_TIMESTAMP)
         ON CONFLICT(area_id) DO UPDATE SET
           summary_json = excluded.summary_json,
           record_json = excluded.record_json,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run({
        areaId: record.areaId,
        summaryJson: JSON.stringify(areaGatewaySummary(record)),
        recordJson: JSON.stringify(record)
      });
  }

  clearAreaGateway(areaId: string): void {
    this.db.prepare("DELETE FROM area_gateways WHERE area_id = ?").run(areaId);
  }

  upsertAreaRepository(summary: AreaRepositorySummary, detail: AreaRepositoryDetail | null = null): void {
    this.db
      .prepare(
        `INSERT INTO area_repositories (
          id,
          area_id,
          kind,
          name,
          owner,
          display_name,
          path,
          default_branch,
          current_branch,
          is_dirty,
          is_private,
          description,
          connection_json,
          capabilities_json,
          health_json,
          summary_json,
          detail_json,
          scanned_at,
          updated_at
        )
        VALUES (
          @id,
          @areaId,
          @kind,
          @name,
          @owner,
          @displayName,
          @path,
          @defaultBranch,
          @currentBranch,
          @isDirty,
          @isPrivate,
          @description,
          @connectionJson,
          @capabilitiesJson,
          @healthJson,
          @summaryJson,
          @detailJson,
          @scannedAt,
          @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          area_id = excluded.area_id,
          kind = excluded.kind,
          name = excluded.name,
          owner = excluded.owner,
          display_name = excluded.display_name,
          path = excluded.path,
          default_branch = excluded.default_branch,
          current_branch = excluded.current_branch,
          is_dirty = excluded.is_dirty,
          is_private = excluded.is_private,
          description = excluded.description,
          connection_json = excluded.connection_json,
          capabilities_json = excluded.capabilities_json,
          health_json = excluded.health_json,
          summary_json = excluded.summary_json,
          detail_json = COALESCE(excluded.detail_json, area_repositories.detail_json),
          scanned_at = excluded.scanned_at,
          updated_at = excluded.updated_at`
      )
      .run(areaRepositoryRowInput(summary, detail));
  }

  listAreaRepositories(input: ListAreaRepositoriesInput): AreaRepositorySummary[] {
    const rows = this.db
      .prepare(
        `SELECT summary_json AS summaryJson,
                detail_json AS detailJson
         FROM area_repositories
         WHERE area_id = ?
         ORDER BY display_name ASC
         LIMIT ?`
      )
      .all(input.areaId, normalizeAreaLimit(input.limit, 500)) as AreaRepositoryRow[];
    return rows.map((row) => JSON.parse(row.summaryJson) as AreaRepositorySummary);
  }

  getAreaRepository(input: AreaRepositoryInput): AreaRepositoryDetail | null {
    const row = this.db
      .prepare(
        `SELECT summary_json AS summaryJson,
                detail_json AS detailJson
         FROM area_repositories
         WHERE area_id = ? AND id = ?`
      )
      .get(input.areaId, input.repositoryId) as AreaRepositoryRow | undefined;
    if (!row) {
      return null;
    }
    if (row.detailJson) {
      return JSON.parse(row.detailJson) as AreaRepositoryDetail;
    }
    return areaRepositoryDetailFromSummary(JSON.parse(row.summaryJson) as AreaRepositorySummary);
  }

  clearAreaRepositories(areaId: string): void {
    this.db.prepare("DELETE FROM area_repositories WHERE area_id = ?").run(areaId);
  }

  upsertAreaWorkspace(summary: AreaWorkspaceSummary, detail: AreaWorkspaceDetail | null = null): void {
    this.db
      .prepare(
        `INSERT INTO area_workspaces (
          id,
          area_id,
          repository_id,
          name,
          root_path,
          is_stale,
          summary_json,
          detail_json,
          scanned_at,
          updated_at
        )
        VALUES (
          @id,
          @areaId,
          @repositoryId,
          @name,
          @rootPath,
          @isStale,
          @summaryJson,
          @detailJson,
          @scannedAt,
          @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          area_id = excluded.area_id,
          repository_id = excluded.repository_id,
          name = excluded.name,
          root_path = excluded.root_path,
          is_stale = excluded.is_stale,
          summary_json = excluded.summary_json,
          detail_json = COALESCE(excluded.detail_json, area_workspaces.detail_json),
          scanned_at = excluded.scanned_at,
          updated_at = excluded.updated_at`
      )
      .run(areaWorkspaceRowInput(summary, detail));
  }

  listAreaWorkspaces(input: ListAreaWorkspacesInput): AreaWorkspaceSummary[] {
    const rows = input.repositoryId
      ? (this.db
          .prepare(
            `SELECT summary_json AS summaryJson,
                    detail_json AS detailJson
             FROM area_workspaces
             WHERE area_id = ? AND repository_id = ?
             ORDER BY name ASC`
          )
          .all(input.areaId, input.repositoryId) as AreaWorkspaceRow[])
      : (this.db
          .prepare(
            `SELECT summary_json AS summaryJson,
                    detail_json AS detailJson
             FROM area_workspaces
             WHERE area_id = ?
             ORDER BY name ASC`
          )
          .all(input.areaId) as AreaWorkspaceRow[]);
    return rows.map((row) => JSON.parse(row.summaryJson) as AreaWorkspaceSummary);
  }

  getAreaWorkspace(areaId: string, workspaceId: string): AreaWorkspaceDetail | null {
    const row = this.db
      .prepare(
        `SELECT summary_json AS summaryJson,
                detail_json AS detailJson
         FROM area_workspaces
         WHERE area_id = ? AND id = ?`
      )
      .get(areaId, workspaceId) as AreaWorkspaceRow | undefined;
    if (!row) {
      return null;
    }
    if (row.detailJson) {
      return JSON.parse(row.detailJson) as AreaWorkspaceDetail;
    }
    return areaWorkspaceDetailFromSummary(JSON.parse(row.summaryJson) as AreaWorkspaceSummary);
  }

  clearAreaWorkspaces(areaId: string, repositoryId: string | null = null): void {
    if (repositoryId) {
      this.db
        .prepare("DELETE FROM area_workspaces WHERE area_id = ? AND repository_id = ?")
        .run(areaId, repositoryId);
      return;
    }
    this.db.prepare("DELETE FROM area_workspaces WHERE area_id = ?").run(areaId);
  }

  setAreaRepoSnapshot(areaId: string, repositoryId: string, snapshotKey: string, payload: unknown): void {
    this.db
      .prepare(
        `INSERT INTO area_repo_snapshots (area_id, repository_id, snapshot_key, payload, updated_at)
         VALUES (?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(area_id, repository_id, snapshot_key) DO UPDATE SET
           payload = excluded.payload,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run(areaId, repositoryId, snapshotKey, JSON.stringify(payload));
  }

  getAreaRepoSnapshot<T>(areaId: string, repositoryId: string, snapshotKey: string): T | null {
    const row = this.db
      .prepare(
        `SELECT payload
         FROM area_repo_snapshots
         WHERE area_id = ? AND repository_id = ? AND snapshot_key = ?`
      )
      .get(areaId, repositoryId, snapshotKey) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as T) : null;
  }

  setAreaWorkspaceSnapshot(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string,
    payload: unknown
  ): void {
    this.db
      .prepare(
        `INSERT INTO area_workspace_snapshots (
          area_id,
          repository_id,
          workspace_id,
          snapshot_key,
          payload,
          updated_at
        )
         VALUES (?, ?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(area_id, repository_id, workspace_id, snapshot_key) DO UPDATE SET
           payload = excluded.payload,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run(areaId, repositoryId, workspaceId, snapshotKey, JSON.stringify(payload));
  }

  getAreaWorkspaceSnapshot<T>(
    areaId: string,
    repositoryId: string,
    workspaceId: string,
    snapshotKey: string
  ): T | null {
    const row = this.db
      .prepare(
        `SELECT payload
         FROM area_workspace_snapshots
         WHERE area_id = ? AND repository_id = ? AND workspace_id = ? AND snapshot_key = ?`
      )
      .get(areaId, repositoryId, workspaceId, snapshotKey) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as T) : null;
  }

  listGitHubRepositories(limit = 80): RepositorySummary[] {
    return this.listGitHubRepositoriesWithMetadata(limit).items;
  }

  listGitHubRepositoriesWithMetadata(limit = 80): CachedRepositoryList<RepositorySummary> {
    const rows = this.db
      .prepare(
        `SELECT summary_json AS summaryJson,
                synced_at AS syncedAt
         FROM github_repositories
         ORDER BY COALESCE(pushed_at, updated_at, synced_at) DESC
         LIMIT ?`
      )
      .all(limit) as Array<{ summaryJson: string; syncedAt: string | null }>;
    return {
      items: rows.map((row) => JSON.parse(row.summaryJson) as RepositorySummary),
      syncedAt: oldestTimestamp(rows.map((row) => row.syncedAt))
    };
  }

  getGitHubRepository(id: string): RepositorySummary | null {
    return this.getGitHubRepositoryWithMetadata(id)?.value ?? null;
  }

  getGitHubRepositoryWithMetadata(id: string): CachedRepositoryValue<RepositorySummary> | null {
    const row = this.db
      .prepare(
        `SELECT summary_json AS summaryJson,
                synced_at AS syncedAt
         FROM github_repositories
         WHERE id = ?`
      )
      .get(id) as { summaryJson: string; syncedAt: string | null } | undefined;
    return row
      ? {
          value: JSON.parse(row.summaryJson) as RepositorySummary,
          syncedAt: row.syncedAt
        }
      : null;
  }

  getGitHubRepositoryDetail(id: string): RepositoryDetail | null {
    return this.getGitHubRepositoryDetailWithMetadata(id)?.value ?? null;
  }

  getGitHubRepositoryDetailWithMetadata(id: string): CachedRepositoryValue<RepositoryDetail> | null {
    const row = this.db
      .prepare(
        `SELECT detail_json AS detailJson,
                detail_synced_at AS detailSyncedAt
         FROM github_repositories
         WHERE id = ?`
      )
      .get(id) as { detailJson: string | null; detailSyncedAt: string | null } | undefined;
    return row?.detailJson
      ? {
          value: JSON.parse(row.detailJson) as RepositoryDetail,
          syncedAt: row.detailSyncedAt
        }
      : null;
  }

  getGitHubRepositoryReadme(id: string): string | null {
    return this.getGitHubRepositoryReadmeWithMetadata(id)?.value ?? null;
  }

  getGitHubRepositoryReadmeWithMetadata(id: string): CachedRepositoryValue<string | null> | null {
    const row = this.db
      .prepare(
        `SELECT readme_markdown AS readmeMarkdown,
                readme_synced_at AS readmeSyncedAt
         FROM github_repositories
         WHERE id = ?`
      )
      .get(id) as { readmeMarkdown: string | null; readmeSyncedAt: string | null } | undefined;
    return row
      ? {
          value: row.readmeMarkdown,
          syncedAt: row.readmeSyncedAt
        }
      : null;
  }

  upsertGitHubRepositorySummary(repository: RepositorySummary): void {
    this.upsertGitHubRepository(repository, null);
  }

  upsertGitHubRepositoryDetail(repository: RepositoryDetail): void {
    this.upsertGitHubRepository(repository, repository);
  }

  upsertGitHubRepositoryReadme(id: string, readmeMarkdown: string | null): void {
    this.db
      .prepare(
        `UPDATE github_repositories
         SET readme_markdown = @readmeMarkdown,
             readme_synced_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = @id`
      )
      .run({ id, readmeMarkdown });
  }

  private upsertGitHubRepository(repository: RepositorySummary, detail: RepositoryDetail | null): void {
    this.db
      .prepare(
        `INSERT INTO github_repositories (
          id,
          owner,
          name,
          description,
          visibility,
          is_private,
          is_fork,
          default_branch,
          avatar_url,
          primary_language_json,
          counts_json,
          stargazer_count,
          fork_count,
          watcher_count,
          open_issues_count,
          pushed_at,
          updated_at,
          summary_json,
          detail_json,
          readme_markdown,
          languages_json,
          viewer_state_json,
          permissions_json,
          synced_at,
          detail_synced_at
        )
        VALUES (
          @id,
          @owner,
          @name,
          @description,
          @visibility,
          @isPrivate,
          @isFork,
          @defaultBranch,
          @avatarUrl,
          @primaryLanguageJson,
          @countsJson,
          @stargazerCount,
          @forkCount,
          @watcherCount,
          @openIssuesCount,
          @pushedAt,
          @updatedAt,
          @summaryJson,
          @detailJson,
          @readmeMarkdown,
          @languagesJson,
          @viewerStateJson,
          @permissionsJson,
          STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'),
          CASE WHEN @detailJson IS NULL THEN NULL ELSE STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now') END
        )
        ON CONFLICT(id) DO UPDATE SET
          owner = excluded.owner,
          name = excluded.name,
          description = excluded.description,
          visibility = excluded.visibility,
          is_private = excluded.is_private,
          is_fork = excluded.is_fork,
          default_branch = excluded.default_branch,
          avatar_url = excluded.avatar_url,
          primary_language_json = excluded.primary_language_json,
          counts_json = excluded.counts_json,
          stargazer_count = excluded.stargazer_count,
          fork_count = excluded.fork_count,
          watcher_count = excluded.watcher_count,
          open_issues_count = excluded.open_issues_count,
          pushed_at = excluded.pushed_at,
          updated_at = excluded.updated_at,
          summary_json = excluded.summary_json,
          detail_json = COALESCE(excluded.detail_json, github_repositories.detail_json),
          readme_markdown = COALESCE(excluded.readme_markdown, github_repositories.readme_markdown),
          languages_json = COALESCE(excluded.languages_json, github_repositories.languages_json),
          viewer_state_json = COALESCE(excluded.viewer_state_json, github_repositories.viewer_state_json),
          permissions_json = COALESCE(excluded.permissions_json, github_repositories.permissions_json),
          synced_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'),
          detail_synced_at = CASE
            WHEN excluded.detail_json IS NULL THEN github_repositories.detail_synced_at
            ELSE STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
          END`
      )
      .run(toGitHubRepositoryRow(repository, detail));
  }

  pinRepository(nameWithOwner: string): void {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO pinned_repositories (name_with_owner, created_at) VALUES (?, CURRENT_TIMESTAMP)"
      )
      .run(nameWithOwner);
    this.pinAreaRepository({
      areaId: defaultGitHubAreaId,
      repositoryId: defaultGitHubRepositoryId(nameWithOwner),
      workspaceId: null,
      nameWithOwner,
      createdAt: null
    });
  }

  unpinRepository(nameWithOwner: string): void {
    this.db.prepare("DELETE FROM pinned_repositories WHERE name_with_owner = ?").run(nameWithOwner);
    this.unpinAreaRepository({
      areaId: defaultGitHubAreaId,
      repositoryId: defaultGitHubRepositoryId(nameWithOwner),
      workspaceId: null,
      nameWithOwner,
      createdAt: null
    });
  }

  listPinnedRepositories(): string[] {
    const rows = this.db
      .prepare("SELECT name_with_owner AS nameWithOwner FROM pinned_repositories ORDER BY created_at DESC")
      .all() as Array<{ nameWithOwner: string }>;
    return rows.map((row) => row.nameWithOwner);
  }

  pinAreaRepository(input: RepositoryPinRecord): void {
    if (!input.areaId || !input.repositoryId) {
      return;
    }
    this.db
      .prepare(
        `INSERT OR IGNORE INTO area_repository_pins (
          area_id,
          repository_id,
          workspace_id,
          name_with_owner,
          created_at
        )
        VALUES (?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .run(input.areaId, input.repositoryId, input.workspaceId ?? "", input.nameWithOwner);
  }

  unpinAreaRepository(input: RepositoryPinRecord): void {
    if (!input.areaId || !input.repositoryId) {
      return;
    }
    this.db
      .prepare(
        `DELETE FROM area_repository_pins
         WHERE area_id = ? AND repository_id = ? AND workspace_id = ?`
      )
      .run(input.areaId, input.repositoryId, input.workspaceId ?? "");
  }

  listAreaRepositoryPins(): RepositoryPinRecord[] {
    const rows = this.db
      .prepare(
        `SELECT area_id AS areaId,
                repository_id AS repositoryId,
                workspace_id AS workspaceId,
                name_with_owner AS nameWithOwner,
                created_at AS createdAt
         FROM area_repository_pins
         ORDER BY created_at DESC`
      )
      .all() as Array<{
      areaId: string;
      repositoryId: string;
      workspaceId: string;
      nameWithOwner: string | null;
      createdAt: string;
    }>;
    return rows.map((row) => ({
      areaId: row.areaId,
      repositoryId: row.repositoryId,
      workspaceId: row.workspaceId || null,
      nameWithOwner: row.nameWithOwner,
      createdAt: row.createdAt
    }));
  }

  private migrateLegacyRepositoryPins(): void {
    const rows = this.db
      .prepare("SELECT name_with_owner AS nameWithOwner, created_at AS createdAt FROM pinned_repositories")
      .all() as Array<{ nameWithOwner: string; createdAt: string | null }>;

    const statement = this.db.prepare(
      `INSERT OR IGNORE INTO area_repository_pins (
        area_id,
        repository_id,
        workspace_id,
        name_with_owner,
        created_at
      )
      VALUES (?, ?, '', ?, COALESCE(?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')))`
    );
    const transaction = this.db.transaction((items: typeof rows) => {
      for (const row of items) {
        statement.run(
          defaultGitHubAreaId,
          defaultGitHubRepositoryId(row.nameWithOwner),
          row.nameWithOwner,
          row.createdAt
        );
      }
    });
    transaction(rows);
  }

  private migrateLegacyGitHubRecents(): void {
    const rows = this.db
      .prepare(
        `SELECT kind,
                provider,
                item_key AS itemKey,
                payload
         FROM recent_items
         WHERE provider = 'github'`
      )
      .all() as Array<{ kind: string; provider: string; itemKey: string; payload: string }>;

    const statement = this.db.prepare(
      `UPDATE recent_items
       SET payload = ?
       WHERE kind = ? AND provider = ? AND item_key = ?`
    );
    const transaction = this.db.transaction((items: typeof rows) => {
      for (const row of items) {
        const payload = parseRecentPayload(row.payload);
        const repositoryNameWithOwner =
          stringValue(payload.repositoryNameWithOwner) ??
          stringValue(payload.nameWithOwner) ??
          (row.kind === "repository" ? row.itemKey : null);
        if (!repositoryNameWithOwner) {
          continue;
        }
        statement.run(
          JSON.stringify({
            ...payload,
            areaId: stringValue(payload.areaId) ?? defaultGitHubAreaId,
            repositoryId:
              stringValue(payload.repositoryId) ?? defaultGitHubRepositoryId(repositoryNameWithOwner),
            workspaceId: stringValue(payload.workspaceId)
          }),
          row.kind,
          row.provider,
          row.itemKey
        );
      }
    });
    transaction(rows);
  }
}

class MemoryLocalStore implements LocalStore {
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
    this.settings = { ...this.settings, ...settings };
    return this.getSettings();
  }

  saveAccount(provider: string, login: string, payload: unknown): void {
    const key = `${provider}:${login}`;
    this.accounts.delete(key);
    this.accounts.set(key, payload);
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
      .map((item) => mapRecentItemRow({ ...item, payload: JSON.stringify(item.payload) }))
      .filter((item): item is LocalRecentItem => Boolean(item));
  }

  ensureDefaultGitHubArea(accountLogin?: string | null): AreaSummary {
    const existing = this.areas.get(defaultGitHubAreaId);
    const area = {
      ...createDefaultGitHubArea(
        accountLogin ?? existing?.accountLogin ?? null,
        existing?.selected ?? this.selectedAreaIsMissing()
      ),
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
      label: input.label?.trim() || basename(input.rootPath) || input.rootPath,
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
      label: input.label?.trim() || `${host}:${rootPath}`,
      subtitle: `${username ? `${username}@` : ""}${host}:${rootPath}`,
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

  private selectedAreaIsMissing(): boolean {
    return ![...this.areas.values()].some((area) => area.selected);
  }
}

function cacheExpiresAtIsExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now();
}

function oldestTimestamp(timestamps: Array<string | null>): string | null {
  const parsedTimestamps = timestamps
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .map((timestamp) => ({ timestamp, time: Date.parse(timestamp) }))
    .filter((entry) => Number.isFinite(entry.time));

  if (parsedTimestamps.length === 0) {
    return null;
  }

  return parsedTimestamps.reduce((oldest, entry) => (entry.time < oldest.time ? entry : oldest)).timestamp;
}

function toGitHubRepositoryRow(
  repository: RepositorySummary,
  detail: RepositoryDetail | null
): Record<string, unknown> {
  return {
    id: repository.nameWithOwner,
    owner: repository.owner,
    name: repository.name,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate ? 1 : 0,
    isFork: repository.isFork ? 1 : 0,
    defaultBranch: repository.defaultBranch,
    avatarUrl: repository.avatarUrl,
    primaryLanguageJson: JSON.stringify(repository.primaryLanguage),
    countsJson: JSON.stringify(repository.counts),
    stargazerCount: repository.stargazerCount,
    forkCount: repository.forkCount,
    watcherCount: repository.watcherCount,
    openIssuesCount: repository.openIssuesCount,
    pushedAt: repository.pushedAt,
    updatedAt: repository.updatedAt,
    summaryJson: JSON.stringify(repository),
    detailJson: detail ? JSON.stringify(detail) : null,
    readmeMarkdown: detail?.readmeMarkdown ?? null,
    languagesJson: detail ? JSON.stringify(detail.languages) : null,
    viewerStateJson: detail ? JSON.stringify(detail.viewerState) : null,
    permissionsJson: detail ? JSON.stringify(detail.permissions) : null
  };
}

function normalizeRecentLimit(limit: number | undefined): number {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.trunc(limit)))
    : 12;
}

function normalizeAreaLimit(limit: number | undefined, fallback: number): number {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(1000, Math.max(1, Math.trunc(limit)))
    : fallback;
}

const defaultGitHubAreaId = "github:default";

function createDefaultGitHubArea(accountLogin: string | null, selected: boolean): AreaSummary {
  const now = new Date().toISOString();
  return {
    id: defaultGitHubAreaId,
    kind: "github",
    label: "GitHub",
    subtitle: accountLogin ? `@${accountLogin}` : "Default GitHub account",
    rootPath: null,
    accountLogin,
    gateway: null,
    health: {
      status: accountLogin ? "ready" : "needs-auth",
      message: accountLogin ? null : "Sign in to GitHub to refresh remote data.",
      checkedAt: now
    },
    repositoryCount: 0,
    selected,
    createdAt: now,
    updatedAt: now
  };
}

function localAreaId(rootPath: string): string {
  return `local:${createHash("sha256").update(rootPath).digest("hex").slice(0, 16)}`;
}

function sshAreaId(input: {
  host: string;
  rootPath: string;
  username: string | null;
  port: number | null;
}): string {
  const authority = `${input.username ?? ""}@${input.host}:${input.port ?? 22}`;
  return `ssh:${createHash("sha256").update(`${authority}:${input.rootPath}`).digest("hex").slice(0, 16)}`;
}

function defaultGitHubRepositoryId(nameWithOwner: string): string {
  return `github:default:${nameWithOwner.toLowerCase()}`;
}

function areaRepoSnapshotKey(areaId: string, repositoryId: string, snapshotKey: string): string {
  return `${areaId}:${repositoryId}:${snapshotKey}`;
}

function areaWorkspaceSnapshotKey(
  areaId: string,
  repositoryId: string,
  workspaceId: string,
  snapshotKey: string
): string {
  return `${areaId}:${repositoryId}:${workspaceId}:${snapshotKey}`;
}

function areaRepositoryPinKey(areaId: string, repositoryId: string, workspaceId: string | null): string {
  return `${areaId}:${repositoryId}:${workspaceId ?? ""}`;
}

function areaRowInput(area: AreaSummary): Record<string, unknown> {
  return {
    id: area.id,
    kind: area.kind,
    label: area.label,
    subtitle: area.subtitle,
    rootPath: area.rootPath,
    accountLogin: area.accountLogin,
    selected: area.selected ? 1 : 0,
    healthJson: JSON.stringify(area.health),
    createdAt: area.createdAt,
    updatedAt: area.updatedAt
  };
}

function mapAreaRow(row: AreaRow): AreaSummary {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    subtitle: row.subtitle,
    rootPath: row.rootPath,
    accountLogin: row.accountLogin,
    gateway: row.gatewayJson ? parseJson(row.gatewayJson, null) : null,
    health: parseJson(row.healthJson, {
      status: "error",
      message: "Area health could not be read.",
      checkedAt: null
    }),
    repositoryCount: row.repositoryCount,
    selected: Boolean(row.selected),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function areaGatewaySummary(record: AreaGatewayRecord): AreaSummary["gateway"] {
  return {
    status: record.status,
    version: record.version,
    apiUrl: record.apiUrl,
    adminUrl: record.adminUrl,
    serviceName: record.serviceName,
    lastStartedAt: record.lastStartedAt,
    lastSeenAt: record.lastSeenAt,
    message: record.message
  };
}

function areaRepositoryRowInput(
  summary: AreaRepositorySummary,
  detail: AreaRepositoryDetail | null
): Record<string, unknown> {
  return {
    id: summary.id,
    areaId: summary.areaId,
    kind: summary.kind,
    name: summary.name,
    owner: summary.owner,
    displayName: summary.displayName,
    path: summary.path,
    defaultBranch: summary.defaultBranch,
    currentBranch: summary.currentBranch,
    isDirty: summary.isDirty === null ? null : summary.isDirty ? 1 : 0,
    isPrivate: summary.isPrivate === null ? null : summary.isPrivate ? 1 : 0,
    description: summary.description,
    connectionJson: summary.connection ? JSON.stringify(summary.connection) : null,
    capabilitiesJson: JSON.stringify(summary.capabilities),
    healthJson: JSON.stringify(summary.health),
    summaryJson: JSON.stringify(summary),
    detailJson: detail ? JSON.stringify(detail) : null,
    scannedAt: summary.scannedAt,
    updatedAt: summary.updatedAt
  };
}

function areaWorkspaceRowInput(
  summary: AreaWorkspaceSummary,
  detail: AreaWorkspaceDetail | null
): Record<string, unknown> {
  return {
    id: summary.id,
    areaId: summary.areaId,
    repositoryId: summary.repositoryId,
    name: summary.name,
    rootPath: summary.rootPath,
    isStale: summary.isStale ? 1 : 0,
    summaryJson: JSON.stringify(summary),
    detailJson: detail ? JSON.stringify(detail) : null,
    scannedAt: summary.scannedAt,
    updatedAt: summary.updatedAt
  };
}

function areaRepositoryDetailFromSummary(summary: AreaRepositorySummary): AreaRepositoryDetail {
  return {
    ...summary,
    remotes: [],
    branches: [],
    bookmarks: [],
    tags: [],
    status: emptyAreaStatus(),
    recentCommits: [],
    recentOperations: [],
    readme: null,
    workspaces: []
  };
}

function areaWorkspaceDetailFromSummary(summary: AreaWorkspaceSummary): AreaWorkspaceDetail {
  return {
    ...summary,
    fileTree: [],
    readme: null,
    status: emptyAreaStatus()
  };
}

function emptyAreaStatus() {
  return {
    clean: null,
    dirtyCount: 0,
    untrackedCount: 0,
    conflictedCount: 0,
    ahead: null,
    behind: null,
    entries: []
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapRecentItemRow(row: RecentItemRow): LocalRecentItem | null {
  if (!isLocalRecentKind(row.kind) || (row.provider !== "github" && row.provider !== "local")) {
    return null;
  }

  const payload = parseRecentPayload(row.payload);
  const repositoryNameWithOwner =
    stringValue(payload.repositoryNameWithOwner) ??
    stringValue(payload.nameWithOwner) ??
    (row.kind === "repository" ? row.itemKey : null);
  const metadata = metadataValue(payload.metadata);

  if (!metadata.path && typeof payload.path === "string") {
    metadata.path = payload.path;
  }
  if (!metadata.ref && typeof payload.ref === "string") {
    metadata.ref = payload.ref;
  }
  if (!metadata.number && typeof payload.number === "number") {
    metadata.number = payload.number;
  }

  const areaId = stringValue(payload.areaId);
  const repositoryId = stringValue(payload.repositoryId);
  const workspaceId = stringValue(payload.workspaceId);

  return {
    kind: row.kind,
    provider: row.provider,
    itemKey: row.itemKey,
    title: stringValue(payload.title) ?? stringValue(payload.nameWithOwner) ?? row.itemKey,
    subtitle: stringValue(payload.subtitle) ?? stringValue(payload.description),
    repositoryNameWithOwner,
    areaId,
    repositoryId,
    workspaceId,
    url:
      stringValue(payload.url) ??
      stringValue(payload.htmlUrl) ??
      (row.provider === "github" && repositoryNameWithOwner
        ? `https://github.com/${repositoryNameWithOwner}`
        : null),
    metadata,
    updatedAt: row.updatedAt
  };
}

function parseRecentPayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isLocalRecentKind(kind: string): kind is LocalRecentItem["kind"] {
  return (
    kind === "repository" ||
    kind === "commit" ||
    kind === "issue" ||
    kind === "pullRequest" ||
    kind === "discussion" ||
    kind === "organization" ||
    kind === "team" ||
    kind === "contributor" ||
    kind === "project" ||
    kind === "release" ||
    kind === "releaseAsset" ||
    kind === "workflowRun" ||
    kind === "workflowArtifact" ||
    kind === "securityItem" ||
    kind === "wikiPage" ||
    kind === "file"
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function metadataValue(value: unknown): LocalRecentMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<LocalRecentMetadata>(
    (metadata, [key, item]) => {
      if (
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null
      ) {
        metadata[key] = item;
      }
      return metadata;
    },
    {}
  );
}

function normalizeSettings(settings: Record<string, unknown>): ControlSettings {
  const credentialProvider =
    settings.credentialProvider === "github-oauth" ? "github-oauth" : defaultSettings.credentialProvider;
  return {
    credentialProvider,
    glassMode:
      settings.glassMode === "reduced" ||
      settings.glassMode === "solid" ||
      settings.glassMode === "glass-shell"
        ? settings.glassMode
        : defaultSettings.glassMode
  };
}
