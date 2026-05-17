export interface RepositoryPinInput {
  nameWithOwner?: string;
  areaId?: string;
  repositoryId?: string;
  workspaceId?: string | null;
}

export interface RepositoryPinRecord {
  nameWithOwner: string | null;
  areaId?: string | null;
  repositoryId?: string | null;
  workspaceId?: string | null;
  createdAt: string | null;
}

export type LocalRecentKind =
  | "repository"
  | "commit"
  | "issue"
  | "pullRequest"
  | "discussion"
  | "organization"
  | "team"
  | "contributor"
  | "project"
  | "release"
  | "releaseAsset"
  | "workflowRun"
  | "workflowArtifact"
  | "securityItem"
  | "wikiPage"
  | "file";

export type LocalRecentSecurityItemKind =
  | "dependabot"
  | "codeScanning"
  | "secretScanning"
  | "ruleset"
  | "advisory";

export type LocalRecentMetadata = Record<string, string | number | boolean | null>;

export interface LocalRecentItem {
  kind: LocalRecentKind;
  provider: "github" | "local";
  itemKey: string;
  title: string;
  subtitle: string | null;
  repositoryNameWithOwner: string | null;
  areaId?: string | null;
  repositoryId?: string | null;
  workspaceId?: string | null;
  url: string | null;
  metadata: LocalRecentMetadata;
  updatedAt: string;
}

export interface LocalRecentListInput {
  kind?: LocalRecentKind;
  limit?: number;
}

export interface LocalRecentRecordInput {
  kind: LocalRecentKind;
  provider?: "github" | "local";
  itemKey: string;
  title: string;
  subtitle?: string | null;
  repositoryNameWithOwner?: string | null;
  areaId?: string | null;
  repositoryId?: string | null;
  workspaceId?: string | null;
  url?: string | null;
  metadata?: LocalRecentMetadata;
}
