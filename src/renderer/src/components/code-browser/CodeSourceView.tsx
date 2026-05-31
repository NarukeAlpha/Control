import { FileText } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type JSX, type ReactNode } from "react";

import { languageForCodePath, type CodeLanguage } from "./codeLanguage";
import { highlightSource, type HighlightedSourceLine } from "./codeHighlighter";
import { highlightDecision, shouldRenderSourceLines } from "./codeViewerPolicy";

interface CodeSourceViewProps {
  content: string;
  path: string;
  highlightedLine: number | null;
  fileSize?: number | null;
  language?: CodeLanguage | null;
}

export function CodeSourceView({
  content,
  path,
  highlightedLine,
  language: explicitLanguage
}: CodeSourceViewProps): JSX.Element {
  const language = explicitLanguage ?? languageForCodePath(path);
  const decision = useMemo(() => highlightDecision({ path, content, language }), [content, language, path]);
  const decisionMessage = decision.kind === "eligible" ? null : decision.message;
  const highlightKey = `${path}:${language ?? "plain"}:${content}`;
  const [highlightResult, setHighlightResult] = useState<{
    key: string;
    lines: HighlightedSourceLine[] | null;
    status: string | null;
  } | null>(null);
  const sourceLines = useMemo(() => splitSourceLines(content), [content]);
  const highlighted = highlightResult?.key === highlightKey ? highlightResult.lines : null;
  const highlightStatus =
    decision.kind !== "eligible"
      ? decisionMessage
      : highlighted
        ? null
        : (highlightResult?.key === highlightKey && highlightResult.status) || "Loading syntax highlighting…";

  useEffect(() => {
    let active = true;

    if (decision.kind !== "eligible" || !language) {
      return () => {
        active = false;
      };
    }

    highlightSource({ content, language })
      .then((lines) => {
        if (!active) {
          return;
        }
        setHighlightResult({ key: highlightKey, lines, status: null });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setHighlightResult({
          key: highlightKey,
          lines: null,
          status: "Syntax highlighting failed. Showing plain text."
        });
      });

    return () => {
      active = false;
    };
  }, [content, decision.kind, highlightKey, language]);

  if (!shouldRenderSourceLines(content)) {
    return (
      <div className="binary-file-fallback">
        <FileText size={28} />
        <strong>File preview skipped</strong>
        <span>This text file is too large to render safely in the code viewer.</span>
      </div>
    );
  }

  return (
    <div className="code-source-wrap">
      {highlightStatus && (
        <div className="code-highlight-status" role="status" aria-live="polite">
          {highlightStatus}
        </div>
      )}
      {highlightedLine && <span className="sr-only">Highlighted line {highlightedLine}</span>}
      <pre className="code-line-viewer" aria-label={`Source for ${path}`} tabIndex={0}>
        <code>
          {highlighted
            ? highlighted.map((line) => (
                <SourceLine
                  highlighted={line.lineNumber === highlightedLine}
                  key={`${path}-${line.lineNumber}`}
                  lineNumber={line.lineNumber}
                >
                  {line.tokens.length > 0
                    ? line.tokens.map((token) => (
                        <span
                          className="code-source-token"
                          key={`${line.lineNumber}-${token.offset}-${token.content}`}
                          style={tokenStyle(token.color, token.fontStyle)}
                        >
                          {token.content}
                        </span>
                      ))
                    : line.content}
                  {sourceLines[line.lineNumber - 1]?.hasTrailingNewline ? "\n" : null}
                </SourceLine>
              ))
            : sourceLines.map((line) => {
                return (
                  <SourceLine
                    highlighted={line.lineNumber === highlightedLine}
                    key={`${path}-${line.lineNumber}`}
                    lineNumber={line.lineNumber}
                  >
                    {line.content}
                    {line.hasTrailingNewline ? "\n" : null}
                  </SourceLine>
                );
              })}
        </code>
      </pre>
    </div>
  );
}

function splitSourceLines(content: string): Array<{
  content: string;
  hasTrailingNewline: boolean;
  lineNumber: number;
}> {
  const lines = content.split("\n");
  return lines.map((line, index) => ({
    content: line,
    hasTrailingNewline: index < lines.length - 1,
    lineNumber: index + 1
  }));
}

function SourceLine({
  children,
  highlighted,
  lineNumber
}: {
  children: ReactNode;
  highlighted: boolean;
  lineNumber: number;
}): JSX.Element {
  return (
    <span className={`code-source-line ${highlighted ? "highlighted" : ""}`}>
      <span className="code-source-line-number" aria-hidden="true">
        {lineNumber}
      </span>
      <span className="code-source-line-text">{children}</span>
    </span>
  );
}

function tokenStyle(color: string | null, fontStyle: number | null): CSSProperties | undefined {
  if (!color && !fontStyle) {
    return undefined;
  }

  return {
    color: color ?? undefined,
    fontStyle: fontStyle && (fontStyle & 1) === 1 ? "italic" : undefined,
    fontWeight: fontStyle && (fontStyle & 2) === 2 ? 700 : undefined,
    textDecoration: fontStyle && (fontStyle & 4) === 4 ? "underline" : undefined
  };
}
