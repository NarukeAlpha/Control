import type { StorageDatabase } from "./database";

export function bootstrapSqliteSchema(db: StorageDatabase): void {
  db.operation("schema.bootstrap", () => {
    db.pragma("journal_mode = WAL");
    db.exec(`
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
        last_modified TEXT,
        validator_json TEXT,
        validated_at TEXT,
        validation_state TEXT,
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
    ensureCacheEntryColumn(db, "last_modified", "TEXT");
    ensureCacheEntryColumn(db, "validator_json", "TEXT");
    ensureCacheEntryColumn(db, "validated_at", "TEXT");
    ensureCacheEntryColumn(db, "validation_state", "TEXT");
  });
}

function ensureCacheEntryColumn(db: StorageDatabase, columnName: string, columnType: string): void {
  const columns = db.all<{ name: string }>("PRAGMA table_info(cache_entries)");
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.run(`ALTER TABLE cache_entries ADD COLUMN ${columnName} ${columnType}`);
}
