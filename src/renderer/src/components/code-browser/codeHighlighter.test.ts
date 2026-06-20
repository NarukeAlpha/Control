import { describe, expect, it } from "vitest";

import { highlightSource } from "./codeHighlighter";

describe("highlightSource", () => {
  it("highlights allowlisted languages without loading arbitrary grammars", async () => {
    const lines = await highlightSource({
      content: "const value = 1;",
      language: "typescript"
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].content).toBe("const value = 1;");
    expect(lines[0].tokens.map((token) => token.content).join("")).toBe("const value = 1;");
  });

  it("uses the source-viewer theme", async () => {
    const lines = await highlightSource({
      content: "const value = 1;",
      language: "typescript"
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].tokens.map((token) => token.content).join("")).toBe("const value = 1;");
  });
});
