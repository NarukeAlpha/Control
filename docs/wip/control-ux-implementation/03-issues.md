# Issues Implementation Plan

## Goal

Make Issues an open-first, GitHub-like issue management experience with
server-backed state filtering, route-stable detail, chronological timeline, and
configuration rail.

## Current State

- `IssuesTab.queries.ts` hard-codes `state: "all"` in list, prefetch, and
  refresh paths.
- `issuesTabQueryKey(owner, repo, issueListLimit)` omits state.
- `IssuesTab.tsx` owns selected issue, text filter, create/edit/comment state,
  label entry, assignee entry, milestone entry, close reason, and show-all
  toggles.
- `useIssueDetail.ts` already provides focused issue detail query behavior.
- `uiStore.ts` already has `issueNumber`, `issueFilter`, and `issueComposer`.
- `useRepositoryRouteState.ts` calls `useIssuesTabQueries` for Issues and
  Agents, so issue query changes also affect Agents.

## Primary Files

- `src/renderer/src/components/repository/issues/IssuesTab.queries.ts`
- `src/renderer/src/components/repository/issues/IssuesTab.tsx`
- `src/renderer/src/components/repository/issues/useIssueDetail.ts`
- `src/renderer/src/components/repository/issues/IssueActionFooter.tsx`
- `src/renderer/src/components/repository/issues/IssueCommentComposer.tsx`
- `src/renderer/src/components/repository/issues/IssueMetadataControls.tsx`
- `src/renderer/src/hooks/useRepositoryRouteState.ts`
- `src/renderer/src/hooks/useRepositoryRefreshActions.ts`
- `src/renderer/src/hooks/useRepositoryWarmPrefetch.ts`
- `src/renderer/src/stores/uiStore.ts`
- `src/shared/github.ts`
- `src/main/github/issueDomain.ts`
- `src/main/github/provider.ts`

## State Filter Requirements

- Add `IssueStateFilter = "open" | "closed" | "all"`.
- Default to `open`.
- Put state in route state as `issueState?: IssueStateFilter` or equivalent.
- Put state in query key: `["issues", owner, repo, state, limit]`.
- Put state in hook input, prefetch input, and refresh input.
- Send selected state to `api.github.listIssuesWithStatus`.
- Do not fetch `all` for the default open view.
- Preserve text filter independently from state filter.
- Preserve issue composer mode independently from state filter.
- If the selected issue is absent from the current list, show the focused
  detail if route includes `issueNumber`; otherwise show a clear empty detail.
- Deep link to an issue number must fetch issue detail even if the current list
  state is `open` and the issue is closed.

## UI Requirements

- Add a segmented state control next to the text filter.
- Visible states should include Open and Closed; All is acceptable if the
  product wants it exposed.
- Show result count and limit-hit copy.
- Use shared `FilterBar` and `StateSegmentedControl` once available.
- Map `GitHubDetailLayout`, `IssueTimelineColumn`, and
  `IssueConfigurationRail` onto the shared `DetailLayout`, `Timeline`, and
  `DetailRail` primitives rather than creating issue-only layout rules.
- Remove fallback wording from issue rows and detail.
- Keep `Open on GitHub` as a deliberate secondary action in full detail.
- Keep create issue action primary but not visually oversized.
- Keep loading, empty, cache-only, stale, unavailable, permission, and error
  states distinct.

## Full Detail Architecture

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
│       └── IssueStateActions
```

## Timeline Model

Start with available data, then extend provider only where necessary:

```ts
type IssueTimelineItem =
  | { kind: "body"; createdAt: string; actor: ActorSummary; body: string }
  | { kind: "comment"; createdAt: string; comment: TimelineCommentSummary }
  | { kind: "event"; createdAt: string; event: IssueTimelineEventSummary }
  | { kind: "commit"; committedAt: string; commit: RepositoryCommitSummary }
  | { kind: "cross-reference"; createdAt: string; reference: LinkedReferenceSummary };
```

- Unsupported timeline events should render as generic events.
- Missing optional event details should not break the timeline.
- Comments remain editable/deletable through existing mutation patterns.
- Comment composer stays at the bottom of the timeline.
- State changes, label changes, assignment changes, and milestone changes should
  appear in chronological order when provider data is available.
- Extend provider timeline data in one focused pass only when current data is
  insufficient.
- Bound long timelines through pagination, virtualization, or expandable event
  groups before rendering high-volume issues.

## List And Full-Detail Transition

- The normal Issues tab can keep a list/preview browsing layout.
- When route state includes `issueNumber`, the selected issue must use the full
  detail layout with timeline and rail.
- The implementation must explicitly decide whether the list remains visible,
  collapses to a narrow navigation rail, or is hidden while full detail is open.
- That decision must preserve back navigation, selection state, and refresh
  behavior.
- If the selected issue is not in the current state-filtered list, the full
  detail still renders from `useIssueDetail`.

## Mutation Requirements

- Preserve create issue.
- Preserve edit issue.
- Preserve comment.
- Preserve edit/delete comment.
- Preserve close/reopen.
- Preserve label add/remove.
- Preserve assignee add/remove.
- Preserve milestone changes.
- Preserve locked conversation disabled reason.
- After mutation, invalidate the state-specific issue list, selected issue
  detail, labels, assignable users, and milestones as needed.
- Do not broadly invalidate unrelated repository tabs.

## Data Flow

- Route state determines repository, tab, `issueNumber`, `issueFilter`,
  `issueState`, and `issueComposer`.
- Query key derives from owner, repo, issue state, and limit.
- Main process receives state and returns status-bearing results.
- Renderer displays cached data when offline or cache-only.
- Explicit refresh uses `forceRefresh` when GitHub is ready.
- Mutation success invalidates focused and state-specific keys.

## Tests

- Query key includes state.
- Hook sends default `open` state.
- Prefetch sends selected state.
- Refresh sends selected state.
- Route state preserves text filter while changing state.
- Deep linked issue detail loads even when not in list.
- Fallback wording is absent from changed components.
- Existing Playwright benchmark selectors are updated for open/closed state
  controls and renamed external-link actions where those tests already cover
  Issues. New e2e specs still require explicit approval.
- Existing mutation tests remain valid.

## Screenshots

- Issues list, dark theme, open default.
- Issues list, dark theme, closed selected.
- Empty open issue state.
- Full issue detail with timeline and rail.
- Cache-only or stale issue list if fixture supports it.

## Acceptance Criteria

- Default Issues tab fetches open issues only.
- Closed issues are an explicit state change.
- Query keys, API inputs, refresh, prefetch, route state, and tests agree.
- Issue detail has main timeline and right rail.
- Fallback language is gone.
- Existing issue mutations still work.
- Required validation passes.
