import type { AreaSummary } from "@shared/areas";

export function isGatewayAreaKind(kind: AreaSummary["kind"] | null | undefined): boolean {
  return kind === "local" || kind === "ssh";
}
