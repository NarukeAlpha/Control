import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ReleaseDetailResult, ReleaseListResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "@renderer/hooks/useControlApi";
import { refreshRepositoryRefsData } from "@renderer/hooks/useRepositoryRefs";

export interface ReleasesTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
  focusedReleaseId?: number | null;
  focusedReleaseTagName?: string | null;
}

export interface ReleasesTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export interface ReleasesTabRefreshInput extends ReleasesTabPrefetchInput {
  refListLimit: number;
}

export function releasesTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["releases", string, string, number] {
  return ["releases", owner, repo, limit] as const;
}

function releaseDetailQueryKey(
  owner: string,
  repo: string,
  releaseId: number | null,
  releaseTagName: string | null
): readonly ["release-detail", string, string, number | null, string | null] {
  return ["release-detail", owner, repo, releaseId, releaseTagName] as const;
}

export function useReleasesTabQueries({
  owner,
  repo,
  limit,
  enabled,
  githubReady,
  focusedReleaseId = null,
  focusedReleaseTagName = null
}: ReleasesTabQueryInput) {
  const api = useControlApi();
  const hasFocusedRelease = focusedReleaseId !== null || Boolean(focusedReleaseTagName);

  const releases = useQuery<ReleaseListResult>({
    queryKey: releasesTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listReleasesWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  const releaseDetail = useQuery<ReleaseDetailResult>({
    queryKey: releaseDetailQueryKey(owner, repo, focusedReleaseId, focusedReleaseTagName),
    queryFn: () =>
      api.github.getReleaseDetailWithStatus({
        owner,
        repo,
        releaseId: focusedReleaseId ?? undefined,
        releaseTagName: focusedReleaseTagName ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled: enabled && hasFocusedRelease,
    staleTime: 120_000
  });

  return { releases, releaseDetail };
}

export async function prefetchReleasesTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ReleasesTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: releasesTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listReleasesWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    staleTime: 120_000
  });
}

export async function refreshReleasesTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, refListLimit, githubReady }: ReleasesTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;

  try {
    await Promise.all([
      queryClient.fetchQuery({
        queryKey: releasesTabQueryKey(owner, repo, limit),
        staleTime: 0,
        queryFn: () =>
          api.github.listReleasesWithStatus({
            owner,
            repo,
            limit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      refreshRepositoryRefsData(queryClient, { api, owner, repo, limit: refListLimit, githubReady })
    ]);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
