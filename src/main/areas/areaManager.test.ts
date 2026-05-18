import { describe, expect, it, vi } from "vitest";

import type { AreaRepositoryDetail } from "@shared/areas";
import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import { AreaManager } from "./areaManager";

const now = "2026-05-16T00:00:00.000Z";

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

function createStore(repository: AreaRepositoryDetail | null): LocalStore {
  return {
    ensureDefaultGitHubArea: vi.fn(),
    getAreaRepository: vi.fn(() => repository),
    listAreaWorkspaces: vi.fn(() => [])
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

function createAreaManager(repository: AreaRepositoryDetail | null, github = createGithub()): AreaManager {
  return new AreaManager(createStore(repository), github, {
    onAreasUpdated: vi.fn(),
    onAreaRepositoryUpdated: vi.fn(),
    onAreaWorkspaceUpdated: vi.fn()
  });
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
