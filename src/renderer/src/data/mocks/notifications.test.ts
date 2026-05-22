import { describe, expect, it, vi } from "vitest";

import {
  listMockNotifications,
  markMockNotificationRead,
  mockNotifications,
  mockNotificationsKey,
  unsubscribeMockNotification
} from "./notifications";
import { installMockDomainTestCleanup } from "./testCleanup";

describe("notification mocks", () => {
  installMockDomainTestCleanup();

  it("falls back to fixture notifications for absent or corrupt storage", () => {
    expect(listMockNotifications({ all: true })).toEqual(mockNotifications);

    window.localStorage.setItem(mockNotificationsKey, "{");
    expect(listMockNotifications({ all: true })).toEqual(mockNotifications);
  });

  it("preserves an explicitly stored empty notification list", () => {
    window.localStorage.setItem(mockNotificationsKey, JSON.stringify([]));

    expect(listMockNotifications({ all: true })).toEqual([]);
  });

  it("filters unread, participating, and limited notifications", () => {
    expect(listMockNotifications()).toEqual([mockNotifications[0]]);
    expect(listMockNotifications({ all: true, limit: 1 })).toEqual([mockNotifications[0]]);
    expect(listMockNotifications({ all: true, participating: true })).toEqual([mockNotifications[0]]);
  });

  it("marks a notification thread read and persists lastReadAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));

    markMockNotificationRead(mockNotifications[0].id);

    expect(listMockNotifications()).toEqual([]);
    expect(listMockNotifications({ all: true })[0]).toMatchObject({
      id: mockNotifications[0].id,
      unread: false,
      lastReadAt: "2026-05-20T12:00:00.000Z"
    });
  });

  it("unsubscribes only the matching notification thread", () => {
    unsubscribeMockNotification(mockNotifications[0].id);

    expect(listMockNotifications({ all: true }).map((notification) => notification.id)).toEqual([
      mockNotifications[1].id
    ]);
  });
});
