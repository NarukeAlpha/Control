import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalStore, type AreaGatewayRecord, type LocalStore } from "./storage";
import type { AreaRepositorySummary, AreaSummary, AreaWorkspaceSummary } from "@shared/areas";
import type {
  ControlSettings,
  RepositoryDetail,
  RepositoryListResult,
  RepositorySummary
} from "@shared/github";
import { getAreaGateway, migrateLegacyAreaGatewayTokens } from "./storage/areaGatewayStore";
import { writeCacheEntry } from "./storage/cacheStore";
import { createStorageDatabaseAdapter, type SqliteDatabase, type StorageDatabase } from "./storage/database";
import { DatabaseError, UnavailableDatabaseError } from "./storage/errors";
import { MemoryLocalStore } from "./storage/memoryStore";
import { defaultSettings, normalizeSettings } from "./storage/localStoreHelpers";
import { runStorageSync } from "./storage/runtime";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("LocalStore repository pins", () => {
  it("converts SQLite adapter failures into DatabaseError", () => {
    const db = createStorageDatabaseAdapter({
      exec: () => {
        throw new Error("raw sqlite failure");
      },
      pragma: () => null,
      prepare: () => {
        throw new Error("raw sqlite failure");
      },
      transaction: (action: () => unknown) => {
        const run = () => action();
        return Object.assign(run, {
          default: run,
          deferred: run,
          immediate: run,
          exclusive: run
        });
      },
      close: () => {
        throw new Error("raw sqlite failure");
      }
    } as unknown as SqliteDatabase);

    expect(() => db.get("SELECT 1")).toThrow(DatabaseError);
    expect(() => db.get("SELECT 1")).toThrow(
      expect.objectContaining({ code: "STORAGE_IO_ERROR", kind: "io" })
    );
    expect(() => db.operation("test.failure", () => db.get("SELECT 1"))).toThrow(
      expect.objectContaining({ operation: "test.failure" })
    );
  });

  it("preserves DatabaseError through the sync Effect storage runner", () => {
    const db = createStorageDatabaseAdapter({
      exec: () => {
        throw new Error("raw sqlite failure");
      },
      pragma: () => null,
      prepare: () => {
        throw new Error("raw sqlite failure");
      },
      transaction: (action: () => unknown) => {
        const run = () => action();
        return Object.assign(run, {
          default: run,
          deferred: run,
          immediate: run,
          exclusive: run
        });
      },
      close: () => undefined
    } as unknown as SqliteDatabase);

    expect(() =>
      runStorageSync("effect.database", () => db.operation("effect.database", () => db.get("SELECT 1")))
    ).toThrow(expect.objectContaining({ operation: "effect.database" }));
  });

  it("deletes persisted account records by provider", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const stores: LocalStore[] = [new MemoryLocalStore(), await createLocalStore(tempDir)];

    for (const store of stores) {
      store.saveAccount("github-viewer", "octocat", { login: "octocat" });
      store.saveAccount("github-viewer", "mona", { login: "mona" });
      store.saveAccount("github", "octocat", { login: "octocat" });

      store.deleteAccount("github-viewer");

      expect(store.getLastAccount("github-viewer")).toBeNull();
      expect(store.getLastAccount("github")).toEqual({ login: "octocat" });
    }
  });

  it("pins repositories locally and removes them without GitHub data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    store.pinRepository("apple/swift");
    store.pinRepository("NarukeAlpha/blog");
    store.pinRepository("apple/swift");

    expect(new Set(store.listPinnedRepositories())).toEqual(new Set(["apple/swift", "NarukeAlpha/blog"]));
    expect(store.listAreaRepositoryPins()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          areaId: "github:default",
          repositoryId: "github:default:apple/swift",
          workspaceId: null,
          nameWithOwner: "apple/swift"
        }),
        expect.objectContaining({
          areaId: "github:default",
          repositoryId: "github:default:narukealpha/blog",
          workspaceId: null,
          nameWithOwner: "NarukeAlpha/blog"
        })
      ])
    );

    store.unpinRepository("apple/swift");

    expect(store.listPinnedRepositories()).toEqual(["NarukeAlpha/blog"]);
    expect(store.listAreaRepositoryPins()).toEqual([
      expect.objectContaining({
        areaId: "github:default",
        repositoryId: "github:default:narukealpha/blog",
        workspaceId: null,
        nameWithOwner: "NarukeAlpha/blog"
      })
    ]);
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

  it("wraps cache serialization failures through the sync Effect storage path", () => {
    const db = createStorageDatabaseAdapter({
      exec: () => undefined,
      pragma: () => null,
      prepare: () => ({
        run: () => undefined,
        get: () => undefined,
        all: () => []
      }),
      transaction: (action: () => unknown) => {
        const run = () => action();
        return Object.assign(run, {
          default: run,
          deferred: run,
          immediate: run,
          exclusive: run
        });
      },
      close: () => undefined
    } as unknown as SqliteDatabase);
    const circularPayload: { self?: unknown } = {};
    circularPayload.self = circularPayload;

    expect(() =>
      runStorageSync("cache.write", () =>
        writeCacheEntry(db, {
          provider: "github",
          cacheKey: "bad-payload",
          payload: circularPayload,
          etag: null,
          expiresAt: null
        })
      )
    ).toThrow(
      expect.objectContaining({
        operation: "cache.write",
        cause: expect.objectContaining({
          code: "STORAGE_SERIALIZATION_ERROR",
          kind: "serialization"
        })
      })
    );
  });

  it("keeps the extracted memory store at settings/cache/status parity with no-op close", () => {
    const store = new MemoryLocalStore();
    const repository = repositorySummary("NarukeAlpha/control");

    expect(store.updateSettings({ glassMode: "solid" })).toEqual({
      credentialProvider: "github-oauth",
      glassMode: "solid",
      theme: defaultSettings.theme,
      repositoryTabPreferences: {}
    });

    store.setGitHubRepositoriesWithStatusCache({
      repositories: [repository],
      cacheKey: "repositories-with-status:memory",
      result: { items: [repository], availability: { status: "available", message: null } },
      etag: "etag-1",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    store.close();
    store.close();

    expect(store.getGitHubRepository("NarukeAlpha/control")).toEqual(repository);
    expect(store.getCacheEntry<RepositoryListResult>("github", "repositories-with-status:memory")).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ items: [repository] }),
        etag: "etag-1",
        isExpired: false
      })
    );
  });

  it("normalizes invalid persisted settings fields independently", () => {
    expect(
      normalizeSettings({
        credentialProvider: "unknown",
        glassMode: "transparent",
        theme: {
          mode: "dark",
          preset: "unknown-preset",
          accent: "purple",
          custom: {
            light: {
              accent: "#ff6363",
              background: "#bad",
              foreground: "#030303"
            },
            dark: {
              accent: "60a5fa",
              background: "#111827",
              foreground: "#e4e4e7"
            },
            uiFont: "satoshi",
            codeFont: "unknown"
          }
        },
        repositoryTabPreferences: {
          agents: "show",
          releases: "invalid"
        }
      })
    ).toEqual({
      credentialProvider: "github-oauth",
      glassMode: "glass-shell",
      theme: {
        mode: "dark",
        preset: "control-light",
        accent: "purple",
        custom: {
          light: {
            accent: "#FF6363",
            background: defaultSettings.theme.custom.light.background,
            foreground: "#030303"
          },
          dark: {
            accent: defaultSettings.theme.custom.dark.accent,
            background: "#111827",
            foreground: "#E4E4E7"
          },
          uiFont: "satoshi",
          codeFont: defaultSettings.theme.custom.codeFont
        }
      },
      repositoryTabPreferences: {
        agents: "show"
      }
    });
  });

  it("preserves theme settings when applying partial settings writes", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const stores: LocalStore[] = [new MemoryLocalStore(), await createLocalStore(tempDir)];
    const theme: ControlSettings["theme"] = {
      mode: "dark",
      preset: "control-high-contrast-dark",
      accent: "green",
      custom: {
        ...defaultSettings.theme.custom,
        dark: {
          accent: "#FF5C5C",
          background: "#111827",
          foreground: "#E4E4E7"
        },
        codeFont: "jetbrains-mono"
      }
    };

    for (const store of stores) {
      expect(store.updateSettings({ theme })).toEqual(expect.objectContaining({ theme }));
      expect(store.updateSettings({ glassMode: "solid" })).toEqual(
        expect.objectContaining({
          glassMode: "solid",
          theme
        })
      );
      store.close();
    }
  });

  it("deep merges custom theme palette writes", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const stores: LocalStore[] = [new MemoryLocalStore(), await createLocalStore(tempDir)];

    for (const store of stores) {
      const result = store.updateSettings({
        theme: {
          custom: {
            light: {
              accent: "#22C55E"
            }
          }
        }
      } as Partial<ControlSettings>);

      expect(result.theme.custom).toEqual({
        ...defaultSettings.theme.custom,
        light: {
          ...defaultSettings.theme.custom.light,
          accent: "#22C55E"
        }
      });
      store.close();
    }
  });

  it("keeps cache and repository-status contracts aligned for SQLite and memory adapters", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const stores: LocalStore[] = [new MemoryLocalStore(), await createLocalStore(tempDir)];

    for (const store of stores) {
      assertLocalStoreCacheContract(store);
      store.close();
      store.close();
    }
  });

  it("treats corrupted cache rows as cache misses and removes them", async () => {
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
      CREATE TABLE cache_entries (
        provider TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        etag TEXT,
        expires_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (provider, cache_key)
      );
    `);
    db.prepare(
      `INSERT INTO cache_entries (provider, cache_key, payload, etag, expires_at)
       VALUES ('github', 'bad-json', '{', NULL, NULL)`
    ).run();
    db.close();

    const store = await createLocalStore(tempDir);

    expect(store.getCache("github", "bad-json")).toBeNull();
    expect(store.getCacheEntry("github", "bad-json")).toBeNull();
  });

  it("rolls back repository-status cache writes when the logical transaction fails", async () => {
    let Database: typeof import("better-sqlite3");
    try {
      Database = (await import("better-sqlite3")).default;
      const probeDir = mkdtempSync(join(tmpdir(), "control-store-probe-"));
      tempDirs.push(probeDir);
      const probe = new Database(join(probeDir, "probe.sqlite"));
      probe.close();
    } catch {
      return;
    }

    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);
    const repository = repositorySummary("NarukeAlpha/control");
    const circularResult = { items: [repository], availability: { status: "available", message: null } };
    (circularResult as unknown as { self: unknown }).self = circularResult;

    expect(() =>
      store.setGitHubRepositoriesWithStatusCache({
        repositories: [repository],
        cacheKey: "repositories-with-status:1",
        result: circularResult as unknown as RepositoryListResult,
        etag: null,
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      })
    ).toThrow(DatabaseError);

    expect(store.getGitHubRepository("NarukeAlpha/control")).toBeNull();
    expect(store.getCache("github", "repositories-with-status:1")).toBeNull();
  });

  it("preserves GitHub repository detail and readme fields across summary refreshes", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);
    const detail = repositoryDetail("NarukeAlpha/control");

    store.upsertGitHubRepositoryDetail(detail);
    store.upsertGitHubRepositoryReadme(detail.nameWithOwner, "# Cached readme");
    store.upsertGitHubRepositorySummary({
      ...repositorySummary(detail.nameWithOwner),
      description: "Updated summary",
      stargazerCount: 42
    });

    expect(store.getGitHubRepository(detail.nameWithOwner)).toEqual(
      expect.objectContaining({ description: "Updated summary", stargazerCount: 42 })
    );
    expect(store.getGitHubRepositoryDetail(detail.nameWithOwner)).toEqual(
      expect.objectContaining({
        nameWithOwner: detail.nameWithOwner,
        readmeMarkdown: "# Initial readme",
        languages: detail.languages,
        viewerState: detail.viewerState,
        permissions: detail.permissions
      })
    );
    expect(store.getGitHubRepositoryReadme(detail.nameWithOwner)).toBe("# Cached readme");
  });

  it("does not create GitHub repository rows when updating readmes for unknown repositories", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);
    const existing = repositorySummary("NarukeAlpha/control");

    store.upsertGitHubRepositorySummary(existing);
    store.upsertGitHubRepositoryReadme("NarukeAlpha/missing", "# Missing");

    expect(store.getGitHubRepository("NarukeAlpha/missing")).toBeNull();
    expect(store.getGitHubRepositoryReadme("NarukeAlpha/missing")).toBeNull();
    expect(store.listGitHubRepositories()).toEqual([existing]);
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

  it("updates Area metadata and defaults empty SSH labels to the host", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    const githubArea = store.ensureDefaultGitHubArea("NarukeAlpha");
    const localArea = store.createLocalArea({ rootPath: "/Users/example/Projects", label: "Work" });
    const sshArea = store.createSshArea({ host: "delta-wsl", rootPath: "~/controltest", label: "" });

    expect(sshArea.label).toBe("delta-wsl");
    expect(store.updateArea({ areaId: githubArea.id, label: "Main GitHub" })).toEqual(
      expect.objectContaining({ label: "Main GitHub" })
    );
    expect(store.updateArea({ areaId: localArea.id, label: "", rootPath: "/Users/example/Code" })).toEqual(
      expect.objectContaining({ label: "Code", rootPath: "/Users/example/Code" })
    );
    expect(
      store.updateArea({
        areaId: sshArea.id,
        label: "",
        host: "delta-wsl",
        rootPath: "~/other",
        username: null,
        port: null
      })
    ).toEqual(expect.objectContaining({ label: "delta-wsl", rootPath: "~/other" }));
  });

  it("preserves selected Area semantics when the default GitHub Area refreshes", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);

    const githubArea = store.ensureDefaultGitHubArea("octocat");
    const localArea = store.createLocalArea({ rootPath: join(tempDir, "src"), label: "Source" });

    store.selectArea(localArea.id);
    const refreshedGitHubArea = store.ensureDefaultGitHubArea("control-user");

    expect(refreshedGitHubArea).toEqual(
      expect.objectContaining({ id: githubArea.id, accountLogin: "control-user", selected: false })
    );
    expect(store.listAreas().filter((area) => area.selected)).toEqual([
      expect.objectContaining({ id: localArea.id })
    ]);
  });

  it("stores Area gateways and resets connection fields when Area roots change", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);
    const localArea = store.createLocalArea({ rootPath: join(tempDir, "src"), label: "Source" });
    const gateway = areaGatewayRecord(localArea.id, localArea.rootPath ?? "");

    store.setAreaGateway(gateway);

    expect(store.listAreas()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: localArea.id,
          gateway: expect.objectContaining({ status: "ready", apiUrl: "http://127.0.0.1:4580" })
        })
      ])
    );

    store.updateArea({ areaId: localArea.id, rootPath: join(tempDir, "code") });

    expect(store.getAreaGateway(localArea.id)).toEqual(
      expect.objectContaining({
        rootPath: join(tempDir, "code"),
        apiUrl: null,
        adminUrl: null,
        serviceName: null,
        version: null,
        status: "not-installed",
        pid: null,
        processId: null,
        failureCode: null,
        message: null,
        lastStartedAt: null,
        lastSeenAt: null
      })
    );

    store.clearAreaGateway(localArea.id);

    expect(store.getAreaGateway(localArea.id)).toBeNull();
    expect(store.getArea(localArea.id)).toEqual(expect.objectContaining({ gateway: null }));
  });

  it("migrates legacy gateway tokens to the credential store before stripping SQLite records", async () => {
    const db = await createTempStorageDatabase();
    const record = {
      ...areaGatewayRecord("local:legacy", "/work/legacy"),
      apiToken: "legacy-api-token",
      adminToken: "legacy-admin-token"
    };
    db.run(
      `INSERT INTO area_gateways (area_id, summary_json, record_json, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      record.areaId,
      "{}",
      JSON.stringify(record)
    );
    const migrateCredentials = vi.fn(async () => undefined);

    await migrateLegacyAreaGatewayTokens(db, migrateCredentials);

    expect(migrateCredentials).toHaveBeenCalledWith("local:legacy", {
      apiToken: "legacy-api-token",
      adminToken: "legacy-admin-token"
    });
    const rawRecord =
      db.get<{ recordJson: string }>("SELECT record_json AS recordJson FROM area_gateways")?.recordJson ?? "";
    expect(rawRecord).not.toContain("legacy-api-token");
    expect(rawRecord).not.toContain("legacy-admin-token");
    expect(rawRecord).not.toContain("apiToken");
    expect(rawRecord).not.toContain("adminToken");
    expect(getAreaGateway(db, "local:legacy")).toEqual(
      expect.objectContaining({
        areaId: "local:legacy",
        failureCode: null
      })
    );
    db.close();
  });

  it("strips legacy gateway tokens even when credential migration is unavailable", async () => {
    const db = await createTempStorageDatabase();
    const record = {
      ...areaGatewayRecord("local:legacy", "/work/legacy"),
      apiToken: "legacy-api-token",
      adminToken: "legacy-admin-token"
    };
    db.run(
      `INSERT INTO area_gateways (area_id, summary_json, record_json, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      record.areaId,
      "{}",
      JSON.stringify(record)
    );

    await migrateLegacyAreaGatewayTokens(db, async () => {
      throw new Error("keychain unavailable");
    });

    const row = db.get<{ recordJson: string }>(
      "SELECT record_json AS recordJson FROM area_gateways WHERE area_id = ?",
      record.areaId
    );
    expect(row?.recordJson).not.toContain("legacy-api-token");
    expect(row?.recordJson).not.toContain("legacy-admin-token");
    expect(row?.recordJson).not.toContain("apiToken");
    expect(row?.recordJson).not.toContain("adminToken");
    expect(JSON.parse(row?.recordJson ?? "{}")).toEqual(
      expect.objectContaining({
        status: "error",
        failureCode: "gateway-credentials-migration-pending"
      })
    );
    db.close();
  });

  it("treats partial legacy gateway token rows as secret-bearing migration failures", async () => {
    const db = await createTempStorageDatabase();
    const record = {
      ...areaGatewayRecord("local:partial-legacy", "/work/legacy"),
      apiToken: "legacy-api-token"
    };
    db.run(
      `INSERT INTO area_gateways (area_id, summary_json, record_json, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      record.areaId,
      "{}",
      JSON.stringify(record)
    );
    const migrateCredentials = vi.fn(async () => undefined);

    await migrateLegacyAreaGatewayTokens(db, migrateCredentials);

    const row = db.get<{ recordJson: string }>(
      "SELECT record_json AS recordJson FROM area_gateways WHERE area_id = ?",
      record.areaId
    );
    expect(migrateCredentials).not.toHaveBeenCalled();
    expect(row?.recordJson).not.toContain("legacy-api-token");
    expect(row?.recordJson).not.toContain("apiToken");
    expect(JSON.parse(row?.recordJson ?? "{}")).toEqual(
      expect.objectContaining({
        status: "error",
        failureCode: "gateway-credentials-migration-pending"
      })
    );
    db.close();
  });

  it("stores Area repositories, workspaces, and snapshots with summary fallback details", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-store-"));
    tempDirs.push(tempDir);
    const store = await createLocalStore(tempDir);
    const localArea = store.createLocalArea({ rootPath: join(tempDir, "src"), label: "Source" });
    const repository = areaRepositorySummary(
      localArea.id,
      "repo:local:control",
      join(tempDir, "src/control")
    );
    const otherRepository = areaRepositorySummary(
      localArea.id,
      "repo:local:other",
      join(tempDir, "src/other")
    );
    const workspace = areaWorkspaceSummary(localArea.id, repository.id, "workspace:main", "main");
    const otherWorkspace = areaWorkspaceSummary(localArea.id, otherRepository.id, "workspace:docs", "docs");

    store.upsertAreaRepository(repository);
    store.upsertAreaRepository(otherRepository);
    store.upsertAreaWorkspace(workspace);
    store.upsertAreaWorkspace(otherWorkspace);
    store.setAreaRepoSnapshot(localArea.id, repository.id, "branches", { items: ["main"] });
    store.setAreaRepoSnapshot(localArea.id, repository.id, "branches", { items: ["main", "release"] });
    store.setAreaWorkspaceSnapshot(localArea.id, repository.id, workspace.id, "contents", {
      path: ".",
      entries: ["README.md"]
    });

    expect(store.getAreaRepository({ areaId: localArea.id, repositoryId: repository.id })).toEqual(
      expect.objectContaining({
        id: repository.id,
        branches: [],
        status: expect.objectContaining({ dirtyCount: 0, entries: [] }),
        workspaces: []
      })
    );
    expect(store.listAreaWorkspaces({ areaId: localArea.id, repositoryId: repository.id })).toEqual([
      workspace
    ]);
    expect(store.getAreaWorkspace(localArea.id, workspace.id)).toEqual(
      expect.objectContaining({
        id: workspace.id,
        fileTree: [],
        readme: null,
        status: expect.objectContaining({ dirtyCount: 0, entries: [] })
      })
    );
    expect(store.getAreaRepoSnapshot<{ items: string[] }>(localArea.id, repository.id, "branches")).toEqual({
      items: ["main", "release"]
    });
    expect(
      store.getAreaWorkspaceSnapshot<{ path: string; entries: string[] }>(
        localArea.id,
        repository.id,
        workspace.id,
        "contents"
      )
    ).toEqual({ path: ".", entries: ["README.md"] });
    expect(store.getAreaWorkspaceSnapshot(localArea.id, repository.id, workspace.id, "missing")).toBeNull();

    store.clearAreaWorkspaces(localArea.id, repository.id);

    expect(store.listAreaWorkspaces({ areaId: localArea.id, repositoryId: repository.id })).toEqual([]);
    expect(store.listAreaWorkspaces({ areaId: localArea.id, repositoryId: otherRepository.id })).toEqual([
      otherWorkspace
    ]);
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

  it("fails typed instead of silently using memory when SQLite cannot open", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-storage-open-failure-"));
    tempDirs.push(tempDir);
    mkdirSync(join(tempDir, "Control", "control.sqlite"), { recursive: true });

    await expect(createLocalStore(tempDir)).rejects.toThrow(UnavailableDatabaseError);
    await expect(createLocalStore(tempDir)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      kind: "unavailable",
      operation: "storage.bootstrap"
    });
  });

  it("uses memory storage for SQLite bootstrap failures only when explicitly allowed", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "control-storage-memory-fallback-"));
    tempDirs.push(tempDir);
    mkdirSync(join(tempDir, "Control", "control.sqlite"), { recursive: true });

    await expect(createLocalStore(tempDir, { allowMemoryFallback: true })).resolves.toBeInstanceOf(
      MemoryLocalStore
    );
  });
});

function areaGatewayRecord(areaId: string, rootPath: string): AreaGatewayRecord {
  return {
    areaId,
    rootPath,
    transport: "local",
    host: null,
    username: null,
    port: null,
    apiUrl: "http://127.0.0.1:4580",
    adminUrl: "http://127.0.0.1:4581",
    serviceName: "control-area-gateway",
    version: "1.2.3",
    status: "ready",
    pid: 42,
    processId: 42,
    failureCode: null,
    message: null,
    installedAt: "2026-05-01T00:00:00.000Z",
    lastStartedAt: "2026-05-01T00:01:00.000Z",
    lastSeenAt: "2026-05-01T00:02:00.000Z",
    updatedAt: "2026-05-01T00:03:00.000Z"
  };
}

async function createTempStorageDatabase(): Promise<StorageDatabase> {
  const rows = new Map<string, { areaId: string; summaryJson: string; recordJson: string }>();
  const db: StorageDatabase = {
    operation: <T>(_operation: string, action: () => T): T => action(),
    transaction: <T>(_operation: string, action: (db: StorageDatabase) => T): T => action(db),
    exec: () => undefined,
    pragma: () => null,
    run: (_source: string, ...params: unknown[]) => {
      const objectParams = params[0] as
        | { areaId?: string; summaryJson?: string; recordJson?: string }
        | undefined;
      if (objectParams?.areaId && objectParams.recordJson && objectParams.summaryJson) {
        rows.set(objectParams.areaId, {
          areaId: objectParams.areaId,
          summaryJson: objectParams.summaryJson,
          recordJson: objectParams.recordJson
        });
        return;
      }
      const [areaId, summaryJson, recordJson] = params;
      if (typeof areaId === "string" && typeof summaryJson === "string" && typeof recordJson === "string") {
        rows.set(areaId, { areaId, summaryJson, recordJson });
      }
    },
    get: <Row>(_source: string, ...params: unknown[]): Row | undefined => {
      const row = typeof params[0] === "string" ? rows.get(params[0]) : rows.values().next().value;
      return row ? ({ areaId: row.areaId, recordJson: row.recordJson } as Row) : undefined;
    },
    all: <Row>(): Row[] =>
      [...rows.values()].map((row) => ({ areaId: row.areaId, recordJson: row.recordJson }) as Row),
    close: () => undefined
  };
  return db;
}

function areaRepositorySummary(
  areaId: string,
  id: string,
  path: string,
  now = "2026-05-01T00:00:00.000Z"
): AreaRepositorySummary {
  const name = path.split("/").pop() ?? id;
  return {
    id,
    areaId,
    kind: "git",
    name,
    owner: null,
    displayName: name,
    path,
    defaultBranch: "main",
    currentBranch: "main",
    isDirty: false,
    isPrivate: null,
    description: null,
    connection: null,
    capabilities: {
      supportsBranches: true,
      supportsBookmarks: false,
      supportsWorkspaces: true,
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
}

function areaWorkspaceSummary(
  areaId: string,
  repositoryId: string,
  id: string,
  name: string,
  now = "2026-05-01T00:00:00.000Z"
): AreaWorkspaceSummary {
  return {
    id,
    areaId,
    repositoryId,
    name,
    rootPath: `/workspace/${name}`,
    workingCopyChangeId: null,
    workingCopyCommitId: null,
    isStale: false,
    sparseSummary: null,
    health: { status: "ready", message: null, checkedAt: now },
    updatedAt: now,
    scannedAt: now
  };
}

function repositorySummary(nameWithOwner: string): RepositorySummary {
  const [owner, name] = nameWithOwner.split("/") as [string, string];
  return {
    id: `R_${owner}_${name}`,
    owner,
    name,
    nameWithOwner,
    description: null,
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    stargazerCount: 0,
    forkCount: 0,
    watcherCount: 0,
    openIssuesCount: 0,
    counts: {
      openIssues: 0,
      openPullRequests: 0,
      discussions: 0,
      projects: 0,
      releases: 0,
      forks: 0,
      stars: 0,
      watchers: 0
    },
    primaryLanguage: null,
    updatedAt: null,
    pushedAt: null,
    avatarUrl: null,
    defaultBranch: "main"
  };
}

function assertLocalStoreCacheContract(store: LocalStore): void {
  const repository = repositorySummary("NarukeAlpha/control");

  store.setCache({
    provider: "github",
    cacheKey: "contract:cache",
    payload: { ok: true },
    etag: "cache-etag",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
  expect(store.getCache("github", "contract:cache")).toEqual({ ok: true });
  expect(store.getCacheEntry("github", "contract:cache")).toEqual(
    expect.objectContaining({
      payload: { ok: true },
      etag: "cache-etag",
      isExpired: false
    })
  );

  store.setGitHubRepositoriesWithStatusCache({
    repositories: [repository],
    cacheKey: "repositories-with-status:contract",
    result: { items: [repository], availability: { status: "available", message: null } },
    etag: "status-etag",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
  expect(store.getGitHubRepository("NarukeAlpha/control")).toEqual(repository);
  expect(store.getCacheEntry<RepositoryListResult>("github", "repositories-with-status:contract")).toEqual(
    expect.objectContaining({
      payload: expect.objectContaining({ items: [repository] }),
      etag: "status-etag",
      isExpired: false
    })
  );

  store.clearCacheByPrefix("github", "repositories-with-status:");
  expect(store.getCache("github", "repositories-with-status:contract")).toBeNull();
}

function repositoryDetail(nameWithOwner: string): RepositoryDetail {
  const summary = repositorySummary(nameWithOwner);
  return {
    ...summary,
    homepageUrl: "https://control.test",
    licenseName: "MIT License",
    licenseSpdxId: "MIT",
    topics: ["electron", "github"],
    branchCount: 3,
    tagCount: 2,
    readmeMarkdown: "# Initial readme",
    htmlUrl: `https://github.com/${nameWithOwner}`,
    languages: [{ name: "TypeScript", color: "#3178c6", size: 1200, percent: 100 }],
    parent: null,
    source: null,
    viewerState: {
      hasStarred: true,
      subscription: "SUBSCRIBED",
      permission: "ADMIN",
      canAdminister: true,
      canSubscribe: true
    },
    permissions: {
      viewerPermission: "ADMIN",
      isArchived: false,
      isDisabled: false
    },
    administration: {
      visibility: summary.visibility,
      defaultBranch: summary.defaultBranch,
      isPrivate: summary.isPrivate,
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
        allowAutoMerge: false,
        deleteBranchOnMerge: false,
        allowUpdateBranch: true
      },
      viewerPermissions: {
        admin: true,
        maintain: true,
        push: true,
        triage: true,
        pull: true
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
