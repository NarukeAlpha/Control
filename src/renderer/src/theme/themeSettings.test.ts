import { describe, expect, it } from "vitest";

import { DEFAULT_CONTROL_THEME_SETTINGS } from "@shared/github";
import { resolveControlTheme, resolveControlThemeStyleVars } from "./themeSettings";

describe("themeSettings", () => {
  it("resolves the only app theme as light", () => {
    expect(
      resolveControlTheme({
        mode: "light",
        preset: "control-light",
        accent: "purple",
        custom: DEFAULT_CONTROL_THEME_SETTINGS.custom
      })
    ).toEqual({
      requestedMode: "light",
      resolvedMode: "light",
      colorScheme: "light",
      preset: "control-light",
      accent: "purple"
    });
  });

  it("falls back to default theme settings when settings are missing", () => {
    expect(resolveControlTheme(undefined)).toEqual({
      requestedMode: DEFAULT_CONTROL_THEME_SETTINGS.mode,
      resolvedMode: "light",
      colorScheme: "light",
      preset: "control-light",
      accent: DEFAULT_CONTROL_THEME_SETTINGS.accent
    });
  });

  it("maps custom palette and font settings to shell CSS variables", () => {
    expect(
      resolveControlThemeStyleVars({
        mode: "light",
        preset: "control-light",
        accent: "purple",
        custom: {
          light: {
            accent: "#FF5C5C",
            background: "#F8FAFC",
            foreground: "#172033",
            texture: "#EAF2FC"
          },
          uiFont: "satoshi",
          codeFont: "jetbrains-mono"
        }
      })
    ).toMatchObject({
      "--color-accent": "#FF5C5C",
      "--color-surface-solid": "#F8FAFC",
      "--color-surface-glass": "color-mix(in srgb, #EAF2FC 46%, transparent)",
      "--color-surface-primary": "color-mix(in srgb, #EAF2FC 46%, transparent)",
      "--color-surface-secondary": "color-mix(in srgb, #EAF2FC 60%, #F8FAFC)",
      "--color-surface-hover": "color-mix(in srgb, #EAF2FC 74%, #F8FAFC)",
      "--color-surface-row": "color-mix(in srgb, #EAF2FC 60%, #F8FAFC)",
      "--color-surface-selected": "color-mix(in srgb, #FF5C5C 16%, #EAF2FC)",
      "--color-text": "#172033",
      "--color-texture": "#EAF2FC",
      "--color-document-background": "#ffffff",
      "--color-document-text": "#1f2328",
      "--color-document-link": "#0969da",
      "--color-source-background": "#ffffff",
      "--color-source-text": "#1f2328",
      "--color-code-background": "#ffffff",
      "--color-code-text": "#1f2328",
      "--color-data-strong": "#30A14E",
      "--color-data-peak": "#216E39",
      "--color-data-line": "#2DA44E",
      "--font-ui-family": expect.stringContaining("Satoshi"),
      "--font-code-family": expect.stringContaining("JetBrains Mono")
    });
  });
});
