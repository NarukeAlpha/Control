# Provider Architecture Cleanup

The GitHub integration is functional, but provider and organization-query
cleanup remain active WIP. This document captures the parts of the old cleanup
checklist that are not covered by repository UI docs.

## Current State

- Main-process provider code owns GitHub calls and cache behavior.
- Domain-specific cache TTLs exist.
- PR review-thread pagination and discussion pagination exist.
- IPC registration is more centralized than before.
- The renderer mostly consumes strict shared contracts.

## Problems To Solve

- `provider.ts` still has repeated `*WithStatus` wrapper shapes.
- Some old non-`WithStatus` shared/preload APIs still exist.
- Some renderer calls still gate local cache reads on app/auth success.
- Cached viewer data is not clearly invalidated on sign-out.
- Organization screens still have a serial query waterfall.
- Provider and renderer code still contain casts and fallback chains that should
  be replaced with stronger boundary types.
- Cache TTL rationale is not documented near the policy.

## Required Work

### Provider Method Helper

- Inventory repeated cache wrapper shapes.
- Extract a helper for:
  - cache key creation
  - TTL lookup
  - provider invocation
  - `forceRefresh`
  - `cacheOnly`
  - availability result normalization
- Preserve existing cache keys unless a key is known to be wrong.
- Convert low-risk methods first.
- Add tests for cache-only, force-refresh, stale, and unavailable behavior.

### Legacy API Removal

- Inventory old non-`WithStatus` GitHub IPC and preload methods.
- Confirm the renderer has migrated to status-bearing variants where
  availability matters.
- Remove old channels only after call sites are gone.
- Update shared API and preload contracts together.
- Add representative IPC/preload tests.

### Auth And Local Cache Edges

- Remove local-only cache gates that depend on `appState.isSuccess`.
- Ensure recents and pins can render from SQLite while auth is checking,
  expired, offline, or unavailable.
- Clear or invalidate cached viewer data on sign-out.
- Add tests for expired token startup, failed auth refresh, and offline cached
  reads.

### Organization Query Waterfall

- Fuse organization and team reads where the GraphQL shape supports it.
- Preselect the first team early enough that dependent detail reads can begin
  without unnecessary serial waits.
- Preserve partial availability states for org repos, members, projects, teams,
  team repos, and team members.

### Type Cleanup

- Keep raw API response shapes close to provider code.
- Convert nullable remote fields into explicit domain values once.
- Replace renderer casts with narrowed shared types or local type guards.
- Remove redundant fallback chains where shared contracts guarantee values.

## Acceptance Criteria

- Repeated provider cache wrappers are consolidated behind a typed helper.
- Renderer uses `*WithStatus` methods where availability affects UI.
- Local pins and recents render without requiring successful GitHub auth.
- Viewer cache is cleared or invalidated on sign-out.
- Organization data loads with fewer serial dependencies while preserving partial
  availability.
- Legacy non-status APIs are removed or explicitly documented as still required.

## Validation

Required before closing implementation work:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Targeted tests should include provider cache tests, auth scheduler tests,
registerControlIpc/registerGithubIpc tests, preload tests, and organization
query tests.
