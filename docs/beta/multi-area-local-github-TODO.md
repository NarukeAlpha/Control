# TODO - Multi-Area Local GitHub

Execution order: P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7.

First milestone scope: keep the existing GitHub account as the default GitHub
Area, add local folder Areas, discover local Git repositories, detect GitHub
remotes, and provide an explicit `Open in GitHub Area` path. SSH Areas,
multi-account GitHub, JJ-specific modeling, and inline GitHub enrichment inside
local repository pages are deferred.

## P1 - Shared Model And Storage

- [ ] P1.1 - `src/shared/areas.ts` - add Area, repository, connection, local
  Git branch, remote, status, activity, and file content types.
- [ ] P1.2 - `src/shared/ipc.ts` - add the `areas` API surface to `ControlApi`
  with list, select, create, remove, refresh, search, repository, file, and
  update subscription methods.
- [ ] P1.3 - `src/shared/local.ts` - extend pins and recents with optional
  `areaId` and `repositoryId` while preserving GitHub-only compatibility fields.
- [ ] P1.4 - `src/main/storage.ts` - add SQLite tables `areas`,
  `area_repositories`, and `area_repo_snapshots`.
- [ ] P1.5 - `src/main/storage.ts` - add in-memory store parity for the new
  Area tables.
- [ ] P1.6 - `src/main/storage.ts` - create default `github:default` Area when
  no Areas exist.
- [ ] P1.7 - `src/main/storage.ts` - migrate existing
  `pinned_repositories.name_with_owner` rows to default GitHub Area pins without
  losing old rows.
- [ ] P1.8 - `src/main/storage.ts` - migrate existing GitHub recent items to
  `areaId = "github:default"` when possible.
- [ ] P1.9 - tests - cover default Area creation, pin migration, recent
  migration, and SQLite/in-memory parity.

## P2 - Main-Process Area Service

- [ ] P2.1 - `src/main/areas/areaManager.ts` - add `AreaManager` coordinating
  storage, default GitHub Area, local Area creation, refresh, and events.
- [ ] P2.2 - `src/main/areas/areaIds.ts` - add deterministic Area and local
  repository id helpers.
- [ ] P2.3 - `src/main/areas/gitRemote.ts` - parse and normalize GitHub remote
  URLs from HTTPS, SSH scp-style, and `ssh://` forms.
- [ ] P2.4 - `src/main/areas/localDiscovery.ts` - recursively scan selected
  roots with ignore pruning, depth cap, repository cap, and partial result
  persistence.
- [ ] P2.5 - `src/main/areas/localGit.ts` - add bounded Git CLI adapter for
  root, common dir, branch, upstream, status, remotes, branches, and commits.
- [ ] P2.6 - `src/main/areas/localFiles.ts` - read local directory listings and
  text file content with binary/unavailable states.
- [ ] P2.7 - `src/main/areas/localReadme.ts` - find and cache README content for
  local repositories.
- [ ] P2.8 - tests - cover ignore pruning, `.git` directory discovery, `.git`
  file worktree discovery, GitHub remote parsing, and Git command parsing.

## P3 - IPC Wiring

- [ ] P3.1 - `src/main/index.ts` - instantiate `AreaManager` alongside
  `GitHubProviderManager`.
- [ ] P3.2 - `src/main/index.ts` - register Area IPC handlers for area list,
  selection, local folder creation, refresh, search, repository detail,
  contents, file content, branches, remotes, status, and activity.
- [ ] P3.3 - `src/main/index.ts` - add `dialog.showOpenDialog` folder picker
  handler for `openLocalFolderPicker`.
- [ ] P3.4 - `src/main/index.ts` - emit `areas:updated` when Area list or
  selected Area health changes.
- [ ] P3.5 - `src/main/index.ts` - emit `areas:repository-updated` as local
  scans persist repository rows.
- [ ] P3.6 - `src/preload/index.ts` - expose the new Area methods and event
  subscriptions.
- [ ] P3.7 - tests - cover handler validation and event payload shape.

## P4 - Renderer Area Shell

- [ ] P4.1 - `src/renderer/src/stores/uiStore.ts` - add selected Area state and
  transitional Area-aware route types without removing existing GitHub helpers.
- [ ] P4.2 - `src/renderer/src/App.tsx` - query `api.areas.listAreas()` and keep
  selected Area in React Query plus `uiStore`.
- [ ] P4.3 - `src/renderer/src/App.tsx` - invalidate Area queries from
  `onAreasUpdated` and `onAreaRepositoryUpdated`.
- [ ] P4.4 - `src/renderer/src/App.tsx` - add Area switcher UI in the
  shell/sidebar showing default GitHub Area and local Areas.
- [ ] P4.5 - `src/renderer/src/App.tsx` - add `Add local folder` flow using
  folder picker plus `createLocalArea`.
- [ ] P4.6 - `src/renderer/src/App.tsx` - keep existing GitHub Home,
  Repositories, Organizations, Mailbox, and repository tabs unchanged for
  `github:default`.
- [ ] P4.7 - renderer tests - cover Area switcher rendering, selected Area
  switching, and add-local-folder scanning state.

## P5 - Local Area Repository UI

- [ ] P5.1 - `src/renderer/src/App.tsx` - add local Area Home summary with local
  repository count, scan health, recent local repositories, and GitHub remotes.
- [ ] P5.2 - `src/renderer/src/App.tsx` - add local Area Repositories view backed
  by `listAreaRepositories`.
- [ ] P5.3 - `src/renderer/src/App.tsx` - add local repository route keyed by
  `areaId` and `repositoryId`.
- [ ] P5.4 - `src/renderer/src/App.tsx` - add local repository header with path,
  current branch, dirty state, default branch, and GitHub connection badge.
- [ ] P5.5 - `src/renderer/src/App.tsx` - add local tabs: `Code`, `Branches`,
  `Remotes`, `Status`, `Activity`.
- [ ] P5.6 - `src/renderer/src/App.tsx` - implement local Code tab directory
  listing and text-file viewer using Area file IPC.
- [ ] P5.7 - `src/renderer/src/App.tsx` - implement binary/unavailable file
  state.
- [ ] P5.8 - `src/renderer/src/App.tsx` - implement Branches, Remotes, Status,
  and Activity read-only panels.
- [ ] P5.9 - renderer tests - cover cached local repository list, local route
  navigation, local tabs, and unavailable file states.

## P6 - GitHub Connection And Search

- [ ] P6.1 - `src/main/areas/areaManager.ts` - resolve local GitHub remotes to
  default GitHub Area when available.
- [ ] P6.2 - `src/renderer/src/App.tsx` - add `Open in GitHub Area` action for
  connected local repositories.
- [ ] P6.3 - `src/renderer/src/App.tsx` - add `Open on GitHub` external-link
  fallback when no matching GitHub Area is available.
- [ ] P6.4 - `src/renderer/src/App.tsx` - update global search to include Area
  labels and local repository rows.
- [ ] P6.5 - `src/renderer/src/App.tsx` - preserve duplicate repositories across
  Areas and display Area context in each result.
- [ ] P6.6 - `src/renderer/src/App.tsx` - update sidebar repository search to
  respect selected Area while global search remains cross-Area.
- [ ] P6.7 - tests - cover GitHub connection routing, external fallback,
  duplicate-by-Area search, and mixed Area result ordering.

## P7 - Pins, Recents, Cleanup, And Validation

- [ ] P7.1 - `src/main/index.ts` + `src/main/storage.ts` - add Area-aware pin and
  recent IPC methods.
- [ ] P7.2 - `src/renderer/src/App.tsx` - migrate pin mutations and pinned lists
  to `areaId + repositoryId`.
- [ ] P7.3 - `src/renderer/src/App.tsx` - migrate recent recording/opening to
  Area-aware records.
- [ ] P7.4 - `src/renderer/src/App.tsx` - remove direct assumptions that every
  recent repository item has GitHub `nameWithOwner`.
- [ ] P7.5 - `src/renderer/src/App.tsx` - remove legacy GitHub-only pin paths
  after renderer migration is complete.
- [ ] P7.6 - docs - update `docs/README.md` or architecture docs with the Area
  model once implementation lands.
- [ ] P7.7 - validation - run `bun run format`.
- [ ] P7.8 - validation - run `bun run lint`.
- [ ] P7.9 - validation - run `bun run typecheck`.
- [ ] P7.10 - validation - run `bun run test`.

## Deferred Follow-Ups

- [ ] Add multiple GitHub accounts and account-scoped GitHub Areas.
- [ ] Add SSH folder-root Areas.
- [ ] Add inline GitHub enrichment inside connected local repositories.
- [ ] Add local file-path search.
- [ ] Add JJ repository discovery and workspace-aware local repository modeling.
- [ ] Add local Git mutations after read-only local browsing is reliable.
