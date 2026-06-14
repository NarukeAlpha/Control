import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  File as FileIcon,
  Gauge,
  GitBranch,
  Plus,
  ShieldCheck,
  Workflow,
  X,
  type LucideIcon
} from "lucide-react";
import { useState, type ChangeEvent, type JSX } from "react";

import type {
  BranchProtectionSummary,
  BranchSummary,
  CodeScanningAlertSummary,
  CommunityProfileFileSummary,
  DependabotAlertSummary,
  GitHubAction,
  GitHubMutationFields,
  RepositoryCommunityProfile,
  RepositoryDetail,
  RepositoryRulesetSummary,
  RepositorySecurityAdvisorySummary,
  RepositorySecurityPolicy,
  SecretScanningAlertSummary
} from "@shared/github";
import type { LocalRecentSecurityItemKind } from "@shared/local";

import {
  FilterBar,
  StateSegmentedControl,
  type StateSegmentedControlOption
} from "@renderer/components/ui/primitives";
import {
  accessRoleLabel,
  githubActionLabel,
  readAvailabilityMessage,
  readAvailabilityStatusLabel,
  repositoryIsArchived,
  repositoryIsDisabled,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";
import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
import {
  codeScanningAlertStateFilterOptions,
  defaultCodeScanningAlertStateFilter,
  defaultDependabotAlertStateFilter,
  defaultSecretScanningAlertStateFilter,
  dependabotAlertStateFilterOptions,
  secretScanningAlertStateFilterOptions,
  securityAlertStateFilterLabel,
  useSecurityQualityTabQueries,
  type CodeScanningAlertStateFilter,
  type DependabotAlertStateFilter,
  type SecretScanningAlertStateFilter
} from "./SecurityQualityTab.queries";

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
const securityPolicyPreviewLength = 1200;

type OpenSecurityPath = (path: string | null, ref: string | null | undefined, line?: number | null) => void;

type SelectSecurityItem = (securityItem: SecurityItemRecentInput) => void;

type SecurityItemActive = (kind: LocalRecentSecurityItemKind, id: string | number) => boolean;

type SupportedSecurityAlertState =
  | DependabotAlertStateFilter
  | CodeScanningAlertStateFilter
  | SecretScanningAlertStateFilter;

interface SecurityQualityLink {
  title: string;
  path: string;
  icon: LucideIcon;
}

const securityQualityLinks: SecurityQualityLink[] = [
  { title: "Security policy", path: "/security/policy", icon: ShieldCheck },
  { title: "Code scanning", path: "/security/code-scanning", icon: Gauge },
  { title: "Dependabot", path: "/security/dependabot", icon: CheckCircle2 },
  { title: "Secret scanning", path: "/security/secret-scanning", icon: ShieldCheck },
  { title: "Rulesets", path: "/rules", icon: GitBranch },
  { title: "Security advisories", path: "/security/advisories", icon: ShieldCheck },
  { title: "Community standards", path: "/community", icon: BookOpen },
  { title: "Pulse", path: "/pulse", icon: Workflow }
];

const securityMutationActions = new Set<GitHubAction>([
  "updateBranchProtection",
  "deleteBranchProtection",
  "createRepositoryRuleset",
  "updateRepositoryRuleset",
  "deleteRepositoryRuleset"
]);

interface SecurityPolicyPreviewState {
  policy: RepositorySecurityPolicy | null;
  policyKey: string | null;
  policyExpanded: boolean;
  policyHasFullPreview: boolean;
  visiblePolicyContent: string;
  togglePolicyPreview(): void;
}

interface SecurityQualityTabProps {
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
}

interface SecurityQualityActionsInput {
  branchProtectionBranch: string | null;
  defaultSecurityRef: string | null;
  focusedSecurityItemId: string | null;
  focusedSecurityItemKind: LocalRecentSecurityItemKind | null;
  mutationPending: boolean;
  repository: RepositoryDetail;
  securityMutationDisabledReason: string | null;
  securityMutationRelevant: boolean;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onOpenCodePath(path: string, ref: string | null, line?: number | null): void;
  onOpenExternal(url: string): void;
  onSelectSecurityItem(securityItem: SecurityItemRecentInput): void;
}

interface SecurityQualityActions {
  openSecurityPath: OpenSecurityPath;
  securityItemActive: SecurityItemActive;
  rulesetMutationDisabledReason(ruleset: RepositoryRulesetSummary): string | null;
  applyBaselineBranchProtection(): void;
  deleteBranchProtection(): void;
  createActiveRepositoryRuleset(): void;
  createEvaluateRepositoryRuleset(): void;
  reapplyRepositoryRuleset(ruleset: RepositoryRulesetSummary): void;
  deleteRepositoryRuleset(ruleset: RepositoryRulesetSummary): void;
  inspectRepositoryRuleset(ruleset: RepositoryRulesetSummary): void;
  openRepositorySecurityPath(path: string): void;
}

interface SecurityQualityQueryStateInput {
  codeScanningAlertState: CodeScanningAlertStateFilter;
  codeScanningAlertsLimit: number;
  dependabotAlertState: DependabotAlertStateFilter;
  dependabotAlertsLimit: number;
  githubReady: boolean;
  refListLimit: number;
  repository: RepositoryDetail;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  secretScanningAlertState: SecretScanningAlertStateFilter;
  secretScanningAlertsLimit: number;
  selectedRef: string | null;
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

function securityAlertStateLabel(state: SupportedSecurityAlertState): string {
  return securityAlertStateFilterLabel(state).toLowerCase();
}

function securityAlertStateSentenceLabel(state: SupportedSecurityAlertState): string {
  return securityAlertStateFilterLabel(state);
}

function securityAlertEmptyStateLabel(state: SupportedSecurityAlertState, label: string): string {
  return `No ${securityAlertStateLabel(state)} ${label}.`;
}

function securityAlertStatusLabel(
  loading: boolean,
  unavailable: boolean,
  count: number,
  state: SupportedSecurityAlertState
): string {
  if (loading && count === 0) {
    return "loading";
  }

  if (unavailable) {
    return "unavailable";
  }

  if (count === 0) {
    return state === "open" ? "clear" : `no ${securityAlertStateLabel(state)}`;
  }

  return `${count} ${securityAlertStateLabel(state)}`;
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

function securityPathDisabledReason(path: string | null, label: string): string | null {
  return path ? null : `${label} path unavailable from GitHub.`;
}

function isSecurityMutationAction(action: GitHubAction | null): boolean {
  return action ? securityMutationActions.has(action) : false;
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

function baselineRepositoryRulesetPayload({
  branch,
  defaultRef,
  enforcement,
  name,
  rulesetId
}: {
  branch: string | null;
  defaultRef: string | null;
  enforcement: "active" | "evaluate";
  name: string;
  rulesetId?: number;
}): GitHubMutationFields {
  const ref = defaultRef ?? branch;
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

function useSecurityPolicyPreviewState(
  repositoryNameWithOwner: string,
  securityPolicyResult: { policy: RepositorySecurityPolicy | null } | null
): SecurityPolicyPreviewState {
  const policy = securityPolicyResult?.policy ?? null;
  const policyKey = policy
    ? `${repositoryNameWithOwner}:${policy.path}:${policy.ref ?? ""}:${policy.sha ?? ""}`
    : null;
  const [expandedSecurityPolicyState, setExpandedSecurityPolicyState] = useState({
    policyKey,
    expanded: false
  });
  const policyExpanded =
    expandedSecurityPolicyState.policyKey === policyKey ? expandedSecurityPolicyState.expanded : false;
  const policyContent = policy?.content ?? "";

  function togglePolicyPreview(): void {
    if (!policyKey) {
      return;
    }

    setExpandedSecurityPolicyState((current) => ({
      policyKey,
      expanded: current.policyKey === policyKey ? !current.expanded : true
    }));
  }

  return {
    policy,
    policyKey,
    policyExpanded,
    policyHasFullPreview: policyContent.length > securityPolicyPreviewLength,
    visiblePolicyContent: policyExpanded
      ? policyContent
      : policyContent.slice(0, securityPolicyPreviewLength),
    togglePolicyPreview
  };
}

function createSecurityQualityActions({
  branchProtectionBranch,
  defaultSecurityRef,
  focusedSecurityItemId,
  focusedSecurityItemKind,
  mutationPending,
  repository,
  securityMutationDisabledReason,
  securityMutationRelevant,
  onMutate,
  onOpenCodePath,
  onOpenExternal,
  onSelectSecurityItem
}: SecurityQualityActionsInput): SecurityQualityActions {
  function openSecurityPath(path: string | null, ref: string | null | undefined, line?: number | null): void {
    if (!path) {
      return;
    }

    onOpenCodePath(path, normalizeGitHubCodeRef(ref) ?? defaultSecurityRef, line);
  }

  function securityItemActive(kind: LocalRecentSecurityItemKind, id: string | number): boolean {
    return focusedSecurityItemKind === kind && focusedSecurityItemId === String(id);
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

  function applyBaselineBranchProtection(): void {
    if (branchProtectionBranch) {
      onMutate("updateBranchProtection", false, baselineBranchProtectionPayload(branchProtectionBranch));
    }
  }

  function deleteBranchProtection(): void {
    if (branchProtectionBranch) {
      onMutate("deleteBranchProtection", true, { branch: branchProtectionBranch });
    }
  }

  function createActiveRepositoryRuleset(): void {
    onMutate(
      "createRepositoryRuleset",
      false,
      baselineRepositoryRulesetPayload({
        branch: branchProtectionBranch,
        defaultRef: defaultSecurityRef,
        enforcement: "active",
        name: "Baseline branch rules"
      })
    );
  }

  function createEvaluateRepositoryRuleset(): void {
    onMutate(
      "createRepositoryRuleset",
      false,
      baselineRepositoryRulesetPayload({
        branch: branchProtectionBranch,
        defaultRef: defaultSecurityRef,
        enforcement: "evaluate",
        name: "Evaluate baseline branch rules"
      })
    );
  }

  function reapplyRepositoryRuleset(ruleset: RepositoryRulesetSummary): void {
    onMutate(
      "updateRepositoryRuleset",
      false,
      baselineRepositoryRulesetPayload({
        branch: branchProtectionBranch,
        defaultRef: defaultSecurityRef,
        enforcement: "active",
        name: ruleset.name,
        rulesetId: ruleset.id
      })
    );
  }

  function deleteRepositoryRuleset(ruleset: RepositoryRulesetSummary): void {
    onMutate("deleteRepositoryRuleset", true, { rulesetId: ruleset.id });
  }

  function inspectRepositoryRuleset(ruleset: RepositoryRulesetSummary): void {
    onSelectSecurityItem({
      kind: "ruleset",
      id: String(ruleset.id),
      title: ruleset.name,
      subtitle: `${repository.nameWithOwner} ruleset`,
      url: ruleset.htmlUrl,
      state: ruleset.enforcement,
      rule: ruleset.name,
      updatedAt: ruleset.updatedAt
    });
  }

  function openRepositorySecurityPath(path: string): void {
    onOpenExternal(repositoryPath(repository, path));
  }

  return {
    openSecurityPath,
    securityItemActive,
    rulesetMutationDisabledReason,
    applyBaselineBranchProtection,
    deleteBranchProtection,
    createActiveRepositoryRuleset,
    createEvaluateRepositoryRuleset,
    reapplyRepositoryRuleset,
    deleteRepositoryRuleset,
    inspectRepositoryRuleset,
    openRepositorySecurityPath
  };
}

function useSecurityQualityQueryState({
  codeScanningAlertState,
  codeScanningAlertsLimit,
  dependabotAlertState,
  dependabotAlertsLimit,
  githubReady,
  refListLimit,
  repository,
  repositoryRulesetsLimit,
  repositorySecurityAdvisoriesLimit,
  secretScanningAlertState,
  secretScanningAlertsLimit,
  selectedRef
}: SecurityQualityQueryStateInput) {
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
    dependabotAlertState,
    dependabotAlertsLimit,
    codeScanningAlertState,
    codeScanningAlertsLimit,
    secretScanningAlertState,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    enabled: true,
    githubReady
  });
  const branchProtection = branchProtectionQuery.data ?? null;
  const dependabotAlerts = dependabotAlertsQuery.data?.items ?? [];
  const codeScanningAlerts = codeScanningAlertsQuery.data?.items ?? [];
  const secretScanningAlerts = secretScanningAlertsQuery.data?.items ?? [];
  const repositoryRulesets = repositoryRulesetsQuery.data?.items ?? [];
  const repositorySecurityAdvisories = repositorySecurityAdvisoriesQuery.data?.items ?? [];

  return {
    branchProtectionBranch,
    branchProtectionBranches,
    branchProtectionBranchesLoading,
    branchProtectionBranchesError,
    branchProtection,
    protection: branchProtection?.protection ?? null,
    branchProtectionLoading: branchProtectionQuery.isLoading || branchProtectionQuery.isFetching,
    branchProtectionError: branchProtectionQuery.error,
    dependabotAlertState,
    dependabotAlerts,
    dependabotAlertsLoading: dependabotAlertsQuery.isLoading || dependabotAlertsQuery.isFetching,
    dependabotAlertsAvailability: dependabotAlertsQuery.data?.availability ?? null,
    dependabotAlertsError: dependabotAlertsQuery.error,
    codeScanningAlertState,
    codeScanningAlerts,
    codeScanningAlertsLoading: codeScanningAlertsQuery.isLoading || codeScanningAlertsQuery.isFetching,
    codeScanningAlertsAvailability: codeScanningAlertsQuery.data?.availability ?? null,
    codeScanningAlertsError: codeScanningAlertsQuery.error,
    secretScanningAlertState,
    secretScanningAlerts,
    secretScanningAlertsLoading: secretScanningAlertsQuery.isLoading || secretScanningAlertsQuery.isFetching,
    secretScanningAlertsAvailability: secretScanningAlertsQuery.data?.availability ?? null,
    secretScanningAlertsError: secretScanningAlertsQuery.error,
    repositoryRulesets,
    repositoryRulesetsLoading: repositoryRulesetsQuery.isLoading || repositoryRulesetsQuery.isFetching,
    repositoryRulesetsAvailability: repositoryRulesetsQuery.data?.availability ?? null,
    repositoryRulesetsError: repositoryRulesetsQuery.error,
    repositorySecurityAdvisories,
    repositorySecurityAdvisoriesLoading:
      repositorySecurityAdvisoriesQuery.isLoading || repositorySecurityAdvisoriesQuery.isFetching,
    repositorySecurityAdvisoriesAvailability: repositorySecurityAdvisoriesQuery.data?.availability ?? null,
    repositorySecurityAdvisoriesError: repositorySecurityAdvisoriesQuery.error,
    repositorySecurityPolicy: repositorySecurityPolicyQuery.data ?? null,
    repositorySecurityPolicyLoading:
      repositorySecurityPolicyQuery.isLoading || repositorySecurityPolicyQuery.isFetching,
    repositorySecurityPolicyError: repositorySecurityPolicyQuery.error,
    repositoryCommunityProfile: repositoryCommunityProfileQuery.data?.profile ?? null,
    repositoryCommunityProfileLoading:
      repositoryCommunityProfileQuery.isLoading || repositoryCommunityProfileQuery.isFetching,
    repositoryCommunityProfileAvailability: repositoryCommunityProfileQuery.data?.availability ?? null,
    repositoryCommunityProfileError: repositoryCommunityProfileQuery.error
  };
}

type SecurityQualityQueryState = ReturnType<typeof useSecurityQualityQueryState>;

function securityItemKindLabel(kind: LocalRecentSecurityItemKind): string {
  switch (kind) {
    case "dependabot":
      return "Dependabot alert";
    case "codeScanning":
      return "Code scanning alert";
    case "secretScanning":
      return "Secret scanning alert";
    case "ruleset":
      return "Repository ruleset";
    case "advisory":
      return "Security advisory";
  }
}

function readFocusedSecurityItemMessage({
  focusedSecurityItemId,
  focusedSecurityItemKind,
  queryState
}: {
  focusedSecurityItemId: string | null;
  focusedSecurityItemKind: LocalRecentSecurityItemKind | null;
  queryState: SecurityQualityQueryState;
}): string | null {
  if (!focusedSecurityItemKind || !focusedSecurityItemId) {
    return null;
  }

  const itemLoaded = (() => {
    switch (focusedSecurityItemKind) {
      case "dependabot":
        if (queryState.dependabotAlertsLoading && queryState.dependabotAlerts.length === 0) {
          return true;
        }
        return queryState.dependabotAlerts.some((alert) => String(alert.number) === focusedSecurityItemId);
      case "codeScanning":
        if (queryState.codeScanningAlertsLoading && queryState.codeScanningAlerts.length === 0) {
          return true;
        }
        return queryState.codeScanningAlerts.some((alert) => String(alert.number) === focusedSecurityItemId);
      case "secretScanning":
        if (queryState.secretScanningAlertsLoading && queryState.secretScanningAlerts.length === 0) {
          return true;
        }
        return queryState.secretScanningAlerts.some(
          (alert) => String(alert.number) === focusedSecurityItemId
        );
      case "ruleset":
        if (queryState.repositoryRulesetsLoading && queryState.repositoryRulesets.length === 0) {
          return true;
        }
        return queryState.repositoryRulesets.some((ruleset) => String(ruleset.id) === focusedSecurityItemId);
      case "advisory":
        if (
          queryState.repositorySecurityAdvisoriesLoading &&
          queryState.repositorySecurityAdvisories.length === 0
        ) {
          return true;
        }
        return queryState.repositorySecurityAdvisories.some(
          (advisory) => advisory.ghsaId === focusedSecurityItemId
        );
    }
  })();

  if (itemLoaded) {
    return null;
  }

  return `${securityItemKindLabel(
    focusedSecurityItemKind
  )} ${focusedSecurityItemId} is not loaded in the current security list, state filter, or result limit.`;
}

function readSecurityQualityDerivedState({
  githubReady,
  mutationAction,
  mutationPending,
  queryState,
  repository,
  securityPolicy
}: {
  githubReady: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  queryState: SecurityQualityQueryState;
  repository: RepositoryDetail;
  securityPolicy: RepositorySecurityPolicy | null;
}) {
  const branchProtectionAvailabilityLabel = readAvailabilityStatusLabel(
    queryState.branchProtection?.availability ?? null
  );
  const availabilityMessage = readAvailabilityMessage(
    "Branch protection",
    queryState.branchProtection?.availability ?? null
  );
  const dependabotAvailabilityMessage = readAvailabilityMessage(
    "Dependabot alerts",
    queryState.dependabotAlertsAvailability
  );
  const codeScanningAvailabilityMessage = readAvailabilityMessage(
    "Code scanning alerts",
    queryState.codeScanningAlertsAvailability
  );
  const secretScanningAvailabilityMessage = readAvailabilityMessage(
    "Secret scanning alerts",
    queryState.secretScanningAlertsAvailability
  );
  const repositoryRulesetsAvailabilityMessage = readAvailabilityMessage(
    "Repository rulesets",
    queryState.repositoryRulesetsAvailability
  );
  const repositorySecurityAdvisoriesAvailabilityMessage = readAvailabilityMessage(
    "Security advisories",
    queryState.repositorySecurityAdvisoriesAvailability
  );
  const repositorySecurityPolicyAvailabilityMessage = readAvailabilityMessage(
    "Security policy",
    queryState.repositorySecurityPolicy?.availability ?? null
  );
  const repositoryCommunityProfileAvailabilityMessage = readAvailabilityMessage(
    "Community profile",
    queryState.repositoryCommunityProfileAvailability
  );
  const administrationAvailabilityMessage = readAvailabilityMessage(
    "Repository settings metadata",
    repository.administrationAvailability ?? null
  );
  const repositorySecurityPolicyAvailabilityLabel = readAvailabilityStatusLabel(
    queryState.repositorySecurityPolicy?.availability ?? null
  );
  const repositoryCommunityProfileStatusUnavailable =
    Boolean(queryState.repositoryCommunityProfileError) ||
    Boolean(repositoryCommunityProfileAvailabilityMessage);
  const dependabotStatusUnavailable =
    Boolean(queryState.dependabotAlertsError) || Boolean(dependabotAvailabilityMessage);
  const codeScanningStatusUnavailable =
    Boolean(queryState.codeScanningAlertsError) || Boolean(codeScanningAvailabilityMessage);
  const secretScanningStatusUnavailable =
    Boolean(queryState.secretScanningAlertsError) || Boolean(secretScanningAvailabilityMessage);
  const defaultSecurityRef = repository.defaultBranch ?? null;
  const branchProtectionBranchesDisabled =
    queryState.branchProtectionBranchesLoading && queryState.branchProtectionBranches.length === 0;
  const securityMutationRelevant = isSecurityMutationAction(mutationAction);
  const securityMutationDisabledReason =
    (!githubReady ? "Sign in with GitHub to change security settings." : null) ??
    (repositoryIsArchived(repository) ? "Repository is archived." : null) ??
    (repositoryIsDisabled(repository) ? "Repository is disabled." : null);

  return {
    availabilityMessage,
    branchProtectionBranchLabel: queryState.branchProtectionBranch ?? "No branch selected",
    branchProtectionBranchesDisabled,
    branchProtectionBranchesNote: queryState.branchProtectionBranchesError
      ? `Branch list unavailable: ${queryState.branchProtectionBranchesError.message}`
      : branchProtectionBranchesDisabled
        ? "Loading branches…"
        : queryState.branchProtectionBranches.length === 0
          ? "No branch options available."
          : null,
    branchProtectionMutationDisabledReason:
      (mutationPending && securityMutationRelevant ? "A security setting update is still running." : null) ??
      securityMutationDisabledReason ??
      (!queryState.branchProtectionBranch ? "Select a branch before changing branch protection." : null),
    branchProtectionStatusLabel:
      queryState.branchProtectionLoading && !queryState.branchProtection
        ? "loading"
        : queryState.branchProtectionError
          ? "unavailable"
          : (branchProtectionAvailabilityLabel ??
            (queryState.protection ? "protected" : queryState.branchProtection ? "unprotected" : "unknown")),
    branchProtectionStatusUnavailable:
      Boolean(queryState.branchProtectionError) || Boolean(branchProtectionAvailabilityLabel),
    codeScanningAvailabilityMessage,
    codeScanningStatusLabel: securityAlertStatusLabel(
      queryState.codeScanningAlertsLoading,
      codeScanningStatusUnavailable,
      queryState.codeScanningAlerts.length,
      queryState.codeScanningAlertState
    ),
    codeScanningStatusUnavailable,
    createRulesetDisabledReason:
      (mutationPending && securityMutationRelevant ? "A security setting update is still running." : null) ??
      securityMutationDisabledReason ??
      (!defaultSecurityRef ? "Repository default branch is unavailable." : null),
    defaultSecurityRef,
    dependabotAvailabilityMessage,
    dependabotStatusLabel: securityAlertStatusLabel(
      queryState.dependabotAlertsLoading,
      dependabotStatusUnavailable,
      queryState.dependabotAlerts.length,
      queryState.dependabotAlertState
    ),
    dependabotStatusUnavailable,
    hasBranchProtectionBranchOption: queryState.branchProtectionBranches.some(
      (branch) => branch.name === queryState.branchProtectionBranch
    ),
    presentCommunityFiles:
      queryState.repositoryCommunityProfile?.files.filter((file) => file.path || file.htmlUrl) ?? [],
    missingCommunityFiles:
      queryState.repositoryCommunityProfile?.files.filter((file) => !file.path && !file.htmlUrl) ?? [],
    repositoryCommunityProfileAvailabilityMessage,
    repositoryCommunityProfileStatusLabel:
      queryState.repositoryCommunityProfileLoading && !queryState.repositoryCommunityProfile
        ? "loading"
        : repositoryCommunityProfileStatusUnavailable
          ? "unavailable"
          : queryState.repositoryCommunityProfile?.healthPercentage != null
            ? `${queryState.repositoryCommunityProfile.healthPercentage}%`
            : "unknown",
    repositoryCommunityProfileStatusUnavailable,
    repositoryRulesetsAvailabilityMessage,
    repositoryRulesetsStatusLabel:
      queryState.repositoryRulesetsLoading && queryState.repositoryRulesets.length === 0
        ? "loading"
        : Boolean(queryState.repositoryRulesetsError) || Boolean(repositoryRulesetsAvailabilityMessage)
          ? "unavailable"
          : queryState.repositoryRulesets.length === 0
            ? "none"
            : `${queryState.repositoryRulesets.length} rulesets`,
    repositoryRulesetsStatusUnavailable:
      Boolean(queryState.repositoryRulesetsError) || Boolean(repositoryRulesetsAvailabilityMessage),
    repositorySecurityAdvisoriesAvailabilityMessage,
    repositorySecurityAdvisoriesStatusLabel:
      queryState.repositorySecurityAdvisoriesLoading && queryState.repositorySecurityAdvisories.length === 0
        ? "loading"
        : Boolean(queryState.repositorySecurityAdvisoriesError) ||
            Boolean(repositorySecurityAdvisoriesAvailabilityMessage)
          ? "unavailable"
          : queryState.repositorySecurityAdvisories.length === 0
            ? "clear"
            : `${queryState.repositorySecurityAdvisories.length} advisories`,
    repositorySecurityAdvisoriesStatusUnavailable:
      Boolean(queryState.repositorySecurityAdvisoriesError) ||
      Boolean(repositorySecurityAdvisoriesAvailabilityMessage),
    repositorySecurityPolicyAvailabilityMessage,
    repositorySecurityPolicyStatusLabel:
      queryState.repositorySecurityPolicyLoading && !queryState.repositorySecurityPolicy
        ? "loading"
        : queryState.repositorySecurityPolicyError
          ? "unavailable"
          : repositorySecurityPolicyAvailabilityLabel
            ? repositorySecurityPolicyAvailabilityLabel
            : securityPolicy
              ? "found"
              : queryState.repositorySecurityPolicy
                ? "not configured"
                : "unknown",
    repositorySecurityPolicyStatusUnavailable:
      Boolean(queryState.repositorySecurityPolicyError) ||
      Boolean(repositorySecurityPolicyAvailabilityMessage),
    secretScanningAvailabilityMessage,
    secretScanningStatusLabel: securityAlertStatusLabel(
      queryState.secretScanningAlertsLoading,
      secretScanningStatusUnavailable,
      queryState.secretScanningAlerts.length,
      queryState.secretScanningAlertState
    ),
    secretScanningStatusUnavailable,
    securityFeatureRows: repositorySecurityFeatureRows(repository.administration.securityAndAnalysis),
    securityMutationDisabledReason,
    securityMutationRelevant,
    administrationAvailabilityLabel: readAvailabilityStatusLabel(
      repository.administrationAvailability ?? null
    ),
    administrationAvailabilityMessage
  };
}

function SecurityListDepthControl({
  count,
  limit,
  loadMoreLabel,
  maxNote,
  onExpand
}: {
  count: number;
  limit: number;
  loadMoreLabel: string;
  maxNote: string;
  onExpand(): void;
}): JSX.Element | null {
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

function BranchProtectionSurface({
  availabilityMessage,
  branch,
  branchLabel,
  branches,
  branchesDisabled,
  branchesNote,
  error,
  hasBranchOption,
  hasProtectionResult,
  loading,
  mutationAction,
  mutationDisabledReason,
  mutationError,
  mutationPending,
  mutationRelevant,
  mutationSucceeded,
  protection,
  statusLabel,
  statusUnavailable,
  onApplyBaselineProtection,
  onDeleteProtection,
  onSelectBranch
}: {
  availabilityMessage: string | null;
  branch: string | null;
  branchLabel: string;
  branches: BranchSummary[];
  branchesDisabled: boolean;
  branchesNote: string | null;
  error: Error | null;
  hasBranchOption: boolean;
  hasProtectionResult: boolean;
  loading: boolean;
  mutationAction: GitHubAction | null;
  mutationDisabledReason: string | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationRelevant: boolean;
  mutationSucceeded: boolean;
  protection: BranchProtectionSummary | null;
  statusLabel: string;
  statusUnavailable: boolean;
  onApplyBaselineProtection(): void;
  onDeleteProtection(): void;
  onSelectBranch(ref: string): void;
}): JSX.Element {
  function handleBranchChange(event: ChangeEvent<HTMLSelectElement>): void {
    const ref = event.currentTarget.value;
    if (ref) {
      onSelectBranch(ref);
    }
  }

  return (
    <>
      <div className="table-action-row">
        <label className="ref-picker">
          <GitBranch size={16} />
          <select
            aria-label="Branch protection branch"
            disabled={branchesDisabled || branches.length === 0}
            value={branch ?? ""}
            onChange={handleBranchChange}
          >
            {branch && !hasBranchOption && <option value={branch}>{branch}</option>}
            {!branch && <option value="">No branch selected</option>}
            {branches.map((branchOption) => (
              <option key={`security-quality-branch-${branchOption.name}`} value={branchOption.name}>
                {branchOption.name}
                {branchOption.protected ? " (protected)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        {branchesNote && <small className="action-disabled-note">{branchesNote}</small>}
      </div>
      <section className="security-protection-summary" aria-label="Branch protection">
        <header>
          <div>
            <h2>Branch protection</h2>
            <small>{branchLabel}</small>
          </div>
          <span className={`state-chip ${statusUnavailable ? "attention" : protection ? "success" : ""}`}>
            {statusLabel}
          </span>
        </header>
        {loading && !hasProtectionResult && <div className="loading-state">Loading branch protection…</div>}
        {error && <div className="error-state">Branch protection unavailable: {error.message}</div>}
        {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
        {mutationRelevant && mutationPending && (
          <div className="loading-state" role="status">
            Running security action: {githubActionLabel(mutationAction)}.
          </div>
        )}
        {mutationRelevant && !mutationPending && mutationSucceeded && (
          <div className="success-state" role="status">
            Security action completed: {githubActionLabel(mutationAction)}.
          </div>
        )}
        {mutationRelevant && !mutationPending && mutationError && (
          <div className="error-state" role="alert">
            Security action failed: {githubActionLabel(mutationAction)}. {mutationError.message}
          </div>
        )}
        <div className="security-management-actions">
          <button
            type="button"
            disabled={Boolean(mutationDisabledReason)}
            title={mutationDisabledReason ?? undefined}
            onClick={onApplyBaselineProtection}
          >
            <ShieldCheck size={15} /> Apply baseline protection
          </button>
          <button
            type="button"
            disabled={Boolean(mutationDisabledReason) || !protection}
            title={
              mutationDisabledReason ??
              (!protection ? "No branch protection is configured for this branch." : undefined)
            }
            onClick={onDeleteProtection}
          >
            <X size={15} /> Delete protection
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
        {!loading && !error && !availabilityMessage && !protection && (
          <div className="empty-state">No branch protection data returned.</div>
        )}
      </section>
    </>
  );
}

function RepositorySecurityAdvisoryCard({
  advisory,
  active,
  repositoryNameWithOwner,
  onSelectSecurityItem
}: {
  advisory: RepositorySecurityAdvisorySummary;
  active: boolean;
  repositoryNameWithOwner: string;
  onSelectSecurityItem: SelectSecurityItem;
}): JSX.Element {
  function handleInspect(): void {
    onSelectSecurityItem({
      kind: "advisory",
      id: advisory.ghsaId,
      title: advisory.summary,
      subtitle: `${repositoryNameWithOwner} advisory · ${advisory.ghsaId}`,
      url: advisory.htmlUrl,
      state: advisory.state,
      severity: advisory.severity,
      ghsaId: advisory.ghsaId,
      cveId: advisory.cveId,
      updatedAt: advisory.updatedAt
    });
  }

  return (
    <article className={`workflow-job-card ${active ? "active" : ""}`}>
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
        <button type="button" onClick={handleInspect}>
          <ShieldCheck size={15} /> Inspect
        </button>
      </div>
    </article>
  );
}

function DependabotAlertCard({
  alert,
  active,
  repositoryNameWithOwner,
  defaultSecurityRef,
  onOpenSecurityPath,
  onSelectSecurityItem
}: {
  alert: DependabotAlertSummary;
  active: boolean;
  repositoryNameWithOwner: string;
  defaultSecurityRef: string | null;
  onOpenSecurityPath: OpenSecurityPath;
  onSelectSecurityItem: SelectSecurityItem;
}): JSX.Element {
  const manifestDisabledReason = securityPathDisabledReason(alert.manifestPath, "Manifest");

  function handleInspect(): void {
    onSelectSecurityItem({
      kind: "dependabot",
      id: String(alert.number),
      title: alert.packageName ?? `Dependabot alert #${alert.number}`,
      subtitle: `${repositoryNameWithOwner} Dependabot alert #${alert.number}`,
      url: alert.htmlUrl,
      state: alert.state,
      severity: alert.severity,
      path: alert.manifestPath,
      packageName: alert.packageName,
      updatedAt: alert.updatedAt
    });
  }

  function handleOpenManifest(): void {
    onOpenSecurityPath(alert.manifestPath, defaultSecurityRef);
  }

  return (
    <article className={`workflow-job-card ${active ? "active" : ""}`}>
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
        <button type="button" onClick={handleInspect}>
          <ShieldCheck size={15} /> Inspect
        </button>
        <button
          type="button"
          disabled={Boolean(manifestDisabledReason)}
          title={manifestDisabledReason ?? undefined}
          onClick={handleOpenManifest}
        >
          Open manifest in Control
        </button>
      </div>
      {manifestDisabledReason && <small className="action-disabled-note">{manifestDisabledReason}</small>}
    </article>
  );
}

function CodeScanningAlertCard({
  alert,
  active,
  repositoryNameWithOwner,
  onOpenSecurityPath,
  onSelectSecurityItem
}: {
  alert: CodeScanningAlertSummary;
  active: boolean;
  repositoryNameWithOwner: string;
  onOpenSecurityPath: OpenSecurityPath;
  onSelectSecurityItem: SelectSecurityItem;
}): JSX.Element {
  const codePathDisabledReason = securityPathDisabledReason(alert.path, "Code alert");

  function handleInspect(): void {
    onSelectSecurityItem({
      kind: "codeScanning",
      id: String(alert.number),
      title: alert.ruleName ?? alert.ruleId ?? `Code scanning alert #${alert.number}`,
      subtitle: `${repositoryNameWithOwner} code scanning alert #${alert.number}`,
      url: alert.htmlUrl,
      state: alert.state,
      severity: alert.severity,
      path: alert.path,
      rule: alert.ruleName ?? alert.ruleId,
      updatedAt: alert.updatedAt
    });
  }

  function handleOpenFile(): void {
    onOpenSecurityPath(alert.path, alert.ref, alert.startLine);
  }

  return (
    <article className={`workflow-job-card ${active ? "active" : ""}`}>
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
        <button type="button" onClick={handleInspect}>
          <ShieldCheck size={15} /> Inspect
        </button>
        <button
          type="button"
          disabled={Boolean(codePathDisabledReason)}
          title={codePathDisabledReason ?? undefined}
          onClick={handleOpenFile}
        >
          Open file in Control
        </button>
      </div>
      {codePathDisabledReason && <small className="action-disabled-note">{codePathDisabledReason}</small>}
    </article>
  );
}

function SecretScanningAlertCard({
  alert,
  active,
  repositoryNameWithOwner,
  defaultSecurityRef,
  onOpenSecurityPath,
  onSelectSecurityItem
}: {
  alert: SecretScanningAlertSummary;
  active: boolean;
  repositoryNameWithOwner: string;
  defaultSecurityRef: string | null;
  onOpenSecurityPath: OpenSecurityPath;
  onSelectSecurityItem: SelectSecurityItem;
}): JSX.Element {
  const secretLocationDisabledReason = securityPathDisabledReason(alert.firstLocationPath, "Secret location");

  function handleInspect(): void {
    onSelectSecurityItem({
      kind: "secretScanning",
      id: String(alert.number),
      title: alert.secretTypeDisplayName ?? alert.secretType ?? `Secret scanning alert #${alert.number}`,
      subtitle: `${repositoryNameWithOwner} secret scanning alert #${alert.number}`,
      url: alert.htmlUrl,
      state: alert.state,
      severity: alert.validity,
      path: alert.firstLocationPath,
      rule: alert.secretTypeDisplayName ?? alert.secretType,
      updatedAt: alert.updatedAt
    });
  }

  function handleOpenLocation(): void {
    onOpenSecurityPath(alert.firstLocationPath, defaultSecurityRef, alert.firstLocationStartLine);
  }

  return (
    <article className={`workflow-job-card ${active ? "active" : ""}`}>
      <header>
        <strong>{alert.secretTypeDisplayName ?? alert.secretType ?? `Alert ${alert.number}`}</strong>
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
        <button type="button" onClick={handleInspect}>
          <ShieldCheck size={15} /> Inspect
        </button>
        <button
          type="button"
          disabled={Boolean(secretLocationDisabledReason)}
          title={secretLocationDisabledReason ?? undefined}
          onClick={handleOpenLocation}
        >
          Open location in Control
        </button>
      </div>
      {secretLocationDisabledReason && (
        <small className="action-disabled-note">{secretLocationDisabledReason}</small>
      )}
    </article>
  );
}

function RepositoryRulesetCard({
  active,
  ruleset,
  getMutationDisabledReason,
  onDeleteRuleset,
  onInspectRuleset,
  onReapplyRuleset
}: {
  active: boolean;
  ruleset: RepositoryRulesetSummary;
  getMutationDisabledReason(ruleset: RepositoryRulesetSummary): string | null;
  onDeleteRuleset(ruleset: RepositoryRulesetSummary): void;
  onInspectRuleset(ruleset: RepositoryRulesetSummary): void;
  onReapplyRuleset(ruleset: RepositoryRulesetSummary): void;
}): JSX.Element {
  const rulesetDisabledReason = getMutationDisabledReason(ruleset);

  function handleReapplyRuleset(): void {
    onReapplyRuleset(ruleset);
  }

  function handleDeleteRuleset(): void {
    onDeleteRuleset(ruleset);
  }

  function handleInspectRuleset(): void {
    onInspectRuleset(ruleset);
  }

  return (
    <article className={`workflow-job-card ${active ? "active" : ""}`}>
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
      {(ruleset.rules.length > 0 || ruleset.conditions.length > 0 || ruleset.bypassActors.length > 0) && (
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
        <button
          type="button"
          disabled={Boolean(rulesetDisabledReason)}
          title={rulesetDisabledReason ?? undefined}
          onClick={handleReapplyRuleset}
        >
          <ShieldCheck size={15} /> Reapply baseline
        </button>
        <button
          type="button"
          disabled={Boolean(rulesetDisabledReason)}
          title={rulesetDisabledReason ?? undefined}
          onClick={handleDeleteRuleset}
        >
          <X size={15} /> Delete
        </button>
        <button type="button" onClick={handleInspectRuleset}>
          <ShieldCheck size={15} /> Inspect
        </button>
      </div>
    </article>
  );
}

function RepositoryRulesetsSection({
  createRulesetDisabledReason,
  limit,
  loading,
  error,
  availabilityMessage,
  repositoryRulesetsStatusLabel,
  repositoryRulesetsStatusUnavailable,
  rulesets,
  getMutationDisabledReason,
  onCreateActiveRuleset,
  onCreateEvaluateRuleset,
  onDeleteRuleset,
  onExpand,
  onInspectRuleset,
  onReapplyRuleset,
  securityItemActive
}: {
  createRulesetDisabledReason: string | null;
  limit: number;
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  repositoryRulesetsStatusLabel: string;
  repositoryRulesetsStatusUnavailable: boolean;
  rulesets: RepositoryRulesetSummary[];
  getMutationDisabledReason(ruleset: RepositoryRulesetSummary): string | null;
  onCreateActiveRuleset(): void;
  onCreateEvaluateRuleset(): void;
  onDeleteRuleset(ruleset: RepositoryRulesetSummary): void;
  onExpand(): void;
  onInspectRuleset(ruleset: RepositoryRulesetSummary): void;
  onReapplyRuleset(ruleset: RepositoryRulesetSummary): void;
  securityItemActive: SecurityItemActive;
}): JSX.Element {
  return (
    <section className="security-protection-summary" aria-label="Repository rulesets">
      <header>
        <div>
          <h2>Repository rulesets</h2>
          <small>Branch and tag rules returned by GitHub, including inherited rules when visible.</small>
        </div>
        <span
          className={`state-chip ${
            repositoryRulesetsStatusUnavailable ? "attention" : rulesets.length === 0 ? "" : "success"
          }`}
        >
          {repositoryRulesetsStatusLabel}
        </span>
      </header>
      {loading && rulesets.length === 0 && <div className="loading-state">Loading repository rulesets…</div>}
      {error && <div className="error-state">Repository rulesets unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      <div className="security-management-actions">
        <button
          type="button"
          disabled={Boolean(createRulesetDisabledReason)}
          title={createRulesetDisabledReason ?? undefined}
          onClick={onCreateActiveRuleset}
        >
          <Plus size={15} /> Create baseline ruleset
        </button>
        <button
          type="button"
          disabled={Boolean(createRulesetDisabledReason)}
          title={createRulesetDisabledReason ?? undefined}
          onClick={onCreateEvaluateRuleset}
        >
          <ShieldCheck size={15} /> Create evaluate ruleset
        </button>
      </div>
      {!loading && !error && !availabilityMessage && rulesets.length === 0 && (
        <div className="empty-state">No repository rulesets returned.</div>
      )}
      <SecurityListDepthControl
        count={rulesets.length}
        limit={limit}
        loadMoreLabel="Load more rulesets"
        maxNote={`Showing the first ${limit} repository rulesets returned by GitHub.`}
        onExpand={onExpand}
      />
      {rulesets.length > 0 && (
        <div className="workflow-detail-grid">
          {rulesets.map((ruleset) => (
            <RepositoryRulesetCard
              active={securityItemActive("ruleset", ruleset.id)}
              getMutationDisabledReason={getMutationDisabledReason}
              key={ruleset.id}
              onDeleteRuleset={onDeleteRuleset}
              onInspectRuleset={onInspectRuleset}
              onReapplyRuleset={onReapplyRuleset}
              ruleset={ruleset}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RepositorySecurityAdvisoriesSection({
  advisories,
  availabilityMessage,
  error,
  limit,
  loading,
  repositoryNameWithOwner,
  statusLabel,
  statusUnavailable,
  onExpand,
  onSelectSecurityItem,
  securityItemActive
}: {
  advisories: RepositorySecurityAdvisorySummary[];
  availabilityMessage: string | null;
  error: Error | null;
  limit: number;
  loading: boolean;
  repositoryNameWithOwner: string;
  statusLabel: string;
  statusUnavailable: boolean;
  onExpand(): void;
  onSelectSecurityItem: SelectSecurityItem;
  securityItemActive: SecurityItemActive;
}): JSX.Element {
  return (
    <section className="security-protection-summary" aria-label="Security advisories">
      <header>
        <div>
          <h2>Security advisories</h2>
          <small>Repository advisories returned by GitHub for coordinated vulnerability disclosure.</small>
        </div>
        <span
          className={`state-chip ${
            loading && advisories.length === 0
              ? ""
              : statusUnavailable || advisories.length > 0
                ? "attention"
                : "success"
          }`}
        >
          {statusLabel}
        </span>
      </header>
      {loading && advisories.length === 0 && (
        <div className="loading-state">Loading security advisories…</div>
      )}
      {error && <div className="error-state">Security advisories unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && advisories.length === 0 && (
        <div className="empty-state">No repository security advisories returned.</div>
      )}
      <SecurityListDepthControl
        count={advisories.length}
        limit={limit}
        loadMoreLabel="Load more advisories"
        maxNote={`Showing the first ${limit} security advisories returned by GitHub.`}
        onExpand={onExpand}
      />
      {advisories.length > 0 && (
        <div className="workflow-detail-grid">
          {advisories.map((advisory) => (
            <RepositorySecurityAdvisoryCard
              active={securityItemActive("advisory", advisory.ghsaId)}
              advisory={advisory}
              key={advisory.ghsaId}
              onSelectSecurityItem={onSelectSecurityItem}
              repositoryNameWithOwner={repositoryNameWithOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SecurityPolicySection({
  availabilityMessage,
  defaultBranch,
  error,
  hasPolicyResult,
  loading,
  policy,
  policyExpanded,
  policyHasFullPreview,
  statusLabel,
  statusUnavailable,
  visiblePolicyContent,
  onOpenSecurityPath,
  onTogglePolicyPreview
}: {
  availabilityMessage: string | null;
  defaultBranch: string | null;
  error: Error | null;
  hasPolicyResult: boolean;
  loading: boolean;
  policy: RepositorySecurityPolicy | null;
  policyExpanded: boolean;
  policyHasFullPreview: boolean;
  statusLabel: string;
  statusUnavailable: boolean;
  visiblePolicyContent: string;
  onOpenSecurityPath: OpenSecurityPath;
  onTogglePolicyPreview(): void;
}): JSX.Element {
  function handleOpenPolicy(): void {
    if (policy) {
      onOpenSecurityPath(policy.path, policy.ref);
    }
  }

  return (
    <section className="security-protection-summary" aria-label="Security policy">
      <header>
        <div>
          <h2>Security policy</h2>
          <small>Read-only SECURITY.md surfaced from GitHub when configured.</small>
        </div>
        <span className={`state-chip ${statusUnavailable ? "attention" : policy ? "success" : ""}`}>
          {statusLabel}
        </span>
      </header>
      {loading && !hasPolicyResult && <div className="loading-state">Loading security policy…</div>}
      {error && <div className="error-state">Security policy unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && hasPolicyResult && !policy && (
        <div className="empty-state">
          No security policy file found in SECURITY.md, .github/SECURITY.md, or docs/SECURITY.md.
        </div>
      )}
      {policy && (
        <article className="workflow-job-card">
          <header>
            <strong>{policy.path}</strong>
            <span className="state-chip success">{formatCompactNumber(policy.size ?? 0)} bytes</span>
          </header>
          <small>
            {policy.sha ? `SHA ${policy.sha.slice(0, 12)}` : "SHA unavailable"} ·{" "}
            {policy.ref ?? defaultBranch ?? "default branch"}
          </small>
          {policy.content ? (
            <>
              <pre className="code-preview">{visiblePolicyContent}</pre>
              {policyHasFullPreview && (
                <button type="button" onClick={onTogglePolicyPreview}>
                  <small>{policyExpanded ? "Show preview" : "Show full policy"}</small>
                </button>
              )}
            </>
          ) : (
            <div className="empty-state">Policy content is too large or unavailable for preview.</div>
          )}
          <div>
            <button type="button" onClick={handleOpenPolicy}>
              <FileIcon size={15} /> Open in Control
            </button>
          </div>
        </article>
      )}
    </section>
  );
}

function CommunityProfileFileCard({
  file,
  onOpenSecurityPath
}: {
  file: CommunityProfileFileSummary;
  onOpenSecurityPath: OpenSecurityPath;
}): JSX.Element {
  const disabledReason = securityPathDisabledReason(file.path, file.label);

  function handleOpenFile(): void {
    onOpenSecurityPath(file.path, null);
  }

  return (
    <article className="workflow-job-card">
      <header>
        <strong>{file.label}</strong>
        <span className="state-chip success">found</span>
      </header>
      <small>{file.path ?? file.name ?? "Path unavailable"}</small>
      <div>
        <button
          type="button"
          disabled={!file.path}
          title={disabledReason ?? undefined}
          onClick={handleOpenFile}
        >
          <FileIcon size={15} /> Open in Control
        </button>
      </div>
    </article>
  );
}

function CommunityProfileSection({
  availabilityMessage,
  error,
  loading,
  missingFiles,
  presentFiles,
  profile,
  statusLabel,
  statusUnavailable,
  onOpenSecurityPath
}: {
  availabilityMessage: string | null;
  error: Error | null;
  loading: boolean;
  missingFiles: CommunityProfileFileSummary[];
  presentFiles: CommunityProfileFileSummary[];
  profile: RepositoryCommunityProfile | null;
  statusLabel: string;
  statusUnavailable: boolean;
  onOpenSecurityPath: OpenSecurityPath;
}): JSX.Element {
  return (
    <section className="security-protection-summary" aria-label="Community profile">
      <header>
        <div>
          <h2>Community profile</h2>
          <small>Repository community standards returned by GitHub.</small>
        </div>
        <span className={`state-chip ${statusUnavailable ? "attention" : "success"}`}>{statusLabel}</span>
      </header>
      {loading && !profile && <div className="loading-state">Loading community profile…</div>}
      {error && <div className="error-state">Community profile unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && !profile && (
        <div className="empty-state">No community profile returned.</div>
      )}
      {profile && (
        <>
          <div className="insight-grid">
            <article className="metric-tile">
              <strong>{profile.healthPercentage != null ? `${profile.healthPercentage}%` : "Unknown"}</strong>
              <small>Health score</small>
              <span>{profile.description ?? "No community profile description"}</span>
            </article>
            <article className="metric-tile">
              <strong>{formatCompactNumber(presentFiles.length)}</strong>
              <small>Standards found</small>
              <span>{formatCompactNumber(missingFiles.length)} missing standards</span>
            </article>
          </div>
          {presentFiles.length > 0 ? (
            <div className="workflow-detail-grid">
              {presentFiles.map((file) => (
                <CommunityProfileFileCard
                  file={file}
                  key={file.key}
                  onOpenSecurityPath={onOpenSecurityPath}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">No community standard files returned.</div>
          )}
          {missingFiles.length > 0 && (
            <div className="label-stack branch-protection-checks">
              {missingFiles.map((file) => (
                <span key={file.key}>Missing {file.label}</span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SecurityFeatureAvailabilitySection({
  availabilityLabel,
  availabilityMessage,
  rows
}: {
  availabilityLabel: string | null;
  availabilityMessage: string | null;
  rows: Array<[string, string | null]>;
}): JSX.Element {
  const returnedFeatureCount = rows.filter(([, status]) => status !== null).length;

  return (
    <section className="security-protection-summary" aria-label="Security feature availability">
      <header>
        <div>
          <h2>Security feature availability</h2>
          <small>Repository-level feature statuses returned by GitHub settings metadata.</small>
        </div>
        <span className={`state-chip ${availabilityLabel ? "attention" : ""}`}>
          {availabilityLabel ?? `${formatCompactNumber(returnedFeatureCount)} returned`}
        </span>
      </header>
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      <div className="workflow-summary branch-protection-flags">
        {rows.map(([label, status]) => (
          <span key={label}>
            {label}: {securityFeatureStatusLabel(status)}
          </span>
        ))}
      </div>
    </section>
  );
}

function SecurityAlertStateFilterControl<TValue extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<StateSegmentedControlOption<TValue>>;
  value: TValue;
  onChange(value: TValue): void;
}): JSX.Element {
  return (
    <FilterBar label="State">
      <StateSegmentedControl label={label} options={options} value={value} onChange={onChange} />
    </FilterBar>
  );
}

function DependabotAlertsSection({
  alerts,
  availabilityMessage,
  defaultSecurityRef,
  error,
  alertState,
  limit,
  loading,
  repositoryNameWithOwner,
  statusLabel,
  statusUnavailable,
  onExpand,
  onOpenSecurityPath,
  onSelectSecurityItem,
  onAlertStateChange,
  securityItemActive
}: {
  alerts: DependabotAlertSummary[];
  availabilityMessage: string | null;
  defaultSecurityRef: string | null;
  error: Error | null;
  alertState: DependabotAlertStateFilter;
  limit: number;
  loading: boolean;
  repositoryNameWithOwner: string;
  statusLabel: string;
  statusUnavailable: boolean;
  onExpand(): void;
  onOpenSecurityPath: OpenSecurityPath;
  onSelectSecurityItem: SelectSecurityItem;
  onAlertStateChange(value: DependabotAlertStateFilter): void;
  securityItemActive: SecurityItemActive;
}): JSX.Element {
  const alertStateLabel = securityAlertStateSentenceLabel(alertState);

  return (
    <section className="security-protection-summary" aria-label="Dependabot alerts">
      <header>
        <div>
          <h2>Dependabot alerts</h2>
          <small>{alertStateLabel} vulnerability alerts returned by GitHub for this repository.</small>
        </div>
        <span
          className={`state-chip ${
            loading && alerts.length === 0
              ? ""
              : statusUnavailable || alerts.length > 0
                ? "attention"
                : "success"
          }`}
        >
          {statusLabel}
        </span>
      </header>
      <SecurityAlertStateFilterControl
        label="Dependabot alert state"
        options={dependabotAlertStateFilterOptions}
        value={alertState}
        onChange={onAlertStateChange}
      />
      {loading && alerts.length === 0 && <div className="loading-state">Loading Dependabot alerts…</div>}
      {error && <div className="error-state">Dependabot alerts unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && alerts.length === 0 && (
        <div className="empty-state">{securityAlertEmptyStateLabel(alertState, "Dependabot alerts")}</div>
      )}
      <SecurityListDepthControl
        count={alerts.length}
        limit={limit}
        loadMoreLabel="Load more Dependabot alerts"
        maxNote={`Showing the first ${limit} Dependabot alerts returned by GitHub.`}
        onExpand={onExpand}
      />
      {alerts.length > 0 && (
        <div className="workflow-detail-grid">
          {alerts.map((alert) => (
            <DependabotAlertCard
              active={securityItemActive("dependabot", alert.number)}
              alert={alert}
              defaultSecurityRef={defaultSecurityRef}
              key={alert.number}
              onOpenSecurityPath={onOpenSecurityPath}
              onSelectSecurityItem={onSelectSecurityItem}
              repositoryNameWithOwner={repositoryNameWithOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CodeScanningAlertsSection({
  alerts,
  availabilityMessage,
  error,
  alertState,
  limit,
  loading,
  repositoryNameWithOwner,
  statusLabel,
  statusUnavailable,
  onExpand,
  onOpenSecurityPath,
  onSelectSecurityItem,
  onAlertStateChange,
  securityItemActive
}: {
  alerts: CodeScanningAlertSummary[];
  availabilityMessage: string | null;
  error: Error | null;
  alertState: CodeScanningAlertStateFilter;
  limit: number;
  loading: boolean;
  repositoryNameWithOwner: string;
  statusLabel: string;
  statusUnavailable: boolean;
  onExpand(): void;
  onOpenSecurityPath: OpenSecurityPath;
  onSelectSecurityItem: SelectSecurityItem;
  onAlertStateChange(value: CodeScanningAlertStateFilter): void;
  securityItemActive: SecurityItemActive;
}): JSX.Element {
  const alertStateLabel = securityAlertStateSentenceLabel(alertState);

  return (
    <section className="security-protection-summary" aria-label="Code scanning alerts">
      <header>
        <div>
          <h2>Code scanning alerts</h2>
          <small>{alertStateLabel} static analysis findings returned by GitHub for this repository.</small>
        </div>
        <span
          className={`state-chip ${
            loading && alerts.length === 0
              ? ""
              : statusUnavailable || alerts.length > 0
                ? "attention"
                : "success"
          }`}
        >
          {statusLabel}
        </span>
      </header>
      <SecurityAlertStateFilterControl
        label="Code scanning alert state"
        options={codeScanningAlertStateFilterOptions}
        value={alertState}
        onChange={onAlertStateChange}
      />
      {loading && alerts.length === 0 && <div className="loading-state">Loading code scanning alerts…</div>}
      {error && <div className="error-state">Code scanning alerts unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && alerts.length === 0 && (
        <div className="empty-state">{securityAlertEmptyStateLabel(alertState, "code scanning alerts")}</div>
      )}
      <SecurityListDepthControl
        count={alerts.length}
        limit={limit}
        loadMoreLabel="Load more code scanning alerts"
        maxNote={`Showing the first ${limit} code scanning alerts returned by GitHub.`}
        onExpand={onExpand}
      />
      {alerts.length > 0 && (
        <div className="workflow-detail-grid">
          {alerts.map((alert) => (
            <CodeScanningAlertCard
              active={securityItemActive("codeScanning", alert.number)}
              alert={alert}
              key={alert.number}
              onOpenSecurityPath={onOpenSecurityPath}
              onSelectSecurityItem={onSelectSecurityItem}
              repositoryNameWithOwner={repositoryNameWithOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SecretScanningAlertsSection({
  alerts,
  availabilityMessage,
  defaultSecurityRef,
  error,
  alertState,
  limit,
  loading,
  repositoryNameWithOwner,
  statusLabel,
  statusUnavailable,
  onExpand,
  onOpenSecurityPath,
  onSelectSecurityItem,
  onAlertStateChange,
  securityItemActive
}: {
  alerts: SecretScanningAlertSummary[];
  availabilityMessage: string | null;
  defaultSecurityRef: string | null;
  error: Error | null;
  alertState: SecretScanningAlertStateFilter;
  limit: number;
  loading: boolean;
  repositoryNameWithOwner: string;
  statusLabel: string;
  statusUnavailable: boolean;
  onExpand(): void;
  onOpenSecurityPath: OpenSecurityPath;
  onSelectSecurityItem: SelectSecurityItem;
  onAlertStateChange(value: SecretScanningAlertStateFilter): void;
  securityItemActive: SecurityItemActive;
}): JSX.Element {
  const alertStateLabel = securityAlertStateSentenceLabel(alertState);

  return (
    <section className="security-protection-summary" aria-label="Secret scanning alerts">
      <header>
        <div>
          <h2>Secret scanning alerts</h2>
          <small>{alertStateLabel} leaked-secret alerts returned by GitHub for this repository.</small>
        </div>
        <span
          className={`state-chip ${
            loading && alerts.length === 0
              ? ""
              : statusUnavailable || alerts.length > 0
                ? "attention"
                : "success"
          }`}
        >
          {statusLabel}
        </span>
      </header>
      <SecurityAlertStateFilterControl
        label="Secret scanning alert state"
        options={secretScanningAlertStateFilterOptions}
        value={alertState}
        onChange={onAlertStateChange}
      />
      {loading && alerts.length === 0 && <div className="loading-state">Loading secret scanning alerts…</div>}
      {error && <div className="error-state">Secret scanning alerts unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && alerts.length === 0 && (
        <div className="empty-state">
          {securityAlertEmptyStateLabel(alertState, "secret scanning alerts")}
        </div>
      )}
      <SecurityListDepthControl
        count={alerts.length}
        limit={limit}
        loadMoreLabel="Load more secret scanning alerts"
        maxNote={`Showing the first ${limit} secret scanning alerts returned by GitHub.`}
        onExpand={onExpand}
      />
      {alerts.length > 0 && (
        <div className="workflow-detail-grid">
          {alerts.map((alert) => (
            <SecretScanningAlertCard
              active={securityItemActive("secretScanning", alert.number)}
              alert={alert}
              defaultSecurityRef={defaultSecurityRef}
              key={alert.number}
              onOpenSecurityPath={onOpenSecurityPath}
              onSelectSecurityItem={onSelectSecurityItem}
              repositoryNameWithOwner={repositoryNameWithOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SecurityQualityLinkButton({
  link,
  repositoryNameWithOwner,
  onOpenRepositoryPath
}: {
  link: SecurityQualityLink;
  repositoryNameWithOwner: string;
  onOpenRepositoryPath(path: string): void;
}): JSX.Element {
  const Icon = link.icon;

  function handleOpenLink(): void {
    onOpenRepositoryPath(link.path);
  }

  return (
    <button className="project-tile" type="button" onClick={handleOpenLink}>
      <Icon size={20} />
      <strong>{link.title}</strong>
      <small>{repositoryNameWithOwner}</small>
    </button>
  );
}

function SecurityQualityLinks({
  repositoryNameWithOwner,
  onOpenRepositoryPath
}: {
  repositoryNameWithOwner: string;
  onOpenRepositoryPath(path: string): void;
}): JSX.Element {
  return (
    <section className="tile-grid">
      {securityQualityLinks.map((link) => (
        <SecurityQualityLinkButton
          key={link.title}
          link={link}
          onOpenRepositoryPath={onOpenRepositoryPath}
          repositoryNameWithOwner={repositoryNameWithOwner}
        />
      ))}
    </section>
  );
}

interface SecurityQualityTabSectionsProps {
  administrationAvailabilityLabel: string | null;
  administrationAvailabilityMessage: string | null;
  availabilityMessage: string | null;
  branchProtection: unknown;
  branchProtectionBranch: string | null;
  branchProtectionBranchLabel: string;
  branchProtectionBranches: BranchSummary[];
  branchProtectionBranchesDisabled: boolean;
  branchProtectionBranchesNote: string | null;
  branchProtectionError: Error | null;
  branchProtectionLoading: boolean;
  branchProtectionMutationDisabledReason: string | null;
  branchProtectionStatusLabel: string;
  branchProtectionStatusUnavailable: boolean;
  codeScanningAlertState: CodeScanningAlertStateFilter;
  codeScanningAlerts: CodeScanningAlertSummary[];
  codeScanningAlertsError: Error | null;
  codeScanningAlertsLimit: number;
  codeScanningAlertsLoading: boolean;
  codeScanningAvailabilityMessage: string | null;
  codeScanningStatusLabel: string;
  codeScanningStatusUnavailable: boolean;
  createRulesetDisabledReason: string | null;
  defaultSecurityRef: string | null;
  dependabotAlertState: DependabotAlertStateFilter;
  dependabotAlerts: DependabotAlertSummary[];
  dependabotAlertsError: Error | null;
  dependabotAlertsLimit: number;
  dependabotAlertsLoading: boolean;
  dependabotAvailabilityMessage: string | null;
  dependabotStatusLabel: string;
  dependabotStatusUnavailable: boolean;
  focusedSecurityItemMessage: string | null;
  hasBranchProtectionBranchOption: boolean;
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  onExpandCodeScanningAlerts(): void;
  onExpandDependabotAlerts(): void;
  onExpandRepositoryRulesets(): void;
  onExpandRepositorySecurityAdvisories(): void;
  onExpandSecretScanningAlerts(): void;
  onCodeScanningAlertStateChange(value: CodeScanningAlertStateFilter): void;
  onDependabotAlertStateChange(value: DependabotAlertStateFilter): void;
  onOpenExternal(url: string): void;
  onSecretScanningAlertStateChange(value: SecretScanningAlertStateFilter): void;
  onSelectSecurityItem: SelectSecurityItem;
  onSelectSecurityQualityBranch(ref: string): void;
  presentCommunityFiles: CommunityProfileFileSummary[];
  missingCommunityFiles: CommunityProfileFileSummary[];
  protection: BranchProtectionSummary | null;
  repository: RepositoryDetail;
  repositoryCommunityProfile: RepositoryCommunityProfile | null;
  repositoryCommunityProfileAvailabilityMessage: string | null;
  repositoryCommunityProfileError: Error | null;
  repositoryCommunityProfileLoading: boolean;
  repositoryCommunityProfileStatusLabel: string;
  repositoryCommunityProfileStatusUnavailable: boolean;
  repositoryRulesets: RepositoryRulesetSummary[];
  repositoryRulesetsAvailabilityMessage: string | null;
  repositoryRulesetsError: Error | null;
  repositoryRulesetsLimit: number;
  repositoryRulesetsLoading: boolean;
  repositoryRulesetsStatusLabel: string;
  repositoryRulesetsStatusUnavailable: boolean;
  repositorySecurityAdvisories: RepositorySecurityAdvisorySummary[];
  repositorySecurityAdvisoriesAvailabilityMessage: string | null;
  repositorySecurityAdvisoriesError: Error | null;
  repositorySecurityAdvisoriesLimit: number;
  repositorySecurityAdvisoriesLoading: boolean;
  repositorySecurityAdvisoriesStatusLabel: string;
  repositorySecurityAdvisoriesStatusUnavailable: boolean;
  repositorySecurityPolicyError: Error | null;
  repositorySecurityPolicyLoading: boolean;
  repositorySecurityPolicyStatusLabel: string;
  repositorySecurityPolicyStatusUnavailable: boolean;
  repositorySecurityPolicyHasResult: boolean;
  repositorySecurityPolicyAvailabilityMessage: string | null;
  secretScanningAlertState: SecretScanningAlertStateFilter;
  secretScanningAlerts: SecretScanningAlertSummary[];
  secretScanningAlertsError: Error | null;
  secretScanningAlertsLimit: number;
  secretScanningAlertsLoading: boolean;
  secretScanningAvailabilityMessage: string | null;
  secretScanningStatusLabel: string;
  secretScanningStatusUnavailable: boolean;
  securityFeatureRows: Array<[string, string | null]>;
  securityMutationRelevant: boolean;
  securityPolicy: RepositorySecurityPolicy | null;
  securityPolicyExpanded: boolean;
  securityPolicyHasFullPreview: boolean;
  visibleSecurityPolicyContent: string;
  applyBaselineBranchProtection(): void;
  createActiveRepositoryRuleset(): void;
  createEvaluateRepositoryRuleset(): void;
  deleteBranchProtection(): void;
  deleteRepositoryRuleset(ruleset: RepositoryRulesetSummary): void;
  inspectRepositoryRuleset(ruleset: RepositoryRulesetSummary): void;
  openRepositorySecurityPath(path: string): void;
  openSecurityPath: OpenSecurityPath;
  reapplyRepositoryRuleset(ruleset: RepositoryRulesetSummary): void;
  rulesetMutationDisabledReason(ruleset: RepositoryRulesetSummary): string | null;
  securityItemActive: SecurityItemActive;
  togglePolicyPreview(): void;
}

function SecurityQualityTabSections({
  administrationAvailabilityLabel,
  administrationAvailabilityMessage,
  availabilityMessage,
  branchProtection,
  branchProtectionBranch,
  branchProtectionBranchLabel,
  branchProtectionBranches,
  branchProtectionBranchesDisabled,
  branchProtectionBranchesNote,
  branchProtectionError,
  branchProtectionLoading,
  branchProtectionMutationDisabledReason,
  branchProtectionStatusLabel,
  branchProtectionStatusUnavailable,
  codeScanningAlertState,
  codeScanningAlerts,
  codeScanningAlertsError,
  codeScanningAlertsLimit,
  codeScanningAlertsLoading,
  codeScanningAvailabilityMessage,
  codeScanningStatusLabel,
  codeScanningStatusUnavailable,
  createRulesetDisabledReason,
  defaultSecurityRef,
  dependabotAlertState,
  dependabotAlerts,
  dependabotAlertsError,
  dependabotAlertsLimit,
  dependabotAlertsLoading,
  dependabotAvailabilityMessage,
  dependabotStatusLabel,
  dependabotStatusUnavailable,
  focusedSecurityItemMessage,
  hasBranchProtectionBranchOption,
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  onExpandCodeScanningAlerts,
  onExpandDependabotAlerts,
  onExpandRepositoryRulesets,
  onExpandRepositorySecurityAdvisories,
  onExpandSecretScanningAlerts,
  onCodeScanningAlertStateChange,
  onDependabotAlertStateChange,
  onSecretScanningAlertStateChange,
  onSelectSecurityItem,
  onSelectSecurityQualityBranch,
  presentCommunityFiles,
  missingCommunityFiles,
  protection,
  repository,
  repositoryCommunityProfile,
  repositoryCommunityProfileAvailabilityMessage,
  repositoryCommunityProfileError,
  repositoryCommunityProfileLoading,
  repositoryCommunityProfileStatusLabel,
  repositoryCommunityProfileStatusUnavailable,
  repositoryRulesets,
  repositoryRulesetsAvailabilityMessage,
  repositoryRulesetsError,
  repositoryRulesetsLimit,
  repositoryRulesetsLoading,
  repositoryRulesetsStatusLabel,
  repositoryRulesetsStatusUnavailable,
  repositorySecurityAdvisories,
  repositorySecurityAdvisoriesAvailabilityMessage,
  repositorySecurityAdvisoriesError,
  repositorySecurityAdvisoriesLimit,
  repositorySecurityAdvisoriesLoading,
  repositorySecurityAdvisoriesStatusLabel,
  repositorySecurityAdvisoriesStatusUnavailable,
  repositorySecurityPolicyAvailabilityMessage,
  repositorySecurityPolicyError,
  repositorySecurityPolicyHasResult,
  repositorySecurityPolicyLoading,
  repositorySecurityPolicyStatusLabel,
  repositorySecurityPolicyStatusUnavailable,
  secretScanningAlertState,
  secretScanningAlerts,
  secretScanningAlertsError,
  secretScanningAlertsLimit,
  secretScanningAlertsLoading,
  secretScanningAvailabilityMessage,
  secretScanningStatusLabel,
  secretScanningStatusUnavailable,
  securityFeatureRows,
  securityMutationRelevant,
  securityPolicy,
  securityPolicyExpanded,
  securityPolicyHasFullPreview,
  visibleSecurityPolicyContent,
  applyBaselineBranchProtection,
  createActiveRepositoryRuleset,
  createEvaluateRepositoryRuleset,
  deleteBranchProtection,
  deleteRepositoryRuleset,
  inspectRepositoryRuleset,
  openRepositorySecurityPath,
  openSecurityPath,
  reapplyRepositoryRuleset,
  rulesetMutationDisabledReason,
  securityItemActive,
  togglePolicyPreview
}: SecurityQualityTabSectionsProps): JSX.Element {
  return (
    <section className="table-panel github-surface security-quality-panel">
      {focusedSecurityItemMessage && <div className="muted-row">{focusedSecurityItemMessage}</div>}
      <BranchProtectionSurface
        availabilityMessage={availabilityMessage}
        branch={branchProtectionBranch}
        branchLabel={branchProtectionBranchLabel}
        branches={branchProtectionBranches}
        branchesDisabled={branchProtectionBranchesDisabled}
        branchesNote={branchProtectionBranchesNote}
        error={branchProtectionError}
        hasBranchOption={hasBranchProtectionBranchOption}
        hasProtectionResult={Boolean(branchProtection)}
        loading={branchProtectionLoading}
        mutationAction={mutationAction}
        mutationDisabledReason={branchProtectionMutationDisabledReason}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationRelevant={securityMutationRelevant}
        mutationSucceeded={mutationSucceeded}
        onApplyBaselineProtection={applyBaselineBranchProtection}
        onDeleteProtection={deleteBranchProtection}
        onSelectBranch={onSelectSecurityQualityBranch}
        protection={protection}
        statusLabel={branchProtectionStatusLabel}
        statusUnavailable={branchProtectionStatusUnavailable}
      />
      <RepositoryRulesetsSection
        availabilityMessage={repositoryRulesetsAvailabilityMessage}
        createRulesetDisabledReason={createRulesetDisabledReason}
        error={repositoryRulesetsError}
        getMutationDisabledReason={rulesetMutationDisabledReason}
        limit={repositoryRulesetsLimit}
        loading={repositoryRulesetsLoading}
        onCreateActiveRuleset={createActiveRepositoryRuleset}
        onCreateEvaluateRuleset={createEvaluateRepositoryRuleset}
        onDeleteRuleset={deleteRepositoryRuleset}
        onExpand={onExpandRepositoryRulesets}
        onInspectRuleset={inspectRepositoryRuleset}
        onReapplyRuleset={reapplyRepositoryRuleset}
        repositoryRulesetsStatusLabel={repositoryRulesetsStatusLabel}
        repositoryRulesetsStatusUnavailable={repositoryRulesetsStatusUnavailable}
        rulesets={repositoryRulesets}
        securityItemActive={securityItemActive}
      />
      <RepositorySecurityAdvisoriesSection
        advisories={repositorySecurityAdvisories}
        availabilityMessage={repositorySecurityAdvisoriesAvailabilityMessage}
        error={repositorySecurityAdvisoriesError}
        limit={repositorySecurityAdvisoriesLimit}
        loading={repositorySecurityAdvisoriesLoading}
        onExpand={onExpandRepositorySecurityAdvisories}
        onSelectSecurityItem={onSelectSecurityItem}
        repositoryNameWithOwner={repository.nameWithOwner}
        securityItemActive={securityItemActive}
        statusLabel={repositorySecurityAdvisoriesStatusLabel}
        statusUnavailable={repositorySecurityAdvisoriesStatusUnavailable}
      />
      <SecurityPolicySection
        availabilityMessage={repositorySecurityPolicyAvailabilityMessage}
        defaultBranch={repository.defaultBranch ?? null}
        error={repositorySecurityPolicyError}
        hasPolicyResult={repositorySecurityPolicyHasResult}
        loading={repositorySecurityPolicyLoading}
        onOpenSecurityPath={openSecurityPath}
        onTogglePolicyPreview={togglePolicyPreview}
        policy={securityPolicy}
        policyExpanded={securityPolicyExpanded}
        policyHasFullPreview={securityPolicyHasFullPreview}
        statusLabel={repositorySecurityPolicyStatusLabel}
        statusUnavailable={repositorySecurityPolicyStatusUnavailable}
        visiblePolicyContent={visibleSecurityPolicyContent}
      />
      <CommunityProfileSection
        availabilityMessage={repositoryCommunityProfileAvailabilityMessage}
        error={repositoryCommunityProfileError}
        loading={repositoryCommunityProfileLoading}
        missingFiles={missingCommunityFiles}
        onOpenSecurityPath={openSecurityPath}
        presentFiles={presentCommunityFiles}
        profile={repositoryCommunityProfile}
        statusLabel={repositoryCommunityProfileStatusLabel}
        statusUnavailable={repositoryCommunityProfileStatusUnavailable}
      />
      <SecurityFeatureAvailabilitySection
        availabilityLabel={administrationAvailabilityLabel}
        availabilityMessage={administrationAvailabilityMessage}
        rows={securityFeatureRows}
      />
      <DependabotAlertsSection
        alertState={dependabotAlertState}
        alerts={dependabotAlerts}
        availabilityMessage={dependabotAvailabilityMessage}
        defaultSecurityRef={defaultSecurityRef}
        error={dependabotAlertsError}
        limit={dependabotAlertsLimit}
        loading={dependabotAlertsLoading}
        onAlertStateChange={onDependabotAlertStateChange}
        onExpand={onExpandDependabotAlerts}
        onOpenSecurityPath={openSecurityPath}
        onSelectSecurityItem={onSelectSecurityItem}
        repositoryNameWithOwner={repository.nameWithOwner}
        securityItemActive={securityItemActive}
        statusLabel={dependabotStatusLabel}
        statusUnavailable={dependabotStatusUnavailable}
      />
      <CodeScanningAlertsSection
        alertState={codeScanningAlertState}
        alerts={codeScanningAlerts}
        availabilityMessage={codeScanningAvailabilityMessage}
        error={codeScanningAlertsError}
        limit={codeScanningAlertsLimit}
        loading={codeScanningAlertsLoading}
        onAlertStateChange={onCodeScanningAlertStateChange}
        onExpand={onExpandCodeScanningAlerts}
        onOpenSecurityPath={openSecurityPath}
        onSelectSecurityItem={onSelectSecurityItem}
        repositoryNameWithOwner={repository.nameWithOwner}
        securityItemActive={securityItemActive}
        statusLabel={codeScanningStatusLabel}
        statusUnavailable={codeScanningStatusUnavailable}
      />
      <SecretScanningAlertsSection
        alertState={secretScanningAlertState}
        alerts={secretScanningAlerts}
        availabilityMessage={secretScanningAvailabilityMessage}
        defaultSecurityRef={defaultSecurityRef}
        error={secretScanningAlertsError}
        limit={secretScanningAlertsLimit}
        loading={secretScanningAlertsLoading}
        onAlertStateChange={onSecretScanningAlertStateChange}
        onExpand={onExpandSecretScanningAlerts}
        onOpenSecurityPath={openSecurityPath}
        onSelectSecurityItem={onSelectSecurityItem}
        repositoryNameWithOwner={repository.nameWithOwner}
        securityItemActive={securityItemActive}
        statusLabel={secretScanningStatusLabel}
        statusUnavailable={secretScanningStatusUnavailable}
      />
      <SecurityQualityLinks
        onOpenRepositoryPath={openRepositorySecurityPath}
        repositoryNameWithOwner={repository.nameWithOwner}
      />
    </section>
  );
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
}: SecurityQualityTabProps): JSX.Element {
  const [dependabotAlertState, setDependabotAlertState] = useState<DependabotAlertStateFilter>(
    defaultDependabotAlertStateFilter
  );
  const [codeScanningAlertState, setCodeScanningAlertState] = useState<CodeScanningAlertStateFilter>(
    defaultCodeScanningAlertStateFilter
  );
  const [secretScanningAlertState, setSecretScanningAlertState] = useState<SecretScanningAlertStateFilter>(
    defaultSecretScanningAlertStateFilter
  );
  const queryState = useSecurityQualityQueryState({
    selectedRef,
    repository,
    refListLimit,
    dependabotAlertState,
    dependabotAlertsLimit,
    codeScanningAlertState,
    codeScanningAlertsLimit,
    secretScanningAlertState,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    githubReady
  });
  const {
    branchProtectionBranch,
    branchProtectionBranches,
    branchProtection,
    protection,
    branchProtectionLoading,
    branchProtectionError,
    dependabotAlerts,
    dependabotAlertsLoading,
    dependabotAlertsError,
    codeScanningAlerts,
    codeScanningAlertsLoading,
    codeScanningAlertsError,
    secretScanningAlerts,
    secretScanningAlertsLoading,
    secretScanningAlertsError,
    repositoryRulesets,
    repositoryRulesetsLoading,
    repositoryRulesetsError,
    repositorySecurityAdvisories,
    repositorySecurityAdvisoriesLoading,
    repositorySecurityAdvisoriesError,
    repositorySecurityPolicy,
    repositorySecurityPolicyLoading,
    repositorySecurityPolicyError,
    repositoryCommunityProfile,
    repositoryCommunityProfileLoading,
    repositoryCommunityProfileError
  } = queryState;
  const {
    policy: securityPolicy,
    policyExpanded: securityPolicyExpanded,
    policyHasFullPreview: securityPolicyHasFullPreview,
    togglePolicyPreview,
    visiblePolicyContent: visibleSecurityPolicyContent
  } = useSecurityPolicyPreviewState(repository.nameWithOwner, repositorySecurityPolicy);
  const {
    administrationAvailabilityLabel,
    administrationAvailabilityMessage,
    availabilityMessage,
    branchProtectionBranchLabel,
    branchProtectionBranchesDisabled,
    branchProtectionBranchesNote,
    branchProtectionMutationDisabledReason,
    branchProtectionStatusLabel,
    branchProtectionStatusUnavailable,
    codeScanningAvailabilityMessage,
    codeScanningStatusLabel,
    codeScanningStatusUnavailable,
    createRulesetDisabledReason,
    defaultSecurityRef,
    dependabotAvailabilityMessage,
    dependabotStatusLabel,
    dependabotStatusUnavailable,
    hasBranchProtectionBranchOption,
    missingCommunityFiles,
    presentCommunityFiles,
    repositoryCommunityProfileAvailabilityMessage,
    repositoryCommunityProfileStatusLabel,
    repositoryCommunityProfileStatusUnavailable,
    repositoryRulesetsAvailabilityMessage,
    repositoryRulesetsStatusLabel,
    repositoryRulesetsStatusUnavailable,
    repositorySecurityAdvisoriesAvailabilityMessage,
    repositorySecurityAdvisoriesStatusLabel,
    repositorySecurityAdvisoriesStatusUnavailable,
    repositorySecurityPolicyAvailabilityMessage,
    repositorySecurityPolicyStatusLabel,
    repositorySecurityPolicyStatusUnavailable,
    secretScanningAvailabilityMessage,
    secretScanningStatusLabel,
    secretScanningStatusUnavailable,
    securityFeatureRows,
    securityMutationDisabledReason,
    securityMutationRelevant
  } = readSecurityQualityDerivedState({
    githubReady,
    mutationAction,
    mutationPending,
    queryState,
    repository,
    securityPolicy
  });
  const focusedSecurityItemMessage = readFocusedSecurityItemMessage({
    focusedSecurityItemId,
    focusedSecurityItemKind,
    queryState
  });
  const {
    applyBaselineBranchProtection,
    createActiveRepositoryRuleset,
    createEvaluateRepositoryRuleset,
    deleteBranchProtection,
    deleteRepositoryRuleset,
    inspectRepositoryRuleset,
    openRepositorySecurityPath,
    openSecurityPath,
    reapplyRepositoryRuleset,
    rulesetMutationDisabledReason,
    securityItemActive
  } = createSecurityQualityActions({
    branchProtectionBranch,
    defaultSecurityRef,
    focusedSecurityItemId,
    focusedSecurityItemKind,
    mutationPending,
    repository,
    securityMutationDisabledReason,
    securityMutationRelevant,
    onMutate,
    onOpenCodePath,
    onOpenExternal,
    onSelectSecurityItem
  });

  return (
    <SecurityQualityTabSections
      administrationAvailabilityLabel={administrationAvailabilityLabel}
      administrationAvailabilityMessage={administrationAvailabilityMessage}
      applyBaselineBranchProtection={applyBaselineBranchProtection}
      availabilityMessage={availabilityMessage}
      branchProtection={branchProtection}
      branchProtectionBranch={branchProtectionBranch}
      branchProtectionBranchLabel={branchProtectionBranchLabel}
      branchProtectionBranches={branchProtectionBranches}
      branchProtectionBranchesDisabled={branchProtectionBranchesDisabled}
      branchProtectionBranchesNote={branchProtectionBranchesNote}
      branchProtectionError={branchProtectionError}
      branchProtectionLoading={branchProtectionLoading}
      branchProtectionMutationDisabledReason={branchProtectionMutationDisabledReason}
      branchProtectionStatusLabel={branchProtectionStatusLabel}
      branchProtectionStatusUnavailable={branchProtectionStatusUnavailable}
      codeScanningAlertState={codeScanningAlertState}
      codeScanningAlerts={codeScanningAlerts}
      codeScanningAlertsError={codeScanningAlertsError}
      codeScanningAlertsLimit={codeScanningAlertsLimit}
      codeScanningAlertsLoading={codeScanningAlertsLoading}
      codeScanningAvailabilityMessage={codeScanningAvailabilityMessage}
      codeScanningStatusLabel={codeScanningStatusLabel}
      codeScanningStatusUnavailable={codeScanningStatusUnavailable}
      createActiveRepositoryRuleset={createActiveRepositoryRuleset}
      createEvaluateRepositoryRuleset={createEvaluateRepositoryRuleset}
      createRulesetDisabledReason={createRulesetDisabledReason}
      defaultSecurityRef={defaultSecurityRef}
      deleteBranchProtection={deleteBranchProtection}
      deleteRepositoryRuleset={deleteRepositoryRuleset}
      dependabotAlertState={dependabotAlertState}
      dependabotAlerts={dependabotAlerts}
      dependabotAlertsError={dependabotAlertsError}
      dependabotAlertsLimit={dependabotAlertsLimit}
      dependabotAlertsLoading={dependabotAlertsLoading}
      dependabotAvailabilityMessage={dependabotAvailabilityMessage}
      dependabotStatusLabel={dependabotStatusLabel}
      dependabotStatusUnavailable={dependabotStatusUnavailable}
      focusedSecurityItemMessage={focusedSecurityItemMessage}
      hasBranchProtectionBranchOption={hasBranchProtectionBranchOption}
      inspectRepositoryRuleset={inspectRepositoryRuleset}
      missingCommunityFiles={missingCommunityFiles}
      mutationAction={mutationAction}
      mutationError={mutationError}
      mutationPending={mutationPending}
      mutationSucceeded={mutationSucceeded}
      onExpandCodeScanningAlerts={onExpandCodeScanningAlerts}
      onExpandDependabotAlerts={onExpandDependabotAlerts}
      onExpandRepositoryRulesets={onExpandRepositoryRulesets}
      onExpandRepositorySecurityAdvisories={onExpandRepositorySecurityAdvisories}
      onExpandSecretScanningAlerts={onExpandSecretScanningAlerts}
      onCodeScanningAlertStateChange={setCodeScanningAlertState}
      onDependabotAlertStateChange={setDependabotAlertState}
      onOpenExternal={onOpenExternal}
      onSecretScanningAlertStateChange={setSecretScanningAlertState}
      onSelectSecurityItem={onSelectSecurityItem}
      onSelectSecurityQualityBranch={onSelectSecurityQualityBranch}
      openRepositorySecurityPath={openRepositorySecurityPath}
      openSecurityPath={openSecurityPath}
      presentCommunityFiles={presentCommunityFiles}
      protection={protection}
      reapplyRepositoryRuleset={reapplyRepositoryRuleset}
      repository={repository}
      repositoryCommunityProfile={repositoryCommunityProfile}
      repositoryCommunityProfileAvailabilityMessage={repositoryCommunityProfileAvailabilityMessage}
      repositoryCommunityProfileError={repositoryCommunityProfileError}
      repositoryCommunityProfileLoading={repositoryCommunityProfileLoading}
      repositoryCommunityProfileStatusLabel={repositoryCommunityProfileStatusLabel}
      repositoryCommunityProfileStatusUnavailable={repositoryCommunityProfileStatusUnavailable}
      repositoryRulesets={repositoryRulesets}
      repositoryRulesetsAvailabilityMessage={repositoryRulesetsAvailabilityMessage}
      repositoryRulesetsError={repositoryRulesetsError}
      repositoryRulesetsLimit={repositoryRulesetsLimit}
      repositoryRulesetsLoading={repositoryRulesetsLoading}
      repositoryRulesetsStatusLabel={repositoryRulesetsStatusLabel}
      repositoryRulesetsStatusUnavailable={repositoryRulesetsStatusUnavailable}
      repositorySecurityAdvisories={repositorySecurityAdvisories}
      repositorySecurityAdvisoriesAvailabilityMessage={repositorySecurityAdvisoriesAvailabilityMessage}
      repositorySecurityAdvisoriesError={repositorySecurityAdvisoriesError}
      repositorySecurityAdvisoriesLimit={repositorySecurityAdvisoriesLimit}
      repositorySecurityAdvisoriesLoading={repositorySecurityAdvisoriesLoading}
      repositorySecurityAdvisoriesStatusLabel={repositorySecurityAdvisoriesStatusLabel}
      repositorySecurityAdvisoriesStatusUnavailable={repositorySecurityAdvisoriesStatusUnavailable}
      repositorySecurityPolicyAvailabilityMessage={repositorySecurityPolicyAvailabilityMessage}
      repositorySecurityPolicyError={repositorySecurityPolicyError}
      repositorySecurityPolicyHasResult={Boolean(repositorySecurityPolicy)}
      repositorySecurityPolicyLoading={repositorySecurityPolicyLoading}
      repositorySecurityPolicyStatusLabel={repositorySecurityPolicyStatusLabel}
      repositorySecurityPolicyStatusUnavailable={repositorySecurityPolicyStatusUnavailable}
      rulesetMutationDisabledReason={rulesetMutationDisabledReason}
      secretScanningAlertState={secretScanningAlertState}
      secretScanningAlerts={secretScanningAlerts}
      secretScanningAlertsError={secretScanningAlertsError}
      secretScanningAlertsLimit={secretScanningAlertsLimit}
      secretScanningAlertsLoading={secretScanningAlertsLoading}
      secretScanningAvailabilityMessage={secretScanningAvailabilityMessage}
      secretScanningStatusLabel={secretScanningStatusLabel}
      secretScanningStatusUnavailable={secretScanningStatusUnavailable}
      securityFeatureRows={securityFeatureRows}
      securityItemActive={securityItemActive}
      securityMutationRelevant={securityMutationRelevant}
      securityPolicy={securityPolicy}
      securityPolicyExpanded={securityPolicyExpanded}
      securityPolicyHasFullPreview={securityPolicyHasFullPreview}
      togglePolicyPreview={togglePolicyPreview}
      visibleSecurityPolicyContent={visibleSecurityPolicyContent}
    />
  );
}
