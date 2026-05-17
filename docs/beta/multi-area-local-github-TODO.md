# TODO - Multi-Area Local GitHub

Execution order: P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7.

First milestone scope: keep the existing GitHub account as the default GitHub
Area, add local folder Areas, discover local Git repositories, detect GitHub
remotes, and provide an explicit `Open in GitHub Area` path. SSH Areas and
multi-account GitHub are deferred; JJ-specific modeling and inline GitHub
enrichment now land through the JJ local GitHub enrichment follow-up.

## P1 - Shared Model And Storage

- [x] P1.1 - `src/shared/areas.ts` - add Area, repository, connection, local
      Git branch, remote, status, activity, and file content types.
- [x] P1.2 - `src/shared/ipc.ts` - add the `areas` API surface to `ControlApi`
      with list, select, create, remove, refresh, search, repository, file, and
      update subscription methods.
- [x] P1.3 - `src/shared/local.ts` - extend pins and recents with optional
      `areaId` and `repositoryId` while preserving GitHub-only compatibility fields.
- [x] P1.4 - `src/main/storage.ts` - add SQLite tables `areas`,
      `area_repositories`, and `area_repo_snapshots`.
- [x] P1.5 - `src/main/storage.ts` - add in-memory store parity for the new
      Area tables.
- [x] P1.6 - `src/main/storage.ts` - create default `github:default` Area when
      no Areas exist.
- [x] P1.7 - `src/main/storage.ts` - migrate existing
      `pinned_repositories.name_with_owner` rows to default GitHub Area pins without
      losing old rows.
- [x] P1.8 - `src/main/storage.ts` - migrate existing GitHub recent items to
      `areaId = "github:default"` when possible.
- [x] P1.9 - tests - cover default Area creation, pin migration, recent
      migration, and SQLite/in-memory parity.

## P2 - Main-Process Area Service

- [x] P2.1 - `src/main/areas/areaManager.ts` - add `AreaManager` coordinating
      storage, default GitHub Area, local Area creation, refresh, and events.
- [x] P2.2 - `src/main/areas/areaIds.ts` - add deterministic Area and local
      repository id helpers.
- [x] P2.3 - `src/main/areas/gitRemote.ts` - parse and normalize GitHub remote
      URLs from HTTPS, SSH scp-style, and `ssh://` forms.
- [x] P2.4 - `src/main/areas/localDiscovery.ts` - recursively scan selected
      roots with ignore pruning, depth cap, repository cap, and partial result
      persistence.
- [x] P2.5 - `src/main/areas/localGit.ts` - add bounded Git CLI adapter for
      root, common dir, branch, upstream, status, remotes, branches, and commits.
- [x] P2.6 - `src/main/areas/localFiles.ts` - read local directory listings and
      text file content with binary/unavailable states.
- [x] P2.7 - `src/main/areas/localReadme.ts` - find and cache README content for
      local repositories.
- [x] P2.8 - tests - cover ignore pruning, `.git` directory discovery, `.git`
      file worktree discovery, GitHub remote parsing, and Git command parsing.

## P3 - IPC Wiring

- [x] P3.1 - `src/main/index.ts` - instantiate `AreaManager` alongside
      `GitHubProviderManager`.
- [x] P3.2 - `src/main/index.ts` - register Area IPC handlers for area list,
      selection, local folder creation, refresh, search, repository detail,
      contents, file content, branches, remotes, status, and activity.
- [x] P3.3 - `src/main/index.ts` - add `dialog.showOpenDialog` folder picker
      handler for `openLocalFolderPicker`.
- [x] P3.4 - `src/main/index.ts` - emit `areas:updated` when Area list or
      selected Area health changes.
- [x] P3.5 - `src/main/index.ts` - emit `areas:repository-updated` as local
      scans persist repository rows.
- [x] P3.6 - `src/preload/index.ts` - expose the new Area methods and event
      subscriptions.
- [x] P3.7 - tests - cover handler validation and event payload shape.

## P4 - Renderer Area Shell

- [x] P4.1 - `src/renderer/src/stores/uiStore.ts` - add selected Area state and
      transitional Area-aware route types without removing existing GitHub helpers.
- [x] P4.2 - `src/renderer/src/App.tsx` - query `api.areas.listAreas()` and keep
      selected Area in React Query plus `uiStore`.
- [x] P4.3 - `src/renderer/src/App.tsx` - invalidate Area queries from
      `onAreasUpdated` and `onAreaRepositoryUpdated`.
- [x] P4.4 - `src/renderer/src/App.tsx` - add Area switcher UI in the
      shell/sidebar showing default GitHub Area and local Areas.
- [x] P4.5 - `src/renderer/src/App.tsx` - add `Add local folder` flow using
      folder picker plus `createLocalArea`.
- [x] P4.6 - `src/renderer/src/App.tsx` - keep existing GitHub Home,
      Repositories, Organizations, Mailbox, and repository tabs unchanged for
      `github:default`.
- [x] P4.7 - renderer tests - cover Area switcher rendering, selected Area
      switching, and add-local-folder scanning state.

## P5 - Local Area Repository UI

- [x] P5.1 - `src/renderer/src/App.tsx` - add local Area Home summary with local
      repository count, scan health, recent local repositories, and GitHub remotes.
- [x] P5.2 - `src/renderer/src/App.tsx` - add local Area Repositories view backed
      by `listAreaRepositories`.
- [x] P5.3 - `src/renderer/src/App.tsx` - add local repository route keyed by
      `areaId` and `repositoryId`.
- [x] P5.4 - `src/renderer/src/App.tsx` - add local repository header with path,
      current branch, dirty state, default branch, and GitHub connection badge.
- [x] P5.5 - `src/renderer/src/App.tsx` - add local tabs: `Code`, `Branches`,
      `Remotes`, `Status`, `Activity`.
- [x] P5.6 - `src/renderer/src/App.tsx` - implement local Code tab directory
      listing and text-file viewer using Area file IPC.
- [x] P5.7 - `src/renderer/src/App.tsx` - implement binary/unavailable file
      state.
- [x] P5.8 - `src/renderer/src/App.tsx` - implement Branches, Remotes, Status,
      and Activity read-only panels.
- [x] P5.9 - renderer tests - cover cached local repository list, local route
      navigation, local tabs, and unavailable file states.

## P6 - GitHub Connection And Search

- [x] P6.1 - `src/main/areas/areaManager.ts` - resolve local GitHub remotes to
      default GitHub Area when available.
- [x] P6.2 - `src/renderer/src/App.tsx` - add `Open in GitHub Area` action for
      connected local repositories.
- [x] P6.3 - `src/renderer/src/App.tsx` - add `Open on GitHub` external-link
      fallback when no matching GitHub Area is available.
- [x] P6.4 - `src/renderer/src/App.tsx` - update global search to include Area
      labels and local repository rows.
- [x] P6.5 - `src/renderer/src/App.tsx` - preserve duplicate repositories across
      Areas and display Area context in each result.
- [x] P6.6 - `src/renderer/src/App.tsx` - update sidebar repository search to
      respect selected Area while global search remains cross-Area.
- [x] P6.7 - tests - cover GitHub connection routing, external fallback,
      duplicate-by-Area search, and mixed Area result ordering.

## P7 - Pins, Recents, Cleanup, And Validation

- [x] P7.1 - `src/main/index.ts` + `src/main/storage.ts` - add Area-aware pin and
      recent IPC methods.
- [x] P7.2 - `src/renderer/src/App.tsx` - migrate pin mutations and pinned lists
      to `areaId + repositoryId`.
- [x] P7.3 - `src/renderer/src/App.tsx` - migrate recent recording/opening to
      Area-aware records.
- [x] P7.4 - `src/renderer/src/App.tsx` - remove direct assumptions that every
      recent repository item has GitHub `nameWithOwner`.
- [x] P7.5 - `src/renderer/src/App.tsx` - remove legacy GitHub-only pin paths
      after renderer migration is complete.
- [x] P7.6 - docs - update `docs/README.md` or architecture docs with the Area
      model once implementation lands.
- [x] P7.7 - validation - run `bun run format`.
- [x] P7.8 - validation - run `bun run lint`.
- [x] P7.9 - validation - run `bun run typecheck`.
- [x] P7.10 - validation - run `bun run test`.

## Deferred Follow-Ups

- [ ] Add multiple GitHub accounts and account-scoped GitHub Areas.
- [ ] Add SSH folder-root Areas.
- [x] Add inline GitHub enrichment inside connected local repositories.
- [ ] Add local file-path search.
- [x] Add JJ repository discovery and workspace-aware local repository modeling.
- [ ] Add local Git mutations after read-only local browsing is reliable.
