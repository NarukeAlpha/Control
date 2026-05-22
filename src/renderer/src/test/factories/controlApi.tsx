import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";
import type { GitHubProvider, RepoDetailInput, RepositoryDetail } from "@shared/github";
import { App } from "../../App";
import { mockControlApi } from "../../data/mock";
import { useUiStore } from "../../stores/uiStore";

export const defaultUiState = {
  route: { kind: "home" as const },
  selectedRepository: "apple/swift",
  settingsOpen: false
};

type GitHubRawReadTestApi = Omit<
  Pick<
    GitHubProvider,
    | "getAccountProfile"
    | "listRepositories"
    | "listAccountRepositories"
    | "listOrganizations"
    | "listOrganizationTeams"
    | "listAccountIssues"
    | "listAccountPullRequests"
    | "listNotifications"
    | "listBranches"
    | "listTags"
    | "listTree"
    | "listContents"
    | "getFileContent"
    | "listCommits"
    | "listLabels"
    | "listAssignableUsers"
    | "listMilestones"
    | "listIssues"
    | "getIssueDetail"
    | "listPullRequests"
    | "getPullRequestDetail"
    | "listDiscussions"
    | "listActions"
    | "listWorkflows"
    | "getWorkflowRunDetail"
    | "listProjects"
    | "listReleases"
    | "listContributors"
    | "search"
  >,
  "getRepository"
> & {
  getRepository(input: RepoDetailInput): Promise<RepositoryDetail>;
};

export type GitHubTestApi = ControlApi["github"] & GitHubRawReadTestApi;

export function renderControl(api: ControlApi): void {
  window.control = api;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  });

  render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export function makeApi(overrides: Partial<GitHubTestApi> = {}): ControlApi {
  const github = {
    ...mockControlApi.github,
    ...overrides
  } as GitHubTestApi;
  const available = { status: "available", message: null } as const;
  if (overrides.listRepositories && !overrides.listRepositoriesWithStatus) {
    github.listRepositoriesWithStatus = async (input = {}) => ({
      items: await overrides.listRepositories!(input),
      availability: available
    });
  }
  if (overrides.getAccountProfile && !overrides.getAccountProfileWithStatus) {
    github.getAccountProfileWithStatus = async (input = {}) => ({
      profile: await overrides.getAccountProfile!(input),
      availability: available
    });
  }
  if (overrides.listAccountRepositories && !overrides.listAccountRepositoriesWithStatus) {
    github.listAccountRepositoriesWithStatus = async (input = {}) => ({
      items: await overrides.listAccountRepositories!(input),
      availability: available
    });
  }
  if (overrides.listOrganizations && !overrides.listOrganizationsWithStatus) {
    github.listOrganizationsWithStatus = async (input = {}) => ({
      items: await overrides.listOrganizations!(input),
      availability: available
    });
  }
  if (overrides.listOrganizationTeams && !overrides.listOrganizationTeamsWithStatus) {
    github.listOrganizationTeamsWithStatus = async (input) => ({
      items: await overrides.listOrganizationTeams!(input),
      availability: available
    });
  }
  if (overrides.listAccountIssues && !overrides.listAccountIssuesWithStatus) {
    github.listAccountIssuesWithStatus = async (input = {}) => ({
      items: await overrides.listAccountIssues!(input),
      availability: available
    });
  }
  if (overrides.listAccountPullRequests && !overrides.listAccountPullRequestsWithStatus) {
    github.listAccountPullRequestsWithStatus = async (input = {}) => ({
      items: await overrides.listAccountPullRequests!(input),
      availability: available
    });
  }
  if (overrides.listNotifications && !overrides.listNotificationsWithStatus) {
    github.listNotificationsWithStatus = async (input = {}) => ({
      items: await overrides.listNotifications!(input),
      availability: available
    });
  }
  if (overrides.getRepository && !overrides.getRepositoryWithStatus) {
    github.getRepositoryWithStatus = async (input) => ({
      detail: await overrides.getRepository!(input),
      availability: available
    });
  }
  if (overrides.listBranches && !overrides.listBranchesWithStatus) {
    github.listBranchesWithStatus = async (input) => ({
      items: await overrides.listBranches!(input),
      availability: available
    });
  }
  if (overrides.listTags && !overrides.listTagsWithStatus) {
    github.listTagsWithStatus = async (input) => ({
      items: await overrides.listTags!(input),
      availability: available
    });
  }
  if (overrides.listTree && !overrides.listTreeWithStatus) {
    github.listTreeWithStatus = async (input) => ({
      tree: await overrides.listTree!(input),
      availability: available
    });
  }
  if (overrides.listContents && !overrides.listContentsWithStatus) {
    github.listContentsWithStatus = async (input) => ({
      items: await overrides.listContents!(input),
      availability: available
    });
  }
  if (overrides.getFileContent && !overrides.getFileContentWithStatus) {
    github.getFileContentWithStatus = async (input) => ({
      item: await overrides.getFileContent!(input),
      availability: available
    });
  }
  if (overrides.listCommits && !overrides.listCommitsWithStatus) {
    github.listCommitsWithStatus = async (input) => ({
      items: await overrides.listCommits!(input),
      availability: available
    });
  }
  if (overrides.listLabels && !overrides.listLabelsWithStatus) {
    github.listLabelsWithStatus = async (input) => ({
      items: await overrides.listLabels!(input),
      availability: available
    });
  }
  if (overrides.listAssignableUsers && !overrides.listAssignableUsersWithStatus) {
    github.listAssignableUsersWithStatus = async (input) => ({
      items: await overrides.listAssignableUsers!(input),
      availability: available
    });
  }
  if (overrides.listMilestones && !overrides.listMilestonesWithStatus) {
    github.listMilestonesWithStatus = async (input) => ({
      items: await overrides.listMilestones!(input),
      availability: available
    });
  }
  if (overrides.listIssues && !overrides.listIssuesWithStatus) {
    github.listIssuesWithStatus = async (input) => ({
      items: await overrides.listIssues!(input),
      availability: available
    });
  }
  if (overrides.getIssueDetail && !overrides.getIssueDetailWithStatus) {
    github.getIssueDetailWithStatus = async (input) => ({
      detail: await overrides.getIssueDetail!(input),
      availability: available
    });
  }
  if (overrides.listPullRequests && !overrides.listPullRequestsWithStatus) {
    github.listPullRequestsWithStatus = async (input) => ({
      items: await overrides.listPullRequests!(input),
      availability: available
    });
  }
  if (overrides.getPullRequestDetail && !overrides.getPullRequestDetailWithStatus) {
    github.getPullRequestDetailWithStatus = async (input) => ({
      detail: await overrides.getPullRequestDetail!(input),
      availability: available
    });
  }
  if (overrides.listDiscussions && !overrides.listDiscussionsWithStatus) {
    github.listDiscussionsWithStatus = async (input) => ({
      items: await overrides.listDiscussions!(input),
      availability: available
    });
  }
  if (overrides.listActions && !overrides.listActionsWithStatus) {
    github.listActionsWithStatus = async (input) => ({
      items: await overrides.listActions!(input),
      availability: available
    });
  }
  if (overrides.listWorkflows && !overrides.listWorkflowsWithStatus) {
    github.listWorkflowsWithStatus = async (input) => ({
      items: await overrides.listWorkflows!(input),
      availability: available
    });
  }
  if (overrides.getWorkflowRunDetail && !overrides.getWorkflowRunDetailWithStatus) {
    github.getWorkflowRunDetailWithStatus = async (input) => ({
      detail: await overrides.getWorkflowRunDetail!(input),
      availability: available
    });
  }
  if (overrides.listProjects && !overrides.listProjectsWithStatus) {
    github.listProjectsWithStatus = async (input) => ({
      items: await overrides.listProjects!(input),
      availability: available
    });
  }
  if (overrides.listReleases && !overrides.listReleasesWithStatus) {
    github.listReleasesWithStatus = async (input) => ({
      items: await overrides.listReleases!(input),
      availability: available
    });
  }
  if (overrides.listContributors && !overrides.listContributorsWithStatus) {
    github.listContributorsWithStatus = async (input) => ({
      items: await overrides.listContributors!(input),
      availability: available
    });
  }
  if (overrides.search && !overrides.searchWithStatus) {
    github.searchWithStatus = async (input) => ({
      items: await overrides.search!(input),
      availability: available
    });
  }

  return {
    ...mockControlApi,
    github
  };
}

export function installControlTestCleanup(): void {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.control;
    useUiStore.setState(defaultUiState);
  });
}
