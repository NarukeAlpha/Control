import { describe, expect, it, vi } from "vitest";

import type { GitHubMutationInput } from "@shared/github";
import { githubIpcRouteChannels } from "@shared/ipc";
import {
  createGithubIpcRoutes,
  registeredGithubIpcRouteKeys,
  registerGithubIpc,
  requireGitHubMutationInput,
  requireRepoListInput
} from "./registerGithubIpc";

describe("registerGithubIpc", () => {
  it("registers the first GitHub router slice on the typed route channels", async () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      })
    };
    const github = {
      listRepositoriesWithStatus: vi.fn(async () => ({
        items: [],
        availability: { status: "available", message: null } as const
      })),
      mutate: vi.fn(async (input: GitHubMutationInput) => ({
        ok: true,
        action: input.action,
        message: "ok"
      }))
    };

    registerGithubIpc(ipcMain, github);

    expect([...handlers.keys()]).toEqual([
      githubIpcRouteChannels.listRepositoriesWithStatus,
      githubIpcRouteChannels.mutate
    ]);
    await handlers.get(githubIpcRouteChannels.listRepositoriesWithStatus)?.(null, { limit: 10 });
    await handlers.get(githubIpcRouteChannels.mutate)?.(null, {
      action: "star",
      owner: "NarukeAlpha",
      repo: "t3code"
    });

    expect(github.listRepositoriesWithStatus).toHaveBeenCalledWith({
      limit: 10,
      cacheOnly: undefined,
      forceRefresh: undefined
    });
    expect(github.mutate).toHaveBeenCalledWith({
      action: "star",
      owner: "NarukeAlpha",
      repo: "t3code"
    });
  });

  it("keeps registered route keys in parity with the shared route map", () => {
    const routes = createGithubIpcRoutes({
      listRepositoriesWithStatus: vi.fn(async () => ({
        items: [],
        availability: { status: "available", message: null } as const
      })),
      mutate: vi.fn(async (input: GitHubMutationInput) => ({
        ok: true,
        action: input.action,
        message: "ok"
      }))
    });

    expect(registeredGithubIpcRouteKeys.map((key) => githubIpcRouteChannels[key])).toEqual(
      routes.map((route) => route.channel)
    );
  });

  it("validates repository list inputs before calling the provider", () => {
    expect(requireRepoListInput(undefined)).toEqual({});
    expect(requireRepoListInput({ limit: 25, cacheOnly: true, forceRefresh: false })).toEqual({
      limit: 25,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(() => requireRepoListInput(null)).toThrow("Repository list input must be an object.");
    expect(() => requireRepoListInput([])).toThrow("Repository list input must be an object.");
    expect(() => requireRepoListInput({ limit: "25" })).toThrow(
      "Repository list limit must be a positive integer."
    );
    expect(() => requireRepoListInput({ cacheOnly: "true" })).toThrow(
      "Repository list cacheOnly must be a boolean."
    );
  });

  it("validates mutation inputs before calling the provider", () => {
    expect(
      requireGitHubMutationInput({
        action: "createIssue",
        owner: " owner ",
        repo: " repo ",
        title: "Flat issue",
        labels: ["bug"]
      })
    ).toEqual({
      action: "createIssue",
      owner: "owner",
      repo: "repo",
      title: "Flat issue",
      labels: ["bug"]
    });
    expect(
      requireGitHubMutationInput({
        action: "createIssue",
        owner: " owner ",
        repo: " repo ",
        title: "Flat issue",
        payload: { title: "Issue" }
      })
    ).toEqual({
      action: "createIssue",
      owner: "owner",
      repo: "repo",
      title: "Issue"
    });
    expect(() => requireGitHubMutationInput(null)).toThrow("GitHub mutation input must be an object.");
    expect(() => requireGitHubMutationInput({ action: "createIssue", repo: "repo" })).toThrow(
      "GitHub mutation owner is required."
    );
    expect(() =>
      requireGitHubMutationInput({
        action: "starRepository",
        owner: "owner",
        repo: "repo"
      })
    ).toThrow("Unsupported GitHub mutation action.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createIssue",
        owner: "owner",
        repo: "repo",
        payload: []
      })
    ).toThrow("GitHub mutation payload must be an object when provided.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createIssue",
        owner: "owner",
        repo: "repo",
        body: "x".repeat(128_001)
      })
    ).toThrow("GitHub mutation payload is too large.");
  });
});
