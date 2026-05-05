import type {
  AccountIssueListInput,
  AccountProfileInput,
  AccountPullRequestListInput,
  AccountRepositoryInput,
  ActionsInput,
  AppState,
  ContributorSummary,
  ControlSettings,
  DiscussionListInput,
  DiscussionSummary,
  GitHubAccountProfile,
  GitHubSignInSession,
  GitHubMutationInput,
  GitHubMutationResult,
  IssueDetail,
  IssueDetailInput,
  IssueListInput,
  IssueSummary,
  ProjectSummary,
  ProjectsInput,
  PullRequestDetail,
  PullRequestDetailInput,
  PullRequestListInput,
  PullRequestSummary,
  ReleaseSummary,
  ReleasesInput,
  RepoContentsInput,
  RepoDetailInput,
  RepoEntry,
  RepoFileContent,
  RepoFileContentInput,
  RepoListInput,
  RepositoryDetail,
  RepositorySummary,
  SearchInput,
  Viewer,
  WorkflowRunSummary
} from "./github";

export interface ControlApi {
  getAppState(): Promise<AppState>;
  getSettings(): Promise<ControlSettings>;
  updateSettings(settings: Partial<ControlSettings>): Promise<ControlSettings>;
  signInWithGitHub(): Promise<GitHubSignInSession>;
  getGitHubSignIn(): Promise<GitHubSignInSession | null>;
  cancelGitHubSignIn(): Promise<void>;
  clearGitHubToken(): Promise<AppState>;
  openExternal(url: string): Promise<void>;
  onGitHubRepositoriesUpdated(callback: (event: GitHubRepositoriesUpdatedEvent) => void): () => void;
  github: {
    getViewer(): Promise<Viewer>;
    getAccountProfile(input?: AccountProfileInput): Promise<GitHubAccountProfile>;
    listRepositories(input?: RepoListInput): Promise<RepositorySummary[]>;
    listAccountRepositories(input?: AccountRepositoryInput): Promise<RepositorySummary[]>;
    listAccountIssues(input?: AccountIssueListInput): Promise<IssueSummary[]>;
    listAccountPullRequests(input?: AccountPullRequestListInput): Promise<PullRequestSummary[]>;
    getRepository(input: RepoDetailInput): Promise<RepositoryDetail>;
    getReadme(input: RepoDetailInput): Promise<string | null>;
    listContents(input: RepoContentsInput): Promise<RepoEntry[]>;
    getFileContent(input: RepoFileContentInput): Promise<RepoFileContent>;
    listIssues(input: IssueListInput): Promise<IssueSummary[]>;
    getIssueDetail(input: IssueDetailInput): Promise<IssueDetail>;
    listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]>;
    getPullRequestDetail(input: PullRequestDetailInput): Promise<PullRequestDetail>;
    listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]>;
    listActions(input: ActionsInput): Promise<WorkflowRunSummary[]>;
    listProjects(input: ProjectsInput): Promise<ProjectSummary[]>;
    listReleases(input: ReleasesInput): Promise<ReleaseSummary[]>;
    listContributors(input: RepoDetailInput): Promise<ContributorSummary[]>;
    search(input: SearchInput): Promise<RepositorySummary[]>;
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
  githubRepositoriesUpdated: "github:repositories-updated",
  githubViewer: "github:viewer",
  githubAccountProfile: "github:account-profile",
  githubRepositories: "github:repositories",
  githubAccountRepositories: "github:account-repositories",
  githubAccountIssues: "github:account-issues",
  githubAccountPullRequests: "github:account-pull-requests",
  githubRepository: "github:repository",
  githubReadme: "github:readme",
  githubContents: "github:contents",
  githubFileContent: "github:file-content",
  githubIssues: "github:issues",
  githubIssueDetail: "github:issue-detail",
  githubPullRequests: "github:pull-requests",
  githubPullRequestDetail: "github:pull-request-detail",
  githubDiscussions: "github:discussions",
  githubActions: "github:actions",
  githubProjects: "github:projects",
  githubReleases: "github:releases",
  githubContributors: "github:contributors",
  githubSearch: "github:search",
  githubMutate: "github:mutate"
} as const;

declare global {
  interface Window {
    control?: ControlApi;
  }
}
