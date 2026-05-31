import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONTROL_THEME_SETTINGS, type ControlThemeSettings } from "@shared/github";
import { resolveControlTheme, useResolvedControlTheme } from "./themeSettings";

describe("themeSettings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["light", false, "light", "light"],
    ["dark", false, "dark", "dark"],
    ["system", false, "light", "light"],
    ["system", true, "dark", "dark"]
  ] as const)(
    "resolves %s mode with systemPrefersDark=%s",
    (mode, systemPrefersDark, resolvedMode, colorScheme) => {
      expect(
        resolveControlTheme(
          {
            mode,
            preset: "control-high-contrast-dark",
            accent: "purple"
          },
          systemPrefersDark
        )
      ).toEqual({
        requestedMode: mode,
        resolvedMode,
        colorScheme,
        preset: "control-high-contrast-dark",
        accent: "purple"
      });
    }
  );

  it("falls back to default theme settings when settings are missing", () => {
    expect(resolveControlTheme(undefined, true)).toEqual({
      requestedMode: DEFAULT_CONTROL_THEME_SETTINGS.mode,
      resolvedMode: "dark",
      colorScheme: "dark",
      preset: DEFAULT_CONTROL_THEME_SETTINGS.preset,
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
      accent: "blue"
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
});
