import { useEffect, useRef, useState } from "react";

import type { AreaSummary } from "@shared/areas";
import type { ConfirmationPrompt, ConfirmAction } from "../dialogs/confirmation";

interface PendingConfirmation extends ConfirmationPrompt {
  id: number;
}

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
  confirmation: PendingConfirmation | null;
  requestConfirmation: ConfirmAction;
  acceptConfirmation(): void;
  cancelConfirmation(): void;
}

export function useShellDialogState(): ShellDialogState {
  const [addRepositoryOpen, setAddRepositoryOpen] = useState(false);
  const [sshAreaOpen, setSshAreaOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaSummary | null>(null);
  const [deletingArea, setDeletingArea] = useState<AreaSummary | null>(null);
  const [fileFinderOpen, setFileFinderOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const nextConfirmationId = useRef(1);
  const confirmationResolver = useRef<((accepted: boolean) => void) | null>(null);

  function resolveConfirmation(accepted: boolean): void {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(accepted);
  }

  useEffect(
    () => () => {
      confirmationResolver.current?.(false);
      confirmationResolver.current = null;
    },
    []
  );

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
    closeFileFinder: () => setFileFinderOpen(false),
    confirmation,
    requestConfirmation: (prompt) =>
      new Promise<boolean>((resolve) => {
        confirmationResolver.current?.(false);
        confirmationResolver.current = resolve;
        setConfirmation({
          id: nextConfirmationId.current,
          ...prompt
        });
        nextConfirmationId.current += 1;
      }),
    acceptConfirmation: () => resolveConfirmation(true),
    cancelConfirmation: () => resolveConfirmation(false)
  };
}
