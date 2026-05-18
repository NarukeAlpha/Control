import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/repositories", () => {
  test("loads repository overview", async ({ driver, providerFixture, benchmarkTelemetry }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () =>
        driver.searchRepository(providerFixture)
      );
      await benchmarkTelemetry.measure("open_repository", phase, () =>
        driver.openRepository(providerFixture)
      );
      await benchmarkTelemetry.measure("render_header", phase, () =>
        driver.waitForRepositoryHeader(providerFixture)
      );
      await benchmarkTelemetry.measure("render_file_list", phase, () => driver.waitForFileList());
      await benchmarkTelemetry.measure("render_readme", phase, () => driver.waitForReadme());

      const data = await driver.observeRepository(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "repositories",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/repositories",
        phase,
        signature: `${providerFixture.nameWithOwner}|repository`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`repositories-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
