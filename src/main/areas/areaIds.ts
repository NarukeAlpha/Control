import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";

export const defaultGitHubAreaId = "github:default";

export function localAreaId(rootPath: string): string {
  return `local:${stableHash(resolve(rootPath))}`;
}

export function sshAreaId(input: {
  host: string;
  rootPath: string;
  username?: string | null;
  port?: number | null;
}): string {
  const authority = `${input.username?.trim() || ""}@${input.host.trim()}:${input.port ?? 22}`;
  return `ssh:${stableHash(`${authority}:${input.rootPath.trim()}`)}`;
}

export function localRepositoryId(areaId: string, rootPath: string, areaRootPath: string | null): string {
  const identityPath = areaRootPath
    ? relative(resolve(areaRootPath), resolve(rootPath)) || "."
    : resolve(rootPath);
  return `repo:${areaId}:${stableHash(identityPath)}`;
}

export function localWorkspaceId(areaId: string, repositoryId: string, workspaceRootPath: string): string {
  return `workspace:${areaId}:${stableHash(`${repositoryId}:${resolve(workspaceRootPath)}`)}`;
}

export function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
