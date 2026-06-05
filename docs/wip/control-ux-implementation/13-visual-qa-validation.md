# Visual QA And Validation Plan

## Goal

Make verification match the risk of the iteration. This work is heavily visual,
route-stateful, and cache-sensitive, so completion cannot rely only on typecheck
or isolated unit tests.

## Repository Validation Commands

Required before closing implementation work:

```bash
bun run format
bun run lint
bun run typecheck
```

Run when shared logic or behavior changes materially:

```bash
bun run test
```

Do not call `vitest` directly. Use `bun run test`.

Do not add tests under `tests/e2e` unless explicitly requested.

## Targeted Benchmark Commands

Run only when relevant and requested or already part of the task:

```bash
bun run test:e2e:github:issues
bun run test:e2e:github:pull-requests
bun run test:e2e:github:actions
bun run test:e2e:github:projects
bun run test:e2e:github:organizations
bun run test:e2e:github:security-quality
bun run test:e2e:github:repository-admin
```

## Screenshot Matrix

| Route                     | Light solid | Dark solid | Dark glass/reduced | Notes                        |
| ------------------------- | ----------: | ---------: | -----------------: | ---------------------------- |
| Repository overview/code  |         yes |        yes |                yes | baseline shell               |
| Issues list               |         yes |        yes |                yes | open filter default          |
| Issue full detail         |         yes |        yes |                yes | right rail and timeline      |
| PR list                   |         yes |        yes |                yes | open filter default          |
| PR full detail            |         yes |        yes |                yes | right rail and timeline      |
| Actions landing           |         yes |        yes |           optional | workflow list                |
| Workflow run detail       |         yes |        yes |           optional | failed run if fixture exists |
| Projects                  |         yes |        yes |           optional | partial error state          |
| Wiki                      |         yes |        yes |           optional | long content                 |
| Security and Quality      |         yes |        yes |           optional | partial unavailable state    |
| Settings                  |         yes |        yes |                yes | admin forms                  |
| Sidebar repository search |         yes |        yes |                yes | local and remote rows        |
| Organizations             |         yes |        yes |           optional | GraphQL partial error        |
| Mailbox                   |         yes |        yes |           optional | unread and read filters      |
| Local repository          |         yes |        yes |                yes | code plus issues/PRs/actions |

## Screenshot Assertions

- No large pure-white rectangles in dark mode.
- No square corners where shell/panels should be rounded.
- No horizontal body or shell overflow.
- Selected tabs and buttons have visible selected/focus state.
- Muted text remains readable.
- Scroll containers are inside panels.
- Button text does not overflow.
- Dense rows do not resize on hover.
- Traffic lights do not overlap provider, search, or action controls.
- Solid surfaces do not accidentally appear more transparent than
  `glass-shell` surfaces.
- Liquid Glass before/after captures document whether blur, translucency,
  contrast, and fallback tokens improved or regressed.

## Proof Requirements By Work Area

- Theme: before/after screenshots, token audit notes, Liquid Glass comparison,
  and proof that `solid` remains visually more opaque than `glass-shell`.
- Fallback language: `rg fallback` verification.
- Issues: API input/query key proof for open default, existing benchmark/test
  selector updates for open/closed state, and screenshots.
- PRs: API input/query key proof for open default, existing benchmark/test
  selector updates for open/closed state, and screenshots.
- Actions: workflow -> run -> detail navigation proof.
- Projects: partial GraphQL failure proof and top-level Projects-to-Agents
  navigation proof if that global entry exists.
- Wiki: long content containment proof and selected wiki page deep-link proof.
- Security: section-level unavailable proof.
- Settings: grouped admin screenshot and mutation disabled reason proof.
- Sidebar/Organizations/Mailbox: dark screenshots and partial data proof.
- Local parity: connected and local-only screenshots plus selected tab/path
  deep-link proof.
- Cache: unit tests for validators, stale fallback, mutation invalidation, and
  proof that repeated route switches do not generate broad live refresh bursts.

## Final Done Audit

The full iteration is done only when:

- Dark theme can be used as the default audit mode without obvious violations.
- `no-liquid-glass` or equivalent reduced-transparency fallback behaves
  consistently on non-macOS or unsupported environments.
- Issues default to open, support closed filtering, and have full detail.
- PRs default to open, support closed filtering, and have full detail.
- Fallback language is removed from core repository management surfaces.
- Actions starts from workflows and supports coherent run detail.
- Projects and Organizations survive partial GraphQL errors.
- Any top-level Projects navigation has been renamed to Agents if that entry
  exists, while repository Projects remains intact.
- Wiki has bounded layout and correct disabled/empty states.
- Security and Quality preserves partial data and safe admin operations.
- Repository Settings is grouped and polished.
- Local repositories share repository chrome and no longer feel separate.
- Selected tab, selected wiki page, state filters, and local route state survive
  direct navigation or refresh where the router supports it.
- Cache behavior has validator-backed freshness and targeted invalidation.
- Required validation commands pass.
- Relevant screenshots exist for changed routes.
