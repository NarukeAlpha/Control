import { contextBridge, ipcRenderer } from "electron";

import type { ControlSettings } from "@shared/github";
import { ipcChannels, type ControlApi } from "@shared/ipc";

const controlApi: ControlApi = {
  getAppState: () => ipcRenderer.invoke(ipcChannels.appState),
  getSettings: () => ipcRenderer.invoke(ipcChannels.getSettings),
  updateSettings: (settings: Partial<ControlSettings>) =>
    ipcRenderer.invoke(ipcChannels.updateSettings, settings),
  signInWithGitHub: () => ipcRenderer.invoke(ipcChannels.signInWithGitHub),
  getGitHubSignIn: () => ipcRenderer.invoke(ipcChannels.getGitHubSignIn),
  cancelGitHubSignIn: () => ipcRenderer.invoke(ipcChannels.cancelGitHubSignIn),
  clearGitHubToken: () => ipcRenderer.invoke(ipcChannels.clearGitHubToken),
  openExternal: (url: string) => ipcRenderer.invoke(ipcChannels.openExternal, url),
  listPinnedRepositories: () => ipcRenderer.invoke(ipcChannels.listPinnedRepositories),
  pinRepository: (input) => ipcRenderer.invoke(ipcChannels.pinRepository, input),
  unpinRepository: (input) => ipcRenderer.invoke(ipcChannels.unpinRepository, input),
  listRecentItems: (input = {}) => ipcRenderer.invoke(ipcChannels.listRecentItems, input),
  recordRecentItem: (input) => ipcRenderer.invoke(ipcChannels.recordRecentItem, input),
  onGitHubRepositoriesUpdated: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      callback(payload as Parameters<typeof callback>[0]);
    };
    ipcRenderer.on(ipcChannels.githubRepositoriesUpdated, listener);
    return () => ipcRenderer.removeListener(ipcChannels.githubRepositoriesUpdated, listener);
  },
  github: {
    getViewer: () => ipcRenderer.invoke(ipcChannels.githubViewer),
    getAccountProfile: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountProfile, input),
    getAccountProfileWithStatus: (input = {}) =>
      ipcRenderer.invoke(ipcChannels.githubAccountProfileWithStatus, input),
    listRepositories: (input = {}) => ipcRenderer.invoke(ipcChannels.githubRepositories, input),
    listRepositoriesWithStatus: (input = {}) =>
      ipcRenderer.invoke(ipcChannels.githubRepositoriesWithStatus, input),
    listAccountRepositories: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountRepositories, input),
    listAccountRepositoriesWithStatus: (input = {}) =>
      ipcRenderer.invoke(ipcChannels.githubAccountRepositoriesWithStatus, input),
    listOrganizations: (input = {}) => ipcRenderer.invoke(ipcChannels.githubOrganizations, input),
    listOrganizationsWithStatus: (input = {}) =>
      ipcRenderer.invoke(ipcChannels.githubOrganizationsWithStatus, input),
    listOrganizationTeams: (input) => ipcRenderer.invoke(ipcChannels.githubOrganizationTeams, input),
    listOrganizationTeamsWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubOrganizationTeamsWithStatus, input),
    listOrganizationRepositoriesWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubOrganizationRepositoriesWithStatus, input),
    listOrganizationTeamRepositoriesWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubOrganizationTeamRepositoriesWithStatus, input),
    listOrganizationTeamMembersWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubOrganizationTeamMembersWithStatus, input),
    listOrganizationMembersWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubOrganizationMembersWithStatus, input),
    listOrganizationProjectsWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubOrganizationProjectsWithStatus, input),
    listAccountIssues: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountIssues, input),
    listAccountIssuesWithStatus: (input = {}) =>
      ipcRenderer.invoke(ipcChannels.githubAccountIssuesWithStatus, input),
    listAccountPullRequests: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountPullRequests, input),
    listAccountPullRequestsWithStatus: (input = {}) =>
      ipcRenderer.invoke(ipcChannels.githubAccountPullRequestsWithStatus, input),
    listNotifications: (input = {}) => ipcRenderer.invoke(ipcChannels.githubNotifications, input),
    listNotificationsWithStatus: (input = {}) =>
      ipcRenderer.invoke(ipcChannels.githubNotificationsWithStatus, input),
    markNotificationThreadRead: (input) => ipcRenderer.invoke(ipcChannels.githubNotificationThreadRead, input),
    unsubscribeNotificationThread: (input) =>
      ipcRenderer.invoke(ipcChannels.githubNotificationThreadUnsubscribe, input),
    getRepository: (input) => ipcRenderer.invoke(ipcChannels.githubRepository, input),
    getRepositoryWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubRepositoryWithStatus, input),
    listRepositoryForks: (input) => ipcRenderer.invoke(ipcChannels.githubRepositoryForks, input),
    listBranches: (input) => ipcRenderer.invoke(ipcChannels.githubBranches, input),
    listBranchesWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubBranchesWithStatus, input),
    listTags: (input) => ipcRenderer.invoke(ipcChannels.githubTags, input),
    listTagsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubTagsWithStatus, input),
    listTree: (input) => ipcRenderer.invoke(ipcChannels.githubTree, input),
    listTreeWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubTreeWithStatus, input),
    getReadme: (input) => ipcRenderer.invoke(ipcChannels.githubReadme, input),
    listContents: (input) => ipcRenderer.invoke(ipcChannels.githubContents, input),
    listContentsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubContentsWithStatus, input),
    getFileContent: (input) => ipcRenderer.invoke(ipcChannels.githubFileContent, input),
    getFileContentWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubFileContentWithStatus, input),
    getFileBlame: (input) => ipcRenderer.invoke(ipcChannels.githubFileBlame, input),
    getRepositoryWiki: (input) => ipcRenderer.invoke(ipcChannels.githubRepositoryWiki, input),
    listCommits: (input) => ipcRenderer.invoke(ipcChannels.githubCommits, input),
    listCommitsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubCommitsWithStatus, input),
    listLabels: (input) => ipcRenderer.invoke(ipcChannels.githubLabels, input),
    listLabelsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubLabelsWithStatus, input),
    listAssignableUsers: (input) => ipcRenderer.invoke(ipcChannels.githubAssignableUsers, input),
    listAssignableUsersWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubAssignableUsersWithStatus, input),
    getRepositoryAccess: (input) => ipcRenderer.invoke(ipcChannels.githubRepositoryAccess, input),
    listMilestones: (input) => ipcRenderer.invoke(ipcChannels.githubMilestones, input),
    listMilestonesWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubMilestonesWithStatus, input),
    listIssues: (input) => ipcRenderer.invoke(ipcChannels.githubIssues, input),
    listIssuesWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubIssuesWithStatus, input),
    getIssueDetail: (input) => ipcRenderer.invoke(ipcChannels.githubIssueDetail, input),
    getIssueDetailWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubIssueDetailWithStatus, input),
    listPullRequests: (input) => ipcRenderer.invoke(ipcChannels.githubPullRequests, input),
    listPullRequestsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubPullRequestsWithStatus, input),
    getPullRequestDetail: (input) => ipcRenderer.invoke(ipcChannels.githubPullRequestDetail, input),
    getPullRequestDetailWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubPullRequestDetailWithStatus, input),
    listDiscussions: (input) => ipcRenderer.invoke(ipcChannels.githubDiscussions, input),
    listDiscussionsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubDiscussionsWithStatus, input),
    getDiscussionDetail: (input) => ipcRenderer.invoke(ipcChannels.githubDiscussionDetail, input),
    listActions: (input) => ipcRenderer.invoke(ipcChannels.githubActions, input),
    listActionsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubActionsWithStatus, input),
    listWorkflows: (input) => ipcRenderer.invoke(ipcChannels.githubWorkflows, input),
    listWorkflowsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubWorkflowsWithStatus, input),
    getWorkflowRunDetail: (input) => ipcRenderer.invoke(ipcChannels.githubWorkflowRunDetail, input),
    getWorkflowRunDetailWithStatus: (input) =>
      ipcRenderer.invoke(ipcChannels.githubWorkflowRunDetailWithStatus, input),
    getWorkflowJobLogs: (input) => ipcRenderer.invoke(ipcChannels.githubWorkflowJobLogs, input),
    listProjects: (input) => ipcRenderer.invoke(ipcChannels.githubProjects, input),
    listProjectsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubProjectsWithStatus, input),
    getBranchProtection: (input) => ipcRenderer.invoke(ipcChannels.githubBranchProtection, input),
    listDependabotAlerts: (input) => ipcRenderer.invoke(ipcChannels.githubDependabotAlerts, input),
    listCodeScanningAlerts: (input) => ipcRenderer.invoke(ipcChannels.githubCodeScanningAlerts, input),
    listSecretScanningAlerts: (input) => ipcRenderer.invoke(ipcChannels.githubSecretScanningAlerts, input),
    listRepositoryRulesets: (input) => ipcRenderer.invoke(ipcChannels.githubRepositoryRulesets, input),
    listRepositorySecurityAdvisories: (input) =>
      ipcRenderer.invoke(ipcChannels.githubRepositorySecurityAdvisories, input),
    getRepositorySecurityPolicy: (input) =>
      ipcRenderer.invoke(ipcChannels.githubRepositorySecurityPolicy, input),
    getRepositoryCommunityProfile: (input) =>
      ipcRenderer.invoke(ipcChannels.githubRepositoryCommunityProfile, input),
    listReleases: (input) => ipcRenderer.invoke(ipcChannels.githubReleases, input),
    listReleasesWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubReleasesWithStatus, input),
    listContributors: (input) => ipcRenderer.invoke(ipcChannels.githubContributors, input),
    listContributorsWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubContributorsWithStatus, input),
    search: (input) => ipcRenderer.invoke(ipcChannels.githubSearch, input),
    searchWithStatus: (input) => ipcRenderer.invoke(ipcChannels.githubSearchWithStatus, input),
    mutate: (input) => ipcRenderer.invoke(ipcChannels.githubMutate, input)
  }
};

contextBridge.exposeInMainWorld("control", controlApi);
