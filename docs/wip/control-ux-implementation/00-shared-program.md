# Shared Program Plan

## Goal

Coordinate the full repository UX iteration as a set of coherent vertical
slices. The plan should prevent isolated patches that solve one route while
leaving another route with different tokens, state models, error language,
Liquid Glass behavior, visual QA expectations, local data-source assumptions, or
cache behavior.

## Current State

- `docs/wip/control_implementation_planning_report.md` is the source report.
- `src/renderer/src/stores/uiStore.ts` already carries repository route state
  for issue number, pull number, project id, workflow run id, security item,
  wiki page path, filters, and composer modes.
- `src/renderer/src/hooks/useRepositoryRouteState.ts` already centralizes
  active repository tab query ownership and warm prefetch.
- `src/main/github/provider.ts` owns broad GitHub TTLs and status-bearing read
  wrappers.
- `src/main/github/readCache.ts` provides a stronger repository-list cache
  wrapper with stale fallback and negative caching.
- `src/renderer/src/components/repository/*` already contains many implemented
  surfaces; most work is parity, layout, query-state, and product polish.
- `src/main/index.ts` owns the native Liquid Glass setup and must be part of the
  foundation pass.
- `docs/design/design-system.md` and `docs/design/liquid-glass-ui-fixes.md`
  already define visual constraints that implementation work must preserve.

## Operating Model

- Treat each plan file as a worktree-sized contract.
- Land shared primitives before migrating large surfaces.
- Keep each route usable after each merge.
- Do not make one route depend on half-completed changes in another route.
- Keep route state, query keys, prefetch helpers, refresh helpers, and API input
  shape aligned.
- Keep mutation invalidation scoped to affected query families.
- Keep fallback language removal separate from external link removal.
- Keep local repository parity staged; shared chrome first, shared connected
  GitHub tab behavior second.
- Treat dark theme and Liquid Glass verification as foundational, not final
  polish.
- Design shared primitives for both remote GitHub repositories and local
  repository data-source adapters from the start.
- Build cache validation primitives and instrumentation early enough that route
  rewrites can adopt the contract during their own migration.

## Shared Primitives

These primitives should exist before major route rewrites:

- `Surface`
- `FilterBar`
- `StateSegmentedControl`
- `IconButton`
- `ExternalLinkButton`
- `StateChip`
- `DetailLayout`
- `DetailRail`
- `RailSection`
- `Timeline`
- `TimelineEventCard`
- `Composer`
- `FormSection`
- `AvailabilityBanner`
- `EmptyState`
- `LimitHitNotice`
- `RepositoryChrome`
- `RepositoryHero`
- `RepositoryTabs`
- `RepositoryTabSurface`
- `RepositoryRightRail`

The exact names can follow repository conventions, but the responsibilities
should not be reinvented per tab.

## Route And Query Rules

- User-visible filters belong in route state when route persistence matters.
- Query keys must include every value that changes the API result shape.
- Query key builders must be shared by hook, prefetch, refresh, and tests.
- Default list state for issues and pull requests is `open`.
- `all` is an explicit user choice, not the default path.
- Server-backed open/closed state must be passed to API inputs and query keys.
- Do not implement open/closed behavior by fetching all items and filtering the
  array client-side.
- Detail deep links must work even when the selected item is not in the current
  filtered list.
- Changing a state filter should preserve text search.
- Changing text search should not force a server state change.
- Local text search happens after server-backed state filtering.

## Availability Rules

- Empty is not the same as unavailable.
- Permission denied is not the same as disabled.
- Rate limited is not the same as offline.
- Cached is not the same as fresh, unless a validator proves it.
- Partial GraphQL results must keep usable sections visible.
- A section-level failure should not blank an entire route.
- Error copy should identify the failing section and the smallest reasonable
  recovery action.
- Heavy list/detail queries should not be used as validators where a cheaper
  validator exists.
- Cache validation should support cache-only, validate-only, force-refresh,
  stale fallback, and rate-limit fallback paths.

## Process Boundaries

- `src/main` owns GitHub, local gateway, storage, credentials, cache validators,
  request dedupe, and rate-limit policy.
- `src/preload` exposes typed IPC only.
- `src/shared` owns serializable contracts.
- `src/renderer/src` owns UI composition, route state, React Query usage, and
  user-facing status.
- Do not move GitHub API calls into renderer.
- Do not expose raw tokens, cookies, or transport headers to renderer.
- Cache validators can expose availability semantics, not secret headers.

## Visual QA Rules

- Visual changes require full-window screenshots in the relevant route.
- Dark solid is mandatory for every visual route change.
- Light solid is mandatory when layout or colors change.
- Dark glass/reduced is mandatory for shell, route chrome, and local repository
  changes.
- Liquid Glass work must document focused and unfocused macOS behavior.
- `solid` must not accidentally appear more transparent than `glass-shell`
  unless the limitation is deliberately documented.
- Existing E2E/benchmark selectors must be updated when labels or roles change.
- New `tests/e2e` specs still require explicit approval.

## Migration Order

1. Shared visual, Liquid Glass, local chrome, and filter primitives.
2. Cache validation primitive and instrumentation contract.
3. Issues open-first query state and detail layout.
4. Pull Requests open-first query state and detail layout.
5. Repository Settings grouped admin surface.
6. Actions workflow hierarchy.
7. Projects and Agents cleanup.
8. Wiki sizing and correctness.
9. Security and Quality operational polish.
10. Sidebar, Organizations, and Mailbox polish.
11. Local repository parity.
12. Cache validation and targeted invalidation rollout.

Fallback-language cleanup is applied within each route migration and verified
with a final search pass.

## Shared Acceptance Criteria

- No area introduces a new one-off state filter component when a shared one
  exists.
- No area adds fallback wording for core Control behavior.
- Liquid Glass and dark-theme requirements remain visible in every visual
  implementation slice.
- Every changed route has explicit loading, empty, unavailable, cached, and
  permission-denied behavior where applicable.
- Changed route query keys are covered by tests when their shape changes.
- Visual changes have full-window screenshots in the matrix required by
  `13-visual-qa-validation.md`.
- Repository Settings uses grouped admin cards and reusable branch
  protection/ruleset sections.
- Top-level Projects/Agents navigation behavior is explicitly checked before
  repository Projects are touched.
- Validation uses repository scripts.
