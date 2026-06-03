import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function renderSettingsPanel(
  props: Omit<Parameters<typeof SettingsPanel>[0], "appState" | "authController">
): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SettingsPanel appState={mockAppState} authController={authController} {...props} />
    </QueryClientProvider>
  );
}

describe("SettingsPanel", () => {
  it("saves typed glass and theme settings", async () => {
    const onSave = vi.fn<Parameters<typeof SettingsPanel>[0]["onSave"]>(async () => undefined);

    renderSettingsPanel({
      onClose: vi.fn(),
      onOpenExternal: vi.fn(),
      onSave
    });

    await userEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Glass mode" })).getByRole("button", {
        name: /Solid/
      })
    );
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Dark" })
    );
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme" })).getByRole("button", {
        name: /High Contrast Dark/
      })
    );
    await userEvent.click(
      within(screen.getByRole("group", { name: "Light theme accent" })).getByRole("button", {
        name: "Purple accent"
      })
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialProvider: "github-oauth",
          glassMode: "solid",
          theme: expect.objectContaining({
            mode: "dark",
            preset: "control-high-contrast-dark",
            accent: "purple",
            custom: expect.objectContaining({
              light: expect.objectContaining({
                accent: "#7C3AED"
              })
            })
          })
        })
      )
    );
  });

  it("keeps unsaved local theme selections visible after a failed save", async () => {
    const onSave = vi.fn<Parameters<typeof SettingsPanel>[0]["onSave"]>(async () => {
      throw new Error("settings store unavailable");
    });

    renderSettingsPanel({
      onClose: vi.fn(),
      onOpenExternal: vi.fn(),
      onSave
    });

    await userEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Glass mode" })).getByRole("button", {
        name: /Reduced glass/
      })
    );
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Light" })
    );
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme" })).getByRole("button", {
        name: /^Dim/
      })
    );
    await userEvent.click(
      within(screen.getByRole("group", { name: "Light theme accent" })).getByRole("button", {
        name: "Gray accent"
      })
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Could not save settings: settings store unavailable")).toHaveClass(
      "settings-error"
    );
    expect(
      within(screen.getByRole("group", { name: "Glass mode" })).getByRole("button", {
        name: /Reduced glass/
      })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Light" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("group", { name: "Theme" })).getByRole("button", {
        name: /^Dim/
      })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("group", { name: "Light theme accent" })).getByRole("button", {
        name: "Gray accent"
      })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("previews appearance changes while editing", async () => {
    const onPreviewSettings = vi.fn<NonNullable<Parameters<typeof SettingsPanel>[0]["onPreviewSettings"]>>();

    renderSettingsPanel({
      onClose: vi.fn(),
      onOpenExternal: vi.fn(),
      onPreviewSettings,
      onSave: vi.fn<Parameters<typeof SettingsPanel>[0]["onSave"]>(async () => undefined)
    });

    await userEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Dark" })
    );
    await userEvent.selectOptions(screen.getByLabelText("Light theme UI font"), "satoshi");
    await userEvent.selectOptions(screen.getByLabelText("Light theme code font"), "jetbrains-mono");
    fireEvent.change(screen.getByLabelText("Light theme accent color", { exact: true }), {
      target: { value: "#FF6363" }
    });

    await waitFor(() =>
      expect(onPreviewSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          theme: expect.objectContaining({
            mode: "dark",
            custom: expect.objectContaining({
              light: expect.objectContaining({
                accent: "#FF6363"
              }),
              uiFont: "satoshi",
              codeFont: "jetbrains-mono"
            })
          })
        })
      )
    );
  });
});
