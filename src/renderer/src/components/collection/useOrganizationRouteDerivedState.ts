import { useMemo } from "react";

import type {
  OrganizationMemberSummary,
  OrganizationRepositorySummary,
  OrganizationSummary,
  OrganizationTeamRepositorySummary,
  ProjectSummary,
  TeamMemberSummary,
  TeamSummary
} from "@shared/github";

import { matchesCollectionFilter } from "./collectionUi";
import { defaultMemberProfileRepositoryLimit } from "./organizationUi";

interface OrganizationRouteDerivedStateInput {
  organizations: OrganizationSummary[];
  organizationRepositories: OrganizationRepositorySummary[];
  organizationProjects: ProjectSummary[];
  organizationTeams: TeamSummary[];
  organizationTeamRepositories: OrganizationTeamRepositorySummary[];
  organizationTeamMembers: TeamMemberSummary[];
  organizationMembers: OrganizationMemberSummary[];
  selectedOrganizationLogin: string | null;
  selectedOrganizationProjectId: string | null;
  selectedOrganizationTeamSlug: string | null;
  selectedOrganizationMemberLogin: string | null;
  collectionFilter: string;
  profileRepositoryLimits: Record<string, number>;
}

export interface OrganizationRouteDerivedState {
  normalizedCollectionFilter: string;
  filteredOrganizations: OrganizationSummary[];
  selectedOrganization: OrganizationSummary | null;
  selectedOrganizationRepositories: OrganizationRepositorySummary[];
  filteredOrganizationProjects: ProjectSummary[];
  selectedOrganizationProject: ProjectSummary | null;
  filteredOrganizationTeams: TeamSummary[];
  selectedOrganizationTeam: TeamSummary | null;
  filteredOrganizationTeamRepositories: OrganizationTeamRepositorySummary[];
  filteredOrganizationTeamMembers: TeamMemberSummary[];
  filteredOrganizationMembers: OrganizationMemberSummary[];
  selectedVisibleOrganizationMember: OrganizationMemberSummary | null;
  selectedVisibleTeamMember: TeamMemberSummary | null;
  selectedOrganizationMember: TeamMemberSummary | OrganizationMemberSummary | null;
  selectedOrganizationMemberRepositoryLimit: number;
  selectedOrganizationMemberContext: string | null;
}

function normalizeCollectionFilter(collectionFilter: string): string {
  return collectionFilter.trim().toLowerCase();
}

function repositoryActivityTime(repository: OrganizationRepositorySummary): number {
  const timestamp = repository.pushedAt ?? repository.updatedAt;
  return timestamp ? Date.parse(timestamp) : 0;
}

function repositoryMatchesFilter(
  repository: OrganizationRepositorySummary,
  normalizedCollectionFilter: string
): boolean {
  return matchesCollectionFilter(
    [
      repository.name,
      repository.owner,
      repository.nameWithOwner,
      repository.description,
      repository.visibility,
      repository.permission,
      repository.defaultBranch
    ],
    normalizedCollectionFilter
  );
}

function projectMatchesFilter(project: ProjectSummary, normalizedCollectionFilter: string): boolean {
  return matchesCollectionFilter(
    [
      project.title,
      project.shortDescription,
      project.ownerLogin,
      project.number ? `#${project.number}` : null,
      project.closed ? "closed" : "open",
      project.isPublic === null ? null : project.isPublic ? "public" : "private",
      ...project.fields.map((field) => `${field.name} ${field.dataType ?? ""}`)
    ],
    normalizedCollectionFilter
  );
}

function organizationMatchesFilter(
  organization: OrganizationSummary,
  normalizedCollectionFilter: string
): boolean {
  return matchesCollectionFilter(
    [
      organization.login,
      organization.name,
      organization.description,
      organization.location,
      organization.websiteUrl
    ],
    normalizedCollectionFilter
  );
}

function teamMatchesFilter(team: TeamSummary, normalizedCollectionFilter: string): boolean {
  return matchesCollectionFilter(
    [team.name, team.slug, team.description, team.privacy, team.permission, team.parent?.name],
    normalizedCollectionFilter
  );
}

function memberMatchesFilter(
  member: TeamMemberSummary | OrganizationMemberSummary,
  normalizedCollectionFilter: string
): boolean {
  return matchesCollectionFilter(
    [member.login, member.siteAdmin ? "site admin" : null],
    normalizedCollectionFilter
  );
}

function filterOrganizations(
  organizations: OrganizationSummary[],
  normalizedCollectionFilter: string
): OrganizationSummary[] {
  return organizations.filter((organization) =>
    organizationMatchesFilter(organization, normalizedCollectionFilter)
  );
}

function sortAndFilterRepositories(
  selectedOrganizationLogin: string | null,
  repositories: OrganizationRepositorySummary[],
  normalizedCollectionFilter: string
): OrganizationRepositorySummary[] {
  if (!selectedOrganizationLogin) {
    return [];
  }

  const matchingRepositories: OrganizationRepositorySummary[] = [];
  for (const repository of repositories) {
    if (repositoryMatchesFilter(repository, normalizedCollectionFilter)) {
      matchingRepositories.push(repository);
    }
  }

  matchingRepositories.sort((a, b) => repositoryActivityTime(b) - repositoryActivityTime(a));
  return matchingRepositories;
}

function filterProjects(projects: ProjectSummary[], normalizedCollectionFilter: string): ProjectSummary[] {
  return projects.filter((project) => projectMatchesFilter(project, normalizedCollectionFilter));
}

function filterTeams(teams: TeamSummary[], normalizedCollectionFilter: string): TeamSummary[] {
  return teams.filter((team) => teamMatchesFilter(team, normalizedCollectionFilter));
}

function filterTeamRepositories(
  repositories: OrganizationTeamRepositorySummary[],
  normalizedCollectionFilter: string
): OrganizationTeamRepositorySummary[] {
  return repositories.filter((repository) => repositoryMatchesFilter(repository, normalizedCollectionFilter));
}

function filterTeamMembers(
  members: TeamMemberSummary[],
  normalizedCollectionFilter: string
): TeamMemberSummary[] {
  return members.filter((member) => memberMatchesFilter(member, normalizedCollectionFilter));
}

function filterOrganizationMembers(
  members: OrganizationMemberSummary[],
  normalizedCollectionFilter: string
): OrganizationMemberSummary[] {
  return members.filter((member) => memberMatchesFilter(member, normalizedCollectionFilter));
}

function selectOrganization(
  organizations: OrganizationSummary[],
  selectedOrganizationLogin: string | null
): OrganizationSummary | null {
  return (
    organizations.find((organization) => organization.login === selectedOrganizationLogin) ??
    organizations[0] ??
    null
  );
}

function selectOrganizationTeam(
  teams: TeamSummary[],
  selectedOrganizationTeamSlug: string | null
): TeamSummary | null {
  return teams.find((team) => team.slug === selectedOrganizationTeamSlug) ?? teams[0] ?? null;
}

function selectedMemberContext(input: {
  selectedOrganization: OrganizationSummary | null;
  selectedOrganizationTeam: TeamSummary | null;
  selectedVisibleTeamMember: TeamMemberSummary | null;
  selectedOrganizationMember: TeamMemberSummary | OrganizationMemberSummary | null;
}): string | null {
  const {
    selectedOrganization,
    selectedOrganizationTeam,
    selectedVisibleTeamMember,
    selectedOrganizationMember
  } = input;

  return selectedOrganizationMember
    ? [
        selectedOrganization?.login ? `${selectedOrganization.login} organization` : null,
        selectedVisibleTeamMember && selectedOrganizationTeam
          ? `${selectedOrganizationTeam.name} team`
          : null,
        selectedOrganizationMember.siteAdmin ? "site admin" : "member"
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · ")
    : null;
}

export function deriveOrganizationRouteState({
  organizations,
  organizationRepositories,
  organizationProjects,
  organizationTeams,
  organizationTeamRepositories,
  organizationTeamMembers,
  organizationMembers,
  selectedOrganizationLogin,
  selectedOrganizationProjectId,
  selectedOrganizationTeamSlug,
  selectedOrganizationMemberLogin,
  collectionFilter,
  profileRepositoryLimits
}: OrganizationRouteDerivedStateInput): OrganizationRouteDerivedState {
  const normalizedCollectionFilter = normalizeCollectionFilter(collectionFilter);
  const filteredOrganizations = filterOrganizations(organizations, normalizedCollectionFilter);
  const selectedOrganization = selectOrganization(organizations, selectedOrganizationLogin);
  const selectedOrganizationRepositories = sortAndFilterRepositories(
    selectedOrganizationLogin,
    organizationRepositories,
    normalizedCollectionFilter
  );
  const filteredOrganizationProjects = filterProjects(organizationProjects, normalizedCollectionFilter);
  const selectedOrganizationProject = selectedOrganizationProjectId
    ? (organizationProjects.find((project) => project.id === selectedOrganizationProjectId) ?? null)
    : null;
  const filteredOrganizationTeams = filterTeams(organizationTeams, normalizedCollectionFilter);
  const selectedOrganizationTeam = selectOrganizationTeam(organizationTeams, selectedOrganizationTeamSlug);
  const filteredOrganizationTeamRepositories = filterTeamRepositories(
    organizationTeamRepositories,
    normalizedCollectionFilter
  );
  const filteredOrganizationTeamMembers = filterTeamMembers(
    organizationTeamMembers,
    normalizedCollectionFilter
  );
  const filteredOrganizationMembers = filterOrganizationMembers(
    organizationMembers,
    normalizedCollectionFilter
  );
  const selectedVisibleOrganizationMember =
    filteredOrganizationMembers.find((member) => member.login === selectedOrganizationMemberLogin) ?? null;
  const selectedVisibleTeamMember =
    filteredOrganizationTeamMembers.find((member) => member.login === selectedOrganizationMemberLogin) ??
    null;
  const selectedOrganizationMember = selectedVisibleTeamMember ?? selectedVisibleOrganizationMember;
  const selectedOrganizationMemberRepositoryLimit = selectedOrganizationMember
    ? (profileRepositoryLimits[selectedOrganizationMember.login] ?? defaultMemberProfileRepositoryLimit)
    : defaultMemberProfileRepositoryLimit;
  const selectedOrganizationMemberContext = selectedMemberContext({
    selectedOrganization,
    selectedOrganizationTeam,
    selectedVisibleTeamMember,
    selectedOrganizationMember
  });

  return {
    normalizedCollectionFilter,
    filteredOrganizations,
    selectedOrganization,
    selectedOrganizationRepositories,
    filteredOrganizationProjects,
    selectedOrganizationProject,
    filteredOrganizationTeams,
    selectedOrganizationTeam,
    filteredOrganizationTeamRepositories,
    filteredOrganizationTeamMembers,
    filteredOrganizationMembers,
    selectedVisibleOrganizationMember,
    selectedVisibleTeamMember,
    selectedOrganizationMember,
    selectedOrganizationMemberRepositoryLimit,
    selectedOrganizationMemberContext
  };
}

export function useOrganizationRouteDerivedState(
  input: OrganizationRouteDerivedStateInput
): OrganizationRouteDerivedState {
  const normalizedCollectionFilter = useMemo(
    () => normalizeCollectionFilter(input.collectionFilter),
    [input.collectionFilter]
  );
  const filteredOrganizations = useMemo(
    () => filterOrganizations(input.organizations, normalizedCollectionFilter),
    [input.organizations, normalizedCollectionFilter]
  );
  const selectedOrganization = useMemo(
    () => selectOrganization(input.organizations, input.selectedOrganizationLogin),
    [input.organizations, input.selectedOrganizationLogin]
  );
  const selectedOrganizationRepositories = useMemo(
    () =>
      sortAndFilterRepositories(
        input.selectedOrganizationLogin,
        input.organizationRepositories,
        normalizedCollectionFilter
      ),
    [input.organizationRepositories, input.selectedOrganizationLogin, normalizedCollectionFilter]
  );
  const filteredOrganizationProjects = useMemo(
    () => filterProjects(input.organizationProjects, normalizedCollectionFilter),
    [input.organizationProjects, normalizedCollectionFilter]
  );
  const selectedOrganizationProject = useMemo(
    () =>
      input.selectedOrganizationProjectId
        ? (input.organizationProjects.find((project) => project.id === input.selectedOrganizationProjectId) ??
          null)
        : null,
    [input.organizationProjects, input.selectedOrganizationProjectId]
  );
  const filteredOrganizationTeams = useMemo(
    () => filterTeams(input.organizationTeams, normalizedCollectionFilter),
    [input.organizationTeams, normalizedCollectionFilter]
  );
  const selectedOrganizationTeam = useMemo(
    () => selectOrganizationTeam(input.organizationTeams, input.selectedOrganizationTeamSlug),
    [input.organizationTeams, input.selectedOrganizationTeamSlug]
  );
  const filteredOrganizationTeamRepositories = useMemo(
    () => filterTeamRepositories(input.organizationTeamRepositories, normalizedCollectionFilter),
    [input.organizationTeamRepositories, normalizedCollectionFilter]
  );
  const filteredOrganizationTeamMembers = useMemo(
    () => filterTeamMembers(input.organizationTeamMembers, normalizedCollectionFilter),
    [input.organizationTeamMembers, normalizedCollectionFilter]
  );
  const filteredOrganizationMembers = useMemo(
    () => filterOrganizationMembers(input.organizationMembers, normalizedCollectionFilter),
    [input.organizationMembers, normalizedCollectionFilter]
  );
  const selectedVisibleOrganizationMember = useMemo(
    () =>
      filteredOrganizationMembers.find((member) => member.login === input.selectedOrganizationMemberLogin) ??
      null,
    [filteredOrganizationMembers, input.selectedOrganizationMemberLogin]
  );
  const selectedVisibleTeamMember = useMemo(
    () =>
      filteredOrganizationTeamMembers.find(
        (member) => member.login === input.selectedOrganizationMemberLogin
      ) ?? null,
    [filteredOrganizationTeamMembers, input.selectedOrganizationMemberLogin]
  );
  const selectedOrganizationMember = selectedVisibleTeamMember ?? selectedVisibleOrganizationMember;
  const selectedOrganizationMemberRepositoryLimit = selectedOrganizationMember
    ? (input.profileRepositoryLimits[selectedOrganizationMember.login] ?? defaultMemberProfileRepositoryLimit)
    : defaultMemberProfileRepositoryLimit;
  const selectedOrganizationMemberContext = useMemo(
    () =>
      selectedMemberContext({
        selectedOrganization,
        selectedOrganizationTeam,
        selectedVisibleTeamMember,
        selectedOrganizationMember
      }),
    [selectedOrganization, selectedOrganizationMember, selectedOrganizationTeam, selectedVisibleTeamMember]
  );

  return {
    normalizedCollectionFilter,
    filteredOrganizations,
    selectedOrganization,
    selectedOrganizationRepositories,
    filteredOrganizationProjects,
    selectedOrganizationProject,
    filteredOrganizationTeams,
    selectedOrganizationTeam,
    filteredOrganizationTeamRepositories,
    filteredOrganizationTeamMembers,
    filteredOrganizationMembers,
    selectedVisibleOrganizationMember,
    selectedVisibleTeamMember,
    selectedOrganizationMember,
    selectedOrganizationMemberRepositoryLimit,
    selectedOrganizationMemberContext
  };
}
