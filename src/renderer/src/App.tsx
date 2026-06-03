import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AppState,
  ControlSettings,
  RepositoryTabPreferenceKey,
  RepositoryTabPreferenceMap
} from "@shared/github";

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
import { resolveControlThemeStyleVars, useResolvedControlTheme } from "./theme/themeSettings";

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

function mergeSettingsPreview(
  settings: ControlSettings | undefined,
  preview: Partial<ControlSettings> | null
): ControlSettings | undefined {
  if (!settings || !preview) {
    return settings;
  }

  const previewTheme = preview.theme;
  return {
    ...settings,
    ...preview,
    theme: previewTheme
      ? {
          ...settings.theme,
          ...previewTheme,
          custom: previewTheme.custom
            ? {
                ...settings.theme.custom,
                ...previewTheme.custom,
                light: {
                  ...settings.theme.custom.light,
                  ...previewTheme.custom.light
                },
                dark: {
                  ...settings.theme.custom.dark,
                  ...previewTheme.custom.dark
                }
              }
            : settings.theme.custom
        }
      : settings.theme,
    repositoryTabPreferences: preview.repositoryTabPreferences ?? settings.repositoryTabPreferences,
    repositoryTabPreferencesByRepository:
      preview.repositoryTabPreferencesByRepository ?? settings.repositoryTabPreferencesByRepository
  };
}

function useContentScrollReset(route: AppRoute) {
  const contentScrollRef = useRef<HTMLElement | null>(null);
  const contentScrollKey = JSON.stringify(route);

  useEffect(() => {
    if (!contentScrollRef.current) {
      return;
    }

    contentScrollRef.current.scrollTop = 0;
    contentScrollRef.current.scrollLeft = 0;
  }, [contentScrollKey]);

  return contentScrollRef;
}

function useAppShellState() {
  const api = useControlApi();
  const providerAuth = useProviderAuth();
  const queryClient = useQueryClient();
  const route = useUiStore((state) => state.route);
  const selectedAreaId = useUiStore((state) => state.selectedAreaId);
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
  const [settingsPreview, setSettingsPreview] = useState<Partial<ControlSettings> | null>(null);

  const appState = useQuery({
    queryKey: ["app-state"],
    queryFn: () => api.getAppState()
  });
  const githubAuthenticated = appState.data?.github.authenticated ?? false;
  const githubReady = appState.isSuccess && githubAuthenticated;
  const repositoryTabPreferences = appState.data?.settings.repositoryTabPreferences ?? {};
  const repositoryTabPreferencesByRepository =
    appState.data?.settings.repositoryTabPreferencesByRepository ?? {};
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
    mailboxWorkLimit,
    recentItemLimit,
    notificationFilter,
    accountWorkLimit,
    notificationLimit,
    maxHomeWorkLimit,
    setNotificationFilter,
    expandMailboxWork,
    loadMoreHomeRepositoryActivity,
    expandMailboxNotifications,
    expandRepositoryList
  } = useCollectionSurfaceState({
    activeRouteKind: route.kind
  });

  const selectedAreaKind =
    selectedArea?.kind ??
    (selectedAreaId?.startsWith("local:") ? "local" : selectedAreaId?.startsWith("ssh:") ? "ssh" : "github");
  const repositories = useRepositoryDirectory(repositoryListLimit, {
    enabled: appState.isSuccess && (route.kind !== "repositories" || selectedAreaKind === "github"),
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
  } = useRepositoryPins({ appReady: appState.isSuccess });

  const recentItems = useRecentItems(recentItemLimit, { appReady: appState.isSuccess });

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
    fileFinderOpen: dialogs.fileFinderOpen,
    repositoryTabPreferences,
    repositoryTabPreferencesByRepository
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
  const topbarRepository = effectiveRepository || (repositoryItems[0]?.nameWithOwner ?? null);
  const { repositoryTree, repositoryTreeItem, repositoryTreeAvailabilityMessage } = codeBrowserQueries;
  const { refreshRepositorySurface } = refreshActions;

  async function showRepositoryTab(tab: RepositoryTabPreferenceKey): Promise<void> {
    if (!effectiveRepository) {
      return;
    }

    await saveRepositoryTabPreferences(effectiveRepository, {
      ...repositoryRouteState.repositoryScopedTabPreferences,
      [tab]: "show"
    });
  }

  async function saveRepositoryTabPreferences(
    nameWithOwner: string,
    preferences: RepositoryTabPreferenceMap
  ): Promise<void> {
    await api.updateSettings({
      repositoryTabPreferencesByRepository: {
        ...repositoryTabPreferencesByRepository,
        [nameWithOwner]: preferences
      }
    });
    await queryClient.invalidateQueries({ queryKey: ["app-state"] });
  }
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
    openLocalFileInApp,
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        invalidateGitHubMutationQueries(queryClient, input)
      ]);
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

  const effectiveSettings = useMemo(
    () => mergeSettingsPreview(appState.data?.settings, settingsPreview),
    [appState.data?.settings, settingsPreview]
  );
  const resolvedTheme = useResolvedControlTheme(effectiveSettings?.theme);
  const themeStyleVars = useMemo(
    () => resolveControlThemeStyleVars(effectiveSettings?.theme, resolvedTheme.resolvedMode),
    [effectiveSettings?.theme, resolvedTheme.resolvedMode]
  );
  const shellClass = [
    "app-shell",
    effectiveSettings?.glassMode === "solid" ? "solid-shell" : null,
    effectiveSettings?.glassMode === "reduced" ? "reduced-glass" : null
  ]
    .filter(Boolean)
    .join(" ");

  function openExternal(url: string): void {
    void api.openExternal(url);
  }

  function openSettingsPanel(): void {
    setSettingsOpen(true);
  }

  function closeSettingsPanel(): void {
    setSettingsPreview(null);
    setSettingsOpen(false);
  }

  async function saveSettings(settings: Partial<AppState["settings"]>): Promise<void> {
    setSettingsPreview(settings);
    await api.updateSettings(settings);
    await queryClient.invalidateQueries({ queryKey: ["app-state"] });
    setSettingsPreview(null);
  }

  return {
    api,
    providerAuth,
    route,
    selectedAreaId,
    goToLocalRepository,
    goHome,
    goToRepositories,
    goToMailbox,
    settingsOpen,
    commandPalette,
    dialogs,
    appState,
    githubReady,
    authenticatedViewerLogin,
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
    stopSelectedAreaGateway,
    repositoryListLimit,
    homeRepositoryActivityLimit,
    mailboxWorkLimit,
    notificationFilter,
    accountWorkLimit,
    notificationLimit,
    setNotificationFilter,
    expandMailboxWork,
    loadMoreHomeRepositoryActivity,
    expandMailboxNotifications,
    expandRepositoryList,
    repositories,
    repositoryItems,
    repositoriesAvailabilityMessage,
    repositoryPinRecords,
    pinnedRepositoryNames,
    isRepositoryPinned,
    isAreaRepositoryPinned,
    repositoryPinBusy,
    repositoryPinError,
    toggleRepositoryPin,
    toggleAreaRepositoryPin,
    recentItems,
    accountProfileData,
    accountProfileAvailabilityMessage,
    accountIssues,
    accountIssueItems,
    accountIssuesAvailability,
    accountPulls,
    accountPullItems,
    accountPullsAvailability,
    organizationsRouteState,
    repositoryRouteState,
    isRepositoryRoute,
    isLocalRepositoryRoute,
    isRepositoryContext,
    activeLocalRepositoryTab,
    activeLocalRepositoryPath,
    effectiveRepository,
    activeRepositoryScope,
    contentsRef,
    repositoryDetail,
    branches,
    tags,
    branchItems,
    tagItems,
    refsAvailabilityMessage,
    refsError,
    repositoryRefListLimit,
    maxRefListLimit,
    expandActiveRepositoryRefs,
    topbarRepository,
    repositoryTree,
    repositoryTreeItem,
    repositoryTreeAvailabilityMessage,
    openRepositoryInApp,
    openLocalRepositoryInApp,
    openLocalFileInApp,
    openRepositoryRouteInApp,
    openCodeBrowserInApp,
    repositoryRefKindForName,
    selectRepositoryRefInApp,
    openIssueSummaryInApp,
    openPullRequestSummaryInApp,
    openNotificationInApp,
    openRecentItem,
    openMarkdownUrl,
    navigationActions,
    refreshHomeNow,
    refreshRepositoriesNow,
    refreshMailboxNow,
    refreshOrganizationsNow,
    mutation,
    commandPaletteItems,
    resolvedTheme,
    themeStyleVars,
    shellClass,
    setSettingsPreview,
    showRepositoryTab,
    saveRepositoryTabPreferences,
    openExternal,
    openSettingsPanel,
    closeSettingsPanel,
    saveSettings
  };
}

type AppShellState = ReturnType<typeof useAppShellState>;
type TopBarProps = ComponentProps<typeof TopBar>;
type LocalRepositoryPageProps = ComponentProps<typeof LocalRepositoryPage>;
type CommandPaletteProps = ComponentProps<typeof CommandPalette>;
type CommandPaletteFileSearch = CommandPaletteProps["fileSearch"];
type CommandPaletteLocalFileSearch = CommandPaletteProps["localFileSearch"];

export function App(): JSX.Element {
  const state = useAppShellState();
  const contentScrollRef = useContentScrollReset(state.route);
  return <AppShell state={state} contentScrollRef={contentScrollRef} />;
}

function AppShell({
  state,
  contentScrollRef
}: {
  state: AppShellState;
  contentScrollRef: ReturnType<typeof useContentScrollReset>;
}): JSX.Element {
  useEffect(() => {
    const background = state.themeStyleVars["--color-app-background"];
    const color = state.themeStyleVars["--color-text"];

    document.documentElement.style.background = background;
    document.body.style.background = background;
    document.body.style.color = color;

    return () => {
      document.documentElement.style.removeProperty("background");
      document.body.style.removeProperty("background");
      document.body.style.removeProperty("color");
    };
  }, [state.themeStyleVars]);

  return (
    <MarkdownUrlHandlerContext.Provider value={state.openMarkdownUrl}>
      <AppEventBridge activeRepository={state.activeRepositoryScope} />
      <div
        className={state.shellClass}
        data-accent={state.resolvedTheme.accent}
        data-color-scheme={state.resolvedTheme.colorScheme}
        data-theme-mode={state.resolvedTheme.requestedMode}
        data-theme-preset={state.resolvedTheme.preset}
        style={state.themeStyleVars as CSSProperties}
      >
        <AppSidebar state={state} />
        <AppTopBar state={state} />
        <AppWorkspace state={state} contentScrollRef={contentScrollRef} />
        <AppCommandPaletteOverlay state={state} />
        <AppShellDialogHost state={state} />
      </div>
    </MarkdownUrlHandlerContext.Provider>
  );
}

function AppSidebar({ state }: { state: AppShellState }): JSX.Element {
  return (
    <Sidebar
      appState={state.appState.data}
      profile={state.accountProfileData ?? undefined}
      areas={state.areaItems}
      selectedAreaId={state.selectedArea?.id ?? null}
      localRepositories={state.localRepositoryItems}
      localRepositoriesLoading={
        state.selectedAreaRepositories.isLoading || state.selectedAreaRepositories.isFetching
      }
      repositories={state.repositoryItems}
      repositoriesLoading={state.repositories.isLoading || state.repositories.isFetching}
      repositoriesError={state.repositories.error}
      repositoriesAvailabilityMessage={state.repositoriesAvailabilityMessage}
      pinnedRepositoryNames={state.pinnedRepositoryNames}
      repositoryPinRecords={state.repositoryPinRecords}
      selectedRepository={state.effectiveRepository}
      route={state.route}
      onSelectLocalRepository={state.openLocalRepositoryInApp}
      onSelectRepository={state.openRepositoryInApp}
      onOpenRepositorySearch={state.commandPalette.openPalette}
      onOpenAddRepository={state.dialogs.openAddRepository}
      onOpenSettings={state.openSettingsPanel}
    />
  );
}

function AppTopBar({ state }: { state: AppShellState }): JSX.Element {
  function selectTopBarArea(areaId: string): void {
    void state.selectArea(areaId);
  }

  function openTopBarRepository(): void {
    if (state.topbarRepository) {
      state.openRepositoryInApp(state.topbarRepository);
    }
  }

  const openTopBarWorkspace: TopBarProps["onOpenWorkspace"] = (workspace) => {
    state.goToLocalRepository(workspace.areaId, workspace.repositoryId, "overview", workspace.id);
  };

  return (
    <TopBar
      viewer={state.appState.data?.viewer ?? null}
      route={state.route}
      areas={state.areaItems}
      selectedAreaId={state.selectedArea?.id ?? state.selectedAreaId}
      selectedRepository={state.topbarRepository}
      repositories={state.repositoryItems}
      githubReady={state.githubReady}
      onSelectArea={selectTopBarArea}
      onEditArea={state.dialogs.openAreaEdit}
      onDeleteArea={state.dialogs.openAreaDelete}
      onGoRepository={openTopBarRepository}
      onOpenRepository={state.openRepositoryInApp}
      onOpenLocalRepository={state.openLocalRepositoryInApp}
      onOpenWorkspace={openTopBarWorkspace}
      onOpenAddRepository={state.dialogs.openAddRepository}
      onOpenCommandPalette={state.commandPalette.openPalette}
      onOpenHome={state.goHome}
      onOpenMailbox={state.goToMailbox}
      onOpenSettings={state.openSettingsPanel}
    />
  );
}

function AppWorkspace({
  state,
  contentScrollRef
}: {
  state: AppShellState;
  contentScrollRef: ReturnType<typeof useContentScrollReset>;
}): JSX.Element {
  const repositoryWorkspace = state.isRepositoryRoute || state.isLocalRepositoryRoute;
  const homeRoute = state.route.kind === "home";
  const workspaceClass = [
    "workspace",
    repositoryWorkspace ? "workspace-repository" : "workspace-wide",
    homeRoute ? "workspace-home" : null
  ]
    .filter(Boolean)
    .join(" ");
  const contentScrollClass = [
    "content-scroll",
    repositoryWorkspace ? "repository-content-scroll" : null,
    homeRoute ? "home-content-scroll" : null
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={workspaceClass}>
      {!state.appState.data?.github.authenticated && <SetupPanel appState={state.appState.data} />}

      <main ref={contentScrollRef} className={contentScrollClass}>
        <AppHomeRoute state={state} />
        <AppLocalRepositoryRoute state={state} />
        <AppRepositoryRoute state={state} />
        <AppCollectionRoutes state={state} />
      </main>
    </section>
  );
}

function AppHomeRoute({ state }: { state: AppShellState }): JSX.Element | null {
  if (state.route.kind !== "home") {
    return null;
  }

  function loadMoreHomeRepositories(): void {
    state.loadMoreHomeRepositoryActivity(state.repositoryItems.length);
  }

  if (state.selectedArea && state.selectedAreaIsGateway) {
    return (
      <LocalAreaHome
        area={state.selectedArea}
        repositories={state.localRepositoryItems}
        repositoriesLoading={
          state.selectedAreaRepositories.isLoading || state.selectedAreaRepositories.isFetching
        }
        recentItems={state.recentItems.data ?? []}
        onOpenRepository={state.openLocalRepositoryInApp}
        onOpenRecent={state.openRecentItem}
        onRefresh={state.refreshSelectedArea}
        onStopGateway={state.stopSelectedAreaGateway}
      />
    );
  }

  return (
    <HomeDashboard
      appState={state.appState.data}
      profile={state.accountProfileData ?? undefined}
      profileAvailabilityMessage={state.accountProfileAvailabilityMessage}
      repositories={state.repositoryItems}
      repositoryActivityLimit={state.homeRepositoryActivityLimit}
      repositoriesLoading={state.repositories.isLoading || state.repositories.isFetching}
      repositoriesError={state.repositories.error}
      repositoriesAvailabilityMessage={state.repositoriesAvailabilityMessage}
      pinnedRepositoryNames={state.pinnedRepositoryNames}
      issues={state.accountIssueItems}
      issuesLoading={state.accountIssues.isLoading || state.accountIssues.isFetching}
      issuesError={state.accountIssues.error}
      issuesAvailability={state.accountIssuesAvailability}
      pulls={state.accountPullItems}
      pullsLoading={state.accountPulls.isLoading || state.accountPulls.isFetching}
      pullsError={state.accountPulls.error}
      pullsAvailability={state.accountPullsAvailability}
      onOpenRepository={state.openRepositoryInApp}
      onLoadMoreRepositories={loadMoreHomeRepositories}
      onOpenIssue={state.openIssueSummaryInApp}
      onOpenPullRequest={state.openPullRequestSummaryInApp}
      onOpenExternal={state.openExternal}
    />
  );
}

function AppLocalRepositoryRoute({ state }: { state: AppShellState }): JSX.Element | null {
  if (state.route.kind !== "localRepository") {
    return null;
  }

  const route = state.route;
  const selectLocalRepositoryTab: LocalRepositoryPageProps["onSelectTab"] = (tab) => {
    state.goToLocalRepository(
      route.areaId,
      route.repositoryId,
      tab,
      route.workspaceId ?? null,
      route.path ?? null
    );
  };
  const selectLocalRepositoryWorkspace: LocalRepositoryPageProps["onSelectWorkspace"] = (workspaceId) => {
    state.goToLocalRepository(
      route.areaId,
      route.repositoryId,
      state.activeLocalRepositoryTab,
      workspaceId,
      route.path ?? null
    );
  };
  const openLocalRepositoryPath: LocalRepositoryPageProps["onOpenPath"] = (entry) => {
    state.goToLocalRepository(
      route.areaId,
      route.repositoryId,
      "code",
      route.workspaceId ?? null,
      entry.path
    );
  };

  return (
    <LocalRepositoryPage
      route={route}
      activeTab={state.activeLocalRepositoryTab}
      activePath={state.activeLocalRepositoryPath}
      onSelectTab={selectLocalRepositoryTab}
      onSelectWorkspace={selectLocalRepositoryWorkspace}
      onOpenPath={openLocalRepositoryPath}
      pinned={state.isAreaRepositoryPinned(route.areaId, route.repositoryId, route.workspaceId ?? null)}
      pinBusy={state.repositoryPinBusy}
      onTogglePin={state.toggleAreaRepositoryPin}
      onOpenGitHub={state.openRepositoryInApp}
      onOpenExternal={state.openExternal}
      onConfirm={state.dialogs.requestConfirmation}
      githubReady={state.githubReady}
    />
  );
}

function AppRepositoryRoute({ state }: { state: AppShellState }): JSX.Element {
  function showRepositoryTab(tab: RepositoryTabPreferenceKey): void {
    void state.showRepositoryTab(tab);
  }

  return (
    <RepositoryRouteSection
      route={state.route}
      githubReady={state.githubReady}
      routeState={state.repositoryRouteState}
      navigation={state.navigationActions}
      dialogs={state.dialogs}
      mutation={state.mutation}
      repositoryPinBusy={state.repositoryPinBusy}
      repositoryPinError={state.repositoryPinError}
      isRepositoryPinned={state.isRepositoryPinned}
      toggleRepositoryPin={state.toggleRepositoryPin}
      onShowRepositoryTab={showRepositoryTab}
      onSaveRepositoryTabPreferences={state.saveRepositoryTabPreferences}
      onOpenExternal={state.openExternal}
    />
  );
}

function AppCollectionRoutes({ state }: { state: AppShellState }): JSX.Element | null {
  function refreshOrganizations(): void {
    void state.refreshOrganizationsNow();
  }

  if (state.route.kind === "repositories") {
    return (
      <RepositoriesRoute
        title={routeTitle(state.route)}
        repositoryListLimit={state.repositoryListLimit}
        selectedArea={state.selectedArea}
        githubRepositoryItems={state.repositoryItems}
        githubRepositoriesLoading={state.repositories.isLoading}
        githubRepositoriesFetching={state.repositories.isFetching}
        githubRepositoriesError={state.repositories.error instanceof Error ? state.repositories.error : null}
        githubRepositoriesAvailability={state.repositoriesAvailabilityMessage}
        localRepositories={state.localRepositoryItems}
        localRepositoriesLoading={
          state.selectedAreaRepositories.isLoading || state.selectedAreaRepositories.isFetching
        }
        areaRepositoryPinRecords={state.repositoryPinRecords}
        pinnedRepositoryNames={state.pinnedRepositoryNames}
        repositoryPinBusy={state.repositoryPinBusy}
        repositoryPinError={state.repositoryPinError}
        viewerLogin={state.appState.data?.viewer?.login ?? state.accountProfileData?.login ?? null}
        onOpenExternal={state.openExternal}
        onOpenRepository={state.openRepositoryInApp}
        onOpenLocalRepository={state.openLocalRepositoryInApp}
        onOpenAddRepository={state.dialogs.openAddRepository}
        onExpandRepositories={state.expandRepositoryList}
        onToggleRepositoryPin={state.toggleRepositoryPin}
        onToggleAreaRepositoryPin={state.toggleAreaRepositoryPin}
        onRefreshRepositories={state.refreshRepositoriesNow}
        onRefreshSelectedArea={state.refreshSelectedArea}
      />
    );
  }

  if (state.route.kind === "mailbox") {
    return (
      <MailboxRoute
        title={routeTitle(state.route)}
        appReady={state.appState.isSuccess}
        githubReady={state.githubReady}
        viewerLogin={state.authenticatedViewerLogin}
        accountWorkLimit={state.accountWorkLimit}
        notificationFilter={state.notificationFilter}
        notificationLimit={state.notificationLimit}
        onOpenExternal={state.openExternal}
        onOpenIssue={state.openIssueSummaryInApp}
        onOpenPullRequest={state.openPullRequestSummaryInApp}
        onOpenNotification={state.openNotificationInApp}
        onNotificationFilterChange={state.setNotificationFilter}
        onExpandMailboxWork={state.expandMailboxWork}
        onExpandMailboxNotifications={state.expandMailboxNotifications}
        onConfirm={state.dialogs.requestConfirmation}
      />
    );
  }

  if (state.route.kind === "organizations") {
    return (
      <OrganizationsRoute
        title={routeTitle(state.route)}
        githubReady={state.githubReady}
        routeState={state.organizationsRouteState}
        pinnedRepositoryNames={state.pinnedRepositoryNames}
        repositoryPinBusy={state.repositoryPinBusy}
        repositoryPinError={state.repositoryPinError}
        onOpenExternal={state.openExternal}
        onOpenRepository={state.openRepositoryInApp}
        onToggleRepositoryPin={state.toggleRepositoryPin}
        onRefresh={refreshOrganizations}
      />
    );
  }

  return null;
}

function createCommandPaletteFileSearch(state: AppShellState): CommandPaletteFileSearch {
  if (!state.repositoryDetail || !state.isRepositoryContext) {
    return null;
  }

  const openFileSearchEntry: NonNullable<CommandPaletteFileSearch>["onOpenEntry"] = (entry) => {
    state.openCodeBrowserInApp(
      state.effectiveRepository,
      entry.path,
      entry.type === "dir" ? "dir" : "file",
      state.contentsRef ?? state.repositoryDetail?.defaultBranch ?? null
    );
  };

  return {
    repository: state.repositoryDetail,
    selectedRef: state.contentsRef ?? state.repositoryDetail.defaultBranch ?? "HEAD",
    githubReady: state.githubReady,
    onOpenEntry: openFileSearchEntry
  };
}

function createCommandPaletteLocalFileSearch(state: AppShellState): CommandPaletteLocalFileSearch {
  if (state.route.kind !== "localRepository") {
    return null;
  }

  const route = state.route;
  const openLocalFileSearchEntry: NonNullable<CommandPaletteLocalFileSearch>["onOpenEntry"] = (entry) => {
    state.openLocalFileInApp({
      areaId: route.areaId,
      repositoryId: route.repositoryId,
      workspaceId: route.workspaceId ?? null,
      path: entry.path,
      entryType: entry.type
    });
  };

  return {
    route,
    onOpenEntry: openLocalFileSearchEntry
  };
}

function AppCommandPaletteOverlay({ state }: { state: AppShellState }): JSX.Element | null {
  if (!state.commandPalette.open) {
    return null;
  }

  const openCommandPaletteArea: CommandPaletteProps["onOpenArea"] = (area) => {
    void state.selectArea(area.id);
  };
  const openCommandPaletteWorkspace: CommandPaletteProps["onOpenWorkspace"] = (workspace) => {
    state.goToLocalRepository(workspace.areaId, workspace.repositoryId, "overview", workspace.id);
  };

  return (
    <CommandPalette
      items={state.commandPaletteItems}
      fileSearch={createCommandPaletteFileSearch(state)}
      localFileSearch={createCommandPaletteLocalFileSearch(state)}
      onOpenRepository={state.openRepositoryInApp}
      onOpenArea={openCommandPaletteArea}
      onOpenAreaRepository={state.openLocalRepositoryInApp}
      onOpenWorkspace={openCommandPaletteWorkspace}
      onClose={state.commandPalette.closePalette}
    />
  );
}

function AppShellDialogHost({ state }: { state: AppShellState }): JSX.Element {
  return (
    <ShellDialogs
      dialogs={state.dialogs}
      repositories={state.repositoryItems}
      viewerLogin={state.appState.data?.viewer?.login ?? state.accountProfileData?.login ?? null}
      githubReady={state.githubReady}
      appState={state.appState.data}
      authController={state.providerAuth.github}
      settingsOpen={state.settingsOpen}
      route={state.route}
      repository={state.repositoryDetail}
      repositoryTree={state.repositoryTreeItem}
      repositoryTreeLoading={state.repositoryTree.isLoading || state.repositoryTree.isFetching}
      repositoryTreeError={state.repositoryTree.error}
      repositoryTreeAvailabilityMessage={state.repositoryTreeAvailabilityMessage}
      branches={state.branchItems}
      tags={state.tagItems}
      refListLimit={state.repositoryRefListLimit}
      maxRefListLimit={state.maxRefListLimit}
      refsLoading={
        state.branches.isLoading || state.branches.isFetching || state.tags.isLoading || state.tags.isFetching
      }
      refsError={state.refsError}
      refsAvailabilityMessage={state.refsAvailabilityMessage || null}
      selectedRef={state.contentsRef ?? state.repositoryDetail?.defaultBranch ?? "HEAD"}
      selectedCodeRef={state.contentsRef ?? state.repositoryDetail?.defaultBranch ?? null}
      effectiveRepository={state.effectiveRepository}
      onOpenRepository={state.openRepositoryInApp}
      onAddLocalArea={state.addLocalArea}
      onCreateSshArea={state.createSshArea}
      onUpdateArea={state.updateArea}
      onDeleteArea={state.deleteArea}
      onCloseSettings={state.closeSettingsPanel}
      onOpenExternal={state.openExternal}
      onSaveSettings={state.saveSettings}
      onPreviewSettings={state.setSettingsPreview}
      onSelectRepositoryRef={state.selectRepositoryRefInApp}
      repositoryRefKindForName={state.repositoryRefKindForName}
      onExpandRefs={state.expandActiveRepositoryRefs}
      onOpenCodeBrowser={state.openCodeBrowserInApp}
    />
  );
}
