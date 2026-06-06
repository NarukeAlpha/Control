# Actions Implementation Plan

## Goal

Make Actions a coherent GitHub Actions management surface organized by
workflow catalog, workflow runs, and run detail.

## Current State

- `ActionsTab.queries.ts` centers the default query on
  `listActionsWithStatus`.
- `workflowDefinitionsQueryKey` and `workflowRunDetailQueryKey` already exist.
- `ActionsTab.tsx` already includes workflow definitions, dispatch inputs, run
  detail, jobs, steps, check runs, annotations, artifacts, logs, rerun, rerun
  failed jobs, job rerun, and cancel concepts.
- `uiStore.ts` has `workflowRunId`, `workflowArtifactId`, `workflowFilter`, and
  `workflowComposer`.

## Primary Files

- `src/renderer/src/components/repository/actions/ActionsTab.tsx`
- `src/renderer/src/components/repository/actions/ActionsTab.queries.ts`
- `src/renderer/src/components/repository/workflows/workflowRunState.ts`
- `src/renderer/src/hooks/useRepositoryRouteState.ts`
- `src/renderer/src/hooks/useRepositoryRefreshActions.ts`
- `src/renderer/src/stores/uiStore.ts`
- `src/main/github/provider.ts`
- `src/main/github/octokitProvider.ts`
- `src/main/github/workflowDomain.ts`
- `src/main/github/readCache.ts`
- `src/main/github/requestDedupe.ts`
- `src/shared/github.ts`

## Hierarchy

```text
Actions tab
├── Workflow catalog
│   ├── workflow name
│   ├── workflow file path
│   ├── state
│   ├── dispatchability
│   └── latest run summary
├── Selected workflow runs
│   ├── branch/ref filter
│   ├── event filter
│   ├── status/conclusion filter
│   └── actor filter if available
└── Selected run detail
    ├── summary/status/conclusion
    ├── jobs
    ├── steps
    ├── check suites/check runs
    ├── annotations
    ├── artifacts
    ├── logs
    └── rerun/cancel controls
```

## Implementation Tasks

- Make workflow definitions the first-class list.
- Keep an all-runs view for broad repository activity.
- Add selected workflow route state if current `workflowFilter` is not enough.
- Preserve direct `workflowRunId` deep links.
- Route PR check links into selected run detail.
- Move dispatch form into selected workflow context.
- Keep workflow ref selection close to dispatch.
- Show run attention state using `workflowRunState`.
- Keep run detail available for failed, cancelled, timed out, in-progress, and
  successful runs.
- Preserve artifact download controls.
- Preserve job log loading and unavailable states.
- Preserve rerun, rerun failed jobs, job rerun, and cancel disabled reasons.
- Remove dummy or fallback language. `Open on GitHub` remains only as a
  deliberate external action, never as a substitute for missing in-app state.

## Component Split

- `WorkflowCatalogPane` or `WorkflowListPane`
- `WorkflowRunListPane`
- `WorkflowRunDetailPage`
- `WorkflowRunSummaryHeader`
- `WorkflowFailureSummary`
- `WorkflowJobPanel`
- `WorkflowStepList`
- `WorkflowCheckRunPanel`
- `WorkflowAnnotationList`
- `WorkflowArtifactPanel`
- `WorkflowLogViewer`
- `WorkflowDispatchForm`

Use names that match the codebase style; the point is ownership separation.

## Data Flow

- Route owns repository, selected workflow, selected run, filter, and dispatch
  composer state.
- Workflow definitions query uses owner, repo, ref, and limit.
- Run list query uses owner, repo, selected workflow, branch/ref, status, event,
  and limit where supported.
- Run detail query uses owner, repo, and run id.
- Main-process provider/cache changes should add missing workflow-specific
  endpoints once the renderer needs workflow definitions, latest run summaries,
  artifacts, logs, annotations, or cancel/rerun detail not already exposed.
- Cache-ready fields should include workflow identifiers, workflow file path,
  workflow state, latest run id, latest run status, and latest run conclusion.
- Explicit refresh updates definitions, run list, refs, and selected run detail.
- Rerun/cancel/dispatch invalidates selected workflow run list and selected run
  detail.

## Section-Local Failure Rules

- `WorkflowLogViewer` reports log unavailable, expired, permission denied, and
  still-processing states without hiding the run summary or jobs.
- `WorkflowArtifactPanel` reports no artifacts, expired artifact, permission
  denied, and download failure states without hiding logs or annotations.
- Check runs, annotations, and jobs each keep their own loading/error/empty
  states.
- Route-level failure is reserved for missing repository identity or selected
  run identity, not for a failed auxiliary endpoint.

## Tests

- Query key tests for workflow definitions and run detail.
- `workflowRunState` tests for failure/attention states if changed.
- Component tests for selecting workflow and run if feasible.
- Mutation disabled reason tests if action availability logic changes.

## Screenshots

- Actions landing with workflow catalog.
- Selected workflow with runs.
- All-runs view.
- Failed run detail with failure summary.
- Run detail with artifacts/logs unavailable.
- Dispatch form.

## Acceptance Criteria

- Actions starts from workflow catalog.
- Users can select workflow, then run, then inspect detail.
- Direct run deep links still work.
- Failure summary is actionable.
- Logs and artifacts fail section-locally.
- Rerun/cancel controls remain safe.
- Provider/cache additions prepare the route for validator-backed freshness
  without forcing the cache redesign into this route migration.
- Required validation passes.
