import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mutateMockWorkflowRuns, readMockWorkflowRuns } from "./actions";
import { mutateMockIssues, readMockIssues } from "./issues";
import { mutateMockPullRequests, readMockPullRequests } from "./pulls";
import { mutateMockReleases, readMockReleases } from "./releases";

describe("domain mutation mocks", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates issues through the issue mock storage path", () => {
    mutateMockIssues({
      action: "createIssue",
      owner: "apple",
      repo: "swift",
      title: "New issue",
      body: "Issue body",
      labels: ["bug"],
      assignees: ["swift-ci"],
      milestone: 6
    });

    expect(readMockIssues()[0]).toMatchObject({
      number: 1201,
      title: "New issue",
      body: "Issue body",
      labels: [{ name: "bug" }],
      assignees: [{ login: "swift-ci" }],
      milestone: { number: 6 },
      htmlUrl: "https://github.com/apple/swift/issues/1201"
    });
  });

  it("creates pull requests while preserving explicit false booleans", () => {
    mutateMockPullRequests({
      action: "createPullRequest",
      owner: "apple",
      repo: "swift",
      title: "New pull",
      body: "Pull body",
      head: "feature/mock",
      base: "main",
      draft: false,
      maintainer_can_modify: false
    });

    expect(readMockPullRequests()[0]).toMatchObject({
      number: 521,
      title: "New pull",
      body: "Pull body",
      isDraft: false,
      maintainerCanModify: false,
      headRefName: "feature/mock",
      baseRefName: "main"
    });
  });

  it("creates and deletes releases through the release mock storage path", () => {
    mutateMockReleases({
      action: "createRelease",
      owner: "apple",
      repo: "swift",
      tag_name: "swift-6.0.0",
      name: "Swift 6",
      body: "Release body",
      draft: false,
      prerelease: false
    });

    const createdRelease = readMockReleases()[0];
    expect(createdRelease).toMatchObject({
      tagName: "swift-6.0.0",
      name: "Swift 6",
      body: "Release body",
      isDraft: false,
      isPrerelease: false,
      publishedAt: "2026-05-20T12:00:00.000Z"
    });

    mutateMockReleases({
      action: "deleteRelease",
      owner: "apple",
      repo: "swift",
      releaseId: createdRelease.id
    });

    expect(readMockReleases().some((release) => release.id === createdRelease.id)).toBe(false);
  });

  it("dispatches and cancels workflow runs through the actions mock storage path", () => {
    mutateMockWorkflowRuns({
      action: "dispatchWorkflow",
      owner: "apple",
      repo: "swift",
      workflowId: ".github/workflows/ci.yml",
      ref: "release/6.0",
      inputs: { run_tests: false }
    });

    const dispatchedRun = readMockWorkflowRuns()[0];
    expect(dispatchedRun).toMatchObject({
      event: "workflow_dispatch",
      status: "queued",
      conclusion: null,
      branch: "release/6.0",
      htmlUrl: "https://github.com/apple/swift/actions/runs/1779278400000"
    });

    mutateMockWorkflowRuns({
      action: "cancelWorkflow",
      owner: "apple",
      repo: "swift",
      runId: dispatchedRun.id
    });

    expect(readMockWorkflowRuns()[0]).toMatchObject({
      id: dispatchedRun.id,
      status: "completed",
      conclusion: "cancelled"
    });
  });
});
