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
  mockAccountProfile,
  mockAppState,
  mockContents,
  mockContributors,
  mockControlApi,
  mockDiscussions,
  mockGitHubSignInSession,
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
  vi.restoreAllMocks();
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

  it("refetches repository rows when the main process reports a SQLite repository update", async () => {
    let repositoryUpdate: Parameters<ControlApi["onGitHubRepositoriesUpdated"]>[0] = () => undefined;
    const refreshedRepository = {
      ...mockRepositories[0],
      id: "R_NarukeAlpha_blog",
      owner: "NarukeAlpha",
      name: "Blog",
      nameWithOwner: "NarukeAlpha/Blog"
    };
    const listRepositories = vi
      .fn<ControlApi["github"]["listRepositories"]>()
      .mockResolvedValueOnce([mockRepositories[0]])
      .mockResolvedValue([refreshedRepository]);

    useUiStore.setState({ ...defaultUiState, route: { kind: "repositories" } });
    renderControl({
      ...makeApi({ listRepositories }),
      onGitHubRepositoriesUpdated: (callback) => {
        repositoryUpdate = callback;
        return () => undefined;
      }
    });

    expect(await screen.findByRole("heading", { name: "Repositories" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /apple\/swift/i })).toBeInTheDocument();

    repositoryUpdate({ nameWithOwner: null });

    expect(await screen.findByRole("button", { name: /NarukeAlpha\/Blog/i })).toBeInTheDocument();
    expect(listRepositories).toHaveBeenCalledTimes(2);
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

  it("starts GitHub account sign-in from settings", async () => {
    const signInWithGitHub = vi.fn<ControlApi["signInWithGitHub"]>(async () => mockGitHubSignInSession);
    const getGitHubSignIn = vi
      .fn<ControlApi["getGitHubSignIn"]>()
      .mockResolvedValueOnce(mockGitHubSignInSession)
      .mockResolvedValueOnce({ ...mockGitHubSignInSession, status: "complete" });

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), signInWithGitHub, getGitHubSignIn });

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

    expect(signInWithGitHub).toHaveBeenCalledWith();
    expect(await screen.findByText("WDJB-MJHT")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open GitHub" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    });
  });

  it("keeps the GitHub device code visible when sign-in startup is slow", async () => {
    const signInWithGitHub = vi.fn<ControlApi["signInWithGitHub"]>(
      async () =>
        await new Promise((resolve) => {
          setTimeout(() => resolve(mockGitHubSignInSession), 350);
        })
    );

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), signInWithGitHub });

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

    expect(await screen.findByText("Enter the code in GitHub.")).toBeInTheDocument();
    expect(await screen.findByText("WDJB-MJHT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open GitHub" })).toBeInTheDocument();
  });

  it("does not expose manual GitHub credential fields in settings", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    await userEvent.click(await screen.findByTitle("Account settings"));

    expect(screen.queryByLabelText("GitHub token")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GitHub OAuth client ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GitHub OAuth client secret")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeInTheDocument();
  });

  it("shows app setup state when GitHub sign-in is not configured", async () => {
    const signInWithGitHub = vi.fn<ControlApi["signInWithGitHub"]>(async () => mockGitHubSignInSession);

    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi(),
      signInWithGitHub,
      getAppState: async () => ({
        ...mockAppState,
        github: {
          available: true,
          authenticated: false,
          signInConfigured: false,
          user: null,
          error: "GitHub sign-in is not configured in this build."
        },
        viewer: null
      })
    });

    await userEvent.click(await screen.findByTitle("Account settings"));

    expect(screen.getAllByText("GitHub sign-in is not configured in this build.").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));

    expect(signInWithGitHub).not.toHaveBeenCalled();
    expect(screen.getAllByText("GitHub sign-in is not configured in this build.").length).toBeGreaterThan(0);
  });

  it("does not fetch GitHub account data before authentication", async () => {
    const listRepositories = vi.fn<ControlApi["github"]["listRepositories"]>(async () => mockRepositories);
    const getAccountProfile = vi.fn<ControlApi["github"]["getAccountProfile"]>(async () => mockAccountProfile);
    const listAccountIssues = vi.fn<ControlApi["github"]["listAccountIssues"]>(async () => mockIssues);
    const listAccountPullRequests = vi.fn<ControlApi["github"]["listAccountPullRequests"]>(async () => mockPullRequests);

    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi({
        listRepositories,
        getAccountProfile,
        listAccountIssues,
        listAccountPullRequests
      }),
      getAppState: async () => ({
        ...mockAppState,
        github: {
          available: true,
          authenticated: false,
          signInConfigured: true,
          user: null,
          error: "Sign in with GitHub in Settings to load live GitHub data."
        },
        viewer: null
      })
    });

    expect(await screen.findByText("Sign in with GitHub in Settings to load live GitHub data.")).toBeInTheDocument();
    expect(listRepositories).not.toHaveBeenCalled();
    expect(getAccountProfile).not.toHaveBeenCalled();
    expect(listAccountIssues).not.toHaveBeenCalled();
    expect(listAccountPullRequests).not.toHaveBeenCalled();
  });

  it("signs out from settings", async () => {
    const clearGitHubToken = vi.fn<ControlApi["clearGitHubToken"]>(async () => mockAppState);

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), clearGitHubToken });

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(clearGitHubToken).toHaveBeenCalledTimes(1);
  });

  it("does not fetch inactive repository tabs when opening code", async () => {
    const getRepository = vi.fn<ControlApi["github"]["getRepository"]>(async () => ({
      ...mockRepository,
      readmeMarkdown: null
    }));
    const getReadme = vi.fn<ControlApi["github"]["getReadme"]>(async () => mockRepository.readmeMarkdown);
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
        getRepository,
        getReadme,
        listContents,
        listIssues,
        listPullRequests,
        listActions
      })
    );

    expect(await screen.findByRole("heading", { name: /apple \/ swift/i })).toBeInTheDocument();
    await waitFor(() => expect(listContents).toHaveBeenCalledTimes(1));
    expect(getReadme).toHaveBeenCalledWith({ owner: "apple", repo: "swift" });
    expect(await screen.findByText(/Swift is a powerful and intuitive/)).toBeInTheDocument();

    expect(listIssues).not.toHaveBeenCalled();
    expect(listPullRequests).not.toHaveBeenCalled();
    expect(listActions).not.toHaveBeenCalled();
  });

  it("opens file rows in the in-app code browser", async () => {
    const getFileContent = vi.fn<ControlApi["github"]["getFileContent"]>(async (input) => ({
      path: input.path,
      name: input.path.split("/").pop() ?? input.path,
      ref: input.ref ?? "main",
      content: "# README.md\n\nLoaded in Control.",
      htmlUrl: `https://github.com/apple/swift/blob/main/${input.path}`
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl(makeApi({ getFileContent }));

    const fileList = await waitFor(() => {
      const element = document.querySelector(".virtual-file-list");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await waitFor(() =>
      expect(within(fileList).getByRole("button", { name: /README\.md/i })).toBeInTheDocument()
    );

    await userEvent.click(within(fileList).getByRole("button", { name: /README\.md/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "codeBrowser",
        nameWithOwner: "apple/swift",
        path: "README.md",
        entryType: "file",
        ref: "main"
      });
    });
    expect(await screen.findByRole("heading", { name: "README.md" })).toBeInTheDocument();
    expect(await screen.findByText(/Loaded in Control/)).toBeInTheDocument();
    expect(getFileContent).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      path: "README.md",
      ref: "main"
    });
    expect(document.querySelector(".readme-mark")).toBeNull();
    expect(screen.queryByText("1,562 commits")).not.toBeInTheDocument();
  });

  it("creates issues, pull requests, and workflow dispatches from repository tabs", async () => {
    const mutate = vi.fn<ControlApi["github"]["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    const getIssueDetail = vi.fn<ControlApi["github"]["getIssueDetail"]>(
      mockControlApi.github.getIssueDetail
    );
    const getPullRequestDetail = vi.fn<ControlApi["github"]["getPullRequestDetail"]>(
      mockControlApi.github.getPullRequestDetail
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "issues" }
    });
    renderControl(makeApi({ mutate, getIssueDetail, getPullRequestDetail }));

    expect(await screen.findByText(/This issue reproduces/)).toBeInTheDocument();
    expect(getIssueDetail).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      issueNumber: mockIssues[0].number
    });

    await userEvent.click(await screen.findByRole("button", { name: "New issue" }));
    await userEvent.type(screen.getByPlaceholderText("Issue title"), "Bug report");
    await userEvent.type(screen.getByPlaceholderText("Describe the problem"), "Steps to reproduce");
    await userEvent.click(screen.getByRole("button", { name: /Create issue/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({
        action: "createIssue",
        owner: "apple",
        repo: "swift",
        payload: { title: "Bug report", body: "Steps to reproduce" }
      }, expect.anything())
    );

    await userEvent.click(screen.getByRole("button", { name: /^Pull requests/ }));
    expect(await screen.findByText(/This pull request updates/)).toBeInTheDocument();
    expect(getPullRequestDetail).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      pullNumber: mockPullRequests[0].number
    });
    await userEvent.click(await screen.findByRole("button", { name: "New pull request" }));
    await userEvent.type(screen.getByPlaceholderText("Pull request title"), "Feature branch");
    await userEvent.type(screen.getByPlaceholderText("compare branch"), "feature/demo");
    await userEvent.click(screen.getByRole("button", { name: /Create pull request/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({
        action: "createPullRequest",
        owner: "apple",
        repo: "swift",
        payload: {
          title: "Feature branch",
          head: "feature/demo",
          base: "main",
          body: ""
        }
      }, expect.anything())
    );

    await userEvent.click(screen.getByRole("button", { name: /^Actions/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Run workflow" }));
    await userEvent.type(screen.getByPlaceholderText("workflow file, name, or id"), "ci.yml");
    const workflowForm = screen.getByRole("heading", { name: "Run workflow" }).closest("form");
    expect(workflowForm).not.toBeNull();
    await userEvent.click(
      within(workflowForm as HTMLElement).getByRole("button", { name: /^Run workflow$/i })
    );

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({
        action: "dispatchWorkflow",
        owner: "apple",
        repo: "swift",
        payload: { workflowId: "ci.yml", ref: "main" }
      }, expect.anything())
    );
    expect(confirm).toHaveBeenCalledWith("Run dispatchWorkflow on apple/swift?");
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
