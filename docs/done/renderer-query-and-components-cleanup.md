# Renderer Query And Component Cleanup Record

## Scope

This plan covers renderer behavior that creates stale data risk, excessive GitHub/API pressure, unstable component
ownership, and difficult-to-maintain inline functions. The renderer should stay responsible for presentation and client
interaction, while query ownership and mutation semantics should be extracted into smaller modules that can be tested
without rendering full repository tabs.

## RENDER-01: Make Branch Protection Forms Load-Aware And Non-Destructive

### Current Evidence

- Form state is initialized from an async snapshot:
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:570` initializes
    `branchRequiresReviews`.
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:573` initializes
    `branchRequiredApprovals`.
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:576` initializes
    `branchEnforceAdmins`.
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:579` initializes
    `branchRequireLinearHistory`.
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:582` initializes
    `branchRequireConversationResolution`.
- Submit disablement does not wait for loaded protection data:
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:761` computes
    `branchProtectionDisabledReason`.
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:762-763` only blocks admin-disabled
    state or missing branch.
- Payload sends destructive defaults:
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:940` computes approval count.
  - `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:941-950` builds a payload with
    `required_status_checks: null` and current local booleans.
- Main also treats this as a full `PUT`; see `MAIN-07`.

### Failure Mode

The form can be rendered and submitted before branch protection is loaded. Defaults like `false`, `1`, and `null` can
replace real GitHub settings. The UI and main-process mutation semantics both need to agree whether this is a full
replacement or a safe patch.

### Proposed Change

1. Create a branch-protection draft hook, for example `useBranchProtectionDraft`.
2. Key the draft by `{ owner, repo, branch, protectionUpdatedAtOrSnapshotId }`.
3. Do not allow update submit until one of these is true:
   - existing protection has loaded and has been copied into the draft.
   - the user is explicitly creating new branch protection from an empty draft.
4. Preserve unedited fields:
   - status checks
   - restrictions
   - review dismissal/code owner/last push settings
   - force pushes, deletions, lock branch, fork syncing, and conversation resolution
5. Move branch-protection payload construction out of the JSX component and test it as a pure function.
6. Coordinate with `MAIN-07` so renderer payload shape matches provider semantics.

### Verification

- Add focused unit tests for the draft/payload helper:
  - loaded protection with status checks preserves status checks when toggling only admins.
  - loaded restrictions survive review-count edits.
  - missing protection data disables update unless create mode is explicit.
- `bun run test -- src/renderer/src/components/repository/settings`
- Manual test against a repo branch with required checks and restrictions: editing review count does not clear checks.

## RENDER-02: Gate Pull Request Detail Fan-Out

### Current Evidence

- Refresh fetches all focused PR subresources:
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:225` branches on focused PR.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:233-245` starts overview, comments,
    and files refreshes, with additional subresources continuing below.
- Selection immediately starts nine detail queries:
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:338` starts overview.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:343` starts comments.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:348` starts files.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:353` starts commits.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:358` starts reviews.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:363` starts checks.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:368` starts review threads.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:373` starts timeline.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:378` starts linked issues.
  - `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:383-393` aggregates all nine queries.

### Failure Mode

Selecting one PR causes a burst of IPC and GitHub requests, even if the user only needs overview information. Large PRs
amplify the cost through files, timeline, review thread, and checks requests. Partial failures become noisy because one
selection owns too many independent reads.

### Proposed Change

1. Split PR detail queries into tiers:
   - tier 1: overview only
   - tier 2: lightweight comments/reviews/checks summary
   - tier 3: heavy files, timeline, review threads, linked issues
2. Enable tier 3 only when the corresponding section is visible, expanded, or specifically requested by inspection UI.
3. Change refresh behavior so the active section controls which PR subresources refresh.
4. Add route state for expanded/visible PR sections if it needs to survive navigation.
5. Keep cache keys stable; do not conflate "not requested yet" with unavailable data.
6. Add tests that selection only fires the tier-1 query, and expanding files fires the files query.

### Verification

- `bun run test -- src/renderer/src/components/repository/pull-requests`
- React Query test with mocked API call counters.
- Manual profile with a large PR: selection does not request files/timeline/review threads until visible.

## RENDER-03: Move Query And Refresh APIs Out Of Tab Component Files

### Current Evidence

- Route orchestration imports hooks from tab component modules:
  - `src/renderer/src/hooks/useRepositoryRouteState.ts:5` imports `useActionsTabQueries` from `ActionsTab`.
  - `src/renderer/src/hooks/useRepositoryRouteState.ts:9` imports `useIssuesTabQueries` from `IssuesTab`.
  - `src/renderer/src/hooks/useRepositoryRouteState.ts:11` imports `usePullRequestsTabQueries` from
    `PullRequestsTab`.
  - `src/renderer/src/hooks/useRepositoryRouteState.ts:17` imports `useCodeBrowserQueries`.
- Refresh orchestration imports refresh functions from tab component modules:
  - `src/renderer/src/hooks/useRepositoryRefreshActions.ts:5` imports `refreshActionsTabData`.
  - `src/renderer/src/hooks/useRepositoryRefreshActions.ts:10` imports `refreshIssuesTabData`.
  - `src/renderer/src/hooks/useRepositoryRefreshActions.ts:12` imports `refreshPullRequestsTabData`.
  - `src/renderer/src/hooks/useRepositoryRefreshActions.ts:14-15` imports security/settings refresh functions.

### Failure Mode

Tab component files own too many responsibilities: JSX, interaction state, query keys, prefetch, and refresh contracts.
Any route-level change imports and potentially churns large UI files. This is a merge-pressure problem and a testing
problem.

### Proposed Change

1. Create per-surface query modules:
   - `ActionsTab.queries.ts`
   - `IssuesTab.queries.ts`
   - `PullRequestsTab.queries.ts`
   - `RepositorySettingsTab.queries.ts`
   - `SecurityQualityTab.queries.ts`
2. Move query keys, `use*Queries`, `prefetch*Data`, and `refresh*Data` into those modules.
3. Keep component files focused on rendering, local UI state, and event handlers.
4. Update route orchestration imports to depend on query modules, not tab components.
5. Add module-level tests where query/prefetch behavior is important.

### Verification

- `rg -n "from \"../components/repository/.+Tab\"" src/renderer/src/hooks` should not show route/query hooks importing
  tab component files for data APIs.
- `bun run test -- src/renderer/src/components/repository/repositoryTabPrefetch.test.ts`
- `bun run typecheck`

## RENDER-04: Decompose Giant Repository Surface Components

### Current Evidence

The AST scan found 137 functions/components at or above 80 lines and 553 JSX inline callbacks. Top renderer component
targets:

| Component/function      | Current span                                                                         | Primary ownership mixed together                                                     |
| ----------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `RepositorySettingsTab` | `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx:459-2094` | settings forms, collaborators, teams, branch protection, rulesets, mutation payloads |
| `SecurityQualityTab`    | `src/renderer/src/components/repository/security/SecurityQualityTab.tsx:601-2080`    | branch protection display, alerts, rulesets, advisories, policy/community panels     |
| `ActionsTab`            | `src/renderer/src/components/repository/actions/ActionsTab.tsx:446-1832`             | workflows list, dispatch, run detail, logs, artifacts, checks                        |
| `PullRequestsTab`       | `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx:646-1958`  | list, filters, focused detail, forms, branch protection, timeline resources          |
| `OrganizationsRoute`    | `src/renderer/src/components/collection/OrganizationsRoute.tsx:30-1298`              | org list, repos, projects, teams, members, profile limits                            |
| `IssuesTab`             | `src/renderer/src/components/repository/issues/IssuesTab.tsx:336-1346`               | list, filters, forms, details, comments, labels/milestones                           |
| `ProjectsTab`           | `src/renderer/src/components/repository/projects/ProjectsTab.tsx:105-995`            | project list, details, fields, item editing                                          |
| `RepositoryPage`        | `src/renderer/src/components/repository/RepositoryPage.tsx:231-988`                  | route shell, tabs, top-level repository composition                                  |
| `App`                   | `src/renderer/src/App.tsx:66-763`                                                    | app routes, command handling, shell state, modal state                               |

### Failure Mode

Large components are harder to review, harder to test, and encourage inline lambdas because there are no smaller
component boundaries to receive stable props. They also create wide merge conflicts when multiple feature branches touch
one surface.

### Proposed Change

1. Do not start with arbitrary extraction. Split by user-facing sub-surface and data ownership.
2. Target first extraction wave:
   - `RepositorySettingsTab`: `BranchProtectionCard`, `RepositoryRulesetsCard`, `CollaboratorAccessCard`,
     `RepositoryFeatureSettingsForm`, `DangerZone`.
   - `ActionsTab`: `WorkflowRunList`, `WorkflowDispatchForm`, `WorkflowRunDetail`, `WorkflowArtifactsPanel`,
     `WorkflowChecksPanel`.
   - `PullRequestsTab`: `PullRequestList`, `PullRequestDetailShell`, `PullRequestTimelinePanel`,
     `PullRequestFilesPanel`, `PullRequestChecksPanel`.
   - `OrganizationsRoute`: `OrganizationList`, `OrganizationRepositoriesPanel`, `OrganizationTeamsPanel`,
     `OrganizationMembersPanel`.
3. Extract pure derived-state helpers before extracting JSX where logic is tightly coupled.
4. Keep route state in hooks or stores; avoid passing 20 prop callbacks through several layers.
5. Add tests around extracted pure functions and high-risk interaction boundaries, not every visual component.

### Verification

- Repeat the AST scan and compare:
  - no repository tab component above 700 lines after first wave.
  - no nested anonymous function above 80 lines in production renderer files.
  - JSX inline callback count decreases on touched surfaces.
- `react-doctor . --offline --verbose` should show fewer `no-giant-component` warnings for touched files.
- `bun run test`, `bun run typecheck`, and targeted component tests pass.

## RENDER-05: Replace Render-Time Collection Derivation In OrganizationsRoute

### Current Evidence

- `src/renderer/src/components/collection/OrganizationsRoute.tsx:106` owns `collectionFilter`.
- `src/renderer/src/components/collection/OrganizationsRoute.tsx:108` computes `normalizedCollectionFilter`.
- `src/renderer/src/components/collection/OrganizationsRoute.tsx:110-121` filters organizations during render.
- `src/renderer/src/components/collection/OrganizationsRoute.tsx:128-149` copies, sorts, and filters organization
  repositories during render.
- `src/renderer/src/components/collection/OrganizationsRoute.tsx:150-163` filters projects during render.
- `src/renderer/src/components/collection/OrganizationsRoute.tsx:167-202` filters teams, team repositories, team
  members, and org members during render.

### Failure Mode

Every route state or query status change recomputes several lists. It also keeps route selection, profile limits, and
collection filtering in one 1,269-line component.

### Proposed Change

1. Extract `useOrganizationRouteDerivedState`.
2. Memoize each derived list by source collection and normalized filter.
3. Prefer `toSorted()` or a single-pass helper where applicable.
4. Move selected organization/team/member resolution into the hook.
5. Add focused tests for filtering, sorting, and selected fallback behavior.

### Verification

- `bun run test -- src/renderer/src/components/collection`
- React Doctor no longer reports combine-iteration issues for this route if touched.
- Manual large-org smoke test: typing in the filter remains responsive.

## RENDER-06: Reduce Inline JSX Callback Churn

### Current Evidence

AST scan found the highest JSX inline callback counts in:

| File                                                                        | Inline JSX callbacks |
| --------------------------------------------------------------------------- | -------------------: |
| `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx`  |                   55 |
| `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx` |                   47 |
| `src/renderer/src/components/repository/issues/IssuesTab.tsx`               |                   39 |
| `src/renderer/src/components/repository/actions/ActionsTab.tsx`             |                   36 |
| `src/renderer/src/components/repository/security/SecurityQualityTab.tsx`    |                   32 |
| `src/renderer/src/components/shell/RepositoryRouteSection.tsx`              |                   32 |
| `src/renderer/src/components/collection/OrganizationsRoute.tsx`             |                   28 |
| `src/renderer/src/App.tsx`                                                  |                   24 |

### Failure Mode

Inline callbacks inside large maps and nested panels create unnecessary referential churn and hide command intent inside
JSX. The bigger problem is usually missing subcomponents or missing action objects, not the existence of a lambda by
itself.

### Proposed Change

1. For repeated rows, extract row components that receive stable domain callbacks:
   - `onOpenPull(number)`
   - `onRunWorkflow(id)`
   - `onToggleLabel(name)`
2. For form submissions, move submit handlers above JSX and name them after the command.
3. For large maps, move row event creation into the row component or a small action factory.
4. Do not wrap every handler in `useCallback` by default. Add stable callbacks only when memoized children depend on
   them.
5. Track progress by file using the AST callback counts above.

### Verification

- AST scan shows touched files have lower inline callback counts.
- `react-doctor . --offline --verbose` shows fewer component warnings for touched surfaces.
- Existing interaction tests still pass.

## RENDER-07: Replace Blocking Native Confirmation Dialogs With App-Owned Confirm Flows

### Current Status

The production renderer no longer has `window.confirm` usage. Gateway operations, dangerous GitHub mutations, and
notification unsubscribe now route through the shared app confirmation flow:

- `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx` requests confirmation from the gateway
  operation preview before calling the privileged main-process operation with `confirmed: true`.
- `src/renderer/src/components/shell/RepositoryRouteSection.tsx` requests confirmation before dangerous GitHub
  mutations.
- `src/renderer/src/components/collection/MailboxRoute.tsx` requests confirmation before notification unsubscribe.
- `src/renderer/src/components/dialogs/ConfirmDialog.tsx` renders the shared modal, with tests covering confirm,
  cancel, and Escape behavior.

Original evidence:

- Gateway operation confirmation:
  - `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx:208` uses `window.confirm`.
- Dangerous GitHub mutation confirmation:
  - `src/renderer/src/components/shell/RepositoryRouteSection.tsx:162` uses `window.confirm`.
- Notification unsubscribe:
  - `src/renderer/src/components/collection/MailboxRoute.tsx:319` uses `window.confirm`.

### Failure Mode

Native blocking dialogs do not match the app shell, are hard to test, and cannot show structured operation risk
details. For gateway operations they also create the misleading impression that renderer confirmation is the security
boundary. Main enforcement is covered by `MAIN-01`; this task is UI quality and predictable behavior.

### Proposed Change

1. Add a shared confirmation provider or modal component.
2. Model confirmations as typed commands:
   - gateway operation preview
   - dangerous GitHub mutation
   - notification unsubscribe
3. Ensure keyboard, focus, cancel, and pending states are covered.
4. Keep final authorization in main for privileged operations.
5. Add component tests for confirm/cancel behavior.

### Verification

- `rg -n "window\\.confirm|confirm\\(" src/renderer/src` shows no production renderer usage.
- `bun run test -- src/renderer/src/components`
