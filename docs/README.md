# Docs

## Status Folders

| Folder   | Meaning                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| `done`   | Shipped behavior and completed foundation work. Use this as the current baseline.                           |
| `wip`    | Active or next implementation plans when present. Each file should include current state, gaps, and checks. |
| `design` | Visual direction, UI rules, Liquid Glass, and architectural boundaries. How it looks and feels.             |
| `v2`     | Nice to have. Deferred until after the current WIP set ships. No timeline.                                  |

## Current Planning Index

- `wip/control_implementation_planning_report.md` - source Pro planning report
  for the repository UX, theme, local parity, and cache redesign iteration.
- `wip/control-ux-implementation/` - per-area implementation plan set derived
  from the source report, with one detailed markdown plan per major area.
- `v2/azure-devops-provider.md` - future Azure DevOps provider architecture.

## Done Index

- `done/github-cleanup-foundation.md` - completed GitHub cleanup, auth, IPC,
  App decomposition, pagination, cache TTL, and mock-data split work.
- `done/cleanup.md` - completed original codebase cleanup and deepening plan.
- `done/cleanup-part-2.md` - completed second cleanup stabilization plan.
- `done/cleanup-part-3.md` - completed App shell decomposition plan.
- `done/cleanup-remediation-index.md` - completed remediation index for the
  infrastructure, renderer, query, validation, and dead-code cleanup pass.
- `done/main-process-infrastructure-cleanup.md` - completed gateway, storage,
  keychain, local file, branch protection, and IPC parser remediation work.
- `done/renderer-query-and-components-cleanup.md` - completed branch protection
  UI, query fan-out, route/query ownership, component decomposition, and inline
  callback cleanup work.
- `done/tooling-triage-cleanup.md` - completed Knip and React Doctor triage
  baseline.
- `done/validation-dead-code-and-tooling-cleanup.md` - completed dead code,
  dependency, command-path, React Doctor, Shiki, and Knip remediation work.
- `done/pr-detail-decomposition.md` - completed pull request detail
  decomposition design.
- `done/last-frontier.md` - completed final provider IPC, export/import,
  app-data sync primitive, and packaged gateway delivery work.
- `done/multi-area-local-jj-foundation.md` - completed Area model, local
  repository, and JJ foundation.
- `done/markdown-rendering-baseline.md` - shipped markdown rendering baseline.

## Area Model

Control now treats GitHub and local folders as Areas. The default GitHub Area is
`github:default`; local folder Areas discover plain Git and JJ repositories on
disk. Local repository browsing is read-only by default, and JJ passive refresh
must not run commands that snapshot or mutate the working copy.
