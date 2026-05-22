import type {
  BranchProtectionInput,
  BranchProtectionResult,
  BranchProtectionSummary,
  CodeScanningAlertSummary,
  CodeScanningAlertsInput,
  CodeScanningAlertsResult,
  CommunityProfileFileSummary,
  DependabotAlertSummary,
  DependabotAlertsInput,
  DependabotAlertsResult,
  GitHubReadAvailability,
  RepositoryCommunityProfileInput,
  RepositoryCommunityProfileResult,
  RepositoryRulesetSummary,
  RepositoryRulesetsInput,
  RepositoryRulesetsResult,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityAdvisorySummary,
  RepositorySecurityPolicy,
  RepositorySecurityPolicyInput,
  RepositorySecurityPolicyResult,
  SecretScanningAlertSummary,
  SecretScanningAlertsInput,
  SecretScanningAlertsResult
} from "@shared/github";

export interface OctokitSecurityClient {
  rest<T>(route: string, params?: Record<string, unknown>): Promise<T>;
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
}

const securityPolicyContentLimit = 128_000;
const securityPolicyCandidatePaths = ["SECURITY.md", ".github/SECURITY.md", "docs/SECURITY.md"];

export class OctokitSecurityDomain {
  constructor(
    private readonly client: OctokitSecurityClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async getBranchProtection(input: BranchProtectionInput): Promise<BranchProtectionResult> {
    try {
      const protection = await this.client.rest<GitHubBranchProtection>(
        "GET /repos/{owner}/{repo}/branches/{branch}/protection",
        {
          owner: input.owner,
          repo: input.repo,
          branch: input.branch
        }
      );

      return {
        protection: mapBranchProtection(input.branch, protection),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        protection: null,
        availability: mapBranchProtectionError(input.branch, error, this.mapError)
      };
    }
  }

  async listDependabotAlerts(input: DependabotAlertsInput): Promise<DependabotAlertsResult> {
    try {
      const alerts = await this.client.restPaginatedArray<GitHubDependabotAlert>(
        "GET /repos/{owner}/{repo}/dependabot/alerts",
        {
          owner: input.owner,
          repo: input.repo,
          state: input.state ?? "open"
        },
        input.limit ?? 30
      );

      return {
        items: alerts.map(mapDependabotAlert),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Dependabot alerts", error, this.mapError)
      };
    }
  }

  async listCodeScanningAlerts(input: CodeScanningAlertsInput): Promise<CodeScanningAlertsResult> {
    try {
      const alerts = await this.client.restPaginatedArray<GitHubCodeScanningAlert>(
        "GET /repos/{owner}/{repo}/code-scanning/alerts",
        {
          owner: input.owner,
          repo: input.repo,
          state: input.state ?? "open"
        },
        input.limit ?? 30
      );

      return {
        items: alerts.map(mapCodeScanningAlert),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Code scanning alerts", error, this.mapError)
      };
    }
  }

  async listSecretScanningAlerts(input: SecretScanningAlertsInput): Promise<SecretScanningAlertsResult> {
    try {
      const alerts = await this.client.restPaginatedArray<GitHubSecretScanningAlert>(
        "GET /repos/{owner}/{repo}/secret-scanning/alerts",
        {
          owner: input.owner,
          repo: input.repo,
          state: input.state ?? "open"
        },
        input.limit ?? 30
      );

      return {
        items: alerts.map(mapSecretScanningAlert),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Secret scanning alerts", error, this.mapError)
      };
    }
  }

  async listRepositoryRulesets(input: RepositoryRulesetsInput): Promise<RepositoryRulesetsResult> {
    try {
      const rulesets = await this.client.restPaginatedArray<GitHubRepositoryRuleset>(
        "GET /repos/{owner}/{repo}/rulesets",
        {
          owner: input.owner,
          repo: input.repo,
          includes_parents: input.includesParents ?? true
        },
        input.limit ?? 30
      );

      return {
        items: rulesets.map(mapRepositoryRuleset),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Repository rulesets", error, this.mapError)
      };
    }
  }

  async listRepositorySecurityAdvisories(
    input: RepositorySecurityAdvisoriesInput
  ): Promise<RepositorySecurityAdvisoriesResult> {
    try {
      const advisories = await this.client.restPaginatedArray<GitHubRepositorySecurityAdvisory>(
        "GET /repos/{owner}/{repo}/security-advisories",
        {
          owner: input.owner,
          repo: input.repo
        },
        input.limit ?? 30
      );

      return {
        items: advisories.map(mapRepositorySecurityAdvisory),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Security advisories", error, this.mapError)
      };
    }
  }

  async getRepositorySecurityPolicy(
    input: RepositorySecurityPolicyInput
  ): Promise<RepositorySecurityPolicyResult> {
    try {
      for (const path of securityPolicyCandidatePaths) {
        try {
          const item = await this.client.rest<GitHubContentFile>(
            "GET /repos/{owner}/{repo}/contents/{path}",
            {
              owner: input.owner,
              repo: input.repo,
              path,
              ref: input.ref ?? undefined
            }
          );

          return {
            policy: mapRepositorySecurityPolicy(input, item),
            availability: { status: "available", message: null }
          };
        } catch (error: unknown) {
          if (isGitHubStatus(error, 404)) {
            continue;
          }
          throw error;
        }
      }

      return {
        policy: null,
        availability: {
          status: "available",
          message: "No security policy file found in SECURITY.md, .github/SECURITY.md, or docs/SECURITY.md."
        }
      };
    } catch (error: unknown) {
      return {
        policy: null,
        availability: mapRepositorySecurityError("Security policy", error, this.mapError)
      };
    }
  }

  async getRepositoryCommunityProfile(
    input: RepositoryCommunityProfileInput
  ): Promise<RepositoryCommunityProfileResult> {
    try {
      const profile = await this.client.rest<GitHubCommunityProfile>(
        "GET /repos/{owner}/{repo}/community/profile",
        {
          owner: input.owner,
          repo: input.repo
        }
      );

      return {
        profile: mapCommunityProfile(profile),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        profile: null,
        availability: mapRepositorySecurityError("Community profile", error, this.mapError)
      };
    }
  }
}

function mapBranchProtection(branch: string, protection: GitHubBranchProtection): BranchProtectionSummary {
  return {
    branch,
    url: protection.url ?? null,
    requiredStatusCheckContexts: protection.required_status_checks?.contexts ?? [],
    requiredStatusCheckEnforcementLevel: protection.required_status_checks?.enforcement_level ?? null,
    enforceAdmins: protection.enforce_admins?.enabled ?? null,
    requiresPullRequestReviews: Boolean(protection.required_pull_request_reviews),
    requiredApprovingReviewCount:
      protection.required_pull_request_reviews?.required_approving_review_count ?? null,
    dismissStaleReviews: protection.required_pull_request_reviews?.dismiss_stale_reviews ?? null,
    requireCodeOwnerReviews: protection.required_pull_request_reviews?.require_code_owner_reviews ?? null,
    requireLastPushApproval: protection.required_pull_request_reviews?.require_last_push_approval ?? null,
    restrictsPushes: Boolean(protection.restrictions),
    restrictionUserCount: protection.restrictions?.users?.length ?? null,
    restrictionTeamCount: protection.restrictions?.teams?.length ?? null,
    restrictionAppCount: protection.restrictions?.apps?.length ?? null,
    requiredLinearHistory: protection.required_linear_history?.enabled ?? null,
    allowForcePushes: protection.allow_force_pushes?.enabled ?? null,
    allowDeletions: protection.allow_deletions?.enabled ?? null,
    requiredConversationResolution: protection.required_conversation_resolution?.enabled ?? null,
    lockBranch: protection.lock_branch?.enabled ?? null,
    allowForkSyncing: protection.allow_fork_syncing?.enabled ?? null
  };
}

function mapBranchProtectionError(
  branch: string,
  error: unknown,
  mapError: (error: unknown) => GitHubReadAvailability
): GitHubReadAvailability {
  const errorRecord =
    error && typeof error === "object" ? (error as { status?: unknown; message?: unknown }) : {};
  const status = typeof errorRecord.status === "number" ? errorRecord.status : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof errorRecord.message === "string"
        ? errorRecord.message
        : typeof error === "string"
          ? error
          : null;

  if (status === 404) {
    return {
      status: "feature_disabled",
      message: message ?? `Branch protection is not enabled for ${branch}.`
    };
  }

  return mapError(error);
}

function mapRepositorySecurityError(
  feature: string,
  error: unknown,
  mapError: (error: unknown) => GitHubReadAvailability
): GitHubReadAvailability {
  const errorRecord =
    error && typeof error === "object" ? (error as { status?: unknown; message?: unknown }) : {};
  const status = typeof errorRecord.status === "number" ? errorRecord.status : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof errorRecord.message === "string"
        ? errorRecord.message
        : typeof error === "string"
          ? error
          : null;
  const normalized = (message ?? "").toLowerCase();
  const isFeatureDisabled = normalized.includes("disabled") || normalized.includes("not enabled");

  if (status === 404) {
    return {
      status: "feature_disabled",
      message: message ?? `${feature} are not enabled or accessible for this repository.`
    };
  }

  if (isFeatureDisabled) {
    return {
      status: "feature_disabled",
      message: message ?? `${feature} are not enabled or accessible for this repository.`
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: "permission_denied",
      message: message ?? `${feature} are not accessible with the current token.`
    };
  }

  return mapError(error);
}

function mapDependabotAlert(alert: GitHubDependabotAlert): DependabotAlertSummary {
  return {
    number: alert.number,
    state: alert.state,
    severity: alert.security_advisory?.severity ?? null,
    packageName: alert.dependency?.package?.name ?? null,
    ecosystem: alert.dependency?.package?.ecosystem ?? null,
    manifestPath: alert.dependency?.manifest_path ?? null,
    scope: alert.dependency?.scope ?? null,
    summary: alert.security_advisory?.summary ?? null,
    htmlUrl: alert.html_url ?? null,
    createdAt: alert.created_at ?? null,
    updatedAt: alert.updated_at ?? null,
    dismissedAt: alert.dismissed_at ?? null,
    fixedAt: alert.fixed_at ?? null
  };
}

function mapCodeScanningAlert(alert: GitHubCodeScanningAlert): CodeScanningAlertSummary {
  const location = alert.most_recent_instance?.location;

  return {
    number: alert.number,
    state: alert.state,
    severity: alert.rule?.security_severity_level ?? alert.rule?.severity ?? null,
    ruleId: alert.rule?.id ?? null,
    ruleName: alert.rule?.name ?? null,
    ruleDescription: alert.rule?.description ?? null,
    toolName: alert.tool?.name ?? null,
    message: alert.most_recent_instance?.message?.text ?? null,
    ref: alert.most_recent_instance?.ref ?? null,
    path: location?.path ?? null,
    startLine: location?.start_line ?? null,
    endLine: location?.end_line ?? null,
    htmlUrl: alert.html_url ?? null,
    createdAt: alert.created_at ?? null,
    updatedAt: alert.updated_at ?? null,
    dismissedAt: alert.dismissed_at ?? null,
    fixedAt: alert.fixed_at ?? null
  };
}

function mapSecretScanningAlert(alert: GitHubSecretScanningAlert): SecretScanningAlertSummary {
  const firstLocation = alert.first_location_detected;

  return {
    number: alert.number,
    state: alert.state,
    secretType: alert.secret_type ?? null,
    secretTypeDisplayName: alert.secret_type_display_name ?? null,
    resolution: alert.resolution ?? null,
    validity: alert.validity ?? null,
    publiclyLeaked: alert.publicly_leaked ?? null,
    multiRepo: alert.multi_repo ?? null,
    pushProtectionBypassed: alert.push_protection_bypassed ?? null,
    pushProtectionBypassedAt: alert.push_protection_bypassed_at ?? null,
    firstLocationPath: firstLocation?.path ?? null,
    firstLocationStartLine: firstLocation?.start_line ?? null,
    firstLocationEndLine: firstLocation?.end_line ?? null,
    htmlUrl: alert.html_url ?? null,
    createdAt: alert.created_at ?? null,
    updatedAt: alert.updated_at ?? null,
    resolvedAt: alert.resolved_at ?? null
  };
}

function mapRepositoryRuleset(ruleset: GitHubRepositoryRuleset): RepositoryRulesetSummary {
  const bypassActors = mapRepositoryRulesetBypassActors(ruleset.bypass_actors);
  const conditions = mapRepositoryRulesetConditions(ruleset.conditions);
  const rules = mapRepositoryRulesetRules(ruleset.rules);

  return {
    id: ruleset.id,
    nodeId: ruleset.node_id ?? null,
    name: ruleset.name,
    target: ruleset.target ?? null,
    enforcement: ruleset.enforcement ?? null,
    sourceType: ruleset.source_type ?? ruleset.ruleset_source_type ?? null,
    source: ruleset.source ?? ruleset.ruleset_source ?? null,
    htmlUrl: ruleset._links?.html?.href ?? ruleset.html_url ?? null,
    bypassActorCount: Array.isArray(ruleset.bypass_actors) ? bypassActors.length : null,
    bypassActors,
    conditionCount: ruleset.conditions ? conditions.length : null,
    conditions,
    ruleCount: Array.isArray(ruleset.rules) ? rules.length : null,
    rules,
    currentUserCanBypass: ruleset.current_user_can_bypass ?? null,
    createdAt: ruleset.created_at ?? null,
    updatedAt: ruleset.updated_at ?? null
  };
}

function mapRepositoryRulesetBypassActors(
  value: unknown[] | null | undefined
): RepositoryRulesetSummary["bypassActors"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((actor) => {
    const record = recordFromUnknown(actor);
    return {
      actorId: numberFromUnknown(record.actor_id),
      actorType: stringFromUnknown(record.actor_type),
      bypassMode: stringFromUnknown(record.bypass_mode)
    };
  });
}

function mapRepositoryRulesetConditions(
  conditions: Record<string, unknown> | null | undefined
): RepositoryRulesetSummary["conditions"] {
  if (!conditions) {
    return [];
  }

  return Object.entries(conditions).map(([type, value]) => {
    const record = recordFromUnknown(value);
    return {
      type,
      include: stringListFromUnknown(record.include),
      exclude: stringListFromUnknown(record.exclude),
      parameters: Object.entries(record)
        .filter(([key]) => key !== "include" && key !== "exclude")
        .map(([key, parameterValue]) => `${key}: ${formatUnknownValue(parameterValue)}`)
    };
  });
}

function mapRepositoryRulesetRules(value: unknown[] | null | undefined): RepositoryRulesetSummary["rules"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((rule) => {
    const record = recordFromUnknown(rule);
    const parameters = recordFromUnknown(record.parameters);
    return {
      type: stringFromUnknown(record.type) ?? "unknown",
      parameters: Object.entries(parameters).map(
        ([key, parameterValue]) => `${key}: ${formatUnknownValue(parameterValue)}`
      )
    };
  });
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringListFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => formatUnknownValue(item)).filter((item): item is string => Boolean(item));
  }

  const formatted = formatUnknownValue(value);
  return formatted ? [formatted] : [];
}

function formatUnknownValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatUnknownValue(item))
      .filter((item): item is string => Boolean(item))
      .join(", ");
  }

  const record = recordFromUnknown(value);
  const entries = Object.entries(record)
    .map(([key, entryValue]) => {
      const formatted = formatUnknownValue(entryValue);
      return formatted ? `${key}: ${formatted}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  return entries.length > 0 ? entries.join("; ") : null;
}

function mapRepositorySecurityAdvisory(
  advisory: GitHubRepositorySecurityAdvisory
): RepositorySecurityAdvisorySummary {
  return {
    ghsaId: advisory.ghsa_id,
    cveId: advisory.cve_id ?? null,
    state: advisory.state,
    severity: advisory.severity ?? null,
    summary: advisory.summary,
    description: advisory.description ?? null,
    cvssScore: advisory.cvss?.score ?? null,
    cvssVector: advisory.cvss?.vector_string ?? null,
    cweIds: (advisory.cwes ?? []).map((cwe) => cwe.cwe_id).filter((cweId): cweId is string => Boolean(cweId)),
    vulnerabilityCount: Array.isArray(advisory.vulnerabilities) ? advisory.vulnerabilities.length : null,
    creditCount: Array.isArray(advisory.credits) ? advisory.credits.length : null,
    htmlUrl: advisory.html_url ?? null,
    createdAt: advisory.created_at ?? null,
    updatedAt: advisory.updated_at ?? null,
    publishedAt: advisory.published_at ?? null,
    withdrawnAt: advisory.withdrawn_at ?? null
  };
}

function mapRepositorySecurityPolicy(
  input: RepositorySecurityPolicyInput,
  item: GitHubContentFile
): RepositorySecurityPolicy {
  const content =
    item.encoding === "base64" &&
    typeof item.content === "string" &&
    (item.size ?? item.content.length) <= securityPolicyContentLimit
      ? Buffer.from(item.content.replace(/\n/g, ""), "base64").toString("utf8")
      : null;

  return {
    path: item.path,
    htmlUrl: item.html_url ?? null,
    downloadUrl: item.download_url ?? null,
    rawUrl:
      item.download_url ??
      `https://raw.githubusercontent.com/${input.owner}/${input.repo}/${encodeURIComponent(input.ref ?? "HEAD")}/${encodePath(item.path)}`,
    sha: item.sha ?? null,
    size: typeof item.size === "number" ? item.size : null,
    ref: input.ref ?? null,
    content
  };
}

function mapCommunityProfile(profile: GitHubCommunityProfile): RepositoryCommunityProfileResult["profile"] {
  return {
    healthPercentage: typeof profile.health_percentage === "number" ? profile.health_percentage : null,
    description: profile.description ?? null,
    documentationUrl: profile.documentation ?? null,
    files: [
      mapCommunityProfileFile("readme", "README", profile.files?.readme),
      mapCommunityProfileFile("license", "License", profile.files?.license),
      mapCommunityProfileFile("codeOfConduct", "Code of conduct", profile.files?.code_of_conduct),
      mapCommunityProfileFile("contributing", "Contributing", profile.files?.contributing),
      mapCommunityProfileFile("issueTemplate", "Issue template", profile.files?.issue_template),
      mapCommunityProfileFile(
        "pullRequestTemplate",
        "Pull request template",
        profile.files?.pull_request_template
      )
    ]
  };
}

function mapCommunityProfileFile(
  key: string,
  label: string,
  file: GitHubCommunityProfileFile | null | undefined
): CommunityProfileFileSummary {
  return {
    key,
    label,
    name: file?.name ?? null,
    path: file?.path ?? null,
    htmlUrl: file?.html_url ?? null,
    downloadUrl: file?.download_url ?? null,
    url: file?.url ?? null
  };
}

function isGitHubStatus(error: unknown, status: number): boolean {
  return Boolean(error && typeof error === "object" && (error as { status?: unknown }).status === status);
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

interface GitHubBranchProtectionEnabledFlag {
  enabled?: boolean | null;
}

export interface GitHubBranchProtection {
  url?: string | null;
  required_status_checks?: {
    contexts?: string[];
    enforcement_level?: string | null;
  } | null;
  enforce_admins?: GitHubBranchProtectionEnabledFlag | null;
  required_pull_request_reviews?: {
    dismiss_stale_reviews?: boolean | null;
    require_code_owner_reviews?: boolean | null;
    required_approving_review_count?: number | null;
    require_last_push_approval?: boolean | null;
  } | null;
  restrictions?: {
    users?: unknown[];
    teams?: unknown[];
    apps?: unknown[];
  } | null;
  required_linear_history?: GitHubBranchProtectionEnabledFlag | null;
  allow_force_pushes?: GitHubBranchProtectionEnabledFlag | null;
  allow_deletions?: GitHubBranchProtectionEnabledFlag | null;
  required_conversation_resolution?: GitHubBranchProtectionEnabledFlag | null;
  lock_branch?: GitHubBranchProtectionEnabledFlag | null;
  allow_fork_syncing?: GitHubBranchProtectionEnabledFlag | null;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  sha: string;
  size?: number;
  html_url?: string;
  download_url?: string | null;
}

export interface GitHubContentFile extends GitHubContentItem {
  type: "file";
  content?: string;
  encoding?: string;
}

interface GitHubCommunityProfileFile {
  name?: string | null;
  path?: string | null;
  html_url?: string | null;
  download_url?: string | null;
  url?: string | null;
}

export interface GitHubCommunityProfile {
  health_percentage?: number | null;
  description?: string | null;
  documentation?: string | null;
  files?: {
    readme?: GitHubCommunityProfileFile | null;
    license?: GitHubCommunityProfileFile | null;
    code_of_conduct?: GitHubCommunityProfileFile | null;
    contributing?: GitHubCommunityProfileFile | null;
    issue_template?: GitHubCommunityProfileFile | null;
    pull_request_template?: GitHubCommunityProfileFile | null;
  } | null;
}

export interface GitHubDependabotAlert {
  number: number;
  state: string;
  dependency?: {
    package?: {
      ecosystem?: string | null;
      name?: string | null;
    } | null;
    manifest_path?: string | null;
    scope?: string | null;
  } | null;
  security_advisory?: {
    summary?: string | null;
    severity?: string | null;
  } | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  dismissed_at?: string | null;
  fixed_at?: string | null;
}

export interface GitHubCodeScanningAlert {
  number: number;
  state: string;
  rule?: {
    id?: string | null;
    name?: string | null;
    severity?: string | null;
    security_severity_level?: string | null;
    description?: string | null;
  } | null;
  tool?: {
    name?: string | null;
  } | null;
  most_recent_instance?: {
    ref?: string | null;
    message?: { text?: string | null } | null;
    location?: {
      path?: string | null;
      start_line?: number | null;
      end_line?: number | null;
    } | null;
  } | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  dismissed_at?: string | null;
  fixed_at?: string | null;
}

export interface GitHubSecretScanningAlert {
  number: number;
  state: string;
  resolution?: string | null;
  resolved_at?: string | null;
  secret_type?: string | null;
  secret_type_display_name?: string | null;
  validity?: string | null;
  publicly_leaked?: boolean | null;
  multi_repo?: boolean | null;
  push_protection_bypassed?: boolean | null;
  push_protection_bypassed_at?: string | null;
  first_location_detected?: {
    path?: string | null;
    start_line?: number | null;
    end_line?: number | null;
  } | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GitHubRepositoryRuleset {
  id: number;
  node_id?: string | null;
  name: string;
  target?: string | null;
  enforcement?: string | null;
  source_type?: string | null;
  source?: string | null;
  ruleset_source_type?: string | null;
  ruleset_source?: string | null;
  html_url?: string | null;
  _links?: {
    html?: { href?: string | null } | null;
  } | null;
  bypass_actors?: unknown[] | null;
  conditions?: Record<string, unknown> | null;
  rules?: unknown[] | null;
  current_user_can_bypass?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GitHubRepositorySecurityAdvisory {
  ghsa_id: string;
  cve_id?: string | null;
  state: string;
  severity?: string | null;
  summary: string;
  description?: string | null;
  cvss?: {
    score?: number | null;
    vector_string?: string | null;
  } | null;
  cwes?: Array<{ cwe_id?: string | null; name?: string | null }> | null;
  vulnerabilities?: unknown[] | null;
  credits?: unknown[] | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  withdrawn_at?: string | null;
}
