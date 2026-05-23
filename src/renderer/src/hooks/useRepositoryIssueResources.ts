import { useQuery } from "@tanstack/react-query";

import { useControlApi } from "./useControlApi";

export function repositoryLabelsQueryKey(owner: string, repo: string): readonly ["labels", string, string] {
  return ["labels", owner, repo] as const;
}

export function repositoryAssignableUsersQueryKey(
  owner: string,
  repo: string
): readonly ["assignable-users", string, string] {
  return ["assignable-users", owner, repo] as const;
}

export function repositoryMilestonesQueryKey(
  owner: string,
  repo: string
): readonly ["milestones", string, string] {
  return ["milestones", owner, repo] as const;
}

export function useRepositoryIssueResources(
  owner: string,
  repo: string,
  enabled: boolean,
  {
    githubReady
  }: {
    githubReady: boolean;
  }
) {
  const api = useControlApi();

  const labels = useQuery({
    queryKey: repositoryLabelsQueryKey(owner, repo),
    queryFn: () => api.github.listLabelsWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  const assignableUsers = useQuery({
    queryKey: repositoryAssignableUsersQueryKey(owner, repo),
    queryFn: () =>
      api.github.listAssignableUsersWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  const milestones = useQuery({
    queryKey: repositoryMilestonesQueryKey(owner, repo),
    queryFn: () =>
      api.github.listMilestonesWithStatus({ owner, repo, state: "all", limit: 100, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  return {
    labels,
    assignableUsers,
    milestones,
    labelItems: labels.data?.items ?? [],
    labelAvailability: labels.data?.availability ?? null,
    assignableUserItems: assignableUsers.data?.items ?? [],
    assignableUsersAvailability: assignableUsers.data?.availability ?? null,
    milestoneItems: milestones.data?.items ?? [],
    milestonesAvailability: milestones.data?.availability ?? null
  };
}
