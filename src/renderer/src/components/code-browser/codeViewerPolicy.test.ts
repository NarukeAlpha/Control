import { describe, expect, it } from "vitest";

import {
  highlightDecision,
  isMarkdownPath,
  isPreviewableImagePath,
  maxHighlightBytes,
  maxPreviewBytes,
  shouldRenderSourceLines,
  shouldTreatAsBinaryText
} from "./codeViewerPolicy";

describe("codeViewerPolicy", () => {
  it("aligns markdown, image, and binary decisions", () => {
    expect(isMarkdownPath("docs/README.mkdn")).toBe(true);
    expect(isPreviewableImagePath("assets/logo.webp")).toBe(true);
    expect(shouldTreatAsBinaryText("assets/logo.webp", null)).toBe(false);
    expect(shouldTreatAsBinaryText("dist/archive.zip", null)).toBe(true);
    expect(shouldTreatAsBinaryText("src/main.ts", "a\u0000b")).toBe(true);
  });

  it("exposes provider and renderer large-file thresholds", () => {
    expect(maxPreviewBytes).toBe(2 * 1024 * 1024);
    expect(shouldRenderSourceLines("a\nb")).toBe(true);
    expect(shouldRenderSourceLines(`${"x\n".repeat(20_000)}x`)).toBe(false);
  });

  it("decides when highlighting should be skipped", () => {
    expect(
      highlightDecision({ path: "src/main.ts", content: "const value = 1;", language: "typescript" })
    ).toEqual({ kind: "eligible" });
    expect(highlightDecision({ path: "LICENSE", content: "plain", language: null })).toEqual({
      kind: "unsupported",
      message: "Syntax highlighting unavailable for this file type."
    });
    expect(
      highlightDecision({
        path: "src/large.ts",
        content: "x".repeat(maxHighlightBytes + 1),
        language: "typescript"
      })
    ).toEqual({ kind: "too_large", message: "Syntax highlighting skipped for this large file." });
  });
});
