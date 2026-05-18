# TODO - JJ Local GitHub Enrichment

Execution order: J1 -> J2 -> J3 -> J4 -> J5 -> J6 -> J7 -> J8.

This checklist assumes the plain Git local Area milestone from
`docs/beta/multi-area-local-github-TODO.md` lands first. JJ should extend the
same Area model instead of creating separate local source infrastructure.

## J1 - Area Model Alignment

- [x] J1.1 - `src/shared/areas.ts` - extend `AreaRepositoryKind` to include
      `"jj"` while keeping existing GitHub and plain Git routes valid.
- [x] J1.2 - `src/shared/areas.ts` - add workspace identity types:
      `AreaWorkspaceId`, `AreaWorkspaceSummary`, `AreaWorkspaceDetail`, and
      workspace-scoped health/status fields.
- [x] J1.3 - `src/shared/areas.ts` - add JJ repo capability flags for
      Git-backed, colocated, sparse, stale, operation-log availability, and GitHub
      enrichment support.
- [x] J1.4 - `src/renderer/src/stores/uiStore.ts` - add route support for
      `areaId + repositoryId + workspaceId` without removing plain Git local
      repository routes.
- [x] J1.5 - tests - cover route serialization and restoration for JJ workspace
      routes.

## J2 - JJ Command Adapter

- [x] J2.1 - `src/main/areas/jjCommandRunner.ts` - add a command runner that
      accepts argv arrays, explicit cwd, timeouts, and non-interactive environment.
- [x] J2.2 - `src/main/areas/jjCommandRunner.ts` - classify commands as
      `passiveRead`, `explicitReadWithSnapshotRisk`, or `mutation`.
- [x] J2.3 - `src/main/areas/jjCommandRunner.ts` - enforce
      `--ignore-working-copy` for passive reads when JJ supports it.
- [x] J2.4 - `src/main/areas/jjAdapter.ts` - add version and capability
      detection for missing or unsupported JJ binaries.
- [x] J2.5 - `src/main/areas/jjAdapter.ts` - prefer JJ templates or stable
      separators for parseable output.
- [x] J2.6 - tests - assert passive adapter calls do not permit snapshot-risk
      commands in background refresh.

## J3 - Storage And Migration

- [x] J3.1 - `src/main/storage.ts` - add migration support for
      `area_repositories.kind = "jj"`.
- [x] J3.2 - `src/main/storage.ts` - add `area_workspaces` for workspace root,
      workspace name, working-copy change ID, working-copy commit ID, stale status,
      sparse summary, and refresh metadata.
- [x] J3.3 - `src/main/storage.ts` - add `area_workspace_snapshots` for cached
      file trees, README previews, and workspace summaries.
- [x] J3.4 - `src/main/storage.ts` - add or extend `area_repo_connections` for
      GitHub remote resolution from local JJ repositories.
- [x] J3.5 - tests - cover migration from existing plain Git Area tables without
      dropping or rewriting user pins/recents.

## J4 - Discovery And Grouping

- [x] J4.1 - `src/main/areas/localRepositoryManager.ts` - detect `.jj`
      repositories during local Area scans.
- [x] J4.2 - `src/main/areas/localRepositoryManager.ts` - prefer one JJ record
      when `.jj` and `.git` signals exist at the same root.
- [x] J4.3 - `src/main/areas/jjAdapter.ts` - read `jj root`,
      `jj workspace root`, `jj workspace list`, and `jj git root`.
- [x] J4.4 - `src/main/areas/jjAdapter.ts` - group multiple JJ workspaces under
      one backing repository id.
- [x] J4.5 - `src/main/areas/jjAdapter.ts` - store stale workspace state instead
      of auto-running `jj workspace update-stale`.
- [x] J4.6 - tests - cover colocated Git/JJ deduplication and multi-workspace
      grouping.

## J5 - Passive Read Model

- [x] J5.1 - `src/main/areas/jjAdapter.ts` - read bookmarks, tags, remotes,
      recent log entries, and operation head with passive read commands.
- [x] J5.2 - `src/main/areas/jjAdapter.ts` - read workspace file trees and file
      contents from the filesystem for normal code browsing.
- [x] J5.3 - `src/main/areas/jjAdapter.ts` - summarize working-copy change ID,
      commit ID, sparse state, conflicts, and dirty state without background
      snapshotting.
- [x] J5.4 - `src/main/areas/localRepositoryManager.ts` - emit repository and
      workspace update events as JJ refreshes complete.
- [x] J5.5 - tests - verify passive browsing does not change JJ operation ID or
      working-copy commit ID.

## J6 - Renderer Local JJ UI

- [x] J6.1 - `src/renderer/src/App.tsx` or extracted repository components -
      render JJ repository headers with `JJ`, Git-backed, colocated, GitHub
      connected, and stale badges.
- [x] J6.2 - renderer components - add workspace switcher for JJ repositories
      with multiple workspaces.
- [x] J6.3 - renderer components - add JJ local tabs: Overview, Code, Changes,
      Bookmarks, and Remotes.
- [x] J6.4 - renderer components - add repo-level panels for Tags, Workspaces,
      Operations summary, and Sparse summary.
- [x] J6.5 - renderer components - avoid Git branch/staging language in JJ views;
      use bookmarks and working-copy commit terminology.
- [x] J6.6 - renderer tests - cover badges, workspace switching, stale state,
      and disabled states when the JJ binary is unavailable.

## J7 - Inline GitHub Enrichment

- [x] J7.1 - `src/main/areas/githubRemoteResolution.ts` - normalize GitHub SSH
      and HTTPS remotes discovered from JJ Git remotes.
- [x] J7.2 - `src/main/areas/areaManager.ts` - bind a local JJ repository
      connection to the current authenticated GitHub Area when reachable.
- [x] J7.3 - `src/main/areas/areaManager.ts` - expose GitHub enrichment methods
      for issues, pull requests, actions, repository summary, releases, and
      contributors by delegating to the existing GitHub provider.
- [x] J7.4 - renderer components - render inline GitHub summary cards and tabs
      inside the local JJ repository route.
- [x] J7.5 - renderer components - keep `Open on GitHub` and
      `Open in GitHub Area` as secondary actions.
- [x] J7.6 - tests - cover unconnected, connected, unreachable, and
      unauthenticated GitHub enrichment states.

## J8 - Search, Pins, Recents, And Validation

- [x] J8.1 - `src/main/storage.ts` + renderer stores - preserve `workspaceId`
      when pinning or recording recent JJ workspace routes.
- [x] J8.2 - `src/main/areas/areaManager.ts` - include JJ repositories and
      workspaces in global Area search.
- [x] J8.3 - renderer search UI - show `JJ`, workspace, and GitHub-connected
      badges in mixed search results.
- [x] J8.4 - tests - cover duplicate GitHub/local/JJ search results without
      collapsing distinct Area identities.
- [x] J8.5 - docs - update architecture docs with the JJ command safety rule:
      passive reads must not mutate repositories.
- [x] J8.6 - validation - run `bun run format`, `bun run lint`,
      `bun run typecheck`, and `bun run test`.

## Deferred Follow-Ups

- [ ] Add JJ mutation UI for snapshot, describe, commit, split, squash, absorb,
      rebase, fetch, and push.
- [ ] Add a full JJ operation-log viewer with undo/redo/revert workflows.
- [ ] Add advanced revset and fileset search.
- [ ] Add SSH Areas and multiple GitHub account binding.
- [ ] Add native remote JJ hosting support if a practical provider integration
      appears.
- [ ] Add Git LFS, submodule, and hook parity only if JJ support changes enough
      to make those concepts reliable in local JJ views.
