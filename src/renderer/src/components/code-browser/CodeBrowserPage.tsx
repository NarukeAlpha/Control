import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  GitBranch,
  Lock,
  RefreshCw
} from "lucide-react";
import { Fragment, useRef, useState, type ChangeEvent, type JSX, type RefObject } from "react";

import type {
  BranchSummary,
  GitHubReadAvailability,
  RepoEntry,
  RepoFileContent,
  RepositoryCommitSummary,
  RepositoryDetail,
  TagSummary
} from "@shared/github";

import { MarkdownBody, markdownRepositoryUrlContext, type MarkdownUrlContext } from "../MarkdownBody";
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
  pathSegments
} from "./codeBrowserUi";
import type { AppRoute } from "../../stores/uiStore";
import { formatRelativeDate } from "../../utils/format";

interface CodeBrowserPageProps {
  repository?: RepositoryDetail;
  availabilityMessage: string | null;
  githubReady: boolean;
  route: CodeBrowserRoute;
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
  onOpenCodeBrowser(
    path: string,
    entryType: CodeBrowserEntryType,
    ref?: string | null,
    line?: number | null
  ): void;
  onOpenCommit(
    commit: CommitRecentCommit,
    path: string,
    entryType: CodeBrowserEntryType,
    line?: number | null
  ): void;
  onSelectRef(ref: string): void;
  onExpandCommits(): void;
  onOpenExternal(url: string): void;
}

type CodeBrowserRoute = Extract<AppRoute, { kind: "codeBrowser" }>;
type CodeBrowserEntryType = "file" | "dir";

function CodeBrowserLoadError({
  message,
  browserUrl,
  onRefresh,
  onOpenExternal
}: {
  message: string | null | undefined;
  browserUrl: string;
  onRefresh(): Promise<unknown> | void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function retry(): void {
    void onRefresh();
  }

  function openFallback(): void {
    onOpenExternal(browserUrl);
  }

  return (
    <div className="error-state repository-load-error">
      <strong>Code browser unavailable</strong>
      <span>{message}</span>
      <div className="table-action-row">
        <button type="button" onClick={retry}>
          <RefreshCw size={16} /> Retry
        </button>
        <button type="button" onClick={openFallback}>
          <ExternalLink size={16} /> Open on GitHub
        </button>
      </div>
    </div>
  );
}

function CodeBrowserPathSegment({
  segment,
  isLast,
  entryType,
  onOpenCodeBrowser
}: {
  segment: ReturnType<typeof pathSegments>[number];
  isLast: boolean;
  entryType: "file" | "dir";
  onOpenCodeBrowser(path: string, entryType: "file" | "dir", ref?: string | null, line?: number | null): void;
}): JSX.Element {
  function openSegment(): void {
    onOpenCodeBrowser(segment.path, entryType);
  }

  const SegmentIcon = isLast && entryType === "file" ? FileIcon : Folder;

  if (isLast) {
    return (
      <span
        className="path-crumb-segment current"
        aria-current="page"
        title={`Current ${entryType}: ${segment.label}`}
      >
        <SegmentIcon size={14} />
        <span>{segment.label}</span>
      </span>
    );
  }

  return (
    <button className="path-crumb-segment" type="button" title={`Open ${segment.path}`} onClick={openSegment}>
      <SegmentIcon size={14} />
      <span>{segment.label}</span>
    </button>
  );
}

function CodeBrowserRefPicker({
  currentRef,
  branches,
  tags,
  refsLoading,
  hasCurrentRefOption,
  onSelectRef
}: {
  currentRef: string;
  branches: BranchSummary[];
  tags: TagSummary[];
  refsLoading: boolean;
  hasCurrentRefOption: boolean;
  onSelectRef(ref: string): void;
}): JSX.Element {
  const hasRefOptions = branches.length > 0 || tags.length > 0;

  function handleSelectRef(event: ChangeEvent<HTMLSelectElement>): void {
    onSelectRef(event.currentTarget.value);
  }

  return (
    <label className="ref-picker code-browser-ref-picker">
      <GitBranch size={16} />
      <select
        aria-label="File browser reference"
        disabled={refsLoading && !hasRefOptions}
        value={currentRef}
        onChange={handleSelectRef}
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
  );
}

function CodeBrowserHeader({
  repository,
  route,
  currentRef,
  branches,
  tags,
  refsLoading,
  hasCurrentRefOption,
  onOpenCodeBrowser,
  onSelectRef
}: {
  repository: RepositoryDetail;
  route: Extract<AppRoute, { kind: "codeBrowser" }>;
  currentRef: string;
  branches: BranchSummary[];
  tags: TagSummary[];
  refsLoading: boolean;
  hasCurrentRefOption: boolean;
  onOpenCodeBrowser(path: string, entryType: "file" | "dir", ref?: string | null, line?: number | null): void;
  onSelectRef(ref: string): void;
}): JSX.Element {
  const segments = pathSegments(route.path);

  function openRepositoryRoot(): void {
    onOpenCodeBrowser("", "dir", currentRef, null);
  }

  return (
    <header className="code-browser-header">
      <nav className="path-crumbs" aria-label="File path">
        {segments.length === 0 ? (
          <span
            className="path-crumb-segment current"
            aria-current="page"
            title={`Current directory: ${repository.name}`}
          >
            <Folder size={14} />
            <span>{repository.name}</span>
          </span>
        ) : (
          <button
            className="path-crumb-segment"
            type="button"
            title={`Open ${repository.name} repository root`}
            onClick={openRepositoryRoot}
          >
            <Folder size={14} />
            <span>{repository.name}</span>
          </button>
        )}
        {segments.map((segment, index) => (
          <Fragment key={segment.path}>
            <ChevronRight className="path-crumb-separator" size={14} aria-hidden="true" />
            <CodeBrowserPathSegment
              segment={segment}
              isLast={index === segments.length - 1}
              entryType={index === segments.length - 1 ? route.entryType : "dir"}
              onOpenCodeBrowser={onOpenCodeBrowser}
            />
          </Fragment>
        ))}
      </nav>
      <div className="code-browser-header-actions">
        <CodeBrowserRefPicker
          currentRef={currentRef}
          branches={branches}
          tags={tags}
          refsLoading={refsLoading}
          hasCurrentRefOption={hasCurrentRefOption}
          onSelectRef={onSelectRef}
        />
      </div>
    </header>
  );
}

function CodeBrowserCachedModeBanner(): JSX.Element {
  return (
    <div className="cached-mode-banner" role="status">
      <Lock size={16} />
      <span>
        Cached mode. File content, commits, and tree data are loaded from local cache when available.
      </span>
    </div>
  );
}

function CodeBrowserPageErrors({
  refsError,
  refsAvailabilityMessage,
  error
}: {
  refsError: Error | null;
  refsAvailabilityMessage: string | null;
  error: Error | null;
}): JSX.Element {
  return (
    <>
      {refsError && <div className="error-state">Branch and tag list unavailable: {refsError.message}</div>}
      {refsAvailabilityMessage && <div className="error-state">{refsAvailabilityMessage}</div>}
      {error && <div className="error-state">{error.message}</div>}
    </>
  );
}

function FileToolbar({
  fileName,
  currentRef,
  highlightedLine,
  visibleCopyStatus,
  canCopyRaw,
  canOpenRaw,
  downloadUrl,
  onCopyFileContent,
  onOpenHistory,
  onOpenExternal
}: {
  fileName: string;
  currentRef: string;
  highlightedLine: number | null;
  visibleCopyStatus: string | null;
  canCopyRaw: boolean;
  canOpenRaw: boolean;
  downloadUrl: string | null | undefined;
  onCopyFileContent(): Promise<void>;
  onOpenHistory(): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function copyFileContent(): void {
    void onCopyFileContent();
  }

  function openRawFile(): void {
    if (downloadUrl) {
      onOpenExternal(downloadUrl);
    }
  }

  return (
    <div className="code-viewer-toolbar">
      <span>{fileName}</span>
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
          onClick={openRawFile}
        >
          <ExternalLink size={14} /> Open raw
        </button>
        <button
          type="button"
          disabled={!canOpenRaw}
          title={canOpenRaw ? undefined : "Raw file URL is unavailable"}
          onClick={openRawFile}
        >
          <Download size={14} /> Download
        </button>
        <button type="button" title="Jump to in-app file history" onClick={onOpenHistory}>
          <GitBranch size={14} /> History
        </button>
      </div>
    </div>
  );
}

function FileMetadata({
  fileContent,
  filePath,
  fileChangeSummary,
  fileLastCommit,
  highlightedLine,
  onOpenCommit
}: {
  fileContent: RepoFileContent | undefined;
  filePath: string;
  fileChangeSummary: string | null;
  fileLastCommit: CommitRecentCommit | null;
  highlightedLine: number | null;
  onOpenCommit(
    commit: CommitRecentCommit,
    path: string,
    entryType: CodeBrowserEntryType,
    line?: number | null
  ): void;
}): JSX.Element | null {
  if (!fileContent?.lastCommitSha) {
    return null;
  }

  function openLastCommit(): void {
    if (fileLastCommit) {
      onOpenCommit(fileLastCommit, filePath, "file", highlightedLine);
    }
  }

  return (
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
        onClick={openLastCommit}
      >
        {fileContent.lastCommitSha.slice(0, 7)}
      </button>
    </div>
  );
}

function FilePreview({
  fileError,
  fileContent,
  fileAvailabilityMessage,
  fileLoading,
  fileKind,
  filePath,
  highlightedLine,
  previewAsImage,
  previewAsMarkdown,
  markdownUrlContext,
  onOpenExternal
}: {
  fileError: Error | null;
  fileContent: RepoFileContent | undefined;
  fileAvailabilityMessage: string | null;
  fileLoading: boolean;
  fileKind: RepoFileContent["kind"] | null;
  filePath: string;
  highlightedLine: number | null;
  previewAsImage: boolean;
  previewAsMarkdown: boolean;
  markdownUrlContext: MarkdownUrlContext;
  onOpenExternal(url: string): void;
}): JSX.Element {
  if (fileError && !fileContent) {
    return <div className="error-state">File unavailable: {fileError.message}</div>;
  }

  if (fileAvailabilityMessage && !fileContent && !fileLoading) {
    return <div className="error-state">{fileAvailabilityMessage}</div>;
  }

  if (fileLoading) {
    return <div className="loading-state">Loading file…</div>;
  }

  if (previewAsImage && fileContent?.downloadUrl) {
    return (
      <div className="code-image-preview">
        <img src={fileContent.downloadUrl} alt={fileContent.name} />
      </div>
    );
  }

  if (fileKind === "image") {
    return (
      <div className="binary-file-fallback">
        <FileIcon size={28} />
        <strong>Image preview unavailable</strong>
        <span>{fileContent?.message ?? "Raw image URL is unavailable for this file."}</span>
      </div>
    );
  }

  if (previewAsMarkdown) {
    return (
      <div className="code-markdown-preview">
        <MarkdownBody
          markdown={fileContent?.content ?? ""}
          emptyText="This markdown file has no rendered content."
          onOpenExternal={onOpenExternal}
          urlContext={markdownUrlContext}
        />
      </div>
    );
  }

  if (fileKind === "binary") {
    return (
      <div className="binary-file-fallback">
        <FileIcon size={28} />
        <strong>Binary preview unavailable</strong>
        <span>{fileContent?.message ?? "Open the raw file to inspect or download it from GitHub."}</span>
      </div>
    );
  }

  if (fileKind === "too_large") {
    return (
      <div className="binary-file-fallback">
        <FileIcon size={28} />
        <strong>Large file preview skipped</strong>
        <span>
          {fileContent?.message ?? "Preview was skipped for this large file."}
          {typeof fileContent?.size === "number" ? ` Size: ${formatFileSize(fileContent.size)}.` : ""}
        </span>
      </div>
    );
  }

  if (fileKind === "unavailable") {
    return (
      <div className="binary-file-fallback">
        <FileIcon size={28} />
        <strong>File preview unavailable</strong>
        <span>{fileContent?.message ?? "GitHub did not return previewable file content."}</span>
      </div>
    );
  }

  if (fileContent && fileKind === "text" && fileContent.content !== null) {
    return (
      <CodeSourceView
        content={fileContent.content}
        fileSize={fileContent.size}
        highlightedLine={highlightedLine}
        path={filePath}
      />
    );
  }

  return <div className="empty-state">No file preview is available.</div>;
}

function FileViewer({
  repository,
  route,
  currentRef,
  fileContent,
  fileLoading,
  fileError,
  fileAvailabilityMessage,
  highlightedLine,
  visibleCopyStatus,
  historyPanelRef,
  onCopyFileContent,
  onOpenCommit,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  route: CodeBrowserRoute;
  currentRef: string;
  fileContent: RepoFileContent | undefined;
  fileLoading: boolean;
  fileError: Error | null;
  fileAvailabilityMessage: string | null;
  highlightedLine: number | null;
  visibleCopyStatus: string | null;
  historyPanelRef: RefObject<HTMLDivElement | null>;
  onCopyFileContent(): Promise<void>;
  onOpenCommit(
    commit: CommitRecentCommit,
    path: string,
    entryType: CodeBrowserEntryType,
    line?: number | null
  ): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const filePath = fileContent?.path ?? route.path;
  const fileKind = fileContent?.kind ?? null;
  const canOpenRaw = Boolean(fileContent?.downloadUrl) && !fileLoading;
  const hasFileContent = Boolean(fileContent) && !fileLoading;
  const canCopyRaw = hasFileContent && fileKind === "text" && fileContent?.content !== null;
  const fileName = fileContent?.name ?? route.path.split("/").pop() ?? route.path;
  const previewAsImage =
    fileKind === "image" && Boolean(fileContent?.downloadUrl) && isPreviewableImagePath(filePath);
  const previewAsMarkdown =
    fileKind === "text" && fileContent?.content !== null && !previewAsImage && isMarkdownPath(filePath);
  const markdownUrlContext = markdownRepositoryUrlContext(repository, currentRef, parentDirectory(filePath));
  const fileChangeSummary = fileCommitChangeSummary(fileContent);
  const fileLastCommit = fileContent ? repoFileContentRecentCommit(fileContent) : null;
  const fileLastCommitUnavailableMessage =
    fileContent && !fileContent.lastCommitSha
      ? readAvailabilityMessage("File last change", fileContent.lastCommitAvailability)
      : null;

  function openFileHistory(): void {
    historyPanelRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  return (
    <section className="code-viewer">
      <FileToolbar
        fileName={fileName}
        currentRef={currentRef}
        highlightedLine={highlightedLine}
        visibleCopyStatus={visibleCopyStatus}
        canCopyRaw={canCopyRaw}
        canOpenRaw={canOpenRaw}
        downloadUrl={fileContent?.downloadUrl}
        onCopyFileContent={onCopyFileContent}
        onOpenHistory={openFileHistory}
        onOpenExternal={onOpenExternal}
      />
      {!fileLoading && (
        <FileMetadata
          fileContent={fileContent}
          filePath={filePath}
          fileChangeSummary={fileChangeSummary}
          fileLastCommit={fileLastCommit}
          highlightedLine={highlightedLine}
          onOpenCommit={onOpenCommit}
        />
      )}
      {!fileLoading && fileLastCommitUnavailableMessage && (
        <div className="error-state">{fileLastCommitUnavailableMessage}</div>
      )}
      {fileError && fileContent && (
        <div className="error-state">File refresh failed: {fileError.message}</div>
      )}
      <FilePreview
        fileError={fileError}
        fileContent={fileContent}
        fileAvailabilityMessage={fileAvailabilityMessage}
        fileLoading={fileLoading}
        fileKind={fileKind}
        filePath={filePath}
        highlightedLine={highlightedLine}
        previewAsImage={previewAsImage}
        previewAsMarkdown={previewAsMarkdown}
        markdownUrlContext={markdownUrlContext}
        onOpenExternal={onOpenExternal}
      />
    </section>
  );
}

function ParentDirectoryRow({
  path,
  onOpenCodeBrowser
}: {
  path: string;
  onOpenCodeBrowser(
    path: string,
    entryType: CodeBrowserEntryType,
    ref?: string | null,
    line?: number | null
  ): void;
}): JSX.Element {
  function openParentDirectory(): void {
    onOpenCodeBrowser(parentDirectory(path), "dir");
  }

  return (
    <button type="button" className="file-row static-file-row" onClick={openParentDirectory}>
      <Folder size={17} />
      <strong>..</strong>
      <span>Parent directory</span>
      <time />
    </button>
  );
}

function DirectoryEntryRow({
  entry,
  repository,
  onOpenCodeBrowser
}: {
  entry: RepoEntry;
  repository: RepositoryDetail;
  onOpenCodeBrowser(
    path: string,
    entryType: CodeBrowserEntryType,
    ref?: string | null,
    line?: number | null
  ): void;
}): JSX.Element {
  const entryType = entry.type === "dir" ? "dir" : "file";
  const lastChangeDate =
    entry.lastCommitAvailability.status === "available"
      ? formatRelativeDate(entry.lastCommitDate ?? repositoryActivityDate(repository))
      : "";

  function openEntry(): void {
    onOpenCodeBrowser(entry.path, entryType);
  }

  return (
    <button
      className="file-row static-file-row"
      key={entry.sha}
      type="button"
      onClick={openEntry}
      title={entryBrowseTitle(entry)}
    >
      <EntryIcon entry={entry} />
      <strong>{entry.name}</strong>
      <span>{entryLastChangeLabel(entry)}</span>
      <time>{lastChangeDate}</time>
    </button>
  );
}

function DirectoryBrowser({
  repository,
  route,
  currentRef,
  contents,
  contentsLoading,
  contentsError,
  contentsAvailabilityMessage,
  onOpenCodeBrowser
}: {
  repository: RepositoryDetail;
  route: CodeBrowserRoute;
  currentRef: string;
  contents: RepoEntry[];
  contentsLoading: boolean;
  contentsError: Error | null;
  contentsAvailabilityMessage: string | null;
  onOpenCodeBrowser(
    path: string,
    entryType: CodeBrowserEntryType,
    ref?: string | null,
    line?: number | null
  ): void;
}): JSX.Element {
  return (
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
          {contentsError && <div className="error-state">Folder refresh failed: {contentsError.message}</div>}
          {contentsAvailabilityMessage && (
            <div className="error-state">Folder refresh failed: {contentsAvailabilityMessage}</div>
          )}
          {route.path && <ParentDirectoryRow path={route.path} onOpenCodeBrowser={onOpenCodeBrowser} />}
          {contents.map((item) => (
            <DirectoryEntryRow
              key={item.sha}
              entry={item}
              repository={repository}
              onOpenCodeBrowser={onOpenCodeBrowser}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FileHistorySection({
  historyPanelRef,
  currentRef,
  filePath,
  highlightedLine,
  commits,
  commitsLimit,
  commitsLoading,
  commitsError,
  commitsAvailabilityMessage,
  historyUrl,
  onExpandCommits,
  onOpenCommit,
  onOpenExternal
}: {
  historyPanelRef: RefObject<HTMLDivElement | null>;
  currentRef: string;
  filePath: string;
  highlightedLine: number | null;
  commits: RepositoryCommitSummary[];
  commitsLimit: number;
  commitsLoading: boolean;
  commitsError: Error | null;
  commitsAvailabilityMessage: string | null;
  historyUrl: string | null;
  onExpandCommits(): void;
  onOpenCommit(
    commit: CommitRecentCommit,
    path: string,
    entryType: CodeBrowserEntryType,
    line?: number | null
  ): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function openCommit(commit: RepositoryCommitSummary): void {
    onOpenCommit(commit, filePath, "file", highlightedLine);
  }

  return (
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
        onOpenCommit={openCommit}
        onOpenExternal={onOpenExternal}
      />
    </div>
  );
}

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
  onOpenCodeBrowser,
  onOpenCommit,
  onSelectRef,
  onExpandCommits,
  onOpenExternal
}: CodeBrowserPageProps): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<{ key: string; label: string } | null>(null);
  const historyPanelRef = useRef<HTMLDivElement | null>(null);

  if (!repository && (error || availabilityMessage)) {
    const routeLine = normalizeCodeLineNumber(route.line);
    const browserUrl = `https://github.com/${route.nameWithOwner}/${
      route.entryType === "dir" ? "tree" : "blob"
    }/${encodeURIComponent(route.ref ?? "HEAD")}/${encodeRepositoryPath(route.path)}${routeLine ? `#L${routeLine}` : ""}`;

    return (
      <CodeBrowserLoadError
        message={error?.message ?? availabilityMessage}
        browserUrl={browserUrl}
        onRefresh={onRefresh}
        onOpenExternal={onOpenExternal}
      />
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
  const hasCurrentRefOption =
    branches.some((branch) => branch.name === currentRef) || tags.some((tag) => tag.name === currentRef);
  const fileStatusKey = `${route.nameWithOwner}:${route.ref ?? ""}:${route.path}:${highlightedLine ?? ""}`;
  const visibleCopyStatus = copyStatus?.key === fileStatusKey ? copyStatus.label : null;
  const filePath = fileContent?.path ?? route.path;
  const historyUrl = filePath
    ? repositoryPath(
        repository,
        `/commits/${encodeURIComponent(currentRef)}/${encodeRepositoryPath(filePath)}`
      )
    : null;

  const copyFileContent = async (): Promise<void> => {
    const hasFileContent = Boolean(fileContent) && !fileLoading;
    const canCopyRaw = hasFileContent && fileContent?.kind === "text" && fileContent.content !== null;

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
      <CodeBrowserHeader
        repository={repository}
        route={route}
        currentRef={currentRef}
        branches={branches}
        tags={tags}
        refsLoading={refsLoading}
        hasCurrentRefOption={hasCurrentRefOption}
        onOpenCodeBrowser={onOpenCodeBrowser}
        onSelectRef={onSelectRef}
      />

      {!githubReady && <CodeBrowserCachedModeBanner />}
      <CodeBrowserPageErrors
        refsError={refsError}
        refsAvailabilityMessage={refsAvailabilityMessage}
        error={error}
      />

      {isFile ? (
        <FileViewer
          repository={repository}
          route={route}
          currentRef={currentRef}
          fileContent={fileContent}
          fileLoading={fileLoading}
          fileError={fileError}
          fileAvailabilityMessage={fileAvailabilityMessage}
          highlightedLine={highlightedLine}
          visibleCopyStatus={visibleCopyStatus}
          historyPanelRef={historyPanelRef}
          onCopyFileContent={copyFileContent}
          onOpenCommit={onOpenCommit}
          onOpenExternal={onOpenExternal}
        />
      ) : (
        <DirectoryBrowser
          repository={repository}
          route={route}
          currentRef={currentRef}
          contents={contents}
          contentsLoading={contentsLoading}
          contentsError={contentsError}
          contentsAvailabilityMessage={contentsAvailabilityMessage}
          onOpenCodeBrowser={onOpenCodeBrowser}
        />
      )}
      {isFile && (
        <FileHistorySection
          historyPanelRef={historyPanelRef}
          currentRef={currentRef}
          filePath={filePath}
          highlightedLine={highlightedLine}
          commits={commits}
          commitsLimit={commitsLimit}
          commitsLoading={commitsLoading}
          commitsError={commitsError}
          commitsAvailabilityMessage={commitsAvailabilityMessage}
          historyUrl={historyUrl}
          onExpandCommits={onExpandCommits}
          onOpenCommit={onOpenCommit}
          onOpenExternal={onOpenExternal}
        />
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
