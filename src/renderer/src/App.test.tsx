import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { ControlApi } from "@shared/ipc";
import type { RepositoryDetail } from "@shared/github";
import { App } from "./App";
import {
  mockActions,
  mockAppState,
  mockContents,
  mockContributors,
  mockControlApi,
  mockDiscussions,
  mockProjects,
  mockPullRequests,
  mockReleases,
  mockRepositories,
  mockRepository
} from "./data/mock";
import { useUiStore } from "./stores/uiStore";

const defaultUiState = {
  route: { kind: "home" as const },
  selectedRepository: "apple/swift",
  settingsOpen: false
};

function renderControl(api: ControlApi): void {
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

function makeApi(overrides: Partial<ControlApi["github"]> = {}): ControlApi {
  return {
    ...mockControlApi,
    github: {
      ...mockControlApi.github,
      ...overrides
    }
  };
}

afterEach(() => {
  cleanup();
  delete window.control;
  useUiStore.setState(defaultUiState);
});

describe("Control renderer routing", () => {
  it("moves from collection navigation back into a repository route when a repository is selected from search", async () => {
    useUiStore.setState({ ...defaultUiState, route: { kind: "globalIssues" } });
    renderControl(makeApi());

    expect(await screen.findByRole("heading", { name: "Issues" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search or jump to"), "apple");
    await userEvent.click(await screen.findByRole("button", { name: /apple\/swift/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "code"
      });
      expect(useUiStore.getState().selectedRepository).toBe("apple/swift");
    });
  });

  it("renders Home as the authenticated account dashboard instead of the selected repository page", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    expect(await screen.findByRole("heading", { name: "Ashley Rico" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /apple \/ swift/i })).not.toBeInTheDocument();
  });
});

describe("fork repository count contracts", () => {
  it("uses the currently opened fork repository issue count in repository insights", async () => {
    const forkRepository: RepositoryDetail = {
      ...mockRepository,
      id: "R_NarukeAlpha_swift_fork",
      owner: "NarukeAlpha",
      name: "swift-fork",
      nameWithOwner: "NarukeAlpha/swift-fork",
      description: "Fork of apple/swift",
      isFork: true,
      stargazerCount: 3,
      forkCount: 1,
      watcherCount: 2,
      openIssuesCount: 7,
      counts: {
        ...mockRepository.counts,
        openIssues: 7,
        openPullRequests: 2,
        forks: 1,
        stars: 3,
        watchers: 2
      },
      htmlUrl: "https://github.com/NarukeAlpha/swift-fork"
    };

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: forkRepository.nameWithOwner, tab: "insights" },
      selectedRepository: forkRepository.nameWithOwner
    });

    renderControl(
      makeApi({
        listRepositories: async () => [
          ...mockRepositories,
          {
            ...forkRepository,
            avatarUrl: mockRepository.avatarUrl,
            defaultBranch: mockRepository.defaultBranch
          }
        ],
        getRepository: async () => forkRepository,
        listIssues: async () => [],
        listPullRequests: async () => mockPullRequests,
        listDiscussions: async () => mockDiscussions,
        listActions: async () => mockActions,
        listProjects: async () => mockProjects,
        listReleases: async () => mockReleases,
        listContributors: async () => mockContributors,
        listContents: async () => mockContents,
        getViewer: async () => mockAppState.viewer!
      })
    );

    expect(await screen.findByRole("heading", { name: /NarukeAlpha \/ swift-fork/i })).toBeInTheDocument();

    const openIssuesLabel = screen.getByText("Open issues");
    const openIssuesTile = openIssuesLabel.closest(".metric-tile");

    expect(openIssuesTile).not.toBeNull();
    expect(within(openIssuesTile as HTMLElement).getByText("7")).toBeInTheDocument();
  });

  it.todo("shows parent and source repository counts only in fork-context UI, never as primary fork counts");
});
