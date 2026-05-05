#!/usr/bin/env node

const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const process = require("node:process");

const args = parseArgs(process.argv.slice(2));
const dbPath = args.db || path.join("test-results", "e2e-runs", "testruns.sqlite");
const db = new DatabaseSync(dbPath, { readOnly: false });

const batchId = args["batch-id"] || latestBatchId();
if (!batchId) {
  console.error("No benchmark batch found.");
  process.exit(1);
}

const filters = {
  category: args.category || null,
  fixtureId: args["fixture-id"] || null,
  fixtureTier: args["fixture-tier"] || null
};

const rows = loadCaseRows(batchId, filters);
const comparisons = compareRows(batchId, rows);

db.prepare(
  `DELETE FROM comparisons
   WHERE batch_id = @batchId
     AND (@category IS NULL OR category = @category)
     AND (@fixtureId IS NULL OR fixture_id = @fixtureId)`
).run({
  batchId,
  category: filters.category,
  fixtureId: filters.fixtureId
});

const insert = db.prepare(
  `INSERT INTO comparisons (
    batch_id,
    provider,
    category,
    fixture_id,
    scenario_id,
    baseline_run_id,
    candidate_run_id,
    baseline_duration_ms,
    candidate_duration_ms,
    duration_delta_ms,
    duration_delta_percent,
    verdict,
    json_diff,
    created_at
  )
  VALUES (
    @batchId,
    @provider,
    @category,
    @fixtureId,
    @scenarioId,
    @baselineRunId,
    @candidateRunId,
    @baselineDurationMs,
    @candidateDurationMs,
    @durationDeltaMs,
    @durationDeltaPercent,
    @verdict,
    @jsonDiff,
    @createdAt
  )`
);

db.exec("BEGIN");
try {
  for (const item of comparisons) {
    insert.run(item);
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log(JSON.stringify({ batchId, comparisons }, null, 2));

function latestBatchId() {
  const row = db.prepare("SELECT id FROM run_batches ORDER BY started_at DESC LIMIT 1").get();
  return row ? row.id : null;
}

function loadCaseRows(batchId, filters) {
  return db
    .prepare(
      `SELECT
        tr.id AS runId,
        tr.target,
        tr.provider,
        tr.fixture_tier AS fixtureTier,
        tr.fixture_id AS fixtureId,
        tc.id AS caseId,
        tc.category,
        tc.scenario_id AS scenarioId,
        tc.status AS caseStatus,
        COALESCE(SUM(CASE WHEN m.name != 'search_repository' THEN m.duration_ms ELSE 0 END), 0) AS durationMs,
        COALESCE(SUM(CASE WHEN m.name = 'search_repository' THEN m.duration_ms ELSE 0 END), 0) AS searchDurationMs,
        COALESCE(SUM(CASE WHEN m.status != 'passed' THEN 1 ELSE 0 END), 0) AS metricFailures
       FROM test_runs tr
       JOIN test_cases tc ON tc.run_id = tr.id
       LEFT JOIN metrics m ON m.case_id = tc.id
       WHERE tr.batch_id = @batchId
         AND tr.provider = 'github'
         AND (@category IS NULL OR tc.category = @category)
         AND (@fixtureId IS NULL OR tr.fixture_id = @fixtureId)
         AND (@fixtureTier IS NULL OR tr.fixture_tier = @fixtureTier)
       GROUP BY tr.id, tc.id
       ORDER BY tr.fixture_id, tc.category, tc.scenario_id, tr.target`
    )
    .all({
      batchId,
      category: filters.category,
      fixtureId: filters.fixtureId,
      fixtureTier: filters.fixtureTier
    })
    .map((row) => ({
      ...row,
      signatures: loadSignatures(row.caseId),
      data: loadObservationData(row.caseId)
    }));
}

function loadSignatures(caseId) {
  return db
    .prepare(
      `SELECT phase, json_value AS value
       FROM observations
       WHERE case_id = @caseId AND key = 'signature'
       ORDER BY phase`
    )
    .all({ caseId })
    .map((row) => ({ phase: row.phase, value: JSON.parse(row.value) }));
}

function loadObservationData(caseId) {
  return db
    .prepare(
      `SELECT phase, json_value AS value
       FROM observations
       WHERE case_id = @caseId AND key = 'data'
       ORDER BY phase`
    )
    .all({ caseId })
    .map((row) => ({ phase: row.phase, value: JSON.parse(row.value) }));
}

function compareRows(batchId, rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.provider, row.category, row.fixtureId, row.scenarioId].join("|");
    const group = groups.get(key) || {};
    if (row.target === "github-web") {
      group.baseline = row;
    } else if (row.target === "control-electron") {
      group.candidate = row;
    }
    groups.set(key, group);
  }

  const comparisons = [];
  for (const group of groups.values()) {
    if (!group.baseline || !group.candidate) {
      continue;
    }

    const baseline = group.baseline;
    const candidate = group.candidate;
    const durationDeltaMs = candidate.durationMs - baseline.durationMs;
    const durationDeltaPercent =
      baseline.durationMs > 0 ? (durationDeltaMs / baseline.durationMs) * 100 : 0;
    const signaturesMatch = signaturesCompatible(baseline, candidate);
    const failed =
      baseline.caseStatus !== "passed" ||
      candidate.caseStatus !== "passed" ||
      baseline.metricFailures > 0 ||
      candidate.metricFailures > 0;
    const verdict = failed
      ? "failed"
      : !signaturesMatch
        ? "data_mismatch"
        : durationDeltaPercent <= -10
          ? "candidate_faster"
          : durationDeltaPercent >= 10
            ? "candidate_slower"
            : "candidate_equivalent";

    comparisons.push({
      batchId,
      provider: baseline.provider,
      category: baseline.category,
      fixtureId: baseline.fixtureId,
      scenarioId: baseline.scenarioId,
      baselineRunId: baseline.runId,
      candidateRunId: candidate.runId,
      baselineDurationMs: round(baseline.durationMs),
      candidateDurationMs: round(candidate.durationMs),
      durationDeltaMs: round(durationDeltaMs),
      durationDeltaPercent: round(durationDeltaPercent),
      verdict,
      jsonDiff: JSON.stringify({
        baseline: {
          target: baseline.target,
          signatures: baseline.signatures,
          data: baseline.data,
          searchDurationMs: round(baseline.searchDurationMs)
        },
        candidate: {
          target: candidate.target,
          signatures: candidate.signatures,
          data: candidate.data,
          searchDurationMs: round(candidate.searchDurationMs)
        }
      }),
      createdAt: new Date().toISOString()
    });
  }
  return comparisons;
}

function signaturesCompatible(baseline, candidate) {
  if (baseline.category !== "issues" && baseline.category !== "pull-requests") {
    return JSON.stringify(baseline.signatures) === JSON.stringify(candidate.signatures);
  }

  if (baseline.signatures.length !== candidate.signatures.length) {
    return false;
  }

  const kind = baseline.category === "issues" ? "issue" : "pull";
  const prefix = `${baseline.fixtureId === "github-standard-swift" ? "apple/swift" : "golang/go"}|${kind}:`;
  return baseline.signatures.every((signature, index) => {
    const candidateSignature = candidate.signatures[index];
    return (
      signature.phase === candidateSignature.phase &&
      typeof signature.value === "string" &&
      typeof candidateSignature.value === "string" &&
      signature.value.startsWith(prefix) &&
      candidateSignature.value.startsWith(prefix)
    );
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
