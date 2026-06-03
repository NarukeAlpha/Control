import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { WorkflowRunListResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "@renderer/hooks/useControlApi";
import { refreshRepositoryRefsData } from "@renderer/hooks/useRepositoryRefs";

export interface ActionsTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface ActionsTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export interface ActionsTabRefreshInput extends ActionsTabPrefetchInput {
  selectedRef: string | null;
  defaultBranch?: string | null;
  refListLimit: number;
  workflowDefinitionLimit: number;
  focusedWorkflowRunId: number | null;
}

export function actionsTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["actions", string, string, number] {
  return ["actions", owner, repo, limit] as const;
}

export function workflowDefinitionsQueryKey(
  owner: string,
  repo: string,
  ref: string | null | undefined,
  limit: number
): readonly ["workflows", string, string, string, number] {
  return ["workflows", owner, repo, ref || "default", limit] as const;
}

export function workflowRunDetailQueryKey(
  owner: string,
  repo: string,
  runId: number | null
): readonly ["action-detail", string, string, number | "none"] {
  return ["action-detail", owner, repo, runId ?? "none"] as const;
}

export function useActionsTabQueries({ owner, repo, limit, enabled, githubReady }: ActionsTabQueryInput) {
  const api = useControlApi();

  const actions = useQuery<WorkflowRunListResult>({
    queryKey: actionsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listActionsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 60_000
  });

  return { actions };
}

export async function prefetchActionsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ActionsTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: actionsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listActionsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    staleTime: 60_000
  });
}

export async function refreshActionsTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    limit,
    selectedRef,
    defaultBranch,
    refListLimit,
    workflowDefinitionLimit,
    focusedWorkflowRunId,
    githubReady
  }: ActionsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const ref = selectedRef ?? defaultBranch ?? undefined;
  const refreshes: Array<Promise<unknown>> = [
    queryClient.fetchQuery({
      queryKey: actionsTabQueryKey(owner, repo, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listActionsWithStatus({
          owner,
          repo,
          limit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    refreshRepositoryRefsData(queryClient, { api, owner, repo, limit: refListLimit, githubReady }),
    queryClient.fetchQuery({
      queryKey: workflowDefinitionsQueryKey(owner, repo, ref, workflowDefinitionLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listWorkflowsWithStatus({
          owner,
          repo,
          ref: ref ?? null,
          limit: workflowDefinitionLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    })
  ];

  if (focusedWorkflowRunId !== null) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: workflowRunDetailQueryKey(owner, repo, focusedWorkflowRunId),
        staleTime: 0,
        queryFn: () =>
          api.github.getWorkflowRunDetailWithStatus({
            owner,
            repo,
            runId: focusedWorkflowRunId,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );
  }

  try {
    await Promise.all(refreshes);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
