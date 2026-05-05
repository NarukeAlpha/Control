import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { BenchmarkPhase, MetricEvent, ScenarioObservation } from "./types";
import type { BenchmarkRunStore } from "./runStore";

export class BenchmarkTelemetry {
  constructor(
    private readonly store: BenchmarkRunStore,
    readonly runId: string,
    readonly caseId: string,
    readonly artifactDir: string
  ) {
    mkdirSync(this.artifactDir, { recursive: true });
  }

  async measure<T>(name: string, phase: BenchmarkPhase, action: () => Promise<T>): Promise<T> {
    const startedAt = new Date();
    const start = performance.now();
    try {
      const result = await action();
      this.recordMetric({
        name,
        phase,
        durationMs: performance.now() - start,
        status: "passed",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: null
      });
      return result;
    } catch (error) {
      this.recordMetric({
        name,
        phase,
        durationMs: performance.now() - start,
        status: "failed",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  recordObservation(observation: ScenarioObservation): void {
    this.store.recordObservation(this.caseId, observation);
  }

  recordArtifact(kind: string, path: string): void {
    this.store.recordArtifact({ runId: this.runId, caseId: this.caseId, kind, path });
  }

  artifactPath(...parts: string[]): string {
    return join(this.artifactDir, ...parts);
  }

  private recordMetric(metric: MetricEvent): void {
    this.store.recordMetric(this.caseId, metric);
  }
}
