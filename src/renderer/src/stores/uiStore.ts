import { create } from "zustand";

export type RepositoryTab = "code" | "issues" | "pulls" | "actions" | "projects" | "security" | "insights";

interface UiState {
  activeView: string;
  repositoryTab: RepositoryTab;
  selectedRepository: string | null;
  settingsOpen: boolean;
  setActiveView(view: string): void;
  setRepositoryTab(tab: RepositoryTab): void;
  setSelectedRepository(nameWithOwner: string): void;
  setSettingsOpen(open: boolean): void;
}

export const useUiStore = create<UiState>((set) => ({
  activeView: "Home",
  repositoryTab: "code",
  selectedRepository: "apple/swift",
  settingsOpen: false,
  setActiveView: (activeView) => set({ activeView }),
  setRepositoryTab: (repositoryTab) => set({ repositoryTab, activeView: "Repository" }),
  setSelectedRepository: (selectedRepository) =>
    set({ selectedRepository, activeView: "Repository", repositoryTab: "code" }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen })
}));

