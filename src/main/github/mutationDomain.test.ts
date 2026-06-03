import { describe, expect, it, vi } from "vitest";

import { OctokitMutationDomain, type OctokitMutationClient } from "./mutationDomain";

function createClient(currentProtection: Record<string, unknown> | null): {
  client: OctokitMutationClient;
  rest: ReturnType<typeof vi.fn>;
} {
  const rest = vi.fn(async (route: string, _params?: Record<string, unknown>): Promise<unknown> => {
    if (route === "GET /repos/{owner}/{repo}/branches/{branch}/protection") {
      if (!currentProtection) {
        throw Object.assign(new Error("not found"), { status: 404 });
      }
      return currentProtection;
    }
    return { ok: true };
  });
  return {
    rest,
    client: {
      graphql: vi.fn(),
      rest: async <T>(route: string, params?: Record<string, unknown>): Promise<T> =>
        (await rest(route, params)) as T
    }
  };
}

describe("OctokitMutationDomain branch protection", () => {
  it("preserves omitted branch protection fields before issuing the full GitHub PUT", async () => {
    const { client, rest } = createClient({
      required_status_checks: {
        strict: true,
        contexts: ["macOS build"],
        checks: [{ context: "macOS build", app_id: 123 }]
      },
      enforce_admins: { enabled: true },
      required_pull_request_reviews: {
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
        require_last_push_approval: false,
        required_approving_review_count: 2
      },
      required_linear_history: { enabled: true },
      allow_force_pushes: { enabled: false },
      allow_deletions: { enabled: false },
      block_creations: { enabled: false },
      required_conversation_resolution: { enabled: true },
      lock_branch: { enabled: false },
      allow_fork_syncing: { enabled: false }
    });

    await new OctokitMutationDomain(client).mutate({
      action: "updateBranchProtection",
      owner: "owner",
      repo: "repo",
      branch: "main",
      enforce_admins: false
    });

    expect(rest).toHaveBeenNthCalledWith(1, "GET /repos/{owner}/{repo}/branches/{branch}/protection", {
      owner: "owner",
      repo: "repo",
      branch: "main"
    });
    expect(rest).toHaveBeenNthCalledWith(
      2,
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection",
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        branch: "main",
        required_status_checks: {
          strict: true,
          contexts: ["macOS build"],
          checks: [{ context: "macOS build", app_id: 123 }]
        },
        enforce_admins: false,
        required_pull_request_reviews: {
          dismiss_stale_reviews: true,
          require_code_owner_reviews: true,
          require_last_push_approval: false,
          required_approving_review_count: 2
        },
        restrictions: null,
        required_linear_history: true,
        allow_force_pushes: false,
        allow_deletions: false,
        block_creations: false,
        required_conversation_resolution: true,
        lock_branch: false,
        allow_fork_syncing: false
      })
    );
  });

  it("refuses partial branch protection updates when existing restrictions cannot be preserved", async () => {
    const { client, rest } = createClient({
      restrictions: {
        users: [{ login: "octocat" }],
        teams: [],
        apps: []
      }
    });

    await expect(
      new OctokitMutationDomain(client).mutate({
        action: "updateBranchProtection",
        owner: "owner",
        repo: "repo",
        branch: "main",
        enforce_admins: true
      })
    ).rejects.toThrow(
      "Cannot update branch protection without explicit restrictions; existing push restrictions cannot be safely preserved."
    );

    expect(rest).toHaveBeenCalledTimes(1);
  });
});
