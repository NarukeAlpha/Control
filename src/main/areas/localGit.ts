import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

import type {
  AreaBranchSummary,
  AreaCommitSummary,
  AreaRemoteSummary,
  AreaRepositoryDetail,
  AreaStatusEntry,
  AreaStatusSummary
} from "@shared/areas";

import { localRepositoryId } from "./areaIds";
import { gitHubConnectionFromRemote } from "./gitRemote";
import { readLocalReadme } from "./localReadme";

const execFileAsync = promisify(execFile);
const gitTimeoutMs = 5_000;

export interface ReadGitRepositoryInput {
  areaId: string;
  areaRootPath: string | null;
  rootPath: string;
  matchedGitHubAreaId: string | null;
}

export async function readGitRepository(input: ReadGitRepositoryInput): Promise<AreaRepositoryDetail> {
  const now = new Date().toISOString();
  const repositoryId = localRepositoryId(input.areaId, input.rootPath, input.areaRootPath);
  const [topLevel, defaultBranch, currentBranch, status, remotes, branches, commits, readme] =
    await Promise.all([
      git(input.rootPath, ["rev-parse", "--show-toplevel"]).catch(() => input.rootPath),
      git(input.rootPath, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]).catch(() => ""),
      git(input.rootPath, ["branch", "--show-current"]).catch(() => ""),
      git(input.rootPath, ["status", "--porcelain=v1", "--branch"]).catch(() => ""),
      git(input.rootPath, ["remote", "-v"]).catch(() => ""),
      git(input.rootPath, [
        "branch",
        "--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(objectname)"
      ]).catch(() => ""),
      git(input.rootPath, [
        "log",
        "--date=iso-strict",
        "--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%s",
        "-n",
        "30"
      ]).catch(() => ""),
      readLocalReadme(input.rootPath).catch(() => null)
    ]);

  const remoteSummaries = parseGitRemotes(remotes, input.matchedGitHubAreaId);
  const connection = remoteSummaries.find((remote) => remote.github)?.github ?? null;
  const summary = {
    id: repositoryId,
    areaId: input.areaId,
    kind: "git" as const,
    name: basename(topLevel.trim() || input.rootPath),
    owner: null,
    displayName: basename(topLevel.trim() || input.rootPath),
    path: topLevel.trim() || input.rootPath,
    defaultBranch: parseDefaultBranch(defaultBranch) ?? (currentBranch.trim() || null),
    currentBranch: currentBranch.trim() || null,
    isDirty: parseGitStatus(status).clean === false,
    isPrivate: null,
    description: null,
    connection,
    capabilities: {
      supportsBranches: true,
      supportsBookmarks: false,
      supportsWorkspaces: false,
      supportsOperationLog: false,
      supportsSparse: false,
      isGitBacked: true,
      isColocated: false,
      supportsGitHubEnrichment: Boolean(connection)
    },
    health: { status: "ready" as const, message: null, checkedAt: now },
    updatedAt: now,
    scannedAt: now
  };
  const statusSummary = parseGitStatus(status);
  return {
    ...summary,
    remotes: remoteSummaries,
    branches: parseGitBranches(branches),
    bookmarks: [],
    tags: [],
    status: statusSummary,
    recentCommits: parseGitCommits(commits),
    recentOperations: [],
    readme,
    workspaces: []
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: gitTimeoutMs,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  return stdout.toString().trim();
}

export function parseDefaultBranch(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith("origin/") ? trimmed.slice("origin/".length) : trimmed;
}

export function parseGitRemotes(value: string, matchedGitHubAreaId: string | null): AreaRemoteSummary[] {
  const remotes = new Map<string, { fetchUrl: string | null; pushUrl: string | null }>();
  for (const line of value.split("\n")) {
    const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const [, name, url, direction] = match;
    const existing = remotes.get(name) ?? { fetchUrl: null, pushUrl: null };
    remotes.set(name, {
      fetchUrl: direction === "fetch" ? url : existing.fetchUrl,
      pushUrl: direction === "push" ? url : existing.pushUrl
    });
  }
  return [...remotes.entries()].map(([name, remote]) => ({
    name,
    fetchUrl: remote.fetchUrl,
    pushUrl: remote.pushUrl,
    github: remote.fetchUrl ? gitHubConnectionFromRemote(name, remote.fetchUrl, matchedGitHubAreaId) : null
  }));
}

export function parseGitBranches(value: string): AreaBranchSummary[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, head, upstream, commit] = line.split("\0");
      return {
        name,
        current: head === "*",
        upstream: upstream || null,
        commit: commit || null
      };
    });
}

export function parseGitStatus(value: string): AreaStatusSummary {
  let ahead: number | null = null;
  let behind: number | null = null;
  const entries: AreaStatusEntry[] = [];
  for (const line of value.split("\n")) {
    if (line.startsWith("## ")) {
      const aheadMatch = /ahead (\d+)/.exec(line);
      const behindMatch = /behind (\d+)/.exec(line);
      ahead = aheadMatch ? Number(aheadMatch[1]) : null;
      behind = behindMatch ? Number(behindMatch[1]) : null;
      continue;
    }
    if (!line.trim()) {
      continue;
    }
    entries.push({
      indexStatus: line.slice(0, 1).trim() || null,
      workingTreeStatus: line.slice(1, 2).trim() || null,
      path: line.slice(3).trim()
    });
  }
  return {
    clean: entries.length === 0,
    dirtyCount: entries.filter((entry) => entry.indexStatus !== "?" || entry.workingTreeStatus !== "?")
      .length,
    untrackedCount: entries.filter((entry) => entry.indexStatus === "?" && entry.workingTreeStatus === "?")
      .length,
    conflictedCount: entries.filter((entry) => entry.indexStatus === "U" || entry.workingTreeStatus === "U")
      .length,
    ahead,
    behind,
    entries
  };
}

export function parseGitCommits(value: string): AreaCommitSummary[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, shortId, authorName, authorEmail, authoredAt, summary] = line.split("\0");
      return {
        id,
        shortId,
        changeId: null,
        summary: summary || "(no summary)",
        authorName: authorName || null,
        authorEmail: authorEmail || null,
        authoredAt: authoredAt || null
      };
    });
}
