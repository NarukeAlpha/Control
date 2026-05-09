# TODO — `feature/github-integration` Agent Checklist

Execution order: P1 → P2-concurrency → P2-components → P3 → P4 → P5
P2-concurrency + P2-components are a single phase (tightly coupled in App.tsx).

## P1 — Unblock Tests

- [x] P1.1 — `src/renderer/src/test/setup.ts` — add full `Storage` mock (getItem/setItem/removeItem/clear/key/length) with `Object.defineProperty(window, "localStorage", ...)` — 73 renderer tests fail with `browserStorageOrNull()?.getItem is not a function`
- [ ] P1.2 — `src/main/github/octokitProvider.test.ts` — fix ~5 stale query-scope assertions (agent added fields to GraphQL queries but didn't update tests)

## P2 — Concurrency

- [ ] P2.1 — `src/main/github/provider.ts` ~L1890 `createAppState()` — return immediately with `{ authenticated: true, viewer: null }` when token exists; do NOT `await getViewer()`
- [ ] P2.2 — `src/main/github/provider.ts` — fire `getViewer()` in background after `createAppState()` returns; on completion emit `github:auth-updated` IPC event with `{ viewer }` or `{ error }`
- [ ] P2.3 — `src/main/index.ts` — register `ipcMain.handle` for `github:auth-updated` listener pattern (or wire existing event channel)
- [ ] P2.4 — `src/renderer/src/App.tsx` — remove `appState.isSuccess` gate from `pinnedRepositories` and `recentItems` queries (pure local SQLite reads, no token needed)
- [ ] P2.5 — `src/renderer/src/App.tsx` — pre-fetch Code, Issues, Pulls, Actions tabs on repo open (replace `enabled: activeRepositoryTab === "tabName"` with `enabled: prefetchTabs.has(tabKey) || activeRepositoryTab === tabKey`); use `const prefetchTabs = new Set<RepositoryTab>(["code", "issues", "pulls", "actions"])`
- [ ] P2.6 — `src/renderer/src/App.tsx` — interleave mutation invalidation + refresh: `await Promise.all([...invalidations, ...refreshes])` instead of sequential `await Promise.all(invalidations); await Promise.all(refreshes)`
- [ ] P2.7 — `src/renderer/src/App.tsx` — avatar loading indicator: when `authenticated && !viewer`, show circular fading-gray rotation animation on avatar button; reusable CSS class for any loading/refreshing state

## P2 — Components

- [ ] P2.8 — `src/renderer/src/App.tsx` + new files — create `RepositoryContext.tsx` provider component wrapping `owner`, `repo`, `githubReady`, `api`, `queryClient`
- [ ] P2.9 — `src/renderer/src/hooks/useRepositoryContext.ts` — `useRepositoryContext()` hook returning `{ owner, repo, githubReady, api, queryClient }`
- [ ] P2.10 — extract `RepositoryCode.tsx` from `App.tsx` (co-located `useQuery`, consumes `useRepositoryContext()`)
- [ ] P2.11 — extract `RepositoryIssues.tsx` from `App.tsx`
- [ ] P2.12 — extract `RepositoryPulls.tsx` from `App.tsx`
- [ ] P2.13 — extract `RepositoryDiscussions.tsx` from `App.tsx`
- [ ] P2.14 — extract `RepositoryProjects.tsx` from `App.tsx`
- [ ] P2.15 — extract `RepositoryReleases.tsx` from `App.tsx`
- [ ] P2.16 — extract `RepositoryContributors.tsx` from `App.tsx`
- [ ] P2.17 — extract `RepositoryActions.tsx` from `App.tsx`
- [ ] P2.18 — extract `RepositoryWiki.tsx` from `App.tsx`
- [ ] P2.19 — extract `RepositorySecurityQuality.tsx` from `App.tsx`
- [ ] P2.20 — extract `RepositorySettings.tsx` from `App.tsx`
- [ ] P2.21 — extract `NotificationsView.tsx` from `App.tsx`
- [ ] P2.22 — extract `OrganizationsView.tsx` from `App.tsx`
- [ ] P2.23 — extract `CommandPalette.tsx` from `App.tsx`
- [ ] P2.24 — extract `AvailabilityBanner.tsx` shared component (replaces 96 inline `readAvailabilityMessage()` calls with `<AvailabilityBanner availability={a} featureLabel="..." />`)
- [ ] P2.25 — extract `GlassPanel.tsx` shared component
- [ ] P2.26 — extract `ExpandableList.tsx` shared component (wraps expand/collapse state + "Show more" button)
- [ ] P2.27 — extract `EmptyState.tsx` shared component
- [ ] P2.28 — `src/renderer/src/styles.css` — extract CSS design tokens (spacing, colors, radii, font sizes) to `:root` custom properties
- [ ] P2.29 — split `styles.css` into co-located CSS modules per extracted component (`.module.css` convention)
- [ ] P2.30 — `src/renderer/src/data/mock.ts` — split into `data/mocks/repository.ts`, `issues.ts`, `pulls.ts`, `discussions.ts`, `projects.ts`, `releases.ts`, `contributors.ts`, `actions.ts`, `wiki.ts`, `security.ts`, `notifications.ts`, `organizations.ts`

## P3 — Eliminate Boilerplate

- [ ] P3.1 — `src/main/github/provider.ts` — create generic `createProviderMethod<TInput, TResult>(keyPrefix, ttl, fn)` factory for the 35 `*WithStatus` methods (each ~10 lines of identical cache-key boilerplate)
- [ ] P3.2 — `src/main/index.ts` — replace 97 individual `ipcMain.handle` registrations with a channel-to-method mapping table: `const channelMap: Array<[string, (github: Provider, input: unknown) => Promise<unknown>]>`
- [ ] P3.3 — `src/renderer/src/hooks/useExpandableList.ts` — extract `useExpandableList(initialLimit, increment)` hook replacing 17 duplicate `useState` + `onExpand` patterns
- [ ] P3.4 — `src/renderer/src/App.tsx` — extract `repositoryQueryKeys` constant array (shared between `useQuery` calls and `invalidateRepositoryScopedQueries` callback; currently 30 keys hardcoded in the invalidation block)
- [ ] P3.5 — `src/main/github/provider.ts` — fuse organization list + team list into single GraphQL query (eliminates 3-layer serial waterfall: orgs → teams+repos+members+projects → teamRepos+teamMembers)
- [ ] P3.6 — `src/main/github/octokitProvider.ts` — implement fused org+teams GraphQL query

## P4 — Fix Defensive Coding

- [ ] P4.1 — `src/shared/github.ts` — define proper `GitHubLanguageNode`, `GitHubCommitNode`, `GitHubReleaseNode` etc. types (replace `?: unknown` on 59 GraphQL response fields)
- [ ] P4.2 — `src/renderer/src/App.tsx` — replace 56 `as` type casts with type guards or narrow return types in query functions
- [ ] P4.3 — `src/renderer/src/App.tsx` — remove redundant `??` fallback chains where upstream types guarantee non-null (>30 instances)
- [ ] P4.4 — replace `data?.field ?? default` pattern with `isSuccess && data.field` pattern where component already gates on query status

## P5 — Polish

- [ ] P5.1 — `src/main/github/octokitProvider.ts` — add pagination to PR review threads query (currently first page only)
- [ ] P5.2 — `src/main/github/octokitProvider.ts` — add pagination to discussion comments query (currently first page only)
- [ ] P5.3 — `src/main/github/provider.ts` — tune cache TTLs per domain (branches ~300s, issues ~30s, releases ~120s, etc.) instead of uniform 30/60/120s
- [ ] P5.4 — `src/main/github/provider.ts` — cache viewer profile in SQLite to skip `getViewer()` GraphQL call on warm starts
- [ ] P5.5 — `src/main/index.ts` — remove old non-`WithStatus` IPC methods once renderer exclusively uses `*WithStatus` variants (shrink ~60 channels → ~35)

## Files Summary

| File | Lines | Action |
|------|-------|--------|
| `src/renderer/src/App.tsx` | 24,877 | Extract 14 components + 4 primitives; fix concurrency gates; fix defensive casts/fallbacks |
| `src/renderer/src/styles.css` | 3,858 | Extract tokens; split into co-located modules |
| `src/renderer/src/data/mock.ts` | 3,390 | Split into 12 domain files |
| `src/main/github/provider.ts` | 2,015 | Optimistic auth; createProviderMethod factory; tune TTLs; fused org query; cache viewer |
| `src/main/github/octokitProvider.ts` | 6,708 | Fused org+teams query; pagination; fix test assertions |
| `src/main/index.ts` | ~400 | Channel map table; remove old channels |
| `src/shared/github.ts` | +1,368 | Define proper node types |
| `src/renderer/src/test/setup.ts` | ~20 | localStorage mock (DONE) |
