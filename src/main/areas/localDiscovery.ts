import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type LocalRepositoryCandidateKind = "git" | "jj";

export interface LocalRepositoryCandidate {
  kind: LocalRepositoryCandidateKind;
  rootPath: string;
}

export const ignoredDirectoryNames = new Set([
  ".git",
  ".hg",
  ".jj",
  ".next",
  ".turbo",
  ".cache",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
  "venv"
]);

export interface DiscoverLocalRepositoriesOptions {
  maxDepth?: number;
  maxRepositories?: number;
}

export async function discoverLocalRepositories(
  rootPath: string,
  options: DiscoverLocalRepositoriesOptions = {}
): Promise<LocalRepositoryCandidate[]> {
  const maxDepth = options.maxDepth ?? 8;
  const maxRepositories = options.maxRepositories ?? 500;
  const candidates: LocalRepositoryCandidate[] = [];

  async function visit(directoryPath: string, depth: number): Promise<void> {
    if (depth > maxDepth || candidates.length >= maxRepositories) {
      return;
    }

    const entries = await readdir(directoryPath, { withFileTypes: true }).catch(() => []);
    const hasJj = entries.some((entry) => entry.name === ".jj" && entry.isDirectory());
    const hasGit = entries.some((entry) => entry.name === ".git" && (entry.isDirectory() || entry.isFile()));

    if (hasJj || hasGit) {
      candidates.push({ kind: hasJj ? "jj" : "git", rootPath: directoryPath });
      return;
    }

    for (const entry of entries) {
      if (candidates.length >= maxRepositories) {
        return;
      }
      if (!entry.isDirectory() || ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      await visit(join(directoryPath, entry.name), depth + 1);
    }
  }

  await visit(rootPath, 0);
  return candidates;
}
