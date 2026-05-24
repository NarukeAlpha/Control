import { LogIn, X } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

import type { AppState, GlassMode } from "@shared/github";
import type { ProviderAuthController } from "../auth/providerAuthAdapters";

export function SettingsPanel({
  appState,
  authController,
  onClose,
  onOpenExternal,
  onSave
}: {
  appState?: AppState;
  authController: ProviderAuthController;
  onClose(): void;
  onOpenExternal(url: string): void;
  onSave(settings: Partial<AppState["settings"]>): Promise<void>;
}): JSX.Element {
  const [signOutStatus, setSignOutStatus] = useState<"idle" | "running" | "signedOut" | "error">("idle");
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [glassMode, setGlassMode] = useState<GlassMode>(appState?.settings.glassMode ?? "glass-shell");
  const observedCompletedAt = useRef(authController.completedAt);
  const authenticated = appState?.github.authenticated ?? false;
  const githubUser = appState?.github.user ?? null;
  const signInConfigured = appState?.github.signInConfigured ?? true;
  const signInBusy = authController.status === "waiting";
  const signInSession = authController.session;
  const signInError = authController.error;
  const signOutBusy = signOutStatus === "running";
  const saveBusy = saveStatus === "saving";
  const githubConnectionLabel = signInBusy
    ? `Enter ${signInSession?.userCode ?? "the code"} in GitHub.`
    : signOutStatus === "signedOut"
      ? "Not connected."
      : authenticated
        ? `Connected as ${githubUser ?? "GitHub"}`
        : signInConfigured
          ? "Not connected."
          : "GitHub sign-in is not configured in this build.";
  const signInDisabledReason = signOutBusy
    ? "GitHub sign-out is still running."
    : signInBusy
      ? "GitHub sign-in is already in progress."
      : !signInConfigured
        ? "GitHub sign-in is not configured in this build."
        : null;
  const signOutDisabledReason = signOutBusy
    ? "GitHub sign-out is still running."
    : signOutStatus === "signedOut"
      ? "No GitHub account is connected."
      : signInBusy
        ? "Cancel or complete GitHub sign-in before signing out."
        : !authenticated
          ? "No GitHub account is connected."
          : null;
  const saveDisabledReason = saveBusy ? "Settings save is still running." : null;

  useEffect(() => {
    if (!authController.completedAt || authController.completedAt === observedCompletedAt.current) {
      return;
    }

    observedCompletedAt.current = authController.completedAt;
    onClose();
  }, [authController.completedAt, onClose]);

  async function handleGitHubSignIn(): Promise<void> {
    authController.clearError();
    setSignOutError(null);
    setSignOutStatus("idle");

    if (!signInConfigured) {
      return;
    }

    await authController.signIn();
  }

  async function handleClearToken(): Promise<void> {
    if (signOutDisabledReason) {
      return;
    }

    setSignOutStatus("running");
    setSignOutError(null);

    try {
      await authController.clearToken();
      setSignOutStatus("signedOut");
    } catch (error) {
      setSignOutStatus("error");
      setSignOutError(error instanceof Error ? error.message : "GitHub sign-out failed.");
    }
  }

  async function handleSaveSettings(): Promise<void> {
    if (saveDisabledReason) {
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);

    try {
      await onSave({
        credentialProvider: appState?.settings.credentialProvider ?? "github-oauth",
        glassMode
      });
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Settings save failed.");
    }
  }

  function handleClose(): void {
    onClose();
  }

  function handleCancelSignIn(): void {
    void authController.cancelSignIn();
  }

  return (
    <div className="modal-backdrop">
      <section className="settings-panel">
        <header>
          <h2>Settings</h2>
          <button className="icon-button" type="button" onClick={handleClose}>
            <X size={18} />
          </button>
        </header>

        <div className="settings-inline-actions">
          <span>{githubConnectionLabel}</span>
          <button
            type="button"
            disabled={Boolean(signInDisabledReason)}
            title={signInDisabledReason ?? undefined}
            onClick={() => void handleGitHubSignIn()}
          >
            <LogIn size={15} /> Sign in with GitHub
          </button>
          <button
            type="button"
            disabled={Boolean(signOutDisabledReason)}
            title={signOutDisabledReason ?? undefined}
            onClick={() => void handleClearToken()}
          >
            {signOutBusy ? "Signing out..." : "Sign out"}
          </button>
        </div>

        {signInBusy && (
          <div className="settings-inline-actions">
            <span>{signInSession?.verificationUri ?? "Open GitHub and enter your code."}</span>
            {signInSession?.userCode && (
              <strong className="settings-inline-code">{signInSession.userCode}</strong>
            )}
            {(() => {
              const verificationUri = signInSession?.verificationUri;
              if (!verificationUri) {
                return null;
              }

              return (
                <button type="button" onClick={() => void onOpenExternal(verificationUri)}>
                  Open GitHub
                </button>
              );
            })()}
            <button type="button" onClick={handleCancelSignIn}>
              Cancel sign-in
            </button>
          </div>
        )}

        {signInError && <p className="settings-error">{signInError}</p>}
        {signOutError && <p className="settings-error">Could not sign out of GitHub: {signOutError}</p>}
        {saveError && <p className="settings-error">Could not save settings: {saveError}</p>}
        {signOutStatus === "signedOut" && <p className="settings-success">Signed out of GitHub.</p>}
        {saveStatus === "saved" && <p className="settings-success">Settings saved.</p>}

        <label>
          Glass mode
          <select
            value={glassMode}
            onChange={(event) => {
              setGlassMode(event.target.value as GlassMode);
              setSaveStatus("idle");
              setSaveError(null);
            }}
          >
            <option value="glass-shell">Glass shell</option>
            <option value="reduced">Reduced glass</option>
            <option value="solid">Solid</option>
          </select>
        </label>

        <footer>
          <button type="button" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="dark-action"
            type="button"
            disabled={Boolean(saveDisabledReason)}
            title={saveDisabledReason ?? undefined}
            onClick={() => void handleSaveSettings()}
          >
            {saveBusy ? "Saving..." : "Save"}
          </button>
        </footer>
      </section>
    </div>
  );
}
