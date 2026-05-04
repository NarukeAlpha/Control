import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { ControlSettings } from "@shared/github";

const defaultSettings: ControlSettings = {
  credentialProvider: "gh-cli",
  ghPath: null,
  githubAppClientId: null,
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
    `);
  }

  getSettings(): ControlSettings {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
    const stored = rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.key] = JSON.parse(row.value) as unknown;
      return acc;
    }, {});

    return {
      ...defaultSettings,
      ...stored
    };
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
  private readonly pinnedRepositories = new Set<string>();

  getSettings(): ControlSettings {
    return { ...this.settings };
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

