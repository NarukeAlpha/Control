import { afterEach, describe, expect, it, vi } from "vitest";

import type { AreaGatewayRecord } from "../storage";
import { GatewayClient } from "./gatewayClient";

describe("GatewayClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a gateway API token", () => {
    expect(() => new GatewayClient(gatewayRecord(), "")).toThrow("Gateway API token is unavailable.");
  });

  it("sends the API token on GraphQL requests", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { repositories: [] } })
    }));
    vi.stubGlobal("fetch", fetch);

    await expect(new GatewayClient(gatewayRecord(), "api-token").listRepositories()).resolves.toEqual([]);

    expect(fetch).toHaveBeenCalledWith(
      new URL("/graphql", "http://127.0.0.1:4580"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer api-token"
        })
      })
    );
  });
});

function gatewayRecord(): AreaGatewayRecord {
  return {
    areaId: "local:control",
    rootPath: "/work/control",
    transport: "local",
    host: null,
    username: null,
    port: null,
    apiUrl: "http://127.0.0.1:4580",
    adminUrl: "http://127.0.0.1:4581",
    serviceName: "control-gateway-local-control",
    version: "0.1.0",
    status: "ready",
    pid: 42,
    processId: 42,
    failureCode: null,
    message: null,
    installedAt: "2026-05-24T00:00:00.000Z",
    lastStartedAt: "2026-05-24T00:00:01.000Z",
    lastSeenAt: "2026-05-24T00:00:02.000Z",
    updatedAt: "2026-05-24T00:00:03.000Z"
  };
}
