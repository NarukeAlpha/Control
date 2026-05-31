import type { AreaSummary, CreateLocalAreaInput, CreateSshAreaInput, UpdateAreaInput } from "@shared/areas";

import { getAreaGateway, setAreaGateway } from "./areaGatewayStore";
import type { DatabaseConnection, StorageDatabase } from "./database";
import {
  createDefaultGitHubArea,
  defaultGitHubAreaId,
  localAreaId,
  localAreaLabel,
  sshAreaId,
  sshAreaLabel,
  sshAreaSubtitle,
  updateAreaSummary,
  updatedGatewayRecord
} from "./mappers";
import { parseStorageJsonOr, stringifyStorageJson } from "./serializers";

interface AreaRow {
  id: string;
  kind: AreaSummary["kind"];
  label: string;
  subtitle: string | null;
  rootPath: string | null;
  accountLogin: string | null;
  selected: number;
  gatewayJson: string | null;
  healthJson: string;
  repositoryCount: number;
  createdAt: string;
  updatedAt: string;
}

export function ensureDefaultGitHubArea(db: StorageDatabase, accountLogin?: string | null): AreaSummary {
  return db.operation("areas.ensureDefaultGitHub", () => {
    const existing = readArea(db, defaultGitHubAreaId);
    const selected = existing?.selected ?? !db.get("SELECT 1 FROM areas WHERE selected = 1 LIMIT 1");
    const area = createDefaultGitHubArea(accountLogin ?? existing?.accountLogin ?? null, selected);
    writeArea(db, {
      ...area,
      label: existing?.label ?? area.label,
      createdAt: existing?.createdAt ?? area.createdAt
    });
    return readArea(db, defaultGitHubAreaId) ?? area;
  });
}

export function createLocalArea(db: StorageDatabase, input: CreateLocalAreaInput): AreaSummary {
  return db.operation("areas.createLocal", () => {
    const now = new Date().toISOString();
    const rootPath = input.rootPath;
    const area: AreaSummary = {
      id: localAreaId(rootPath),
      kind: "local",
      label: localAreaLabel(rootPath, input.label),
      subtitle: rootPath,
      rootPath,
      accountLogin: null,
      gateway: null,
      health: { status: "scanning", message: "Scanning local repositories.", checkedAt: now },
      repositoryCount: 0,
      selected: false,
      createdAt: now,
      updatedAt: now
    };
    writeArea(db, area);
    return readArea(db, area.id) ?? area;
  });
}

export function createSshArea(db: StorageDatabase, input: CreateSshAreaInput): AreaSummary {
  return db.operation("areas.createSsh", () => {
    const now = new Date().toISOString();
    const host = input.host.trim();
    const rootPath = input.rootPath.trim();
    const username = input.username?.trim() || null;
    const port = input.port ?? null;
    const area: AreaSummary = {
      id: sshAreaId({ host, rootPath, username, port }),
      kind: "ssh",
      label: sshAreaLabel(host, input.label),
      subtitle: sshAreaSubtitle({ host, rootPath, username, port }),
      rootPath,
      accountLogin: null,
      gateway: null,
      health: { status: "scanning", message: "Starting remote gateway.", checkedAt: now },
      repositoryCount: 0,
      selected: false,
      createdAt: now,
      updatedAt: now
    };
    writeArea(db, area);
    return readArea(db, area.id) ?? area;
  });
}

export function updateArea(db: StorageDatabase, input: UpdateAreaInput): AreaSummary {
  return db.operation("areas.update", () => {
    const existing = readArea(db, input.areaId);
    if (!existing) {
      throw new Error("Area does not exist.");
    }
    const updated = updateAreaSummary(existing, input, getAreaGateway(db, existing.id));
    writeArea(db, updated);
    const gateway = getAreaGateway(db, updated.id);
    if (gateway && (updated.kind === "local" || updated.kind === "ssh")) {
      const nextGateway = updatedGatewayRecord(gateway, updated, input);
      if (nextGateway) {
        setAreaGateway(db, nextGateway);
      }
    }
    return readArea(db, updated.id) ?? updated;
  });
}

export function upsertArea(db: StorageDatabase, area: AreaSummary): void {
  db.operation("areas.write", () => {
    writeArea(db, area);
  });
}

export function listAreas(db: StorageDatabase): AreaSummary[] {
  return db.operation("areas.list", () => {
    const rows = db.all<AreaRow>(
      `SELECT areas.id,
              areas.kind,
              areas.label,
              areas.subtitle,
              areas.root_path AS rootPath,
              areas.account_login AS accountLogin,
              areas.selected,
              area_gateways.summary_json AS gatewayJson,
              areas.health_json AS healthJson,
              COUNT(area_repositories.id) AS repositoryCount,
              areas.created_at AS createdAt,
              areas.updated_at AS updatedAt
       FROM areas
       LEFT JOIN area_repositories ON area_repositories.area_id = areas.id
       LEFT JOIN area_gateways ON area_gateways.area_id = areas.id
       GROUP BY areas.id
       ORDER BY areas.selected DESC, areas.kind ASC, areas.label ASC`
    );
    return rows.map(mapAreaRow);
  });
}

export function getArea(db: StorageDatabase, areaId: string): AreaSummary | null {
  return db.operation("areas.read", () => readArea(db, areaId));
}

export function selectArea(db: StorageDatabase, areaId: string): void {
  db.transaction("areas.select", (tx) => {
    if (!readArea(tx, areaId)) {
      throw new Error("Area does not exist.");
    }
    tx.run("UPDATE areas SET selected = 0 WHERE selected = 1");
    tx.run("UPDATE areas SET selected = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", areaId);
  });
}

export function removeArea(db: StorageDatabase, areaId: string): void {
  db.operation("areas.remove", () => {
    db.run("DELETE FROM areas WHERE id = ? AND kind != 'github'", areaId);
  });
}

function writeArea(db: DatabaseConnection, area: AreaSummary): void {
  if (area.selected) {
    db.run("UPDATE areas SET selected = 0 WHERE selected = 1 AND id != ?", area.id);
  }
  db.run(
    `INSERT INTO areas (
      id,
      kind,
      label,
      subtitle,
      root_path,
      account_login,
      selected,
      health_json,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @kind,
      @label,
      @subtitle,
      @rootPath,
      @accountLogin,
      @selected,
      @healthJson,
      COALESCE(@createdAt, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
      COALESCE(@updatedAt, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      label = excluded.label,
      subtitle = excluded.subtitle,
      root_path = excluded.root_path,
      account_login = excluded.account_login,
      selected = excluded.selected,
      health_json = excluded.health_json,
      updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    areaRowInput(area)
  );
}

function readArea(db: DatabaseConnection, areaId: string): AreaSummary | null {
  const row = db.get<AreaRow>(
    `SELECT areas.id,
            areas.kind,
            areas.label,
            areas.subtitle,
            areas.root_path AS rootPath,
            areas.account_login AS accountLogin,
            areas.selected,
            area_gateways.summary_json AS gatewayJson,
            areas.health_json AS healthJson,
            COUNT(area_repositories.id) AS repositoryCount,
            areas.created_at AS createdAt,
            areas.updated_at AS updatedAt
     FROM areas
     LEFT JOIN area_repositories ON area_repositories.area_id = areas.id
     LEFT JOIN area_gateways ON area_gateways.area_id = areas.id
     WHERE areas.id = ?
     GROUP BY areas.id`,
    areaId
  );
  return row ? mapAreaRow(row) : null;
}

function areaRowInput(area: AreaSummary): Record<string, unknown> {
  return {
    id: area.id,
    kind: area.kind,
    label: area.label,
    subtitle: area.subtitle,
    rootPath: area.rootPath,
    accountLogin: area.accountLogin,
    selected: area.selected ? 1 : 0,
    healthJson: stringifyStorageJson("areas.health", area.health),
    createdAt: area.createdAt,
    updatedAt: area.updatedAt
  };
}

function mapAreaRow(row: AreaRow): AreaSummary {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    subtitle: row.subtitle,
    rootPath: row.rootPath,
    accountLogin: row.accountLogin,
    gateway: row.gatewayJson ? parseStorageJsonOr<AreaSummary["gateway"]>(row.gatewayJson, null) : null,
    health: parseStorageJsonOr<AreaSummary["health"]>(row.healthJson, {
      status: "error",
      message: "Area health could not be read.",
      checkedAt: null
    }),
    repositoryCount: row.repositoryCount,
    selected: Boolean(row.selected),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
