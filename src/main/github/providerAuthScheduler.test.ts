import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Viewer } from "@shared/github";
import type { LocalStore } from "../storage";

const githubAuthMocks = vi.hoisted(() => ({
  clearGitHubToken: vi.fn(),
  getGitHubToken: vi.fn(),
  setGitHubToken: vi.fn(),
  validateGitHubToken: vi.fn(),
  pollGitHubDeviceAuthorization: vi.fn(),
  requestGitHubDeviceAuthorization: vi.fn()
}));

vi.mock("./credentials", () => ({
  clearGitHubToken: githubAuthMocks.clearGitHubToken,
  getGitHubToken: githubAuthMocks.getGitHubToken,
  setGitHubToken: githubAuthMocks.setGitHubToken
}));

vi.mock("./octokitProvider", () => ({
  OctokitProvider: class MockOctokitProvider {},
  validateGitHubToken: githubAuthMocks.validateGitHubToken
}));

vi.mock("./webOAuth", () => ({
  pollGitHubDeviceAuthorization: githubAuthMocks.pollGitHubDeviceAuthorization,
  requestGitHubDeviceAuthorization: githubAuthMocks.requestGitHubDeviceAuthorization
}));

import { GitHubProviderManager } from "./provider";

const viewer = {
  login: "octocat",
  name: "Octo Cat",
  avatarUrl: "https://github.com/images/error/octocat_happy.gif",
  htmlUrl: "https://github.com/octocat"
} satisfies Viewer;

const deviceAuthorization = {
  clientId: "client-id",
  deviceCode: "device-code",
  userCode: "WDJB-MJHT",
  verificationUri: "https://github.com/login/device",
  expiresAt: "2026-05-20T00:10:00.000Z",
  intervalSeconds: 1
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));

  githubAuthMocks.clearGitHubToken.mockReset().mockResolvedValue(undefined);
  githubAuthMocks.getGitHubToken.mockReset().mockResolvedValue(null);
  githubAuthMocks.setGitHubToken.mockReset().mockResolvedValue(undefined);
  githubAuthMocks.validateGitHubToken.mockReset().mockResolvedValue(viewer);
  githubAuthMocks.pollGitHubDeviceAuthorization.mockReset();
  githubAuthMocks.requestGitHubDeviceAuthorization.mockReset().mockResolvedValue(deviceAuthorization);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GitHubProviderManager device sign-in scheduling", () => {
  it("reschedules pending device authorization polls and completes on success", async () => {
    const store = createStore();
    const provider = new GitHubProviderManager(store);
    const openAuthorizeUrl = vi.fn().mockResolvedValue(undefined);

    githubAuthMocks.pollGitHubDeviceAuthorization
      .mockResolvedValueOnce({ status: "pending", intervalSeconds: 2 })
      .mockResolvedValueOnce({
        status: "success",
        token: { accessToken: "gho_token", tokenType: "bearer", scope: "repo" }
      });

    await expect(provider.signInWithBrowser(openAuthorizeUrl)).resolves.toMatchObject({
      status: "pending",
      userCode: "WDJB-MJHT"
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(2);
    expect(githubAuthMocks.setGitHubToken).toHaveBeenCalledWith("gho_token");
    expect(provider.getGitHubSignInState()).toEqual({
      status: "complete",
      userCode: "WDJB-MJHT",
      verificationUri: "https://github.com/login/device",
      expiresAt: "2026-05-20T00:10:00.000Z",
      error: null
    });
  });

  it("ignores a successful device authorization poll after cancellation", async () => {
    const store = createStore();
    const provider = new GitHubProviderManager(store);
    const openAuthorizeUrl = vi.fn().mockResolvedValue(undefined);
    const pendingPoll = deferred<{
      status: "success";
      token: { accessToken: string; tokenType: string; scope: string };
    }>();

    githubAuthMocks.pollGitHubDeviceAuthorization.mockReturnValueOnce(pendingPoll.promise);

    await provider.signInWithBrowser(openAuthorizeUrl);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(1);

    provider.cancelWebSignIn();
    pendingPoll.resolve({
      status: "success",
      token: { accessToken: "gho_token", tokenType: "bearer", scope: "repo" }
    });
    await pendingPoll.promise;

    expect(githubAuthMocks.setGitHubToken).not.toHaveBeenCalled();
    expect(githubAuthMocks.validateGitHubToken).not.toHaveBeenCalled();
    expect(provider.getGitHubSignInState()).toEqual({
      status: "cancelled",
      userCode: "WDJB-MJHT",
      verificationUri: "https://github.com/login/device",
      expiresAt: "2026-05-20T00:10:00.000Z",
      error: "GitHub sign-in was cancelled."
    });
  });

  it("retries transient device authorization poll failures", async () => {
    const store = createStore();
    const provider = new GitHubProviderManager(store);
    const openAuthorizeUrl = vi.fn().mockResolvedValue(undefined);

    githubAuthMocks.pollGitHubDeviceAuthorization
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        status: "success",
        token: { accessToken: "gho_token", tokenType: "bearer", scope: "repo" }
      });

    await provider.signInWithBrowser(openAuthorizeUrl);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(1);
    expect(provider.getGitHubSignInState()).toMatchObject({ status: "pending", error: null });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(2);
    expect(githubAuthMocks.setGitHubToken).toHaveBeenCalledWith("gho_token");
    expect(provider.getGitHubSignInState()).toMatchObject({ status: "complete", error: null });
  });

  it("fails expired device sign-in instead of polling after transient retries", async () => {
    const store = createStore();
    const provider = new GitHubProviderManager(store);
    const openAuthorizeUrl = vi.fn().mockResolvedValue(undefined);

    githubAuthMocks.requestGitHubDeviceAuthorization.mockResolvedValueOnce({
      ...deviceAuthorization,
      expiresAt: "2026-05-20T00:00:01.500Z"
    });
    githubAuthMocks.pollGitHubDeviceAuthorization.mockRejectedValueOnce(new TypeError("fetch failed"));

    await provider.signInWithBrowser(openAuthorizeUrl);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(githubAuthMocks.pollGitHubDeviceAuthorization).toHaveBeenCalledTimes(1);
    expect(provider.getGitHubSignInState()).toEqual({
      status: "error",
      userCode: "WDJB-MJHT",
      verificationUri: "https://github.com/login/device",
      expiresAt: "2026-05-20T00:00:01.500Z",
      error: "GitHub sign-in expired. Start it again."
    });
  });

  it("cancels scheduled device authorization polling on provider close", async () => {
    const store = createStore();
    const provider = new GitHubProviderManager(store);
    const openAuthorizeUrl = vi.fn().mockResolvedValue(undefined);

    await provider.signInWithBrowser(openAuthorizeUrl);
    provider.close();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(githubAuthMocks.pollGitHubDeviceAuthorization).not.toHaveBeenCalled();
    expect(provider.getGitHubSignInState()).toBeNull();
  });
});

function createStore(): LocalStore {
  return {
    updateSettings: vi.fn(),
    saveAccount: vi.fn()
  } as unknown as LocalStore;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
