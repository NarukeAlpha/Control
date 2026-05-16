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
  DependabotAlertsInput,
  DependabotAlertsResult,
  DiscussionCategoryListInput,
  DiscussionCategoryListResult,
  DiscussionDetailInput,
  DiscussionDetailResult,
  DiscussionListInput,
  DiscussionListResult,
  DiscussionSummary,
  GitHubAccountProfile,
  GitHubAuthStatus,
  GitHubReadAvailability,
  GitHubSignInSession,
  GitHubMutationInput,
  GitHubMutationResult,
  GitHubProvider,
  IssueDetail,
  IssueDetailInput,
  IssueDetailResult,
  IssueListInput,
  IssueListResult,
  IssueSummary,
  LabelSummary,
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
  RepoEntry,
  RepoFileBlameInput,
  RepoFileBlameResult,
  RepoFileContent,
  RepoFileContentInput,
  RepoFileContentResult,
  RepoDetailInput,
  RepoListInput,
  RepoReadmeInput,
  RepoReadmeResult,
  RepositoryAccessInput,
  RepositoryAccessResult,
  RepositoryCommitListInput,
  RepositoryCommitListResult,
  RepositoryCommitSummary,
  RepositoryCommunityProfileInput,
  RepositoryCommunityProfileResult,
  RepositoryWikiInput,
  RepositoryWikiResult,
  RepositoryMilestoneListInput,
  RepositoryMilestoneListResult,
  RepoTreeInput,
  RepoTreeReadResult,
  RepoTreeResult,
  RepositoryLabelListInput,
  RepositoryLabelListResult,
  RepositoryAdministrationMetadata,
  RepositoryDetail,
  RepositoryDetailResult,
  RepositoryForksInput,
  RepositoryForksResult,
  RepositoryListResult,
  RepositorySearchResult,
  RepositoryRulesetsInput,
  RepositoryRulesetsResult,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityPolicyInput,
  RepositorySecurityPolicyResult,
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
} from "@shared/github";
import { clearGitHubToken, getGitHubToken, setGitHubToken } from "./credentials";
import { OctokitProvider, validateGitHubToken } from "./octokitProvider";
import { pollGitHubDeviceAuthorization, requestGitHubDeviceAuthorization } from "./webOAuth";
import type { CachedRepositoryList, CachedRepositoryValue, LocalStore } from "../storage";

const githubOAuthClientIdEnvironmentVariable = "CONTROL_GITHUB_CLIENT_ID";
const defaultGitHubOAuthClientId = "Ov23ctnQ2BrIJraiNh0c";

const cacheTtlMs = {
  accountProfile: 120_000,
  accountRepositories: 120_000,
  organizationDirectory: 120_000,
  accountWork: 30_000,
  notifications: 15_000,
  repositoryRefs: 300_000,
  repositoryTree: 300_000,
  repositoryReadme: 300_000,
  repositoryContents: 60_000,
  fileContent: 300_000,
  fileBlame: 300_000,
  repositoryWiki: 300_000,
  repositoryCommits: 60_000,
  repositoryMetadata: 300_000,
  repositoryAccess: 120_000,
  issueList: 30_000,
  issueDetail: 30_000,
  pullList: 30_000,
  pullDetail: 20_000,
  discussionList: 60_000,
  discussionDetail: 60_000,
  actionsList: 15_000,
  workflowDefinitions: 300_000,
  workflowDetail: 15_000,
  workflowLogs: 60_000,
  projects: 120_000,
  branchProtection: 120_000,
  securityAlerts: 60_000,
  repositoryRulesets: 120_000,
  repositoryForks: 120_000,
  securityDocuments: 300_000,
  releases: 120_000,
  contributors: 300_000
} as const;

type RepositoryUpdateListener = (nameWithOwner: string | null) => void;
type AuthUpdateListener = (appState: AppState) => void;
type OpenExternalUrl = (url: string) => Promise<void>;

const controlLoadingLogsEnabled =
  process.env.NODE_ENV === "development" || process.env.npm_lifecycle_event === "dev";

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
  private authenticatedViewer: Viewer | null = null;
  private authRefreshPromise: Promise<void> | null = null;

  constructor(
    private readonly store: LocalStore,
    private readonly onRepositoryDataUpdated: RepositoryUpdateListener = () => undefined,
    private readonly onAuthStateUpdated: AuthUpdateListener = () => undefined
  ) {}

  async createAppState(): Promise<AppState> {
    const settings = this.store.getSettings();
    const token = await getGitHubToken();
    const signInConfigured = isGitHubSignInConfigured();

    if (!token) {
      this.authenticatedViewer = null;
      return createGitHubAppState({
        settings,
        signInConfigured,
        authenticated: false,
        viewer: null,
        user: null,
        error: signInConfigured
          ? "Sign in with GitHub in Settings to load live GitHub data."
          : "GitHub sign-in is not configured in this build."
      });
    }

    if (this.authenticatedViewer) {
      return createGitHubAppState({
        settings,
        signInConfigured,
        authenticated: true,
        viewer: this.authenticatedViewer,
        user: this.authenticatedViewer.login,
        error: null
      });
    }

    const cachedViewer = cachedViewerFromStore(this.store);
    this.refreshViewerInBackground(token);
    return createGitHubAppState({
      settings,
      signInConfigured,
      authenticated: true,
      viewer: cachedViewer,
      user: cachedViewer?.login ?? null,
      error: null
    });
  }

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
    this.authenticatedViewer = viewer;
    this.authRefreshPromise = null;
    this.store.saveAccount("github", viewer.login, viewer);
    this.store.saveAccount("github-viewer", viewer.login, viewer);
    this.store.updateSettings({ credentialProvider: "github-oauth" });
    return viewer;
  }

  async clearToken(): Promise<void> {
    await clearGitHubToken();
    this.providerPromise = null;
    this.authenticatedViewer = null;
    this.authRefreshPromise = null;
    this.clearDeviceSignIn();
  }

  async getViewer(): Promise<Viewer> {
    const viewer = await (await this.provider()).getViewer();
    this.authenticatedViewer = viewer;
    this.store.saveAccount("github", viewer.login, viewer);
    this.store.saveAccount("github-viewer", viewer.login, viewer);
    return viewer;
  }

  async getAccountProfile(input: AccountProfileInput = {}): Promise<GitHubAccountProfile> {
    const profile = await this.withCache(
      `account-profile:${input.login ?? "viewer"}`,
      cacheTtlMs.accountProfile,
      async () => (await this.provider()).getAccountProfile(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
    this.store.saveAccount("github", profile.login, profile);
    if (!input.login) {
      this.store.saveAccount("github-viewer", profile.login, profile);
    }
    return profile;
  }

  async getAccountProfileWithStatus(input: AccountProfileInput = {}): Promise<AccountProfileResult> {
    const cacheKey = `account-profile:${input.login ?? "viewer"}`;
    const available: GitHubReadAvailability = { status: "available", message: null };

    if (!input.forceRefresh || input.cacheOnly) {
      const cached = this.store.getCacheEntry<GitHubAccountProfile>("github", cacheKey);
      if (cached) {
        this.store.saveAccount("github", cached.payload.login, cached.payload);
        if (!input.login) {
          this.store.saveAccount("github-viewer", cached.payload.login, cached.payload);
        }

        if (input.cacheOnly || !cached.isExpired) {
          logControlLoading(
            input.cacheOnly ? "account profile cache-only hit" : "account profile cache hit",
            {
              cacheKey
            }
          );
          return { profile: cached.payload, availability: available };
        }

        logControlLoading("account profile stale cache hit", { cacheKey });
        this.refreshInBackground(() =>
          this.getAccountProfileWithStatus({ ...input, cacheOnly: false, forceRefresh: true })
        );
        return { profile: cached.payload, availability: available };
      }
    }

    if (input.cacheOnly) {
      return {
        profile: null,
        availability: {
          status: "not_loaded",
          message: `No cached GitHub data for ${cacheKey}. Sign in with GitHub to refresh it.`
        }
      };
    }

    const statusDedupeKey = `account-profile-status:${input.login ?? "viewer"}`;
    const dedupeKey = input.forceRefresh ? `force:${statusDedupeKey}` : statusDedupeKey;
    return this.dedupe(dedupeKey, async () => {
      let provider: GitHubProvider;
      try {
        provider = await this.provider();
      } catch (error) {
        return {
          profile: null,
          availability: {
            status: "error",
            message: error instanceof Error ? error.message : "GitHub account profile is unavailable."
          }
        };
      }

      logControlLoading("account profile live refresh start", { cacheKey });
      const previous = this.store.getCacheEntry<GitHubAccountProfile>("github", cacheKey);
      const result = await provider.getAccountProfileWithStatus(input);
      if (result.profile) {
        this.store.setCache({
          provider: "github",
          cacheKey,
          payload: result.profile,
          etag: null,
          expiresAt: new Date(Date.now() + cacheTtlMs.accountProfile).toISOString()
        });
        this.store.saveAccount("github", result.profile.login, result.profile);
        if (!input.login) {
          this.store.saveAccount("github-viewer", result.profile.login, result.profile);
        }
        logControlLoading(
          !previous || !areMateriallyEqual(previous.payload, result.profile)
            ? "account profile live refresh changed"
            : "account profile live refresh unchanged",
          { cacheKey }
        );
      }
      return result;
    });
  }

  async listRepositories(input: RepoListInput): Promise<RepositorySummary[]> {
    const limit = input.limit ?? 50;
    const cached = this.store.listGitHubRepositoriesWithMetadata(limit);

    if (input.cacheOnly) {
      logControlLoading("repository list cache-only", { count: cached.items.length });
      return cached.items;
    }

    if (input.forceRefresh) {
      return this.refreshRepositories(input);
    }

    if (cached.items.length > 0) {
      if (repositoryCacheIsFresh(cached, cacheTtlMs.accountRepositories)) {
        logControlLoading("repository list cache hit", { count: cached.items.length });
      } else {
        logControlLoading("repository list stale hit", { count: cached.items.length });
        this.refreshInBackground(() => this.refreshRepositories(input));
      }
      return cached.items;
    }

    return this.refreshRepositories(input);
  }

  async listRepositoriesWithStatus(input: RepoListInput = {}): Promise<RepositoryListResult> {
    const limit = input.limit ?? 50;
    const cached = this.store.listGitHubRepositoriesWithMetadata(limit);
    const cacheKey = `repositories-with-status:${limit}`;
    const cachedResult = this.store.getCacheEntry<RepositoryListResult>("github", cacheKey);
    const available = { status: "available", message: null } as const;

    if (input.cacheOnly) {
      if (cached.items.length > 0) {
        logControlLoading("repository list status cache-only", { count: cached.items.length });
        return { items: cached.items, availability: available };
      }
      if (cachedResult) {
        logControlLoading("repository list status cache-only result", {
          count: cachedResult.payload.items.length
        });
        return cachedResult.payload;
      }
      return {
        items: [],
        availability: {
          status: "not_loaded",
          message: `No cached GitHub data for ${cacheKey}. Sign in with GitHub to refresh it.`
        }
      };
    }

    if (input.forceRefresh) {
      return this.refreshRepositoriesWithStatus(input);
    }

    if (cached.items.length > 0) {
      if (repositoryCacheIsFresh(cached, cacheTtlMs.accountRepositories)) {
        logControlLoading("repository list status cache hit", { count: cached.items.length });
      } else {
        logControlLoading("repository list status stale hit", { count: cached.items.length });
        this.refreshInBackground(() => this.refreshRepositoriesWithStatus(input));
      }
      return { items: cached.items, availability: available };
    }

    if (cachedResult) {
      if (cachedResult.isExpired) {
        logControlLoading("repository list status stale result", {
          count: cachedResult.payload.items.length
        });
        this.refreshInBackground(() => this.refreshRepositoriesWithStatus(input));
      } else {
        logControlLoading("repository list status cache result", {
          count: cachedResult.payload.items.length
        });
      }
      return cachedResult.payload;
    }

    return this.refreshRepositoriesWithStatus(input);
  }

  async listAccountRepositories(input: AccountRepositoryInput = {}): Promise<RepositorySummary[]> {
    if (!input.login) {
      return this.listRepositories({
        limit: input.limit,
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      });
    }

    const key = `account-repositories:${input.login}:${input.limit ?? 50}`;
    const previous = this.store.listGitHubRepositories(input.limit ?? 50);
    const repositories = await this.withCache(
      key,
      cacheTtlMs.accountRepositories,
      async () => {
        const items = await (await this.provider()).listAccountRepositories(input);
        items.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
        if (!areMateriallyEqual(previous, items)) {
          this.onRepositoryDataUpdated(null);
        }
        return items;
      },
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
    return repositories;
  }

  async listAccountRepositoriesWithStatus(
    input: AccountRepositoryInput = {}
  ): Promise<AccountRepositoryListResult> {
    if (!input.login) {
      return this.listRepositoriesWithStatus({
        limit: input.limit,
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      });
    }

    const key = `account-repositories:${input.login}:${input.limit ?? 50}`;
    const cached = this.store.getCacheEntry<RepositorySummary[]>("github", key);
    const available = { status: "available", message: null } as const;

    if (input.cacheOnly) {
      if (cached) {
        logControlLoading("account repositories cache-only hit", {
          cacheKey: key,
          count: cached.payload.length
        });
        return { items: cached.payload, availability: available };
      }
      return {
        items: [],
        availability: {
          status: "not_loaded",
          message: `No cached GitHub data for ${key}. Sign in with GitHub to refresh it.`
        }
      };
    }

    if (!input.forceRefresh && cached) {
      if (cached.isExpired) {
        logControlLoading("account repositories stale cache hit", {
          cacheKey: key,
          count: cached.payload.length
        });
        this.refreshInBackground(() =>
          this.listAccountRepositoriesWithStatus({ ...input, cacheOnly: false, forceRefresh: true })
        );
      } else {
        logControlLoading("account repositories cache hit", { cacheKey: key, count: cached.payload.length });
      }
      return { items: cached.payload, availability: available };
    }

    const result = await this.refreshAccountRepositoriesWithStatus(input);
    if (result.availability.status === "available") {
      this.store.setCache({
        provider: "github",
        cacheKey: key,
        payload: result.items,
        etag: null,
        expiresAt: new Date(Date.now() + cacheTtlMs.accountRepositories).toISOString()
      });
    }
    return result;
  }

  async listOrganizations(input: OrganizationListInput = {}): Promise<OrganizationSummary[]> {
    return this.withCache(
      `organizations:${input.limit ?? 50}`,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizations(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listOrganizationsWithStatus(input: OrganizationListInput = {}): Promise<OrganizationListResult> {
    return this.withListStatusCache(
      `organizations-with-status:${input.limit ?? 50}`,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listOrganizationTeams(input: OrganizationTeamsInput): Promise<TeamSummary[]> {
    const key = `organization-teams:${input.org}:${input.limit ?? 30}`;
    return this.withCache(
      key,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationTeams(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listOrganizationTeamsWithStatus(input: OrganizationTeamsInput): Promise<OrganizationTeamsResult> {
    const key = `organization-teams-with-status:${input.org}:${input.limit ?? 30}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationTeamsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listOrganizationRepositoriesWithStatus(
    input: OrganizationRepositoriesInput
  ): Promise<OrganizationRepositoriesResult> {
    const key = `organization-repositories:${input.org}:${input.limit ?? 50}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationRepositoriesWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listOrganizationTeamRepositoriesWithStatus(
    input: OrganizationTeamRepositoriesInput
  ): Promise<OrganizationTeamRepositoriesResult> {
    const key = `organization-team-repositories:${input.org}:${input.teamSlug}:${input.limit ?? 30}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationTeamRepositoriesWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listOrganizationTeamMembersWithStatus(
    input: OrganizationTeamMembersInput
  ): Promise<OrganizationTeamMembersResult> {
    const key = `organization-team-members:${input.org}:${input.teamSlug}:${input.limit ?? 30}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationTeamMembersWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listOrganizationMembersWithStatus(
    input: OrganizationMembersInput
  ): Promise<OrganizationMembersResult> {
    const key = `organization-members:${input.org}:${input.limit ?? 30}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationMembersWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult> {
    const key = `organization-projects-status:${input.org}:${input.limit ?? 20}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.organizationDirectory,
      async () => (await this.provider()).listOrganizationProjectsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listAccountIssues(input: AccountIssueListInput = {}): Promise<IssueSummary[]> {
    const normalizedInput = this.withViewerLogin(input);
    const key = `account-issues:${normalizedInput.login ?? "viewer"}:${normalizedInput.state ?? "open"}:${normalizedInput.limit ?? 30}`;
    return this.withCache(
      key,
      cacheTtlMs.accountWork,
      async () => (await this.provider()).listAccountIssues(normalizedInput),
      {
        forceRefresh: normalizedInput.forceRefresh,
        cacheOnly: normalizedInput.cacheOnly
      }
    );
  }

  async listAccountIssuesWithStatus(input: AccountIssueListInput = {}): Promise<AccountIssueListResult> {
    const normalizedInput = this.withViewerLogin(input);
    const key = `account-issues-with-status:${normalizedInput.login ?? "viewer"}:${normalizedInput.state ?? "open"}:${normalizedInput.limit ?? 30}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.accountWork,
      async () => (await this.provider()).listAccountIssuesWithStatus(normalizedInput),
      { forceRefresh: normalizedInput.forceRefresh, cacheOnly: normalizedInput.cacheOnly }
    );
  }

  async listAccountPullRequests(input: AccountPullRequestListInput = {}): Promise<PullRequestSummary[]> {
    const normalizedInput = this.withViewerLogin(input);
    const key = `account-pulls:${normalizedInput.login ?? "viewer"}:${normalizedInput.state ?? "open"}:${normalizedInput.limit ?? 30}`;
    return this.withCache(
      key,
      cacheTtlMs.accountWork,
      async () => (await this.provider()).listAccountPullRequests(normalizedInput),
      {
        forceRefresh: normalizedInput.forceRefresh,
        cacheOnly: normalizedInput.cacheOnly
      }
    );
  }

  async listAccountPullRequestsWithStatus(
    input: AccountPullRequestListInput = {}
  ): Promise<AccountPullRequestListResult> {
    const normalizedInput = this.withViewerLogin(input);
    const key = `account-pulls-with-status:${normalizedInput.login ?? "viewer"}:${normalizedInput.state ?? "open"}:${normalizedInput.limit ?? 30}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.accountWork,
      async () => (await this.provider()).listAccountPullRequestsWithStatus(normalizedInput),
      { forceRefresh: normalizedInput.forceRefresh, cacheOnly: normalizedInput.cacheOnly }
    );
  }

  async listNotifications(input: NotificationListInput = {}): Promise<NotificationSummary[]> {
    const key = `notifications:${input.all ? "all" : "unread"}:${input.participating ? "participating" : "all"}:${input.since ?? "none"}:${input.before ?? "none"}:${input.limit ?? 30}`;
    return this.withCache(
      key,
      cacheTtlMs.notifications,
      async () => (await this.provider()).listNotifications(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listNotificationsWithStatus(input: NotificationListInput = {}): Promise<NotificationListResult> {
    const key = `notifications-with-status:${input.all ? "all" : "unread"}:${input.participating ? "participating" : "all"}:${input.since ?? "none"}:${input.before ?? "none"}:${input.limit ?? 30}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.notifications,
      async () => (await this.provider()).listNotificationsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async markNotificationThreadRead(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    const result = await (await this.provider()).markNotificationThreadRead(input);
    this.clearNotificationCache();
    return result;
  }

  async unsubscribeNotificationThread(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    const result = await (await this.provider()).unsubscribeNotificationThread(input);
    this.clearNotificationCache();
    return result;
  }

  private clearNotificationCache(): void {
    this.clearCachePrefixes(["notifications:", "notifications-with-status:"]);
  }

  async getRepository(
    owner: string,
    repo: string,
    input: { cacheOnly?: boolean; forceRefresh?: boolean } = {}
  ): Promise<RepositoryDetail> {
    const id = `${owner}/${repo}`;
    const cachedDetail = this.store.getGitHubRepositoryDetailWithMetadata(id);

    if (input.forceRefresh && !input.cacheOnly) {
      const detail = await this.refreshRepository(owner, repo);
      this.store.addRecentItem("repository", "github", id, detail);
      return detail;
    }

    if (cachedDetail) {
      const detail = normalizeRepositoryDetailFromCache(cachedDetail.value);
      if (!input.cacheOnly && repositoryForkMetadataMissing(detail)) {
        try {
          logControlLoading("repository fork metadata cache miss", { repository: id });
          const refreshedDetail = await this.refreshRepository(owner, repo);
          this.store.addRecentItem("repository", "github", id, refreshedDetail);
          return refreshedDetail;
        } catch (error) {
          console.warn("Control could not refresh fork metadata for cached repository.", error);
        }
      }
      if (!input.cacheOnly && !repositoryCacheIsFresh(cachedDetail, cacheTtlMs.repositoryMetadata)) {
        logControlLoading("repository detail stale hit", { repository: id });
        this.refreshInBackground(() => this.refreshRepository(owner, repo));
      } else {
        logControlLoading("repository detail cache hit", { repository: id });
      }
      this.store.addRecentItem("repository", "github", id, detail);
      return detail;
    }

    const cachedSummary = this.store.getGitHubRepositoryWithMetadata(id);
    if (cachedSummary) {
      const detail = normalizeRepositoryDetailFromCache(repositoryDetailFromSummary(cachedSummary.value));
      if (!input.cacheOnly && repositoryForkMetadataMissing(detail)) {
        try {
          logControlLoading("repository fork metadata summary miss", { repository: id });
          const refreshedDetail = await this.refreshRepository(owner, repo);
          this.store.addRecentItem("repository", "github", id, refreshedDetail);
          return refreshedDetail;
        } catch (error) {
          console.warn("Control could not refresh fork metadata from repository summary.", error);
        }
      }
      if (!input.cacheOnly && !repositoryCacheIsFresh(cachedSummary, cacheTtlMs.accountRepositories)) {
        logControlLoading("repository summary stale hit", { repository: id });
        this.refreshInBackground(() => this.refreshRepository(owner, repo));
      } else {
        logControlLoading("repository summary cache hit", { repository: id });
      }
      this.store.addRecentItem("repository", "github", id, detail);
      return detail;
    }

    if (input.cacheOnly) {
      throw new Error(`No cached repository data for ${id}. Sign in with GitHub to refresh it.`);
    }

    const detail = await this.refreshRepository(owner, repo);
    this.store.addRecentItem("repository", "github", id, detail);
    return detail;
  }

  getRepositoryWithStatus(owner: string, repo: string): Promise<RepositoryDetailResult>;
  getRepositoryWithStatus(input: RepoDetailInput): Promise<RepositoryDetailResult>;
  async getRepositoryWithStatus(
    ownerOrInput: string | RepoDetailInput,
    repoName?: string
  ): Promise<RepositoryDetailResult> {
    const input =
      typeof ownerOrInput === "string" ? { owner: ownerOrInput, repo: repoName ?? "" } : ownerOrInput;
    const id = `${input.owner}/${input.repo}`;
    const available = { status: "available", message: null } as const;

    const liveRead = async (): Promise<RepositoryDetailResult> => {
      const result = await (await this.provider()).getRepositoryWithStatus(input.owner, input.repo);
      if (result.detail) {
        this.store.upsertGitHubRepositoryDetail(result.detail);
        this.store.addRecentItem("repository", "github", id, result.detail);
        this.onRepositoryDataUpdated(result.detail.nameWithOwner);
      }
      return result;
    };

    try {
      if (input.forceRefresh && !input.cacheOnly) {
        return await liveRead();
      }

      const cachedDetail = this.store.getGitHubRepositoryDetailWithMetadata(id);
      if (cachedDetail) {
        const detail = normalizeRepositoryDetailFromCache(cachedDetail.value);
        if (!input.cacheOnly && repositoryForkMetadataMissing(detail)) {
          try {
            logControlLoading("repository fork metadata status cache miss", { repository: id });
            return await liveRead();
          } catch (error) {
            console.warn("Control could not refresh fork metadata for cached repository status.", error);
          }
        }
        if (!input.cacheOnly && !repositoryCacheIsFresh(cachedDetail, cacheTtlMs.repositoryMetadata)) {
          logControlLoading("repository detail status stale hit", { repository: id });
          this.refreshInBackground(liveRead);
        } else {
          logControlLoading("repository detail status cache hit", { repository: id });
        }
        this.store.addRecentItem("repository", "github", id, detail);
        return { detail, availability: available };
      }

      const cachedSummary = this.store.getGitHubRepositoryWithMetadata(id);
      if (cachedSummary) {
        const detail = normalizeRepositoryDetailFromCache(repositoryDetailFromSummary(cachedSummary.value));
        if (!input.cacheOnly && repositoryForkMetadataMissing(detail)) {
          try {
            logControlLoading("repository fork metadata status summary miss", { repository: id });
            return await liveRead();
          } catch (error) {
            console.warn("Control could not refresh fork metadata from repository summary status.", error);
          }
        }
        if (!input.cacheOnly && !repositoryCacheIsFresh(cachedSummary, cacheTtlMs.accountRepositories)) {
          logControlLoading("repository summary status stale hit", { repository: id });
          this.refreshInBackground(liveRead);
        } else {
          logControlLoading("repository summary status cache hit", { repository: id });
        }
        this.store.addRecentItem("repository", "github", id, detail);
        return { detail, availability: available };
      }

      if (input.cacheOnly) {
        return {
          detail: null,
          availability: {
            status: "not_loaded",
            message: `No cached repository data for ${id}. Sign in with GitHub to refresh it.`
          }
        };
      }

      return await liveRead();
    } catch (error: unknown) {
      return {
        detail: null,
        availability: {
          status: "error",
          message: error instanceof Error ? error.message : "Repository detail is unavailable."
        }
      };
    }
  }

  async listBranches(input: BranchListInput): Promise<BranchSummary[]> {
    const key = `branches:${input.owner}/${input.repo}:${input.limit ?? 50}`;
    return this.withCache(
      key,
      cacheTtlMs.repositoryRefs,
      async () => (await this.provider()).listBranches(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listBranchesWithStatus(input: BranchListInput): Promise<BranchListResult> {
    const key = `branches-with-status:${input.owner}/${input.repo}:${input.limit ?? 50}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.repositoryRefs,
      async () => (await this.provider()).listBranchesWithStatus(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listTags(input: TagListInput): Promise<TagSummary[]> {
    const key = `tags:${input.owner}/${input.repo}:${input.limit ?? 50}`;
    return this.withCache(
      key,
      cacheTtlMs.repositoryRefs,
      async () => (await this.provider()).listTags(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listTagsWithStatus(input: TagListInput): Promise<TagListResult> {
    const key = `tags-with-status:${input.owner}/${input.repo}:${input.limit ?? 50}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.repositoryRefs,
      async () => (await this.provider()).listTagsWithStatus(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listTree(input: RepoTreeInput): Promise<RepoTreeResult> {
    const key = `tree:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.recursive === false ? "flat" : "recursive"}:${input.limit ?? "all"}`;
    return this.withCache(
      key,
      cacheTtlMs.repositoryTree,
      async () => (await this.provider()).listTree(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listTreeWithStatus(input: RepoTreeInput): Promise<RepoTreeReadResult> {
    const key = `tree-with-status:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.recursive === false ? "flat" : "recursive"}:${input.limit ?? "all"}`;
    return this.withStatusCache(
      key,
      cacheTtlMs.repositoryTree,
      async () => (await this.provider()).listTreeWithStatus(input),
      { tree: null },
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async getReadme(input: RepoReadmeInput): Promise<RepoReadmeResult> {
    if (input.ref) {
      return this.withStatusCache(
        `readme:${input.owner}/${input.repo}:${input.ref}`,
        cacheTtlMs.repositoryReadme,
        async () => (await this.provider()).getReadme(input),
        { markdown: null },
        { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
      );
    }

    const id = `${input.owner}/${input.repo}`;
    const key = `readme:${id}:default`;
    if (input.forceRefresh && !input.cacheOnly) {
      return this.refreshReadme(input);
    }

    const cached = this.store.getGitHubRepositoryReadmeWithMetadata(id);

    if (cached) {
      if (!input.cacheOnly && !repositoryCacheIsFresh(cached, cacheTtlMs.repositoryReadme)) {
        logControlLoading("repository README stale hit", { repository: id });
        this.refreshInBackground(() => this.refreshReadme(input));
      } else {
        logControlLoading("repository README cache hit", { repository: id });
      }
      return {
        markdown: cached.value,
        availability: { status: "available", message: null }
      };
    }

    const cachedResult = this.store.getCacheEntry<RepoReadmeResult>("github", key);
    if (cachedResult) {
      if (!input.cacheOnly && cachedResult.isExpired) {
        logControlLoading("repository README result stale hit", { repository: id });
        this.refreshInBackground(() => this.refreshReadme(input));
      } else {
        logControlLoading("repository README result cache hit", { repository: id });
      }
      return cachedResult.payload;
    }

    if (input.cacheOnly) {
      return {
        markdown: null,
        availability: {
          status: "not_loaded",
          message: `No cached GitHub data for ${key}. Sign in with GitHub to refresh it.`
        }
      };
    }

    return this.refreshReadme(input);
  }

  async listContents(input: RepoContentsInput): Promise<RepoEntry[]> {
    const key = `contents:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path ?? ""}`;
    return this.withCache(
      key,
      cacheTtlMs.repositoryContents,
      async () => (await this.provider()).listContents(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listContentsWithStatus(input: RepoContentsInput): Promise<RepoContentsResult> {
    const key = `contents-with-status:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path ?? ""}`;
    return this.withListStatusCache(
      key,
      cacheTtlMs.repositoryContents,
      async () => (await this.provider()).listContentsWithStatus(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async getFileContent(input: RepoFileContentInput): Promise<RepoFileContent> {
    const key = `file-content:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path}`;
    return this.withCache(
      key,
      cacheTtlMs.fileContent,
      async () => (await this.provider()).getFileContent(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async getFileContentWithStatus(input: RepoFileContentInput): Promise<RepoFileContentResult> {
    const key = `file-content-with-status:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path}`;
    return this.withStatusCache(
      key,
      cacheTtlMs.fileContent,
      async () => (await this.provider()).getFileContentWithStatus(input),
      { item: null },
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async getFileBlame(input: RepoFileBlameInput): Promise<RepoFileBlameResult> {
    const key = `file-blame:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path}:${input.maxRanges ?? 20}`;
    return this.withStatusCache(
      key,
      cacheTtlMs.fileBlame,
      async () => (await this.provider()).getFileBlame(input),
      { path: input.path, ref: input.ref ?? null, ranges: [], truncated: false },
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async getRepositoryWiki(input: RepositoryWikiInput): Promise<RepositoryWikiResult> {
    const key = `repository-wiki:${input.owner}/${input.repo}:${input.pagePath ?? "default"}:${input.limit ?? 50}`;
    return this.withStatusCache(
      key,
      cacheTtlMs.repositoryWiki,
      async () => (await this.provider()).getRepositoryWiki(input),
      { pages: [], selectedPage: null },
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listCommits(input: RepositoryCommitListInput): Promise<RepositoryCommitSummary[]> {
    return this.withCache(
      `commits:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path ?? ""}:${input.limit ?? 20}`,
      cacheTtlMs.repositoryCommits,
      async () => (await this.provider()).listCommits(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listCommitsWithStatus(input: RepositoryCommitListInput): Promise<RepositoryCommitListResult> {
    return this.withListStatusCache(
      `commits-with-status:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.path ?? ""}:${
        input.limit ?? 20
      }`,
      cacheTtlMs.repositoryCommits,
      async () => (await this.provider()).listCommitsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listLabels(input: RepositoryLabelListInput): Promise<LabelSummary[]> {
    return this.withCache(
      `labels:${input.owner}/${input.repo}:${input.limit ?? 100}`,
      cacheTtlMs.repositoryMetadata,
      async () => (await this.provider()).listLabels(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listLabelsWithStatus(input: RepositoryLabelListInput): Promise<RepositoryLabelListResult> {
    return this.withListStatusCache(
      `labels-with-status:${input.owner}/${input.repo}:${input.limit ?? 100}`,
      cacheTtlMs.repositoryMetadata,
      async () => (await this.provider()).listLabelsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listAssignableUsers(input: AssignableUserListInput): Promise<AssignableUserSummary[]> {
    return this.withCache(
      `assignable-users:${input.owner}/${input.repo}:${input.limit ?? 100}`,
      cacheTtlMs.repositoryMetadata,
      async () => (await this.provider()).listAssignableUsers(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listAssignableUsersWithStatus(input: AssignableUserListInput): Promise<AssignableUserListResult> {
    return this.withListStatusCache(
      `assignable-users-with-status:${input.owner}/${input.repo}:${input.limit ?? 100}`,
      cacheTtlMs.repositoryMetadata,
      async () => (await this.provider()).listAssignableUsersWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getRepositoryAccess(input: RepositoryAccessInput): Promise<RepositoryAccessResult> {
    const key = `repository-access:${input.owner}/${input.repo}:${input.affiliation ?? "all"}:${
      input.permission ?? "any"
    }:${input.limit ?? 30}`;
    return this.withRepositoryAccessCache(
      key,
      cacheTtlMs.repositoryAccess,
      async () => (await this.provider()).getRepositoryAccess(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listMilestones(input: RepositoryMilestoneListInput): Promise<MilestoneSummary[]> {
    return this.withCache(
      `milestones:${input.owner}/${input.repo}:${input.state ?? "open"}:${input.limit ?? 100}`,
      cacheTtlMs.repositoryMetadata,
      async () => (await this.provider()).listMilestones(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listMilestonesWithStatus(
    input: RepositoryMilestoneListInput
  ): Promise<RepositoryMilestoneListResult> {
    return this.withListStatusCache(
      `milestones-with-status:${input.owner}/${input.repo}:${input.state ?? "open"}:${input.limit ?? 100}`,
      cacheTtlMs.repositoryMetadata,
      async () => (await this.provider()).listMilestonesWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listIssues(input: IssueListInput): Promise<IssueSummary[]> {
    return this.withCache(
      `issues:${input.owner}/${input.repo}:${input.state ?? "open"}`,
      cacheTtlMs.issueList,
      async () => (await this.provider()).listIssues(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listIssuesWithStatus(input: IssueListInput): Promise<IssueListResult> {
    return this.withListStatusCache(
      `issues-with-status:${input.owner}/${input.repo}:${input.state ?? "open"}:${input.limit ?? 50}`,
      cacheTtlMs.issueList,
      async () => (await this.provider()).listIssuesWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getIssueDetail(input: IssueDetailInput): Promise<IssueDetail> {
    const key = `issue-detail:${input.owner}/${input.repo}:${input.issueNumber}`;
    return this.withCache(
      key,
      cacheTtlMs.issueDetail,
      async () => (await this.provider()).getIssueDetail(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async getIssueDetailWithStatus(input: IssueDetailInput): Promise<IssueDetailResult> {
    const key = `issue-detail-with-status:${input.owner}/${input.repo}:${input.issueNumber}`;
    return this.withStatusCache(
      key,
      cacheTtlMs.issueDetail,
      async () => (await this.provider()).getIssueDetailWithStatus(input),
      { detail: null },
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]> {
    return this.withCache(
      `pulls:${input.owner}/${input.repo}:${input.state ?? "open"}`,
      cacheTtlMs.pullList,
      async () => (await this.provider()).listPullRequests(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listPullRequestsWithStatus(input: PullRequestListInput): Promise<PullRequestListResult> {
    return this.withListStatusCache(
      `pulls-with-status:${input.owner}/${input.repo}:${input.state ?? "open"}:${input.limit ?? 50}`,
      cacheTtlMs.pullList,
      async () => (await this.provider()).listPullRequestsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getPullRequestDetail(input: PullRequestDetailInput): Promise<PullRequestDetail> {
    const key = `pull-detail:${input.owner}/${input.repo}:${input.pullNumber}`;
    return this.withCache(
      key,
      cacheTtlMs.pullDetail,
      async () => (await this.provider()).getPullRequestDetail(input),
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async getPullRequestDetailWithStatus(input: PullRequestDetailInput): Promise<PullRequestDetailResult> {
    const key = `pull-detail-with-status:${input.owner}/${input.repo}:${input.pullNumber}`;
    return this.withStatusCache(
      key,
      cacheTtlMs.pullDetail,
      async () => (await this.provider()).getPullRequestDetailWithStatus(input),
      { detail: null },
      {
        forceRefresh: input.forceRefresh,
        cacheOnly: input.cacheOnly
      }
    );
  }

  async listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    return this.withCache(
      `discussions:${input.owner}/${input.repo}:${input.limit ?? 30}`,
      cacheTtlMs.discussionList,
      async () => (await this.provider()).listDiscussions(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listDiscussionsWithStatus(input: DiscussionListInput): Promise<DiscussionListResult> {
    return this.withListStatusCache(
      `discussions-status:${input.owner}/${input.repo}:${input.limit ?? 30}`,
      cacheTtlMs.discussionList,
      async () => (await this.provider()).listDiscussionsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listDiscussionCategoriesWithStatus(
    input: DiscussionCategoryListInput
  ): Promise<DiscussionCategoryListResult> {
    return this.withListStatusCache(
      `discussion-categories-status:${input.owner}/${input.repo}:${input.limit ?? 25}`,
      cacheTtlMs.repositoryMetadata,
      async () => (await this.provider()).listDiscussionCategoriesWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetailResult> {
    return this.withStatusCache(
      `discussion-detail:${input.owner}/${input.repo}:${input.discussionNumber}:${input.commentsLimit ?? 100}:${input.repliesLimit ?? 20}`,
      cacheTtlMs.discussionDetail,
      async () => (await this.provider()).getDiscussionDetail(input),
      { item: null },
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listActions(input: ActionsInput): Promise<WorkflowRunSummary[]> {
    return this.withCache(
      `actions:${input.owner}/${input.repo}:${input.limit ?? 30}`,
      cacheTtlMs.actionsList,
      async () => (await this.provider()).listActions(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listActionsWithStatus(input: ActionsInput): Promise<WorkflowRunListResult> {
    return this.withListStatusCache(
      `actions-with-status:${input.owner}/${input.repo}:${input.limit ?? 30}`,
      cacheTtlMs.actionsList,
      async () => (await this.provider()).listActionsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listWorkflows(input: WorkflowListInput): Promise<WorkflowDefinitionSummary[]> {
    return this.withCache(
      `workflows:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.limit ?? 50}`,
      cacheTtlMs.workflowDefinitions,
      async () => (await this.provider()).listWorkflows(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listWorkflowsWithStatus(input: WorkflowListInput): Promise<WorkflowDefinitionListResult> {
    return this.withListStatusCache(
      `workflows-with-status:${input.owner}/${input.repo}:${input.ref ?? "default"}:${input.limit ?? 50}`,
      cacheTtlMs.workflowDefinitions,
      async () => (await this.provider()).listWorkflowsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getWorkflowRunDetail(input: WorkflowRunDetailInput): Promise<WorkflowRunDetail> {
    return this.withCache(
      `action-detail:${input.owner}/${input.repo}:${input.runId}`,
      cacheTtlMs.workflowDetail,
      async () => (await this.provider()).getWorkflowRunDetail(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getWorkflowRunDetailWithStatus(input: WorkflowRunDetailInput): Promise<WorkflowRunDetailResult> {
    return this.withStatusCache(
      `action-detail-with-status:${input.owner}/${input.repo}:${input.runId}`,
      cacheTtlMs.workflowDetail,
      async () => (await this.provider()).getWorkflowRunDetailWithStatus(input),
      { detail: null },
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getWorkflowJobLogs(input: WorkflowJobLogsInput): Promise<WorkflowJobLogsResult> {
    return this.withStatusCache(
      `workflow-job-logs:${input.owner}/${input.repo}:${input.jobId}:${input.maxCharacters ?? 12_000}`,
      cacheTtlMs.workflowLogs,
      async () => (await this.provider()).getWorkflowJobLogs(input),
      { jobId: input.jobId, text: "", truncated: false, downloadUrl: null },
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    return this.withCache(
      `projects:${input.owner}/${input.repo}:${input.limit ?? 20}`,
      cacheTtlMs.projects,
      async () => (await this.provider()).listProjects(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listProjectsWithStatus(input: ProjectsInput): Promise<ProjectListResult> {
    return this.withListStatusCache(
      `projects-status:${input.owner}/${input.repo}:${input.limit ?? 20}`,
      cacheTtlMs.projects,
      async () => (await this.provider()).listProjectsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getBranchProtection(input: BranchProtectionInput): Promise<BranchProtectionResult> {
    return this.withStatusCache(
      `branch-protection:${input.owner}/${input.repo}:${input.branch}`,
      cacheTtlMs.branchProtection,
      async () => (await this.provider()).getBranchProtection(input),
      { protection: null },
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listDependabotAlerts(input: DependabotAlertsInput): Promise<DependabotAlertsResult> {
    return this.withListStatusCache(
      `dependabot-alerts:${input.owner}/${input.repo}:${input.state ?? "open"}:${input.limit ?? 30}`,
      cacheTtlMs.securityAlerts,
      async () => (await this.provider()).listDependabotAlerts(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listCodeScanningAlerts(input: CodeScanningAlertsInput): Promise<CodeScanningAlertsResult> {
    return this.withListStatusCache(
      `code-scanning-alerts:${input.owner}/${input.repo}:${input.state ?? "open"}:${input.limit ?? 30}`,
      cacheTtlMs.securityAlerts,
      async () => (await this.provider()).listCodeScanningAlerts(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listSecretScanningAlerts(input: SecretScanningAlertsInput): Promise<SecretScanningAlertsResult> {
    return this.withListStatusCache(
      `secret-scanning-alerts:${input.owner}/${input.repo}:${input.state ?? "open"}:${input.limit ?? 30}`,
      cacheTtlMs.securityAlerts,
      async () => (await this.provider()).listSecretScanningAlerts(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listRepositoryRulesets(input: RepositoryRulesetsInput): Promise<RepositoryRulesetsResult> {
    return this.withListStatusCache(
      `repository-rulesets:${input.owner}/${input.repo}:${input.includesParents ?? true}:${input.limit ?? 30}`,
      cacheTtlMs.repositoryRulesets,
      async () => (await this.provider()).listRepositoryRulesets(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listRepositoryForks(input: RepositoryForksInput): Promise<RepositoryForksResult> {
    return this.withListStatusCache(
      `repository-forks:${input.owner}/${input.repo}:${input.sort ?? "newest"}:${input.limit ?? 30}`,
      cacheTtlMs.repositoryForks,
      async () => (await this.provider()).listRepositoryForks(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listRepositorySecurityAdvisories(
    input: RepositorySecurityAdvisoriesInput
  ): Promise<RepositorySecurityAdvisoriesResult> {
    return this.withListStatusCache(
      `repository-security-advisories:${input.owner}/${input.repo}:${input.limit ?? 30}`,
      cacheTtlMs.securityAlerts,
      async () => (await this.provider()).listRepositorySecurityAdvisories(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getRepositorySecurityPolicy(
    input: RepositorySecurityPolicyInput
  ): Promise<RepositorySecurityPolicyResult> {
    return this.withStatusCache(
      `repository-security-policy:${input.owner}/${input.repo}:${input.ref ?? "default"}`,
      cacheTtlMs.securityDocuments,
      async () => (await this.provider()).getRepositorySecurityPolicy(input),
      { policy: null },
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async getRepositoryCommunityProfile(
    input: RepositoryCommunityProfileInput
  ): Promise<RepositoryCommunityProfileResult> {
    return this.withStatusCache(
      `repository-community-profile:${input.owner}/${input.repo}`,
      cacheTtlMs.securityDocuments,
      async () => (await this.provider()).getRepositoryCommunityProfile(input),
      { profile: null },
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listReleases(input: ReleasesInput): Promise<ReleaseSummary[]> {
    return this.withCache(
      `releases:${input.owner}/${input.repo}:${input.limit ?? 20}`,
      cacheTtlMs.releases,
      async () => (await this.provider()).listReleases(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listReleasesWithStatus(input: ReleasesInput): Promise<ReleaseListResult> {
    return this.withListStatusCache(
      `releases-with-status:${input.owner}/${input.repo}:${input.limit ?? 20}`,
      cacheTtlMs.releases,
      async () => (await this.provider()).listReleasesWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listContributors(input: ContributorsInput): Promise<ContributorSummary[]> {
    return this.withCache(
      `contributors:${input.owner}/${input.repo}`,
      cacheTtlMs.contributors,
      async () => (await this.provider()).listContributors(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async listContributorsWithStatus(input: ContributorsInput): Promise<ContributorListResult> {
    return this.withListStatusCache(
      `contributors-with-status:${input.owner}/${input.repo}`,
      cacheTtlMs.contributors,
      async () => (await this.provider()).listContributorsWithStatus(input),
      { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
    );
  }

  async search(input: SearchInput): Promise<RepositorySummary[]> {
    let provider: GitHubProvider;
    try {
      provider = await this.provider();
    } catch (error) {
      console.warn("Control could not search GitHub repositories.", error);
      return [];
    }

    const repositories = await provider.search(input);
    repositories.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
    this.onRepositoryDataUpdated(null);
    return repositories;
  }

  async searchWithStatus(input: SearchInput): Promise<RepositorySearchResult> {
    let provider: GitHubProvider;
    try {
      provider = await this.provider();
    } catch (error) {
      return {
        items: [],
        availability: {
          status: "error",
          message: error instanceof Error ? error.message : "GitHub repository search is unavailable."
        }
      };
    }

    const result = await provider.searchWithStatus(input);
    if (result.availability.status === "available") {
      result.items.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
      this.onRepositoryDataUpdated(null);
    }
    return result;
  }

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult> {
    const result = await (await this.provider()).mutate<TInput, TResult>(input);
    if (result.ok) {
      this.clearRepositoryScopedCache(input.owner, input.repo);
      this.clearRepositoryCollectionCacheForMutation(input.action);
      this.clearAccountWorkCacheForMutation(input.action);
      this.clearAccountProfileCacheForMutation(input.action);
      this.clearNotificationCache();
    }
    return result;
  }

  private clearRepositoryCollectionCacheForMutation(action: GitHubMutationInput["action"]): void {
    switch (action) {
      case "star":
      case "unstar":
      case "watch":
      case "unwatch":
      case "fork":
      case "editRepository":
      case "createIssue":
      case "closeIssue":
      case "reopenIssue":
      case "createPullRequest":
      case "mergePullRequest":
      case "closePullRequest":
      case "reopenPullRequest":
      case "createRelease":
      case "editRelease":
      case "deleteRelease":
      case "deleteReleaseAsset":
      case "rerunWorkflow":
      case "rerunFailedWorkflowJobs":
      case "rerunWorkflowJob":
      case "dispatchWorkflow":
      case "cancelWorkflow":
        this.clearCachePrefixes([
          "repositories-with-status:",
          "account-repositories:",
          "organizations:",
          "organizations-with-status:",
          "organization-repositories:",
          "organization-team-repositories:"
        ]);
        break;
      default:
        break;
    }
  }

  private clearAccountProfileCacheForMutation(action: GitHubMutationInput["action"]): void {
    if (action !== "star" && action !== "unstar" && action !== "fork") {
      return;
    }
    this.clearCachePrefixes(["account-profile:", "account-profile-status:"]);
  }

  private clearAccountWorkCacheForMutation(action: GitHubMutationInput["action"]): void {
    let clearIssues = false;
    let clearPulls = false;

    switch (action) {
      case "createIssue":
      case "closeIssue":
      case "reopenIssue":
        clearIssues = true;
        break;
      case "createPullRequest":
      case "mergePullRequest":
      case "closePullRequest":
      case "reopenPullRequest":
      case "approvePullRequest":
      case "commentPullRequestReview":
      case "requestChanges":
      case "requestReviewers":
      case "removeReviewers":
      case "editReviewComment":
      case "deleteReviewComment":
        clearPulls = true;
        break;
      case "editIssue":
      case "addComment":
      case "editComment":
      case "deleteComment":
      case "addLabels":
      case "removeLabel":
      case "setAssignees":
      case "removeAssignees":
      case "editRepository":
        clearIssues = true;
        clearPulls = true;
        break;
      default:
        break;
    }

    const prefixes: string[] = [];
    if (clearIssues) {
      prefixes.push("account-issues:", "account-issues-with-status:");
    }
    if (clearPulls) {
      prefixes.push("account-pulls:", "account-pulls-with-status:");
    }

    if (prefixes.length > 0) {
      this.clearCachePrefixes(prefixes);
    }
  }

  private clearRepositoryScopedCache(owner: string, repo: string): void {
    const scope = `${owner}/${repo}`;
    this.clearCachePrefixes([
      `readme:${scope}`,
      `contents:${scope}`,
      `contents-with-status:${scope}`,
      `file-content:${scope}`,
      `file-content-with-status:${scope}`,
      `file-blame:${scope}`,
      `commits:${scope}`,
      `commits-with-status:${scope}`,
      `branches:${scope}`,
      `branches-with-status:${scope}`,
      `tags:${scope}`,
      `tags-with-status:${scope}`,
      `tree:${scope}`,
      `tree-with-status:${scope}`,
      `labels:${scope}`,
      `labels-with-status:${scope}`,
      `assignable-users:${scope}`,
      `assignable-users-with-status:${scope}`,
      `repository-access:${scope}`,
      `milestones:${scope}`,
      `milestones-with-status:${scope}`,
      `issues:${scope}`,
      `issues-with-status:${scope}`,
      `issue-detail:${scope}`,
      `issue-detail-with-status:${scope}`,
      `pulls:${scope}`,
      `pulls-with-status:${scope}`,
      `pull-detail:${scope}`,
      `pull-detail-with-status:${scope}`,
      `discussions:${scope}`,
      `discussions-status:${scope}`,
      `discussion-categories-status:${scope}`,
      `discussion-detail:${scope}`,
      `actions:${scope}`,
      `actions-with-status:${scope}`,
      `workflows:${scope}`,
      `workflows-with-status:${scope}`,
      `action-detail:${scope}`,
      `action-detail-with-status:${scope}`,
      `workflow-job-logs:${scope}`,
      `projects:${scope}`,
      `projects-status:${scope}`,
      `branch-protection:${scope}`,
      `dependabot-alerts:${scope}`,
      `code-scanning-alerts:${scope}`,
      `secret-scanning-alerts:${scope}`,
      `repository-rulesets:${scope}`,
      `repository-forks:${scope}`,
      `repository-security-advisories:${scope}`,
      `repository-security-policy:${scope}`,
      `repository-community-profile:${scope}`,
      `repository-wiki:${scope}`,
      `releases:${scope}`,
      `releases-with-status:${scope}`,
      `contributors:${scope}`,
      `contributors-with-status:${scope}`
    ]);
  }

  private clearCachePrefixes(prefixes: string[]): void {
    for (const prefix of prefixes) {
      this.store.clearCacheByPrefix("github", prefix);
      for (const key of this.inFlight.keys()) {
        if (key.startsWith(prefix) || key.startsWith(`force:${prefix}`)) {
          this.inFlight.delete(key);
        }
      }
    }
  }

  private async refreshRepositories(input: RepoListInput): Promise<RepositorySummary[]> {
    const key = `refresh-repositories:${input.limit ?? 50}`;
    return this.dedupe(key, async () => {
      try {
        logControlLoading("repository list live refresh start", { limit: input.limit ?? 50 });
        const previous = this.store.listGitHubRepositories(input.limit ?? 50);
        const repositories = await (await this.provider()).listRepositories(input);
        repositories.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
        const changed = !areMateriallyEqual(previous, repositories);
        if (changed) {
          this.onRepositoryDataUpdated(null);
        }
        logControlLoading(
          changed ? "repository list live refresh changed" : "repository list live refresh unchanged",
          {
            count: repositories.length
          }
        );
        return repositories;
      } catch (error) {
        console.warn("Control could not refresh GitHub repositories.", error);
        return [];
      }
    });
  }

  private async refreshRepositoriesWithStatus(input: RepoListInput): Promise<RepositoryListResult> {
    const key = `refresh-repositories-with-status:${input.limit ?? 50}`;
    return this.dedupe(key, async () => {
      try {
        logControlLoading("repository list status live refresh start", { limit: input.limit ?? 50 });
        const previous = this.store.listGitHubRepositories(input.limit ?? 50);
        const result = await (await this.provider()).listRepositoriesWithStatus(input);
        if (result.availability.status === "available") {
          result.items.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
          this.store.setCache({
            provider: "github",
            cacheKey: `repositories-with-status:${input.limit ?? 50}`,
            payload: result,
            etag: null,
            expiresAt: new Date(Date.now() + cacheTtlMs.accountRepositories).toISOString()
          });
          const changed = !areMateriallyEqual(previous, result.items);
          if (changed) {
            this.onRepositoryDataUpdated(null);
          }
          logControlLoading(
            changed
              ? "repository list status live refresh changed"
              : "repository list status live refresh unchanged",
            { count: result.items.length }
          );
        }
        return result;
      } catch (error) {
        console.warn("Control could not refresh GitHub repositories with status.", error);
        return {
          items: [],
          availability: {
            status: "error",
            message: error instanceof Error ? error.message : "GitHub repository list is unavailable."
          }
        };
      }
    });
  }

  private async refreshAccountRepositoriesWithStatus(
    input: AccountRepositoryInput
  ): Promise<AccountRepositoryListResult> {
    const key = `refresh-account-repositories-with-status:${input.login ?? "viewer"}:${input.limit ?? 50}`;
    return this.dedupe(key, async () => {
      try {
        logControlLoading("account repositories live refresh start", {
          login: input.login ?? "viewer",
          limit: input.limit ?? 50
        });
        const previous = this.store.listGitHubRepositories(input.limit ?? 50);
        const result = await (await this.provider()).listAccountRepositoriesWithStatus(input);
        if (result.availability.status === "available") {
          result.items.forEach((repository) => this.store.upsertGitHubRepositorySummary(repository));
          const changed = !areMateriallyEqual(previous, result.items);
          if (changed) {
            this.onRepositoryDataUpdated(null);
          }
          logControlLoading(
            changed
              ? "account repositories live refresh changed"
              : "account repositories live refresh unchanged",
            { login: input.login ?? "viewer", count: result.items.length }
          );
        }
        return result;
      } catch (error) {
        console.warn("Control could not refresh account repositories with status.", error);
        return {
          items: [],
          availability: {
            status: "error",
            message: error instanceof Error ? error.message : "GitHub account repositories are unavailable."
          }
        };
      }
    });
  }

  private async refreshRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    const key = `refresh-repository:${owner}/${repo}`;
    return this.dedupe(key, async () => {
      try {
        logControlLoading("repository detail live refresh start", { repository: `${owner}/${repo}` });
        const previous = this.store.getGitHubRepositoryDetail(`${owner}/${repo}`);
        const detail = await (await this.provider()).getRepository(owner, repo);
        this.store.upsertGitHubRepositoryDetail(detail);
        const changed = !areMateriallyEqual(previous, detail);
        if (changed) {
          this.onRepositoryDataUpdated(detail.nameWithOwner);
        }
        logControlLoading(
          changed ? "repository detail live refresh changed" : "repository detail live refresh unchanged",
          { repository: detail.nameWithOwner }
        );
        return detail;
      } catch (error) {
        console.warn("Control could not refresh GitHub repository.", error);
        throw error;
      }
    });
  }

  private async refreshReadme(input: RepoReadmeInput): Promise<RepoReadmeResult> {
    const key = `refresh-readme:${input.owner}/${input.repo}`;
    return this.dedupe(key, async () => {
      try {
        logControlLoading("repository README live refresh start", {
          repository: `${input.owner}/${input.repo}`
        });
        const previous = this.store.getGitHubRepositoryReadme(`${input.owner}/${input.repo}`);
        const result = await (await this.provider()).getReadme(input);
        if (result.availability.status === "available") {
          this.store.setCache({
            provider: "github",
            cacheKey: `readme:${input.owner}/${input.repo}:default`,
            payload: result,
            etag: null,
            expiresAt: new Date(Date.now() + cacheTtlMs.repositoryReadme).toISOString()
          });

          this.store.upsertGitHubRepositoryReadme(`${input.owner}/${input.repo}`, result.markdown);
          const changed = previous !== result.markdown;
          if (changed) {
            this.onRepositoryDataUpdated(`${input.owner}/${input.repo}`);
          }
          logControlLoading(
            changed ? "repository README live refresh changed" : "repository README live refresh unchanged",
            { repository: `${input.owner}/${input.repo}` }
          );
        }
        return result;
      } catch (error) {
        console.warn("Control could not refresh GitHub readme.", error);
        return {
          markdown: null,
          availability: {
            status: "error",
            message: error instanceof Error ? error.message : "GitHub readme is unavailable."
          }
        };
      }
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

  private withViewerLogin<T extends { login?: string | null }>(input: T): T {
    if (input.login) {
      return input;
    }

    const login = this.authenticatedViewer?.login ?? cachedViewerFromStore(this.store)?.login ?? null;
    return login ? { ...input, login } : input;
  }

  private refreshViewerInBackground(token: string): void {
    if (this.authRefreshPromise) {
      return;
    }

    this.authRefreshPromise = this.loadViewerForAppState(token).finally(() => {
      this.authRefreshPromise = null;
    });
  }

  private async loadViewerForAppState(token: string): Promise<void> {
    const signInConfigured = isGitHubSignInConfigured();

    try {
      const provider = new OctokitProvider(token);
      const viewer = await provider.getViewer();
      if ((await getGitHubToken()) !== token) {
        return;
      }

      this.providerPromise = Promise.resolve(provider);
      this.authenticatedViewer = viewer;
      this.store.saveAccount("github", viewer.login, viewer);
      this.store.saveAccount("github-viewer", viewer.login, viewer);
      this.onAuthStateUpdated(
        createGitHubAppState({
          settings: this.store.getSettings(),
          signInConfigured,
          authenticated: true,
          viewer,
          user: viewer.login,
          error: null
        })
      );
    } catch (error) {
      if ((await getGitHubToken()) !== token) {
        return;
      }

      this.providerPromise = null;
      this.authenticatedViewer = null;
      this.onAuthStateUpdated(
        createGitHubAppState({
          settings: this.store.getSettings(),
          signInConfigured,
          authenticated: false,
          viewer: null,
          user: null,
          error: error instanceof Error ? error.message : "GitHub credential authentication failed."
        })
      );
    }
  }

  private async refreshCachePayload<T>(
    cacheKey: string,
    ttlMs: number,
    load: () => Promise<T>,
    forceRefresh = false
  ): Promise<T> {
    const previous = this.store.getCacheEntry<T>("github", cacheKey);
    const dedupeKey = forceRefresh ? `force:${cacheKey}` : cacheKey;
    return this.dedupe(dedupeKey, async () => {
      logControlLoading("cache live refresh start", { cacheKey });
      const payload = await load();
      this.store.setCache({
        provider: "github",
        cacheKey,
        payload,
        etag: null,
        expiresAt: new Date(Date.now() + ttlMs).toISOString()
      });
      logControlLoading(
        !previous || !areMateriallyEqual(previous.payload, payload)
          ? "cache live refresh changed"
          : "cache live refresh unchanged",
        { cacheKey }
      );
      return payload;
    });
  }

  private async withCache<T>(
    cacheKey: string,
    ttlMs: number,
    load: () => Promise<T>,
    options: { forceRefresh?: boolean; cacheOnly?: boolean } = {}
  ): Promise<T> {
    if (!options.forceRefresh || options.cacheOnly) {
      const cached = this.store.getCacheEntry<T>("github", cacheKey);
      if (cached) {
        if (options.cacheOnly || !cached.isExpired) {
          logControlLoading(options.cacheOnly ? "cache-only hit" : "cache hit", { cacheKey });
          return cached.payload;
        }

        logControlLoading("stale cache hit", { cacheKey });
        this.refreshInBackground(() => this.refreshCachePayload(cacheKey, ttlMs, load));
        return cached.payload;
      }
    }

    if (options.cacheOnly) {
      throw new Error(`No cached GitHub data for ${cacheKey}. Sign in with GitHub to refresh it.`);
    }

    try {
      return await this.refreshCachePayload(cacheKey, ttlMs, load, options.forceRefresh);
    } catch (error) {
      const expired = this.store.getCacheEntry<T>("github", cacheKey);
      if (expired) {
        console.warn("Control served stale cache for GitHub cache key.", cacheKey, error);
        return expired.payload;
      }
      throw error;
    }
  }

  private async withListStatusCache<T extends { items: unknown[]; availability: GitHubReadAvailability }>(
    cacheKey: string,
    ttlMs: number,
    load: () => Promise<T>,
    options: { forceRefresh?: boolean; cacheOnly?: boolean } = {}
  ): Promise<T> {
    if (!options.forceRefresh || options.cacheOnly) {
      const cached = this.store.getCacheEntry<T>("github", cacheKey);
      if (cached) {
        if (options.cacheOnly || !cached.isExpired) {
          logControlLoading(options.cacheOnly ? "list cache-only hit" : "list cache hit", {
            cacheKey,
            count: cached.payload.items.length
          });
          return cached.payload;
        }

        logControlLoading("list stale cache hit", { cacheKey, count: cached.payload.items.length });
        this.refreshInBackground(() => this.refreshCachePayload(cacheKey, ttlMs, load));
        return cached.payload;
      }
    }

    if (options.cacheOnly) {
      return {
        items: [],
        availability: {
          status: "not_loaded",
          message: `No cached GitHub data for ${cacheKey}. Sign in with GitHub to refresh it.`
        }
      } as unknown as T;
    }

    try {
      return await this.refreshCachePayload(cacheKey, ttlMs, load, options.forceRefresh);
    } catch (error) {
      const expired = this.store.getCacheEntry<T>("github", cacheKey);
      if (expired) {
        console.warn("Control served stale cache for GitHub cache key.", cacheKey, error);
        return expired.payload;
      }
      return {
        items: [],
        availability: {
          status: "error",
          message: error instanceof Error ? error.message : "GitHub list data is unavailable."
        }
      } as unknown as T;
    }
  }

  private async withStatusCache<T extends { availability: GitHubReadAvailability }>(
    cacheKey: string,
    ttlMs: number,
    load: () => Promise<T>,
    emptyValue: Omit<T, "availability">,
    options: { forceRefresh?: boolean; cacheOnly?: boolean } = {}
  ): Promise<T> {
    if (!options.forceRefresh || options.cacheOnly) {
      const cached = this.store.getCacheEntry<T>("github", cacheKey);
      if (cached) {
        if (options.cacheOnly || !cached.isExpired) {
          logControlLoading(options.cacheOnly ? "status cache-only hit" : "status cache hit", { cacheKey });
          return cached.payload;
        }

        logControlLoading("status stale cache hit", { cacheKey });
        this.refreshInBackground(() => this.refreshCachePayload(cacheKey, ttlMs, load));
        return cached.payload;
      }
    }

    if (options.cacheOnly) {
      return {
        ...emptyValue,
        availability: {
          status: "not_loaded",
          message: `No cached GitHub data for ${cacheKey}. Sign in with GitHub to refresh it.`
        }
      } as T;
    }

    try {
      return await this.refreshCachePayload(cacheKey, ttlMs, load, options.forceRefresh);
    } catch (error) {
      const expired = this.store.getCacheEntry<T>("github", cacheKey);
      if (expired) {
        console.warn("Control served stale cache for GitHub cache key.", cacheKey, error);
        return expired.payload;
      }
      return {
        ...emptyValue,
        availability: {
          status: "error",
          message: error instanceof Error ? error.message : "GitHub data is unavailable."
        }
      } as T;
    }
  }

  private async withRepositoryAccessCache(
    cacheKey: string,
    ttlMs: number,
    load: () => Promise<RepositoryAccessResult>,
    options: { forceRefresh?: boolean; cacheOnly?: boolean } = {}
  ): Promise<RepositoryAccessResult> {
    if (!options.forceRefresh || options.cacheOnly) {
      const cached = this.store.getCacheEntry<RepositoryAccessResult>("github", cacheKey);
      if (cached) {
        if (options.cacheOnly || !cached.isExpired) {
          logControlLoading(
            options.cacheOnly ? "repository access cache-only hit" : "repository access cache hit",
            {
              cacheKey
            }
          );
          return cached.payload;
        }

        logControlLoading("repository access stale cache hit", { cacheKey });
        this.refreshInBackground(() => this.refreshCachePayload(cacheKey, ttlMs, load));
        return cached.payload;
      }
    }

    if (options.cacheOnly) {
      const availability = {
        status: "not_loaded",
        message: `No cached GitHub data for ${cacheKey}. Sign in with GitHub to refresh it.`
      } satisfies GitHubReadAvailability;
      return {
        collaborators: [],
        teams: [],
        collaboratorsAvailability: availability,
        teamsAvailability: availability
      };
    }

    try {
      return await this.refreshCachePayload(cacheKey, ttlMs, load, options.forceRefresh);
    } catch (error) {
      const expired = this.store.getCacheEntry<RepositoryAccessResult>("github", cacheKey);
      if (expired) {
        console.warn("Control served stale cache for GitHub cache key.", cacheKey, error);
        return expired.payload;
      }
      throw error;
    }
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
      this.failDeviceSignIn(signIn, error instanceof Error ? error.message : "GitHub sign-in failed.");
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

function isGitHubSignInConfigured(): boolean {
  return Boolean(process.env[githubOAuthClientIdEnvironmentVariable]?.trim() || defaultGitHubOAuthClientId);
}

function cachedViewerFromStore(store: LocalStore): Viewer | null {
  const cached = store.getLastAccount<unknown>("github-viewer");
  if (!cached || typeof cached !== "object") {
    return null;
  }

  const record = cached as Record<string, unknown>;
  if (typeof record.login !== "string" || record.login.length === 0) {
    return null;
  }

  return {
    login: record.login,
    name: typeof record.name === "string" ? record.name : null,
    avatarUrl: typeof record.avatarUrl === "string" ? record.avatarUrl : null,
    htmlUrl: typeof record.htmlUrl === "string" ? record.htmlUrl : null
  };
}

function createGitHubAppState({
  settings,
  signInConfigured,
  authenticated,
  viewer,
  user,
  error
}: {
  settings: AppState["settings"];
  signInConfigured: boolean;
  authenticated: boolean;
  viewer: Viewer | null;
  user: string | null;
  error: string | null;
}): AppState {
  const github: GitHubAuthStatus = {
    available: true,
    authenticated,
    signInConfigured,
    user,
    error
  };

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
    },
    administration: repositoryAdministrationFromSummary(summary)
  };
}

function normalizeRepositoryDetailFromCache(detail: RepositoryDetail): RepositoryDetail {
  return {
    ...detail,
    administration: normalizeRepositoryAdministration(detail.administration)
  };
}

function repositoryForkMetadataMissing(detail: RepositoryDetail): boolean {
  return detail.isFork && !detail.parent && !detail.source;
}

function normalizeRepositoryAdministration(
  administration: RepositoryAdministrationMetadata
): RepositoryAdministrationMetadata {
  return {
    ...administration,
    securityAndAnalysis: {
      ...emptyRepositorySecurityAndAnalysis(),
      ...(administration.securityAndAnalysis ?? {})
    }
  };
}

function repositoryCacheIsFresh(
  cache: CachedRepositoryList<unknown> | CachedRepositoryValue<unknown>,
  ttlMs: number
): boolean {
  if (!cache.syncedAt) {
    return false;
  }

  const syncedAt = Date.parse(cache.syncedAt);
  return Number.isFinite(syncedAt) && Date.now() - syncedAt < ttlMs;
}

function areMateriallyEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function logControlLoading(message: string, metadata?: Record<string, unknown>): void {
  if (!controlLoadingLogsEnabled) {
    return;
  }

  if (metadata) {
    console.info("[Control loading]", message, metadata);
    return;
  }

  console.info("[Control loading]", message);
}

function repositoryAdministrationFromSummary(summary: RepositorySummary): RepositoryAdministrationMetadata {
  return {
    visibility: summary.visibility,
    defaultBranch: summary.defaultBranch,
    isPrivate: summary.isPrivate,
    isArchived: false,
    isDisabled: false,
    isTemplate: null,
    allowForking: null,
    webCommitSignoffRequired: null,
    features: {
      issues: null,
      projects: null,
      wiki: null,
      discussions: null
    },
    mergeSettings: {
      allowMergeCommit: null,
      allowSquashMerge: null,
      allowRebaseMerge: null,
      allowAutoMerge: null,
      deleteBranchOnMerge: null,
      allowUpdateBranch: null
    },
    viewerPermissions: {
      admin: null,
      maintain: null,
      push: null,
      triage: null,
      pull: null
    },
    securityAndAnalysis: emptyRepositorySecurityAndAnalysis()
  };
}

function emptyRepositorySecurityAndAnalysis(): RepositoryAdministrationMetadata["securityAndAnalysis"] {
  return {
    advancedSecurity: null,
    codeSecurity: null,
    dependabotAlerts: null,
    dependabotSecurityUpdates: null,
    secretScanning: null,
    secretScanningPushProtection: null,
    secretScanningNonProviderPatterns: null,
    secretScanningValidityChecks: null,
    secretScanningAiDetection: null
  };
}
