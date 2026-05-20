import type { IpcMainInvokeEvent, WebContents } from "electron";

export type IpcRouteParser<TInput> = (args: readonly unknown[]) => TInput;
export interface IpcRouteHandler<TInput, TOutput> {
  (input: TInput, event: IpcMainInvokeEvent): Promise<TOutput> | TOutput;
}

export interface IpcInvokeRoute {
  kind: "invoke";
  channel: string;
  parse: IpcRouteParser<unknown>;
  handle: IpcRouteHandler<unknown, unknown>;
}

export interface IpcEventRoute<TPayload = unknown> {
  kind: "event";
  channel: string;
  parse: (payload: TPayload) => unknown;
}

export type IpcRoute = IpcInvokeRoute | IpcEventRoute<unknown>;

export interface IpcMainHandleTarget {
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown
  ): void;
}

export function registerIpcRoutes(ipcMain: IpcMainHandleTarget, routes: readonly IpcRoute[]): void {
  assertUniqueChannels(routes);

  routes.forEach((route) => {
    if (route.kind !== "invoke") {
      return;
    }

    ipcMain.handle(route.channel, async (event, ...args) => {
      const input = route.parse(args);
      return route.handle(input, event);
    });
  });
}

export function createIpcInvokeRoute<TInput, TOutput>(route: {
  channel: string;
  parse: IpcRouteParser<TInput>;
  handle: IpcRouteHandler<TInput, TOutput>;
}): IpcInvokeRoute {
  return {
    kind: "invoke",
    channel: route.channel,
    parse: route.parse,
    handle: (input, event) => route.handle(input as TInput, event)
  };
}

export function sendIpcEvent<TPayload>(
  webContents: Pick<WebContents, "send">,
  route: IpcEventRoute<TPayload>,
  payload: TPayload
): void {
  webContents.send(route.channel, route.parse(payload));
}

function assertUniqueChannels(routes: readonly IpcRoute[]): void {
  const seen = new Set<string>();
  routes.forEach((route) => {
    if (seen.has(route.channel)) {
      throw new Error(`Duplicate IPC channel registered: ${route.channel}`);
    }
    seen.add(route.channel);
  });
}
