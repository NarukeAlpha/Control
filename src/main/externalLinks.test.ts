import { describe, expect, it, vi } from "vitest";

import { openExternalHttps, requireExternalHttpsUrl } from "./externalLinks";

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
});
