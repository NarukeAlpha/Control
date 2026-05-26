import { Download, Upload } from "lucide-react";
import { useState, type JSX } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { ControlExportPreview, ControlExportScope, ControlImportPreview } from "@shared/sync";
import { defaultControlExportScope } from "@shared/sync";
import { useControlApi } from "../../hooks/useControlApi";

type DataSyncStatus = "idle" | "running" | "ready" | "done" | "error";

const exportScopeFields = [
  ["settings", "Settings"],
  ["areas", "Areas"],
  ["pins", "Pins"],
  ["recents", "Recents"],
  ["githubMetadataCache", "GitHub cache"],
  ["areaCache", "Area cache"],
  ["includeLocalPaths", "Local paths"],
  ["includePrivateRepositoryMetadata", "Private metadata"]
] as const satisfies ReadonlyArray<readonly [keyof ControlExportScope, string]>;

export function DataSyncPanel(): JSX.Element {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ControlExportScope>(defaultControlExportScope);
  const [exportPreview, setExportPreview] = useState<ControlExportPreview | null>(null);
  const [importPreview, setImportPreview] = useState<ControlImportPreview | null>(null);
  const [exportStatus, setExportStatus] = useState<DataSyncStatus>("idle");
  const [importStatus, setImportStatus] = useState<DataSyncStatus>("idle");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  function updateScope(field: keyof ControlExportScope, checked: boolean): void {
    setScope((current) => ({ ...current, [field]: checked }));
    setExportPreview(null);
    setExportStatus("idle");
    setExportMessage(null);
  }

  async function previewExport(): Promise<void> {
    setExportStatus("running");
    setExportMessage(null);
    try {
      const preview = await api.previewDataExport(scope);
      setExportPreview(preview);
      setExportStatus("ready");
    } catch (error) {
      setExportStatus("error");
      setExportMessage(error instanceof Error ? error.message : "Export preview failed.");
    }
  }

  async function exportData(): Promise<void> {
    setExportStatus("running");
    setExportMessage(null);
    try {
      const result = await api.exportData({ scope });
      setExportStatus("done");
      setExportMessage(
        result.filePath
          ? `Exported ${result.bytesWritten ?? 0} bytes to ${result.filePath}.`
          : "Export cancelled."
      );
    } catch (error) {
      setExportStatus("error");
      setExportMessage(error instanceof Error ? error.message : "Export failed.");
    }
  }

  async function previewImport(): Promise<void> {
    setImportStatus("running");
    setImportMessage(null);
    try {
      const preview = await api.previewDataImport({});
      setImportPreview(preview);
      setImportStatus(preview.blockers.length > 0 ? "error" : "ready");
      setImportMessage(preview.blockers[0] ?? null);
    } catch (error) {
      setImportStatus("error");
      setImportMessage(error instanceof Error ? error.message : "Import preview failed.");
    }
  }

  async function importData(): Promise<void> {
    if (!importPreview?.filePath || importPreview.blockers.length > 0) {
      return;
    }

    setImportStatus("running");
    setImportMessage(null);
    try {
      const result = await api.importData({ filePath: importPreview.filePath, confirmed: true });
      invalidateImportedData(queryClient, result.emittedEvents);
      setImportStatus(result.applied ? "done" : "ready");
      setImportMessage(
        `Imported ${result.importedItems}; inserted ${result.insertedItems}; updated ${result.updatedItems}; skipped ${result.skippedItems}; remapped ${result.remappedItems}; blocked ${result.blockedItems}.`
      );
    } catch (error) {
      setImportStatus("error");
      setImportMessage(error instanceof Error ? error.message : "Import failed.");
    }
  }

  const exportBusy = exportStatus === "running";
  const importBusy = importStatus === "running";
  const exportReady = Boolean(exportPreview) && exportStatus !== "idle" && !exportPreview?.blockers.length;

  return (
    <section className="data-sync-panel">
      <h3>Data</h3>
      <div className="data-sync-scope-grid">
        {exportScopeFields.map(([field, label]) => (
          <label key={field} className="data-sync-checkbox">
            <input
              type="checkbox"
              checked={scope[field]}
              onChange={(event) => updateScope(field, event.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="settings-inline-actions">
        <button type="button" disabled={exportBusy} onClick={() => void previewExport()}>
          Preview export
        </button>
        <button type="button" disabled={exportBusy || !exportReady} onClick={() => void exportData()}>
          <Download size={15} /> {exportBusy ? "Exporting..." : "Export"}
        </button>
      </div>

      {exportPreview && (
        <DataSyncPreviewList
          label="Export preview"
          items={exportPreview.items.map((item) => ({
            id: item.id,
            label: item.label,
            value: item.included ? item.estimatedCount : 0,
            message: item.included
              ? item.redactedFields.length
                ? `Redacts ${item.redactedFields.join(", ")}`
                : item.sensitiveCategories.length
                  ? item.sensitiveCategories.join(", ")
                  : null
              : "Excluded"
          }))}
        />
      )}
      {exportPreview?.blockers.map((blocker) => (
        <p key={blocker} className="settings-error">
          {blocker}
        </p>
      ))}
      {exportMessage && (
        <p className={exportStatus === "error" ? "settings-error" : "settings-success"}>{exportMessage}</p>
      )}

      <div className="settings-inline-actions">
        <button type="button" disabled={importBusy} onClick={() => void previewImport()}>
          <Upload size={15} /> {importBusy ? "Opening..." : "Select import"}
        </button>
        <button
          type="button"
          disabled={importBusy || !importPreview?.filePath || importPreview.blockers.length > 0}
          onClick={() => void importData()}
        >
          Apply import
        </button>
      </div>

      {importPreview && (
        <DataSyncPreviewList
          label="Import preview"
          items={importPreview.items.map((item) => ({
            id: item.id,
            label: item.label,
            value: item.estimatedCount,
            message: item.message ?? item.action
          }))}
        />
      )}
      {importMessage && (
        <p className={importStatus === "error" ? "settings-error" : "settings-success"}>{importMessage}</p>
      )}
    </section>
  );
}

function invalidateImportedData(
  queryClient: ReturnType<typeof useQueryClient>,
  emittedEvents: readonly string[]
): void {
  if (emittedEvents.includes("areas-updated")) {
    void queryClient.invalidateQueries({ queryKey: ["areas"] });
  }
  if (emittedEvents.includes("repository-pins-updated")) {
    void queryClient.invalidateQueries({ queryKey: ["repository-pins"] });
  }
  if (emittedEvents.includes("recents-updated")) {
    void queryClient.invalidateQueries({ queryKey: ["local-recents"] });
  }
  if (emittedEvents.includes("settings-updated")) {
    void queryClient.invalidateQueries({ queryKey: ["app-state"] });
  }
}

function DataSyncPreviewList({
  label,
  items
}: {
  label: string;
  items: Array<{ id: string; label: string; value: number; message: string | null }>;
}): JSX.Element {
  return (
    <div className="data-sync-preview" aria-label={label}>
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.message && <small>{item.message}</small>}
        </div>
      ))}
    </div>
  );
}
