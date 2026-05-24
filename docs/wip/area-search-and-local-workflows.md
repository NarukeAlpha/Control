# Area Search And Local Workflows

The multi-area foundation has shipped. This document is the pass-1
implementation plan for making Areas, local repositories, and JJ workspaces
usable from the primary navigation surfaces without expanding into broad local
mutation or multi-account GitHub work.

## Pass 1 Scope

Pass 1 includes:

- Topbar and command-palette search for Areas, local repositories, JJ
  workspaces, and bounded local file paths.
- A selected-Area-aware Repositories route.
- Workspace-aware JJ open, route, switcher, and local repository copy.
- Typed, bounded local file-path search through the existing Area IPC boundary.
- Narrow fetch and push UX only where the existing gateway operation contract can
  already provide a prepared operation and tagged result.

Pass 1 explicitly defers:

- Account-scoped GitHub Areas beyond the existing `github:default`.
- Arbitrary local command execution.
- Commit, branch/bookmark create, checkout, pull, undo, redo, or conflict
  resolution UX.
- Local file content search.
- New e2e coverage. Keep tests in unit/renderer tests unless a later pass
  explicitly asks for e2e.

## Current Grounding

### Existing Contracts

- `src/shared/areas.ts`
  - `AreaSummary`, `AreaRepositorySummary`, `AreaRepositoryDetail`,
    `AreaWorkspaceSummary`, and `AreaSearchResult` already exist.
  - `AreaSearchResult` already returns `areas`, `repositories`, and
    `workspaces`.
  - `AreaRepositoryInput` already carries optional `workspaceId`.
  - `AreaSyncStatus`, `AreaGatewayOperationInput`, and
    `AreaGatewayOperationResult` already exist for gateway-backed sync actions.
- `src/shared/ipc.ts` and `src/preload/index.ts`
  - `ControlApi.areas.searchAreas`, `listRepositories`, `getRepository`,
    `listContents`, `getFileContent`, `listWorkspaces`, `getWorkspace`,
    `getSyncStatus`, `prepareGatewayOperation`, and `runGatewayOperation`
    already cross the preload boundary.
- `src/main/areas/areaManager.ts`
  - `searchAreas` currently searches Areas, Area repositories, and only
    workspaces belonging to matched repositories.
  - Local fallback reads use `listLocalDirectory` and `readLocalFileContent`.
  - Gateway-backed Areas use `GatewayClient` for contents, file content, sync,
    and operations.
  - `openLocalRepositoryInApp` currently opens local repositories with
    `workspaceId = null`.
- `src/renderer/src/stores/uiStore.ts`
  - `AppRoute.localRepository` already carries `areaId`, `repositoryId`,
    optional `workspaceId`, `tab`, and optional `path`.
- `src/renderer/src/components/topbar/TopBar.tsx`
  - Already queries `api.areas.searchAreas`, but renders only Area repository
    results under an "Areas" heading and excludes those results from keyboard
    navigation.
- `src/renderer/src/components/command-palette/CommandPalette.tsx`
  - Supports command rows and GitHub file search rows. It does not consume
    `AreaSearchResult` or local file-path search.
- `src/renderer/src/components/collection/RepositoriesRoute.tsx`
  - Always loads the GitHub repository directory through `useRepositoryDirectory`.
- `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx`
  - Shows JJ workspaces, bookmarks, operations, status, and sync, but does not
    provide a route-changing workspace switcher.
  - Still renders branch-oriented labels in shared local repository surfaces.

### Existing Invariants

- Area identity is part of local repository identity. Do not dedupe repositories
  by name across Areas.
- JJ repository identity and JJ workspace identity are separate.
- Passive JJ reads must not mutate the working copy.
- GitHub enrichment for local repositories is optional and must degrade through
  availability messages rather than treating unconnected local repositories as
  errors.
- Local file reads must stay inside the repository or workspace root.

## Data Model And IPC Changes

### Add Local File-Path Search Contracts

Add these serializable types to `src/shared/areas.ts`:

```ts
export type AreaFileSearchAvailabilityStatus = "complete" | "partial" | "unavailable";

export interface AreaFileSearchInput extends AreaRepositoryInput {
  query: string;
  limit?: number;
}

export interface AreaFileSearchResult {
  areaId: string;
  repositoryId: string;
  workspaceId: string | null;
  query: string;
  matches: AreaFileEntry[];
  availability: {
    status: AreaFileSearchAvailabilityStatus;
    message: string | null;
    scannedEntries: number;
    truncated: boolean;
    timedOut: boolean;
  };
}
```

Add the route to the existing Area boundary:

- `src/shared/ipc.ts`
  - Import the new types.
  - Add the `ControlApi.areas.searchFilePaths(input: AreaFileSearchInput)`
    method returning `Promise<AreaFileSearchResult>`.
  - Add `ipcChannels.areaFilePathSearch = "areas:file-path-search"`.
- `src/preload/index.ts`
  - Expose `areas.searchFilePaths` through `invoke(ipcChannels.areaFilePathSearch, input)`.
- `src/main/areas/registerAreaIpc.ts`
  - Register the route next to `areaContents` and `areaFileContent`.
  - Parse through `requireRepositoryInput(input)`, `query` as a string, and
    numeric `limit`.
  - Normalize `query` with `trim()` and clamp `limit` in the route or
    `AreaManager.searchFilePaths` before scanning. The scanner must receive a
    positive integer limit no larger than `50`; the default is `30`.

File-path search is not a browse API. If `query.trim().length === 0`, return a
typed result without scanning:

```ts
{
  areaId: input.areaId,
  repositoryId: input.repositoryId,
  workspaceId: input.workspaceId ?? null,
  query: "",
  matches: [],
  availability: {
    status: "unavailable",
    message: "Enter a file name to search.",
    scannedEntries: 0,
    truncated: false,
    timedOut: false
  }
}
```

Do not add storage tables for file search in pass 1. File search is a bounded
read operation over the current repository/workspace root.

### Tighten Area Search Semantics

Change `AreaManager.searchAreas` in `src/main/areas/areaManager.ts`:

- Keep the current max per-result-type limit cap of `50`.
- Search all workspaces directly via `store.listAreaWorkspaces({ areaId })`
  for every Area, not only workspaces whose repository already matched.
- Treat `limit` as a global per-result-type cap, not a per-Area cap. Return at
  most `limit` Areas, at most `limit` repositories, and at most `limit`
  workspaces in the single `AreaSearchResult`.
- Preserve duplicates by returning raw `AreaRepositorySummary` and
  `AreaWorkspaceSummary` rows. Do not key by display name or path in renderer
  lists.
- Keep empty-query behavior for `areas` and `repositories`; for `workspaces`,
  empty query should return the first `limit` workspaces across all Areas only
  if a caller explicitly uses the API for browse behavior. Topbar and command
  palette should continue enabling the query only after at least two
  non-whitespace characters so their keyboard counts stay bounded.

## Main-Process Implementation

### Local File-Path Scanner

Implement a new helper in `src/main/areas/localFileSearch.ts`.

Responsibilities:

- Accept a root path, query, and options.
- Search path names only. Do not read file contents.
- Return `AreaFileEntry[]` sorted by:
  1. basename prefix match,
  2. path segment prefix match,
  3. substring match,
  4. shorter path,
  5. locale path sort.
- Reuse the ignored-directory policy from `src/main/areas/localDiscovery.ts`.
  `ignoredDirectoryNames` is private today; extract it as a shared export from
  `localDiscovery.ts` or move it to a main-process-only helper consumed by both
  `localDiscovery.ts` and `localFileSearch.ts`. Update
  `src/main/areas/localDiscovery.test.ts` and the new
  `src/main/areas/localFileSearch.test.ts` so the policy has one owner.
- Never descend into `.git` or `.jj`.
- Use `resolveInsideRoot` behavior equivalent to `localFiles.ts`. If sharing is
  practical, extract a local root resolver from `localFiles.ts`; otherwise keep
  the resolver private but equivalent.
- Derive returned `AreaFileEntry.path` values from a normalized relative path
  from `resolvedRoot` to the absolute entry path, normalize separators to `/`,
  and never from unchecked
  user input.
- Do not follow directory symlinks. Either skip symlinked directories
  unconditionally or realpath-check the followed target before traversal and
  skip it when the real path leaves the resolved root. Symlinked files may be
  returned as `type: "symlink"` but should not be read.
- Default caps:
  - `limit`: 30 result rows.
  - `maxEntriesScanned`: 20_000 filesystem entries.
  - `timeoutMs`: 750.
  - `maxDepth`: 12.
- Return partial results with `availability.status = "partial"` when a timeout,
  scan cap, permission error, or traversal error prevents a full scan.
- Return `availability.status = "unavailable"` only when the root cannot be
  read at all or the input root escapes the repository/workspace boundary.

Expose through `AreaManager.searchFilePaths(input)`:

- Resolve `workspaceId` with the existing `resolveLocalRoot(input)` logic after
  validating the Area and repository. Use the resolved workspace root when
  `workspaceId` is present; otherwise use `repository.path`.
- For `area.kind === "local"`, prefer `searchLocalFilePaths` whenever the
  repository path or resolved workspace root is local, even if a gateway client
  is currently running for that Area. Do not copy the `listContents` /
  `getFileContent` gateway-first pattern for pass 1 file search.
- For `area.kind === "ssh"` or any gateway-only root, call
  `gatewayClient.searchFilePaths` only after adding that method and confirming
  protocol support. Until then, return an `unavailable` result with a message
  like "Gateway file search is not available yet." Do not silently scan the
  local machine for SSH paths.
- Return `unavailable` rather than throwing for blank queries, missing
  repositories, missing workspaces, root escape, unreadable root, or
  gateway-only roots without path-search support.

Gateway support can be a follow-up in the same pass only if the gateway server
already supports path search. `src/main/areas/gatewayClient.ts` currently has no
method for it, so the default pass-1 expectation is local fallback support only.

## Renderer Implementation

### Shared Search Presentation

Create shared renderer helpers rather than duplicating labels in `TopBar`,
`CommandPalette`, and `RepositoriesRoute`:

- Suggested file: `src/renderer/src/components/areas/areaSearchUi.ts`.
- Functions:
  - `areaKindLabel(area.kind): "GitHub" | "Local" | "SSH"`.
  - `areaHealthLabel(area.health)` returning `null` for ready/no-message and
    visible text for scanning, offline, needs-auth, error.
  - `areaRepositorySubtitle(repository, areaById)` including Area label,
    repository kind, GitHub remote when connected, and path fallback.
  - `workspaceSubtitle(workspace, repositoryById, areaById)` including Area
    label, repository display name when available, root path, stale state, and
    sparse summary when present.
  - `localFileSearchSubtitle(entry, route)` including path and workspace
    context.

Keep these helpers presentational only. Do not make them query or mutate state.

### Topbar Search

Update `src/renderer/src/components/topbar/TopBar.tsx`:

- Build one keyboard-navigable result list containing, in order:
  1. exact direct GitHub repository result when applicable,
  2. cached GitHub repository matches,
  3. remote GitHub search matches,
  4. Area matches from `areaSearch.data.areas`,
  5. Area repository matches from `areaSearch.data.repositories`,
  6. workspace matches from `areaSearch.data.workspaces`.
- Use a discriminated local type, for example:

```ts
type TopbarSearchResult =
  | { kind: "directRepository"; nameWithOwner: string }
  | { kind: "githubRepository"; repository: RepositorySummary; source: "Local" | "GitHub" }
  | { kind: "area"; area: AreaSummary }
  | { kind: "areaRepository"; repository: AreaRepositorySummary }
  | { kind: "workspace"; workspace: AreaWorkspaceSummary };
```

- Replace the current `searchResultCount`, `activeSearchResult`, and Enter
  handling with the discriminated result list.
- Area result click/Enter:
  - call `onSelectArea(area.id)`;
  - clear the query;
  - leave route alone. If the selected Area is local/SSH and the current route
    is home, `App.tsx` already renders `LocalAreaHome`.
- Area repository result click/Enter:
  - call `onOpenLocalRepository(repository)`.
  - For JJ repositories, this callback must open the default workspace after
    `openLocalRepositoryInApp` is updated below.
- Workspace result click/Enter:
  - add a prop `onOpenWorkspace(workspace: AreaWorkspaceSummary)` or widen
    `onOpenLocalRepository` to accept a workspace id. Prefer a new explicit prop.
  - navigate to `localRepository` with `workspace.areaId`,
    `workspace.repositoryId`, `workspace.id`, and `tab: "overview"`.
- Keep the popover grouped visually with section labels, but do not keep separate
  non-keyboard rows for Areas.
- Show stale/failure states inline:
  - Area rows show `area.health.status` when not `ready`.
  - Repository rows show `repository.health.status` when not `ready`, otherwise
    connection status (`connected`, `unmatched`, `unavailable`) when present.
  - Workspace rows show `Stale` when `workspace.isStale` and the health message
    when present.
- The empty state must consider Area results. Do not show "No repositories
  found" while Area or workspace matches exist.

### Command Palette

Update `src/renderer/src/components/command-palette/CommandPalette.tsx` and
`useCommandPaletteItems.ts` in the smallest shape that preserves existing
command behavior:

- Keep `CommandPaletteItem` for static/action commands.
- Add a separate Area search query inside `CommandPalette` using
  `api.areas.searchAreas({ query: normalizedQuery, limit: 8 })` when the query
  length is greater than `1`.
- Add a local file-path search query when the current route is
  `localRepository` and the query length is greater than `1`:
  - `areaId`, `repositoryId`, and `workspaceId` come from the route.
  - Query key includes `areaId`, `repositoryId`, `workspaceId ?? "none"`,
    normalized query, and the effective limit.
  - Result rows open the local repository route with `tab: "code"` and
    `path: entry.path`.
  - If the active local route has no concrete `workspaceId`, the API searches
    the repository root. After the JJ default-workspace change, normal JJ routes
    should usually have one.
- Extend the palette result union, for example:

```ts
type CommandPaletteResult =
  | { kind: "command"; item: CommandPaletteItem }
  | { kind: "githubFile"; entry: RepoTreeEntry }
  | { kind: "area"; area: AreaSummary }
  | { kind: "areaRepository"; repository: AreaRepositorySummary }
  | { kind: "workspace"; workspace: AreaWorkspaceSummary }
  | { kind: "localFile"; entry: AreaFileEntry };
```

- Keep the existing enabled-result keyboard logic. Only command rows with
  `disabledReason` should be disabled; Area, workspace, and file rows are
  enabled unless their source query returns an unavailable state and no rows.
- Add props to `CommandPalette`:
  - `onOpenArea(area: AreaSummary): void`
  - `onOpenAreaRepository(repository: AreaRepositorySummary): void`
  - `onOpenWorkspace(workspace: AreaWorkspaceSummary): void`
  - `localFileSearch?: { route: Extract<AppRoute, { kind: "localRepository" }> } | null`
- In `src/renderer/src/App.tsx`, pass these props from existing navigation and
  Area shell actions.
- Availability states:
  - Area search errors should show a compact "Area search unavailable: ..."
    message, but must not block command rows.
  - Local file search partial results should render matches plus a muted row
    with the partial reason and scan count.
  - Local file search unavailable should render a compact unavailable message
    only when the current route is local and the user has typed a query.

### Selected-Area Repositories Route

Update `src/renderer/src/components/collection/RepositoriesRoute.tsx` and its
call site in `src/renderer/src/App.tsx`.

Add props:

- `selectedArea: AreaSummary | null`
- `localRepositories: AreaRepositorySummary[]`
- `localRepositoriesLoading: boolean`
- `areaRepositoryPinRecords: RepositoryPinRecord[]`
- `areaRepositoryPinBusy: boolean`
- `onOpenLocalRepository(repository: AreaRepositorySummary): void`
- `onToggleAreaRepositoryPin(repository: AreaRepositorySummary): void`
- `onRefreshSelectedArea(): void`

Behavior:

- Own the selected-Area branch in `src/renderer/src/App.tsx` so hidden queries
  do not stay active for the wrong Area kind. Either move the GitHub directory
  query out of `RepositoriesRoute` or gate `useRepositoryDirectory` with
  `selectedArea?.kind === "github"`.
- If `selectedArea?.kind === "github"`, keep the existing GitHub repository
  directory behavior.
- If selected Area kind is `local` or `ssh`, `RepositoriesRoute` must render the
  provided `localRepositories` rows and must not start a GitHub repository
  directory query.
- Local/SSH row fields:
  - primary: `repository.displayName`;
  - secondary: connected GitHub remote name, else `repository.path`, else kind;
  - chips: `Git`, `JJ`, `GitHub connected`, `unmatched remote`,
    `unavailable remote`, `dirty`, `stale/error/scanning` from health.
- Pin identity:
  - local repository rows match `RepositoryPinRecord` by
    `(areaId, repositoryId, workspaceId ?? null)`;
  - do not match local pins by `displayName`, `name`, `path`, or connected
    GitHub remote;
  - repository-level rows use `workspaceId: null` unless a future pass renders
    per-workspace rows in this route.
- Sorting:
  1. pinned rows first,
  2. health `ready` before non-ready,
  3. most recent `updatedAt`/`scannedAt`,
  4. `displayName`.
- Filtering should match display name, repository name, path, kind, Area label,
  GitHub remote `nameWithOwner`, health message, and workspace names when
  workspaces are provided later. For pass 1, repository fields are enough.
- Empty states:
  - scanning: "Scanning this Area for repositories."
  - ready and empty: "No repositories found in this Area."
  - non-ready: show `selectedArea.health.message` when present.
- "Add repository" remains available. For local Areas it should still open the
  existing add repository dialog for GitHub repositories until a separate local
  Area setup flow exists. Label copy can stay generic.
- Add a refresh action for local/SSH Areas that calls `refreshSelectedArea`.

### JJ Default Workspace And Switcher

Update `src/renderer/src/hooks/useAppNavigationActions.ts`:

- Change `openLocalRepositoryInApp(repository, tab = "overview")` so JJ
  repositories open a concrete workspace when one is available.
- The current `AreaRepositorySummary` does not contain workspace ids. Use one of
  these approaches:
  1. Preferred: introduce `openLocalRepositoryInApp(repository, tab, workspaceId?)`
     and have callers with workspace context pass it.
  2. For repository-only opens, navigate immediately with `workspaceId = null`,
     then let `LocalRepositoryPage` redirect once workspaces load.
- The implementation agent should choose option 2 only if keeping
  `openLocalRepositoryInApp` synchronous avoids wider churn. If option 2 is
  used, the redirect must be contained in `LocalRepositoryPage` and must not
  loop.

Update `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx`:

- Add `onSelectWorkspace(workspaceId: string): void` prop.
- When `detail.kind === "jj"`, `workspaceItems.length > 0`, and
  `route.workspaceId` is null:
  - wait until `getRepository` has returned `detail` and `listWorkspaces` has
    settled enough to know the workspace list is not still loading;
  - select `workspaceItems[0]` deterministically. `AreaWorkspaceSummary` exposes
    `workingCopyChangeId` and `workingCopyCommitId`, but
    `AreaRepositoryDetail` does not expose a repository-level working-copy id to
    compare against in pass 1, so do not invent a heuristic here;
  - navigate to the same tab/path with that workspace id.
- Do not redirect when `route.workspaceId` is non-null but missing from the
  loaded workspace list. Preserve the missing-workspace state described in
  Failure And Stale States instead of replacing it with a default workspace.
- Render a workspace switcher in the header for JJ repositories:
  - visible only when `detail.capabilities.supportsWorkspaces` and at least one
    workspace exists;
  - selecting a workspace calls `onSelectWorkspace(workspace.id)`;
  - switching keeps `activeTab` and resets `path` to `"."` only when the current
    path query fails for the new workspace. Start by keeping the path; rely on
    `listContents`/`getFileContent` unavailable states for invalid paths.
- Query keys already include `workspaceId` for contents, file content, GitHub
  enrichment, and sync. Ensure any new workspace detail or local file-search
  query keys also include `workspaceId`.
- Improve JJ copy:
  - Overview should show "Working-copy change", "Working-copy commit",
    "Bookmarks", "Sparse", and "Latest operation" for JJ repositories.
  - Do not show "Current branch" for JJ repositories.
  - `Sync` panel should label provider-specific state:
    - Git: "Current branch";
    - JJ: "Current bookmark" and "Working copy".
  - `Status` panel title for JJ should be "Working-copy changes".
  - `Activity` should include recent operations for JJ, not only commits.
- Workspace tab should render rows with name, root path, stale chip, sparse
  summary, working-copy change id, working-copy commit id, and health message.

### Local File Search UI

Pass 1 local file search should be available from the command palette while a
local repository route is open. Do not add a separate file-finder modal yet.

Opening a local file result:

- navigate to `localRepository` with the current `areaId`, `repositoryId`,
  current `workspaceId`, `tab: "code"`, and `path: entry.path`;
- record a local recent file through a helper in
  `src/renderer/src/hooks/useAppNavigationActions.ts`, not by constructing
  records in `CommandPalette.tsx`.

Use a concrete helper shape that satisfies `LocalRecentRecordInput`:

```ts
function localFileRecentInput(input: {
  areaId: string;
  repositoryId: string;
  workspaceId: string | null;
  path: string;
  entryType: AreaFileEntry["type"];
}): LocalRecentRecordInput {
  return {
    kind: "file",
    provider: "local",
    itemKey: `${input.areaId}:${input.repositoryId}:${input.workspaceId ?? "none"}:${input.path}`,
    title: input.path.split("/").pop() || input.path,
    subtitle: input.path,
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    workspaceId: input.workspaceId,
    metadata: { path: input.path, entryType: input.entryType }
  };
}
```

### Local Sync / Mutations

Keep pass 1 to the existing Sync tab fetch/push shape in
`LocalRepositoryPage.tsx`.

Implementation guidance:

- Do not add new operation kinds.
- Do not expose arbitrary command strings.
- `LocalRepositoryPage` must only surface `git.fetch`, `git.push`,
  `jj.git.fetch`, and `jj.git.push`. Do not pass any other
  `AreaGatewayOperationKind` from the UI, even though the shared union contains
  more operation kinds and `GatewayClient` currently maps unknown non-push
  operations too broadly.
- Keep `prepareGatewayOperation` before `runGatewayOperation`.
- Keep `confirmed: true` only after user confirmation.
- Improve failure display by using the existing
  `AreaGatewayOperationResult.status`, `message`, `stdout`, and `stderr`.
- Render thrown mutation errors as well as settled results. `prepareGatewayOperation`
  and `runGatewayOperation` can throw before an `AreaGatewayOperationResult`
  exists, so `LocalSyncPanel` should accept and display
  `gatewayOperation.error` in addition to the last result.
- Keep the last visible operation result or thrown error after mutation settle so
  a refetch or state transition does not immediately erase the failure context.
- If `prepareGatewayOperation` throws "This Area does not have a running
  gateway.", show an inline unavailable state and keep fetch/push buttons
  disabled for gateway-only Areas. Local fallback Areas can keep fallback sync
  status but cannot run fetch/push without a gateway.

The shared result type does not yet have explicit failure tags for credential,
remote, divergence, or rejected push. Do not claim those states are implemented
in pass 1. A later gateway-runtime pass should extend
`AreaGatewayOperationResult` with a tagged failure discriminator.

## Process Boundaries

- Renderer code must not access Node filesystem APIs.
- Local filesystem traversal stays in `src/main/areas`.
- IPC input parsing stays in `src/main/areas/registerAreaIpc.ts`.
- Shared serializable contracts stay in `src/shared/areas.ts` and
  `src/shared/ipc.ts`.
- Preload remains a thin typed bridge in `src/preload/index.ts`.
- React Query keys must include `areaId`, `repositoryId`, and `workspaceId` for
  every local repository/workspace-owned query.
- Command-palette local file-search query keys must include `areaId`,
  `repositoryId`, `workspaceId ?? "none"`, normalized query, and limit. Cached
  matches from one JJ workspace must never appear after switching workspaces in
  the same repository.
- Storage remains unchanged for file search. Repository/workspace persistence
  continues through existing `area_repositories` and `area_workspaces` stores.

## Failure And Stale States

Area search:

- If `searchAreas` fails in topbar or command palette, keep GitHub and command
  results visible and render a compact Area search error row.
- If an Area has `health.status !== "ready"`, show that status in rows.

Local repository lists:

- Area `scanning`: show existing rows if present plus a scanning indicator.
- Area `error`: show existing rows if present plus the Area health message.
- Repository `health.status !== "ready"`: row remains clickable; local
  repository page owns the detailed unavailable state.

JJ workspaces:

- `workspace.isStale` should be visible in search rows, header switcher rows,
  and Workspaces tab rows.
- Stale workspaces remain selectable so users can inspect the stored state.
- If a workspace route no longer exists, `LocalRepositoryPage` should show
  "Local workspace was not found" or navigate back to repository overview only
  after `listWorkspaces` confirms no matching workspace. Avoid hiding the error
  during loading.

Local file search:

- Partial results are successful results with `availability.status = "partial"`.
- The UI should show the matches and a muted partial-scan note.
- `unavailable` should show no matches unless the API can prove some were
  collected before failure; prefer `partial` for collected matches.
- Permission errors below the root should mark `partial`, not fail the whole
  search.

Gateway:

- SSH/gateway-only Areas without gateway file search return a typed
  unavailable file-search result, not a thrown renderer error.
- Gateway operation prepare/run failures should remain visible in Sync after the
  mutation settles.

## Sequencing

1. Main process and shared contracts
   - Add file-search types and IPC route.
   - Implement `localFileSearch.ts`.
   - Add `AreaManager.searchFilePaths`.
   - Tighten `searchAreas` workspace search.
   - Extract the ignored-directory policy without duplicating the directory
     list.
   - Add tests for IPC parsing, local file search caps/ignored directories, and
     workspace search.
2. Renderer search foundations
   - Add area search presentation helpers.
   - Update Topbar result union, keyboard navigation, and Area/workspace open
     handlers.
   - Add Topbar tests for mixed GitHub/Area/workspace results and duplicate
     repository display names across Areas.
3. Command palette
   - Add Area results and local file-path results.
   - Preserve existing command and GitHub file search behavior.
   - Add renderer tests for keyboard navigation and partial/unavailable file
     search states.
4. Repositories route
   - Make `RepositoriesRoute` selected-Area-aware.
   - Wire local repository rows from `useAreasShell`.
   - Add renderer tests for GitHub Area vs local Area behavior.
5. JJ workspace UX
   - Add default workspace routing and switcher.
   - Replace branch-centric labels in JJ views.
   - Add renderer tests for direct workspace route, repository-only JJ open, and
     workspace switching.
6. Sync polish
   - Keep fetch/push only.
   - Improve unavailable/failure messaging around gateway operation prepare/run.
   - Assert that no non-fetch/push `AreaGatewayOperationKind` is surfaced from
     `LocalRepositoryPage`.
   - Add tests around disabled states and result display if the touched code is
     covered by existing renderer tests.

## Acceptance Criteria

- Topbar search renders and keyboard-selects GitHub repositories, Areas, Area
  repositories, and JJ workspaces from one active result list.
- Command palette search renders command rows, Area rows, Area repository rows,
  workspace rows, GitHub file rows, and local file-path rows without breaking
  existing keyboard behavior.
- Duplicate repository display names from different Areas remain separate and
  show Area context.
- Local repository pins are matched only by
  `(areaId, repositoryId, workspaceId ?? null)`, not by display name or connected
  GitHub remote.
- Selecting an Area from search selects that Area without losing the current
  route unnecessarily.
- Selecting a local repository from search opens the local repository route.
- Selecting a workspace from search opens `localRepository` with that
  `workspaceId`.
- The Repositories route shows GitHub repositories for `github:default` and
  Area repositories for local/SSH Areas.
- JJ repository opens land on a concrete workspace when one exists, and the
  workspace switcher changes route state.
- JJ overview/status/sync/workspace copy uses JJ-native language instead of Git
  branch/staging language.
- Local file-path search finds paths inside the selected local repository or
  workspace, respects ignored directories, stays bounded, and reports partial
  scans.
- Blank local file-path search returns a typed unavailable result with zero
  scanned entries and never performs a tree browse.
- Local Area file search uses the local scanner even when that Area has a
  running gateway; SSH/gateway-only file search degrades through typed
  unavailable until gateway protocol support exists.
- Fetch/push remain the only surfaced local operations in pass 1, and they stay
  behind prepared gateway operations.

## Targeted Tests

Add or update focused tests near the changed code:

- `src/main/areas/localFileSearch.test.ts`
  - ignored directories are skipped;
  - `.git` and `.jj` are skipped;
  - max result limit is honored;
  - blank query returns unavailable without scanning;
  - scan cap returns partial availability;
  - duplicate basenames in different directories both return;
  - directory symlinks are skipped or realpath-checked before traversal;
  - path escape/root unavailable returns unavailable.
- `src/main/areas/localDiscovery.test.ts`
  - extracted ignored-directory policy still preserves existing discovery
    behavior.
- `src/main/areas/areaManager.test.ts`
  - `searchAreas` returns workspace matches even when the repository name does
    not match;
  - `searchAreas` applies `limit` globally per result type, including
    workspaces;
  - duplicate repository names in different Areas are preserved;
  - `searchFilePaths` resolves workspace roots;
  - local Areas with a running gateway still use local path search when a local
    root is available;
  - SSH/gateway-only roots without file-search protocol return typed
    unavailable.
- `src/main/areas/registerAreaIpc.test.ts`
  - `areas:file-path-search` parses `areaId`, `repositoryId`, `workspaceId`,
    `query`, and clamped `limit`.
- `src/preload/index.test.ts`
  - preload exposes `areas.searchFilePaths`.
- `src/shared/ipc.test.ts`
  - new IPC channel is included in the expected channel surface.
- Prefer existing renderer test files. There are currently no standalone
  `TopBar.test.tsx`, `CommandPalette.test.tsx`, `RepositoriesRoute.test.tsx`,
  or `LocalRepositoryPage.test.tsx`; use `src/renderer/src/App.test.tsx` unless
  the implementation naturally splits new component tests.
- Topbar coverage
  - Area and workspace search rows are keyboard-selectable;
  - duplicate local repository names show Area context.
- Command-palette coverage
  - local file-path rows open local code route;
  - partial local file search keeps matches visible;
  - local file-search query keys include workspace id and normalized query.
- Repositories-route coverage
  - GitHub Area renders GitHub directory;
  - local Area renders Area repositories and refresh state;
  - local repository pin state matches by Area/repository/workspace identity.
- Local-repository coverage
  - repository-only JJ route selects a workspace;
  - missing non-null workspace routes stay visible instead of redirecting;
  - workspace switcher preserves route tab;
  - JJ labels do not show "Current branch" in overview/sync;
  - Sync only surfaces fetch/push operation kinds and keeps thrown operation
    errors visible.

Do not add tests under `tests/e2e` for pass 1.

## Validation

Required before closing implementation work:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Recommended targeted loop while implementing:

```bash
bun run test -- \
  src/main/areas/localFileSearch.test.ts \
  src/main/areas/areaManager.test.ts \
  src/main/areas/registerAreaIpc.test.ts \
  src/preload/index.test.ts \
  src/shared/ipc.test.ts \
  src/renderer/src/App.test.tsx
```

Run `react-doctor . --offline` after renderer changes if the pass touches
`TopBar`, `CommandPalette`, `RepositoriesRoute`, or `LocalRepositoryPage` in a
way that changes hook ownership or render shape.
