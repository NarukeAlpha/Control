import { readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import type { AreaFileContent } from "@shared/areas";

import { readLocalFileContent } from "./localFiles";

interface LocalReadmeCacheEntry {
  fingerprint: string;
  value: AreaFileContent | null;
}

const localReadmeCache = new Map<string, LocalReadmeCacheEntry>();

export async function readLocalReadme(rootPath: string): Promise<AreaFileContent | null> {
  const entries = await readdir(rootPath).catch(() => []);
  const readme = entries.find((entry) => /^readme(?:\.(md|markdown|txt))?$/i.test(entry));
  if (!readme) {
    localReadmeCache.delete(rootPath);
    return null;
  }

  const readmePath = join(rootPath, readme);
  const readmeStat = await stat(readmePath).catch(() => null);
  if (!readmeStat?.isFile()) {
    localReadmeCache.delete(rootPath);
    return null;
  }

  const fingerprint = `${readmePath}:${readmeStat.mtimeMs}:${readmeStat.size}`;
  const cached = localReadmeCache.get(rootPath);
  if (cached?.fingerprint === fingerprint) {
    return cached.value;
  }

  const value = await readLocalFileContent(rootPath, basename(readme));
  localReadmeCache.set(rootPath, { fingerprint, value });
  return value;
}

export function clearLocalReadmeCache(rootPath?: string): void {
  if (rootPath) {
    localReadmeCache.delete(rootPath);
    return;
  }
  localReadmeCache.clear();
}
