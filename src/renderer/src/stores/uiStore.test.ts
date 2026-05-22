import { afterEach, describe, expect, it } from "vitest";

import { useUiStore, type AppRoute } from "./uiStore";

const defaultUiState = {
  route: { kind: "home" as const },
  selectedAreaId: null,
  selectedRepository: null,
  selectedLocalRepository: null,
  settingsOpen: false
};

afterEach(() => {
  useUiStore.setState(defaultUiState);
});

describe("useUiStore local repository routing", () => {
  it("restores workspace-scoped local repository routes", () => {
    const route: AppRoute = {
      kind: "localRepository",
      areaId: "local:control",
      repositoryId: "repo:jj-control",
      workspaceId: "workspace:docs",
      tab: "code",
      path: "docs/README.md"
    };

    useUiStore.getState().navigate(route);

    expect(useUiStore.getState().route).toEqual(route);
    expect(useUiStore.getState().selectedAreaId).toBe("local:control");
    expect(useUiStore.getState().selectedLocalRepository).toEqual({
      areaId: "local:control",
      repositoryId: "repo:jj-control",
      workspaceId: "workspace:docs"
    });
  });

  it("preserves workspace identity when navigating local repository tabs", () => {
    useUiStore
      .getState()
      .goToLocalRepository("local:control", "repo:jj-control", "operations", "workspace:main", null);

    expect(useUiStore.getState().route).toEqual({
      kind: "localRepository",
      areaId: "local:control",
      repositoryId: "repo:jj-control",
      workspaceId: "workspace:main",
      tab: "operations",
      path: null
    });
  });
});

describe("useUiStore route selection derivation", () => {
  const routes: AppRoute[] = [
    { kind: "home" },
    { kind: "mailbox" },
    { kind: "repositories" },
    { kind: "organizations" },
    { kind: "repository", nameWithOwner: "apple/swift", tab: "issues", issueNumber: 1200 },
    {
      kind: "codeBrowser",
      nameWithOwner: "apple/swift",
      path: "README.md",
      entryType: "file",
      ref: "main",
      line: 12
    },
    {
      kind: "localRepository",
      areaId: "local:control",
      repositoryId: "repo:control",
      workspaceId: "workspace:main",
      tab: "status",
      path: null
    }
  ];

  it.each(routes)("derives selected state for $kind routes", (route) => {
    useUiStore.setState({
      selectedAreaId: "local:previous",
      selectedRepository: "previous/repo",
      selectedLocalRepository: {
        areaId: "local:previous",
        repositoryId: "repo:previous",
        workspaceId: null
      }
    });

    useUiStore.getState().navigate(route);

    const state = useUiStore.getState();
    expect(state.route).toEqual(route);

    if (route.kind === "repository" || route.kind === "codeBrowser") {
      expect(state.selectedRepository).toBe(route.nameWithOwner);
      expect(state.selectedAreaId).toBe("local:previous");
      expect(state.selectedLocalRepository).toEqual({
        areaId: "local:previous",
        repositoryId: "repo:previous",
        workspaceId: null
      });
      return;
    }

    if (route.kind === "localRepository") {
      expect(state.selectedAreaId).toBe(route.areaId);
      expect(state.selectedRepository).toBe("previous/repo");
      expect(state.selectedLocalRepository).toEqual({
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null
      });
      return;
    }

    expect(state.selectedAreaId).toBe("local:previous");
    expect(state.selectedRepository).toBe("previous/repo");
    expect(state.selectedLocalRepository).toEqual({
      areaId: "local:previous",
      repositoryId: "repo:previous",
      workspaceId: null
    });
  });

  it("uses the same route derivation for repository and global actions", () => {
    useUiStore.getState().goToRepository("apple/swift", "pulls");
    expect(useUiStore.getState().selectedRepository).toBe("apple/swift");

    useUiStore.getState().goToMailbox();
    expect(useUiStore.getState().route).toEqual({ kind: "mailbox" });
    expect(useUiStore.getState().selectedRepository).toBe("apple/swift");

    useUiStore.getState().goHome();
    expect(useUiStore.getState().route).toEqual({ kind: "home" });
    expect(useUiStore.getState().selectedRepository).toBe("apple/swift");
  });

  it("uses the same route derivation for local repositories, code browser, and repository tabs", () => {
    useUiStore
      .getState()
      .goToLocalRepository("local:control", "repo:control", "code", "workspace:main", "src");

    expect(useUiStore.getState().selectedAreaId).toBe("local:control");
    expect(useUiStore.getState().selectedLocalRepository).toEqual({
      areaId: "local:control",
      repositoryId: "repo:control",
      workspaceId: "workspace:main"
    });

    useUiStore.getState().openCodeBrowser("apple/swift", "README.md", "file", "main", 1);
    expect(useUiStore.getState().selectedRepository).toBe("apple/swift");

    useUiStore.getState().setRepositoryTab("actions");
    expect(useUiStore.getState().route).toEqual({
      kind: "repository",
      nameWithOwner: "apple/swift",
      tab: "actions"
    });

    useUiStore.getState().setSelectedRepository("apple/sourcekit-lsp");
    expect(useUiStore.getState().route).toEqual({
      kind: "repository",
      nameWithOwner: "apple/sourcekit-lsp",
      tab: "code"
    });
  });
});
