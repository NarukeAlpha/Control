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
    listRepositories: (input = {}) => ipcRenderer.invoke(ipcChannels.githubRepositories, input),
    listAccountRepositories: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountRepositories, input),
    listAccountIssues: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountIssues, input),
    listAccountPullRequests: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountPullRequests, input),
    getRepository: (input) => ipcRenderer.invoke(ipcChannels.githubRepository, input),
    getReadme: (input) => ipcRenderer.invoke(ipcChannels.githubReadme, input),
    listContents: (input) => ipcRenderer.invoke(ipcChannels.githubContents, input),
    getFileContent: (input) => ipcRenderer.invoke(ipcChannels.githubFileContent, input),
    listIssues: (input) => ipcRenderer.invoke(ipcChannels.githubIssues, input),
    getIssueDetail: (input) => ipcRenderer.invoke(ipcChannels.githubIssueDetail, input),
    listPullRequests: (input) => ipcRenderer.invoke(ipcChannels.githubPullRequests, input),
    getPullRequestDetail: (input) => ipcRenderer.invoke(ipcChannels.githubPullRequestDetail, input),
    listDiscussions: (input) => ipcRenderer.invoke(ipcChannels.githubDiscussions, input),
    listActions: (input) => ipcRenderer.invoke(ipcChannels.githubActions, input),
    listProjects: (input) => ipcRenderer.invoke(ipcChannels.githubProjects, input),
    listReleases: (input) => ipcRenderer.invoke(ipcChannels.githubReleases, input),
    listContributors: (input) => ipcRenderer.invoke(ipcChannels.githubContributors, input),
    search: (input) => ipcRenderer.invoke(ipcChannels.githubSearch, input),
    mutate: (input) => ipcRenderer.invoke(ipcChannels.githubMutate, input)
  }
};

contextBridge.exposeInMainWorld("control", controlApi);
