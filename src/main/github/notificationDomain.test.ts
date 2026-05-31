import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import {
  OctokitNotificationDomain,
  type GitHubNotification,
  type OctokitNotificationClient
} from "./notificationDomain";

describe("OctokitNotificationDomain", () => {
  it("loads notifications with subject, latest-comment, and subscription metadata", async () => {
    const rest = vi.fn(async (_route: string, _params?: Record<string, unknown>) => ({
      subscribed: true,
      ignored: false,
      reason: "subscribed",
      created_at: "2026-05-01T00:00:00.000Z"
    }));
    const restPaginatedArray = vi.fn(
      async (_route: string, _params: Record<string, unknown>, _limit: number) => [
        notificationFixture({
          id: "thread-1",
          subjectUrl: "https://api.github.com/repos/apple/swift/pulls/520",
          latestCommentUrl: "https://api.github.com/repos/apple/swift/issues/comments/2",
          subscriptionUrl: "https://api.github.com/notifications/threads/thread-1/subscription"
        })
      ]
    );
    const domain = new OctokitNotificationDomain(
      createClient({
        rest: async <T>(route: string, params?: Record<string, unknown>) => (await rest(route, params)) as T,
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(domain.listNotifications({ all: false, participating: true, limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        id: "thread-1",
        participating: true,
        subscribed: true,
        ignored: false,
        subscriptionReason: "subscribed",
        htmlUrl: "https://github.com/apple/swift/pull/520",
        subject: expect.objectContaining({
          htmlUrl: "https://github.com/apple/swift/pull/520",
          latestCommentHtmlUrl: "https://github.com/apple/swift/pull/520#issuecomment-2"
        })
      })
    ]);
    expect(restPaginatedArray).toHaveBeenCalledWith(
      "GET /notifications",
      { all: false, participating: true, since: undefined, before: undefined },
      10
    );
    expect(rest).toHaveBeenCalledWith("GET /notifications/threads/{thread_id}/subscription", {
      thread_id: "thread-1"
    });
  });

  it("uses release detail lookup for release notification permalinks", async () => {
    const rest = vi.fn(async (route: string, _params?: Record<string, unknown>) => {
      if (route === "GET /repos/{owner}/{repo}/releases/{release_id}") {
        return { html_url: "https://github.com/apple/swift/releases/tag/swift-6.0" };
      }
      throw new Error("Unexpected REST request");
    });
    const domain = new OctokitNotificationDomain(
      createClient({
        rest: async <T>(route: string, params?: Record<string, unknown>) => (await rest(route, params)) as T,
        restPaginatedArray: async <T>() =>
          [
            notificationFixture({
              id: "thread-release",
              subjectType: "Release",
              subjectUrl: "https://api.github.com/repos/apple/swift/releases/123",
              latestCommentUrl: null
            })
          ] as T[]
      }),
      mapTestError
    );

    await expect(domain.listNotifications({ all: true })).resolves.toEqual([
      expect.objectContaining({
        htmlUrl: "https://github.com/apple/swift/releases/tag/swift-6.0",
        subject: expect.objectContaining({
          htmlUrl: "https://github.com/apple/swift/releases/tag/swift-6.0"
        })
      })
    ]);
    expect(rest).toHaveBeenCalledWith("GET /repos/{owner}/{repo}/releases/{release_id}", {
      owner: "apple",
      repo: "swift",
      release_id: 123
    });
  });

  it("maps notification list failures into statusful results", async () => {
    const domain = new OctokitNotificationDomain(
      createClient({
        restPaginatedArray: async () => {
          throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(domain.listNotificationsWithStatus()).resolves.toEqual({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });

  it("runs thread mutations through the notification domain", async () => {
    const rest = vi.fn(async (_route: string, _params?: Record<string, unknown>) => undefined);
    const domain = new OctokitNotificationDomain(
      createClient({
        rest: async <T>(route: string, params?: Record<string, unknown>) => (await rest(route, params)) as T
      }),
      mapTestError
    );

    await expect(domain.markNotificationThreadRead({ threadId: "thread-1" })).resolves.toEqual({
      ok: true,
      threadId: "thread-1",
      message: "Notification thread marked as read."
    });
    await expect(domain.unsubscribeNotificationThread({ threadId: "thread-1" })).resolves.toEqual({
      ok: true,
      threadId: "thread-1",
      message: "Notification thread unsubscribed."
    });
    expect(rest).toHaveBeenCalledWith("PATCH /notifications/threads/{thread_id}", {
      thread_id: "thread-1"
    });
    expect(rest).toHaveBeenCalledWith("DELETE /notifications/threads/{thread_id}/subscription", {
      thread_id: "thread-1"
    });
  });
});

function createClient(overrides: Partial<OctokitNotificationClient>): OctokitNotificationClient {
  return {
    rest: async () => {
      throw new Error("Unexpected REST request");
    },
    restPaginatedArray: async () => {
      throw new Error("Unexpected paginated REST request");
    },
    ...overrides
  };
}

function mapTestError(error: unknown): GitHubReadAvailability {
  return {
    status:
      error && typeof error === "object" && (error as { status?: unknown }).status === 403
        ? "rate_limited"
        : "error",
    message: error instanceof Error ? error.message : "failed"
  };
}

function notificationFixture(input: {
  id: string;
  subjectUrl: string;
  latestCommentUrl: string | null;
  subjectType?: string;
  subscriptionUrl?: string | null;
}): GitHubNotification {
  return {
    id: input.id,
    unread: true,
    reason: "review_requested",
    updated_at: "2026-05-05T12:00:00.000Z",
    last_read_at: null,
    url: `https://api.github.com/notifications/threads/${input.id}`,
    subscription_url: input.subscriptionUrl ?? null,
    repository: {
      full_name: "apple/swift",
      html_url: "https://github.com/apple/swift",
      private: false
    },
    subject: {
      title: "Add Sendable support for @MainActor types",
      type: input.subjectType ?? "PullRequest",
      url: input.subjectUrl,
      latest_comment_url: input.latestCommentUrl
    }
  };
}
