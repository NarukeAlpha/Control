#!/usr/bin/env node

const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const process = require("node:process");
const { URLSearchParams } = require("node:url");

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input || "e2e-failures.json";
const codexOutputPath = args["codex-output"] || "codex-e2e-analysis.md";
const repo = args.repo || process.env.GITHUB_REPOSITORY;
const token = args.token || process.env.GITHUB_TOKEN;
const closeResolved = args["close-resolved"] === "true";
const fetch = globalThis.fetch;

if (typeof fetch !== "function") {
  throw new Error("This script requires a Node.js runtime with fetch support.");
}

if (!repo) {
  throw new Error("Missing repository. Pass --repo owner/name or set GITHUB_REPOSITORY.");
}

if (!token) {
  console.warn("Missing GitHub token; skipping E2E issue updates.");
  process.exit(0);
}

const [owner, repoName] = repo.split("/");
const summary = readJson(inputPath);
const codexOutput = readOptionalText(codexOutputPath).trim();
const labels = [
  { name: "ci:e2e", color: "5319e7", description: "Created by the GitHub benchmark E2E workflow." },
  { name: "dev-regression", color: "d93f0b", description: "Regression detected after merging into dev." },
  { name: "automated", color: "ededed", description: "Created or maintained by automation." }
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  await ensureLabels();

  if (!summary.hasFailures) {
    const closed = closeResolved ? await closeResolvedIssues() : 0;
    writeGithubOutput({ created: 0, updated: 0, closed });
    return;
  }

  const openIssues = await listOpenFailureIssues();
  let created = 0;
  let updated = 0;

  for (const failure of summary.failures) {
    const body = withCodexAnalysis(failure.issueBody, codexOutput);
    const existing = openIssues.find((issue) => issue.body?.includes(failure.marker));

    if (existing) {
      await github("PATCH", `/repos/${owner}/${repoName}/issues/${existing.number}`, {
        title: failure.issueTitle,
        body,
        state: "open",
        labels: labels.map((label) => label.name)
      });
      await github("POST", `/repos/${owner}/${repoName}/issues/${existing.number}/comments`, {
        body: `Updated from the latest dev E2E run.\n\n- Commit: \`${failure.commitSha ?? "unknown"}\`\n- Run: ${summary.runUrl ?? "unavailable"}`
      });
      updated += 1;
    } else {
      await github("POST", `/repos/${owner}/${repoName}/issues`, {
        title: failure.issueTitle,
        body,
        labels: labels.map((label) => label.name)
      });
      created += 1;
    }
  }

  writeGithubOutput({ created, updated, closed: 0 });
}

async function ensureLabels() {
  for (const label of labels) {
    const encodedName = encodeURIComponent(label.name);
    const response = await githubRaw("GET", `/repos/${owner}/${repoName}/labels/${encodedName}`);
    if (response.status === 404) {
      await github("POST", `/repos/${owner}/${repoName}/labels`, label);
    } else if (!response.ok) {
      throw new Error(`Could not inspect label ${label.name}: ${response.status} ${await response.text()}`);
    }
  }
}

async function closeResolvedIssues() {
  const issues = await listOpenFailureIssues();
  let closed = 0;
  for (const issue of issues) {
    await github("POST", `/repos/${owner}/${repoName}/issues/${issue.number}/comments`, {
      body: `Closing because the latest dev E2E run passed.\n\n- Commit: \`${summary.commitSha ?? "unknown"}\`\n- Run: ${summary.runUrl ?? "unavailable"}`
    });
    await github("PATCH", `/repos/${owner}/${repoName}/issues/${issue.number}`, {
      state: "closed",
      state_reason: "completed"
    });
    closed += 1;
  }
  return closed;
}

async function listOpenFailureIssues() {
  const issues = [];
  let page = 1;
  while (page <= 10) {
    const params = new URLSearchParams({
      state: "open",
      labels: labels.map((label) => label.name).join(","),
      per_page: "100",
      page: String(page)
    });
    const rows = await github("GET", `/repos/${owner}/${repoName}/issues?${params.toString()}`);
    issues.push(...rows.filter((issue) => !issue.pull_request));
    if (rows.length < 100) {
      break;
    }
    page += 1;
  }
  return issues;
}

function withCodexAnalysis(issueBody, analysis) {
  const codexSection = analysis
    ? trimText(analysis, 18000)
    : "Codex analysis was not available. Check whether `OPENAI_API_KEY` is configured.";
  return trimText(
    `${issueBody}

## Codex analysis

${codexSection}
`,
    62000
  );
}

async function github(method, path, body) {
  const response = await githubRaw(method, path, body);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub API ${method} ${path} failed: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function githubRaw(method, path, body) {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readOptionalText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function trimText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n\n... truncated ...` : value;
}

function writeGithubOutput(values) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) {
    return;
  }
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  writeFileSync(path, `${lines.join("\n")}\n`, { flag: "a" });
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
