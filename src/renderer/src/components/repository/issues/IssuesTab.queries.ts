import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { IssueDetailResult, IssueListResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { issueDetailQueryKey } from "@renderer/components/repository/issues/useIssueDetail";
import { useControlApi } from "@renderer/hooks/useControlApi";
import {
  repositoryAssignableUsersQueryKey,
  repositoryLabelsQueryKey,
  repositoryMilestonesQueryKey,
  refreshRepositoryIssueResources,
  useRepositoryIssueResources
} from "@renderer/hooks/useRepositoryIssueResources";

export interface IssuesTabQueryInput {
  owner: string;
  repo: string;
  issueListLimit: number;
  issuesEnabled: boolean;
  resourcesEnabled: boolean;
  githubReady: boolean;
}

export interface IssuesTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  issueListLimit: number;
  githubReady: boolean;
}

export interface IssuesTabRefreshInput extends IssuesTabPrefetchInput {
  focusedIssueNumber: number | null;
}

export function issuesTabQueryKey(
  owner: string,
  repo: string,
  issueListLimit: number
): readonly ["issues", string, string, number] {
  return ["issues", owner, repo, issueListLimit] as const;
}

export function useIssuesTabQueries({
  owner,
  repo,
  issueListLimit,
  issuesEnabled,
  resourcesEnabled,
  githubReady
}: IssuesTabQueryInput) {
  const api = useControlApi();
  const issues = useQuery<IssueListResult>({
    queryKey: issuesTabQueryKey(owner, repo, issueListLimit),
    queryFn: () =>
      api.github.listIssuesWithStatus({
        owner,
        repo,
        state: "all",
        limit: issueListLimit,
        cacheOnly: !githubReady
      }),
    enabled: issuesEnabled,
    staleTime: 60_000
  });
  const resources = useRepositoryIssueResources(owner, repo, resourcesEnabled, { githubReady });

  return { issues, ...resources };
}

export async function prefetchIssuesTabData(
  queryClient: QueryClient,
  { api, owner, repo, issueListLimit, githubReady }: IssuesTabPrefetchInput
): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: issuesTabQueryKey(owner, repo, issueListLimit),
      queryFn: () =>
        api.github.listIssuesWithStatus({
          owner,
          repo,
          state: "all",
          limit: issueListLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryLabelsQueryKey(owner, repo),
      queryFn: () => api.github.listLabelsWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryAssignableUsersQueryKey(owner, repo),
      queryFn: () =>
        api.github.listAssignableUsersWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryMilestonesQueryKey(owner, repo),
      queryFn: () =>
        api.github.listMilestonesWithStatus({
          owner,
          repo,
          state: "all",
          limit: 100,
          cacheOnly: !githubReady
        }),
      staleTime: 120_000
    })
  ]);
}

export async function refreshIssuesTabData(
  queryClient: QueryClient,
  { api, owner, repo, issueListLimit, focusedIssueNumber, githubReady }: IssuesTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const refreshes: Array<Promise<unknown>> = [
    queryClient.fetchQuery({
      queryKey: issuesTabQueryKey(owner, repo, issueListLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listIssuesWithStatus({
          owner,
          repo,
          state: "all",
          limit: issueListLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    refreshRepositoryIssueResources(queryClient, { api, owner, repo, githubReady })
  ];

  if (focusedIssueNumber !== null) {
    refreshes.push(
      queryClient.fetchQuery<IssueDetailResult>({
        queryKey: issueDetailQueryKey(owner, repo, focusedIssueNumber),
        staleTime: 0,
        queryFn: () =>
          api.github.getIssueDetailWithStatus({
            owner,
            repo,
            issueNumber: focusedIssueNumber,
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
