import type {
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
                },
                dark: {
                  ...currentSettings.theme.custom.dark,
                  ...settingsPatch.theme.custom.dark
                }
              }
            : currentSettings.theme.custom
        }
      : currentSettings.theme,
    repositoryTabPreferences:
      settingsPatch.repositoryTabPreferences ?? currentSettings.repositoryTabPreferences
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
    listAreas: async () => [],
    getArea: async () => null,
    selectArea: async () => [],
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
    searchAreas: async () => ({ areas: [], repositories: [], workspaces: [] }),
    listRepositories: async () => [],
    getRepository: async () => null,
    listContents: async () => [],
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
      kind: "unavailable",
      text: null,
      encoding: null,
      size: null,
      message: "Mock local file content is unavailable."
    }),
    listBranches: async () => [],
    listRemotes: async () => [],
    getStatus: async () => ({
      clean: null,
      dirtyCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      ahead: null,
      behind: null,
      entries: []
    }),
    listActivity: async () => [],
    listWorkspaces: async () => [],
    getWorkspace: async () => null,
    getGitHubRepository: async () => ({
      detail: null,
      availability: mockGitHubNotLoaded
    }),
    listGitHubIssues: async () => ({
      items: [],
      availability: mockGitHubNotLoaded
    }),
    listGitHubPullRequests: async () => ({
      items: [],
      availability: mockGitHubNotLoaded
    }),
    listGitHubActions: async () => ({
      items: [],
      availability: mockGitHubNotLoaded
    }),
    listGitHubReleases: async () => ({
      items: [],
      availability: mockGitHubNotLoaded
    }),
    listGitHubContributors: async () => ({
      items: [],
      availability: mockGitHubNotLoaded
    }),
    getSyncStatus: async (input) => ({
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
    }),
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
