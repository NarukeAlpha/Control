import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { listLocalDirectory, readLocalFileContent } from "./localFiles";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "control-local-files-"));
  tempDirs.push(root);
  return root;
}

describe("localFiles", () => {
  it("lists symlink entries without following them for metadata", async () => {
    const root = makeTempRoot();
    const external = makeTempRoot();
    writeFileSync(join(external, "outside.txt"), "outside");
    symlinkSync(join(external, "outside.txt"), join(root, "outside-link.txt"));

    await expect(listLocalDirectory(root)).resolves.toEqual([
      expect.objectContaining({
        name: "outside-link.txt",
        path: "outside-link.txt",
        type: "symlink"
      })
    ]);
  });

  it("does not preview symlinked files outside the root", async () => {
    const root = makeTempRoot();
    const external = makeTempRoot();
    writeFileSync(join(external, "outside.txt"), "outside secret");
    symlinkSync(join(external, "outside.txt"), join(root, "outside-link.txt"));

    await expect(readLocalFileContent(root, "outside-link.txt")).resolves.toEqual({
      path: "outside-link.txt",
      kind: "unavailable",
      text: null,
      encoding: null,
      size: null,
      message: "File is unavailable."
    });
  });

  it("does not preview files reached through symlinked directories outside the root", async () => {
    const root = makeTempRoot();
    const external = makeTempRoot();
    mkdirSync(join(external, "nested"), { recursive: true });
    writeFileSync(join(external, "nested", "outside.txt"), "outside secret");
    symlinkSync(external, join(root, "linked-external"), "dir");

    await expect(readLocalFileContent(root, "linked-external/nested/outside.txt")).resolves.toEqual({
      path: "linked-external/nested/outside.txt",
      kind: "unavailable",
      text: null,
      encoding: null,
      size: null,
      message: "File is unavailable."
    });
  });

  it("allows symlinked files only when the resolved target stays inside the root", async () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "inside.txt"), "inside");
    symlinkSync(join(root, "src", "inside.txt"), join(root, "inside-link.txt"));

    await expect(readLocalFileContent(root, "inside-link.txt")).resolves.toMatchObject({
      path: "inside-link.txt",
      kind: "text",
      text: "inside"
    });
  });
});
