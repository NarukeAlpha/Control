import { describe, expect, it, vi } from "vitest";

import { githubIpcRouteChannels, ipcChannels } from "@shared/ipc";
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
    getIssueDetailWithStatus: vi.fn(),
    listIssuesWithStatus: vi.fn(),
    listPullRequestFilesWithStatus: vi.fn(),
    getDiscussionDetail: vi.fn(),
    getWorkflowRunDetailWithStatus: vi.fn(),
    getWorkflowJobLogs: vi.fn(),
    getBranchProtection: vi.fn(),
    getFileContentWithStatus: vi.fn(),
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

  it("registers every declared GitHub route-map channel exactly once", () => {
    const routes = createControlIpcRoutes({ store: createStore(), github: createGitHub() });
    const channels = routes.map((route) => route.channel);

    Object.values(githubIpcRouteChannels).forEach((channel) => {
      expect(channels.filter((registeredChannel) => registeredChannel === channel)).toHaveLength(1);
    });
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

  it("validates pull-request subresource input before calling the provider", async () => {
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
      handlers.get(ipcChannels.githubPullRequestFilesWithStatus)?.(null, {
        owner: "openai",
        repo: "codex",
        pullNumber: 0
      })
    ).rejects.toThrow("GitHub pull request input requires a number.");
    expect(github.listPullRequestFilesWithStatus).not.toHaveBeenCalled();

    await handlers.get(ipcChannels.githubPullRequestFilesWithStatus)?.(null, {
      owner: " openai ",
      repo: " codex ",
      pullNumber: 12,
      limit: 25,
      cursor: null,
      cacheOnly: false
    });

    expect(github.listPullRequestFilesWithStatus).toHaveBeenCalledWith({
      owner: "openai",
      repo: "codex",
      pullNumber: 12,
      cacheOnly: false,
      forceRefresh: undefined,
      limit: 25,
      cursor: null
    });
  });

  it("validates issue detail input before calling the provider", async () => {
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
      handlers.get(ipcChannels.githubIssueDetailWithStatus)?.(null, {
        owner: "openai",
        repo: "codex",
        issueNumber: -1
      })
    ).rejects.toThrow("GitHub issue input requires a number.");
    expect(github.getIssueDetailWithStatus).not.toHaveBeenCalled();

    await handlers.get(ipcChannels.githubIssueDetailWithStatus)?.(null, {
      owner: " openai ",
      repo: " codex ",
      issueNumber: 42,
      forceRefresh: true
    });

    expect(github.getIssueDetailWithStatus).toHaveBeenCalledWith({
      owner: "openai",
      repo: "codex",
      issueNumber: 42,
      cacheOnly: undefined,
      forceRefresh: true
    });
  });

  it("validates migrated route-specific GitHub read fields", async () => {
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
      handlers.get(ipcChannels.githubFileContentWithStatus)?.(null, {
        owner: "openai",
        repo: "codex",
        path: " "
      })
    ).rejects.toThrow("GitHub file input requires a path.");
    await expect(
      handlers.get(ipcChannels.githubDiscussionDetail)?.(null, {
        owner: "openai",
        repo: "codex",
        discussionNumber: 0
      })
    ).rejects.toThrow("GitHub discussion input requires a number.");
    await expect(
      handlers.get(ipcChannels.githubWorkflowRunDetailWithStatus)?.(null, {
        owner: "openai",
        repo: "codex",
        runId: "123"
      })
    ).rejects.toThrow("GitHub workflow run input requires a run id.");
    await expect(
      handlers.get(ipcChannels.githubWorkflowJobLogs)?.(null, {
        owner: "openai",
        repo: "codex",
        jobId: 12,
        maxCharacters: 0
      })
    ).rejects.toThrow("GitHub maxCharacters must be a positive integer.");
    await expect(
      handlers.get(ipcChannels.githubBranchProtection)?.(null, {
        owner: "openai",
        repo: "codex"
      })
    ).rejects.toThrow("GitHub branch protection input requires a branch.");
    await expect(
      handlers.get(ipcChannels.githubIssuesWithStatus)?.(null, {
        owner: "openai",
        repo: "codex",
        state: "triaged"
      })
    ).rejects.toThrow("GitHub state is not supported.");

    expect(github.getFileContentWithStatus).not.toHaveBeenCalled();
    expect(github.getDiscussionDetail).not.toHaveBeenCalled();
    expect(github.getWorkflowRunDetailWithStatus).not.toHaveBeenCalled();
    expect(github.getWorkflowJobLogs).not.toHaveBeenCalled();
    expect(github.getBranchProtection).not.toHaveBeenCalled();
    expect(github.listIssuesWithStatus).not.toHaveBeenCalled();

    await handlers.get(ipcChannels.githubWorkflowJobLogs)?.(null, {
      owner: " openai ",
      repo: " codex ",
      jobId: 12,
      maxCharacters: 1000,
      cacheOnly: true
    });

    expect(github.getWorkflowJobLogs).toHaveBeenCalledWith({
      owner: "openai",
      repo: "codex",
      jobId: 12,
      maxCharacters: 1000,
      cacheOnly: true,
      forceRefresh: undefined
    });
  });
});
