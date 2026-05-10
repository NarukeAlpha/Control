import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/actions", () => {
  test("opens repository Actions runs", async ({ driver, providerFixture, benchmarkTelemetry }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () => driver.searchRepository(providerFixture));
      await benchmarkTelemetry.measure("open_repository", phase, () => driver.openRepository(providerFixture));
      await benchmarkTelemetry.measure("open_actions", phase, () => driver.openActions(providerFixture));
      const listData = await driver.observeActions(providerFixture);
      await benchmarkTelemetry.measure("open_first_action_run", phase, () =>
        driver.openFirstActionRun(providerFixture)
      );

      const detailData = await driver.observeActionRun(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "actions",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/actions",
        phase,
        signature: `${providerFixture.nameWithOwner}|actions`,
        data: {
          list: listData,
          detail: detailData
        }
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`actions-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
