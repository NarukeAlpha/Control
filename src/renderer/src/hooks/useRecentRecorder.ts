import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { LocalRecentItem, LocalRecentRecordInput } from "@shared/local";
import { useControlApi } from "./useControlApi";
import { recentItemsQueryKey } from "./useRecentItems";

export function useRecentRecorder(limit: number): {
  recordRecent(input: LocalRecentRecordInput): void;
} {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const activeRecentItemsQueryKey = recentItemsQueryKey(limit);

  const recentMutation = useMutation({
    mutationFn: api.recordRecentItem,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["local-recents"] });
      const previousItems = queryClient.getQueryData<LocalRecentItem[]>(activeRecentItemsQueryKey) ?? [];
      const optimisticItem: LocalRecentItem = {
        kind: input.kind,
        provider: input.provider ?? "github",
        itemKey: input.itemKey,
        title: input.title,
        subtitle: input.subtitle ?? null,
        repositoryNameWithOwner: input.repositoryNameWithOwner ?? null,
        areaId: input.areaId ?? null,
        repositoryId: input.repositoryId ?? null,
        workspaceId: input.workspaceId ?? null,
        url: input.url ?? null,
        metadata: input.metadata ?? {},
        updatedAt: new Date().toISOString()
      };
      queryClient.setQueryData(
        activeRecentItemsQueryKey,
        [
          optimisticItem,
          ...previousItems.filter((item) => item.kind !== input.kind || item.itemKey !== input.itemKey)
        ].slice(0, limit)
      );
      return { previousItems };
    },
    onError: (_error, _input, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(activeRecentItemsQueryKey, context.previousItems);
      }
    },
    onSuccess: (items) => {
      queryClient.setQueryData(activeRecentItemsQueryKey, items.slice(0, limit));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["local-recents"] });
    }
  });

  return {
    recordRecent: recentMutation.mutate
  };
}
