import { create } from "zustand";

export type RepositoryTab = "code" | "issues" | "pulls" | "agents" | "actions" | "wiki" | "securityQuality";

export type AppRoute =
  | { kind: "home" }
  | { kind: "mailbox" }
  | { kind: "repositories" }
  | { kind: "organizations" }
  | { kind: "repository"; nameWithOwner: string; tab: RepositoryTab };

interface UiState {
  route: AppRoute;
  selectedRepository: string | null;
  settingsOpen: boolean;
  navigate(route: AppRoute): void;
  goHome(): void;
  goToMailbox(): void;
  goToRepositories(): void;
  goToOrganizations(): void;
  goToRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  setRepositoryTab(tab: RepositoryTab): void;
  setSelectedRepository(nameWithOwner: string): void;
  setSettingsOpen(open: boolean): void;
}

export const useUiStore = create<UiState>((set) => ({
  route: { kind: "home" },
  selectedRepository: "apple/swift",
  settingsOpen: false,
  navigate: (route) =>
    set((state) => ({
      route,
      selectedRepository: route.kind === "repository" ? route.nameWithOwner : state.selectedRepository
    })),
  goHome: () => set({ route: { kind: "home" } }),
  goToMailbox: () => set({ route: { kind: "mailbox" } }),
  goToRepositories: () => set({ route: { kind: "repositories" } }),
  goToOrganizations: () => set({ route: { kind: "organizations" } }),
  goToRepository: (nameWithOwner, tab = "code") =>
    set({ selectedRepository: nameWithOwner, route: { kind: "repository", nameWithOwner, tab } }),
  setRepositoryTab: (tab) =>
    set((state) => {
      const nameWithOwner =
        state.route.kind === "repository"
          ? state.route.nameWithOwner
          : (state.selectedRepository ?? "apple/swift");

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
