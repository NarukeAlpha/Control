#!/usr/bin/env node

const { createHash } = require("node:crypto");
const { accessSync, constants, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const process = require("node:process");

const root = resolve(process.cwd());
const bundleDir = join(root, "dist", "control-gateway");
const manifestPath = join(bundleDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const filename = process.platform === "win32" ? "control-gateway.exe" : "control-gateway";

if (manifest.filename !== filename) {
  throw new Error(`Gateway manifest filename ${manifest.filename} does not match ${filename}.`);
}
if (manifest.platform !== process.platform) {
  throw new Error(`Gateway manifest platform ${manifest.platform} does not match ${process.platform}.`);
}
if (manifest.arch !== process.arch) {
  throw new Error(`Gateway manifest arch ${manifest.arch} does not match ${process.arch}.`);
}
if (typeof manifest.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(manifest.sha256)) {
  throw new Error("Gateway manifest is missing a valid SHA-256 digest.");
}

const binaryPath = join(bundleDir, filename);
accessSync(binaryPath, process.platform === "win32" ? constants.R_OK : constants.R_OK | constants.X_OK);
const actualSha256 = createHash("sha256").update(readFileSync(binaryPath)).digest("hex");
if (actualSha256 !== manifest.sha256) {
  throw new Error("Gateway bundle binary does not match the manifest SHA-256.");
}

console.log(`Verified packaged gateway bundle at ${bundleDir} without CONTROL_GATEWAY_BINARY.`);
