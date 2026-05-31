import type { RepositoryDetail, RepositoryListResult, RepositorySummary } from "@shared/github";

import { writeCacheEntry } from "./cacheStore";
import type { DatabaseConnection, StorageDatabase } from "./database";
import { oldestTimestamp, toGitHubRepositoryRow } from "./mappers";
import { parseStorageJson } from "./serializers";

export interface CachedRepositoryList<T> {
  items: T[];
  syncedAt: string | null;
}

export interface CachedRepositoryValue<T> {
  value: T;
  syncedAt: string | null;
}

export function listGitHubRepositories(db: StorageDatabase, limit = 80): RepositorySummary[] {
  return listGitHubRepositoriesWithMetadata(db, limit).items;
}

export function listGitHubRepositoriesWithMetadata(
  db: StorageDatabase,
  limit = 80
): CachedRepositoryList<RepositorySummary> {
  return db.operation("githubRepositories.list", () => {
    const rows = db.all<{ summaryJson: string; syncedAt: string | null }>(
      `SELECT summary_json AS summaryJson,
              synced_at AS syncedAt
       FROM github_repositories
       ORDER BY COALESCE(pushed_at, updated_at, synced_at) DESC
       LIMIT ?`,
      limit
    );
    return {
      items: rows.map((row) =>
        parseStorageJson<RepositorySummary>("githubRepositories.summary", row.summaryJson)
      ),
      syncedAt: oldestTimestamp(rows.map((row) => row.syncedAt))
    };
  });
}

export function getGitHubRepository(db: StorageDatabase, id: string): RepositorySummary | null {
  return getGitHubRepositoryWithMetadata(db, id)?.value ?? null;
}

export function getGitHubRepositoryWithMetadata(
  db: StorageDatabase,
  id: string
): CachedRepositoryValue<RepositorySummary> | null {
  return db.operation("githubRepositories.readSummary", () => {
    const row = db.get<{ summaryJson: string; syncedAt: string | null }>(
      `SELECT summary_json AS summaryJson,
              synced_at AS syncedAt
       FROM github_repositories
       WHERE id = ?`,
      id
    );
    return row
      ? {
          value: parseStorageJson<RepositorySummary>("githubRepositories.summary", row.summaryJson),
          syncedAt: row.syncedAt
        }
      : null;
  });
}

export function getGitHubRepositoryDetail(db: StorageDatabase, id: string): RepositoryDetail | null {
  return getGitHubRepositoryDetailWithMetadata(db, id)?.value ?? null;
}

export function getGitHubRepositoryDetailWithMetadata(
  db: StorageDatabase,
  id: string
): CachedRepositoryValue<RepositoryDetail> | null {
  return db.operation("githubRepositories.readDetail", () => {
    const row = db.get<{ detailJson: string | null; detailSyncedAt: string | null }>(
      `SELECT detail_json AS detailJson,
              detail_synced_at AS detailSyncedAt
       FROM github_repositories
       WHERE id = ?`,
      id
    );
    return row?.detailJson
      ? {
          value: parseStorageJson<RepositoryDetail>("githubRepositories.detail", row.detailJson),
          syncedAt: row.detailSyncedAt
        }
      : null;
  });
}

export function getGitHubRepositoryReadme(db: StorageDatabase, id: string): string | null {
  return getGitHubRepositoryReadmeWithMetadata(db, id)?.value ?? null;
}

export function getGitHubRepositoryReadmeWithMetadata(
  db: StorageDatabase,
  id: string
): CachedRepositoryValue<string | null> | null {
  return db.operation("githubRepositories.readReadme", () => {
    const row = db.get<{ readmeMarkdown: string | null; readmeSyncedAt: string | null }>(
      `SELECT readme_markdown AS readmeMarkdown,
              readme_synced_at AS readmeSyncedAt
       FROM github_repositories
       WHERE id = ?`,
      id
    );
    return row
      ? {
          value: row.readmeMarkdown,
          syncedAt: row.readmeSyncedAt
        }
      : null;
  });
}

export function upsertGitHubRepositorySummary(db: StorageDatabase, repository: RepositorySummary): void {
  db.operation("githubRepositories.writeSummary", () => {
    writeGitHubRepository(db, repository, null);
  });
}

export function upsertGitHubRepositoryDetail(db: StorageDatabase, repository: RepositoryDetail): void {
  db.operation("githubRepositories.writeDetail", () => {
    writeGitHubRepository(db, repository, repository);
  });
}

export function upsertGitHubRepositoryReadme(
  db: StorageDatabase,
  id: string,
  readmeMarkdown: string | null
): void {
  db.operation("githubRepositories.writeReadme", () => {
    db.run(
      `UPDATE github_repositories
       SET readme_markdown = @readmeMarkdown,
           readme_synced_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = @id`,
      { id, readmeMarkdown }
    );
  });
}

export function setGitHubRepositoriesWithStatusCache(
  db: StorageDatabase,
  input: {
    repositories: RepositorySummary[];
    cacheKey: string;
    result: RepositoryListResult;
    etag: string | null;
    expiresAt: string | null;
  }
): void {
  db.transaction("githubRepositories.writeStatusCache", () => {
    for (const repository of input.repositories) {
      writeGitHubRepository(db, repository, null);
    }
    writeCacheEntry(db, {
      provider: "github",
      cacheKey: input.cacheKey,
      payload: input.result,
      etag: input.etag,
      expiresAt: input.expiresAt
    });
  });
}

function writeGitHubRepository(
  db: DatabaseConnection,
  repository: RepositorySummary,
  detail: RepositoryDetail | null
): void {
  db.run(
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
      END`,
    toGitHubRepositoryRow(repository, detail)
  );
}
