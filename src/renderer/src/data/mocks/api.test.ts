import { describe, expect, it } from "vitest";

import { mockControlApi } from "./api";
import { installMockDomainTestCleanup } from "./testCleanup";

describe("mock control api", () => {
  installMockDomainTestCleanup();

  it("returns matching data from repository list status adapters", async () => {
    const result = await mockControlApi.github.listRepositoriesWithStatus();

    expect(result.items).toHaveLength(3);
    expect(result.availability).toEqual({ status: "available", message: null });
  });

  it("returns matching data from notification status adapters", async () => {
    const result = await mockControlApi.github.listNotificationsWithStatus({ all: true });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.availability).toEqual({ status: "available", message: null });
  });

  it("returns matching data from mutable domain status adapters", async () => {
    const issuesResult = await mockControlApi.github.listIssuesWithStatus({
      owner: "apple",
      repo: "swift"
    });
    const pullsResult = await mockControlApi.github.listPullRequestsWithStatus({
      owner: "apple",
      repo: "swift"
    });
    const actionsResult = await mockControlApi.github.listActionsWithStatus({
      owner: "apple",
      repo: "swift"
    });
    const releasesResult = await mockControlApi.github.listReleasesWithStatus({
      owner: "apple",
      repo: "swift"
    });

    expect(issuesResult).toMatchObject({
      items: expect.any(Array),
      availability: { status: "available", message: null }
    });
    expect(pullsResult).toMatchObject({
      items: expect.any(Array),
      availability: { status: "available", message: null }
    });
    expect(actionsResult).toMatchObject({
      items: expect.any(Array),
      availability: { status: "available", message: null }
    });
    expect(releasesResult).toMatchObject({
      items: expect.any(Array),
      availability: { status: "available", message: null }
    });
  });
});
