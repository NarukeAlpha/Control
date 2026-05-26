import type {
  AreaActivityItem,
  AreaContentsInput,
  AreaFileContent,
  AreaFileContentInput,
  AreaFileEntry,
  AreaFileSearchInput,
  AreaFileSearchResult,
  AreaGatewayLifecycleInput,
  AreaGatewayLifecycleResult,
  AreaGatewayOperationInput,
  AreaGatewayOperationPreview,
  AreaGatewayOperationResult,
  AreaGatewayRunOperationInput,
  AreaGitHubIssuesInput,
  AreaGitHubListInput,
  AreaGitHubPullRequestsInput,
  AreaGitHubRepositoryInput,
  AreaRefInput,
  AreaRepositoryDetail,
  AreaRepositoryInput,
  AreaRepositorySummary,
  AreaRepositoryUpdatedEvent,
  AreaSearchInput,
  AreaSearchResult,
  AreaSummary,
  AreaSyncStatus,
  AreaSyncStatusInput,
  AreaUpdatedEvent,
  AreaWorkspaceDetail,
  AreaWorkspaceSummary,
  AreaWorkspaceUpdatedEvent,
  CreateLocalAreaInput,
  CreateSshAreaInput,
  ListAreaRepositoriesInput,
  ListAreaWorkspacesInput,
  StopAreaGatewayInput,
  UpdateAreaInput
} from "./areas";
import type {
  AppState,
  ContributorListResult,
  ControlSettings,
  GitHubMutationInput,
  GitHubMutationResult,
  GitHubProvider,
  GitHubSignInSession,
  IssueListResult,
  PullRequestListResult,
  ReleaseListResult,
  RepoDetailInput,
  WorkflowRunListResult,
  JsonValue,
  RepositoryDetailResult
} from "./github";
import type {
  LocalRecentItem,
  LocalRecentListInput,
  LocalRecentRecordInput,
  RepositoryPinInput,
  RepositoryPinRecord
} from "./local";
import type {
  ControlExportPreview,
  ControlExportInput,
  ControlExportResult,
  ControlExportScope,
  ControlImportApplyInput,
  ControlImportInput,
  ControlImportPreview,
  ControlImportResult
} from "./sync";

type JsonSerializableObject<T extends object> = {
  [K in keyof T]: JsonSerializable<T[K]>;
};

type HasNonSerializableProperty<T extends object> = {
  [K in keyof T]-?: [T[K]] extends [never] ? K : never;
}[keyof T] extends never
  ? false
  : true;

export type JsonSerializable<T> = unknown extends T
  ? JsonValue
  : T extends JsonValue
    ? T
    : T extends Date | Map<unknown, unknown> | Set<unknown> | RegExp | Error | Promise<unknown>
      ? never
      : T extends (...args: never[]) => unknown
        ? never
        : T extends readonly (infer TItem)[]
          ? readonly JsonSerializable<TItem>[]
          : T extends object
            ? HasNonSerializableProperty<JsonSerializableObject<T>> extends true
              ? never
              : JsonSerializableObject<T>
            : never;

type JsonCompatible<T> = [JsonSerializable<T>] extends [never] ? never : T;

type JsonIpcMethod<TMethod> = TMethod extends (...args: infer TArgs) => Promise<infer TResult>
  ? (...args: { [K in keyof TArgs]: JsonCompatible<TArgs[K]> }) => Promise<JsonCompatible<TResult>>
  : never;

type JsonIpcApi<TApi> = {
  [K in keyof TApi]: JsonIpcMethod<TApi[K]>;
};

type GitHubOptionalInputAdapter<TMethod> = TMethod extends (input: infer TInput) => Promise<infer TResult>
  ? (input?: JsonCompatible<TInput>) => Promise<JsonCompatible<TResult>>
  : never;

type GitHubIpcOptionalInputKeys =
  | "listRepositoriesWithStatus"
  | "listAccountRepositoriesWithStatus"
  | "getAccountProfileWithStatus"
  | "listOrganizationsWithStatus"
  | "listAccountIssuesWithStatus"
  | "listAccountPullRequestsWithStatus"
  | "listNotificationsWithStatus";

type GitHubIpcProviderKeys =
  | "getViewer"
  | "listOrganizationTeamsWithStatus"
  | "listOrganizationRepositoriesWithStatus"
  | "listOrganizationTeamRepositoriesWithStatus"
  | "listOrganizationTeamMembersWithStatus"
  | "listOrganizationMembersWithStatus"
  | "listOrganizationProjectsWithStatus"
  | "markNotificationThreadRead"
  | "unsubscribeNotificationThread"
  | "listRepositoryForks"
  | "listBranchesWithStatus"
  | "listTagsWithStatus"
  | "listTreeWithStatus"
  | "getReadme"
  | "listContentsWithStatus"
  | "getFileContentWithStatus"
  | "getFileBlame"
  | "getRepositoryWiki"
  | "listCommitsWithStatus"
  | "listLabelsWithStatus"
  | "listAssignableUsersWithStatus"
  | "getRepositoryAccess"
  | "listMilestonesWithStatus"
  | "listIssuesWithStatus"
  | "getIssueDetailWithStatus"
  | "listPullRequestsWithStatus"
  | "getPullRequestDetailWithStatus"
  | "getPullRequestOverviewWithStatus"
  | "listPullRequestCommentsWithStatus"
  | "listPullRequestFilesWithStatus"
  | "listPullRequestCommitsWithStatus"
  | "listPullRequestReviewsWithStatus"
  | "listPullRequestChecksWithStatus"
  | "listPullRequestReviewThreadsWithStatus"
  | "listPullRequestTimelineWithStatus"
  | "listPullRequestLinkedIssuesWithStatus"
  | "listDiscussionsWithStatus"
  | "listDiscussionCategoriesWithStatus"
  | "getDiscussionDetail"
  | "listActionsWithStatus"
  | "listWorkflowsWithStatus"
  | "getWorkflowRunDetailWithStatus"
  | "getWorkflowJobLogs"
  | "listProjectsWithStatus"
  | "getBranchProtection"
  | "listDependabotAlerts"
  | "listCodeScanningAlerts"
  | "listSecretScanningAlerts"
  | "listRepositoryRulesets"
  | "listRepositorySecurityAdvisories"
  | "getRepositorySecurityPolicy"
  | "getRepositoryCommunityProfile"
  | "listReleasesWithStatus"
  | "getReleaseDetailWithStatus"
  | "listContributorsWithStatus"
  | "searchWithStatus";

type GitHubIpcProviderBase = JsonIpcApi<Pick<GitHubProvider, GitHubIpcProviderKeys>>;

type GitHubIpcOptionalInputOverrides = {
  [K in GitHubIpcOptionalInputKeys]: GitHubOptionalInputAdapter<GitHubProvider[K]>;
};

export type GitHubIpcApi = GitHubIpcProviderBase &
  GitHubIpcOptionalInputOverrides & {
    getRepositoryWithStatus(input: RepoDetailInput): Promise<JsonCompatible<RepositoryDetailResult>>;
    mutate(input: GitHubMutationInput): Promise<JsonCompatible<GitHubMutationResult>>;
  };

export interface ControlApi {
  getAppState(): Promise<AppState>;
  getSettings(): Promise<ControlSettings>;
  updateSettings(settings: Partial<ControlSettings>): Promise<ControlSettings>;
  signInWithGitHub(): Promise<GitHubSignInSession>;
  getGitHubSignIn(): Promise<GitHubSignInSession | null>;
  cancelGitHubSignIn(): Promise<void>;
  clearGitHubToken(): Promise<AppState>;
  openExternal(url: string): Promise<void>;
  listPinnedRepositories(): Promise<string[]>;
  pinRepository(input: RepositoryPinInput): Promise<string[]>;
  unpinRepository(input: RepositoryPinInput): Promise<string[]>;
  listRepositoryPins(): Promise<RepositoryPinRecord[]>;
  pinAreaRepository(input: RepositoryPinInput): Promise<RepositoryPinRecord[]>;
  unpinAreaRepository(input: RepositoryPinInput): Promise<RepositoryPinRecord[]>;
  listRecentItems(input?: LocalRecentListInput): Promise<LocalRecentItem[]>;
  recordRecentItem(input: LocalRecentRecordInput): Promise<LocalRecentItem[]>;
  previewDataExport(input: ControlExportScope): Promise<ControlExportPreview>;
  exportData(input: ControlExportInput): Promise<ControlExportResult>;
  previewDataImport(input: ControlImportInput): Promise<ControlImportPreview>;
  importData(input: ControlImportApplyInput): Promise<ControlImportResult>;
  onGitHubRepositoriesUpdated(callback: (event: GitHubRepositoriesUpdatedEvent) => void): () => void;
  onGitHubAuthUpdated(callback: (event: GitHubAuthUpdatedEvent) => void): () => void;
  areas: {
    listAreas(): Promise<AreaSummary[]>;
    getArea(areaId: string): Promise<AreaSummary | null>;
    selectArea(areaId: string): Promise<AreaSummary[]>;
    createLocalArea(input: CreateLocalAreaInput): Promise<AreaSummary>;
    createSshArea(input: CreateSshAreaInput): Promise<AreaSummary>;
    updateArea(input: UpdateAreaInput): Promise<AreaSummary>;
    removeArea(areaId: string): Promise<AreaSummary[]>;
    refreshArea(areaId: string): Promise<AreaSummary | null>;
    searchAreas(input: AreaSearchInput): Promise<AreaSearchResult>;
    listRepositories(input: ListAreaRepositoriesInput): Promise<AreaRepositorySummary[]>;
    getRepository(input: AreaRepositoryInput): Promise<AreaRepositoryDetail | null>;
    listContents(input: AreaContentsInput): Promise<AreaFileEntry[]>;
    getFileContent(input: AreaFileContentInput): Promise<AreaFileContent>;
    searchFilePaths(input: AreaFileSearchInput): Promise<AreaFileSearchResult>;
    listBranches(input: AreaRefInput): Promise<AreaRepositoryDetail["branches"]>;
    listRemotes(input: AreaRepositoryInput): Promise<AreaRepositoryDetail["remotes"]>;
    getStatus(input: AreaRepositoryInput): Promise<AreaRepositoryDetail["status"]>;
    listActivity(input: AreaRefInput): Promise<AreaActivityItem[]>;
    listWorkspaces(input: ListAreaWorkspacesInput): Promise<AreaWorkspaceSummary[]>;
    getWorkspace(input: { areaId: string; workspaceId: string }): Promise<AreaWorkspaceDetail | null>;
    getGitHubRepository(input: AreaGitHubRepositoryInput): Promise<RepositoryDetailResult>;
    listGitHubIssues(input: AreaGitHubIssuesInput): Promise<IssueListResult>;
    listGitHubPullRequests(input: AreaGitHubPullRequestsInput): Promise<PullRequestListResult>;
    listGitHubActions(input: AreaGitHubListInput): Promise<WorkflowRunListResult>;
    listGitHubReleases(input: AreaGitHubListInput): Promise<ReleaseListResult>;
    listGitHubContributors(input: AreaGitHubListInput): Promise<ContributorListResult>;
    getSyncStatus(input: AreaSyncStatusInput): Promise<AreaSyncStatus>;
    prepareGatewayOperation(input: AreaGatewayOperationInput): Promise<AreaGatewayOperationPreview>;
    runGatewayOperation(input: AreaGatewayRunOperationInput): Promise<AreaGatewayOperationResult>;
    stopGateway(input: StopAreaGatewayInput): Promise<AreaSummary | null>;
    repairGateway(input: AreaGatewayLifecycleInput): Promise<AreaGatewayLifecycleResult>;
    rotateGatewayCredentials(input: AreaGatewayLifecycleInput): Promise<AreaGatewayLifecycleResult>;
    restartGateway(input: AreaGatewayLifecycleInput): Promise<AreaGatewayLifecycleResult>;
    openLocalFolderPicker(): Promise<string | null>;
  };
  onAreasUpdated(callback: (event: AreaUpdatedEvent) => void): () => void;
  onAreaRepositoryUpdated(callback: (event: AreaRepositoryUpdatedEvent) => void): () => void;
  onAreaWorkspaceUpdated(callback: (event: AreaWorkspaceUpdatedEvent) => void): () => void;
  github: GitHubIpcApi;
}

export interface GitHubRepositoriesUpdatedEvent {
  nameWithOwner: string | null;
}

export interface GitHubAuthUpdatedEvent {
  appState: AppState;
}

export const ipcChannels = {
  appState: "control:app-state",
  getSettings: "control:get-settings",
  updateSettings: "control:update-settings",
  signInWithGitHub: "control:sign-in-with-github",
  getGitHubSignIn: "control:get-github-sign-in",
  cancelGitHubSignIn: "control:cancel-github-sign-in",
  clearGitHubToken: "control:clear-github-token",
  openExternal: "control:open-external",
  listPinnedRepositories: "control:list-pinned-repositories",
  pinRepository: "control:pin-repository",
  unpinRepository: "control:unpin-repository",
  listRepositoryPins: "control:list-repository-pins",
  pinAreaRepository: "control:pin-area-repository",
  unpinAreaRepository: "control:unpin-area-repository",
  listRecentItems: "control:list-recent-items",
  recordRecentItem: "control:record-recent-item",
  previewDataExport: "control:preview-data-export",
  exportData: "control:export-data",
  previewDataImport: "control:preview-data-import",
  importData: "control:import-data",
  githubRepositoriesUpdated: "github:repositories-updated",
  githubAuthUpdated: "github:auth-updated",
  areasList: "areas:list",
  areasGet: "areas:get",
  areasSelect: "areas:select",
  areasCreateLocal: "areas:create-local",
  areasCreateSsh: "areas:create-ssh",
  areasUpdate: "areas:update",
  areasRemove: "areas:remove",
  areasRefresh: "areas:refresh",
  areasSearch: "areas:search",
  areaRepositories: "areas:repositories",
  areaRepository: "areas:repository",
  areaContents: "areas:contents",
  areaFileContent: "areas:file-content",
  areaFilePathSearch: "areas:file-path-search",
  areaBranches: "areas:branches",
  areaRemotes: "areas:remotes",
  areaStatus: "areas:status",
  areaActivity: "areas:activity",
  areaWorkspaces: "areas:workspaces",
  areaWorkspace: "areas:workspace",
  areaGitHubRepository: "areas:github-repository",
  areaGitHubIssues: "areas:github-issues",
  areaGitHubPullRequests: "areas:github-pull-requests",
  areaGitHubActions: "areas:github-actions",
  areaGitHubReleases: "areas:github-releases",
  areaGitHubContributors: "areas:github-contributors",
  areaSyncStatus: "areas:sync-status",
  areaPrepareGatewayOperation: "areas:prepare-gateway-operation",
  areaRunGatewayOperation: "areas:run-gateway-operation",
  areaStopGateway: "areas:stop-gateway",
  areaRepairGateway: "areas:repair-gateway",
  areaRotateGatewayCredentials: "areas:rotate-gateway-credentials",
  areaRestartGateway: "areas:restart-gateway",
  areaOpenLocalFolderPicker: "areas:open-local-folder-picker",
  areasUpdated: "areas:updated",
  areaRepositoryUpdated: "areas:repository-updated",
  areaWorkspaceUpdated: "areas:workspace-updated",
  githubViewer: "github:viewer",
  githubAccountProfileWithStatus: "github:account-profile-with-status",
  githubRepositoriesWithStatus: "github:repositories-with-status",
  githubAccountRepositoriesWithStatus: "github:account-repositories-with-status",
  githubOrganizationsWithStatus: "github:organizations-with-status",
  githubOrganizationTeamsWithStatus: "github:organization-teams-with-status",
  githubOrganizationRepositoriesWithStatus: "github:organization-repositories-with-status",
  githubOrganizationTeamRepositoriesWithStatus: "github:organization-team-repositories-with-status",
  githubOrganizationTeamMembersWithStatus: "github:organization-team-members-with-status",
  githubOrganizationMembersWithStatus: "github:organization-members-with-status",
  githubOrganizationProjectsWithStatus: "github:organization-projects-with-status",
  githubAccountIssuesWithStatus: "github:account-issues-with-status",
  githubAccountPullRequestsWithStatus: "github:account-pull-requests-with-status",
  githubNotificationsWithStatus: "github:notifications-with-status",
  githubNotificationThreadRead: "github:notification-thread-read",
  githubNotificationThreadUnsubscribe: "github:notification-thread-unsubscribe",
  githubRepositoryWithStatus: "github:repository-with-status",
  githubRepositoryForks: "github:repository-forks",
  githubBranchesWithStatus: "github:branches-with-status",
  githubTagsWithStatus: "github:tags-with-status",
  githubTreeWithStatus: "github:tree-with-status",
  githubReadme: "github:readme",
  githubContentsWithStatus: "github:contents-with-status",
  githubFileContentWithStatus: "github:file-content-with-status",
  githubFileBlame: "github:file-blame",
  githubRepositoryWiki: "github:repository-wiki",
  githubCommitsWithStatus: "github:commits-with-status",
  githubLabelsWithStatus: "github:labels-with-status",
  githubAssignableUsersWithStatus: "github:assignable-users-with-status",
  githubRepositoryAccess: "github:repository-access",
  githubMilestonesWithStatus: "github:milestones-with-status",
  githubIssuesWithStatus: "github:issues-with-status",
  githubIssueDetailWithStatus: "github:issue-detail-with-status",
  githubPullRequestsWithStatus: "github:pull-requests-with-status",
  githubPullRequestDetailWithStatus: "github:pull-request-detail-with-status",
  githubPullRequestOverviewWithStatus: "github:pull-request-overview-with-status",
  githubPullRequestCommentsWithStatus: "github:pull-request-comments-with-status",
  githubPullRequestFilesWithStatus: "github:pull-request-files-with-status",
  githubPullRequestCommitsWithStatus: "github:pull-request-commits-with-status",
  githubPullRequestReviewsWithStatus: "github:pull-request-reviews-with-status",
  githubPullRequestChecksWithStatus: "github:pull-request-checks-with-status",
  githubPullRequestReviewThreadsWithStatus: "github:pull-request-review-threads-with-status",
  githubPullRequestTimelineWithStatus: "github:pull-request-timeline-with-status",
  githubPullRequestLinkedIssuesWithStatus: "github:pull-request-linked-issues-with-status",
  githubDiscussionsWithStatus: "github:discussions-with-status",
  githubDiscussionCategoriesWithStatus: "github:discussion-categories-with-status",
  githubDiscussionDetail: "github:discussion-detail",
  githubActionsWithStatus: "github:actions-with-status",
  githubWorkflowsWithStatus: "github:workflows-with-status",
  githubWorkflowRunDetailWithStatus: "github:workflow-run-detail-with-status",
  githubWorkflowJobLogs: "github:workflow-job-logs",
  githubProjectsWithStatus: "github:projects-with-status",
  githubBranchProtection: "github:branch-protection",
  githubDependabotAlerts: "github:dependabot-alerts",
  githubCodeScanningAlerts: "github:code-scanning-alerts",
  githubSecretScanningAlerts: "github:secret-scanning-alerts",
  githubRepositoryRulesets: "github:repository-rulesets",
  githubRepositorySecurityAdvisories: "github:repository-security-advisories",
  githubRepositorySecurityPolicy: "github:repository-security-policy",
  githubRepositoryCommunityProfile: "github:repository-community-profile",
  githubReleasesWithStatus: "github:releases-with-status",
  githubReleaseDetailWithStatus: "github:release-detail-with-status",
  githubContributorsWithStatus: "github:contributors-with-status",
  githubSearchWithStatus: "github:search-with-status",
  githubMutate: "github:mutate"
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];

export const githubIpcRouteChannels = {
  getViewer: ipcChannels.githubViewer,
  getAccountProfileWithStatus: ipcChannels.githubAccountProfileWithStatus,
  listRepositoriesWithStatus: ipcChannels.githubRepositoriesWithStatus,
  listAccountRepositoriesWithStatus: ipcChannels.githubAccountRepositoriesWithStatus,
  listOrganizationsWithStatus: ipcChannels.githubOrganizationsWithStatus,
  listOrganizationTeamsWithStatus: ipcChannels.githubOrganizationTeamsWithStatus,
  listOrganizationRepositoriesWithStatus: ipcChannels.githubOrganizationRepositoriesWithStatus,
  listOrganizationTeamRepositoriesWithStatus: ipcChannels.githubOrganizationTeamRepositoriesWithStatus,
  listOrganizationTeamMembersWithStatus: ipcChannels.githubOrganizationTeamMembersWithStatus,
  listOrganizationMembersWithStatus: ipcChannels.githubOrganizationMembersWithStatus,
  listOrganizationProjectsWithStatus: ipcChannels.githubOrganizationProjectsWithStatus,
  listAccountIssuesWithStatus: ipcChannels.githubAccountIssuesWithStatus,
  listAccountPullRequestsWithStatus: ipcChannels.githubAccountPullRequestsWithStatus,
  listNotificationsWithStatus: ipcChannels.githubNotificationsWithStatus,
  markNotificationThreadRead: ipcChannels.githubNotificationThreadRead,
  unsubscribeNotificationThread: ipcChannels.githubNotificationThreadUnsubscribe,
  getRepositoryWithStatus: ipcChannels.githubRepositoryWithStatus,
  listRepositoryForks: ipcChannels.githubRepositoryForks,
  listBranchesWithStatus: ipcChannels.githubBranchesWithStatus,
  listTagsWithStatus: ipcChannels.githubTagsWithStatus,
  listTreeWithStatus: ipcChannels.githubTreeWithStatus,
  getReadme: ipcChannels.githubReadme,
  listContentsWithStatus: ipcChannels.githubContentsWithStatus,
  getFileContentWithStatus: ipcChannels.githubFileContentWithStatus,
  getFileBlame: ipcChannels.githubFileBlame,
  getRepositoryWiki: ipcChannels.githubRepositoryWiki,
  listCommitsWithStatus: ipcChannels.githubCommitsWithStatus,
  listLabelsWithStatus: ipcChannels.githubLabelsWithStatus,
  listAssignableUsersWithStatus: ipcChannels.githubAssignableUsersWithStatus,
  getRepositoryAccess: ipcChannels.githubRepositoryAccess,
  listMilestonesWithStatus: ipcChannels.githubMilestonesWithStatus,
  listIssuesWithStatus: ipcChannels.githubIssuesWithStatus,
  getIssueDetailWithStatus: ipcChannels.githubIssueDetailWithStatus,
  listPullRequestsWithStatus: ipcChannels.githubPullRequestsWithStatus,
  getPullRequestDetailWithStatus: ipcChannels.githubPullRequestDetailWithStatus,
  getPullRequestOverviewWithStatus: ipcChannels.githubPullRequestOverviewWithStatus,
  listPullRequestCommentsWithStatus: ipcChannels.githubPullRequestCommentsWithStatus,
  listPullRequestFilesWithStatus: ipcChannels.githubPullRequestFilesWithStatus,
  listPullRequestCommitsWithStatus: ipcChannels.githubPullRequestCommitsWithStatus,
  listPullRequestReviewsWithStatus: ipcChannels.githubPullRequestReviewsWithStatus,
  listPullRequestChecksWithStatus: ipcChannels.githubPullRequestChecksWithStatus,
  listPullRequestReviewThreadsWithStatus: ipcChannels.githubPullRequestReviewThreadsWithStatus,
  listPullRequestTimelineWithStatus: ipcChannels.githubPullRequestTimelineWithStatus,
  listPullRequestLinkedIssuesWithStatus: ipcChannels.githubPullRequestLinkedIssuesWithStatus,
  listDiscussionsWithStatus: ipcChannels.githubDiscussionsWithStatus,
  listDiscussionCategoriesWithStatus: ipcChannels.githubDiscussionCategoriesWithStatus,
  getDiscussionDetail: ipcChannels.githubDiscussionDetail,
  listActionsWithStatus: ipcChannels.githubActionsWithStatus,
  listWorkflowsWithStatus: ipcChannels.githubWorkflowsWithStatus,
  getWorkflowRunDetailWithStatus: ipcChannels.githubWorkflowRunDetailWithStatus,
  getWorkflowJobLogs: ipcChannels.githubWorkflowJobLogs,
  listProjectsWithStatus: ipcChannels.githubProjectsWithStatus,
  getBranchProtection: ipcChannels.githubBranchProtection,
  listDependabotAlerts: ipcChannels.githubDependabotAlerts,
  listCodeScanningAlerts: ipcChannels.githubCodeScanningAlerts,
  listSecretScanningAlerts: ipcChannels.githubSecretScanningAlerts,
  listRepositoryRulesets: ipcChannels.githubRepositoryRulesets,
  listRepositorySecurityAdvisories: ipcChannels.githubRepositorySecurityAdvisories,
  getRepositorySecurityPolicy: ipcChannels.githubRepositorySecurityPolicy,
  getRepositoryCommunityProfile: ipcChannels.githubRepositoryCommunityProfile,
  listReleasesWithStatus: ipcChannels.githubReleasesWithStatus,
  getReleaseDetailWithStatus: ipcChannels.githubReleaseDetailWithStatus,
  listContributorsWithStatus: ipcChannels.githubContributorsWithStatus,
  searchWithStatus: ipcChannels.githubSearchWithStatus,
  mutate: ipcChannels.githubMutate
} as const satisfies Record<keyof GitHubIpcApi, IpcChannel>;

export interface ControlIpcEvents {
  githubRepositoriesUpdated: GitHubRepositoriesUpdatedEvent;
  githubAuthUpdated: GitHubAuthUpdatedEvent;
  areasUpdated: AreaUpdatedEvent;
  areaRepositoryUpdated: AreaRepositoryUpdatedEvent;
  areaWorkspaceUpdated: AreaWorkspaceUpdatedEvent;
}

export const controlIpcEventChannels = {
  githubRepositoriesUpdated: ipcChannels.githubRepositoriesUpdated,
  githubAuthUpdated: ipcChannels.githubAuthUpdated,
  areasUpdated: ipcChannels.areasUpdated,
  areaRepositoryUpdated: ipcChannels.areaRepositoryUpdated,
  areaWorkspaceUpdated: ipcChannels.areaWorkspaceUpdated
} as const satisfies Record<keyof ControlIpcEvents, IpcChannel>;

declare global {
  interface Window {
    control?: ControlApi;
  }
}
