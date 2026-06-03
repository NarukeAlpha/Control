import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";
import type { RepoDetailInput, RepositoryDetail } from "@shared/github";
import { App } from "../../App";
import { AuthProvider } from "../../components/auth/AuthProvider";
import { mockControlApi } from "../../data/mock";
import { useUiStore } from "../../stores/uiStore";

export const defaultUiState = {
  route: { kind: "home" as const },
  selectedAreaId: null,
  selectedRepository: "apple/swift",
  selectedLocalRepository: null,
  settingsOpen: false
};

// Test-only shortcuts let older renderer tests provide item arrays while the factory adapts them to
// status-bearing IPC methods. They are not part of the renderer/preload API surface.
type GitHubRawReadTestApi = Omit<
  {
    getAccountProfile(
      input?: Parameters<ControlApi["github"]["getAccountProfileWithStatus"]>[0]
    ): Promise<
      NonNullable<Awaited<ReturnType<ControlApi["github"]["getAccountProfileWithStatus"]>>["profile"]>
    >;
    listRepositories(
      input?: Parameters<ControlApi["github"]["listRepositoriesWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listRepositoriesWithStatus"]>>["items"]>;
    listAccountRepositories(
      input?: Parameters<ControlApi["github"]["listAccountRepositoriesWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listAccountRepositoriesWithStatus"]>>["items"]>;
    listAccountContributions(
      input?: Parameters<ControlApi["github"]["listAccountContributionsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listAccountContributionsWithStatus"]>>["items"]>;
    listOrganizations(
      input?: Parameters<ControlApi["github"]["listOrganizationsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listOrganizationsWithStatus"]>>["items"]>;
    listOrganizationTeams(
      input: Parameters<ControlApi["github"]["listOrganizationTeamsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listOrganizationTeamsWithStatus"]>>["items"]>;
    listAccountIssues(
      input?: Parameters<ControlApi["github"]["listAccountIssuesWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listAccountIssuesWithStatus"]>>["items"]>;
    listAccountPullRequests(
      input?: Parameters<ControlApi["github"]["listAccountPullRequestsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listAccountPullRequestsWithStatus"]>>["items"]>;
    listNotifications(
      input?: Parameters<ControlApi["github"]["listNotificationsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listNotificationsWithStatus"]>>["items"]>;
    listBranches(
      input: Parameters<ControlApi["github"]["listBranchesWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listBranchesWithStatus"]>>["items"]>;
    listTags(
      input: Parameters<ControlApi["github"]["listTagsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listTagsWithStatus"]>>["items"]>;
    listTree(
      input: Parameters<ControlApi["github"]["listTreeWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listTreeWithStatus"]>>["tree"]>;
    listContents(
      input: Parameters<ControlApi["github"]["listContentsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listContentsWithStatus"]>>["items"]>;
    getFileContent(
      input: Parameters<ControlApi["github"]["getFileContentWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["getFileContentWithStatus"]>>["item"]>;
    listCommits(
      input: Parameters<ControlApi["github"]["listCommitsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listCommitsWithStatus"]>>["items"]>;
    listLabels(
      input: Parameters<ControlApi["github"]["listLabelsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listLabelsWithStatus"]>>["items"]>;
    listAssignableUsers(
      input: Parameters<ControlApi["github"]["listAssignableUsersWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listAssignableUsersWithStatus"]>>["items"]>;
    listMilestones(
      input: Parameters<ControlApi["github"]["listMilestonesWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listMilestonesWithStatus"]>>["items"]>;
    listIssues(
      input: Parameters<ControlApi["github"]["listIssuesWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listIssuesWithStatus"]>>["items"]>;
    getIssueDetail(
      input: Parameters<ControlApi["github"]["getIssueDetailWithStatus"]>[0]
    ): Promise<NonNullable<Awaited<ReturnType<ControlApi["github"]["getIssueDetailWithStatus"]>>["detail"]>>;
    listPullRequests(
      input: Parameters<ControlApi["github"]["listPullRequestsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listPullRequestsWithStatus"]>>["items"]>;
    getPullRequestDetail(
      input: Parameters<ControlApi["github"]["getPullRequestDetailWithStatus"]>[0]
    ): Promise<
      NonNullable<Awaited<ReturnType<ControlApi["github"]["getPullRequestDetailWithStatus"]>>["detail"]>
    >;
    listDiscussions(
      input: Parameters<ControlApi["github"]["listDiscussionsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listDiscussionsWithStatus"]>>["items"]>;
    listActions(
      input: Parameters<ControlApi["github"]["listActionsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listActionsWithStatus"]>>["items"]>;
    listWorkflows(
      input: Parameters<ControlApi["github"]["listWorkflowsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listWorkflowsWithStatus"]>>["items"]>;
    getWorkflowRunDetail(
      input: Parameters<ControlApi["github"]["getWorkflowRunDetailWithStatus"]>[0]
    ): Promise<
      NonNullable<Awaited<ReturnType<ControlApi["github"]["getWorkflowRunDetailWithStatus"]>>["detail"]>
    >;
    listProjects(
      input: Parameters<ControlApi["github"]["listProjectsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listProjectsWithStatus"]>>["items"]>;
    listReleases(
      input: Parameters<ControlApi["github"]["listReleasesWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listReleasesWithStatus"]>>["items"]>;
    listContributors(
      input: Parameters<ControlApi["github"]["listContributorsWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["listContributorsWithStatus"]>>["items"]>;
    search(
      input: Parameters<ControlApi["github"]["searchWithStatus"]>[0]
    ): Promise<Awaited<ReturnType<ControlApi["github"]["searchWithStatus"]>>["items"]>;
  },
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
        <AuthProvider>
          <App />
        </AuthProvider>
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
  if (overrides.listAccountContributions && !overrides.listAccountContributionsWithStatus) {
    github.listAccountContributionsWithStatus = async (input = {}) => ({
      items: await overrides.listAccountContributions!(input),
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
