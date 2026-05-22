import { areaGatewaySummary } from "./mappers";
import type { StorageDatabase } from "./database";
import { parseStorageJson, stringifyStorageJson } from "./serializers";

export interface AreaGatewayRecord {
  areaId: string;
  rootPath: string;
  transport: "local" | "ssh";
  host: string | null;
  username: string | null;
  port: number | null;
  apiUrl: string | null;
  adminUrl: string | null;
  apiToken: string | null;
  adminToken: string | null;
  serviceName: string | null;
  version: string | null;
  status: "not-installed" | "starting" | "ready" | "stopped" | "error";
  pid: number | null;
  processId: number | null;
  message: string | null;
  installedAt: string | null;
  lastStartedAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string;
}

export function getAreaGateway(db: StorageDatabase, areaId: string): AreaGatewayRecord | null {
  return db.operation("areaGateways.read", () => {
    const row = db.get<{ recordJson: string }>(
      "SELECT record_json AS recordJson FROM area_gateways WHERE area_id = ?",
      areaId
    );
    return row ? parseStorageJson<AreaGatewayRecord>("areaGateways.record", row.recordJson) : null;
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
