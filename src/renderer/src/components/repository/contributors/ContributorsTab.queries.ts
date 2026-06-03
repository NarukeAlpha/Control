import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  ContributorListResult,
  ContributorSummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "@renderer/hooks/useControlApi";

import { defaultContributorProfileRepositoryLimit } from "../repositoryUi";

export interface ContributorsTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface ContributorsTabPrefetchInput {
  api: ControlApi;
  githubReady: boolean;
  contributors: ContributorSummary[];
  focusedContributorLogin: string | null;
  profileRepositoryLimit?: number;
}

export interface ContributorsTabRefreshInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export function contributorsTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["contributors", string, string, number] {
  return ["contributors", owner, repo, limit] as const;
}

export function contributorProfileQueryKey(
  login: string | null
): readonly ["github-account-profile", string | null] {
  return ["github-account-profile", login] as const;
}

export function contributorRepositoriesQueryKey(
  login: string | null,
  limit: number
): readonly ["github-account-repositories", string | null, number] {
  return ["github-account-repositories", login, limit] as const;
}

export function useContributorsTabQueries({
  owner,
  repo,
  limit,
  enabled,
  githubReady
}: ContributorsTabQueryInput) {
  const api = useControlApi();

  const contributors = useQuery<ContributorListResult>({
    queryKey: contributorsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listContributorsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  return { contributors };
}

export async function prefetchContributorsTabData(
  queryClient: QueryClient,
  input: ContributorsTabPrefetchInput
): Promise<void> {
  const login = firstVisibleContributorLogin(input.contributors, input.focusedContributorLogin);
  if (!login) {
    return;
  }

  const repositoryLimit = input.profileRepositoryLimit ?? defaultContributorProfileRepositoryLimit;
  await Promise.all([
    queryClient.prefetchQuery<AccountProfileResult>({
      queryKey: contributorProfileQueryKey(login),
      queryFn: () =>
        input.api.github.getAccountProfileWithStatus({
          login,
          cacheOnly: !input.githubReady
        })
    }),
    queryClient.prefetchQuery<AccountRepositoryListResult>({
      queryKey: contributorRepositoriesQueryKey(login, repositoryLimit),
      queryFn: () =>
        input.api.github.listAccountRepositoriesWithStatus({
          login,
          limit: repositoryLimit,
          cacheOnly: !input.githubReady
        })
    })
  ]);
}

export async function refreshContributorsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ContributorsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;

  try {
    await queryClient.fetchQuery({
      queryKey: contributorsTabQueryKey(owner, repo, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listContributorsWithStatus({
          owner,
          repo,
          limit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    });
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}

function firstVisibleContributorLogin(
  contributors: ContributorSummary[],
  focusedContributorLogin: string | null
): string | null {
  if (
    focusedContributorLogin &&
    contributors.some((contributor) => contributor.login === focusedContributorLogin)
  ) {
    return focusedContributorLogin;
  }
  return contributors[0]?.login ?? null;
}
