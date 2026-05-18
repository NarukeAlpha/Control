# Codebase Cleanup & Deepening Plan
## Goal
Improve architectural depth, testability, and AI-navigability of the Control codebase, prioritizing correctness and robustness while explicitly avoiding unnecessary "defensive" programming.
## Architectural Initiatives (Re-evaluated with Effect-TS Foundation)
### 1. Foundation: Leverage Effect-TS in the Backend
- **Problem:** The backend relies heavily on manual state management, traditional `Promise`-based concurrency, and monolithic classes (e.g., `GitHubProviderManager`). Polling, caching, and deduplication are handled via fragile manual boilerplate (e.g., `inFlight` maps, `setTimeout` loops).
- **Solution:** Introduce the `effect` (Effect-TS) library strictly within the main process (`src/main/`).
    - Set up `Context.Tag` for Dependency Injection (DI) to construct an `AppLayer`.
    - Prepare dynamic IPC bridging using `Effect.runPromiseExit` to safely encode `Success`/`Failure` without throwing raw exceptions across the bridge.
- **Benefits:** Eliminates massive amounts of manual state boilerplate. Provides a robust foundation for DI, concurrency, and typed errors for the rest of the backend refactoring.
### 2. Refactor Storage Layer with Effect
- **Problem:** `SqliteLocalStore` mixes raw SQL table creation, query execution, and manual serialization into an 800-line module, acting as a shallow pass-through that can crash the main process on constraint errors.
- **Solution:** Break the store into specialized Effect services (e.g., `SettingsStore`, `RecentItemsStore`) using `Context.Tag`. Wrap all synchronous `better-sqlite3` calls in `Effect.try` to yield `Data.TaggedError` (e.g., `DatabaseError`) instead of throwing exceptions.
- **Benefits:** Strong **locality** for database queries, isolation of domains, and guaranteed safety against database-induced process crashes.
### 3. Deepen GitHub Provider Architecture with Effect
- **Problem:** The `GitHubProvider` exposes ~85 flat methods. `OctokitProvider` is a 6,000+ line God Class. `GitHubProviderManager` wraps every method with identical caching logic (~350 lines of boilerplate).
- **Solution:** Deconstruct the God Class into domain-specific Effect services (`IssueService`, `RepositoryService`). Replace manual `inFlight` maps and caching factories with Effect's native `Request` and `RequestResolver` for automatic batching, deduplication, and TTL caching. Replace `setTimeout` polling for auth with Effect's `Schedule` API.
- **Benefits:** High **locality** and the complete elimination of manual caching, polling, and promise-tracking boilerplate.
### 4. Streamline IPC and Preload Architecture
- **Problem:** Redundant read channels (raw vs. `WithStatus`), bloated payloads (e.g., monolithic `PullRequestDetail`), and highly coupled wiring boilerplate.
- **Solution:** Prune non-`WithStatus` endpoints and decompose monolithic queries. Replace individual static channel registrations in `main/index.ts` with a dynamic generic dispatcher tied to the Effect `AppLayer`.
- **Benefits:** Reduces IPC bridge congestion, prevents main process micro-stutters, and eliminates ~200 lines of fragile handler mapping.
### 5. Deepen the UI Architecture (Deconstruct `App.tsx`)
- **Problem:** `App.tsx` is an unmanageable 24,000+ line monolith housing 12 tab surfaces, 64 `useQuery` hooks, and shared UI primitives. Rendering a single tab evaluates logic for inactive tabs.
- **Solution:** Extract each tab surface into its own component in `src/renderer/src/components/` (e.g., `RepositoryIssues.tsx`). Co-locate their specific `useQuery` hooks within these components. Extract shared UI primitives (`GlassPanel`, `AvailabilityBanner`, `ExpandableList`).
- **Benefits:** Concentrates change. Isolates renders behind clear component **seams** and automatically dedupes queries via React Query.
### 6. Eliminate Defensive Types
- **Problem:** Domain types use `?: unknown` for GraphQL response shapes, forcing the renderer to use 56+ `as` casts and 30+ `??` fallback chains to guard against `null`s that shouldn't exist.
- **Solution:** Harden the **interface** of domain types in `src/shared/github.ts` (e.g., `GitHubLanguageNode`). Remove redundant runtime guards and rely on strict return types alongside React Query's `isSuccess && data` pattern.
- **Benefits:** Clean domain models, reducing boilerplate, and gaining **leverage** from the TypeScript compiler.
### 7. Refactor Renderer Utilities & State
- **Problem:** Zero hooks/components outside `App.tsx`. Redundant state actions in `uiStore.ts`, inefficient string allocations in markdown parsing, and highly repetitive data mock reading logic.
- **Solution:** Extract `components/` and `hooks/`, unify redundant actions (e.g., `goToRepository`), switch to regex for markdown heading extraction, and build generic data readers.
- **Benefits:** Removes duplicate state logic, improves memory efficiency, and deflates `mock.ts` boilerplate significantly.
### 8. Deduplicate Shared Contracts
- **Problem:** `ControlApi` manually re-declares 100+ `GitHubProvider` methods, 40+ specific result boilerplate interfaces exist, and payloads use overly loose `Record<string, unknown>` and flattened structures.
- **Solution:** Import `GitHubProvider` directly into `ipc.ts`, use generic `GitHubListResult<T>`, implement a discriminated union for `GitHubMutationInput`, and compose objects instead of flattening.
- **Benefits:** Massive reduction in duplicated type contracts and stronger compiler confidence across the IPC gap.
### 9. Normalize Tests and Mocks
- **Problem:** Monolithic files like `mock.ts` and `App.test.tsx`, localized instead of centralized factory duplication, and an over-reliance on slow Playwright scripts to validate React state.
- **Solution:** Split mock files by domain, centralize test factories in `tests/factories/`, and port React UI state tests from E2E to React Testing Library.
- **Benefits:** Faster CI runs, reduced test brittleness, and DRY mock data.