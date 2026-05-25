import { describe, expect, it, vi } from "vitest";

import type { GitHubMutationInput } from "@shared/github";
import { githubIpcRouteChannels } from "@shared/ipc";
import {
  createGithubIpcRoutes,
  registeredGithubIpcRouteKeys,
  registerGithubIpc,
  requireGitHubMutationInput,
  requireRepoListInput
} from "./registerGithubIpc";

function makeGithubIpcDependencies(overrides: Record<string, unknown> = {}) {
  return {
    listRepositoriesWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listOrganizationsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listOrganizationTeamsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listOrganizationRepositoriesWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listOrganizationTeamRepositoriesWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listOrganizationTeamMembersWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listOrganizationMembersWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listOrganizationProjectsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listBranchesWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listTagsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listReleasesWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    listContributorsWithStatus: vi.fn(async () => ({
      items: [],
      availability: { status: "available", message: null } as const
    })),
    mutate: vi.fn(async (input: GitHubMutationInput) => ({
      ok: true,
      action: input.action,
      message: "ok"
    })),
    ...overrides
  };
}

describe("registerGithubIpc", () => {
  it("registers the first GitHub router slice on the typed route channels", async () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      })
    };
    const github = makeGithubIpcDependencies();

    registerGithubIpc(ipcMain, github);

    expect([...handlers.keys()]).toEqual(
      registeredGithubIpcRouteKeys.map((key) => githubIpcRouteChannels[key])
    );
    await handlers.get(githubIpcRouteChannels.listRepositoriesWithStatus)?.(null, { limit: 10 });
    await handlers.get(githubIpcRouteChannels.listOrganizationTeamRepositoriesWithStatus)?.(null, {
      org: " openai ",
      teamSlug: " core ",
      limit: 25,
      cacheOnly: true
    });
    await handlers.get(githubIpcRouteChannels.listBranchesWithStatus)?.(null, {
      owner: " openai ",
      repo: " codex ",
      limit: 12,
      forceRefresh: true
    });
    await handlers.get(githubIpcRouteChannels.mutate)?.(null, {
      action: "star",
      owner: "NarukeAlpha",
      repo: "t3code"
    });

    expect(github.listRepositoriesWithStatus).toHaveBeenCalledWith({
      limit: 10,
      cacheOnly: undefined,
      forceRefresh: undefined
    });
    expect(github.listOrganizationTeamRepositoriesWithStatus).toHaveBeenCalledWith({
      org: "openai",
      teamSlug: "core",
      limit: 25,
      cacheOnly: true,
      forceRefresh: undefined
    });
    expect(github.listBranchesWithStatus).toHaveBeenCalledWith({
      owner: "openai",
      repo: "codex",
      limit: 12,
      cacheOnly: undefined,
      forceRefresh: true
    });
    expect(github.mutate).toHaveBeenCalledWith({
      action: "star",
      owner: "NarukeAlpha",
      repo: "t3code"
    });
  });

  it("keeps registered route keys in parity with the shared route map", () => {
    const routes = createGithubIpcRoutes(makeGithubIpcDependencies());

    expect(registeredGithubIpcRouteKeys.map((key) => githubIpcRouteChannels[key])).toEqual(
      routes.map((route) => route.channel)
    );
  });

  it("validates repository list inputs before calling the provider", () => {
    expect(requireRepoListInput(undefined)).toEqual({});
    expect(requireRepoListInput({ limit: 25, cacheOnly: true, forceRefresh: false })).toEqual({
      limit: 25,
      cacheOnly: true,
      forceRefresh: false
    });
    expect(() => requireRepoListInput(null)).toThrow("Repository list input must be an object.");
    expect(() => requireRepoListInput([])).toThrow("Repository list input must be an object.");
    expect(() => requireRepoListInput({ limit: "25" })).toThrow(
      "Repository list limit must be a positive integer."
    );
    expect(() => requireRepoListInput({ cacheOnly: "true" })).toThrow(
      "Repository list cacheOnly must be a boolean."
    );
  });

  it("validates mutation inputs before calling the provider", () => {
    expect(
      requireGitHubMutationInput({
        action: "createIssue",
        owner: " owner ",
        repo: " repo ",
        title: "Flat issue",
        labels: ["bug"]
      })
    ).toEqual({
      action: "createIssue",
      owner: "owner",
      repo: "repo",
      title: "Flat issue",
      labels: ["bug"]
    });
    expect(
      requireGitHubMutationInput({
        action: "createIssue",
        owner: " owner ",
        repo: " repo ",
        title: " Flat issue ",
        body: "",
        labels: [" bug "]
      })
    ).toEqual({
      action: "createIssue",
      owner: "owner",
      repo: "repo",
      title: "Flat issue",
      body: "",
      labels: ["bug"]
    });
    expect(() => requireGitHubMutationInput(null)).toThrow("GitHub mutation input must be an object.");
    expect(() => requireGitHubMutationInput({ action: "createIssue", repo: "repo" })).toThrow(
      "GitHub mutation owner is required."
    );
    expect(() =>
      requireGitHubMutationInput({
        action: "starRepository",
        owner: "owner",
        repo: "repo"
      })
    ).toThrow("Unsupported GitHub mutation action.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createIssue",
        owner: "owner",
        repo: "repo",
        payload: []
      })
    ).toThrow("GitHub mutation payload must be an object when provided.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createIssue",
        owner: "owner",
        repo: "repo",
        payload: { title: "Issue" }
      })
    ).toThrow("GitHub mutation fields must be top-level.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createIssue",
        owner: "owner",
        repo: "repo",
        body: "missing title"
      })
    ).toThrow("Issue creation requires a title.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createIssue",
        owner: "owner",
        repo: "repo",
        body: "x".repeat(128_001)
      })
    ).toThrow("GitHub mutation payload is too large.");
  });

  it("validates workflow mutation fields at the IPC seam", () => {
    expect(
      requireGitHubMutationInput({
        action: "dispatchWorkflow",
        owner: "owner",
        repo: "repo",
        workflowId: " build.yml ",
        ref: " main ",
        inputs: {
          dryRun: false,
          retries: 0,
          note: ""
        }
      })
    ).toEqual({
      action: "dispatchWorkflow",
      owner: "owner",
      repo: "repo",
      workflowId: "build.yml",
      ref: "main",
      inputs: {
        dryRun: false,
        retries: 0,
        note: ""
      }
    });
    expect(
      requireGitHubMutationInput({
        action: "rerunWorkflow",
        owner: "owner",
        repo: "repo",
        runId: 123
      })
    ).toEqual({
      action: "rerunWorkflow",
      owner: "owner",
      repo: "repo",
      runId: 123
    });

    expect(() =>
      requireGitHubMutationInput({
        action: "dispatchWorkflow",
        owner: "owner",
        repo: "repo",
        workflowId: "build.yml"
      })
    ).toThrow("Workflow dispatch requires a ref.");
    expect(() =>
      requireGitHubMutationInput({
        action: "dispatchWorkflow",
        owner: "owner",
        repo: "repo",
        payload: { workflowId: "build.yml", ref: "main" }
      })
    ).toThrow("GitHub mutation fields must be top-level.");
    expect(() =>
      requireGitHubMutationInput({
        action: "dispatchWorkflow",
        owner: "owner",
        repo: "repo",
        workflowId: "build.yml",
        ref: "main",
        inputs: new Date()
      })
    ).toThrow("Workflow dispatch inputs must be a JSON object.");
    expect(() =>
      requireGitHubMutationInput({
        action: "rerunWorkflow",
        owner: "owner",
        repo: "repo",
        runId: 0
      })
    ).toThrow("Workflow mutation runId must be a positive integer.");
    expect(() =>
      requireGitHubMutationInput({
        action: "rerunWorkflowJob",
        owner: "owner",
        repo: "repo",
        jobId: "123"
      })
    ).toThrow("Workflow mutation jobId must be a positive integer.");
  });

  it("validates non-workflow mutation domains without dropping falsey values", () => {
    expect(
      requireGitHubMutationInput({
        action: "updateProjectV2Item",
        owner: "owner",
        repo: "repo",
        projectId: " PVT_kw ",
        itemId: " PVTI_kw ",
        fieldId: " PVTSSF_kw ",
        value: 0
      })
    ).toEqual({
      action: "updateProjectV2Item",
      owner: "owner",
      repo: "repo",
      projectId: "PVT_kw",
      itemId: "PVTI_kw",
      fieldId: "PVTSSF_kw",
      value: 0
    });
    expect(
      requireGitHubMutationInput({
        action: "editWikiPage",
        owner: "owner",
        repo: "repo",
        pagePath: " Home.md ",
        content: ""
      })
    ).toEqual({
      action: "editWikiPage",
      owner: "owner",
      repo: "repo",
      pagePath: "Home.md",
      content: ""
    });
    expect(
      requireGitHubMutationInput({
        action: "updateBranchProtection",
        owner: "owner",
        repo: "repo",
        branch: " main ",
        required_linear_history: false,
        allow_force_pushes: false,
        enforce_admins: null
      })
    ).toEqual({
      action: "updateBranchProtection",
      owner: "owner",
      repo: "repo",
      branch: "main",
      required_linear_history: false,
      allow_force_pushes: false,
      enforce_admins: null
    });

    expect(() =>
      requireGitHubMutationInput({
        action: "mergePullRequest",
        owner: "owner",
        repo: "repo"
      })
    ).toThrow("Pull request mutation pullNumber must be a positive integer.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createRelease",
        owner: "owner",
        repo: "repo"
      })
    ).toThrow("Release creation requires a tag name.");
    expect(() =>
      requireGitHubMutationInput({
        action: "updateCollaboratorPermission",
        owner: "owner",
        repo: "repo",
        username: "octocat"
      })
    ).toThrow("Repository collaborator permission is required.");
    expect(() =>
      requireGitHubMutationInput({
        action: "createDiscussion",
        owner: "owner",
        repo: "repo",
        categoryId: "DIC_kw",
        title: "Roadmap",
        body: ""
      })
    ).toThrow("Discussion creation requires a body.");
    expect(() =>
      requireGitHubMutationInput({
        action: "updateProjectV2Item",
        owner: "owner",
        repo: "repo",
        projectId: "PVT_kw",
        itemId: "PVTI_kw",
        fieldId: "PVTSSF_kw",
        value: new Date()
      })
    ).toThrow("Project item value must be JSON-safe.");
  });
});
