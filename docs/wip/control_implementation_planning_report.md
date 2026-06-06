# Control main: implementation planning report for repository UX parity, theme consistency, local repository parity, and cache redesign

Prepared for: `NarukeAlpha/Control` on `main`  
Date: 2026-06-05  
Primary intent: give GPT-5.5 a `/goal` prompt and a worktree-ready implementation plan.

---

## 0. High-confidence diagnosis

Control is not starting from a blank slate. The app already has a broad Electron/React/Vite repository shell, React Query data flows, GitHub provider caching, repository tabs, local repository areas, projects/wiki/security/settings/mailbox/organizations surfaces, and an existing E2E benchmark suite. The issue is not “build everything from zero”; the issue is that the product is at a stage where the UI system, detail-page composition, GitHub parity, local/remote parity, and cache policy need to be made coherent.

The largest problems are cross-cutting:

1. **The visual system is not consistently enforced.** There are theme variables and glass modes, but many surfaces still feel like independently assembled components. Dark theme is the best audit mode because it exposes hard-coded surfaces, weak contrast, inconsistent radii, and mixed macOS/GitHub visual language.
2. **Issues and pull requests need a GitHub-like detail architecture.** Today the issue and PR detail bodies are mostly linear stacks after a list/preview split. The desired model is a detail page with the conversation/timeline as the main column and labels/assignees/reviewers/projects/milestones/status/configuration on a right rail.
3. **“GitHub fallback” copy/buttons should be removed from repository management flows.** External links can remain where useful, but the product should not present core GitHub surfaces as incomplete fallbacks.
4. **Open/closed filtering should be first-class state, not text filtering.** Issues and PRs should default to open and use open/closed/all state in query keys, API inputs, routing state, prefetch, refresh, and tests.
5. **Actions/projects/wiki/security/settings/orgs/mailbox have substantial implementations, but need parity, polish, error containment, and terminology cleanup.** These should not be treated as dummy-only rewrites. They need focused completion and UX coherence.
6. **The local repository experience is a separate shim.** It has its own tabs, panels, string rows, square/surface quirks, and only thin GitHub-connected lists. It should be migrated toward shared repository chrome and shared GitHub-like tab/detail components.
7. **The current cache model uses TTLs, stale hits, and background refresh.** That is better than no caching, but the next iteration should add lightweight validation and event/mutation-driven invalidation so the app can trust cached data without periodic broad refetching.
8. **Liquid glass needs a dedicated macOS validation pass.** The current native glass setup intentionally uses an opaque backing, which is a likely contributor to “the app does not bleed through anything below it.” This should be tested deliberately rather than tweaked blindly.
9. **Visual regression must become mandatory for this phase.** The requested work is largely visual and layout-driven. Every worktree should include full-window Electron screenshots in light/dark/glass/solid modes.

---

## 1. Primary `/goal` prompt for GPT-5.5

Use this as the top-level prompt for a GPT-5.5 implementation session. It is intentionally long and explicit.

```text
/goal
You are working in NarukeAlpha/Control on the main branch. Implement the next repository UX iteration as a set of coherent, tested changes, not isolated patches. The product is a local-first Electron/React/TypeScript GitHub desktop client with React Query, a GitHub provider/cache layer, local Areas/gateway support, and theme/liquid-glass modes.

Core objectives:

1. Theme consistency and liquid glass
- Audit every repository, issue, PR, actions, projects, wiki, security/quality, settings, sidebar, organizations, mailbox, and local repository surface in dark theme first.
- Remove hard-coded colors, inconsistent radii, ad hoc borders/shadows, and component-specific surface treatments that bypass the theme token system.
- Normalize all UI through shared tokens/components: Surface, FilterBar, segmented state filter, IconButton, ExternalLinkButton, StateChip, DetailLayout, DetailRail, Timeline, Composer, and form controls where appropriate.
- Fix liquid glass behavior. Investigate Electron native glass settings, the BrowserWindow transparency/background, native `electron-liquid-glass` view options, `glass-shell`, `reduced`, and `solid` modes. The current behavior is counterintuitive: solid mode can show more background than glass, glass shell distorts too much, dark themes show weak liquid response, and the app itself does not bleed through windows below. Do not guess—capture full-window Electron screenshots and document before/after behavior.

2. Issues
- Remove “GitHub fallback” buttons/copy from issue list rows and issue preview/detail surfaces. Preserve a properly named “Open on GitHub” action only where it is deliberately useful, and place it in the full issue detail rail above the status.
- Add an open/closed state filter beside the issue text filter. Default to open issues. Prefer a state type such as `IssueStateFilter = "open" | "closed" | "all"`, even if the visible UI initially exposes only Open and Closed.
- Move state into query keys, API inputs, prefetch, refresh, route state, and tests. Do not load all issues and filter state in the renderer.
- Rebuild full issue detail to match GitHub’s layout: main timeline column on the left; configuration/status rail on the right. The rail should contain Open on GitHub, status, labels, assignees, milestone, linked PR/branch context if available, and issue actions. The timeline should contain the issue body, comments, state/label/assignment events, and branch/commit references in chronological order. The comment composer remains at the bottom of the timeline.

3. Pull requests
- Mirror the issue decisions for PRs: remove fallback language, add state filtering defaulting to open, and implement a PR-specific detail page rather than a rough preview stack.
- Full PR detail should be GitHub-like: main conversation/timeline column; right configuration rail with reviewers, assignees, labels, milestone, linked issues, branch metadata, review decision, mergeability, checks summary, and merge/status actions.
- Reuse existing PR detail sections where possible: overview, comments, files, commits, reviews, checks, review threads, timeline, linked issues. Compose them into a chronological timeline instead of showing unrelated sections as a vertical dump.

4. Actions
- Fully implement the Actions experience like GitHub: list workflows/actions first, then show workflow-specific runs and run details. Remove remaining dummy/fallback copy.
- Make workflow definitions, workflow dispatch, workflow run details, jobs, logs, annotations, artifacts, rerun/cancel controls, and deep links feel like one coherent product surface.
- Keep list/run/detail route state stable and screenshot-test major states.

5. Projects and Agents
- Replace any top-level/ribbon “Projects” entry with “Agents” if such a ribbon exists. Do not remove the repository Projects tab unless the product explicitly wants that; repository projects still need to work.
- Make a note for future agents expansion: agents should not only be cloud agents; local agents and local repository context will be expanded later.
- Fix Projects GraphQL and partial-error handling. If GitHub returns GraphQL permission/feature/field errors, show section-level availability states, not page-wide failure. Remove “GitHub fallback” labels from Projects UI and use “Open on GitHub” only where intentional.

6. Wiki
- Fix wiki layout, sizing, and implementation correctness. Use a GitHub-like wiki browser: page list/sidebar, selected markdown preview/editor, create/edit/delete controls, and clear disabled/unavailable states.
- Prevent giant markdown/editor content from breaking the shell. Ensure scroll containers, max-width, and radii are correct.

7. Security and quality
- Make Security & Quality fully operational and GitHub-like: security policy, code scanning alerts, Dependabot alerts, secret scanning alerts, repository rulesets, security advisories, community profile, branch protection, and relevant settings/actions.
- Preserve partial data when individual GitHub endpoints fail or are unavailable. Surface availability per section.

8. Per-repository settings
- Redesign the repository settings tab into coherent grouped sections: Overview/Status, Features, Tab visibility, Branch protection, Rulesets, Access, Fork network, Danger zone, and GitHub deep links.
- Apply the theme system and shared form/button/surface components. Remove the rough one-off look.

9. Sidebar/repository list/organizations/mailbox
- Keep the recent/pinned repository concept; do not rename it unless there is already a product-approved label. Improve legibility and visual consistency in dark mode.
- Normalize local and GitHub repository row components. Avoid mixed macOS bubble styling and hard straight-line web styling in the same list.
- Organizations should gracefully handle GraphQL errors and partial results. If one organization/team/project fails, render the available data with an availability message.
- Polish mailbox rows, filters, notification actions, and empty/error states using shared components and theme tokens.

10. Local repositories
- Plan and begin migrating local repository pages away from their separate shim UI into the same GitHub-like repository chrome.
- Reuse remote repository tabs/components where possible. For connected local repositories, issues/PRs/actions should feel like the same product, not string-only local lists. For local-only tabs, use the same surfaces, radii, header, tabs, empty states, and scroll behavior.
- Fix square backgrounds and incorrect corners in local repository views.

11. Query/cache/invalidation redesign
- Review GitHub and local gateway query flows. Current TTL/stale-hit behavior is useful but too broad for the next phase.
- Add a cache validation layer: render cached data immediately, then run lightweight validators to decide whether a heavy query is needed. Validators may use repository metadata, counts, updated timestamps, ETags/If-None-Match for REST endpoints where available, GraphQL count/updated fields, local filesystem/git/jj status fingerprints, and gateway events.
- Remove periodic broad refresh behavior where possible. Prefer mutation-driven invalidation, user-triggered refresh, route-focus validation, cheap metadata checks, and local gateway events.
- Preserve resilience: if validation fails, keep cached data with an availability/staleness message rather than blanking the UI.

12. Validation
- Run typecheck, lint, unit tests, and relevant E2E benchmark tests.
- Add or update Playwright/Electron screenshot tests at full window size. Capture dark theme, light theme, solid shell, reduced glass, and glass shell where platform support allows.
- Do not accept UI changes without screenshots for the changed routes.

Deliverables:
- Code changes split into coherent commits or worktree-sized patches.
- Updated tests for state filters, route state, cache behavior, fallback removal, and visual regression.
- A brief implementation summary with files changed, screenshots captured, and known follow-up gaps.
```

---

## 2. Worktree split recommendation

This should not be one giant thread unless the implementation agent has very strong repo context. Split into worktrees with narrow acceptance criteria.

### Worktree A — theme system and liquid glass foundation

**Goal:** Make the visual primitives reliable before touching every feature surface.

Files likely involved:

- `src/renderer/src/styles.css`
- `src/renderer/src/theme/themeSettings.ts`
- `src/main/index.ts`
- shared component files under `src/renderer/src/components/**`
- any new `src/renderer/src/components/ui/*` or equivalent shared primitive directory

Tasks:

1. Build or consolidate shared primitives:
   - `Surface`
   - `Button` / `IconButton` / `ExternalLinkButton`
   - `FilterBar`
   - `StateSegmentedControl`
   - `StateChip`
   - `DetailLayout`
   - `DetailRail`
   - `Timeline`
   - `Composer`
   - `FormSection`
2. Audit CSS for:
   - hard-coded hex colors outside theme declarations
   - `rgba(...)` values outside declared tokens
   - duplicated border radii
   - duplicated shadows
   - direct `background: white`, `background: #...`, or nearly opaque surfaces
   - `border-radius` values inconsistent with `--radius-*`
   - overuse of `.issue-row` for non-issue rows
3. Define a surface hierarchy:
   - shell background
   - app shell border
   - primary panels
   - secondary rows
   - elevated transient popovers
   - form controls
   - selected states
   - danger/warning/success states
4. Fix dark theme contrast first.
5. Liquid glass investigation:
   - Test current `opaque: true` native view behavior.
   - Try `opaque: false` and controlled tint alpha values.
   - Test `unstable_setScrim` and `unstable_setSubdued` in light/dark/glass/reduced/solid.
   - Verify whether BrowserWindow transparency and CSS shell background prevent native bleed-through.
   - Preserve a `no-liquid-glass` fallback that behaves consistently on non-macOS platforms.
6. Add screenshot scenarios:
   - full app light/solid
   - full app dark/solid
   - full app dark/glass shell
   - repository issues dark
   - repository settings dark
   - local repository dark

Acceptance criteria:

- Dark theme no longer exposes hard-coded light surfaces in core routes.
- Solid, reduced, and glass modes behave predictably and are visually distinct.
- `solid` does not accidentally appear more transparent than `glass-shell` unless deliberately documented as a platform limitation.
- Existing app layout remains rounded and clipped without square background leaks.

---

### Worktree B — issues state filtering and detail-page architecture

**Goal:** Make Issues feel complete and GitHub-like.

Files likely involved:

- `src/renderer/src/components/repository/issues/IssuesTab.tsx`
- `src/renderer/src/components/repository/issues/IssuesTab.queries.ts`
- `src/renderer/src/components/repository/RepositoryPage.tsx`
- `src/renderer/src/hooks/useRepositoryRouteState.ts`
- `src/renderer/src/stores/uiStore.ts`
- `src/shared/github.ts`
- provider files if timeline data must be extended:
  - `src/main/github/octokitProvider.ts`
  - `src/main/github/provider.ts`
  - IPC contract files

Tasks:

1. Introduce issue state filter:
   ```ts
   export type IssueStateFilter = "open" | "closed" | "all";
   ```
2. Add issue state route/store state:
   - `issueState?: IssueStateFilter`
   - default `open`
   - retain existing text filter separately.
3. Update query keys:
   - from `['issues', owner, repo, limit]`
   - to `['issues', owner, repo, state, limit]`
4. Update query calls:
   - default `state: 'open'`
   - do not use `state: 'all'` unless selected.
5. Update prefetch/refresh functions to include state.
6. Add a segmented control/dropdown beside the search field:
   - Open
   - Closed
   - optional All
7. Remove all “GitHub fallback” UI from issue rows and issue summary/preview.
8. Rename any intentionally retained external action to “Open on GitHub”.
9. Full issue detail layout:
   ```text
   +-----------------------------------------------------------+
   | Issue title / number / author summary                     |
   +------------------------------------+----------------------+
   | Timeline                           | Detail rail           |
   | - issue body                       | - Open on GitHub      |
   | - timeline events                  | - Status              |
   | - comments                         | - Labels              |
   | - branch/commit refs               | - Assignees           |
   | - composer                         | - Milestone           |
   |                                    | - Linked refs/PRs     |
   |                                    | - Actions             |
   +------------------------------------+----------------------+
   ```
10. Keep the list/preview split for browsing, but when `focusedIssueNumber` exists, use the full route detail layout.
11. Timeline data model:

```ts
type IssueTimelineItem =
  | { kind: "body"; createdAt: string; actor: ActorSummary; body: string }
  | { kind: "comment"; createdAt: string; comment: TimelineCommentSummary }
  | { kind: "event"; createdAt: string; event: IssueTimelineEventSummary }
  | { kind: "commit"; committedAt: string; commit: RepositoryCommitSummary }
  | { kind: "cross-reference"; createdAt: string; reference: LinkedReferenceSummary };
```

12. If GitHub does not currently provide all timeline/commit reference data, extend the provider in one focused pass and make unsupported event types render safely.

Acceptance criteria:

- Default Issues tab shows open issues only.
- Selecting Closed changes API input/query key and renders closed issues.
- No visible “GitHub fallback” copy remains in issue list/preview/detail.
- Full issue detail has a right rail and a chronological timeline.
- Existing create/edit/comment/close/reopen/labels/assignees/milestone flows still work.
- E2E tests cover default open state and closed state selection.
- Dark-theme screenshots show no hard-coded light surfaces.

---

### Worktree C — pull request state filtering and full PR management

**Goal:** Mirror the issue improvements and turn PR detail into a first-class management page.

Files likely involved:

- `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestsTabContent.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestsTab.queries.ts`
- existing PR subcomponents:
  - `PullRequestList`
  - `PullRequestInspection`
  - `PullRequestDiscussion`
  - `PullRequestMetadataControls`
  - `PullRequestReviewerControls`
  - `PullRequestConversationActions`
  - `PullRequestDetailSummary`
- route/store/provider files if needed

Tasks:

1. Introduce PR state filter:
   ```ts
   export type PullRequestStateFilter = "open" | "closed" | "all";
   ```
2. Add PR state route/store state and default to `open`.
3. Include state in PR query keys and prefetch/refresh.
4. Change `listPullRequestsWithStatus` calls from `state: 'all'` to the selected state.
5. Add UI beside “Filter pull requests”.
6. Remove fallback language from PR rows/details. Use “Open on GitHub” only as an intentional detail-rail action.
7. Full PR detail layout:
   ```text
   +-----------------------------------------------------------+
   | PR title / number / author / branch summary               |
   +------------------------------------+----------------------+
   | Timeline                           | Detail rail           |
   | - PR body                          | - Open on GitHub      |
   | - comments                         | - State/draft/merged  |
   | - commits                          | - Reviewers           |
   | - reviews                          | - Assignees           |
   | - checks summary events            | - Labels              |
   | - review thread references         | - Milestone           |
   | - timeline events                  | - Linked issues       |
   | - comment/review composer          | - Branch/base/head    |
   |                                    | - Merge/check actions |
   +------------------------------------+----------------------+
   ```
8. Reuse existing composed detail sections instead of re-fetching all at once. Request the sections needed for the selected layout and defer heavier sections where possible.
9. Compose chronological timeline items from available detail sections:
   - body/overview
   - comments
   - commits
   - reviews
   - review threads
   - timeline events
   - checks summary
10. Preserve existing actions:

- create PR
- comment
- approve/comment/request changes
- request/remove reviewers
- labels/assignees/milestone
- close/reopen
- merge
- open files/commits/workflow runs/code paths

Acceptance criteria:

- PRs default to open only.
- Closed PR filter updates query key and API input.
- Full PR route is not just a stacked preview; it has a right rail and main timeline.
- The PR timeline includes commits and reviews in chronological order.
- Merge/review/comment/metadata actions remain functional.
- Dark/light screenshots exist for PR list and full PR detail.

---

### Worktree D — Actions parity

**Goal:** Make Actions look and behave like a real GitHub Actions management surface.

Files likely involved:

- `src/renderer/src/components/repository/actions/ActionsTab.tsx`
- `src/renderer/src/components/repository/actions/ActionsTab.queries.ts`
- provider/cache files for missing workflow-specific endpoints
- route/store fields for selected workflow and selected run

Tasks:

1. Clarify the data hierarchy:
   ```text
   Actions tab
   ├── Workflow list / workflow definitions
   │   ├── workflow name
   │   ├── path/file
   │   ├── state
   │   ├── dispatchability
   │   └── latest runs count/status
   ├── Selected workflow run list
   └── Selected workflow run detail
       ├── summary/status/conclusion
       ├── jobs
       ├── steps
       ├── annotations
       ├── artifacts
       ├── logs
       └── rerun/cancel controls
   ```
2. If the current tab is run-first, introduce workflow-first navigation while retaining direct run deep links.
3. Remove remaining dummy/fallback wording.
4. Create cohesive detail components:
   - `WorkflowListPane`
   - `WorkflowRunListPane`
   - `WorkflowRunDetailPage`
   - `WorkflowJobPanel`
   - `WorkflowArtifactPanel`
   - `WorkflowAnnotationList`
   - `WorkflowLogViewer`
5. Keep dispatch form, input validation, rerun, rerun failed jobs, job rerun, cancel, download artifacts/logs.
6. Add filters:
   - workflow
   - branch/ref
   - event
   - status/conclusion
   - actor if available
7. Add visual screenshots for:
   - actions landing with workflows
   - selected workflow with runs
   - selected failed run with failure summary
   - run workflow dispatch form

Acceptance criteria:

- Users can start from a workflow list, click a workflow, then click a run.
- Direct workflow run route still works.
- No placeholder/dummy/fallback copy remains.
- Failure summary and annotations are actionable.
- Actions route handles unavailable logs/artifacts without breaking the page.

---

### Worktree E — Projects and Agents

**Goal:** Make repository/organization projects resilient and align top-level navigation with Agents.

Files likely involved:

- `src/renderer/src/components/repository/projects/ProjectsTab.tsx`
- `src/renderer/src/components/repository/projects/ProjectsTab.queries.ts`
- `src/renderer/src/components/collection/OrganizationsRoute.tsx`
- `src/renderer/src/components/collection/organizationQueries.ts`
- top-level navigation/ribbon files if a separate Projects ribbon exists
- provider GraphQL project methods

Tasks:

1. Confirm where “Projects on the ribbon” lives. The sidebar currently may not be that ribbon; do not remove repository Projects without product confirmation.
2. If a top-level Projects navigation item exists elsewhere, rename it to Agents and route it to the Agents surface.
3. Keep repository Projects tab operational.
4. Fix GraphQL error handling:
   - distinguish permission errors
   - feature disabled
   - missing ProjectV2 fields
   - partial field errors
   - node/project not found
5. Convert project-wide failures into section-level availability messages.
6. Remove “GitHub fallback” labels and replace intentional external actions with “Open on GitHub”.
7. Ensure project list/detail renders safely when items/fields/readme/counts are unavailable.
8. Update project item add/edit/delete and field update UX.
9. Add future note in Agents docs/comments: cloud agents are only the first scope; local agents/local repository agents will be added later.

Acceptance criteria:

- Projects do not crash or blank the page on GraphQL partial errors.
- Fallback language is removed.
- Repository and organization projects preserve available data while showing precise errors for unavailable fields.
- Any top-level Projects ribbon label is replaced with Agents without losing repository project functionality.

---

### Worktree F — Wiki layout and correctness

**Goal:** Make wiki usable and correctly sized.

Files likely involved:

- `src/renderer/src/components/repository/wiki/WikiTab.tsx`
- `src/renderer/src/components/repository/wiki/WikiTab.queries.ts`
- Markdown rendering/components
- CSS layout files

Tasks:

1. Replace the current layout with a clear wiki browser:
   ```text
   +---------------------------------------------------------+
   | Repository wiki header / availability / actions          |
   +----------------------+----------------------------------+
   | Page list/sidebar    | Selected page preview/editor      |
   | - Home               | markdown content                  |
   | - Page A             | edit/delete/open controls         |
   | - Page B             |                                  |
   +----------------------+----------------------------------+
   | Create/edit form, optionally in side panel or modal       |
   +---------------------------------------------------------+
   ```
2. Fix size issues:
   - page preview scrolls internally
   - long markdown does not stretch the entire app shell
   - editor textarea has sane min/max height
   - page list has a stable width and scroll area
3. Ensure wiki-disabled state is clean.
4. Ensure empty wiki state is clean.
5. Remove “GitHub fallback” copy.
6. Use “Open on GitHub” only for selected page or repository wiki deep link.
7. Handle selected page path in route state cleanly.
8. Add tests for disabled/no pages/selected page/long markdown.

Acceptance criteria:

- Wiki route no longer causes layout overflow or awkward sizing.
- Create/edit/delete controls remain functional.
- Long content is scrollable and clipped within rounded surfaces.
- Dark mode is legible.

---

### Worktree G — Security & Quality parity

**Goal:** Make Security & Quality complete enough to be trusted.

Files likely involved:

- `src/renderer/src/components/repository/security/SecurityQualityTab.tsx`
- `src/renderer/src/components/repository/security/SecurityQualityTab.queries.ts`
- `src/renderer/src/components/repository/settings/*` shared admin components
- provider methods for Dependabot/code scanning/secret scanning/rulesets/advisories/community profile/security policy

Tasks:

1. Define parity matrix:
   - Security policy
   - Code scanning alerts
   - Dependabot alerts
   - Secret scanning alerts
   - Repository rulesets
   - Branch protection
   - Security advisories
   - Community profile
   - Pulse/quality summaries if available
2. Each section must have:
   - loading state
   - available state
   - empty state
   - permission denied state
   - feature disabled state
   - rate-limited/offline/stale state
3. Do not let one failed endpoint break all sections.
4. Ensure open/security deep links and code path links work.
5. Ensure branch protection/ruleset mutation flows are safe and confirmation-gated.
6. Add state filters where relevant: open/dismissed/fixed for alerts if available in provider.
7. Add route-deep-link support for selected security item.
8. Add screenshots of a populated route and a partial-unavailable route.

Acceptance criteria:

- The route renders a useful page even with partial permissions.
- Mutations are disabled with precise reasons when viewer lacks permission.
- Security/quality looks like part of the same repository UI, not a standalone admin dump.

---

### Worktree H — Repository settings redesign

**Goal:** Reorganize settings into a polished, theme-consistent per-repository admin surface.

Files likely involved:

- `src/renderer/src/components/repository/settings/RepositorySettingsTab.tsx`
- `src/renderer/src/components/repository/settings/RepositoryFeatureSettingsForm.tsx`
- `src/renderer/src/components/repository/settings/RepositoryAccessSection.tsx`
- `src/renderer/src/components/repository/settings/BranchProtectionSection.tsx`
- `src/renderer/src/components/repository/settings/RepositoryRulesetsSection.tsx`
- `src/renderer/src/components/repository/settings/RepositorySettingsTab.queries.ts`

New layout proposal:

```text
Repository settings
├── Status / visibility / default branch summary
├── Control display
│   └── tab visibility preferences
├── GitHub features
│   ├── issues
│   ├── wiki
│   ├── projects
│   ├── discussions
│   ├── merge settings
│   └── archive/disable status
├── Access
│   ├── collaborators
│   └── teams
├── Branch protection
├── Rulesets
├── Fork network
└── Danger zone
```

Tasks:

1. Convert sequential sections into grouped cards with stable headers.
2. Add top-level availability summary for admin metadata.
3. Keep branch protection/ruleset sections reusable with Security & Quality.
4. Normalize all forms/selects/buttons through shared primitives.
5. Rename “Open GitHub fallback” to “Open settings on GitHub”.
6. Add a danger zone for destructive actions if any are present/added.
7. Add dark-mode and small-window screenshots.

Acceptance criteria:

- Settings no longer looks rough or like unrelated forms pasted together.
- Admin actions are clearly grouped and gated.
- Tab visibility preferences are easier to understand.
- No fallback wording remains.

---

### Worktree I — Sidebar, repository list, organizations, mailbox polish

**Goal:** Bring global navigation and collection views up to the same visual standard.

Files likely involved:

- `src/renderer/src/components/sidebar/Sidebar.tsx`
- `src/renderer/src/components/repository/repositorySearch.ts`
- `src/renderer/src/components/collection/OrganizationsRoute.tsx`
- `src/renderer/src/components/collection/useOrganizationsRouteState.ts`
- `src/renderer/src/components/collection/organizationQueries.ts`
- `src/renderer/src/components/collection/MailboxRoute.tsx`
- `src/renderer/src/hooks/useMailboxNotifications.ts`
- `src/renderer/src/hooks/useAccountWork.ts`

Tasks:

1. Keep recent/pinned repository concept intact.
2. Improve repository row legibility:
   - selected state
   - local/remote source chip
   - privacy icon/chip
   - owner/repo hierarchy
   - truncation
   - dark theme contrast
3. Normalize repository row styling between local and remote rows.
4. Avoid mixing round macOS capsule controls and hard straight-line web controls in the same list.
5. Organizations:
   - convert page header “GitHub fallback” to “Open on GitHub” or remove
   - keep partial data if projects/teams/members fail
   - improve selected org/team/project detail layout
   - show GraphQL/permission errors section-locally
6. Mailbox:
   - normalize notification/work rows with shared row component
   - improve filter controls
   - ensure mark-read/unsubscribe actions have clear disabled reasons
   - keep in-app vs external targets understandable
   - add bulk action feedback
7. Add screenshots for sidebar in remote area, local area, search state, org route, and mailbox route.

Acceptance criteria:

- Sidebar repository list is readable and theme-consistent.
- Organizations and mailbox no longer feel visually separate from repository pages.
- Partial data and errors are graceful.

---

### Worktree J — Local repository parity

**Goal:** Replace the “local shim” feeling with shared repository chrome and GitHub-like surfaces.

Files likely involved:

- `src/renderer/src/components/local-repository/LocalRepositoryPage.tsx`
- `src/main/areas/*`
- `src/shared/areas.ts`
- shared repository chrome/components under `src/renderer/src/components/repository/*`
- maybe introduce `src/renderer/src/components/repository/shared/*`

Current local problem shape:

- Local repository page has a completely separate header/tabs/body.
- Issues, pulls, and actions are rendered as simple string list panels.
- Local code/status/sync/workspaces/operations use separate panels and rows.
- Some local views can expose square backgrounds or inconsistent radii.

Migration strategy:

1. Extract common repository shell:
   - `RepositoryChrome`
   - `RepositoryHero`
   - `RepositoryTabs`
   - `RepositoryTabSurface`
   - `RepositoryRightRail`
2. Create adapters:

   ```ts
   type RepositoryDataSource = "github" | "local" | "local-connected-github";

   interface RepositoryChromeModel {
     source: RepositoryDataSource;
     displayName: string;
     path?: string | null;
     nameWithOwner?: string | null;
     defaultBranch?: string | null;
     currentBranch?: string | null;
     statusChips: ChipModel[];
     actions: ActionModel[];
   }
   ```

3. For local repositories with GitHub remote connection:
   - reuse GitHub Issues/PRs/Actions components where possible
   - add local context banner: workspace, current branch/bookmark, dirty status
   - do not use string-only rows
4. For local-only tabs:
   - code tab: use repository-like file browser layout
   - branches/bookmarks/remotes: use common table/list surfaces
   - sync: use shared form/action surface
   - status/activity/operations/workspaces: use cards/timeline/list components with theme tokens
5. Fix square/corner issues by ensuring local page uses the same rounded tab surface wrappers as remote repository pages.
6. Add route state compatibility so users can deep-link into local code path, issue/PR/action if connected, sync/status/workspace.

Acceptance criteria:

- Local repository pages visually belong to the same product as GitHub repository pages.
- Connected local issues/PRs/actions no longer render as string-only panels.
- No square background leaks in local repository views.
- Local-only features still exist but use shared visual primitives.

---

### Worktree K — Query/cache/invalidation redesign

**Goal:** Move from TTL-heavy refresh to validated cached reads and targeted invalidation.

Files likely involved:

- `src/main/github/provider.ts`
- `src/main/github/readCache.ts`
- `src/main/github/requestDedupe.ts`
- `src/main/github/octokitProvider.ts`
- `src/main/storage*`
- `src/main/areas/*`
- React Query hooks under `src/renderer/src/hooks/*`
- tab query files under `src/renderer/src/components/repository/**/**.queries.ts`

Current useful baseline:

- Provider has explicit cache TTLs by surface.
- Many reads support `cacheOnly` and `forceRefresh`.
- Cached data can be returned while background refresh happens.
- Repository list has a more specialized stale fallback and negative cache.

Next design:

```text
Renderer route opens
└── React Query reads cached status result immediately
    ├── if no cache and GitHub ready: live fetch
    ├── if cache exists: render cache with availability = available/stale-validating
    └── schedule lightweight validation
        ├── unchanged -> mark validated, extend expiry
        └── changed -> fetch heavy detail/list query, update cache, notify renderer
```

Validation layers:

1. **REST conditional requests**
   - Store `etag` and/or `last-modified` on cache entries where REST endpoints return them.
   - Send `If-None-Match` or `If-Modified-Since` for conditional GET where appropriate.
   - Treat `304 Not Modified` as “cache validated”.
2. **GraphQL lightweight validators**
   - Repository: `updatedAt`, `pushedAt`, default branch target oid, open/closed issue counts, open/closed PR counts, release count, project count where available.
   - Issue: `updatedAt`, `state`, `comments.totalCount`, labels/assignees/milestone changed timestamps if feasible.
   - PR: `updatedAt`, `state`, `mergeable`, `reviewDecision`, `commits.totalCount`, `comments.totalCount`, `reviews.totalCount`, latest commit oid.
   - Actions: latest workflow run id/status/conclusion per workflow, workflow file sha if available.
   - Projects: project `updatedAt`, item count, field count.
   - Wiki: page list shas and selected page sha.
3. **Mutation-driven invalidation**
   - Mutation response should update exact cache entries when possible.
   - Otherwise invalidate a targeted family of keys, not the entire repository.
   - Examples:
     - add issue comment -> issue detail timeline + issue list updatedAt
     - add/remove labels -> issue detail rail + issue list row
     - merge PR -> PR detail/list + branch/ref metadata + actions maybe
     - update repository feature -> repo detail/admin/settings/wiki/projects availability
4. **Local gateway validation**
   - Local repository fingerprint:
     - repo path
     - current branch/bookmark
     - HEAD/change id
     - dirty count/status hash
     - last jj operation id
     - remotes/ahead/behind fingerprint
   - AreaManager/GatewayManager events should invalidate React Query keys directly.
   - Avoid polling local status if gateway events are available.
5. **Rate limit and concurrency policy**
   - Use request dedupe for identical validations.
   - Queue or throttle live validation where multiple tabs warm at once.
   - Respect GitHub rate-limit and secondary rate-limit signals.
6. **Cache state model**
   ```ts
   type CacheValidationState =
     | "not_loaded"
     | "cached"
     | "validating"
     | "validated"
     | "stale"
     | "refreshing"
     | "error"
     | "rate_limited"
     | "permission_denied";
   ```

Acceptance criteria:

- The app can render cached data without immediately heavy-fetching every tab.
- Validation requests are materially smaller than heavy list/detail reads.
- Mutation invalidation is targeted.
- Repeated route switches do not generate broad live refresh bursts.
- Offline/rate-limited states preserve cached UI.

---

## 3. Exact implementation notes by requested feedback item

### 3.1 Theme inconsistencies

Use dark theme as the primary audit mode. The work should not be “make dark theme prettier” only; it should identify every component that is not anchored to tokens.

Checklist:

- Search for hard-coded colors:
  ```bash
  rg "#[0-9a-fA-F]{3,8}|rgba?\(" src/renderer/src --glob '!styles.css'
  ```
- Search for hard-coded radii:
  ```bash
  rg "border-radius:\s*[0-9]" src/renderer/src
  ```
- Search for direct backgrounds:
  ```bash
  rg "background:\s*(white|black|#[0-9a-fA-F]|rgba?)" src/renderer/src --glob '!styles.css'
  ```
- Every hard-coded value should either become a token or be justified as a data color.
- Consolidate classes that are semantically the same but visually divergent:
  - `issue-row`
  - `notification-row`
  - `mailbox-work-row`
  - `organization-row`
  - local rows
  - project rows
  - workflow rows
- Create visual snapshots before changing large CSS sections.

### 3.2 Remove fallback buttons/copy

Do not remove every external link. Remove the concept that Control is falling back because it cannot do the job.

Replace:

- `GitHub fallback`
- `Open GitHub fallback`
- `Open fallback`

With either:

- no button, if the in-app action is now sufficient
- `Open on GitHub`, if the deep link is useful
- `Open settings on GitHub`, if linking to a specific GitHub settings path
- `Open project on GitHub`, `Open wiki page on GitHub`, etc., when context-specific

Prioritize removal in:

- issue list rows
- issue preview/detail
- PR list/detail if present
- projects toolbar/list rows
- wiki page preview
- repository settings header
- organizations header if it says fallback

### 3.3 Issue open/closed filter

The state filter must be data-stateful:

Bad:

```ts
const filteredIssues = issueItems.filter((issue) => issue.state === selectedState);
```

Acceptable only after server state filtering:

```ts
const issues = useQuery({
  queryKey: issuesTabQueryKey(owner, repo, issueState, issueListLimit),
  queryFn: () =>
    api.github.listIssuesWithStatus({
      owner,
      repo,
      state: issueState,
      limit: issueListLimit,
      cacheOnly: !githubReady
    })
});
```

Route behavior:

- Default state is `open`.
- Text filter remains independent.
- Changing state should keep current search string.
- If selected issue is no longer in the state-filtered list, select first row or show empty detail.
- Deep link to `issueNumber` should fetch detail even if it is not in the current list.

### 3.4 Issue full detail

Issue list and issue full detail have different jobs:

- List view: triage and selection.
- Full detail route: management and conversation.

Do not force the right-side repository rail into full issue detail. Full issue detail should own its own rail.

Suggested components:

```text
IssueDetailPage
├── IssueDetailHeader
├── GitHubDetailLayout
│   ├── IssueTimelineColumn
│   │   ├── IssueBodyEvent
│   │   ├── IssueTimelineEventList
│   │   └── IssueCommentComposer
│   └── IssueConfigurationRail
│       ├── OpenOnGitHubAction
│       ├── IssueStatusCard
│       ├── IssueLabelsCard
│       ├── IssueAssigneesCard
│       ├── IssueMilestoneCard
│       ├── IssueLinkedReferencesCard
│       └── IssueDangerOrStateActions
```

### 3.5 PR full detail

Do not build PR detail as a mirror of issue detail by copy/paste. Extract shared pieces:

```text
GitHubDetailLayout
TimelineColumn
TimelineEventCard
ConfigurationRail
RailSection
CommentComposer
MetadataPicker
```

PR-specific rail:

- Open on GitHub
- state/draft/merged
- reviewers/requested reviewers/teams
- assignees
- labels
- milestone
- linked issues
- base/head branch
- mergeability
- review decision
- checks summary
- merge actions

PR-specific timeline:

- PR body
- comments
- reviews
- commits
- review thread summaries
- check suite/run summaries where useful
- timeline events

### 3.6 Actions

Treat Actions as three layers:

1. **Workflow catalog** — “what workflows exist?”
2. **Workflow runs** — “what happened recently for this workflow or branch?”
3. **Run details** — “what failed, what logs/artifacts/actions are available?”

The existing Actions implementation already has many run-level pieces. The missing product behavior is likely hierarchy and polish.

### 3.7 Projects

Projects are GraphQL-heavy and permission-sensitive. The correct UX is not “no error”; it is “a specific section failed without destroying the rest.”

For GraphQL errors:

- parse and map errors to `GitHubReadAvailability`
- keep partial `items` if any are present
- show per-field messages such as:
  - `Project items unavailable: GitHub did not return item access for this viewer.`
  - `Project fields unavailable: GraphQL field permission denied.`
  - `Projects disabled for this repository.`

### 3.8 Wiki

The wiki route should be designed around size containment. The user specifically mentioned size issues; this is likely a scroll/container layout problem.

Requirements:

- wiki page list scrolls independently
- page preview scrolls independently
- editor scrolls independently
- long markdown/code blocks do not widen the shell
- images are max-width constrained
- table overflow is horizontal within markdown body, not the app shell
- selected page state survives refresh/deep link

### 3.9 Security and Quality

The current data model is broad enough to implement a serious page. The primary work is operations quality:

- state filters for alert lists
- section-level error boundaries
- clear permission messages
- mutation confirmation
- deep link to code path/security page
- shared admin/ruleset components with Settings

### 3.10 Settings

The settings page should be treated as an admin console, not a long form. Users need hierarchy.

Minimum redesign:

- settings overview card
- tab visibility card
- feature toggles card
- access card
- branch protection card
- rulesets card
- fork network card

### 3.11 Organizations

The transcript says one org returns but GraphQL errors are thrown. The plan should assume partial success is expected.

Implementation:

- Keep organization list available even if selected org projects fail.
- Keep repositories available even if teams fail.
- Keep team list available even if members fail.
- Keep projects available even if readme/fields/items fail.
- Use availability messages close to the failing section.

### 3.12 Mailbox

Mailbox is a product polish task:

- unify rows with issue/PR row primitives
- make filters compact and theme-aware
- clarify in-app vs external destination
- keep mark-read/unsubscribe actions visible but not overwhelming
- make bulk mark visible read feedback clear

### 3.13 Local repositories

The local experience must become an alternate data source, not an alternate product.

Long-term architecture:

```text
RepositoryChrome
├── Remote GitHub repository data source
└── Local repository data source
    ├── local git/jj status
    ├── connected GitHub remote bridge
    └── local gateway operations
```

Short-term implementation:

- Keep local-only tabs, but wrap them in shared `RepositoryChrome`.
- Replace string-only issues/pulls/actions with shared list rows and eventual shared full detail if connected.
- Use shared tab bar and hero styles.
- Fix local page background and border radius leakage.

---

## 4. Cache redesign specification

### 4.1 Principles

1. **Cached data is acceptable if it is explicit and validated.** The UI should show cached data with confidence when a cheap validator says it is current.
2. **Do not use heavy list/detail queries as validators.** A validator should be materially cheaper than the data it validates.
3. **Mutation invalidation should be targeted.** A label mutation should not require reloading actions, wiki, projects, and repository contents.
4. **Offline/rate-limited behavior is a feature.** The app is local-first; stale-but-useful data is better than blank pages.
5. **Avoid broad polling.** Route entry, user refresh, mutation results, local gateway events, and cheap validators should drive freshness.

### 4.2 Suggested cache metadata schema

```ts
interface CacheEnvelope<T> {
  provider: "github" | "local-gateway";
  cacheKey: string;
  payload: T;
  etag?: string | null;
  lastModified?: string | null;
  validator?: CacheValidatorSnapshot | null;
  fetchedAt: string;
  validatedAt?: string | null;
  expiresAt?: string | null;
  availability: GitHubReadAvailability;
}

interface CacheValidatorSnapshot {
  kind: string;
  version: number;
  values: Record<string, string | number | boolean | null>;
}
```

### 4.3 Example validators

Repository list:

```ts
{
  kind: "viewer-repositories",
  values: {
    totalVisibleCount,
    firstPageNodeIdsHash,
    viewerLogin,
  }
}
```

Repository detail:

```ts
{
  kind: "repository-detail",
  values: {
    id,
    updatedAt,
    pushedAt,
    defaultBranch,
    issuesOpenCount,
    pullRequestsOpenCount,
    releasesCount,
    projectsCount,
    diskUsage,
  }
}
```

Issue list:

```ts
{
  kind: "issue-list",
  values: {
    state,
    totalCount,
    firstPageIdsHash,
    newestUpdatedAt,
  }
}
```

Issue detail:

```ts
{
  kind: "issue-detail",
  values: {
    nodeId,
    number,
    state,
    updatedAt,
    commentsCount,
    labelsHash,
    assigneesHash,
    milestoneId,
  }
}
```

PR detail:

```ts
{
  kind: "pull-detail",
  values: {
    nodeId,
    number,
    state,
    updatedAt,
    latestCommitOid,
    commitsCount,
    commentsCount,
    reviewsCount,
    reviewDecision,
    mergeable,
    labelsHash,
    assigneesHash,
    requestedReviewersHash,
  }
}
```

Actions:

```ts
{
  kind: "actions-workflows",
  values: {
    workflowCount,
    workflowIdsHash,
    workflowFilesHash,
    latestRunId,
    latestRunStatus,
    latestRunConclusion,
  }
}
```

Local repository:

```ts
{
  kind: "local-repository",
  values: {
    areaId,
    repositoryId,
    workspaceId,
    providerKind, // git | jj
    currentBranch,
    currentBookmark,
    headOid,
    workingCopyChangeId,
    workingCopyCommitId,
    dirtyCount,
    statusHash,
    latestOperationId,
    remotesHash,
  }
}
```

### 4.4 React Query strategy

Current tab query hooks can keep their shape, but each should support:

- `cacheOnly` immediate path
- `validateOnly` or provider-side validation path
- `forceRefresh` path
- stable query keys that include state filters and selected route params

Recommended hook model:

```ts
function useValidatedGitHubQuery<TData, TValidator>({
  queryKey,
  readCached,
  validate,
  refresh,
  enabled,
  validationPolicy
}: ValidatedGitHubQueryInput<TData, TValidator>) {
  // 1. return cached data immediately
  // 2. schedule validator if enabled and policy allows
  // 3. refresh only when validator differs or cache is missing
}
```

Avoid making every feature implement this from scratch. Build a provider-level primitive first, then migrate feature hooks gradually.

---

## 5. Visual QA plan

### 5.1 Required screenshots

Every UI worktree should capture full Electron window screenshots at the app’s target viewport.

Minimum matrix:

| Route                     | Light solid | Dark solid | Dark glass/reduced | Notes                        |
| ------------------------- | ----------: | ---------: | -----------------: | ---------------------------- |
| Repository overview/code  |         yes |        yes |                yes | baseline shell               |
| Issues list               |         yes |        yes |                yes | open filter default          |
| Issue full detail         |         yes |        yes |                yes | right rail/timeline          |
| PR list                   |         yes |        yes |                yes | open filter default          |
| PR full detail            |         yes |        yes |                yes | right rail/timeline          |
| Actions landing           |         yes |        yes |           optional | workflow list                |
| Workflow run detail       |         yes |        yes |           optional | failed run if fixture exists |
| Projects                  |         yes |        yes |           optional | partial error state          |
| Wiki                      |         yes |        yes |           optional | long content                 |
| Security & Quality        |         yes |        yes |           optional | partial unavailable state    |
| Settings                  |         yes |        yes |                yes | admin forms                  |
| Sidebar repository search |         yes |        yes |                yes | local + remote rows          |
| Organizations             |         yes |        yes |           optional | GraphQL partial error        |
| Mailbox                   |         yes |        yes |           optional | unread/read filters          |
| Local repository          |         yes |        yes |                yes | code + issues/pulls/actions  |

### 5.2 Screenshot assertions

Automated assertions can catch obvious regressions:

- no large pure-white rectangles in dark mode
- no square corners where shell/panels should be rounded
- no horizontal overflow on body/app shell
- selected tabs/buttons have visible focus/selected state
- contrast smoke checks for muted text on surfaces
- scroll containers are inside panels, not body

### 5.3 Suggested commands

Run all broadly relevant checks after each worktree:

```bash
bun run typecheck
bun run lint
bun run test
bun run test:e2e
```

Run targeted benchmarks where applicable:

```bash
bun run test:e2e:github:issues
bun run test:e2e:github:pull-requests
bun run test:e2e:github:actions
bun run test:e2e:github:projects
bun run test:e2e:github:organizations
bun run test:e2e:github:security-quality
bun run test:e2e:github:repository-admin
```

Add new visual specs rather than relying only on current benchmark suites.

---

## 6. Risk register

| Risk                                                    | Severity | Mitigation                                                                                                    |
| ------------------------------------------------------- | -------: | ------------------------------------------------------------------------------------------------------------- |
| Large UI refactor breaks many routes                    |     High | Build shared primitives first; migrate route by route; screenshot each route.                                 |
| Timeline data is incomplete for issues                  |   Medium | Implement a tolerant timeline union; render unsupported events as generic events; defer uncommon event types. |
| PR detail becomes too heavy                             |     High | Keep existing on-demand PR section loading; request only needed sections; cache composed sections separately. |
| GitHub GraphQL project errors persist                   |     High | Treat partial errors as availability states; avoid page-wide crashes.                                         |
| Liquid glass behavior depends on macOS version          |     High | Test on actual target macOS; document platform limitations; keep non-native fallback.                         |
| Cache validation adds complexity without reducing calls |     High | Instrument request counts; add logs/metrics for validator vs heavy refresh; stage rollout.                    |
| Local repository adapter becomes too abstract           |   Medium | Start by sharing chrome and row components before abstracting all data sources.                               |
| Removing fallback buttons hides useful escape hatches   |   Medium | Replace with context-specific “Open on GitHub” where useful; remove only fallback framing.                    |
| Visual tests are flaky                                  |   Medium | Use deterministic viewport/data fixtures; mask volatile timestamps/avatars if needed.                         |
| Route state migration breaks deep links                 |   Medium | Add tests for issueNumber, pullNumber, workflowRunId, wikiPagePath, security item, local path.                |

---

## 7. Prioritized implementation order

1. **Theme primitives + screenshot infrastructure** — because every other change depends on reliable surfaces.
2. **Issues filter + fallback removal** — small, high-value, clear acceptance criteria.
3. **Issue full detail layout** — establishes shared detail/timeline/rail architecture.
4. **PR filter + fallback removal** — parallel to issues.
5. **PR full detail layout** — reuses shared architecture.
6. **Settings visual redesign** — cleans one of the roughest admin surfaces and builds reusable admin sections.
7. **Actions hierarchy** — broad but self-contained.
8. **Projects GraphQL/partial errors + fallback cleanup** — requires careful provider/error handling.
9. **Wiki sizing/correctness** — targeted layout task.
10. **Security & Quality operational polish** — broad admin/security completeness.
11. **Sidebar/orgs/mailbox polish** — global consistency.
12. **Local repository parity stage 1** — shared chrome and row components.
13. **Cache validation architecture** — should begin with design/instrumentation early, but broad rollout should happen after route query state settles.

---

## 8. Short prompts for separate GPT-5.5 worktrees

### Prompt A — theme/glass

```text
/goal Implement Control’s theme and liquid-glass consistency foundation. Audit dark mode across repository, issue, PR, actions, settings, sidebar, organizations, mailbox, and local repository surfaces. Consolidate hard-coded surfaces/radii/shadows into tokens and shared primitives. Investigate Electron/macOS liquid glass behavior, especially current opaque native glass backing. Add full-window Playwright/Electron screenshots for light/dark/solid/reduced/glass modes. Do not change product features beyond visual primitives and necessary class/component migration.
```

### Prompt B — issues

```text
/goal Implement the Issues UX iteration. Add server-backed open/closed/all issue state filtering defaulting to open; include state in route/store/query keys/prefetch/refresh/API inputs. Remove “GitHub fallback” copy/buttons from issue list and preview. Build full issue detail as a GitHub-like page with main chronological timeline and right configuration rail. Place “Open on GitHub” above status in the rail. Preserve create/edit/comment/metadata/close/reopen behavior. Add tests and screenshots.
```

### Prompt C — pull requests

```text
/goal Implement the Pull Requests UX iteration mirroring Issues. Add server-backed open/closed/all PR state filtering defaulting to open; include state in route/store/query keys/prefetch/refresh/API inputs. Remove fallback language. Build full PR detail with main chronological timeline and right configuration rail for reviewers, assignees, labels, milestone, branch metadata, review decision, checks, linked issues, and merge actions. Reuse existing PR detail sections without overfetching. Add tests and screenshots.
```

### Prompt D — actions

```text
/goal Make the Actions tab GitHub-like and complete. Use workflow definitions as the first-class list, allow selecting a workflow to see runs, and allow selecting a run to see jobs, steps, logs, annotations, artifacts, rerun/cancel controls, and dispatch. Remove dummy/fallback language. Preserve direct workflowRunId deep links. Add screenshots for workflow list, run list, run detail, failed run, and dispatch form.
```

### Prompt E — projects/agents

```text
/goal Clean up Projects and Agents. Rename any top-level/ribbon Projects entry to Agents while keeping repository Projects functional unless product requirements say otherwise. Fix repository and organization projects so GraphQL/permission/feature errors are section-level availability messages, not page-wide failures. Remove fallback wording and use intentional “Open on GitHub” actions only. Add a future note that Agents will later include local agents, not just cloud agents. Add tests for partial project data and screenshots.
```

### Prompt F — wiki/security/settings

```text
/goal Polish Wiki, Security & Quality, and Repository Settings. Fix wiki sizing/layout with a page list and bounded markdown/editor preview. Make Security & Quality operational with section-level availability for policy, code scanning, Dependabot, secret scanning, rulesets, advisories, community profile, and branch protection. Redesign per-repository settings into grouped admin cards with theme-consistent forms. Remove fallback wording. Add screenshots and targeted tests.
```

### Prompt G — sidebar/orgs/mailbox/local

```text
/goal Polish global navigation, organizations, mailbox, and local repositories. Keep the recent/pinned repository concept but improve dark-mode legibility and component consistency. Make Organizations resilient to partial GraphQL errors. Polish Mailbox filters/rows/actions. Begin local repository parity by migrating LocalRepositoryPage toward shared repository chrome and replacing string-only local Issues/PRs/Actions panels with shared row/detail components where a GitHub remote is connected. Fix square background/corner issues. Add screenshots.
```

### Prompt H — cache redesign

```text
/goal Redesign Control’s GitHub and local gateway cache/invalidation model. Preserve local-first cached rendering, but add lightweight validators and targeted invalidation so the app avoids broad periodic refreshes. Use REST conditional requests where available, GraphQL metadata/count validators, mutation-driven cache updates/invalidations, request dedupe, rate-limit-aware queues, and local gateway/git/jj fingerprints/events. Start with instrumentation and one or two surfaces, then document migration path. Add tests for cache-only, stale, validated, changed, rate-limited, and mutation invalidation states.
```

---

## 9. Definition of done for the whole iteration

The iteration is complete when:

- Dark theme can be used as the default development audit mode without obvious theme violations.
- Issues default to open, support closed filtering, and have GitHub-like full detail.
- PRs default to open, support closed filtering, and have GitHub-like full detail.
- Fallback language is removed from core repository management surfaces.
- Actions starts from workflows and supports run detail coherently.
- Projects, organizations, and security surfaces survive partial GitHub/GraphQL errors.
- Wiki no longer has layout/size problems.
- Repository settings looks like a polished admin surface.
- Local repositories share repository chrome and no longer feel like a separate product.
- Cache behavior is more validation-driven and less TTL/polling-driven.
- Full-window Electron screenshots exist for changed routes in dark theme.
- Typecheck, lint, unit tests, and relevant E2E suites pass.

---

## 10. Post-review hardening addendum

This addendum captures follow-up constraints from a review pass over this report
and the per-area implementation documents. Treat these as part of the source
plan.

### 10.1 Timeline performance

Issue and pull request timelines must be bounded. A GitHub-like timeline cannot
eagerly render hundreds of comments, events, commits, reviews, and check
summaries as a single unvirtualized stack.

Implementation agents must choose one of these strategies before building full
detail pages:

- paginate timeline events by API page where GitHub supports it
- virtualize the visible timeline rows when all items are already available
- group low-value events behind expandable clusters
- lazy-load heavy event families such as commits, reviews, files, and checks
- preserve scroll position when loading additional timeline segments

The detail page must remain responsive on high-volume issues and PRs.

### 10.2 Cache transport and storage

Cache validation must be implemented inside the existing main-process storage
boundary. Do not invent a new ad-hoc storage location for validator metadata.

The likely implementation path is:

- extend existing cache entry storage to persist `etag`, `lastModified`,
  validator snapshots, `fetchedAt`, and `validatedAt`
- keep GitHub cache persistence in the main process storage layer
- expose only status-bearing read results and freshness semantics to renderer
- use IPC events or existing app event bridge patterns to notify the renderer
  when main-process validation or local gateway events invalidate a query family
- keep React Query invalidation in renderer, but derive the invalidation from
  typed main-process events

AreaManager/GatewayManager event invalidation must define the event transport:
main process event source, preload exposure, renderer subscription, and
React Query invalidation target.

### 10.3 Cache primitive timing

Do not postpone all cache architecture until every UI surface has been rebuilt.
That would force a second migration pass across the same query hooks.

Build the cache validation primitive and instrumentation early, then migrate
each route into it as that route is redesigned. Broad rollout can remain late,
but the contract should exist before Issues, PRs, Actions, Projects, and Wiki
are heavily refactored.

### 10.4 React Query validation architecture

Use a shared hook/provider contract rather than custom validation logic per
surface:

```ts
function useValidatedGitHubQuery<TData, TValidator>({
  queryKey,
  readCached,
  validate,
  refresh,
  enabled,
  validationPolicy
}: ValidatedGitHubQueryInput<TData, TValidator>) {
  // 1. return cached data immediately when present
  // 2. schedule lightweight validation when policy allows
  // 3. extend freshness when unchanged
  // 4. run heavy refresh only when changed or cache is missing
}
```

Every migrated route must preserve these paths:

- cache-only read
- validate-only read
- force refresh
- stale fallback
- rate-limit fallback

### 10.5 Validation concurrency and rate limits

Validation must be rate-limit aware. When multiple tabs warm at once, validators
must be deduped, queued, or throttled so the app does not create broad live
refresh bursts on startup or fast route switching. Secondary rate-limit signals
must slow validation rather than escalating to repeated heavy refresh.

### 10.6 Visual QA tooling

Use the repository's existing Playwright/Electron benchmark fixtures where
possible. Do not create new `tests/e2e` specs unless explicitly approved by the
task owner, but do update existing selectors and screenshot capture paths when
labels or layouts change.

If automated screenshots are not yet practical for a route, record full-window
manual Electron screenshots as implementation evidence and document the exact
route, theme, shell mode, and fixture state.

### 10.7 Shared primitive API guardrails

Shared primitives should be ordinary React/TypeScript components styled through
the existing CSS variable and class system. Do not introduce a new styling
paradigm such as CSS-in-JS, Tailwind, or route-local inline style systems.

Primitives should accept semantic variants rather than raw color values. They
should work for both remote GitHub repositories and local repository data-source
adapters.

### 10.8 Master prompt usage

The master `/goal` prompt is a context document, not the best execution unit.
Implementation should use the smaller worktree prompts and the per-area docs as
the active goals. Feed the master report as context when useful.

### 10.9 Dark mode forcing

Screenshot and DOM inspection instructions must include how the app is placed
into the requested theme/shell mode. Prefer the existing settings/theme paths
over ad-hoc DOM mutation. When a test harness controls color scheme, document
whether it sets app state, local settings, or browser color-scheme emulation.
