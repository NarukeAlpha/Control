import type {
  AccountIssueListInput,
  AccountProfileInput,
  AccountPullRequestListInput,
  AccountRepositoryInput,
  ActionsInput,
  AppState,
  ContributorSummary,
  DiscussionListInput,
  DiscussionSummary,
  GitHubAccountProfile,
  GitHubAuthStatus,
  GitHubSignInSession,
  GitHubMutationInput,
  GitHubMutationResult,
  GitHubProvider,
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
} from "@shared/github";
import {
  clearGitHubToken,
  getGitHubToken,
  setGitHubToken
} from "./credentials";
import { OctokitProvider, validateGitHubToken } from "./octokitProvider";
import {
  pollGitHubDeviceAuthorization,
  requestGitHubDeviceAuthorization
} from "./webOAuth";
import type { LocalStore } from "../storage";

const githubOAuthClientIdEnvironmentVariable = "CONTROL_GITHUB_CLIENT_ID";
const defaultGitHubOAuthClientId = "Ov23ctnQ2BrIJraiNh0c";

type RepositoryUpdateListener = (nameWithOwner: string | null) => void;
type OpenExternalUrl = (url: string) => Promise<void>;

interface DeviceSignInRecord {
  clientId: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalMs: number;
  status: GitHubSignInSession["status"];
  error: string | null;
  pollTimeout: NodeJS.Timeout | null;
}

export class GitHubProviderManager implements GitHubProvider {
  private providerPromise: Promise<GitHubProvider> | null = null;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private deviceSignIn: DeviceSignInRecord | null = null;

  constructor(
    private readonly store: LocalStore,
    private readonly onRepositoryDataUpdated: RepositoryUpdateListener = () => undefined
  ) {}

  async signInWithBrowser(openAuthorizeUrl: OpenExternalUrl): Promise<GitHubSignInSession> {
    if (this.deviceSignIn?.status === "pending") {
      await openAuthorizeUrl(this.deviceSignIn.verificationUri);
      return this.getGitHubSignInState()!;
    }

    const config = this.resolveOAuthConfig();
    const request = await requestGitHubDeviceAuthorization(config.clientId);
    this.clearDeviceSignIn();
    this.deviceSignIn = {
      clientId: config.clientId,
      deviceCode: request.deviceCode,
      userCode: request.userCode,
      verificationUri: request.verificationUri,
      expiresAt: request.expiresAt,
      intervalMs: request.intervalSeconds * 1000,
      status: "pending",
      error: null,
      pollTimeout: null
    };

    this.store.updateSettings({ credentialProvider: "github-oauth" });

    try {
      await openAuthorizeUrl(request.verificationUri);
    } catch (error) {
      this.clearDeviceSignIn();
      throw error instanceof Error ? error : new Error("Could not open GitHub sign-in.");
    }

    this.scheduleDeviceSignInPoll(this.deviceSignIn);
    return this.getGitHubSignInState()!;
  }

  getGitHubSignInState(): GitHubSignInSession | null {
    if (!this.deviceSignIn) {
      return null;
    }

    return {
      status: this.deviceSignIn.status,
      userCode: this.deviceSignIn.userCode,
      verificationUri: this.deviceSignIn.verificationUri,
      expiresAt: this.deviceSignIn.expiresAt,
      error: this.deviceSignIn.error
    };
  }

  cancelWebSignIn(): void {
    if (!this.deviceSignIn) {
      return;
    }

    if (this.deviceSignIn.pollTimeout) {
      clearTimeout(this.deviceSignIn.pollTimeout);
    }

    this.deviceSignIn = {
      ...this.deviceSignIn,
      status: "cancelled",
      error: "GitHub sign-in was cancelled.",
      pollTimeout: null
    };
  }

  async saveToken(token: string): Promise<Viewer> {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new Error("GitHub credential cannot be empty.");
    }

    const viewer = await validateGitHubToken(trimmed);
    await setGitHubToken(trimmed);
    this.providerPromise = Promise.resolve(new OctokitProvider(trimmed));
    this.store.saveAccount("github", viewer.login, viewer);
    this.store.updateSettings({ credentialProvider: "github-oauth" });
    return viewer;
  }

  async clearToken(): Promise<void> {
    await clearGitHubToken();
    this.providerPromise = null;
    this.clearDeviceSignIn();
  }

  async getViewer(): Promise<Viewer> {
    const viewer = await (await this.provider()).getViewer();
    this.store.saveAccount("github", viewer.login, viewer);
    return viewer;
  }

  async getAccountProfile(input: AccountProfileInput = {}): Promise<GitHubAccountProfile> {
    const profile = await this.withCache(`account-profile:${input.login ?? "viewer"}`, 60_000, async () =>
      (await this.provider()).getAccountProfile(input)
    );
    this.store.saveAccount("github", profile.login, profile);
    return profile;
  }

  async listRepositories(input: RepoListInput): Promise<RepositorySummary[]> {
    const limit = input.limit ?? 50;
    const cached = this.store.listGitHubRepositories(limit);

    if (cached.length > 0) {
      this.refreshInBackground(() => this.refreshRepositories(input));
      return cached;
    }

    return this.refreshRepositories(input);
  }

  async listAccountRepositories(input: AccountRepositoryInput = {}): Promise<RepositorySummary[]> {
    if (!input.login) {
      return this.listRepositories({ limit: input.limit });
    }

    const key = `account-repositories:${input.login}:${input.limit ?? 50}`;
    const repositories = await this.withCache(key, 60_000, async () =>
      (await this.provider()).listAccountRepositories(input)
    );
    repositories.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
    this.onRepositoryDataUpdated(null);
    return repositories;
  }

  async listAccountIssues(input: AccountIssueListInput = {}): Promise<IssueSummary[]> {
    const key = `account-issues:${input.login ?? "viewer"}:${input.state ?? "open"}:${input.limit ?? 30}`;
    return this.withCache(key, 30_000, async () => (await this.provider()).listAccountIssues(input));
  }

  async listAccountPullRequests(input: AccountPullRequestListInput = {}): Promise<PullRequestSummary[]> {
    const key = `account-pulls:${input.login ?? "viewer"}:${input.state ?? "open"}:${input.limit ?? 30}`;
    return this.withCache(key, 30_000, async () =>
      (await this.provider()).listAccountPullRequests(input)
    );
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    const id = `${owner}/${repo}`;
    const cachedDetail = this.store.getGitHubRepositoryDetail(id);

    if (cachedDetail) {
      this.refreshInBackground(() => this.refreshRepository(owner, repo));
      this.store.addRecentItem("repository", "github", id, cachedDetail);
      return cachedDetail;
    }

    const cachedSummary = this.store.getGitHubRepository(id);
    if (cachedSummary) {
      this.refreshInBackground(() => this.refreshRepository(owner, repo));
      const detail = repositoryDetailFromSummary(cachedSummary);
      this.store.addRecentItem("repository", "github", id, detail);
      return detail;
    }

    const detail = await this.refreshRepository(owner, repo);
    this.store.addRecentItem("repository", "github", id, detail);
    return detail;
  }

  async getReadme(input: RepoDetailInput): Promise<string | null> {
    const id = `${input.owner}/${input.repo}`;
    const cached = this.store.getGitHubRepositoryReadme(id);

    if (cached !== null) {
      this.refreshInBackground(() => this.refreshReadme(input));
      return cached;
    }

    return this.refreshReadme(input);
  }

  async listContents(input: RepoContentsInput): Promise<RepoEntry[]> {
    const key = `contents:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path ?? ""}`;
    return this.withCache(key, 30_000, async () => (await this.provider()).listContents(input));
  }

  async getFileContent(input: RepoFileContentInput): Promise<RepoFileContent> {
    const key = `file-content:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path}`;
    return this.withCache(key, 120_000, async () => (await this.provider()).getFileContent(input));
  }

  async listIssues(input: IssueListInput): Promise<IssueSummary[]> {
    return this.withCache(`issues:${input.owner}/${input.repo}:${input.state ?? "open"}`, 30_000, async () =>
      (await this.provider()).listIssues(input)
    );
  }

  async getIssueDetail(input: IssueDetailInput): Promise<IssueDetail> {
    const key = `issue-detail:${input.owner}/${input.repo}:${input.issueNumber}`;
    return this.withCache(key, 30_000, async () => (await this.provider()).getIssueDetail(input));
  }

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]> {
    return this.withCache(`pulls:${input.owner}/${input.repo}:${input.state ?? "open"}`, 30_000, async () =>
      (await this.provider()).listPullRequests(input)
    );
  }

  async getPullRequestDetail(input: PullRequestDetailInput): Promise<PullRequestDetail> {
    const key = `pull-detail:${input.owner}/${input.repo}:${input.pullNumber}`;
    return this.withCache(key, 30_000, async () => (await this.provider()).getPullRequestDetail(input));
  }

  async listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    return this.withCache(`discussions:${input.owner}/${input.repo}:${input.limit ?? 30}`, 45_000, async () =>
      (await this.provider()).listDiscussions(input)
    );
  }

  async listActions(input: ActionsInput): Promise<WorkflowRunSummary[]> {
    return this.withCache(`actions:${input.owner}/${input.repo}:${input.limit ?? 30}`, 20_000, async () =>
      (await this.provider()).listActions(input)
    );
  }

  async listProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    return this.withCache(`projects:${input.owner}/${input.repo}:${input.limit ?? 20}`, 60_000, async () =>
      (await this.provider()).listProjects(input)
    );
  }

  async listReleases(input: ReleasesInput): Promise<ReleaseSummary[]> {
    return this.withCache(`releases:${input.owner}/${input.repo}:${input.limit ?? 20}`, 60_000, async () =>
      (await this.provider()).listReleases(input)
    );
  }

  async listContributors(input: RepoDetailInput): Promise<ContributorSummary[]> {
    return this.withCache(`contributors:${input.owner}/${input.repo}`, 120_000, async () =>
      (await this.provider()).listContributors(input)
    );
  }

  async search(input: SearchInput): Promise<RepositorySummary[]> {
    const repositories = await (await this.provider()).search(input);
    repositories.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
    this.onRepositoryDataUpdated(null);
    return repositories;
  }

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult> {
    return (await this.provider()).mutate<TInput, TResult>(input);
  }

  private async refreshRepositories(input: RepoListInput): Promise<RepositorySummary[]> {
    const key = `refresh-repositories:${input.limit ?? 50}`;
    return this.dedupe(key, async () => {
      const repositories = await (await this.provider()).listRepositories(input);
      repositories.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
      this.onRepositoryDataUpdated(null);
      return repositories;
    });
  }

  private async refreshRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    const key = `refresh-repository:${owner}/${repo}`;
    return this.dedupe(key, async () => {
      const detail = await (await this.provider()).getRepository(owner, repo);
      this.store.upsertGitHubRepositoryDetail(detail);
      this.onRepositoryDataUpdated(detail.nameWithOwner);
      return detail;
    });
  }

  private async refreshReadme(input: RepoDetailInput): Promise<string | null> {
    const key = `refresh-readme:${input.owner}/${input.repo}`;
    return this.dedupe(key, async () => {
      const readme = await (await this.provider()).getReadme(input);
      this.store.upsertGitHubRepositoryReadme(`${input.owner}/${input.repo}`, readme);
      this.onRepositoryDataUpdated(`${input.owner}/${input.repo}`);
      return readme;
    });
  }

  private async provider(): Promise<GitHubProvider> {
    if (this.providerPromise) {
      return this.providerPromise;
    }

    this.providerPromise = getGitHubToken().then((token) => {
      if (!token) {
        throw new Error("Sign in with GitHub in Settings to load live GitHub data.");
      }
      return new OctokitProvider(token);
    });
    return this.providerPromise;
  }

  private async withCache<T>(cacheKey: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const cached = this.store.getCache<T>("github", cacheKey);
    if (cached) {
      return cached;
    }

    return this.dedupe(cacheKey, async () => {
      const payload = await load();
      this.store.setCache({
        provider: "github",
        cacheKey,
        payload,
        etag: null,
        expiresAt: new Date(Date.now() + ttlMs).toISOString()
      });
      return payload;
    });
  }

  private async dedupe<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = load().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private refreshInBackground(load: () => Promise<unknown>): void {
    void load().catch((error) => {
      console.warn("Control could not refresh GitHub cache.", error);
    });
  }

  private scheduleDeviceSignInPoll(signIn: DeviceSignInRecord): void {
    signIn.pollTimeout = setTimeout(() => {
      void this.pollDeviceSignIn(signIn);
    }, signIn.intervalMs);
  }

  private async pollDeviceSignIn(signIn: DeviceSignInRecord): Promise<void> {
    if (this.deviceSignIn !== signIn || signIn.status !== "pending") {
      return;
    }

    if (Date.parse(signIn.expiresAt) <= Date.now()) {
      this.failDeviceSignIn(signIn, "GitHub sign-in expired. Start it again.");
      return;
    }

    try {
      const result = await pollGitHubDeviceAuthorization({
        clientId: signIn.clientId,
        deviceCode: signIn.deviceCode
      });

      if (result.status === "pending") {
        signIn.intervalMs = result.intervalSeconds * 1000;
        this.scheduleDeviceSignInPoll(signIn);
        return;
      }

      await this.saveToken(result.token.accessToken);
      this.deviceSignIn = {
        ...signIn,
        status: "complete",
        error: null,
        pollTimeout: null
      };
    } catch (error) {
      this.failDeviceSignIn(
        signIn,
        error instanceof Error ? error.message : "GitHub sign-in failed."
      );
    }
  }

  private failDeviceSignIn(signIn: DeviceSignInRecord, error: string): void {
    if (this.deviceSignIn !== signIn) {
      return;
    }

    if (signIn.pollTimeout) {
      clearTimeout(signIn.pollTimeout);
    }

    this.deviceSignIn = {
      ...signIn,
      status: "error",
      error,
      pollTimeout: null
    };
  }

  private clearDeviceSignIn(): void {
    if (!this.deviceSignIn) {
      return;
    }

    if (this.deviceSignIn.pollTimeout) {
      clearTimeout(this.deviceSignIn.pollTimeout);
    }

    this.deviceSignIn = null;
  }

  private resolveOAuthConfig(): { clientId: string } {
    const clientId =
      process.env[githubOAuthClientIdEnvironmentVariable]?.trim() || defaultGitHubOAuthClientId;

    if (!clientId) {
      throw new Error("GitHub sign-in is not configured for this build.");
    }

    return { clientId };
  }
}

export async function createAppState(store: LocalStore): Promise<AppState> {
  const settings = store.getSettings();
  const token = await getGitHubToken();
  const signInConfigured = Boolean(
    process.env[githubOAuthClientIdEnvironmentVariable]?.trim() || defaultGitHubOAuthClientId
  );
  let viewer: Viewer | null = null;
  let github: GitHubAuthStatus = {
    available: true,
    authenticated: false,
    signInConfigured,
    user: null,
    error: signInConfigured
      ? "Sign in with GitHub in Settings to load live GitHub data."
      : "GitHub sign-in is not configured in this build."
  };

  if (token) {
    try {
      viewer = await new OctokitProvider(token).getViewer();
      store.saveAccount("github", viewer.login, viewer);
      github = {
        available: true,
        authenticated: true,
        signInConfigured,
        user: viewer.login,
        error: null
      };
    } catch (error) {
      github = {
        available: true,
        authenticated: false,
        signInConfigured,
        user: null,
        error: error instanceof Error ? error.message : "GitHub credential authentication failed."
      };
    }
  }

  return {
    platform: process.platform,
    isMac: process.platform === "darwin",
    settings,
    github,
    viewer
  };
}

function repositoryDetailFromSummary(summary: RepositorySummary): RepositoryDetail {
  return {
    ...summary,
    homepageUrl: null,
    licenseName: null,
    licenseSpdxId: null,
    topics: [],
    branchCount: 0,
    tagCount: 0,
    readmeMarkdown: null,
    htmlUrl: `https://github.com/${summary.nameWithOwner}`,
    languages: [],
    parent: null,
    source: null,
    viewerState: {
      hasStarred: false,
      subscription: null,
      permission: null,
      canAdminister: false,
      canSubscribe: true
    },
    permissions: {
      viewerPermission: null,
      isArchived: false,
      isDisabled: false
    }
  };
}
