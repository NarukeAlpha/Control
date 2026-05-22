import type {
  GitHubReadAvailability,
  OrganizationListInput,
  OrganizationListResult,
  OrganizationMemberSummary,
  OrganizationMembersInput,
  OrganizationMembersResult,
  OrganizationRepositoriesInput,
  OrganizationRepositoriesResult,
  OrganizationRepositorySummary,
  OrganizationSummary,
  OrganizationTeamMembersInput,
  OrganizationTeamMembersResult,
  OrganizationTeamRepositoriesInput,
  OrganizationTeamRepositoriesResult,
  OrganizationTeamRepositorySummary,
  OrganizationTeamsInput,
  OrganizationTeamsResult,
  TeamMemberSummary,
  TeamParentSummary,
  TeamSummary
} from "@shared/github";

export interface OctokitOrganizationClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
  rest<T>(route: string, params: Record<string, unknown>): Promise<T>;
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
}

export class OctokitOrganizationDomain {
  constructor(
    private readonly client: OctokitOrganizationClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listOrganizations(input: OrganizationListInput = {}): Promise<OrganizationSummary[]> {
    const limit = input.limit ?? 50;
    const data = await this.client.graphql<{
      viewer: { login: string; organizations: { nodes: GitHubOrganizationNode[] } };
    }>(
      `
      query ViewerOrganizations($limit: Int!) {
        viewer {
          login
          organizations(first: $limit) {
            nodes {
              id
              login
              name
              description
              avatarUrl
              url
              websiteUrl
              location
              repositories { totalCount }
              teams { totalCount }
              viewerIsAMember
              viewerCanAdminister
              viewerCanCreateRepositories
              viewerCanCreateTeams
            }
          }
        }
      }
    `,
      { limit }
    );

    return Promise.all(
      data.viewer.organizations.nodes.map(async (organization) => ({
        ...mapOrganization(organization),
        ...(await this.fetchOrganizationMembership(organization.login, data.viewer.login))
      }))
    );
  }

  async listOrganizationsWithStatus(input: OrganizationListInput = {}): Promise<OrganizationListResult> {
    try {
      return {
        items: await this.listOrganizations(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listOrganizationTeams(input: OrganizationTeamsInput): Promise<TeamSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubTeam>(
      "GET /orgs/{org}/teams",
      { org: input.org },
      input.limit ?? 30
    );

    return data.map((team) => mapTeam(input.org, team));
  }

  async listOrganizationTeamsWithStatus(input: OrganizationTeamsInput): Promise<OrganizationTeamsResult> {
    try {
      return {
        items: await this.listOrganizationTeams(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listOrganizationRepositoriesWithStatus(
    input: OrganizationRepositoriesInput
  ): Promise<OrganizationRepositoriesResult> {
    try {
      const repositories = await this.client.restPaginatedArray<GitHubTeamRepository>(
        "GET /orgs/{org}/repos",
        {
          org: input.org,
          type: "all",
          sort: "pushed",
          direction: "desc"
        },
        input.limit ?? 50
      );

      return {
        items: repositories.map(mapOrganizationRepository),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listOrganizationTeamRepositoriesWithStatus(
    input: OrganizationTeamRepositoriesInput
  ): Promise<OrganizationTeamRepositoriesResult> {
    try {
      const repositories = await this.client.restPaginatedArray<GitHubTeamRepository>(
        "GET /orgs/{org}/teams/{team_slug}/repos",
        {
          org: input.org,
          team_slug: input.teamSlug
        },
        input.limit ?? 30
      );

      return {
        items: repositories.map(mapOrganizationTeamRepository),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listOrganizationTeamMembersWithStatus(
    input: OrganizationTeamMembersInput
  ): Promise<OrganizationTeamMembersResult> {
    try {
      const members = await this.client.restPaginatedArray<GitHubTeamMember>(
        "GET /orgs/{org}/teams/{team_slug}/members",
        {
          org: input.org,
          team_slug: input.teamSlug
        },
        input.limit ?? 30
      );

      return {
        items: members.map(mapTeamMember),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listOrganizationMembersWithStatus(
    input: OrganizationMembersInput
  ): Promise<OrganizationMembersResult> {
    try {
      const members = await this.client.restPaginatedArray<GitHubOrganizationMember>(
        "GET /orgs/{org}/members",
        {
          org: input.org
        },
        input.limit ?? 30
      );

      return {
        items: members.map(mapOrganizationMember),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  private async fetchOrganizationMembership(
    org: string,
    username: string
  ): Promise<
    Pick<
      OrganizationSummary,
      "viewerMembershipRole" | "viewerMembershipState" | "viewerMembershipAvailability"
    >
  > {
    try {
      const membership = await this.client.rest<GitHubOrganizationMembership>(
        "GET /orgs/{org}/memberships/{username}",
        { org, username }
      );
      return {
        viewerMembershipRole: membership.role ?? null,
        viewerMembershipState: membership.state ?? null,
        viewerMembershipAvailability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        viewerMembershipRole: null,
        viewerMembershipState: null,
        viewerMembershipAvailability: this.mapError(error)
      };
    }
  }
}

function mapOrganization(node: GitHubOrganizationNode): OrganizationSummary {
  return {
    id: node.id,
    login: node.login,
    name: node.name,
    description: node.description,
    avatarUrl: node.avatarUrl,
    htmlUrl: node.url,
    websiteUrl: node.websiteUrl,
    location: node.location,
    repositoryCount: node.repositories.totalCount,
    teamCount: node.teams.totalCount,
    viewerIsMember: node.viewerIsAMember,
    viewerMembershipRole: null,
    viewerMembershipState: null,
    viewerMembershipAvailability: { status: "available", message: null },
    viewerCanAdminister: node.viewerCanAdminister,
    viewerCanCreateRepositories: node.viewerCanCreateRepositories,
    viewerCanCreateTeams: node.viewerCanCreateTeams
  };
}

function mapTeam(org: string, team: GitHubTeam): TeamSummary {
  return {
    id: String(team.node_id ?? team.id),
    databaseId: typeof team.id === "number" ? team.id : null,
    organizationLogin: team.organization?.login ?? org,
    name: team.name,
    slug: team.slug,
    description: team.description ?? null,
    privacy: team.privacy ?? null,
    permission: team.permission ?? null,
    notificationSetting: team.notification_setting ?? null,
    memberCount: team.members_count ?? null,
    repositoryCount: team.repos_count ?? null,
    htmlUrl: team.html_url ?? null,
    parent: mapTeamParent(team.parent ?? null),
    createdAt: team.created_at ?? null,
    updatedAt: team.updated_at ?? null
  };
}

function mapTeamParent(team: GitHubTeamParent | null): TeamParentSummary | null {
  if (!team) {
    return null;
  }

  return {
    id: String(team.node_id ?? team.id),
    name: team.name,
    slug: team.slug,
    htmlUrl: team.html_url ?? null
  };
}

function mapOrganizationTeamRepository(repository: GitHubTeamRepository): OrganizationTeamRepositorySummary {
  return mapOrganizationRepository(repository);
}

function mapOrganizationRepository(repository: GitHubTeamRepository): OrganizationRepositorySummary {
  return {
    id: String(repository.node_id ?? repository.id),
    owner: repository.owner.login,
    name: repository.name,
    nameWithOwner: repository.full_name,
    description: repository.description ?? null,
    visibility: repository.visibility ?? (repository.private ? "private" : null),
    isPrivate: repository.private ?? null,
    permission: repository.permissions ? mapRestRepositoryPermission(repository.permissions) : null,
    htmlUrl: repository.html_url,
    defaultBranch: repository.default_branch ?? null,
    updatedAt: repository.updated_at ?? null,
    pushedAt: repository.pushed_at ?? null
  };
}

function mapTeamMember(member: GitHubTeamMember): TeamMemberSummary {
  return mapVisibleMember(member);
}

function mapOrganizationMember(member: GitHubOrganizationMember): OrganizationMemberSummary {
  return mapVisibleMember(member);
}

function mapVisibleMember(member: GitHubVisibleMember): TeamMemberSummary {
  return {
    id: String(member.id),
    login: member.login,
    avatarUrl: member.avatar_url ?? null,
    htmlUrl: member.html_url ?? null,
    siteAdmin: member.site_admin ?? null
  };
}

function mapRestRepositoryPermission(
  permissions: GitHubRestRepositoryPermissions | null | undefined
): string | null {
  if (!permissions) {
    return null;
  }

  if (permissions.admin) {
    return "ADMIN";
  }
  if (permissions.maintain) {
    return "MAINTAIN";
  }
  if (permissions.push) {
    return "WRITE";
  }
  if (permissions.triage) {
    return "TRIAGE";
  }
  if (permissions.pull) {
    return "READ";
  }
  return null;
}

interface GitHubOrganizationNode {
  id: string;
  login: string;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  url: string;
  websiteUrl: string | null;
  location: string | null;
  repositories: { totalCount: number };
  teams: { totalCount: number };
  viewerIsAMember: boolean;
  viewerCanAdminister: boolean;
  viewerCanCreateRepositories: boolean;
  viewerCanCreateTeams: boolean;
}

interface GitHubOrganizationMembership {
  role?: string | null;
  state?: string | null;
}

interface GitHubTeamParent {
  id: number | string;
  node_id?: string | null;
  name: string;
  slug: string;
  html_url?: string | null;
}

interface GitHubTeam extends GitHubTeamParent {
  description?: string | null;
  privacy?: string | null;
  permission?: string | null;
  notification_setting?: string | null;
  members_count?: number | null;
  repos_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  parent?: GitHubTeamParent | null;
  organization?: { login: string } | null;
}

interface GitHubTeamRepository {
  id: number | string;
  node_id?: string | null;
  name: string;
  full_name: string;
  description?: string | null;
  html_url: string;
  default_branch?: string | null;
  visibility?: string | null;
  private?: boolean | null;
  updated_at?: string | null;
  pushed_at?: string | null;
  owner: { login: string };
  permissions?: GitHubRestRepositoryPermissions | null;
}

type GitHubTeamMember = GitHubVisibleMember;

type GitHubOrganizationMember = GitHubVisibleMember;

interface GitHubVisibleMember {
  id: number | string;
  login: string;
  avatar_url?: string | null;
  html_url?: string | null;
  site_admin?: boolean | null;
}

interface GitHubRestRepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}
