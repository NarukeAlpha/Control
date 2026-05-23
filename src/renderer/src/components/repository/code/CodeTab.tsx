import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  File as FileIcon,
  Folder,
  GitBranch,
  Search,
  Tag
} from "lucide-react";
import { useMemo, useRef, useState, type JSX } from "react";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import type {
  BranchSummary,
  RepoContentsResult,
  RepoEntry,
  RepoReadmeResult,
  RepoFileContent,
  RepoFileContentResult,
  RepositoryCommitListResult,
  RepositoryDetail,
  RepositorySummary,
  TagSummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { MarkdownBody, markdownRepositoryUrlContext } from "@renderer/components/MarkdownBody";

import { isMarkdownPath, isReadmeMarkdownPath } from "@renderer/components/code-browser/codeBrowserUi";
import { readAvailabilityMessage } from "@renderer/components/repository/repositoryUi";
import { useControlApi } from "@renderer/hooks/useControlApi";

import { firstMarkdownHeading, formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";

const expandedRefListLimit = 200;
const emptyCodeTabEntries: RepoEntry[] = [];

export interface CodeTabQueryInput {
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch: string | null | undefined;
  commitHistoryLimit: number;
  selectedRootMarkdownPath: string | null;
  enabled: boolean;
  githubReady: boolean;
}

export interface CodeTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch?: string | null;
  commitHistoryLimit: number;
  selectedRootMarkdownPath?: string | null;
  githubReady: boolean;
}

export function codeTabContentsQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null
): readonly ["contents", string, string, string, "", "dir"] {
  return ["contents", owner, repo, selectedRef ?? "default", "", "dir"] as const;
}

export function codeTabReadmeQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null
): readonly ["readme", string, string, string] {
  return ["readme", owner, repo, selectedRef ?? "default"] as const;
}

export function codeTabRootMarkdownContentQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  path: string | null
): readonly ["file-content", string, string, string, string] {
  return ["file-content", owner, repo, selectedRef ?? "default", path ?? ""] as const;
}

export function codeTabCommitsQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  limit: number
): readonly ["commits", string, string, string, "", number] {
  return ["commits", owner, repo, selectedRef ?? "default", "", limit] as const;
}

function rootMarkdownItemsFor(contents: RepoEntry[]): RepoEntry[] {
  return contents.filter(
    (item) =>
      item.type === "file" &&
      !item.path.includes("/") &&
      isMarkdownPath(item.path) &&
      !isReadmeMarkdownPath(item.path)
  );
}

function selectedRootMarkdownPathFor(
  rootMarkdownItems: RepoEntry[],
  selectedRootMarkdownPath: string | null | undefined
): string | null {
  return rootMarkdownItems.some((item) => item.path === selectedRootMarkdownPath)
    ? (selectedRootMarkdownPath ?? null)
    : (rootMarkdownItems[0]?.path ?? null);
}

export function useCodeTabQueries({
  owner,
  repo,
  selectedRef,
  defaultBranch,
  commitHistoryLimit,
  selectedRootMarkdownPath,
  enabled,
  githubReady
}: CodeTabQueryInput) {
  const api = useControlApi();
  const ref = selectedRef ?? undefined;
  const commitRef = selectedRef ?? defaultBranch ?? undefined;

  const contents = useQuery<RepoContentsResult>({
    queryKey: codeTabContentsQueryKey(owner, repo, selectedRef),
    queryFn: () =>
      api.github.listContentsWithStatus({
        owner,
        repo,
        ref,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 120_000
  });

  const readme = useQuery<RepoReadmeResult>({
    queryKey: codeTabReadmeQueryKey(owner, repo, selectedRef),
    queryFn: () => api.github.getReadme({ owner, repo, ref, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  const repositoryCommits = useQuery<RepositoryCommitListResult>({
    queryKey: codeTabCommitsQueryKey(owner, repo, selectedRef, commitHistoryLimit),
    queryFn: () =>
      api.github.listCommitsWithStatus({
        owner,
        repo,
        ref: commitRef,
        limit: commitHistoryLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const contentItems = contents.data?.items ?? emptyCodeTabEntries;
  const rootMarkdownItems = useMemo(() => rootMarkdownItemsFor(contentItems), [contentItems]);
  const effectiveSelectedRootMarkdownPath = selectedRootMarkdownPathFor(
    rootMarkdownItems,
    selectedRootMarkdownPath
  );

  const rootMarkdownContent = useQuery<RepoFileContentResult>({
    queryKey: codeTabRootMarkdownContentQueryKey(owner, repo, selectedRef, effectiveSelectedRootMarkdownPath),
    queryFn: () =>
      api.github.getFileContentWithStatus({
        owner,
        repo,
        path: effectiveSelectedRootMarkdownPath ?? "",
        ref,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(effectiveSelectedRootMarkdownPath),
    staleTime: 120_000
  });

  return {
    contents,
    readme,
    repositoryCommits,
    rootMarkdownContent,
    contentItems,
    contentsAvailability: contents.data?.availability ?? null,
    repositoryCommitItems: repositoryCommits.data?.items ?? [],
    repositoryCommitsAvailability: repositoryCommits.data?.availability ?? null,
    rootMarkdownItems,
    effectiveSelectedRootMarkdownPath
  };
}

export async function prefetchCodeTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    selectedRef,
    defaultBranch,
    commitHistoryLimit,
    selectedRootMarkdownPath,
    githubReady
  }: CodeTabPrefetchInput
): Promise<void> {
  const ref = selectedRef ?? undefined;
  const commitRef = selectedRef ?? defaultBranch ?? undefined;
  const contentsPromise = queryClient.fetchQuery({
    queryKey: codeTabContentsQueryKey(owner, repo, selectedRef),
    queryFn: () =>
      api.github.listContentsWithStatus({
        owner,
        repo,
        ref,
        cacheOnly: !githubReady
      }),
    staleTime: 120_000
  });

  await Promise.all([
    contentsPromise.then(async (contents) => {
      const rootMarkdownItems = rootMarkdownItemsFor(contents.items);
      const rootMarkdownPath = selectedRootMarkdownPathFor(rootMarkdownItems, selectedRootMarkdownPath);
      if (!rootMarkdownPath) {
        return;
      }

      await queryClient.prefetchQuery({
        queryKey: codeTabRootMarkdownContentQueryKey(owner, repo, selectedRef, rootMarkdownPath),
        queryFn: () =>
          api.github.getFileContentWithStatus({
            owner,
            repo,
            path: rootMarkdownPath,
            ref,
            cacheOnly: !githubReady
          }),
        staleTime: 120_000
      });
    }),
    queryClient.prefetchQuery({
      queryKey: codeTabReadmeQueryKey(owner, repo, selectedRef),
      queryFn: () => api.github.getReadme({ owner, repo, ref, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: codeTabCommitsQueryKey(owner, repo, selectedRef, commitHistoryLimit),
      queryFn: () =>
        api.github.listCommitsWithStatus({
          owner,
          repo,
          ref: commitRef,
          limit: commitHistoryLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    })
  ]);
}

function repositoryActivityDate(repository: RepositorySummary): string | null {
  return repository.pushedAt ?? repository.updatedAt;
}

const vscodeIconsVersion = "v12.17.0";
const vscodeIconsBaseUrl = `https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons@${vscodeIconsVersion}/icons`;

const folderIconNames: Record<string, string> = {
  ".github": "folder_type_github.svg",
  ".vscode": "folder_type_vscode.svg",
  docs: "folder_type_docs.svg",
  documentation: "folder_type_docs.svg",
  src: "folder_type_src.svg",
  source: "folder_type_src.svg",
  test: "folder_type_test.svg",
  tests: "folder_type_test.svg",
  lib: "folder_type_library.svg",
  packages: "folder_type_package.svg",
  scripts: "folder_type_tools.svg",
  assets: "folder_type_asset.svg"
};

const fileNameIconNames: Record<string, string> = {
  "package.json": "file_type_node.svg",
  "package-lock.json": "file_type_npm.svg",
  "pnpm-lock.yaml": "file_type_pnpm.svg",
  "yarn.lock": "file_type_yarn.svg",
  "bun.lockb": "file_type_bun.svg",
  "tsconfig.json": "file_type_tsconfig.svg",
  "vite.config.ts": "file_type_vite.svg",
  "vite.config.js": "file_type_vite.svg",
  "vitest.config.ts": "file_type_vitest.svg",
  "eslint.config.mjs": "file_type_eslint.svg",
  ".eslintrc": "file_type_eslint.svg",
  ".prettierrc": "file_type_prettier.svg",
  "prettier.config.cjs": "file_type_prettier.svg",
  "readme.md": "file_type_markdown.svg",
  license: "file_type_license.svg",
  "license.txt": "file_type_license.svg",
  "cmakelists.txt": "file_type_cmake.svg",
  ".gitignore": "file_type_git.svg",
  dockerfile: "file_type_docker.svg"
};

const extensionIconNames: Record<string, string> = {
  ts: "file_type_typescript.svg",
  tsx: "file_type_reactts.svg",
  js: "file_type_js.svg",
  jsx: "file_type_reactjs.svg",
  mjs: "file_type_js.svg",
  cjs: "file_type_js.svg",
  json: "file_type_json.svg",
  css: "file_type_css.svg",
  scss: "file_type_scss.svg",
  html: "file_type_html.svg",
  md: "file_type_markdown.svg",
  yml: "file_type_yaml.svg",
  yaml: "file_type_yaml.svg",
  toml: "file_type_toml.svg",
  xml: "file_type_xml.svg",
  sh: "file_type_shell.svg",
  zsh: "file_type_shell.svg",
  py: "file_type_python.svg",
  rb: "file_type_ruby.svg",
  go: "file_type_go.svg",
  rs: "file_type_rust.svg",
  swift: "file_type_swift.svg",
  c: "file_type_c.svg",
  h: "file_type_c.svg",
  cpp: "file_type_cpp.svg",
  hpp: "file_type_cpp.svg",
  java: "file_type_java.svg",
  kt: "file_type_kotlin.svg",
  php: "file_type_php.svg",
  png: "file_type_image.svg",
  jpg: "file_type_image.svg",
  jpeg: "file_type_image.svg",
  gif: "file_type_image.svg",
  svg: "file_type_svg.svg",
  pdf: "file_type_pdf.svg",
  zip: "file_type_zip.svg"
};

function fileExtension(path: string): string | null {
  const name = path.toLowerCase().split("/").pop() ?? "";
  return name.includes(".") ? (name.split(".").pop() ?? null) : null;
}

function iconUrlForEntry(entry: RepoEntry): string {
  if (entry.type === "dir") {
    const folderIcon = folderIconNames[entry.name.toLowerCase()] ?? "default_folder.svg";
    return `${vscodeIconsBaseUrl}/${folderIcon}`;
  }

  const lowerName = entry.name.toLowerCase();
  const fileNameIcon = fileNameIconNames[lowerName];
  if (fileNameIcon) {
    return `${vscodeIconsBaseUrl}/${fileNameIcon}`;
  }

  const extension = fileExtension(lowerName);
  return `${vscodeIconsBaseUrl}/${extension ? (extensionIconNames[extension] ?? "default_file.svg") : "default_file.svg"}`;
}

function EntryIcon({ entry }: { entry: RepoEntry }): JSX.Element {
  const iconUrl = useMemo(() => iconUrlForEntry(entry), [entry]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const failed = failedUrl === iconUrl;
  const loaded = loadedUrl === iconUrl;

  return (
    <span className="file-icon-wrap">
      {(!loaded || failed) && (entry.type === "dir" ? <Folder size={18} /> : <FileIcon size={17} />)}
      {!failed && (
        <img
          className={`file-type-icon ${loaded ? "loaded" : ""}`}
          src={iconUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onLoad={() => setLoadedUrl(iconUrl)}
          onError={() => setFailedUrl(iconUrl)}
        />
      )}
    </span>
  );
}

function entryFallbackAction(entry: RepoEntry): string {
  return entry.type === "dir" ? "Open folder" : "Open file";
}

function entryLastChangeLabel(entry: RepoEntry): string {
  if (entry.lastCommitAvailability.status !== "available") {
    if (entry.lastCommitAvailability.status === "not_loaded") {
      return "Last change not loaded";
    }
    return "Last change unavailable";
  }

  const message = entry.lastCommitMessage ?? entryFallbackAction(entry);
  const attribution = entry.lastCommitAuthorLogin ? `${message} by ${entry.lastCommitAuthorLogin}` : message;
  const changeSummary = fileCommitChangeSummary(entry);
  return changeSummary ? `${attribution} · ${changeSummary}` : attribution;
}

function entryBrowseTitle(entry: RepoEntry): string {
  const parts = [`Browse ${entry.path}`];

  if (entry.lastCommitAvailability.status !== "available") {
    const message = readAvailabilityMessage("File last change", entry.lastCommitAvailability);
    if (message) {
      parts.push(message);
    }
    return parts.join(" · ");
  }

  if (entry.lastCommitSha) {
    parts.push(`last changed in ${entry.lastCommitSha.slice(0, 7)}`);
  }
  if (entry.lastCommitAuthorLogin) {
    parts.push(`by ${entry.lastCommitAuthorLogin}`);
  }
  const changeSummary = fileCommitChangeSummary(entry);
  if (changeSummary) {
    parts.push(changeSummary);
  }

  return parts.join(" · ");
}

function fileCommitChangeSummary(file: RepoFileContent | RepoEntry | undefined): string | null {
  if (!file) {
    return null;
  }

  const parts = [
    file.lastCommitAdditions === null ? null : `+${file.lastCommitAdditions}`,
    file.lastCommitDeletions === null ? null : `-${file.lastCommitDeletions}`,
    file.lastCommitChanges === null ? null : `${file.lastCommitChanges} changed`
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : null;
}

export function CodeTab({
  repository,
  githubReady,
  selectedRef,
  branches,
  tags,
  refListLimit,
  refsLoading,
  refsError,
  refsAvailabilityMessage,
  commitHistoryLimit,
  onOpenCodeBrowser,
  onOpenExternal,
  onOpenFileFinder,
  onSelectRef,
  onExpandRefs
}: {
  repository: RepositoryDetail;
  githubReady: boolean;
  selectedRef: string | null;
  branches: BranchSummary[];
  tags: TagSummary[];
  refListLimit: number;
  refsLoading: boolean;
  refsError: Error | null;
  refsAvailabilityMessage: string | null;
  commitHistoryLimit: number;
  onOpenCodeBrowser(entry: RepoEntry): void;
  onOpenExternal(url: string): void;
  onOpenFileFinder(): void;
  onSelectRef(ref: string | null): void;
  onExpandRefs(): void;
}): JSX.Element {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [selectedRootMarkdownPath, setSelectedRootMarkdownPath] = useState<string | null>(null);
  const {
    contents,
    readme,
    rootMarkdownContent,
    contentItems,
    contentsAvailability,
    rootMarkdownItems,
    effectiveSelectedRootMarkdownPath
  } = useCodeTabQueries({
    owner: repository.owner,
    repo: repository.name,
    selectedRef,
    defaultBranch: repository.defaultBranch,
    commitHistoryLimit,
    selectedRootMarkdownPath,
    enabled: true,
    githubReady
  });
  const readmeMarkdown = readme.data?.markdown ?? repository.readmeMarkdown ?? null;
  const readmeAvailability = readme.data?.availability ?? null;
  const readmeLoading = readme.isLoading || readme.isFetching;
  const readmeError = readme.error;
  const contentsLoading = contents.isLoading || contents.isFetching;
  const contentsError = contents.error;
  const rootMarkdownData = rootMarkdownContent.data ?? null;
  const rootMarkdownLoading = rootMarkdownContent.isLoading || rootMarkdownContent.isFetching;
  const rootMarkdownError = rootMarkdownContent.error;
  const repositoryUpdatedAt = repositoryActivityDate(repository);
  const currentRef = selectedRef ?? repository.defaultBranch ?? "HEAD";
  const contentsAvailabilityMessage = readAvailabilityMessage("Repository contents", contentsAvailability);
  const readmeAvailabilityMessage = readAvailabilityMessage("README", readmeAvailability);
  const rootMarkdownAvailabilityMessage = readAvailabilityMessage(
    effectiveSelectedRootMarkdownPath ?? "Root markdown",
    rootMarkdownData?.availability ?? null
  );
  const selectedRootMarkdownName =
    rootMarkdownItems.find((item) => item.path === effectiveSelectedRootMarkdownPath)?.name ??
    effectiveSelectedRootMarkdownPath;
  const readmeEmptyMessage =
    !readmeMarkdown && readmeAvailability?.status === "available" && readmeAvailability.message
      ? readmeAvailability.message
      : "No project README returned.";
  const refOptions = [
    ...branches.map((branch) => ({ kind: "branch" as const, name: branch.name })),
    ...tags.map((tag) => ({ kind: "tag" as const, name: tag.name }))
  ];
  const hasCurrentRefOption = refOptions.some((option) => option.name === currentRef);
  const refsExceedLoadedCounts =
    branches.length < repository.branchCount || tags.length < repository.tagCount;
  const canExpandRefs = refsExceedLoadedCounts && refListLimit < expandedRefListLimit;
  const refsLimitNote =
    refsExceedLoadedCounts && refListLimit >= expandedRefListLimit
      ? `Showing the first ${expandedRefListLimit} refs.`
      : null;
  const virtualizer = useVirtualizer({
    count: contentItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 8
  });
  const virtualRows = virtualizer.getVirtualItems();
  const visibleFileRows =
    virtualRows.length > 0 ? virtualRows : contentItems.map((_, index) => ({ index, start: index * 36 }));

  return (
    <section className="code-layout">
      <div className="code-toolbar glass-panel">
        <div className="code-toolbar-left">
          <label className="ref-picker">
            <GitBranch size={16} />
            <select
              aria-label="Code reference"
              disabled={refsLoading && refOptions.length === 0}
              value={currentRef}
              onChange={(event) => onSelectRef(event.currentTarget.value || null)}
            >
              {!hasCurrentRefOption && <option value={currentRef}>{currentRef}</option>}
              {branches.length > 0 && (
                <optgroup label="Branches">
                  {branches.map((branch) => (
                    <option key={`branch-${branch.name}`} value={branch.name}>
                      {branch.name}
                      {branch.protected ? " (protected)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {tags.length > 0 && (
                <optgroup label="Tags">
                  {tags.map((tag) => (
                    <option key={`tag-${tag.name}`} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <button className="go-to-file-button" type="button" onClick={onOpenFileFinder}>
          <Search size={16} />
          <span>Go to file</span>
        </button>
        <div className="code-toolbar-right">
          <span className="code-ref-stats">
            <span>
              <GitBranch size={15} /> {formatCompactNumber(repository.branchCount)} branches
            </span>
            <span>
              <Tag size={15} /> {formatCompactNumber(repository.tagCount)} tags
            </span>
          </span>
          {canExpandRefs && (
            <button className="code-ref-extra" type="button" onClick={onExpandRefs}>
              Load more refs
            </button>
          )}
          {refsLimitNote && <span className="code-ref-extra">{refsLimitNote}</span>}
        </div>
      </div>
      {refsError && <div className="error-state">Branch and tag list unavailable: {refsError.message}</div>}
      {refsAvailabilityMessage && <div className="error-state">{refsAvailabilityMessage}</div>}

      <div className="file-table">
        <div className="commit-row">
          <span className="mini-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
          <strong>{repository.owner}</strong>
          <span>{repository.description ?? `${repository.name} repository`}</span>
          <CheckCircle2 size={16} />
          <small>{repository.defaultBranch ?? "HEAD"}</small>
          <small>{formatRelativeDate(repositoryUpdatedAt)}</small>
          <small>updated</small>
        </div>
        <div className="virtual-file-list" ref={parentRef}>
          {contentsError && contentItems.length === 0 ? (
            <div className="error-state">Repository files unavailable: {contentsError.message}</div>
          ) : contentsLoading && contentItems.length === 0 ? (
            <div className="loading-state">Loading files…</div>
          ) : contentsAvailabilityMessage && contentItems.length === 0 ? (
            <div className="error-state">{contentsAvailabilityMessage}</div>
          ) : !contentsError && contentItems.length === 0 ? (
            <div className="empty-state">No files returned for this repository path.</div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {contentsError && (
                <div className="error-state">Repository files refresh failed: {contentsError.message}</div>
              )}
              {contentsAvailabilityMessage && (
                <div className="error-state">
                  Repository files refresh failed: {contentsAvailabilityMessage}
                </div>
              )}
              {visibleFileRows.map((virtualRow) => {
                const item = contentItems[virtualRow.index];
                return (
                  <button
                    className="file-row"
                    key={item.sha}
                    type="button"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => onOpenCodeBrowser(item)}
                    title={entryBrowseTitle(item)}
                  >
                    <EntryIcon entry={item} />
                    <strong>{item.name}</strong>
                    <span>{entryLastChangeLabel(item)}</span>
                    <time>
                      {item.lastCommitAvailability.status === "available"
                        ? formatRelativeDate(item.lastCommitDate ?? repositoryUpdatedAt)
                        : ""}
                    </time>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <section className="readme-panel">
        <header>
          <BookOpen size={17} />
          <span>README.md</span>
        </header>
        <div className="readme-content">
          {readmeError && !readmeMarkdown ? (
            <div className="error-state">README unavailable: {readmeError.message}</div>
          ) : readmeLoading && !readmeMarkdown ? (
            <div className="loading-state">Loading README…</div>
          ) : readmeAvailabilityMessage && !readmeMarkdown ? (
            <div className="error-state">{readmeAvailabilityMessage}</div>
          ) : (
            <>
              {readmeError && <div className="error-state">README refresh failed: {readmeError.message}</div>}
              {readmeAvailabilityMessage && (
                <div className="error-state">README refresh failed: {readmeAvailabilityMessage}</div>
              )}
              <MarkdownBody
                markdown={readmeMarkdown}
                emptyText={
                  readmeMarkdown
                    ? `${firstMarkdownHeading(readmeMarkdown)} content is available from GitHub.`
                    : readmeEmptyMessage
                }
                onOpenExternal={onOpenExternal}
                urlContext={markdownRepositoryUrlContext(repository, currentRef)}
              />
            </>
          )}
        </div>
      </section>

      {rootMarkdownItems.length > 0 && (
        <section className="readme-panel root-markdown-panel">
          <header>
            <BookOpen size={17} />
            <span>Root markdown</span>
            <small>{rootMarkdownItems.length} docs</small>
          </header>
          <div className="root-markdown-tabs" role="tablist" aria-label="Root markdown files">
            {rootMarkdownItems.map((item) => (
              <button
                key={item.path}
                className={item.path === effectiveSelectedRootMarkdownPath ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={item.path === effectiveSelectedRootMarkdownPath}
                onClick={() => setSelectedRootMarkdownPath(item.path)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="readme-content root-markdown-preview">
            {rootMarkdownError && !rootMarkdownData?.item ? (
              <div className="error-state">Markdown unavailable: {rootMarkdownError.message}</div>
            ) : rootMarkdownLoading && !rootMarkdownData?.item ? (
              <div className="loading-state">Loading {selectedRootMarkdownName ?? "markdown"}…</div>
            ) : rootMarkdownAvailabilityMessage && !rootMarkdownData?.item ? (
              <div className="error-state">{rootMarkdownAvailabilityMessage}</div>
            ) : (
              <>
                {rootMarkdownError && (
                  <div className="error-state">Markdown refresh failed: {rootMarkdownError.message}</div>
                )}
                {rootMarkdownAvailabilityMessage && (
                  <div className="error-state">
                    Markdown refresh failed: {rootMarkdownAvailabilityMessage}
                  </div>
                )}
                <MarkdownBody
                  markdown={rootMarkdownData?.item?.content ?? null}
                  emptyText={
                    selectedRootMarkdownName
                      ? `${selectedRootMarkdownName} is empty or could not be rendered.`
                      : "No root markdown content returned."
                  }
                  onOpenExternal={onOpenExternal}
                  urlContext={markdownRepositoryUrlContext(repository, currentRef)}
                />
              </>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
