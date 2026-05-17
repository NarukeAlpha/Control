import { randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import type { AreaSummary, CreateSshAreaInput, StopAreaGatewayInput } from "@shared/areas";

import type { AreaGatewayRecord, LocalStore } from "../storage";
import { GatewayClient } from "./gatewayClient";

const execFileAsync = promisify(execFile);
const gatewayVersion = "0.1.0";
const gatewayManifestFile = "manifest.json";
const gatewayPollTimeoutMs = 8_000;

export class GatewayManager {
  constructor(
    private readonly store: LocalStore,
    private readonly userDataPath: string
  ) {}

  seedLocalArea(area: AreaSummary): AreaGatewayRecord {
    const existing = this.store.getAreaGateway(area.id);
    if (existing) {
      return existing;
    }
    const record = baseGatewayRecord(area, {
      transport: "local",
      rootPath: requireAreaRoot(area),
      host: null,
      username: null,
      port: null
    });
    this.store.setAreaGateway(record);
    return record;
  }

  seedSshArea(area: AreaSummary, input: CreateSshAreaInput): AreaGatewayRecord {
    const existing = this.store.getAreaGateway(area.id);
    if (existing) {
      return existing;
    }
    const record = baseGatewayRecord(area, {
      transport: "ssh",
      rootPath: input.rootPath.trim(),
      host: input.host.trim(),
      username: input.username?.trim() || null,
      port: input.port ?? null
    });
    this.store.setAreaGateway(record);
    return record;
  }

  async ensureAreaGateway(area: AreaSummary): Promise<AreaGatewayRecord> {
    const seeded = this.store.getAreaGateway(area.id) ?? this.seedLocalArea(area);
    if (seeded.status === "ready" && seeded.apiUrl && (await this.gatewayResponds(seeded))) {
      const refreshed = { ...seeded, lastSeenAt: new Date().toISOString(), message: null };
      this.store.setAreaGateway(refreshed);
      return refreshed;
    }
    return seeded.transport === "ssh" ? this.startSshGateway(seeded) : this.startLocalGateway(seeded);
  }

  getClient(areaId: string): GatewayClient | null {
    const record = this.store.getAreaGateway(areaId);
    return record?.apiUrl ? new GatewayClient(record) : null;
  }

  async stopGateway(input: StopAreaGatewayInput): Promise<AreaGatewayRecord | null> {
    const record = this.store.getAreaGateway(input.areaId);
    if (!record) {
      return null;
    }
    if (record.adminUrl) {
      await fetch(new URL("/stop", record.adminUrl), {
        method: "POST",
        headers: record.adminToken ? { authorization: `Bearer ${record.adminToken}` } : {}
      }).catch(() => undefined);
    }
    const stopped = {
      ...record,
      status: "stopped" as const,
      processId: null,
      pid: null,
      message: "Gateway stopped by user.",
      updatedAt: new Date().toISOString()
    };
    this.store.setAreaGateway(stopped);
    return stopped;
  }

  private async startLocalGateway(record: AreaGatewayRecord): Promise<AreaGatewayRecord> {
    const binaryPath = await this.resolveGatewayBinary();
    const stateDir = await this.gatewayStateDir(record.areaId);
    const manifestPath = join(stateDir, gatewayManifestFile);
    const starting = {
      ...record,
      status: "starting" as const,
      version: gatewayVersion,
      apiToken: record.apiToken ?? randomToken(),
      adminToken: record.adminToken ?? randomToken(),
      serviceName: `control-gateway-${safeName(record.areaId)}`,
      message: "Starting local gateway.",
      lastStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.store.setAreaGateway(starting);

    const child = spawn(
      binaryPath,
      [
        "--root",
        record.rootPath,
        "--host",
        "127.0.0.1",
        "--port",
        "0",
        "--admin-port",
        "0",
        "--token",
        starting.apiToken,
        "--manifest",
        manifestPath
      ],
      { detached: true, stdio: "ignore" }
    );
    child.unref();

    const manifest = normalizeManifest(await readGatewayManifest(manifestPath));
    const ready = {
      ...starting,
      status: "ready" as const,
      apiUrl: manifest.apiUrl,
      adminUrl: manifest.adminUrl,
      pid: manifest.pid ?? child.pid ?? null,
      processId: child.pid ?? null,
      version: manifest.version ?? gatewayVersion,
      lastSeenAt: new Date().toISOString(),
      message: null,
      updatedAt: new Date().toISOString()
    };
    this.store.setAreaGateway(ready);
    return ready;
  }

  private async startSshGateway(record: AreaGatewayRecord): Promise<AreaGatewayRecord> {
    if (!record.host) {
      throw new Error("SSH gateway requires a host.");
    }
    const target = sshTarget(record);
    const remoteBase = `.control/control-gateway/${safeName(record.areaId)}`;
    const remoteManifest = `${remoteBase}/manifest.json`;
    const remoteBinary = `${remoteBase}/control-gateway`;
    const apiToken = record.apiToken ?? randomToken();
    const adminToken = record.adminToken ?? randomToken();
    await execFileAsync("ssh", sshArgs(record, target, ["mkdir", "-p", remoteBase]));

    const localBinary = await this.resolveGatewayBinary().catch(() => null);
    if (localBinary) {
      await scp(localBinary, record, target, remoteBinary).catch(() => undefined);
      await execFileAsync("ssh", sshArgs(record, target, ["chmod", "+x", remoteBinary])).catch(
        () => undefined
      );
    }

    const command = [
      `nohup ${remoteBinary}`,
      "--root",
      shellQuote(record.rootPath),
      "--host 127.0.0.1",
      "--port 0",
      "--admin-port 0",
      "--token",
      shellQuote(apiToken),
      "--manifest",
      shellQuote(remoteManifest),
      `>${remoteBase}/gateway.log 2>&1 &`
    ].join(" ");
    await execFileAsync("ssh", sshArgs(record, target, ["sh", "-lc", command]));

    const remoteManifestJson = await pollRemoteManifest(record, target, remoteManifest);
    const remoteManifestData = normalizeManifest(JSON.parse(remoteManifestJson) as GatewayManifestPayload);
    const apiPort = portFromUrl(remoteManifestData.apiUrl);
    const adminPort = portFromUrl(remoteManifestData.adminUrl);
    const localApiPort = await freePort();
    const localAdminPort = await freePort();
    const tunnel = spawn(
      "ssh",
      [
        ...sshConnectionArgs(record),
        "-N",
        "-L",
        `127.0.0.1:${localApiPort}:127.0.0.1:${apiPort}`,
        "-L",
        `127.0.0.1:${localAdminPort}:127.0.0.1:${adminPort}`,
        target
      ],
      { detached: true, stdio: "ignore" }
    );
    tunnel.unref();

    const ready = {
      ...record,
      status: "ready" as const,
      version: remoteManifestData.version ?? gatewayVersion,
      apiUrl: `http://127.0.0.1:${localApiPort}`,
      adminUrl: `http://127.0.0.1:${localAdminPort}`,
      apiToken,
      adminToken,
      serviceName: `control-gateway-${safeName(record.areaId)}`,
      processId: tunnel.pid ?? null,
      pid: remoteManifestData.pid ?? null,
      message: null,
      lastStartedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.store.setAreaGateway(ready);
    return ready;
  }

  private async gatewayResponds(record: AreaGatewayRecord): Promise<boolean> {
    if (!record.apiUrl) {
      return false;
    }
    const response = await fetch(new URL("/graphql", record.apiUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(record.apiToken ? { authorization: `Bearer ${record.apiToken}` } : {})
      },
      body: JSON.stringify({ query: "{ territory { id } }" })
    }).catch(() => null);
    return Boolean(response?.ok);
  }

  private async gatewayStateDir(areaId: string): Promise<string> {
    const dir = join(this.userDataPath, "Control", "gateways", safeName(areaId));
    await mkdir(dir, { recursive: true });
    return dir;
  }

  private async resolveGatewayBinary(): Promise<string> {
    const candidates = [
      process.env.CONTROL_GATEWAY_BINARY,
      resolve(process.cwd(), "target", "debug", binaryName()),
      resolve(process.cwd(), "target", "release", binaryName()),
      resolve(process.cwd(), "crates", "control-gateway", "target", "debug", binaryName()),
      resolve(process.cwd(), "crates", "control-gateway", "target", "release", binaryName())
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      if (await canExecute(candidate)) {
        return candidate;
      }
    }
    throw new Error(
      "Control gateway binary was not found. Build `control-gateway` or set CONTROL_GATEWAY_BINARY."
    );
  }
}

interface GatewayManifestPayload {
  apiUrl?: string;
  graphqlUrl?: string;
  eventsUrl?: string;
  adminUrl: string;
  version?: string | null;
  pid?: number | null;
}

function baseGatewayRecord(
  area: AreaSummary,
  input: {
    transport: "local" | "ssh";
    rootPath: string;
    host: string | null;
    username: string | null;
    port: number | null;
  }
): AreaGatewayRecord {
  const now = new Date().toISOString();
  return {
    areaId: area.id,
    rootPath: input.rootPath,
    transport: input.transport,
    host: input.host,
    username: input.username,
    port: input.port,
    apiUrl: null,
    adminUrl: null,
    apiToken: randomToken(),
    adminToken: randomToken(),
    serviceName: null,
    version: null,
    status: "not-installed",
    pid: null,
    processId: null,
    message: null,
    installedAt: now,
    lastStartedAt: null,
    lastSeenAt: null,
    updatedAt: now
  };
}

async function canExecute(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  return access(path).then(
    () => true,
    () => false
  );
}

async function readGatewayManifest(path: string): Promise<GatewayManifestPayload> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < gatewayPollTimeoutMs) {
    const content = await readFile(path, "utf8").catch(() => null);
    if (content) {
      return JSON.parse(content) as GatewayManifestPayload;
    }
    await delay(100);
  }
  throw new Error("Gateway did not write its manifest before the startup timeout.");
}

async function pollRemoteManifest(
  record: AreaGatewayRecord,
  target: string,
  remoteManifest: string
): Promise<string> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < gatewayPollTimeoutMs) {
    const result = await execFileAsync("ssh", sshArgs(record, target, ["cat", remoteManifest])).catch(
      () => null
    );
    if (result?.stdout) {
      return result.stdout.toString();
    }
    await delay(200);
  }
  throw new Error("Remote gateway did not write its manifest before the startup timeout.");
}

function sshArgs(record: AreaGatewayRecord, target: string, remoteCommand: string[]): string[] {
  return [...sshConnectionArgs(record), target, ...remoteCommand];
}

function sshConnectionArgs(record: AreaGatewayRecord): string[] {
  return record.port ? ["-p", String(record.port)] : [];
}

async function scp(
  localBinary: string,
  record: AreaGatewayRecord,
  target: string,
  remoteBinary: string
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const args = [
      ...(record.port ? ["-P", String(record.port)] : []),
      localBinary,
      `${target}:${remoteBinary}`
    ];
    const child = spawn("scp", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(stderr.trim() || `scp failed with code ${code ?? "unknown"}.`));
    });
  });
}

function sshTarget(record: AreaGatewayRecord): string {
  return record.username ? `${record.username}@${record.host}` : (record.host ?? "");
}

function requireAreaRoot(area: AreaSummary): string {
  if (!area.rootPath) {
    throw new Error("Gateway Area requires a root path.");
  }
  return area.rootPath;
}

function randomToken(): string {
  return randomBytes(24).toString("base64url");
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

function binaryName(): string {
  return process.platform === "win32" ? "control-gateway.exe" : "control-gateway";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function portFromUrl(url: string): number {
  const port = Number(new URL(url).port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Gateway manifest URL does not include a valid port: ${url}`);
  }
  return port;
}

function normalizeManifest(
  manifest: GatewayManifestPayload
): Required<Pick<GatewayManifestPayload, "apiUrl" | "adminUrl">> & GatewayManifestPayload {
  const apiUrl = manifest.apiUrl ?? (manifest.graphqlUrl ? originFromUrl(manifest.graphqlUrl) : null);
  if (!apiUrl) {
    throw new Error("Gateway manifest did not include an API URL.");
  }
  return { ...manifest, apiUrl, adminUrl: manifest.adminUrl };
}

function originFromUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

async function freePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolvePromise(address.port);
          return;
        }
        reject(new Error("Could not allocate a local port."));
      });
    });
  });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
