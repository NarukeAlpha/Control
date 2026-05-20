# Codebase Cleanup & Deepening Plan

## Goal

Improve architectural depth, testability, and AI-navigability of the Control codebase while preserving
correctness, reliability, and predictable behavior during auth, caching, reconnects, and partial failures.

The themes below are intentionally preserved from the original plan. The change is that each theme now has a
deterministic checklist: owned files, non-goals, vertical slices, acceptance criteria, required tests, validation,
and traps that should not count as completion.

## Execution Rules

- Keep every change vertical and reviewable. A cleanup task is complete only when a real runtime path changes,
  tests prove the changed path, and obsolete scaffolding or duplicate code is removed.
- Preserve process boundaries: `src/main` owns GitHub auth/provider orchestration/storage, `src/preload` owns the
  typed IPC bridge, `src/renderer/src` owns React UI/state/query composition, and `src/shared` owns serializable
  contracts.
- Use Effect only in `src/main`. Do not leak Effect types into `src/shared`, `src/preload`, or `src/renderer/src`.
- Treat `unknown` as valid at real seams only: IPC inputs, storage deserialization, remote API responses, OAuth
  payloads, and mutation payloads while they are still being converted. Narrow before renderer code consumes data.
- Do not add e2e tests unless a task explicitly says to change e2e coverage.
- Use repository scripts for validation: `bun run format`, `bun run lint`, `bun run typecheck`, and `bun run test`.
  Never call `vitest` directly.

## Completion Evidence Required

Every implementation branch should include this evidence in its summary:

- Runtime path changed: which old path was removed or bypassed, and which new module now owns it.
- Tests added or updated: exact files and the behavior each test protects.
- Validation run: exact commands and pass/fail result.
- Scope discipline: anything intentionally left out because it belongs to a different cleanup task.
- Residual risk: remaining behavior that is not yet proven by tests.

## Scoring Rubric

- 3 points: a live runtime path changed, not just scaffolding.
- 2 points: existing behavior and process boundaries were preserved.
- 2 points: tests cover the changed seam and failure modes.
- 1 point: duplicate or dead architecture was removed.
- 1 point: `bun run format`, `bun run lint`, `bun run typecheck`, and relevant tests pass.
- 1 point: the change increases leverage or locality through a deeper module interface.

## Sequencing

1. Task 1 must land before Effect-based storage, provider, or IPC work.
2. Task 2 should land before broad GitHub provider and IPC Effect migration.
3. Task 8 should land before task 4 if possible, because a deeper shared contract gives IPC cleanup better leverage.
4. Task 7's renderer utility seams should land before the largest renderer extractions in task 5.
5. Task 9 can start independently only with read-only fixtures or the notifications mock slice. Issue, pull,
   release, and action mutation mock extraction waits for task 8's mutation contract cleanup.
6. Task 9 must reuse task 7's mock storage adapter when that adapter exists. If task 7 has not landed, task 9 may
   add shared mock constants and availability helpers but must not create a competing `localStorage` seam.
7. Do not delete Playwright coverage solely because an RTL state assertion exists. Keep Playwright cases that prove
   layout, z-index, focus, bubbling, or pointer behavior.

## Architectural Initiatives

### 1. Foundation: Leverage Effect-TS In The Backend

**Problem:** The backend relies heavily on manual state management, Promise-based concurrency, and monolithic
main-process modules. Polling, caching, and deduplication are handled with manual boilerplate such as `inFlight`
maps and `setTimeout` loops.

**Intent:** Introduce Effect as a main-process module seam, not as a broad rewrite. The first useful depth is a
small Effect-backed IPC adapter that proves typed dependencies and typed failures without changing renderer-facing
behavior.

**Owned files:**

- `package.json` and the lockfile: add `effect` as a runtime dependency.
- New `src/main/effect/errors.ts`, `src/main/effect/services.ts`, `src/main/effect/appLayer.ts`,
  `src/main/effect/ipcBridge.ts`.
- `src/main/index.ts`: wire the app layer and migrate only pilot IPC handlers.
- New `src/main/effect/*.test.ts`.

**Out of scope:**

- No storage module split, Octokit/provider decomposition, request caching, auth schedule rewrite, shared IPC
  contract changes, renderer changes, or broad dynamic dispatcher.

**Checklist:**

- [ ] Add `effect` as a declared dependency.
- [ ] Define typed backend failures and deterministic IPC-safe failure encoding.
- [ ] Add `Context.Tag` interfaces for existing concrete dependencies such as local store, GitHub manager, and
      external-link opening.
- [ ] Build an `AppLayer` from existing bootstrap dependencies. Do not use globals or a hidden service locator.
- [ ] Create one managed `Runtime<AppLayer>` during bootstrap and reuse it for IPC invocations. Do not rebuild the
      layer per request.
- [ ] Add an IPC bridge that runs Effect through `Effect.runPromiseExit` and converts success/failure back to the
      current Electron promise contract.
- [ ] Convert typed failures to JSON-safe payloads or native `Error` instances before crossing Electron IPC. Never
      reject with a raw `Data.TaggedError`, `Cause`, or arbitrary Effect failure object.
- [ ] Log unexpected defects with backend diagnostic detail before returning a sanitized renderer-facing error.
- [ ] Define the cancellation policy for long-running Effects. If cross-IPC cancellation is not implemented in this
      slice, document that renderer unmounts do not interrupt the running Effect.
- [ ] Migrate one local synchronous pilot, such as `getSettings`.
- [ ] Migrate one low-risk async pilot, such as `openExternal`.
- [ ] Remove any duplicate direct handlers for the migrated pilot channels.

**Acceptance criteria:**

- Effect imports are localized to `src/main/effect` and narrow `src/main/index.ts` wiring.
- The pilots preserve the existing `ControlApi` shape.
- Typed failures keep expected error details; unexpected defects are sanitized.
- Electron IPC never receives raw Effect failure objects that structured clone can reduce to `{}`.
- Unexpected defects are logged before sanitization.
- The `AppLayer` runtime is built once during bootstrap, not once per IPC call.
- Long-running handler interruption behavior is explicit and tested or intentionally deferred.
- Existing cache/auth/provider behavior is unchanged.

**Required tests:**

- `ipcBridge` returns success payloads unchanged.
- `ipcBridge` maps tagged failures to deterministic IPC-safe failures.
- `ipcBridge` does not serialize tagged failures into empty renderer-side objects.
- `ipcBridge` sanitizes defects and rejected unknown values while calling the backend logger with the unsanitized
  cause.
- `appLayer` or registration tests prove the managed runtime is created once and reused.
- `openExternal` still rejects non-HTTPS URLs.
- `getSettings` returns store settings through the Effect adapter.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

**Do not count as done:**

- Adding the dependency only.
- Wrapping every promise in `Effect.promise` with no module seam.
- Changing renderer-facing return shapes.
- Starting storage, provider, or IPC rewrites inside this foundation task.

**Deeper implementation notes:**

- Start with the two live handlers in `src/main/index.ts`: `ipcChannels.getSettings` currently calls
  `store.getSettings()` directly, and `ipcChannels.openExternal` validates `url.startsWith("https://")` before
  `shell.openExternal(url)`.
- Build the Effect layer from the already-created bootstrap dependencies: `store`, `github`, and an external-link
  opener wrapping `shell.openExternal`. Wire it immediately before IPC registration.
- Preserve the current `ControlApi` contract by returning success payloads unchanged and rejecting with deterministic
  native `Error` instances or a JSON-safe error payload that preload turns into a native `Error`. Do not return
  `{ ok, error }` unions from these existing channels.
- Treat Electron structured clone as hostile to custom prototypes: a bridge that lets `Data.TaggedError` or `Cause`
  cross the process seam is incomplete, even when TypeScript compiles.
- Use a small backend logger interface in the Effect bridge tests so defect logging is observable without binding the
  first slice to a telemetry product.
- Do not import `src/main/index.ts` directly in tests unless startup side effects have been separated. Prefer pure
  tests for `src/main/effect/ipcBridge.ts`, `src/main/effect/appLayer.ts`, or an extracted registration helper.
- Minimum first-slice tests: bridge success, tagged failure encoding, sanitized defects, rejected unknowns,
  `getSettings` through the `LocalStore` service, and `openExternal` rejecting non-HTTPS input before the opener is
  called.

### 2. Refactor Storage Layer With Effect

**Problem:** `SqliteLocalStore` mixes schema creation, migrations, SQL execution, serialization, cache policy, Area
state, repository pins, and memory fallback in one large module.

**Intent:** Move storage behavior behind domain-local Effect modules while preserving the existing sync `LocalStore`
compatibility interface for current callers.

**Owned files:**

- `src/main/storage.ts`: become a compatibility facade exporting `LocalStore`, `createLocalStore`, and existing
  public types.
- New `src/main/storage/*`: `errors.ts`, `database.ts`, `schema.ts`, `settingsStore.ts`, `accountStore.ts`,
  `cacheStore.ts`, `recentItemsStore.ts`, `repositoryPinStore.ts`, Area storage modules, `githubRepositoryStore.ts`,
  `serializers.ts`, `mappers.ts`, `localStoreAdapter.ts`, and `memoryStore.ts`.
- `src/main/storage.test.ts` plus focused storage contract or Effect failure tests.

**Out of scope:**

- No renderer, preload, shared IPC, GitHub provider, dynamic dispatcher, or SQLite path changes.
- No schema redesign beyond moving current schema and migrations behind clearer modules.
- No behavior changes to TTLs, local recents, pins, Area identity, or repository read models.

**Checklist:**

- [ ] Stop if task 1 has not added `effect`.
- [ ] Add `DatabaseError` as a typed failure at the SQLite adapter seam.
- [ ] Add a distinct serialization/cache-corruption failure policy. Do not wrap corrupted JSON rows as generic
      database I/O failures.
- [ ] Add a `SqliteDatabase` module interface for `exec`, `pragma`, `get`, `all`, `run`, and transactions.
- [ ] Wrap raw `better-sqlite3` operations in the SQLite adapter, not in every domain module.
- [ ] Keep the existing `LocalStore` compatibility facade synchronous. Any Effect executed through this facade must
      be sync-only; no promise, fiber sleep, async retry, or yielding operation may enter a `runSync` path.
- [ ] Model SQLite transactions as a synchronous storage primitive or transaction combinator that preserves Effect
      dependency injection and typed errors inside the transaction.
- [ ] Model SQLite open/close lifecycle with acquire/release or an equivalent scoped module and close the database
      deterministically on app exit.
- [ ] Move schema bootstrap and legacy migrations into `schema.ts`.
- [ ] Extract settings, accounts, and cache into separate storage modules.
- [ ] Extract recents and repository pins with shared serializers/mappers.
- [ ] Extract Area, gateway, workspace, repository detail, and snapshot storage by domain.
- [ ] Extract GitHub repository read model storage while preserving summary/detail/readme upsert semantics.
- [ ] Keep `MemoryLocalStore` behavior equivalent through a memory adapter or parity module.
- [ ] Use one shared parameterized contract suite for SQLite and Memory implementations instead of separate,
      drifting tests.
- [ ] Keep all current imports of `createLocalStore` and `LocalStore` compiling.

**Acceptance criteria:**

- `src/main/storage.ts` is a thin facade, not the implementation.
- Raw SQLite calls exist only in the SQLite adapter/schema layer.
- Store modules fail with `DatabaseError`, not raw SQLite exceptions.
- JSON serialization failures are typed distinctly or handled as explicit cache misses where that is the documented
  behavior.
- Shared serializers/mappers own JSON parsing/stringifying and row conversion.
- The existing sync `LocalStore` interface remains stable.
- The sync facade cannot accidentally execute asynchronous Effects.
- SQLite connections are closed through the modeled lifecycle on shutdown.

**Required tests:**

- SQLite adapter converts a failing operation into `DatabaseError`.
- Corrupted serialized cache rows follow the documented corruption policy without masquerading as SQLite I/O errors.
- Fresh database creates all tables and default GitHub Area.
- Legacy pinned repositories and GitHub recents migrate into the default Area.
- Settings, account, cache, recents, pins, Area, gateway, workspace, snapshot, and GitHub repository read models
  preserve existing behavior.
- One shared contract test suite runs against both SQLite and Memory stores for covered operations.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

**Do not count as done:**

- Wrapping the current large class methods with `Effect.try` but leaving the module shallow.
- Creating one giant `StorageService` module.
- Making all callers async or Effect-native.
- Swallowing database failures silently.

**Deeper implementation notes:**

- This task is blocked until task 1 adds `effect` to `package.json` and the lockfile.
- The first mergeable slice should add `errors.ts`, `database.ts`, `schema.ts`, `serializers.ts`, and extract only
  settings, accounts, and cache from `src/main/storage.ts` while keeping `src/main/storage.ts` as the sync
  compatibility facade.
- Because `better-sqlite3` is synchronous, any Effect pipeline behind the compatibility facade must remain
  synchronous. `Effect.runSync` should never be handed an Effect that can suspend.
- Keep `.transaction()` callbacks synchronous. If a domain module needs transactional behavior, expose that as a
  storage adapter operation or a transaction combinator; do not pass an unexecuted Effect object into
  `better-sqlite3.transaction()`.
- Move the `SqliteLocalStore` constructor bootstrap into `schema.ts` without changing order: WAL pragma, table
  creation, default GitHub Area creation, legacy pin migration, then legacy GitHub recent migration.
- `DatabaseError` should fail at the SQLite adapter seam and be thrown by the sync facade when an operation fails.
  Keep memory fallback only for SQLite store creation failure, not later operation failures.
- Treat JSON corruption as a different failure mode from SQLite I/O. For cache tables, the preferred behavior is an
  explicit cache miss plus cleanup/invalidation; for durable user data, return a typed serialization failure.
- Add database teardown to the app lifecycle. A refactor that opens a `SqliteDatabase` but never closes it is not
  complete.
- Preserve subtle current behavior: invalid cache expiry counts as expired, `getCache(..., { allowExpired: true })`
  can return expired payloads, summary-only repository upserts preserve detail/readme fields,
  `upsertGitHubRepositoryReadme` is a no-op for unknown repositories, and storage-local Area IDs must not change
  accidentally by importing normalized helpers from `src/main/areas/areaIds.ts`.
- Useful guard command: `rg -n "better-sqlite3|\\.prepare\\(|\\.transaction\\(|\\.pragma\\(|\\.exec\\("
src/main/storage.ts src/main/storage` should leave raw SQLite usage only in adapter/schema files.

### 3. Deepen GitHub Provider Architecture With Effect

**Problem:** `GitHubProvider` exposes a very large flat interface, `OctokitProvider` owns too many GitHub domains,
and `GitHubProviderManager` repeats caching, stale fallback, in-flight dedupe, and auth polling logic.

**Intent:** Preserve the public provider interface while moving cache, auth schedule, and domain behavior behind
deeper main-process modules.

**Owned files:**

- `src/main/github/provider.ts`: keep as compatibility facade while removing duplicated cache/dedupe/polling logic
  as slices land.
- `src/main/github/octokitProvider.ts`: split GitHub domain adapters behind internal interfaces.
- `src/main/github/provider.test.ts`, `src/main/github/octokitProvider.test.ts`, and `src/main/github/webOAuth.ts`
  for auth schedule coverage.
- New `src/main/github/*` modules for typed errors, cache requests, auth, and domain modules.

**Out of scope:**

- No renderer, preload, IPC channel pruning, broad shared contract cleanup, or storage internals refactor.
- No behavior changes to `cacheOnly`, `forceRefresh`, `*WithStatus`, stale fallback, availability messages, or
  mutation invalidation unless a subtask states it explicitly.

**Checklist:**

- [ ] Stop if task 1 has not established Effect in `src/main`.
- [ ] Create a `GitHubReadCache` module with one interface for read-through, cache-only reads, force refresh, stale
      fallback, and invalidation.
- [ ] Add a shared GitHub concurrency/rate-limit module, such as a semaphore and retry schedule, used across domain
      modules instead of per-domain throttles.
- [ ] Use Effect request identity for in-flight dedupe. Keep SQLite-backed `LocalStore` as the durable TTL cache.
- [ ] Port one endpoint first: `listRepositoriesWithStatus`.
- [ ] Make multi-step cache writes transactional when one logical cache entry spans repository summary, metadata,
      status, detail, or generic result rows.
- [ ] Define cross-domain invalidation rules for mutations. A mutation in pulls, issues, releases, actions, or
      repository settings must declare which repository and list caches it invalidates.
- [ ] Add negative caching for permanent misses such as `404 Not Found`, with a short TTL and explicit invalidation
      on related mutations.
- [ ] Extract a repository domain module for list/detail/readme/forks/refs/tree/contents/file content.
- [ ] Extract issue and pull request domain modules, including PR partial availability aggregation.
- [ ] Replace raw `setTimeout` device polling with an Effect `Schedule`-driven auth module.
- [ ] Device-flow polling must retry transient network errors until device-code expiry instead of failing the flow on
      a single offline `fetch` failure.
- [ ] Move remaining domains one at a time: account, organizations, notifications, discussions, actions/workflows,
      projects, security, releases, contributors, search, and mutations.
- [ ] Collapse `GitHubProviderManager` into a thin compatibility adapter after duplicated wrappers are removed.

**Acceptance criteria:**

- `GitHubProviderManager` still satisfies `GitHubProvider`.
- Public IPC/preload calls compile unchanged.
- Manual `inFlight` maps are gone from completed read paths.
- Auth polling uses Effect scheduling, not raw `setTimeout`.
- Cache keys, TTLs, stale fallback, cache-only unavailable results, and mutation invalidation are equivalent.
- GitHub primary and secondary rate-limit behavior is coordinated through one shared module across domains.
- Cache writes that represent one logical result cannot leave half-updated state after a process crash.
- Permanent misses are cached deliberately and do not spam GitHub.

**Required tests:**

- Cache module covers fresh hit, cache-only hit, cache-only miss, stale plus background refresh, live error with stale
  fallback, live error with no stale data, force refresh, dedupe, and invalidation.
- Cache module covers transactional write failure and proves readers do not observe a half-written result.
- Cache module covers negative `404` caching, TTL expiry, and explicit invalidation.
- Rate-limit module tests cover shared concurrency across two domains and retry/backoff on `403`/`429`.
- Provider facade delegates to domain modules while preserving inputs.
- Repository, issue, PR, auth schedule, and Octokit adapter tests preserve current behavior.
- Auth schedule tests cover pending retry, slow-down interval, transient offline retry, expiry, cancel, success token
  save, and auth update emission.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

**Do not count as done:**

- Wrapping the current provider in `Effect.promise`.
- Creating one giant `GitHubEffectProvider`.
- Moving cache boilerplate into copied domain helpers.
- Letting Effect leak into shared, preload, or renderer modules.
- Claiming Effect request caching replaces durable SQLite TTL caching.

**Deeper implementation notes:**

- Do not start this task until task 1 has added Effect to `src/main`.
- The first useful slice is only `listRepositoriesWithStatus`: extract the read-through behavior from
  `GitHubProviderManager.listRepositoriesWithStatus`, `refreshRepositoriesWithStatus`, and dedupe into a GitHub
  read-cache module.
- Leave `GitHubProviderManager` as the public `GitHubProvider` facade and leave IPC/preload/shared types unchanged.
- Preserve the current two-source cache order exactly: `LocalStore.listGitHubRepositoriesWithMetadata(limit)` wins
  before generic `repositories-with-status:${limit}` cache entries.
- Preserve current cache semantics: `cacheOnly` beats `forceRefresh`; stale repository rows/results return
  immediately and refresh in the background; live refresh writes summaries and the generic status result only when
  availability is `available`; repository update events fire only on material item changes.
- The first read-cache module should call into one transactional storage operation for summary/status/generic result
  writes. If task 2 has not exposed that primitive yet, keep the write sequence local and document the temporary
  inconsistency risk instead of pretending it is solved.
- Add negative cache keys only for permanent misses. Do not cache transient auth, rate-limit, network, or server
  failures as negative results.
- Device-flow auth should distinguish protocol responses (`authorization_pending`, `slow_down`, `expired_token`) from
  transient transport errors. Transport errors retry until expiry.
- Minimum first-slice tests: fresh hit, cache-only hit, cache-only miss, generic cached-result fallback, stale plus
  background refresh, force refresh, live error with no cache, concurrent dedupe, request-identity invalidation, and
  unchanged-list no-op event emission.

### 4. Streamline IPC And Preload Architecture

**Problem:** IPC has redundant raw/statusful read channels, repeated main/preload handler wiring, and some bloated
payloads such as pull request detail.

**Intent:** Make IPC a deeper seam: every route declared once, registered once, exposed once, and tested through a
typed adapter.

**Owned files:**

- Primary: `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/index.ts`, new `src/main/ipc/*`, and preload
  helper modules.
- Secondary: `src/shared/github.ts`, `src/main/github/provider.ts`, `src/main/github/octokitProvider.ts`,
  `src/renderer/src/App.tsx`, `src/renderer/src/data/mock.ts`, and `src/renderer/src/App.test.tsx` for required
  call-site updates.

**Out of scope:**

- No App decomposition, storage refactor, GitHub provider decomposition, broad shared-contract dedupe, or Effect in
  preload/renderer.
- If task 1 has not landed, keep the dispatcher Promise-based behind an adapter seam.

**Checklist:**

- [ ] Inventory IPC routes and classify them as app/local, Area, GitHub statusful read, GitHub mutation, or event.
- [ ] Define a route catalog with unique channel names and explicit input/output types.
- [ ] Catalog main-to-renderer push events, not just `ipcMain.handle` request/response routes.
- [ ] Add runtime payload validation at the IPC router seam for untrusted inputs before calling main-process
      handlers. TypeScript types alone do not count.
- [ ] Remove renderer-exposed raw GitHub read twins where a statusful read exists.
- [ ] Keep resultful reads that do not have statusful replacements, such as readme, blame, access/security/wiki,
      and workflow logs.
- [ ] Extract main IPC registration into `src/main/ipc`. `src/main/index.ts` should bootstrap dependencies and call
      registration modules.
- [ ] Add a preload invoke/listener adapter so `src/preload/index.ts` does not repeat `ipcRenderer.invoke` for every
      route.
- [ ] Preload listener adapters must strip the raw `IpcRendererEvent` before invoking renderer callbacks.
- [ ] Treat `PullRequestDetail` decomposition as a follow-up design slice. Do not split the payload until the route
      catalog, concurrent renderer composition plan, and latency tests exist.
- [ ] Migrate Area IPC only after the shared dispatcher proves duplicate-channel rejection and validation locality.

**Acceptance criteria:**

- `src/main/index.ts` has no direct `ipcMain.handle` calls.
- `src/preload/index.ts` has at most helper-level direct `ipcRenderer.invoke` usage.
- Preload listener callbacks never receive raw Electron event objects.
- No renderer `ControlApi.github` raw read method remains when a statusful equivalent exists.
- Every IPC route is declared once, registered once, and exposed once.
- Main-to-renderer events are typed and routed through the same catalog discipline as invokes.
- Runtime IPC input validation happens in main before route handlers consume payloads.
- Pull request detail remains behaviorally unchanged until a separate decomposition slice proves concurrent query
  composition and avoids renderer waterfalls.
- Sandbox, context isolation, token isolation, HTTPS external-link validation, cache-only reads, and stale-data
  behavior are unchanged.

**Required tests:**

- `src/main/ipc/ipcRouter.test.ts`: registration, duplicate-channel rejection, handler invocation, error propagation,
  event routing/exclusion, and runtime payload validation failure.
- `src/main/ipc/registerControlIpc.test.ts`: settings, pins/recents, external-link validation, GitHub statusful
  reads, and mutations.
- Preload tests for invoke mapping, listener unsubscribe, and proving raw `IpcRendererEvent` is not exposed.
- Route parity tests proving runtime channel strings match registered handlers.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

**Do not count as done:**

- Replacing typed preload methods with `invoke(channel: string, payload: unknown)`.
- Leaving raw reads as aliases for compatibility.
- Renaming monolithic PR detail without reducing payload depth.
- Moving validation to the renderer.
- Passing raw Electron events through context isolation.
- Starting PR detail decomposition before the IPC catalog and concurrency plan exist.

**Deeper implementation notes:**

- The current code has no `src/main/ipc` layer: `src/main/index.ts` owns direct `ipcMain.handle` calls,
  `src/main/areas/registerAreaIpc.ts` owns more direct handlers, and `src/preload/index.ts` repeats the bridge with
  direct `ipcRenderer.invoke` calls.
- Start with a Promise-based router if task 1 has not landed yet.
- The first slice should add `src/main/ipc/ipcRouter.ts` with duplicate-channel rejection, event exclusion, handler
  invocation, runtime validation, and error propagation tests.
- Then add `src/main/ipc/registerControlIpc.ts` and migrate only app/local/auth routes from `registerIpc`, plus one
  GitHub statusful read such as `githubRepositoriesWithStatus` and one mutation such as `githubMutate`.
- Event cataloging should include the current `webContents.send` channels and the preload listener API shape. The
  renderer callback receives only the event payload.
- Leave Area IPC untouched until the shared dispatcher is proven.
- Do not begin PR detail decomposition in the first slice; the current monolith spans shared types, provider fanout,
  renderer queries, mocks, and App tests. Splitting it without concurrent composition can create a slower waterfall.

### 5. Deepen The UI Architecture: Deconstruct `App.tsx`

**Problem:** `App.tsx` is a large renderer module that mixes app shell state, routing, repository tab queries,
mutations, shared primitives, and tab implementations.

**Intent:** Turn `App.tsx` into a shell module. Each extracted renderer module should own one visible workflow and
hide its query/rendering implementation behind a narrow typed interface.

**Owned files:**

- `src/renderer/src/App.tsx`, `src/renderer/src/App.test.tsx`,
  `src/renderer/src/queries/repositoryQueryKeys.ts`, and `src/renderer/src/api/controlApi.ts`.
- New `src/renderer/src/components/repository/*`, `src/renderer/src/components/shell/*`,
  `src/renderer/src/components/primitives/*`, and `src/renderer/src/hooks/*`.
- `src/renderer/src/styles.css` only for import-safe class reuse or tiny extraction fixes.

**Out of scope:**

- No main, preload, shared IPC, Effect, storage, defensive type cleanup, mock splitting, route behavior changes, query
  key renames, cache TTL changes, auth changes, or e2e additions.

**Checklist:**

- [ ] Create `RepositoryContext` and `useRepositoryContext` exposing only stable repository-level dependencies:
      owner, repo, nameWithOwner, githubReady, `api`, and `queryClient`.
- [ ] Add typed navigation and mutation adapters only when at least two tabs need them.
- [ ] Extract primitives only after two real call sites exist: availability banner, empty state, expandable list,
      status badge, and similar shared UI modules.
- [ ] Extract high-traffic repository tabs first: Code, Issues, Pull Requests, and Actions.
- [ ] Extract Agents after Issues/Pulls/Actions because it composes those surfaces.
- [ ] Extract remaining tabs in risk order: Discussions, Projects, Releases, Contributors, Wiki, SecurityQuality,
      and Settings.
- [ ] Move tab-specific `useQuery` hooks into their owning tab modules.
- [ ] Export pure tab prefetch functions for any tab whose warm prefetch was previously initiated by the shell.
      `App.tsx` or `RepositoryShell` should call these functions without mounting the tab.
- [ ] Preserve transient tab state. Do not switch from hidden-but-mounted tabs to conditional unmounting unless scroll
      positions, drafts, expanded rows, and in-flight form state are moved to stable state first.
- [ ] Wrap extracted repository tab surfaces in ErrorBoundary, and Suspense where query loading mode requires it, so
      one tab crash does not take down the whole repository shell.
- [ ] Keep shared UI primitives presentational. Banners, empty states, badges, and list primitives must receive props
      rather than calling `useRepositoryContext` directly.
- [ ] Extract repository shell pieces only after tab modules no longer require large prop bundles.
- [ ] Leave CollectionView, LocalRepositoryPage, and broad app shell decomposition for follow-up unless blocking.

**Acceptance criteria:**

- `App.tsx` no longer contains repository tab implementations such as `CodeTab`, `IssuesTab`, `PullRequestsTab`,
  `ActionsTab`, `AgentsTab`, `DiscussionsTab`, `ProjectsTab`, `ReleasesTab`, `ContributorsTab`, `WikiTab`,
  `SecurityQualityTab`, or `RepositorySettingsTab`.
- Repository tab query hooks live with their tab modules, not in `App()`.
- Extracted module interfaces are narrow and typed. No giant context dump and no 100-prop pass-through module.
- Query keys, enabled gates, cache-only mode, and warm prefetch behavior are equivalent.
- Warm prefetch is preserved through exported prefetch functions or an equivalent explicit shell hook, not by relying
  on hidden mounted components.
- Tab extraction does not drop transient state on tab switches.
- Extracted tab crashes are contained by repository-level error boundaries.
- Shared primitives remain reusable outside repository pages.
- Existing renderer tests still cover routing, mutations, command palette, repository tabs, cache-only behavior, and
  availability states.

**Required tests:**

- Preserve and update `src/renderer/src/App.test.tsx` integration coverage.
- Add `useRepositoryContext.test.tsx` for stable context values and missing-provider invariant.
- Add targeted tab tests where extraction risks behavior: Code ref selection, Issues/Pulls mutation adapters, Actions
  workflow dispatch/rerun state, and inactive-tab query gating or warm prefetch.
- Add tests proving warm prefetch still runs when a tab is not mounted, and stateful tabs do not lose local state on
  tab switches.
- Add an ErrorBoundary test or App integration case proving an extracted tab failure does not blank the shell.
- Add primitive tests that pass data by props without requiring `RepositoryContext`.
- Add `useExpandableList.test.ts` if expandable list logic is extracted.

**Validation:**

- After each vertical slice: `bun run typecheck` and targeted renderer tests through `bun run test -- ...`.
- Before completion: `bun run format`, `bun run lint`, `bun run typecheck`, `bun run test`.

**Do not count as done:**

- Moving thousands of lines into new files with the same shallow interface.
- Creating a global "everything context".
- Centralizing all repository queries into one `useRepositoryQueries` hook.
- Changing query keys casually.
- Extracting primitives before repeated usage proves the seam is real.

**Deeper implementation notes:**

- The first slice should be repository context wiring plus one live tab-query migration, not a broad component move.
- Add `src/renderer/src/components/repository/RepositoryContext.tsx` and
  `src/renderer/src/hooks/useRepositoryContext.ts`, exposing only `owner`, `repo`, `nameWithOwner`, `githubReady`,
  `api`, and `queryClient`.
- Wrap repository and code-browser render paths from `App()` after `effectiveRepository`, `owner`, `repo`, and
  `githubReady` are computed.
- Then migrate the existing `IssuesTab` issue-detail query into an issue-owned hook such as
  `src/renderer/src/components/repository/issues/useIssueDetail.ts`, called by the current `IssuesTab`. Keep the
  visual `IssuesTab` in `App.tsx` for this first slice if extracting it requires pulling markdown, mutation, and
  list primitives too.
- Do not move shared repository refs into Code-tab ownership first. Branches and tags are used by Code, Pulls,
  Actions, Releases, SecurityQuality, Settings, CodeBrowser, FileFinder, and markdown link routing.
- Preserve warm prefetch: `repositoryWarmPrefetchTabs` currently preloads Code, Issues, Pulls, and Actions even when
  only one tab is visible. Moving queries only into mounted tab modules can silently remove that behavior. For each
  migrated tab, export a pure `prefetch<Domain>Tab()` helper or equivalent query plan that the shell can call without
  rendering the tab module.
- Preserve the current tab mounting semantics. If the extraction introduces conditional rendering by active tab, move
  local state to a stable owner first or keep inactive tabs mounted and hidden.
- Place ErrorBoundary at the tab surface, not inside shared primitives, so failures have repository context while
  primitives stay reusable.
- Minimum first-slice tests: `useRepositoryContext` provider values and missing-provider invariant, plus existing
  App tests around high-traffic prefetch, repository mutations, cache-only unauthenticated reads, and routed pull
  selection when the loaded list does not contain the pull.

### 6. Eliminate Defensive Types

**Problem:** Renderer code defends against raw GraphQL and REST shapes that should already be normalized by the
provider adapter. That creates casts, duplicate fallback logic, and weak shared domain interfaces.

**Intent:** Make the GitHub provider adapter own remote-shape narrowing so renderer modules consume strong shared
types.

**Owned files:**

- `src/shared/github.ts`: GitHub domain interfaces such as repository detail, languages, discussions, PR review
  threads, and projects.
- `src/main/github/octokitProvider.ts`: adapter seam where raw GitHub responses become shared domain types.
- `src/renderer/src/App.tsx`: remove compatibility types, casts, and fallback parsing.
- `src/main/github/octokitProvider.test.ts`, `src/renderer/src/App.test.tsx`, and `src/renderer/src/data/mock.ts`
  when fixtures must match hardened types.

**Out of scope:**

- No Effect, IPC dispatcher, App decomposition, storage, auth, e2e, Zod/codegen dependency, or broad UI copy changes.
- Do not remove legitimate `unknown` at true seams.

**Checklist:**

- [ ] Make `RepositoryDetail` the renderer interface for counts, viewer state, fork refs, parent/source, and
      languages.
- [ ] Delete renderer-local parity interfaces such as local language/ref/viewer compatibility types.
- [ ] Keep raw language GraphQL shapes private to `octokitProvider.ts`; return shared `LanguageStat[]`.
- [ ] Treat GitHub GraphQL `T | null` as a first-class adapter concern. Do not use non-null assertions or casts to
      force strict shared types.
- [ ] Preserve pagination metadata for paginated domains. Flattening `edges/nodes` must not drop `pageInfo` when a
      "Load More" path needs it.
- [ ] Replace discussion comment casts with explicit preview comment and loaded detail comment types.
- [ ] Remove rich PR review thread compatibility casts by deepening the shared review thread interface or deriving
      display data from typed comments.
- [ ] Give Project V2 mapping functions explicit shared return types.
- [ ] Audit Issues, Actions, Commit Statuses, and other shared GitHub domains for defensive `unknown`, not only the
      four domains called out in the first slice.
- [ ] Define a cache migration or invalidation strategy for old raw GraphQL shapes stored in SQLite or renderer
      storage before removing renderer compatibility fallbacks.
- [ ] Remove dead helpers and fallback chains that only supported obsolete defensive shapes.

**Acceptance criteria:**

- `App.tsx` no longer contains raw GraphQL language handling through `totalSize`, `edges`, or `nodes`.
- `App.tsx` no longer contains `as Partial<DiscussionCommentSummary>` or similar domain casts.
- `src/shared/github.ts` has no domain `unknown` except mutation boundary fields.
- Paginated shared types retain cursor/page-info fields where the UI can request more data.
- Old cached raw shapes cannot crash the renderer after compatibility code is removed.
- Provider mapping functions return shared types explicitly at the main-to-renderer seam.
- Renderer display code reads normalized fields, not raw adapter shapes.

**Required tests:**

- Provider tests prove repository language edges map to `LanguageStat[]` with expected `size` and `percent`.
- Provider tests cover partial or missing GraphQL fields and prove mapper behavior without non-null assertions.
- Paginated domain tests prove `pageInfo` survives mapping where the UI has "Load More" behavior.
- Renderer tests prove the language rail renders from `RepositoryDetail.languages`.
- Renderer tests distinguish discussion preview comments from loaded detail comments with replies.
- Project V2 provider tests cover text, number, date, single-select, iteration, unsupported field values, and owner
  kind mapping.
- Add PR review-thread coverage if that slice changes rendered line/diff behavior.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

**Do not count as done:**

- Fixing type errors with `as any`, wider `unknown`, or `Record<string, unknown>`.
- Fixing type errors with non-null assertions against raw GitHub responses.
- Moving Octokit raw response shapes into `src/shared`.
- Preserving old raw-shape compatibility "just in case".
- Dropping pagination metadata while flattening GraphQL shapes.
- Combining this with task 5 or task 8.

**Deeper implementation notes:**

- Start with the repository-detail parity slice, not discussions, projects, or PR threads.
- Current provider code already returns normalized `RepositoryDetail` data: languages are mapped privately,
  repository counts are normalized, fork refs are mapped, and viewer state is in the shared contract.
- The first implementation should delete renderer compatibility types in `App.tsx`, including `RepositoryWithParity`,
  local language/ref/viewer types, local count aliases, and `firstNumber`.
- Make `getRepositoryCounts()`, `getViewerRepositoryState()`, `getForkMetadata()`, and the language rail read
  `RepositoryDetail`/`RepositorySummary` fields directly.
- Preserve edge cases: zero language `totalSize` maps to `percent: 0`; empty `languages` renders the existing empty
  language state; REST fork metadata may be unavailable and should stay `null` or GraphQL-backed; and
  `viewerState.subscription === "SUBSCRIBED"` remains the only normalized watching state.
- Add explicit mapper behavior for nullable GraphQL fields. The preferred shape is a deliberate default, omission, or
  typed unavailable state, not `!`.
- Before deleting old renderer fallbacks, invalidate or migrate caches that may still contain raw GraphQL shapes. At
  minimum, bump the relevant cache key/version and add a regression test using an old-shape fixture.
- Minimum first-slice tests: provider language-edge mapping to `LanguageStat[]` with `size` and `percent`, and a
  renderer language-rail case proving the UI reads `RepositoryDetail.languages` without raw `totalSize`, `edges`, or
  `nodes` compatibility.
- Useful absence checks after implementation:
  `rg -n "RepositoryWithParity|rawLanguages|graphLanguages|totalSize" src/renderer/src/App.tsx` and
  `rg -n "interface LanguageStat|languages\\?: unknown" src/renderer/src/App.tsx`.

### 7. Refactor Renderer Utilities And State

**Problem:** Renderer utilities and state are shallow: repeated `getControlApi()` hooks, route construction spread
across store actions, markdown helpers embedded in `App.tsx`, and repeated mock storage parsing.

**Intent:** Add narrow renderer-only seams that improve locality without becoming the larger `App.tsx`
decomposition or mock-domain split.

**Owned files:**

- `src/renderer/src/App.tsx`: utility extraction and call-site rewiring only.
- `src/renderer/src/stores/uiStore.ts` and `src/renderer/src/stores/uiStore.test.ts`.
- `src/renderer/src/utils/format.ts` and `src/renderer/src/utils/format.test.ts`.
- `src/renderer/src/data/mock.ts`: replace repeated mock storage parsing with a shared adapter.
- New `src/renderer/src/components/MarkdownBody.tsx`, `src/renderer/src/components/MarkdownBody.test.tsx`,
  `src/renderer/src/hooks/useControlApi.ts`, `src/renderer/src/data/mockStorage.ts`, and
  `src/renderer/src/data/mockStorage.test.ts`.

**Out of scope:**

- No main, preload, shared contract, IPC, provider, Effect, repository tab extraction, domain mock split, test factory
  normalization, e2e, UI redesign, CSS churn, or route behavior changes.

**Checklist:**

- [ ] Add `useControlApi()` as the only renderer hook wrapping `getControlApi()`.
- [ ] Replace repeated `useMemo(() => getControlApi(), [])` call sites in `App.tsx`.
- [ ] Move `MarkdownBody`, its URL handler context, and markdown render helpers into `components/MarkdownBody.tsx`.
- [ ] Preserve markdown CSS class names and safe URL behavior.
- [ ] Centralize route-to-selected-state derivation inside `uiStore.ts`.
- [ ] Make `navigate`, `goToRepository`, `goToLocalRepository`, `openCodeBrowser`, and `setRepositoryTab` share the
      same store-local route adapter.
- [ ] Include global route actions such as `goHome` and `goToMailbox` in the same route derivation path so the store
      does not keep separate routing semantics.
- [ ] Remove `setSelectedRepository` if unused, or make it delegate through the same route builder.
- [ ] Rewrite `firstMarkdownHeading` with a single-pass scanner or parser-aware helper that ignores fenced code
      blocks, handles Setext `===` headings, and preserves the `README` fallback.
- [ ] Extract localStorage access and JSON parsing into `data/mockStorage.ts`.
- [ ] Define mock storage write-failure behavior, including quota errors, and make callers use that contract.
- [ ] Keep `unknown` contained at the mock storage adapter seam.

**Acceptance criteria:**

- `App.tsx` no longer calls `getControlApi()` directly.
- `App.tsx` no longer owns markdown rendering internals.
- Repository route construction has one store-local source of truth.
- Repository and global route actions share one store-local source of truth.
- `firstMarkdownHeading` avoids per-line array allocation while ignoring headings inside fenced code blocks.
- Mock storage callers have deterministic behavior when writes throw.
- `mock.ts` has no direct `localStorage`, `JSON.parse`, or duplicated serialized-read blocks.

**Required tests:**

- `format.test.ts`: null/empty fallback, first H1, indented H1, ignores H2, ignores bare `#`.
- `format.test.ts`: ignores `#` headings inside fenced code blocks and supports Setext `===` headings.
- `uiStore.test.ts`: repository and global route actions update selected repository/local repository consistently.
- `mockStorage.test.ts`: absent key fallback, invalid JSON fallback, wrong-shape fallback, write/read round trip, and
  fresh fallback factory values.
- `mockStorage.test.ts`: write failures such as `QuotaExceededError` follow the documented fallback contract.
- `MarkdownBody.test.tsx`: safe HTTPS links route through callback, unsafe links/images render safely, and basic
  headings/lists/code still render.
- `MarkdownBody.test.tsx`: repository-context links for `@user` and `#123` preserve the current routing behavior.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

**Do not count as done:**

- Adding wrapper modules that only rename functions.
- Adding more local guards in `mock.ts` instead of a storage adapter.
- Changing route semantics.
- Splitting repository tabs from `App.tsx`.

**Deeper implementation notes:**

- First slice: extract the markdown runtime path, not only the `useControlApi()` wrapper.
- Move `MarkdownBody`, `MarkdownUrlHandlerContext`, `MarkdownUrlContext`, safe URL helpers, markdown URL-context
  builders, and inline/block render helpers from `src/renderer/src/App.tsx` into
  `src/renderer/src/components/MarkdownBody.tsx`. Keep `App.tsx` responsible for the `openMarkdownUrl` routing
  callback and provider placement only.
- Preserve current markdown behavior: only `https:` URLs are clickable/rendered; root-relative links resolve through
  `rootUrl`; ordinary relative links resolve through `baseUrl`; unsafe links render as `markdown-unsafe`; unsafe
  images render fallback text instead of `<img>`; autolink trailing punctuation is excluded from the URL; and `@user`
  / `#123` references use repository context when available.
- After markdown extraction, add `src/renderer/src/hooks/useControlApi.ts` as the stable
  `useMemo(() => getControlApi(), [])` wrapper and replace every direct `getControlApi()` call in `App.tsx`. Do not
  introduce a provider or context in this task.
- In `uiStore.ts`, add one store-local adapter such as `stateForRoute(route, previousState)` and make `navigate`,
  `goHome`, `goToMailbox`, `goToRepository`, `goToLocalRepository`, `openCodeBrowser`, and `setRepositoryTab`
  delegate through it. Preserve current semantics where non-repository routes keep the last selected
  repository/local repository.
- For `firstMarkdownHeading`, prefer a small scanner over a broad multiline regex. It should skip fenced code blocks
  and support Setext headings so shell snippets and Python comments do not become document titles.
- `mockStorage.ts` should expose a write contract. Either return a result that callers can ignore safely or fall back
  to in-memory defaults; do not let quota errors create partial mock state.
- `mockStorage.ts` is the storage helper owner. Task 9 should build domain mocks on top of it rather than adding a
  second storage adapter in `data/mocks/shared.ts`.
- Useful absence checks after implementation:
  `rg -n "getControlApi\\(" src/renderer/src/App.tsx`,
  `rg -n "^function MarkdownBody|function safeMarkdownUrl|function renderInlineMarkdown|MarkdownUrlHandlerContext = createContext" src/renderer/src/App.tsx`,
  `rg -n "localStorage|JSON\\.parse" src/renderer/src/data/mock.ts`, and
  `rg -n "setSelectedRepository" src/renderer/src`.

### 8. Deduplicate Shared Contracts

**Problem:** Shared contracts repeat provider method declarations, result result-shape boilerplate, mutation payload
escape hatches, and IPC/preload route adapters.

**Intent:** Make the shared GitHub contract module the source of truth across provider, IPC, preload, renderer mocks,
and mutation call sites while preserving runtime behavior and IPC channel names.

**Owned files:**

- `src/shared/github.ts`: result primitives, `GitHubProvider` alignment, and discriminated mutation input.
- `src/shared/ipc.ts`: derive `ControlApi["github"]` from `GitHubProvider` through a named IPC adapter type.
- `src/preload/index.ts` and `src/main/index.ts`: update adapters required by type changes.
- `src/main/github/provider.ts`, `src/main/github/octokitProvider.ts`, `src/renderer/src/App.tsx`, and
  `src/renderer/src/data/mock.ts`: update mutation handling and typed call sites.
- Tests in `src/shared/ipc.test.ts`, `src/main/github/octokitProvider.test.ts`, and
  `src/renderer/src/App.test.tsx`.

**Out of scope:**

- No Effect, dynamic dispatcher, provider decomposition, caching changes, raw endpoint removal, PR detail
  decomposition, App split, component moves, e2e tests, or IPC channel renames unless compile failures prove a name
  is invalid.

**Checklist:**

- [ ] Add shared result primitives: `GitHubAvailabilityResult`, `GitHubListResult<T>`, and narrow item/detail result
      helpers. `GitHubListResult<T>` must support optional pagination metadata for endpoints that can load more.
- [ ] Convert simple `items + availability` result interfaces to exported aliases while preserving public type names.
- [ ] Define `GitHubIpcApi` in `src/shared/ipc.ts`, derived from `GitHubProvider` with explicit adapter overrides for
      IPC shape differences.
- [ ] Replace the manual `ControlApi.github` declaration with `github: GitHubIpcApi`.
- [ ] Add a typed GitHub route map or equivalent adapter seam so preload/main coverage is checked against
      `keyof GitHubIpcApi`.
- [ ] Replace `GitHubMutationInput` with a discriminated union grouped by action domain, including repository-scoped
      and non-repository/user-scoped actions.
- [ ] Enforce JSON-serializable IPC contracts at the type seam so `Date`, `Map`, functions, class instances, and
      other non-clone-safe values cannot leak from provider types into preload.
- [ ] Update provider, manager, renderer mutation call sites, and mocks to consume action-specific fields instead of
      arbitrary `payload` key reads.

**Acceptance criteria:**

- `ControlApi["github"]` is derived from `GitHubProvider`; duplicated manual method declarations are gone except
  explicit adapter overrides.
- Public result type names remain stable.
- Simple list results use `GitHubListResult<T>`.
- Paginated list results retain `pageInfo` or equivalent cursor metadata where needed.
- `GitHubMutationInput` has no `Record<string, unknown>` payload escape hatch.
- Mutation inputs represent non-repository actions without fake `owner`/`repo` values.
- `ControlApi` IPC shapes are JSON-serializable by type.
- Existing IPC channel names and renderer method names stay stable.
- TypeScript catches missing preload/main GitHub route coverage.

**Required tests:**

- `src/shared/ipc.test.ts`: type-level assertions that `GitHubIpcApi` covers intended provider keys and adapter
  exceptions are explicit.
- `src/shared/ipc.test.ts`: JSON-serializability assertions reject non-clone-safe provider fields.
- Runtime IPC route-map parity tests prove channel string values match registered main/preload handlers.
- `src/main/github/octokitProvider.test.ts`: mutation route tests use the discriminated union and cover touched
  action groups.
- `src/renderer/src/App.test.tsx`: create issue, edit issue, dispatch workflow, and create release assert the new
  typed input shape.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

**Do not count as done:**

- Replacing `Record<string, unknown>` with `any`, wider `unknown`, or repeated casts.
- Hiding drift behind mapped types that make the adapter seam unreadable.
- Allowing non-serializable provider return values to become renderer IPC types.
- Copying the provider interface into a new local interface under another name.
- Changing runtime behavior while doing type cleanup.

**Deeper implementation notes:**

- Start with a read-contract slice before mutation union work.
- Add `GitHubAvailabilityResult` and `GitHubListResult<T>` in `src/shared/github.ts`, then convert only exact
  `items + availability` result interfaces to public aliases. Include optional pagination metadata in the primitive
  so paginated endpoints do not lose cursors. Do not force detail, tree, file-content, access, or wiki results into
  generic shapes just to look complete.
- In `src/shared/ipc.ts`, derive `GitHubIpcApi` from `GitHubProvider` with explicit overrides for optional no-arg
  renderer calls, `getRepository`/`getRepositoryWithStatus` object-input IPC adapters, and concrete non-generic
  `mutate`.
- Add a `githubIpcRouteChannels` map typed with `satisfies Record<keyof GitHubIpcApi, ...>` and use it from
  preload/main so route coverage is checked by TypeScript without renaming IPC channels.
- Preserve `cacheOnly` and `forceRefresh` when adapting `RepoDetailInput` to provider
  `getRepository(owner, repo, options)`.
- Do not start by rewriting mutation payloads. Convert mutation input after route coverage is enforced.
- When mutation input becomes a discriminated union, preserve current field names unless intentionally taking on a
  separate naming migration. Keep `owner`, `repo`, and `action` top-level for repository-scoped mutations, but model
  user-scoped or global mutations without fake repository fields.
- Type-level route coverage is not enough. Add a runtime route-map test that compares declared channel strings with
  registered handlers so a typo in the value string cannot hide behind `satisfies`.
- Mutation tests should cover at least create issue, edit issue, dispatch workflow, and create release. Preserve
  explicit `false` booleans such as `draft: false`, `prerelease: false`, and workflow checkbox values.

### 9. Normalize Tests And Mocks

**Problem:** Renderer mock data and tests are monolithic. `mock.ts` owns many domains, `App.test.tsx` is a catch-all,
and some state-heavy validation lives in slow Playwright coverage.

**Intent:** Give mocks and tests domain locality. Keep production mock behavior stable while moving test setup behind
typed factory seams.

**Owned files:**

- `src/renderer/src/data/mock.ts`: become a compatibility barrel or be removed after imports migrate.
- New `src/renderer/src/data/mocks/*`: repository, organizations, issues, pulls, notifications, actions, releases,
  discussions, projects, contributors, wiki, securityQuality, appState, and api.
- `src/renderer/src/api/controlApi.ts` only if `mockControlApi` moves.
- `src/renderer/src/App.test.tsx`: split by renderer workflow.
- New `tests/factories/*`: typed ControlApi, render harness, GitHub fixtures, local Area fixtures, and mutation
  scenarios.
- `src/renderer/src/test/setup.ts`: shared jsdom shims only.
- `tests/e2e/control-shell.spec.ts`: prune only after equivalent RTL coverage exists.

**Out of scope:**

- No `App.tsx` extraction, CSS redesign, main/preload/shared contract changes, GitHub benchmark e2e edits, new
  Playwright tests, package script changes, or mock storage key changes.

**Checklist:**

- [ ] Add `src/renderer/src/data/mocks/shared.ts` for shared constants and availability helpers only. Storage helper
      ownership belongs to task 7's `mockStorage.ts` when that task has landed.
- [ ] Keep `src/renderer/src/data/mock.ts` exporting the same names during migration.
- [ ] Add a shared mock state coordinator for cross-domain identity so issues, pulls, notifications, releases, and
      repositories cannot reference missing repository fixtures.
- [ ] Move read-only fixtures by domain: repository, refs, contents, organizations, contributors, discussions,
      projects, wiki, and security.
- [ ] Move mutable domains by behavior: notifications, issues, pulls, releases, and workflow runs.
- [ ] Preserve localStorage behavior and existing mutation results.
- [ ] Move `mockControlApi` construction into `src/renderer/src/data/mocks/api.ts`.
- [ ] Add shared test factories for rendering, `ControlApi`, domain fixtures, local Area fixtures, and mutations.
- [ ] Remove local duplicated `makeApi`, `renderControl`, Area fixtures, and command helpers from renderer tests.
- [ ] Split renderer tests into workflow files such as routing, areas, command palette, mailbox, repository code,
      issues, pulls, actions, releases, and security quality.
- [ ] Add strict `beforeEach`/`afterEach` cleanup for split RTL files: mock storage, query clients, timers, DOM, and
      any module-level mock state.
- [ ] Port state-heavy Playwright cases to RTL before pruning matching Playwright coverage, but keep Playwright cases
      that prove layout, z-index, focus, bubbling, or pointer behavior.
- [ ] Remove all large fixture literals and mutation logic from `mock.ts`.

**Acceptance criteria:**

- `mock.ts` is either removed or only a small compatibility export surface.
- Mock data has domain locality under `src/renderer/src/data/mocks`.
- Cross-domain fixture references are validated or constructed through one coordinator.
- `mockControlApi` remains available to browser fallback through `getControlApi()`.
- Renderer tests use shared factories instead of duplicated local setup.
- Split RTL tests reset storage, query clients, timers, DOM, and mock state between cases.
- No renderer test file remains a broad catch-all monolith.
- Playwright state tests are not deleted until equivalent RTL tests pass.
- Playwright interaction/layout coverage is kept when RTL cannot observe the behavior.
- `ControlApi` and shared contracts remain unchanged.

**Required tests:**

- Mock storage helpers: empty storage fallback, read/write round trip, and corrupt JSON fallback.
- Domain mutation tests for notifications, issues, pulls, releases, and actions.
- Cross-domain fixture integrity tests prove referenced repositories, issues, pulls, and notifications exist.
- API adapter tests proving `*WithStatus` methods return matching data plus availability.
- Renderer workflow tests prove cleanup hooks prevent jsdom/localStorage/query-cache leakage across split files.
- Renderer RTL replacements for each pruned Playwright state workflow.

**Validation:**

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- If `tests/e2e/control-shell.spec.ts` changes: `bun run test:e2e`

**Do not count as done:**

- Creating one giant `mocks/index.ts` that recreates the monolith.
- Duplicating `makeApi` in every test file.
- Moving production mock behavior into `tests/factories`.
- Loosening types with broad `unknown`, `any`, or assertion-heavy builders.
- Deleting Playwright coverage without equivalent RTL assertions.
- Replacing behavioral checks with snapshots.

**Deeper implementation notes:**

- Start with the notifications mock slice. It avoids task 8's mutation payload churn while still changing a real
  runtime path.
- Current `mock.ts` owns storage helpers, notification fixtures, notification list filtering, read/unsubscribe
  mutations, and `mockControlApi` wiring. Move only notification behavior into
  `src/renderer/src/data/mocks/notifications.ts` first, while keeping `src/renderer/src/data/mock.ts` as a
  compatibility export.
- Reuse the storage adapter from task 7 if it has landed. If it has not, keep task 9's shared mock helper limited to
  constants and availability helpers so it does not create a competing `localStorage` seam.
- Preserve the existing `control:mock:notifications` key and the distinction between absent/corrupt storage, which
  falls back to `mockNotifications`, and an explicit stored `[]`, which means no notifications.
- Preserve notification filters and mutations: `all`, `participating`, `limit`, `markNotificationThreadRead`
  updating `unread` and `lastReadAt`, and unsubscribe removing only the matching thread.
- Put runnable tests under `src/renderer/src/data/mocks/*.test.ts`; `tests/factories/*` should contain imported
  helpers only because the current Vitest config includes `src/**/*.test.ts(x)`.
- Do not start with issue, pull, release, or action mutation extraction until task 8's mutation input cleanup lands.
