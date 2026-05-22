import type { RepositoryPinRecord } from "@shared/local";

import type { DatabaseConnection, StorageDatabase } from "./database";
import { defaultGitHubAreaId, defaultGitHubRepositoryId } from "./mappers";

export function pinRepository(db: StorageDatabase, nameWithOwner: string): void {
  db.operation("repositoryPins.pinLegacy", () => {
    db.run(
      "INSERT OR IGNORE INTO pinned_repositories (name_with_owner, created_at) VALUES (?, CURRENT_TIMESTAMP)",
      nameWithOwner
    );
    writeAreaRepositoryPin(db, {
      areaId: defaultGitHubAreaId,
      repositoryId: defaultGitHubRepositoryId(nameWithOwner),
      workspaceId: null,
      nameWithOwner,
      createdAt: null
    });
  });
}

export function unpinRepository(db: StorageDatabase, nameWithOwner: string): void {
  db.operation("repositoryPins.unpinLegacy", () => {
    db.run("DELETE FROM pinned_repositories WHERE name_with_owner = ?", nameWithOwner);
    deleteAreaRepositoryPin(db, {
      areaId: defaultGitHubAreaId,
      repositoryId: defaultGitHubRepositoryId(nameWithOwner),
      workspaceId: null,
      nameWithOwner,
      createdAt: null
    });
  });
}

export function listPinnedRepositories(db: StorageDatabase): string[] {
  return db.operation("repositoryPins.listLegacy", () => {
    const rows = db.all<{ nameWithOwner: string }>(
      "SELECT name_with_owner AS nameWithOwner FROM pinned_repositories ORDER BY created_at DESC"
    );
    return rows.map((row) => row.nameWithOwner);
  });
}

export function pinAreaRepository(db: StorageDatabase, input: RepositoryPinRecord): void {
  db.operation("repositoryPins.pinArea", () => {
    writeAreaRepositoryPin(db, input);
  });
}

export function unpinAreaRepository(db: StorageDatabase, input: RepositoryPinRecord): void {
  db.operation("repositoryPins.unpinArea", () => {
    deleteAreaRepositoryPin(db, input);
  });
}

export function listAreaRepositoryPins(db: StorageDatabase): RepositoryPinRecord[] {
  return db.operation("repositoryPins.listArea", () => {
    const rows = db.all<{
      areaId: string;
      repositoryId: string;
      workspaceId: string;
      nameWithOwner: string | null;
      createdAt: string;
    }>(
      `SELECT area_id AS areaId,
              repository_id AS repositoryId,
              workspace_id AS workspaceId,
              name_with_owner AS nameWithOwner,
              created_at AS createdAt
       FROM area_repository_pins
       ORDER BY created_at DESC`
    );
    return rows.map((row) => ({
      areaId: row.areaId,
      repositoryId: row.repositoryId,
      workspaceId: row.workspaceId || null,
      nameWithOwner: row.nameWithOwner,
      createdAt: row.createdAt
    }));
  });
}

export function migrateLegacyRepositoryPins(db: StorageDatabase): void {
  db.operation("repositoryPins.migrateLegacy", () => {
    const rows = db.all<{ nameWithOwner: string; createdAt: string | null }>(
      "SELECT name_with_owner AS nameWithOwner, created_at AS createdAt FROM pinned_repositories"
    );

    db.transaction("repositoryPins.migrateLegacy.insert", (tx) => {
      for (const row of rows) {
        tx.run(
          `INSERT OR IGNORE INTO area_repository_pins (
            area_id,
            repository_id,
            workspace_id,
            name_with_owner,
            created_at
          )
          VALUES (?, ?, '', ?, COALESCE(?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')))`,
          defaultGitHubAreaId,
          defaultGitHubRepositoryId(row.nameWithOwner),
          row.nameWithOwner,
          row.createdAt
        );
      }
    });
  });
}

function writeAreaRepositoryPin(db: DatabaseConnection, input: RepositoryPinRecord): void {
  if (!input.areaId || !input.repositoryId) {
    return;
  }
  db.run(
    `INSERT OR IGNORE INTO area_repository_pins (
      area_id,
      repository_id,
      workspace_id,
      name_with_owner,
      created_at
    )
    VALUES (?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    input.areaId,
    input.repositoryId,
    input.workspaceId ?? "",
    input.nameWithOwner
  );
}

function deleteAreaRepositoryPin(db: DatabaseConnection, input: RepositoryPinRecord): void {
  if (!input.areaId || !input.repositoryId) {
    return;
  }
  db.run(
    `DELETE FROM area_repository_pins
     WHERE area_id = ? AND repository_id = ? AND workspace_id = ?`,
    input.areaId,
    input.repositoryId,
    input.workspaceId ?? ""
  );
}
