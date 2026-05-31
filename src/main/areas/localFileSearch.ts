import type { Dirent } from "node:fs";
import { lstat, readdir, realpath } from "node:fs/promises";
import { basename, join, normalize, relative, sep } from "node:path";

import type { AreaFileEntry, AreaFileSearchResult } from "@shared/areas";

import { ignoredDirectoryNames } from "./localDiscovery";

export interface SearchLocalFilePathsInput {
  areaId: string;
  repositoryId: string;
  workspaceId: string | null;
  rootPath: string;
  query: string;
  limit: number;
}

interface SearchLocalFilePathsOptions {
  maxEntriesScanned?: number;
  timeoutMs?: number;
  maxDepth?: number;
}

interface ScanState {
  startedAt: number;
  scannedEntries: number;
  timedOut: boolean;
  hitScanCap: boolean;
  hitDepthCap: boolean;
  traversalErrored: boolean;
  matchedEntries: AreaFileEntry[];
}

const defaultMaxEntriesScanned = 20_000;
const defaultTimeoutMs = 750;
const defaultMaxDepth = 12;

export async function searchLocalFilePaths(
  input: SearchLocalFilePathsInput,
  options: SearchLocalFilePathsOptions = {}
): Promise<AreaFileSearchResult> {
  const query = input.query.trim();
  if (!query) {
    return unavailableSearch(input, "", "Enter a file name to search.");
  }

  const maxEntriesScanned = options.maxEntriesScanned ?? defaultMaxEntriesScanned;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const maxDepth = options.maxDepth ?? defaultMaxDepth;
  const limit = clampSearchLimit(input.limit);
  const resolvedRoot = await realpath(input.rootPath).catch(() => null);
  if (!resolvedRoot) {
    return unavailableSearch(input, query, "Local root is unavailable.");
  }

  const state: ScanState = {
    startedAt: Date.now(),
    scannedEntries: 0,
    timedOut: false,
    hitScanCap: false,
    hitDepthCap: false,
    traversalErrored: false,
    matchedEntries: []
  };

  const rootEntries = await readdir(resolvedRoot, { withFileTypes: true }).catch(() => null);
  if (!rootEntries) {
    return unavailableSearch(input, query, "Local root is unavailable.");
  }

  await scanEntries(resolvedRoot, rootEntries, 0, resolvedRoot, query.toLowerCase(), state, {
    maxEntriesScanned,
    timeoutMs,
    maxDepth
  });

  const sortedMatches = state.matchedEntries.sort((left, right) =>
    compareFileSearchMatches(left, right, query.toLowerCase())
  );
  const matches = sortedMatches.slice(0, limit);
  const truncated =
    sortedMatches.length > matches.length || state.hitScanCap || state.timedOut || state.hitDepthCap;
  const partial = state.hitScanCap || state.timedOut || state.hitDepthCap || state.traversalErrored;

  return {
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    workspaceId: input.workspaceId,
    query,
    matches,
    availability: {
      status: partial ? "partial" : "complete",
      message: partial ? partialSearchMessage(state) : null,
      scannedEntries: state.scannedEntries,
      truncated,
      timedOut: state.timedOut
    }
  };
}

function clampSearchLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 30;
  }
  return Math.min(50, Math.max(1, Math.trunc(limit)));
}

async function scanEntries(
  directoryPath: string,
  entries: Dirent[],
  depth: number,
  resolvedRoot: string,
  query: string,
  state: ScanState,
  limits: Required<SearchLocalFilePathsOptions>
): Promise<void> {
  for (const entry of entries) {
    if (!canContinueScan(state, limits)) {
      return;
    }
    if (ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const absolutePath = join(directoryPath, entry.name);
    const entryStat = await lstat(absolutePath).catch(() => null);
    state.scannedEntries += 1;
    if (!entryStat) {
      state.traversalErrored = true;
      continue;
    }

    const relativePath = normalize(relative(resolvedRoot, absolutePath)).split(sep).join("/");
    const fileEntry: AreaFileEntry = {
      name: entry.name,
      path: relativePath,
      type: entryStat.isDirectory()
        ? "dir"
        : entryStat.isFile()
          ? "file"
          : entryStat.isSymbolicLink()
            ? "symlink"
            : "other",
      size: entryStat.size,
      updatedAt: entryStat.mtime ? entryStat.mtime.toISOString() : null
    };

    if (fileEntry.path.toLowerCase().includes(query)) {
      state.matchedEntries.push(fileEntry);
    }

    if (!entryStat.isDirectory()) {
      continue;
    }
    if (depth >= limits.maxDepth) {
      state.hitDepthCap = true;
      continue;
    }

    const childEntries = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
    if (!childEntries) {
      state.traversalErrored = true;
      continue;
    }
    await scanEntries(absolutePath, childEntries, depth + 1, resolvedRoot, query, state, limits);
  }
}

function canContinueScan(
  state: ScanState,
  limits: Pick<Required<SearchLocalFilePathsOptions>, "maxEntriesScanned" | "timeoutMs">
): boolean {
  if (Date.now() - state.startedAt >= limits.timeoutMs) {
    state.timedOut = true;
    return false;
  }
  if (state.scannedEntries >= limits.maxEntriesScanned) {
    state.hitScanCap = true;
    return false;
  }
  return true;
}

function compareFileSearchMatches(left: AreaFileEntry, right: AreaFileEntry, query: string): number {
  const leftRank = matchRank(left, query);
  const rightRank = matchRank(right, query);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  if (left.path.length !== right.path.length) {
    return left.path.length - right.path.length;
  }
  return left.path.localeCompare(right.path);
}

function matchRank(entry: AreaFileEntry, query: string): number {
  const lowerPath = entry.path.toLowerCase();
  if (basename(lowerPath).startsWith(query)) {
    return 0;
  }
  if (lowerPath.split("/").some((segment) => segment.startsWith(query))) {
    return 1;
  }
  return 2;
}

function partialSearchMessage(state: ScanState): string {
  if (state.timedOut) {
    return "File search timed out before scanning every path.";
  }
  if (state.hitScanCap) {
    return "File search reached the scan limit before scanning every path.";
  }
  if (state.hitDepthCap) {
    return "File search reached the traversal depth limit before scanning every path.";
  }
  return "File search skipped paths that could not be read.";
}

function unavailableSearch(
  input: Pick<SearchLocalFilePathsInput, "areaId" | "repositoryId" | "workspaceId">,
  query: string,
  message: string
): AreaFileSearchResult {
  return {
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    workspaceId: input.workspaceId,
    query,
    matches: [],
    availability: {
      status: "unavailable",
      message,
      scannedEntries: 0,
      truncated: false,
      timedOut: false
    }
  };
}
