import { describe, expect, it } from "vitest";

import {
  mockOrganizationMembers,
  mockOrganizationRepositories,
  mockOrganizations,
  mockProjects,
  mockTeamMembers,
  mockTeamRepositories,
  mockTeams
} from "../../data/mock";
import { defaultMemberProfileRepositoryLimit } from "./organizationUi";
import {
  type OrganizationRouteDerivedState,
  deriveOrganizationRouteState
} from "./useOrganizationRouteDerivedState";

type DerivedStateInput = Parameters<typeof deriveOrganizationRouteState>[0];

function derive(overrides: Partial<DerivedStateInput> = {}): OrganizationRouteDerivedState {
  return deriveOrganizationRouteState({
    organizations: mockOrganizations,
    organizationRepositories: mockOrganizationRepositories.apple,
    organizationProjects: mockProjects,
    organizationTeams: mockTeams,
    organizationTeamRepositories: mockTeamRepositories.compiler,
    organizationTeamMembers: mockTeamMembers.compiler,
    organizationMembers: mockOrganizationMembers.apple,
    selectedOrganizationLogin: "apple",
    selectedOrganizationProjectId: null,
    selectedOrganizationTeamSlug: "compiler",
    selectedOrganizationMemberLogin: null,
    collectionFilter: "",
    profileRepositoryLimits: {},
    ...overrides
  });
}

describe("deriveOrganizationRouteState", () => {
  it("normalizes the collection filter and applies it across organization collections", () => {
    const state = derive({ collectionFilter: " Compiler " });

    expect(state.normalizedCollectionFilter).toBe("compiler");
    expect(state.filteredOrganizationTeams.map((team) => team.slug)).toEqual(["compiler", "developer-tools"]);
    expect(state.filteredOrganizationProjects.map((project) => project.id)).toEqual(["P_1"]);
    expect(state.filteredOrganizationTeamMembers.map((member) => member.login)).toEqual([
      "apple-compiler-admin"
    ]);
  });

  it("sorts selected organization repositories by recent activity without mutating the source list", () => {
    const olderRepository = {
      ...mockOrganizationRepositories.apple[0],
      id: "OR_older",
      name: "older",
      nameWithOwner: "apple/older",
      pushedAt: null,
      updatedAt: "2024-01-01T00:00:00.000Z"
    };
    const newerRepository = {
      ...mockOrganizationRepositories.apple[1],
      id: "OR_newer",
      name: "newer",
      nameWithOwner: "apple/newer",
      pushedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2023-01-01T00:00:00.000Z"
    };
    const repositories = [olderRepository, newerRepository];

    const state = derive({ organizationRepositories: repositories });

    expect(state.selectedOrganizationRepositories.map((repository) => repository.name)).toEqual([
      "newer",
      "older"
    ]);
    expect(repositories.map((repository) => repository.name)).toEqual(["older", "newer"]);
  });

  it("falls back to the first organization and team when the selected keys are absent", () => {
    const state = derive({
      selectedOrganizationLogin: "missing",
      selectedOrganizationTeamSlug: "missing"
    });

    expect(state.selectedOrganization?.login).toBe("apple");
    expect(state.selectedOrganizationTeam?.slug).toBe("compiler");
  });

  it("prefers a visible team member over an organization member with the same login", () => {
    const state = derive({
      selectedOrganizationMemberLogin: "swift-ci",
      profileRepositoryLimits: { "swift-ci": 125 }
    });

    expect(state.selectedVisibleTeamMember?.id).toBe("U_compiler_1");
    expect(state.selectedOrganizationMember?.id).toBe("U_compiler_1");
    expect(state.selectedOrganizationMemberRepositoryLimit).toBe(125);
    expect(state.selectedOrganizationMemberContext).toBe("apple organization · Compiler team · member");
  });

  it("uses the default profile repository limit when no selected member override exists", () => {
    const state = derive({ selectedOrganizationMemberLogin: "apple-oss-maintainer" });

    expect(state.selectedOrganizationMember?.login).toBe("apple-oss-maintainer");
    expect(state.selectedOrganizationMemberRepositoryLimit).toBe(defaultMemberProfileRepositoryLimit);
    expect(state.selectedOrganizationMemberContext).toBe("apple organization · member");
  });
});
