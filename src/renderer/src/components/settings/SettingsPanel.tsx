import {
  ChevronDown,
  Database,
  FolderPlus,
  Monitor,
  Moon,
  Palette,
  Server,
  Settings as SettingsIcon,
  Sun,
  User,
  UserPlus,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useReducer, useRef, useState, type CSSProperties, type JSX } from "react";

import type {
  AppState,
  ControlAccentColor,
  ControlCodeFont,
  ControlSettings,
  ControlThemeCustomSettings,
  ControlThemeMode,
  ControlThemePaletteSettings,
  ControlThemePreset,
  ControlUiFont,
  GlassMode
} from "@shared/github";
import {
  CONTROL_ACCENT_COLORS,
  CONTROL_CODE_FONTS,
  CONTROL_CODE_FONT_LABELS,
  CONTROL_GLASS_MODES,
  CONTROL_GLASS_MODE_LABELS,
  CONTROL_THEME_MODES,
  CONTROL_THEME_PRESET_LABELS,
  CONTROL_UI_FONTS,
  CONTROL_UI_FONT_LABELS,
  DEFAULT_CONTROL_THEME_SETTINGS
} from "@shared/github";
import type { ProviderAuthController } from "../auth/providerAuthAdapters";
import { DataSyncPanel } from "./DataSyncPanel";

type SettingsCategory = "account" | "appearance" | "data";
type SignOutStatus = "idle" | "running" | "signedOut" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const settingsCategories: Array<{
  id: SettingsCategory;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
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
    texture: string;
    contrast: number;
  }
> = {
  "control-light": {
    background: "#EAF2FC",
    foreground: "#0F172A",
    surface: "rgba(234, 242, 252, 0.82)",
    accent: "#2563EB",
    texture: "#F7FBFF",
    contrast: 62
  },
  "control-dark": {
    background: "#101827",
    foreground: "#E5EDF7",
    surface: "rgba(30, 41, 59, 0.76)",
    accent: "#60A5FA",
    texture: "#263449",
    contrast: 60
  },
  "control-dim": {
    background: "#151e2c",
    foreground: "#D8DEE8",
    surface: "rgba(37, 49, 67, 0.78)",
    accent: "#7DD3FC",
    texture: "#273447",
    contrast: 52
  },
  "control-high-contrast-dark": {
    background: "#020617",
    foreground: "#FFFFFF",
    surface: "rgba(15, 23, 42, 0.92)",
    accent: "#BFDBFE",
    texture: "#1E293B",
    contrast: 82
  }
};

const accentPreview: Record<ControlAccentColor, string> = {
  blue: "#2563EB",
  green: "#1A7F37",
  purple: "#7C3AED",
  gray: "#475569"
};

const glassModeSummary: Record<GlassMode, string> = {
  "glass-shell": "Native glass",
  reduced: "Softer blur",
  solid: "Opaque surface"
};

const themeModeIcons: Record<ControlThemeMode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor
};

const lightThemePresetOptions: ControlThemePreset[] = ["control-light"];
const darkThemePresetOptions: ControlThemePreset[] = [
  "control-dark",
  "control-dim",
  "control-high-contrast-dark"
];

interface SettingsDraftState {
  activeCategory: SettingsCategory;
  signOutStatus: SignOutStatus;
  signOutError: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  glassMode: GlassMode;
  themeMode: ControlThemeMode;
  themePreset: ControlThemePreset;
  themeAccent: ControlAccentColor;
  customTheme: ControlThemeCustomSettings;
}

type SettingsDraftAction =
  | { type: "setActiveCategory"; value: SettingsCategory }
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
  | {
      type: "setThemePalette";
      scheme: "light" | "dark";
      key: keyof ControlThemePaletteSettings;
      value: string;
    }
  | { type: "setUiFont"; value: ControlUiFont }
  | { type: "setCodeFont"; value: ControlCodeFont };

interface SettingsPanelProps {
  appState?: AppState;
  authController: ProviderAuthController;
  onClose(): void;
  onOpenExternal(url: string): void;
  onAddLocalArea(): Promise<void> | void;
  onAddSshArea(): void;
  onPreviewSettings?(settings: Partial<ControlSettings> | null): void;
  onSave(settings: Partial<AppState["settings"]>): Promise<void>;
  systemColorScheme?: "light" | "dark";
}

function createSettingsDraftState(appState?: AppState): SettingsDraftState {
  return {
    activeCategory: "account",
    signOutStatus: "idle",
    signOutError: null,
    saveStatus: "idle",
    saveError: null,
    glassMode: appState?.settings.glassMode ?? "glass-shell",
    themeMode: appState?.settings.theme.mode ?? DEFAULT_CONTROL_THEME_SETTINGS.mode,
    themePreset: appState?.settings.theme.preset ?? DEFAULT_CONTROL_THEME_SETTINGS.preset,
    themeAccent: appState?.settings.theme.accent ?? DEFAULT_CONTROL_THEME_SETTINGS.accent,
    customTheme: cloneCustomThemeSettings(
      appState?.settings.theme.custom ?? DEFAULT_CONTROL_THEME_SETTINGS.custom
    )
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
    case "setThemePreset": {
      const nextPresetAccent = readAccentForColor(themePresetPreview[action.value].accent);
      return withUnsavedChange(state, {
        themePreset: action.value,
        themeAccent: nextPresetAccent ?? state.themeAccent,
        customTheme: applyPresetToCustomTheme(state.customTheme, action.value)
      });
    }
    case "setThemePalette": {
      const nextThemeAccent =
        action.key === "accent" ? (readAccentForColor(action.value) ?? state.themeAccent) : state.themeAccent;
      return withUnsavedChange(state, {
        themeAccent: nextThemeAccent,
        customTheme: updateCustomThemePalette(state.customTheme, action.scheme, action.key, action.value)
      });
    }
    case "setUiFont":
      return withUnsavedChange(state, {
        customTheme: { ...state.customTheme, uiFont: action.value }
      });
    case "setCodeFont":
      return withUnsavedChange(state, {
        customTheme: { ...state.customTheme, codeFont: action.value }
      });
  }
}

export function SettingsPanel({
  appState,
  authController,
  onClose,
  onOpenExternal,
  onAddLocalArea,
  onAddSshArea,
  onPreviewSettings,
  onSave,
  systemColorScheme = "light"
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
  const activeCategoryLabel =
    settingsCategories.find((category) => category.id === draft.activeCategory)?.label ?? "Settings";
  const activeThemeScheme = resolveActiveThemeScheme(draft.themeMode, systemColorScheme);

  useEffect(() => {
    if (!authController.completedAt || authController.completedAt === observedCompletedAt.current) {
      return;
    }

    observedCompletedAt.current = authController.completedAt;
    onClose();
  }, [authController.completedAt, onClose]);

  useEffect(() => () => onPreviewSettings?.(null), [onPreviewSettings]);

  useEffect(() => {
    onPreviewSettings?.({
      glassMode: draft.glassMode,
      theme: {
        mode: draft.themeMode,
        preset: draft.themePreset,
        accent: draft.themeAccent,
        custom: draft.customTheme
      }
    });
  }, [
    draft.customTheme,
    draft.glassMode,
    draft.themeAccent,
    draft.themeMode,
    draft.themePreset,
    onPreviewSettings
  ]);

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
          accent: draft.themeAccent,
          custom: draft.customTheme
        }
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
              saveError={draft.saveError}
              saveStatus={draft.saveStatus}
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

            {draft.activeCategory === "appearance" && (
              <AppearanceSettingsSection activeScheme={activeThemeScheme} draft={draft} dispatch={dispatch} />
            )}

            {draft.activeCategory === "data" && <DataSyncPanel />}
          </div>

          <SettingsPanelFooter
            saveBusy={saveBusy}
            saveDisabledReason={saveDisabledReason}
            onClose={onClose}
            onSave={startSaveSettings}
          />
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

function AppearanceSettingsSection({
  activeScheme,
  draft,
  dispatch
}: {
  activeScheme: "light" | "dark";
  draft: SettingsDraftState;
  dispatch(action: SettingsDraftAction): void;
}): JSX.Element {
  const activePalette = draft.customTheme[activeScheme];
  const activePresetOptions = getPresetOptionsForScheme(activeScheme);
  const activePreset = getVisiblePresetForScheme(draft.themePreset, activeScheme);
  const activeThemeTitle = activeScheme === "light" ? "Light theme" : "Dark theme";

  return (
    <section className="settings-section settings-appearance-section" aria-label="Appearance settings">
      <div className="settings-theme-composer">
        <div className="settings-theme-composer-header">
          <div>
            <h4>Theme</h4>
            <span>Use light, dark, or match your system</span>
          </div>
          <div className="settings-mode-tabs" role="group" aria-label="Theme mode">
            {CONTROL_THEME_MODES.map((mode) => {
              const Icon = themeModeIcons[mode];
              return (
                <button
                  key={mode}
                  className={draft.themeMode === mode ? "active" : ""}
                  type="button"
                  aria-pressed={draft.themeMode === mode}
                  onClick={() => dispatch({ type: "setThemeMode", value: mode })}
                >
                  <Icon size={14} />
                  {themeModeLabels[mode]}
                </button>
              );
            })}
          </div>
        </div>

        <ThemeCodePreview palette={activePalette} scheme={activeScheme} />
      </div>

      <ThemeDetailCard
        title={activeThemeTitle}
        selectLabel={activeThemeTitle}
        scheme={activeScheme}
        preset={activePreset}
        presetOptions={activePresetOptions}
        palette={activePalette}
        uiFont={draft.customTheme.uiFont}
        codeFont={draft.customTheme.codeFont}
        glassMode={draft.glassMode}
        dispatch={dispatch}
      />

      <div className="settings-appearance-list">
        <AppearanceValueRow label="Glass mode">
          <div className="settings-glass-segments" role="group" aria-label="Glass mode">
            {CONTROL_GLASS_MODES.map((mode) => (
              <button
                key={mode}
                className={draft.glassMode === mode ? "active" : ""}
                type="button"
                aria-pressed={draft.glassMode === mode}
                title={glassModeSummary[mode]}
                onClick={() => dispatch({ type: "setGlassMode", value: mode })}
              >
                {CONTROL_GLASS_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </AppearanceValueRow>
      </div>
    </section>
  );
}

function ThemeCodePreview({
  palette,
  scheme
}: {
  palette: ControlThemePaletteSettings;
  scheme: "light" | "dark";
}): JSX.Element {
  const contrast = calculateContrastScore(palette);
  const surface = scheme === "light" ? "sidebar" : "sidebar-elevated";

  return (
    <div
      className="settings-code-preview"
      style={
        {
          "--settings-preview-accent": palette.accent,
          "--settings-preview-background": palette.background,
          "--settings-preview-foreground": palette.foreground,
          "--settings-preview-texture": palette.texture
        } as CSSProperties
      }
    >
      <div className="settings-code-pane settings-code-pane-light" aria-hidden="true">
        <div>
          <span>1</span>
          <code>
            <strong>const</strong> themePreview: <em>ThemeConfig</em> = {"{"}
          </code>
        </div>
        <div>
          <span>2</span>
          <code>
            background: <em>"{palette.background}"</em>,
          </code>
        </div>
        <div>
          <span>3</span>
          <code>
            foreground: <em>"{palette.foreground}"</em>,
          </code>
        </div>
        <div>
          <span>4</span>
          <code>
            texture: <em>"{palette.texture}"</em>,
          </code>
        </div>
        <div>
          <span>5</span>
          <code>{"};"}</code>
        </div>
      </div>
      <div className="settings-code-pane settings-code-pane-dark" aria-hidden="true">
        <div>
          <span>1</span>
          <code>
            <strong>const</strong> themePreview: <em>ThemeConfig</em> = {"{"}
          </code>
        </div>
        <div>
          <span>2</span>
          <code>
            surface: <em>"{surface}"</em>,
          </code>
        </div>
        <div>
          <span>3</span>
          <code>
            accent: <em>"{palette.accent}"</em>,
          </code>
        </div>
        <div>
          <span>4</span>
          <code>contrast: {contrast},</code>
        </div>
        <div>
          <span>5</span>
          <code>{"};"}</code>
        </div>
      </div>
    </div>
  );
}

function ThemeDetailCard({
  title,
  selectLabel,
  scheme,
  preset,
  presetOptions,
  palette,
  uiFont,
  codeFont,
  glassMode,
  dispatch
}: {
  title: string;
  selectLabel: string;
  scheme: "light" | "dark";
  preset: ControlThemePreset;
  presetOptions: ControlThemePreset[];
  palette: ControlThemePaletteSettings;
  uiFont: ControlUiFont;
  codeFont: ControlCodeFont;
  glassMode: GlassMode;
  dispatch(action: SettingsDraftAction): void;
}): JSX.Element {
  const translucentShell = glassMode !== "solid";
  const contrast = calculateContrastScore(palette);

  return (
    <div className="settings-theme-card">
      <header>
        <h4>{title}</h4>
        <div className="settings-theme-card-actions">
          <button type="button" disabled title="Theme import is not available yet.">
            Import
          </button>
          <button type="button" disabled title="Theme copying is not available yet.">
            Copy theme
          </button>
          <label className="settings-theme-select">
            <span className="visually-hidden">{selectLabel}</span>
            <select
              aria-label={selectLabel}
              value={preset}
              onChange={(event) =>
                dispatch({
                  type: "setThemePreset",
                  value: readOptionValue(event.target.value, presetOptions, presetOptions[0])
                })
              }
            >
              {presetOptions.map((option) => (
                <option key={option} value={option}>
                  {CONTROL_THEME_PRESET_LABELS[option]}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>
      </header>

      <AppearanceValueRow label="Accent">
        <ColorField
          label={`${title} accent color`}
          value={palette.accent}
          onChange={(value) => dispatch({ type: "setThemePalette", scheme, key: "accent", value })}
        />
      </AppearanceValueRow>

      <AppearanceValueRow label="Background">
        <ColorField
          label={`${title} background color`}
          value={palette.background}
          onChange={(value) => dispatch({ type: "setThemePalette", scheme, key: "background", value })}
        />
      </AppearanceValueRow>
      <AppearanceValueRow label="Foreground">
        <ColorField
          label={`${title} foreground color`}
          value={palette.foreground}
          onChange={(value) => dispatch({ type: "setThemePalette", scheme, key: "foreground", value })}
        />
      </AppearanceValueRow>
      <AppearanceValueRow label="Texture">
        <ColorField
          label={`${title} texture color`}
          value={palette.texture}
          onChange={(value) => dispatch({ type: "setThemePalette", scheme, key: "texture", value })}
        />
      </AppearanceValueRow>
      <AppearanceValueRow label="UI font">
        <select
          className="settings-compact-select"
          aria-label={`${title} UI font`}
          value={uiFont}
          onChange={(event) =>
            dispatch({
              type: "setUiFont",
              value: readOptionValue(event.target.value, CONTROL_UI_FONTS, uiFont)
            })
          }
        >
          {CONTROL_UI_FONTS.map((font) => (
            <option key={font} value={font}>
              {CONTROL_UI_FONT_LABELS[font]}
            </option>
          ))}
        </select>
      </AppearanceValueRow>
      <AppearanceValueRow label="Code font">
        <select
          className="settings-compact-select"
          aria-label={`${title} code font`}
          value={codeFont}
          onChange={(event) =>
            dispatch({
              type: "setCodeFont",
              value: readOptionValue(event.target.value, CONTROL_CODE_FONTS, codeFont)
            })
          }
        >
          {CONTROL_CODE_FONTS.map((font) => (
            <option key={font} value={font}>
              {CONTROL_CODE_FONT_LABELS[font]}
            </option>
          ))}
        </select>
      </AppearanceValueRow>
      <AppearanceValueRow label="Translucent shell">
        <button
          className={`settings-switch ${translucentShell ? "active" : ""}`}
          type="button"
          role="switch"
          aria-checked={translucentShell}
          onClick={() =>
            dispatch({ type: "setGlassMode", value: translucentShell ? "solid" : "glass-shell" })
          }
        >
          <span />
        </button>
      </AppearanceValueRow>
      <AppearanceValueRow label="Contrast">
        <div className="settings-contrast-preview">
          <span>
            <i style={{ insetInlineEnd: `${100 - contrast}%` }} />
          </span>
          <strong>{contrast}</strong>
        </div>
      </AppearanceValueRow>
    </div>
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
    <footer className="settings-footer">
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

function AppearanceValueRow({
  label,
  children
}: {
  label: string;
  children: JSX.Element | JSX.Element[];
}): JSX.Element {
  return (
    <div className="settings-appearance-row">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}): JSX.Element {
  const [draftState, setDraftState] = useState({ source: value, draft: value });
  const draft = draftState.source === value ? draftState.draft : value;
  const normalizedValue = normalizeHexColor(value) ?? "#000000";

  return (
    <div className="settings-color-field">
      <input
        aria-label={`${label} picker`}
        className="settings-color-picker"
        type="color"
        value={normalizedValue}
        onChange={(event) => {
          const nextValue = event.target.value.toUpperCase();
          setDraftState({ source: value, draft: nextValue });
          onChange(nextValue);
        }}
      />
      <input
        aria-label={label}
        className="settings-color-text"
        spellCheck={false}
        value={draft}
        onBlur={() => setDraftState({ source: value, draft: value })}
        onChange={(event) => {
          const nextDraft = event.target.value.toUpperCase();
          const nextValue = normalizeHexColor(nextDraft);
          setDraftState({ source: value, draft: nextDraft });
          if (nextValue) {
            onChange(nextValue);
          }
        }}
      />
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

function cloneCustomThemeSettings(customTheme: ControlThemeCustomSettings): ControlThemeCustomSettings {
  return {
    light: { ...customTheme.light },
    dark: { ...customTheme.dark },
    uiFont: customTheme.uiFont,
    codeFont: customTheme.codeFont
  };
}

function resolveActiveThemeScheme(
  themeMode: ControlThemeMode,
  systemColorScheme: "light" | "dark"
): "light" | "dark" {
  return themeMode === "system" ? systemColorScheme : themeMode;
}

function getPresetOptionsForScheme(scheme: "light" | "dark"): ControlThemePreset[] {
  return scheme === "light" ? lightThemePresetOptions : darkThemePresetOptions;
}

function getVisiblePresetForScheme(preset: ControlThemePreset, scheme: "light" | "dark"): ControlThemePreset {
  if (scheme === "light") {
    return "control-light";
  }

  return preset === "control-light" ? "control-dark" : preset;
}

function updateCustomThemePalette(
  customTheme: ControlThemeCustomSettings,
  scheme: "light" | "dark",
  key: keyof ControlThemePaletteSettings,
  value: string
): ControlThemeCustomSettings {
  return {
    ...customTheme,
    [scheme]: {
      ...customTheme[scheme],
      [key]: value
    }
  };
}

function applyPresetToCustomTheme(
  customTheme: ControlThemeCustomSettings,
  preset: ControlThemePreset
): ControlThemeCustomSettings {
  const presetPreview = themePresetPreview[preset];
  const scheme = preset === "control-light" ? "light" : "dark";

  return updateCustomThemePalette(
    updateCustomThemePalette(
      updateCustomThemePalette(
        updateCustomThemePalette(customTheme, scheme, "accent", presetPreview.accent),
        scheme,
        "texture",
        presetPreview.texture
      ),
      scheme,
      "background",
      presetPreview.background
    ),
    scheme,
    "foreground",
    presetPreview.foreground
  );
}

function readAccentForColor(value: string): ControlAccentColor | null {
  const normalizedValue = normalizeHexColor(value);
  if (!normalizedValue) {
    return null;
  }

  return CONTROL_ACCENT_COLORS.find((accent) => accentPreview[accent] === normalizedValue) ?? null;
}

function normalizeHexColor(value: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : null;
}

function calculateContrastScore(palette: ControlThemePaletteSettings): number {
  const background = readRelativeLuminance(palette.background);
  const foreground = readRelativeLuminance(palette.foreground);

  if (background === null || foreground === null) {
    return 0;
  }

  const lighter = Math.max(background, foreground);
  const darker = Math.min(background, foreground);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(Math.min(100, Math.max(0, ((ratio - 1) / 20) * 100)));
}

function readRelativeLuminance(hexColor: string): number | null {
  const normalizedColor = normalizeHexColor(hexColor);
  if (!normalizedColor) {
    return null;
  }

  const channels = [1, 3, 5].map((start) => Number.parseInt(normalizedColor.slice(start, start + 2), 16));
  const [red, green, blue] = channels.map((channel) => {
    const normalizedChannel = channel / 255;
    return normalizedChannel <= 0.03928
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function readOptionValue<T extends string>(value: string, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}
