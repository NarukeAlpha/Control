# Control Architecture

Control is an Electron + React desktop app with a narrow, typed bridge between renderer UI and privileged host operations.

## Process Model

- `src/main` owns windows, GitHub provider execution, local storage, external links, and credential orchestration.
- `src/preload` exposes a small `window.control` API with typed IPC methods.
- `src/renderer` is a React app. It cannot access Node APIs, raw tokens, or arbitrary shell execution.
- `src/shared` contains serializable TypeScript contracts shared by all processes.

## Security Rules

- Renderer sandboxing remains enabled.
- `contextIsolation` remains enabled.
- `nodeIntegration` remains disabled.
- External links must be `https://` and are opened by the main process.
- Tokens are never sent to the renderer.

## Provider Boundary

The renderer talks to a typed IPC surface that is shaped around GitHub management workflows. GitHub is the only runtime provider in V1. Azure DevOps and other providers remain planning-only work in their own documents.

The V1 credential provider is GitHub OAuth device flow:

- `src/main/github/webOAuth.ts` requests and polls GitHub device authorization.
- `src/main/github/credentials.ts` stores the resulting access token with `keytar`.
- `src/main/github/provider.ts` owns credential loading, cache reads, background refreshes, and provider lifetime.
- `src/main/github/octokitProvider.ts` performs privileged GitHub REST and GraphQL calls through Octokit.
- REST calls use GitHub REST API version `2022-11-28`.

App state startup is intentionally non-blocking when a GitHub token exists. The main process returns an
authenticated shell immediately, hydrates the viewer from the local `github-viewer` account cache when
available, and validates the token/viewer in the background. When live validation completes, the main process
emits a typed `github:auth-updated` event so the renderer can replace the warm cached viewer or surface an auth
failure without delaying local pins, recents, cached repositories, or offline navigation.

The renderer calls typed methods from `src/shared/ipc.ts` and `src/shared/github.ts`. It never receives the raw token and never constructs Octokit. Operations that open GitHub.com remain explicit fallback actions and still go through the main-process external-link handler.

## GitHub Management Surfaces

The current in-app GitHub scope includes repository lists and details, code browsing, issues, pull requests, Actions, releases, discussions, projects, notifications, organizations, teams, repository settings basics, wiki availability, security and quality signals, branch/tag browsing, file search, repository pins, and local recents.

Each promoted surface should expose loading, empty, unavailable, permission-denied, stale, success, and mutation failure states where the workflow needs them. External GitHub links remain escape hatches for unsupported deep editing or GitHub APIs that are unavailable to the token.

## Local Storage

The store tries to use `better-sqlite3` in the app user data directory. If the optional native module is unavailable during development, Control falls back to in-memory storage so the UI can still launch.

SQLite tables:

- `settings`
- `accounts`
- `cache_entries`
- `recent_items`
- `pinned_repositories`

Secrets:

- GitHub OAuth access tokens are stored with `keytar`.
- Local pins, recents, cache entries, and repository read models are not synced.

## Caching

The main process applies domain-specific TTL cache entries for GitHub reads and stores repository summaries/details in SQLite for fast reopens. Fast-moving queues such as notifications, Actions runs, issues, and pull requests expire quickly, while stable metadata such as branches, tags, labels, wiki pages, security policy files, contributors, and workflow definitions can stay warm longer. Repository list and detail reads support a cache-only path so local repository navigation can keep working while signed out or offline. When cached data is returned during an authenticated session, the main process may refresh it in the background. Cache-only reads must not load a GitHub token or start privileged GitHub API work.

Mutations invalidate renderer query caches and, where needed, provider cache prefixes so refreshed data comes from GitHub rather than stale local state.

## Packaging

V1 targets macOS packaging through `electron-builder`. Windows and Linux are left as architecture-compatible future targets, but are not V1 acceptance platforms.
