import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "./useControlApi";

export function accountIssuesQueryKey(
  login: string | null | undefined,
  limit: number
): readonly ["account-issues", string, number] {
  return ["account-issues", login ?? "viewer", limit] as const;
}

export function accountPullsQueryKey(
  login: string | null | undefined,
  limit: number
): readonly ["account-pulls", string, number] {
  return ["account-pulls", login ?? "viewer", limit] as const;
}

export function useAccountWork(
  login: string | null | undefined,
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

  const issues = useQuery({
    queryKey: accountIssuesQueryKey(login, limit),
    queryFn: () =>
      api.github.listAccountIssuesWithStatus({
        ...(login ? { login } : {}),
        state: "open",
        limit,
        cacheOnly: !githubReady
      }),
    enabled,
    placeholderData: (previousData) => previousData
  });

  const pulls = useQuery({
    queryKey: accountPullsQueryKey(login, limit),
    queryFn: () =>
      api.github.listAccountPullRequestsWithStatus({
        ...(login ? { login } : {}),
        state: "open",
        limit,
        cacheOnly: !githubReady
      }),
    enabled,
    placeholderData: (previousData) => previousData
  });

  return { issues, pulls };
}

export async function refreshAccountWorkData(
  queryClient: QueryClient,
  {
    api,
    login,
    limit,
    githubReady
  }: {
    api: ControlApi;
    login: string | null | undefined;
    limit: number;
    githubReady: boolean;
  }
): Promise<void> {
  const cachedRead = !githubReady;

  await Promise.all([
    queryClient.fetchQuery({
      queryKey: accountIssuesQueryKey(login, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listAccountIssuesWithStatus({
          ...(login ? { login } : {}),
          state: "open",
          limit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: accountPullsQueryKey(login, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listAccountPullRequestsWithStatus({
          ...(login ? { login } : {}),
          state: "open",
          limit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    })
  ]);
}
