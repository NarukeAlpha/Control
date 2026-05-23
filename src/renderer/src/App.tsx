import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ContributorSummary,
  DiscussionSummary,
  IssueSummary,
  NotificationSummary,
  OrganizationSummary,
  ProjectSummary,
  PullRequestSummary,
  ReleaseAssetSummary,
  ReleaseSummary,
  RepositoryCollaboratorSummary,
  RepositoryDetail,
  RepositorySummary,
  WorkflowRunArtifactSummary,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import type { AreaRepositorySummary, AreaSummary } from "@shared/areas";
import type { LocalRecentItem } from "@shared/local";
import { MarkdownUrlHandlerContext } from "./components/MarkdownBody";
import { AreaDeleteDialog, AreaEditDialog, SshAreaDialog } from "./components/areas/AreaDialogs";
import { LocalAreaHome } from "./components/areas/LocalAreaHome";
import { SetupPanel } from "./components/auth/SetupPanel";
import { useAreasShell } from "./components/areas/useAreasShell";
import { useProviderAuth } from "./components/auth/AuthProvider";
import { CodeBrowserPage } from "./components/code-browser/CodeBrowserPage";
import { useCodeBrowserQueries } from "./components/code-browser/codeBrowserQueries";
import { normalizeCodeLineNumber } from "./components/code-browser/codeBrowserUi";
import {
  notificationInAppTarget,
  notificationTargetUrl,
  parseWorkflowRunIdFromUrl
} from "./components/collection/notificationUi";
import { RepositoriesRoute } from "./components/collection/RepositoriesRoute";
import { MailboxRoute } from "./components/collection/MailboxRoute";
import {
  refreshOrganizationsRouteData,
  useOrganizationsRouteQueries
} from "./components/collection/organizationQueries";
import { OrganizationsRoute } from "./components/collection/OrganizationsRoute";
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
import { prefetchActionsTabData, useActionsTabQueries } from "./components/repository/actions/ActionsTab";
import { prefetchCodeTabData, useCodeTabQueries } from "./components/repository/code/CodeTab";
import {
  notificationCommitRecentCommit,
  pullRequestReviewCommitRecentCommit,
  pullRequestTimelineEventCommitRecentCommit,
  workflowCheckSuiteCommitRecentCommit,
  workflowRunCommitRecentCommit,
  type CommitRecentCommit
} from "./components/repository/commitRecent";
import { useContributorsTabQueries } from "./components/repository/contributors/ContributorsTab";
import { useDiscussionsTabQueries } from "./components/repository/discussions/DiscussionsTab";
import { prefetchIssuesTabData, useIssuesTabQueries } from "./components/repository/issues/IssuesTab";
import {
  parseGitHubBlobUrl,
  parseGitHubCodeUrl,
  parseGitHubRepositoryUrl,
  repositoryNameWithOwnerFromGitHubUrl
} from "./components/repository/githubUrlRoutes";
import { createGitHubMutationInput } from "./components/repository/githubMutationHelpers";
import { useProjectsTabQueries } from "./components/repository/projects/ProjectsTab";
import {
  prefetchPullRequestsTabData,
  usePullRequestsTabQueries
} from "./components/repository/pull-requests/PullRequestsTab";
import { useReleasesTabQueries } from "./components/repository/releases/ReleasesTab";
import { RightRail } from "./components/right-rail/RightRail";
import {
  commitRecentInput,
  contributorRecentInput,
  discussionRecentInput,
  discussionReferenceRecentInput,
  fileRecentInput,
  issueRecentInput,
  issueReferenceRecentInput,
  linkedIssueRecentInput,
  notificationRecentInput,
  organizationProjectRecentInput,
  organizationRecentInput,
  projectRecentInput,
  pullRequestRecentInput,
  pullRequestReferenceRecentInput,
  releaseAssetRecentInput,
  releaseRecentInput,
  releaseTagReferenceRecentInput,
  repositoryRecentInput,
  securityItemRecentInput,
  teamRecentInput,
  wikiPageRecentInput,
  workflowArtifactRecentInput,
  workflowRunRecentInput,
  workflowRunReferenceRecentInput,
  type PullRequestLinkedIssue,
  type SecurityItemRecentInput
} from "./components/recent/recentRecordInputs";
import { openRecentItemInApp } from "./components/recent/openRecentItem";
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

import { refreshAccountProfileData, useAccountProfile } from "./hooks/useAccountProfile";
import { refreshAccountWorkData, useAccountWork } from "./hooks/useAccountWork";
import { useControlApi } from "./hooks/useControlApi";
import { refreshMailboxNotificationsData, useMailboxNotifications } from "./hooks/useMailboxNotifications";
import { refreshRecentItemsData, useRecentItems } from "./hooks/useRecentItems";
import { useRecentRecorder } from "./hooks/useRecentRecorder";
import { refreshRepositoryDirectoryData, useRepositoryDirectory } from "./hooks/useRepositoryDirectory";
import { useRepositoryDetail } from "./hooks/useRepositoryDetail";
import { useRepositoryPins } from "./hooks/useRepositoryPins";
import { useRepositoryRefs } from "./hooks/useRepositoryRefs";
import { useCollectionSurfaceState } from "./hooks/useCollectionSurfaceState";
import { useRepositoryRefreshActions } from "./hooks/useRepositoryRefreshActions";
import { useRepositorySurfaceLimits } from "./hooks/useRepositorySurfaceLimits";
import { useStoredRepositoryRefs } from "./hooks/useStoredRepositoryRefs";
import { useUiStore, type AppRoute, type LocalRepositoryTab, type RepositoryTab } from "./stores/uiStore";

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
  const navigate = useUiStore((state) => state.navigate);
  const goToRepository = useUiStore((state) => state.goToRepository);
  const goToLocalRepository = useUiStore((state) => state.goToLocalRepository);
  const openCodeBrowser = useUiStore((state) => state.openCodeBrowser);
  const goHome = useUiStore((state) => state.goHome);
  const goToRepositories = useUiStore((state) => state.goToRepositories);
  const goToOrganizations = useUiStore((state) => state.goToOrganizations);
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
    organizationListLimit,
    organizationRepositoryLimits,
    organizationTeamLimits,
    organizationMemberLimits,
    organizationProjectLimits,
    organizationTeamRepositoryLimits,
    organizationTeamMemberLimits,
    homeRepositoryActivityLimit,
    homeWorkLimit,
    mailboxWorkLimit,
    recentItemLimit,
    selectedOrganizationLogin,
    selectedOrganizationTeamSlug,
    selectedOrganizationMemberLogin,
    selectedOrganizationProjectId,
    notificationFilter,
    accountWorkLimit,
    notificationLimit,
    maxHomeWorkLimit,
    setSelectedOrganizationLogin,
    setSelectedOrganizationTeamSlug,
    setSelectedOrganizationMemberLogin,
    setSelectedOrganizationProjectId,
    setNotificationFilter,
    expandMailboxWork,
    loadMoreHomeWork,
    loadMoreHomeRepositoryActivity,
    expandMailboxNotifications,
    expandRepositoryList,
    expandOrganizationList,
    expandSelectedOrganizationRepositories,
    expandSelectedOrganizationTeams,
    expandSelectedOrganizationMembers,
    expandSelectedOrganizationProjects,
    expandSelectedOrganizationTeamRepositories,
    expandSelectedOrganizationTeamMembers
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
  const repositoriesByName = useMemo(
    () => new Map(repositoryItems.map((repository) => [repository.nameWithOwner.toLowerCase(), repository])),
    [repositoryItems]
  );

  const recentItems = useRecentItems(recentItemLimit, { enabled: appState.isSuccess });
  const { recordRecent } = useRecentRecorder(recentItemLimit);

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

  const {
    organizations,
    organizationItems,
    organizationsAvailability,
    selectedOrganization,
    organizationRepositoryLimit,
    organizationTeamLimit,
    organizationMemberLimit,
    organizationProjectLimit,
    organizationTeams,
    organizationRepositories,
    organizationMembers,
    selectedOrganizationTeam,
    organizationTeamRepositoryLimit,
    organizationTeamMemberLimit,
    organizationTeamRepositories,
    organizationTeamMembers,
    organizationProjects
  } = useOrganizationsRouteQueries({
    enabled: appState.isSuccess && route.kind === "organizations",
    githubReady,
    organizationListLimit,
    selectedOrganizationLogin,
    organizationRepositoryLimits,
    organizationTeamLimits,
    organizationMemberLimits,
    organizationProjectLimits,
    selectedOrganizationTeamSlug,
    organizationTeamRepositoryLimits,
    organizationTeamMemberLimits
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

  useEffect(() => {
    if (!appState.isSuccess || !isRepositoryRoute || !hasRepositoryParts) {
      return;
    }

    void Promise.all([
      prefetchCodeTabData(queryClient, {
        api,
        owner,
        repo,
        selectedRef: repositorySelectedRef,
        defaultBranch: repositoryDetail?.defaultBranch ?? null,
        commitHistoryLimit: repositoryCommitHistoryLimit,
        selectedRootMarkdownPath: null,
        githubReady
      }),
      prefetchIssuesTabData(queryClient, {
        api,
        owner,
        repo,
        issueListLimit,
        githubReady
      }),
      prefetchPullRequestsTabData(queryClient, {
        api,
        owner,
        repo,
        pullRequestListLimit,
        githubReady
      }),
      prefetchActionsTabData(queryClient, {
        api,
        owner,
        repo,
        limit: actionsLimit,
        githubReady
      })
    ]).catch(() => {
      // Mounted tabs own visible error states; warm prefetch should stay silent.
    });
  }, [
    actionsLimit,
    api,
    appState.isSuccess,
    githubReady,
    hasRepositoryParts,
    isRepositoryRoute,
    issueListLimit,
    owner,
    pullRequestListLimit,
    queryClient,
    repo,
    repositoryCommitHistoryLimit,
    repositoryDetail?.defaultBranch,
    repositorySelectedRef
  ]);

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

  const mutation = useMutation({
    mutationFn: api.github.mutate,
    onSuccess: async (_result, input) => {
      await invalidateGitHubMutationQueries(queryClient, input);
    }
  });
  function repositoryForRecent(nameWithOwner: string): RepositorySummary | RepositoryDetail | undefined {
    const normalized = nameWithOwner.toLowerCase();
    if (repositoryDetail?.nameWithOwner.toLowerCase() === normalized) {
      return repositoryDetail;
    }

    return repositoriesByName.get(normalized);
  }

  async function refreshHomeNow(): Promise<void> {
    if (!appState.isSuccess) {
      return;
    }

    try {
      await Promise.all([
        refreshAccountProfileData(queryClient, { api, githubReady }),
        refreshRepositoryDirectoryData(queryClient, { api, limit: repositoryListLimit, githubReady }),
        refreshAccountWorkData(queryClient, {
          api,
          login: authenticatedViewerLogin,
          limit: maxHomeWorkLimit,
          githubReady
        }),
        refreshRecentItemsData(queryClient, { api, limit: recentItemLimit })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshRepositoriesNow(): Promise<void> {
    try {
      await refreshRepositoryDirectoryData(queryClient, { api, limit: repositoryListLimit, githubReady });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshMailboxNow(): Promise<void> {
    if (!appState.isSuccess) {
      return;
    }

    try {
      await Promise.all([
        refreshAccountWorkData(queryClient, {
          api,
          login: authenticatedViewerLogin,
          limit: mailboxWorkLimit,
          githubReady
        }),
        refreshMailboxNotificationsData(queryClient, {
          api,
          filter: notificationFilter,
          limit: notificationLimit,
          githubReady
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshOrganizationsNow(): Promise<void> {
    if (!appState.isSuccess) {
      return;
    }

    await Promise.all([
      refreshOrganizationsRouteData(queryClient, {
        api,
        githubReady,
        organizationListLimit,
        selectedOrganizationLogin: selectedOrganization?.login ?? null,
        organizationRepositoryLimit,
        organizationTeamLimit,
        organizationMemberLimit,
        organizationProjectLimit,
        selectedOrganizationTeamSlug: selectedOrganizationTeam?.slug ?? null,
        organizationTeamRepositoryLimit,
        organizationTeamMemberLimit
      }),
      refreshRepositoriesNow()
    ]);
  }

  function openRepositoryInApp(nameWithOwner: string, tab?: RepositoryTab): void {
    goToRepository(nameWithOwner, tab);
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), tab ?? "code"));
  }

  function openLocalRepositoryInApp(
    repository: AreaRepositorySummary,
    tab: LocalRepositoryTab = "overview"
  ): void {
    const workspaceId = null;
    goToLocalRepository(repository.areaId, repository.id, tab, workspaceId);
    recordRecent({
      kind: "repository",
      provider: "local",
      itemKey: `${repository.areaId}:${repository.id}`,
      title: repository.displayName,
      subtitle: repository.path ?? repository.connection?.nameWithOwner ?? null,
      repositoryNameWithOwner: repository.connection?.nameWithOwner ?? null,
      areaId: repository.areaId,
      repositoryId: repository.id,
      workspaceId,
      url: repository.connection?.url ?? null,
      metadata: { vcs: repository.kind }
    });
  }

  function openRepositoryRouteInApp(route: Extract<AppRoute, { kind: "repository" }>): void {
    navigate(route);
    recordRecent(
      repositoryRecentInput(route.nameWithOwner, repositoryForRecent(route.nameWithOwner), route.tab)
    );
  }

  function selectRepositoryTabInApp(nameWithOwner: string, tab: RepositoryTab): void {
    navigate({ kind: "repository", nameWithOwner, tab });
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), tab));
  }

  function openFilteredRepositorySurfaceInApp(
    nameWithOwner: string,
    tab: "issues" | "pulls" | "actions",
    filter: string
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab,
      issueFilter: tab === "issues" ? filter : undefined,
      pullFilter: tab === "pulls" ? filter : undefined,
      workflowFilter: tab === "actions" ? filter : undefined
    });
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), tab));
  }

  function openCodeBrowserInApp(
    nameWithOwner: string,
    path: string,
    entryType: "file" | "dir",
    ref: string | null,
    line?: number | null
  ): void {
    const normalizedLine = normalizeCodeLineNumber(line);
    openCodeBrowser(nameWithOwner, path, entryType, ref, normalizedLine);
    if (entryType === "file" && path.trim()) {
      recordRecent(fileRecentInput({ nameWithOwner, path, entryType, ref, line: normalizedLine }));
    }
  }

  function repositoryRefKindForName(ref: string): "branch" | "tag" | "ref" {
    if (branchItems.some((branch) => branch.name === ref)) {
      return "branch";
    }
    if (tagItems.some((tag) => tag.name === ref)) {
      return "tag";
    }
    return "ref";
  }

  function selectRepositoryRefInApp(
    nameWithOwner: string,
    ref: string | null,
    refKind: "branch" | "tag" | "ref" = "ref",
    codeBrowserTarget?: { path: string; entryType: "file" | "dir"; line?: number | null }
  ): void {
    setRepositoryRefs((currentRefs) => ({
      ...currentRefs,
      [nameWithOwner]: ref
    }));
    if (ref) {
      recordRecent(
        repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "code", ref, refKind)
      );
    }
    if (codeBrowserTarget) {
      openCodeBrowserInApp(
        nameWithOwner,
        codeBrowserTarget.path,
        codeBrowserTarget.entryType,
        ref,
        codeBrowserTarget.line
      );
      return;
    }
    navigate({ kind: "repository", nameWithOwner, tab: "code" });
  }

  function selectSecurityQualityBranchInApp(nameWithOwner: string, ref: string): void {
    setRepositoryRefs((currentRefs) => ({
      ...currentRefs,
      [nameWithOwner]: ref
    }));
    recordRecent(
      repositoryRecentInput(nameWithOwner, repositoryDetail ?? undefined, "securityQuality", ref, "branch")
    );
    navigate({ kind: "repository", nameWithOwner, tab: "securityQuality" });
  }

  function openCommitInApp({
    nameWithOwner,
    commit,
    path = "",
    entryType,
    line = null
  }: {
    nameWithOwner: string;
    commit: CommitRecentCommit;
    path?: string | null;
    entryType?: "file" | "dir";
    line?: number | null;
  }): void {
    const normalizedPath = path ?? "";
    const normalizedEntryType = entryType ?? (normalizedPath.trim() ? "file" : "dir");
    const normalizedLine = normalizeCodeLineNumber(line);
    openCodeBrowser(nameWithOwner, normalizedPath, normalizedEntryType, commit.sha, normalizedLine);
    recordRecent(
      commitRecentInput({
        nameWithOwner,
        commit,
        path: normalizedPath,
        entryType: normalizedEntryType,
        line: normalizedLine
      })
    );
  }

  function selectIssueInApp(nameWithOwner: string, issue: IssueSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "issues", issueNumber: issue.number });
    recordRecent(issueRecentInput(nameWithOwner, issue));
  }

  function selectPullRequestInApp(nameWithOwner: string, pullRequest: PullRequestSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "pulls", pullNumber: pullRequest.number });
    recordRecent(pullRequestRecentInput(nameWithOwner, pullRequest));
  }

  function openLinkedIssueInApp(issue: PullRequestLinkedIssue): void {
    const nameWithOwner = issue.repositoryNameWithOwner ?? effectiveRepository;
    navigate({ kind: "repository", nameWithOwner, tab: "issues", issueNumber: issue.number });
    recordRecent(linkedIssueRecentInput(nameWithOwner, issue));
  }

  function selectDiscussionInApp(nameWithOwner: string, discussion: DiscussionSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "discussions", discussionNumber: discussion.number });
    recordRecent(discussionRecentInput(nameWithOwner, discussion));
  }

  function selectProjectInApp(nameWithOwner: string, project: ProjectSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "projects", projectId: project.id });
    recordRecent(projectRecentInput(nameWithOwner, project));
  }

  function selectOrganizationProjectInApp(organization: OrganizationSummary, project: ProjectSummary): void {
    setSelectedOrganizationLogin(organization.login);
    setSelectedOrganizationTeamSlug(null);
    setSelectedOrganizationMemberLogin(null);
    setSelectedOrganizationProjectId(project.id);
    goToOrganizations();
    recordRecent(organizationProjectRecentInput(organization, project));
  }

  function selectWorkflowRunInApp(nameWithOwner: string, run: WorkflowRunSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "actions", workflowRunId: run.id });
    recordRecent(workflowRunRecentInput(nameWithOwner, run));
  }

  function selectWorkflowArtifactInApp(
    nameWithOwner: string,
    run: WorkflowRunSummary | WorkflowRunDetail,
    artifact: WorkflowRunArtifactSummary
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "actions",
      workflowRunId: run.id,
      workflowArtifactId: artifact.id
    });
    recordRecent(workflowArtifactRecentInput(nameWithOwner, run, artifact));
  }

  function selectSecurityItemInApp(nameWithOwner: string, securityItem: SecurityItemRecentInput): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "securityQuality",
      securityItemKind: securityItem.kind,
      securityItemId: securityItem.id
    });
    recordRecent(securityItemRecentInput(nameWithOwner, securityItem));
  }

  function selectWikiPageInApp(nameWithOwner: string, page: WikiPageSummary | WikiPageContent): void {
    navigate({ kind: "repository", nameWithOwner, tab: "wiki", wikiPagePath: page.path });
    recordRecent(wikiPageRecentInput(nameWithOwner, page));
  }

  function openWorkflowRunReferenceInApp(nameWithOwner: string, runId: number, url?: string | null): void {
    navigate({ kind: "repository", nameWithOwner, tab: "actions", workflowRunId: runId });
    recordRecent(workflowRunReferenceRecentInput(nameWithOwner, runId, url));
  }

  function selectReleaseInApp(nameWithOwner: string, release: ReleaseSummary): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "releases",
      releaseId: release.id,
      releaseTagName: release.tagName
    });
    recordRecent(releaseRecentInput(nameWithOwner, release));
  }

  function openMarkdownUrl(url: string): void {
    const parsed = parseGitHubRepositoryUrl(url);
    if (!parsed) {
      void api.openExternal(url);
      return;
    }

    const [, , surface, rawValue] = parsed.segments;
    const nameWithOwner = parsed.nameWithOwner;
    const number = rawValue ? Number(rawValue) : null;

    if (parsed.segments.length === 2) {
      openRepositoryInApp(nameWithOwner);
      return;
    }

    if (surface === "issues" && number !== null && Number.isInteger(number) && number > 0) {
      navigate({ kind: "repository", nameWithOwner, tab: "issues", issueNumber: number });
      recordRecent(issueReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (
      (surface === "pull" || surface === "pulls") &&
      number !== null &&
      Number.isInteger(number) &&
      number > 0
    ) {
      navigate({ kind: "repository", nameWithOwner, tab: "pulls", pullNumber: number });
      recordRecent(pullRequestReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (surface === "discussions" && number !== null && Number.isInteger(number) && number > 0) {
      navigate({ kind: "repository", nameWithOwner, tab: "discussions", discussionNumber: number });
      recordRecent(discussionReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (surface === "actions" && parsed.segments[3] === "runs") {
      const runId = parseWorkflowRunIdFromUrl(url);
      if (runId !== null) {
        openWorkflowRunReferenceInApp(nameWithOwner, runId, url);
        return;
      }
    }

    if (surface === "releases") {
      const tagName = parsed.segments[3] === "tag" ? parsed.segments.slice(4).join("/") : null;
      navigate({
        kind: "repository",
        nameWithOwner,
        tab: "releases",
        releaseTagName: tagName || undefined
      });
      if (tagName) {
        recordRecent(releaseTagReferenceRecentInput(nameWithOwner, tagName, url));
      } else {
        recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "releases"));
      }
      return;
    }

    if ((surface === "commit" || surface === "commits") && rawValue) {
      openCommitInApp({
        nameWithOwner,
        commit: {
          sha: rawValue,
          headline: rawValue.slice(0, 7),
          authorLogin: null,
          authorName: null,
          authoredDate: null,
          committedDate: null,
          htmlUrl: `https://github.com/${nameWithOwner}/commit/${rawValue}`
        }
      });
      return;
    }

    if (surface === "blob" || surface === "tree") {
      const refCandidates = [
        ...branchItems.map((branch) => branch.name),
        ...tagItems.map((tag) => tag.name),
        repositoryRefs[nameWithOwner],
        nameWithOwner.toLowerCase() === effectiveRepository.toLowerCase() ? contentsRef : null,
        repositoryDetail?.nameWithOwner.toLowerCase() === nameWithOwner.toLowerCase()
          ? repositoryDetail.defaultBranch
          : null
      ].filter((ref): ref is string => Boolean(ref));
      const codeRoute = parseGitHubCodeUrl(url, refCandidates, rawValue);
      if (codeRoute) {
        openCodeBrowserInApp(
          codeRoute.nameWithOwner,
          codeRoute.path,
          codeRoute.entryType,
          codeRoute.ref,
          codeRoute.line
        );
        return;
      }
    }

    if (surface === "wiki") {
      const pagePath = parsed.segments.slice(3).join("/");
      if (pagePath) {
        selectWikiPageInApp(nameWithOwner, {
          path: pagePath,
          title: pagePath.split("/").at(-1) ?? pagePath,
          htmlUrl: url,
          sha: pagePath,
          size: null
        });
      } else {
        navigate({ kind: "repository", nameWithOwner, tab: "wiki" });
        recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "wiki"));
      }
      return;
    }

    void api.openExternal(url);
  }

  function selectReleaseAssetInApp(
    nameWithOwner: string,
    release: ReleaseSummary,
    asset: ReleaseAssetSummary
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "releases",
      releaseId: release.id,
      releaseTagName: release.tagName,
      releaseAssetId: asset.id
    });
    recordRecent(releaseAssetRecentInput(nameWithOwner, release, asset));
  }

  function selectContributorInApp(nameWithOwner: string, contributor: ContributorSummary): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "contributors",
      contributorLogin: contributor.login
    });
    recordRecent(contributorRecentInput(nameWithOwner, contributor));
  }

  function selectRepositorySettingsCollaboratorInApp(
    nameWithOwner: string,
    collaborator: RepositoryCollaboratorSummary
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "settings",
      settingsCollaboratorLogin: collaborator.login
    });
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "settings"));
  }

  function openIssueSummaryInApp(issue: IssueSummary): void {
    const nameWithOwner =
      issue.repositoryNameWithOwner ?? repositoryNameWithOwnerFromGitHubUrl(issue.htmlUrl);

    if (nameWithOwner) {
      selectIssueInApp(nameWithOwner, issue);
      return;
    }

    void api.openExternal(issue.htmlUrl);
  }

  function openPullRequestSummaryInApp(pullRequest: PullRequestSummary): void {
    const nameWithOwner =
      pullRequest.repositoryNameWithOwner ?? repositoryNameWithOwnerFromGitHubUrl(pullRequest.htmlUrl);

    if (nameWithOwner) {
      selectPullRequestInApp(nameWithOwner, pullRequest);
      return;
    }

    void api.openExternal(pullRequest.htmlUrl);
  }

  function openNotificationInApp(notification: NotificationSummary): void {
    const target = notificationInAppTarget(notification);
    if (target && notification.repositoryNameWithOwner) {
      if (githubReady && notification.unread) {
        markNotificationRead.mutate({ threadId: notification.id });
      }
      if (target.kind === "commit" && target.commitSha) {
        openCommitInApp({
          nameWithOwner: notification.repositoryNameWithOwner,
          commit: notificationCommitRecentCommit(notification, target.commitSha),
          path: "",
          entryType: "dir"
        });
        recordRecent(notificationRecentInput(notification, target));
        return;
      }
      navigate({
        kind: "repository",
        nameWithOwner: notification.repositoryNameWithOwner,
        tab: target.tab,
        issueNumber: target.kind === "issue" ? target.number : undefined,
        pullNumber: target.kind === "pullRequest" ? target.number : undefined,
        discussionNumber: target.kind === "discussion" ? target.number : undefined,
        releaseId: target.kind === "release" ? target.releaseId : undefined,
        releaseTagName: target.kind === "release" ? target.tagName : undefined,
        workflowRunId: target.kind === "workflowRun" ? target.runId : undefined
      });
      recordRecent(notificationRecentInput(notification, target));
      return;
    }

    if (githubReady && notification.unread) {
      markNotificationRead.mutate({ threadId: notification.id });
    }
    void api.openExternal(notificationTargetUrl(notification));
  }

  function openRecentItem(item: LocalRecentItem): void {
    openRecentItemInApp(item, {
      navigate,
      goToOrganizations,
      goToLocalRepository,
      openCodeBrowser,
      openCodeBrowserInApp,
      recordRecent,
      setSelectedOrganizationLogin,
      setSelectedOrganizationTeamSlug,
      setSelectedOrganizationMemberLogin,
      setSelectedOrganizationProjectId,
      openExternal: (url) => void api.openExternal(url)
    });
  }

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
    const organizationsRefreshInFlight =
      organizations.isFetching ||
      organizationTeams.isFetching ||
      organizationMembers.isFetching ||
      organizationRepositories.isFetching ||
      organizationTeamRepositories.isFetching ||
      organizationTeamMembers.isFetching ||
      organizationProjects.isFetching;
    const organizationsRefreshDisabledReason = organizationsRefreshInFlight
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
      onOpenOrganizations: () => {
        setSelectedOrganizationTeamSlug(null);
        setSelectedOrganizationMemberLogin(null);
        setSelectedOrganizationProjectId(null);
        goToOrganizations();
      },
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
      organizationItems,
      organizationTeams: organizationTeams.data?.items ?? [],
      organizationRepositories: organizationRepositories.data?.items ?? [],
      organizationTeamRepositories: organizationTeamRepositories.data?.items ?? [],
      organizationProjects: organizationProjects.data?.items ?? [],
      organizationMembers: organizationMembers.data?.items ?? [],
      organizationTeamMembers: organizationTeamMembers.data?.items ?? [],
      selectedOrganization,
      selectedOrganizationTeam,
      generalSourceLimit: commandPaletteGeneralSourceLimit,
      denseSourceLimit: commandPaletteDenseSourceLimit,
      onOpenOrganization: (organization) => {
        recordRecent(organizationRecentInput(organization));
        setSelectedOrganizationLogin(organization.login);
        setSelectedOrganizationTeamSlug(null);
        setSelectedOrganizationMemberLogin(null);
        setSelectedOrganizationProjectId(null);
        goToOrganizations();
      },
      onOpenTeam: (team) => {
        recordRecent(teamRecentInput(team));
        setSelectedOrganizationLogin(team.organizationLogin);
        setSelectedOrganizationTeamSlug(team.slug);
        setSelectedOrganizationMemberLogin(null);
        setSelectedOrganizationProjectId(null);
        goToOrganizations();
      },
      onOpenRepository: openRepositoryInApp,
      onOpenOrganizationMember: (organization, member) => {
        recordRecent(organizationRecentInput(organization));
        setSelectedOrganizationLogin(organization.login);
        setSelectedOrganizationTeamSlug(null);
        setSelectedOrganizationMemberLogin(member.login);
        setSelectedOrganizationProjectId(null);
        goToOrganizations();
      },
      onOpenOrganizationTeamMember: (organization, team, member) => {
        recordRecent(teamRecentInput(team));
        setSelectedOrganizationLogin(organization.login);
        setSelectedOrganizationTeamSlug(team.slug);
        setSelectedOrganizationMemberLogin(member.login);
        setSelectedOrganizationProjectId(null);
        goToOrganizations();
      },
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
        onSelectTeam: (team) => {
          recordRecent(teamRecentInput(team));
          setSelectedOrganizationLogin(team.organizationLogin);
          setSelectedOrganizationTeamSlug(team.slug);
          setSelectedOrganizationMemberLogin(null);
          setSelectedOrganizationProjectId(null);
          goToOrganizations();
        },
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
                  refListLimit={repositoryRefListLimit}
                  codeCommitHistoryLimit={repositoryCommitHistoryLimit}
                  issueListLimit={issueListLimit}
                  repositoryAccessLimit={repositoryAccessLimit}
                  forksLimit={forksLimit}
                  pullRequestListLimit={pullRequestListLimit}
                  discussionsLimit={discussionsLimit}
                  actionsLimit={actionsLimit}
                  workflowDefinitionLimit={workflowDefinitionLimit}
                  projectsLimit={projectsLimit}
                  dependabotAlertsLimit={dependabotAlertsLimit}
                  codeScanningAlertsLimit={codeScanningAlertsLimit}
                  secretScanningAlertsLimit={secretScanningAlertsLimit}
                  repositoryRulesetsLimit={repositoryRulesetsLimit}
                  repositorySecurityAdvisoriesLimit={repositorySecurityAdvisoriesLimit}
                  releasesLimit={releasesLimit}
                  contributorCount={contributorItems.length}
                  contributorLimit={repositoryContributorLimit}
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
                    openCommitInApp({
                      nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                      commit,
                      path: "",
                      entryType: "dir"
                    })
                  }
                  onOpenPullRequestReviewCommit={(review, targetRepositoryNameWithOwner) => {
                    const commit = pullRequestReviewCommitRecentCommit(review);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenPullRequestTimelineEventCommit={(event, targetRepositoryNameWithOwner) => {
                    const commit = pullRequestTimelineEventCommitRecentCommit(event);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenWorkflowRunCommit={(run, targetRepositoryNameWithOwner) => {
                    const commit = workflowRunCommitRecentCommit(run);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenWorkflowCheckSuiteCommit={(suite, targetRepositoryNameWithOwner) => {
                    const commit = workflowCheckSuiteCommitRecentCommit(suite);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenCodePath={(path, entryType, ref, blobUrl, line, targetRepositoryNameWithOwner) => {
                    const parsedBlob = parseGitHubBlobUrl(blobUrl, path);
                    if (parsedBlob) {
                      openCodeBrowserInApp(
                        parsedBlob.nameWithOwner,
                        parsedBlob.path,
                        "file",
                        parsedBlob.ref,
                        line ?? parsedBlob.line
                      );
                      return;
                    }

                    openCodeBrowserInApp(
                      targetRepositoryNameWithOwner ?? effectiveRepository,
                      path,
                      entryType,
                      ref,
                      line
                    );
                  }}
                  onOpenExternal={(url) => void api.openExternal(url)}
                  onOpenRepository={openRepositoryInApp}
                  onOpenTeam={(team) => {
                    recordRecent(teamRecentInput(team));
                    setSelectedOrganizationLogin(team.organizationLogin);
                    setSelectedOrganizationTeamSlug(team.slug);
                    setSelectedOrganizationMemberLogin(null);
                    setSelectedOrganizationProjectId(null);
                    goToOrganizations();
                  }}
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
                  onExpandRefs={expandActiveRepositoryRefs}
                  onExpandIssues={expandActiveRepositoryIssues}
                  onExpandPullRequests={expandActiveRepositoryPullRequests}
                  onExpandContributors={expandActiveRepositoryContributors}
                  onExpandForks={expandActiveRepositoryForks}
                  onExpandRepositoryAccess={expandActiveRepositoryAccess}
                  onExpandActions={expandActiveRepositoryActions}
                  onExpandWorkflowDefinitions={expandActiveRepositoryWorkflowDefinitions}
                  onExpandProjects={expandActiveRepositoryProjects}
                  onExpandReleases={expandActiveRepositoryReleases}
                  onExpandDiscussions={expandActiveRepositoryDiscussions}
                  onExpandDependabotAlerts={() => expandActiveRepositorySecurityList("dependabot")}
                  onExpandCodeScanningAlerts={() => expandActiveRepositorySecurityList("codeScanning")}
                  onExpandSecretScanningAlerts={() => expandActiveRepositorySecurityList("secretScanning")}
                  onExpandRepositoryRulesets={() => expandActiveRepositorySecurityList("rulesets")}
                  onExpandRepositorySecurityAdvisories={() =>
                    expandActiveRepositorySecurityList("advisories")
                  }
                  onTogglePin={() => toggleRepositoryPin(effectiveRepository)}
                  mutationAction={mutation.variables?.action ?? null}
                  mutationPending={mutation.isPending}
                  mutationSucceeded={mutation.isSuccess}
                  mutationError={mutation.error instanceof Error ? mutation.error : null}
                  rightRail={repositoryRightRail}
                  onMutate={(action, dangerous, payload = {}) => {
                    if (
                      dangerous &&
                      !window.confirm(`Run ${githubActionLabel(action)} on ${owner}/${repo}?`)
                    ) {
                      return;
                    }
                    mutation.reset();
                    mutation.mutate(createGitHubMutationInput(action, owner, repo, payload));
                  }}
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
                organizations={organizationItems}
                selectedOrganizationLogin={selectedOrganization?.login ?? null}
                organizationListLimit={organizationListLimit}
                organizationsAvailability={organizationsAvailability}
                organizationsLoading={organizations.isLoading || organizations.isFetching}
                organizationsError={organizations.error}
                organizationTeams={organizationTeams.data?.items ?? []}
                organizationTeamsAvailability={organizationTeams.data?.availability ?? null}
                organizationTeamLimit={organizationTeamLimit}
                organizationTeamsLoading={organizationTeams.isLoading || organizationTeams.isFetching}
                organizationTeamsError={organizationTeams.error}
                organizationRepositories={organizationRepositories.data?.items ?? []}
                organizationRepositoriesAvailability={organizationRepositories.data?.availability ?? null}
                organizationRepositoryLimit={organizationRepositoryLimit}
                organizationRepositoriesLoading={
                  organizationRepositories.isLoading || organizationRepositories.isFetching
                }
                organizationRepositoriesError={organizationRepositories.error}
                organizationMembers={organizationMembers.data?.items ?? []}
                organizationMembersAvailability={organizationMembers.data?.availability ?? null}
                organizationMemberLimit={organizationMemberLimit}
                organizationMembersLoading={organizationMembers.isLoading || organizationMembers.isFetching}
                organizationMembersError={organizationMembers.error}
                selectedOrganizationMemberLogin={selectedOrganizationMemberLogin}
                selectedOrganizationTeamSlug={selectedOrganizationTeam?.slug ?? null}
                organizationTeamRepositories={organizationTeamRepositories.data?.items ?? []}
                organizationTeamRepositoriesAvailability={
                  organizationTeamRepositories.data?.availability ?? null
                }
                organizationTeamRepositoryLimit={organizationTeamRepositoryLimit}
                organizationTeamRepositoriesLoading={
                  organizationTeamRepositories.isLoading || organizationTeamRepositories.isFetching
                }
                organizationTeamRepositoriesError={organizationTeamRepositories.error}
                organizationTeamMembers={organizationTeamMembers.data?.items ?? []}
                organizationTeamMembersAvailability={organizationTeamMembers.data?.availability ?? null}
                organizationTeamMemberLimit={organizationTeamMemberLimit}
                organizationTeamMembersLoading={
                  organizationTeamMembers.isLoading || organizationTeamMembers.isFetching
                }
                organizationTeamMembersError={organizationTeamMembers.error}
                organizationProjects={organizationProjects.data?.items ?? []}
                organizationProjectsAvailability={organizationProjects.data?.availability ?? null}
                organizationProjectLimit={organizationProjectLimit}
                organizationProjectsLoading={
                  organizationProjects.isLoading || organizationProjects.isFetching
                }
                organizationProjectsError={organizationProjects.error}
                selectedOrganizationProjectId={selectedOrganizationProjectId}
                pinnedRepositoryNames={pinnedRepositoryNames}
                repositoryPinBusy={repositoryPinBusy}
                repositoryPinError={repositoryPinError}
                onOpenExternal={(url) => void api.openExternal(url)}
                onOpenRepository={openRepositoryInApp}
                onSelectOrganization={(login) => {
                  const organization = organizationItems.find((item) => item.login === login);
                  if (organization) {
                    recordRecent(organizationRecentInput(organization));
                  }
                  setSelectedOrganizationLogin(login);
                  setSelectedOrganizationTeamSlug(null);
                  setSelectedOrganizationMemberLogin(null);
                  setSelectedOrganizationProjectId(null);
                }}
                onSelectOrganizationTeam={(slug) => {
                  const team = organizationTeams.data?.items.find((item) => item.slug === slug);
                  if (team) {
                    recordRecent(teamRecentInput(team));
                  }
                  setSelectedOrganizationTeamSlug(slug);
                  setSelectedOrganizationMemberLogin(null);
                  setSelectedOrganizationProjectId(null);
                }}
                onSelectOrganizationMember={(login) => {
                  setSelectedOrganizationMemberLogin(login);
                  setSelectedOrganizationProjectId(null);
                }}
                onSelectOrganizationProject={(project) => {
                  if (selectedOrganization) {
                    selectOrganizationProjectInApp(selectedOrganization, project);
                  }
                }}
                onExpandOrganizations={expandOrganizationList}
                onExpandOrganizationRepositories={expandSelectedOrganizationRepositories}
                onExpandOrganizationTeams={expandSelectedOrganizationTeams}
                onExpandOrganizationMembers={expandSelectedOrganizationMembers}
                onExpandOrganizationProjects={expandSelectedOrganizationProjects}
                onExpandOrganizationTeamRepositories={expandSelectedOrganizationTeamRepositories}
                onExpandOrganizationTeamMembers={expandSelectedOrganizationTeamMembers}
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
