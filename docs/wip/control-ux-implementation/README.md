# Control UX Implementation Plan Set

## Purpose

This folder expands `../control_implementation_planning_report.md` into
area-specific implementation contracts. The source report is intentionally broad:
it names product gaps, architecture direction, visual QA requirements, and a
worktree split. These files fan that report out into smaller plans that can be
assigned, reviewed, and implemented without losing the full intent.

The work is not a rewrite from zero. Control already has a broad Electron,
React, TypeScript, React Query, GitHub provider, local Area, and cache
foundation. The objective is to turn partial implementation into coherent,
GitHub-like, local-first product behavior.

## Source Of Truth

- Source report: `../control_implementation_planning_report.md`
- Repository instructions: `../../AGENTS.md`
- Repository docs index: `../../README.md`
- Visual direction: `../../design/design-system.md`
- Liquid Glass notes: `../../design/liquid-glass-ui-fixes.md`
- Completion baseline: `../../done/`

Use the source report for product intent. Use the local repo as the authority
for current file names, contracts, and process boundaries.

## Plan Files

- `00-shared-program.md` - overall sequencing, boundaries, route/query rules,
  shared primitives, and migration constraints.
- `01-theme-liquid-glass-foundation.md` - dark-theme audit, shared visual
  primitives, token cleanup, native glass investigation, and screenshot matrix.
- `02-fallback-language-external-links.md` - removing fallback framing while
  preserving intentional GitHub deep links.
- `03-issues.md` - open-first issue state, route/query/API changes, full
  issue detail, timeline, rail, mutations, tests, and screenshots.
- `04-pull-requests.md` - open-first PR state, PR detail composition,
  timeline, rail, checks, reviews, merge actions, tests, and screenshots.
- `05-actions.md` - workflow catalog, workflow run list, run detail, dispatch,
  logs, artifacts, annotations, rerun/cancel, and route state.
- `06-projects-agents.md` - project partial GraphQL handling, repository and
  organization projects, top-level Agents semantics, and future local agents.
- `07-wiki.md` - wiki browser layout, sizing, markdown containment, create,
  edit, delete, disabled states, and route persistence.
- `08-security-quality.md` - security policy, alerts, rulesets, advisories,
  community profile, branch protection, partial availability, and operations.
- `09-repository-settings.md` - grouped admin console, feature settings, tab
  visibility, access, branch protection, rulesets, forks, danger zone, and
  section-local mutation feedback.
- `10-sidebar-organizations-mailbox.md` - sidebar repository rows, local and
  remote search, organizations partial errors, mailbox rows, filters, and
  global visual consistency.
- `11-local-repository-parity.md` - shared repository chrome for local Areas,
  connected GitHub surfaces, local-only tabs, JJ/Git boundaries, and square
  background fixes.
- `12-cache-validation-invalidation.md` - cache validators, ETag support,
  GraphQL validator snapshots, mutation invalidation, local gateway events,
  rate limits, and React Query strategy.
- `13-visual-qa-validation.md` - required screenshots, validation commands,
  test ownership, proof requirements, and final done audit.

## Recommended Implementation Order

Read `00-shared-program.md` first. It is the shared contract for sequencing,
process boundaries, route/query rules, visual QA, and cross-cutting migration
constraints.

1. `01-theme-liquid-glass-foundation.md`
2. `03-issues.md`
3. `04-pull-requests.md`
4. `09-repository-settings.md`
5. `05-actions.md`
6. `06-projects-agents.md`
7. `07-wiki.md`
8. `08-security-quality.md`
9. `10-sidebar-organizations-mailbox.md`
10. `11-local-repository-parity.md`
11. `12-cache-validation-invalidation.md`
12. `13-visual-qa-validation.md` throughout every implementation slice.

Cache design should begin as architecture and instrumentation early, but broad
cache rollout should wait until route/query key state is stable.

`02-fallback-language-external-links.md` is a cross-cutting policy. Apply it
during each route migration and run a final fallback-language sweep after the
route-specific work lands, rather than treating it as a large standalone UI
touch pass.

## Non-Negotiable Constraints

- Keep Electron process boundaries clear.
- Keep GitHub calls and cache validation in `src/main`.
- Keep IPC contracts typed and serializable through `src/shared` and
  `src/preload`.
- Do not fetch all issues or pull requests for an open-only default UI.
- Do not frame core GitHub experiences as fallbacks.
- Do not hide partial GitHub or GraphQL failures behind generic empty states.
- Do not make local repository pages remote-only.
- Do not add e2e tests unless explicitly requested.
- When labels or route layouts change, update existing E2E/benchmark selectors
  that already cover those surfaces; creating new E2E specs still requires
  explicit approval.
- Before closing implementation work, run `bun run format`, `bun run lint`,
  and `bun run typecheck`; run `bun run test` when behavior or shared logic
  changes materially.
