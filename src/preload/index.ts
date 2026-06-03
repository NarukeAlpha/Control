import { contextBridge, ipcRenderer } from "electron";

import type { ControlSettings } from "@shared/github";
import { githubIpcRouteChannels, ipcChannels, type ControlApi } from "@shared/ipc";

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function onPayload<TPayload>(channel: string, callback: (payload: TPayload) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
    callback(payload as TPayload);
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const controlApi: ControlApi = {
  getAppState: () => invoke(ipcChannels.appState),
  getSettings: () => invoke(ipcChannels.getSettings),
  updateSettings: (settings: Partial<ControlSettings>) => invoke(ipcChannels.updateSettings, settings),
  signInWithGitHub: () => invoke(ipcChannels.signInWithGitHub),
  getGitHubSignIn: () => invoke(ipcChannels.getGitHubSignIn),
  cancelGitHubSignIn: () => invoke(ipcChannels.cancelGitHubSignIn),
  clearGitHubToken: () => invoke(ipcChannels.clearGitHubToken),
  openExternal: (url: string) => invoke(ipcChannels.openExternal, url),
  listPinnedRepositories: () => invoke(ipcChannels.listPinnedRepositories),
  pinRepository: (input) => invoke(ipcChannels.pinRepository, input),
  unpinRepository: (input) => invoke(ipcChannels.unpinRepository, input),
  listRepositoryPins: () => invoke(ipcChannels.listRepositoryPins),
  pinAreaRepository: (input) => invoke(ipcChannels.pinAreaRepository, input),
  unpinAreaRepository: (input) => invoke(ipcChannels.unpinAreaRepository, input),
  listRecentItems: (input = {}) => invoke(ipcChannels.listRecentItems, input),
  recordRecentItem: (input) => invoke(ipcChannels.recordRecentItem, input),
  previewDataExport: (input) => invoke(ipcChannels.previewDataExport, input),
  exportData: (input) => invoke(ipcChannels.exportData, input),
  previewDataImport: (input) => invoke(ipcChannels.previewDataImport, input),
  importData: (input) => invoke(ipcChannels.importData, input),
  areas: {
    listAreas: () => invoke(ipcChannels.areasList),
    getArea: (areaId) => invoke(ipcChannels.areasGet, areaId),
    selectArea: (areaId) => invoke(ipcChannels.areasSelect, areaId),
    createLocalArea: (input) => invoke(ipcChannels.areasCreateLocal, input),
    createSshArea: (input) => invoke(ipcChannels.areasCreateSsh, input),
    updateArea: (input) => invoke(ipcChannels.areasUpdate, input),
    removeArea: (areaId) => invoke(ipcChannels.areasRemove, areaId),
    refreshArea: (areaId) => invoke(ipcChannels.areasRefresh, areaId),
    searchAreas: (input) => invoke(ipcChannels.areasSearch, input),
    listRepositories: (input) => invoke(ipcChannels.areaRepositories, input),
    getRepository: (input) => invoke(ipcChannels.areaRepository, input),
    listContents: (input) => invoke(ipcChannels.areaContents, input),
    getFileContent: (input) => invoke(ipcChannels.areaFileContent, input),
    searchFilePaths: (input) => invoke(ipcChannels.areaFilePathSearch, input),
    listBranches: (input) => invoke(ipcChannels.areaBranches, input),
    listRemotes: (input) => invoke(ipcChannels.areaRemotes, input),
    getStatus: (input) => invoke(ipcChannels.areaStatus, input),
    listActivity: (input) => invoke(ipcChannels.areaActivity, input),
    listWorkspaces: (input) => invoke(ipcChannels.areaWorkspaces, input),
    getWorkspace: (input) => invoke(ipcChannels.areaWorkspace, input),
    getGitHubRepository: (input) => invoke(ipcChannels.areaGitHubRepository, input),
    listGitHubIssues: (input) => invoke(ipcChannels.areaGitHubIssues, input),
    listGitHubPullRequests: (input) => invoke(ipcChannels.areaGitHubPullRequests, input),
    listGitHubActions: (input) => invoke(ipcChannels.areaGitHubActions, input),
    listGitHubReleases: (input) => invoke(ipcChannels.areaGitHubReleases, input),
    listGitHubContributors: (input) => invoke(ipcChannels.areaGitHubContributors, input),
    getSyncStatus: (input) => invoke(ipcChannels.areaSyncStatus, input),
    prepareGatewayOperation: (input) => invoke(ipcChannels.areaPrepareGatewayOperation, input),
    runGatewayOperation: (input) => invoke(ipcChannels.areaRunGatewayOperation, input),
    stopGateway: (input) => invoke(ipcChannels.areaStopGateway, input),
    repairGateway: (input) => invoke(ipcChannels.areaRepairGateway, input),
    rotateGatewayCredentials: (input) => invoke(ipcChannels.areaRotateGatewayCredentials, input),
    restartGateway: (input) => invoke(ipcChannels.areaRestartGateway, input),
    openLocalFolderPicker: () => invoke(ipcChannels.areaOpenLocalFolderPicker)
  },
  onGitHubRepositoriesUpdated: (callback) => onPayload(ipcChannels.githubRepositoriesUpdated, callback),
  onGitHubAuthUpdated: (callback) => onPayload(ipcChannels.githubAuthUpdated, callback),
  onAreasUpdated: (callback) => onPayload(ipcChannels.areasUpdated, callback),
  onAreaRepositoryUpdated: (callback) => onPayload(ipcChannels.areaRepositoryUpdated, callback),
  onAreaWorkspaceUpdated: (callback) => onPayload(ipcChannels.areaWorkspaceUpdated, callback),
  github: {
    getViewer: () => invoke(githubIpcRouteChannels.getViewer),
    getAccountProfileWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.getAccountProfileWithStatus, input),
    listRepositoriesWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.listRepositoriesWithStatus, input),
    listAccountRepositoriesWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.listAccountRepositoriesWithStatus, input),
    listAccountContributionsWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.listAccountContributionsWithStatus, input),
    listOrganizationsWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.listOrganizationsWithStatus, input),
    listOrganizationTeamsWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listOrganizationTeamsWithStatus, input),
    listOrganizationRepositoriesWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listOrganizationRepositoriesWithStatus, input),
    listOrganizationTeamRepositoriesWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listOrganizationTeamRepositoriesWithStatus, input),
    listOrganizationTeamMembersWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listOrganizationTeamMembersWithStatus, input),
    listOrganizationMembersWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listOrganizationMembersWithStatus, input),
    listOrganizationProjectsWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listOrganizationProjectsWithStatus, input),
    listAccountIssuesWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.listAccountIssuesWithStatus, input),
    listAccountPullRequestsWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.listAccountPullRequestsWithStatus, input),
    listNotificationsWithStatus: (input = {}) =>
      invoke(githubIpcRouteChannels.listNotificationsWithStatus, input),
    markNotificationThreadRead: (input) => invoke(githubIpcRouteChannels.markNotificationThreadRead, input),
    unsubscribeNotificationThread: (input) =>
      invoke(githubIpcRouteChannels.unsubscribeNotificationThread, input),
    getRepositoryWithStatus: (input) => invoke(githubIpcRouteChannels.getRepositoryWithStatus, input),
    listRepositoryForks: (input) => invoke(githubIpcRouteChannels.listRepositoryForks, input),
    listBranchesWithStatus: (input) => invoke(githubIpcRouteChannels.listBranchesWithStatus, input),
    listTagsWithStatus: (input) => invoke(githubIpcRouteChannels.listTagsWithStatus, input),
    listTreeWithStatus: (input) => invoke(githubIpcRouteChannels.listTreeWithStatus, input),
    getReadme: (input) => invoke(githubIpcRouteChannels.getReadme, input),
    listContentsWithStatus: (input) => invoke(githubIpcRouteChannels.listContentsWithStatus, input),
    getFileContentWithStatus: (input) => invoke(githubIpcRouteChannels.getFileContentWithStatus, input),
    getFileBlame: (input) => invoke(githubIpcRouteChannels.getFileBlame, input),
    getRepositoryWiki: (input) => invoke(githubIpcRouteChannels.getRepositoryWiki, input),
    listCommitsWithStatus: (input) => invoke(githubIpcRouteChannels.listCommitsWithStatus, input),
    listLabelsWithStatus: (input) => invoke(githubIpcRouteChannels.listLabelsWithStatus, input),
    listAssignableUsersWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listAssignableUsersWithStatus, input),
    getRepositoryAccess: (input) => invoke(githubIpcRouteChannels.getRepositoryAccess, input),
    listMilestonesWithStatus: (input) => invoke(githubIpcRouteChannels.listMilestonesWithStatus, input),
    listIssuesWithStatus: (input) => invoke(githubIpcRouteChannels.listIssuesWithStatus, input),
    getIssueDetailWithStatus: (input) => invoke(githubIpcRouteChannels.getIssueDetailWithStatus, input),
    listPullRequestsWithStatus: (input) => invoke(githubIpcRouteChannels.listPullRequestsWithStatus, input),
    getPullRequestDetailWithStatus: (input) =>
      invoke(githubIpcRouteChannels.getPullRequestDetailWithStatus, input),
    getPullRequestOverviewWithStatus: (input) =>
      invoke(githubIpcRouteChannels.getPullRequestOverviewWithStatus, input),
    listPullRequestCommentsWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestCommentsWithStatus, input),
    listPullRequestFilesWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestFilesWithStatus, input),
    listPullRequestCommitsWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestCommitsWithStatus, input),
    listPullRequestReviewsWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestReviewsWithStatus, input),
    listPullRequestChecksWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestChecksWithStatus, input),
    listPullRequestReviewThreadsWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestReviewThreadsWithStatus, input),
    listPullRequestTimelineWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestTimelineWithStatus, input),
    listPullRequestLinkedIssuesWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listPullRequestLinkedIssuesWithStatus, input),
    listDiscussionsWithStatus: (input) => invoke(githubIpcRouteChannels.listDiscussionsWithStatus, input),
    listDiscussionCategoriesWithStatus: (input) =>
      invoke(githubIpcRouteChannels.listDiscussionCategoriesWithStatus, input),
    getDiscussionDetail: (input) => invoke(githubIpcRouteChannels.getDiscussionDetail, input),
    listActionsWithStatus: (input) => invoke(githubIpcRouteChannels.listActionsWithStatus, input),
    listWorkflowsWithStatus: (input) => invoke(githubIpcRouteChannels.listWorkflowsWithStatus, input),
    getWorkflowRunDetailWithStatus: (input) =>
      invoke(githubIpcRouteChannels.getWorkflowRunDetailWithStatus, input),
    getWorkflowJobLogs: (input) => invoke(githubIpcRouteChannels.getWorkflowJobLogs, input),
    listProjectsWithStatus: (input) => invoke(githubIpcRouteChannels.listProjectsWithStatus, input),
    getBranchProtection: (input) => invoke(githubIpcRouteChannels.getBranchProtection, input),
    listDependabotAlerts: (input) => invoke(githubIpcRouteChannels.listDependabotAlerts, input),
    listCodeScanningAlerts: (input) => invoke(githubIpcRouteChannels.listCodeScanningAlerts, input),
    listSecretScanningAlerts: (input) => invoke(githubIpcRouteChannels.listSecretScanningAlerts, input),
    listRepositoryRulesets: (input) => invoke(githubIpcRouteChannels.listRepositoryRulesets, input),
    listRepositorySecurityAdvisories: (input) =>
      invoke(githubIpcRouteChannels.listRepositorySecurityAdvisories, input),
    getRepositorySecurityPolicy: (input) => invoke(githubIpcRouteChannels.getRepositorySecurityPolicy, input),
    getRepositoryCommunityProfile: (input) =>
      invoke(githubIpcRouteChannels.getRepositoryCommunityProfile, input),
    listReleasesWithStatus: (input) => invoke(githubIpcRouteChannels.listReleasesWithStatus, input),
    getReleaseDetailWithStatus: (input) => invoke(githubIpcRouteChannels.getReleaseDetailWithStatus, input),
    listContributorsWithStatus: (input) => invoke(githubIpcRouteChannels.listContributorsWithStatus, input),
    searchWithStatus: (input) => invoke(githubIpcRouteChannels.searchWithStatus, input),
    mutate: (input) => invoke(githubIpcRouteChannels.mutate, input)
  }
};

contextBridge.exposeInMainWorld("control", controlApi);
