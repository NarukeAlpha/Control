# Last Frontier Completion

Completed on 2026-05-25.

This document records the completed implementation for the former `docs/wip/last-frontier.md` plan. The work
closed the remaining provider IPC, raw GitHub read, parser casting, manual export/import, app-data sync primitive,
and packaged gateway delivery gaps.

## Implemented Scope

### Provider IPC Centralization

- `src/main/ipc/registerControlIpc.ts` now owns Control app routes and appends `createGithubIpcRoutes(github)`.
- `src/main/ipc/registerGithubIpc.ts` owns the GitHub IPC route map for account, notification, repository/code,
  issue, pull request, discussion, workflow, project, security, release, contributor, search, and mutation routes.
- `registeredGithubIpcRouteKeys` is tested against `githubIpcRouteChannels` so route coverage stays in parity.
- GitHub route parser tests now live with GitHub IPC coverage for representative moved route payloads.

### Raw GitHub Read Twins

- Raw read channel constants such as `githubRepositories`, `githubBranches`, `githubTags`, `githubReleases`, and
  `githubSearch` were removed from the shared IPC channel map.
- `GitHubIpcRawReadTwinKeys` was removed.
- The renderer/preload GitHub IPC contract exposes status-bearing reads and mutations only.
- Raw read signatures that still power cache hydration and status wrappers are private to the main-process provider
  manager through `GitHubRawReadProvider`, with an owner comment explaining why they remain.

### Boundary Cast Cleanup

- Production `as unknown as TInput` parser casts were removed from IPC parser code.
- Command-palette organization and team closures now capture narrowed locals instead of casting selected values back
  to `OrganizationSummary` or `TeamSummary`.
- Command-palette tests cover organization project, organization member, and organization team member commands.

### Manual Export And Import

- `ControlApi` now exposes:
  - `previewDataExport(input)`
  - `exportData(input)`
  - `previewDataImport(input)`
  - `importData(input)`
- The preload bridge forwards all four methods through typed IPC channels.
- Export/import filesystem work is main-process owned.
- Export uses native save dialogs when no destination path is provided.
- Import preview/apply uses native open dialogs when no file path is provided.
- Export writes a plain minified JSON schema v1 archive through a temp file plus atomic rename.
- Archives include the manifest plus scoped settings, areas, pins, recents, GitHub metadata cache, Area cache, and
  snapshot cache placeholders.
- Local paths, gateway metadata, repository connection URLs, recent path/url/ref metadata, README cache, and private
  repository metadata are redacted or excluded unless explicitly scoped.
- OAuth tokens, gateway API/admin tokens, SSH private keys, and keychain material are blocked by design and tested.
- Import validates schema versions and malformed sections before applying durable data.
- Import applies supported durable sections first: settings, importable areas, pins, and recents.
- Cache and snapshot imports are skipped because they are reconstructable.
- Import results report imported, inserted, updated, skipped, remapped, and blocked counts.
- Settings includes a focused data panel. Export requires preview first; import requires file preview first; renderer
  code does not access the filesystem.

### Hosted App-Data Sync Primitive

- Hosted app-data sync has a shared status contract distinct from repository/VCS `AreaSyncStatus`.
- `src/main/storage/syncStrategy.ts` defines deterministic Last-Writer-Wins merge primitives for durable,
  non-secret app-data records.
- Merge records carry collection, stable id, value, `updatedAt`, optional `deletedAt`, and source device id.
- Equal timestamps resolve deterministically by source device id and value.
- Sync policy explicitly allows only settings, repository pins, Area pins, and recents.
- Secrets, provider cache, Area cache, snapshots, and gateway credentials are explicitly forbidden from hosted
  app-data sync.
- No background daemon was added before a remote contract exists.

### Gateway Packaged Runtime Delivery

- `scripts/package-control-gateway.cjs` builds `control-gateway` in release mode, copies the platform binary into
  `dist/control-gateway`, preserves executable permissions on non-Windows hosts, and writes a SHA-256 manifest.
- `scripts/verify-control-gateway-bundle.cjs` smoke-checks the generated bundle without `CONTROL_GATEWAY_BINARY`.
- `package.json` includes the gateway directory as an `electron-builder` `extraResources` bundle.
- `package.json` now has macOS, Windows, and Linux package scripts.
- Release CI packages native macOS, Windows, and Linux artifacts through an OS matrix.
- Gateway resolver tests cover packaged resolution, SHA mismatch failure, and Windows/Linux packaged binary names.

## Evidence

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `cargo test --workspace`
- `bun run build:gateway`
- `bun run verify:gateway-bundle`
- `bun run build`

`bun run test:e2e` was not required for this pass because no new e2e coverage was requested, and the changed
workflows are covered by unit tests, typechecking, the Rust workspace tests, the gateway bundle verifier, and the
production build.
