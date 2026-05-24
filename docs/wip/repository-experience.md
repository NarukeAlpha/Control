# Repository Experience

This document consolidates the old v1 repository page cleanup, tab visibility,
dedicated detail surface, and refresh policy plans. It is the active WIP source
for repository-page product cleanup.

## Current State

- Repository tabs are split into domain-specific modules.
- Code, Issues, Pull requests, Actions, Agents, Discussions, Projects, Releases,
  Contributors, Wiki, Security and Quality, and Settings exist as surfaces.
- Warm prefetch currently focuses on Code, Issues, Pull requests, and Actions.
- Repository reads increasingly use availability-bearing `*WithStatus` results.
- Mutations flow through shared discriminated input contracts.
- Mock data is split by domain.

## Problems To Solve

- Repository header and sidebar still need product cleanup.
- Optional tabs are always part of the static roster rather than capability or
  preference-driven.
- Hidden or unavailable optional tabs can still trigger unnecessary fetch work.
- Detail experiences for Issues, Pull requests, Actions, Agents, and Releases
  are still too panel-constrained.
- Background refresh can still cause overly broad UI churn if state ownership is
  wrong.
- Broken or unfinished controls, especially blame-related controls, should not
  remain visible.

## Required Work

### Header And Sidebar Cleanup

- Keep the repository title clear of the liquid search bar.
- Remove duplicated repository description from the header; the About section
  should own it.
- Remove the recent commits block from the default sidebar.
- Make the GitHub button label simply `GitHub`.
- Remove fallback GitHub icons from code/file surfaces where they are not a real
  command or state.
- Hide broken blame entry points.

### Tab Visibility

- Keep Code, Issues, Pull requests, and Actions visible by default.
- Make Agents, Discussions, Projects, Releases, Contributors, Wiki, Security and
  Quality, and Settings optional or capability-driven.
- Add user preferences for optional tabs:
  - `Auto`
  - `Show`
  - `Hide`
- Do not run full content queries for hidden optional tabs.
- Show clear empty states for force-shown empty tabs.
- Decide whether local and SSH repository Areas use the same visibility model as
  GitHub repositories.

### Dedicated Detail Surfaces

For v1, dedicated detail surfaces should remain repository-scoped rather than
top-level routes. Opening a detail item updates repository route context and
shows a larger detail surface owned by the tab module.

Required detail surfaces:

- issue detail
- pull request detail
- action run detail
- agent detail
- release detail

Detail routes must load directly without assuming the list query already ran.

### Refresh Policy

- Render cached repository data immediately when available.
- Revalidate active surfaces in the background.
- Refresh repository metadata independently from tab content.
- Refresh Code contents by path and ref.
- Refresh Issues independently from Pull requests.
- Refresh Pull request lists independently from Pull request detail data.
- Refresh Actions independently from repository summary data.
- Keep cached data visible when background refresh fails.
- Surface stale or unavailable states without replacing cached data with empty
  states.
- Mutations should invalidate only the affected query families.

## Acceptance Criteria

- Repository description appears only in About.
- Recent commits are not shown in the default sidebar.
- Repository title does not overlap the liquid search bar.
- Optional tabs hide by default when unavailable or empty.
- User settings can force-show or hide optional tabs.
- Hidden tabs do not run full content refreshes.
- Detail surfaces can load from direct repository route context.
- Background refresh updates only the affected surface.
- Broken blame controls are hidden.

## Validation

Required before closing implementation work:

```bash
bun run test
bun run format
bun run lint
bun run typecheck
```

Add focused renderer tests for tab visibility, settings mapping, route-context
detail loading, cache-first behavior, stale data handling, and scoped mutation
invalidation.
