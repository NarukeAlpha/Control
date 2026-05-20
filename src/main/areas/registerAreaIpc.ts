import { dialog, ipcMain } from "electron";

import type {
  AreaContentsInput,
  AreaFileContentInput,
  AreaGatewayOperationInput,
  AreaGatewayRunOperationInput,
  AreaGitHubIssuesInput,
  AreaGitHubListInput,
  AreaGitHubPullRequestsInput,
  AreaGitHubRepositoryInput,
  AreaRefInput,
  AreaRepositoryInput,
  AreaSearchInput,
  CreateLocalAreaInput,
  CreateSshAreaInput,
  ListAreaRepositoriesInput,
  ListAreaWorkspacesInput,
  StopAreaGatewayInput,
  UpdateAreaInput
} from "@shared/areas";
import { ipcChannels } from "@shared/ipc";

import { createIpcInvokeRoute, registerIpcRoutes, type IpcInvokeRoute } from "../ipc/ipcRouter";
import type { AreaManager } from "./areaManager";

export function registerAreaIpc(areaManager: AreaManager): void {
  registerIpcRoutes(ipcMain, createAreaIpcRoutes(areaManager));
}

export function createAreaIpcRoutes(areaManager: AreaManager): IpcInvokeRoute[] {
  return [
    createIpcInvokeRoute<void, ReturnType<AreaManager["listAreas"]>>({
      channel: ipcChannels.areasList,
      parse: () => undefined,
      handle: () => areaManager.listAreas()
    }),
    areaRoute<string, ReturnType<AreaManager["getArea"]>>(
      ipcChannels.areasGet,
      ([areaId]) => requireString(areaId),
      (input) => areaManager.getArea(input)
    ),
    areaRoute<string, ReturnType<AreaManager["selectArea"]>>(
      ipcChannels.areasSelect,
      ([areaId]) => requireString(areaId),
      (input) => areaManager.selectArea(input)
    ),
    areaRoute<CreateLocalAreaInput, ReturnType<AreaManager["createLocalArea"]>>(
      ipcChannels.areasCreateLocal,
      ([input]) => requireCreateLocalAreaInput(input as CreateLocalAreaInput),
      (input) => areaManager.createLocalArea(input)
    ),
    areaRoute<CreateSshAreaInput, ReturnType<AreaManager["createSshArea"]>>(
      ipcChannels.areasCreateSsh,
      ([input]) => requireCreateSshAreaInput(input as CreateSshAreaInput),
      (input) => areaManager.createSshArea(input)
    ),
    areaRoute<UpdateAreaInput, ReturnType<AreaManager["updateArea"]>>(
      ipcChannels.areasUpdate,
      ([input]) => requireUpdateAreaInput(input as UpdateAreaInput),
      (input) => areaManager.updateArea(input)
    ),
    areaRoute<string, ReturnType<AreaManager["removeArea"]>>(
      ipcChannels.areasRemove,
      ([areaId]) => requireString(areaId),
      (input) => areaManager.removeArea(input)
    ),
    areaRoute<string, ReturnType<AreaManager["refreshArea"]>>(
      ipcChannels.areasRefresh,
      ([areaId]) => requireString(areaId),
      (input) => areaManager.refreshArea(input)
    ),
    areaRoute<AreaSearchInput, ReturnType<AreaManager["searchAreas"]>>(
      ipcChannels.areasSearch,
      ([input]) => requireAreaSearchInput(input as AreaSearchInput),
      (input) => areaManager.searchAreas(input)
    ),
    areaRoute<ListAreaRepositoriesInput, ReturnType<AreaManager["listRepositories"]>>(
      ipcChannels.areaRepositories,
      ([input]) => requireListRepositoriesInput(input as ListAreaRepositoriesInput),
      (input) => areaManager.listRepositories(input)
    ),
    areaRoute<AreaRepositoryInput, ReturnType<AreaManager["getRepository"]>>(
      ipcChannels.areaRepository,
      ([input]) => requireRepositoryInput(input as AreaRepositoryInput),
      (input) => areaManager.getRepository(input)
    ),
    areaRoute<AreaContentsInput, ReturnType<AreaManager["listContents"]>>(
      ipcChannels.areaContents,
      ([input]) => requireContentsInput(input as AreaContentsInput),
      (input) => areaManager.listContents(input)
    ),
    areaRoute<AreaFileContentInput, ReturnType<AreaManager["getFileContent"]>>(
      ipcChannels.areaFileContent,
      ([input]) => requireFileContentInput(input as AreaFileContentInput),
      (input) => areaManager.getFileContent(input)
    ),
    areaRoute<AreaRefInput, ReturnType<AreaManager["listBranches"]>>(
      ipcChannels.areaBranches,
      ([input]) => requireRefInput(input as AreaRefInput),
      (input) => areaManager.listBranches(input)
    ),
    areaRoute<AreaRepositoryInput, ReturnType<AreaManager["listRemotes"]>>(
      ipcChannels.areaRemotes,
      ([input]) => requireRepositoryInput(input as AreaRepositoryInput),
      (input) => areaManager.listRemotes(input)
    ),
    areaRoute<AreaRepositoryInput, ReturnType<AreaManager["getStatus"]>>(
      ipcChannels.areaStatus,
      ([input]) => requireRepositoryInput(input as AreaRepositoryInput),
      (input) => areaManager.getStatus(input)
    ),
    areaRoute<AreaRefInput, ReturnType<AreaManager["listActivity"]>>(
      ipcChannels.areaActivity,
      ([input]) => requireRefInput(input as AreaRefInput),
      (input) => areaManager.listActivity(input)
    ),
    areaRoute<ListAreaWorkspacesInput, ReturnType<AreaManager["listWorkspaces"]>>(
      ipcChannels.areaWorkspaces,
      ([input]) => requireWorkspacesInput(input as ListAreaWorkspacesInput),
      (input) => areaManager.listWorkspaces(input)
    ),
    areaRoute<{ areaId: string; workspaceId: string }, ReturnType<AreaManager["getWorkspace"]>>(
      ipcChannels.areaWorkspace,
      ([input]) => ({
        areaId: requireString((input as { areaId?: unknown } | null | undefined)?.areaId),
        workspaceId: requireString((input as { workspaceId?: unknown } | null | undefined)?.workspaceId)
      }),
      (input) => areaManager.getWorkspace(input)
    ),
    areaRoute<AreaGitHubRepositoryInput, ReturnType<AreaManager["getGitHubRepository"]>>(
      ipcChannels.areaGitHubRepository,
      ([input]) => requireAreaGitHubRepositoryInput(input as AreaGitHubRepositoryInput),
      (input) => areaManager.getGitHubRepository(input)
    ),
    areaRoute<AreaGitHubIssuesInput, ReturnType<AreaManager["listGitHubIssues"]>>(
      ipcChannels.areaGitHubIssues,
      ([input]) => requireAreaGitHubIssuesInput(input as AreaGitHubIssuesInput),
      (input) => areaManager.listGitHubIssues(input)
    ),
    areaRoute<AreaGitHubPullRequestsInput, ReturnType<AreaManager["listGitHubPullRequests"]>>(
      ipcChannels.areaGitHubPullRequests,
      ([input]) => requireAreaGitHubPullRequestsInput(input as AreaGitHubPullRequestsInput),
      (input) => areaManager.listGitHubPullRequests(input)
    ),
    areaRoute<AreaGitHubListInput, ReturnType<AreaManager["listGitHubActions"]>>(
      ipcChannels.areaGitHubActions,
      ([input]) => requireAreaGitHubListInput(input as AreaGitHubListInput),
      (input) => areaManager.listGitHubActions(input)
    ),
    areaRoute<AreaGitHubListInput, ReturnType<AreaManager["listGitHubReleases"]>>(
      ipcChannels.areaGitHubReleases,
      ([input]) => requireAreaGitHubListInput(input as AreaGitHubListInput),
      (input) => areaManager.listGitHubReleases(input)
    ),
    areaRoute<AreaGitHubListInput, ReturnType<AreaManager["listGitHubContributors"]>>(
      ipcChannels.areaGitHubContributors,
      ([input]) => requireAreaGitHubListInput(input as AreaGitHubListInput),
      (input) => areaManager.listGitHubContributors(input)
    ),
    areaRoute<AreaRepositoryInput, ReturnType<AreaManager["getSyncStatus"]>>(
      ipcChannels.areaSyncStatus,
      ([input]) => requireSyncStatusInput(input as AreaRepositoryInput),
      (input) => areaManager.getSyncStatus(input)
    ),
    areaRoute<AreaGatewayOperationInput, ReturnType<AreaManager["prepareGatewayOperation"]>>(
      ipcChannels.areaPrepareGatewayOperation,
      ([input]) => requireGatewayOperationInput(input as AreaGatewayOperationInput),
      (input) => areaManager.prepareGatewayOperation(input)
    ),
    areaRoute<AreaGatewayRunOperationInput, ReturnType<AreaManager["runGatewayOperation"]>>(
      ipcChannels.areaRunGatewayOperation,
      ([input]) => requireRunGatewayOperationInput(input as AreaGatewayRunOperationInput),
      (input) => areaManager.runGatewayOperation(input)
    ),
    areaRoute<StopAreaGatewayInput, ReturnType<AreaManager["stopGateway"]>>(
      ipcChannels.areaStopGateway,
      ([input]) => ({
        areaId: requireString((input as StopAreaGatewayInput | null | undefined)?.areaId)
      }),
      (input) => areaManager.stopGateway(input)
    ),
    createIpcInvokeRoute<void, Promise<string | null>>({
      channel: ipcChannels.areaOpenLocalFolderPicker,
      parse: () => undefined,
      handle: async () => {
        const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
        return result.canceled ? null : (result.filePaths[0] ?? null);
      }
    })
  ];
}

function areaRoute<TInput, TOutput>(
  channel: string,
  parse: (args: readonly unknown[]) => TInput,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return createIpcInvokeRoute<TInput, TOutput>({
    channel,
    parse,
    handle
  });
}

function requireCreateLocalAreaInput(input: CreateLocalAreaInput): CreateLocalAreaInput {
  return {
    rootPath: requireString(input?.rootPath),
    label: typeof input?.label === "string" ? input.label.trim() : null
  };
}

function requireCreateSshAreaInput(input: CreateSshAreaInput): CreateSshAreaInput {
  return {
    host: requireString(input?.host),
    rootPath: requireString(input?.rootPath),
    label: typeof input?.label === "string" ? input.label.trim() : null,
    username: optionalString(input?.username),
    port:
      typeof input?.port === "number" && Number.isInteger(input.port) && input.port > 0 ? input.port : null
  };
}

function requireUpdateAreaInput(input: UpdateAreaInput): UpdateAreaInput {
  const value = (input ?? {}) as Partial<UpdateAreaInput>;
  return {
    areaId: requireString(value.areaId),
    label:
      "label" in value && typeof value.label === "string"
        ? value.label.trim()
        : value.label === null
          ? null
          : undefined,
    rootPath:
      "rootPath" in value && typeof value.rootPath === "string"
        ? value.rootPath.trim()
        : value.rootPath === null
          ? null
          : undefined,
    host:
      "host" in value && typeof value.host === "string"
        ? value.host.trim()
        : value.host === null
          ? null
          : undefined,
    username: "username" in value ? optionalString(value.username) : undefined,
    port:
      "port" in value
        ? typeof value.port === "number" && Number.isInteger(value.port) && value.port > 0
          ? value.port
          : null
        : undefined
  };
}

function requireAreaSearchInput(input: AreaSearchInput): AreaSearchInput {
  return {
    query: typeof input?.query === "string" ? input.query : "",
    limit: typeof input?.limit === "number" ? input.limit : undefined
  };
}

function requireListRepositoriesInput(input: ListAreaRepositoriesInput): ListAreaRepositoriesInput {
  return { areaId: requireString(input?.areaId), limit: input?.limit };
}

function requireRepositoryInput(input: AreaRepositoryInput): AreaRepositoryInput {
  return {
    areaId: requireString(input?.areaId),
    repositoryId: requireString(input?.repositoryId),
    workspaceId: optionalString(input?.workspaceId)
  };
}

function requireContentsInput(input: AreaContentsInput): AreaContentsInput {
  return { ...requireRepositoryInput(input), path: optionalString(input?.path) };
}

function requireFileContentInput(input: AreaFileContentInput): AreaFileContentInput {
  return { ...requireRepositoryInput(input), path: requireString(input?.path) };
}

function requireRefInput(input: AreaRefInput): AreaRefInput {
  return { ...requireRepositoryInput(input), limit: input?.limit };
}

function requireWorkspacesInput(input: ListAreaWorkspacesInput): ListAreaWorkspacesInput {
  return {
    areaId: requireString(input?.areaId),
    repositoryId: optionalString(input?.repositoryId)
  };
}

function requireAreaGitHubRepositoryInput(input: AreaGitHubRepositoryInput): AreaGitHubRepositoryInput {
  return {
    ...requireRepositoryInput(input),
    cacheOnly: typeof input?.cacheOnly === "boolean" ? input.cacheOnly : undefined,
    forceRefresh: typeof input?.forceRefresh === "boolean" ? input.forceRefresh : undefined
  };
}

function requireAreaGitHubIssuesInput(input: AreaGitHubIssuesInput): AreaGitHubIssuesInput {
  return {
    ...requireAreaGitHubRepositoryInput(input),
    state: requireGitHubListState(input?.state),
    limit: input?.limit
  };
}

function requireAreaGitHubPullRequestsInput(input: AreaGitHubPullRequestsInput): AreaGitHubPullRequestsInput {
  return {
    ...requireAreaGitHubRepositoryInput(input),
    state: requireGitHubListState(input?.state),
    limit: input?.limit
  };
}

function requireAreaGitHubListInput(input: AreaGitHubListInput): AreaGitHubListInput {
  return { ...requireAreaGitHubRepositoryInput(input), limit: input?.limit };
}

function requireSyncStatusInput(input: AreaRepositoryInput): AreaRepositoryInput {
  return requireRepositoryInput(input);
}

function requireGatewayOperationInput(input: AreaGatewayOperationInput): AreaGatewayOperationInput {
  return {
    ...requireRepositoryInput(input),
    kind: requireOperationKind(input?.kind),
    arguments: objectRecord(input?.arguments)
  };
}

function requireRunGatewayOperationInput(input: AreaGatewayRunOperationInput): AreaGatewayRunOperationInput {
  return {
    areaId: requireString(input?.areaId),
    operationId: requireString(input?.operationId),
    confirmed: input?.confirmed === true
  };
}

function requireGitHubListState(value: unknown): "open" | "closed" | "all" | undefined {
  return value === "open" || value === "closed" || value === "all" ? value : undefined;
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Area IPC input requires a non-empty string.");
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireOperationKind(value: unknown): AreaGatewayOperationInput["kind"] {
  const allowed = new Set<AreaGatewayOperationInput["kind"]>([
    "git.fetch",
    "git.pull",
    "git.push",
    "git.commit",
    "git.branch.create",
    "git.branch.checkout",
    "jj.git.fetch",
    "jj.git.push",
    "jj.new",
    "jj.describe",
    "jj.commit",
    "jj.bookmark.create",
    "jj.bookmark.move",
    "jj.undo",
    "jj.redo"
  ]);
  if (!allowed.has(value as AreaGatewayOperationInput["kind"])) {
    throw new Error("Gateway operation kind is not supported.");
  }
  return value as AreaGatewayOperationInput["kind"];
}

function objectRecord(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean" ||
      entry === null
    ) {
      output[key] = entry;
    }
  }
  return output;
}
