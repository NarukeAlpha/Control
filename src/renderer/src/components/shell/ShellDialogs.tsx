import type {
  AppState,
  BranchSummary,
  RepoTreeEntry,
  RepoTreeResult,
  RepositoryDetail,
  RepositorySummary,
  TagSummary
} from "@shared/github";
import type { CreateSshAreaInput, UpdateAreaInput } from "@shared/areas";
import type { JSX } from "react";

import { AreaDeleteDialog, AreaEditDialog, SshAreaDialog } from "../areas/AreaDialogs";
import type { ProviderAuthController } from "../auth/providerAuthAdapters";
import { AddRepositoryDialog } from "../dialogs/AddRepositoryDialog";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { FileFinder } from "../file-finder/FileFinder";
import { SettingsPanel } from "../settings/SettingsPanel";
import type { AppRoute } from "../../stores/uiStore";
import type { ShellDialogState } from "./useShellDialogState";

interface ShellDialogsProps {
  dialogs: ShellDialogState;
  repositories: RepositorySummary[];
  viewerLogin: string | null;
  githubReady: boolean;
  appState?: AppState;
  authController: ProviderAuthController;
  settingsOpen: boolean;
  route: AppRoute;
  repository: RepositoryDetail | null;
  repositoryTree: RepoTreeResult | null;
  repositoryTreeLoading: boolean;
  repositoryTreeError: Error | null;
  repositoryTreeAvailabilityMessage: string | null;
  branches: BranchSummary[];
  tags: TagSummary[];
  refListLimit: number;
  maxRefListLimit: number;
  refsLoading: boolean;
  refsError: Error | null;
  refsAvailabilityMessage: string | null;
  selectedRef: string;
  selectedCodeRef: string | null;
  effectiveRepository: string;
  onOpenRepository(nameWithOwner: string): void;
  onAddLocalArea(): Promise<void> | void;
  onCreateSshArea(input: CreateSshAreaInput): Promise<void>;
  onUpdateArea(input: UpdateAreaInput): Promise<void>;
  onDeleteArea(area: Parameters<ShellDialogState["openAreaDelete"]>[0]): Promise<void>;
  onCloseSettings(): void;
  onOpenExternal(url: string): void;
  onSelectRepositoryRef(
    nameWithOwner: string,
    ref: string,
    refKind: "branch" | "tag" | "ref",
    codeBrowserTarget?: { path: string; entryType: "file" | "dir"; line?: number | null }
  ): void;
  repositoryRefKindForName(ref: string): "branch" | "tag" | "ref";
  onExpandRefs(): void;
  onOpenCodeBrowser(nameWithOwner: string, path: string, entryType: "file" | "dir", ref: string | null): void;
}

export function ShellDialogs({
  dialogs,
  repositories,
  viewerLogin,
  githubReady,
  appState,
  authController,
  settingsOpen,
  route,
  repository,
  repositoryTree,
  repositoryTreeLoading,
  repositoryTreeError,
  repositoryTreeAvailabilityMessage,
  branches,
  tags,
  refListLimit,
  maxRefListLimit,
  refsLoading,
  refsError,
  refsAvailabilityMessage,
  selectedRef,
  selectedCodeRef,
  effectiveRepository,
  onOpenRepository,
  onAddLocalArea,
  onCreateSshArea,
  onUpdateArea,
  onDeleteArea,
  onCloseSettings,
  onOpenExternal,
  onSelectRepositoryRef,
  repositoryRefKindForName,
  onExpandRefs,
  onOpenCodeBrowser
}: ShellDialogsProps): JSX.Element {
  const editingArea = dialogs.editingArea;
  const deletingArea = dialogs.deletingArea;

  return (
    <>
      {dialogs.addRepositoryOpen && (
        <AddRepositoryDialog
          repositories={repositories}
          viewerLogin={viewerLogin}
          githubReady={githubReady}
          onClose={dialogs.closeAddRepository}
          onOpenRepository={onOpenRepository}
        />
      )}

      {dialogs.fileFinderOpen && repository && (
        <FileFinder
          repository={repository}
          tree={repositoryTree}
          githubReady={githubReady}
          loading={repositoryTreeLoading}
          error={repositoryTreeError}
          availabilityMessage={repositoryTreeAvailabilityMessage}
          branches={branches}
          tags={tags}
          refListLimit={refListLimit}
          maxRefListLimit={maxRefListLimit}
          refsLoading={refsLoading}
          refsError={refsError}
          refsAvailabilityMessage={refsAvailabilityMessage}
          selectedRef={selectedRef}
          onClose={dialogs.closeFileFinder}
          onSelectRef={(ref) => {
            if (route.kind === "codeBrowser") {
              onSelectRepositoryRef(effectiveRepository, ref, repositoryRefKindForName(ref), {
                path: route.path,
                entryType: route.entryType,
                line: route.line
              });
              return;
            }
            onSelectRepositoryRef(effectiveRepository, ref, repositoryRefKindForName(ref));
          }}
          onExpandRefs={onExpandRefs}
          onOpenEntry={(entry: RepoTreeEntry) => {
            dialogs.closeFileFinder();
            onOpenCodeBrowser(
              effectiveRepository,
              entry.path,
              entry.type === "dir" ? "dir" : "file",
              selectedCodeRef
            );
          }}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          appState={appState}
          authController={authController}
          onClose={onCloseSettings}
          onOpenExternal={onOpenExternal}
          onAddLocalArea={onAddLocalArea}
          onAddSshArea={dialogs.openSshArea}
        />
      )}

      {dialogs.sshAreaOpen && (
        <SshAreaDialog
          onClose={dialogs.closeSshArea}
          onCreate={async (input) => {
            await onCreateSshArea(input);
            dialogs.closeSshArea();
          }}
        />
      )}

      {editingArea && (
        <AreaEditDialog
          area={editingArea}
          onClose={dialogs.closeAreaEdit}
          onSave={async (input) => {
            await onUpdateArea(input);
            dialogs.closeAreaEdit();
          }}
        />
      )}

      {deletingArea && (
        <AreaDeleteDialog
          area={deletingArea}
          onClose={dialogs.closeAreaDelete}
          onDelete={async () => {
            await onDeleteArea(deletingArea);
            dialogs.closeAreaDelete();
          }}
        />
      )}

      {dialogs.confirmation && (
        <ConfirmDialog
          key={dialogs.confirmation.id}
          prompt={dialogs.confirmation}
          onCancel={dialogs.cancelConfirmation}
          onConfirm={dialogs.acceptConfirmation}
        />
      )}
    </>
  );
}
