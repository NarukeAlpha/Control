import type {
  AppState,
  ContributorSummary,
  DiscussionSummary,
  GitHubAccountProfile,
  IssueSummary,
  ProjectSummary,
  PullRequestSummary,
  ReleaseSummary,
  RepoEntry,
  RepositoryDetail,
  RepositorySummary,
  Viewer,
  WorkflowRunSummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

const avatar = "https://avatars.githubusercontent.com/u/10639145?v=4";

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

export const mockViewer: Viewer = {
  login: "ashleyrico",
  name: "Ashley Rico",
  avatarUrl: avatar,
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
    avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
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
    avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
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
    avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
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
    permission: "READ",
    canAdminister: false,
    canSubscribe: true
  },
  permissions: {
    viewerPermission: "READ",
    isArchived: false,
    isDisabled: false
  }
};

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

export const mockContents: RepoEntry[] = [
  [".github", "dir", "Improve issue template", "2026-05-01T10:00:00Z"],
  ["documentation", "dir", "Add documentation for region based isolation", "2026-05-03T17:00:00Z"],
  ["include", "dir", "Fix build on Linux", "2026-05-02T16:00:00Z"],
  ["lib", "dir", "Add Sendable support for @MainActor types", "2026-05-03T20:00:00Z"],
  ["test", "dir", "Update concurrency runtime tests", "2026-05-03T18:00:00Z"],
  [".clang-format", "file", "Format", "2026-05-01T12:00:00Z"],
  ["CMakeLists.txt", "file", "Update minimum CMake version", "2026-04-30T12:00:00Z"],
  ["LICENSE.txt", "file", "Update license year", "2026-04-20T12:00:00Z"],
  ["README.md", "file", "Update installation instructions", "2026-05-03T11:00:00Z"]
].map(([name, type, message, date], index) => ({
  name,
  path: name,
  type: type as RepoEntry["type"],
  sha: `mock-${index}`,
  size: type === "file" ? 1024 + index * 90 : null,
  htmlUrl: `https://github.com/apple/swift/${type === "dir" ? "tree" : "blob"}/main/${name}`,
  downloadUrl: null,
  lastCommitMessage: message,
  lastCommitDate: date
}));

export const mockIssues: IssueSummary[] = Array.from({ length: 18 }, (_, index) => ({
  id: index + 1,
  number: 1200 - index,
  title:
    index % 3 === 0 ? "Improve Sendable diagnostics for global actors" : "Compiler crash in async closure",
  state: index % 5 === 0 ? "closed" : "open",
  authorLogin: index % 2 === 0 ? "slightbug" : "swift-ci",
  authorAvatarUrl: avatar,
  comments: 2 + index,
  labels: [{ id: `kind-${index}`, name: index % 2 === 0 ? "compiler" : "concurrency", color: "0969da" }],
  createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/issues/${1200 - index}`
}));

export const mockPullRequests: PullRequestSummary[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  number: 520 - index,
  title: index % 2 === 0 ? "Add Sendable support for @MainActor types" : "Update concurrency runtime tests",
  state: index % 4 === 0 ? "closed" : "open",
  isDraft: index === 3,
  authorLogin: index % 2 === 0 ? "slightbug" : "applebot",
  authorAvatarUrl: avatar,
  comments: 4 + index,
  reviewComments: 2 + index,
  additions: 125 + index * 3,
  deletions: 40 + index,
  changedFiles: 5 + index,
  mergeableState: index % 2 === 0 ? "clean" : "unstable",
  headRefName: `feature/sendable-${index}`,
  baseRefName: "main",
  createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 7_200_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/pull/${520 - index}`
}));

export const mockDiscussions: DiscussionSummary[] = Array.from({ length: 8 }, (_, index) => ({
  id: `D_${index}`,
  number: 200 + index,
  title: index % 2 === 0 ? "Swift 6 concurrency migration notes" : "Package manager ergonomics",
  authorLogin: index % 2 === 0 ? "swiftlang" : "community",
  category: index % 2 === 0 ? "Announcements" : "Q&A",
  comments: 10 + index * 2,
  updatedAt: new Date(Date.now() - index * 5_400_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}`
}));

export const mockActions: WorkflowRunSummary[] = Array.from({ length: 10 }, (_, index) => ({
  id: 9000 + index,
  name: index % 2 === 0 ? "Swift CI" : "Docs",
  event: index % 2 === 0 ? "pull_request" : "push",
  status: "completed",
  conclusion: index % 4 === 0 ? "failure" : "success",
  branch: "main",
  commitSha: `7f3a2c${index}`,
  createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/actions/runs/${9000 + index}`
}));

export const mockProjects: ProjectSummary[] = [
  {
    id: "P_1",
    title: "Compiler quality",
    closed: false,
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    htmlUrl: "https://github.com/orgs/apple/projects/1"
  },
  {
    id: "P_2",
    title: "Concurrency roadmap",
    closed: false,
    updatedAt: new Date(Date.now() - 172_800_000).toISOString(),
    htmlUrl: "https://github.com/orgs/apple/projects/2"
  }
];

export const mockReleases: ReleaseSummary[] = [
  {
    id: 1,
    name: "Swift 5.10.0",
    tagName: "swift-5.10.0",
    isDraft: false,
    isPrerelease: false,
    publishedAt: new Date(Date.now() - 172_800_000).toISOString(),
    htmlUrl: "https://github.com/apple/swift/releases/tag/swift-5.10.0"
  }
];

export const mockContributors: ContributorSummary[] = Array.from({ length: 14 }, (_, index) => ({
  id: index + 10,
  login: ["slightbug", "ashleyrico", "applebot", "swiftlang"][index % 4],
  avatarUrl: `https://i.pravatar.cc/96?img=${index + 10}`,
  htmlUrl: "https://github.com",
  contributions: 200 - index * 8
}));

export const mockAppState: AppState = {
  platform: "darwin",
  isMac: true,
  settings: {
    credentialProvider: "gh-cli",
    ghPath: "/opt/homebrew/bin/gh",
    githubAppClientId: null,
    glassMode: "glass-shell"
  },
  gh: {
    available: true,
    authenticated: true,
    path: "/opt/homebrew/bin/gh",
    user: mockViewer.login,
    error: null
  },
  viewer: mockViewer
};

export const mockControlApi: ControlApi = {
  getAppState: async () => mockAppState,
  getSettings: async () => mockAppState.settings,
  updateSettings: async (settings) => ({ ...mockAppState.settings, ...settings }),
  openExternal: async () => undefined,
  github: {
    getViewer: async () => mockViewer,
    getAccountProfile: async () => mockAccountProfile,
    listRepositories: async () => mockRepositories,
    listAccountRepositories: async () => mockRepositories,
    listAccountIssues: async () => mockIssues,
    listAccountPullRequests: async () => mockPullRequests,
    getRepository: async () => mockRepository,
    getReadme: async () => mockRepository.readmeMarkdown,
    listContents: async () => mockContents,
    getFileContent: async (input) => ({
      path: input.path,
      name: input.path.split("/").pop() ?? input.path,
      ref: input.ref ?? mockRepository.defaultBranch,
      content: `# ${input.path}\n\nMock file content from Control.`,
      htmlUrl: `https://github.com/apple/swift/blob/main/${input.path}`
    }),
    listIssues: async () => mockIssues,
    getIssueDetail: async (input) => {
      const issue = mockIssues.find((item) => item.number === input.issueNumber) ?? mockIssues[0];
      return {
        ...issue,
        body: "This issue reproduces in the current repository view and includes enough context for in-app triage.",
        commentsList: [
          {
            id: `${issue.id}-comment-1`,
            authorLogin: "swift-ci",
            authorAvatarUrl: avatar,
            body: "I can reproduce this locally. The next step is narrowing the failing file.",
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            htmlUrl: `${issue.htmlUrl}#issuecomment-1`
          }
        ]
      };
    },
    listPullRequests: async () => mockPullRequests,
    getPullRequestDetail: async (input) => {
      const pull = mockPullRequests.find((item) => item.number === input.pullNumber) ?? mockPullRequests[0];
      return {
        ...pull,
        body: "This pull request updates the repository surface and keeps the change small enough to review in Control.",
        commentsList: [
          {
            id: `${pull.id}-comment-1`,
            authorLogin: "applebot",
            authorAvatarUrl: avatar,
            body: "CI is running. Review the changed files and merge status before landing.",
            createdAt: pull.createdAt,
            updatedAt: pull.updatedAt,
            htmlUrl: `${pull.htmlUrl}#issuecomment-1`
          }
        ]
      };
    },
    listDiscussions: async () => mockDiscussions,
    listActions: async () => mockActions,
    listProjects: async () => mockProjects,
    listReleases: async () => mockReleases,
    listContributors: async () => mockContributors,
    search: async (input) =>
      mockRepositories.filter((repository) =>
        repository.nameWithOwner.toLowerCase().includes(input.query.toLowerCase())
      ),
    mutate: async (input) => ({
      ok: true,
      action: input.action,
      message: `${input.action} completed in browser mock mode.`
    })
  }
};
