import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";
import { defaultControlExportScope } from "@shared/sync";
import { mockControlApi } from "../../data/mocks/api";
import { DataSyncPanel } from "./DataSyncPanel";

function renderDataSyncPanel(): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DataSyncPanel />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete window.control;
});

describe("DataSyncPanel", () => {
  it("previews and exports through the Control API", async () => {
    const previewDataExport = vi.fn<ControlApi["previewDataExport"]>(async (scope) => ({
      manifest: {
        schemaVersion: 1,
        createdAt: "2026-05-25T00:00:00.000Z",
        appVersion: null,
        includedScopes: scope,
        redactionSummary: [],
        cacheIncluded: {
          githubMetadata: scope.githubMetadataCache,
          areaCache: scope.areaCache,
          snapshots: scope.snapshots
        }
      },
      items: [
        {
          id: "settings",
          label: "Settings",
          dataClass: "durable",
          included: true,
          estimatedCount: 1,
          countIsExact: true,
          sensitiveCategories: [],
          redactedFields: []
        }
      ],
      totals: {
        includedItems: 1,
        excludedItems: 0,
        privateItems: 0,
        cacheItems: 0
      },
      blockers: []
    }));
    const exportData = vi.fn<ControlApi["exportData"]>(async (input) => ({
      manifest: {
        schemaVersion: 1,
        createdAt: "2026-05-25T00:00:00.000Z",
        appVersion: null,
        includedScopes: input.scope,
        redactionSummary: [],
        cacheIncluded: {
          githubMetadata: input.scope.githubMetadataCache,
          areaCache: input.scope.areaCache,
          snapshots: input.scope.snapshots
        }
      },
      filePath: "/tmp/control-export.json",
      bytesWritten: 128
    }));
    window.control = { ...mockControlApi, previewDataExport, exportData };

    renderDataSyncPanel();

    expect(screen.getByRole("button", { name: /Export$/ })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Preview export" }));
    expect(await screen.findByLabelText("Export preview")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Export preview")).getByText("Settings")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Export$/ }));

    await waitFor(() => expect(exportData).toHaveBeenCalledWith({ scope: defaultControlExportScope }));
    expect(await screen.findByText(/Exported 128 bytes/)).toBeInTheDocument();
  });

  it("previews and applies imports after native file selection", async () => {
    const previewDataImport = vi.fn<ControlApi["previewDataImport"]>(async () => ({
      filePath: "/tmp/control-export.json",
      schemaVersion: 1,
      items: [
        {
          id: "settings",
          label: "Settings",
          action: "update",
          dataClass: "durable",
          estimatedCount: 1,
          message: "Settings will be merged."
        }
      ],
      blockers: []
    }));
    const importData = vi.fn<ControlApi["importData"]>(async () => ({
      applied: true,
      importedItems: 1,
      insertedItems: 1,
      updatedItems: 0,
      skippedItems: 0,
      remappedItems: 0,
      blockedItems: 0,
      emittedEvents: ["settings-updated"]
    }));
    window.control = { ...mockControlApi, previewDataImport, importData };

    renderDataSyncPanel();

    await userEvent.click(screen.getByRole("button", { name: /Select import/ }));
    expect(await screen.findByLabelText("Import preview")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Apply import" }));

    await waitFor(() =>
      expect(importData).toHaveBeenCalledWith({ filePath: "/tmp/control-export.json", confirmed: true })
    );
    expect(
      await screen.findByText("Imported 1; inserted 1; updated 0; skipped 0; remapped 0; blocked 0.")
    ).toBeInTheDocument();
  });
});
