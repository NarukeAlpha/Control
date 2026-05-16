import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { ControlSettings, RepositoryDetail, RepositorySummary } from "@shared/github";
import type { LocalRecentItem, LocalRecentListInput, LocalRecentMetadata } from "@shared/local";

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
             WHERE provider = 'github' AND kind = ?
             ORDER BY updated_at DESC, rowid DESC
             LIMIT ?`
          )
          .all(input.kind, limit) as RecentItemRow[])
      : (this.db
          .prepare(
            `SELECT kind, provider, item_key AS itemKey, payload, updated_at AS updatedAt
             FROM recent_items
             WHERE provider = 'github'
             ORDER BY updated_at DESC, rowid DESC
             LIMIT ?`
          )
          .all(limit) as RecentItemRow[]);

    return rows.map((row) => mapRecentItemRow(row)).filter((item): item is LocalRecentItem => Boolean(item));
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
  }

  unpinRepository(nameWithOwner: string): void {
    this.db.prepare("DELETE FROM pinned_repositories WHERE name_with_owner = ?").run(nameWithOwner);
  }

  listPinnedRepositories(): string[] {
    const rows = this.db
      .prepare("SELECT name_with_owner AS nameWithOwner FROM pinned_repositories ORDER BY created_at DESC")
      .all() as Array<{ nameWithOwner: string }>;
    return rows.map((row) => row.nameWithOwner);
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
  private readonly pinnedRepositories = new Set<string>();

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
      .filter((item) => item.provider === "github" && (!input.kind || item.kind === input.kind))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, normalizeRecentLimit(input.limit))
      .map((item) => mapRecentItemRow({ ...item, payload: JSON.stringify(item.payload) }))
      .filter((item): item is LocalRecentItem => Boolean(item));
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
  }

  unpinRepository(nameWithOwner: string): void {
    this.pinnedRepositories.delete(nameWithOwner);
  }

  listPinnedRepositories(): string[] {
    return [...this.pinnedRepositories];
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

function mapRecentItemRow(row: RecentItemRow): LocalRecentItem | null {
  if (!isLocalRecentKind(row.kind) || row.provider !== "github") {
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

  return {
    kind: row.kind,
    provider: "github",
    itemKey: row.itemKey,
    title: stringValue(payload.title) ?? stringValue(payload.nameWithOwner) ?? row.itemKey,
    subtitle: stringValue(payload.subtitle) ?? stringValue(payload.description),
    repositoryNameWithOwner,
    url:
      stringValue(payload.url) ??
      stringValue(payload.htmlUrl) ??
      (repositoryNameWithOwner ? `https://github.com/${repositoryNameWithOwner}` : null),
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
