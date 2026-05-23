import { useState } from "react";

import type { AreaSummary } from "@shared/areas";

export function useShellDialogState() {
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
