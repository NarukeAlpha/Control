import { afterEach, describe, expect, it, vi } from "vitest";

describe("gateway credential storage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("keytar");
    vi.restoreAllMocks();
  });

  it("stores gateway API and admin credentials in keytar accounts scoped by Area", async () => {
    const keytar = {
      getPassword: vi.fn().mockResolvedValueOnce("api-token").mockResolvedValueOnce("admin-token"),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true)
    };

    vi.doMock("keytar", () => keytar);

    const { getGatewayCredentials, setGatewayCredentials, clearGatewayCredentials } =
      await import("./gatewayCredentials");

    await expect(getGatewayCredentials("local:control")).resolves.toEqual({
      apiToken: "api-token",
      adminToken: "admin-token"
    });
    await expect(
      setGatewayCredentials("local:control", { apiToken: "api-token", adminToken: "admin-token" })
    ).resolves.toBeUndefined();
    await expect(clearGatewayCredentials("local:control")).resolves.toBeUndefined();

    expect(keytar.getPassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:api"
    );
    expect(keytar.getPassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:admin"
    );
    expect(keytar.setPassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:api",
      "api-token"
    );
    expect(keytar.setPassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:admin",
      "admin-token"
    );
    expect(keytar.deletePassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:api"
    );
    expect(keytar.deletePassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:admin"
    );
  });

  it("fails typed when keytar is unavailable", async () => {
    vi.doMock("keytar", () => {
      throw new Error("missing native keychain");
    });

    const { getGatewayCredentials, gatewayCredentialsUnavailable } = await import("./gatewayCredentials");

    await expect(getGatewayCredentials("local:control")).rejects.toMatchObject({
      code: "gateway-credentials-unavailable"
    });
    await getGatewayCredentials("local:control").catch((error) => {
      expect(gatewayCredentialsUnavailable(error)).toBe(true);
    });
  });
});
