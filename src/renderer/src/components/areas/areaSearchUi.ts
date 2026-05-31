import type {
  AreaFileEntry,
  AreaHealth,
  AreaRepositorySummary,
  AreaSummary,
  AreaWorkspaceSummary
} from "@shared/areas";
import type { AppRoute } from "../../stores/uiStore";

export function areaKindLabel(kind: AreaSummary["kind"]): "GitHub" | "Local" | "SSH" {
  switch (kind) {
    case "github":
      return "GitHub";
    case "ssh":
      return "SSH";
    case "local":
      return "Local";
  }
}

export function areaHealthLabel(health: AreaHealth): string | null {
  if (health.status === "ready" && !health.message) {
    return null;
  }
  return health.message ?? health.status;
}

export function areaRepositorySubtitle(
  repository: AreaRepositorySummary,
  areaById: ReadonlyMap<string, AreaSummary>
): string {
  const area = areaById.get(repository.areaId);
  const areaLabel = area ? `${area.label} ${areaKindLabel(area.kind)}` : "Area";
  const remote = repository.connection?.nameWithOwner ?? null;
  const location = remote ?? repository.path ?? repository.kind.toUpperCase();
  return `${areaLabel} · ${repository.kind.toUpperCase()} · ${location}`;
}

export function workspaceSubtitle(
  workspace: AreaWorkspaceSummary,
  repositoryById: ReadonlyMap<string, AreaRepositorySummary>,
  areaById: ReadonlyMap<string, AreaSummary>
): string {
  const area = areaById.get(workspace.areaId);
  const repository = repositoryById.get(workspace.repositoryId);
  const parts = [
    area ? `${area.label} ${areaKindLabel(area.kind)}` : "Area",
    repository?.displayName ?? "Repository",
    workspace.rootPath,
    workspace.isStale ? "Stale" : null,
    workspace.sparseSummary ? `Sparse ${workspace.sparseSummary}` : null,
    areaHealthLabel(workspace.health)
  ].filter(Boolean);
  return parts.join(" · ");
}

export function localFileSearchSubtitle(
  entry: AreaFileEntry,
  route: Extract<AppRoute, { kind: "localRepository" }>
): string {
  const workspace = route.workspaceId ? `Workspace ${route.workspaceId}` : "Repository root";
  return `${entry.path} · ${workspace}`;
}
