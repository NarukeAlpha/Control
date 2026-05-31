import {
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  GitBranch,
  Lock,
  RefreshCw
} from "lucide-react";
import { useRef, useState, type JSX } from "react";

import type {
  BranchSummary,
  GitHubReadAvailability,
  RepoEntry,
  RepoFileContent,
  RepositoryCommitSummary,
  RepositoryDetail,
  TagSummary
} from "@shared/github";

import { MarkdownBody, markdownRepositoryUrlContext } from "../MarkdownBody";
import { CommitHistoryPanel } from "../repository/CommitHistoryPanel";
import { repoFileContentRecentCommit, type CommitRecentCommit } from "../repository/commitRecent";
import { readAvailabilityMessage, repositoryPath } from "../repository/repositoryUi";
import { repositoryActivityDate } from "../repository/repositorySearch";
import { CodeSourceView } from "./CodeSourceView";
import {
  encodeRepositoryPath,
  EntryIcon,
  entryBrowseTitle,
  entryLastChangeLabel,
  fileCommitChangeSummary,
  isMarkdownPath,
  isPreviewableImagePath,
  normalizeCodeLineNumber,
  parentDirectory,
  pathSegments,
  repositoryPathForEntryType
} from "./codeBrowserUi";
import type { AppRoute } from "../../stores/uiStore";
import { formatRelativeDate } from "../../utils/format";

export function CodeBrowserPage({
  repository,
  availabilityMessage,
  githubReady,
  route,
  branches,
  tags,
  refsLoading,
  refsError,
  refsAvailabilityMessage,
  contents,
  contentsLoading,
  contentsError,
  contentsAvailability,
  fileContent,
  fileLoading,
  fileError,
  fileAvailabilityMessage,
  commits,
  commitsLimit,
  commitsLoading,
  commitsError,
  commitsAvailability,
  error,
  onRefresh,
  onBackToRepository,
  onOpenCodeBrowser,
  onOpenCommit,
  onSelectRef,
  onExpandCommits,
  onOpenExternal
}: {
  repository?: RepositoryDetail;
  availabilityMessage: string | null;
  githubReady: boolean;
  route: Extract<AppRoute, { kind: "codeBrowser" }>;
  branches: BranchSummary[];
  tags: TagSummary[];
  refsLoading: boolean;
  refsError: Error | null;
  refsAvailabilityMessage: string | null;
  contents: RepoEntry[];
  contentsLoading: boolean;
  contentsError: Error | null;
  contentsAvailability: GitHubReadAvailability | null;
  fileContent?: RepoFileContent;
  fileLoading: boolean;
  fileError: Error | null;
  fileAvailabilityMessage: string | null;
  commits: RepositoryCommitSummary[];
  commitsLimit: number;
  commitsLoading: boolean;
  commitsError: Error | null;
  commitsAvailability: GitHubReadAvailability | null;
  error: Error | null;
  onRefresh(): Promise<unknown> | void;
  onBackToRepository(): void;
  onOpenCodeBrowser(path: string, entryType: "file" | "dir", ref?: string | null, line?: number | null): void;
  onOpenCommit(
    commit: CommitRecentCommit,
    path: string,
    entryType: "file" | "dir",
    line?: number | null
  ): void;
  onSelectRef(ref: string): void;
  onExpandCommits(): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<{ key: string; label: string } | null>(null);
  const historyPanelRef = useRef<HTMLDivElement | null>(null);

  if (!repository && (error || availabilityMessage)) {
    const routeLine = normalizeCodeLineNumber(route.line);
    const browserUrl = `https://github.com/${route.nameWithOwner}/${
      route.entryType === "dir" ? "tree" : "blob"
    }/${encodeURIComponent(route.ref ?? "HEAD")}/${encodeRepositoryPath(route.path)}${routeLine ? `#L${routeLine}` : ""}`;

    return (
      <div className="error-state repository-load-error">
        <strong>Code browser unavailable</strong>
        <span>{error?.message ?? availabilityMessage}</span>
        <div className="table-action-row">
          <button type="button" onClick={() => void onRefresh()}>
            <RefreshCw size={16} /> Retry
          </button>
          <button type="button" onClick={() => onOpenExternal(browserUrl)}>
            <ExternalLink size={16} /> GitHub fallback
          </button>
        </div>
      </div>
    );
  }

  if (!repository) {
    return <div className="loading-state">Loading code browser…</div>;
  }

  const isFile = route.entryType === "file";
  const currentRef = route.ref ?? repository.defaultBranch ?? "HEAD";
  const contentsAvailabilityMessage = readAvailabilityMessage("Repository contents", contentsAvailability);
  const commitsAvailabilityMessage = readAvailabilityMessage("Commit history", commitsAvailability);
  const highlightedLine = isFile ? normalizeCodeLineNumber(route.line) : null;
  const refOptions = [
    ...branches.map((branch) => ({ kind: "branch" as const, name: branch.name })),
    ...tags.map((tag) => ({ kind: "tag" as const, name: tag.name }))
  ];
  const hasCurrentRefOption = refOptions.some((option) => option.name === currentRef);
  const browserPath = route.path || repository.name;
  const browserUrl = `${repositoryPathForEntryType(repository, route.path, route.entryType, currentRef)}${
    highlightedLine ? `#L${highlightedLine}` : ""
  }`;
  const segments = pathSegments(route.path);
  const fileStatusKey = `${route.nameWithOwner}:${route.ref ?? ""}:${route.path}:${highlightedLine ?? ""}`;
  const visibleCopyStatus = copyStatus?.key === fileStatusKey ? copyStatus.label : null;
  const hasFileContent = Boolean(fileContent) && !fileLoading;
  const canOpenRaw = Boolean(fileContent?.downloadUrl) && !fileLoading;
  const filePath = fileContent?.path ?? route.path;
  const fileKind = fileContent?.kind ?? null;
  const canCopyRaw = hasFileContent && fileKind === "text" && fileContent?.content !== null;
  const previewAsImage =
    fileKind === "image" && Boolean(fileContent?.downloadUrl) && isPreviewableImagePath(filePath);
  const previewAsMarkdown =
    fileKind === "text" && fileContent?.content !== null && !previewAsImage && isMarkdownPath(filePath);
  const markdownUrlContext = markdownRepositoryUrlContext(repository, currentRef, parentDirectory(filePath));
  const historyUrl = filePath
    ? repositoryPath(
        repository,
        `/commits/${encodeURIComponent(currentRef)}/${encodeRepositoryPath(filePath)}`
      )
    : null;
  const fileChangeSummary = fileCommitChangeSummary(fileContent);
  const fileLastCommit = fileContent ? repoFileContentRecentCommit(fileContent) : null;
  const fileLastCommitUnavailableMessage =
    fileContent && !fileContent.lastCommitSha
      ? readAvailabilityMessage("File last change", fileContent.lastCommitAvailability)
      : null;

  const copyFileContent = async (): Promise<void> => {
    if (!fileContent || fileLoading || !canCopyRaw) {
      setCopyStatus({ key: fileStatusKey, label: "File unavailable" });
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setCopyStatus({ key: fileStatusKey, label: "Clipboard unavailable" });
      return;
    }

    try {
      await navigator.clipboard.writeText(fileContent.content ?? "");
      setCopyStatus({ key: fileStatusKey, label: "Copied" });
    } catch {
      setCopyStatus({ key: fileStatusKey, label: "Copy failed" });
    }
  };

  return (
    <article className="code-browser-page">
      <header className="code-browser-header">
        <button type="button" onClick={onBackToRepository}>
          <Code2 size={16} /> Repository
        </button>
        <div>
          <h1>{browserPath}</h1>
          <nav className="path-crumbs" aria-label="File path">
            <button type="button" onClick={onBackToRepository}>
              {repository.name}
            </button>
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1;
              const segmentType = isLast ? route.entryType : "dir";
              return (
                <button
                  key={segment.path}
                  type="button"
                  disabled={isLast}
                  onClick={() => onOpenCodeBrowser(segment.path, segmentType)}
                >
                  {segment.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="code-browser-header-actions">
          <label className="ref-picker code-browser-ref-picker">
            <GitBranch size={16} />
            <select
              aria-label="File browser reference"
              disabled={refsLoading && refOptions.length === 0}
              value={currentRef}
              onChange={(event) => onSelectRef(event.currentTarget.value)}
            >
              {!hasCurrentRefOption && <option value={currentRef}>{currentRef}</option>}
              {branches.length > 0 && (
                <optgroup label="Branches">
                  {branches.map((branch) => (
                    <option key={`browser-branch-${branch.name}`} value={branch.name}>
                      {branch.name}
                      {branch.protected ? " (protected)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {tags.length > 0 && (
                <optgroup label="Tags">
                  {tags.map((tag) => (
                    <option key={`browser-tag-${tag.name}`} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown size={14} />
          </label>
          <button type="button" onClick={() => onOpenExternal(browserUrl)}>
            <ExternalLink size={16} /> GitHub fallback
          </button>
        </div>
      </header>

      {!githubReady && (
        <div className="cached-mode-banner" role="status">
          <Lock size={16} />
          <span>
            Cached mode. File content, commits, and tree data are loaded from local cache when available.
          </span>
        </div>
      )}

      {refsError && <div className="error-state">Branch and tag list unavailable: {refsError.message}</div>}
      {refsAvailabilityMessage && <div className="error-state">{refsAvailabilityMessage}</div>}
      {error && <div className="error-state">{error.message}</div>}

      {isFile ? (
        <section className="code-viewer">
          <div className="code-viewer-toolbar">
            <span>{fileContent?.name ?? route.path.split("/").pop() ?? route.path}</span>
            <div className="code-viewer-actions">
              <small>{currentRef}</small>
              {highlightedLine && <small>line {highlightedLine}</small>}
              {visibleCopyStatus && (
                <small className="code-viewer-status" role="status" aria-live="polite">
                  {visibleCopyStatus}
                </small>
              )}
              <button
                type="button"
                disabled={!canCopyRaw}
                title={canCopyRaw ? undefined : "Raw text is unavailable for this file"}
                onClick={copyFileContent}
              >
                <Copy size={14} /> Copy raw
              </button>
              <button
                type="button"
                disabled={!canOpenRaw}
                title={canOpenRaw ? undefined : "Raw file URL is unavailable"}
                onClick={() => {
                  if (fileContent?.downloadUrl) {
                    onOpenExternal(fileContent.downloadUrl);
                  }
                }}
              >
                <ExternalLink size={14} /> Open raw
              </button>
              <button
                type="button"
                disabled={!canOpenRaw}
                title={canOpenRaw ? undefined : "Raw file URL is unavailable"}
                onClick={() => {
                  if (fileContent?.downloadUrl) {
                    onOpenExternal(fileContent.downloadUrl);
                  }
                }}
              >
                <Download size={14} /> Download
              </button>
              <button
                type="button"
                title="Jump to in-app file history"
                onClick={() =>
                  historyPanelRef.current?.scrollIntoView({ behavior: "instant", block: "start" })
                }
              >
                <GitBranch size={14} /> History
              </button>
            </div>
          </div>
          {!fileLoading && fileContent?.lastCommitSha && (
            <div className="code-file-metadata">
              <span>
                {fileContent.lastCommitMessage ?? "Last changed"} by{" "}
                {fileContent.lastCommitAuthorLogin ?? fileContent.lastCommitAuthorName ?? "unknown"}
              </span>
              <time>{formatRelativeDate(fileContent.lastCommitDate)}</time>
              {fileChangeSummary && <small>{fileChangeSummary}</small>}
              <button
                type="button"
                disabled={!fileLastCommit}
                title={fileLastCommit ? "Open commit in app" : "Last commit unavailable."}
                onClick={() => {
                  if (fileLastCommit) {
                    onOpenCommit(fileLastCommit, filePath, "file", highlightedLine);
                  }
                }}
              >
                {fileContent.lastCommitSha.slice(0, 7)}
              </button>
            </div>
          )}
          {!fileLoading && fileLastCommitUnavailableMessage && (
            <div className="error-state">{fileLastCommitUnavailableMessage}</div>
          )}
          {fileError && fileContent && (
            <div className="error-state">File refresh failed: {fileError.message}</div>
          )}
          {fileError && !fileContent ? (
            <div className="error-state">File unavailable: {fileError.message}</div>
          ) : fileAvailabilityMessage && !fileContent && !fileLoading ? (
            <div className="error-state">{fileAvailabilityMessage}</div>
          ) : fileLoading ? (
            <div className="loading-state">Loading file…</div>
          ) : previewAsImage && fileContent?.downloadUrl ? (
            <div className="code-image-preview">
              <img src={fileContent.downloadUrl} alt={fileContent.name} />
            </div>
          ) : fileKind === "image" ? (
            <div className="binary-file-fallback">
              <FileIcon size={28} />
              <strong>Image preview unavailable</strong>
              <span>{fileContent?.message ?? "Raw image URL is unavailable for this file."}</span>
            </div>
          ) : previewAsMarkdown ? (
            <div className="code-markdown-preview">
              <MarkdownBody
                markdown={fileContent?.content ?? ""}
                emptyText="This markdown file has no rendered content."
                onOpenExternal={onOpenExternal}
                urlContext={markdownUrlContext}
              />
            </div>
          ) : fileKind === "binary" ? (
            <div className="binary-file-fallback">
              <FileIcon size={28} />
              <strong>Binary preview unavailable</strong>
              <span>
                {fileContent?.message ?? "Open the raw file to inspect or download it from GitHub."}
              </span>
            </div>
          ) : fileKind === "too_large" ? (
            <div className="binary-file-fallback">
              <FileIcon size={28} />
              <strong>Large file preview skipped</strong>
              <span>
                {fileContent?.message ?? "Preview was skipped for this large file."}
                {typeof fileContent?.size === "number" ? ` Size: ${formatFileSize(fileContent.size)}.` : ""}
              </span>
            </div>
          ) : fileKind === "unavailable" ? (
            <div className="binary-file-fallback">
              <FileIcon size={28} />
              <strong>File preview unavailable</strong>
              <span>{fileContent?.message ?? "GitHub did not return previewable file content."}</span>
            </div>
          ) : fileContent && fileKind === "text" && fileContent.content !== null ? (
            <CodeSourceView
              content={fileContent.content}
              fileSize={fileContent.size}
              highlightedLine={highlightedLine}
              path={filePath}
            />
          ) : (
            <div className="empty-state">No file preview is available.</div>
          )}
        </section>
      ) : (
        <section className="file-table code-browser-table">
          <div className="commit-row">
            <span className="mini-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
            <strong>{repository.owner}</strong>
            <span>{route.path || repository.defaultBranch || "Repository root"}</span>
            <CheckCircle2 size={16} />
            <small>{currentRef}</small>
            <small>{formatRelativeDate(repositoryActivityDate(repository))}</small>
            <small>updated</small>
          </div>
          {contentsError && contents.length === 0 ? (
            <div className="error-state">Folder unavailable: {contentsError.message}</div>
          ) : contentsLoading && contents.length === 0 ? (
            <div className="loading-state">Loading folder…</div>
          ) : contentsAvailabilityMessage && contents.length === 0 ? (
            <div className="error-state">{contentsAvailabilityMessage}</div>
          ) : !contentsError && contents.length === 0 ? (
            <div className="empty-state">No files returned for this folder.</div>
          ) : (
            <div className="code-browser-list">
              {contentsError && (
                <div className="error-state">Folder refresh failed: {contentsError.message}</div>
              )}
              {contentsAvailabilityMessage && (
                <div className="error-state">Folder refresh failed: {contentsAvailabilityMessage}</div>
              )}
              {route.path && (
                <button
                  type="button"
                  className="file-row static-file-row"
                  onClick={() => onOpenCodeBrowser(parentDirectory(route.path), "dir")}
                >
                  <Folder size={17} />
                  <strong>..</strong>
                  <span>Parent directory</span>
                  <time />
                </button>
              )}
              {contents.map((item) => (
                <button
                  className="file-row static-file-row"
                  key={item.sha}
                  type="button"
                  onClick={() => onOpenCodeBrowser(item.path, item.type === "dir" ? "dir" : "file")}
                  title={entryBrowseTitle(item)}
                >
                  <EntryIcon entry={item} />
                  <strong>{item.name}</strong>
                  <span>{entryLastChangeLabel(item)}</span>
                  <time>
                    {item.lastCommitAvailability.status === "available"
                      ? formatRelativeDate(item.lastCommitDate ?? repositoryActivityDate(repository))
                      : ""}
                  </time>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {isFile && (
        <div ref={historyPanelRef}>
          <CommitHistoryPanel
            title="File history"
            subtitle={`${currentRef} · ${filePath}`}
            commits={commits}
            loading={commitsLoading}
            error={commitsError}
            availabilityMessage={commitsAvailabilityMessage}
            externalUrl={historyUrl}
            currentLimit={commitsLimit}
            openCommitLabel="Open file"
            onExpandCommits={onExpandCommits}
            onOpenCommit={(commit) => onOpenCommit(commit, filePath, "file", highlightedLine)}
            onOpenExternal={onOpenExternal}
          />
        </div>
      )}
    </article>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }
  return `${(kib / 1024).toFixed(1)} MiB`;
}
