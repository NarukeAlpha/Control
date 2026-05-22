import {
  githubActions,
  type GitHubAction,
  GitHubMutationInput,
  GitHubMutationResult,
  RepoListInput,
  RepositoryListResult
} from "@shared/github";
import { githubIpcRouteChannels } from "@shared/ipc";

import {
  createIpcInvokeRoute,
  registerIpcRoutes,
  type IpcInvokeRoute,
  type IpcMainHandleTarget
} from "./ipcRouter";

interface GitHubIpcDependencies {
  listRepositoriesWithStatus(input: RepoListInput): Promise<RepositoryListResult>;
  mutate(input: GitHubMutationInput): Promise<GitHubMutationResult>;
}

export const registeredGithubIpcRouteKeys = ["listRepositoriesWithStatus", "mutate"] as const;

const githubActionSet = new Set<string>(githubActions);
const maxMutationPayloadBytes = 128_000;
const workflowMutationActions = new Set<GitHubAction>([
  "rerunWorkflow",
  "rerunFailedWorkflowJobs",
  "rerunWorkflowJob",
  "dispatchWorkflow",
  "cancelWorkflow"
]);
const issueMutationActions = new Set<GitHubAction>([
  "createIssue",
  "editIssue",
  "closeIssue",
  "reopenIssue",
  "addComment",
  "editComment",
  "deleteComment",
  "addLabels",
  "removeLabel",
  "setAssignees",
  "removeAssignees"
]);
const pullRequestMutationActions = new Set<GitHubAction>([
  "createPullRequest",
  "mergePullRequest",
  "closePullRequest",
  "reopenPullRequest",
  "approvePullRequest",
  "commentPullRequestReview",
  "requestChanges",
  "requestReviewers",
  "removeReviewers",
  "editReviewComment",
  "deleteReviewComment"
]);
const releaseMutationActions = new Set<GitHubAction>([
  "createRelease",
  "editRelease",
  "deleteRelease",
  "deleteReleaseAsset"
]);
const repositoryAdministrationMutationActions = new Set<GitHubAction>([
  "updateBranchProtection",
  "deleteBranchProtection",
  "addRepositoryCollaborator",
  "removeRepositoryCollaborator",
  "updateCollaboratorPermission",
  "addRepositoryTeam",
  "removeRepositoryTeam",
  "updateTeamPermission",
  "createRepositoryRuleset",
  "updateRepositoryRuleset",
  "deleteRepositoryRuleset"
]);
const discussionMutationActions = new Set<GitHubAction>([
  "createDiscussion",
  "editDiscussion",
  "closeDiscussion",
  "reopenDiscussion",
  "addDiscussionComment",
  "editDiscussionComment",
  "deleteDiscussionComment"
]);
const projectMutationActions = new Set<GitHubAction>([
  "createProjectV2",
  "updateProjectV2",
  "deleteProjectV2",
  "addProjectV2Item",
  "updateProjectV2Item",
  "deleteProjectV2Item"
]);
const wikiMutationActions = new Set<GitHubAction>(["createWikiPage", "editWikiPage", "deleteWikiPage"]);

export function registerGithubIpc(ipcMain: IpcMainHandleTarget, github: GitHubIpcDependencies): void {
  registerIpcRoutes(ipcMain, createGithubIpcRoutes(github));
}

export function createGithubIpcRoutes(github: GitHubIpcDependencies): IpcInvokeRoute[] {
  return [
    createIpcInvokeRoute<RepoListInput, RepositoryListResult>({
      channel: githubIpcRouteChannels.listRepositoriesWithStatus,
      parse: ([input]) => requireRepoListInput(input),
      handle: (input) => github.listRepositoriesWithStatus(input)
    }),
    createIpcInvokeRoute<GitHubMutationInput, GitHubMutationResult>({
      channel: githubIpcRouteChannels.mutate,
      parse: ([input]) => requireGitHubMutationInput(input),
      handle: (input) => github.mutate(input)
    })
  ];
}

export function requireRepoListInput(input: unknown = {}): RepoListInput {
  if (input === undefined) {
    return {};
  }
  if (!isRecord(input)) {
    throw new Error("Repository list input must be an object.");
  }

  return {
    limit: optionalInteger(input.limit, "Repository list limit must be a positive integer."),
    cacheOnly: optionalBoolean(input.cacheOnly, "Repository list cacheOnly must be a boolean."),
    forceRefresh: optionalBoolean(input.forceRefresh, "Repository list forceRefresh must be a boolean.")
  };
}

export function requireGitHubMutationInput(input: unknown): GitHubMutationInput {
  if (!isRecord(input)) {
    throw new Error("GitHub mutation input must be an object.");
  }

  const action = requireTrimmedString(input.action, "GitHub mutation action is required.");
  if (!githubActionSet.has(action)) {
    throw new Error("Unsupported GitHub mutation action.");
  }
  const owner = requireTrimmedString(input.owner, "GitHub mutation owner is required.");
  const repo = requireTrimmedString(input.repo, "GitHub mutation repository is required.");
  const { action: _action, owner: _owner, repo: _repo, payload: legacyPayload, ...flatPayload } = input;
  if (legacyPayload !== undefined && !isRecord(legacyPayload)) {
    throw new Error("GitHub mutation payload must be an object when provided.");
  }
  const payload = {
    ...flatPayload,
    ...(legacyPayload ?? {})
  };
  const payloadBytes = JSON.stringify(payload).length;
  if (payloadBytes > maxMutationPayloadBytes) {
    throw new Error("GitHub mutation payload is too large.");
  }

  const normalized = {
    ...payload,
    action: action as GitHubAction,
    owner,
    repo
  };
  validateGitHubMutationPayload(normalized, legacyPayload !== undefined);

  return normalized as GitHubMutationInput;
}

function validateGitHubMutationPayload(
  input: Record<string, unknown> & { action: GitHubAction },
  usedLegacyPayload: boolean
): void {
  if (usedLegacyPayload) {
    throw new Error("GitHub mutation fields must be top-level.");
  }

  if (workflowMutationActions.has(input.action)) {
    validateWorkflowMutationPayload(input);
    return;
  }
  if (issueMutationActions.has(input.action)) {
    validateIssueMutationPayload(input);
    return;
  }
  if (pullRequestMutationActions.has(input.action)) {
    validatePullRequestMutationPayload(input);
    return;
  }
  if (releaseMutationActions.has(input.action)) {
    validateReleaseMutationPayload(input);
    return;
  }
  if (repositoryAdministrationMutationActions.has(input.action)) {
    validateRepositoryAdministrationMutationPayload(input);
    return;
  }
  if (discussionMutationActions.has(input.action)) {
    validateDiscussionMutationPayload(input);
    return;
  }
  if (projectMutationActions.has(input.action)) {
    validateProjectMutationPayload(input);
    return;
  }
  if (wikiMutationActions.has(input.action)) {
    validateWikiMutationPayload(input);
    return;
  }

  validateRepositoryMutationPayload(input);
}

function validateRepositoryMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  if (
    input.action === "star" ||
    input.action === "unstar" ||
    input.action === "watch" ||
    input.action === "unwatch" ||
    input.action === "fork"
  ) {
    return;
  }

  if (input.action === "editRepository") {
    optionalNullableString(input, "description", "Repository description must be a string or null.");
    optionalNullableString(input, "homepage", "Repository homepage must be a string or null.");
    optionalNullableString(input, "default_branch", "Default branch must be a string or null.");
    optionalBoolean(input.archived, "Repository archived flag must be a boolean.");
    optionalBoolean(input.has_issues, "Repository issues flag must be a boolean.");
    optionalBoolean(input.has_projects, "Repository projects flag must be a boolean.");
    optionalBoolean(input.has_wiki, "Repository wiki flag must be a boolean.");
    optionalBoolean(input.has_discussions, "Repository discussions flag must be a boolean.");
    optionalBoolean(input.allow_merge_commit, "Repository merge-commit flag must be a boolean.");
    optionalBoolean(input.allow_squash_merge, "Repository squash-merge flag must be a boolean.");
    optionalBoolean(input.allow_rebase_merge, "Repository rebase-merge flag must be a boolean.");
    optionalBoolean(input.allow_auto_merge, "Repository auto-merge flag must be a boolean.");
    optionalBoolean(input.delete_branch_on_merge, "Repository branch-delete flag must be a boolean.");
    optionalBoolean(input.allow_update_branch, "Repository update-branch flag must be a boolean.");
    optionalBoolean(input.allow_forking, "Repository forking flag must be a boolean.");
    optionalBoolean(input.web_commit_signoff_required, "Repository commit-signoff flag must be a boolean.");
    optionalStringArray(input, "topics", "Repository topics must be an array of strings.");
  }
}

function validateIssueMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  switch (input.action) {
    case "createIssue":
      requireStringField(input, "title", "Issue creation requires a title.");
      optionalStringField(input, "body", "Issue body must be a string.");
      optionalStringArray(input, "labels", "Issue labels must be an array of strings.");
      optionalStringArray(input, "assignees", "Issue assignees must be an array of strings.");
      optionalNullablePositiveInteger(
        input,
        "milestone",
        "Issue milestone must be a positive integer or null."
      );
      return;
    case "editIssue":
      requirePositiveIntegerField(
        input,
        "issueNumber",
        "Issue mutation issueNumber must be a positive integer."
      );
      optionalNonEmptyString(input, "title", "Issue title must be a non-empty string.");
      optionalStringField(input, "body", "Issue body must be a string.");
      optionalStringArray(input, "labels", "Issue labels must be an array of strings.");
      optionalStringArray(input, "assignees", "Issue assignees must be an array of strings.");
      optionalNullablePositiveInteger(
        input,
        "milestone",
        "Issue milestone must be a positive integer or null."
      );
      optionalNonEmptyString(input, "state", "Issue state must be a non-empty string.");
      return;
    case "closeIssue":
      requirePositiveIntegerField(
        input,
        "issueNumber",
        "Issue mutation issueNumber must be a positive integer."
      );
      optionalNonEmptyString(input, "stateReason", "Issue state reason must be a non-empty string.");
      return;
    case "reopenIssue":
      requirePositiveIntegerField(
        input,
        "issueNumber",
        "Issue mutation issueNumber must be a positive integer."
      );
      return;
    case "addComment":
      requirePositiveIntegerField(input, "issueNumber", "Issue comment requires an issue number.");
      requireStringField(input, "body", "Issue comment requires a body.", { allowEmpty: true });
      return;
    case "editComment":
      requireNumericIdField(input, "commentId", "Issue comment mutation requires a comment id.");
      requireStringField(input, "body", "Issue comment requires a body.", { allowEmpty: true });
      return;
    case "deleteComment":
      requireNumericIdField(input, "commentId", "Issue comment mutation requires a comment id.");
      return;
    case "addLabels":
      requirePositiveIntegerField(input, "issueNumber", "Issue label mutation requires an issue number.");
      requireStringArray(input, "labels", "Issue label mutation requires labels.");
      return;
    case "removeLabel":
      requirePositiveIntegerField(input, "issueNumber", "Issue label mutation requires an issue number.");
      requireStringField(input, "name", "Issue label mutation requires a label name.");
      return;
    case "setAssignees":
    case "removeAssignees":
      requirePositiveIntegerField(input, "issueNumber", "Issue assignee mutation requires an issue number.");
      requireStringArray(input, "assignees", "Issue assignee mutation requires assignees.");
      return;
    default:
      return;
  }
}

function validatePullRequestMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  switch (input.action) {
    case "createPullRequest":
      requireStringField(input, "title", "Pull request creation requires a title.");
      requireStringField(input, "head", "Pull request creation requires a head branch.");
      requireStringField(input, "base", "Pull request creation requires a base branch.");
      optionalStringField(input, "body", "Pull request body must be a string.");
      optionalBoolean(input.draft, "Pull request draft flag must be a boolean.");
      optionalBoolean(
        input.maintainer_can_modify,
        "Pull request maintainer_can_modify flag must be a boolean."
      );
      return;
    case "mergePullRequest":
      requirePositiveIntegerField(
        input,
        "pullNumber",
        "Pull request mutation pullNumber must be a positive integer."
      );
      optionalStringField(input, "commit_title", "Pull request merge title must be a string.");
      optionalStringField(input, "commit_message", "Pull request merge message must be a string.");
      optionalNonEmptyString(input, "merge_method", "Pull request merge method must be a non-empty string.");
      optionalNonEmptyString(input, "sha", "Pull request merge sha must be a non-empty string.");
      return;
    case "closePullRequest":
    case "reopenPullRequest":
      requirePositiveIntegerField(
        input,
        "pullNumber",
        "Pull request mutation pullNumber must be a positive integer."
      );
      return;
    case "approvePullRequest":
    case "commentPullRequestReview":
    case "requestChanges":
      requirePositiveIntegerField(
        input,
        "pullNumber",
        "Pull request review mutation requires a pull number."
      );
      optionalStringField(input, "body", "Pull request review body must be a string.");
      return;
    case "requestReviewers":
    case "removeReviewers":
      requirePositiveIntegerField(
        input,
        "pullNumber",
        "Pull request reviewer mutation requires a pull number."
      );
      optionalStringArray(input, "reviewers", "Pull request reviewers must be an array of strings.");
      optionalStringArray(input, "teamReviewers", "Pull request team reviewers must be an array of strings.");
      return;
    case "editReviewComment":
      requireNumericIdField(input, "commentId", "Review comment mutation requires a comment id.");
      requireStringField(input, "body", "Review comment mutation requires a body.", { allowEmpty: true });
      return;
    case "deleteReviewComment":
      requireNumericIdField(input, "commentId", "Review comment mutation requires a comment id.");
      return;
    default:
      return;
  }
}

function validateWorkflowMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  if (
    input.action === "rerunWorkflow" ||
    input.action === "rerunFailedWorkflowJobs" ||
    input.action === "cancelWorkflow"
  ) {
    requirePositiveIntegerField(input, "runId", "Workflow mutation runId must be a positive integer.");
    return;
  }

  if (input.action === "rerunWorkflowJob") {
    requirePositiveIntegerField(input, "jobId", "Workflow mutation jobId must be a positive integer.");
    return;
  }

  if (input.action === "dispatchWorkflow") {
    requireStringField(input, "workflowId", "Workflow dispatch requires a workflow id.");
    requireStringField(input, "ref", "Workflow dispatch requires a ref.");
    if (input.inputs !== undefined && !isJsonObject(input.inputs)) {
      throw new Error("Workflow dispatch inputs must be a JSON object.");
    }
  }
}

function validateReleaseMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  switch (input.action) {
    case "createRelease":
      requireStringField(input, "tag_name", "Release creation requires a tag name.");
      optionalStringField(input, "target_commitish", "Release target must be a string.");
      optionalNullableString(input, "name", "Release name must be a string or null.");
      optionalStringField(input, "body", "Release body must be a string.");
      optionalBoolean(input.draft, "Release draft flag must be a boolean.");
      optionalBoolean(input.prerelease, "Release prerelease flag must be a boolean.");
      optionalNonEmptyString(input, "make_latest", "Release make_latest must be a non-empty string.");
      return;
    case "editRelease":
      requirePositiveIntegerField(
        input,
        "releaseId",
        "Release mutation releaseId must be a positive integer."
      );
      optionalNonEmptyString(input, "tag_name", "Release tag name must be a non-empty string.");
      optionalStringField(input, "target_commitish", "Release target must be a string.");
      optionalNullableString(input, "name", "Release name must be a string or null.");
      optionalStringField(input, "body", "Release body must be a string.");
      optionalBoolean(input.draft, "Release draft flag must be a boolean.");
      optionalBoolean(input.prerelease, "Release prerelease flag must be a boolean.");
      optionalNonEmptyString(input, "make_latest", "Release make_latest must be a non-empty string.");
      return;
    case "deleteRelease":
      requirePositiveIntegerField(
        input,
        "releaseId",
        "Release mutation releaseId must be a positive integer."
      );
      return;
    case "deleteReleaseAsset":
      requirePositiveIntegerField(
        input,
        "assetId",
        "Release asset mutation assetId must be a positive integer."
      );
      return;
    default:
      return;
  }
}

function validateRepositoryAdministrationMutationPayload(
  input: Record<string, unknown> & { action: GitHubAction }
): void {
  switch (input.action) {
    case "updateBranchProtection":
      requireStringField(input, "branch", "Branch protection mutation requires a branch.");
      optionalJsonValue(input, "required_status_checks", "Required status checks must be JSON-safe.");
      optionalNullableBoolean(input.enforce_admins, "Enforce admins must be a boolean or null.");
      optionalJsonValue(
        input,
        "required_pull_request_reviews",
        "Required pull request reviews must be JSON-safe."
      );
      optionalJsonValue(input, "restrictions", "Branch protection restrictions must be JSON-safe.");
      optionalBoolean(input.required_linear_history, "Required linear history must be a boolean.");
      optionalBoolean(input.allow_force_pushes, "Allow force pushes must be a boolean.");
      optionalBoolean(input.allow_deletions, "Allow deletions must be a boolean.");
      optionalBoolean(input.block_creations, "Block creations must be a boolean.");
      optionalBoolean(
        input.required_conversation_resolution,
        "Required conversation resolution must be a boolean."
      );
      optionalBoolean(input.lock_branch, "Lock branch must be a boolean.");
      optionalBoolean(input.allow_fork_syncing, "Allow fork syncing must be a boolean.");
      return;
    case "deleteBranchProtection":
      requireStringField(input, "branch", "Branch protection mutation requires a branch.");
      return;
    case "addRepositoryCollaborator":
      requireStringField(input, "username", "Repository collaborator mutation requires a username.");
      optionalNonEmptyString(
        input,
        "permission",
        "Repository collaborator permission must be a non-empty string."
      );
      return;
    case "removeRepositoryCollaborator":
      requireStringField(input, "username", "Repository collaborator mutation requires a username.");
      return;
    case "updateCollaboratorPermission":
      requireStringField(input, "username", "Repository collaborator mutation requires a username.");
      requireStringField(input, "permission", "Repository collaborator permission is required.");
      return;
    case "addRepositoryTeam":
      requireStringField(input, "teamSlug", "Repository team mutation requires a team slug.");
      optionalNonEmptyString(input, "permission", "Repository team permission must be a non-empty string.");
      return;
    case "removeRepositoryTeam":
      requireStringField(input, "teamSlug", "Repository team mutation requires a team slug.");
      return;
    case "updateTeamPermission":
      requireStringField(input, "teamSlug", "Repository team mutation requires a team slug.");
      requireStringField(input, "permission", "Repository team permission is required.");
      return;
    case "createRepositoryRuleset":
      requireStringField(input, "name", "Repository ruleset mutation requires a name.");
      requireStringField(input, "enforcement", "Repository ruleset mutation requires enforcement.");
      optionalNonEmptyString(input, "target", "Repository ruleset target must be a non-empty string.");
      optionalJsonArray(input, "bypass_actors", "Repository ruleset bypass actors must be JSON-safe.");
      optionalJsonObjectField(input, "conditions", "Repository ruleset conditions must be a JSON object.");
      optionalJsonArray(input, "rules", "Repository ruleset rules must be JSON-safe.");
      return;
    case "updateRepositoryRuleset":
      requirePositiveIntegerField(input, "rulesetId", "Repository ruleset mutation requires a ruleset id.");
      requireStringField(input, "name", "Repository ruleset mutation requires a name.");
      requireStringField(input, "enforcement", "Repository ruleset mutation requires enforcement.");
      optionalNonEmptyString(input, "target", "Repository ruleset target must be a non-empty string.");
      optionalJsonArray(input, "bypass_actors", "Repository ruleset bypass actors must be JSON-safe.");
      optionalJsonObjectField(input, "conditions", "Repository ruleset conditions must be a JSON object.");
      optionalJsonArray(input, "rules", "Repository ruleset rules must be JSON-safe.");
      return;
    case "deleteRepositoryRuleset":
      requirePositiveIntegerField(input, "rulesetId", "Repository ruleset mutation requires a ruleset id.");
      return;
    default:
      return;
  }
}

function validateDiscussionMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  switch (input.action) {
    case "createDiscussion":
      requireStringField(input, "categoryId", "Discussion creation requires a category id.");
      requireStringField(input, "title", "Discussion creation requires a title.");
      requireStringField(input, "body", "Discussion creation requires a body.");
      return;
    case "editDiscussion":
      requireStringField(input, "discussionId", "Discussion mutation requires a discussion id.");
      requireStringField(input, "title", "Discussion mutation requires a title.");
      requireStringField(input, "body", "Discussion mutation requires a body.");
      return;
    case "closeDiscussion":
    case "reopenDiscussion":
      requireStringField(input, "discussionId", "Discussion mutation requires a discussion id.");
      return;
    case "addDiscussionComment":
      requireStringField(input, "discussionId", "Discussion comment requires a discussion id.");
      requireStringField(input, "body", "Discussion comment requires a body.");
      return;
    case "editDiscussionComment":
      requireStringField(input, "commentId", "Discussion comment mutation requires a comment id.");
      requireStringField(input, "body", "Discussion comment mutation requires a body.");
      return;
    case "deleteDiscussionComment":
      requireStringField(input, "commentId", "Discussion comment mutation requires a comment id.");
      return;
    default:
      return;
  }
}

function validateProjectMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  switch (input.action) {
    case "createProjectV2":
      requireStringField(input, "title", "Project creation requires a title.");
      return;
    case "updateProjectV2":
      requireStringField(input, "projectId", "Project mutation requires a project id.");
      requireStringField(input, "title", "Project mutation requires a title.");
      optionalNullableString(
        input,
        "shortDescription",
        "Project short description must be a string or null."
      );
      optionalNullableString(input, "readme", "Project README must be a string or null.");
      return;
    case "deleteProjectV2":
      requireStringField(input, "projectId", "Project mutation requires a project id.");
      return;
    case "addProjectV2Item":
      requireStringField(input, "projectId", "Project item mutation requires a project id.");
      requireStringField(input, "contentId", "Project item mutation requires a content id.");
      return;
    case "updateProjectV2Item":
      requireStringField(input, "projectId", "Project item mutation requires a project id.");
      requireStringField(input, "itemId", "Project item mutation requires an item id.");
      requireStringField(input, "fieldId", "Project item mutation requires a field id.");
      requireJsonValueField(input, "value", "Project item value must be JSON-safe.");
      return;
    case "deleteProjectV2Item":
      requireStringField(input, "projectId", "Project item mutation requires a project id.");
      requireStringField(input, "itemId", "Project item mutation requires an item id.");
      return;
    default:
      return;
  }
}

function validateWikiMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  switch (input.action) {
    case "createWikiPage":
      requireStringField(input, "title", "Wiki page creation requires a title.");
      requireStringField(input, "content", "Wiki page creation requires content.", { allowEmpty: true });
      return;
    case "editWikiPage":
      requireStringField(input, "pagePath", "Wiki page mutation requires a page path.");
      requireStringField(input, "content", "Wiki page mutation requires content.", { allowEmpty: true });
      return;
    case "deleteWikiPage":
      requireStringField(input, "pagePath", "Wiki page mutation requires a page path.");
      return;
    default:
      return;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireTrimmedString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

function requirePositiveInteger(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
  return value;
}

function requireStringField(
  input: Record<string, unknown>,
  key: string,
  message: string,
  options: { allowEmpty?: boolean } = {}
): string {
  const value = input[key];
  if (typeof value !== "string") {
    throw new Error(message);
  }
  if (!options.allowEmpty && !value.trim()) {
    throw new Error(message);
  }
  const normalized = options.allowEmpty ? value : value.trim();
  input[key] = normalized;
  return normalized;
}

function optionalStringField(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined) {
    return;
  }
  if (typeof input[key] !== "string") {
    throw new Error(message);
  }
}

function optionalNonEmptyString(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined) {
    return;
  }
  requireStringField(input, key, message);
}

function optionalNullableString(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined || input[key] === null) {
    return;
  }
  if (typeof input[key] !== "string") {
    throw new Error(message);
  }
}

function requirePositiveIntegerField(input: Record<string, unknown>, key: string, message: string): number {
  const value = requirePositiveInteger(input[key], message);
  input[key] = value;
  return value;
}

function requireNumericIdField(input: Record<string, unknown>, key: string, message: string): number {
  const value = input[key];
  if (typeof value === "number") {
    return requirePositiveIntegerField(input, key, message);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const normalized = Number(value.trim());
    if (Number.isSafeInteger(normalized) && normalized > 0) {
      input[key] = normalized;
      return normalized;
    }
  }
  throw new Error(message);
}

function optionalNullablePositiveInteger(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined || input[key] === null) {
    return;
  }
  requirePositiveIntegerField(input, key, message);
}

function requireStringArray(input: Record<string, unknown>, key: string, message: string): string[] {
  const value = input[key];
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
  const normalized = value.map((item) => requireTrimmedString(item, message));
  input[key] = normalized;
  return normalized;
}

function optionalStringArray(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined) {
    return;
  }
  requireStringArray(input, key, message);
}

function optionalNullableBoolean(value: unknown, message: string): void {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
}

function requireJsonValueField(input: Record<string, unknown>, key: string, message: string): void {
  if (!isJsonValue(input[key])) {
    throw new Error(message);
  }
}

function optionalJsonValue(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined) {
    return;
  }
  requireJsonValueField(input, key, message);
}

function optionalJsonArray(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined) {
    return;
  }
  const value = input[key];
  if (!Array.isArray(value) || !value.every(isJsonValue)) {
    throw new Error(message);
  }
}

function optionalJsonObjectField(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] === undefined) {
    return;
  }
  if (!isJsonObject(input[key])) {
    throw new Error(message);
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isJsonObject(value);
}

function optionalBoolean(value: unknown, message: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
  return value;
}

function optionalInteger(value: unknown, message: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
  return value;
}
