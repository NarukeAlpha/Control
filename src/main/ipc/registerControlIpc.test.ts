import { describe, expect, it, vi } from "vitest";

import { ipcChannels } from "@shared/ipc";
import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import { createControlIpcRoutes, registerControlIpc } from "./registerControlIpc";

vi.mock("electron", () => ({
  shell: {
    openExternal: vi.fn()
  }
}));

function createStore(): LocalStore {
  return {
    updateSettings: vi.fn((settings) => settings),
    listPinnedRepositories: vi.fn(() => []),
    pinRepository: vi.fn(),
    unpinRepository: vi.fn(),
    listAreaRepositoryPins: vi.fn(() => []),
    pinAreaRepository: vi.fn(),
    unpinAreaRepository: vi.fn(),
    listRecentItems: vi.fn(() => []),
    addRecentItem: vi.fn()
  } as unknown as LocalStore;
}

function createGitHub(): GitHubProviderManager {
  return {
    createAppState: vi.fn(() => ({
      settings: { theme: "system", notificationsEnabled: true },
      accounts: [],
      selectedAccountId: null,
      github: { status: "signed-out", user: null }
    })),
    signInWithBrowser: vi.fn(),
    getGitHubSignInState: vi.fn(() => null),
    cancelWebSignIn: vi.fn(),
    clearToken: vi.fn(),
    getViewer: vi.fn(),
    listRepositories: vi.fn(),
    listRepositoriesWithStatus: vi.fn(),
    mutate: vi.fn(),
    getRepository: vi.fn(),
    getRepositoryWithStatus: vi.fn(),
    listOrganizationTeams: vi.fn()
  } as unknown as GitHubProviderManager;
}

function createIpcMain() {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      })
    }
  };
}

describe("registerControlIpc", () => {
  it("registers migrated control and GitHub routes without duplicating Effect pilot channels", () => {
    const routes = createControlIpcRoutes({ store: createStore(), github: createGitHub() });
    const channels = routes.map((route) => route.channel);

    expect(channels).toContain(ipcChannels.appState);
    expect(channels).toContain(ipcChannels.updateSettings);
    expect(channels).toContain(ipcChannels.githubRepositoryWithStatus);
    expect(channels).toContain(ipcChannels.githubRepositoriesWithStatus);
    expect(channels).toContain(ipcChannels.githubMutate);
    expect(channels).not.toContain(ipcChannels.githubRepository);
    expect(channels).not.toContain(ipcChannels.getSettings);
    expect(channels).not.toContain(ipcChannels.openExternal);
    expect(new Set(channels).size).toBe(channels.length);
  });

  it("validates local route input at the router seam before calling the store", async () => {
    const store = createStore();
    const github = createGitHub();
    const { ipcMain, handlers } = createIpcMain();

    registerControlIpc({
      ipcMain,
      store,
      github,
      effectBridge: { run: vi.fn() }
    });

    await expect(handlers.get(ipcChannels.pinRepository)?.(null, { nameWithOwner: " " })).rejects.toThrow(
      "Repository pins require an owner/repo name."
    );
    expect(store.pinRepository).not.toHaveBeenCalled();
  });

  it("validates GitHub repository input at the router seam before calling the provider", async () => {
    const store = createStore();
    const github = createGitHub();
    const { ipcMain, handlers } = createIpcMain();

    registerControlIpc({
      ipcMain,
      store,
      github,
      effectBridge: { run: vi.fn() }
    });

    await expect(
      handlers.get(ipcChannels.githubRepositoryWithStatus)?.(null, { owner: "openai" })
    ).rejects.toThrow("GitHub repository input requires a repo.");
    expect(github.getRepositoryWithStatus).not.toHaveBeenCalled();
  });

  it("normalizes migrated GitHub route input before calling the provider", async () => {
    const store = createStore();
    const github = createGitHub();
    const { ipcMain, handlers } = createIpcMain();

    registerControlIpc({
      ipcMain,
      store,
      github,
      effectBridge: { run: vi.fn() }
    });

    await handlers.get(ipcChannels.githubRepositoryWithStatus)?.(null, {
      owner: " openai ",
      repo: " codex ",
      cacheOnly: true
    });

    expect(github.getRepositoryWithStatus).toHaveBeenCalledWith({
      owner: "openai",
      repo: "codex",
      cacheOnly: true,
      forceRefresh: undefined
    });
  });
});
