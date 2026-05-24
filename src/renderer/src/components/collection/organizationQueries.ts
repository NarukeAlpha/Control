import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  OrganizationMembersResult,
  OrganizationRepositoriesResult,
  OrganizationTeamMembersResult,
  OrganizationTeamRepositoriesResult,
  OrganizationTeamsResult,
  ProjectListResult
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "../../hooks/useControlApi";
import {
  defaultOrganizationMemberLimit,
  defaultOrganizationProjectLimit,
  defaultOrganizationRepositoryLimit,
  defaultOrganizationTeamLimit,
  defaultOrganizationTeamMemberLimit,
  defaultOrganizationTeamRepositoryLimit
} from "./organizationUi";

export function organizationsQueryKey(limit: number): readonly ["organizations", number] {
  return ["organizations", limit] as const;
}

export function organizationTeamsQueryKey(
  org: string,
  limit: number
): readonly ["organization-teams", string, number] {
  return ["organization-teams", org, limit] as const;
}

export function organizationRepositoriesQueryKey(
  org: string,
  limit: number
): readonly ["organization-repositories", string, number] {
  return ["organization-repositories", org, limit] as const;
}

export function organizationMembersQueryKey(
  org: string,
  limit: number
): readonly ["organization-members", string, number] {
  return ["organization-members", org, limit] as const;
}

export function organizationProjectsQueryKey(
  org: string,
  limit: number
): readonly ["organization-projects", string, number] {
  return ["organization-projects", org, limit] as const;
}

export function organizationTeamRepositoriesQueryKey(
  org: string,
  teamSlug: string,
  limit: number
): readonly ["organization-team-repositories", string, string, number] {
  return ["organization-team-repositories", org, teamSlug, limit] as const;
}

export function organizationTeamMembersQueryKey(
  org: string,
  teamSlug: string,
  limit: number
): readonly ["organization-team-members", string, string, number] {
  return ["organization-team-members", org, teamSlug, limit] as const;
}

export interface OrganizationsRouteQueryInput {
  enabled: boolean;
  githubReady: boolean;
  organizationListLimit: number;
  selectedOrganizationLogin: string | null;
  organizationRepositoryLimits: Record<string, number>;
  organizationTeamLimits: Record<string, number>;
  organizationMemberLimits: Record<string, number>;
  organizationProjectLimits: Record<string, number>;
  selectedOrganizationTeamSlug: string | null;
  organizationTeamRepositoryLimits: Record<string, number>;
  organizationTeamMemberLimits: Record<string, number>;
}

export function useOrganizationsRouteQueries({
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
}: OrganizationsRouteQueryInput) {
  const api = useControlApi();
  const organizations = useQuery({
    queryKey: organizationsQueryKey(organizationListLimit),
    queryFn: () =>
      api.github.listOrganizationsWithStatus({ limit: organizationListLimit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000,
    placeholderData: (previousData) => previousData
  });
  const organizationItems = organizations.data?.items ?? [];
  const organizationsAvailability = organizations.data?.availability ?? null;
  const selectedOrganization =
    organizationItems.find((organization) => organization.login === selectedOrganizationLogin) ??
    organizationItems[0] ??
    null;
  const organizationRepositoryLimit = selectedOrganization
    ? (organizationRepositoryLimits[selectedOrganization.login] ?? defaultOrganizationRepositoryLimit)
    : defaultOrganizationRepositoryLimit;
  const organizationTeamLimit = selectedOrganization
    ? (organizationTeamLimits[selectedOrganization.login] ?? defaultOrganizationTeamLimit)
    : defaultOrganizationTeamLimit;
  const organizationMemberLimit = selectedOrganization
    ? (organizationMemberLimits[selectedOrganization.login] ?? defaultOrganizationMemberLimit)
    : defaultOrganizationMemberLimit;
  const organizationProjectLimit = selectedOrganization
    ? (organizationProjectLimits[selectedOrganization.login] ?? defaultOrganizationProjectLimit)
    : defaultOrganizationProjectLimit;
  const organizationTeams = useQuery<OrganizationTeamsResult>({
    queryKey: organizationTeamsQueryKey(selectedOrganization?.login ?? "none", organizationTeamLimit),
    queryFn: () =>
      api.github.listOrganizationTeamsWithStatus({
        org: selectedOrganization!.login,
        limit: organizationTeamLimit,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(selectedOrganization),
    staleTime: 120_000
  });
  const organizationRepositories = useQuery<OrganizationRepositoriesResult>({
    queryKey: organizationRepositoriesQueryKey(
      selectedOrganization?.login ?? "none",
      organizationRepositoryLimit
    ),
    queryFn: () =>
      api.github.listOrganizationRepositoriesWithStatus({
        org: selectedOrganization!.login,
        limit: organizationRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(selectedOrganization),
    staleTime: 120_000
  });
  const organizationMembers = useQuery<OrganizationMembersResult>({
    queryKey: organizationMembersQueryKey(selectedOrganization?.login ?? "none", organizationMemberLimit),
    queryFn: () =>
      api.github.listOrganizationMembersWithStatus({
        org: selectedOrganization!.login,
        limit: organizationMemberLimit,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(selectedOrganization),
    staleTime: 120_000
  });
  const selectedOrganizationTeam =
    organizationTeams.data?.items.find((team) => team.slug === selectedOrganizationTeamSlug) ??
    organizationTeams.data?.items[0] ??
    null;
  const selectedOrganizationTeamLimitKey =
    selectedOrganization && selectedOrganizationTeam
      ? `${selectedOrganization.login}/${selectedOrganizationTeam.slug}`
      : null;
  const organizationTeamRepositoryLimit = selectedOrganizationTeamLimitKey
    ? (organizationTeamRepositoryLimits[selectedOrganizationTeamLimitKey] ??
      defaultOrganizationTeamRepositoryLimit)
    : defaultOrganizationTeamRepositoryLimit;
  const organizationTeamMemberLimit = selectedOrganizationTeamLimitKey
    ? (organizationTeamMemberLimits[selectedOrganizationTeamLimitKey] ?? defaultOrganizationTeamMemberLimit)
    : defaultOrganizationTeamMemberLimit;
  const organizationTeamRepositories = useQuery<OrganizationTeamRepositoriesResult>({
    queryKey: organizationTeamRepositoriesQueryKey(
      selectedOrganization?.login ?? "none",
      selectedOrganizationTeam?.slug ?? "none",
      organizationTeamRepositoryLimit
    ),
    queryFn: () =>
      api.github.listOrganizationTeamRepositoriesWithStatus({
        org: selectedOrganization!.login,
        teamSlug: selectedOrganizationTeam!.slug,
        limit: organizationTeamRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(selectedOrganization) && Boolean(selectedOrganizationTeam),
    staleTime: 120_000
  });
  const organizationTeamMembers = useQuery<OrganizationTeamMembersResult>({
    queryKey: organizationTeamMembersQueryKey(
      selectedOrganization?.login ?? "none",
      selectedOrganizationTeam?.slug ?? "none",
      organizationTeamMemberLimit
    ),
    queryFn: () =>
      api.github.listOrganizationTeamMembersWithStatus({
        org: selectedOrganization!.login,
        teamSlug: selectedOrganizationTeam!.slug,
        limit: organizationTeamMemberLimit,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(selectedOrganization) && Boolean(selectedOrganizationTeam),
    staleTime: 120_000
  });
  const organizationProjects = useQuery<ProjectListResult>({
    queryKey: organizationProjectsQueryKey(selectedOrganization?.login ?? "none", organizationProjectLimit),
    queryFn: () =>
      api.github.listOrganizationProjectsWithStatus({
        org: selectedOrganization!.login,
        limit: organizationProjectLimit,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(selectedOrganization),
    staleTime: 120_000
  });

  return {
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
  };
}

export interface OrganizationsRouteRefreshInput {
  api: ControlApi;
  githubReady: boolean;
  organizationListLimit: number;
  selectedOrganizationLogin: string | null;
  organizationRepositoryLimit: number;
  organizationTeamLimit: number;
  organizationMemberLimit: number;
  organizationProjectLimit: number;
  selectedOrganizationTeamSlug: string | null;
  organizationTeamRepositoryLimit: number;
  organizationTeamMemberLimit: number;
}

export async function refreshOrganizationsRouteData(
  queryClient: QueryClient,
  {
    api,
    githubReady,
    organizationListLimit,
    selectedOrganizationLogin,
    organizationRepositoryLimit,
    organizationTeamLimit,
    organizationMemberLimit,
    organizationProjectLimit,
    selectedOrganizationTeamSlug,
    organizationTeamRepositoryLimit,
    organizationTeamMemberLimit
  }: OrganizationsRouteRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const refreshes: Array<Promise<unknown>> = [
    queryClient.fetchQuery({
      queryKey: organizationsQueryKey(organizationListLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listOrganizationsWithStatus({
          limit: organizationListLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    })
  ];

  if (selectedOrganizationLogin) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: organizationTeamsQueryKey(selectedOrganizationLogin, organizationTeamLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listOrganizationTeamsWithStatus({
            org: selectedOrganizationLogin,
            limit: organizationTeamLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: organizationRepositoriesQueryKey(selectedOrganizationLogin, organizationRepositoryLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listOrganizationRepositoriesWithStatus({
            org: selectedOrganizationLogin,
            limit: organizationRepositoryLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: organizationMembersQueryKey(selectedOrganizationLogin, organizationMemberLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listOrganizationMembersWithStatus({
            org: selectedOrganizationLogin,
            limit: organizationMemberLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: organizationProjectsQueryKey(selectedOrganizationLogin, organizationProjectLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listOrganizationProjectsWithStatus({
            org: selectedOrganizationLogin,
            limit: organizationProjectLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );

    if (selectedOrganizationTeamSlug) {
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: organizationTeamRepositoriesQueryKey(
            selectedOrganizationLogin,
            selectedOrganizationTeamSlug,
            organizationTeamRepositoryLimit
          ),
          staleTime: 0,
          queryFn: () =>
            api.github.listOrganizationTeamRepositoriesWithStatus({
              org: selectedOrganizationLogin,
              teamSlug: selectedOrganizationTeamSlug,
              limit: organizationTeamRepositoryLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: organizationTeamMembersQueryKey(
            selectedOrganizationLogin,
            selectedOrganizationTeamSlug,
            organizationTeamMemberLimit
          ),
          staleTime: 0,
          queryFn: () =>
            api.github.listOrganizationTeamMembersWithStatus({
              org: selectedOrganizationLogin,
              teamSlug: selectedOrganizationTeamSlug,
              limit: organizationTeamMemberLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );
    }
  }

  try {
    await Promise.all(refreshes);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
