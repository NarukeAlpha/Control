import { Cause, Effect, Exit, ManagedRuntime, Option } from "effect";

import type { ControlSettings } from "@shared/github";
import { ipcChannels } from "@shared/ipc";
import { requireExternalHttpsUrl } from "../externalLinks";
import { BackendFailure, backendFailureToError, isBackendFailure, sanitizedUnexpectedError } from "./errors";
import {
  ExternalLinkServiceTag,
  LocalStoreService,
  type AppServices,
  type BackendLoggerService
} from "./services";

export const effectIpcCancellationPolicy =
  "Renderer unmounts do not cancel a main-process Effect invocation in this pilot slice.";

export interface EffectIpcBridge<R = AppServices> {
  run<A, E>(effect: Effect.Effect<A, E, R>): Promise<A>;
}

export interface IpcRegistrar {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export function createEffectIpcBridge<R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  logger?: BackendLoggerService
): EffectIpcBridge<R> {
  return {
    run: (effect) => runIpcEffect(runtime, effect, logger)
  };
}

export async function runIpcEffect<A, E, R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  effect: Effect.Effect<A, E, R>,
  logger?: BackendLoggerService
): Promise<A> {
  const exit = await runtime.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw ipcErrorFromCause(exit.cause, logger);
}

export function registerEffectPilotIpc(registrar: IpcRegistrar, bridge: EffectIpcBridge): void {
  registrar.handle(ipcChannels.getSettings, () => bridge.run(getSettingsEffect()));
  registrar.handle(ipcChannels.openExternal, (_event, url: unknown) => bridge.run(openExternalEffect(url)));
}

export function getSettingsEffect(): Effect.Effect<ControlSettings, BackendFailure, LocalStoreService> {
  return Effect.gen(function* () {
    const store = yield* LocalStoreService;
    return yield* Effect.try({
      try: () => store.getSettings(),
      catch: (cause) =>
        new BackendFailure({
          code: "STORE_READ_FAILED",
          message: "Control could not read settings.",
          details: { cause: describeCause(cause) }
        })
    });
  });
}

export function openExternalEffect(
  url: unknown
): Effect.Effect<void, BackendFailure, ExternalLinkServiceTag> {
  return Effect.gen(function* () {
    const href = yield* Effect.try({
      try: () => requireExternalHttpsUrl(url),
      catch: (cause) =>
        new BackendFailure({
          code: "INVALID_EXTERNAL_URL",
          message: cause instanceof Error ? cause.message : "Control only opens external HTTPS links."
        })
    });
    const externalLinks = yield* ExternalLinkServiceTag;
    return yield* Effect.tryPromise({
      try: () => externalLinks.openExternal(href),
      catch: (cause) =>
        new BackendFailure({
          code: "OPEN_EXTERNAL_FAILED",
          message: "Control could not open the external link.",
          details: { cause: describeCause(cause), url: href }
        })
    });
  });
}

function ipcErrorFromCause<E>(cause: Cause.Cause<E>, logger?: BackendLoggerService): Error {
  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure) && isBackendFailure(failure.value)) {
    return backendFailureToError(failure.value);
  }

  const defects = Cause.defects(cause);
  logger?.error("Unexpected Effect IPC failure.", {
    failure: Option.isSome(failure) ? failure.value : null,
    defects: Array.from(defects),
    cause: Cause.pretty(cause)
  });

  return sanitizedUnexpectedError();
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string") {
    return cause;
  }
  return "Unknown failure";
}
