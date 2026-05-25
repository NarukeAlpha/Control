import { readFile } from "node:fs/promises";

import {
  defaultControlExportScope,
  type ControlExportPreview,
  type ControlExportPreviewItem,
  type ControlExportScope,
  type ControlImportInput,
  type ControlImportPreview,
  type ControlRedactionSummary
} from "@shared/sync";
import type { LocalStore } from "./localStoreAdapter";

export function normalizeControlExportScope(input: Partial<ControlExportScope>): ControlExportScope {
  return {
    ...defaultControlExportScope,
    ...input
  };
}

export function createControlExportPreview(
  store: LocalStore,
  scope: ControlExportScope
): ControlExportPreview {
  const areas = store.listAreas();
  const areaRepositories = areas.flatMap((area) =>
    store.listAreaRepositories({ areaId: area.id, limit: 500 })
  );
  const areaWorkspaces = areas.flatMap((area) => store.listAreaWorkspaces({ areaId: area.id }));
  const pins = store.listPinnedRepositories();
  const areaPins = store.listAreaRepositoryPins();
  const recents = store.listRecentItems({ limit: 50 });
  const githubRepositories = store.listGitHubRepositoriesWithMetadata(500).items;
  const blockers = areas
    .filter((area) => area.gateway?.failureCode === "gateway-credentials-migration-pending")
    .map((area) => `Gateway credentials are pending keychain migration for ${area.label}.`);

  const items: ControlExportPreviewItem[] = [
    previewItem({
      id: "settings",
      label: "Settings",
      dataClass: "durable",
      included: scope.settings,
      estimatedCount: 1,
      sensitiveCategories: [],
      redactedFields: []
    }),
    previewItem({
      id: "areas",
      label: "Areas",
      dataClass: "private",
      included: scope.areas,
      estimatedCount: areas.length,
      sensitiveCategories: ["local-path", "gateway-metadata"],
      redactedFields: scope.includeLocalPaths ? [] : ["areas.root_path", "area_gateways.rootPath"]
    }),
    previewItem({
      id: "pins",
      label: "Repository Pins",
      dataClass: "private",
      included: scope.pins,
      estimatedCount: pins.length + areaPins.length,
      sensitiveCategories: ["repository-identity"],
      redactedFields: []
    }),
    previewItem({
      id: "recents",
      label: "Recent Items",
      dataClass: "private",
      included: scope.recents,
      estimatedCount: recents.length,
      countIsExact: recents.length < 50,
      sensitiveCategories: ["recent-navigation", "local-path", "remote-url"],
      redactedFields: [
        "recent_items.payload.metadata.path",
        "recent_items.payload.metadata.url",
        "recent_items.payload.metadata.ref"
      ]
    }),
    previewItem({
      id: "github-cache",
      label: "GitHub Metadata Cache",
      dataClass: "cache",
      included: scope.githubMetadataCache,
      estimatedCount: githubRepositories.length,
      countIsExact: githubRepositories.length < 500,
      sensitiveCategories: ["account-metadata", "github-cache", "repository-identity"],
      redactedFields: ["github_repositories.readme_markdown"]
    }),
    previewItem({
      id: "area-cache",
      label: "Area Cache",
      dataClass: "cache",
      included: scope.areaCache,
      estimatedCount: areaRepositories.length + areaWorkspaces.length,
      countIsExact: areaRepositories.length < areas.length * 500,
      sensitiveCategories: ["area-cache", "local-path", "remote-url"],
      redactedFields: [
        "area_repositories.path",
        "area_workspaces.root_path",
        "area_repositories.connection_json.remoteUrl"
      ]
    }),
    previewItem({
      id: "snapshots",
      label: "Area Snapshots",
      dataClass: "cache",
      included: scope.snapshots,
      estimatedCount: 0,
      countIsExact: false,
      sensitiveCategories: ["area-cache", "local-path"],
      redactedFields: ["area_repo_snapshots.payload", "area_workspace_snapshots.payload"]
    })
  ];

  return {
    manifest: {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      appVersion: null,
      includedScopes: scope,
      redactionSummary: controlExportRedactionSummary,
      cacheIncluded: {
        githubMetadata: scope.githubMetadataCache,
        areaCache: scope.areaCache,
        snapshots: scope.snapshots
      }
    },
    items,
    totals: {
      includedItems: items
        .filter((item) => item.included)
        .reduce((total, item) => total + item.estimatedCount, 0),
      excludedItems: items
        .filter((item) => !item.included)
        .reduce((total, item) => total + item.estimatedCount, 0),
      privateItems: items
        .filter((item) => item.dataClass === "private")
        .reduce((total, item) => total + item.estimatedCount, 0),
      cacheItems: items
        .filter((item) => item.dataClass === "cache")
        .reduce((total, item) => total + item.estimatedCount, 0)
    },
    blockers
  };
}

export async function createControlImportPreview(input: ControlImportInput): Promise<ControlImportPreview> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(input.filePath, "utf8"));
  } catch (error) {
    return {
      schemaVersion: null,
      items: [],
      blockers: [error instanceof Error ? error.message : "Import preview file could not be read."]
    };
  }

  const schemaVersion = importSchemaVersion(parsed);
  if (schemaVersion !== 1) {
    return {
      schemaVersion,
      items: [],
      blockers: ["Control import preview requires export schema version 1."]
    };
  }

  return {
    schemaVersion,
    items: [
      {
        id: "control-export-manifest",
        label: "Control export manifest",
        action: "skip",
        dataClass: "durable",
        estimatedCount: 1,
        message: "Import apply is not implemented in pass 1."
      }
    ],
    blockers: ["Import apply is not implemented in pass 1."]
  };
}

export const controlExportRedactionSummary: ControlRedactionSummary[] = [
  redaction("github.oauthToken", "secret", "secret", "blocked", "GitHub OAuth tokens stay in credentials."),
  redaction("gateway.apiToken", "secret", "secret", "blocked", "Gateway API tokens stay in credentials."),
  redaction("gateway.adminToken", "secret", "secret", "blocked", "Gateway admin tokens stay in credentials."),
  redaction("ssh.privateKey", "secret", "secret", "blocked", "SSH private keys are never app data."),
  redaction(
    "settings.*",
    "durable",
    "durable-preference",
    "included-by-scope",
    "Settings are durable preferences."
  ),
  redaction(
    "accounts.payload",
    "cache",
    "account-metadata",
    "excluded",
    "Account payloads are private cache."
  ),
  redaction("cache_entries.*", "cache", "github-cache", "excluded", "Provider cache is reconstructable."),
  redaction(
    "pinned_repositories.*",
    "private",
    "repository-identity",
    "included-by-scope",
    "Pins identify repositories."
  ),
  redaction(
    "area_repository_pins.*",
    "private",
    "repository-identity",
    "included-by-scope",
    "Area pins identify repositories."
  ),
  redaction("areas.root_path", "private", "local-path", "redacted", "Local paths require explicit scope."),
  redaction(
    "area_gateways.rootPath",
    "private",
    "local-path",
    "redacted",
    "Gateway roots require explicit scope."
  ),
  redaction(
    "area_gateways.apiUrl",
    "private",
    "gateway-metadata",
    "included-by-scope",
    "Gateway URLs are private metadata."
  ),
  redaction(
    "area_gateways.adminUrl",
    "private",
    "gateway-metadata",
    "included-by-scope",
    "Gateway admin URLs are private metadata."
  ),
  redaction(
    "area_repositories.path",
    "cache",
    "local-path",
    "redacted",
    "Repository paths are reconstructable."
  ),
  redaction(
    "area_workspaces.root_path",
    "cache",
    "local-path",
    "redacted",
    "Workspace paths are reconstructable."
  ),
  redaction(
    "area_repositories.connection_json.remoteUrl",
    "private",
    "remote-url",
    "redacted",
    "Remote URLs may embed private hosts or credentials."
  ),
  redaction(
    "recent_items.payload.metadata.path",
    "private",
    "local-path",
    "redacted",
    "Recent paths are private."
  ),
  redaction(
    "recent_items.payload.metadata.url",
    "private",
    "remote-url",
    "redacted",
    "Recent URLs are private."
  ),
  redaction(
    "recent_items.payload.metadata.ref",
    "private",
    "recent-navigation",
    "redacted",
    "Recent refs are private."
  ),
  redaction(
    "github_repositories.readme_markdown",
    "cache",
    "github-cache",
    "excluded",
    "README cache is source content."
  ),
  redaction(
    "github_repositories.summary_json",
    "cache",
    "github-cache",
    "excluded",
    "Repository cache is reconstructable."
  ),
  redaction(
    "github_repositories.detail_json",
    "cache",
    "github-cache",
    "excluded",
    "Repository detail cache is reconstructable."
  ),
  redaction(
    "github_repositories.viewer_state_json",
    "cache",
    "account-metadata",
    "excluded",
    "Viewer state is account cache."
  ),
  redaction(
    "github_repositories.permissions_json",
    "cache",
    "account-metadata",
    "excluded",
    "Permissions are account cache."
  ),
  redaction(
    "area_repo_snapshots.payload",
    "cache",
    "area-cache",
    "excluded",
    "Area snapshots are reconstructable."
  ),
  redaction(
    "area_workspace_snapshots.payload",
    "cache",
    "area-cache",
    "excluded",
    "Workspace snapshots are reconstructable."
  )
];

function previewItem(input: {
  id: string;
  label: string;
  dataClass: ControlExportPreviewItem["dataClass"];
  included: boolean;
  estimatedCount: number;
  countIsExact?: boolean;
  sensitiveCategories: ControlExportPreviewItem["sensitiveCategories"];
  redactedFields: string[];
}): ControlExportPreviewItem {
  return {
    ...input,
    countIsExact: input.countIsExact ?? true
  };
}

function redaction(
  field: string,
  dataClass: ControlRedactionSummary["dataClass"],
  category: ControlRedactionSummary["category"],
  action: ControlRedactionSummary["action"],
  reason: string
): ControlRedactionSummary {
  return { field, dataClass, category, action, reason };
}

function importSchemaVersion(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const manifest = record.manifest;
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    const version = (manifest as Record<string, unknown>).schemaVersion;
    return typeof version === "number" ? version : null;
  }
  return typeof record.schemaVersion === "number" ? record.schemaVersion : null;
}
