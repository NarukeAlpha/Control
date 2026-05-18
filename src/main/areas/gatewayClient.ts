import type {
  AreaFileContent,
  AreaFileEntry,
  AreaGatewayOperationInput,
  AreaGatewayOperationPreview,
  AreaGatewayOperationResult,
  AreaGatewayRunOperationInput,
  AreaRepositoryDetail,
  AreaRepositorySummary,
  AreaSyncStatus
} from "@shared/areas";

import type { AreaGatewayRecord } from "../storage";

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface GatewayRepositoryPayload {
  repositories?: unknown[];
  repository?: unknown;
  contents?: unknown[];
  fileContent?: unknown;
  status?: unknown;
  prepareOperation?: unknown;
  runOperation?: unknown;
}

export class GatewayClient {
  constructor(private readonly record: AreaGatewayRecord) {}

  async listRepositories(): Promise<AreaRepositorySummary[]> {
    const data = await this.graphql<GatewayRepositoryPayload>(`
      query GatewayRepositories {
        repositories {
          id
          name
          path
          vcs
        }
      }
    `);
    return asArray(data.repositories).map((repository) =>
      normalizeRepositorySummary(this.record.areaId, repository)
    );
  }

  async getRepository(repositoryId: string): Promise<AreaRepositoryDetail | null> {
    const data = await this.graphql<GatewayRepositoryPayload>(
      `
        query GatewayRepository($repositoryId: String!) {
          repository(id: $repositoryId) {
            id
            name
            path
            vcs
          }
        }
      `,
      { repositoryId }
    );
    if (!data.repository) {
      return null;
    }
    const detail = normalizeRepositoryDetail(this.record.areaId, data.repository);
    const status = await this.readGatewayStatus(repositoryId, detail.kind).catch(() => null);
    return status ? { ...detail, status } : detail;
  }

  async listContents(input: {
    repositoryId: string;
    workspaceId?: string | null;
    path?: string | null;
  }): Promise<AreaFileEntry[]> {
    const data = await this.graphql<GatewayRepositoryPayload>(
      `
        query GatewayContents($repository: String!, $path: String) {
          contents(repository: $repository, path: $path) {
            name
            path
            isDir
            size
          }
        }
      `,
      { repository: input.repositoryId, path: input.path ?? null }
    );
    return asArray(data.contents).map(normalizeFileEntry);
  }

  async getFileContent(input: {
    repositoryId: string;
    workspaceId?: string | null;
    path: string;
  }): Promise<AreaFileContent> {
    const data = await this.graphql<GatewayRepositoryPayload>(
      `
        query GatewayFileContent($repository: String!, $path: String!) {
          fileContent(repository: $repository, path: $path) {
            path
            content
          }
        }
      `,
      { repository: input.repositoryId, path: input.path }
    );
    return normalizeFileContent(data.fileContent, input.path);
  }

  async getSyncStatus(input: { repositoryId: string; workspaceId?: string | null }): Promise<AreaSyncStatus> {
    const data = await this.graphql<GatewayRepositoryPayload>(
      `
        query GatewayStatus($repository: String!, $vcs: VcsKind) {
          status(repository: $repository, vcs: $vcs) {
            repository
            vcs
            operation
            exitCode
            stdout
            stderr
          }
        }
      `,
      { repository: input.repositoryId, vcs: null }
    );
    return normalizeSyncStatus(this.record.areaId, input.repositoryId, data.status);
  }

  async prepareOperation(input: AreaGatewayOperationInput): Promise<AreaGatewayOperationPreview> {
    const mapped = gatewayOperationInput(input);
    const data = await this.graphql<GatewayRepositoryPayload>(
      `
        mutation PrepareGatewayOperation($input: OperationInput!) {
          prepareOperation(input: $input) {
            confirmationId
            repository
            vcs
            operation
            command
            requiresConfirmation
          }
        }
      `,
      { input: mapped }
    );
    return normalizeOperationPreview(this.record.areaId, input, data.prepareOperation);
  }

  async runOperation(input: AreaGatewayRunOperationInput): Promise<AreaGatewayOperationResult> {
    const data = await this.graphql<GatewayRepositoryPayload>(
      `
        mutation RunGatewayOperation($input: RunOperationInput!) {
          runOperation(input: $input) {
            operationId
            repository
            vcs
            operation
            command
            exitCode
            stdout
            stderr
          }
        }
      `,
      { input: { confirmationId: input.operationId } }
    );
    return normalizeOperationResult(this.record.areaId, input.operationId, data.runOperation);
  }

  private async readGatewayStatus(
    repositoryId: string,
    kind: AreaRepositoryDetail["kind"]
  ): Promise<AreaRepositoryDetail["status"]> {
    const data = await this.graphql<GatewayRepositoryPayload>(
      `
        query GatewayRepositoryStatus($repository: String!, $vcs: VcsKind) {
          status(repository: $repository, vcs: $vcs) {
            stdout
          }
        }
      `,
      { repository: repositoryId, vcs: kind === "jj" ? "JJ" : "GIT" }
    );
    return parseStatusOutput(stringValue(objectValue(data.status).stdout) ?? "");
  }

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    if (!this.record.apiUrl) {
      throw new Error("Gateway API URL is unavailable.");
    }
    const response = await fetch(new URL("/graphql", this.record.apiUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.record.apiToken ? { authorization: `Bearer ${this.record.apiToken}` } : {})
      },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) {
      throw new Error(`Gateway request failed with HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as GraphQlResponse<T>;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message ?? "Gateway GraphQL error.").join("; "));
    }
    if (!payload.data) {
      throw new Error("Gateway returned no data.");
    }
    return payload.data;
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRepositorySummary(areaId: string, value: unknown): AreaRepositorySummary {
  const payload = objectValue(value);
  const id =
    stringValue(payload.id) ??
    `repo:${areaId}:${stringValue(payload.path) ?? stringValue(payload.name) ?? "unknown"}`;
  const name = stringValue(payload.name) ?? stringValue(payload.displayName) ?? id;
  const now = new Date().toISOString();
  const vcs = asArray(payload.vcs).map((entry) => String(entry).toLowerCase());
  const kind = vcs.includes("jj") ? "jj" : "git";
  return {
    id,
    areaId,
    kind,
    name,
    owner: stringValue(payload.owner),
    displayName: stringValue(payload.displayName) ?? name,
    path: stringValue(payload.path),
    defaultBranch: stringValue(payload.defaultBranch),
    currentBranch: stringValue(payload.currentBranch),
    isDirty: booleanValue(payload.isDirty),
    isPrivate: booleanValue(payload.isPrivate),
    description: stringValue(payload.description),
    connection: (payload.connection as AreaRepositorySummary["connection"]) ?? null,
    capabilities: {
      supportsBranches: Boolean(objectValue(payload.capabilities).supportsBranches),
      supportsBookmarks: kind === "jj" || Boolean(objectValue(payload.capabilities).supportsBookmarks),
      supportsWorkspaces: kind === "jj" || Boolean(objectValue(payload.capabilities).supportsWorkspaces),
      supportsOperationLog: kind === "jj" || Boolean(objectValue(payload.capabilities).supportsOperationLog),
      supportsSparse: Boolean(objectValue(payload.capabilities).supportsSparse),
      isGitBacked: objectValue(payload.capabilities).isGitBacked !== false,
      isColocated: Boolean(objectValue(payload.capabilities).isColocated),
      supportsGitHubEnrichment: Boolean(objectValue(payload.capabilities).supportsGitHubEnrichment)
    },
    health: (payload.health as AreaRepositorySummary["health"]) ?? {
      status: "ready",
      message: null,
      checkedAt: now
    },
    updatedAt: stringValue(payload.updatedAt),
    scannedAt: stringValue(payload.scannedAt) ?? now
  };
}

function normalizeRepositoryDetail(areaId: string, value: unknown): AreaRepositoryDetail {
  const payload = objectValue(value);
  const summary = normalizeRepositorySummary(areaId, payload);
  return {
    ...summary,
    remotes: (asArray(payload.remotes) as AreaRepositoryDetail["remotes"]) ?? [],
    branches: (asArray(payload.branches) as AreaRepositoryDetail["branches"]) ?? [],
    bookmarks: (asArray(payload.bookmarks) as AreaRepositoryDetail["bookmarks"]) ?? [],
    tags: (asArray(payload.tags) as AreaRepositoryDetail["tags"]) ?? [],
    status: (payload.status as AreaRepositoryDetail["status"]) ?? {
      clean: null,
      dirtyCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      ahead: null,
      behind: null,
      entries: []
    },
    recentCommits: (asArray(payload.recentCommits) as AreaRepositoryDetail["recentCommits"]) ?? [],
    recentOperations: (asArray(payload.recentOperations) as AreaRepositoryDetail["recentOperations"]) ?? [],
    readme: (payload.readme as AreaRepositoryDetail["readme"]) ?? null,
    workspaces: (asArray(payload.workspaces) as AreaRepositoryDetail["workspaces"]) ?? []
  };
}

function normalizeFileEntry(value: unknown): AreaFileEntry {
  const payload = objectValue(value);
  return {
    name: stringValue(payload.name) ?? stringValue(payload.path) ?? "unknown",
    path: stringValue(payload.path) ?? stringValue(payload.name) ?? ".",
    type: payload.type === "dir" || payload.isDir === true ? "dir" : "file",
    size: numberValue(payload.size),
    updatedAt: stringValue(payload.updatedAt)
  };
}

function normalizeFileContent(value: unknown, path: string): AreaFileContent {
  const payload = objectValue(value);
  const content = stringValue(payload.content);
  const kind = content !== null ? "text" : payload.kind === "binary" ? "binary" : "unavailable";
  return {
    path: stringValue(payload.path) ?? path,
    kind,
    text: content ?? stringValue(payload.text),
    encoding: kind === "text" ? "utf-8" : null,
    size: numberValue(payload.size) ?? content?.length ?? null,
    message: stringValue(payload.message)
  };
}

function normalizeSyncStatus(areaId: string, repositoryId: string, value: unknown): AreaSyncStatus {
  const payload = objectValue(value);
  const capabilities = objectValue(payload.capabilities);
  const vcs = String(payload.vcs ?? "").toLowerCase();
  return {
    areaId,
    repositoryId,
    provider: vcs === "jj" || payload.provider === "jj" ? "jj" : "git",
    remotes: asArray(payload.remotes) as AreaSyncStatus["remotes"],
    defaultRemote: stringValue(payload.defaultRemote),
    currentBranch: stringValue(payload.currentBranch),
    currentBookmark: stringValue(payload.currentBookmark),
    hasUncommittedChanges: booleanValue(payload.hasUncommittedChanges),
    capabilities: {
      canFetch: capabilities.canFetch !== false,
      canPush: capabilities.canPush !== false,
      canPull: vcs !== "jj" && capabilities.canPull !== false,
      canCreateBranch: vcs !== "jj" && capabilities.canCreateBranch !== false,
      canCreateBookmark: vcs === "jj" || Boolean(capabilities.canCreateBookmark),
      canCommit: Boolean(capabilities.canCommit),
      canUndo: vcs === "jj" || Boolean(capabilities.canUndo)
    },
    updatedAt: stringValue(payload.updatedAt)
  };
}

function normalizeOperationPreview(
  areaId: string,
  input: AreaGatewayOperationInput,
  value: unknown
): AreaGatewayOperationPreview {
  const payload = objectValue(value);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
  return {
    id: stringValue(payload.confirmationId) ?? stringValue(payload.id) ?? `${input.kind}:${now.getTime()}`,
    areaId,
    repositoryId: input.repositoryId,
    kind: input.kind,
    status: "prepared",
    title: stringValue(payload.title) ?? input.kind,
    summary:
      stringValue(payload.summary) ??
      `Ready to run ${asArray(payload.command)
        .filter((part): part is string => typeof part === "string")
        .join(" ")}`,
    risks: asArray(payload.risks).filter((risk): risk is string => typeof risk === "string"),
    affectedRefs: asArray(payload.affectedRefs).filter((ref): ref is string => typeof ref === "string"),
    affectedPaths: asArray(payload.affectedPaths).filter((path): path is string => typeof path === "string"),
    requiresGitHubToken: Boolean(payload.requiresGitHubToken),
    preparedAt: stringValue(payload.preparedAt) ?? now.toISOString(),
    expiresAt: stringValue(payload.expiresAt) ?? expiresAt
  };
}

function normalizeOperationResult(
  areaId: string,
  operationId: string,
  value: unknown
): AreaGatewayOperationResult {
  const payload = objectValue(value);
  return {
    id: stringValue(payload.operationId) ?? stringValue(payload.id) ?? operationId,
    areaId,
    repositoryId: stringValue(payload.repository) ?? stringValue(payload.repositoryId) ?? "",
    kind: gatewayResultKind(payload),
    status: payload.exitCode === 0 ? "succeeded" : "failed",
    message:
      payload.exitCode === 0
        ? "Gateway operation succeeded."
        : stringValue(payload.stderr) || "Gateway operation failed.",
    stdout: stringValue(payload.stdout),
    stderr: stringValue(payload.stderr),
    recoveryOperationId: stringValue(payload.recoveryOperationId),
    completedAt: stringValue(payload.completedAt) ?? new Date().toISOString()
  };
}

function gatewayOperationInput(input: AreaGatewayOperationInput): Record<string, unknown> {
  const jj = input.kind.startsWith("jj.");
  const operation = input.kind.endsWith(".push")
    ? "PUSH"
    : input.kind.endsWith(".status")
      ? "STATUS"
      : "FETCH";
  return {
    repository: input.repositoryId,
    vcs: jj ? "JJ" : "GIT",
    operation
  };
}

function gatewayResultKind(payload: Record<string, unknown>): AreaGatewayOperationResult["kind"] {
  const vcs = String(payload.vcs ?? "").toLowerCase();
  const operation = String(payload.operation ?? "").toLowerCase();
  if (vcs === "jj") {
    return operation === "push" ? "jj.git.push" : operation === "status" ? "jj.git.fetch" : "jj.git.fetch";
  }
  return operation === "push" ? "git.push" : operation === "status" ? "git.fetch" : "git.fetch";
}

function parseStatusOutput(value: string): AreaRepositoryDetail["status"] {
  const entries = value
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("## "))
    .map((line) => ({
      indexStatus: line.slice(0, 1).trim() || null,
      workingTreeStatus: line.slice(1, 2).trim() || null,
      path: line.slice(3).trim() || line.trim()
    }));
  return {
    clean: entries.length === 0,
    dirtyCount: entries.filter((entry) => entry.indexStatus !== "?" || entry.workingTreeStatus !== "?")
      .length,
    untrackedCount: entries.filter((entry) => entry.indexStatus === "?" && entry.workingTreeStatus === "?")
      .length,
    conflictedCount: entries.filter((entry) => entry.indexStatus === "U" || entry.workingTreeStatus === "U")
      .length,
    ahead: null,
    behind: null,
    entries
  };
}
