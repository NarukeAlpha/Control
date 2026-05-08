import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/contributors", () => {
  test("opens repository contributors", async ({ driver, providerFixture, benchmarkTelemetry }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () => driver.searchRepository(providerFixture));
      await benchmarkTelemetry.measure("open_repository", phase, () => driver.openRepository(providerFixture));
      await benchmarkTelemetry.measure("open_contributors", phase, () => driver.openContributors(providerFixture));

      const data = await driver.observeContributors(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "contributors",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/contributors",
        phase,
        signature: `${providerFixture.nameWithOwner}|contributors`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`contributors-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
