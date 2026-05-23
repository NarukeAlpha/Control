import { Inbox } from "lucide-react";
import type { JSX } from "react";

import type { AppState } from "@shared/github";

export function SetupPanel({ appState }: { appState?: AppState }): JSX.Element {
  return (
    <div className="setup-panel">
      <Inbox size={18} />
      <span>{appState?.github.error ?? "Sign in with GitHub in Settings to load live GitHub data."}</span>
    </div>
  );
}
