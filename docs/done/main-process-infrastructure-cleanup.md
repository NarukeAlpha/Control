# Main Process Infrastructure Cleanup Record

## Scope

This plan covers process-boundary and reliability issues in the Electron main process. The fixes here should be handled
before renderer polish because these paths can execute local Git/JJ work, read local files, start gateway processes, or
decide whether user data persists.

## MAIN-01: Enforce Gateway Operation Confirmation In Main

### Current Evidence

- Shared contract requires a confirmation bit:
  - `src/shared/areas.ts:316` defines `AreaGatewayRunOperationInput`.
  - `src/shared/areas.ts:319` includes `confirmed: boolean`.
- IPC parsing accepts the payload but only normalizes the boolean:
  - `src/main/areas/registerAreaIpc.ts:362` defines `requireRunGatewayOperationInput`.
  - `src/main/areas/registerAreaIpc.ts:366` sets `confirmed: input?.confirmed === true`.
- Main execution ignores the parsed confirmation:
  - `src/main/areas/areaManager.ts:459` defines `runGatewayOperation`.
  - `src/main/areas/areaManager.ts:464` calls `gatewayClient.runOperation(input)` without checking `input.confirmed`.
- The current renderer asks for confirmation with a blocking browser dialog:
  - `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx:208` calls `window.confirm`.
  - `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx:211` sends `confirmed: true`.

### Failure Mode

The permission check lives only in renderer behavior. A buggy renderer, test fixture, or compromised renderer process can
call `areas:run-gateway-operation` with `confirmed: false` and still execute the prepared local/SSH operation.

This violates the process-boundary rule: renderer UI may request privileged work, but main must enforce the invariant.

### Proposed Change

1. Reject unconfirmed runs in `AreaManager.runGatewayOperation` before `gatewayClientForArea`.
2. Keep the IPC parser strict enough to preserve a false value instead of silently coercing arbitrary input into false.
3. Add a main-process unit test in `src/main/areas/areaManager.test.ts` proving:
   - `confirmed: false` rejects.
   - `confirmed: false` does not call `gatewayClient.runOperation`.
   - `confirmed: true` preserves the existing happy path.
4. Optionally replace renderer `window.confirm` with an app modal in `RENDER-07`, but do not treat UI confirmation as a
   substitute for this main-process guard.

### Verification

- `bun run test -- src/main/areas/areaManager.test.ts`
- `bun run typecheck`
- Manual code inspection: `AreaManager.runGatewayOperation` has an explicit `input.confirmed !== true` rejection.

## MAIN-02: Replace Lossy Gateway Operation Mapping With An Exhaustive Contract

### Current Evidence

- Shared operation union advertises many operation kinds:
  - `src/shared/areas.ts:276` starts `AreaGatewayOperationKind`.
  - `src/shared/areas.ts:277-291` includes `git.fetch`, `git.pull`, `git.push`, `git.commit`,
    `git.branch.create`, `git.branch.checkout`, `jj.git.fetch`, `jj.git.push`, `jj.new`, `jj.describe`,
    `jj.commit`, `jj.bookmark.create`, `jj.bookmark.move`, `jj.undo`, and `jj.redo`.
- IPC duplicates an allowlist:
  - `src/main/areas/registerAreaIpc.ts:391` defines `requireOperationKind`.
  - `src/main/areas/registerAreaIpc.ts:392-407` repeats the operation names.
- Gateway client collapses most operations to fetch:
  - `src/main/areas/gatewayClient.ts:412` defines `gatewayOperationInput`.
  - `src/main/areas/gatewayClient.ts:414-418` maps only suffix `.push` to `PUSH`, suffix `.status` to `STATUS`,
    and every other operation to `FETCH`.
  - `src/main/areas/gatewayClient.ts:419-423` sends only `repository`, `vcs`, and `operation`.
- Gateway run uses only the confirmation id:
  - `src/main/areas/gatewayClient.ts:157` defines `runOperation`.
  - `src/main/areas/gatewayClient.ts:173` sends `{ confirmationId: input.operationId }`.

### Failure Mode

The app tells callers that commit, pull, branch, bookmark, undo, redo, and describe are supported, but the provider
currently sends most of them as `FETCH` and drops operation arguments. That is contract drift between `src/shared`,
IPC validation, and the gateway GraphQL API. The risk is not only poor UX; the wrong operation can be previewed or run.

### Proposed Change

1. Define one exhaustive operation map in main, close to `GatewayClient`, with a `satisfies Record<AreaGatewayOperationKind, ...>`
   check so TypeScript fails when the shared union changes.
2. Represent unsupported operations honestly:
   - either remove them from `AreaGatewayOperationKind` until implemented, or
   - keep them in the union but return a typed unsupported operation error before calling the gateway.
3. Carry validated arguments through the mapping for operations that require them.
4. Derive the runtime IPC allowlist from the same source as the gateway mapping; do not keep a hand-copied `Set`.
5. Add tests in `src/main/areas/gatewayClient.test.ts`:
   - every shared operation maps to the expected gateway operation or rejects as unsupported.
   - branch/bookmark/commit arguments are either passed through or rejected with a specific missing-argument error.

### Verification

- `bun run test -- src/main/areas/gatewayClient.test.ts src/main/areas/registerAreaIpc.test.ts`
- `bun run typecheck`
- Manual code inspection: there is no default `FETCH` fallback for unrelated operations.

## MAIN-03: Clean Up Partially Started Gateway Processes And SSH Tunnels

### Current Evidence

- Local gateway startup detaches the process:
  - `src/main/areas/gatewayManager.ts:211` enters the local startup `try`.
  - `src/main/areas/gatewayManager.ts:212-230` spawns the gateway with `{ detached: true, stdio: "ignore" }`.
  - `src/main/areas/gatewayManager.ts:232` calls `child.unref()`.
  - `src/main/areas/gatewayManager.ts:234` waits for and normalizes the manifest.
  - `src/main/areas/gatewayManager.ts:252-256` removes token files in `finally`, but does not stop the child on a
    manifest timeout or malformed manifest.
- Remote gateway startup also leaves detached work behind:
  - `src/main/areas/gatewayManager.ts:307-322` starts a remote `nohup` gateway.
  - `src/main/areas/gatewayManager.ts:324` polls the remote manifest.
  - `src/main/areas/gatewayManager.ts:332-344` spawns the local SSH tunnel detached.
  - `src/main/areas/gatewayManager.ts:345` calls `tunnel.unref()`.
  - `src/main/areas/gatewayManager.ts:361-365` cleans remote token files, not provisional process/tunnel handles.
- The outer failure path records failed state only:
  - `src/main/areas/gatewayManager.ts:80-94` catches startup failures and calls `failedGatewayRecord`.

### Failure Mode

If manifest polling or normalization fails after process spawn, the app records an error but may leave a gateway process
or SSH tunnel running. Detached processes make this harder to notice and harder to recover from. Concurrent starts can
also race if two calls observe stale gateway state.

### Proposed Change

1. Track provisional child and tunnel handles before any manifest polling.
2. On every post-spawn failure:
   - stop the local child by pid/process handle when available.
   - stop the remote gateway through admin URL if it became available, otherwise through SSH best-effort pid cleanup.
   - stop the SSH tunnel by pid/process handle.
3. Add a per-area startup lock in `GatewayManager.ensureAreaGateway` so duplicate starts reuse the same promise.
4. Record cleanup failures in the failure message or logs without hiding the original start failure.
5. Add tests around:
   - local manifest timeout after spawn kills the child.
   - remote manifest timeout best-effort cleans remote process.
   - SSH tunnel spawn followed by malformed manifest kills the tunnel.
   - concurrent `ensureAreaGateway` calls only start once.

### Verification

- `bun run test -- src/main/areas/gatewayManager.test.ts`
- `cargo test` if the manifest/startup protocol changes.
- Manual failure simulation with a fake gateway binary that never writes a manifest.

## MAIN-04: Stop Silently Downgrading Durable Storage Failures To Memory Storage

### Current Evidence

- Store creation wraps SQLite import, open, schema bootstrap, and token migration in one catch:
  - `src/main/storage/localStoreAdapter.ts:212` defines `createLocalStore`.
  - `src/main/storage/localStoreAdapter.ts:217-221` imports `better-sqlite3`, opens `control.sqlite`, creates the
    SQLite store, and migrates legacy gateway tokens.
  - `src/main/storage/localStoreAdapter.ts:223-225` catches any error, logs a warning, and returns `MemoryLocalStore`.

### Failure Mode

A real durable-storage failure can look like a normal empty app. The app can accept writes that disappear on restart.
That breaks the local-first reliability requirement and makes partial migration failures hard to recover from.

### Proposed Change

1. Split failure classes:
   - optional dependency unavailable in test/dev environments
   - SQLite open failure
   - schema/migration failure
   - keychain migration failure
2. Allow memory storage only for explicit test/dev configuration, not for general production bootstrap failures.
3. Return or throw a typed durable-storage error from `createLocalStore`.
4. Surface a degraded/fatal state in app bootstrap rather than silently starting with volatile storage.
5. Update tests in `src/main/storage.test.ts`:
   - dependency unavailable can use memory only when explicitly allowed.
   - schema failure is fatal.
   - migration failure is fatal or enters a typed recovery state.

### Verification

- `bun run test -- src/main/storage.test.ts`
- Manual smoke test with an unreadable `control.sqlite` path proves the UI exposes durable-storage failure instead of
  booting into an empty memory store.

## MAIN-05: Distinguish Keychain Failure From Signed-Out Auth

### Current Evidence

- GitHub token read catches keychain errors:
  - `src/main/github/credentials.ts:46` defines `getGitHubToken`.
  - `src/main/github/credentials.ts:52-54` loads keytar and reads the token.
  - `src/main/github/credentials.ts:55-57` logs and returns `null` on any keychain error.
- Provider treats null as signed out:
  - `src/main/github/provider.ts:306` defines `createAppState`.
  - `src/main/github/provider.ts:308` reads the token.
  - `src/main/github/provider.ts:311` enters the no-token signed-out path.

### Failure Mode

The app cannot distinguish "no token is stored" from "the OS keychain is unavailable or corrupted." Users may be asked
to sign in again even though re-authentication cannot persist or the original token may still exist.

### Proposed Change

1. Replace `Promise<string | null>` with a discriminated credential result, or throw a typed keychain error that provider
   bootstrap handles explicitly.
2. Keep "no token" as a normal signed-out state.
3. Surface "credential store unavailable" separately in `AppState` and auth UI.
4. Add tests around:
   - no token returns signed-out.
   - keychain load failure returns auth-storage failure.
   - keychain read failure does not clear cached authenticated viewer state without an explicit sign-out.

### Verification

- `bun run test -- src/main/github/credentials.test.ts src/main/github/provider.test.ts`
- Manual startup with mocked keytar failure shows an auth storage error, not a normal sign-in prompt.

## MAIN-06: Harden Local File Reads Against Symlink Escape

### Current Evidence

- Directory listing identifies symlinks:
  - `src/main/areas/localFiles.ts:1` imports `stat`, not `lstat`.
  - `src/main/areas/localFiles.ts:13` reads directory entries with `withFileTypes`.
  - `src/main/areas/localFiles.ts:28-29` labels symbolic links as `symlink`.
- File content follows symlinks:
  - `src/main/areas/localFiles.ts:47` defines `readLocalFileContent`.
  - `src/main/areas/localFiles.ts:51` resolves a path inside the root by string.
  - `src/main/areas/localFiles.ts:52` calls `stat`, which follows symlinks.
  - `src/main/areas/localFiles.ts:67` reads the file path.
- Root guard is string-based only:
  - `src/main/areas/localFiles.ts:89` defines `resolveInsideRoot`.
  - `src/main/areas/localFiles.ts:90-95` compares `resolve(root, requestedPath)` to the root prefix.

### Failure Mode

A symlink inside a repository can point outside the repository. The string guard accepts the symlink path, then `stat`
and `readFile` follow it. That can expose arbitrary local files readable by the app process.

### Proposed Change

1. Use `lstat` before reading content and return an unavailable state for symlink file reads, or compare
   `realpath(root)` and `realpath(target)` before any read.
2. Keep directory listing behavior explicit: symlink rows can appear, but content preview should not follow them unless
   the target realpath is proven inside root.
3. Add tests in a new or existing local files test:
   - symlink to outside root is listed as `symlink`.
   - reading that symlink returns unavailable.
   - symlink to an inside-root file is either rejected consistently or allowed only after realpath validation.
4. Apply the same policy to local file search if future search starts reading symlink content.

### Verification

- `bun run test -- src/main/areas/localFiles.test.ts src/main/areas/localFileSearch.test.ts`
- Manual fixture with `ln -s /etc/hosts repo/hosts-link` cannot preview `/etc/hosts`.

## MAIN-07: Make Branch Protection Mutation Semantics Non-Destructive

### Current Evidence

- Shared mutation type makes branch protection fields optional:
  - `src/shared/github.ts:2001` defines `RepositoryAdministrationMutationInput`.
  - `src/shared/github.ts:2002-2012` allows `updateBranchProtection` with only `branch` required and all protection
    fields optional.
- Main mutation performs a full GitHub `PUT`:
  - `src/main/github/mutationDomain.ts:307` handles `updateBranchProtection`.
  - `src/main/github/mutationDomain.ts:308-323` sends all GitHub protection fields, defaulting omitted values to
    `null` or `false`.

### Failure Mode

The IPC contract says callers may send a partial update. The provider sends a full replacement request. A caller that
omits status checks, restrictions, or review fields can clear existing branch protection.

### Proposed Change

1. Choose one of two valid models:
   - full replacement: require every field at the IPC/shared contract boundary and make the renderer fetch/merge current
     state before submit.
   - patch model: route partial changes to GitHub's narrower branch-protection subresource endpoints.
2. Add a parser test in `registerGithubIpc.test.ts` proving invalid partial payloads are rejected if full replacement
   is chosen.
3. Add a mutation-domain test proving omitted fields do not become destructive defaults unless the caller explicitly
   requested full replacement.
4. Coordinate with `RENDER-01`, which fixes the renderer branch-protection form state.

### Verification

- `bun run test -- src/main/ipc/registerGithubIpc.test.ts src/main/github/mutationDomain.test.ts`
- Manual review: there is no `payload.field ?? null` default for a field that the caller did not explicitly own.

## MAIN-08: Consolidate IPC Input Parsing Primitives

### Current Evidence

- Area IPC owns local parser helpers:
  - `src/main/areas/registerAreaIpc.ts:287-388` includes repository, contents, gateway, string, and optional string
    validators.
- GitHub IPC owns parallel parser helpers:
  - `src/main/ipc/registerGithubIpc.ts:689-735` includes repository/file/read validators.
  - `src/main/ipc/registerGithubIpc.ts:1410-1599` includes positive integers, string fields, nullable fields, arrays,
    booleans, and JSON object/value validation.
- The repository directive says duplicate behavior should be extracted into shared abstractions when behavior duplicates
  existing logic.

### Failure Mode

The same IPC boundary behavior is implemented with different helper names, error styles, and mutation patterns. That
raises maintenance cost and makes new routes more likely to copy one-off validation.

### Proposed Change

1. Create a main-process IPC parsing helper module, for example `src/main/ipc/ipcInput.ts`.
2. Move reusable primitives there:
   - `isRecord`
   - `requireRecord`
   - `requireTrimmedString`
   - `optionalTrimmedString`
   - `requirePositiveInteger`
   - `optionalPositiveInteger`
   - `optionalBoolean`
   - `requireStringArray`
   - JSON value/object helpers
3. Keep domain composition local. `requireRepositoryInput` can remain GitHub-specific; it should call shared primitives.
4. Avoid mutating parser input records unless a route explicitly needs normalized fields. Prefer returning normalized
   typed objects.
5. Add focused tests for the shared parser primitives, then update area and GitHub IPC tests to prove route behavior
   remains unchanged.

### Verification

- `bun run test -- src/main/ipc`
- `bun run typecheck`
- `rg -n "function requireTrimmedString|function requirePositiveInteger|function isRecord" src/main` shows one owner for
  shared primitives, with domain-specific wrappers only where justified.

## MAIN-09: Clarify The GitHub IPC Route Registration Wrapper

### Current Evidence

- `src/main/ipc/registerGithubIpc.ts:289` exports `registerGithubIpc`.
- `src/main/ipc/registerGithubIpc.ts:293` exports `createGithubIpcRoutes`.
- Production registration composes GitHub routes through Control IPC:
  - `src/main/ipc/registerControlIpc.ts:194` spreads `createGithubIpcRoutes(github)`.
  - `src/main/index.ts:162` calls `registerControlIpc`.
- Search shows `registerGithubIpc` is used by tests, not by production bootstrap.

### Failure Mode

There are two apparent registration entry points for GitHub IPC, but only one production path. This makes route
ownership ambiguous and encourages future code to register the same routes twice.

### Proposed Change

1. Rename `registerGithubIpc` to a test-specific helper, or remove it and have tests call `registerIpcRoutes` with
   `createGithubIpcRoutes`.
2. Keep `createGithubIpcRoutes` as the single production composition API.
3. Update tests so their names reflect route creation rather than production registration.

### Verification

- `bun run test -- src/main/ipc/registerGithubIpc.test.ts src/main/ipc/registerControlIpc.test.ts`
- `rg -n "registerGithubIpc" src/main tests` shows either no wrapper or test-only naming.
