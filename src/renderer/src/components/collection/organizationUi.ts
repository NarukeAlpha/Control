import type { OrganizationRepositorySummary, OrganizationTeamRepositorySummary } from "@shared/github";

import { formatRelativeDate } from "../../utils/format";

export const defaultMemberProfileRepositoryLimit = 8;
export const defaultOrganizationListLimit = 50;
export const defaultOrganizationRepositoryLimit = 50;
export const defaultOrganizationTeamLimit = 30;
export const defaultOrganizationMemberLimit = 30;
export const defaultOrganizationProjectLimit = 20;
export const defaultOrganizationTeamRepositoryLimit = 30;
export const defaultOrganizationTeamMemberLimit = 30;
export const maxOrganizationListLimit = 100;
export const maxOrganizationRepositoryLimit = 100;
export const maxOrganizationTeamLimit = 100;
export const maxOrganizationMemberLimit = 100;
export const maxOrganizationProjectLimit = 100;
export const maxOrganizationTeamRepositoryLimit = 100;
export const maxOrganizationTeamMemberLimit = 100;

type OrganizationCollectionRepositorySummary =
  | OrganizationRepositorySummary
  | OrganizationTeamRepositorySummary;

export function organizationRepositoryCollectionMetadataParts(
  repository: OrganizationCollectionRepositorySummary
): string[] {
  const nameWithOwner = repository.nameWithOwner.includes("/")
    ? repository.nameWithOwner
    : `${repository.owner}/${repository.name}`;
  const parts = [
    nameWithOwner,
    repository.permission ? `${repository.permission} access` : null,
    repository.defaultBranch ? `default ${repository.defaultBranch}` : null,
    repository.pushedAt ? `pushed ${formatRelativeDate(repository.pushedAt)}` : null,
    repository.updatedAt && repository.updatedAt !== repository.pushedAt
      ? `updated ${formatRelativeDate(repository.updatedAt)}`
      : null,
    !repository.pushedAt && !repository.updatedAt ? "activity unknown" : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}

export function organizationRepositoryCollectionChips(
  repository: OrganizationCollectionRepositorySummary,
  pinned: boolean
): string[] {
  const visibility = repository.visibility?.toLowerCase() ?? null;
  const privacy =
    typeof repository.isPrivate === "boolean" ? (repository.isPrivate ? "private" : "public") : null;
  const parts = [
    visibility ?? privacy,
    pinned ? "pinned" : null,
    privacy && visibility && visibility !== privacy ? privacy : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}
