export type CodeHost = "github";

export type CredentialProvider = "github-oauth";

export type GlassMode = "glass-shell" | "reduced" | "solid";

export interface ControlSettings {
  credentialProvider: CredentialProvider;
  glassMode: GlassMode;
}

export interface GitHubAuthStatus {
  available: boolean;
  authenticated: boolean;
  signInConfigured: boolean;
  user: string | null;
  error: string | null;
}

export interface GitHubSignInSession {
  status: "pending" | "complete" | "error" | "cancelled";
  userCode: string | null;
  verificationUri: string | null;
  expiresAt: string | null;
  error: string | null;
}

export interface Viewer {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string | null;
}

export interface RepositoryRef {
  id: string;
  owner: string;
  name: string;
  nameWithOwner: string;
  htmlUrl: string;
  defaultBranch: string | null;
  visibility: string | null;
  isPrivate: boolean | null;
  forkCount: number | null;
  stargazerCount: number | null;
  viewerPermission: string | null;
}

export interface RepositoryCounts {
  openIssues: number;
  openPullRequests: number;
  discussions: number;
  projects: number;
  releases: number;
  forks: number;
  stars: number;
  watchers: number;
}

export interface LanguageStat {
  name: string;
  color: string | null;
  size: number;
  percent: number;
}

export interface ViewerRepositoryState {
  hasStarred: boolean;
  subscription: "IGNORED" | "SUBSCRIBED" | "UNSUBSCRIBED" | null;
  permission: string | null;
  canAdminister: boolean;
  canSubscribe: boolean;
}

export interface RepositoryAdministrationMetadata {
  visibility: string;
  defaultBranch: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isDisabled: boolean;
  isTemplate: boolean | null;
  allowForking: boolean | null;
  webCommitSignoffRequired: boolean | null;
  features: {
    issues: boolean | null;
    projects: boolean | null;
    wiki: boolean | null;
    discussions: boolean | null;
  };
  mergeSettings: {
    allowMergeCommit: boolean | null;
    allowSquashMerge: boolean | null;
    allowRebaseMerge: boolean | null;
    allowAutoMerge: boolean | null;
    deleteBranchOnMerge: boolean | null;
    allowUpdateBranch: boolean | null;
  };
  viewerPermissions: {
    admin: boolean | null;
    maintain: boolean | null;
    push: boolean | null;
    triage: boolean | null;
    pull: boolean | null;
  };
  securityAndAnalysis: {
    advancedSecurity: string | null;
    codeSecurity: string | null;
    dependabotAlerts: string | null;
    dependabotSecurityUpdates: string | null;
    secretScanning: string | null;
    secretScanningPushProtection: string | null;
    secretScanningNonProviderPatterns: string | null;
    secretScanningValidityChecks: string | null;
    secretScanningAiDetection: string | null;
  };
}

export interface GitHubAccountProfile {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  websiteUrl: string | null;
  followers: number;
  following: number;
  repositoryCount: number;
  starredRepositoryCount: number;
  status: {
    emoji: string | null;
    message: string | null;
  } | null;
  pinnedRepositories: RepositorySummary[];
}

export interface AppState {
  platform: NodeJS.Platform;
  isMac: boolean;
  settings: ControlSettings;
  github: GitHubAuthStatus;
  viewer: Viewer | null;
}

export interface PrimaryLanguage {
  name: string;
  color: string | null;
}

export interface RepositorySummary {
  id: string;
  owner: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  visibility: string;
  isPrivate: boolean;
  isFork: boolean;
  stargazerCount: number;
  forkCount: number;
  watcherCount: number;
  openIssuesCount: number;
  counts: RepositoryCounts;
  primaryLanguage: PrimaryLanguage | null;
  updatedAt: string | null;
  pushedAt: string | null;
  avatarUrl: string | null;
  defaultBranch: string | null;
}

export interface RepositoryDetail extends RepositorySummary {
  homepageUrl: string | null;
  licenseName: string | null;
  licenseSpdxId: string | null;
  topics: string[];
  branchCount: number;
  tagCount: number;
  readmeMarkdown: string | null;
  htmlUrl: string;
  languages: LanguageStat[];
  parent: RepositoryRef | null;
  source: RepositoryRef | null;
  viewerState: ViewerRepositoryState;
  permissions: {
    viewerPermission: string | null;
    isArchived: boolean;
    isDisabled: boolean;
  };
  administrationAvailability?: GitHubReadAvailability;
  administration: RepositoryAdministrationMetadata;
}

export interface RepoListInput {
  limit?: number;
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

export interface RepositoryListResult {
  items: RepositorySummary[];
  availability: GitHubReadAvailability;
}

export interface AccountRepositoryListResult {
  items: RepositorySummary[];
  availability: GitHubReadAvailability;
}

export interface RepositorySearchResult {
  items: RepositorySummary[];
  availability: GitHubReadAvailability;
}

export interface AccountProfileInput {
  login?: string | null;
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

export interface AccountProfileResult {
  profile: GitHubAccountProfile | null;
  availability: GitHubReadAvailability;
}

export interface AccountRepositoryInput {
  login?: string | null;
  limit?: number;
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

export interface OrganizationListInput {
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface OrganizationSummary {
  id: string;
  login: string;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
  websiteUrl: string | null;
  location: string | null;
  repositoryCount: number;
  teamCount: number;
  viewerIsMember: boolean;
  viewerMembershipRole: string | null;
  viewerMembershipState: string | null;
  viewerMembershipAvailability: GitHubReadAvailability;
  viewerCanAdminister: boolean;
  viewerCanCreateRepositories: boolean;
  viewerCanCreateTeams: boolean;
}

export interface OrganizationListResult {
  items: OrganizationSummary[];
  availability: GitHubReadAvailability;
}

export interface OrganizationTeamsInput {
  org: string;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface OrganizationTeamRepositoriesInput {
  org: string;
  teamSlug: string;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface OrganizationTeamMembersInput {
  org: string;
  teamSlug: string;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface OrganizationMembersInput {
  org: string;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface OrganizationRepositoriesInput {
  org: string;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface OrganizationProjectsInput {
  org: string;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface TeamParentSummary {
  id: string;
  name: string;
  slug: string;
  htmlUrl: string | null;
}

export interface TeamSummary {
  id: string;
  databaseId: number | null;
  organizationLogin: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: string | null;
  permission: string | null;
  notificationSetting: string | null;
  memberCount: number | null;
  repositoryCount: number | null;
  htmlUrl: string | null;
  parent: TeamParentSummary | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OrganizationTeamRepositorySummary {
  id: string;
  owner: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  visibility: string | null;
  isPrivate: boolean | null;
  permission: string | null;
  htmlUrl: string;
  defaultBranch: string | null;
  updatedAt: string | null;
  pushedAt: string | null;
}

export type OrganizationRepositorySummary = OrganizationTeamRepositorySummary;

export interface OrganizationTeamsResult {
  items: TeamSummary[];
  availability: GitHubReadAvailability;
}

export interface OrganizationRepositoriesResult {
  items: OrganizationRepositorySummary[];
  availability: GitHubReadAvailability;
}

export interface OrganizationTeamRepositoriesResult {
  items: OrganizationTeamRepositorySummary[];
  availability: GitHubReadAvailability;
}

export interface TeamMemberSummary {
  id: string;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  siteAdmin: boolean | null;
}

export type OrganizationMemberSummary = TeamMemberSummary;

export interface OrganizationTeamMembersResult {
  items: TeamMemberSummary[];
  availability: GitHubReadAvailability;
}

export interface OrganizationMembersResult {
  items: OrganizationMemberSummary[];
  availability: GitHubReadAvailability;
}

export interface AccountIssueListInput {
  login?: string | null;
  state?: "open" | "closed" | "all";
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface AccountPullRequestListInput {
  login?: string | null;
  state?: "open" | "closed" | "all";
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface AccountIssueListResult {
  items: IssueSummary[];
  availability: GitHubReadAvailability;
}

export interface AccountPullRequestListResult {
  items: PullRequestSummary[];
  availability: GitHubReadAvailability;
}

export interface NotificationListInput {
  all?: boolean;
  participating?: boolean;
  since?: string | null;
  before?: string | null;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface NotificationSubjectSummary {
  title: string;
  type: string;
  apiUrl: string | null;
  latestCommentApiUrl: string | null;
  latestCommentHtmlUrl: string | null;
  htmlUrl: string | null;
}

export interface NotificationSummary {
  id: string;
  unread: boolean;
  reason: string;
  updatedAt: string;
  lastReadAt: string | null;
  participating: boolean | null;
  threadUrl: string | null;
  subscriptionUrl: string | null;
  subscribed: boolean | null;
  ignored: boolean | null;
  subscriptionReason: string | null;
  subscriptionCreatedAt: string | null;
  repositoryNameWithOwner: string;
  repositoryHtmlUrl: string | null;
  repositoryPrivate: boolean | null;
  subject: NotificationSubjectSummary;
  htmlUrl: string | null;
}

export interface NotificationListResult {
  items: NotificationSummary[];
  availability: GitHubReadAvailability;
}

export interface NotificationThreadInput {
  threadId: string;
}

export interface NotificationThreadMutationResult {
  ok: boolean;
  threadId: string;
  message: string;
}

export interface RepoDetailInput {
  owner: string;
  repo: string;
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

export interface RepositoryForksInput extends RepoDetailInput {
  sort?: "newest" | "oldest" | "stargazers";
  limit?: number;
}

export interface RepositoryForksResult {
  items: RepositoryRef[];
  availability: GitHubReadAvailability;
}

export interface BranchListInput extends RepoDetailInput {
  limit?: number;
}

export interface TagListInput extends RepoDetailInput {
  limit?: number;
}

export interface BranchSummary {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface TagSummary {
  name: string;
  commitSha: string;
  zipballUrl: string | null;
  tarballUrl: string | null;
}

export interface BranchListResult {
  items: BranchSummary[];
  availability: GitHubReadAvailability;
}

export interface TagListResult {
  items: TagSummary[];
  availability: GitHubReadAvailability;
}

export interface RepoTreeInput extends RepoDetailInput {
  ref?: string | null;
  recursive?: boolean;
  limit?: number;
}

export interface RepoTreeEntry {
  path: string;
  type: "file" | "dir" | "submodule";
  sha: string;
  size: number | null;
  htmlUrl: string | null;
}

export interface RepoTreeResult {
  ref: string;
  truncated: boolean;
  entries: RepoTreeEntry[];
}

export interface RepoReadmeInput extends RepoDetailInput {
  ref?: string | null;
}

export interface RepoReadmeResult {
  markdown: string | null;
  availability: GitHubReadAvailability;
}

export interface RepoContentsInput extends RepoDetailInput {
  path?: string;
  ref?: string | null;
}

export interface RepoFileContentInput extends RepoContentsInput {
  path: string;
}

export interface RepoEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  sha: string;
  size: number | null;
  htmlUrl: string | null;
  downloadUrl: string | null;
  lastCommitSha: string | null;
  lastCommitMessage: string | null;
  lastCommitAuthorLogin: string | null;
  lastCommitAuthorName: string | null;
  lastCommitAuthorAvatarUrl: string | null;
  lastAuthoredDate: string | null;
  lastCommittedDate: string | null;
  lastCommitDate: string | null;
  lastCommitHtmlUrl: string | null;
  lastCommitAdditions: number | null;
  lastCommitDeletions: number | null;
  lastCommitChanges: number | null;
  lastCommitAvailability: GitHubReadAvailability;
}

export interface RepoFileContent {
  path: string;
  name: string;
  ref: string | null;
  content: string;
  htmlUrl: string;
  downloadUrl: string | null;
  lastCommitSha: string | null;
  lastCommitMessage: string | null;
  lastCommitAuthorLogin: string | null;
  lastCommitAuthorName: string | null;
  lastCommitAuthorAvatarUrl: string | null;
  lastAuthoredDate: string | null;
  lastCommittedDate: string | null;
  lastCommitDate: string | null;
  lastCommitHtmlUrl: string | null;
  lastCommitAdditions: number | null;
  lastCommitDeletions: number | null;
  lastCommitChanges: number | null;
  lastCommitAvailability: GitHubReadAvailability;
}

export interface RepoFileBlameInput extends RepoFileContentInput {
  maxRanges?: number;
}

export interface RepoFileBlameCommit {
  sha: string;
  headline: string;
  authorLogin: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authoredDate: string | null;
  committedDate: string | null;
  htmlUrl: string | null;
}

export interface RepoFileBlameRange {
  startingLine: number;
  endingLine: number;
  age: number;
  commit: RepoFileBlameCommit;
}

export interface RepoFileBlameResult {
  path: string;
  ref: string | null;
  ranges: RepoFileBlameRange[];
  truncated: boolean;
  availability: GitHubReadAvailability;
}

export interface RepositoryWikiInput extends RepoDetailInput {
  pagePath?: string | null;
  limit?: number;
}

export interface WikiPageSummary {
  path: string;
  title: string;
  sha: string;
  size: number | null;
  htmlUrl: string | null;
}

export interface WikiPageContent extends WikiPageSummary {
  markdown: string;
}

export interface RepositoryWikiResult {
  pages: WikiPageSummary[];
  selectedPage: WikiPageContent | null;
  availability: GitHubReadAvailability;
}

export interface RepositoryCommitListInput extends RepoDetailInput {
  ref?: string | null;
  path?: string | null;
  limit?: number;
}

export interface RepositoryCommitSummary {
  sha: string;
  message: string;
  headline: string;
  authorLogin: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  committerLogin: string | null;
  committerName: string | null;
  committerAvatarUrl: string | null;
  authoredDate: string | null;
  committedDate: string | null;
  htmlUrl: string | null;
  parentCount: number;
  verificationReason: string | null;
  verified: boolean | null;
}

export interface LabelSummary {
  id: number | string;
  name: string;
  color: string;
  description?: string | null;
}

export interface RepositoryLabelListInput extends RepoDetailInput {
  limit?: number;
}

export interface AssignableUserListInput extends RepoDetailInput {
  limit?: number;
}

export interface AssignableUserSummary {
  id: number | string;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
}

export interface RepositoryAccessInput extends RepoDetailInput {
  affiliation?: "all" | "direct" | "outside";
  permission?: "admin" | "maintain" | "push" | "triage" | "pull";
  limit?: number;
}

export interface RepositoryCollaboratorSummary {
  id: number | string;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  type: string | null;
  siteAdmin: boolean;
  roleName: string | null;
  permissions: {
    admin: boolean | null;
    maintain: boolean | null;
    push: boolean | null;
    triage: boolean | null;
    pull: boolean | null;
  };
}

export interface RepositoryAccessResult {
  collaborators: RepositoryCollaboratorSummary[];
  teams: TeamSummary[];
  collaboratorsAvailability: GitHubReadAvailability;
  teamsAvailability: GitHubReadAvailability;
}

export interface RepositoryMilestoneListInput extends RepoDetailInput {
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface MilestoneSummary {
  id: number | string;
  number: number;
  title: string;
  description: string | null;
  state: string;
  dueOn: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  htmlUrl: string | null;
  openIssues: number | null;
  closedIssues: number | null;
}

export interface IssueSummary {
  id: number | string;
  number: number;
  title: string;
  state: string;
  stateReason: string | null;
  locked?: boolean | null;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  comments: number;
  labels: LabelSummary[];
  assignees?: AssignableUserSummary[];
  milestone?: MilestoneSummary | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  repositoryNameWithOwner?: string | null;
}

export interface IssueListInput extends RepoDetailInput {
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface IssueListResult {
  items: IssueSummary[];
  availability: GitHubReadAvailability;
}

export interface IssueDetailInput extends RepoDetailInput {
  issueNumber: number;
}

export interface TimelineCommentSummary {
  id: number | string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface IssueDetail extends IssueSummary {
  body: string | null;
  commentsList: TimelineCommentSummary[];
  commentsAvailability: GitHubReadAvailability;
}

export interface IssueDetailResult {
  detail: IssueDetail | null;
  availability: GitHubReadAvailability;
}

export interface PullRequestSummary {
  id: number | string;
  number: number;
  title: string;
  state: string;
  merged: boolean | null;
  mergedAt: string | null;
  isDraft: boolean;
  locked?: boolean | null;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  comments: number;
  reviewComments: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeableState: string | null;
  reviewDecision: string | null;
  mergeCommitSha: string | null;
  maintainerCanModify: boolean | null;
  isCrossRepository: boolean | null;
  headRefName: string;
  baseRefName: string;
  headRepositoryNameWithOwner?: string | null;
  baseRepositoryNameWithOwner?: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  repositoryNameWithOwner?: string | null;
}

export interface PullRequestListInput extends RepoDetailInput {
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface PullRequestListResult {
  items: PullRequestSummary[];
  availability: GitHubReadAvailability;
}

export interface PullRequestDetailInput extends RepoDetailInput {
  pullNumber: number;
}

export interface PullRequestDetailResult {
  detail: PullRequestDetail | null;
  availability: GitHubReadAvailability;
}

export interface PullRequestFileSummary {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
  blobUrl: string | null;
  rawUrl: string | null;
}

export interface PullRequestCommitSummary {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  committedAt: string;
  htmlUrl: string | null;
}

export interface PullRequestRequestedTeamSummary {
  id: number | string;
  name: string;
  slug: string;
  htmlUrl: string | null;
}

export interface PullRequestReviewSummary {
  id: number;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  state: string;
  body: string | null;
  submittedAt: string | null;
  commitSha: string | null;
  htmlUrl: string | null;
}

export interface PullRequestCheckSummary {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string | null;
  detailsUrl: string | null;
  appName: string | null;
  outputTitle: string | null;
  outputSummary: string | null;
}

export interface PullRequestReviewThreadCommentSummary {
  id: number;
  reviewId: number | null;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  body: string | null;
  path: string;
  diffHunk: string | null;
  position: number | null;
  originalPosition: number | null;
  startLine: number | null;
  line: number | null;
  side: string | null;
  inReplyToId: number | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string | null;
}

export interface PullRequestReviewThreadSummary {
  id: number;
  path: string;
  isResolved: boolean | null;
  isOutdated: boolean | null;
  comments: PullRequestReviewThreadCommentSummary[];
}

export interface PullRequestTimelineEventSourceIssue {
  number: number;
  title: string | null;
  htmlUrl: string | null;
  repositoryNameWithOwner: string | null;
}

export interface PullRequestLinkedIssueSummary {
  number: number;
  title: string | null;
  state: string;
  stateReason: string | null;
  htmlUrl: string | null;
  repositoryNameWithOwner: string | null;
}

export interface PullRequestTimelineEventSummary {
  id: number | string;
  event: string;
  actorLogin: string | null;
  actorAvatarUrl: string | null;
  createdAt: string | null;
  commitSha: string | null;
  labelName: string | null;
  assigneeLogin: string | null;
  requestedReviewerLogin: string | null;
  requestedTeamName: string | null;
  milestoneTitle: string | null;
  renameFrom: string | null;
  renameTo: string | null;
  sourceIssue: PullRequestTimelineEventSourceIssue | null;
}

export interface PullRequestDetail extends PullRequestSummary {
  body: string | null;
  labels: LabelSummary[];
  assignees: AssignableUserSummary[];
  milestone: MilestoneSummary | null;
  commentsList: TimelineCommentSummary[];
  commentsAvailability: GitHubReadAvailability;
  files: PullRequestFileSummary[];
  filesAvailability: GitHubReadAvailability;
  commitsList: PullRequestCommitSummary[];
  commitsAvailability: GitHubReadAvailability;
  requestedReviewers: AssignableUserSummary[];
  requestedTeams: PullRequestRequestedTeamSummary[];
  reviews: PullRequestReviewSummary[];
  reviewsAvailability: GitHubReadAvailability;
  latestReviewState: string | null;
  reviewDecisionAvailability: GitHubReadAvailability;
  checks: PullRequestCheckSummary[];
  checksAvailability: GitHubReadAvailability;
  reviewThreads: PullRequestReviewThreadSummary[];
  reviewThreadsAvailability: GitHubReadAvailability;
  reviewThreadStatesAvailability?: GitHubReadAvailability;
  timelineEvents: PullRequestTimelineEventSummary[];
  timelineAvailability: GitHubReadAvailability;
  linkedIssues: PullRequestLinkedIssueSummary[];
  linkedIssuesAvailability: GitHubReadAvailability;
}

export interface DiscussionSummary {
  id: string;
  number: number;
  title: string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  category: string | null;
  body: string | null;
  createdAt: string;
  comments: number;
  previewComments: TimelineCommentSummary[];
  previewCommentsTruncated: boolean;
  answer: TimelineCommentSummary | null;
  isAnswered: boolean | null;
  upvotes: number;
  closed: boolean;
  locked: boolean;
  updatedAt: string;
  htmlUrl: string;
}

export interface DiscussionListInput extends RepoDetailInput {
  limit?: number;
}

export interface DiscussionDetailInput extends RepoDetailInput {
  discussionNumber: number;
  commentsLimit?: number;
  repliesLimit?: number;
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

export type GitHubReadAvailabilityStatus =
  | "available"
  | "feature_disabled"
  | "not_loaded"
  | "permission_denied"
  | "rate_limited"
  | "graphql_error"
  | "error";

export interface GitHubReadAvailability {
  status: GitHubReadAvailabilityStatus;
  message: string | null;
}

export interface RepositoryLabelListResult {
  items: LabelSummary[];
  availability: GitHubReadAvailability;
}

export interface AssignableUserListResult {
  items: AssignableUserSummary[];
  availability: GitHubReadAvailability;
}

export interface RepositoryMilestoneListResult {
  items: MilestoneSummary[];
  availability: GitHubReadAvailability;
}

export interface DiscussionListResult {
  items: DiscussionSummary[];
  availability: GitHubReadAvailability;
}

export interface RepoContentsResult {
  items: RepoEntry[];
  availability: GitHubReadAvailability;
}

export interface RepoFileContentResult {
  item: RepoFileContent | null;
  availability: GitHubReadAvailability;
}

export interface RepoTreeReadResult {
  tree: RepoTreeResult | null;
  availability: GitHubReadAvailability;
}

export interface RepositoryCommitListResult {
  items: RepositoryCommitSummary[];
  availability: GitHubReadAvailability;
}

export interface DiscussionCommentSummary extends TimelineCommentSummary {
  replies: TimelineCommentSummary[];
  repliesTruncated: boolean;
}

export interface DiscussionDetail extends DiscussionSummary {
  commentsList: DiscussionCommentSummary[];
  commentsTruncated: boolean;
}

export interface DiscussionDetailResult {
  item: DiscussionDetail | null;
  availability: GitHubReadAvailability;
}

export interface RepositoryCommunityProfileInput extends RepoDetailInput {
  forceRefresh?: boolean;
  cacheOnly?: boolean;
}

export interface CommunityProfileFileSummary {
  key: string;
  label: string;
  name: string | null;
  path: string | null;
  htmlUrl: string | null;
  downloadUrl: string | null;
  url: string | null;
}

export interface RepositoryCommunityProfile {
  healthPercentage: number | null;
  description: string | null;
  documentationUrl: string | null;
  files: CommunityProfileFileSummary[];
}

export interface RepositoryCommunityProfileResult {
  profile: RepositoryCommunityProfile | null;
  availability: GitHubReadAvailability;
}

export interface WorkflowRunSummary {
  id: number;
  name: string;
  displayTitle: string | null;
  runNumber: number | null;
  runAttempt: number | null;
  event: string;
  status: string | null;
  conclusion: string | null;
  branch: string | null;
  commitSha: string | null;
  headRepositoryNameWithOwner: string | null;
  actorLogin: string | null;
  actorAvatarUrl: string | null;
  triggeringActorLogin: string | null;
  runStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  actionAvailability?: {
    canRerun: boolean | null;
    canRerunFailedJobs: boolean | null;
    canCancel: boolean | null;
    rerunUrl: string | null;
    rerunFailedJobsUrl: string | null;
    cancelUrl: string | null;
    previousAttemptUrl: string | null;
  };
}

export interface ActionsInput extends RepoDetailInput {
  limit?: number;
}

export interface WorkflowRunListResult {
  items: WorkflowRunSummary[];
  availability: GitHubReadAvailability;
}

export interface WorkflowListInput extends RepoDetailInput {
  ref?: string | null;
  limit?: number;
}

export type WorkflowDispatchInputType =
  | "string"
  | "boolean"
  | "choice"
  | "number"
  | "environment";

export interface WorkflowDispatchInputSummary {
  name: string;
  description: string | null;
  required: boolean;
  type: WorkflowDispatchInputType;
  defaultValue: string | null;
  options: string[];
}

export interface WorkflowDefinitionSummary {
  id: number;
  nodeId: string | null;
  name: string;
  path: string;
  state: string;
  htmlUrl: string | null;
  badgeUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  dispatchable: boolean;
  inputs: WorkflowDispatchInputSummary[];
  inputsUnavailableMessage: string | null;
}

export interface WorkflowDefinitionListResult {
  items: WorkflowDefinitionSummary[];
  availability: GitHubReadAvailability;
}

export interface WorkflowRunDetailInput extends RepoDetailInput {
  runId: number;
}

export interface WorkflowRunStepSummary {
  name: string;
  status: string | null;
  conclusion: string | null;
  number: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkflowRunJobSummary {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string | null;
  runnerName: string | null;
  labels: string[];
  steps: WorkflowRunStepSummary[];
}

export interface WorkflowRunArtifactSummary {
  id: number;
  name: string;
  sizeInBytes: number;
  expired: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  archiveDownloadUrl: string | null;
  archiveDownloadAvailability: GitHubReadAvailability;
}

export interface WorkflowRunCheckSuiteSummary {
  id: number;
  status: string | null;
  conclusion: string | null;
  headBranch: string | null;
  headSha: string | null;
  beforeSha: string | null;
  afterSha: string | null;
  appName: string | null;
  appSlug: string | null;
  appHtmlUrl: string | null;
  latestCheckRunCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkflowRunCheckAnnotationSummary {
  path: string;
  startLine: number | null;
  endLine: number | null;
  annotationLevel: string | null;
  title: string | null;
  message: string;
  rawDetails: string | null;
  blobHref: string | null;
}

export interface WorkflowRunCheckRunSummary {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string | null;
  detailsUrl: string | null;
  checkSuiteId: number | null;
  appName: string | null;
  appSlug: string | null;
  appHtmlUrl: string | null;
  outputTitle: string | null;
  outputSummary: string | null;
  outputText: string | null;
  annotationsCount: number;
  annotations: WorkflowRunCheckAnnotationSummary[];
  annotationsAvailability: GitHubReadAvailability;
}

export interface WorkflowRunLogsSummary {
  apiUrl: string | null;
  downloadUrl: string | null;
  available: boolean;
  message: string | null;
  availability: GitHubReadAvailability;
}

export interface WorkflowJobLogsInput extends RepoDetailInput {
  jobId: number;
  maxCharacters?: number;
}

export interface WorkflowJobLogsResult {
  jobId: number;
  text: string;
  truncated: boolean;
  downloadUrl: string | null;
  availability: GitHubReadAvailability;
}

export interface WorkflowRunDetail extends WorkflowRunSummary {
  jobs: WorkflowRunJobSummary[];
  jobsAvailability: GitHubReadAvailability;
  artifacts: WorkflowRunArtifactSummary[];
  artifactsAvailability: GitHubReadAvailability;
  checkSuites: WorkflowRunCheckSuiteSummary[];
  checkSuitesAvailability: GitHubReadAvailability;
  checkRuns: WorkflowRunCheckRunSummary[];
  checkRunsAvailability: GitHubReadAvailability;
  logs: WorkflowRunLogsSummary;
}

export interface WorkflowRunDetailResult {
  detail: WorkflowRunDetail | null;
  availability: GitHubReadAvailability;
}

export interface ProjectSummary {
  id: string;
  number: number | null;
  title: string;
  shortDescription: string | null;
  readme: string | null;
  ownerLogin: string | null;
  ownerKind: "organization" | "repository" | "user" | "unknown";
  ownerHtmlUrl: string | null;
  isPublic: boolean | null;
  closed: boolean;
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  itemsCount: number | null;
  fieldsCount: number | null;
  fields: ProjectFieldSummary[];
  viewerCanUpdate: boolean | null;
  htmlUrl: string | null;
}

export interface ProjectFieldSummary {
  id: string;
  name: string;
  dataType: string | null;
}

export interface ProjectsInput extends RepoDetailInput {
  limit?: number;
}

export interface ProjectListResult {
  items: ProjectSummary[];
  availability: GitHubReadAvailability;
}

export interface BranchProtectionInput extends RepoDetailInput {
  branch: string;
}

export interface BranchProtectionSummary {
  branch: string;
  url: string | null;
  requiredStatusCheckContexts: string[];
  requiredStatusCheckEnforcementLevel: string | null;
  enforceAdmins: boolean | null;
  requiresPullRequestReviews: boolean;
  requiredApprovingReviewCount: number | null;
  dismissStaleReviews: boolean | null;
  requireCodeOwnerReviews: boolean | null;
  requireLastPushApproval: boolean | null;
  restrictsPushes: boolean;
  restrictionUserCount: number | null;
  restrictionTeamCount: number | null;
  restrictionAppCount: number | null;
  requiredLinearHistory: boolean | null;
  allowForcePushes: boolean | null;
  allowDeletions: boolean | null;
  requiredConversationResolution: boolean | null;
  lockBranch: boolean | null;
  allowForkSyncing: boolean | null;
}

export interface BranchProtectionResult {
  protection: BranchProtectionSummary | null;
  availability: GitHubReadAvailability;
}

export interface DependabotAlertSummary {
  number: number;
  state: string;
  severity: string | null;
  packageName: string | null;
  ecosystem: string | null;
  manifestPath: string | null;
  scope: string | null;
  summary: string | null;
  htmlUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  dismissedAt: string | null;
  fixedAt: string | null;
}

export interface DependabotAlertsInput extends RepoDetailInput {
  state?: "auto_dismissed" | "dismissed" | "fixed" | "open";
  limit?: number;
}

export interface DependabotAlertsResult {
  items: DependabotAlertSummary[];
  availability: GitHubReadAvailability;
}

export interface CodeScanningAlertSummary {
  number: number;
  state: string;
  severity: string | null;
  ruleId: string | null;
  ruleName: string | null;
  ruleDescription: string | null;
  toolName: string | null;
  message: string | null;
  ref: string | null;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
  htmlUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  dismissedAt: string | null;
  fixedAt: string | null;
}

export interface CodeScanningAlertsInput extends RepoDetailInput {
  state?: "open" | "dismissed" | "fixed";
  limit?: number;
}

export interface CodeScanningAlertsResult {
  items: CodeScanningAlertSummary[];
  availability: GitHubReadAvailability;
}

export interface SecretScanningAlertSummary {
  number: number;
  state: string;
  secretType: string | null;
  secretTypeDisplayName: string | null;
  resolution: string | null;
  validity: string | null;
  publiclyLeaked: boolean | null;
  multiRepo: boolean | null;
  pushProtectionBypassed: boolean | null;
  pushProtectionBypassedAt: string | null;
  firstLocationPath: string | null;
  firstLocationStartLine: number | null;
  firstLocationEndLine: number | null;
  htmlUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
}

export interface SecretScanningAlertsInput extends RepoDetailInput {
  state?: "open" | "resolved";
  limit?: number;
}

export interface SecretScanningAlertsResult {
  items: SecretScanningAlertSummary[];
  availability: GitHubReadAvailability;
}

export interface RepositoryRulesetSummary {
  id: number;
  nodeId: string | null;
  name: string;
  target: string | null;
  enforcement: string | null;
  sourceType: string | null;
  source: string | null;
  htmlUrl: string | null;
  bypassActorCount: number | null;
  conditionCount: number | null;
  ruleCount: number | null;
  currentUserCanBypass: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RepositoryRulesetsInput extends RepoDetailInput {
  includesParents?: boolean;
  limit?: number;
}

export interface RepositoryRulesetsResult {
  items: RepositoryRulesetSummary[];
  availability: GitHubReadAvailability;
}

export interface RepositorySecurityAdvisorySummary {
  ghsaId: string;
  cveId: string | null;
  state: string;
  severity: string | null;
  summary: string;
  description: string | null;
  cvssScore: number | null;
  cvssVector: string | null;
  cweIds: string[];
  vulnerabilityCount: number | null;
  creditCount: number | null;
  htmlUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  withdrawnAt: string | null;
}

export interface RepositorySecurityAdvisoriesInput extends RepoDetailInput {
  limit?: number;
}

export interface RepositorySecurityAdvisoriesResult {
  items: RepositorySecurityAdvisorySummary[];
  availability: GitHubReadAvailability;
}

export interface RepositorySecurityPolicyInput extends RepoDetailInput {
  ref?: string | null;
}

export interface RepositorySecurityPolicy {
  path: string;
  htmlUrl: string | null;
  downloadUrl: string | null;
  rawUrl: string | null;
  sha: string | null;
  size: number | null;
  ref: string | null;
  content: string | null;
}

export interface RepositorySecurityPolicyResult {
  policy: RepositorySecurityPolicy | null;
  availability: GitHubReadAvailability;
}

export interface ReleaseSummary {
  id: number;
  name: string | null;
  tagName: string;
  targetCommitish: string | null;
  body: string | null;
  isDraft: boolean;
  isPrerelease: boolean;
  publishedAt: string | null;
  htmlUrl: string;
  assets: ReleaseAssetSummary[];
}

export interface ReleaseAssetSummary {
  id: number;
  name: string;
  label: string | null;
  state: string | null;
  contentType: string | null;
  sizeInBytes: number;
  downloadCount: number;
  browserDownloadUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ReleasesInput extends RepoDetailInput {
  limit?: number;
}

export interface ReleaseListResult {
  items: ReleaseSummary[];
  availability: GitHubReadAvailability;
}

export interface ContributorSummary {
  id: number;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  contributions: number;
}

export interface ContributorsInput extends RepoDetailInput {
  limit?: number;
}

export interface ContributorListResult {
  items: ContributorSummary[];
  availability: GitHubReadAvailability;
}

export interface RepositoryDetailResult {
  detail: RepositoryDetail | null;
  availability: GitHubReadAvailability;
}

export interface SearchInput {
  query: string;
  limit?: number;
}

export type GitHubAction =
  | "star"
  | "unstar"
  | "watch"
  | "unwatch"
  | "fork"
  | "editRepository"
  | "createIssue"
  | "editIssue"
  | "closeIssue"
  | "reopenIssue"
  | "addComment"
  | "editComment"
  | "deleteComment"
  | "editReviewComment"
  | "deleteReviewComment"
  | "addLabels"
  | "removeLabel"
  | "setAssignees"
  | "removeAssignees"
  | "mergePullRequest"
  | "createPullRequest"
  | "closePullRequest"
  | "reopenPullRequest"
  | "approvePullRequest"
  | "commentPullRequestReview"
  | "requestChanges"
  | "requestReviewers"
  | "removeReviewers"
  | "rerunWorkflow"
  | "rerunFailedWorkflowJobs"
  | "rerunWorkflowJob"
  | "dispatchWorkflow"
  | "cancelWorkflow"
  | "createRelease"
  | "editRelease"
  | "deleteRelease"
  | "deleteReleaseAsset";

export interface GitHubMutationInput {
  action: GitHubAction;
  owner: string;
  repo: string;
  payload?: Record<string, unknown>;
}

export interface GitHubMutationResult {
  ok: boolean;
  action: GitHubAction;
  message: string;
  data?: unknown;
}

export interface GitHubProvider {
  getViewer(): Promise<Viewer>;
  getAccountProfile(input?: AccountProfileInput): Promise<GitHubAccountProfile>;
  getAccountProfileWithStatus(input?: AccountProfileInput): Promise<AccountProfileResult>;
  listRepositories(input: RepoListInput): Promise<RepositorySummary[]>;
  listRepositoriesWithStatus(input: RepoListInput): Promise<RepositoryListResult>;
  listAccountRepositories(input: AccountRepositoryInput): Promise<RepositorySummary[]>;
  listAccountRepositoriesWithStatus(input: AccountRepositoryInput): Promise<AccountRepositoryListResult>;
  listOrganizations(input: OrganizationListInput): Promise<OrganizationSummary[]>;
  listOrganizationsWithStatus(input?: OrganizationListInput): Promise<OrganizationListResult>;
  listOrganizationTeams(input: OrganizationTeamsInput): Promise<TeamSummary[]>;
  listOrganizationTeamsWithStatus(input: OrganizationTeamsInput): Promise<OrganizationTeamsResult>;
  listOrganizationRepositoriesWithStatus(input: OrganizationRepositoriesInput): Promise<OrganizationRepositoriesResult>;
  listOrganizationTeamRepositoriesWithStatus(
    input: OrganizationTeamRepositoriesInput
  ): Promise<OrganizationTeamRepositoriesResult>;
  listOrganizationTeamMembersWithStatus(input: OrganizationTeamMembersInput): Promise<OrganizationTeamMembersResult>;
  listOrganizationMembersWithStatus(input: OrganizationMembersInput): Promise<OrganizationMembersResult>;
  listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult>;
  listAccountIssues(input: AccountIssueListInput): Promise<IssueSummary[]>;
  listAccountIssuesWithStatus(input?: AccountIssueListInput): Promise<AccountIssueListResult>;
  listAccountPullRequests(input: AccountPullRequestListInput): Promise<PullRequestSummary[]>;
  listAccountPullRequestsWithStatus(input?: AccountPullRequestListInput): Promise<AccountPullRequestListResult>;
  listNotifications(input: NotificationListInput): Promise<NotificationSummary[]>;
  listNotificationsWithStatus(input?: NotificationListInput): Promise<NotificationListResult>;
  markNotificationThreadRead(input: NotificationThreadInput): Promise<NotificationThreadMutationResult>;
  unsubscribeNotificationThread(input: NotificationThreadInput): Promise<NotificationThreadMutationResult>;
  getRepository(owner: string, repo: string): Promise<RepositoryDetail>;
  getRepositoryWithStatus(owner: string, repo: string): Promise<RepositoryDetailResult>;
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
  mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult>;
}
