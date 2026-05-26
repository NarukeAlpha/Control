import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AreaRepositorySummary, AreaSummary, AreaWorkspaceSummary } from "@shared/areas";
import type { ControlSettings, RepositorySummary } from "@shared/github";
import type { LocalRecentItem, LocalRecentKind, RepositoryPinRecord } from "@shared/local";
import type {
  ControlExportInput,
  ControlExportManifest,
  ControlExportResult,
  ControlExportScope,
  ControlImportApplyInput,
  ControlImportInput,
  ControlImportPreview,
  ControlImportResult
} from "@shared/sync";
import type { LocalStore } from "./localStoreAdapter";
import { createControlExportPreview } from "./exportPreview";

interface ControlExportArchiveV1 {
  manifest: ControlExportManifest;
  data: {
    settings?: ControlSettings;
    areas?: AreaSummary[];
    pins?: {
      repositories: string[];
      areaRepositories: RepositoryPinRecord[];
    };
    recents?: LocalRecentItem[];
    githubMetadataCache?: RepositorySummary[];
    areaCache?: {
      repositories: AreaRepositorySummary[];
      workspaces: AreaWorkspaceSummary[];
    };
    snapshots?: {
      areaRepoSnapshots: Record<string, unknown>[];
      areaWorkspaceSnapshots: Record<string, unknown>[];
    };
  };
}

type ControlExportArchive = ControlExportArchiveV1;

const supportedSchemaVersion = 1;
const recentImportKinds = new Set<LocalRecentKind>([
  "repository",
  "commit",
  "issue",
  "pullRequest",
  "discussion",
  "organization",
  "team",
  "contributor",
  "project",
  "release",
  "releaseAsset",
  "workflowRun",
  "workflowArtifact",
  "securityItem",
  "wikiPage",
  "file"
]);

export function createControlExportArchive(
  store: LocalStore,
  scope: ControlExportScope
): ControlExportArchiveV1 {
  const preview = createControlExportPreview(store, scope);
  const archive: ControlExportArchiveV1 = {
    manifest: preview.manifest,
    data: {}
  };

  if (scope.settings) {
    archive.data.settings = store.getSettings();
  }
  if (scope.areas) {
    archive.data.areas = store.listAreas().map((area) => sanitizeArea(area, scope));
  }
  if (scope.pins) {
    archive.data.pins = {
      repositories: store.listPinnedRepositories(),
      areaRepositories: store.listAreaRepositoryPins()
    };
  }
  if (scope.recents) {
    archive.data.recents = store.listRecentItems({ limit: 500 }).map(sanitizeRecentItem);
  }
  if (scope.githubMetadataCache) {
    archive.data.githubMetadataCache = store
      .listGitHubRepositoriesWithMetadata(1000)
      .items.filter((repository) => scope.includePrivateRepositoryMetadata || !repository.isPrivate)
      .map((repository) => ({ ...repository, readmeMarkdown: null }));
  }
  if (scope.areaCache) {
    const areas = store.listAreas();
    archive.data.areaCache = {
      repositories: areas.flatMap((area) =>
        store
          .listAreaRepositories({ areaId: area.id, limit: 1000 })
          .map((repository) => sanitizeAreaRepository(repository, scope))
      ),
      workspaces: areas.flatMap((area) =>
        store
          .listAreaWorkspaces({ areaId: area.id })
          .map((workspace) => sanitizeAreaWorkspace(workspace, scope))
      )
    };
  }
  if (scope.snapshots) {
    archive.data.snapshots = {
      areaRepoSnapshots: [],
      areaWorkspaceSnapshots: []
    };
  }

  return archive;
}

export async function writeControlExportArchive(
  store: LocalStore,
  input: ControlExportInput
): Promise<ControlExportResult> {
  const filePath = input.destinationPath?.trim() ?? null;
  const archive = createControlExportArchive(store, input.scope);
  if (!filePath) {
    return {
      manifest: archive.manifest,
      filePath: null,
      bytesWritten: null
    };
  }

  const encoded = JSON.stringify(archive);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(filePath), { recursive: true });
  try {
    await writeFile(tempPath, encoded, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }

  return {
    manifest: archive.manifest,
    filePath,
    bytesWritten: Buffer.byteLength(encoded, "utf8")
  };
}

export async function createControlImportPreview(input: ControlImportInput): Promise<ControlImportPreview> {
  const filePath = input.filePath?.trim() ?? null;
  if (!filePath) {
    return emptyImportPreview(null, ["Control import preview requires a file path."]);
  }

  try {
    return previewArchive(await readControlExportArchive(filePath), filePath);
  } catch (error) {
    return emptyImportPreview(filePath, [
      error instanceof Error ? error.message : "Import preview file could not be read."
    ]);
  }
}

export async function applyControlImport(
  store: LocalStore,
  input: ControlImportApplyInput
): Promise<ControlImportResult> {
  if (!input.confirmed) {
    return emptyImportResult({ blockedItems: 1 });
  }

  const filePath = input.filePath?.trim() ?? null;
  if (!filePath) {
    return emptyImportResult();
  }

  let archive: ControlExportArchive;
  try {
    archive = await readControlExportArchive(filePath);
  } catch {
    return emptyImportResult({ blockedItems: 1 });
  }
  const preview = previewArchive(archive, filePath);
  if (preview.blockers.length > 0) {
    return emptyImportResult({
      skippedItems: preview.items.reduce((total, item) => total + item.estimatedCount, 0),
      blockedItems: preview.blockers.length
    });
  }

  let importedItems = 0;
  let insertedItems = 0;
  let updatedItems = 0;
  let skippedItems = 0;
  let remappedItems = 0;
  const blockedItems = 0;
  const emittedEvents = new Set<string>();

  if (isRecord(archive.data.settings)) {
    store.updateSettings(archive.data.settings as Partial<ControlSettings>);
    importedItems += 1;
    updatedItems += 1;
    emittedEvents.add("settings-updated");
  }

  if (archive.data.areas) {
    for (const area of archive.data.areas) {
      if (!isImportableArea(area)) {
        skippedItems += 1;
        remappedItems += 1;
        continue;
      }
      const existed = Boolean(store.getArea(area.id));
      store.upsertArea({ ...area, gateway: null });
      importedItems += 1;
      if (existed) {
        updatedItems += 1;
      } else {
        insertedItems += 1;
      }
      emittedEvents.add("areas-updated");
    }
  }

  if (archive.data.pins) {
    const pinnedRepositories = new Set(store.listPinnedRepositories());
    for (const nameWithOwner of archive.data.pins.repositories) {
      if (!isRepositoryNameWithOwner(nameWithOwner)) {
        skippedItems += 1;
        continue;
      }
      const existed = pinnedRepositories.has(nameWithOwner);
      store.pinRepository(nameWithOwner);
      pinnedRepositories.add(nameWithOwner);
      importedItems += 1;
      if (existed) {
        updatedItems += 1;
      } else {
        insertedItems += 1;
      }
      emittedEvents.add("repository-pins-updated");
    }
    const areaPinKeys = new Set(store.listAreaRepositoryPins().map(areaPinImportKey));
    for (const pin of archive.data.pins.areaRepositories) {
      if (!isImportableAreaPin(pin)) {
        skippedItems += 1;
        continue;
      }
      const key = areaPinImportKey(pin);
      const existed = areaPinKeys.has(key);
      store.pinAreaRepository(pin);
      areaPinKeys.add(key);
      importedItems += 1;
      if (existed) {
        updatedItems += 1;
      } else {
        insertedItems += 1;
      }
      emittedEvents.add("repository-pins-updated");
    }
  }

  if (archive.data.recents) {
    const recentKeys = new Set(store.listRecentItems({ limit: 500 }).map(recentImportKey));
    for (const item of archive.data.recents) {
      if (!isImportableRecentItem(item)) {
        skippedItems += 1;
        continue;
      }
      const key = recentImportKey(item);
      const existed = recentKeys.has(key);
      store.addRecentItem(item.kind, item.provider, item.itemKey, item);
      recentKeys.add(key);
      importedItems += 1;
      if (existed) {
        updatedItems += 1;
      } else {
        insertedItems += 1;
      }
      emittedEvents.add("recents-updated");
    }
  }

  if (archive.data.areaCache) {
    skippedItems += archive.data.areaCache.repositories.length + archive.data.areaCache.workspaces.length;
  }
  if (archive.data.githubMetadataCache) {
    skippedItems += archive.data.githubMetadataCache.length;
  }
  if (archive.data.snapshots) {
    skippedItems +=
      archive.data.snapshots.areaRepoSnapshots.length + archive.data.snapshots.areaWorkspaceSnapshots.length;
  }

  return {
    applied: importedItems > 0,
    importedItems,
    insertedItems,
    updatedItems,
    skippedItems,
    remappedItems,
    blockedItems,
    emittedEvents: [...emittedEvents].sort()
  };
}

async function readControlExportArchive(filePath: string): Promise<ControlExportArchive> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.manifest) || !isRecord(parsed.data)) {
    throw new Error("Control import requires a valid Control export archive.");
  }
  const schemaVersion = parsed.manifest.schemaVersion;
  if (schemaVersion !== supportedSchemaVersion) {
    throw new Error("Control import requires export schema version 1.");
  }

  return {
    manifest: parsed.manifest as unknown as ControlExportManifest,
    data: normalizeArchiveData(parsed.data)
  };
}

function previewArchive(archive: ControlExportArchive, filePath: string): ControlImportPreview {
  const items: ControlImportPreview["items"] = [];
  if (archive.data.settings) {
    items.push({
      id: "settings",
      label: "Settings",
      action: "update",
      dataClass: "durable",
      estimatedCount: 1,
      message: "Settings will be merged with current preferences."
    });
  }
  if (archive.data.areas) {
    const blockedAreas = countRedactedAreaImports(archive.data.areas);
    items.push({
      id: "areas",
      label: "Areas",
      action: blockedAreas > 0 ? "remap" : "insert",
      dataClass: "private",
      estimatedCount: archive.data.areas.length,
      message:
        blockedAreas > 0
          ? `${blockedAreas} local or SSH areas have redacted roots and will be skipped.`
          : "Areas will be restored without gateway credentials."
    });
  }
  if (archive.data.pins) {
    items.push({
      id: "pins",
      label: "Repository pins",
      action: "insert",
      dataClass: "private",
      estimatedCount: archive.data.pins.repositories.length + archive.data.pins.areaRepositories.length,
      message: "Repository pin records will be upserted."
    });
  }
  if (archive.data.recents) {
    items.push({
      id: "recents",
      label: "Recent items",
      action: "insert",
      dataClass: "private",
      estimatedCount: archive.data.recents.length,
      message: "Recent navigation records will be restored with redacted metadata."
    });
  }
  if (archive.data.githubMetadataCache) {
    items.push({
      id: "github-cache",
      label: "GitHub metadata cache",
      action: "skip",
      dataClass: "cache",
      estimatedCount: archive.data.githubMetadataCache.length,
      message: "Cache import is skipped; live reads can rebuild this data."
    });
  }
  if (archive.data.areaCache) {
    items.push({
      id: "area-cache",
      label: "Area cache",
      action: "skip",
      dataClass: "cache",
      estimatedCount: archive.data.areaCache.repositories.length + archive.data.areaCache.workspaces.length,
      message: "Area read-model cache import is skipped in the durable import path."
    });
  }
  if (archive.data.snapshots) {
    items.push({
      id: "snapshots",
      label: "Area snapshots",
      action: "skip",
      dataClass: "cache",
      estimatedCount:
        archive.data.snapshots.areaRepoSnapshots.length +
        archive.data.snapshots.areaWorkspaceSnapshots.length,
      message: "Area snapshot import is skipped; snapshots are reconstructable cache."
    });
  }

  return {
    filePath,
    schemaVersion: archive.manifest.schemaVersion,
    items,
    blockers: []
  };
}

function emptyImportPreview(filePath: string | null, blockers: string[]): ControlImportPreview {
  return {
    filePath,
    schemaVersion: null,
    items: [],
    blockers
  };
}

function emptyImportResult(
  overrides: Partial<Pick<ControlImportResult, "skippedItems" | "blockedItems">> = {}
): ControlImportResult {
  return {
    applied: false,
    importedItems: 0,
    insertedItems: 0,
    updatedItems: 0,
    skippedItems: overrides.skippedItems ?? 0,
    remappedItems: 0,
    blockedItems: overrides.blockedItems ?? 0,
    emittedEvents: []
  };
}

function normalizeArchiveData(data: Record<string, unknown>): ControlExportArchive["data"] {
  if (data.settings !== undefined && !isRecord(data.settings)) {
    throw new Error("Control import settings section is malformed.");
  }
  if (data.areas !== undefined && !isArrayOf(data.areas, isAreaSummary)) {
    throw new Error("Control import areas section is malformed.");
  }
  if (data.pins !== undefined && !isRecord(data.pins)) {
    throw new Error("Control import pins section is malformed.");
  }
  if (isRecord(data.pins)) {
    if (
      data.pins.repositories !== undefined &&
      !isArrayOf(data.pins.repositories, isRepositoryNameWithOwner)
    ) {
      throw new Error("Control import repository pins section is malformed.");
    }
    if (
      data.pins.areaRepositories !== undefined &&
      !isArrayOf(data.pins.areaRepositories, isImportableAreaPin)
    ) {
      throw new Error("Control import Area pins section is malformed.");
    }
  }
  if (data.recents !== undefined && !isArrayOf(data.recents, isImportableRecentItem)) {
    throw new Error("Control import recents section is malformed.");
  }
  if (data.githubMetadataCache !== undefined && !isArrayOf(data.githubMetadataCache, isRecord)) {
    throw new Error("Control import GitHub cache section is malformed.");
  }
  if (data.areaCache !== undefined && !isRecord(data.areaCache)) {
    throw new Error("Control import Area cache section is malformed.");
  }
  if (isRecord(data.areaCache)) {
    if (data.areaCache.repositories !== undefined && !isArrayOf(data.areaCache.repositories, isRecord)) {
      throw new Error("Control import Area repository cache section is malformed.");
    }
    if (data.areaCache.workspaces !== undefined && !isArrayOf(data.areaCache.workspaces, isRecord)) {
      throw new Error("Control import Area workspace cache section is malformed.");
    }
  }
  if (data.snapshots !== undefined && !isRecord(data.snapshots)) {
    throw new Error("Control import snapshots section is malformed.");
  }
  if (isRecord(data.snapshots)) {
    if (
      data.snapshots.areaRepoSnapshots !== undefined &&
      !isArrayOf(data.snapshots.areaRepoSnapshots, isRecord)
    ) {
      throw new Error("Control import Area repository snapshots section is malformed.");
    }
    if (
      data.snapshots.areaWorkspaceSnapshots !== undefined &&
      !isArrayOf(data.snapshots.areaWorkspaceSnapshots, isRecord)
    ) {
      throw new Error("Control import Area workspace snapshots section is malformed.");
    }
  }

  return {
    settings: isRecord(data.settings) ? (data.settings as unknown as ControlSettings) : undefined,
    areas: Array.isArray(data.areas) ? data.areas : undefined,
    pins: isRecord(data.pins)
      ? {
          repositories: Array.isArray(data.pins.repositories) ? data.pins.repositories : [],
          areaRepositories: Array.isArray(data.pins.areaRepositories) ? data.pins.areaRepositories : []
        }
      : undefined,
    recents: Array.isArray(data.recents) ? data.recents : undefined,
    githubMetadataCache: Array.isArray(data.githubMetadataCache)
      ? data.githubMetadataCache.map((repository) => repository as unknown as RepositorySummary)
      : undefined,
    areaCache: isRecord(data.areaCache)
      ? {
          repositories: Array.isArray(data.areaCache.repositories)
            ? data.areaCache.repositories.map((repository) => repository as unknown as AreaRepositorySummary)
            : [],
          workspaces: Array.isArray(data.areaCache.workspaces)
            ? data.areaCache.workspaces.map((workspace) => workspace as unknown as AreaWorkspaceSummary)
            : []
        }
      : undefined,
    snapshots: isRecord(data.snapshots)
      ? {
          areaRepoSnapshots: Array.isArray(data.snapshots.areaRepoSnapshots)
            ? data.snapshots.areaRepoSnapshots
            : [],
          areaWorkspaceSnapshots: Array.isArray(data.snapshots.areaWorkspaceSnapshots)
            ? data.snapshots.areaWorkspaceSnapshots
            : []
        }
      : undefined
  };
}

function sanitizeArea(area: AreaSummary, scope: ControlExportScope): AreaSummary {
  if (scope.includeLocalPaths) {
    return { ...area, gateway: area.gateway ?? null };
  }

  return {
    ...area,
    subtitle: area.kind === "github" ? area.subtitle : null,
    rootPath: null,
    gateway: area.gateway
      ? {
          ...area.gateway,
          apiUrl: null,
          serviceName: null
        }
      : null
  };
}

function sanitizeAreaRepository(
  repository: AreaRepositorySummary,
  scope: ControlExportScope
): AreaRepositorySummary {
  return {
    ...repository,
    path: scope.includeLocalPaths ? repository.path : null,
    connection: repository.connection
      ? {
          ...repository.connection,
          remoteUrl: "",
          url: ""
        }
      : null
  };
}

function sanitizeAreaWorkspace(
  workspace: AreaWorkspaceSummary,
  scope: ControlExportScope
): AreaWorkspaceSummary {
  return {
    ...workspace,
    rootPath: scope.includeLocalPaths ? workspace.rootPath : ""
  };
}

function sanitizeRecentItem(item: LocalRecentItem): LocalRecentItem {
  const { path: _path, url: _url, ref: _ref, ...metadata } = item.metadata;
  return {
    ...item,
    url: null,
    metadata
  };
}

function countRedactedAreaImports(areas: AreaSummary[]): number {
  return areas.filter((area) => area.kind !== "github" && !area.rootPath).length;
}

function isImportableArea(area: AreaSummary): boolean {
  return area.kind === "github" || Boolean(area.rootPath);
}

function isAreaSummary(value: unknown): value is AreaSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "github" || value.kind === "local" || value.kind === "ssh") &&
    typeof value.label === "string" &&
    typeof value.selected === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isImportableAreaPin(value: unknown): value is RepositoryPinRecord {
  return (
    isRecord(value) &&
    (value.nameWithOwner === null ||
      value.nameWithOwner === undefined ||
      isRepositoryNameWithOwner(value.nameWithOwner)) &&
    typeof value.areaId === "string" &&
    typeof value.repositoryId === "string"
  );
}

function isImportableRecentItem(value: unknown): value is LocalRecentItem {
  return (
    isRecord(value) &&
    recentImportKinds.has(value.kind as LocalRecentKind) &&
    (value.provider === "github" || value.provider === "local") &&
    typeof value.itemKey === "string" &&
    typeof value.title === "string" &&
    isRecord(value.metadata)
  );
}

function isRepositoryNameWithOwner(value: unknown): value is string {
  return typeof value === "string" && /^[^/\s]+\/[^/\s]+$/.test(value);
}

function isArrayOf<TItem>(value: unknown, predicate: (item: unknown) => item is TItem): value is TItem[] {
  return Array.isArray(value) && value.every(predicate);
}

function areaPinImportKey(pin: RepositoryPinRecord): string {
  return `${pin.areaId}:${pin.repositoryId}:${pin.workspaceId ?? ""}:${pin.nameWithOwner ?? ""}`;
}

function recentImportKey(item: LocalRecentItem): string {
  return `${item.kind}:${item.provider}:${item.itemKey}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
