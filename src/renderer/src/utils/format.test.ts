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

  it("falls back for null, empty, H2, and bare hash content", () => {
    expect(firstMarkdownHeading(null)).toBe("README");
    expect(firstMarkdownHeading("")).toBe("README");
    expect(firstMarkdownHeading("## Secondary")).toBe("README");
    expect(firstMarkdownHeading("#")).toBe("README");
  });

  it("extracts indented H1 headings", () => {
    expect(firstMarkdownHeading("  # Control")).toBe("Control");
  });

  it("ignores H1 markers inside fenced code blocks", () => {
    expect(firstMarkdownHeading("```sh\n# not a title\n```\n# Real title")).toBe("Real title");
  });

  it("extracts Setext H1 headings", () => {
    expect(firstMarkdownHeading("Control\n=======\n\nA desktop client.")).toBe("Control");
  });
});
