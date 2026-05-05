import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/issues", () => {
  test("loads issue list and first issue detail", async ({ driver, providerFixture, benchmarkTelemetry }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("search_repository", phase, () => driver.searchRepository(providerFixture));
      await benchmarkTelemetry.measure("open_repository", phase, () => driver.openRepository(providerFixture));
      await benchmarkTelemetry.measure("open_issues", phase, () => driver.openIssues(providerFixture));
      const data = await benchmarkTelemetry.measure("open_first_issue", phase, () =>
        driver.openFirstIssue(providerFixture)
      );

      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "issues",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/issues",
        phase,
        signature: `${providerFixture.nameWithOwner}|issue:${data.number}`,
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`issues-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
