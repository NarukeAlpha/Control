import { describe, expect, it, vi } from "vitest";

import type { RepositoryListResult, RepositorySummary } from "@shared/github";
import type { CacheEntry, CachedRepositoryList, LocalStore } from "../storage";
import {
  GitHubReadCache,
  repositoryStatusNegativeCacheKey,
  repositoryStatusRequestIdentity
} from "./readCache";

describe("GitHubReadCache", () => {
  it("keeps request identity distinct for limits and cache modes", () => {
    expect(repositoryStatusRequestIdentity({ limit: 10 })).not.toBe(
      repositoryStatusRequestIdentity({ limit: 20 })
    );
    expect(repositoryStatusRequestIdentity({ limit: 10 })).not.toBe(
      repositoryStatusRequestIdentity({ limit: 10, cacheOnly: true })
    );
    expect(repositoryStatusRequestIdentity({ limit: 10 })).not.toBe(
      repositoryStatusRequestIdentity({ limit: 10, forceRefresh: true })
    );
  });

  it("serves cache-only repository rows before generic result cache", async () => {
    const repository = repositorySummary("NarukeAlpha/control");
    const store = createStore({
      repositoryRows: { items: [repository], syncedAt: new Date().toISOString() },
      genericResult: {
        payload: {
          items: [repositorySummary("NarukeAlpha/other")],
          availability: { status: "available", message: null }
        },
        isExpired: false
      }
    });
    const cache = new GitHubReadCache();

    await expect(cache.listRepositoriesWithStatus({ cacheOnly: true }, dependencies(store))).resolves.toEqual(
      {
        items: [repository],
        availability: { status: "available", message: null }
      }
    );
  });

  it("serves fresh repository rows without a live refresh", async () => {
    const repository = repositorySummary("NarukeAlpha/control");
    const store = createStore({
      repositoryRows: { items: [repository], syncedAt: new Date().toISOString() }
    });
    const refreshLive = vi.fn();
    const cache = new GitHubReadCache();

    await expect(cache.listRepositoriesWithStatus({}, dependencies(store, { refreshLive }))).resolves.toEqual(
      {
        items: [repository],
        availability: { status: "available", message: null }
      }
    );

    expect(refreshLive).not.toHaveBeenCalled();
  });

  it("returns cache-only not_loaded when no durable cache exists", async () => {
    const cache = new GitHubReadCache();

    await expect(
      cache.listRepositoriesWithStatus({ cacheOnly: true, limit: 5 }, dependencies(createStore()))
    ).resolves.toEqual({
      items: [],
      availability: {
        status: "not_loaded",
        message: "No cached GitHub data for repositories-with-status:5. Sign in with GitHub to refresh it."
      }
    });
  });

  it("dedupes concurrent live refreshes and persists available results transactionally", async () => {
    const repository = repositorySummary("NarukeAlpha/control");
    const store = createStore();
    const refreshLive = vi.fn(
      async (): Promise<RepositoryListResult> => ({
        items: [repository],
        availability: { status: "available", message: null }
      })
    );
    const updated = vi.fn();
    const cache = new GitHubReadCache();
    const deps = dependencies(store, { refreshLive, onRepositoryDataUpdated: updated });

    const [first, second] = await Promise.all([
      cache.listRepositoriesWithStatus({ limit: 1, forceRefresh: true }, deps),
      cache.listRepositoriesWithStatus({ limit: 1, forceRefresh: true }, deps)
    ]);

    expect(first).toBe(second);
    expect(refreshLive).toHaveBeenCalledTimes(1);
    expect(store.setGitHubRepositoriesWithStatusCache).toHaveBeenCalledWith(
      expect.objectContaining({
        repositories: [repository],
        cacheKey: "repositories-with-status:1",
        result: first
      })
    );
    expect(updated).toHaveBeenCalledTimes(1);
  });

  it("force refreshes even when fresh rows exist", async () => {
    const staleRepository = repositorySummary("NarukeAlpha/stale");
    const freshRepository = repositorySummary("NarukeAlpha/fresh");
    const store = createStore({
      repositoryRows: { items: [staleRepository], syncedAt: new Date().toISOString() }
    });
    const refreshLive = vi.fn(
      async (): Promise<RepositoryListResult> => ({
        items: [freshRepository],
        availability: { status: "available", message: null }
      })
    );
    const cache = new GitHubReadCache();

    await expect(
      cache.listRepositoriesWithStatus({ forceRefresh: true }, dependencies(store, { refreshLive }))
    ).resolves.toEqual({
      items: [freshRepository],
      availability: { status: "available", message: null }
    });

    expect(refreshLive).toHaveBeenCalledTimes(1);
  });

  it("falls back to stale rows when live refresh returns an error", async () => {
    const repository = repositorySummary("NarukeAlpha/stale");
    const store = createStore({
      repositoryRows: { items: [repository], syncedAt: "2020-01-01T00:00:00.000Z" }
    });
    const refreshLive = vi.fn(
      async (): Promise<RepositoryListResult> => ({
        items: [],
        availability: { status: "error", message: "GitHub is unavailable." }
      })
    );
    const cache = new GitHubReadCache();

    await expect(
      cache.listRepositoriesWithStatus({ forceRefresh: true }, dependencies(store, { refreshLive }))
    ).resolves.toEqual({
      items: [repository],
      availability: { status: "available", message: null }
    });
  });

  it("returns live errors when no stale cache exists", async () => {
    const store = createStore();
    const errorResult: RepositoryListResult = {
      items: [],
      availability: { status: "error", message: "GitHub is unavailable." }
    };
    const cache = new GitHubReadCache();

    await expect(
      cache.listRepositoriesWithStatus(
        { forceRefresh: true },
        dependencies(store, { refreshLive: vi.fn(async () => errorResult) })
      )
    ).resolves.toBe(errorResult);
  });

  it("does not expose a half-written cache result when the transactional write fails", async () => {
    const previousRepository = repositorySummary("NarukeAlpha/previous");
    const nextRepository = repositorySummary("NarukeAlpha/next");
    const store = createStore({
      genericResult: {
        payload: {
          items: [previousRepository],
          availability: { status: "available", message: null }
        }
      }
    });
    vi.mocked(store.setGitHubRepositoriesWithStatusCache).mockImplementationOnce(() => {
      throw new Error("write failed");
    });
    const cache = new GitHubReadCache();

    await expect(
      cache.listRepositoriesWithStatus(
        { forceRefresh: true },
        dependencies(store, {
          refreshLive: vi.fn(
            async (): Promise<RepositoryListResult> => ({
              items: [nextRepository],
              availability: { status: "available", message: null }
            })
          )
        })
      )
    ).rejects.toThrow("write failed");

    await expect(cache.listRepositoriesWithStatus({ cacheOnly: true }, dependencies(store))).resolves.toEqual(
      {
        items: [previousRepository],
        availability: { status: "available", message: null }
      }
    );
  });

  it("caches permanent 404 misses briefly and expires them by TTL", async () => {
    const store = createStore();
    const refreshLive = vi.fn(async () => {
      throw Object.assign(new Error("404 Not Found"), { status: 404 });
    });
    const cache = new GitHubReadCache();
    const deps = dependencies(store, { refreshLive });

    await expect(cache.listRepositoriesWithStatus({ limit: 3 }, deps)).resolves.toEqual({
      items: [],
      availability: { status: "error", message: "404 Not Found" }
    });
    await expect(cache.listRepositoriesWithStatus({ limit: 3 }, deps)).resolves.toEqual({
      items: [],
      availability: { status: "error", message: "404 Not Found" }
    });

    expect(refreshLive).toHaveBeenCalledTimes(1);
    expect(store.setCache).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "github",
        cacheKey: repositoryStatusNegativeCacheKey(3)
      })
    );

    store.expireCache(repositoryStatusNegativeCacheKey(3));
    await cache.listRepositoriesWithStatus({ limit: 3 }, deps);
    expect(refreshLive).toHaveBeenCalledTimes(2);
  });

  it("explicit invalidation clears negative cache entries", async () => {
    const store = createStore();
    const refreshLive = vi.fn(async () => {
      throw Object.assign(new Error("404 Not Found"), { status: 404 });
    });
    const cache = new GitHubReadCache();
    const deps = dependencies(store, { refreshLive });

    await cache.listRepositoriesWithStatus({ limit: 2 }, deps);
    cache.invalidate();
    await cache.listRepositoriesWithStatus({ limit: 2 }, deps);

    expect(refreshLive).toHaveBeenCalledTimes(2);
    expect(store.clearCacheByPrefix).toHaveBeenCalledWith("github", "negative:repositories-with-status:");
  });

  it("invalidation lets a new request bypass an older in-flight refresh", async () => {
    const store = createStore();
    const firstRepository = repositorySummary("NarukeAlpha/first");
    const secondRepository = repositorySummary("NarukeAlpha/second");
    let resolveFirst!: (value: RepositoryListResult) => void;
    const refreshLive = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<RepositoryListResult>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
        items: [secondRepository],
        availability: { status: "available", message: null }
      });
    const cache = new GitHubReadCache();
    const deps = dependencies(store, { refreshLive });

    const first = cache.listRepositoriesWithStatus({ forceRefresh: true }, deps);
    cache.invalidate(repositoryStatusRequestIdentity({ forceRefresh: true }));
    const second = cache.listRepositoriesWithStatus({ forceRefresh: true }, deps);
    resolveFirst({ items: [firstRepository], availability: { status: "available", message: null } });

    await expect(second).resolves.toEqual({
      items: [secondRepository],
      availability: { status: "available", message: null }
    });
    await expect(first).resolves.toEqual({
      items: [firstRepository],
      availability: { status: "available", message: null }
    });
    expect(refreshLive).toHaveBeenCalledTimes(2);
  });

  it("returns stale rows immediately and refreshes in the background", async () => {
    const staleRepository = repositorySummary("NarukeAlpha/stale");
    const freshRepository = repositorySummary("NarukeAlpha/fresh");
    const store = createStore({
      repositoryRows: { items: [staleRepository], syncedAt: "2020-01-01T00:00:00.000Z" }
    });
    let resolveRefresh!: (value: RepositoryListResult) => void;
    const refreshLive = vi.fn(
      () =>
        new Promise<RepositoryListResult>((resolve) => {
          resolveRefresh = resolve;
        })
    );
    const cache = new GitHubReadCache();

    await expect(cache.listRepositoriesWithStatus({}, dependencies(store, { refreshLive }))).resolves.toEqual(
      {
        items: [staleRepository],
        availability: { status: "available", message: null }
      }
    );

    expect(refreshLive).toHaveBeenCalledTimes(1);
    resolveRefresh({ items: [freshRepository], availability: { status: "available", message: null } });
    await Promise.resolve();
    await Promise.resolve();
    expect(store.setGitHubRepositoriesWithStatusCache).toHaveBeenCalledWith(
      expect.objectContaining({ repositories: [freshRepository] })
    );
  });
});

function dependencies(
  store: ReturnType<typeof createStore>,
  overrides: Partial<{
    refreshLive: (input: {
      limit?: number;
      cacheOnly?: boolean;
      forceRefresh?: boolean;
    }) => Promise<RepositoryListResult>;
    onRepositoryDataUpdated: () => void;
  }> = {}
) {
  return {
    store,
    ttlMs: 30_000,
    refreshLive:
      overrides.refreshLive ??
      (async () => ({ items: [], availability: { status: "available", message: null } })),
    areMateriallyEqual: (previous: RepositorySummary[], next: RepositorySummary[]) =>
      JSON.stringify(previous) === JSON.stringify(next),
    onRepositoryDataUpdated: overrides.onRepositoryDataUpdated ?? vi.fn(),
    log: vi.fn()
  };
}

function createStore(
  input: {
    repositoryRows?: CachedRepositoryList<RepositorySummary>;
    genericResult?: Partial<CacheEntry<RepositoryListResult>> &
      Pick<CacheEntry<RepositoryListResult>, "payload">;
  } = {}
) {
  const entries = new Map<string, CacheEntry<RepositoryListResult>>();
  if (input.genericResult) {
    entries.set("repositories-with-status:50", {
      etag: null,
      expiresAt: null,
      updatedAt: null,
      isExpired: false,
      ...input.genericResult
    });
  }
  const store = {
    listGitHubRepositoriesWithMetadata: vi.fn(() => input.repositoryRows ?? { items: [], syncedAt: null }),
    getCacheEntry: vi.fn((_provider: string, cacheKey: string) => entries.get(cacheKey) ?? null),
    setCache: vi.fn(
      (record: { cacheKey: string; payload: RepositoryListResult; expiresAt: string | null }) => {
        entries.set(record.cacheKey, {
          payload: record.payload,
          etag: null,
          expiresAt: record.expiresAt,
          updatedAt: null,
          isExpired: false
        });
      }
    ),
    clearCacheByPrefix: vi.fn((_provider: string, cacheKeyPrefix: string) => {
      for (const cacheKey of entries.keys()) {
        if (cacheKey.startsWith(cacheKeyPrefix)) {
          entries.delete(cacheKey);
        }
      }
    }),
    setGitHubRepositoriesWithStatusCache: vi.fn(
      (record: { repositories: RepositorySummary[]; cacheKey: string; result: RepositoryListResult }) => {
        input.repositoryRows = { items: record.repositories, syncedAt: new Date().toISOString() };
        entries.set(record.cacheKey, {
          payload: record.result,
          etag: null,
          expiresAt: null,
          updatedAt: null,
          isExpired: false
        });
      }
    ),
    expireCache(cacheKey: string): void {
      const entry = entries.get(cacheKey);
      if (entry) {
        entries.set(cacheKey, { ...entry, isExpired: true });
      }
    }
  } as unknown as Pick<
    LocalStore,
    | "clearCacheByPrefix"
    | "getCacheEntry"
    | "listGitHubRepositoriesWithMetadata"
    | "setCache"
    | "setGitHubRepositoriesWithStatusCache"
  > & {
    expireCache(cacheKey: string): void;
  };
  return store;
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
