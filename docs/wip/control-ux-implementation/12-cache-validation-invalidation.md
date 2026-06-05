# Cache Validation And Targeted Invalidation Plan

## Goal

Move Control from broad TTL/stale refresh behavior toward validated cached reads,
cheap freshness checks, mutation-driven invalidation, and local gateway events,
while preserving local-first resilience.

## Current State

- `src/main/github/provider.ts` has explicit TTLs for account, repository,
  issue, PR, discussion, actions, workflow, projects, settings, security,
  releases, contributors, and content surfaces.
- Many reads support `cacheOnly` and `forceRefresh`.
- `src/main/github/readCache.ts` has specialized repository list stale fallback,
  background refresh, request dedupe, and negative cache behavior.
- `src/main/storage/localStoreAdapter.ts` stores `etag`, but most provider cache
  writes currently use `etag: null`.
- Renderer query hooks set `staleTime`, but main process cache is the real data
  reliability boundary.

## Principles

- Cached data is acceptable if it is explicit and validated.
- Validators must be cheaper than the heavy reads they protect.
- Mutation invalidation should be targeted.
- Offline and rate-limited behavior must preserve useful cached UI.
- Avoid broad polling.
- Route entry, user refresh, mutation results, local gateway events, and cheap
  validators should drive freshness.
- Queue or throttle live validation when multiple tabs warm at once.
- Respect primary and secondary rate-limit signals; validation must back off
  before it turns a cached app into an API burst.

## Cache Envelope

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

## Validation Layers

### REST Conditional Requests

- Store `etag` and `lastModified` when GitHub REST returns them.
- Send `If-None-Match` where endpoint support is confirmed.
- Send `If-Modified-Since` where endpoint support is confirmed and
  `lastModified` is available.
- Treat `304 Not Modified` as validation success.
- Extend freshness on `304`.
- Preserve payload on `304`.
- Preserve stale fallback when validation request fails.
- Do not expose raw header values to renderer unless necessary.

### GraphQL Validators

- Repository: id, updatedAt, pushedAt, default branch, open/closed issue
  counts, open/closed PR counts, release count, project count, disk usage.
- Issue list: state, totalCount, first page id hash, newest updatedAt.
- Issue detail: node id, number, state, updatedAt, comments count, labels hash,
  assignees hash, milestone id.
- PR detail: node id, state, updatedAt, latest commit oid, commits count,
  comments count, reviews count, reviewDecision, mergeable, labels hash,
  assignees hash, requested reviewers hash.
- Actions: workflow count, workflow ids hash, workflow file hash, latest run id,
  latest status, latest conclusion.
- Projects: project updatedAt, item count, field count.
- Wiki: page list shas and selected page sha.

### Local Gateway Validators

- Area id.
- Repository path.
- Repository id.
- Workspace id.
- Provider kind.
- Current branch.
- Current bookmark.
- HEAD oid.
- JJ working copy change id.
- JJ working copy commit id.
- Dirty count.
- Status hash.
- Latest operation id.
- Remotes hash.

## Mutation Invalidation

- Add issue comment: issue detail timeline and current issue list row.
- Add/remove issue label: issue detail rail, issue list row, project item
  options.
- Close/reopen issue: issue detail, open issue list, closed issue list.
- Add PR comment/review: PR detail comments/reviews/timeline and PR list row.
- Merge PR: PR detail, open PR list, closed/all PR list, branch refs, checks.
- Workflow rerun/cancel/dispatch: selected workflow runs and selected run
  detail.
- Update repository feature: repo detail, settings, wiki/projects availability.
- Update branch protection/ruleset: settings and security section keys only.
- Wiki mutation: wiki page list and selected page.
- Project mutation: selected project, project list, related item options.

## React Query Strategy

- Keep renderer query keys stable and explicit.
- Keep `staleTime` as UI throttling, not truth.
- Main process should decide whether cached data is valid, stale, validating, or
  unavailable.
- Add a provider-level validated read primitive before per-feature custom hooks.
- Return status-bearing results so renderer can show cached/stale messages.
- Expose renderer hook architecture as
  `useValidatedGitHubQuery<TData, TValidator>`.
- Hook inputs should include `queryKey`, `readCached`, `validate`, `refresh`,
  `enabled`, and `validationPolicy`.
- Main-process read paths should distinguish `cacheOnly`, `validateOnly`, and
  `forceRefresh` so route entry, validation, and manual refresh do not collapse
  into the same expensive operation.

## Validation Resolution Tree

```text
Renderer route opens
├── readCached(cacheOnly)
│   ├── cache hit -> render immediately with cached/possibly stale state
│   └── cache miss -> show loading or unavailable state
├── schedule validate(validateOnly) according to validationPolicy
│   ├── unchanged -> extend expiry, update validatedAt, keep payload
│   ├── changed -> refresh heavy detail, replace payload, update validator
│   ├── rate limited -> keep payload, mark rate_limited, back off validators
│   └── validation error -> keep payload, mark stale/error locally
└── user refresh(forceRefresh)
    ├── bypass cheap validator where needed
    └── update only matching query scopes and affected detail sections
```

## Validation Concurrency

- Centralize validation scheduling near the provider/cache boundary.
- Dedupe identical validators with `requestDedupe`.
- Limit concurrent live validators per account and repository.
- Prioritize visible route validators over hidden prefetch validators.
- Coalesce route warmup for repository overview, Issues, PRs, Actions, Projects,
  Wiki, Security, and Settings instead of starting one request burst per tab.
- When secondary rate-limit headers or abuse-detection responses appear, stop
  optional validators and preserve cached UI.

## Snapshot Examples

```ts
const repositorySnapshot = {
  latestCommitOid: "abc123",
  issuesOpenCount: 18,
  pullRequestsOpenCount: 4,
  defaultBranch: "main"
};

const issueDetailSnapshot = {
  state: "open",
  updatedAt: "2026-06-05T05:00:00Z",
  commentsCount: 12,
  labelsHash: "bug,ui"
};

const workflowSnapshot = {
  workflowIdsHash: "build,test",
  latestRunId: 123456,
  latestStatus: "completed",
  latestConclusion: "failure"
};
```

## Suggested State Model

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

## Rollout Strategy

1. Instrument current heavy reads and background refreshes.
2. Add validator metadata storage without changing behavior.
3. Implement one high-impact REST surface with ETag support.
4. Implement one GraphQL validator surface.
5. Add targeted mutation invalidation for Issues and PRs.
6. Add local gateway event invalidation for local repository status.
7. Migrate remaining surfaces gradually.

## Tests

- Cache entry stores validator metadata.
- `304` validates without replacing payload.
- Validation error preserves stale payload.
- Rate limit returns status-bearing cached result.
- Mutation invalidates targeted keys.
- Request dedupe prevents duplicate validators.
- Validation scheduler throttles tab warmup and backs off on secondary
  rate-limit signals.
- Local gateway event invalidates local keys.

## Acceptance Criteria

- At least one high-impact REST surface uses ETag validation end to end.
- Cache writes retain validator metadata where available.
- `304` extends freshness without replacing payload.
- Mutation invalidation is narrower than broad repository refresh.
- Offline/rate-limited behavior remains useful.
- Required validation passes.
