const serviceName = "Control GitHub App OAuth";

export async function getGitHubAppToken(account: string): Promise<string | null> {
  try {
    const keytar = await import("keytar");
    return keytar.getPassword(serviceName, account);
  } catch (error) {
    console.warn("Control keychain access unavailable.", error);
    return null;
  }
}

export async function setGitHubAppToken(account: string, token: string): Promise<void> {
  const keytar = await import("keytar");
  await keytar.setPassword(serviceName, account, token);
}

