import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability, RepoFileContent, RepoFileContentResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import {
  codeBrowserCommitsQueryKey,
  codeBrowserFileContentQueryKey,
  refreshCodeBrowserData
} from "../components/code-browser/codeBrowserQueries";
import {
  organizationMembersQueryKey,
  organizationProjectsQueryKey,
  organizationRepositoriesQueryKey,
  organizationsQueryKey,
  organizationTeamMembersQueryKey,
  organizationTeamRepositoriesQueryKey,
  organizationTeamsQueryKey,
  refreshOrganizationsRouteData
} from "../components/collection/organizationQueries";
import { notificationQueryKey } from "../components/collection/notificationUi";
import { mockControlApi } from "../data/mock";
import { accountProfileQueryKey, refreshAccountProfileData } from "./useAccountProfile";
import { accountIssuesQueryKey, accountPullsQueryKey, refreshAccountWorkData } from "./useAccountWork";
import { refreshMailboxNotificationsData } from "./useMailboxNotifications";
import { recentItemsQueryKey, refreshRecentItemsData } from "./useRecentItems";
import { refreshRepositoryDirectoryData, repositoryDirectoryQueryKey } from "./useRepositoryDirectory";
import { refreshRepositoryDetailData, repositoryDetailQueryKey } from "./useRepositoryDetail";
import { repositoryBranchesQueryKey, repositoryTagsQueryKey } from "./useRepositoryRefs";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
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

const available: GitHubReadAvailability = { status: "available", message: null };

function makeFileContent(overrides: Partial<RepoFileContent> = {}): RepoFileContent {
  return {
    path: "src/App.tsx",
    name: "App.tsx",
    ref: "main",
    kind: "text",
    content: "export function App() {}",
    size: 24,
    encoding: "utf-8",
    htmlUrl: "https://github.com/NarukeAlpha/control/blob/main/src/App.tsx",
    downloadUrl: "https://raw.githubusercontent.com/NarukeAlpha/control/main/src/App.tsx",
    message: null,
    lastCommitSha: "abc1234",
    lastCommitMessage: "Update app",
    lastCommitAuthorLogin: "octocat",
    lastCommitAuthorName: "Octo Cat",
    lastCommitAuthorAvatarUrl: null,
    lastAuthoredDate: "2026-05-24T00:00:00.000Z",
    lastCommittedDate: "2026-05-24T00:00:00.000Z",
    lastCommitDate: "2026-05-24T00:00:00.000Z",
    lastCommitHtmlUrl: "https://github.com/NarukeAlpha/control/commit/abc1234",
    lastCommitAdditions: 1,
    lastCommitDeletions: 0,
    lastCommitChanges: 1,
    lastCommitAvailability: available,
    ...overrides
  };
}

function makeFileContentResult(item: RepoFileContent | null): RepoFileContentResult {
  return {
    item,
    availability: item ? available : { status: "offline", message: "Network unavailable." }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("route refresh helpers", () => {
  it("refreshes account profile and repository directory with forced online reads", async () => {
    const queryClient = makeQueryClient();
    const getAccountProfileWithStatus = vi.fn<ControlApi["github"]["getAccountProfileWithStatus"]>(
      mockControlApi.github.getAccountProfileWithStatus
    );
    const listRepositoriesWithStatus = vi.fn<ControlApi["github"]["listRepositoriesWithStatus"]>(
      mockControlApi.github.listRepositoriesWithStatus
    );
    const api = makeApi({ getAccountProfileWithStatus, listRepositoriesWithStatus });

    await Promise.all([
      refreshAccountProfileData(queryClient, { api, githubReady: true }),
      refreshRepositoryDirectoryData(queryClient, { api, limit: 80, githubReady: true })
    ]);

    expect(getAccountProfileWithStatus).toHaveBeenCalledWith({
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listRepositoriesWithStatus).toHaveBeenCalledWith({
      limit: 80,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(accountProfileQueryKey())).toBeDefined();
    expect(queryClient.getQueryData(repositoryDirectoryQueryKey(80))).toBeDefined();
  });

  it("refreshes local recents through local cache keys", async () => {
    const queryClient = makeQueryClient();
    const listRecentItems = vi.fn<ControlApi["listRecentItems"]>(mockControlApi.listRecentItems);
    const api: ControlApi = {
      ...mockControlApi,
      listRecentItems
    };

    await refreshRecentItemsData(queryClient, { api, limit: 12 });

    expect(listRecentItems).toHaveBeenCalledWith({ limit: 12 });
    expect(queryClient.getQueryData(recentItemsQueryKey(12))).toBeDefined();
  });

  it("refreshes repository detail through repository-owned query keys", async () => {
    const queryClient = makeQueryClient();
    const getRepositoryWithStatus = vi.fn<ControlApi["github"]["getRepositoryWithStatus"]>(
      mockControlApi.github.getRepositoryWithStatus
    );
    const api = makeApi({ getRepositoryWithStatus });

    await refreshRepositoryDetailData(queryClient, {
      api,
      owner: "NarukeAlpha",
      repo: "control",
      githubReady: true
    });

    expect(getRepositoryWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(repositoryDetailQueryKey("NarukeAlpha", "control"))).toBeDefined();
  });

  it("refreshes account work and notifications from cache while offline", async () => {
    const queryClient = makeQueryClient();
    const listAccountIssuesWithStatus = vi.fn<ControlApi["github"]["listAccountIssuesWithStatus"]>(
      mockControlApi.github.listAccountIssuesWithStatus
    );
    const listAccountPullRequestsWithStatus = vi.fn<
      ControlApi["github"]["listAccountPullRequestsWithStatus"]
    >(mockControlApi.github.listAccountPullRequestsWithStatus);
    const listNotificationsWithStatus = vi.fn<ControlApi["github"]["listNotificationsWithStatus"]>(
      mockControlApi.github.listNotificationsWithStatus
    );
    const api = makeApi({
      listAccountIssuesWithStatus,
      listAccountPullRequestsWithStatus,
      listNotificationsWithStatus
    });

    await Promise.all([
      refreshAccountWorkData(queryClient, {
        api,
        login: "octocat",
        limit: 30,
        githubReady: false
      }),
      refreshMailboxNotificationsData(queryClient, {
        api,
        filter: "participating",
        limit: 40,
        githubReady: false
      })
    ]);

    expect(listAccountIssuesWithStatus).toHaveBeenCalledWith({
      login: "octocat",
      state: "open",
      limit: 30,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listAccountPullRequestsWithStatus).toHaveBeenCalledWith({
      login: "octocat",
      state: "open",
      limit: 30,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listNotificationsWithStatus).toHaveBeenCalledWith({
      all: false,
      participating: true,
      limit: 40,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(queryClient.getQueryData(accountIssuesQueryKey("octocat", 30))).toBeDefined();
    expect(queryClient.getQueryData(accountPullsQueryKey("octocat", 30))).toBeDefined();
    expect(queryClient.getQueryData(notificationQueryKey("participating", 40))).toBeDefined();
  });

  it("refreshes code browser file data through browser-owned query keys", async () => {
    const queryClient = makeQueryClient();
    const listBranchesWithStatus = vi.fn<ControlApi["github"]["listBranchesWithStatus"]>(
      mockControlApi.github.listBranchesWithStatus
    );
    const listTagsWithStatus = vi.fn<ControlApi["github"]["listTagsWithStatus"]>(
      mockControlApi.github.listTagsWithStatus
    );
    const getFileContentWithStatus = vi.fn<ControlApi["github"]["getFileContentWithStatus"]>(
      mockControlApi.github.getFileContentWithStatus
    );
    const getFileBlame = vi.fn<ControlApi["github"]["getFileBlame"]>(mockControlApi.github.getFileBlame);
    const listCommitsWithStatus = vi.fn<ControlApi["github"]["listCommitsWithStatus"]>(
      mockControlApi.github.listCommitsWithStatus
    );
    const api = makeApi({
      listBranchesWithStatus,
      listTagsWithStatus,
      getFileContentWithStatus,
      getFileBlame,
      listCommitsWithStatus
    });

    await refreshCodeBrowserData(queryClient, {
      api,
      owner: "NarukeAlpha",
      repo: "control",
      selectedRef: null,
      defaultBranch: "main",
      path: "src/App.tsx",
      entryType: "file",
      refListLimit: 25,
      fileCommitHistoryLimit: 8,
      githubReady: true
    });

    expect(listBranchesWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      limit: 25,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(listTagsWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      limit: 25,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(getFileContentWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      path: "src/App.tsx",
      ref: "main",
      cacheOnly: false,
      forceRefresh: true
    });
    expect(getFileBlame).not.toHaveBeenCalled();
    expect(listCommitsWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      ref: "main",
      path: "src/App.tsx",
      limit: 8,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(queryClient.getQueryData(repositoryBranchesQueryKey("NarukeAlpha", "control", 25))).toBeDefined();
    expect(queryClient.getQueryData(repositoryTagsQueryKey("NarukeAlpha", "control", 25))).toBeDefined();
    expect(
      queryClient.getQueryData(codeBrowserFileContentQueryKey("NarukeAlpha", "control", null, "src/App.tsx"))
    ).toBeDefined();
    expect(
      queryClient.getQueryData(codeBrowserCommitsQueryKey("NarukeAlpha", "control", null, "src/App.tsx", 8))
    ).toBeDefined();
  });

  it.each([
    makeFileContent({
      kind: "binary",
      content: null,
      encoding: null,
      message: "Binary files are not previewed as text.",
      size: 256
    }),
    makeFileContent({
      kind: "too_large",
      content: null,
      encoding: null,
      message: "File preview was skipped because the file exceeds the preview size limit.",
      size: 2_097_153
    }),
    makeFileContent({
      path: "assets/logo.png",
      name: "logo.png",
      kind: "image",
      content: null,
      encoding: null,
      message: null,
      size: 1024
    }),
    makeFileContent({
      kind: "unavailable",
      content: null,
      encoding: null,
      message: "GitHub did not return previewable file content."
    })
  ])("replaces stale code browser text with successful $kind file content states", async (replacement) => {
    const queryClient = makeQueryClient();
    const fileContentKey = codeBrowserFileContentQueryKey("NarukeAlpha", "control", null, "src/App.tsx");
    const staleText = makeFileContentResult(makeFileContent({ content: "stale text" }));
    queryClient.setQueryData(fileContentKey, staleText);
    const getFileContentWithStatus = vi.fn<ControlApi["github"]["getFileContentWithStatus"]>(async () =>
      makeFileContentResult(replacement)
    );
    const api = makeApi({ getFileContentWithStatus });

    await refreshCodeBrowserData(queryClient, {
      api,
      owner: "NarukeAlpha",
      repo: "control",
      selectedRef: null,
      defaultBranch: "main",
      path: "src/App.tsx",
      entryType: "file",
      refListLimit: 25,
      fileCommitHistoryLimit: 8,
      githubReady: true
    });

    expect(queryClient.getQueryData<RepoFileContentResult>(fileContentKey)?.item).toEqual(replacement);
  });

  it.each([
    makeFileContent({
      kind: "binary",
      content: null,
      encoding: null,
      message: "Binary files are not previewed as text.",
      size: 256
    }),
    makeFileContent({
      kind: "too_large",
      content: null,
      encoding: null,
      message: "File preview was skipped because the file exceeds the preview size limit.",
      size: 2_097_153
    }),
    makeFileContent({
      path: "assets/logo.png",
      name: "logo.png",
      kind: "image",
      content: null,
      encoding: null,
      message: null,
      size: 1024
    }),
    makeFileContent({
      kind: "unavailable",
      content: null,
      encoding: null,
      message: "GitHub did not return previewable file content."
    })
  ])("replaces stale $kind file content states with successful fresh text", async (staleState) => {
    const queryClient = makeQueryClient();
    const fileContentKey = codeBrowserFileContentQueryKey("NarukeAlpha", "control", null, "src/App.tsx");
    queryClient.setQueryData(fileContentKey, makeFileContentResult(staleState));
    const freshText = makeFileContent({ content: "fresh text" });
    const getFileContentWithStatus = vi.fn<ControlApi["github"]["getFileContentWithStatus"]>(async () =>
      makeFileContentResult(freshText)
    );
    const api = makeApi({ getFileContentWithStatus });

    await refreshCodeBrowserData(queryClient, {
      api,
      owner: "NarukeAlpha",
      repo: "control",
      selectedRef: null,
      defaultBranch: "main",
      path: "src/App.tsx",
      entryType: "file",
      refListLimit: 25,
      fileCommitHistoryLimit: 8,
      githubReady: true
    });

    expect(queryClient.getQueryData<RepoFileContentResult>(fileContentKey)?.item).toEqual(freshText);
  });

  it("preserves stale code browser text when a background file refresh fails", async () => {
    const queryClient = makeQueryClient();
    const fileContentKey = codeBrowserFileContentQueryKey("NarukeAlpha", "control", null, "src/App.tsx");
    const staleText = makeFileContentResult(makeFileContent({ content: "stale text" }));
    queryClient.setQueryData(fileContentKey, staleText);
    const getFileContentWithStatus = vi.fn<ControlApi["github"]["getFileContentWithStatus"]>(async () =>
      makeFileContentResult(null)
    );
    const api = makeApi({ getFileContentWithStatus });

    await refreshCodeBrowserData(queryClient, {
      api,
      owner: "NarukeAlpha",
      repo: "control",
      selectedRef: null,
      defaultBranch: "main",
      path: "src/App.tsx",
      entryType: "file",
      refListLimit: 25,
      fileCommitHistoryLimit: 8,
      githubReady: true
    });

    expect(queryClient.getQueryData(fileContentKey)).toBe(staleText);
    expect(queryClient.getQueryState(fileContentKey)?.error).toEqual(
      expect.objectContaining({ message: "File content could not be loaded. Network unavailable." })
    );
  });

  it("refreshes organization route data through route-owned query keys", async () => {
    const queryClient = makeQueryClient();
    const listOrganizationsWithStatus = vi.fn<ControlApi["github"]["listOrganizationsWithStatus"]>(
      mockControlApi.github.listOrganizationsWithStatus
    );
    const listOrganizationTeamsWithStatus = vi.fn<ControlApi["github"]["listOrganizationTeamsWithStatus"]>(
      mockControlApi.github.listOrganizationTeamsWithStatus
    );
    const listOrganizationRepositoriesWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationRepositoriesWithStatus"]
    >(mockControlApi.github.listOrganizationRepositoriesWithStatus);
    const listOrganizationMembersWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationMembersWithStatus"]
    >(mockControlApi.github.listOrganizationMembersWithStatus);
    const listOrganizationProjectsWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationProjectsWithStatus"]
    >(mockControlApi.github.listOrganizationProjectsWithStatus);
    const listOrganizationTeamRepositoriesWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationTeamRepositoriesWithStatus"]
    >(mockControlApi.github.listOrganizationTeamRepositoriesWithStatus);
    const listOrganizationTeamMembersWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationTeamMembersWithStatus"]
    >(mockControlApi.github.listOrganizationTeamMembersWithStatus);
    const api = makeApi({
      listOrganizationsWithStatus,
      listOrganizationTeamsWithStatus,
      listOrganizationRepositoriesWithStatus,
      listOrganizationMembersWithStatus,
      listOrganizationProjectsWithStatus,
      listOrganizationTeamRepositoriesWithStatus,
      listOrganizationTeamMembersWithStatus
    });

    await refreshOrganizationsRouteData(queryClient, {
      api,
      githubReady: false,
      organizationListLimit: 50,
      selectedOrganizationLogin: "openai",
      organizationRepositoryLimit: 60,
      organizationTeamLimit: 30,
      organizationMemberLimit: 40,
      organizationProjectLimit: 20,
      selectedOrganizationTeamSlug: "core",
      organizationTeamRepositoryLimit: 10,
      organizationTeamMemberLimit: 12
    });

    expect(listOrganizationsWithStatus).toHaveBeenCalledWith({
      limit: 50,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listOrganizationTeamsWithStatus).toHaveBeenCalledWith({
      org: "openai",
      limit: 30,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listOrganizationRepositoriesWithStatus).toHaveBeenCalledWith({
      org: "openai",
      limit: 60,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listOrganizationMembersWithStatus).toHaveBeenCalledWith({
      org: "openai",
      limit: 40,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listOrganizationProjectsWithStatus).toHaveBeenCalledWith({
      org: "openai",
      limit: 20,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listOrganizationTeamRepositoriesWithStatus).toHaveBeenCalledWith({
      org: "openai",
      teamSlug: "core",
      limit: 10,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(listOrganizationTeamMembersWithStatus).toHaveBeenCalledWith({
      org: "openai",
      teamSlug: "core",
      limit: 12,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(queryClient.getQueryData(organizationsQueryKey(50))).toBeDefined();
    expect(queryClient.getQueryData(organizationTeamsQueryKey("openai", 30))).toBeDefined();
    expect(queryClient.getQueryData(organizationRepositoriesQueryKey("openai", 60))).toBeDefined();
    expect(queryClient.getQueryData(organizationMembersQueryKey("openai", 40))).toBeDefined();
    expect(queryClient.getQueryData(organizationProjectsQueryKey("openai", 20))).toBeDefined();
    expect(
      queryClient.getQueryData(organizationTeamRepositoriesQueryKey("openai", "core", 10))
    ).toBeDefined();
    expect(queryClient.getQueryData(organizationTeamMembersQueryKey("openai", "core", 12))).toBeDefined();
  });
});
