import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type {
  GitHubReadAvailability,
  OrganizationMemberSummary,
  OrganizationRepositorySummary,
  OrganizationSummary,
  OrganizationTeamRepositorySummary,
  ProjectSummary,
  TeamMemberSummary,
  TeamSummary
} from "@shared/github";

import { useControlApi } from "../../hooks/useControlApi";
import { useRecentRecorder } from "../../hooks/useRecentRecorder";
import {
  organizationProjectRecentInput,
  organizationRecentInput,
  teamRecentInput
} from "../recent/recentRecordInputs";
import { useUiStore } from "../../stores/uiStore";
import { refreshOrganizationsRouteData, useOrganizationsRouteQueries } from "./organizationQueries";
import {
  defaultOrganizationListLimit,
  defaultOrganizationMemberLimit,
  defaultOrganizationProjectLimit,
  defaultOrganizationRepositoryLimit,
  defaultOrganizationTeamLimit,
  defaultOrganizationTeamMemberLimit,
  defaultOrganizationTeamRepositoryLimit,
  maxOrganizationListLimit,
  maxOrganizationMemberLimit,
  maxOrganizationProjectLimit,
  maxOrganizationRepositoryLimit,
  maxOrganizationTeamLimit,
  maxOrganizationTeamMemberLimit,
  maxOrganizationTeamRepositoryLimit
} from "./organizationUi";

interface UseOrganizationsRouteStateInput {
  appReady: boolean;
  enabled: boolean;
  githubReady: boolean;
  recentItemLimit: number;
}

export interface OrganizationsRouteState {
  organizations: OrganizationSummary[];
  organizationItems: OrganizationSummary[];
  selectedOrganization: OrganizationSummary | null;
  selectedOrganizationLogin: string | null;
  organizationListLimit: number;
  organizationsAvailability: GitHubReadAvailability | null;
  organizationsLoading: boolean;
  organizationsFetching: boolean;
  organizationsError: Error | null;
  organizationTeams: TeamSummary[];
  organizationTeamLimit: number;
  organizationTeamsAvailability: GitHubReadAvailability | null;
  organizationTeamsLoading: boolean;
  organizationTeamsFetching: boolean;
  organizationTeamsError: Error | null;
  organizationRepositories: OrganizationRepositorySummary[];
  organizationRepositoriesAvailability: GitHubReadAvailability | null;
  organizationRepositoryLimit: number;
  organizationRepositoriesLoading: boolean;
  organizationRepositoriesFetching: boolean;
  organizationRepositoriesError: Error | null;
  organizationMembers: OrganizationMemberSummary[];
  organizationMembersAvailability: GitHubReadAvailability | null;
  organizationMemberLimit: number;
  organizationMembersLoading: boolean;
  organizationMembersFetching: boolean;
  organizationMembersError: Error | null;
  selectedOrganizationMemberLogin: string | null;
  selectedOrganizationTeam: TeamSummary | null;
  selectedOrganizationTeamSlug: string | null;
  organizationTeamRepositories: OrganizationTeamRepositorySummary[];
  organizationTeamRepositoriesAvailability: GitHubReadAvailability | null;
  organizationTeamRepositoryLimit: number;
  organizationTeamRepositoriesLoading: boolean;
  organizationTeamRepositoriesFetching: boolean;
  organizationTeamRepositoriesError: Error | null;
  organizationTeamMembers: TeamMemberSummary[];
  organizationTeamMembersAvailability: GitHubReadAvailability | null;
  organizationTeamMemberLimit: number;
  organizationTeamMembersLoading: boolean;
  organizationTeamMembersFetching: boolean;
  organizationTeamMembersError: Error | null;
  organizationProjects: ProjectSummary[];
  organizationProjectsAvailability: GitHubReadAvailability | null;
  organizationProjectLimit: number;
  organizationProjectsLoading: boolean;
  organizationProjectsFetching: boolean;
  organizationProjectsError: Error | null;
  selectedOrganizationProjectId: string | null;
  refreshInFlight: boolean;
  openOrganizations(): void;
  openOrganization(organization: OrganizationSummary): void;
  openTeam(team: TeamSummary): void;
  openOrganizationMember(organization: OrganizationSummary, member: OrganizationMemberSummary): void;
  openOrganizationTeamMember(
    organization: OrganizationSummary,
    team: TeamSummary,
    member: TeamMemberSummary
  ): void;
  onSelectOrganization(login: string): void;
  onSelectOrganizationTeam(slug: string): void;
  onSelectOrganizationMember(login: string): void;
  onSelectOrganizationProject(project: ProjectSummary): void;
  setSelectedOrganizationLogin(login: string | null): void;
  setSelectedOrganizationTeamSlug(slug: string | null): void;
  setSelectedOrganizationMemberLogin(login: string | null): void;
  setSelectedOrganizationProjectId(id: string | null): void;
  expandOrganizationList(): void;
  expandSelectedOrganizationRepositories(): void;
  expandSelectedOrganizationTeams(): void;
  expandSelectedOrganizationMembers(): void;
  expandSelectedOrganizationProjects(): void;
  expandSelectedOrganizationTeamRepositories(): void;
  expandSelectedOrganizationTeamMembers(): void;
  refreshNow(): Promise<void>;
}

export function useOrganizationsRouteState({
  appReady,
  enabled,
  githubReady,
  recentItemLimit
}: UseOrganizationsRouteStateInput): OrganizationsRouteState {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const goToOrganizations = useUiStore((state) => state.goToOrganizations);
  const { recordRecent } = useRecentRecorder(recentItemLimit);
  const [organizationListLimit, setOrganizationListLimit] = useState(defaultOrganizationListLimit);
  const [organizationRepositoryLimits, setOrganizationRepositoryLimits] = useState<Record<string, number>>(
    {}
  );
  const [organizationTeamLimits, setOrganizationTeamLimits] = useState<Record<string, number>>({});
  const [organizationMemberLimits, setOrganizationMemberLimits] = useState<Record<string, number>>({});
  const [organizationProjectLimits, setOrganizationProjectLimits] = useState<Record<string, number>>({});
  const [organizationTeamRepositoryLimits, setOrganizationTeamRepositoryLimits] = useState<
    Record<string, number>
  >({});
  const [organizationTeamMemberLimits, setOrganizationTeamMemberLimits] = useState<Record<string, number>>(
    {}
  );
  const [selectedOrganizationLogin, setSelectedOrganizationLogin] = useState<string | null>(null);
  const [selectedOrganizationTeamSlug, setSelectedOrganizationTeamSlug] = useState<string | null>(null);
  const [selectedOrganizationMemberLogin, setSelectedOrganizationMemberLogin] = useState<string | null>(null);
  const [selectedOrganizationProjectId, setSelectedOrganizationProjectId] = useState<string | null>(null);

  const {
    organizations,
    organizationItems,
    organizationsAvailability,
    selectedOrganization,
    organizationRepositoryLimit,
    organizationTeamLimit,
    organizationMemberLimit,
    organizationProjectLimit,
    organizationTeams,
    organizationRepositories,
    organizationMembers,
    selectedOrganizationTeam,
    organizationTeamRepositoryLimit,
    organizationTeamMemberLimit,
    organizationTeamRepositories,
    organizationTeamMembers,
    organizationProjects
  } = useOrganizationsRouteQueries({
    enabled,
    githubReady,
    organizationListLimit,
    selectedOrganizationLogin,
    organizationRepositoryLimits,
    organizationTeamLimits,
    organizationMemberLimits,
    organizationProjectLimits,
    selectedOrganizationTeamSlug,
    organizationTeamRepositoryLimits,
    organizationTeamMemberLimits
  });

  const effectiveOrganizationLogin = selectedOrganization?.login ?? null;
  const effectiveOrganizationTeamSlug = selectedOrganizationTeam?.slug ?? null;
  const refreshInFlight =
    organizations.isFetching ||
    organizationTeams.isFetching ||
    organizationMembers.isFetching ||
    organizationRepositories.isFetching ||
    organizationTeamRepositories.isFetching ||
    organizationTeamMembers.isFetching ||
    organizationProjects.isFetching;

  function clearOrganizationDetailSelection(): void {
    setSelectedOrganizationTeamSlug(null);
    setSelectedOrganizationMemberLogin(null);
    setSelectedOrganizationProjectId(null);
  }

  function openOrganizations(): void {
    clearOrganizationDetailSelection();
    goToOrganizations();
  }

  function openOrganization(organization: OrganizationSummary): void {
    recordRecent(organizationRecentInput(organization));
    setSelectedOrganizationLogin(organization.login);
    clearOrganizationDetailSelection();
    goToOrganizations();
  }

  function openTeam(team: TeamSummary): void {
    recordRecent(teamRecentInput(team));
    setSelectedOrganizationLogin(team.organizationLogin);
    setSelectedOrganizationTeamSlug(team.slug);
    setSelectedOrganizationMemberLogin(null);
    setSelectedOrganizationProjectId(null);
    goToOrganizations();
  }

  function openOrganizationMember(
    organization: OrganizationSummary,
    member: OrganizationMemberSummary
  ): void {
    recordRecent(organizationRecentInput(organization));
    setSelectedOrganizationLogin(organization.login);
    setSelectedOrganizationTeamSlug(null);
    setSelectedOrganizationMemberLogin(member.login);
    setSelectedOrganizationProjectId(null);
    goToOrganizations();
  }

  function openOrganizationTeamMember(
    organization: OrganizationSummary,
    team: TeamSummary,
    member: TeamMemberSummary
  ): void {
    recordRecent(teamRecentInput(team));
    setSelectedOrganizationLogin(organization.login);
    setSelectedOrganizationTeamSlug(team.slug);
    setSelectedOrganizationMemberLogin(member.login);
    setSelectedOrganizationProjectId(null);
    goToOrganizations();
  }

  function onSelectOrganization(login: string): void {
    const organization = organizationItems.find((item) => item.login === login);
    if (organization) {
      recordRecent(organizationRecentInput(organization));
    }
    setSelectedOrganizationLogin(login);
    clearOrganizationDetailSelection();
  }

  function onSelectOrganizationTeam(slug: string): void {
    const team = organizationTeams.data?.items.find((item) => item.slug === slug);
    if (team) {
      recordRecent(teamRecentInput(team));
    }
    setSelectedOrganizationTeamSlug(slug);
    setSelectedOrganizationMemberLogin(null);
    setSelectedOrganizationProjectId(null);
  }

  function onSelectOrganizationMember(login: string): void {
    setSelectedOrganizationMemberLogin(login);
    setSelectedOrganizationProjectId(null);
  }

  function onSelectOrganizationProject(project: ProjectSummary): void {
    if (!selectedOrganization) {
      return;
    }

    setSelectedOrganizationLogin(selectedOrganization.login);
    setSelectedOrganizationTeamSlug(null);
    setSelectedOrganizationMemberLogin(null);
    setSelectedOrganizationProjectId(project.id);
    goToOrganizations();
    recordRecent(organizationProjectRecentInput(selectedOrganization, project));
  }

  function expandOrganizationList(): void {
    setOrganizationListLimit((currentLimit) => {
      if (currentLimit >= maxOrganizationListLimit) {
        return currentLimit;
      }

      return maxOrganizationListLimit;
    });
  }

  function expandSelectedOrganizationRepositories(): void {
    if (!effectiveOrganizationLogin) {
      return;
    }

    setOrganizationRepositoryLimits((limits) => {
      const currentLimit = limits[effectiveOrganizationLogin] ?? defaultOrganizationRepositoryLimit;
      if (currentLimit >= maxOrganizationRepositoryLimit) {
        return limits;
      }

      return { ...limits, [effectiveOrganizationLogin]: maxOrganizationRepositoryLimit };
    });
  }

  function expandSelectedOrganizationTeams(): void {
    if (!effectiveOrganizationLogin) {
      return;
    }

    setOrganizationTeamLimits((limits) => {
      const currentLimit = limits[effectiveOrganizationLogin] ?? defaultOrganizationTeamLimit;
      if (currentLimit >= maxOrganizationTeamLimit) {
        return limits;
      }

      return { ...limits, [effectiveOrganizationLogin]: maxOrganizationTeamLimit };
    });
  }

  function expandSelectedOrganizationMembers(): void {
    if (!effectiveOrganizationLogin) {
      return;
    }

    setOrganizationMemberLimits((limits) => {
      const currentLimit = limits[effectiveOrganizationLogin] ?? defaultOrganizationMemberLimit;
      if (currentLimit >= maxOrganizationMemberLimit) {
        return limits;
      }

      return { ...limits, [effectiveOrganizationLogin]: maxOrganizationMemberLimit };
    });
  }

  function expandSelectedOrganizationProjects(): void {
    if (!effectiveOrganizationLogin) {
      return;
    }

    setOrganizationProjectLimits((limits) => {
      const currentLimit = limits[effectiveOrganizationLogin] ?? defaultOrganizationProjectLimit;
      if (currentLimit >= maxOrganizationProjectLimit) {
        return limits;
      }

      return { ...limits, [effectiveOrganizationLogin]: maxOrganizationProjectLimit };
    });
  }

  function expandSelectedOrganizationTeamRepositories(): void {
    if (!effectiveOrganizationLogin || !effectiveOrganizationTeamSlug) {
      return;
    }

    const key = `${effectiveOrganizationLogin}/${effectiveOrganizationTeamSlug}`;
    setOrganizationTeamRepositoryLimits((limits) => {
      const currentLimit = limits[key] ?? defaultOrganizationTeamRepositoryLimit;
      if (currentLimit >= maxOrganizationTeamRepositoryLimit) {
        return limits;
      }

      return { ...limits, [key]: maxOrganizationTeamRepositoryLimit };
    });
  }

  function expandSelectedOrganizationTeamMembers(): void {
    if (!effectiveOrganizationLogin || !effectiveOrganizationTeamSlug) {
      return;
    }

    const key = `${effectiveOrganizationLogin}/${effectiveOrganizationTeamSlug}`;
    setOrganizationTeamMemberLimits((limits) => {
      const currentLimit = limits[key] ?? defaultOrganizationTeamMemberLimit;
      if (currentLimit >= maxOrganizationTeamMemberLimit) {
        return limits;
      }

      return { ...limits, [key]: maxOrganizationTeamMemberLimit };
    });
  }

  async function refreshNow(): Promise<void> {
    if (!appReady) {
      return;
    }

    await refreshOrganizationsRouteData(queryClient, {
      api,
      githubReady,
      organizationListLimit,
      selectedOrganizationLogin: effectiveOrganizationLogin,
      organizationRepositoryLimit,
      organizationTeamLimit,
      organizationMemberLimit,
      organizationProjectLimit,
      selectedOrganizationTeamSlug: effectiveOrganizationTeamSlug,
      organizationTeamRepositoryLimit,
      organizationTeamMemberLimit
    });
  }

  return {
    organizations: organizationItems,
    organizationItems,
    selectedOrganization,
    selectedOrganizationLogin: effectiveOrganizationLogin,
    organizationListLimit,
    organizationsAvailability,
    organizationsLoading: organizations.isLoading || organizations.isFetching,
    organizationsFetching: organizations.isFetching,
    organizationsError: organizations.error,
    organizationTeams: organizationTeams.data?.items ?? [],
    organizationTeamLimit,
    organizationTeamsAvailability: organizationTeams.data?.availability ?? null,
    organizationTeamsLoading: organizationTeams.isLoading || organizationTeams.isFetching,
    organizationTeamsFetching: organizationTeams.isFetching,
    organizationTeamsError: organizationTeams.error,
    organizationRepositories: organizationRepositories.data?.items ?? [],
    organizationRepositoriesAvailability: organizationRepositories.data?.availability ?? null,
    organizationRepositoryLimit,
    organizationRepositoriesLoading:
      organizationRepositories.isLoading || organizationRepositories.isFetching,
    organizationRepositoriesFetching: organizationRepositories.isFetching,
    organizationRepositoriesError: organizationRepositories.error,
    organizationMembers: organizationMembers.data?.items ?? [],
    organizationMembersAvailability: organizationMembers.data?.availability ?? null,
    organizationMemberLimit,
    organizationMembersLoading: organizationMembers.isLoading || organizationMembers.isFetching,
    organizationMembersFetching: organizationMembers.isFetching,
    organizationMembersError: organizationMembers.error,
    selectedOrganizationMemberLogin,
    selectedOrganizationTeam,
    selectedOrganizationTeamSlug: effectiveOrganizationTeamSlug,
    organizationTeamRepositories: organizationTeamRepositories.data?.items ?? [],
    organizationTeamRepositoriesAvailability: organizationTeamRepositories.data?.availability ?? null,
    organizationTeamRepositoryLimit,
    organizationTeamRepositoriesLoading:
      organizationTeamRepositories.isLoading || organizationTeamRepositories.isFetching,
    organizationTeamRepositoriesFetching: organizationTeamRepositories.isFetching,
    organizationTeamRepositoriesError: organizationTeamRepositories.error,
    organizationTeamMembers: organizationTeamMembers.data?.items ?? [],
    organizationTeamMembersAvailability: organizationTeamMembers.data?.availability ?? null,
    organizationTeamMemberLimit,
    organizationTeamMembersLoading: organizationTeamMembers.isLoading || organizationTeamMembers.isFetching,
    organizationTeamMembersFetching: organizationTeamMembers.isFetching,
    organizationTeamMembersError: organizationTeamMembers.error,
    organizationProjects: organizationProjects.data?.items ?? [],
    organizationProjectsAvailability: organizationProjects.data?.availability ?? null,
    organizationProjectLimit,
    organizationProjectsLoading: organizationProjects.isLoading || organizationProjects.isFetching,
    organizationProjectsFetching: organizationProjects.isFetching,
    organizationProjectsError: organizationProjects.error,
    selectedOrganizationProjectId,
    refreshInFlight,
    openOrganizations,
    openOrganization,
    openTeam,
    openOrganizationMember,
    openOrganizationTeamMember,
    onSelectOrganization,
    onSelectOrganizationTeam,
    onSelectOrganizationMember,
    onSelectOrganizationProject,
    setSelectedOrganizationLogin,
    setSelectedOrganizationTeamSlug,
    setSelectedOrganizationMemberLogin,
    setSelectedOrganizationProjectId,
    expandOrganizationList,
    expandSelectedOrganizationRepositories,
    expandSelectedOrganizationTeams,
    expandSelectedOrganizationMembers,
    expandSelectedOrganizationProjects,
    expandSelectedOrganizationTeamRepositories,
    expandSelectedOrganizationTeamMembers,
    refreshNow
  };
}
