import { createBundledHighlighter, type HighlighterGeneric } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import type { CodeLanguage } from "./codeLanguage";

export type CodeViewerColorScheme = "light" | "dark";

interface HighlightedSourceToken {
  content: string;
  offset: number;
  color: string | null;
  fontStyle: number | null;
}

export interface HighlightedSourceLine {
  content: string;
  lineNumber: number;
  tokens: HighlightedSourceToken[];
}

const codeViewerThemes = {
  light: "github-light-default",
  dark: "github-dark-default"
} as const;

type CodeViewerTheme = (typeof codeViewerThemes)[keyof typeof codeViewerThemes];
type CodeViewerHighlighter = HighlighterGeneric<CodeLanguage, CodeViewerTheme>;

const createCodeHighlighter = createBundledHighlighter<CodeLanguage, CodeViewerTheme>({
  langs: {
    bash: () => import("shiki/langs/bash.mjs"),
    css: () => import("shiki/langs/css.mjs"),
    go: () => import("shiki/langs/go.mjs"),
    html: () => import("shiki/langs/html.mjs"),
    javascript: () => import("shiki/langs/javascript.mjs"),
    json: () => import("shiki/langs/json.mjs"),
    jsonc: () => import("shiki/langs/jsonc.mjs"),
    markdown: () => import("shiki/langs/markdown.mjs"),
    python: () => import("shiki/langs/python.mjs"),
    rust: () => import("shiki/langs/rust.mjs"),
    toml: () => import("shiki/langs/toml.mjs"),
    tsx: () => import("shiki/langs/tsx.mjs"),
    typescript: () => import("shiki/langs/typescript.mjs"),
    yaml: () => import("shiki/langs/yaml.mjs")
  },
  themes: {
    [codeViewerThemes.light]: () => import("shiki/themes/github-light-default.mjs"),
    [codeViewerThemes.dark]: () => import("shiki/themes/github-dark-default.mjs")
  },
  engine: () => createJavaScriptRegexEngine()
});

let highlighterPromise: Promise<CodeViewerHighlighter> | null = null;

async function getCodeHighlighter(): Promise<CodeViewerHighlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createCodeHighlighter({
      themes: [codeViewerThemes.light, codeViewerThemes.dark],
      langs: []
    });
  }

  return highlighterPromise;
}

export async function highlightSource(input: {
  content: string;
  language: CodeLanguage;
  colorScheme?: CodeViewerColorScheme;
}): Promise<HighlightedSourceLine[]> {
  const highlighter = await getCodeHighlighter();
  await highlighter.loadLanguage(input.language);
  const lines = highlighter.codeToTokensBase(input.content, {
    lang: input.language,
    theme: codeViewerThemes[input.colorScheme ?? "dark"]
  });
  const sourceLines = input.content.split("\n");

  return lines.map((tokens, index) => ({
    content: sourceLines[index] ?? "",
    lineNumber: index + 1,
    tokens: tokens.map((token) => ({
      content: token.content,
      offset: token.offset,
      color: token.color ?? null,
      fontStyle: typeof token.fontStyle === "number" ? token.fontStyle : null
    }))
  }));
}
