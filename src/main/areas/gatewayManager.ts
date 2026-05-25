import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import type {
  AreaGatewayFailure,
  AreaGatewayFailureCode,
  AreaGatewayFailurePhase,
  AreaSummary,
  CreateSshAreaInput,
  StopAreaGatewayInput
} from "@shared/areas";

import type { AreaGatewayRecord, LocalStore } from "../storage";
import { GatewayClient } from "./gatewayClient";
import {
  clearGatewayCredentials,
  gatewayCredentialsUnavailable,
  getGatewayCredentials,
  rotateGatewayCredentials as setRotatedGatewayCredentials,
  type GatewayCredentials
} from "./gatewayCredentials";

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
    const seeded =
      this.store.getAreaGateway(area.id) ?? (area.kind === "local" ? this.seedLocalArea(area) : null);
    if (!seeded) {
      throw new Error("Gateway metadata is unavailable for this Area.");
    }
    if (seeded.failureCode === "gateway-credentials-migration-pending") {
      throw new Error("Gateway credentials are waiting for migration to the system keychain.");
    }
    try {
      if (seeded.status === "ready" && seeded.apiUrl && (await this.gatewayResponds(seeded))) {
        const refreshed = {
          ...seeded,
          lastSeenAt: new Date().toISOString(),
          failureCode: null,
          message: null
        };
        this.store.setAreaGateway(refreshed);
        return refreshed;
      }
      return seeded.transport === "ssh" ? this.startSshGateway(seeded) : this.startLocalGateway(seeded);
    } catch (error) {
      this.store.setAreaGateway(failedGatewayRecord(this.store.getAreaGateway(area.id) ?? seeded, error));
      throw error;
    }
  }

  async getClient(areaId: string): Promise<GatewayClient | null> {
    const record = this.store.getAreaGateway(areaId);
    if (!record?.apiUrl) {
      return null;
    }
    const credentials = await getGatewayCredentials(areaId);
    if (!credentials) {
      throw new Error("Gateway credentials are unavailable.");
    }
    return new GatewayClient(record, credentials.apiToken);
  }

  async stopGateway(input: StopAreaGatewayInput): Promise<AreaGatewayRecord | null> {
    const record = this.store.getAreaGateway(input.areaId);
    if (!record) {
      return null;
    }
    if (record.failureCode === "gateway-credentials-migration-pending") {
      throw new Error("Gateway credentials are waiting for migration to the system keychain.");
    }
    if (record.adminUrl) {
      const credentials = await getGatewayCredentials(input.areaId).catch((error) => {
        const failed = failedGatewayRecord(record, error);
        this.store.setAreaGateway(failed);
        throw error;
      });
      if (!credentials) {
        const failed = failedGatewayRecord(record, new Error("Gateway admin credentials are unavailable."), {
          failureCode: "credential-missing"
        });
        this.store.setAreaGateway(failed);
        throw new Error("Gateway admin credentials are unavailable.");
      }
      const response = await fetch(new URL("/stop", record.adminUrl), {
        method: "POST",
        headers: { authorization: `Bearer ${credentials.adminToken}` }
      }).catch(() => null);
      if (!response?.ok) {
        const failed = failedGatewayRecord(
          record,
          new Error(`Gateway stop failed with HTTP ${response?.status ?? "unreachable"}.`),
          { failureCode: response ? "admin-stop-failed" : "gateway-unreachable" }
        );
        this.store.setAreaGateway(failed);
        throw new Error(failed.message ?? "Gateway stop failed.");
      }
    }
    const stopped = {
      ...record,
      status: "stopped" as const,
      processId: null,
      pid: null,
      failureCode: null,
      message: "Gateway stopped by user.",
      updatedAt: new Date().toISOString()
    };
    this.store.setAreaGateway(stopped);
    return stopped;
  }

  async repairGateway(area: AreaSummary): Promise<AreaGatewayRecord> {
    return this.ensureAreaGateway(area);
  }

  async restartGateway(area: AreaSummary): Promise<AreaGatewayRecord> {
    await this.stopGateway({ areaId: area.id });
    return this.ensureAreaGateway(area);
  }

  async rotateGatewayCredentials(area: AreaSummary): Promise<AreaGatewayRecord> {
    await this.stopGateway({ areaId: area.id });
    await setRotatedGatewayCredentials(area.id, {
      apiToken: randomToken(),
      adminToken: randomToken()
    });
    return this.ensureAreaGateway(area);
  }

  async clearAreaGateway(areaId: string): Promise<void> {
    const record = this.store.getAreaGateway(areaId);
    if (record) {
      await this.stopGateway({ areaId }).catch((error) => {
        if (record.status === "ready" || record.status === "starting") {
          throw error;
        }
      });
    }
    if (record?.failureCode !== "gateway-credentials-migration-pending") {
      await clearGatewayCredentials(areaId);
    }
    this.store.clearAreaGateway(areaId);
  }

  private async startLocalGateway(record: AreaGatewayRecord): Promise<AreaGatewayRecord> {
    const binaryPath = await this.resolveGatewayBinary();
    const credentials = await this.ensureGatewayCredentials(record.areaId);
    const stateDir = await this.gatewayStateDir(record.areaId);
    const manifestPath = join(stateDir, gatewayManifestFile);
    await rm(manifestPath, { force: true });
    const tokenFiles = await this.writeLocalTokenFiles(record.areaId, credentials);
    const startedAt = new Date().toISOString();
    const starting = {
      ...record,
      status: "starting" as const,
      version: gatewayVersion,
      serviceName: `control-gateway-${safeName(record.areaId)}`,
      failureCode: null,
      message: "Starting local gateway.",
      lastStartedAt: startedAt,
      updatedAt: startedAt
    };
    this.store.setAreaGateway(starting);

    try {
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
          "--token-file",
          tokenFiles.apiTokenFile,
          "--admin-token-file",
          tokenFiles.adminTokenFile,
          "--manifest",
          manifestPath
        ],
        { detached: true, stdio: "ignore" }
      );
      child.unref();

      const manifest = normalizeManifest(await readGatewayManifest(manifestPath), {
        minStartedAt: startedAt,
        requireLoopback: true
      });
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
    } finally {
      await Promise.all([
        rm(tokenFiles.apiTokenFile, { force: true }),
        rm(tokenFiles.adminTokenFile, { force: true })
      ]).catch(() => undefined);
    }
  }

  private async startSshGateway(record: AreaGatewayRecord): Promise<AreaGatewayRecord> {
    if (!record.host) {
      throw new Error("SSH gateway requires a host.");
    }
    const credentials = await this.ensureGatewayCredentials(record.areaId);
    const target = sshTarget(record);
    const remoteBase = `.control/control-gateway/${safeName(record.areaId)}`;
    const remoteSecrets = `${remoteBase}/secrets`;
    const remoteManifest = `${remoteBase}/manifest.json`;
    const remoteBinary = `${remoteBase}/control-gateway`;
    const remoteApiTokenFile = `${remoteSecrets}/api.token`;
    const remoteAdminTokenFile = `${remoteSecrets}/admin.token`;
    const startedAt = new Date().toISOString();
    const starting = {
      ...record,
      status: "starting" as const,
      serviceName: `control-gateway-${safeName(record.areaId)}`,
      version: gatewayVersion,
      failureCode: null,
      message: "Starting remote gateway.",
      lastStartedAt: startedAt,
      updatedAt: startedAt
    };
    this.store.setAreaGateway(starting);

    await execFileAsync("ssh", sshArgs(record, target, ["mkdir", "-p", remoteBase, remoteSecrets]));
    await execFileAsync("ssh", sshArgs(record, target, ["chmod", "700", remoteSecrets])).catch(
      () => undefined
    );
    await execFileAsync(
      "ssh",
      sshArgs(record, target, ["rm", "-f", remoteManifest, remoteApiTokenFile, remoteAdminTokenFile])
    );
    await Promise.all([
      writeRemoteSecret(record, target, remoteApiTokenFile, credentials.apiToken),
      writeRemoteSecret(record, target, remoteAdminTokenFile, credentials.adminToken)
    ]);

    try {
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
        "--token-file",
        shellQuote(remoteApiTokenFile),
        "--admin-token-file",
        shellQuote(remoteAdminTokenFile),
        "--manifest",
        shellQuote(remoteManifest),
        `>${remoteBase}/gateway.log 2>&1 &`
      ].join(" ");
      await execFileAsync("ssh", sshArgs(record, target, ["sh", "-lc", command]));

      const remoteManifestJson = await pollRemoteManifest(record, target, remoteManifest);
      const remoteManifestData = normalizeManifest(JSON.parse(remoteManifestJson) as GatewayManifestPayload, {
        requireLoopback: true
      });
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
        ...starting,
        status: "ready" as const,
        version: remoteManifestData.version ?? gatewayVersion,
        apiUrl: `http://127.0.0.1:${localApiPort}`,
        adminUrl: `http://127.0.0.1:${localAdminPort}`,
        processId: tunnel.pid ?? null,
        pid: remoteManifestData.pid ?? null,
        message: null,
        lastSeenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.store.setAreaGateway(ready);
      return ready;
    } finally {
      await execFileAsync(
        "ssh",
        sshArgs(record, target, ["rm", "-f", remoteApiTokenFile, remoteAdminTokenFile])
      ).catch(() => undefined);
    }
  }

  private async gatewayResponds(record: AreaGatewayRecord): Promise<boolean> {
    if (!record.apiUrl) {
      return false;
    }
    const credentials = await getGatewayCredentials(record.areaId);
    if (!credentials) {
      return false;
    }
    const response = await fetch(new URL("/graphql", record.apiUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${credentials.apiToken}`
      },
      body: JSON.stringify({ query: "{ territory { id } }" })
    }).catch(() => null);
    return Boolean(response?.ok);
  }

  private async ensureGatewayCredentials(areaId: string): Promise<GatewayCredentials> {
    const existing = await getGatewayCredentials(areaId);
    if (existing) {
      return existing;
    }
    return setRotatedGatewayCredentials(areaId, {
      apiToken: randomToken(),
      adminToken: randomToken()
    });
  }

  private async writeLocalTokenFiles(
    areaId: string,
    credentials: GatewayCredentials
  ): Promise<{
    apiTokenFile: string;
    adminTokenFile: string;
  }> {
    const stateDir = await this.gatewayStateDir(areaId);
    const secretsDir = join(stateDir, "secrets");
    await rm(secretsDir, { recursive: true, force: true });
    await mkdir(secretsDir, { recursive: true, mode: 0o700 });
    await chmod(secretsDir, 0o700).catch(() => undefined);
    const apiTokenFile = join(secretsDir, "api.token");
    const adminTokenFile = join(secretsDir, "admin.token");
    await Promise.all([
      writeFile(apiTokenFile, credentials.apiToken, { mode: 0o600 }),
      writeFile(adminTokenFile, credentials.adminToken, { mode: 0o600 })
    ]);
    await Promise.all([
      chmod(apiTokenFile, 0o600).catch(() => undefined),
      chmod(adminTokenFile, 0o600).catch(() => undefined)
    ]);
    return { apiTokenFile, adminTokenFile };
  }

  private async gatewayStateDir(areaId: string): Promise<string> {
    const dir = join(this.userDataPath, "Control", "gateways", safeName(areaId));
    await mkdir(dir, { recursive: true });
    return dir;
  }

  private async resolveGatewayBinary(): Promise<string> {
    return resolveGatewayBinaryArtifact();
  }
}

interface GatewayBinaryResolutionContext {
  cwd: string;
  envBinary: string | null;
  execPath: string;
  resourcesPath: string | null;
  platform: NodeJS.Platform;
  arch: string;
}

interface GatewayArtifactManifest {
  binary?: string;
  filename?: string;
  platform?: string;
  architecture?: string;
  arch?: string;
  version?: string;
  sha256?: string;
}

export async function resolveGatewayBinaryArtifact(
  context: GatewayBinaryResolutionContext = defaultGatewayBinaryResolutionContext()
): Promise<string> {
  if (context.envBinary) {
    if (await canExecute(context.envBinary)) {
      return context.envBinary;
    }
    throw gatewayError(
      "runtime-not-found",
      "CONTROL_GATEWAY_BINARY does not point to an executable gateway runtime."
    );
  }

  const packaged = await resolvePackagedGatewayBinary(context);
  if (packaged) {
    return packaged;
  }

  const candidates = [
    resolve(context.cwd, "target", "debug", binaryName(context.platform)),
    resolve(context.cwd, "target", "release", binaryName(context.platform)),
    resolve(context.cwd, "crates", "control-gateway", "target", "debug", binaryName(context.platform)),
    resolve(context.cwd, "crates", "control-gateway", "target", "release", binaryName(context.platform))
  ];

  for (const candidate of candidates) {
    if (await canExecute(candidate)) {
      return candidate;
    }
  }
  throw gatewayError(
    "runtime-not-found",
    "Control gateway binary was not found. Build `control-gateway` or set CONTROL_GATEWAY_BINARY."
  );
}

interface GatewayManifestPayload {
  apiUrl?: string;
  graphqlUrl?: string;
  eventsUrl?: string;
  adminUrl?: string;
  version?: string | null;
  pid?: number | null;
  tokenRequired?: boolean | null;
  startedAt?: string | null;
}

interface GatewayManifestValidationOptions {
  minStartedAt?: string;
  requireLoopback: boolean;
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
    serviceName: null,
    version: null,
    status: "not-installed",
    pid: null,
    processId: null,
    failureCode: null,
    message: null,
    installedAt: now,
    lastStartedAt: null,
    lastSeenAt: null,
    updatedAt: now
  };
}

async function canExecute(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  return access(path, fsConstants.X_OK).then(
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

function binaryName(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? "control-gateway.exe" : "control-gateway";
}

function defaultGatewayBinaryResolutionContext(): GatewayBinaryResolutionContext {
  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  return {
    cwd: process.cwd(),
    envBinary: process.env.CONTROL_GATEWAY_BINARY ?? null,
    execPath: process.execPath,
    resourcesPath: electronProcess.resourcesPath ?? null,
    platform: process.platform,
    arch: process.arch
  };
}

async function resolvePackagedGatewayBinary(context: GatewayBinaryResolutionContext): Promise<string | null> {
  if (!context.resourcesPath) {
    return null;
  }

  const manifestPath = join(context.resourcesPath, "control-gateway", gatewayManifestFile);
  const manifest = await readPackagedGatewayManifest(manifestPath);
  if (!manifest) {
    return null;
  }

  validatePackagedGatewayManifest(manifest, context);
  const fileName = manifest.binary ?? manifest.filename ?? binaryName(context.platform);
  const executableDir = dirname(context.execPath);
  const contentsDir = dirname(executableDir);
  const candidates = [
    resolve(executableDir, fileName),
    resolve(contentsDir, "Helpers", fileName),
    resolve(context.resourcesPath, "control-gateway", fileName)
  ];

  for (const candidate of candidates) {
    if (!(await canExecute(candidate))) {
      continue;
    }
    await verifyPackagedGatewayDigest(candidate, manifest);
    return candidate;
  }

  throw gatewayError("runtime-not-found", "Packaged control gateway runtime was not found.");
}

async function readPackagedGatewayManifest(path: string): Promise<GatewayArtifactManifest | null> {
  const content = await readFile(path, "utf8").catch(() => null);
  if (!content) {
    return null;
  }
  try {
    return JSON.parse(content) as GatewayArtifactManifest;
  } catch {
    throw gatewayError("runtime-integrity-failed", "Packaged control gateway manifest is not valid JSON.");
  }
}

function validatePackagedGatewayManifest(
  manifest: GatewayArtifactManifest,
  context: GatewayBinaryResolutionContext
): void {
  if (manifest.platform && manifest.platform !== context.platform) {
    throw gatewayError("runtime-integrity-failed", "Packaged control gateway platform does not match.");
  }
  const manifestArch = manifest.arch ?? manifest.architecture;
  if (manifestArch && manifestArch !== context.arch) {
    throw gatewayError("runtime-integrity-failed", "Packaged control gateway architecture does not match.");
  }
  if (!manifest.sha256?.trim()) {
    throw gatewayError("runtime-integrity-failed", "Packaged control gateway manifest is missing SHA-256.");
  }
}

async function verifyPackagedGatewayDigest(path: string, manifest: GatewayArtifactManifest): Promise<void> {
  const expected = normalizeSha256(manifest.sha256);
  if (!expected) {
    throw gatewayError("runtime-integrity-failed", "Packaged control gateway manifest is missing SHA-256.");
  }
  const digest = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  if (digest !== expected) {
    throw gatewayError("runtime-integrity-failed", "Packaged control gateway SHA-256 did not match.");
  }
}

function normalizeSha256(value: string | null | undefined): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/^sha256:/, "");
  return normalized && /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
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
  manifest: GatewayManifestPayload,
  options: GatewayManifestValidationOptions
): Required<Pick<GatewayManifestPayload, "apiUrl" | "adminUrl">> & GatewayManifestPayload {
  const apiUrl = manifest.apiUrl ?? (manifest.graphqlUrl ? originFromUrl(manifest.graphqlUrl) : null);
  if (!apiUrl) {
    throw new Error("Gateway manifest did not include an API URL.");
  }
  if (!manifest.adminUrl) {
    throw new Error("Gateway manifest did not include an admin URL.");
  }
  if (manifest.tokenRequired !== true) {
    throw new Error("Gateway manifest did not require API tokens.");
  }
  if (!manifest.pid || manifest.pid <= 0) {
    throw new Error("Gateway manifest did not include a valid process ID.");
  }
  validateManifestStartedAt(manifest.startedAt, options.minStartedAt);
  if (options.requireLoopback) {
    validateLoopbackUrl(apiUrl);
    validateLoopbackUrl(manifest.adminUrl);
  }
  return { ...manifest, apiUrl, adminUrl: manifest.adminUrl };
}

function originFromUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function validateManifestStartedAt(
  startedAt: string | null | undefined,
  minStartedAt: string | undefined
): void {
  if (!startedAt) {
    throw new Error("Gateway manifest did not include a start time.");
  }
  const parsed = Date.parse(startedAt);
  if (!Number.isFinite(parsed)) {
    throw new Error("Gateway manifest included an invalid start time.");
  }
  if (minStartedAt && parsed + 1_000 < Date.parse(minStartedAt)) {
    throw new Error("Gateway manifest start time is older than the current launch.");
  }
}

function validateLoopbackUrl(url: string): void {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(`Gateway manifest URL is not loopback: ${url}`);
  }
}

async function writeRemoteSecret(
  record: AreaGatewayRecord,
  target: string,
  remotePath: string,
  value: string
): Promise<void> {
  const tmpPath = `${remotePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const command = [
    "umask 077",
    `tmp=${shellQuote(tmpPath)}`,
    'cat > "$tmp"',
    'chmod 600 "$tmp"',
    `mv "$tmp" ${shellQuote(remotePath)}`
  ].join("; ");
  await spawnWithInput("ssh", sshArgs(record, target, ["sh", "-lc", command]), value);
}

async function spawnWithInput(command: string, args: string[], input: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "pipe"] });
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
      reject(new Error(stderr.trim() || `${command} failed with code ${code ?? "unknown"}.`));
    });
    child.stdin.end(input);
  });
}

function failedGatewayRecord(
  record: AreaGatewayRecord,
  error: unknown,
  override: { failureCode?: AreaGatewayFailureCode } = {}
): AreaGatewayRecord {
  return {
    ...record,
    status: "error",
    processId: record.processId,
    pid: record.pid,
    failureCode: override.failureCode ?? gatewayFailureCode(error),
    message: error instanceof Error ? error.message : "Gateway operation failed.",
    updatedAt: new Date().toISOString()
  };
}

class GatewayLifecycleError extends Error {
  constructor(
    readonly failureCode: AreaGatewayFailureCode,
    message: string
  ) {
    super(message);
    this.name = "GatewayLifecycleError";
  }
}

function gatewayError(code: AreaGatewayFailureCode, message: string): GatewayLifecycleError {
  return new GatewayLifecycleError(code, message);
}

export function areaGatewayFailureFromError(
  areaId: string,
  phase: AreaGatewayFailurePhase,
  error: unknown
): AreaGatewayFailure {
  const code = gatewayFailureCode(error);
  return {
    code,
    areaId,
    phase,
    message: error instanceof Error ? error.message : "Gateway lifecycle operation failed.",
    retryable: gatewayFailureIsRetryable(code)
  };
}

function gatewayFailureCode(error: unknown): AreaGatewayFailureCode {
  if (error instanceof GatewayLifecycleError) {
    return error.failureCode;
  }
  if (gatewayCredentialsUnavailable(error)) {
    return "credential-store-unavailable";
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("binary was not found")) {
    return "runtime-not-found";
  }
  if (message.includes("manifest")) {
    return message.includes("timeout") || message.includes("did not write")
      ? "manifest-timeout"
      : "manifest-invalid";
  }
  return "gateway-unreachable";
}

function gatewayFailureIsRetryable(code: AreaGatewayFailureCode): boolean {
  return !new Set<AreaGatewayFailureCode>([
    "credential-rejected",
    "runtime-integrity-failed",
    "gateway-version-mismatch"
  ]).has(code);
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
