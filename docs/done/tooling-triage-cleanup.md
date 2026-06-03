# Tooling Diagnostic Cleanup Record

## Scope

This file keeps broad diagnostics actionable without hiding real issues behind all-or-nothing ignores.

## Knip Baseline

Command:

```sh
bunx knip --reporter compact
```

Current configured signal:

- `knip.json` owns Electron/Vite entry points, scripts, and E2E support files.
- `electron.vite.config.ts`, `src/main/index.ts`, and `electron-liquid-glass` are configured as intentional entry/dependency usage.
- The stale `FileBlamePanel` and unlisted `playwright` findings are fixed in code/package metadata.
- Remaining output is limited to exported shared IPC/data contract types: 3 type groups.

Do not delete remaining shared exports only because Knip reports them. Use this ownership split:

- Shared IPC contracts in `src/shared/**`: keep unless the contract is removed from preload, main, renderer, tests, and docs together.
- Route parser exports in `src/main/ipc/registerGithubIpc.ts`: keep only while tests import parser boundaries directly.
- Tab query/prefetch exports: keep only when the tab warm-prefetch path imports them; otherwise remove with the tab extraction that owns the query.
- Mock write helpers and test factories: keep when used by fixtures outside Knip's reachable graph; otherwise delete with focused tests.
- Error classes: keep when they are part of a boundary that callers are expected to catch; otherwise collapse to local errors.

Verification for future Knip work:

- `bunx knip --reporter compact`
- No unused files.
- No unused dependencies or unlisted dependencies.
- Any remaining export/type findings are either removed or represented in this triage file with owner and reason.

## React Doctor Baseline

Command:

```sh
react-doctor . --offline --verbose
```

Current result:

- 190 issues across 66 of 365 files.
- Largest groups: shared-contract Knip types, combine-iteration warnings, sequential awaits, immutable-sort warnings, set/map lookup warnings, and known service-name constants.
- `SecurityQualityTab` has been removed from the `no-giant-component` findings after the security-quality extraction.
- `ReleasesTab` has been removed from the `no-giant-component`, `prefer-useReducer`, `no-derived-useState`, and `no-prevent-default` findings after the releases extraction.
- `ProjectsTab` has been removed from the `no-giant-component`, `prefer-useReducer`, `no-prevent-default`, and `no-prop-callback-in-effect` findings after the projects extraction.
- `DiscussionsTab` has been removed from the `no-giant-component`, `prefer-useReducer`, and `no-prevent-default` findings after the discussions extraction.
- `WikiTab` has been removed from the `no-giant-component` and `prefer-useReducer` findings after the wiki extraction.
- `WikiTab.queries.ts` has been removed from the `js-combine-iterations` findings after the refresh key scan rewrite.
- `ContributorsTab` has been removed from the `no-giant-component` findings after the contributors layout extraction.
- `PullRequestsTab` has been removed from the `no-giant-component`, `prefer-useReducer`, and `no-derived-useState` findings after moving query/state/action assembly behind the tab model hook. `PullRequestsTabContent` has been removed from the `no-giant-component` findings after the presentation split.
- `IssuesTab` has had its issue-list row callbacks moved behind `IssueList`/`IssueListRow`, its create/edit/comment/metadata/action surfaces moved behind focused components, its discussion comment action adapter moved behind `IssueDiscussionThread`, its comma-separated parser removed from the `js-flatmap-filter` findings, and its local UI state moved behind a reducer. `IssuesTab` is no longer in `no-giant-component`, `prefer-useReducer`, `no-derived-useState`, or `no-prevent-default` after the route/detail composition split.
- `CodeTab` has been removed from the `no-giant-component` findings after splitting ref selection, virtualized file rows, README rendering, and root markdown tabs into focused components.
- `MailboxRoute` has been removed from the `no-giant-component` findings after splitting notification filters, notification rows, account-work rows, and app-owned notification unsubscribe confirmation into focused components.
- `CodeBrowserPage` has been removed from the `no-giant-component` findings after splitting the header/ref picker, file toolbar/metadata/preview, directory rows, and file history panel into focused components.
- `RepositoriesRoute` has been removed from the `no-giant-component` findings after splitting route actions, filtering, GitHub/local repository rows, direct repository targeting, and collection status blocks into focused components.
- `OrganizationsRoute` has been removed from the `no-giant-component` findings after splitting organization list/profile, project/member detail panels, repository/team/member sections, and route model assembly into focused components/hooks.
- `RepositoryRouteSection` has been removed from the `no-giant-component` findings after splitting right-rail rendering, repository-page routing, code-browser routing, mutation confirmation, expansion handlers, and route context framing into focused helpers.
- `SettingsPanel` has been removed from the `no-giant-component` and `prefer-useReducer` findings after moving settings draft/status state into a reducer and splitting GitHub connection, appearance, repository-tab preferences, status, and footer rendering into focused components.
- `TopBar` has been removed from the `no-giant-component` findings after splitting area selection, search query/popover rows, context actions, and account actions into focused components; its topbar search ellipsis warning is also fixed.
- `Sidebar` has been removed from the `no-giant-component` findings after moving repository search derivation into a model hook and splitting navigation, repository filter/list/status/rows/load controls, and user footer into focused components. Its local loading ellipsis and immutable-sort diagnostics are also fixed.
- `CommandPalette` has been removed from the `no-giant-component` findings after moving search derivation into model hooks and splitting the header, result rows, load controls, and status messages into focused components. Its local file loading ellipsis, touched-file combine-iteration warning, and extracted row handler naming warning are also fixed.
- `HomeDashboard` has been removed from the `no-giant-component` findings after moving account/activity derivation into model helpers and splitting the account hero, pinned repositories, recents, contribution graph, activity summary, and timeline rows into focused components. Its touched combine-iteration, index-map, and immutable-sort diagnostics are also fixed.
- `LocalRepositoryPage` has been removed from the `no-giant-component` findings after moving local repository query/mutation state behind a route model hook and splitting header actions, tab navigation, overview, code rows, and tab content rendering into focused components/helpers. Its local loading ellipses, immutable workspace sort, and row callback diagnostics are also fixed.
- `RepositoryPage` has been removed from the `no-giant-component` findings after moving route focus derivation into a route model, splitting the repository hero/status/tab navigation/hidden-tab panel, and replacing inline tab callback adapters with named tab-surface functions. Its local action-disabled de-duplication no longer uses index lookups inside the render path.
- `App` has been removed from the `no-giant-component` findings after moving scroll reset into its own hook and splitting the shell into sidebar, topbar, workspace route, command-palette overlay, and dialog host components. The remaining React Doctor output no longer includes `no-giant-component`.
- `AreaDialogs` has been removed from the `prefer-useReducer`, `no-derived-useState`, and `jsx-a11y/no-autofocus` findings after moving SSH/edit draft state into a reducer, removing autofocus, and replacing repeated input callbacks with a shared draft input.
- The local `design-no-three-period-ellipsis` warning group is cleared after replacing touched loading/searching status copy with single-character ellipses.
- `DataSyncPanel`, `TimelineComment`, and `AuthProvider` have been removed from the remaining local `prefer-useReducer`, `no-derived-useState`, `no-prevent-default`, `no-cascading-set-state`, and React 19 context findings by moving related state behind reducers, removing the JS-only edit form submit path, and using React 19 context reads.
- `githubUrlRoutes` and `pullRequestDomain` have had the local length-check, sort-for-latest, and nested thread-state lookup diagnostics cleared with explicit prefix matching and single-pass review-thread helpers.
- A conservative Knip pass removed or unexported dead helper surface in area ids, provider auth adapters, code-browser UI, and code-viewer policy without touching shared contract types.
- A second Knip pass removed or unexported unused IPC validators, route factories, query keys, storage wrappers, provider/domain helper types, query prefetch helpers, and renderer mock helper exports. Knip no longer reports unused files, unused dependencies, unlisted dependencies, or unused value exports.

Must fix in cleanup work:

- `no-render-in-render` and inline callback findings on surfaces already targeted by `RENDER-04` and `RENDER-06`.
- New diagnostics introduced by cleanup patches.

Opportunistic cleanup:

- `js-combine-iterations`, `js-flatmap-filter`, `js-tosorted-immutable`, `js-set-map-lookups`, and `js-index-maps` when touching the same files for real behavior.
- Reducers and derived state ownership remain cleanup criteria for new or touched route/form state.
- `async-parallel` only after confirming the awaited calls are actually independent and rate-limit behavior stays correct.

Deferred with reason:

- `no-prevent-default`: Control is an Electron renderer, not a progressively enhanced web form surface. Keep normal React form submit handling unless a specific form needs a different interaction model.
- `js-tosorted-immutable`: defer until the TypeScript lib target includes `Array.prototype.toSorted`; changing the project lib target just to satisfy this diagnostic is out of scope for cleanup.
- Test-only sequential awaits: keep when the order is part of the scenario or makes the test assertion clearer.
- `no-secrets-in-client-code` for main-process service-name constants: these are keychain service identifiers, not credentials.
- React 19 `use()` migration: defer until a deliberate React 19 conventions pass.

Verification for future React Doctor work:

- `react-doctor . --offline --verbose`
- The touched file's warning count should drop or the remaining warning should be listed above with a reason.
- Do not add a CI-failing React Doctor gate until the baseline is materially smaller.
