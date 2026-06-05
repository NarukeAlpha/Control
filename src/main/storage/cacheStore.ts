import type { StorageDatabase } from "./database";
import { parseCacheJson, stringifyStorageJson } from "./serializers";
import type { CacheValidationState, CacheValidatorSnapshot, CacheValidatorValue } from "@shared/cache";

export interface CacheRecord {
  provider: string;
  cacheKey: string;
  payload: unknown;
  etag: string | null;
  lastModified?: string | null;
  validator?: CacheValidatorSnapshot | null;
  validatedAt?: string | null;
  validationState?: CacheValidationState | null;
  expiresAt: string | null;
}

export interface CacheEntry<T> {
  payload: T;
  etag: string | null;
  lastModified: string | null;
  validator: CacheValidatorSnapshot | null;
  validatedAt: string | null;
  validationState: CacheValidationState | null;
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
      | {
          payload: string;
          etag: string | null;
          lastModified: string | null;
          validatorJson: string | null;
          validatedAt: string | null;
          validationState: CacheValidationState | null;
          expiresAt: string | null;
          updatedAt: string | null;
        }
      | undefined
    >(
      `SELECT payload,
              etag,
              last_modified AS lastModified,
              validator_json AS validatorJson,
              validated_at AS validatedAt,
              validation_state AS validationState,
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
      lastModified: row.lastModified,
      validator: parseCacheValidator(row.validatorJson),
      validatedAt: row.validatedAt,
      validationState: isCacheValidationState(row.validationState) ? row.validationState : null,
      expiresAt: row.expiresAt,
      updatedAt: row.updatedAt,
      isExpired: isExpired(row.expiresAt)
    };
  });
}

export function writeCacheEntry(db: StorageDatabase, record: CacheRecord): void {
  db.operation("cache.write", () => {
    db.run(
      `INSERT INTO cache_entries (
         provider,
         cache_key,
         payload,
         etag,
         last_modified,
         validator_json,
         validated_at,
         validation_state,
         expires_at,
         updated_at
       )
       VALUES (
         @provider,
         @cacheKey,
         @payload,
         @etag,
         @lastModified,
         @validatorJson,
         @validatedAt,
         @validationState,
         @expiresAt,
         CURRENT_TIMESTAMP
       )
       ON CONFLICT(provider, cache_key) DO UPDATE SET
         payload = excluded.payload,
         etag = excluded.etag,
         last_modified = excluded.last_modified,
         validator_json = excluded.validator_json,
         validated_at = excluded.validated_at,
         validation_state = excluded.validation_state,
         expires_at = excluded.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      {
        provider: record.provider,
        cacheKey: record.cacheKey,
        payload: stringifyStorageJson("cache.payload", record.payload),
        etag: record.etag,
        lastModified: record.lastModified ?? null,
        validatorJson: record.validator ? stringifyStorageJson("cache.validator", record.validator) : null,
        validatedAt: record.validatedAt ?? null,
        validationState: record.validationState ?? null,
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

function parseCacheValidator(source: string | null): CacheValidatorSnapshot | null {
  if (!source) {
    return null;
  }

  const parsed = parseCacheJson<unknown>(source);
  if (!parsed.ok) {
    return null;
  }

  return isCacheValidatorSnapshot(parsed.value) ? parsed.value : null;
}

function isCacheValidatorSnapshot(value: unknown): value is CacheValidatorSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const raw = value as Partial<CacheValidatorSnapshot>;
  if (typeof raw.kind !== "string" || raw.kind.length === 0 || typeof raw.version !== "number") {
    return false;
  }

  if (!raw.values || typeof raw.values !== "object" || Array.isArray(raw.values)) {
    return false;
  }

  return Object.values(raw.values).every(isCacheValidatorValue);
}

function isCacheValidatorValue(value: unknown): value is CacheValidatorValue {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function isCacheValidationState(value: unknown): value is CacheValidationState {
  switch (value) {
    case "not_loaded":
    case "cached":
    case "validating":
    case "validated":
    case "stale":
    case "refreshing":
    case "error":
    case "rate_limited":
    case "permission_denied":
      return true;
    default:
      return false;
  }
}
