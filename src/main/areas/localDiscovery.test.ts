import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { discoverLocalRepositories, ignoredDirectoryNames } from "./localDiscovery";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "control-local-discovery-"));
  tempDirs.push(root);
  return root;
}

describe("discoverLocalRepositories", () => {
  it("exports the shared ignored-directory policy used by local scanners", () => {
    expect([...ignoredDirectoryNames].sort()).toEqual(
      expect.arrayContaining([".git", ".jj", "node_modules"])
    );
  });

  it("discovers .git directories and prunes ignored dependency folders", async () => {
    const root = makeTempRoot();
    const repositoryRoot = join(root, "packages", "app");
    mkdirSync(join(repositoryRoot, ".git"), { recursive: true });
    mkdirSync(join(root, "node_modules", "nested", ".git"), { recursive: true });

    await expect(discoverLocalRepositories(root)).resolves.toEqual([
      { kind: "git", rootPath: repositoryRoot }
    ]);
  });

  it("discovers Git worktrees backed by .git files", async () => {
    const root = makeTempRoot();
    const worktreeRoot = join(root, "worktree");
    mkdirSync(worktreeRoot, { recursive: true });
    writeFileSync(join(worktreeRoot, ".git"), "gitdir: ../.git/worktrees/worktree\n");

    await expect(discoverLocalRepositories(root)).resolves.toEqual([{ kind: "git", rootPath: worktreeRoot }]);
  });

  it("prefers a JJ repository when JJ and Git metadata share a root", async () => {
    const root = makeTempRoot();
    const repositoryRoot = join(root, "jj-repository");
    mkdirSync(join(repositoryRoot, ".git"), { recursive: true });
    mkdirSync(join(repositoryRoot, ".jj"), { recursive: true });

    await expect(discoverLocalRepositories(root)).resolves.toEqual([
      { kind: "jj", rootPath: repositoryRoot }
    ]);
  });
});
