import { useEffect, useRef, type JSX } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useControlApi } from "../../hooks/useControlApi";

const controlRendererLoadingLogsEnabled = import.meta.env.DEV;

function queryKeyLogLabel(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey[0] ?? "query");
  }
}

function logRendererLoading(message: string, metadata?: Record<string, unknown>): void {
  if (!controlRendererLoadingLogsEnabled) {
    return;
  }

  if (metadata) {
    console.info("[Control loading]", message, metadata);
    return;
  }

  console.info("[Control loading]", message);
}

export function AppEventBridge({
  onGitHubRepositoryUpdated,
  onGitHubAuthUpdated
}: {
  onGitHubRepositoryUpdated(nameWithOwner: string | null): void;
  onGitHubAuthUpdated(): void;
}): JSX.Element | null {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const queryFetchStatuses = useRef(new Map<string, string>());

  useEffect(() => {
    if (!controlRendererLoadingLogsEnabled) {
      return;
    }

    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") {
        return;
      }

      const queryKey = queryKeyLogLabel(event.query.queryKey);
      const fetchStatus = event.query.state.fetchStatus;
      const previousFetchStatus = queryFetchStatuses.current.get(queryKey) ?? "idle";
      if (fetchStatus === previousFetchStatus) {
        return;
      }

      queryFetchStatuses.current.set(queryKey, fetchStatus);

      if (previousFetchStatus !== "fetching" && fetchStatus === "fetching") {
        logRendererLoading("renderer query refresh start", { queryKey });
        return;
      }

      if (previousFetchStatus === "fetching" && fetchStatus !== "fetching") {
        logRendererLoading(
          event.query.state.status === "error"
            ? "renderer query refresh failed"
            : "renderer query refresh complete",
          { queryKey, status: event.query.state.status }
        );
      }
    });
  }, [queryClient]);

  useEffect(() => {
    const unsubscribeAreas = api.onAreasUpdated(() => {
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
    });
    const unsubscribeRepositories = api.onAreaRepositoryUpdated((event) => {
      void queryClient.invalidateQueries({ queryKey: ["area-repositories", event.areaId] });
      void queryClient.invalidateQueries({ queryKey: ["area-repository", event.areaId, event.repositoryId] });
    });
    const unsubscribeWorkspaces = api.onAreaWorkspaceUpdated((event) => {
      void queryClient.invalidateQueries({ queryKey: ["area-workspaces", event.areaId, event.repositoryId] });
    });
    return () => {
      unsubscribeAreas();
      unsubscribeRepositories();
      unsubscribeWorkspaces();
    };
  }, [api, queryClient]);

  useEffect(
    () =>
      api.onGitHubRepositoriesUpdated((event) => {
        void queryClient.invalidateQueries({ queryKey: ["repositories"] });
        onGitHubRepositoryUpdated(event.nameWithOwner ?? null);
      }),
    [api, onGitHubRepositoryUpdated, queryClient]
  );

  useEffect(
    () =>
      api.onGitHubAuthUpdated((event) => {
        queryClient.setQueryData(["app-state"], event.appState);
        onGitHubAuthUpdated();
      }),
    [api, onGitHubAuthUpdated, queryClient]
  );

  return null;
}
