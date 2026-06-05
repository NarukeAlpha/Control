import { useQueryClient } from "@tanstack/react-query";

import type { IssueStateFilter, PullRequestStateFilter, RepositoryDetail } from "@shared/github";
import { refreshCodeBrowserData } from "../components/code-browser/codeBrowserQueries";
import { refreshActionsTabData } from "../components/repository/actions/ActionsTab.queries";
import { refreshAgentsTabData } from "../components/repository/agents/AgentsTab.queries";
import { refreshCodeTabData } from "../components/repository/code/CodeTab.queries";
import { refreshContributorsTabData } from "../components/repository/contributors/ContributorsTab.queries";
import { refreshDiscussionsTabData } from "../components/repository/discussions/DiscussionsTab.queries";
import { refreshIssuesTabData } from "../components/repository/issues/IssuesTab.queries";
import { refreshProjectsTabData } from "../components/repository/projects/ProjectsTab.queries";
import { refreshPullRequestsTabData } from "../components/repository/pull-requests/PullRequestsTab.queries";
import { refreshReleasesTabData } from "../components/repository/releases/ReleasesTab.queries";
import { refreshSecurityQualityTabData } from "../components/repository/security/SecurityQualityTab.queries";
import { refreshRepositorySettingsTabData } from "../components/repository/settings/RepositorySettingsTab.queries";
import { refreshWikiTabData } from "../components/repository/wiki/WikiTab.queries";
import { refreshRepositoryDetailData } from "./useRepositoryDetail";
import { useControlApi } from "./useControlApi";
import type { AppRoute, RepositoryTab } from "../stores/uiStore";

const defaultWikiPageLimit = 50;

interface UseRepositoryRefreshActionsInput {
  appReady: boolean;
  githubReady: boolean;
  owner: string;
  repo: string;
  hasRepositoryParts: boolean;
  activeRepositoryTab: RepositoryTab;
  route: AppRoute;
  repositoryDetail: RepositoryDetail | null;
  contentsRef: string | null;
  codeBrowserRef: string | null;
  codeBrowserPath: string;
  codeBrowserEntryType: "file" | "dir";
  branchProtectionBranch: string | null;
  repositoryRefListLimit: number;
  repositoryContributorLimit: number;
  repositoryCommitHistoryLimit: number;
  fileCommitHistoryLimit: number;
  issueState: IssueStateFilter;
  issueListLimit: number;
  pullState: PullRequestStateFilter;
  pullRequestListLimit: number;
  discussionsLimit: number;
  projectsLimit: number;
  releasesLimit: number;
  actionsLimit: number;
  workflowDefinitionLimit: number;
  dependabotAlertsLimit: number;
  codeScanningAlertsLimit: number;
  secretScanningAlertsLimit: number;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  repositoryAccessLimit: number;
  forksLimit: number;
}

interface UseRepositoryRefreshActionsResult {
  refreshRepositoryDetailNow: () => Promise<void>;
  refreshCodeBrowserNow: () => Promise<void>;
  refreshRepositorySurface: () => Promise<void>;
}

export function useRepositoryRefreshActions({
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
  repositoryRefListLimit,
  repositoryContributorLimit,
  repositoryCommitHistoryLimit,
  fileCommitHistoryLimit,
  issueState,
  issueListLimit,
  pullState,
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
}: UseRepositoryRefreshActionsInput): UseRepositoryRefreshActionsResult {
  const api = useControlApi();
  const queryClient = useQueryClient();

  async function refreshRepositoryDetailNow(): Promise<void> {
    if (!hasRepositoryParts) {
      return;
    }

    try {
      await refreshRepositoryDetailData(queryClient, { api, owner, repo, githubReady });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshContributorsNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshContributorsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: repositoryContributorLimit,
      githubReady
    });
  }

  async function refreshCodeSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshCodeTabData(queryClient, {
      api,
      owner,
      repo,
      selectedRef: contentsRef,
      defaultBranch: repositoryDetail?.defaultBranch ?? null,
      commitHistoryLimit: repositoryCommitHistoryLimit,
      refListLimit: repositoryRefListLimit,
      githubReady
    });
  }

  async function refreshCodeBrowserNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshCodeBrowserData(queryClient, {
      api,
      owner,
      repo,
      selectedRef: codeBrowserRef,
      defaultBranch: repositoryDetail?.defaultBranch ?? null,
      path: codeBrowserPath,
      entryType: codeBrowserEntryType,
      refListLimit: repositoryRefListLimit,
      fileCommitHistoryLimit,
      githubReady
    });
  }

  async function refreshIssueSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshIssuesTabData(queryClient, {
      api,
      owner,
      repo,
      issueState,
      issueListLimit,
      focusedIssueNumber: route.kind === "repository" ? (route.issueNumber ?? null) : null,
      githubReady
    });
  }

  async function refreshPullSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshPullRequestsTabData(queryClient, {
      api,
      owner,
      repo,
      pullState,
      pullRequestListLimit,
      refListLimit: repositoryRefListLimit,
      focusedPullNumber: route.kind === "repository" ? (route.pullNumber ?? null) : null,
      githubReady
    });
  }

  async function refreshDiscussionsSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshDiscussionsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: discussionsLimit,
      githubReady
    });
  }

  async function refreshProjectsSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshProjectsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: projectsLimit,
      githubReady
    });
  }

  async function refreshWikiSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshWikiTabData(queryClient, {
      api,
      owner,
      repo,
      focusedPagePath: route.kind === "repository" ? (route.wikiPagePath ?? null) : null,
      pageLimit: defaultWikiPageLimit,
      githubReady
    });
  }

  async function refreshReleasesSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshReleasesTabData(queryClient, {
      api,
      owner,
      repo,
      limit: releasesLimit,
      refListLimit: repositoryRefListLimit,
      githubReady
    });
  }

  async function refreshActionsSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshActionsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: actionsLimit,
      selectedRef: contentsRef,
      defaultBranch: repositoryDetail?.defaultBranch ?? null,
      refListLimit: repositoryRefListLimit,
      workflowDefinitionLimit,
      focusedWorkflowRunId: route.kind === "repository" ? (route.workflowRunId ?? null) : null,
      githubReady
    });
  }

  async function refreshAgentsSurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshAgentsTabData(queryClient, {
      api,
      owner,
      repo,
      issueListLimit,
      pullRequestListLimit,
      actionsLimit,
      githubReady
    });
  }

  async function refreshSecurityQualitySurfaceNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshSecurityQualityTabData(queryClient, {
      api,
      owner,
      repo,
      branchProtectionBranch,
      defaultBranch: repositoryDetail?.defaultBranch ?? null,
      dependabotAlertsLimit,
      codeScanningAlertsLimit,
      secretScanningAlertsLimit,
      repositoryRulesetsLimit,
      repositorySecurityAdvisoriesLimit,
      githubReady
    });
  }

  async function refreshRepositorySettingsNow(): Promise<void> {
    if (!appReady || !hasRepositoryParts) {
      return;
    }

    await refreshRepositorySettingsTabData(queryClient, {
      api,
      owner,
      repo,
      branchProtectionBranch,
      refListLimit: repositoryRefListLimit,
      repositoryAccessLimit,
      forksLimit,
      repositoryRulesetsLimit,
      githubReady
    });
  }

  async function refreshRepositorySurface(): Promise<void> {
    await refreshRepositoryDetailNow();
    if (activeRepositoryTab === "code") {
      await refreshCodeSurfaceNow();
      await queryClient.invalidateQueries({ queryKey: ["tree", owner, repo] });
      return;
    }
    if (activeRepositoryTab === "issues") {
      await refreshIssueSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "pulls") {
      await refreshPullSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "discussions") {
      await refreshDiscussionsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "projects") {
      await refreshProjectsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "releases") {
      await refreshReleasesSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "actions") {
      await refreshActionsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "agents") {
      await refreshAgentsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "contributors") {
      await refreshContributorsNow();
      return;
    }
    if (activeRepositoryTab === "wiki") {
      await refreshWikiSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "securityQuality") {
      await refreshSecurityQualitySurfaceNow();
      return;
    }
    if (activeRepositoryTab === "settings") {
      await refreshRepositorySettingsNow();
      return;
    }
  }

  return {
    refreshRepositoryDetailNow,
    refreshCodeBrowserNow,
    refreshRepositorySurface
  };
}
