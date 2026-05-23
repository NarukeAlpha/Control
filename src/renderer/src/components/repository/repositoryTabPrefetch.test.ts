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
import { actionsTabQueryKey, prefetchActionsTabData } from "./actions/ActionsTab";
import {
  codeTabCommitsQueryKey,
  codeTabContentsQueryKey,
  codeTabReadmeQueryKey,
  codeTabRootMarkdownContentQueryKey,
  prefetchCodeTabData
} from "./code/CodeTab";
import { discussionsTabQueryKey, prefetchDiscussionsTabData } from "./discussions/DiscussionsTab";
import { issuesTabQueryKey, prefetchIssuesTabData } from "./issues/IssuesTab";
import { projectsTabQueryKey, prefetchProjectsTabData } from "./projects/ProjectsTab";
import { releasesTabQueryKey, prefetchReleasesTabData } from "./releases/ReleasesTab";
import { prefetchWikiTabData, wikiTabQueryKey } from "./wiki/WikiTab";
import {
  repositoryAssignableUsersQueryKey,
  repositoryLabelsQueryKey,
  repositoryMilestonesQueryKey
} from "../../hooks/useRepositoryIssueResources";

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
});
