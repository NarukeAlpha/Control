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
  const selectedOrganizationKey = selectedOrganizationLogin ?? selectedOrganization?.login ?? null;
  const organizationQueriesEnabled = enabled && selectedOrganizationKey !== null;
  const organizationQueryKeyLogin = selectedOrganizationKey ?? "none";
  const organizationRepositoryLimit = selectedOrganizationKey
    ? (organizationRepositoryLimits[selectedOrganizationKey] ?? defaultOrganizationRepositoryLimit)
    : defaultOrganizationRepositoryLimit;
  const organizationTeamLimit = selectedOrganizationKey
    ? (organizationTeamLimits[selectedOrganizationKey] ?? defaultOrganizationTeamLimit)
    : defaultOrganizationTeamLimit;
  const organizationMemberLimit = selectedOrganizationKey
    ? (organizationMemberLimits[selectedOrganizationKey] ?? defaultOrganizationMemberLimit)
    : defaultOrganizationMemberLimit;
  const organizationProjectLimit = selectedOrganizationKey
    ? (organizationProjectLimits[selectedOrganizationKey] ?? defaultOrganizationProjectLimit)
    : defaultOrganizationProjectLimit;
  const organizationTeams = useQuery<
    OrganizationTeamsResult,
    Error,
    OrganizationTeamsResult,
    ReturnType<typeof organizationTeamsQueryKey>
  >({
    queryKey: organizationTeamsQueryKey(organizationQueryKeyLogin, organizationTeamLimit),
    queryFn: ({ queryKey: [, org, limit] }) =>
      api.github.listOrganizationTeamsWithStatus({
        org,
        limit,
        cacheOnly: !githubReady
      }),
    enabled: organizationQueriesEnabled,
    staleTime: 120_000
  });
  const organizationRepositories = useQuery<
    OrganizationRepositoriesResult,
    Error,
    OrganizationRepositoriesResult,
    ReturnType<typeof organizationRepositoriesQueryKey>
  >({
    queryKey: organizationRepositoriesQueryKey(organizationQueryKeyLogin, organizationRepositoryLimit),
    queryFn: ({ queryKey: [, org, limit] }) =>
      api.github.listOrganizationRepositoriesWithStatus({
        org,
        limit,
        cacheOnly: !githubReady
      }),
    enabled: organizationQueriesEnabled,
    staleTime: 120_000
  });
  const organizationMembers = useQuery<
    OrganizationMembersResult,
    Error,
    OrganizationMembersResult,
    ReturnType<typeof organizationMembersQueryKey>
  >({
    queryKey: organizationMembersQueryKey(organizationQueryKeyLogin, organizationMemberLimit),
    queryFn: ({ queryKey: [, org, limit] }) =>
      api.github.listOrganizationMembersWithStatus({
        org,
        limit,
        cacheOnly: !githubReady
      }),
    enabled: organizationQueriesEnabled,
    staleTime: 120_000
  });
  const selectedOrganizationTeam =
    organizationTeams.data?.items.find((team) => team.slug === selectedOrganizationTeamSlug) ??
    organizationTeams.data?.items[0] ??
    null;
  const selectedOrganizationTeamKey = selectedOrganizationTeamSlug ?? selectedOrganizationTeam?.slug ?? null;
  const teamQueriesEnabled = organizationQueriesEnabled && selectedOrganizationTeamKey !== null;
  const selectedOrganizationTeamLimitKey =
    selectedOrganizationKey && selectedOrganizationTeamKey
      ? `${selectedOrganizationKey}/${selectedOrganizationTeamKey}`
      : null;
  const organizationTeamRepositoryLimit = selectedOrganizationTeamLimitKey
    ? (organizationTeamRepositoryLimits[selectedOrganizationTeamLimitKey] ??
      defaultOrganizationTeamRepositoryLimit)
    : defaultOrganizationTeamRepositoryLimit;
  const organizationTeamMemberLimit = selectedOrganizationTeamLimitKey
    ? (organizationTeamMemberLimits[selectedOrganizationTeamLimitKey] ?? defaultOrganizationTeamMemberLimit)
    : defaultOrganizationTeamMemberLimit;
  const organizationTeamQueryKeySlug = selectedOrganizationTeamKey ?? "none";
  const organizationTeamRepositories = useQuery<
    OrganizationTeamRepositoriesResult,
    Error,
    OrganizationTeamRepositoriesResult,
    ReturnType<typeof organizationTeamRepositoriesQueryKey>
  >({
    queryKey: organizationTeamRepositoriesQueryKey(
      organizationQueryKeyLogin,
      organizationTeamQueryKeySlug,
      organizationTeamRepositoryLimit
    ),
    queryFn: ({ queryKey: [, org, teamSlug, limit] }) =>
      api.github.listOrganizationTeamRepositoriesWithStatus({
        org,
        teamSlug,
        limit,
        cacheOnly: !githubReady
      }),
    enabled: teamQueriesEnabled,
    staleTime: 120_000
  });
  const organizationTeamMembers = useQuery<
    OrganizationTeamMembersResult,
    Error,
    OrganizationTeamMembersResult,
    ReturnType<typeof organizationTeamMembersQueryKey>
  >({
    queryKey: organizationTeamMembersQueryKey(
      organizationQueryKeyLogin,
      organizationTeamQueryKeySlug,
      organizationTeamMemberLimit
    ),
    queryFn: ({ queryKey: [, org, teamSlug, limit] }) =>
      api.github.listOrganizationTeamMembersWithStatus({
        org,
        teamSlug,
        limit,
        cacheOnly: !githubReady
      }),
    enabled: teamQueriesEnabled,
    staleTime: 120_000
  });
  const organizationProjects = useQuery<
    ProjectListResult,
    Error,
    ProjectListResult,
    ReturnType<typeof organizationProjectsQueryKey>
  >({
    queryKey: organizationProjectsQueryKey(organizationQueryKeyLogin, organizationProjectLimit),
    queryFn: ({ queryKey: [, org, limit] }) =>
      api.github.listOrganizationProjectsWithStatus({
        org,
        limit,
        cacheOnly: !githubReady
      }),
    enabled: organizationQueriesEnabled,
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
