import { useEffect, useMemo, useState } from "react";

import { DEFAULT_CONTROL_THEME_SETTINGS, type ControlThemeSettings } from "@shared/github";

export interface ResolvedControlTheme {
  requestedMode: ControlThemeSettings["mode"];
  resolvedMode: "light" | "dark";
  preset: ControlThemeSettings["preset"];
  accent: ControlThemeSettings["accent"];
  colorScheme: "light" | "dark";
}

export type ControlThemeStyleVars = Record<`--${string}`, string>;

const uiFontStacks: Record<ControlThemeSettings["custom"]["uiFont"], string> = {
  inter:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
  system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
  satoshi:
    'Satoshi, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
};

const codeFontStacks: Record<ControlThemeSettings["custom"]["codeFont"], string> = {
  "sf-mono": '"SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", monospace',
  "jetbrains-mono": '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  "fira-code": '"Fira Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  monaco: 'Monaco, "SFMono-Regular", Consolas, "Liberation Mono", monospace'
};

export function resolveControlTheme(
  settings: ControlThemeSettings | undefined,
  systemPrefersDark: boolean
): ResolvedControlTheme {
  const theme = settings ?? DEFAULT_CONTROL_THEME_SETTINGS;
  const resolvedMode = theme.mode === "system" ? (systemPrefersDark ? "dark" : "light") : theme.mode;
  const preset =
    resolvedMode === "light"
      ? "control-light"
      : theme.preset === "control-light"
        ? "control-dark"
        : theme.preset;

  return {
    requestedMode: theme.mode,
    resolvedMode,
    preset,
    accent: theme.accent,
    colorScheme: resolvedMode
  };
}

export function resolveControlThemeStyleVars(
  settings: ControlThemeSettings | undefined,
  resolvedMode: "light" | "dark"
): ControlThemeStyleVars {
  const theme = settings ?? DEFAULT_CONTROL_THEME_SETTINGS;
  const custom = theme.custom ?? DEFAULT_CONTROL_THEME_SETTINGS.custom;
  const palette = resolvedMode === "dark" ? custom.dark : custom.light;
  const surfaceLift = resolvedMode === "dark" ? "#FFFFFF" : "#F7FBFF";
  const surfaceShadow = resolvedMode === "dark" ? "#000000" : "#D6E4F3";
  const text = palette.foreground;
  const background = palette.background;
  const accent = palette.accent;

  return {
    "--font-ui-family": uiFontStacks[custom.uiFont],
    "--font-code-family": codeFontStacks[custom.codeFont],
    "--color-text": text,
    "--color-heading": text,
    "--color-text-muted": colorMix(text, 68, background),
    "--color-text-subtle": colorMix(text, 50, background),
    "--color-disabled-text": colorMix(text, 54, background),
    "--color-app-background": background,
    "--color-surface-solid": background,
    "--color-surface-glass": colorMix(background, resolvedMode === "dark" ? 72 : 74, "transparent"),
    "--color-surface-glass-strong": colorMix(background, resolvedMode === "dark" ? 86 : 82, surfaceLift),
    "--color-surface-elevated": colorMix(background, resolvedMode === "dark" ? 92 : 86, surfaceLift),
    "--color-surface-row": colorMix(background, resolvedMode === "dark" ? 82 : 78, surfaceLift),
    "--color-surface-row-hover": colorMix(background, resolvedMode === "dark" ? 74 : 68, surfaceLift),
    "--color-surface-control": colorMix(background, resolvedMode === "dark" ? 78 : 76, surfaceLift),
    "--color-surface-control-hover": colorMix(background, resolvedMode === "dark" ? 70 : 66, surfaceLift),
    "--color-border": colorMix(text, resolvedMode === "dark" ? 22 : 14, "transparent"),
    "--color-border-strong": colorMix(text, resolvedMode === "dark" ? 34 : 28, "transparent"),
    "--color-glass-border": colorMix(text, resolvedMode === "dark" ? 20 : 18, "transparent"),
    "--color-shell-border": colorMix(surfaceLift, resolvedMode === "dark" ? 18 : 76, "transparent"),
    "--color-accent": accent,
    "--color-accent-strong": colorMix(accent, resolvedMode === "dark" ? 72 : 82, text),
    "--color-accent-muted": colorMix(accent, resolvedMode === "dark" ? 22 : 14, "transparent"),
    "--color-focus-ring": accent,
    "--color-surface-selected": colorMix(accent, resolvedMode === "dark" ? 24 : 10, "transparent"),
    "--color-selection-background": colorMix(accent, resolvedMode === "dark" ? 36 : 22, "transparent"),
    "--color-selection-text": resolvedMode === "dark" ? "#F8FAFC" : "#08111F",
    "--color-code-background": colorMix(background, resolvedMode === "dark" ? 86 : 88, surfaceShadow),
    "--color-code-text": text,
    "--color-overlay": colorMix(background, resolvedMode === "dark" ? 62 : 22, "transparent")
  };
}

export function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => readSystemPrefersDark());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const syncPreference = (event: Pick<MediaQueryList, "matches">) => {
      setPrefersDark(event.matches);
    };

    query.addEventListener("change", syncPreference);
    return () => query.removeEventListener("change", syncPreference);
  }, []);

  return prefersDark;
}

export function useResolvedControlTheme(settings: ControlThemeSettings | undefined): ResolvedControlTheme {
  const systemPrefersDark = useSystemPrefersDark();
  return useMemo(() => resolveControlTheme(settings, systemPrefersDark), [settings, systemPrefersDark]);
}

function readSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function colorMix(color: string, colorPercent: number, otherColor: string): string {
  return `color-mix(in srgb, ${color} ${colorPercent}%, ${otherColor})`;
}
