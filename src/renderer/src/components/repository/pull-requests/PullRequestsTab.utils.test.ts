import { describe, expect, it } from "vitest";

import { mockBranchProtection } from "../../../data/mocks/security";
import { mockRepository } from "../../../data/mocks/repository";
import { pullRequestMergeMethodOptions } from "./PullRequestsTab.utils";

describe("pull request merge method options", () => {
  it("filters merge commits when the base branch requires linear history", () => {
    expect(
      pullRequestMergeMethodOptions(mockRepository, mockBranchProtection.protection).map(
        (option) => option.method
      )
    ).toEqual(["squash", "rebase"]);
  });

  it("returns only squash when repository settings disable merge commits and rebase merges", () => {
    const repository = {
      ...mockRepository,
      administration: {
        ...mockRepository.administration,
        mergeSettings: {
          ...mockRepository.administration.mergeSettings,
          allowMergeCommit: false,
          allowSquashMerge: true,
          allowRebaseMerge: false
        }
      }
    };

    expect(pullRequestMergeMethodOptions(repository, null).map((option) => option.method)).toEqual([
      "squash"
    ]);
  });
});
