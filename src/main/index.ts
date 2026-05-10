import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import type { BrowserWindow as BrowserWindowType } from "electron";
import liquidGlass from "electron-liquid-glass";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type {
  AccountIssueListInput,
  AccountProfileInput,
  AccountPullRequestListInput,
  AccountRepositoryInput,
  ActionsInput,
  AssignableUserListInput,
  BranchListInput,
  BranchProtectionInput,
  CodeScanningAlertsInput,
  ContributorsInput,
  DependabotAlertsInput,
  DiscussionDetailInput,
  DiscussionListInput,
  GitHubMutationInput,
  IssueDetailInput,
  IssueListInput,
  RepositoryLabelListInput,
  NotificationListInput,
  NotificationThreadInput,
  OrganizationListInput,
  OrganizationMembersInput,
  OrganizationProjectsInput,
  OrganizationRepositoriesInput,
  OrganizationTeamMembersInput,
  OrganizationTeamRepositoriesInput,
  OrganizationTeamsInput,
  ProjectsInput,
  PullRequestDetailInput,
  PullRequestListInput,
  ReleasesInput,
  RepoContentsInput,
  RepoDetailInput,
  RepoFileBlameInput,
  RepoFileContentInput,
  RepoListInput,
  RepoReadmeInput,
  RepositoryAccessInput,
  RepositoryCommitListInput,
  RepositoryCommunityProfileInput,
  RepositoryForksInput,
  RepositoryMilestoneListInput,
  RepositoryWikiInput,
  RepositoryRulesetsInput,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityPolicyInput,
  RepoTreeInput,
  SearchInput,
  SecretScanningAlertsInput,
  TagListInput,
  WorkflowJobLogsInput,
  WorkflowListInput,
  WorkflowRunDetailInput
} from "@shared/github";
import { ipcChannels } from "@shared/ipc";
import type {
  LocalRecentListInput,
  LocalRecentMetadata,
  LocalRecentRecordInput,
  RepositoryPinInput
} from "@shared/local";
import { createAppState, GitHubProviderManager } from "./github/provider";
import { createLocalStore, type LocalStore } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindowType | null = null;
let liquidGlassViewId = -1;

if (process.env.CONTROL_USER_DATA_DIR) {
  app.setPath("userData", process.env.CONTROL_USER_DATA_DIR);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1512,
    height: 982,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    title: "Control",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 24, y: 22 },
    backgroundMaterial: process.platform === "win32" ? "mica" : undefined,
    transparent: process.platform === "darwin",
    backgroundColor: process.platform === "darwin" ? "#00000000" : "#eef6ff",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.platform === "darwin") {
    mainWindow.setWindowButtonVisibility(true);
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.once("did-finish-load", () => {
    applyLiquidGlass(mainWindow);
  });
}

function applyLiquidGlass(window: BrowserWindowType | null): void {
  if (!window || process.platform !== "darwin") {
    return;
  }

  try {
    liquidGlassViewId = liquidGlass.addView(window.getNativeWindowHandle(), {
      // tintColor uses #RRGGBBAA byte order (verified in
      // electron-liquid-glass/src/glass_effect.mm). Keep alpha at zero, but
      // use the module's opaque backing so Control is an app surface instead
      // of a full-window lens over whatever sits behind it.
      cornerRadius: 30,
      tintColor: "#FFFFFF00",
      opaque: true
    });

    if (liquidGlassViewId >= 0) {
      // Avoid private material variants by default. Some variants shift hard
      // cyan/yellow between active and inactive window states on macOS 26.
      liquidGlass.unstable_setScrim(liquidGlassViewId, 0);
      liquidGlass.unstable_setSubdued(liquidGlassViewId, 0);
    }
  } catch (error) {
    console.warn("Control could not apply native liquid glass.", error);
  }
}

function requireRepositoryPinInput(input: RepositoryPinInput): string {
  if (!input || typeof input.nameWithOwner !== "string") {
    throw new Error("Repository pins require an owner/repo name.");
  }

  const nameWithOwner = input.nameWithOwner.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(nameWithOwner)) {
    throw new Error("Repository pins require an owner/repo name.");
  }

  return nameWithOwner;
}

function requireRecentListInput(input: LocalRecentListInput = {}): LocalRecentListInput {
  return {
    kind: input.kind ? requireRecentKind(input.kind) : undefined,
    limit: normalizeLocalLimit(input.limit)
  };
}

function requireRecentRecordInput(input: LocalRecentRecordInput): LocalRecentRecordInput {
  if (!input || typeof input !== "object") {
    throw new Error("Recent items require a GitHub item payload.");
  }

  const kind = requireRecentKind(input.kind);
  const itemKey = requireTrimmedText(input.itemKey, "Recent items require an item key.");
  const title = requireTrimmedText(input.title, "Recent items require a title.");
  const subtitle = optionalTrimmedText(input.subtitle);
  const repositoryNameWithOwner = optionalTrimmedText(input.repositoryNameWithOwner);
  const url = optionalTrimmedText(input.url);
  if (url && !url.startsWith("https://")) {
    throw new Error("Recent item URLs must be HTTPS links.");
  }

  return {
    kind,
    itemKey,
    title,
    subtitle,
    repositoryNameWithOwner,
    url,
    metadata: sanitizeRecentMetadata(input.metadata)
  };
}

function requireRecentKind(kind: unknown): LocalRecentRecordInput["kind"] {
  if (
    kind === "repository" ||
    kind === "commit" ||
    kind === "issue" ||
    kind === "pullRequest" ||
    kind === "discussion" ||
    kind === "organization" ||
    kind === "team" ||
    kind === "contributor" ||
    kind === "project" ||
    kind === "release" ||
    kind === "releaseAsset" ||
    kind === "workflowRun" ||
    kind === "workflowArtifact" ||
    kind === "securityItem" ||
    kind === "wikiPage" ||
    kind === "file"
  ) {
    return kind;
  }

  throw new Error("Recent items require a supported GitHub item kind.");
}

function requireTrimmedText(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function optionalTrimmedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeLocalLimit(limit: unknown): number {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.trunc(limit)))
    : 12;
}

function sanitizeRecentMetadata(metadata: unknown): LocalRecentMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.entries(metadata as Record<string, unknown>).reduce<LocalRecentMetadata>(
    (acc, [key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );
}

function registerIpc(store: LocalStore, github: GitHubProviderManager): void {
  ipcMain.handle(ipcChannels.appState, async () => createAppState(store));
  ipcMain.handle(ipcChannels.getSettings, () => store.getSettings());
  ipcMain.handle(ipcChannels.updateSettings, (_event, settings) => store.updateSettings(settings));
  ipcMain.handle(ipcChannels.signInWithGitHub, async () =>
    github.signInWithBrowser((url) => shell.openExternal(url))
  );
  ipcMain.handle(ipcChannels.getGitHubSignIn, () => github.getGitHubSignInState());
  ipcMain.handle(ipcChannels.cancelGitHubSignIn, () => {
    github.cancelWebSignIn();
  });
  ipcMain.handle(ipcChannels.clearGitHubToken, async () => {
    await github.clearToken();
    return createAppState(store);
  });
  ipcMain.handle(ipcChannels.openExternal, async (_event, url: string) => {
    if (!url.startsWith("https://")) {
      throw new Error("Control only opens external HTTPS links.");
    }
    await shell.openExternal(url);
  });
  ipcMain.handle(ipcChannels.listPinnedRepositories, () => store.listPinnedRepositories());
  ipcMain.handle(ipcChannels.pinRepository, (_event, input: RepositoryPinInput) => {
    store.pinRepository(requireRepositoryPinInput(input));
    return store.listPinnedRepositories();
  });
  ipcMain.handle(ipcChannels.unpinRepository, (_event, input: RepositoryPinInput) => {
    store.unpinRepository(requireRepositoryPinInput(input));
    return store.listPinnedRepositories();
  });
  ipcMain.handle(ipcChannels.listRecentItems, (_event, input: LocalRecentListInput = {}) =>
    store.listRecentItems(requireRecentListInput(input))
  );
  ipcMain.handle(ipcChannels.recordRecentItem, (_event, input: LocalRecentRecordInput) => {
    const recent = requireRecentRecordInput(input);
    store.addRecentItem(recent.kind, "github", recent.itemKey, recent);
    return store.listRecentItems({ limit: 12 });
  });

  ipcMain.handle(ipcChannels.githubViewer, () => github.getViewer());
  ipcMain.handle(ipcChannels.githubAccountProfile, (_event, input: AccountProfileInput = {}) =>
    github.getAccountProfile(input)
  );
  ipcMain.handle(ipcChannels.githubAccountProfileWithStatus, (_event, input: AccountProfileInput = {}) =>
    github.getAccountProfileWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubRepositories, (_event, input = {}) => github.listRepositories(input));
  ipcMain.handle(ipcChannels.githubRepositoriesWithStatus, (_event, input: RepoListInput = {}) =>
    github.listRepositoriesWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubAccountRepositories, (_event, input: AccountRepositoryInput = {}) =>
    github.listAccountRepositories(input)
  );
  ipcMain.handle(ipcChannels.githubAccountRepositoriesWithStatus, (_event, input: AccountRepositoryInput = {}) =>
    github.listAccountRepositoriesWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubOrganizations, (_event, input: OrganizationListInput = {}) =>
    github.listOrganizations(input)
  );
  ipcMain.handle(ipcChannels.githubOrganizationsWithStatus, (_event, input: OrganizationListInput = {}) =>
    github.listOrganizationsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubOrganizationTeams, (_event, input: OrganizationTeamsInput) =>
    github.listOrganizationTeams(input)
  );
  ipcMain.handle(ipcChannels.githubOrganizationTeamsWithStatus, (_event, input: OrganizationTeamsInput) =>
    github.listOrganizationTeamsWithStatus(input)
  );
  ipcMain.handle(
    ipcChannels.githubOrganizationRepositoriesWithStatus,
    (_event, input: OrganizationRepositoriesInput) => github.listOrganizationRepositoriesWithStatus(input)
  );
  ipcMain.handle(
    ipcChannels.githubOrganizationTeamRepositoriesWithStatus,
    (_event, input: OrganizationTeamRepositoriesInput) =>
      github.listOrganizationTeamRepositoriesWithStatus(input)
  );
  ipcMain.handle(
    ipcChannels.githubOrganizationTeamMembersWithStatus,
    (_event, input: OrganizationTeamMembersInput) => github.listOrganizationTeamMembersWithStatus(input)
  );
  ipcMain.handle(
    ipcChannels.githubOrganizationMembersWithStatus,
    (_event, input: OrganizationMembersInput) => github.listOrganizationMembersWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubOrganizationProjectsWithStatus, (_event, input: OrganizationProjectsInput) =>
    github.listOrganizationProjectsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubAccountIssues, (_event, input: AccountIssueListInput = {}) =>
    github.listAccountIssues(input)
  );
  ipcMain.handle(ipcChannels.githubAccountIssuesWithStatus, (_event, input: AccountIssueListInput = {}) =>
    github.listAccountIssuesWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubAccountPullRequests, (_event, input: AccountPullRequestListInput = {}) =>
    github.listAccountPullRequests(input)
  );
  ipcMain.handle(
    ipcChannels.githubAccountPullRequestsWithStatus,
    (_event, input: AccountPullRequestListInput = {}) => github.listAccountPullRequestsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubNotifications, (_event, input: NotificationListInput = {}) =>
    github.listNotifications(input)
  );
  ipcMain.handle(ipcChannels.githubNotificationsWithStatus, (_event, input: NotificationListInput = {}) =>
    github.listNotificationsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubNotificationThreadRead, (_event, input: NotificationThreadInput) =>
    github.markNotificationThreadRead(input)
  );
  ipcMain.handle(ipcChannels.githubNotificationThreadUnsubscribe, (_event, input: NotificationThreadInput) =>
    github.unsubscribeNotificationThread(input)
  );
  ipcMain.handle(ipcChannels.githubRepository, (_event, input: RepoDetailInput) =>
    github.getRepository(input.owner, input.repo, { cacheOnly: input.cacheOnly, forceRefresh: input.forceRefresh })
  );
  ipcMain.handle(ipcChannels.githubRepositoryWithStatus, (_event, input: RepoDetailInput) =>
    github.getRepositoryWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubRepositoryForks, (_event, input: RepositoryForksInput) =>
    github.listRepositoryForks(input)
  );
  ipcMain.handle(ipcChannels.githubBranches, (_event, input: BranchListInput) => github.listBranches(input));
  ipcMain.handle(ipcChannels.githubBranchesWithStatus, (_event, input: BranchListInput) =>
    github.listBranchesWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubTags, (_event, input: TagListInput) => github.listTags(input));
  ipcMain.handle(ipcChannels.githubTagsWithStatus, (_event, input: TagListInput) => github.listTagsWithStatus(input));
  ipcMain.handle(ipcChannels.githubTree, (_event, input: RepoTreeInput) => github.listTree(input));
  ipcMain.handle(ipcChannels.githubTreeWithStatus, (_event, input: RepoTreeInput) =>
    github.listTreeWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubReadme, (_event, input: RepoReadmeInput) => github.getReadme(input));
  ipcMain.handle(ipcChannels.githubContents, (_event, input: RepoContentsInput) =>
    github.listContents(input)
  );
  ipcMain.handle(ipcChannels.githubContentsWithStatus, (_event, input: RepoContentsInput) =>
    github.listContentsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubFileContent, (_event, input: RepoFileContentInput) =>
    github.getFileContent(input)
  );
  ipcMain.handle(ipcChannels.githubFileContentWithStatus, (_event, input: RepoFileContentInput) =>
    github.getFileContentWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubFileBlame, (_event, input: RepoFileBlameInput) =>
    github.getFileBlame(input)
  );
  ipcMain.handle(ipcChannels.githubRepositoryWiki, (_event, input: RepositoryWikiInput) =>
    github.getRepositoryWiki(input)
  );
  ipcMain.handle(ipcChannels.githubCommits, (_event, input: RepositoryCommitListInput) =>
    github.listCommits(input)
  );
  ipcMain.handle(ipcChannels.githubCommitsWithStatus, (_event, input: RepositoryCommitListInput) =>
    github.listCommitsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubLabels, (_event, input: RepositoryLabelListInput) =>
    github.listLabels(input)
  );
  ipcMain.handle(ipcChannels.githubLabelsWithStatus, (_event, input: RepositoryLabelListInput) =>
    github.listLabelsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubAssignableUsers, (_event, input: AssignableUserListInput) =>
    github.listAssignableUsers(input)
  );
  ipcMain.handle(ipcChannels.githubAssignableUsersWithStatus, (_event, input: AssignableUserListInput) =>
    github.listAssignableUsersWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubRepositoryAccess, (_event, input: RepositoryAccessInput) =>
    github.getRepositoryAccess(input)
  );
  ipcMain.handle(ipcChannels.githubMilestones, (_event, input: RepositoryMilestoneListInput) =>
    github.listMilestones(input)
  );
  ipcMain.handle(ipcChannels.githubMilestonesWithStatus, (_event, input: RepositoryMilestoneListInput) =>
    github.listMilestonesWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubIssues, (_event, input: IssueListInput) => github.listIssues(input));
  ipcMain.handle(ipcChannels.githubIssuesWithStatus, (_event, input: IssueListInput) =>
    github.listIssuesWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubIssueDetail, (_event, input: IssueDetailInput) =>
    github.getIssueDetail(input)
  );
  ipcMain.handle(ipcChannels.githubIssueDetailWithStatus, (_event, input: IssueDetailInput) =>
    github.getIssueDetailWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubPullRequests, (_event, input: PullRequestListInput) =>
    github.listPullRequests(input)
  );
  ipcMain.handle(ipcChannels.githubPullRequestsWithStatus, (_event, input: PullRequestListInput) =>
    github.listPullRequestsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubPullRequestDetail, (_event, input: PullRequestDetailInput) =>
    github.getPullRequestDetail(input)
  );
  ipcMain.handle(ipcChannels.githubPullRequestDetailWithStatus, (_event, input: PullRequestDetailInput) =>
    github.getPullRequestDetailWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubDiscussions, (_event, input: DiscussionListInput) =>
    github.listDiscussions(input)
  );
  ipcMain.handle(ipcChannels.githubDiscussionsWithStatus, (_event, input: DiscussionListInput) =>
    github.listDiscussionsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubDiscussionDetail, (_event, input: DiscussionDetailInput) =>
    github.getDiscussionDetail(input)
  );
  ipcMain.handle(ipcChannels.githubActions, (_event, input: ActionsInput) => github.listActions(input));
  ipcMain.handle(ipcChannels.githubActionsWithStatus, (_event, input: ActionsInput) =>
    github.listActionsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubWorkflows, (_event, input: WorkflowListInput) =>
    github.listWorkflows(input)
  );
  ipcMain.handle(ipcChannels.githubWorkflowsWithStatus, (_event, input: WorkflowListInput) =>
    github.listWorkflowsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubWorkflowRunDetail, (_event, input: WorkflowRunDetailInput) =>
    github.getWorkflowRunDetail(input)
  );
  ipcMain.handle(ipcChannels.githubWorkflowRunDetailWithStatus, (_event, input: WorkflowRunDetailInput) =>
    github.getWorkflowRunDetailWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubWorkflowJobLogs, (_event, input: WorkflowJobLogsInput) =>
    github.getWorkflowJobLogs(input)
  );
  ipcMain.handle(ipcChannels.githubProjects, (_event, input: ProjectsInput) => github.listProjects(input));
  ipcMain.handle(ipcChannels.githubProjectsWithStatus, (_event, input: ProjectsInput) =>
    github.listProjectsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubBranchProtection, (_event, input: BranchProtectionInput) =>
    github.getBranchProtection(input)
  );
  ipcMain.handle(ipcChannels.githubDependabotAlerts, (_event, input: DependabotAlertsInput) =>
    github.listDependabotAlerts(input)
  );
  ipcMain.handle(ipcChannels.githubCodeScanningAlerts, (_event, input: CodeScanningAlertsInput) =>
    github.listCodeScanningAlerts(input)
  );
  ipcMain.handle(ipcChannels.githubSecretScanningAlerts, (_event, input: SecretScanningAlertsInput) =>
    github.listSecretScanningAlerts(input)
  );
  ipcMain.handle(ipcChannels.githubRepositoryRulesets, (_event, input: RepositoryRulesetsInput) =>
    github.listRepositoryRulesets(input)
  );
  ipcMain.handle(
    ipcChannels.githubRepositorySecurityAdvisories,
    (_event, input: RepositorySecurityAdvisoriesInput) => github.listRepositorySecurityAdvisories(input)
  );
  ipcMain.handle(ipcChannels.githubRepositorySecurityPolicy, (_event, input: RepositorySecurityPolicyInput) =>
    github.getRepositorySecurityPolicy(input)
  );
  ipcMain.handle(ipcChannels.githubRepositoryCommunityProfile, (_event, input: RepositoryCommunityProfileInput) =>
    github.getRepositoryCommunityProfile(input)
  );
  ipcMain.handle(ipcChannels.githubReleases, (_event, input: ReleasesInput) => github.listReleases(input));
  ipcMain.handle(ipcChannels.githubReleasesWithStatus, (_event, input: ReleasesInput) =>
    github.listReleasesWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubContributors, (_event, input: ContributorsInput) =>
    github.listContributors(input)
  );
  ipcMain.handle(ipcChannels.githubContributorsWithStatus, (_event, input: ContributorsInput) =>
    github.listContributorsWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubSearch, (_event, input: SearchInput) => github.search(input));
  ipcMain.handle(ipcChannels.githubSearchWithStatus, (_event, input: SearchInput) =>
    github.searchWithStatus(input)
  );
  ipcMain.handle(ipcChannels.githubMutate, (_event, input: GitHubMutationInput) => github.mutate(input));
}

app.commandLine.appendSwitch("enable-features", "PlatformHEVCDecoderSupport");
nativeTheme.themeSource = "light";

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  void bootstrap();
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  const store = await createLocalStore(app.getPath("userData"));
  const github = new GitHubProviderManager(store, (nameWithOwner) => {
    mainWindow?.webContents.send(ipcChannels.githubRepositoriesUpdated, { nameWithOwner });
  });

  registerIpc(store, github);
  createWindow();
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
