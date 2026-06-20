import {
  Database,
  FolderPlus,
  Server,
  Settings as SettingsIcon,
  User,
  UserPlus,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useReducer, useRef, type JSX } from "react";

import type { AppState } from "@shared/github";
import type { ProviderAuthController } from "../auth/providerAuthAdapters";
import { DataSyncPanel } from "./DataSyncPanel";

type SettingsCategory = "account" | "data";
type SignOutStatus = "idle" | "running" | "signedOut" | "error";

const settingsCategories: Array<{
  id: SettingsCategory;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "account", label: "Account", icon: User },
  { id: "data", label: "Data", icon: Database }
];

interface SettingsDraftState {
  activeCategory: SettingsCategory;
  signOutStatus: SignOutStatus;
  signOutError: string | null;
}

type SettingsDraftAction =
  | { type: "setActiveCategory"; value: SettingsCategory }
  | { type: "beginSignIn" }
  | { type: "beginSignOut" }
  | { type: "finishSignOut" }
  | { type: "failSignOut"; error: string };

interface SettingsPanelProps {
  appState?: AppState;
  authController: ProviderAuthController;
  onClose(): void;
  onOpenExternal(url: string): void;
  onAddLocalArea(): Promise<void> | void;
  onAddSshArea(): void;
}

function createSettingsDraftState(): SettingsDraftState {
  return {
    activeCategory: "account",
    signOutStatus: "idle",
    signOutError: null
  };
}

function settingsDraftReducer(state: SettingsDraftState, action: SettingsDraftAction): SettingsDraftState {
  switch (action.type) {
    case "setActiveCategory":
      return { ...state, activeCategory: action.value };
    case "beginSignIn":
      return { ...state, signOutStatus: "idle", signOutError: null };
    case "beginSignOut":
      return { ...state, signOutStatus: "running", signOutError: null };
    case "finishSignOut":
      return { ...state, signOutStatus: "signedOut", signOutError: null };
    case "failSignOut":
      return { ...state, signOutStatus: "error", signOutError: action.error };
  }
}

export function SettingsPanel({
  appState,
  authController,
  onClose,
  onOpenExternal,
  onAddLocalArea,
  onAddSshArea
}: SettingsPanelProps): JSX.Element {
  const [draft, dispatch] = useReducer(settingsDraftReducer, undefined, createSettingsDraftState);
  const observedCompletedAt = useRef(authController.completedAt);
  const authenticated = appState?.github.authenticated ?? false;
  const githubUser = appState?.github.user ?? null;
  const signInConfigured = appState?.github.signInConfigured ?? true;
  const signInBusy = authController.status === "waiting";
  const signInSession = authController.session;
  const signOutBusy = draft.signOutStatus === "running";
  const githubConnectionLabel = getGitHubConnectionLabel({
    authenticated,
    githubUser,
    signInBusy,
    signInConfigured,
    signInSession,
    signOutStatus: draft.signOutStatus
  });
  const signInDisabledReason = getSignInDisabledReason({
    signInBusy,
    signInConfigured,
    signOutBusy
  });
  const signOutDisabledReason = getSignOutDisabledReason({
    authenticated,
    signInBusy,
    signOutBusy,
    signOutStatus: draft.signOutStatus
  });
  const activeCategoryLabel =
    settingsCategories.find((category) => category.id === draft.activeCategory)?.label ?? "Settings";
  useEffect(() => {
    if (!authController.completedAt || authController.completedAt === observedCompletedAt.current) {
      return;
    }

    observedCompletedAt.current = authController.completedAt;
    onClose();
  }, [authController.completedAt, onClose]);

  async function handleGitHubSignIn(): Promise<void> {
    authController.clearError();
    dispatch({ type: "beginSignIn" });

    if (!signInConfigured) {
      return;
    }

    await authController.signIn();
  }

  function startGitHubSignIn(): void {
    void handleGitHubSignIn();
  }

  async function clearGitHubToken(): Promise<void> {
    if (signOutDisabledReason) {
      return;
    }

    dispatch({ type: "beginSignOut" });

    try {
      await authController.clearToken();
      dispatch({ type: "finishSignOut" });
    } catch (error) {
      dispatch({
        type: "failSignOut",
        error: error instanceof Error ? error.message : "GitHub sign-out failed."
      });
    }
  }

  function startClearToken(): void {
    void clearGitHubToken();
  }

  function handleCancelSignIn(): void {
    void authController.cancelSignIn();
  }

  return (
    <div className="modal-backdrop settings-modal-backdrop">
      <section className="settings-panel" aria-labelledby="settings-title">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-header">
            <div>
              <h2 id="settings-title">Settings</h2>
              <span>Control</span>
            </div>
            <button className="icon-button" type="button" aria-label="Close settings" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <nav className="settings-nav" aria-label="Settings sections">
            {settingsCategories.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`settings-nav-button ${draft.activeCategory === id ? "active" : ""}`}
                type="button"
                aria-current={draft.activeCategory === id ? "page" : undefined}
                onClick={() => dispatch({ type: "setActiveCategory", value: id })}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-sidebar-status">
            <SettingsIcon size={15} />
            <span>{githubConnectionLabel}</span>
          </div>
        </aside>

        <div className="settings-main">
          <header className="settings-main-header">
            <div>
              <span>Settings</span>
              <h3>{activeCategoryLabel}</h3>
            </div>
            <SettingsStatusMessages
              signInError={authController.error}
              signOutError={draft.signOutError}
              signOutStatus={draft.signOutStatus}
            />
          </header>

          <div className="settings-content">
            {draft.activeCategory === "account" && (
              <AccountSettingsSection
                connectionLabel={githubConnectionLabel}
                signInDisabledReason={signInDisabledReason}
                signOutDisabledReason={signOutDisabledReason}
                signInBusy={signInBusy}
                signOutBusy={signOutBusy}
                signInSession={signInSession}
                onSignIn={startGitHubSignIn}
                onSignOut={startClearToken}
                onCancelSignIn={handleCancelSignIn}
                onOpenExternal={onOpenExternal}
                onAddLocalArea={onAddLocalArea}
                onAddSshArea={onAddSshArea}
              />
            )}

            {draft.activeCategory === "data" && <DataSyncPanel />}
          </div>
        </div>
      </section>
    </div>
  );
}

function AccountSettingsSection({
  connectionLabel,
  signInDisabledReason,
  signOutDisabledReason,
  signInBusy,
  signOutBusy,
  signInSession,
  onSignIn,
  onSignOut,
  onCancelSignIn,
  onOpenExternal,
  onAddLocalArea,
  onAddSshArea
}: {
  connectionLabel: string;
  signInDisabledReason: string | null;
  signOutDisabledReason: string | null;
  signInBusy: boolean;
  signOutBusy: boolean;
  signInSession: ProviderAuthController["session"];
  onSignIn(): void;
  onSignOut(): void;
  onCancelSignIn(): void;
  onOpenExternal(url: string): void;
  onAddLocalArea(): Promise<void> | void;
  onAddSshArea(): void;
}): JSX.Element {
  function addLocalArea(): void {
    void onAddLocalArea();
  }

  return (
    <section className="settings-section" aria-label="Account settings">
      <div className="settings-account-card">
        <div>
          <span>GitHub</span>
          <strong>{connectionLabel}</strong>
        </div>
        <div className="settings-inline-actions">
          <button
            type="button"
            disabled={Boolean(signInDisabledReason)}
            title={signInDisabledReason ?? undefined}
            onClick={onSignIn}
          >
            <UserPlus size={15} /> Add GitHub account
          </button>
          <button
            type="button"
            disabled={Boolean(signOutDisabledReason)}
            title={signOutDisabledReason ?? undefined}
            onClick={onSignOut}
          >
            {signOutBusy ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      <div className="settings-account-card">
        <div>
          <span>Local</span>
          <strong>Folder-backed Area</strong>
        </div>
        <div className="settings-inline-actions">
          <button type="button" onClick={addLocalArea}>
            <FolderPlus size={15} /> Add local Area
          </button>
        </div>
      </div>

      <div className="settings-account-card">
        <div>
          <span>SSH</span>
          <strong>Remote gateway Area</strong>
        </div>
        <div className="settings-inline-actions">
          <button type="button" onClick={onAddSshArea}>
            <Server size={15} /> Add SSH Area
          </button>
        </div>
      </div>

      {signInBusy && (
        <GitHubSignInSession
          session={signInSession}
          onCancelSignIn={onCancelSignIn}
          onOpenExternal={onOpenExternal}
        />
      )}
    </section>
  );
}

function GitHubSignInSession({
  session,
  onCancelSignIn,
  onOpenExternal
}: {
  session: ProviderAuthController["session"];
  onCancelSignIn(): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const verificationUri = session?.verificationUri ?? null;

  function openVerificationUri(): void {
    if (verificationUri) {
      onOpenExternal(verificationUri);
    }
  }

  return (
    <div className="settings-account-card">
      <div>
        <span>Device code</span>
        <strong>{verificationUri ?? "Open GitHub and enter your code."}</strong>
      </div>
      {session?.userCode && <strong className="settings-inline-code">{session.userCode}</strong>}
      <div className="settings-inline-actions">
        {verificationUri && (
          <button type="button" onClick={openVerificationUri}>
            Open GitHub
          </button>
        )}
        <button type="button" onClick={onCancelSignIn}>
          Cancel sign-in
        </button>
      </div>
    </div>
  );
}

function SettingsStatusMessages({
  signInError,
  signOutError,
  signOutStatus
}: {
  signInError: string | null;
  signOutError: string | null;
  signOutStatus: SignOutStatus;
}): JSX.Element | null {
  if (signInError) {
    return <p className="settings-error">{signInError}</p>;
  }

  if (signOutError) {
    return <p className="settings-error">Could not sign out of GitHub: {signOutError}</p>;
  }

  if (signOutStatus === "signedOut") {
    return <p className="settings-success">Signed out of GitHub.</p>;
  }

  return null;
}

function getGitHubConnectionLabel({
  authenticated,
  githubUser,
  signInBusy,
  signInConfigured,
  signInSession,
  signOutStatus
}: {
  authenticated: boolean;
  githubUser: string | null;
  signInBusy: boolean;
  signInConfigured: boolean;
  signInSession: ProviderAuthController["session"];
  signOutStatus: SignOutStatus;
}): string {
  if (signInBusy) {
    return `Enter ${signInSession?.userCode ?? "the code"} in GitHub.`;
  }
  if (signOutStatus === "signedOut") {
    return "Not connected.";
  }
  if (authenticated) {
    return `Connected as ${githubUser ?? "GitHub"}`;
  }
  if (signInConfigured) {
    return "Not connected.";
  }
  return "GitHub sign-in is not configured in this build.";
}

function getSignInDisabledReason({
  signInBusy,
  signInConfigured,
  signOutBusy
}: {
  signInBusy: boolean;
  signInConfigured: boolean;
  signOutBusy: boolean;
}): string | null {
  if (signOutBusy) {
    return "GitHub sign-out is still running.";
  }
  if (signInBusy) {
    return "GitHub sign-in is already in progress.";
  }
  if (!signInConfigured) {
    return "GitHub sign-in is not configured in this build.";
  }
  return null;
}

function getSignOutDisabledReason({
  authenticated,
  signInBusy,
  signOutBusy,
  signOutStatus
}: {
  authenticated: boolean;
  signInBusy: boolean;
  signOutBusy: boolean;
  signOutStatus: SignOutStatus;
}): string | null {
  if (signOutBusy) {
    return "GitHub sign-out is still running.";
  }
  if (signOutStatus === "signedOut") {
    return "No GitHub account is connected.";
  }
  if (signInBusy) {
    return "Cancel or complete GitHub sign-in before signing out.";
  }
  if (!authenticated) {
    return "No GitHub account is connected.";
  }
  return null;
}
