import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import type { AreaSummary, CreateSshAreaInput, UpdateAreaInput } from "@shared/areas";

export function SshAreaDialog({
  onClose,
  onCreate
}: {
  onClose(): void;
  onCreate(input: CreateSshAreaInput): Promise<void>;
}): JSX.Element {
  const [host, setHost] = useState("delta-wsl");
  const [rootPath, setRootPath] = useState("~/controltest");
  const [username, setUsername] = useState("");
  const [port, setPort] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedHost = host.trim();
    const normalizedRootPath = rootPath.trim();
    const normalizedPort = port.trim();

    if (!normalizedHost || !normalizedRootPath) {
      setError("Host and root path are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        host: normalizedHost,
        rootPath: normalizedRootPath,
        username: username.trim() || null,
        label: label.trim() || normalizedHost,
        port: normalizedPort ? Number(normalizedPort) : null
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "SSH Area could not be created.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="settings-panel ssh-area-dialog"
        aria-labelledby="ssh-area-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
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
        <label>
          Label
          <input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label>
          Host
          <input value={host} onChange={(event) => setHost(event.target.value)} />
        </label>
        <label>
          Root path
          <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} />
        </label>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Port
          <input
            inputMode="numeric"
            value={port}
            onChange={(event) => setPort(event.target.value.replace(/\D/g, ""))}
          />
        </label>
        {error && <div className="error-state">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            <Plus size={16} /> {submitting ? "Adding" : "Add SSH Area"}
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
  const sshDefaults = sshDefaultsFromArea(area);
  const [label, setLabel] = useState(area.label);
  const [rootPath, setRootPath] = useState(area.rootPath ?? "");
  const [host, setHost] = useState(sshDefaults.host);
  const [username, setUsername] = useState(sshDefaults.username ?? "");
  const [port, setPort] = useState(sshDefaults.port ? String(sshDefaults.port) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedLabel = label.trim();
    const normalizedRootPath = rootPath.trim();
    const normalizedHost = host.trim();
    const normalizedPort = port.trim();

    if (area.kind === "local" && !normalizedRootPath) {
      setError("Root path is required.");
      return;
    }
    if (area.kind === "ssh" && (!normalizedHost || !normalizedRootPath)) {
      setError("Host and root path are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
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
          username: username.trim() || null,
          port: normalizedPort ? Number(normalizedPort) : null
        });
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Area could not be saved.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="settings-panel area-edit-dialog"
        aria-labelledby="area-edit-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
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
        <label>
          Label
          <input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        {area.kind === "ssh" && (
          <label>
            Host
            <input value={host} onChange={(event) => setHost(event.target.value)} />
          </label>
        )}
        {area.kind !== "github" && (
          <label>
            Root path
            <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} />
          </label>
        )}
        {area.kind === "ssh" && (
          <>
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              Port
              <input
                inputMode="numeric"
                value={port}
                onChange={(event) => setPort(event.target.value.replace(/\D/g, ""))}
              />
            </label>
          </>
        )}
        {error && <div className="error-state">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            <Pencil size={16} /> {submitting ? "Saving" : "Save Area"}
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

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-panel area-confirm-dialog"
        aria-labelledby="area-delete-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
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
          <button
            className="danger-button"
            type="button"
            disabled={submitting}
            onClick={() => void confirmDelete()}
          >
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
