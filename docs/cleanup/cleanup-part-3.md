# Cleanup Part 3: Complete App Shell Decomposition

## Goal

Part 2 stabilized the main-process seams, storage modules, IPC catalog, pull-request subresource contracts, and the
first renderer ownership slice. It did not finish the renderer app shell decomposition. Part 3 finishes that work by
turning `App.tsx` into a thin shell module whose interface is routing, process-wide subscriptions, global providers,
mutation invalidation, and composition.

The target is not smaller files for their own sake. Each extracted module must be deep: it should own a visible
workflow, hide its query and transient-state implementation, and expose a narrow interface that gives callers real
leverage and maintainers locality.

## Current Evidence

- `src/renderer/src/App.tsx` is still 16,099 lines.
- `App()` is still about 6,169 lines and owns most route queries, mutations, refresh helpers, warm prefetch, route
  actions, and shell composition.
- `RepositoryPage` is still about 1,064 lines and is called from `App()` with roughly 180 props.
- `CollectionView` is still about 1,951 lines and is called from `App()` with roughly 95 props.
- `CommandPalette`, `FileFinder`, `Sidebar`, `TopBar`, `HomeDashboard`, `CodeBrowserPage`, `RightRail`, and
  `SettingsPanel` are still inline in `App.tsx`.
- Areas and local workspaces are also inline: `LocalAreaHome`, `AreaTopbarSelector`, `SshAreaDialog`,
  `AreaEditDialog`, and `AreaDeleteDialog` all live in `App.tsx`.
- Global utility surfaces are inline: `SetupPanel`, `AddRepositoryDialog`, `FileBlamePanel`, and
  `CommitHistoryPanel` still live in `App.tsx`.
- `App.tsx` owns process-wide IPC listener lifecycle for area updates, local repository updates, workspace updates, and
  GitHub repository update events.
- `App.tsx` owns global query-cache fetch-status tracking through `queryClient.getQueryCache().subscribe(...)`.
- `SettingsPanel` currently owns GitHub sign-in state and device-flow polling, even though authentication completion is
  a global application concern that must not depend on the Settings route remaining mounted.
- Only `ContributorsTab` has the full Part 2 ownership shape: tab-local queries, warm prefetch helper, retained
  transient state, focused tests, and a local error boundary.

## Meta Rules

- Use one umbrella branch, but keep each batch as a self-contained vertical slice.
- After each batch: `bun run typecheck`, `bun run lint`, and `bun run test` must pass before commit.
- Run `bun run format` as the final gate.
- Do not add e2e tests unless specifically requested.
- Preserve query keys, cache-only behavior, force-refresh behavior, warm prefetch, selected route state, transient
  form state, and local repository route state.
- Do not count file movement as progress unless the extracted module owns behavior behind a smaller interface than
  the old prop bundle.
- Do not create a new centralized query module that recreates the old `App()` ownership problem under another name.
- Do not move process-wide subscriptions, auth polling, or query-cache instrumentation into route modules that can be
  unmounted during normal navigation.
- Shell components must define a real seam: either they own narrow store/query subscriptions themselves, or they receive
  a small route-level model. Passing the same broad callback and state bundle through a new file is not decomposition.
- Preserve the provider seam. Local paths, SSH/local areas, GitHub, and future version-control providers must remain
  first-class; do not make the app shell or auth lifecycle linear-GitHub-only.
- Avoid premature genericity. Keep GitHub-specific modules concrete where the workflow is genuinely GitHub-shaped
  (issues, pull requests, Actions), but use provider-aware seams for auth/connectivity, repository directory, areas, and
  route selection where local and future providers already matter.
- Shared observable UI state belongs in `useUiStore` or a mounted provider. Route-private transient state belongs near
  the route module. Form state belongs with the form. Do not hide cross-shell state in a route component.

## Target Shape

`App.tsx` should compose route modules and shell modules:

- `components/sidebar/Sidebar.tsx`
- `components/topbar/TopBar.tsx`
- `components/command-palette/CommandPalette.tsx`
- `components/file-finder/FileFinder.tsx`
- `components/home/HomeDashboard.tsx`
- `components/code-browser/CodeBrowserPage.tsx`
- `components/right-rail/RightRail.tsx`
- `components/settings/SettingsPanel.tsx`
- `components/auth/SetupPanel.tsx`
- `components/auth/AuthProvider.tsx`
- `components/auth/providerAuthAdapters.ts`
- `components/app-events/AppEventBridge.tsx`
- `components/repository/RepositoryPage.tsx`
- `components/repository/FileBlamePanel.tsx`
- `components/repository/CommitHistoryPanel.tsx`
- `components/collection/MailboxRoute.tsx`
- `components/collection/RepositoriesRoute.tsx`
- `components/collection/OrganizationsRoute.tsx`
- `components/collection/collectionUi.tsx`
- `components/areas/LocalAreaHome.tsx`
- `components/areas/AreaTopbarSelector.tsx`
- `components/areas/SshAreaDialog.tsx`
- `components/areas/AreaEditDialog.tsx`
- `components/areas/AreaDeleteDialog.tsx`
- `components/dialogs/AddRepositoryDialog.tsx`

Names can change if the implementation shows a better local convention, but ownership should not drift back into
`App.tsx`.

## Shift 1: Shared Query Hooks

**Problem:** Some queries are consumed by several routes or shell modules. Moving them into the first tab or route that
needs them would create false ownership and duplicated query plans.

**Action:**

- Add shared hooks under `src/renderer/src/hooks/`:
  - `useRepositoryDirectory(limit)` for `["repositories", limit]`.
  - `useAccountWork(login, limit)` for account issue and account pull work lists.
  - `useRepositoryRefs(owner, repo, enabled, limit)` for branch and tag lists.
  - `useRepositoryIssueResources(owner, repo, enabled)` for labels, assignable users, and milestones.
- Keep these hooks small and query-specific. They are shared query modules, not broad route modules.
- `useRepositoryDirectory` may still be called from `App.tsx` while Sidebar, TopBar, HomeDashboard, AddRepositoryDialog,
  CommandPalette, and RepositoriesRoute all need the same directory data.
- `useAccountWork` should be shared by Home and Mailbox rather than owned by Mailbox alone.
- `useRepositoryRefs` should remain shared while Code, Pulls, Actions, Releases, Security, Settings, FileFinder, and
  markdown routing all need refs.
- `useRepositoryIssueResources` should be called inside Issues and Pull Requests tab hooks. React Query deduplicates the
  shared keys.

**Done when:**

- Shared queries have one query-key implementation.
- Callers no longer hand-copy query options for repository directory, account work, repository refs, or issue resources.
- The hooks do not expose unrelated route state or mutation callbacks.

## Shift 2: Tab Query Ownership

**Problem:** Repository tab files exist, but most tabs still depend on `App.tsx` for list queries, limits, refresh
plans, and mutation plumbing. That keeps tab behavior hard to reason about and makes `App()` the test surface.

**Action:**

Each tab module should export the same ownership shape where it applies:

```ts
export interface XxxTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
}

export function prefetchXxxTabData(queryClient: QueryClient, input: XxxTabPrefetchInput): Promise<void>;
export function useXxxTabQueries(
  owner: string,
  repo: string,
  enabled: boolean,
  limit?: number
): XxxTabQueryResults;
export function useXxxTabState(): XxxTabLocalState;
export function clearXxxTabStateForTests(): void;
```

The tab component should own its local `useQuery` calls through `useControlApi()`, retained filter/focus state where
state must survive unmounts, local error boundary, and focused tests. Module-level `Map` retention is allowed only for
bounded route-private state that must survive tab unmounts; every retained state map needs a test cleanup export and a
clear eviction/cleanup story. Shared, durable, or cross-shell state belongs in `useUiStore` or a mounted provider rather
than a module-level singleton.

Prefetch helpers are pure with respect to React lifecycle, not dependency-free. They must accept the concrete `api`
client or provider adapter explicitly in their input rather than calling `useControlApi()` outside React or closing over
hidden globals.

**Tab query ownership map:**

| Tab                     | Queries owned by the tab module                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `WikiTab`               | repository wiki, already partly owned                                                                                                     |
| `DiscussionsTab`        | discussions list, discussion detail, categories                                                                                           |
| `AgentsTab`             | issue, pull request, and workflow-run previews                                                                                            |
| `ProjectsTab`           | projects list; may compose issue/pull inputs through shared hooks when needed                                                             |
| `ReleasesTab`           | releases list; compose refs through `useRepositoryRefs`                                                                                   |
| `ActionsTab`            | workflow runs, workflow definitions, workflow-run detail, job logs; compose refs through `useRepositoryRefs`                              |
| `IssuesTab`             | issues plus `useRepositoryIssueResources`                                                                                                 |
| `CodeTab`               | contents, README, root markdown, commits, and code-surface state; compose refs through `useRepositoryRefs`                                |
| `PullRequestsTab`       | pull list, PR subresources, base branch protection; compose refs and issue resources through shared hooks                                 |
| `SecurityQualityTab`    | branch protection, Dependabot alerts, code scanning alerts, secret scanning alerts, rulesets, advisories, security policy, community data |
| `RepositorySettingsTab` | repository access and forks; collaborator profile/repository lookups; save state remains local form/mutation state, not a query           |

Warm tabs (`code`, `issues`, `pulls`, `actions`) should initially preserve current behavior by letting `App.tsx` call
the tab query hooks with the same `shouldLoadRepositoryTab(tab)` enabled gate. The tab component can call the same hook
with `enabled: true`; React Query deduplicates identical keys. Shift 11 removes the legacy gate and leaves explicit
prefetch helpers as the final mechanism.

**Done when:**

- Repository tab list/detail queries live with the tab modules or tab-local hooks.
- `App()` does not contain tab-specific query keys or tab-specific `fetchQuery` refresh plans.
- Warmed tabs export prefetch helpers and have tests proving the helpers can run without mounting the tab.
- Tab crashes are contained without blanking the whole repository route.
- Retained state maps are bounded, test-resettable, and used only for route-private UI state.

**Do not count as done:**

- Passing the same tab data through a new `RepositoryPage` view model.
- Centralizing all repository queries into one `useRepositoryQueries` module.

## Shift 3: RepositoryPage Prop Collapse

**Problem:** `RepositoryPage` is a shallow module. Its interface is nearly as complex as the implementation because
`App()` computes and passes tab data, query status, pagination limits, refresh callbacks, mutation state, and route
actions as a giant prop bundle.

**Action:**

- Move `RepositoryPage` into `src/renderer/src/components/repository/RepositoryPage.tsx`.
- Collapse the prop surface from roughly 180 props to a route-level interface of about 20 props:
  - `repository`
  - `githubReady`
  - `mutation`, `mutationAction`, `mutationPending`, `mutationSucceeded`, `mutationError`
  - `onOpenExternal`, `onOpenRepository`, `onMutate`, `onOpenCodePath`
  - `onOpenWorkflowRun`, `onOpenIssueReference`, `onOpenPullRequestCommit`
  - `onOpenPullRequestReviewCommit`, `onOpenPullRequestTimelineEventCommit`
  - `onOpenCodeBrowser`, `onOpenWorkflowRunReference`, `onSelectCodeRef`, `onOpenLinkedIssue`
- Tab components should receive only repository context, their consolidated query-result objects, and their specific
  callbacks.
- Keep shared repository refs out of a single tab until all consumers have moved to a deeper shared refs module.

**Done when:**

- `App()` no longer passes repository tab lists, loading flags, availability objects, and tab-specific callbacks into
  `RepositoryPage`.
- `RepositoryPage` has a narrow interface that can be understood without reading the tab implementations.
- Repository detail, refs, code surface, and right-rail refresh behavior are covered by existing App integration tests
  or focused repository-shell tests.

**Do not count as done:**

- Moving `RepositoryPage` into a new file while preserving a 100-plus-prop interface.
- Creating a global repository context that contains every query result and mutation callback.

## Shift 4: Timeline Extraction

**Problem:** Issues, Pull Requests, and Discussions each carry near-duplicated timeline comment rendering. Issues and
Pull Requests also duplicate a thread wrapper. This duplication blocks tab cleanup and makes mutation affordances
drift.

**Action:**

- Extract `TimelineComment` into `src/renderer/src/components/shared/TimelineComment.tsx`.
- Extract `TimelineThread` into `src/renderer/src/components/shared/TimelineThread.tsx`.
- Pull the base comment behavior from `IssuesTab`, then adapt the shared interface so Pull Requests and Discussions can
  pass their route-specific actions.
- Use `TimelineThread` only for Issues and Pull Requests. Discussions should continue to own its two-level discussion
  thread rendering, accepted answer presentation, and `isDiscussionDetailComment` handling while using shared
  `TimelineComment`.

**Done when:**

- `IssuesTab`, `PullRequestsTab`, and `DiscussionsTab` import shared `TimelineComment`.
- `IssuesTab` and `PullRequestsTab` import shared `TimelineThread`.
- No tab loses edit/delete/reply disabled-state behavior or markdown routing.

## Shift 5: Collection Route Decomposition

**Problem:** `CollectionView` mixes Mailbox, Repositories, and Organizations behind one shallow interface. Its caller
must know all three workflows even when only one route is active.

**Action:**

- Replace `CollectionView` with route-owned modules:
  - `src/renderer/src/components/collection/MailboxRoute.tsx`
  - `src/renderer/src/components/collection/RepositoriesRoute.tsx`
  - `src/renderer/src/components/collection/OrganizationsRoute.tsx`
  - `src/renderer/src/components/collection/collectionUi.tsx`
- `collectionUi.tsx` should contain only collection-specific helpers and small UI primitives:
  - `matchesCollectionFilter(values, query)`
  - `ListLoadingState`
  - `ListErrorState`
  - `ListAvailabilityBanner`
  - `ListPaginationFooter`
  - `ListEmptyState`
- Do not move generic helpers into `collectionUi.tsx`. `formatRelativeDate` and `formatCompactNumber` stay in
  `utils/format.ts`; `readAvailabilityMessage` stays in repository UI/shared availability helpers.

**Route ownership:**

- `MailboxRoute` owns notifications, notification optimistic updates, notification filter/limit state, and composes
  `useAccountWork()` for account issues and pulls.
- `RepositoriesRoute` composes `useRepositoryDirectory()`, owns repository list filter state, list expansion UI, and
  repository pin UI state unless pin ownership moves to a shared pin hook.
- `OrganizationsRoute` owns organizations, teams, repositories, members, team repositories, team members, projects,
  selected organization/team/member/project state, member profile lookups, and retained organization route state.

**Done when:**

- `App()` renders one route module per collection route with a small route-level interface.
- Mailbox notification optimistic updates are local to `MailboxRoute`.
- Organization selection and limit state are local to `OrganizationsRoute`.
- Repository filtering, expansion, and pin UI state are local to `RepositoriesRoute` or a shared pin hook used by
  multiple modules.

**Do not count as done:**

- Splitting the JSX but leaving all collection queries, limits, and optimistic updates in `App()`.

## Shift 6: Areas And Workspaces Domain

**Problem:** The plan cannot reach a thin shell if it only decomposes GitHub routes. `App.tsx` still owns the
local/SSH/area workflow, including local repository lists, area selection UI, and area CRUD dialogs.

**Action:**

- Extract the areas surface into `src/renderer/src/components/areas/`:
  - `LocalAreaHome.tsx`
  - `AreaTopbarSelector.tsx`
  - `SshAreaDialog.tsx`
  - `AreaEditDialog.tsx`
  - `AreaDeleteDialog.tsx`
- Keep area and workspace query hooks close to the area route unless another shell module has a real shared need.
- Keep active route, selected area, and selected local repository in `useUiStore`, because Sidebar, TopBar, area
  selectors, and local repository routes all observe them.
- Move local repository filter/limit state, workspace presentation state, and area dialog form state into the area
  modules or into narrow area hooks.
- Keep process-wide area IPC subscriptions out of the area route. Those listeners belong to Shift 7 so invalidations do
  not depend on the area route being mounted.

**Done when:**

- `App()` renders the local/SSH/area workflow through a small area route interface.
- Area CRUD dialogs are no longer inline in `App.tsx`.
- Cross-shell area selection remains in `useUiStore`; local repository list state and local workspace presentation state
  are owned by area modules or narrow area hooks.
- Area route tests cover create/edit/delete dialog behavior and local repository selection.

**Do not count as done:**

- Moving `LocalAreaHome` into a new file while still requiring `App()` to compute area form state, list state, and every
  area-specific transition.
- Hiding selected area state inside `LocalAreaHome` where Sidebar and TopBar cannot observe it through the normal store
  seam.
- Moving area IPC listeners into `LocalAreaHome`, because that can miss invalidations when the route unmounts.

## Shift 7: App Event Bridge And Query Cache Tracking

**Problem:** `App.tsx` currently bridges Electron/main-process push events into React Query invalidations and renderer
loading diagnostics. That lifecycle is global, but it is mixed into the UI shell and is not accounted for by tab or route
decomposition.

**Action:**

- Add a shell-mounted, renderless module such as `src/renderer/src/components/app-events/AppEventBridge.tsx` or a
  `useAppEventBridge()` hook.
- Move process-wide IPC listeners into that module:
  - `api.onAreasUpdated`
  - `api.onAreaRepositoryUpdated`
  - `api.onAreaWorkspaceUpdated`
  - `api.onGitHubRepositoriesUpdated`
  - any auth/session/cache update listener that invalidates global query state
- Move query-cache fetch-status tracking into the same bridge or into a sibling `useRendererLoadingDiagnostics()` hook.
- Keep the bridge mounted for the lifetime of the app shell, not inside a route module.
- Make the bridge depend on narrow invalidation helpers where possible, but do not hide route-owned query keys behind a
  new all-purpose invalidation registry.
- Each owner module should export focused invalidation helpers for event bridge use, for example
  `invalidateAreaQueries(queryClient, event)` or `invalidateRepositoryDirectory(queryClient)`. The bridge composes these
  helpers instead of duplicating owner query keys inline.
- Boot-time event loss must be harmless. Either preload/main queues important events until the renderer registers
  listeners, or the bridge performs an initial sync/invalidation pass after mounting so events emitted between window
  load and listener registration are covered.

**Done when:**

- `App.tsx` no longer contains direct IPC subscription effects.
- Query-cache loading diagnostics are not embedded in `App()`.
- Tests or focused harness coverage prove global listeners invalidate the same query keys after extraction.
- Route modules can unmount without dropping process-wide invalidation listeners.
- Tests cover either pre-mount event queueing or the initial sync path that makes missed early events safe.

**Do not count as done:**

- Moving listener effects into the first route that needs the data.
- Creating a broad "invalidate everything" bridge that masks missing ownership.
- Repeating route-owned query keys directly inside `AppEventBridge` when the owning route/hook can export a focused
  invalidation helper.

## Shift 8: Provider Auth And Setup Ownership

**Problem:** GitHub sign-in polling is currently entangled with `SettingsPanel`, but provider authentication and
connectivity are app-level concerns. Device-flow polling and session completion must continue even if the user leaves
Settings, lands on Home unauthenticated, or is shown the setup panel. At the same time, this seam must not collapse the
app back into a linear GitHub-only model: local paths and future version-control providers need a place in the same
connectivity model without forcing fake GitHub concepts onto them.

**Action:**

- Extract `SetupPanel` to `src/renderer/src/components/auth/SetupPanel.tsx`.
- Extract auth orchestration into one shell-mounted `AuthProvider`/`AuthController` module. It may expose a hook for
  consumers, but the hook reads the mounted controller; it must not create polling timers per caller.
- Model auth/connectivity by provider or area kind. GitHub device flow is the first concrete adapter; local paths should
  remain a no-auth/local-connectivity adapter; future providers can add their own adapter without changing Settings,
  Setup, or Home call sites.
- The auth controller owns provider session state, device-flow session state, polling, completion, cancellation, and
  app-state invalidation.
- `SettingsPanel` may render sign-in controls and status for the selected provider, but it receives an auth controller
  interface and must not own polling.
- Home, Setup, Settings, and any future auth gate should read the same mounted controller rather than independently
  polling.
- Keep the interface small: provider status, start/cancel sign-in, retry/refresh, and the current session result. Do not
  introduce a broad provider abstraction over GitHub-specific repository workflows in this shift.

**Done when:**

- Leaving Settings while a sign-in is in progress does not drop polling or completion.
- `SettingsPanel` is a settings surface, not the owner of app authentication lifecycle.
- Multiple consumers can read auth state without starting duplicate timers.
- Local path areas continue to work without pretending to authenticate through GitHub.
- Setup and settings tests cover unauthenticated, polling, success, error, and cancellation states.

**Do not count as done:**

- Moving the existing Settings sign-in state into `components/settings/SettingsPanel.tsx` unchanged.
- Exporting a plain `useGitHubSignIn()` hook that starts its own polling loop every time a component calls it.
- Replacing concrete GitHub tabs with premature generic provider abstractions before another provider needs those
  workflows.

## Shift 9: Modals And Utility Panels

**Problem:** `App.tsx` still contains global utility surfaces that are neither route dispatch nor shell composition:
`AddRepositoryDialog`, `FileBlamePanel`, and `CommitHistoryPanel`.

**Action:**

- Extract `AddRepositoryDialog` to `src/renderer/src/components/dialogs/AddRepositoryDialog.tsx`.
- Extract `FileBlamePanel` to `src/renderer/src/components/repository/FileBlamePanel.tsx`.
- Extract `CommitHistoryPanel` to `src/renderer/src/components/repository/CommitHistoryPanel.tsx`.
- Localize dialog ownership when only one route opens the dialog. Introduce a global dialog manager only if multiple
  unrelated routes need the same dialog lifecycle and a small manager interface is clearer than prop threading.
- Keep repository utility panels near repository/code ownership, not in the app shell.

**Done when:**

- Utility panel rendering and keyboard/panel state are not inline in `App.tsx`.
- Add-repository form state and validation live with the dialog or a narrow dialog hook.
- Blame and commit-history panels preserve code-browser/repository route behavior with focused tests.

**Do not count as done:**

- Creating a global dialog manager as a dumping ground for every modal before the actual ownership need exists.

## Shift 10: Deep Shell Component Extraction

**Problem:** Several independent shell modules still live inline in `App.tsx`, which makes the app shell difficult to
scan and keeps local state close to unrelated route logic. Simply moving them to new files would still be shallow if
`App()` keeps computing all of their local state and callbacks.

**Action:**

Extract the remaining shell modules:

| Current module    | Approx. lines | New file                                        |
| ----------------- | ------------- | ----------------------------------------------- |
| `Sidebar`         | 1,057         | `components/sidebar/Sidebar.tsx`                |
| `TopBar`          | 410           | `components/topbar/TopBar.tsx`                  |
| `CommandPalette`  | 706           | `components/command-palette/CommandPalette.tsx` |
| `FileFinder`      | 278           | `components/file-finder/FileFinder.tsx`         |
| `HomeDashboard`   | 346           | `components/home/HomeDashboard.tsx`             |
| `CodeBrowserPage` | 589           | `components/code-browser/CodeBrowserPage.tsx`   |
| `RightRail`       | 292           | `components/right-rail/RightRail.tsx`           |
| `SettingsPanel`   | 310           | `components/settings/SettingsPanel.tsx`         |

Move local state and local queries with the module when the state/query is not shared. `CommandPalette` should own
file-search query execution and result navigation state. `FileFinder` should own fuzzy matching and active result
state. `Sidebar`, `TopBar`, and `RightRail` should either subscribe to narrow store slices themselves or receive compact
view models; they should not inherit a large `App()` navigation/callback bundle. `SettingsPanel` receives the shell auth
controller from Shift 8 and must not own GitHub sign-in polling.

**Done when:**

- No top-level shell module implementations remain in `App.tsx`.
- `App.tsx` contains no command-palette keyboard navigation, file-finder matching, auth polling, settings internals, or
  topbar menu implementation details.
- Existing command palette, file finder, settings, topbar, and sidebar App tests are preserved or moved to focused
  module tests.
- Shell modules have documented interfaces small enough to review without reading `App.tsx`.

**Do not count as done:**

- Extracting modules that still require `App()` to compute every local state transition.
- Passing a single broad `shellProps` object that contains the old prop bundle under a new name.

## Shift 11: Warm Prefetch Consolidation

**Problem:** `App.tsx` owns a large set of `queryClient.fetchQuery` refresh and warm-prefetch paths. That makes new
route modules easy to forget during refresh and keeps cache behavior centralized in the wrong module.

**Action:**

- Remove `repositoryWarmPrefetchTabs` and `shouldLoadRepositoryTab` from `App.tsx` as the final prefetch cleanup.
- Each warm tab exports a pure prefetch helper:
  - `prefetchCodeTabData(queryClient, { api, owner, repo, ref })`
  - `prefetchIssuesTabData(queryClient, { api, owner, repo })`
  - `prefetchPullsTabData(queryClient, { api, owner, repo })`
  - `prefetchActionsTabData(queryClient, { api, owner, repo })`
- Collection routes export pure route prefetch helpers where useful:
  - `prefetchMailboxData(queryClient, { api, ...input })`
  - `prefetchRepositoriesData(queryClient, { api, ...input })`
  - `prefetchOrganizationsData(queryClient, { api, ...input })`
- App-level route handlers may call prefetch helpers for warm tabs. The shell can keep a small dispatcher, but it must
  compose helpers rather than rebuild their query plans.
- Move route-specific refresh plans into owning modules as `refreshXxxData()` exports. `refreshRepositorySurface()` may
  remain the master dispatcher, but it should call owned refresh helpers instead of duplicating query keys.

**Done when:**

- `App.tsx` no longer contains large tab-specific `queryClient.fetchQuery` blocks.
- Warm prefetch for high-traffic repository tabs remains covered by tests.
- Route-level refresh calls delegate to owning modules instead of duplicating query keys in the shell.
- Prefetch helpers accept their `api` or provider adapter dependency explicitly and do not call React hooks outside the
  component tree.

**Do not count as done:**

- Moving the big `fetchQuery` block into one new utility module with the same centralized ownership problem.
- Leaving both the legacy `shouldLoadRepositoryTab` gates and explicit prefetch helpers as permanent mechanisms.

## Committed Batches

| Batch | Slice       | What                                                                                                                                                       |
| ----- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B0    | Prereq      | Extract `TimelineComment` and `TimelineThread` to shared modules.                                                                                          |
| B1    | Shift 1     | Extract `useRepositoryDirectory`, `useAccountWork`, and `useRepositoryRefs`.                                                                               |
| B2    | Shift 1 + 2 | Extract `useRepositoryIssueResources` plus tab query hooks for low-risk tabs: `WikiTab`, `DiscussionsTab`, `AgentsTab`, `ProjectsTab`, `ReleasesTab`.      |
| B3    | Shift 2     | Migrate medium-risk warm tabs: `ActionsTab` and `IssuesTab`.                                                                                               |
| B4    | Shift 2     | Migrate high-risk tabs: `CodeTab`, `PullRequestsTab`, `SecurityQualityTab`, and `RepositorySettingsTab`.                                                   |
| B5    | Shift 3     | Collapse `RepositoryPage` props from roughly 180 to roughly 20.                                                                                            |
| B6    | Shift 5     | Split `CollectionView` into `MailboxRoute`, `RepositoriesRoute`, `OrganizationsRoute`, and `collectionUi`.                                                 |
| B7    | Shift 6     | Extract Areas and Workspaces modules, including `LocalAreaHome`, `AreaTopbarSelector`, and area CRUD dialogs.                                              |
| B8    | Shift 7     | Extract the shell-mounted app event bridge and query-cache loading diagnostics.                                                                            |
| B9    | Shift 8     | Extract provider-aware auth orchestration and `SetupPanel`; remove auth polling from `SettingsPanel`.                                                      |
| B10   | Shift 9     | Extract `AddRepositoryDialog`, `FileBlamePanel`, and `CommitHistoryPanel`.                                                                                 |
| B11   | Shift 10    | Extract `Sidebar`, `FileFinder`, and `CodeBrowserPage`.                                                                                                    |
| B12   | Shift 10    | Extract `TopBar`, `CommandPalette`, and `HomeDashboard`.                                                                                                   |
| B13   | Shift 10    | Extract `RightRail` and `SettingsPanel` with a narrow auth-controller interface.                                                                           |
| B14   | Shift 11    | Consolidate warm prefetch, remove old `shouldLoadRepositoryTab` and `repositoryWarmPrefetchTabs`.                                                          |
| B15   | Cleanup     | Delete orphaned code, verify no dead imports, remove unused helper functions from `App.tsx`, and verify mutation invalidation still reaches moved queries. |

## Validation At Each Batch

- Run `bun run typecheck`.
- Run `bun run lint`.
- Run `bun run test`.
- Record the relevant command output in the batch notes or commit message.

Manual smoke test after major UI batches:

- Open a repository.
- Click through all 12 repository tabs.
- Verify data loads, fallback actions still route through the main-process external-link policy, and tab-local state
  survives expected route changes.
- Switch between GitHub, local, and SSH areas; verify area CRUD dialogs, local repository selection, and workspace data.
- Start GitHub sign-in, navigate away from Settings, and verify polling still completes or cancels through the global
  auth controller.
- Switch to a local path area while auth state changes and verify local navigation remains independent of GitHub
  authentication.

## Completion Evidence

Each Part 3 batch should report:

- `App.tsx` line count before and after.
- `App()` line count before and after when touched.
- Prop count at the changed seam before and after.
- Query hooks moved from `App.tsx` into the owning module.
- Warm prefetch or refresh behavior preserved, with the exact test that proves it.
- Process-wide listeners moved out of `App.tsx`, with the invalidated query keys listed.
- Auth/session lifecycle moved or preserved, including where provider-scoped polling remains mounted and how local paths
  bypass remote authentication.
- New or updated tests.
- Validation commands run.

## Final Acceptance

- `App.tsx` is under 800 lines, with a stretch goal under 500 lines, and is a thin shell module rather than the owner of
  repository tabs, collection routes, area workflows, command/search flows, auth polling, dialogs, and settings
  internals.
- `RepositoryPage` has a narrow route-level interface and no giant prop bundle.
- Mailbox, Repositories, and Organizations are separate route modules with local query ownership.
- Areas and Workspaces are separate domain modules with local state ownership and no inline CRUD dialogs.
- Shell modules live outside `App.tsx` and have deep seams instead of broad prop bundles.
- Process-wide IPC listeners and query-cache diagnostics live in a shell-mounted event bridge with owner-exported
  invalidation helpers and boot-time event safety.
- Provider auth polling is owned by one shell-mounted auth controller, not by `SettingsPanel` or per-consumer hooks.
- Local path areas remain first-class and do not depend on GitHub authentication state.
- Add-repository, blame, and commit-history utility surfaces live outside `App.tsx`.
- High-traffic tabs own queries, state retention, prefetch helpers, and error boundaries.
- No broad centralized `fetchQuery` block remains in `App.tsx`.
- `bun run format`, `bun run lint`, `bun run typecheck`, and `bun run test` pass before the cleanup branch is
  considered complete.
