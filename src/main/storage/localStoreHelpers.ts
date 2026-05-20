import type { ControlSettings } from "@shared/github";

export const defaultSettings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell"
};

export function cacheExpiresAtIsExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now();
}

export function normalizeSettings(settings: Record<string, unknown>): ControlSettings {
  const credentialProvider =
    settings.credentialProvider === "github-oauth" ? "github-oauth" : defaultSettings.credentialProvider;
  return {
    credentialProvider,
    glassMode:
      settings.glassMode === "reduced" ||
      settings.glassMode === "solid" ||
      settings.glassMode === "glass-shell"
        ? settings.glassMode
        : defaultSettings.glassMode
  };
}
