# Azure DevOps Provider Plan

Azure DevOps is not implemented in V1. This document defines how it should fit
into Control later without changing the renderer architecture or weakening the
strict IPC model introduced by cleanup-v2-gpt.

## Preferred Auth

Use Microsoft Entra OAuth as the primary auth path for Azure DevOps Services.

Manual Personal Access Tokens can exist as a fallback for local power users, but
should not be the default product flow. PATs require careful scope guidance and
expiration handling.

## Provider Mapping

Control concept to Azure DevOps:

- Account: Azure DevOps organization or signed-in Microsoft account.
- Repository owner: organization/project pair.
- Repository: Azure Repos Git repository.
- Issues: Azure Boards work items.
- Pull requests: Azure Repos pull requests.
- Actions: Azure Pipelines runs.
- Projects: Azure DevOps projects and Boards.
- Contributors: identities from commits, PR reviewers, and work item participants.
- Permissions: project, repository, work item, and pipeline permissions.

## API Shape

The provider should implement the same normalized concepts used by GitHub, but
through cleanup-v2's strict IPC shape:

- read methods exposed to the renderer should use `*WithStatus` signatures
- list methods should return the shared availability-bearing list shape
  equivalent to `GitHubListResult<T>`
- detail methods should expose explicit availability for partial or unsupported
  data
- mutations should use discriminated union inputs, not a generic mutate payload

Azure-specific fields should be stored in provider metadata rather than leaking
into shared renderer components.

## Mutation Model

Azure DevOps should not be squeezed into `GitHubMutationInput` unless the action
is truly provider-neutral. Prefer one of these explicit models:

- a provider-neutral mutation union for actions shared across providers
- a separate `AzureMutationInput` discriminated union for Azure-specific actions

Do not introduce a generic `mutate(action: string, payload: unknown)` API.
Mutation inputs must remain strictly typed, Json-serializable, and specific
enough for cache invalidation to know which provider and repository surfaces
changed.

## IPC Serialization

Azure DevOps contracts must satisfy Control's strict shared IPC rules:

- inputs and outputs are `JsonSerializable`
- provider-specific metadata is explicit and serializable
- no `Record<string, unknown>` payloads cross IPC
- runtime constants define literal unions for action names, states, and provider
  capabilities
- partial failures become availability fields rather than raw thrown values in
  renderer state

## Data Model Differences

- Azure DevOps has an organization/project/repository hierarchy.
- Work items are typed and field-driven instead of GitHub issue-shaped.
- Pull request diffs are iteration-based.
- Identity descriptors are not the same as GitHub logins.
- Pipelines are separate from repositories but commonly linked by project.
- Work item links can point across projects and repositories.

These differences should be normalized through typed mappers before data crosses
IPC. Azure-specific raw payloads should not be passed through to renderer
components.

## UI Reuse

Use the same Control shell:

- Left nav remains Home, Issues, Pull requests, Projects, Packages-like provider sections.
- Repository page remains the central route.
- Provider-specific filters appear inside tabs.
- Labels can adapt to Work Items, Pipelines, and Boards while keeping the same layout.

## Phased Rollout

1. Read-only Azure DevOps organization/project/repository listing.
2. Repos + pull requests.
3. Work items mapped into the Issues view.
4. Pipelines mapped into Actions.
5. Write actions for PR comments, work item edits, reviewers, and pipeline reruns.
6. PAT fallback and enterprise/on-prem research.

## Risks

- Microsoft Entra OAuth setup complexity.
- Project-scoped permissions and partial access.
- PR iteration APIs for changed files.
- Work item relation expansion and cross-project links.
- Azure DevOps Server/on-prem version differences.
- Overfitting Azure mutations into GitHub-specific mutation unions.
- Leaking Azure raw fields through loose IPC metadata.
