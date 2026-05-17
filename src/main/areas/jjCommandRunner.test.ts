import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";

import { JjCommandRunner } from "./jjCommandRunner";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("JjCommandRunner", () => {
  it("blocks snapshot-risk commands from passive refresh", async () => {
    const runner = new JjCommandRunner();

    await expect(runner.run(process.cwd(), ["describe"], "mutation")).rejects.toThrow(
      /not allowed from passive refresh/
    );
  });

  it.each([
    ["status"],
    ["log", "--no-graph"],
    ["operation", "log", "-n", "1"],
    ["bookmark", "list"],
    ["tag", "list"],
    ["sparse", "list"],
    ["git", "remote", "list"]
  ])("adds --ignore-working-copy to passive %s reads", async (...args) => {
    const calls: string[][] = [];
    const runner = new JjCommandRunner({
      executor: async (_command, commandArgs) => {
        calls.push(commandArgs);
        return { stdout: "", stderr: "" };
      }
    });

    await runner.run(process.cwd(), args, "passiveRead");

    expect(calls).toEqual([["--ignore-working-copy", ...args]]);
  });

  it("does not add --ignore-working-copy to binary metadata reads", async () => {
    const calls: string[][] = [];
    const runner = new JjCommandRunner({
      executor: async (_command, args) => {
        calls.push(args);
        return { stdout: "jj 0.30.0", stderr: "" };
      }
    });

    await runner.run(process.cwd(), ["--version"], "passiveRead");

    expect(calls).toEqual([["--version"]]);
  });
});

const describeWithJj = jjAvailable() ? describe : describe.skip;

describeWithJj("JjCommandRunner passive integration", () => {
  it("does not change operation or working-copy commit IDs during passive reads", async () => {
    const root = mkdtempSync(join(tmpdir(), "control-jj-passive-"));
    tempDirs.push(root);
    jj(root, ["git", "init"]);
    const beforeOperationId = jj(root, [
      "--ignore-working-copy",
      "operation",
      "log",
      "-n",
      "1",
      "-T",
      "self.id().short()"
    ]);
    const beforeCommitId = jj(root, [
      "--ignore-working-copy",
      "log",
      "-r",
      "@",
      "--no-graph",
      "-T",
      "commit_id.short()"
    ]);
    const runner = new JjCommandRunner();

    await runner.run(root, ["log", "--no-graph", "-r", "@", "-T", "commit_id.short()"], "passiveRead");
    await runner.run(root, ["operation", "log", "-n", "1", "-T", "self.id().short()"], "passiveRead");

    expect(
      jj(root, ["--ignore-working-copy", "operation", "log", "-n", "1", "-T", "self.id().short()"])
    ).toBe(beforeOperationId);
    expect(
      jj(root, ["--ignore-working-copy", "log", "-r", "@", "--no-graph", "-T", "commit_id.short()"])
    ).toBe(beforeCommitId);
  });
});

function jjAvailable(): boolean {
  try {
    execFileSync("jj", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function jj(cwd: string, args: string[]): string {
  return execFileSync("jj", args, { cwd, encoding: "utf8" }).trim();
}
