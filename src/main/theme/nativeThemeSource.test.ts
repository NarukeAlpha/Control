import { describe, expect, it } from "vitest";

import { DEFAULT_CONTROL_THEME_SETTINGS, type ControlSettings } from "@shared/github";
import { applyNativeThemeSource } from "./nativeThemeSource";

const baseSettings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell",
  theme: DEFAULT_CONTROL_THEME_SETTINGS,
  repositoryTabPreferences: {}
};

describe("applyNativeThemeSource", () => {
  it.each(["system", "light", "dark"] as const)("applies %s theme mode to Electron", (mode) => {
    const nativeTheme = { themeSource: "light" as const };

    applyNativeThemeSource({ ...baseSettings, theme: { ...baseSettings.theme, mode } }, nativeTheme);

    expect(nativeTheme.themeSource).toBe(mode);
  });
});
