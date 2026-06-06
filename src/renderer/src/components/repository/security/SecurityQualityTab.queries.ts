import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  BranchProtectionResult,
  CodeScanningAlertsInput,
  CodeScanningAlertsResult,
  DependabotAlertsInput,
  DependabotAlertsResult,
  RepositoryCommunityProfileResult,
  RepositoryRulesetsResult,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityPolicyResult,
  SecretScanningAlertsInput,
  SecretScanningAlertsResult
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import {
  repositoryBranchProtectionBranchFor,
  repositoryBranchProtectionQueryKey,
  repositoryRulesetsQueryKey
} from "@renderer/components/repository/repositoryAdminQueryKeys";
import { useControlApi } from "@renderer/hooks/useControlApi";
import { useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

export type DependabotAlertStateFilter = Extract<
  NonNullable<DependabotAlertsInput["state"]>,
  "open" | "dismissed" | "fixed"
>;
export type CodeScanningAlertStateFilter = NonNullable<CodeScanningAlertsInput["state"]>;
export type SecretScanningAlertStateFilter = NonNullable<SecretScanningAlertsInput["state"]>;

export const defaultDependabotAlertStateFilter: DependabotAlertStateFilter = "open";
export const defaultCodeScanningAlertStateFilter: CodeScanningAlertStateFilter = "open";
export const defaultSecretScanningAlertStateFilter: SecretScanningAlertStateFilter = "open";

export const dependabotAlertStateFilterOptions: Array<{
  value: DependabotAlertStateFilter;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "dismissed", label: "Dismissed" },
  { value: "fixed", label: "Fixed" }
];

export const codeScanningAlertStateFilterOptions: Array<{
  value: CodeScanningAlertStateFilter;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "dismissed", label: "Dismissed" },
  { value: "fixed", label: "Fixed" }
];

export const secretScanningAlertStateFilterOptions: Array<{
  value: SecretScanningAlertStateFilter;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" }
];

export function securityAlertStateFilterLabel(
  state: DependabotAlertStateFilter | CodeScanningAlertStateFilter | SecretScanningAlertStateFilter
): string {
  return (
    dependabotAlertStateFilterOptions.find((option) => option.value === state)?.label ??
    secretScanningAlertStateFilterOptions.find((option) => option.value === state)?.label ??
    state
  );
}

export interface SecurityQualityTabQueryInput {
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch: string | null;
  refListLimit: number;
  dependabotAlertState: DependabotAlertStateFilter;
  dependabotAlertsLimit: number;
  codeScanningAlertState: CodeScanningAlertStateFilter;
  codeScanningAlertsLimit: number;
  secretScanningAlertState: SecretScanningAlertStateFilter;
  secretScanningAlertsLimit: number;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  enabled: boolean;
  githubReady: boolean;
}

interface SecurityQualityTabRefreshInput {
  api: ControlApi;
  owner: string;
  repo: string;
  branchProtectionBranch: string | null;
  defaultBranch: string | null;
  dependabotAlertState: DependabotAlertStateFilter;
  dependabotAlertsLimit: number;
  codeScanningAlertState: CodeScanningAlertStateFilter;
  codeScanningAlertsLimit: number;
  secretScanningAlertState: SecretScanningAlertStateFilter;
  secretScanningAlertsLimit: number;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  githubReady: boolean;
}

export function dependabotAlertsQueryKey(
  owner: string,
  repo: string,
  state: DependabotAlertStateFilter,
  limit: number
): readonly ["dependabot-alerts", string, string, DependabotAlertStateFilter, number] {
  return ["dependabot-alerts", owner, repo, state, limit] as const;
}

export function codeScanningAlertsQueryKey(
  owner: string,
  repo: string,
  state: CodeScanningAlertStateFilter,
  limit: number
): readonly ["code-scanning-alerts", string, string, CodeScanningAlertStateFilter, number] {
  return ["code-scanning-alerts", owner, repo, state, limit] as const;
}

export function secretScanningAlertsQueryKey(
  owner: string,
  repo: string,
  state: SecretScanningAlertStateFilter,
  limit: number
): readonly ["secret-scanning-alerts", string, string, SecretScanningAlertStateFilter, number] {
  return ["secret-scanning-alerts", owner, repo, state, limit] as const;
}

export function repositorySecurityAdvisoriesQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["repository-security-advisories", string, string, number] {
  return ["repository-security-advisories", owner, repo, limit] as const;
}

export function repositorySecurityPolicyQueryKey(
  owner: string,
  repo: string,
  defaultBranch: string | null
): readonly ["repository-security-policy", string, string, string] {
  return ["repository-security-policy", owner, repo, defaultBranch ?? "none"] as const;
}

export function repositoryCommunityProfileQueryKey(
  owner: string,
  repo: string
): readonly ["repository-community-profile", string, string] {
  return ["repository-community-profile", owner, repo] as const;
}

export function useSecurityQualityTabQueries({
  owner,
  repo,
  selectedRef,
  defaultBranch,
  refListLimit,
  dependabotAlertState,
  dependabotAlertsLimit,
  codeScanningAlertState,
  codeScanningAlertsLimit,
  secretScanningAlertState,
  secretScanningAlertsLimit,
  repositoryRulesetsLimit,
  repositorySecurityAdvisoriesLimit,
  enabled,
  githubReady
}: SecurityQualityTabQueryInput) {
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

  const dependabotAlerts = useQuery<DependabotAlertsResult>({
    queryKey: dependabotAlertsQueryKey(owner, repo, dependabotAlertState, dependabotAlertsLimit),
    queryFn: () =>
      api.github.listDependabotAlerts({
        owner,
        repo,
        state: dependabotAlertState,
        limit: dependabotAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const codeScanningAlerts = useQuery<CodeScanningAlertsResult>({
    queryKey: codeScanningAlertsQueryKey(owner, repo, codeScanningAlertState, codeScanningAlertsLimit),
    queryFn: () =>
      api.github.listCodeScanningAlerts({
        owner,
        repo,
        state: codeScanningAlertState,
        limit: codeScanningAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const secretScanningAlerts = useQuery<SecretScanningAlertsResult>({
    queryKey: secretScanningAlertsQueryKey(owner, repo, secretScanningAlertState, secretScanningAlertsLimit),
    queryFn: () =>
      api.github.listSecretScanningAlerts({
        owner,
        repo,
        state: secretScanningAlertState,
        limit: secretScanningAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled,
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

  const repositorySecurityAdvisories = useQuery<RepositorySecurityAdvisoriesResult>({
    queryKey: repositorySecurityAdvisoriesQueryKey(owner, repo, repositorySecurityAdvisoriesLimit),
    queryFn: () =>
      api.github.listRepositorySecurityAdvisories({
        owner,
        repo,
        limit: repositorySecurityAdvisoriesLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const repositorySecurityPolicy = useQuery<RepositorySecurityPolicyResult>({
    queryKey: repositorySecurityPolicyQueryKey(owner, repo, defaultBranch),
    queryFn: () =>
      api.github.getRepositorySecurityPolicy({
        owner,
        repo,
        ref: defaultBranch,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(defaultBranch),
    staleTime: 120_000
  });

  const repositoryCommunityProfile = useQuery<RepositoryCommunityProfileResult>({
    queryKey: repositoryCommunityProfileQueryKey(owner, repo),
    queryFn: () => api.github.getRepositoryCommunityProfile({ owner, repo, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  return {
    branchProtectionBranch,
    branchProtectionBranches: refs.branchItems,
    branchProtectionBranchesLoading: refs.branches.isLoading || refs.branches.isFetching,
    branchProtectionBranchesError: refs.branches.error,
    branchProtection,
    dependabotAlerts,
    codeScanningAlerts,
    secretScanningAlerts,
    repositoryRulesets,
    repositorySecurityAdvisories,
    repositorySecurityPolicy,
    repositoryCommunityProfile
  };
}

export async function refreshSecurityQualityTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    branchProtectionBranch,
    defaultBranch,
    dependabotAlertState,
    dependabotAlertsLimit,
    codeScanningAlertState,
    codeScanningAlertsLimit,
    secretScanningAlertState,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    githubReady
  }: SecurityQualityTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const refreshes: Array<Promise<unknown>> = [
    queryClient.fetchQuery({
      queryKey: dependabotAlertsQueryKey(owner, repo, dependabotAlertState, dependabotAlertsLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listDependabotAlerts({
          owner,
          repo,
          state: dependabotAlertState,
          limit: dependabotAlertsLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: codeScanningAlertsQueryKey(owner, repo, codeScanningAlertState, codeScanningAlertsLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listCodeScanningAlerts({
          owner,
          repo,
          state: codeScanningAlertState,
          limit: codeScanningAlertsLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: secretScanningAlertsQueryKey(
        owner,
        repo,
        secretScanningAlertState,
        secretScanningAlertsLimit
      ),
      staleTime: 0,
      queryFn: () =>
        api.github.listSecretScanningAlerts({
          owner,
          repo,
          state: secretScanningAlertState,
          limit: secretScanningAlertsLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
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
      queryKey: repositorySecurityAdvisoriesQueryKey(owner, repo, repositorySecurityAdvisoriesLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listRepositorySecurityAdvisories({
          owner,
          repo,
          limit: repositorySecurityAdvisoriesLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: repositoryCommunityProfileQueryKey(owner, repo),
      staleTime: 0,
      queryFn: () =>
        api.github.getRepositoryCommunityProfile({
          owner,
          repo,
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

  if (defaultBranch) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: repositorySecurityPolicyQueryKey(owner, repo, defaultBranch),
        staleTime: 0,
        queryFn: () =>
          api.github.getRepositorySecurityPolicy({
            owner,
            repo,
            ref: defaultBranch,
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
