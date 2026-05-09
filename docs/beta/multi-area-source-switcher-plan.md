# Multi-Area Source Switcher Plan

Control should stop treating GitHub as the only top-left source and move to an Area model. An Area is a workspace source: a GitHub account, a local folder root, or an SSH folder root. The switcher should let the user jump between Areas, add new ones, and open repositories in the right context.

The global search bar should remain global. It should search across Areas and repositories, show the Area icon or logo on each result, and route directly into the selected Area and repository. Search does not switch to Area-only behavior.

## Goals

- Replace the hard-coded top-left `GitHub` button with an Area switcher.
- Support multiple GitHub accounts in Control using the same OAuth app registration.
- Support local folder-root Areas that recursively discover repositories.
- Support SSH folder-root Areas that rely on the user's existing SSH config, keys, and agent.
- Render cached data immediately when available, then refresh in the background.
- Detect GitHub remotes in local and SSH repositories and offer an explicit `Open in GitHub Area` action.

## Shared Model and IPC

Add provider-neutral shared types for:

- `AreaKind = "github" | "local" | "ssh"`
- `AreaSummary`
- `AreaConnection`
- `AreaHealth`
- `AreaRepositorySummary`
- `AreaRepositoryDetail`

Add provider-neutral repo panels for local and SSH:

- `Code`
- `Branches`
- `Remotes`
- `Status`
- `Activity`

Update routing and UI state so repository navigation is keyed by `areaId` and `repositoryId` instead of GitHub `nameWithOwner` alone.

Add a new `areas` surface to `ControlApi`:

- `listAreas`
- `createGitHubArea`
- `createLocalArea`
- `createSshArea`
- `removeArea`
- `selectArea`
- `searchAreas`
- `listAreaRepositories`
- `getAreaRepository`
- `listAreaContents`
- `getAreaFileContent`
- `listAreaBranches`
- `listAreaRemotes`
- `getAreaStatus`
- `listAreaActivity`
- `onAreasUpdated`
- `onAreaRepositoryUpdated`

Change GitHub auth IPC from single-account assumptions to account-scoped operations:

- keep `signInWithGitHub`
- add `listGitHubAccounts`
- add `signOutGitHubAccount(accountId)`
- remove the assumption that `AppState` contains one global GitHub auth record and one global `viewer`

## Storage and Backend

Keep the current GitHub cache tables for GitHub detail panels, but add provider-neutral storage for the Area system:

- `areas`
- `area_repositories`
- `area_repo_snapshots`

`area_repo_snapshots` should hold cached directory and file payloads so local and SSH code browsing can use the same cache-first behavior as GitHub.

Add a startup migration for the legacy single-account GitHub flow:

- read the existing keychain token
- validate it once
- store it under a login-keyed credential entry
- create a default GitHub Area for that account
- preserve current behavior for upgraded users

Store multiple GitHub tokens keyed by login in the keychain. Each GitHub Area should reference one stored account.

Populate `area_repositories` from both GitHub refreshes and local or SSH scans so repository search and repository lists can become unified without rewriting all GitHub detail code first.

## Scanning and Refresh

### Local Areas

When adding a local Area:

- use a native folder picker
- create the Area immediately in a `scanning` state
- recursively discover Git repositories under the selected root
- prune heavy and generated directories such as `.git`, `node_modules`, `dist`, `build`, `.next`, `coverage`, `target`, common cache directories, and virtual environments
- detect both standard repositories and Git worktrees by supporting `.git` directories and `.git` files with `gitdir:` indirection

### SSH Areas

When adding an SSH Area:

- collect an SSH host alias and a remote path
- assume the user already has a working SSH connection such as `ssh box-dev`
- do not store passwords or manage keys in Control
- normalize the remote root with `ssh <alias> 'cd <path> && pwd'`
- run repository discovery and metadata commands remotely via `ssh` and `git`
- apply the same ignore rules and worktree detection used for local Areas

### Repository Metadata

For local and SSH repositories, collect:

- working-tree file structure from the filesystem or remote filesystem
- Git metadata from CLI commands: root, current branch, detached state, remotes, upstream, ahead or behind state, worktree status, recent commits
- README content from the working tree when present

The code viewer should handle text files in v1. Binary files should render an unavailable or placeholder state.

### Refresh Policy

Use the same lazy-load pattern as GitHub:

- on a cached hit, render immediately from SQLite and start a background refresh
- on a stale or partial hit, render what exists and stream updates into the UI as refresh results land
- on a true miss, show loading state and hydrate progressively as scan results arrive

For local Areas, add lightweight file watching only for the currently open repository. SSH Areas should stay access-triggered and should not use persistent remote watchers in v1.

## Renderer UX

Replace the top-left provider button with an Area switcher:

- show the current Area icon and label
- include sections for existing Areas
- include actions for `Add GitHub account`, `Add local folder`, and `Add SSH root`

Keep the global search bar in the top bar. It should search:

- Area entries
- repository entries across all Areas

Each result should show the Area icon or logo. The same repository can appear more than once if it exists in different Areas or under different GitHub accounts.

View behavior:

- GitHub Areas keep the current `Home`, `Repositories`, `Organizations`, and `Mailbox` behavior
- local and SSH Areas get Area-aware `Home` and `Repositories` views backed by the unified Area index
- GitHub repositories keep the current tab set
- local and SSH repositories use adaptive tabs: `Code`, `Branches`, `Remotes`, `Status`, `Activity`

If a local or SSH repository maps to a GitHub remote on `github.com`, show an `Open in GitHub Area` action in the repository header. That action should route into the matching GitHub Area and repository when available. GitHub enrichment stays explicit and link-based; local and SSH views do not inline GitHub Issues, PRs, or Actions data in v1.

## Test Plan

Unit coverage:

- multi-account keychain migration from the legacy single-token flow
- local repository discovery and ignore pruning
- worktree detection for `.git` file indirection
- SSH path normalization and remote command composition
- GitHub remote parsing and GitHub Area link resolution
- unified search ranking and duplicate-by-Area handling

Renderer and component coverage:

- Area switcher rendering and add-entry flows
- global search showing mixed Area and repository results with icons
- adaptive local and SSH repo tabs
- cache-first open followed by background-refresh updates

Integration and E2E coverage:

- seeded API state with multiple GitHub Areas, one local Area, and one SSH Area
- nested folder roots containing normal repositories and worktrees
- open a local repository from cache and verify UI updates after background refresh
- verify `Open in GitHub Area` for a local repository with a GitHub upstream

## Assumptions

- "Full parity" for local and SSH means first-class repository browsing inside the same app shell, not a promise of GitHub Issues, PRs, Actions, or other GitHub-only panels.
- Search scope in v1 is Areas and repositories only. File-path search is out of scope.
- Local and SSH Areas are read-only in v1.
- Multiple GitHub accounts are supported, but only one device-flow sign-in should run at a time.
