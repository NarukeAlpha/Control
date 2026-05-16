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

  it("maps viewer organizations with repository and team counts", async () => {
    requestMock.mockResolvedValue({
      data: {
        role: "member",
        state: "active"
      }
    });
    graphqlMock.mockResolvedValue({
      viewer: {
        organizations: {
          nodes: [
            {
              id: "O_apple",
              login: "apple",
              name: "Apple",
              description: "Open source projects from Apple.",
              avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
              url: "https://github.com/apple",
              websiteUrl: "https://opensource.apple.com",
              location: "Cupertino, CA",
              repositories: { totalCount: 188 },
              teams: { totalCount: 14 },
              viewerIsAMember: true,
              viewerCanAdminister: false,
              viewerCanCreateRepositories: true,
              viewerCanCreateTeams: false
            }
          ]
        }
      }
    });

    const provider = new OctokitProvider("gho_test");
    const organizations = await provider.listOrganizations({ limit: 2 });

    expect(graphqlMock.mock.calls[0]?.[0]).toContain("viewerCanCreateTeams");
    expect(graphqlMock.mock.calls[0]?.[1]).toEqual({ limit: 2 });
    expect(organizations).toEqual([
      {
        id: "O_apple",
        login: "apple",
        name: "Apple",
        description: "Open source projects from Apple.",
        avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
        htmlUrl: "https://github.com/apple",
        websiteUrl: "https://opensource.apple.com",
        location: "Cupertino, CA",
        repositoryCount: 188,
        teamCount: 14,
        viewerIsMember: true,
        viewerCanAdminister: false,
        viewerCanCreateRepositories: true,
        viewerCanCreateTeams: false,
        viewerMembershipRole: "member",
        viewerMembershipState: "active",
        viewerMembershipAvailability: { status: "available", message: null }
      }
    ]);
  });

  it("maps organization teams visible to the token", async () => {
    requestMock.mockResolvedValue({
      data: [
        {
          id: 101,
          node_id: "T_compiler",
          name: "Compiler",
          slug: "compiler",
          description: "Maintains the Swift compiler.",
          privacy: "closed",
          permission: "push",
          notification_setting: "notifications_enabled",
          members_count: 18,
          repos_count: 12,
          html_url: "https://github.com/orgs/apple/teams/compiler",
          created_at: "2026-01-10T12:00:00.000Z",
          updated_at: "2026-05-03T12:00:00.000Z",
          organization: { login: "apple" },
          parent: {
            id: 100,
            node_id: "T_language",
            name: "Language",
            slug: "language",
            html_url: "https://github.com/orgs/apple/teams/language"
          }
        }
      ]
    });

    const provider = new OctokitProvider("gho_test");
    const teams = await provider.listOrganizationTeams({ org: "apple", limit: 20 });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /orgs/{org}/teams",
      expect.objectContaining({ org: "apple", per_page: 20 })
    );
    expect(teams).toEqual([
      {
        id: "T_compiler",
        databaseId: 101,
        organizationLogin: "apple",
        name: "Compiler",
        slug: "compiler",
        description: "Maintains the Swift compiler.",
        privacy: "closed",
        permission: "push",
        notificationSetting: "notifications_enabled",
        memberCount: 18,
        repositoryCount: 12,
        htmlUrl: "https://github.com/orgs/apple/teams/compiler",
        parent: {
          id: "T_language",
          name: "Language",
          slug: "language",
          htmlUrl: "https://github.com/orgs/apple/teams/language"
        },
        createdAt: "2026-01-10T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z"
      }
    ]);
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

  it("maps fork parent and source metadata without replacing the fork repository counts", async () => {
    graphqlMock.mockResolvedValue({
      repository: {
        ...makeRepositoryNode(),
        id: "R_fork",
        name: "swift-fork",
        nameWithOwner: "NarukeAlpha/swift-fork",
        description: "Fork of apple/swift",
        isFork: true,
        stargazerCount: 3,
        forkCount: 1,
        owner: { login: "NarukeAlpha", avatarUrl: "https://github.com/images/error/octocat_happy.gif" },
        url: "https://github.com/NarukeAlpha/swift-fork",
        homepageUrl: null,
        licenseInfo: null,
        repositoryTopics: { nodes: [] },
        branches: { totalCount: 3 },
        tags: { totalCount: 1 },
        languages: { totalSize: 0, edges: [] },
        parent: {
          id: "R_parent",
          name: "swift-parent",
          nameWithOwner: "mirror/swift-parent",
          url: "https://github.com/mirror/swift-parent",
          visibility: "PUBLIC",
          isPrivate: false,
          forkCount: 20,
          stargazerCount: 80,
          viewerPermission: "READ",
          defaultBranchRef: { name: "main" },
          owner: { login: "mirror" }
        },
        viewerHasStarred: false,
        viewerSubscription: "UNSUBSCRIBED",
        viewerPermission: "WRITE",
        isArchived: false,
        isDisabled: false
      }
    });
    requestMock.mockResolvedValue({
      data: {
        id: 500,
        node_id: "R_fork",
        name: "swift-fork",
        full_name: "NarukeAlpha/swift-fork",
        html_url: "https://github.com/NarukeAlpha/swift-fork",
        default_branch: "main",
        visibility: "public",
        private: false,
        forks_count: 1,
        stargazers_count: 3,
        owner: { login: "NarukeAlpha" },
        parent: {
          id: 501,
          node_id: "R_parent",
          name: "swift-parent",
          full_name: "mirror/swift-parent",
          html_url: "https://github.com/mirror/swift-parent",
          default_branch: "main",
          visibility: "public",
          private: false,
          forks_count: 20,
          stargazers_count: 80,
          owner: { login: "mirror" },
          permissions: { pull: true }
        },
        source: {
          id: 502,
          node_id: "R_source",
          name: "swift",
          full_name: "apple/swift",
          html_url: "https://github.com/apple/swift",
          default_branch: "main",
          visibility: "public",
          private: false,
          forks_count: 3500,
          stargazers_count: 23300,
          owner: { login: "apple" },
          permissions: { admin: true, pull: true }
        }
      }
    });

    const provider = new OctokitProvider("gho_test");
    const repository = await provider.getRepository("NarukeAlpha", "swift-fork");

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}",
      expect.objectContaining({ owner: "NarukeAlpha", repo: "swift-fork" })
    );
    expect(repository.forkCount).toBe(1);
    expect(repository.counts.forks).toBe(1);
    expect(repository.parent).toEqual(
      expect.objectContaining({
        nameWithOwner: "mirror/swift-parent",
        forkCount: 20,
        stargazerCount: 80,
        viewerPermission: "READ"
      })
    );
    expect(repository.source).toEqual(
      expect.objectContaining({
        nameWithOwner: "apple/swift",
        forkCount: 3500,
        stargazerCount: 23300,
        viewerPermission: "ADMIN"
      })
    );
  });

  it("maps repository administration metadata for settings", async () => {
    graphqlMock.mockResolvedValue({
      repository: {
        ...makeRepositoryNode(),
        url: "https://github.com/apple/swift",
        homepageUrl: "https://swift.org",
        licenseInfo: null,
        repositoryTopics: { nodes: [] },
        branches: { totalCount: 128 },
        tags: { totalCount: 32 },
        languages: { totalSize: 0, edges: [] },
        parent: null,
        viewerHasStarred: false,
        viewerSubscription: "UNSUBSCRIBED",
        viewerPermission: "ADMIN",
        isArchived: false,
        isDisabled: false
      }
    });
    requestMock.mockResolvedValue({
      data: {
        id: 1,
        node_id: "R_1",
        name: "swift",
        full_name: "apple/swift",
        html_url: "https://github.com/apple/swift",
        default_branch: "main",
        visibility: "public",
        private: false,
        archived: false,
        disabled: false,
        is_template: false,
        has_issues: true,
        has_projects: false,
        has_wiki: true,
        has_discussions: true,
        allow_merge_commit: true,
        allow_squash_merge: true,
        allow_rebase_merge: false,
        allow_auto_merge: true,
        delete_branch_on_merge: true,
        allow_update_branch: true,
        web_commit_signoff_required: false,
        forks_count: 3,
        stargazers_count: 10,
        owner: { login: "apple" },
        permissions: { admin: true, maintain: true, push: true, triage: true, pull: true }
      }
    });

    const provider = new OctokitProvider("gho_test");
    const repository = await provider.getRepository("apple", "swift");

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}",
      expect.objectContaining({ owner: "apple", repo: "swift" })
    );
    expect(repository.administration).toEqual(
      expect.objectContaining({
        visibility: "public",
        defaultBranch: "main",
        isArchived: false,
        isDisabled: false,
        isTemplate: false,
        webCommitSignoffRequired: false,
        features: {
          issues: true,
          projects: false,
          wiki: true,
          discussions: true
        },
        mergeSettings: expect.objectContaining({
          allowMergeCommit: true,
          allowSquashMerge: true,
          allowRebaseMerge: false,
          allowAutoMerge: true,
          deleteBranchOnMerge: true,
          allowUpdateBranch: true
        }),
        viewerPermissions: {
          admin: true,
          maintain: true,
          push: true,
          triage: true,
          pull: true
        }
      })
    );
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

  it("maps issue milestone metadata from REST issue payloads", async () => {
    requestMock.mockImplementation(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}/issues") {
        return {
          data: [
            {
              id: 1200,
              number: 1200,
              title: "Improve Sendable diagnostics",
              state: "open",
              user: { login: "slightbug", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" },
              comments: 4,
              labels: [],
              assignees: [
                {
                  id: 44,
                  node_id: "U_swift_ci",
                  login: "swift-ci",
                  avatar_url: "https://avatars.githubusercontent.com/u/44?v=4",
                  html_url: "https://github.com/swift-ci"
                }
              ],
              milestone: {
                id: 6,
                node_id: "M_swift_6",
                number: 6,
                title: "Swift 6 readiness",
                description: "Language mode readiness work",
                state: "open",
                due_on: "2026-09-01T00:00:00.000Z",
                created_at: "2026-01-10T00:00:00.000Z",
                updated_at: "2026-05-01T00:00:00.000Z",
                closed_at: null,
                html_url: "https://github.com/apple/swift/milestone/6",
                open_issues: 42,
                closed_issues: 18
              },
              created_at: "2026-05-01T00:00:00.000Z",
              updated_at: "2026-05-05T00:00:00.000Z",
              html_url: "https://github.com/apple/swift/issues/1200"
            }
          ]
        };
      }

      throw new Error(`Unexpected route ${route}`);
    });

    const provider = new OctokitProvider("gho_test");
    const issues = await provider.listIssues({ owner: "apple", repo: "swift", state: "open" });

    expect(issues[0]?.assignees).toEqual([
      {
        id: "U_swift_ci",
        login: "swift-ci",
        avatarUrl: "https://avatars.githubusercontent.com/u/44?v=4",
        htmlUrl: "https://github.com/swift-ci"
      }
    ]);
    expect(issues[0]?.milestone).toEqual({
      id: "M_swift_6",
      number: 6,
      title: "Swift 6 readiness",
      description: "Language mode readiness work",
      state: "open",
      dueOn: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-01-10T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      closedAt: null,
      htmlUrl: "https://github.com/apple/swift/milestone/6",
      openIssues: 42,
      closedIssues: 18
    });
  });

  it("pins the GitHub REST API version without replacing raw content accepts", async () => {
    requestMock.mockResolvedValue({ data: "# README" });

    const provider = new OctokitProvider("gho_test");
    const fileContent = await provider.getFileContent({
      owner: "NarukeAlpha",
      repo: "dots",
      path: "list.md",
      ref: "main"
    });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/contents/{path}",
      expect.objectContaining({
        headers: {
          accept: "application/vnd.github.raw",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(fileContent.downloadUrl).toBe("https://raw.githubusercontent.com/NarukeAlpha/dots/main/list.md");
  });

  it("maps last commit metadata onto repository contents", async () => {
    requestMock.mockImplementation(async (route: string, params: Record<string, unknown>) => {
      if (route === "GET /repos/{owner}/{repo}/contents") {
        return {
          data: [
            {
              name: "README.md",
              path: "README.md",
              type: "file",
              sha: "blob_sha",
              size: 1024,
              html_url: "https://github.com/apple/swift/blob/main/README.md",
              download_url: "https://raw.githubusercontent.com/apple/swift/main/README.md"
            }
          ]
        };
      }

      if (route === "GET /repos/{owner}/{repo}/commits" && params.path === "README.md") {
        return {
          data: [
            {
              sha: "abcdef123456",
              commit: {
                message: "Update installation instructions\n\nExplain toolchains.",
                author: { name: "Swift CI", date: "2026-05-04T10:00:00.000Z" },
                committer: { date: "2026-05-04T10:15:00.000Z" }
              },
              author: {
                login: "swift-ci",
                avatar_url: "https://github.com/swift-ci.png"
              },
              html_url: "https://github.com/apple/swift/commit/abcdef123456"
            }
          ]
        };
      }

      throw new Error(`Unexpected route ${route}`);
    });

    const provider = new OctokitProvider("gho_test");
    const contents = await provider.listContents({ owner: "apple", repo: "swift", ref: "main" });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/commits",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        path: "README.md",
        sha: "main",
        per_page: 1
      })
    );
    expect(contents[0]).toEqual(
      expect.objectContaining({
        name: "README.md",
        lastCommitSha: "abcdef123456",
        lastCommitMessage: "Update installation instructions",
        lastCommitAuthorLogin: "swift-ci",
        lastCommitAuthorName: "Swift CI",
        lastAuthoredDate: "2026-05-04T10:00:00.000Z",
        lastCommittedDate: "2026-05-04T10:15:00.000Z",
        lastCommitDate: "2026-05-04T10:15:00.000Z",
        lastCommitHtmlUrl: "https://github.com/apple/swift/commit/abcdef123456",
        lastCommitChanges: null
      })
    );
  });

  it("maps account notifications with subject links and unread state", async () => {
    requestMock.mockResolvedValue({
      data: [
        {
          id: "thread-1",
          unread: true,
          reason: "review_requested",
          updated_at: "2026-05-05T12:00:00.000Z",
          last_read_at: null,
          repository: {
            full_name: "apple/swift",
            html_url: "https://github.com/apple/swift",
            private: false
          },
          subject: {
            title: "Add Sendable support for @MainActor types",
            type: "PullRequest",
            url: "https://api.github.com/repos/apple/swift/pulls/520",
            latest_comment_url: "https://api.github.com/repos/apple/swift/issues/comments/2"
          }
        }
      ]
    });

    const provider = new OctokitProvider("gho_test");
    const notifications = await provider.listNotifications({ all: false, participating: true, limit: 10 });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /notifications",
      expect.objectContaining({ all: false, participating: true, per_page: 10 })
    );
    expect(notifications).toEqual([
      expect.objectContaining({
        id: "thread-1",
        unread: true,
        reason: "review_requested",
        updatedAt: "2026-05-05T12:00:00.000Z",
        lastReadAt: null,
        participating: true,
        repositoryNameWithOwner: "apple/swift",
        repositoryHtmlUrl: "https://github.com/apple/swift",
        repositoryPrivate: false,
        htmlUrl: "https://github.com/apple/swift/pull/520",
        subject: expect.objectContaining({
          title: "Add Sendable support for @MainActor types",
          type: "PullRequest",
          htmlUrl: "https://github.com/apple/swift/pull/520"
        })
      })
    ]);
  });

  it("marks a notification thread as read", async () => {
    requestMock.mockResolvedValue({ data: undefined });

    const provider = new OctokitProvider("gho_test");
    const result = await provider.markNotificationThreadRead({ threadId: "thread-1" });

    expect(requestMock).toHaveBeenCalledWith(
      "PATCH /notifications/threads/{thread_id}",
      expect.objectContaining({ thread_id: "thread-1" })
    );
    expect(result).toEqual({
      ok: true,
      threadId: "thread-1",
      message: "Notification thread marked as read."
    });
  });

  it("unsubscribes from a notification thread", async () => {
    requestMock.mockResolvedValue({ data: undefined });

    const provider = new OctokitProvider("gho_test");
    const result = await provider.unsubscribeNotificationThread({ threadId: "thread-1" });

    expect(requestMock).toHaveBeenCalledWith(
      "DELETE /notifications/threads/{thread_id}/subscription",
      expect.objectContaining({ thread_id: "thread-1" })
    );
    expect(result).toEqual({
      ok: true,
      threadId: "thread-1",
      message: "Notification thread unsubscribed."
    });
  });

  it("maps repository branches and tags for in-app ref selection", async () => {
    requestMock.mockImplementation(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}/branches") {
        return {
          data: [
            {
              name: "main",
              commit: { sha: "abcdefmain" },
              protected: true
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/tags") {
        return {
          data: [
            {
              name: "swift-6.0",
              commit: { sha: "abcdeftag" },
              zipball_url: "https://github.com/apple/swift/zipball/refs/tags/swift-6.0",
              tarball_url: "https://github.com/apple/swift/tarball/refs/tags/swift-6.0"
            }
          ]
        };
      }

      throw new Error(`Unexpected route ${route}`);
    });

    const provider = new OctokitProvider("gho_test");
    const branches = await provider.listBranches({ owner: "apple", repo: "swift", limit: 10 });
    const tags = await provider.listTags({ owner: "apple", repo: "swift", limit: 10 });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/branches",
      expect.objectContaining({ owner: "apple", repo: "swift", per_page: 10 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/tags",
      expect.objectContaining({ owner: "apple", repo: "swift", per_page: 10 })
    );
    expect(branches).toEqual([{ name: "main", commitSha: "abcdefmain", protected: true }]);
    expect(tags).toEqual([
      {
        name: "swift-6.0",
        commitSha: "abcdeftag",
        zipballUrl: "https://github.com/apple/swift/zipball/refs/tags/swift-6.0",
        tarballUrl: "https://github.com/apple/swift/tarball/refs/tags/swift-6.0"
      }
    ]);
  });

  it("maps repository labels and assignable users for issue metadata pickers", async () => {
    requestMock.mockImplementation(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}/labels") {
        return {
          data: [
            {
              id: 1,
              node_id: "L_bug",
              name: "bug",
              color: "d73a4a",
              description: "Something is not working"
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/assignees") {
        return {
          data: [
            {
              id: 2,
              node_id: "U_swift_ci",
              login: "swift-ci",
              avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
              html_url: "https://github.com/swift-ci"
            }
          ]
        };
      }

      throw new Error(`Unexpected route ${route}`);
    });

    const provider = new OctokitProvider("gho_test");
    const labels = await provider.listLabels({ owner: "apple", repo: "swift", limit: 50 });
    const users = await provider.listAssignableUsers({ owner: "apple", repo: "swift", limit: 50 });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/labels",
      expect.objectContaining({ owner: "apple", repo: "swift", per_page: 50 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/assignees",
      expect.objectContaining({ owner: "apple", repo: "swift", per_page: 50 })
    );
    expect(labels).toEqual([
      {
        id: "L_bug",
        name: "bug",
        color: "d73a4a",
        description: "Something is not working"
      }
    ]);
    expect(users).toEqual([
      {
        id: "U_swift_ci",
        login: "swift-ci",
        avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
        htmlUrl: "https://github.com/swift-ci"
      }
    ]);
  });

  it("maps recursive repository trees for in-app file finding", async () => {
    requestMock.mockResolvedValue({
      data: {
        sha: "tree_sha",
        truncated: false,
        tree: [
          {
            path: "README.md",
            type: "blob",
            sha: "readme_sha",
            size: 4096
          },
          {
            path: "documentation",
            type: "tree",
            sha: "docs_sha"
          },
          {
            path: "Vendor/Submodule",
            type: "commit",
            sha: "submodule_sha"
          }
        ]
      }
    });

    const provider = new OctokitProvider("gho_test");
    const tree = await provider.listTree({ owner: "apple", repo: "swift", ref: "release/6.0" });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        tree_sha: "release/6.0",
        recursive: "1"
      })
    );
    expect(tree).toEqual({
      ref: "release/6.0",
      truncated: false,
      entries: [
        expect.objectContaining({
          path: "documentation",
          type: "dir",
          sha: "docs_sha",
          size: null,
          htmlUrl: "https://github.com/apple/swift/tree/release%2F6.0/documentation"
        }),
        expect.objectContaining({
          path: "README.md",
          type: "file",
          sha: "readme_sha",
          size: 4096,
          htmlUrl: "https://github.com/apple/swift/blob/release%2F6.0/README.md"
        }),
        expect.objectContaining({
          path: "Vendor/Submodule",
          type: "submodule"
        })
      ]
    });
  });

  it("maps workflow definitions with workflow_dispatch inputs", async () => {
    requestMock.mockImplementation(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}/actions/workflows") {
        return {
          data: {
            workflows: [
              {
                id: 5100,
                node_id: "W_ci",
                name: "Swift CI",
                path: ".github/workflows/ci.yml",
                state: "active",
                html_url: "https://github.com/apple/swift/actions/workflows/ci.yml",
                badge_url: "https://github.com/apple/swift/actions/workflows/ci.yml/badge.svg",
                created_at: "2026-05-01T00:00:00.000Z",
                updated_at: "2026-05-05T00:00:00.000Z"
              }
            ]
          }
        };
      }

      if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
        return {
          data: [
            "name: Swift CI",
            "on:",
            "  workflow_dispatch:",
            "    inputs:",
            "      configuration:",
            "        description: Build configuration",
            "        required: true",
            "        type: choice",
            "        default: debug",
            "        options:",
            "          - debug",
            "          - release",
            "      run_tests:",
            "        description: Run the test suite",
            "        type: boolean",
            "        default: true"
          ].join("\n")
        };
      }

      throw new Error(`Unexpected route ${route}`);
    });

    const provider = new OctokitProvider("gho_test");
    const workflows = await provider.listWorkflows({ owner: "apple", repo: "swift", ref: "main" });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/actions/workflows",
      expect.objectContaining({ owner: "apple", repo: "swift", per_page: 50 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/contents/{path}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        path: ".github/workflows/ci.yml",
        ref: "main",
        headers: expect.objectContaining({ accept: "application/vnd.github.raw" })
      })
    );
    expect(workflows).toEqual([
      expect.objectContaining({
        id: 5100,
        name: "Swift CI",
        path: ".github/workflows/ci.yml",
        dispatchable: true,
        inputs: [
          {
            name: "configuration",
            description: "Build configuration",
            required: true,
            type: "choice",
            defaultValue: "debug",
            options: ["debug", "release"]
          },
          {
            name: "run_tests",
            description: "Run the test suite",
            required: false,
            type: "boolean",
            defaultValue: "true",
            options: []
          }
        ],
        inputsUnavailableMessage: null
      })
    ]);
  });

  it("maps workflow run jobs, steps, checks, annotations, and artifacts into run detail", async () => {
    requestMock.mockImplementation(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}") {
        return {
          data: {
            id: 9000,
            name: "Swift CI",
            event: "push",
            status: "completed",
            conclusion: "failure",
            head_branch: "main",
            head_sha: "abcdef123456",
            created_at: "2026-05-05T10:00:00.000Z",
            updated_at: "2026-05-05T10:30:00.000Z",
            html_url: "https://github.com/apple/swift/actions/runs/9000",
            logs_url: "https://api.github.com/repos/apple/swift/actions/runs/9000/logs"
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs") {
        return {
          data: {
            jobs: [
              {
                id: 7100,
                name: "macOS build",
                status: "completed",
                conclusion: "failure",
                started_at: "2026-05-05T10:01:00.000Z",
                completed_at: "2026-05-05T10:20:00.000Z",
                html_url: "https://github.com/apple/swift/actions/runs/9000/job/7100",
                runner_name: "macos-15",
                labels: ["macos", "x64"],
                steps: [
                  {
                    name: "Checkout",
                    status: "completed",
                    conclusion: "success",
                    number: 1,
                    started_at: "2026-05-05T10:01:00.000Z",
                    completed_at: "2026-05-05T10:02:00.000Z"
                  },
                  {
                    name: "Build compiler",
                    status: "completed",
                    conclusion: "failure",
                    number: 2,
                    started_at: "2026-05-05T10:02:00.000Z",
                    completed_at: "2026-05-05T10:20:00.000Z"
                  }
                ]
              }
            ]
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts") {
        return {
          data: {
            artifacts: [
              {
                id: 8100,
                name: "build-logs",
                size_in_bytes: 20480,
                expired: false,
                created_at: "2026-05-05T10:21:00.000Z",
                updated_at: "2026-05-05T10:21:00.000Z",
                expires_at: "2026-06-05T10:21:00.000Z",
                archive_download_url: "https://api.github.com/repos/apple/swift/actions/artifacts/8100/zip"
              }
            ]
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-suites") {
        return {
          data: {
            check_suites: [
              {
                id: 6100,
                status: "completed",
                conclusion: "failure",
                head_branch: "main",
                head_sha: "abcdef123456",
                before: "123456abcdef",
                after: "abcdef123456",
                app: {
                  name: "GitHub Actions",
                  slug: "github-actions",
                  html_url: "https://github.com/apps/github-actions"
                },
                latest_check_runs_count: 2,
                created_at: "2026-05-05T10:00:00.000Z",
                updated_at: "2026-05-05T10:30:00.000Z"
              }
            ]
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-runs") {
        return {
          data: {
            check_runs: [
              {
                id: 6200,
                name: "Swift build",
                status: "completed",
                conclusion: "failure",
                started_at: "2026-05-05T10:01:00.000Z",
                completed_at: "2026-05-05T10:20:00.000Z",
                html_url: "https://github.com/apple/swift/runs/6200",
                details_url: "https://github.com/apple/swift/actions/runs/9000/job/7100",
                check_suite: { id: 6100 },
                app: {
                  name: "GitHub Actions",
                  slug: "github-actions",
                  html_url: "https://github.com/apps/github-actions"
                },
                output: {
                  title: "Swift build failed",
                  summary: "Compiler tests failed on macOS.",
                  text: "See the failing build step for details.",
                  annotations_count: 1
                }
              }
            ]
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations") {
        return {
          data: [
            {
              path: "Sources/Compiler/main.swift",
              start_line: 42,
              end_line: 42,
              annotation_level: "failure",
              title: "Compiler test failed",
              message: "Expected diagnostics did not match.",
              raw_details: "Assertion failed in diagnostics test.",
              blob_href: "https://api.github.com/repos/apple/swift/git/blobs/blob-sha"
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs") {
        return {
          data: undefined,
          headers: {
            location: "https://pipelines.actions.githubusercontent.com/logs.zip"
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}") {
        return {
          data: undefined,
          headers: {
            location: "https://pipelines.actions.githubusercontent.com/artifacts/build-logs.zip"
          }
        };
      }

      throw new Error(`Unexpected route ${route}`);
    });

    const provider = new OctokitProvider("gho_test");
    const detail = await provider.getWorkflowRunDetail({ owner: "apple", repo: "swift", runId: 9000 });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
      expect.objectContaining({ owner: "apple", repo: "swift", run_id: 9000, per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
      expect.objectContaining({ owner: "apple", repo: "swift", run_id: 9000, per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/commits/{ref}/check-suites",
      expect.objectContaining({ owner: "apple", repo: "swift", ref: "abcdef123456", per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
      expect.objectContaining({ owner: "apple", repo: "swift", ref: "abcdef123456", per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations",
      expect.objectContaining({ owner: "apple", repo: "swift", check_run_id: 6200, per_page: 10 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        run_id: 9000,
        request: { redirect: "manual" }
      })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        artifact_id: 8100,
        archive_format: "zip",
        request: { redirect: "manual" }
      })
    );
    expect(detail).toEqual(
      expect.objectContaining({
        id: 9000,
        conclusion: "failure",
        jobs: [
          expect.objectContaining({
            id: 7100,
            name: "macOS build",
            conclusion: "failure",
            runnerName: "macos-15",
            labels: ["macos", "x64"],
            steps: [
              expect.objectContaining({ name: "Checkout", conclusion: "success" }),
              expect.objectContaining({ name: "Build compiler", conclusion: "failure" })
            ]
          })
        ],
        artifacts: [
          expect.objectContaining({
            id: 8100,
            name: "build-logs",
            archiveDownloadUrl: "https://pipelines.actions.githubusercontent.com/artifacts/build-logs.zip"
          })
        ],
        checkSuites: [
          expect.objectContaining({
            id: 6100,
            conclusion: "failure",
            appName: "GitHub Actions",
            latestCheckRunCount: 2
          })
        ],
        checkRuns: [
          expect.objectContaining({
            id: 6200,
            name: "Swift build",
            conclusion: "failure",
            outputTitle: "Swift build failed",
            outputSummary: "Compiler tests failed on macOS.",
            annotationsCount: 1,
            annotations: [
              expect.objectContaining({
                path: "Sources/Compiler/main.swift",
                startLine: 42,
                title: "Compiler test failed",
                message: "Expected diagnostics did not match."
              })
            ]
          })
        ],
        logs: expect.objectContaining({
          apiUrl: "https://api.github.com/repos/apple/swift/actions/runs/9000/logs",
          downloadUrl: "https://pipelines.actions.githubusercontent.com/logs.zip",
          available: true,
          message: null,
          availability: { status: "available", message: null }
        })
      })
    );
  });

  it("routes workflow rerun variants through the GitHub Actions API", async () => {
    requestMock.mockResolvedValue({ data: {} });

    const provider = new OctokitProvider("gho_test");
    await provider.mutate({
      action: "rerunWorkflow",
      owner: "apple",
      repo: "swift",
      payload: { runId: 9000 }
    });
    await provider.mutate({
      action: "rerunFailedWorkflowJobs",
      owner: "apple",
      repo: "swift",
      payload: { runId: 9000 }
    });
    await provider.mutate({
      action: "rerunWorkflowJob",
      owner: "apple",
      repo: "swift",
      payload: { jobId: 7100 }
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        run_id: 9000,
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        run_id: 9000,
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      "POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        job_id: 7100,
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
  });

  it("maps branch protection and disabled protection states", async () => {
    requestMock.mockResolvedValueOnce({
      data: {
        url: "https://api.github.com/repos/apple/swift/branches/main/protection",
        required_status_checks: {
          contexts: ["macOS build", "linux build"],
          enforcement_level: "non_admins"
        },
        enforce_admins: { enabled: true },
        required_pull_request_reviews: {
          dismiss_stale_reviews: true,
          require_code_owner_reviews: true,
          required_approving_review_count: 2,
          require_last_push_approval: false
        },
        restrictions: {
          users: [],
          teams: [{ slug: "compiler" }, { slug: "tooling" }],
          apps: [{ slug: "swift-ci" }]
        },
        required_linear_history: { enabled: true },
        allow_force_pushes: { enabled: false },
        allow_deletions: { enabled: false },
        required_conversation_resolution: { enabled: true },
        lock_branch: { enabled: false },
        allow_fork_syncing: { enabled: true }
      }
    });

    const provider = new OctokitProvider("gho_test");
    const protectedBranch = await provider.getBranchProtection({
      owner: "apple",
      repo: "swift",
      branch: "main"
    });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/branches/{branch}/protection",
      expect.objectContaining({ owner: "apple", repo: "swift", branch: "main" })
    );
    expect(protectedBranch).toEqual({
      availability: { status: "available", message: null },
      protection: expect.objectContaining({
        branch: "main",
        requiredStatusCheckContexts: ["macOS build", "linux build"],
        requiredStatusCheckEnforcementLevel: "non_admins",
        enforceAdmins: true,
        requiresPullRequestReviews: true,
        requiredApprovingReviewCount: 2,
        restrictsPushes: true,
        restrictionTeamCount: 2,
        restrictionAppCount: 1,
        requiredLinearHistory: true,
        allowForcePushes: false,
        allowDeletions: false,
        requiredConversationResolution: true,
        allowForkSyncing: true
      })
    });

    requestMock.mockRejectedValueOnce({ status: 404, message: "Branch not protected" });

    const unprotectedBranch = await provider.getBranchProtection({
      owner: "apple",
      repo: "swift",
      branch: "release/6.0"
    });

    expect(unprotectedBranch).toEqual({
      protection: null,
      availability: { status: "feature_disabled", message: "Branch not protected" }
    });
  });

  it("maps Dependabot alerts and permission states", async () => {
    requestMock.mockResolvedValueOnce({
      data: [
        {
          number: 12,
          state: "open",
          dependency: {
            package: { ecosystem: "swift", name: "swift-nio" },
            manifest_path: "Package.swift",
            scope: "runtime"
          },
          security_advisory: {
            summary: "Improper input validation in dependency metadata",
            severity: "high"
          },
          html_url: "https://github.com/apple/swift/security/dependabot/12",
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-05T00:00:00.000Z",
          dismissed_at: null,
          fixed_at: null
        }
      ]
    });

    const provider = new OctokitProvider("gho_test");
    const alerts = await provider.listDependabotAlerts({
      owner: "apple",
      repo: "swift",
      state: "open",
      limit: 20
    });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/dependabot/alerts",
      expect.objectContaining({ owner: "apple", repo: "swift", state: "open", per_page: 20 })
    );
    expect(alerts).toEqual({
      availability: { status: "available", message: null },
      items: [
        {
          number: 12,
          state: "open",
          severity: "high",
          packageName: "swift-nio",
          ecosystem: "swift",
          manifestPath: "Package.swift",
          scope: "runtime",
          summary: "Improper input validation in dependency metadata",
          htmlUrl: "https://github.com/apple/swift/security/dependabot/12",
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
          dismissedAt: null,
          fixedAt: null
        }
      ]
    });

    requestMock.mockRejectedValueOnce({ status: 403, message: "Resource not accessible by integration" });

    const denied = await provider.listDependabotAlerts({ owner: "apple", repo: "swift" });

    expect(denied).toEqual({
      items: [],
      availability: {
        status: "permission_denied",
        message: "Resource not accessible by integration"
      }
    });
  });

  it("maps code scanning alerts and feature-disabled states", async () => {
    requestMock.mockResolvedValueOnce({
      data: [
        {
          number: 4,
          state: "open",
          rule: {
            id: "swift/path-injection",
            name: "swift/path-injection",
            severity: "error",
            description: "Path construction includes user-controlled input"
          },
          tool: { name: "CodeQL" },
          most_recent_instance: {
            ref: "refs/heads/main",
            message: { text: "This path depends on a user-provided value." },
            location: {
              path: "Sources/PackageLoading/ManifestLoader.swift",
              start_line: 117,
              end_line: 117
            }
          },
          html_url: "https://github.com/apple/swift/security/code-scanning/4",
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-05T00:00:00.000Z",
          dismissed_at: null,
          fixed_at: null
        }
      ]
    });

    const provider = new OctokitProvider("gho_test");
    const alerts = await provider.listCodeScanningAlerts({
      owner: "apple",
      repo: "swift",
      state: "open",
      limit: 20
    });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/code-scanning/alerts",
      expect.objectContaining({ owner: "apple", repo: "swift", state: "open", per_page: 20 })
    );
    expect(alerts).toEqual({
      availability: { status: "available", message: null },
      items: [
        {
          number: 4,
          state: "open",
          severity: "error",
          ruleId: "swift/path-injection",
          ruleName: "swift/path-injection",
          ruleDescription: "Path construction includes user-controlled input",
          toolName: "CodeQL",
          message: "This path depends on a user-provided value.",
          ref: "refs/heads/main",
          path: "Sources/PackageLoading/ManifestLoader.swift",
          startLine: 117,
          endLine: 117,
          htmlUrl: "https://github.com/apple/swift/security/code-scanning/4",
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
          dismissedAt: null,
          fixedAt: null
        }
      ]
    });

    requestMock.mockRejectedValueOnce({ status: 404, message: "Code scanning is not enabled" });

    const disabled = await provider.listCodeScanningAlerts({ owner: "apple", repo: "swift" });

    expect(disabled).toEqual({
      items: [],
      availability: {
        status: "feature_disabled",
        message: "Code scanning is not enabled"
      }
    });
  });

  it("maps secret scanning alerts without exposing secret values", async () => {
    requestMock.mockResolvedValueOnce({
      data: [
        {
          number: 42,
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-05T00:00:00.000Z",
          html_url: "https://github.com/apple/swift/security/secret-scanning/42",
          state: "open",
          resolution: null,
          resolved_at: null,
          secret_type: "mailchimp_api_key",
          secret_type_display_name: "Mailchimp API Key",
          secret: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX-us2",
          validity: "unknown",
          publicly_leaked: false,
          multi_repo: false,
          push_protection_bypassed: false,
          push_protection_bypassed_at: null,
          first_location_detected: {
            path: "Config/secrets.example",
            start_line: 12,
            end_line: 12
          }
        }
      ]
    });

    const provider = new OctokitProvider("gho_test");
    const alerts = await provider.listSecretScanningAlerts({
      owner: "apple",
      repo: "swift",
      state: "open",
      limit: 20
    });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/secret-scanning/alerts",
      expect.objectContaining({ owner: "apple", repo: "swift", state: "open", per_page: 20 })
    );
    expect(alerts).toEqual({
      availability: { status: "available", message: null },
      items: [
        {
          number: 42,
          state: "open",
          secretType: "mailchimp_api_key",
          secretTypeDisplayName: "Mailchimp API Key",
          resolution: null,
          validity: "unknown",
          publiclyLeaked: false,
          multiRepo: false,
          pushProtectionBypassed: false,
          pushProtectionBypassedAt: null,
          firstLocationPath: "Config/secrets.example",
          firstLocationStartLine: 12,
          firstLocationEndLine: 12,
          htmlUrl: "https://github.com/apple/swift/security/secret-scanning/42",
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-05T00:00:00.000Z",
          resolvedAt: null
        }
      ]
    });
    expect(JSON.stringify(alerts)).not.toContain("XXXXXXXXXXXXXXXX");

    requestMock.mockRejectedValueOnce({ status: 403, message: "Resource not accessible by integration" });

    const denied = await provider.listSecretScanningAlerts({ owner: "apple", repo: "swift" });

    expect(denied).toEqual({
      items: [],
      availability: {
        status: "permission_denied",
        message: "Resource not accessible by integration"
      }
    });
  });

  it("maps pull request files and commits into rich PR detail", async () => {
    requestMock.mockImplementation(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}") {
        return {
          data: {
            id: 17,
            number: 17,
            title: "Improve management controls",
            state: "open",
            draft: false,
            user: {
              login: "octocat",
              avatar_url: "https://github.com/octocat.png",
              html_url: "https://github.com/octocat"
            },
            body: "Pull request body",
            comments: 1,
            review_comments: 2,
            additions: 20,
            deletions: 5,
            changed_files: 1,
            mergeable_state: "clean",
            head: { ref: "feature/pr-detail", sha: "abcdef123456" },
            base: { ref: "main" },
            requested_reviewers: [
              {
                id: 44,
                node_id: "U_swift_ci",
                login: "swift-ci",
                avatar_url: "https://avatars.githubusercontent.com/u/44?v=4",
                html_url: "https://github.com/swift-ci"
              }
            ],
            requested_teams: [
              {
                id: 101,
                node_id: "T_compiler",
                name: "Compiler",
                slug: "compiler",
                html_url: "https://github.com/orgs/apple/teams/compiler"
              }
            ],
            created_at: "2026-05-05T10:00:00.000Z",
            updated_at: "2026-05-05T11:00:00.000Z",
            html_url: "https://github.com/apple/swift/pull/17"
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}") {
        return {
          data: {
            labels: [],
            assignees: [],
            milestone: null
          }
        };
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
        return { data: [] };
      }
      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/files") {
        return {
          data: [
            {
              filename: "src/renderer/src/App.tsx",
              status: "modified",
              additions: 12,
              deletions: 3,
              changes: 15,
              patch: "@@ -1,3 +1,3 @@",
              blob_url: "https://github.com/apple/swift/blob/main/src/renderer/src/App.tsx",
              raw_url: "https://raw.githubusercontent.com/apple/swift/main/src/renderer/src/App.tsx"
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits") {
        return {
          data: [
            {
              sha: "abcdef123456",
              commit: {
                message: "Add PR inspection\n\nMore detail",
                author: { date: "2026-05-05T10:30:00.000Z" },
                committer: { date: "2026-05-05T10:45:00.000Z" }
              },
              author: {
                login: "octocat",
                avatar_url: "https://github.com/octocat.png",
                html_url: "https://github.com/octocat"
              },
              html_url: "https://github.com/apple/swift/commit/abcdef123456"
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews") {
        return {
          data: [
            {
              id: 701,
              state: "APPROVED",
              body: "Looks good.",
              submitted_at: "2026-05-05T11:05:00.000Z",
              commit_id: "abcdef123456",
              html_url: "https://github.com/apple/swift/pull/17#pullrequestreview-701",
              user: {
                login: "reviewer",
                avatar_url: "https://github.com/reviewer.png",
                html_url: "https://github.com/reviewer"
              }
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments") {
        return {
          data: [
            {
              id: 901,
              pull_request_review_id: 701,
              path: "src/renderer/src/App.tsx",
              diff_hunk: "@@ -1,3 +1,3 @@",
              position: 4,
              original_position: 4,
              start_line: null,
              line: 44,
              side: "RIGHT",
              body: "Can this be a typed helper?",
              created_at: "2026-05-05T11:06:00.000Z",
              updated_at: "2026-05-05T11:06:00.000Z",
              html_url: "https://github.com/apple/swift/pull/17#discussion_r901",
              user: {
                login: "reviewer",
                avatar_url: "https://github.com/reviewer.png",
                html_url: "https://github.com/reviewer"
              }
            },
            {
              id: 902,
              pull_request_review_id: 701,
              in_reply_to_id: 901,
              path: "src/renderer/src/App.tsx",
              diff_hunk: "@@ -1,3 +1,3 @@",
              position: null,
              original_position: 4,
              start_line: null,
              line: 44,
              side: "RIGHT",
              body: "Done in the follow-up commit.",
              created_at: "2026-05-05T11:08:00.000Z",
              updated_at: "2026-05-05T11:08:00.000Z",
              html_url: "https://github.com/apple/swift/pull/17#discussion_r902",
              user: {
                login: "octocat",
                avatar_url: "https://github.com/octocat.png",
                html_url: "https://github.com/octocat"
              }
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline") {
        return {
          data: [
            {
              id: 1101,
              event: "connected",
              actor: {
                login: "reviewer",
                avatar_url: "https://github.com/reviewer.png",
                html_url: "https://github.com/reviewer"
              },
              created_at: "2026-05-05T11:10:00.000Z",
              source: {
                issue: {
                  number: 1200,
                  title: "Crash on build",
                  html_url: "https://github.com/apple/swift/issues/1200",
                  repository_url: "https://api.github.com/repos/apple/swift"
                }
              }
            },
            {
              id: 1102,
              event: "renamed",
              actor: {
                login: "octocat",
                avatar_url: "https://github.com/octocat.png",
                html_url: "https://github.com/octocat"
              },
              created_at: "2026-05-05T11:12:00.000Z",
              rename: {
                from: "Improve controls",
                to: "Improve management controls"
              }
            }
          ]
        };
      }
      if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-runs") {
        return {
          data: {
            check_runs: [
              {
                id: 801,
                name: "macOS build",
                status: "completed",
                conclusion: "success",
                started_at: "2026-05-05T10:45:00.000Z",
                completed_at: "2026-05-05T11:00:00.000Z",
                html_url: "https://github.com/apple/swift/runs/801",
                details_url: "https://github.com/apple/swift/actions/runs/9000/job/801",
                app: { name: "GitHub Actions", slug: "github-actions" },
                output: {
                  title: "macOS build passed",
                  summary: "All tests passed."
                }
              }
            ]
          }
        };
      }
      throw new Error(`Unexpected route ${route}`);
    });

    const provider = new OctokitProvider("gho_test");
    const detail = await provider.getPullRequestDetail({ owner: "apple", repo: "swift", pullNumber: 17 });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      expect.objectContaining({ owner: "apple", repo: "swift", pull_number: 17, per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
      expect.objectContaining({ owner: "apple", repo: "swift", pull_number: 17, per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      expect.objectContaining({ owner: "apple", repo: "swift", pull_number: 17, per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
      expect.objectContaining({ owner: "apple", repo: "swift", pull_number: 17, per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
      expect.objectContaining({ owner: "apple", repo: "swift", issue_number: 17, per_page: 100 })
    );
    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
      expect.objectContaining({ owner: "apple", repo: "swift", ref: "abcdef123456", per_page: 100 })
    );
    expect(detail.files).toEqual([
      expect.objectContaining({
        filename: "src/renderer/src/App.tsx",
        additions: 12,
        deletions: 3
      })
    ]);
    expect(detail.commitsList).toEqual([
      expect.objectContaining({
        sha: "abcdef123456",
        message: "Add PR inspection",
        authorLogin: "octocat",
        committedAt: "2026-05-05T10:45:00.000Z"
      })
    ]);
    expect(detail.requestedReviewers).toEqual([
      {
        id: "U_swift_ci",
        login: "swift-ci",
        avatarUrl: "https://avatars.githubusercontent.com/u/44?v=4",
        htmlUrl: "https://github.com/swift-ci"
      }
    ]);
    expect(detail.requestedTeams).toEqual([
      {
        id: "T_compiler",
        name: "Compiler",
        slug: "compiler",
        htmlUrl: "https://github.com/orgs/apple/teams/compiler"
      }
    ]);
    expect(detail.latestReviewState).toBe("APPROVED");
    expect(detail.reviews).toEqual([
      expect.objectContaining({
        id: 701,
        state: "APPROVED",
        authorLogin: "reviewer",
        body: "Looks good."
      })
    ]);
    expect(detail.checksAvailability).toEqual({ status: "available", message: null });
    expect(detail.checks).toEqual([
      expect.objectContaining({
        id: 801,
        name: "macOS build",
        conclusion: "success",
        appName: "GitHub Actions",
        outputSummary: "All tests passed."
      })
    ]);
    expect(detail.reviewThreads).toEqual([
      expect.objectContaining({
        id: 901,
        path: "src/renderer/src/App.tsx",
        isResolved: null,
        comments: [
          expect.objectContaining({
            id: 901,
            authorLogin: "reviewer",
            body: "Can this be a typed helper?",
            line: 44
          }),
          expect.objectContaining({
            id: 902,
            authorLogin: "octocat",
            body: "Done in the follow-up commit.",
            inReplyToId: 901
          })
        ]
      })
    ]);
    expect(detail.timelineAvailability).toEqual({ status: "available", message: null });
    expect(detail.timelineEvents).toEqual([
      expect.objectContaining({
        id: 1101,
        event: "connected",
        actorLogin: "reviewer",
        sourceIssue: {
          number: 1200,
          title: "Crash on build",
          htmlUrl: "https://github.com/apple/swift/issues/1200",
          repositoryNameWithOwner: "apple/swift"
        }
      }),
      expect.objectContaining({
        id: 1102,
        event: "renamed",
        renameFrom: "Improve controls",
        renameTo: "Improve management controls"
      })
    ]);
  });

  it("returns discussion availability separately from an empty list", async () => {
    graphqlMock.mockResolvedValue({
      repository: {
        discussions: {
          nodes: [
            {
              id: "D_1",
              number: 42,
              title: "Release planning",
              url: "https://github.com/apple/swift/discussions/42",
              updatedAt: "2026-05-05T12:00:00.000Z",
              author: { login: "swiftlang" },
              category: { name: "Announcements" },
              comments: { totalCount: 7 }
            }
          ]
        }
      }
    });

    const provider = new OctokitProvider("gho_test");
    const result = await provider.listDiscussionsWithStatus({ owner: "apple", repo: "swift", limit: 10 });

    expect(result.availability).toEqual({ status: "available", message: null });
    expect(result.items).toEqual([
      expect.objectContaining({
        number: 42,
        title: "Release planning",
        comments: 7
      })
    ]);
  });

  it("maps discussion permission errors without returning a false empty list", async () => {
    graphqlMock.mockRejectedValue(
      Object.assign(new Error("Resource not accessible by integration"), { status: 403 })
    );

    const provider = new OctokitProvider("gho_test");
    const result = await provider.listDiscussionsWithStatus({ owner: "apple", repo: "swift" });

    expect(result.items).toEqual([]);
    expect(result.availability).toEqual({
      status: "permission_denied",
      message: "Resource not accessible by integration"
    });
  });

  it("maps discussion rate limits without returning a false empty list", async () => {
    graphqlMock.mockRejectedValue(Object.assign(new Error("API rate limit exceeded"), { status: 429 }));

    const provider = new OctokitProvider("gho_test");
    const result = await provider.listDiscussionsWithStatus({ owner: "apple", repo: "swift" });

    expect(result.items).toEqual([]);
    expect(result.availability).toEqual({
      status: "rate_limited",
      message: "API rate limit exceeded"
    });
  });

  it("maps project feature-disabled errors without returning a false empty list", async () => {
    graphqlMock.mockRejectedValue(new Error("Projects are disabled for this repository"));

    const provider = new OctokitProvider("gho_test");
    const result = await provider.listProjectsWithStatus({ owner: "apple", repo: "swift" });

    expect(result.items).toEqual([]);
    expect(result.availability).toEqual({
      status: "feature_disabled",
      message: "Projects are disabled for this repository"
    });
  });

  it("maps project GraphQL errors without returning a false empty list", async () => {
    graphqlMock.mockRejectedValue(
      Object.assign(new Error("GraphQL failed while loading repository projects"), {
        errors: [{ type: "NOT_FOUND" }]
      })
    );

    const provider = new OctokitProvider("gho_test");
    const result = await provider.listProjectsWithStatus({ owner: "apple", repo: "swift" });

    expect(result.items).toEqual([]);
    expect(result.availability).toEqual({
      status: "graphql_error",
      message: "GraphQL failed while loading repository projects"
    });
  });

  it("routes issue edits through the GitHub issues API", async () => {
    requestMock.mockResolvedValue({ data: {} });

    const provider = new OctokitProvider("gho_test");
    const result = await provider.mutate({
      action: "editIssue",
      owner: "apple",
      repo: "swift",
      payload: {
        issueNumber: 123,
        title: "Updated issue title",
        body: "Updated issue body"
      }
    });

    expect(requestMock).toHaveBeenCalledWith(
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        issue_number: 123,
        title: "Updated issue title",
        body: "Updated issue body",
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(result).toEqual({
      ok: true,
      action: "editIssue",
      message: "editIssue completed.",
      data: {}
    });
  });

  it("routes issue comment edits and deletes through the GitHub comments API", async () => {
    requestMock.mockResolvedValue({ data: {} });

    const provider = new OctokitProvider("gho_test");
    await provider.mutate({
      action: "editComment",
      owner: "apple",
      repo: "swift",
      payload: {
        commentId: 44001,
        body: "Updated comment body"
      }
    });
    await provider.mutate({
      action: "deleteComment",
      owner: "apple",
      repo: "swift",
      payload: {
        commentId: 44001
      }
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        comment_id: 44001,
        body: "Updated comment body",
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        comment_id: 44001,
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
  });

  it("routes issue labels and assignees through the GitHub issues API", async () => {
    requestMock.mockResolvedValue({ data: {} });

    const provider = new OctokitProvider("gho_test");
    await provider.mutate({
      action: "addLabels",
      owner: "apple",
      repo: "swift",
      payload: {
        issueNumber: 123,
        labels: ["triage", "regression"]
      }
    });
    await provider.mutate({
      action: "setAssignees",
      owner: "apple",
      repo: "swift",
      payload: {
        issueNumber: 123,
        assignees: ["octocat", "swift-ci"]
      }
    });
    await provider.mutate({
      action: "removeLabel",
      owner: "apple",
      repo: "swift",
      payload: {
        issueNumber: 123,
        name: "regression"
      }
    });
    await provider.mutate({
      action: "removeAssignees",
      owner: "apple",
      repo: "swift",
      payload: {
        issueNumber: 123,
        assignees: ["swift-ci"]
      }
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        issue_number: 123,
        labels: ["triage", "regression"],
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        issue_number: 123,
        assignees: ["octocat", "swift-ci"],
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        issue_number: 123,
        name: "regression",
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      4,
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        issue_number: 123,
        assignees: ["swift-ci"],
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
  });

  it("routes pull request reviewer requests through the GitHub review requests API", async () => {
    requestMock.mockResolvedValue({ data: {} });

    const provider = new OctokitProvider("gho_test");
    await provider.mutate({
      action: "requestReviewers",
      owner: "apple",
      repo: "swift",
      payload: {
        pullNumber: 17,
        reviewers: ["octocat"],
        teamReviewers: ["compiler"]
      }
    });
    await provider.mutate({
      action: "removeReviewers",
      owner: "apple",
      repo: "swift",
      payload: {
        pullNumber: 17,
        reviewers: ["octocat"],
        teamReviewers: ["compiler"]
      }
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        pull_number: 17,
        reviewers: ["octocat"],
        team_reviewers: ["compiler"],
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        pull_number: 17,
        reviewers: ["octocat"],
        team_reviewers: ["compiler"],
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
  });

  it("maps release notes and assets from repository releases", async () => {
    requestMock.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Swift 5.10.0",
          tag_name: "swift-5.10.0",
          body: "Release notes from GitHub.",
          draft: false,
          prerelease: false,
          published_at: "2026-05-01T00:00:00.000Z",
          html_url: "https://github.com/apple/swift/releases/tag/swift-5.10.0",
          assets: [
            {
              id: 101,
              name: "swift-5.10.0-macos.pkg",
              label: "macOS installer",
              state: "uploaded",
              content_type: "application/octet-stream",
              size: 241172480,
              download_count: 1842,
              browser_download_url: "https://github.com/apple/swift/releases/download/swift-5.10.0/swift.pkg",
              created_at: "2026-05-01T00:00:00.000Z",
              updated_at: "2026-05-01T00:00:00.000Z"
            }
          ]
        }
      ]
    });

    const provider = new OctokitProvider("gho_test");
    const releases = await provider.listReleases({ owner: "apple", repo: "swift", limit: 10 });

    expect(requestMock).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/releases",
      expect.objectContaining({ owner: "apple", repo: "swift", per_page: 10 })
    );
    expect(releases).toEqual([
      {
        id: 1,
        name: "Swift 5.10.0",
        tagName: "swift-5.10.0",
        body: "Release notes from GitHub.",
        isDraft: false,
        isPrerelease: false,
        targetCommitish: null,
        publishedAt: "2026-05-01T00:00:00.000Z",
        htmlUrl: "https://github.com/apple/swift/releases/tag/swift-5.10.0",
        assets: [
          {
            id: 101,
            name: "swift-5.10.0-macos.pkg",
            label: "macOS installer",
            state: "uploaded",
            contentType: "application/octet-stream",
            sizeInBytes: 241172480,
            downloadCount: 1842,
            browserDownloadUrl: "https://github.com/apple/swift/releases/download/swift-5.10.0/swift.pkg",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z"
          }
        ]
      }
    ]);
  });

  it("routes release create and delete mutations through the GitHub releases API", async () => {
    requestMock.mockResolvedValue({ data: {} });

    const provider = new OctokitProvider("gho_test");
    await provider.mutate({
      action: "createRelease",
      owner: "apple",
      repo: "swift",
      payload: {
        tag_name: "swift-5.11.0",
        target_commitish: "main",
        name: "Swift 5.11.0",
        body: "Release notes from Control",
        draft: false,
        prerelease: true
      }
    });
    await provider.mutate({
      action: "deleteRelease",
      owner: "apple",
      repo: "swift",
      payload: {
        releaseId: 87
      }
    });
    await provider.mutate({
      action: "editRelease",
      owner: "apple",
      repo: "swift",
      payload: {
        releaseId: 87,
        tag_name: "swift-5.11.1",
        target_commitish: "main",
        name: "Swift 5.11.1",
        body: "Edited release notes from Control",
        draft: true,
        prerelease: false
      }
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "POST /repos/{owner}/{repo}/releases",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        tag_name: "swift-5.11.0",
        target_commitish: "main",
        name: "Swift 5.11.0",
        body: "Release notes from Control",
        draft: false,
        prerelease: true,
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "DELETE /repos/{owner}/{repo}/releases/{release_id}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        release_id: 87,
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      "PATCH /repos/{owner}/{repo}/releases/{release_id}",
      expect.objectContaining({
        owner: "apple",
        repo: "swift",
        release_id: 87,
        tag_name: "swift-5.11.1",
        target_commitish: "main",
        name: "Swift 5.11.1",
        body: "Edited release notes from Control",
        draft: true,
        prerelease: false,
        headers: {
          accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
    );
  });
});
