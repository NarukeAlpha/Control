# Cleanup Part 2: Stabilize And Deepen The GPT-5.5 Baseline

## Goal

`cleanup-v2-gpt` now uses the GPT-5.5 implementation as the baseline. This follow-up plan is not a second
full-codebase cleanup pass. It is a stabilization and deepening pass that keeps the best modules from the baseline,
then ports the strongest ideas from the Composer and DeepSeek runs where they improve correctness, locality, or
leverage.

The baseline is allowed to be large. Part 2 should avoid judging it by diff size and instead focus on whether each
new module has a clear interface, owns a real runtime path, and makes future changes easier to reason about.

## Source Run Summary

### GPT-5.5 Baseline: `t3code/913f0931`

Keep this as the source of truth for the merged cleanup work.

What it did well:

- Introduced the strongest Effect-backed IPC bridge shape: one managed runtime, native `Error` conversion at the
  IPC seam, defect logging, and no renderer-facing `{ ok, error }` union.
- Centralized external HTTPS link parsing and applied it to more than one runtime path.
- Split storage into deeper modules: database, schema, serializers, domain stores, mappers, memory store, and a
  thinner facade.
- Added transactional repository-status cache writes, which gives GitHub provider work a safer storage seam.
- Added reusable IPC route/preload modules with tests instead of scattering registration logic through
  `src/main/index.ts`.
- Extracted renderer repository tabs and mock domains, and added `mockStorage.ts` as a reusable renderer test seam.
- Added enough tests that the implementation is not just file movement.

What can be better:

- `src/main/github/octokitProvider.ts` is still the dominant Octokit adapter. The GPT-5.5 baseline added useful
  cache, rate-limit, dedupe, and auth-scheduler modules, but it did not complete the original Task 3 goal of moving
  GitHub domains behind domain-local provider modules.
- `PullRequestDetail` is still one broad shared payload carrying comments, files, commits, reviews, checks, review
  threads, timeline events, and linked issues. The original cleanup plan intentionally deferred that split until the
  IPC catalog was stable; Part 2 must now schedule it explicitly.
- Renderer extraction still leaves large tab modules and a large `App.tsx`; ownership of query, state, and tab-local
  behavior should move behind smaller tab interfaces over time.
- `CollectionView`, `LocalRepositoryPage`, and the broader shell routes remain outside the repository-tab extraction
  work. They should be handled as a later shell-decomposition slice, not assumed complete because tabs moved.
- GitHub mutation validation is still mostly envelope validation. It does not yet prove action-specific payload
  requirements at the IPC seam.
- Some cache availability behavior can hide partial failure if stale data is returned as fully available.
- Some shared contract changes are broad and should be followed by exact route-map parity tests and JSON-safe type
  checks.

Definitely keep:

- `src/main/effect/ipcBridge.ts`
- `src/main/effect/appLayer.ts`
- `src/main/externalLinks.ts`
- `src/main/github/readCache.ts`
- `src/main/github/rateLimit.ts`
- `src/main/github/requestDedupe.ts`
- `src/main/github/deviceSignInScheduler.ts`
- `src/main/github/providerAuthScheduler.ts`
- `src/main/storage/*` module split
- `src/main/ipc/*` registration helpers
- `src/renderer/src/data/mockStorage.ts`
- `src/renderer/src/data/mocks/*`
- `src/renderer/src/components/MarkdownBody.tsx`
- Repository tab extraction as a starting point, not the final UI architecture.

### Composer Reference: `t3code/73490501`

Use this run as an idea mine for stricter contracts. Do not port it wholesale.

What it did well:

- Pushed toward discriminated GitHub mutation inputs instead of a generic `payload: unknown` interface.
- Identified useful storage seams around adapters, schema bootstrap, serializers, settings, accounts, and cache
  stores.
- Added tests around meaningful seams: Effect IPC, storage serialization, read cache, preload listeners, and
  markdown rendering.
- Tried to wire GitHub read-cache behavior into `listRepositoriesWithStatus`, which is the right kind of
  user-visible cache seam.

What to avoid:

- Do not partially migrate mutation contracts. Provider, renderer, preload, mocks, tests, and shared types must move
  together for each mutation slice.
- Do not add IPC validators that are named as validators but delegate to `any`.
- Do not add adapters with methods that throw "not implemented" on paths that look production-ready.
- Do not leave the `window.open` external-link path outside the shared policy.

Definitely keep:

- Discriminated mutation input direction.
- Serializer and cache-store test ideas.
- Read-cache interface idea for statusful GitHub reads.
- The expectation that mutation contracts should be proven at the shared interface, not normalized ad hoc inside
  renderer code.

### DeepSeek Reference: `t3code/91459bf3`

Use this run for focused seam design. It often found small modules worth keeping, even when the implementation was
not complete enough to merge.

What it did well:

- Kept useful concepts small: `externalLinks.ts`, `mockStorage.ts`, notification mock extraction,
  `useControlApi`, and a shared IPC route-channel map.
- Added targeted tests around bridge behavior, URL parsing, mock storage, notification mocks, route state, and IPC
  map shape.
- Treated `mockStorage.ts` as a real adapter seam instead of leaving every mock module to parse `localStorage`
  independently.
- Showed that a renderer API hook can improve locality without changing the whole renderer architecture.

What to avoid:

- Do not trim and accept whitespace-padded external URLs; the cleanup contract rejects them.
- Do not let `setWindowOpenHandler` bypass the same external-link policy used by IPC.
- Do not use empty interfaces where type aliases or `satisfies` preserve the same interface with less lint noise.
- Do not add storage scaffolding unless it owns a runtime path or is explicitly isolated as a test-only module.

Definitely keep:

- The small-module instinct.
- `mockStorage.ts` as the storage adapter for renderer mocks.
- `useControlApi` as a renderer seam.
- Runtime route-map parity tests, implemented without duplicating the route map by hand.

## Part 2 Execution Rules

- Treat GPT-5.5 as the baseline and make targeted follow-up branches from `cleanup-v2-gpt`.
- Keep one owner per slice. If a slice changes IPC contracts, it owns main registration, preload exposure, renderer
  call sites, mocks, and tests for that contract.
- A module earns its place only when deleting it would push complexity back into multiple callers.
- Prefer fewer, deeper interfaces over many pass-through files.
- Every slice must name whether it is stabilizing the baseline, porting a Composer idea, or porting a DeepSeek idea.
- Do not add e2e tests unless specifically requested.

Current baseline gaps that remain in scope:

- `src/main/github/octokitProvider.ts` still owns most GitHub domains. The support modules around it are valuable,
  but they do not count as provider domain extraction by themselves.
- `src/shared/github.ts` still exposes `PullRequestDetail` as one broad payload. Keeping that payload for
  compatibility is fine; forgetting the follow-up split is not.
- Repository tab extraction does not finish renderer architecture. `CollectionView`, `LocalRepositoryPage`, and
  broad app-shell state still need their own follow-up after tab modules have narrow interfaces.

## Follow-Up Slices

### 1. Stabilize External Link Policy Everywhere

**Source:** GPT-5.5 baseline plus DeepSeek acceptance lessons.

**Problem:** The baseline centralizes external link policy, but Part 2 should prove every link-opening path uses the
same parser and the same rejection rules.

**Checklist:**

- [ ] Inventory every `shell.openExternal` call and every `setWindowOpenHandler` path.
- [ ] Ensure all main-process external navigation goes through `src/main/externalLinks.ts`.
- [ ] Reject non-string, malformed, relative, protocol-relative, whitespace-padded, and non-HTTPS URLs.
- [ ] Preserve native `Error` behavior across IPC with stable `name`, `message`, `code`, and JSON-safe `details`.
- [ ] Add tests for both IPC `openExternal` and `window.open` handling.

**Keep:** GPT-5.5 external-link module.

**Port:** DeepSeek's small focused URL-policy test style, but correct the whitespace behavior.

### 2. Strengthen IPC Route Parity And Runtime Validation

**Source:** GPT-5.5 IPC router plus DeepSeek route-map idea.

**Problem:** Shared types help, but Electron IPC still needs runtime validation and exact route-map parity. Types
alone do not protect the process seam.

**Checklist:**

- [ ] Add a runtime test that every declared channel is registered exactly once.
- [ ] Add a runtime test that every preload-exposed method invokes the expected channel string.
- [ ] Ensure event routes strip raw Electron event objects before reaching renderer callbacks.
- [ ] Replace any generic validators that accept everything on migrated routes.
- [ ] Add JSON-serializability checks for IPC return values that cross `src/shared`.

**Keep:** GPT-5.5 IPC modules and preload tests.

**Port:** DeepSeek's route-channel parity idea, but derive expected routes from the real map instead of hand-copying
strings into tests.

### 3. Make Cache Availability Honest

**Source:** GPT-5.5 read cache plus Composer read-cache intent.

**Problem:** Statusful GitHub reads should not make stale fallback data look fully live. The interface should tell
the renderer whether data is live, stale, partial, unavailable, or served after an error.

**Checklist:**

- [ ] Audit `src/main/github/readCache.ts` for stale fallback availability.
- [ ] Ensure stale fallback includes explicit stale/error metadata.
- [ ] Keep cache writes transactional when a summary and status are saved together.
- [ ] Add tests for live success, live failure with stale fallback, permanent 404, rate limit, and offline network
      failure.
- [ ] Ensure negative caching is limited to authorization-independent permanent misses.

**Keep:** GPT-5.5 read-cache module and storage transaction primitive.

**Port:** Composer's goal of making `listRepositoriesWithStatus` a first-class statusful cache seam.

### 4. Extract GitHub Provider Domain Modules

**Source:** Original cleanup Task 3, GPT-5.5 main-process support modules, and DeepSeek's small-module discipline.

**Problem:** `src/main/github/octokitProvider.ts` still owns most GitHub domains in one large module. The baseline
created good supporting modules, but the provider itself has not yet gained domain locality.

**Checklist:**

- [ ] Keep `GitHubProvider` and `GitHubProviderManager` as compatibility interfaces while domains move behind them.
- [ ] Move one domain per slice and delete the old method bodies from `octokitProvider.ts` in the same slice.
- [ ] Start with the repository domain: list/detail/readme/forks/refs/tree/contents/file content.
- [ ] Move issues and pull requests next, including PR partial availability aggregation.
- [ ] Move remaining domains in deliberate order: account, organizations, notifications, discussions,
      actions/workflows, projects, security, releases, contributors, search, and mutations.
- [ ] Domain modules should own raw Octokit response mapping, GitHub error mapping, pagination handling, and
      availability translation for their domain.
- [ ] Use the shared `rateLimit`, `requestDedupe`, scheduler, and `readCache` modules rather than recreating
      per-domain throttles, in-flight maps, polling loops, or stale fallback helpers.
- [ ] Define cross-domain invalidation rules for mutations before moving mutating endpoints. Pulls, issues,
      releases, actions, and repository settings must declare which repository and list caches they invalidate.
- [ ] Keep multi-step cache writes transactional when a logical result spans repository summary, metadata, status,
      detail, or generic result rows.
- [ ] Add facade delegation tests proving public provider inputs, cache-only flags, force-refresh flags, pagination
      cursors, and auth context are preserved.

**Keep:** GPT-5.5 `readCache`, `rateLimit`, `requestDedupe`, device sign-in scheduler, and provider auth scheduler.

**Port:** Composer's read-cache interface idea and DeepSeek's preference for focused modules with real runtime paths.

### 5. Deepen Mutation Contracts

**Source:** Composer discriminated mutation direction plus GPT-5.5 IPC map.

**Problem:** The baseline validates mutation envelopes, but the mutation interface still allows too much payload
shape to remain implicit.

**Checklist:**

- [ ] Pick one mutation domain first, such as repository status or notifications.
- [ ] Replace generic `payload` handling with a discriminated input type for that domain.
- [ ] Validate action-specific required fields at the IPC router seam.
- [ ] Update provider method calls, preload typing, renderer calls, mocks, and tests in the same slice.
- [ ] Preserve falsey but valid values such as `false`, `0`, and empty strings when they are meaningful.
- [ ] Add compile-time contract tests and runtime invalid-payload tests.

**Keep:** GPT-5.5 shared route map and IPC registration modules.

**Port:** Composer's stricter mutation input direction, but only one domain at a time.

### 6. Design And Split Pull Request Detail Payloads

**Source:** Original cleanup Task 4 follow-up requirement plus GPT-5.5 IPC route catalog work.

**Problem:** `PullRequestDetail` is still one large shared contract. It mixes PR overview fields with comments,
files, commits, reviews, review decision, checks, review threads, timeline events, and linked issues. Splitting it
without a route catalog and renderer concurrency plan can create a slower waterfall, so Part 2 needs an explicit
design slice before implementation.

**Checklist:**

- [ ] Start with a design slice that maps every current `PullRequestDetail` field to an owned subresource:
      overview, comments, files, commits, reviewers, reviews, review decision, checks, review threads, timeline,
      and linked issues.
- [ ] Define the new statusful result contracts with explicit availability for each subresource and pagination
      metadata where "Load More" behavior exists or is likely.
- [ ] Keep the existing monolithic `getPullRequestDetail` and `getPullRequestDetailWithStatus` routes as
      compatibility paths until renderer consumers move.
- [ ] Prove the renderer composition model before deleting the old payload: queries must run concurrently, preserve
      cache-only and force-refresh behavior, and avoid a sequential request waterfall.
- [ ] Add route validators and preload methods through the route catalog for each new PR detail subresource.
- [ ] Move provider implementation behind the pull-request domain module from slice 4 before expanding many PR
      routes.
- [ ] Update mocks and renderer tests so partial PR failures can show stale, unavailable, rate-limited, or
      permission-denied sections independently.
- [ ] Add tests that the old compatibility route and the composed new routes return equivalent data for a complete
      fixture before the old route is removed.

**Keep:** The current `PullRequestDetail` contract as a compatibility module until the split is proven end to end.

**Port:** GPT-5.5 route-catalog discipline; do not port a payload split that creates renderer latency regressions.

### 7. Turn Renderer Tab Extraction Into Ownership

**Source:** GPT-5.5 renderer extraction plus DeepSeek small seam preference.

**Problem:** The baseline extracts tab files, but several tabs remain large and depend on wide prop surfaces. A tab
module should own its query composition, prefetch function, transient state, and error boundary.

**Checklist:**

- [ ] Pick one tab first, preferably the smallest high-value tab.
- [ ] Move tab-specific query hooks from `App.tsx` into the tab module or a tab-local hook.
- [ ] Export a pure `prefetchData` function so warm prefetch behavior stays explicit.
- [ ] Keep tab-local scroll/draft state stable across tab switches.
- [ ] Wrap extracted tab modules in an error boundary and Suspense where appropriate.
- [ ] Keep UI primitives presentational; pass context as props instead of reading repository context from primitive
      modules.

**Keep:** GPT-5.5 tab files and `RepositoryContext`.

**Port:** DeepSeek's `useControlApi` seam and small-module discipline.

### 8. Decompose The Broader App Shell After Tabs

**Source:** Original cleanup Task 5 follow-up note.

**Problem:** Repository tabs are only one part of `App.tsx`. The broader shell still owns global routing, collection
views, local repository views, command/search flows, auth state, and app-level navigation. Part 2 should not imply
that tab extraction finishes the renderer architecture.

**Checklist:**

- [ ] Do not start broad shell moves until repository tab modules have narrow interfaces and no longer require large
      prop bundles.
- [ ] Inventory shell responsibilities in `App.tsx`: global navigation, auth state, repository route selection,
      `CollectionView`, `LocalRepositoryPage`, command palette, search, sidebars, and global route actions.
- [ ] Extract one visible workflow per slice. Each extracted shell module should own its query hooks, route adapter,
      transient state, and tests.
- [ ] Keep global route actions such as home, mailbox, collections, local repositories, and GitHub repositories on
      one typed navigation interface instead of leaving separate Zustand and component-local paths.
- [ ] Preserve warm data loading, query keys, selected repository behavior, and local repository route state.
- [ ] Add tests for routing and state retention before removing the old `App.tsx` implementation path.

**Keep:** GPT-5.5 repository shell and tab extraction as the base to build from.

**Port:** DeepSeek's `useControlApi` seam only where it reduces repeated API lookup or route plumbing.

### 9. Finish Renderer Mock Storage Adoption

**Source:** GPT-5.5 `mockStorage.ts` plus DeepSeek focused adapter tests.

**Problem:** `mockStorage.ts` exists as the right seam. Part 2 should finish routing persisted mock behavior through
that adapter so mock modules do not drift.

**Checklist:**

- [ ] Replace remaining direct `localStorage` and ad hoc `JSON.parse` blocks in mock modules.
- [ ] Define write-failure behavior for quota errors and unavailable storage.
- [ ] Keep notification, issue, pull, release, and action mocks using the same adapter.
- [ ] Add shared beforeEach/afterEach cleanup for storage, query clients, timers, mocks, DOM, and module-level
      state.
- [ ] Keep cross-domain fixture integrity tests as mock domains move.

**Keep:** GPT-5.5 `mockStorage.ts` and mock domain split.

**Port:** DeepSeek's adapter-test focus.

### 10. Promote Storage Serialization Errors To A Clear Interface

**Source:** GPT-5.5 storage split plus Composer serializer tests.

**Problem:** Storage modules should distinguish database I/O failure, migration failure, and corrupted serialized
data. That gives callers a useful interface instead of treating every problem as a generic database failure.

**Checklist:**

- [ ] Define storage error tags for I/O, migration, serialization corruption, and unavailable database.
- [ ] Decide per store whether corrupted JSON is a miss, a recoverable warning, or a hard failure.
- [ ] Add shared contract tests that run against SQLite and memory adapters.
- [ ] Ensure memory and SQLite implementations use the same test suite.
- [ ] Keep `close()`/teardown deterministic for SQLite and no-op memory adapters.

**Keep:** GPT-5.5 storage modules and memory store.

**Port:** Composer's serializer test coverage idea.

## Recommended Order

1. External link policy stabilization.
2. IPC route parity and runtime validation.
3. Cache availability honesty for `listRepositoriesWithStatus`.
4. First GitHub provider domain extraction, starting with repository reads.
5. One mutation-domain contract cleanup, including invalidation rules for that domain.
6. Pull request detail design slice, then incremental PR subresource routes after the PR provider domain exists.
7. Renderer tab ownership, one tab at a time.
8. Broader shell decomposition for `CollectionView`, `LocalRepositoryPage`, and global navigation.
9. Mock storage adoption.
10. Storage serialization error types.

This order keeps process-seam correctness ahead of renderer cleanup, while still preserving momentum on the UI and
mock work that made the GPT-5.5 baseline valuable.

## Completion Evidence For Each Part 2 Slice

Each follow-up branch should report:

- Baseline module kept.
- Composer or DeepSeek idea ported, if any.
- Runtime path changed.
- Old path removed or bypassed.
- Tests added or updated.
- Validation commands and results.
- Residual risk.
