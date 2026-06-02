import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { AreaRepositoryDetail, AreaSummary, AreaWorkspaceSummary } from "@shared/areas";
import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import { AreaManager } from "./areaManager";

const now = "2026-05-16T00:00:00.000Z";
const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "control-area-manager-"));
  tempDirs.push(root);
  return root;
}

function createRepositoryDetail(connection: AreaRepositoryDetail["connection"]): AreaRepositoryDetail {
  return {
    id: "repo:local-control",
    areaId: "local:workspace",
    kind: "jj",
    name: "Control",
    owner: null,
    displayName: "Control",
    path: "/work/Control",
    defaultBranch: null,
    currentBranch: null,
    isDirty: false,
    isPrivate: null,
    description: null,
    connection,
    capabilities: {
      supportsBranches: false,
      supportsBookmarks: true,
      supportsWorkspaces: true,
      supportsOperationLog: true,
      supportsSparse: true,
      isGitBacked: true,
      isColocated: true,
      supportsGitHubEnrichment: Boolean(connection)
    },
    health: { status: "ready", message: null, checkedAt: now },
    updatedAt: now,
    scannedAt: now,
    remotes: [],
    branches: [],
    bookmarks: [],
    tags: [],
    status: {
      clean: true,
      dirtyCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      ahead: null,
      behind: null,
      entries: []
    },
    recentCommits: [],
    recentOperations: [],
    readme: null,
    workspaces: []
  };
}

function createStore(
  repository: AreaRepositoryDetail | null,
  overrides: Partial<LocalStore> = {}
): LocalStore {
  return {
    ensureDefaultGitHubArea: vi.fn(),
    getArea: vi.fn(),
    listAreas: vi.fn(() => []),
    listAreaRepositories: vi.fn(() => []),
    getAreaRepository: vi.fn(() => repository),
    listAreaWorkspaces: vi.fn(() => []),
    replaceAreaReadModels: vi.fn(),
    upsertArea: vi.fn(),
    getAreaGateway: vi.fn(() => null),
    setAreaGateway: vi.fn(),
    ...overrides
  } as unknown as LocalStore;
}

function createGithub(): GitHubProviderManager {
  return {
    createAppState: vi.fn(),
    getRepositoryWithStatus: vi.fn(async () => ({
      detail: null,
      availability: { status: "available", message: null }
    })),
    listIssuesWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null }
    })),
    listPullRequestsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null }
    })),
    listActionsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null }
    })),
    listReleasesWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null }
    })),
    listContributorsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null }
    }))
  } as unknown as GitHubProviderManager;
}

function createAreaManager(
  repository: AreaRepositoryDetail | null,
  github = createGithub(),
  storeOverrides: Partial<LocalStore> = {},
  gateway: ConstructorParameters<typeof AreaManager>[3] = null
): AreaManager {
  return new AreaManager(
    createStore(repository, storeOverrides),
    github,
    {
      onAreasUpdated: vi.fn(),
      onAreaRepositoryUpdated: vi.fn(),
      onAreaWorkspaceUpdated: vi.fn()
    },
    gateway
  );
}

function createArea(id: string, kind: AreaSummary["kind"] = "local"): AreaSummary {
  return {
    id,
    kind,
    label: id,
    subtitle: null,
    rootPath: kind === "github" ? null : `/work/${id}`,
    accountLogin: null,
    health: { status: "ready", message: null, checkedAt: now },
    repositoryCount: 1,
    selected: false,
    createdAt: now,
    updatedAt: now
  };
}

function createWorkspace(input: {
  id: string;
  areaId: string;
  repositoryId: string;
  name: string;
  rootPath: string;
}): AreaWorkspaceSummary {
  return {
    id: input.id,
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    name: input.name,
    rootPath: input.rootPath,
    workingCopyChangeId: null,
    workingCopyCommitId: null,
    isStale: false,
    sparseSummary: null,
    health: { status: "ready", message: null, checkedAt: now },
    updatedAt: now,
    scannedAt: now
  };
}

describe("AreaManager GitHub enrichment", () => {
  it("delegates connected local repositories through the GitHub provider", async () => {
    const github = createGithub();
    const repository = createRepositoryDetail({
      owner: "NarukeAlpha",
      repo: "Control",
      nameWithOwner: "NarukeAlpha/Control",
      remoteName: "origin",
      remoteUrl: "git@github.com:NarukeAlpha/Control.git",
      url: "https://github.com/NarukeAlpha/Control",
      matchedGitHubAreaId: "github:default",
      status: "connected",
      lastCheckedAt: now,
      lastError: null
    });
    const areaManager = createAreaManager(repository, github);

    await areaManager.listGitHubIssues({
      areaId: "local:workspace",
      repositoryId: "repo:local-control",
      state: "open",
      limit: 12,
      cacheOnly: true
    });

    expect(github.listIssuesWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "Control",
      state: "open",
      limit: 12,
      cacheOnly: true,
      forceRefresh: undefined
    });
  });

  it("returns unavailable GitHub enrichment without provider calls for unconnected repositories", async () => {
    const github = createGithub();
    const areaManager = createAreaManager(createRepositoryDetail(null), github);

    await expect(
      areaManager.listGitHubPullRequests({
        areaId: "local:workspace",
        repositoryId: "repo:local-control",
        state: "open"
      })
    ).resolves.toEqual({
      items: [],
      availability: {
        status: "not_loaded",
        message: "This local repository is not connected to a GitHub Area."
      }
    });
    expect(github.listPullRequestsWithStatus).not.toHaveBeenCalled();
  });

  it("treats unmatched GitHub remotes as unavailable enrichment", async () => {
    const github = createGithub();
    const repository = createRepositoryDetail({
      owner: "NarukeAlpha",
      repo: "Control",
      nameWithOwner: "NarukeAlpha/Control",
      remoteName: "origin",
      remoteUrl: "git@github.com:NarukeAlpha/Control.git",
      url: "https://github.com/NarukeAlpha/Control",
      matchedGitHubAreaId: null,
      status: "unmatched",
      lastCheckedAt: now,
      lastError: null
    });
    const areaManager = createAreaManager(repository, github);

    await expect(
      areaManager.listGitHubIssues({
        areaId: "local:workspace",
        repositoryId: "repo:local-control"
      })
    ).resolves.toEqual({
      items: [],
      availability: {
        status: "not_loaded",
        message: "This local repository is not connected to a GitHub Area."
      }
    });
    expect(github.listIssuesWithStatus).not.toHaveBeenCalled();
  });

  it("passes through provider availability for unreachable and unauthenticated GitHub Areas", async () => {
    const github = createGithub();
    vi.mocked(github.listIssuesWithStatus).mockResolvedValueOnce({
      items: [],
      availability: { status: "offline", message: "GitHub is unreachable." }
    });
    vi.mocked(github.listPullRequestsWithStatus).mockResolvedValueOnce({
      items: [],
      availability: { status: "not_loaded", message: "Sign in to GitHub first." }
    });
    const repository = createRepositoryDetail({
      owner: "NarukeAlpha",
      repo: "Control",
      nameWithOwner: "NarukeAlpha/Control",
      remoteName: "origin",
      remoteUrl: "git@github.com:NarukeAlpha/Control.git",
      url: "https://github.com/NarukeAlpha/Control",
      matchedGitHubAreaId: "github:default",
      status: "connected",
      lastCheckedAt: now,
      lastError: null
    });
    const areaManager = createAreaManager(repository, github);

    await expect(
      areaManager.listGitHubIssues({
        areaId: "local:workspace",
        repositoryId: "repo:local-control"
      })
    ).resolves.toEqual({
      items: [],
      availability: { status: "offline", message: "GitHub is unreachable." }
    });
    await expect(
      areaManager.listGitHubPullRequests({
        areaId: "local:workspace",
        repositoryId: "repo:local-control"
      })
    ).resolves.toEqual({
      items: [],
      availability: { status: "not_loaded", message: "Sign in to GitHub first." }
    });
  });

  it("exposes all connected GitHub enrichment collections through AreaManager", async () => {
    const github = createGithub();
    const repository = createRepositoryDetail({
      owner: "NarukeAlpha",
      repo: "Control",
      nameWithOwner: "NarukeAlpha/Control",
      remoteName: "origin",
      remoteUrl: "https://github.com/NarukeAlpha/Control.git",
      url: "https://github.com/NarukeAlpha/Control",
      matchedGitHubAreaId: "github:default",
      status: "connected",
      lastCheckedAt: now,
      lastError: null
    });
    const areaManager = createAreaManager(repository, github);
    const input = { areaId: "local:workspace", repositoryId: "repo:local-control", limit: 5 };

    await areaManager.getGitHubRepository(input);
    await areaManager.listGitHubActions(input);
    await areaManager.listGitHubReleases(input);
    await areaManager.listGitHubContributors(input);

    expect(github.getRepositoryWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "Control",
      cacheOnly: undefined,
      forceRefresh: undefined
    });
    expect(github.listActionsWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "NarukeAlpha", repo: "Control", limit: 5 })
    );
    expect(github.listReleasesWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "NarukeAlpha", repo: "Control", limit: 5 })
    );
    expect(github.listContributorsWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "NarukeAlpha", repo: "Control", limit: 5 })
    );
  });
});

describe("AreaManager gateway lifecycle", () => {
  it("rejects unconfirmed gateway operation runs before resolving the gateway client", async () => {
    const gateway = {
      getClient: vi.fn()
    };
    const areaManager = createAreaManager(null, createGithub(), {}, gateway as never);

    await expect(
      areaManager.runGatewayOperation({
        areaId: "local:workspace",
        operationId: "operation:fetch",
        confirmed: false
      })
    ).rejects.toThrow("Gateway operation confirmation is required.");

    expect(gateway.getClient).not.toHaveBeenCalled();
  });

  it("runs confirmed gateway operations through the gateway client", async () => {
    const operationResult = {
      id: "operation:fetch",
      areaId: "local:workspace",
      repositoryId: "repo:local-control",
      kind: "git.fetch" as const,
      status: "succeeded" as const,
      message: "Fetch complete.",
      stdout: null,
      stderr: null,
      recoveryOperationId: null,
      completedAt: now
    };
    const gatewayClient = {
      runOperation: vi.fn(async () => operationResult)
    };
    const gateway = {
      getClient: vi.fn(async () => gatewayClient)
    };
    const area = createArea("local:workspace");
    const areaManager = createAreaManager(
      null,
      createGithub(),
      {
        getArea: vi.fn((areaId) => (areaId === area.id ? area : null)),
        getAreaRepository: vi.fn(() => null)
      },
      gateway as never
    );
    const input = {
      areaId: area.id,
      operationId: "operation:fetch",
      confirmed: true
    };

    await expect(areaManager.runGatewayOperation(input)).resolves.toEqual(operationResult);

    expect(gateway.getClient).toHaveBeenCalledWith(area.id);
    expect(gatewayClient.runOperation).toHaveBeenCalledWith(input);
  });

  it("preserves existing local read models when staged local refresh fails", async () => {
    const area = createArea("local:workspace");
    const replaceAreaReadModels = vi.fn();
    const upsertArea = vi.fn();
    const areaManager = createAreaManager(null, createGithub(), {
      getArea: vi.fn((areaId) => {
        if (areaId === area.id) {
          return area;
        }
        throw new Error("repository metadata read failed");
      }),
      replaceAreaReadModels,
      upsertArea
    });

    await areaManager.refreshArea(area.id);

    expect(replaceAreaReadModels).not.toHaveBeenCalled();
    expect(upsertArea).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: area.id,
        health: expect.objectContaining({ status: "error", message: "repository metadata read failed" })
      })
    );
  });

  it("keeps gateway failure separate when local gateway refresh falls back to local reads", async () => {
    const area = createArea("local:workspace");
    const gatewayRecord = {
      areaId: area.id,
      rootPath: area.rootPath ?? "",
      transport: "local" as const,
      host: null,
      username: null,
      port: null,
      apiUrl: "http://127.0.0.1:4580",
      adminUrl: "http://127.0.0.1:4581",
      serviceName: "control-gateway-local-workspace",
      version: "0.1.0",
      status: "ready" as const,
      pid: 42,
      processId: 42,
      failureCode: null,
      message: null,
      installedAt: now,
      lastStartedAt: now,
      lastSeenAt: now,
      updatedAt: now
    };
    const replaceAreaReadModels = vi.fn();
    const setAreaGateway = vi.fn();
    const areaManager = createAreaManager(
      null,
      createGithub(),
      {
        getArea: vi.fn((areaId) => (areaId === area.id ? area : null)),
        getAreaGateway: vi.fn(() => gatewayRecord),
        setAreaGateway,
        replaceAreaReadModels
      },
      {
        ensureAreaGateway: vi.fn(async () => {
          throw new Error("gateway offline");
        })
      } as never
    );

    await expect(areaManager.refreshArea(area.id)).resolves.toMatchObject({
      health: {
        status: "ready",
        message: null
      }
    });

    expect(setAreaGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        failureCode: "gateway-unreachable",
        message: "gateway offline"
      })
    );
    expect(replaceAreaReadModels).toHaveBeenCalledWith({
      areaId: area.id,
      repositories: [],
      workspaces: []
    });
  });

  it("does not update gateway configuration when stopping the existing gateway fails", async () => {
    const root = makeTempRoot();
    const area = createArea("local:workspace");
    const updateArea = vi.fn();
    const gateway = {
      stopGateway: vi.fn(async () => {
        throw new Error("stop failed");
      })
    };
    const areaManager = createAreaManager(
      null,
      createGithub(),
      {
        getArea: vi.fn(() => area),
        getAreaGateway: vi.fn(() => ({
          areaId: area.id,
          rootPath: area.rootPath ?? "",
          transport: "local" as const,
          host: null,
          username: null,
          port: null,
          apiUrl: "http://127.0.0.1:4580",
          adminUrl: "http://127.0.0.1:4581",
          serviceName: "control-gateway-local-workspace",
          version: "0.1.0",
          status: "ready" as const,
          pid: 42,
          processId: 42,
          failureCode: null,
          message: null,
          installedAt: now,
          lastStartedAt: now,
          lastSeenAt: now,
          updatedAt: now
        })),
        updateArea
      },
      gateway as never
    );

    await expect(areaManager.updateArea({ areaId: area.id, rootPath: root })).rejects.toThrow("stop failed");
    expect(updateArea).not.toHaveBeenCalled();
  });

  it("clears gateway runtime state before removing a gateway Area", async () => {
    const area = createArea("local:workspace");
    const removeArea = vi.fn();
    const clearAreaGateway = vi.fn(async () => undefined);
    const areaManager = createAreaManager(
      null,
      createGithub(),
      {
        getArea: vi.fn(() => area),
        removeArea,
        listAreas: vi.fn(() => [])
      },
      { clearAreaGateway } as never
    );

    await expect(areaManager.removeArea(area.id)).resolves.toEqual([]);

    expect(clearAreaGateway).toHaveBeenCalledWith(area.id);
    expect(removeArea).toHaveBeenCalledWith(area.id);
    expect(clearAreaGateway.mock.invocationCallOrder[0]).toBeLessThan(removeArea.mock.invocationCallOrder[0]);
  });
});

describe("AreaManager search", () => {
  it("searches workspaces across all Areas independently of repository matches", () => {
    const areas = [createArea("local:alpha"), createArea("local:beta")];
    const alphaRepository = createRepositoryDetail(null);
    const betaRepository = {
      ...createRepositoryDetail(null),
      id: "repo:beta",
      areaId: "local:beta",
      name: "Beta",
      displayName: "Beta",
      path: "/work/beta"
    };
    const matchingWorkspace = createWorkspace({
      id: "workspace:matching",
      areaId: "local:beta",
      repositoryId: "repo:beta",
      name: "Search Workspace",
      rootPath: "/work/beta/search-workspace"
    });
    const areaManager = createAreaManager(null, createGithub(), {
      listAreas: vi.fn(() => areas),
      listAreaRepositories: vi.fn(({ areaId }) =>
        areaId === "local:alpha" ? [alphaRepository] : [betaRepository]
      ),
      listAreaWorkspaces: vi.fn(({ areaId }) => (areaId === "local:beta" ? [matchingWorkspace] : []))
    });

    expect(areaManager.searchAreas({ query: "workspace", limit: 1 })).toEqual({
      areas: [],
      repositories: [],
      workspaces: [matchingWorkspace]
    });
  });

  it("searches local file paths with a local scanner even when a gateway exists", async () => {
    const root = makeTempRoot();
    writeFileSync(join(root, "SearchResult.ts"), "");
    const repository = { ...createRepositoryDetail(null), path: root };
    const gateway = {
      getClient: vi.fn(() => ({
        searchFilePaths: vi.fn(async () => {
          throw new Error("Gateway search should not be used for local roots.");
        })
      }))
    };
    const areaManager = createAreaManager(
      repository,
      createGithub(),
      {
        getArea: vi.fn(() => createArea("local:workspace")),
        getAreaRepository: vi.fn(() => repository)
      },
      gateway as never
    );

    const result = await areaManager.searchFilePaths({
      areaId: "local:workspace",
      repositoryId: "repo:local-control",
      query: "search",
      limit: 100
    });

    expect(result.matches.map((match) => match.path)).toEqual(["SearchResult.ts"]);
    expect(result.availability.status).toBe("complete");
    expect(gateway.getClient).not.toHaveBeenCalled();
  });

  it("uses the resolved workspace root when workspaceId is present", async () => {
    const root = makeTempRoot();
    const workspaceRoot = join(root, "workspace");
    mkdirSync(workspaceRoot, { recursive: true });
    writeFileSync(join(root, "repository-search.ts"), "");
    writeFileSync(join(workspaceRoot, "workspace-search.ts"), "");
    const repository = { ...createRepositoryDetail(null), path: root };
    const workspace = createWorkspace({
      id: "workspace:one",
      areaId: "local:workspace",
      repositoryId: repository.id,
      name: "One",
      rootPath: workspaceRoot
    });
    const areaManager = createAreaManager(repository, createGithub(), {
      getArea: vi.fn(() => createArea("local:workspace")),
      getAreaRepository: vi.fn(() => repository),
      getAreaWorkspace: vi.fn(() => ({
        ...workspace,
        fileTree: [],
        readme: null,
        status: repository.status
      }))
    });

    const result = await areaManager.searchFilePaths({
      areaId: "local:workspace",
      repositoryId: repository.id,
      workspaceId: workspace.id,
      query: "search"
    });

    expect(result.workspaceId).toBe(workspace.id);
    expect(result.matches.map((match) => match.path)).toEqual(["workspace-search.ts"]);
  });

  it("returns typed unavailable results for blank, missing, and gateway-only file searches", async () => {
    const areaManager = createAreaManager(null, createGithub(), {
      getArea: vi.fn((areaId) => (areaId === "ssh:remote" ? createArea("ssh:remote", "ssh") : null)),
      getAreaRepository: vi.fn(() => null)
    });

    await expect(
      areaManager.searchFilePaths({
        areaId: "local:missing",
        repositoryId: "repo:missing",
        query: "   "
      })
    ).resolves.toMatchObject({
      query: "",
      matches: [],
      availability: { status: "unavailable", message: "Enter a file name to search." }
    });
    await expect(
      areaManager.searchFilePaths({
        areaId: "local:missing",
        repositoryId: "repo:missing",
        query: "readme"
      })
    ).resolves.toMatchObject({
      matches: [],
      availability: { status: "unavailable", message: "Area was not found." }
    });
    await expect(
      areaManager.searchFilePaths({
        areaId: "ssh:remote",
        repositoryId: "repo:remote",
        query: "readme"
      })
    ).resolves.toMatchObject({
      matches: [],
      availability: { status: "unavailable", message: "Gateway file search is not available yet." }
    });
  });
});
