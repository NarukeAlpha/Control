import { LogIn, X } from "lucide-react";
import { useEffect, useReducer, useRef, type ChangeEvent, type JSX } from "react";

import type {
  AppState,
  ControlAccentColor,
  ControlThemeMode,
  ControlThemePreset,
  GlassMode,
  RepositoryTabPreference,
  RepositoryTabPreferenceKey
} from "@shared/github";
import {
  CONTROL_ACCENT_COLORS,
  CONTROL_ACCENT_COLOR_LABELS,
  CONTROL_GLASS_MODES,
  CONTROL_GLASS_MODE_LABELS,
  CONTROL_THEME_MODES,
  CONTROL_THEME_PRESETS,
  CONTROL_THEME_PRESET_LABELS,
  DEFAULT_CONTROL_THEME_SETTINGS
} from "@shared/github";
import type { ProviderAuthController } from "../auth/providerAuthAdapters";
import {
  repositoryTabPreferenceKeys,
  repositoryTabPreferenceLabels
} from "../repository/repositoryTabVisibility";
import { DataSyncPanel } from "./DataSyncPanel";

type SignOutStatus = "idle" | "running" | "signedOut" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SettingsDraftState {
  signOutStatus: SignOutStatus;
  signOutError: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  glassMode: GlassMode;
  themeMode: ControlThemeMode;
  themePreset: ControlThemePreset;
  themeAccent: ControlAccentColor;
  repositoryTabPreferences: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>;
}

type SettingsDraftAction =
  | { type: "beginSignIn" }
  | { type: "beginSignOut" }
  | { type: "finishSignOut" }
  | { type: "failSignOut"; error: string }
  | { type: "beginSave" }
  | { type: "finishSave" }
  | { type: "failSave"; error: string }
  | { type: "setGlassMode"; value: GlassMode }
  | { type: "setThemeMode"; value: ControlThemeMode }
  | { type: "setThemePreset"; value: ControlThemePreset }
  | { type: "setThemeAccent"; value: ControlAccentColor }
  | {
      type: "setRepositoryTabPreference";
      tab: RepositoryTabPreferenceKey;
      preference: RepositoryTabPreference;
    };

interface SettingsPanelProps {
  appState?: AppState;
  authController: ProviderAuthController;
  onClose(): void;
  onOpenExternal(url: string): void;
  onSave(settings: Partial<AppState["settings"]>): Promise<void>;
}

function createSettingsDraftState(appState?: AppState): SettingsDraftState {
  return {
    signOutStatus: "idle",
    signOutError: null,
    saveStatus: "idle",
    saveError: null,
    glassMode: appState?.settings.glassMode ?? "glass-shell",
    themeMode: appState?.settings.theme.mode ?? DEFAULT_CONTROL_THEME_SETTINGS.mode,
    themePreset: appState?.settings.theme.preset ?? DEFAULT_CONTROL_THEME_SETTINGS.preset,
    themeAccent: appState?.settings.theme.accent ?? DEFAULT_CONTROL_THEME_SETTINGS.accent,
    repositoryTabPreferences: appState?.settings.repositoryTabPreferences ?? {}
  };
}

function withUnsavedChange(
  state: SettingsDraftState,
  changes: Partial<SettingsDraftState>
): SettingsDraftState {
  return {
    ...state,
    ...changes,
    saveStatus: "idle",
    saveError: null
  };
}

function settingsDraftReducer(state: SettingsDraftState, action: SettingsDraftAction): SettingsDraftState {
  switch (action.type) {
    case "beginSignIn":
      return { ...state, signOutStatus: "idle", signOutError: null };
    case "beginSignOut":
      return { ...state, signOutStatus: "running", signOutError: null };
    case "finishSignOut":
      return { ...state, signOutStatus: "signedOut", signOutError: null };
    case "failSignOut":
      return { ...state, signOutStatus: "error", signOutError: action.error };
    case "beginSave":
      return { ...state, saveStatus: "saving", saveError: null };
    case "finishSave":
      return { ...state, saveStatus: "saved", saveError: null };
    case "failSave":
      return { ...state, saveStatus: "error", saveError: action.error };
    case "setGlassMode":
      return withUnsavedChange(state, { glassMode: action.value });
    case "setThemeMode":
      return withUnsavedChange(state, { themeMode: action.value });
    case "setThemePreset":
      return withUnsavedChange(state, { themePreset: action.value });
    case "setThemeAccent":
      return withUnsavedChange(state, { themeAccent: action.value });
    case "setRepositoryTabPreference":
      return withUnsavedChange(state, {
        repositoryTabPreferences: {
          ...state.repositoryTabPreferences,
          [action.tab]: action.preference
        }
      });
  }
}

export function SettingsPanel({
  appState,
  authController,
  onClose,
  onOpenExternal,
  onSave
}: SettingsPanelProps): JSX.Element {
  const [draft, dispatch] = useReducer(settingsDraftReducer, appState, createSettingsDraftState);
  const observedCompletedAt = useRef(authController.completedAt);
  const authenticated = appState?.github.authenticated ?? false;
  const githubUser = appState?.github.user ?? null;
  const signInConfigured = appState?.github.signInConfigured ?? true;
  const signInBusy = authController.status === "waiting";
  const signInSession = authController.session;
  const signOutBusy = draft.signOutStatus === "running";
  const saveBusy = draft.saveStatus === "saving";
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
  const saveDisabledReason = saveBusy ? "Settings save is still running." : null;

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

  async function saveSettings(): Promise<void> {
    if (saveDisabledReason) {
      return;
    }

    dispatch({ type: "beginSave" });

    try {
      await onSave({
        credentialProvider: appState?.settings.credentialProvider ?? "github-oauth",
        glassMode: draft.glassMode,
        theme: {
          mode: draft.themeMode,
          preset: draft.themePreset,
          accent: draft.themeAccent
        },
        repositoryTabPreferences: draft.repositoryTabPreferences
      });
      dispatch({ type: "finishSave" });
    } catch (error) {
      dispatch({
        type: "failSave",
        error: error instanceof Error ? error.message : "Settings save failed."
      });
    }
  }

  function startSaveSettings(): void {
    void saveSettings();
  }

  function handleCancelSignIn(): void {
    void authController.cancelSignIn();
  }

  function updateRepositoryTabPreference(
    tab: RepositoryTabPreferenceKey,
    preference: RepositoryTabPreference
  ): void {
    dispatch({ type: "setRepositoryTabPreference", tab, preference });
  }

  return (
    <div className="modal-backdrop">
      <section className="settings-panel">
        <SettingsPanelHeader onClose={onClose} />

        <GitHubConnectionSection
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
        />

        <SettingsStatusMessages
          signInError={authController.error}
          signOutError={draft.signOutError}
          signOutStatus={draft.signOutStatus}
          saveError={draft.saveError}
          saveStatus={draft.saveStatus}
        />

        <AppearanceSettingsSection draft={draft} dispatch={dispatch} />

        <RepositoryTabPreferencesSection
          preferences={draft.repositoryTabPreferences}
          onPreferenceChange={updateRepositoryTabPreference}
        />

        <DataSyncPanel />

        <SettingsPanelFooter
          saveBusy={saveBusy}
          saveDisabledReason={saveDisabledReason}
          onClose={onClose}
          onSave={startSaveSettings}
        />
      </section>
    </div>
  );
}

function SettingsPanelHeader({ onClose }: { onClose(): void }): JSX.Element {
  return (
    <header>
      <h2>Settings</h2>
      <button className="icon-button" type="button" onClick={onClose}>
        <X size={18} />
      </button>
    </header>
  );
}

function GitHubConnectionSection({
  connectionLabel,
  signInDisabledReason,
  signOutDisabledReason,
  signInBusy,
  signOutBusy,
  signInSession,
  onSignIn,
  onSignOut,
  onCancelSignIn,
  onOpenExternal
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
}): JSX.Element {
  return (
    <>
      <div className="settings-inline-actions">
        <span>{connectionLabel}</span>
        <button
          type="button"
          disabled={Boolean(signInDisabledReason)}
          title={signInDisabledReason ?? undefined}
          onClick={onSignIn}
        >
          <LogIn size={15} /> Sign in with GitHub
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

      {signInBusy && (
        <GitHubSignInSession
          session={signInSession}
          onCancelSignIn={onCancelSignIn}
          onOpenExternal={onOpenExternal}
        />
      )}
    </>
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
    <div className="settings-inline-actions">
      <span>{verificationUri ?? "Open GitHub and enter your code."}</span>
      {session?.userCode && <strong className="settings-inline-code">{session.userCode}</strong>}
      {verificationUri && (
        <button type="button" onClick={openVerificationUri}>
          Open GitHub
        </button>
      )}
      <button type="button" onClick={onCancelSignIn}>
        Cancel sign-in
      </button>
    </div>
  );
}

function SettingsStatusMessages({
  signInError,
  signOutError,
  signOutStatus,
  saveError,
  saveStatus
}: {
  signInError: string | null;
  signOutError: string | null;
  signOutStatus: SignOutStatus;
  saveError: string | null;
  saveStatus: SaveStatus;
}): JSX.Element {
  return (
    <>
      {signInError && <p className="settings-error">{signInError}</p>}
      {signOutError && <p className="settings-error">Could not sign out of GitHub: {signOutError}</p>}
      {saveError && <p className="settings-error">Could not save settings: {saveError}</p>}
      {signOutStatus === "signedOut" && <p className="settings-success">Signed out of GitHub.</p>}
      {saveStatus === "saved" && <p className="settings-success">Settings saved.</p>}
    </>
  );
}

function AppearanceSettingsSection({
  draft,
  dispatch
}: {
  draft: SettingsDraftState;
  dispatch(action: SettingsDraftAction): void;
}): JSX.Element {
  function changeGlassMode(event: ChangeEvent<HTMLSelectElement>): void {
    dispatch({
      type: "setGlassMode",
      value: readOptionValue(event.target.value, CONTROL_GLASS_MODES, draft.glassMode)
    });
  }

  function changeThemeMode(event: ChangeEvent<HTMLSelectElement>): void {
    dispatch({
      type: "setThemeMode",
      value: readOptionValue(event.target.value, CONTROL_THEME_MODES, draft.themeMode)
    });
  }

  function changeThemePreset(event: ChangeEvent<HTMLSelectElement>): void {
    dispatch({
      type: "setThemePreset",
      value: readOptionValue(event.target.value, CONTROL_THEME_PRESETS, draft.themePreset)
    });
  }

  function changeThemeAccent(event: ChangeEvent<HTMLSelectElement>): void {
    dispatch({
      type: "setThemeAccent",
      value: readOptionValue(event.target.value, CONTROL_ACCENT_COLORS, draft.themeAccent)
    });
  }

  return (
    <>
      <label>
        Glass mode
        <select value={draft.glassMode} onChange={changeGlassMode}>
          {CONTROL_GLASS_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {CONTROL_GLASS_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Theme mode
        <select value={draft.themeMode} onChange={changeThemeMode}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <label>
        Preset
        <select value={draft.themePreset} onChange={changeThemePreset}>
          {CONTROL_THEME_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {CONTROL_THEME_PRESET_LABELS[preset]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Accent
        <select value={draft.themeAccent} onChange={changeThemeAccent}>
          {CONTROL_ACCENT_COLORS.map((accent) => (
            <option key={accent} value={accent}>
              {CONTROL_ACCENT_COLOR_LABELS[accent]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function RepositoryTabPreferencesSection({
  preferences,
  onPreferenceChange
}: {
  preferences: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>;
  onPreferenceChange(tab: RepositoryTabPreferenceKey, preference: RepositoryTabPreference): void;
}): JSX.Element {
  return (
    <div>
      <h3>Repository tabs</h3>
      {repositoryTabPreferenceKeys.map((tab) => (
        <RepositoryTabPreferenceRow
          key={tab}
          tab={tab}
          preference={preferences[tab] ?? "auto"}
          onPreferenceChange={onPreferenceChange}
        />
      ))}
    </div>
  );
}

function RepositoryTabPreferenceRow({
  tab,
  preference,
  onPreferenceChange
}: {
  tab: RepositoryTabPreferenceKey;
  preference: RepositoryTabPreference;
  onPreferenceChange(tab: RepositoryTabPreferenceKey, preference: RepositoryTabPreference): void;
}): JSX.Element {
  function changePreference(event: ChangeEvent<HTMLSelectElement>): void {
    onPreferenceChange(tab, event.target.value as RepositoryTabPreference);
  }

  return (
    <label>
      {repositoryTabPreferenceLabels[tab]}
      <select
        aria-label={`${repositoryTabPreferenceLabels[tab]} tab visibility`}
        value={preference}
        onChange={changePreference}
      >
        <option value="auto">Auto</option>
        <option value="show">Show</option>
        <option value="hide">Hide</option>
      </select>
    </label>
  );
}

function SettingsPanelFooter({
  saveBusy,
  saveDisabledReason,
  onClose,
  onSave
}: {
  saveBusy: boolean;
  saveDisabledReason: string | null;
  onClose(): void;
  onSave(): void;
}): JSX.Element {
  return (
    <footer>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
      <button
        className="dark-action"
        type="button"
        disabled={Boolean(saveDisabledReason)}
        title={saveDisabledReason ?? undefined}
        onClick={onSave}
      >
        {saveBusy ? "Saving..." : "Save"}
      </button>
    </footer>
  );
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

function readOptionValue<T extends string>(value: string, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}
