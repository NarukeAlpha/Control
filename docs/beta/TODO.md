# TODO - `feature/github-integration` Cleanup Plan

Source audit: `docs/beta/audit.md`.
Related beta notes: `docs/beta/front-end.md`, `docs/beta/sync-strategy.md`.

## Goal

Turn the large beta GitHub integration branch from "mostly implemented" into a branch that is maintainable,
fast at startup, testable, and safe to merge. The branch should keep the existing process boundary intact:

- main process owns GitHub auth, provider orchestration, credentials, SQLite, and cache policy
- preload exposes typed IPC only
- renderer owns React UI, local interaction state, and query composition
- shared owns serializable cross-process contracts

## Non-Goals

- Do not add new GitHub product surfaces while cleaning this up.
- Do not add e2e tests unless explicitly requested.
- Do not move OAuth tokens, refresh tokens, keychain entries, or credential validation into the renderer.
- Do not introduce a hosted sync backend or any cross-machine sync behavior.
- Do not refactor unrelated app areas unless they directly block this cleanup.

## Execution Order

1. P0 baseline and safety rails
2. P1 test unblocking
3. P2 startup, auth, and query concurrency
4. P3 renderer decomposition
5. P4 CSS, UI consistency, and mock data cleanup
6. P5 main-process boilerplate reduction
7. P6 type cleanup and defensive-code removal
8. P7 provider completeness and cache policy
9. P8 final validation and merge readiness

P2 and P3 touch the same `App.tsx` query areas. Do P2 first, then extract one vertical slice at a time in P3.
Avoid broad mechanical moves until P1 gives a working test signal.

## Cleanup Rules

- Keep changes vertical and reviewable. Prefer one tab/component extraction per commit or patch.
- Preserve behavior first, then simplify. Component extraction should not change query semantics unless the phase
  explicitly calls for it.
- Prefer shared primitives over repeated local patches.
- Treat `unknown` as valid at IPC, storage, and remote API boundaries only. Narrow it before renderer code consumes it.
- Keep query keys centralized as they are touched. New query work should not add more hardcoded invalidation lists.
- Run `bun run format`, `bun run lint`, and `bun run typecheck` before considering a phase complete.
- Use `bun run test` for unit validation. Never call `vitest` directly.

## P0 - Baseline And Safety Rails

- [ ] P0.1 - Confirm branch and worktree state before cleanup: `git status --short` and current branch name.
- [ ] P0.2 - Run baseline validation and record the result in the PR notes:
  - `bun run typecheck`
  - `bun run lint`
  - `bun run test`
- [ ] P0.3 - Capture the current failing test groups by file, not just total count.
- [ ] P0.4 - Identify all `App.tsx` query key names used by repository tabs before moving code.
- [ ] P0.5 - Identify all renderer routes and route assertions that changed with the GitHub integration.
- [ ] P0.6 - Confirm there are no e2e additions planned for this cleanup unless requested later.

Acceptance criteria:

- The branch has a known starting point.
- Test failures are grouped by root cause.
- Refactor phases can compare against a known baseline instead of guessing.

## P1 - Unblock Tests

- [x] P1.1 - `src/renderer/src/test/setup.ts` - add a full `Storage` mock with
      `getItem`, `setItem`, `removeItem`, `clear`, `key`, and `length`.
- [ ] P1.2 - `src/main/github/octokitProvider.test.ts` - update stale GraphQL query-scope assertions for fields added
      by the branch.
- [ ] P1.3 - Renderer tests - update route assertions that still expect the old route shape.
- [ ] P1.4 - Renderer tests - separate true behavior regressions from snapshot/assertion drift.
- [ ] P1.5 - Run `bun run test` and confirm renderer failures are no longer dominated by test setup.
- [ ] P1.6 - Run `bun run typecheck` and `bun run lint` after test changes.

Acceptance criteria:

- Main provider tests pass or fail only for real behavior changes.
- Renderer tests no longer fail because `localStorage` is malformed.
- Remaining renderer failures have explicit owners and root causes.

## P2 - Startup, Auth, And Query Concurrency

### P2A - Optimistic App State

- [ ] P2.1 - `src/main/github/provider.ts` - change `createAppState()` so it does not block on
      `new OctokitProvider(token).getViewer()`.
- [ ] P2.2 - Return app state immediately when a token exists, using an authenticated state with a nullable viewer.
- [ ] P2.3 - Start `getViewer()` in the background after app state is returned.
- [ ] P2.4 - On viewer success, emit an auth update event containing the viewer payload.
- [ ] P2.5 - On viewer failure, emit an auth update event that lets the renderer mark auth invalid and surface an error.
- [ ] P2.6 - Keep token access and token validation entirely in the main process.

### P2B - IPC Auth Update Event

- [ ] P2.7 - `src/shared/ipc.ts` or existing IPC channel definitions - add a typed auth update channel if one does not
      already exist.
- [ ] P2.8 - `src/preload/index.ts` - expose a typed subscription method with a cleanup function.
- [ ] P2.9 - `src/shared/api.ts` or equivalent preload contract - type the auth update payload.
- [ ] P2.10 - `src/main/index.ts` - wire the main-process event emission to the renderer.
- [ ] P2.11 - `src/renderer/src/App.tsx` - subscribe once, update app/auth state, and unsubscribe on cleanup.

### P2C - Local-First Rendering

- [ ] P2.12 - Remove the `appState.isSuccess` gate from `pinnedRepositories` queries.
- [ ] P2.13 - Remove the `appState.isSuccess` gate from `recentItems` queries.
- [ ] P2.14 - Ensure local-only SQLite reads can render while auth is checking, signed out, or offline.
- [ ] P2.15 - Use React Query `placeholderData` or equivalent cache-backed behavior where cached GitHub data exists.
- [ ] P2.16 - Avoid the current fast-auth double render caused by a forced `cacheOnly: true` pass followed by live reads.

### P2D - Repository Query Concurrency

- [ ] P2.17 - Add a typed `prefetchTabs` constant for high-traffic tabs: `code`, `issues`, `pulls`, and `actions`.
- [ ] P2.18 - Replace strict `activeRepositoryTab === "..."` gates for those tabs with repo-open prefetch gates.
- [ ] P2.19 - Keep lower-traffic tabs lazy until visited.
- [ ] P2.20 - Set or preserve sensible `staleTime` values to avoid refetch storms when switching tabs.
- [ ] P2.21 - Interleave post-mutation invalidations and refreshes with one `Promise.all([...])`.
- [ ] P2.22 - Verify failed auth, offline cache-only reads, and slow network startup all have predictable UI states.

### P2E - Auth Loading UI

- [ ] P2.23 - Add a reusable small loading indicator class for avatar/auth refresh states.
- [ ] P2.24 - In the top bar, show the loading indicator when authenticated but viewer data is still pending.
- [ ] P2.25 - Show the viewer avatar when available.
- [ ] P2.26 - Preserve the signed-out fallback behavior.

Acceptance criteria:

- `getAppState()` no longer waits on a GitHub network call.
- Pins and recents can render from local data before auth validation finishes.
- Opening a repository starts the highest-value tab reads without waiting for tab clicks.
- Expired tokens transition to an explicit auth failure state without exposing secrets to the renderer.

## P3 - Renderer Decomposition

### P3A - Shared Foundations

- [ ] P3.1 - Create `src/renderer/src/components/RepositoryContext.tsx`.
- [ ] P3.2 - Create `src/renderer/src/hooks/useRepositoryContext.ts`.
- [ ] P3.3 - Context should provide only stable repository-level dependencies:
      `owner`, `repo`, `githubReady`, `api`, and `queryClient`.
- [ ] P3.4 - Create `src/renderer/src/hooks/useExpandableList.ts`.
- [ ] P3.5 - Create a centralized `repositoryQueryKeys` helper or constant module.
- [ ] P3.6 - Update `invalidateRepositoryScopedQueries` to use the centralized query keys.

### P3B - Shared UI Primitives

- [ ] P3.7 - Extract `AvailabilityBanner.tsx` to replace repeated `readAvailabilityMessage(...)` rendering.
- [ ] P3.8 - Extract `ExpandableList.tsx` for show-more/show-less list behavior.
- [ ] P3.9 - Extract `EmptyState.tsx` for repeated empty and unavailable states.
- [ ] P3.10 - Extract `GlassPanel.tsx` only if it maps cleanly to existing Liquid Glass conventions.
- [ ] P3.11 - Extract `StatusBadge.tsx` if status badge variants are currently duplicated.
- [ ] P3.12 - Extract `TabHeader.tsx` if repository tab headers repeat the same layout and actions.

### P3C - Repository Tab Components

Extract one tab at a time. After each extraction, run typecheck or targeted tests before moving to the next tab.

- [ ] P3.13 - Extract `RepositoryCode.tsx`.
- [ ] P3.14 - Extract `RepositoryIssues.tsx`.
- [ ] P3.15 - Extract `RepositoryPulls.tsx`.
- [ ] P3.16 - Extract `RepositoryActions.tsx`.
- [ ] P3.17 - Extract `RepositoryDiscussions.tsx`.
- [ ] P3.18 - Extract `RepositoryProjects.tsx`.
- [ ] P3.19 - Extract `RepositoryReleases.tsx`.
- [ ] P3.20 - Extract `RepositoryContributors.tsx`.
- [ ] P3.21 - Extract `RepositoryWiki.tsx`.
- [ ] P3.22 - Extract `RepositorySecurityQuality.tsx`.
- [ ] P3.23 - Extract `RepositorySettings.tsx`.

### P3D - Non-Repository Views

- [ ] P3.24 - Extract `NotificationsView.tsx`.
- [ ] P3.25 - Extract `OrganizationsView.tsx`.
- [ ] P3.26 - Extract `CommandPalette.tsx`.
- [ ] P3.27 - Move view-specific query hooks with their components when the hook is not shared.
- [ ] P3.28 - Keep shared query key factories outside individual components.

Acceptance criteria:

- `App.tsx` is reduced to routing, shell layout, high-level state, and composition.
- Each repository tab can be read independently.
- Query behavior remains equivalent except for the P2 concurrency changes.
- Repeated availability, empty-state, and expandable-list patterns are no longer open-coded in every tab.

## P4 - CSS, UI Consistency, And Mock Data

### P4A - CSS Structure

- [ ] P4.1 - Add renderer design tokens in `:root` for common spacing, radii, colors, font sizes, and motion timing.
- [ ] P4.2 - Replace ad-hoc repeated values in `styles.css` only as components are extracted.
- [ ] P4.3 - Split component styles into co-located `.module.css` files once the component exists.
- [ ] P4.4 - Keep global styles limited to app shell, resets, tokens, and truly shared primitives.
- [ ] P4.5 - Remove unused selectors left behind after component extraction.

### P4B - Liquid Glass And Accessibility Fixes

- [ ] P4.6 - Standardize non-standard font weights from `620`, `650`, and `750` to supported system weights.
- [ ] P4.7 - Raise metadata text that is currently `10px` to at least `12px`, with `11px` only for non-critical badges.
- [ ] P4.8 - Align detail panel border radii with the documented glass panel standard.
- [ ] P4.9 - Review the top-bar row height change from `50px` to `52px` and either make all dependent measurements
      consistent or revert the drift.
- [ ] P4.10 - Restore transparent `.app-shell` behavior when native liquid glass is active.
- [ ] P4.11 - Restore the documented blue-tinted fallback gradient for `body.no-liquid-glass`.
- [ ] P4.12 - Fix right-rail corner treatment so it does not visually fight the rounded app shell.
- [ ] P4.13 - Make the `reduced` glass setting real in the renderer class calculation and CSS.

### P4C - Mock Data Split

- [ ] P4.14 - Split `src/renderer/src/data/mock.ts` into `src/renderer/src/data/mocks/repository.ts`.
- [ ] P4.15 - Split issue fixtures into `data/mocks/issues.ts`.
- [ ] P4.16 - Split pull request fixtures into `data/mocks/pulls.ts`.
- [ ] P4.17 - Split discussions fixtures into `data/mocks/discussions.ts`.
- [ ] P4.18 - Split projects fixtures into `data/mocks/projects.ts`.
- [ ] P4.19 - Split releases fixtures into `data/mocks/releases.ts`.
- [ ] P4.20 - Split contributors fixtures into `data/mocks/contributors.ts`.
- [ ] P4.21 - Split actions fixtures into `data/mocks/actions.ts`.
- [ ] P4.22 - Split wiki fixtures into `data/mocks/wiki.ts`.
- [ ] P4.23 - Split security and quality fixtures into `data/mocks/securityQuality.ts`.
- [ ] P4.24 - Split notifications fixtures into `data/mocks/notifications.ts`.
- [ ] P4.25 - Split organization fixtures into `data/mocks/organizations.ts`.
- [ ] P4.26 - Keep a single barrel export only if it does not recreate the monolith.

Acceptance criteria:

- `styles.css` no longer carries most component-specific styling.
- Liquid Glass behavior matches the documented design system.
- Mock data is organized by domain and can be imported without loading unrelated fixtures.

## P5 - Main-Process Boilerplate Reduction

### P5A - Provider Cache Wrapper

- [ ] P5.1 - In `src/main/github/provider.ts`, identify every repeated `*WithStatus` cache wrapper shape.
- [ ] P5.2 - Extract a generic helper for key creation, TTL, provider invocation, `forceRefresh`, and `cacheOnly`.
- [ ] P5.3 - Preserve per-method cache keys exactly unless a key is known to be wrong.
- [ ] P5.4 - Convert low-risk methods first, then the rest after tests pass.
- [ ] P5.5 - Add or update tests around cache-only, force-refresh, stale, and unavailable behavior.

### P5B - IPC Registration Table

- [ ] P5.6 - In `src/main/index.ts`, replace repeated `ipcMain.handle(...)` calls with a typed channel map.
- [ ] P5.7 - Keep handlers explicit enough that input/output types remain auditable.
- [ ] P5.8 - Ensure each handler still calls the same provider method as before.
- [ ] P5.9 - Add coverage or assertions for representative mapped channels.

### P5C - Old Non-Status Channels

- [ ] P5.10 - Inventory old non-`WithStatus` GitHub IPC channels.
- [ ] P5.11 - Confirm the renderer exclusively uses `*WithStatus` variants.
- [ ] P5.12 - Remove old channels only after the renderer migration is complete.
- [ ] P5.13 - Update shared API and preload contracts when channels are removed.

Acceptance criteria:

- Adding a new GitHub read no longer requires copy-pasting the same cache-wrapper and IPC boilerplate.
- Removed legacy channels have no renderer callers.
- IPC remains typed and process boundaries stay intact.

## P6 - Type Cleanup And Defensive-Code Removal

### P6A - Shared GitHub Types

- [ ] P6.1 - In `src/shared/github.ts`, define concrete node types for language, commit, release, branch, workflow,
      discussion, project, and organization data currently typed as `unknown`.
- [ ] P6.2 - Keep raw API response types close to the provider if they are not part of the IPC contract.
- [ ] P6.3 - Export only serializable shared types across process boundaries.

### P6B - Provider Response Narrowing

- [ ] P6.4 - In `src/main/github/octokitProvider.ts`, narrow GraphQL responses at the provider boundary.
- [ ] P6.5 - Convert nullable remote fields into explicit domain values once, not repeatedly in the renderer.
- [ ] P6.6 - Keep legitimate boundary validation for IPC, SQLite deserialization, and GitHub API responses.

### P6C - Renderer Simplification

- [ ] P6.7 - Replace renderer `as` casts with narrowed return types or local type guards.
- [ ] P6.8 - Remove redundant `??` fallback chains where shared types already guarantee values.
- [ ] P6.9 - Replace `data?.field ?? default` with clearer query-status branches where the UI already depends on
      successful data.
- [ ] P6.10 - Delete dead guards created by earlier defensive patterns.

Acceptance criteria:

- Renderer code consumes strong domain types instead of repeatedly defending against already-normalized data.
- `unknown` appears only at real boundaries.
- Type cleanup reduces code paths rather than adding more validation layers.

## P7 - Provider Completeness And Cache Policy

### P7A - Pagination

- [ ] P7.1 - Add pagination for PR review threads.
- [ ] P7.2 - Add pagination for discussion comments.
- [ ] P7.3 - Ensure pagination respects cache keys, limits, and partial-failure availability reporting.
- [ ] P7.4 - Add tests for multi-page and first-page-only responses.

### P7B - Cache Policy

- [ ] P7.5 - Tune cache TTLs per domain instead of using broad uniform TTLs.
- [ ] P7.6 - Suggested starting points:
  - branches and repository metadata: longer TTL
  - issues, pulls, notifications, and actions: shorter TTL
  - releases, contributors, and security signals: medium TTL
- [ ] P7.7 - Document TTL choices in code near the policy, not scattered call sites.
- [ ] P7.8 - Verify `cacheOnly` reads still work while signed out or offline.

### P7C - Viewer Cache

- [ ] P7.9 - Cache the viewer profile in SQLite with a long TTL.
- [ ] P7.10 - Use cached viewer data for warm starts while background validation refreshes it.
- [ ] P7.11 - Clear or invalidate cached viewer data on sign-out.

### P7D - Organization Query Waterfall

- [ ] P7.12 - Fuse organization list and team list reads where the GraphQL shape supports it.
- [ ] P7.13 - Preselect the first team early enough that team detail reads can start with org detail reads.
- [ ] P7.14 - Preserve partial availability states for org repos, members, projects, teams, team repos, and team members.

Acceptance criteria:

- Provider behavior is complete for paginated surfaces called out in the audit.
- Cache behavior is domain-aware and documented.
- Organization view no longer requires three serial render passes for the common path.

## P8 - Final Validation And Merge Readiness

- [ ] P8.1 - Run `bun run format`.
- [ ] P8.2 - Run `bun run lint`.
- [ ] P8.3 - Run `bun run typecheck`.
- [ ] P8.4 - Run `bun run test`.
- [ ] P8.5 - Run `bun run build` if the cleanup changed main/preload build behavior or package boundaries.
- [ ] P8.6 - Manually smoke test:
  - signed out startup
  - signed in warm startup
  - slow or offline startup with cached data
  - expired token handling
  - repository open and tab switching
  - pins and recents rendering before auth validation
  - organizations and notifications views
- [ ] P8.7 - Capture screenshots or recordings for visible renderer/UI changes.
- [ ] P8.8 - Update PR notes with:
  - what changed and why
  - validation commands and results
  - remaining known risks
  - follow-up issues that are intentionally deferred

Acceptance criteria:

- Formatter, linter, typechecker, and unit tests pass.
- Startup no longer blanks on GitHub viewer validation.
- `App.tsx`, `styles.css`, and `data/mock.ts` are no longer the central dumping grounds for all GitHub behavior.
- The GitHub integration can be reviewed by domain instead of as one monolithic branch.

## Target File Outcomes

| File                                 | Current audit concern                                 | Target outcome                                                    |
| ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `src/renderer/src/App.tsx`           | 24,877-line monolith                                  | Shell composition, routing, and top-level state only              |
| `src/renderer/src/styles.css`        | 3,858-line global stylesheet                          | Tokens, shell globals, and shared primitive styles only           |
| `src/renderer/src/data/mock.ts`      | 3,390-line fixture monolith                           | Domain-specific fixture modules                                   |
| `src/main/github/provider.ts`        | Repeated status/cache wrappers and blocking app state | Non-blocking app state, shared cache helper, domain TTL policy    |
| `src/main/github/octokitProvider.ts` | Large provider plus stale tests, pagination gaps      | Strong response normalization, updated tests, paginated reads     |
| `src/main/index.ts`                  | 97 repeated IPC registrations                         | Typed channel registration table                                  |
| `src/shared/github.ts`               | Broad shared contract with weak node types            | Serializable contracts with concrete domain types                 |
| `src/preload/index.ts`               | Large bridge surface                                  | Typed bridge, auth update subscription cleanup, no token exposure |

## Suggested Commit Slices

- [ ] Commit 1 - Baseline test fixes: P1 only.
- [ ] Commit 2 - Optimistic auth and auth update event: P2A and P2B.
- [ ] Commit 3 - Local-first rendering and tab prefetch: P2C and P2D.
- [ ] Commit 4 - Shared renderer foundations: P3A and P3B.
- [ ] Commit 5+ - One commit per extracted tab or closely related view group.
- [ ] Commit N - CSS tokens, Liquid Glass fixes, and mock data split.
- [ ] Commit N+1 - Provider cache helper and IPC map.
- [ ] Commit N+2 - Type cleanup and provider pagination/cache polish.
- [ ] Final commit - Validation notes, docs updates, and leftover cleanup.
