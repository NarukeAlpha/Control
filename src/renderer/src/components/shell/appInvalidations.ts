import type { QueryClient } from "@tanstack/react-query";

import type { AreaRepositoryUpdatedEvent, AreaWorkspaceUpdatedEvent } from "@shared/areas";
import type { GitHubAction, GitHubMutationInput } from "@shared/github";
import { repositoryScopedQueryKeys } from "../../queries/repositoryQueryKeys";

export interface RepositoryQueryScope {
  owner: string;
  repo: string;
}

const githubSessionQueryKeys = [
  ["app-state"],
  ["repositories"],
  ["account-profile"],
  ["account-issues"],
  ["account-pulls"],
  ["notifications"],
  ["organizations"],
  ["github-account-repositories"],
  ["repository-tree"],
  ["organization-teams"],
  ["organization-repositories"],
  ["organization-members"],
  ["organization-projects"],
  ["organization-team-repositories"],
  ["organization-team-members"]
] as const;

export function repositoryQueryScopeFromNameWithOwner(
  nameWithOwner: string | null
): RepositoryQueryScope | null {
  if (!nameWithOwner) {
    return null;
  }

  const [owner, repo] = nameWithOwner.split("/");
  return owner && repo ? { owner, repo } : null;
}

export async function invalidateRepositoryScopedQueries(
  queryClient: QueryClient,
  owner: string,
  repo: string
): Promise<void> {
  await Promise.all(
    repositoryScopedQueryKeys(owner, repo).map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

export async function invalidateGitHubSessionQueries(
  queryClient: QueryClient,
  activeRepository: RepositoryQueryScope | null
): Promise<void> {
  const invalidations: Array<Promise<void>> = githubSessionQueryKeys.map((queryKey) =>
    queryClient.invalidateQueries({ queryKey })
  );

  if (activeRepository) {
    invalidations.push(
      invalidateRepositoryScopedQueries(queryClient, activeRepository.owner, activeRepository.repo)
    );
  }

  await Promise.all(invalidations);
}

export async function invalidateGitHubMutationQueries(
  queryClient: QueryClient,
  input: GitHubMutationInput
): Promise<void> {
  await Promise.all([
    ...githubMutationInvalidationQueryKeys(input).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  ]);
}

export async function invalidateAreaRepositoryUpdateQueries(
  queryClient: QueryClient,
  event: AreaRepositoryUpdatedEvent
): Promise<void> {
  await Promise.all(
    areaRepositoryUpdateInvalidationQueryKeys(event).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  );
}

export async function invalidateAreaWorkspaceUpdateQueries(
  queryClient: QueryClient,
  event: AreaWorkspaceUpdatedEvent
): Promise<void> {
  await Promise.all(
    areaWorkspaceUpdateInvalidationQueryKeys(event).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  );
}

export function githubMutationInvalidationQueryKeys(
  input: GitHubMutationInput
): ReadonlyArray<readonly unknown[]> {
  const keys: Array<readonly unknown[]> = [["notifications"]];
  keys.push(
    ...repositoryQueryPrefixesForMutation(input.action).map((prefix) =>
      repositoryMutationQueryKey(prefix, input)
    )
  );
  keys.push(...globalQueryKeysForMutation(input.action));
  return uniqueQueryKeys(keys);
}

function repositoryMutationQueryKey(
  prefix: string,
  input: GitHubMutationInput
): readonly [string] | readonly [string, string, string] {
  if (prefix === "pull-detail") {
    return [prefix] as const;
  }

  return [prefix, input.owner, input.repo] as const;
}

export function areaRepositoryUpdateInvalidationQueryKeys(
  event: AreaRepositoryUpdatedEvent
): ReadonlyArray<readonly unknown[]> {
  const repositoryScope = event.repositoryId ? [event.areaId, event.repositoryId] : [event.areaId];
  return uniqueQueryKeys([
    ["area-repositories", event.areaId],
    ["area-repository", ...repositoryScope],
    ["area-workspaces", ...repositoryScope],
    ["area-contents", ...repositoryScope],
    ["area-file-content", ...repositoryScope],
    ["area-sync-status", ...repositoryScope],
    ["area-github-issues", ...repositoryScope],
    ["area-github-pulls", ...repositoryScope],
    ["area-github-actions", ...repositoryScope]
  ]);
}

export function areaWorkspaceUpdateInvalidationQueryKeys(
  event: AreaWorkspaceUpdatedEvent
): ReadonlyArray<readonly unknown[]> {
  const workspaceScope = [event.areaId, event.repositoryId, event.workspaceId ?? "none"] as const;
  return uniqueQueryKeys([
    ["area-workspaces", event.areaId, event.repositoryId],
    ["area-contents", ...workspaceScope],
    ["area-file-content", ...workspaceScope],
    ["area-sync-status", ...workspaceScope]
  ]);
}

function repositoryQueryPrefixesForMutation(action: GitHubAction): readonly string[] {
  switch (action) {
    case "star":
    case "unstar":
    case "watch":
    case "unwatch":
    case "fork":
      return ["repository"];
    case "editRepository":
      return [
        "repository",
        "issues",
        "pulls",
        "discussions",
        "projects",
        "releases",
        "repository-wiki",
        "repository-access",
        "repository-security-policy",
        "repository-community-profile"
      ];
    case "createIssue":
    case "editIssue":
    case "closeIssue":
    case "reopenIssue":
      return ["issues", "issue-detail", "repository"];
    case "addComment":
    case "editComment":
    case "deleteComment":
      return ["issues", "issue-detail"];
    case "addLabels":
    case "removeLabel":
    case "setAssignees":
    case "removeAssignees":
      return ["issues", "issue-detail", "pulls", "pull-detail", "labels", "assignable-users", "milestones"];
    case "createPullRequest":
    case "mergePullRequest":
    case "closePullRequest":
    case "reopenPullRequest":
      return ["pulls", "pull-detail", "commits", "branches", "repository"];
    case "approvePullRequest":
    case "commentPullRequestReview":
    case "requestChanges":
    case "requestReviewers":
    case "removeReviewers":
    case "editReviewComment":
    case "deleteReviewComment":
      return ["pulls", "pull-detail"];
    case "rerunWorkflow":
    case "rerunFailedWorkflowJobs":
    case "rerunWorkflowJob":
    case "dispatchWorkflow":
    case "cancelWorkflow":
      return ["actions", "action-detail", "workflows"];
    case "createRelease":
    case "editRelease":
    case "deleteRelease":
    case "deleteReleaseAsset":
      return ["releases", "release-detail", "repository"];
    case "updateBranchProtection":
    case "deleteBranchProtection":
      return ["branch-protection", "repository-access"];
    case "addRepositoryCollaborator":
    case "removeRepositoryCollaborator":
    case "updateCollaboratorPermission":
    case "addRepositoryTeam":
    case "removeRepositoryTeam":
    case "updateTeamPermission":
      return ["repository-access", "repository"];
    case "createRepositoryRuleset":
    case "updateRepositoryRuleset":
    case "deleteRepositoryRuleset":
      return ["repository-rulesets", "repository-access", "branch-protection"];
    case "createDiscussion":
    case "editDiscussion":
    case "closeDiscussion":
    case "reopenDiscussion":
    case "addDiscussionComment":
    case "editDiscussionComment":
    case "deleteDiscussionComment":
      return ["discussions", "discussion-detail", "discussion-categories", "repository"];
    case "createProjectV2":
    case "updateProjectV2":
    case "deleteProjectV2":
    case "addProjectV2Item":
    case "updateProjectV2Item":
    case "deleteProjectV2Item":
      return ["projects", "issues", "issue-detail", "pulls", "pull-detail", "repository"];
    case "createWikiPage":
    case "editWikiPage":
    case "deleteWikiPage":
      return ["repository-wiki"];
    default:
      return ["repository"];
  }
}

function globalQueryKeysForMutation(action: GitHubAction): ReadonlyArray<readonly unknown[]> {
  switch (action) {
    case "star":
    case "unstar":
    case "watch":
    case "unwatch":
    case "fork":
      return [["repositories"], ["github-account-repositories"], ["account-profile"]];
    case "editRepository":
      return [
        ["repositories"],
        ["github-account-repositories"],
        ["organizations"],
        ["organization-repositories"],
        ["organization-team-repositories"],
        ["account-issues"],
        ["account-pulls"]
      ];
    case "createIssue":
    case "editIssue":
    case "closeIssue":
    case "reopenIssue":
    case "addComment":
    case "editComment":
    case "deleteComment":
    case "addLabels":
    case "removeLabel":
    case "setAssignees":
    case "removeAssignees":
      return [["account-issues"], ["account-pulls"]];
    case "createPullRequest":
    case "mergePullRequest":
    case "closePullRequest":
    case "reopenPullRequest":
    case "approvePullRequest":
    case "commentPullRequestReview":
    case "requestChanges":
    case "requestReviewers":
    case "removeReviewers":
    case "editReviewComment":
    case "deleteReviewComment":
      return [["account-pulls"]];
    default:
      return [];
  }
}

function uniqueQueryKeys(keys: ReadonlyArray<readonly unknown[]>): ReadonlyArray<readonly unknown[]> {
  const seen = new Set<string>();
  return keys.filter((key) => {
    const identity = JSON.stringify(key);
    if (seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
}
