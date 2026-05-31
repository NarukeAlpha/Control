import { describe, expect, it, vi } from "vitest";

import { createIpcInvokeRoute, registerIpcRoutes, sendIpcEvent, type IpcRoute } from "./ipcRouter";

function createIpcMain() {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      })
    }
  };
}

describe("ipcRouter", () => {
  it("registers invoke routes and calls handlers with validated input", async () => {
    const { ipcMain, handlers } = createIpcMain();
    const handler = vi.fn(async (input: { id: string }) => ({ id: input.id }));

    registerIpcRoutes(ipcMain, [
      createIpcInvokeRoute<{ id: string }, { id: string }>({
        channel: "test:invoke",
        parse: ([input]) => ({ id: String(input) }),
        handle: handler
      })
    ]);

    await expect(handlers.get("test:invoke")?.({}, "abc")).resolves.toEqual({ id: "abc" });
    expect(handler).toHaveBeenCalledWith({ id: "abc" }, {});
  });

  it("rejects duplicate channels before registering handlers", () => {
    const { ipcMain } = createIpcMain();
    const routes: IpcRoute[] = [
      createIpcInvokeRoute({
        channel: "test:duplicate",
        parse: () => undefined,
        handle: () => undefined
      }),
      {
        kind: "event",
        channel: "test:duplicate",
        parse: (payload) => payload
      }
    ];

    expect(() => registerIpcRoutes(ipcMain, routes)).toThrow(
      "Duplicate IPC channel registered: test:duplicate"
    );
    expect(ipcMain.handle).not.toHaveBeenCalled();
  });

  it("runs validation before handlers and skips handlers on validation failure", async () => {
    const { ipcMain, handlers } = createIpcMain();
    const handler = vi.fn();

    registerIpcRoutes(ipcMain, [
      createIpcInvokeRoute({
        channel: "test:validated",
        parse: () => {
          throw new Error("Invalid IPC input.");
        },
        handle: handler
      })
    ]);

    await expect(handlers.get("test:validated")?.({})).rejects.toThrow("Invalid IPC input.");
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not register event routes as invoke handlers", () => {
    const { ipcMain } = createIpcMain();

    registerIpcRoutes(ipcMain, [
      {
        kind: "event",
        channel: "test:event",
        parse: (payload) => payload
      }
    ]);

    expect(ipcMain.handle).not.toHaveBeenCalled();
  });

  it("sends event payloads through event routes", () => {
    const webContents = { send: vi.fn() };

    sendIpcEvent(
      webContents,
      {
        kind: "event",
        channel: "test:event",
        parse: (payload) => ({ payload })
      },
      { value: "value" }
    );

    expect(webContents.send).toHaveBeenCalledWith("test:event", { payload: { value: "value" } });
  });

  it("propagates handler errors", async () => {
    const { ipcMain, handlers } = createIpcMain();

    registerIpcRoutes(ipcMain, [
      createIpcInvokeRoute({
        channel: "test:error",
        parse: ([input]) => input,
        handle: () => {
          throw new Error("Handler failed.");
        }
      })
    ]);

    await expect(handlers.get("test:error")?.({}, "input")).rejects.toThrow("Handler failed.");
  });
});
