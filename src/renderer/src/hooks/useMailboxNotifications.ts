import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NotificationListResult } from "@shared/github";
import {
  notificationQueryKey,
  type MailboxNotificationFilter
} from "../components/collection/notificationUi";
import { useControlApi } from "./useControlApi";

export function useMailboxNotifications({
  filter,
  limit,
  enabled,
  githubReady
}: {
  filter: MailboxNotificationFilter;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}) {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const queryKey = notificationQueryKey(filter, limit);
  const notifications = useQuery({
    queryKey,
    queryFn: () => {
      const input = {
        all: filter === "all",
        limit,
        cacheOnly: !githubReady
      };
      return api.github.listNotificationsWithStatus(
        filter === "participating" ? { ...input, participating: true } : input
      );
    },
    enabled,
    staleTime: 30_000
  });

  const markNotificationRead = useMutation({
    mutationFn: api.github.markNotificationThreadRead,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousNotifications = queryClient.getQueryData<NotificationListResult>(queryKey);
      queryClient.setQueryData<NotificationListResult>(queryKey, (current) => {
        if (!current) {
          return current;
        }
        if (filter !== "all") {
          return {
            ...current,
            items: current.items.filter((notification) => notification.id !== input.threadId)
          };
        }

        return {
          ...current,
          items: current.items.map((notification) =>
            notification.id === input.threadId
              ? {
                  ...notification,
                  unread: false,
                  lastReadAt: new Date().toISOString()
                }
              : notification
          )
        };
      });
      return { key: queryKey, previousNotifications };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(context.key, context.previousNotifications);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markVisibleNotificationsRead = useMutation({
    mutationFn: async (input: { threadIds: string[] }) => {
      await Promise.all(
        input.threadIds.map((threadId) => api.github.markNotificationThreadRead({ threadId }))
      );
    },
    onMutate: async (input) => {
      const threadIds = new Set(input.threadIds);
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousNotifications = queryClient.getQueryData<NotificationListResult>(queryKey);
      queryClient.setQueryData<NotificationListResult>(queryKey, (current) => {
        if (!current) {
          return current;
        }
        if (filter !== "all") {
          return {
            ...current,
            items: current.items.filter((notification) => !threadIds.has(notification.id))
          };
        }

        return {
          ...current,
          items: current.items.map((notification) =>
            threadIds.has(notification.id)
              ? {
                  ...notification,
                  unread: false,
                  lastReadAt: new Date().toISOString()
                }
              : notification
          )
        };
      });
      return { key: queryKey, previousNotifications };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(context.key, context.previousNotifications);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const unsubscribeNotification = useMutation({
    mutationFn: api.github.unsubscribeNotificationThread,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousNotifications = queryClient.getQueryData<NotificationListResult>(queryKey);
      queryClient.setQueryData<NotificationListResult>(queryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.filter((notification) => notification.id !== input.threadId)
            }
          : current
      );
      return { key: queryKey, previousNotifications };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(context.key, context.previousNotifications);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  return {
    notifications,
    notificationItems: notifications.data?.items ?? [],
    notificationsAvailability: notifications.data?.availability ?? null,
    markNotificationRead,
    markVisibleNotificationsRead,
    unsubscribeNotification
  };
}
