# Multi-Area Source Switcher Plan

Control should stop treating GitHub as the only top-left source and move to an
Area model. An Area is a repository source and browsing context: a GitHub
account, a local folder root, and later an SSH folder root. The switcher should
let the user jump between Areas, add new ones, and open repositories in the
right context.

This document narrows the first implementation milestone to **local GitHub**:
keep the existing GitHub account as the default Area, add local folder Areas,
discover Git repositories on disk, detect GitHub remotes, and let the user open
the matching GitHub repository explicitly. SSH Areas and true multi-account
GitHub can follow once the Area model is stable.

The global search bar should remain global. It should search across Areas and
repositories, show the Area icon or label on each result, and route directly
into the selected Area and repository. Search does not become Area-only
behavior.

## Current Shape

The app is still keyed around GitHub repository identity:

- routes use `nameWithOwner`
- pins store `name_with_owner`
- recent items store `provider: "github"` and GitHub-shaped item keys
- `AppState` exposes one global GitHub auth record and one `viewer`
- the sidebar search mixes cached GitHub repositories and remote GitHub search
- local cache tables store GitHub repository summaries and GitHub read models

The first Area pass should not try to untangle every GitHub-specific surface at
once. It should introduce Area identity beside the existing GitHub flow, then
migrate navigation, pins, recents, and repository lists in controlled slices.

## Goals

- Replace the hard-coded top-left GitHub source affordance with an Area
  switcher.
- Preserve the current single GitHub account behavior as a default GitHub Area.
- Add local folder Areas that recursively discover Git repositories.
- Detect GitHub remotes in local repositories and expose an explicit
  `Open in GitHub Area` action.
- Render cached Area and repository data immediately when available, then
  refresh in the background.
- Route local repositories by stable local repository id, not by `owner/repo`.
- Keep local repository browsing read-only in this milestone.
- Avoid storing secrets outside the existing keychain-backed GitHub token path.

## Non-Goals For The First Milestone

- SSH Areas.
- Multiple simultaneous GitHub accounts.
- Inline GitHub Issues, Pull Requests, or Actions inside a local repository
  page.
- File-path global search.
- Local Git mutations such as commit, checkout, pull, push, branch creation, or
  staging.
- JJ-specific modeling. JJ should be handled by the dedicated JJ plan after the
  plain Git local Area model lands.

## Product Model

An Area represents the source context the user is browsing.

```ts
type AreaKind = "github" | "local" | "ssh";

interface AreaSummary {
  id: string;
  kind: AreaKind;
  label: string;
  subtitle: string | null;
  rootPath: string | null;
  accountLogin: string | null;
  health: AreaHealth;
  repositoryCount: number;
  selected: boolean;
  createdAt: string;
  updatedAt: string;
}
```

For the first milestone:

- GitHub Area id can be deterministic, for example `github:default`.
- Local Area id should be stable for a selected root path, for example a hash of
  the normalized absolute path.
- SSH remains part of the type vocabulary but should not appear in the UI until
  implemented.

Area health should be explicit:

```ts
type AreaHealthStatus =
  | "ready"
  | "scanning"
  | "offline"
  | "needs-auth"
  | "error";

interface AreaHealth {
  status: AreaHealthStatus;
  message: string | null;
  checkedAt: string | null;
}
```

## Repository Model

Area repository identity must not assume GitHub.

```ts
type AreaRepositoryKind = "github" | "git";

interface AreaRepositorySummary {
  id: string;
  areaId: string;
  kind: AreaRepositoryKind;
  name: string;
  owner: string | null;
  displayName: string;
  path: string | null;
  defaultBranch: string | null;
  currentBranch: string | null;
  isDirty: boolean | null;
  isPrivate: boolean | null;
  description: string | null;
  connection: GitHubRemoteConnection | null;
  updatedAt: string | null;
  scannedAt: string | null;
}

interface GitHubRemoteConnection {
  owner: string;
  repo: string;
  nameWithOwner: string;
  remoteName: string;
  remoteUrl: string;
  url: string;
  matchedGitHubAreaId: string | null;
}
```

Repository ids should be stable within an Area:

- GitHub repositories can use `github:${accountLogin}:${owner}/${repo}` or a
  deterministic equivalent.
- Local repositories can use `local:${areaId}:${relativePathHash}`.
- Worktrees should be distinct local repository records when their working tree
  roots differ, even if they share a Git common directory.

The local repository detail should be read-only but useful:

```ts
interface AreaRepositoryDetail extends AreaRepositorySummary {
  remotes: GitRemoteSummary[];
  branches: GitBranchSummary[];
  status: GitStatusSummary;
  recentCommits: GitCommitSummary[];
  readme: AreaFileContent | null;
}
```

## Routing

Add Area-aware routes without removing the existing GitHub route shape in the
same pass.

Suggested transitional shape:

```ts
type AppRoute =
  | { kind: "home"; areaId?: string }
  | { kind: "repositories"; areaId?: string }
  | { kind: "organizations"; areaId?: string }
  | { kind: "mailbox"; areaId?: string }
  | { kind: "repository"; areaId: string; repositoryId: string; tab: RepositoryTab }
  | { kind: "githubRepository"; nameWithOwner: string; tab: RepositoryTab }
  | { kind: "codeBrowser"; areaId: string; repositoryId: string; path: string; ref: string | null };
```

The final route model should collapse `githubRepository` back into the Area
repository route once all existing GitHub repository call sites have been
migrated.

Transition rules:

- existing deep GitHub flows can continue to call `goToRepository(nameWithOwner)`
  until their call sites are migrated
- new local repository entry points must use `areaId + repositoryId`
- `Open in GitHub Area` should route to the existing GitHub repository route
  using the resolved `nameWithOwner`
- browser-style file navigation should stay provider-specific behind a shared
  route helper instead of constructing URLs in components

## Shared IPC Surface

Add an `areas` surface to `ControlApi`:

- `listAreas()`
- `getArea(areaId)`
- `selectArea(areaId)`
- `createLocalArea(input)`
- `removeArea(areaId)`
- `refreshArea(areaId)`
- `searchAreas(input)`
- `listAreaRepositories(input)`
- `getAreaRepository(input)`
- `listAreaContents(input)`
- `getAreaFileContent(input)`
- `listAreaBranches(input)`
- `listAreaRemotes(input)`
- `getAreaStatus(input)`
- `listAreaActivity(input)`
- `openLocalFolderPicker()`
- `onAreasUpdated(callback)`
- `onAreaRepositoryUpdated(callback)`

Keep existing GitHub IPC intact during the first slice. A later multi-account
slice should change GitHub auth IPC from global singleton assumptions to
account-scoped operations:

- keep `signInWithGitHub`
- add `listGitHubAccounts`
- add `signOutGitHubAccount(accountId)`
- move `viewer` from a global `AppState` field to the selected GitHub Area
  detail or a login-keyed account cache

## Storage

Keep the current GitHub cache tables for GitHub detail panels, but add
provider-neutral storage for Areas.

```sql
CREATE TABLE areas (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  root_path TEXT,
  account_login TEXT,
  selected INTEGER NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL,
  health_message TEXT,
  health_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE area_repositories (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  owner TEXT,
  display_name TEXT NOT NULL,
  path TEXT,
  default_branch TEXT,
  current_branch TEXT,
  is_dirty INTEGER,
  is_private INTEGER,
  description TEXT,
  connection_json TEXT,
  summary_json TEXT NOT NULL,
  detail_json TEXT,
  scanned_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

CREATE TABLE area_repo_snapshots (
  area_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (area_id, repository_id, snapshot_key)
);
```

Existing pins and recents should be migrated, not replaced abruptly.

New pin input:

```ts
interface RepositoryPinInput {
  areaId: string;
  repositoryId: string;
}
```

New recent item fields:

```ts
interface LocalRecentItem {
  areaId: string | null;
  repositoryId: string | null;
  provider: "github" | "local";
}
```

Migration behavior:

- create `github:default` Area at startup if none exists
- copy existing pinned `owner/repo` records to `areaId = "github:default"`
- preserve old pin APIs until renderer migration is complete
- map old recent GitHub items to `github:default` where possible

## Local Discovery

When adding a local Area:

- use Electron's native folder picker from the main process
- normalize the selected path with `realpath`
- create the Area immediately in `scanning` state
- recursively discover Git repositories under the selected root
- prune heavy/generated directories
- detect normal `.git` directories
- detect worktrees through `.git` files containing `gitdir:`
- avoid descending into nested `.git` internals
- record scan errors on the Area instead of failing the entire app state

Ignore directory names:

- `.git`
- `node_modules`
- `dist`
- `build`
- `.next`
- `.turbo`
- `.cache`
- `coverage`
- `target`
- `vendor`
- `.venv`
- `venv`
- `__pycache__`

Discovery should be bounded:

- cap traversal depth initially, for example 8 levels below the selected root
- cap repository count per Area initially, for example 500
- stream or batch repository updates so a large folder does not block the UI
- store partial results as they are found

## Local Git Adapter

Add a main-process `LocalRepositoryManager` with a Git adapter.

The adapter can use Git CLI for metadata:

- `git rev-parse --show-toplevel`
- `git rev-parse --git-common-dir`
- `git symbolic-ref --short HEAD`
- `git rev-parse --abbrev-ref --symbolic-full-name @{u}`
- `git status --porcelain=v1 --branch`
- `git remote -v`
- `git branch --format=...`
- `git log --date=iso-strict --format=... -n 30`

Rules:

- all commands run with explicit `cwd`
- never invoke a shell string when an argv list is possible
- use timeouts so hung hooks, credential prompts, or network-backed filesystems
  do not freeze refresh
- set environment to avoid interactive prompts where applicable
- treat command failures as repository health, not process crashes
- do not run network commands during passive local refresh

Local code browsing should read from the working tree filesystem in this
milestone, not from Git object storage. Deleted or missing files should surface
as unavailable states.

## GitHub Remote Resolution

Local repositories should parse remotes and detect GitHub URLs.

Supported forms:

- `https://github.com/owner/repo.git`
- `https://github.com/owner/repo`
- `git@github.com:owner/repo.git`
- `ssh://git@github.com/owner/repo.git`

Resolution output:

- normalized `owner/repo`
- matched remote name
- original remote URL
- canonical `https://github.com/owner/repo`
- matching GitHub Area id if the app has one

For the first milestone, GitHub connection is a link, not inline enrichment:

- local repository header shows a GitHub connection badge when resolved
- `Open in GitHub Area` opens the matching GitHub repository route
- if no GitHub Area is authenticated, show `Open on GitHub` as an external link
- do not load Issues, Pulls, Actions, or Releases inside the local route yet

## Refresh Policy

Use the same cache-first principle as GitHub:

- on cached Area list hit, render immediately
- start background refresh for selected Area after render
- update Area health and repository rows as refresh completes
- on true miss, show scanning state and hydrate progressively

Refresh triggers:

- app startup refreshes the selected Area opportunistically
- selecting an Area refreshes it if stale
- pressing refresh forces an Area scan
- adding a local Area starts scan immediately

Staleness defaults:

- Area repository list: 5 minutes
- selected local repository metadata: 30 seconds
- selected local file tree: 10 seconds
- selected local file content: 10 seconds

File watching can be added only for the currently open local repository. Do not
add recursive watchers for every configured Area in the first milestone.

## Renderer UX

Replace the top-left provider button with an Area switcher:

- show the current Area icon and label
- include the default GitHub Area
- include local folder Areas
- include `Add local folder`
- keep `Add GitHub account` visually present only when multi-account work starts
- hide or disable `Add SSH root` until SSH is implemented

GitHub Area behavior:

- keeps current Home, Repositories, Organizations, and Mailbox surfaces
- keeps current GitHub repository tab set
- keeps current GitHub OAuth settings path

Local Area behavior:

- Home shows local repositories, recently opened local repos, and connected
  GitHub remotes
- Repositories shows local repository list for the selected folder root
- Repository route uses local tabs: `Code`, `Branches`, `Remotes`, `Status`,
  `Activity`
- Repository header shows folder path, branch, dirty state, and GitHub remote
  connection
- File viewer starts with text files and binary placeholder states

Global search:

- searches Area labels
- searches GitHub cached repositories
- searches local Area repositories
- shows the Area label on every repository result
- preserves duplicates when the same repo exists in GitHub and local Areas
- routes to the selected Area's repository, not just `owner/repo`

## Migration Strategy

Implement in layers:

1. Add shared Area types and storage with default `github:default` migration.
2. Add Area IPC and renderer queries while keeping old GitHub calls alive.
3. Add Area switcher using default GitHub Area only.
4. Add local folder picker and local Area creation.
5. Add local repository scanning and Area repository list.
6. Add local repository route and read-only local tabs.
7. Add GitHub remote detection plus `Open in GitHub Area`.
8. Migrate pins, recents, and global search to Area identity.
9. Remove legacy GitHub-only repository assumptions after equivalent Area paths
   are in place.

The app should remain usable after every layer. Avoid a branch that requires the
entire renderer to be converted before it runs.

## Testing

Unit coverage:

- Area id generation from GitHub login and local root path
- default GitHub Area migration
- pin and recent migration from GitHub-only records
- local repository discovery and ignore pruning
- worktree detection for `.git` file indirection
- Git remote parsing and GitHub URL normalization
- GitHub Area link resolution
- local Git command output parsing
- bounded scan behavior for large roots
- unified search ranking and duplicate-by-Area handling

Renderer coverage:

- Area switcher rendering
- selecting GitHub Area preserves current GitHub surfaces
- adding a local folder creates scanning state
- local repository list renders cached rows before refresh completes
- local repository tabs render adaptive local tabs
- global search shows mixed Area and repository results
- `Open in GitHub Area` routes to the GitHub repository

Integration coverage:

- seeded default GitHub Area and one local Area
- nested folder root containing normal repositories and worktrees
- local repo with no GitHub remote
- local repo with HTTPS GitHub remote
- local repo with SSH GitHub remote
- scan error does not crash app state
- cache-first local open followed by background-refresh updates

Do not add Playwright e2e coverage unless the implementation slice explicitly
requires it.

## Risks

- Route churn is the highest renderer risk. Keep the old GitHub route helper
  alive until each major surface has an Area-aware replacement.
- Recursive scanning can become expensive. Bound traversal, skip known heavy
  directories, and persist partial results.
- Git commands can hang on odd repositories or network filesystems. Use
  timeouts and non-interactive execution.
- Duplicate repository identities are expected. Search and pins must display
  Area context instead of deduplicating by `owner/repo`.
- Local file reads can race with user edits. Treat missing or changed files as
  refreshable state, not fatal errors.

## Assumptions

- "Local GitHub" means local folder repositories with GitHub remote detection
  and explicit navigation to the GitHub Area.
- The first local repository implementation is plain Git only.
- Local Areas are read-only in v1.
- Multiple GitHub accounts are supported by the model but deferred in
  implementation.
- SSH Areas are part of the long-term Area model but deferred until local Areas
  are reliable.
