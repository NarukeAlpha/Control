import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  BranchProtectionResult,
  RepositoryAccessResult,
  RepositoryForksResult,
  RepositoryRulesetsResult
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import {
  repositoryBranchProtectionBranchFor,
  repositoryBranchProtectionQueryKey,
  repositoryRulesetsQueryKey
} from "@renderer/components/repository/repositoryAdminQueryKeys";
import { useControlApi } from "@renderer/hooks/useControlApi";
import { refreshRepositoryRefsData, useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

export interface RepositorySettingsTabQueryInput {
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch: string | null;
  refListLimit: number;
  repositoryAccessLimit: number;
  forksLimit: number;
  repositoryRulesetsLimit: number;
  enabled: boolean;
  githubReady: boolean;
}

interface RepositorySettingsTabRefreshInput {
  api: ControlApi;
  owner: string;
  repo: string;
  branchProtectionBranch: string | null;
  repositoryAccessLimit: number;
  forksLimit: number;
  repositoryRulesetsLimit: number;
  githubReady: boolean;
  refListLimit: number;
}

export function repositoryAccessQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["repository-access", string, string, number] {
  return ["repository-access", owner, repo, limit] as const;
}

export function repositoryForksQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["repository-forks", string, string, number] {
  return ["repository-forks", owner, repo, limit] as const;
}

export function useRepositorySettingsTabQueries({
  owner,
  repo,
  selectedRef,
  defaultBranch,
  refListLimit,
  repositoryAccessLimit,
  forksLimit,
  repositoryRulesetsLimit,
  enabled,
  githubReady
}: RepositorySettingsTabQueryInput) {
  const api = useControlApi();
  const refs = useRepositoryRefs(owner, repo, { branches: enabled, tags: false }, refListLimit, {
    githubReady
  });
  const branchProtectionBranch = repositoryBranchProtectionBranchFor(
    selectedRef,
    refs.branchItems,
    defaultBranch
  );

  const branchProtection = useQuery<BranchProtectionResult>({
    queryKey: repositoryBranchProtectionQueryKey(owner, repo, branchProtectionBranch),
    queryFn: () =>
      api.github.getBranchProtection({
        owner,
        repo,
        branch: branchProtectionBranch!,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(branchProtectionBranch),
    staleTime: 60_000
  });

  const repositoryRulesets = useQuery<RepositoryRulesetsResult>({
    queryKey: repositoryRulesetsQueryKey(owner, repo, repositoryRulesetsLimit),
    queryFn: () =>
      api.github.listRepositoryRulesets({
        owner,
        repo,
        includesParents: true,
        limit: repositoryRulesetsLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const repositoryAccess = useQuery<RepositoryAccessResult>({
    queryKey: repositoryAccessQueryKey(owner, repo, repositoryAccessLimit),
    queryFn: () =>
      api.github.getRepositoryAccess({ owner, repo, limit: repositoryAccessLimit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  const repositoryForks = useQuery<RepositoryForksResult>({
    queryKey: repositoryForksQueryKey(owner, repo, forksLimit),
    queryFn: () =>
      api.github.listRepositoryForks({
        owner,
        repo,
        sort: "stargazers",
        limit: forksLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 120_000
  });

  return {
    branches: refs.branchItems,
    branchesError: refs.branches.error,
    branchProtectionBranch,
    branchProtection,
    repositoryRulesets,
    repositoryAccess,
    repositoryForks
  };
}

export async function refreshRepositorySettingsTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    branchProtectionBranch,
    refListLimit,
    repositoryAccessLimit,
    forksLimit,
    repositoryRulesetsLimit,
    githubReady
  }: RepositorySettingsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const refreshes: Array<Promise<unknown>> = [
    refreshRepositoryRefsData(queryClient, {
      api,
      owner,
      repo,
      limit: refListLimit,
      githubReady,
      include: { branches: true, tags: false }
    }),
    queryClient.fetchQuery({
      queryKey: repositoryRulesetsQueryKey(owner, repo, repositoryRulesetsLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listRepositoryRulesets({
          owner,
          repo,
          includesParents: true,
          limit: repositoryRulesetsLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: repositoryAccessQueryKey(owner, repo, repositoryAccessLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.getRepositoryAccess({
          owner,
          repo,
          limit: repositoryAccessLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: repositoryForksQueryKey(owner, repo, forksLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listRepositoryForks({
          owner,
          repo,
          sort: "stargazers",
          limit: forksLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    })
  ];

  if (branchProtectionBranch) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: repositoryBranchProtectionQueryKey(owner, repo, branchProtectionBranch),
        staleTime: 0,
        queryFn: () =>
          api.github.getBranchProtection({
            owner,
            repo,
            branch: branchProtectionBranch,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );
  }

  try {
    await Promise.all(refreshes);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
