# Area Search And Local Workflows

The multi-area foundation has shipped, but the product is not complete. This
document is the active WIP plan for Area search, local repositories, JJ
workspaces, and local mutation workflows.

## Current State

- GitHub and local folder Areas exist.
- Local Areas can discover Git, worktree, and JJ repositories.
- Local repository pages can browse files and show Git/JJ metadata.
- Connected local repositories can show GitHub Issues, Pull requests, and
  Actions tabs.
- Area-aware pins and recents are persisted.
- Search IPC can return Area, repository, and workspace matches.

## Problems To Solve

- Global search does not render Area matches even though the main process can
  return them.
- Repository search results do not consistently show Area context.
- Search keyboard navigation does not include Area result groups.
- Workspace search results are not first-class in the topbar.
- Opening a local JJ repository does not default to a concrete workspace route.
- The local repository page lists JJ workspaces but does not provide a real
  workspace switcher.
- JJ views still contain branch-centric language in places where bookmarks,
  working-copy changes, and workspace identity should be first-class.
- Local file-path search is not implemented.
- The local Repositories route still behaves like a GitHub repository directory
  instead of a selected-Area local repository list.
- Multiple GitHub accounts and account-scoped GitHub Areas are not implemented.
- Local Git operations are only partially surfaced through gateway-backed fetch
  and push flows.

## Required Work

### Global Area Search

- Render Area results from the existing search response.
- Render workspace results as their own result type.
- Show Area labels on every repository result, including GitHub, local Git, JJ,
  and SSH-backed repositories.
- Preserve duplicate repository names across Areas rather than collapsing them.
- Include Area and workspace results in keyboard navigation and selection.
- Add tests for mixed GitHub/local/JJ search ordering and duplicate names.

### Local Repositories Route

- Make the Repositories route respect the selected Area.
- For the default GitHub Area, keep the GitHub repository directory behavior.
- For local and SSH Areas, show local repositories discovered for that Area.
- Include health, connection, and stale-state labels in the list.
- Add route tests for GitHub Area vs local Area behavior.

### JJ Workspace UX

- Route JJ repository opens to a concrete workspace when one is available.
- Add a workspace switcher that updates route state and reloads workspace-owned
  data.
- Replace branch-centric labels with JJ-native language:
  - bookmarks
  - working-copy change
  - working-copy commit
  - operation id
  - sparse state
- Add a Changes tab or equivalent workspace change surface.
- Show tags, sparse summary, repository summary, latest operation, and stale
  workspace state in the local JJ UI.
- Add renderer tests for workspace switching and direct workspace routes.

### Local File Search

- Add a bounded local file-path search API per Area.
- Search paths, not file contents, for the first implementation.
- Respect ignored directories and scan limits.
- Return partial results with explicit availability when a scan times out or is
  incomplete.
- Add tests for ignored folders, maximum result caps, and duplicate filenames.

### Local Git Mutations

- Decide the v1 local mutation scope explicitly.
- If fetch/push remain in v1, model them as strict typed operations with tagged
  failures.
- Surface credential, remote, divergence, and rejected-push states separately.
- Do not add broad arbitrary command execution.
- Add tests around operation input validation, failure mapping, and cache
  invalidation.

### Multi-Account GitHub Areas

- Decide whether account-scoped GitHub Areas are in v1 or later.
- If they are in v1, extend Area identity beyond `github:default`.
- Bind GitHub remote enrichment to a specific account and auth reachability
  state.
- Preserve account labels in search, pins, recents, and route restoration.

## Acceptance Criteria

- Global search renders Areas, repositories, and workspaces with clear Area
  context.
- Local Area Repositories route no longer shows the GitHub-only directory.
- JJ repositories open into a workspace-aware route and can switch workspaces.
- JJ UI uses JJ language, not Git branch/staging language.
- Local file-path search works within bounded scan limits.
- Local Git operations have typed inputs, tagged failures, and scoped cache
  updates.

## Validation

Required before closing implementation work:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Targeted tests should include:

```bash
bun run test -- src/main/areas/areaManager.test.ts src/main/areas/registerAreaIpc.test.ts src/main/areas/localDiscovery.test.ts src/main/areas/jjAdapter.test.ts src/main/areas/jjCommandRunner.test.ts src/main/storage.test.ts src/renderer/src/App.test.tsx src/renderer/src/stores/uiStore.test.ts
```
