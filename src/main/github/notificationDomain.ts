import type {
  GitHubReadAvailability,
  NotificationListInput,
  NotificationListResult,
  NotificationSummary,
  NotificationThreadInput,
  NotificationThreadMutationResult
} from "@shared/github";

export interface OctokitNotificationClient {
  rest<T>(route: string, params?: Record<string, unknown>): Promise<T>;
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
}

export class OctokitNotificationDomain {
  constructor(
    private readonly client: OctokitNotificationClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listNotifications(input: NotificationListInput = {}): Promise<NotificationSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubNotification>(
      "GET /notifications",
      {
        all: input.all ?? false,
        participating: input.participating ?? undefined,
        since: input.since ?? undefined,
        before: input.before ?? undefined
      },
      input.limit ?? 30
    );

    return Promise.all(
      data.map(async (notification) => {
        const releaseHtmlUrl = await this.getNotificationReleaseHtmlUrl(notification);
        const subscription = await this.getNotificationSubscription(notification);
        return mapNotification(
          notification,
          input.participating === true ? true : null,
          releaseHtmlUrl,
          subscription
        );
      })
    );
  }

  async listNotificationsWithStatus(input: NotificationListInput = {}): Promise<NotificationListResult> {
    try {
      return {
        items: await this.listNotifications(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async markNotificationThreadRead(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    await this.client.rest<void>("PATCH /notifications/threads/{thread_id}", {
      thread_id: input.threadId
    });

    return {
      ok: true,
      threadId: input.threadId,
      message: "Notification thread marked as read."
    };
  }

  async unsubscribeNotificationThread(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    await this.client.rest<void>("DELETE /notifications/threads/{thread_id}/subscription", {
      thread_id: input.threadId
    });

    return {
      ok: true,
      threadId: input.threadId,
      message: "Notification thread unsubscribed."
    };
  }

  private async getNotificationSubscription(
    notification: GitHubNotification
  ): Promise<GitHubNotificationSubscription | null> {
    if (!notification.subscription_url) {
      return null;
    }

    try {
      return await this.client.rest<GitHubNotificationSubscription>(
        "GET /notifications/threads/{thread_id}/subscription",
        { thread_id: notification.id }
      );
    } catch {
      return null;
    }
  }

  private async getNotificationReleaseHtmlUrl(notification: GitHubNotification): Promise<string | null> {
    const release = parseNotificationReleaseApiUrl(notification);
    if (!release) {
      return null;
    }

    try {
      const data = await this.client.rest<Pick<GitHubReleaseForNotification, "html_url">>(
        "GET /repos/{owner}/{repo}/releases/{release_id}",
        release
      );
      return data.html_url ?? null;
    } catch {
      return null;
    }
  }
}

function mapNotification(
  notification: GitHubNotification,
  participating: boolean | null,
  subjectHtmlUrlOverride: string | null = null,
  subscription: GitHubNotificationSubscription | null = null
): NotificationSummary {
  const subjectHtmlUrl = subjectHtmlUrlOverride ?? mapNotificationSubjectHtmlUrl(notification);
  const latestCommentHtmlUrl = mapNotificationLatestCommentHtmlUrl(notification, subjectHtmlUrl);

  return {
    id: notification.id,
    unread: notification.unread,
    reason: notification.reason,
    updatedAt: notification.updated_at,
    lastReadAt: notification.last_read_at ?? null,
    participating,
    threadUrl: notification.url ?? null,
    subscriptionUrl: notification.subscription_url ?? null,
    subscribed: subscription?.subscribed ?? null,
    ignored: subscription?.ignored ?? null,
    subscriptionReason: subscription?.reason ?? null,
    subscriptionCreatedAt: subscription?.created_at ?? null,
    repositoryNameWithOwner: notification.repository.full_name,
    repositoryHtmlUrl: notification.repository.html_url ?? null,
    repositoryPrivate: notification.repository.private ?? null,
    subject: {
      title: notification.subject.title,
      type: notification.subject.type,
      apiUrl: notification.subject.url ?? null,
      latestCommentApiUrl: notification.subject.latest_comment_url ?? null,
      latestCommentHtmlUrl,
      htmlUrl: subjectHtmlUrl
    },
    htmlUrl: subjectHtmlUrl ?? notification.repository.html_url ?? null
  };
}

function mapNotificationLatestCommentHtmlUrl(
  notification: GitHubNotification,
  subjectHtmlUrl: string | null
): string | null {
  const latestCommentApiUrl = notification.subject.latest_comment_url;
  if (!latestCommentApiUrl || !subjectHtmlUrl) {
    return null;
  }

  try {
    const pathname = new URL(latestCommentApiUrl).pathname;
    const issueCommentMatch = pathname.match(/\/issues\/comments\/(\d+)$/);
    if (issueCommentMatch?.[1]) {
      return `${subjectHtmlUrl}#issuecomment-${issueCommentMatch[1]}`;
    }

    const discussionCommentMatch = pathname.match(/\/discussions\/comments\/(\d+)$/);
    if (discussionCommentMatch?.[1]) {
      return `${subjectHtmlUrl}#discussioncomment-${discussionCommentMatch[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

function mapNotificationSubjectHtmlUrl(notification: GitHubNotification): string | null {
  const apiUrl = notification.subject.url;
  if (!apiUrl) {
    return null;
  }

  const repositoryPath = notification.repository.full_name;
  const marker = `/repos/${repositoryPath}/`;

  try {
    const pathname = new URL(apiUrl).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const suffix = pathname.slice(markerIndex + marker.length);
    if (suffix.startsWith("issues/")) {
      return `https://github.com/${repositoryPath}/${suffix}`;
    }
    if (suffix.startsWith("pulls/")) {
      return `https://github.com/${repositoryPath}/${suffix.replace(/^pulls\//, "pull/")}`;
    }
    if (suffix.startsWith("discussions/")) {
      return `https://github.com/${repositoryPath}/${suffix}`;
    }
    if (suffix.startsWith("commits/")) {
      return `https://github.com/${repositoryPath}/${suffix.replace(/^commits\//, "commit/")}`;
    }
    if (suffix.startsWith("actions/runs/")) {
      return `https://github.com/${repositoryPath}/${suffix}`;
    }
    if (suffix.startsWith("releases/")) {
      return `https://github.com/${repositoryPath}/releases`;
    }
  } catch {
    return null;
  }

  return null;
}

function parseNotificationReleaseApiUrl(
  notification: GitHubNotification
): { owner: string; repo: string; release_id: number } | null {
  const apiUrl = notification.subject.url;
  if (!apiUrl) {
    return null;
  }

  const [owner, repo] = notification.repository.full_name.split("/");
  if (!owner || !repo) {
    return null;
  }

  try {
    const pathname = new URL(apiUrl).pathname;
    const marker = `/repos/${notification.repository.full_name}/releases/`;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const releaseId = pathname.slice(markerIndex + marker.length);
    if (!/^\d+$/.test(releaseId)) {
      return null;
    }

    return { owner, repo, release_id: Number(releaseId) };
  } catch {
    return null;
  }
}

interface GitHubReleaseForNotification {
  html_url?: string | null;
}

export interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at?: string | null;
  url?: string | null;
  subscription_url?: string | null;
  repository: {
    full_name: string;
    html_url?: string | null;
    private?: boolean | null;
  };
  subject: {
    title: string;
    type: string;
    url?: string | null;
    latest_comment_url?: string | null;
  };
}

export interface GitHubNotificationSubscription {
  subscribed?: boolean | null;
  ignored?: boolean | null;
  reason?: string | null;
  created_at?: string | null;
}
