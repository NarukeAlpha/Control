import { describe, expect, it, vi } from "vitest";

import type { GitHubMutationInput } from "@shared/github";
import {
  areaRepositoryUpdateInvalidationQueryKeys,
  areaWorkspaceUpdateInvalidationQueryKeys,
  githubMutationInvalidationQueryKeys,
  invalidateGitHubMutationQueries
} from "./appInvalidations";

function mutation(action: GitHubMutationInput["action"]): GitHubMutationInput {
  return { action, owner: "openai", repo: "control" } as GitHubMutationInput;
}

describe("github mutation invalidation", () => {
  it("invalidates only release query families for release mutations", () => {
    expect(githubMutationInvalidationQueryKeys(mutation("editRelease"))).toEqual([
      ["notifications"],
      ["releases", "openai", "control"],
      ["release-detail", "openai", "control"],
      ["repository", "openai", "control"]
    ]);
  });

  it("invalidates issue and pull families for shared issue-backed label mutations", () => {
    expect(githubMutationInvalidationQueryKeys(mutation("addLabels"))).toEqual([
      ["notifications"],
      ["issues", "openai", "control"],
      ["issue-detail", "openai", "control"],
      ["pulls", "openai", "control"],
      ["pull-detail"],
      ["labels", "openai", "control"],
      ["assignable-users", "openai", "control"],
      ["milestones", "openai", "control"],
      ["account-issues"],
      ["account-pulls"]
    ]);
  });

  it("invalidates sectioned pull detail queries from pull mutations", () => {
    expect(githubMutationInvalidationQueryKeys(mutation("requestReviewers"))).toEqual([
      ["notifications"],
      ["pulls", "openai", "control"],
      ["pull-detail"],
      ["account-pulls"]
    ]);
  });

  it("keeps workflow invalidation scoped to workflow/action families", () => {
    expect(githubMutationInvalidationQueryKeys(mutation("dispatchWorkflow"))).toEqual([
      ["notifications"],
      ["actions", "openai", "control"],
      ["action-detail", "openai", "control"],
      ["workflows", "openai", "control"]
    ]);
  });

  it("uses the targeted mapping when invalidating a query client", async () => {
    const invalidateQueries = vi.fn(async (_input: { queryKey: readonly unknown[] }) => undefined);

    await invalidateGitHubMutationQueries({ invalidateQueries } as never, mutation("star"));

    expect(invalidateQueries.mock.calls.map(([input]) => input)).toEqual([
      { queryKey: ["notifications"] },
      { queryKey: ["repository", "openai", "control"] },
      { queryKey: ["repositories"] },
      { queryKey: ["github-account-repositories"] },
      { queryKey: ["account-profile"] }
    ]);
  });
});

describe("Area event invalidation", () => {
  it("invalidates repository-scoped Area and GitHub enrichment query families", () => {
    expect(
      areaRepositoryUpdateInvalidationQueryKeys({
        areaId: "area-1",
        repositoryId: "repo-1"
      })
    ).toEqual([
      ["area-repositories", "area-1"],
      ["area-repository", "area-1", "repo-1"],
      ["area-workspaces", "area-1", "repo-1"],
      ["area-contents", "area-1", "repo-1"],
      ["area-file-content", "area-1", "repo-1"],
      ["area-sync-status", "area-1", "repo-1"],
      ["area-github-issues", "area-1", "repo-1"],
      ["area-github-pulls", "area-1", "repo-1"],
      ["area-github-actions", "area-1", "repo-1"]
    ]);
  });

  it("falls back to Area-scoped prefixes when a repository update has no repository id", () => {
    expect(
      areaRepositoryUpdateInvalidationQueryKeys({
        areaId: "area-1",
        repositoryId: null
      })
    ).toEqual([
      ["area-repositories", "area-1"],
      ["area-repository", "area-1"],
      ["area-workspaces", "area-1"],
      ["area-contents", "area-1"],
      ["area-file-content", "area-1"],
      ["area-sync-status", "area-1"],
      ["area-github-issues", "area-1"],
      ["area-github-pulls", "area-1"],
      ["area-github-actions", "area-1"]
    ]);
  });

  it("invalidates workspace-scoped content and sync status families for workspace updates", () => {
    expect(
      areaWorkspaceUpdateInvalidationQueryKeys({
        areaId: "area-1",
        repositoryId: "repo-1",
        workspaceId: "workspace-1"
      })
    ).toEqual([
      ["area-workspaces", "area-1", "repo-1"],
      ["area-contents", "area-1", "repo-1", "workspace-1"],
      ["area-file-content", "area-1", "repo-1", "workspace-1"],
      ["area-sync-status", "area-1", "repo-1", "workspace-1"]
    ]);
  });

  it("uses the unscoped workspace query token for repository-level workspace updates", () => {
    expect(
      areaWorkspaceUpdateInvalidationQueryKeys({
        areaId: "area-1",
        repositoryId: "repo-1",
        workspaceId: null
      })
    ).toEqual([
      ["area-workspaces", "area-1", "repo-1"],
      ["area-contents", "area-1", "repo-1", "none"],
      ["area-file-content", "area-1", "repo-1", "none"],
      ["area-sync-status", "area-1", "repo-1", "none"]
    ]);
  });
});
