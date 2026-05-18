import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/pull-requests", () => {
  test("loads pull request list and first pull request detail", async ({
    driver,
    providerFixture,
    benchmarkTelemetry
  }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () =>
        driver.searchRepository(providerFixture)
      );
      await benchmarkTelemetry.measure("open_repository", phase, () =>
        driver.openRepository(providerFixture)
      );
      await benchmarkTelemetry.measure("open_pull_requests", phase, () =>
        driver.openPullRequests(providerFixture)
      );
      const data = await benchmarkTelemetry.measure("open_first_pull_request", phase, () =>
        driver.openFirstPullRequest(providerFixture)
      );

      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "pull-requests",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/pull-requests",
        phase,
        signature: `${providerFixture.nameWithOwner}|pull:${data.number}`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`pull-requests-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
