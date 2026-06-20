import { useMemo } from "react";

import { DEFAULT_CONTROL_THEME_SETTINGS, type ControlThemeSettings } from "@shared/github";

export interface ResolvedControlTheme {
  requestedMode: ControlThemeSettings["mode"];
  resolvedMode: "light";
  preset: ControlThemeSettings["preset"];
  accent: ControlThemeSettings["accent"];
  colorScheme: "light";
}

export type ControlThemeStyleVars = Record<`--${string}`, string>;

const contentPalette = {
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

export function resolveControlTheme(settings: ControlThemeSettings | undefined): ResolvedControlTheme {
  const theme = settings ?? DEFAULT_CONTROL_THEME_SETTINGS;

  return {
    requestedMode: theme.mode,
    resolvedMode: "light",
    preset: "control-light",
    accent: theme.accent,
    colorScheme: "light"
  };
}

export function resolveControlThemeStyleVars(
  settings: ControlThemeSettings | undefined
): ControlThemeStyleVars {
  const theme = settings ?? DEFAULT_CONTROL_THEME_SETTINGS;
  const custom = theme.custom ?? DEFAULT_CONTROL_THEME_SETTINGS.custom;
  const palette = custom.light;
  const text = palette.foreground;
  const background = palette.background;
  const accent = palette.accent;
  const texture = palette.texture;
  const surfaceGlass = colorMix(texture, 46, "transparent");
  const surfaceGlassStrong = colorMix(texture, 70, background);
  const surfaceElevated = colorMix(texture, 82, background);
  const surfaceRow = colorMix(texture, 60, background);
  const surfaceRowHover = colorMix(texture, 74, background);
  const surfaceControl = colorMix(texture, 66, background);
  const surfaceControlHover = colorMix(texture, 80, background);
  const paneCanvas = colorMix(texture, 42, background);
  const paneCanvasHover = colorMix(texture, 52, background);
  const contentRow = colorMix(texture, 56, background);
  const glassControl = colorMix(texture, 68, background);
  const glassControlHover = colorMix(texture, 80, background);
  const glassControlActive = colorMix(accent, 16, texture);

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
    "--color-texture-muted": colorMix(texture, 28, "transparent"),
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
    "--color-pane-canvas": paneCanvas,
    "--color-pane-canvas-hover": paneCanvasHover,
    "--color-pane-border": colorMix(text, 12, "transparent"),
    "--color-content-canvas": contentPalette.documentBackground,
    "--color-content-row": contentRow,
    "--color-content-border": contentPalette.documentBorder,
    "--color-glass-control": glassControl,
    "--color-glass-control-hover": glassControlHover,
    "--color-glass-control-active": glassControlActive,
    "--color-glass-rim": colorMix(texture, 62, "transparent"),
    "--color-focus-glow-blue": colorMix(accent, 24, "transparent"),
    "--color-focus-glow-pink": "rgba(255, 115, 183, 0.2)",
    "--color-surface-highlight": colorMix(text, 12, "transparent"),
    "--color-border": colorMix(text, 14, "transparent"),
    "--color-border-strong": colorMix(text, 28, "transparent"),
    "--color-glass-border": colorMix(text, 18, "transparent"),
    "--color-shell-border": colorMix(texture, 76, "transparent"),
    "--color-accent": accent,
    "--color-accent-strong": colorMix(accent, 82, text),
    "--color-accent-muted": colorMix(accent, 14, "transparent"),
    "--color-focus-ring": accent,
    "--color-surface-selected": colorMix(accent, 16, texture),
    "--color-selection-background": colorMix(accent, 22, "transparent"),
    "--color-selection-text": "#08111F",
    "--color-data-muted": activityDataColors.muted,
    "--color-data-low": activityDataColors.low,
    "--color-data-medium": activityDataColors.medium,
    "--color-data-strong": activityDataColors.strong,
    "--color-data-peak": activityDataColors.peak,
    "--color-data-line": activityDataColors.line,
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
    "--color-overlay": colorMix(background, 22, "transparent"),
    "--shadow-control-float": "0 12px 28px rgba(31, 41, 55, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.72)",
    "--shadow-overlay-float": "0 34px 90px rgba(31, 41, 55, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.78)",
    "--radius-liquid-control": "999px",
    "--radius-pane": "16px",
    "--radius-row": "10px",
    "--material-pane-blur": "0px",
    "--material-overlay-blur": "var(--glass-transient-blur)"
  };
}

export function useResolvedControlTheme(settings: ControlThemeSettings | undefined): ResolvedControlTheme {
  return useMemo(() => resolveControlTheme(settings), [settings]);
}

const activityDataColors = {
  muted: "#EBEDF0",
  low: "#9BE9A8",
  medium: "#40C463",
  strong: "#30A14E",
  peak: "#216E39",
  line: "#2DA44E"
} as const;

function colorMix(color: string, colorPercent: number, otherColor: string): string {
  return `color-mix(in srgb, ${color} ${colorPercent}%, ${otherColor})`;
}
