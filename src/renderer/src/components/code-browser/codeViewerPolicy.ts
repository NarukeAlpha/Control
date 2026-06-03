import {
  contentHasNullByte,
  isMarkdownPath,
  isNonImageBinaryPath,
  isPreviewableImagePath,
  maxPreviewBytes
} from "@shared/filePreviewPolicy";
import type { CodeLanguage } from "./codeLanguage";

export { isMarkdownPath, isPreviewableImagePath, maxPreviewBytes };

const maxRenderedLines = 20_000;
export const maxHighlightBytes = 300 * 1024;
const maxHighlightLines = 5_000;
const supportedCodeLanguages = [
  "bash",
  "css",
  "go",
  "html",
  "javascript",
  "json",
  "jsonc",
  "markdown",
  "python",
  "rust",
  "toml",
  "tsx",
  "typescript",
  "yaml"
] as const satisfies readonly CodeLanguage[];

const supportedCodeLanguageSet = new Set<string>(supportedCodeLanguages);

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
  if (!input.language || !isSupportedCodeLanguage(input.language)) {
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

export function isSupportedCodeLanguage(language: string | null | undefined): language is CodeLanguage {
  return typeof language === "string" && supportedCodeLanguageSet.has(language);
}

function lineCountForSource(content: string): number {
  return content.split("\n").length;
}

function byteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}
