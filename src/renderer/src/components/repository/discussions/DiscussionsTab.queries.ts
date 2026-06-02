import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { DiscussionListResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "@renderer/hooks/useControlApi";

export interface DiscussionsTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface DiscussionsTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export type DiscussionsTabRefreshInput = DiscussionsTabPrefetchInput;

export function discussionsTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["discussions", string, string, number] {
  return ["discussions", owner, repo, limit] as const;
}

export function useDiscussionsTabQueries({
  owner,
  repo,
  limit,
  enabled,
  githubReady
}: DiscussionsTabQueryInput) {
  const api = useControlApi();

  const discussions = useQuery<DiscussionListResult>({
    queryKey: discussionsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listDiscussionsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 60_000
  });

  return { discussions };
}

export async function prefetchDiscussionsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: DiscussionsTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: discussionsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listDiscussionsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    staleTime: 60_000
  });
}

export async function refreshDiscussionsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: DiscussionsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;

  try {
    await queryClient.fetchQuery({
      queryKey: discussionsTabQueryKey(owner, repo, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listDiscussionsWithStatus({
          owner,
          repo,
          limit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    });
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
