import { contextBridge, ipcRenderer } from "electron";

import type { ControlSettings } from "@shared/github";
import { ipcChannels, type ControlApi } from "@shared/ipc";

const controlApi: ControlApi = {
  getAppState: () => ipcRenderer.invoke(ipcChannels.appState),
  getSettings: () => ipcRenderer.invoke(ipcChannels.getSettings),
  updateSettings: (settings: Partial<ControlSettings>) =>
    ipcRenderer.invoke(ipcChannels.updateSettings, settings),
  openExternal: (url: string) => ipcRenderer.invoke(ipcChannels.openExternal, url),
  github: {
    getViewer: () => ipcRenderer.invoke(ipcChannels.githubViewer),
    getAccountProfile: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountProfile, input),
    listRepositories: (input = {}) => ipcRenderer.invoke(ipcChannels.githubRepositories, input),
    listAccountRepositories: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountRepositories, input),
    listAccountIssues: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountIssues, input),
    listAccountPullRequests: (input = {}) => ipcRenderer.invoke(ipcChannels.githubAccountPullRequests, input),
    getRepository: (input) => ipcRenderer.invoke(ipcChannels.githubRepository, input),
    listContents: (input) => ipcRenderer.invoke(ipcChannels.githubContents, input),
    getFileContent: (input) => ipcRenderer.invoke(ipcChannels.githubFileContent, input),
    listIssues: (input) => ipcRenderer.invoke(ipcChannels.githubIssues, input),
    listPullRequests: (input) => ipcRenderer.invoke(ipcChannels.githubPullRequests, input),
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
