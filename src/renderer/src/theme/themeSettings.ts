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

const contentPalettes = {
  light: {
    documentBackground: "#ffffff",
    documentSurface: "#f6f8fa",
    documentText: "#1f2328",
    documentHeading: "#0f172a",
    documentMuted: "#57606a",
    documentBorder: "#d0d7de",
    documentCodeBackground: "rgba(175, 184, 193, 0.2)",
    documentLink: "#0969da",
    documentReferenceBackground: "rgba(9, 105, 218, 0.08)",
    sourceBackground: "#ffffff",
    sourceText: "#1f2328",
    sourceMuted: "#6e7781",
    sourceGutter: "#6e7781",
    sourceGutterBackground: "#f6f8fa",
    sourceHighlight: "#fff8c5"
  },
  dark: {
    documentBackground: "#0d1117",
    documentSurface: "#161b22",
    documentText: "#e6edf3",
    documentHeading: "#f0f6fc",
    documentMuted: "#8b949e",
    documentBorder: "#30363d",
    documentCodeBackground: "rgba(110, 118, 129, 0.4)",
    documentLink: "#58a6ff",
    documentReferenceBackground: "rgba(56, 139, 253, 0.14)",
    sourceBackground: "#0d1117",
    sourceText: "#e6edf3",
    sourceMuted: "#8b949e",
    sourceGutter: "#7d8590",
    sourceGutterBackground: "#161b22",
    sourceHighlight: "rgba(187, 128, 9, 0.22)"
  }
} as const;

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
  const darkMode = resolvedMode === "dark";
  const contentPalette = contentPalettes[resolvedMode];
  const text = palette.foreground;
  const background = palette.background;
  const accent = palette.accent;
  const texture = palette.texture;
  const dataColors = darkMode ? darkActivityDataColors : lightActivityDataColors;
  const surfaceGlass = colorMix(texture, darkMode ? 58 : 46, "transparent");
  const surfaceGlassStrong = colorMix(texture, darkMode ? 76 : 70, background);
  const surfaceElevated = colorMix(texture, darkMode ? 86 : 82, background);
  const surfaceRow = colorMix(texture, darkMode ? 66 : 60, background);
  const surfaceRowHover = colorMix(texture, darkMode ? 78 : 74, background);
  const surfaceControl = colorMix(texture, darkMode ? 72 : 66, background);
  const surfaceControlHover = colorMix(texture, darkMode ? 84 : 80, background);

  return {
    "--font-ui-family": uiFontStacks[custom.uiFont],
    "--font-code-family": codeFontStacks[custom.codeFont],
    "--color-text": text,
    "--color-heading": text,
    "--color-text-muted": colorMix(text, 68, background),
    "--color-text-subtle": colorMix(text, 50, background),
    "--color-disabled-text": colorMix(text, 54, background),
    "--color-app-background": background,
    "--color-texture": texture,
    "--color-texture-muted": colorMix(texture, darkMode ? 30 : 28, "transparent"),
    "--color-surface-solid": background,
    "--color-surface-glass": surfaceGlass,
    "--color-surface-glass-strong": surfaceGlassStrong,
    "--color-surface-primary": surfaceGlass,
    "--color-surface-secondary": surfaceRow,
    "--color-surface-hover": surfaceRowHover,
    "--color-surface-elevated": surfaceElevated,
    "--color-surface-row": surfaceRow,
    "--color-surface-row-hover": surfaceRowHover,
    "--color-surface-control": surfaceControl,
    "--color-surface-control-hover": surfaceControlHover,
    "--color-surface-highlight": colorMix(text, darkMode ? 14 : 12, "transparent"),
    "--color-border": colorMix(text, darkMode ? 22 : 14, "transparent"),
    "--color-border-strong": colorMix(text, darkMode ? 34 : 28, "transparent"),
    "--color-glass-border": colorMix(text, darkMode ? 20 : 18, "transparent"),
    "--color-shell-border": colorMix(texture, darkMode ? 44 : 76, "transparent"),
    "--color-accent": accent,
    "--color-accent-strong": colorMix(accent, darkMode ? 72 : 82, text),
    "--color-accent-muted": colorMix(accent, darkMode ? 22 : 14, "transparent"),
    "--color-focus-ring": accent,
    "--color-surface-selected": colorMix(accent, darkMode ? 22 : 16, texture),
    "--color-selection-background": colorMix(accent, darkMode ? 36 : 22, "transparent"),
    "--color-selection-text": darkMode ? "#F8FAFC" : "#08111F",
    "--color-data-muted": dataColors.muted,
    "--color-data-low": dataColors.low,
    "--color-data-medium": dataColors.medium,
    "--color-data-strong": dataColors.strong,
    "--color-data-peak": dataColors.peak,
    "--color-data-line": dataColors.line,
    "--color-document-background": contentPalette.documentBackground,
    "--color-document-surface": contentPalette.documentSurface,
    "--color-document-text": contentPalette.documentText,
    "--color-document-heading": contentPalette.documentHeading,
    "--color-document-muted": contentPalette.documentMuted,
    "--color-document-border": contentPalette.documentBorder,
    "--color-document-code-background": contentPalette.documentCodeBackground,
    "--color-document-link": contentPalette.documentLink,
    "--color-document-reference-background": contentPalette.documentReferenceBackground,
    "--color-source-background": contentPalette.sourceBackground,
    "--color-source-text": contentPalette.sourceText,
    "--color-source-muted": contentPalette.sourceMuted,
    "--color-source-gutter": contentPalette.sourceGutter,
    "--color-source-gutter-background": contentPalette.sourceGutterBackground,
    "--color-source-highlight": contentPalette.sourceHighlight,
    "--color-code-border": contentPalette.documentBorder,
    "--color-code-background": contentPalette.sourceBackground,
    "--color-code-text": contentPalette.sourceText,
    "--color-overlay": colorMix(background, darkMode ? 62 : 22, "transparent")
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

const lightActivityDataColors = {
  muted: "#EBEDF0",
  low: "#9BE9A8",
  medium: "#40C463",
  strong: "#30A14E",
  peak: "#216E39",
  line: "#2DA44E"
} as const;

const darkActivityDataColors = {
  muted: "#161B22",
  low: "#0E4429",
  medium: "#006D32",
  strong: "#26A641",
  peak: "#39D353",
  line: "#2DA44E"
} as const;

function readSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function colorMix(color: string, colorPercent: number, otherColor: string): string {
  return `color-mix(in srgb, ${color} ${colorPercent}%, ${otherColor})`;
}
