import type {
  BranchProtectionResult,
  CodeScanningAlertSummary,
  DependabotAlertSummary,
  RepositoryCommunityProfile,
  RepositoryRulesetSummary,
  RepositorySecurityAdvisorySummary,
  RepositorySecurityPolicyResult,
  SecretScanningAlertSummary
} from "@shared/github";

export const mockBranchProtection: BranchProtectionResult = {
  protection: {
    branch: "main",
    url: "https://api.github.com/repos/apple/swift/branches/main/protection",
    requiredStatusCheckContexts: ["macOS build", "linux build"],
    requiredStatusCheckEnforcementLevel: "non_admins",
    enforceAdmins: true,
    requiresPullRequestReviews: true,
    requiredApprovingReviewCount: 2,
    dismissStaleReviews: true,
    requireCodeOwnerReviews: true,
    requireLastPushApproval: false,
    restrictsPushes: true,
    restrictionUserCount: 0,
    restrictionTeamCount: 2,
    restrictionAppCount: 1,
    requiredLinearHistory: true,
    allowForcePushes: false,
    allowDeletions: false,
    requiredConversationResolution: true,
    lockBranch: false,
    allowForkSyncing: true
  },
  availability: { status: "available", message: null }
};

export const mockDependabotAlerts: DependabotAlertSummary[] = [
  {
    number: 12,
    state: "open",
    severity: "high",
    packageName: "swift-nio",
    ecosystem: "swift",
    manifestPath: "Package.swift",
    scope: "runtime",
    summary: "Improper input validation in dependency metadata",
    htmlUrl: "https://github.com/apple/swift/security/dependabot/12",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    dismissedAt: null,
    fixedAt: null
  }
];

export const mockCodeScanningAlerts: CodeScanningAlertSummary[] = [
  {
    number: 4,
    state: "open",
    severity: "error",
    ruleId: "swift/path-injection",
    ruleName: "swift/path-injection",
    ruleDescription: "Path construction includes user-controlled input",
    toolName: "CodeQL",
    message: "This path depends on a user-provided value.",
    ref: "refs/heads/main",
    path: "Sources/PackageLoading/ManifestLoader.swift",
    startLine: 117,
    endLine: 117,
    htmlUrl: "https://github.com/apple/swift/security/code-scanning/4",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    dismissedAt: null,
    fixedAt: null
  }
];

export const mockSecretScanningAlerts: SecretScanningAlertSummary[] = [
  {
    number: 42,
    state: "open",
    secretType: "mailchimp_api_key",
    secretTypeDisplayName: "Mailchimp API Key",
    resolution: null,
    validity: "unknown",
    publiclyLeaked: false,
    multiRepo: false,
    pushProtectionBypassed: false,
    pushProtectionBypassedAt: null,
    firstLocationPath: "Config/secrets.example",
    firstLocationStartLine: 12,
    firstLocationEndLine: 12,
    htmlUrl: "https://github.com/apple/swift/security/secret-scanning/42",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    resolvedAt: null
  }
];

export const mockRepositoryRulesets: RepositoryRulesetSummary[] = [
  {
    id: 9001,
    nodeId: "RRS_branch_integrity",
    name: "Default branch integrity",
    target: "branch",
    enforcement: "active",
    sourceType: "Repository",
    source: "apple/swift",
    htmlUrl: "https://github.com/apple/swift/rules/9001",
    bypassActorCount: 1,
    bypassActors: [
      {
        actorId: 42,
        actorType: "RepositoryRole",
        bypassMode: "pull_request"
      }
    ],
    conditionCount: 1,
    conditions: [
      {
        type: "ref_name",
        include: ["refs/heads/main"],
        exclude: [],
        parameters: []
      }
    ],
    ruleCount: 4,
    rules: [
      {
        type: "deletion",
        parameters: []
      },
      {
        type: "non_fast_forward",
        parameters: []
      },
      {
        type: "pull_request",
        parameters: ["required_approving_review_count: 1", "required_review_thread_resolution: true"]
      },
      {
        type: "required_status_checks",
        parameters: ["required_check: ci/build"]
      }
    ],
    currentUserCanBypass: "never",
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z"
  },
  {
    id: 9002,
    nodeId: "RRS_release_tags",
    name: "Release tag protection",
    target: "tag",
    enforcement: "evaluate",
    sourceType: "Organization",
    source: "apple",
    htmlUrl: "https://github.com/organizations/apple/settings/rules/9002",
    bypassActorCount: 2,
    bypassActors: [
      {
        actorId: 7,
        actorType: "Team",
        bypassMode: "always"
      },
      {
        actorId: 8,
        actorType: "Integration",
        bypassMode: "pull_request"
      }
    ],
    conditionCount: 1,
    conditions: [
      {
        type: "ref_name",
        include: ["refs/tags/v*"],
        exclude: ["refs/tags/v*-rc"],
        parameters: []
      }
    ],
    ruleCount: 2,
    rules: [
      {
        type: "tag_name_pattern",
        parameters: ["operator: starts_with", "pattern: v"]
      },
      {
        type: "non_fast_forward",
        parameters: []
      }
    ],
    currentUserCanBypass: "pull_requests_only",
    createdAt: "2026-01-14T12:00:00.000Z",
    updatedAt: "2026-04-27T12:00:00.000Z"
  }
];

export const mockRepositorySecurityAdvisories: RepositorySecurityAdvisorySummary[] = [
  {
    ghsaId: "GHSA-ctrl-swift-0001",
    cveId: "CVE-2026-10001",
    state: "published",
    severity: "high",
    summary: "Package manifest parsing can disclose environment hints",
    description: "Mock advisory surfaced in Control for repository security inspection.",
    cvssScore: 8.1,
    cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N",
    cweIds: ["CWE-200", "CWE-668"],
    vulnerabilityCount: 2,
    creditCount: 1,
    htmlUrl: "https://github.com/apple/swift/security/advisories/GHSA-ctrl-swift-0001",
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-05-02T12:00:00.000Z",
    publishedAt: "2026-05-02T12:00:00.000Z",
    withdrawnAt: null
  }
];

export const mockRepositoryCommunityProfile: RepositoryCommunityProfile = {
  healthPercentage: 92,
  description: "Mock community profile for repository health inspection.",
  documentationUrl: "https://github.com/apple/swift/tree/main/documentation",
  files: [
    {
      key: "readme",
      label: "README",
      name: "README.md",
      path: "README.md",
      htmlUrl: "https://github.com/apple/swift/blob/main/README.md",
      downloadUrl: "https://raw.githubusercontent.com/apple/swift/main/README.md",
      url: "https://api.github.com/repos/apple/swift/contents/README.md"
    },
    {
      key: "license",
      label: "License",
      name: "LICENSE.txt",
      path: "LICENSE.txt",
      htmlUrl: "https://github.com/apple/swift/blob/main/LICENSE.txt",
      downloadUrl: "https://raw.githubusercontent.com/apple/swift/main/LICENSE.txt",
      url: "https://api.github.com/repos/apple/swift/contents/LICENSE.txt"
    },
    {
      key: "codeOfConduct",
      label: "Code of conduct",
      name: "CODE_OF_CONDUCT.md",
      path: "CODE_OF_CONDUCT.md",
      htmlUrl: "https://github.com/apple/swift/blob/main/CODE_OF_CONDUCT.md",
      downloadUrl: "https://raw.githubusercontent.com/apple/swift/main/CODE_OF_CONDUCT.md",
      url: "https://api.github.com/repos/apple/swift/contents/CODE_OF_CONDUCT.md"
    },
    {
      key: "contributing",
      label: "Contributing",
      name: "CONTRIBUTING.md",
      path: "CONTRIBUTING.md",
      htmlUrl: "https://github.com/apple/swift/blob/main/CONTRIBUTING.md",
      downloadUrl: "https://raw.githubusercontent.com/apple/swift/main/CONTRIBUTING.md",
      url: "https://api.github.com/repos/apple/swift/contents/CONTRIBUTING.md"
    },
    {
      key: "issueTemplate",
      label: "Issue template",
      name: null,
      path: null,
      htmlUrl: null,
      downloadUrl: null,
      url: null
    },
    {
      key: "pullRequestTemplate",
      label: "Pull request template",
      name: "PULL_REQUEST_TEMPLATE.md",
      path: ".github/PULL_REQUEST_TEMPLATE.md",
      htmlUrl: "https://github.com/apple/swift/blob/main/.github/PULL_REQUEST_TEMPLATE.md",
      downloadUrl: "https://raw.githubusercontent.com/apple/swift/main/.github/PULL_REQUEST_TEMPLATE.md",
      url: "https://api.github.com/repos/apple/swift/contents/.github/PULL_REQUEST_TEMPLATE.md"
    }
  ]
};

export const mockRepositorySecurityPolicy: RepositorySecurityPolicyResult = {
  policy: {
    path: "SECURITY.md",
    htmlUrl: "https://github.com/apple/swift/blob/main/SECURITY.md",
    downloadUrl: "https://raw.githubusercontent.com/apple/swift/main/SECURITY.md",
    rawUrl: "https://raw.githubusercontent.com/apple/swift/main/SECURITY.md",
    sha: "security-policy-sha",
    size: 392,
    ref: "main",
    content:
      "# Security Policy\n\nReport suspected vulnerabilities through GitHub Security Advisories. Supported releases receive coordinated fixes before public disclosure."
  },
  availability: { status: "available", message: null }
};
