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

import type { AreaManager } from "./areaManager";

export function registerAreaIpc(areaManager: AreaManager): void {
  ipcMain.handle(ipcChannels.areasList, () => areaManager.listAreas());
  ipcMain.handle(ipcChannels.areasGet, (_event, areaId: string) =>
    areaManager.getArea(requireString(areaId))
  );
  ipcMain.handle(ipcChannels.areasSelect, (_event, areaId: string) =>
    areaManager.selectArea(requireString(areaId))
  );
  ipcMain.handle(ipcChannels.areasCreateLocal, (_event, input: CreateLocalAreaInput) =>
    areaManager.createLocalArea(requireCreateLocalAreaInput(input))
  );
  ipcMain.handle(ipcChannels.areasCreateSsh, (_event, input: CreateSshAreaInput) =>
    areaManager.createSshArea(requireCreateSshAreaInput(input))
  );
  ipcMain.handle(ipcChannels.areasUpdate, (_event, input: UpdateAreaInput) =>
    areaManager.updateArea(requireUpdateAreaInput(input))
  );
  ipcMain.handle(ipcChannels.areasRemove, (_event, areaId: string) =>
    areaManager.removeArea(requireString(areaId))
  );
  ipcMain.handle(ipcChannels.areasRefresh, (_event, areaId: string) =>
    areaManager.refreshArea(requireString(areaId))
  );
  ipcMain.handle(ipcChannels.areasSearch, (_event, input: AreaSearchInput) =>
    areaManager.searchAreas(requireAreaSearchInput(input))
  );
  ipcMain.handle(ipcChannels.areaRepositories, (_event, input: ListAreaRepositoriesInput) =>
    areaManager.listRepositories(requireListRepositoriesInput(input))
  );
  ipcMain.handle(ipcChannels.areaRepository, (_event, input: AreaRepositoryInput) =>
    areaManager.getRepository(requireRepositoryInput(input))
  );
  ipcMain.handle(ipcChannels.areaContents, (_event, input: AreaContentsInput) =>
    areaManager.listContents(requireContentsInput(input))
  );
  ipcMain.handle(ipcChannels.areaFileContent, (_event, input: AreaFileContentInput) =>
    areaManager.getFileContent(requireFileContentInput(input))
  );
  ipcMain.handle(ipcChannels.areaBranches, (_event, input: AreaRefInput) =>
    areaManager.listBranches(requireRefInput(input))
  );
  ipcMain.handle(ipcChannels.areaRemotes, (_event, input: AreaRepositoryInput) =>
    areaManager.listRemotes(requireRepositoryInput(input))
  );
  ipcMain.handle(ipcChannels.areaStatus, (_event, input: AreaRepositoryInput) =>
    areaManager.getStatus(requireRepositoryInput(input))
  );
  ipcMain.handle(ipcChannels.areaActivity, (_event, input: AreaRefInput) =>
    areaManager.listActivity(requireRefInput(input))
  );
  ipcMain.handle(ipcChannels.areaWorkspaces, (_event, input: ListAreaWorkspacesInput) =>
    areaManager.listWorkspaces(requireWorkspacesInput(input))
  );
  ipcMain.handle(ipcChannels.areaWorkspace, (_event, input: { areaId: string; workspaceId: string }) =>
    areaManager.getWorkspace({
      areaId: requireString(input?.areaId),
      workspaceId: requireString(input?.workspaceId)
    })
  );
  ipcMain.handle(ipcChannels.areaGitHubRepository, (_event, input: AreaGitHubRepositoryInput) =>
    areaManager.getGitHubRepository(requireAreaGitHubRepositoryInput(input))
  );
  ipcMain.handle(ipcChannels.areaGitHubIssues, (_event, input: AreaGitHubIssuesInput) =>
    areaManager.listGitHubIssues(requireAreaGitHubIssuesInput(input))
  );
  ipcMain.handle(ipcChannels.areaGitHubPullRequests, (_event, input: AreaGitHubPullRequestsInput) =>
    areaManager.listGitHubPullRequests(requireAreaGitHubPullRequestsInput(input))
  );
  ipcMain.handle(ipcChannels.areaGitHubActions, (_event, input: AreaGitHubListInput) =>
    areaManager.listGitHubActions(requireAreaGitHubListInput(input))
  );
  ipcMain.handle(ipcChannels.areaGitHubReleases, (_event, input: AreaGitHubListInput) =>
    areaManager.listGitHubReleases(requireAreaGitHubListInput(input))
  );
  ipcMain.handle(ipcChannels.areaGitHubContributors, (_event, input: AreaGitHubListInput) =>
    areaManager.listGitHubContributors(requireAreaGitHubListInput(input))
  );
  ipcMain.handle(ipcChannels.areaSyncStatus, (_event, input) =>
    areaManager.getSyncStatus(requireSyncStatusInput(input))
  );
  ipcMain.handle(ipcChannels.areaPrepareGatewayOperation, (_event, input: AreaGatewayOperationInput) =>
    areaManager.prepareGatewayOperation(requireGatewayOperationInput(input))
  );
  ipcMain.handle(ipcChannels.areaRunGatewayOperation, (_event, input: AreaGatewayRunOperationInput) =>
    areaManager.runGatewayOperation(requireRunGatewayOperationInput(input))
  );
  ipcMain.handle(ipcChannels.areaStopGateway, (_event, input: StopAreaGatewayInput) =>
    areaManager.stopGateway({ areaId: requireString(input?.areaId) })
  );
  ipcMain.handle(ipcChannels.areaOpenLocalFolderPicker, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
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
