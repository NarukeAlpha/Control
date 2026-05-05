export type FixtureTier = "standard" | "stress";
export type RunTarget = "github-web" | "control-electron";
export type ScenarioCategory = "repositories" | "issues" | "pull-requests" | "files";
export type BenchmarkPhase = "cold" | "warm";
export type MetricStatus = "passed" | "failed";

export interface BenchmarkOptions {
  target: RunTarget;
  fixtureTier: FixtureTier;
}

export interface ProviderFixture {
  id: string;
  provider: "github";
  tier: FixtureTier;
  owner: string;
  repo: string;
  nameWithOwner: string;
  searchQuery?: string;
  aliases?: string[];
}

export interface MetricEvent {
  name: string;
  phase: BenchmarkPhase;
  durationMs: number;
  status: MetricStatus;
  startedAt: string;
  finishedAt: string;
  error: string | null;
}

export interface ScenarioObservation {
  provider: "github";
  target: RunTarget;
  category: ScenarioCategory;
  fixtureTier: FixtureTier;
  fixtureId: string;
  scenarioId: string;
  phase: BenchmarkPhase;
  signature: string;
  data: object;
}

export const githubFixtures: Record<FixtureTier, ProviderFixture> = {
  standard: {
    id: "github-standard-swift",
    provider: "github",
    tier: "standard",
    owner: "apple",
    repo: "swift",
    nameWithOwner: "apple/swift",
    searchQuery: "swiftlang/swift",
    aliases: ["swiftlang/swift"]
  },
  stress: {
    id: "github-stress-go",
    provider: "github",
    tier: "stress",
    owner: "golang",
    repo: "go",
    nameWithOwner: "golang/go"
  }
};

export function getGithubFixture(tier: FixtureTier): ProviderFixture {
  return githubFixtures[tier];
}
