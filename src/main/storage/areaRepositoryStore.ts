import type {
  AreaRepositoryDetail,
  AreaRepositoryInput,
  AreaRepositorySummary,
  ListAreaRepositoriesInput
} from "@shared/areas";

import type { StorageDatabase } from "./database";
import { areaRepositoryDetailFromSummary, normalizeAreaLimit } from "./mappers";
import { parseStorageJson, stringifyStorageJson } from "./serializers";

interface AreaRepositoryRow {
  summaryJson: string;
  detailJson: string | null;
}

export function upsertAreaRepository(
  db: StorageDatabase,
  summary: AreaRepositorySummary,
  detail: AreaRepositoryDetail | null = null
): void {
  db.operation("areaRepositories.write", () => {
    db.run(
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
        updated_at = excluded.updated_at`,
      areaRepositoryRowInput(summary, detail)
    );
  });
}

export function listAreaRepositories(
  db: StorageDatabase,
  input: ListAreaRepositoriesInput
): AreaRepositorySummary[] {
  return db.operation("areaRepositories.list", () => {
    const rows = db.all<AreaRepositoryRow>(
      `SELECT summary_json AS summaryJson,
              detail_json AS detailJson
       FROM area_repositories
       WHERE area_id = ?
       ORDER BY display_name ASC
       LIMIT ?`,
      input.areaId,
      normalizeAreaLimit(input.limit, 500)
    );
    return rows.map((row) =>
      parseStorageJson<AreaRepositorySummary>("areaRepositories.summary", row.summaryJson)
    );
  });
}

export function getAreaRepository(
  db: StorageDatabase,
  input: AreaRepositoryInput
): AreaRepositoryDetail | null {
  return db.operation("areaRepositories.read", () => {
    const row = db.get<AreaRepositoryRow>(
      `SELECT summary_json AS summaryJson,
              detail_json AS detailJson
       FROM area_repositories
       WHERE area_id = ? AND id = ?`,
      input.areaId,
      input.repositoryId
    );
    if (!row) {
      return null;
    }
    if (row.detailJson) {
      return parseStorageJson<AreaRepositoryDetail>("areaRepositories.detail", row.detailJson);
    }
    return areaRepositoryDetailFromSummary(
      parseStorageJson<AreaRepositorySummary>("areaRepositories.summary", row.summaryJson)
    );
  });
}

export function clearAreaRepositories(db: StorageDatabase, areaId: string): void {
  db.operation("areaRepositories.clear", () => {
    db.run("DELETE FROM area_repositories WHERE area_id = ?", areaId);
  });
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
    connectionJson: summary.connection
      ? stringifyStorageJson("areaRepositories.connection", summary.connection)
      : null,
    capabilitiesJson: stringifyStorageJson("areaRepositories.capabilities", summary.capabilities),
    healthJson: stringifyStorageJson("areaRepositories.health", summary.health),
    summaryJson: stringifyStorageJson("areaRepositories.summary", summary),
    detailJson: detail ? stringifyStorageJson("areaRepositories.detail", detail) : null,
    scannedAt: summary.scannedAt,
    updatedAt: summary.updatedAt
  };
}
