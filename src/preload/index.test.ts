import { beforeEach, describe, expect, it, vi } from "vitest";

import { contextBridge, ipcRenderer } from "electron";
import { controlIpcEventChannels, githubIpcRouteChannels, ipcChannels, type ControlApi } from "@shared/ipc";

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}));

await import("./index");

const exposeInMainWorld = vi.mocked(contextBridge.exposeInMainWorld);
const invoke = vi.mocked(ipcRenderer.invoke);
const on = vi.mocked(ipcRenderer.on);
const removeListener = vi.mocked(ipcRenderer.removeListener);
const controlApi = exposeInMainWorld.mock.calls[0][1] as ControlApi;

describe("preload control bridge", () => {
  beforeEach(() => {
    invoke.mockReset();
    on.mockReset();
    removeListener.mockReset();
  });

  it("maps ControlApi calls through the invoke adapter", async () => {
    invoke.mockResolvedValueOnce({ credentialProvider: "github-oauth", glassMode: "solid" });
    await expect(controlApi.getSettings()).resolves.toEqual({
      credentialProvider: "github-oauth",
      glassMode: "solid"
    });
    expect(invoke).toHaveBeenCalledWith(ipcChannels.getSettings);

    invoke.mockResolvedValueOnce({ ok: true, action: "star", message: "ok" });
    await controlApi.github.mutate({ action: "star", owner: "owner", repo: "repo" });
    expect(invoke).toHaveBeenLastCalledWith(githubIpcRouteChannels.mutate, {
      action: "star",
      owner: "owner",
      repo: "repo"
    });
  });

  it("maps every GitHub preload route through the declared channel string", async () => {
    const input = { owner: "owner", repo: "repo", query: "repo:owner/repo", org: "org", teamSlug: "team" };

    for (const [key, channel] of Object.entries(githubIpcRouteChannels)) {
      invoke.mockClear();
      invoke.mockResolvedValueOnce(null);

      const method = controlApi.github[key as keyof typeof controlApi.github] as (
        value?: typeof input
      ) => Promise<unknown>;
      await method(input);

      if (key === "getViewer") {
        expect(invoke).toHaveBeenCalledWith(channel);
      } else {
        expect(invoke).toHaveBeenCalledWith(channel, input);
      }
    }
  });

  it("strips raw Electron events from renderer listeners and unsubscribes with the same listener", () => {
    const callback = vi.fn();
    const unsubscribe = controlApi.onGitHubAuthUpdated(callback);
    const listener = on.mock.calls[0][1];
    const payload = {
      available: true,
      authenticated: true,
      signInConfigured: true,
      user: "octocat",
      error: null
    };

    listener({ sender: "raw-event" } as unknown as Electron.IpcRendererEvent, payload);

    expect(on).toHaveBeenCalledWith(ipcChannels.githubAuthUpdated, listener);
    expect(callback).toHaveBeenCalledWith(payload);
    expect(callback).not.toHaveBeenCalledWith(expect.objectContaining({ sender: "raw-event" }), payload);

    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(ipcChannels.githubAuthUpdated, listener);
  });

  it("maps every declared event channel through payload-only preload listeners", () => {
    const listeners: Array<
      [keyof typeof controlIpcEventChannels, (callback: (payload: unknown) => void) => () => void]
    > = [
      [
        "githubRepositoriesUpdated",
        (callback) =>
          controlApi.onGitHubRepositoriesUpdated(
            callback as Parameters<ControlApi["onGitHubRepositoriesUpdated"]>[0]
          )
      ],
      [
        "githubAuthUpdated",
        (callback) =>
          controlApi.onGitHubAuthUpdated(callback as Parameters<ControlApi["onGitHubAuthUpdated"]>[0])
      ],
      [
        "areasUpdated",
        (callback) => controlApi.onAreasUpdated(callback as Parameters<ControlApi["onAreasUpdated"]>[0])
      ],
      [
        "areaRepositoryUpdated",
        (callback) =>
          controlApi.onAreaRepositoryUpdated(callback as Parameters<ControlApi["onAreaRepositoryUpdated"]>[0])
      ],
      [
        "areaWorkspaceUpdated",
        (callback) =>
          controlApi.onAreaWorkspaceUpdated(callback as Parameters<ControlApi["onAreaWorkspaceUpdated"]>[0])
      ]
    ];

    listeners.forEach(([key, subscribe]) => {
      on.mockClear();
      removeListener.mockClear();
      const callback = vi.fn();
      const unsubscribe = subscribe(callback);
      const listener = on.mock.calls[0][1];
      const payload = { kind: key };

      listener({ sender: "raw-event" } as unknown as Electron.IpcRendererEvent, payload);
      unsubscribe();

      expect(on).toHaveBeenCalledWith(controlIpcEventChannels[key], listener);
      expect(callback).toHaveBeenCalledWith(payload);
      expect(callback).not.toHaveBeenCalledWith(expect.objectContaining({ sender: "raw-event" }), payload);
      expect(removeListener).toHaveBeenCalledWith(controlIpcEventChannels[key], listener);
    });
  });
});
