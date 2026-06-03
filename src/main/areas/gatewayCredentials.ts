const credentialServiceName = "Control Gateway Credentials";

type GatewayCredentialKind = "api" | "admin";
type KeytarClient = Pick<typeof import("keytar"), "getPassword" | "setPassword" | "deletePassword">;

class GatewayCredentialsUnavailableError extends Error {
  readonly code = "gateway-credentials-unavailable";

  constructor(message = "Control gateway credentials are unavailable.") {
    super(message);
    this.name = "GatewayCredentialsUnavailableError";
  }
}

export interface GatewayCredentials {
  apiToken: string;
  adminToken: string;
}

function getProperty(value: unknown, key: string): unknown {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return undefined;
  }

  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function isKeytarClient(value: unknown): value is KeytarClient {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return false;
  }

  return (
    typeof getProperty(value, "getPassword") === "function" &&
    typeof getProperty(value, "setPassword") === "function" &&
    typeof getProperty(value, "deletePassword") === "function"
  );
}

async function loadKeytar(): Promise<KeytarClient> {
  try {
    const keytarModule: unknown = await import("keytar");

    if (isKeytarClient(keytarModule)) {
      return keytarModule;
    }

    const defaultExport = getProperty(keytarModule, "default");
    if (isKeytarClient(defaultExport)) {
      return defaultExport;
    }
  } catch (error) {
    throw new GatewayCredentialsUnavailableError(
      error instanceof Error ? error.message : "Control gateway credentials are unavailable."
    );
  }

  throw new GatewayCredentialsUnavailableError("Control keychain module did not load correctly.");
}

function accountName(areaId: string, kind: GatewayCredentialKind): string {
  return `gateway:${areaId}:${kind}`;
}

function cleanToken(token: string | null | undefined): string | null {
  const trimmed = token?.trim();
  return trimmed ? trimmed : null;
}

export async function getGatewayCredentials(areaId: string): Promise<GatewayCredentials | null> {
  const keytar = await loadKeytar();
  const [apiToken, adminToken] = await Promise.all([
    keytar.getPassword(credentialServiceName, accountName(areaId, "api")),
    keytar.getPassword(credentialServiceName, accountName(areaId, "admin"))
  ]);
  const cleanApiToken = cleanToken(apiToken);
  const cleanAdminToken = cleanToken(adminToken);
  return cleanApiToken && cleanAdminToken ? { apiToken: cleanApiToken, adminToken: cleanAdminToken } : null;
}

export async function setGatewayCredentials(areaId: string, credentials: GatewayCredentials): Promise<void> {
  const apiToken = cleanToken(credentials.apiToken);
  const adminToken = cleanToken(credentials.adminToken);
  if (!apiToken || !adminToken) {
    throw new Error("Gateway credentials require non-empty API and admin tokens.");
  }

  const keytar = await loadKeytar();
  await Promise.all([
    keytar.setPassword(credentialServiceName, accountName(areaId, "api"), apiToken),
    keytar.setPassword(credentialServiceName, accountName(areaId, "admin"), adminToken)
  ]);
}

export async function clearGatewayCredentials(areaId: string): Promise<void> {
  const keytar = await loadKeytar();
  await Promise.all([
    keytar.deletePassword(credentialServiceName, accountName(areaId, "api")),
    keytar.deletePassword(credentialServiceName, accountName(areaId, "admin"))
  ]);
}

export async function rotateGatewayCredentials(
  areaId: string,
  credentials: GatewayCredentials
): Promise<GatewayCredentials> {
  await setGatewayCredentials(areaId, credentials);
  return credentials;
}

export function gatewayCredentialsUnavailable(error: unknown): boolean {
  return error instanceof GatewayCredentialsUnavailableError;
}
