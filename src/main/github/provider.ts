import type {
  AccountIssueListInput,
  AccountProfileInput,
  AccountPullRequestListInput,
  AccountRepositoryInput,
  ActionsInput,
  ContributorSummary,
  DiscussionListInput,
  DiscussionSummary,
  GitHubAccountProfile,
  GitHubMutationInput,
  GitHubMutationResult,
  GitHubProvider,
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
} from "@shared/github";
import { GhCliProvider, getGhStatus } from "./ghCli";
import { getGitHubAppToken } from "./oauth";
import type { LocalStore } from "../storage";

export class GitHubProviderManager implements GitHubProvider {
  constructor(private readonly store: LocalStore) {}

  async getViewer(): Promise<Viewer> {
    const viewer = await this.provider().getViewer();
    this.store.saveAccount("github", viewer.login, viewer);
    return viewer;
  }

  async getAccountProfile(input: AccountProfileInput = {}): Promise<GitHubAccountProfile> {
    const profile = await this.withCache(`account-profile:${input.login ?? "viewer"}`, 60_000, () =>
      this.provider().getAccountProfile(input)
    );
    this.store.saveAccount("github", profile.login, profile);
    return profile;
  }

  async listRepositories(input: RepoListInput): Promise<RepositorySummary[]> {
    return this.withCache(`repositories:${input.limit ?? 50}`, 60_000, () =>
      this.provider().listRepositories(input)
    );
  }

  async listAccountRepositories(input: AccountRepositoryInput = {}): Promise<RepositorySummary[]> {
    const key = `account-repositories:${input.login ?? "viewer"}:${input.limit ?? 50}`;
    return this.withCache(key, 60_000, () => this.provider().listAccountRepositories(input));
  }

  async listAccountIssues(input: AccountIssueListInput = {}): Promise<IssueSummary[]> {
    const key = `account-issues:${input.login ?? "viewer"}:${input.state ?? "open"}:${input.limit ?? 30}`;
    return this.withCache(key, 30_000, () => this.provider().listAccountIssues(input));
  }

  async listAccountPullRequests(input: AccountPullRequestListInput = {}): Promise<PullRequestSummary[]> {
    const key = `account-pulls:${input.login ?? "viewer"}:${input.state ?? "open"}:${input.limit ?? 30}`;
    return this.withCache(key, 30_000, () => this.provider().listAccountPullRequests(input));
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    const repository = await this.withCache(`repository:${owner}/${repo}`, 60_000, () =>
      this.provider().getRepository(owner, repo)
    );
    this.store.addRecentItem("repository", "github", `${owner}/${repo}`, repository);
    return repository;
  }

  async listContents(input: RepoContentsInput): Promise<RepoEntry[]> {
    const key = `contents:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path ?? ""}`;
    return this.withCache(key, 30_000, () => this.provider().listContents(input));
  }

  async listIssues(input: IssueListInput): Promise<IssueSummary[]> {
    return this.withCache(`issues:${input.owner}/${input.repo}:${input.state ?? "open"}`, 30_000, () =>
      this.provider().listIssues(input)
    );
  }

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]> {
    return this.withCache(`pulls:${input.owner}/${input.repo}:${input.state ?? "open"}`, 30_000, () =>
      this.provider().listPullRequests(input)
    );
  }

  async listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    return this.withCache(`discussions:${input.owner}/${input.repo}:${input.limit ?? 30}`, 45_000, () =>
      this.provider().listDiscussions(input)
    );
  }

  async listActions(input: ActionsInput): Promise<WorkflowRunSummary[]> {
    return this.withCache(`actions:${input.owner}/${input.repo}:${input.limit ?? 30}`, 20_000, () =>
      this.provider().listActions(input)
    );
  }

  async listProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    return this.withCache(`projects:${input.owner}/${input.repo}:${input.limit ?? 20}`, 60_000, () =>
      this.provider().listProjects(input)
    );
  }

  async listReleases(input: ReleasesInput): Promise<ReleaseSummary[]> {
    return this.withCache(`releases:${input.owner}/${input.repo}:${input.limit ?? 20}`, 60_000, () =>
      this.provider().listReleases(input)
    );
  }

  async listContributors(input: RepoDetailInput): Promise<ContributorSummary[]> {
    return this.withCache(`contributors:${input.owner}/${input.repo}`, 120_000, () =>
      this.provider().listContributors(input)
    );
  }

  async search(input: SearchInput): Promise<RepositorySummary[]> {
    return this.provider().search(input);
  }

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult> {
    const result = await this.provider().mutate<TInput, TResult>(input);
    return result;
  }

  private provider(): GitHubProvider {
    const settings = this.store.getSettings();

    if (settings.credentialProvider === "github-app") {
      return new GitHubAppProvider(settings.githubAppClientId);
    }

    const ghPath = settings.ghPath ?? process.env.CONTROL_GH_PATH ?? "gh";
    return new GhCliProvider(ghPath);
  }

  private async withCache<T>(cacheKey: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const cached = this.store.getCache<T>("github", cacheKey);
    if (cached) {
      return cached;
    }

    const payload = await load();
    this.store.setCache({
      provider: "github",
      cacheKey,
      payload,
      etag: null,
      expiresAt: new Date(Date.now() + ttlMs).toISOString()
    });
    return payload;
  }
}

class GitHubAppProvider implements GitHubProvider {
  constructor(private readonly clientId: string | null) {}

  async getViewer(): Promise<Viewer> {
    return this.unavailable();
  }

  async getAccountProfile(): Promise<GitHubAccountProfile> {
    return this.unavailable();
  }

  async listRepositories(): Promise<RepositorySummary[]> {
    return this.unavailable();
  }

  async listAccountRepositories(): Promise<RepositorySummary[]> {
    return this.unavailable();
  }

  async listAccountIssues(): Promise<IssueSummary[]> {
    return this.unavailable();
  }

  async listAccountPullRequests(): Promise<PullRequestSummary[]> {
    return this.unavailable();
  }

  async getRepository(): Promise<RepositoryDetail> {
    return this.unavailable();
  }

  async listContents(): Promise<RepoEntry[]> {
    return this.unavailable();
  }

  async listIssues(): Promise<IssueSummary[]> {
    return this.unavailable();
  }

  async listPullRequests(): Promise<PullRequestSummary[]> {
    return this.unavailable();
  }

  async listDiscussions(): Promise<DiscussionSummary[]> {
    return this.unavailable();
  }

  async listActions(): Promise<WorkflowRunSummary[]> {
    return this.unavailable();
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return this.unavailable();
  }

  async listReleases(): Promise<ReleaseSummary[]> {
    return this.unavailable();
  }

  async listContributors(): Promise<ContributorSummary[]> {
    return this.unavailable();
  }

  async search(): Promise<RepositorySummary[]> {
    return this.unavailable();
  }

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    _input: TInput
  ): Promise<TResult> {
    return this.unavailable();
  }

  private async assertConfigured(): Promise<void> {
    if (!this.clientId) {
      throw new Error("GitHub App OAuth is selected, but no GitHub App client ID is configured.");
    }

    const token = await getGitHubAppToken(this.clientId);
    if (!token) {
      throw new Error("GitHub App OAuth token is not connected yet. Use GitHub CLI or complete OAuth setup.");
    }
  }

  private async unavailable<T>(): Promise<T> {
    await this.assertConfigured();
    throw new Error(
      "GitHub App OAuth execution is not enabled in V1 yet. Switch Settings back to GitHub CLI."
    );
  }
}

export async function createAppState(store: LocalStore) {
  const settings = store.getSettings();
  const gh = await getGhStatus(settings.ghPath);
  let viewer: Viewer | null = null;

  if (settings.credentialProvider === "gh-cli" && gh.authenticated && gh.path) {
    try {
      viewer = await new GhCliProvider(gh.path).getViewer();
      store.saveAccount("github", viewer.login, viewer);
    } catch {
      viewer = null;
    }
  }

  return {
    platform: process.platform,
    isMac: process.platform === "darwin",
    settings,
    gh,
    viewer
  };
}
