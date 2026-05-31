import { describe, expect, it } from "vitest";

import { mockNotifications } from "./notifications";
import { mockProjects } from "./projects";
import { mockPullRequests } from "./pulls";
import { mockRepositories } from "./repository";
import { findMissingMockRepositoryReferences } from "./shared";

describe("mock fixture integrity", () => {
  it("keeps cross-domain repository references backed by repository fixtures", () => {
    const references = [
      ...mockNotifications.map((notification) => ({
        id: notification.id,
        repositoryNameWithOwner: notification.repositoryNameWithOwner
      })),
      ...mockPullRequests.map((pullRequest) => ({
        id: String(pullRequest.number),
        repositoryNameWithOwner: pullRequest.repositoryNameWithOwner
      })),
      ...mockProjects.flatMap((project) =>
        project.items.map((item) => ({
          id: item.id,
          repositoryNameWithOwner: item.repositoryNameWithOwner
        }))
      )
    ];

    expect(findMissingMockRepositoryReferences({ repositories: mockRepositories, references })).toEqual([]);
  });
});
