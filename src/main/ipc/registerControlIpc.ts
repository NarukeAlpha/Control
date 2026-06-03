import { dialog, shell, type IpcMain } from "electron";

import type { AreaUpdatedEvent } from "@shared/areas";
import type { ControlSettings } from "@shared/github";
import { ipcChannels } from "@shared/ipc";
import type {
  LocalRecentListInput,
  LocalRecentMetadata,
  LocalRecentRecordInput,
  RepositoryPinRecord
} from "@shared/local";
import type {
  ControlExportInput,
  ControlExportScope,
  ControlImportApplyInput,
  ControlImportInput
} from "@shared/sync";
import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import { registerEffectPilotIpc, type EffectIpcBridge } from "../effect/ipcBridge";
import { openExternalHttps } from "../externalLinks";
import { createControlExportPreview, normalizeControlExportScope } from "../storage/exportPreview";
import {
  applyControlImport,
  createControlImportPreview,
  writeControlExportArchive
} from "../storage/exportArchive";
import { nullableTrimmedString, optionalBoolean, requireRecord, requireTrimmedString } from "./ipcInput";
import { createIpcInvokeRoute, registerIpcRoutes, type IpcInvokeRoute } from "./ipcRouter";
import { createGithubIpcRoutes } from "./registerGithubIpc";

interface RegisterControlIpcInput {
  ipcMain: Pick<IpcMain, "handle">;
  store: LocalStore;
  github: GitHubProviderManager;
  effectBridge: EffectIpcBridge;
  onSettingsUpdated?: (settings: ControlSettings) => void;
  onAreasUpdated?: (event: AreaUpdatedEvent) => void;
}

export function registerControlIpc({
  ipcMain,
  store,
  github,
  effectBridge,
  onSettingsUpdated,
  onAreasUpdated
}: RegisterControlIpcInput): void {
  registerEffectPilotIpc(ipcMain, effectBridge);
  registerIpcRoutes(ipcMain, createControlIpcRoutes({ store, github, onSettingsUpdated, onAreasUpdated }));
}

export function createControlIpcRoutes({
  store,
  github,
  onSettingsUpdated,
  onAreasUpdated
}: Pick<
  RegisterControlIpcInput,
  "store" | "github" | "onSettingsUpdated" | "onAreasUpdated"
>): IpcInvokeRoute[] {
  return [
    controlRoute<void, ReturnType<GitHubProviderManager["createAppState"]>>({
      channel: ipcChannels.appState,
      parse: () => undefined,
      handle: () => github.createAppState()
    }),
    controlRoute<Partial<ControlSettings>, ReturnType<LocalStore["updateSettings"]>>({
      channel: ipcChannels.updateSettings,
      parse: ([settings]) =>
        requireRecordInput<Partial<ControlSettings>>(settings, "Settings update input must be an object."),
      handle: (settings) => {
        const mergedSettings = store.updateSettings(settings);
        onSettingsUpdated?.(mergedSettings);
        return mergedSettings;
      }
    }),
    controlRoute<void, ReturnType<GitHubProviderManager["signInWithBrowser"]>>({
      channel: ipcChannels.signInWithGitHub,
      parse: () => undefined,
      handle: () => github.signInWithBrowser((url) => openExternalHttps(url, shell))
    }),
    controlRoute<void, ReturnType<GitHubProviderManager["getGitHubSignInState"]>>({
      channel: ipcChannels.getGitHubSignIn,
      parse: () => undefined,
      handle: () => github.getGitHubSignInState()
    }),
    controlRoute<void, void>({
      channel: ipcChannels.cancelGitHubSignIn,
      parse: () => undefined,
      handle: () => {
        github.cancelWebSignIn();
      }
    }),
    controlRoute<void, Promise<Awaited<ReturnType<GitHubProviderManager["createAppState"]>>>>({
      channel: ipcChannels.clearGitHubToken,
      parse: () => undefined,
      handle: async () => {
        await github.clearToken();
        return github.createAppState();
      }
    }),
    controlRoute<void, ReturnType<LocalStore["listPinnedRepositories"]>>({
      channel: ipcChannels.listPinnedRepositories,
      parse: () => undefined,
      handle: () => store.listPinnedRepositories()
    }),
    controlRoute<string, ReturnType<LocalStore["listPinnedRepositories"]>>({
      channel: ipcChannels.pinRepository,
      parse: ([input]) => requireRepositoryPinInput(input),
      handle: (nameWithOwner) => {
        store.pinRepository(nameWithOwner);
        return store.listPinnedRepositories();
      }
    }),
    controlRoute<string, ReturnType<LocalStore["listPinnedRepositories"]>>({
      channel: ipcChannels.unpinRepository,
      parse: ([input]) => requireRepositoryPinInput(input),
      handle: (nameWithOwner) => {
        store.unpinRepository(nameWithOwner);
        return store.listPinnedRepositories();
      }
    }),
    controlRoute<void, ReturnType<LocalStore["listAreaRepositoryPins"]>>({
      channel: ipcChannels.listRepositoryPins,
      parse: () => undefined,
      handle: () => store.listAreaRepositoryPins()
    }),
    controlRoute<RepositoryPinRecord, ReturnType<LocalStore["listAreaRepositoryPins"]>>({
      channel: ipcChannels.pinAreaRepository,
      parse: ([input]) => requireAreaRepositoryPinInput(input),
      handle: (pin) => {
        store.pinAreaRepository(pin);
        return store.listAreaRepositoryPins();
      }
    }),
    controlRoute<RepositoryPinRecord, ReturnType<LocalStore["listAreaRepositoryPins"]>>({
      channel: ipcChannels.unpinAreaRepository,
      parse: ([input]) => requireAreaRepositoryPinInput(input),
      handle: (pin) => {
        store.unpinAreaRepository(pin);
        return store.listAreaRepositoryPins();
      }
    }),
    controlRoute<LocalRecentListInput, ReturnType<LocalStore["listRecentItems"]>>({
      channel: ipcChannels.listRecentItems,
      parse: ([input]) => requireRecentListInput(input),
      handle: (input) => store.listRecentItems(input)
    }),
    controlRoute<LocalRecentRecordInput, ReturnType<LocalStore["listRecentItems"]>>({
      channel: ipcChannels.recordRecentItem,
      parse: ([input]) => requireRecentRecordInput(input),
      handle: (recent) => {
        store.addRecentItem(recent.kind, recent.provider ?? "github", recent.itemKey, recent);
        return store.listRecentItems({ limit: 12 });
      }
    }),
    controlRoute<ControlExportScope, ReturnType<typeof createControlExportPreview>>({
      channel: ipcChannels.previewDataExport,
      parse: ([input]) => requireControlExportScope(input),
      handle: (scope) => createControlExportPreview(store, scope)
    }),
    controlRoute<ControlExportInput, ReturnType<typeof writeControlExportArchive>>({
      channel: ipcChannels.exportData,
      parse: ([input]) => requireControlExportInput(input),
      handle: async (input) => {
        const destinationPath = input.destinationPath ?? (await chooseExportDestination());
        return writeControlExportArchive(store, { ...input, destinationPath });
      }
    }),
    controlRoute<ControlImportInput, ReturnType<typeof createControlImportPreview>>({
      channel: ipcChannels.previewDataImport,
      parse: ([input]) => requireControlImportInput(input),
      handle: async (input) => {
        const filePath = input.filePath ?? (await chooseImportSource());
        return filePath ? createControlImportPreview({ filePath }) : createControlImportPreview({});
      }
    }),
    controlRoute<ControlImportApplyInput, ReturnType<typeof applyControlImport>>({
      channel: ipcChannels.importData,
      parse: ([input]) => requireControlImportApplyInput(input),
      handle: async (input) => {
        const filePath = input.filePath ?? (await chooseImportSource());
        const result = await applyControlImport(store, { ...input, filePath });
        if (result.emittedEvents.includes("settings-updated")) {
          onSettingsUpdated?.(store.getSettings());
        }
        if (result.emittedEvents.includes("areas-updated")) {
          onAreasUpdated?.({ areaId: null });
        }
        return result;
      }
    }),

    ...createGithubIpcRoutes(github)
  ];
}

function controlRoute<TInput, TOutput>(route: {
  channel: string;
  parse: (args: readonly unknown[]) => TInput;
  handle: (input: TInput) => TOutput;
}): IpcInvokeRoute {
  return createIpcInvokeRoute<TInput, TOutput>(route);
}

function requireRecordInput<TInput extends object>(input: unknown, message: string): TInput {
  return requireRecord<TInput>(input, message);
}

function requireRepositoryPinInput(input: unknown): string {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Repository pins require an owner/repo name."
  );
  if (typeof record.nameWithOwner !== "string") {
    throw new Error("Repository pins require an owner/repo name.");
  }

  const nameWithOwner = record.nameWithOwner.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(nameWithOwner)) {
    throw new Error("Repository pins require an owner/repo name.");
  }

  return nameWithOwner;
}

function requireAreaRepositoryPinInput(input: unknown): RepositoryPinRecord {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Area repository pins require a repository payload."
  );

  const areaId = optionalTrimmedText(record.areaId);
  const repositoryId = optionalTrimmedText(record.repositoryId);
  const workspaceId = optionalTrimmedText(record.workspaceId);
  const nameWithOwner = optionalTrimmedText(record.nameWithOwner);
  if (!areaId || !repositoryId) {
    throw new Error("Area repository pins require an Area id and repository id.");
  }
  if (nameWithOwner && !/^[^/\s]+\/[^/\s]+$/.test(nameWithOwner)) {
    throw new Error("Area repository GitHub names must use owner/repo format.");
  }

  return {
    areaId,
    repositoryId,
    workspaceId,
    nameWithOwner,
    createdAt: null
  };
}

function requireRecentListInput(input: unknown = {}): LocalRecentListInput {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Recent items list input must be an object."
  );
  return {
    kind: record.kind ? requireRecentKind(record.kind) : undefined,
    limit: normalizeLocalLimit(record.limit)
  };
}

function requireRecentRecordInput(input: unknown): LocalRecentRecordInput {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Recent items require a GitHub item payload."
  );

  const kind = requireRecentKind(record.kind);
  const provider = record.provider === "local" ? "local" : "github";
  const itemKey = requireTrimmedText(record.itemKey, "Recent items require an item key.");
  const title = requireTrimmedText(record.title, "Recent items require a title.");
  const subtitle = optionalTrimmedText(record.subtitle);
  const repositoryNameWithOwner = optionalTrimmedText(record.repositoryNameWithOwner);
  const areaId = optionalTrimmedText(record.areaId);
  const repositoryId = optionalTrimmedText(record.repositoryId);
  const workspaceId = optionalTrimmedText(record.workspaceId);
  const url = optionalTrimmedText(record.url);
  if (url && !url.startsWith("https://")) {
    throw new Error("Recent item URLs must be HTTPS links.");
  }

  return {
    kind,
    provider,
    itemKey,
    title,
    subtitle,
    repositoryNameWithOwner,
    areaId,
    repositoryId,
    workspaceId,
    url,
    metadata: sanitizeRecentMetadata(record.metadata)
  };
}

function requireControlExportScope(input: unknown): ControlExportScope {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Control export preview input must be an object."
  );
  const booleanFields = [
    "settings",
    "areas",
    "pins",
    "recents",
    "githubMetadataCache",
    "areaCache",
    "snapshots",
    "includeLocalPaths",
    "includePrivateRepositoryMetadata"
  ] as const satisfies ReadonlyArray<keyof ControlExportScope>;
  const parsed: Partial<ControlExportScope> = {};
  for (const field of booleanFields) {
    if (record[field] !== undefined) {
      parsed[field] = optionalBoolean(record[field], `Control export ${field} must be a boolean.`);
    }
  }
  return normalizeControlExportScope(parsed);
}

function requireControlImportInput(input: unknown): ControlImportInput {
  if (input === undefined) {
    return { filePath: null };
  }
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Control import preview input must be an object."
  );
  if (record.filePath !== undefined && record.filePath !== null && typeof record.filePath !== "string") {
    throw new Error("Control import file path must be a string.");
  }
  if (typeof record.filePath === "string" && !record.filePath.trim()) {
    throw new Error("Control import preview requires a file path.");
  }
  return {
    filePath: optionalTrimmedText(record.filePath)
  };
}

function requireControlExportInput(input: unknown): ControlExportInput {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Control export input must be an object."
  );
  if (
    record.destinationPath !== undefined &&
    record.destinationPath !== null &&
    typeof record.destinationPath !== "string"
  ) {
    throw new Error("Control export destination path must be a string.");
  }
  if (typeof record.destinationPath === "string" && !record.destinationPath.trim()) {
    throw new Error("Control export destination path must not be blank.");
  }
  return {
    scope: requireControlExportScope(record.scope),
    destinationPath: optionalTrimmedText(record.destinationPath)
  };
}

function requireControlImportApplyInput(input: unknown): ControlImportApplyInput {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "Control import input must be an object."
  );
  return {
    ...requireControlImportInput(record),
    confirmed: optionalBoolean(record.confirmed, "Control import confirmation must be a boolean.") ?? false
  };
}

function requireRecentKind(kind: unknown): LocalRecentRecordInput["kind"] {
  if (
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
  ) {
    return kind;
  }

  throw new Error("Recent items require a supported GitHub item kind.");
}

function requireTrimmedText(value: unknown, message: string): string {
  return requireTrimmedString(value, message);
}

function optionalTrimmedText(value: unknown): string | null {
  return nullableTrimmedString(value);
}

function normalizeLocalLimit(limit: unknown): number {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.trunc(limit)))
    : 12;
}

function sanitizeRecentMetadata(metadata: unknown): LocalRecentMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.entries(metadata as Record<string, unknown>).reduce<LocalRecentMetadata>(
    (acc, [key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );
}

async function chooseExportDestination(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: "Export Control data",
    defaultPath: `control-export-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "Control export", extensions: ["json"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"]
  });
  return result.canceled ? null : (result.filePath ?? null);
}

async function chooseImportSource(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: "Import Control data",
    filters: [{ name: "Control export", extensions: ["json"] }],
    properties: ["openFile"]
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}
