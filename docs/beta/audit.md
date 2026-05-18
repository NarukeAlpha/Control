# Feature Branch Audit: `feature/github-integration`

Branch state: ~80-85% code complete, ~65-70% complete with tests/docs. Agent paused.

## Overview

46k insertions across 36 files (3 commits). The branch replaces `gh-cli` auth with GitHub OAuth device flow and adds 12 repository tabs, organizations/teams, notifications, file blame/tree/wiki, security/quality signals, releases, command palette, pins, and recents. Every GitHub read supports `cacheOnly`, `forceRefresh`, and `*WithStatus` availability tracking.

## What Went Well

- **Backend architecture is solid.** `credentials.ts` (73 lines), `webOAuth.ts` (162 lines), `provider.ts` (2015 lines), `octokitProvider.ts` (6708 lines), `storage.ts` — each has a clear responsibility. No process-boundary violations.
- **Typed IPC surface is exhaustive.** Every GitHub domain has typed contracts in `src/shared/github.ts` (+1368). `*WithStatus` pattern returns `{ items, availability }` for every read so the renderer can surface loading/empty/denied/stale states.
- **Security boundary intact.** No tokens in renderer. No shell execution. Keytar-backed token storage with graceful fallback.
- **Docs updated correctly.** `architecture.md` and `sync-strategy.md` removed all `gh-cli` references, replaced with OAuth device flow and correct file pointers.
- **Typecheck and lint pass clean.**

---

## Critical Structural Issues

### Monolithic `App.tsx` — 24,877 lines

| Metric                       | Count  |
| ---------------------------- | ------ |
| Lines                        | 24,877 |
| Top-level functions          | 218    |
| Inline component definitions | 302    |
| `useQuery` hooks             | 64     |
| Expand/collapse limit states | 17     |
| `as` type casts              | 56     |
| `??` fallback chains         | 30+    |

Every GitHub surface is inlined. Zero new component files were created in `src/renderer/src/`.

**Remediation:** Extract one component file per tab surface into `src/renderer/src/components/`:
`RepositoryCode.tsx`, `RepositoryIssues.tsx`, `RepositoryPulls.tsx`, `RepositoryDiscussions.tsx`,
`RepositoryProjects.tsx`, `RepositoryReleases.tsx`, `RepositoryContributors.tsx`,
`RepositoryActions.tsx`, `RepositoryWiki.tsx`, `RepositorySecurityQuality.tsx`,
`RepositorySettings.tsx`, `NotificationsView.tsx`, `OrganizationsView.tsx`, `CommandPalette.tsx`.

Extract shared UI primitives: `GlassPanel`, `AvailabilityBanner`, `StatusBadge`,
`ExpandableList`, `TabHeader`, `EmptyState`.

### Monolithic `styles.css` — 3,858 lines

| Metric              | Count |
| ------------------- | ----- |
| Class selectors     | 650   |
| Ad-hoc `font-size`  | 82    |
| Ad-hoc `background` | 153   |

No CSS custom properties, no co-location with components.

**Remediation:** Extract design tokens (spacing, colors, radii, font sizes) into CSS custom properties. Co-locate styles with components using CSS modules or a `component.module.css` convention.

### Monolithic `data/mock.ts` — 3,390 lines

All test fixtures for 12+ surfaces in one file.

**Remediation:** Split into `data/mocks/repository.ts`, `data/mocks/issues.ts`, etc.

---

## Defensive Coding Patterns

Against the AGENTS.md guidance to prefer strong types over `unknown` and redundant guards:

| Pattern                      | Files                       | Count      | Example                                                           |
| ---------------------------- | --------------------------- | ---------- | ----------------------------------------------------------------- |
| `: unknown` in domain types  | App.tsx, octokitProvider.ts | 59 total   | GraphQL response shapes using `?: unknown` for every field        |
| `as` type casts              | App.tsx                     | 56         | Casts where return type narrowing would suffice                   |
| `??` fallback chains         | App.tsx                     | 30+        | Guards against `null` the type system already excludes            |
| Weak GraphQL response shapes | App.tsx L3740-3772          | ~12 fields | `name?: unknown; color?: unknown` instead of `GitHubLanguageNode` |

The `unknown` usage in `main/index.ts` (5 instances) and `main/storage.ts` (10 instances) is legitimate — those are IPC/deserialization boundaries. The renderer is where the excessive defensiveness lives.

**Remediation:**

- Define proper `GitHubLanguageNode`, `GitHubCommitNode` etc. types in `src/shared/github.ts`
- Replace `as` casts with type guards or narrow return types in query functions
- Remove `?? fallback` chains where the upstream type already guarantees a value
- Use `isSuccess && data` pattern instead of `data?.field ?? default`

---

## Boilerplate & Duplication

### WithStatus pattern (35 methods × ~10 lines = ~350 lines of cache-key boilerplate)

Every `WithStatus` method follows this identical shape:

```ts
async listFooWithStatus(input: FooInput): Promise<FooResult> {
  const key = `foo:${input.owner}/${input.repo}:${input.limit ?? 50}`;
  return this.withListStatusCache(
    key, 60_000,
    async () => (await this.provider()).listFooWithStatus(input),
    { forceRefresh: input.forceRefresh, cacheOnly: input.cacheOnly }
  );
}
```

**Remediation:** A generic `createProviderMethod<TInput, TResult>(options)` factory would eliminate ~300 lines.

### IPC channel registration (97 `ipcMain.handle` calls in `main/index.ts`)

Every channel follows `ipcMain.handle(ipcChannels.foo, (_event, input) => github.foo(input))`.

**Remediation:** A channel-to-method mapping table:

```ts
const channelMap: Array<[string, (github: Provider, input: unknown) => Promise<unknown>]> = [
  [ipcChannels.githubViewer, (g) => g.getViewer()],
  [ipcChannels.githubRepositoriesWithStatus, (g, i) => g.listRepositoriesWithStatus(i)]
  // ...
];
for (const [channel, handler] of channelMap) {
  ipcMain.handle(channel, (_e, input) => handler(github, input));
}
```

### Old non-WithStatus methods kept for backward compat

Doubles the IPC surface. 60+ channels where ~35 would suffice if renderer only uses `*WithStatus` variants.

### Query invalidation block (30 keys hardcoded)

The `invalidateRepositoryScopedQueries` callback in App.tsx lists every query key manually. If a new query is added without updating this list, mutations won't refresh it.

**Remediation:** Extract to a `repositoryQueryKeys` constant array that both the `useQuery` calls and the invalidation function reference.

### 17 expand/collapse limit states

Each tab surface reinvents:

```ts
const [fooLimit, setFooLimit] = useState(6);
const onExpandFoo = () => setFooLimit((prev) => prev + 6);
```

**Remediation:** Extract to a shared `useExpandableList(initialLimit, increment)` hook.

### `readAvailabilityMessage` called 96 times inline

Same 3-line `readAvailabilityMessage(...)` pattern repeated at every query site.

**Remediation:** Extract to a shared `AvailabilityBanner` component that takes `availability` and a `featureLabel`.

---

## IPC Surface Size

| Metric                            | Count |
| --------------------------------- | ----- |
| `ipcChannels` entries             | ~60   |
| `ControlApi.github` methods       | ~55   |
| `ipcMain.handle` registrations    | 97    |
| `preload/index.ts` bridge methods | ~55   |

Each channel has 4 registration points: shared constant, `ControlApi` type, preload bridge, and `ipcMain.handle`. Adding a new GitHub surface requires touching 4 files.

---

## Concurrency Issues

### 1. `createAppState` blocks on `getViewer()` network call

**`src/main/github/provider.ts:1890`**

```ts
viewer = await new OctokitProvider(token).getViewer();
```

The `getAppState()` IPC call won't resolve until GitHub's GraphQL API responds. Every renderer query has `enabled: appState.isSuccess`. On slow networks this means **500ms-2s of completely blank UI**.

**Fix:** Return `appState` immediately with `authenticated: "checking"`. Start `getViewer()` in the background. Let renderer queries fire with `cacheOnly: true` immediately, transition to live data when the viewer call resolves.

### 2. `cacheOnly: !githubReady` forces two-pass rendering

Because `githubReady = appState.isSuccess && githubAuthenticated`, every query fires twice:

- Pass 1: `cacheOnly: true` (auth not ready) — reads cached SQLite data
- Pass 2: `cacheOnly: false` (auth confirmed) — network refresh, re-renders

When auth is fast (<100ms), this double-render is wasteful.

**Fix:** With #1 fixed, use `placeholderData` from `@tanstack/react-query` so cached data shows immediately and network data fills in without an intermediate blank state.

### 3. Organization view: 3-layer serial waterfall

```
organizations list ──→ selectedOrganization derived
                           │
                    ┌──────┼──────┬──────────┐
                    ▼      ▼      ▼          ▼
               orgTeams  orgRepos orgMembers orgProjects
                    │
            selectedTeam derived
                    │
               ┌────┴────┐
               ▼         ▼
          teamRepos  teamMembers
```

Layer 1 loads → Layer 2 (4 parallel queries) loads → Layer 3 (2 parallel queries) loads. Three sequential render passes.

**Fix:** Fuse org list + team list into a single GraphQL query. Pre-select the first team so team detail fetches alongside org detail.

### 4. No tab pre-fetching

Each tab's `useQuery` is gated on `activeRepositoryTab === "tabName"`. Switching from Code → Issues → Pulls shows 3 loading spinners in sequence.

**Fix:** Fire all tab queries in the background when a repository is opened (not just the active tab). Use `staleTime` to prevent over-fetching on re-visits.

### 5. Initial render blank — localized data waits on auth

Pinned repos and recent items are purely local (SQLite reads, no token needed). Yet they're gated behind the `appState.isSuccess` → `cacheOnly: !githubReady` chain.

**Fix:** Remove `appState.isSuccess` gate from `pinnedRepositories` and `recentItems` queries. They can render instantly from SQLite.

### 6. Sequential post-mutation refreshes

Mutation handlers do:

```ts
await Promise.all(invalidations); // wait for all cache invalidations
await Promise.all(refreshes); // then start refreshes
```

These could be interleaved:

```ts
await Promise.all([...invalidations, ...refreshes]);
```

---

## Performance Concerns

- Some GraphQL queries return first page only (PR reviews, discussion comments) — pagination is incomplete
- Cache TTLs are uniform (30/60/120s) rather than domain-appropriate (branches change rarely, issues change frequently)
- No lazy loading of tab surfaces — the `repository` query fires even for tabs the user never visits
- `getViewer()` GraphQL call on every app start — could cache viewer profile in SQLite with a long TTL

---

## Test Health

| Layer                                                | Tests   | Pass   | Fail   | Rate    |
| ---------------------------------------------------- | ------- | ------ | ------ | ------- |
| Main process (provider, storage, OAuth, credentials) | 42      | 42     | 0      | 100%    |
| Main process (octokitProvider)                       | ~30     | ~25    | 5      | 83%     |
| Renderer (App.test.tsx)                              | ~73     | 0      | 73     | 0%      |
| **Total**                                            | **115** | **42** | **73** | **37%** |

### Renderer failures

Root cause: `browserStorageOrNull()?.getItem is not a function` — missing `localStorage` mock in the test environment (`src/renderer/src/test/setup.ts`). Fixing this alone may resolve 50+ tests. Remaining failures are routing assertions that need updating for the new route shape.

### octokitProvider failures

Query scope assertions are stale — the agent added fields to GraphQL queries but didn't update the corresponding test assertions.

---

## Recommended Optimizations (Prioritized)

### P1 — Unblock tests

1. Add `localStorage` mock to `src/renderer/src/test/setup.ts`
2. Fix octokitProvider query scope assertions to match current queries

### P2 — Fix concurrency

3. Restructure `createAppState` to return immediately, validate token in background
4. Remove `appState.isSuccess` gate from local-only queries (pins, recents)
5. Remove per-tab `enabled` gate — fire all tab queries on repo open
6. Interleave mutation invalidations and refreshes

### P2 — Extract components

7. Extract one component file per tab surface into `src/renderer/src/components/`
8. Extract shared primitives: `AvailabilityBanner`, `GlassPanel`, `ExpandableList`, `EmptyState`
9. Split `styles.css` into co-located CSS modules
10. Split `data/mock.ts` per domain

### P3 — Eliminate boilerplate

11. Generic `createProviderMethod<T>` factory for `WithStatus` methods
12. Channel-to-method mapping table in `main/index.ts`
13. `useExpandableList` hook for the 17 expand/collapse limit states
14. `AvailabilityBanner` component for the 96 `readAvailabilityMessage` calls
15. `repositoryQueryKeys` constant for query invalidation

### P4 — Fix defensive coding

16. Define proper GraphQL node types in `src/shared/github.ts` instead of `?: unknown`
17. Replace `as` casts with type guards or narrow return types
18. Remove redundant `??` fallback chains where upstream types guarantee values

### P5 — Polish

19. Add pagination to PR review threads and discussion comments
20. Tune cache TTLs per domain
21. Cache viewer profile in SQLite to skip `getViewer()` on warm starts
22. Remove old non-`WithStatus` IPC methods once renderer only uses status variants

---

## Design Decisions (Grill Session)

### Execution Order

Hard dependencies enforce this sequence:

1. **P1** — Fix test infrastructure (safety net prevents regressions during refactor)
2. **P2 concurrency** — Restructure `createAppState` and data flow (touch the same `useQuery` hooks in the same file as component extraction)
3. **P2 components** — Extract from monolith (depends on stable data flow after concurrency fixes)
4. **P3** — Eliminate boilerplate (depends on components existing — can't extract `AvailabilityBanner` from a file where it's not a component yet)
5. **P4** — Fix defensive coding (types get defined alongside extracted components)
6. **P5** — Polish (low-priority, no dependencies)

P2 concurrency + P2 components should be a single phase since they're tightly coupled in `App.tsx`.

---

### P1: Fix Test Infrastructure

**Decision:** Fix the test environment, not the production code.

Since the production code's `try`/`catch` pattern around `window.localStorage` is correct for browsers, the anomaly is jsdom returning `{}` instead of a proper `Storage` implementation.

```ts
// src/renderer/src/test/setup.ts
const storageMock: Storage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(() => null),
  length: 0
};
Object.defineProperty(window, "localStorage", {
  value: storageMock,
  writable: true,
  configurable: true
});
```

---

### P2 Concurrency: Optimistic Auth + Lazy `getViewer`

**Decision:** Option B — return `getAppState()` immediately with `authenticated: true` if token exists. No validation wait. `getViewer()` runs in background. Main process drives auth state updates via IPC.

**Rationale:** Performance is paramount. The current blocking `getViewer()` GraphQL call creates 500ms-2s of blank UI. Cached SQLite data renders immediately via `staleTime`, then network data fills in behind (<300ms typical). The <1% case of expired token surfaces clean error states.

**Implied changes:**

1. `createAppState()` returns immediately with `authenticated: true` and `viewer: null` when token exists
2. `getViewer()` fires in background in the main process
3. On completion, emits `github:auth-updated` IPC event with `{ viewer }` or `{ error }`
4. Renderer queries fire immediately with `cacheOnly: false` (since `githubReady = true`)
5. `staleTime` on queries means cached data renders instantly, network fills in behind
6. If `getViewer()` fails (expired token): emit event → renderer sets `authenticated: false` → queries already in-flight show errors gracefully

**Avatar loading indicator:** When `authenticated && viewer === null`, the avatar button in `TopBar` shows a circular fading-gray rotation animation instead of the profile picture. This indicator is reusable for any loading/refreshing state via a shared CSS class.

```
State: authenticated && viewer === null
  → show rotating circular fade animation on avatar
State: authenticated && viewer !== null
  → show avatar image
State: !authenticated
  → show "C" fallback (existing behavior)
```

---

### P2 Concurrency: Tab Pre-fetching

**Decision:** Option B — pre-fetch Code, Issues, Pulls, Actions tabs on repo open. Remaining tabs stay lazy.

**Rationale:** Code/Issues/Pulls/Actions cover ~80% of tab visits. Pre-fetching all 12 tabs would fire ~36 simultaneous GitHub requests — excessive. Combined with `staleTime: 120_000`, once fetched the top 4 tabs stay fresh for 2 minutes, making subsequent tab switches instant.

**Implied change:** Replace `activeRepositoryTab === "tabName"` gates with a `prefetchTabs` constant:

```ts
const prefetchTabs = new Set<RepositoryTab>(["code", "issues", "pulls", "actions"]);
// Each tab query: enabled: ... && prefetchTabs.has(tabKey) || activeRepositoryTab === tabKey
```

---

### P2 Components: Extraction Architecture

**Decision:** Option B — co-located queries. Each tab component owns its own `useQuery` hooks. No props drilling for query data. React Query cache deduplication prevents double-fetching (identical `queryKey` patterns automatically dedupe).

**Rationale:** Avoids 14 components × N query props of prop drilling. The `queryKey` pattern (`["issues", owner, repo]`) already provides deduplication via `@tanstack/react-query`. Components are self-contained — you can read a single component file and understand its data dependencies without tracing through App.tsx.

```tsx
// RepositoryIssues.tsx
function RepositoryIssues({ owner, repo }: { owner: string; repo: string }) {
  const { githubReady, api } = useRepositoryContext();
  const issues = useQuery({
    queryKey: ["issues", owner, repo],
    queryFn: () => api.github.listIssuesWithStatus({ owner, repo, cacheOnly: !githubReady })
  });
  // ...
}
```

---

### P2 Components: Shared Data Access

**Decision:** Option B — `useRepositoryContext()` hook. Provides `{ owner, repo, githubReady, api, queryClient }` to all tab components.

**Rationale:** `owner` and `repo` never change while a repository is open. `githubReady` is a global boolean. A context hook eliminates 14 components × 4 identical props = 56 lines of prop drilling. The hook is consumed at the leaf (tab component), not at the App level.

```ts
// Expected shape:
const { owner, repo, githubReady, api, queryClient } = useRepositoryContext();
```

---

### Component File Plan

```
src/renderer/src/
├── components/
│   ├── RepositoryCode.tsx
│   ├── RepositoryIssues.tsx
│   ├── RepositoryPulls.tsx
│   ├── RepositoryDiscussions.tsx
│   ├── RepositoryProjects.tsx
│   ├── RepositoryReleases.tsx
│   ├── RepositoryContributors.tsx
│   ├── RepositoryActions.tsx
│   ├── RepositoryWiki.tsx
│   ├── RepositorySecurityQuality.tsx
│   ├── RepositorySettings.tsx
│   ├── NotificationsView.tsx
│   ├── OrganizationsView.tsx
│   ├── CommandPalette.tsx
│   ├── AvailabilityBanner.tsx
│   ├── ExpandableList.tsx
│   ├── GlassPanel.tsx
│   ├── EmptyState.tsx
│   └── RepositoryContext.tsx
├── hooks/
│   ├── useRepositoryContext.ts
│   └── useExpandableList.ts
├── styles/
│   └── (co-located CSS modules per component)
└── data/
    └── mocks/
        ├── repository.ts
        ├── issues.ts
        ├── pulls.ts
        └── ...
```
