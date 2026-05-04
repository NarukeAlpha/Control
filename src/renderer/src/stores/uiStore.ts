import { create } from "zustand";

export type RepositoryTab = "code" | "issues" | "pulls" | "actions" | "projects" | "security" | "insights";

export type CollectionRoute = "discussions" | "projects" | "models" | "codespaces" | "packages" | "stars";

export type AppRoute =
  | { kind: "home" }
  | { kind: "globalIssues" }
  | { kind: "globalPulls" }
  | { kind: "mailbox" }
  | { kind: "collection"; collection: CollectionRoute }
  | { kind: "repository"; nameWithOwner: string; tab: RepositoryTab };

interface UiState {
  route: AppRoute;
  selectedRepository: string | null;
  settingsOpen: boolean;
  navigate(route: AppRoute): void;
  goHome(): void;
  goToGlobalIssues(): void;
  goToGlobalPulls(): void;
  goToMailbox(): void;
  goToCollection(collection: CollectionRoute): void;
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
  goToGlobalIssues: () => set({ route: { kind: "globalIssues" } }),
  goToGlobalPulls: () => set({ route: { kind: "globalPulls" } }),
  goToMailbox: () => set({ route: { kind: "mailbox" } }),
  goToCollection: (collection) => set({ route: { kind: "collection", collection } }),
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
