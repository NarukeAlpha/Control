import { describe, expect, it, vi } from "vitest";

import { listMockIssues, mockIssues, mutateMockIssues, readMockIssues } from "./issues";
import { installMockDomainTestCleanup } from "./testCleanup";

describe("issue mocks", () => {
  installMockDomainTestCleanup();

  it("creates issues through the persisted issue domain", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));

    mutateMockIssues({
      action: "createIssue",
      owner: "apple",
      repo: "swift",
      title: "Track parser diagnostics",
      body: "  Include the failing source range.  ",
      labels: ["compiler", "new-area"],
      assignees: ["swift-ci"],
      milestone: 6
    });

    const createdIssue = readMockIssues()[0];
    expect(createdIssue).toMatchObject({
      number: 1201,
      title: "Track parser diagnostics",
      state: "open",
      body: "Include the failing source range.",
      htmlUrl: "https://github.com/apple/swift/issues/1201"
    });
    expect(createdIssue.labels.map((label) => label.name)).toEqual(["compiler", "new-area"]);
    expect(createdIssue.assignees?.map((assignee) => assignee.login)).toEqual(["swift-ci"]);
    expect(listMockIssues({ state: "open", limit: 1 })[0].number).toBe(1201);
  });

  it("mutates existing issue state, comments, labels, and assignees", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:30:00.000Z"));
    const targetIssue = mockIssues.find((issue) => issue.state === "open") ?? mockIssues[0];

    mutateMockIssues({
      action: "addComment",
      owner: "apple",
      repo: "swift",
      issueNumber: targetIssue.number,
      body: "Ready for maintainer review."
    });
    mutateMockIssues({
      action: "addLabels",
      owner: "apple",
      repo: "swift",
      issueNumber: targetIssue.number,
      labels: ["bug"]
    });
    mutateMockIssues({
      action: "removeAssignees",
      owner: "apple",
      repo: "swift",
      issueNumber: targetIssue.number,
      assignees: ["swift-ci", "slightbug"]
    });
    mutateMockIssues({
      action: "closeIssue",
      owner: "apple",
      repo: "swift",
      issueNumber: targetIssue.number,
      stateReason: "completed"
    });

    const updatedIssue = readMockIssues().find((issue) => issue.number === targetIssue.number);
    expect(updatedIssue).toMatchObject({
      state: "closed",
      stateReason: "completed",
      updatedAt: "2026-05-20T12:30:00.000Z"
    });
    expect(updatedIssue?.commentsList.at(-1)?.body).toBe("Ready for maintainer review.");
    expect(updatedIssue?.labels.some((label) => label.name === "bug")).toBe(true);
    expect(updatedIssue?.assignees?.map((assignee) => assignee.login)).not.toContain("swift-ci");
  });
});
