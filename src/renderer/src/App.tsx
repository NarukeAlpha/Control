import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AreaSummary } from "@shared/areas";
import { MarkdownUrlHandlerContext } from "./components/MarkdownBody";
import { AreaDeleteDialog, AreaEditDialog, SshAreaDialog } from "./components/areas/AreaDialogs";
import { LocalAreaHome } from "./components/areas/LocalAreaHome";
import { SetupPanel } from "./components/auth/SetupPanel";
import { useAreasShell } from "./components/areas/useAreasShell";
import { useProviderAuth } from "./components/auth/AuthProvider";
import { CodeBrowserPage } from "./components/code-browser/CodeBrowserPage";
import { useCodeBrowserQueries } from "./components/code-browser/codeBrowserQueries";
import { RepositoriesRoute } from "./components/collection/RepositoriesRoute";
import { MailboxRoute } from "./components/collection/MailboxRoute";
import { OrganizationsRoute } from "./components/collection/OrganizationsRoute";
import { useOrganizationsRouteState } from "./components/collection/useOrganizationsRouteState";
import { CommandPalette, type CommandPaletteItem } from "./components/command-palette/CommandPalette";
import {
  appendAccountWorkCommandPaletteItems,
  appendCurrentRepositoryCommandPaletteItems,
  appendNotificationCommandPaletteItems,
  appendOrganizationCommandPaletteItems,
  appendPinnedRepositoryCommandPaletteItems,
  appendRepositoryAdminCommandPaletteItems,
  appendRepositoryContentCommandPaletteItems,
  appendRepositoryReleaseCommandPaletteItems,
  appendRepositorySecurityCommandPaletteItems,
  appendRepositoryWorkflowCommandPaletteItems,
  appendShellCommandPaletteItems,
  cachedRepositoryAccess,
  cachedRepositoryForks,
  cachedRepositorySecurityCommandItems,
  cachedWorkflowRunDetail,
  appendRecentCommandPaletteItems,
  appendRepositoryCommandPaletteItems,
  cachedRepositoryWikiPages
} from "./components/command-palette/commandPaletteItemBuilders";
import { AddRepositoryDialog } from "./components/dialogs/AddRepositoryDialog";
import { FileFinder } from "./components/file-finder/FileFinder";
import { HomeDashboard } from "./components/home/HomeDashboard";
import { LocalRepositoryPage } from "./components/local-repository/LocalRepositoryPage";
import { RepositoryPage } from "./components/repository/RepositoryPage";
import {
  RepositoryContextProvider,
  type RepositoryContextValue
} from "./components/repository/RepositoryContext";
import { useActionsTabQueries } from "./components/repository/actions/ActionsTab";
import { useCodeTabQueries } from "./components/repository/code/CodeTab";
import { useContributorsTabQueries } from "./components/repository/contributors/ContributorsTab";
import { useDiscussionsTabQueries } from "./components/repository/discussions/DiscussionsTab";
import { useIssuesTabQueries } from "./components/repository/issues/IssuesTab";
import { createGitHubMutationInput } from "./components/repository/githubMutationHelpers";
import { useProjectsTabQueries } from "./components/repository/projects/ProjectsTab";
import { usePullRequestsTabQueries } from "./components/repository/pull-requests/PullRequestsTab";
import { useReleasesTabQueries } from "./components/repository/releases/ReleasesTab";
import { RightRail } from "./components/right-rail/RightRail";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { Sidebar } from "./components/sidebar/Sidebar";
import { AppEventBridge } from "./components/shell/AppEventBridge";
import {
  invalidateGitHubMutationQueries,
  type RepositoryQueryScope
} from "./components/shell/appInvalidations";
import { TopBar } from "./components/topbar/TopBar";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryMutationDisabledReason
} from "./components/repository/repositoryUi";

import { useAccountProfile } from "./hooks/useAccountProfile";
import { useAccountWork } from "./hooks/useAccountWork";
import { useCollectionRefreshActions } from "./hooks/useCollectionRefreshActions";
import { useControlApi } from "./hooks/useControlApi";
import { useMailboxNotifications } from "./hooks/useMailboxNotifications";
import { useRecentItems } from "./hooks/useRecentItems";
import { useRepositoryDirectory } from "./hooks/useRepositoryDirectory";
import { useRepositoryDetail } from "./hooks/useRepositoryDetail";
import { useRepositoryPins } from "./hooks/useRepositoryPins";
import { useRepositoryRefs } from "./hooks/useRepositoryRefs";
import { useAppNavigationActions } from "./hooks/useAppNavigationActions";
import { useCollectionSurfaceState } from "./hooks/useCollectionSurfaceState";
import { useRepositoryRefreshActions } from "./hooks/useRepositoryRefreshActions";
import { useRepositorySurfaceLimits } from "./hooks/useRepositorySurfaceLimits";
import { useRepositoryWarmPrefetch } from "./hooks/useRepositoryWarmPrefetch";
import { useStoredRepositoryRefs } from "./hooks/useStoredRepositoryRefs";
import { useUiStore, type AppRoute } from "./stores/uiStore";

const commandPaletteGeneralSourceLimit = 50;
const commandPaletteDenseSourceLimit = 30;
const commandPaletteSecuritySourceLimit = 30;

function routeTitle(route: AppRoute): string {
  switch (route.kind) {
    case "mailbox":
      return "Mailbox";
    case "repositories":
      return "Repositories";
    case "organizations":
      return "Organizations";
    case "repository":
      return route.nameWithOwner;
    case "codeBrowser":
      return `${route.nameWithOwner}/${route.path}`;
    case "localRepository":
      return "Local repository";
    case "home":
    default:
      return "Home";
  }
}

export function App(): JSX.Element {
  const api = useControlApi();
  const providerAuth = useProviderAuth();
  const queryClient = useQueryClient();
  const route = useUiStore((state) => state.route);
  const selectedRepository = useUiStore((state) => state.selectedRepository);
  const goToLocalRepository = useUiStore((state) => state.goToLocalRepository);
  const goHome = useUiStore((state) => state.goHome);
  const goToRepositories = useUiStore((state) => state.goToRepositories);
  const goToMailbox = useUiStore((state) => state.goToMailbox);
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [addRepositoryOpen, setAddRepositoryOpen] = useState(false);
  const [sshAreaOpen, setSshAreaOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaSummary | null>(null);
  const [deletingArea, setDeletingArea] = useState<AreaSummary | null>(null);
  const [repositoryRefs, setRepositoryRefs] = useStoredRepositoryRefs();
  const [fileFinderOpen, setFileFinderOpen] = useState(false);

  const appState = useQuery({
    queryKey: ["app-state"],
    queryFn: () => api.getAppState()
  });
  const githubAuthenticated = appState.data?.github.authenticated ?? false;
  const githubReady = appState.isSuccess && githubAuthenticated;
  const authenticatedViewerLogin = appState.data?.github.user ?? appState.data?.viewer?.login ?? null;
  const {
    areaItems,
    selectedArea,
    selectedAreaIsGateway,
    selectedAreaRepositories,
    localRepositoryItems,
    selectArea,
    addLocalArea,
    createSshArea,
    updateArea,
    deleteArea,
    refreshSelectedArea,
    stopSelectedAreaGateway
  } = useAreasShell({ enabled: appState.isSuccess });

  const {
    repositoryListLimit,
    homeRepositoryActivityLimit,
    homeWorkLimit,
    mailboxWorkLimit,
    recentItemLimit,
    notificationFilter,
    accountWorkLimit,
    notificationLimit,
    maxHomeWorkLimit,
    setNotificationFilter,
    expandMailboxWork,
    loadMoreHomeWork,
    loadMoreHomeRepositoryActivity,
    expandMailboxNotifications,
    expandRepositoryList
  } = useCollectionSurfaceState({
    activeRouteKind: route.kind
  });

  const repositories = useRepositoryDirectory(repositoryListLimit, {
    enabled: appState.isSuccess,
    githubReady
  });
  const repositoryItems = useMemo(() => repositories.data?.items ?? [], [repositories.data]);
  const repositoriesAvailabilityMessage =
    repositories.data?.availability?.status === "stale"
      ? null
      : readAvailabilityMessage("Repositories", repositories.data?.availability ?? null);

  const {
    repositoryPinRecords,
    pinnedRepositoryNames,
    isRepositoryPinned,
    isAreaRepositoryPinned,
    repositoryPinBusy,
    repositoryPinError,
    toggleRepositoryPin,
    toggleAreaRepositoryPin
  } = useRepositoryPins();

  const recentItems = useRecentItems(recentItemLimit, { enabled: appState.isSuccess });

  const accountProfile = useAccountProfile({ enabled: appState.isSuccess, githubReady });
  const accountProfileData = accountProfile.data?.profile ?? null;
  const accountProfileAvailabilityMessage = readAvailabilityMessage(
    "Account profile",
    accountProfile.data?.availability ?? null
  );

  const { issues: accountIssues, pulls: accountPulls } = useAccountWork(
    authenticatedViewerLogin,
    accountWorkLimit,
    {
      enabled: appState.isSuccess && (route.kind === "home" || route.kind === "mailbox"),
      githubReady
    }
  );
  const accountIssueItems = accountIssues.data?.items ?? [];
  const accountIssuesAvailability = accountIssues.data?.availability ?? null;
  const accountPullItems = accountPulls.data?.items ?? [];
  const accountPullsAvailability = accountPulls.data?.availability ?? null;

  const { notifications, notificationItems, markNotificationRead, markVisibleNotificationsRead } =
    useMailboxNotifications({
      filter: notificationFilter,
      limit: notificationLimit,
      enabled: appState.isSuccess && route.kind === "mailbox",
      githubReady
    });

  const organizationsRouteState = useOrganizationsRouteState({
    appReady: appState.isSuccess,
    enabled: appState.isSuccess && route.kind === "organizations",
    githubReady,
    recentItemLimit
  });

  const isRepositoryRoute = route.kind === "repository";
  const isCodeBrowserRoute = route.kind === "codeBrowser";
  const isLocalRepositoryRoute = route.kind === "localRepository";
  const isRepositoryContext = isRepositoryRoute || isCodeBrowserRoute;
  const activeRepositoryTab = isRepositoryRoute ? route.tab : "code";
  const activeLocalRepositoryTab = isLocalRepositoryRoute ? route.tab : "overview";
  const activeLocalRepositoryPath = isLocalRepositoryRoute ? (route.path ?? ".") : ".";
  const effectiveRepository = isRepositoryContext ? route.nameWithOwner : (selectedRepository ?? "");
  const [owner = "", repo = ""] = effectiveRepository.split("/");
  const hasRepositoryParts = Boolean(owner && repo);
  const activeRepositoryScope = useMemo<RepositoryQueryScope | null>(
    () => (hasRepositoryParts ? { owner, repo } : null),
    [hasRepositoryParts, owner, repo]
  );
  const repositoryContextValue = useMemo<RepositoryContextValue | null>(
    () =>
      hasRepositoryParts
        ? {
            owner,
            repo,
            nameWithOwner: effectiveRepository,
            githubReady,
            api,
            queryClient
          }
        : null,
    [api, effectiveRepository, githubReady, hasRepositoryParts, owner, queryClient, repo]
  );
  const codeBrowserPath = isCodeBrowserRoute ? route.path : "";
  const codeBrowserEntryType = isCodeBrowserRoute ? route.entryType : "dir";
  const codeBrowserRef = isCodeBrowserRoute ? route.ref : null;
  const repositorySelectedRef = repositoryRefs[effectiveRepository] ?? null;
  const contentsRef = isCodeBrowserRoute ? codeBrowserRef : repositorySelectedRef;
  const {
    repositoryRefListLimit,
    maxRefListLimit,
    repositoryContributorLimit,
    forksLimit,
    repositoryAccessLimit,
    actionsLimit,
    workflowDefinitionLimit,
    projectsLimit,
    releasesLimit,
    discussionsLimit,
    issueListLimit,
    pullRequestListLimit,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    repositoryCommitHistoryLimit,
    fileCommitHistoryLimit,
    fileBlameRangeLimit,
    expandActiveRepositoryRefs,
    expandRepositoryCommitHistory,
    expandFileCommitHistory,
    expandFileBlamePreview,
    expandActiveRepositoryContributors,
    expandActiveRepositoryForks,
    expandActiveRepositoryAccess,
    expandActiveRepositoryActions,
    expandActiveRepositoryWorkflowDefinitions,
    expandActiveRepositoryProjects,
    expandActiveRepositoryReleases,
    expandActiveRepositoryDiscussions,
    expandActiveRepositoryIssues,
    expandActiveRepositoryPullRequests,
    expandActiveRepositorySecurityList
  } = useRepositorySurfaceLimits({
    effectiveRepository,
    owner,
    repo,
    repositorySelectedRef,
    codeBrowserRef,
    contentsRef,
    codeBrowserPath
  });

  const repository = useRepositoryDetail({
    owner,
    repo,
    enabled: appState.isSuccess && isRepositoryContext && hasRepositoryParts,
    githubReady
  });
  const repositoryDetail = repository.data?.detail ?? null;
  const repositoryAvailabilityMessage = readAvailabilityMessage(
    "Repository detail",
    repository.data?.availability ?? null
  );

  const repositoryRefQueries = useRepositoryRefs(
    owner,
    repo,
    {
      branches: appState.isSuccess && hasRepositoryParts && isRepositoryContext,
      tags: appState.isSuccess && hasRepositoryParts && isRepositoryContext
    },
    repositoryRefListLimit,
    { githubReady }
  );
  const {
    branches,
    tags,
    branchItems,
    tagItems,
    availabilityMessage: refsAvailabilityMessage,
    error: refsError
  } = repositoryRefQueries;
  const {
    openRepositoryInApp,
    openLocalRepositoryInApp,
    openRepositoryRouteInApp,
    selectRepositoryTabInApp,
    openFilteredRepositorySurfaceInApp,
    openCodeBrowserInApp,
    repositoryRefKindForName,
    selectRepositoryRefInApp,
    selectSecurityQualityBranchInApp,
    openCommitInApp,
    openPullRequestCommitInApp,
    openPullRequestReviewCommitInApp,
    openPullRequestTimelineEventCommitInApp,
    openWorkflowRunCommitInApp,
    openWorkflowCheckSuiteCommitInApp,
    openCodePathInApp,
    selectIssueInApp,
    selectPullRequestInApp,
    openLinkedIssueInApp,
    selectDiscussionInApp,
    selectProjectInApp,
    selectOrganizationProjectInApp,
    openTeamInApp,
    selectWorkflowRunInApp,
    selectWorkflowArtifactInApp,
    selectSecurityItemInApp,
    selectWikiPageInApp,
    openWorkflowRunReferenceInApp,
    selectReleaseInApp,
    selectReleaseAssetInApp,
    selectContributorInApp,
    selectRepositorySettingsCollaboratorInApp,
    openIssueSummaryInApp,
    openPullRequestSummaryInApp,
    openNotificationInApp,
    openRecentItem,
    openMarkdownUrl
  } = useAppNavigationActions({
    effectiveRepository,
    contentsRef,
    repositoryRefs,
    setRepositoryRefs,
    repositoryDetail,
    repositoryItems,
    branchItems,
    tagItems,
    recentItemLimit,
    githubReady,
    markNotificationRead,
    setSelectedOrganizationLogin: organizationsRouteState.setSelectedOrganizationLogin,
    setSelectedOrganizationTeamSlug: organizationsRouteState.setSelectedOrganizationTeamSlug,
    setSelectedOrganizationMemberLogin: organizationsRouteState.setSelectedOrganizationMemberLogin,
    setSelectedOrganizationProjectId: organizationsRouteState.setSelectedOrganizationProjectId
  });

  const codeTabQueries = useCodeTabQueries({
    owner,
    repo,
    selectedRef: repositorySelectedRef,
    defaultBranch: repositoryDetail?.defaultBranch ?? null,
    commitHistoryLimit: repositoryCommitHistoryLimit,
    selectedRootMarkdownPath: null,
    enabled: appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "code" && hasRepositoryParts,
    githubReady
  });
  const { repositoryCommits, repositoryCommitItems, repositoryCommitsAvailability } = codeTabQueries;

  useIssuesTabQueries({
    owner,
    repo,
    issueListLimit,
    issuesEnabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      (activeRepositoryTab === "issues" || activeRepositoryTab === "agents") &&
      hasRepositoryParts,
    resourcesEnabled: false,
    githubReady
  });

  usePullRequestsTabQueries({
    owner,
    repo,
    pullRequestListLimit,
    pullsEnabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      (activeRepositoryTab === "pulls" || activeRepositoryTab === "agents") &&
      hasRepositoryParts,
    resourcesEnabled:
      appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "pulls" && hasRepositoryParts,
    githubReady
  });

  const {
    codeBrowserContents,
    fileContent,
    fileBlame,
    fileCommits,
    repositoryTree,
    contentItems,
    contentsAvailability,
    fileCommitItems,
    fileCommitsAvailability,
    fileContentItem,
    fileContentAvailabilityMessage,
    repositoryTreeItem,
    repositoryTreeAvailabilityMessage
  } = useCodeBrowserQueries({
    api,
    appReady: appState.isSuccess,
    githubReady,
    owner,
    repo,
    hasRepositoryParts,
    isCodeBrowserRoute,
    codeBrowserPath,
    codeBrowserEntryType,
    codeBrowserRef,
    contentsRef,
    defaultBranch: repositoryDetail?.defaultBranch ?? null,
    fileBlameRangeLimit,
    fileCommitHistoryLimit,
    fileFinderOpen,
    repositoryLoaded: Boolean(repositoryDetail)
  });

  const { discussions } = useDiscussionsTabQueries({
    owner,
    repo,
    limit: discussionsLimit,
    enabled:
      appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "discussions" && hasRepositoryParts,
    githubReady
  });

  const { actions } = useActionsTabQueries({
    owner,
    repo,
    limit: actionsLimit,
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      (activeRepositoryTab === "actions" || activeRepositoryTab === "agents") &&
      hasRepositoryParts,
    githubReady
  });

  useRepositoryWarmPrefetch({
    appReady: appState.isSuccess,
    enabled: isRepositoryRoute && hasRepositoryParts,
    owner,
    repo,
    selectedRef: repositorySelectedRef,
    defaultBranch: repositoryDetail?.defaultBranch ?? null,
    commitHistoryLimit: repositoryCommitHistoryLimit,
    issueListLimit,
    pullRequestListLimit,
    actionsLimit,
    githubReady
  });

  const { projects } = useProjectsTabQueries({
    owner,
    repo,
    limit: projectsLimit,
    enabled:
      appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "projects" && hasRepositoryParts,
    githubReady
  });
  const branchProtectionBranch =
    repositorySelectedRef && branchItems.some((branch) => branch.name === repositorySelectedRef)
      ? repositorySelectedRef
      : (repositoryDetail?.defaultBranch ?? null);

  const { releases } = useReleasesTabQueries({
    owner,
    repo,
    limit: releasesLimit,
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "releases" &&
      hasRepositoryParts &&
      repository.isSuccess,
    githubReady
  });

  const { contributors } = useContributorsTabQueries({
    owner,
    repo,
    limit: repositoryContributorLimit,
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "contributors" &&
      hasRepositoryParts &&
      repository.isSuccess,
    githubReady
  });
  const releaseItems = releases.data?.items ?? [];
  const releasesAvailability = releases.data?.availability ?? null;
  const contributorItems = contributors.data?.items ?? [];
  const contributorsAvailability = contributors.data?.availability ?? null;
  const actionItems = actions.data?.items ?? [];
  const { refreshRepositoryDetailNow, refreshCodeBrowserNow, refreshRepositorySurface } =
    useRepositoryRefreshActions({
      appReady: appState.isSuccess,
      githubReady,
      owner,
      repo,
      hasRepositoryParts,
      activeRepositoryTab,
      route,
      repositoryDetail,
      contentsRef,
      codeBrowserRef,
      codeBrowserPath,
      codeBrowserEntryType,
      branchProtectionBranch,
      repositoryRefListLimit,
      repositoryContributorLimit,
      repositoryCommitHistoryLimit,
      fileCommitHistoryLimit,
      fileBlameRangeLimit,
      issueListLimit,
      pullRequestListLimit,
      discussionsLimit,
      projectsLimit,
      releasesLimit,
      actionsLimit,
      workflowDefinitionLimit,
      dependabotAlertsLimit,
      codeScanningAlertsLimit,
      secretScanningAlertsLimit,
      repositoryRulesetsLimit,
      repositorySecurityAdvisoriesLimit,
      repositoryAccessLimit,
      forksLimit
    });
  const { refreshHomeNow, refreshRepositoriesNow, refreshMailboxNow } = useCollectionRefreshActions({
    appReady: appState.isSuccess,
    githubReady,
    authenticatedViewerLogin,
    repositoryListLimit,
    homeRefreshWorkLimit: maxHomeWorkLimit,
    recentItemLimit,
    mailboxWorkLimit,
    notificationFilter,
    notificationLimit
  });
  async function refreshOrganizationsNow(): Promise<void> {
    await Promise.all([organizationsRouteState.refreshNow(), refreshRepositoriesNow()]);
  }

  const mutation = useMutation({
    mutationFn: api.github.mutate,
    onSuccess: async (_result, input) => {
      await invalidateGitHubMutationQueries(queryClient, input);
    }
  });
  const commandPaletteItems = (() => {
    const repositoriesRefreshDisabledReason = repositories.isFetching
      ? "Repositories are already refreshing."
      : null;
    const mailboxRefreshInFlight =
      notifications.isFetching || accountIssues.isFetching || accountPulls.isFetching;
    const mailboxRefreshDisabledReason = mailboxRefreshInFlight
      ? "Mailbox data is already refreshing."
      : null;
    const loadedUnreadNotificationIds = notificationItems
      .filter((notification) => notification.unread)
      .map((notification) => notification.id);
    const markLoadedNotificationsReadDisabledReason = markVisibleNotificationsRead.isPending
      ? "Notifications are already being marked as read."
      : !githubReady
        ? "Sign in with GitHub to mark notifications as read."
        : notifications.isLoading
          ? "Notifications are still loading."
          : loadedUnreadNotificationIds.length === 0
            ? "No loaded unread notifications."
            : null;
    const organizationsRefreshDisabledReason = organizationsRouteState.refreshInFlight
      ? "Organization data is already refreshing."
      : null;

    const items: CommandPaletteItem[] = [];
    appendShellCommandPaletteItems(items, {
      githubReady,
      homeRefreshDisabledReason:
        appState.isFetching || repositories.isFetching || accountProfile.isFetching
          ? "Home data is already refreshing."
          : null,
      repositoriesRefreshDisabledReason,
      organizationsRefreshDisabledReason,
      mailboxRefreshDisabledReason,
      markLoadedNotificationsReadDisabledReason,
      onGoHome: goHome,
      onOpenRepositories: goToRepositories,
      onOpenAddRepository: () => setAddRepositoryOpen(true),
      onRefreshHome: () => {
        void refreshHomeNow();
      },
      onRefreshRepositories: () => {
        void refreshRepositoriesNow();
      },
      onOpenOrganizations: organizationsRouteState.openOrganizations,
      onRefreshOrganizations: () => {
        void refreshOrganizationsNow();
      },
      onOpenMailbox: goToMailbox,
      onRefreshMailbox: () => {
        void refreshMailboxNow();
      },
      onMarkLoadedNotificationsRead: () => {
        markVisibleNotificationsRead.mutate({ threadIds: loadedUnreadNotificationIds });
      }
    });

    appendOrganizationCommandPaletteItems(items, {
      organizationItems: organizationsRouteState.organizationItems,
      organizationTeams: organizationsRouteState.organizationTeams,
      organizationRepositories: organizationsRouteState.organizationRepositories,
      organizationTeamRepositories: organizationsRouteState.organizationTeamRepositories,
      organizationProjects: organizationsRouteState.organizationProjects,
      organizationMembers: organizationsRouteState.organizationMembers,
      organizationTeamMembers: organizationsRouteState.organizationTeamMembers,
      selectedOrganization: organizationsRouteState.selectedOrganization,
      selectedOrganizationTeam: organizationsRouteState.selectedOrganizationTeam,
      generalSourceLimit: commandPaletteGeneralSourceLimit,
      denseSourceLimit: commandPaletteDenseSourceLimit,
      onOpenOrganization: organizationsRouteState.openOrganization,
      onOpenTeam: organizationsRouteState.openTeam,
      onOpenRepository: openRepositoryInApp,
      onOpenOrganizationMember: organizationsRouteState.openOrganizationMember,
      onOpenOrganizationTeamMember: organizationsRouteState.openOrganizationTeamMember,
      onSelectOrganizationProject: selectOrganizationProjectInApp
    });

    appendNotificationCommandPaletteItems(items, {
      notificationItems,
      limit: commandPaletteGeneralSourceLimit,
      onOpenNotification: openNotificationInApp
    });
    appendAccountWorkCommandPaletteItems(items, {
      accountIssueItems,
      accountPullItems,
      limit: commandPaletteGeneralSourceLimit,
      onOpenIssue: openIssueSummaryInApp,
      onOpenPullRequest: openPullRequestSummaryInApp
    });

    items.push({
      id: "command-settings",
      title: "Settings",
      subtitle: "Open Control settings",
      group: "Commands",
      icon: Settings,
      keywords: ["account", "oauth", "preferences"],
      run: () => setSettingsOpen(true)
    });

    if (effectiveRepository) {
      const currentRepositoryMatches =
        repositoryDetail?.nameWithOwner.toLowerCase() === effectiveRepository.toLowerCase();
      const repositoryCommandDisabledReason = !githubReady
        ? "Sign in with GitHub to run repository mutations."
        : !repositoryDetail && (repository.isLoading || repository.isFetching)
          ? "Repository details are still loading."
          : !repositoryDetail && repository.error
            ? `Repository details unavailable: ${repository.error.message}`
            : !repositoryDetail && repositoryAvailabilityMessage
              ? repositoryAvailabilityMessage
              : currentRepositoryMatches
                ? repositoryMutationDisabledReason(repositoryDetail)
                : "Open the repository before running mutation commands.";
      const repositoryRefreshDisabledReason = repository.isFetching
        ? "Repository refresh is already running."
        : null;
      const currentRepositoryPinned = isRepositoryPinned(effectiveRepository);
      const repositoryPinCommandDisabledReason = repositoryPinBusy
        ? "Repository pin update is already running."
        : null;
      appendRepositoryContentCommandPaletteItems(items, {
        effectiveRepository,
        branchItems,
        tagItems,
        branchesLoaded: Boolean(branches.data),
        tagsLoaded: Boolean(tags.data),
        wikiPages: cachedRepositoryWikiPages(queryClient, effectiveRepository),
        discussionItems: discussions.data?.items ?? [],
        projectItems: projects.data?.items ?? [],
        contributorItems,
        generalSourceLimit: commandPaletteGeneralSourceLimit,
        denseSourceLimit: commandPaletteDenseSourceLimit,
        onSelectRepositoryRef: selectRepositoryRefInApp,
        onSelectWikiPage: selectWikiPageInApp,
        onSelectDiscussion: selectDiscussionInApp,
        onSelectProject: selectProjectInApp,
        onSelectContributor: selectContributorInApp
      });

      const commandPaletteRepositoryAccess = cachedRepositoryAccess(queryClient, {
        owner,
        repo,
        limit: repositoryAccessLimit
      });
      appendRepositoryAdminCommandPaletteItems(items, {
        effectiveRepository,
        collaborators: commandPaletteRepositoryAccess?.collaborators ?? [],
        teams: commandPaletteRepositoryAccess?.teams ?? [],
        forks: cachedRepositoryForks(queryClient, { owner, repo, limit: forksLimit }),
        currentRepositoryParent: repositoryDetail?.parent ?? null,
        currentRepositorySource: repositoryDetail?.source ?? null,
        denseSourceLimit: commandPaletteDenseSourceLimit,
        forksLimit,
        onSelectCollaborator: selectRepositorySettingsCollaboratorInApp,
        onSelectTeam: openTeamInApp,
        onOpenRepository: openRepositoryInApp
      });

      appendRepositoryReleaseCommandPaletteItems(items, {
        effectiveRepository,
        releaseItems,
        limit: commandPaletteGeneralSourceLimit,
        onSelectRelease: selectReleaseInApp,
        onSelectReleaseAsset: selectReleaseAssetInApp
      });

      appendRepositoryWorkflowCommandPaletteItems(items, {
        effectiveRepository,
        actionItems,
        focusedWorkflowRunDetail: cachedWorkflowRunDetail(queryClient, {
          owner,
          repo,
          runId:
            route.kind === "repository" && route.nameWithOwner === effectiveRepository
              ? (route.workflowRunId ?? null)
              : null
        }),
        limit: commandPaletteGeneralSourceLimit,
        onSelectWorkflowRun: selectWorkflowRunInApp,
        onSelectWorkflowArtifact: selectWorkflowArtifactInApp
      });

      appendRepositorySecurityCommandPaletteItems(items, {
        effectiveRepository,
        ...cachedRepositorySecurityCommandItems(queryClient, {
          owner,
          repo,
          dependabotAlertsLimit,
          codeScanningAlertsLimit,
          secretScanningAlertsLimit,
          repositorySecurityAdvisoriesLimit,
          repositoryRulesetsLimit
        }),
        limit: commandPaletteSecuritySourceLimit,
        onSelectSecurityItem: selectSecurityItemInApp
      });

      appendCurrentRepositoryCommandPaletteItems(items, {
        effectiveRepository,
        githubReady,
        currentRepositoryPinned,
        repositoryCommandDisabledReason,
        repositoryRefreshDisabledReason,
        repositoryPinCommandDisabledReason,
        onOpenRepository: openRepositoryInApp,
        onToggleRepositoryPin: toggleRepositoryPin,
        onRefreshRepository: () => {
          void refreshRepositorySurface();
        },
        onOpenFileFinder: (nameWithOwner) => {
          openRepositoryRouteInApp({
            kind: "repository",
            nameWithOwner,
            tab: "code"
          });
          setFileFinderOpen(true);
        },
        onCreateIssue: (nameWithOwner) =>
          openRepositoryRouteInApp({
            kind: "repository",
            nameWithOwner,
            tab: "issues",
            issueComposer: "create"
          }),
        onCreatePullRequest: (nameWithOwner) =>
          openRepositoryRouteInApp({
            kind: "repository",
            nameWithOwner,
            tab: "pulls",
            pullComposer: "create"
          }),
        onCreateRelease: (nameWithOwner) =>
          openRepositoryRouteInApp({
            kind: "repository",
            nameWithOwner,
            tab: "releases",
            releaseComposer: "create"
          }),
        onRunWorkflow: (nameWithOwner) =>
          openRepositoryRouteInApp({
            kind: "repository",
            nameWithOwner,
            tab: "actions",
            workflowComposer: "dispatch"
          }),
        onOpenExternalGitHub: (nameWithOwner) => void api.openExternal(`https://github.com/${nameWithOwner}`)
      });
    }

    appendPinnedRepositoryCommandPaletteItems(items, {
      pinnedRepositoryNames,
      repositoryItems,
      viewerLogin: appState.data?.viewer?.login ?? null,
      onOpenRepository: openRepositoryInApp
    });
    appendRecentCommandPaletteItems(items, {
      recentItems: recentItems.data ?? [],
      onOpenRecent: openRecentItem
    });
    appendRepositoryCommandPaletteItems(items, {
      repositoryItems,
      viewerLogin: appState.data?.viewer?.login ?? null,
      onOpenRepository: openRepositoryInApp
    });

    return items;
  })();

  useEffect(() => {
    function handleCommandPaletteShortcut(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }

    window.addEventListener("keydown", handleCommandPaletteShortcut);
    return () => window.removeEventListener("keydown", handleCommandPaletteShortcut);
  }, []);

  const shellClass = [
    "app-shell",
    appState.data?.settings.glassMode === "solid" ? "solid-shell" : null,
    appState.data?.settings.glassMode === "reduced" ? "reduced-glass" : null
  ]
    .filter(Boolean)
    .join(" ");
  const repositoryRightRail = isRepositoryRoute ? (
    <RightRail
      repository={repositoryDetail ?? undefined}
      selectedRef={contentsRef}
      commits={repositoryCommitItems}
      commitsLimit={repositoryCommitHistoryLimit}
      commitsLoading={repositoryCommits.isLoading || repositoryCommits.isFetching}
      commitsError={repositoryCommits.error}
      commitsAvailability={repositoryCommitsAvailability}
      releases={releaseItems}
      releasesLoading={releases.isLoading || releases.isFetching}
      releasesAvailability={releasesAvailability}
      releasesError={releases.error}
      contributors={contributorItems}
      contributorsLoading={contributors.isLoading || contributors.isFetching}
      contributorsAvailability={contributorsAvailability}
      contributorsError={contributors.error}
      onExpandCommits={expandRepositoryCommitHistory}
      onOpenCommit={(commit) =>
        openCommitInApp({
          nameWithOwner: effectiveRepository,
          commit,
          path: "",
          entryType: "dir"
        })
      }
      onOpenReleasesTab={() => selectRepositoryTabInApp(effectiveRepository, "releases")}
      onOpenContributorsTab={() => selectRepositoryTabInApp(effectiveRepository, "contributors")}
      onOpenSettingsTab={() => selectRepositoryTabInApp(effectiveRepository, "settings")}
      onOpenRelease={(release) => selectReleaseInApp(effectiveRepository, release)}
      onOpenContributor={(contributor) => selectContributorInApp(effectiveRepository, contributor)}
      onOpenExternal={(url) => void api.openExternal(url)}
    />
  ) : null;
  const withRepositoryContext = useCallback(
    (node: JSX.Element): JSX.Element =>
      repositoryContextValue ? (
        <RepositoryContextProvider value={repositoryContextValue}>{node}</RepositoryContextProvider>
      ) : (
        node
      ),
    [repositoryContextValue]
  );

  return (
    <MarkdownUrlHandlerContext.Provider value={openMarkdownUrl}>
      <AppEventBridge activeRepository={activeRepositoryScope} />
      <div className={shellClass}>
        <Sidebar
          appState={appState.data}
          profile={accountProfileData ?? undefined}
          areas={areaItems}
          selectedAreaId={selectedArea?.id ?? null}
          localRepositories={localRepositoryItems}
          localRepositoriesLoading={selectedAreaRepositories.isLoading || selectedAreaRepositories.isFetching}
          repositories={repositoryItems}
          repositoriesLoading={repositories.isLoading || repositories.isFetching}
          repositoriesError={repositories.error}
          repositoriesAvailabilityMessage={repositoriesAvailabilityMessage}
          pinnedRepositoryNames={pinnedRepositoryNames}
          repositoryPinRecords={repositoryPinRecords}
          selectedRepository={effectiveRepository}
          route={route}
          onSelectLocalRepository={openLocalRepositoryInApp}
          onSelectRepository={openRepositoryInApp}
          onOpenRepositorySearch={() => setCommandPaletteOpen(true)}
          onOpenAddRepository={() => setAddRepositoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <TopBar
          viewer={appState.data?.viewer ?? null}
          route={route}
          areas={areaItems}
          selectedAreaId={selectedArea?.id ?? null}
          selectedRepository={selectedRepository}
          repositories={repositoryItems}
          githubReady={githubReady}
          onSelectArea={(areaId) => void selectArea(areaId)}
          onAddLocalArea={() => void addLocalArea()}
          onAddSshArea={() => setSshAreaOpen(true)}
          onEditArea={(area) => setEditingArea(area)}
          onDeleteArea={(area) => setDeletingArea(area)}
          onGoRepository={() => {
            if (effectiveRepository) {
              openRepositoryInApp(effectiveRepository);
            }
          }}
          onOpenRepository={openRepositoryInApp}
          onOpenLocalRepository={openLocalRepositoryInApp}
          onOpenAddRepository={() => setAddRepositoryOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenHome={goHome}
          onOpenMailbox={goToMailbox}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <section
          className={
            isRepositoryRoute || isLocalRepositoryRoute
              ? "workspace workspace-repository"
              : "workspace workspace-wide"
          }
        >
          {!appState.data?.github.authenticated && <SetupPanel appState={appState.data} />}

          <main
            className={
              isRepositoryRoute || isLocalRepositoryRoute
                ? "content-scroll repository-content-scroll"
                : "content-scroll"
            }
          >
            {route.kind === "home" && selectedArea && selectedAreaIsGateway ? (
              <LocalAreaHome
                area={selectedArea}
                repositories={localRepositoryItems}
                repositoriesLoading={
                  selectedAreaRepositories.isLoading || selectedAreaRepositories.isFetching
                }
                recentItems={recentItems.data ?? []}
                onOpenRepository={openLocalRepositoryInApp}
                onOpenRecent={openRecentItem}
                onRefresh={refreshSelectedArea}
                onStopGateway={stopSelectedAreaGateway}
              />
            ) : route.kind === "home" ? (
              <HomeDashboard
                appState={appState.data}
                profile={accountProfileData ?? undefined}
                profileAvailabilityMessage={accountProfileAvailabilityMessage}
                repositories={repositoryItems}
                repositoryActivityLimit={homeRepositoryActivityLimit}
                repositoriesLoading={repositories.isLoading || repositories.isFetching}
                repositoriesError={repositories.error}
                repositoriesAvailabilityMessage={repositoriesAvailabilityMessage}
                pinnedRepositoryNames={pinnedRepositoryNames}
                issues={accountIssueItems}
                issuesLoading={accountIssues.isLoading || accountIssues.isFetching}
                issuesError={accountIssues.error}
                issuesAvailability={accountIssuesAvailability}
                pulls={accountPullItems}
                pullsLoading={accountPulls.isLoading || accountPulls.isFetching}
                pullsError={accountPulls.error}
                pullsAvailability={accountPullsAvailability}
                workLimit={homeWorkLimit}
                maxWorkLimit={maxHomeWorkLimit}
                onOpenRepository={openRepositoryInApp}
                onLoadMoreRepositories={() => loadMoreHomeRepositoryActivity(repositoryItems.length)}
                onLoadMoreWork={loadMoreHomeWork}
                onOpenMailbox={goToMailbox}
                onOpenIssue={openIssueSummaryInApp}
                onOpenPullRequest={openPullRequestSummaryInApp}
                onOpenExternal={(url) => void api.openExternal(url)}
              />
            ) : null}

            {route.kind === "localRepository" && (
              <LocalRepositoryPage
                route={route}
                activeTab={activeLocalRepositoryTab}
                activePath={activeLocalRepositoryPath}
                onSelectTab={(tab) =>
                  goToLocalRepository(
                    route.areaId,
                    route.repositoryId,
                    tab,
                    route.workspaceId ?? null,
                    route.path ?? null
                  )
                }
                onOpenPath={(entry) =>
                  goToLocalRepository(
                    route.areaId,
                    route.repositoryId,
                    "code",
                    route.workspaceId ?? null,
                    entry.path
                  )
                }
                pinned={isAreaRepositoryPinned(route.areaId, route.repositoryId, route.workspaceId ?? null)}
                pinBusy={repositoryPinBusy}
                onTogglePin={toggleAreaRepositoryPin}
                onOpenGitHub={(nameWithOwner) => openRepositoryInApp(nameWithOwner)}
                onOpenExternal={(url) => void api.openExternal(url)}
              />
            )}

            {route.kind === "repository" &&
              withRepositoryContext(
                <RepositoryPage
                  key={effectiveRepository}
                  repository={repositoryDetail ?? undefined}
                  availabilityMessage={repositoryAvailabilityMessage}
                  githubReady={githubReady}
                  selectedRef={contentsRef}
                  limits={{
                    refListLimit: repositoryRefListLimit,
                    codeCommitHistoryLimit: repositoryCommitHistoryLimit,
                    issueListLimit,
                    repositoryAccessLimit,
                    forksLimit,
                    pullRequestListLimit,
                    discussionsLimit,
                    actionsLimit,
                    workflowDefinitionLimit,
                    projectsLimit,
                    dependabotAlertsLimit,
                    codeScanningAlertsLimit,
                    secretScanningAlertsLimit,
                    repositoryRulesetsLimit,
                    repositorySecurityAdvisoriesLimit,
                    releasesLimit,
                    contributorLimit: repositoryContributorLimit
                  }}
                  contributorCount={contributorItems.length}
                  loading={repository.isLoading}
                  pinned={isRepositoryPinned(effectiveRepository)}
                  pinBusy={repositoryPinBusy}
                  pinError={repositoryPinError}
                  error={repository.error}
                  onOpenCodeBrowser={(entry) =>
                    openCodeBrowserInApp(
                      effectiveRepository,
                      entry.path,
                      entry.type === "dir" ? "dir" : "file",
                      contentsRef ?? repositoryDetail?.defaultBranch ?? null
                    )
                  }
                  onOpenReleaseTarget={(ref) =>
                    selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref), {
                      path: "",
                      entryType: "dir"
                    })
                  }
                  onOpenPullRequestCommit={(commit, targetRepositoryNameWithOwner) =>
                    openPullRequestCommitInApp(commit, targetRepositoryNameWithOwner)
                  }
                  onOpenPullRequestReviewCommit={openPullRequestReviewCommitInApp}
                  onOpenPullRequestTimelineEventCommit={openPullRequestTimelineEventCommitInApp}
                  onOpenWorkflowRunCommit={openWorkflowRunCommitInApp}
                  onOpenWorkflowCheckSuiteCommit={openWorkflowCheckSuiteCommitInApp}
                  onOpenCodePath={openCodePathInApp}
                  onOpenExternal={(url) => void api.openExternal(url)}
                  onOpenRepository={openRepositoryInApp}
                  onOpenTeam={openTeamInApp}
                  onRefresh={() => refreshRepositorySurface()}
                  onOpenFileFinder={() => setFileFinderOpen(true)}
                  onSelectTab={(tab) => selectRepositoryTabInApp(effectiveRepository, tab)}
                  onOpenFilteredSurface={(tab, filter) =>
                    openFilteredRepositorySurfaceInApp(effectiveRepository, tab, filter)
                  }
                  onSelectIssue={(issue) => selectIssueInApp(effectiveRepository, issue)}
                  onSelectPullRequest={(pullRequest) =>
                    selectPullRequestInApp(effectiveRepository, pullRequest)
                  }
                  onOpenIssueReference={openLinkedIssueInApp}
                  onSelectDiscussion={(discussion) => selectDiscussionInApp(effectiveRepository, discussion)}
                  onSelectProject={(project) => selectProjectInApp(effectiveRepository, project)}
                  onSelectRelease={(release) => selectReleaseInApp(effectiveRepository, release)}
                  onSelectReleaseAsset={(release, asset) =>
                    selectReleaseAssetInApp(effectiveRepository, release, asset)
                  }
                  onSelectWorkflowRun={(run) => selectWorkflowRunInApp(effectiveRepository, run)}
                  onSelectWorkflowArtifact={(run, artifact) =>
                    selectWorkflowArtifactInApp(effectiveRepository, run, artifact)
                  }
                  onSelectSecurityItem={(securityItem) =>
                    selectSecurityItemInApp(effectiveRepository, securityItem)
                  }
                  onSelectWikiPage={(page) => selectWikiPageInApp(effectiveRepository, page)}
                  onOpenWorkflowRun={(runId, url) =>
                    openWorkflowRunReferenceInApp(effectiveRepository, runId, url)
                  }
                  onSelectContributor={(contributor) =>
                    selectContributorInApp(effectiveRepository, contributor)
                  }
                  onSelectSecurityQualityBranch={(ref) =>
                    selectSecurityQualityBranchInApp(effectiveRepository, ref)
                  }
                  onSelectSettingsCollaborator={(collaborator) =>
                    selectRepositorySettingsCollaboratorInApp(effectiveRepository, collaborator)
                  }
                  onSelectRef={(ref) =>
                    selectRepositoryRefInApp(
                      effectiveRepository,
                      ref,
                      ref ? repositoryRefKindForName(ref) : "ref"
                    )
                  }
                  expansion={{
                    onExpandRefs: expandActiveRepositoryRefs,
                    onExpandIssues: expandActiveRepositoryIssues,
                    onExpandPullRequests: expandActiveRepositoryPullRequests,
                    onExpandContributors: expandActiveRepositoryContributors,
                    onExpandForks: expandActiveRepositoryForks,
                    onExpandRepositoryAccess: expandActiveRepositoryAccess,
                    onExpandActions: expandActiveRepositoryActions,
                    onExpandWorkflowDefinitions: expandActiveRepositoryWorkflowDefinitions,
                    onExpandProjects: expandActiveRepositoryProjects,
                    onExpandReleases: expandActiveRepositoryReleases,
                    onExpandDiscussions: expandActiveRepositoryDiscussions,
                    onExpandDependabotAlerts: () => expandActiveRepositorySecurityList("dependabot"),
                    onExpandCodeScanningAlerts: () => expandActiveRepositorySecurityList("codeScanning"),
                    onExpandSecretScanningAlerts: () => expandActiveRepositorySecurityList("secretScanning"),
                    onExpandRepositoryRulesets: () => expandActiveRepositorySecurityList("rulesets"),
                    onExpandRepositorySecurityAdvisories: () =>
                      expandActiveRepositorySecurityList("advisories")
                  }}
                  onTogglePin={() => toggleRepositoryPin(effectiveRepository)}
                  mutation={{
                    action: mutation.variables?.action ?? null,
                    pending: mutation.isPending,
                    succeeded: mutation.isSuccess,
                    error: mutation.error instanceof Error ? mutation.error : null,
                    onMutate: (action, dangerous, payload = {}) => {
                      if (
                        dangerous &&
                        !window.confirm(`Run ${githubActionLabel(action)} on ${owner}/${repo}?`)
                      ) {
                        return;
                      }
                      mutation.reset();
                      mutation.mutate(createGitHubMutationInput(action, owner, repo, payload));
                    }
                  }}
                  rightRail={repositoryRightRail}
                />
              )}

            {route.kind === "codeBrowser" &&
              withRepositoryContext(
                <CodeBrowserPage
                  repository={repositoryDetail ?? undefined}
                  availabilityMessage={repositoryAvailabilityMessage}
                  githubReady={githubReady}
                  route={route}
                  branches={branchItems}
                  tags={tagItems}
                  refsLoading={branches.isLoading || branches.isFetching || tags.isLoading || tags.isFetching}
                  refsError={refsError}
                  refsAvailabilityMessage={refsAvailabilityMessage || null}
                  contents={contentItems}
                  contentsLoading={codeBrowserContents.isLoading || codeBrowserContents.isFetching}
                  contentsError={codeBrowserContents.error}
                  contentsAvailability={contentsAvailability}
                  fileContent={fileContentItem ?? undefined}
                  fileLoading={fileContent.isLoading || fileContent.isFetching}
                  fileError={fileContent.error}
                  fileAvailabilityMessage={fileContentAvailabilityMessage}
                  fileBlame={fileBlame.data}
                  fileBlameRangeLimit={fileBlameRangeLimit}
                  fileBlameLoading={fileBlame.isLoading || fileBlame.isFetching}
                  fileBlameError={fileBlame.error}
                  commits={fileCommitItems}
                  commitsLimit={fileCommitHistoryLimit}
                  commitsLoading={fileCommits.isLoading || fileCommits.isFetching}
                  commitsError={fileCommits.error}
                  commitsAvailability={fileCommitsAvailability}
                  error={
                    repository.error ??
                    codeBrowserContents.error ??
                    fileContent.error ??
                    fileBlame.error ??
                    fileCommits.error
                  }
                  onRefresh={() => {
                    return Promise.all([refreshRepositoryDetailNow(), refreshCodeBrowserNow()]);
                  }}
                  onBackToRepository={() => {
                    if (codeBrowserRef) {
                      selectRepositoryRefInApp(
                        effectiveRepository,
                        codeBrowserRef,
                        repositoryRefKindForName(codeBrowserRef)
                      );
                      return;
                    }
                    openRepositoryInApp(effectiveRepository, "code");
                  }}
                  onOpenCodeBrowser={(path, entryType, refOverride, line) =>
                    openCodeBrowserInApp(
                      effectiveRepository,
                      path,
                      entryType,
                      refOverride ?? codeBrowserRef ?? repositoryDetail?.defaultBranch ?? null,
                      line ?? route.line
                    )
                  }
                  onOpenCommit={(commit, path, entryType, line) =>
                    openCommitInApp({
                      nameWithOwner: effectiveRepository,
                      commit,
                      path,
                      entryType,
                      line
                    })
                  }
                  onSelectRef={(ref) =>
                    selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref), {
                      path: route.path,
                      entryType: route.entryType,
                      line: route.line
                    })
                  }
                  onExpandFileBlamePreview={expandFileBlamePreview}
                  onExpandCommits={expandFileCommitHistory}
                  onOpenExternal={(url) => void api.openExternal(url)}
                />
              )}

            {route.kind === "codeBrowser" && repositoryRightRail}

            {route.kind === "repositories" && (
              <RepositoriesRoute
                title={routeTitle(route)}
                appReady={appState.isSuccess}
                githubReady={githubReady}
                repositoryListLimit={repositoryListLimit}
                pinnedRepositoryNames={pinnedRepositoryNames}
                repositoryPinBusy={repositoryPinBusy}
                repositoryPinError={repositoryPinError}
                viewerLogin={appState.data?.viewer?.login ?? accountProfileData?.login ?? null}
                onOpenExternal={(url) => void api.openExternal(url)}
                onOpenRepository={openRepositoryInApp}
                onOpenAddRepository={() => setAddRepositoryOpen(true)}
                onExpandRepositories={expandRepositoryList}
                onToggleRepositoryPin={toggleRepositoryPin}
              />
            )}

            {route.kind === "mailbox" && (
              <MailboxRoute
                title={routeTitle(route)}
                appReady={appState.isSuccess}
                githubReady={githubReady}
                viewerLogin={authenticatedViewerLogin}
                accountWorkLimit={accountWorkLimit}
                notificationFilter={notificationFilter}
                notificationLimit={notificationLimit}
                onOpenExternal={(url) => void api.openExternal(url)}
                onOpenIssue={openIssueSummaryInApp}
                onOpenPullRequest={openPullRequestSummaryInApp}
                onOpenNotification={openNotificationInApp}
                onNotificationFilterChange={setNotificationFilter}
                onExpandMailboxWork={expandMailboxWork}
                onExpandMailboxNotifications={expandMailboxNotifications}
              />
            )}

            {route.kind === "organizations" && (
              <OrganizationsRoute
                title={routeTitle(route)}
                githubReady={githubReady}
                routeState={organizationsRouteState}
                pinnedRepositoryNames={pinnedRepositoryNames}
                repositoryPinBusy={repositoryPinBusy}
                repositoryPinError={repositoryPinError}
                onOpenExternal={(url) => void api.openExternal(url)}
                onOpenRepository={openRepositoryInApp}
                onToggleRepositoryPin={toggleRepositoryPin}
              />
            )}
          </main>
        </section>

        {commandPaletteOpen && (
          <CommandPalette
            items={commandPaletteItems}
            fileSearch={
              repositoryDetail && isRepositoryContext
                ? {
                    repository: repositoryDetail,
                    selectedRef: contentsRef ?? repositoryDetail.defaultBranch ?? "HEAD",
                    githubReady,
                    onOpenEntry: (entry) =>
                      openCodeBrowserInApp(
                        effectiveRepository,
                        entry.path,
                        entry.type === "dir" ? "dir" : "file",
                        contentsRef ?? repositoryDetail.defaultBranch ?? null
                      )
                  }
                : null
            }
            onOpenRepository={openRepositoryInApp}
            onClose={() => setCommandPaletteOpen(false)}
          />
        )}

        {addRepositoryOpen && (
          <AddRepositoryDialog
            repositories={repositoryItems}
            viewerLogin={appState.data?.viewer?.login ?? accountProfileData?.login ?? null}
            githubReady={githubReady}
            onClose={() => setAddRepositoryOpen(false)}
            onOpenRepository={openRepositoryInApp}
          />
        )}

        {sshAreaOpen && (
          <SshAreaDialog
            onClose={() => setSshAreaOpen(false)}
            onCreate={async (input) => {
              await createSshArea(input);
              setSshAreaOpen(false);
            }}
          />
        )}

        {editingArea && (
          <AreaEditDialog
            area={editingArea}
            onClose={() => setEditingArea(null)}
            onSave={async (input) => {
              await updateArea(input);
              setEditingArea(null);
            }}
          />
        )}

        {deletingArea && (
          <AreaDeleteDialog
            area={deletingArea}
            onClose={() => setDeletingArea(null)}
            onDelete={async () => {
              await deleteArea(deletingArea);
              setDeletingArea(null);
            }}
          />
        )}

        {fileFinderOpen && repositoryDetail && (
          <FileFinder
            repository={repositoryDetail}
            tree={repositoryTreeItem}
            githubReady={githubReady}
            loading={repositoryTree.isLoading || repositoryTree.isFetching}
            error={repositoryTree.error}
            availabilityMessage={repositoryTreeAvailabilityMessage}
            branches={branchItems}
            tags={tagItems}
            refListLimit={repositoryRefListLimit}
            maxRefListLimit={maxRefListLimit}
            refsLoading={branches.isLoading || branches.isFetching || tags.isLoading || tags.isFetching}
            refsError={refsError}
            refsAvailabilityMessage={refsAvailabilityMessage || null}
            selectedRef={contentsRef ?? repositoryDetail.defaultBranch ?? "HEAD"}
            onClose={() => setFileFinderOpen(false)}
            onSelectRef={(ref) => {
              if (route.kind === "codeBrowser") {
                selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref), {
                  path: route.path,
                  entryType: route.entryType,
                  line: route.line
                });
                return;
              }
              selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref));
            }}
            onExpandRefs={expandActiveRepositoryRefs}
            onOpenEntry={(entry) => {
              setFileFinderOpen(false);
              openCodeBrowserInApp(
                effectiveRepository,
                entry.path,
                entry.type === "dir" ? "dir" : "file",
                contentsRef ?? repositoryDetail.defaultBranch ?? null
              );
            }}
          />
        )}

        {settingsOpen && (
          <SettingsPanel
            appState={appState.data}
            authController={providerAuth.github}
            onClose={() => setSettingsOpen(false)}
            onOpenExternal={(url) => void api.openExternal(url)}
            onSave={async (settings) => {
              await api.updateSettings(settings);
              await queryClient.invalidateQueries({ queryKey: ["app-state"] });
            }}
          />
        )}
      </div>
    </MarkdownUrlHandlerContext.Provider>
  );
}
