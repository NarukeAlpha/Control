import { defineConfig, devices } from "@playwright/test";

import type { BenchmarkOptions } from "./tests/e2e/benchmarks/support/types";
import { getBenchmarkBatchId, getBenchmarkRoot } from "./tests/e2e/benchmarks/support/runStore";

const rendererURL = "http://127.0.0.1:5174";
const testingProfileStorageState = "tests/e2e/state/testing-profile.json";
const batchId = getBenchmarkBatchId();
process.env.PW_BENCHMARK_BATCH_ID = batchId;
process.env.CONTROL_E2E_RENDERER_URL = rendererURL;

export default defineConfig<BenchmarkOptions>({
  testDir: "tests/e2e/benchmarks/github",
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: `${getBenchmarkRoot(batchId)}/playwright-artifacts`,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1512, height: 982 },
    timezoneId: "America/Puerto_Rico",
    locale: "en-US"
  },
  webServer: {
    command: "bun run dev:renderer -- --port 5174",
    url: rendererURL,
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "github-web-standard",
      use: {
        ...devices["Desktop Chrome"],
        target: "github-web",
        fixtureTier: "standard",
        storageState: testingProfileStorageState
      }
    },
    {
      name: "github-web-stress",
      use: {
        ...devices["Desktop Chrome"],
        target: "github-web",
        fixtureTier: "stress",
        storageState: testingProfileStorageState
      }
    },
    {
      name: "control-electron-standard",
      use: {
        ...devices["Desktop Chrome"],
        target: "control-electron",
        fixtureTier: "standard"
      }
    },
    {
      name: "control-electron-stress",
      use: {
        ...devices["Desktop Chrome"],
        target: "control-electron",
        fixtureTier: "stress"
      }
    }
  ]
});
