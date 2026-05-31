import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { AreaSummary, CreateSshAreaInput, UpdateAreaInput } from "@shared/areas";
import { useControlApi } from "../../hooks/useControlApi";
import { useUiStore } from "../../stores/uiStore";
import { isGatewayAreaKind } from "./areaUi";

const areasQueryKey = ["areas"] as const;

function areaRepositoriesQueryKey(areaId: string): readonly ["area-repositories", string] {
  return ["area-repositories", areaId] as const;
}

function selectedAreaFrom(areaItems: AreaSummary[], selectedAreaId: string | null): AreaSummary | null {
  return (
    areaItems.find((area) => area.id === selectedAreaId) ??
    areaItems.find((area) => area.selected) ??
    areaItems.find((area) => area.kind === "github") ??
    null
  );
}

export function useAreasShell({ enabled }: { enabled: boolean }) {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const selectedAreaId = useUiStore((state) => state.selectedAreaId);
  const selectAreaInStore = useUiStore((state) => state.selectArea);

  const areas = useQuery({
    queryKey: areasQueryKey,
    queryFn: () => api.areas.listAreas(),
    enabled,
    staleTime: 30_000
  });
  const areaItems = areas.data ?? [];
  const selectedArea = selectedAreaFrom(areaItems, selectedAreaId);
  const selectedAreaIsGateway = Boolean(selectedArea && isGatewayAreaKind(selectedArea.kind));
  const selectedAreaRepositories = useQuery({
    queryKey: areaRepositoriesQueryKey(selectedArea?.id ?? "none"),
    queryFn: () => api.areas.listRepositories({ areaId: selectedArea?.id ?? "" }),
    enabled: Boolean(selectedArea?.id && selectedAreaIsGateway),
    placeholderData: (previousData) => previousData
  });
  const localRepositoryItems = selectedAreaRepositories.data ?? [];

  useEffect(() => {
    if (!selectedAreaId && selectedArea?.id) {
      selectAreaInStore(selectedArea.id);
    }
  }, [selectAreaInStore, selectedArea?.id, selectedAreaId]);

  async function selectArea(areaId: string): Promise<void> {
    selectAreaInStore(areaId);
    await api.areas.selectArea(areaId);
    await queryClient.invalidateQueries({ queryKey: areasQueryKey });
  }

  async function addLocalArea(): Promise<void> {
    const rootPath = await api.areas.openLocalFolderPicker();
    if (!rootPath) {
      return;
    }
    const area = await api.areas.createLocalArea({ rootPath });
    selectAreaInStore(area.id);
    await queryClient.invalidateQueries({ queryKey: areasQueryKey });
    await queryClient.invalidateQueries({ queryKey: areaRepositoriesQueryKey(area.id) });
  }

  async function createSshArea(input: CreateSshAreaInput): Promise<void> {
    const area = await api.areas.createSshArea(input);
    selectAreaInStore(area.id);
    await queryClient.invalidateQueries({ queryKey: areasQueryKey });
    await queryClient.invalidateQueries({ queryKey: areaRepositoriesQueryKey(area.id) });
  }

  async function updateArea(input: UpdateAreaInput): Promise<void> {
    const area = await api.areas.updateArea(input);
    await queryClient.invalidateQueries({ queryKey: areasQueryKey });
    await queryClient.invalidateQueries({ queryKey: areaRepositoriesQueryKey(area.id) });
  }

  async function deleteArea(area: AreaSummary): Promise<void> {
    const remainingAreas = await api.areas.removeArea(area.id);
    if (selectedAreaId === area.id) {
      const fallbackArea =
        remainingAreas.find((candidate) => candidate.selected) ??
        remainingAreas.find((candidate) => candidate.kind === "github") ??
        remainingAreas[0] ??
        null;
      if (fallbackArea) {
        selectAreaInStore(fallbackArea.id);
      }
    }
    await queryClient.invalidateQueries({ queryKey: areasQueryKey });
    await queryClient.invalidateQueries({ queryKey: areaRepositoriesQueryKey(area.id) });
  }

  async function refreshSelectedArea(): Promise<void> {
    if (!selectedArea) {
      return;
    }
    await api.areas.refreshArea(selectedArea.id);
    await queryClient.invalidateQueries({ queryKey: areasQueryKey });
    await queryClient.invalidateQueries({ queryKey: areaRepositoriesQueryKey(selectedArea.id) });
  }

  async function stopSelectedAreaGateway(): Promise<void> {
    if (!selectedArea) {
      return;
    }
    await api.areas.stopGateway({ areaId: selectedArea.id });
    await queryClient.invalidateQueries({ queryKey: areasQueryKey });
  }

  return {
    areas,
    areaItems,
    selectedArea,
    selectedAreaIsGateway,
    selectedAreaRepositories,
    localRepositoryItems,
    selectArea,
    addLocalArea,
    createSshArea,
    updateArea,
    deleteArea,
    refreshSelectedArea,
    stopSelectedAreaGateway
  };
}
