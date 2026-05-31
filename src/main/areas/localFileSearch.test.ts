import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { searchLocalFilePaths } from "./localFileSearch";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "control-local-file-search-"));
  tempDirs.push(root);
  return root;
}

function input(rootPath: string, query: string, limit = 30) {
  return {
    areaId: "local:workspace",
    repositoryId: "repo:control",
    workspaceId: null,
    rootPath,
    query,
    limit
  };
}

describe("searchLocalFilePaths", () => {
  it("searches path names and sorts stronger basename and segment matches first", async () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "src", "search"), { recursive: true });
    mkdirSync(join(root, "src", "components"), { recursive: true });
    mkdirSync(join(root, "src", "features"), { recursive: true });
    writeFileSync(join(root, "src", "search.ts"), "");
    writeFileSync(join(root, "src", "components", "searchBox.tsx"), "");
    writeFileSync(join(root, "src", "search", "inside.ts"), "");
    writeFileSync(join(root, "src", "features", "area-search.ts"), "");

    const result = await searchLocalFilePaths(input(root, "search"));

    expect(result.availability.status).toBe("complete");
    expect(result.matches.map((match) => match.path)).toEqual([
      "src/search",
      "src/search.ts",
      "src/components/searchBox.tsx",
      "src/search/inside.ts",
      "src/features/area-search.ts"
    ]);
  });

  it("prunes ignored folders before traversal and does not descend through symlinked directories", async () => {
    const root = makeTempRoot();
    const external = makeTempRoot();
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, ".jj"), { recursive: true });
    mkdirSync(join(root, "node_modules", "package"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(external, "nested"), { recursive: true });
    writeFileSync(join(root, ".git", "search-config"), "");
    writeFileSync(join(root, ".jj", "search-state"), "");
    writeFileSync(join(root, "node_modules", "package", "search.js"), "");
    writeFileSync(join(root, "src", "search.ts"), "");
    writeFileSync(join(external, "nested", "search-external.ts"), "");
    symlinkSync(external, join(root, "linked-external"), "dir");
    symlinkSync(join(root, "src", "search.ts"), join(root, "search-link.ts"));

    const result = await searchLocalFilePaths(input(root, "search"));

    expect(result.availability.status).toBe("complete");
    expect(result.matches.map((match) => match.path)).toEqual(["src/search.ts", "search-link.ts"]);
    expect(result.matches.find((match) => match.path === "search-link.ts")?.type).toBe("symlink");
  });

  it("returns a typed unavailable result for blank queries without scanning", async () => {
    const root = makeTempRoot();

    await expect(searchLocalFilePaths(input(root, "   "))).resolves.toMatchObject({
      query: "",
      matches: [],
      availability: {
        status: "unavailable",
        message: "Enter a file name to search.",
        scannedEntries: 0,
        truncated: false,
        timedOut: false
      }
    });
  });

  it("marks capped traversals as partial", async () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "alpha-search.ts"), "");
    writeFileSync(join(root, "src", "beta-search.ts"), "");

    const result = await searchLocalFilePaths(input(root, "search"), { maxEntriesScanned: 1 });

    expect(result.availability).toMatchObject({
      status: "partial",
      scannedEntries: 1,
      truncated: true
    });
  });

  it("returns unavailable when the root cannot be read", async () => {
    const root = join(makeTempRoot(), "missing");

    await expect(searchLocalFilePaths(input(root, "search"))).resolves.toMatchObject({
      matches: [],
      availability: {
        status: "unavailable",
        message: "Local root is unavailable.",
        scannedEntries: 0
      }
    });
  });
});
