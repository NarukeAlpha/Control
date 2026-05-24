import { useMemo } from "react";
import type { JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MarkdownUrlHandlerContext } from "./components/MarkdownBody";
import { LocalAreaHome } from "./components/areas/LocalAreaHome";
import { SetupPanel } from "./components/auth/SetupPanel";
import { useAreasShell } from "./components/areas/useAreasShell";
import { useProviderAuth } from "./components/auth/AuthProvider";
import { RepositoriesRoute } from "./components/collection/RepositoriesRoute";
import { MailboxRoute } from "./components/collection/MailboxRoute";
import { OrganizationsRoute } from "./components/collection/OrganizationsRoute";
import { useOrganizationsRouteState } from "./components/collection/useOrganizationsRouteState";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { useCommandPaletteController } from "./components/command-palette/useCommandPaletteController";
import { useCommandPaletteItems } from "./components/command-palette/useCommandPaletteItems";
import { HomeDashboard } from "./components/home/HomeDashboard";
import { LocalRepositoryPage } from "./components/local-repository/LocalRepositoryPage";
import { Sidebar } from "./components/sidebar/Sidebar";
import { AppEventBridge } from "./components/shell/AppEventBridge";
import { RepositoryRouteSection } from "./components/shell/RepositoryRouteSection";
import { invalidateGitHubMutationQueries } from "./components/shell/appInvalidations";
import { ShellDialogs } from "./components/shell/ShellDialogs";
import { useShellDialogState } from "./components/shell/useShellDialogState";
import { TopBar } from "./components/topbar/TopBar";

import { readAvailabilityMessage } from "./components/repository/repositoryUi";

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
  const commandPalette = useCommandPaletteController();
  const dialogs = useShellDialogState();
  const [repositoryRefs, setRepositoryRefs] = useStoredRepositoryRefs();

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
    fileFinderOpen: dialogs.fileFinderOpen
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
    codeBrowserQueries,
    discussions,
    projects,
    releaseItems,
    contributorItems,
    actionItems,
    refreshActions
  } = repositoryRouteState;
  const {
    repositoryRefListLimit,
    maxRefListLimit,
    forksLimit,
    repositoryAccessLimit,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    expandActiveRepositoryRefs
  } = repositoryRouteState.limits;
  const { repositoryTree, repositoryTreeItem, repositoryTreeAvailabilityMessage } = codeBrowserQueries;
  const { refreshRepositorySurface } = refreshActions;
  const navigationActions = useAppNavigationActions({
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
  const {
    openRepositoryInApp,
    openLocalRepositoryInApp,
    openRepositoryRouteInApp,
    openCodeBrowserInApp,
    repositoryRefKindForName,
    selectRepositoryRefInApp,
    selectDiscussionInApp,
    selectProjectInApp,
    selectOrganizationProjectInApp,
    openTeamInApp,
    selectWorkflowRunInApp,
    selectWorkflowArtifactInApp,
    selectSecurityItemInApp,
    selectWikiPageInApp,
    selectReleaseInApp,
    selectReleaseAssetInApp,
    selectContributorInApp,
    selectRepositorySettingsCollaboratorInApp,
    openIssueSummaryInApp,
    openPullRequestSummaryInApp,
    openNotificationInApp,
    openRecentItem,
    openMarkdownUrl
  } = navigationActions;

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
    onOpenAddRepository: dialogs.openAddRepository,
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
      dialogs.openFileFinder();
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

  const shellClass = [
    "app-shell",
    appState.data?.settings.glassMode === "solid" ? "solid-shell" : null,
    appState.data?.settings.glassMode === "reduced" ? "reduced-glass" : null
  ]
    .filter(Boolean)
    .join(" ");
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
          onOpenRepositorySearch={commandPalette.openPalette}
          onOpenAddRepository={dialogs.openAddRepository}
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
          onAddSshArea={dialogs.openSshArea}
          onEditArea={dialogs.openAreaEdit}
          onDeleteArea={dialogs.openAreaDelete}
          onGoRepository={() => {
            if (effectiveRepository) {
              openRepositoryInApp(effectiveRepository);
            }
          }}
          onOpenRepository={openRepositoryInApp}
          onOpenLocalRepository={openLocalRepositoryInApp}
          onOpenAddRepository={dialogs.openAddRepository}
          onOpenCommandPalette={commandPalette.openPalette}
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

            <RepositoryRouteSection
              route={route}
              githubReady={githubReady}
              routeState={repositoryRouteState}
              navigation={navigationActions}
              dialogs={dialogs}
              mutation={mutation}
              repositoryPinBusy={repositoryPinBusy}
              repositoryPinError={repositoryPinError}
              isRepositoryPinned={isRepositoryPinned}
              toggleRepositoryPin={toggleRepositoryPin}
              onOpenExternal={(url) => void api.openExternal(url)}
            />

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
                onOpenAddRepository={dialogs.openAddRepository}
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

        {commandPalette.open && (
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
            onClose={commandPalette.closePalette}
          />
        )}

        <ShellDialogs
          dialogs={dialogs}
          repositories={repositoryItems}
          viewerLogin={appState.data?.viewer?.login ?? accountProfileData?.login ?? null}
          githubReady={githubReady}
          appState={appState.data}
          authController={providerAuth.github}
          settingsOpen={settingsOpen}
          route={route}
          repository={repositoryDetail}
          repositoryTree={repositoryTreeItem}
          repositoryTreeLoading={repositoryTree.isLoading || repositoryTree.isFetching}
          repositoryTreeError={repositoryTree.error}
          repositoryTreeAvailabilityMessage={repositoryTreeAvailabilityMessage}
          branches={branchItems}
          tags={tagItems}
          refListLimit={repositoryRefListLimit}
          maxRefListLimit={maxRefListLimit}
          refsLoading={branches.isLoading || branches.isFetching || tags.isLoading || tags.isFetching}
          refsError={refsError}
          refsAvailabilityMessage={refsAvailabilityMessage || null}
          selectedRef={contentsRef ?? repositoryDetail?.defaultBranch ?? "HEAD"}
          selectedCodeRef={contentsRef ?? repositoryDetail?.defaultBranch ?? null}
          effectiveRepository={effectiveRepository}
          onOpenRepository={openRepositoryInApp}
          onCreateSshArea={createSshArea}
          onUpdateArea={updateArea}
          onDeleteArea={deleteArea}
          onCloseSettings={() => setSettingsOpen(false)}
          onOpenExternal={(url) => void api.openExternal(url)}
          onSaveSettings={async (settings) => {
            await api.updateSettings(settings);
            await queryClient.invalidateQueries({ queryKey: ["app-state"] });
          }}
          onSelectRepositoryRef={selectRepositoryRefInApp}
          repositoryRefKindForName={repositoryRefKindForName}
          onExpandRefs={expandActiveRepositoryRefs}
          onOpenCodeBrowser={openCodeBrowserInApp}
        />
      </div>
    </MarkdownUrlHandlerContext.Provider>
  );
}
