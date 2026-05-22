import type {
  ContributorListResult,
  ContributorSummary,
  ContributorsInput,
  GitHubReadAvailability
} from "@shared/github";

export interface OctokitContributorClient {
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
}

export class OctokitContributorDomain {
  constructor(
    private readonly client: OctokitContributorClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listContributors(input: ContributorsInput): Promise<ContributorSummary[]> {
    const data = await this.client.restPaginatedArray<GitHubContributor>(
      "GET /repos/{owner}/{repo}/contributors",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 24
    );
    return data.map(mapContributor);
  }

  async listContributorsWithStatus(input: ContributorsInput): Promise<ContributorListResult> {
    try {
      return {
        items: await this.listContributors(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }
}

function mapContributor(contributor: GitHubContributor): ContributorSummary {
  return {
    id: contributor.id,
    login: contributor.login,
    avatarUrl: contributor.avatar_url,
    htmlUrl: contributor.html_url,
    contributions: contributor.contributions
  };
}

export interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string | null;
  html_url: string | null;
  contributions: number;
}
