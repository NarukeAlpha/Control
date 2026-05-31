import {
  CONTROL_ACCENT_COLORS,
  CONTROL_GLASS_MODES,
  CONTROL_THEME_MODES,
  CONTROL_THEME_PRESETS,
  DEFAULT_CONTROL_THEME_SETTINGS,
  type ControlAccentColor,
  type ControlSettings,
  type ControlThemeMode,
  type ControlThemePreset,
  type RepositoryTabPreference,
  type RepositoryTabPreferenceKey
} from "@shared/github";

const repositoryTabPreferenceKeys = [
  "agents",
  "discussions",
  "projects",
  "releases",
  "contributors",
  "wiki",
  "securityQuality",
  "settings"
] satisfies RepositoryTabPreferenceKey[];

export const defaultSettings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell",
  theme: { ...DEFAULT_CONTROL_THEME_SETTINGS },
  repositoryTabPreferences: {}
};

export function cacheExpiresAtIsExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now();
}

export function normalizeSettings(settings: Record<string, unknown>): ControlSettings {
  const credentialProvider =
    settings.credentialProvider === "github-oauth" ? "github-oauth" : defaultSettings.credentialProvider;
  return {
    credentialProvider,
    glassMode: normalizeLiteral(settings.glassMode, CONTROL_GLASS_MODES, defaultSettings.glassMode),
    theme: normalizeThemeSettings(settings.theme),
    repositoryTabPreferences: normalizeRepositoryTabPreferences(settings.repositoryTabPreferences)
  };
}

export function mergeSettingsPatch(
  currentSettings: ControlSettings,
  settingsPatch: Partial<ControlSettings>
): ControlSettings {
  return normalizeSettings({
    ...currentSettings,
    ...settingsPatch,
    theme:
      settingsPatch.theme && typeof settingsPatch.theme === "object" && !Array.isArray(settingsPatch.theme)
        ? {
            ...currentSettings.theme,
            ...settingsPatch.theme
          }
        : (settingsPatch.theme ?? currentSettings.theme)
  });
}

function normalizeThemeSettings(theme: unknown): ControlSettings["theme"] {
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
    return { ...defaultSettings.theme };
  }

  const rawTheme = theme as Partial<Record<keyof ControlSettings["theme"], unknown>>;
  return {
    mode: normalizeLiteral<ControlThemeMode>(
      rawTheme.mode,
      CONTROL_THEME_MODES,
      DEFAULT_CONTROL_THEME_SETTINGS.mode
    ),
    preset: normalizeLiteral<ControlThemePreset>(
      rawTheme.preset,
      CONTROL_THEME_PRESETS,
      DEFAULT_CONTROL_THEME_SETTINGS.preset
    ),
    accent: normalizeLiteral<ControlAccentColor>(
      rawTheme.accent,
      CONTROL_ACCENT_COLORS,
      DEFAULT_CONTROL_THEME_SETTINGS.accent
    )
  };
}

function normalizeLiteral<T extends string>(value: unknown, allowedValues: readonly T[], fallback: T): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

function normalizeRepositoryTabPreferences(
  preferences: unknown
): Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>> {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return defaultSettings.repositoryTabPreferences;
  }

  const normalized: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>> = {};
  for (const key of repositoryTabPreferenceKeys) {
    const value = (preferences as Partial<Record<RepositoryTabPreferenceKey, unknown>>)[key];
    if (value === "auto" || value === "show" || value === "hide") {
      normalized[key] = value;
    }
  }

  return normalized;
}
