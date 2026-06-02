# Control Merge Seams

Read this reference when a merge touches shared files or when a UI regression could come from lost shell, route, data, or CSS behavior.

## Highest-Risk Shared Files

- `src/shared/github.ts`: shared GitHub contracts. Preserve additive schema changes and downstream field expectations.
- `src/shared/ipc.ts`: renderer/preload/main IPC contract. Reconcile both method signatures and result shapes before renderer code.
- `src/main/ipc/registerGithubIpc.ts`: IPC registration boundary. Keep handler names aligned with `src/shared/ipc.ts`.
- `src/main/github/provider.ts`: provider orchestration. Preserve cache, auth, rate-limit, and partial-failure behavior.
- `src/renderer/src/App.tsx`: shell composition, route selection, global query ownership, topbar/content layout classes.
- `src/renderer/src/components/shell/RepositoryRouteSection.tsx`: repository route composition and focused surface wiring.
- `src/renderer/src/components/repository/RepositoryPage.tsx`: repository page frame and tab composition.
- `src/renderer/src/hooks/useRepositoryRouteState.ts`: repository route orchestration and tab-derived state.
- `src/renderer/src/hooks/useRepositoryRefreshActions.ts`: repository refresh ownership and invalidation flow.
- `src/renderer/src/components/shell/appInvalidations.ts`: cross-surface invalidation behavior.
- `src/renderer/src/styles.css`: global layout, liquid glass, shell spacing, shared card/list/row styling.

## Merge Resolution Guidance

### Shared Contracts

Resolve types and IPC before renderer components. If both sides add fields, preserve all fields unless a field was deliberately removed in both code and tests.

Checks:

- `rg "newFieldOrMethodName" src`
- `bun run typecheck`

### Route And Shell Orchestration

Treat `App.tsx`, route state hooks, and shell components as integration points. Do not drop route-specific classes, selected Area handling, or invalidation behavior just because one side has a cleaner-looking block.

Checks:

- Home route still gets route-specific content scroll behavior.
- Repository routes still get repository content scroll behavior.
- Local repository routes still use local repository shell behavior.
- Topbar and sidebar selected Area state still agree.

### CSS

Resolve CSS conflicts by selector ownership, not by order alone. Preserve selectors for current user-visible behavior even if nearby sections were reformatted.

Checks:

- `rg "workspace-home|home-content-scroll|repository-content-scroll|local-recent|home-activity-overview|nav-item" src/renderer/src/styles.css`
- Browser or Playwright verification for touched views.

### Surface Modules

Surface-specific files under `src/renderer/src/components/repository/` can usually keep local intent if contracts still compile. When surface work also changes shared hooks or query keys, audit both layers together.

Checks:

- Run the closest focused test.
- Verify a representative UI path manually when layout or interaction changed.
