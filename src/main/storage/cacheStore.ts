import type { StorageDatabase } from "./database";
import { parseCacheJson, stringifyStorageJson } from "./serializers";

export interface CacheRecord {
  provider: string;
  cacheKey: string;
  payload: unknown;
  etag: string | null;
  expiresAt: string | null;
}

export interface CacheEntry<T> {
  payload: T;
  etag: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  isExpired: boolean;
}

export function readCacheEntry<T>(
  db: StorageDatabase,
  provider: string,
  cacheKey: string,
  isExpired: (expiresAt: string | null) => boolean
): CacheEntry<T> | null {
  return db.operation("cache.read", () => {
    const row = db.get<
      { payload: string; etag: string | null; expiresAt: string | null; updatedAt: string | null } | undefined
    >(
      `SELECT payload,
              etag,
              expires_at AS expiresAt,
              updated_at AS updatedAt
       FROM cache_entries
       WHERE provider = ? AND cache_key = ?`,
      provider,
      cacheKey
    );

    if (!row) {
      return null;
    }

    const parsed = parseCacheJson<T>(row.payload);
    if (!parsed.ok) {
      db.run("DELETE FROM cache_entries WHERE provider = ? AND cache_key = ?", provider, cacheKey);
      return null;
    }

    return {
      payload: parsed.value,
      etag: row.etag,
      expiresAt: row.expiresAt,
      updatedAt: row.updatedAt,
      isExpired: isExpired(row.expiresAt)
    };
  });
}

export function writeCacheEntry(db: StorageDatabase, record: CacheRecord): void {
  db.operation("cache.write", () => {
    db.run(
      `INSERT INTO cache_entries (provider, cache_key, payload, etag, expires_at, updated_at)
       VALUES (@provider, @cacheKey, @payload, @etag, @expiresAt, CURRENT_TIMESTAMP)
       ON CONFLICT(provider, cache_key) DO UPDATE SET
         payload = excluded.payload,
         etag = excluded.etag,
         expires_at = excluded.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      {
        provider: record.provider,
        cacheKey: record.cacheKey,
        payload: stringifyStorageJson("cache.payload", record.payload),
        etag: record.etag,
        expiresAt: record.expiresAt
      }
    );
  });
}

export function clearCacheEntriesByPrefix(
  db: StorageDatabase,
  provider: string,
  cacheKeyPrefix: string
): void {
  db.operation("cache.clearByPrefix", () => {
    db.run(
      "DELETE FROM cache_entries WHERE provider = ? AND cache_key LIKE ?",
      provider,
      `${cacheKeyPrefix}%`
    );
  });
}
