import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

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

export interface RepositoryRefsRefreshInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
  include?: {
    branches?: boolean;
    tags?: boolean;
  };
}

export async function refreshRepositoryRefsData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady, include }: RepositoryRefsRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const refreshBranches = include?.branches ?? true;
  const refreshTags = include?.tags ?? true;
  const refreshes: Array<Promise<unknown>> = [];

  if (refreshBranches) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: repositoryBranchesQueryKey(owner, repo, limit),
        staleTime: 0,
        queryFn: () =>
          api.github.listBranchesWithStatus({
            owner,
            repo,
            limit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );
  }

  if (refreshTags) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: repositoryTagsQueryKey(owner, repo, limit),
        staleTime: 0,
        queryFn: () =>
          api.github.listTagsWithStatus({
            owner,
            repo,
            limit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );
  }

  await Promise.all(refreshes);
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
