# Dedicated Detail Pages

Issues, pull requests, actions, agents, and releases need full detail pages
instead of relying on cramped right-side panels. The right panel should become a
preview surface, while opening an item should navigate to a dedicated page with
the full conversation or operational detail.

## Goals

- Increase usable space for item details.
- Keep list browsing fast with lightweight previews.
- Match the mental model users already have from GitHub detail pages.
- Give each major repository object a durable route.
- Avoid forcing long conversations, logs, and review data into a narrow panel.

## Preview Panel Behavior

The right panel should show a brief preview of the selected item:

- title or name
- status
- labels or key metadata
- initial submission or short summary
- author and timestamp when useful
- primary action to open the full page

The preview should be useful for scanning but should not attempt to become the
full detail experience.

## Full Detail Pages

Opening an item should navigate to a dedicated route:

- issue detail page
- pull request detail page
- action run detail page
- agent detail page
- release detail page

Each page should own the full-width reading and interaction experience for that
object.

## Issue Pages

Issue detail pages should show:

- issue title, state, labels, assignees, author, and timestamps
- original issue body
- conversation timeline
- linked pull requests or references when available
- comment composer when write support is available

The first version can be read-only if write behavior is not ready.

## Pull Request Pages

Pull request detail pages should show:

- PR title, state, labels, reviewers, author, and timestamps
- PR body and conversation timeline
- changed files and diff entry point
- checks and mergeability state when available
- review/comment affordances when write support is available

Diff viewing can link to the code viewer upgrade work and does not need to be
completed in the same branch.

## Actions Pages

Action run detail pages should show:

- workflow name, run status, branch/ref, actor, and timestamps
- job list
- selected job details
- logs when available
- rerun/cancel actions only when write support and permissions are ready

Failures should be easy to scan without requiring the user to read raw logs
first.

## Agent Pages

Agent detail pages should show:

- agent identity or run name
- status and current phase
- repository context
- recent events or transcript summary
- artifacts or outputs when available

The shape can evolve with the agent model, but the route should not depend on a
right-panel-only layout.

## Release Pages

Release detail pages should show:

- release name, tag, author, and publish state
- release notes
- assets
- linked commits or comparison entry point when available

The list view should remain compact, while the full page handles long notes and
asset details.

## Routing Requirements

Routes should be durable enough to reload and deep-link inside Control. If the
user opens a detail page directly, Control should load the minimum required
repository and item data rather than requiring prior list navigation.

## Out Of Scope

- Rebuilding every list view.
- Implementing all write actions at once.
- Completing advanced PR diff review.
- Adding e2e tests unless specifically requested.

## Acceptance Criteria

- Selecting an item can still show a compact preview.
- Opening an item navigates to a full detail page.
- Detail pages can load from a direct route.
- Issue, PR, action, agent, and release detail layouts are not constrained to
  the old right panel width.
- Existing list navigation remains usable.

## Validation

Add renderer tests around route loading, preview selection, and direct detail
page loading where practical.

Required validation before closing implementation work:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`
