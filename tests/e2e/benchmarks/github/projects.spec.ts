import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/projects", () => {
  test("opens repository projects", async ({ driver, providerFixture, benchmarkTelemetry }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () =>
        driver.searchRepository(providerFixture)
      );
      await benchmarkTelemetry.measure("open_repository", phase, () =>
        driver.openRepository(providerFixture)
      );
      await benchmarkTelemetry.measure("open_projects", phase, () => driver.openProjects(providerFixture));

      const data = await driver.observeProjects(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "projects",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/projects",
        phase,
        signature: `${providerFixture.nameWithOwner}|projects`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`projects-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
