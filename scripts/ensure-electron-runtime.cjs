#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const scriptPath = fs.realpathSync(process.argv[1] || "scripts/ensure-electron-runtime.cjs");
const projectRoot = path.resolve(path.dirname(scriptPath), "..");
const args = new Set(process.argv.slice(2));
const shouldRepair = args.has("--repair");
const checkOnly = args.has("--check");

if (args.has("--help") || (!shouldRepair && !checkOnly)) {
  console.log(`Usage:
  node scripts/ensure-electron-runtime.cjs --check
  node scripts/ensure-electron-runtime.cjs --repair`);
  process.exit(args.has("--help") ? 0 : 1);
}

const initial = checkRuntime();
if (initial.ok) {
  console.log("[electron-runtime] Electron runtime is healthy.");
  process.exit(0);
}

printIssues("Electron runtime is incomplete.", initial.issues);

if (!shouldRepair) {
  console.error("");
  console.error("[electron-runtime] Repair with one of:");
  console.error("  npm run repair:runtime");
  console.error("  bun run repair:runtime");
  process.exit(1);
}

repairRuntime();

const final = checkRuntime();
if (!final.ok) {
  printIssues("Electron runtime repair did not complete.", final.issues);
  console.error("");
  console.error("[electron-runtime] Manual repair commands:");
  console.error("  node node_modules/electron/install.js");
  console.error("  node node_modules/electron-builder/cli.js install-app-deps");
  process.exit(1);
}

console.log("[electron-runtime] Electron runtime repaired.");

function checkRuntime() {
  const issues = [];
  const electron = checkElectronBinary();

  if (!electron.ok) {
    issues.push(electron.issue);
    return { ok: false, issues };
  }

  const native = checkNativeBindings(electron.path);
  if (!native.ok) {
    issues.push(native.issue);
  }

  return { ok: issues.length === 0, issues };
}

function checkElectronBinary() {
  let electronPath;

  try {
    const electronModulePath = require.resolve("electron");
    delete require.cache[electronModulePath];
    electronPath = require("electron");
  } catch (error) {
    return {
      ok: false,
      issue: `Electron package is installed but its binary cannot be resolved: ${formatError(error)}`
    };
  }

  if (typeof electronPath !== "string" || electronPath.length === 0) {
    return {
      ok: false,
      issue: "Electron package resolved to an invalid binary path."
    };
  }

  if (!fs.existsSync(electronPath)) {
    return {
      ok: false,
      issue: `Electron binary is missing at ${electronPath}.`
    };
  }

  return { ok: true, path: electronPath };
}

function checkNativeBindings(electronPath) {
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
  const result = spawnSync(electronPath, ["-e", checkScript], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1"
    }
  });

  if (result.status === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    issue: `Electron native bindings are unavailable: ${formatSpawnFailure(result)}`
  };
}

function repairRuntime() {
  console.log("[electron-runtime] Repairing Electron binary...");
  runNodeScript("node_modules/electron/install.js", []);

  console.log("[electron-runtime] Rebuilding Electron native dependencies...");
  runNodeScript("node_modules/electron-builder/cli.js", ["install-app-deps"]);
}

function runNodeScript(scriptPath, scriptArgs) {
  const absoluteScriptPath = path.join(projectRoot, scriptPath);
  if (!fs.existsSync(absoluteScriptPath)) {
    console.error(`[electron-runtime] Missing ${scriptPath}. Run npm install or bun install first.`);
    process.exit(1);
  }

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;

  const result = spawnSync(process.execPath, [absoluteScriptPath, ...scriptArgs], {
    cwd: projectRoot,
    env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    const exitCode = typeof result.status === "number" ? result.status : 1;
    console.error(`[electron-runtime] Command failed: node ${scriptPath} ${scriptArgs.join(" ")}`.trim());
    process.exit(exitCode);
  }
}

function printIssues(title, issues) {
  console.error(`[electron-runtime] ${title}`);
  for (const issue of issues) {
    console.error(`- ${issue}`);
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
