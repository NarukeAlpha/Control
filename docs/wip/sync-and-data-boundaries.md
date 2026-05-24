# Sync And Data Boundaries

Control is local-first. There is no hosted sync backend and there is no
export/import IPC surface today. This plan is pass 1 for making the data
boundaries explicit enough that later export, import, local-folder sync, or
hosted sync work does not accidentally sync secrets, corrupt caches, or blur
Electron process boundaries.

Pass 1 should not build hosted sync. It should narrow ownership, contracts, and
cache semantics around the code that exists now.

## Scope

### In Scope

- Classify SQLite-backed data into durable user state, reconstructable cache,
  local machine metadata, and secrets.
- Move gateway secret material out of SQLite or block any export/import work
  until that migration is complete.
- Define typed redaction/export boundaries without adding a broad export UI.
- Document offline, stale, partial-failure, and background refresh semantics for
  GitHub reads and Area reads.
- Make cache invalidation ownership explicit for main-process provider caches
  and renderer React Query caches.
- Keep future implementation work sequenced through small, testable boundaries.

### Out Of Scope For Pass 1

- Hosted sync service, account sync, conflict resolution UI, or remote sync
  protocols.
- Encrypting and shipping a full backup format.
- Syncing credentials between machines.
- Adding new E2E tests. Keep coverage in unit and renderer tests unless a later
  pass explicitly asks for E2E.
- Generalizing the runtime beyond the current GitHub provider and Area model.

## Current Grounding

### Storage

SQLite schema is bootstrapped in `src/main/storage/schema.ts` and exposed
through `src/main/storage/localStoreAdapter.ts`.

Current tables:

- `settings`: non-secret app preferences.
- `accounts`: cached account/profile payloads such as GitHub viewer records.
- `cache_entries`: generic provider cache rows with `provider`, `cache_key`,
  `payload`, `etag`, `expires_at`, and `updated_at`.
- `recent_items`: local navigation history keyed by kind/provider/item.
- `pinned_repositories`: legacy GitHub repository pins.
- `area_repository_pins`: Area-aware pins keyed by
  `area_id`, `repository_id`, and `workspace_id`.
- `areas`: Area identity and display/health state.
- `area_repositories`: local/SSH/GitHub Area repository read models.
- `area_workspaces`: JJ workspace read models.
- `area_gateways`: gateway summary and full gateway record JSON.
- `area_repo_snapshots` and `area_workspace_snapshots`: reconstructable Area
  snapshot/cache payloads.
- `github_repositories`: GitHub repository summary/detail/readme read models.

### Credentials

- GitHub OAuth tokens are stored through `src/main/github/credentials.ts`, not
  in SQLite.
- Gateway `apiToken` and `adminToken` are currently fields on
  `AreaGatewayRecord` in `src/main/storage/areaGatewayStore.ts`, persisted in
  `area_gateways.record_json`.
- The renderer sees `AreaGatewaySummary` through `AreaSummary.gateway`; it does
  not receive gateway tokens today.

### Provider And Cache Ownership

- `src/main/github/provider.ts` owns GitHub credential loading, provider
  lifetime, cache TTLs, background refresh, stale fallback, generic cache
  writes, GitHub repository read-model writes, and main-process cache
  invalidation after mutations.
- `src/main/github/readCache.ts` owns the specialized repository-directory
  status cache, including stale rows, negative cache rows, request dedupe, and
  cache-only fallback.
- `src/main/storage/cacheStore.ts` owns generic cache row read/write/delete by
  provider and cache-key prefix.
- `src/main/areas/areaManager.ts` owns Area refresh. Local/gateway refreshes
  currently clear and replace Area repository/workspace read models. Gateway
  refresh failure falls back to local refresh for local Areas, and marks SSH
  Areas with `AreaHealth.status === "error"`.

### IPC And Renderer Query Ownership

- Shared serializable contracts live in `src/shared/github.ts`,
  `src/shared/areas.ts`, and `src/shared/ipc.ts`.
- `src/preload/index.ts` exposes `window.control` and should remain a forwarding
  layer.
- Main IPC registration is split between `src/main/ipc/registerControlIpc.ts`,
  `src/main/ipc/registerGithubIpc.ts`, and `src/main/areas/registerAreaIpc.ts`.
- Renderer query keys and invalidation live in renderer code:
  - `src/renderer/src/components/shell/appInvalidations.ts`
  - `src/renderer/src/components/shell/AppEventBridge.tsx`
  - `src/renderer/src/queries/repositoryQueryKeys.ts`
  - route and tab query helpers under `src/renderer/src/hooks` and
    `src/renderer/src/components/repository`.

## Boundary Rules

### Main Process Owns

- Reading and writing SQLite.
- Credential lookup, credential rotation, and token validation.
- GitHub REST/GraphQL calls through `OctokitProvider`.
- Gateway process lifecycle, SSH, gateway HTTP calls, and gateway bearer
  headers.
- Cache TTL decisions, stale fallback, negative caches, and main-process cache
  invalidation.
- Export/import file parsing and redaction if those surfaces are later added.

### Preload Owns

- Forwarding typed IPC calls from renderer to main.
- Defaulting optional route inputs only where `ControlApi` already allows
  optional input.
- Typed event subscription/unsubscription.

Preload must not know cache TTLs, token state beyond forwarding calls, query
keys, export redaction rules, gateway URL authority, or sync scheduling.

### Renderer Owns

- React Query keys and query enabling.
- Choosing cache-only vs live intent from `githubReady`.
- Rendering `GitHubReadAvailability`, `AreaHealth`, and partial/unavailable
  states.
- Manual refresh actions that call existing typed APIs with `forceRefresh`
  only when live reads are possible.
- Renderer React Query invalidation after UI mutations and main-process events.

Renderer must not read or write SQLite, parse raw gateway records, inspect
tokens, construct gateway bearer headers, or infer provider error classes.

## Data Classification

### Never Export Or Sync As Plain Data

- GitHub OAuth tokens.
- Gateway `apiToken` and `adminToken`.
- Future PATs, provider access tokens, SSH private keys, passphrases, or bearer
  headers.
- Raw gateway manifests if they contain secret material.
- Credential-store account names if a future naming scheme embeds secret
  material.

### Secret Migration Blocker

`area_gateways.record_json` currently contains `apiToken` and `adminToken`. Any
export/import implementation must be blocked until one of these is true:

1. Gateway tokens are migrated to a main-process credential module, following
   the discipline in `src/main/github/credentials.ts`, and SQLite stores only
   non-secret gateway metadata.
2. Export/import explicitly refuses to include `area_gateways.record_json`, and
   tests prove gateway tokens cannot appear in any exported payload.

Prefer option 1. The matching gateway plan is in
`docs/wip/gateway-runtime-architecture.md`: add
`src/main/areas/gatewayCredentials.ts`, persist only non-secret metadata in
`area_gateways`, and keep token lookup in the main process.

Gateway token migration has an async startup boundary. It cannot be hidden
inside the synchronous `SqliteLocalStore` constructor after
`bootstrapSqliteSchema()`. The migration must run through an explicit
main-process startup gate after SQLite schema/bootstrap is complete and before
`GatewayManager` starts, or through an equivalent `await`ed migration service
that blocks gateway startup. That gate must:

- Read existing `area_gateways.record_json` rows that contain `apiToken` or
  `adminToken`.
- Persist those tokens to the main-process credential module.
- Rewrite the SQLite `record_json` rows with token fields removed or set to
  `null`.
- Fail closed for export/import if the migration cannot prove SQLite is
  token-free.
- Test raw `area_gateways.record_json` payloads directly, not only
  `AreaSummary.gateway`, because summaries are already token-free.

### Privacy-Sensitive User/Device State

These can be included only by explicit user intent and visible labeling:

- Local repository paths and workspace root paths.
- SSH hosts, users, ports, and remote paths.
- Gateway URLs, admin URLs, service names, process IDs, and location labels.
- Recent items.
- Area repository pins and legacy GitHub pins.
- Area names and subtitles when they include customer, machine, or path
  details.
- GitHub account/profile cache metadata for private accounts.
- Repository owner/name pairs for private repositories.

### Durable Non-Secret State

These are candidates for future manual export/import after redaction rules are
implemented:

- Non-secret `settings` values from `src/main/storage/settingsStore.ts`.
- Theme, display, and tab visibility preferences.
- Area selection state only when the corresponding Area is included.
- Repository display preferences that do not embed local paths or credentials.

### Reconstructable Cache

These should not be treated as authoritative sync state:

- `cache_entries`.
- `github_repositories`.
- `area_repositories`.
- `area_workspaces`.
- `area_repo_snapshots`.
- `area_workspace_snapshots`.
- Cached account/profile payloads in `accounts`.

Future export may optionally include reconstructable cache as a warm-start
optimization, but import must behave correctly when cache data is absent,
expired, partially imported, or intentionally excluded.

### Field-Level Export Mapper Requirements

Export/import mappers must classify fields, not only tables. JSON blobs are not
safe just because their table is durable or cache-like.

- `areas.root_path` is private local-machine state. Export it only when the Area
  scope explicitly includes local paths; otherwise omit it and mark the Area as
  needing local relink on import.
- `area_repositories.path` and `area_workspaces.root_path` are private
  local-machine cache fields. They are reconstructable from a later Area scan
  and must not be exported by default.
- `area_repositories.connection_json.remoteUrl` is private remote metadata and
  may embed usernames, hosts, repository names, or credentials in malformed
  remotes. Export only a normalized, credential-stripped remote URL when the
  user includes private repository metadata; never export bearer headers or
  tokens from this blob.
- `recent_items.payload.metadata.path`, `recent_items.payload.metadata.url`,
  `recent_items.payload.metadata.ref`, top-level `path`, top-level `url`, and
  top-level `ref` are privacy-sensitive recents metadata. They are included
  only when recents are explicitly selected and must be labeled as local path,
  private URL, or branch/ref metadata in export preview.
- `github_repositories.readme_markdown` is reconstructable GitHub cache that
  can contain source, documentation, customer names, links, or private project
  detail. Exclude it by default; include it only with an explicit GitHub metadata
  cache scope.
- `github_repositories.summary_json`, `detail_json`, `viewer_state_json`, and
  `permissions_json`, plus `accounts.payload`, are private account/repository
  cache payloads when the account or repository is private. Export preview must
  count them as private GitHub metadata, not durable settings.
- Nested `AreaRepositoryDetail.readme`, commit summaries, branch/bookmark names,
  remotes, and operation summaries are reconstructable Area cache with private
  path/source context. Include only under an Area cache scope.

## Offline And Partial-Failure Semantics

### GitHub Reads

Use existing `GitHubReadAvailability` statuses from `src/shared/github.ts`:

- `available`: live or acceptable cached data is available.
- `stale`: cached data is being shown because live refresh is unavailable or
  failed.
- `not_loaded`: no cache exists for a cache-only read.
- `offline`, `permission_denied`, `rate_limited`, `graphql_error`,
  `feature_disabled`, and `error`: render inline in the owning surface.

Rules:

- When `githubReady === false`, renderer reads must pass `cacheOnly: true` and
  must not expose live mutation or live refresh controls.
- Manual refresh may pass `forceRefresh: true` only when `githubReady === true`.
- Stale data remains visible. Do not replace useful cached rows with empty
  states just because a background refresh fails.
- `withListStatusCache` and `withStatusCache` in
  `src/main/github/provider.ts` should return typed status results on
  cache-only misses and live failures; do not throw through renderer-visible
  status reads unless the contract is explicitly a throwing raw read.
- Raw cached helpers may continue throwing on cache-only misses only for
  main-internal or legacy paths where the UI does not need availability detail.

### Area GitHub Enrichment

Area GitHub enrichment is renderer-intent governed. `AreaManager` can forward
`cacheOnly` and `forceRefresh` through `githubInputForAreaRepository`, but it
does not know whether the renderer is signed in or intentionally doing a
cache-only read.

Rules:

- Local repository GitHub tabs must derive the same `githubReady` signal used by
  repository views.
- `LocalRepositoryPage` queries for `listGitHubIssues`,
  `listGitHubPullRequests`, and `listGitHubActions` must pass
  `cacheOnly: !githubReady`.
- Those queries may pass `forceRefresh: true` only for explicit refresh actions
  while `githubReady === true`; passive tab reads should rely on provider TTLs.
- Signed-out/offline Area GitHub tabs must show cached enrichment with
  `GitHubReadAvailability` or `not_loaded`; they must not start live GitHub
  reads by omitting cache intent.
- If a later implementation chooses main-governed enrichment instead, the main
  process must own provider readiness and force cache-only behavior there. Do
  not leave the contract split between renderer assumptions and main defaults.

### Area Reads

Area data has two separate meanings that must not be conflated:

- App data sync/export/import is the future feature described by this plan.
- `AreaSyncStatus` in `src/shared/areas.ts` is repository VCS sync status for
  Git/JJ remotes.

Rules:

- Area list/repository/workspace reads should serve stored read models even when
  a local path, SSH host, or gateway is temporarily unavailable.
- Failed Area refresh updates `AreaHealth` and emits the existing Area events;
  it must not silently clear all useful read models without a visible failure
  state.
- Local and gateway Area refresh must stage replacement data before deleting
  stored read models. `refreshLocalArea` and `refreshGatewayArea` should scan or
  fetch into in-memory replacement sets, then replace repositories/workspaces in
  a storage transaction only after discovery/read completion succeeds. If
  `discoverLocalRepositories`, `readGitRepository`, `readJjRepository`, gateway
  `listRepositories`, or gateway detail reads fail before the replacement set is
  valid, preserve existing rows and mark the Area health/error state instead of
  clearing them.
- Local Area gateway failure may fall back to local filesystem reads, matching
  current `AreaManager.refreshGatewayArea` behavior.
- That fallback must not hide gateway failure. Direct local read usability and
  gateway health are separate: keep `AreaHealth.status === "ready"` only for the
  successfully refreshed local read model, and persist the gateway failure on
  `AreaGatewaySummary.status === "error"` with a message and timestamp such as
  `lastSeenAt`/`updated_at`, or an equivalent gateway-specific warning field.
  The UI should be able to show "local data is usable, gateway failed" from
  stored state.
- SSH Area gateway failure must stay explicit because Control cannot safely
  scan the remote path locally.
- Passive local/JJ reads must remain non-mutating. Do not run JJ snapshotting or
  mutating commands as part of background refresh.

## Cache Invalidation Ownership

### Main-Process GitHub Cache

Current owner files:

- `src/main/github/provider.ts`
- `src/main/github/readCache.ts`
- `src/main/storage/cacheStore.ts`
- `src/main/storage/githubRepositoryStore.ts`

Implementation rules:

- Provider cache keys remain provider-owned. Renderer must not construct
  `cache_entries.cache_key` strings.
- Mutation success in `GitHubProviderManager.mutate` invalidates main-process
  cache prefixes through `clearCachePrefixes`.
- `GitHubReadCache.invalidate` already clears repository-directory negative
  caches and request dedupe; keep negative-cache invalidation paired with
  repository collection invalidation.
- Avoid broad repository-scoped cache clears for every mutation. The current
  `clearRepositoryScopedCache` is intentionally broad; narrow it in a later
  provider-cache pass only with tests that cover issue, pull request, workflow,
  release, repository settings, and security mutations.
- Account/session changes may use broad cache invalidation. Repository-scoped
  mutations should prefer affected cache families.

### Renderer React Query Cache

Current owner files:

- `src/renderer/src/components/shell/appInvalidations.ts`
- `src/renderer/src/components/shell/AppEventBridge.tsx`
- `src/renderer/src/queries/repositoryQueryKeys.ts`

Implementation rules:

- Main process emits events; renderer invalidates React Query.
- `github:repositories-updated` invalidates `["repositories"]` and, when
  `nameWithOwner` is present, repository-scoped keys for that owner/repo.
- `github:auth-updated` updates `["app-state"]` and invalidates session-wide
  keys through `invalidateGitHubSessionQueries`.
- Area events invalidate Area query families by event scope:
  - `areas:updated` invalidates `["areas"]`. Bulk import or Area removal should
    also invalidate all Area repository/workspace/content families through a
    documented broad Area event or a renderer helper.
  - `area-repository:updated` invalidates `["area-repositories", areaId]`,
    `["area-repository", areaId, repositoryId]`,
    `["area-workspaces", areaId, repositoryId]`,
    `["area-contents", areaId, repositoryId]`,
    `["area-file-content", areaId, repositoryId]`,
    `["area-sync-status", areaId, repositoryId]`,
    `["area-github-issues", areaId, repositoryId]`,
    `["area-github-pulls", areaId, repositoryId]`, and
    `["area-github-actions", areaId, repositoryId]`.
  - `area-workspace:updated` invalidates
    `["area-workspaces", areaId, repositoryId]` and workspace-scoped prefixes
    for `["area-contents", areaId, repositoryId, workspaceId]`,
    `["area-file-content", areaId, repositoryId, workspaceId]`, and
    `["area-sync-status", areaId, repositoryId, workspaceId]`.
  - Gateway operation success should either emit the repository/workspace events
    above or explicitly refetch the same query families in the owning mutation.
- Pinning, recents, and Area operations are not GitHub mutations. Keep them out
  of GitHub mutation invalidation.
- Do not use `repositoryScopedQueryKeys` as the only invalidation strategy for
  all mutations long term. Add a mutation-to-query-family mapping before
  narrowing main-process provider cache invalidation.

## Background Refresh Scheduling

### Existing Behavior To Preserve

- React Query has global `staleTime: 30_000`, `retry: 1`, and
  `refetchOnWindowFocus: false` in `src/renderer/src/main.tsx`.
- GitHub provider TTLs live in `cacheTtlMs` inside
  `src/main/github/provider.ts`.
- Expired cached GitHub reads generally return cached data immediately and call
  `refreshInBackground`.
- Repository-directory status reads have a specialized background path in
  `src/main/github/readCache.ts`.
- Manual route refresh helpers in `src/renderer/src/hooks` and repository tab
  modules use `queryClient.fetchQuery` with `cacheOnly`/`forceRefresh` based on
  `githubReady`.
- Area creation/update triggers `AreaManager.refreshArea` in the background.
- Gateway operations call `refreshArea` after operation completion.

### Scheduling Rules For New Work

- Do not add polling or timers for app-data sync in pass 1.
- Prefer "refresh on user action, mutation success, Area event, auth event, or
  stale cache read" over fixed background polling.
- Deduplicate live reads in main process when the cache key or request identity
  is provider-owned. Use existing request dedupe patterns in
  `GitHubRequestDedupe` and `GitHubReadCache`.
- Background refresh failures must be logged and must not throw unhandled
  promises into the renderer.
- Current `GitHubProviderManager.refreshInBackground()` only logs failure. Do
  not claim a stale visible read has surfaced a new failure unless code records
  that failure. New work that needs surfacing must add provider-owned failure
  metadata keyed by provider cache key or request identity, including
  `failedAt`, status category, and message. The next status read should overlay
  cached payload availability as `stale` or a more specific
  `GitHubReadAvailability` status while preserving cached items/content.
- Area background refresh failures are surfaced through stored `AreaHealth` or
  gateway-specific health/warning state, not through renderer-only logs.
- Imported cache rows, if added later, must be marked with enough metadata
  (`updated_at`, `expires_at`, provider/cache key) for existing stale-read logic
  to decide whether to refresh.
- Imported `github_repositories` rows must also preserve or intentionally reset
  `synced_at`, `detail_synced_at`, and `readme_synced_at`. If the import source
  lacks trustworthy timestamps, set these fields to `null` or an expired source
  timestamp so repository summary/detail/readme reads refresh live when possible.
  Never stamp imported GitHub repository cache with the import time merely to
  make warm-start cache look fresh.

## IPC And Query Contracts

### Do Not Add Export/Import Until These Contracts Exist

Add shared types first, likely in a new `src/shared/sync.ts` or
`src/shared/export.ts`:

- `ControlDataClass = "secret" | "private" | "durable" | "cache"`.
- `ControlExportScope` with explicit booleans for settings, areas, pins,
  recents, GitHub metadata cache, Area cache, and snapshots.
- `ControlExportManifest` with schema version, createdAt, app version, included
  scopes, redaction summary, and cache inclusion flags.
- `ControlExportPreview` that reports counts and sensitive categories before a
  file is written.
- `ControlExportResult` that returns manifest and file path or bytes, not raw
  secret-bearing rows.
- `ControlImportPreview` that reports what will be inserted, skipped, redacted,
  or treated as cache.

Only after those types exist should `ControlApi` grow methods such as:

- `previewDataExport(input: ControlExportScope): Promise<ControlExportPreview>`
- `exportData(input: ControlExportInput): Promise<ControlExportResult>`
- `previewDataImport(input: ControlImportInput): Promise<ControlImportPreview>`
- `importData(input: ControlImportApplyInput): Promise<ControlImportResult>`

IPC implementation belongs in main-process routes beside
`src/main/ipc/registerControlIpc.ts`, with parse functions in the same style as
existing route parsers. Preload only forwards those methods.

### Query Contract Rules

- Export/import should not be driven by React Query cache state. It should read
  from main-process storage through a main-process service.
- After import, main emits events for affected surfaces instead of renderer
  manually guessing query keys.
- Imported durable settings should invalidate `["app-state"]` or settings
  queries as appropriate.
- Imported Area durable data should emit `areas:updated`; imported Area
  repository/workspace cache should emit the more specific Area repository or
  workspace events when possible.
- Imported GitHub reconstructable cache should emit
  `github:repositories-updated` with `nameWithOwner: null` unless the import can
  name a single affected repository.
- Import apply must run in a main-process storage transaction. It must insert or
  update `areas` before `area_repositories`, `area_repositories` before
  `area_workspaces`, and referenced Area/repository/workspace rows before
  `area_repository_pins`.
- Import must preserve exactly one selected Area. If the payload selects no
  Area, keep the current selected Area or select the default GitHub Area. If it
  selects multiple Areas, preview must report the conflict and apply must choose
  one deterministic winner only after user confirmation.
- Area ID collisions must be resolved before apply. Preview must report whether
  each imported Area will update an existing Area, be skipped, or be remapped to
  a new ID; remapping must update repositories, workspaces, snapshots, recents,
  and pins consistently.
- Partial import failure must roll back all writes from that import. It must not
  leave pins pointing at missing repositories, workspaces pointing at missing
  repositories, or the database with zero/multiple selected Areas.

## Implementation Sequence

### Phase 1: Lock The Boundary Inventory

Owner files for implementation:

- `docs/wip/sync-and-data-boundaries.md`
- tests may inspect `src/main/storage/schema.ts`,
  `src/main/storage/localStoreAdapter.ts`, and `src/main/storage/areaGatewayStore.ts`

Tasks:

1. Keep this document aligned with current schema tables and shared contracts.
2. Add a storage-boundary inventory test only if implementation begins to add
   export/import code; doc-only work does not need tests.
3. Treat `AreaSyncStatus` references as VCS sync status, not app-data sync.

### Phase 1A: Correct Existing Boundary Mismatches

Owner files for implementation:

- `src/main/areas/areaManager.ts`
- `src/main/storage/localStoreAdapter.ts` and Area store helpers if a
  transaction helper is needed
- `src/main/areas/registerAreaIpc.ts`
- `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx`
- `src/renderer/src/components/shell/AppEventBridge.tsx`
- focused tests near the changed modules

Tasks:

1. Change local and gateway Area refresh to staged/transactional replacement so
   failed refreshes preserve existing read models.
2. Persist gateway fallback failure separately from local read-model readiness,
   either on `AreaGatewaySummary` or an explicit gateway warning field.
3. Pass `cacheOnly`/`forceRefresh` intent from Local Repository GitHub tabs, or
   move provider-readiness ownership entirely into main process.
4. Expand renderer Area event invalidation to cover local repository content,
   file content, GitHub enrichment, and VCS sync-status query families.
5. Cover refresh failure retention in `src/main/areas/areaManager.test.ts` and
   renderer query input/event behavior in focused renderer tests.

### Phase 2: Remove Or Quarantine Gateway Secrets

Owner files:

- `src/main/areas/gatewayCredentials.ts` (new, preferred)
- `src/main/areas/gatewayManager.ts`
- `src/main/areas/gatewayClient.ts`
- `src/main/storage/areaGatewayStore.ts`
- `src/main/storage/mappers.ts`
- `src/main/storage/localStoreAdapter.ts`
- `src/main/storage/memoryStore.ts`
- focused tests near the changed modules

Tasks:

1. Move gateway `apiToken` and `adminToken` to keytar-backed main-process
   storage, or explicitly exclude `area_gateways.record_json` from any export.
2. Keep `AreaGatewaySummary` token-free.
3. Add migration behavior for existing SQLite gateway records that contain
   tokens.
4. Run the migration through an awaited main-process startup gate after schema
   bootstrap and before `GatewayManager` starts.
5. Add tests proving tokens are not written back to raw SQLite
   `area_gateways.record_json` after migration.

### Phase 3: Define Export/Import Contracts Without UI

Owner files:

- `src/shared/sync.ts` or `src/shared/export.ts` (new)
- `src/shared/ipc.ts`
- `src/main/ipc/registerControlIpc.ts`
- `src/preload/index.ts`
- `src/main/storage/*` read helpers as needed
- `src/main/ipc/registerControlIpc.test.ts`
- `src/shared/ipc.test.ts`

Tasks:

1. Add preview-only shared types and IPC routes first.
2. Implement a redaction mapper that classifies every table/field listed in
   this document.
3. Preview counts and sensitive categories without writing a file.
4. Test parser behavior and JSON-serializable shared contracts.

### Phase 4: Add Manual Export

Owner files:

- main-process export service under `src/main`
- `src/main/ipc/registerControlIpc.ts`
- `src/preload/index.ts`
- renderer UI only if explicitly requested

Tasks:

1. Export only user-approved scopes.
2. Exclude secrets unconditionally.
3. Include reconstructable cache only when requested.
4. Write a manifest with schema version and redaction summary.
5. Tests must scan exported JSON/string payloads for known OAuth and gateway
   token fixtures.

### Phase 5: Add Import

Tasks:

1. Preview first; no blind apply.
2. Durable data import must preserve local invariants, especially Area identity
   and workspace identity.
3. Cache import must tolerate missing/expired/partial rows.
4. Emit existing main-to-renderer events after apply.
5. Do not import credentials.
6. Apply imports in a transaction with ordered writes for `areas`,
   `area_repositories`, `area_workspaces`, snapshots, recents, and pins.
7. Preserve exactly one selected Area and maintain
   `area_repository_pins` references after ID collision handling/remapping.
8. Roll back the entire import on parser, invariant, foreign-key, or write
   failure.

### Phase 6: Consider Local-Folder Or Hosted Sync

Only after manual export/import is correct:

- Decide whether local-folder sync is a repeated export file, a structured
  directory, or deferred.
- Define conflict semantics for settings, pins, recents, Areas, and cache.
- Hosted sync requires a separate plan covering auth, encryption, server data
  model, deletion semantics, and multi-device conflict resolution.

## Acceptance Criteria

Pass 1 is complete when:

- The storage table inventory in this document matches `src/main/storage/schema.ts`.
- Secret, privacy-sensitive, durable, and reconstructable-cache data classes are
  explicit.
- Gateway token handling is identified as a blocking issue for export/import.
- Main/preload/renderer ownership is specific and tied to current files.
- Offline/stale/partial-failure semantics are written for GitHub and Area reads.
- Area refresh guidance requires staged replacement or explicit stale retention
  before claims about preserving stale Area read models are considered
  implemented.
- Area GitHub enrichment has one owner for cache/live intent, and signed-out
  Local Repository GitHub tabs cannot start live GitHub reads.
- Main-process provider cache invalidation and renderer React Query
  invalidation have separate ownership rules.
- Renderer Area invalidation covers repository detail, workspaces, content, file
  content, GitHub enrichment, and VCS sync-status query families or explicitly
  documents any intentionally stale family.
- Background refresh scheduling uses existing TTL, stale-read, event, and manual
  refresh paths instead of adding polling.
- GitHub background refresh failure surfacing distinguishes current log-only
  behavior from future recorded availability/error metadata.
- Future IPC/query contracts are concrete enough to implement without guessing.

Implementation acceptance for later phases:

- No exported payload contains GitHub OAuth tokens, gateway tokens, bearer
  headers, SSH private keys, or future provider tokens.
- Cache-only signed-out/offline reads still return cached data with
  `available`, `stale`, or `not_loaded` availability instead of throwing through
  status routes.
- Background refresh failure preserves cached GitHub and Area content while
  surfacing inline availability or Area health.
- Import without cache rows still leaves the app usable and able to refresh live
  data later.
- Import with cache rows cannot mark stale data as authoritative durable state.
- Imported `github_repositories` rows have `synced_at`, `detail_synced_at`, and
  `readme_synced_at` values that preserve source freshness or force live
  refresh; import time is not used as a fake freshness timestamp.
- Import preserves database invariants: exactly one selected Area, no orphaned
  `area_repository_pins`, no workspaces without repositories, deterministic Area
  ID collision handling, and rollback on partial failure.
- Renderer query invalidation after import uses existing events or explicitly
  documented new events.
- Gateway secret migration acceptance inspects raw `area_gateways.record_json`
  rows and focused credential-store behavior, not only renderer-visible
  summaries.

## Validation Commands

For this doc-only pass:

```bash
bunx prettier --check docs/wip/sync-and-data-boundaries.md
```

Before closing implementation work in this repository:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Focused validation to add or run during later implementation phases:

```bash
bun run test -- src/main/ipc/registerControlIpc.test.ts
bun run test -- src/preload/index.test.ts
bun run test -- src/shared/ipc.test.ts
bun run test -- src/main/storage.test.ts
bun run test -- src/main/github/readCache.test.ts
bun run test -- src/main/github/provider.test.ts
bun run test -- src/main/areas/areaManager.test.ts
bun run test -- src/renderer/src/App.test.tsx
bun run test -- src/renderer/src/hooks/repositoryRefresh.test.ts
```

Later changes that touch Local Repository GitHub enrichment or Area
invalidation should add/run focused renderer coverage around
`src/renderer/src/components/local-repository/LocalRepositoryPage.tsx` query
inputs and `src/renderer/src/components/shell/AppEventBridge.tsx` Area events.
Gateway secret migration should add raw storage assertions in
`src/main/storage.test.ts` plus focused gateway credential tests.

Do not call `vitest` directly. Do not add tests under `tests/e2e` unless a
later task explicitly asks for E2E coverage.
