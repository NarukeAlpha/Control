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
4. Tasks 5, 7, and 9 can proceed independently, but task 7's utility seams should land before the largest renderer
   extractions in task 5.

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
- [ ] Add an IPC bridge that runs Effect through `Effect.runPromiseExit` and converts success/failure back to the
      current Electron promise contract.
- [ ] Migrate one local synchronous pilot, such as `getSettings`.
- [ ] Migrate one low-risk async pilot, such as `openExternal`.
- [ ] Remove any duplicate direct handlers for the migrated pilot channels.

**Acceptance criteria:**

- Effect imports are localized to `src/main/effect` and narrow `src/main/index.ts` wiring.
- The pilots preserve the existing `ControlApi` shape.
- Typed failures keep expected error details; unexpected defects are sanitized.
- Existing cache/auth/provider behavior is unchanged.

**Required tests:**

- `ipcBridge` returns success payloads unchanged.
- `ipcBridge` maps tagged failures to deterministic IPC-safe failures.
- `ipcBridge` sanitizes defects and rejected unknown values.
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
- [ ] Add a `SqliteDatabase` module interface for `exec`, `pragma`, `get`, `all`, `run`, and transactions.
- [ ] Wrap raw `better-sqlite3` operations in the SQLite adapter, not in every domain module.
- [ ] Move schema bootstrap and legacy migrations into `schema.ts`.
- [ ] Extract settings, accounts, and cache into separate storage modules.
- [ ] Extract recents and repository pins with shared serializers/mappers.
- [ ] Extract Area, gateway, workspace, repository detail, and snapshot storage by domain.
- [ ] Extract GitHub repository read model storage while preserving summary/detail/readme upsert semantics.
- [ ] Keep `MemoryLocalStore` behavior equivalent through a memory adapter or parity module.
- [ ] Keep all current imports of `createLocalStore` and `LocalStore` compiling.

**Acceptance criteria:**

- `src/main/storage.ts` is a thin facade, not the implementation.
- Raw SQLite calls exist only in the SQLite adapter/schema layer.
- Store modules fail with `DatabaseError`, not raw SQLite exceptions.
- Shared serializers/mappers own JSON parsing/stringifying and row conversion.
- The existing sync `LocalStore` interface remains stable.

**Required tests:**

- SQLite adapter converts a failing operation into `DatabaseError`.
- Fresh database creates all tables and default GitHub Area.
- Legacy pinned repositories and GitHub recents migrate into the default Area.
- Settings, account, cache, recents, pins, Area, gateway, workspace, snapshot, and GitHub repository read models
  preserve existing behavior.
- Memory store passes the same contract cases as SQLite for covered operations.

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
- [ ] Use Effect request identity for in-flight dedupe. Keep SQLite-backed `LocalStore` as the durable TTL cache.
- [ ] Port one endpoint first: `listRepositoriesWithStatus`.
- [ ] Extract a repository domain module for list/detail/readme/forks/refs/tree/contents/file content.
- [ ] Extract issue and pull request domain modules, including PR partial availability aggregation.
- [ ] Replace raw `setTimeout` device polling with an Effect `Schedule`-driven auth module.
- [ ] Move remaining domains one at a time: account, organizations, notifications, discussions, actions/workflows,
      projects, security, releases, contributors, search, and mutations.
- [ ] Collapse `GitHubProviderManager` into a thin compatibility adapter after duplicated wrappers are removed.

**Acceptance criteria:**

- `GitHubProviderManager` still satisfies `GitHubProvider`.
- Public IPC/preload calls compile unchanged.
- Manual `inFlight` maps are gone from completed read paths.
- Auth polling uses Effect scheduling, not raw `setTimeout`.
- Cache keys, TTLs, stale fallback, cache-only unavailable results, and mutation invalidation are equivalent.

**Required tests:**

- Cache module covers fresh hit, cache-only hit, cache-only miss, stale plus background refresh, live error with stale
  fallback, live error with no stale data, force refresh, dedupe, and invalidation.
- Provider facade delegates to domain modules while preserving inputs.
- Repository, issue, PR, auth schedule, and Octokit adapter tests preserve current behavior.
- Auth schedule tests cover pending retry, slow-down interval, expiry, cancel, success token save, and auth update
  emission.

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
- [ ] Remove renderer-exposed raw GitHub read twins where a statusful read exists.
- [ ] Keep resultful reads that do not have statusful replacements, such as readme, blame, access/security/wiki,
      and workflow logs.
- [ ] Extract main IPC registration into `src/main/ipc`. `src/main/index.ts` should bootstrap dependencies and call
      registration modules.
- [ ] Add a preload invoke/listener adapter so `src/preload/index.ts` does not repeat `ipcRenderer.invoke` for every
      route.
- [ ] Decompose `PullRequestDetail` into statusful routes for core metadata, files, commits, reviews, review
      threads, checks, timeline, linked issues, and comments.
- [ ] Migrate Area IPC only after the shared dispatcher proves duplicate-channel rejection and validation locality.

**Acceptance criteria:**

- `src/main/index.ts` has no direct `ipcMain.handle` calls.
- `src/preload/index.ts` has at most helper-level direct `ipcRenderer.invoke` usage.
- No renderer `ControlApi.github` raw read method remains when a statusful equivalent exists.
- Every IPC route is declared once, registered once, and exposed once.
- Pull request inspection data is no longer fetched as one monolithic detail payload.
- Sandbox, context isolation, token isolation, HTTPS external-link validation, cache-only reads, and stale-data
  behavior are unchanged.

**Required tests:**

- `src/main/ipc/ipcRouter.test.ts`: registration, duplicate-channel rejection, handler invocation, error propagation,
  and event exclusion.
- `src/main/ipc/registerControlIpc.test.ts`: settings, pins/recents, external-link validation, GitHub statusful
  reads, and mutations.
- Preload tests for invoke mapping and listener unsubscribe.
- Renderer and provider tests updated for decomposed PR detail routes.

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
- [ ] Extract repository shell pieces only after tab modules no longer require large prop bundles.
- [ ] Leave CollectionView, LocalRepositoryPage, and broad app shell decomposition for follow-up unless blocking.

**Acceptance criteria:**

- `App.tsx` no longer contains repository tab implementations such as `CodeTab`, `IssuesTab`, `PullRequestsTab`,
  `ActionsTab`, `AgentsTab`, `DiscussionsTab`, `ProjectsTab`, `ReleasesTab`, `ContributorsTab`, `WikiTab`,
  `SecurityQualityTab`, or `RepositorySettingsTab`.
- Repository tab query hooks live with their tab modules, not in `App()`.
- Extracted module interfaces are narrow and typed. No giant context dump and no 100-prop pass-through module.
- Query keys, enabled gates, cache-only mode, and warm prefetch behavior are equivalent.
- Existing renderer tests still cover routing, mutations, command palette, repository tabs, cache-only behavior, and
  availability states.

**Required tests:**

- Preserve and update `src/renderer/src/App.test.tsx` integration coverage.
- Add `useRepositoryContext.test.tsx` for stable context values and missing-provider invariant.
- Add targeted tab tests where extraction risks behavior: Code ref selection, Issues/Pulls mutation adapters, Actions
  workflow dispatch/rerun state, and inactive-tab query gating or warm prefetch.
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
- [ ] Replace discussion comment casts with explicit preview comment and loaded detail comment types.
- [ ] Remove rich PR review thread compatibility casts by deepening the shared review thread interface or deriving
      display data from typed comments.
- [ ] Give Project V2 mapping functions explicit shared return types.
- [ ] Remove dead helpers and fallback chains that only supported obsolete defensive shapes.

**Acceptance criteria:**

- `App.tsx` no longer contains raw GraphQL language handling through `totalSize`, `edges`, or `nodes`.
- `App.tsx` no longer contains `as Partial<DiscussionCommentSummary>` or similar domain casts.
- `src/shared/github.ts` has no domain `unknown` except mutation boundary fields.
- Provider mapping functions return shared types explicitly at the main-to-renderer seam.
- Renderer display code reads normalized fields, not raw adapter shapes.

**Required tests:**

- Provider tests prove repository language edges map to `LanguageStat[]` with expected `size` and `percent`.
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
- Moving Octokit raw response shapes into `src/shared`.
- Preserving old raw-shape compatibility "just in case".
- Combining this with task 5 or task 8.

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
- [ ] Remove `setSelectedRepository` if unused, or make it delegate through the same route builder.
- [ ] Rewrite `firstMarkdownHeading` with a compiled multiline regex while preserving the `README` fallback.
- [ ] Extract localStorage access and JSON parsing into `data/mockStorage.ts`.
- [ ] Keep `unknown` contained at the mock storage adapter seam.

**Acceptance criteria:**

- `App.tsx` no longer calls `getControlApi()` directly.
- `App.tsx` no longer owns markdown rendering internals.
- Repository route construction has one store-local source of truth.
- `firstMarkdownHeading` avoids per-line array allocation.
- `mock.ts` has no direct `localStorage`, `JSON.parse`, or duplicated serialized-read blocks.

**Required tests:**

- `format.test.ts`: null/empty fallback, first H1, indented H1, ignores H2, ignores bare `#`.
- `uiStore.test.ts`: route actions update selected repository/local repository consistently.
- `mockStorage.test.ts`: absent key fallback, invalid JSON fallback, wrong-shape fallback, write/read round trip, and
  fresh fallback factory values.
- `MarkdownBody.test.tsx`: safe HTTPS links route through callback, unsafe links/images render safely, and basic
  headings/lists/code still render.

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
      helpers.
- [ ] Convert simple `items + availability` result interfaces to exported aliases while preserving public type names.
- [ ] Define `GitHubIpcApi` in `src/shared/ipc.ts`, derived from `GitHubProvider` with explicit adapter overrides for
      IPC shape differences.
- [ ] Replace the manual `ControlApi.github` declaration with `github: GitHubIpcApi`.
- [ ] Add a typed GitHub route map or equivalent adapter seam so preload/main coverage is checked against
      `keyof GitHubIpcApi`.
- [ ] Replace `GitHubMutationInput` with a discriminated union grouped by action domain.
- [ ] Update provider, manager, renderer mutation call sites, and mocks to consume action-specific fields instead of
      arbitrary `payload` key reads.

**Acceptance criteria:**

- `ControlApi["github"]` is derived from `GitHubProvider`; duplicated manual method declarations are gone except
  explicit adapter overrides.
- Public result type names remain stable.
- Simple list results use `GitHubListResult<T>`.
- `GitHubMutationInput` has no `Record<string, unknown>` payload escape hatch.
- Existing IPC channel names and renderer method names stay stable.
- TypeScript catches missing preload/main GitHub route coverage.

**Required tests:**

- `src/shared/ipc.test.ts`: type-level assertions that `GitHubIpcApi` covers intended provider keys and adapter
  exceptions are explicit.
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
- Copying the provider interface into a new local interface under another name.
- Changing runtime behavior while doing type cleanup.

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

- [ ] Add `src/renderer/src/data/mocks/shared.ts` for shared constants, availability helpers, and storage helpers.
- [ ] Keep `src/renderer/src/data/mock.ts` exporting the same names during migration.
- [ ] Move read-only fixtures by domain: repository, refs, contents, organizations, contributors, discussions,
      projects, wiki, and security.
- [ ] Move mutable domains by behavior: notifications, issues, pulls, releases, and workflow runs.
- [ ] Preserve localStorage behavior and existing mutation results.
- [ ] Move `mockControlApi` construction into `src/renderer/src/data/mocks/api.ts`.
- [ ] Add shared test factories for rendering, `ControlApi`, domain fixtures, local Area fixtures, and mutations.
- [ ] Remove local duplicated `makeApi`, `renderControl`, Area fixtures, and command helpers from renderer tests.
- [ ] Split renderer tests into workflow files such as routing, areas, command palette, mailbox, repository code,
      issues, pulls, actions, releases, and security quality.
- [ ] Port state-heavy Playwright cases to RTL before pruning matching Playwright coverage.
- [ ] Remove all large fixture literals and mutation logic from `mock.ts`.

**Acceptance criteria:**

- `mock.ts` is either removed or only a small compatibility export surface.
- Mock data has domain locality under `src/renderer/src/data/mocks`.
- `mockControlApi` remains available to browser fallback through `getControlApi()`.
- Renderer tests use shared factories instead of duplicated local setup.
- No renderer test file remains a broad catch-all monolith.
- Playwright state tests are not deleted until equivalent RTL tests pass.
- `ControlApi` and shared contracts remain unchanged.

**Required tests:**

- Mock storage helpers: empty storage fallback, read/write round trip, and corrupt JSON fallback.
- Domain mutation tests for notifications, issues, pulls, releases, and actions.
- API adapter tests proving `*WithStatus` methods return matching data plus availability.
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
