import { afterEach, describe, expect, it, vi } from "vitest";

describe("GitHub credential storage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("keytar");
    vi.restoreAllMocks();
  });

  it("uses keytar when the module exports functions on the namespace", async () => {
    const keytar = {
      getPassword: vi.fn().mockResolvedValue("gho_namespace"),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true)
    };

    vi.doMock("keytar", () => keytar);

    const { getGitHubToken, setGitHubToken, clearGitHubToken } = await import("./credentials");

    await expect(getGitHubToken()).resolves.toBe("gho_namespace");
    await expect(setGitHubToken("gho_namespace")).resolves.toBeUndefined();
    await expect(clearGitHubToken()).resolves.toBeUndefined();

    expect(keytar.getPassword).toHaveBeenCalledWith("Control GitHub Token", "github.com");
    expect(keytar.setPassword).toHaveBeenCalledWith("Control GitHub Token", "github.com", "gho_namespace");
    expect(keytar.deletePassword).toHaveBeenCalledWith("Control GitHub Token", "github.com");
  });

  it("uses keytar when the module exports functions under default", async () => {
    const keytar = {
      getPassword: vi.fn().mockResolvedValue("gho_default"),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true)
    };

    vi.doMock("keytar", () => ({ default: keytar }));

    const { getGitHubToken, setGitHubToken, clearGitHubToken } = await import("./credentials");

    await expect(getGitHubToken()).resolves.toBe("gho_default");
    await expect(setGitHubToken("gho_default")).resolves.toBeUndefined();
    await expect(clearGitHubToken()).resolves.toBeUndefined();

    expect(keytar.getPassword).toHaveBeenCalledWith("Control GitHub Token", "github.com");
    expect(keytar.setPassword).toHaveBeenCalledWith("Control GitHub Token", "github.com", "gho_default");
    expect(keytar.deletePassword).toHaveBeenCalledWith("Control GitHub Token", "github.com");
  });

  it("returns null when no GitHub token is stored", async () => {
    const keytar = {
      getPassword: vi.fn().mockResolvedValue(null),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true)
    };

    vi.doMock("keytar", () => keytar);

    const { getGitHubToken } = await import("./credentials");

    await expect(getGitHubToken()).resolves.toBeNull();
    expect(keytar.getPassword).toHaveBeenCalledWith("Control GitHub Token", "github.com");
  });

  it("throws a typed error when the keychain cannot be read", async () => {
    const keytar = {
      getPassword: vi.fn().mockRejectedValue(new Error("native keychain unavailable")),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true)
    };

    vi.doMock("keytar", () => keytar);

    const { getGitHubToken, GitHubCredentialStoreUnavailableError } = await import("./credentials");

    await expect(getGitHubToken()).rejects.toEqual(
      expect.objectContaining({
        name: "GitHubCredentialStoreUnavailableError",
        code: "github-credential-store-unavailable",
        message: "native keychain unavailable"
      })
    );
    await expect(getGitHubToken()).rejects.toBeInstanceOf(GitHubCredentialStoreUnavailableError);
  });
});
