import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "./useControlApi";

export function accountContributionsQueryKey(
  login: string | null | undefined,
  limit: number
): readonly ["account-contributions", string, number] {
  return ["account-contributions", login ?? "viewer", limit] as const;
}

export function useAccountContributions(
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

  return useQuery({
    queryKey: accountContributionsQueryKey(login, limit),
    queryFn: () =>
      api.github.listAccountContributionsWithStatus({
        ...(login ? { login } : {}),
        limit,
        cacheOnly: !githubReady
      }),
    enabled,
    placeholderData: (previousData) => previousData
  });
}

export async function refreshAccountContributionsData(
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

  await queryClient.fetchQuery({
    queryKey: accountContributionsQueryKey(login, limit),
    staleTime: 0,
    queryFn: () =>
      api.github.listAccountContributionsWithStatus({
        ...(login ? { login } : {}),
        limit,
        cacheOnly: cachedRead,
        forceRefresh: !cachedRead
      })
  });
}
