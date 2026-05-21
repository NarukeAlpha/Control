# Repository Tab Visibility

Repository tabs should default to the core GitHub workflow and avoid showing
empty or irrelevant sections by default. Control should keep Code, Issues, Pull
requests, and Actions visible while making secondary repository sections
configurable and data-aware.

## Goals

- Keep the default repository tab bar focused.
- Always expose the most common repository workflows.
- Hide optional tabs when there is no valid data to show.
- Allow users to force-show optional tabs when they intentionally want access.
- Avoid unnecessary fetches for tabs that are hidden.

## Default Tabs

Every GitHub repository should show these tabs by default:

- Code
- Issues
- Pull requests
- Actions

These tabs define the minimum repository workflow and should remain available
even when counts are zero or data is still loading.

## Optional Tabs

Secondary tabs should be configurable:

- Discussions
- Projects
- Releases
- Packages
- Agents
- Security
- Insights or activity-oriented surfaces

An optional tab should be hidden by default when the repository has no valid data
for that surface. For example:

- hide Discussions when discussions are unavailable or empty
- hide Projects when there are no visible projects
- hide Releases when no releases exist
- hide Agents when no agent data exists for that repository

The exact optional tab list should come from the current repository capabilities
and Control's implemented surfaces, not from a hard-coded GitHub clone of every
possible repository tab.

## User Overrides

Settings should let a user control optional tab visibility. The model should
support at least:

- `Auto`: show only when the repository has available data
- `Show`: force the tab to appear even if empty
- `Hide`: never show the tab for normal browsing

The first implementation can use global defaults. Per-repository overrides can
be added later if the global model is not enough.

## Data And Fetching

Hidden optional tabs should not repeatedly fetch data in the background. A light
capability or count check is acceptable, but the tab contents should not be
treated as live page data unless the tab is visible or the user explicitly opens
it.

Avoid using repeated failed fetches as the mechanism for deciding that a tab
should be hidden. Capability and count data should be normalized into an
intentional visibility model.

## Empty States

If a user force-shows an optional tab that has no data, show a clear empty state
inside the tab. Do not hide the tab again while the user is actively viewing it.

## Open Questions

- Should tab preferences be global only for v1?
- Should Control eventually support per-repository tab overrides?
- Should optional tabs with previously cached data remain visible while
  revalidation is pending?
- Do local and SSH repository areas use the same tab visibility model as GitHub
  repositories?

## Acceptance Criteria

- Code, Issues, Pull requests, and Actions are always visible.
- Optional tabs are hidden by default when unavailable or empty.
- User settings can force-show or hide optional tabs.
- Hidden tabs do not trigger full tab-content refresh work.
- Force-shown empty tabs render an intentional empty state.

## Validation

Add or update focused renderer tests for tab visibility rules and settings
mapping where practical.

Required validation before closing implementation work:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`
