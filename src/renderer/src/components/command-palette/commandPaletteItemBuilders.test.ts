import { describe, expect, it, vi } from "vitest";

import type {
  OrganizationMemberSummary,
  OrganizationSummary,
  ProjectSummary,
  TeamSummary
} from "@shared/github";
import type { CommandPaletteItem } from "./CommandPalette";
import { appendOrganizationCommandPaletteItems } from "./commandPaletteItemBuilders";

const availability = { status: "available", message: null } as const;

describe("appendOrganizationCommandPaletteItems", () => {
  it("runs organization project, member, and team member commands with narrowed selections", () => {
    const organization: OrganizationSummary = {
      id: "org-id",
      login: "openai",
      name: "OpenAI",
      description: null,
      avatarUrl: null,
      htmlUrl: "https://github.com/openai",
      websiteUrl: null,
      location: null,
      repositoryCount: 1,
      teamCount: 1,
      viewerIsMember: true,
      viewerMembershipRole: "admin",
      viewerMembershipState: "active",
      viewerMembershipAvailability: availability,
      viewerCanAdminister: true,
      viewerCanCreateRepositories: true,
      viewerCanCreateTeams: true
    };
    const team: TeamSummary = {
      id: "team-id",
      databaseId: 1,
      organizationLogin: "openai",
      name: "Core",
      slug: "core",
      description: null,
      privacy: "closed",
      permission: "admin",
      notificationSetting: null,
      memberCount: 1,
      repositoryCount: 1,
      htmlUrl: "https://github.com/orgs/openai/teams/core",
      parent: null,
      createdAt: null,
      updatedAt: null
    };
    const member: OrganizationMemberSummary = {
      id: "member-id",
      login: "octocat",
      avatarUrl: null,
      htmlUrl: "https://github.com/octocat",
      siteAdmin: false
    };
    const project: ProjectSummary = {
      id: "project-id",
      number: 7,
      title: "Roadmap",
      shortDescription: null,
      readme: null,
      ownerLogin: "openai",
      ownerKind: "organization",
      ownerHtmlUrl: "https://github.com/openai",
      isPublic: false,
      closed: false,
      closedAt: null,
      createdAt: null,
      updatedAt: null,
      itemsCount: 0,
      items: [],
      itemsTruncated: false,
      fieldsCount: 0,
      fields: [],
      viewerCanUpdate: true,
      htmlUrl: "https://github.com/orgs/openai/projects/7"
    };
    const onSelectOrganizationProject = vi.fn();
    const onOpenOrganizationMember = vi.fn();
    const onOpenOrganizationTeamMember = vi.fn();
    const items: CommandPaletteItem[] = [];

    appendOrganizationCommandPaletteItems(items, {
      organizationItems: [],
      organizationTeams: [],
      organizationRepositories: [],
      organizationTeamRepositories: [],
      organizationProjects: [project],
      organizationMembers: [member],
      organizationTeamMembers: [member],
      selectedOrganization: organization,
      selectedOrganizationTeam: team,
      generalSourceLimit: 5,
      denseSourceLimit: 5,
      onOpenOrganization: vi.fn(),
      onOpenTeam: vi.fn(),
      onOpenRepository: vi.fn(),
      onOpenOrganizationMember,
      onOpenOrganizationTeamMember,
      onSelectOrganizationProject
    });

    items.find((item) => item.id === "organization-project-openai-project-id")?.run();
    items.find((item) => item.id === "organization-member-openai-member-id")?.run();
    items.find((item) => item.id === "organization-team-member-openai-core-member-id")?.run();

    expect(onSelectOrganizationProject).toHaveBeenCalledWith(organization, project);
    expect(onOpenOrganizationMember).toHaveBeenCalledWith(organization, member);
    expect(onOpenOrganizationTeamMember).toHaveBeenCalledWith(organization, team, member);
  });
});
