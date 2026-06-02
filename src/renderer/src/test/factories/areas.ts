import type { AreaRepositoryDetail, AreaRepositorySummary, AreaSummary } from "@shared/areas";

const readyAreaHealth = {
  status: "ready",
  message: null,
  checkedAt: "2026-05-01T00:00:00.000Z"
} as const;

export const githubArea: AreaSummary = {
  id: "github:default",
  kind: "github",
  label: "GitHub",
  subtitle: "Ashley Rico",
  rootPath: null,
  accountLogin: "ashley",
  health: readyAreaHealth,
  repositoryCount: 2,
  selected: true,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

export const localArea: AreaSummary = {
  id: "local:projects",
  kind: "local",
  label: "Laptop Projects",
  subtitle: "Local repositories",
  rootPath: "/Users/ashley/Projects",
  accountLogin: null,
  health: readyAreaHealth,
  repositoryCount: 2,
  selected: false,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

export const sshArea: AreaSummary = {
  id: "ssh:delta",
  kind: "ssh",
  label: "Delta WSL",
  subtitle: "alpha@delta-wsl:2222:~/controltest",
  rootPath: "~/controltest",
  accountLogin: null,
  gateway: {
    status: "ready",
    version: "0.1.0",
    apiUrl: "http://127.0.0.1:35525",
    serviceName: "control-gateway-ssh-delta",
    lastStartedAt: "2026-05-01T00:00:00.000Z",
    lastSeenAt: "2026-05-01T00:00:00.000Z",
    failureCode: null,
    message: null
  },
  health: readyAreaHealth,
  repositoryCount: 1,
  selected: false,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

const localRepositoryCapabilities = {
  supportsBranches: true,
  supportsBookmarks: false,
  supportsWorkspaces: false,
  supportsOperationLog: false,
  supportsSparse: false,
  isGitBacked: true,
  isColocated: false,
  supportsGitHubEnrichment: true
};

export const localGitRepository: AreaRepositorySummary = {
  id: "repo-control",
  areaId: localArea.id,
  kind: "git",
  name: "control",
  owner: null,
  displayName: "Control App",
  path: "/Users/ashley/Projects/control",
  defaultBranch: "main",
  currentBranch: "main",
  isDirty: true,
  isPrivate: true,
  description: "Local Control checkout.",
  connection: {
    owner: "NarukeAlpha",
    repo: "control",
    nameWithOwner: "NarukeAlpha/control",
    remoteName: "origin",
    remoteUrl: "git@github.com:NarukeAlpha/control.git",
    url: "https://github.com/NarukeAlpha/control",
    matchedGitHubAreaId: "github:default",
    status: "connected",
    lastCheckedAt: "2026-05-01T00:00:00.000Z",
    lastError: null
  },
  capabilities: localRepositoryCapabilities,
  health: readyAreaHealth,
  updatedAt: "2026-05-02T00:00:00.000Z",
  scannedAt: "2026-05-02T00:00:00.000Z"
};

export const localJjRepository: AreaRepositorySummary = {
  ...localGitRepository,
  id: "repo-control-jj",
  kind: "jj",
  displayName: "Control JJ",
  path: "/Users/ashley/Projects/control-jj",
  currentBranch: null,
  capabilities: {
    ...localRepositoryCapabilities,
    supportsBookmarks: true,
    supportsWorkspaces: true,
    supportsOperationLog: true,
    isColocated: true
  }
};

export const localWorkspace = {
  id: "workspace-review",
  areaId: localArea.id,
  repositoryId: localJjRepository.id,
  name: "review-stack",
  rootPath: "/Users/ashley/Projects/control-jj-worktrees/review",
  workingCopyChangeId: "zzzzzzzz",
  workingCopyCommitId: "abcdef123456",
  isStale: true,
  sparseSummary: "src/renderer",
  health: readyAreaHealth,
  updatedAt: "2026-05-02T00:00:00.000Z",
  scannedAt: "2026-05-02T00:00:00.000Z"
};

export function makeLocalRepositoryDetail(
  repository: AreaRepositorySummary = localJjRepository
): AreaRepositoryDetail {
  return {
    ...repository,
    remotes: [
      {
        name: "origin",
        fetchUrl: repository.connection?.remoteUrl ?? null,
        pushUrl: repository.connection?.remoteUrl ?? null,
        github: repository.connection
      }
    ],
    branches: [
      {
        name: "main",
        current: repository.currentBranch === "main",
        upstream: "origin/main",
        commit: "abc123"
      }
    ],
    bookmarks:
      repository.kind === "jj"
        ? [{ name: "review-stack", remote: null, target: "zzzzzzzz", tracking: false }]
        : [],
    tags: [{ name: "v0.1.0", target: "abc123" }],
    status: {
      clean: false,
      dirtyCount: 2,
      untrackedCount: 1,
      conflictedCount: 0,
      ahead: 1,
      behind: 0,
      entries: [{ path: "src/renderer/src/App.tsx", indexStatus: "M", workingTreeStatus: null }]
    },
    recentCommits: [
      {
        id: "abcdef123456",
        shortId: "abcdef1",
        changeId: repository.kind === "jj" ? "zzzzzzzz" : null,
        summary: "Add local Area routing",
        authorName: "Ashley Rico",
        authorEmail: "ashley@example.com",
        authoredAt: "2026-05-02T00:00:00.000Z"
      }
    ],
    recentOperations:
      repository.kind === "jj"
        ? [
            {
              id: "op123456",
              shortId: "op123",
              description: "rebase workspace stack",
              user: "ashley",
              time: "2026-05-02T00:00:00.000Z"
            }
          ]
        : [],
    readme: null,
    workspaces: repository.kind === "jj" ? [localWorkspace] : []
  };
}
