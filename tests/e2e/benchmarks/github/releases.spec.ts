import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/releases", () => {
  test("opens repository releases", async ({ driver, providerFixture, benchmarkTelemetry }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () => driver.searchRepository(providerFixture));
      await benchmarkTelemetry.measure("open_repository", phase, () => driver.openRepository(providerFixture));
      await benchmarkTelemetry.measure("open_releases", phase, () => driver.openReleases(providerFixture));

      const data = await driver.observeReleases(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "releases",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/releases",
        phase,
        signature: `${providerFixture.nameWithOwner}|releases`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`releases-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
