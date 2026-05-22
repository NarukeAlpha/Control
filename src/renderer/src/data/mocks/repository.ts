import type {
  GitHubAccountProfile,
  GitHubMutationInput,
  RepositoryDetail,
  RepositoryRef,
  RepositorySummary,
  Viewer
} from "@shared/github";
import type {
  LocalRecentItem,
  LocalRecentListInput,
  LocalRecentRecordInput,
  RepositoryPinInput,
  RepositoryPinRecord
} from "@shared/local";

import {
  isMockRecord,
  readMockArray,
  readMockStorageValue,
  writeMockArray,
  writeMockStorageValue
} from "../mockStorage";
import { mockAvatarUrl, mockPayload } from "./shared";

function repositoryCounts({
  issues,
  pulls,
  discussions,
  projects,
  releases,
  forks,
  stars,
  watchers
}: {
  issues: number;
  pulls: number;
  discussions: number;
  projects: number;
  releases: number;
  forks: number;
  stars: number;
  watchers: number;
}) {
  return {
    openIssues: issues,
    openPullRequests: pulls,
    discussions,
    projects,
    releases,
    forks,
    stars,
    watchers
  };
}

const mockPinnedRepositoriesKey = "control:mock:pinned-repositories";
const mockRepositoryPinsKey = "control:mock:repository-pins";
const mockRecentItemsKey = "control:mock:recent-items";
const mockRepositorySettingsKey = "control:mock:repository-settings";

type MockRepositorySettingsOverride = {
  description?: string | null;
  homepageUrl?: string | null;
  defaultBranch?: string | null;
  topics?: string[];
  isArchived?: boolean;
  allowForking?: boolean;
  webCommitSignoffRequired?: boolean;
  features?: {
    issues?: boolean;
    projects?: boolean;
    wiki?: boolean;
    discussions?: boolean;
  };
  mergeSettings?: {
    allowMergeCommit?: boolean;
    allowSquashMerge?: boolean;
    allowRebaseMerge?: boolean;
    allowAutoMerge?: boolean;
    deleteBranchOnMerge?: boolean;
    allowUpdateBranch?: boolean;
  };
};

function isMockRepositorySettingsOverrideRecord(
  value: unknown
): value is Record<string, MockRepositorySettingsOverride> {
  return isMockRecord(value);
}

export function listMockPinnedRepositories(): string[] {
  return readMockArray<string>(mockPinnedRepositoriesKey);
}

export function pinMockRepository(nameWithOwner: string): string[] {
  const normalized = nameWithOwner.toLowerCase();
  const repositories = listMockPinnedRepositories();
  const nextRepositories = repositories.some((item) => item.toLowerCase() === normalized)
    ? repositories
    : [nameWithOwner, ...repositories];
  writeMockArray(mockPinnedRepositoriesKey, nextRepositories);
  pinMockAreaRepository(defaultMockGitHubRepositoryPin(nameWithOwner));
  return nextRepositories;
}

export function unpinMockRepository(nameWithOwner: string): string[] {
  const normalized = nameWithOwner.toLowerCase();
  const nextRepositories = listMockPinnedRepositories().filter((item) => item.toLowerCase() !== normalized);
  writeMockArray(mockPinnedRepositoriesKey, nextRepositories);
  unpinMockAreaRepository(defaultMockGitHubRepositoryPin(nameWithOwner));
  return nextRepositories;
}

function areaRepositoryPinKey(input: {
  areaId?: string | null;
  repositoryId?: string | null;
  workspaceId?: string | null;
}): string {
  return `${input.areaId ?? ""}:${input.repositoryId ?? ""}:${input.workspaceId ?? ""}`;
}

function defaultMockGitHubRepositoryPin(nameWithOwner: string): RepositoryPinInput {
  return {
    areaId: "github:default",
    repositoryId: `github:default:${nameWithOwner.toLowerCase()}`,
    workspaceId: null,
    nameWithOwner
  };
}

export function listMockRepositoryPins(): RepositoryPinRecord[] {
  return readMockArray<RepositoryPinRecord>(mockRepositoryPinsKey);
}

export function pinMockAreaRepository(input: RepositoryPinInput): RepositoryPinRecord[] {
  if (!input.areaId || !input.repositoryId) {
    return listMockRepositoryPins();
  }

  const record: RepositoryPinRecord = {
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    workspaceId: input.workspaceId ?? null,
    nameWithOwner: input.nameWithOwner ?? null,
    createdAt: new Date().toISOString()
  };
  const key = areaRepositoryPinKey(record);
  const nextPins = [record, ...listMockRepositoryPins().filter((pin) => areaRepositoryPinKey(pin) !== key)];
  writeMockArray(mockRepositoryPinsKey, nextPins);
  return nextPins;
}

export function unpinMockAreaRepository(input: RepositoryPinInput): RepositoryPinRecord[] {
  const key = areaRepositoryPinKey(input);
  const nextPins = listMockRepositoryPins().filter((pin) => areaRepositoryPinKey(pin) !== key);
  writeMockArray(mockRepositoryPinsKey, nextPins);
  return nextPins;
}

export function listMockRecentItems(input?: LocalRecentListInput): LocalRecentItem[] {
  const items = readMockArray<LocalRecentItem>(mockRecentItemsKey).filter(
    (item) => !input?.kind || item.kind === input.kind
  );
  return items.slice(0, input?.limit ?? 20);
}

export function recordMockRecentItem(input: LocalRecentRecordInput): LocalRecentItem[] {
  const item: LocalRecentItem = {
    kind: input.kind,
    provider: input.provider ?? "github",
    itemKey: input.itemKey,
    title: input.title,
    subtitle: input.subtitle ?? null,
    repositoryNameWithOwner: input.repositoryNameWithOwner ?? null,
    areaId: input.areaId ?? null,
    repositoryId: input.repositoryId ?? null,
    workspaceId: input.workspaceId ?? null,
    url: input.url ?? null,
    metadata: input.metadata ?? {},
    updatedAt: new Date().toISOString()
  };
  const existingItems = readMockArray<LocalRecentItem>(mockRecentItemsKey);
  const nextItems = [item, ...existingItems.filter((recent) => recent.itemKey !== item.itemKey)].slice(0, 50);
  writeMockArray(mockRecentItemsKey, nextItems);
  return listMockRecentItems();
}

function readMockRepositorySettings(): Record<string, MockRepositorySettingsOverride> {
  return readMockStorageValue({
    key: mockRepositorySettingsKey,
    fallback: () => ({}),
    isValue: isMockRepositorySettingsOverrideRecord
  });
}

function writeMockRepositorySettings(items: Record<string, MockRepositorySettingsOverride>): void {
  writeMockStorageValue(mockRepositorySettingsKey, items);
}

export function mutateMockRepositorySettings(input: GitHubMutationInput): void {
  if (input.action !== "editRepository") {
    return;
  }

  const nameWithOwner = `${input.owner}/${input.repo}`.toLowerCase();
  const payload = mockPayload(input);
  const settings = readMockRepositorySettings();
  const current = settings[nameWithOwner] ?? {};
  const next: MockRepositorySettingsOverride = {
    ...current,
    features: {
      ...current.features
    },
    mergeSettings: {
      ...current.mergeSettings
    }
  };

  if ("description" in payload && (typeof payload.description === "string" || payload.description === null)) {
    next.description = payload.description;
  }
  if ("homepage" in payload && (typeof payload.homepage === "string" || payload.homepage === null)) {
    next.homepageUrl = payload.homepage;
  }
  if (
    "default_branch" in payload &&
    (typeof payload.default_branch === "string" || payload.default_branch === null)
  ) {
    next.defaultBranch = payload.default_branch;
  }
  if (Array.isArray(payload.topics)) {
    next.topics = payload.topics
      .filter((topic): topic is string => typeof topic === "string")
      .map((topic) => topic.trim())
      .filter(Boolean);
  }
  if (typeof payload.archived === "boolean") {
    next.isArchived = payload.archived;
  }
  if (typeof payload.web_commit_signoff_required === "boolean") {
    next.webCommitSignoffRequired = payload.web_commit_signoff_required;
  }
  if (typeof payload.allow_forking === "boolean") {
    next.allowForking = payload.allow_forking;
  }
  if (typeof payload.has_issues === "boolean") {
    next.features = { ...next.features, issues: payload.has_issues };
  }
  if (typeof payload.has_projects === "boolean") {
    next.features = { ...next.features, projects: payload.has_projects };
  }
  if (typeof payload.has_wiki === "boolean") {
    next.features = { ...next.features, wiki: payload.has_wiki };
  }
  if (typeof payload.has_discussions === "boolean") {
    next.features = { ...next.features, discussions: payload.has_discussions };
  }
  if (typeof payload.allow_merge_commit === "boolean") {
    next.mergeSettings = { ...next.mergeSettings, allowMergeCommit: payload.allow_merge_commit };
  }
  if (typeof payload.allow_squash_merge === "boolean") {
    next.mergeSettings = { ...next.mergeSettings, allowSquashMerge: payload.allow_squash_merge };
  }
  if (typeof payload.allow_rebase_merge === "boolean") {
    next.mergeSettings = { ...next.mergeSettings, allowRebaseMerge: payload.allow_rebase_merge };
  }
  if (typeof payload.allow_auto_merge === "boolean") {
    next.mergeSettings = { ...next.mergeSettings, allowAutoMerge: payload.allow_auto_merge };
  }
  if (typeof payload.delete_branch_on_merge === "boolean") {
    next.mergeSettings = { ...next.mergeSettings, deleteBranchOnMerge: payload.delete_branch_on_merge };
  }
  if (typeof payload.allow_update_branch === "boolean") {
    next.mergeSettings = { ...next.mergeSettings, allowUpdateBranch: payload.allow_update_branch };
  }

  settings[nameWithOwner] = next;
  writeMockRepositorySettings(settings);
}

export const mockViewer: Viewer = {
  login: "ashleyrico",
  name: "Ashley Rico",
  avatarUrl: mockAvatarUrl,
  htmlUrl: "https://github.com/ashleyrico"
};

export const mockRepositories: RepositorySummary[] = [
  {
    id: "R_apple_swift",
    owner: "apple",
    name: "swift",
    nameWithOwner: "apple/swift",
    description: "The Swift Programming Language",
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    stargazerCount: 23300,
    forkCount: 3500,
    watcherCount: 1200,
    openIssuesCount: 1200,
    counts: repositoryCounts({
      issues: 1200,
      pulls: 5,
      discussions: 42,
      projects: 3,
      releases: 98,
      forks: 3500,
      stars: 23300,
      watchers: 1200
    }),
    primaryLanguage: { name: "C++", color: "#f34b7d" },
    updatedAt: new Date(Date.now() - 7_200_000).toISOString(),
    pushedAt: new Date(Date.now() - 7_200_000).toISOString(),
    avatarUrl: mockAvatarUrl,
    defaultBranch: "main"
  },
  {
    id: "R_open_source",
    owner: "apple",
    name: "open-source",
    nameWithOwner: "apple/open-source",
    description: "Open source releases from Apple",
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    stargazerCount: 11100,
    forkCount: 950,
    watcherCount: 730,
    openIssuesCount: 42,
    counts: repositoryCounts({
      issues: 42,
      pulls: 9,
      discussions: 12,
      projects: 2,
      releases: 20,
      forks: 950,
      stars: 11100,
      watchers: 730
    }),
    primaryLanguage: { name: "Shell", color: "#89e051" },
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    pushedAt: new Date(Date.now() - 86_400_000).toISOString(),
    avatarUrl: mockAvatarUrl,
    defaultBranch: "main"
  },
  {
    id: "R_design_resources",
    owner: "apple",
    name: "design-resources",
    nameWithOwner: "apple/design-resources",
    description: "Design resources and templates",
    visibility: "PRIVATE",
    isPrivate: true,
    isFork: false,
    stargazerCount: 782,
    forkCount: 84,
    watcherCount: 39,
    openIssuesCount: 12,
    counts: repositoryCounts({
      issues: 12,
      pulls: 4,
      discussions: 3,
      projects: 1,
      releases: 2,
      forks: 84,
      stars: 782,
      watchers: 39
    }),
    primaryLanguage: { name: "Swift", color: "#f05138" },
    updatedAt: new Date(Date.now() - 172_800_000).toISOString(),
    pushedAt: new Date(Date.now() - 172_800_000).toISOString(),
    avatarUrl: mockAvatarUrl,
    defaultBranch: "main"
  }
];

export const mockRepository: RepositoryDetail = {
  ...mockRepositories[0],
  homepageUrl: "https://swift.org",
  licenseName: "MIT License",
  licenseSpdxId: "MIT",
  topics: ["swift", "language", "ios", "macos", "watchos", "tvos", "concurrency", "compiler"],
  branchCount: 15,
  tagCount: 98,
  readmeMarkdown:
    "# Welcome to Swift\n\nSwift is a powerful and intuitive programming language for iOS, macOS, watchOS, tvOS, and beyond.",
  htmlUrl: "https://github.com/apple/swift",
  languages: [
    { name: "C++", color: "#f34b7d", size: 6400000, percent: 42 },
    { name: "Swift", color: "#f05138", size: 4100000, percent: 27 },
    { name: "C", color: "#555555", size: 2600000, percent: 17 },
    { name: "Python", color: "#3572A5", size: 1300000, percent: 9 },
    { name: "Shell", color: "#89e051", size: 760000, percent: 5 }
  ],
  parent: null,
  source: null,
  viewerState: {
    hasStarred: false,
    subscription: "UNSUBSCRIBED",
    permission: "ADMIN",
    canAdminister: true,
    canSubscribe: true
  },
  permissions: {
    viewerPermission: "ADMIN",
    isArchived: false,
    isDisabled: false
  },
  administration: {
    visibility: "PUBLIC",
    defaultBranch: "main",
    isPrivate: false,
    isArchived: false,
    isDisabled: false,
    isTemplate: false,
    allowForking: true,
    webCommitSignoffRequired: false,
    features: {
      issues: true,
      projects: true,
      wiki: true,
      discussions: true
    },
    mergeSettings: {
      allowMergeCommit: true,
      allowSquashMerge: true,
      allowRebaseMerge: true,
      allowAutoMerge: false,
      deleteBranchOnMerge: true,
      allowUpdateBranch: true
    },
    viewerPermissions: {
      admin: true,
      maintain: true,
      push: true,
      triage: false,
      pull: true
    },
    securityAndAnalysis: {
      advancedSecurity: "enabled",
      codeSecurity: "enabled",
      dependabotAlerts: "enabled",
      dependabotSecurityUpdates: "enabled",
      secretScanning: "enabled",
      secretScanningPushProtection: "enabled",
      secretScanningNonProviderPatterns: "disabled",
      secretScanningValidityChecks: "enabled",
      secretScanningAiDetection: "unavailable"
    }
  }
};

export function mockRepositoryDetail(input: { owner: string; repo: string }): RepositoryDetail {
  const nameWithOwner = `${input.owner}/${input.repo}`;
  const summary =
    mockRepositories.find(
      (repository) => repository.nameWithOwner.toLowerCase() === nameWithOwner.toLowerCase()
    ) ?? mockRepositories[0];
  const override = readMockRepositorySettings()[nameWithOwner.toLowerCase()] ?? {};
  const isArchived = Object.prototype.hasOwnProperty.call(override, "isArchived")
    ? override.isArchived === true
    : mockRepository.administration.isArchived;

  return {
    ...mockRepository,
    ...summary,
    description: Object.prototype.hasOwnProperty.call(override, "description")
      ? (override.description ?? null)
      : summary.description,
    defaultBranch: Object.prototype.hasOwnProperty.call(override, "defaultBranch")
      ? (override.defaultBranch ?? null)
      : summary.defaultBranch,
    topics: override.topics ?? mockRepository.topics,
    htmlUrl: `https://github.com/${summary.nameWithOwner}`,
    homepageUrl: Object.prototype.hasOwnProperty.call(override, "homepageUrl")
      ? (override.homepageUrl ?? null)
      : summary.nameWithOwner === "apple/swift"
        ? "https://swift.org"
        : null,
    permissions: {
      ...mockRepository.permissions,
      isArchived
    },
    administration: {
      ...mockRepository.administration,
      visibility: summary.visibility,
      defaultBranch: Object.prototype.hasOwnProperty.call(override, "defaultBranch")
        ? (override.defaultBranch ?? null)
        : summary.defaultBranch,
      isPrivate: summary.isPrivate,
      isArchived,
      allowForking: Object.prototype.hasOwnProperty.call(override, "allowForking")
        ? (override.allowForking ?? false)
        : mockRepository.administration.allowForking,
      webCommitSignoffRequired: Object.prototype.hasOwnProperty.call(override, "webCommitSignoffRequired")
        ? (override.webCommitSignoffRequired ?? false)
        : mockRepository.administration.webCommitSignoffRequired,
      features: {
        ...mockRepository.administration.features,
        ...override.features
      },
      mergeSettings: {
        ...mockRepository.administration.mergeSettings,
        ...override.mergeSettings
      },
      viewerPermissions: {
        ...mockRepository.administration.viewerPermissions
      }
    }
  };
}

export function mockRepositoryForks(input: { owner: string; repo: string; limit?: number }): RepositoryRef[] {
  const baseName = `${input.owner}/${input.repo}`;
  const items: RepositoryRef[] = [
    {
      id: `${baseName}:fork:swiftlang`,
      owner: "swiftlang",
      name: input.repo,
      nameWithOwner: `swiftlang/${input.repo}`,
      htmlUrl: `https://github.com/swiftlang/${input.repo}`,
      defaultBranch: "main",
      visibility: "PUBLIC",
      isPrivate: false,
      forkCount: 42,
      stargazerCount: 820,
      viewerPermission: "READ"
    },
    {
      id: `${baseName}:fork:control-labs`,
      owner: "control-labs",
      name: `${input.repo}-research`,
      nameWithOwner: `control-labs/${input.repo}-research`,
      htmlUrl: `https://github.com/control-labs/${input.repo}-research`,
      defaultBranch: "main",
      visibility: "PUBLIC",
      isPrivate: false,
      forkCount: null,
      stargazerCount: 18,
      viewerPermission: null
    }
  ];

  return items.slice(0, input.limit ?? 12);
}

export const mockAccountProfile: GitHubAccountProfile = {
  id: "U_ashleyrico",
  login: mockViewer.login,
  name: mockViewer.name,
  avatarUrl: mockViewer.avatarUrl,
  htmlUrl: mockViewer.htmlUrl ?? "https://github.com/ashleyrico",
  bio: "Developer building GitHub workflows locally.",
  company: "Control",
  location: "San Juan, PR",
  websiteUrl: "https://github.com",
  followers: 187,
  following: 42,
  repositoryCount: mockRepositories.length,
  starredRepositoryCount: 233,
  status: null,
  pinnedRepositories: mockRepositories.slice(0, 2)
};
