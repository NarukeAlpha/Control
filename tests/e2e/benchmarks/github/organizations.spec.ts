import { benchmarkTest as test } from "../support/benchmarkTest";
import type { BenchmarkPhase } from "../support/types";

test.describe("github/organizations", () => {
  test("opens account organizations and visible teams", async ({
    driver,
    providerFixture,
    benchmarkTelemetry
  }) => {
    for (const phase of ["cold", "warm"] satisfies BenchmarkPhase[]) {
      await benchmarkTelemetry.measure("open_organizations", phase, () =>
        driver.openOrganizations(providerFixture)
      );
      await benchmarkTelemetry.measure("open_organization_teams", phase, () =>
        driver.openOrganizationTeams(providerFixture)
      );

      const data = await driver.observeOrganizations(providerFixture);
      benchmarkTelemetry.recordObservation({
        provider: "github",
        target: driver.target,
        category: "organizations",
        fixtureTier: providerFixture.tier,
        fixtureId: providerFixture.id,
        scenarioId: "github/organizations",
        phase,
        signature: "github-account|organizations",
        data
      });

      const screenshotPath = benchmarkTelemetry.artifactPath(`organizations-${phase}.png`);
      await driver.screenshot(screenshotPath);
      benchmarkTelemetry.recordArtifact("screenshot", screenshotPath);
    }
  });
});
