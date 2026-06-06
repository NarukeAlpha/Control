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
bun run build
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

When GitHub benchmark runs are executed for both `github-web` and
`control-electron`, compare observations before accepting visual or route
changes:

```bash
bun run compare:e2e:github
```

The comparison output must not introduce new `failed` or `data_mismatch`
verdicts for the changed scenarios.

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
| Cache degraded state      |         yes |        yes |           optional | stale/offline/rate-limited   |

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
- `glass-shell` mode proves whether the app window actually bleeds through
  underlying desktop content when native platform support allows it.
- Cached data remains visible with an availability/staleness message when
  validation fails because the app is offline, rate-limited, or permission
  constrained.
- Partial endpoint failures render section-level availability messages rather
  than blanking the whole route.
- Connected local Issues, PRs, and Actions render as rich rows with action
  controls, not string-only list panels.

## Proof Requirements By Work Area

- Theme: before/after screenshots, token audit notes, Liquid Glass comparison,
  proof that `solid` remains visually more opaque than `glass-shell`, and proof
  of whether `glass-shell` bleeds through windows behind Control.
- Fallback language: `rg fallback` verification.
- Issues: API input/query key proof for open default, existing benchmark/test
  selector updates for open/closed state, issue open/closed filter deep-link
  proof, and screenshots.
- PRs: API input/query key proof for open default, existing benchmark/test
  selector updates for open/closed state, PR open/closed filter deep-link proof,
  and screenshots.
- Actions: workflow -> run -> detail navigation proof.
- Projects: partial GraphQL failure proof and top-level Projects-to-Agents
  navigation proof if that global entry exists; one failed project endpoint must
  not blank the entire Projects route.
- Wiki: long content containment proof and selected wiki page deep-link proof.
- Security: section-level unavailable proof with surrounding healthy sections
  still visible.
- Settings: grouped admin screenshot and mutation disabled reason proof.
- Sidebar/Organizations/Mailbox: dark screenshots and partial data proof.
- Local parity: connected and local-only screenshots plus selected tab/path
  deep-link proof; connected local Issues, PRs, and Actions must use rich
  row/action components rather than string-only panels.
- Cache: unit tests for validators, stale fallback, mutation invalidation, and
  proof that repeated route switches do not generate broad live refresh bursts;
  offline, rate-limited, and permission-denied cached states must keep useful
  data visible with an explicit availability message.
- Benchmarks: if a targeted `bun run test:e2e:github:*` command is part of the
  task, run `bun run compare:e2e:github` afterward and document new
  `candidate_slower`, `failed`, or `data_mismatch` verdicts.

## Final Done Audit

The full iteration is done only when:

- Dark theme can be used as the default audit mode without obvious violations.
- `no-liquid-glass` or equivalent reduced-transparency fallback behaves
  consistently on non-macOS or unsupported environments.
- `glass-shell` behavior is documented with an explicit pass/fail note for
  native desktop bleed-through where the platform supports it.
- Issues default to open, support closed filtering, and have full detail.
- Issue open/closed state filters survive direct navigation or refresh where
  the router supports it.
- PRs default to open, support closed filtering, and have full detail.
- PR open/closed state filters survive direct navigation or refresh where the
  router supports it.
- Fallback language is removed from core repository management surfaces.
- Actions starts from workflows and supports coherent run detail.
- Projects and Organizations survive partial GraphQL errors.
- Any top-level Projects navigation has been renamed to Agents if that entry
  exists, while repository Projects remains intact.
- Wiki has bounded layout and correct disabled/empty states.
- Security and Quality preserves partial data and safe admin operations.
- Repository Settings is grouped and polished.
- Local repositories share repository chrome and no longer feel separate.
- Connected local Issues, PRs, and Actions are no longer string-only panels.
- Selected tab, selected wiki page, state filters, and local route state survive
  direct navigation or refresh where the router supports it.
- Cache behavior has validator-backed freshness and targeted invalidation.
- Offline, rate-limited, and permission-denied cache states keep stale data
  useful instead of showing blank routes.
- Benchmark comparison output has no new `failed` or `data_mismatch` verdicts
  for changed scenarios when benchmark runs are in scope.
- Required validation commands pass.
- Relevant screenshots exist for changed routes.
