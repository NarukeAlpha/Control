import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";

import { notificationQueryKey } from "../components/collection/notificationUi";
import { mockControlApi } from "../data/mock";
import { accountProfileQueryKey, refreshAccountProfileData } from "./useAccountProfile";
import { accountIssuesQueryKey, accountPullsQueryKey, refreshAccountWorkData } from "./useAccountWork";
import { refreshMailboxNotificationsData } from "./useMailboxNotifications";
import { refreshRepositoryDirectoryData, repositoryDirectoryQueryKey } from "./useRepositoryDirectory";

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
});
