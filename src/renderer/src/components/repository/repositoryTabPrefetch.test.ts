import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  GitHubListResult,
  GitHubReadAvailability,
  RepoContentsResult,
  RepoFileContentResult,
  RepoReadmeResult,
  RepositoryCommitListResult,
  RepositoryWikiResult
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { mockCommits, mockContents, mockControlApi } from "../../data/mock";
import {
  actionsTabQueryKey,
  prefetchActionsTabData,
  refreshActionsTabData,
  workflowDefinitionsQueryKey,
  workflowRunDetailQueryKey
} from "./actions/ActionsTab";
import { refreshAgentsTabData } from "./agents/AgentsTab";
import {
  codeTabCommitsQueryKey,
  codeTabContentsQueryKey,
  codeTabReadmeQueryKey,
  codeTabRootMarkdownContentQueryKey,
  prefetchCodeTabData,
  refreshCodeTabData
} from "./code/CodeTab";
import { contributorsTabQueryKey, refreshContributorsTabData } from "./contributors/ContributorsTab";
import {
  discussionsTabQueryKey,
  prefetchDiscussionsTabData,
  refreshDiscussionsTabData
} from "./discussions/DiscussionsTab";
import { issueDetailQueryKey } from "./issues/useIssueDetail";
import { issuesTabQueryKey, prefetchIssuesTabData, refreshIssuesTabData } from "./issues/IssuesTab";
import { projectsTabQueryKey, prefetchProjectsTabData, refreshProjectsTabData } from "./projects/ProjectsTab";
import {
  prefetchPullRequestsTabData,
  pullRequestDetailQueryKey,
  pullRequestsTabQueryKey,
  refreshPullRequestsTabData
} from "./pull-requests/PullRequestsTab";
import { prefetchReleasesTabData, refreshReleasesTabData, releasesTabQueryKey } from "./releases/ReleasesTab";
import { repositoryBranchProtectionQueryKey, repositoryRulesetsQueryKey } from "./repositoryAdminQueryKeys";
import {
  codeScanningAlertsQueryKey,
  dependabotAlertsQueryKey,
  refreshSecurityQualityTabData,
  repositoryCommunityProfileQueryKey,
  repositorySecurityAdvisoriesQueryKey,
  repositorySecurityPolicyQueryKey,
  secretScanningAlertsQueryKey
} from "./security/SecurityQualityTab";
import {
  refreshRepositorySettingsTabData,
  repositoryAccessQueryKey,
  repositoryForksQueryKey
} from "./settings/RepositorySettingsTab";
import { prefetchWikiTabData, refreshWikiTabData, wikiTabQueryKey } from "./wiki/WikiTab";
import {
  repositoryAssignableUsersQueryKey,
  repositoryLabelsQueryKey,
  repositoryMilestonesQueryKey
} from "../../hooks/useRepositoryIssueResources";
import { repositoryBranchesQueryKey, repositoryTagsQueryKey } from "../../hooks/useRepositoryRefs";

const owner = "NarukeAlpha";
const repo = "control";
const available = { status: "available", message: null } satisfies GitHubReadAvailability;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function listResult<T>(): GitHubListResult<T> {
  return {
    items: [],
    availability: available
  };
}

function makeApi(githubOverrides: Partial<ControlApi["github"]>): ControlApi {
  return {
    ...mockControlApi,
    github: {
      ...mockControlApi.github,
      ...githubOverrides
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("repository tab prefetch helpers", () => {
  it("prefetches code tab data without mounting CodeTab", async () => {
    const queryClient = makeQueryClient();
    const rootMarkdown = {
      ...mockContents.find((item) => item.name === "README.md")!,
      name: "CONTRIBUTING.md",
      path: "CONTRIBUTING.md",
      sha: "mock-contributing"
    };
    const contentsResult: RepoContentsResult = {
      items: [...mockContents, rootMarkdown],
      availability: available
    };
    const readmeResult: RepoReadmeResult = {
      markdown: "# Control",
      availability: available
    };
    const rootMarkdownResult: RepoFileContentResult = {
      item: {
        path: rootMarkdown.path,
        name: rootMarkdown.name,
        ref: null,
        kind: "text",
        content: "# Contributing",
        size: 14,
        encoding: "utf-8",
        htmlUrl: "https://github.com/NarukeAlpha/control/blob/main/CONTRIBUTING.md",
        downloadUrl: null,
        message: null,
        lastCommitSha: rootMarkdown.lastCommitSha,
        lastCommitMessage: rootMarkdown.lastCommitMessage,
        lastCommitAuthorLogin: rootMarkdown.lastCommitAuthorLogin,
        lastCommitAuthorName: rootMarkdown.lastCommitAuthorName,
        lastCommitAuthorAvatarUrl: rootMarkdown.lastCommitAuthorAvatarUrl,
        lastAuthoredDate: rootMarkdown.lastAuthoredDate,
        lastCommittedDate: rootMarkdown.lastCommittedDate,
        lastCommitDate: rootMarkdown.lastCommitDate,
        lastCommitHtmlUrl: rootMarkdown.lastCommitHtmlUrl,
        lastCommitAdditions: rootMarkdown.lastCommitAdditions,
        lastCommitDeletions: rootMarkdown.lastCommitDeletions,
        lastCommitChanges: rootMarkdown.lastCommitChanges,
        lastCommitAvailability: rootMarkdown.lastCommitAvailability
      },
      availability: available
    };
    const commitsResult: RepositoryCommitListResult = {
      items: mockCommits.slice(0, 2),
      availability: available
    };
    const listContentsWithStatus = vi.fn<ControlApi["github"]["listContentsWithStatus"]>(
      async () => contentsResult
    );
    const getReadme = vi.fn<ControlApi["github"]["getReadme"]>(async () => readmeResult);
    const getFileContentWithStatus = vi.fn<ControlApi["github"]["getFileContentWithStatus"]>(
      async () => rootMarkdownResult
    );
    const listCommitsWithStatus = vi.fn<ControlApi["github"]["listCommitsWithStatus"]>(
      async () => commitsResult
    );
    const api = makeApi({
      listContentsWithStatus,
      getReadme,
      getFileContentWithStatus,
      listCommitsWithStatus
    });

    await prefetchCodeTabData(queryClient, {
      api,
      owner,
      repo,
      selectedRef: null,
      defaultBranch: "main",
      commitHistoryLimit: 8,
      selectedRootMarkdownPath: null,
      githubReady: false
    });

    expect(listContentsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      ref: undefined,
      cacheOnly: true
    });
    expect(getReadme).toHaveBeenCalledWith({
      owner,
      repo,
      ref: undefined,
      cacheOnly: true
    });
    expect(getFileContentWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      path: "CONTRIBUTING.md",
      ref: undefined,
      cacheOnly: true
    });
    expect(listCommitsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      ref: "main",
      limit: 8,
      cacheOnly: true
    });
    expect(queryClient.getQueryData(codeTabContentsQueryKey(owner, repo, null))).toBe(contentsResult);
    expect(queryClient.getQueryData(codeTabReadmeQueryKey(owner, repo, null))).toBe(readmeResult);
    expect(
      queryClient.getQueryData(codeTabRootMarkdownContentQueryKey(owner, repo, null, "CONTRIBUTING.md"))
    ).toBe(rootMarkdownResult);
    expect(queryClient.getQueryData(codeTabCommitsQueryKey(owner, repo, null, 8))).toBe(commitsResult);
  });

  it("prefetches wiki data without mounting WikiTab", async () => {
    const queryClient = makeQueryClient();
    const result: RepositoryWikiResult = {
      pages: [],
      selectedPage: null,
      availability: available
    };
    const getRepositoryWiki = vi.fn<ControlApi["github"]["getRepositoryWiki"]>(async () => result);
    const api = makeApi({ getRepositoryWiki });

    await prefetchWikiTabData(queryClient, {
      api,
      owner,
      repo,
      focusedPagePath: "Home",
      pageLimit: 12,
      githubReady: false
    });

    expect(getRepositoryWiki).toHaveBeenCalledWith({
      owner,
      repo,
      pagePath: "Home",
      limit: 12,
      cacheOnly: true
    });
    expect(queryClient.getQueryData(wikiTabQueryKey(owner, repo, "Home", 12))).toBe(result);
  });

  it("prefetches discussions data without mounting DiscussionsTab", async () => {
    const queryClient = makeQueryClient();
    const result = listResult<never>();
    const listDiscussionsWithStatus = vi.fn<ControlApi["github"]["listDiscussionsWithStatus"]>(
      async () => result
    );
    const api = makeApi({ listDiscussionsWithStatus });

    await prefetchDiscussionsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: 24,
      githubReady: true
    });

    expect(listDiscussionsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 24,
      cacheOnly: false
    });
    expect(queryClient.getQueryData(discussionsTabQueryKey(owner, repo, 24))).toBe(result);
  });

  it("prefetches projects data without mounting ProjectsTab", async () => {
    const queryClient = makeQueryClient();
    const result = listResult<never>();
    const listProjectsWithStatus = vi.fn<ControlApi["github"]["listProjectsWithStatus"]>(async () => result);
    const api = makeApi({ listProjectsWithStatus });

    await prefetchProjectsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: 18,
      githubReady: false
    });

    expect(listProjectsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 18,
      cacheOnly: true
    });
    expect(queryClient.getQueryData(projectsTabQueryKey(owner, repo, 18))).toBe(result);
  });

  it("prefetches releases data without mounting ReleasesTab", async () => {
    const queryClient = makeQueryClient();
    const result = listResult<never>();
    const listReleasesWithStatus = vi.fn<ControlApi["github"]["listReleasesWithStatus"]>(async () => result);
    const api = makeApi({ listReleasesWithStatus });

    await prefetchReleasesTabData(queryClient, {
      api,
      owner,
      repo,
      limit: 36,
      githubReady: true
    });

    expect(listReleasesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 36,
      cacheOnly: false
    });
    expect(queryClient.getQueryData(releasesTabQueryKey(owner, repo, 36))).toBe(result);
  });

  it("prefetches actions data without mounting ActionsTab", async () => {
    const queryClient = makeQueryClient();
    const result = listResult<never>();
    const listActionsWithStatus = vi.fn<ControlApi["github"]["listActionsWithStatus"]>(async () => result);
    const api = makeApi({ listActionsWithStatus });

    await prefetchActionsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: 48,
      githubReady: false
    });

    expect(listActionsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 48,
      cacheOnly: true
    });
    expect(queryClient.getQueryData(actionsTabQueryKey(owner, repo, 48))).toBe(result);
  });

  it("refreshes code tab data and refs with forced online reads", async () => {
    const queryClient = makeQueryClient();
    const listBranchesWithStatus = vi.fn<ControlApi["github"]["listBranchesWithStatus"]>(
      mockControlApi.github.listBranchesWithStatus
    );
    const listTagsWithStatus = vi.fn<ControlApi["github"]["listTagsWithStatus"]>(
      mockControlApi.github.listTagsWithStatus
    );
    const listContentsWithStatus = vi.fn<ControlApi["github"]["listContentsWithStatus"]>(
      mockControlApi.github.listContentsWithStatus
    );
    const getReadme = vi.fn<ControlApi["github"]["getReadme"]>(mockControlApi.github.getReadme);
    const listCommitsWithStatus = vi.fn<ControlApi["github"]["listCommitsWithStatus"]>(
      mockControlApi.github.listCommitsWithStatus
    );
    const api = makeApi({
      listBranchesWithStatus,
      listTagsWithStatus,
      listContentsWithStatus,
      getReadme,
      listCommitsWithStatus
    });

    await refreshCodeTabData(queryClient, {
      api,
      owner,
      repo,
      selectedRef: "feature/refactor",
      defaultBranch: "main",
      commitHistoryLimit: 8,
      refListLimit: 80,
      githubReady: true
    });

    expect(listBranchesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listTagsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listContentsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      ref: "feature/refactor",
      cacheOnly: false,
      forceRefresh: true
    });
    expect(getReadme).toHaveBeenCalledWith({
      owner,
      repo,
      ref: "feature/refactor",
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listCommitsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      ref: "feature/refactor",
      limit: 8,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(repositoryBranchesQueryKey(owner, repo, 80))).toBeDefined();
    expect(queryClient.getQueryData(repositoryTagsQueryKey(owner, repo, 80))).toBeDefined();
    expect(queryClient.getQueryData(codeTabContentsQueryKey(owner, repo, "feature/refactor"))).toBeDefined();
    expect(queryClient.getQueryData(codeTabReadmeQueryKey(owner, repo, "feature/refactor"))).toBeDefined();
    expect(
      queryClient.getQueryData(codeTabCommitsQueryKey(owner, repo, "feature/refactor", 8))
    ).toBeDefined();
  });

  it("refreshes actions, refs, workflows, and focused run detail while offline", async () => {
    const queryClient = makeQueryClient();
    const listActionsWithStatus = vi.fn<ControlApi["github"]["listActionsWithStatus"]>(
      mockControlApi.github.listActionsWithStatus
    );
    const listBranchesWithStatus = vi.fn<ControlApi["github"]["listBranchesWithStatus"]>(
      mockControlApi.github.listBranchesWithStatus
    );
    const listTagsWithStatus = vi.fn<ControlApi["github"]["listTagsWithStatus"]>(
      mockControlApi.github.listTagsWithStatus
    );
    const listWorkflowsWithStatus = vi.fn<ControlApi["github"]["listWorkflowsWithStatus"]>(
      mockControlApi.github.listWorkflowsWithStatus
    );
    const getWorkflowRunDetailWithStatus = vi.fn<ControlApi["github"]["getWorkflowRunDetailWithStatus"]>(
      mockControlApi.github.getWorkflowRunDetailWithStatus
    );
    const api = makeApi({
      listActionsWithStatus,
      listBranchesWithStatus,
      listTagsWithStatus,
      listWorkflowsWithStatus,
      getWorkflowRunDetailWithStatus
    });

    await refreshActionsTabData(queryClient, {
      api,
      owner,
      repo,
      limit: 48,
      selectedRef: null,
      defaultBranch: "main",
      refListLimit: 80,
      workflowDefinitionLimit: 24,
      focusedWorkflowRunId: 101,
      githubReady: false
    });

    expect(listActionsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 48,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listBranchesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listTagsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listWorkflowsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      ref: "main",
      limit: 24,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(getWorkflowRunDetailWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      runId: 101,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(queryClient.getQueryData(actionsTabQueryKey(owner, repo, 48))).toBeDefined();
    expect(queryClient.getQueryData(repositoryBranchesQueryKey(owner, repo, 80))).toBeDefined();
    expect(queryClient.getQueryData(repositoryTagsQueryKey(owner, repo, 80))).toBeDefined();
    expect(queryClient.getQueryData(workflowDefinitionsQueryKey(owner, repo, "main", 24))).toBeDefined();
    expect(queryClient.getQueryData(workflowRunDetailQueryKey(owner, repo, 101))).toBeDefined();
  });

  it("refreshes single-list tabs with forced online reads", async () => {
    const queryClient = makeQueryClient();
    const listContributorsWithStatus = vi.fn<ControlApi["github"]["listContributorsWithStatus"]>(
      mockControlApi.github.listContributorsWithStatus
    );
    const listDiscussionsWithStatus = vi.fn<ControlApi["github"]["listDiscussionsWithStatus"]>(
      mockControlApi.github.listDiscussionsWithStatus
    );
    const listProjectsWithStatus = vi.fn<ControlApi["github"]["listProjectsWithStatus"]>(
      mockControlApi.github.listProjectsWithStatus
    );
    const api = makeApi({
      listContributorsWithStatus,
      listDiscussionsWithStatus,
      listProjectsWithStatus
    });

    await Promise.all([
      refreshContributorsTabData(queryClient, { api, owner, repo, limit: 24, githubReady: true }),
      refreshDiscussionsTabData(queryClient, { api, owner, repo, limit: 30, githubReady: true }),
      refreshProjectsTabData(queryClient, { api, owner, repo, limit: 18, githubReady: true })
    ]);

    expect(listContributorsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 24,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listDiscussionsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 30,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listProjectsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 18,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(contributorsTabQueryKey(owner, repo, 24))).toBeDefined();
    expect(queryClient.getQueryData(discussionsTabQueryKey(owner, repo, 30))).toBeDefined();
    expect(queryClient.getQueryData(projectsTabQueryKey(owner, repo, 18))).toBeDefined();
  });

  it("refreshes releases and refs while offline", async () => {
    const queryClient = makeQueryClient();
    const listReleasesWithStatus = vi.fn<ControlApi["github"]["listReleasesWithStatus"]>(
      mockControlApi.github.listReleasesWithStatus
    );
    const listBranchesWithStatus = vi.fn<ControlApi["github"]["listBranchesWithStatus"]>(
      mockControlApi.github.listBranchesWithStatus
    );
    const listTagsWithStatus = vi.fn<ControlApi["github"]["listTagsWithStatus"]>(
      mockControlApi.github.listTagsWithStatus
    );
    const api = makeApi({ listReleasesWithStatus, listBranchesWithStatus, listTagsWithStatus });

    await refreshReleasesTabData(queryClient, {
      api,
      owner,
      repo,
      limit: 36,
      refListLimit: 80,
      githubReady: false
    });

    expect(listReleasesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 36,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listBranchesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listTagsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(queryClient.getQueryData(releasesTabQueryKey(owner, repo, 36))).toBeDefined();
    expect(queryClient.getQueryData(repositoryBranchesQueryKey(owner, repo, 80))).toBeDefined();
    expect(queryClient.getQueryData(repositoryTagsQueryKey(owner, repo, 80))).toBeDefined();
  });

  it("refreshes existing wiki query variants before the fallback page", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(wikiTabQueryKey(owner, repo, "Existing", 99), {
      pages: [],
      selectedPage: null,
      availability: available
    });
    const getRepositoryWiki = vi.fn<ControlApi["github"]["getRepositoryWiki"]>(
      mockControlApi.github.getRepositoryWiki
    );
    const api = makeApi({ getRepositoryWiki });

    await refreshWikiTabData(queryClient, {
      api,
      owner,
      repo,
      focusedPagePath: "Home",
      pageLimit: 12,
      githubReady: true
    });

    expect(getRepositoryWiki).toHaveBeenCalledWith({
      owner,
      repo,
      pagePath: "Existing",
      limit: 99,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(wikiTabQueryKey(owner, repo, "Existing", 99))).toBeDefined();
  });

  it("refreshes the agents tab source lists", async () => {
    const queryClient = makeQueryClient();
    const listIssuesWithStatus = vi.fn<ControlApi["github"]["listIssuesWithStatus"]>(
      mockControlApi.github.listIssuesWithStatus
    );
    const listPullRequestsWithStatus = vi.fn<ControlApi["github"]["listPullRequestsWithStatus"]>(
      mockControlApi.github.listPullRequestsWithStatus
    );
    const listActionsWithStatus = vi.fn<ControlApi["github"]["listActionsWithStatus"]>(
      mockControlApi.github.listActionsWithStatus
    );
    const api = makeApi({ listIssuesWithStatus, listPullRequestsWithStatus, listActionsWithStatus });

    await refreshAgentsTabData(queryClient, {
      api,
      owner,
      repo,
      issueListLimit: 30,
      pullRequestListLimit: 40,
      actionsLimit: 48,
      githubReady: true
    });

    expect(listIssuesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 30,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listPullRequestsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 40,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listActionsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 48,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(issuesTabQueryKey(owner, repo, 30))).toBeDefined();
    expect(queryClient.getQueryData(pullRequestsTabQueryKey(owner, repo, 40))).toBeDefined();
    expect(queryClient.getQueryData(actionsTabQueryKey(owner, repo, 48))).toBeDefined();
  });

  it("refreshes security quality data with optional branch policy queries", async () => {
    const queryClient = makeQueryClient();
    const listDependabotAlerts = vi.fn<ControlApi["github"]["listDependabotAlerts"]>(
      mockControlApi.github.listDependabotAlerts
    );
    const listCodeScanningAlerts = vi.fn<ControlApi["github"]["listCodeScanningAlerts"]>(
      mockControlApi.github.listCodeScanningAlerts
    );
    const listSecretScanningAlerts = vi.fn<ControlApi["github"]["listSecretScanningAlerts"]>(
      mockControlApi.github.listSecretScanningAlerts
    );
    const listRepositoryRulesets = vi.fn<ControlApi["github"]["listRepositoryRulesets"]>(
      mockControlApi.github.listRepositoryRulesets
    );
    const listRepositorySecurityAdvisories = vi.fn<ControlApi["github"]["listRepositorySecurityAdvisories"]>(
      mockControlApi.github.listRepositorySecurityAdvisories
    );
    const getRepositoryCommunityProfile = vi.fn<ControlApi["github"]["getRepositoryCommunityProfile"]>(
      mockControlApi.github.getRepositoryCommunityProfile
    );
    const getBranchProtection = vi.fn<ControlApi["github"]["getBranchProtection"]>(
      mockControlApi.github.getBranchProtection
    );
    const getRepositorySecurityPolicy = vi.fn<ControlApi["github"]["getRepositorySecurityPolicy"]>(
      mockControlApi.github.getRepositorySecurityPolicy
    );
    const api = makeApi({
      listDependabotAlerts,
      listCodeScanningAlerts,
      listSecretScanningAlerts,
      listRepositoryRulesets,
      listRepositorySecurityAdvisories,
      getRepositoryCommunityProfile,
      getBranchProtection,
      getRepositorySecurityPolicy
    });

    await refreshSecurityQualityTabData(queryClient, {
      api,
      owner,
      repo,
      branchProtectionBranch: "main",
      defaultBranch: "main",
      dependabotAlertsLimit: 10,
      codeScanningAlertsLimit: 11,
      secretScanningAlertsLimit: 12,
      repositoryRulesetsLimit: 13,
      repositorySecurityAdvisoriesLimit: 14,
      githubReady: true
    });

    expect(listDependabotAlerts).toHaveBeenCalledWith({
      owner,
      repo,
      state: "open",
      limit: 10,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listCodeScanningAlerts).toHaveBeenCalledWith({
      owner,
      repo,
      state: "open",
      limit: 11,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listSecretScanningAlerts).toHaveBeenCalledWith({
      owner,
      repo,
      state: "open",
      limit: 12,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listRepositoryRulesets).toHaveBeenCalledWith({
      owner,
      repo,
      includesParents: true,
      limit: 13,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listRepositorySecurityAdvisories).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 14,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(getRepositoryCommunityProfile).toHaveBeenCalledWith({
      owner,
      repo,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(getBranchProtection).toHaveBeenCalledWith({
      owner,
      repo,
      branch: "main",
      cacheOnly: false,
      forceRefresh: true
    });
    expect(getRepositorySecurityPolicy).toHaveBeenCalledWith({
      owner,
      repo,
      ref: "main",
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(dependabotAlertsQueryKey(owner, repo, 10))).toBeDefined();
    expect(queryClient.getQueryData(codeScanningAlertsQueryKey(owner, repo, 11))).toBeDefined();
    expect(queryClient.getQueryData(secretScanningAlertsQueryKey(owner, repo, 12))).toBeDefined();
    expect(queryClient.getQueryData(repositoryRulesetsQueryKey(owner, repo, 13))).toBeDefined();
    expect(queryClient.getQueryData(repositorySecurityAdvisoriesQueryKey(owner, repo, 14))).toBeDefined();
    expect(queryClient.getQueryData(repositoryCommunityProfileQueryKey(owner, repo))).toBeDefined();
    expect(queryClient.getQueryData(repositoryBranchProtectionQueryKey(owner, repo, "main"))).toBeDefined();
    expect(queryClient.getQueryData(repositorySecurityPolicyQueryKey(owner, repo, "main"))).toBeDefined();
  });

  it("refreshes repository settings data and branch refs while offline", async () => {
    const queryClient = makeQueryClient();
    const listBranchesWithStatus = vi.fn<ControlApi["github"]["listBranchesWithStatus"]>(
      mockControlApi.github.listBranchesWithStatus
    );
    const listTagsWithStatus = vi.fn<ControlApi["github"]["listTagsWithStatus"]>(
      mockControlApi.github.listTagsWithStatus
    );
    const listRepositoryRulesets = vi.fn<ControlApi["github"]["listRepositoryRulesets"]>(
      mockControlApi.github.listRepositoryRulesets
    );
    const getRepositoryAccess = vi.fn<ControlApi["github"]["getRepositoryAccess"]>(
      mockControlApi.github.getRepositoryAccess
    );
    const listRepositoryForks = vi.fn<ControlApi["github"]["listRepositoryForks"]>(
      mockControlApi.github.listRepositoryForks
    );
    const getBranchProtection = vi.fn<ControlApi["github"]["getBranchProtection"]>(
      mockControlApi.github.getBranchProtection
    );
    const api = makeApi({
      listBranchesWithStatus,
      listTagsWithStatus,
      listRepositoryRulesets,
      getRepositoryAccess,
      listRepositoryForks,
      getBranchProtection
    });

    await refreshRepositorySettingsTabData(queryClient, {
      api,
      owner,
      repo,
      branchProtectionBranch: "main",
      refListLimit: 80,
      repositoryAccessLimit: 30,
      forksLimit: 12,
      repositoryRulesetsLimit: 13,
      githubReady: false
    });

    expect(listBranchesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listTagsWithStatus).not.toHaveBeenCalled();
    expect(listRepositoryRulesets).toHaveBeenCalledWith({
      owner,
      repo,
      includesParents: true,
      limit: 13,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(getRepositoryAccess).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 30,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listRepositoryForks).toHaveBeenCalledWith({
      owner,
      repo,
      sort: "stargazers",
      limit: 12,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(getBranchProtection).toHaveBeenCalledWith({
      owner,
      repo,
      branch: "main",
      cacheOnly: true,
      forceRefresh: false
    });
    expect(queryClient.getQueryData(repositoryBranchesQueryKey(owner, repo, 80))).toBeDefined();
    expect(queryClient.getQueryData(repositoryRulesetsQueryKey(owner, repo, 13))).toBeDefined();
    expect(queryClient.getQueryData(repositoryAccessQueryKey(owner, repo, 30))).toBeDefined();
    expect(queryClient.getQueryData(repositoryForksQueryKey(owner, repo, 12))).toBeDefined();
    expect(queryClient.getQueryData(repositoryBranchProtectionQueryKey(owner, repo, "main"))).toBeDefined();
  });

  it("prefetches issues and issue resources without mounting IssuesTab", async () => {
    const queryClient = makeQueryClient();
    const issuesResult = listResult<never>();
    const labelsResult = listResult<never>();
    const assignableUsersResult = listResult<never>();
    const milestonesResult = listResult<never>();
    const listIssuesWithStatus = vi.fn<ControlApi["github"]["listIssuesWithStatus"]>(
      async () => issuesResult
    );
    const listLabelsWithStatus = vi.fn<ControlApi["github"]["listLabelsWithStatus"]>(
      async () => labelsResult
    );
    const listAssignableUsersWithStatus = vi.fn<ControlApi["github"]["listAssignableUsersWithStatus"]>(
      async () => assignableUsersResult
    );
    const listMilestonesWithStatus = vi.fn<ControlApi["github"]["listMilestonesWithStatus"]>(
      async () => milestonesResult
    );
    const api = makeApi({
      listIssuesWithStatus,
      listLabelsWithStatus,
      listAssignableUsersWithStatus,
      listMilestonesWithStatus
    });

    await prefetchIssuesTabData(queryClient, {
      api,
      owner,
      repo,
      issueListLimit: 30,
      githubReady: false
    });

    expect(listIssuesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 30,
      cacheOnly: true
    });
    expect(listLabelsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: true
    });
    expect(listAssignableUsersWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: true
    });
    expect(listMilestonesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 100,
      cacheOnly: true
    });
    expect(queryClient.getQueryData(issuesTabQueryKey(owner, repo, 30))).toBe(issuesResult);
    expect(queryClient.getQueryData(repositoryLabelsQueryKey(owner, repo))).toBe(labelsResult);
    expect(queryClient.getQueryData(repositoryAssignableUsersQueryKey(owner, repo))).toBe(
      assignableUsersResult
    );
    expect(queryClient.getQueryData(repositoryMilestonesQueryKey(owner, repo))).toBe(milestonesResult);
  });

  it("prefetches pull requests and issue resources without mounting PullRequestsTab", async () => {
    const queryClient = makeQueryClient();
    const pullsResult = listResult<never>();
    const labelsResult = listResult<never>();
    const assignableUsersResult = listResult<never>();
    const milestonesResult = listResult<never>();
    const listPullRequestsWithStatus = vi.fn<ControlApi["github"]["listPullRequestsWithStatus"]>(
      async () => pullsResult
    );
    const listLabelsWithStatus = vi.fn<ControlApi["github"]["listLabelsWithStatus"]>(
      async () => labelsResult
    );
    const listAssignableUsersWithStatus = vi.fn<ControlApi["github"]["listAssignableUsersWithStatus"]>(
      async () => assignableUsersResult
    );
    const listMilestonesWithStatus = vi.fn<ControlApi["github"]["listMilestonesWithStatus"]>(
      async () => milestonesResult
    );
    const api = makeApi({
      listPullRequestsWithStatus,
      listLabelsWithStatus,
      listAssignableUsersWithStatus,
      listMilestonesWithStatus
    });

    await prefetchPullRequestsTabData(queryClient, {
      api,
      owner,
      repo,
      pullRequestListLimit: 40,
      githubReady: false
    });

    expect(listPullRequestsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 40,
      cacheOnly: true
    });
    expect(listLabelsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: true
    });
    expect(listAssignableUsersWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: true
    });
    expect(listMilestonesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 100,
      cacheOnly: true
    });
    expect(queryClient.getQueryData(pullRequestsTabQueryKey(owner, repo, 40))).toBe(pullsResult);
    expect(queryClient.getQueryData(repositoryLabelsQueryKey(owner, repo))).toBe(labelsResult);
    expect(queryClient.getQueryData(repositoryAssignableUsersQueryKey(owner, repo))).toBe(
      assignableUsersResult
    );
    expect(queryClient.getQueryData(repositoryMilestonesQueryKey(owner, repo))).toBe(milestonesResult);
  });

  it("refreshes issues and focused issue detail with forced cache-only reads when GitHub is offline", async () => {
    const queryClient = makeQueryClient();
    const listIssuesWithStatus = vi.fn<ControlApi["github"]["listIssuesWithStatus"]>(
      mockControlApi.github.listIssuesWithStatus
    );
    const listLabelsWithStatus = vi.fn<ControlApi["github"]["listLabelsWithStatus"]>(
      mockControlApi.github.listLabelsWithStatus
    );
    const listAssignableUsersWithStatus = vi.fn<ControlApi["github"]["listAssignableUsersWithStatus"]>(
      mockControlApi.github.listAssignableUsersWithStatus
    );
    const listMilestonesWithStatus = vi.fn<ControlApi["github"]["listMilestonesWithStatus"]>(
      mockControlApi.github.listMilestonesWithStatus
    );
    const getIssueDetailWithStatus = vi.fn<ControlApi["github"]["getIssueDetailWithStatus"]>(
      mockControlApi.github.getIssueDetailWithStatus
    );
    const api = makeApi({
      listIssuesWithStatus,
      listLabelsWithStatus,
      listAssignableUsersWithStatus,
      listMilestonesWithStatus,
      getIssueDetailWithStatus
    });

    await refreshIssuesTabData(queryClient, {
      api,
      owner,
      repo,
      issueListLimit: 30,
      focusedIssueNumber: 7,
      githubReady: false
    });

    expect(listIssuesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 30,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listLabelsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listAssignableUsersWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listMilestonesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 100,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(getIssueDetailWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      issueNumber: 7,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(queryClient.getQueryData(issuesTabQueryKey(owner, repo, 30))).toBeDefined();
    expect(queryClient.getQueryData(repositoryLabelsQueryKey(owner, repo))).toBeDefined();
    expect(queryClient.getQueryData(repositoryAssignableUsersQueryKey(owner, repo))).toBeDefined();
    expect(queryClient.getQueryData(repositoryMilestonesQueryKey(owner, repo))).toBeDefined();
    expect(queryClient.getQueryData(issueDetailQueryKey(owner, repo, 7))).toBeDefined();
  });

  it("refreshes pull requests, shared resources, refs, and focused pull detail online", async () => {
    const queryClient = makeQueryClient();
    const listPullRequestsWithStatus = vi.fn<ControlApi["github"]["listPullRequestsWithStatus"]>(
      mockControlApi.github.listPullRequestsWithStatus
    );
    const listLabelsWithStatus = vi.fn<ControlApi["github"]["listLabelsWithStatus"]>(
      mockControlApi.github.listLabelsWithStatus
    );
    const listAssignableUsersWithStatus = vi.fn<ControlApi["github"]["listAssignableUsersWithStatus"]>(
      mockControlApi.github.listAssignableUsersWithStatus
    );
    const listMilestonesWithStatus = vi.fn<ControlApi["github"]["listMilestonesWithStatus"]>(
      mockControlApi.github.listMilestonesWithStatus
    );
    const listBranchesWithStatus = vi.fn<ControlApi["github"]["listBranchesWithStatus"]>(
      mockControlApi.github.listBranchesWithStatus
    );
    const getPullRequestOverviewWithStatus = vi.fn<ControlApi["github"]["getPullRequestOverviewWithStatus"]>(
      mockControlApi.github.getPullRequestOverviewWithStatus
    );
    const listPullRequestCommentsWithStatus = vi.fn<
      ControlApi["github"]["listPullRequestCommentsWithStatus"]
    >(mockControlApi.github.listPullRequestCommentsWithStatus);
    const listPullRequestFilesWithStatus = vi.fn<ControlApi["github"]["listPullRequestFilesWithStatus"]>(
      mockControlApi.github.listPullRequestFilesWithStatus
    );
    const listPullRequestCommitsWithStatus = vi.fn<ControlApi["github"]["listPullRequestCommitsWithStatus"]>(
      mockControlApi.github.listPullRequestCommitsWithStatus
    );
    const listPullRequestReviewsWithStatus = vi.fn<ControlApi["github"]["listPullRequestReviewsWithStatus"]>(
      mockControlApi.github.listPullRequestReviewsWithStatus
    );
    const listPullRequestChecksWithStatus = vi.fn<ControlApi["github"]["listPullRequestChecksWithStatus"]>(
      mockControlApi.github.listPullRequestChecksWithStatus
    );
    const listPullRequestReviewThreadsWithStatus = vi.fn<
      ControlApi["github"]["listPullRequestReviewThreadsWithStatus"]
    >(mockControlApi.github.listPullRequestReviewThreadsWithStatus);
    const listPullRequestTimelineWithStatus = vi.fn<
      ControlApi["github"]["listPullRequestTimelineWithStatus"]
    >(mockControlApi.github.listPullRequestTimelineWithStatus);
    const listPullRequestLinkedIssuesWithStatus = vi.fn<
      ControlApi["github"]["listPullRequestLinkedIssuesWithStatus"]
    >(mockControlApi.github.listPullRequestLinkedIssuesWithStatus);
    const api = makeApi({
      listPullRequestsWithStatus,
      listLabelsWithStatus,
      listAssignableUsersWithStatus,
      listMilestonesWithStatus,
      listBranchesWithStatus,
      getPullRequestOverviewWithStatus,
      listPullRequestCommentsWithStatus,
      listPullRequestFilesWithStatus,
      listPullRequestCommitsWithStatus,
      listPullRequestReviewsWithStatus,
      listPullRequestChecksWithStatus,
      listPullRequestReviewThreadsWithStatus,
      listPullRequestTimelineWithStatus,
      listPullRequestLinkedIssuesWithStatus
    });

    await refreshPullRequestsTabData(queryClient, {
      api,
      owner,
      repo,
      pullRequestListLimit: 40,
      refListLimit: 80,
      focusedPullNumber: 12,
      githubReady: true
    });

    expect(listPullRequestsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 40,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listLabelsWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listAssignableUsersWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 100,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listMilestonesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      state: "all",
      limit: 100,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listBranchesWithStatus).toHaveBeenCalledWith({
      owner,
      repo,
      limit: 80,
      cacheOnly: false,
      forceRefresh: true
    });

    const pullDetailInput = {
      owner,
      repo,
      pullNumber: 12,
      cacheOnly: false,
      forceRefresh: true
    };
    expect(getPullRequestOverviewWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestCommentsWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestFilesWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestCommitsWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestReviewsWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestChecksWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestReviewThreadsWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestTimelineWithStatus).toHaveBeenCalledWith(pullDetailInput);
    expect(listPullRequestLinkedIssuesWithStatus).toHaveBeenCalledWith(pullDetailInput);

    expect(queryClient.getQueryData(pullRequestsTabQueryKey(owner, repo, 40))).toBeDefined();
    expect(queryClient.getQueryData(repositoryLabelsQueryKey(owner, repo))).toBeDefined();
    expect(queryClient.getQueryData(repositoryAssignableUsersQueryKey(owner, repo))).toBeDefined();
    expect(queryClient.getQueryData(repositoryMilestonesQueryKey(owner, repo))).toBeDefined();
    expect(queryClient.getQueryData(repositoryBranchesQueryKey(owner, repo, 80))).toBeDefined();
    expect(queryClient.getQueryData(pullRequestDetailQueryKey("overview", owner, repo, 12))).toBeDefined();
    expect(queryClient.getQueryData(pullRequestDetailQueryKey("comments", owner, repo, 12))).toBeDefined();
    expect(queryClient.getQueryData(pullRequestDetailQueryKey("files", owner, repo, 12))).toBeDefined();
    expect(queryClient.getQueryData(pullRequestDetailQueryKey("commits", owner, repo, 12))).toBeDefined();
    expect(queryClient.getQueryData(pullRequestDetailQueryKey("reviews", owner, repo, 12))).toBeDefined();
    expect(queryClient.getQueryData(pullRequestDetailQueryKey("checks", owner, repo, 12))).toBeDefined();
    expect(
      queryClient.getQueryData(pullRequestDetailQueryKey("review-threads", owner, repo, 12))
    ).toBeDefined();
    expect(queryClient.getQueryData(pullRequestDetailQueryKey("timeline", owner, repo, 12))).toBeDefined();
    expect(
      queryClient.getQueryData(pullRequestDetailQueryKey("linked-issues", owner, repo, 12))
    ).toBeDefined();
  });
});
