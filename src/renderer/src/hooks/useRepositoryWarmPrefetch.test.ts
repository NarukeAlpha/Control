import { describe, expect, it, vi } from "vitest";

import { runRepositoryWarmPrefetchQueue, type RepositoryWarmPrefetchTask } from "./useRepositoryWarmPrefetch";

describe("runRepositoryWarmPrefetchQueue", () => {
  it("runs repository warmup tasks sequentially", async () => {
    const order: string[] = [];
    const tasks: RepositoryWarmPrefetchTask[] = [
      vi.fn(async () => {
        order.push("code:start");
        await Promise.resolve();
        order.push("code:end");
      }),
      vi.fn(async () => {
        order.push("issues:start");
        await Promise.resolve();
        order.push("issues:end");
      }),
      vi.fn(async () => {
        order.push("pulls:start");
        await Promise.resolve();
        order.push("pulls:end");
      })
    ];

    await runRepositoryWarmPrefetchQueue(tasks);

    expect(order).toEqual([
      "code:start",
      "code:end",
      "issues:start",
      "issues:end",
      "pulls:start",
      "pulls:end"
    ]);
  });

  it("keeps warming later surfaces when one hidden prefetch fails", async () => {
    const order: string[] = [];
    const tasks: RepositoryWarmPrefetchTask[] = [
      vi.fn(async () => {
        order.push("code");
      }),
      vi.fn(async () => {
        order.push("issues");
        throw new Error("rate limited");
      }),
      vi.fn(async () => {
        order.push("pulls");
      })
    ];

    await expect(runRepositoryWarmPrefetchQueue(tasks)).resolves.toBeUndefined();

    expect(order).toEqual(["code", "issues", "pulls"]);
  });

  it("stops before the next task when the route warmup is cancelled", async () => {
    const order: string[] = [];
    let active = true;
    const tasks: RepositoryWarmPrefetchTask[] = [
      vi.fn(async () => {
        order.push("code");
        active = false;
      }),
      vi.fn(async () => {
        order.push("issues");
      })
    ];

    await runRepositoryWarmPrefetchQueue(tasks, () => active);

    expect(order).toEqual(["code"]);
    expect(tasks[1]).not.toHaveBeenCalled();
  });
});
