import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ProjectListResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "@renderer/hooks/useControlApi";

export interface ProjectsTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface ProjectsTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export type ProjectsTabRefreshInput = ProjectsTabPrefetchInput;

export function projectsTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["projects", string, string, number] {
  return ["projects", owner, repo, limit] as const;
}

export function useProjectsTabQueries({ owner, repo, limit, enabled, githubReady }: ProjectsTabQueryInput) {
  const api = useControlApi();

  const projects = useQuery<ProjectListResult>({
    queryKey: projectsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listProjectsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 60_000
  });

  return { projects };
}

export async function prefetchProjectsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ProjectsTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: projectsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listProjectsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    staleTime: 60_000
  });
}

export async function refreshProjectsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ProjectsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;

  try {
    await queryClient.fetchQuery({
      queryKey: projectsTabQueryKey(owner, repo, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listProjectsWithStatus({
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
