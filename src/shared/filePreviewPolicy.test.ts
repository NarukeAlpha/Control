import { describe, expect, it } from "vitest";

import {
  contentHasNullByte,
  isMarkdownPath,
  isNonImageBinaryPath,
  isPreviewableImagePath,
  isReadmeMarkdownPath,
  maxPreviewBytes
} from "./filePreviewPolicy";

describe("filePreviewPolicy", () => {
  it("keeps previewable images out of generic binary classification", () => {
    expect(isPreviewableImagePath("assets/logo.png")).toBe(true);
    expect(isPreviewableImagePath("assets/diagram.SVG")).toBe(true);
    expect(isNonImageBinaryPath("assets/logo.png")).toBe(false);
    expect(isNonImageBinaryPath("archives/build.zip")).toBe(true);
  });

  it("matches markdown extensions shared by code-browser renderers", () => {
    expect(isMarkdownPath("README.md")).toBe(true);
    expect(isMarkdownPath("docs/guide.mkdn")).toBe(true);
    expect(isReadmeMarkdownPath("README.markdown")).toBe(true);
    expect(isMarkdownPath("src/main.ts")).toBe(false);
  });

  it("exposes provider fetch policy helpers", () => {
    expect(maxPreviewBytes).toBe(2 * 1024 * 1024);
    expect(contentHasNullByte("hello\u0000world")).toBe(true);
    expect(contentHasNullByte("hello world")).toBe(false);
  });
});
