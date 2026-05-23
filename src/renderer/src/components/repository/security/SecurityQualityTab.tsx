import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  File as FileIcon,
  Gauge,
  GitBranch,
  Plus,
  ShieldCheck,
  Workflow,
  X
} from "lucide-react";
import { useState, type JSX } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  BranchProtectionResult,
  CodeScanningAlertsResult,
  DependabotAlertsResult,
  GitHubAction,
  GitHubMutationFields,
  RepositoryCommunityProfileResult,
  RepositoryDetail,
  RepositoryRulesetsResult,
  RepositoryRulesetSummary,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityPolicyResult,
  SecretScanningAlertsResult
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import type { LocalRecentSecurityItemKind } from "@shared/local";

import {
  githubActionLabel,
  readAvailabilityMessage,
  readAvailabilityStatusLabel,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";
import {
  repositoryBranchProtectionBranchFor,
  repositoryBranchProtectionQueryKey,
  repositoryRulesetsQueryKey
} from "@renderer/components/repository/repositoryAdminQueryKeys";
import { useControlApi } from "@renderer/hooks/useControlApi";
import { useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";

interface SecurityItemRecentInput {
  kind: LocalRecentSecurityItemKind;
  id: string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  state?: string | null;
  severity?: string | null;
  path?: string | null;
  rule?: string | null;
  packageName?: string | null;
  ghsaId?: string | null;
  cveId?: string | null;
  updatedAt?: string | null;
}
const maxSecurityListLimit = 100;

export interface SecurityQualityTabQueryInput {
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch: string | null;
  refListLimit: number;
  dependabotAlertsLimit: number;
  codeScanningAlertsLimit: number;
  secretScanningAlertsLimit: number;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface SecurityQualityTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  branchProtectionBranch: string | null;
  defaultBranch: string | null;
  dependabotAlertsLimit: number;
  codeScanningAlertsLimit: number;
  secretScanningAlertsLimit: number;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  githubReady: boolean;
}

export type SecurityQualityTabRefreshInput = SecurityQualityTabPrefetchInput;

export function dependabotAlertsQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["dependabot-alerts", string, string, number] {
  return ["dependabot-alerts", owner, repo, limit] as const;
}

export function codeScanningAlertsQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["code-scanning-alerts", string, string, number] {
  return ["code-scanning-alerts", owner, repo, limit] as const;
}

export function secretScanningAlertsQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["secret-scanning-alerts", string, string, number] {
  return ["secret-scanning-alerts", owner, repo, limit] as const;
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
  dependabotAlertsLimit,
  codeScanningAlertsLimit,
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
    queryKey: dependabotAlertsQueryKey(owner, repo, dependabotAlertsLimit),
    queryFn: () =>
      api.github.listDependabotAlerts({
        owner,
        repo,
        state: "open",
        limit: dependabotAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const codeScanningAlerts = useQuery<CodeScanningAlertsResult>({
    queryKey: codeScanningAlertsQueryKey(owner, repo, codeScanningAlertsLimit),
    queryFn: () =>
      api.github.listCodeScanningAlerts({
        owner,
        repo,
        state: "open",
        limit: codeScanningAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const secretScanningAlerts = useQuery<SecretScanningAlertsResult>({
    queryKey: secretScanningAlertsQueryKey(owner, repo, secretScanningAlertsLimit),
    queryFn: () =>
      api.github.listSecretScanningAlerts({
        owner,
        repo,
        state: "open",
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

export async function prefetchSecurityQualityTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    branchProtectionBranch,
    defaultBranch,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    githubReady
  }: SecurityQualityTabPrefetchInput
): Promise<void> {
  await Promise.all([
    branchProtectionBranch
      ? queryClient.prefetchQuery({
          queryKey: repositoryBranchProtectionQueryKey(owner, repo, branchProtectionBranch),
          queryFn: () =>
            api.github.getBranchProtection({
              owner,
              repo,
              branch: branchProtectionBranch,
              cacheOnly: !githubReady
            }),
          staleTime: 60_000
        })
      : Promise.resolve(),
    queryClient.prefetchQuery({
      queryKey: dependabotAlertsQueryKey(owner, repo, dependabotAlertsLimit),
      queryFn: () =>
        api.github.listDependabotAlerts({
          owner,
          repo,
          state: "open",
          limit: dependabotAlertsLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: codeScanningAlertsQueryKey(owner, repo, codeScanningAlertsLimit),
      queryFn: () =>
        api.github.listCodeScanningAlerts({
          owner,
          repo,
          state: "open",
          limit: codeScanningAlertsLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: secretScanningAlertsQueryKey(owner, repo, secretScanningAlertsLimit),
      queryFn: () =>
        api.github.listSecretScanningAlerts({
          owner,
          repo,
          state: "open",
          limit: secretScanningAlertsLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryRulesetsQueryKey(owner, repo, repositoryRulesetsLimit),
      queryFn: () =>
        api.github.listRepositoryRulesets({
          owner,
          repo,
          includesParents: true,
          limit: repositoryRulesetsLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositorySecurityAdvisoriesQueryKey(owner, repo, repositorySecurityAdvisoriesLimit),
      queryFn: () =>
        api.github.listRepositorySecurityAdvisories({
          owner,
          repo,
          limit: repositorySecurityAdvisoriesLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    defaultBranch
      ? queryClient.prefetchQuery({
          queryKey: repositorySecurityPolicyQueryKey(owner, repo, defaultBranch),
          queryFn: () =>
            api.github.getRepositorySecurityPolicy({
              owner,
              repo,
              ref: defaultBranch,
              cacheOnly: !githubReady
            }),
          staleTime: 120_000
        })
      : Promise.resolve(),
    queryClient.prefetchQuery({
      queryKey: repositoryCommunityProfileQueryKey(owner, repo),
      queryFn: () => api.github.getRepositoryCommunityProfile({ owner, repo, cacheOnly: !githubReady }),
      staleTime: 120_000
    })
  ]);
}

export async function refreshSecurityQualityTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    branchProtectionBranch,
    defaultBranch,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    githubReady
  }: SecurityQualityTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const refreshes: Array<Promise<unknown>> = [
    queryClient.fetchQuery({
      queryKey: dependabotAlertsQueryKey(owner, repo, dependabotAlertsLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listDependabotAlerts({
          owner,
          repo,
          state: "open",
          limit: dependabotAlertsLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: codeScanningAlertsQueryKey(owner, repo, codeScanningAlertsLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listCodeScanningAlerts({
          owner,
          repo,
          state: "open",
          limit: codeScanningAlertsLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    queryClient.fetchQuery({
      queryKey: secretScanningAlertsQueryKey(owner, repo, secretScanningAlertsLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listSecretScanningAlerts({
          owner,
          repo,
          state: "open",
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

function normalizeGitHubCodeRef(ref: string | null | undefined): string | null {
  const trimmedRef = ref?.trim();
  if (!trimmedRef) {
    return null;
  }

  return trimmedRef.replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "");
}

function settingStateLabel(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Enabled" : "Disabled";
}

function securityFeatureStatusLabel(value: string | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value.replace(/[_-]/g, " ");
}

function repositorySecurityFeatureRows(
  securityAndAnalysis: RepositoryDetail["administration"]["securityAndAnalysis"]
): Array<[string, string | null]> {
  return [
    ["Advanced Security", securityAndAnalysis.advancedSecurity],
    ["Code security", securityAndAnalysis.codeSecurity],
    ["Dependabot alerts", securityAndAnalysis.dependabotAlerts],
    ["Dependabot security updates", securityAndAnalysis.dependabotSecurityUpdates],
    ["Secret scanning", securityAndAnalysis.secretScanning],
    ["Push protection", securityAndAnalysis.secretScanningPushProtection],
    ["Non-provider patterns", securityAndAnalysis.secretScanningNonProviderPatterns],
    ["Validity checks", securityAndAnalysis.secretScanningValidityChecks],
    ["AI detection", securityAndAnalysis.secretScanningAiDetection]
  ];
}

function accessRoleLabel(role: string | null): string {
  return role ? role.replace(/[_-]/g, " ") : "access";
}

function rulesetConditionLabel(condition: RepositoryRulesetSummary["conditions"][number]): string {
  const refDetails = [
    ...condition.include.map((ref) => `include ${ref}`),
    ...condition.exclude.map((ref) => `exclude ${ref}`)
  ];
  return rulesetPartLabel(condition.type, [...refDetails, ...condition.parameters]);
}

function rulesetRuleLabel(rule: RepositoryRulesetSummary["rules"][number]): string {
  return rulesetPartLabel(rule.type, rule.parameters);
}

function rulesetBypassActorLabel(actor: RepositoryRulesetSummary["bypassActors"][number]): string {
  const actorName = [actor.actorType, actor.actorId === null ? null : `#${actor.actorId}`]
    .filter(Boolean)
    .join(" ");
  const bypassMode = actor.bypassMode ? `via ${accessRoleLabel(actor.bypassMode)}` : null;
  return [actorName || "Unknown bypass actor", bypassMode].filter(Boolean).join(" ");
}

function rulesetPartLabel(name: string, details: string[]): string {
  const label = accessRoleLabel(name);
  const visibleDetails = details.filter(Boolean).slice(0, 3);
  return visibleDetails.length > 0 ? `${label}: ${visibleDetails.join(", ")}` : label;
}

export function SecurityQualityTab({
  repository,
  selectedRef,
  refListLimit,
  dependabotAlertsLimit,
  codeScanningAlertsLimit,
  secretScanningAlertsLimit,
  repositoryRulesetsLimit,
  repositorySecurityAdvisoriesLimit,
  githubReady,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  focusedSecurityItemKind,
  focusedSecurityItemId,
  onOpenExternal,
  onOpenCodePath,
  onSelectSecurityItem,
  onSelectSecurityQualityBranch,
  onExpandDependabotAlerts,
  onExpandCodeScanningAlerts,
  onExpandSecretScanningAlerts,
  onExpandRepositoryRulesets,
  onExpandRepositorySecurityAdvisories,
  onMutate
}: {
  repository: RepositoryDetail;
  selectedRef: string | null;
  refListLimit: number;
  dependabotAlertsLimit: number;
  codeScanningAlertsLimit: number;
  secretScanningAlertsLimit: number;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  githubReady: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  focusedSecurityItemKind: LocalRecentSecurityItemKind | null;
  focusedSecurityItemId: string | null;
  onOpenExternal(url: string): void;
  onOpenCodePath(path: string, ref: string | null, line?: number | null): void;
  onSelectSecurityItem(securityItem: SecurityItemRecentInput): void;
  onSelectSecurityQualityBranch(ref: string): void;
  onExpandDependabotAlerts(): void;
  onExpandCodeScanningAlerts(): void;
  onExpandSecretScanningAlerts(): void;
  onExpandRepositoryRulesets(): void;
  onExpandRepositorySecurityAdvisories(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const {
    branchProtectionBranch,
    branchProtectionBranches,
    branchProtectionBranchesLoading,
    branchProtectionBranchesError,
    branchProtection: branchProtectionQuery,
    dependabotAlerts: dependabotAlertsQuery,
    codeScanningAlerts: codeScanningAlertsQuery,
    secretScanningAlerts: secretScanningAlertsQuery,
    repositoryRulesets: repositoryRulesetsQuery,
    repositorySecurityAdvisories: repositorySecurityAdvisoriesQuery,
    repositorySecurityPolicy: repositorySecurityPolicyQuery,
    repositoryCommunityProfile: repositoryCommunityProfileQuery
  } = useSecurityQualityTabQueries({
    owner: repository.owner,
    repo: repository.name,
    selectedRef,
    defaultBranch: repository.defaultBranch ?? null,
    refListLimit,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    enabled: true,
    githubReady
  });
  const branchProtection = branchProtectionQuery.data ?? null;
  const protection = branchProtection?.protection ?? null;
  const branchProtectionLoading = branchProtectionQuery.isLoading || branchProtectionQuery.isFetching;
  const branchProtectionError = branchProtectionQuery.error;
  const dependabotAlerts = dependabotAlertsQuery.data?.items ?? [];
  const dependabotAlertsLoading = dependabotAlertsQuery.isLoading || dependabotAlertsQuery.isFetching;
  const dependabotAlertsAvailability = dependabotAlertsQuery.data?.availability ?? null;
  const dependabotAlertsError = dependabotAlertsQuery.error;
  const codeScanningAlerts = codeScanningAlertsQuery.data?.items ?? [];
  const codeScanningAlertsLoading = codeScanningAlertsQuery.isLoading || codeScanningAlertsQuery.isFetching;
  const codeScanningAlertsAvailability = codeScanningAlertsQuery.data?.availability ?? null;
  const codeScanningAlertsError = codeScanningAlertsQuery.error;
  const secretScanningAlerts = secretScanningAlertsQuery.data?.items ?? [];
  const secretScanningAlertsLoading =
    secretScanningAlertsQuery.isLoading || secretScanningAlertsQuery.isFetching;
  const secretScanningAlertsAvailability = secretScanningAlertsQuery.data?.availability ?? null;
  const secretScanningAlertsError = secretScanningAlertsQuery.error;
  const repositoryRulesets = repositoryRulesetsQuery.data?.items ?? [];
  const repositoryRulesetsLoading = repositoryRulesetsQuery.isLoading || repositoryRulesetsQuery.isFetching;
  const repositoryRulesetsAvailability = repositoryRulesetsQuery.data?.availability ?? null;
  const repositoryRulesetsError = repositoryRulesetsQuery.error;
  const repositorySecurityAdvisories = repositorySecurityAdvisoriesQuery.data?.items ?? [];
  const repositorySecurityAdvisoriesLoading =
    repositorySecurityAdvisoriesQuery.isLoading || repositorySecurityAdvisoriesQuery.isFetching;
  const repositorySecurityAdvisoriesAvailability =
    repositorySecurityAdvisoriesQuery.data?.availability ?? null;
  const repositorySecurityAdvisoriesError = repositorySecurityAdvisoriesQuery.error;
  const repositorySecurityPolicy = repositorySecurityPolicyQuery.data ?? null;
  const repositorySecurityPolicyLoading =
    repositorySecurityPolicyQuery.isLoading || repositorySecurityPolicyQuery.isFetching;
  const repositorySecurityPolicyError = repositorySecurityPolicyQuery.error;
  const repositoryCommunityProfile = repositoryCommunityProfileQuery.data?.profile ?? null;
  const repositoryCommunityProfileLoading =
    repositoryCommunityProfileQuery.isLoading || repositoryCommunityProfileQuery.isFetching;
  const repositoryCommunityProfileAvailability = repositoryCommunityProfileQuery.data?.availability ?? null;
  const repositoryCommunityProfileError = repositoryCommunityProfileQuery.error;
  const availabilityMessage = readAvailabilityMessage(
    "Branch protection",
    branchProtection?.availability ?? null
  );
  const branchProtectionAvailabilityLabel = readAvailabilityStatusLabel(
    branchProtection?.availability ?? null
  );
  const dependabotAvailabilityMessage = readAvailabilityMessage(
    "Dependabot alerts",
    dependabotAlertsAvailability
  );
  const codeScanningAvailabilityMessage = readAvailabilityMessage(
    "Code scanning alerts",
    codeScanningAlertsAvailability
  );
  const secretScanningAvailabilityMessage = readAvailabilityMessage(
    "Secret scanning alerts",
    secretScanningAlertsAvailability
  );
  const repositoryRulesetsAvailabilityMessage = readAvailabilityMessage(
    "Repository rulesets",
    repositoryRulesetsAvailability
  );
  const repositorySecurityAdvisoriesAvailabilityMessage = readAvailabilityMessage(
    "Security advisories",
    repositorySecurityAdvisoriesAvailability
  );
  const repositorySecurityPolicyAvailabilityMessage = readAvailabilityMessage(
    "Security policy",
    repositorySecurityPolicy?.availability ?? null
  );
  const repositorySecurityPolicyAvailabilityLabel = readAvailabilityStatusLabel(
    repositorySecurityPolicy?.availability ?? null
  );
  const securityPolicy = repositorySecurityPolicy?.policy ?? null;
  const securityPolicyPreviewLength = 1200;
  const securityPolicyKey = securityPolicy
    ? `${repository.nameWithOwner}:${securityPolicy.path}:${securityPolicy.ref ?? ""}:${securityPolicy.sha ?? ""}`
    : null;
  const [expandedSecurityPolicyState, setExpandedSecurityPolicyState] = useState({
    policyKey: securityPolicyKey,
    expanded: false
  });
  const securityPolicyExpanded =
    expandedSecurityPolicyState.policyKey === securityPolicyKey
      ? expandedSecurityPolicyState.expanded
      : false;
  const securityPolicyContent = securityPolicy?.content ?? "";
  const securityPolicyHasFullPreview = securityPolicyContent.length > securityPolicyPreviewLength;
  const visibleSecurityPolicyContent = securityPolicyExpanded
    ? securityPolicyContent
    : securityPolicyContent.slice(0, securityPolicyPreviewLength);
  const repositoryCommunityProfileAvailabilityMessage = readAvailabilityMessage(
    "Community profile",
    repositoryCommunityProfileAvailability
  );
  const administrationAvailabilityMessage = readAvailabilityMessage(
    "Repository settings metadata",
    repository.administrationAvailability ?? null
  );
  const administrationAvailabilityLabel = readAvailabilityStatusLabel(
    repository.administrationAvailability ?? null
  );
  const branchProtectionStatusUnavailable =
    Boolean(branchProtectionError) || Boolean(branchProtectionAvailabilityLabel);
  const repositoryRulesetsStatusUnavailable =
    Boolean(repositoryRulesetsError) || Boolean(repositoryRulesetsAvailabilityMessage);
  const repositorySecurityAdvisoriesStatusUnavailable =
    Boolean(repositorySecurityAdvisoriesError) || Boolean(repositorySecurityAdvisoriesAvailabilityMessage);
  const repositorySecurityPolicyStatusUnavailable =
    Boolean(repositorySecurityPolicyError) || Boolean(repositorySecurityPolicyAvailabilityMessage);
  const repositoryCommunityProfileStatusUnavailable =
    Boolean(repositoryCommunityProfileError) || Boolean(repositoryCommunityProfileAvailabilityMessage);
  const dependabotStatusUnavailable =
    Boolean(dependabotAlertsError) || Boolean(dependabotAvailabilityMessage);
  const codeScanningStatusUnavailable =
    Boolean(codeScanningAlertsError) || Boolean(codeScanningAvailabilityMessage);
  const secretScanningStatusUnavailable =
    Boolean(secretScanningAlertsError) || Boolean(secretScanningAvailabilityMessage);
  const branchProtectionStatusLabel =
    branchProtectionLoading && !branchProtection
      ? "loading"
      : branchProtectionError
        ? "unavailable"
        : (branchProtectionAvailabilityLabel ??
          (protection ? "protected" : branchProtection ? "unprotected" : "unknown"));
  const repositoryRulesetsStatusLabel =
    repositoryRulesetsLoading && repositoryRulesets.length === 0
      ? "loading"
      : repositoryRulesetsStatusUnavailable
        ? "unavailable"
        : repositoryRulesets.length === 0
          ? "none"
          : `${repositoryRulesets.length} rulesets`;
  const repositorySecurityAdvisoriesStatusLabel =
    repositorySecurityAdvisoriesLoading && repositorySecurityAdvisories.length === 0
      ? "loading"
      : repositorySecurityAdvisoriesStatusUnavailable
        ? "unavailable"
        : repositorySecurityAdvisories.length === 0
          ? "clear"
          : `${repositorySecurityAdvisories.length} advisories`;
  const repositorySecurityPolicyStatusLabel =
    repositorySecurityPolicyLoading && !repositorySecurityPolicy
      ? "loading"
      : repositorySecurityPolicyError
        ? "unavailable"
        : repositorySecurityPolicyAvailabilityLabel
          ? repositorySecurityPolicyAvailabilityLabel
          : securityPolicy
            ? "found"
            : repositorySecurityPolicy
              ? "not configured"
              : "unknown";
  const presentCommunityFiles =
    repositoryCommunityProfile?.files.filter((file) => file.path || file.htmlUrl) ?? [];
  const missingCommunityFiles =
    repositoryCommunityProfile?.files.filter((file) => !file.path && !file.htmlUrl) ?? [];
  const repositoryCommunityProfileStatusLabel =
    repositoryCommunityProfileLoading && !repositoryCommunityProfile
      ? "loading"
      : repositoryCommunityProfileStatusUnavailable
        ? "unavailable"
        : repositoryCommunityProfile?.healthPercentage != null
          ? `${repositoryCommunityProfile.healthPercentage}%`
          : "unknown";
  const dependabotStatusLabel =
    dependabotAlertsLoading && dependabotAlerts.length === 0
      ? "loading"
      : dependabotStatusUnavailable
        ? "unavailable"
        : dependabotAlerts.length === 0
          ? "clear"
          : `${dependabotAlerts.length} open`;
  const codeScanningStatusLabel =
    codeScanningAlertsLoading && codeScanningAlerts.length === 0
      ? "loading"
      : codeScanningStatusUnavailable
        ? "unavailable"
        : codeScanningAlerts.length === 0
          ? "clear"
          : `${codeScanningAlerts.length} open`;
  const secretScanningStatusLabel =
    secretScanningAlertsLoading && secretScanningAlerts.length === 0
      ? "loading"
      : secretScanningStatusUnavailable
        ? "unavailable"
        : secretScanningAlerts.length === 0
          ? "clear"
          : `${secretScanningAlerts.length} open`;
  const securityFeatureRows = repositorySecurityFeatureRows(repository.administration.securityAndAnalysis);
  const qualityLinks = [
    { title: "Security policy", path: "/security/policy", icon: ShieldCheck },
    { title: "Code scanning", path: "/security/code-scanning", icon: Gauge },
    { title: "Dependabot", path: "/security/dependabot", icon: CheckCircle2 },
    { title: "Secret scanning", path: "/security/secret-scanning", icon: ShieldCheck },
    { title: "Rulesets", path: "/rules", icon: GitBranch },
    { title: "Security advisories", path: "/security/advisories", icon: ShieldCheck },
    { title: "Community standards", path: "/community", icon: BookOpen },
    { title: "Pulse", path: "/pulse", icon: Workflow }
  ];
  const defaultSecurityRef = repository.defaultBranch ?? null;
  const branchProtectionBranchLabel = branchProtectionBranch ?? "No branch selected";
  const hasBranchProtectionBranchOption = branchProtectionBranches.some(
    (branch) => branch.name === branchProtectionBranch
  );
  const branchProtectionBranchesDisabled =
    branchProtectionBranchesLoading && branchProtectionBranches.length === 0;
  const branchProtectionBranchesNote = branchProtectionBranchesError
    ? `Branch list unavailable: ${branchProtectionBranchesError.message}`
    : branchProtectionBranchesDisabled
      ? "Loading branches…"
      : branchProtectionBranches.length === 0
        ? "No branch options available."
        : null;
  const securityMutationActionSet = new Set<GitHubAction>([
    "updateBranchProtection",
    "deleteBranchProtection",
    "createRepositoryRuleset",
    "updateRepositoryRuleset",
    "deleteRepositoryRuleset"
  ]);
  const securityMutationRelevant = mutationAction ? securityMutationActionSet.has(mutationAction) : false;
  const securityMutationDisabledReason =
    (!githubReady ? "Sign in with GitHub to change security settings." : null) ??
    (repository.permissions.isArchived ? "Repository is archived." : null) ??
    (repository.permissions.isDisabled ? "Repository is disabled." : null);
  const branchProtectionMutationDisabledReason =
    (mutationPending && securityMutationRelevant ? "A security setting update is still running." : null) ??
    securityMutationDisabledReason ??
    (!branchProtectionBranch ? "Select a branch before changing branch protection." : null);
  const createRulesetDisabledReason =
    (mutationPending && securityMutationRelevant ? "A security setting update is still running." : null) ??
    securityMutationDisabledReason ??
    (!defaultSecurityRef ? "Repository default branch is unavailable." : null);

  function openSecurityPath(path: string | null, ref: string | null | undefined, line?: number | null): void {
    if (!path) {
      return;
    }

    onOpenCodePath(path, normalizeGitHubCodeRef(ref) ?? defaultSecurityRef, line);
  }

  function securityPathDisabledReason(path: string | null, label: string): string | null {
    return path ? null : `${label} path unavailable from GitHub.`;
  }

  function securityItemActive(kind: LocalRecentSecurityItemKind, id: string | number): boolean {
    return focusedSecurityItemKind === kind && focusedSecurityItemId === String(id);
  }

  function baselineBranchProtectionPayload(branch: string): GitHubMutationFields {
    return {
      branch,
      required_status_checks: null,
      enforce_admins: true,
      required_pull_request_reviews: {
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false,
        required_approving_review_count: 1
      },
      restrictions: null,
      required_linear_history: true,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: true,
      lock_branch: false,
      allow_fork_syncing: false
    };
  }

  function baselineRepositoryRulesetPayload(
    name: string,
    enforcement: "active" | "evaluate",
    rulesetId?: number
  ): GitHubMutationFields {
    const ref = defaultSecurityRef ?? branchProtectionBranch;
    return {
      ...(rulesetId === undefined ? {} : { rulesetId }),
      name,
      target: "branch",
      enforcement,
      bypass_actors: [],
      conditions: {
        ref_name: {
          include: ref ? [`refs/heads/${ref}`] : ["~DEFAULT_BRANCH"],
          exclude: []
        }
      },
      rules: [
        { type: "deletion" },
        { type: "non_fast_forward" },
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 1,
            dismiss_stale_reviews_on_push: true,
            require_code_owner_review: false,
            require_last_push_approval: false,
            required_review_thread_resolution: true
          }
        }
      ]
    };
  }

  function rulesetMutationDisabledReason(ruleset: RepositoryRulesetSummary): string | null {
    if (mutationPending && securityMutationRelevant) {
      return "A security setting update is still running.";
    }
    if (securityMutationDisabledReason) {
      return securityMutationDisabledReason;
    }
    if (ruleset.sourceType && ruleset.sourceType.toLowerCase() !== "repository") {
      return "Inherited rulesets must be changed in their source repository or organization.";
    }
    return null;
  }

  function renderSecurityListDepthControl(
    count: number,
    limit: number,
    loadMoreLabel: string,
    maxNote: string,
    onExpand: () => void
  ): JSX.Element | null {
    if (count < limit) {
      return null;
    }

    if (limit < maxSecurityListLimit) {
      return (
        <div className="table-action-row">
          <button type="button" onClick={onExpand}>
            <ChevronDown size={16} /> {loadMoreLabel}
          </button>
        </div>
      );
    }

    return <div className="muted-row">{maxNote}</div>;
  }

  return (
    <section className="table-panel github-surface security-quality-panel">
      <div className="table-action-row">
        <label className="ref-picker">
          <GitBranch size={16} />
          <select
            aria-label="Branch protection branch"
            disabled={branchProtectionBranchesDisabled || branchProtectionBranches.length === 0}
            value={branchProtectionBranch ?? ""}
            onChange={(event) => {
              const ref = event.currentTarget.value;
              if (ref) {
                onSelectSecurityQualityBranch(ref);
              }
            }}
          >
            {branchProtectionBranch && !hasBranchProtectionBranchOption && (
              <option value={branchProtectionBranch}>{branchProtectionBranch}</option>
            )}
            {!branchProtectionBranch && <option value="">No branch selected</option>}
            {branchProtectionBranches.map((branch) => (
              <option key={`security-quality-branch-${branch.name}`} value={branch.name}>
                {branch.name}
                {branch.protected ? " (protected)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <button
          type="button"
          onClick={() => onOpenExternal(repositoryPath(repository, "/settings/branches"))}
        >
          <ExternalLink size={16} /> Branch rules fallback
        </button>
        {branchProtectionBranchesNote && (
          <small className="action-disabled-note">{branchProtectionBranchesNote}</small>
        )}
      </div>
      <section className="security-protection-summary" aria-label="Branch protection">
        <header>
          <div>
            <h2>Branch protection</h2>
            <small>{branchProtectionBranchLabel}</small>
          </div>
          <span
            className={`state-chip ${
              branchProtectionStatusUnavailable ? "attention" : protection ? "success" : ""
            }`}
          >
            {branchProtectionStatusLabel}
          </span>
        </header>
        {branchProtectionLoading && !branchProtection && (
          <div className="loading-state">Loading branch protection…</div>
        )}
        {branchProtectionError && (
          <div className="error-state">Branch protection unavailable: {branchProtectionError.message}</div>
        )}
        {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
        {securityMutationRelevant && mutationPending && (
          <div className="loading-state" role="status">
            Running security action: {githubActionLabel(mutationAction)}.
          </div>
        )}
        {securityMutationRelevant && !mutationPending && mutationSucceeded && (
          <div className="success-state" role="status">
            Security action completed: {githubActionLabel(mutationAction)}.
          </div>
        )}
        {securityMutationRelevant && !mutationPending && mutationError && (
          <div className="error-state" role="alert">
            Security action failed: {githubActionLabel(mutationAction)}. {mutationError.message}
          </div>
        )}
        <div className="security-management-actions">
          <button
            type="button"
            disabled={Boolean(branchProtectionMutationDisabledReason)}
            title={branchProtectionMutationDisabledReason ?? undefined}
            onClick={() => {
              if (branchProtectionBranch) {
                onMutate(
                  "updateBranchProtection",
                  false,
                  baselineBranchProtectionPayload(branchProtectionBranch)
                );
              }
            }}
          >
            <ShieldCheck size={15} /> Apply baseline protection
          </button>
          <button
            type="button"
            disabled={Boolean(branchProtectionMutationDisabledReason) || !protection}
            title={
              branchProtectionMutationDisabledReason ??
              (!protection ? "No branch protection is configured for this branch." : undefined)
            }
            onClick={() => {
              if (branchProtectionBranch) {
                onMutate("deleteBranchProtection", true, { branch: branchProtectionBranch });
              }
            }}
          >
            <X size={15} /> Delete protection
          </button>
          <button
            type="button"
            onClick={() => onOpenExternal(repositoryPath(repository, "/settings/branches"))}
          >
            <ExternalLink size={15} /> GitHub fallback
          </button>
        </div>
        {protection && (
          <div className="insight-grid">
            <article className="metric-tile">
              <strong>{formatCompactNumber(protection.requiredStatusCheckContexts.length)}</strong>
              <small>Required checks</small>
              <span>{protection.requiredStatusCheckEnforcementLevel ?? "No enforcement level"}</span>
            </article>
            <article className="metric-tile">
              <strong>{protection.requiredApprovingReviewCount ?? 0}</strong>
              <small>Required approvals</small>
              <span>
                {protection.requireCodeOwnerReviews ? "Code owners required" : "Code owners optional"}
              </span>
            </article>
            <article className="metric-tile">
              <strong>{settingStateLabel(protection.enforceAdmins)}</strong>
              <small>Admin enforcement</small>
              <span>
                {protection.dismissStaleReviews ? "Dismisses stale reviews" : "Keeps stale reviews"}
              </span>
            </article>
            <article className="metric-tile">
              <strong>{protection.restrictsPushes ? "Restricted" : "Unrestricted"}</strong>
              <small>Push access</small>
              <span>
                {formatCompactNumber(protection.restrictionUserCount ?? 0)} users ·{" "}
                {formatCompactNumber(protection.restrictionTeamCount ?? 0)} teams ·{" "}
                {formatCompactNumber(protection.restrictionAppCount ?? 0)} apps
              </span>
            </article>
          </div>
        )}
        {protection && protection.requiredStatusCheckContexts.length > 0 && (
          <div className="label-stack branch-protection-checks">
            {protection.requiredStatusCheckContexts.map((context) => (
              <span key={context}>{context}</span>
            ))}
          </div>
        )}
        {protection && (
          <div className="workflow-summary branch-protection-flags">
            <span>Linear history: {settingStateLabel(protection.requiredLinearHistory)}</span>
            <span>
              Conversation resolution: {settingStateLabel(protection.requiredConversationResolution)}
            </span>
            <span>Force pushes: {settingStateLabel(protection.allowForcePushes)}</span>
            <span>Branch deletion: {settingStateLabel(protection.allowDeletions)}</span>
            {protection.requireLastPushApproval !== null && (
              <span>Last push approval: {settingStateLabel(protection.requireLastPushApproval)}</span>
            )}
            {protection.lockBranch !== null && (
              <span>Lock branch: {settingStateLabel(protection.lockBranch)}</span>
            )}
            {protection.allowForkSyncing !== null && (
              <span>Fork syncing: {settingStateLabel(protection.allowForkSyncing)}</span>
            )}
          </div>
        )}
        {!branchProtectionLoading && !branchProtectionError && !availabilityMessage && !protection && (
          <div className="empty-state">No branch protection data returned.</div>
        )}
      </section>
      <section className="security-protection-summary" aria-label="Repository rulesets">
        <header>
          <div>
            <h2>Repository rulesets</h2>
            <small>Branch and tag rules returned by GitHub, including inherited rules when visible.</small>
          </div>
          <span
            className={`state-chip ${
              repositoryRulesetsStatusUnavailable
                ? "attention"
                : repositoryRulesets.length === 0
                  ? ""
                  : "success"
            }`}
          >
            {repositoryRulesetsStatusLabel}
          </span>
        </header>
        {repositoryRulesetsLoading && repositoryRulesets.length === 0 && (
          <div className="loading-state">Loading repository rulesets…</div>
        )}
        {repositoryRulesetsError && (
          <div className="error-state">
            Repository rulesets unavailable: {repositoryRulesetsError.message}
          </div>
        )}
        {repositoryRulesetsAvailabilityMessage && (
          <div className="error-state">{repositoryRulesetsAvailabilityMessage}</div>
        )}
        <div className="security-management-actions">
          <button
            type="button"
            disabled={Boolean(createRulesetDisabledReason)}
            title={createRulesetDisabledReason ?? undefined}
            onClick={() =>
              onMutate(
                "createRepositoryRuleset",
                false,
                baselineRepositoryRulesetPayload("Baseline branch rules", "active")
              )
            }
          >
            <Plus size={15} /> Create baseline ruleset
          </button>
          <button
            type="button"
            disabled={Boolean(createRulesetDisabledReason)}
            title={createRulesetDisabledReason ?? undefined}
            onClick={() =>
              onMutate(
                "createRepositoryRuleset",
                false,
                baselineRepositoryRulesetPayload("Evaluate baseline branch rules", "evaluate")
              )
            }
          >
            <ShieldCheck size={15} /> Create evaluate ruleset
          </button>
          <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/rules"))}>
            <ExternalLink size={15} /> Rulesets fallback
          </button>
        </div>
        {!repositoryRulesetsLoading &&
          !repositoryRulesetsError &&
          !repositoryRulesetsAvailabilityMessage &&
          repositoryRulesets.length === 0 && (
            <div className="empty-state">No repository rulesets returned.</div>
          )}
        {renderSecurityListDepthControl(
          repositoryRulesets.length,
          repositoryRulesetsLimit,
          "Load more rulesets",
          `Showing the first ${repositoryRulesetsLimit} repository rulesets returned by GitHub.`,
          onExpandRepositoryRulesets
        )}
        {repositoryRulesets.length > 0 && (
          <div className="workflow-detail-grid">
            {repositoryRulesets.map((ruleset) => (
              <article
                className={`workflow-job-card ${securityItemActive("ruleset", ruleset.id) ? "active" : ""}`}
                key={ruleset.id}
              >
                <header>
                  <strong>{ruleset.name}</strong>
                  <span className="state-chip">{ruleset.enforcement ?? "unknown"}</span>
                </header>
                <small>
                  {ruleset.target ?? "target unknown"} · {ruleset.sourceType ?? "source"}{" "}
                  {ruleset.source ? `from ${ruleset.source}` : ""}
                </small>
                <div className="workflow-summary branch-protection-flags">
                  <span>{formatCompactNumber(ruleset.ruleCount ?? 0)} rules</span>
                  <span>{formatCompactNumber(ruleset.conditionCount ?? 0)} conditions</span>
                  <span>{formatCompactNumber(ruleset.bypassActorCount ?? 0)} bypass actors</span>
                  <span>Bypass: {accessRoleLabel(ruleset.currentUserCanBypass)}</span>
                </div>
                {(ruleset.rules.length > 0 ||
                  ruleset.conditions.length > 0 ||
                  ruleset.bypassActors.length > 0) && (
                  <div className="ruleset-detail-list" aria-label={`${ruleset.name} ruleset details`}>
                    {ruleset.rules.slice(0, 4).map((rule) => (
                      <span key={`rule-${rule.type}-${rule.parameters.join("|")}`}>
                        <strong>Rule</strong> {rulesetRuleLabel(rule)}
                      </span>
                    ))}
                    {ruleset.conditions.slice(0, 3).map((condition) => (
                      <span
                        key={`condition-${condition.type}-${condition.include.join("|")}-${condition.exclude.join("|")}-${condition.parameters.join("|")}`}
                      >
                        <strong>Condition</strong> {rulesetConditionLabel(condition)}
                      </span>
                    ))}
                    {ruleset.bypassActors.slice(0, 3).map((actor) => (
                      <span
                        key={`bypass-${actor.actorType ?? "actor"}-${actor.actorId ?? "unknown"}-${actor.bypassMode ?? "mode"}`}
                      >
                        <strong>Bypass</strong> {rulesetBypassActorLabel(actor)}
                      </span>
                    ))}
                  </div>
                )}
                <small>
                  {ruleset.updatedAt ? `Updated ${formatRelativeDate(ruleset.updatedAt)}` : "No update time"}
                </small>
                <div>
                  {(() => {
                    const rulesetDisabledReason = rulesetMutationDisabledReason(ruleset);
                    return (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(rulesetDisabledReason)}
                          title={rulesetDisabledReason ?? undefined}
                          onClick={() =>
                            onMutate(
                              "updateRepositoryRuleset",
                              false,
                              baselineRepositoryRulesetPayload(ruleset.name, "active", ruleset.id)
                            )
                          }
                        >
                          <ShieldCheck size={15} /> Reapply baseline
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(rulesetDisabledReason)}
                          title={rulesetDisabledReason ?? undefined}
                          onClick={() => onMutate("deleteRepositoryRuleset", true, { rulesetId: ruleset.id })}
                        >
                          <X size={15} /> Delete
                        </button>
                      </>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSecurityItem({
                        kind: "ruleset",
                        id: String(ruleset.id),
                        title: ruleset.name,
                        subtitle: `${repository.nameWithOwner} ruleset`,
                        url: ruleset.htmlUrl,
                        state: ruleset.enforcement,
                        rule: ruleset.name,
                        updatedAt: ruleset.updatedAt
                      })
                    }
                  >
                    <ShieldCheck size={15} /> Inspect
                  </button>
                  <button
                    type="button"
                    disabled={!ruleset.htmlUrl}
                    title={ruleset.htmlUrl ? undefined : "Ruleset URL unavailable."}
                    onClick={() => {
                      if (ruleset.htmlUrl) {
                        onOpenExternal(ruleset.htmlUrl);
                      }
                    }}
                  >
                    <ExternalLink size={15} /> GitHub fallback
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="security-protection-summary" aria-label="Security advisories">
        <header>
          <div>
            <h2>Security advisories</h2>
            <small>Repository advisories returned by GitHub for coordinated vulnerability disclosure.</small>
          </div>
          <span
            className={`state-chip ${
              repositorySecurityAdvisoriesLoading && repositorySecurityAdvisories.length === 0
                ? ""
                : repositorySecurityAdvisoriesStatusUnavailable || repositorySecurityAdvisories.length > 0
                  ? "attention"
                  : "success"
            }`}
          >
            {repositorySecurityAdvisoriesStatusLabel}
          </span>
        </header>
        {repositorySecurityAdvisoriesLoading && repositorySecurityAdvisories.length === 0 && (
          <div className="loading-state">Loading security advisories…</div>
        )}
        {repositorySecurityAdvisoriesError && (
          <div className="error-state">
            Security advisories unavailable: {repositorySecurityAdvisoriesError.message}
          </div>
        )}
        {repositorySecurityAdvisoriesAvailabilityMessage && (
          <div className="error-state">{repositorySecurityAdvisoriesAvailabilityMessage}</div>
        )}
        {!repositorySecurityAdvisoriesLoading &&
          !repositorySecurityAdvisoriesError &&
          !repositorySecurityAdvisoriesAvailabilityMessage &&
          repositorySecurityAdvisories.length === 0 && (
            <div className="empty-state">No repository security advisories returned.</div>
          )}
        {renderSecurityListDepthControl(
          repositorySecurityAdvisories.length,
          repositorySecurityAdvisoriesLimit,
          "Load more advisories",
          `Showing the first ${repositorySecurityAdvisoriesLimit} security advisories returned by GitHub.`,
          onExpandRepositorySecurityAdvisories
        )}
        {repositorySecurityAdvisories.length > 0 && (
          <div className="workflow-detail-grid">
            {repositorySecurityAdvisories.map((advisory) => (
              <article
                className={`workflow-job-card ${
                  securityItemActive("advisory", advisory.ghsaId) ? "active" : ""
                }`}
                key={advisory.ghsaId}
              >
                <header>
                  <strong>{advisory.summary}</strong>
                  <span className="state-chip attention">{advisory.severity ?? advisory.state}</span>
                </header>
                <small>
                  {advisory.ghsaId}
                  {advisory.cveId ? ` · ${advisory.cveId}` : ""} ·{" "}
                  {advisory.updatedAt ? formatRelativeDate(advisory.updatedAt) : "not updated"}
                </small>
                {advisory.description && <p>{advisory.description}</p>}
                <div className="workflow-summary branch-protection-flags">
                  <span>CVSS {advisory.cvssScore ?? "unknown"}</span>
                  <span>{formatCompactNumber(advisory.vulnerabilityCount ?? 0)} vulnerabilities</span>
                  <span>{formatCompactNumber(advisory.creditCount ?? 0)} credits</span>
                  {advisory.cweIds.map((cweId) => (
                    <span key={cweId}>{cweId}</span>
                  ))}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSecurityItem({
                        kind: "advisory",
                        id: advisory.ghsaId,
                        title: advisory.summary,
                        subtitle: `${repository.nameWithOwner} advisory · ${advisory.ghsaId}`,
                        url: advisory.htmlUrl,
                        state: advisory.state,
                        severity: advisory.severity,
                        ghsaId: advisory.ghsaId,
                        cveId: advisory.cveId,
                        updatedAt: advisory.updatedAt
                      })
                    }
                  >
                    <ShieldCheck size={15} /> Inspect
                  </button>
                  <button
                    type="button"
                    disabled={!advisory.htmlUrl}
                    title={advisory.htmlUrl ? undefined : "Advisory URL unavailable."}
                    onClick={() => {
                      if (advisory.htmlUrl) {
                        onOpenExternal(advisory.htmlUrl);
                      }
                    }}
                  >
                    <ExternalLink size={15} /> GitHub fallback
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="security-protection-summary" aria-label="Security policy">
        <header>
          <div>
            <h2>Security policy</h2>
            <small>Read-only SECURITY.md surfaced from GitHub when configured.</small>
          </div>
          <span
            className={`state-chip ${
              repositorySecurityPolicyStatusUnavailable ? "attention" : securityPolicy ? "success" : ""
            }`}
          >
            {repositorySecurityPolicyStatusLabel}
          </span>
        </header>
        {repositorySecurityPolicyLoading && !repositorySecurityPolicy && (
          <div className="loading-state">Loading security policy…</div>
        )}
        {repositorySecurityPolicyError && (
          <div className="error-state">
            Security policy unavailable: {repositorySecurityPolicyError.message}
          </div>
        )}
        {repositorySecurityPolicyAvailabilityMessage && (
          <div className="error-state">{repositorySecurityPolicyAvailabilityMessage}</div>
        )}
        {!repositorySecurityPolicyLoading &&
          !repositorySecurityPolicyError &&
          !repositorySecurityPolicyAvailabilityMessage &&
          repositorySecurityPolicy &&
          !securityPolicy && (
            <div className="empty-state">
              No security policy file found in SECURITY.md, .github/SECURITY.md, or docs/SECURITY.md.
            </div>
          )}
        {securityPolicy && (
          <article className="workflow-job-card">
            <header>
              <strong>{securityPolicy.path}</strong>
              <span className="state-chip success">
                {formatCompactNumber(securityPolicy.size ?? 0)} bytes
              </span>
            </header>
            <small>
              {securityPolicy.sha ? `SHA ${securityPolicy.sha.slice(0, 12)}` : "SHA unavailable"} ·{" "}
              {securityPolicy.ref ?? repository.defaultBranch ?? "default branch"}
            </small>
            {securityPolicy.content ? (
              <>
                <pre className="code-preview">{visibleSecurityPolicyContent}</pre>
                {securityPolicyHasFullPreview && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSecurityPolicyState((current) => ({
                        policyKey: securityPolicyKey,
                        expanded: current.policyKey === securityPolicyKey ? !current.expanded : true
                      }))
                    }
                  >
                    <small>{securityPolicyExpanded ? "Show preview" : "Show full policy"}</small>
                  </button>
                )}
              </>
            ) : (
              <div className="empty-state">Policy content is too large or unavailable for preview.</div>
            )}
            <div>
              <button type="button" onClick={() => openSecurityPath(securityPolicy.path, securityPolicy.ref)}>
                <FileIcon size={15} /> Open in Control
              </button>
              <button
                type="button"
                disabled={!securityPolicy.htmlUrl}
                title={securityPolicy.htmlUrl ? undefined : "Policy URL unavailable."}
                onClick={() => {
                  if (securityPolicy.htmlUrl) {
                    onOpenExternal(securityPolicy.htmlUrl);
                  }
                }}
              >
                <ExternalLink size={15} /> GitHub fallback
              </button>
            </div>
          </article>
        )}
        <div className="table-action-row">
          <button
            type="button"
            onClick={() => onOpenExternal(repositoryPath(repository, "/security/policy"))}
          >
            <ExternalLink size={16} /> GitHub fallback
          </button>
        </div>
      </section>
      <section className="security-protection-summary" aria-label="Community profile">
        <header>
          <div>
            <h2>Community profile</h2>
            <small>Repository community standards returned by GitHub.</small>
          </div>
          <span
            className={`state-chip ${repositoryCommunityProfileStatusUnavailable ? "attention" : "success"}`}
          >
            {repositoryCommunityProfileStatusLabel}
          </span>
        </header>
        {repositoryCommunityProfileLoading && !repositoryCommunityProfile && (
          <div className="loading-state">Loading community profile…</div>
        )}
        {repositoryCommunityProfileError && (
          <div className="error-state">
            Community profile unavailable: {repositoryCommunityProfileError.message}
          </div>
        )}
        {repositoryCommunityProfileAvailabilityMessage && (
          <div className="error-state">{repositoryCommunityProfileAvailabilityMessage}</div>
        )}
        {!repositoryCommunityProfileLoading &&
          !repositoryCommunityProfileError &&
          !repositoryCommunityProfileAvailabilityMessage &&
          !repositoryCommunityProfile && <div className="empty-state">No community profile returned.</div>}
        {repositoryCommunityProfile && (
          <>
            <div className="insight-grid">
              <article className="metric-tile">
                <strong>
                  {repositoryCommunityProfile.healthPercentage != null
                    ? `${repositoryCommunityProfile.healthPercentage}%`
                    : "Unknown"}
                </strong>
                <small>Health score</small>
                <span>{repositoryCommunityProfile.description ?? "No community profile description"}</span>
              </article>
              <article className="metric-tile">
                <strong>{formatCompactNumber(presentCommunityFiles.length)}</strong>
                <small>Standards found</small>
                <span>{formatCompactNumber(missingCommunityFiles.length)} missing standards</span>
              </article>
            </div>
            {presentCommunityFiles.length > 0 ? (
              <div className="workflow-detail-grid">
                {presentCommunityFiles.map((file) => (
                  <article className="workflow-job-card" key={file.key}>
                    <header>
                      <strong>{file.label}</strong>
                      <span className="state-chip success">found</span>
                    </header>
                    <small>{file.path ?? file.name ?? "Path unavailable"}</small>
                    <div>
                      <button
                        type="button"
                        disabled={!file.path}
                        title={securityPathDisabledReason(file.path, file.label) ?? undefined}
                        onClick={() => openSecurityPath(file.path, null)}
                      >
                        <FileIcon size={15} /> Open in Control
                      </button>
                      <button
                        type="button"
                        disabled={!file.htmlUrl}
                        title={file.htmlUrl ? undefined : "File URL unavailable."}
                        onClick={() => {
                          if (file.htmlUrl) {
                            onOpenExternal(file.htmlUrl);
                          }
                        }}
                      >
                        <ExternalLink size={15} /> GitHub fallback
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No community standard files returned.</div>
            )}
            {missingCommunityFiles.length > 0 && (
              <div className="label-stack branch-protection-checks">
                {missingCommunityFiles.map((file) => (
                  <span key={file.key}>Missing {file.label}</span>
                ))}
              </div>
            )}
          </>
        )}
        <div className="table-action-row">
          {repositoryCommunityProfile?.documentationUrl && (
            <button
              type="button"
              onClick={() => onOpenExternal(repositoryCommunityProfile.documentationUrl!)}
            >
              <ExternalLink size={16} /> GitHub fallback
            </button>
          )}
          <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/community"))}>
            <ExternalLink size={16} /> GitHub fallback
          </button>
        </div>
      </section>
      <section className="security-protection-summary" aria-label="Security feature availability">
        <header>
          <div>
            <h2>Security feature availability</h2>
            <small>Repository-level feature statuses returned by GitHub settings metadata.</small>
          </div>
          <span className={`state-chip ${administrationAvailabilityLabel ? "attention" : ""}`}>
            {administrationAvailabilityLabel ??
              `${formatCompactNumber(securityFeatureRows.filter(([, status]) => status !== null).length)} returned`}
          </span>
        </header>
        {administrationAvailabilityMessage && (
          <div className="error-state">{administrationAvailabilityMessage}</div>
        )}
        <div className="workflow-summary branch-protection-flags">
          {securityFeatureRows.map(([label, status]) => (
            <span key={label}>
              {label}: {securityFeatureStatusLabel(status)}
            </span>
          ))}
        </div>
      </section>
      <section className="security-protection-summary" aria-label="Dependabot alerts">
        <header>
          <div>
            <h2>Dependabot alerts</h2>
            <small>Open vulnerability alerts returned by GitHub for this repository.</small>
          </div>
          <span
            className={`state-chip ${
              dependabotAlertsLoading && dependabotAlerts.length === 0
                ? ""
                : dependabotStatusUnavailable || dependabotAlerts.length > 0
                  ? "attention"
                  : "success"
            }`}
          >
            {dependabotStatusLabel}
          </span>
        </header>
        {dependabotAlertsLoading && dependabotAlerts.length === 0 && (
          <div className="loading-state">Loading Dependabot alerts…</div>
        )}
        {dependabotAlertsError && (
          <div className="error-state">Dependabot alerts unavailable: {dependabotAlertsError.message}</div>
        )}
        {dependabotAvailabilityMessage && <div className="error-state">{dependabotAvailabilityMessage}</div>}
        {!dependabotAlertsLoading &&
          !dependabotAlertsError &&
          !dependabotAvailabilityMessage &&
          dependabotAlerts.length === 0 && <div className="empty-state">No open Dependabot alerts.</div>}
        {renderSecurityListDepthControl(
          dependabotAlerts.length,
          dependabotAlertsLimit,
          "Load more Dependabot alerts",
          `Showing the first ${dependabotAlertsLimit} Dependabot alerts returned by GitHub.`,
          onExpandDependabotAlerts
        )}
        {dependabotAlerts.length > 0 && (
          <div className="workflow-detail-grid">
            {dependabotAlerts.map((alert) => (
              <article
                className={`workflow-job-card ${
                  securityItemActive("dependabot", alert.number) ? "active" : ""
                }`}
                key={alert.number}
              >
                <header>
                  <strong>{alert.packageName ?? `Alert ${alert.number}`}</strong>
                  <span className="state-chip attention">{alert.severity ?? alert.state}</span>
                </header>
                <small>
                  {alert.ecosystem ?? "dependency"} · {alert.manifestPath ?? "unknown manifest"} ·{" "}
                  {alert.updatedAt ? formatRelativeDate(alert.updatedAt) : "not updated"}
                </small>
                {alert.summary && <p>{alert.summary}</p>}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSecurityItem({
                        kind: "dependabot",
                        id: String(alert.number),
                        title: alert.packageName ?? `Dependabot alert #${alert.number}`,
                        subtitle: `${repository.nameWithOwner} Dependabot alert #${alert.number}`,
                        url: alert.htmlUrl,
                        state: alert.state,
                        severity: alert.severity,
                        path: alert.manifestPath,
                        packageName: alert.packageName,
                        updatedAt: alert.updatedAt
                      })
                    }
                  >
                    <ShieldCheck size={15} /> Inspect
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(securityPathDisabledReason(alert.manifestPath, "Manifest"))}
                    title={securityPathDisabledReason(alert.manifestPath, "Manifest") ?? undefined}
                    onClick={() => openSecurityPath(alert.manifestPath, defaultSecurityRef)}
                  >
                    Open manifest in Control
                  </button>
                  <button
                    type="button"
                    disabled={!alert.htmlUrl}
                    title={alert.htmlUrl ? undefined : "Dependabot alert URL unavailable."}
                    onClick={() => {
                      if (alert.htmlUrl) {
                        onOpenExternal(alert.htmlUrl);
                      }
                    }}
                  >
                    <ExternalLink size={15} /> GitHub fallback
                  </button>
                </div>
                {securityPathDisabledReason(alert.manifestPath, "Manifest") && (
                  <small className="action-disabled-note">
                    {securityPathDisabledReason(alert.manifestPath, "Manifest")}
                  </small>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="security-protection-summary" aria-label="Code scanning alerts">
        <header>
          <div>
            <h2>Code scanning alerts</h2>
            <small>Open static analysis findings returned by GitHub for this repository.</small>
          </div>
          <span
            className={`state-chip ${
              codeScanningAlertsLoading && codeScanningAlerts.length === 0
                ? ""
                : codeScanningStatusUnavailable || codeScanningAlerts.length > 0
                  ? "attention"
                  : "success"
            }`}
          >
            {codeScanningStatusLabel}
          </span>
        </header>
        {codeScanningAlertsLoading && codeScanningAlerts.length === 0 && (
          <div className="loading-state">Loading code scanning alerts…</div>
        )}
        {codeScanningAlertsError && (
          <div className="error-state">
            Code scanning alerts unavailable: {codeScanningAlertsError.message}
          </div>
        )}
        {codeScanningAvailabilityMessage && (
          <div className="error-state">{codeScanningAvailabilityMessage}</div>
        )}
        {!codeScanningAlertsLoading &&
          !codeScanningAlertsError &&
          !codeScanningAvailabilityMessage &&
          codeScanningAlerts.length === 0 && <div className="empty-state">No open code scanning alerts.</div>}
        {renderSecurityListDepthControl(
          codeScanningAlerts.length,
          codeScanningAlertsLimit,
          "Load more code scanning alerts",
          `Showing the first ${codeScanningAlertsLimit} code scanning alerts returned by GitHub.`,
          onExpandCodeScanningAlerts
        )}
        {codeScanningAlerts.length > 0 && (
          <div className="workflow-detail-grid">
            {codeScanningAlerts.map((alert) => (
              <article
                className={`workflow-job-card ${
                  securityItemActive("codeScanning", alert.number) ? "active" : ""
                }`}
                key={alert.number}
              >
                <header>
                  <strong>{alert.ruleName ?? alert.ruleId ?? `Alert ${alert.number}`}</strong>
                  <span className="state-chip attention">{alert.severity ?? alert.state}</span>
                </header>
                <small>
                  {alert.toolName ?? "code scanning"} · {alert.path ?? "unknown path"}
                  {alert.startLine ? `:${alert.startLine}` : ""} ·{" "}
                  {alert.updatedAt ? formatRelativeDate(alert.updatedAt) : "not updated"}
                </small>
                {alert.message && <p>{alert.message}</p>}
                {alert.ruleDescription && <small>{alert.ruleDescription}</small>}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSecurityItem({
                        kind: "codeScanning",
                        id: String(alert.number),
                        title: alert.ruleName ?? alert.ruleId ?? `Code scanning alert #${alert.number}`,
                        subtitle: `${repository.nameWithOwner} code scanning alert #${alert.number}`,
                        url: alert.htmlUrl,
                        state: alert.state,
                        severity: alert.severity,
                        path: alert.path,
                        rule: alert.ruleName ?? alert.ruleId,
                        updatedAt: alert.updatedAt
                      })
                    }
                  >
                    <ShieldCheck size={15} /> Inspect
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(securityPathDisabledReason(alert.path, "Code alert"))}
                    title={securityPathDisabledReason(alert.path, "Code alert") ?? undefined}
                    onClick={() => openSecurityPath(alert.path, alert.ref, alert.startLine)}
                  >
                    Open file in Control
                  </button>
                  <button
                    type="button"
                    disabled={!alert.htmlUrl}
                    title={alert.htmlUrl ? undefined : "Code scanning alert URL unavailable."}
                    onClick={() => {
                      if (alert.htmlUrl) {
                        onOpenExternal(alert.htmlUrl);
                      }
                    }}
                  >
                    <ExternalLink size={15} /> GitHub fallback
                  </button>
                </div>
                {securityPathDisabledReason(alert.path, "Code alert") && (
                  <small className="action-disabled-note">
                    {securityPathDisabledReason(alert.path, "Code alert")}
                  </small>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="security-protection-summary" aria-label="Secret scanning alerts">
        <header>
          <div>
            <h2>Secret scanning alerts</h2>
            <small>Open leaked-secret alerts returned by GitHub for this repository.</small>
          </div>
          <span
            className={`state-chip ${
              secretScanningAlertsLoading && secretScanningAlerts.length === 0
                ? ""
                : secretScanningStatusUnavailable || secretScanningAlerts.length > 0
                  ? "attention"
                  : "success"
            }`}
          >
            {secretScanningStatusLabel}
          </span>
        </header>
        {secretScanningAlertsLoading && secretScanningAlerts.length === 0 && (
          <div className="loading-state">Loading secret scanning alerts…</div>
        )}
        {secretScanningAlertsError && (
          <div className="error-state">
            Secret scanning alerts unavailable: {secretScanningAlertsError.message}
          </div>
        )}
        {secretScanningAvailabilityMessage && (
          <div className="error-state">{secretScanningAvailabilityMessage}</div>
        )}
        {!secretScanningAlertsLoading &&
          !secretScanningAlertsError &&
          !secretScanningAvailabilityMessage &&
          secretScanningAlerts.length === 0 && (
            <div className="empty-state">No open secret scanning alerts.</div>
          )}
        {renderSecurityListDepthControl(
          secretScanningAlerts.length,
          secretScanningAlertsLimit,
          "Load more secret scanning alerts",
          `Showing the first ${secretScanningAlertsLimit} secret scanning alerts returned by GitHub.`,
          onExpandSecretScanningAlerts
        )}
        {secretScanningAlerts.length > 0 && (
          <div className="workflow-detail-grid">
            {secretScanningAlerts.map((alert) => (
              <article
                className={`workflow-job-card ${
                  securityItemActive("secretScanning", alert.number) ? "active" : ""
                }`}
                key={alert.number}
              >
                <header>
                  <strong>
                    {alert.secretTypeDisplayName ?? alert.secretType ?? `Alert ${alert.number}`}
                  </strong>
                  <span className="state-chip attention">{alert.validity ?? alert.state}</span>
                </header>
                <small>
                  {alert.firstLocationPath ?? "unknown location"}
                  {alert.firstLocationStartLine ? `:${alert.firstLocationStartLine}` : ""} ·{" "}
                  {alert.updatedAt ? formatRelativeDate(alert.updatedAt) : "not updated"}
                </small>
                <p>Secret value hidden by Control.</p>
                <div className="workflow-summary branch-protection-flags">
                  <span>Publicly leaked: {settingStateLabel(alert.publiclyLeaked)}</span>
                  <span>Multi-repo: {settingStateLabel(alert.multiRepo)}</span>
                  <span>Push protection bypassed: {settingStateLabel(alert.pushProtectionBypassed)}</span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSecurityItem({
                        kind: "secretScanning",
                        id: String(alert.number),
                        title:
                          alert.secretTypeDisplayName ??
                          alert.secretType ??
                          `Secret scanning alert #${alert.number}`,
                        subtitle: `${repository.nameWithOwner} secret scanning alert #${alert.number}`,
                        url: alert.htmlUrl,
                        state: alert.state,
                        severity: alert.validity,
                        path: alert.firstLocationPath,
                        rule: alert.secretTypeDisplayName ?? alert.secretType,
                        updatedAt: alert.updatedAt
                      })
                    }
                  >
                    <ShieldCheck size={15} /> Inspect
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(securityPathDisabledReason(alert.firstLocationPath, "Secret location"))}
                    title={
                      securityPathDisabledReason(alert.firstLocationPath, "Secret location") ?? undefined
                    }
                    onClick={() =>
                      openSecurityPath(
                        alert.firstLocationPath,
                        defaultSecurityRef,
                        alert.firstLocationStartLine
                      )
                    }
                  >
                    Open location in Control
                  </button>
                  <button
                    type="button"
                    disabled={!alert.htmlUrl}
                    title={alert.htmlUrl ? undefined : "Secret scanning alert URL unavailable."}
                    onClick={() => {
                      if (alert.htmlUrl) {
                        onOpenExternal(alert.htmlUrl);
                      }
                    }}
                  >
                    <ExternalLink size={15} /> GitHub fallback
                  </button>
                </div>
                {securityPathDisabledReason(alert.firstLocationPath, "Secret location") && (
                  <small className="action-disabled-note">
                    {securityPathDisabledReason(alert.firstLocationPath, "Secret location")}
                  </small>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="tile-grid">
        {qualityLinks.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className="project-tile"
              key={item.title}
              type="button"
              onClick={() => onOpenExternal(repositoryPath(repository, item.path))}
            >
              <Icon size={20} />
              <strong>{item.title}</strong>
              <small>{repository.nameWithOwner}</small>
            </button>
          );
        })}
      </section>
    </section>
  );
}
