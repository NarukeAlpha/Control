import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/files", () => {
  test("opens README.md from the repository code view", async ({
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
      await benchmarkTelemetry.measure("render_file_list", phase, () => driver.waitForFileList());
      await benchmarkTelemetry.measure("open_readme_file", phase, () =>
        driver.openReadmeFile(providerFixture)
      );

      const data = await driver.observeFile(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "files",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/files",
        phase,
        signature: `${providerFixture.nameWithOwner}|file:README.md`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`files-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
