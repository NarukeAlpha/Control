import type { RepositoryDetail, RepositorySummary } from "@shared/github";

import { repositoryCollectionMetadataParts } from "./repositoryUi";

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

export function repositoryNameWithOwnerInput(value: string): string | null {
  const normalizedValue = value.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedValue)) {
    return null;
  }
  return normalizedValue;
}
