import type { LocalRecentItem, LocalRecentListInput } from "@shared/local";

import type { StorageDatabase } from "./database";
import {
  defaultGitHubAreaId,
  defaultGitHubRepositoryId,
  mapRecentItemRow,
  normalizeRecentLimit,
  parseRecentPayload,
  stringValue,
  type RecentItemRow
} from "./mappers";
import { stringifyStorageJson } from "./serializers";

export function addRecentItem(
  db: StorageDatabase,
  kind: string,
  provider: string,
  itemKey: string,
  payload: unknown
): void {
  db.operation("recentItems.write", () => {
    db.run(
      `INSERT INTO recent_items (kind, provider, item_key, payload, updated_at)
       VALUES (?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(kind, provider, item_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      kind,
      provider,
      itemKey,
      stringifyStorageJson("recentItems.payload", payload)
    );
  });
}

export function listRecentItems(db: StorageDatabase, input: LocalRecentListInput = {}): LocalRecentItem[] {
  return db.operation("recentItems.list", () => {
    const limit = normalizeRecentLimit(input.limit);
    const rows = input.kind
      ? db.all<RecentItemRow>(
          `SELECT kind, provider, item_key AS itemKey, payload, updated_at AS updatedAt
           FROM recent_items
           WHERE provider IN ('github', 'local') AND kind = ?
           ORDER BY updated_at DESC, rowid DESC
           LIMIT ?`,
          input.kind,
          limit
        )
      : db.all<RecentItemRow>(
          `SELECT kind, provider, item_key AS itemKey, payload, updated_at AS updatedAt
           FROM recent_items
           WHERE provider IN ('github', 'local')
           ORDER BY updated_at DESC, rowid DESC
           LIMIT ?`,
          limit
        );

    return rows.map((row) => mapRecentItemRow(row)).filter((item): item is LocalRecentItem => Boolean(item));
  });
}

export function migrateLegacyGitHubRecents(db: StorageDatabase): void {
  db.operation("recentItems.migrateLegacyGitHub", () => {
    const rows = db.all<{ kind: string; provider: string; itemKey: string; payload: string }>(
      `SELECT kind,
              provider,
              item_key AS itemKey,
              payload
       FROM recent_items
       WHERE provider = 'github'`
    );

    db.transaction("recentItems.migrateLegacyGitHub.update", (tx) => {
      for (const row of rows) {
        const payload = parseRecentPayload(row.payload);
        const repositoryNameWithOwner =
          stringValue(payload.repositoryNameWithOwner) ??
          stringValue(payload.nameWithOwner) ??
          (row.kind === "repository" ? row.itemKey : null);
        if (!repositoryNameWithOwner) {
          continue;
        }
        tx.run(
          `UPDATE recent_items
           SET payload = ?
           WHERE kind = ? AND provider = ? AND item_key = ?`,
          stringifyStorageJson("recentItems.payload", {
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
  });
}
