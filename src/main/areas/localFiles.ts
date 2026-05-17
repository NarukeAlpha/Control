import { readdir, readFile, stat } from "node:fs/promises";
import { join, normalize, relative, resolve, sep } from "node:path";

import type { AreaFileContent, AreaFileEntry } from "@shared/areas";

const maxTextFileBytes = 512 * 1024;

export async function listLocalDirectory(
  rootPath: string,
  requestedPath: string | null = null
): Promise<AreaFileEntry[]> {
  const directoryPath = resolveInsideRoot(rootPath, requestedPath ?? ".");
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const rows = await Promise.all(
    entries
      .filter((entry) => entry.name !== ".git" && entry.name !== ".jj")
      .map(async (entry): Promise<AreaFileEntry> => {
        const absolutePath = join(directoryPath, entry.name);
        const relativePath = normalize(relative(rootPath, absolutePath)).split(sep).join("/");
        const entryStat = await stat(absolutePath).catch(() => null);
        return {
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory()
            ? "dir"
            : entry.isFile()
              ? "file"
              : entry.isSymbolicLink()
                ? "symlink"
                : "other",
          size: entryStat?.size ?? null,
          updatedAt: entryStat?.mtime ? entryStat.mtime.toISOString() : null
        };
      })
  );
  return rows.sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") {
      return -1;
    }
    if (a.type !== "dir" && b.type === "dir") {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function readLocalFileContent(
  rootPath: string,
  requestedPath: string
): Promise<AreaFileContent> {
  const filePath = resolveInsideRoot(rootPath, requestedPath);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat || !fileStat.isFile()) {
    return unavailableFile(requestedPath, "File is unavailable.");
  }
  if (fileStat.size > maxTextFileBytes) {
    return {
      path: requestedPath,
      kind: "binary",
      text: null,
      encoding: null,
      size: fileStat.size,
      message: "File is too large for the local text preview."
    };
  }

  const bytes = await readFile(filePath);
  if (bytes.includes(0)) {
    return {
      path: requestedPath,
      kind: "binary",
      text: null,
      encoding: null,
      size: fileStat.size,
      message: "Binary files are not previewed."
    };
  }

  return {
    path: requestedPath,
    kind: "text",
    text: bytes.toString("utf8"),
    encoding: "utf-8",
    size: fileStat.size,
    message: null
  };
}

function resolveInsideRoot(rootPath: string, requestedPath: string): string {
  const root = resolve(rootPath);
  const target = resolve(root, requestedPath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Local file path escapes the repository root.");
  }
  return target;
}

function unavailableFile(path: string, message: string): AreaFileContent {
  return {
    path,
    kind: "unavailable",
    text: null,
    encoding: null,
    size: null,
    message
  };
}
