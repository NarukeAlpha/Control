# Azure DevOps Provider Plan

Azure DevOps is not implemented in V1. This document defines how it should fit into Control later without changing the renderer architecture.

## Preferred Auth

Use Microsoft Entra OAuth as the primary auth path for Azure DevOps Services.

Manual Personal Access Tokens can exist as a fallback for local power users, but should not be the default product flow. PATs require careful scope guidance and expiration handling.

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

The provider should implement the same normalized interface used by GitHub:

- `listRepositories`
- `getRepository`
- `listContents`
- `listIssues`
- `listPullRequests`
- `listActions`
- `listProjects`
- `mutate`

Azure-specific fields should be stored in provider metadata rather than leaking into shared renderer components.

## Data Model Differences

- Azure DevOps has an organization/project/repository hierarchy.
- Work items are typed and field-driven instead of GitHub issue-shaped.
- Pull request diffs are iteration-based.
- Identity descriptors are not the same as GitHub logins.
- Pipelines are separate from repositories but commonly linked by project.
- Work item links can point across projects and repositories.

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

