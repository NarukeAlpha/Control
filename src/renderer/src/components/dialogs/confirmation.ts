type ConfirmationTone = "default" | "danger";

export interface ConfirmationPrompt {
  title: string;
  message: string;
  details?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
}

export type ConfirmAction = (prompt: ConfirmationPrompt) => Promise<boolean>;
