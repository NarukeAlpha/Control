import { File as FileIcon, Folder } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import type { RepoEntry, RepoFileContent, RepositoryDetail } from "@shared/github";

import { readAvailabilityMessage, repositoryPath } from "../repository/repositoryUi";

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

const previewableImageExtensions = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const markdownFileExtensions = new Set(["md", "markdown", "mdown", "mdx", "mkd"]);
const binaryFileExtensions = new Set([
  "7z",
  "avif",
  "bin",
  "bmp",
  "dmg",
  "exe",
  "gif",
  "gz",
  "ico",
  "jpeg",
  "jpg",
  "mov",
  "mp3",
  "mp4",
  "pdf",
  "png",
  "tar",
  "tgz",
  "webp",
  "woff",
  "woff2",
  "zip"
]);

export function encodeRepositoryPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function repositoryPathForEntryType(
  repository: RepositoryDetail,
  path: string,
  entryType: "file" | "dir",
  ref: string
): string {
  return repositoryPath(
    repository,
    `/${entryType === "dir" ? "tree" : "blob"}/${encodeURIComponent(ref)}/${encodeRepositoryPath(path)}`
  );
}

export function parentDirectory(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function pathSegments(path: string): Array<{ label: string; path: string }> {
  const parts = path.split("/").filter(Boolean);
  return parts.map((label, index) => ({
    label,
    path: parts.slice(0, index + 1).join("/")
  }));
}

function fileExtension(path: string): string | null {
  const name = path.toLowerCase().split("/").pop() ?? "";
  return name.includes(".") ? (name.split(".").pop() ?? null) : null;
}

export function isPreviewableImagePath(path: string): boolean {
  const extension = fileExtension(path);
  return extension ? previewableImageExtensions.has(extension) : false;
}

export function isMarkdownPath(path: string): boolean {
  const extension = fileExtension(path);
  return extension ? markdownFileExtensions.has(extension) : false;
}

export function isReadmeMarkdownPath(path: string): boolean {
  return /^readme(?:\.[^.]+)?\.(?:md|markdown)$/i.test(path.split("/").pop() ?? "");
}

export function isLikelyBinaryFile(path: string, content?: string | null): boolean {
  const extension = fileExtension(path);
  return Boolean(extension && binaryFileExtensions.has(extension)) || Boolean(content?.includes("\u0000"));
}

export function iconUrlForEntry(entry: RepoEntry): string {
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

export function EntryIcon({ entry }: { entry: RepoEntry }): JSX.Element {
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

export function fileCommitChangeSummary(file: RepoFileContent | RepoEntry | undefined): string | null {
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

export function entryLastChangeLabel(entry: RepoEntry): string {
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

export function entryBrowseTitle(entry: RepoEntry): string {
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

export function normalizeCodeLineNumber(line: number | null | undefined): number | null {
  return typeof line === "number" && Number.isInteger(line) && line > 0 ? line : null;
}
