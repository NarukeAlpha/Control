import {
  contentHasNullByte,
  isMarkdownPath,
  isNonImageBinaryPath,
  isPreviewableImagePath,
  maxPreviewBytes
} from "@shared/filePreviewPolicy";

export { isMarkdownPath, isPreviewableImagePath, maxPreviewBytes };

export const maxRenderedLines = 20_000;
export const maxHighlightBytes = 300 * 1024;
export const maxHighlightLines = 5_000;
export const maxLineNumberedLines = 20_000;

export type CodeHighlightDecision =
  | { kind: "eligible" }
  | { kind: "unsupported"; message: string }
  | { kind: "too_large"; message: string };

export function shouldTreatAsBinaryText(path: string, content: string | null | undefined): boolean {
  return isNonImageBinaryPath(path) || Boolean(content && contentHasNullByte(content));
}

export function shouldRenderSourceLines(content: string): boolean {
  return lineCountForSource(content) <= maxRenderedLines;
}

export function highlightDecision(input: {
  path: string;
  content: string;
  language: string | null;
}): CodeHighlightDecision {
  if (!input.language) {
    return { kind: "unsupported", message: "Syntax highlighting unavailable for this file type." };
  }

  if (
    byteLength(input.content) > maxHighlightBytes ||
    lineCountForSource(input.content) > maxHighlightLines
  ) {
    return {
      kind: "too_large",
      message: "Syntax highlighting skipped for this large file."
    };
  }

  return { kind: "eligible" };
}

export function lineCountForSource(content: string): number {
  return content.split("\n").length;
}

export function byteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}
