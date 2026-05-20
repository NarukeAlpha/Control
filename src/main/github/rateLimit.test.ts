import { describe, expect, it, vi } from "vitest";

import { GitHubRequestLimiter, retryDelayMs, shouldRetryGitHubRequest } from "./rateLimit";

describe("GitHubRequestLimiter", () => {
  it("shares concurrency across queued GitHub requests", async () => {
    let active = 0;
    let maxActive = 0;
    const release: Array<() => void> = [];
    const limiter = new GitHubRequestLimiter({ maxConcurrency: 2 });
    const request = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          release.push(() => {
            active -= 1;
            resolve("ok");
          });
        })
    );

    const results = Promise.all([limiter.run(request), limiter.run(request), limiter.run(request)]);

    expect(request).toHaveBeenCalledTimes(2);
    release.shift()?.();
    await waitForRequestCount(request, 3);
    expect(request).toHaveBeenCalledTimes(3);
    release.shift()?.();
    release.shift()?.();

    await expect(results).resolves.toEqual(["ok", "ok", "ok"]);
    expect(maxActive).toBe(2);
  });

  it("retries retryable rate-limit failures and respects retry-after", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const limiter = new GitHubRequestLimiter({ maxConcurrency: 1, maxRetries: 1, sleep });
    const request = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("secondary rate limit"), { status: 429, headers: { "retry-after": "2" } })
      )
      .mockResolvedValueOnce("ok");

    await expect(limiter.run(request)).resolves.toBe("ok");

    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("does not retry permanent auth or not-found failures", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const limiter = new GitHubRequestLimiter({ maxConcurrency: 1, maxRetries: 2, sleep });
    const unauthorized = Object.assign(new Error("bad credentials"), { status: 401 });
    const notFound = Object.assign(new Error("not found"), { status: 404 });

    await expect(limiter.run(() => Promise.reject(unauthorized))).rejects.toBe(unauthorized);
    await expect(limiter.run(() => Promise.reject(notFound))).rejects.toBe(notFound);

    expect(sleep).not.toHaveBeenCalled();
  });

  it("classifies primary and secondary rate-limit errors", () => {
    expect(shouldRetryGitHubRequest(Object.assign(new Error("rate limit"), { status: 403 }))).toBe(true);
    expect(
      shouldRetryGitHubRequest(
        Object.assign(new Error("forbidden"), { status: 403, headers: { "x-ratelimit-remaining": "0" } })
      )
    ).toBe(true);
    expect(shouldRetryGitHubRequest(Object.assign(new Error("forbidden"), { status: 403 }))).toBe(false);
    expect(shouldRetryGitHubRequest(Object.assign(new Error("not found"), { status: 404 }))).toBe(false);
  });

  it("parses retry delay from response headers", () => {
    expect(
      retryDelayMs({
        response: {
          headers: {
            "retry-after": "3"
          }
        }
      })
    ).toBe(3_000);
  });
});

async function waitForRequestCount(request: ReturnType<typeof vi.fn>, count: number): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (request.mock.calls.length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
