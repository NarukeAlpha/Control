import { SerializationError } from "./errors";

export function stringifyStorageJson(operation: string, value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (cause) {
    throw new SerializationError(operation, cause);
  }
}

export function parseStorageJson<T>(operation: string, value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (cause) {
    throw new SerializationError(operation, cause);
  }
}

export function parseStorageJsonOr<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseCacheJson<T>(value: string): { ok: true; value: T } | { ok: false; cause: unknown } {
  try {
    return { ok: true, value: JSON.parse(value) as T };
  } catch (cause) {
    return { ok: false, cause: new SerializationError("cache.payload", cause) };
  }
}
