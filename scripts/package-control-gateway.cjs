#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const process = require("node:process");

const root = resolve(process.cwd());
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const platform = process.platform;
const arch = process.arch;
const filename = platform === "win32" ? "control-gateway.exe" : "control-gateway";
const cargoTargetDir = process.env.CARGO_TARGET_DIR
  ? resolve(root, process.env.CARGO_TARGET_DIR)
  : join(root, "target");
const binaryPath = join(cargoTargetDir, "release", filename);
const outputDir = join(root, "dist", "control-gateway");
const outputBinary = join(outputDir, filename);

const build = spawnSync("cargo", ["build", "--release", "-p", "control-gateway"], {
  cwd: root,
  env: process.env,
  stdio: "inherit"
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyFileSync(binaryPath, outputBinary);
if (platform !== "win32") {
  chmodSync(outputBinary, 0o755);
}

const sha256 = createHash("sha256").update(readFileSync(outputBinary)).digest("hex");
const manifest = {
  filename,
  platform,
  arch,
  version: packageJson.version,
  sha256
};

writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Packaged ${filename} for ${platform}/${arch} with SHA-256 ${sha256}.`);
