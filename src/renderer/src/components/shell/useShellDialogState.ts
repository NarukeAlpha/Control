import { useState } from "react";

import type { AreaSummary } from "@shared/areas";

export interface ShellDialogState {
  addRepositoryOpen: boolean;
  openAddRepository(): void;
  closeAddRepository(): void;
  sshAreaOpen: boolean;
  openSshArea(): void;
  closeSshArea(): void;
  editingArea: AreaSummary | null;
  openAreaEdit(area: AreaSummary): void;
  closeAreaEdit(): void;
  deletingArea: AreaSummary | null;
  openAreaDelete(area: AreaSummary): void;
  closeAreaDelete(): void;
  fileFinderOpen: boolean;
  openFileFinder(): void;
  closeFileFinder(): void;
}

export function useShellDialogState(): ShellDialogState {
  const [addRepositoryOpen, setAddRepositoryOpen] = useState(false);
  const [sshAreaOpen, setSshAreaOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaSummary | null>(null);
  const [deletingArea, setDeletingArea] = useState<AreaSummary | null>(null);
  const [fileFinderOpen, setFileFinderOpen] = useState(false);

  return {
    addRepositoryOpen,
    openAddRepository: () => setAddRepositoryOpen(true),
    closeAddRepository: () => setAddRepositoryOpen(false),
    sshAreaOpen,
    openSshArea: () => setSshAreaOpen(true),
    closeSshArea: () => setSshAreaOpen(false),
    editingArea,
    openAreaEdit: setEditingArea,
    closeAreaEdit: () => setEditingArea(null),
    deletingArea,
    openAreaDelete: setDeletingArea,
    closeAreaDelete: () => setDeletingArea(null),
    fileFinderOpen,
    openFileFinder: () => setFileFinderOpen(true),
    closeFileFinder: () => setFileFinderOpen(false)
  };
}
