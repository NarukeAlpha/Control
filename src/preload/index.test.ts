import { beforeEach, describe, expect, it, vi } from "vitest";

import { contextBridge, ipcRenderer } from "electron";
import { githubIpcRouteChannels, ipcChannels, type ControlApi } from "@shared/ipc";

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
});
