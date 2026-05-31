# Pull Request Detail Decomposition Design

## Goal

Keep `getPullRequestDetailWithStatus` as the compatibility route while introducing smaller pull-request detail
subresources that can load concurrently. The split must improve locality without creating a renderer waterfall.

## Current Compatibility Payload

`PullRequestDetail` currently mixes the overview, discussion, review, check, file, commit, timeline, and linked-issue
surfaces in one result. That is useful for compatibility, but it makes partial failures hard to represent and forces
unrelated UI sections to share one refresh path.

## Proposed Subresources

| Subresource    | Current fields                                                                                                                                                        | Result shape                                                                                             | Pagination        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| Overview       | inherited `PullRequestSummary`, `body`, `labels`, `assignees`, `milestone`, `requestedReviewers`, `requestedTeams`, `latestReviewState`, `reviewDecisionAvailability` | `PullRequestOverviewResult` with `overview` and `availability`                                           | none              |
| Comments       | `commentsList`, `commentsAvailability`                                                                                                                                | `PullRequestCommentsResult` with `items`, `availability`, optional `pageInfo`                            | yes               |
| Files          | `files`, `filesAvailability`                                                                                                                                          | `PullRequestFilesResult` with `items`, `availability`, optional `pageInfo`                               | yes               |
| Commits        | `commitsList`, `commitsAvailability`                                                                                                                                  | `PullRequestCommitsResult` with `items`, `availability`, optional `pageInfo`                             | yes               |
| Reviews        | `reviews`, `reviewsAvailability`                                                                                                                                      | `PullRequestReviewsResult` with `items`, `availability`, optional `pageInfo`                             | yes               |
| Checks         | `checks`, `checksAvailability`                                                                                                                                        | `PullRequestChecksResult` with `items`, `availability`                                                   | no initial cursor |
| Review Threads | `reviewThreads`, `reviewThreadsAvailability`, `reviewThreadStatesAvailability`                                                                                        | `PullRequestReviewThreadsResult` with `items`, `availability`, `statesAvailability`, optional `pageInfo` | yes               |
| Timeline       | `timelineEvents`, `timelineAvailability`                                                                                                                              | `PullRequestTimelineResult` with `items`, `availability`, optional `pageInfo`                            | yes               |
| Linked Issues  | `linkedIssues`, `linkedIssuesAvailability`                                                                                                                            | `PullRequestLinkedIssuesResult` with `items`, `availability`                                             | no initial cursor |

## Route Plan

Keep these routes until every renderer consumer has moved:

- `github:get-pull-request-detail`
- `github:get-pull-request-detail-with-status`

Add new route catalog entries in pull-request-domain slices:

- `github:pull-request-overview-with-status`
- `github:pull-request-comments-with-status`
- `github:pull-request-files-with-status`
- `github:pull-request-commits-with-status`
- `github:pull-request-reviews-with-status`
- `github:pull-request-checks-with-status`
- `github:pull-request-review-threads-with-status`
- `github:pull-request-timeline-with-status`
- `github:pull-request-linked-issues-with-status`

Each route uses `PullRequestDetailInput` plus route-specific cursor or limit fields where pagination is supported.

## Renderer Composition

`PullRequestsTab` should compose subresources through parallel React Query calls keyed by owner, repo, pull number,
limit, cursor, `cacheOnly`, and `forceRefresh`. The overview query gates the selected PR header. Files, commits,
reviews, checks, review threads, timeline, and linked issues should not wait on each other.

The compatibility query can remain as the fallback while the first subresources move. Do not remove
`PullRequestDetail` until a fixture test proves the composed subresources can recreate the old complete payload.

## Required Tests

- Route validators reject missing owner, repo, and pull number for each new subresource.
- Preload parity tests include every new route channel.
- Provider tests cover each subresource independently and preserve current availability mapping.
- Renderer tests prove subresource queries are scheduled concurrently, not sequentially.
- Mock tests cover partial availability: stale files with available comments, rate-limited checks with available
  reviews, and permission-denied review threads with available overview.
- Compatibility tests prove a complete fixture from the new subresources matches the old `PullRequestDetail` payload
  before the old route is removed.

## Do Not Do

- Do not rename the monolithic route and call that a split.
- Do not make the renderer load overview, then files, then commits, then reviews in sequence.
- Do not drop pagination metadata from comments, files, commits, reviews, threads, or timeline.
- Do not remove `PullRequestDetail` until mocks, provider, preload, route catalog, and renderer call sites have all
  moved.
