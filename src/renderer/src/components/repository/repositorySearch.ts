import type { RepositoryDetail, RepositorySummary } from "@shared/github";

import { repositoryCollectionMetadataParts } from "./repositoryUi";
import { formatRelativeDate } from "../../utils/format";

export const maxRepositoryListLimit = 100;
export const defaultRepositorySearchLocalLimit = 5;
export const defaultRepositorySearchRemoteLimit = 8;

export function titleCaseRepositoryName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => (part.length > 0 ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

export function displayRepositoryName(
  repository: RepositorySummary | RepositoryDetail,
  viewerLogin?: string | null
): string {
  if (viewerLogin && repository.owner.toLowerCase() === viewerLogin.toLowerCase()) {
    return titleCaseRepositoryName(repository.name);
  }

  return repository.nameWithOwner;
}

export function repositoryActivityDate(repository: RepositorySummary): string | null {
  return repository.pushedAt ?? repository.updatedAt;
}

export function repositorySearchMetadataLabel(repository: RepositorySummary): string {
  const visibility = repository.visibility?.toLowerCase() ?? null;
  const visibilityParts = [
    repository.isPrivate && visibility !== "private" ? "private" : null,
    visibility,
    repository.isFork ? "fork" : null
  ];
  const metadataParts = repositoryCollectionMetadataParts(repository).filter(
    (part) => part !== repository.nameWithOwner
  );
  const parts = [repository.description, ...visibilityParts, ...metadataParts];

  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export function repositorySearchSourceLabel(
  repository: RepositorySummary,
  source: "Local" | "GitHub"
): string {
  const visibility = repository.visibility?.toLowerCase() ?? null;
  const parts = [
    source,
    repository.isPrivate && visibility !== "private" ? "private" : null,
    repository.isFork ? "fork" : null
  ];

  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export function sortRepositoriesByActivity(repositories: RepositorySummary[]): RepositorySummary[] {
  return [...repositories].sort((a, b) => {
    const aTime = new Date(repositoryActivityDate(a) ?? 0).getTime();
    const bTime = new Date(repositoryActivityDate(b) ?? 0).getTime();
    return bTime - aTime;
  });
}

export function repositoryMatchesQuery(repository: RepositorySummary, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return false;
  }
  return [
    repository.nameWithOwner,
    repository.owner,
    repository.name,
    repository.description ?? "",
    repository.primaryLanguage?.name ?? ""
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

export interface RepositoryShortcut {
  id: string;
  owner: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  visibility: string | null;
  isPrivate: boolean;
  primaryLanguage: RepositorySummary["primaryLanguage"];
  updatedAt: string | null;
  pushedAt: string | null;
}

export function repositoryShortcutFromName(
  nameWithOwner: string,
  repository?: RepositorySummary
): RepositoryShortcut {
  if (repository) {
    return {
      id: repository.id,
      owner: repository.owner,
      name: repository.name,
      nameWithOwner: repository.nameWithOwner,
      description: repository.description,
      visibility: repository.visibility,
      isPrivate: repository.isPrivate,
      primaryLanguage: repository.primaryLanguage,
      updatedAt: repository.updatedAt,
      pushedAt: repository.pushedAt
    };
  }

  const [owner = nameWithOwner, name = nameWithOwner] = nameWithOwner.split("/");
  return {
    id: nameWithOwner,
    owner,
    name,
    nameWithOwner,
    description: null,
    visibility: null,
    isPrivate: false,
    primaryLanguage: null,
    updatedAt: null,
    pushedAt: null
  };
}

export function repositoryShortcutsFromPins(
  pinnedRepositoryNames: string[],
  repositories: RepositorySummary[]
): RepositoryShortcut[] {
  const repositoriesByName = new Map(
    repositories.map((repository) => [repository.nameWithOwner.toLowerCase(), repository])
  );

  return pinnedRepositoryNames.map((nameWithOwner) =>
    repositoryShortcutFromName(nameWithOwner, repositoriesByName.get(nameWithOwner.toLowerCase()))
  );
}

export function displayRepositoryShortcutName(
  repository: RepositoryShortcut,
  viewerLogin?: string | null
): string {
  if (viewerLogin && repository.owner.toLowerCase() === viewerLogin.toLowerCase()) {
    return titleCaseRepositoryName(repository.name);
  }

  return repository.nameWithOwner;
}

export function repositoryShortcutMetadataParts(repository: RepositoryShortcut): string[] {
  const nameWithOwner = repository.nameWithOwner.includes("/")
    ? repository.nameWithOwner
    : `${repository.owner}/${repository.name}`;
  const parts = [
    nameWithOwner,
    repository.primaryLanguage?.name ?? null,
    repository.pushedAt ? `pushed ${formatRelativeDate(repository.pushedAt)}` : null,
    repository.updatedAt && repository.updatedAt !== repository.pushedAt
      ? `updated ${formatRelativeDate(repository.updatedAt)}`
      : null,
    !repository.pushedAt && !repository.updatedAt ? "cached locally" : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}

export function sidebarRepositoryMetadataParts(
  repository: RepositoryShortcut,
  source: "Local" | "GitHub" | null,
  showSource: boolean
): string[] {
  const visibility = repository.visibility?.toLowerCase() ?? (repository.isPrivate ? "private" : null);
  const activity = repository.pushedAt
    ? `pushed ${formatRelativeDate(repository.pushedAt)}`
    : repository.updatedAt
      ? `updated ${formatRelativeDate(repository.updatedAt)}`
      : null;
  const parts = [
    visibility,
    repository.primaryLanguage?.name ?? null,
    activity,
    showSource && source ? source : null,
    !activity ? "cached locally" : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}

export function repositoryShortcutChips(repository: RepositoryShortcut): string[] {
  const visibility = repository.visibility?.toLowerCase() ?? null;
  const privacy = repository.isPrivate ? "private" : null;
  const parts = [visibility ?? privacy, "pinned", privacy && visibility !== privacy ? privacy : null];

  return parts.filter((part): part is string => Boolean(part));
}

export function repositoryNameWithOwnerInput(value: string): string | null {
  const normalizedValue = value.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedValue)) {
    return null;
  }
  return normalizedValue;
}
