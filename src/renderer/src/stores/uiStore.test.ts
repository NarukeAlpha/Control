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
