import {
  githubActions,
  type GitHubAction,
  GitHubMutationInput,
  GitHubMutationResult,
  RepoListInput,
  RepositoryListResult
} from "@shared/github";
import { githubIpcRouteChannels } from "@shared/ipc";

import {
  createIpcInvokeRoute,
  registerIpcRoutes,
  type IpcInvokeRoute,
  type IpcMainHandleTarget
} from "./ipcRouter";

interface GitHubIpcDependencies {
  listRepositoriesWithStatus(input: RepoListInput): Promise<RepositoryListResult>;
  mutate(input: GitHubMutationInput): Promise<GitHubMutationResult>;
}

export const registeredGithubIpcRouteKeys = ["listRepositoriesWithStatus", "mutate"] as const;

const githubActionSet = new Set<string>(githubActions);
const maxMutationPayloadBytes = 128_000;

export function registerGithubIpc(ipcMain: IpcMainHandleTarget, github: GitHubIpcDependencies): void {
  registerIpcRoutes(ipcMain, createGithubIpcRoutes(github));
}

export function createGithubIpcRoutes(github: GitHubIpcDependencies): IpcInvokeRoute[] {
  return [
    createIpcInvokeRoute<RepoListInput, RepositoryListResult>({
      channel: githubIpcRouteChannels.listRepositoriesWithStatus,
      parse: ([input]) => requireRepoListInput(input),
      handle: (input) => github.listRepositoriesWithStatus(input)
    }),
    createIpcInvokeRoute<GitHubMutationInput, GitHubMutationResult>({
      channel: githubIpcRouteChannels.mutate,
      parse: ([input]) => requireGitHubMutationInput(input),
      handle: (input) => github.mutate(input)
    })
  ];
}

export function requireRepoListInput(input: unknown = {}): RepoListInput {
  if (input === undefined) {
    return {};
  }
  if (!isRecord(input)) {
    throw new Error("Repository list input must be an object.");
  }

  return {
    limit: optionalInteger(input.limit, "Repository list limit must be a positive integer."),
    cacheOnly: optionalBoolean(input.cacheOnly, "Repository list cacheOnly must be a boolean."),
    forceRefresh: optionalBoolean(input.forceRefresh, "Repository list forceRefresh must be a boolean.")
  };
}

export function requireGitHubMutationInput(input: unknown): GitHubMutationInput {
  if (!isRecord(input)) {
    throw new Error("GitHub mutation input must be an object.");
  }

  const action = requireTrimmedString(input.action, "GitHub mutation action is required.");
  if (!githubActionSet.has(action)) {
    throw new Error("Unsupported GitHub mutation action.");
  }
  const owner = requireTrimmedString(input.owner, "GitHub mutation owner is required.");
  const repo = requireTrimmedString(input.repo, "GitHub mutation repository is required.");
  const { action: _action, owner: _owner, repo: _repo, payload: legacyPayload, ...flatPayload } = input;
  if (legacyPayload !== undefined && !isRecord(legacyPayload)) {
    throw new Error("GitHub mutation payload must be an object when provided.");
  }
  const payload = {
    ...flatPayload,
    ...(legacyPayload ?? {})
  };
  const payloadBytes = JSON.stringify(payload).length;
  if (payloadBytes > maxMutationPayloadBytes) {
    throw new Error("GitHub mutation payload is too large.");
  }

  return {
    ...payload,
    action: action as GitHubAction,
    owner,
    repo
  } as GitHubMutationInput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireTrimmedString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

function optionalBoolean(value: unknown, message: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
  return value;
}

function optionalInteger(value: unknown, message: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
  return value;
}
