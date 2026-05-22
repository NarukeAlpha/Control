# Repository Refresh Policy

Repository pages should feel cache-first and stable. Opening a repository should
not imply that every repository surface needs aggressive live refresh. Control
should render the best local data immediately, validate freshness in the
background, and update only the affected parts of the page when newer data is
available.

## Goals

- Load repository pages from local cache first.
- Revalidate repository data in the background without blocking first paint.
- Avoid route-wide or app-wide visual re-renders during background refresh.
- Keep repository data correct when cache entries are stale, missing, or
  partially refreshed.
- Make refresh behavior predictable across Code, Issues, Pull requests, Actions,
  Releases, and optional repository tabs.
- Enforce availability and stale-data semantics at the IPC boundary, not only in
  renderer components.

## Cleanup V2 Baseline

cleanup-v2-gpt moves repository reads toward strict `*WithStatus` IPC methods
and standardized availability-bearing results. Renderer code should consume
those contracts instead of raw read twins when availability matters.

The important baseline rules are:

- list reads should return a shared shape equivalent to
  `GitHubListResult<T>`, with `{ items, availability }`
- detail reads should carry explicit availability fields for partial data
- renderer UI should not infer "empty" from a failed or unavailable read
- stale, disabled, unavailable, and empty states should remain distinct after
  IPC serialization
- raw provider failures should be normalized before they reach renderer state

## Product Behavior

When a user opens a repository:

1. Render cached repository data immediately if it exists.
2. Show loading states only for surfaces with no usable cached data.
3. Start background validation for the active surface and required repository
   metadata.
4. Replace visible data only when the response is newer or materially different.
5. Keep unrelated page sections visually stable while one section refreshes.

This should behave closer to GitHub's normal page loading model: cached content
appears quickly, network validation happens in the background, and the page does
not constantly redraw unless there is a real data change.

## Refresh Boundaries

Refreshes should be scoped by data ownership:

- Repository identity and metadata refresh independently from tab content.
- Code browser contents refresh by path and ref.
- Issues refresh independently from pull requests.
- Pull request lists refresh independently from pull request detail data.
- Actions refresh independently from repository summary data.
- Optional tabs should not fetch repeatedly when hidden.

The active tab can revalidate more eagerly than inactive tabs, but inactive tabs
should not be treated as live surfaces by default.

## Renderer Stability

Background refresh must not cause the entire app shell to visually re-render.
If the whole page flashes, shifts, or remounts during repository refresh, treat
that as a bug in state ownership, query invalidation, or component boundaries.

Implementation should check for:

- broad query invalidation that marks unrelated surfaces stale
- parent components subscribing to large state objects
- route-level keys that remount the repository page
- provider state updates that replace stable object identities unnecessarily
- loading flags that reset a whole page instead of one surface

## Failure Behavior

When background validation fails:

- keep showing cached data if available
- show a small stale or refresh warning on the affected surface
- do not replace good cached data with an empty state
- do not force the user out of the current repository page

If a surface has no cache and the network request fails, that surface should
show a targeted error state while the rest of the repository page remains usable.

The renderer should not be responsible for inventing availability semantics from
exceptions. IPC handlers and provider adapters should convert partial failures
into the shared availability result shape, then the renderer should decide how
to present that explicit state.

## Mutations And Cache Boundaries

Repository mutations should use the strict `GitHubMutationInput` discriminated
union. Mutation success should invalidate or refresh only the affected cache
families.

Examples:

- issue mutations refresh issue list/detail data, not unrelated code or action
  queries
- pull request mutations refresh pull request list/detail data and any affected
  repository summary data
- release mutations refresh release data and repository activity only when
  needed
- workflow mutations refresh the affected workflow run and actions list

Avoid generic mutation inputs that require renderer code to guess which caches
changed. The mutation action should be specific enough for the provider/cache
layer to clear the smallest credible query set.

## Out Of Scope

- Rewriting the full data cache model.
- Adding WebSocket or push-based live updates.
- Changing GitHub provider authentication.
- Adding e2e coverage unless specifically requested.

## Open Questions

- Which repository surfaces should revalidate on page open every time?
- Which surfaces should revalidate only on explicit user refresh?
- Do we need visible stale timestamps in the repository UI?
- Should refresh intervals differ for local repositories, GitHub repositories,
  and SSH-backed repositories?

## Validation

Implementation should include targeted unit or renderer tests around cache-first
behavior and stale data handling where practical.

Add tests around availability propagation where practical:

- unavailable list reads return `{ items, availability }` without being confused
  with an empty successful list
- mutations invalidate only the expected repository-scoped query families
- renderer surfaces show stale/unavailable states without clearing cached items

Required validation before closing implementation work:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`

Use React diagnostics if broad re-render behavior remains visible after the
state/query changes.
