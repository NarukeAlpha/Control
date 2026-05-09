# JJ Local Repository GitHub Enrichment Plan

## Summary

Control should support local Jujutsu repositories as first-class local repositories, not as lazy links into a GitHub area. A local JJ repository should stay open inside the local area, show JJ-native local state first, and then inline GitHub-backed repository data when the repository can be resolved to a GitHub remote.

This document expands the earlier JJ plan into a thorough implementation spec grounded in JJ's official docs. The key correction is that JJ is not just "Git with different commands":

- JJ has first-class workspaces, not just one working copy.
- JJ uses bookmarks instead of an active branch concept.
- JJ has first-class conflicts and an operation log.
- Many JJ commands snapshot the working copy by default, which means naive "read" integrations can mutate the repo.
- JJ can be Git-backed and GitHub-connected, but some Git features remain partial or unsupported.

Because of that, Control should model JJ explicitly rather than forcing it into a Git-only local repository abstraction.

## Product Direction

- Keep the existing GitHub global surfaces for `Home`, `Repositories`, `Organizations`, and `Mailbox`.
- Add a local area that discovers local repositories, including JJ repositories.
- Keep a local JJ repository rooted in the local area even when it maps to GitHub.
- Render GitHub data inline inside the local JJ repository page instead of forcing a jump to a separate GitHub area.
- Treat `Open on GitHub` and `Open in GitHub area` as secondary actions, not the primary local flow.

## Scope For This Milestone

- Support local repositories only.
- Support both plain Git repositories and JJ repositories.
- Reuse the current single-account GitHub auth and current GitHub cache tables.
- Defer SSH areas and multi-account GitHub support until the hybrid local repository model is stable.
- Keep the local repo UI read-only in v1, except for the GitHub mutations that already exist in connected GitHub-backed tabs.

## JJ Capability Inventory

This section is the feature inventory Control must account for. The app does not need first-class UI for every item in v1, but the data model and refresh strategy must not break when these features exist in a repository.

### Core JJ Model

- Working copy as a commit: JJ treats the working copy as a real working-copy commit rather than a separate staging area.
- Automatic snapshotting: most JJ commands snapshot the working copy when it has changed.
- No staging area: Git index assumptions do not apply.
- Implicit file tracking: new files can be auto-tracked according to `snapshot.auto-track`.
- Change IDs and commit IDs: JJ exposes both and the UI should preserve both.
- Immutable commit protection: JJ can prevent rewriting immutable revisions unless explicitly overridden.
- Revsets: commit selection is a first-class query language.
- Filesets: file selection is a first-class query language.
- Templates: command output can be customized via the templating language, which is important for machine-friendly adapters.

### Workspace And Repository Topology

- `.jj` repository discovery.
- Multiple workspaces per repository via `jj workspace add/list/rename/forget/update-stale/root`.
- One repository can have multiple working copies checked out at different revisions.
- A workspace can become stale if another workspace rewrites its working-copy commit.
- Sparse working copies via `jj sparse`.
- Git-backed repositories can be colocated or non-colocated.
- A JJ repo can expose an underlying Git directory via `jj git root`.

### History And Graph Editing

- `jj new`
- `jj commit`
- `jj describe`
- `jj metaedit`
- `jj edit`
- `jj duplicate`
- `jj split`
- `jj squash`
- `jj absorb`
- `jj diffedit`
- `jj restore`
- `jj revert`
- `jj abandon`
- `jj rebase`
- `jj parallelize`
- `jj simplify-parents`
- `jj arrange`
- `jj prev`
- `jj next`
- `jj evolog`

These commands matter even if Control does not expose buttons for them, because they affect history shape, working-copy identity, descendant rebases, bookmark movement, and conflict creation.

### Conflicts, Recovery, And Safety

- First-class conflicts stored in commits, not just conflict markers in the working tree.
- Multi-sided conflicts, not only two-way conflicts.
- Conflict markers materialized into the working copy when needed.
- `jj resolve` for external merge resolution.
- `jj undo`
- `jj redo`
- `jj operation log/show/diff/revert/restore/integrate/abandon`
- Lock-free concurrency with divergent operations.

These features are central to JJ's model and should appear in Control as state, not as edge-case failures.

### Bookmarks, Tags, And Remotes

- Bookmarks replace Git branches as JJ's primary named pointer.
- There is no active/current checked-out bookmark.
- Local and remote bookmark tracking state matters.
- `jj bookmark advance/create/delete/forget/list/move/rename/set/track/untrack`
- `jj tag set/list/delete`
- `jj git remote add/list/remove/rename/set-url`

Control should use JJ-native naming and avoid calling these "branches" in JJ-specific local views.

### File And Inspection Features

- `jj status`
- `jj log`
- `jj show`
- `jj diff`
- `jj interdiff`
- `jj file annotate`
- `jj file list`
- `jj file search`
- `jj file show`
- `jj file track`
- `jj file untrack`
- `jj file chmod`

These commands shape the read model for code browsing, blame/annotate, change inspection, and file-level status.

### Git Interop And GitHub Workflows

- `jj git clone`
- `jj git init`
- `jj git import`
- `jj git export`
- `jj git fetch`
- `jj git push`
- `jj git colocation status/enable/disable`
- `jj git root`

JJ's GitHub workflow is bookmark-driven:

- bookmarks can be pushed explicitly
- bookmarks can be tracked or untracked
- JJ can generate bookmark names when pushing a change
- JJ does not currently have a direct `git pull` equivalent; fetch and rebase are separate steps

### Advanced Or Secondary Features

- `jj sign`
- `jj unsign`
- `jj bisect`
- `jj fix`
- `jj gerrit upload`
- `jj util gc`
- `jj util completion`
- `jj util config-schema`
- `jj util exec`
- `jj util markdown-help`
- `jj util snapshot`

These should be treated as known capabilities. They can remain out of scope for v1 UI, but Control should not assume they do not exist.

## JJ-Specific Constraints That Change The Architecture

### Non-Mutating Reads Are Not Free

JJ's docs are explicit that most commands snapshot the working copy by default. That means a background refresh using plain `jj status`, `jj log`, or similar may create a new working-copy commit and therefore mutate the repository.

This is the most important implementation constraint in the entire plan.

Control should therefore default to non-mutating JJ reads:

- always prefer `--ignore-working-copy` for background and passive read adapters
- use direct filesystem reads for the code browser whenever possible
- treat live dirty-state calculation as a workspace concern, not as a reason to snapshot automatically
- never let background refresh mutate a repo just to update the UI

If Control ever adds an explicit "snapshot now" or "refresh JJ working copy" action, that should be user-initiated and clearly labeled.

### Repository Identity And Workspace Identity Are Different

In JJ, a repository can have multiple workspaces. Repo-scoped data and workspace-scoped data are different:

- repo-scoped: history, bookmarks, tags, remotes, operation log, GitHub connection metadata
- workspace-scoped: root path, working-copy commit, stale state, sparse patterns, checked-out files, local dirty state

Control therefore needs both `repoId` and `workspaceId`. A local JJ route should open by `workspaceId`, not just by repository name.

### JJ Uses Bookmarks, Not Current Branches

JJ does not have a notion of the current tracked branch in the Git sense. The current working-copy commit is central; bookmarks are movable named pointers. Control should therefore:

- avoid branch-centric wording in JJ views
- show bookmarks as the primary named refs
- only use "branch" when explicitly describing Git interop or GitHub UI

## Repository And Workspace Model

Introduce a repository-plus-workspace model for local sources.

- `vcsKind = "git" | "jj"`
- `LocalRepositoryId`
- `LocalWorkspaceId`
- `LocalAreaSummary`
- `LocalRepositorySummary`
- `LocalRepositoryDetail`
- `LocalWorkspaceSummary`
- `LocalWorkspaceDetail`
- `GitHubConnectionState`

`LocalRepositoryDetail` should be repo-scoped:

- backing repository identity
- VCS kind
- repo health
- bookmarks
- tags
- remotes
- recent history
- operation-log summary
- GitHub connection metadata
- capability flags such as sparse support, signing support, Git-backed support, colocated support

`LocalWorkspaceDetail` should be workspace-scoped:

- workspace name
- workspace root path
- working-copy change ID and commit ID
- stale status
- sparse patterns
- local file tree
- README preview
- dirty/conflict summary
- last refresh metadata

`GitHubConnectionState` should include:

- resolved `owner/repo`
- matched remote name
- canonical remote URL
- fetch/push default remote if known
- auth reachability with the current GitHub account
- per-feature flags for `issues`, `pulls`, `actions`, and future GitHub-backed tabs

## Routing And UI State

The current route model is keyed by GitHub `nameWithOwner`, which is too narrow for JJ.

Required changes:

- keep existing GitHub routes working as they are
- add local routes keyed by `workspaceId`
- preserve `repoId` in local repository state
- allow one local repository page to mount both local JJ panels and GitHub-backed tabs
- allow switching between workspaces that share the same JJ repository

Suggested local JJ tabs:

- `Overview`
- `Code`
- `Changes`
- `Bookmarks`
- `Remotes`

Suggested repo-level panels visible in `Overview` or secondary navigation:

- `Tags`
- `Workspaces`
- `Operations`
- `Sparse`

Suggested connected GitHub tabs:

- `Issues`
- `Pull requests`
- `Actions`

The repository header should show:

- repo name
- workspace name
- `JJ` badge
- `Git-backed` or `colocated` badge where relevant
- GitHub badge if enrichment is active
- stale workspace indicator if applicable

## Local Discovery

Add a `LocalRepositoryManager` in the main process with separate adapters for Git and JJ.

Discovery rules:

- scan selected local roots recursively
- ignore heavy/generated directories such as `.git`, `node_modules`, `dist`, `build`, `.next`, `coverage`, `target`, common cache directories, and virtual environments
- detect Git repositories using `.git` directories and `gitdir:` indirection
- detect JJ repositories by `.jj` presence
- when Git and JJ signals exist at the same root, prefer a single JJ record
- when multiple JJ workspaces point to the same backing repository, group them under one `repoId` with multiple `workspaceId`s

JJ validation and data gathering should prefer explicit commands over scraping human-oriented output:

- `jj root`
- `jj workspace root`
- `jj workspace list`
- `jj git root`
- `jj git remote list`
- `jj bookmark list`
- `jj tag list`
- `jj log`
- `jj operation log`
- `jj sparse list`

Use templated output where JJ supports it, so the adapter can avoid brittle text parsing.

## Refresh Strategy

Control needs two refresh modes for JJ:

### Passive Non-Mutating Refresh

Used for background refresh and normal navigation.

- use `--ignore-working-copy` on JJ commands
- refresh repo-scoped metadata such as bookmarks, tags, remotes, log summaries, and operation metadata
- read file contents directly from the filesystem for code browsing
- derive workspace file trees from disk, not by forcing JJ snapshots

### Explicit Working-Copy Reconciliation

Used only when the user explicitly asks for it or when Control later gains a JJ-aware mutation workflow.

- may snapshot the working copy
- may call JJ commands that update the working-copy commit
- must be opt-in and clearly communicated

### Workspace Staleness

Control should surface stale JJ workspaces as a first-class state.

- if one workspace rewrites another workspace's working-copy commit, the second workspace can become stale
- Control should detect and display stale status
- Control should provide an explicit `Update stale workspace` action in the future, mapped to `jj workspace update-stale`
- Control should not auto-run this command in the background

## GitHub Connection Resolution

When a local repository is scanned or opened, try to resolve a GitHub connection from JJ or Git remotes.

Resolution behavior:

- normalize SSH and HTTPS GitHub remotes
- resolve to canonical `owner/repo`
- record the matched remote name and normalized URL
- bind to the currently authenticated GitHub account
- record feature availability and last sync result

Replace the old `Open in GitHub Area`-only behavior with inline enrichment:

- the local repository stays the primary page
- GitHub summary data loads into the same repository view
- GitHub-backed tabs are enabled only when connection resolution succeeds
- `Open on GitHub` remains available in the header
- `Open in GitHub area` can remain as an optional convenience action

GitHub summary cards in local JJ `Overview` should show:

- repository identity and visibility
- issues count
- pull request count
- latest workflow run
- latest release
- top contributors

## Git Interop Boundaries And Limits

JJ is Git-compatible in important ways, but Control should model the documented limits instead of assuming full Git parity.

Supported or partially supported areas relevant to Control:

- Git-backed repositories
- Git remotes and authentication through Git
- branches/bookmarks mapping
- lightweight tags and reading tags by name
- merge commits, including octopus merges
- detached HEAD-like states
- bare repositories
- native sparse checkouts
- signed commits

Known limits Control should respect:

- Git index/staging area is ignored by JJ
- `.gitattributes` support is not implemented
- hooks are not implemented
- submodules are not surfaced in the working copy
- partial clones are not supported
- shallow clone support is limited
- Git LFS is not supported
- conflicted JJ commits are represented awkwardly in raw Git
- colocated repos can be slower with many refs
- interleaving mutating Git and JJ commands can create confusing ref states

UI implications:

- do not invent staged/unstaged panels for JJ
- do not promise full Git submodule or LFS parity in JJ views
- show colocated/non-colocated state because external tools behave differently
- avoid a fake `Pull` action for JJ; fetch and rebase should stay separate if Control later adds JJ mutation UI

## Storage

Keep the current GitHub cache tables and add local repository tables rather than duplicating GitHub data.

New storage should include:

- `local_areas`
- `local_repositories`
- `local_workspaces`
- `local_repo_snapshots`
- `local_workspace_snapshots`
- `local_repo_connections`

`local_repositories` should store repo-scoped JJ data:

- `repo_id`
- `vcs_kind`
- backing repo root
- backing Git root if any
- colocation status
- repo health
- last operation ID seen
- recent history summary

`local_workspaces` should store workspace-scoped JJ data:

- `workspace_id`
- `repo_id`
- workspace name
- workspace root path
- current working-copy change ID
- current working-copy commit ID
- stale status
- sparse patterns summary
- last passive refresh time

`local_repo_connections` should store:

- `repo_id`
- `workspace_id` if connection behavior differs by workspace
- matched remote name
- normalized GitHub URL
- `owner`
- `repo`
- connection status
- last sync status
- last error
- bound GitHub login

Use the existing `github_repositories` and GitHub cache entries as the canonical GitHub read model for enrichment data.

## IPC Surface

Add repository-scoped and workspace-scoped local IPC methods so the renderer can stay local-first without deriving GitHub identity itself.

Suggested additions:

- `listLocalAreas`
- `createLocalArea`
- `removeLocalArea`
- `listLocalRepositories`
- `getLocalRepository`
- `listLocalWorkspaces`
- `getLocalWorkspace`
- `listLocalWorkspaceContents`
- `getLocalWorkspaceFileContent`
- `listLocalRepositoryBookmarks`
- `listLocalRepositoryTags`
- `listLocalRepositoryRemotes`
- `listLocalRepositoryOperations`
- `listLocalRepositoryIssues`
- `listLocalRepositoryPullRequests`
- `listLocalRepositoryActions`
- `mutateLocalRepositoryGitHub`
- `onLocalRepositoriesUpdated`
- `onLocalRepositoryUpdated`
- `onLocalWorkspaceUpdated`

Semantics:

- repo-scoped methods return history, bookmarks, tags, remotes, operation summaries, and GitHub connection state
- workspace-scoped methods return code tree, working-copy info, sparse info, and stale status
- GitHub-backed methods resolve `owner/repo` from the local repo connection and then delegate to the existing GitHub provider code

## Implementation Priority

### Must Be Visible In V1 UI

- JJ repository discovery
- workspace-aware local repo navigation
- local code browsing
- working-copy summary
- bookmarks
- remotes
- stale workspace indicator
- GitHub inline `Issues`, `Pull requests`, and `Actions` tabs when connected

### Must Exist In The Read Model In V1

- change IDs and commit IDs
- repo/workspace separation
- operation-log head tracking
- sparse state
- tag summaries
- colocation status
- Git-backed vs non-Git-backed capability flags
- bookmark tracking state

### Can Be Deferred As Dedicated UI

- rebase/squash/absorb/split/arrange actions
- operation-log viewer
- signing controls
- bisect
- fix
- Gerrit upload
- advanced revset/fileset-driven search

## Search

Global search should index:

- local repositories by `repoId`
- local workspaces by `workspaceId`
- GitHub repositories as it already does today

Connected JJ repositories should:

- show a `JJ` badge
- show a `GitHub` badge when enrichment is available
- show workspace name when there are multiple workspaces
- route into the local workspace page, not directly into the GitHub page

Future search expansion should preserve room for:

- bookmark-name search
- change-ID search
- commit-ID search
- revset-backed filtering

## Testing

Unit coverage:

- JJ discovery by `.jj`
- JJ and Git deduplication for colocated workspaces
- grouping multiple workspaces under one backing repo
- bookmark parsing and remote tracking state
- tag parsing
- GitHub remote normalization from SSH and HTTPS URLs
- connection resolution and cached feature availability
- stale workspace detection
- non-mutating adapter behavior using `--ignore-working-copy`

Renderer coverage:

- local workspace route behavior keyed by `workspaceId`
- repo header badges for `JJ`, `Git-backed`, `colocated`, `GitHub connected`, and `stale`
- mixed local plus GitHub tab rendering
- disabled GitHub tabs for unconnected or unreachable repositories
- workspace switching for one repo with multiple workspaces

Integration and E2E coverage:

- local JJ repository with no GitHub remote
- local JJ repository with a resolvable GitHub remote
- local JJ repository with multiple workspaces
- local JJ repository with stale workspace state
- local JJ repository with sparse patterns
- missing `jj` binary
- unauthenticated GitHub state
- connected local repository loading GitHub data inline from cache and then refreshing
- guarantee that passive local JJ browsing does not create a new working-copy commit

## Assumptions

- This milestone intentionally prioritizes the hybrid local repository model over full provider/area generalization.
- GitHub enrichment in v1 means repository-level surfaces Control already implements, especially `Issues`, `Pull requests`, and `Actions`.
- Self-hosted runner inventory is not part of this milestone because Control does not yet have a dedicated runner model.
- JJ GitHub enrichment only applies when the JJ repository is Git-backed and has a resolvable GitHub remote.
- Native remote JJ hosting is out of scope; the practical integration path here is JJ plus Git plus GitHub.
- If a future `pattern.md` design pattern is provided, this document can be revised to align with it.

## Research Sources

Official JJ docs used for this plan:

- https://jj-vcs.github.io/jj/latest/
- https://jj-vcs.github.io/jj/latest/cli-reference/
- https://jj-vcs.github.io/jj/latest/working-copy/
- https://jj-vcs.github.io/jj/latest/bookmarks/
- https://jj-vcs.github.io/jj/latest/conflicts/
- https://jj-vcs.github.io/jj/latest/operation-log/
- https://jj-vcs.github.io/jj/latest/revsets/
- https://jj-vcs.github.io/jj/latest/filesets/
- https://jj-vcs.github.io/jj/latest/templates/
- https://jj-vcs.github.io/jj/latest/git-compatibility/
- https://jj-vcs.github.io/jj/latest/github/
