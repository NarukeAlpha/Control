# Pull Requests Implementation Plan

## Goal

Make Pull Requests mirror the issue improvements while preserving PR-specific
review, checks, files, commits, mergeability, and branch workflows.

## Current State

- `PullRequestsTab.queries.ts` hard-codes `state: "all"` in list and refresh
  paths.
- `pullRequestsTabQueryKey(owner, repo, limit)` omits state.
- PR detail is already decomposed into overview, comments, files, commits,
  reviews, checks, review threads, timeline, and linked issues.
- `PullRequestsTabContent.tsx` has a very broad prop surface but useful
  subcomponents.
- `uiStore.ts` already has `pullNumber`, `pullFilter`, and `pullComposer`.
- `useRepositoryRouteState.ts` calls PR queries for Pull Requests and Agents.

## Primary Files

- `src/renderer/src/components/repository/pull-requests/PullRequestsTab.queries.ts`
- `src/renderer/src/components/repository/pull-requests/PullRequestsTab.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestsTabContent.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestList.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestDetailSummary.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestDiscussion.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestInspection.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestMetadataControls.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestReviewerControls.tsx`
- `src/renderer/src/components/repository/pull-requests/PullRequestConversationActions.tsx`
- `src/renderer/src/hooks/useRepositoryRouteState.ts`
- `src/renderer/src/stores/uiStore.ts`
- `src/main/github/pullRequestDomain.ts`
- `src/shared/github.ts`

## State Filter Requirements

- Add `PullRequestStateFilter = "open" | "closed" | "all"`.
- Default to `open`.
- Add route state as `pullState?: PullRequestStateFilter` or equivalent.
- Add state to query key: `["pulls", owner, repo, state, limit]`.
- Thread state through hook, prefetch, refresh, and API calls.
- Change all `listPullRequestsWithStatus` calls from `state: "all"` to the
  selected `PullRequestStateFilter`.
- Preserve local text filter as `pullFilter`.
- Do not fetch `all` for the default open view.
- Deep link to a PR number must load detail even if current list state does not
  include that PR.

## UI Requirements

- Add state control beside `Filter pull requests`.
- Keep create pull request action available.
- Remove fallback language from rows and detail.
- Keep `Open on GitHub` as a secondary rail action.
- Show counts and limit-hit state.
- Preserve loading, empty, cached, stale, unavailable, permission, and error
  states.
- Keep detail section loading explicit so heavy panels do not all fetch at once.

## Full Detail Architecture

```text
PullRequestDetailPage
├── PullRequestDetailHeader
├── GitHubDetailLayout
│   ├── PullRequestTimelineColumn
│   │   ├── PullRequestBodyEvent
│   │   ├── PullRequestTimelineEventList
│   │   ├── PullRequestFilesOrDiffEntryPoints
│   │   └── PullRequestReviewComposer
│   └── PullRequestConfigurationRail
│       ├── OpenOnGitHubAction
│       ├── PullRequestStateCard
│       ├── PullRequestReviewDecisionCard
│       ├── PullRequestChecksSummaryCard
│       ├── PullRequestMergeabilityCard
│       ├── PullRequestBranchCard
│       ├── PullRequestReviewersCard
│       ├── PullRequestAssigneesCard
│       ├── PullRequestLabelsCard
│       ├── PullRequestMilestoneCard
│       ├── PullRequestLinkedIssuesCard
│       └── PullRequestMergeActions
```

## Timeline Composition

- PR body from overview.
- Conversation comments.
- Commits.
- Review submissions.
- Review thread summaries.
- Timeline events.
- Check summary events where useful.
- Cross-reference events for linked issues where GitHub exposes them.

Do not copy issue detail blindly. Extract shared layout primitives, then keep
PR-specific rail and timeline semantics.

## Detail Section Loading

- Overview loads when a PR is selected.
- Comments load when timeline is visible.
- Files load when file section is opened or when route demands it.
- Commits load when timeline or commits section needs them.
- Reviews load when review activity is visible.
- Checks load when check summary or merge readiness needs them.
- Review threads load when review thread section is requested.
- Linked issues load when rail or timeline needs them.

## Mutation Requirements

- Preserve create PR.
- Preserve comment and review submission.
- Preserve approve/comment/request changes.
- Preserve reviewer requests and removals.
- Preserve team reviewer requests and removals.
- Preserve labels, assignees, and milestone.
- Preserve close/reopen.
- Preserve merge.
- Preserve code path, commit, workflow run, and linked issue navigation.
- Invalidate selected state-specific list and affected detail sections after
  mutations.

## Tests

- Query key includes state.
- Default state is open.
- Prefetch and refresh use selected state.
- Detail section composition still works after layout changes.
- Review, metadata, and merge disabled reasons remain correct.
- Route state tests cover `pullState` if added.

## Screenshots

- PR list, open default, dark theme.
- PR list, closed state, dark theme.
- PR list, open default, light theme.
- Full PR detail with timeline and rail.
- Full PR detail with timeline and rail, light theme.
- PR with failing checks.
- PR merge-disabled state.

## Acceptance Criteria

- PR list fetches open PRs by default.
- Closed/all PRs are explicit.
- Full PR detail is not a vertical dump of unrelated panels.
- Reviews, checks, branch metadata, linked issues, and merge actions are
  scannable.
- Mergeability, conflicts, and disabled merge reasons are visible before the
  user reaches the final merge action.
- Existing PR mutations still work.
- Required validation passes.
