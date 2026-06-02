import type {
  GitHubReadAvailability,
  RepoListInput,
  RepositoryListResult,
  RepositorySummary
} from "@shared/github";
import type { CacheEntry, CachedRepositoryList, LocalStore } from "../storage";
import { Effect, Ref } from "effect";

interface RepositoryStatusReadCacheDependencies {
  store: Pick<
    LocalStore,
    | "clearCacheByPrefix"
    | "getCacheEntry"
    | "listGitHubRepositoriesWithMetadata"
    | "setCache"
    | "setGitHubRepositoriesWithStatusCache"
  >;
  ttlMs: number;
  refreshLive(input: RepoListInput): Promise<RepositoryListResult>;
  areMateriallyEqual(previous: RepositorySummary[], next: RepositorySummary[]): boolean;
  onRepositoryDataUpdated(): void;
  log(message: string, metadata?: Record<string, unknown>): void;
}

const repositoryStatusAvailability = { status: "available", message: null } as const;
const permanentMissTtlMs = 60_000;
const repositoryStatusNegativeCachePrefix = "negative:repositories-with-status:";
type InFlightRequests = Map<string, Promise<unknown>>;

export class GitHubReadCache {
  private readonly inFlight = Effect.runSync(Ref.make<InFlightRequests>(new Map()));
  private readonly stores = new Set<RepositoryStatusReadCacheDependencies["store"]>();

  async listRepositoriesWithStatus(
    input: RepoListInput,
    dependencies: RepositoryStatusReadCacheDependencies
  ): Promise<RepositoryListResult> {
    this.stores.add(dependencies.store);
    const limit = input.limit ?? 50;
    const cacheKey = repositoryStatusCacheKey(limit);
    const negativeCacheKey = repositoryStatusNegativeCacheKey(limit);
    const cached = dependencies.store.listGitHubRepositoriesWithMetadata(limit);
    const cachedResult = dependencies.store.getCacheEntry<RepositoryListResult>("github", cacheKey);
    const cachedNegativeResult = dependencies.store.getCacheEntry<RepositoryListResult>(
      "github",
      negativeCacheKey
    );

    if (input.cacheOnly) {
      return this.readRepositoryStatusCacheOnly(
        cacheKey,
        cached,
        cachedResult,
        cachedNegativeResult,
        dependencies.log
      );
    }

    if (input.forceRefresh) {
      return this.refreshRepositoriesWithStatus(input, dependencies);
    }

    if (cached.items.length > 0) {
      if (repositoryCacheIsFresh(cached, dependencies.ttlMs)) {
        dependencies.log("repository list status cache hit", { count: cached.items.length });
        return { items: cached.items, availability: repositoryStatusAvailability };
      } else {
        dependencies.log("repository list status stale hit", { count: cached.items.length });
        this.refreshInBackground(() => this.refreshRepositoriesWithStatus(input, dependencies));
        return repositoryStatusStaleRows(
          cached.items,
          "Showing cached repository data while Control refreshes it from GitHub."
        );
      }
    }

    if (cachedResult) {
      if (cachedResult.isExpired) {
        dependencies.log("repository list status stale result", {
          count: cachedResult.payload.items.length
        });
        this.refreshInBackground(() => this.refreshRepositoriesWithStatus(input, dependencies));
        return repositoryStatusStaleResult(
          cachedResult.payload,
          "Showing cached repository data while Control refreshes it from GitHub."
        );
      } else {
        dependencies.log("repository list status cache result", {
          count: cachedResult.payload.items.length
        });
        return cachedResult.payload;
      }
    }

    if (cachedNegativeResult && !cachedNegativeResult.isExpired) {
      dependencies.log("repository list status negative cache hit", {
        cacheKey: negativeCacheKey
      });
      return cachedNegativeResult.payload;
    }

    return this.refreshRepositoriesWithStatus(input, dependencies);
  }

  async refreshRepositoriesWithStatus(
    input: RepoListInput,
    dependencies: RepositoryStatusReadCacheDependencies
  ): Promise<RepositoryListResult> {
    const identity = repositoryStatusRequestIdentity(input);
    return this.dedupe(identity, async () => {
      const limit = input.limit ?? 50;
      const cacheKey = repositoryStatusCacheKey(limit);
      const previousCache = dependencies.store.listGitHubRepositoriesWithMetadata(limit);
      const previous = previousCache.items;
      const cachedResult = dependencies.store.getCacheEntry<RepositoryListResult>("github", cacheKey);
      const result = await this.refreshLiveWithRepositoryStatusFallback(
        input,
        dependencies,
        previousCache,
        cachedResult
      );
      if (result.availability.status === "available") {
        dependencies.store.setGitHubRepositoriesWithStatusCache({
          repositories: result.items,
          cacheKey,
          result,
          etag: null,
          expiresAt: new Date(Date.now() + dependencies.ttlMs).toISOString()
        });
        const changed = !dependencies.areMateriallyEqual(previous, result.items);
        if (changed) {
          dependencies.onRepositoryDataUpdated();
        }
        dependencies.log(
          changed
            ? "repository list status live refresh changed"
            : "repository list status live refresh unchanged",
          { count: result.items.length }
        );
      } else if (isPermanentNotFound(result.availability)) {
        const negativeCacheKey = repositoryStatusNegativeCacheKey(limit);
        dependencies.store.setCache({
          provider: "github",
          cacheKey: negativeCacheKey,
          payload: result,
          etag: null,
          expiresAt: new Date(Date.now() + permanentMissTtlMs).toISOString()
        });
        dependencies.log("repository list status negative cache write", {
          cacheKey: negativeCacheKey
        });
      }
      return result;
    });
  }

  invalidate(identityPrefix?: string): void {
    for (const store of this.stores) {
      store.clearCacheByPrefix("github", repositoryStatusNegativeCachePrefix);
    }

    if (!identityPrefix) {
      Effect.runSync(Ref.set(this.inFlight, new Map()));
      return;
    }

    Effect.runSync(
      Ref.update(this.inFlight, (requests) => {
        const next = new Map(requests);
        for (const identity of next.keys()) {
          if (identity.startsWith(identityPrefix)) {
            next.delete(identity);
          }
        }
        return next;
      })
    );
  }

  private readRepositoryStatusCacheOnly(
    cacheKey: string,
    cached: CachedRepositoryList<RepositorySummary>,
    cachedResult: CacheEntry<RepositoryListResult> | null,
    cachedNegativeResult: CacheEntry<RepositoryListResult> | null,
    log: RepositoryStatusReadCacheDependencies["log"]
  ): RepositoryListResult {
    if (cached.items.length > 0) {
      log("repository list status cache-only", { count: cached.items.length });
      return { items: cached.items, availability: repositoryStatusAvailability };
    }
    if (cachedResult) {
      log("repository list status cache-only result", {
        count: cachedResult.payload.items.length
      });
      return cachedResult.payload;
    }
    if (cachedNegativeResult && !cachedNegativeResult.isExpired) {
      log("repository list status cache-only negative result", {
        cacheKey: repositoryStatusNegativeCacheKeyFromStatusCacheKey(cacheKey)
      });
      return cachedNegativeResult.payload;
    }
    return {
      items: [],
      availability: notLoadedAvailability(cacheKey)
    };
  }

  private async refreshLiveWithRepositoryStatusFallback(
    input: RepoListInput,
    dependencies: RepositoryStatusReadCacheDependencies,
    cached: CachedRepositoryList<RepositorySummary>,
    cachedResult: CacheEntry<RepositoryListResult> | null
  ): Promise<RepositoryListResult> {
    try {
      const result = await dependencies.refreshLive(input);
      if (result.availability.status !== "available") {
        return staleRepositoryStatusFallback(result, cached, cachedResult, dependencies.log);
      }
      return result;
    } catch (error) {
      const liveResult: RepositoryListResult = isPermanentNotFoundError(error)
        ? permanentNotFoundResult(error)
        : {
            items: [],
            availability: {
              status: "error",
              message: error instanceof Error ? error.message : "GitHub repository list is unavailable."
            }
          };
      return staleRepositoryStatusFallback(liveResult, cached, cachedResult, dependencies.log);
    }
  }

  private async dedupe<T>(identity: string, load: () => Promise<T>): Promise<T> {
    const existing = Effect.runSync(Ref.get(this.inFlight)).get(identity) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = load().finally(() => {
      Effect.runSync(
        Ref.update(this.inFlight, (requests) => {
          const next = new Map(requests);
          next.delete(identity);
          return next;
        })
      );
    });
    Effect.runSync(
      Ref.update(this.inFlight, (requests) => {
        const next = new Map(requests);
        next.set(identity, promise);
        return next;
      })
    );
    return promise;
  }

  private refreshInBackground(load: () => Promise<unknown>): void {
    void load().catch((error) => {
      console.warn("Control could not refresh GitHub cache.", error);
    });
  }
}

function repositoryStatusCacheKey(limit: number): string {
  return `repositories-with-status:${limit}`;
}

export function repositoryStatusNegativeCacheKey(limit: number): string {
  return `${repositoryStatusNegativeCachePrefix}${limit}`;
}

export function repositoryStatusRequestIdentity(input: RepoListInput): string {
  return JSON.stringify({
    endpoint: "repositories-with-status",
    limit: input.limit ?? 50,
    cacheOnly: input.cacheOnly === true,
    forceRefresh: input.forceRefresh === true
  });
}

function repositoryCacheIsFresh(cache: CachedRepositoryList<unknown>, ttlMs: number): boolean {
  if (!cache.syncedAt) {
    return false;
  }
  return Date.now() - Date.parse(cache.syncedAt) < ttlMs;
}

function notLoadedAvailability(cacheKey: string): GitHubReadAvailability {
  return {
    status: "not_loaded",
    message: `No cached GitHub data for ${cacheKey}. Sign in with GitHub to refresh it.`
  };
}

function repositoryStatusNegativeCacheKeyFromStatusCacheKey(cacheKey: string): string {
  return cacheKey.replace("repositories-with-status:", repositoryStatusNegativeCachePrefix);
}

function staleRepositoryStatusFallback(
  liveResult: RepositoryListResult,
  cached: CachedRepositoryList<RepositorySummary>,
  cachedResult: CacheEntry<RepositoryListResult> | null,
  log: RepositoryStatusReadCacheDependencies["log"]
): RepositoryListResult {
  if (cached.items.length > 0) {
    log("repository list status live refresh failed with stale rows fallback", {
      count: cached.items.length,
      status: liveResult.availability.status
    });
    return repositoryStatusStaleRows(
      cached.items,
      repositoryStatusStaleFallbackMessage(liveResult.availability)
    );
  }

  if (cachedResult) {
    log("repository list status live refresh failed with stale result fallback", {
      count: cachedResult.payload.items.length,
      status: liveResult.availability.status
    });
    return repositoryStatusStaleResult(
      cachedResult.payload,
      repositoryStatusStaleFallbackMessage(liveResult.availability)
    );
  }

  return liveResult;
}

function repositoryStatusStaleRows(items: RepositorySummary[], message: string): RepositoryListResult {
  return {
    items,
    availability: {
      status: "stale",
      message
    }
  };
}

function repositoryStatusStaleResult(result: RepositoryListResult, message: string): RepositoryListResult {
  return {
    ...result,
    availability: {
      status: "stale",
      message
    }
  };
}

function repositoryStatusStaleFallbackMessage(availability: GitHubReadAvailability): string {
  const reason = availability.message
    ? `${availability.status}: ${availability.message}`
    : availability.status;
  return `Showing cached repository data because GitHub refresh failed with ${trimTerminalPeriod(reason)}.`;
}

function trimTerminalPeriod(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function isPermanentNotFound(availability: GitHubReadAvailability): boolean {
  return availability.status === "error" && availability.message?.toLowerCase().includes("404") === true;
}

function isPermanentNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { status?: unknown }).status === 404;
}

function permanentNotFoundResult(error: unknown): RepositoryListResult {
  return {
    items: [],
    availability: {
      status: "error",
      message: error instanceof Error ? error.message : "GitHub repository list was not found."
    }
  };
}
