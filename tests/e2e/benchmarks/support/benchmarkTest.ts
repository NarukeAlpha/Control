import { test as base, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { ControlElectronDriver, GitHubWebDriver, type BenchmarkDriver } from "./drivers";
import { BenchmarkRunStore, getBenchmarkBatchId, getProjectArtifactDir } from "./runStore";
import { BenchmarkTelemetry } from "./telemetry";
import {
  getGithubFixture,
  type BenchmarkOptions,
  type ProviderFixture,
  type ScenarioCategory
} from "./types";

interface BenchmarkFixtures {
  providerFixture: ProviderFixture;
  runStore: BenchmarkRunStore;
  benchmarkTelemetry: BenchmarkTelemetry;
  driver: BenchmarkDriver;
}

function scenarioCategoryFromTitle(titlePath: string[]): ScenarioCategory {
  const joined = titlePath.join(" ");
  if (joined.includes("pull-requests")) {
    return "pull-requests";
  }
  if (joined.includes("issues")) {
    return "issues";
  }
  if (joined.includes("files")) {
    return "files";
  }
  if (joined.includes("releases")) {
    return "releases";
  }
  if (joined.includes("actions")) {
    return "actions";
  }
  if (joined.includes("discussions")) {
    return "discussions";
  }
  if (joined.includes("projects")) {
    return "projects";
  }
  if (joined.includes("refs")) {
    return "refs";
  }
  if (joined.includes("notifications")) {
    return "notifications";
  }
  if (joined.includes("repository-admin")) {
    return "repository-admin";
  }
  if (joined.includes("organizations")) {
    return "organizations";
  }
  if (joined.includes("contributors")) {
    return "contributors";
  }
  if (joined.includes("security-quality")) {
    return "security-quality";
  }
  return "repositories";
}

export const benchmarkTest = base.extend<BenchmarkFixtures, BenchmarkOptions>({
  target: ["github-web", { option: true, scope: "worker" }],
  fixtureTier: ["standard", { option: true, scope: "worker" }],

  providerFixture: async ({ fixtureTier }, provide) => {
    await provide(getGithubFixture(fixtureTier));
  },

  runStore: async ({ target: _target }, provide) => {
    const store = new BenchmarkRunStore();
    await provide(store);
  },

  benchmarkTelemetry: async ({ runStore, target, fixtureTier, providerFixture }, provide, testInfo) => {
    const batchId = getBenchmarkBatchId();
    runStore.ensureBatch(batchId);

    const artifactDir = resolve(getProjectArtifactDir(batchId, testInfo.project.name));
    mkdirSync(artifactDir, { recursive: true });

    const runId = runStore.ensureRun(batchId, {
      projectName: testInfo.project.name,
      target,
      provider: providerFixture.provider,
      fixtureTier,
      fixtureId: providerFixture.id,
      owner: providerFixture.owner,
      repo: providerFixture.repo
    });

    const category = scenarioCategoryFromTitle(testInfo.titlePath);
    const caseId = runStore.startCase({
      runId,
      category,
      scenarioId: `${providerFixture.provider}/${category}`,
      title: testInfo.title
    });

    const telemetry = new BenchmarkTelemetry(
      runStore,
      runId,
      caseId,
      join(artifactDir, testInfo.title.replace(/[^a-zA-Z0-9._-]/g, "-"))
    );

    await provide(telemetry);

    const status = testInfo.status === testInfo.expectedStatus ? "passed" : "failed";
    const error = testInfo.errors.map((entry) => entry.message).join("\n") || null;
    runStore.finishCase(caseId, runId, status, error);
  },

  driver: async ({ target, page, benchmarkTelemetry }, provide) => {
    const driver =
      target === "github-web"
        ? new GitHubWebDriver(page)
        : await ControlElectronDriver.launch({
            rendererUrl: process.env.CONTROL_E2E_RENDERER_URL ?? "http://127.0.0.1:5174",
            artifactDir: benchmarkTelemetry.artifactDir,
            userDataDir: benchmarkTelemetry.artifactPath("user-data")
          });

    await provide(driver);

    const copiedArtifacts = await driver.close();
    for (const path of copiedArtifacts) {
      benchmarkTelemetry.recordArtifact("control-sqlite", path);
    }
  }
});

export { expect };
