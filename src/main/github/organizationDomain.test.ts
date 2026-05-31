import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import { OctokitOrganizationDomain, type OctokitOrganizationClient } from "./organizationDomain";

describe("OctokitOrganizationDomain", () => {
  it("loads organizations and preserves membership availability per organization", async () => {
    const graphql = vi.fn(
      async (_query: string, _variables?: Record<string, string | number | boolean | null>) => ({
        viewer: {
          login: "octocat",
          organizations: {
            nodes: [
              organizationFixture({ login: "openai" }),
              organizationFixture({ login: "github", name: "GitHub" })
            ]
          }
        }
      })
    );
    const rest = vi.fn(async (_route: string, params: Record<string, unknown>) => {
      if (params.org === "github") {
        throw new Error("Membership unavailable");
      }
      return { role: "admin", state: "active" };
    });
    const domain = new OctokitOrganizationDomain(
      createClient({
        graphql: async <T>(query: string, variables?: Record<string, string | number | boolean | null>) =>
          (await graphql(query, variables)) as T,
        rest: async <T>(route: string, params: Record<string, unknown>) => (await rest(route, params)) as T
      }),
      mapTestError
    );

    await expect(domain.listOrganizations({ limit: 2 })).resolves.toEqual([
      expect.objectContaining({
        login: "openai",
        viewerMembershipRole: "admin",
        viewerMembershipState: "active",
        viewerMembershipAvailability: { status: "available", message: null }
      }),
      expect.objectContaining({
        login: "github",
        viewerMembershipRole: null,
        viewerMembershipState: null,
        viewerMembershipAvailability: { status: "error", message: "Membership unavailable" }
      })
    ]);
    expect(graphql).toHaveBeenCalledWith(expect.stringContaining("ViewerOrganizations"), { limit: 2 });
    expect(rest).toHaveBeenCalledWith("GET /orgs/{org}/memberships/{username}", {
      org: "openai",
      username: "octocat"
    });
  });

  it("loads organization teams, repositories, and members through domain routes", async () => {
    const restPaginatedArray = vi.fn(
      async (route: string, _params: Record<string, unknown>, _limit: number) => {
        if (route === "GET /orgs/{org}/teams") {
          return [teamFixture()];
        }
        if (route === "GET /orgs/{org}/repos") {
          return [repositoryFixture()];
        }
        if (route === "GET /orgs/{org}/teams/{team_slug}/repos") {
          return [repositoryFixture({ name: "team-repo" })];
        }
        if (route === "GET /orgs/{org}/teams/{team_slug}/members") {
          return [memberFixture({ login: "team-member" })];
        }
        if (route === "GET /orgs/{org}/members") {
          return [memberFixture({ login: "org-member" })];
        }
        throw new Error(`Unexpected route ${route}`);
      }
    );
    const domain = new OctokitOrganizationDomain(
      createClient({
        restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
          (await restPaginatedArray(route, params, limit)) as T[]
      }),
      mapTestError
    );

    await expect(domain.listOrganizationTeams({ org: "openai", limit: 3 })).resolves.toEqual([
      expect.objectContaining({ slug: "core", parent: expect.objectContaining({ slug: "platform" }) })
    ]);
    await expect(domain.listOrganizationRepositoriesWithStatus({ org: "openai" })).resolves.toEqual({
      items: [expect.objectContaining({ nameWithOwner: "openai/control", permission: "ADMIN" })],
      availability: { status: "available", message: null }
    });
    await expect(
      domain.listOrganizationTeamRepositoriesWithStatus({ org: "openai", teamSlug: "core" })
    ).resolves.toEqual({
      items: [expect.objectContaining({ name: "team-repo" })],
      availability: { status: "available", message: null }
    });
    await expect(
      domain.listOrganizationTeamMembersWithStatus({ org: "openai", teamSlug: "core" })
    ).resolves.toEqual({
      items: [expect.objectContaining({ login: "team-member" })],
      availability: { status: "available", message: null }
    });
    await expect(domain.listOrganizationMembersWithStatus({ org: "openai" })).resolves.toEqual({
      items: [expect.objectContaining({ login: "org-member" })],
      availability: { status: "available", message: null }
    });
  });

  it("maps organization team failures into statusful results", async () => {
    const domain = new OctokitOrganizationDomain(
      createClient({
        restPaginatedArray: async () => {
          throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(domain.listOrganizationTeamsWithStatus({ org: "openai" })).resolves.toEqual({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });
});

function createClient(overrides: Partial<OctokitOrganizationClient>): OctokitOrganizationClient {
  return {
    graphql: async () => {
      throw new Error("Unexpected GraphQL request");
    },
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

function organizationFixture(input: { login: string; name?: string }) {
  return {
    id: `O_${input.login}`,
    login: input.login,
    name: input.name ?? input.login,
    description: "Organization",
    avatarUrl: `https://avatars.test/${input.login}`,
    url: `https://github.com/${input.login}`,
    websiteUrl: null,
    location: null,
    repositories: { totalCount: 12 },
    teams: { totalCount: 2 },
    viewerIsAMember: true,
    viewerCanAdminister: true,
    viewerCanCreateRepositories: true,
    viewerCanCreateTeams: false
  };
}

function teamFixture() {
  return {
    id: 10,
    node_id: "T_10",
    name: "Core",
    slug: "core",
    description: "Core team",
    privacy: "closed",
    permission: "push",
    notification_setting: "notifications_enabled",
    members_count: 4,
    repos_count: 8,
    html_url: "https://github.com/orgs/openai/teams/core",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-02T00:00:00Z",
    organization: { login: "openai" },
    parent: {
      id: 9,
      node_id: "T_9",
      name: "Platform",
      slug: "platform",
      html_url: "https://github.com/orgs/openai/teams/platform"
    }
  };
}

function repositoryFixture(overrides: { name?: string } = {}) {
  const name = overrides.name ?? "control";
  return {
    id: 22,
    node_id: "R_22",
    name,
    full_name: `openai/${name}`,
    description: "Repository",
    html_url: `https://github.com/openai/${name}`,
    default_branch: "main",
    visibility: "public",
    private: false,
    updated_at: "2026-05-02T00:00:00Z",
    pushed_at: "2026-05-02T00:00:00Z",
    owner: { login: "openai" },
    permissions: { admin: true, maintain: false, push: true, triage: true, pull: true }
  };
}

function memberFixture(input: { login: string }) {
  return {
    id: 99,
    login: input.login,
    avatar_url: `https://avatars.test/${input.login}`,
    html_url: `https://github.com/${input.login}`,
    site_admin: false
  };
}
