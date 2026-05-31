import { Cause, Effect, Exit, Option } from "effect";

export function runStorageSync<T>(operation: string, action: () => T): T {
  const exit = Effect.runSyncExit(
    Effect.try({
      try: action,
      catch: (cause) => cause
    }).pipe(Effect.annotateLogs({ operation }))
  );

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) {
    throw failure.value;
  }

  throw Cause.squash(exit.cause);
}
