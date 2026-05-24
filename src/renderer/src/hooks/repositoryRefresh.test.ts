import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";

import {
  codeBrowserCommitsQueryKey,
  codeBrowserFileBlameQueryKey,
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
      fileBlameRangeLimit: 5,
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
    expect(getFileBlame).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      path: "src/App.tsx",
      ref: "main",
      maxRanges: 5,
      cacheOnly: false,
      forceRefresh: true
    });
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
      queryClient.getQueryData(codeBrowserFileBlameQueryKey("NarukeAlpha", "control", null, "src/App.tsx", 5))
    ).toBeDefined();
    expect(
      queryClient.getQueryData(codeBrowserCommitsQueryKey("NarukeAlpha", "control", null, "src/App.tsx", 8))
    ).toBeDefined();
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
