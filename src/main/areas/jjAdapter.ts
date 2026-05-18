import { basename, resolve } from "node:path";

import type {
  AreaBookmarkSummary,
  AreaCommitSummary,
  AreaOperationSummary,
  AreaRemoteSummary,
  AreaRepositoryDetail,
  AreaStatusSummary,
  AreaTagSummary,
  AreaWorkspaceSummary
} from "@shared/areas";

import { localRepositoryId, localWorkspaceId } from "./areaIds";
import { gitHubConnectionFromRemote } from "./gitRemote";
import { JjCommandRunner } from "./jjCommandRunner";
import { readLocalReadme } from "./localReadme";

export interface ReadJjRepositoryInput {
  areaId: string;
  areaRootPath: string | null;
  rootPath: string;
  matchedGitHubAreaId: string | null;
}

export interface ReadJjRepositoryResult {
  detail: AreaRepositoryDetail;
  workspaces: AreaWorkspaceSummary[];
}

const jjRunner = new JjCommandRunner();
const jjFieldSeparator = "\x1f";
const jjRecordSeparator = "\x1e";
const jjFieldSeparatorLiteral = '"\\x1f"';
const jjRecordSeparatorLiteral = '"\\x1e"';
const jjCommitTemplate = separatedJjTemplate([
  "change_id.short()",
  "commit_id.short()",
  "description.first_line()",
  "author.name()",
  "author.email()",
  'author.timestamp().format("%+")'
]);
const jjOperationTemplate = separatedJjTemplate([
  "self.id().short()",
  "self.description()",
  "self.user()",
  'self.time().start().format("%+")'
]);

export interface JjWorkingCopySummary {
  changeId: string | null;
  commitId: string | null;
}

export async function readJjRepository(input: ReadJjRepositoryInput): Promise<ReadJjRepositoryResult> {
  const now = new Date().toISOString();
  const repositoryId = localRepositoryId(input.areaId, input.rootPath, input.areaRootPath);
  const version = await jjRunner.run(input.rootPath, ["--version"], "passiveRead");
  if (version.exitCode !== 0) {
    const detail = createUnavailableJjDetail(
      input,
      repositoryId,
      now,
      version.stderr || "JJ is unavailable."
    );
    return { detail, workspaces: [createJjWorkspace(input, repositoryId, now, true, "JJ is unavailable.")] };
  }

  const [
    root,
    workspaceRoot,
    workspaceList,
    gitRoot,
    remotes,
    bookmarks,
    tags,
    log,
    workingCopy,
    operations,
    sparse,
    status,
    readme
  ] = await Promise.all([
    jjRunner.run(input.rootPath, ["root"], "passiveRead"),
    jjRunner.run(input.rootPath, ["workspace", "root"], "passiveRead"),
    jjRunner.run(input.rootPath, ["workspace", "list"], "passiveRead"),
    jjRunner.run(input.rootPath, ["git", "root"], "passiveRead"),
    jjRunner.run(input.rootPath, ["git", "remote", "list"], "passiveRead"),
    jjRunner.run(input.rootPath, ["bookmark", "list"], "passiveRead"),
    jjRunner.run(input.rootPath, ["tag", "list"], "passiveRead"),
    jjRunner.run(input.rootPath, jjLogArgs(30), "passiveRead"),
    jjRunner.run(input.rootPath, jjWorkingCopyArgs(), "passiveRead"),
    jjRunner.run(input.rootPath, jjOperationLogArgs(10), "passiveRead"),
    jjRunner.run(input.rootPath, ["sparse", "list"], "passiveRead"),
    jjRunner.run(input.rootPath, ["status"], "passiveRead"),
    readLocalReadme(input.rootPath).catch(() => null)
  ]);

  const repoRoot = root.exitCode === 0 && root.stdout ? root.stdout : input.rootPath;
  const workspaceRootPath =
    workspaceRoot.exitCode === 0 && workspaceRoot.stdout ? workspaceRoot.stdout : input.rootPath;
  const remoteSummaries = parseJjRemotes(remotes.stdout, input.matchedGitHubAreaId);
  const connection = remoteSummaries.find((remote) => remote.github)?.github ?? null;
  const isGitBacked = gitRoot.exitCode === 0 && Boolean(gitRoot.stdout);
  const isColocated = isGitBacked && resolve(gitRoot.stdout) === resolve(repoRoot);
  const statusSummary = parseJjStatus(status.stdout);
  const workspaces = parseJjWorkspaces({
    areaId: input.areaId,
    repositoryId,
    workspaceList: workspaceList.stdout,
    fallbackRootPath: workspaceRootPath,
    currentWorkspaceRootPath: workspaceRootPath,
    workingCopy: parseJjWorkingCopySummary(workingCopy.stdout),
    now,
    statusMessage: status.stderr || null,
    sparseSummary: sparse.exitCode === 0 && sparse.stdout ? sparse.stdout.split("\n")[0] : null
  });
  const summary = {
    id: repositoryId,
    areaId: input.areaId,
    kind: "jj" as const,
    name: basename(repoRoot),
    owner: null,
    displayName: basename(repoRoot),
    path: repoRoot,
    defaultBranch: null,
    currentBranch: null,
    isDirty: statusSummary.clean === false,
    isPrivate: null,
    description: null,
    connection,
    capabilities: {
      supportsBranches: false,
      supportsBookmarks: true,
      supportsWorkspaces: true,
      supportsOperationLog: true,
      supportsSparse: sparse.exitCode === 0,
      isGitBacked,
      isColocated,
      supportsGitHubEnrichment: Boolean(connection)
    },
    health: { status: "ready" as const, message: null, checkedAt: now },
    updatedAt: now,
    scannedAt: now
  };

  return {
    detail: {
      ...summary,
      remotes: remoteSummaries,
      branches: [],
      bookmarks: parseJjBookmarks(bookmarks.stdout),
      tags: parseJjTags(tags.stdout),
      status: statusSummary,
      recentCommits: parseJjLog(log.stdout),
      recentOperations: parseJjOperations(operations.stdout),
      readme,
      workspaces
    },
    workspaces
  };
}

function createUnavailableJjDetail(
  input: ReadJjRepositoryInput,
  repositoryId: string,
  now: string,
  message: string
): AreaRepositoryDetail {
  const summary = {
    id: repositoryId,
    areaId: input.areaId,
    kind: "jj" as const,
    name: basename(input.rootPath),
    owner: null,
    displayName: basename(input.rootPath),
    path: input.rootPath,
    defaultBranch: null,
    currentBranch: null,
    isDirty: null,
    isPrivate: null,
    description: null,
    connection: null,
    capabilities: {
      supportsBranches: false,
      supportsBookmarks: true,
      supportsWorkspaces: true,
      supportsOperationLog: true,
      supportsSparse: false,
      isGitBacked: false,
      isColocated: false,
      supportsGitHubEnrichment: false
    },
    health: { status: "error" as const, message, checkedAt: now },
    updatedAt: now,
    scannedAt: now
  };
  return {
    ...summary,
    remotes: [],
    branches: [],
    bookmarks: [],
    tags: [],
    status: emptyStatus(),
    recentCommits: [],
    recentOperations: [],
    readme: null,
    workspaces: []
  };
}

function createJjWorkspace(
  input: ReadJjRepositoryInput,
  repositoryId: string,
  now: string,
  isStale: boolean,
  message: string | null
): AreaWorkspaceSummary {
  return {
    id: localWorkspaceId(input.areaId, repositoryId, input.rootPath),
    areaId: input.areaId,
    repositoryId,
    name: basename(input.rootPath),
    rootPath: input.rootPath,
    workingCopyChangeId: null,
    workingCopyCommitId: null,
    isStale,
    sparseSummary: null,
    health: { status: isStale ? "error" : "ready", message, checkedAt: now },
    updatedAt: now,
    scannedAt: now
  };
}

function parseJjRemotes(value: string, matchedGitHubAreaId: string | null): AreaRemoteSummary[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, url] = line.split(/\s+/, 2);
      return {
        name,
        fetchUrl: url ?? null,
        pushUrl: url ?? null,
        github: url ? gitHubConnectionFromRemote(name, url, matchedGitHubAreaId) : null
      };
    });
}

function parseJjBookmarks(value: string): AreaBookmarkSummary[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, target] = line.split(/\s+/, 2);
      return { name, remote: null, target: target ?? null, tracking: line.includes("@") };
    });
}

function parseJjTags(value: string): AreaTagSummary[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, target] = line.split(/\s+/, 2);
      return { name, target: target ?? null };
    });
}

function jjLogArgs(limit: number): string[] {
  return ["log", "--no-graph", "-n", String(limit), "-T", jjCommitTemplate];
}

function jjWorkingCopyArgs(): string[] {
  return ["log", "--no-graph", "-r", "@", "-n", "1", "-T", jjCommitTemplate];
}

function jjOperationLogArgs(limit: number): string[] {
  return ["operation", "log", "-n", String(limit), "-T", jjOperationTemplate];
}

function separatedJjTemplate(fields: string[]): string {
  return `${fields.join(` ++ ${jjFieldSeparatorLiteral} ++ `)} ++ ${jjRecordSeparatorLiteral}`;
}

function splitJjRecords(value: string): string[][] {
  if (value.includes(jjRecordSeparator) || value.includes(jjFieldSeparator)) {
    return value
      .split(jjRecordSeparator)
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => record.split(jjFieldSeparator));
  }

  return [];
}

export function parseJjLog(value: string): AreaCommitSummary[] {
  const records = splitJjRecords(value);
  if (records.length > 0) {
    return records
      .slice(0, 30)
      .map(([changeId, commitId, summary, authorName, authorEmail, authoredAt], index) => ({
        id: commitId || changeId || summary || String(index + 1),
        shortId: commitId || changeId || String(index + 1),
        changeId: changeId || null,
        summary: summary || "(no summary)",
        authorName: authorName || null,
        authorEmail: authorEmail || null,
        authoredAt: authoredAt || null
      }));
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line, index) => ({
      id: line,
      shortId: line.slice(0, 12) || String(index + 1),
      changeId: null,
      summary: line,
      authorName: null,
      authorEmail: null,
      authoredAt: null
    }));
}

export function parseJjOperations(value: string): AreaOperationSummary[] {
  const records = splitJjRecords(value);
  if (records.length > 0) {
    return records.slice(0, 10).map(([id, description, user, time], index) => ({
      id: id || description || String(index + 1),
      shortId: id || String(index + 1),
      description: description || "(no description)",
      user: user || null,
      time: time || null
    }));
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((line, index) => ({
      id: line,
      shortId: line.slice(0, 12) || String(index + 1),
      description: line,
      user: null,
      time: null
    }));
}

export function parseJjWorkingCopySummary(value: string): JjWorkingCopySummary {
  const [record] = splitJjRecords(value);
  if (!record) {
    return { changeId: null, commitId: null };
  }
  const [changeId, commitId] = record;
  return {
    changeId: changeId || null,
    commitId: commitId || null
  };
}

function parseJjStatus(value: string): AreaStatusSummary {
  const clean = !value.trim() || /working copy is clean/i.test(value);
  const conflictedCount = value.split("\n").filter((line) => /conflict|conflicted/i.test(line)).length;
  return {
    clean,
    dirtyCount: clean ? 0 : value.split("\n").filter(Boolean).length,
    untrackedCount: value.split("\n").filter((line) => /^A\s/.test(line) || /untracked/i.test(line)).length,
    conflictedCount,
    ahead: null,
    behind: null,
    entries: value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ path: line, indexStatus: null, workingTreeStatus: null }))
  };
}

export function parseJjWorkspaces(input: {
  areaId: string;
  repositoryId: string;
  workspaceList: string;
  fallbackRootPath: string;
  currentWorkspaceRootPath: string;
  workingCopy: JjWorkingCopySummary;
  now: string;
  statusMessage: string | null;
  sparseSummary: string | null;
}): AreaWorkspaceSummary[] {
  const lines = input.workspaceList
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = lines
    .map((line) => {
      const [namePart, pathPart] = line.includes(":") ? line.split(/:\s*/, 2) : line.split(/\s+/, 2);
      const rootPath = pathPart || input.fallbackRootPath;
      return workspaceSummary(input, namePart || basename(rootPath), rootPath);
    })
    .filter((workspace): workspace is AreaWorkspaceSummary => Boolean(workspace));
  return parsed.length
    ? parsed
    : [workspaceSummary(input, basename(input.fallbackRootPath), input.fallbackRootPath)];
}

function workspaceSummary(
  input: {
    areaId: string;
    repositoryId: string;
    currentWorkspaceRootPath: string;
    workingCopy: JjWorkingCopySummary;
    now: string;
    statusMessage: string | null;
    sparseSummary: string | null;
  },
  name: string,
  rootPath: string
): AreaWorkspaceSummary {
  const stale = Boolean(input.statusMessage && /stale/i.test(input.statusMessage));
  const isCurrentWorkspace = resolve(rootPath) === resolve(input.currentWorkspaceRootPath);
  return {
    id: localWorkspaceId(input.areaId, input.repositoryId, rootPath),
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    name,
    rootPath,
    workingCopyChangeId: isCurrentWorkspace ? input.workingCopy.changeId : null,
    workingCopyCommitId: isCurrentWorkspace ? input.workingCopy.commitId : null,
    isStale: stale,
    sparseSummary: input.sparseSummary,
    health: { status: stale ? "error" : "ready", message: input.statusMessage, checkedAt: input.now },
    updatedAt: input.now,
    scannedAt: input.now
  };
}

function emptyStatus(): AreaStatusSummary {
  return {
    clean: null,
    dirtyCount: 0,
    untrackedCount: 0,
    conflictedCount: 0,
    ahead: null,
    behind: null,
    entries: []
  };
}
