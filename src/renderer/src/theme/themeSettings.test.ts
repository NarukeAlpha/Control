import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONTROL_THEME_SETTINGS, type ControlThemeSettings } from "@shared/github";
import { resolveControlTheme, resolveControlThemeStyleVars, useResolvedControlTheme } from "./themeSettings";

describe("themeSettings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["light", false, "light", "light", "control-light"],
    ["dark", false, "dark", "dark", "control-high-contrast-dark"],
    ["system", false, "light", "light", "control-light"],
    ["system", true, "dark", "dark", "control-high-contrast-dark"]
  ] as const)(
    "resolves %s mode with systemPrefersDark=%s",
    (mode, systemPrefersDark, resolvedMode, colorScheme, preset) => {
      expect(
        resolveControlTheme(
          {
            mode,
            preset: "control-high-contrast-dark",
            accent: "purple",
            custom: DEFAULT_CONTROL_THEME_SETTINGS.custom
          },
          systemPrefersDark
        )
      ).toEqual({
        requestedMode: mode,
        resolvedMode,
        colorScheme,
        preset,
        accent: "purple"
      });
    }
  );

  it("maps light presets away from dark mode", () => {
    expect(
      resolveControlTheme(
        {
          mode: "dark",
          preset: "control-light",
          accent: "blue",
          custom: DEFAULT_CONTROL_THEME_SETTINGS.custom
        },
        false
      ).preset
    ).toBe("control-dark");
  });

  it("falls back to default theme settings when settings are missing", () => {
    expect(resolveControlTheme(undefined, true)).toEqual({
      requestedMode: DEFAULT_CONTROL_THEME_SETTINGS.mode,
      resolvedMode: "dark",
      colorScheme: "dark",
      preset: "control-dark",
      accent: DEFAULT_CONTROL_THEME_SETTINGS.accent
    });
  });

  it("updates system mode when the OS color-scheme preference changes", () => {
    let listener: ((event: Pick<MediaQueryList, "matches">) => void) | null = null;
    let matches = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        () =>
          ({
            get matches() {
              return matches;
            },
            addEventListener: (
              _event: "change",
              nextListener: (event: Pick<MediaQueryList, "matches">) => void
            ) => {
              listener = nextListener;
            },
            removeEventListener: vi.fn()
          }) as unknown as MediaQueryList
      )
    );
    const settings: ControlThemeSettings = {
      mode: "system",
      preset: "control-dark",
      accent: "blue",
      custom: DEFAULT_CONTROL_THEME_SETTINGS.custom
    };

    const { result } = renderHook(() => useResolvedControlTheme(settings));

    expect(result.current.colorScheme).toBe("light");

    act(() => {
      matches = true;
      listener?.({ matches });
    });

    expect(result.current).toEqual({
      requestedMode: "system",
      resolvedMode: "dark",
      colorScheme: "dark",
      preset: "control-dark",
      accent: "blue"
    });
  });

  it("maps custom palette and font settings to shell CSS variables", () => {
    expect(
      resolveControlThemeStyleVars(
        {
          mode: "dark",
          preset: "control-dark",
          accent: "purple",
          custom: {
            light: DEFAULT_CONTROL_THEME_SETTINGS.custom.light,
            dark: {
              accent: "#FF5C5C",
              background: "#111827",
              foreground: "#E4E4E7",
              texture: "#263449"
            },
            uiFont: "satoshi",
            codeFont: "jetbrains-mono"
          }
        },
        "dark"
      )
    ).toMatchObject({
      "--color-accent": "#FF5C5C",
      "--color-surface-solid": "#111827",
      "--color-surface-glass": "color-mix(in srgb, #263449 58%, transparent)",
      "--color-surface-primary": "color-mix(in srgb, #263449 58%, transparent)",
      "--color-surface-secondary": "color-mix(in srgb, #263449 66%, #111827)",
      "--color-surface-hover": "color-mix(in srgb, #263449 78%, #111827)",
      "--color-surface-row": "color-mix(in srgb, #263449 66%, #111827)",
      "--color-surface-selected": "color-mix(in srgb, #FF5C5C 22%, #263449)",
      "--color-text": "#E4E4E7",
      "--color-texture": "#263449",
      "--color-data-strong": "#26A641",
      "--color-data-peak": "#39D353",
      "--color-data-line": "#2DA44E",
      "--font-ui-family": expect.stringContaining("Satoshi"),
      "--font-code-family": expect.stringContaining("JetBrains Mono")
    });
  });
});
