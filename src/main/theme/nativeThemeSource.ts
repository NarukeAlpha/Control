import type { ControlSettings } from "@shared/github";

interface NativeThemeSourceTarget {
  themeSource: "system" | "light" | "dark";
}

export function applyNativeThemeSource(
  settings: ControlSettings,
  nativeTheme: NativeThemeSourceTarget
): void {
  nativeTheme.themeSource = settings.theme.mode;
}
