export interface ExternalLinkOpener {
  openExternal(url: string): Promise<void>;
}

export interface ExternalLinkLogger {
  warn(message: string, error: unknown): void;
}

export interface ExternalWindowOpenRequest {
  url: unknown;
}

export interface ExternalWindowOpenResult {
  action: "deny";
}

class ExternalLinkPolicyError extends Error {
  readonly code = "INVALID_EXTERNAL_URL";

  constructor(message = "Control only opens external HTTPS links.") {
    super(message);
    this.name = "ExternalLinkPolicyError";
  }
}

export function requireExternalHttpsUrl(input: unknown): string {
  if (typeof input !== "string") {
    throw new ExternalLinkPolicyError("External links must be provided as strings.");
  }

  if (input !== input.trim()) {
    throw new ExternalLinkPolicyError("External links must not include surrounding whitespace.");
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new ExternalLinkPolicyError("External links must be absolute HTTPS URLs.");
  }

  if (parsed.protocol !== "https:") {
    throw new ExternalLinkPolicyError("Control only opens external HTTPS links.");
  }

  return parsed.toString();
}

export async function openExternalHttps(input: unknown, opener: ExternalLinkOpener): Promise<void> {
  await opener.openExternal(requireExternalHttpsUrl(input));
}

export function denyAndOpenExternalHttps(
  request: ExternalWindowOpenRequest,
  opener: ExternalLinkOpener,
  logger: ExternalLinkLogger = console
): ExternalWindowOpenResult {
  void openExternalHttps(request.url, opener).catch((error) => {
    logger.warn("Control blocked an external window-open URL.", error);
  });

  return { action: "deny" };
}
