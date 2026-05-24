# Azure DevOps Provider

Azure DevOps is not implemented in v1. This plan is for a future provider pass
that keeps Control's local-first and typed-boundary architecture intact while
making the implementation narrow enough to ship in stages.

## Current Baseline

Control is currently GitHub-first, not provider-neutral:

- `src/shared/github.ts` defines GitHub-only `CodeHost`, `CredentialProvider`,
  `AppState.github`, auth session types, availability names, repository
  contracts, and the `GitHubProvider` interface.
- `src/main/github/provider.ts` owns GitHub credential lookup, auth state,
  provider creation, read-through cache behavior, stale-cache behavior,
  repository recents, repository update events, and mutation cache invalidation.
- `src/main/github/octokitProvider.ts` and the domain modules under
  `src/main/github/*Domain.ts` own API-specific mapping into shared contracts.
- `src/main/github/credentials.ts` stores GitHub OAuth tokens through `keytar`.
  Tokens are not exposed to the renderer.
- `src/main/github/webOAuth.ts` uses GitHub device authorization and
  `DeviceSignInPollScheduler`.
- `src/main/ipc/registerControlIpc.ts`, `src/main/ipc/registerGithubIpc.ts`,
  `src/shared/ipc.ts`, and `src/preload/index.ts` expose GitHub-specific IPC
  channels.
- `src/main/storage/schema.ts` has generic `accounts`, `cache_entries`, and
  `recent_items` tables with a provider column, but repository read-model
  storage is GitHub-specific in `github_repositories`.
- `src/shared/local.ts`, `src/main/storage/recentItemsStore.ts`, and
  `src/main/storage/repositoryPinStore.ts` currently accept only `"github"` and
  `"local"` recents/pins in public types or SQL filters.
- Renderer auth, queries, labels, and fallbacks are GitHub-specific in
  `src/renderer/src/components/auth/*`, `src/renderer/src/hooks/*`, and
  collection/repository components.

Do not start by adding an Azure API client behind the existing GitHub shape. The
first implementation pass must introduce provider-aware contracts where Azure's
organization/project/repository hierarchy cannot be represented by GitHub's
`owner/repo` model.

## Product Scope

The first Azure DevOps implementation should target Azure DevOps Services only.
Azure DevOps Server/on-prem, service principals, managed identities, and manual
PAT entry are out of scope for the first shippable provider unless a separate ADR
accepts the auth and storage tradeoffs.

Use Microsoft Entra OAuth for Azure DevOps Services. Microsoft's guidance
recommends Microsoft Entra ID for new Azure DevOps integrations, recommends PATs
sparingly, and says legacy Azure DevOps OAuth is deprecated with new app
registrations no longer accepted. Treat legacy Azure DevOps OAuth as out of
scope.

Personal Microsoft account (MSA) backed Azure DevOps users are also out of scope
for the first shippable provider. Microsoft currently documents that Microsoft
Entra OAuth for the Azure DevOps resource does not natively support MSA users,
and points MSA-capable integrations at legacy Azure DevOps OAuth. Because this
plan keeps legacy Azure DevOps OAuth out of scope, Phase 1 must expose a typed
`unsupported_account_type` auth failure for users who can complete Microsoft
sign-in but cannot obtain an Azure DevOps resource token through Entra. The UI
should label that state as unsupported for this provider, not as a generic
sign-in failure.

MSA support is a deferred decision. Adding it later requires an ADR that
explicitly accepts one of these tradeoffs:

- Adopt legacy Azure DevOps OAuth despite deprecation and new-registration
  limits.
- Wait for native MSA support through Microsoft Entra OAuth for Azure DevOps.
- Keep MSA unsupported and document the product limitation.

Manual PAT support may be added later only for:

- Azure DevOps Server/on-prem.
- Tenant policies or environments where Microsoft Entra OAuth is unavailable.
- Explicit local power-user fallback, never the default product flow.

## Vocabulary And Identity

Azure DevOps has an extra project level that GitHub does not. Preserve that
instead of forcing it into `owner/repo`.

| Control concept  | GitHub today                                     | Azure DevOps target                                                                            |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Provider id      | `github`                                         | `azure-devops`                                                                                 |
| Account          | GitHub viewer/login                              | Entra-backed signed-in user plus discovered Azure DevOps accounts/organizations                |
| Organization     | GitHub organization login                        | Azure DevOps organization                                                                      |
| Project          | GitHub Projects/ProjectsV2                       | Azure DevOps project                                                                           |
| Repository owner | Repository owner login                           | Organization plus project                                                                      |
| Repository       | `owner/name`                                     | Azure Repos Git repository identified by organization, project id/name, and repository id/name |
| Issues           | GitHub issues                                    | Azure Boards work items                                                                        |
| Pull requests    | GitHub pull requests                             | Azure Repos pull requests                                                                      |
| Actions          | GitHub Actions workflow runs                     | Azure Pipelines builds/runs                                                                    |
| Projects         | GitHub Projects                                  | Azure DevOps projects and Boards queries                                                       |
| Contributors     | Commit authors, PR reviewers, issue participants | Commits, PR reviewers, work item participants, identities                                      |
| Permissions      | Repository/org permissions                       | Organization, project, repository, work item, build/pipeline permissions                       |

Required identifier rules:

- Add an explicit provider discriminator to any new shared contract that can
  refer to either GitHub or Azure DevOps.
- Store both the stable Azure DevOps account id and the routable organization
  name. The Accounts API exposes account-level fields such as `accountId`,
  `accountUri`, `organizationName`, and account status, while most Core/Git/WIT
  REST routes require the organization name in the URL.
- Use a stable Azure repository key derived from immutable dimensions where
  available: `azure-devops:{accountId}:{projectId}:{repositoryId}`. Keep
  `organization`, `projectName`, and `repositoryName` as routable/display
  metadata on the identity object, not as the primary database key.
- Keep a display string such as `organization/project/repository`, but do not use
  it as the only identity.
- Do not route Azure repository pages through the existing `owner/repo` input
  unless the route also carries provider-specific metadata needed to recover the
  Azure project and repository id.
- Handle renames explicitly. If organization, project, or repository names
  change, refresh the display/routing metadata for the same stable
  `accountId/projectId/repositoryId` key and update recents/cache display fields
  without creating a second repository identity.

## Provider Contracts

### Shared Types

Create provider-neutral shared primitives before adding Azure-specific renderer
calls:

- Add `src/shared/providers.ts` with:
  - `ProviderId = "github" | "azure-devops"`.
  - `CodeHost = "github" | "azure-devops"` or move the existing `CodeHost`
    alias there and re-export it from `src/shared/github.ts` during migration.
  - `CredentialProvider = "github-oauth" | "azure-devops-entra-oauth"`.
  - `ProviderBaseReadAvailabilityStatus` and `ProviderReadAvailability`, with
    provider-neutral statuses: `available`, `feature_disabled`, `not_loaded`,
    `stale`, `offline`, `permission_denied`, `rate_limited`, and `error`.
    Preserve `graphql_error` as a GitHub-only legacy extension such as
    `GitHubReadAvailabilityStatus`. Azure must never emit `graphql_error`.
  - `ProviderListResult<T>` and `ProviderNullableResult<TKey, TValue>`.
  - `ProviderAuthStatus`, `ProviderSignInSession`, and provider-specific session
    metadata that is still JSON-serializable.
  - `ProviderViewerMap` or provider-discriminated viewer records so shared app
    state never treats an Azure identity as a GitHub `Viewer`.
- Keep compatibility aliases in `src/shared/github.ts`:
  - `export type GitHubReadAvailability = ProviderReadAvailability`.
  - `export type GitHubListResult<T> = ProviderListResult<T>`.
- Add `src/shared/azureDevOps.ts` for Azure-specific domain contracts. Do not
  put raw Azure REST response types in shared files.

### Azure Domain Contracts

Initial shared Azure contracts should be narrow:

- `AzureDevOpsAuthStatus`
  - `available`, `authenticated`, `signInConfigured`, `user`, `error`.
  - `unsupportedAccountType` or an equivalent typed reason for MSA-backed
    accounts that cannot use the Entra Azure DevOps resource.
  - `organizationsDiscoveredAt` and `organizationCount` are optional display
    metadata, not auth truth.
- `AzureDevOpsViewer`
  - `provider: "azure-devops"`, `profileId`, `displayName`, `email`, `descriptor`
    when available, and `profileUrl`.
  - Do not derive identity from token claims. Treat tokens as opaque and use
    Azure DevOps Profile/Accounts APIs for stable user and organization data.
- `AzureDevOpsOrganizationSummary`
  - `provider: "azure-devops"`.
  - `accountId` as the stable id, `organizationName` as the routable URL segment,
    `accountUri`, `url`, `description`, `status`, and `lastAccessedAt`.
  - `id` may alias `accountId` for generic UI code, but the field name
    `accountId` must remain available in Azure contracts and cache keys.
- `AzureDevOpsProjectSummary`
  - `id`, `accountId`, `organization`, `name`, `description`, `state`,
    `visibility`, `url`.
- `AzureDevOpsRepositorySummary`
  - `provider: "azure-devops"`.
  - `repositoryKey`, `accountId`, `organization`, `projectId`, `projectName`,
    `repositoryId`, `repositoryName`, `displayName`, `defaultBranch`,
    `isDisabled`, `isFork`, `remoteUrl`, `sshUrl`, `apiUrl`, `webUrl`,
    `updatedAt`.
  - `webUrl` comes from Azure API data when available and is the only URL used
    for browser external links. `remoteUrl` and `sshUrl` are clone URLs and must
    not be opened as browser links.
  - Nullable count fields only when backed by an endpoint used in the current
    phase.
- `AzureDevOpsRepositoryDetail`
  - Extends the summary with branches, refs, readme/default branch metadata, and
    feature availability.
- `AzureDevOpsPullRequestSummary`
  - `pullRequestId`, source/target refs, title, description preview, status,
    createdBy, reviewers, createdAt, closedAt, mergeStatus, webUrl,
    linkedWorkItemRefsAvailability`.
- `AzureDevOpsWorkItemSummary`
  - `id`, `type`, `title`, `state`, `assignedTo`, `createdAt`, `changedAt`,
    `webUrl`, `repositoryContext` when known.
- `AzureDevOpsPipelineRunSummary`
  - Build/run id, definition id/name, status/result, branch, commit, queue time,
    finish time, webUrl.

Do not reuse `RepositorySummary`, `IssueSummary`, `PullRequestSummary`, or
`WorkflowRunSummary` for Azure until their fields have provider-neutral names
and nullability. The current GitHub contracts contain GitHub-only assumptions
such as `owner`, `nameWithOwner`, stars, watchers, and GitHub HTML URLs.

### Provider Interface

Add a dedicated Azure provider first, then decide how much to lift into a shared
base:

- Add `AzureDevOpsProvider` in `src/shared/azureDevOps.ts` for renderer-visible
  read methods.
- Add `AzureDevOpsProviderManager` in
  `src/main/azureDevOps/provider.ts`.
- Add domain modules under `src/main/azureDevOps/`:
  - `accountDomain.ts`
  - `organizationDomain.ts`
  - `projectDomain.ts`
  - `repositoryDomain.ts`
  - `pullRequestDomain.ts`
  - `workItemDomain.ts`
  - `pipelineDomain.ts`
  - `mutationDomain.ts` only when writes are in scope
  - `restClient.ts`
  - `credentials.ts`
  - `webOAuth.ts`

The first Azure provider interface should expose only read methods needed by the
first UI slice:

```ts
interface AzureDevOpsProvider {
  getViewer(): Promise<AzureDevOpsViewer>;
  listOrganizationsWithStatus(
    input?: AzureDevOpsOrganizationListInput
  ): Promise<AzureDevOpsOrganizationListResult>;
  listProjectsWithStatus(input: AzureDevOpsProjectListInput): Promise<AzureDevOpsProjectListResult>;
  listRepositoriesWithStatus(input: AzureDevOpsRepositoryListInput): Promise<AzureDevOpsRepositoryListResult>;
  getRepositoryWithStatus(
    input: AzureDevOpsRepositoryDetailInput
  ): Promise<AzureDevOpsRepositoryDetailResult>;
}
```

Add PR, work item, and pipeline methods only in the phases that implement those
surfaces.

Do not add `mutate(action: string, payload: unknown)`. If Azure writes are added,
use a discriminated union like GitHub's `GitHubMutationInput`, but with
Azure-specific required identifiers at the top level and no loose `payload`
object.

## Auth Boundary

### Main Process

Keep all Azure credentials in the main process:

- `src/main/azureDevOps/credentials.ts`
  - Store small credential secrets in the platform credential boundary, but do
    not assume `keytar` can hold the full MSAL serialized token cache. The
    GitHub provider currently uses `keytar` for one token string; MSAL cache
    blobs can be much larger and may contain multiple accounts, refresh tokens,
    and metadata.
  - Preferred first implementation: persist the serialized MSAL cache in a
    main-process-only encrypted file or SQLite blob protected by Electron
    `safeStorage`, and keep any small wrapping key/account pointer in the OS
    credential store only if needed. If `safeStorage` is unavailable on a
    platform, fail Azure auth with a typed credential-store state rather than
    writing plaintext cache data.
  - Use a service/account naming scheme that is provider-specific, for example
    service `Control Azure DevOps Token` and account keyed by tenant/user or
    `dev.azure.com`.
  - Do not persist access tokens, refresh tokens, PATs, client secrets, or token
    cache blobs in plaintext SQLite. If encrypted SQLite is chosen for the MSAL
    cache, the encryption/decryption stays behind
    `src/main/azureDevOps/credentials.ts`, and exported/imported data must
    classify it as secret and exclude it.
  - Mirror the GitHub `CONTROL_E2E` test-token convention only if Azure E2E
    coverage is explicitly added.
- `src/main/azureDevOps/webOAuth.ts`
  - Use Microsoft Entra OAuth through MSAL for Electron, with authorization code
    plus PKCE as the preferred interactive flow. Microsoft recommends MSAL for
    desktop apps, and this gives the provider the best path for tenant MFA,
    Conditional Access, broker/browser interaction, and silent token refresh.
  - Define the redirect capture mechanism before implementation. The default
    should be a local loopback listener such as `http://127.0.0.1:<port>/auth`
    registered in the Entra app, because it avoids app-protocol registration
    drift and matches desktop OAuth expectations. A custom `control://auth`
    protocol handler is acceptable only if an ADR documents OS registration,
    multi-window handling, and app registration requirements.
  - Device code flow is not the default for Control because Microsoft positions
    it mainly for headless/CLI scenarios. Use it only if an ADR accepts the UX
    tradeoff and documents why auth-code-with-PKCE/MSAL cannot satisfy Electron.
  - Keep every MSAL cache read/write behind `src/main/azureDevOps/credentials.ts`.
    If MSAL serializes cache material, persist that serialized cache only
    through the encrypted credential boundary described above.
  - Request Azure DevOps tokens for resource id
    `499b84ac-1321-427f-aa17-267ca6975798` / resource URI
    `https://app.vssps.visualstudio.com`.
  - Use `.default` token requests for the configured Azure DevOps delegated
    permissions.
  - The first shippable slice must configure delegated Azure DevOps permissions
    for `vso.profile`, `vso.project`, and `vso.code`. Later Boards and
    Pipelines phases add `vso.work` and `vso.build` only when those surfaces are
    implemented.
  - Include `offline_access` or the Microsoft-recommended refresh-token
    equivalent only when MSAL requires it for silent refresh.
  - Handle `InteractionRequiredAuthError` and Entra Continuous Access
    Evaluation claims challenges explicitly. Silent refresh failures with claims
    must transition the renderer into a typed "interaction required" state that
    preserves the claims challenge for the next interactive MSAL request instead
    of collapsing into a generic offline/auth error.
  - Treat tokens as opaque. Do not decode token claims for identity, tenant, or
    organization routing.
- `AzureDevOpsProviderManager.createAppState()` should read cached auth/account
  state without forcing a live network call, matching the GitHub warm-start
  behavior.

### Shared And Renderer State

Update `AppState` in `src/shared/github.ts` only as a migration step. The target
shape should be provider-aware, for example:

```ts
interface AppState {
  platform: NodeJS.Platform;
  isMac: boolean;
  settings: ControlSettings;
  providers: {
    github: {
      auth: GitHubAuthStatus;
      viewer: Viewer | null;
    };
    azureDevOps: {
      auth: AzureDevOpsAuthStatus;
      viewer: AzureDevOpsViewer | null;
    };
  };
  viewer: Viewer | null; // GitHub-only migration alias.
}
```

If keeping `appState.github` temporarily, add `appState.azureDevOps` alongside
it and document the migration. Keep `AppState.viewer` GitHub-only until removed,
and put Azure identity under `providers.azureDevOps.viewer` or
`appState.azureDevOps.viewer`. Do not replace GitHub auth semantics while adding
Azure.

`ControlSettings.credentialProvider` is not provider truth. Before Azure sign-in
is exposed, Phase 0/1 must either remove it from auth decisions or replace it
with provider-scoped settings, for example:

```ts
interface ControlAuthSettings {
  github: { credentialProvider: "github-oauth" };
  azureDevOps: { credentialProvider: "azure-devops-entra-oauth"; clientIdConfigured: boolean };
}
```

`GitHubProviderManager.signInWithBrowser()` may keep writing the legacy scalar
only during migration, but Azure sign-in must not overwrite an app-wide
`credentialProvider` and make GitHub appear unauthenticated or reconfigured.

Renderer auth work:

- Update `src/renderer/src/components/auth/providerAuthAdapters.ts`:
  - `ProviderAuthId = "github" | "azure-devops"`.
  - Add `createAzureDevOpsAuthAdapter`.
  - Update query invalidation to include provider-specific keys.
- Update `src/renderer/src/components/auth/AuthProvider.tsx`:
  - Expose `github` and `azureDevOps` controllers.
  - Avoid sharing one `status/session/error` state slot between providers.
- Update `src/renderer/src/components/auth/SetupPanel.tsx`:
  - Show provider-specific sign-in guidance and errors.
  - Do not say "Sign in with GitHub" when Azure is the selected provider.

## Runtime And API Boundary

Azure DevOps API calls should live behind `src/main/azureDevOps/restClient.ts`.

### Local Git Credential Boundary

REST authentication is not enough for Control to behave as a local Git client.
The first slice that can clone, fetch, or push Azure repositories must define
how local Git processes authenticate without depending on a user's global Git
Credential Manager configuration.

Implementation requirements:

- `src/main/azureDevOps/gitCredentials.ts` or an equivalent focused helper owns
  Git credential material for spawned `git` commands.
- Use a temporary credential helper or per-process HTTP extra header generated
  by main only for the target command. Do not write Azure tokens into repository
  `.git/config`, global Git config, shell history, command-line arguments, or
  renderer state.
- The helper must request the same Entra/Azure DevOps resource token family used
  by REST reads, refresh it through MSAL when needed, and fail with typed
  `interaction_required`, `credential_unavailable`, or `permission_denied`
  states rather than prompting from the Git subprocess.
- Git subprocess logs, operation results, and sync errors must redact
  authorization headers, helper paths containing secrets, and remote URLs with
  embedded credentials.
- Acceptance for repository clone/open cannot pass until at least one test or
  scripted validation proves a Git operation receives credentials through this
  boundary and that no credential lands in persistent Git config.

Requirements:

- Use `fetch` in the main process unless a new dependency is justified.
- Include `api-version` on every Azure DevOps REST request.
- Default the first implementation to Azure DevOps REST API `7.1`, then confirm
  preview endpoints individually where required.
- Support both Azure DevOps Services hosts:
  - Profile/account discovery host:
    `https://app.vssps.visualstudio.com`.
  - Organization-scoped Core/Git/Build/WIT host:
    `https://dev.azure.com/{organization}`.
- Use profile/account discovery before organization-scoped calls:
  - `GET https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1`
    to retrieve the signed-in Azure DevOps profile id.
  - `GET https://app.vssps.visualstudio.com/_apis/accounts?memberId={profileId}&api-version=7.1`
    to discover Azure DevOps accounts/organizations visible to the user.
- Keep profile/account cache keys separate from organization-scoped cache keys.
- Keep request construction typed; avoid passing arbitrary route strings from
  renderer or IPC.
- Normalize Azure REST responses once inside domain mappers. Shared contracts
  should not contain Azure `_links`, raw identity blobs, relation arrays, or
  `Record<string, unknown>` metadata.
- For repository lists, request URL fields supported by the endpoint, such as
  `includeAllUrls`/`includeLinks` where needed. Mappers must prefer returned
  `webUrl` for browser navigation and preserve `remoteUrl`, `sshUrl`, and REST
  `url` as separate fields.
- Centralize Azure error mapping in the client or a small error module:
  - 401/invalid token -> auth error and credential refresh path.
  - 401/403 after refresh -> `permission_denied`.
  - 404 -> endpoint-specific mapping, never one generic branch. Profile/account,
    project, repository, work item, and pipeline domains should each define how
    to distinguish not found, hidden/unauthorized, disabled, renamed, and
    deleted resources for the endpoints they call.
  - 429 and Azure throttling headers/messages -> `rate_limited`.
  - DNS/socket/fetch failures -> `offline`.
  - disabled feature or missing service -> `feature_disabled`.
  - malformed/partial response -> `error` with a user-safe message.
- Do not log tokens, authorization headers, full request bodies for work item
  edits, or private repository URLs containing credentials.
- Add tests for domain error mapping before broad UI wiring:
  - project not found vs project unauthorized.
  - repository disabled/hidden/deleted vs repository unauthorized.
  - throttling and offline mapping.
  - malformed profile/accounts responses.

## Storage Boundary

Use existing generic storage where it is already provider-ready:

- `accounts` can store Azure viewer/profile snapshots with provider
  `"azure-devops"` and separate organization/account snapshots keyed by
  `accountId`.
- `cache_entries` can store Azure read results with provider `"azure-devops"`.
- `recent_items` can store Azure recents after `src/shared/local.ts`,
  `recentItemsStore.ts`, and `mappers.ts` accept `"azure-devops"`.

Do not write Azure data into `github_repositories`.

Cache key design must be fixed before implementation. Use structured helpers
instead of ad hoc strings, and include every dimension that changes auth scope,
routing, response shape, or pagination:

- `provider`: always `"azure-devops"`.
- Auth scope: Entra tenant id when available from MSAL account metadata, signed-in
  profile id, and Azure DevOps `accountId` for account-scoped data.
- Routing scope: `organization`, `projectId`, `repositoryId`.
- Endpoint identity: domain and operation, for example `profile.me`,
  `accounts.list`, `projects.list`, `repositories.list`, `repositories.detail`.
- Request modifiers: `api-version`, `limit`, continuation token, branch/ref,
  path, and feature flags such as `includeAllUrls`/`includeLinks`.

Do not key Azure cache rows only by organization/project/repository display
names. Display names can collide or change, and generic `accounts` and
`cache_entries` rows must not leak stale data across users or organizations.

For the first read-only phase, prefer `cache_entries` for Azure organization,
project, repository, PR, work item, and pipeline results. Add a dedicated
provider-neutral repository read-model table only when needed for performance or
offline repository-directory UX:

- Target table name: `provider_repositories`.
- Primary key: `(provider, repository_key)`, where Azure repository keys use
  `azure-devops:{accountId}:{projectId}:{repositoryId}`.
- Required columns: `provider`, `repository_key`, `display_name`,
  `organization`, `project_key`, `repository_id`, `summary_json`, `detail_json`,
  `synced_at`, `detail_synced_at`, `updated_at`.
- Add mappers in `src/main/storage/mappers.ts` and a store module such as
  `src/main/storage/providerRepositoryStore.ts`.
- Keep GitHub's existing `github_repositories` table until a separate migration
  plan moves it. Do not block Azure on a GitHub storage migration.

Credential storage:

- Azure OAuth tokens and token cache material go through the encrypted
  main-process credential boundary, not plaintext SQLite. Use `keytar` only for
  small secrets or wrapping pointers when it is technically appropriate; do not
  require it to store the full MSAL serialized cache blob.
- Future PAT fallback must use the same credential boundary.
- SQLite may contain non-secret Azure organization/project/repository metadata,
  cache payloads, and web URLs.

Recents and pins:

- Phase 0 must widen `LocalRecentItem.provider` and
  `LocalRecentRecordInput.provider` in `src/shared/local.ts` to include
  `"azure-devops"`.
- Phase 0 must update `src/main/storage/recentItemsStore.ts` SQL filtering and
  `mapRecentItemRow()` so Azure recents are retained rather than dropped.
- Azure recents must store provider metadata sufficient to reopen without a live
  auth check when cached data exists: `accountId`, `organization`, `projectId`,
  `projectName`, `repositoryId`, `repositoryName`, and the stable
  `repositoryKey` for repository-scoped items.
- Azure Boards work items should reuse `LocalRecentKind` `"issue"` with
  provider-specific labels and metadata. Azure Pipelines runs should reuse
  `"workflowRun"`. Do not add `"workItem"` or `"pipelineRun"` until a separate
  recent-kind migration proves the generic kinds are insufficient.
- Azure repository pins are a non-goal for Phases 0-3. Existing repository pins
  remain GitHub/Area-oriented because `RepositoryPinRecord` has no provider and
  `area_repository_pins` is keyed by area/repository/workspace identity. A later
  pin implementation must either add provider repository pins with a provider
  column/table keyed by `repositoryKey`, or explicitly widen Areas to model
  Azure remote areas.

Areas:

- Azure repositories do not participate in Areas in the first shippable Azure
  slice. `src/shared/areas.ts` currently cannot represent Azure remote areas
  because `AreaKind` is `"github" | "local" | "ssh"` and
  `AreaRepositoryKind` is `"github" | "git" | "jj"`.
- If a future phase adds Azure Areas, it must widen `AreaKind` and
  `AreaRepositoryKind`, define how Azure-enriched local repositories relate to
  plain Git/JJ repositories, and update area repository pins in the same pass.

## IPC And Preload Boundary

Add Azure-specific IPC routes instead of overloading GitHub routes:

- `src/shared/ipc.ts`
  - Add `AzureDevOpsIpcApi`.
  - Add typed channels such as:
    - `azureDevOpsViewer`
    - `azureDevOpsOrganizationsWithStatus`
    - `azureDevOpsProjectsWithStatus`
    - `azureDevOpsRepositoriesWithStatus`
    - `azureDevOpsRepositoryWithStatus`
    - later PR/work item/pipeline channels by phase.
  - Add auth channels:
    - `signInWithAzureDevOps`
    - `getAzureDevOpsSignIn`
    - `cancelAzureDevOpsSignIn`
    - `clearAzureDevOpsToken`
    - `azureDevOpsAuthUpdated`.
- `src/main/ipc/registerAzureDevOpsIpc.ts`
  - Mirror `registerGithubIpc.ts` only for narrow Azure routes.
  - Export `createAzureDevOpsIpcRoutes()` so `registerControlIpc.ts` can mount
    Azure routes consistently with GitHub-specific routes.
  - Validate every input at the IPC boundary with field-specific parsers:
    organization URL segment, project id, project name, repository id,
    repository name, branch/ref name, path, continuation token, and numeric
    limits.
  - Reject slash injection, path traversal, empty route segments, control
    characters, and overlong route segments for organization/project/repository
    URL path fields.
  - Preserve valid UUID-like project and repository ids without lowercasing or
    display-name normalization.
  - Enforce list limits and payload-size caps on future mutations.
- `src/main/ipc/registerControlIpc.ts`
  - Accept an `azureDevOps: AzureDevOpsProviderManager` dependency next to
    `github`.
  - Register Azure auth routes and spread `createAzureDevOpsIpcRoutes()` in the
    same place GitHub route ownership is clarified, so Azure routes are not split
    unpredictably between inline handlers and provider-specific registries.
  - Keep GitHub route behavior unchanged.
- `src/main/index.ts`
  - Construct one `AzureDevOpsProviderManager` beside `GitHubProviderManager`.
  - Pass it into `registerControlIpc()`.
  - Wire provider-specific update callbacks to main-to-renderer events.
- `src/main/ipc/events.ts`
  - Add `azureDevOpsAuthUpdated` and later Azure repository/update events as
    typed `ControlIpcEvents`.
  - Keep existing `githubAuthUpdated` and `githubRepositoriesUpdated` payloads
    unchanged.
- `src/preload/index.ts`
  - Expose `control.azureDevOps`.
  - Forward Azure auth/update event subscriptions.
  - Do not expose tokens or raw OAuth responses.

Typed input examples:

```ts
interface AzureDevOpsProjectListInput {
  accountId: string;
  organization: string;
  limit?: number;
  continuationToken?: string;
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}

interface AzureDevOpsRepositoryDetailInput {
  accountId: string;
  organization: string;
  projectId: string;
  repositoryId: string;
  cacheOnly?: boolean;
  forceRefresh?: boolean;
}
```

IPC acceptance tests should include `src/main/ipc/registerAzureDevOpsIpc.test.ts`
coverage for:

- rejecting organization/project/repository route fields with `/`, `..`,
  backslashes, control characters, or empty strings.
- accepting valid Azure organization names and UUID project/repository ids.
- clamping or rejecting invalid `limit` values.
- preserving continuation tokens as opaque bounded strings.
- ensuring `cacheOnly` routes do not call live REST client methods.

## UI Exposure

Initial UI should expose Azure DevOps deliberately, not as hidden GitHub data:

- Settings/auth surface:
  - Add an Azure DevOps sign-in action beside GitHub.
  - Show configured/unconfigured state separately for each provider.
  - Make token-clear actions provider-specific.
  - Show the MSA unsupported state with provider-specific copy when Entra cannot
    issue an Azure DevOps resource token for the signed-in account.
  - Do not use one app-wide `credentialProvider` display value to summarize both
    GitHub and Azure auth.
- Collection routes:
  - Add provider filter or provider tabs before mixing repository rows.
  - Include provider in React Query keys, for example
    `["repositories", "azure-devops", organization, projectId, limit]`.
  - Include stable account and pagination dimensions in Azure query keys, for
    example
    `["repositories", "azure-devops", accountId, organization, projectId, limit, continuationToken]`.
  - Update empty/error/loading text to say Azure DevOps when the Azure route is
    active.
  - External-link actions must use Azure web URLs from provider data, not
    `https://github.com/${nameWithOwner}`.
  - Do not fabricate Azure browser URLs from `organization/project/repository`
    when the API returns `webUrl`.
- Repository page:
  - Do not open an Azure repository through a GitHub-only `owner/repo` route.
  - Add provider-aware route state in `useRepositoryRouteState.ts` or introduce
    a parallel Azure repository page until common repository UI is extracted.
  - Hide GitHub-only tabs/features for Azure until implemented:
    Discussions, GitHub Security and Quality, GitHub Actions-specific controls,
    wiki, releases, repository admin, star/watch/fork.
  - Keep unsupported features as absent or explicitly unavailable, not fake
    zero-count data.
- Command palette, recents, and pins:
  - Include provider in item metadata and route builders.
  - Recents should be able to reopen Azure organizations, projects, and
    repositories in the first shippable slice without a live auth check when
    cached metadata is present.
  - Later PR, work item, and pipeline run recents must use the existing
    `pullRequest`, `issue`, and `workflowRun` recent kinds with provider-specific
    labels and Azure metadata. Acceptance tests must prove existing GitHub
    issue/workflow recents still render correctly.
  - Azure repository pins are not exposed until the storage model has a provider
    key or Areas explicitly support Azure.

## Sync And Cache Behavior

Follow the GitHub read-through cache behavior:

- Every Azure read method accepts `cacheOnly` and `forceRefresh` where the same
  method can render cached data.
- List methods that can return large result sets accept `limit` and
  `continuationToken`, return an opaque `nextContinuationToken`, and include the
  token in cache keys. The UI may start with a bounded first page, but it must
  preserve the next token for explicit continuation rather than silently
  truncating data.
- `cacheOnly: true` returns cached data or `not_loaded`, never a live network
  request.
- Non-forced reads return fresh cache when available.
- Stale cache may be returned immediately with an async background refresh.
- Live failures with cached data should return the cached data with `stale`
  availability where the UI can still render useful content.
- Live failures without cached data should return an empty/null result with a
  precise availability status.
- Mutations, when added, must invalidate only affected Azure cache prefixes and
  emit provider-specific update events.
- Real-time updates are out of scope for the first shippable Azure slice. Azure
  DevOps Service Hooks are project/server scoped and not a user-scoped desktop
  streaming API. Freshness must rely on manual refresh, stale-while-revalidate,
  mutation invalidation, and bounded TTLs until a later plan justifies polling or
  service-hook configuration.

Suggested initial TTLs:

- Organizations/projects: `120_000`.
- Repository lists/details/refs/readme: `300_000`.
- Pull requests/work items: `30_000`.
- Pipelines/runs: `15_000`.

Document the TTLs near the provider manager when implemented. Do not copy GitHub
TTL values blindly if Azure endpoint latency or freshness requirements differ.

## Error States

The renderer must be able to distinguish these states without parsing message
text:

- Azure sign-in unavailable because the app registration/client id is missing.
- Microsoft account/MSA user is unsupported by the Entra-only Azure DevOps
  provider.
- User cancelled sign-in.
- Device/browser authorization expired.
- Tenant requires interaction or Conditional Access blocked token refresh,
  including MSAL `InteractionRequiredAuthError` and CAE claims challenges that
  must be replayed into the next interactive request.
- Credential missing from keychain after SQLite still has cached data.
- Authenticated user has no visible organizations.
- Organization is visible but selected project is not accessible.
- Repository is deleted, disabled, renamed, or not visible.
- Boards is disabled or the user lacks work item permission.
- Pipelines is disabled or the user lacks build permission.
- Azure throttled the request.
- Network is offline.
- Cached data is stale because refresh failed.

Map these to `ProviderReadAvailability` plus auth-specific status. Avoid broad
`error` when a more specific status is known.

## Phased Implementation

### Phase 0: Provider-Neutral Foundation

Goal: make the app capable of representing more than GitHub without changing
GitHub behavior.

Work:

- Add `src/shared/providers.ts` and compatibility aliases in
  `src/shared/github.ts`.
- Extend `CodeHost`, `CredentialProvider`, `LocalRecentItem.provider`, and
  `LocalRecentRecordInput.provider`.
- Split provider-neutral read availability from GitHub-only `graphql_error`.
- Replace `ControlSettings.credentialProvider` as provider truth with
  provider-scoped auth settings, or clearly mark the legacy scalar as GitHub-only
  during migration.
- Keep `AppState.viewer` GitHub-only during migration and add a provider
  viewer map or `appState.azureDevOps.viewer` before Azure auth UI ships.
- Update recent item SQL filters and mappers so `"azure-devops"` rows are not
  dropped.
- Do not add Azure repository pins in this phase. Document them as deferred until
  provider pins or Azure Areas exist.
- Add generic provider auth update event types in `src/shared/ipc.ts`, or add
  Azure-specific events alongside existing GitHub events.
- Add React Query key conventions that include provider for new Azure queries.
- Add tests for shared IPC serialization and local recent provider filtering.
- Add tests proving GitHub issue/workflow recents still render after Azure
  recents reuse `"issue"` and `"workflowRun"` kinds.

Acceptance criteria:

- Existing GitHub tests still pass.
- No Azure API calls exist yet.
- The type system can represent an Azure DevOps recent item and auth provider
  without casts.
- GitHub auth, settings, and `AppState.viewer` behavior remain unchanged.
- Azure repository pins and Azure Areas are explicit non-goals for the first
  shippable slice.

### Phase 1: Azure Auth And App State

Goal: sign in to Azure DevOps Services and expose auth status without repository
data.

Work:

- Add `src/main/azureDevOps/credentials.ts`, `webOAuth.ts`, and
  `provider.ts` with auth-only manager behavior.
- Use MSAL with authorization code plus PKCE for Microsoft Entra OAuth. Device
  code flow requires a separate ADR and is not the default Electron path.
- Implement the redirect capture chosen in the Auth Boundary section, including
  Entra app registration documentation for the loopback or custom protocol URI.
- Configure Azure DevOps delegated permissions for `vso.profile`, `vso.project`,
  and `vso.code`; request tokens for `https://app.vssps.visualstudio.com` using
  `.default`.
- Detect and expose unsupported MSA-backed accounts as a typed auth failure.
- Add Azure auth IPC/preload routes.
- Construct `AzureDevOpsProviderManager` in `src/main/index.ts`, pass it through
  `registerControlIpc()`, and add typed Azure auth events in
  `src/shared/ipc.ts`, `src/main/ipc/events.ts`, and `src/preload/index.ts`.
- Add Azure auth adapter/controller in renderer auth components.
- Store non-secret viewer/account snapshot in `accounts` with provider
  `"azure-devops"`.
- Store MSAL cache material only through the encrypted main-process credential
  boundary. Do not force the full serialized MSAL cache into `keytar`; use
  `safeStorage`-protected SQLite/file storage when the cache exceeds
  credential-store-safe size.
- Add environment/config handling for the Azure OAuth client id. Use a
  provider-specific variable such as `CONTROL_AZURE_DEVOPS_CLIENT_ID`.

Acceptance criteria:

- Startup can render cached GitHub/local data while Azure auth state is checking.
- Azure sign-in, polling, cancellation, expiry, and token-clear flows have typed
  UI states.
- Tenant interaction/Conditional Access refresh failures and unsupported MSA
  accounts have typed UI states.
- Clearing Azure credentials does not clear GitHub credentials or cache.
- Azure sign-in does not overwrite an app-wide credential provider setting used
  by GitHub.

### Phase 2: Organization, Project, And Repository Directory

Goal: read-only Azure DevOps Services discovery.

Work:

- Add `src/main/azureDevOps/restClient.ts`.
- Support both profile/account discovery on `app.vssps.visualstudio.com` and
  organization-scoped API calls on `dev.azure.com/{organization}`.
- Add organization, project, and repository domain modules.
- Add list methods and IPC routes for organizations, projects, and
  repositories.
- Add typed continuation-token support for project/repository list methods and
  cache keys.
- Cache list results in `cache_entries` with provider `"azure-devops"`.
- Add collection UI for Azure organizations/projects/repositories.
- Add provider-aware external links.
- Add mapper tests that preserve returned repository `webUrl`, `remoteUrl`,
  `sshUrl`, and REST `url`, and use only `webUrl` for browser links.
- Add endpoint-specific error mapping tests for profile/account discovery,
  project listing, and repository listing.

Acceptance criteria:

- User can sign in, list organizations, select a project, and list repositories.
- Cached organization/project/repository lists render with `cacheOnly` while
  offline or signed out.
- Empty organizations/projects/repos are distinct from auth or permission
  failures.
- Repository list UI renders a bounded first page and exposes continuation when
  Azure returns a next token.
- Organization records store both stable `accountId` and routable
  `organizationName`.
- Repository identity uses `azure-devops:{accountId}:{projectId}:{repositoryId}`
  while display and route metadata survive renames.

### Phase 3: Azure Repository Detail And Code Read Surface

Goal: open an Azure repository without GitHub route assumptions.

Work:

- Add provider-aware repository route state.
- Add clone/open support for Azure repositories using the Local Git Credential
  Boundary above. Repository detail without clone/open is not enough for the
  first useful desktop slice.
- Add repository detail, branches, default branch, tree/contents, file content,
  commit list, and readme support only where Azure endpoints provide enough
  data.
- Hide unsupported GitHub-only tabs.
- Record Azure repository recents with provider and Azure identifiers.

Acceptance criteria:

- Azure repository detail opens from the Azure repository directory and recents.
- User can clone/open an Azure repository into a local workspace through
  main-owned Git credentials, and validation proves no Azure credential is
  written into persistent Git config.
- Offline cached repository detail can render.
- GitHub repository pages continue to use existing GitHub routes.

### Phase 4: Pull Requests

Goal: read Azure Repos PR lists and detail.

Work:

- Add Azure PR summary/detail contracts and domain methods.
- Add list/detail IPC routes.
- Include comments, iterations/files, commits, reviewers, checks/policies, and
  linked work item refs only as supported by implemented endpoints.
- Surface missing subresources with availability fields.

Acceptance criteria:

- PR list and detail render with cached/stale/permission states.
- Linked work item refs are visible when available and explicitly unavailable
  when not loaded or unauthorized.

### Phase 5: Work Items As Issues

Goal: read Azure Boards work items without pretending they are GitHub issues.

Work:

- Add work item query/list/detail contracts.
- Map work item fields into explicit Azure work item summary/detail types.
- Represent relations and PR links as structured, provider-specific data.
- Add UI labels for work item type/state/assigned user.

Acceptance criteria:

- Work items can be listed for selected project/repository context.
- Boards disabled and permission-denied states are distinguishable.

### Phase 6: Pipelines As Actions

Goal: read Azure Pipelines runs/builds.

Work:

- Add pipeline run list/detail contracts.
- Map build/run status and result into Azure-specific enums.
- Add logs/artifacts only when the data can be retrieved and cached safely.

Acceptance criteria:

- Pipeline runs render for a repository/project.
- Disabled pipelines, permission denial, and no runs are separate states.

### Phase 7: Mutations

Goal: add safe Azure writes after read surfaces are stable.

Candidate mutations:

- PR comments.
- Work item edits/comments/state changes.
- Reviewer add/remove.
- Pipeline rerun/cancel.

Requirements:

- Use discriminated union input types.
- Validate every mutation at IPC.
- Invalidate provider-specific cache prefixes only.
- Emit Azure-specific update events.
- Add focused mutation tests.

### Phase 8: PAT Fallback And Azure DevOps Server Research

Goal: decide whether non-Entra auth belongs in product.

Work:

- Write an ADR before implementation.
- Classify PAT storage and redaction requirements.
- Decide if Azure DevOps Server is supported, including base URL, version,
  auth, API compatibility, and unsupported feature handling.
- Add UI that clearly labels PAT fallback as local-only and user-provided.

## Acceptance Criteria For First Shippable Azure Slice

The first shippable slice is Phases 0-3. Phases 0-2 are a necessary foundation,
but they only prove auth and directory listing; they are not enough user value
for a desktop Git client unless repository detail and clone/open are included.

- Azure DevOps Services auth uses Microsoft Entra OAuth, not legacy Azure DevOps
  OAuth and not PATs.
- Personal Microsoft account/MSA-backed Azure DevOps users are explicitly
  unsupported in the Entra-only slice and receive a typed auth error.
- Electron auth uses MSAL authorization code with PKCE, with MSAL cache material
  wrapped by the encrypted main-process credential boundary.
- The redirect mechanism is implemented and documented for the Entra app
  registration, including loopback/custom protocol behavior and cancellation.
- App registration and consent cover `vso.profile`, `vso.project`, and
  `vso.code`, and token requests target the Azure DevOps resource URI with
  `.default`.
- Azure tokens and MSAL cache data are never persisted in plaintext SQLite or
  renderer-accessible state.
- Silent token refresh handles `InteractionRequiredAuthError` and CAE claims
  challenges by returning a typed interaction-required auth state.
- Shared contracts can represent provider-specific auth, organizations,
  projects, and repositories without `unknown` or broad metadata bags.
- App state cannot confuse Azure identity with GitHub `Viewer`; `AppState.viewer`
  remains GitHub-only until removed or replaced by a provider viewer map.
- Provider-neutral availability does not expose GitHub-only `graphql_error` for
  Azure.
- IPC routes are typed and validated with field-specific Azure identifier
  parsers.
- `src/main/index.ts`, `src/shared/ipc.ts`, `src/main/ipc/events.ts`, and
  `src/preload/index.ts` all expose Azure provider manager, auth, and event
  ownership explicitly.
- Renderer can list Azure organizations, projects, and repositories.
- Renderer can open Azure repository detail and initialize a local clone/open
  flow through main-owned Git credentials.
- Organization discovery uses Profile/Accounts APIs on
  `app.vssps.visualstudio.com`; project/repository calls use
  `dev.azure.com/{organization}`.
- Cache keys include provider, auth/account scope, route ids, endpoint,
  pagination, request modifiers, and API version.
- Cache-only Azure reads work when offline, signed out, or while auth is still
  checking.
- GitHub behavior, cache keys, routes, and UI remain unchanged except for
  provider-neutral type widening needed to add Azure.
- Recents can persist Azure rows and continue to list existing GitHub/local rows.
- Azure repository pins and Azure Areas are not part of the first shippable
  slice.
- Azure DevOps live updates rely on manual refresh, TTLs, and
  stale-while-revalidate; user-scoped streaming or Service Hook integration is
  deferred.
- Error states distinguish not loaded, offline, permission denied, rate limited,
  stale, and generic error.
- Repository list pagination preserves continuation tokens.
- Azure external links use returned `webUrl`, not fabricated GitHub-style URLs or
  clone URLs.

## Validation Commands

Doc-only changes:

```bash
bunx prettier --check docs/v2/azure-devops-provider.md
```

Provider-foundation implementation:

```bash
bun run format
bun run lint
bun run typecheck
bun run test -- src/shared/ipc.test.ts src/preload/index.test.ts src/main/ipc/registerControlIpc.test.ts src/main/storage.test.ts src/renderer/src/data/mocks/api.test.ts
```

Azure auth implementation:

```bash
bun run format
bun run lint
bun run typecheck
bun run test -- src/main/azureDevOps src/main/ipc src/preload/index.test.ts src/renderer/src/components/auth
```

Azure repository-directory implementation:

```bash
bun run format
bun run lint
bun run typecheck
bun run test -- src/main/azureDevOps src/main/storage src/main/ipc src/preload/index.test.ts src/renderer/src/hooks src/renderer/src/components/collection
```

Full implementation closeout:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

Do not add Playwright E2E tests for Azure unless explicitly requested.

## Open Decisions

- Whether the first Azure repository route should reuse the repository page with
  provider-aware route state or ship as a parallel Azure repository detail page.
- Whether a provider-neutral repository read-model table is needed before Azure
  repository detail, or whether `cache_entries` is sufficient until performance
  evidence says otherwise.
- How provider selection should appear in the main collection UI: tabs, filter,
  or separate sidebar entries.
