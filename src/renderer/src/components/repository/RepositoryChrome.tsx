import type { JSX, ReactNode, SyntheticEvent } from "react";

import { RepositoryHero, StateChip, type StateTone } from "../ui";

export type RepositoryDataSource = "github" | "local" | "local-connected-github";

export interface RepositoryChromeChip {
  label: string;
  tone?: "default" | "success" | "attention";
}

export interface RepositoryChromeModel {
  source: RepositoryDataSource;
  iconLabel: string;
  avatarUrl?: string | null;
  title: ReactNode;
  subtitle?: string | null;
  description?: string | null;
  path?: string | null;
  statusChips: RepositoryChromeChip[];
}

function repositoryChromeChipTone(tone: RepositoryChromeChip["tone"]): StateTone {
  if (tone === "success") {
    return "success";
  }

  if (tone === "attention") {
    return "warning";
  }

  return "neutral";
}

function removeBrokenRepositoryChromeAvatar(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.remove();
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
  const chips =
    model.statusChips.length > 0 ? (
      <>
        {model.statusChips.map((chip) => (
          <StateChip key={chip.label} tone={repositoryChromeChipTone(chip.tone)}>
            {chip.label}
          </StateChip>
        ))}
      </>
    ) : null;
  const actionGroup = actions ? <div className="repo-action-row">{actions}</div> : null;

  return (
    <RepositoryHero
      className={`repo-hero repository-chrome repository-chrome-${model.source}`}
      leading={
        <div className="repo-icon">
          <span>{model.iconLabel}</span>
          {model.avatarUrl && (
            <img src={model.avatarUrl} alt="" onError={removeBrokenRepositoryChromeAvatar} />
          )}
        </div>
      }
      title={model.title}
      subtitle={model.subtitle}
      chips={chips}
      actions={actionGroup}
    >
      {model.path && <p className="muted-row">{model.path}</p>}
      {model.description && <p>{model.description}</p>}
      {children}
    </RepositoryHero>
  );
}
