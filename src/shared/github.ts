export type CodeHost = "github";

export type CredentialProvider = "github-oauth";

export const CONTROL_GLASS_MODES = ["glass-shell", "reduced", "solid"] as const;

export type GlassMode = (typeof CONTROL_GLASS_MODES)[number];

export const CONTROL_GLASS_MODE_LABELS: Record<GlassMode, string> = {
  "glass-shell": "Glass shell",
  reduced: "Reduced glass",
  solid: "Solid"
};

export const CONTROL_THEME_MODES = ["light", "dark", "system"] as const;

export type ControlThemeMode = (typeof CONTROL_THEME_MODES)[number];

export const CONTROL_THEME_PRESETS = [
  "control-light",
  "control-dark",
  "control-dim",
  "control-high-contrast-dark"
] as const;

export type ControlThemePreset = (typeof CONTROL_THEME_PRESETS)[number];

export const CONTROL_THEME_PRESET_LABELS: Record<ControlThemePreset, string> = {
  "control-light": "Control Light",
  "control-dark": "Control Dark",
  "control-dim": "Dim",
  "control-high-contrast-dark": "High Contrast Dark"
};

export const CONTROL_ACCENT_COLORS = ["blue", "green", "purple", "gray"] as const;

export type ControlAccentColor = (typeof CONTROL_ACCENT_COLORS)[number];

export const CONTROL_ACCENT_COLOR_LABELS: Record<ControlAccentColor, string> = {
  blue: "Blue",
  green: "Green",
  purple: "Purple",
  gray: "Gray"
};

export const CONTROL_UI_FONTS = ["inter", "system", "satoshi", "serif"] as const;

export type ControlUiFont = (typeof CONTROL_UI_FONTS)[number];

export const CONTROL_UI_FONT_LABELS: Record<ControlUiFont, string> = {
  inter: "Inter",
  system: "System",
  satoshi: "Satoshi",
  serif: "Serif"
};

export const CONTROL_CODE_FONTS = ["sf-mono", "jetbrains-mono", "fira-code", "monaco"] as const;

export type ControlCodeFont = (typeof CONTROL_CODE_FONTS)[number];

export const CONTROL_CODE_FONT_LABELS: Record<ControlCodeFont, string> = {
  "sf-mono": "SF Mono",
  "jetbrains-mono": "JetBrains Mono",
  "fira-code": "Fira Code",
  monaco: "Monaco"
};

export interface ControlThemePaletteSettings {
  accent: string;
  background: string;
  foreground: string;
}

export interface ControlThemeCustomSettings {
  light: ControlThemePaletteSettings;
  dark: ControlThemePaletteSettings;
  uiFont: ControlUiFont;
  codeFont: ControlCodeFont;
}

export interface ControlThemeSettings {
  mode: ControlThemeMode;
  preset: ControlThemePreset;
  accent: ControlAccentColor;
  custom: ControlThemeCustomSettings;
}

export const DEFAULT_CONTROL_THEME_SETTINGS: ControlThemeSettings = {
  mode: "system",
  preset: "control-light",
  accent: "blue",
  custom: {
    light: {
      accent: "#2563EB",
      background: "#EAF2FC",
      foreground: "#0F172A"
    },
    dark: {
      accent: "#60A5FA",
      background: "#101827",
      foreground: "#E5EDF7"
    },
    uiFont: "inter",
    codeFont: "sf-mono"
  }
};

export type RepositoryTabPreference = "auto" | "show" | "hide";

export type RepositoryTabPreferenceKey =
  | "agents"
  | "discussions"
  | "projects"
  | "releases"
  | "contributors"
  | "wiki"
  | "securityQuality"
  | "settings";

export interface ControlSettings {
  credentialProvider: CredentialProvider;
  glassMode: GlassMode;
  theme: ControlThemeSettings;
  repositoryTabPreferences: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>;
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

export interface GitHubContributionCalendarDay {
  date: string;
  weekday: number;
  contributionCount: number;
  color: string | null;
}

export interface GitHubContributionCalendarWeek {
  firstDay: string;
  contributionDays: GitHubContributionCalendarDay[];
}

export interface GitHubContributionCalendar {
  totalContributions: number;
  weeks: GitHubContributionCalendarWeek[];
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
  contributionCalendar?: GitHubContributionCalendar | null;
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

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface GitHubAvailabilityResult {
  availability: GitHubReadAvailability;
}

export interface GitHubPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export type GitHubListResult<T> = GitHubAvailabilityResult & {
  items: T[];
  pageInfo?: GitHubPageInfo | null;
};

export type GitHubNullableResult<TKey extends string, TValue> = GitHubAvailabilityResult & {
  [K in TKey]: TValue | null;
};

export type RepositoryListResult = GitHubListResult<RepositorySummary>;

export type AccountRepositoryListResult = GitHubListResult<RepositorySummary>;

export interface AccountCommitContributionSummary {
  id: string;
  repositoryNameWithOwner: string;
  repositoryUrl: string;
  occurredAt: string;
  commitCount: number;
  restricted: boolean;
}

export type AccountContributionListResult = GitHubListResult<AccountCommitContributionSummary>;

export type RepositorySearchResult = GitHubListResult<RepositorySummary>;

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

export interface AccountContributionListInput {
  login?: string | null;
  limit?: number;
  forceRefresh?: boolean;
  cacheOnly?: boolean;
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

export type OrganizationListResult = GitHubListResult<OrganizationSummary>;

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

export type OrganizationTeamsResult = GitHubListResult<TeamSummary>;

export type OrganizationRepositoriesResult = GitHubListResult<OrganizationRepositorySummary>;

export type OrganizationTeamRepositoriesResult = GitHubListResult<OrganizationTeamRepositorySummary>;

export interface TeamMemberSummary {
  id: string;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  siteAdmin: boolean | null;
}

export type OrganizationMemberSummary = TeamMemberSummary;

export type OrganizationTeamMembersResult = GitHubListResult<TeamMemberSummary>;

export type OrganizationMembersResult = GitHubListResult<OrganizationMemberSummary>;

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

export type AccountIssueListResult = GitHubListResult<IssueSummary>;

export type AccountPullRequestListResult = GitHubListResult<PullRequestSummary>;

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

export type NotificationListResult = GitHubListResult<NotificationSummary>;

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

export type RepositoryForksResult = GitHubListResult<RepositoryRef>;

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

export type BranchListResult = GitHubListResult<BranchSummary>;

export type TagListResult = GitHubListResult<TagSummary>;

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

export type RepoFileContentKind = "text" | "image" | "binary" | "too_large" | "unavailable";

export interface RepoFileContent {
  path: string;
  name: string;
  ref: string | null;
  kind: RepoFileContentKind;
  content: string | null;
  size: number | null;
  encoding: "utf-8" | null;
  htmlUrl: string;
  downloadUrl: string | null;
  message: string | null;
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
  nodeId: string | null;
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

export type IssueListResult = GitHubListResult<IssueSummary>;

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
  nodeId: string | null;
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

export type PullRequestListResult = GitHubListResult<PullRequestSummary>;

export interface PullRequestDetailInput extends RepoDetailInput {
  pullNumber: number;
}

export interface PullRequestDetailReadInput extends PullRequestDetailInput {
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

export interface PullRequestDetailPageInput extends PullRequestDetailReadInput {
  limit?: number;
  cursor?: string | null;
}

export type PullRequestOverviewInput = PullRequestDetailReadInput;
export type PullRequestCommentsInput = PullRequestDetailPageInput;
export type PullRequestFilesInput = PullRequestDetailPageInput;
export type PullRequestCommitsInput = PullRequestDetailPageInput;
export type PullRequestReviewsInput = PullRequestDetailPageInput;
export type PullRequestChecksInput = PullRequestDetailReadInput;
export type PullRequestReviewThreadsInput = PullRequestDetailPageInput;
export type PullRequestTimelineInput = PullRequestDetailPageInput;
export type PullRequestLinkedIssuesInput = PullRequestDetailReadInput;

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

export interface PullRequestOverview extends PullRequestSummary {
  body: string | null;
  labels: LabelSummary[];
  assignees: AssignableUserSummary[];
  milestone: MilestoneSummary | null;
  requestedReviewers: AssignableUserSummary[];
  requestedTeams: PullRequestRequestedTeamSummary[];
  latestReviewState: string | null;
  reviewDecisionAvailability: GitHubReadAvailability;
}

export type PullRequestOverviewResult = GitHubNullableResult<"overview", PullRequestOverview>;
export type PullRequestCommentsResult = GitHubListResult<TimelineCommentSummary>;
export type PullRequestFilesResult = GitHubListResult<PullRequestFileSummary>;
export type PullRequestCommitsResult = GitHubListResult<PullRequestCommitSummary>;
export type PullRequestReviewsResult = GitHubListResult<PullRequestReviewSummary>;

export type PullRequestChecksResult = GitHubAvailabilityResult & {
  items: PullRequestCheckSummary[];
};

export type PullRequestReviewThreadsResult = GitHubListResult<PullRequestReviewThreadSummary> & {
  statesAvailability: GitHubReadAvailability;
};

export type PullRequestTimelineResult = GitHubListResult<PullRequestTimelineEventSummary>;

export type PullRequestLinkedIssuesResult = GitHubAvailabilityResult & {
  items: PullRequestLinkedIssueSummary[];
};

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

export interface DiscussionCategorySummary {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  isAnswerable: boolean | null;
}

export interface DiscussionListInput extends RepoDetailInput {
  limit?: number;
}

export interface DiscussionCategoryListInput extends RepoDetailInput {
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
  | "stale"
  | "offline"
  | "permission_denied"
  | "rate_limited"
  | "graphql_error"
  | "error";

export interface GitHubReadAvailability {
  status: GitHubReadAvailabilityStatus;
  message: string | null;
}

export type RepositoryLabelListResult = GitHubListResult<LabelSummary>;

export type AssignableUserListResult = GitHubListResult<AssignableUserSummary>;

export type RepositoryMilestoneListResult = GitHubListResult<MilestoneSummary>;

export type DiscussionListResult = GitHubListResult<DiscussionSummary>;

export type DiscussionCategoryListResult = GitHubListResult<DiscussionCategorySummary>;

export type RepoContentsResult = GitHubListResult<RepoEntry>;

export interface RepoFileContentResult {
  item: RepoFileContent | null;
  availability: GitHubReadAvailability;
}

export interface RepoTreeReadResult {
  tree: RepoTreeResult | null;
  availability: GitHubReadAvailability;
}

export type RepositoryCommitListResult = GitHubListResult<RepositoryCommitSummary>;

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

export type WorkflowRunListResult = GitHubListResult<WorkflowRunSummary>;

export interface WorkflowListInput extends RepoDetailInput {
  ref?: string | null;
  limit?: number;
}

export type WorkflowDispatchInputType = "string" | "boolean" | "choice" | "number" | "environment";

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

export type WorkflowDefinitionListResult = GitHubListResult<WorkflowDefinitionSummary>;

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
  items: ProjectItemSummary[];
  itemsTruncated: boolean;
  fieldsCount: number | null;
  fields: ProjectFieldSummary[];
  viewerCanUpdate: boolean | null;
  htmlUrl: string | null;
}

export interface ProjectItemSummary {
  id: string;
  type: string | null;
  contentId: string | null;
  contentType: string | null;
  title: string | null;
  body: string | null;
  number: number | null;
  state: string | null;
  repositoryNameWithOwner: string | null;
  htmlUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  fieldValues: ProjectItemFieldValueSummary[];
  fieldValuesTruncated: boolean;
}

export interface ProjectItemFieldValueSummary {
  id: string;
  fieldId: string | null;
  fieldName: string | null;
  dataType: string | null;
  value: string | number | null;
  optionId: string | null;
  optionName: string | null;
  options: ProjectFieldOptionSummary[];
  editable: boolean;
}

export interface ProjectFieldSummary {
  id: string;
  name: string;
  dataType: string | null;
  options: ProjectFieldOptionSummary[];
}

export interface ProjectFieldOptionSummary {
  id: string;
  name: string;
}

export interface ProjectsInput extends RepoDetailInput {
  limit?: number;
}

export type ProjectListResult = GitHubListResult<ProjectSummary>;

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

export type DependabotAlertsResult = GitHubListResult<DependabotAlertSummary>;

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

export type CodeScanningAlertsResult = GitHubListResult<CodeScanningAlertSummary>;

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

export type SecretScanningAlertsResult = GitHubListResult<SecretScanningAlertSummary>;

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
  bypassActors: RepositoryRulesetBypassActorSummary[];
  conditionCount: number | null;
  conditions: RepositoryRulesetConditionSummary[];
  ruleCount: number | null;
  rules: RepositoryRulesetRuleSummary[];
  currentUserCanBypass: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RepositoryRulesetBypassActorSummary {
  actorId: number | null;
  actorType: string | null;
  bypassMode: string | null;
}

export interface RepositoryRulesetConditionSummary {
  type: string;
  include: string[];
  exclude: string[];
  parameters: string[];
}

export interface RepositoryRulesetRuleSummary {
  type: string;
  parameters: string[];
}

export interface RepositoryRulesetsInput extends RepoDetailInput {
  includesParents?: boolean;
  limit?: number;
}

export type RepositoryRulesetsResult = GitHubListResult<RepositoryRulesetSummary>;

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

export type RepositorySecurityAdvisoriesResult = GitHubListResult<RepositorySecurityAdvisorySummary>;

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

export type ReleaseListResult = GitHubListResult<ReleaseSummary>;

export interface ReleaseDetailInput extends RepoDetailInput {
  releaseId?: number;
  releaseTagName?: string;
}

export interface ReleaseDetailResult {
  item: ReleaseSummary | null;
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

export type ContributorListResult = GitHubListResult<ContributorSummary>;

export interface RepositoryDetailResult {
  detail: RepositoryDetail | null;
  availability: GitHubReadAvailability;
}

export interface SearchInput {
  query: string;
  limit?: number;
}

export const githubActions = [
  "star",
  "unstar",
  "watch",
  "unwatch",
  "fork",
  "editRepository",
  "createIssue",
  "editIssue",
  "closeIssue",
  "reopenIssue",
  "addComment",
  "editComment",
  "deleteComment",
  "editReviewComment",
  "deleteReviewComment",
  "addLabels",
  "removeLabel",
  "setAssignees",
  "removeAssignees",
  "mergePullRequest",
  "createPullRequest",
  "closePullRequest",
  "reopenPullRequest",
  "approvePullRequest",
  "commentPullRequestReview",
  "requestChanges",
  "requestReviewers",
  "removeReviewers",
  "rerunWorkflow",
  "rerunFailedWorkflowJobs",
  "rerunWorkflowJob",
  "dispatchWorkflow",
  "cancelWorkflow",
  "createRelease",
  "editRelease",
  "deleteRelease",
  "deleteReleaseAsset",
  "updateBranchProtection",
  "deleteBranchProtection",
  "addRepositoryCollaborator",
  "removeRepositoryCollaborator",
  "updateCollaboratorPermission",
  "addRepositoryTeam",
  "removeRepositoryTeam",
  "updateTeamPermission",
  "createRepositoryRuleset",
  "updateRepositoryRuleset",
  "deleteRepositoryRuleset",
  "createDiscussion",
  "editDiscussion",
  "closeDiscussion",
  "reopenDiscussion",
  "addDiscussionComment",
  "editDiscussionComment",
  "deleteDiscussionComment",
  "createProjectV2",
  "updateProjectV2",
  "deleteProjectV2",
  "addProjectV2Item",
  "updateProjectV2Item",
  "deleteProjectV2Item",
  "createWikiPage",
  "editWikiPage",
  "deleteWikiPage"
] as const;

export type GitHubAction = (typeof githubActions)[number];

export interface GitHubMutationFields {
  description?: string | null;
  homepage?: string | null;
  default_branch?: string | null;
  archived?: boolean;
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  has_discussions?: boolean;
  allow_merge_commit?: boolean;
  allow_squash_merge?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  allow_update_branch?: boolean;
  allow_forking?: boolean;
  web_commit_signoff_required?: boolean;
  topics?: string[];
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
  issueNumber?: number;
  state?: string;
  stateReason?: string;
  commentId?: string | number;
  name?: string | null;
  head?: string;
  base?: string;
  draft?: boolean;
  maintainer_can_modify?: boolean;
  pullNumber?: number;
  commit_title?: string;
  commit_message?: string;
  merge_method?: string;
  sha?: string;
  reviewers?: string[];
  teamReviewers?: string[];
  runId?: number;
  jobId?: number;
  workflowId?: string;
  ref?: string;
  inputs?: JsonObject;
  tag_name?: string;
  target_commitish?: string;
  prerelease?: boolean;
  make_latest?: string;
  releaseId?: number;
  assetId?: number;
  branch?: string;
  required_status_checks?: JsonValue;
  enforce_admins?: boolean | null;
  required_pull_request_reviews?: JsonValue;
  restrictions?: JsonValue;
  required_linear_history?: boolean;
  allow_force_pushes?: boolean;
  allow_deletions?: boolean;
  block_creations?: boolean;
  required_conversation_resolution?: boolean;
  lock_branch?: boolean;
  allow_fork_syncing?: boolean;
  username?: string;
  permission?: string;
  teamSlug?: string;
  rulesetId?: number;
  target?: string;
  enforcement?: string;
  bypass_actors?: JsonValue[];
  conditions?: JsonObject;
  rules?: JsonValue[];
  categoryId?: string;
  discussionId?: string;
  projectId?: string;
  shortDescription?: string | null;
  readme?: string | null;
  contentId?: string;
  itemId?: string;
  fieldId?: string;
  value?: JsonValue;
  content?: string;
  pagePath?: string;
}

type GitHubMutationBase<TAction extends GitHubAction> = {
  action: TAction;
  owner: string;
  repo: string;
};

type MutationFields<TKey extends keyof GitHubMutationFields> = Pick<GitHubMutationFields, TKey>;
type RequiredMutationFields<TKey extends keyof GitHubMutationFields> = Required<
  Pick<GitHubMutationFields, TKey>
>;

type RepositoryToggleMutationInput = GitHubMutationBase<"star" | "unstar" | "watch" | "unwatch" | "fork">;

type RepositorySettingsMutationInput = GitHubMutationBase<"editRepository"> &
  MutationFields<
    | "description"
    | "homepage"
    | "default_branch"
    | "archived"
    | "has_issues"
    | "has_projects"
    | "has_wiki"
    | "has_discussions"
    | "allow_merge_commit"
    | "allow_squash_merge"
    | "allow_rebase_merge"
    | "allow_auto_merge"
    | "delete_branch_on_merge"
    | "allow_update_branch"
    | "allow_forking"
    | "web_commit_signoff_required"
    | "topics"
  >;

type IssueMutationInput =
  | (GitHubMutationBase<"createIssue"> &
      RequiredMutationFields<"title"> &
      MutationFields<"body" | "labels" | "assignees" | "milestone">)
  | (GitHubMutationBase<"editIssue"> &
      RequiredMutationFields<"issueNumber"> &
      MutationFields<"title" | "body" | "state" | "labels" | "assignees" | "milestone">)
  | (GitHubMutationBase<"closeIssue"> & RequiredMutationFields<"issueNumber"> & MutationFields<"stateReason">)
  | (GitHubMutationBase<"reopenIssue"> & RequiredMutationFields<"issueNumber">)
  | (GitHubMutationBase<"addComment"> & RequiredMutationFields<"issueNumber" | "body">)
  | (GitHubMutationBase<"editComment"> & RequiredMutationFields<"commentId" | "body">)
  | (GitHubMutationBase<"deleteComment"> & RequiredMutationFields<"commentId">)
  | (GitHubMutationBase<"addLabels"> & RequiredMutationFields<"issueNumber" | "labels">)
  | (GitHubMutationBase<"removeLabel"> & RequiredMutationFields<"issueNumber" | "name">)
  | (GitHubMutationBase<"setAssignees" | "removeAssignees"> &
      RequiredMutationFields<"issueNumber" | "assignees">);

type PullRequestMutationInput =
  | (GitHubMutationBase<"createPullRequest"> &
      RequiredMutationFields<"title" | "head" | "base"> &
      MutationFields<"body" | "draft" | "maintainer_can_modify">)
  | (GitHubMutationBase<"mergePullRequest"> &
      RequiredMutationFields<"pullNumber"> &
      MutationFields<"commit_title" | "commit_message" | "merge_method" | "sha">)
  | (GitHubMutationBase<"closePullRequest" | "reopenPullRequest"> & RequiredMutationFields<"pullNumber">)
  | (GitHubMutationBase<"approvePullRequest" | "commentPullRequestReview" | "requestChanges"> &
      RequiredMutationFields<"pullNumber"> &
      MutationFields<"body">)
  | (GitHubMutationBase<"requestReviewers" | "removeReviewers"> &
      RequiredMutationFields<"pullNumber"> &
      MutationFields<"reviewers" | "teamReviewers">)
  | (GitHubMutationBase<"editReviewComment"> & RequiredMutationFields<"commentId" | "body">)
  | (GitHubMutationBase<"deleteReviewComment"> & RequiredMutationFields<"commentId">);

type WorkflowMutationInput =
  | (GitHubMutationBase<"rerunWorkflow" | "rerunFailedWorkflowJobs" | "cancelWorkflow"> &
      RequiredMutationFields<"runId">)
  | (GitHubMutationBase<"rerunWorkflowJob"> & RequiredMutationFields<"jobId">)
  | (GitHubMutationBase<"dispatchWorkflow"> &
      RequiredMutationFields<"workflowId" | "ref"> &
      MutationFields<"inputs">);

type ReleaseMutationInput =
  | (GitHubMutationBase<"createRelease"> &
      RequiredMutationFields<"tag_name"> &
      MutationFields<"target_commitish" | "name" | "body" | "draft" | "prerelease" | "make_latest">)
  | (GitHubMutationBase<"editRelease"> &
      RequiredMutationFields<"releaseId"> &
      MutationFields<
        "tag_name" | "target_commitish" | "name" | "body" | "draft" | "prerelease" | "make_latest"
      >)
  | (GitHubMutationBase<"deleteRelease"> & RequiredMutationFields<"releaseId">)
  | (GitHubMutationBase<"deleteReleaseAsset"> & RequiredMutationFields<"assetId">);

type RepositoryAdministrationMutationInput =
  | (GitHubMutationBase<"updateBranchProtection"> &
      RequiredMutationFields<"branch"> &
      MutationFields<
        | "required_status_checks"
        | "enforce_admins"
        | "required_pull_request_reviews"
        | "restrictions"
        | "required_linear_history"
        | "allow_force_pushes"
        | "allow_deletions"
        | "block_creations"
        | "required_conversation_resolution"
        | "lock_branch"
        | "allow_fork_syncing"
      >)
  | (GitHubMutationBase<"deleteBranchProtection"> & RequiredMutationFields<"branch">)
  | (GitHubMutationBase<"addRepositoryCollaborator" | "updateCollaboratorPermission"> &
      RequiredMutationFields<"username"> &
      MutationFields<"permission">)
  | (GitHubMutationBase<"removeRepositoryCollaborator"> & RequiredMutationFields<"username">)
  | (GitHubMutationBase<"addRepositoryTeam" | "updateTeamPermission"> &
      RequiredMutationFields<"teamSlug"> &
      MutationFields<"permission">)
  | (GitHubMutationBase<"removeRepositoryTeam"> & RequiredMutationFields<"teamSlug">)
  | (GitHubMutationBase<"createRepositoryRuleset"> &
      RequiredMutationFields<"name" | "enforcement"> &
      MutationFields<"target" | "bypass_actors" | "conditions" | "rules">)
  | (GitHubMutationBase<"updateRepositoryRuleset"> &
      RequiredMutationFields<"rulesetId" | "name" | "enforcement"> &
      MutationFields<"target" | "bypass_actors" | "conditions" | "rules">)
  | (GitHubMutationBase<"deleteRepositoryRuleset"> & RequiredMutationFields<"rulesetId">);

type DiscussionMutationInput =
  | (GitHubMutationBase<"createDiscussion"> & RequiredMutationFields<"categoryId" | "title" | "body">)
  | (GitHubMutationBase<"editDiscussion"> & RequiredMutationFields<"discussionId" | "title" | "body">)
  | (GitHubMutationBase<"closeDiscussion" | "reopenDiscussion"> & RequiredMutationFields<"discussionId">)
  | (GitHubMutationBase<"addDiscussionComment"> & RequiredMutationFields<"discussionId" | "body">)
  | (GitHubMutationBase<"editDiscussionComment"> & RequiredMutationFields<"commentId" | "body">)
  | (GitHubMutationBase<"deleteDiscussionComment"> & RequiredMutationFields<"commentId">);

type ProjectMutationInput =
  | (GitHubMutationBase<"createProjectV2"> & RequiredMutationFields<"title">)
  | (GitHubMutationBase<"updateProjectV2"> &
      RequiredMutationFields<"projectId" | "title"> &
      MutationFields<"shortDescription" | "readme">)
  | (GitHubMutationBase<"deleteProjectV2"> & RequiredMutationFields<"projectId">)
  | (GitHubMutationBase<"addProjectV2Item"> & RequiredMutationFields<"projectId" | "contentId">)
  | (GitHubMutationBase<"updateProjectV2Item"> &
      RequiredMutationFields<"projectId" | "itemId" | "fieldId" | "value">)
  | (GitHubMutationBase<"deleteProjectV2Item"> & RequiredMutationFields<"projectId" | "itemId">);

type WikiMutationInput =
  | (GitHubMutationBase<"createWikiPage"> & RequiredMutationFields<"title" | "content">)
  | (GitHubMutationBase<"editWikiPage"> & RequiredMutationFields<"pagePath" | "content">)
  | (GitHubMutationBase<"deleteWikiPage"> & RequiredMutationFields<"pagePath">);

export type GitHubMutationInput =
  | RepositoryToggleMutationInput
  | RepositorySettingsMutationInput
  | IssueMutationInput
  | PullRequestMutationInput
  | WorkflowMutationInput
  | ReleaseMutationInput
  | RepositoryAdministrationMutationInput
  | DiscussionMutationInput
  | ProjectMutationInput
  | WikiMutationInput;

export interface GitHubMutationResult {
  ok: boolean;
  action: GitHubAction;
  message: string;
  data?: JsonValue;
}

export interface GitHubProvider {
  getViewer(): Promise<Viewer>;
  getAccountProfileWithStatus(input?: AccountProfileInput): Promise<AccountProfileResult>;
  listRepositoriesWithStatus(input: RepoListInput): Promise<RepositoryListResult>;
  listAccountRepositoriesWithStatus(input: AccountRepositoryInput): Promise<AccountRepositoryListResult>;
  listAccountContributionsWithStatus(
    input?: AccountContributionListInput
  ): Promise<AccountContributionListResult>;
  listOrganizationsWithStatus(input?: OrganizationListInput): Promise<OrganizationListResult>;
  listOrganizationTeamsWithStatus(input: OrganizationTeamsInput): Promise<OrganizationTeamsResult>;
  listOrganizationRepositoriesWithStatus(
    input: OrganizationRepositoriesInput
  ): Promise<OrganizationRepositoriesResult>;
  listOrganizationTeamRepositoriesWithStatus(
    input: OrganizationTeamRepositoriesInput
  ): Promise<OrganizationTeamRepositoriesResult>;
  listOrganizationTeamMembersWithStatus(
    input: OrganizationTeamMembersInput
  ): Promise<OrganizationTeamMembersResult>;
  listOrganizationMembersWithStatus(input: OrganizationMembersInput): Promise<OrganizationMembersResult>;
  listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult>;
  listAccountIssuesWithStatus(input?: AccountIssueListInput): Promise<AccountIssueListResult>;
  listAccountPullRequestsWithStatus(
    input?: AccountPullRequestListInput
  ): Promise<AccountPullRequestListResult>;
  listNotificationsWithStatus(input?: NotificationListInput): Promise<NotificationListResult>;
  markNotificationThreadRead(input: NotificationThreadInput): Promise<NotificationThreadMutationResult>;
  unsubscribeNotificationThread(input: NotificationThreadInput): Promise<NotificationThreadMutationResult>;
  getRepositoryWithStatus(owner: string, repo: string): Promise<RepositoryDetailResult>;
  listRepositoryForks(input: RepositoryForksInput): Promise<RepositoryForksResult>;
  listBranchesWithStatus(input: BranchListInput): Promise<BranchListResult>;
  listTagsWithStatus(input: TagListInput): Promise<TagListResult>;
  listTreeWithStatus(input: RepoTreeInput): Promise<RepoTreeReadResult>;
  getReadme(input: RepoReadmeInput): Promise<RepoReadmeResult>;
  listContentsWithStatus(input: RepoContentsInput): Promise<RepoContentsResult>;
  getFileContentWithStatus(input: RepoFileContentInput): Promise<RepoFileContentResult>;
  getFileBlame(input: RepoFileBlameInput): Promise<RepoFileBlameResult>;
  getRepositoryWiki(input: RepositoryWikiInput): Promise<RepositoryWikiResult>;
  listCommitsWithStatus(input: RepositoryCommitListInput): Promise<RepositoryCommitListResult>;
  listLabelsWithStatus(input: RepositoryLabelListInput): Promise<RepositoryLabelListResult>;
  listAssignableUsersWithStatus(input: AssignableUserListInput): Promise<AssignableUserListResult>;
  getRepositoryAccess(input: RepositoryAccessInput): Promise<RepositoryAccessResult>;
  listMilestonesWithStatus(input: RepositoryMilestoneListInput): Promise<RepositoryMilestoneListResult>;
  listIssuesWithStatus(input: IssueListInput): Promise<IssueListResult>;
  getIssueDetailWithStatus(input: IssueDetailInput): Promise<IssueDetailResult>;
  listPullRequestsWithStatus(input: PullRequestListInput): Promise<PullRequestListResult>;
  getPullRequestDetailWithStatus(input: PullRequestDetailInput): Promise<PullRequestDetailResult>;
  getPullRequestOverviewWithStatus(input: PullRequestOverviewInput): Promise<PullRequestOverviewResult>;
  listPullRequestCommentsWithStatus(input: PullRequestCommentsInput): Promise<PullRequestCommentsResult>;
  listPullRequestFilesWithStatus(input: PullRequestFilesInput): Promise<PullRequestFilesResult>;
  listPullRequestCommitsWithStatus(input: PullRequestCommitsInput): Promise<PullRequestCommitsResult>;
  listPullRequestReviewsWithStatus(input: PullRequestReviewsInput): Promise<PullRequestReviewsResult>;
  listPullRequestChecksWithStatus(input: PullRequestChecksInput): Promise<PullRequestChecksResult>;
  listPullRequestReviewThreadsWithStatus(
    input: PullRequestReviewThreadsInput
  ): Promise<PullRequestReviewThreadsResult>;
  listPullRequestTimelineWithStatus(input: PullRequestTimelineInput): Promise<PullRequestTimelineResult>;
  listPullRequestLinkedIssuesWithStatus(
    input: PullRequestLinkedIssuesInput
  ): Promise<PullRequestLinkedIssuesResult>;
  listDiscussionsWithStatus(input: DiscussionListInput): Promise<DiscussionListResult>;
  listDiscussionCategoriesWithStatus(
    input: DiscussionCategoryListInput
  ): Promise<DiscussionCategoryListResult>;
  getDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetailResult>;
  listActionsWithStatus(input: ActionsInput): Promise<WorkflowRunListResult>;
  listWorkflowsWithStatus(input: WorkflowListInput): Promise<WorkflowDefinitionListResult>;
  getWorkflowRunDetailWithStatus(input: WorkflowRunDetailInput): Promise<WorkflowRunDetailResult>;
  getWorkflowJobLogs(input: WorkflowJobLogsInput): Promise<WorkflowJobLogsResult>;
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
  getRepositoryCommunityProfile(
    input: RepositoryCommunityProfileInput
  ): Promise<RepositoryCommunityProfileResult>;
  listReleasesWithStatus(input: ReleasesInput): Promise<ReleaseListResult>;
  getReleaseDetailWithStatus(input: ReleaseDetailInput): Promise<ReleaseDetailResult>;
  listContributorsWithStatus(input: ContributorsInput): Promise<ContributorListResult>;
  searchWithStatus(input: SearchInput): Promise<RepositorySearchResult>;
  mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult>;
}
