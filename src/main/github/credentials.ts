const tokenServiceName = "Control GitHub Token";
const tokenAccountName = "github.com";

type KeytarClient = Pick<typeof import("keytar"), "getPassword" | "setPassword" | "deletePassword">;

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
  const keytarModule: unknown = await import("keytar");

  if (isKeytarClient(keytarModule)) {
    return keytarModule;
  }

  const defaultExport = getProperty(keytarModule, "default");

  if (isKeytarClient(defaultExport)) {
    return defaultExport;
  }

  throw new Error("Control keychain module did not load correctly.");
}

export async function getGitHubToken(): Promise<string | null> {
  const e2eToken = process.env.CONTROL_E2E === "1" ? process.env.CONTROL_GITHUB_TOKEN?.trim() : null;
  if (e2eToken) {
    return e2eToken;
  }

  try {
    const keytar = await loadKeytar();
    return keytar.getPassword(tokenServiceName, tokenAccountName);
  } catch (error) {
    console.warn("Control keychain access unavailable.", error);
    return null;
  }
}

export async function setGitHubToken(token: string): Promise<void> {
  const keytar = await loadKeytar();
  await keytar.setPassword(tokenServiceName, tokenAccountName, token);
}

export async function clearGitHubToken(): Promise<void> {
  try {
    const keytar = await loadKeytar();
    await keytar.deletePassword(tokenServiceName, tokenAccountName);
  } catch (error) {
    console.warn("Control keychain access unavailable.", error);
  }
}
