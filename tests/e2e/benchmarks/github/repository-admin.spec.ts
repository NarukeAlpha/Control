import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/repository-admin", () => {
  test("opens repository administration metadata", async ({
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
      await benchmarkTelemetry.measure("open_repository_admin", phase, () =>
        driver.openRepositoryAdministration(providerFixture)
      );

      const data = await driver.observeRepositoryAdministration(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "repository-admin",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/repository-admin",
        phase,
        signature: `${providerFixture.nameWithOwner}|repository-admin`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`repository-admin-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
