import { afterEach, describe, expect, it, vi } from "vitest";

import { DeviceSignInPollScheduler } from "./deviceSignInScheduler";

afterEach(() => {
  vi.useRealTimers();
});

describe("DeviceSignInPollScheduler", () => {
  it("runs the active poll after the configured interval", async () => {
    vi.useFakeTimers();
    const poll = vi.fn();
    const scheduler = new DeviceSignInPollScheduler(poll);
    const record = { id: "current" };

    expect(scheduler.start(record, 1_000)).toBe(true);

    await vi.advanceTimersByTimeAsync(999);
    expect(poll).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(poll).toHaveBeenCalledWith(record);
  });

  it("rejects stale reschedules and stale cancellation", async () => {
    vi.useFakeTimers();
    const poll = vi.fn();
    const scheduler = new DeviceSignInPollScheduler(poll);
    const stale = { id: "stale" };
    const current = { id: "current" };

    expect(scheduler.start(stale, 1_000)).toBe(true);
    expect(scheduler.start(current, 2_000)).toBe(true);

    expect(scheduler.reschedule(stale, 1)).toBe(false);
    expect(scheduler.cancel(stale)).toBe(false);
    expect(scheduler.isCurrent(current)).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenCalledWith(current);
  });

  it("cancels the active poll", async () => {
    vi.useFakeTimers();
    const poll = vi.fn();
    const scheduler = new DeviceSignInPollScheduler(poll);
    const record = { id: "current" };

    scheduler.start(record, 1_000);
    expect(scheduler.cancel(record)).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(poll).not.toHaveBeenCalled();
    expect(scheduler.isCurrent(record)).toBe(false);
  });
});
