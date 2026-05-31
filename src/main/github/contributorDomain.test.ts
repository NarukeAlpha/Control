import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import {
  OctokitContributorDomain,
  type GitHubContributor,
  type OctokitContributorClient
} from "./contributorDomain";

describe("OctokitContributorDomain", () => {
  it("loads contributors through the contributor domain", async () => {
    const restPaginatedArray = vi.fn(
      async (_route: string, _params: Record<string, unknown>, _limit: number) => [
        contributorFixture({ id: 1, login: "octocat", contributions: 42 })
      ]
    );
    const domain = new OctokitContributorDomain(
      createClient({
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(
      domain.listContributors({ owner: "NarukeAlpha", repo: "control", limit: 12 })
    ).resolves.toEqual([
      {
        id: 1,
        login: "octocat",
        avatarUrl: "https://avatars.test/octocat",
        htmlUrl: "https://github.com/octocat",
        contributions: 42
      }
    ]);
    expect(restPaginatedArray).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/contributors",
      { owner: "NarukeAlpha", repo: "control" },
      12
    );
  });

  it("maps contributor failures into statusful results", async () => {
    const domain = new OctokitContributorDomain(
      createClient({
        restPaginatedArray: async () => {
          throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(
      domain.listContributorsWithStatus({ owner: "NarukeAlpha", repo: "control" })
    ).resolves.toEqual({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });
});

function createClient(overrides: Partial<OctokitContributorClient>): OctokitContributorClient {
  return {
    restPaginatedArray: async () => {
      throw new Error("Unexpected paginated REST request");
    },
    ...overrides
  };
}

function mapTestError(error: unknown): GitHubReadAvailability {
  return {
    status:
      error && typeof error === "object" && (error as { status?: unknown }).status === 403
        ? "rate_limited"
        : "error",
    message: error instanceof Error ? error.message : "failed"
  };
}

function contributorFixture(input: { id: number; login: string; contributions: number }): GitHubContributor {
  return {
    id: input.id,
    login: input.login,
    avatar_url: `https://avatars.test/${input.login}`,
    html_url: `https://github.com/${input.login}`,
    contributions: input.contributions
  };
}
