import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { ControlSettings, RepositoryDetail, RepositorySummary } from "@shared/github";

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

export interface LocalStore {
  getSettings(): ControlSettings;
  updateSettings(settings: Partial<ControlSettings>): ControlSettings;
  saveAccount(provider: string, login: string, payload: unknown): void;
  getCache<T>(provider: string, cacheKey: string): T | null;
  setCache(record: CacheRecord): void;
  addRecentItem(kind: string, provider: string, itemKey: string, payload: unknown): void;
  listGitHubRepositories(limit?: number): RepositorySummary[];
  getGitHubRepository(id: string): RepositorySummary | null;
  getGitHubRepositoryDetail(id: string): RepositoryDetail | null;
  getGitHubRepositoryReadme(id: string): string | null;
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
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
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

  getCache<T>(provider: string, cacheKey: string): T | null {
    const row = this.db
      .prepare("SELECT payload, expires_at AS expiresAt FROM cache_entries WHERE provider = ? AND cache_key = ?")
      .get(provider, cacheKey) as { payload: string; expiresAt: string | null } | undefined;

    if (!row) {
      return null;
    }

    if (row.expiresAt && Date.parse(row.expiresAt) < Date.now()) {
      return null;
    }

    return JSON.parse(row.payload) as T;
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

  addRecentItem(kind: string, provider: string, itemKey: string, payload: unknown): void {
    this.db
      .prepare(
        `INSERT INTO recent_items (kind, provider, item_key, payload, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(kind, provider, item_key) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`
      )
      .run(kind, provider, itemKey, JSON.stringify(payload));
  }

  listGitHubRepositories(limit = 80): RepositorySummary[] {
    const rows = this.db
      .prepare(
        `SELECT summary_json AS summaryJson
         FROM github_repositories
         ORDER BY COALESCE(pushed_at, updated_at, synced_at) DESC
         LIMIT ?`
      )
      .all(limit) as Array<{ summaryJson: string }>;
    return rows.map((row) => JSON.parse(row.summaryJson) as RepositorySummary);
  }

  getGitHubRepository(id: string): RepositorySummary | null {
    const row = this.db
      .prepare("SELECT summary_json AS summaryJson FROM github_repositories WHERE id = ?")
      .get(id) as { summaryJson: string } | undefined;
    return row ? (JSON.parse(row.summaryJson) as RepositorySummary) : null;
  }

  getGitHubRepositoryDetail(id: string): RepositoryDetail | null {
    const row = this.db
      .prepare("SELECT detail_json AS detailJson FROM github_repositories WHERE id = ?")
      .get(id) as { detailJson: string | null } | undefined;
    return row?.detailJson ? (JSON.parse(row.detailJson) as RepositoryDetail) : null;
  }

  getGitHubRepositoryReadme(id: string): string | null {
    const row = this.db
      .prepare("SELECT readme_markdown AS readmeMarkdown FROM github_repositories WHERE id = ?")
      .get(id) as { readmeMarkdown: string | null } | undefined;
    return row?.readmeMarkdown ?? null;
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
             readme_synced_at = CURRENT_TIMESTAMP
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
          CURRENT_TIMESTAMP,
          CASE WHEN @detailJson IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
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
          synced_at = CURRENT_TIMESTAMP,
          detail_synced_at = CASE
            WHEN excluded.detail_json IS NULL THEN github_repositories.detail_synced_at
            ELSE CURRENT_TIMESTAMP
          END`
      )
      .run(toGitHubRepositoryRow(repository, detail));
  }

  pinRepository(nameWithOwner: string): void {
    this.db
      .prepare("INSERT OR IGNORE INTO pinned_repositories (name_with_owner, created_at) VALUES (?, CURRENT_TIMESTAMP)")
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
  private readonly cache = new Map<string, CacheRecord>();
  private readonly recentItems = new Map<string, unknown>();
  private readonly repositories = new Map<string, { summary: RepositorySummary; detail: RepositoryDetail | null; readme: string | null }>();
  private readonly pinnedRepositories = new Set<string>();

  getSettings(): ControlSettings {
    return normalizeSettings({ ...this.settings });
  }

  updateSettings(settings: Partial<ControlSettings>): ControlSettings {
    this.settings = { ...this.settings, ...settings };
    return this.getSettings();
  }

  saveAccount(provider: string, login: string, payload: unknown): void {
    this.accounts.set(`${provider}:${login}`, payload);
  }

  getCache<T>(provider: string, cacheKey: string): T | null {
    const record = this.cache.get(`${provider}:${cacheKey}`);
    if (!record) {
      return null;
    }
    if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
      return null;
    }
    return record.payload as T;
  }

  setCache(record: CacheRecord): void {
    this.cache.set(`${record.provider}:${record.cacheKey}`, record);
  }

  addRecentItem(kind: string, provider: string, itemKey: string, payload: unknown): void {
    this.recentItems.set(`${kind}:${provider}:${itemKey}`, payload);
  }

  listGitHubRepositories(limit = 80): RepositorySummary[] {
    return [...this.repositories.values()]
      .map((record) => record.summary)
      .sort((a, b) =>
        (Date.parse(b.pushedAt ?? b.updatedAt ?? "0") || 0) -
        (Date.parse(a.pushedAt ?? a.updatedAt ?? "0") || 0)
      )
      .slice(0, limit);
  }

  getGitHubRepository(id: string): RepositorySummary | null {
    return this.repositories.get(id)?.summary ?? null;
  }

  getGitHubRepositoryDetail(id: string): RepositoryDetail | null {
    return this.repositories.get(id)?.detail ?? null;
  }

  getGitHubRepositoryReadme(id: string): string | null {
    return this.repositories.get(id)?.readme ?? null;
  }

  upsertGitHubRepositorySummary(repository: RepositorySummary): void {
    const existing = this.repositories.get(repository.nameWithOwner);
    this.repositories.set(repository.nameWithOwner, {
      summary: repository,
      detail: existing?.detail ?? null,
      readme: existing?.readme ?? null
    });
  }

  upsertGitHubRepositoryDetail(repository: RepositoryDetail): void {
    this.repositories.set(repository.nameWithOwner, {
      summary: repository,
      detail: repository,
      readme: repository.readmeMarkdown
    });
  }

  upsertGitHubRepositoryReadme(id: string, readme: string | null): void {
    const existing = this.repositories.get(id);
    if (!existing) {
      return;
    }
    this.repositories.set(id, { ...existing, readme });
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

function toGitHubRepositoryRow(repository: RepositorySummary, detail: RepositoryDetail | null): Record<string, unknown> {
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

function normalizeSettings(settings: Record<string, unknown>): ControlSettings {
  const credentialProvider = settings.credentialProvider === "github-oauth" ? "github-oauth" : defaultSettings.credentialProvider;
  return {
    credentialProvider,
    glassMode:
      settings.glassMode === "reduced" || settings.glassMode === "solid" || settings.glassMode === "glass-shell"
        ? settings.glassMode
        : defaultSettings.glassMode
  };
}
