import type { AreaSummary } from "@shared/areas";

export function isGatewayAreaKind(kind: AreaSummary["kind"] | null | undefined): boolean {
  return kind === "local" || kind === "ssh";
}

export function areaRepositoryPinKey(
  areaId: string | null | undefined,
  repositoryId: string | null | undefined,
  workspaceId: string | null | undefined
): string {
  return `${areaId ?? ""}:${repositoryId ?? ""}:${workspaceId ?? ""}`;
}
