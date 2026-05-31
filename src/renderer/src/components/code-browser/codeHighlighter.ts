import type { BundledLanguage, BundledTheme, Highlighter } from "shiki";

import type { CodeLanguage } from "./codeLanguage";

export interface HighlightedSourceToken {
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

const codeViewerTheme: BundledTheme = "github-dark-default";
let highlighterPromise: Promise<Highlighter> | null = null;

async function getCodeHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter, createJavaScriptRegexEngine }) =>
      createHighlighter({
        themes: [codeViewerTheme],
        langs: [],
        engine: createJavaScriptRegexEngine()
      })
    );
  }

  return highlighterPromise;
}

export async function highlightSource(input: {
  content: string;
  language: CodeLanguage;
}): Promise<HighlightedSourceLine[]> {
  const highlighter = await getCodeHighlighter();
  await highlighter.loadLanguage(input.language as BundledLanguage);
  const lines = highlighter.codeToTokensBase(input.content, {
    lang: input.language as BundledLanguage,
    theme: codeViewerTheme
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
