#!/usr/bin/env node

const { createHash } = require("node:crypto");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const process = require("node:process");
const { DatabaseSync } = require("node:sqlite");

const args = parseArgs(process.argv.slice(2));
const dbPath = args.db || join("test-results", "e2e-runs", "testruns.sqlite");
const outputPath = args.output || "e2e-failures.json";
const markdownPath = args.markdown || "e2e-failures.md";
const runUrl = args["run-url"] || process.env.GITHUB_RUN_URL || null;
const e2eOutcome = args["e2e-outcome"] || null;
const generatedAt = new Date().toISOString();

const summary = existsSync(dbPath)
  ? summarizeDatabase(dbPath)
  : syntheticSummary("Benchmark database was not created.");

if (summary.failures.length === 0 && e2eOutcome && e2eOutcome !== "success") {
  summary.failures.push(
    syntheticFailure(`Playwright finished with ${e2eOutcome}, but no failed case was recorded.`)
  );
}

summary.hasFailures = summary.failures.length > 0;
summary.generatedAt = generatedAt;
summary.runUrl = runUrl;

writeJson(outputPath, summary);
writeText(markdownPath, renderMarkdown(summary));
writeGithubOutput(summary);

function summarizeDatabase(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const batchId = args["batch-id"] || latestBatchId(db);
    if (!batchId) {
      return syntheticSummary("No benchmark batch was found in the benchmark database.");
    }

    const rows = db
      .prepare(
        `SELECT
          rb.id AS batchId,
          rb.commit_sha AS commitSha,
          rb.branch,
          tr.id AS runId,
          tr.project_name AS projectName,
          tr.target,
          tr.fixture_tier AS fixtureTier,
          tr.fixture_id AS fixtureId,
          tr.owner,
          tr.repo,
          tc.id AS caseId,
          tc.category,
          tc.scenario_id AS scenarioId,
          tc.title,
          tc.status AS caseStatus,
          tc.error AS caseError,
          COALESCE(
            (
              SELECT group_concat(m.name || ' / ' || m.phase || ': ' || COALESCE(m.error, 'failed'), char(10))
              FROM metrics m
              WHERE m.case_id = tc.id AND m.status != 'passed'
            ),
            ''
          ) AS metricErrors
         FROM run_batches rb
         JOIN test_runs tr ON tr.batch_id = rb.id
         JOIN test_cases tc ON tc.run_id = tr.id
         WHERE rb.id = @batchId
           AND (
             tc.status != 'passed'
             OR EXISTS (SELECT 1 FROM metrics m WHERE m.case_id = tc.id AND m.status != 'passed')
           )
         ORDER BY tr.project_name, tc.category, tc.title`
      )
      .all({ batchId });

    const failures = rows.map((row) => buildFailure(db, row));
    return {
      batchId,
      commitSha: rows[0]?.commitSha ?? latestBatchCommit(db, batchId),
      branch: rows[0]?.branch ?? latestBatchBranch(db, batchId),
      hasFailures: failures.length > 0,
      failures
    };
  } finally {
    db.close();
  }
}

function latestBatchId(db) {
  const row = db.prepare("SELECT id FROM run_batches ORDER BY started_at DESC LIMIT 1").get();
  return row?.id ?? null;
}

function latestBatchCommit(db, batchId) {
  const row = db
    .prepare("SELECT commit_sha AS commitSha FROM run_batches WHERE id = @batchId")
    .get({ batchId });
  return row?.commitSha ?? null;
}

function latestBatchBranch(db, batchId) {
  const row = db.prepare("SELECT branch FROM run_batches WHERE id = @batchId").get({ batchId });
  return row?.branch ?? null;
}

function buildFailure(db, row) {
  const error = normalizeError([row.caseError, row.metricErrors].filter(Boolean).join("\n"));
  const fingerprint = fingerprintFailure(row, error);
  const artifacts = db
    .prepare(
      `SELECT kind, path, sha256
       FROM artifacts
       WHERE run_id = @runId AND (case_id = @caseId OR case_id IS NULL)
       ORDER BY kind, path`
    )
    .all({ runId: row.runId, caseId: row.caseId });

  const failure = {
    fingerprint,
    marker: `<!-- control-e2e-failure:${fingerprint} -->`,
    issueTitle: `[E2E] ${row.category} failed on ${row.projectName}`,
    batchId: row.batchId,
    commitSha: row.commitSha,
    branch: row.branch,
    runId: row.runId,
    projectName: row.projectName,
    target: row.target,
    fixtureTier: row.fixtureTier,
    fixtureId: row.fixtureId,
    repository: `${row.owner}/${row.repo}`,
    caseId: row.caseId,
    category: row.category,
    scenarioId: row.scenarioId,
    title: row.title,
    status: row.caseStatus,
    error,
    artifacts
  };
  failure.issueBody = renderIssueBody(failure);
  return failure;
}

function syntheticSummary(message) {
  return {
    batchId: null,
    commitSha: process.env.GITHUB_SHA ?? null,
    branch: process.env.GITHUB_REF_NAME ?? null,
    hasFailures: true,
    failures: [syntheticFailure(message)]
  };
}

function syntheticFailure(message) {
  const row = {
    projectName: "workflow",
    scenarioId: "github/e2e-workflow",
    fixtureId: "unknown",
    title: "GitHub benchmark workflow",
    category: "workflow"
  };
  const error = normalizeError(message);
  const fingerprint = fingerprintFailure(row, error);
  const failure = {
    fingerprint,
    marker: `<!-- control-e2e-failure:${fingerprint} -->`,
    issueTitle: "[E2E] GitHub benchmark workflow failed",
    batchId: null,
    commitSha: process.env.GITHUB_SHA ?? null,
    branch: process.env.GITHUB_REF_NAME ?? null,
    runId: null,
    projectName: row.projectName,
    target: "unknown",
    fixtureTier: "unknown",
    fixtureId: row.fixtureId,
    repository: "unknown",
    caseId: null,
    category: row.category,
    scenarioId: row.scenarioId,
    title: row.title,
    status: "failed",
    error,
    artifacts: []
  };
  failure.issueBody = renderIssueBody(failure);
  return failure;
}

function fingerprintFailure(row, error) {
  const firstErrorLine = error.split("\n").find(Boolean) ?? "no-error";
  const value = [row.projectName, row.scenarioId, row.fixtureId, firstErrorLine].join("|");
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function normalizeError(value) {
  const text = (value || "No error message recorded.").replace(/\r\n/g, "\n").trim();
  return text.length > 4000 ? `${text.slice(0, 4000)}\n... truncated ...` : text;
}

function renderIssueBody(failure) {
  const artifactRows =
    failure.artifacts.length > 0
      ? failure.artifacts
          .map(
            (artifact) =>
              `- ${artifact.kind}: \`${artifact.path}\`${artifact.sha256 ? ` (${artifact.sha256})` : ""}`
          )
          .join("\n")
      : "- No per-case artifacts were recorded.";

  return `${failure.marker}

## Failure

- Test: \`${failure.title}\`
- Project: \`${failure.projectName}\`
- Scenario: \`${failure.scenarioId}\`
- Fixture: \`${failure.fixtureId}\`
- Repository: \`${failure.repository}\`
- Status: \`${failure.status}\`
- Branch: \`${failure.branch ?? "unknown"}\`
- Commit: \`${failure.commitSha ?? "unknown"}\`
- Workflow run: ${runUrl ?? "unavailable"}

## Error

\`\`\`text
${failure.error}
\`\`\`

## Artifacts

${artifactRows}
`;
}

function renderMarkdown(data) {
  if (!data.hasFailures) {
    return `# GitHub E2E Result

No benchmark failures were recorded.
`;
  }

  return `# GitHub E2E Failures

- Batch: \`${data.batchId ?? "unknown"}\`
- Branch: \`${data.branch ?? "unknown"}\`
- Commit: \`${data.commitSha ?? "unknown"}\`
- Workflow run: ${data.runUrl ?? "unavailable"}

${data.failures
  .map(
    (failure, index) => `## ${index + 1}. ${failure.issueTitle}

- Fingerprint: \`${failure.fingerprint}\`
- Test: \`${failure.title}\`
- Project: \`${failure.projectName}\`
- Scenario: \`${failure.scenarioId}\`
- Fixture: \`${failure.fixtureId}\`

\`\`\`text
${failure.error}
\`\`\`
`
  )
  .join("\n")}
`;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function writeGithubOutput(data) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) {
    return;
  }

  const lines = [
    `has_failures=${data.hasFailures ? "true" : "false"}`,
    `failure_count=${data.failures.length}`,
    `primary_title=${data.failures[0]?.issueTitle ?? ""}`
  ];
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
