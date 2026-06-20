import type {
  AreaFileContent,
  AreaFileEntry,
  AreaRepositoryDetail,
  AreaRepositorySummary,
  AreaSummary,
  AreaSyncStatus,
  AreaWorkspaceSummary,
  GitHubRemoteConnection
} from "@shared/areas";
import type {
  AccountContributionListResult,
  AccountProfileResult,
  AccountRepositoryListResult,
  AppState,
  ContributorListResult,
  ControlSettings,
  IssueDetailResult,
  NotificationListResult,
  OrganizationListResult,
  OrganizationMembersResult,
  OrganizationRepositoriesResult,
  OrganizationTeamMembersResult,
  OrganizationTeamsResult,
  PullRequestChecksResult,
  PullRequestCommentsResult,
  PullRequestCommitsResult,
  PullRequestDetailResult,
  PullRequestFilesResult,
  PullRequestLinkedIssuesResult,
  PullRequestOverviewResult,
  PullRequestReviewsResult,
  PullRequestReviewThreadsResult,
  PullRequestTimelineResult,
  ReleaseDetailResult,
  ReleaseListResult,
  RepositoryListResult,
  RepositorySearchResult,
  WorkflowDefinitionListResult,
  WorkflowRunDetailResult
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { defaultControlExportScope } from "@shared/sync";

import {
  buildMockWorkflowRunDetail,
  listMockWorkflowRuns,
  mockActions,
  mockWorkflowJobLogs,
  mockWorkflows,
  mutateMockWorkflowRuns,
  readMockWorkflowRuns
} from "./actions";
import { mockAppState, mockGitHubSignInSession } from "./appState";
import { mockContributors } from "./contributors";
import { mockContents, mockFileBlame, mockFileContent } from "./contents";
import { mockDiscussionCategories, mockDiscussionDetail, mockDiscussions } from "./discussions";
import {
  buildMockIssueDetail,
  listMockIssues,
  mockAssignableUsers,
  mockIssues,
  mockLabels,
  mockMilestones,
  mockRepositoryCollaborators,
  mutateMockIssues,
  readMockIssues
} from "./issues";
import {
  listMockNotifications,
  markMockNotificationRead,
  unsubscribeMockNotification
} from "./notifications";
import {
  listMockOrganizationTeams,
  mockOrganizationMembers,
  mockOrganizationRepositories,
  mockOrganizations,
  mockTeamMembers,
  mockTeamRepositories
} from "./organizations";
import { mockProjects } from "./projects";
import {
  buildMockPullRequestDetail,
  listMockPullRequests,
  mockPullRequests,
  mockTeams,
  mutateMockPullRequests,
  readMockPullRequests
} from "./pulls";
import { mockBranches, listMockCommits, mockTags, mockTree } from "./refs";
import { mockReleaseDetail, mutateMockReleases, readMockReleases } from "./releases";
import {
  listMockPinnedRepositories,
  listMockRecentItems,
  listMockRepositoryPins,
  mockAccountContributions,
  mockAccountProfile,
  mockRepositories,
  mockRepository,
  mockRepositoryDetail,
  mockRepositoryForks,
  mockViewer,
  mutateMockRepositorySettings,
  pinMockAreaRepository,
  pinMockRepository,
  recordMockRecentItem,
  unpinMockAreaRepository,
  unpinMockRepository
} from "./repository";
import {
  mockBranchProtection,
  mockCodeScanningAlerts,
  mockDependabotAlerts,
  mockRepositoryCommunityProfile,
  mockRepositoryRulesets,
  mockRepositorySecurityAdvisories,
  mockRepositorySecurityPolicy,
  mockSecretScanningAlerts
} from "./security";
import { mockAvailable, mockGitHubNotLoaded } from "./shared";
import { mockRepositoryWiki } from "./wiki";

const mockSettingsStorageKey = "control:mock-settings";
const mockAreaTimestamp = "2026-06-05T12:00:00.000Z";
const mockGitHubAreaId = "github:mock";
const mockLocalAreaId = "local:control";
const mockLocalRepositoryId = "local:control:swift";

const mockGitHubArea: AreaSummary = {
  id: mockGitHubAreaId,
  kind: "github",
  label: "GitHub",
  subtitle: "ashleyrico",
  rootPath: null,
  accountLogin: mockViewer.login,
  gateway: null,
  health: { status: "ready", message: null, checkedAt: mockAreaTimestamp },
  repositoryCount: mockRepositories.length,
  selected: true,
  createdAt: mockAreaTimestamp,
  updatedAt: mockAreaTimestamp
};

const mockLocalArea: AreaSummary = {
  id: mockLocalAreaId,
  kind: "local",
  label: "Local Projects",
  subtitle: "/Users/ashleyrico/Projects",
  rootPath: "/Users/ashleyrico/Projects",
  accountLogin: null,
  gateway: null,
  health: { status: "ready", message: null, checkedAt: mockAreaTimestamp },
  repositoryCount: 1,
  selected: false,
  createdAt: mockAreaTimestamp,
  updatedAt: mockAreaTimestamp
};

const mockLocalGitHubConnection: GitHubRemoteConnection = {
  owner: "apple",
  repo: "swift",
  nameWithOwner: mockRepository.nameWithOwner,
  remoteName: "origin",
  remoteUrl: "git@github.com:apple/swift.git",
  url: mockRepository.htmlUrl,
  matchedGitHubAreaId: mockGitHubAreaId,
  status: "connected",
  lastCheckedAt: mockAreaTimestamp,
  lastError: null
};

const mockLocalRepositorySummary: AreaRepositorySummary = {
  id: mockLocalRepositoryId,
  areaId: mockLocalAreaId,
  kind: "git",
  name: "swift",
  owner: "apple",
  displayName: "apple/swift",
  path: "/Users/ashleyrico/Projects/swift",
  defaultBranch: "main",
  currentBranch: "feature/sendable-diagnostics",
  isDirty: true,
  isPrivate: false,
  description: "The Swift Programming Language",
  connection: mockLocalGitHubConnection,
  capabilities: {
    supportsBranches: true,
    supportsBookmarks: false,
    supportsWorkspaces: false,
    supportsOperationLog: true,
    supportsSparse: false,
    isGitBacked: true,
    isColocated: true,
    supportsGitHubEnrichment: true
  },
  health: { status: "ready", message: null, checkedAt: mockAreaTimestamp },
  updatedAt: mockAreaTimestamp,
  scannedAt: mockAreaTimestamp
};

const mockLocalContents: AreaFileEntry[] = mockContents.map((entry) => ({
  name: entry.name,
  path: entry.path,
  type: entry.type === "dir" ? "dir" : "file",
  size: entry.size,
  updatedAt: entry.lastCommitDate
}));

const mockLocalReadme: AreaFileContent = {
  path: "README.md",
  kind: "text",
  text: "# Welcome to Swift\n\nSwift is a powerful and intuitive programming language for iOS, macOS, watchOS, tvOS, and beyond.",
  encoding: "utf-8",
  size: 122,
  message: null
};

const mockLocalWorkspaces: AreaWorkspaceSummary[] = [
  {
    id: "workspace:swift:diagnostics",
    areaId: mockLocalAreaId,
    repositoryId: mockLocalRepositoryId,
    name: "Diagnostics spike",
    rootPath: "/Users/ashleyrico/Projects/swift-worktrees/diagnostics",
    workingCopyChangeId: null,
    workingCopyCommitId: null,
    isStale: false,
    sparseSummary: null,
    health: { status: "ready", message: null, checkedAt: mockAreaTimestamp },
    updatedAt: mockAreaTimestamp,
    scannedAt: mockAreaTimestamp
  }
];

const mockLocalRepositoryDetail: AreaRepositoryDetail = {
  ...mockLocalRepositorySummary,
  remotes: [
    {
      name: "origin",
      fetchUrl: "git@github.com:apple/swift.git",
      pushUrl: "git@github.com:apple/swift.git",
      github: mockLocalGitHubConnection
    }
  ],
  branches: [
    {
      name: "feature/sendable-diagnostics",
      current: true,
      upstream: "origin/feature/sendable-diagnostics",
      commit: "7f3a2c0"
    },
    { name: "main", current: false, upstream: "origin/main", commit: "4a7d1ef" }
  ],
  bookmarks: [],
  tags: mockTags.map((tag) => ({ name: tag.name, target: tag.commitSha })),
  status: {
    clean: false,
    dirtyCount: 3,
    untrackedCount: 1,
    conflictedCount: 0,
    ahead: 2,
    behind: 0,
    entries: [
      { path: "Sources/Compiler/TypeCheck.cpp", indexStatus: "M", workingTreeStatus: "M" },
      { path: "test/Concurrency/sendable.swift", indexStatus: "A", workingTreeStatus: null },
      { path: "docs/diagnostics.md", indexStatus: null, workingTreeStatus: "?" }
    ]
  },
  recentCommits: listMockCommits({ limit: 3 }).map((commit) => ({
    id: commit.sha,
    shortId: commit.sha.slice(0, 7),
    changeId: null,
    summary: commit.headline,
    authorName: commit.authorName,
    authorEmail: null,
    authoredAt: commit.authoredDate
  })),
  recentOperations: [
    {
      id: "operation:fetch-origin",
      shortId: "op-241",
      description: "Fetched origin/main",
      user: mockViewer.login,
      time: "2026-06-05T10:42:00.000Z"
    },
    {
      id: "operation:branch-checkout",
      shortId: "op-240",
      description: "Checked out feature/sendable-diagnostics",
      user: mockViewer.login,
      time: "2026-06-05T09:18:00.000Z"
    }
  ],
  readme: mockLocalReadme,
  workspaces: mockLocalWorkspaces
};

const mockLocalSyncStatus: AreaSyncStatus = {
  areaId: mockLocalAreaId,
  repositoryId: mockLocalRepositoryId,
  provider: "git",
  remotes: [
    {
      name: "origin",
      fetchUrl: "git@github.com:apple/swift.git",
      pushUrl: "git@github.com:apple/swift.git",
      status: "ahead",
      ahead: 2,
      behind: 0,
      lastFetchedAt: "2026-06-05T10:42:00.000Z",
      message: null
    }
  ],
  defaultRemote: "origin",
  currentBranch: "feature/sendable-diagnostics",
  currentBookmark: null,
  hasUncommittedChanges: true,
  capabilities: {
    canFetch: true,
    canPush: true,
    canPull: true,
    canCreateBranch: true,
    canCreateBookmark: false,
    canCommit: true,
    canUndo: false
  },
  updatedAt: mockAreaTimestamp
};

function mockAreas(selectedAreaId: string | null = null): AreaSummary[] {
  return [mockGitHubArea, mockLocalArea].map((area) => ({
    ...area,
    selected: selectedAreaId ? area.id === selectedAreaId : area.selected
  }));
}

function localRepositoryMatches(input: { areaId: string; repositoryId: string }): boolean {
  return input.areaId === mockLocalAreaId && input.repositoryId === mockLocalRepositoryId;
}

function readMockAppState(): AppState {
  return {
    ...mockAppState,
    settings: readMockSettings()
  };
}

function readMockSettings(): ControlSettings {
  if (typeof window === "undefined") {
    return mockAppState.settings;
  }

  const serializedSettings = window.localStorage.getItem(mockSettingsStorageKey);
  if (!serializedSettings) {
    return mockAppState.settings;
  }

  try {
    return mergeMockSettings(
      mockAppState.settings,
      JSON.parse(serializedSettings) as Partial<ControlSettings>
    );
  } catch {
    window.localStorage.removeItem(mockSettingsStorageKey);
    return mockAppState.settings;
  }
}

function writeMockSettings(settings: ControlSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(mockSettingsStorageKey, JSON.stringify(settings));
}

function mergeMockSettings(
  currentSettings: ControlSettings,
  settingsPatch: Partial<ControlSettings>
): ControlSettings {
  return {
    ...currentSettings,
    ...settingsPatch,
    theme: settingsPatch.theme
      ? {
          ...currentSettings.theme,
          ...settingsPatch.theme,
          custom: settingsPatch.theme.custom
            ? {
                ...currentSettings.theme.custom,
                ...settingsPatch.theme.custom,
                light: {
                  ...currentSettings.theme.custom.light,
                  ...settingsPatch.theme.custom.light
                }
              }
            : currentSettings.theme.custom
        }
      : currentSettings.theme,
    repositoryTabPreferences:
      settingsPatch.repositoryTabPreferences ?? currentSettings.repositoryTabPreferences,
    repositoryTabPreferencesByRepository:
      settingsPatch.repositoryTabPreferencesByRepository ??
      currentSettings.repositoryTabPreferencesByRepository
  };
}

export const mockControlApi: ControlApi = {
  getAppState: async () => readMockAppState(),
  getSettings: async () => readMockSettings(),
  updateSettings: async (settings) => {
    const nextSettings = mergeMockSettings(readMockSettings(), settings);
    writeMockSettings(nextSettings);
    return nextSettings;
  },
  signInWithGitHub: async () => mockGitHubSignInSession,
  getGitHubSignIn: async () => mockGitHubSignInSession,
  cancelGitHubSignIn: async () => undefined,
  clearGitHubToken: async () => ({
    ...readMockAppState(),
    github: {
      available: true,
      authenticated: false,
      signInConfigured: true,
      user: null,
      error: "Sign in with GitHub in Settings to load live GitHub data."
    },
    viewer: null
  }),
  openExternal: async () => undefined,
  listPinnedRepositories: async () => listMockPinnedRepositories(),
  pinRepository: async (input) => pinMockRepository(input.nameWithOwner ?? ""),
  unpinRepository: async (input) => unpinMockRepository(input.nameWithOwner ?? ""),
  listRepositoryPins: async () => listMockRepositoryPins(),
  pinAreaRepository: async (input) => pinMockAreaRepository(input),
  unpinAreaRepository: async (input) => unpinMockAreaRepository(input),
  listRecentItems: async (input) => listMockRecentItems(input),
  recordRecentItem: async (input) => recordMockRecentItem(input),
  previewDataExport: async (scope) => ({
    manifest: {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      appVersion: null,
      includedScopes: { ...defaultControlExportScope, ...scope },
      redactionSummary: [],
      cacheIncluded: {
        githubMetadata: scope.githubMetadataCache,
        areaCache: scope.areaCache,
        snapshots: scope.snapshots
      }
    },
    items: [],
    totals: {
      includedItems: 0,
      excludedItems: 0,
      privateItems: 0,
      cacheItems: 0
    },
    blockers: []
  }),
  exportData: async (input) => ({
    manifest: {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      appVersion: null,
      includedScopes: { ...defaultControlExportScope, ...input.scope },
      redactionSummary: [],
      cacheIncluded: {
        githubMetadata: input.scope.githubMetadataCache,
        areaCache: input.scope.areaCache,
        snapshots: input.scope.snapshots
      }
    },
    filePath: input.destinationPath ?? null,
    bytesWritten: input.destinationPath ? 2 : null
  }),
  previewDataImport: async () => ({
    filePath: null,
    schemaVersion: null,
    items: [],
    blockers: ["Import preview is not available in the mock API."]
  }),
  importData: async () => ({
    applied: false,
    importedItems: 0,
    insertedItems: 0,
    updatedItems: 0,
    skippedItems: 0,
    remappedItems: 0,
    blockedItems: 0,
    emittedEvents: []
  }),
  onGitHubRepositoriesUpdated: () => () => undefined,
  onGitHubAuthUpdated: () => () => undefined,
  areas: {
    listAreas: async () => mockAreas(),
    getArea: async (areaId) => mockAreas().find((area) => area.id === areaId) ?? null,
    selectArea: async (areaId) => mockAreas(areaId),
    createLocalArea: async (input) => ({
      id: "local:mock",
      kind: "local",
      label: input.label ?? "Mock local area",
      subtitle: input.rootPath,
      rootPath: input.rootPath,
      accountLogin: null,
      gateway: null,
      health: { status: "ready", message: null, checkedAt: new Date().toISOString() },
      repositoryCount: 0,
      selected: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    createSshArea: async (input) => ({
      id: "ssh:mock",
      kind: "ssh",
      label: input.label ?? input.host,
      subtitle: `${input.host}:${input.rootPath}`,
      rootPath: input.rootPath,
      accountLogin: null,
      gateway: {
        status: "ready",
        version: "0.1.0",
        apiUrl: "http://127.0.0.1:35525",
        serviceName: "control-gateway-mock",
        lastStartedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        failureCode: null,
        message: null
      },
      health: { status: "ready", message: null, checkedAt: new Date().toISOString() },
      repositoryCount: 0,
      selected: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    updateArea: async (input) => ({
      id: input.areaId,
      kind: input.host ? "ssh" : input.rootPath ? "local" : "github",
      label: input.label ?? input.host ?? "Mock Area",
      subtitle: input.host && input.rootPath ? `${input.host}:${input.rootPath}` : (input.rootPath ?? null),
      rootPath: input.rootPath ?? null,
      accountLogin: null,
      gateway: null,
      health: { status: "ready", message: null, checkedAt: new Date().toISOString() },
      repositoryCount: 0,
      selected: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    removeArea: async () => [],
    refreshArea: async () => null,
    searchAreas: async (input) => {
      const query = input.query.trim().toLowerCase();
      if (!query) {
        return { areas: [], repositories: [], workspaces: [] };
      }

      const areas = mockAreas().filter((area) =>
        [area.label, area.subtitle ?? ""].some((value) => value.toLowerCase().includes(query))
      );
      const repositories = [mockLocalRepositorySummary].filter((repository) =>
        [repository.name, repository.path ?? "", repository.currentBranch ?? ""].some((value) =>
          value.toLowerCase().includes(query)
        )
      );
      const workspaces = mockLocalWorkspaces.filter((workspace) =>
        [workspace.name, workspace.rootPath].some((value) => value.toLowerCase().includes(query))
      );

      return {
        areas: areas.slice(0, input.limit ?? areas.length),
        repositories: repositories.slice(0, input.limit ?? repositories.length),
        workspaces: workspaces.slice(0, input.limit ?? workspaces.length)
      };
    },
    listRepositories: async (input) => (input.areaId === mockLocalAreaId ? [mockLocalRepositorySummary] : []),
    getRepository: async (input) => (localRepositoryMatches(input) ? mockLocalRepositoryDetail : null),
    listContents: async (input) => {
      if (!localRepositoryMatches(input)) {
        return [];
      }
      const path = input.path?.trim() && input.path !== "." ? input.path : null;
      if (!path) {
        return mockLocalContents;
      }
      return [];
    },
    searchFilePaths: async (input) => ({
      areaId: input.areaId,
      repositoryId: input.repositoryId,
      workspaceId: input.workspaceId ?? null,
      query: input.query.trim(),
      matches: [],
      availability: {
        status: input.query.trim() ? "complete" : "unavailable",
        message: input.query.trim() ? null : "Enter a file name to search.",
        scannedEntries: 0,
        truncated: false,
        timedOut: false
      }
    }),
    getFileContent: async (input) => ({
      path: input.path,
      kind: "text",
      text:
        input.path === "README.md"
          ? mockLocalReadme.text
          : `Mock file content for ${input.path}.\n\nThis browser fixture keeps local repository previews deterministic.`,
      encoding: "utf-8",
      size: input.path === "README.md" ? mockLocalReadme.size : 96,
      message: null
    }),
    listBranches: async (input) => (localRepositoryMatches(input) ? mockLocalRepositoryDetail.branches : []),
    listRemotes: async (input) => (localRepositoryMatches(input) ? mockLocalRepositoryDetail.remotes : []),
    getStatus: async (input) =>
      localRepositoryMatches(input)
        ? mockLocalRepositoryDetail.status
        : {
            clean: null,
            dirtyCount: 0,
            untrackedCount: 0,
            conflictedCount: 0,
            ahead: null,
            behind: null,
            entries: []
          },
    listActivity: async (input) =>
      localRepositoryMatches(input)
        ? [
            ...mockLocalRepositoryDetail.recentOperations.map((operation) => ({
              id: operation.id,
              kind: "operation" as const,
              title: operation.description,
              subtitle: operation.shortId,
              occurredAt: operation.time
            })),
            ...mockLocalRepositoryDetail.recentCommits.map((commit) => ({
              id: commit.id,
              kind: "commit" as const,
              title: commit.summary,
              subtitle: commit.shortId,
              occurredAt: commit.authoredAt
            }))
          ]
        : [],
    listWorkspaces: async (input) =>
      input.areaId === mockLocalAreaId &&
      (!input.repositoryId || input.repositoryId === mockLocalRepositoryId)
        ? mockLocalWorkspaces
        : [],
    getWorkspace: async (input) => {
      if (input.areaId !== mockLocalAreaId) {
        return null;
      }

      const workspace =
        mockLocalWorkspaces.find((item) => item.id === input.workspaceId) ?? mockLocalWorkspaces[0];
      return workspace
        ? {
            ...workspace,
            fileTree: mockLocalContents,
            readme: mockLocalReadme,
            status: mockLocalRepositoryDetail.status
          }
        : null;
    },
    getGitHubRepository: async (input) => ({
      detail: localRepositoryMatches(input) ? mockRepositoryDetail({ owner: "apple", repo: "swift" }) : null,
      availability: localRepositoryMatches(input) ? mockAvailable : mockGitHubNotLoaded
    }),
    listGitHubIssues: async (input) => ({
      items: localRepositoryMatches(input) ? listMockIssues(input) : [],
      availability: localRepositoryMatches(input) ? mockAvailable : mockGitHubNotLoaded
    }),
    listGitHubPullRequests: async (input) => ({
      items: localRepositoryMatches(input) ? listMockPullRequests(input) : [],
      availability: localRepositoryMatches(input) ? mockAvailable : mockGitHubNotLoaded
    }),
    listGitHubActions: async (input) => ({
      items: localRepositoryMatches(input) ? listMockWorkflowRuns(input) : [],
      availability: localRepositoryMatches(input) ? mockAvailable : mockGitHubNotLoaded
    }),
    listGitHubReleases: async () => ({
      items: [],
      availability: mockGitHubNotLoaded
    }),
    listGitHubContributors: async () => ({
      items: [],
      availability: mockGitHubNotLoaded
    }),
    getSyncStatus: async (input) =>
      localRepositoryMatches(input)
        ? mockLocalSyncStatus
        : {
            areaId: input.areaId,
            repositoryId: input.repositoryId,
            provider: "git",
            remotes: [],
            defaultRemote: null,
            currentBranch: null,
            currentBookmark: null,
            hasUncommittedChanges: null,
            capabilities: {
              canFetch: false,
              canPush: false,
              canPull: false,
              canCreateBranch: false,
              canCreateBookmark: false,
              canCommit: false,
              canUndo: false
            },
            updatedAt: null
          },
    prepareGatewayOperation: async (input) => ({
      id: "operation:mock",
      areaId: input.areaId,
      repositoryId: input.repositoryId,
      kind: input.kind,
      status: "prepared",
      title: input.kind,
      summary: "Mock gateway operation.",
      risks: [],
      affectedRefs: [],
      affectedPaths: [],
      requiresGitHubToken: false,
      preparedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString()
    }),
    runGatewayOperation: async (input) => ({
      id: input.operationId,
      areaId: input.areaId,
      repositoryId: "mock",
      kind: "git.fetch",
      status: input.confirmed ? "succeeded" : "cancelled",
      message: "Mock gateway operation finished.",
      stdout: null,
      stderr: null,
      recoveryOperationId: null,
      completedAt: new Date().toISOString()
    }),
    stopGateway: async (input) => ({
      id: input.areaId,
      kind: "local",
      label: "Mock local area",
      subtitle: null,
      rootPath: null,
      accountLogin: null,
      gateway: null,
      health: { status: "offline", message: "Gateway stopped.", checkedAt: new Date().toISOString() },
      repositoryCount: 0,
      selected: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    repairGateway: async () => ({ success: true, summary: null }),
    rotateGatewayCredentials: async () => ({ success: true, summary: null }),
    restartGateway: async () => ({ success: true, summary: null }),
    openLocalFolderPicker: async () => null
  },
  onAreasUpdated: () => () => undefined,
  onAreaRepositoryUpdated: () => () => undefined,
  onAreaWorkspaceUpdated: () => () => undefined,
  github: {
    getViewer: async () => mockViewer,
    getAccountProfileWithStatus: async (): Promise<AccountProfileResult> => ({
      profile: mockAccountProfile,
      availability: mockAvailable
    }),
    listRepositoriesWithStatus: async (): Promise<RepositoryListResult> => ({
      items: mockRepositories,
      availability: mockAvailable
    }),
    listAccountRepositoriesWithStatus: async (): Promise<AccountRepositoryListResult> => ({
      items: mockRepositories,
      availability: mockAvailable
    }),
    listAccountContributionsWithStatus: async (): Promise<AccountContributionListResult> => ({
      items: mockAccountContributions,
      availability: mockAvailable
    }),
    listOrganizationsWithStatus: async (): Promise<OrganizationListResult> => ({
      items: mockOrganizations,
      availability: mockAvailable
    }),
    listOrganizationTeamsWithStatus: async (input): Promise<OrganizationTeamsResult> => ({
      items: listMockOrganizationTeams(input),
      availability: mockAvailable
    }),
    listOrganizationRepositoriesWithStatus: async (input): Promise<OrganizationRepositoriesResult> => ({
      items: (mockOrganizationRepositories[input.org.toLowerCase()] ?? []).slice(0, input.limit ?? undefined),
      availability: mockAvailable
    }),
    listOrganizationTeamRepositoriesWithStatus: async (input) => ({
      items: (mockTeamRepositories[input.teamSlug] ?? []).slice(0, input.limit ?? undefined),
      availability: mockAvailable
    }),
    listOrganizationTeamMembersWithStatus: async (input): Promise<OrganizationTeamMembersResult> => ({
      items: (mockTeamMembers[input.teamSlug] ?? []).slice(0, input.limit ?? undefined),
      availability: mockAvailable
    }),
    listOrganizationMembersWithStatus: async (input): Promise<OrganizationMembersResult> => ({
      items: (mockOrganizationMembers[input.org.toLowerCase()] ?? []).slice(0, input.limit ?? undefined),
      availability: mockAvailable
    }),
    listOrganizationProjectsWithStatus: async (input) => ({
      items: mockProjects
        .filter((project) => project.ownerLogin?.toLowerCase().startsWith(input.org.toLowerCase()))
        .slice(0, input.limit ?? undefined),
      availability: mockAvailable
    }),
    listAccountIssuesWithStatus: async (input) => ({
      items: listMockIssues(input),
      availability: mockAvailable
    }),
    listAccountPullRequestsWithStatus: async (input) => ({
      items: listMockPullRequests(input),
      availability: mockAvailable
    }),
    listNotificationsWithStatus: async (input): Promise<NotificationListResult> => ({
      items: listMockNotifications(input),
      availability: mockAvailable
    }),
    markNotificationThreadRead: async (input) => {
      markMockNotificationRead(input.threadId);
      return {
        ok: true,
        threadId: input.threadId,
        message: "Notification thread marked as read."
      };
    },
    unsubscribeNotificationThread: async (input) => {
      unsubscribeMockNotification(input.threadId);
      return {
        ok: true,
        threadId: input.threadId,
        message: "Notification thread unsubscribed."
      };
    },
    getRepositoryWithStatus: async (input) => ({
      detail: mockRepositoryDetail(input),
      availability: mockAvailable
    }),
    listBranchesWithStatus: async () => ({
      items: mockBranches,
      availability: mockAvailable
    }),
    listTagsWithStatus: async () => ({
      items: mockTags,
      availability: mockAvailable
    }),
    listTreeWithStatus: async (input) => ({
      tree: { ...mockTree, ref: input.ref ?? mockTree.ref },
      availability: mockAvailable
    }),
    getReadme: async () => ({
      markdown: mockRepository.readmeMarkdown,
      availability: mockAvailable
    }),
    listContentsWithStatus: async () => ({
      items: mockContents,
      availability: mockAvailable
    }),
    getFileContentWithStatus: async (input) => ({
      item: mockFileContent(input),
      availability: mockAvailable
    }),
    getFileBlame: async (input) => mockFileBlame(input.path, input.ref),
    getRepositoryWiki: async (input) => mockRepositoryWiki(input.pagePath, input.limit),
    listCommitsWithStatus: async (input) => ({
      items: listMockCommits(input),
      availability: mockAvailable
    }),
    listLabelsWithStatus: async () => ({
      items: mockLabels,
      availability: mockAvailable
    }),
    listAssignableUsersWithStatus: async () => ({
      items: mockAssignableUsers,
      availability: mockAvailable
    }),
    getRepositoryAccess: async (input) => ({
      collaborators: mockRepositoryCollaborators.slice(0, input.limit ?? mockRepositoryCollaborators.length),
      teams: mockTeams.slice(0, input.limit ?? mockTeams.length),
      collaboratorsAvailability: mockAvailable,
      teamsAvailability: mockAvailable
    }),
    listMilestonesWithStatus: async (input) => ({
      items: mockMilestones.filter(
        (milestone) => input.state === "all" || !input.state || milestone.state === input.state
      ),
      availability: mockAvailable
    }),
    listIssuesWithStatus: async (input) => ({
      items: listMockIssues(input),
      availability: mockAvailable
    }),
    getIssueDetailWithStatus: async (input): Promise<IssueDetailResult> => ({
      detail:
        readMockIssues().find((item) => item.number === input.issueNumber) ??
        buildMockIssueDetail(mockIssues[0]),
      availability: mockAvailable
    }),
    listPullRequestsWithStatus: async (input) => ({
      items: listMockPullRequests(input),
      availability: mockAvailable
    }),
    getPullRequestDetailWithStatus: async (input): Promise<PullRequestDetailResult> => ({
      detail:
        readMockPullRequests().find((item) => item.number === input.pullNumber) ??
        buildMockPullRequestDetail(mockPullRequests[0]),
      availability: mockAvailable
    }),
    getPullRequestOverviewWithStatus: async (input): Promise<PullRequestOverviewResult> => {
      const detail =
        readMockPullRequests().find((item) => item.number === input.pullNumber) ??
        buildMockPullRequestDetail(mockPullRequests[0]);
      const {
        commentsList: _commentsList,
        commentsAvailability: _commentsAvailability,
        files: _files,
        filesAvailability: _filesAvailability,
        commitsList: _commitsList,
        commitsAvailability: _commitsAvailability,
        reviews: _reviews,
        reviewsAvailability: _reviewsAvailability,
        checks: _checks,
        checksAvailability: _checksAvailability,
        reviewThreads: _reviewThreads,
        reviewThreadsAvailability: _reviewThreadsAvailability,
        reviewThreadStatesAvailability: _reviewThreadStatesAvailability,
        timelineEvents: _timelineEvents,
        timelineAvailability: _timelineAvailability,
        linkedIssues: _linkedIssues,
        linkedIssuesAvailability: _linkedIssuesAvailability,
        ...overview
      } = detail;
      return {
        overview,
        availability: mockAvailable
      };
    },
    listPullRequestCommentsWithStatus: async (input): Promise<PullRequestCommentsResult> => ({
      items:
        readMockPullRequests().find((item) => item.number === input.pullNumber)?.commentsList ??
        buildMockPullRequestDetail(mockPullRequests[0]).commentsList,
      availability: mockAvailable,
      pageInfo: null
    }),
    listPullRequestFilesWithStatus: async (input): Promise<PullRequestFilesResult> => ({
      items:
        readMockPullRequests().find((item) => item.number === input.pullNumber)?.files ??
        buildMockPullRequestDetail(mockPullRequests[0]).files,
      availability: mockAvailable,
      pageInfo: null
    }),
    listPullRequestCommitsWithStatus: async (input): Promise<PullRequestCommitsResult> => ({
      items:
        readMockPullRequests().find((item) => item.number === input.pullNumber)?.commitsList ??
        buildMockPullRequestDetail(mockPullRequests[0]).commitsList,
      availability: mockAvailable,
      pageInfo: null
    }),
    listPullRequestReviewsWithStatus: async (input): Promise<PullRequestReviewsResult> => ({
      items:
        readMockPullRequests().find((item) => item.number === input.pullNumber)?.reviews ??
        buildMockPullRequestDetail(mockPullRequests[0]).reviews,
      availability: mockAvailable,
      pageInfo: null
    }),
    listPullRequestChecksWithStatus: async (input): Promise<PullRequestChecksResult> => ({
      items:
        readMockPullRequests().find((item) => item.number === input.pullNumber)?.checks ??
        buildMockPullRequestDetail(mockPullRequests[0]).checks,
      availability: mockAvailable
    }),
    listPullRequestReviewThreadsWithStatus: async (input): Promise<PullRequestReviewThreadsResult> => {
      const detail =
        readMockPullRequests().find((item) => item.number === input.pullNumber) ??
        buildMockPullRequestDetail(mockPullRequests[0]);
      return {
        items: detail.reviewThreads,
        availability: mockAvailable,
        statesAvailability: detail.reviewThreadStatesAvailability ?? mockAvailable,
        pageInfo: null
      };
    },
    listPullRequestTimelineWithStatus: async (input): Promise<PullRequestTimelineResult> => ({
      items:
        readMockPullRequests().find((item) => item.number === input.pullNumber)?.timelineEvents ??
        buildMockPullRequestDetail(mockPullRequests[0]).timelineEvents,
      availability: mockAvailable,
      pageInfo: null
    }),
    listPullRequestLinkedIssuesWithStatus: async (input): Promise<PullRequestLinkedIssuesResult> => ({
      items:
        readMockPullRequests().find((item) => item.number === input.pullNumber)?.linkedIssues ??
        buildMockPullRequestDetail(mockPullRequests[0]).linkedIssues,
      availability: mockAvailable
    }),
    listDiscussionsWithStatus: async (input) => ({
      items: mockDiscussions.slice(0, input.limit),
      availability: mockAvailable
    }),
    listDiscussionCategoriesWithStatus: async (input) => ({
      items: mockDiscussionCategories.slice(0, input.limit ?? mockDiscussionCategories.length),
      availability: mockAvailable
    }),
    getDiscussionDetail: async (input) => mockDiscussionDetail(input),
    listActionsWithStatus: async (input) => ({
      items: listMockWorkflowRuns(input),
      availability: mockAvailable
    }),
    listWorkflowsWithStatus: async (input): Promise<WorkflowDefinitionListResult> => ({
      items: mockWorkflows.slice(0, input.limit ?? mockWorkflows.length),
      availability: mockAvailable
    }),
    getWorkflowRunDetailWithStatus: async (input): Promise<WorkflowRunDetailResult> => ({
      detail:
        readMockWorkflowRuns().find((run) => run.id === input.runId) ??
        buildMockWorkflowRunDetail(mockActions[0]),
      availability: mockAvailable
    }),
    getWorkflowJobLogs: async (input) => mockWorkflowJobLogs(input.jobId),
    listProjectsWithStatus: async (input) => ({
      items: mockProjects.slice(0, input.limit ?? mockProjects.length),
      availability: mockAvailable
    }),
    getBranchProtection: async (input) => ({
      ...mockBranchProtection,
      protection: mockBranchProtection.protection
        ? { ...mockBranchProtection.protection, branch: input.branch }
        : null
    }),
    listDependabotAlerts: async (input) => ({
      items: mockDependabotAlerts.slice(0, input.limit ?? mockDependabotAlerts.length),
      availability: mockAvailable
    }),
    listCodeScanningAlerts: async (input) => ({
      items: mockCodeScanningAlerts.slice(0, input.limit ?? mockCodeScanningAlerts.length),
      availability: mockAvailable
    }),
    listSecretScanningAlerts: async (input) => ({
      items: mockSecretScanningAlerts.slice(0, input.limit ?? mockSecretScanningAlerts.length),
      availability: mockAvailable
    }),
    listRepositoryRulesets: async (input) => ({
      items: mockRepositoryRulesets.slice(0, input.limit ?? mockRepositoryRulesets.length),
      availability: mockAvailable
    }),
    listRepositoryForks: async (input) => ({
      items: mockRepositoryForks(input),
      availability: mockAvailable
    }),
    listRepositorySecurityAdvisories: async (input) => ({
      items: mockRepositorySecurityAdvisories.slice(
        0,
        input.limit ?? mockRepositorySecurityAdvisories.length
      ),
      availability: mockAvailable
    }),
    getRepositorySecurityPolicy: async () => mockRepositorySecurityPolicy,
    getRepositoryCommunityProfile: async () => ({
      profile: mockRepositoryCommunityProfile,
      availability: mockAvailable
    }),
    listReleasesWithStatus: async (input): Promise<ReleaseListResult> => ({
      items: readMockReleases().slice(0, input.limit ?? 20),
      availability: mockAvailable
    }),
    getReleaseDetailWithStatus: async (input): Promise<ReleaseDetailResult> => mockReleaseDetail(input),
    listContributorsWithStatus: async (input): Promise<ContributorListResult> => ({
      items: mockContributors.slice(0, input.limit ?? 24),
      availability: mockAvailable
    }),
    searchWithStatus: async (input): Promise<RepositorySearchResult> => ({
      items: mockRepositories.filter((repository) =>
        repository.nameWithOwner.toLowerCase().includes(input.query.toLowerCase())
      ),
      availability: mockAvailable
    }),
    mutate: async (input) => {
      mutateMockRepositorySettings(input);
      mutateMockIssues(input);
      mutateMockPullRequests(input);
      mutateMockReleases(input);
      mutateMockWorkflowRuns(input);
      return {
        ok: true,
        action: input.action,
        message: `${input.action} completed in browser mock mode.`
      };
    }
  }
};
