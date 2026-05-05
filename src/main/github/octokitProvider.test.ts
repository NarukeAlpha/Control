import { beforeEach, describe, expect, it, vi } from "vitest";

const graphqlMock = vi.fn();
const requestMock = vi.fn();

vi.mock("octokit", () => ({
  Octokit: class {
    graphql = graphqlMock;
    request = requestMock;
  }
}));

import { OctokitProvider } from "./octokitProvider";

function makeRepositoryNode() {
  return {
    id: "R_1",
    name: "swift",
    nameWithOwner: "apple/swift",
    description: "Swift",
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    stargazerCount: 10,
    forkCount: 3,
    updatedAt: "2026-05-05T00:00:00.000Z",
    pushedAt: "2026-05-05T00:00:00.000Z",
    defaultBranchRef: { name: "main" },
    owner: { login: "apple", avatarUrl: "https://github.com/images/error/octocat_happy.gif" },
    watchers: { totalCount: 4 },
    issues: { totalCount: 2 },
    pullRequests: { totalCount: 1 },
    discussions: { totalCount: 0 },
    releases: { totalCount: 5 },
    primaryLanguage: { name: "Swift", color: "#f05138" }
  };
}

describe("OctokitProvider query scopes", () => {
  beforeEach(() => {
    graphqlMock.mockReset();
    requestMock.mockReset();
  });

  it("does not request project scope when listing repositories", async () => {
    graphqlMock.mockResolvedValue({
      viewer: {
        repositories: {
          nodes: [makeRepositoryNode()]
        }
      }
    });

    const provider = new OctokitProvider("gho_test");
    const repositories = await provider.listRepositories({ limit: 1 });

    expect(graphqlMock.mock.calls[0]?.[0]).not.toContain("projectsV2");
    expect(repositories[0]?.counts.projects).toBe(0);
  });

  it("does not request project scope when loading repository detail", async () => {
    graphqlMock.mockResolvedValue({
      repository: {
        ...makeRepositoryNode(),
        url: "https://github.com/apple/swift",
        homepageUrl: null,
        licenseInfo: null,
        repositoryTopics: { nodes: [] },
        branches: { totalCount: 128 },
        tags: { totalCount: 32 },
        languages: { totalSize: 0, edges: [] },
        parent: null,
        viewerHasStarred: false,
        viewerSubscription: "UNSUBSCRIBED",
        viewerPermission: "WRITE",
        isArchived: false,
        isDisabled: false
      }
    });

    const provider = new OctokitProvider("gho_test");
    const repository = await provider.getRepository("apple", "swift");

    expect(graphqlMock.mock.calls[0]?.[0]).not.toContain("projectsV2");
    expect(repository.counts.projects).toBe(0);
  });

  it("pins the GitHub REST API version on JSON requests", async () => {
    requestMock.mockResolvedValue({ data: [] });

    const provider = new OctokitProvider("gho_test");
    await provider.listIssues({ owner: "apple", repo: "swift", state: "open" });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/issues",
      expect.objectContaining({
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
  });

  it("pins the GitHub REST API version without replacing raw content accepts", async () => {
    requestMock.mockResolvedValue({ data: "# README" });

    const provider = new OctokitProvider("gho_test");
    await provider.getFileContent({ owner: "NarukeAlpha", repo: "dots", path: "list.md", ref: "main" });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/contents/{path}",
      expect.objectContaining({
        headers: {
          accept: "application/vnd.github.raw",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
  });
});
