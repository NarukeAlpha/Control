# Repository Experience

This is the active implementation plan for the repository page cleanup. It builds
on the completed cleanup baseline in `docs/done/github-cleanup-foundation.md`
and the local/JJ baseline in `docs/done/multi-area-local-jj-foundation.md`.

The goal for this pass is not to redesign every repository surface. The goal is
to make repository navigation, tab visibility, data ownership, cache/stale
behavior, and direct detail loading predictable enough that later surface polish
does not keep fighting route state or query churn.

## Grounded Baseline

- GitHub repository routes are represented by `AppRoute` in
  `src/renderer/src/stores/uiStore.ts`.
- `AppRoute.repository` owns the repository tab and detail selectors such as
  `issueNumber`, `pullNumber`, `workflowRunId`, `releaseId`,
  `contributorLogin`, `wikiPagePath`, and repository-settings collaborator
  focus.
- `AppRoute.codeBrowser` is already a dedicated route for repository code paths
  and file state. It should remain separate from the tabbed repository route.
- `AppRoute.localRepository` owns local Area/JJ repository tab state and path
  state. It is not a GitHub repository route and should not be forced through
  GitHub tab visibility rules.
- `src/renderer/src/hooks/useRepositoryRouteState.ts` is the current route-level
  query orchestrator. It eagerly creates repository detail/ref queries and gates
  most tab queries on `activeRepositoryTab`.
- `src/renderer/src/components/repository/repositoryTabs.ts` is a static tab
  roster. It does not encode required vs optional tabs, feature availability, or
  user preferences.
- `src/renderer/src/components/repository/RepositoryPage.tsx` renders the
  header, action row, static tabs, and selected tab surface.
- Repository detail data includes `administration.features` for Issues,
  Projects, Wiki, and Discussions, plus `counts` for Issues, Pull requests,
  Discussions, Projects, Releases, Forks, Stars, and Watchers. See
  `RepositoryAdministrationMetadata` and `RepositoryCounts` in
  `src/shared/github.ts`.
- `RepositoryDetail.administrationAvailability` tells whether admin/security
  metadata is live, stale, cached, permission-denied, or otherwise unavailable.
  Visibility rules must use this existing field rather than adding probe
  queries.
- GitHub tab query helpers already use availability-bearing `*WithStatus`
  contracts and scoped query keys:
  - Code: `src/renderer/src/components/repository/code/CodeTab.tsx`
  - Issues: `src/renderer/src/components/repository/issues/IssuesTab.tsx`
  - Pull requests:
    `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx`
  - Actions: `src/renderer/src/components/repository/actions/ActionsTab.tsx`
  - Discussions, Projects, Releases, Contributors, Wiki, Security and Quality,
    Settings, and Agents each own their tab-specific queries.
- Warm prefetch is intentionally limited to Code, Issues, Pull requests, and
  Actions in `src/renderer/src/hooks/useRepositoryWarmPrefetch.ts`.
- Manual refresh dispatch lives in
  `src/renderer/src/hooks/useRepositoryRefreshActions.ts`.
- Broad repository-scoped invalidation currently comes from
  `repositoryScopedQueryKeys` in
  `src/renderer/src/queries/repositoryQueryKeys.ts` and
  `invalidateGitHubMutationQueries` in
  `src/renderer/src/components/shell/appInvalidations.ts`.
- Local/JJ repository routes use
  `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx`.
  They have their own local tab roster and Area query keys such as
  `area-repository`, `area-contents`, `area-github-issues`,
  `area-github-pulls`, `area-github-actions`, and `area-sync-status`.

## Problems To Solve

- The GitHub repository header still duplicates the repository description,
  exposes fallback wording as primary copy, and competes with the top search
  area.
- GitHub repository tabs are always rendered from a static roster even when a
  feature is disabled, empty, unavailable, or intentionally hidden.
- Optional tab queries can still run because the tab is selected or because a
  helper surface such as Agents piggybacks on Issues, Pull requests, and
  Actions without a visibility model.
- Some direct detail routes are not independent enough:
  - Issue detail still depends on the focused issue appearing in the filtered
    list before `useIssueDetail` is enabled.
  - Pull request detail can load directly by `pullNumber` because
    `useComposedPullRequestDetail` falls back to the route number.
  - Workflow run detail can load directly by `workflowRunId` through
    `workflowRunDetailQueryKey`.
  - Discussion detail is route-addressable through `discussionNumber`, but
    `DiscussionsTab` currently selects from the loaded list before enabling
    detail.
  - Project focus routes are route-addressable through `projectId`, but
    `ProjectsTab` currently selects from the loaded list and has no dedicated
    project-detail IPC contract.
  - Release detail is still list-backed; there is no dedicated release-detail
    IPC/provider contract.
  - Agents is currently a workflow collection over Issues, Pull requests, and
    Actions, not an entity with its own detail model.
- Refresh and invalidation boundaries are better than the old monolith but still
  too broad for mutations. A single repository mutation invalidates every
  repository-scoped query family.
- Cache-first UI behavior is inconsistent across surfaces. The desired rule is:
  keep useful cached data visible, show stale/unavailable state inline, and avoid
  replacing cached data with empty states while a background refresh fails.
- Local and JJ repository workflows are real product surfaces. They should stay
  Area-aware and should not inherit GitHub-only optional tab rules.
- Broken or misleading blame entry points should not remain visible. Existing
  in-app file blame works in `CodeBrowserPage`; the cleanup is about hiding
  broken controls, not removing the functioning file blame panel.

## Desired Product Behavior

### Header And Default Layout

- `RepositoryPage` should show the repository name, visibility, fork/source
  context, and primary actions without repeating the repository description in
  the hero. The About/right-rail surface owns the description.
- The GitHub external button label should be `GitHub`. Avoid `GitHub fallback`
  except in error recovery copy where the fallback nature is relevant.
- The repository title must not overlap or visually compete with the liquid
  search/topbar area. Solve this with layout constraints in
  `src/renderer/src/styles.css`, not by truncating identity-critical text.
- The default right rail should not show the recent commits block by default.
  Commit history remains available in Code and code-browser contexts where it is
  task-relevant.
- The right rail can still link to Releases, Contributors, and Settings, but it
  must respect the same tab visibility model as the tab strip.

### GitHub Tab Visibility

Tabs have four classes:

- Always visible: Code, Issues, Pull requests, Actions.
- Optional feature/content tabs: Agents, Discussions, Projects, Releases,
  Contributors, Wiki, Security and Quality.
- Permission-sensitive preference tab: Settings.
- Route-only temporary tab: a hidden preference tab that is currently targeted
  by the route.

The implementation should introduce a small shared renderer module, for example
`src/renderer/src/components/repository/repositoryTabVisibility.ts`, that owns:

- `RepositoryTabPreference = "auto" | "show" | "hide"`.
- Required and optional tab sets.
- `RepositoryTabPreferenceKey`, which includes every preference-controlled tab:
  `agents`, `discussions`, `projects`, `releases`, `contributors`, `wiki`,
  `securityQuality`, and `settings`. Required tabs must not be persisted in the
  preference map.
- `RepositoryTabVisibilityInput` with this shape:

  ```ts
  interface RepositoryTabVisibilityInput {
    repository: RepositoryDetail | null;
    activeRoute: Extract<AppRoute, { kind: "repository" }> | null;
    preferences: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>;
  }
  ```

- `visibleRepositoryTabs(input)` returning:

  ```ts
  interface RepositoryTabVisibilityResult {
    tabs: RepositoryTabDescriptor[];
    hiddenReasons: Partial<Record<RepositoryTabPreferenceKey, string>>;
    routeOnlyTab: RepositoryTabDescriptor | null;
    queryGates: Record<RepositoryTab, boolean>;
  }
  ```

- `repositoryTabQueryEnabled(tab, route, visibility)` or equivalent helpers so
  route-level query hooks and UI rendering use the same decision.

Initial-load behavior must avoid tab strip pop-in. When
`RepositoryTabVisibilityInput.repository` is `null` because the repository
detail query is still loading, the helper should return a stable loading tab
layout instead of applying "unknown means hidden" Auto rules. Required tabs stay
visible, preference-forced `show` tabs stay visible, preference-forced `hide`
tabs stay hidden, and Auto optional tabs should either reserve their previous
layout for the same route or render a deterministic loading placeholder state
until repository detail resolves. Do not let Projects/Discussions/Wiki appear
mid-frame as an avoidable layout shift after the detail query succeeds.

User preferences should be global per preference-controlled tab for this pass,
not per repository. Store them in existing app settings:

- Extend `ControlSettings` in `src/shared/github.ts` with a repository tab
  preference map, for example
  `repositoryTabPreferences: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>`.
- Normalize defaults in `src/main/storage/localStoreHelpers.ts`.
- Persist via existing `getSettings`/`updateSettings`; do not add a separate
  renderer-only `localStorage` preference store.
- Add settings UI in `src/renderer/src/components/settings/SettingsPanel.tsx`
  or a focused repository settings subsection if that is the established UX
  choice during implementation. The control should expose Auto, Show, and Hide
  for preference-controlled tabs only. Code, Issues, Pull requests, and Actions
  are not configurable.

Auto visibility rules:

- Issues, Pull requests, and Actions remain visible even when counts are zero.
  They are core workflows and already part of warm prefetch.
- Discussions auto-shows when `repository.administration.features.discussions`
  is `true` or `repository.counts.discussions > 0`. Auto-hides when the feature
  is explicitly `false` and the count is zero. If the feature is `null`, keep
  visible only when the count is greater than zero.
- Projects auto-shows when `repository.administration.features.projects` is
  `true` or `repository.counts.projects > 0`. Auto-hides on explicit `false`
  with zero count.
  These signals may represent classic GitHub Projects rather than Projects V2.
  Document this limitation in code comments/tests so a repository with only
  Projects V2 does not surprise implementers when Auto hides the tab. Forced
  Show remains the escape hatch until the provider exposes a reliable V2 count.
- Wiki auto-shows when `repository.administration.features.wiki === true`.
  Auto-hides when explicitly `false`. If unknown, hide in Auto until the user
  chooses Show.
- Releases auto-shows when `repository.counts.releases > 0`. If count is zero
  or unknown, hide in Auto unless forced visible.
- Contributors auto-hides in Auto until the user chooses Show. Repository detail
  does not currently carry a contributor count, and auto-detecting it would
  require running the content query the visibility model is meant to avoid.
- Security and Quality auto-shows when security metadata suggests a configured
  surface or when the viewer can administer/maintain the repository. Use these
  exact predicates:
  - show when any `repository.administration.securityAndAnalysis` status equals
    `"enabled"`;
  - show when `repository.viewerState.canAdminister` is true;
  - show when `repository.administration.viewerPermissions.admin` or
    `maintain` is true;
  - do not treat `push`, `triage`, or `pull` as enough to auto-show Security and
    Quality;
  - if `repository.administrationAvailability?.status` is `"stale"`, apply the
    same predicates to the stale metadata and render a stale notice in the tab;
  - if administration availability is `permission_denied`, `feature_disabled`,
    `rate_limited`, `graphql_error`, `unavailable`, or missing, hide in Auto
    unless forced visible.
- Settings auto-shows when `repository.viewerState.canAdminister` is true or
  `repository.administration.viewerPermissions.admin` is true. Hide in Auto for
  read-only viewers, but allow Show so users can inspect read-only metadata.
  This is intentionally part of the persisted preference model to avoid a split
  rule between `repositoryTabVisibility.ts`, `SettingsPanel.tsx`, and tests.
- Agents auto-shows only when one of its source signals is already known without
  an extra query: currently none are available from repository detail, so hide
  in Auto unless forced visible. Do not query Issues, Pull requests, or Actions
  only to decide whether Agents should appear.

Forced visibility behavior:

- `show`: render the tab even if the feature appears disabled or empty.
- `hide`: do not render the tab and do not run its full content queries.
- `auto`: follow the rules above.
- If a route targets a hidden tab directly, render the tab surface in an
  explicit route-only state with a message that the tab is hidden by preference
  and a control to show it. Do not silently redirect and do not lose the route
  detail selector.
- Route-only rendering contract:
  - the normal tab strip omits hidden tabs from the primary list;
  - when `activeRoute.tab` is hidden, append one temporary active tab descriptor
    for that route only, visually marked as hidden;
  - the page body renders a hidden-tab panel before mounting the normal tab body
    unless the route requires a direct detail fetch described below;
  - the hidden-tab panel includes a `Show this tab` action that calls
    `updateSettings({ repositoryTabPreferences: { ...current, [tab]: "show" } })`
    and then lets the normal tab body mount without changing route selectors.

### Query Ownership And Gates

Route state should have one source of truth for whether tab queries may run.
Update `useRepositoryRouteState` so every tab query receives a visibility-aware
`enabled` value:

- Repository detail and ref queries can still run for repository/code-browser
  contexts.
- Code tab queries run when the active route is the Code tab.
- Issues queries run when the active route is Issues, or when Agents is both
  active and visible/forced.
- Pull request queries run when the active route is Pull requests, or when
  Agents is both active and visible/forced.
- Actions queries run when the active route is Actions, or when Agents is both
  active and visible/forced.
- Discussions, Projects, Releases, Contributors, Wiki, Security and Quality,
  and Settings queries run only when their tab is visible or the current direct
  route intentionally targets that tab.
- Hidden preference-controlled tabs must not be warmed by
  `useRepositoryWarmPrefetch`.
  Warm prefetch should remain Code, Issues, Pull requests, and Actions only.
- Query helpers should keep their existing tab ownership. Do not move tab query
  code back into `App.tsx`.

`RepositoryPage` should receive the resolved visible tab descriptors instead of
reading the static `repoTabs` directly. Keep `repositoryTabs.ts` as the tab
metadata source, but make visibility a separate derivation.

Route-level and tab-rendered hooks must share the same gates:

- Do not rely only on `useRepositoryRouteState`. Several tab components call
  their own hooks when rendered. Remove hardcoded `enabled: true` values from
  `IssuesTab`, `PullRequestsTab`, `DiscussionsTab`, `ProjectsTab`,
  `ReleasesTab`, `WikiTab`, `SecurityQualityTab`, and
  `RepositorySettingsTab`.
- Prefer passing `queryEnabled`/`resourceQueriesEnabled` props into each tab so
  tab-local hooks use the same `RepositoryTabVisibilityResult.queryGates` values
  as `useRepositoryRouteState`.
- Route state may continue to pre-create queries for refresh, prefetch, and
  shell/right-rail data, but tab bodies remain owners of their tab-specific
  presentation queries. Do not pass large query-result objects through
  `RepositoryPage` unless an existing tab already follows that pattern.
- A route-only hidden tab must not fetch full list content just because the
  temporary tab exists. The exceptions are direct detail fetches explicitly
  listed in the next section.

### Direct Detail Surfaces

Detail routes stay repository-scoped for this pass. Do not introduce top-level
Issue/PR/Run routes.

Required behavior:

- Issue route:
  `{ kind: "repository", nameWithOwner, tab: "issues", issueNumber }` must load
  issue detail even if the issue is absent from the current list page or filtered
  out. Fix `IssuesTab` so `focusedIssueNumber` directly enables
  `useIssueDetail`; use list data only as a summary fallback.
- Pull request route:
  Preserve the current direct-loading behavior in `PullRequestsTab`. Keep the
  split detail query keys for overview, comments, files, commits, reviews,
  checks, review threads, timeline, and linked issues.
- Workflow run route:
  Preserve direct loading in `ActionsTab` by `workflowRunId`. Artifact detail
  remains nested under the selected run.
- Discussion route:
  `{ kind: "repository", nameWithOwner, tab: "discussions", discussionNumber }`
  must load discussion detail directly through existing discussion-detail IPC
  when the discussion is absent from the current list page or filtered out.
  `DiscussionsTab` should enable the detail query from
  `focusedDiscussionNumber` first, and use list data only as a summary fallback.
  Discussion categories are editor metadata; gate them separately so opening a
  read-only discussion detail does not require categories to load first.
- Project route:
  `{ kind: "repository", nameWithOwner, tab: "projects", projectId }` remains
  tab-owned in this pass because there is no dedicated project-detail IPC
  contract. If the route targets Projects while the tab is hidden, render the
  route-only hidden-tab panel and allow the user to show the tab without losing
  `projectId`. If Projects is visible and `projectId` is absent from the current
  list page, expand the projects list up to `maxProjectsLimit` once. If the
  project is still absent, render a tab-owned unavailable state that preserves
  the route and offers the external GitHub project link only when available.
  Do not query Issues or Pull requests just to resolve project visibility.
- Release route:
  Add a dedicated release detail contract instead of relying only on the
  releases list. Support lookup by `releaseId` when present and by
  `releaseTagName` when id is absent. Keep list data as a fast summary fallback.
  Proposed shared contract:

  ```ts
  interface ReleaseDetailInput extends RepoDetailInput {
    releaseId?: number;
    releaseTagName?: string;
    cacheOnly?: boolean;
    forceRefresh?: boolean;
  }

  interface ReleaseDetailResult {
    item: ReleaseSummary | null;
    availability: GitHubReadAvailability;
  }
  ```

  Query and IPC contract:
  - renderer query key:
    `["release-detail", owner, repo, releaseId ?? null, releaseTagName ?? null]`;
  - `src/shared/ipc.ts` channel: `githubReleaseDetailWithStatus:
"github:release-detail-with-status"`;
  - `githubIpcRouteChannels.getReleaseDetailWithStatus` maps to that channel;
  - `GitHubProvider` adds
    `getReleaseDetailWithStatus(input: ReleaseDetailInput): Promise<ReleaseDetailResult>`;
  - preload exposes `api.github.getReleaseDetailWithStatus(input)`;
  - `OctokitReleaseDomain` uses
    `GET /repos/{owner}/{repo}/releases/{release_id}` for `releaseId` and
    `GET /repos/{owner}/{repo}/releases/tags/{tag}` for `releaseTagName`;
  - provider cache keys should distinguish id and tag lookups, for example
    `release-detail:${owner}/${repo}:id:${releaseId}` and
    `release-detail:${owner}/${repo}:tag:${releaseTagName}`;
  - `src/renderer/src/data/mocks/releases.ts` returns matching mock releases
    by id or tag and statusful `item: null` for misses;
  - `repositoryScopedQueryKeys` includes `release-detail`.

- Agents route:
  Do not invent an agent-detail entity in this pass. Agents remains a workflow
  collection over agent-labeled issues, attention workflow runs, and open pull
  requests. Direct detail should route to the underlying Issue, Pull request, or
  Workflow run route. Because `uiStore.ts` does not provide a browser-style
  history stack, preserve source context explicitly when the user launches a
  detail from Agents. Use a small ephemeral route-source field or return target
  in UI state, for example `{ sourceTab: "agents" }`, so closing the detail can
  return to Agents instead of dropping the user into the Issues, Pull requests,
  or Actions list. Deep links without a source should open the underlying tab
  directly. If implementation chooses the simpler context-loss behavior, it must
  document that tradeoff in UI copy/tests before shipping. A future true Agent
  detail requires a shared data model first.
- Contributor, Wiki, Security, and Settings focus routes can remain tab-owned,
  but they must not require unrelated tabs to fetch.

### Cache, Stale, And Unavailable States

Use these rules consistently:

- React Query keeps cached data visible by default. Surfaces should render
  `data?.items ?? []` only as an initial empty fallback; when prior data exists,
  background errors or non-available `availability` should show inline status
  while preserving the last useful content.
- `GitHubReadAvailability.status === "stale"` means "show cached data with a
  stale notice", not "show an empty state".
- `permission_denied`, `feature_disabled`, `rate_limited`, and `graphql_error`
  should be surfaced inline in the tab that owns the query.
- A forced-visible but empty optional tab should show a specific empty state:
  for example, "Projects are enabled but no projects were returned" or "Wiki is
  hidden in Auto because repository metadata says wiki is disabled."
- Cached mode (`githubReady === false`) should continue using `cacheOnly: true`
  and must not show controls as if live mutations or live refreshes are
  possible.
- Manual refresh should call `forceRefresh: true` only when `githubReady` is
  true. Existing refresh helpers already follow this pattern; keep it.
- Do not add broad "defensive" null guards everywhere. Prefer typed visibility
  inputs and explicit availability states.
- Add representative stale/cache tests so this is not only prose:
  - one list tab, for example Discussions or Projects, keeps existing `items`
    visible when `availability.status === "stale"` or a background refetch
    errors;
  - one detail tab, for example Issue, Discussion, Pull request, Workflow run,
    or Release detail, keeps the last useful detail visible with an inline stale
    notice;
  - one Security and Quality or Settings surface keeps stale admin/security
    metadata visible instead of rendering a false empty state.
- Area GitHub enrichment stays main-process governed in this pass.
  `LocalRepositoryPage.tsx` should keep calling
  `api.areas.listGitHubIssues`, `listGitHubPullRequests`, and
  `listGitHubActions` without adding renderer `githubReady`, `cacheOnly`, or
  `forceRefresh` parameters. Those Area APIs own live/cache policy for local
  repository enrichment. Renderer live refresh controls must stay disabled or
  absent when the local page only has cached/unavailable Area results.

### Mutation Invalidation

Narrow invalidation in `appInvalidations.ts` and
`repositoryQueryKeys.ts` instead of invalidating every repository-scoped query
for every mutation.

Minimum mapping:

- Repository hero/settings mutations (`editRepository`, `star`, `unstar`,
  `watch`, `unwatch`, `fork`) invalidate `repository`, repository lists, and
  account profile where applicable.
- Issue mutations invalidate `issues`, `issue-detail`, shared issue resources
  when labels/assignees/milestones change, account issues, and notifications.
  Label and assignee mutations must also invalidate `pulls` and `pull-detail`
  because GitHub pull requests are issue-backed and can share labels/assignees.
- Pull request mutations invalidate `pulls`, affected `pull-detail` sections,
  branch protection only when branch/base state can change, account pulls, and
  notifications.
- Workflow mutations invalidate `actions`, `action-detail`, `workflows`, and
  notifications.
- Release mutations invalidate `releases`, release detail, and repository detail
  counts.
- Security/settings mutations invalidate only the relevant settings/security
  query families.
- Project mutations should define their invalidation conservatively. If
  `GitHubMutationInput` does not carry enough information to prove whether
  project-item summaries are reused by Issues or Pull requests, invalidate
  `issues`, `issue-detail`, `pulls`, and `pull-detail` rather than depending on
  an implicit condition the invalidation router cannot know.
- Pinning local/repository records is not a GitHub mutation and should stay out
  of GitHub query invalidation.

Add tests around the mapping. Broad invalidation can remain as an explicit
fallback helper for sign-in/sign-out/session changes.

Use exact `GitHubMutationInput["action"]` names in the mapping:

| Actions                                                                                                                                                          | Repository query prefixes                                                                                                                                                    | Other query keys                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `star`, `unstar`, `watch`, `unwatch`, `fork`                                                                                                                     | `repository`                                                                                                                                                                 | `repositories`, `github-account-repositories`, `account-profile`, `notifications`                                                                                                 |
| `editRepository`                                                                                                                                                 | `repository`, `issues`, `pulls`, `discussions`, `projects`, `releases`, `repository-wiki`, `repository-access`, `repository-security-policy`, `repository-community-profile` | `repositories`, `github-account-repositories`, `organizations`, `organization-repositories`, `organization-team-repositories`, `account-issues`, `account-pulls`, `notifications` |
| `createIssue`, `editIssue`, `closeIssue`, `reopenIssue`                                                                                                          | `issues`, `issue-detail`, `repository`                                                                                                                                       | `account-issues`, `account-pulls` when PR-linked fields can change, `notifications`                                                                                               |
| `addComment`, `editComment`, `deleteComment`                                                                                                                     | `issues`, `issue-detail`                                                                                                                                                     | `account-issues`, `notifications`                                                                                                                                                 |
| `addLabels`, `removeLabel`, `setAssignees`, `removeAssignees`                                                                                                    | `issues`, `issue-detail`, `pulls`, `pull-detail`, `labels`, `assignable-users`, `milestones` only when the payload changes those shared resources                            | `account-issues`, `account-pulls`, `notifications`                                                                                                                                |
| `createPullRequest`, `mergePullRequest`, `closePullRequest`, `reopenPullRequest`                                                                                 | `pulls`, `pull-detail`, `commits`, `branches`, `repository`                                                                                                                  | `account-pulls`, `notifications`                                                                                                                                                  |
| `approvePullRequest`, `commentPullRequestReview`, `requestChanges`, `requestReviewers`, `removeReviewers`, `editReviewComment`, `deleteReviewComment`            | `pulls`, `pull-detail`                                                                                                                                                       | `account-pulls`, `notifications`                                                                                                                                                  |
| `rerunWorkflow`, `rerunFailedWorkflowJobs`, `rerunWorkflowJob`, `dispatchWorkflow`, `cancelWorkflow`                                                             | `actions`, `action-detail`, `workflows`                                                                                                                                      | `notifications`                                                                                                                                                                   |
| `createRelease`, `editRelease`, `deleteRelease`, `deleteReleaseAsset`                                                                                            | `releases`, `release-detail`, `repository`                                                                                                                                   | `notifications`                                                                                                                                                                   |
| `updateBranchProtection`, `deleteBranchProtection`                                                                                                               | `branch-protection`, `repository-access`                                                                                                                                     | `notifications`                                                                                                                                                                   |
| `addRepositoryCollaborator`, `removeRepositoryCollaborator`, `updateCollaboratorPermission`, `addRepositoryTeam`, `removeRepositoryTeam`, `updateTeamPermission` | `repository-access`, `repository`                                                                                                                                            | `notifications`                                                                                                                                                                   |
| `createRepositoryRuleset`, `updateRepositoryRuleset`, `deleteRepositoryRuleset`                                                                                  | `repository-rulesets`, `repository-access`, `branch-protection`                                                                                                              | `notifications`                                                                                                                                                                   |
| `createDiscussion`, `editDiscussion`, `closeDiscussion`, `reopenDiscussion`, `addDiscussionComment`, `editDiscussionComment`, `deleteDiscussionComment`          | `discussions`, `discussion-detail`, `discussion-categories` when category metadata changes, `repository`                                                                     | `notifications`                                                                                                                                                                   |
| `createProjectV2`, `updateProjectV2`, `deleteProjectV2`, `addProjectV2Item`, `updateProjectV2Item`, `deleteProjectV2Item`                                        | `projects`, `issues` and `pulls` only when project-item content summaries are reused, `repository`                                                                           | `notifications`                                                                                                                                                                   |
| `createWikiPage`, `editWikiPage`, `deleteWikiPage`                                                                                                               | `repository-wiki`                                                                                                                                                            | `notifications`                                                                                                                                                                   |

The implementation can encode this table as sets of query-prefix families, but
tests should assert action names, not only broad category helper names.

### Local, GitHub, And JJ Workflows

GitHub repository routes:

- Use the GitHub tab visibility model above.
- Keep `codeBrowser` as the dedicated code/file route for GitHub repositories.
- Keep GitHub mutations behind `githubReady` and repository permission checks.

Local repository routes:

- Keep using `LocalRepositoryPage` and `LocalRepositoryTab`.
- Do not apply GitHub optional tab preferences to local tabs in this pass.
- GitHub-enriched local tabs (`issues`, `pulls`, `actions`) should stay visible
  because the local page already explains "No GitHub remote is connected" or
  shows availability messages.
- Local code/file browsing should remain Area route state, keyed by `areaId`,
  `repositoryId`, `workspaceId`, and `path`.
- Local GitHub-enriched tabs should not receive GitHub repository
  visibility/settings gates. Their stale/cache/unavailable state is whatever
  the Area API returns for the local repository and workspace.

JJ repositories:

- Preserve `workspaceId` in route state and query keys.
- Passive reads must remain non-mutating; no route or refresh work should run JJ
  commands that snapshot or mutate the working copy.
- JJ-only tabs such as Bookmarks, Workspaces, and Operations belong to the local
  route. Do not add them to GitHub repository tab visibility.
- Existing disabled behavior for JJ health errors in Bookmarks and Operations
  should remain.

Cross-surface navigation:

- A local repository with `detail.connection` can still open the matching GitHub
  Area repository or external GitHub URL.
- A GitHub repository page should not assume a local checkout exists.
- Recent items must preserve provider identity so opening a GitHub repo, local
  Git repo, and JJ workspace with the same remote does not collapse to one
  route.
- Recent-item tests must cover:
  - GitHub repository recents use `repositoryNameWithOwner` and navigate to
    `{ kind: "repository", nameWithOwner, tab }`;
  - local repository and file recents with `provider === "local"` use
    `goToLocalRepository(areaId, repositoryId, tab, workspaceId, path)`;
  - GitHub recents for hidden preference-controlled tabs land in the route-only
    hidden-tab state, preserving selectors such as `discussionNumber`,
    `projectId`, `releaseId`, `securityItemKind`, and `wikiPagePath`, instead
    of falling back to Code.

## Affected Files For Implementation

Primary renderer files:

- `src/renderer/src/stores/uiStore.ts`
- `src/renderer/src/hooks/useRepositoryRouteState.ts`
- `src/renderer/src/hooks/useRepositoryWarmPrefetch.ts`
- `src/renderer/src/hooks/useRepositoryRefreshActions.ts`
- `src/renderer/src/components/repository/repositoryTabs.ts`
- `src/renderer/src/components/repository/repositoryTabVisibility.ts` (new)
- `src/renderer/src/components/repository/RepositoryPage.tsx`
- `src/renderer/src/components/repository/issues/IssuesTab.tsx`
- `src/renderer/src/components/repository/discussions/DiscussionsTab.tsx`
- `src/renderer/src/components/repository/projects/ProjectsTab.tsx`
- `src/renderer/src/components/repository/releases/ReleasesTab.tsx`
- `src/renderer/src/components/repository/actions/ActionsTab.tsx`
- `src/renderer/src/components/repository/agents/AgentsTab.tsx`
- `src/renderer/src/components/code-browser/CodeBrowserPage.tsx`
- `src/renderer/src/components/right-rail/RightRail.tsx`
- `src/renderer/src/components/settings/SettingsPanel.tsx`
- `src/renderer/src/styles.css`

Shared/main/preload files for settings and release detail:

- `src/shared/github.ts`
- `src/shared/ipc.ts`
- `src/preload/index.ts`
- `src/main/storage/localStoreHelpers.ts`
- `src/main/storage/settingsStore.ts` only if schema assumptions require it
- `src/main/ipc/registerControlIpc.ts`
- `src/main/github/releaseDomain.ts`
- `src/main/github/provider.ts`
- `src/main/github/octokitProvider.ts`

Tests and mocks:

- `src/renderer/src/App.test.tsx`
- `src/renderer/src/components/repository/repositoryTabPrefetch.test.ts`
- `src/renderer/src/components/repository/repositoryTabVisibility.test.ts`
- `src/renderer/src/components/repository/RepositoryPage.test.tsx`
- `src/renderer/src/hooks/repositoryRefresh.test.ts`
- `src/renderer/src/components/repository/agents/AgentsTab.test.tsx`
- `src/renderer/src/components/repository/contributors/ContributorsTab.test.tsx`
- `src/renderer/src/components/repository/discussions/DiscussionsTab.test.tsx`
- `src/renderer/src/components/repository/releases/ReleasesTab.test.tsx`
- `src/renderer/src/components/recent/openRecentItem.test.ts`
- `src/renderer/src/data/mocks/api.ts`
- `src/renderer/src/data/mocks/repository.ts`
- `src/renderer/src/data/mocks/releases.ts`
- `src/shared/ipc.test.ts`
- `src/preload/index.test.ts`
- `src/main/ipc/registerControlIpc.test.ts`
- `src/main/github/releaseDomain.test.ts`
- `src/main/areas/jjAdapter.test.ts`
- `src/main/areas/jjCommandRunner.test.ts`
- main/shared IPC and release-domain tests are required if release detail IPC is
  added

## Sequencing

1. Add the tab visibility model and tests without changing tab visuals.
   - Define required/optional tab metadata.
   - Extend settings with global preference-controlled tab preferences.
   - Add preference normalization and settings UI.
   - Add unit tests for Auto, Show, Hide, unknown metadata, and direct hidden
     routes.
   - Add initial-load tests proving Auto optional tabs do not pop into the tab
     strip only after repository detail resolves.

2. Wire visibility into repository route state and `RepositoryPage`.
   - Pass visible tab descriptors to the page.
   - Gate all tab query hooks with visibility-aware `enabled` values.
   - Ensure hidden preference-controlled tabs do not fetch.
   - Keep warm prefetch limited to Code, Issues, Pull requests, and Actions.

3. Clean up header, right rail, and visible copy.
   - Move/remove duplicate description from the hero.
   - Rename external button to `GitHub`.
   - Remove recent commits from the default right rail.
   - Hide broken blame entry points while keeping working code-browser blame.
   - Fix layout overlap around the topbar/liquid search area.

4. Make detail routes direct-loadable.
   - Fix issue direct loading first; it is the known list-dependent case.
   - Preserve PR and workflow run direct loading with tests.
   - Add discussion direct loading through existing discussion-detail IPC.
   - Keep Projects tab-owned with the `projectId` route-only/list-expansion
     behavior above.
   - Add release detail IPC/provider/query support; this is in scope for the
     implementation batch unless a later implementation issue explicitly marks
     it deferred.
   - Keep Agents as a collection and route detail actions to the underlying
     surfaces.
   - Preserve Agents return context for details opened from the Agents tab, or
     explicitly test the chosen context-loss behavior if the implementation
     defers source preservation.

5. Narrow mutation invalidation.
   - Add mutation-to-query-family mapping tests.
   - Replace broad repository invalidation on mutation success with targeted
     invalidation.
   - Keep broad invalidation for GitHub session changes.

6. Validate local/JJ behavior was not pulled into GitHub-only rules.
   - Confirm local GitHub-enriched tabs still render meaningful empty or
     unavailable states.
   - Confirm JJ workspace route identity and disabled health behavior remain.
   - When `LocalRepositoryPage.tsx`, Area query keys, JJ route state, or Area
     refresh code changes, run focused JJ tests to prove passive reads still use
     `--ignore-working-copy` and cannot run snapshot-risk commands.

## Acceptance Criteria

- Repository description no longer appears in the GitHub repository hero; About
  or right-rail content owns it.
- The default right rail no longer shows recent commits.
- The primary external repository button reads `GitHub`.
- Repository title/header layout does not overlap the topbar or liquid search
  area at desktop or narrow widths.
- Code, Issues, Pull requests, and Actions are always visible for GitHub
  repository routes.
- Preference-controlled GitHub tabs honor Auto, Show, and Hide preferences.
- Hidden preference-controlled tabs do not run their full tab content queries.
- A direct route to a hidden tab preserves the route and explains that the tab
  is hidden by preference instead of silently redirecting.
- Clicking "Show this tab" from a route-only hidden-tab panel removes the
  route-only descriptor in the same render cycle, so the tab strip never renders
  duplicate headers for the same tab.
- Force-shown empty optional tabs render clear empty/unavailable states.
- Agents hides in Auto by default unless future repository detail signals make
  it visible, and forced Show is covered by tests.
- Opening Issue/PR/Workflow detail from Agents preserves an explicit return path
  to Agents, or the implementation documents and tests the intentional
  context-loss tradeoff.
- Issue, pull request, workflow run, and release detail routes can load without
  assuming the list query already contains the selected item.
- Discussion detail routes can load without assuming the list query already
  contains the selected discussion.
- Project focus routes preserve `projectId`, show route-only hidden-tab state
  when hidden, expand the list once when visible, and render an explicit
  unavailable state if the focused project is still absent.
- Background refresh failures preserve cached content and show inline
  availability/error state.
- Stale/cache tests cover one list tab, one detail tab, and one
  Security/Settings surface.
- Mutations invalidate only affected query families, except for explicit
  session-wide invalidation.
- Local repository routes and JJ workspace routes keep their existing tab model,
  Area identity, workspace identity, and passive-read guarantees.
- Recent-item tests prove GitHub, local Git, and JJ entries with the same remote
  preserve provider identity and hidden preference-controlled GitHub tab routes
  do not fall back to Code.
- Broken blame controls are hidden; working code-browser blame remains
  available.

## Validation Commands

Required before closing implementation work:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Recommended focused checks while developing:

```bash
bun run test -- src/renderer/src/App.test.tsx
bun run test -- src/renderer/src/components/repository/repositoryTabVisibility.test.ts
bun run test -- src/renderer/src/components/repository/RepositoryPage.test.tsx
bun run test -- src/renderer/src/components/repository/repositoryTabPrefetch.test.ts
bun run test -- src/renderer/src/components/settings/SettingsPanel.test.tsx
bun run test -- src/renderer/src/hooks/repositoryRefresh.test.ts
bun run test -- src/main/storage/localStoreHelpers.test.ts
```

Recommended focused checks when release detail IPC/provider work is included:

```bash
bun run test -- src/shared/ipc.test.ts
bun run test -- src/preload/index.test.ts
bun run test -- src/main/ipc/registerControlIpc.test.ts
bun run test -- src/main/github/releaseDomain.test.ts
bun run test -- src/main/github/provider.test.ts
bun run test -- src/renderer/src/components/repository/releases/ReleasesTab.test.tsx
```

Recommended focused checks when local/JJ route or Area query code is touched:

```bash
bun run test -- src/main/areas/jjAdapter.test.ts
bun run test -- src/main/areas/jjCommandRunner.test.ts
bun run test -- src/renderer/src/stores/uiStore.test.ts
bun run test -- src/renderer/src/App.test.tsx
```

Do not add Playwright E2E coverage for this plan unless explicitly requested.
Use `bun run test`, not direct `vitest`, for validation.
