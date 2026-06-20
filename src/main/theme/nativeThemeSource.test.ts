import { describe, expect, it } from "vitest";

import { DEFAULT_CONTROL_THEME_SETTINGS, type ControlSettings } from "@shared/github";
import { applyNativeThemeSource } from "./nativeThemeSource";

const baseSettings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell",
  theme: DEFAULT_CONTROL_THEME_SETTINGS,
  repositoryTabPreferences: {},
  repositoryTabPreferencesByRepository: {}
};

describe("applyNativeThemeSource", () => {
  it("applies the light theme mode to Electron", () => {
    const nativeTheme = { themeSource: "light" as const };

    applyNativeThemeSource(baseSettings, nativeTheme);

    expect(nativeTheme.themeSource).toBe("light");
  });
});
