import { ExternalLink, GitFork } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  BranchSummary,
  BranchProtectionResult,
  GitHubAction,
  GitHubMutationFields,
  GitHubReadAvailability,
  RepositoryAccessResult,
  RepositoryCollaboratorSummary,
  RepositoryDetail,
  RepositoryRef,
  RepositoryForksResult,
  RepositoryRulesetSummary,
  TeamSummary
} from "@shared/github";

import {
  githubActionLabel,
  maxProfileRepositoryLimit,
  readAvailabilityMessage,
  repositoryCollectionMetadataParts,
  repositoryMutationDisabledReason,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";

import { useControlApi } from "@renderer/hooks/useControlApi";

import type { RepositoryTab } from "@renderer/stores/uiStore";
import { formatCompactNumber } from "@renderer/utils/format";
const defaultMemberProfileRepositoryLimit = 8;
const maxForksLimit = 100;
const maxRepositoryAccessLimit = 100;

function repositorySettingsMutationDisabledReason(repository: RepositoryDetail): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (repository.administration.viewerPermissions.admin !== true) {
    return "Repository settings require admin access.";
  }
  return null;
}

function unknownableCompactNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "unknown" : formatCompactNumber(value);
}

function repositoryForkMetadataLabel(repository: RepositoryRef): string {
  const visibility =
    repository.visibility ??
    (repository.isPrivate === null || repository.isPrivate === undefined
      ? "unknown visibility"
      : repository.isPrivate
        ? "private"
        : "public");
  const permission = repository.viewerPermission ?? "unknown permission";

  return [
    visibility.toLowerCase(),
    `${unknownableCompactNumber(repository.stargazerCount)} stars`,
    `${unknownableCompactNumber(repository.forkCount)} forks`,
    permission.toLowerCase()
  ].join(" · ");
}

function repositoryStatusMutationDisabledReason(repository: RepositoryDetail): string | null {
  if (repository.permissions.isDisabled) {
    return "Repository is disabled.";
  }
  if (repository.administration.viewerPermissions.admin !== true) {
    return "Repository status changes require admin access.";
  }
  return null;
}

function commaSeparatedValues(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
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

function permissionStateLabel(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Allowed" : "Not allowed";
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

function rulesetCompactSummary(ruleset: RepositoryRulesetSummary): string {
  const parts = [
    ...ruleset.rules.slice(0, 2).map((rule) => `Rule ${rulesetRuleLabel(rule)}`),
    ...ruleset.conditions.slice(0, 1).map((condition) => `Condition ${rulesetConditionLabel(condition)}`),
    ...ruleset.bypassActors.slice(0, 1).map((actor) => `Bypass ${rulesetBypassActorLabel(actor)}`)
  ];
  return parts.length > 0 ? parts.join(" · ") : "No detailed ruleset payload returned.";
}

function collaboratorRoleLabel(collaborator: RepositoryCollaboratorSummary): string {
  if (collaborator.roleName) {
    return accessRoleLabel(collaborator.roleName);
  }

  if (collaborator.permissions.admin) {
    return "admin";
  }
  if (collaborator.permissions.maintain) {
    return "maintain";
  }
  if (collaborator.permissions.push) {
    return "write";
  }
  if (collaborator.permissions.triage) {
    return "triage";
  }
  if (collaborator.permissions.pull) {
    return "read";
  }
  return "access";
}

function collaboratorPermissionForMutation(collaborator: RepositoryCollaboratorSummary): string {
  const role = collaborator.roleName?.toLowerCase();
  if (role === "admin" || role === "maintain" || role === "triage" || role === "pull") {
    return role;
  }
  if (role === "write" || role === "push") {
    return "push";
  }
  if (collaborator.permissions.admin) {
    return "admin";
  }
  if (collaborator.permissions.maintain) {
    return "maintain";
  }
  if (collaborator.permissions.push) {
    return "push";
  }
  if (collaborator.permissions.triage) {
    return "triage";
  }
  if (collaborator.permissions.pull) {
    return "pull";
  }
  return "push";
}

export function RepositorySettingsTab({
  repository,
  githubReady,
  branches,
  branchesError,
  branchProtectionBranch,
  branchProtection,
  branchProtectionLoading,
  branchProtectionError,
  repositoryRulesets,
  repositoryRulesetsLimit,
  repositoryRulesetsLoading,
  repositoryRulesetsAvailability,
  repositoryRulesetsError,
  repositoryAccess,
  repositoryAccessLimit,
  repositoryAccessLoading,
  repositoryAccessError,
  focusedCollaboratorLogin,
  repositoryForks,
  forksLimit,
  repositoryForksLoading,
  repositoryForksError,
  saving,
  saveSucceeded,
  saveError,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onMutate,
  onOpenExternal,
  onOpenRepository,
  onOpenTeam,
  onSelectCollaborator,
  onExpandForks,
  onExpandRepositoryAccess
}: {
  repository: RepositoryDetail;
  githubReady: boolean;
  branches: BranchSummary[];
  branchesError: Error | null;
  branchProtectionBranch: string | null;
  branchProtection: BranchProtectionResult | null;
  branchProtectionLoading: boolean;
  branchProtectionError: Error | null;
  repositoryRulesets: RepositoryRulesetSummary[];
  repositoryRulesetsLimit: number;
  repositoryRulesetsLoading: boolean;
  repositoryRulesetsAvailability: GitHubReadAvailability | null;
  repositoryRulesetsError: Error | null;
  repositoryAccess: RepositoryAccessResult | null;
  repositoryAccessLimit: number;
  repositoryAccessLoading: boolean;
  repositoryAccessError: Error | null;
  focusedCollaboratorLogin: string | null;
  repositoryForks: RepositoryForksResult | null;
  forksLimit: number;
  repositoryForksLoading: boolean;
  repositoryForksError: Error | null;
  saving: boolean;
  saveSucceeded: boolean;
  saveError: Error | null;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onOpenTeam(team: TeamSummary): void;
  onSelectCollaborator(collaborator: RepositoryCollaboratorSummary): void;
  onExpandForks(): void;
  onExpandRepositoryAccess(): void;
}): JSX.Element {
  const api = useControlApi();
  const administration = repository.administration;
  const [description, setDescription] = useState(repository.description ?? "");
  const [homepage, setHomepage] = useState(repository.homepageUrl ?? "");
  const [defaultBranch, setDefaultBranch] = useState(
    administration.defaultBranch ?? repository.defaultBranch ?? ""
  );
  const [topics, setTopics] = useState(() => repository.topics.join(", "));
  const [webCommitSignoffRequired, setWebCommitSignoffRequired] = useState(
    administration.webCommitSignoffRequired === true
  );
  const [allowForking, setAllowForking] = useState(administration.allowForking === true);
  const [features, setFeatures] = useState({
    issues: administration.features.issues === true,
    projects: administration.features.projects === true,
    wiki: administration.features.wiki === true,
    discussions: administration.features.discussions === true
  });
  const [profileRepositoryLimits, setProfileRepositoryLimits] = useState<Record<string, number>>({});
  const [mergeSettings, setMergeSettings] = useState({
    allowMergeCommit: administration.mergeSettings.allowMergeCommit === true,
    allowSquashMerge: administration.mergeSettings.allowSquashMerge === true,
    allowRebaseMerge: administration.mergeSettings.allowRebaseMerge === true,
    allowAutoMerge: administration.mergeSettings.allowAutoMerge === true,
    deleteBranchOnMerge: administration.mergeSettings.deleteBranchOnMerge === true,
    allowUpdateBranch: administration.mergeSettings.allowUpdateBranch === true
  });
  const [collaboratorLogin, setCollaboratorLogin] = useState("");
  const [collaboratorPermission, setCollaboratorPermission] = useState("push");
  const [teamSlug, setTeamSlug] = useState("");
  const [teamPermission, setTeamPermission] = useState("push");
  const [branchRequiresReviews, setBranchRequiresReviews] = useState(
    branchProtection?.protection?.requiresPullRequestReviews === true
  );
  const [branchRequiredApprovals, setBranchRequiredApprovals] = useState(
    String(branchProtection?.protection?.requiredApprovingReviewCount ?? 1)
  );
  const [branchEnforceAdmins, setBranchEnforceAdmins] = useState(
    branchProtection?.protection?.enforceAdmins === true
  );
  const [branchRequireLinearHistory, setBranchRequireLinearHistory] = useState(
    branchProtection?.protection?.requiredLinearHistory === true
  );
  const [branchRequireConversationResolution, setBranchRequireConversationResolution] = useState(
    branchProtection?.protection?.requiredConversationResolution === true
  );
  const [rulesetName, setRulesetName] = useState("");
  const [rulesetEnforcement, setRulesetEnforcement] = useState("active");
  const liveSettingsDisabledReason = !githubReady
    ? "Sign in with GitHub to change repository settings."
    : null;
  const liveStatusDisabledReason = !githubReady ? "Sign in with GitHub to change repository status." : null;
  const settingsDisabledReason =
    liveSettingsDisabledReason ?? repositorySettingsMutationDisabledReason(repository);
  const statusDisabledReason = liveStatusDisabledReason ?? repositoryStatusMutationDisabledReason(repository);
  const formDisabledReason = saving ? "Repository settings save is still running." : settingsDisabledReason;
  const statusActionDisabledReason = saving
    ? "Repository status update is still running."
    : statusDisabledReason;
  const formDisabled = Boolean(formDisabledReason);
  const statusActionDisabled = Boolean(statusActionDisabledReason);
  const archiveActionLabel = administration.isArchived ? "Unarchive repository" : "Archive repository";
  const featureRows = [
    ["Issues", administration.features.issues],
    ["Projects", administration.features.projects],
    ["Wiki", administration.features.wiki],
    ["Discussions", administration.features.discussions]
  ] as const;
  const mergeRows = [
    ["Merge commits", administration.mergeSettings.allowMergeCommit],
    ["Squash merge", administration.mergeSettings.allowSquashMerge],
    ["Rebase merge", administration.mergeSettings.allowRebaseMerge],
    ["Auto-merge", administration.mergeSettings.allowAutoMerge],
    ["Delete branch on merge", administration.mergeSettings.deleteBranchOnMerge],
    ["Update branch button", administration.mergeSettings.allowUpdateBranch]
  ] as const;
  const permissionRows = [
    ["Admin", administration.viewerPermissions.admin],
    ["Maintain", administration.viewerPermissions.maintain],
    ["Push", administration.viewerPermissions.push],
    ["Triage", administration.viewerPermissions.triage],
    ["Pull", administration.viewerPermissions.pull]
  ] as const;
  const securityFeatureRows = repositorySecurityFeatureRows(administration.securityAndAnalysis);
  const collaborators = repositoryAccess?.collaborators ?? [];
  const accessTeams = repositoryAccess?.teams ?? [];
  const collaboratorsLimitHit = collaborators.length >= repositoryAccessLimit;
  const canExpandCollaborators = collaboratorsLimitHit && repositoryAccessLimit < maxRepositoryAccessLimit;
  const accessTeamsLimitHit = accessTeams.length >= repositoryAccessLimit;
  const canExpandAccessTeams = accessTeamsLimitHit && repositoryAccessLimit < maxRepositoryAccessLimit;
  const collaboratorsAvailabilityMessage = readAvailabilityMessage(
    "Repository collaborators",
    repositoryAccess?.collaboratorsAvailability ?? null
  );
  const teamsAvailabilityMessage = readAvailabilityMessage(
    "Repository team access",
    repositoryAccess?.teamsAvailability ?? null
  );
  const forkNetworkAvailabilityMessage = readAvailabilityMessage(
    "Fork network",
    repositoryForks?.availability ?? null
  );
  const administrationAvailabilityMessage = readAvailabilityMessage(
    "Repository settings metadata",
    repository.administrationAvailability ?? null
  );
  const forks = repositoryForks?.items ?? [];
  const forksLimitHit = forks.length >= forksLimit;
  const canExpandForks = forksLimitHit && forksLimit < maxForksLimit;
  const forkNetworkUnavailable = Boolean(repositoryForksError) || Boolean(forkNetworkAvailabilityMessage);
  const forkNetworkStatusLabel =
    repositoryForksLoading && !repositoryForks
      ? "loading"
      : forkNetworkUnavailable
        ? "unavailable"
        : String(forks.length);
  const collaboratorsStatusUnavailable =
    Boolean(repositoryAccessError) || Boolean(collaboratorsAvailabilityMessage);
  const teamsStatusUnavailable = Boolean(repositoryAccessError) || Boolean(teamsAvailabilityMessage);
  const collaboratorsStatusLabel =
    repositoryAccessLoading && !repositoryAccess
      ? "loading"
      : collaboratorsStatusUnavailable
        ? "unavailable"
        : String(collaborators.length);
  const teamsStatusLabel =
    repositoryAccessLoading && !repositoryAccess
      ? "loading"
      : teamsStatusUnavailable
        ? "unavailable"
        : String(accessTeams.length);
  const selectedCollaborator =
    collaborators.find((collaborator) => collaborator.login === focusedCollaboratorLogin) ?? null;
  const selectedCollaboratorRepositoryLimit = selectedCollaborator
    ? (profileRepositoryLimits[selectedCollaborator.login] ?? defaultMemberProfileRepositoryLimit)
    : defaultMemberProfileRepositoryLimit;
  const selectedCollaboratorProfile = useQuery<AccountProfileResult>({
    queryKey: ["github-account-profile", selectedCollaborator?.login ?? null],
    queryFn: () =>
      api.github.getAccountProfileWithStatus({
        login: selectedCollaborator?.login ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedCollaborator)
  });
  const selectedCollaboratorRepositories = useQuery<AccountRepositoryListResult>({
    queryKey: [
      "github-account-repositories",
      selectedCollaborator?.login ?? null,
      selectedCollaboratorRepositoryLimit
    ],
    queryFn: () =>
      api.github.listAccountRepositoriesWithStatus({
        login: selectedCollaborator?.login ?? undefined,
        limit: selectedCollaboratorRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedCollaborator)
  });
  const selectedCollaboratorRepositoryItems = selectedCollaboratorRepositories.data?.items ?? [];
  const selectedCollaboratorRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Collaborator repositories",
    selectedCollaboratorRepositories.data?.availability ?? null
  );
  const selectedCollaboratorRepositoriesLimitHit =
    selectedCollaboratorRepositoryItems.length >= selectedCollaboratorRepositoryLimit;
  const canExpandSelectedCollaboratorRepositories =
    selectedCollaboratorRepositoriesLimitHit &&
    selectedCollaboratorRepositoryLimit < maxProfileRepositoryLimit;
  const selectedCollaboratorProfileData = selectedCollaboratorProfile.data?.profile ?? null;
  const selectedCollaboratorProfileAvailabilityMessage = readAvailabilityMessage(
    "Profile",
    selectedCollaboratorProfile.data?.availability ?? null
  );
  const selectedCollaboratorProfileUrl =
    selectedCollaboratorProfileData?.htmlUrl ?? selectedCollaborator?.htmlUrl ?? null;
  const selectedCollaboratorPermissionContext = selectedCollaborator
    ? [
        `Role: ${collaboratorRoleLabel(selectedCollaborator)}`,
        selectedCollaborator.permissions.admin ? "admin" : null,
        selectedCollaborator.permissions.maintain ? "maintain" : null,
        selectedCollaborator.permissions.push ? "push" : null,
        selectedCollaborator.permissions.triage ? "triage" : null,
        selectedCollaborator.permissions.pull ? "pull" : null,
        selectedCollaborator.type,
        selectedCollaborator.siteAdmin ? "site admin" : null
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const repositoryAdminActions: GitHubAction[] = [
    "addRepositoryCollaborator",
    "removeRepositoryCollaborator",
    "updateCollaboratorPermission",
    "addRepositoryTeam",
    "removeRepositoryTeam",
    "updateTeamPermission",
    "updateBranchProtection",
    "deleteBranchProtection",
    "createRepositoryRuleset",
    "updateRepositoryRuleset",
    "deleteRepositoryRuleset"
  ];
  const repositoryAdminMutationActive =
    mutationPending && mutationAction !== null && repositoryAdminActions.includes(mutationAction);
  const repositoryAdminMutationSucceeded =
    mutationSucceeded && mutationAction !== null && repositoryAdminActions.includes(mutationAction);
  const repositoryAdminMutationError =
    mutationAction !== null && repositoryAdminActions.includes(mutationAction) ? mutationError : null;
  const adminDisabledReason = repositoryAdminMutationActive
    ? `${githubActionLabel(mutationAction)} is still running.`
    : settingsDisabledReason;
  const adminDisabled = Boolean(adminDisabledReason);
  const branchProtectionAvailabilityMessage = readAvailabilityMessage(
    "Branch protection",
    branchProtection?.availability ?? null
  );
  const repositoryRulesetsAvailabilityMessage = readAvailabilityMessage(
    "Repository rulesets",
    repositoryRulesetsAvailability
  );
  const branchProtectionExists = Boolean(branchProtection?.protection);
  const branchProtectionDisabledReason =
    adminDisabledReason ??
    (branchProtectionBranch ? null : "Select a branch before changing branch protection.");
  const branchProtectionDisabled = Boolean(branchProtectionDisabledReason);
  const rulesetDisabledReason = adminDisabledReason;
  const rulesetDisabled = Boolean(rulesetDisabledReason);

  function updateFeature(name: keyof typeof features, value: boolean): void {
    setFeatures((current) => ({ ...current, [name]: value }));
  }

  function updateMergeSetting(name: keyof typeof mergeSettings, value: boolean): void {
    setMergeSettings((current) => ({ ...current, [name]: value }));
  }

  function expandSelectedCollaboratorRepositories(): void {
    if (!selectedCollaborator) {
      return;
    }
    setProfileRepositoryLimits((limits) => {
      const currentLimit = limits[selectedCollaborator.login] ?? defaultMemberProfileRepositoryLimit;
      if (currentLimit >= maxProfileRepositoryLimit) {
        return limits;
      }
      const nextLimit = currentLimit < 50 ? 50 : maxProfileRepositoryLimit;
      return { ...limits, [selectedCollaborator.login]: nextLimit };
    });
  }

  function settingControlDisabledReason(value: boolean | null, label: string): string | null {
    return formDisabledReason ?? (value === null ? `${label} setting is unavailable from GitHub.` : null);
  }

  function repositorySettingsSaveRequiresConfirmation(): boolean {
    const currentDefaultBranch = administration.defaultBranch ?? repository.defaultBranch ?? null;
    const nextDefaultBranch = defaultBranch.trim();
    if (
      currentDefaultBranch !== null &&
      nextDefaultBranch !== "" &&
      nextDefaultBranch !== currentDefaultBranch
    ) {
      return true;
    }

    if (administration.allowForking === true && !allowForking) {
      return true;
    }
    if (administration.webCommitSignoffRequired === false && webCommitSignoffRequired) {
      return true;
    }

    if (
      (administration.features.issues === true && !features.issues) ||
      (administration.features.projects === true && !features.projects) ||
      (administration.features.wiki === true && !features.wiki) ||
      (administration.features.discussions === true && !features.discussions)
    ) {
      return true;
    }

    return (
      (administration.mergeSettings.allowMergeCommit === true && !mergeSettings.allowMergeCommit) ||
      (administration.mergeSettings.allowSquashMerge === true && !mergeSettings.allowSquashMerge) ||
      (administration.mergeSettings.allowRebaseMerge === true && !mergeSettings.allowRebaseMerge) ||
      (administration.mergeSettings.allowAutoMerge === true && !mergeSettings.allowAutoMerge) ||
      (administration.mergeSettings.deleteBranchOnMerge === true && !mergeSettings.deleteBranchOnMerge) ||
      (administration.mergeSettings.allowUpdateBranch === true && !mergeSettings.allowUpdateBranch)
    );
  }

  function saveRepositorySettings(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (formDisabled) {
      return;
    }

    const payload: GitHubMutationFields = {
      description: description.trim() || null,
      homepage: homepage.trim() || null,
      default_branch: defaultBranch.trim() || undefined,
      topics: commaSeparatedValues(topics)
    };

    if (administration.allowForking !== null) {
      payload.allow_forking = allowForking;
    }
    if (administration.webCommitSignoffRequired !== null) {
      payload.web_commit_signoff_required = webCommitSignoffRequired;
    }
    if (administration.features.issues !== null) {
      payload.has_issues = features.issues;
    }
    if (administration.features.projects !== null) {
      payload.has_projects = features.projects;
    }
    if (administration.features.wiki !== null) {
      payload.has_wiki = features.wiki;
    }
    if (administration.features.discussions !== null) {
      payload.has_discussions = features.discussions;
    }
    if (administration.mergeSettings.allowMergeCommit !== null) {
      payload.allow_merge_commit = mergeSettings.allowMergeCommit;
    }
    if (administration.mergeSettings.allowSquashMerge !== null) {
      payload.allow_squash_merge = mergeSettings.allowSquashMerge;
    }
    if (administration.mergeSettings.allowRebaseMerge !== null) {
      payload.allow_rebase_merge = mergeSettings.allowRebaseMerge;
    }
    if (administration.mergeSettings.allowAutoMerge !== null) {
      payload.allow_auto_merge = mergeSettings.allowAutoMerge;
    }
    if (administration.mergeSettings.deleteBranchOnMerge !== null) {
      payload.delete_branch_on_merge = mergeSettings.deleteBranchOnMerge;
    }
    if (administration.mergeSettings.allowUpdateBranch !== null) {
      payload.allow_update_branch = mergeSettings.allowUpdateBranch;
    }

    onMutate("editRepository", repositorySettingsSaveRequiresConfirmation(), payload);
  }

  function submitAddCollaborator(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const username = collaboratorLogin.trim();
    if (adminDisabled || username.length === 0) {
      return;
    }
    onMutate("addRepositoryCollaborator", false, { username, permission: collaboratorPermission });
    setCollaboratorLogin("");
  }

  function updateCollaboratorPermission(
    collaborator: RepositoryCollaboratorSummary,
    permission: string
  ): void {
    if (adminDisabled) {
      return;
    }
    onMutate("updateCollaboratorPermission", false, { username: collaborator.login, permission });
  }

  function removeCollaborator(collaborator: RepositoryCollaboratorSummary): void {
    if (adminDisabled) {
      return;
    }
    onMutate("removeRepositoryCollaborator", true, { username: collaborator.login });
  }

  function submitAddTeam(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const slug = teamSlug.trim();
    if (adminDisabled || slug.length === 0) {
      return;
    }
    onMutate("addRepositoryTeam", false, { teamSlug: slug, permission: teamPermission });
    setTeamSlug("");
  }

  function updateTeamPermission(team: TeamSummary, permission: string): void {
    if (adminDisabled) {
      return;
    }
    onMutate("updateTeamPermission", false, { teamSlug: team.slug, permission });
  }

  function removeTeam(team: TeamSummary): void {
    if (adminDisabled) {
      return;
    }
    onMutate("removeRepositoryTeam", true, { teamSlug: team.slug });
  }

  function branchProtectionPayload(): GitHubMutationFields | null {
    if (!branchProtectionBranch) {
      return null;
    }

    const approvalCount = Math.max(0, Number.parseInt(branchRequiredApprovals, 10) || 0);
    return {
      branch: branchProtectionBranch,
      required_status_checks: null,
      enforce_admins: branchEnforceAdmins,
      required_pull_request_reviews: branchRequiresReviews
        ? {
            required_approving_review_count: approvalCount,
            dismiss_stale_reviews: branchProtection?.protection?.dismissStaleReviews ?? false,
            require_code_owner_reviews: branchProtection?.protection?.requireCodeOwnerReviews ?? false,
            require_last_push_approval: branchProtection?.protection?.requireLastPushApproval ?? false
          }
        : null,
      restrictions: null,
      required_linear_history: branchRequireLinearHistory,
      required_conversation_resolution: branchRequireConversationResolution,
      allow_force_pushes: branchProtection?.protection?.allowForcePushes ?? false,
      allow_deletions: branchProtection?.protection?.allowDeletions ?? false,
      lock_branch: branchProtection?.protection?.lockBranch ?? false,
      allow_fork_syncing: branchProtection?.protection?.allowForkSyncing ?? false
    };
  }

  function submitBranchProtection(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (branchProtectionDisabled) {
      return;
    }
    const payload = branchProtectionPayload();
    if (payload) {
      onMutate("updateBranchProtection", false, payload);
    }
  }

  function deleteBranchProtection(): void {
    if (branchProtectionDisabled || !branchProtectionBranch) {
      return;
    }
    onMutate("deleteBranchProtection", true, { branch: branchProtectionBranch });
  }

  function rulesetPayload(ruleset?: RepositoryRulesetSummary): GitHubMutationFields {
    const name = rulesetName.trim() || ruleset?.name || `${repository.name} branch rules`;
    const ref = administration.defaultBranch ?? repository.defaultBranch;
    return {
      rulesetId: ruleset?.id,
      name,
      target: ruleset?.target ?? "branch",
      enforcement: ruleset?.enforcement ?? rulesetEnforcement,
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

  function submitCreateRuleset(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (rulesetDisabled || rulesetName.trim().length === 0) {
      return;
    }
    onMutate("createRepositoryRuleset", false, rulesetPayload());
    setRulesetName("");
  }

  return (
    <section className="repository-settings-panel">
      <header className="settings-surface-header">
        <div>
          <h2>Repository settings</h2>
          <small>
            {administration.visibility.toLowerCase()} · default branch{" "}
            {administration.defaultBranch ?? "unknown"}
          </small>
        </div>
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/settings"))}>
          <ExternalLink size={16} /> Open GitHub fallback
        </button>
      </header>

      {administrationAvailabilityMessage && (
        <div className="error-state">{administrationAvailabilityMessage}</div>
      )}

      <div className="settings-summary-grid">
        <div>
          <span>Archived</span>
          <strong>{settingStateLabel(administration.isArchived)}</strong>
        </div>
        <div>
          <span>Disabled</span>
          <strong>{settingStateLabel(administration.isDisabled)}</strong>
        </div>
        <div>
          <span>Template</span>
          <strong>{settingStateLabel(administration.isTemplate)}</strong>
        </div>
        <div>
          <span>Forking</span>
          <strong>{settingStateLabel(administration.allowForking)}</strong>
        </div>
        <div>
          <span>Web signoff</span>
          <strong>{settingStateLabel(administration.webCommitSignoffRequired)}</strong>
        </div>
      </div>

      <form className="compose-form repository-settings-form" onSubmit={saveRepositorySettings}>
        <div>
          <label htmlFor="repository-settings-description">Description</label>
          <textarea
            id="repository-settings-description"
            placeholder="Repository description"
            value={description}
            disabled={formDisabled}
            title={formDisabledReason ?? undefined}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="repository-settings-homepage">Homepage</label>
          <input
            id="repository-settings-homepage"
            placeholder="https://example.com"
            value={homepage}
            disabled={formDisabled}
            title={formDisabledReason ?? undefined}
            onChange={(event) => setHomepage(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="repository-settings-default-branch">Default branch</label>
          {branches.length > 0 ? (
            <select
              id="repository-settings-default-branch"
              value={defaultBranch}
              disabled={formDisabled}
              title={formDisabledReason ?? undefined}
              onChange={(event) => setDefaultBranch(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="repository-settings-default-branch"
              placeholder="main"
              value={defaultBranch}
              disabled={formDisabled}
              title={formDisabledReason ?? undefined}
              onChange={(event) => setDefaultBranch(event.target.value)}
            />
          )}
          {branchesError && (
            <small className="action-disabled-note">
              Branch list unavailable: {branchesError.message}. Enter a branch name manually.
            </small>
          )}
        </div>
        <div>
          <label htmlFor="repository-settings-topics">Topics</label>
          <input
            id="repository-settings-topics"
            placeholder="swift, compiler, concurrency"
            value={topics}
            disabled={formDisabled}
            title={formDisabledReason ?? undefined}
            onChange={(event) => setTopics(event.target.value)}
          />
        </div>
        <div className="settings-status-actions">
          <button
            className="dark-action"
            type="button"
            disabled={statusActionDisabled}
            title={statusActionDisabledReason ?? undefined}
            onClick={() => onMutate("editRepository", true, { archived: !administration.isArchived })}
          >
            {saving ? "Saving…" : archiveActionLabel}
          </button>
          <small>
            {administration.isArchived
              ? "Archived repositories are read-only until restored."
              : "Archive when active repository work should stop."}
          </small>
        </div>
        {statusDisabledReason && <small className="action-disabled-note">{statusDisabledReason}</small>}
        <div className="release-options" aria-label="Repository commit policy">
          <label>
            <input
              type="checkbox"
              checked={allowForking}
              disabled={Boolean(settingControlDisabledReason(administration.allowForking, "Forking"))}
              title={settingControlDisabledReason(administration.allowForking, "Forking") ?? undefined}
              onChange={(event) => setAllowForking(event.target.checked)}
            />
            Allow forking
          </label>
          <label>
            <input
              type="checkbox"
              checked={webCommitSignoffRequired}
              disabled={Boolean(
                settingControlDisabledReason(administration.webCommitSignoffRequired, "Web commit signoff")
              )}
              title={
                settingControlDisabledReason(administration.webCommitSignoffRequired, "Web commit signoff") ??
                undefined
              }
              onChange={(event) => setWebCommitSignoffRequired(event.target.checked)}
            />
            Require web commit signoff
          </label>
        </div>
        <div className="release-options" aria-label="Repository feature toggles">
          <label>
            <input
              type="checkbox"
              checked={features.issues}
              disabled={Boolean(settingControlDisabledReason(administration.features.issues, "Issues"))}
              title={settingControlDisabledReason(administration.features.issues, "Issues") ?? undefined}
              onChange={(event) => updateFeature("issues", event.target.checked)}
            />
            Issues
          </label>
          <label>
            <input
              type="checkbox"
              checked={features.projects}
              disabled={Boolean(settingControlDisabledReason(administration.features.projects, "Projects"))}
              title={settingControlDisabledReason(administration.features.projects, "Projects") ?? undefined}
              onChange={(event) => updateFeature("projects", event.target.checked)}
            />
            Projects
          </label>
          <label>
            <input
              type="checkbox"
              checked={features.wiki}
              disabled={Boolean(settingControlDisabledReason(administration.features.wiki, "Wiki"))}
              title={settingControlDisabledReason(administration.features.wiki, "Wiki") ?? undefined}
              onChange={(event) => updateFeature("wiki", event.target.checked)}
            />
            Wiki
          </label>
          <label>
            <input
              type="checkbox"
              checked={features.discussions}
              disabled={Boolean(
                settingControlDisabledReason(administration.features.discussions, "Discussions")
              )}
              title={
                settingControlDisabledReason(administration.features.discussions, "Discussions") ?? undefined
              }
              onChange={(event) => updateFeature("discussions", event.target.checked)}
            />
            Discussions
          </label>
        </div>
        <div className="release-options" aria-label="Repository merge policy">
          <label>
            <input
              type="checkbox"
              checked={mergeSettings.allowMergeCommit}
              disabled={Boolean(
                settingControlDisabledReason(administration.mergeSettings.allowMergeCommit, "Merge commits")
              )}
              title={
                settingControlDisabledReason(
                  administration.mergeSettings.allowMergeCommit,
                  "Merge commits"
                ) ?? undefined
              }
              onChange={(event) => updateMergeSetting("allowMergeCommit", event.target.checked)}
            />
            Merge commits
          </label>
          <label>
            <input
              type="checkbox"
              checked={mergeSettings.allowSquashMerge}
              disabled={Boolean(
                settingControlDisabledReason(administration.mergeSettings.allowSquashMerge, "Squash merge")
              )}
              title={
                settingControlDisabledReason(administration.mergeSettings.allowSquashMerge, "Squash merge") ??
                undefined
              }
              onChange={(event) => updateMergeSetting("allowSquashMerge", event.target.checked)}
            />
            Squash merge
          </label>
          <label>
            <input
              type="checkbox"
              checked={mergeSettings.allowRebaseMerge}
              disabled={Boolean(
                settingControlDisabledReason(administration.mergeSettings.allowRebaseMerge, "Rebase merge")
              )}
              title={
                settingControlDisabledReason(administration.mergeSettings.allowRebaseMerge, "Rebase merge") ??
                undefined
              }
              onChange={(event) => updateMergeSetting("allowRebaseMerge", event.target.checked)}
            />
            Rebase merge
          </label>
          <label>
            <input
              type="checkbox"
              checked={mergeSettings.allowAutoMerge}
              disabled={Boolean(
                settingControlDisabledReason(administration.mergeSettings.allowAutoMerge, "Auto-merge")
              )}
              title={
                settingControlDisabledReason(administration.mergeSettings.allowAutoMerge, "Auto-merge") ??
                undefined
              }
              onChange={(event) => updateMergeSetting("allowAutoMerge", event.target.checked)}
            />
            Auto-merge
          </label>
          <label>
            <input
              type="checkbox"
              checked={mergeSettings.deleteBranchOnMerge}
              disabled={Boolean(
                settingControlDisabledReason(
                  administration.mergeSettings.deleteBranchOnMerge,
                  "Delete branch on merge"
                )
              )}
              title={
                settingControlDisabledReason(
                  administration.mergeSettings.deleteBranchOnMerge,
                  "Delete branch on merge"
                ) ?? undefined
              }
              onChange={(event) => updateMergeSetting("deleteBranchOnMerge", event.target.checked)}
            />
            Delete branch on merge
          </label>
          <label>
            <input
              type="checkbox"
              checked={mergeSettings.allowUpdateBranch}
              disabled={Boolean(
                settingControlDisabledReason(
                  administration.mergeSettings.allowUpdateBranch,
                  "Update branch button"
                )
              )}
              title={
                settingControlDisabledReason(
                  administration.mergeSettings.allowUpdateBranch,
                  "Update branch button"
                ) ?? undefined
              }
              onChange={(event) => updateMergeSetting("allowUpdateBranch", event.target.checked)}
            />
            Update branch button
          </label>
        </div>
        <button
          className="dark-action"
          type="submit"
          disabled={formDisabled}
          title={formDisabledReason ?? undefined}
        >
          {saving ? "Saving…" : "Save repository settings"}
        </button>
        {settingsDisabledReason && <small className="action-disabled-note">{settingsDisabledReason}</small>}
        {saveSucceeded && !saving && <div className="muted-row">Repository settings saved.</div>}
        {saveError && (
          <div className="error-state">Could not save repository settings: {saveError.message}</div>
        )}
      </form>

      <div className="settings-list-grid">
        <section>
          <h3>Features</h3>
          {featureRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{settingStateLabel(value)}</strong>
            </div>
          ))}
        </section>
        <section>
          <h3>Merge policy</h3>
          {mergeRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{settingStateLabel(value)}</strong>
            </div>
          ))}
        </section>
        <section>
          <h3>Your access</h3>
          {permissionRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{permissionStateLabel(value)}</strong>
            </div>
          ))}
        </section>
        <section>
          <h3>Security features</h3>
          {securityFeatureRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{securityFeatureStatusLabel(value)}</strong>
            </div>
          ))}
        </section>
      </div>

      <section className="repository-admin-section">
        <header>
          <div>
            <h3>Branch protection</h3>
            <small>{branchProtectionBranch ?? "No branch selected"}</small>
          </div>
          <span
            className={`state-chip ${branchProtectionError || branchProtectionAvailabilityMessage ? "attention" : ""}`}
          >
            {branchProtectionLoading && !branchProtection
              ? "loading"
              : branchProtectionError || branchProtectionAvailabilityMessage
                ? "unavailable"
                : branchProtectionExists
                  ? "protected"
                  : "unprotected"}
          </span>
        </header>
        {branchProtectionError && (
          <div className="error-state">Branch protection unavailable: {branchProtectionError.message}</div>
        )}
        {branchProtectionAvailabilityMessage && (
          <div className="error-state">{branchProtectionAvailabilityMessage}</div>
        )}
        <form className="repository-admin-form" onSubmit={submitBranchProtection}>
          <label>
            Required approvals
            <input
              type="number"
              min="0"
              max="6"
              value={branchRequiredApprovals}
              disabled={branchProtectionDisabled || !branchRequiresReviews}
              title={branchProtectionDisabledReason ?? undefined}
              onChange={(event) => setBranchRequiredApprovals(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={branchRequiresReviews}
              disabled={branchProtectionDisabled}
              title={branchProtectionDisabledReason ?? undefined}
              onChange={(event) => setBranchRequiresReviews(event.target.checked)}
            />
            Require pull request reviews
          </label>
          <label>
            <input
              type="checkbox"
              checked={branchEnforceAdmins}
              disabled={branchProtectionDisabled}
              title={branchProtectionDisabledReason ?? undefined}
              onChange={(event) => setBranchEnforceAdmins(event.target.checked)}
            />
            Enforce for admins
          </label>
          <label>
            <input
              type="checkbox"
              checked={branchRequireLinearHistory}
              disabled={branchProtectionDisabled}
              title={branchProtectionDisabledReason ?? undefined}
              onChange={(event) => setBranchRequireLinearHistory(event.target.checked)}
            />
            Require linear history
          </label>
          <label>
            <input
              type="checkbox"
              checked={branchRequireConversationResolution}
              disabled={branchProtectionDisabled}
              title={branchProtectionDisabledReason ?? undefined}
              onChange={(event) => setBranchRequireConversationResolution(event.target.checked)}
            />
            Require conversation resolution
          </label>
          <div className="repository-admin-actions">
            <button
              className="dark-action"
              type="submit"
              disabled={branchProtectionDisabled}
              title={branchProtectionDisabledReason ?? undefined}
            >
              {branchProtectionExists ? "Update branch protection" : "Create branch protection"}
            </button>
            <button
              type="button"
              disabled={branchProtectionDisabled || !branchProtectionExists}
              title={
                !branchProtectionExists
                  ? "This branch does not have protection to delete."
                  : (branchProtectionDisabledReason ?? undefined)
              }
              onClick={deleteBranchProtection}
            >
              Delete branch protection
            </button>
          </div>
          {branchProtectionDisabledReason && (
            <small className="action-disabled-note">{branchProtectionDisabledReason}</small>
          )}
        </form>
      </section>

      <section className="repository-admin-section">
        <header>
          <div>
            <h3>Repository rulesets</h3>
            <small>Basic create/update/delete controls for repository-owned rulesets.</small>
          </div>
          <span
            className={`state-chip ${repositoryRulesetsError || repositoryRulesetsAvailabilityMessage ? "attention" : ""}`}
          >
            {repositoryRulesetsLoading && repositoryRulesets.length === 0
              ? "loading"
              : repositoryRulesetsError || repositoryRulesetsAvailabilityMessage
                ? "unavailable"
                : `${repositoryRulesets.length} rulesets`}
          </span>
        </header>
        {repositoryRulesetsError && (
          <div className="error-state">
            Repository rulesets unavailable: {repositoryRulesetsError.message}
          </div>
        )}
        {repositoryRulesetsAvailabilityMessage && (
          <div className="error-state">{repositoryRulesetsAvailabilityMessage}</div>
        )}
        <form className="repository-admin-form repository-admin-inline-form" onSubmit={submitCreateRuleset}>
          <label>
            Ruleset name
            <input
              value={rulesetName}
              placeholder="Branch rules"
              disabled={rulesetDisabled}
              title={rulesetDisabledReason ?? undefined}
              onChange={(event) => setRulesetName(event.target.value)}
            />
          </label>
          <label>
            Enforcement
            <select
              value={rulesetEnforcement}
              disabled={rulesetDisabled}
              title={rulesetDisabledReason ?? undefined}
              onChange={(event) => setRulesetEnforcement(event.target.value)}
            >
              <option value="active">active</option>
              <option value="evaluate">evaluate</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <button
            className="dark-action"
            type="submit"
            disabled={rulesetDisabled || rulesetName.trim().length === 0}
            title={rulesetDisabledReason ?? "Enter a ruleset name."}
          >
            Create ruleset
          </button>
        </form>
        {repositoryRulesets.length > 0 && (
          <div className="repository-admin-list">
            {repositoryRulesets.map((ruleset) => {
              const inherited = ruleset.sourceType !== null && ruleset.sourceType !== "Repository";
              const disabledReason = inherited
                ? "Inherited rulesets must be managed from their source."
                : (rulesetDisabledReason ?? null);
              return (
                <div className="repository-admin-row" key={ruleset.id}>
                  <span>
                    <strong>{ruleset.name}</strong>
                    <small>
                      {ruleset.enforcement ?? "unknown"} · {ruleset.target ?? "target unknown"}
                      {ruleset.source ? ` · ${ruleset.source}` : ""}
                    </small>
                    <small>{rulesetCompactSummary(ruleset)}</small>
                  </span>
                  <div>
                    <button
                      type="button"
                      disabled={Boolean(disabledReason)}
                      title={disabledReason ?? undefined}
                      onClick={() => onMutate("updateRepositoryRuleset", false, rulesetPayload(ruleset))}
                    >
                      Apply baseline
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(disabledReason)}
                      title={disabledReason ?? undefined}
                      onClick={() => onMutate("deleteRepositoryRuleset", true, { rulesetId: ruleset.id })}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      disabled={!ruleset.htmlUrl}
                      title={ruleset.htmlUrl ? "Open ruleset on GitHub" : "Ruleset URL unavailable."}
                      onClick={() => {
                        if (ruleset.htmlUrl) {
                          onOpenExternal(ruleset.htmlUrl);
                        }
                      }}
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {repositoryRulesets.length >= repositoryRulesetsLimit && (
          <div className="muted-row">
            Showing the first {repositoryRulesets.length} rulesets returned by GitHub.
          </div>
        )}
        {rulesetDisabledReason && <small className="action-disabled-note">{rulesetDisabledReason}</small>}
      </section>

      {repositoryAdminMutationSucceeded && mutationAction && (
        <div className="muted-row">{githubActionLabel(mutationAction)} completed.</div>
      )}
      {repositoryAdminMutationError && (
        <div className="error-state">
          Could not run {mutationAction ? githubActionLabel(mutationAction) : "repository admin action"}:{" "}
          {repositoryAdminMutationError.message}
        </div>
      )}

      <section className="settings-network-section">
        <header>
          <h3>Fork network</h3>
          <span className={`state-chip ${forkNetworkUnavailable ? "attention" : ""}`}>
            {forkNetworkStatusLabel}
          </span>
        </header>
        {repositoryForksLoading && !repositoryForks && <div className="loading-state">Loading forks…</div>}
        {repositoryForksError && (
          <div className="error-state">Fork network unavailable: {repositoryForksError.message}</div>
        )}
        {forkNetworkAvailabilityMessage && (
          <div className="error-state">{forkNetworkAvailabilityMessage}</div>
        )}
        {!repositoryForksLoading &&
          !repositoryForksError &&
          !forkNetworkAvailabilityMessage &&
          forks.length === 0 && <div className="empty-state">No visible forks returned.</div>}
        {forks.length > 0 && (
          <div className="fork-network-list">
            {forks.map((fork) => (
              <div key={fork.id} className="fork-network-row">
                <button type="button" onClick={() => onOpenRepository(fork.nameWithOwner)}>
                  <GitFork size={15} />
                  <span>
                    <strong>{fork.nameWithOwner}</strong>
                    <small>{repositoryForkMetadataLabel(fork)}</small>
                  </span>
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  title={`Open ${fork.nameWithOwner} on GitHub`}
                  onClick={() => onOpenExternal(fork.htmlUrl)}
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {canExpandForks && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandForks}>
              Load more forks
            </button>
          </div>
        )}
        {!canExpandForks && forksLimitHit && (
          <div className="muted-row">Showing the first {forks.length} forks returned by GitHub.</div>
        )}
      </section>

      <div className="settings-access-grid">
        <section>
          <header>
            <h3>Collaborators</h3>
            <span className={`state-chip ${collaboratorsStatusUnavailable ? "attention" : ""}`}>
              {collaboratorsStatusLabel}
            </span>
          </header>
          <form className="repository-admin-inline-form" onSubmit={submitAddCollaborator}>
            <input
              aria-label="Collaborator username"
              placeholder="username"
              value={collaboratorLogin}
              disabled={adminDisabled}
              title={adminDisabledReason ?? undefined}
              onChange={(event) => setCollaboratorLogin(event.target.value)}
            />
            <select
              aria-label="Collaborator permission"
              value={collaboratorPermission}
              disabled={adminDisabled}
              title={adminDisabledReason ?? undefined}
              onChange={(event) => setCollaboratorPermission(event.target.value)}
            >
              <option value="pull">read</option>
              <option value="triage">triage</option>
              <option value="push">write</option>
              <option value="maintain">maintain</option>
              <option value="admin">admin</option>
            </select>
            <button
              className="dark-action"
              type="submit"
              disabled={adminDisabled || collaboratorLogin.trim().length === 0}
              title={adminDisabledReason ?? "Enter a username."}
            >
              Add
            </button>
          </form>
          {repositoryAccessLoading && !repositoryAccess && (
            <div className="loading-state">Loading collaborators…</div>
          )}
          {repositoryAccessError && (
            <div className="error-state">Repository access unavailable: {repositoryAccessError.message}</div>
          )}
          {collaboratorsAvailabilityMessage && (
            <div className="error-state">{collaboratorsAvailabilityMessage}</div>
          )}
          {!repositoryAccessLoading &&
            !repositoryAccessError &&
            !collaboratorsAvailabilityMessage &&
            collaborators.length === 0 && <div className="empty-state">No collaborators returned.</div>}
          {collaborators.length > 0 && (
            <div className="access-list">
              {collaborators.map((collaborator) => {
                const selected = collaborator.login === selectedCollaborator?.login;
                return (
                  <div
                    className={`issue-row organization-member-row ${selected ? "selected-action" : ""}`}
                    key={collaborator.id}
                  >
                    <button
                      className="organization-member-row-main"
                      type="button"
                      aria-pressed={selected}
                      title={`View @${collaborator.login} in Control`}
                      onClick={() => onSelectCollaborator(collaborator)}
                    >
                      {collaborator.avatarUrl ? (
                        <img src={collaborator.avatarUrl} alt="" />
                      ) : (
                        <span className="mini-avatar">{collaborator.login.slice(0, 1).toUpperCase()}</span>
                      )}
                      <span>
                        <strong>{collaborator.login}</strong>
                        <small>
                          {collaboratorRoleLabel(collaborator)}
                          {collaborator.type ? ` · ${collaborator.type}` : ""}
                          {collaborator.siteAdmin ? " · site admin" : ""}
                        </small>
                      </span>
                    </button>
                    <button
                      className="pin-row-button"
                      type="button"
                      aria-label={`Open ${collaborator.login} on GitHub`}
                      disabled={!collaborator.htmlUrl}
                      title={
                        collaborator.htmlUrl
                          ? `Open ${collaborator.login} on GitHub`
                          : "Collaborator profile URL unavailable."
                      }
                      onClick={() => {
                        if (collaborator.htmlUrl) {
                          onOpenExternal(collaborator.htmlUrl);
                        }
                      }}
                    >
                      <ExternalLink size={14} />
                    </button>
                    <div className="repository-admin-row-actions">
                      <select
                        aria-label={`Permission for ${collaborator.login}`}
                        value={collaboratorPermissionForMutation(collaborator)}
                        disabled={adminDisabled}
                        title={adminDisabledReason ?? undefined}
                        onChange={(event) => updateCollaboratorPermission(collaborator, event.target.value)}
                      >
                        <option value="pull">read</option>
                        <option value="triage">triage</option>
                        <option value="push">write</option>
                        <option value="maintain">maintain</option>
                        <option value="admin">admin</option>
                      </select>
                      <button
                        type="button"
                        disabled={adminDisabled}
                        title={adminDisabledReason ?? `Remove ${collaborator.login}`}
                        onClick={() => removeCollaborator(collaborator)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {canExpandCollaborators && (
            <div className="table-action-row">
              <button type="button" onClick={onExpandRepositoryAccess}>
                Load more collaborators
              </button>
            </div>
          )}
          {!canExpandCollaborators && collaboratorsLimitHit && (
            <div className="muted-row">
              Showing the first {collaborators.length} collaborators returned by GitHub.
            </div>
          )}
          {selectedCollaborator && (
            <aside className="contributor-detail-panel repository-collaborator-detail-panel">
              <div className="contributor-detail-header">
                {(selectedCollaboratorProfileData?.avatarUrl ?? selectedCollaborator.avatarUrl) ? (
                  <img
                    src={
                      selectedCollaboratorProfileData?.avatarUrl ??
                      selectedCollaborator.avatarUrl ??
                      undefined
                    }
                    alt=""
                    onError={(event) => event.currentTarget.remove()}
                  />
                ) : (
                  <span className="mini-avatar">{selectedCollaborator.login.slice(0, 1).toUpperCase()}</span>
                )}
                <div>
                  <strong>{selectedCollaboratorProfileData?.name ?? `@${selectedCollaborator.login}`}</strong>
                  <small>@{selectedCollaboratorProfileData?.login ?? selectedCollaborator.login}</small>
                </div>
                {selectedCollaboratorProfileUrl && (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Open @${selectedCollaborator.login} on GitHub`}
                    title={`Open @${selectedCollaborator.login} on GitHub`}
                    onClick={() => onOpenExternal(selectedCollaboratorProfileUrl)}
                  >
                    <ExternalLink size={15} />
                  </button>
                )}
              </div>

              {!githubReady && (
                <div className="muted-row">
                  Cached mode: showing stored collaborator details when available.
                </div>
              )}
              {selectedCollaboratorProfile.isFetching && !selectedCollaboratorProfileData && (
                <div className="loading-state">Loading collaborator profile…</div>
              )}
              {selectedCollaboratorProfile.error instanceof Error && (
                <div className="error-state">
                  Profile unavailable: {selectedCollaboratorProfile.error.message}
                </div>
              )}
              {selectedCollaboratorProfileAvailabilityMessage && (
                <div className="error-state">{selectedCollaboratorProfileAvailabilityMessage}</div>
              )}
              {selectedCollaboratorPermissionContext && (
                <div className="muted-row">{selectedCollaboratorPermissionContext}</div>
              )}

              {(selectedCollaboratorProfileData?.bio ||
                selectedCollaboratorProfileData?.company ||
                selectedCollaboratorProfileData?.location ||
                selectedCollaboratorProfileData?.websiteUrl) && (
                <div className="contributor-detail-copy">
                  {selectedCollaboratorProfileData.bio && <p>{selectedCollaboratorProfileData.bio}</p>}
                  {selectedCollaboratorProfileData.company && (
                    <small>{selectedCollaboratorProfileData.company}</small>
                  )}
                  {selectedCollaboratorProfileData.location && (
                    <small>{selectedCollaboratorProfileData.location}</small>
                  )}
                  {selectedCollaboratorProfileData.websiteUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenExternal(selectedCollaboratorProfileData.websiteUrl!)}
                    >
                      {selectedCollaboratorProfileData.websiteUrl}
                    </button>
                  )}
                </div>
              )}

              <div className="contributor-stats">
                <span>
                  <strong>
                    {formatCompactNumber(
                      selectedCollaboratorProfileData?.repositoryCount ??
                        selectedCollaboratorRepositoryItems.length
                    )}
                  </strong>
                  <small>Repositories</small>
                </span>
                <span>
                  <strong>
                    {formatCompactNumber(selectedCollaboratorProfileData?.starredRepositoryCount ?? 0)}
                  </strong>
                  <small>Starred</small>
                </span>
                <span>
                  <strong>{formatCompactNumber(selectedCollaboratorProfileData?.followers ?? 0)}</strong>
                  <small>Followers</small>
                </span>
                <span>
                  <strong>{formatCompactNumber(selectedCollaboratorProfileData?.following ?? 0)}</strong>
                  <small>Following</small>
                </span>
              </div>

              <div className="contributor-repositories">
                <div className="section-title-row">
                  <span>Repositories</span>
                </div>
                {selectedCollaboratorRepositories.isFetching && !selectedCollaboratorRepositories.data && (
                  <div className="loading-state">Loading repositories…</div>
                )}
                {selectedCollaboratorRepositories.error instanceof Error && (
                  <div className="error-state">
                    Repositories unavailable: {selectedCollaboratorRepositories.error.message}
                  </div>
                )}
                {selectedCollaboratorRepositoriesAvailabilityMessage && (
                  <div className="error-state">{selectedCollaboratorRepositoriesAvailabilityMessage}</div>
                )}
                {!selectedCollaboratorRepositories.isFetching &&
                  !selectedCollaboratorRepositories.error &&
                  !selectedCollaboratorRepositoriesAvailabilityMessage &&
                  selectedCollaboratorRepositoryItems.length === 0 && (
                    <div className="empty-state">
                      {githubReady ? "No repositories available." : "No cached repositories available."}
                    </div>
                  )}
                {selectedCollaboratorRepositoryItems.map((repository) => {
                  const metadataParts = repositoryCollectionMetadataParts(repository);
                  const visibilityLabel = repository.visibility.toLowerCase();
                  const showPrivateChip = repository.isPrivate && visibilityLabel !== "private";

                  return (
                    <button
                      className="contributor-repository-row"
                      key={repository.id}
                      type="button"
                      onClick={() => onOpenRepository(repository.nameWithOwner)}
                    >
                      <span>
                        <strong>{repository.nameWithOwner}</strong>
                        <small>{repository.description ?? "No description."}</small>
                        {metadataParts.length > 0 && <small>{metadataParts.join(" · ")}</small>}
                      </span>
                      <span>
                        <span className="state-chip">{visibilityLabel}</span>
                        {repository.isFork && <span className="state-chip attention">fork</span>}
                        {showPrivateChip && <span className="state-chip attention">private</span>}
                      </span>
                    </button>
                  );
                })}
                {canExpandSelectedCollaboratorRepositories && (
                  <div className="table-action-row">
                    <button type="button" onClick={expandSelectedCollaboratorRepositories}>
                      Load more repositories
                    </button>
                  </div>
                )}
                {!canExpandSelectedCollaboratorRepositories && selectedCollaboratorRepositoriesLimitHit && (
                  <div className="muted-row">
                    Showing the first {selectedCollaboratorRepositoryItems.length} repositories returned by
                    GitHub.
                  </div>
                )}
              </div>
            </aside>
          )}
        </section>
        <section>
          <header>
            <h3>Team access</h3>
            <span className={`state-chip ${teamsStatusUnavailable ? "attention" : ""}`}>
              {teamsStatusLabel}
            </span>
          </header>
          <form className="repository-admin-inline-form" onSubmit={submitAddTeam}>
            <input
              aria-label="Team slug"
              placeholder="team-slug"
              value={teamSlug}
              disabled={adminDisabled}
              title={adminDisabledReason ?? undefined}
              onChange={(event) => setTeamSlug(event.target.value)}
            />
            <select
              aria-label="Team permission"
              value={teamPermission}
              disabled={adminDisabled}
              title={adminDisabledReason ?? undefined}
              onChange={(event) => setTeamPermission(event.target.value)}
            >
              <option value="pull">read</option>
              <option value="triage">triage</option>
              <option value="push">write</option>
              <option value="maintain">maintain</option>
              <option value="admin">admin</option>
            </select>
            <button
              className="dark-action"
              type="submit"
              disabled={adminDisabled || teamSlug.trim().length === 0}
              title={adminDisabledReason ?? "Enter a team slug."}
            >
              Add
            </button>
          </form>
          {repositoryAccessLoading && !repositoryAccess && (
            <div className="loading-state">Loading repository teams…</div>
          )}
          {repositoryAccessError && (
            <div className="error-state">Repository access unavailable: {repositoryAccessError.message}</div>
          )}
          {teamsAvailabilityMessage && <div className="error-state">{teamsAvailabilityMessage}</div>}
          {!repositoryAccessLoading &&
            !repositoryAccessError &&
            !teamsAvailabilityMessage &&
            accessTeams.length === 0 && <div className="empty-state">No teams returned.</div>}
          {accessTeams.length > 0 && (
            <div className="access-list">
              {accessTeams.map((team) => (
                <div className="issue-row organization-team-row" key={team.id}>
                  <button
                    className="organization-row-main"
                    type="button"
                    title={`Open ${team.name} in Control`}
                    onClick={() => onOpenTeam(team)}
                  >
                    <span className="mini-avatar">{team.name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{team.name}</strong>
                      <small>
                        {accessRoleLabel(team.permission)}
                        {team.privacy ? ` · ${team.privacy}` : ""}
                        {team.memberCount !== null ? ` · ${team.memberCount} members` : ""}
                      </small>
                    </span>
                  </button>
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label={`Open ${team.name} on GitHub`}
                    disabled={!team.htmlUrl}
                    title={team.htmlUrl ? `Open ${team.name} on GitHub` : "Team URL unavailable."}
                    onClick={() => {
                      if (team.htmlUrl) {
                        onOpenExternal(team.htmlUrl);
                      }
                    }}
                  >
                    <ExternalLink size={14} />
                  </button>
                  <div className="repository-admin-row-actions">
                    <select
                      aria-label={`Permission for ${team.name}`}
                      value={team.permission ?? "push"}
                      disabled={adminDisabled}
                      title={adminDisabledReason ?? undefined}
                      onChange={(event) => updateTeamPermission(team, event.target.value)}
                    >
                      <option value="pull">read</option>
                      <option value="triage">triage</option>
                      <option value="push">write</option>
                      <option value="maintain">maintain</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      type="button"
                      disabled={adminDisabled}
                      title={adminDisabledReason ?? `Remove ${team.name}`}
                      onClick={() => removeTeam(team)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {canExpandAccessTeams && (
            <div className="table-action-row">
              <button type="button" onClick={onExpandRepositoryAccess}>
                Load more teams
              </button>
            </div>
          )}
          {!canExpandAccessTeams && accessTeamsLimitHit && (
            <div className="muted-row">Showing the first {accessTeams.length} teams returned by GitHub.</div>
          )}
        </section>
      </div>
    </section>
  );
}
