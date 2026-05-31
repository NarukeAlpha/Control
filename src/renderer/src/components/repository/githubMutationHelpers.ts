import type { GitHubAction, GitHubMutationFields, GitHubMutationInput } from "@shared/github";

export function createGitHubMutationInput(
  action: GitHubAction,
  owner: string,
  repo: string,
  payload: GitHubMutationFields = {}
): GitHubMutationInput {
  return { action, owner, repo, ...payload } as GitHubMutationInput;
}

export function mutationAffectsAccountIssues(action: GitHubAction): boolean {
  return (
    action === "createIssue" ||
    action === "editIssue" ||
    action === "closeIssue" ||
    action === "reopenIssue" ||
    action === "addComment" ||
    action === "editComment" ||
    action === "deleteComment" ||
    action === "addLabels" ||
    action === "removeLabel" ||
    action === "setAssignees" ||
    action === "removeAssignees" ||
    action === "editRepository"
  );
}

export function mutationAffectsAccountProfile(action: GitHubAction): boolean {
  return action === "star" || action === "unstar" || action === "fork";
}

export function mutationAffectsRepositoryCollections(action: GitHubAction): boolean {
  return (
    action === "star" ||
    action === "unstar" ||
    action === "watch" ||
    action === "unwatch" ||
    action === "fork" ||
    action === "editRepository" ||
    action === "createIssue" ||
    action === "closeIssue" ||
    action === "reopenIssue" ||
    action === "createPullRequest" ||
    action === "mergePullRequest" ||
    action === "closePullRequest" ||
    action === "reopenPullRequest" ||
    action === "createRelease" ||
    action === "editRelease" ||
    action === "deleteRelease" ||
    action === "deleteReleaseAsset" ||
    action === "createDiscussion" ||
    action === "editDiscussion" ||
    action === "closeDiscussion" ||
    action === "reopenDiscussion" ||
    action === "addDiscussionComment" ||
    action === "editDiscussionComment" ||
    action === "deleteDiscussionComment" ||
    action === "createProjectV2" ||
    action === "updateProjectV2" ||
    action === "deleteProjectV2" ||
    action === "addProjectV2Item" ||
    action === "updateProjectV2Item" ||
    action === "deleteProjectV2Item" ||
    action === "rerunWorkflow" ||
    action === "rerunFailedWorkflowJobs" ||
    action === "rerunWorkflowJob" ||
    action === "dispatchWorkflow" ||
    action === "cancelWorkflow"
  );
}

export function mutationAffectsAccountPulls(action: GitHubAction): boolean {
  return (
    action === "createPullRequest" ||
    action === "mergePullRequest" ||
    action === "closePullRequest" ||
    action === "reopenPullRequest" ||
    action === "approvePullRequest" ||
    action === "commentPullRequestReview" ||
    action === "requestChanges" ||
    action === "requestReviewers" ||
    action === "removeReviewers" ||
    action === "editReviewComment" ||
    action === "deleteReviewComment" ||
    action === "editIssue" ||
    action === "addComment" ||
    action === "editComment" ||
    action === "deleteComment" ||
    action === "addLabels" ||
    action === "removeLabel" ||
    action === "setAssignees" ||
    action === "removeAssignees" ||
    action === "editRepository"
  );
}
