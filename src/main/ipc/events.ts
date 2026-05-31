import type { WebContents } from "electron";

import { ipcChannels, type GitHubAuthUpdatedEvent, type GitHubRepositoriesUpdatedEvent } from "@shared/ipc";
import type { AreaRepositoryUpdatedEvent, AreaUpdatedEvent, AreaWorkspaceUpdatedEvent } from "@shared/areas";
import { sendIpcEvent, type IpcEventRoute } from "./ipcRouter";

export const mainToRendererEvents = {
  githubRepositoriesUpdated: {
    kind: "event",
    channel: ipcChannels.githubRepositoriesUpdated,
    parse: (payload: GitHubRepositoriesUpdatedEvent) => payload
  },
  githubAuthUpdated: {
    kind: "event",
    channel: ipcChannels.githubAuthUpdated,
    parse: (payload: GitHubAuthUpdatedEvent) => payload
  },
  areasUpdated: {
    kind: "event",
    channel: ipcChannels.areasUpdated,
    parse: (payload: AreaUpdatedEvent) => payload
  },
  areaRepositoryUpdated: {
    kind: "event",
    channel: ipcChannels.areaRepositoryUpdated,
    parse: (payload: AreaRepositoryUpdatedEvent) => payload
  },
  areaWorkspaceUpdated: {
    kind: "event",
    channel: ipcChannels.areaWorkspaceUpdated,
    parse: (payload: AreaWorkspaceUpdatedEvent) => payload
  }
} as const;

interface MainToRendererEventPayloads {
  githubRepositoriesUpdated: GitHubRepositoriesUpdatedEvent;
  githubAuthUpdated: GitHubAuthUpdatedEvent;
  areasUpdated: AreaUpdatedEvent;
  areaRepositoryUpdated: AreaRepositoryUpdatedEvent;
  areaWorkspaceUpdated: AreaWorkspaceUpdatedEvent;
}

export function sendMainToRendererEvent<TKey extends keyof typeof mainToRendererEvents>(
  webContents: Pick<WebContents, "send"> | null | undefined,
  key: TKey,
  payload: MainToRendererEventPayloads[TKey]
): void {
  if (!webContents) {
    return;
  }
  sendIpcEvent(
    webContents,
    mainToRendererEvents[key] as IpcEventRoute<MainToRendererEventPayloads[TKey]>,
    payload
  );
}
