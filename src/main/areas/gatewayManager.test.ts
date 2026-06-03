import { createHash } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { AreaSummary } from "@shared/areas";
import type { AreaGatewayRecord, LocalStore } from "../storage";
import { areaGatewayFailureFromError, GatewayManager, resolveGatewayBinaryArtifact } from "./gatewayManager";

const tempPaths: string[] = [];

describe("GatewayManager lifecycle", () => {
  afterEach(async () => {
    await Promise.all(tempPaths.map((path) => rm(path, { recursive: true, force: true })));
    tempPaths.length = 0;
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

  it("kills a partially started local gateway when manifest polling fails", async () => {
    mockGatewayKeychain();
    const record = gatewayRecord({
      status: "stopped",
      apiUrl: null,
      adminUrl: null,
      pid: null,
      processId: null
    });
    const store = gatewayStore(record);
    const child = detachedChild({ pid: 321 });
    const manager = new GatewayManager(store, await tempRoot(), {
      spawn: vi.fn(() => child),
      resolveGatewayBinary: async () => "/tmp/control-gateway",
      pollTimeoutMs: 5,
      localPollIntervalMs: 1
    });

    await expect(manager.ensureAreaGateway(areaSummary())).rejects.toThrow(/manifest/);

    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(store.getAreaGateway("local:control")).toMatchObject({
      status: "error",
      failureCode: "manifest-timeout"
    });
  });

  it("reuses the in-flight Area gateway startup for concurrent callers", async () => {
    mockGatewayKeychain();
    const record = gatewayRecord({
      status: "stopped",
      apiUrl: null,
      adminUrl: null,
      pid: null,
      processId: null
    });
    const store = gatewayStore(record);
    const spawnGateway = vi.fn((_: string, args: readonly string[] = []) => {
      const manifestPath = args[args.indexOf("--manifest") + 1];
      void writeFile(
        manifestPath,
        JSON.stringify({
          apiUrl: "http://127.0.0.1:4100",
          adminUrl: "http://127.0.0.1:4101",
          tokenRequired: true,
          pid: 654,
          startedAt: new Date().toISOString()
        })
      );
      return detachedChild({ pid: 654 });
    });
    const manager = new GatewayManager(store, await tempRoot(), {
      spawn: spawnGateway,
      resolveGatewayBinary: async () => "/tmp/control-gateway",
      pollTimeoutMs: 200,
      localPollIntervalMs: 1
    });

    const [first, second] = await Promise.all([
      manager.ensureAreaGateway(areaSummary()),
      manager.ensureAreaGateway(areaSummary())
    ]);

    expect(spawnGateway).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: "ready",
      apiUrl: "http://127.0.0.1:4100",
      adminUrl: "http://127.0.0.1:4101"
    });
  });

  it("runs best-effort remote gateway cleanup when remote manifest polling times out", async () => {
    mockGatewayKeychain();
    const record = sshGatewayRecord({
      status: "stopped",
      apiUrl: null,
      adminUrl: null,
      pid: null,
      processId: null
    });
    const store = gatewayStore(record);
    const execFile = vi.fn(async (_file: string, args: readonly string[] = []) => {
      const command = args.join(" ");
      if (command.includes(" cat .control/control-gateway/ssh-control/manifest.json")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });
    const manager = new GatewayManager(store, await tempRoot(), {
      execFile,
      spawn: vi.fn(() => successfulChild()),
      resolveGatewayBinary: async () => {
        throw new Error("skip scp");
      },
      pollTimeoutMs: 5,
      remotePollIntervalMs: 1
    });

    await expect(manager.ensureAreaGateway(sshAreaSummary())).rejects.toThrow(/Remote gateway/);

    expect(execFile).toHaveBeenCalledWith(
      "ssh",
      expect.arrayContaining([
        "sh",
        "-lc",
        expect.stringContaining("pkill -f -- '.control/control-gateway/ssh-control/control-gateway'")
      ])
    );
    expect(store.getAreaGateway("ssh:control")).toMatchObject({
      status: "error",
      failureCode: "manifest-timeout"
    });
  });

  it("kills the SSH tunnel when tunnel verification fails after a valid remote manifest", async () => {
    mockGatewayKeychain();
    const record = sshGatewayRecord({
      status: "stopped",
      apiUrl: null,
      adminUrl: null,
      pid: null,
      processId: null
    });
    const store = gatewayStore(record);
    const tunnel = detachedChild({ pid: 9001 });
    const spawnGateway = vi.fn((command: string, args: readonly string[] = []) => {
      if (command === "ssh" && args.includes("-N")) {
        return tunnel;
      }
      return successfulChild();
    });
    const execFile = vi.fn(async (_file: string, args: readonly string[] = []) => {
      const command = args.join(" ");
      if (command.includes(" cat .control/control-gateway/ssh-control/manifest.json")) {
        return {
          stdout: JSON.stringify({
            apiUrl: "http://127.0.0.1:5100",
            adminUrl: "http://127.0.0.1:5101",
            tokenRequired: true,
            pid: 777,
            startedAt: new Date().toISOString()
          }),
          stderr: ""
        };
      }
      return { stdout: "", stderr: "" };
    });
    const fetchGateway = vi.fn(async () => ({ ok: false }) as Response);
    const manager = new GatewayManager(store, await tempRoot(), {
      execFile,
      fetch: fetchGateway,
      freePort: sequentialPorts(6100, 6101),
      spawn: spawnGateway,
      resolveGatewayBinary: async () => {
        throw new Error("skip scp");
      },
      pollTimeoutMs: 5,
      localPollIntervalMs: 1,
      remotePollIntervalMs: 1
    });

    await expect(manager.ensureAreaGateway(sshAreaSummary())).rejects.toThrow(/tunnel/);

    expect(tunnel.kill).toHaveBeenCalledWith("SIGTERM");
    expect(execFile).toHaveBeenCalledWith(
      "ssh",
      expect.arrayContaining(["sh", "-lc", expect.stringContaining("curl -fsS -X POST")])
    );
    expect(store.getAreaGateway("ssh:control")).toMatchObject({
      status: "error",
      failureCode: "gateway-unreachable"
    });
  });
});

describe("resolveGatewayBinaryArtifact", () => {
  afterEach(async () => {
    await Promise.all(tempPaths.map((path) => rm(path, { recursive: true, force: true })));
    tempPaths.length = 0;
  });

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

  it("uses platform-specific packaged gateway names for Windows and Linux", async () => {
    await expect(resolvePackagedNameForPlatform("win32", "x64", "control-gateway.exe")).resolves.toBe(
      "control-gateway.exe"
    );
    await expect(resolvePackagedNameForPlatform("linux", "x64", "control-gateway")).resolves.toBe(
      "control-gateway"
    );
  });

  async function resolvePackagedNameForPlatform(
    platform: NodeJS.Platform,
    arch: string,
    filename: string
  ): Promise<string> {
    const root = await tempRoot();
    const resourcesPath = join(root, "Resources");
    const binaryPath = join(resourcesPath, "control-gateway", filename);
    await mkdir(join(resourcesPath, "control-gateway"), { recursive: true });
    await writeFile(binaryPath, "gateway-binary");
    await chmod(binaryPath, 0o755);
    await writeFile(
      join(resourcesPath, "control-gateway", "manifest.json"),
      JSON.stringify({
        filename,
        platform,
        arch,
        version: "0.1.0",
        sha256: sha256("gateway-binary")
      })
    );

    const resolved = await resolveGatewayBinaryArtifact({
      cwd: root,
      envBinary: null,
      execPath: join(root, "Control"),
      resourcesPath,
      platform,
      arch
    });
    return resolved.split(/[\\/]/u).at(-1) ?? "";
  }
});

async function tempRoot(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "control-gateway-manager-"));
  tempPaths.push(path);
  return path;
}

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

function sshAreaSummary(): AreaSummary {
  return {
    ...areaSummary(),
    id: "ssh:control",
    kind: "ssh",
    rootPath: "/workspace/control"
  };
}

function gatewayRecord(overrides: Partial<AreaGatewayRecord> = {}): AreaGatewayRecord {
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
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function sshGatewayRecord(overrides: Partial<AreaGatewayRecord> = {}): AreaGatewayRecord {
  return {
    ...gatewayRecord(),
    areaId: "ssh:control",
    transport: "ssh",
    host: "example.test",
    username: "git",
    port: 2222,
    ...overrides
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

function mockGatewayKeychain(): void {
  vi.doMock("keytar", () => ({
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true)
  }));
}

function detachedChild({ pid }: { pid: number }): ChildProcess & { kill: ReturnType<typeof vi.fn> } {
  const child = new EventEmitter() as ChildProcess & { kill: ReturnType<typeof vi.fn> };
  let killed = false;
  Object.defineProperty(child, "pid", { value: pid });
  Object.defineProperty(child, "killed", { get: () => killed });
  child.unref = vi.fn() as ChildProcess["unref"];
  child.kill = vi.fn(() => {
    killed = true;
    return true;
  }) as ChildProcess["kill"] & ReturnType<typeof vi.fn>;
  child.stderr = new EventEmitter() as ChildProcess["stderr"];
  child.stdin = { end: vi.fn() } as unknown as ChildProcess["stdin"];
  return child;
}

function successfulChild(): ChildProcess {
  const child = detachedChild({ pid: 7000 });
  queueMicrotask(() => child.emit("close", 0));
  return child;
}

function sequentialPorts(...ports: number[]): () => Promise<number> {
  let index = 0;
  return async () => {
    const port = ports[index];
    index += 1;
    if (!port) {
      throw new Error("No test port configured.");
    }
    return port;
  };
}
