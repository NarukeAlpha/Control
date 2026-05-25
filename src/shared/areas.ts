export type AreaKind = "github" | "local" | "ssh";

export type AreaHealthStatus = "ready" | "scanning" | "offline" | "needs-auth" | "error";

export interface AreaHealth {
  status: AreaHealthStatus;
  message: string | null;
  checkedAt: string | null;
}

export interface AreaSummary {
  id: string;
  kind: AreaKind;
  label: string;
  subtitle: string | null;
  rootPath: string | null;
  accountLogin: string | null;
  gateway?: AreaGatewaySummary | null;
  health: AreaHealth;
  repositoryCount: number;
  selected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocalAreaInput {
  rootPath: string;
  label?: string | null;
}

export interface CreateSshAreaInput {
  host: string;
  rootPath: string;
  label?: string | null;
  username?: string | null;
  port?: number | null;
}

export interface UpdateAreaInput {
  areaId: string;
  label?: string | null;
  rootPath?: string | null;
  host?: string | null;
  username?: string | null;
  port?: number | null;
}

export type AreaGatewayStatus = "not-installed" | "starting" | "ready" | "stopped" | "error";

export type AreaGatewayFailureCode =
  | "credential-store-unavailable"
  | "credential-missing"
  | "credential-rejected"
  | "runtime-not-found"
  | "runtime-integrity-failed"
  | "runtime-spawn-failed"
  | "manifest-timeout"
  | "manifest-invalid"
  | "ssh-unavailable"
  | "ssh-deploy-failed"
  | "ssh-command-failed"
  | "ssh-tunnel-failed"
  | "gateway-unauthorized"
  | "gateway-protocol-error"
  | "gateway-version-mismatch"
  | "admin-stop-failed"
  | "gateway-binary-missing"
  | "gateway-credentials-unavailable"
  | "gateway-credentials-migration-pending"
  | "gateway-manifest-timeout"
  | "gateway-manifest-invalid"
  | "gateway-admin-stop-failed"
  | "gateway-unreachable";

export type AreaGatewayFailurePhase =
  | "credential"
  | "resolve"
  | "install"
  | "start"
  | "verify"
  | "operate"
  | "stop"
  | "remove";

export interface AreaGatewayFailure {
  code: AreaGatewayFailureCode;
  areaId: string;
  phase: AreaGatewayFailurePhase;
  message: string;
  retryable: boolean;
}

export interface AreaGatewaySummary {
  status: AreaGatewayStatus;
  version: string | null;
  apiUrl: string | null;
  serviceName: string | null;
  lastStartedAt: string | null;
  lastSeenAt: string | null;
  failureCode: AreaGatewayFailureCode | null;
  message: string | null;
}

export interface AreaSearchInput {
  query: string;
  limit?: number;
}

export interface AreaSearchResult {
  areas: AreaSummary[];
  repositories: AreaRepositorySummary[];
  workspaces: AreaWorkspaceSummary[];
}

export type AreaRepositoryKind = "github" | "git" | "jj";

export interface GitHubRemoteConnection {
  owner: string;
  repo: string;
  nameWithOwner: string;
  remoteName: string;
  remoteUrl: string;
  url: string;
  matchedGitHubAreaId: string | null;
  status: "connected" | "unmatched" | "unavailable";
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface AreaRepositoryCapabilities {
  supportsBranches: boolean;
  supportsBookmarks: boolean;
  supportsWorkspaces: boolean;
  supportsOperationLog: boolean;
  supportsSparse: boolean;
  isGitBacked: boolean;
  isColocated: boolean;
  supportsGitHubEnrichment: boolean;
}

export interface AreaRepositorySummary {
  id: string;
  areaId: string;
  kind: AreaRepositoryKind;
  name: string;
  owner: string | null;
  displayName: string;
  path: string | null;
  defaultBranch: string | null;
  currentBranch: string | null;
  isDirty: boolean | null;
  isPrivate: boolean | null;
  description: string | null;
  connection: GitHubRemoteConnection | null;
  capabilities: AreaRepositoryCapabilities;
  health: AreaHealth;
  updatedAt: string | null;
  scannedAt: string | null;
}

export interface AreaRepositoryDetail extends AreaRepositorySummary {
  remotes: AreaRemoteSummary[];
  branches: AreaBranchSummary[];
  bookmarks: AreaBookmarkSummary[];
  tags: AreaTagSummary[];
  status: AreaStatusSummary;
  recentCommits: AreaCommitSummary[];
  recentOperations: AreaOperationSummary[];
  readme: AreaFileContent | null;
  workspaces: AreaWorkspaceSummary[];
}

export interface ListAreaRepositoriesInput {
  areaId: string;
  limit?: number;
}

export interface AreaRepositoryInput {
  areaId: string;
  repositoryId: string;
  workspaceId?: string | null;
}

export interface AreaContentsInput extends AreaRepositoryInput {
  path?: string | null;
}

export interface AreaFileContentInput extends AreaRepositoryInput {
  path: string;
}

export type AreaFileSearchAvailabilityStatus = "complete" | "partial" | "unavailable";

export interface AreaFileSearchInput extends AreaRepositoryInput {
  query: string;
  limit?: number;
}

export interface AreaFileSearchResult {
  areaId: string;
  repositoryId: string;
  workspaceId: string | null;
  query: string;
  matches: AreaFileEntry[];
  availability: {
    status: AreaFileSearchAvailabilityStatus;
    message: string | null;
    scannedEntries: number;
    truncated: boolean;
    timedOut: boolean;
  };
}

export interface AreaRefInput extends AreaRepositoryInput {
  limit?: number;
}

export interface AreaGitHubRepositoryInput extends AreaRepositoryInput {
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

export interface AreaGitHubIssuesInput extends AreaGitHubRepositoryInput {
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface AreaGitHubPullRequestsInput extends AreaGitHubRepositoryInput {
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface AreaGitHubListInput extends AreaGitHubRepositoryInput {
  limit?: number;
}

export interface AreaSyncStatusInput extends AreaRepositoryInput {
  forceRefresh?: boolean;
}

export type AreaSyncProvider = "git" | "jj";
export type AreaSyncRemoteStatus = "unknown" | "up-to-date" | "ahead" | "behind" | "diverged" | "untracked";

export interface AreaSyncRemoteSummary {
  name: string;
  fetchUrl: string | null;
  pushUrl: string | null;
  status: AreaSyncRemoteStatus;
  ahead: number | null;
  behind: number | null;
  lastFetchedAt: string | null;
  message: string | null;
}

export interface AreaSyncStatus {
  areaId: string;
  repositoryId: string;
  provider: AreaSyncProvider;
  remotes: AreaSyncRemoteSummary[];
  defaultRemote: string | null;
  currentBranch: string | null;
  currentBookmark: string | null;
  hasUncommittedChanges: boolean | null;
  capabilities: {
    canFetch: boolean;
    canPush: boolean;
    canPull: boolean;
    canCreateBranch: boolean;
    canCreateBookmark: boolean;
    canCommit: boolean;
    canUndo: boolean;
  };
  updatedAt: string | null;
}

export type AreaGatewayOperationKind =
  | "git.fetch"
  | "git.pull"
  | "git.push"
  | "git.commit"
  | "git.branch.create"
  | "git.branch.checkout"
  | "jj.git.fetch"
  | "jj.git.push"
  | "jj.new"
  | "jj.describe"
  | "jj.commit"
  | "jj.bookmark.create"
  | "jj.bookmark.move"
  | "jj.undo"
  | "jj.redo";

export type AreaGatewayOperationStatus = "prepared" | "running" | "succeeded" | "failed" | "cancelled";

export interface AreaGatewayOperationInput extends AreaRepositoryInput {
  kind: AreaGatewayOperationKind;
  arguments?: Record<string, string | number | boolean | null>;
}

export interface AreaGatewayOperationPreview {
  id: string;
  areaId: string;
  repositoryId: string;
  kind: AreaGatewayOperationKind;
  status: "prepared";
  title: string;
  summary: string;
  risks: string[];
  affectedRefs: string[];
  affectedPaths: string[];
  requiresGitHubToken: boolean;
  preparedAt: string;
  expiresAt: string;
}

export interface AreaGatewayRunOperationInput {
  areaId: string;
  operationId: string;
  confirmed: boolean;
}

export interface AreaGatewayOperationResult {
  id: string;
  areaId: string;
  repositoryId: string;
  kind: AreaGatewayOperationKind;
  status: AreaGatewayOperationStatus;
  message: string;
  stdout: string | null;
  stderr: string | null;
  recoveryOperationId: string | null;
  completedAt: string | null;
}

export interface AreaGatewayOperationEvent {
  areaId: string;
  repositoryId: string | null;
  operationId: string;
  status: AreaGatewayOperationStatus;
  message: string;
  occurredAt: string;
}

export interface StopAreaGatewayInput {
  areaId: string;
}

export interface AreaGatewayLifecycleInput {
  areaId: string;
}

export type AreaGatewayLifecycleResult =
  | {
      success: true;
      summary: AreaSummary | null;
    }
  | {
      success: false;
      failure: AreaGatewayFailure;
    };

export interface AreaWorkspaceSummary {
  id: string;
  areaId: string;
  repositoryId: string;
  name: string;
  rootPath: string;
  workingCopyChangeId: string | null;
  workingCopyCommitId: string | null;
  isStale: boolean;
  sparseSummary: string | null;
  health: AreaHealth;
  updatedAt: string | null;
  scannedAt: string | null;
}

export interface AreaWorkspaceDetail extends AreaWorkspaceSummary {
  fileTree: AreaFileEntry[];
  readme: AreaFileContent | null;
  status: AreaStatusSummary;
}

export interface ListAreaWorkspacesInput {
  areaId: string;
  repositoryId?: string | null;
}

export interface AreaBranchSummary {
  name: string;
  current: boolean;
  upstream: string | null;
  commit: string | null;
}

export interface AreaBookmarkSummary {
  name: string;
  remote: string | null;
  target: string | null;
  tracking: boolean;
}

export interface AreaTagSummary {
  name: string;
  target: string | null;
}

export interface AreaRemoteSummary {
  name: string;
  fetchUrl: string | null;
  pushUrl: string | null;
  github: GitHubRemoteConnection | null;
}

export interface AreaStatusSummary {
  clean: boolean | null;
  dirtyCount: number;
  untrackedCount: number;
  conflictedCount: number;
  ahead: number | null;
  behind: number | null;
  entries: AreaStatusEntry[];
}

export interface AreaStatusEntry {
  path: string;
  indexStatus: string | null;
  workingTreeStatus: string | null;
}

export interface AreaCommitSummary {
  id: string;
  shortId: string;
  changeId: string | null;
  summary: string;
  authorName: string | null;
  authorEmail: string | null;
  authoredAt: string | null;
}

export interface AreaOperationSummary {
  id: string;
  shortId: string;
  description: string;
  user: string | null;
  time: string | null;
}

export type AreaFileEntryType = "file" | "dir" | "symlink" | "other";

export interface AreaFileEntry {
  name: string;
  path: string;
  type: AreaFileEntryType;
  size: number | null;
  updatedAt: string | null;
}

export type AreaFileContentKind = "text" | "binary" | "unavailable";

export interface AreaFileContent {
  path: string;
  kind: AreaFileContentKind;
  text: string | null;
  encoding: "utf-8" | null;
  size: number | null;
  message: string | null;
}

export interface AreaActivityItem {
  id: string;
  kind: "commit" | "operation" | "status";
  title: string;
  subtitle: string | null;
  occurredAt: string | null;
}

export interface AreaUpdatedEvent {
  areaId: string | null;
}

export interface AreaRepositoryUpdatedEvent {
  areaId: string;
  repositoryId: string | null;
}

export interface AreaWorkspaceUpdatedEvent {
  areaId: string;
  repositoryId: string;
  workspaceId: string | null;
}
