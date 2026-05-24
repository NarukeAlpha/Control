import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "./useControlApi";

export function repositoryDetailQueryKey(
  owner: string,
  repo: string
): readonly ["repository", string, string] {
  return ["repository", owner, repo] as const;
}

export function useRepositoryDetail({
  owner,
  repo,
  enabled,
  githubReady
}: {
  owner: string;
  repo: string;
  enabled: boolean;
  githubReady: boolean;
}) {
  const api = useControlApi();

  return useQuery({
    queryKey: repositoryDetailQueryKey(owner, repo),
    queryFn: () => api.github.getRepositoryWithStatus({ owner, repo, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });
}

export async function refreshRepositoryDetailData(
  queryClient: QueryClient,
  { api, owner, repo, githubReady }: { api: ControlApi; owner: string; repo: string; githubReady: boolean }
): Promise<void> {
  await queryClient.fetchQuery({
    queryKey: repositoryDetailQueryKey(owner, repo),
    staleTime: 0,
    queryFn: () =>
      api.github.getRepositoryWithStatus({
        owner,
        repo,
        cacheOnly: !githubReady,
        forceRefresh: githubReady
      })
  });
}
