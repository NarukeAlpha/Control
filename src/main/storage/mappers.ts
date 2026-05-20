import { createHash } from "node:crypto";
import { basename } from "node:path";

import type {
  AreaRepositoryDetail,
  AreaRepositorySummary,
  AreaSummary,
  AreaWorkspaceDetail,
  AreaWorkspaceSummary,
  UpdateAreaInput
} from "@shared/areas";
import type { RepositoryDetail, RepositorySummary } from "@shared/github";
import type { LocalRecentItem, LocalRecentMetadata } from "@shared/local";
import type { AreaGatewayRecord } from "./areaGatewayStore";
import { parseStorageJsonOr, stringifyStorageJson } from "./serializers";

export interface RecentItemRow {
  kind: string;
  provider: string;
  itemKey: string;
  payload: string;
  updatedAt: string;
}

export const defaultGitHubAreaId = "github:default";

export function defaultGitHubRepositoryId(nameWithOwner: string): string {
  return `github:default:${nameWithOwner.toLowerCase()}`;
}

export function oldestTimestamp(timestamps: Array<string | null>): string | null {
  const parsedTimestamps = timestamps
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .map((timestamp) => ({ timestamp, time: Date.parse(timestamp) }))
    .filter((entry) => Number.isFinite(entry.time));

  if (parsedTimestamps.length === 0) {
    return null;
  }

  return parsedTimestamps.reduce((oldest, entry) => (entry.time < oldest.time ? entry : oldest)).timestamp;
}

export function toGitHubRepositoryRow(
  repository: RepositorySummary,
  detail: RepositoryDetail | null
): Record<string, unknown> {
  return {
    id: repository.nameWithOwner,
    owner: repository.owner,
    name: repository.name,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate ? 1 : 0,
    isFork: repository.isFork ? 1 : 0,
    defaultBranch: repository.defaultBranch,
    avatarUrl: repository.avatarUrl,
    primaryLanguageJson: stringifyStorageJson(
      "githubRepositories.primaryLanguage",
      repository.primaryLanguage
    ),
    countsJson: stringifyStorageJson("githubRepositories.counts", repository.counts),
    stargazerCount: repository.stargazerCount,
    forkCount: repository.forkCount,
    watcherCount: repository.watcherCount,
    openIssuesCount: repository.openIssuesCount,
    pushedAt: repository.pushedAt,
    updatedAt: repository.updatedAt,
    summaryJson: stringifyStorageJson("githubRepositories.summary", repository),
    detailJson: detail ? stringifyStorageJson("githubRepositories.detail", detail) : null,
    readmeMarkdown: detail?.readmeMarkdown ?? null,
    languagesJson: detail ? stringifyStorageJson("githubRepositories.languages", detail.languages) : null,
    viewerStateJson: detail
      ? stringifyStorageJson("githubRepositories.viewerState", detail.viewerState)
      : null,
    permissionsJson: detail
      ? stringifyStorageJson("githubRepositories.permissions", detail.permissions)
      : null
  };
}

export function normalizeRecentLimit(limit: number | undefined): number {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.trunc(limit)))
    : 12;
}

export function mapRecentItemRow(row: RecentItemRow): LocalRecentItem | null {
  if (!isLocalRecentKind(row.kind) || (row.provider !== "github" && row.provider !== "local")) {
    return null;
  }

  const payload = parseRecentPayload(row.payload);
  const repositoryNameWithOwner =
    stringValue(payload.repositoryNameWithOwner) ??
    stringValue(payload.nameWithOwner) ??
    (row.kind === "repository" ? row.itemKey : null);
  const metadata = metadataValue(payload.metadata);

  if (!metadata.path && typeof payload.path === "string") {
    metadata.path = payload.path;
  }
  if (!metadata.ref && typeof payload.ref === "string") {
    metadata.ref = payload.ref;
  }
  if (!metadata.number && typeof payload.number === "number") {
    metadata.number = payload.number;
  }

  const areaId = stringValue(payload.areaId);
  const repositoryId = stringValue(payload.repositoryId);
  const workspaceId = stringValue(payload.workspaceId);

  return {
    kind: row.kind,
    provider: row.provider,
    itemKey: row.itemKey,
    title: stringValue(payload.title) ?? stringValue(payload.nameWithOwner) ?? row.itemKey,
    subtitle: stringValue(payload.subtitle) ?? stringValue(payload.description),
    repositoryNameWithOwner,
    areaId,
    repositoryId,
    workspaceId,
    url:
      stringValue(payload.url) ??
      stringValue(payload.htmlUrl) ??
      (row.provider === "github" && repositoryNameWithOwner
        ? `https://github.com/${repositoryNameWithOwner}`
        : null),
    metadata,
    updatedAt: row.updatedAt
  };
}

export function parseRecentPayload(payload: string): Record<string, unknown> {
  const parsed = parseStorageJsonOr<unknown>(payload, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeAreaLimit(limit: number | undefined, fallback: number): number {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(1000, Math.max(1, Math.trunc(limit)))
    : fallback;
}

export function createDefaultGitHubArea(accountLogin: string | null, selected: boolean): AreaSummary {
  const now = new Date().toISOString();
  return {
    id: defaultGitHubAreaId,
    kind: "github",
    label: "GitHub",
    subtitle: accountLogin ? `@${accountLogin}` : "Default GitHub account",
    rootPath: null,
    accountLogin,
    gateway: null,
    health: {
      status: accountLogin ? "ready" : "needs-auth",
      message: accountLogin ? null : "Sign in to GitHub to refresh remote data.",
      checkedAt: now
    },
    repositoryCount: 0,
    selected,
    createdAt: now,
    updatedAt: now
  };
}

export function localAreaId(rootPath: string): string {
  return `local:${createHash("sha256").update(rootPath).digest("hex").slice(0, 16)}`;
}

export function sshAreaId(input: {
  host: string;
  rootPath: string;
  username: string | null;
  port: number | null;
}): string {
  const authority = `${input.username ?? ""}@${input.host}:${input.port ?? 22}`;
  return `ssh:${createHash("sha256").update(`${authority}:${input.rootPath}`).digest("hex").slice(0, 16)}`;
}

export function areaRepositoryPinKey(
  areaId: string,
  repositoryId: string,
  workspaceId: string | null
): string {
  return `${areaId}:${repositoryId}:${workspaceId ?? ""}`;
}

export function localAreaLabel(rootPath: string, label?: string | null): string {
  return label?.trim() || basename(rootPath) || rootPath;
}

export function sshAreaLabel(host: string, label?: string | null): string {
  return label?.trim() || host;
}

export function sshAreaSubtitle(input: {
  host: string;
  rootPath: string;
  username: string | null;
  port: number | null;
}): string {
  const userPrefix = input.username ? `${input.username}@` : "";
  const portSuffix = input.port ? `:${input.port}` : "";
  return `${userPrefix}${input.host}${portSuffix}:${input.rootPath}`;
}

export function areaGatewaySummary(record: AreaGatewayRecord): AreaSummary["gateway"] {
  return {
    status: record.status,
    version: record.version,
    apiUrl: record.apiUrl,
    adminUrl: record.adminUrl,
    serviceName: record.serviceName,
    lastStartedAt: record.lastStartedAt,
    lastSeenAt: record.lastSeenAt,
    message: record.message
  };
}

export function updateAreaSummary(
  existing: AreaSummary,
  input: UpdateAreaInput,
  gateway: AreaGatewayRecord | null
): AreaSummary {
  const now = new Date().toISOString();
  if (existing.kind === "github") {
    return {
      ...existing,
      label: labelFromUpdate(input.label, existing.label, "GitHub"),
      updatedAt: now
    };
  }

  if (existing.kind === "local") {
    const rootPath = pathFromUpdate(input.rootPath, existing.rootPath);
    const rootChanged = rootPath !== existing.rootPath;
    return {
      ...existing,
      label: input.label === undefined ? existing.label : localAreaLabel(rootPath, input.label),
      subtitle: rootPath,
      rootPath,
      health: rootChanged
        ? { status: "scanning", message: "Scanning local repositories.", checkedAt: now }
        : existing.health,
      updatedAt: now
    };
  }

  const rootPath = pathFromUpdate(input.rootPath, existing.rootPath);
  const host = labelFromUpdate(input.host, gateway?.host ?? sshHostFromSubtitle(existing.subtitle), null);
  if (!host) {
    throw new Error("SSH Area requires a host.");
  }
  const username =
    input.username === undefined ? (gateway?.username ?? null) : input.username?.trim() || null;
  const port = input.port === undefined ? (gateway?.port ?? null) : (input.port ?? null);
  const configChanged =
    rootPath !== existing.rootPath ||
    host !== gateway?.host ||
    username !== (gateway?.username ?? null) ||
    port !== (gateway?.port ?? null);

  return {
    ...existing,
    label: input.label === undefined ? existing.label : sshAreaLabel(host, input.label),
    subtitle: sshAreaSubtitle({ host, rootPath, username, port }),
    rootPath,
    health: configChanged
      ? { status: "scanning", message: "Starting remote gateway.", checkedAt: now }
      : existing.health,
    updatedAt: now
  };
}

export function updatedGatewayRecord(
  gateway: AreaGatewayRecord,
  area: AreaSummary,
  input: UpdateAreaInput
): AreaGatewayRecord | null {
  if (area.kind === "local") {
    const rootPath = pathFromUpdate(input.rootPath, gateway.rootPath);
    return rootPath === gateway.rootPath
      ? null
      : resetGatewayRecord(gateway, { rootPath, host: null, username: null, port: null });
  }

  if (area.kind !== "ssh") {
    return null;
  }

  const rootPath = pathFromUpdate(input.rootPath, gateway.rootPath);
  const host = labelFromUpdate(input.host, gateway.host, null);
  const username = input.username === undefined ? gateway.username : input.username?.trim() || null;
  const port = input.port === undefined ? gateway.port : (input.port ?? null);
  if (
    rootPath === gateway.rootPath &&
    host === gateway.host &&
    username === gateway.username &&
    port === gateway.port
  ) {
    return null;
  }
  return resetGatewayRecord(gateway, { rootPath, host, username, port });
}

export function areaRepositoryDetailFromSummary(summary: AreaRepositorySummary): AreaRepositoryDetail {
  return {
    ...summary,
    remotes: [],
    branches: [],
    bookmarks: [],
    tags: [],
    status: emptyAreaStatus(),
    recentCommits: [],
    recentOperations: [],
    readme: null,
    workspaces: []
  };
}

export function areaWorkspaceDetailFromSummary(summary: AreaWorkspaceSummary): AreaWorkspaceDetail {
  return {
    ...summary,
    fileTree: [],
    readme: null,
    status: emptyAreaStatus()
  };
}

function resetGatewayRecord(
  gateway: AreaGatewayRecord,
  input: Pick<AreaGatewayRecord, "rootPath" | "host" | "username" | "port">
): AreaGatewayRecord {
  return {
    ...gateway,
    ...input,
    apiUrl: null,
    adminUrl: null,
    serviceName: null,
    version: null,
    status: "not-installed",
    pid: null,
    processId: null,
    message: null,
    lastStartedAt: null,
    lastSeenAt: null,
    updatedAt: new Date().toISOString()
  };
}

function emptyAreaStatus() {
  return {
    clean: null,
    dirtyCount: 0,
    untrackedCount: 0,
    conflictedCount: 0,
    ahead: null,
    behind: null,
    entries: []
  };
}

function pathFromUpdate(value: string | null | undefined, fallback: string | null): string {
  const normalized = value?.trim() || fallback?.trim() || "";
  if (!normalized) {
    throw new Error("Area requires a root path.");
  }
  return normalized;
}

function labelFromUpdate(
  value: string | null | undefined,
  fallback: string | null,
  defaultValue: string | null
): string {
  return value?.trim() || fallback?.trim() || defaultValue || "";
}

function sshHostFromSubtitle(subtitle: string | null): string | null {
  if (!subtitle) {
    return null;
  }
  const authority = subtitle.split(":")[0] ?? "";
  return authority.split("@").pop()?.trim() || null;
}

function isLocalRecentKind(kind: string): kind is LocalRecentItem["kind"] {
  return (
    kind === "repository" ||
    kind === "commit" ||
    kind === "issue" ||
    kind === "pullRequest" ||
    kind === "discussion" ||
    kind === "organization" ||
    kind === "team" ||
    kind === "contributor" ||
    kind === "project" ||
    kind === "release" ||
    kind === "releaseAsset" ||
    kind === "workflowRun" ||
    kind === "workflowArtifact" ||
    kind === "securityItem" ||
    kind === "wikiPage" ||
    kind === "file"
  );
}

function metadataValue(value: unknown): LocalRecentMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<LocalRecentMetadata>(
    (metadata, [key, item]) => {
      if (
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null
      ) {
        metadata[key] = item;
      }
      return metadata;
    },
    {}
  );
}
