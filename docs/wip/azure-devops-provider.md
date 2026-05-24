# Azure DevOps Provider

Azure DevOps is not implemented in v1. This document keeps the future provider
plan while preserving the architecture rules established by the GitHub cleanup.

## Preferred Auth

Use Microsoft Entra OAuth as the primary auth path for Azure DevOps Services.
Manual Personal Access Tokens may exist as a fallback for local power users, but
should not be the default product flow.

## Provider Mapping

Control concept to Azure DevOps:

- Account: Azure DevOps organization or signed-in Microsoft account.
- Repository owner: organization/project pair.
- Repository: Azure Repos Git repository.
- Issues: Azure Boards work items.
- Pull requests: Azure Repos pull requests.
- Actions: Azure Pipelines runs.
- Projects: Azure DevOps projects and Boards.
- Contributors: identities from commits, PR reviewers, and work item
  participants.
- Permissions: project, repository, work item, and pipeline permissions.

## API Shape

The provider should implement normalized concepts through strict IPC contracts:

- read methods exposed to the renderer should use `*WithStatus` signatures
- list methods should return availability-bearing list shapes
- detail methods should expose availability for partial or unsupported data
- mutations should use discriminated union inputs
- provider-specific metadata should be explicit and serializable

Do not introduce `mutate(action: string, payload: unknown)` or broad
`Record<string, unknown>` payloads.

## Phased Rollout

1. Read-only Azure DevOps organization/project/repository listing.
2. Azure Repos repository pages and pull requests.
3. Work items mapped into Issues.
4. Pipelines mapped into Actions.
5. Write actions for PR comments, work item edits, reviewers, and pipeline
   reruns.
6. PAT fallback and enterprise/on-prem research.

## Risks

- Microsoft Entra OAuth setup complexity.
- Project-scoped permissions and partial access.
- PR iteration APIs for changed files.
- Work item relation expansion and cross-project links.
- Azure DevOps Server/on-prem version differences.
- Leaking Azure raw fields through loose IPC metadata.
