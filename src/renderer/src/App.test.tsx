import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";
import type { AreaFileContent, AreaRepositorySummary } from "@shared/areas";
import type { RepositoryDetail, RepositoryTabPreference, RepositoryTabPreferenceKey } from "@shared/github";
import type { LocalRecentItem } from "@shared/local";
import {
  mockActions,
  mockAccountContributions,
  mockAccountProfile,
  mockAssignableUsers,
  mockAppState,
  mockBranchProtection,
  mockBranches,
  mockCodeScanningAlerts,
  mockContents,
  mockContributors,
  mockControlApi,
  mockDependabotAlerts,
  mockDiscussions,
  mockGitHubSignInSession,
  mockIssues,
  mockLabels,
  mockNotifications,
  mockOrganizations,
  mockProjects,
  mockPullRequests,
  mockReleases,
  mockRepositories,
  mockRepository,
  mockSecretScanningAlerts,
  mockTags,
  mockTeams,
  mockTree,
  mockWorkflowRunDetail
} from "./data/mock";
import { useUiStore } from "./stores/uiStore";
import {
  githubArea,
  localArea,
  localGitRepository,
  localJjRepository,
  localWorkspace,
  makeLocalRepositoryDetail,
  sshArea
} from "./test/factories/areas";
import {
  defaultUiState,
  installControlTestCleanup,
  makeApi,
  renderControl,
  type GitHubTestApi
} from "./test/factories/controlApi";
import {
  clickCommandPaletteOption,
  openAddRepositoryDialog,
  openCommandPalette
} from "./test/factories/commandPalette";

installControlTestCleanup();

function appStateWithRepositoryTabPreferences(
  preferences: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>
) {
  return {
    ...mockAppState,
    settings: {
      ...mockAppState.settings,
      repositoryTabPreferences: {
        ...mockAppState.settings.repositoryTabPreferences,
        ...preferences
      }
    }
  };
}

async function acceptRepositoryMutationConfirmation(title: string): Promise<void> {
  const dialog = await screen.findByRole("dialog", { name: title });
  expect(within(dialog).getByText("Run this GitHub mutation on apple/swift?")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Run mutation" }));
}

describe("Control renderer routing", () => {
  it("opens repositories from the sidebar pinned list", async () => {
    useUiStore.setState(defaultUiState);
    const listRepositoryPins = vi.fn<ControlApi["listRepositoryPins"]>(async () => [
      {
        areaId: "github:default",
        repositoryId: "github:default:apple/swift",
        workspaceId: null,
        nameWithOwner: "apple/swift",
        createdAt: "2026-05-01T00:00:00.000Z"
      }
    ]);

    renderControl({
      ...makeApi(),
      listRepositoryPins
    });

    await userEvent.click(await screen.findByRole("button", { name: /apple\/swift/i }));

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

    const homeActivity = await screen.findByRole("heading", { name: "Latest activity" });
    const homePanel = homeActivity.closest(".home-panel");
    expect(homePanel).not.toBeNull();

    await waitFor(() =>
      expect(
        within(homePanel as HTMLElement).getByRole("button", { name: /apple\/swift/i })
      ).toBeInTheDocument()
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

  it("does not advertise stale repository cache state on Home when cached rows are available", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(
      makeApi({
        listRepositoriesWithStatus: async () => ({
          items: mockRepositories,
          availability: {
            status: "stale",
            message: "Showing cached repository data while Control refreshes it from GitHub."
          }
        })
      })
    );

    const homeActivity = await screen.findByRole("heading", { name: "Latest activity" });
    const homePanel = homeActivity.closest(".home-panel");
    expect(homePanel).not.toBeNull();

    expect(
      await within(homePanel as HTMLElement).findByRole("button", { name: /apple\/swift/i })
    ).toBeInTheDocument();
    expect(within(homePanel as HTMLElement).queryByText(/showing cached data/i)).not.toBeInTheDocument();
  });

  it("opens repositories from the repositories surface", async () => {
    useUiStore.setState({ ...defaultUiState, route: { kind: "repositories" } });
    renderControl(makeApi());

    expect(await screen.findByRole("heading", { name: "Repositories" })).toBeInTheDocument();
    const collection = document.querySelector(".collection-view");
    expect(collection).not.toBeNull();
    await waitFor(() =>
      expect(
        within(collection as HTMLElement).getByRole("button", { name: /apple\/swift/i })
      ).toBeInTheDocument()
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

  it("renders selected local Area repositories without starting the GitHub directory query", async () => {
    const listRepositoriesWithStatus = vi.fn<ControlApi["github"]["listRepositoriesWithStatus"]>(
      async () => ({
        items: mockRepositories,
        availability: { status: "available", message: null }
      })
    );
    const listAreaRepositories = vi.fn<ControlApi["areas"]["listRepositories"]>(async () => [
      localGitRepository
    ]);

    useUiStore.setState({
      ...defaultUiState,
      selectedAreaId: localArea.id,
      route: { kind: "repositories" }
    });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: listAreaRepositories
      },
      github: {
        ...mockControlApi.github,
        listRepositoriesWithStatus
      }
    });

    expect(
      await screen.findByRole("heading", { name: "Laptop Projects Local repositories" })
    ).toBeInTheDocument();
    const collection = document.querySelector(".collection-view");
    expect(collection).not.toBeNull();
    await waitFor(() =>
      expect(
        within(collection as HTMLElement).getAllByRole("button", { name: /Control App/i }).length
      ).toBeGreaterThan(0)
    );
    expect(listAreaRepositories).toHaveBeenCalledWith({ areaId: localArea.id });
    expect(listRepositoriesWithStatus).not.toHaveBeenCalled();
  });

  it("refreshes the repository list from the repositories surface", async () => {
    const refreshedRepository = {
      ...mockRepositories[0],
      id: "R_apple_refreshed",
      name: "refreshed",
      nameWithOwner: "apple/refreshed",
      description: "Repository loaded after manual refresh."
    };
    const listRepositories = vi
      .fn<GitHubTestApi["listRepositories"]>()
      .mockResolvedValueOnce([mockRepositories[0]])
      .mockResolvedValue([refreshedRepository]);

    useUiStore.setState({ ...defaultUiState, route: { kind: "repositories" } });
    renderControl(makeApi({ listRepositories }));

    expect(await screen.findByRole("heading", { name: "Repositories" })).toBeInTheDocument();
    await openCommandPalette();
    await clickCommandPaletteOption(/^Refresh repositories/i);

    expect(await screen.findByRole("button", { name: /apple\/refreshed/i })).toBeInTheDocument();
    expect(listRepositories).toHaveBeenCalledTimes(2);
  });

  it("renders GitHub organizations from provider records", async () => {
    const listOrganizations = vi.fn<GitHubTestApi["listOrganizations"]>(async () => mockOrganizations);
    const listOrganizationTeams = vi.fn<GitHubTestApi["listOrganizationTeams"]>(async () => mockTeams);
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({ ...defaultUiState, route: { kind: "organizations" } });
    renderControl({
      ...makeApi({ listOrganizations, listOrganizationTeams }),
      openExternal
    });

    expect(await screen.findByRole("heading", { name: "Organizations" })).toBeInTheDocument();
    await waitFor(() =>
      expect(listOrganizations).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, cacheOnly: false }))
    );

    const collection = document.querySelector(".collection-view");
    expect(collection).not.toBeNull();
    const organizationRow = await within(collection as HTMLElement).findByRole("button", {
      name: /Apple.*188 repositories.*14 teams.*member/i
    });

    expect(within(organizationRow).getByText("Open source projects from Apple.")).toBeInTheDocument();
    await waitFor(() =>
      expect(listOrganizationTeams).toHaveBeenCalledWith(
        expect.objectContaining({ org: "apple", limit: 30, cacheOnly: false })
      )
    );
    expect(await screen.findByText("Compiler")).toBeInTheDocument();
    expect(screen.getByText(/compiler · closed · push · 18 members · 12 repositories/i)).toBeInTheDocument();
    expect(screen.getByText("Maintains the Swift compiler and language implementation.")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Open apple on GitHub" })[0]);

    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple");
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
      .fn<GitHubTestApi["listRepositories"]>()
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
        listAccountContributions: async () => [
          {
            ...mockAccountContributions[0],
            id: "commit-contribution-NarukeAlpha/blog",
            repositoryNameWithOwner: "NarukeAlpha/blog",
            repositoryUrl: "https://github.com/NarukeAlpha/blog"
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

    expect((await screen.findAllByText("Blog")).length).toBeGreaterThan(0);
    expect(screen.queryByText("NarukeAlpha/blog")).not.toBeInTheDocument();
  });

  it("renders local repository pins in the sidebar and Home dashboard", async () => {
    const listRepositoryPins = vi.fn<ControlApi["listRepositoryPins"]>(async () => [
      {
        areaId: "github:default",
        repositoryId: "github:default:local/pinned",
        workspaceId: null,
        nameWithOwner: "local/pinned",
        createdAt: "2026-05-01T00:00:00.000Z"
      }
    ]);

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), listRepositoryPins });

    expect(await screen.findByRole("heading", { name: "Pinned repositories" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /local\/pinned/i }).length).toBeGreaterThan(0);
    expect(listRepositoryPins).toHaveBeenCalled();
  });

  it("renders the topbar Area selector, selects a local Area, and adds a local Area from settings", async () => {
    const selectArea = vi.fn<ControlApi["areas"]["selectArea"]>(async () => [
      { ...githubArea, selected: false },
      { ...localArea, selected: true }
    ]);
    const openLocalFolderPicker = vi.fn<ControlApi["areas"]["openLocalFolderPicker"]>(
      async () => "/Users/ashley/Projects/new-area"
    );
    const createLocalArea = vi.fn<ControlApi["areas"]["createLocalArea"]>(async (input) => ({
      ...localArea,
      id: "local:new-area",
      label: "new-area",
      rootPath: input.rootPath,
      subtitle: input.rootPath,
      selected: true,
      repositoryCount: 0
    }));
    const listRepositories = vi.fn<ControlApi["areas"]["listRepositories"]>(async () => [
      localGitRepository,
      localJjRepository
    ]);

    useUiStore.setState({ ...defaultUiState, selectedAreaId: "github:default" });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [githubArea, localArea],
        selectArea,
        listRepositories,
        openLocalFolderPicker,
        createLocalArea
      }
    });

    expect(await screen.findByRole("button", { name: /Select Area/ })).toBeInTheDocument();
    expect(screen.queryByText(/^Area$/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Select Area/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Laptop Projects/i }));

    await waitFor(() => expect(selectArea).toHaveBeenCalledWith(localArea.id));
    await waitFor(() => expect(listRepositories).toHaveBeenCalledWith({ areaId: localArea.id }));
    expect(await screen.findByRole("heading", { name: "Laptop Projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Control App/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Control JJ/i })).toBeInTheDocument();

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Add local Area" }));

    await waitFor(() => {
      expect(openLocalFolderPicker).toHaveBeenCalledWith();
      expect(createLocalArea).toHaveBeenCalledWith({ rootPath: "/Users/ashley/Projects/new-area" });
      expect(useUiStore.getState().selectedAreaId).toBe("local:new-area");
    });
  });

  it("hides GitHub-only sidebar routes for local Areas", async () => {
    useUiStore.setState({ ...defaultUiState, selectedAreaId: localArea.id });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: async () => [localGitRepository, localJjRepository]
      }
    });

    expect(await screen.findByRole("heading", { name: "Laptop Projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repositories" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Organizations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mailbox" })).not.toBeInTheDocument();
  });

  it("hides GitHub-only sidebar routes for SSH Areas", async () => {
    useUiStore.setState({ ...defaultUiState, selectedAreaId: sshArea.id });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...sshArea, selected: true }
        ],
        listRepositories: async () => [{ ...localGitRepository, id: "ssh-repo-control", areaId: sshArea.id }]
      }
    });

    expect(await screen.findByRole("heading", { name: "Delta WSL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repositories" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Organizations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mailbox" })).not.toBeInTheDocument();
  });

  it("opens an in-app SSH Area dialog from account settings", async () => {
    const createSshArea = vi.fn<ControlApi["areas"]["createSshArea"]>(async (input) => ({
      ...localArea,
      id: "ssh:delta-wsl",
      kind: "ssh",
      label: input.label ?? input.host,
      subtitle: `${input.host}:${input.rootPath}`,
      rootPath: input.rootPath,
      selected: true,
      repositoryCount: 0,
      gateway: {
        status: "starting",
        version: null,
        apiUrl: null,
        serviceName: null,
        lastStartedAt: null,
        lastSeenAt: null,
        failureCode: null,
        message: "Starting remote gateway."
      }
    }));

    useUiStore.setState({ ...defaultUiState, selectedAreaId: "github:default" });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [githubArea],
        createSshArea
      }
    });

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Add SSH Area" }));

    const dialogTitle = await screen.findByRole("heading", { name: "Add SSH Area" });
    const dialog = dialogTitle.closest("form");
    expect(dialog).not.toBeNull();
    expect(within(dialog as HTMLElement).getByLabelText("Host")).toHaveValue("delta-wsl");
    expect(within(dialog as HTMLElement).getByLabelText("Root path")).toHaveValue("~/controltest");
    expect(createSshArea).not.toHaveBeenCalled();

    await userEvent.click(within(dialog as HTMLElement).getByRole("button", { name: "Add SSH Area" }));

    await waitFor(() => {
      expect(createSshArea).toHaveBeenCalledWith({
        host: "delta-wsl",
        rootPath: "~/controltest",
        username: null,
        label: "delta-wsl",
        port: null
      });
      expect(useUiStore.getState().selectedAreaId).toBe("ssh:delta-wsl");
    });
  });

  it("edits an SSH Area from the topbar action menu", async () => {
    const updateArea = vi.fn<ControlApi["areas"]["updateArea"]>(async (input) => ({
      ...sshArea,
      label: input.label ?? sshArea.label,
      rootPath: input.rootPath ?? sshArea.rootPath,
      subtitle: `${input.username ? `${input.username}@` : ""}${input.host}:${input.port}:${input.rootPath}`
    }));

    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [githubArea, sshArea],
        updateArea
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: /Select Area/ }));
    expect(await screen.findByRole("menuitem", { name: /Delta WSL/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Area actions for Delta WSL" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit Area" }));

    const dialog = await screen.findByRole("heading", { name: "Edit Area" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Label")).toHaveValue("Delta WSL");
    expect(screen.getByLabelText("Host")).toHaveValue("delta-wsl");
    expect(screen.getByLabelText("Root path")).toHaveValue("~/controltest");
    expect(screen.getByLabelText("Username")).toHaveValue("alpha");
    expect(screen.getByLabelText("Port")).toHaveValue("2222");

    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Area" }));

    await waitFor(() =>
      expect(updateArea).toHaveBeenCalledWith({
        areaId: sshArea.id,
        label: "delta-wsl",
        host: "delta-wsl",
        rootPath: "~/controltest",
        username: "alpha",
        port: 2222
      })
    );
  });

  it("requires the Area delete action to be hovered until armed before confirmation", async () => {
    const removeArea = vi.fn<ControlApi["areas"]["removeArea"]>(async () => [
      { ...githubArea, selected: true }
    ]);
    useUiStore.setState({ ...defaultUiState, selectedAreaId: localArea.id });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        removeArea
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: /Select Area/ }));
    expect(await screen.findByRole("menuitem", { name: /Laptop Projects/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Area actions for Laptop Projects" }));
    const deleteAction = screen.getByRole("menuitem", { name: "Delete Area" });

    expect(deleteAction).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(deleteAction);
    expect(screen.queryByRole("heading", { name: "Delete Area" })).not.toBeInTheDocument();

    vi.useFakeTimers();
    try {
      fireEvent.mouseEnter(deleteAction);
      act(() => {
        vi.advanceTimersByTime(2_999);
      });
      expect(deleteAction).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(deleteAction);
      expect(screen.queryByRole("heading", { name: "Delete Area" })).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(deleteAction).toHaveAttribute("aria-disabled", "false");
      expect(screen.queryByRole("heading", { name: "Delete Area" })).not.toBeInTheDocument();

      fireEvent.click(deleteAction);
      expect(screen.getByText("Are you sure you want to delete this area?")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(screen.getByRole("button", { name: "Delete Area" }));

    await waitFor(() => expect(removeArea).toHaveBeenCalledWith(localArea.id));
    expect(useUiStore.getState().selectedAreaId).toBe(githubArea.id);
  });

  it("refetches local Area repositories from Area repository update events", async () => {
    let areaRepositoryUpdated: Parameters<ControlApi["onAreaRepositoryUpdated"]>[0] = () => undefined;
    const listRepositories = vi
      .fn<ControlApi["areas"]["listRepositories"]>()
      .mockResolvedValueOnce([localGitRepository])
      .mockResolvedValue([localJjRepository]);

    useUiStore.setState({ ...defaultUiState, selectedAreaId: localArea.id });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories
      },
      onAreaRepositoryUpdated: (callback) => {
        areaRepositoryUpdated = callback;
        return () => undefined;
      }
    });

    expect(await screen.findByRole("heading", { name: "Laptop Projects" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Open Control App/i })).toBeInTheDocument();

    areaRepositoryUpdated({ areaId: localArea.id, repositoryId: localJjRepository.id });

    expect(await screen.findByRole("button", { name: /Open Control JJ/i })).toBeInTheDocument();
    expect(listRepositories).toHaveBeenCalledWith({ areaId: localArea.id });
    expect(listRepositories).toHaveBeenCalledTimes(2);
  });

  it("opens local repository routes and renders JJ badges workspaces stale state and binary files", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);
    const getRepository = vi.fn<ControlApi["areas"]["getRepository"]>(async () =>
      makeLocalRepositoryDetail(localJjRepository)
    );
    const listContents = vi.fn<ControlApi["areas"]["listContents"]>(async () => [
      { name: "README.md", path: "README.md", type: "file", size: 128, updatedAt: null },
      { name: "logo.png", path: "logo.png", type: "file", size: 2048, updatedAt: null },
      { name: "missing.txt", path: "missing.txt", type: "file", size: null, updatedAt: null }
    ]);
    const getFileContent = vi.fn<ControlApi["areas"]["getFileContent"]>(async (input) => {
      const files: Record<string, AreaFileContent> = {
        "logo.png": {
          path: "logo.png",
          kind: "binary",
          text: null,
          encoding: null,
          size: 2048,
          message: "Binary file preview is unavailable."
        },
        "missing.txt": {
          path: "missing.txt",
          kind: "unavailable",
          text: null,
          encoding: null,
          size: null,
          message: "Local file content is unavailable."
        }
      };
      return (
        files[input.path] ?? {
          path: input.path,
          kind: "text",
          text: "# Local README",
          encoding: "utf-8",
          size: 14,
          message: null
        }
      );
    });

    useUiStore.setState({ ...defaultUiState, selectedAreaId: localArea.id });
    renderControl({
      ...makeApi(),
      recordRecentItem,
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: async () => [localJjRepository],
        getRepository,
        listWorkspaces: async () => [localWorkspace],
        listContents,
        getFileContent
      }
    });

    await userEvent.click(await screen.findByRole("button", { name: /Open Control JJ/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        tab: "overview",
        workspaceId: localWorkspace.id,
        path: null
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "local",
        itemKey: `${localArea.id}:${localJjRepository.id}`,
        metadata: { vcs: "jj" }
      }),
      expect.anything()
    );
    expect((await screen.findAllByText("JJ")).length).toBeGreaterThan(0);
    expect(screen.getByText("Git-backed")).toBeInTheDocument();
    expect(screen.getByText("Colocated")).toBeInTheDocument();
    expect(screen.getByText("GitHub connected")).toBeInTheDocument();
    expect(screen.getAllByText("review-stack").length).toBeGreaterThan(0);
    expect(screen.getByText("Stale")).toBeInTheDocument();

    const tabs = document.querySelector(".repo-tabs") as HTMLElement;
    await userEvent.click(within(tabs).getByRole("button", { name: /^Code$/ }));
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        tab: "code",
        workspaceId: localWorkspace.id,
        path: null
      })
    );
    await userEvent.click(await screen.findByRole("button", { name: /logo\.png/i }));

    await waitFor(() =>
      expect(getFileContent).toHaveBeenCalledWith({
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        workspaceId: localWorkspace.id,
        path: "logo.png"
      })
    );
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        tab: "code",
        workspaceId: localWorkspace.id,
        path: "logo.png"
      })
    );
    expect(await screen.findByText("Binary file preview is unavailable.")).toBeInTheDocument();

    await userEvent.click(within(tabs).getByRole("button", { name: /^Overview$/ }));
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        tab: "overview",
        workspaceId: localWorkspace.id,
        path: "logo.png"
      })
    );
    await userEvent.click(within(tabs).getByRole("button", { name: /^Code$/ }));
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        tab: "code",
        workspaceId: localWorkspace.id,
        path: "logo.png"
      })
    );
    await userEvent.click(await screen.findByRole("button", { name: /missing\.txt/i }));
    await waitFor(() =>
      expect(getFileContent).toHaveBeenCalledWith(
        expect.objectContaining({ path: "missing.txt", areaId: localArea.id })
      )
    );
    expect(await screen.findByText("Local file content is unavailable.")).toBeInTheDocument();
  });

  it("renders JJ unavailable state and disables JJ-derived tabs", async () => {
    const unavailableRepository: AreaRepositorySummary = {
      ...localJjRepository,
      connection: null,
      health: { status: "error", message: "JJ is unavailable.", checkedAt: "2026-05-02T00:00:00.000Z" }
    };
    const unavailableWorkspace = {
      ...localWorkspace,
      isStale: true,
      health: {
        status: "error" as const,
        message: "JJ is unavailable.",
        checkedAt: "2026-05-02T00:00:00.000Z"
      }
    };

    useUiStore.setState({
      ...defaultUiState,
      selectedAreaId: localArea.id,
      route: {
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: unavailableRepository.id,
        workspaceId: unavailableWorkspace.id,
        tab: "overview",
        path: null
      }
    });
    renderControl({
      ...makeApi(),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: async () => [unavailableRepository],
        getRepository: async () => ({
          ...makeLocalRepositoryDetail(unavailableRepository),
          workspaces: [unavailableWorkspace]
        }),
        listWorkspaces: async () => [unavailableWorkspace]
      }
    });

    expect(await screen.findByRole("heading", { name: "Control JJ" })).toBeInTheDocument();
    expect(screen.getAllByText("JJ is unavailable.").length).toBeGreaterThan(0);
    expect(screen.getByText("Stale")).toBeInTheDocument();

    const tabs = document.querySelector(".repo-tabs") as HTMLElement;
    expect(within(tabs).getByRole("button", { name: /^Bookmarks$/ })).toBeDisabled();
    expect(within(tabs).getByRole("button", { name: /^Operations$/ })).toBeDisabled();
  });

  it("opens connected local repositories in GitHub Area and external GitHub link", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      selectedAreaId: localArea.id,
      route: {
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localGitRepository.id,
        workspaceId: null,
        tab: "overview",
        path: null
      }
    });
    renderControl({
      ...makeApi(),
      openExternal,
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: async () => [localGitRepository],
        getRepository: async () => makeLocalRepositoryDetail(localGitRepository),
        listWorkspaces: async () => []
      }
    });

    expect(await screen.findByRole("heading", { name: "Control App" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open on GitHub" }));
    expect(openExternal).toHaveBeenCalledWith("https://github.com/NarukeAlpha/control");

    await userEvent.click(screen.getByRole("button", { name: "Open in GitHub Area" }));
    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "NarukeAlpha/control",
        tab: "code"
      });
    });
  });

  it("routes connected local repository GitHub tabs through area enrichment APIs", async () => {
    const listGitHubIssues = vi.fn<ControlApi["areas"]["listGitHubIssues"]>(async () => ({
      items: mockIssues,
      availability: { status: "available", message: null }
    }));
    const listGitHubPullRequests = vi.fn<ControlApi["areas"]["listGitHubPullRequests"]>(async () => ({
      items: mockPullRequests,
      availability: { status: "available", message: null }
    }));
    const listGitHubActions = vi.fn<ControlApi["areas"]["listGitHubActions"]>(async () => ({
      items: mockActions,
      availability: { status: "available", message: null }
    }));
    const githubListIssues = vi.fn<GitHubTestApi["listIssues"]>(async () => mockIssues);
    const githubListPullRequests = vi.fn<GitHubTestApi["listPullRequests"]>(async () => mockPullRequests);
    const githubListActions = vi.fn<GitHubTestApi["listActions"]>(async () => mockActions);

    useUiStore.setState({
      ...defaultUiState,
      selectedAreaId: localArea.id,
      route: {
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localGitRepository.id,
        workspaceId: null,
        tab: "overview",
        path: null
      }
    });
    renderControl({
      ...makeApi({
        listIssues: githubListIssues,
        listPullRequests: githubListPullRequests,
        listActions: githubListActions
      }),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: async () => [localGitRepository],
        getRepository: async () => makeLocalRepositoryDetail(localGitRepository),
        listWorkspaces: async () => [],
        listGitHubIssues,
        listGitHubPullRequests,
        listGitHubActions
      }
    });

    expect(await screen.findByRole("heading", { name: "Control App" })).toBeInTheDocument();
    expect(screen.getByText("Repository root")).toBeInTheDocument();
    const tabs = document.querySelector(".repo-tabs") as HTMLElement;

    await userEvent.click(within(tabs).getByRole("button", { name: /^Issues$/ }));
    expect(
      (await screen.findAllByRole("button", { name: /Compiler crash in async closure/i })).length
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(listGitHubIssues).toHaveBeenCalledWith({
        areaId: localArea.id,
        repositoryId: localGitRepository.id,
        workspaceId: null,
        state: "open",
        limit: 20,
        cacheOnly: false
      })
    );

    await userEvent.click(within(tabs).getByRole("button", { name: /^Pull requests$/ }));
    expect(
      (await screen.findAllByRole("button", { name: /Update concurrency runtime tests/i })).length
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(listGitHubPullRequests).toHaveBeenCalledWith({
        areaId: localArea.id,
        repositoryId: localGitRepository.id,
        workspaceId: null,
        state: "open",
        limit: 20,
        cacheOnly: false
      })
    );

    await userEvent.click(within(tabs).getByRole("button", { name: /^Actions$/ }));
    const workflowRunRow = (await screen.findAllByRole("button", { name: /Validate compiler changes/i }))[0];
    await waitFor(() =>
      expect(listGitHubActions).toHaveBeenCalledWith({
        areaId: localArea.id,
        repositoryId: localGitRepository.id,
        workspaceId: null,
        limit: 20,
        cacheOnly: false
      })
    );
    expect(githubListIssues).not.toHaveBeenCalled();
    expect(githubListPullRequests).not.toHaveBeenCalled();
    expect(githubListActions).not.toHaveBeenCalled();

    await userEvent.click(workflowRunRow);
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "NarukeAlpha/control",
        tab: "actions",
        workflowRunId: mockActions[0].id
      })
    );
  });

  it("uses cache-only reads for connected local repository GitHub tabs before authentication", async () => {
    const listGitHubIssues = vi.fn<ControlApi["areas"]["listGitHubIssues"]>(async () => ({
      items: mockIssues,
      availability: { status: "available", message: null }
    }));

    useUiStore.setState({
      ...defaultUiState,
      selectedAreaId: localArea.id,
      route: {
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localGitRepository.id,
        workspaceId: null,
        tab: "issues",
        path: null
      }
    });
    renderControl({
      ...makeApi(),
      getAppState: async () => ({
        ...mockAppState,
        github: {
          available: true,
          authenticated: false,
          signInConfigured: true,
          user: null,
          error: null
        },
        viewer: null
      }),
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: async () => [localGitRepository],
        getRepository: async () => makeLocalRepositoryDetail(localGitRepository),
        listWorkspaces: async () => [],
        listGitHubIssues
      }
    });

    expect(
      (await screen.findAllByRole("button", { name: /Compiler crash in async closure/i })).length
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(listGitHubIssues).toHaveBeenCalledWith({
        areaId: localArea.id,
        repositoryId: localGitRepository.id,
        workspaceId: null,
        state: "open",
        limit: 20,
        cacheOnly: true
      })
    );
  });

  it("pins the current repository from repository detail without using a GitHub mutation", async () => {
    const listRepositoryPins = vi
      .fn<ControlApi["listRepositoryPins"]>()
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          areaId: "github:default",
          repositoryId: "github:default:apple/swift",
          workspaceId: null,
          nameWithOwner: "apple/swift",
          createdAt: "2026-05-01T00:00:00.000Z"
        }
      ]);
    const pinAreaRepository = vi.fn<ControlApi["pinAreaRepository"]>(async () => [
      {
        areaId: "github:default",
        repositoryId: "github:default:apple/swift",
        workspaceId: null,
        nameWithOwner: "apple/swift",
        createdAt: "2026-05-01T00:00:00.000Z"
      }
    ]);
    const mutate = vi.fn<GitHubTestApi["mutate"]>(mockControlApi.github.mutate);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });
    renderControl({ ...makeApi({ mutate }), listRepositoryPins, pinAreaRepository });

    await userEvent.click(await screen.findByRole("button", { name: "Pin" }));

    await waitFor(() => {
      expect(pinAreaRepository).toHaveBeenCalledWith({
        areaId: "github:default",
        repositoryId: "github:default:apple/swift",
        workspaceId: null,
        nameWithOwner: "apple/swift"
      });
    });
    expect(mutate).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringMatching(/pin/i) }),
      expect.anything()
    );
    expect(await screen.findByRole("button", { name: "Pinned" })).toHaveAttribute("aria-pressed", "true");
  });

  it("unpins repositories from the repository list", async () => {
    const pinnedSwift = {
      areaId: "github:default",
      repositoryId: "github:default:apple/swift",
      workspaceId: null,
      nameWithOwner: "apple/swift",
      createdAt: "2026-05-01T00:00:00.000Z"
    };
    const listRepositoryPins = vi
      .fn<ControlApi["listRepositoryPins"]>()
      .mockResolvedValueOnce([pinnedSwift])
      .mockResolvedValue([]);
    const unpinAreaRepository = vi.fn<ControlApi["unpinAreaRepository"]>(async () => []);

    useUiStore.setState({ ...defaultUiState, route: { kind: "repositories" } });
    renderControl({ ...makeApi(), listRepositoryPins, unpinAreaRepository });

    await userEvent.click(await screen.findByRole("button", { name: "Unpin swift" }));

    await waitFor(() => {
      expect(unpinAreaRepository).toHaveBeenCalledWith({
        areaId: "github:default",
        repositoryId: "github:default:apple/swift",
        workspaceId: null,
        nameWithOwner: "apple/swift"
      });
    });
  });

  it("records a local recent when a repository is opened", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), recordRecentItem });

    const homeActivity = await screen.findByRole("heading", { name: "Latest activity" });
    const homePanel = homeActivity.closest(".home-panel");
    expect(homePanel).not.toBeNull();
    await waitFor(() =>
      expect(
        within(homePanel as HTMLElement).getByRole("button", { name: /apple\/swift/i })
      ).toBeInTheDocument()
    );

    await userEvent.click(within(homePanel as HTMLElement).getByRole("button", { name: /apple\/swift/i }));

    await waitFor(() => {
      expect(recordRecentItem).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "repository",
          itemKey: "apple/swift",
          repositoryNameWithOwner: "apple/swift"
        }),
        expect.anything()
      );
    });
  });

  it("opens recent files in the in-app code browser", async () => {
    const recentFile: LocalRecentItem = {
      kind: "file",
      provider: "github",
      itemKey: "apple/swift:main:README.md",
      title: "README.md",
      subtitle: "swift/README.md",
      repositoryNameWithOwner: "apple/swift",
      url: "https://github.com/apple/swift/blob/main/README.md",
      metadata: {
        path: "README.md",
        ref: "main"
      },
      updatedAt: new Date().toISOString()
    };

    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi(),
      listRecentItems: async () => [recentFile]
    });

    const palette = await openCommandPalette();
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "readme");
    await userEvent.click(within(palette).getByRole("option", { name: /README\.md/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "codeBrowser",
        nameWithOwner: "apple/swift",
        path: "README.md",
        entryType: "file",
        ref: "main",
        line: null
      });
    });
  });

  it("opens local file-path command palette results in the active workspace", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);
    const searchFilePaths = vi.fn<ControlApi["areas"]["searchFilePaths"]>(async (input) => ({
      areaId: input.areaId,
      repositoryId: input.repositoryId,
      workspaceId: input.workspaceId ?? null,
      query: input.query,
      matches: [
        {
          name: "README.md",
          path: "docs/README.md",
          type: "file",
          size: 128,
          updatedAt: null
        }
      ],
      availability: {
        status: "partial",
        message: "Scan cap reached.",
        scannedEntries: 200,
        truncated: true,
        timedOut: false
      }
    }));

    useUiStore.setState({
      ...defaultUiState,
      selectedAreaId: localArea.id,
      route: {
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        workspaceId: localWorkspace.id,
        tab: "overview",
        path: null
      }
    });
    renderControl({
      ...makeApi(),
      recordRecentItem,
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [
          { ...githubArea, selected: false },
          { ...localArea, selected: true }
        ],
        listRepositories: async () => [localJjRepository],
        getRepository: async () => makeLocalRepositoryDetail(localJjRepository),
        listWorkspaces: async () => [localWorkspace],
        searchFilePaths
      }
    });

    const palette = await openCommandPalette();
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "read");

    expect(await within(palette).findByText("Scan cap reached. Scanned 200 entries.")).toBeInTheDocument();
    await userEvent.click(within(palette).getByRole("option", { name: /README\.md.*docs\/README\.md/i }));

    await waitFor(() => {
      expect(searchFilePaths).toHaveBeenLastCalledWith({
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        workspaceId: localWorkspace.id,
        query: "read",
        limit: 8
      });
      expect(useUiStore.getState().route).toEqual({
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        workspaceId: localWorkspace.id,
        tab: "code",
        path: "docs/README.md"
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "file",
        provider: "local",
        itemKey: `${localArea.id}:${localJjRepository.id}:${localWorkspace.id}:docs/README.md`,
        metadata: { path: "docs/README.md", entryType: "file" }
      }),
      expect.anything()
    );
  });

  it("records local recents when issues pull requests and workflow runs are selected", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "issues" }
    });
    renderControl({ ...makeApi(), recordRecentItem });

    const issueMeta = (await screen.findAllByText(/#1199 opened by swift-ci/i)).find((element) =>
      element.closest(".thread-list-row-main")
    );
    expect(issueMeta).toBeTruthy();
    await userEvent.click(issueMeta?.closest("button") as HTMLButtonElement);
    const issueSummary = await screen.findByRole("article", { name: "Issue 1199 summary" });
    await userEvent.click(within(issueSummary).getByRole("button", { name: "Open issue" }));

    await waitFor(() =>
      expect(recordRecentItem).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "issue",
          itemKey: "apple/swift:issue:1199",
          repositoryNameWithOwner: "apple/swift",
          metadata: expect.objectContaining({ number: 1199, state: "open" })
        }),
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: /Pull requests/i }));
    await userEvent.click(
      (await screen.findAllByRole("button", { name: /Update concurrency runtime tests/i }))[0]
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Pull request 519 detail" })).toHaveFocus()
    );

    await waitFor(() =>
      expect(recordRecentItem).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "pullRequest",
          itemKey: "apple/swift:pull:519",
          repositoryNameWithOwner: "apple/swift",
          metadata: expect.objectContaining({ number: 519, state: "open" })
        }),
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: /^Actions/i }));
    const runMeta = (await screen.findAllByText(/push on main/i))[0];
    await userEvent.click(runMeta.closest("button") as HTMLButtonElement);

    await waitFor(() =>
      expect(recordRecentItem).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "workflowRun",
          itemKey: "apple/swift:workflow:9001",
          repositoryNameWithOwner: "apple/swift",
          metadata: expect.objectContaining({ runId: 9001, status: "completed" })
        }),
        expect.anything()
      )
    );
  });

  it("opens Home account work rows in-app and records local recents", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), recordRecentItem, openExternal });

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /Improve Sendable diagnostics for global actors/i }))[0]
    );

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: 1197
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "issue",
        itemKey: "apple/swift:issue:1197",
        repositoryNameWithOwner: "apple/swift"
      }),
      expect.anything()
    );

    await userEvent.click(screen.getByRole("button", { name: /^Home$/ }));
    await userEvent.click(
      (await screen.findAllByRole("button", { name: /Add Sendable support for @MainActor types/i }))[0]
    );

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "pulls",
        pullNumber: 518
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "pullRequest",
        itemKey: "apple/swift:pull:518",
        repositoryNameWithOwner: "apple/swift"
      }),
      expect.anything()
    );
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("opens Mailbox account work rows in-app instead of GitHub", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "mailbox" }
    });
    renderControl({
      ...makeApi({
        listNotifications: async () => []
      }),
      recordRecentItem,
      openExternal
    });

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /Improve Sendable diagnostics for global actors/i }))[0]
    );

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: 1197
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "issue",
        itemKey: "apple/swift:issue:1197"
      }),
      expect.anything()
    );
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("opens issue pull request and workflow recents in-app from the command palette", async () => {
    const recents: LocalRecentItem[] = [
      {
        kind: "issue",
        provider: "github",
        itemKey: "apple/swift:issue:1199",
        title: "#1199 Compiler crash in async closure",
        subtitle: "apple/swift issue · open",
        repositoryNameWithOwner: "apple/swift",
        url: "https://github.com/apple/swift/issues/1199",
        metadata: { number: 1199, state: "open" },
        updatedAt: new Date().toISOString()
      },
      {
        kind: "pullRequest",
        provider: "github",
        itemKey: "apple/swift:pull:519",
        title: "#519 Update concurrency runtime tests",
        subtitle: "feature/sendable-1 -> main · open",
        repositoryNameWithOwner: "apple/swift",
        url: "https://github.com/apple/swift/pull/519",
        metadata: { number: 519, state: "open" },
        updatedAt: new Date(Date.now() - 1_000).toISOString()
      },
      {
        kind: "workflowRun",
        provider: "github",
        itemKey: "apple/swift:workflow:9001",
        title: "Docs",
        subtitle: "apple/swift · push · main",
        repositoryNameWithOwner: "apple/swift",
        url: "https://github.com/apple/swift/actions/runs/9001",
        metadata: { runId: 9001, status: "completed", conclusion: "success" },
        updatedAt: new Date(Date.now() - 2_000).toISOString()
      }
    ];
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => recents);

    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi(),
      listRecentItems: async () => recents,
      recordRecentItem
    });

    await openCommandPalette();
    let palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "1199");
    await userEvent.click(within(palette).getByRole("option", { name: /#1199 Compiler crash/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: 1199
      });
    });

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "519");
    await userEvent.click(within(palette).getByRole("option", { name: /#519 Update concurrency/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "pulls",
        pullNumber: 519
      });
    });

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "docs");
    await userEvent.click(within(palette).getByRole("option", { name: /^Docs/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "actions",
        workflowRunId: 9001
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workflowRun",
        itemKey: "apple/swift:workflow:9001",
        metadata: expect.objectContaining({ runId: 9001 })
      }),
      expect.anything()
    );
  });

  it("opens the command palette with Cmd K and navigates to a repository result", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), recordRecentItem });

    await openCommandPalette();

    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "open-source");
    await userEvent.click(within(palette).getByRole("option", { name: /apple\/open-source/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/open-source",
        tab: "code"
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "repository",
        itemKey: "apple/open-source"
      }),
      expect.anything()
    );
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("opens the command palette from the top bar affordance", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    await userEvent.click(await screen.findByRole("button", { name: "Open command palette" }));

    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    expect(within(palette).getByText("Browse cached GitHub repositories")).toBeInTheDocument();
  });

  it("navigates command palette results with the keyboard", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    await openCommandPalette();

    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "apple{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: 1198
      });
    });
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("opens create and workflow composer commands from the command palette", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });
    renderControl({ ...makeApi(), recordRecentItem });

    await openCommandPalette();
    let palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "create issue");
    await userEvent.click(within(palette).getByRole("option", { name: /Create issue in apple\/swift/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueComposer: "create"
      });
    });
    expect(await screen.findByPlaceholderText("Issue title")).toBeInTheDocument();

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "create pull request");
    await userEvent.click(
      within(palette).getByRole("option", { name: /Create pull request in apple\/swift/i })
    );

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "pulls",
        pullComposer: "create"
      });
    });
    expect(await screen.findByPlaceholderText("Pull request title")).toBeInTheDocument();

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "run workflow");
    await userEvent.click(within(palette).getByRole("option", { name: /Run workflow in apple\/swift/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "actions",
        workflowComposer: "dispatch"
      });
    });
    expect(await screen.findByRole("heading", { name: "Run workflow" })).toBeInTheDocument();
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "repository",
        itemKey: "apple/swift"
      }),
      expect.anything()
    );
  });

  it("opens the Go to file finder from the command palette", async () => {
    const listTree = vi.fn<GitHubTestApi["listTree"]>(async (input) => ({
      ...mockTree,
      ref: input.ref ?? mockTree.ref
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });
    renderControl(makeApi({ listTree }));

    await openCommandPalette();

    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "go to file");
    await userEvent.click(within(palette).getByRole("option", { name: /Go to file in apple\/swift/i }));

    const finder = await screen.findByRole("dialog", { name: "Go to file" });
    expect(within(finder).getByLabelText("Go to file search")).toBeInTheDocument();
    await waitFor(() =>
      expect(listTree).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", recursive: true })
      )
    );
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("opens repository tab and external GitHub commands from the command palette", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });
    renderControl({
      ...makeApi(),
      openExternal
    });

    await openCommandPalette();
    let palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "actions in");
    await userEvent.click(within(palette).getByRole("option", { name: /Actions in apple\/swift/i }));
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "actions"
      })
    );

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "wiki");
    await userEvent.click(within(palette).getByRole("option", { name: /Wiki in apple\/swift/i }));
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "wiki"
      })
    );
    expect(await screen.findByRole("heading", { name: "Repository wiki" })).toBeInTheDocument();

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "security quality");
    await userEvent.click(
      within(palette).getByRole("option", { name: /Security and Quality in apple\/swift/i })
    );
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "securityQuality"
      })
    );

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "repository settings");
    await userEvent.click(
      within(palette).getByRole("option", { name: /Repository settings in apple\/swift/i })
    );
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "settings"
      })
    );
    expect(await screen.findByRole("heading", { name: "Repository settings" })).toBeInTheDocument();

    await openCommandPalette();
    palette = await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "external github");
    await userEvent.click(within(palette).getByRole("option", { name: /Open apple\/swift on GitHub/i }));

    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple/swift");
  });

  it("adds a repository through the in-app GitHub search picker", async () => {
    const remoteRepository = {
      ...mockRepositories[0],
      id: "R_remote_control",
      owner: "NarukeAlpha",
      name: "remote-control",
      nameWithOwner: "NarukeAlpha/remote-control",
      description: "Remote repository discovered through GitHub search."
    };
    const search = vi.fn<GitHubTestApi["search"]>(async (input) =>
      input.query.toLowerCase().includes("remote") ? [remoteRepository] : []
    );
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi({ search }), recordRecentItem });

    const dialog = await openAddRepositoryDialog();
    expect(within(dialog).getByText(/Search cached repositories first/i)).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText("Repository search"), "remote");

    await waitFor(() => expect(search).toHaveBeenLastCalledWith({ query: "remote", limit: 12 }));
    expect(await within(dialog).findByText("GitHub search results")).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "NarukeAlpha/remote-control",
        tab: "code"
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "repository",
        itemKey: "NarukeAlpha/remote-control",
        repositoryNameWithOwner: "NarukeAlpha/remote-control"
      }),
      expect.anything()
    );
    expect(screen.queryByRole("dialog", { name: "Add repository" })).not.toBeInTheDocument();
  });

  it("keeps add repository search local in cached mode before authentication", async () => {
    const listRepositories = vi.fn<GitHubTestApi["listRepositories"]>(async () => mockRepositories);
    const search = vi.fn<GitHubTestApi["search"]>(async () => []);
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);

    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi({ listRepositories, search }),
      recordRecentItem,
      getAppState: async () => ({
        ...mockAppState,
        github: {
          available: true,
          authenticated: false,
          signInConfigured: true,
          user: null,
          error: null
        },
        viewer: null
      })
    });

    const dialog = await openAddRepositoryDialog();
    expect(within(dialog).getByText(/Cached mode: search local repositories/i)).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText("Repository search"), "open-source");

    expect(await within(dialog).findByText("Local cached repositories")).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: /apple\/open-source/i })).toBeInTheDocument();
    expect(
      within(dialog).getByText("Remote GitHub search is unavailable in cached mode.")
    ).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/open-source",
        tab: "code"
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "repository",
        itemKey: "apple/open-source",
        repositoryNameWithOwner: "apple/open-source"
      }),
      expect.anything()
    );
    expect(listRepositories).toHaveBeenCalledWith({ limit: 80, cacheOnly: true });
  });

  it("renders repository settings in-app with GitHub links", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);
    const updateSettings = vi.fn<ControlApi["updateSettings"]>(async (settings) => ({
      ...mockAppState.settings,
      ...settings
    }));
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl({
      ...makeApi(),
      openExternal,
      updateSettings
    });

    await userEvent.click(await screen.findByRole("button", { name: "Repository settings" }));

    expect(await screen.findByRole("heading", { name: "Repository settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Status summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Control display" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Repository tab preferences" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GitHub features" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Danger zone" })).toBeInTheDocument();
    expect(screen.getByText(/default branch main/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Features" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Merge policy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your access" })).toBeInTheDocument();
    expect(openExternal).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText("Discussions tab visibility"), "show");

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        repositoryTabPreferencesByRepository: {
          "apple/swift": {
            discussions: "show"
          }
        }
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Open settings on GitHub" }));

    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple/swift/settings");
  });

  it("renders wiki availability in-app with explicit Open on GitHub", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "wiki" }
    });

    renderControl({ ...makeApi(), openExternal });

    expect(await screen.findByRole("heading", { name: "Repository wiki" })).toBeInTheDocument();
    expect(screen.getByText("Wiki is available for this repository.")).toBeInTheDocument();
    expect(screen.getByText("Open wiki on GitHub")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Open wiki on GitHub/i }));
    await userEvent.click(screen.getByRole("button", { name: /New wiki page on GitHub/i }));

    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple/swift/wiki");
    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple/swift/wiki/_new");
  });

  it("labels the Agents tab as an in-app triage collection with Open on GitHubs", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "agents" }
    });

    renderControl({
      ...makeApi(),
      getAppState: async () => appStateWithRepositoryTabPreferences({ agents: "show" }),
      openExternal
    });

    expect(await screen.findByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByText("in-app first")).toBeInTheDocument();
    expect(
      screen.getByText(/routes agent triage through Issues, Actions, and Pull requests today/i)
    ).toBeInTheDocument();

    const agentIssuesTile = screen.getByText("Agent issues").closest("article");
    expect(agentIssuesTile).not.toBeNull();

    await userEvent.click(
      within(agentIssuesTile as HTMLElement).getByRole("button", { name: /Open on GitHub/i })
    );

    expect(openExternal).toHaveBeenCalledWith(
      "https://github.com/apple/swift/issues?q=is%3Aissue%20is%3Aopen%20label%3Aagent"
    );

    await userEvent.click(
      within(agentIssuesTile as HTMLElement).getByRole("button", { name: /Open in Control/i })
    );

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueFilter: "label:agent",
        pullFilter: undefined,
        workflowFilter: undefined
      });
    });
  });

  it("renders disabled wiki state without enabling page creation", async () => {
    const disabledWikiRepository: RepositoryDetail = {
      ...mockRepository,
      administration: {
        ...mockRepository.administration,
        features: {
          ...mockRepository.administration.features,
          wiki: false
        }
      }
    };
    const getRepository = vi.fn<GitHubTestApi["getRepository"]>(async () => disabledWikiRepository);
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "wiki" }
    });

    renderControl({
      ...makeApi({ getRepository }),
      getAppState: async () => appStateWithRepositoryTabPreferences({ wiki: "show" })
    });

    expect((await screen.findAllByText("Wiki is disabled for this repository.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /New wiki page/i })).toBeDisabled();
  });

  it("refreshes the active repository surface", async () => {
    const getRepository = vi
      .fn<GitHubTestApi["getRepository"]>()
      .mockResolvedValueOnce(mockRepository)
      .mockResolvedValue({
        ...mockRepository,
        description: "Repository detail after manual refresh."
      });
    const listContents = vi.fn<GitHubTestApi["listContents"]>(async () => mockContents);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });
    renderControl(makeApi({ getRepository, listContents }));

    expect(await screen.findByRole("heading", { name: /apple \/ swift/i })).toBeInTheDocument();
    const palette = await openCommandPalette();
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "refresh apple");
    await clickCommandPaletteOption(/^Refresh apple\/swift/i);

    expect((await screen.findAllByText("Repository detail after manual refresh.")).length).toBeGreaterThan(0);
    expect(getRepository).toHaveBeenCalledTimes(2);
    expect(listContents).toHaveBeenCalledTimes(2);
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
    await userEvent.click(screen.getByRole("button", { name: "Add GitHub account" }));

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
    await userEvent.click(screen.getByRole("button", { name: "Add GitHub account" }));

    expect((await screen.findAllByText(/Enter (the code|WDJB-MJHT) in GitHub\./)).length).toBeGreaterThan(0);
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
    expect(screen.getByRole("button", { name: "Add GitHub account" })).toBeInTheDocument();
  });

  it("applies resolved theme attributes to the app shell", async () => {
    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi(),
      getAppState: async () => ({
        ...mockAppState,
        settings: {
          ...mockAppState.settings,
          theme: {
            mode: "dark",
            preset: "control-high-contrast-dark",
            accent: "purple",
            custom: mockAppState.settings.theme.custom
          }
        }
      })
    });

    expect(await screen.findByRole("heading", { name: "Latest activity" })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector(".app-shell")).toMatchObject({
        dataset: {
          themeMode: "dark",
          colorScheme: "dark",
          themePreset: "control-high-contrast-dark",
          accent: "purple"
        }
      });
    });
  });

  it("previews appearance edits on the shell before saving settings", async () => {
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Dark" })
    );
    fireEvent.change(screen.getByLabelText("Dark theme background color", { exact: true }), {
      target: { value: "#111827" }
    });

    await waitFor(() => {
      const shell = document.querySelector(".app-shell");
      expect(shell).toMatchObject({
        dataset: {
          themeMode: "dark",
          colorScheme: "dark"
        }
      });
      expect((shell as HTMLElement | null)?.style.getPropertyValue("--color-surface-solid")).toBe("#111827");
    });
  });

  it("keeps saved light appearance settings after app-state refresh", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        () =>
          ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
          }) as unknown as MediaQueryList
      )
    );
    useUiStore.setState(defaultUiState);
    renderControl(makeApi());

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Light" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
    await waitFor(() => {
      const shell = document.querySelector(".app-shell");
      expect(shell).toMatchObject({
        dataset: {
          themeMode: "light",
          colorScheme: "light",
          themePreset: "control-light"
        }
      });
      expect((shell as HTMLElement | null)?.style.getPropertyValue("--color-surface-solid")).toBe("#EAF2FC");
    });
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

    await userEvent.click(screen.getByRole("button", { name: "Add GitHub account" }));

    expect(signInWithGitHub).not.toHaveBeenCalled();
    expect(screen.getAllByText("GitHub sign-in is not configured in this build.").length).toBeGreaterThan(0);
  });

  it("loads cache-only repositories but no privileged account data before authentication", async () => {
    const listRepositories = vi.fn<GitHubTestApi["listRepositories"]>(async () => mockRepositories);
    const getAccountProfile = vi.fn<GitHubTestApi["getAccountProfile"]>(async () => mockAccountProfile);
    const listAccountIssues = vi.fn<GitHubTestApi["listAccountIssues"]>(async () => mockIssues);
    const listAccountPullRequests = vi.fn<GitHubTestApi["listAccountPullRequests"]>(
      async () => mockPullRequests
    );
    const listOrganizations = vi.fn<GitHubTestApi["listOrganizations"]>(async () => mockOrganizations);
    const listOrganizationTeams = vi.fn<GitHubTestApi["listOrganizationTeams"]>(async () => mockTeams);
    const listNotifications = vi.fn<GitHubTestApi["listNotifications"]>(async () => mockNotifications);

    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi({
        listRepositories,
        getAccountProfile,
        listAccountIssues,
        listAccountPullRequests,
        listOrganizations,
        listOrganizationTeams,
        listNotifications
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

    expect(
      await screen.findByText("Sign in with GitHub in Settings to load live GitHub data.")
    ).toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: /apple\/swift/i })).length).toBeGreaterThan(0);
    expect(listRepositories).toHaveBeenCalledWith({ limit: 80, cacheOnly: true });
    expect(getAccountProfile).toHaveBeenCalledWith({ cacheOnly: true });
    expect(listAccountIssues).toHaveBeenCalledWith({ state: "open", limit: 30, cacheOnly: true });
    expect(listAccountPullRequests).toHaveBeenCalledWith({ state: "open", limit: 30, cacheOnly: true });
    expect(listOrganizations).not.toHaveBeenCalled();
    expect(listOrganizationTeams).not.toHaveBeenCalled();
    expect(listNotifications).not.toHaveBeenCalled();
  });

  it("signs out from settings", async () => {
    const clearGitHubToken = vi.fn<ControlApi["clearGitHubToken"]>(async () => mockAppState);

    useUiStore.setState(defaultUiState);
    renderControl({ ...makeApi(), clearGitHubToken });

    await userEvent.click(await screen.findByTitle("Account settings"));
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(clearGitHubToken).toHaveBeenCalledTimes(1);
  });

  it("renders GitHub notifications in the mailbox", async () => {
    const readNotifications = mockNotifications.map((notification) => ({
      ...notification,
      unread: false,
      lastReadAt: new Date().toISOString()
    }));
    let notificationRead = false;
    const listNotifications = vi.fn<GitHubTestApi["listNotifications"]>(async () =>
      notificationRead ? readNotifications : mockNotifications
    );
    const markNotificationThreadRead = vi.fn<GitHubTestApi["markNotificationThreadRead"]>(async (input) => {
      notificationRead = true;
      return {
        ok: true,
        threadId: input.threadId,
        message: "Notification thread marked as read."
      };
    });
    const unsubscribeNotificationThread = vi.fn<GitHubTestApi["unsubscribeNotificationThread"]>(
      async (input) => ({
        ok: true,
        threadId: input.threadId,
        message: "Notification thread unsubscribed."
      })
    );
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "mailbox" }
    });

    renderControl({
      ...makeApi({
        listNotifications,
        markNotificationThreadRead,
        unsubscribeNotificationThread,
        listAccountIssues: async () => [],
        listAccountPullRequests: async () => []
      }),
      openExternal
    });

    expect(await screen.findByRole("heading", { name: "Mailbox" })).toBeInTheDocument();
    await waitFor(() =>
      expect(listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ all: false, limit: 30, cacheOnly: false })
      )
    );
    expect(screen.getByRole("button", { name: "Unread" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() =>
      expect(listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ all: true, limit: 30, cacheOnly: false })
      )
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Participating" }));
    await waitFor(() =>
      expect(listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ all: false, participating: true, limit: 30, cacheOnly: false })
      )
    );
    expect(screen.getByRole("button", { name: "Participating" })).toHaveAttribute("aria-pressed", "true");

    const notificationRow = await screen.findByRole("button", {
      name: /^Improve Sendable diagnostics for global actors/i
    });
    const notificationContainer = notificationRow.closest(".notification-row") as HTMLElement;
    expect(notificationContainer).not.toBeNull();

    expect(within(notificationRow).getByText(/apple\/swift/i)).toBeInTheDocument();
    expect(within(notificationRow).getAllByText(/mention/i).length).toBeGreaterThan(0);
    expect(within(notificationRow).getByText(/participating/i)).toBeInTheDocument();
    expect(within(notificationContainer).getByText(/unread/i)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Mark Improve Sendable diagnostics for global actors as read/i })
    );

    await waitFor(() =>
      expect(markNotificationThreadRead.mock.calls[0]?.[0]).toEqual({ threadId: mockNotifications[0].id })
    );
    expect((await within(notificationContainer).findAllByText(/read/i)).length).toBeGreaterThan(0);

    expect(unsubscribeNotificationThread).not.toHaveBeenCalled();
  });

  it("opens issue and pull request notifications in-app and records local recents", async () => {
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "mailbox" }
    });

    renderControl({
      ...makeApi({
        listNotifications: async () => mockNotifications,
        listAccountIssues: async () => [],
        listAccountPullRequests: async () => []
      }),
      recordRecentItem,
      openExternal
    });

    await userEvent.click(await screen.findByRole("button", { name: "All" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^Improve Sendable diagnostics for global actors/i })
    );

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: 1200
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "issue",
        itemKey: "apple/swift:issue:1200",
        repositoryNameWithOwner: "apple/swift",
        metadata: expect.objectContaining({ number: 1200, subjectType: "Issue" })
      }),
      expect.anything()
    );
    expect(openExternal).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^Mailbox/ }));
    await userEvent.click(await screen.findByRole("button", { name: "All" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^Add Sendable support for @MainActor types/i })
    );

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "pulls",
        pullNumber: 520
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "pullRequest",
        itemKey: "apple/swift:pull:520",
        repositoryNameWithOwner: "apple/swift",
        metadata: expect.objectContaining({ number: 520, subjectType: "PullRequest" })
      }),
      expect.anything()
    );
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("opens discussion and release notifications in-app with external github unused", async () => {
    const notifications = [
      {
        ...mockNotifications[0],
        id: "notification-discussion",
        reason: "subscribed",
        repositoryNameWithOwner: "apple/swift",
        subject: {
          title: mockDiscussions[1].title,
          type: "Discussion",
          apiUrl: null,
          latestCommentApiUrl: null,
          latestCommentHtmlUrl: null,
          htmlUrl: mockDiscussions[1].htmlUrl
        },
        htmlUrl: mockDiscussions[1].htmlUrl
      },
      {
        ...mockNotifications[0],
        id: "notification-release",
        reason: "release",
        repositoryNameWithOwner: "apple/swift",
        subject: {
          title: mockReleases[0].name ?? mockReleases[0].tagName,
          type: "Release",
          apiUrl: null,
          latestCommentApiUrl: null,
          latestCommentHtmlUrl: null,
          htmlUrl: mockReleases[0].htmlUrl
        },
        htmlUrl: mockReleases[0].htmlUrl
      }
    ];
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "mailbox" }
    });

    renderControl({
      ...makeApi({
        listNotifications: async () => notifications,
        listAccountIssues: async () => [],
        listAccountPullRequests: async () => []
      }),
      openExternal
    });

    await userEvent.click(await screen.findByRole("button", { name: /^Package manager ergonomics/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "discussions",
        discussionNumber: mockDiscussions[1].number
      });
    });
    expect(await screen.findByRole("heading", { name: "Package manager ergonomics" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Mailbox/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Swift 5\.10\.0/i }));

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "releases",
        releaseTagName: "swift-5.10.0"
      });
    });
    expect(await screen.findByRole("heading", { name: "Swift 5.10.0" })).toBeInTheDocument();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("prefetches high-traffic repository tabs when opening code", async () => {
    const getRepository = vi.fn<GitHubTestApi["getRepository"]>(async () => ({
      ...mockRepository,
      readmeMarkdown: null
    }));
    const getReadme = vi.fn<GitHubTestApi["getReadme"]>(async () => ({
      markdown: mockRepository.readmeMarkdown,
      availability: { status: "available", message: null }
    }));
    const listContents = vi.fn<GitHubTestApi["listContents"]>(async () => mockContents);
    const listIssues = vi.fn<GitHubTestApi["listIssues"]>(async () => mockIssues);
    const listPullRequests = vi.fn<GitHubTestApi["listPullRequests"]>(async () => mockPullRequests);
    const listActions = vi.fn<GitHubTestApi["listActions"]>(async () => mockActions);

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
    expect(getReadme).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "apple", repo: "swift", cacheOnly: false })
    );
    expect(await screen.findByText(/Swift is a powerful and intuitive/)).toBeInTheDocument();

    expect(listIssues).toHaveBeenCalled();
    expect(listPullRequests).toHaveBeenCalled();
    expect(listActions).toHaveBeenCalled();
  });

  it("renders GitHub markdown basics safely and routes links through main", async () => {
    const readmeMarkdown = [
      "# Markdown QA",
      "",
      "Track **bold** text, `inline code`, @swift-ci, and #1200.",
      "",
      "- [x] Completed task",
      "- [ ] Pending task",
      "",
      "| Area | State |",
      "| --- | --- |",
      "| Links | [Control docs](https://github.com/apple/swift) |",
      "",
      "![Logo](https://example.com/logo.png)",
      "[Unsafe](javascript:alert(1))",
      "<script>alert('x')</script>"
    ].join("\n");
    const getReadme = vi.fn<GitHubTestApi["getReadme"]>(async () => ({
      markdown: readmeMarkdown,
      availability: { status: "available", message: null }
    }));
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl({ ...makeApi({ getReadme }), openExternal });

    expect(await screen.findByRole("heading", { name: "Markdown QA" })).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("inline code").tagName).toBe("CODE");
    expect(screen.getByText("@swift-ci")).toHaveClass("markdown-reference");
    expect(screen.getByText("#1200")).toHaveClass("markdown-reference");
    expect(screen.getByText("Completed task")).toBeInTheDocument();
    expect((document.querySelector(".markdown-task-list input") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("cell", { name: "Links" })).toBeInTheDocument();
    expect(screen.getByAltText("Logo")).toHaveAttribute("src", "https://example.com/logo.png");
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("button", { name: "Unsafe" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Control docs" }));

    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "code"
      })
    );
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders extra markdown block types and rejects unsafe image and relative URLs", async () => {
    const readmeMarkdown = [
      "# Markdown Safety",
      "",
      "> Quoted **guidance** for reviewers.",
      "",
      "1. First ordered item",
      "2. Second ordered item",
      "",
      "```ts",
      "const unsafe = '<script>';",
      "```",
      "",
      "![Unsafe image](http://example.com/logo.png)",
      "[Relative docs](docs/guide.md)"
    ].join("\n");
    const getReadme = vi.fn<GitHubTestApi["getReadme"]>(async () => ({
      markdown: readmeMarkdown,
      availability: { status: "available", message: null }
    }));
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl({ ...makeApi({ getReadme }), openExternal });

    expect(await screen.findByRole("heading", { name: "Markdown Safety" })).toBeInTheDocument();
    expect(screen.getByText("guidance").tagName).toBe("STRONG");
    expect(document.querySelector("blockquote")?.textContent).toContain("Quoted guidance for reviewers.");
    expect(screen.getByText("First ordered item").closest("ol")).not.toBeNull();
    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByText("const unsafe = '<script>';")).toBeInTheDocument();
    expect(screen.queryByAltText("Unsafe image")).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe image")).toHaveClass("markdown-unsafe");
    await userEvent.click(screen.getByRole("button", { name: "Relative docs" }));
    await waitFor(() =>
      expect(useUiStore.getState().route).toEqual({
        kind: "codeBrowser",
        nameWithOwner: "apple/swift",
        path: "docs/guide.md",
        entryType: "file",
        ref: "main",
        line: null
      })
    );
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders file last changed metadata in repository code rows", async () => {
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl(makeApi());

    const fileList = await waitFor(() => {
      const element = document.querySelector(".virtual-file-list");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    const readmeRow = await waitFor(() => within(fileList).getByRole("button", { name: /README\.md/i }));

    expect(within(readmeRow).getByText(/Update installation instructions by swift-ci/i)).toBeInTheDocument();
    expect(readmeRow).toHaveAttribute("title", expect.stringContaining("last changed in abcdef8"));
    expect(readmeRow).toHaveAttribute("title", expect.stringContaining("by swift-ci"));
  });

  it("changes the repository code listing when selecting a branch or tag", async () => {
    const listContents = vi.fn<GitHubTestApi["listContents"]>(async () => mockContents);
    const listBranchesWithStatus = vi.fn<GitHubTestApi["listBranchesWithStatus"]>(async () => ({
      items: mockBranches,
      availability: { status: "available", message: null }
    }));
    const listTagsWithStatus = vi.fn<GitHubTestApi["listTagsWithStatus"]>(async () => ({
      items: mockTags,
      availability: { status: "available", message: null }
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl(makeApi({ listContents, listBranchesWithStatus, listTagsWithStatus }));

    const refSelect = await screen.findByLabelText("Code reference");
    await waitFor(() =>
      expect(listBranchesWithStatus).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", limit: 50, cacheOnly: false })
      )
    );
    expect(screen.getByRole("option", { name: /release\/6\.0/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /swift-6\.0/i })).toBeInTheDocument();

    await userEvent.selectOptions(refSelect, "release/6.0");

    await waitFor(() =>
      expect(listContents).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", ref: "release/6.0" })
      )
    );

    await userEvent.selectOptions(refSelect, "swift-6.0");

    await waitFor(() =>
      expect(listContents).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", ref: "swift-6.0" })
      )
    );
  });

  it("resets plain repository opens to the default code branch", async () => {
    const listContents = vi.fn<GitHubTestApi["listContents"]>(async () => mockContents);
    const listTree = vi.fn<GitHubTestApi["listTree"]>(async (input) => ({
      ...mockTree,
      ref: input.ref ?? mockTree.ref
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl(makeApi({ listContents, listTree }));

    await userEvent.selectOptions(await screen.findByLabelText("Code reference"), "release/6.0");
    await waitFor(() =>
      expect(listContents).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", ref: "release/6.0" })
      )
    );
    expect(screen.getByLabelText("Code reference")).toHaveValue("release/6.0");

    await userEvent.type(screen.getByLabelText("Search or jump to"), "apple/swift");
    const popover = await waitFor(() => {
      const element = document.querySelector(".search-popover");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await userEvent.click(within(popover).getByRole("button", { name: /apple\/swift/i }));

    await waitFor(() => expect(screen.getByLabelText("Code reference")).toHaveValue("main"));
    await userEvent.click(screen.getByRole("button", { name: "Go to file" }));
    await waitFor(() =>
      expect(listTree).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", ref: "main", recursive: true })
      )
    );
  });

  it("opens repository files through the in-app Go to file finder", async () => {
    const listTree = vi.fn<GitHubTestApi["listTree"]>(async (input) => ({
      ...mockTree,
      ref: input.ref ?? mockTree.ref
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl(makeApi({ listTree }));

    await userEvent.selectOptions(await screen.findByLabelText("Code reference"), "release/6.0");
    await userEvent.click(await screen.findByRole("button", { name: "Go to file" }));

    const finder = await screen.findByRole("dialog", { name: "Go to file" });
    await waitFor(() =>
      expect(listTree).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", ref: "release/6.0", recursive: true })
      )
    );

    await userEvent.type(within(finder).getByLabelText("Go to file search"), "readme{Enter}");

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "codeBrowser",
        nameWithOwner: "apple/swift",
        path: "README.md",
        entryType: "file",
        ref: "release/6.0",
        line: null
      });
    });
    expect(screen.queryByRole("dialog", { name: "Go to file" })).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and active result semantics in the Go to file finder", async () => {
    const listTree = vi.fn<GitHubTestApi["listTree"]>(async (input) => ({
      ...mockTree,
      ref: input.ref ?? mockTree.ref
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl(makeApi({ listTree }));

    await userEvent.click(await screen.findByRole("button", { name: "Go to file" }));

    const finder = await screen.findByRole("dialog", { name: "Go to file" });
    const searchInput = within(finder).getByLabelText("Go to file search");
    const resultList = within(finder).getByRole("listbox", { name: "Files in apple/swift" });
    const workflowOption = await within(resultList).findByRole("option", { name: /ci\.yml/i });

    expect(searchInput).toHaveAttribute("aria-controls", "file-finder-results");
    expect(searchInput).toHaveAttribute("aria-activedescendant", "file-finder-result-0");
    expect(searchInput).toHaveAttribute("aria-describedby", "file-finder-instructions");
    expect(workflowOption).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}");

    const readmeOption = within(resultList).getByRole("option", { name: /README\.md/i });
    expect(readmeOption).toHaveAttribute("aria-selected", "true");
    expect(searchInput).toHaveAttribute("aria-activedescendant", "file-finder-result-1");

    await userEvent.keyboard("{End}");
    expect(within(resultList).getByRole("option", { name: /documentation/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await userEvent.keyboard("{Home}{ArrowDown}");
    expect(readmeOption).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(useUiStore.getState().route).toEqual({
        kind: "codeBrowser",
        nameWithOwner: "apple/swift",
        path: "README.md",
        entryType: "file",
        ref: "main",
        line: null
      });
    });
  });

  it("opens file rows in the in-app code browser", async () => {
    const getFileContent = vi.fn<GitHubTestApi["getFileContent"]>(async (input) => ({
      path: input.path,
      name: input.path.split("/").pop() ?? input.path,
      ref: input.ref ?? "main",
      kind: "text",
      content: "# README.md\n\nLoaded in Control.",
      size: 29,
      encoding: "utf-8",
      htmlUrl: `https://github.com/apple/swift/blob/main/${input.path}`,
      downloadUrl: `https://raw.githubusercontent.com/apple/swift/main/${input.path}`,
      message: null,
      lastCommitSha: null,
      lastCommitMessage: null,
      lastCommitAuthorLogin: null,
      lastCommitAuthorName: null,
      lastCommitAuthorAvatarUrl: null,
      lastAuthoredDate: null,
      lastCommittedDate: null,
      lastCommitDate: null,
      lastCommitHtmlUrl: null,
      lastCommitAdditions: null,
      lastCommitDeletions: null,
      lastCommitChanges: null,
      lastCommitAvailability: { status: "available", message: null }
    }));
    const openExternal = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);

    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText }
    });

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "code" }
    });

    renderControl({
      ...makeApi({ getFileContent }),
      openExternal
    });

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
        ref: "main",
        line: null
      });
    });
    expect((await screen.findAllByRole("heading", { name: "README.md" })).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Loaded in Control/)).toBeInTheDocument();
    expect(getFileContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        path: "README.md",
        ref: "main",
        cacheOnly: false
      })
    );
    expect(document.querySelector(".readme-mark")).toBeNull();
    expect(screen.queryByText("1,562 commits")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Copy raw" }));
    expect(writeText).toHaveBeenCalledWith("# README.md\n\nLoaded in Control.");
    expect(await screen.findByText("Copied")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open raw" }));
    expect(openExternal).toHaveBeenCalledWith("https://raw.githubusercontent.com/apple/swift/main/README.md");
  });

  it("creates issues, pull requests, and workflow dispatches from repository tabs", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    const getIssueDetailWithStatus = vi.fn<GitHubTestApi["getIssueDetailWithStatus"]>(
      mockControlApi.github.getIssueDetailWithStatus
    );
    const getPullRequestOverviewWithStatus = vi.fn<GitHubTestApi["getPullRequestOverviewWithStatus"]>(
      mockControlApi.github.getPullRequestOverviewWithStatus
    );
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "issues" }
    });
    renderControl(makeApi({ mutate, getIssueDetailWithStatus, getPullRequestOverviewWithStatus }));

    expect(await screen.findByText(/This issue reproduces/)).toBeInTheDocument();
    expect(getIssueDetailWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        issueNumber: mockIssues[1].number,
        cacheOnly: false
      })
    );

    await userEvent.click(await screen.findByRole("button", { name: "New issue" }));
    await userEvent.type(screen.getByPlaceholderText("Issue title"), "Bug report");
    await userEvent.type(screen.getByPlaceholderText("Describe the problem"), "Steps to reproduce");
    await userEvent.click(screen.getByRole("button", { name: /Create issue/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "createIssue",
          owner: "apple",
          repo: "swift",
          title: "Bug report",
          body: "Steps to reproduce"
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: /^Pull requests/ }));
    expect(await screen.findByText(/This pull request updates/)).toBeInTheDocument();
    const firstOpenPullRequest = mockPullRequests[1];
    expect(getPullRequestOverviewWithStatus).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      pullNumber: firstOpenPullRequest.number,
      cacheOnly: false
    });
    await userEvent.click(await screen.findByRole("button", { name: "New pull request" }));
    await userEvent.type(screen.getByPlaceholderText("Pull request title"), "Feature branch");
    await userEvent.type(screen.getByPlaceholderText("compare branch"), "feature/demo");
    await userEvent.click(screen.getByRole("button", { name: /Create pull request/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "createPullRequest",
          owner: "apple",
          repo: "swift",
          title: "Feature branch",
          head: "feature/demo",
          base: "main",
          body: "",
          draft: false,
          maintainer_can_modify: true
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: /^Actions/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Run workflow" }));
    expect(await screen.findByRole("combobox", { name: "Workflow" })).toHaveValue(".github/workflows/ci.yml");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "configuration" }), "release");
    await userEvent.click(screen.getByRole("checkbox", { name: /run_tests/i }));
    const workflowForm = screen.getByRole("heading", { name: "Run workflow" }).closest("form");
    expect(workflowForm).not.toBeNull();
    await userEvent.click(
      within(workflowForm as HTMLElement).getByRole("button", { name: /^Run workflow$/i })
    );
    await acceptRepositoryMutationConfirmation("Dispatch workflow");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "dispatchWorkflow",
          owner: "apple",
          repo: "swift",
          workflowId: ".github/workflows/ci.yml",
          ref: "main",
          inputs: {
            configuration: "release",
            run_tests: false
          }
        },
        expect.anything()
      )
    );
  });

  it("runs provider-backed issue and pull request management actions from repository tabs", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    useUiStore.setState({
      ...defaultUiState,
      route: {
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: mockIssues[0].number
      }
    });
    renderControl(makeApi({ mutate }));

    expect(await screen.findByRole("button", { name: "Reopen issue" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reopen issue" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "reopenIssue",
          owner: "apple",
          repo: "swift",
          issueNumber: mockIssues[0].number
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Back to issues" }));
    await userEvent.click(
      (await screen.findAllByRole("button", { name: /Compiler crash in async closure/i }))[0]
    );
    const issueSummary = await screen.findByRole("article", { name: "Issue 1199 summary" });
    await userEvent.click(within(issueSummary).getByRole("button", { name: "Open issue" }));
    await userEvent.click(await screen.findByRole("button", { name: "Close issue" }));
    await acceptRepositoryMutationConfirmation("Close issue");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "closeIssue",
          owner: "apple",
          repo: "swift",
          issueNumber: mockIssues[1].number,
          stateReason: "completed"
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: /^Pull requests/ }));
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await userEvent.click(await screen.findByRole("button", { name: /#516 by slightbug/i }));
    expect(await screen.findByText("Merge unavailable: Pull request is already merged.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Merge pull request" })).toBeDisabled();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /Update concurrency runtime tests/i }))[0]
    );
    await userEvent.click(screen.getByRole("button", { name: "Load discussion" }));
    await screen.findByText("CI is running. Review the changed files and merge status before landing.");
    await userEvent.type(screen.getByPlaceholderText("GitHub usernames"), "octocat, applebot");
    await userEvent.type(screen.getByPlaceholderText("team slugs"), "compiler");
    await userEvent.click(screen.getByRole("button", { name: "Request review" }));
    await acceptRepositoryMutationConfirmation("Request reviewers");
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "requestReviewers",
          owner: "apple",
          repo: "swift",
          pullNumber: mockPullRequests[1].number,
          reviewers: ["octocat", "applebot"],
          teamReviewers: ["compiler"]
        },
        expect.anything()
      )
    );

    const requestedReviewers = screen.getByLabelText("Requested reviewers");
    await userEvent.click(
      within(requestedReviewers).getByRole("button", { name: "Remove reviewer swift-ci" })
    );
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "removeReviewers",
          owner: "apple",
          repo: "swift",
          pullNumber: mockPullRequests[1].number,
          reviewers: ["swift-ci"]
        },
        expect.anything()
      )
    );
    await userEvent.click(
      within(requestedReviewers).getByRole("button", { name: "Remove team reviewer compiler" })
    );
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "removeReviewers",
          owner: "apple",
          repo: "swift",
          pullNumber: mockPullRequests[1].number,
          teamReviewers: ["compiler"]
        },
        expect.anything()
      )
    );

    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "approvePullRequest",
          owner: "apple",
          repo: "swift",
          pullNumber: mockPullRequests[1].number,
          body: ""
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Request changes" }));
    await acceptRepositoryMutationConfirmation("Request pull request changes");
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "requestChanges",
          owner: "apple",
          repo: "swift",
          pullNumber: mockPullRequests[1].number,
          body: ""
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Close pull request" }));
    await acceptRepositoryMutationConfirmation("Close pull request");
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "closePullRequest",
          owner: "apple",
          repo: "swift",
          pullNumber: mockPullRequests[1].number
        },
        expect.anything()
      )
    );
  });

  it("renders pull request reviews, timeline events, checks, commits, and changed files from rich PR detail", async () => {
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);
    const getPullRequestOverviewWithStatus = vi.fn<GitHubTestApi["getPullRequestOverviewWithStatus"]>(
      mockControlApi.github.getPullRequestOverviewWithStatus
    );
    const listPullRequestFilesWithStatus = vi.fn<GitHubTestApi["listPullRequestFilesWithStatus"]>(
      mockControlApi.github.listPullRequestFilesWithStatus
    );
    const getPullRequestDetailWithStatus = vi.fn<GitHubTestApi["getPullRequestDetailWithStatus"]>(
      mockControlApi.github.getPullRequestDetailWithStatus
    );

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "pulls" }
    });
    renderControl({
      ...makeApi({
        getPullRequestDetailWithStatus,
        getPullRequestOverviewWithStatus,
        listPullRequestFilesWithStatus
      }),
      openExternal
    });

    expect(
      await screen.findByText(
        "This pull request updates the repository surface and keeps the change small enough to review in Control."
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load reviews" }));
    await userEvent.click(screen.getByRole("button", { name: "Load linked issues" }));
    await userEvent.click(screen.getByRole("button", { name: "Load timeline events" }));
    await userEvent.click(screen.getByRole("button", { name: "Load review threads" }));
    await userEvent.click(screen.getByRole("button", { name: "Load checks" }));
    await userEvent.click(screen.getByRole("button", { name: "Load commits" }));
    await userEvent.click(screen.getByRole("button", { name: "Load changed files" }));

    expect(await screen.findByText("APPROVED by reviewer")).toBeInTheDocument();
    expect(await screen.findByText("connected apple/swift #1200 Crash on build")).toBeInTheDocument();
    expect(await screen.findByText(/Can this be a typed helper/)).toBeInTheDocument();
    expect(await screen.findByText("macOS build")).toBeInTheDocument();
    expect(screen.getByText(/All tests passed/)).toBeInTheDocument();
    expect(await screen.findByText("Add repository management controls")).toBeInTheDocument();
    expect((await screen.findAllByText("src/renderer/src/App.tsx")).length).toBeGreaterThan(0);
    const firstOpenPullRequest = mockPullRequests[1];
    expect(getPullRequestOverviewWithStatus).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      pullNumber: firstOpenPullRequest.number,
      cacheOnly: false
    });
    expect(listPullRequestFilesWithStatus).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      pullNumber: firstOpenPullRequest.number,
      cacheOnly: false
    });
    expect(getPullRequestDetailWithStatus).not.toHaveBeenCalled();

    const changedFilesPanel = screen.getByRole("heading", { name: "Changed files" }).closest("article");
    expect(changedFilesPanel).not.toBeNull();
    const timelinePanel = screen.getByRole("heading", { name: "Timeline events" }).closest("article");
    expect(timelinePanel).not.toBeNull();
    expect(
      within(timelinePanel as HTMLElement).getByRole("button", {
        name: /connected apple\/swift #1200 Crash on build/
      })
    ).toBeInTheDocument();

    const appFileName = within(changedFilesPanel as HTMLElement).getByText("src/renderer/src/App.tsx");
    const appFileRow = appFileName.closest(".pr-file-row");
    expect(appFileRow).not.toBeNull();
    await userEvent.click(within(appFileRow as HTMLElement).getByRole("button", { name: "Open on GitHub" }));

    expect(openExternal).toHaveBeenCalledWith(`${firstOpenPullRequest.htmlUrl}/files#diff-app`);
  });

  it("renders split pull request subresource availability without hiding the overview", async () => {
    const listPullRequestChecksWithStatus = vi.fn<GitHubTestApi["listPullRequestChecksWithStatus"]>(
      async () => ({
        items: [],
        availability: { status: "rate_limited", message: "Try again later." }
      })
    );

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "pulls" }
    });
    renderControl(makeApi({ listPullRequestChecksWithStatus }));

    expect(await screen.findByText(/This pull request updates/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load checks" }));

    expect(
      await screen.findByText("GitHub rate-limited the pull request checks request. Try again later.")
    ).toBeInTheDocument();
    const firstOpenPullRequest = mockPullRequests[1];
    expect(listPullRequestChecksWithStatus).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      pullNumber: firstOpenPullRequest.number,
      cacheOnly: false
    });
  });

  it("keeps the routed pull request selected when it is missing from the loaded pull list", async () => {
    const focusedPull = mockPullRequests[1];
    const largeFirstPull = {
      ...mockPullRequests[0],
      title: "Regenerate generated files",
      changedFiles: 4096
    };
    const listPullRequests = vi.fn<GitHubTestApi["listPullRequests"]>(async () => [largeFirstPull]);
    const getPullRequestOverviewWithStatus = vi.fn<GitHubTestApi["getPullRequestOverviewWithStatus"]>(
      mockControlApi.github.getPullRequestOverviewWithStatus
    );

    useUiStore.setState({
      ...defaultUiState,
      route: {
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "pulls",
        pullNumber: focusedPull.number
      }
    });
    renderControl(makeApi({ listPullRequests, getPullRequestOverviewWithStatus }));

    expect(await screen.findByRole("heading", { name: focusedPull.title })).toBeInTheDocument();
    expect(screen.getByText(`${focusedPull.changedFiles} files changed`)).toBeInTheDocument();
    expect(screen.queryByText("4096 files changed")).not.toBeInTheDocument();
    expect(getPullRequestOverviewWithStatus).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      pullNumber: focusedPull.number,
      cacheOnly: false
    });
  });

  it("edits an issue title and body through the provider mutation path", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: {
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: mockIssues[0].number
      }
    });
    renderControl(makeApi({ mutate }));

    expect(await screen.findByText(/This issue reproduces/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit issue" }));

    const titleInput = screen.getByPlaceholderText("Edit issue title");
    const bodyInput = screen.getByPlaceholderText("Edit issue body");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated issue title");
    await userEvent.clear(bodyInput);
    await userEvent.type(bodyInput, "Updated issue body from Control");
    await userEvent.click(screen.getByRole("button", { name: "Save issue" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "editIssue",
          owner: "apple",
          repo: "swift",
          issueNumber: mockIssues[0].number,
          title: "Updated issue title",
          body: "Updated issue body from Control",
          milestone: 6
        },
        expect.anything()
      )
    );
  });

  it("adds labels and assignees from the issue detail panel", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    const listLabels = vi.fn<GitHubTestApi["listLabels"]>(async () => mockLabels);
    const listAssignableUsers = vi.fn<GitHubTestApi["listAssignableUsers"]>(async () => mockAssignableUsers);

    useUiStore.setState({
      ...defaultUiState,
      route: {
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: mockIssues[0].number
      }
    });
    renderControl(makeApi({ mutate, listLabels, listAssignableUsers }));

    expect(await screen.findByText(/This issue reproduces/)).toBeInTheDocument();
    expect(screen.getByText("Milestone Swift 6 readiness")).toBeInTheDocument();
    expect(screen.getByText("Assigned @slightbug")).toBeInTheDocument();
    await waitFor(() =>
      expect(listLabels).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", limit: 100, cacheOnly: false })
      )
    );
    await waitFor(() =>
      expect(listAssignableUsers).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", limit: 100, cacheOnly: false })
      )
    );

    const labelsPicker = screen.getByLabelText("Available labels");
    await userEvent.click(within(labelsPicker).getByRole("button", { name: "bug" }));
    await userEvent.click(within(labelsPicker).getByRole("button", { name: "compiler" }));
    await userEvent.click(within(labelsPicker).getByRole("button", { name: "bug" }));
    await userEvent.click(screen.getByRole("button", { name: "Add labels" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "addLabels",
          owner: "apple",
          repo: "swift",
          issueNumber: mockIssues[0].number,
          labels: ["bug", "compiler"]
        },
        expect.anything()
      )
    );

    await userEvent.click(
      within(screen.getByLabelText("Current labels")).getByRole("button", { name: "Remove label compiler" })
    );
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "removeLabel",
          owner: "apple",
          repo: "swift",
          issueNumber: mockIssues[0].number,
          name: "compiler"
        },
        expect.anything()
      )
    );

    const assigneesPicker = screen.getByLabelText("Assignable users");
    await userEvent.click(within(assigneesPicker).getByRole("button", { name: "slightbug" }));
    await userEvent.click(within(assigneesPicker).getByRole("button", { name: "swift-ci" }));
    await userEvent.click(screen.getByRole("button", { name: "Add assignees" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "setAssignees",
          owner: "apple",
          repo: "swift",
          issueNumber: mockIssues[0].number,
          assignees: ["slightbug", "swift-ci"]
        },
        expect.anything()
      )
    );

    await userEvent.click(
      within(screen.getByLabelText("Current assignees")).getByRole("button", {
        name: "Remove assignee slightbug"
      })
    );
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "removeAssignees",
          owner: "apple",
          repo: "swift",
          issueNumber: mockIssues[0].number,
          assignees: ["slightbug"]
        },
        expect.anything()
      )
    );
  });

  it("edits and deletes issue comments through the provider mutation path", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    const getIssueDetailWithStatus = vi.fn<GitHubTestApi["getIssueDetailWithStatus"]>(async (input) => {
      const issue = mockIssues.find((item) => item.number === input.issueNumber) ?? mockIssues[0];
      return {
        detail: {
          ...issue,
          body: "Issue body with editable comments.",
          commentsList: [
            {
              id: 44001,
              authorLogin: "swift-ci",
              authorAvatarUrl: null,
              body: "Original comment body",
              createdAt: issue.createdAt,
              updatedAt: issue.updatedAt,
              htmlUrl: `${issue.htmlUrl}#issuecomment-44001`
            }
          ],
          commentsAvailability: { status: "available", message: null }
        },
        availability: { status: "available", message: null }
      };
    });
    useUiStore.setState({
      ...defaultUiState,
      route: {
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "issues",
        issueNumber: mockIssues[0].number
      }
    });
    renderControl(makeApi({ mutate, getIssueDetailWithStatus }));

    expect(await screen.findByText("Original comment body")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit comment" }));
    const commentInput = screen.getByPlaceholderText("Edit comment body");
    await userEvent.clear(commentInput);
    await userEvent.type(commentInput, "Updated comment body");
    await userEvent.click(screen.getByRole("button", { name: "Save comment" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "editComment",
          owner: "apple",
          repo: "swift",
          commentId: 44001,
          body: "Updated comment body"
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    await acceptRepositoryMutationConfirmation("Delete comment");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "deleteComment",
          owner: "apple",
          repo: "swift",
          commentId: 44001
        },
        expect.anything()
      )
    );
  });

  it("cancels in-progress workflow runs and explains completed workflow limits", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    const listActions = vi.fn<GitHubTestApi["listActions"]>(async () => [
      {
        ...mockActions[0],
        id: 9701,
        name: "Deploy preview",
        displayTitle: "Deploy preview",
        status: "in_progress",
        conclusion: null,
        actionAvailability: {
          canRerun: false,
          canRerunFailedJobs: false,
          canCancel: true,
          rerunUrl: mockActions[0].actionAvailability?.rerunUrl ?? null,
          rerunFailedJobsUrl: mockActions[0].actionAvailability?.rerunFailedJobsUrl ?? null,
          cancelUrl: mockActions[0].actionAvailability?.cancelUrl ?? null,
          previousAttemptUrl: mockActions[0].actionAvailability?.previousAttemptUrl ?? null
        }
      },
      {
        ...mockActions[1],
        id: 9702,
        name: "Release validation",
        displayTitle: "Release validation",
        status: "completed",
        conclusion: "success",
        actionAvailability: {
          canRerun: mockActions[1].actionAvailability?.canRerun ?? false,
          canRerunFailedJobs: mockActions[1].actionAvailability?.canRerunFailedJobs ?? false,
          canCancel: false,
          rerunUrl: mockActions[1].actionAvailability?.rerunUrl ?? null,
          rerunFailedJobsUrl: mockActions[1].actionAvailability?.rerunFailedJobsUrl ?? null,
          cancelUrl: mockActions[1].actionAvailability?.cancelUrl ?? null,
          previousAttemptUrl: mockActions[1].actionAvailability?.previousAttemptUrl ?? null
        }
      }
    ]);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "actions" }
    });
    renderControl(makeApi({ mutate, listActions }));

    expect(await screen.findByRole("heading", { name: "Deploy preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rerun" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel run" }));
    await acceptRepositoryMutationConfirmation("Cancel workflow");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "cancelWorkflow",
          owner: "apple",
          repo: "swift",
          runId: 9701
        },
        expect.anything()
      )
    );

    await userEvent.click((await screen.findAllByRole("button", { name: /Release validation/i }))[0]);

    expect(
      await screen.findByText("Cancel unavailable: Completed workflow runs cannot be canceled.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeDisabled();
  });

  it("reruns only failed workflow jobs when the selected run failed", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "actions" }
    });
    renderControl(makeApi({ mutate }));

    expect(
      await screen.findByRole("heading", { name: mockActions[0].displayTitle ?? mockActions[0].name })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rerun failed jobs" }));
    await acceptRepositoryMutationConfirmation("Rerun failed workflow jobs");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "rerunFailedWorkflowJobs",
          owner: "apple",
          repo: "swift",
          runId: mockActions[0].id
        },
        expect.anything()
      )
    );

    await userEvent.click((await screen.findAllByRole("button", { name: /^Publish docs preview/ }))[0]);

    expect(
      await screen.findByText(
        "Failed-job rerun unavailable: Only failed workflow runs can rerun failed jobs."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rerun failed jobs" })).toBeDisabled();
  });

  it("renders workflow run jobs, steps, checks, and artifacts in-app", async () => {
    const getWorkflowRunDetailWithStatus = vi.fn<GitHubTestApi["getWorkflowRunDetailWithStatus"]>(
      async (input) => ({
        detail: {
          ...mockWorkflowRunDetail,
          id: input.runId
        },
        availability: { status: "available", message: null }
      })
    );
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "actions" }
    });
    renderControl({ ...makeApi({ getWorkflowRunDetailWithStatus, mutate }), openExternal });

    expect(
      await screen.findByRole("heading", { name: mockActions[0].displayTitle ?? mockActions[0].name })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(getWorkflowRunDetailWithStatus).toHaveBeenCalledWith({
        owner: "apple",
        repo: "swift",
        runId: mockActions[0].id,
        cacheOnly: false
      })
    );

    expect((await screen.findAllByText("macOS build")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Build compiler").length).toBeGreaterThan(0);
    expect(screen.getByText("build-logs")).toBeInTheDocument();
    expect(screen.getByText("1 jobs")).toBeInTheDocument();
    expect(screen.getByText("1 checks")).toBeInTheDocument();
    expect(screen.getByText("1 artifacts")).toBeInTheDocument();
    expect(screen.getAllByText("Swift build").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Swift build failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Compiler test failed").length).toBeGreaterThan(0);
    expect(screen.getByText("Temporary download ready")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Download logs" }));

    expect(openExternal).toHaveBeenCalledWith("https://pipelines.actions.githubusercontent.com/logs.zip");

    await userEvent.click(screen.getByRole("button", { name: "Rerun job" }));
    await acceptRepositoryMutationConfirmation("Rerun workflow job");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "rerunWorkflowJob",
          owner: "apple",
          repo: "swift",
          jobId: 7100
        },
        expect.anything()
      )
    );
  });

  it("loads focused workflow run detail when the run is absent from the loaded list", async () => {
    const listActionsWithStatus = vi.fn<GitHubTestApi["listActionsWithStatus"]>(async () => ({
      items: [],
      availability: { status: "available", message: null }
    }));
    const getWorkflowRunDetailWithStatus = vi.fn<GitHubTestApi["getWorkflowRunDetailWithStatus"]>(
      async (input) => ({
        detail: {
          ...mockWorkflowRunDetail,
          id: input.runId,
          displayTitle: "Direct workflow run"
        },
        availability: { status: "available", message: null }
      })
    );

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "actions", workflowRunId: 99123 }
    });
    renderControl(makeApi({ listActionsWithStatus, getWorkflowRunDetailWithStatus }));

    expect(await screen.findByRole("heading", { name: "Direct workflow run" })).toBeInTheDocument();
    expect(getWorkflowRunDetailWithStatus).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      runId: 99123,
      cacheOnly: false
    });
  });

  it("shows hidden repository route tabs without fetching the hidden surface until the tab is shown", async () => {
    const updateSettings = vi.fn<ControlApi["updateSettings"]>(async (settings) => ({
      ...mockAppState.settings,
      ...settings
    }));
    const listDiscussionsWithStatus = vi.fn<GitHubTestApi["listDiscussionsWithStatus"]>(async () => ({
      items: mockDiscussions,
      availability: { status: "available", message: null }
    }));
    const repositoryWithoutDiscussions: RepositoryDetail = {
      ...mockRepository,
      counts: {
        ...mockRepository.counts,
        discussions: 0
      },
      administration: {
        ...mockRepository.administration,
        features: {
          ...mockRepository.administration.features,
          discussions: false
        }
      }
    };

    useUiStore.setState({
      ...defaultUiState,
      route: {
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "discussions",
        discussionNumber: 42
      }
    });
    renderControl({
      ...makeApi({
        getRepository: async () => repositoryWithoutDiscussions,
        listDiscussionsWithStatus
      }),
      updateSettings
    });

    expect(await screen.findByRole("heading", { name: "Discussions is hidden" })).toBeInTheDocument();
    expect(listDiscussionsWithStatus).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Show this tab" }));

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        repositoryTabPreferencesByRepository: {
          "apple/swift": {
            discussions: "show"
          }
        }
      })
    );
  });

  it("renders repository discussions in-app with filtering and external github", async () => {
    const listDiscussionsWithStatus = vi.fn<GitHubTestApi["listDiscussionsWithStatus"]>(async () => ({
      items: mockDiscussions,
      availability: { status: "available", message: null }
    }));
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "discussions" }
    });
    renderControl({ ...makeApi({ listDiscussionsWithStatus }), openExternal });

    expect(
      (await screen.findAllByRole("button", { name: /^Swift 6 concurrency migration notes/ })).length
    ).toBeGreaterThan(0);
    expect(listDiscussionsWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "apple", repo: "swift", limit: 30, cacheOnly: false })
    );

    await userEvent.type(screen.getByLabelText("Filter discussions"), "package");

    const packageDiscussion = (
      await screen.findAllByRole("button", { name: /^Package manager ergonomics/ })
    )[0];
    expect(packageDiscussion).toBeInTheDocument();
    await userEvent.click(packageDiscussion);

    const selectedDiscussionPanel = screen
      .getByRole("heading", { name: "Package manager ergonomics" })
      .closest(".thread-detail");
    expect(selectedDiscussionPanel).not.toBeNull();
    await userEvent.click(
      within(selectedDiscussionPanel as HTMLElement).getByRole("button", { name: "Open on GitHub" })
    );

    expect(openExternal).toHaveBeenCalledWith(mockDiscussions[1].htmlUrl);
  });

  it("renders discussion rate limits without treating them as empty lists", async () => {
    const listDiscussionsWithStatus = vi.fn<GitHubTestApi["listDiscussionsWithStatus"]>(async () => ({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "discussions" }
    });
    renderControl(makeApi({ listDiscussionsWithStatus }));

    expect(
      await screen.findByText("GitHub rate-limited the discussions request. API rate limit exceeded")
    ).toBeInTheDocument();
    expect(screen.queryByText("No discussions returned.")).not.toBeInTheDocument();
  });

  it("renders repository projects in-app and exposes provider errors", async () => {
    const listProjectsWithStatus = vi
      .fn<GitHubTestApi["listProjectsWithStatus"]>()
      .mockResolvedValueOnce({
        items: mockProjects,
        availability: { status: "available", message: null }
      })
      .mockResolvedValue({
        items: [],
        availability: { status: "permission_denied", message: "Projects are not enabled or accessible." }
      });
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "projects" }
    });
    renderControl({ ...makeApi({ listProjectsWithStatus }), openExternal });

    expect(await screen.findByRole("button", { name: /^Compiler quality/ })).toBeInTheDocument();
    expect(listProjectsWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "apple", repo: "swift", limit: 20, cacheOnly: false })
    );

    await userEvent.click(screen.getByRole("button", { name: "Open project on GitHub" }));
    expect(openExternal).toHaveBeenCalledWith(mockProjects[0].htmlUrl);

    const palette = await openCommandPalette();
    await userEvent.type(within(palette).getByLabelText("Command palette search"), "refresh apple");
    await clickCommandPaletteOption(/^Refresh apple\/swift/i);

    expect(
      await screen.findByText(
        "The current GitHub token cannot access projects. Projects are not enabled or accessible."
      )
    ).toBeInTheDocument();
  });

  it("renders project GraphQL errors without treating them as empty lists", async () => {
    const listProjectsWithStatus = vi.fn<GitHubTestApi["listProjectsWithStatus"]>(async () => ({
      items: [],
      availability: { status: "graphql_error", message: "GraphQL failed while loading repository projects" }
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "projects" }
    });
    renderControl(makeApi({ listProjectsWithStatus }));

    expect(
      await screen.findByText(
        "GitHub returned a GraphQL error for projects. GraphQL failed while loading repository projects"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("No projects returned.")).not.toBeInTheDocument();
  });

  it("renders branch protection in the security and quality tab", async () => {
    const getBranchProtection = vi.fn<GitHubTestApi["getBranchProtection"]>(async () => mockBranchProtection);
    const listDependabotAlerts = vi.fn<GitHubTestApi["listDependabotAlerts"]>(async () => ({
      items: mockDependabotAlerts,
      availability: { status: "available", message: null }
    }));
    const listCodeScanningAlerts = vi.fn<GitHubTestApi["listCodeScanningAlerts"]>(async () => ({
      items: mockCodeScanningAlerts,
      availability: { status: "available", message: null }
    }));
    const listSecretScanningAlerts = vi.fn<GitHubTestApi["listSecretScanningAlerts"]>(async () => ({
      items: mockSecretScanningAlerts,
      availability: { status: "available", message: null }
    }));
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "securityQuality" }
    });
    renderControl({
      ...makeApi({
        getBranchProtection,
        listDependabotAlerts,
        listCodeScanningAlerts,
        listSecretScanningAlerts
      }),
      getAppState: async () => appStateWithRepositoryTabPreferences({ securityQuality: "show" }),
      openExternal
    });

    expect(await screen.findByRole("heading", { name: "Branch protection" })).toBeInTheDocument();
    await waitFor(() =>
      expect(getBranchProtection).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", branch: "main", cacheOnly: false })
      )
    );
    await waitFor(() =>
      expect(listDependabotAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "apple",
          repo: "swift",
          state: "open",
          limit: 20,
          cacheOnly: false
        })
      )
    );
    await waitFor(() =>
      expect(listCodeScanningAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "apple",
          repo: "swift",
          state: "open",
          limit: 20,
          cacheOnly: false
        })
      )
    );
    await waitFor(() =>
      expect(listSecretScanningAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "apple",
          repo: "swift",
          state: "open",
          limit: 20,
          cacheOnly: false
        })
      )
    );
    expect(screen.getByText("protected")).toBeInTheDocument();
    expect(screen.getByText("macOS build")).toBeInTheDocument();
    expect(screen.getByText("linux build")).toBeInTheDocument();
    expect(screen.getByText("Linear history: Enabled")).toBeInTheDocument();
    expect(screen.getByText("Force pushes: Disabled")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dependabot alerts" })).toBeInTheDocument();
    expect(screen.getByText("swift-nio")).toBeInTheDocument();
    expect(screen.getByText("Improper input validation in dependency metadata")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Code scanning alerts" })).toBeInTheDocument();
    expect(screen.getByText("swift/path-injection")).toBeInTheDocument();
    expect(screen.getByText("This path depends on a user-provided value.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Secret scanning alerts" })).toBeInTheDocument();
    expect(screen.getByText("Mailchimp API Key")).toBeInTheDocument();
    expect(screen.getByText("Secret value hidden by Control.")).toBeInTheDocument();

    const dependabotSection = screen.getByRole("region", { name: "Dependabot alerts" });
    const codeScanningSection = screen.getByRole("region", { name: "Code scanning alerts" });
    const secretScanningSection = screen.getByRole("region", { name: "Secret scanning alerts" });

    await userEvent.click(
      within(dependabotSection).getByRole("button", { name: "Open Dependabot alert on GitHub" })
    );
    expect(openExternal).toHaveBeenCalledWith(mockDependabotAlerts[0].htmlUrl);
    await userEvent.click(
      within(codeScanningSection).getByRole("button", { name: "Open code scanning alert on GitHub" })
    );
    expect(openExternal).toHaveBeenCalledWith(mockCodeScanningAlerts[0].htmlUrl);
    await userEvent.click(
      within(secretScanningSection).getByRole("button", { name: "Open secret scanning alert on GitHub" })
    );
    expect(openExternal).toHaveBeenCalledWith(mockSecretScanningAlerts[0].htmlUrl);

    await userEvent.click(within(dependabotSection).getByRole("button", { name: "Dismissed" }));
    await waitFor(() =>
      expect(listDependabotAlerts).toHaveBeenLastCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", state: "dismissed", limit: 20 })
      )
    );
    await userEvent.click(within(codeScanningSection).getByRole("button", { name: "Fixed" }));
    await waitFor(() =>
      expect(listCodeScanningAlerts).toHaveBeenLastCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", state: "fixed", limit: 20 })
      )
    );
    await userEvent.click(within(secretScanningSection).getByRole("button", { name: "Resolved" }));
    await waitFor(() =>
      expect(listSecretScanningAlerts).toHaveBeenLastCalledWith(
        expect.objectContaining({ owner: "apple", repo: "swift", state: "resolved", limit: 20 })
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Open branch rules on GitHub" }));

    expect(openExternal).toHaveBeenCalledWith("https://github.com/apple/swift/settings/branches");
  });

  it("renders Dependabot permission states without confusing them with empty alerts", async () => {
    const listDependabotAlerts = vi.fn<GitHubTestApi["listDependabotAlerts"]>(async () => ({
      items: [],
      availability: { status: "permission_denied", message: "Resource not accessible by integration" }
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "securityQuality" }
    });
    renderControl({
      ...makeApi({ listDependabotAlerts }),
      getAppState: async () => appStateWithRepositoryTabPreferences({ securityQuality: "show" })
    });

    expect(
      await screen.findByText(
        "The current GitHub token cannot access dependabot alerts. Resource not accessible by integration"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("No open Dependabot alerts.")).not.toBeInTheDocument();
  });

  it("reports focused security items missing from the loaded filtered list", async () => {
    const listDependabotAlerts = vi.fn<GitHubTestApi["listDependabotAlerts"]>(async () => ({
      items: [],
      availability: { status: "available", message: null }
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: {
        kind: "repository",
        nameWithOwner: "apple/swift",
        tab: "securityQuality",
        securityItemKind: "dependabot",
        securityItemId: "99"
      }
    });
    renderControl({
      ...makeApi({ listDependabotAlerts }),
      getAppState: async () => appStateWithRepositoryTabPreferences({ securityQuality: "show" })
    });

    expect(
      await screen.findByText(
        "Dependabot alert 99 is not loaded in the current security list, state filter, or result limit."
      )
    ).toBeInTheDocument();
  });

  it("renders code scanning feature-disabled states without confusing them with empty alerts", async () => {
    const listCodeScanningAlerts = vi.fn<GitHubTestApi["listCodeScanningAlerts"]>(async () => ({
      items: [],
      availability: { status: "feature_disabled", message: "Code scanning is not enabled." }
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "securityQuality" }
    });
    renderControl({
      ...makeApi({ listCodeScanningAlerts }),
      getAppState: async () => appStateWithRepositoryTabPreferences({ securityQuality: "show" })
    });

    expect(
      await screen.findByText(
        "Code scanning alerts is disabled or not enabled for this repository. Code scanning is not enabled."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("No open code scanning alerts.")).not.toBeInTheDocument();
  });

  it("renders secret scanning permission states without confusing them with empty alerts", async () => {
    const listSecretScanningAlerts = vi.fn<GitHubTestApi["listSecretScanningAlerts"]>(async () => ({
      items: [],
      availability: { status: "permission_denied", message: "Resource not accessible by integration" }
    }));

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "securityQuality" }
    });
    renderControl({
      ...makeApi({ listSecretScanningAlerts }),
      getAppState: async () => appStateWithRepositoryTabPreferences({ securityQuality: "show" })
    });

    expect(
      await screen.findByText(
        "The current GitHub token cannot access secret scanning alerts. Resource not accessible by integration"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("No open secret scanning alerts.")).not.toBeInTheDocument();
  });

  it("creates and deletes releases from the repository releases tab", async () => {
    const mutate = vi.fn<GitHubTestApi["mutate"]>(async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} ok`
    }));
    const openExternal = vi.fn<ControlApi["openExternal"]>(async () => undefined);

    useUiStore.setState({
      ...defaultUiState,
      route: { kind: "repository", nameWithOwner: "apple/swift", tab: "releases" }
    });
    renderControl({ ...makeApi({ mutate }), openExternal });

    expect((await screen.findAllByRole("button", { name: /^Swift 5\.10\.0/ })).length).toBeGreaterThan(0);
    expect(screen.getByText(/Release notes include compiler fixes/)).toBeInTheDocument();
    expect(screen.getByText("swift-5.10.0-macos.pkg")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(openExternal).toHaveBeenCalledWith(mockReleases[0].assets[0]?.browserDownloadUrl);

    await userEvent.click(screen.getByRole("button", { name: "New release" }));
    await userEvent.type(screen.getByPlaceholderText("Release tag"), "swift-5.11.0");
    await userEvent.type(screen.getByPlaceholderText("Release name"), "Swift 5.11.0");
    await userEvent.type(screen.getByPlaceholderText("Release notes"), "Release notes from Control");
    await userEvent.click(screen.getByLabelText("Prerelease"));
    await userEvent.click(screen.getByRole("button", { name: /Create release/i }));
    await acceptRepositoryMutationConfirmation("Create release");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "createRelease",
          owner: "apple",
          repo: "swift",
          tag_name: "swift-5.11.0",
          target_commitish: "main",
          name: "Swift 5.11.0",
          body: "Release notes from Control",
          draft: false,
          prerelease: true
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click((await screen.findAllByRole("button", { name: /^Swift 5\.10\.0/ }))[0]);
    await userEvent.click(screen.getByRole("button", { name: "Edit release" }));
    await userEvent.clear(screen.getByPlaceholderText("Release name"));
    await userEvent.type(screen.getByPlaceholderText("Release name"), "Swift 5.10.1");
    await userEvent.clear(screen.getByPlaceholderText("Release notes"));
    await userEvent.type(screen.getByPlaceholderText("Release notes"), "Edited release notes from Control");
    await userEvent.click(screen.getByLabelText("Draft"));
    await userEvent.click(screen.getByRole("button", { name: /Save release/i }));
    await acceptRepositoryMutationConfirmation("Edit release");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "editRelease",
          owner: "apple",
          repo: "swift",
          releaseId: mockReleases[0].id,
          tag_name: "swift-5.10.0",
          target_commitish: "main",
          name: "Swift 5.10.1",
          body: "Edited release notes from Control",
          draft: true,
          prerelease: false
        },
        expect.anything()
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete release" }));
    await acceptRepositoryMutationConfirmation("Delete release");

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          action: "deleteRelease",
          owner: "apple",
          repo: "swift",
          releaseId: mockReleases[0].id
        },
        expect.anything()
      )
    );
  });

  it("keeps duplicate GitHub local and JJ Area search results addressable", async () => {
    const githubRepository = {
      ...mockRepositories[0],
      id: "R_NarukeAlpha_control",
      owner: "NarukeAlpha",
      name: "control",
      nameWithOwner: "NarukeAlpha/control",
      description: "Cached GitHub repository."
    };
    const remoteRepository = {
      ...mockRepositories[1],
      id: "R_control_remote",
      owner: "control",
      name: "control",
      nameWithOwner: "control/control",
      description: "Remote GitHub repository."
    };
    const searchWithStatus = vi.fn<GitHubTestApi["searchWithStatus"]>(async () => ({
      items: [githubRepository, remoteRepository],
      availability: { status: "available", message: null }
    }));
    const searchAreas = vi.fn<ControlApi["areas"]["searchAreas"]>(async () => ({
      areas: [],
      repositories: [
        { ...localGitRepository, displayName: "control", connection: localGitRepository.connection },
        { ...localJjRepository, displayName: "control", connection: localJjRepository.connection }
      ],
      workspaces: []
    }));
    const recordRecentItem = vi.fn<ControlApi["recordRecentItem"]>(async () => []);

    useUiStore.setState(defaultUiState);
    renderControl({
      ...makeApi({
        listRepositories: async () => [githubRepository],
        searchWithStatus
      }),
      recordRecentItem,
      areas: {
        ...mockControlApi.areas,
        listAreas: async () => [githubArea, localArea],
        searchAreas
      }
    });

    await userEvent.type(await screen.findByLabelText("Search or jump to"), "control");
    const popover = await waitFor(() => {
      const element = document.querySelector(".search-popover");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });

    expect(await within(popover).findByText("Local repositories")).toBeInTheDocument();
    expect(within(popover).getByText("GitHub search")).toBeInTheDocument();
    expect(within(popover).getByText("Area repositories")).toBeInTheDocument();
    expect(within(popover).getByRole("button", { name: /control\/control/i })).toBeInTheDocument();
    expect(within(popover).getAllByRole("button", { name: /NarukeAlpha\/control/i })).toHaveLength(3);
    const duplicateAreaResults = within(popover).getAllByRole("button", {
      name: /control.*NarukeAlpha\/control/i
    });
    expect(duplicateAreaResults).toHaveLength(2);

    await userEvent.click(duplicateAreaResults[1]);

    await waitFor(() => {
      expect(searchAreas).toHaveBeenCalledWith({ query: "control", limit: 8 });
      expect(useUiStore.getState().route).toEqual({
        kind: "localRepository",
        areaId: localArea.id,
        repositoryId: localJjRepository.id,
        workspaceId: null,
        tab: "overview",
        path: null
      });
    });
    expect(recordRecentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "local",
        itemKey: `${localArea.id}:${localJjRepository.id}`,
        metadata: { vcs: "jj" }
      }),
      expect.anything()
    );
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
    expect(screen.getByRole("heading", { name: "Latest activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your work" })).not.toBeInTheDocument();
    expect(screen.queryByText("Followers")).not.toBeInTheDocument();
    expect(screen.queryByText("Following")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /apple \/ swift/i })).not.toBeInTheDocument();
  });

  it("does not treat repository directory rows as Home account activity", async () => {
    const viewedRepository = {
      ...mockRepositories[0],
      id: "R_golang_go",
      owner: "golang",
      name: "go",
      nameWithOwner: "golang/go",
      description: "The Go programming language",
      updatedAt: new Date().toISOString(),
      pushedAt: new Date().toISOString()
    };

    useUiStore.setState(defaultUiState);
    renderControl(
      makeApi({
        listRepositories: async () => [viewedRepository, ...mockRepositories],
        listAccountContributions: async () => mockAccountContributions,
        listAccountIssues: async () => [],
        listAccountPullRequests: async () => []
      })
    );

    const homeActivity = await screen.findByRole("heading", { name: "Latest activity" });
    const homePanel = homeActivity.closest(".home-panel");
    expect(homePanel).not.toBeNull();

    await waitFor(() =>
      expect(
        within(homePanel as HTMLElement).getByRole("button", { name: /apple\/swift/i })
      ).toBeInTheDocument()
    );
    expect(within(homePanel as HTMLElement).queryByRole("button", { name: /golang\/go/i })).toBeNull();
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
      parent: {
        id: "R_parent",
        owner: "mirror",
        name: "swift-parent",
        nameWithOwner: "mirror/swift-parent",
        htmlUrl: "https://github.com/mirror/swift-parent",
        defaultBranch: "main",
        visibility: "PUBLIC",
        isPrivate: false,
        forkCount: 20,
        stargazerCount: 80,
        viewerPermission: "READ"
      },
      source: {
        id: "R_source",
        owner: "apple",
        name: "swift",
        nameWithOwner: "apple/swift",
        htmlUrl: "https://github.com/apple/swift",
        defaultBranch: "main",
        visibility: "PUBLIC",
        isPrivate: false,
        forkCount: 3500,
        stargazerCount: 23300,
        viewerPermission: "READ"
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
        listReleasesWithStatus: async () => ({
          items: mockReleases,
          availability: { status: "available", message: null }
        }),
        listContributors: async () => mockContributors,
        listContributorsWithStatus: async () => ({
          items: mockContributors,
          availability: { status: "available", message: null }
        }),
        listContents: async () => mockContents,
        getViewer: async () => mockAppState.viewer!
      })
    );

    expect(await screen.findByRole("heading", { name: /NarukeAlpha \/ swift-fork/i })).toBeInTheDocument();

    const tabs = document.querySelector(".repo-tabs");

    expect(tabs).not.toBeNull();
    expect(within(tabs as HTMLElement).getByRole("button", { name: /Issues\s*7/i })).toBeInTheDocument();
  });

  it("shows parent and source repository counts only in fork-context UI, never as primary fork counts", async () => {
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
      parent: {
        id: "R_parent",
        owner: "mirror",
        name: "swift-parent",
        nameWithOwner: "mirror/swift-parent",
        htmlUrl: "https://github.com/mirror/swift-parent",
        defaultBranch: "main",
        visibility: "PUBLIC",
        isPrivate: false,
        forkCount: 20,
        stargazerCount: 80,
        viewerPermission: "READ"
      },
      source: {
        id: "R_source",
        owner: "apple",
        name: "swift",
        nameWithOwner: "apple/swift",
        htmlUrl: "https://github.com/apple/swift",
        defaultBranch: "main",
        visibility: "PUBLIC",
        isPrivate: false,
        forkCount: 3500,
        stargazerCount: 23300,
        viewerPermission: "ADMIN"
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
        listRepositories: async () => [forkRepository],
        getRepository: async () => forkRepository,
        listIssues: async () => [],
        listPullRequests: async () => [],
        listDiscussions: async () => [],
        listActions: async () => [],
        listProjects: async () => [],
        listReleases: async () => [],
        listReleasesWithStatus: async () => ({
          items: [],
          availability: { status: "available", message: null }
        }),
        listContributors: async () => [],
        listContributorsWithStatus: async () => ({
          items: [],
          availability: { status: "available", message: null }
        }),
        listContents: async () => mockContents,
        getViewer: async () => mockAppState.viewer!
      })
    );

    expect(await screen.findByRole("heading", { name: /NarukeAlpha \/ swift-fork/i })).toBeInTheDocument();

    const actionRow = document.querySelector(".repo-action-row");
    expect(actionRow).not.toBeNull();
    expect(within(actionRow as HTMLElement).getByRole("button", { name: /Fork\s*1/i })).toBeInTheDocument();
    expect(within(actionRow as HTMLElement).queryByText(/3\.5K forks/i)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "mirror/swift-parent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "apple/swift" })).toBeInTheDocument();
    expect(screen.getByText(/20 forks/i)).toBeInTheDocument();
    expect(screen.getByText(/3\.5K forks/i)).toBeInTheDocument();
    expect(screen.getByText(/admin access/i)).toBeInTheDocument();
  });
});
