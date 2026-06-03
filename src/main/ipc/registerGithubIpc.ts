import {
  AccountIssueListInput,
  AccountProfileInput,
  AccountPullRequestListInput,
  AccountRepositoryInput,
  githubActions,
  type GitHubAction,
  ActionsInput,
  AssignableUserListInput,
  BranchListInput,
  BranchProtectionInput,
  CodeScanningAlertsInput,
  ContributorsInput,
  DependabotAlertsInput,
  DiscussionCategoryListInput,
  DiscussionDetailInput,
  DiscussionListInput,
  GitHubMutationInput,
  IssueDetailInput,
  IssueListInput,
  NotificationListInput,
  NotificationThreadInput,
  OrganizationListInput,
  OrganizationMembersInput,
  OrganizationProjectsInput,
  OrganizationRepositoriesInput,
  OrganizationTeamMembersInput,
  OrganizationTeamRepositoriesInput,
  OrganizationTeamsInput,
  ProjectsInput,
  PullRequestChecksInput,
  PullRequestCommentsInput,
  PullRequestCommitsInput,
  PullRequestDetailInput,
  PullRequestDetailReadInput,
  PullRequestFilesInput,
  PullRequestLinkedIssuesInput,
  PullRequestListInput,
  PullRequestOverviewInput,
  PullRequestReviewsInput,
  PullRequestReviewThreadsInput,
  PullRequestTimelineInput,
  ReleaseDetailInput,
  ReleasesInput,
  RepoContentsInput,
  RepoDetailInput,
  RepoFileBlameInput,
  RepoFileContentInput,
  RepoReadmeInput,
  RepoListInput,
  RepositoryAccessInput,
  RepositoryCommitListInput,
  RepositoryCommunityProfileInput,
  RepositoryForksInput,
  RepositoryLabelListInput,
  RepositoryMilestoneListInput,
  RepositoryRulesetsInput,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityPolicyInput,
  RepositoryWikiInput,
  RepoTreeInput,
  SearchInput,
  SecretScanningAlertsInput,
  TagListInput,
  WorkflowJobLogsInput,
  WorkflowListInput,
  WorkflowRunDetailInput
} from "@shared/github";
import { githubIpcRouteChannels } from "@shared/ipc";
import type { GitHubProviderManager } from "../github/provider";

import {
  isJsonObject,
  isRecord,
  optionalBoolean,
  optionalJsonArray as parseOptionalJsonArray,
  optionalJsonObject as parseOptionalJsonObject,
  optionalJsonValue as parseOptionalJsonValue,
  optionalNullableBoolean as parseOptionalNullableBoolean,
  optionalNullableString,
  optionalPositiveInteger,
  optionalString,
  optionalTrimmedString,
  requireJsonValue,
  requirePositiveInteger,
  requireStringArray as parseStringArray,
  requireTrimmedString
} from "./ipcInput";
import { createIpcInvokeRoute, type IpcInvokeRoute } from "./ipcRouter";

type GitHubIpcDependencies = Pick<
  GitHubProviderManager,
  | "getViewer"
  | "getAccountProfileWithStatus"
  | "listRepositoriesWithStatus"
  | "listAccountRepositoriesWithStatus"
  | "listOrganizationsWithStatus"
  | "listOrganizationTeamsWithStatus"
  | "listOrganizationRepositoriesWithStatus"
  | "listOrganizationTeamRepositoriesWithStatus"
  | "listOrganizationTeamMembersWithStatus"
  | "listOrganizationMembersWithStatus"
  | "listOrganizationProjectsWithStatus"
  | "listAccountIssuesWithStatus"
  | "listAccountPullRequestsWithStatus"
  | "listNotificationsWithStatus"
  | "markNotificationThreadRead"
  | "unsubscribeNotificationThread"
  | "getRepositoryWithStatus"
  | "listRepositoryForks"
  | "listBranchesWithStatus"
  | "listTagsWithStatus"
  | "listTreeWithStatus"
  | "getReadme"
  | "listContentsWithStatus"
  | "getFileContentWithStatus"
  | "getFileBlame"
  | "getRepositoryWiki"
  | "listCommitsWithStatus"
  | "listLabelsWithStatus"
  | "listAssignableUsersWithStatus"
  | "getRepositoryAccess"
  | "listMilestonesWithStatus"
  | "listIssuesWithStatus"
  | "getIssueDetailWithStatus"
  | "listPullRequestsWithStatus"
  | "getPullRequestDetailWithStatus"
  | "getPullRequestOverviewWithStatus"
  | "listPullRequestCommentsWithStatus"
  | "listPullRequestFilesWithStatus"
  | "listPullRequestCommitsWithStatus"
  | "listPullRequestReviewsWithStatus"
  | "listPullRequestChecksWithStatus"
  | "listPullRequestReviewThreadsWithStatus"
  | "listPullRequestTimelineWithStatus"
  | "listPullRequestLinkedIssuesWithStatus"
  | "listDiscussionsWithStatus"
  | "listDiscussionCategoriesWithStatus"
  | "getDiscussionDetail"
  | "listActionsWithStatus"
  | "listWorkflowsWithStatus"
  | "getWorkflowRunDetailWithStatus"
  | "getWorkflowJobLogs"
  | "listProjectsWithStatus"
  | "getBranchProtection"
  | "listDependabotAlerts"
  | "listCodeScanningAlerts"
  | "listSecretScanningAlerts"
  | "listRepositoryRulesets"
  | "listRepositorySecurityAdvisories"
  | "getRepositorySecurityPolicy"
  | "getRepositoryCommunityProfile"
  | "listReleasesWithStatus"
  | "getReleaseDetailWithStatus"
  | "listContributorsWithStatus"
  | "searchWithStatus"
  | "mutate"
>;

export const registeredGithubIpcRouteKeys = [
  "getViewer",
  "getAccountProfileWithStatus",
  "listRepositoriesWithStatus",
  "listAccountRepositoriesWithStatus",
  "listOrganizationsWithStatus",
  "listOrganizationTeamsWithStatus",
  "listOrganizationRepositoriesWithStatus",
  "listOrganizationTeamRepositoriesWithStatus",
  "listOrganizationTeamMembersWithStatus",
  "listOrganizationMembersWithStatus",
  "listOrganizationProjectsWithStatus",
  "listAccountIssuesWithStatus",
  "listAccountPullRequestsWithStatus",
  "listNotificationsWithStatus",
  "markNotificationThreadRead",
  "unsubscribeNotificationThread",
  "getRepositoryWithStatus",
  "listRepositoryForks",
  "listBranchesWithStatus",
  "listTagsWithStatus",
  "listTreeWithStatus",
  "getReadme",
  "listContentsWithStatus",
  "getFileContentWithStatus",
  "getFileBlame",
  "getRepositoryWiki",
  "listCommitsWithStatus",
  "listLabelsWithStatus",
  "listAssignableUsersWithStatus",
  "getRepositoryAccess",
  "listMilestonesWithStatus",
  "listIssuesWithStatus",
  "getIssueDetailWithStatus",
  "listPullRequestsWithStatus",
  "getPullRequestDetailWithStatus",
  "getPullRequestOverviewWithStatus",
  "listPullRequestCommentsWithStatus",
  "listPullRequestFilesWithStatus",
  "listPullRequestCommitsWithStatus",
  "listPullRequestReviewsWithStatus",
  "listPullRequestChecksWithStatus",
  "listPullRequestReviewThreadsWithStatus",
  "listPullRequestTimelineWithStatus",
  "listPullRequestLinkedIssuesWithStatus",
  "listDiscussionsWithStatus",
  "listDiscussionCategoriesWithStatus",
  "getDiscussionDetail",
  "listActionsWithStatus",
  "listWorkflowsWithStatus",
  "getWorkflowRunDetailWithStatus",
  "getWorkflowJobLogs",
  "listProjectsWithStatus",
  "getBranchProtection",
  "listDependabotAlerts",
  "listCodeScanningAlerts",
  "listSecretScanningAlerts",
  "listRepositoryRulesets",
  "listRepositorySecurityAdvisories",
  "getRepositorySecurityPolicy",
  "getRepositoryCommunityProfile",
  "listReleasesWithStatus",
  "getReleaseDetailWithStatus",
  "listContributorsWithStatus",
  "searchWithStatus",
  "mutate"
] as const;

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

export function createGithubIpcRoutes(github: GitHubIpcDependencies): IpcInvokeRoute[] {
  return [
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getViewer,
      parse: () => undefined,
      handle: () => github.getViewer()
    }),
    createIpcInvokeRoute<
      AccountProfileInput,
      ReturnType<GitHubIpcDependencies["getAccountProfileWithStatus"]>
    >({
      channel: githubIpcRouteChannels.getAccountProfileWithStatus,
      parse: ([input]) => requireOptionalReadInput<AccountProfileInput>(input),
      handle: (input) => github.getAccountProfileWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listRepositoriesWithStatus,
      parse: ([input]) => requireRepoListInput(input),
      handle: (input) => github.listRepositoriesWithStatus(input)
    }),
    createIpcInvokeRoute<
      AccountRepositoryInput,
      ReturnType<GitHubIpcDependencies["listAccountRepositoriesWithStatus"]>
    >({
      channel: githubIpcRouteChannels.listAccountRepositoriesWithStatus,
      parse: ([input]) => requireOptionalReadInput<AccountRepositoryInput>(input),
      handle: (input) => github.listAccountRepositoriesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listOrganizationsWithStatus,
      parse: ([input]) => requireOrganizationListInput(input),
      handle: (input) => github.listOrganizationsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listOrganizationTeamsWithStatus,
      parse: ([input]) => requireOrganizationInput<OrganizationTeamsInput>(input),
      handle: (input) => github.listOrganizationTeamsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listOrganizationRepositoriesWithStatus,
      parse: ([input]) => requireOrganizationInput<OrganizationRepositoriesInput>(input),
      handle: (input) => github.listOrganizationRepositoriesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listOrganizationTeamRepositoriesWithStatus,
      parse: ([input]) => requireOrganizationTeamInput<OrganizationTeamRepositoriesInput>(input),
      handle: (input) => github.listOrganizationTeamRepositoriesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listOrganizationTeamMembersWithStatus,
      parse: ([input]) => requireOrganizationTeamInput<OrganizationTeamMembersInput>(input),
      handle: (input) => github.listOrganizationTeamMembersWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listOrganizationMembersWithStatus,
      parse: ([input]) => requireOrganizationInput<OrganizationMembersInput>(input),
      handle: (input) => github.listOrganizationMembersWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listOrganizationProjectsWithStatus,
      parse: ([input]) => requireOrganizationInput<OrganizationProjectsInput>(input),
      handle: (input) => github.listOrganizationProjectsWithStatus(input)
    }),
    createIpcInvokeRoute<
      AccountIssueListInput,
      ReturnType<GitHubIpcDependencies["listAccountIssuesWithStatus"]>
    >({
      channel: githubIpcRouteChannels.listAccountIssuesWithStatus,
      parse: ([input]) => requireOptionalReadInput<AccountIssueListInput>(input),
      handle: (input) => github.listAccountIssuesWithStatus(input)
    }),
    createIpcInvokeRoute<
      AccountPullRequestListInput,
      ReturnType<GitHubIpcDependencies["listAccountPullRequestsWithStatus"]>
    >({
      channel: githubIpcRouteChannels.listAccountPullRequestsWithStatus,
      parse: ([input]) => requireOptionalReadInput<AccountPullRequestListInput>(input),
      handle: (input) => github.listAccountPullRequestsWithStatus(input)
    }),
    createIpcInvokeRoute<
      NotificationListInput,
      ReturnType<GitHubIpcDependencies["listNotificationsWithStatus"]>
    >({
      channel: githubIpcRouteChannels.listNotificationsWithStatus,
      parse: ([input]) => requireOptionalReadInput<NotificationListInput>(input),
      handle: (input) => github.listNotificationsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.markNotificationThreadRead,
      parse: ([input]) => requireNotificationThreadInput(input),
      handle: (input) => github.markNotificationThreadRead(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.unsubscribeNotificationThread,
      parse: ([input]) => requireNotificationThreadInput(input),
      handle: (input) => github.unsubscribeNotificationThread(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getRepositoryWithStatus,
      parse: ([input]) => requireRepositoryInput<RepoDetailInput>(input),
      handle: (input) => github.getRepositoryWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listRepositoryForks,
      parse: ([input]) => requireRepositoryInput<RepositoryForksInput>(input),
      handle: (input) => github.listRepositoryForks(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listBranchesWithStatus,
      parse: ([input]) => requireRepositoryInput<BranchListInput>(input),
      handle: (input) => github.listBranchesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listTagsWithStatus,
      parse: ([input]) => requireRepositoryInput<TagListInput>(input),
      handle: (input) => github.listTagsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listTreeWithStatus,
      parse: ([input]) => requireRepositoryInput<RepoTreeInput>(input),
      handle: (input) => github.listTreeWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getReadme,
      parse: ([input]) => requireRepositoryInput<RepoReadmeInput>(input),
      handle: (input) => github.getReadme(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listContentsWithStatus,
      parse: ([input]) => requireRepositoryInput<RepoContentsInput>(input),
      handle: (input) => github.listContentsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getFileContentWithStatus,
      parse: ([input]) => requireFileContentInput(input),
      handle: (input) => github.getFileContentWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getFileBlame,
      parse: ([input]) => requireFileBlameInput(input),
      handle: (input) => github.getFileBlame(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getRepositoryWiki,
      parse: ([input]) => requireRepositoryInput<RepositoryWikiInput>(input),
      handle: (input) => github.getRepositoryWiki(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listCommitsWithStatus,
      parse: ([input]) => requireRepositoryInput<RepositoryCommitListInput>(input),
      handle: (input) => github.listCommitsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listLabelsWithStatus,
      parse: ([input]) => requireRepositoryInput<RepositoryLabelListInput>(input),
      handle: (input) => github.listLabelsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listAssignableUsersWithStatus,
      parse: ([input]) => requireRepositoryInput<AssignableUserListInput>(input),
      handle: (input) => github.listAssignableUsersWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getRepositoryAccess,
      parse: ([input]) => requireRepositoryInput<RepositoryAccessInput>(input),
      handle: (input) => github.getRepositoryAccess(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listMilestonesWithStatus,
      parse: ([input]) => requireRepositoryInput<RepositoryMilestoneListInput>(input),
      handle: (input) => github.listMilestonesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listIssuesWithStatus,
      parse: ([input]) => requireRepositoryInput<IssueListInput>(input),
      handle: (input) => github.listIssuesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getIssueDetailWithStatus,
      parse: ([input]) => requireIssueDetailInput(input),
      handle: (input) => github.getIssueDetailWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestsWithStatus,
      parse: ([input]) => requireRepositoryInput<PullRequestListInput>(input),
      handle: (input) => github.listPullRequestsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getPullRequestDetailWithStatus,
      parse: ([input]) => requirePullRequestDetailInput(input),
      handle: (input: PullRequestDetailInput) => github.getPullRequestDetailWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getPullRequestOverviewWithStatus,
      parse: ([input]) => requirePullRequestDetailInput(input),
      handle: (input: PullRequestOverviewInput) => github.getPullRequestOverviewWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestCommentsWithStatus,
      parse: ([input]) => requirePullRequestPageInput(input),
      handle: (input: PullRequestCommentsInput) => github.listPullRequestCommentsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestFilesWithStatus,
      parse: ([input]) => requirePullRequestPageInput(input),
      handle: (input: PullRequestFilesInput) => github.listPullRequestFilesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestCommitsWithStatus,
      parse: ([input]) => requirePullRequestPageInput(input),
      handle: (input: PullRequestCommitsInput) => github.listPullRequestCommitsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestReviewsWithStatus,
      parse: ([input]) => requirePullRequestPageInput(input),
      handle: (input: PullRequestReviewsInput) => github.listPullRequestReviewsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestChecksWithStatus,
      parse: ([input]) => requirePullRequestDetailInput(input),
      handle: (input: PullRequestChecksInput) => github.listPullRequestChecksWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestReviewThreadsWithStatus,
      parse: ([input]) => requirePullRequestPageInput(input),
      handle: (input: PullRequestReviewThreadsInput) => github.listPullRequestReviewThreadsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestTimelineWithStatus,
      parse: ([input]) => requirePullRequestPageInput(input),
      handle: (input: PullRequestTimelineInput) => github.listPullRequestTimelineWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listPullRequestLinkedIssuesWithStatus,
      parse: ([input]) => requirePullRequestDetailInput(input),
      handle: (input: PullRequestLinkedIssuesInput) => github.listPullRequestLinkedIssuesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listDiscussionsWithStatus,
      parse: ([input]) => requireRepositoryInput<DiscussionListInput>(input),
      handle: (input) => github.listDiscussionsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listDiscussionCategoriesWithStatus,
      parse: ([input]) => requireRepositoryInput<DiscussionCategoryListInput>(input),
      handle: (input) => github.listDiscussionCategoriesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getDiscussionDetail,
      parse: ([input]) => requireDiscussionDetailInput(input),
      handle: (input) => github.getDiscussionDetail(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listActionsWithStatus,
      parse: ([input]) => requireRepositoryInput<ActionsInput>(input),
      handle: (input) => github.listActionsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listWorkflowsWithStatus,
      parse: ([input]) => requireRepositoryInput<WorkflowListInput>(input),
      handle: (input) => github.listWorkflowsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getWorkflowRunDetailWithStatus,
      parse: ([input]) => requireWorkflowRunDetailInput(input),
      handle: (input) => github.getWorkflowRunDetailWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getWorkflowJobLogs,
      parse: ([input]) => requireWorkflowJobLogsInput(input),
      handle: (input) => github.getWorkflowJobLogs(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listProjectsWithStatus,
      parse: ([input]) => requireRepositoryInput<ProjectsInput>(input),
      handle: (input) => github.listProjectsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getBranchProtection,
      parse: ([input]) => requireBranchProtectionInput(input),
      handle: (input) => github.getBranchProtection(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listDependabotAlerts,
      parse: ([input]) => requireRepositoryInput<DependabotAlertsInput>(input),
      handle: (input) => github.listDependabotAlerts(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listCodeScanningAlerts,
      parse: ([input]) => requireRepositoryInput<CodeScanningAlertsInput>(input),
      handle: (input) => github.listCodeScanningAlerts(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listSecretScanningAlerts,
      parse: ([input]) => requireRepositoryInput<SecretScanningAlertsInput>(input),
      handle: (input) => github.listSecretScanningAlerts(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listRepositoryRulesets,
      parse: ([input]) => requireRepositoryInput<RepositoryRulesetsInput>(input),
      handle: (input) => github.listRepositoryRulesets(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listRepositorySecurityAdvisories,
      parse: ([input]) => requireRepositoryInput<RepositorySecurityAdvisoriesInput>(input),
      handle: (input) => github.listRepositorySecurityAdvisories(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getRepositorySecurityPolicy,
      parse: ([input]) => requireRepositoryInput<RepositorySecurityPolicyInput>(input),
      handle: (input) => github.getRepositorySecurityPolicy(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getRepositoryCommunityProfile,
      parse: ([input]) => requireRepositoryInput<RepositoryCommunityProfileInput>(input),
      handle: (input) => github.getRepositoryCommunityProfile(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listReleasesWithStatus,
      parse: ([input]) => requireRepositoryInput<ReleasesInput>(input),
      handle: (input) => github.listReleasesWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.getReleaseDetailWithStatus,
      parse: ([input]) => requireReleaseDetailInput(input),
      handle: (input) => github.getReleaseDetailWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.listContributorsWithStatus,
      parse: ([input]) => requireRepositoryInput<ContributorsInput>(input),
      handle: (input) => github.listContributorsWithStatus(input)
    }),
    createIpcInvokeRoute({
      channel: githubIpcRouteChannels.searchWithStatus,
      parse: ([input]) => requireSearchInput(input),
      handle: (input) => github.searchWithStatus(input)
    }),
    createIpcInvokeRoute<GitHubMutationInput, ReturnType<GitHubIpcDependencies["mutate"]>>({
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
    limit: optionalPositiveInteger(input.limit, "Repository list limit must be a positive integer."),
    cacheOnly: optionalBoolean(input.cacheOnly, "Repository list cacheOnly must be a boolean."),
    forceRefresh: optionalBoolean(input.forceRefresh, "Repository list forceRefresh must be a boolean.")
  };
}

function requireOrganizationListInput(input: unknown = {}): OrganizationListInput {
  if (input === undefined) {
    return {};
  }
  if (!isRecord(input)) {
    throw new Error("Organization list input must be an object.");
  }

  return normalizeGitHubReadFields(input, "Organization list");
}

function requireOrganizationInput<TInput extends { org: string }>(input: unknown): TInput {
  if (!isRecord(input)) {
    throw new Error("GitHub organization input must be an object.");
  }

  return {
    ...normalizeGitHubReadFields(input, "GitHub organization"),
    org: requireTrimmedString(input.org, "GitHub organization input requires an org.")
  } as TInput;
}

function requireOrganizationTeamInput<TInput extends { org: string; teamSlug: string }>(
  input: unknown
): TInput {
  if (!isRecord(input)) {
    throw new Error("GitHub team input must be an object.");
  }

  return {
    ...normalizeGitHubReadFields(input, "GitHub team"),
    org: requireTrimmedString(input.org, "GitHub team input requires an org."),
    teamSlug: requireTrimmedString(input.teamSlug, "GitHub team input requires a team slug.")
  } as TInput;
}

function requireRepositoryInput<TInput extends RepoDetailInput>(input: unknown): TInput {
  if (!isRecord(input)) {
    throw new Error("GitHub repository input must be an object.");
  }

  return {
    ...normalizeGitHubReadFields(input, "GitHub repository"),
    owner: requireTrimmedString(input.owner, "GitHub repository input requires an owner."),
    repo: requireTrimmedString(input.repo, "GitHub repository input requires a repo.")
  };
}

function requireOptionalReadInput<TInput extends object>(input: unknown = {}): TInput {
  if (input === undefined) {
    return normalizeGitHubReadFields({}, "GitHub");
  }
  if (!isRecord(input)) {
    throw new Error("IPC input must be an object.");
  }
  return normalizeGitHubReadFields(input, "GitHub");
}

function requireNotificationThreadInput(input: unknown): NotificationThreadInput {
  if (!isRecord(input)) {
    throw new Error("GitHub notification thread input must be an object.");
  }
  return {
    threadId: requireTrimmedString(input.threadId, "GitHub notification thread input requires a thread id.")
  };
}

function requireFileContentInput(input: unknown): RepoFileContentInput {
  const record = requireRepositoryInput<RepoFileContentInput>(input);
  return {
    ...record,
    path: requireTrimmedString(record.path, "GitHub file input requires a path.")
  };
}

function requireFileBlameInput(input: unknown): RepoFileBlameInput {
  const record = requireRepositoryInput<RepoFileBlameInput>(input);
  return {
    ...record,
    path: requireTrimmedString(record.path, "GitHub file input requires a path."),
    maxRanges: optionalPositiveInteger(record.maxRanges, "GitHub file blame range limit must be positive.")
  };
}

function requireIssueDetailInput(input: unknown): IssueDetailInput {
  const record = requireRepositoryInput<IssueDetailInput>(input);
  return {
    ...record,
    issueNumber: requirePositiveInteger(record.issueNumber, "GitHub issue input requires a number.")
  };
}

function requirePullRequestDetailInput(input: unknown): PullRequestDetailReadInput {
  const record = requireRepositoryInput<PullRequestDetailReadInput>(input);
  return {
    ...record,
    pullNumber: requirePositiveInteger(record.pullNumber, "GitHub pull request input requires a number.")
  };
}

function requirePullRequestPageInput(input: unknown): PullRequestCommentsInput {
  const record = requirePullRequestDetailInput(input);
  if (!isRecord(input)) {
    throw new Error("GitHub pull request input must be an object.");
  }
  return {
    ...record,
    limit: optionalPositiveInteger(input.limit, "GitHub pull request limit must be a positive integer."),
    cursor: optionalCursor(input.cursor)
  };
}

function requireDiscussionDetailInput(input: unknown): DiscussionDetailInput {
  const record = requireRepositoryInput<DiscussionDetailInput>(input);
  return {
    ...record,
    discussionNumber: requirePositiveInteger(
      record.discussionNumber,
      "GitHub discussion input requires a number."
    ),
    commentsLimit: optionalPositiveInteger(
      record.commentsLimit,
      "GitHub discussion comments limit must be positive."
    ),
    repliesLimit: optionalPositiveInteger(
      record.repliesLimit,
      "GitHub discussion replies limit must be positive."
    )
  };
}

function requireWorkflowRunDetailInput(input: unknown): WorkflowRunDetailInput {
  const record = requireRepositoryInput<WorkflowRunDetailInput>(input);
  return {
    ...record,
    runId: requirePositiveInteger(record.runId, "GitHub workflow run input requires a run id.")
  };
}

function requireWorkflowJobLogsInput(input: unknown): WorkflowJobLogsInput {
  const record = requireRepositoryInput<WorkflowJobLogsInput>(input);
  return {
    ...record,
    jobId: requirePositiveInteger(record.jobId, "GitHub workflow job logs input requires a job id."),
    maxCharacters: optionalPositiveInteger(
      record.maxCharacters,
      "GitHub workflow job logs maxCharacters must be positive."
    )
  };
}

function requireBranchProtectionInput(input: unknown): BranchProtectionInput {
  const record = requireRepositoryInput<BranchProtectionInput>(input);
  return {
    ...record,
    branch: requireTrimmedString(record.branch, "GitHub branch protection input requires a branch.")
  };
}

function requireReleaseDetailInput(input: unknown): ReleaseDetailInput {
  const record = requireRepositoryInput<ReleaseDetailInput>(input);
  const releaseId = optionalPositiveInteger(
    record.releaseId,
    "GitHub release detail input releaseId must be a positive integer."
  );
  const releaseTagName = optionalTrimmedString(record.releaseTagName);
  if (releaseId === undefined && !releaseTagName) {
    throw new Error("GitHub release detail input requires a release id or tag name.");
  }
  return {
    ...record,
    releaseId,
    releaseTagName
  };
}

function requireSearchInput(input: unknown): SearchInput {
  if (!isRecord(input)) {
    throw new Error("GitHub search input must be an object.");
  }
  return {
    ...normalizeGitHubReadFields<SearchInput>(input, "GitHub search"),
    query: requireTrimmedString(input.query, "GitHub search input requires a query.")
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
    validateOptionalNullableStringField(
      input,
      "description",
      "Repository description must be a string or null."
    );
    validateOptionalNullableStringField(input, "homepage", "Repository homepage must be a string or null.");
    validateOptionalNullableStringField(input, "default_branch", "Default branch must be a string or null.");
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
    validateOptionalStringArrayField(input, "topics", "Repository topics must be an array of strings.");
  }
}

function validateIssueMutationPayload(input: Record<string, unknown> & { action: GitHubAction }): void {
  switch (input.action) {
    case "createIssue":
      requireStringField(input, "title", "Issue creation requires a title.");
      optionalStringField(input, "body", "Issue body must be a string.");
      validateOptionalStringArrayField(input, "labels", "Issue labels must be an array of strings.");
      validateOptionalStringArrayField(input, "assignees", "Issue assignees must be an array of strings.");
      validateOptionalNullablePositiveIntegerField(
        input,
        "milestone",
        "Issue milestone must be a positive integer or null."
      );
      return;
    case "editIssue":
      parsePositiveIntegerField(
        input,
        "issueNumber",
        "Issue mutation issueNumber must be a positive integer."
      );
      optionalNonEmptyString(input, "title", "Issue title must be a non-empty string.");
      optionalStringField(input, "body", "Issue body must be a string.");
      validateOptionalStringArrayField(input, "labels", "Issue labels must be an array of strings.");
      validateOptionalStringArrayField(input, "assignees", "Issue assignees must be an array of strings.");
      validateOptionalNullablePositiveIntegerField(
        input,
        "milestone",
        "Issue milestone must be a positive integer or null."
      );
      optionalNonEmptyString(input, "state", "Issue state must be a non-empty string.");
      return;
    case "closeIssue":
      parsePositiveIntegerField(
        input,
        "issueNumber",
        "Issue mutation issueNumber must be a positive integer."
      );
      optionalNonEmptyString(input, "stateReason", "Issue state reason must be a non-empty string.");
      return;
    case "reopenIssue":
      parsePositiveIntegerField(
        input,
        "issueNumber",
        "Issue mutation issueNumber must be a positive integer."
      );
      return;
    case "addComment":
      parsePositiveIntegerField(input, "issueNumber", "Issue comment requires an issue number.");
      requireStringField(input, "body", "Issue comment requires a body.", { allowEmpty: true });
      return;
    case "editComment":
      parseNumericIdField(input, "commentId", "Issue comment mutation requires a comment id.");
      requireStringField(input, "body", "Issue comment requires a body.", { allowEmpty: true });
      return;
    case "deleteComment":
      parseNumericIdField(input, "commentId", "Issue comment mutation requires a comment id.");
      return;
    case "addLabels":
      parsePositiveIntegerField(input, "issueNumber", "Issue label mutation requires an issue number.");
      parseStringArrayField(input, "labels", "Issue label mutation requires labels.");
      return;
    case "removeLabel":
      parsePositiveIntegerField(input, "issueNumber", "Issue label mutation requires an issue number.");
      requireStringField(input, "name", "Issue label mutation requires a label name.");
      return;
    case "setAssignees":
    case "removeAssignees":
      parsePositiveIntegerField(input, "issueNumber", "Issue assignee mutation requires an issue number.");
      parseStringArrayField(input, "assignees", "Issue assignee mutation requires assignees.");
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
      parsePositiveIntegerField(
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
      parsePositiveIntegerField(
        input,
        "pullNumber",
        "Pull request mutation pullNumber must be a positive integer."
      );
      return;
    case "approvePullRequest":
    case "commentPullRequestReview":
    case "requestChanges":
      parsePositiveIntegerField(input, "pullNumber", "Pull request review mutation requires a pull number.");
      optionalStringField(input, "body", "Pull request review body must be a string.");
      return;
    case "requestReviewers":
    case "removeReviewers":
      parsePositiveIntegerField(
        input,
        "pullNumber",
        "Pull request reviewer mutation requires a pull number."
      );
      validateOptionalStringArrayField(
        input,
        "reviewers",
        "Pull request reviewers must be an array of strings."
      );
      validateOptionalStringArrayField(
        input,
        "teamReviewers",
        "Pull request team reviewers must be an array of strings."
      );
      return;
    case "editReviewComment":
      parseNumericIdField(input, "commentId", "Review comment mutation requires a comment id.");
      requireStringField(input, "body", "Review comment mutation requires a body.", { allowEmpty: true });
      return;
    case "deleteReviewComment":
      parseNumericIdField(input, "commentId", "Review comment mutation requires a comment id.");
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
    parsePositiveIntegerField(input, "runId", "Workflow mutation runId must be a positive integer.");
    return;
  }

  if (input.action === "rerunWorkflowJob") {
    parsePositiveIntegerField(input, "jobId", "Workflow mutation jobId must be a positive integer.");
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
      validateOptionalNullableStringField(input, "name", "Release name must be a string or null.");
      optionalStringField(input, "body", "Release body must be a string.");
      optionalBoolean(input.draft, "Release draft flag must be a boolean.");
      optionalBoolean(input.prerelease, "Release prerelease flag must be a boolean.");
      optionalNonEmptyString(input, "make_latest", "Release make_latest must be a non-empty string.");
      return;
    case "editRelease":
      parsePositiveIntegerField(input, "releaseId", "Release mutation releaseId must be a positive integer.");
      optionalNonEmptyString(input, "tag_name", "Release tag name must be a non-empty string.");
      optionalStringField(input, "target_commitish", "Release target must be a string.");
      validateOptionalNullableStringField(input, "name", "Release name must be a string or null.");
      optionalStringField(input, "body", "Release body must be a string.");
      optionalBoolean(input.draft, "Release draft flag must be a boolean.");
      optionalBoolean(input.prerelease, "Release prerelease flag must be a boolean.");
      optionalNonEmptyString(input, "make_latest", "Release make_latest must be a non-empty string.");
      return;
    case "deleteRelease":
      parsePositiveIntegerField(input, "releaseId", "Release mutation releaseId must be a positive integer.");
      return;
    case "deleteReleaseAsset":
      parsePositiveIntegerField(
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
      validateOptionalJsonValueField(
        input,
        "required_status_checks",
        "Required status checks must be JSON-safe."
      );
      parseOptionalNullableBoolean(input.enforce_admins, "Enforce admins must be a boolean or null.");
      validateOptionalJsonValueField(
        input,
        "required_pull_request_reviews",
        "Required pull request reviews must be JSON-safe."
      );
      validateOptionalJsonValueField(
        input,
        "restrictions",
        "Branch protection restrictions must be JSON-safe."
      );
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
      validateOptionalJsonArrayField(
        input,
        "bypass_actors",
        "Repository ruleset bypass actors must be JSON-safe."
      );
      validateOptionalJsonObjectField(
        input,
        "conditions",
        "Repository ruleset conditions must be a JSON object."
      );
      validateOptionalJsonArrayField(input, "rules", "Repository ruleset rules must be JSON-safe.");
      return;
    case "updateRepositoryRuleset":
      parsePositiveIntegerField(input, "rulesetId", "Repository ruleset mutation requires a ruleset id.");
      requireStringField(input, "name", "Repository ruleset mutation requires a name.");
      requireStringField(input, "enforcement", "Repository ruleset mutation requires enforcement.");
      optionalNonEmptyString(input, "target", "Repository ruleset target must be a non-empty string.");
      validateOptionalJsonArrayField(
        input,
        "bypass_actors",
        "Repository ruleset bypass actors must be JSON-safe."
      );
      validateOptionalJsonObjectField(
        input,
        "conditions",
        "Repository ruleset conditions must be a JSON object."
      );
      validateOptionalJsonArrayField(input, "rules", "Repository ruleset rules must be JSON-safe.");
      return;
    case "deleteRepositoryRuleset":
      parsePositiveIntegerField(input, "rulesetId", "Repository ruleset mutation requires a ruleset id.");
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
      validateOptionalNullableStringField(
        input,
        "shortDescription",
        "Project short description must be a string or null."
      );
      validateOptionalNullableStringField(input, "readme", "Project README must be a string or null.");
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
      validateJsonValueField(input, "value", "Project item value must be JSON-safe.");
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

function normalizeGitHubReadFields<TInput extends object>(
  input: Record<string, unknown>,
  label: string
): TInput {
  const normalized: Record<string, unknown> = {
    ...input,
    limit: optionalPositiveInteger(input.limit, `${label} limit must be a positive integer.`),
    cacheOnly: optionalBoolean(input.cacheOnly, `${label} cacheOnly must be a boolean.`),
    forceRefresh: optionalBoolean(input.forceRefresh, `${label} forceRefresh must be a boolean.`)
  };

  setOptional(normalized, input, "commentsLimit", (value) =>
    optionalPositiveInteger(value, "GitHub comments limit must be a positive integer.")
  );
  setOptional(normalized, input, "repliesLimit", (value) =>
    optionalPositiveInteger(value, "GitHub replies limit must be a positive integer.")
  );
  setOptional(normalized, input, "maxRanges", (value) =>
    optionalPositiveInteger(value, "GitHub maxRanges must be a positive integer.")
  );
  setOptional(normalized, input, "maxCharacters", (value) =>
    optionalPositiveInteger(value, "GitHub maxCharacters must be a positive integer.")
  );
  setOptional(normalized, input, "ref", (value) =>
    optionalNullableString(value, "GitHub ref must be a string or null.")
  );
  setOptional(normalized, input, "path", (value) => optionalString(value, "GitHub path must be a string."));
  setOptional(normalized, input, "pagePath", (value) =>
    optionalNullableString(value, "GitHub wiki page path must be a string or null.")
  );
  setOptional(normalized, input, "since", (value) =>
    optionalNullableString(value, "GitHub since cursor must be a string or null.")
  );
  setOptional(normalized, input, "before", (value) =>
    optionalNullableString(value, "GitHub before cursor must be a string or null.")
  );
  setOptional(normalized, input, "recursive", (value) =>
    optionalBoolean(value, "GitHub recursive flag must be a boolean.")
  );
  setOptional(normalized, input, "all", (value) =>
    optionalBoolean(value, "GitHub notification all flag must be a boolean.")
  );
  setOptional(normalized, input, "participating", (value) =>
    optionalBoolean(value, "GitHub notification participating flag must be a boolean.")
  );
  setOptional(normalized, input, "includesParents", (value) =>
    optionalBoolean(value, "GitHub ruleset includesParents flag must be a boolean.")
  );
  setOptional(normalized, input, "state", (value) =>
    optionalKnownValue(value, "GitHub state is not supported.", [
      "open",
      "closed",
      "all",
      "dismissed",
      "fixed",
      "auto_dismissed",
      "resolved"
    ])
  );
  setOptional(normalized, input, "sort", (value) =>
    optionalKnownValue(value, "GitHub sort is not supported.", ["newest", "oldest", "stargazers"])
  );
  setOptional(normalized, input, "affiliation", (value) =>
    optionalKnownValue(value, "GitHub affiliation is not supported.", ["all", "direct", "outside"])
  );
  setOptional(normalized, input, "permission", (value) =>
    optionalKnownValue(value, "GitHub permission is not supported.", [
      "admin",
      "maintain",
      "push",
      "triage",
      "pull"
    ])
  );

  return normalized as TInput;
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

function validateOptionalNullableStringField(
  input: Record<string, unknown>,
  key: string,
  message: string
): void {
  optionalNullableString(input[key], message);
}

function parsePositiveIntegerField(input: Record<string, unknown>, key: string, message: string): number {
  const value = requirePositiveInteger(input[key], message);
  input[key] = value;
  return value;
}

function parseNumericIdField(input: Record<string, unknown>, key: string, message: string): number {
  const value = input[key];
  if (typeof value === "number") {
    return parsePositiveIntegerField(input, key, message);
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

function validateOptionalNullablePositiveIntegerField(
  input: Record<string, unknown>,
  key: string,
  message: string
): void {
  if (input[key] === undefined || input[key] === null) {
    return;
  }
  parsePositiveIntegerField(input, key, message);
}

function parseStringArrayField(input: Record<string, unknown>, key: string, message: string): string[] {
  const normalized = parseStringArray(input[key], message);
  input[key] = normalized;
  return normalized;
}

function validateOptionalStringArrayField(
  input: Record<string, unknown>,
  key: string,
  message: string
): void {
  if (input[key] === undefined) {
    return;
  }
  parseStringArrayField(input, key, message);
}

function validateJsonValueField(input: Record<string, unknown>, key: string, message: string): void {
  input[key] = requireJsonValue(input[key], message);
}

function validateOptionalJsonValueField(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] !== undefined) {
    input[key] = parseOptionalJsonValue(input[key], message);
  }
}

function validateOptionalJsonArrayField(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] !== undefined) {
    input[key] = parseOptionalJsonArray(input[key], message);
  }
}

function validateOptionalJsonObjectField(input: Record<string, unknown>, key: string, message: string): void {
  if (input[key] !== undefined) {
    input[key] = parseOptionalJsonObject(input[key], message);
  }
}

function optionalCursor(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("GitHub pull request cursor must be a string or null.");
  }
  return value;
}

function optionalKnownValue<TValue extends string>(
  value: unknown,
  message: string,
  supportedValues: readonly TValue[]
): TValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !supportedValues.includes(value as TValue)) {
    throw new Error(message);
  }
  return value as TValue;
}

function setOptional(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  key: string,
  parse: (value: unknown) => unknown
): void {
  if (source[key] !== undefined) {
    target[key] = parse(source[key]);
  }
}
