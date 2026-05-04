export type CodeHost = "github";

export type CredentialProvider = "gh-cli" | "github-app";

export type GlassMode = "glass-shell" | "reduced" | "solid";

export interface ControlSettings {
  credentialProvider: CredentialProvider;
  ghPath: string | null;
  githubAppClientId: string | null;
  glassMode: GlassMode;
}

export interface GhStatus {
  available: boolean;
  authenticated: boolean;
  path: string | null;
  user: string | null;
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
  gh: GhStatus;
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
}

export interface RepoListInput {
  limit?: number;
}

export interface AccountProfileInput {
  login?: string | null;
}

export interface AccountRepositoryInput {
  login?: string | null;
  limit?: number;
}

export interface AccountIssueListInput {
  login?: string | null;
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface AccountPullRequestListInput {
  login?: string | null;
  state?: "open" | "closed" | "all";
  limit?: number;
}

export interface RepoDetailInput {
  owner: string;
  repo: string;
}

export interface RepoContentsInput {
  owner: string;
  repo: string;
  path?: string;
  ref?: string | null;
}

export interface RepoEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  sha: string;
  size: number | null;
  htmlUrl: string | null;
  downloadUrl: string | null;
  lastCommitMessage: string | null;
  lastCommitDate: string | null;
}

export interface LabelSummary {
  id: number | string;
  name: string;
  color: string;
}

export interface IssueSummary {
  id: number | string;
  number: number;
  title: string;
  state: string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  comments: number;
  labels: LabelSummary[];
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  repositoryNameWithOwner?: string | null;
}

export interface IssueListInput extends RepoDetailInput {
  state?: "open" | "closed" | "all";
}

export interface PullRequestSummary {
  id: number | string;
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  comments: number;
  reviewComments: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeableState: string | null;
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  repositoryNameWithOwner?: string | null;
}

export interface PullRequestListInput extends RepoDetailInput {
  state?: "open" | "closed" | "all";
}

export interface DiscussionSummary {
  id: string;
  number: number;
  title: string;
  authorLogin: string | null;
  category: string | null;
  comments: number;
  updatedAt: string;
  htmlUrl: string;
}

export interface DiscussionListInput extends RepoDetailInput {
  limit?: number;
}

export interface WorkflowRunSummary {
  id: number;
  name: string;
  event: string;
  status: string | null;
  conclusion: string | null;
  branch: string | null;
  commitSha: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface ActionsInput extends RepoDetailInput {
  limit?: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  closed: boolean;
  updatedAt: string | null;
  htmlUrl: string | null;
}

export interface ProjectsInput extends RepoDetailInput {
  limit?: number;
}

export interface ReleaseSummary {
  id: number;
  name: string | null;
  tagName: string;
  isDraft: boolean;
  isPrerelease: boolean;
  publishedAt: string | null;
  htmlUrl: string;
}

export interface ReleasesInput extends RepoDetailInput {
  limit?: number;
}

export interface ContributorSummary {
  id: number;
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  contributions: number;
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
  | "createIssue"
  | "editIssue"
  | "closeIssue"
  | "reopenIssue"
  | "addComment"
  | "editComment"
  | "deleteComment"
  | "addLabels"
  | "setAssignees"
  | "mergePullRequest"
  | "closePullRequest"
  | "reopenPullRequest"
  | "approvePullRequest"
  | "requestChanges"
  | "rerunWorkflow"
  | "cancelWorkflow"
  | "createRelease"
  | "editRelease"
  | "deleteRelease";

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
  listRepositories(input: RepoListInput): Promise<RepositorySummary[]>;
  listAccountRepositories(input: AccountRepositoryInput): Promise<RepositorySummary[]>;
  listAccountIssues(input: AccountIssueListInput): Promise<IssueSummary[]>;
  listAccountPullRequests(input: AccountPullRequestListInput): Promise<PullRequestSummary[]>;
  getRepository(owner: string, repo: string): Promise<RepositoryDetail>;
  listContents(input: RepoContentsInput): Promise<RepoEntry[]>;
  listIssues(input: IssueListInput): Promise<IssueSummary[]>;
  listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]>;
  listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]>;
  listActions(input: ActionsInput): Promise<WorkflowRunSummary[]>;
  listProjects(input: ProjectsInput): Promise<ProjectSummary[]>;
  listReleases(input: ReleasesInput): Promise<ReleaseSummary[]>;
  listContributors(input: RepoDetailInput): Promise<ContributorSummary[]>;
  search(input: SearchInput): Promise<RepositorySummary[]>;
  mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult>;
}
