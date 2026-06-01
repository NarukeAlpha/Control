# Docs

## Status Folders

| Folder    | Meaning                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `done`    | Shipped behavior and completed foundation work. Use this as the current baseline.                           |
| `wip`     | Active or next implementation plans when present. Each file should include current state, gaps, and checks. |
| `design`  | Visual direction, UI rules, Liquid Glass, and architectural boundaries. How it looks and feels.             |
| `cleanup` | Active cleanup and remediation plans for open audit findings.                                               |
| `v2`      | Nice to have. Deferred until after the current WIP set ships. No timeline.                                  |

## Current Cleanup Index

- `cleanup/README.md` - active remediation index and recommended task order.
- `cleanup/main-process-infrastructure.md` - gateway, storage, keychain, local
  file, branch protection, and IPC parser remediation tasks.
- `cleanup/renderer-query-and-components.md` - branch protection UI, query
  fan-out, route/query ownership, component decomposition, and inline callback
  cleanup tasks.
- `cleanup/validation-dead-code-and-tooling.md` - dead code, dependency,
  command-path, React Doctor, Shiki, and Knip remediation tasks.
- `v2/azure-devops-provider.md` - future Azure DevOps provider architecture.

## Done Index

- `done/github-cleanup-foundation.md` - completed GitHub cleanup, auth, IPC,
  App decomposition, pagination, cache TTL, and mock-data split work.
- `done/cleanup.md` - completed original codebase cleanup and deepening plan.
- `done/cleanup-part-2.md` - completed second cleanup stabilization plan.
- `done/cleanup-part-3.md` - completed App shell decomposition plan.
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
