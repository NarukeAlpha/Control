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
import {
  codeTabCommitsQueryKey,
  codeTabContentsQueryKey,
  codeTabReadmeQueryKey,
  codeTabRootMarkdownContentQueryKey,
  prefetchCodeTabData,
  refreshCodeTabData
} from "./code/CodeTab";
import { discussionsTabQueryKey, prefetchDiscussionsTabData } from "./discussions/DiscussionsTab";
import { issueDetailQueryKey } from "./issues/useIssueDetail";
import { issuesTabQueryKey, prefetchIssuesTabData, refreshIssuesTabData } from "./issues/IssuesTab";
import { projectsTabQueryKey, prefetchProjectsTabData } from "./projects/ProjectsTab";
import {
  prefetchPullRequestsTabData,
  pullRequestDetailQueryKey,
  pullRequestsTabQueryKey,
  refreshPullRequestsTabData
} from "./pull-requests/PullRequestsTab";
import { releasesTabQueryKey, prefetchReleasesTabData } from "./releases/ReleasesTab";
import { prefetchWikiTabData, wikiTabQueryKey } from "./wiki/WikiTab";
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
        content: "# Contributing",
        htmlUrl: "https://github.com/NarukeAlpha/control/blob/main/CONTRIBUTING.md",
        downloadUrl: null,
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
