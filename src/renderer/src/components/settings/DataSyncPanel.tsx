import { Download, Upload } from "lucide-react";
import { useReducer, type JSX } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { ControlExportPreview, ControlExportScope, ControlImportPreview } from "@shared/sync";
import { defaultControlExportScope } from "@shared/sync";
import { useControlApi } from "../../hooks/useControlApi";

type DataSyncStatus = "idle" | "running" | "ready" | "done" | "error";

interface DataSyncPanelState {
  scope: ControlExportScope;
  exportPreview: ControlExportPreview | null;
  importPreview: ControlImportPreview | null;
  exportStatus: DataSyncStatus;
  importStatus: DataSyncStatus;
  exportMessage: string | null;
  importMessage: string | null;
}

type DataSyncPanelAction =
  | { type: "scopeChanged"; field: keyof ControlExportScope; checked: boolean }
  | { type: "exportStarted" }
  | { type: "exportPreviewReady"; preview: ControlExportPreview }
  | { type: "exportDone"; message: string }
  | { type: "exportFailed"; message: string }
  | { type: "importStarted" }
  | { type: "importPreviewReady"; preview: ControlImportPreview }
  | { type: "importDone"; applied: boolean; message: string }
  | { type: "importFailed"; message: string };

const initialDataSyncPanelState: DataSyncPanelState = {
  scope: defaultControlExportScope,
  exportPreview: null,
  importPreview: null,
  exportStatus: "idle",
  importStatus: "idle",
  exportMessage: null,
  importMessage: null
};

function dataSyncPanelReducer(state: DataSyncPanelState, action: DataSyncPanelAction): DataSyncPanelState {
  switch (action.type) {
    case "scopeChanged":
      return {
        ...state,
        scope: { ...state.scope, [action.field]: action.checked },
        exportPreview: null,
        exportStatus: "idle",
        exportMessage: null
      };
    case "exportStarted":
      return { ...state, exportStatus: "running", exportMessage: null };
    case "exportPreviewReady":
      return { ...state, exportPreview: action.preview, exportStatus: "ready" };
    case "exportDone":
      return { ...state, exportStatus: "done", exportMessage: action.message };
    case "exportFailed":
      return { ...state, exportStatus: "error", exportMessage: action.message };
    case "importStarted":
      return { ...state, importStatus: "running", importMessage: null };
    case "importPreviewReady":
      return {
        ...state,
        importPreview: action.preview,
        importStatus: action.preview.blockers.length > 0 ? "error" : "ready",
        importMessage: action.preview.blockers[0] ?? null
      };
    case "importDone":
      return {
        ...state,
        importStatus: action.applied ? "done" : "ready",
        importMessage: action.message
      };
    case "importFailed":
      return { ...state, importStatus: "error", importMessage: action.message };
  }
}

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
  const [state, dispatch] = useReducer(dataSyncPanelReducer, initialDataSyncPanelState);
  const { scope, exportPreview, importPreview, exportStatus, importStatus, exportMessage, importMessage } =
    state;

  function updateScope(field: keyof ControlExportScope, checked: boolean): void {
    dispatch({ type: "scopeChanged", field, checked });
  }

  async function previewExport(): Promise<void> {
    dispatch({ type: "exportStarted" });
    try {
      const preview = await api.previewDataExport(scope);
      dispatch({ type: "exportPreviewReady", preview });
    } catch (error) {
      dispatch({
        type: "exportFailed",
        message: error instanceof Error ? error.message : "Export preview failed."
      });
    }
  }

  async function exportData(): Promise<void> {
    dispatch({ type: "exportStarted" });
    try {
      const result = await api.exportData({ scope });
      dispatch({
        type: "exportDone",
        message: result.filePath
          ? `Exported ${result.bytesWritten ?? 0} bytes to ${result.filePath}.`
          : "Export cancelled."
      });
    } catch (error) {
      dispatch({ type: "exportFailed", message: error instanceof Error ? error.message : "Export failed." });
    }
  }

  async function previewImport(): Promise<void> {
    dispatch({ type: "importStarted" });
    try {
      const preview = await api.previewDataImport({});
      dispatch({ type: "importPreviewReady", preview });
    } catch (error) {
      dispatch({
        type: "importFailed",
        message: error instanceof Error ? error.message : "Import preview failed."
      });
    }
  }

  async function importData(): Promise<void> {
    if (!importPreview?.filePath || importPreview.blockers.length > 0) {
      return;
    }

    dispatch({ type: "importStarted" });
    try {
      const result = await api.importData({ filePath: importPreview.filePath, confirmed: true });
      invalidateImportedData(queryClient, result.emittedEvents);
      dispatch({
        type: "importDone",
        applied: result.applied,
        message: `Imported ${result.importedItems}; inserted ${result.insertedItems}; updated ${result.updatedItems}; skipped ${result.skippedItems}; remapped ${result.remappedItems}; blocked ${result.blockedItems}.`
      });
    } catch (error) {
      dispatch({ type: "importFailed", message: error instanceof Error ? error.message : "Import failed." });
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
          <Download size={15} /> {exportBusy ? "Exporting…" : "Export"}
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
          <Upload size={15} /> {importBusy ? "Opening…" : "Select import"}
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
