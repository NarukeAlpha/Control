import { useEffect, useMemo, useState } from "react";

import { DEFAULT_CONTROL_THEME_SETTINGS, type ControlThemeSettings } from "@shared/github";

export interface ResolvedControlTheme {
  requestedMode: ControlThemeSettings["mode"];
  resolvedMode: "light" | "dark";
  preset: ControlThemeSettings["preset"];
  accent: ControlThemeSettings["accent"];
  colorScheme: "light" | "dark";
}

export function resolveControlTheme(
  settings: ControlThemeSettings | undefined,
  systemPrefersDark: boolean
): ResolvedControlTheme {
  const theme = settings ?? DEFAULT_CONTROL_THEME_SETTINGS;
  const resolvedMode = theme.mode === "system" ? (systemPrefersDark ? "dark" : "light") : theme.mode;

  return {
    requestedMode: theme.mode,
    resolvedMode,
    preset: theme.preset,
    accent: theme.accent,
    colorScheme: resolvedMode
  };
}

function useSystemPrefersDark(): boolean {
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
