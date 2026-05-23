import { describe, expect, it } from "vitest";

import {
  createGitHubMutationInput,
  mutationAffectsAccountIssues,
  mutationAffectsAccountProfile,
  mutationAffectsAccountPulls,
  mutationAffectsRepositoryCollections
} from "./githubMutationHelpers";

describe("githubMutationHelpers", () => {
  it("builds typed mutation inputs with payload fields", () => {
    expect(
      createGitHubMutationInput("editRepository", "openai", "control", { description: "Local" })
    ).toEqual({
      action: "editRepository",
      owner: "openai",
      repo: "control",
      description: "Local"
    });
  });

  it("classifies mutation invalidation surfaces", () => {
    expect(mutationAffectsAccountProfile("star")).toBe(true);
    expect(mutationAffectsAccountIssues("createIssue")).toBe(true);
    expect(mutationAffectsAccountPulls("mergePullRequest")).toBe(true);
    expect(mutationAffectsRepositoryCollections("dispatchWorkflow")).toBe(true);
    expect(mutationAffectsAccountProfile("createIssue")).toBe(false);
  });
});
