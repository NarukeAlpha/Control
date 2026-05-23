import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "./useControlApi";

const repositoryDirectoryStaleTimeMs = 600_000;

export function repositoryDirectoryQueryKey(limit: number): readonly ["repositories", number] {
  return ["repositories", limit] as const;
}

export function useRepositoryDirectory(
  limit: number,
  {
    enabled,
    githubReady
  }: {
    enabled: boolean;
    githubReady: boolean;
  }
) {
  const api = useControlApi();

  return useQuery({
    queryKey: repositoryDirectoryQueryKey(limit),
    queryFn: () => api.github.listRepositoriesWithStatus({ limit, cacheOnly: !githubReady }),
    enabled,
    placeholderData: (previousData) => previousData,
    staleTime: repositoryDirectoryStaleTimeMs
  });
}

export async function refreshRepositoryDirectoryData(
  queryClient: QueryClient,
  { api, limit, githubReady }: { api: ControlApi; limit: number; githubReady: boolean }
): Promise<void> {
  const cachedRead = !githubReady;

  await queryClient.fetchQuery({
    queryKey: repositoryDirectoryQueryKey(limit),
    staleTime: 0,
    queryFn: () =>
      api.github.listRepositoriesWithStatus({
        limit,
        cacheOnly: cachedRead,
        forceRefresh: !cachedRead
      })
  });
}
