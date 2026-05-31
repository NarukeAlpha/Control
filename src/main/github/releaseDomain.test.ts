import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import { OctokitReleaseDomain, type GitHubRelease, type OctokitReleaseClient } from "./releaseDomain";

describe("OctokitReleaseDomain", () => {
  it("loads releases through the release domain", async () => {
    const restPaginatedArray = vi.fn(
      async (_route: string, _params: Record<string, unknown>, _limit: number) => [
        releaseFixture({ id: 1, tagName: "v1.0.0" })
      ]
    );
    const domain = new OctokitReleaseDomain(
      createClient({
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(domain.listReleases({ owner: "NarukeAlpha", repo: "control", limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        tagName: "v1.0.0",
        assets: [
          expect.objectContaining({
            id: 11,
            name: "Control.dmg",
            downloadCount: 7
          })
        ]
      })
    ]);
    expect(restPaginatedArray).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/releases",
      { owner: "NarukeAlpha", repo: "control" },
      10
    );
  });

  it("loads release detail by release id", async () => {
    const rest = vi.fn(async (_route: string, _params: Record<string, unknown>) =>
      releaseFixture({ id: 2, tagName: "v2.0.0" })
    );
    const domain = new OctokitReleaseDomain(
      createClient({
        rest: async <T>(route: string, params: Record<string, unknown> = {}) =>
          (await rest(route, params)) as T
      }),
      mapTestError
    );

    await expect(
      domain.getReleaseDetailWithStatus({ owner: "NarukeAlpha", repo: "control", releaseId: 2 })
    ).resolves.toEqual({
      item: expect.objectContaining({
        id: 2,
        tagName: "v2.0.0"
      }),
      availability: { status: "available", message: null }
    });
    expect(rest).toHaveBeenCalledWith("GET /repos/{owner}/{repo}/releases/{release_id}", {
      owner: "NarukeAlpha",
      repo: "control",
      release_id: 2
    });
  });

  it("loads release detail by tag name when no release id is present", async () => {
    const rest = vi.fn(async (_route: string, _params: Record<string, unknown>) =>
      releaseFixture({ id: 3, tagName: "v3.0.0" })
    );
    const domain = new OctokitReleaseDomain(
      createClient({
        rest: async <T>(route: string, params: Record<string, unknown> = {}) =>
          (await rest(route, params)) as T
      }),
      mapTestError
    );

    await expect(
      domain.getReleaseDetailWithStatus({
        owner: "NarukeAlpha",
        repo: "control",
        releaseTagName: "v3.0.0"
      })
    ).resolves.toEqual({
      item: expect.objectContaining({
        id: 3,
        tagName: "v3.0.0"
      }),
      availability: { status: "available", message: null }
    });
    expect(rest).toHaveBeenCalledWith("GET /repos/{owner}/{repo}/releases/tags/{tag}", {
      owner: "NarukeAlpha",
      repo: "control",
      tag: "v3.0.0"
    });
  });

  it("maps release failures into statusful results", async () => {
    const domain = new OctokitReleaseDomain(
      createClient({
        restPaginatedArray: async () => {
          throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(domain.listReleasesWithStatus({ owner: "NarukeAlpha", repo: "control" })).resolves.toEqual({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });
});

function createClient(overrides: Partial<OctokitReleaseClient>): OctokitReleaseClient {
  return {
    rest: async () => {
      throw new Error("Unexpected REST request");
    },
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

function releaseFixture(input: { id: number; tagName: string }): GitHubRelease {
  return {
    id: input.id,
    name: "Control",
    tag_name: input.tagName,
    target_commitish: "main",
    body: "Release notes",
    draft: false,
    prerelease: false,
    published_at: "2026-05-01T00:00:00Z",
    html_url: `https://github.com/NarukeAlpha/control/releases/tag/${input.tagName}`,
    assets: [
      {
        id: 11,
        name: "Control.dmg",
        label: null,
        state: "uploaded",
        content_type: "application/octet-stream",
        size: 1024,
        download_count: 7,
        browser_download_url: "https://github.com/NarukeAlpha/control/releases/download/v1/Control.dmg",
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z"
      }
    ]
  };
}
