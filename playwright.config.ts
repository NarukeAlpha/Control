import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:5173";
const testingProfileStorageState = "tests/e2e/state/testing-profile.json";

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "**/benchmarks/**",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "bun run dev:renderer -- --port 5173",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "testing-profile",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        locale: "en-US",
        storageState: testingProfileStorageState,
        timezoneId: "America/Puerto_Rico",
        viewport: { width: 1512, height: 982 },
        launchOptions: {
          args: ["--disable-extensions", "--no-first-run"]
        }
      }
    }
  ]
});
