import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import { OctokitIssueDomain, type GitHubIssue, type OctokitIssueClient } from "./issueDomain";

describe("OctokitIssueDomain", () => {
  it("loads issue lists through the issue domain and filters pull requests", async () => {
    const restPaginatedArray = vi.fn(
      async (_route: string, _params: Record<string, unknown>, _limit: number) => [
        issueFixture({ number: 12, title: "Keep issue behavior local" }),
        issueFixture({ number: 13, title: "Pull request hidden from issue list", pullRequest: {} })
      ]
    );
    const domain = new OctokitIssueDomain(
      createClient({
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(
      domain.listIssues({ owner: "NarukeAlpha", repo: "control", state: "all", limit: 7 })
    ).resolves.toEqual([
      expect.objectContaining({
        number: 12,
        title: "Keep issue behavior local",
        labels: [expect.objectContaining({ name: "cleanup" })],
        assignees: [expect.objectContaining({ login: "maintainer" })]
      })
    ]);
    expect(restPaginatedArray).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/issues",
      { owner: "NarukeAlpha", repo: "control", state: "all" },
      7
    );
  });

  it("maps issue list failures into statusful results", async () => {
    const domain = new OctokitIssueDomain(
      createClient({
        restPaginatedArray: async () => {
          throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(domain.listIssuesWithStatus({ owner: "NarukeAlpha", repo: "control" })).resolves.toEqual({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });

  it("keeps issue detail available when comments fail", async () => {
    const rest = vi.fn(async (route: string, _params?: Record<string, unknown>) => {
      if (route.includes("/issues/{issue_number}")) {
        return issueFixture({ number: 12, title: "Keep issue behavior local" });
      }
      throw new Error(`Unexpected REST route ${route}`);
    });
    const restPaginatedArray = vi.fn(
      async (route: string, _params?: Record<string, unknown>, _limit?: number) => {
        if (route.includes("/issues/{issue_number}/comments")) {
          throw new Error("Comments unavailable");
        }
        throw new Error(`Unexpected paginated REST route ${route}`);
      }
    );
    const domain = new OctokitIssueDomain(
      createClient({
        rest: async <T>(route: string, params: Record<string, unknown>) => (await rest(route, params)) as T,
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(
      domain.getIssueDetail({ owner: "NarukeAlpha", repo: "control", issueNumber: 12 })
    ).resolves.toEqual(
      expect.objectContaining({
        number: 12,
        body: "Issue body",
        commentsList: [],
        commentsAvailability: { status: "error", message: "Comments unavailable" }
      })
    );
  });
});

function createClient(overrides: Partial<OctokitIssueClient>): OctokitIssueClient {
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

function issueFixture(input: { number: number; title: string; pullRequest?: unknown }): GitHubIssue {
  return {
    id: input.number,
    node_id: `I_${input.number}`,
    number: input.number,
    title: input.title,
    state: "open",
    state_reason: null,
    locked: false,
    user: { login: "author", avatar_url: "https://avatars.test/author" },
    body: "Issue body",
    comments: 1,
    labels: [{ id: 1, name: "cleanup", color: "0366d6" }],
    assignees: [{ id: 2, login: "maintainer", avatar_url: null, html_url: null }],
    milestone: {
      id: 3,
      number: 1,
      title: "Part 2",
      description: null,
      state: "open",
      due_on: null,
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-01T00:00:00Z",
      closed_at: null,
      html_url: "https://github.com/NarukeAlpha/control/milestone/1",
      open_issues: 2,
      closed_issues: 0
    },
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-02T00:00:00Z",
    html_url: `https://github.com/NarukeAlpha/control/issues/${input.number}`,
    pull_request: input.pullRequest
  };
}
