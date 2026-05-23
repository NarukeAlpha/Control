import { useQuery } from "@tanstack/react-query";

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
