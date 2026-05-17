import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalStore } from "./storage";
import type { AreaRepositorySummary, AreaSummary } from "@shared/areas";

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

  it("creates default and local Areas with repository storage parity", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    const githubArea = store.ensureDefaultGitHubArea("control-user");
    const localArea = store.createLocalArea({ rootPath: join(tempDir, "src"), label: "Source" });
    const now = new Date().toISOString();
    const repository: AreaRepositorySummary = {
      id: "repo:local:test",
      areaId: localArea.id,
      kind: "git",
      name: "control",
      owner: null,
      displayName: "control",
      path: join(tempDir, "src", "control"),
      defaultBranch: "main",
      currentBranch: "main",
      isDirty: false,
      isPrivate: null,
      description: null,
      connection: null,
      capabilities: {
        supportsBranches: true,
        supportsBookmarks: false,
        supportsWorkspaces: false,
        supportsOperationLog: false,
        supportsSparse: false,
        isGitBacked: true,
        isColocated: false,
        supportsGitHubEnrichment: false
      },
      health: { status: "ready", message: null, checkedAt: now },
      updatedAt: now,
      scannedAt: now
    };

    store.upsertAreaRepository(repository);

    expect(githubArea.id).toBe("github:default");
    expect(store.listAreas().map((area: AreaSummary) => area.id)).toEqual(
      expect.arrayContaining(["github:default", localArea.id])
    );
    expect(store.listAreaRepositories({ areaId: localArea.id })).toEqual([
      expect.objectContaining({ id: repository.id, kind: "git" })
    ]);
    expect(store.getAreaRepository({ areaId: localArea.id, repositoryId: repository.id })).toEqual(
      expect.objectContaining({ id: repository.id, branches: [] })
    );
  });

  it("migrates legacy GitHub pins and recents into default Area identity", async () => {
    let Database: typeof import("better-sqlite3");
    try {
      Database = (await import("better-sqlite3")).default;
    } catch {
      return;
    }

    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const dbDir = join(tempDir, "Control");
    mkdirSync(dbDir, { recursive: true });
    let db: import("better-sqlite3").Database;
    try {
      db = new Database(join(dbDir, "control.sqlite"));
    } catch {
      return;
    }
    db.exec(`
      CREATE TABLE pinned_repositories (
        name_with_owner TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE recent_items (
        kind TEXT NOT NULL,
        provider TEXT NOT NULL,
        item_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (kind, provider, item_key)
      );
    `);
    db.prepare("INSERT INTO pinned_repositories (name_with_owner, created_at) VALUES (?, ?)").run(
      "apple/swift",
      "2026-05-01T00:00:00.000Z"
    );
    db.prepare(
      `INSERT INTO recent_items (kind, provider, item_key, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      "repository",
      "github",
      "apple/swift",
      JSON.stringify({
        nameWithOwner: "apple/swift",
        description: "The Swift Programming Language",
        htmlUrl: "https://github.com/apple/swift"
      }),
      "2026-05-02T00:00:00.000Z"
    );
    db.close();

    const store = await createLocalStore(tempDir);

    expect(store.listAreaRepositoryPins()).toEqual([
      expect.objectContaining({
        areaId: "github:default",
        repositoryId: "github:default:apple/swift",
        workspaceId: null,
        nameWithOwner: "apple/swift"
      })
    ]);
    expect(store.listRecentItems({ kind: "repository" })).toEqual([
      expect.objectContaining({
        provider: "github",
        itemKey: "apple/swift",
        areaId: "github:default",
        repositoryId: "github:default:apple/swift",
        workspaceId: null
      })
    ]);
  });

  it("preserves workspace identity on Area pins and local recents", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    store.pinAreaRepository({
      areaId: "local:area",
      repositoryId: "repo:jj",
      workspaceId: "workspace:docs",
      nameWithOwner: null,
      createdAt: null
    });
    store.addRecentItem("repository", "local", "local:area:repo:jj:workspace:docs", {
      title: "docs",
      areaId: "local:area",
      repositoryId: "repo:jj",
      workspaceId: "workspace:docs"
    });

    expect(store.listAreaRepositoryPins()).toEqual([
      expect.objectContaining({
        areaId: "local:area",
        repositoryId: "repo:jj",
        workspaceId: "workspace:docs"
      })
    ]);
    expect(store.listRecentItems({ kind: "repository" })).toEqual([
      expect.objectContaining({
        provider: "local",
        itemKey: "local:area:repo:jj:workspace:docs",
        areaId: "local:area",
        repositoryId: "repo:jj",
        workspaceId: "workspace:docs"
      })
    ]);
  });
});
