import { useQuery } from "@tanstack/react-query";

import { readAvailabilityMessage } from "@renderer/components/repository/repositoryUi";

import { useControlApi } from "./useControlApi";

export function repositoryBranchesQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["branches", string, string, number] {
  return ["branches", owner, repo, limit] as const;
}

export function repositoryTagsQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["tags", string, string, number] {
  return ["tags", owner, repo, limit] as const;
}

export function useRepositoryRefs(
  owner: string,
  repo: string,
  enabled: boolean | { branches: boolean; tags: boolean },
  limit: number,
  {
    githubReady
  }: {
    githubReady: boolean;
  }
) {
  const api = useControlApi();
  const branchesEnabled = typeof enabled === "boolean" ? enabled : enabled.branches;
  const tagsEnabled = typeof enabled === "boolean" ? enabled : enabled.tags;

  const branches = useQuery({
    queryKey: repositoryBranchesQueryKey(owner, repo, limit),
    queryFn: () =>
      api.github.listBranchesWithStatus({
        owner,
        repo,
        limit,
        cacheOnly: !githubReady
      }),
    enabled: branchesEnabled,
    staleTime: 120_000
  });

  const tags = useQuery({
    queryKey: repositoryTagsQueryKey(owner, repo, limit),
    queryFn: () => api.github.listTagsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled: tagsEnabled,
    staleTime: 120_000
  });

  const branchesAvailability = branches.data?.availability ?? null;
  const tagsAvailability = tags.data?.availability ?? null;
  const availabilityMessage = [
    readAvailabilityMessage("Branches", branchesAvailability),
    readAvailabilityMessage("Tags", tagsAvailability)
  ]
    .filter((message): message is string => Boolean(message))
    .join(" ");

  return {
    branches,
    tags,
    branchItems: branches.data?.items ?? [],
    tagItems: tags.data?.items ?? [],
    branchesAvailability,
    tagsAvailability,
    availabilityMessage,
    error: branches.error ?? tags.error
  };
}
