import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  mockIssues,
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
  it("opens repositories from the sidebar pinned list", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    await userEvent.click(await screen.findByRole("button", { name: /^apple\/swift/ }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "code"
      });
    });
    expect(await screen.findByRole("heading", { name: /apple \/ swift/i })).toBeInTheDocument();
  });

  it("opens repositories from home activity cards", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    const homeActivity = await screen.findByRole("heading", { name: "Latest repository activity" });
    const homePanel = homeActivity.closest(".home-panel");
    expect(homePanel).not.toBeNull();

    await waitFor(() =>
      expect(within(homePanel as HTMLElement).getByRole("button", { name: /apple\/swift/i })).toBeInTheDocument()
    );
    await userEvent.click(within(homePanel as HTMLElement).getByRole("button", { name: /apple\/swift/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "code"
      });
    });
  });

  it("opens repositories from the repositories surface", async () => {
    useUiStore.setState({ ...defaultUiState, route: { kind: "repositories" } });
    renderControl(makeApi());

    expect(await screen.findByRole("heading", { name: "Repositories" })).toBeInTheDocument();
    const collection = document.querySelector(".collection-view");
    expect(collection).not.toBeNull();
    await waitFor(() =>
      expect(within(collection as HTMLElement).getByRole("button", { name: /apple\/swift/i })).toBeInTheDocument()
    );
    await userEvent.click(within(collection as HTMLElement).getByRole("button", { name: /apple\/swift/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "code"
      });
    });
  });

  it("shortens repository names owned by the authenticated viewer", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(
      makeApi({
        listRepositories: async () => [
          {
            ...mockRepositories[0],
            id: "R_NarukeAlpha_blog",
            owner: "NarukeAlpha",
            name: "blog",
            nameWithOwner: "NarukeAlpha/blog"
          }
        ],
        getAccountProfile: async () => ({
          ...mockAppState.viewer!,
          id: "U_NarukeAlpha",
          login: "NarukeAlpha",
          name: "NarukeAlpha",
          htmlUrl: "https://github.com/NarukeAlpha",
          bio: null,
          company: null,
          location: null,
          websiteUrl: null,
          followers: 0,
          following: 0,
          repositoryCount: 1,
          starredRepositoryCount: 0,
          status: null,
          pinnedRepositories: [
            {
              ...mockRepositories[0],
              id: "R_NarukeAlpha_blog",
              owner: "NarukeAlpha",
              name: "blog",
              nameWithOwner: "NarukeAlpha/blog"
            }
          ]
        })
      })
    );

    expect(await screen.findByText("Blog")).toBeInTheDocument();
    expect(screen.queryByText("NarukeAlpha/blog")).not.toBeInTheDocument();
  });

  it("opens repository settings on GitHub instead of rendering an in-app settings tab", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl({ ...makeApi(), openExternal });

    await userEvent.click(await screen.findByTitle("Repository settings"));

    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple/swift/settings");
  });

  it("does not fetch inactive repository tabs when opening code", async () => {
    const listContents = vi.fn<ControlApi["github"]["listContents"]>(async () => mockContents);
    const listIssues = vi.fn<ControlApi["github"]["listIssues"]>(async () => mockIssues);
    const listPullRequests = vi.fn<ControlApi["github"]["listPullRequests"]>(async () => mockPullRequests);
    const listActions = vi.fn<ControlApi["github"]["listActions"]>(async () => mockActions);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl(
      makeApi({
        listContents,
        listIssues,
        listPullRequests,
        listActions
      })
    );

    expect(await screen.findByRole("heading", { name: /apple \/ swift/i })).toBeInTheDocument();
    await waitFor(() => expect(listContents).toHaveBeenCalledTimes(1));

    expect(listIssues).not.toHaveBeenCalled();
    expect(listPullRequests).not.toHaveBeenCalled();
    expect(listActions).not.toHaveBeenCalled();
  });

  it("opens file rows with GitHub blob URLs for the repository branch", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl({ ...makeApi(), openExternal });

    const fileList = await waitFor(() => {
      const element = document.querySelector(".virtual-file-list");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await waitFor(() =>
      expect(within(fileList).getByRole("button", { name: /README\.md/i })).toBeInTheDocument()
    );

    await userEvent.click(within(fileList).getByRole("button", { name: /README\.md/i }));

    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple/swift/blob/main/README.md");
    expect(document.querySelector(".readme-mark")).toBeNull();
    expect(screen.queryByText("1,562 commits")).not.toBeInTheDocument();
  });

  it("moves from collection navigation back into a repository route when a repository is selected from search", async () => {
    useUiStore.setState({ ...defaultUiState, route: { kind: "repositories" } });
    renderControl(makeApi());

    expect(await screen.findByRole("heading", { name: "Repositories" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search or jump to"), "apple");
    await waitFor(() => expect(document.querySelector(".search-popover")).not.toBeNull());
    await userEvent.click(
      within(document.querySelector(".search-popover") as HTMLElement).getByRole("button", {
        name: /apple\/swift/i
      })
    );

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
    expect(screen.getByText("Open issues")).toBeInTheDocument();
    expect(screen.getByText("Open PRs")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Latest repository activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your work" })).toBeInTheDocument();
    expect(screen.queryByText("Followers")).not.toBeInTheDocument();
    expect(screen.queryByText("Following")).not.toBeInTheDocument();
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
      route: { kind: "repository", nameWithOwner: forkRepository.nameWithOwner, tab: "code" },
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

    const tabs = document.querySelector(".repo-tabs");

    expect(tabs).not.toBeNull();
    expect(within(tabs as HTMLElement).getByRole("button", { name: /Issues\s*7/i })).toBeInTheDocument();
  });

  it.todo("shows parent and source repository counts only in fork-context UI, never as primary fork counts");
});
