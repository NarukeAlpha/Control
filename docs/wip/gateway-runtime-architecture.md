# Gateway Runtime Architecture

Control should treat local and SSH repository access as a main-process gateway
runtime. The renderer may request Area and repository workflows, but it must not
own process spawning, SSH, runtime paths, keychain lookup, gateway tokens, or raw
gateway protocol details.

This pass narrows the implementation plan around the code that exists today:

- `src/main/areas/areaManager.ts` owns Area workflows and decides whether a
  local/SSH Area uses gateway-backed reads or local fallback reads.
- `src/main/areas/gatewayManager.ts` currently owns runtime discovery, local
  process spawn, SSH deploy/start, SSH tunnels, token generation, manifest
  polling, status probing, and stop requests.
- `src/main/areas/gatewayClient.ts` owns the HTTP GraphQL client used by
  `AreaManager`.
- `crates/control-gateway` is the Rust runtime. Its CLI accepts `--root`,
  `--host`, `--port`, `--admin-port`, `--token`, and `--manifest` today, but
  `--token` must be replaced before the credential-storage work is complete so
  gateway secrets do not appear in process listings.
- `src/main/storage/areaGatewayStore.ts` persists complete gateway records as
  JSON in `area_gateways.record_json` and publishes renderer-safe summaries via
  `area_gateways.summary_json`.
- `src/main/github/credentials.ts` is the existing keytar-backed credential
  model for GitHub OAuth tokens.

## Current State

- Gateway records are persisted in SQLite through `LocalStore.getAreaGateway`,
  `setAreaGateway`, and `clearAreaGateway`.
- `AreaGatewayRecord` currently includes `apiToken` and `adminToken`, so gateway
  secret material is stored inside SQLite `area_gateways.record_json`.
- The renderer only receives `AreaGatewaySummary` through `AreaSummary.gateway`;
  the summary does not expose tokens.
- IPC routes are typed and explicit:
  - `areas:prepare-gateway-operation`
  - `areas:run-gateway-operation`
  - `areas:stop-gateway`
- There is no generic `runGatewayCommand` route today. Do not add one.
- Local gateway startup uses `spawn` and an on-disk manifest under
  `app.getPath("userData")/Control/gateways/<safe-area-id>/manifest.json`.
- SSH gateway startup shells out to `ssh`/`scp`, copies a local binary when one
  is available, starts the remote runtime with `nohup`, and creates local SSH
  port forwards for the public and admin ports.
- `createLocalStore()` is async, but `SqliteLocalStore` construction and
  `bootstrapSqliteSchema()` are synchronous today. Any keytar-backed gateway
  token migration must run as an explicit async startup step after schema
  bootstrap and before `GatewayManager` can start; it must not be hidden inside
  the synchronous constructor.
- No platform service manager is used today. Any reference to launchd, systemd,
  Windows services, auto-start, or signed service registration is future work
  unless the implementation explicitly adds it.
- Packaged-app runtime delivery is not implemented. `package.json` only includes
  `out/**/*` and `package.json`; `GatewayManager.resolveGatewayBinary` currently
  relies on `CONTROL_GATEWAY_BINARY` or Cargo target paths.

## Target Ownership

### Renderer

Files:

- `src/renderer/src/**`
- `src/preload/index.ts`
- `src/shared/ipc.ts`
- `src/shared/areas.ts`

Responsibilities:

- Call typed Area IPC methods through `window.control.areas`.
- Render `AreaGatewaySummary`, `AreaHealth`, operation previews, operation
  results, and typed recovery states.
- Never receive gateway `apiToken`, `adminToken`, keytar account names, SSH
  command lines, local child process IDs used for control, or raw gateway
  manifests.
- Never construct gateway URLs manually. URLs in `AreaGatewaySummary` are display
  and diagnostics metadata, not authority to bypass main-process APIs.
- Treat `adminUrl` as privileged diagnostics metadata. The preferred shared
  contract removes `adminUrl` from renderer-facing summaries after admin auth is
  implemented. If a later diagnostics UI keeps it, the public and admin loopback
  endpoints must already be authenticated and renderer code still must call
  typed IPC for lifecycle actions.

### Main Process

Files:

- `src/main/index.ts`
- `src/main/areas/areaManager.ts`
- `src/main/areas/gatewayManager.ts`
- `src/main/areas/gatewayClient.ts`
- new `src/main/areas/gatewayCredentials.ts`
- new focused helpers only if they keep `gatewayManager.ts` from continuing to
  own unrelated runtime, SSH, credential, and manifest concerns.

Responsibilities:

- Own gateway lifecycle decisions for local and SSH Areas.
- Generate and rotate gateway credentials.
- Store gateway credentials through keytar.
- Resolve, verify, spawn, stop, and eventually update runtime artifacts.
- Own SSH deployment, tunneling, remote manifest reads, and remote stop behavior.
- Translate gateway protocol and process failures into typed shared failure
  variants before they cross IPC.
- Persist only non-secret gateway metadata to SQLite.
- Redact gateway secrets before logging, throwing, persisting, or returning
  messages. Redaction covers bearer headers, token handoff paths when they are
  secret-bearing, SSH commands, raw manifests, and process arguments.

### Rust Gateway Runtime

Files:

- `crates/control-gateway/src/cli.rs`
- `crates/control-gateway/src/server.rs`
- `crates/control-gateway/src/api.rs`
- `crates/control-gateway/src/operations.rs`

Responsibilities:

- Serve repository discovery, contents, status, operation preview, operation
  execution, and operation events.
- Require the configured token on `/graphql` and `/events`.
- Keep the admin listener separate from the public listener.
- Require a configured admin credential on `/stop`; loopback binding is a
  network exposure reduction, not an authorization boundary.
- Keep the manifest JSON limited to non-secret runtime facts:
  `apiUrl`, `graphqlUrl`, `eventsUrl`, `adminUrl`, `version`, `pid`,
  `tokenRequired`, and `startedAt`.
- Accept gateway secrets through a channel that does not expose token values in
  local or remote process listings. Prefer a permissioned token file under the
  gateway state directory, passed as a `--token-file`/`--admin-token-file` path,
  or a one-shot stdin/bootstrap pipe. The Rust CLI should keep `--token` only as
  a deprecated development compatibility path until all TypeScript start paths
  have moved off command-line token values.

Current gap: `/stop` is unauthenticated in `crates/control-gateway/src/server.rs`
even though `GatewayManager.stopGateway` sends `adminToken` when present. The
implementation must either add admin-token enforcement to the runtime or stop
storing/sending `adminToken`. Prefer enforcing the admin token because local SSH
tunnels expose the admin port on loopback and loopback is not a sufficient
authorization model.

This plan keeps separate API and admin credentials. Do not simplify to one
shared token unless the implementation also removes `adminToken` from TypeScript
types, keytar account names, migration, failure modes, rotation, and acceptance
criteria in the same pass.

## Storage And Cache Boundaries

### SQLite

SQLite owns durable, reconstructable metadata:

- Area identity and display state in `areas`.
- Gateway metadata in `area_gateways`.
- Repository/workspace read models derived from gateway discovery in
  `area_repositories` and `area_workspaces`.
- Snapshot/cache data in `area_repo_snapshots` and
  `area_workspace_snapshots`.

`area_gateways.record_json` should contain:

- `areaId`
- `rootPath`
- `transport`
- `host`
- `username`
- `port`
- `apiUrl`
- `adminUrl`
- `serviceName`
- `version`
- `status`
- `pid`
- `processId`
- `message`
- `installedAt`
- `lastStartedAt`
- `lastSeenAt`
- `updatedAt`
- a non-secret credential version or state marker, if needed
- a non-secret gateway failure code or failure phase, if needed for diagnostics

`area_gateways.record_json` must not contain:

- `apiToken`
- `adminToken`
- raw bearer headers
- keytar account names if those account names include secret material
- SSH private keys, passphrases, or future PAT/provider tokens

`area_gateways.summary_json` remains derived through
`src/main/storage/mappers.ts::areaGatewaySummary`. Feature code must not parse
raw gateway JSON or manually shape gateway summaries.

Migration code needs a separate legacy API because
`src/main/storage/areaGatewayStore.ts::getAreaGateway` should parse into the
post-migration `AreaGatewayRecord`, which no longer has token fields. Add a
focused legacy helper in the storage layer, for example:

- `listLegacyAreaGatewayTokenRecords(db): AreaGatewayLegacyTokenRecord[]`
- `rewriteAreaGatewayRecordWithoutTokens(db, areaId): void`
- `hasLegacyAreaGatewayTokens(db): boolean`

`AreaGatewayLegacyTokenRecord` may include `apiToken` and `adminToken`, but it
must stay local to the migration helper. Tests must inspect raw
`area_gateways.record_json` to prove token fields are removed after successful
migration and retained only when keytar migration is explicitly pending.

### Credential Store

Add `src/main/areas/gatewayCredentials.ts` with the same loading discipline as
`src/main/github/credentials.ts`:

- Dynamically import `keytar`.
- Validate the imported module shape before use.
- Keep service/account constants in one module.
- Do not expose tokens outside the main process.

Use a per-Area account naming scheme that is deterministic and does not include
the secret value:

- service: `Control Gateway Credentials`
- API account: `gateway:<areaId>:api`
- admin account: `gateway:<areaId>:admin`

Required functions:

- `getGatewayCredentials(areaId): Promise<{ apiToken: string; adminToken: string } | null>`
- `setGatewayCredentials(areaId, credentials): Promise<void>`
- `clearGatewayCredentials(areaId): Promise<void>`
- `rotateGatewayCredentials(areaId): Promise<{ apiToken: string; adminToken: string }>`

Production behavior when keytar is unavailable:

- Local and SSH gateway provisioning must fail with
  `credential-store-unavailable`.
- Do not fall back to SQLite token storage.
- Do not start an unauthenticated gateway.

Test/dev behavior:

- Existing GitHub token code has `CONTROL_E2E` support for reading a test token
  from the environment. Gateway credentials should not add a broad environment
  fallback unless a test requires it. Unit tests should prefer mocking
  `gatewayCredentials.ts`.

### Secret Handoff

Moving tokens to keytar is necessary but not sufficient. Gateway startup must
also avoid passing token values through `spawn` arguments, SSH command strings,
shell history, or remote `ps` output.

Required handoff model:

- Local startup writes API and admin tokens to permissioned files under
  `app.getPath("userData")/Control/gateways/<safe-area-id>/secrets/` using mode
  `0600` where supported, then starts the runtime with token-file paths instead
  of token values.
- SSH startup writes token files under the remote gateway state directory using
  restrictive permissions, for example via `scp` to a temporary filename plus
  remote `chmod 600` and atomic rename, then starts the runtime with remote
  token-file paths.
- The Rust runtime reads token files during bootstrap and never writes token
  values to the manifest, logs, GraphQL errors, or admin responses.
- Startup cleanup removes local temporary token files after a successful handoff
  when the runtime no longer needs them. Remote cleanup removes temporary files
  on deploy/start failure. Persistent runtime-owned token files may remain only
  if they are required for restart and are protected by file permissions.
- If token-file creation, permissioning, transfer, or runtime token load fails,
  start fails with `credential-store-unavailable`, `credential-missing`, or
  `runtime-spawn-failed`/`ssh-deploy-failed` as appropriate. Do not retry by
  passing token values on the command line.

### Cache

Gateway protocol responses should not be stored in `cache_entries`. Area
repository and workspace data should continue to flow through the Area storage
modules:

- `src/main/storage/areaRepositoryStore.ts`
- `src/main/storage/areaWorkspaceStore.ts`
- `src/main/storage/areaSnapshotStore.ts`

If a gateway is unavailable, cached Area repository/workspace data may remain
visible as stale local data, but refresh failures must be explicit in
`AreaHealth` and must not be mistaken for successful live gateway refresh.

## Runtime Lifecycle Contract

Keep lifecycle ownership in main-process modules. The first implementation pass
should not add OS service managers. It should make the current detached-process
and SSH-tunnel model correct, observable, and token-safe.

Lifecycle states use existing `AreaGatewayStatus` values:

- `not-installed`
- `starting`
- `ready`
- `stopped`
- `error`

Required lifecycle actions:

- Seed metadata when a local or SSH Area is created.
- Ensure runtime for refresh and repository workflows.
- Verify an existing ready record by making an authenticated gateway request.
- Start a local runtime.
- Start an SSH runtime and local tunnels.
- Stop through the admin API.
- Repair by clearing runtime connection metadata, preserving Area metadata, and
  restarting.
- Rotate credentials by stopping the gateway, replacing keytar credentials,
  clearing connection metadata, and starting again.
- Remove by stopping the gateway, deleting keytar credentials, and clearing
  gateway metadata when the Area is removed.

Startup readiness must be tied to the process just started, not just to any
manifest file that happens to exist:

- Delete the local manifest before spawn and delete or move aside the remote
  manifest before `nohup`.
- Record the attempted `lastStartedAt` and reject manifests whose `startedAt` is
  missing, malformed, or older than that timestamp.
- For local start, require the manifest `pid` to match the spawned child PID
  when both are available. A mismatch is `manifest-invalid`.
- For SSH start, require a remote `pid`, verify the public and admin ports parse
  from the remote manifest, then verify the local tunnel reaches both forwarded
  endpoints before marking ready.
- Require `tokenRequired === true` whenever credentials were configured. A
  false or missing value is `manifest-invalid` and must not mark the gateway
  ready.
- Validate `apiUrl`, `graphqlUrl`, `eventsUrl`, and `adminUrl` as loopback URLs
  with expected paths and ports before persisting them.
- Clear `apiUrl`, `adminUrl`, `pid`, and `processId` after manifest timeout,
  invalid manifest, auth verification failure, or tunnel verification failure
  so stale connection data is not treated as usable.

Stop and configuration-change semantics:

- `GatewayManager.stopGateway()` must not persist `status: "stopped"` after a
  401, credential lookup failure, network failure, or non-2xx `/stop` response.
  It should persist the closest typed failure and keep previous connection
  metadata for diagnostics unless repair/remove explicitly clears it.
- `AreaManager.removeArea()` owns gateway shutdown before deleting a local or SSH
  Area. It should attempt stop, clear keytar credentials, clear gateway metadata,
  and then remove the Area. If stop fails during removal, the UI should receive a
  typed failure unless the user chose a force-remove path that deliberately
  leaves or clears runtime metadata.
- `AreaManager.updateArea()` must not ignore stop failures before changing
  gateway configuration. If root, host, username, or port changes and stop fails,
  the update should fail with a typed gateway lifecycle error, or use an explicit
  force-reconfigure path that records the old runtime as orphaned before writing
  new metadata.

SSH cleanup criteria:

- If manifest polling, manifest validation, auth verification, or tunnel
  verification fails after an SSH tunnel process is spawned, kill the local
  tunnel process and clear `processId`.
- If a later refresh proves the SSH tunnel is down, mark the gateway error,
  clear forwarded local URLs, and attempt to terminate the recorded local tunnel
  process before retrying.
- Remote runtime cleanup remains best-effort unless the admin endpoint is
  reachable. Do not claim a remote process stopped unless `/stop` succeeds or a
  future remote process verification proves it exited.

Defer until a separate packaging/service pass:

- launchd/systemd/Windows service registration
- autostart on login
- remote system service installation
- background update daemons

## Runtime Artifact Resolution

Current resolution in `GatewayManager.resolveGatewayBinary` is development-only:

1. `CONTROL_GATEWAY_BINARY`
2. `target/debug/control-gateway`
3. `target/release/control-gateway`
4. `crates/control-gateway/target/debug/control-gateway`
5. `crates/control-gateway/target/release/control-gateway`

The implementation should replace this with a resolver that preserves
`CONTROL_GATEWAY_BINARY` for development and tests, then supports packaged app
resources:

1. If `CONTROL_GATEWAY_BINARY` is set, require it to be executable and use it.
2. In packaged apps, resolve from `process.resourcesPath/control-gateway/`.
3. In development, keep the current Cargo target fallbacks.
4. Before spawn or SSH copy, verify executable permissions and compare packaged
   artifacts against a SHA-256 manifest generated by the release build.

Packaged integrity must have a trust anchor:

- The release build generates the gateway binary and a SHA-256 manifest before
  electron-builder packages the app.
- The manifest lives in packaged resources, for example
  `process.resourcesPath/control-gateway/manifest.json`, and records binary
  filename, platform, architecture, gateway version, and SHA-256 digest.
- Integrity verification trusts the signed/notarized app bundle that contains
  both the JavaScript code and manifest. A mutable manifest beside a mutable
  binary outside packaged resources is not a sufficient security check.
- Development `CONTROL_GATEWAY_BINARY` and Cargo target fallbacks may skip the
  packaged manifest, but must still verify executability and must be labeled as
  development/test paths in diagnostics.

Packaging work must update `package.json`/electron-builder config to include the
gateway artifact before packaged gateway support can be considered complete.
Until then, the document should describe packaged runtime delivery as unbuilt,
not as a completed product capability.

## IPC Contracts

Keep gateway IPC explicit in `src/shared/ipc.ts`, `src/preload/index.ts`, and
`src/main/areas/registerAreaIpc.ts`.

Existing routes stay:

- `areas:prepare-gateway-operation`
- `areas:run-gateway-operation`
- `areas:stop-gateway`

Add routes only for real lifecycle actions:

- `areas:repair-gateway`
- `areas:rotate-gateway-credentials`
- `areas:restart-gateway`

Do not add a catch-all command route. Each route must have:

- a literal channel in `ipcChannels`
- a method on `ControlApi["areas"]`
- a shared input type in `src/shared/areas.ts`
- parser coverage in `registerAreaIpc.ts`
- preload exposure in `src/preload/index.ts`
- tests in `src/main/areas/registerAreaIpc.test.ts` and
  `src/preload/index.test.ts`

Introduce a shared tagged failure type rather than relying on raw thrown
`Error.message` strings:

```ts
export type AreaGatewayFailureCode =
  | "credential-store-unavailable"
  | "credential-missing"
  | "credential-rejected"
  | "runtime-not-found"
  | "runtime-integrity-failed"
  | "runtime-spawn-failed"
  | "manifest-timeout"
  | "manifest-invalid"
  | "ssh-unavailable"
  | "ssh-deploy-failed"
  | "ssh-command-failed"
  | "ssh-tunnel-failed"
  | "gateway-unreachable"
  | "gateway-unauthorized"
  | "gateway-protocol-error"
  | "gateway-version-mismatch"
  | "admin-stop-failed";

export interface AreaGatewayFailure {
  code: AreaGatewayFailureCode;
  areaId: string;
  phase: "credential" | "resolve" | "install" | "start" | "verify" | "operate" | "stop" | "remove";
  message: string;
  retryable: boolean;
}
```

Implementation detail: IPC invoke handlers may still throw internally, but the
main-process boundary should map known gateway errors into `AreaHealth.message`,
operation `status: "failed"` results, or typed lifecycle result objects before
they reach the renderer. Unknown errors should be logged in main and surfaced as
`gateway-protocol-error` or the closest specific code without leaking tokens,
command lines containing tokens, or raw manifests.

Redaction is part of the IPC contract. Tests should prove renderer-visible
errors and logs do not include bearer headers, token-file contents, CLI
arguments containing tokens, raw manifest JSON, SSH command strings with tokens,
or secret account names. Deterministic non-secret keytar account IDs such as
`gateway:<areaId>:api` may appear only when they do not include secret material.

## Failure Modes

| Failure                    | Detection point                                          | Persisted state                                         | Renderer behavior                                                      |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| keytar unavailable         | `gatewayCredentials.ts` load/set/get                     | gateway `status: "error"`; no tokens in SQLite          | show credential-store failure and retry after OS keychain is available |
| credential missing         | credential lookup before verify/start/stop               | keep metadata, mark error                               | offer repair or rotate credentials                                     |
| credential rejected        | authenticated `/graphql`, `/events`, or `/stop` is 401   | mark error, keep connection metadata for diagnostics    | offer rotate credentials; do not retry unauthenticated                 |
| runtime not found          | artifact resolver                                        | mark `not-installed` or `error`                         | explain build/install requirement; do not clear Area                   |
| integrity mismatch         | artifact resolver                                        | mark error                                              | block start; require reinstall/update                                  |
| secret handoff failed      | token-file write/chmod/copy/runtime load                 | mark error; no command-line token fallback              | show credential/runtime setup failure                                  |
| local spawn failed         | local start                                              | mark error                                              | show process start failure                                             |
| manifest timeout/invalid   | manifest polling/validation                              | clear `apiUrl`/`adminUrl`/`pid`/`processId`, mark error | offer retry/repair                                                     |
| SSH command/deploy failure | SSH mkdir/scp/chmod/nohup/cat                            | mark error                                              | show host/path/permission-focused recovery text                        |
| SSH tunnel failure         | local tunnel spawn or verify                             | clear local forwarded URLs, mark error                  | offer retry; keep remote metadata                                      |
| gateway unreachable        | verify request fails                                     | mark stopped or error based on action                   | show stale data if available and refresh failure                       |
| gateway protocol error     | GraphQL errors or invalid payloads                       | keep runtime state, fail operation                      | show operation-specific failure                                        |
| version mismatch           | manifest version differs from supported gateway protocol | mark error                                              | offer update/repair                                                    |
| admin stop failure         | `/stop` fails                                            | keep previous metadata plus message                     | show stop failure; allow force repair/remove metadata                  |

Local Areas may keep the current fallback to direct local reads when gateway
refresh fails, but the UI must still know the gateway failed. SSH Areas have no
direct local fallback and must surface an error state.

Exact local fallback contract:

- `AreaManager.refreshGatewayArea()` may call direct local discovery for
  `area.kind === "local"` after a gateway failure, but it must persist the
  gateway record as `status: "error"` with the typed gateway failure message.
- The fallback scan may update repository/workspace rows and `repositoryCount`,
  but it must not replace the Area health with a clean `ready` state. Use
  `AreaHealth.status: "offline"` with a message such as
  `Gateway unavailable; showing direct local data.` so the renderer can
  distinguish direct fallback data from live gateway data.
- SSH Areas have no equivalent fallback. A failed SSH gateway refresh leaves
  `AreaHealth.status: "error"` and does not present the Area as ready.
- Renderer copy may show cached or direct local repository data while the
  gateway is unhealthy, but sync operations that require the gateway stay
  disabled until gateway health returns to ready.

## Migration Sequence

### 1. Add Credential Module And Tests

- Add `src/main/areas/gatewayCredentials.ts`.
- Unit-test keytar module loading, set/get/clear, unavailable-keytar behavior,
  and no-token logging.
- Do not change runtime startup yet.

### 2. Add Async Startup Migration Gate

- Keep `SqliteLocalStore` construction synchronous: it should still call
  `bootstrapSqliteSchema()`, `ensureDefaultGitHubArea()`,
  `migrateLegacyRepositoryPins()`, and `migrateLegacyGitHubRecents()`.
- After constructing the SQLite store, `createLocalStore()` must await an async
  gateway-token migration before returning the store to `src/main/index.ts`.
  This makes startup ordering explicit: schema exists, legacy tokens migrate,
  then `GatewayManager` and `AreaManager` are created.
- If the implementation does not put the await inside `createLocalStore()`, it
  must expose an explicit `await migrateGatewayTokens(store)` startup gate in
  `src/main/index.ts` before `new GatewayManager(...)`. Do not hide keytar
  access inside `SqliteLocalStore`'s constructor.

### 3. Read Legacy SQLite Tokens, Write Keytar

- Add a migration helper in the storage/main layer that reads existing
  token-bearing gateway JSON through a legacy parser, not through the new
  `AreaGatewayRecord` type.
- For each record with legacy tokens, write them to keytar accounts
  `gateway:<areaId>:api` and `gateway:<areaId>:admin`.
- Rewrite the gateway record without token fields.
- If keytar is unavailable, leave legacy tokens untouched and mark migration as
  pending; do not delete the only copy.
- Emit no token values in logs.
- Add raw storage tests that read `area_gateways.record_json` directly and prove
  successful migration removes `apiToken` and `adminToken`.

This code should live in a focused gateway storage migration helper that accepts
the SQLite database adapter and the async credential module. It runs after
`bootstrapSqliteSchema()` and before gateway startup.

### 4. Update Types And Mappers

- Change `AreaGatewayRecord` in `src/main/storage/areaGatewayStore.ts` so new
  records do not include `apiToken` or `adminToken`.
- Keep a local legacy-read type inside the migration helper if needed.
- Remove `adminUrl` from `AreaGatewaySummary` unless a concrete diagnostics UI
  needs it after admin auth is in place. Keep `apiUrl` only as non-authoritative
  diagnostics metadata.
- Add mapper tests proving `summary_json` never contains tokens.

### 5. Make GatewayClient Credential-Aware

- Replace synchronous `GatewayManager.getClient(areaId)` with
  `async getClient(areaId)` or `async gatewayClientForArea(areaId)` so keytar
  lookup can happen before client creation.
- Construct `GatewayClient` with non-secret connection metadata plus the API
  credential loaded from `gatewayCredentials.ts`, or inject a main-process
  credential provider that `GatewayClient` awaits internally before each
  request. Prefer async creation because current call sites are already async.
- Update `AreaManager.gatewayClientForArea()`, `listContents()`,
  `getFileContent()`, `getSyncStatus()`, `prepareGatewayOperation()`,
  `runGatewayOperation()`, and `refreshGatewayArea()` so they await client
  creation and handle `credential-missing`/`credential-rejected` as typed
  failures.
- Add tests proving `GatewayClient` cannot send an unauthenticated `/graphql`
  request when a gateway record has `status: "ready"` and token-required
  metadata.

### 6. Update GatewayManager

- Replace direct token generation and record token reads in
  `src/main/areas/gatewayManager.ts` with `gatewayCredentials.ts`.
- `seedLocalArea` and `seedSshArea` should create metadata only; credentials are
  created lazily on first start or explicitly during seed if the implementation
  wants provisioning to fail early.
- `startLocalGateway` and `startSshGateway` must hand API and admin credentials
  to the Rust runtime through the secret handoff model, never through command
  arguments or persisted records.
- `gatewayResponds` must load credentials from the main credential module and
  must fail with `credential-missing` instead of probing unauthenticated when a
  ready record lacks credentials.
- `stopGateway` must use the admin credential and should fail with
  `credential-missing` when a ready/stoppable gateway has no admin credential.
- Clear connection metadata on start failure so stale ports are not treated as
  usable.

### 7. Authenticate Admin Stop In Rust

- Extend `crates/control-gateway/src/cli.rs` with
  `--token-file`/`--admin-token-file` or equivalent non-argv secret inputs.
- Update `crates/control-gateway/src/server.rs` so `/stop` requires the admin
  credential when configured.
- Keep `/graphql` and `/events` authorized by the API credential.
- Update manifest output to report only whether auth is required, never the
  token.
- Add Rust tests for missing, wrong, and correct admin credentials on `/stop`,
  plus missing and wrong API credentials on `/graphql` and `/events`.

### 8. Tighten IPC Failure Mapping

- Add shared failure codes in `src/shared/areas.ts`.
- Map known gateway errors in main before returning through
  `registerAreaIpc.ts`.
- Add parser/preload tests for any new lifecycle route.
- Update renderer states only after shared contracts are in place.
- Add redaction tests that force failures containing token-like values, bearer
  headers, raw manifests, SSH command strings, and token argv fragments, then
  assert none reach renderer-visible messages.

### 9. Package Runtime Artifact

- Add a build step that compiles `crates/control-gateway` for the host platform.
- Add electron-builder files/resource config so packaged apps include the
  runtime.
- Add SHA-256 manifest generation and verification.
- Keep `CONTROL_GATEWAY_BINARY` as the development/test override.

## Acceptance Criteria

- New gateway records no longer persist `apiToken` or `adminToken` in
  `area_gateways.record_json`.
- Existing SQLite gateway tokens migrate to keytar when keytar is available.
- Migration tests inspect raw `area_gateways.record_json`, not only
  `AreaSummary.gateway`, and prove token fields are removed only after keytar
  writes succeed.
- If migration cannot write keytar, legacy SQLite tokens are not silently
  deleted and gateway startup fails clearly rather than starting
  unauthenticated.
- `AreaGatewaySummary` and every renderer-facing IPC result remain token-free;
  `adminUrl` is removed from summaries unless a later authenticated diagnostics
  UI explicitly requires it.
- `GatewayClient` sends an auth header for every gateway request and cannot make
  unauthenticated requests to a token-required gateway.
- `GatewayClient` construction is async or credential-provider-backed, so
  keytar-backed credentials are not reintroduced into `AreaGatewayRecord`.
- Gateway startup does not pass API or admin token values through local process
  arguments, SSH command strings, or persisted manifests.
- Stale manifests cannot mark a gateway ready: start deletes or invalidates old
  manifests, checks `startedAt`, validates loopback URLs and `adminUrl`, verifies
  `pid` when applicable, and requires `tokenRequired === true`.
- Admin `/stop` is authenticated with the separate admin credential. Rust tests
  cover missing, wrong, and correct admin credentials, and public endpoint tests
  still cover missing and wrong API credentials for `/graphql` and `/events`.
- `GatewayManager.stopGateway()` does not persist a false stopped state after
  401, credential lookup failure, network failure, or non-2xx admin response.
- `AreaManager.removeArea()` stops local/SSH gateways, clears keytar
  credentials, clears gateway metadata, and only then removes Area state unless
  an explicit force-remove path is used.
- `AreaManager.updateArea()` does not ignore gateway stop failures before
  changing root, host, username, or port.
- Local gateway start, SSH gateway start, verify, stop, repair, and rotate have
  typed failure behavior.
- SSH failures preserve enough phase context to distinguish missing `ssh`,
  deploy failure, remote start failure, manifest timeout, and tunnel failure.
- SSH tunnels are verified before ready, and orphaned local tunnel processes are
  killed or cleared when startup, auth verification, refresh, or repair fails.
- Local Areas may show stale or direct local repository data after gateway
  failure, but their `AreaHealth` stays `offline` and their gateway summary
  records the failure.
- SSH Areas do not pretend to be ready when the gateway or tunnel is down.
- Packaged runtime support is not claimed until the binary is included in app
  resources, a release-build SHA-256 manifest is packaged with it, and
  verification trusts the signed app bundle rather than a mutable adjacent file.
- Renderer-visible errors and logs are redacted: no bearer headers, token
  values, token argv fragments, SSH command strings with secrets, raw manifests,
  or secret-bearing account names appear in validation fixtures.

## Validation Commands

For doc-only changes:

```bash
bunx prettier --check docs/wip/gateway-runtime-architecture.md
```

For TypeScript implementation:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

For Rust gateway changes:

```bash
cargo fmt --check
cargo test -p control-gateway
```

For packaged runtime changes:

```bash
bun run build
bun run package
```

Targeted tests to add or update:

- `src/main/areas/gatewayCredentials.test.ts`
- `src/main/areas/gatewayManager.test.ts`
- `src/main/areas/gatewayClient.test.ts`
- `src/main/areas/registerAreaIpc.test.ts`
- `src/main/storage.test.ts`
- `src/preload/index.test.ts`
- Rust tests in `crates/control-gateway/src/server.rs`

Do not add Playwright E2E coverage for this pass unless a later task explicitly
asks for end-to-end gateway workflow coverage.
