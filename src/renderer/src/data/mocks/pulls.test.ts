import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockPullRequests, mutateMockPullRequests, readMockPullRequests } from "./pulls";

describe("pull request mocks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates pull requests through the persisted pull domain", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T13:00:00.000Z"));

    mutateMockPullRequests({
      action: "createPullRequest",
      owner: "apple",
      repo: "swift",
      title: "Add parser fixture",
      head: "feature/parser-fixture",
      base: "main",
      body: "  Exercise the generated parser fixture.  ",
      draft: true,
      maintainer_can_modify: false
    });

    const createdPull = readMockPullRequests()[0];
    expect(createdPull).toMatchObject({
      number: 521,
      title: "Add parser fixture",
      body: "Exercise the generated parser fixture.",
      isDraft: true,
      maintainerCanModify: false,
      headRefName: "feature/parser-fixture",
      htmlUrl: "https://github.com/apple/swift/pull/521"
    });
  });

  it("updates reviewers and merge state for existing pull requests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T13:30:00.000Z"));
    const targetPull =
      mockPullRequests.find((pull) => pull.state === "open" && !pull.merged) ?? mockPullRequests[0];

    mutateMockPullRequests({
      action: "requestReviewers",
      owner: "apple",
      repo: "swift",
      pullNumber: targetPull.number,
      reviewers: ["new-reviewer"],
      teamReviewers: ["release-engineering"]
    });
    mutateMockPullRequests({
      action: "mergePullRequest",
      owner: "apple",
      repo: "swift",
      pullNumber: targetPull.number,
      merge_method: "squash"
    });

    const updatedPull = readMockPullRequests().find((pull) => pull.number === targetPull.number);
    expect(updatedPull).toMatchObject({
      state: "closed",
      merged: true,
      mergeableState: "merged",
      mergedAt: "2026-05-20T13:30:00.000Z"
    });
    expect(updatedPull?.requestedReviewers.map((reviewer) => reviewer.login)).toContain("new-reviewer");
    expect(updatedPull?.requestedTeams.map((team) => team.slug)).toContain("release-engineering");
  });
});
