import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockAppState } from "../../data/mock";
import type { ProviderAuthController } from "../auth/providerAuthAdapters";
import { SettingsPanel } from "./SettingsPanel";

const authController: ProviderAuthController = {
  provider: "github",
  status: "idle",
  session: null,
  error: null,
  completedAt: null,
  signIn: vi.fn(),
  cancelSignIn: vi.fn(),
  clearToken: vi.fn(),
  clearError: vi.fn()
};

describe("SettingsPanel", () => {
  it("saves typed glass and theme settings", async () => {
    const onSave = vi.fn<Parameters<typeof SettingsPanel>[0]["onSave"]>(async () => undefined);

    render(
      <SettingsPanel
        appState={mockAppState}
        authController={authController}
        onClose={vi.fn()}
        onOpenExternal={vi.fn()}
        onSave={onSave}
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("Glass mode"), "solid");
    await userEvent.selectOptions(screen.getByLabelText("Theme mode"), "dark");
    await userEvent.selectOptions(screen.getByLabelText("Preset"), "control-high-contrast-dark");
    await userEvent.selectOptions(screen.getByLabelText("Accent"), "purple");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialProvider: "github-oauth",
          glassMode: "solid",
          theme: {
            mode: "dark",
            preset: "control-high-contrast-dark",
            accent: "purple"
          }
        })
      )
    );
  });

  it("keeps unsaved local theme selections visible after a failed save", async () => {
    const onSave = vi.fn<Parameters<typeof SettingsPanel>[0]["onSave"]>(async () => {
      throw new Error("settings store unavailable");
    });

    render(
      <SettingsPanel
        appState={mockAppState}
        authController={authController}
        onClose={vi.fn()}
        onOpenExternal={vi.fn()}
        onSave={onSave}
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("Glass mode"), "reduced");
    await userEvent.selectOptions(screen.getByLabelText("Theme mode"), "light");
    await userEvent.selectOptions(screen.getByLabelText("Preset"), "control-dim");
    await userEvent.selectOptions(screen.getByLabelText("Accent"), "gray");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Could not save settings: settings store unavailable")).toHaveClass(
      "settings-error"
    );
    expect(screen.getByLabelText<HTMLSelectElement>("Glass mode").value).toBe("reduced");
    expect(screen.getByLabelText<HTMLSelectElement>("Theme mode").value).toBe("light");
    expect(screen.getByLabelText<HTMLSelectElement>("Preset").value).toBe("control-dim");
    expect(screen.getByLabelText<HTMLSelectElement>("Accent").value).toBe("gray");
  });
});
