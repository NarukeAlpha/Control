import type {
  ActionsInput,
  AppState,
  ContributorSummary,
  ControlSettings,
  DiscussionListInput,
  DiscussionSummary,
  GitHubMutationInput,
  GitHubMutationResult,
  IssueListInput,
  IssueSummary,
  ProjectSummary,
  ProjectsInput,
  PullRequestListInput,
  PullRequestSummary,
  ReleaseSummary,
  ReleasesInput,
  RepoContentsInput,
  RepoDetailInput,
  RepoEntry,
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
  openExternal(url: string): Promise<void>;
  github: {
    getViewer(): Promise<Viewer>;
    listRepositories(input?: RepoListInput): Promise<RepositorySummary[]>;
    getRepository(input: RepoDetailInput): Promise<RepositoryDetail>;
    listContents(input: RepoContentsInput): Promise<RepoEntry[]>;
    listIssues(input: IssueListInput): Promise<IssueSummary[]>;
    listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]>;
    listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]>;
    listActions(input: ActionsInput): Promise<WorkflowRunSummary[]>;
    listProjects(input: ProjectsInput): Promise<ProjectSummary[]>;
    listReleases(input: ReleasesInput): Promise<ReleaseSummary[]>;
    listContributors(input: RepoDetailInput): Promise<ContributorSummary[]>;
    search(input: SearchInput): Promise<RepositorySummary[]>;
    mutate(input: GitHubMutationInput): Promise<GitHubMutationResult>;
  };
}

export const ipcChannels = {
  appState: "control:app-state",
  getSettings: "control:get-settings",
  updateSettings: "control:update-settings",
  openExternal: "control:open-external",
  githubViewer: "github:viewer",
  githubRepositories: "github:repositories",
  githubRepository: "github:repository",
  githubContents: "github:contents",
  githubIssues: "github:issues",
  githubPullRequests: "github:pull-requests",
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

