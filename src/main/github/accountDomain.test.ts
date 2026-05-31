import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import { OctokitAccountDomain, type OctokitAccountClient } from "./accountDomain";
import type { GitHubRepositoryNode } from "./repositoryDomain";

describe("OctokitAccountDomain", () => {
  it("loads viewer, profile, and account repositories through the account domain", async () => {
    const graphql = vi.fn(
      async (query: string, variables?: Record<string, string | number | boolean | null>) => {
        if (query.includes("query Viewer ") || query.includes("query Viewer {")) {
          return {
            viewer: {
              login: "octocat",
              name: "The Octocat",
              avatarUrl: null,
              url: "https://github.com/octocat"
            }
          };
        }
        if (query.includes("AccountProfile")) {
          return { user: profileFixture(String(variables?.login ?? "octocat")) };
        }
        if (query.includes("AccountRepositories")) {
          return { user: { repositories: { nodes: [repositoryFixture()] } } };
        }
        throw new Error("Unexpected GraphQL query");
      }
    );
    const domain = new OctokitAccountDomain(
      createClient({
        graphql: async <T>(query: string, variables?: Record<string, string | number | boolean | null>) =>
          (await graphql(query, variables)) as T
      }),
      mapTestError
    );

    await expect(domain.getViewer()).resolves.toEqual({
      login: "octocat",
      name: "The Octocat",
      avatarUrl: null,
      htmlUrl: "https://github.com/octocat"
    });
    await expect(domain.getAccountProfile({ login: "octocat" })).resolves.toEqual(
      expect.objectContaining({
        login: "octocat",
        pinnedRepositories: [expect.objectContaining({ nameWithOwner: "octocat/control" })]
      })
    );
    await expect(domain.listAccountRepositories({ login: "octocat", limit: 5 })).resolves.toEqual([
      expect.objectContaining({ nameWithOwner: "octocat/control" })
    ]);
  });

  it("loads account issue and pull-request work lists through search queries", async () => {
    const graphql = vi.fn(
      async (query: string, _variables?: Record<string, string | number | boolean | null>) => {
        if (query.includes("query Viewer ")) {
          return {
            viewer: { login: "octocat", name: null, avatarUrl: null, url: "https://github.com/octocat" }
          };
        }
        if (query.includes("AccountIssues")) {
          return { search: { nodes: [issueNodeFixture()] } };
        }
        if (query.includes("AccountPullRequests")) {
          return { search: { nodes: [pullRequestNodeFixture()] } };
        }
        throw new Error("Unexpected GraphQL query");
      }
    );
    const domain = new OctokitAccountDomain(
      createClient({
        graphql: async <T>(query: string, variables?: Record<string, string | number | boolean | null>) =>
          (await graphql(query, variables)) as T
      }),
      mapTestError
    );

    await expect(domain.listAccountIssues({ state: "all", limit: 4 })).resolves.toEqual([
      expect.objectContaining({ number: 42, repositoryNameWithOwner: "octocat/control" })
    ]);
    await expect(domain.listAccountPullRequests({ state: "closed", limit: 3 })).resolves.toEqual([
      expect.objectContaining({ number: 17, headRefName: "feature/account-domain" })
    ]);
    expect(graphql).toHaveBeenCalledWith(expect.stringContaining("AccountIssues"), {
      searchQuery: "is:issue involves:octocat archived:false sort:updated-desc",
      limit: 4
    });
    expect(graphql).toHaveBeenCalledWith(expect.stringContaining("AccountPullRequests"), {
      searchQuery: "is:pr is:closed involves:octocat archived:false sort:updated-desc",
      limit: 3
    });
  });

  it("maps account failures into statusful results", async () => {
    const domain = new OctokitAccountDomain(
      createClient({
        graphql: async () => {
          throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
        }
      }),
      mapTestError
    );

    await expect(domain.getAccountProfileWithStatus({ login: "octocat" })).resolves.toEqual({
      profile: null,
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });
});

function createClient(overrides: Partial<OctokitAccountClient>): OctokitAccountClient {
  return {
    graphql: async () => {
      throw new Error("Unexpected GraphQL request");
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

function profileFixture(login: string) {
  return {
    id: `U_${login}`,
    login,
    name: "The Octocat",
    avatarUrl: null,
    url: `https://github.com/${login}`,
    bio: "GitHub mascot",
    company: null,
    location: null,
    websiteUrl: null,
    followers: { totalCount: 100 },
    following: { totalCount: 3 },
    repositories: { totalCount: 10 },
    starredRepositories: { totalCount: 5 },
    status: { emoji: ":shipit:", message: "Shipping" },
    pinnedItems: { nodes: [repositoryFixture()] }
  };
}

function repositoryFixture(): GitHubRepositoryNode {
  return {
    id: "R_1",
    name: "control",
    nameWithOwner: "octocat/control",
    description: "Control",
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    stargazerCount: 12,
    forkCount: 3,
    updatedAt: "2026-05-01T00:00:00Z",
    pushedAt: "2026-05-02T00:00:00Z",
    defaultBranchRef: { name: "main" },
    owner: { login: "octocat", avatarUrl: null },
    watchers: { totalCount: 4 },
    issues: { totalCount: 5 },
    pullRequests: { totalCount: 2 },
    discussions: { totalCount: 1 },
    projectsV2: { totalCount: 1 },
    releases: { totalCount: 1 },
    primaryLanguage: { name: "TypeScript", color: "#3178c6" }
  };
}

function issueNodeFixture() {
  return {
    id: "I_42",
    number: 42,
    title: "Track account domain",
    state: "OPEN",
    stateReason: null,
    locked: false,
    url: "https://github.com/octocat/control/issues/42",
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-02T00:00:00Z",
    author: { login: "octocat", avatarUrl: null },
    comments: { totalCount: 1 },
    labels: { nodes: [{ id: "L_1", name: "cleanup", color: "0366d6" }] },
    assignees: {
      nodes: [{ id: "U_1", login: "octocat", avatarUrl: null, url: "https://github.com/octocat" }]
    },
    milestone: null,
    repository: { nameWithOwner: "octocat/control" }
  };
}

function pullRequestNodeFixture() {
  return {
    id: "PR_17",
    number: 17,
    title: "Extract account domain",
    state: "CLOSED",
    merged: true,
    mergedAt: "2026-05-03T00:00:00Z",
    isDraft: false,
    locked: false,
    url: "https://github.com/octocat/control/pull/17",
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-02T00:00:00Z",
    author: { login: "octocat", avatarUrl: null },
    comments: { totalCount: 2 },
    reviewThreads: { totalCount: 3 },
    additions: 10,
    deletions: 2,
    changedFiles: 4,
    mergeStateStatus: "CLEAN",
    headRefName: "feature/account-domain",
    baseRefName: "main",
    headRepository: { nameWithOwner: "octocat/control" },
    baseRepository: { nameWithOwner: "octocat/control" },
    repository: { nameWithOwner: "octocat/control" }
  };
}
