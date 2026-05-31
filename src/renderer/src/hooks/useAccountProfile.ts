import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "./useControlApi";

export function accountProfileQueryKey(): readonly ["account-profile"] {
  return ["account-profile"] as const;
}

export function useAccountProfile({ enabled, githubReady }: { enabled: boolean; githubReady: boolean }) {
  const api = useControlApi();

  return useQuery({
    queryKey: accountProfileQueryKey(),
    queryFn: () => api.github.getAccountProfileWithStatus({ cacheOnly: !githubReady }),
    enabled
  });
}

export async function refreshAccountProfileData(
  queryClient: QueryClient,
  { api, githubReady }: { api: ControlApi; githubReady: boolean }
): Promise<void> {
  const cachedRead = !githubReady;

  await queryClient.fetchQuery({
    queryKey: accountProfileQueryKey(),
    staleTime: 0,
    queryFn: () =>
      api.github.getAccountProfileWithStatus({
        cacheOnly: cachedRead,
        forceRefresh: !cachedRead
      })
  });
}
