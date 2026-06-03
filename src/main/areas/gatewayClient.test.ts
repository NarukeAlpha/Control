import { afterEach, describe, expect, it, vi } from "vitest";

import type { AreaGatewayOperationKind } from "@shared/areas";
import type { AreaGatewayRecord } from "../storage";
import { GatewayClient } from "./gatewayClient";
import { areaGatewayOperationKinds, gatewayOperationInput } from "./gatewayOperations";

describe("GatewayClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a gateway API token", () => {
    expect(() => new GatewayClient(gatewayRecord(), "")).toThrow("Gateway API token is unavailable.");
  });

  it("sends the API token on GraphQL requests", async () => {
    const fetch = vi.fn(async (_input: URL, _init?: RequestInit) => ({
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

  it("maps only gateway-supported operations to GraphQL inputs", () => {
    const inputFor = (kind: AreaGatewayOperationKind) =>
      gatewayOperationInput({
        areaId: "local:control",
        repositoryId: "repo:control",
        kind
      });

    expect(inputFor("git.fetch")).toEqual({ repository: "repo:control", vcs: "GIT", operation: "FETCH" });
    expect(inputFor("git.push")).toEqual({ repository: "repo:control", vcs: "GIT", operation: "PUSH" });
    expect(inputFor("jj.git.fetch")).toEqual({
      repository: "repo:control",
      vcs: "JJ",
      operation: "FETCH"
    });
    expect(inputFor("jj.git.push")).toEqual({ repository: "repo:control", vcs: "JJ", operation: "PUSH" });

    for (const kind of areaGatewayOperationKinds) {
      if (kind === "git.fetch" || kind === "git.push" || kind === "jj.git.fetch" || kind === "jj.git.push") {
        continue;
      }
      expect(() => inputFor(kind)).toThrow(`Gateway operation is not supported yet: ${kind}.`);
    }
  });

  it("does not drop unsupported operation arguments", () => {
    expect(() =>
      gatewayOperationInput({
        areaId: "local:control",
        repositoryId: "repo:control",
        kind: "git.fetch",
        arguments: { remote: "origin" }
      })
    ).toThrow("Gateway operation arguments are not supported for git.fetch.");
  });

  it("prepares gateway operations with the explicit operation mapping", async () => {
    let requestBody: unknown = null;
    const fetch = vi.fn(async (_input: URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({
          data: {
            prepareOperation: {
              confirmationId: "confirmation:1",
              repository: "repo:control",
              vcs: "JJ",
              operation: "PUSH",
              command: ["jj", "git", "push"],
              requiresConfirmation: true
            }
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetch);

    await expect(
      new GatewayClient(gatewayRecord(), "api-token").prepareOperation({
        areaId: "local:control",
        repositoryId: "repo:control",
        kind: "jj.git.push"
      })
    ).resolves.toMatchObject({
      id: "confirmation:1",
      kind: "jj.git.push",
      summary: "Ready to run jj git push"
    });

    expect(requestBody).toMatchObject({
      variables: {
        input: {
          repository: "repo:control",
          vcs: "JJ",
          operation: "PUSH"
        }
      }
    });
  });

  it("rejects unsupported gateway operations before sending GraphQL requests", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      new GatewayClient(gatewayRecord(), "api-token").prepareOperation({
        areaId: "local:control",
        repositoryId: "repo:control",
        kind: "git.commit"
      })
    ).rejects.toThrow("Gateway operation is not supported yet: git.commit.");

    expect(fetch).not.toHaveBeenCalled();
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
