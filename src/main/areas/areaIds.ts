import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";

export const defaultGitHubAreaId = "github:default";

export function localRepositoryId(areaId: string, rootPath: string, areaRootPath: string | null): string {
  const identityPath = areaRootPath
    ? relative(resolve(areaRootPath), resolve(rootPath)) || "."
    : resolve(rootPath);
  return `repo:${areaId}:${stableHash(identityPath)}`;
}

export function localWorkspaceId(areaId: string, repositoryId: string, workspaceRootPath: string): string {
  return `workspace:${areaId}:${stableHash(`${repositoryId}:${resolve(workspaceRootPath)}`)}`;
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
