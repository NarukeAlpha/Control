# Docs

## Status Folders

| Folder    | Meaning                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------- |
| `done`    | Shipped behavior and completed foundation work. Use this as the current baseline.               |
| `wip`     | Active or next implementation plans. Each file should include current state, gaps, and checks.  |
| `design`  | Visual direction, UI rules, Liquid Glass, and architectural boundaries. How it looks and feels. |
| `cleanup` | Historical cleanup plans that still provide refactor context.                                   |
| `v2`      | Nice to have. Deferred until after the current WIP set ships. No timeline.                      |

## Current WIP Index

- `wip/area-search-and-local-workflows.md` - Area search, local repository
  routing, JJ workspace UX, file-path search, and local Git operations.
- `wip/code-viewer-upgrade.md` - syntax highlighting, large-file fallback,
  markdown/code rendering boundaries, blame hiding, and diff research.
- `wip/gateway-runtime-architecture.md` - gateway runtime packaging,
  per-location credentials, service lifecycle, and secret storage.
- `wip/provider-architecture-cleanup.md` - provider cache wrappers, legacy IPC
  removal, auth/cache edge cases, organization query waterfall, and type cleanup.
- `wip/repository-experience.md` - repository page cleanup, tab visibility,
  detail surfaces, and cache-first refresh behavior.
- `wip/sync-and-data-boundaries.md` - local-first sync/export boundaries,
  sensitive Area metadata, gateway tokens, and redaction requirements.
- `wip/theme-and-liquid-glass.md` - theme tokens, dark mode, and remaining
  Liquid Glass fixes.
- `v2/azure-devops-provider.md` - future Azure DevOps provider architecture.

## Done Index

- `done/github-cleanup-foundation.md` - completed GitHub cleanup, auth, IPC,
  App decomposition, pagination, cache TTL, and mock-data split work.
- `done/multi-area-local-jj-foundation.md` - completed Area model, local
  repository, and JJ foundation.
- `done/markdown-rendering-baseline.md` - shipped markdown rendering baseline.

## Area Model

Control now treats GitHub and local folders as Areas. The default GitHub Area is
`github:default`; local folder Areas discover plain Git and JJ repositories on
disk. Local repository browsing is read-only by default, and JJ passive refresh
must not run commands that snapshot or mutate the working copy.
