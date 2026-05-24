# Provider Architecture Cleanup

This is the implementation plan for the remaining GitHub provider cleanup. It
starts from the current baseline in `docs/done/github-cleanup-foundation.md` and
the process rules in `docs/design/architecture.md`.

Control is still GitHub-only at runtime. Future providers, including Azure
DevOps, are planning-only. Do not generalize this pass into a multi-provider
runtime. The goal is narrower: make the existing GitHub read/mutation surface
typed, cache-aware, and easier to migrate without changing process boundaries.

## Current Baseline

- `src/main/github/provider.ts` owns credential loading, provider lifetime,
  cache policy, background refresh, store writes, and mutation invalidation.
- `src/main/github/octokitProvider.ts` and the domain files beside it own live
  GitHub REST and GraphQL reads through Octokit.
- `src/shared/github.ts` defines serializable GitHub input/result contracts and
  the `GitHubProvider` interface used by both `OctokitProvider` and
  `GitHubProviderManager`.
- `src/shared/ipc.ts` defines the renderer-visible `ControlApi`, `GitHubIpcApi`,
  and `githubIpcRouteChannels`.
- `src/preload/index.ts` exposes `window.control` and forwards renderer calls
  over typed IPC channels.
- `src/main/ipc/registerGithubIpc.ts` currently contributes only
  `listRepositoriesWithStatus` and `mutate` through `createGithubIpcRoutes`.
  Most other GitHub routes are explicitly registered in
  `src/main/ipc/registerControlIpc.ts` through helpers such as
  `githubOptionalRoute`, `githubRepoRoute`, and `githubOrgRoute`.
- `src/renderer/src/api/controlApi.ts` returns `window.control` or
  `mockControlApi`.
- Renderer query ownership is already mostly split across hooks and route
  modules:
  - repository directory: `src/renderer/src/hooks/useRepositoryDirectory.ts`
  - account profile/work: `src/renderer/src/hooks/useAccountProfile.ts`,
    `src/renderer/src/hooks/useAccountWork.ts`
  - mailbox notifications: `src/renderer/src/hooks/useMailboxNotifications.ts`
  - repository detail/tabs: `src/renderer/src/hooks/useRepositoryRouteState.ts`
    plus tab modules under `src/renderer/src/components/repository`
  - organizations: `src/renderer/src/components/collection/organizationQueries.ts`
    and `src/renderer/src/components/collection/useOrganizationsRouteState.ts`
- Local-only data is exposed through `ControlApi` methods such as
  `listRepositoryPins` and `listRecentItems`, not through `api.github`.

## Non-Goals

- Do not add Azure DevOps or a provider registry.
- Do not add e2e tests unless explicitly requested.
- Do not move GitHub tokens, Octokit, filesystem, SQLite, or external-link
  behavior into the renderer.
- Do not rewrite repository tab UI while cleaning provider reads.
- Do not replace React Query. The cleanup should clarify query ownership, not
  introduce another client state layer.

## Problems To Solve

### 1. Provider Read Wrappers Are Too Shallow

`GitHubProviderManager` has four similar cache wrappers:

- `withCache`
- `withListStatusCache`
- `withStatusCache`
- `withRepositoryAccessCache`

The generic wrappers work, but `withListStatusCache` and `withStatusCache` build
typed empty/error results with casts like `as unknown as T`. Special cases such
as account profile, account repositories, repository lists, repository details,
README reads, and repository access each repeat parts of cache lookup, stale
fallback, background refresh, dedupe, store side effects, and availability
normalization.

### 2. Provider Contract Still Carries Raw Read Twins

`GitHubProvider` still exposes many non-status methods beside status-bearing
methods:

- list reads such as `listBranches` and `listBranchesWithStatus`
- detail reads such as `getIssueDetail` and `getIssueDetailWithStatus`
- collection reads such as `listOrganizations` and
  `listOrganizationsWithStatus`

Some raw methods are still useful internally for older call sites and simple
domain methods, but renderer-visible reads where unavailable/stale/partial
states affect UI should use `*WithStatus` only.

The current `GitHubIpcRawReadTwinKeys` list in `src/shared/ipc.ts` is a
transition scaffold that hides raw provider methods from `GitHubIpcApi` by
omitting them through `GitHubIpcAdapterKeys`. It is not itself a renderer route
allow-list. Shrinking it while a raw method still exists on `GitHubProvider`
would re-add that raw method to `ControlApi.github` and force a matching
`githubIpcRouteChannels` entry. Safe removal order is:

1. Remove or otherwise hide the raw method from `GitHubProvider` and all
   provider manager/preload/mock/runtime call sites.
2. Then remove the key from `GitHubIpcRawReadTwinKeys`.
3. If the raw method must remain on `GitHubProvider`, keep the key in
   `GitHubIpcRawReadTwinKeys` and document why it is intentionally not
   renderer-visible.

### 3. IPC Registration Is Partly Centralized

`src/shared/ipc.ts` has `githubIpcRouteChannels` for the whole `GitHubIpcApi`,
but `src/main/ipc/registerGithubIpc.ts` registers only:

- `listRepositoriesWithStatus`
- `mutate`

The rest of the GitHub API is still wired in `src/main/ipc/registerControlIpc.ts`.
Those routes are explicit, not dynamic, but their parse helpers are separated
from the route map in `src/shared/ipc.ts`. That makes validation inconsistent:
only the two centralized routes receive parse functions in
`registerGithubIpc.ts` today. Migrating routes must remove the old
`registerControlIpc.ts` entry in the same slice so `registerIpcRoutes` never
registers duplicate channels.

### 4. Local Reads Are Still Coupled To App/Auth Readiness

`App.tsx` computes:

```ts
const githubReady = appState.isSuccess && githubAuthenticated;
```

That is the right live GitHub readiness signal. It should continue to drive
`api.github.*` cache-only behavior and live mutations.

However, local-only reads should not depend on successful GitHub auth:

- `useRecentItems(recentItemLimit, { enabled: appState.isSuccess })`
- `useRepositoryPins()`, which currently has no explicit app-ready input
- `useAreasShell({ enabled: appState.isSuccess })`

The issue to fix is not every `appState.isSuccess` usage. The narrow target is
local SQLite data that can render while a token is missing, expired, refreshing,
or offline. It is acceptable for these reads to wait until the preload bridge
exists and `getAppState()` has returned once.

### 5. Viewer Cache Invalidation Is Ambiguous

`GitHubProviderManager.clearToken()` clears the token and in-memory viewer, but
cached viewer/account data is written through:

- `this.store.saveAccount("github", viewer.login, viewer)`
- `this.store.saveAccount("github-viewer", viewer.login, viewer)`

The plan needs an explicit decision:

- Either sign-out removes the `github-viewer` account cache so a later signed-out
  startup cannot show the previous viewer as authenticated context.
- Or sign-out keeps it as display-only warm cache, but `createAppState()` must
  never surface it as authenticated and the document must say why.

Prefer removal or invalidation of `github-viewer` on sign-out unless current
storage constraints make that impossible. If removal requires a new store method,
add it in a focused storage change with tests.

### 6. Organization Query Waterfall Is Real But Localized

The organization waterfall is concentrated in
`src/renderer/src/components/collection/organizationQueries.ts`.

Current shape:

1. `useOrganizationsRouteQueries` loads organizations.
2. It derives `selectedOrganization` from the selected login or first item.
3. Organization repositories, members, teams, and projects start only after that
   organization object exists.
4. Team repositories and team members start only after teams load and
   `selectedOrganizationTeam` is derived.

The manual refresh path in `refreshOrganizationsRouteData` is already parallel
for known selected organization/team keys, so the main waterfall is initial
selection and query enabling.

### 7. Boundary Types Still Have Casts And Fallback Chains

Known cast/fallback cleanup targets:

- `src/main/github/provider.ts` casts in status cache helpers.
- `src/main/ipc/registerControlIpc.ts` parser helper casts such as
  `as TInput` and `as unknown as TInput`.
- `src/renderer/src/components/collection/organizationQueries.ts` non-null
  assertions on `selectedOrganization!` and `selectedOrganizationTeam!`.
- `src/renderer/src/hooks/useRepositoryPins.ts` casts `pin.nameWithOwner as
string` after filtering.
- Command palette builders still cast selected organization/team inputs in
  `src/renderer/src/components/command-palette/commandPaletteItemBuilders.ts`.
- `src/preload/index.ts` necessarily casts IPC invoke/event payloads, but those
  casts should stay isolated to preload rather than spreading into renderer
  feature code.
- IPC parser casts are acceptable only as boundary-local scaffolding while the
  parser returns are still generic. If this cleanup touches those helpers, move
  toward typed parser-return builders rather than spreading additional
  `unknown` casts into provider or renderer code.

Do not chase every test-only cast in this cleanup. Runtime boundary and route
logic casts matter most.

## Target Architecture

### Main Process

`src/main` remains the only place that can:

- load GitHub credentials
- construct `OctokitProvider`
- call GitHub REST/GraphQL
- read/write SQLite cache entries and repository read models
- decide cache TTL, stale fallback, negative cache, and mutation invalidation
- emit auth/repository update events

Provider reads should move toward a small number of typed read policies:

- raw cached value read: throws on cache miss when `cacheOnly` is true
- list status read: returns `GitHubListResult<TItem>`
- nullable/detail status read: returns `GitHubNullableResult<TKey, TValue>` or
  another explicit result type with `availability`
- compound status read: returns explicit multi-availability types such as
  `RepositoryAccessResult`
- repository model read: uses repository summary/detail tables, not only generic
  `cache_entries`

### Preload

`src/preload/index.ts` remains a forwarding layer. It should not know cache
semantics, auth state, query keys, or provider rules. Acceptable preload logic:

- default optional inputs for routes where `GitHubIpcApi` allows them
- invoke the exact channel from `githubIpcRouteChannels`
- expose typed event subscriptions with unsubscribe functions

### Renderer

Renderer code owns:

- React Query keys and query enabling
- cache-only vs live intent based on `githubReady`
- UI states for availability results
- local-only queries for recents, pins, and areas
- mutation invalidation of renderer query caches

Renderer code must not:

- call raw non-status GitHub reads for UI data that can be unavailable or stale
- infer provider error classes
- inspect token state beyond `AppState.github`
- duplicate main-process cache TTL decisions

### Shared Contracts

`src/shared/github.ts` should remain the canonical serializable contract file.
Prefer stronger result aliases over casts:

- `GitHubListResult<T>`
- `GitHubNullableResult<TKey, TValue>`
- explicit result interfaces where the shape is not list/nullable
- discriminated mutation inputs in `GitHubMutationInput`

Avoid `unknown` and broad `Record<string, unknown>` at the IPC/provider boundary
except inside parser implementations.

## Implementation Plan

### Phase 1: Inventory And Lock The Current Contract

Owner files:

- `src/shared/github.ts`
- `src/shared/ipc.ts`
- `src/preload/index.ts`
- `src/main/github/provider.ts`
- `src/main/github/octokitProvider.ts`
- `src/renderer/src/data/mocks/api.ts`

Tasks:

1. Generate an inventory of every `GitHubProvider` method and classify it:
   `renderer-status-read`, `renderer-mutation`, `main-internal-raw-read`, or
   `legacy-raw-read-candidate`.
2. Cross-check every key in `githubIpcRouteChannels` against `ControlApi.github`
   in `src/preload/index.ts` and `mockControlApi.github` in
   `src/renderer/src/data/mocks/api.ts`.
3. For each non-status raw read in `GitHubProvider`, record whether it is still
   called by runtime renderer code. Use `rg "api.github\\.[a-zA-Z0-9]+\\("` and
   inspect only non-test call sites.
4. Mark adapter-only shape differences separately from true provider methods.
   Example: `GitHubProvider` declares `getRepositoryWithStatus(owner, repo)`,
   `GitHubProviderManager` also exposes an IPC-friendly overload accepting
   `RepoDetailInput`, and `GitHubIpcApi` overrides that route back to object
   input. Do not force object-shaped IPC inputs down into `OctokitProvider`
   just to make the inventory table look uniform.
5. Record which keys in `GitHubIpcRawReadTwinKeys` hide raw methods from
   renderer-visible IPC and which are candidates for method removal.
6. Do not remove methods in this phase unless an inventory proves they have no
   runtime call sites and no main-process internal use.

Expected result:

- A small table in the implementing PR description, or a temporary checklist in
  the PR body, showing status reads, mutations, adapter-only overloads, raw
  methods hidden from IPC, and raw methods that remain with a concrete reason.

### Phase 2: Replace Cast-Based Status Cache Helpers

Owner files:

- `src/main/github/provider.ts`
- `src/main/github/provider.test.ts`
- `src/main/github/readCache.ts`
- `src/main/github/readCache.test.ts`

Implement a typed helper that separates cache control from result construction.
Do not make callers pass partially typed empty objects that need casts.

Recommended shape:

- `readCachedStatus<TResult>(spec)` handles common flow:
  - read generic cache entry by key
  - honor `cacheOnly`
  - honor `forceRefresh`
  - return fresh cache
  - return stale cache and refresh in background
  - call live loader through `refreshCachePayload`
  - fallback to stale cache on live failure
  - dedupe force/non-force loads
- `spec.empty(availability)` builds the correctly typed empty result.
- `spec.error(error)` builds the correctly typed error result when no stale
  cache exists.
- `spec.isAvailable(result)` defaults to
  `result.availability.status === "available"` but can be overridden for
  compound results.
- `spec.cacheWrite(result, previous)` decides whether the live result should be
  cached, which TTL class to use, and whether a stale available cache should
  survive.

Cache-write rules must be explicit before converting methods:

- `available` live results replace the cache and use the normal route TTL.
- `not_found` and `permission_denied` may be negative-cached only if the route
  can represent that state without hiding older useful data. Use a short
  negative TTL, keep it separate from the available cache key when stale
  available data should still be shown, and document the route-specific reason.
- `partial` results should be cached only when the result shape preserves
  independent availability for every pane or subresource. Do not overwrite a
  fully available cached result with a partial result unless the UI can merge or
  clearly present the partial state.
- `error`, `not_loaded`, and transient auth/network states should not replace
  available cached payloads. If no cached payload exists, return the typed empty
  result and optionally store a short-lived negative result only when repeated
  live retries would be harmful.
- On live failure after a stale hit, return the stale available payload and do
  not downgrade the stored cache to the failure result.
- Background refresh after a stale hit must be fully observed. The helper should
  catch and log asynchronous refresh failures so there are no unhandled promise
  rejections, and successful background refreshes must notify the renderer. Use
  the existing repository update events when the cache key is repository-scoped,
  or add a narrow invalidation callback to the cache spec for non-repository
  keys. Without this, React Query can keep rendering stale data until focus or a
  manual refresh even though main already refreshed the cache.

Then define narrow helpers on top:

- `withListStatusCache<TItem, TResult extends GitHubListResult<TItem>>(...)`
  should return `GitHubListResult<TItem>`-compatible data without `as unknown as
T`.
- `withNullableStatusCache<TKey extends string, TValue>(...)` should cover
  result shapes like `{ detail: null, availability }`, `{ item: null,
availability }`, `{ profile: null, availability }`, and `{ tree: null,
availability }`.
- Keep `withRepositoryAccessCache` separate unless the compound result helper
  makes it clearer without weakening types.

Do not convert every provider method in one giant diff. Convert low-risk methods
first:

1. organization list/team/member/project methods
2. repository refs and metadata lists
3. issue/pull list resources
4. detail reads after list reads are covered

Leave repository list/detail special storage paths in place until their behavior
is covered by existing `readCache`/provider tests. `listRepositoriesWithStatus`
and `getRepositoryWithStatus` are sequencing guards: they use `GitHubReadCache`,
repository summary/detail read-model tables, local recent writes, and generic
`cache_entries` differently from ordinary `withListStatusCache` calls. Do not
move them onto the generic status helper until contract tests prove the special
paths still preserve read-model writes and cache-only behavior.

Tests to add or update:

- cache-only miss returns `not_loaded` with an empty typed result
- cache-only hit does not call `provider()`
- stale hit returns cached payload and schedules background refresh
- force-refresh bypasses fresh cache
- live error with stale cache returns stale cached payload
- live error without stale cache returns typed error result
- available live result writes cache with the configured TTL
- permission-denied/not-found/partial live results follow the route's documented
  negative-cache or no-cache policy and do not erase stale available data by
  accident
- cache-only repository list and detail reads avoid token/provider construction
- live repository list and detail refreshes still update repository read-model
  tables and recent repository state

### Phase 3: Make Cache Policy Explicit

Owner files:

- `src/main/github/provider.ts`
- optionally `src/main/github/provider.test.ts`

Move `cacheTtlMs` from a bare object into a documented policy block or helper
near the cache wrapper implementation. Keep the same numeric values unless a
specific test or behavior proves a value wrong.

Document the current rationale in code comments next to the policy:

- fast queues: notifications, Actions runs, issue/pull lists
- active details: pull request and issue details
- repository navigation: contents, commits, README, tree
- stable metadata: branches, tags, labels, workflow definitions, wiki,
  security policy, contributors
- organization directory: org/team/member/project summaries

The comments should explain classes of TTLs, not every endpoint line-by-line.

### Phase 4: Clarify Sign-Out And Viewer Cache Semantics

Owner files:

- `src/main/github/provider.ts`
- `src/main/storage/accountStore.ts`
- `src/main/storage/localStoreAdapter.ts`
- `src/main/storage/memoryStore.ts`
- relevant storage tests
- `src/main/github/providerAuthScheduler.test.ts`
- `src/main/github/provider.test.ts`

Tasks:

1. Reconcile the decision with `docs/design/architecture.md`: warm startup is
   intentionally allowed to hydrate `viewer` from `github-viewer` only when a
   GitHub token exists. `createAppState()` already returns
   `authenticated: false` and `viewer: null` when no token is present.
2. Choose one policy explicitly:
   - Preferred: remove the `github-viewer` cache on sign-out. Add a real
     account deletion API across `LocalStore`, `LocalStoreAdapter`,
     `MemoryStore`, and `accountStore`; do not overload `saveAccount` with
     null payloads.
   - Acceptable deferral: retain `github-viewer` only as token-present warm
     display data. If this is chosen, add a non-goal note to the PR and tests
     proving signed-out startup never surfaces the cached viewer.
3. Keep the older `github` account cache separate from the `github-viewer`
   startup cache unless the storage migration deliberately consolidates them.
4. On `GitHubProviderManager.clearToken()`, clear:
   - keychain token
   - `providerPromise`
   - `authenticatedViewer`
   - `authRefreshPromise`
   - pending device sign-in
   - viewer-specific account cache, if the chosen policy is removal
5. Ensure `createAppState()` never reports `github.authenticated: true` without
   a token.
6. Ensure cached viewer display data cannot be mistaken for an active signed-in
   session after sign-out.

Acceptance tests:

- signed-out startup with stale `github-viewer` account does not report an
  authenticated user
- clearing token removes or invalidates `github-viewer` according to the chosen
  policy
- token-present startup can still use `github-viewer` as warm display data if
  the chosen policy intentionally retains it
- auth update event after sign-out contains `viewer: null` and
  `github.authenticated: false`

### Phase 5: Remove Local Cache Gates That Depend On GitHub Auth

Owner files:

- `src/renderer/src/App.tsx`
- `src/renderer/src/hooks/useRecentItems.ts`
- `src/renderer/src/hooks/useRepositoryPins.ts`
- `src/renderer/src/components/areas/useAreasShell.ts`
- `src/renderer/src/App.test.tsx`
- `src/renderer/src/hooks/repositoryRefresh.test.ts`

Scope this narrowly:

- Keep `githubReady` for live GitHub reads, writes, and `cacheOnly: !githubReady`.
- Local-only reads can wait for `appState.isSuccess`, because the app shell and
  preload bridge must exist.
- Do not require `githubReady` for recents, pins, or Areas.
- If any local query is blocked by `appState.isSuccess` only because it needs
  app settings, document that dependency in the hook call or hook input.

Concrete changes to evaluate:

- Keep `useRecentItems(recentItemLimit, { enabled: appState.isSuccess })` if the
  intended gate is "the bridge is ready"; rename the hook input from `enabled`
  to something like `appReady` only if it improves clarity.
- Add an explicit `enabled` or `appReady` input to `useRepositoryPins` so its
  query behavior matches recents and can be tested.
- Keep `useAreasShell({ enabled: appState.isSuccess })` as an app-ready local
  read if Areas depends only on the preload bridge and local storage. Rename the
  input to `appReady` only if that makes the dependency clearer at the call
  site. Do not gate Areas on `githubReady`.
- Ensure sign-out invalidation in
  `src/renderer/src/components/auth/providerAuthAdapters.ts` does not clear or
  hide local recents, pins, or Areas unless a mutation actually changed them.

Tests:

- expired or unauthenticated app state still renders local recents
- expired or unauthenticated app state still renders pinned repositories from
  `listRepositoryPins`
- expired or unauthenticated app state still renders Areas from local storage
  through `useAreasShell`
- GitHub repository lists still call `listRepositoriesWithStatus` with
  `cacheOnly: true` when `githubReady` is false

### Phase 6: Collapse Renderer Organization Query Waterfall

Owner files:

- `src/renderer/src/components/collection/organizationQueries.ts`
- `src/renderer/src/components/collection/useOrganizationsRouteState.ts`
- `src/renderer/src/App.test.tsx`
- `src/renderer/src/data/mocks/api.ts`

Do not start with a new main-process combined endpoint unless measuring or code
inspection shows the renderer cannot solve the serial dependency. The current
provider methods already expose the needed units with availability.

Default cold start remains the risk case for the renderer-only approach. If the
selected organization is not known until the organization list returns, the app
still has a serial path: list organizations, choose first organization, then
start organization repositories/members/teams/projects. Implement the string-key
cleanup first, but measure this default path; if it is the common slow path,
promote the later `OrganizationOverviewResult` endpoint into the next slice
rather than treating it as distant future work.

Implementation direction:

1. Split selected keys from selected objects.
   - Derive `selectedOrganizationLogin` as:
     explicit selected login -> first organization item login -> null.
   - Use that login string for query keys and enabled checks.
   - Derive the selected organization object separately for rendering.
2. Start organization repositories, members, teams, and projects as soon as the
   selected organization login string is known. They should not need the whole
   `OrganizationSummary` object. If `useOrganizationsRouteState` already has
   an explicit selected login from recents, command palette, or a deep link,
   these queries should start immediately from that string without waiting for
   the organization list to load.
3. Derive `selectedOrganizationTeamSlug` as:
   explicit selected slug -> first loaded team slug -> null.
4. Start team repositories and team members as soon as both selected org login
   and selected team slug are known. If both strings came from an explicit
   recent/deep-link selection, do not wait for a full `TeamSummary` object.
5. Remove non-null assertions in query functions. Each query should close over
   a local non-null `orgLogin` or `teamSlug` created before the `useQuery` call,
   or use small query factory functions whose inputs are already narrowed.
6. Keep each query's availability state independent:
   - organizations
   - organization repositories
   - organization members
   - organization teams
   - organization projects
   - team repositories
   - team members

If a real combined provider read is still needed after this renderer cleanup,
add it as a separate later phase:

- Add a new result type in `src/shared/github.ts`, for example
  `OrganizationOverviewResult`.
- Add a GitHub provider method only if the GraphQL query can fetch org summary,
  repositories, teams, members, projects, and first selected team data with
  independent partial availability.
- Do not replace the existing granular reads until the combined result proves it
  preserves partial states and does not over-fetch for normal route changes.

Tests:

- opening Organizations starts dependent org queries after the first org login
  is known without requiring user selection
- default cold start timing is measured before and after the renderer-only
  cleanup; if the org-list -> first-org -> dependent-query waterfall remains
  user-visible, create the combined overview slice immediately after Phase 6
- opening an explicit organization from recents, command palette, or a deep link
  starts repos/members/teams/projects immediately from the selected login
- selecting an organization starts repos/members/teams/projects in parallel
- opening an explicit team starts team repos and team members immediately when
  both selected org login and team slug are known
- selecting a team starts team repos and team members in parallel
- a failure in one organization pane does not hide successful panes
- cached unauthenticated reads use `cacheOnly: true`

### Phase 7: Centralize IPC Route Registration Incrementally

Owner files:

- `src/shared/ipc.ts`
- `src/main/ipc/registerGithubIpc.ts`
- `src/main/ipc/registerControlIpc.ts`
- `src/main/ipc/registerGithubIpc.test.ts`
- `src/main/ipc/registerControlIpc.test.ts`
- `src/preload/index.ts`
- `src/preload/index.test.ts`

Do this after the provider/read contracts are stable enough to avoid churn.

Tasks:

1. Move routes from `src/main/ipc/registerControlIpc.ts` into
   `src/main/ipc/registerGithubIpc.ts` in small groups. Each moved route must
   be removed from `registerControlIpc.ts` in the same slice so the app never
   registers the same channel twice.
2. Extend `registerGithubIpc.ts` from two hand-written routes into grouped
   route registration for GitHub read methods.
3. Keep parse functions strict at the IPC boundary. Do not move raw unknowns
   into provider code.
4. Start with low-risk list/status reads that have simple input:
   - organizations
   - organization teams/repositories/members/projects
   - branches/tags
   - releases/contributors
5. Keep mutation parsing as-is unless a specific mutation input is wrong.
6. Update `registeredGithubIpcRouteKeys` so tests can assert routes are actually
   registered.
7. Ensure `githubIpcRouteChannels` remains checked with
   `satisfies Record<keyof GitHubIpcApi, IpcChannel>`.
8. Add or preserve a hard duplicate-channel guard in the IPC router startup path.
   Incremental migration should fail fast if a route remains registered in both
   `registerControlIpc.ts` and `registerGithubIpc.ts`.

Tests:

- each newly centralized route parses required string inputs and optional
  positive integer/boolean inputs
- invalid input rejects before reaching the provider
- the old `registerControlIpc.ts` registration is gone for every moved channel,
  and `createControlIpcRoutes` still composes `createGithubIpcRoutes(github)`
  exactly once
- duplicate channel registration throws during test/startup rather than
  silently shadowing one handler
- preload invokes the exact channel from `githubIpcRouteChannels`

### Phase 8: Remove Or Document Legacy Raw Reads

Owner files:

- `src/shared/github.ts`
- `src/shared/ipc.ts`
- `src/main/github/provider.ts`
- `src/main/github/octokitProvider.ts`
- domain provider files under `src/main/github/*Domain.ts`
- `src/renderer/src/data/mocks/api.ts`

Removal rule:

- Remove a raw read only when no runtime renderer code, preload route, main IPC
  route, mock API, or provider manager path uses it.
- For methods listed in `GitHubIpcRawReadTwinKeys`, remove or hide the raw
  method from `GitHubProvider` first, then shrink `GitHubIpcRawReadTwinKeys`.
  Do not shrink that list while the raw method still exists on `GitHubProvider`;
  doing so re-adds the method to `GitHubIpcApi` and requires a new
  `githubIpcRouteChannels` entry.
- If `OctokitProvider` keeps a raw method for internal composition, it should not
  be part of renderer-visible IPC unless the raw result is intentionally enough
  for the UI.

Candidates to remove from renderer-visible IPC first:

- raw account/profile/repository/organization/list methods already covered by
  `*WithStatus`
- raw repository tab reads already using status-bearing query hooks
- raw search in favor of `searchWithStatus`

If a raw method remains, document one of these reasons in the PR:

- internal provider composition only
- local fallback path with no availability-bearing UI
- compatibility path that will be removed in a named follow-up

Acceptance:

- `GitHubIpcRawReadTwinKeys` shrinks only after the corresponding raw
  `GitHubProvider` method is removed or hidden; otherwise it keeps the key with
  a comment explaining why the raw method remains non-renderer-visible.
- `ControlApi.github` exposes status-bearing methods for renderer reads where
  availability affects UI.
- `mockControlApi.github` matches the final `ControlApi.github` contract.
- `githubIpcRouteChannels` still satisfies
  `Record<keyof GitHubIpcApi, IpcChannel>` without adding raw route channels
  back by accident.

### Phase 9: Clean Runtime Casts At Boundary Hotspots

Owner files:

- `src/main/github/provider.ts`
- `src/main/ipc/registerControlIpc.ts`
- `src/main/ipc/registerControlIpc.test.ts`
- `src/renderer/src/components/collection/organizationQueries.ts`
- `src/renderer/src/hooks/useRepositoryPins.ts`
- `src/renderer/src/components/command-palette/commandPaletteItemBuilders.ts`
- `src/renderer/src/components/repository/githubMutationHelpers.ts`

Tasks:

- Replace provider helper casts with typed result builders from Phase 2.
- Replace organization query non-null assertions with narrowed local variables.
- Replace `pin.nameWithOwner as string` with a typed predicate such as
  `hasGitHubRepositoryPinName(pin): pin is RepositoryPinRecordWithName`.
- Replace command palette selected organization/team casts by narrowing before
  building command items, or by changing the builder input types so selected
  values are concrete where those commands are included.
- Keep IPC parser casts boundary-local if they remain. If this phase touches
  parser helpers, prefer typed parser-return helpers such as
  `requireRepoScopedInput`, `requirePullRequestDetailInput`, and
  `requireIssueDetailInput` returning concrete input types without generic
  `as unknown as TInput` at each route.
- Parser-return helpers must perform runtime validation of required strings,
  positive integers, booleans, arrays, and nullable fields. They are not allowed
  to be thin wrappers around `payload as T`; malformed renderer payloads should
  fail before reaching provider code.
- Keep `githubMutationHelpers.ts` cast only if discriminated union construction
  cannot be expressed cleanly. If it remains, it should be the only mutation
  input cast, and mutation payload validation stays in IPC.

## Acceptance Criteria

- Provider cache wrapper logic no longer relies on `as unknown as T` for
  status/list result construction.
- Cache-only reads do not instantiate `OctokitProvider` or request a token.
- Stale cache fallback behavior is tested for list and nullable/detail results.
- Availability-bearing live results have documented write/negative-cache rules,
  including `permission_denied`, `not_found`, `partial`, transient `error`, and
  whether stale available data survives.
- Repository list/detail cache-only reads avoid token/provider construction, and
  live refreshes still update repository read-model tables.
- Cache TTL rationale is documented next to the policy.
- Sign-out has explicit viewer cache semantics and tests.
- Local recents, pins, and Areas render from local storage when GitHub auth is
  missing, expired, offline, or refreshing.
- Organization route queries start as early as their selected org/team keys are
  known and preserve independent availability for each pane.
- Renderer runtime code uses status-bearing GitHub reads where availability
  matters.
- `GitHubIpcRawReadTwinKeys` is reduced only after the corresponding raw
  provider method is removed or hidden, or every remaining key has a concrete
  reason.
- IPC routes migrated into `registerGithubIpc.ts` are removed from
  `registerControlIpc.ts` in the same slice, with parser and route-mapping
  tests updated.
- Shared contract changes keep `mockControlApi.github`, preload mappings, and
  IPC tests in parity with `GitHubIpcApi`.
- Preload stays a narrow forwarding layer and does not gain provider/cache
  policy.
- No e2e tests are added unless a later task explicitly asks for them.

## Suggested Review Slices

Keep PRs small enough to validate:

1. Provider typed cache helper and low-risk method conversions.
   - Owns: `src/main/github/provider.ts`, focused provider/read-cache tests.
   - If shared result aliases change, also update `src/shared/github.ts`,
     `src/renderer/src/data/mocks/api.ts`, and any preload/IPC mapping tests
     needed for type parity.
2. Viewer cache/sign-out semantics.
   - Owns: provider auth code, storage account deletion/retention paths, and
     storage/provider auth tests.
3. Local recents/pins/Areas auth-gate cleanup.
   - Owns: local query hooks, `App.tsx` wiring, provider auth adapter
     invalidation, and renderer tests for unauthenticated startup.
4. Organization query waterfall cleanup.
   - Owns: organization route state/query files and mock API data needed by
     renderer tests.
5. IPC centralization for one route group.
   - Owns: `src/shared/ipc.ts`, both IPC registration files, preload mapping,
     `src/renderer/src/data/mocks/api.ts`, `src/preload/index.test.ts`,
     `src/main/ipc/registerGithubIpc.test.ts`, and
     `src/main/ipc/registerControlIpc.test.ts`.
6. Legacy raw read removal.
   - Owns: shared provider/IPCs, provider manager, Octokit/domain provider
     methods, mock API parity, preload mapping tests, and IPC route tests.

These slices can be parallelized only when they touch disjoint files. Provider
helper work and legacy method removal should stay serialized because they both
change `src/shared/github.ts`, `src/shared/ipc.ts`, and
`src/main/github/provider.ts`.

## Validation Commands

Before closing implementation work:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Targeted commands for faster iteration:

```bash
bun run test -- src/main/github/provider.test.ts src/main/github/readCache.test.ts
bun run test -- src/main/ipc/registerGithubIpc.test.ts src/preload/index.test.ts
bun run test -- src/renderer/src/App.test.tsx src/renderer/src/hooks/repositoryRefresh.test.ts
```

Use the full validation set before merging any code change. For doc-only updates
to this plan, `bun run format:check` is sufficient.
