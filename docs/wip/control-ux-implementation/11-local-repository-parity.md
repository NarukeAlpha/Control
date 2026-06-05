# Local Repository Parity Implementation Plan

## Goal

Make local repository pages feel like the same product as GitHub repository
pages without losing local-first Area, Git, JJ, workspace, gateway, and sync
semantics.

## Current State

- `LocalRepositoryPage.tsx` owns a separate local tab set.
- Local tabs include overview, code, branches, bookmarks, remotes, issues,
  pulls, actions, sync, status, activity, workspaces, and operations.
- Local Issues, PRs, and Actions call area APIs with small open/default limits.
- Local repository detail includes connection data for GitHub-connected repos.
- The page has gateway operation preparation, confirmation, execution, and
  query invalidation.
- Source report calls the current local experience a separate shim.

## Primary Files

- `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx`
- `src/renderer/src/components/repository/RepositoryPage.tsx`
- `src/renderer/src/components/repository/RepositoryContext.tsx`
- `src/renderer/src/hooks/useRepositoryRouteState.ts`
- Local route-state hook or adapter if local repository state cannot share the
  remote hook cleanly.
- Future shared repository chrome components.
- `src/main/areas/*`
- `src/shared/areas.ts`
- `src/shared/local.ts`
- `src/renderer/src/stores/uiStore.ts`

## Architecture Direction

```text
RepositoryChrome
├── Remote GitHub repository data source
└── Local repository data source
    ├── local git/jj status
    ├── connected GitHub remote bridge
    └── local gateway operations
```

## Shared Chrome Model

```ts
type RepositoryDataSource = "github" | "local" | "local-connected-github";

interface RepositoryChromeModel {
  source: RepositoryDataSource;
  displayName: string;
  path?: string | null;
  nameWithOwner?: string | null;
  defaultBranch?: string | null;
  currentBranch?: string | null;
  statusChips: ChipModel[];
  actions: ActionModel[];
}
```

## Implementation Tasks

- Extract shared repository chrome only after remote repository header/tab
  behavior is stable.
- Reuse shared `RepositoryHero`, `RepositoryTabs`, `RepositoryTabSurface`, and
  `RepositoryRightRail` plus row primitives.
- Create explicit adapters that map remote GitHub and local repository data into
  the shared `RepositoryChromeModel`.
- Keep local-only tabs in local repository route.
- For GitHub-connected local repos, reuse GitHub-like Issues, PRs, and Actions
  rows/detail where identity is known.
- Keep a local context banner: workspace, current branch/bookmark, dirty state,
  sync state, and provider kind.
- Keep local code browser local-first.
- Keep JJ bookmarks and operations separate from Git branch assumptions.
- Keep gateway operation confirmations.
- Keep area query invalidation targeted.
- Add route-state compatibility so users can deep-link into local code paths,
  connected issues, connected PRs, connected actions, sync, status, and
  workspaces.
- Fix square backgrounds and incorrect corners by using shared surfaces.
- Avoid mapping every local tab to remote behavior in one change.

## Local-Only Tab Requirements

- Code: repository-like file browser, stable scroll, file preview containment.
- Branches/bookmarks/remotes: table/list surfaces with shared rows.
- Sync: explicit action surface and status result.
- Status: local state summary with clear stale/unavailable messages.
- Activity: timeline/list using shared timeline styles.
- Workspaces: list/detail using shared rows.
- Operations: safe command previews and confirmation-gated execution.

## Connected GitHub Tab Requirements

- Issues use shared issue row/detail when connection exists.
- PRs use shared PR row/detail when connection exists.
- Actions use shared workflow/run hierarchy when connection exists.
- If GitHub connection is missing, show clear local unavailable state.
- If GitHub is offline, show cached area data and availability message.

## Tests

- Local tab selection still works.
- Gateway operation confirmation still works.
- Local query invalidation still works.
- Connected GitHub unavailable states render.
- No e2e tests unless explicitly requested.

## Screenshots

- Local repository overview dark.
- Local code tab dark.
- Local repository overview light.
- Local repository overview dark glass or reduced-transparency fallback.
- Local connected Issues.
- Local connected PRs.
- Local connected Actions.
- Local sync/status operations.

## Acceptance Criteria

- Local repository pages share product chrome with remote repositories.
- Selected local tab, local code path, connected issue/PR/action, sync, status,
  and workspace state survive direct navigation and refresh where supported.
- Connected local Issues, PRs, and Actions no longer feel string-only.
- Local-only workflows remain local-first.
- JJ/Git boundaries are preserved.
- Square background/corner leaks are gone.
- Required validation passes.
