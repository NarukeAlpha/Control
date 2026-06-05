# Projects And Agents Implementation Plan

## Goal

Make repository and organization Projects resilient to GraphQL partial failures,
remove fallback framing, and clarify Agents as a real in-app triage surface with
future local-agent expansion.

## Current State

- `ProjectsTab.tsx` already supports project list/detail, item fields, create,
  edit, add item, delete item, field value editing, and mutation feedback.
- `ProjectsTab.tsx` uses issue and PR queries to build project item options.
- `AgentsTab.tsx` currently aggregates agent-labeled issues, attention workflow
  runs, and open PRs.
- Agents currently calls issue, PR, and actions query hooks directly.
- The source report warns not to remove repository Projects unless product
  requirements explicitly say so.

## Primary Files

- `src/renderer/src/components/repository/projects/ProjectsTab.tsx`
- `src/renderer/src/components/repository/projects/ProjectsTab.queries.ts`
- `src/renderer/src/components/repository/projects/ProjectsTab.test.tsx`
- `src/renderer/src/components/repository/agents/AgentsTab.tsx`
- `src/renderer/src/components/repository/agents/AgentsTab.queries.ts`
- `src/renderer/src/components/repository/agents/AgentsTab.test.tsx`
- `src/renderer/src/components/sidebar/Sidebar.tsx`
- `src/renderer/src/components/collection/OrganizationsRoute.tsx`
- `src/renderer/src/components/collection/organizationQueries.ts`
- `src/main/github/provider.ts`
- `src/main/github/octokitProvider.ts`
- `src/main/github/projectDomain.ts`
- `src/shared/github.ts`

## Projects Requirements

- Keep repository Projects tab operational.
- Keep organization projects operational.
- Treat GraphQL partial errors as section-level availability.
- Apply the same partial-availability and section-level error behavior to
  Organization Projects inside `OrganizationsRoute.tsx`.
- Preserve any data that GitHub returned safely.
- Avoid page-wide failure when fields, items, readme, or permissions fail.
- Remove fallback wording.
- Use `Open project on GitHub` only for selected project external links.
- Avoid broad issue/PR fetches solely for project item suggestions.
- Update project item options after Issues/PRs move to open-first state.

## GraphQL Error Mapping

Map errors into precise availability states:

- Permission denied.
- Feature disabled.
- Project not found.
- Node not found.
- Missing field.
- Unsupported ProjectV2 field.
- Rate limited.
- Partial data.
- Unknown GraphQL failure.

Examples:

- `Project items unavailable: GitHub did not return item access for this viewer.`
- `Project fields unavailable: GraphQL field permission denied.`
- `Projects disabled for this repository.`
- `Project readme unavailable; showing fields and items that GitHub returned.`

## Project UI Tasks

- Group project overview, readme, fields, items, and mutations.
- Keep field editing scoped to selected item.
- Keep create/edit forms explicit and bounded.
- Add item flow should use targeted search or explicit expansion rather than
  always fetching broad issue/PR lists.
- Field edit disabled reasons should remain exact.
- Mutation feedback should appear near affected project or field.
- Large project item lists should not stretch the shell.

## Agents Requirements

- Confirm whether any top-level Projects ribbon exists outside repository tabs.
- If top-level Projects exists, rename that top-level entry to Agents.
- Treat `Sidebar.tsx` or the relevant global navigation owner as in scope for
  that top-level Projects-to-Agents rename.
- Do not rename repository Projects tab unless product scope changes.
- Keep Agents as an in-app triage surface, not a placeholder.
- Make unavailable data section-local: issues unavailable, actions unavailable,
  PRs unavailable.
- Add a future note that Agents will later include local agents and local
  repository context, not only cloud agents.
- When Issues and PRs move to open-first, pass explicit state into Agents query
  hooks rather than relying on `all` query behavior.

## Tests

- Projects partial data mapping tests.
- GraphQL permission error mapping tests in provider/domain layer.
- Agents empty/errored section tests.
- Update existing Projects and Agents tests after query state changes.

## Screenshots

- Repository Projects populated.
- Projects partial error state.
- Project field editing.
- Agents triage surface with issue/action/PR cards.
- Agents with one section unavailable.

## Acceptance Criteria

- Projects do not blank on partial GraphQL errors.
- Section-level availability is visible.
- Fallback language is gone.
- Repository Projects remains available.
- Top-level Projects/Agents semantics are clarified.
- Agents does not imply unsupported automation.
- Required validation passes.
