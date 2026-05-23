import { useQueryClient } from "@tanstack/react-query";

import type { MailboxNotificationFilter } from "../components/collection/notificationUi";
import { refreshAccountProfileData } from "./useAccountProfile";
import { refreshAccountWorkData } from "./useAccountWork";
import { useControlApi } from "./useControlApi";
import { refreshMailboxNotificationsData } from "./useMailboxNotifications";
import { refreshRecentItemsData } from "./useRecentItems";
import { refreshRepositoryDirectoryData } from "./useRepositoryDirectory";

interface UseCollectionRefreshActionsInput {
  appReady: boolean;
  githubReady: boolean;
  authenticatedViewerLogin: string | null;
  repositoryListLimit: number;
  homeRefreshWorkLimit: number;
  recentItemLimit: number;
  mailboxWorkLimit: number;
  notificationFilter: MailboxNotificationFilter;
  notificationLimit: number;
}

interface UseCollectionRefreshActionsResult {
  refreshHomeNow: () => Promise<void>;
  refreshRepositoriesNow: () => Promise<void>;
  refreshMailboxNow: () => Promise<void>;
}

export function useCollectionRefreshActions({
  appReady,
  githubReady,
  authenticatedViewerLogin,
  repositoryListLimit,
  homeRefreshWorkLimit,
  recentItemLimit,
  mailboxWorkLimit,
  notificationFilter,
  notificationLimit
}: UseCollectionRefreshActionsInput): UseCollectionRefreshActionsResult {
  const api = useControlApi();
  const queryClient = useQueryClient();

  async function refreshHomeNow(): Promise<void> {
    if (!appReady) {
      return;
    }

    try {
      await Promise.all([
        refreshAccountProfileData(queryClient, { api, githubReady }),
        refreshRepositoryDirectoryData(queryClient, { api, limit: repositoryListLimit, githubReady }),
        refreshAccountWorkData(queryClient, {
          api,
          login: authenticatedViewerLogin,
          limit: homeRefreshWorkLimit,
          githubReady
        }),
        refreshRecentItemsData(queryClient, { api, limit: recentItemLimit })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshRepositoriesNow(): Promise<void> {
    try {
      await refreshRepositoryDirectoryData(queryClient, { api, limit: repositoryListLimit, githubReady });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshMailboxNow(): Promise<void> {
    if (!appReady) {
      return;
    }

    try {
      await Promise.all([
        refreshAccountWorkData(queryClient, {
          api,
          login: authenticatedViewerLogin,
          limit: mailboxWorkLimit,
          githubReady
        }),
        refreshMailboxNotificationsData(queryClient, {
          api,
          filter: notificationFilter,
          limit: notificationLimit,
          githubReady
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  return {
    refreshHomeNow,
    refreshRepositoriesNow,
    refreshMailboxNow
  };
}
