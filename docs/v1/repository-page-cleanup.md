# Repository Page Cleanup And Modularization

The repository page cleanup is not only visual polish. cleanup-v2-gpt turns the
old repository page into a more modular architecture, tightens shared IPC types,
and breaks apart renderer mock data. The visual cleanup items still matter, but
they should be documented alongside the architectural cleanup that makes the page
maintainable.

## Goals

- Reduce repeated repository description content.
- Remove low-value repository sidebar sections from the default page.
- Keep the repository title clear of the liquid search bar.
- Make GitHub actions visually direct and predictable.
- Hide unfinished or broken repository controls until they are ready.
- Split large repository surfaces into domain-specific tab components.
- Keep repository data access on strict `*WithStatus` IPC routes.
- Use shared result and mutation contracts instead of one-off renderer shapes.
- Keep test and mock data modular by domain.

## Cleanup V2 Baseline

cleanup-v2-gpt changes the baseline in several important ways:

- repository tabs are extracted into domain-specific modules instead of growing
  the top-level app component
- list reads are standardized around availability-bearing result shapes
- mutations flow through strict shared discriminated input contracts
- mock data is split by domain so tests do not depend on one monolithic data
  file

Future repository page cleanup should build on those boundaries rather than
moving behavior back into a single component or loose mock object.

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

## Component Split

Repository UI changes should continue extracting cohesive tab and detail
surfaces:

- Code owns file tree, README, file content, and code-viewer state
- Issues owns issue list, filters, preview, and detail context
- Pull requests owns PR list, filters, preview, and detail context
- Actions owns workflow runs, filters, run details, and log entry points
- Releases, Discussions, Projects, Contributors, Wiki, Security and Quality,
  Settings, and Agents own their own tab-specific state

Shared layout primitives are fine, but tab-specific behavior should not be
reintroduced into the app shell.

## IPC And Strong Typing

Repository cleanup should preserve strict shared contracts:

- renderer reads use `*WithStatus` methods where availability matters
- list data uses the shared availability-bearing list result shape
- writes use discriminated mutation input unions
- IPC payloads stay Json-serializable
- provider metadata does not leak as loose renderer-only objects

Avoid broad `unknown` payloads, generic mutation action strings, or local result
interfaces that duplicate shared contracts.

## Test And Mock Data

Mock data should remain split by domain:

- actions
- issues
- pull requests
- releases
- repository code
- organizations and account surfaces

Tests should import the smallest useful mock domain instead of depending on a
single monolithic mock module.

## Out Of Scope

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
