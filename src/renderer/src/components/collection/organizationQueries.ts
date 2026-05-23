import type { QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

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
