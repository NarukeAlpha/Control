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
import { RepositoriesRoute } from "./components/collection/RepositoriesRoute";
import { MailboxRoute } from "./components/collection/MailboxRoute";
import { OrganizationsRoute } from "./components/collection/OrganizationsRoute";
import { useOrganizationsRouteState } from "./components/collection/useOrganizationsRouteState";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { useCommandPaletteItems } from "./components/command-palette/useCommandPaletteItems";
import { AddRepositoryDialog } from "./components/dialogs/AddRepositoryDialog";
import { FileFinder } from "./components/file-finder/FileFinder";
import { HomeDashboard } from "./components/home/HomeDashboard";
import { LocalRepositoryPage } from "./components/local-repository/LocalRepositoryPage";
import { RepositoryPage } from "./components/repository/RepositoryPage";
import { RepositoryContextProvider } from "./components/repository/RepositoryContext";
import { createGitHubMutationInput } from "./components/repository/githubMutationHelpers";
import { RightRail } from "./components/right-rail/RightRail";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { Sidebar } from "./components/sidebar/Sidebar";
import { AppEventBridge } from "./components/shell/AppEventBridge";
import { invalidateGitHubMutationQueries } from "./components/shell/appInvalidations";
import { TopBar } from "./components/topbar/TopBar";

import { githubActionLabel, readAvailabilityMessage } from "./components/repository/repositoryUi";

import { useAccountProfile } from "./hooks/useAccountProfile";
import { useAccountWork } from "./hooks/useAccountWork";
import { useCollectionRefreshActions } from "./hooks/useCollectionRefreshActions";
import { useControlApi } from "./hooks/useControlApi";
import { useMailboxNotifications } from "./hooks/useMailboxNotifications";
import { useRecentItems } from "./hooks/useRecentItems";
import { useRepositoryDirectory } from "./hooks/useRepositoryDirectory";
import { useRepositoryPins } from "./hooks/useRepositoryPins";
import { useAppNavigationActions } from "./hooks/useAppNavigationActions";
import { useCollectionSurfaceState } from "./hooks/useCollectionSurfaceState";
import { useRepositoryRouteState } from "./hooks/useRepositoryRouteState";
import { useStoredRepositoryRefs } from "./hooks/useStoredRepositoryRefs";
import { useUiStore, type AppRoute } from "./stores/uiStore";

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

  const repositoryRouteState = useRepositoryRouteState({
    appReady: appState.isSuccess,
    githubReady,
    route,
    selectedRepository,
    repositoryRefs,
    fileFinderOpen
  });
  const {
    isRepositoryRoute,
    isLocalRepositoryRoute,
    isRepositoryContext,
    activeLocalRepositoryTab,
    activeLocalRepositoryPath,
    effectiveRepository,
    owner,
    repo,
    activeRepositoryScope,
    repositoryContextValue,
    codeBrowserRef,
    contentsRef,
    repository,
    repositoryDetail,
    repositoryAvailabilityMessage,
    branches,
    tags,
    branchItems,
    tagItems,
    refsAvailabilityMessage,
    refsError,
    codeTabQueries,
    codeBrowserQueries,
    discussions,
    projects,
    releases,
    releaseItems,
    releasesAvailability,
    contributors,
    contributorItems,
    contributorsAvailability,
    actionItems,
    refreshActions
  } = repositoryRouteState;
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
  } = repositoryRouteState.limits;
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
  } = codeBrowserQueries;
  const { refreshRepositoryDetailNow, refreshCodeBrowserNow, refreshRepositorySurface } = refreshActions;
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

  const { repositoryCommits, repositoryCommitItems, repositoryCommitsAvailability } = codeTabQueries;
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
  const commandPaletteItems = useCommandPaletteItems({
    queryClient,
    route,
    githubReady,
    appFetching: appState.isFetching,
    accountProfileFetching: accountProfile.isFetching,
    viewerLogin: appState.data?.viewer?.login ?? null,
    repositoriesFetching: repositories.isFetching,
    repositoryItems,
    pinnedRepositoryNames,
    recentItems: recentItems.data ?? [],
    notificationsFetching: notifications.isFetching,
    notificationsLoading: notifications.isLoading,
    notificationItems,
    accountIssuesFetching: accountIssues.isFetching,
    accountIssueItems,
    accountPullsFetching: accountPulls.isFetching,
    accountPullItems,
    markVisibleNotificationsReadPending: markVisibleNotificationsRead.isPending,
    organizationsRouteState,
    effectiveRepository,
    owner,
    repo,
    repositoryDetail,
    repository: {
      isLoading: repository.isLoading,
      isFetching: repository.isFetching,
      error: repository.error
    },
    repositoryAvailabilityMessage,
    repositoryPinBusy,
    branchItems,
    tagItems,
    branchesLoaded: Boolean(branches.data),
    tagsLoaded: Boolean(tags.data),
    discussionItems: discussions.data?.items ?? [],
    projectItems: projects.data?.items ?? [],
    contributorItems,
    releaseItems,
    actionItems,
    repositoryAccessLimit,
    forksLimit,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositorySecurityAdvisoriesLimit,
    repositoryRulesetsLimit,
    isRepositoryPinned,
    onGoHome: goHome,
    onOpenRepositories: goToRepositories,
    onOpenAddRepository: () => setAddRepositoryOpen(true),
    onRefreshHome: () => {
      void refreshHomeNow();
    },
    onRefreshRepositories: () => {
      void refreshRepositoriesNow();
    },
    onRefreshOrganizations: () => {
      void refreshOrganizationsNow();
    },
    onOpenMailbox: goToMailbox,
    onRefreshMailbox: () => {
      void refreshMailboxNow();
    },
    onMarkLoadedNotificationsRead: (threadIds) => {
      markVisibleNotificationsRead.mutate({ threadIds });
    },
    onOpenSettings: () => setSettingsOpen(true),
    onOpenRepository: openRepositoryInApp,
    onOpenRepositoryRoute: openRepositoryRouteInApp,
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
    onOpenExternalGitHub: (nameWithOwner) => void api.openExternal(`https://github.com/${nameWithOwner}`),
    onOpenRecent: openRecentItem,
    onOpenNotification: openNotificationInApp,
    onOpenIssue: openIssueSummaryInApp,
    onOpenPullRequest: openPullRequestSummaryInApp,
    onSelectRepositoryRef: selectRepositoryRefInApp,
    onSelectWikiPage: selectWikiPageInApp,
    onSelectDiscussion: selectDiscussionInApp,
    onSelectProject: selectProjectInApp,
    onSelectContributor: selectContributorInApp,
    onSelectCollaborator: selectRepositorySettingsCollaboratorInApp,
    onSelectTeam: openTeamInApp,
    onSelectRelease: selectReleaseInApp,
    onSelectReleaseAsset: selectReleaseAssetInApp,
    onSelectWorkflowRun: selectWorkflowRunInApp,
    onSelectWorkflowArtifact: selectWorkflowArtifactInApp,
    onSelectSecurityItem: selectSecurityItemInApp,
    onSelectOrganizationProject: selectOrganizationProjectInApp
  });

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
