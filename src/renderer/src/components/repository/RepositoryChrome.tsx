import type { JSX, ReactNode } from "react";

export type RepositoryDataSource = "github" | "local" | "local-connected-github";

export interface RepositoryChromeChip {
  label: string;
  tone?: "default" | "success" | "attention";
}

export interface RepositoryChromeModel {
  source: RepositoryDataSource;
  iconLabel: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  path?: string | null;
  statusChips: RepositoryChromeChip[];
}

export function RepositoryChrome({
  model,
  actions = null,
  children = null
}: {
  model: RepositoryChromeModel;
  actions?: ReactNode;
  children?: ReactNode;
}): JSX.Element {
  return (
    <header className={`repo-hero repository-chrome repository-chrome-${model.source}`}>
      <div className="repo-icon">
        <span>{model.iconLabel}</span>
      </div>
      <div className="repo-title-block">
        <div className="repo-title-line">
          <h1>{model.title}</h1>
          <span className="row-chip-stack repository-chrome-chips">
            {model.statusChips.map((chip) => (
              <span className={`state-chip ${chip.tone ?? ""}`} key={chip.label}>
                {chip.label}
              </span>
            ))}
          </span>
        </div>
        {model.subtitle && <p>{model.subtitle}</p>}
        {model.path && <p className="muted-row">{model.path}</p>}
        {model.description && <p>{model.description}</p>}
        {children}
      </div>
      {actions && <div className="repo-action-row">{actions}</div>}
    </header>
  );
}
