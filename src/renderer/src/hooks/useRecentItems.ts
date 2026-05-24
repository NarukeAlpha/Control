import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "./useControlApi";

export function recentItemsQueryKey(limit: number): readonly ["local-recents", number] {
  return ["local-recents", limit] as const;
}

export function useRecentItems(limit: number, { enabled }: { enabled: boolean }) {
  const api = useControlApi();

  return useQuery({
    queryKey: recentItemsQueryKey(limit),
    queryFn: () => api.listRecentItems({ limit }),
    enabled,
    staleTime: 30_000
  });
}

export async function refreshRecentItemsData(
  queryClient: QueryClient,
  { api, limit }: { api: ControlApi; limit: number }
): Promise<void> {
  await queryClient.fetchQuery({
    queryKey: recentItemsQueryKey(limit),
    staleTime: 0,
    queryFn: () => api.listRecentItems({ limit })
  });
}
