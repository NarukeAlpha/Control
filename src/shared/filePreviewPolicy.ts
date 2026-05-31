export const maxPreviewBytes = 2 * 1024 * 1024;

const markdownFileExtensions = new Set(["md", "markdown", "mdown", "mdx", "mkd", "mkdn"]);
const previewableImageExtensions = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const binaryFileExtensions = new Set([
  "7z",
  "bin",
  "bmp",
  "dmg",
  "exe",
  "gz",
  "ico",
  "mov",
  "mp3",
  "mp4",
  "pdf",
  "tar",
  "tgz",
  "woff",
  "woff2",
  "zip"
]);

export function fileNameFromPath(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function fileExtension(path: string): string | null {
  const name = fileNameFromPath(path).toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < name.length - 1 ? name.slice(dotIndex + 1) : null;
}

export function isMarkdownPath(path: string): boolean {
  const extension = fileExtension(path);
  return extension ? markdownFileExtensions.has(extension) : false;
}

export function isReadmeMarkdownPath(path: string): boolean {
  const name = fileNameFromPath(path);
  return /^readme(?:\.[^.]+)?\.(?:md|markdown|mdown|mdx|mkd|mkdn)$/i.test(name);
}

export function isPreviewableImagePath(path: string): boolean {
  const extension = fileExtension(path);
  return extension ? previewableImageExtensions.has(extension) : false;
}

export function isNonImageBinaryPath(path: string): boolean {
  const extension = fileExtension(path);
  return Boolean(extension && binaryFileExtensions.has(extension) && !isPreviewableImagePath(path));
}

export function contentHasNullByte(content: string): boolean {
  return content.includes("\u0000");
}
