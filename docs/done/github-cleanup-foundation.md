# GitHub Cleanup Foundation

This document records the cleanup-v2 work that has landed and should be treated
as the current baseline. The old beta audit and cleanup checklist mixed
completed work with remaining work; only completed behavior belongs here.

## Completed

- GitHub OAuth and token handling stay in the main process.
- The renderer receives typed auth state through IPC and does not receive raw
  GitHub tokens.
- Startup no longer blocks the whole app on a live viewer request when a usable
  cached state exists.
- Auth update events flow from main to preload to renderer with cleanup-aware
  subscriptions.
- `App.tsx` has been reduced to an app shell instead of owning every repository
  surface.
- Repository tabs have been extracted into domain modules for Code, Issues,
  Pull requests, Actions, Discussions, Projects, Releases, Contributors, Wiki,
  Security and Quality, Settings, and Agents.
- Command palette, mailbox, organizations, settings, sidebar, topbar, dialogs,
  and shell event handling have moved out of the monolithic app component.
- Repository query keys and mutation invalidation helpers are centralized enough
  that mutation success no longer requires a broad two-phase refresh block.
- Repository warm prefetch has a focused default set for Code, Issues, Pull
  requests, and Actions.
- Mock data has been split into domain fixtures with a small barrel export.
- IPC registration has moved out of `src/main/index.ts` into route registration
  helpers.
- PR review thread pagination and discussion comment pagination are implemented
  in provider domain code.
- Domain-specific GitHub cache TTLs exist.
- Viewer profile data can be cached and reused for warm startup.

## Current Baseline

The cleanup baseline is modular, typed, and cache-aware, but not finished. Future
work should preserve these boundaries:

- Main process owns GitHub credentials, provider calls, cache policy, storage,
  and IPC registration.
- Preload exposes a narrow typed bridge.
- Renderer code consumes shared serializable contracts and availability-bearing
  `*WithStatus` results where availability matters.
- Tab-specific state stays with the tab module, not the app shell.
- Mock and test data should stay domain-scoped.

## Known Passed Validation

The cleanup audit recorded this targeted validation as passing:

```bash
bun run test -- src/renderer/src/App.test.tsx src/main/github/octokitProvider.test.ts src/main/ipc/registerControlIpc.test.ts src/preload/index.test.ts src/renderer/src/components/repository/repositoryTabPrefetch.test.ts src/main/github/providerAuthScheduler.test.ts
bun run typecheck
bun run lint
bun run format:check
```

Full final validation for later cleanup work still belongs with the relevant WIP
document.
