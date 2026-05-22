import { describe, expect, it, vi } from "vitest";

import { denyAndOpenExternalHttps, openExternalHttps, requireExternalHttpsUrl } from "./externalLinks";

describe("external link policy", () => {
  it.each([
    ["non-string", { toString: (): string => "https://github.com" }],
    ["malformed", "https://"],
    ["relative", "/owner/repo"],
    ["whitespace-padded", " https://github.com/owner/repo "],
    ["protocol-relative", "//github.com/owner/repo"],
    ["http", "http://github.com/owner/repo"],
    ["javascript", "javascript:alert(1)"]
  ])("rejects %s inputs", (_label, input) => {
    expect(() => requireExternalHttpsUrl(input)).toThrow();
  });

  it("normalizes absolute HTTPS URLs before opening them", async () => {
    const opener = { openExternal: vi.fn(async () => undefined) };

    await openExternalHttps("https://github.com/NarukeAlpha/t3code?tab=readme", opener);

    expect(opener.openExternal).toHaveBeenCalledWith("https://github.com/NarukeAlpha/t3code?tab=readme");
  });

  it("opens valid window-open URLs through the shared HTTPS policy and denies the Electron window", () => {
    const opener = { openExternal: vi.fn(async () => undefined) };
    const logger = { warn: vi.fn() };

    const result = denyAndOpenExternalHttps(
      { url: "https://github.com/NarukeAlpha/t3code?tab=readme" },
      opener,
      logger
    );

    expect(result).toEqual({ action: "deny" });
    expect(opener.openExternal).toHaveBeenCalledWith("https://github.com/NarukeAlpha/t3code?tab=readme");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("blocks invalid window-open URLs before the opener runs", async () => {
    const opener = { openExternal: vi.fn(async () => undefined) };
    const logger = { warn: vi.fn() };

    const result = denyAndOpenExternalHttps(
      { url: " https://github.com/NarukeAlpha/t3code " },
      opener,
      logger
    );
    await Promise.resolve();

    expect(result).toEqual({ action: "deny" });
    expect(opener.openExternal).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Control blocked an external window-open URL.",
      expect.objectContaining({ code: "INVALID_EXTERNAL_URL" })
    );
  });
});
