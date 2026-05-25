import { areaGatewaySummary } from "./mappers";
import type { StorageDatabase } from "./database";
import { parseStorageJson, stringifyStorageJson } from "./serializers";
import type { AreaGatewayFailureCode } from "@shared/areas";

export interface AreaGatewayRecord {
  areaId: string;
  rootPath: string;
  transport: "local" | "ssh";
  host: string | null;
  username: string | null;
  port: number | null;
  apiUrl: string | null;
  adminUrl: string | null;
  serviceName: string | null;
  version: string | null;
  status: "not-installed" | "starting" | "ready" | "stopped" | "error";
  pid: number | null;
  processId: number | null;
  failureCode: AreaGatewayFailureCode | null;
  message: string | null;
  installedAt: string | null;
  lastStartedAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string;
}

interface LegacyGatewayRecord extends AreaGatewayRecord {
  apiToken?: string | null;
  adminToken?: string | null;
}

export function getAreaGateway(db: StorageDatabase, areaId: string): AreaGatewayRecord | null {
  return db.operation("areaGateways.read", () => {
    const row = db.get<{ recordJson: string }>(
      "SELECT record_json AS recordJson FROM area_gateways WHERE area_id = ?",
      areaId
    );
    return row
      ? stripLegacyTokens(
          normalizeGatewayRecord(parseStorageJson<LegacyGatewayRecord>("areaGateways.record", row.recordJson))
        )
      : null;
  });
}

export function setAreaGateway(db: StorageDatabase, record: AreaGatewayRecord): void {
  db.operation("areaGateways.write", () => {
    db.run(
      `INSERT INTO area_gateways (area_id, summary_json, record_json, updated_at)
       VALUES (@areaId, @summaryJson, @recordJson, CURRENT_TIMESTAMP)
       ON CONFLICT(area_id) DO UPDATE SET
         summary_json = excluded.summary_json,
         record_json = excluded.record_json,
         updated_at = CURRENT_TIMESTAMP`,
      {
        areaId: record.areaId,
        summaryJson: stringifyStorageJson("areaGateways.summary", areaGatewaySummary(record)),
        recordJson: stringifyStorageJson("areaGateways.record", record)
      }
    );
  });
}

export function clearAreaGateway(db: StorageDatabase, areaId: string): void {
  db.operation("areaGateways.clear", () => {
    db.run("DELETE FROM area_gateways WHERE area_id = ?", areaId);
  });
}

export async function migrateLegacyAreaGatewayTokens(
  db: StorageDatabase,
  migrateCredentials: (areaId: string, credentials: { apiToken: string; adminToken: string }) => Promise<void>
): Promise<void> {
  const rows = db.operation("areaGateways.legacyTokens.list", () =>
    db.all<{ areaId: string; recordJson: string }>(
      "SELECT area_id AS areaId, record_json AS recordJson FROM area_gateways"
    )
  );

  for (const row of rows) {
    const record = parseStorageJson<LegacyGatewayRecord>("areaGateways.legacyRecord", row.recordJson);
    if (!hasLegacyTokenFields(record)) {
      continue;
    }

    const apiToken = cleanLegacyToken(record.apiToken);
    const adminToken = cleanLegacyToken(record.adminToken);
    if (!apiToken || !adminToken) {
      markLegacyTokenMigrationPending(db, row.areaId, record);
      continue;
    }

    try {
      await migrateCredentials(row.areaId, {
        apiToken,
        adminToken
      });
      const migrated = stripLegacyTokens({
        ...record,
        failureCode: null,
        message:
          record.failureCode === "gateway-credentials-migration-pending" ? null : (record.message ?? null),
        updatedAt: new Date().toISOString()
      });
      setAreaGateway(db, migrated);
    } catch {
      markLegacyTokenMigrationPending(db, row.areaId, record);
    }
  }
}

function markLegacyTokenMigrationPending(
  db: StorageDatabase,
  areaId: string,
  record: LegacyGatewayRecord
): void {
  const pending = stripLegacyTokens({
    ...record,
    status: "error" as const,
    failureCode: "gateway-credentials-migration-pending" as const,
    message: "Gateway credentials could not be migrated to the system keychain.",
    updatedAt: new Date().toISOString()
  });
  db.operation("areaGateways.legacyTokens.pending", () => {
    db.run(
      `UPDATE area_gateways
       SET summary_json = @summaryJson,
           record_json = @recordJson,
           updated_at = CURRENT_TIMESTAMP
       WHERE area_id = @areaId`,
      {
        areaId,
        summaryJson: stringifyStorageJson("areaGateways.summary", areaGatewaySummary(pending)),
        recordJson: stringifyStorageJson("areaGateways.record", pending)
      }
    );
  });
}

function stripLegacyTokens(record: LegacyGatewayRecord): AreaGatewayRecord {
  const { apiToken: _apiToken, adminToken: _adminToken, ...rest } = record;
  return rest;
}

function hasLegacyTokenFields(record: LegacyGatewayRecord): boolean {
  return (
    Object.prototype.hasOwnProperty.call(record, "apiToken") ||
    Object.prototype.hasOwnProperty.call(record, "adminToken")
  );
}

function cleanLegacyToken(token: string | null | undefined): string | null {
  const trimmed = token?.trim();
  return trimmed ? trimmed : null;
}

function normalizeGatewayRecord(record: LegacyGatewayRecord): LegacyGatewayRecord {
  return {
    ...record,
    failureCode: record.failureCode ?? null
  };
}
