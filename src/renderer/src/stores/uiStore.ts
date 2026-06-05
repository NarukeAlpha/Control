import { create } from "zustand";
import type { IssueStateFilter } from "@shared/github";
import type { LocalRecentSecurityItemKind } from "@shared/local";

export type RepositoryTab =
  | "code"
  | "issues"
  | "pulls"
  | "discussions"
  | "projects"
  | "releases"
  | "contributors"
  | "agents"
  | "actions"
  | "wiki"
  | "securityQuality"
  | "settings";

export type LocalRepositoryTab =
  | "overview"
  | "code"
  | "branches"
  | "bookmarks"
  | "remotes"
  | "issues"
  | "pulls"
  | "actions"
  | "sync"
  | "status"
  | "activity"
  | "workspaces"
  | "operations";

export type AppRoute =
  | { kind: "home" }
  | { kind: "mailbox" }
  | { kind: "repositories" }
  | { kind: "organizations" }
  | {
      kind: "repository";
      nameWithOwner: string;
      tab: RepositoryTab;
      issueNumber?: number;
      pullNumber?: number;
      discussionNumber?: number;
      projectId?: string;
      releaseId?: number;
      releaseTagName?: string;
      releaseAssetId?: number;
      contributorLogin?: string;
      settingsCollaboratorLogin?: string;
      workflowRunId?: number;
      workflowArtifactId?: number;
      securityItemKind?: LocalRecentSecurityItemKind;
      securityItemId?: string;
      wikiPagePath?: string;
      issueState?: IssueStateFilter;
      issueFilter?: string;
      pullFilter?: string;
      workflowFilter?: string;
      issueComposer?: "create";
      pullComposer?: "create";
      releaseComposer?: "create";
      workflowComposer?: "dispatch";
    }
  | {
      kind: "codeBrowser";
      nameWithOwner: string;
      path: string;
      entryType: "file" | "dir";
      ref: string | null;
      line?: number | null;
    }
  | {
      kind: "localRepository";
      areaId: string;
      repositoryId: string;
      workspaceId?: string | null;
      tab: LocalRepositoryTab;
      path?: string | null;
    };

interface UiState {
  route: AppRoute;
  selectedAreaId: string | null;
  selectedRepository: string | null;
  selectedLocalRepository: { areaId: string; repositoryId: string; workspaceId: string | null } | null;
  settingsOpen: boolean;
  navigate(route: AppRoute): void;
  selectArea(areaId: string): void;
  goHome(): void;
  goToMailbox(): void;
  goToRepositories(): void;
  goToOrganizations(): void;
  goToRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  goToLocalRepository(
    areaId: string,
    repositoryId: string,
    tab?: LocalRepositoryTab,
    workspaceId?: string | null,
    path?: string | null
  ): void;
  openCodeBrowser(
    nameWithOwner: string,
    path: string,
    entryType: "file" | "dir",
    ref?: string | null,
    line?: number | null
  ): void;
  setRepositoryTab(tab: RepositoryTab): void;
  setSelectedRepository(nameWithOwner: string): void;
  setSettingsOpen(open: boolean): void;
}

type RouteSelectionState = Pick<
  UiState,
  "route" | "selectedAreaId" | "selectedRepository" | "selectedLocalRepository"
>;

function stateForRoute(route: AppRoute, previous: RouteSelectionState): RouteSelectionState {
  if (route.kind === "repository" || route.kind === "codeBrowser") {
    return {
      route,
      selectedAreaId: previous.selectedAreaId,
      selectedRepository: route.nameWithOwner,
      selectedLocalRepository: previous.selectedLocalRepository
    };
  }

  if (route.kind === "localRepository") {
    return {
      route,
      selectedAreaId: route.areaId,
      selectedRepository: previous.selectedRepository,
      selectedLocalRepository: {
        areaId: route.areaId,
        repositoryId: route.repositoryId,
        workspaceId: route.workspaceId ?? null
      }
    };
  }

  return {
    route,
    selectedAreaId: previous.selectedAreaId,
    selectedRepository: previous.selectedRepository,
    selectedLocalRepository: previous.selectedLocalRepository
  };
}

export const useUiStore = create<UiState>((set) => ({
  route: { kind: "home" },
  selectedAreaId: null,
  selectedRepository: null,
  selectedLocalRepository: null,
  settingsOpen: false,
  navigate: (route) => set((state) => stateForRoute(route, state)),
  selectArea: (selectedAreaId) =>
    set((state) => ({
      selectedAreaId,
      route:
        state.route.kind === "localRepository" && state.route.areaId !== selectedAreaId
          ? { kind: "home" }
          : state.route
    })),
  goHome: () => set((state) => stateForRoute({ kind: "home" }, state)),
  goToMailbox: () => set((state) => stateForRoute({ kind: "mailbox" }, state)),
  goToRepositories: () => set((state) => stateForRoute({ kind: "repositories" }, state)),
  goToOrganizations: () => set((state) => stateForRoute({ kind: "organizations" }, state)),
  goToRepository: (nameWithOwner, tab = "code") =>
    set((state) => stateForRoute({ kind: "repository", nameWithOwner, tab }, state)),
  goToLocalRepository: (areaId, repositoryId, tab = "overview", workspaceId = null, path = null) =>
    set((state) =>
      stateForRoute({ kind: "localRepository", areaId, repositoryId, workspaceId, tab, path }, state)
    ),
  openCodeBrowser: (nameWithOwner, path, entryType, ref = null, line = null) =>
    set((state) => stateForRoute({ kind: "codeBrowser", nameWithOwner, path, entryType, ref, line }, state)),
  setRepositoryTab: (tab) =>
    set((state) => {
      const nameWithOwner =
        state.route.kind === "repository" ? state.route.nameWithOwner : state.selectedRepository;

      if (!nameWithOwner) {
        return state;
      }

      return stateForRoute({ kind: "repository", nameWithOwner, tab }, state);
    }),
  setSelectedRepository: (selectedRepository) =>
    set((state) =>
      stateForRoute({ kind: "repository", nameWithOwner: selectedRepository, tab: "code" }, state)
    ),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen })
}));
