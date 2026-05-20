import { describe, expect, it } from "vitest";

import { githubActions, type GitHubAction, type GitHubMutationInput } from "./github";
import { githubIpcRouteChannels, ipcChannels, type GitHubIpcApi, type JsonSerializable } from "./ipc";

type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

type GitHubIpcRouteKey = keyof typeof githubIpcRouteChannels;
type CreateIssueMutationInput = Extract<GitHubMutationInput, { action: "createIssue" }>;
type DispatchWorkflowMutationInput = Extract<GitHubMutationInput, { action: "dispatchWorkflow" }>;

type _RouteMapCoversGitHubIpcApi = Expect<Equal<GitHubIpcRouteKey, keyof GitHubIpcApi>>;
type _RuntimeGitHubActionsCoverActionUnion = Expect<Equal<(typeof githubActions)[number], GitHubAction>>;
type _CreateIssueRequiresTitle = Expect<
  Equal<CreateIssueMutationInput extends { title: string } ? true : false, true>
>;
type _MutationInputOmitsNestedPayload = Expect<
  Equal<"payload" extends keyof CreateIssueMutationInput ? true : false, false>
>;
type _DispatchWorkflowRequiresRef = Expect<
  Equal<DispatchWorkflowMutationInput extends { workflowId: string; ref: string } ? true : false, true>
>;
type _RejectsNestedDate = Expect<Equal<JsonSerializable<{ id: string; nested: { createdAt: Date } }>, never>>;
type _RejectsNestedFunction = Expect<
  Equal<JsonSerializable<{ id: string; nested: { run: () => void } }>, never>
>;
type _AcceptsJsonContract = Expect<
  Equal<
    JsonSerializable<{ id: string; nested: { values: Array<string | number | null> } }>,
    {
      id: string;
      nested: { values: (string | number | null)[] };
    }
  >
>;
type _GitHubIpcResultIsJsonSerializable = Expect<
  Equal<
    JsonSerializable<Awaited<ReturnType<GitHubIpcApi["listRepositoriesWithStatus"]>>> extends never
      ? false
      : true,
    true
  >
>;

const githubIpcRouteKeys = {
  getViewer: true,
  getAccountProfileWithStatus: true,
  listRepositoriesWithStatus: true,
  listAccountRepositoriesWithStatus: true,
  listOrganizationsWithStatus: true,
  listOrganizationTeamsWithStatus: true,
  listOrganizationRepositoriesWithStatus: true,
  listOrganizationTeamRepositoriesWithStatus: true,
  listOrganizationTeamMembersWithStatus: true,
  listOrganizationMembersWithStatus: true,
  listOrganizationProjectsWithStatus: true,
  listAccountIssuesWithStatus: true,
  listAccountPullRequestsWithStatus: true,
  listNotificationsWithStatus: true,
  markNotificationThreadRead: true,
  unsubscribeNotificationThread: true,
  getRepositoryWithStatus: true,
  listRepositoryForks: true,
  listBranchesWithStatus: true,
  listTagsWithStatus: true,
  listTreeWithStatus: true,
  getReadme: true,
  listContentsWithStatus: true,
  getFileContentWithStatus: true,
  getFileBlame: true,
  getRepositoryWiki: true,
  listCommitsWithStatus: true,
  listLabelsWithStatus: true,
  listAssignableUsersWithStatus: true,
  getRepositoryAccess: true,
  listMilestonesWithStatus: true,
  listIssuesWithStatus: true,
  getIssueDetailWithStatus: true,
  listPullRequestsWithStatus: true,
  getPullRequestDetailWithStatus: true,
  listDiscussionsWithStatus: true,
  listDiscussionCategoriesWithStatus: true,
  getDiscussionDetail: true,
  listActionsWithStatus: true,
  listWorkflowsWithStatus: true,
  getWorkflowRunDetailWithStatus: true,
  getWorkflowJobLogs: true,
  listProjectsWithStatus: true,
  getBranchProtection: true,
  listDependabotAlerts: true,
  listCodeScanningAlerts: true,
  listSecretScanningAlerts: true,
  listRepositoryRulesets: true,
  listRepositorySecurityAdvisories: true,
  getRepositorySecurityPolicy: true,
  getRepositoryCommunityProfile: true,
  listReleasesWithStatus: true,
  listContributorsWithStatus: true,
  searchWithStatus: true,
  mutate: true
} satisfies Record<keyof GitHubIpcApi, true>;

describe("GitHubIpcApi route map", () => {
  it("keeps runtime keys in parity with GitHubIpcApi", () => {
    expect(Object.keys(githubIpcRouteChannels).sort()).toEqual(Object.keys(githubIpcRouteKeys).sort());
  });

  it("preserves existing GitHub IPC channel names", () => {
    expect(githubIpcRouteChannels).toEqual({
      getViewer: ipcChannels.githubViewer,
      getAccountProfileWithStatus: ipcChannels.githubAccountProfileWithStatus,
      listRepositoriesWithStatus: ipcChannels.githubRepositoriesWithStatus,
      listAccountRepositoriesWithStatus: ipcChannels.githubAccountRepositoriesWithStatus,
      listOrganizationsWithStatus: ipcChannels.githubOrganizationsWithStatus,
      listOrganizationTeamsWithStatus: ipcChannels.githubOrganizationTeamsWithStatus,
      listOrganizationRepositoriesWithStatus: ipcChannels.githubOrganizationRepositoriesWithStatus,
      listOrganizationTeamRepositoriesWithStatus: ipcChannels.githubOrganizationTeamRepositoriesWithStatus,
      listOrganizationTeamMembersWithStatus: ipcChannels.githubOrganizationTeamMembersWithStatus,
      listOrganizationMembersWithStatus: ipcChannels.githubOrganizationMembersWithStatus,
      listOrganizationProjectsWithStatus: ipcChannels.githubOrganizationProjectsWithStatus,
      listAccountIssuesWithStatus: ipcChannels.githubAccountIssuesWithStatus,
      listAccountPullRequestsWithStatus: ipcChannels.githubAccountPullRequestsWithStatus,
      listNotificationsWithStatus: ipcChannels.githubNotificationsWithStatus,
      markNotificationThreadRead: ipcChannels.githubNotificationThreadRead,
      unsubscribeNotificationThread: ipcChannels.githubNotificationThreadUnsubscribe,
      getRepositoryWithStatus: ipcChannels.githubRepositoryWithStatus,
      listRepositoryForks: ipcChannels.githubRepositoryForks,
      listBranchesWithStatus: ipcChannels.githubBranchesWithStatus,
      listTagsWithStatus: ipcChannels.githubTagsWithStatus,
      listTreeWithStatus: ipcChannels.githubTreeWithStatus,
      getReadme: ipcChannels.githubReadme,
      listContentsWithStatus: ipcChannels.githubContentsWithStatus,
      getFileContentWithStatus: ipcChannels.githubFileContentWithStatus,
      getFileBlame: ipcChannels.githubFileBlame,
      getRepositoryWiki: ipcChannels.githubRepositoryWiki,
      listCommitsWithStatus: ipcChannels.githubCommitsWithStatus,
      listLabelsWithStatus: ipcChannels.githubLabelsWithStatus,
      listAssignableUsersWithStatus: ipcChannels.githubAssignableUsersWithStatus,
      getRepositoryAccess: ipcChannels.githubRepositoryAccess,
      listMilestonesWithStatus: ipcChannels.githubMilestonesWithStatus,
      listIssuesWithStatus: ipcChannels.githubIssuesWithStatus,
      getIssueDetailWithStatus: ipcChannels.githubIssueDetailWithStatus,
      listPullRequestsWithStatus: ipcChannels.githubPullRequestsWithStatus,
      getPullRequestDetailWithStatus: ipcChannels.githubPullRequestDetailWithStatus,
      listDiscussionsWithStatus: ipcChannels.githubDiscussionsWithStatus,
      listDiscussionCategoriesWithStatus: ipcChannels.githubDiscussionCategoriesWithStatus,
      getDiscussionDetail: ipcChannels.githubDiscussionDetail,
      listActionsWithStatus: ipcChannels.githubActionsWithStatus,
      listWorkflowsWithStatus: ipcChannels.githubWorkflowsWithStatus,
      getWorkflowRunDetailWithStatus: ipcChannels.githubWorkflowRunDetailWithStatus,
      getWorkflowJobLogs: ipcChannels.githubWorkflowJobLogs,
      listProjectsWithStatus: ipcChannels.githubProjectsWithStatus,
      getBranchProtection: ipcChannels.githubBranchProtection,
      listDependabotAlerts: ipcChannels.githubDependabotAlerts,
      listCodeScanningAlerts: ipcChannels.githubCodeScanningAlerts,
      listSecretScanningAlerts: ipcChannels.githubSecretScanningAlerts,
      listRepositoryRulesets: ipcChannels.githubRepositoryRulesets,
      listRepositorySecurityAdvisories: ipcChannels.githubRepositorySecurityAdvisories,
      getRepositorySecurityPolicy: ipcChannels.githubRepositorySecurityPolicy,
      getRepositoryCommunityProfile: ipcChannels.githubRepositoryCommunityProfile,
      listReleasesWithStatus: ipcChannels.githubReleasesWithStatus,
      listContributorsWithStatus: ipcChannels.githubContributorsWithStatus,
      searchWithStatus: ipcChannels.githubSearchWithStatus,
      mutate: ipcChannels.githubMutate
    });
  });
});
