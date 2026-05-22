# Dedicated Detail Surfaces

Issues, pull requests, actions, agents, and releases need dedicated detail
surfaces instead of cramped right-side panels. In cleanup-v2-gpt, the v1
architecture is repository-scoped split-pane tabs with contextual item
parameters, not separate top-level routes. This document treats that split-pane
architecture as the baseline and defines how it should grow.

## Goals

- Increase usable space for item details.
- Keep list browsing fast with lightweight previews.
- Match the mental model users already have from GitHub detail pages.
- Give each major repository object a durable repository-scoped address.
- Avoid forcing long conversations, logs, and review data into a narrow panel.
- Build on the extracted tab modules instead of adding detail behavior back into
  a monolithic app component.

## Cleanup V2 Baseline

The cleanup-v2-gpt branch extracts repository tabs into domain-specific modules
such as IssuesTab, PullRequestsTab, ActionsTab, and related tab components. That
module split is the baseline for this work.

Do not re-centralize issue, pull request, action, release, or agent detail state
inside the top-level app shell. Each tab should own its list/detail split,
selection state, data dependencies, and empty/error states within the shared
repository route contract.

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

For v1, "dedicated" means a dedicated detail surface inside the repository tab,
not a separate top-level application page. Opening an item should update the
repository route context and show the tab's split-pane detail view:

- issue detail page
- pull request detail page
- action run detail page
- agent detail page
- release detail page

Each detail surface should own the main reading and interaction experience for
that object. A later release can promote these surfaces to full-width top-level
routes if the split-pane model remains too constrained.

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

Routes should be durable enough to reload and deep-link inside Control. In v1,
item identity should be represented as contextual parameters inside the
repository route, such as `issueNumber`, `pullNumber`, workflow run id, release
tag, or agent id.

If the user opens a repository route with item context directly, Control should
load the minimum required repository and item data rather than requiring prior
list navigation. Do not assume the list query has already run before the detail
query.

## Out Of Scope

- Rebuilding every list view.
- Implementing all write actions at once.
- Completing advanced PR diff review.
- Adding separate top-level routes for every item type in v1.
- Adding e2e tests unless specifically requested.

## Acceptance Criteria

- Selecting an item can still show a compact preview.
- Opening an item updates repository-scoped item context.
- Detail surfaces can load from a direct repository route with item context.
- Issue, PR, action, agent, and release detail layouts are not constrained to
  the old right panel width.
- Existing list navigation remains usable.
- Detail logic lives in the extracted tab modules, not the top-level app shell.

## Validation

Add renderer tests around route loading, preview selection, and direct detail
page loading where practical.

Required validation before closing implementation work:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`
