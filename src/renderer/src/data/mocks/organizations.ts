import type {
  OrganizationMemberSummary,
  OrganizationRepositorySummary,
  OrganizationSummary,
  OrganizationTeamRepositorySummary,
  TeamMemberSummary
} from "@shared/github";

import { mockTeams } from "./pulls";
import { mockRepositories } from "./repository";
import { mockAvatarUrl } from "./shared";

export const mockOrganizations: OrganizationSummary[] = [
  {
    id: "O_apple",
    login: "apple",
    name: "Apple",
    description: "Open source projects from Apple.",
    avatarUrl: mockAvatarUrl,
    htmlUrl: "https://github.com/apple",
    websiteUrl: "https://opensource.apple.com",
    location: "Cupertino, CA",
    repositoryCount: 188,
    teamCount: 14,
    viewerIsMember: true,
    viewerMembershipRole: "member",
    viewerMembershipState: "active",
    viewerMembershipAvailability: { status: "available", message: null },
    viewerCanAdminister: false,
    viewerCanCreateRepositories: false,
    viewerCanCreateTeams: false
  },
  {
    id: "O_swiftlang",
    login: "swiftlang",
    name: "Swift",
    description: "The Swift project organization.",
    avatarUrl: "https://avatars.githubusercontent.com/u/42816656?v=4",
    htmlUrl: "https://github.com/swiftlang",
    websiteUrl: "https://swift.org",
    location: null,
    repositoryCount: 64,
    teamCount: 8,
    viewerIsMember: true,
    viewerMembershipRole: "admin",
    viewerMembershipState: "active",
    viewerMembershipAvailability: { status: "available", message: null },
    viewerCanAdminister: false,
    viewerCanCreateRepositories: true,
    viewerCanCreateTeams: false
  }
];

export const mockTeamMembers: Record<string, TeamMemberSummary[]> = {
  compiler: [
    {
      id: "U_compiler_1",
      login: "swift-ci",
      avatarUrl: mockAvatarUrl,
      htmlUrl: "https://github.com/swift-ci",
      siteAdmin: false
    },
    {
      id: "U_compiler_2",
      login: "apple-compiler-admin",
      avatarUrl: mockAvatarUrl,
      htmlUrl: "https://github.com/apple-compiler-admin",
      siteAdmin: false
    }
  ],
  "developer-tools": [
    {
      id: "U_tools_1",
      login: "xcode-tools",
      avatarUrl: mockAvatarUrl,
      htmlUrl: "https://github.com/xcode-tools",
      siteAdmin: false
    },
    {
      id: "U_tools_2",
      login: "swiftpm-maintainer",
      avatarUrl: mockAvatarUrl,
      htmlUrl: "https://github.com/swiftpm-maintainer",
      siteAdmin: false
    }
  ]
};

export const mockOrganizationMembers: Record<string, OrganizationMemberSummary[]> = {
  apple: [
    {
      id: "U_apple_1",
      login: "swift-ci",
      avatarUrl: mockAvatarUrl,
      htmlUrl: "https://github.com/swift-ci",
      siteAdmin: false
    },
    {
      id: "U_apple_2",
      login: "apple-oss-maintainer",
      avatarUrl: mockAvatarUrl,
      htmlUrl: "https://github.com/apple-oss-maintainer",
      siteAdmin: false
    },
    {
      id: "U_apple_3",
      login: "swiftpm-maintainer",
      avatarUrl: mockAvatarUrl,
      htmlUrl: "https://github.com/swiftpm-maintainer",
      siteAdmin: false
    }
  ],
  swiftlang: [
    {
      id: "U_swiftlang_1",
      login: "swiftlang-admin",
      avatarUrl: "https://avatars.githubusercontent.com/u/42816656?v=4",
      htmlUrl: "https://github.com/swiftlang-admin",
      siteAdmin: false
    },
    {
      id: "U_swiftlang_2",
      login: "swift-evolution",
      avatarUrl: "https://avatars.githubusercontent.com/u/42816656?v=4",
      htmlUrl: "https://github.com/swift-evolution",
      siteAdmin: false
    }
  ]
};

export const mockTeamRepositories: Record<string, OrganizationTeamRepositorySummary[]> = {
  compiler: mockRepositories.slice(0, 2).map((repository, index) => ({
    id: `TR_compiler_${repository.id}`,
    owner: repository.owner,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate,
    permission: index === 0 ? "ADMIN" : "WRITE",
    htmlUrl: `https://github.com/${repository.nameWithOwner}`,
    defaultBranch: repository.defaultBranch,
    updatedAt: repository.updatedAt,
    pushedAt: repository.pushedAt
  })),
  "developer-tools": mockRepositories.slice(1, 3).map((repository) => ({
    id: `TR_tools_${repository.id}`,
    owner: repository.owner,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate,
    permission: "MAINTAIN",
    htmlUrl: `https://github.com/${repository.nameWithOwner}`,
    defaultBranch: repository.defaultBranch,
    updatedAt: repository.updatedAt,
    pushedAt: repository.pushedAt
  }))
};

export const mockOrganizationRepositories: Record<string, OrganizationRepositorySummary[]> = {
  apple: mockRepositories.slice(0, 4).map((repository, index) => ({
    id: `OR_apple_${repository.id}`,
    owner: repository.owner,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate,
    permission: index === 0 ? "ADMIN" : index === 1 ? "MAINTAIN" : "READ",
    htmlUrl: `https://github.com/${repository.nameWithOwner}`,
    defaultBranch: repository.defaultBranch,
    updatedAt: repository.updatedAt,
    pushedAt: repository.pushedAt
  }))
};

export function listMockOrganizationTeams(input: { org: string; limit?: number }) {
  return mockTeams
    .filter((team) => team.organizationLogin.toLowerCase() === input.org.toLowerCase())
    .slice(0, input.limit ?? undefined);
}
