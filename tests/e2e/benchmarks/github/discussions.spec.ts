import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/discussions", () => {
  test("opens repository discussions", async ({ driver, providerFixture, benchmarkTelemetry }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () => driver.searchRepository(providerFixture));
      await benchmarkTelemetry.measure("open_repository", phase, () => driver.openRepository(providerFixture));
      await benchmarkTelemetry.measure("open_discussions", phase, () => driver.openDiscussions(providerFixture));

      const data = await driver.observeDiscussions(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "discussions",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/discussions",
        phase,
        signature: `${providerFixture.nameWithOwner}|discussions`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`discussions-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
