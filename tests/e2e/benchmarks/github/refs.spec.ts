import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/refs", () => {
  test("opens repository branch and tag browsing", async ({
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
      await benchmarkTelemetry.measure("open_refs", phase, () => driver.openRefs(providerFixture));

      const data = await driver.observeRefs(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "refs",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/refs",
        phase,
        signature: `${providerFixture.nameWithOwner}|refs`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`refs-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
