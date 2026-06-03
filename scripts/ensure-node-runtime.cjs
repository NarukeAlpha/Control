#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const scriptPath = fs.realpathSync(process.argv[1] || "scripts/ensure-node-runtime.cjs");
const projectRoot = path.resolve(path.dirname(scriptPath), "..");
const args = new Set(process.argv.slice(2));
const shouldRepair = args.has("--repair");
const checkOnly = args.has("--check");

if (args.has("--help") || (!shouldRepair && !checkOnly)) {
  console.log(`Usage:
  node scripts/ensure-node-runtime.cjs --check
  node scripts/ensure-node-runtime.cjs --repair`);
  process.exit(args.has("--help") ? 0 : 1);
}

const initial = checkRuntime();
if (initial.ok) {
  console.log("[node-runtime] Node native runtime is healthy.");
  process.exit(0);
}

console.error(`[node-runtime] Node native runtime is incomplete: ${initial.issue}`);

if (!shouldRepair) {
  console.error("");
  console.error("[node-runtime] Repair with one of:");
  console.error("  npm rebuild better-sqlite3 keytar");
  console.error("  bun run repair:node-runtime");
  process.exit(1);
}

repairRuntime();

const final = checkRuntime();
if (!final.ok) {
  console.error(`[node-runtime] Node native runtime repair did not complete: ${final.issue}`);
  process.exit(1);
}

console.log("[node-runtime] Node native runtime repaired.");

function checkRuntime() {
  const checkScript = `
const Database = require("better-sqlite3");
const database = new Database(":memory:");
try {
  database.prepare("SELECT 1 AS ok").get();
} finally {
  database.close();
}
require("keytar");
`;
  const result = spawnSync(process.execPath, ["-e", checkScript], {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env
  });

  if (result.status === 0) {
    return { ok: true };
  }

  return { ok: false, issue: formatSpawnFailure(result) };
}

function repairRuntime() {
  console.log("[node-runtime] Rebuilding Node native dependencies...");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["rebuild", "better-sqlite3", "keytar"], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    const exitCode = typeof result.status === "number" ? result.status : 1;
    console.error("[node-runtime] Command failed: npm rebuild better-sqlite3 keytar");
    process.exit(exitCode);
  }
}

function formatSpawnFailure(result) {
  if (result.error) {
    return formatError(result.error);
  }

  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return stderr.split("\n")[0];
  }

  const stdout = result.stdout.trim();
  if (stdout.length > 0) {
    return stdout.split("\n")[0];
  }

  return `process exited with status ${result.status}`;
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
