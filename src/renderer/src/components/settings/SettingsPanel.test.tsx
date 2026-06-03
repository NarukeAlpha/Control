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

type SettingsPanelProps = Parameters<typeof SettingsPanel>[0];
type SettingsPanelTestProps = Omit<
  SettingsPanelProps,
  "appState" | "authController" | "onAddLocalArea" | "onAddSshArea"
> &
  Partial<Pick<SettingsPanelProps, "onAddLocalArea" | "onAddSshArea">>;

function renderSettingsPanel(props: SettingsPanelTestProps): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SettingsPanel
        appState={mockAppState}
        authController={authController}
        onAddLocalArea={vi.fn()}
        onAddSshArea={vi.fn()}
        {...props}
      />
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
    await userEvent.selectOptions(screen.getByLabelText("Dark theme"), "control-high-contrast-dark");
    fireEvent.change(screen.getByLabelText("Dark theme accent color", { exact: true }), {
      target: { value: "#7C3AED" }
    });
    fireEvent.change(screen.getByLabelText("Dark theme texture color", { exact: true }), {
      target: { value: "#1E293B" }
    });
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Light" })
    );
    fireEvent.change(screen.getByLabelText("Light theme texture color", { exact: true }), {
      target: { value: "#FFFFFF" }
    });
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Dark" })
    );

    expect(screen.getByLabelText("Dark theme accent color", { exact: true })).toHaveValue("#7C3AED");
    expect(screen.getByLabelText("Dark theme texture color", { exact: true })).toHaveValue("#1E293B");
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
              dark: expect.objectContaining({
                accent: "#7C3AED",
                texture: "#1E293B"
              }),
              light: expect.objectContaining({
                texture: "#FFFFFF"
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
    fireEvent.change(screen.getByLabelText("Light theme accent color", { exact: true }), {
      target: { value: "#475569" }
    });
    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Dark" })
    );
    await userEvent.selectOptions(screen.getByLabelText("Dark theme"), "control-dim");
    fireEvent.change(screen.getByLabelText("Dark theme background color", { exact: true }), {
      target: { value: "#151E2C" }
    });
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
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Dark" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Dark theme")).toHaveValue("control-dim");
    expect(screen.getByLabelText("Dark theme background color", { exact: true })).toHaveValue("#151E2C");

    await userEvent.click(
      within(screen.getByRole("group", { name: "Theme mode" })).getByRole("button", { name: "Light" })
    );
    expect(screen.getByLabelText("Light theme accent color", { exact: true })).toHaveValue("#475569");
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
    await userEvent.selectOptions(screen.getByLabelText("Dark theme UI font"), "satoshi");
    await userEvent.selectOptions(screen.getByLabelText("Dark theme code font"), "jetbrains-mono");
    fireEvent.change(screen.getByLabelText("Dark theme accent color", { exact: true }), {
      target: { value: "#FF6363" }
    });
    fireEvent.change(screen.getByLabelText("Dark theme texture color", { exact: true }), {
      target: { value: "#263449" }
    });

    await waitFor(() =>
      expect(onPreviewSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          theme: expect.objectContaining({
            mode: "dark",
            custom: expect.objectContaining({
              dark: expect.objectContaining({
                accent: "#FF6363",
                texture: "#263449"
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
