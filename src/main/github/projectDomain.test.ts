import { describe, expect, it } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import { OctokitProjectDomain, type OctokitProjectClient } from "./projectDomain";

describe("OctokitProjectDomain", () => {
  it("preserves repository projects from GraphQL partial-data errors", async () => {
    const partialError = Object.assign(new Error("GitHub returned partial project data."), {
      data: {
        repository: {
          projectsV2: {
            nodes: [
              projectFixture({
                items: null
              })
            ]
          }
        }
      },
      errors: [
        {
          type: "FORBIDDEN",
          message: "Resource not accessible by integration",
          path: ["repository", "projectsV2", "nodes", 0, "items"]
        }
      ]
    });
    const domain = new OctokitProjectDomain(
      createClient({
        graphql: async () => {
          throw partialError;
        }
      }),
      mapTestError
    );

    await expect(domain.listProjectsWithStatus({ owner: "apple", repo: "swift" })).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: "P_1",
          title: "Compiler quality",
          items: [],
          itemsCount: null,
          sectionAvailability: {
            readme: { status: "available", message: null },
            items: {
              status: "permission_denied",
              message: "Project items unavailable: Resource not accessible by integration"
            },
            fields: { status: "available", message: null }
          }
        })
      ],
      availability: {
        status: "partial_data",
        message:
          "Projects returned partial data from GitHub; showing projects and sections that were available."
      }
    });
  });

  it("maps GraphQL field failures without data into precise availability", async () => {
    const domain = new OctokitProjectDomain(
      createClient({
        graphql: async () => {
          throw {
            errors: [
              {
                message: 'Cannot query field "readme" on type "ProjectV2".',
                path: ["repository", "projectsV2", "nodes", 0, "readme"]
              }
            ]
          };
        }
      }),
      mapTestError
    );

    await expect(domain.listProjectsWithStatus({ owner: "apple", repo: "swift" })).resolves.toEqual({
      items: [],
      availability: {
        status: "missing_field",
        message: 'Cannot query field "readme" on type "ProjectV2".'
      }
    });
  });
});

function createClient(overrides: Partial<OctokitProjectClient>): OctokitProjectClient {
  return {
    graphql: async () => {
      throw new Error("Unexpected GraphQL request");
    },
    ...overrides
  };
}

function mapTestError(error: unknown): GitHubReadAvailability {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "failed"
  };
}

function projectFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "P_1",
    number: 1,
    title: "Compiler quality",
    shortDescription: "Tracks compiler reliability.",
    readme: "## Focus",
    public: false,
    closed: false,
    closedAt: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-19T12:00:00.000Z",
    viewerCanUpdate: true,
    url: "https://github.com/orgs/apple/projects/1",
    owner: {
      __typename: "Repository",
      nameWithOwner: "apple/swift",
      url: "https://github.com/apple/swift"
    },
    items: {
      totalCount: 0,
      nodes: []
    },
    fields: {
      totalCount: 1,
      nodes: [
        {
          id: "PF_1",
          name: "Status",
          dataType: "SINGLE_SELECT",
          options: []
        }
      ]
    },
    ...overrides
  };
}
