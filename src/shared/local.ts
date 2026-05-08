export interface RepositoryPinInput {
  nameWithOwner: string;
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
  provider: "github";
  itemKey: string;
  title: string;
  subtitle: string | null;
  repositoryNameWithOwner: string | null;
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
  itemKey: string;
  title: string;
  subtitle?: string | null;
  repositoryNameWithOwner?: string | null;
  url?: string | null;
  metadata?: LocalRecentMetadata;
}
