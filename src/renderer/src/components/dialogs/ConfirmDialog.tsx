import { X } from "lucide-react";
import { useEffect, type JSX } from "react";

import type { ConfirmationPrompt } from "./confirmation";

interface ConfirmDialogProps {
  prompt: ConfirmationPrompt;
  onCancel(): void;
  onConfirm(): void;
}

export function ConfirmDialog({ prompt, onCancel, onConfirm }: ConfirmDialogProps): JSX.Element {
  const confirmLabel = prompt.confirmLabel ?? "Confirm";
  const cancelLabel = prompt.cancelLabel ?? "Cancel";
  const tone = prompt.tone ?? "default";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="settings-panel confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="confirmation-dialog-title">{prompt.title}</h2>
            <p>{prompt.message}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close confirmation" onClick={onCancel}>
            <X size={16} />
          </button>
        </header>
        {prompt.details && <div className="confirmation-dialog-details">{prompt.details}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "danger-button" : "primary-button"}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
