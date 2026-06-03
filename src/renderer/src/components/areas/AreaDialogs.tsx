import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useReducer, useState, type ChangeEvent, type FormEvent, type JSX, type MouseEvent } from "react";

import type { AreaSummary, CreateSshAreaInput, UpdateAreaInput } from "@shared/areas";

type AreaDraftField = "label" | "host" | "rootPath" | "username" | "port";

interface AreaDialogDraft {
  host: string;
  rootPath: string;
  username: string;
  port: string;
  label: string;
  submitting: boolean;
  error: string | null;
}

type AreaDialogDraftAction =
  | { type: "setField"; field: AreaDraftField; value: string }
  | { type: "submitStarted" }
  | { type: "submitFailed"; error: string };

function areaDialogDraftReducer(state: AreaDialogDraft, action: AreaDialogDraftAction): AreaDialogDraft {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value };
    case "submitStarted":
      return { ...state, submitting: true, error: null };
    case "submitFailed":
      return { ...state, submitting: false, error: action.error };
  }
}

function createSshAreaDraft(): AreaDialogDraft {
  return {
    host: "delta-wsl",
    rootPath: "~/controltest",
    username: "",
    port: "",
    label: "",
    submitting: false,
    error: null
  };
}

function createAreaEditDraft(area: AreaSummary): AreaDialogDraft {
  const sshDefaults = sshDefaultsFromArea(area);
  return {
    host: sshDefaults.host,
    rootPath: area.rootPath ?? "",
    username: sshDefaults.username ?? "",
    port: sshDefaults.port ? String(sshDefaults.port) : "",
    label: area.label,
    submitting: false,
    error: null
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function stopDialogMouseDown(event: MouseEvent<HTMLElement>): void {
  event.stopPropagation();
}

function AreaDraftInput({
  label,
  field,
  value,
  inputMode,
  normalize,
  dispatch
}: {
  label: string;
  field: AreaDraftField;
  value: string;
  inputMode?: "numeric";
  normalize?(value: string): string;
  dispatch(action: AreaDialogDraftAction): void;
}): JSX.Element {
  function updateDraftField(event: ChangeEvent<HTMLInputElement>): void {
    dispatch({
      type: "setField",
      field,
      value: normalize ? normalize(event.target.value) : event.target.value
    });
  }

  return (
    <label>
      {label}
      <input inputMode={inputMode} value={value} onChange={updateDraftField} />
    </label>
  );
}

export function SshAreaDialog({
  onClose,
  onCreate
}: {
  onClose(): void;
  onCreate(input: CreateSshAreaInput): Promise<void>;
}): JSX.Element {
  const [draft, dispatch] = useReducer(areaDialogDraftReducer, undefined, createSshAreaDraft);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedHost = draft.host.trim();
    const normalizedRootPath = draft.rootPath.trim();
    const normalizedPort = draft.port.trim();

    if (!normalizedHost || !normalizedRootPath) {
      dispatch({ type: "submitFailed", error: "Host and root path are required." });
      return;
    }

    dispatch({ type: "submitStarted" });
    try {
      await onCreate({
        host: normalizedHost,
        rootPath: normalizedRootPath,
        username: draft.username.trim() || null,
        label: draft.label.trim() || normalizedHost,
        port: normalizedPort ? Number(normalizedPort) : null
      });
    } catch (createError) {
      dispatch({
        type: "submitFailed",
        error: createError instanceof Error ? createError.message : "SSH Area could not be created."
      });
    }
  }

  function submitSshArea(event: FormEvent<HTMLFormElement>): void {
    void submit(event);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="settings-panel ssh-area-dialog"
        aria-labelledby="ssh-area-dialog-title"
        onMouseDown={stopDialogMouseDown}
        onSubmit={submitSshArea}
      >
        <header>
          <div>
            <h2 id="ssh-area-dialog-title">Add SSH Area</h2>
            <p>Start a gateway for a remote territory.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close SSH Area dialog" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <AreaDraftInput label="Label" field="label" value={draft.label} dispatch={dispatch} />
        <AreaDraftInput label="Host" field="host" value={draft.host} dispatch={dispatch} />
        <AreaDraftInput label="Root path" field="rootPath" value={draft.rootPath} dispatch={dispatch} />
        <AreaDraftInput label="Username" field="username" value={draft.username} dispatch={dispatch} />
        <AreaDraftInput
          label="Port"
          field="port"
          value={draft.port}
          inputMode="numeric"
          normalize={digitsOnly}
          dispatch={dispatch}
        />
        {draft.error && <div className="error-state">{draft.error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={draft.submitting}>
            <Plus size={16} /> {draft.submitting ? "Adding" : "Add SSH Area"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function AreaEditDialog({
  area,
  onClose,
  onSave
}: {
  area: AreaSummary;
  onClose(): void;
  onSave(input: UpdateAreaInput): Promise<void>;
}): JSX.Element {
  const [draft, dispatch] = useReducer(areaDialogDraftReducer, area, createAreaEditDraft);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedLabel = draft.label.trim();
    const normalizedRootPath = draft.rootPath.trim();
    const normalizedHost = draft.host.trim();
    const normalizedPort = draft.port.trim();

    if (area.kind === "local" && !normalizedRootPath) {
      dispatch({ type: "submitFailed", error: "Root path is required." });
      return;
    }
    if (area.kind === "ssh" && (!normalizedHost || !normalizedRootPath)) {
      dispatch({ type: "submitFailed", error: "Host and root path are required." });
      return;
    }

    dispatch({ type: "submitStarted" });
    try {
      if (area.kind === "github") {
        await onSave({ areaId: area.id, label: normalizedLabel || "GitHub" });
      } else if (area.kind === "local") {
        await onSave({
          areaId: area.id,
          label: normalizedLabel || null,
          rootPath: normalizedRootPath
        });
      } else {
        await onSave({
          areaId: area.id,
          label: normalizedLabel || normalizedHost,
          host: normalizedHost,
          rootPath: normalizedRootPath,
          username: draft.username.trim() || null,
          port: normalizedPort ? Number(normalizedPort) : null
        });
      }
    } catch (saveError) {
      dispatch({
        type: "submitFailed",
        error: saveError instanceof Error ? saveError.message : "Area could not be saved."
      });
    }
  }

  function submitAreaEdit(event: FormEvent<HTMLFormElement>): void {
    void submit(event);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="settings-panel area-edit-dialog"
        aria-labelledby="area-edit-dialog-title"
        onMouseDown={stopDialogMouseDown}
        onSubmit={submitAreaEdit}
      >
        <header>
          <div>
            <h2 id="area-edit-dialog-title">Edit Area</h2>
            <p>{area.kind === "github" ? "Update this GitHub Area." : "Update this territory mount."}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close Area edit dialog" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <AreaDraftInput label="Label" field="label" value={draft.label} dispatch={dispatch} />
        {area.kind === "ssh" && (
          <AreaDraftInput label="Host" field="host" value={draft.host} dispatch={dispatch} />
        )}
        {area.kind !== "github" && (
          <AreaDraftInput label="Root path" field="rootPath" value={draft.rootPath} dispatch={dispatch} />
        )}
        {area.kind === "ssh" && (
          <>
            <AreaDraftInput label="Username" field="username" value={draft.username} dispatch={dispatch} />
            <AreaDraftInput
              label="Port"
              field="port"
              value={draft.port}
              inputMode="numeric"
              normalize={digitsOnly}
              dispatch={dispatch}
            />
          </>
        )}
        {draft.error && <div className="error-state">{draft.error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={draft.submitting}>
            <Pencil size={16} /> {draft.submitting ? "Saving" : "Save Area"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function AreaDeleteDialog({
  area,
  onClose,
  onDelete
}: {
  area: AreaSummary;
  onClose(): void;
  onDelete(): Promise<void>;
}): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Area could not be deleted.");
      setSubmitting(false);
    }
  }

  function submitDelete(): void {
    void confirmDelete();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-panel area-confirm-dialog"
        aria-labelledby="area-delete-dialog-title"
        onMouseDown={stopDialogMouseDown}
      >
        <header>
          <div>
            <h2 id="area-delete-dialog-title">Delete Area</h2>
            <p>Are you sure you want to delete this area?</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close Area delete dialog"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="area-delete-summary">
          <strong>{area.label}</strong>
          <span>{area.subtitle ?? area.rootPath ?? area.kind}</span>
        </div>
        {error && <div className="error-state">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="danger-button" type="button" disabled={submitting} onClick={submitDelete}>
            <Trash2 size={16} /> {submitting ? "Deleting" : "Delete Area"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function sshDefaultsFromArea(area: AreaSummary): {
  host: string;
  username: string | null;
  port: number | null;
} {
  if (area.kind !== "ssh") {
    return { host: "", username: null, port: null };
  }
  const suffix = area.rootPath ? `:${area.rootPath}` : "";
  const authority =
    suffix && area.subtitle?.endsWith(suffix)
      ? area.subtitle.slice(0, -suffix.length)
      : (area.subtitle?.split(":")[0] ?? area.label);
  const [usernamePart, hostPart = usernamePart] = authority.includes("@")
    ? authority.split("@", 2)
    : ["", authority];
  const portSeparator = hostPart.lastIndexOf(":");
  const portValue = portSeparator > -1 ? Number(hostPart.slice(portSeparator + 1)) : null;
  return {
    host: portSeparator > -1 ? hostPart.slice(0, portSeparator) : hostPart,
    username: usernamePart || null,
    port: portValue && Number.isInteger(portValue) ? portValue : null
  };
}
