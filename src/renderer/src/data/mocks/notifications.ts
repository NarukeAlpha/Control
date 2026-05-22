import type { NotificationListInput, NotificationSummary } from "@shared/github";

import { readMockArray, writeMockArray } from "../mockStorage";

export const mockNotificationsKey = "control:mock:notifications";

export const mockNotifications: NotificationSummary[] = [
  {
    id: "notification-1",
    unread: true,
    reason: "mention",
    updatedAt: new Date(Date.now() - 1_200_000).toISOString(),
    lastReadAt: null,
    participating: true,
    threadUrl: "https://api.github.com/notifications/threads/notification-1",
    subscriptionUrl: "https://api.github.com/notifications/threads/notification-1/subscription",
    subscribed: true,
    ignored: false,
    subscriptionReason: "mention",
    subscriptionCreatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    repositoryNameWithOwner: "apple/swift",
    repositoryHtmlUrl: "https://github.com/apple/swift",
    repositoryPrivate: false,
    subject: {
      title: "Improve Sendable diagnostics for global actors",
      type: "Issue",
      apiUrl: "https://api.github.com/repos/apple/swift/issues/1200",
      latestCommentApiUrl: "https://api.github.com/repos/apple/swift/issues/comments/1",
      latestCommentHtmlUrl: "https://github.com/apple/swift/issues/1200#issuecomment-1",
      htmlUrl: "https://github.com/apple/swift/issues/1200"
    },
    htmlUrl: "https://github.com/apple/swift/issues/1200"
  },
  {
    id: "notification-2",
    unread: false,
    reason: "review_requested",
    updatedAt: new Date(Date.now() - 7_200_000).toISOString(),
    lastReadAt: new Date(Date.now() - 3_600_000).toISOString(),
    participating: null,
    threadUrl: "https://api.github.com/notifications/threads/notification-2",
    subscriptionUrl: "https://api.github.com/notifications/threads/notification-2/subscription",
    subscribed: false,
    ignored: true,
    subscriptionReason: "review_requested",
    subscriptionCreatedAt: new Date(Date.now() - 172_800_000).toISOString(),
    repositoryNameWithOwner: "apple/swift",
    repositoryHtmlUrl: "https://github.com/apple/swift",
    repositoryPrivate: false,
    subject: {
      title: "Add Sendable support for @MainActor types",
      type: "PullRequest",
      apiUrl: "https://api.github.com/repos/apple/swift/pulls/520",
      latestCommentApiUrl: "https://api.github.com/repos/apple/swift/issues/comments/2",
      latestCommentHtmlUrl: "https://github.com/apple/swift/pull/520#issuecomment-2",
      htmlUrl: "https://github.com/apple/swift/pull/520"
    },
    htmlUrl: "https://github.com/apple/swift/pull/520"
  }
];

export function readMockNotifications(): NotificationSummary[] {
  return readMockArray(mockNotificationsKey, () => mockNotifications);
}

export function writeMockNotifications(items: NotificationSummary[]): void {
  writeMockArray(mockNotificationsKey, items);
}

export function listMockNotifications(input?: NotificationListInput): NotificationSummary[] {
  const notifications = readMockNotifications().filter((notification) => {
    if (!input?.all && !notification.unread) {
      return false;
    }
    if (input?.participating && notification.participating !== true) {
      return false;
    }
    return true;
  });
  return notifications.slice(0, input?.limit ?? 30);
}

export function markMockNotificationRead(threadId: string): NotificationSummary[] {
  const now = new Date().toISOString();
  const nextNotifications = readMockNotifications().map((notification) =>
    notification.id === threadId
      ? {
          ...notification,
          unread: false,
          lastReadAt: now
        }
      : notification
  );
  writeMockNotifications(nextNotifications);
  return nextNotifications;
}

export function unsubscribeMockNotification(threadId: string): NotificationSummary[] {
  const nextNotifications = readMockNotifications().filter((notification) => notification.id !== threadId);
  writeMockNotifications(nextNotifications);
  return nextNotifications;
}
