import type {
  AccountIssueListInput,
  AccountIssueListResult,
  AccountProfileInput,
  AccountProfileResult,
  AccountPullRequestListInput,
  AccountPullRequestListResult,
  AccountRepositoryInput,
  AccountRepositoryListResult,
  ActionsInput,
  AppState,
  AssignableUserListInput,
  AssignableUserListResult,
  AssignableUserSummary,
  BranchListInput,
  BranchListResult,
  BranchProtectionInput,
  BranchProtectionResult,
  BranchSummary,
  CodeScanningAlertsInput,
  CodeScanningAlertsResult,
  ContributorsInput,
  ContributorListResult,
  ContributorSummary,
  ControlSettings,
  DependabotAlertsInput,
  DependabotAlertsResult,
  DiscussionDetailInput,
  DiscussionDetailResult,
  DiscussionListInput,
  DiscussionListResult,
  DiscussionSummary,
  GitHubAccountProfile,
  GitHubSignInSession,
  GitHubMutationInput,
  GitHubMutationResult,
  IssueDetail,
  IssueDetailInput,
  IssueDetailResult,
  IssueListInput,
  IssueListResult,
  IssueSummary,
  RepositoryLabelListResult,
  LabelSummary,
  RepositoryMilestoneListResult,
  MilestoneSummary,
  NotificationListResult,
  NotificationListInput,
  NotificationSummary,
  NotificationThreadInput,
  NotificationThreadMutationResult,
  OrganizationListInput,
  OrganizationListResult,
  OrganizationMembersInput,
  OrganizationMembersResult,
  OrganizationProjectsInput,
  OrganizationRepositoriesInput,
  OrganizationRepositoriesResult,
  OrganizationTeamMembersInput,
  OrganizationTeamMembersResult,
  OrganizationTeamRepositoriesInput,
  OrganizationTeamRepositoriesResult,
  OrganizationSummary,
  OrganizationTeamsInput,
  OrganizationTeamsResult,
  ProjectSummary,
  ProjectListResult,
  ProjectsInput,
  PullRequestDetail,
  PullRequestDetailInput,
  PullRequestDetailResult,
  PullRequestListInput,
  PullRequestListResult,
  PullRequestSummary,
  ReleaseSummary,
  ReleaseListResult,
  ReleasesInput,
  RepoContentsInput,
  RepoContentsResult,
  RepoDetailInput,
  RepoEntry,
  RepoFileBlameInput,
  RepoFileBlameResult,
  RepoFileContent,
  RepoFileContentInput,
  RepoFileContentResult,
  RepoReadmeInput,
  RepoReadmeResult,
  RepoListInput,
  RepositoryAccessInput,
  RepositoryAccessResult,
  RepositoryCommitListInput,
  RepositoryCommitListResult,
  RepositoryCommitSummary,
  RepositoryCommunityProfileInput,
  RepositoryCommunityProfileResult,
  RepositoryForksInput,
  RepositoryForksResult,
  RepositoryWikiInput,
  RepositoryWikiResult,
  RepositoryMilestoneListInput,
  RepositoryRulesetsInput,
  RepositoryRulesetsResult,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityPolicyInput,
  RepositorySecurityPolicyResult,
  RepoTreeInput,
  RepoTreeReadResult,
  RepoTreeResult,
  RepositoryLabelListInput,
  RepositoryDetail,
  RepositoryDetailResult,
  RepositoryListResult,
  RepositorySearchResult,
  RepositorySummary,
  SearchInput,
  SecretScanningAlertsInput,
  SecretScanningAlertsResult,
  TagListInput,
  TagListResult,
  TagSummary,
  TeamSummary,
  Viewer,
  WorkflowDefinitionListResult,
  WorkflowDefinitionSummary,
  WorkflowJobLogsInput,
  WorkflowJobLogsResult,
  WorkflowListInput,
  WorkflowRunDetail,
  WorkflowRunDetailInput,
  WorkflowRunDetailResult,
  WorkflowRunListResult,
  WorkflowRunSummary
} from "./github";
import type {
  LocalRecentItem,
  LocalRecentListInput,
  LocalRecentRecordInput,
  RepositoryPinInput
} from "./local";

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
  listRecentItems(input?: LocalRecentListInput): Promise<LocalRecentItem[]>;
  recordRecentItem(input: LocalRecentRecordInput): Promise<LocalRecentItem[]>;
  onGitHubRepositoriesUpdated(callback: (event: GitHubRepositoriesUpdatedEvent) => void): () => void;
  github: {
    getViewer(): Promise<Viewer>;
    getAccountProfile(input?: AccountProfileInput): Promise<GitHubAccountProfile>;
    getAccountProfileWithStatus(input?: AccountProfileInput): Promise<AccountProfileResult>;
    listRepositories(input?: RepoListInput): Promise<RepositorySummary[]>;
    listRepositoriesWithStatus(input?: RepoListInput): Promise<RepositoryListResult>;
    listAccountRepositories(input?: AccountRepositoryInput): Promise<RepositorySummary[]>;
    listAccountRepositoriesWithStatus(input?: AccountRepositoryInput): Promise<AccountRepositoryListResult>;
    listOrganizations(input?: OrganizationListInput): Promise<OrganizationSummary[]>;
    listOrganizationsWithStatus(input?: OrganizationListInput): Promise<OrganizationListResult>;
    listOrganizationTeams(input: OrganizationTeamsInput): Promise<TeamSummary[]>;
    listOrganizationTeamsWithStatus(input: OrganizationTeamsInput): Promise<OrganizationTeamsResult>;
    listOrganizationRepositoriesWithStatus(
      input: OrganizationRepositoriesInput
    ): Promise<OrganizationRepositoriesResult>;
    listOrganizationTeamRepositoriesWithStatus(
      input: OrganizationTeamRepositoriesInput
    ): Promise<OrganizationTeamRepositoriesResult>;
    listOrganizationTeamMembersWithStatus(input: OrganizationTeamMembersInput): Promise<OrganizationTeamMembersResult>;
    listOrganizationMembersWithStatus(input: OrganizationMembersInput): Promise<OrganizationMembersResult>;
    listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult>;
    listAccountIssues(input?: AccountIssueListInput): Promise<IssueSummary[]>;
    listAccountIssuesWithStatus(input?: AccountIssueListInput): Promise<AccountIssueListResult>;
    listAccountPullRequests(input?: AccountPullRequestListInput): Promise<PullRequestSummary[]>;
    listAccountPullRequestsWithStatus(input?: AccountPullRequestListInput): Promise<AccountPullRequestListResult>;
    listNotifications(input?: NotificationListInput): Promise<NotificationSummary[]>;
    listNotificationsWithStatus(input?: NotificationListInput): Promise<NotificationListResult>;
    markNotificationThreadRead(input: NotificationThreadInput): Promise<NotificationThreadMutationResult>;
    unsubscribeNotificationThread(input: NotificationThreadInput): Promise<NotificationThreadMutationResult>;
    getRepository(input: RepoDetailInput): Promise<RepositoryDetail>;
    getRepositoryWithStatus(input: RepoDetailInput): Promise<RepositoryDetailResult>;
    listRepositoryForks(input: RepositoryForksInput): Promise<RepositoryForksResult>;
    listBranches(input: BranchListInput): Promise<BranchSummary[]>;
    listBranchesWithStatus(input: BranchListInput): Promise<BranchListResult>;
    listTags(input: TagListInput): Promise<TagSummary[]>;
    listTagsWithStatus(input: TagListInput): Promise<TagListResult>;
    listTree(input: RepoTreeInput): Promise<RepoTreeResult>;
    listTreeWithStatus(input: RepoTreeInput): Promise<RepoTreeReadResult>;
    getReadme(input: RepoReadmeInput): Promise<RepoReadmeResult>;
    listContents(input: RepoContentsInput): Promise<RepoEntry[]>;
    listContentsWithStatus(input: RepoContentsInput): Promise<RepoContentsResult>;
    getFileContent(input: RepoFileContentInput): Promise<RepoFileContent>;
    getFileContentWithStatus(input: RepoFileContentInput): Promise<RepoFileContentResult>;
    getFileBlame(input: RepoFileBlameInput): Promise<RepoFileBlameResult>;
    getRepositoryWiki(input: RepositoryWikiInput): Promise<RepositoryWikiResult>;
    listCommits(input: RepositoryCommitListInput): Promise<RepositoryCommitSummary[]>;
    listCommitsWithStatus(input: RepositoryCommitListInput): Promise<RepositoryCommitListResult>;
    listLabels(input: RepositoryLabelListInput): Promise<LabelSummary[]>;
    listLabelsWithStatus(input: RepositoryLabelListInput): Promise<RepositoryLabelListResult>;
    listAssignableUsers(input: AssignableUserListInput): Promise<AssignableUserSummary[]>;
    listAssignableUsersWithStatus(input: AssignableUserListInput): Promise<AssignableUserListResult>;
    getRepositoryAccess(input: RepositoryAccessInput): Promise<RepositoryAccessResult>;
    listMilestones(input: RepositoryMilestoneListInput): Promise<MilestoneSummary[]>;
    listMilestonesWithStatus(input: RepositoryMilestoneListInput): Promise<RepositoryMilestoneListResult>;
    listIssues(input: IssueListInput): Promise<IssueSummary[]>;
    listIssuesWithStatus(input: IssueListInput): Promise<IssueListResult>;
    getIssueDetail(input: IssueDetailInput): Promise<IssueDetail>;
    getIssueDetailWithStatus(input: IssueDetailInput): Promise<IssueDetailResult>;
    listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]>;
    listPullRequestsWithStatus(input: PullRequestListInput): Promise<PullRequestListResult>;
    getPullRequestDetail(input: PullRequestDetailInput): Promise<PullRequestDetail>;
    getPullRequestDetailWithStatus(input: PullRequestDetailInput): Promise<PullRequestDetailResult>;
    listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]>;
    listDiscussionsWithStatus(input: DiscussionListInput): Promise<DiscussionListResult>;
    getDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetailResult>;
    listActions(input: ActionsInput): Promise<WorkflowRunSummary[]>;
    listActionsWithStatus(input: ActionsInput): Promise<WorkflowRunListResult>;
    listWorkflows(input: WorkflowListInput): Promise<WorkflowDefinitionSummary[]>;
    listWorkflowsWithStatus(input: WorkflowListInput): Promise<WorkflowDefinitionListResult>;
    getWorkflowRunDetail(input: WorkflowRunDetailInput): Promise<WorkflowRunDetail>;
    getWorkflowRunDetailWithStatus(input: WorkflowRunDetailInput): Promise<WorkflowRunDetailResult>;
    getWorkflowJobLogs(input: WorkflowJobLogsInput): Promise<WorkflowJobLogsResult>;
    listProjects(input: ProjectsInput): Promise<ProjectSummary[]>;
    listProjectsWithStatus(input: ProjectsInput): Promise<ProjectListResult>;
    getBranchProtection(input: BranchProtectionInput): Promise<BranchProtectionResult>;
    listDependabotAlerts(input: DependabotAlertsInput): Promise<DependabotAlertsResult>;
    listCodeScanningAlerts(input: CodeScanningAlertsInput): Promise<CodeScanningAlertsResult>;
    listSecretScanningAlerts(input: SecretScanningAlertsInput): Promise<SecretScanningAlertsResult>;
    listRepositoryRulesets(input: RepositoryRulesetsInput): Promise<RepositoryRulesetsResult>;
    listRepositorySecurityAdvisories(
      input: RepositorySecurityAdvisoriesInput
    ): Promise<RepositorySecurityAdvisoriesResult>;
    getRepositorySecurityPolicy(input: RepositorySecurityPolicyInput): Promise<RepositorySecurityPolicyResult>;
    getRepositoryCommunityProfile(input: RepositoryCommunityProfileInput): Promise<RepositoryCommunityProfileResult>;
    listReleases(input: ReleasesInput): Promise<ReleaseSummary[]>;
    listReleasesWithStatus(input: ReleasesInput): Promise<ReleaseListResult>;
    listContributors(input: ContributorsInput): Promise<ContributorSummary[]>;
    listContributorsWithStatus(input: ContributorsInput): Promise<ContributorListResult>;
    search(input: SearchInput): Promise<RepositorySummary[]>;
    searchWithStatus(input: SearchInput): Promise<RepositorySearchResult>;
    mutate(input: GitHubMutationInput): Promise<GitHubMutationResult>;
  };
}

export interface GitHubRepositoriesUpdatedEvent {
  nameWithOwner: string | null;
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
  listRecentItems: "control:list-recent-items",
  recordRecentItem: "control:record-recent-item",
  githubRepositoriesUpdated: "github:repositories-updated",
  githubViewer: "github:viewer",
  githubAccountProfile: "github:account-profile",
  githubAccountProfileWithStatus: "github:account-profile-with-status",
  githubRepositories: "github:repositories",
  githubRepositoriesWithStatus: "github:repositories-with-status",
  githubAccountRepositories: "github:account-repositories",
  githubAccountRepositoriesWithStatus: "github:account-repositories-with-status",
  githubOrganizations: "github:organizations",
  githubOrganizationsWithStatus: "github:organizations-with-status",
  githubOrganizationTeams: "github:organization-teams",
  githubOrganizationTeamsWithStatus: "github:organization-teams-with-status",
  githubOrganizationRepositoriesWithStatus: "github:organization-repositories-with-status",
  githubOrganizationTeamRepositoriesWithStatus: "github:organization-team-repositories-with-status",
  githubOrganizationTeamMembersWithStatus: "github:organization-team-members-with-status",
  githubOrganizationMembersWithStatus: "github:organization-members-with-status",
  githubOrganizationProjectsWithStatus: "github:organization-projects-with-status",
  githubAccountIssues: "github:account-issues",
  githubAccountIssuesWithStatus: "github:account-issues-with-status",
  githubAccountPullRequests: "github:account-pull-requests",
  githubAccountPullRequestsWithStatus: "github:account-pull-requests-with-status",
  githubNotifications: "github:notifications",
  githubNotificationsWithStatus: "github:notifications-with-status",
  githubNotificationThreadRead: "github:notification-thread-read",
  githubNotificationThreadUnsubscribe: "github:notification-thread-unsubscribe",
  githubRepository: "github:repository",
  githubRepositoryWithStatus: "github:repository-with-status",
  githubRepositoryForks: "github:repository-forks",
  githubBranches: "github:branches",
  githubBranchesWithStatus: "github:branches-with-status",
  githubTags: "github:tags",
  githubTagsWithStatus: "github:tags-with-status",
  githubTree: "github:tree",
  githubTreeWithStatus: "github:tree-with-status",
  githubReadme: "github:readme",
  githubContents: "github:contents",
  githubContentsWithStatus: "github:contents-with-status",
  githubFileContent: "github:file-content",
  githubFileContentWithStatus: "github:file-content-with-status",
  githubFileBlame: "github:file-blame",
  githubRepositoryWiki: "github:repository-wiki",
  githubCommits: "github:commits",
  githubCommitsWithStatus: "github:commits-with-status",
  githubLabels: "github:labels",
  githubLabelsWithStatus: "github:labels-with-status",
  githubAssignableUsers: "github:assignable-users",
  githubAssignableUsersWithStatus: "github:assignable-users-with-status",
  githubRepositoryAccess: "github:repository-access",
  githubMilestones: "github:milestones",
  githubMilestonesWithStatus: "github:milestones-with-status",
  githubIssues: "github:issues",
  githubIssuesWithStatus: "github:issues-with-status",
  githubIssueDetail: "github:issue-detail",
  githubIssueDetailWithStatus: "github:issue-detail-with-status",
  githubPullRequests: "github:pull-requests",
  githubPullRequestsWithStatus: "github:pull-requests-with-status",
  githubPullRequestDetail: "github:pull-request-detail",
  githubPullRequestDetailWithStatus: "github:pull-request-detail-with-status",
  githubDiscussions: "github:discussions",
  githubDiscussionsWithStatus: "github:discussions-with-status",
  githubDiscussionDetail: "github:discussion-detail",
  githubActions: "github:actions",
  githubActionsWithStatus: "github:actions-with-status",
  githubWorkflows: "github:workflows",
  githubWorkflowsWithStatus: "github:workflows-with-status",
  githubWorkflowRunDetail: "github:workflow-run-detail",
  githubWorkflowRunDetailWithStatus: "github:workflow-run-detail-with-status",
  githubWorkflowJobLogs: "github:workflow-job-logs",
  githubProjects: "github:projects",
  githubProjectsWithStatus: "github:projects-with-status",
  githubBranchProtection: "github:branch-protection",
  githubDependabotAlerts: "github:dependabot-alerts",
  githubCodeScanningAlerts: "github:code-scanning-alerts",
  githubSecretScanningAlerts: "github:secret-scanning-alerts",
  githubRepositoryRulesets: "github:repository-rulesets",
  githubRepositorySecurityAdvisories: "github:repository-security-advisories",
  githubRepositorySecurityPolicy: "github:repository-security-policy",
  githubRepositoryCommunityProfile: "github:repository-community-profile",
  githubReleases: "github:releases",
  githubReleasesWithStatus: "github:releases-with-status",
  githubContributors: "github:contributors",
  githubContributorsWithStatus: "github:contributors-with-status",
  githubSearch: "github:search",
  githubSearchWithStatus: "github:search-with-status",
  githubMutate: "github:mutate"
} as const;

declare global {
  interface Window {
    control?: ControlApi;
  }
}
