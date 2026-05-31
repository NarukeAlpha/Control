import type { StorageDatabase } from "./database";
import { parseStorageJson, stringifyStorageJson } from "./serializers";

export function setAreaRepoSnapshot(
  db: StorageDatabase,
  areaId: string,
  repositoryId: string,
  snapshotKey: string,
  payload: unknown
): void {
  db.operation("areaSnapshots.writeRepository", () => {
    db.run(
      `INSERT INTO area_repo_snapshots (area_id, repository_id, snapshot_key, payload, updated_at)
       VALUES (?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(area_id, repository_id, snapshot_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      areaId,
      repositoryId,
      snapshotKey,
      stringifyStorageJson("areaSnapshots.repositoryPayload", payload)
    );
  });
}

export function getAreaRepoSnapshot<T>(
  db: StorageDatabase,
  areaId: string,
  repositoryId: string,
  snapshotKey: string
): T | null {
  return db.operation("areaSnapshots.readRepository", () => {
    const row = db.get<{ payload: string }>(
      `SELECT payload
       FROM area_repo_snapshots
       WHERE area_id = ? AND repository_id = ? AND snapshot_key = ?`,
      areaId,
      repositoryId,
      snapshotKey
    );
    return row ? parseStorageJson<T>("areaSnapshots.repositoryPayload", row.payload) : null;
  });
}

export function setAreaWorkspaceSnapshot(
  db: StorageDatabase,
  areaId: string,
  repositoryId: string,
  workspaceId: string,
  snapshotKey: string,
  payload: unknown
): void {
  db.operation("areaSnapshots.writeWorkspace", () => {
    db.run(
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
         updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      areaId,
      repositoryId,
      workspaceId,
      snapshotKey,
      stringifyStorageJson("areaSnapshots.workspacePayload", payload)
    );
  });
}

export function getAreaWorkspaceSnapshot<T>(
  db: StorageDatabase,
  areaId: string,
  repositoryId: string,
  workspaceId: string,
  snapshotKey: string
): T | null {
  return db.operation("areaSnapshots.readWorkspace", () => {
    const row = db.get<{ payload: string }>(
      `SELECT payload
       FROM area_workspace_snapshots
       WHERE area_id = ? AND repository_id = ? AND workspace_id = ? AND snapshot_key = ?`,
      areaId,
      repositoryId,
      workspaceId,
      snapshotKey
    );
    return row ? parseStorageJson<T>("areaSnapshots.workspacePayload", row.payload) : null;
  });
}

export function areaRepoSnapshotKey(areaId: string, repositoryId: string, snapshotKey: string): string {
  return `${areaId}:${repositoryId}:${snapshotKey}`;
}

export function areaWorkspaceSnapshotKey(
  areaId: string,
  repositoryId: string,
  workspaceId: string,
  snapshotKey: string
): string {
  return `${areaId}:${repositoryId}:${workspaceId}:${snapshotKey}`;
}
