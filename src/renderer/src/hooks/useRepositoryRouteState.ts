import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RepositoryContextValue } from "../components/repository/RepositoryContext";
import { useActionsTabQueries } from "../components/repository/actions/ActionsTab.queries";
import { useCodeTabQueries } from "../components/repository/code/CodeTab.queries";
import { useContributorsTabQueries } from "../components/repository/contributors/ContributorsTab.queries";
import { useDiscussionsTabQueries } from "../components/repository/discussions/DiscussionsTab.queries";
import {
  defaultIssueStateFilter,
  normalizeIssueStateFilter,
  useIssuesTabQueries
} from "../components/repository/issues/IssuesTab.queries";
import { useProjectsTabQueries } from "../components/repository/projects/ProjectsTab.queries";
import { usePullRequestsTabQueries } from "../components/repository/pull-requests/PullRequestsTab.queries";
import { useReleasesTabQueries } from "../components/repository/releases/ReleasesTab.queries";
import { visibleRepositoryTabs } from "../components/repository/repositoryTabVisibility";
import { readAvailabilityMessage } from "../components/repository/repositoryUi";
import type { RepositoryTabPreferenceMap, RepositoryTabPreferencesByRepository } from "@shared/github";
import type { AppRoute, RepositoryTab } from "../stores/uiStore";
import { useCodeBrowserQueries } from "../components/code-browser/codeBrowserQueries";
import type { RepositoryQueryScope } from "../components/shell/appInvalidations";
import { useControlApi } from "./useControlApi";
import { useRepositoryDetail } from "./useRepositoryDetail";
import { useRepositoryRefs } from "./useRepositoryRefs";
import { useRepositoryRefreshActions } from "./useRepositoryRefreshActions";
import { useRepositorySurfaceLimits } from "./useRepositorySurfaceLimits";
import { useRepositoryWarmPrefetch } from "./useRepositoryWarmPrefetch";

const emptyRepositoryTabPreferences: RepositoryTabPreferenceMap = {};

interface UseRepositoryRouteStateInput {
  appReady: boolean;
  githubReady: boolean;
  route: AppRoute;
  selectedRepository: string | null;
  repositoryRefs: Record<string, string | null>;
  fileFinderOpen: boolean;
  repositoryTabPreferences: RepositoryTabPreferenceMap;
  repositoryTabPreferencesByRepository: RepositoryTabPreferencesByRepository;
}

export function useRepositoryRouteState({
  appReady,
  githubReady,
  route,
  selectedRepository,
  repositoryRefs,
  fileFinderOpen,
  repositoryTabPreferences,
  repositoryTabPreferencesByRepository
}: UseRepositoryRouteStateInput) {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const isRepositoryRoute = route.kind === "repository";
  const isCodeBrowserRoute = route.kind === "codeBrowser";
  const isLocalRepositoryRoute = route.kind === "localRepository";
  const isRepositoryContext = isRepositoryRoute || isCodeBrowserRoute;
  const activeRepositoryTab = isRepositoryRoute ? route.tab : "code";
  const issueState = isRepositoryRoute
    ? normalizeIssueStateFilter(route.issueState)
    : defaultIssueStateFilter;
  const activeLocalRepositoryTab = isLocalRepositoryRoute ? route.tab : "overview";
  const activeLocalRepositoryPath = isLocalRepositoryRoute ? (route.path ?? ".") : ".";
  const effectiveRepository = isRepositoryContext ? route.nameWithOwner : (selectedRepository ?? "");
  const repositoryScopedTabPreferences =
    repositoryTabPreferencesByRepository[effectiveRepository] ?? emptyRepositoryTabPreferences;
  const effectiveRepositoryTabPreferences = useMemo(
    () => ({
      ...repositoryTabPreferences,
      ...repositoryScopedTabPreferences
    }),
    [repositoryScopedTabPreferences, repositoryTabPreferences]
  );
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
  const limits = useRepositorySurfaceLimits({
    effectiveRepository,
    repositorySelectedRef,
    codeBrowserRef,
    codeBrowserPath
  });

  const repository = useRepositoryDetail({
    owner,
    repo,
    enabled: appReady && isRepositoryContext && hasRepositoryParts,
    githubReady
  });
  const repositoryDetail = repository.data?.detail ?? null;
  const repositoryAvailabilityMessage = readAvailabilityMessage(
    "Repository detail",
    repository.data?.availability ?? null
  );
  const repositoryTabVisibility = useMemo(
    () =>
      visibleRepositoryTabs({
        repository: repositoryDetail,
        activeRoute: isRepositoryRoute ? route : null,
        preferences: effectiveRepositoryTabPreferences
      }),
    [effectiveRepositoryTabPreferences, isRepositoryRoute, repositoryDetail, route]
  );
  const repositoryTabReady = appReady && isRepositoryRoute && hasRepositoryParts;
  const activeTabQueryEnabled = (tab: RepositoryTab): boolean =>
    repositoryTabReady && activeRepositoryTab === tab && repositoryTabVisibility.queryGates[tab];
  const agentsTabQueryEnabled = activeTabQueryEnabled("agents");

  const repositoryRefQueries = useRepositoryRefs(
    owner,
    repo,
    {
      branches: appReady && hasRepositoryParts && isRepositoryContext,
      tags: appReady && hasRepositoryParts && isRepositoryContext
    },
    limits.repositoryRefListLimit,
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
    commitHistoryLimit: limits.repositoryCommitHistoryLimit,
    selectedRootMarkdownPath: null,
    enabled: activeTabQueryEnabled("code"),
    githubReady
  });

  useIssuesTabQueries({
    owner,
    repo,
    issueState,
    issueListLimit: limits.issueListLimit,
    issuesEnabled: activeTabQueryEnabled("issues") || agentsTabQueryEnabled,
    resourcesEnabled: false,
    githubReady
  });

  usePullRequestsTabQueries({
    owner,
    repo,
    pullRequestListLimit: limits.pullRequestListLimit,
    pullsEnabled: activeTabQueryEnabled("pulls") || agentsTabQueryEnabled,
    resourcesEnabled: activeTabQueryEnabled("pulls"),
    githubReady
  });

  const codeBrowserQueries = useCodeBrowserQueries({
    api,
    appReady,
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
    fileCommitHistoryLimit: limits.fileCommitHistoryLimit,
    fileFinderOpen,
    repositoryLoaded: Boolean(repositoryDetail)
  });

  const discussions = useDiscussionsTabQueries({
    owner,
    repo,
    limit: limits.discussionsLimit,
    enabled: activeTabQueryEnabled("discussions"),
    githubReady
  }).discussions;
  const actions = useActionsTabQueries({
    owner,
    repo,
    limit: limits.actionsLimit,
    enabled: activeTabQueryEnabled("actions") || agentsTabQueryEnabled,
    githubReady
  }).actions;

  useRepositoryWarmPrefetch({
    appReady,
    enabled: isRepositoryRoute && hasRepositoryParts,
    owner,
    repo,
    selectedRef: repositorySelectedRef,
    defaultBranch: repositoryDetail?.defaultBranch ?? null,
    commitHistoryLimit: limits.repositoryCommitHistoryLimit,
    issueState,
    issueListLimit: limits.issueListLimit,
    pullRequestListLimit: limits.pullRequestListLimit,
    actionsLimit: limits.actionsLimit,
    githubReady
  });

  const projects = useProjectsTabQueries({
    owner,
    repo,
    limit: limits.projectsLimit,
    enabled: activeTabQueryEnabled("projects"),
    githubReady
  }).projects;
  const branchProtectionBranch =
    repositorySelectedRef && branchItems.some((branch) => branch.name === repositorySelectedRef)
      ? repositorySelectedRef
      : (repositoryDetail?.defaultBranch ?? null);

  const releases = useReleasesTabQueries({
    owner,
    repo,
    limit: limits.releasesLimit,
    enabled: activeTabQueryEnabled("releases") && repository.isSuccess,
    githubReady
  }).releases;

  const contributors = useContributorsTabQueries({
    owner,
    repo,
    limit: limits.repositoryContributorLimit,
    enabled: activeTabQueryEnabled("contributors") && repository.isSuccess,
    githubReady
  }).contributors;
  const releaseItems = releases.data?.items ?? [];
  const releasesAvailability = releases.data?.availability ?? null;
  const contributorItems = contributors.data?.items ?? [];
  const contributorsAvailability = contributors.data?.availability ?? null;
  const actionItems = actions.data?.items ?? [];
  const refreshActions = useRepositoryRefreshActions({
    appReady,
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
    repositoryRefListLimit: limits.repositoryRefListLimit,
    repositoryContributorLimit: limits.repositoryContributorLimit,
    repositoryCommitHistoryLimit: limits.repositoryCommitHistoryLimit,
    fileCommitHistoryLimit: limits.fileCommitHistoryLimit,
    issueState,
    issueListLimit: limits.issueListLimit,
    pullRequestListLimit: limits.pullRequestListLimit,
    discussionsLimit: limits.discussionsLimit,
    projectsLimit: limits.projectsLimit,
    releasesLimit: limits.releasesLimit,
    actionsLimit: limits.actionsLimit,
    workflowDefinitionLimit: limits.workflowDefinitionLimit,
    dependabotAlertsLimit: limits.dependabotAlertsLimit,
    codeScanningAlertsLimit: limits.codeScanningAlertsLimit,
    secretScanningAlertsLimit: limits.secretScanningAlertsLimit,
    repositoryRulesetsLimit: limits.repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit: limits.repositorySecurityAdvisoriesLimit,
    repositoryAccessLimit: limits.repositoryAccessLimit,
    forksLimit: limits.forksLimit
  });

  return {
    isRepositoryRoute,
    isCodeBrowserRoute,
    isLocalRepositoryRoute,
    isRepositoryContext,
    activeRepositoryTab,
    activeLocalRepositoryTab,
    activeLocalRepositoryPath,
    effectiveRepository,
    effectiveRepositoryTabPreferences,
    repositoryScopedTabPreferences,
    owner,
    repo,
    hasRepositoryParts,
    activeRepositoryScope,
    repositoryContextValue,
    codeBrowserPath,
    codeBrowserEntryType,
    codeBrowserRef,
    repositorySelectedRef,
    contentsRef,
    limits,
    repository,
    repositoryDetail,
    repositoryTabVisibility,
    repositoryAvailabilityMessage,
    repositoryRefQueries,
    branches,
    tags,
    branchItems,
    tagItems,
    refsAvailabilityMessage,
    refsError,
    codeTabQueries,
    codeBrowserQueries,
    discussions,
    actions,
    projects,
    branchProtectionBranch,
    releases,
    contributors,
    releaseItems,
    releasesAvailability,
    contributorItems,
    contributorsAvailability,
    actionItems,
    refreshActions
  };
}
