import { createContext, use } from "react";
import type { JSX, ReactNode } from "react";

import type { ProjectSummary, RepositoryDetail } from "@shared/github";

export type MarkdownUrlHandler = (url: string) => void;

export const MarkdownUrlHandlerContext = createContext<MarkdownUrlHandler | null>(null);

export interface MarkdownUrlContext {
  linkBaseUrl: string;
  linkRootUrl: string;
  imageBaseUrl: string;
  imageRootUrl: string;
  repositoryHtmlUrl?: string;
}

function repositoryPath(repository: RepositoryDetail, path = ""): string {
  return `${repository.htmlUrl}${path}`;
}

function parentDirectory(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function safeExternalMarkdownUrl(
  url: string,
  context?: Pick<MarkdownUrlContext, "linkBaseUrl" | "linkRootUrl">
): string | null {
  return safeMarkdownUrl(url, context?.linkBaseUrl, context?.linkRootUrl);
}

function safeMarkdownImageUrl(
  url: string,
  context?: Pick<MarkdownUrlContext, "imageBaseUrl" | "imageRootUrl">
): string | null {
  return safeMarkdownUrl(url, context?.imageBaseUrl, context?.imageRootUrl);
}

function safeMarkdownUrl(url: string, baseUrl?: string, rootUrl?: string): string | null {
  try {
    const trimmedUrl = url.trim();
    const parsed =
      trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//") && rootUrl
        ? new URL(trimmedUrl.slice(1), rootUrl)
        : new URL(trimmedUrl, baseUrl);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function trimMarkdownUrlToken(url: string): { url: string; suffix: string } {
  let safeUrl = url;
  let suffix = "";

  while (/[.,;:!?]$/.test(safeUrl)) {
    suffix = `${safeUrl.at(-1) ?? ""}${suffix}`;
    safeUrl = safeUrl.slice(0, -1);
  }

  return { url: safeUrl, suffix };
}

function markdownReferenceUrl(token: string, context?: MarkdownUrlContext): string | null {
  if (/^@[A-Za-z0-9-]+$/.test(token)) {
    return safeMarkdownUrl(`https://github.com/${token.slice(1)}`);
  }

  const issueReference = token.match(/^(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#(\d+)$/);
  if (!issueReference) {
    return null;
  }

  const repositoryPath =
    issueReference[1] ?? context?.repositoryHtmlUrl?.replace(/^https:\/\/github\.com\//, "");
  return repositoryPath
    ? safeMarkdownUrl(`https://github.com/${repositoryPath}/issues/${issueReference[2]}`)
    : null;
}

export function markdownRepositoryUrlContext(
  repository: RepositoryDetail,
  ref: string,
  directoryPath = ""
): MarkdownUrlContext {
  const normalizedDirectory = directoryPath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const encodedRef = encodeURIComponent(ref);
  const directorySuffix = normalizedDirectory ? `${normalizedDirectory}/` : "";

  return {
    linkBaseUrl: repositoryPath(repository, `/blob/${encodedRef}/${directorySuffix}`),
    linkRootUrl: repositoryPath(repository, `/blob/${encodedRef}/`),
    imageBaseUrl: `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${encodedRef}/${directorySuffix}`,
    imageRootUrl: `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${encodedRef}/`,
    repositoryHtmlUrl: repository.htmlUrl
  };
}

export function markdownProjectUrlContext(
  project: ProjectSummary,
  repository: RepositoryDetail
): MarkdownUrlContext {
  const contextUrl =
    [project.htmlUrl, project.ownerHtmlUrl, repository.htmlUrl]
      .map((url) => (url ? safeMarkdownUrl(url) : null))
      .find((url): url is string => Boolean(url)) ?? repositoryPath(repository, "/");
  const contextBaseUrl = contextUrl.endsWith("/") ? contextUrl : `${contextUrl}/`;

  return {
    linkBaseUrl: contextBaseUrl,
    linkRootUrl: contextBaseUrl,
    imageBaseUrl: contextBaseUrl,
    imageRootUrl: contextBaseUrl,
    repositoryHtmlUrl: repository.htmlUrl
  };
}

export function markdownOrganizationProjectUrlContext(project: ProjectSummary): MarkdownUrlContext {
  const contextUrl =
    [project.htmlUrl, project.ownerHtmlUrl]
      .map((url) => (url ? safeMarkdownUrl(url) : null))
      .find((url): url is string => Boolean(url)) ?? "https://github.com/";
  const contextBaseUrl = contextUrl.endsWith("/") ? contextUrl : `${contextUrl}/`;

  return {
    linkBaseUrl: contextBaseUrl,
    linkRootUrl: contextBaseUrl,
    imageBaseUrl: contextBaseUrl,
    imageRootUrl: contextBaseUrl,
    repositoryHtmlUrl: project.ownerHtmlUrl ?? contextBaseUrl
  };
}

export function markdownWikiUrlContext(
  repository: RepositoryDetail,
  pagePath: string,
  pageHtmlUrl: string | null | undefined
): MarkdownUrlContext {
  const normalizedDirectory = parentDirectory(pagePath)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const directorySuffix = normalizedDirectory ? `${normalizedDirectory}/` : "";
  const owner = encodeURIComponent(repository.owner);
  const repo = encodeURIComponent(repository.name);

  return {
    linkBaseUrl: pageHtmlUrl ?? repositoryPath(repository, "/wiki/"),
    linkRootUrl: repositoryPath(repository, "/wiki/"),
    imageBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}.wiki/HEAD/${directorySuffix}`,
    imageRootUrl: `https://raw.githubusercontent.com/${owner}/${repo}.wiki/HEAD/`,
    repositoryHtmlUrl: repository.htmlUrl
  };
}

function splitTableCells(line: string): string[] {
  return line
    .replace(/^\s*\|?/, "")
    .replace(/\|?\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function markdownBlockKey(prefix: string, lineNumber: number, content: string): string {
  return `${prefix}-${lineNumber}-${content.slice(0, 80)}`;
}

function plainMarkdownTextNodes(
  text: string,
  keyPrefix: string,
  onOpenExternal: (url: string) => void,
  onOpenMarkdownUrl?: MarkdownUrlHandler,
  urlContext?: MarkdownUrlContext,
  interactiveReferences = true
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(https:\/\/[^\s<>()\]]+|@[A-Za-z0-9-]+|(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (interactiveReferences && token.startsWith("https://")) {
      const trimmed = trimMarkdownUrlToken(token);
      const safeUrl = safeMarkdownUrl(trimmed.url);
      if (safeUrl) {
        nodes.push(
          <button
            className="markdown-link"
            key={`${keyPrefix}-autolink-${match.index}`}
            type="button"
            onClick={() => (onOpenMarkdownUrl ?? onOpenExternal)(safeUrl)}
          >
            {trimmed.url}
          </button>
        );
        if (trimmed.suffix) {
          nodes.push(trimmed.suffix);
        }
      } else {
        nodes.push(token);
      }
      lastIndex = match.index + token.length;
      continue;
    }

    const referenceUrl = interactiveReferences ? markdownReferenceUrl(token, urlContext) : null;
    nodes.push(
      referenceUrl ? (
        <button
          className="markdown-reference markdown-reference-button"
          key={`${keyPrefix}-ref-${match.index}`}
          type="button"
          onClick={() => (onOpenMarkdownUrl ?? onOpenExternal)(referenceUrl)}
        >
          {token}
        </button>
      ) : (
        <span className="markdown-reference" key={`${keyPrefix}-ref-${match.index}`}>
          {token}
        </span>
      )
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function PlainMarkdownText({
  text,
  keyPrefix,
  onOpenExternal,
  onOpenMarkdownUrl,
  urlContext,
  interactiveReferences = true
}: {
  text: string;
  keyPrefix: string;
  onOpenExternal: (url: string) => void;
  onOpenMarkdownUrl?: MarkdownUrlHandler;
  urlContext?: MarkdownUrlContext;
  interactiveReferences?: boolean;
}): JSX.Element {
  return (
    <>
      {plainMarkdownTextNodes(
        text,
        keyPrefix,
        onOpenExternal,
        onOpenMarkdownUrl,
        urlContext,
        interactiveReferences
      )}
    </>
  );
}

function emphasisMarkdownNodes(
  text: string,
  keyPrefix: string,
  onOpenExternal: (url: string) => void,
  onOpenMarkdownUrl?: MarkdownUrlHandler,
  urlContext?: MarkdownUrlContext,
  interactiveReferences = true
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const emphasisPattern = /(~~([^~]+)~~|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = emphasisPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(
        ...plainMarkdownTextNodes(
          text.slice(lastIndex, match.index),
          `${keyPrefix}-text-${lastIndex}`,
          onOpenExternal,
          onOpenMarkdownUrl,
          urlContext,
          interactiveReferences
        )
      );
    }
    const deletedText = match[2];
    const strongText = match[3];
    const emphasisText = match[4];
    nodes.push(
      deletedText ? (
        <del key={`${keyPrefix}-del-${match.index}`}>
          <PlainMarkdownText
            interactiveReferences={interactiveReferences}
            keyPrefix={`${keyPrefix}-d`}
            onOpenExternal={onOpenExternal}
            onOpenMarkdownUrl={onOpenMarkdownUrl}
            text={deletedText}
            urlContext={urlContext}
          />
        </del>
      ) : strongText ? (
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          <PlainMarkdownText
            interactiveReferences={interactiveReferences}
            keyPrefix={`${keyPrefix}-s`}
            onOpenExternal={onOpenExternal}
            onOpenMarkdownUrl={onOpenMarkdownUrl}
            text={strongText}
            urlContext={urlContext}
          />
        </strong>
      ) : (
        <em key={`${keyPrefix}-em-${match.index}`}>
          <PlainMarkdownText
            interactiveReferences={interactiveReferences}
            keyPrefix={`${keyPrefix}-e`}
            onOpenExternal={onOpenExternal}
            onOpenMarkdownUrl={onOpenMarkdownUrl}
            text={emphasisText}
            urlContext={urlContext}
          />
        </em>
      )
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...plainMarkdownTextNodes(
        text.slice(lastIndex),
        `${keyPrefix}-text-${lastIndex}`,
        onOpenExternal,
        onOpenMarkdownUrl,
        urlContext,
        interactiveReferences
      )
    );
  }

  return nodes;
}

function EmphasisMarkdownText({
  text,
  keyPrefix,
  onOpenExternal,
  onOpenMarkdownUrl,
  urlContext,
  interactiveReferences = true
}: {
  text: string;
  keyPrefix: string;
  onOpenExternal: (url: string) => void;
  onOpenMarkdownUrl?: MarkdownUrlHandler;
  urlContext?: MarkdownUrlContext;
  interactiveReferences?: boolean;
}): JSX.Element {
  return (
    <>
      {emphasisMarkdownNodes(
        text,
        keyPrefix,
        onOpenExternal,
        onOpenMarkdownUrl,
        urlContext,
        interactiveReferences
      )}
    </>
  );
}

function inlineMarkdownNodes(
  text: string,
  onOpenExternal: (url: string) => void,
  keyPrefix: string,
  urlContext?: MarkdownUrlContext,
  onOpenMarkdownUrl?: MarkdownUrlHandler
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const inlinePattern = /(`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(
        ...emphasisMarkdownNodes(
          text.slice(lastIndex, match.index),
          `${keyPrefix}-text-${lastIndex}`,
          onOpenExternal,
          onOpenMarkdownUrl,
          urlContext
        )
      );
    }

    if (match[2]) {
      nodes.push(<code key={`${keyPrefix}-code-${match.index}`}>{match[2]}</code>);
    } else if (match[4] !== undefined) {
      const safeUrl = safeMarkdownImageUrl(match[4], urlContext);
      nodes.push(
        safeUrl ? (
          <img
            alt={match[3]}
            className="markdown-image"
            key={`${keyPrefix}-image-${match.index}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            src={safeUrl}
          />
        ) : (
          <span className="markdown-unsafe" key={`${keyPrefix}-image-${match.index}`}>
            {match[3] || "Unsafe image"}
          </span>
        )
      );
    } else if (match[6] !== undefined) {
      const safeUrl = safeExternalMarkdownUrl(match[6], urlContext);
      nodes.push(
        safeUrl ? (
          <button
            className="markdown-link"
            key={`${keyPrefix}-link-${match.index}`}
            type="button"
            onClick={() => (onOpenMarkdownUrl ?? onOpenExternal)(safeUrl)}
          >
            <EmphasisMarkdownText
              interactiveReferences={false}
              keyPrefix={`${keyPrefix}-link-label-${match.index}`}
              onOpenExternal={onOpenExternal}
              onOpenMarkdownUrl={onOpenMarkdownUrl}
              text={match[5]}
              urlContext={urlContext}
            />
          </button>
        ) : (
          <span className="markdown-unsafe" key={`${keyPrefix}-link-${match.index}`}>
            {match[5]}
          </span>
        )
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...emphasisMarkdownNodes(
        text.slice(lastIndex),
        `${keyPrefix}-text-${lastIndex}`,
        onOpenExternal,
        onOpenMarkdownUrl,
        urlContext
      )
    );
  }

  return nodes;
}

function InlineMarkdownText({
  text,
  keyPrefix,
  onOpenExternal,
  onOpenMarkdownUrl,
  urlContext
}: {
  text: string;
  keyPrefix: string;
  onOpenExternal: (url: string) => void;
  onOpenMarkdownUrl?: MarkdownUrlHandler;
  urlContext?: MarkdownUrlContext;
}): JSX.Element {
  return <>{inlineMarkdownNodes(text, onOpenExternal, keyPrefix, urlContext, onOpenMarkdownUrl)}</>;
}

export function MarkdownBody({
  markdown,
  onOpenExternal,
  onOpenMarkdownUrl,
  urlContext,
  emptyText = "No markdown content."
}: {
  markdown: string | null | undefined;
  onOpenExternal(url: string): void;
  onOpenMarkdownUrl?: MarkdownUrlHandler;
  urlContext?: MarkdownUrlContext;
  emptyText?: string;
}): JSX.Element {
  const contextMarkdownUrlHandler = use(MarkdownUrlHandlerContext);
  const markdownUrlHandler = onOpenMarkdownUrl ?? contextMarkdownUrlHandler ?? undefined;
  const lines = (markdown?.trim() || emptyText).split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      const blockStartLine = index;
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre
          className="markdown-code-block"
          key={markdownBlockKey("code", blockStartLine, codeLines.join("\n"))}
        >
          {fence[1] && <span>{fence[1]}</span>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const blockStartLine = index;
      const level = Math.min(heading[1].length + 2, 6);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(
        <Tag key={markdownBlockKey("heading", blockStartLine, heading[2].trim())}>
          <InlineMarkdownText
            keyPrefix={`heading-${blockStartLine}`}
            onOpenExternal={onOpenExternal}
            onOpenMarkdownUrl={markdownUrlHandler}
            text={heading[2].trim()}
            urlContext={urlContext}
          />
        </Tag>
      );
      index += 1;
      continue;
    }

    if (
      index + 1 < lines.length &&
      line.indexOf("|") !== -1 &&
      isMarkdownTableDivider(lines[index + 1] ?? "")
    ) {
      const blockStartLine = index;
      const headers = splitTableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index]?.indexOf("|") ?? -1) !== -1) {
        rows.push(splitTableCells(lines[index] ?? ""));
        index += 1;
      }
      blocks.push(
        <table className="markdown-table" key={markdownBlockKey("table", blockStartLine, line)}>
          <thead>
            <tr>
              {headers.map((header, cellIndex) => (
                <th key={`h-${header}`}>
                  <InlineMarkdownText
                    keyPrefix={`table-h-${index}-${cellIndex}`}
                    onOpenExternal={onOpenExternal}
                    onOpenMarkdownUrl={markdownUrlHandler}
                    text={header}
                    urlContext={urlContext}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`r-${row.join("|")}`}>
                {headers.map((_, cellIndex) => (
                  <td key={`c-${headers[cellIndex] ?? ""}`}>
                    <InlineMarkdownText
                      keyPrefix={`table-c-${index}-${rowIndex}-${cellIndex}`}
                      onOpenExternal={onOpenExternal}
                      onOpenMarkdownUrl={markdownUrlHandler}
                      text={row[cellIndex] ?? ""}
                      urlContext={urlContext}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const blockStartLine = index;
      const items: Array<{ checked: boolean | null; lineNumber: number; text: string }> = [];
      const orderedList = Boolean(ordered);
      while (index < lines.length) {
        const itemLineNumber = index;
        const current = lines[index] ?? "";
        const unorderedItem = current.match(/^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.+)$/);
        const orderedItem = current.match(/^\s*\d+\.\s+(.+)$/);
        if ((orderedList && !orderedItem) || (!orderedList && !unorderedItem)) {
          break;
        }
        items.push({
          checked: unorderedItem?.[1] ? unorderedItem[1].toLowerCase() === "x" : null,
          lineNumber: itemLineNumber,
          text: (orderedItem?.[1] ?? unorderedItem?.[2] ?? "").trim()
        });
        index += 1;
      }
      const ListTag = orderedList ? "ol" : "ul";
      blocks.push(
        <ListTag
          className={items.some((item) => item.checked !== null) ? "markdown-task-list" : undefined}
          key={markdownBlockKey("list", blockStartLine, items.map((item) => item.text).join("\n"))}
        >
          {items.map((item) => (
            <li key={markdownBlockKey("item", item.lineNumber, item.text)}>
              {item.checked !== null && <input checked={item.checked} readOnly type="checkbox" />}
              <InlineMarkdownText
                keyPrefix={`list-${blockStartLine}-${item.lineNumber}`}
                onOpenExternal={onOpenExternal}
                onOpenMarkdownUrl={markdownUrlHandler}
                text={item.text}
                urlContext={urlContext}
              />
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    if (line.startsWith(">")) {
      const blockStartLine = index;
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index]?.startsWith(">")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={markdownBlockKey("quote", blockStartLine, quoteLines.join(" "))}>
          <InlineMarkdownText
            keyPrefix={`quote-${blockStartLine}`}
            onOpenExternal={onOpenExternal}
            onOpenMarkdownUrl={markdownUrlHandler}
            text={quoteLines.join(" ")}
            urlContext={urlContext}
          />
        </blockquote>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    const blockStartLine = index;
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !/^```/.test(lines[index] ?? "") &&
      !/^(#{1,4})\s+/.test(lines[index] ?? "") &&
      !/^\s*[-*]\s+/.test(lines[index] ?? "") &&
      !/^\s*\d+\.\s+/.test(lines[index] ?? "") &&
      !/^>/.test(lines[index] ?? "")
    ) {
      paragraphLines.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(
      <p key={markdownBlockKey("paragraph", blockStartLine, paragraphLines.join(" "))}>
        <InlineMarkdownText
          keyPrefix={`paragraph-${blockStartLine}`}
          onOpenExternal={onOpenExternal}
          onOpenMarkdownUrl={markdownUrlHandler}
          text={paragraphLines.join(" ")}
          urlContext={urlContext}
        />
      </p>
    );
  }

  return <div className="markdown-body-lite">{blocks}</div>;
}
