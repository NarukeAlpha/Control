import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders account and data settings without the removed appearance section", () => {
    renderSettingsPanel({
      onClose: vi.fn(),
      onOpenExternal: vi.fn()
    });

    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Data" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Appearance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Appearance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Theme accent color", { exact: true })).not.toBeInTheDocument();
  });

  it("switches to data settings", async () => {
    renderSettingsPanel({
      onClose: vi.fn(),
      onOpenExternal: vi.fn()
    });

    await userEvent.click(screen.getByRole("button", { name: "Data" }));

    expect(screen.getAllByRole("heading", { name: "Data" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Data" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Preview export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select import/ })).toBeInTheDocument();
  });

  it("signs out from account settings", async () => {
    vi.mocked(authController.clearToken).mockResolvedValueOnce(undefined);

    renderSettingsPanel({
      onClose: vi.fn(),
      onOpenExternal: vi.fn()
    });

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(authController.clearToken).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Signed out of GitHub.")).toHaveClass("settings-success");
  });
});
