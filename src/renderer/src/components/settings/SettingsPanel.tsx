import {
  Check,
  Database,
  GitBranch,
  LogIn,
  Palette,
  Settings as SettingsIcon,
  User,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";

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

type SettingsCategory = "account" | "appearance" | "repository" | "data";

const settingsCategories: Array<{
  id: SettingsCategory;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "repository", label: "Repository", icon: GitBranch },
  { id: "data", label: "Data", icon: Database }
];

const themeModeLabels: Record<ControlThemeMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark"
};

const themePresetPreview: Record<
  ControlThemePreset,
  {
    background: string;
    foreground: string;
    surface: string;
    accent: string;
  }
> = {
  "control-light": {
    background: "#f8fafc",
    foreground: "#111827",
    surface: "rgba(255, 255, 255, 0.78)",
    accent: "#0969da"
  },
  "control-dark": {
    background: "#101827",
    foreground: "#e5edf7",
    surface: "rgba(30, 41, 59, 0.76)",
    accent: "#60a5fa"
  },
  "control-dim": {
    background: "#151e2c",
    foreground: "#d8dee8",
    surface: "rgba(37, 49, 67, 0.78)",
    accent: "#7dd3fc"
  },
  "control-high-contrast-dark": {
    background: "#020617",
    foreground: "#ffffff",
    surface: "rgba(15, 23, 42, 0.92)",
    accent: "#bfdbfe"
  }
};

const accentPreview: Record<ControlAccentColor, string> = {
  blue: "#0969da",
  green: "#1a7f37",
  purple: "#7c3aed",
  gray: "#475569"
};

const glassModeSummary: Record<GlassMode, string> = {
  "glass-shell": "Native glass",
  reduced: "Softer blur",
  solid: "Opaque surface"
};

export function SettingsPanel({
  appState,
  authController,
  onClose,
  onOpenExternal,
  onSave
}: {
  appState?: AppState;
  authController: ProviderAuthController;
  onClose(): void;
  onOpenExternal(url: string): void;
  onSave(settings: Partial<AppState["settings"]>): Promise<void>;
}): JSX.Element {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("account");
  const [signOutStatus, setSignOutStatus] = useState<"idle" | "running" | "signedOut" | "error">("idle");
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [glassMode, setGlassMode] = useState<GlassMode>(appState?.settings.glassMode ?? "glass-shell");
  const [themeMode, setThemeMode] = useState<ControlThemeMode>(
    appState?.settings.theme.mode ?? DEFAULT_CONTROL_THEME_SETTINGS.mode
  );
  const [themePreset, setThemePreset] = useState<ControlThemePreset>(
    appState?.settings.theme.preset ?? DEFAULT_CONTROL_THEME_SETTINGS.preset
  );
  const [themeAccent, setThemeAccent] = useState<ControlAccentColor>(
    appState?.settings.theme.accent ?? DEFAULT_CONTROL_THEME_SETTINGS.accent
  );
  const [repositoryTabPreferences, setRepositoryTabPreferences] = useState<
    Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>
  >(appState?.settings.repositoryTabPreferences ?? {});
  const observedCompletedAt = useRef(authController.completedAt);
  const authenticated = appState?.github.authenticated ?? false;
  const githubUser = appState?.github.user ?? null;
  const signInConfigured = appState?.github.signInConfigured ?? true;
  const signInBusy = authController.status === "waiting";
  const signInSession = authController.session;
  const signInError = authController.error;
  const signOutBusy = signOutStatus === "running";
  const saveBusy = saveStatus === "saving";
  const githubConnectionLabel = signInBusy
    ? `Enter ${signInSession?.userCode ?? "the code"} in GitHub.`
    : signOutStatus === "signedOut"
      ? "Not connected."
      : authenticated
        ? `Connected as ${githubUser ?? "GitHub"}`
        : signInConfigured
          ? "Not connected."
          : "GitHub sign-in is not configured in this build.";
  const signInDisabledReason = signOutBusy
    ? "GitHub sign-out is still running."
    : signInBusy
      ? "GitHub sign-in is already in progress."
      : !signInConfigured
        ? "GitHub sign-in is not configured in this build."
        : null;
  const signOutDisabledReason = signOutBusy
    ? "GitHub sign-out is still running."
    : signOutStatus === "signedOut"
      ? "No GitHub account is connected."
      : signInBusy
        ? "Cancel or complete GitHub sign-in before signing out."
        : !authenticated
          ? "No GitHub account is connected."
          : null;
  const saveDisabledReason = saveBusy ? "Settings save is still running." : null;
  const activeCategoryLabel =
    settingsCategories.find((category) => category.id === activeCategory)?.label ?? "Settings";
  const activePresetPreview = themePresetPreview[themePreset];
  const selectedAccent = accentPreview[themeAccent];

  useEffect(() => {
    if (!authController.completedAt || authController.completedAt === observedCompletedAt.current) {
      return;
    }

    observedCompletedAt.current = authController.completedAt;
    onClose();
  }, [authController.completedAt, onClose]);

  async function handleGitHubSignIn(): Promise<void> {
    authController.clearError();
    setSignOutError(null);
    setSignOutStatus("idle");

    if (!signInConfigured) {
      return;
    }

    await authController.signIn();
  }

  async function handleClearToken(): Promise<void> {
    if (signOutDisabledReason) {
      return;
    }

    setSignOutStatus("running");
    setSignOutError(null);

    try {
      await authController.clearToken();
      setSignOutStatus("signedOut");
    } catch (error) {
      setSignOutStatus("error");
      setSignOutError(error instanceof Error ? error.message : "GitHub sign-out failed.");
    }
  }

  async function handleSaveSettings(): Promise<void> {
    if (saveDisabledReason) {
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);

    try {
      await onSave({
        credentialProvider: appState?.settings.credentialProvider ?? "github-oauth",
        glassMode,
        theme: {
          mode: themeMode,
          preset: themePreset,
          accent: themeAccent
        },
        repositoryTabPreferences
      });
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Settings save failed.");
    }
  }

  function handleCancelSignIn(): void {
    void authController.cancelSignIn();
  }

  function updateRepositoryTabPreference(
    tab: RepositoryTabPreferenceKey,
    preference: RepositoryTabPreference
  ): void {
    setRepositoryTabPreferences((current) => ({
      ...current,
      [tab]: preference
    }));
    resetSaveState();
  }

  function updateGlassMode(nextGlassMode: GlassMode): void {
    setGlassMode(nextGlassMode);
    resetSaveState();
  }

  function updateThemeMode(nextThemeMode: ControlThemeMode): void {
    setThemeMode(nextThemeMode);
    resetSaveState();
  }

  function updateThemePreset(nextThemePreset: ControlThemePreset): void {
    setThemePreset(nextThemePreset);
    resetSaveState();
  }

  function updateThemeAccent(nextThemeAccent: ControlAccentColor): void {
    setThemeAccent(nextThemeAccent);
    resetSaveState();
  }

  function resetSaveState(): void {
    setSaveStatus("idle");
    setSaveError(null);
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
                className={`settings-nav-button ${activeCategory === id ? "active" : ""}`}
                type="button"
                aria-current={activeCategory === id ? "page" : undefined}
                onClick={() => setActiveCategory(id)}
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
              signInError={signInError}
              signOutError={signOutError}
              saveError={saveError}
              signOutStatus={signOutStatus}
              saveStatus={saveStatus}
            />
          </header>

          <div className="settings-content">
            {activeCategory === "account" && (
              <section className="settings-section" aria-label="Account settings">
                <div className="settings-account-card">
                  <div>
                    <span>GitHub</span>
                    <strong>{githubConnectionLabel}</strong>
                  </div>
                  <div className="settings-inline-actions">
                    <button
                      type="button"
                      disabled={Boolean(signInDisabledReason)}
                      title={signInDisabledReason ?? undefined}
                      onClick={() => void handleGitHubSignIn()}
                    >
                      <LogIn size={15} /> Sign in with GitHub
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(signOutDisabledReason)}
                      title={signOutDisabledReason ?? undefined}
                      onClick={() => void handleClearToken()}
                    >
                      {signOutBusy ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </div>

                {signInBusy && (
                  <div className="settings-account-card">
                    <div>
                      <span>Device code</span>
                      <strong>{signInSession?.verificationUri ?? "Open GitHub and enter your code."}</strong>
                    </div>
                    {signInSession?.userCode && (
                      <strong className="settings-inline-code">{signInSession.userCode}</strong>
                    )}
                    <div className="settings-inline-actions">
                      {(() => {
                        const verificationUri = signInSession?.verificationUri;
                        if (!verificationUri) {
                          return null;
                        }

                        return (
                          <button type="button" onClick={() => void onOpenExternal(verificationUri)}>
                            Open GitHub
                          </button>
                        );
                      })()}
                      <button type="button" onClick={handleCancelSignIn}>
                        Cancel sign-in
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeCategory === "appearance" && (
              <section className="settings-section settings-appearance-section" aria-label="Appearance settings">
                <div className="settings-control-group">
                  <div className="settings-field-heading">
                    <h4>Theme mode</h4>
                  </div>
                  <div className="settings-segmented-control" role="group" aria-label="Theme mode">
                    {CONTROL_THEME_MODES.map((mode) => (
                      <button
                        key={mode}
                        className={themeMode === mode ? "active" : ""}
                        type="button"
                        aria-pressed={themeMode === mode}
                        onClick={() => updateThemeMode(mode)}
                      >
                        {themeModeLabels[mode]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-control-group">
                  <div className="settings-field-heading">
                    <h4>Themes</h4>
                  </div>
                  <div className="theme-preset-grid" role="group" aria-label="Theme">
                    {CONTROL_THEME_PRESETS.map((preset) => {
                      const preview = themePresetPreview[preset];
                      return (
                        <button
                          key={preset}
                          className={`theme-preset-option ${themePreset === preset ? "active" : ""}`}
                          type="button"
                          aria-pressed={themePreset === preset}
                          style={
                            {
                              "--theme-preview-background": preview.background,
                              "--theme-preview-foreground": preview.foreground,
                              "--theme-preview-surface": preview.surface,
                              "--theme-preview-accent": preview.accent
                            } as CSSProperties
                          }
                          onClick={() => updateThemePreset(preset)}
                        >
                          <span className="theme-preset-preview" aria-hidden="true">
                            <span className="theme-preset-preview-window">
                              <span />
                              <strong />
                              <small />
                            </span>
                            <span className="theme-preset-preview-accent" />
                          </span>
                          <span className="theme-preset-copy">
                            <strong>{CONTROL_THEME_PRESET_LABELS[preset]}</strong>
                          </span>
                          {themePreset === preset && <Check size={16} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="settings-control-group">
                  <div className="settings-field-heading">
                    <h4>Colors</h4>
                  </div>
                  <div className="settings-color-summary" aria-label="Selected theme colors">
                    <ColorToken label="Accent" value={selectedAccent} />
                    <ColorToken label="Background" value={activePresetPreview.background} />
                    <ColorToken label="Foreground" value={activePresetPreview.foreground} />
                  </div>
                  <div className="settings-swatch-row" role="group" aria-label="Accent">
                    {CONTROL_ACCENT_COLORS.map((accent) => (
                      <button
                        key={accent}
                        className={`settings-swatch-button ${themeAccent === accent ? "active" : ""}`}
                        type="button"
                        aria-pressed={themeAccent === accent}
                        aria-label={`${CONTROL_ACCENT_COLOR_LABELS[accent]} accent`}
                        style={{ "--settings-swatch": accentPreview[accent] } as CSSProperties}
                        onClick={() => updateThemeAccent(accent)}
                      >
                        <span aria-hidden="true" />
                        <strong>{CONTROL_ACCENT_COLOR_LABELS[accent]}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-control-group">
                  <div className="settings-field-heading">
                    <h4>Glass</h4>
                  </div>
                  <div className="settings-glass-grid" role="group" aria-label="Glass mode">
                    {CONTROL_GLASS_MODES.map((mode) => (
                      <button
                        key={mode}
                        className={glassMode === mode ? "active" : ""}
                        type="button"
                        aria-pressed={glassMode === mode}
                        onClick={() => updateGlassMode(mode)}
                      >
                        <strong>{CONTROL_GLASS_MODE_LABELS[mode]}</strong>
                        <span>{glassModeSummary[mode]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeCategory === "repository" && (
              <section className="settings-section" aria-label="Repository settings">
                <div className="settings-preference-grid">
                  {repositoryTabPreferenceKeys.map((tab) => (
                    <label key={tab} className="settings-preference-row">
                      <span>{repositoryTabPreferenceLabels[tab]}</span>
                      <select
                        aria-label={`${repositoryTabPreferenceLabels[tab]} tab visibility`}
                        value={repositoryTabPreferences[tab] ?? "auto"}
                        onChange={(event) =>
                          updateRepositoryTabPreference(
                            tab,
                            readOptionValue(event.target.value, ["auto", "show", "hide"] as const, "auto")
                          )
                        }
                      >
                        <option value="auto">Auto</option>
                        <option value="show">Show</option>
                        <option value="hide">Hide</option>
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {activeCategory === "data" && <DataSyncPanel />}
          </div>

          <footer className="settings-footer">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="dark-action"
              type="button"
              disabled={Boolean(saveDisabledReason)}
              title={saveDisabledReason ?? undefined}
              onClick={() => void handleSaveSettings()}
            >
              {saveBusy ? "Saving..." : "Save"}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function SettingsStatusMessages({
  signInError,
  signOutError,
  saveError,
  signOutStatus,
  saveStatus
}: {
  signInError: string | null;
  signOutError: string | null;
  saveError: string | null;
  signOutStatus: "idle" | "running" | "signedOut" | "error";
  saveStatus: "idle" | "saving" | "saved" | "error";
}): JSX.Element | null {
  if (signInError) {
    return <p className="settings-error">{signInError}</p>;
  }

  if (signOutError) {
    return <p className="settings-error">Could not sign out of GitHub: {signOutError}</p>;
  }

  if (saveError) {
    return <p className="settings-error">Could not save settings: {saveError}</p>;
  }

  if (signOutStatus === "signedOut") {
    return <p className="settings-success">Signed out of GitHub.</p>;
  }

  if (saveStatus === "saved") {
    return <p className="settings-success">Settings saved.</p>;
  }

  return null;
}

function ColorToken({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="settings-color-token">
      <span style={{ "--settings-swatch": value } as CSSProperties} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <small>{value}</small>
      </div>
    </div>
  );
}

function readOptionValue<T extends string>(value: string, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}
