import { describe, expect, it, vi } from "vitest";

import { GitHubRequestDedupe } from "./requestDedupe";

describe("GitHubRequestDedupe", () => {
  it("shares the active request for matching keys", async () => {
    const dedupe = new GitHubRequestDedupe();
    const load = vi.fn().mockResolvedValue("result");

    await expect(Promise.all([dedupe.run("key", load), dedupe.run("key", load)])).resolves.toEqual([
      "result",
      "result"
    ]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("removes completed requests before a later call", async () => {
    const dedupe = new GitHubRequestDedupe();
    const load = vi.fn().mockResolvedValue("result");

    await dedupe.run("key", load);
    await dedupe.run("key", load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalidates regular and force-prefixed keys", async () => {
    const dedupe = new GitHubRequestDedupe();
    const release: Array<() => void> = [];
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release.push(() => resolve("result"));
        })
    );

    void dedupe.run("issues:owner/repo", load);
    void dedupe.run("force:issues:owner/repo", load);
    dedupe.invalidatePrefix("issues:owner/repo");
    void dedupe.run("issues:owner/repo", load);

    expect(load).toHaveBeenCalledTimes(3);
    release.forEach((resolve) => resolve());
  });
});
