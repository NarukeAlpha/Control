import type { QueryClient } from "@tanstack/react-query";

import type { GitHubMutationInput } from "@shared/github";
import {
  mutationAffectsAccountIssues,
  mutationAffectsAccountProfile,
  mutationAffectsAccountPulls,
  mutationAffectsRepositoryCollections
} from "../repository/githubMutationHelpers";
import { repositoryScopedQueryKeys } from "../../queries/repositoryQueryKeys";

export interface RepositoryQueryScope {
  owner: string;
  repo: string;
}

const githubSessionQueryKeys = [
  ["app-state"],
  ["repositories"],
  ["account-profile"],
  ["account-issues"],
  ["account-pulls"],
  ["notifications"],
  ["organizations"],
  ["github-account-repositories"],
  ["repository-tree"],
  ["organization-teams"],
  ["organization-repositories"],
  ["organization-members"],
  ["organization-projects"],
  ["organization-team-repositories"],
  ["organization-team-members"]
] as const;

export function repositoryQueryScopeFromNameWithOwner(
  nameWithOwner: string | null
): RepositoryQueryScope | null {
  if (!nameWithOwner) {
    return null;
  }

  const [owner, repo] = nameWithOwner.split("/");
  return owner && repo ? { owner, repo } : null;
}

export async function invalidateRepositoryScopedQueries(
  queryClient: QueryClient,
  owner: string,
  repo: string
): Promise<void> {
  await Promise.all(
    repositoryScopedQueryKeys(owner, repo).map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

export async function invalidateGitHubSessionQueries(
  queryClient: QueryClient,
  activeRepository: RepositoryQueryScope | null
): Promise<void> {
  const invalidations: Array<Promise<void>> = githubSessionQueryKeys.map((queryKey) =>
    queryClient.invalidateQueries({ queryKey })
  );

  if (activeRepository) {
    invalidations.push(
      invalidateRepositoryScopedQueries(queryClient, activeRepository.owner, activeRepository.repo)
    );
  }

  await Promise.all(invalidations);
}

export async function invalidateGitHubMutationQueries(
  queryClient: QueryClient,
  input: GitHubMutationInput
): Promise<void> {
  const invalidations: Array<Promise<void>> = [
    queryClient.invalidateQueries({ queryKey: ["notifications"] })
  ];

  if (mutationAffectsAccountIssues(input.action)) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["account-issues"] }));
  }
  if (mutationAffectsAccountPulls(input.action)) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["account-pulls"] }));
  }
  if (mutationAffectsAccountProfile(input.action)) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["account-profile"] }));
  }
  if (mutationAffectsRepositoryCollections(input.action)) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["repositories"] }));
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["github-account-repositories"] }));
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["organizations"] }));
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["organization-repositories"] }));
    invalidations.push(queryClient.invalidateQueries({ queryKey: ["organization-team-repositories"] }));
  }

  await Promise.all([
    invalidateRepositoryScopedQueries(queryClient, input.owner, input.repo),
    ...invalidations
  ]);
}
