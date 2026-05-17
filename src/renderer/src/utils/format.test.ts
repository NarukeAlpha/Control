import { describe, expect, it } from "vitest";

import { firstMarkdownHeading, formatCompactNumber } from "./format";

describe("format utilities", () => {
  it("formats compact numbers", () => {
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(1200)).toBe("1.2K");
  });

  it("extracts a README heading", () => {
    expect(firstMarkdownHeading("# Control\n\nA desktop client.")).toBe("Control");
    expect(firstMarkdownHeading(null)).toBe("README");
  });
});
