import { Duration, Effect, Fiber, Schedule } from "effect";

export type DeviceSignInPollHandler<TRecord extends object> = (record: TRecord) => void | Promise<void>;

interface ScheduledDeviceSignInPoll<TRecord extends object> {
  record: TRecord;
  fiber: Fiber.RuntimeFiber<void, never> | null;
}

export class DeviceSignInPollScheduler<TRecord extends object> {
  private active: ScheduledDeviceSignInPoll<TRecord> | null = null;

  constructor(private readonly poll: DeviceSignInPollHandler<TRecord>) {}

  start(record: TRecord, intervalMs: number): boolean {
    this.cancel();
    this.active = { record, fiber: null };
    return this.reschedule(record, intervalMs);
  }

  reschedule(record: TRecord, intervalMs: number): boolean {
    const active = this.active;
    if (!active || active.record !== record) {
      return false;
    }

    this.interrupt(active);
    active.fiber = this.schedule(record, intervalMs);

    return true;
  }

  cancel(record?: TRecord): boolean {
    const active = this.active;
    if (!active || (record && active.record !== record)) {
      return false;
    }

    this.interrupt(active);

    this.active = null;
    return true;
  }

  isCurrent(record: TRecord): boolean {
    return this.active?.record === record;
  }

  private schedule(record: TRecord, intervalMs: number): Fiber.RuntimeFiber<void, never> {
    return Effect.runFork(
      Effect.gen(this, function* () {
        const driver = yield* Schedule.driver(Schedule.fromDelay(Duration.millis(intervalMs)));
        yield* driver.next(undefined);

        const active = this.active;
        if (!active || active.record !== record) {
          return;
        }

        active.fiber = null;
        yield* Effect.promise(() => Promise.resolve(this.poll(record)));
      }).pipe(Effect.catchAllCause(() => Effect.void))
    );
  }

  private interrupt(active: ScheduledDeviceSignInPoll<TRecord>): void {
    const fiber = active.fiber;
    if (!fiber) {
      return;
    }

    active.fiber = null;
    Effect.runFork(Fiber.interruptFork(fiber));
  }
}
