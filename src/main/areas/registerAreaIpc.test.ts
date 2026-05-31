import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AreaManager } from "./areaManager";
import { ipcChannels } from "@shared/ipc";

const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
const showOpenDialog = vi.fn();

vi.mock("electron", () => ({
  dialog: {
    showOpenDialog
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    })
  }
}));

function createAreaManager(): AreaManager {
  return {
    listAreas: vi.fn(() => []),
    getArea: vi.fn(),
    selectArea: vi.fn(() => []),
    createLocalArea: vi.fn(),
    createSshArea: vi.fn(),
    updateArea: vi.fn(),
    removeArea: vi.fn(() => []),
    refreshArea: vi.fn(),
    searchAreas: vi.fn(() => ({ areas: [], repositories: [], workspaces: [] })),
    listRepositories: vi.fn(() => []),
    getRepository: vi.fn(),
    listContents: vi.fn(() => []),
    getFileContent: vi.fn(),
    searchFilePaths: vi.fn(),
    listBranches: vi.fn(() => []),
    listRemotes: vi.fn(() => []),
    getStatus: vi.fn(),
    listActivity: vi.fn(() => []),
    listWorkspaces: vi.fn(() => []),
    getWorkspace: vi.fn(),
    getGitHubRepository: vi.fn(),
    listGitHubIssues: vi.fn(() => ({ items: [], availability: { status: "available", message: null } })),
    listGitHubPullRequests: vi.fn(() => ({
      items: [],
      availability: { status: "available", message: null }
    })),
    listGitHubActions: vi.fn(() => ({ items: [], availability: { status: "available", message: null } })),
    listGitHubReleases: vi.fn(() => ({ items: [], availability: { status: "available", message: null } })),
    listGitHubContributors: vi.fn(() => ({
      items: [],
      availability: { status: "available", message: null }
    })),
    getSyncStatus: vi.fn(),
    prepareGatewayOperation: vi.fn(),
    runGatewayOperation: vi.fn(),
    stopGateway: vi.fn(),
    repairGateway: vi.fn(),
    rotateGatewayCredentials: vi.fn(),
    restartGateway: vi.fn()
  } as unknown as AreaManager;
}

async function loadRegisteredHandlers(areaManager = createAreaManager()): Promise<AreaManager> {
  const { registerAreaIpc } = await import("./registerAreaIpc");
  registerAreaIpc(areaManager);
  return areaManager;
}

function handler(channel: string): (...args: unknown[]) => unknown {
  const registered = ipcHandlers.get(channel);
  if (!registered) {
    throw new Error(`Missing IPC handler for ${channel}.`);
  }
  return registered;
}

describe("registerAreaIpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    ipcHandlers.clear();
  });

  it("validates and trims area id handler input before calling the manager", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areasGet)(null, " local:workspace ");

    expect(areaManager.getArea).toHaveBeenCalledWith("local:workspace");

    await expect(handler(ipcChannels.areasGet)(null, "   ")).rejects.toThrow(
      "Area IPC input requires a non-empty string."
    );
    expect(areaManager.getArea).toHaveBeenCalledTimes(1);
  });

  it("normalizes create local area input before calling the manager", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areasCreateLocal)(null, {
      rootPath: " /Users/example/project ",
      label: " Work "
    });

    expect(areaManager.createLocalArea).toHaveBeenCalledWith({
      rootPath: "/Users/example/project",
      label: "Work"
    });
  });

  it("normalizes create SSH area input before calling the manager", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areasCreateSsh)(null, {
      host: " delta-wsl ",
      rootPath: " ~/controltest ",
      label: " Delta ",
      username: " gabriel ",
      port: 2222
    });

    expect(areaManager.createSshArea).toHaveBeenCalledWith({
      host: "delta-wsl",
      rootPath: "~/controltest",
      label: "Delta",
      username: "gabriel",
      port: 2222
    });
  });

  it("normalizes update area input before calling the manager", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areasUpdate)(null, {
      areaId: " ssh:delta ",
      label: " Delta ",
      host: " delta-wsl ",
      rootPath: " ~/controltest ",
      username: " alpha ",
      port: 2222
    });

    expect(areaManager.updateArea).toHaveBeenCalledWith({
      areaId: "ssh:delta",
      label: "Delta",
      host: "delta-wsl",
      rootPath: "~/controltest",
      username: "alpha",
      port: 2222
    });
  });

  it("defaults optional area search fields while preserving numeric limits", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areasSearch)(null, {});
    handler(ipcChannels.areasSearch)(null, { query: "repo", limit: 10 });

    expect(areaManager.searchAreas).toHaveBeenNthCalledWith(1, {
      query: "",
      limit: undefined
    });
    expect(areaManager.searchAreas).toHaveBeenNthCalledWith(2, {
      query: "repo",
      limit: 10
    });
  });

  it("validates repository input and normalizes optional workspace ids", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areaRepository)(null, {
      areaId: " local ",
      repositoryId: " repo ",
      workspaceId: " workspace "
    });
    handler(ipcChannels.areaRepository)(null, {
      areaId: "local",
      repositoryId: "repo",
      workspaceId: "   "
    });

    expect(areaManager.getRepository).toHaveBeenNthCalledWith(1, {
      areaId: "local",
      repositoryId: "repo",
      workspaceId: "workspace"
    });
    expect(areaManager.getRepository).toHaveBeenNthCalledWith(2, {
      areaId: "local",
      repositoryId: "repo",
      workspaceId: null
    });
  });

  it("requires file content paths before calling the manager", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areaFileContent)(null, {
      areaId: "local",
      repositoryId: "repo",
      path: " README.md "
    });

    expect(areaManager.getFileContent).toHaveBeenCalledWith({
      areaId: "local",
      repositoryId: "repo",
      workspaceId: null,
      path: "README.md"
    });

    await expect(
      handler(ipcChannels.areaFileContent)(null, {
        areaId: "local",
        repositoryId: "repo",
        path: " "
      })
    ).rejects.toThrow("Area IPC input requires a non-empty string.");
    expect(areaManager.getFileContent).toHaveBeenCalledTimes(1);
  });

  it("normalizes file path search payloads", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areaFilePathSearch)(null, {
      areaId: " local ",
      repositoryId: " repo ",
      workspaceId: " workspace ",
      query: " Search ",
      limit: 12.8
    });
    handler(ipcChannels.areaFilePathSearch)(null, {
      areaId: "local",
      repositoryId: "repo",
      query: 42,
      limit: "ignored"
    });

    expect(areaManager.searchFilePaths).toHaveBeenNthCalledWith(1, {
      areaId: "local",
      repositoryId: "repo",
      workspaceId: "workspace",
      query: "Search",
      limit: 12.8
    });
    expect(areaManager.searchFilePaths).toHaveBeenNthCalledWith(2, {
      areaId: "local",
      repositoryId: "repo",
      workspaceId: null,
      query: "",
      limit: undefined
    });
  });

  it("normalizes workspace lookup payloads", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areaWorkspace)(null, {
      areaId: " local ",
      workspaceId: " workspace "
    });

    expect(areaManager.getWorkspace).toHaveBeenCalledWith({
      areaId: "local",
      workspaceId: "workspace"
    });
  });

  it("normalizes Area GitHub repository enrichment payloads", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areaGitHubRepository)(null, {
      areaId: " local ",
      repositoryId: " repo ",
      workspaceId: " workspace ",
      cacheOnly: true,
      forceRefresh: false
    });

    expect(areaManager.getGitHubRepository).toHaveBeenCalledWith({
      areaId: "local",
      repositoryId: "repo",
      workspaceId: "workspace",
      cacheOnly: true,
      forceRefresh: false
    });
    await expect(
      handler(ipcChannels.areaGitHubRepository)(null, {
        areaId: "local",
        repositoryId: " "
      })
    ).rejects.toThrow("Area IPC input requires a non-empty string.");
    expect(areaManager.getGitHubRepository).toHaveBeenCalledTimes(1);
  });

  it("normalizes Area GitHub list enrichment payloads", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areaGitHubIssues)(null, {
      areaId: " local ",
      repositoryId: " repo ",
      workspaceId: " ",
      state: "merged",
      limit: 12,
      cacheOnly: false,
      forceRefresh: true
    });
    handler(ipcChannels.areaGitHubPullRequests)(null, {
      areaId: "local",
      repositoryId: "repo",
      state: "closed"
    });
    handler(ipcChannels.areaGitHubActions)(null, {
      areaId: "local",
      repositoryId: "repo",
      limit: 5
    });

    expect(areaManager.listGitHubIssues).toHaveBeenCalledWith({
      areaId: "local",
      repositoryId: "repo",
      workspaceId: null,
      state: undefined,
      limit: 12,
      cacheOnly: false,
      forceRefresh: true
    });
    expect(areaManager.listGitHubPullRequests).toHaveBeenCalledWith({
      areaId: "local",
      repositoryId: "repo",
      workspaceId: null,
      state: "closed",
      limit: undefined,
      cacheOnly: undefined,
      forceRefresh: undefined
    });
    expect(areaManager.listGitHubActions).toHaveBeenCalledWith({
      areaId: "local",
      repositoryId: "repo",
      workspaceId: null,
      limit: 5,
      cacheOnly: undefined,
      forceRefresh: undefined
    });
  });

  it("normalizes gateway sync and operation payloads", async () => {
    const areaManager = await loadRegisteredHandlers();

    handler(ipcChannels.areaSyncStatus)(null, {
      areaId: " ssh ",
      repositoryId: " repo ",
      workspaceId: " workspace "
    });
    handler(ipcChannels.areaPrepareGatewayOperation)(null, {
      areaId: "ssh",
      repositoryId: "repo",
      kind: "jj.git.fetch",
      arguments: { remote: "origin", nested: { ignored: true } }
    });
    handler(ipcChannels.areaRunGatewayOperation)(null, {
      areaId: " ssh ",
      operationId: " op ",
      confirmed: true
    });
    handler(ipcChannels.areaStopGateway)(null, { areaId: " ssh " });
    handler(ipcChannels.areaRepairGateway)(null, { areaId: " ssh " });
    handler(ipcChannels.areaRotateGatewayCredentials)(null, { areaId: " ssh " });
    handler(ipcChannels.areaRestartGateway)(null, { areaId: " ssh " });

    expect(areaManager.getSyncStatus).toHaveBeenCalledWith({
      areaId: "ssh",
      repositoryId: "repo",
      workspaceId: "workspace"
    });
    expect(areaManager.prepareGatewayOperation).toHaveBeenCalledWith({
      areaId: "ssh",
      repositoryId: "repo",
      workspaceId: null,
      kind: "jj.git.fetch",
      arguments: { remote: "origin" }
    });
    expect(areaManager.runGatewayOperation).toHaveBeenCalledWith({
      areaId: "ssh",
      operationId: "op",
      confirmed: true
    });
    expect(areaManager.stopGateway).toHaveBeenCalledWith({ areaId: "ssh" });
    expect(areaManager.repairGateway).toHaveBeenCalledWith({ areaId: "ssh" });
    expect(areaManager.rotateGatewayCredentials).toHaveBeenCalledWith({ areaId: "ssh" });
    expect(areaManager.restartGateway).toHaveBeenCalledWith({ areaId: "ssh" });
  });

  it("returns a selected folder path or null from the local folder picker", async () => {
    await loadRegisteredHandlers();
    showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ["/tmp/project"] });
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: ["/tmp/ignored"] });

    await expect(handler(ipcChannels.areaOpenLocalFolderPicker)()).resolves.toBe("/tmp/project");
    await expect(handler(ipcChannels.areaOpenLocalFolderPicker)()).resolves.toBeNull();

    expect(showOpenDialog).toHaveBeenCalledWith({ properties: ["openDirectory"] });
  });
});
