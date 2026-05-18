import { create } from "zustand";
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

export const useUiStore = create<UiState>((set) => ({
  route: { kind: "home" },
  selectedAreaId: null,
  selectedRepository: null,
  selectedLocalRepository: null,
  settingsOpen: false,
  navigate: (route) =>
    set((state) => ({
      route,
      selectedAreaId: "areaId" in route ? route.areaId : state.selectedAreaId,
      selectedRepository:
        route.kind === "repository" || route.kind === "codeBrowser"
          ? route.nameWithOwner
          : state.selectedRepository,
      selectedLocalRepository:
        route.kind === "localRepository"
          ? {
              areaId: route.areaId,
              repositoryId: route.repositoryId,
              workspaceId: route.workspaceId ?? null
            }
          : state.selectedLocalRepository
    })),
  selectArea: (selectedAreaId) =>
    set((state) => ({
      selectedAreaId,
      route:
        state.route.kind === "localRepository" && state.route.areaId !== selectedAreaId
          ? { kind: "home" }
          : state.route
    })),
  goHome: () => set({ route: { kind: "home" } }),
  goToMailbox: () => set({ route: { kind: "mailbox" } }),
  goToRepositories: () => set({ route: { kind: "repositories" } }),
  goToOrganizations: () => set({ route: { kind: "organizations" } }),
  goToRepository: (nameWithOwner, tab = "code") =>
    set({ selectedRepository: nameWithOwner, route: { kind: "repository", nameWithOwner, tab } }),
  goToLocalRepository: (areaId, repositoryId, tab = "overview", workspaceId = null, path = null) =>
    set({
      selectedAreaId: areaId,
      selectedLocalRepository: { areaId, repositoryId, workspaceId },
      route: { kind: "localRepository", areaId, repositoryId, workspaceId, tab, path }
    }),
  openCodeBrowser: (nameWithOwner, path, entryType, ref = null, line = null) =>
    set({
      selectedRepository: nameWithOwner,
      route: { kind: "codeBrowser", nameWithOwner, path, entryType, ref, line }
    }),
  setRepositoryTab: (tab) =>
    set((state) => {
      const nameWithOwner =
        state.route.kind === "repository" ? state.route.nameWithOwner : state.selectedRepository;

      if (!nameWithOwner) {
        return state;
      }

      return {
        selectedRepository: nameWithOwner,
        route: { kind: "repository", nameWithOwner, tab }
      };
    }),
  setSelectedRepository: (selectedRepository) =>
    set({
      selectedRepository,
      route: { kind: "repository", nameWithOwner: selectedRepository, tab: "code" }
    }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen })
}));
