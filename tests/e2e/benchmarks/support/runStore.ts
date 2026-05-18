import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { FixtureTier, MetricEvent, RunTarget, ScenarioCategory, ScenarioObservation } from "./types";

export interface BenchmarkRunInput {
  projectName: string;
  target: RunTarget;
  provider: "github";
  fixtureTier: FixtureTier;
  fixtureId: string;
  owner: string;
  repo: string;
}

export interface BenchmarkCaseInput {
  runId: string;
  category: ScenarioCategory;
  scenarioId: string;
  title: string;
}

export interface BenchmarkArtifactInput {
  runId: string;
  caseId: string | null;
  kind: string;
  path: string;
}

export const benchmarkDbPath = join("test-results", "e2e-runs", "testruns.sqlite");

export function getBenchmarkBatchId(): string {
  return (
    process.env.PW_BENCHMARK_BATCH_ID ??
    new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14)
  );
}

export function getBenchmarkRoot(batchId = getBenchmarkBatchId()): string {
  return join("test-results", "e2e-runs", batchId);
}

export function getProjectArtifactDir(batchId: string, projectName: string): string {
  return join(getBenchmarkRoot(batchId), sanitizePathPart(projectName));
}

export function createCaseId(): string {
  return randomUUID();
}

export class BenchmarkRunStore {
  private readonly db: DatabaseSync;

  constructor(dbPath = benchmarkDbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS run_batches (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        commit_sha TEXT,
        branch TEXT,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        target TEXT NOT NULL,
        provider TEXT NOT NULL,
        fixture_tier TEXT NOT NULL,
        fixture_id TEXT NOT NULL,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        UNIQUE(batch_id, project_name)
      );

      CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        category TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        title TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phase TEXT NOT NULL,
        duration_ms REAL NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        category TEXT NOT NULL,
        phase TEXT NOT NULL,
        key TEXT NOT NULL,
        json_value TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        case_id TEXT,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        sha256 TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        category TEXT NOT NULL,
        fixture_id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        baseline_run_id TEXT NOT NULL,
        candidate_run_id TEXT NOT NULL,
        baseline_duration_ms REAL NOT NULL,
        candidate_duration_ms REAL NOT NULL,
        duration_delta_ms REAL NOT NULL,
        duration_delta_percent REAL NOT NULL,
        verdict TEXT NOT NULL,
        json_diff TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  ensureBatch(batchId = getBenchmarkBatchId()): void {
    this.db
      .prepare(
        `INSERT INTO run_batches (id, started_at, commit_sha, branch, status)
         VALUES (@id, @startedAt, @commitSha, @branch, 'running')
         ON CONFLICT(id) DO NOTHING`
      )
      .run({
        id: batchId,
        startedAt: nowIso(),
        commitSha: readGitValue(["rev-parse", "HEAD"]),
        branch: readGitValue(["rev-parse", "--abbrev-ref", "HEAD"])
      });
  }

  ensureRun(batchId: string, input: BenchmarkRunInput): string {
    const runId = `${batchId}:${input.projectName}`;
    this.db
      .prepare(
        `INSERT INTO test_runs (
          id, batch_id, project_name, target, provider, fixture_tier, fixture_id, owner, repo, started_at, status
        )
        VALUES (
          @id, @batchId, @projectName, @target, @provider, @fixtureTier, @fixtureId, @owner, @repo, @startedAt, 'running'
        )
        ON CONFLICT(batch_id, project_name) DO UPDATE SET
          finished_at = NULL,
          status = CASE WHEN test_runs.status = 'failed' THEN 'failed' ELSE 'running' END`
      )
      .run({
        id: runId,
        batchId,
        projectName: input.projectName,
        target: input.target,
        provider: input.provider,
        fixtureTier: input.fixtureTier,
        fixtureId: input.fixtureId,
        owner: input.owner,
        repo: input.repo,
        startedAt: nowIso()
      });
    return runId;
  }

  startCase(input: BenchmarkCaseInput): string {
    const caseId = createCaseId();
    this.db
      .prepare(
        `INSERT INTO test_cases (id, run_id, category, scenario_id, title, started_at, status)
         VALUES (@id, @runId, @category, @scenarioId, @title, @startedAt, 'running')`
      )
      .run({
        id: caseId,
        runId: input.runId,
        category: input.category,
        scenarioId: input.scenarioId,
        title: input.title,
        startedAt: nowIso()
      });
    return caseId;
  }

  finishCase(caseId: string, runId: string, status: "passed" | "failed", error: string | null): void {
    this.db
      .prepare(
        `UPDATE test_cases
         SET finished_at = @finishedAt, status = @status, error = @error
         WHERE id = @caseId`
      )
      .run({ caseId, finishedAt: nowIso(), status, error });

    this.db
      .prepare(
        `UPDATE test_runs
         SET finished_at = @finishedAt,
             status = CASE WHEN @status = 'failed' OR status = 'failed' THEN 'failed' ELSE 'completed' END
         WHERE id = @runId`
      )
      .run({ runId, finishedAt: nowIso(), status });
  }

  recordMetric(caseId: string, metric: MetricEvent): void {
    this.db
      .prepare(
        `INSERT INTO metrics (case_id, name, phase, duration_ms, status, started_at, finished_at, error)
         VALUES (@caseId, @name, @phase, @durationMs, @status, @startedAt, @finishedAt, @error)`
      )
      .run({
        caseId,
        name: metric.name,
        phase: metric.phase,
        durationMs: metric.durationMs,
        status: metric.status,
        startedAt: metric.startedAt,
        finishedAt: metric.finishedAt,
        error: metric.error
      });
  }

  recordObservation(caseId: string, observation: ScenarioObservation): void {
    const createdAt = nowIso();
    const entries: Array<[string, unknown]> = [
      ["signature", observation.signature],
      ["data", observation.data],
      [
        "metadata",
        {
          provider: observation.provider,
          target: observation.target,
          fixtureTier: observation.fixtureTier,
          fixtureId: observation.fixtureId,
          scenarioId: observation.scenarioId
        }
      ]
    ];

    const insert = this.db.prepare(
      `INSERT INTO observations (case_id, category, phase, key, json_value, created_at)
       VALUES (@caseId, @category, @phase, @key, @jsonValue, @createdAt)`
    );

    this.db.exec("BEGIN");
    try {
      for (const [key, value] of entries) {
        insert.run({
          caseId,
          category: observation.category,
          phase: observation.phase,
          key,
          jsonValue: JSON.stringify(value),
          createdAt
        });
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  recordArtifact(input: BenchmarkArtifactInput): void {
    this.db
      .prepare(
        `INSERT INTO artifacts (run_id, case_id, kind, path, sha256, created_at)
         VALUES (@runId, @caseId, @kind, @path, @sha256, @createdAt)`
      )
      .run({
        runId: input.runId,
        caseId: input.caseId,
        kind: input.kind,
        path: input.path,
        sha256: fileSha256(input.path),
        createdAt: nowIso()
      });
  }

  close(): void {
    this.db.close();
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function fileSha256(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readGitValue(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
