import { describe, expect, it, vi } from "vitest";

import { ipcChannels } from "@shared/ipc";
import { mainToRendererEvents, sendMainToRendererEvent } from "./events";

describe("main IPC events", () => {
  it("declares main-to-renderer event channels once", () => {
    expect(
      Object.fromEntries(Object.entries(mainToRendererEvents).map(([key, route]) => [key, route.channel]))
    ).toEqual({
      githubRepositoriesUpdated: ipcChannels.githubRepositoriesUpdated,
      githubAuthUpdated: ipcChannels.githubAuthUpdated,
      areasUpdated: ipcChannels.areasUpdated,
      areaRepositoryUpdated: ipcChannels.areaRepositoryUpdated,
      areaWorkspaceUpdated: ipcChannels.areaWorkspaceUpdated
    });
  });

  it("sends parsed payloads through the route catalog", () => {
    const webContents = { send: vi.fn() };

    sendMainToRendererEvent(webContents, "githubRepositoriesUpdated", { nameWithOwner: "owner/repo" });

    expect(webContents.send).toHaveBeenCalledWith(ipcChannels.githubRepositoriesUpdated, {
      nameWithOwner: "owner/repo"
    });
  });

  it("does nothing when no window is available", () => {
    expect(() =>
      sendMainToRendererEvent(undefined, "githubRepositoriesUpdated", { nameWithOwner: null })
    ).not.toThrow();
  });
});
