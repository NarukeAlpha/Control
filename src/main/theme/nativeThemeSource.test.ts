import { describe, expect, it } from "vitest";

import type { ControlSettings } from "@shared/github";
import { applyNativeThemeSource } from "./nativeThemeSource";

const baseSettings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell",
  theme: {
    mode: "system",
    preset: "control-light",
    accent: "blue"
  },
  repositoryTabPreferences: {}
};

describe("applyNativeThemeSource", () => {
  it.each(["system", "light", "dark"] as const)("applies %s theme mode to Electron", (mode) => {
    const nativeTheme = { themeSource: "light" as const };

    applyNativeThemeSource({ ...baseSettings, theme: { ...baseSettings.theme, mode } }, nativeTheme);

    expect(nativeTheme.themeSource).toBe(mode);
  });
});
