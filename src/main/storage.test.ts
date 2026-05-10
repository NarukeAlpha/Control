import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalStore } from "./storage";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("LocalStore repository pins", () => {
  it("pins repositories locally and removes them without GitHub data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    store.pinRepository("apple/swift");
    store.pinRepository("NarukeAlpha/blog");
    store.pinRepository("apple/swift");

    expect(new Set(store.listPinnedRepositories())).toEqual(new Set(["apple/swift", "NarukeAlpha/blog"]));

    store.unpinRepository("apple/swift");

    expect(store.listPinnedRepositories()).toEqual(["NarukeAlpha/blog"]);
  });

  it("lists recent GitHub items with normalized repository metadata", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    store.addRecentItem("repository", "github", "apple/swift", {
      nameWithOwner: "apple/swift",
      description: "The Swift Programming Language",
      htmlUrl: "https://github.com/apple/swift",
      defaultBranch: "main"
    });
    store.addRecentItem("file", "github", "apple/swift:main:README.md", {
      title: "README.md",
      subtitle: "swift/README.md",
      repositoryNameWithOwner: "apple/swift",
      url: "https://github.com/apple/swift/blob/main/README.md",
      metadata: {
        path: "README.md",
        ref: "main",
        unsafe: { nested: true }
      }
    });

    expect(store.listRecentItems({ limit: 10 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "file",
          provider: "github",
          itemKey: "apple/swift:main:README.md",
          title: "README.md",
          repositoryNameWithOwner: "apple/swift",
          metadata: {
            path: "README.md",
            ref: "main"
          }
        }),
        expect.objectContaining({
          kind: "repository",
          provider: "github",
          itemKey: "apple/swift",
          title: "apple/swift",
          subtitle: "The Swift Programming Language",
          repositoryNameWithOwner: "apple/swift",
          url: "https://github.com/apple/swift"
        })
      ])
    );
    expect(store.listRecentItems({ kind: "repository" })).toHaveLength(1);
  });

  it("clears cache entries by provider prefix", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    store.setCache({
      provider: "github",
      cacheKey: "notifications:unread:all:none:none:30",
      payload: [{ id: "thread-1" }],
      etag: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    store.setCache({
      provider: "github",
      cacheKey: "repositories",
      payload: [{ id: "repo-1" }],
      etag: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });

    store.clearCacheByPrefix("github", "notifications:");

    expect(store.getCache("github", "notifications:unread:all:none:none:30")).toBeNull();
    expect(store.getCache("github", "repositories")).toEqual([{ id: "repo-1" }]);
  });
});
