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
- GitHub CLI commands are executed with file/argument arrays, never shell interpolation.
- Tokens are never sent to the renderer.

## Provider Boundary

The renderer talks to a provider-shaped IPC surface. GitHub is the only runtime provider in V1, but the UI uses normalized objects so Azure DevOps can be added later.

The V1 default credential provider is `gh-cli`. It:

- Resolves the GitHub CLI path from settings, `PATH`, or common macOS install paths.
- Verifies auth with `gh auth status --hostname github.com`.
- Reads and writes through `gh api`.
- Uses GitHub REST API version `2026-03-10` for REST calls.

GitHub App OAuth is modeled in settings and keychain helpers. Runtime API execution remains disabled until the packaged OAuth flow is completed.

## Local Storage

The store tries to use `better-sqlite3` in the app user data directory. If the optional native module is unavailable during development, Control falls back to in-memory storage so the UI can still launch.

SQLite tables:

- `settings`
- `accounts`
- `cache_entries`
- `recent_items`
- `pinned_repositories`

Secrets:

- GitHub App OAuth tokens are stored with `keytar`.
- GitHub CLI mode never persists the token.

## Caching

The main process applies short TTL cache entries for repository summaries, repository detail, contents, issues, PRs, actions, projects, releases, and contributors. Mutations invalidate renderer query caches.

## Packaging

V1 targets macOS packaging through `electron-builder`. Windows and Linux are left as architecture-compatible future targets, but are not V1 acceptance platforms.

