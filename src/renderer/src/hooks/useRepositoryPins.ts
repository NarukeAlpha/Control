import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AreaRepositorySummary } from "@shared/areas";
import type { RepositoryPinInput, RepositoryPinRecord } from "@shared/local";
import { areaRepositoryPinKey } from "../components/areas/areaUi";
import { useControlApi } from "./useControlApi";

const defaultGitHubAreaId = "github:default";
const repositoryPinsQueryKey = ["repository-pins"] as const;

function defaultGitHubAreaRepositoryId(nameWithOwner: string): string {
  return `github:default:${nameWithOwner.toLowerCase()}`;
}

function isDefaultGitHubRepositoryPin(
  pin: RepositoryPinRecord
): pin is RepositoryPinRecord & { nameWithOwner: string } {
  return pin.areaId === defaultGitHubAreaId && typeof pin.nameWithOwner === "string";
}

export function useRepositoryPins({ appReady = true }: { appReady?: boolean } = {}): {
  repositoryPinRecords: RepositoryPinRecord[];
  pinnedRepositoryNames: string[];
  isRepositoryPinned(nameWithOwner: string): boolean;
  isAreaRepositoryPinned(
    areaId: string | null,
    repositoryId: string | null,
    workspaceId?: string | null
  ): boolean;
  repositoryPinBusy: boolean;
  repositoryPinError: Error | null;
  toggleRepositoryPin(nameWithOwner: string): void;
  toggleAreaRepositoryPin(repository: AreaRepositorySummary, workspaceId?: string | null): void;
} {
  const api = useControlApi();
  const queryClient = useQueryClient();

  const repositoryPins = useQuery({
    queryKey: repositoryPinsQueryKey,
    queryFn: () => api.listRepositoryPins(),
    enabled: appReady,
    staleTime: Infinity
  });
  const repositoryPinRecords = useMemo(() => repositoryPins.data ?? [], [repositoryPins.data]);
  const pinnedRepositoryNames = useMemo(
    () => repositoryPinRecords.filter(isDefaultGitHubRepositoryPin).map((pin) => pin.nameWithOwner),
    [repositoryPinRecords]
  );
  const pinnedRepositoryNameSet = useMemo(
    () => new Set(pinnedRepositoryNames.map((name) => name.toLowerCase())),
    [pinnedRepositoryNames]
  );
  const areaRepositoryPinSet = useMemo(
    () =>
      new Set(
        repositoryPinRecords.map((pin) =>
          areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId ?? null)
        )
      ),
    [repositoryPinRecords]
  );

  const areaPinMutation = useMutation({
    mutationFn: ({ pinned: _pinned, ...input }: RepositoryPinInput & { pinned: boolean }) =>
      _pinned ? api.unpinAreaRepository(input) : api.pinAreaRepository(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: repositoryPinsQueryKey });
      const previousPins = queryClient.getQueryData<RepositoryPinRecord[]>(repositoryPinsQueryKey) ?? [];
      const targetKey = areaRepositoryPinKey(input.areaId, input.repositoryId, input.workspaceId ?? null);
      const remainingPins = previousPins.filter(
        (pin) => areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId ?? null) !== targetKey
      );
      const nextPins = input.pinned
        ? remainingPins
        : [
            {
              areaId: input.areaId ?? null,
              repositoryId: input.repositoryId ?? null,
              workspaceId: input.workspaceId ?? null,
              nameWithOwner: input.nameWithOwner ?? null,
              createdAt: new Date().toISOString()
            },
            ...remainingPins
          ];
      queryClient.setQueryData(repositoryPinsQueryKey, nextPins);
      return { previousPins };
    },
    onError: (_error, _input, context) => {
      if (context?.previousPins) {
        queryClient.setQueryData(repositoryPinsQueryKey, context.previousPins);
      }
    },
    onSuccess: (pins) => {
      queryClient.setQueryData(repositoryPinsQueryKey, pins);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: repositoryPinsQueryKey });
    }
  });

  const isRepositoryPinned = useCallback(
    (nameWithOwner: string): boolean => pinnedRepositoryNameSet.has(nameWithOwner.toLowerCase()),
    [pinnedRepositoryNameSet]
  );

  const isAreaRepositoryPinned = useCallback(
    (areaId: string | null, repositoryId: string | null, workspaceId: string | null = null): boolean =>
      areaRepositoryPinSet.has(areaRepositoryPinKey(areaId, repositoryId, workspaceId)),
    [areaRepositoryPinSet]
  );

  const toggleRepositoryPin = useCallback(
    (nameWithOwner: string): void => {
      areaPinMutation.mutate({
        areaId: defaultGitHubAreaId,
        repositoryId: defaultGitHubAreaRepositoryId(nameWithOwner),
        workspaceId: null,
        nameWithOwner,
        pinned: isRepositoryPinned(nameWithOwner)
      });
    },
    [areaPinMutation, isRepositoryPinned]
  );

  const toggleAreaRepositoryPin = useCallback(
    (repository: AreaRepositorySummary, workspaceId: string | null = null): void => {
      areaPinMutation.mutate({
        areaId: repository.areaId,
        repositoryId: repository.id,
        workspaceId,
        nameWithOwner: repository.connection?.nameWithOwner ?? undefined,
        pinned: isAreaRepositoryPinned(repository.areaId, repository.id, workspaceId)
      });
    },
    [areaPinMutation, isAreaRepositoryPinned]
  );

  return {
    repositoryPinRecords,
    pinnedRepositoryNames,
    isRepositoryPinned,
    isAreaRepositoryPinned,
    repositoryPinBusy: areaPinMutation.isPending,
    repositoryPinError: areaPinMutation.error instanceof Error ? areaPinMutation.error : null,
    toggleRepositoryPin,
    toggleAreaRepositoryPin
  };
}
