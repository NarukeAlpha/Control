import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { AreaSummary } from "@shared/areas";
import type { AreaGatewayRecord, LocalStore } from "../storage";
import { areaGatewayFailureFromError, GatewayManager, resolveGatewayBinaryArtifact } from "./gatewayManager";

describe("GatewayManager lifecycle", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("keytar");
    vi.restoreAllMocks();
  });

  it("rotates gateway credentials after stopping and before restarting the Area gateway", async () => {
    const record = gatewayRecord();
    const store = gatewayStore(record);
    const manager = new GatewayManager(store, "/tmp/control-user-data");
    const stopGateway = vi.spyOn(manager, "stopGateway").mockResolvedValue(record);
    const ensureAreaGateway = vi.spyOn(manager, "ensureAreaGateway").mockResolvedValue(record);
    const keytar = {
      getPassword: vi.fn().mockResolvedValue(null),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true)
    };
    vi.doMock("keytar", () => keytar);

    await expect(manager.rotateGatewayCredentials(areaSummary())).resolves.toBe(record);

    expect(stopGateway).toHaveBeenCalledWith({ areaId: "local:control" });
    expect(keytar.setPassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:api",
      expect.any(String)
    );
    expect(keytar.setPassword).toHaveBeenCalledWith(
      "Control Gateway Credentials",
      "gateway:local:control:admin",
      expect.any(String)
    );
    expect(ensureAreaGateway).toHaveBeenCalledWith(areaSummary());
    expect(stopGateway.mock.invocationCallOrder[0]).toBeLessThan(
      keytar.setPassword.mock.invocationCallOrder[0]
    );
    expect(keytar.setPassword.mock.invocationCallOrder[0]).toBeLessThan(
      ensureAreaGateway.mock.invocationCallOrder[0]
    );
  });

  it("maps gateway lifecycle errors to shared failure objects", () => {
    expect(
      areaGatewayFailureFromError("local:control", "resolve", new Error("binary was not found"))
    ).toEqual({
      code: "runtime-not-found",
      areaId: "local:control",
      phase: "resolve",
      message: "binary was not found",
      retryable: true
    });
  });
});

describe("resolveGatewayBinaryArtifact", () => {
  afterEach(async () => {
    await Promise.all(tempPaths.map((path) => rm(path, { recursive: true, force: true })));
    tempPaths.length = 0;
  });

  const tempPaths: string[] = [];

  it("resolves packaged gateway binaries from app resources and verifies the SHA-256 manifest", async () => {
    const root = await tempRoot();
    const resourcesPath = join(root, "Resources");
    const binaryPath = join(resourcesPath, "control-gateway", "control-gateway");
    await mkdir(join(resourcesPath, "control-gateway"), { recursive: true });
    await writeFile(binaryPath, "gateway-binary");
    await chmod(binaryPath, 0o755);
    await writeFile(
      join(resourcesPath, "control-gateway", "manifest.json"),
      JSON.stringify({
        filename: "control-gateway",
        platform: "darwin",
        arch: "arm64",
        version: "0.1.0",
        sha256: sha256("gateway-binary")
      })
    );

    await expect(
      resolveGatewayBinaryArtifact({
        cwd: root,
        envBinary: null,
        execPath: join(root, "MacOS", "Control"),
        resourcesPath,
        platform: "darwin",
        arch: "arm64"
      })
    ).resolves.toBe(binaryPath);
  });

  it("rejects packaged gateway binaries that do not match the SHA-256 manifest", async () => {
    const root = await tempRoot();
    const resourcesPath = join(root, "Resources");
    await mkdir(join(resourcesPath, "control-gateway"), { recursive: true });
    const binaryPath = join(resourcesPath, "control-gateway", "control-gateway");
    await writeFile(binaryPath, "tampered");
    await chmod(binaryPath, 0o755);
    await writeFile(
      join(resourcesPath, "control-gateway", "manifest.json"),
      JSON.stringify({
        filename: "control-gateway",
        platform: "darwin",
        arch: "arm64",
        version: "0.1.0",
        sha256: sha256("expected")
      })
    );

    await expect(
      resolveGatewayBinaryArtifact({
        cwd: root,
        envBinary: null,
        execPath: join(root, "MacOS", "Control"),
        resourcesPath,
        platform: "darwin",
        arch: "arm64"
      })
    ).rejects.toMatchObject({ failureCode: "runtime-integrity-failed" });
  });

  async function tempRoot(): Promise<string> {
    const path = await mkdtemp(join(tmpdir(), "control-gateway-manager-"));
    tempPaths.push(path);
    return path;
  }
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function areaSummary(): AreaSummary {
  return {
    id: "local:control",
    kind: "local",
    label: "Control",
    subtitle: null,
    rootPath: "/workspace/control",
    accountLogin: null,
    gateway: null,
    health: { status: "ready", message: null, checkedAt: null },
    repositoryCount: 0,
    selected: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function gatewayRecord(): AreaGatewayRecord {
  return {
    areaId: "local:control",
    rootPath: "/workspace/control",
    transport: "local",
    host: null,
    username: null,
    port: null,
    apiUrl: "http://127.0.0.1:4000",
    adminUrl: "http://127.0.0.1:4001",
    serviceName: "control-gateway-local-control",
    version: "0.1.0",
    status: "ready",
    pid: 100,
    processId: 100,
    failureCode: null,
    message: null,
    installedAt: "2026-01-01T00:00:00.000Z",
    lastStartedAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function gatewayStore(record: AreaGatewayRecord): LocalStore {
  let current: AreaGatewayRecord | null = record;
  return {
    getAreaGateway: vi.fn(() => current),
    setAreaGateway: vi.fn((next: AreaGatewayRecord) => {
      current = next;
    }),
    clearAreaGateway: vi.fn(() => {
      current = null;
    })
  } as unknown as LocalStore;
}
