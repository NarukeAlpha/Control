import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RepositoryDetail, RepositorySummary } from "@shared/github";
import { createLocalStore } from "../storage";

const { getGitHubTokenMock } = vi.hoisted(() => ({
  getGitHubTokenMock: vi.fn(async () => null)
}));

vi.mock("./credentials", () => ({
  clearGitHubToken: vi.fn(async () => undefined),
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
});
