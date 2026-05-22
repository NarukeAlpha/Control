import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ControlSettings } from "@shared/github";
import { ipcChannels } from "@shared/ipc";
import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import { createAppRuntime } from "./appLayer";
import { BackendFailure } from "./errors";
import {
  createEffectIpcBridge,
  effectIpcCancellationPolicy,
  getSettingsEffect,
  openExternalEffect,
  registerEffectPilotIpc,
  runIpcEffect
} from "./ipcBridge";
import {
  BackendLoggerServiceTag,
  ExternalLinkServiceTag,
  GitHubManagerService,
  LocalStoreService,
  type AppServices
} from "./services";

const settings: ControlSettings = {
  credentialProvider: "github-oauth",
  glassMode: "glass-shell"
};

function createRuntime(overrides: Partial<LocalStore> = {}, openExternal = vi.fn(async () => undefined)) {
  const store = {
    getSettings: vi.fn(() => settings),
    ...overrides
  } as unknown as LocalStore;
  const layer = Layer.mergeAll(
    Layer.succeed(LocalStoreService, store),
    Layer.succeed(GitHubManagerService, {} as GitHubProviderManager),
    Layer.succeed(ExternalLinkServiceTag, { openExternal }),
    Layer.succeed(BackendLoggerServiceTag, { error: vi.fn() })
  );
  return { runtime: ManagedRuntime.make(layer), store, openExternal };
}

async function rejectionOf(action: () => Promise<unknown>): Promise<Error & { code?: string }> {
  try {
    await action();
  } catch (error) {
    return error as Error & { code?: string };
  }
  throw new Error("Expected action to reject.");
}

describe("Effect IPC bridge", () => {
  it("returns success payloads unchanged", async () => {
    const { runtime } = createRuntime();
    const payload = { ok: true };

    await expect(runIpcEffect(runtime, Effect.succeed(payload))).resolves.toBe(payload);
  });

  it("maps tagged failures to deterministic native Error instances", async () => {
    const { runtime } = createRuntime();

    const error = await rejectionOf(() =>
      runIpcEffect(
        runtime,
        Effect.fail(
          new BackendFailure({
            code: "INVALID_EXTERNAL_URL",
            message: "Control only opens external HTTPS links.",
            details: { input: "http://example.test" }
          })
        )
      )
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "INVALID_EXTERNAL_URL",
      code: "INVALID_EXTERNAL_URL",
      message: "Control only opens external HTTPS links.",
      details: { input: "http://example.test" }
    });
    expect((error as { _tag?: unknown })._tag).toBeUndefined();
  });

  it("sanitizes defects while logging backend diagnostic detail", async () => {
    const { runtime } = createRuntime();
    const logger = { error: vi.fn() };

    const error = await rejectionOf(() =>
      runIpcEffect(runtime, Effect.die(new Error("database secret")), logger)
    );

    expect(error).toMatchObject({
      name: "UNEXPECTED_EFFECT_FAILURE",
      code: "UNEXPECTED_EFFECT_FAILURE",
      message: "Control could not complete the request."
    });
    expect(error.message).not.toContain("database secret");
    expect(logger.error).toHaveBeenCalledWith(
      "Unexpected Effect IPC failure.",
      expect.objectContaining({ cause: expect.stringContaining("database secret") })
    );
  });

  it("sanitizes unknown failed values while logging the original value", async () => {
    const { runtime } = createRuntime();
    const logger = { error: vi.fn() };

    const error = await rejectionOf(() =>
      runIpcEffect(runtime, Effect.fail({ raw: "not ipc safe" }), logger)
    );

    expect(error.code).toBe("UNEXPECTED_EFFECT_FAILURE");
    expect(logger.error).toHaveBeenCalledWith(
      "Unexpected Effect IPC failure.",
      expect.objectContaining({ failure: { raw: "not ipc safe" } })
    );
  });

  it("runs getSettings through the LocalStore service", async () => {
    const { runtime, store } = createRuntime();

    await expect(runIpcEffect(runtime, getSettingsEffect())).resolves.toEqual(settings);

    expect(store.getSettings).toHaveBeenCalledTimes(1);
  });

  it.each([
    "http://github.com/NarukeAlpha/t3code",
    " https://github.com/NarukeAlpha/t3code",
    "/NarukeAlpha/t3code",
    "//github.com/NarukeAlpha/t3code",
    "not a url"
  ])("rejects unsafe openExternal input before the opener runs: %s", async (input) => {
    const { runtime, openExternal } = createRuntime();

    const error = await rejectionOf(() => runIpcEffect(runtime, openExternalEffect(input)));

    expect(error.code).toBe("INVALID_EXTERNAL_URL");
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("registers pilot channels without exposing duplicate direct handlers", async () => {
    const { runtime, openExternal } = createRuntime();
    const bridge = createEffectIpcBridge(runtime);
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();

    registerEffectPilotIpc(
      {
        handle: (channel, listener) => {
          if (handlers.has(channel)) {
            throw new Error(`Duplicate handler: ${channel}`);
          }
          handlers.set(channel, listener);
        }
      },
      bridge
    );

    await expect(handlers.get(ipcChannels.getSettings)?.(null)).resolves.toEqual(settings);
    await expect(
      handlers.get(ipcChannels.openExternal)?.(null, "https://github.com/NarukeAlpha/t3code")
    ).resolves.toBeUndefined();
    expect(openExternal).toHaveBeenCalledWith("https://github.com/NarukeAlpha/t3code");
  });

  it("documents the pilot cancellation policy", () => {
    expect(effectIpcCancellationPolicy).toContain("Renderer unmounts do not cancel");
  });
});

describe("AppLayer runtime", () => {
  it("is created once and can be reused for multiple IPC invocations", async () => {
    const makeRuntime = vi.fn((layer: Layer.Layer<AppServices>) => ManagedRuntime.make(layer));
    const store = { getSettings: vi.fn(() => settings) } as unknown as LocalStore;
    const runtime = createAppRuntime(
      {
        store,
        github: {} as GitHubProviderManager,
        externalLinks: { openExternal: vi.fn(async () => undefined) },
        logger: { error: vi.fn() }
      },
      makeRuntime as unknown as typeof ManagedRuntime.make
    );
    const bridge = createEffectIpcBridge(runtime);

    await bridge.run(getSettingsEffect());
    await bridge.run(getSettingsEffect());

    expect(makeRuntime).toHaveBeenCalledTimes(1);
    expect(store.getSettings).toHaveBeenCalledTimes(2);
  });
});
