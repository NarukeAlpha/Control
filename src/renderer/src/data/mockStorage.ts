export type MockStorageWriteResult =
  | { ok: true }
  | {
      ok: false;
      error: unknown;
    };

export type MockStorageValueGuard<T> = (value: unknown) => value is T;

function isMockArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isMockRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readMockStorageValue<T>({
  key,
  fallback,
  isValue
}: {
  key: string;
  fallback(): T;
  isValue: MockStorageValueGuard<T>;
}): T {
  const storage = localStorageOrNull();
  if (!storage) {
    return fallback();
  }

  let serialized: string | null;
  try {
    serialized = storage.getItem(key);
  } catch {
    return fallback();
  }

  if (serialized === null) {
    return fallback();
  }

  try {
    const parsed: unknown = JSON.parse(serialized);
    return isValue(parsed) ? parsed : fallback();
  } catch {
    return fallback();
  }
}

export function readMockArray<T>(key: string, fallback: () => T[] = () => []): T[] {
  return readMockStorageValue({
    key,
    fallback,
    isValue: isMockArray<T>
  });
}

export function writeMockStorageValue(key: string, value: unknown): MockStorageWriteResult {
  const storage = localStorageOrNull();
  if (!storage) {
    return { ok: false, error: new Error("localStorage is unavailable") };
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function writeMockArray<T>(key: string, items: T[]): MockStorageWriteResult {
  return writeMockStorageValue(key, items);
}

export function clearMockStorage(): MockStorageWriteResult {
  const storage = localStorageOrNull();
  if (!storage) {
    return { ok: false, error: new Error("localStorage is unavailable") };
  }

  try {
    storage.clear();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
