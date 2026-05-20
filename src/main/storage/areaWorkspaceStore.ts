import type { AreaWorkspaceDetail, AreaWorkspaceSummary, ListAreaWorkspacesInput } from "@shared/areas";

import type { StorageDatabase } from "./database";
import { areaWorkspaceDetailFromSummary } from "./mappers";
import { parseStorageJson, stringifyStorageJson } from "./serializers";

interface AreaWorkspaceRow {
  summaryJson: string;
  detailJson: string | null;
}

export function upsertAreaWorkspace(
  db: StorageDatabase,
  summary: AreaWorkspaceSummary,
  detail: AreaWorkspaceDetail | null = null
): void {
  db.operation("areaWorkspaces.write", () => {
    db.run(
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
        updated_at = excluded.updated_at`,
      areaWorkspaceRowInput(summary, detail)
    );
  });
}

export function listAreaWorkspaces(
  db: StorageDatabase,
  input: ListAreaWorkspacesInput
): AreaWorkspaceSummary[] {
  return db.operation("areaWorkspaces.list", () => {
    const rows = input.repositoryId
      ? db.all<AreaWorkspaceRow>(
          `SELECT summary_json AS summaryJson,
                  detail_json AS detailJson
           FROM area_workspaces
           WHERE area_id = ? AND repository_id = ?
           ORDER BY name ASC`,
          input.areaId,
          input.repositoryId
        )
      : db.all<AreaWorkspaceRow>(
          `SELECT summary_json AS summaryJson,
                  detail_json AS detailJson
           FROM area_workspaces
           WHERE area_id = ?
           ORDER BY name ASC`,
          input.areaId
        );
    return rows.map((row) =>
      parseStorageJson<AreaWorkspaceSummary>("areaWorkspaces.summary", row.summaryJson)
    );
  });
}

export function getAreaWorkspace(
  db: StorageDatabase,
  areaId: string,
  workspaceId: string
): AreaWorkspaceDetail | null {
  return db.operation("areaWorkspaces.read", () => {
    const row = db.get<AreaWorkspaceRow>(
      `SELECT summary_json AS summaryJson,
              detail_json AS detailJson
       FROM area_workspaces
       WHERE area_id = ? AND id = ?`,
      areaId,
      workspaceId
    );
    if (!row) {
      return null;
    }
    if (row.detailJson) {
      return parseStorageJson<AreaWorkspaceDetail>("areaWorkspaces.detail", row.detailJson);
    }
    return areaWorkspaceDetailFromSummary(
      parseStorageJson<AreaWorkspaceSummary>("areaWorkspaces.summary", row.summaryJson)
    );
  });
}

export function clearAreaWorkspaces(
  db: StorageDatabase,
  areaId: string,
  repositoryId: string | null = null
): void {
  db.operation("areaWorkspaces.clear", () => {
    if (repositoryId) {
      db.run("DELETE FROM area_workspaces WHERE area_id = ? AND repository_id = ?", areaId, repositoryId);
      return;
    }
    db.run("DELETE FROM area_workspaces WHERE area_id = ?", areaId);
  });
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
    summaryJson: stringifyStorageJson("areaWorkspaces.summary", summary),
    detailJson: detail ? stringifyStorageJson("areaWorkspaces.detail", detail) : null,
    scannedAt: summary.scannedAt,
    updatedAt: summary.updatedAt
  };
}
