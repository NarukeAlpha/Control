import type { StorageDatabase } from "./database";
import { parseStorageJson, stringifyStorageJson } from "./serializers";

export function saveAccountRecord(
  db: StorageDatabase,
  provider: string,
  login: string,
  payload: unknown
): void {
  db.operation("accounts.save", () => {
    db.run(
      `INSERT INTO accounts (provider, login, payload, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(provider, login) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
      provider,
      login,
      stringifyStorageJson("accounts.payload", payload)
    );
  });
}

export function readLastAccount<T>(db: StorageDatabase, provider: string): T | null {
  return db.operation("accounts.readLast", () => {
    const row = db.get<{ payload: string }>(
      "SELECT payload FROM accounts WHERE provider = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1",
      provider
    );

    return row ? parseStorageJson<T>("accounts.payload", row.payload) : null;
  });
}
