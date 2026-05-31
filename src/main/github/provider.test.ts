import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BranchListResult,
  ReleaseDetailResult,
  RepoFileContentResult,
  RepositoryDetail,
  RepositorySummary
} from "@shared/github";
import { createLocalStore } from "../storage";
import { MemoryLocalStore } from "../storage/memoryStore";

const { clearGitHubTokenMock, getGitHubTokenMock } = vi.hoisted(() => ({
  clearGitHubTokenMock: vi.fn(async () => undefined),
  getGitHubTokenMock: vi.fn(async () => null)
}));

vi.mock("./credentials", () => ({
  clearGitHubToken: clearGitHubTokenMock,
  getGitHubToken: getGitHubTokenMock,
  setGitHubToken: vi.fn(async () => undefined)
}));

vi.mock("./octokitProvider", () => ({
  OctokitProvider: class {
    constructor() {
      throw new Error("OctokitProvider should not be constructed for cache-only reads.");
    }
  },
  validateGitHubToken: vi.fn()
}));

vi.mock("./webOAuth", () => ({
  pollGitHubDeviceAuthorization: vi.fn(),
  requestGitHubDeviceAuthorization: vi.fn()
}));

import { GitHubProviderManager } from "./provider";

const tempDirs: string[] = [];

afterEach(() => {
  clearGitHubTokenMock.mockClear();
  getGitHubTokenMock.mockClear();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeRepositorySummary(): RepositorySummary {
  return {
    id: "R_apple_swift",
    owner: "apple",
    name: "swift",
    nameWithOwner: "apple/swift",
    description: "The Swift Programming Language",
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    stargazerCount: 23_300,
    forkCount: 3_500,
    watcherCount: 1_200,
    openIssuesCount: 1200,
    counts: {
      openIssues: 1200,
      openPullRequests: 5,
      discussions: 42,
      projects: 3,
      releases: 98,
      forks: 3500,
      stars: 23300,
      watchers: 1200
    },
    primaryLanguage: { name: "C++", color: "#f34b7d" },
    updatedAt: "2026-05-05T00:00:00.000Z",
    pushedAt: "2026-05-05T00:00:00.000Z",
    avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
    defaultBranch: "main"
  };
}

function makeRepositoryDetail(): RepositoryDetail {
  return {
    ...makeRepositorySummary(),
    homepageUrl: "https://swift.org",
    licenseName: "Apache License 2.0",
    licenseSpdxId: "Apache-2.0",
    topics: ["swift", "compiler"],
    branchCount: 12,
    tagCount: 40,
    readmeMarkdown: "# Swift",
    htmlUrl: "https://github.com/apple/swift",
    languages: [{ name: "C++", color: "#f34b7d", size: 100, percent: 100 }],
    parent: null,
    source: null,
    viewerState: {
      hasStarred: false,
      subscription: "UNSUBSCRIBED",
      permission: null,
      canAdminister: false,
      canSubscribe: false
    },
    permissions: {
      viewerPermission: null,
      isArchived: false,
      isDisabled: false
    },
    administration: {
      visibility: "PUBLIC",
      defaultBranch: "main",
      isPrivate: false,
      isArchived: false,
      isDisabled: false,
      isTemplate: false,
      allowForking: true,
      webCommitSignoffRequired: false,
      features: {
        issues: true,
        projects: true,
        wiki: true,
        discussions: true
      },
      mergeSettings: {
        allowMergeCommit: true,
        allowSquashMerge: true,
        allowRebaseMerge: true,
        allowAutoMerge: null,
        deleteBranchOnMerge: true,
        allowUpdateBranch: true
      },
      viewerPermissions: {
        admin: null,
        maintain: null,
        push: null,
        triage: null,
        pull: null
      },
      securityAndAnalysis: {
        advancedSecurity: null,
        codeSecurity: null,
        dependabotAlerts: null,
        dependabotSecurityUpdates: null,
        secretScanning: null,
        secretScanningPushProtection: null,
        secretScanningNonProviderPatterns: null,
        secretScanningValidityChecks: null,
        secretScanningAiDetection: null
      }
    }
  };
}

describe("GitHubProviderManager cache-only reads", () => {
  it("serves cached repository summaries and details without loading a GitHub token", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-github-provider-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);
    const detail = makeRepositoryDetail();
    store.upsertGitHubRepositoryDetail(detail);

    const provider = new GitHubProviderManager(store);

    await expect(provider.listRepositories({ limit: 20, cacheOnly: true })).resolves.toEqual([
      expect.objectContaining({ nameWithOwner: "apple/swift" })
    ]);
    await expect(provider.getRepository("apple", "swift", { cacheOnly: true })).resolves.toEqual(
      expect.objectContaining({ nameWithOwner: "apple/swift", readmeMarkdown: "# Swift" })
    );
    await expect(provider.getRepository("missing", "repo", { cacheOnly: true })).rejects.toThrow(
      "No cached repository data for missing/repo"
    );
    expect(getGitHubTokenMock).not.toHaveBeenCalled();
  });

  it("removes the persisted viewer account on sign out", async () => {
    const store = new MemoryLocalStore();
    store.saveAccount("github-viewer", "octocat", {
      login: "octocat",
      name: null,
      avatarUrl: null,
      htmlUrl: null
    });
    store.saveAccount("github", "octocat", { login: "octocat" });

    const provider = new GitHubProviderManager(store);

    await provider.clearToken();

    expect(clearGitHubTokenMock).toHaveBeenCalledTimes(1);
    expect(store.getLastAccount("github-viewer")).toBeNull();
    expect(store.getLastAccount("github")).toEqual({ login: "octocat" });
  });

  it("returns status cache-only misses without loading a GitHub token", async () => {
    const store = new MemoryLocalStore();
    const provider = new GitHubProviderManager(store);

    await expect(
      provider.listBranchesWithStatus({
        owner: "apple",
        repo: "swift",
        limit: 5,
        cacheOnly: true
      })
    ).resolves.toEqual({
      items: [],
      availability: {
        status: "not_loaded",
        message:
          "No cached GitHub data for branches-with-status:apple/swift:5. Sign in with GitHub to refresh it."
      }
    });

    expect(getGitHubTokenMock).not.toHaveBeenCalled();
  });

  it("uses distinct release detail status cache keys for id and tag lookups", async () => {
    const store = new MemoryLocalStore();
    const idResult: ReleaseDetailResult = {
      item: null,
      availability: { status: "available", message: null }
    };
    const tagResult: ReleaseDetailResult = {
      item: null,
      availability: { status: "rate_limited", message: "secondary rate limit" }
    };
    store.setCache({
      provider: "github",
      cacheKey: "release-detail:apple/swift:id:101",
      payload: idResult,
      etag: null,
      expiresAt: "2999-01-01T00:00:00.000Z"
    });
    store.setCache({
      provider: "github",
      cacheKey: "release-detail:apple/swift:tag:swift-5.10.0",
      payload: tagResult,
      etag: null,
      expiresAt: "2999-01-01T00:00:00.000Z"
    });
    const provider = new GitHubProviderManager(store);

    await expect(
      provider.getReleaseDetailWithStatus({
        owner: "apple",
        repo: "swift",
        releaseId: 101,
        cacheOnly: true
      })
    ).resolves.toBe(idResult);
    await expect(
      provider.getReleaseDetailWithStatus({
        owner: "apple",
        repo: "swift",
        releaseTagName: "swift-5.10.0",
        cacheOnly: true
      })
    ).resolves.toBe(tagResult);

    expect(getGitHubTokenMock).not.toHaveBeenCalled();
  });

  it("serves stale list and detail status caches when live GitHub reads are unavailable", async () => {
    const store = new MemoryLocalStore();
    const branches: BranchListResult = {
      items: [{ name: "main", commitSha: "abc123", protected: true }],
      availability: { status: "available", message: null }
    };
    const fileContent: RepoFileContentResult = {
      item: {
        path: "README.md",
        name: "README.md",
        ref: "main",
        kind: "text",
        content: "# Swift",
        size: 7,
        encoding: "utf-8",
        htmlUrl: "https://github.com/apple/swift/blob/main/README.md",
        downloadUrl: null,
        message: null,
        lastCommitSha: null,
        lastCommitMessage: null,
        lastCommitAuthorLogin: null,
        lastCommitAuthorName: null,
        lastCommitAuthorAvatarUrl: null,
        lastAuthoredDate: null,
        lastCommittedDate: null,
        lastCommitDate: null,
        lastCommitHtmlUrl: null,
        lastCommitAdditions: null,
        lastCommitDeletions: null,
        lastCommitChanges: null,
        lastCommitAvailability: { status: "not_loaded", message: null }
      },
      availability: { status: "available", message: null }
    };
    store.setCache({
      provider: "github",
      cacheKey: "branches-with-status:apple/swift:5",
      payload: branches,
      etag: null,
      expiresAt: "2000-01-01T00:00:00.000Z"
    });
    store.setCache({
      provider: "github",
      cacheKey: "file-content-with-status:apple/swift:main:README.md",
      payload: fileContent,
      etag: null,
      expiresAt: "2000-01-01T00:00:00.000Z"
    });
    const provider = new GitHubProviderManager(store);

    await expect(
      provider.listBranchesWithStatus({ owner: "apple", repo: "swift", limit: 5, forceRefresh: true })
    ).resolves.toEqual(branches);
    await expect(
      provider.getFileContentWithStatus({
        owner: "apple",
        repo: "swift",
        ref: "main",
        path: "README.md",
        forceRefresh: true
      })
    ).resolves.toEqual(fileContent);

    expect(getGitHubTokenMock).toHaveBeenCalledTimes(1);
  });
});
