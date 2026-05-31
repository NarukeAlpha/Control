import type { ControlSettings } from "@shared/github";
import type { StorageDatabase } from "./database";
import { parseStorageJson, stringifyStorageJson } from "./serializers";

export function readSettings(
  db: StorageDatabase,
  normalize: (settings: Record<string, unknown>) => ControlSettings
): ControlSettings {
  return db.operation("settings.read", () => {
    const rows = db.all<{
      key: string;
      value: string;
    }>("SELECT key, value FROM settings");
    const stored = rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.key] = parseStorageJson(`settings.${row.key}`, row.value);
      return acc;
    }, {});
    return normalize(stored);
  });
}

export function writeSettings(db: StorageDatabase, settings: ControlSettings): ControlSettings {
  return db.transaction("settings.write", (tx) => {
    for (const [key, value] of Object.entries(settings)) {
      tx.run(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (@key, @value, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`,
        { key, value: stringifyStorageJson(`settings.${key}`, value) }
      );
    }
    return settings;
  });
}
