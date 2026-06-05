# Sidebar, Organizations, And Mailbox Implementation Plan

## Goal

Bring global navigation, repository discovery, Organizations, and Mailbox up to
the same visual and availability standard as repository pages.

## Current State

- `Sidebar.tsx` already has persistent navigation, local and GitHub repository
  rows, search, virtualization, pins, direct repository targets, local area
  awareness, and GitHub-only navigation hiding for local areas.
- `OrganizationsRoute.tsx` and `organizationQueries.ts` own organization,
  teams, members, repositories, projects, and route-derived selection.
- `MailboxRoute.tsx`, `useMailboxNotifications.ts`, and `useAccountWork.ts`
  own notification and work item behavior.
- `styles.css` has row classes for organizations and mailbox that should be
  normalized with shared row primitives.

## Primary Files

- `src/renderer/src/components/sidebar/Sidebar.tsx`
- `src/renderer/src/components/repository/repositorySearch.ts`
- `src/renderer/src/components/collection/OrganizationsRoute.tsx`
- `src/renderer/src/components/collection/useOrganizationsRouteState.ts`
- `src/renderer/src/components/collection/useOrganizationRouteDerivedState.ts`
- `src/renderer/src/components/collection/organizationQueries.ts`
- `src/renderer/src/components/collection/MailboxRoute.tsx`
- `src/renderer/src/components/collection/collectionUi.tsx`
- `src/renderer/src/components/collection/notificationUi.ts`
- `src/renderer/src/components/collection/workItemUi.ts`
- `src/renderer/src/hooks/useMailboxNotifications.ts`
- `src/renderer/src/hooks/useAccountWork.ts`
- `src/renderer/src/styles.css`

## Sidebar Tasks

- Keep recent/pinned repository concept intact.
- Improve selected state for local and remote rows.
- Improve dark theme contrast for repository rows, source chips, selected
  states, and muted metadata.
- Show local/remote source clearly without overwhelming row density.
- Preserve privacy/lock indicators.
- Preserve owner/repo hierarchy and truncation.
- Normalize local and remote repository row styling.
- Avoid mixing macOS capsule controls and straight web rows in one list.
- Keep GitHub-only nav hidden when selected Area does not support GitHub.
- Verify traffic light, provider, search, and action controls do not overlap.
- Keep virtualization row heights stable.
- Preserve direct repository search behavior.
- Preserve local load-more behavior.

## Organizations Tasks

- Keep organization list visible if selected org detail fails.
- Keep repositories visible if teams fail.
- Keep teams visible if members fail.
- Keep projects visible if fields/items/readme fail.
- Show GraphQL and permission failures section-locally.
- Rename fallback links to `Open on GitHub` or more specific labels.
- Specifically replace the Organizations page header `GitHub fallback` wording
  with a deliberate `Open on GitHub` action when an external destination exists.
- Improve selected org/team/project detail layout.
- Use shared filters, rows, chips, and availability banners.
- Reuse the shared row primitives from the theme/foundation work for sidebar,
  organization, mailbox, notification, and work-item rows.
- Preserve route-derived state and selection tests.

## Mailbox Tasks

- Normalize notification and work item rows through shared row primitives.
- Keep read/unread, participating, reason, repository, and updated date visible.
- Clarify in-app destination versus external GitHub destination.
- Keep mark-read and unsubscribe disabled reasons exact.
- Add bulk action feedback that does not shift rows.
- Keep filters compact and theme-aware.
- Preserve cache-only and unavailable states.

## Tests

- Sidebar route hiding for local areas remains covered.
- Organization partial query tests remain covered or are expanded.
- Mailbox row action tests if behavior changes.
- Route-derived organization state tests remain green.

## Screenshots

- Sidebar remote area dark.
- Sidebar local area dark.
- Sidebar repository search state.
- Organizations selected org with partial unavailable section.
- Mailbox unread filter.
- Mailbox mixed notification/work items.

## Acceptance Criteria

- Sidebar repository list is readable in dark mode.
- Local and remote rows use one visual language.
- Organizations preserves partial data.
- Mailbox rows and filters feel consistent with repository routes.
- No fallback wording remains.
- Required validation passes.
