import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import { maxPreviewBytes } from "@shared/filePreviewPolicy";
import {
  mapLanguages,
  mapRepositorySummary,
  OctokitRepositoryDomain,
  type OctokitRepositoryClient,
  type GitHubRepositoryNode
} from "./repositoryDomain";

describe("OctokitRepositoryDomain", () => {
  it("loads viewer repositories through the repository GraphQL module", async () => {
    const repository = repositoryNode("NarukeAlpha/control");
    const graphqlMock = vi.fn(
      async (_query: string, _variables?: Parameters<OctokitRepositoryClient["graphql"]>[1]) => ({
        viewer: {
          repositories: {
            nodes: [repository]
          }
        }
      })
    );
    const client = createClient({
      graphql: async <T>(query: string, variables?: Parameters<OctokitRepositoryClient["graphql"]>[1]) =>
        (await graphqlMock(query, variables)) as T
    });
    const domain = new OctokitRepositoryDomain(client, mapTestError);

    await expect(domain.listRepositories({ limit: 7 })).resolves.toEqual([
      expect.objectContaining({
        id: repository.id,
        owner: "NarukeAlpha",
        name: "control",
        nameWithOwner: "NarukeAlpha/control",
        counts: expect.objectContaining({
          openIssues: 3,
          openPullRequests: 4,
          discussions: 5,
          releases: 6
        })
      })
    ]);
    expect(graphqlMock).toHaveBeenCalledWith(expect.stringContaining("query ViewerRepositories"), {
      limit: 7
    });
  });

  it("maps repository-domain failures into statusful results", async () => {
    const graphqlMock = vi.fn(
      async (_query: string, _variables?: Parameters<OctokitRepositoryClient["graphql"]>[1]) => {
        throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
      }
    );
    const client = createClient({
      graphql: async <T>(query: string, variables?: Parameters<OctokitRepositoryClient["graphql"]>[1]) =>
        (await graphqlMock(query, variables)) as T
    });
    const domain = new OctokitRepositoryDomain(client, mapTestError);

    await expect(domain.listRepositoriesWithStatus({})).resolves.toEqual({
      items: [],
      availability: { status: "rate_limited", message: "API rate limit exceeded" }
    });
  });

  it("loads repository detail through the repository domain and merges REST metadata", async () => {
    const repository = repositoryDetailNode("NarukeAlpha/control");
    const restMock = vi.fn(async (_route: string, _params?: Record<string, unknown>) => ({
      id: 1,
      node_id: "R_rest",
      name: "control",
      full_name: "NarukeAlpha/control",
      html_url: "https://github.com/NarukeAlpha/control",
      default_branch: "trunk",
      visibility: "public",
      private: false,
      archived: false,
      disabled: false,
      owner: { login: "NarukeAlpha" },
      permissions: { admin: true },
      parent: null,
      source: null
    }));
    const client = createClient({
      graphql: async <T>() => ({ repository }) as T,
      rest: async <T>(route: string, params: Record<string, unknown>) => (await restMock(route, params)) as T
    });
    const domain = new OctokitRepositoryDomain(client, mapTestError);

    await expect(domain.getRepository("NarukeAlpha", "control")).resolves.toEqual(
      expect.objectContaining({
        owner: "NarukeAlpha",
        name: "control",
        homepageUrl: "https://control.test",
        htmlUrl: "https://github.com/NarukeAlpha/control",
        branchCount: 9,
        tagCount: 4,
        languages: [{ name: "TypeScript", color: "#3178c6", size: 80, percent: 100 }],
        administrationAvailability: { status: "available", message: null },
        administration: expect.objectContaining({
          defaultBranch: "trunk",
          viewerPermissions: expect.objectContaining({ admin: true })
        })
      })
    );
    expect(restMock).toHaveBeenCalledWith("GET /repos/{owner}/{repo}", {
      owner: "NarukeAlpha",
      repo: "control"
    });
  });

  it("owns repository refs, tree, README, contents, file content, and forks REST paths", async () => {
    const restMock = vi.fn(async (route: string, _params?: Record<string, unknown>) => {
      if (route.includes("/git/trees/")) {
        return {
          sha: "HEAD",
          truncated: false,
          tree: [
            { path: "src/main.ts", type: "blob", sha: "file-sha", size: 10 },
            { path: "src", type: "tree", sha: "dir-sha" }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
        return {
          name: "main.ts",
          path: "src/main.ts",
          type: "file",
          sha: "file-sha",
          size: 23,
          html_url: "https://github.com/NarukeAlpha/control/blob/main/src/main.ts",
          download_url: "https://raw.githubusercontent.com/NarukeAlpha/control/main/src/main.ts"
        };
      }
      if (route.includes("/contents")) {
        return [
          {
            name: "main.ts",
            path: "src/main.ts",
            type: "file",
            sha: "file-sha",
            size: 10,
            html_url: "https://github.com/NarukeAlpha/control/blob/main/src/main.ts",
            download_url: "https://raw.githubusercontent.com/NarukeAlpha/control/main/src/main.ts"
          }
        ];
      }
      throw new Error(`Unexpected route ${route}`);
    });
    const restTextMock = vi.fn(async (route: string) =>
      route.includes("/readme") ? "# Control" : "export const value = 1;"
    );
    const restPaginatedArrayMock = vi.fn(
      async (route: string, _params?: Record<string, unknown>, _limit?: number) => {
        if (route.includes("/branches")) {
          return [{ name: "main", commit: { sha: "branch-sha" }, protected: true }];
        }
        if (route.includes("/tags")) {
          return [{ name: "v1.0.0", commit: { sha: "tag-sha" }, zipball_url: null, tarball_url: null }];
        }
        if (route.includes("/forks")) {
          return [
            {
              id: 2,
              name: "control-fork",
              full_name: "Other/control-fork",
              html_url: "https://github.com/Other/control-fork",
              default_branch: "main",
              private: false,
              owner: { login: "Other" }
            }
          ];
        }
        if (route.includes("/commits")) {
          return [
            {
              sha: "commit-sha",
              commit: {
                message: "Update main\n\nBody",
                author: { name: "Ada", date: "2026-05-01T00:00:00Z" },
                committer: { name: "Ada", date: "2026-05-01T00:00:00Z" }
              },
              author: { login: "ada", avatar_url: "https://avatars.test/ada" },
              html_url: "https://github.com/NarukeAlpha/control/commit/commit-sha"
            }
          ];
        }
        throw new Error(`Unexpected route ${route}`);
      }
    );
    const client = createClient({
      rest: async <T>(route: string, params: Record<string, unknown>) => (await restMock(route, params)) as T,
      restText: restTextMock,
      restPaginatedArray: async <T>(route: string, params: Record<string, unknown>, limit: number) =>
        (await restPaginatedArrayMock(route, params, limit)) as T[]
    });
    const domain = new OctokitRepositoryDomain(client, mapTestError);
    const repo = { owner: "NarukeAlpha", repo: "control" };

    await expect(domain.listBranches(repo)).resolves.toEqual([
      { name: "main", commitSha: "branch-sha", protected: true }
    ]);
    await expect(domain.listTags(repo)).resolves.toEqual([
      { name: "v1.0.0", commitSha: "tag-sha", zipballUrl: null, tarballUrl: null }
    ]);
    await expect(domain.listTree({ ...repo, ref: "main" })).resolves.toEqual({
      ref: "main",
      truncated: false,
      entries: [
        expect.objectContaining({ path: "src", type: "dir" }),
        expect.objectContaining({ path: "src/main.ts", type: "file" })
      ]
    });
    await expect(domain.getReadme(repo)).resolves.toEqual({
      markdown: "# Control",
      availability: { status: "available", message: null }
    });
    await expect(domain.listContents(repo)).resolves.toEqual([
      expect.objectContaining({
        name: "main.ts",
        lastCommitSha: "commit-sha",
        lastCommitMessage: "Update main"
      })
    ]);
    await expect(domain.getFileContent({ ...repo, path: "src/main.ts", ref: "main" })).resolves.toEqual(
      expect.objectContaining({
        path: "src/main.ts",
        kind: "text",
        content: "export const value = 1;",
        size: 23,
        encoding: "utf-8",
        lastCommitSha: "commit-sha"
      })
    );
    await expect(domain.listRepositoryForks(repo)).resolves.toEqual({
      items: [expect.objectContaining({ owner: "Other", name: "control-fork" })],
      availability: { status: "available", message: null }
    });
  });

  it("classifies file content from metadata before fetching raw text", async () => {
    const rawText = vi.fn(async () => "raw should not be fetched");
    const domain = domainForFileContent({
      item: contentItem({ path: "dist/archive.zip", size: 1024, download_url: null }),
      restText: rawText
    });

    await expect(
      domain.getFileContent({ owner: "NarukeAlpha", repo: "control", path: "dist/archive.zip", ref: "main" })
    ).resolves.toEqual(
      expect.objectContaining({
        kind: "binary",
        content: null,
        encoding: null,
        downloadUrl: null,
        message: "Binary files are not previewed as text."
      })
    );
    expect(rawText).not.toHaveBeenCalled();
  });

  it("skips too-large files and previewable images without downloading raw content", async () => {
    const rawText = vi.fn(async () => "raw should not be fetched");
    const largeDomain = domainForFileContent({
      item: contentItem({ path: "src/huge.ts", size: maxPreviewBytes + 1 }),
      restText: rawText
    });
    await expect(
      largeDomain.getFileContent({ owner: "NarukeAlpha", repo: "control", path: "src/huge.ts", ref: "main" })
    ).resolves.toEqual(expect.objectContaining({ kind: "too_large", content: null, encoding: null }));

    const imageDomain = domainForFileContent({
      item: contentItem({
        path: "assets/logo.png",
        download_url: "https://raw.githubusercontent.com/NarukeAlpha/control/main/assets/logo.png"
      }),
      restText: rawText
    });
    await expect(
      imageDomain.getFileContent({
        owner: "NarukeAlpha",
        repo: "control",
        path: "assets/logo.png",
        ref: "main"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        kind: "image",
        content: null,
        downloadUrl: "https://raw.githubusercontent.com/NarukeAlpha/control/main/assets/logo.png"
      })
    );
    expect(rawText).not.toHaveBeenCalled();
  });

  it("preserves metadata for raw body failures and non-file content items", async () => {
    const unavailableDomain = domainForFileContent({
      item: contentItem({ path: "src/main.ts", size: 10 }),
      restText: async () => {
        throw new Error("raw failed");
      }
    });
    await expect(
      unavailableDomain.getFileContent({
        owner: "NarukeAlpha",
        repo: "control",
        path: "src/main.ts",
        ref: "main"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        kind: "unavailable",
        content: null,
        htmlUrl: "https://github.com/NarukeAlpha/control/blob/main/src/main.ts",
        size: 10,
        message: "raw failed"
      })
    );

    const directoryDomain = domainForFileContent({
      item: contentItem({ path: "src", type: "dir", size: undefined, download_url: null })
    });
    await expect(
      directoryDomain.getFileContent({ owner: "NarukeAlpha", repo: "control", path: "src", ref: "main" })
    ).resolves.toEqual(
      expect.objectContaining({
        kind: "unavailable",
        content: null,
        message: "dir entries are not regular files and cannot be previewed."
      })
    );
  });

  it("rejects null-byte raw content and can strictly decode base64 metadata fallback", async () => {
    const binaryDomain = domainForFileContent({
      item: contentItem({ path: "src/main.ts", size: 10 }),
      restText: async () => "a\u0000b"
    });
    await expect(
      binaryDomain.getFileContent({ owner: "NarukeAlpha", repo: "control", path: "src/main.ts", ref: "main" })
    ).resolves.toEqual(expect.objectContaining({ kind: "binary", content: null, encoding: null }));

    const fallbackDomain = domainForFileContent({
      item: contentItem({
        path: "src/fallback.ts",
        content: Buffer.from("export const ok = true;\n", "utf8").toString("base64"),
        encoding: "base64"
      }),
      restText: async () => {
        throw new Error("raw unavailable");
      }
    });
    await expect(
      fallbackDomain.getFileContent({
        owner: "NarukeAlpha",
        repo: "control",
        path: "src/fallback.ts",
        ref: "main"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        kind: "text",
        content: "export const ok = true;\n",
        encoding: "utf-8"
      })
    );
  });

  it("maps README 404s to an available empty README result", async () => {
    const client = createClient({
      restText: async () => {
        throw Object.assign(new Error("Not Found"), { status: 404 });
      }
    });
    const domain = new OctokitRepositoryDomain(client, mapTestError);

    await expect(domain.getReadme({ owner: "NarukeAlpha", repo: "control" })).resolves.toEqual({
      markdown: null,
      availability: {
        status: "available",
        message: "GitHub did not return a README for this repository."
      }
    });
  });

  it("maps repository summaries and languages without raw GraphQL shapes leaking to callers", () => {
    expect(mapRepositorySummary(repositoryNode("NarukeAlpha/control"))).toEqual(
      expect.objectContaining({
        owner: "NarukeAlpha",
        name: "control",
        watcherCount: 2,
        openIssuesCount: 3,
        defaultBranch: "main"
      })
    );

    expect(
      mapLanguages({
        totalSize: 100,
        edges: [
          { size: 75, node: { name: "TypeScript", color: "#3178c6" } },
          { size: 25, node: { name: "CSS", color: "#563d7c" } }
        ]
      })
    ).toEqual([
      { name: "TypeScript", color: "#3178c6", size: 75, percent: 75 },
      { name: "CSS", color: "#563d7c", size: 25, percent: 25 }
    ]);
  });
});

function createClient(overrides: Partial<OctokitRepositoryClient>): OctokitRepositoryClient {
  return {
    graphql: async () => {
      throw new Error("Unexpected GraphQL request");
    },
    rest: async () => {
      throw new Error("Unexpected REST request");
    },
    restText: async () => {
      throw new Error("Unexpected REST text request");
    },
    restPaginatedArray: async () => {
      throw new Error("Unexpected paginated REST request");
    },
    ...overrides
  };
}

function domainForFileContent({
  item,
  restText = async () => "export const value = 1;"
}: {
  item: Record<string, unknown>;
  restText?: OctokitRepositoryClient["restText"];
}): OctokitRepositoryDomain {
  const client = createClient({
    rest: async <T>(route: string) => {
      if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
        return item as T;
      }
      throw new Error(`Unexpected route ${route}`);
    },
    restText,
    restPaginatedArray: async <T>(route: string) => {
      if (route === "GET /repos/{owner}/{repo}/commits") {
        return [] as T[];
      }
      throw new Error(`Unexpected route ${route}`);
    }
  });
  return new OctokitRepositoryDomain(client, mapTestError);
}

function contentItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const path = String(overrides.path ?? "src/main.ts");
  const name = path.split("/").pop() ?? path;
  return {
    name,
    path,
    type: "file",
    sha: "file-sha",
    size: 20,
    html_url: `https://github.com/NarukeAlpha/control/blob/main/${path}`,
    download_url: `https://raw.githubusercontent.com/NarukeAlpha/control/main/${path}`,
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

function repositoryNode(nameWithOwner: string): GitHubRepositoryNode {
  const [owner, name] = nameWithOwner.split("/") as [string, string];
  return {
    id: `R_${owner}_${name}`,
    owner: { login: owner, avatarUrl: `https://avatars.githubusercontent.com/${owner}` },
    name,
    nameWithOwner,
    description: "Repository description",
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    stargazerCount: 11,
    forkCount: 7,
    updatedAt: "2026-05-01T00:00:00Z",
    pushedAt: "2026-05-02T00:00:00Z",
    defaultBranchRef: { name: "main" },
    watchers: { totalCount: 2 },
    issues: { totalCount: 3 },
    pullRequests: { totalCount: 4 },
    discussions: { totalCount: 5 },
    releases: { totalCount: 6 },
    primaryLanguage: { name: "TypeScript", color: "#3178c6" }
  };
}

function repositoryDetailNode(nameWithOwner: string): GitHubRepositoryNode & {
  url: string;
  homepageUrl: string | null;
  licenseInfo: { name: string; spdxId: string | null } | null;
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
  branches: { totalCount: number };
  tags: { totalCount: number };
  languages: { totalSize: number; edges: Array<{ size: number; node: { name: string; color: string } }> };
  parent: null;
  viewerHasStarred: boolean;
  viewerSubscription: "SUBSCRIBED";
  viewerPermission: string | null;
  isArchived: boolean;
  isDisabled: boolean;
} {
  return {
    ...repositoryNode(nameWithOwner),
    url: `https://github.com/${nameWithOwner}`,
    homepageUrl: "https://control.test",
    licenseInfo: { name: "MIT License", spdxId: "MIT" },
    repositoryTopics: { nodes: [{ topic: { name: "electron" } }] },
    branches: { totalCount: 9 },
    tags: { totalCount: 4 },
    languages: {
      totalSize: 80,
      edges: [{ size: 80, node: { name: "TypeScript", color: "#3178c6" } }]
    },
    parent: null,
    viewerHasStarred: true,
    viewerSubscription: "SUBSCRIBED",
    viewerPermission: "ADMIN",
    isArchived: false,
    isDisabled: false
  };
}
