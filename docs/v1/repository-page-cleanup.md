# Repository Page Cleanup

The repository page needs a focused cleanup pass before larger navigation and
refresh work. This pass should remove duplicated information, fix spacing around
the liquid search bar, and simplify repository actions that currently expose
fallback naming or icons.

## Goals

- Reduce repeated repository description content.
- Remove low-value repository sidebar sections from the default page.
- Keep the repository title clear of the liquid search bar.
- Make GitHub actions visually direct and predictable.
- Hide unfinished or broken repository controls until they are ready.

## Repository Header

Remove the repository description from the top header area. The About section on
the right side should own the repository description so the page does not repeat
the same content in two places.

The repository name should have enough top spacing that it does not render
behind the liquid search bar on initial page load or after scrolling. This
should be solved with layout spacing, not by adding a temporary visual spacer
that breaks at different viewport sizes.

## Sidebar Cleanup

Remove the recent commits block that appears below About and above Languages.
The sidebar should keep the About and Languages sections without inserting a
short commit feed between them.

Recent commits can return later as part of a dedicated activity surface if there
is a stronger product reason, but they should not live in this sidebar position
for v1.

## GitHub Button

The repository GitHub button should use a simple label:

- `GitHub`

Do not show fallback repository naming in the button text. The link target can
stay as-is as long as it opens the correct GitHub repository URL.

## Fallback Icon Cleanup

Remove the GitHub fallback icon from repository code/file surfaces where it does
not represent a useful action or state. Icons in these surfaces should either
identify the current file/folder state or represent a clear command.

## Blame Control

Hide the Blame button for now if it points at unsupported or broken behavior.
Current blame failures, such as missing blob type support, should not be visible
as a broken user path.

Blame can return in a later code-viewer pass after the product behavior is
defined.

## Out Of Scope

- Implementing new repository tabs.
- Reworking repository data fetching.
- Adding a complete code viewer redesign.
- Implementing blame.
- Adding e2e tests.

## Acceptance Criteria

- Repository description appears only in the About section.
- Recent commits no longer appear in the repository sidebar.
- The repository title does not overlap with or sit behind the liquid search bar.
- The GitHub repository button says `GitHub`.
- Broken blame entry points are hidden.
- Removed fallback icons do not leave awkward spacing or empty controls.

## Validation

Required validation before closing implementation work:

- `bun run format`
- `bun run lint`
- `bun run typecheck`

Run `bun run test` if shared renderer behavior or tested components change.
