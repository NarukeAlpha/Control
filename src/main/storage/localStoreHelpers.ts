import {
  CONTROL_ACCENT_COLORS,
  CONTROL_CODE_FONTS,
  CONTROL_GLASS_MODES,
  CONTROL_THEME_MODES,
  CONTROL_THEME_PRESETS,
  CONTROL_UI_FONTS,
  DEFAULT_CONTROL_THEME_SETTINGS,
  type ControlAccentColor,
  type ControlCodeFont,
  type ControlSettings,
  type ControlThemeMode,
  type ControlThemePaletteSettings,
  type ControlThemePreset,
  type ControlUiFont,
  type RepositoryTabPreferenceKey,
  type RepositoryTabPreferenceMap,
  type RepositoryTabPreferencesByRepository
} from "@shared/github";

const repositoryTabPreferenceKeys = [
  "agents",
  "discussions",
  "projects",
  "releases",
  "contributors",
  "wiki",
  "securityQuality"
] satisfies RepositoryTabPreferenceKey[];

export const defaultSettings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell",
  theme: cloneDefaultThemeSettings(),
  repositoryTabPreferences: {},
  repositoryTabPreferencesByRepository: {}
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
    repositoryTabPreferences: normalizeRepositoryTabPreferences(settings.repositoryTabPreferences),
    repositoryTabPreferencesByRepository: normalizeRepositoryTabPreferencesByRepository(
      settings.repositoryTabPreferencesByRepository
    )
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
        ? mergeThemePatch(currentSettings.theme, settingsPatch.theme)
        : (settingsPatch.theme ?? currentSettings.theme)
  });
}

function normalizeThemeSettings(theme: unknown): ControlSettings["theme"] {
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
    return cloneDefaultThemeSettings();
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
    ),
    custom: normalizeThemeCustomSettings(rawTheme.custom)
  };
}

function normalizeLiteral<T extends string>(value: unknown, allowedValues: readonly T[], fallback: T): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

function mergeThemePatch(
  currentTheme: ControlSettings["theme"],
  themePatch: Partial<ControlSettings["theme"]>
): ControlSettings["theme"] {
  const rawCustom =
    themePatch.custom && typeof themePatch.custom === "object" && !Array.isArray(themePatch.custom)
      ? themePatch.custom
      : undefined;

  return {
    ...currentTheme,
    ...themePatch,
    custom: rawCustom
      ? {
          ...currentTheme.custom,
          ...rawCustom,
          light: mergePalettePatch(currentTheme.custom.light, rawCustom.light),
          dark: mergePalettePatch(currentTheme.custom.dark, rawCustom.dark)
        }
      : currentTheme.custom
  };
}

function mergePalettePatch(
  currentPalette: ControlThemePaletteSettings,
  palettePatch: unknown
): ControlThemePaletteSettings {
  if (!palettePatch || typeof palettePatch !== "object" || Array.isArray(palettePatch)) {
    return currentPalette;
  }

  return {
    ...currentPalette,
    ...palettePatch
  };
}

function normalizeThemeCustomSettings(custom: unknown): ControlSettings["theme"]["custom"] {
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) {
    return cloneDefaultThemeSettings().custom;
  }

  const rawCustom = custom as Partial<Record<keyof ControlSettings["theme"]["custom"], unknown>>;
  return {
    light: normalizePaletteSettings(rawCustom.light, DEFAULT_CONTROL_THEME_SETTINGS.custom.light),
    dark: normalizePaletteSettings(rawCustom.dark, DEFAULT_CONTROL_THEME_SETTINGS.custom.dark),
    uiFont: normalizeLiteral<ControlUiFont>(
      rawCustom.uiFont,
      CONTROL_UI_FONTS,
      DEFAULT_CONTROL_THEME_SETTINGS.custom.uiFont
    ),
    codeFont: normalizeLiteral<ControlCodeFont>(
      rawCustom.codeFont,
      CONTROL_CODE_FONTS,
      DEFAULT_CONTROL_THEME_SETTINGS.custom.codeFont
    )
  };
}

function normalizePaletteSettings(
  palette: unknown,
  fallback: ControlThemePaletteSettings
): ControlThemePaletteSettings {
  if (!palette || typeof palette !== "object" || Array.isArray(palette)) {
    return { ...fallback };
  }

  const rawPalette = palette as Partial<Record<keyof ControlThemePaletteSettings, unknown>>;
  return {
    accent: normalizeHexColor(rawPalette.accent, fallback.accent),
    background: normalizeHexColor(rawPalette.background, fallback.background),
    foreground: normalizeHexColor(rawPalette.foreground, fallback.foreground)
  };
}

function normalizeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

function cloneDefaultThemeSettings(): ControlSettings["theme"] {
  return {
    ...DEFAULT_CONTROL_THEME_SETTINGS,
    custom: {
      light: { ...DEFAULT_CONTROL_THEME_SETTINGS.custom.light },
      dark: { ...DEFAULT_CONTROL_THEME_SETTINGS.custom.dark },
      uiFont: DEFAULT_CONTROL_THEME_SETTINGS.custom.uiFont,
      codeFont: DEFAULT_CONTROL_THEME_SETTINGS.custom.codeFont
    }
  };
}

function normalizeRepositoryTabPreferences(preferences: unknown): RepositoryTabPreferenceMap {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return defaultSettings.repositoryTabPreferences;
  }

  const normalized: RepositoryTabPreferenceMap = {};
  for (const key of repositoryTabPreferenceKeys) {
    const value = (preferences as Partial<Record<RepositoryTabPreferenceKey, unknown>>)[key];
    if (value === "auto" || value === "show" || value === "hide") {
      normalized[key] = value;
    }
  }

  return normalized;
}

function normalizeRepositoryTabPreferencesByRepository(
  preferencesByRepository: unknown
): RepositoryTabPreferencesByRepository {
  if (
    !preferencesByRepository ||
    typeof preferencesByRepository !== "object" ||
    Array.isArray(preferencesByRepository)
  ) {
    return defaultSettings.repositoryTabPreferencesByRepository;
  }

  const normalized: RepositoryTabPreferencesByRepository = {};
  for (const [rawNameWithOwner, rawPreferences] of Object.entries(preferencesByRepository)) {
    const nameWithOwner = normalizeRepositoryNameWithOwner(rawNameWithOwner);
    if (!nameWithOwner) {
      continue;
    }
    const preferences = normalizeRepositoryTabPreferences(rawPreferences);
    if (Object.keys(preferences).length > 0) {
      normalized[nameWithOwner] = preferences;
    }
  }

  return normalized;
}

function normalizeRepositoryNameWithOwner(value: string): string | null {
  const [owner = "", name = "", ...extra] = value.trim().split("/");
  if (!owner || !name || extra.length > 0) {
    return null;
  }
  return `${owner}/${name}`;
}
