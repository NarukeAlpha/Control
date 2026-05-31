# Multi-Area Local And JJ Foundation

This document records the multi-area, local repository, and JJ support that has
landed. Remaining product and correctness gaps live in
`docs/wip/area-search-and-local-workflows.md`.

## Completed Area Model

- GitHub and local folders are modeled as Areas.
- The default GitHub Area is `github:default`.
- Local folder Areas can discover plain Git repositories, Git worktrees, and JJ
  repositories.
- Area-aware repository, workspace, pin, and recent-item contracts exist in the
  shared layer.
- Area data is persisted through the split storage layer rather than ad hoc
  writes from IPC handlers.
- Existing GitHub pins and recents are migrated into Area-aware records.
- Main-process Area IPC handlers are registered separately from the app entry
  point.
- Preload exposes typed Area methods and Area update events.
- The renderer has an Area switcher, local Area home, local repository route, and
  local repository tabs.

## Completed Local Repository Support

- Local repository discovery prunes ignored folders and handles `.git`
  directories and `.git` files.
- Local Git metadata is read through bounded command adapters with explicit
  `cwd`, argv calls, timeouts, and non-interactive Git environment.
- Local file listings and file reads are available for repository browsing.
- Local README discovery and caching exist.
- GitHub remotes are normalized from common SSH and HTTPS forms.
- Connected local repositories can open the corresponding GitHub repository in
  the GitHub Area or fall back to an external GitHub URL.
- Area-aware pins and recents preserve local repository identity.

## Completed JJ Foundation

- `AreaRepositoryKind` includes `jj`.
- Route state and persisted records can carry `workspaceId`.
- JJ command execution has a passive command mode that injects
  `--ignore-working-copy` for direct adapter reads.
- JJ adapter code reads repository root, workspace root, Git backing root,
  bookmarks, tags, remotes, operation summaries, sparse state, file trees, and
  working-copy summaries.
- JJ and colocated Git/JJ repositories are discovered and deduplicated at the
  local repository discovery layer.
- Workspace snapshots and repository snapshots are persisted.
- JJ badges, workspaces, operations, bookmarks, remotes, and GitHub-connected
  tabs are visible in the local repository UI.
- Pins and recents preserve workspace identity.

## Current Baseline

Local and JJ repository browsing should be treated as real product surface, not
experimental placeholder code. Future work should build on these invariants:

- Area identity is part of repository identity.
- JJ repository identity and JJ workspace identity are different concepts.
- Passive JJ reads must not snapshot or otherwise mutate the working copy.
- Local repository UI should not assume every repository is a GitHub repository.
- GitHub enrichment is optional and must degrade predictably when a local
  repository is not connected or not reachable.
