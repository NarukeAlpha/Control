export type ControlDataClass = "secret" | "private" | "durable" | "cache";

export type ControlSensitiveCategory =
  | "durable-preference"
  | "local-path"
  | "remote-url"
  | "repository-identity"
  | "account-metadata"
  | "recent-navigation"
  | "gateway-metadata"
  | "github-cache"
  | "area-cache"
  | "secret";

export interface ControlExportScope {
  settings: boolean;
  areas: boolean;
  pins: boolean;
  recents: boolean;
  githubMetadataCache: boolean;
  areaCache: boolean;
  snapshots: boolean;
  includeLocalPaths: boolean;
  includePrivateRepositoryMetadata: boolean;
}

export interface ControlExportInput {
  scope: ControlExportScope;
  destinationPath?: string | null;
}

export interface ControlExportManifest {
  schemaVersion: 1;
  createdAt: string;
  appVersion: string | null;
  includedScopes: ControlExportScope;
  redactionSummary: ControlRedactionSummary[];
  cacheIncluded: {
    githubMetadata: boolean;
    areaCache: boolean;
    snapshots: boolean;
  };
}

export interface ControlRedactionSummary {
  dataClass: ControlDataClass;
  category: ControlSensitiveCategory;
  field: string;
  action: "excluded" | "redacted" | "included-by-scope" | "blocked";
  reason: string;
}

export interface ControlExportPreviewItem {
  id: string;
  label: string;
  dataClass: ControlDataClass;
  included: boolean;
  estimatedCount: number;
  countIsExact: boolean;
  sensitiveCategories: ControlSensitiveCategory[];
  redactedFields: string[];
}

export interface ControlExportPreview {
  manifest: ControlExportManifest;
  items: ControlExportPreviewItem[];
  totals: {
    includedItems: number;
    excludedItems: number;
    privateItems: number;
    cacheItems: number;
  };
  blockers: string[];
}

export interface ControlExportResult {
  manifest: ControlExportManifest;
  filePath: string | null;
  bytesWritten: number | null;
}

export interface ControlImportInput {
  filePath: string;
}

export interface ControlImportPreview {
  schemaVersion: number | null;
  items: Array<{
    id: string;
    label: string;
    action: "insert" | "update" | "skip" | "redact" | "remap" | "blocked";
    dataClass: ControlDataClass;
    estimatedCount: number;
    message: string | null;
  }>;
  blockers: string[];
}

export interface ControlImportApplyInput extends ControlImportInput {
  confirmed: boolean;
}

export interface ControlImportResult {
  applied: boolean;
  importedItems: number;
  skippedItems: number;
  remappedItems: number;
  emittedEvents: string[];
}

export const defaultControlExportScope: ControlExportScope = {
  settings: true,
  areas: false,
  pins: false,
  recents: false,
  githubMetadataCache: false,
  areaCache: false,
  snapshots: false,
  includeLocalPaths: false,
  includePrivateRepositoryMetadata: false
};
