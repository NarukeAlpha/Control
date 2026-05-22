import type {
  GitHubReadAvailability,
  RepositorySearchResult,
  RepositorySummary,
  SearchInput
} from "@shared/github";
import {
  mapRepositorySummary,
  repositorySummaryFragment,
  type GitHubRepositoryNode
} from "./repositoryDomain";

export interface OctokitSearchClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
}

export class OctokitSearchDomain {
  constructor(
    private readonly client: OctokitSearchClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async search(input: SearchInput): Promise<RepositorySummary[]> {
    if (!input.query.trim()) {
      return [];
    }

    const limit = input.limit ?? 12;
    const data = await this.client.graphql<{ search: { nodes: GitHubRepositoryNode[] } }>(
      `
      query RepositorySearch($searchQuery: String!, $limit: Int!) {
        search(query: $searchQuery, type: REPOSITORY, first: $limit) {
          nodes {
            ... on Repository {
              ...RepositorySummaryFields
            }
          }
        }
      }

      ${repositorySummaryFragment}
    `,
      { searchQuery: input.query, limit }
    );

    return data.search.nodes.filter(Boolean).map(mapRepositorySummary);
  }

  async searchWithStatus(input: SearchInput): Promise<RepositorySearchResult> {
    try {
      return {
        items: await this.search(input),
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
