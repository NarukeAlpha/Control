import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  AppState,
  BranchSummary,
  BranchProtectionResult,
  CodeScanningAlertSummary,
  ContributorListResult,
  ContributorSummary,
  DependabotAlertSummary,
  DiscussionCategorySummary,
  DiscussionDetailResult,
  DiscussionSummary,
  GitHubAccountProfile,
  GitHubSignInSession,
  GitHubMutationInput,
  AssignableUserSummary,
  IssueDetail,
  IssueDetailResult,
  IssueSummary,
  LabelSummary,
  MilestoneSummary,
  NotificationListResult,
  NotificationListInput,
  NotificationSummary,
  OrganizationListResult,
  OrganizationMembersResult,
  OrganizationMemberSummary,
  OrganizationTeamMembersResult,
  OrganizationRepositoriesResult,
  OrganizationRepositorySummary,
  OrganizationTeamRepositorySummary,
  OrganizationSummary,
  OrganizationTeamsResult,
  ProjectSummary,
  PullRequestDetail,
  PullRequestDetailResult,
  PullRequestRequestedTeamSummary,
  PullRequestSummary,
  ReleaseListResult,
  ReleaseSummary,
  RepoFileBlameResult,
  RepoEntry,
  RepoTreeResult,
  RepositoryCollaboratorSummary,
  RepositoryCommitSummary,
  RepositoryCommunityProfile,
  RepositoryDetail,
  RepositoryListResult,
  RepositoryRef,
  RepositorySearchResult,
  RepositoryRulesetSummary,
  RepositorySecurityAdvisorySummary,
  RepositorySecurityPolicyResult,
  RepositorySummary,
  RepositoryWikiResult,
  SecretScanningAlertSummary,
  TagSummary,
  TeamMemberSummary,
  TeamSummary,
  Viewer,
  WorkflowDefinitionListResult,
  WorkflowDefinitionSummary,
  WorkflowJobLogsResult,
  WorkflowRunDetail,
  WorkflowRunDetailResult,
  WorkflowRunSummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import type { LocalRecentItem, LocalRecentListInput, LocalRecentRecordInput } from "@shared/local";

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

const mockPinnedRepositoriesKey = "control:mock:pinned-repositories";
const mockRecentItemsKey = "control:mock:recent-items";
const mockNotificationsKey = "control:mock:notifications";
const mockIssuesKey = "control:mock:issues";
const mockPullRequestsKey = "control:mock:pull-requests";
const mockReleasesKey = "control:mock:releases";
const mockWorkflowRunsKey = "control:mock:workflow-runs";
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

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readMockArray<T>(key: string): T[] {
  const storage = localStorageOrNull();
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeMockArray<T>(key: string, items: T[]): void {
  localStorageOrNull()?.setItem(key, JSON.stringify(items));
}

function listMockPinnedRepositories(): string[] {
  return readMockArray<string>(mockPinnedRepositoriesKey);
}

function pinMockRepository(nameWithOwner: string): string[] {
  const normalized = nameWithOwner.toLowerCase();
  const repositories = listMockPinnedRepositories();
  const nextRepositories = repositories.some((item) => item.toLowerCase() === normalized)
    ? repositories
    : [nameWithOwner, ...repositories];
  writeMockArray(mockPinnedRepositoriesKey, nextRepositories);
  return nextRepositories;
}

function unpinMockRepository(nameWithOwner: string): string[] {
  const normalized = nameWithOwner.toLowerCase();
  const nextRepositories = listMockPinnedRepositories().filter((item) => item.toLowerCase() !== normalized);
  writeMockArray(mockPinnedRepositoriesKey, nextRepositories);
  return nextRepositories;
}

function listMockRecentItems(input?: LocalRecentListInput): LocalRecentItem[] {
  const items = readMockArray<LocalRecentItem>(mockRecentItemsKey).filter(
    (item) => !input?.kind || item.kind === input.kind
  );
  return items.slice(0, input?.limit ?? 20);
}

function recordMockRecentItem(input: LocalRecentRecordInput): LocalRecentItem[] {
  const item: LocalRecentItem = {
    kind: input.kind,
    provider: "github",
    itemKey: input.itemKey,
    title: input.title,
    subtitle: input.subtitle ?? null,
    repositoryNameWithOwner: input.repositoryNameWithOwner ?? null,
    url: input.url ?? null,
    metadata: input.metadata ?? {},
    updatedAt: new Date().toISOString()
  };
  const existingItems = readMockArray<LocalRecentItem>(mockRecentItemsKey);
  const nextItems = [item, ...existingItems.filter((recent) => recent.itemKey !== item.itemKey)].slice(0, 50);
  writeMockArray(mockRecentItemsKey, nextItems);
  return listMockRecentItems();
}

function readMockNotifications(): NotificationSummary[] {
  const storage = localStorageOrNull();
  const serialized = storage?.getItem(mockNotificationsKey);
  if (!serialized) {
    return mockNotifications;
  }

  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? (parsed as NotificationSummary[]) : mockNotifications;
  } catch {
    return mockNotifications;
  }
}

function writeMockNotifications(items: NotificationSummary[]): void {
  writeMockArray(mockNotificationsKey, items);
}

function listMockNotifications(input?: NotificationListInput): NotificationSummary[] {
  const notifications = readMockNotifications().filter((notification) => {
    if (!input?.all && !notification.unread) {
      return false;
    }
    if (input?.participating && notification.participating !== true) {
      return false;
    }
    return true;
  });
  return notifications.slice(0, input?.limit ?? 30);
}

function markMockNotificationRead(threadId: string): NotificationSummary[] {
  const now = new Date().toISOString();
  const nextNotifications = readMockNotifications().map((notification) =>
    notification.id === threadId
      ? {
          ...notification,
          unread: false,
          lastReadAt: now
        }
      : notification
  );
  writeMockNotifications(nextNotifications);
  return nextNotifications;
}

function unsubscribeMockNotification(threadId: string): NotificationSummary[] {
  const nextNotifications = readMockNotifications().filter((notification) => notification.id !== threadId);
  writeMockNotifications(nextNotifications);
  return nextNotifications;
}

function buildMockIssueDetail(issue: IssueSummary): IssueDetail {
  const numericId = typeof issue.id === "number" ? issue.id : issue.number;
  return {
    ...issue,
    body: "This issue reproduces in the current repository view and includes enough context for in-app triage.",
    commentsList: [
      {
        id: numericId * 1000 + 1,
        authorLogin: "swift-ci",
        authorAvatarUrl: avatar,
        body: "I can reproduce this locally. The next step is narrowing the failing file.",
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        htmlUrl: `${issue.htmlUrl}#issuecomment-${numericId * 1000 + 1}`
      }
    ],
    commentsAvailability: { status: "available", message: null }
  };
}

function readMockIssues(): IssueDetail[] {
  const storage = localStorageOrNull();
  const serialized = storage?.getItem(mockIssuesKey);
  if (!serialized) {
    return mockIssues.map(buildMockIssueDetail);
  }

  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? (parsed as IssueDetail[]) : mockIssues.map(buildMockIssueDetail);
  } catch {
    return mockIssues.map(buildMockIssueDetail);
  }
}

function writeMockIssues(items: IssueDetail[]): void {
  writeMockArray(mockIssuesKey, items);
}

function readMockRepositorySettings(): Record<string, MockRepositorySettingsOverride> {
  const storage = localStorageOrNull();
  const serialized = storage?.getItem(mockRepositorySettingsKey);
  if (!serialized) {
    return {};
  }

  try {
    const parsed = JSON.parse(serialized);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, MockRepositorySettingsOverride>)
      : {};
  } catch {
    return {};
  }
}

function writeMockRepositorySettings(items: Record<string, MockRepositorySettingsOverride>): void {
  const storage = localStorageOrNull();
  storage?.setItem(mockRepositorySettingsKey, JSON.stringify(items));
}

function listMockIssues(input?: { state?: "open" | "closed" | "all"; limit?: number }): IssueSummary[] {
  const state = input?.state ?? "open";
  const issues = readMockIssues().filter((issue) => state === "all" || issue.state === state);
  return issues
    .slice(0, input?.limit ?? issues.length)
    .map(({ body: _body, commentsList: _commentsList, ...issue }) => issue);
}

function readMockReleases(): ReleaseSummary[] {
  const storage = localStorageOrNull();
  const serialized = storage?.getItem(mockReleasesKey);
  if (!serialized) {
    return mockReleases;
  }

  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? (parsed as ReleaseSummary[]) : mockReleases;
  } catch {
    return mockReleases;
  }
}

function writeMockReleases(items: ReleaseSummary[]): void {
  writeMockArray(mockReleasesKey, items);
}

function mockPayloadString(payload: Record<string, unknown> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function mockPayloadBoolean(payload: Record<string, unknown> | undefined, key: string): boolean {
  return payload?.[key] === true;
}

function mockPayloadNumber(payload: Record<string, unknown> | undefined, key: string): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mockPayloadStringArray(payload: Record<string, unknown> | undefined, key: string): string[] {
  const value = payload?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mutateMockRepositorySettings(input: GitHubMutationInput): void {
  if (input.action !== "editRepository") {
    return;
  }

  const nameWithOwner = `${input.owner}/${input.repo}`.toLowerCase();
  const payload = input.payload ?? {};
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

function mockLabelForName(name: string): LabelSummary {
  return (
    mockLabels.find((label) => label.name.toLowerCase() === name.toLowerCase()) ?? {
      id: `L_${name.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`,
      name,
      color: "57606a",
      description: null
    }
  );
}

function mockAssigneeForLogin(login: string): AssignableUserSummary {
  return (
    mockAssignableUsers.find((user) => user.login.toLowerCase() === login.toLowerCase()) ?? {
      id: `U_${login.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`,
      login,
      avatarUrl: avatar,
      htmlUrl: `https://github.com/${login}`
    }
  );
}

function mutateMockIssues(input: GitHubMutationInput): void {
  const payload = input.payload;
  const issueNumber = mockPayloadNumber(payload, "issueNumber");
  const now = new Date().toISOString();

  if (input.action === "createIssue") {
    const title = mockPayloadString(payload, "title")?.trim();
    if (!title) {
      return;
    }
    const issues = readMockIssues();
    const nextNumber = Math.max(...issues.map((issue) => issue.number), 1200) + 1;
    const body = mockPayloadString(payload, "body")?.trim() ?? "";
    const labels = mockPayloadStringArray(payload, "labels").map(mockLabelForName);
    const assignees = mockPayloadStringArray(payload, "assignees").map(mockAssigneeForLogin);
    const milestoneNumber = typeof payload?.milestone === "number" ? payload.milestone : null;
    const issueId = Date.now();
    const createdIssue: IssueDetail = {
      id: issueId,
      nodeId: `I_mock_created_${issueId}`,
      number: nextNumber,
      title,
      state: "open",
      stateReason: null,
      authorLogin: "ashley-rico",
      authorAvatarUrl: avatar,
      comments: 0,
      labels,
      assignees,
      milestone: mockMilestones.find((milestone) => milestone.number === milestoneNumber) ?? null,
      createdAt: now,
      updatedAt: now,
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/issues/${nextNumber}`,
      body,
      commentsList: [],
      commentsAvailability: { status: "available", message: null }
    };
    writeMockIssues([createdIssue, ...issues]);
    return;
  }

  if (issueNumber !== null) {
    const nextIssues = readMockIssues().map((issue) => {
      if (issue.number !== issueNumber) {
        return issue;
      }

      if (input.action === "editIssue") {
        const milestoneNumber = typeof payload?.milestone === "number" ? payload.milestone : undefined;
        return {
          ...issue,
          title: mockPayloadString(payload, "title")?.trim() || issue.title,
          body: mockPayloadString(payload, "body") ?? issue.body,
          milestone:
            milestoneNumber === undefined
              ? issue.milestone
              : (mockMilestones.find((milestone) => milestone.number === milestoneNumber) ?? null),
          updatedAt: now
        };
      }
      if (input.action === "closeIssue" || input.action === "reopenIssue") {
        return {
          ...issue,
          state: input.action === "closeIssue" ? "closed" : "open",
          stateReason:
            input.action === "closeIssue" ? (mockPayloadString(payload, "stateReason") ?? "completed") : null,
          updatedAt: now
        };
      }
      if (input.action === "addComment") {
        const body = mockPayloadString(payload, "body")?.trim();
        if (!body) {
          return issue;
        }
        const nextCommentId =
          Math.max(
            0,
            ...readMockIssues().flatMap((item) =>
              item.commentsList
                .map((comment) => (typeof comment.id === "number" ? comment.id : null))
                .filter((id): id is number => id !== null)
            )
          ) + 1;
        return {
          ...issue,
          comments: issue.comments + 1,
          commentsList: [
            ...issue.commentsList,
            {
              id: nextCommentId,
              authorLogin: "ashley-rico",
              authorAvatarUrl: avatar,
              body,
              createdAt: now,
              updatedAt: now,
              htmlUrl: `${issue.htmlUrl}#issuecomment-${nextCommentId}`
            }
          ],
          updatedAt: now
        };
      }
      if (input.action === "addLabels") {
        const labels = mockPayloadStringArray(payload, "labels").map(mockLabelForName);
        const existingNames = new Set(issue.labels.map((label) => label.name.toLowerCase()));
        return {
          ...issue,
          labels: [
            ...issue.labels,
            ...labels.filter((label) => !existingNames.has(label.name.toLowerCase()))
          ],
          updatedAt: now
        };
      }
      if (input.action === "removeLabel") {
        const name = mockPayloadString(payload, "name")?.trim().toLowerCase();
        return {
          ...issue,
          labels: name ? issue.labels.filter((label) => label.name.toLowerCase() !== name) : issue.labels,
          updatedAt: now
        };
      }
      if (input.action === "setAssignees") {
        const assignees = mockPayloadStringArray(payload, "assignees").map(mockAssigneeForLogin);
        const existingLogins = new Set((issue.assignees ?? []).map((user) => user.login.toLowerCase()));
        return {
          ...issue,
          assignees: [
            ...(issue.assignees ?? []),
            ...assignees.filter((assignee) => !existingLogins.has(assignee.login.toLowerCase()))
          ],
          updatedAt: now
        };
      }
      if (input.action === "removeAssignees") {
        const logins = new Set(
          mockPayloadStringArray(payload, "assignees").map((login) => login.toLowerCase())
        );
        return {
          ...issue,
          assignees: (issue.assignees ?? []).filter((assignee) => !logins.has(assignee.login.toLowerCase())),
          updatedAt: now
        };
      }
      return issue;
    });
    writeMockIssues(nextIssues);
    return;
  }

  const commentId = mockPayloadNumber(payload, "commentId");
  if (commentId === null) {
    return;
  }
  if (input.action === "editComment") {
    writeMockIssues(
      readMockIssues().map((issue) => ({
        ...issue,
        commentsList: issue.commentsList.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                body: mockPayloadString(payload, "body") ?? comment.body,
                updatedAt: now
              }
            : comment
        )
      }))
    );
    return;
  }
  if (input.action === "deleteComment") {
    writeMockIssues(
      readMockIssues().map((issue) => {
        const commentsList = issue.commentsList.filter((comment) => comment.id !== commentId);
        return {
          ...issue,
          commentsList,
          comments: Math.max(0, issue.comments - (commentsList.length === issue.commentsList.length ? 0 : 1)),
          updatedAt: commentsList.length === issue.commentsList.length ? issue.updatedAt : now
        };
      })
    );
  }
}

function mockTeamForSlug(slug: string): PullRequestRequestedTeamSummary {
  const team = mockTeams.find((item) => item.slug.toLowerCase() === slug.toLowerCase());
  if (team) {
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      htmlUrl: team.htmlUrl
    };
  }

  return {
    id: `T_${slug.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`,
    name: slug
      .split("-")
      .filter(Boolean)
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(" "),
    slug,
    htmlUrl: `https://github.com/orgs/apple/teams/${slug}`
  };
}

function buildMockPullRequestDetail(pull: PullRequestSummary): PullRequestDetail {
  const numericId = typeof pull.id === "number" ? pull.id : pull.number;
  return {
    ...pull,
    body: "This pull request updates the repository surface and keeps the change small enough to review in Control.",
    labels: [mockLabelForName("compiler")],
    assignees: [mockAssigneeForLogin("ashleyrico")],
    milestone: mockMilestones[0] ?? null,
    commentsList: [
      {
        id: numericId * 1000 + 1,
        authorLogin: "applebot",
        authorAvatarUrl: avatar,
        body: "CI is running. Review the changed files and merge status before landing.",
        createdAt: pull.createdAt,
        updatedAt: pull.updatedAt,
        htmlUrl: `${pull.htmlUrl}#issuecomment-${numericId * 1000 + 1}`
      }
    ],
    commentsAvailability: { status: "available", message: null },
    files: [
      {
        filename: "src/renderer/src/App.tsx",
        status: "modified",
        additions: 42,
        deletions: 8,
        changes: 50,
        patch: "@@ -1,3 +1,3 @@",
        blobUrl: `${pull.htmlUrl}/files#diff-app`,
        rawUrl: null
      },
      {
        filename: "src/shared/github.ts",
        status: "modified",
        additions: 14,
        deletions: 2,
        changes: 16,
        patch: null,
        blobUrl: `${pull.htmlUrl}/files#diff-shared`,
        rawUrl: null
      }
    ],
    filesAvailability: { status: "available", message: null },
    commitsList: [
      {
        sha: "7f3a2c9d0",
        message: "Add repository management controls",
        authorLogin: "slightbug",
        authorAvatarUrl: avatar,
        committedAt: pull.updatedAt,
        htmlUrl: `${pull.htmlUrl}/commits/7f3a2c9d0`
      }
    ],
    commitsAvailability: { status: "available", message: null },
    requestedReviewers: [mockAssigneeForLogin("swift-ci")],
    requestedTeams: [mockTeamForSlug("compiler")],
    reviews: [
      {
        id: numericId * 1000 + 701,
        authorLogin: "reviewer",
        authorAvatarUrl: avatar,
        state: "APPROVED",
        body: "Looks good.",
        submittedAt: pull.updatedAt,
        commitSha: "7f3a2c9d0",
        htmlUrl: `${pull.htmlUrl}#pullrequestreview-${numericId * 1000 + 701}`
      }
    ],
    reviewsAvailability: { status: "available", message: null },
    latestReviewState: "APPROVED",
    reviewDecisionAvailability: { status: "available", message: null },
    checks: [
      {
        id: numericId * 1000 + 801,
        name: "macOS build",
        status: "completed",
        conclusion: "success",
        startedAt: pull.updatedAt,
        completedAt: pull.updatedAt,
        htmlUrl: `${pull.htmlUrl}/checks?check_run_id=${numericId * 1000 + 801}`,
        detailsUrl: `${pull.htmlUrl}/checks?check_run_id=${numericId * 1000 + 801}`,
        appName: "GitHub Actions",
        outputTitle: "macOS build passed",
        outputSummary: "All tests passed."
      }
    ],
    checksAvailability: { status: "available", message: null },
    reviewThreadsAvailability: { status: "available", message: null },
    linkedIssues: [
      {
        number: 1200,
        title: "Crash on build",
        state: "OPEN",
        stateReason: null,
        htmlUrl: "https://github.com/apple/swift/issues/1200",
        repositoryNameWithOwner: "apple/swift"
      },
      {
        number: 84,
        title: "Compiler diagnostics should include linked repository context",
        state: "CLOSED",
        stateReason: "COMPLETED",
        htmlUrl: "https://github.com/apple/sourcekit-lsp/issues/84",
        repositoryNameWithOwner: "apple/sourcekit-lsp"
      }
    ],
    linkedIssuesAvailability: { status: "available", message: null },
    reviewThreads: [
      {
        id: numericId * 1000 + 901,
        path: "src/renderer/src/App.tsx",
        isResolved: null,
        isOutdated: null,
        comments: [
          {
            id: numericId * 1000 + 901,
            reviewId: numericId * 1000 + 701,
            authorLogin: "reviewer",
            authorAvatarUrl: avatar,
            body: "Can this be a typed helper?",
            path: "src/renderer/src/App.tsx",
            diffHunk: "@@ -1,3 +1,3 @@",
            position: 4,
            originalPosition: 4,
            startLine: null,
            line: 44,
            side: "RIGHT",
            inReplyToId: null,
            createdAt: pull.updatedAt,
            updatedAt: pull.updatedAt,
            htmlUrl: `${pull.htmlUrl}#discussion_r${numericId * 1000 + 901}`
          },
          {
            id: numericId * 1000 + 902,
            reviewId: numericId * 1000 + 701,
            authorLogin: "slightbug",
            authorAvatarUrl: avatar,
            body: "Done in the follow-up commit.",
            path: "src/renderer/src/App.tsx",
            diffHunk: "@@ -1,3 +1,3 @@",
            position: null,
            originalPosition: 4,
            startLine: null,
            line: 44,
            side: "RIGHT",
            inReplyToId: numericId * 1000 + 901,
            createdAt: pull.updatedAt,
            updatedAt: pull.updatedAt,
            htmlUrl: `${pull.htmlUrl}#discussion_r${numericId * 1000 + 902}`
          }
        ]
      }
    ],
    timelineEvents: [
      {
        id: `${pull.id}-timeline-connected`,
        event: "connected",
        actorLogin: "applebot",
        actorAvatarUrl: avatar,
        createdAt: pull.updatedAt,
        commitSha: null,
        labelName: null,
        assigneeLogin: null,
        requestedReviewerLogin: null,
        requestedTeamName: null,
        milestoneTitle: null,
        renameFrom: null,
        renameTo: null,
        sourceIssue: {
          number: 1200,
          title: "Crash on build",
          htmlUrl: "https://github.com/apple/swift/issues/1200",
          repositoryNameWithOwner: "apple/swift"
        }
      }
    ],
    timelineAvailability: { status: "available", message: null }
  };
}

function readMockPullRequests(): PullRequestDetail[] {
  const storage = localStorageOrNull();
  const serialized = storage?.getItem(mockPullRequestsKey);
  if (!serialized) {
    return mockPullRequests.map(buildMockPullRequestDetail);
  }

  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? (parsed as PullRequestDetail[])
      : mockPullRequests.map(buildMockPullRequestDetail);
  } catch {
    return mockPullRequests.map(buildMockPullRequestDetail);
  }
}

function writeMockPullRequests(items: PullRequestDetail[]): void {
  writeMockArray(mockPullRequestsKey, items);
}

function listMockPullRequests(input?: {
  state?: "open" | "closed" | "all";
  limit?: number;
}): PullRequestSummary[] {
  const state = input?.state ?? "open";
  const pulls = readMockPullRequests().filter((pull) => state === "all" || pull.state === state);
  return pulls
    .slice(0, input?.limit ?? pulls.length)
    .map(
      ({
        body: _body,
        commentsList: _commentsList,
        files: _files,
        filesAvailability: _filesAvailability,
        commitsList: _commitsList,
        commitsAvailability: _commitsAvailability,
        requestedReviewers: _requestedReviewers,
        requestedTeams: _requestedTeams,
        reviews: _reviews,
        reviewsAvailability: _reviewsAvailability,
        latestReviewState: _latestReviewState,
        checks: _checks,
        checksAvailability: _checksAvailability,
        reviewThreads: _reviewThreads,
        timelineEvents: _timelineEvents,
        timelineAvailability: _timelineAvailability,
        ...pull
      }) => pull
    );
}

function nextMockPullCommentId(pulls: PullRequestDetail[]): number {
  return (
    Math.max(
      0,
      ...pulls.flatMap((pull) =>
        pull.commentsList
          .map((comment) => (typeof comment.id === "number" ? comment.id : null))
          .filter((id): id is number => id !== null)
      )
    ) + 1
  );
}

function mutateMockPullRequests(input: GitHubMutationInput): void {
  const payload = input.payload;
  const pullNumber = mockPayloadNumber(payload, "pullNumber");
  const issueNumber = mockPayloadNumber(payload, "issueNumber");
  const now = new Date().toISOString();

  if (input.action === "createPullRequest") {
    const title = mockPayloadString(payload, "title")?.trim();
    const head = mockPayloadString(payload, "head")?.trim();
    if (!title || !head) {
      return;
    }
    const pulls = readMockPullRequests();
    const nextNumber = Math.max(...pulls.map((pull) => pull.number), 520) + 1;
    const draft = mockPayloadBoolean(payload, "draft");
    const pullId = Date.now();
    const createdPull = buildMockPullRequestDetail({
      id: pullId,
      nodeId: `PR_mock_created_${pullId}`,
      number: nextNumber,
      title,
      state: "open",
      merged: false,
      mergedAt: null,
      isDraft: draft,
      authorLogin: "ashleyrico",
      authorAvatarUrl: avatar,
      comments: 0,
      reviewComments: 0,
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      mergeableState: "clean",
      reviewDecision: null,
      mergeCommitSha: null,
      maintainerCanModify: mockPayloadBoolean(payload, "maintainer_can_modify"),
      isCrossRepository: false,
      headRefName: head,
      baseRefName: mockPayloadString(payload, "base")?.trim() || "main",
      headRepositoryNameWithOwner: `${input.owner}/${input.repo}`,
      baseRepositoryNameWithOwner: `${input.owner}/${input.repo}`,
      createdAt: now,
      updatedAt: now,
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/pull/${nextNumber}`
    });
    writeMockPullRequests([
      {
        ...createdPull,
        body: mockPayloadString(payload, "body")?.trim() ?? "",
        commentsList: [],
        requestedReviewers: [],
        requestedTeams: [],
        reviews: [],
        latestReviewState: null,
        reviewThreads: [],
        timelineEvents: []
      },
      ...pulls
    ]);
    return;
  }

  const targetNumber = pullNumber ?? issueNumber;
  if (targetNumber === null) {
    return;
  }
  const currentPulls = readMockPullRequests();
  const nextCommentId = nextMockPullCommentId(currentPulls);
  const nextPulls = currentPulls.map((pull) => {
    if (pull.number !== targetNumber) {
      return pull;
    }

    if (input.action === "closePullRequest" || input.action === "reopenPullRequest") {
      if (input.action === "reopenPullRequest" && pull.merged) {
        return pull;
      }
      return {
        ...pull,
        state: input.action === "closePullRequest" ? "closed" : "open",
        updatedAt: now
      };
    }
    if (input.action === "mergePullRequest") {
      return {
        ...pull,
        state: "closed",
        mergeableState: "merged",
        merged: true,
        mergedAt: now,
        updatedAt: now
      };
    }
    if (input.action === "editIssue") {
      const milestoneNumber = typeof payload?.milestone === "number" ? payload.milestone : undefined;
      return {
        ...pull,
        milestone:
          milestoneNumber === undefined
            ? pull.milestone
            : (mockMilestones.find((milestone) => milestone.number === milestoneNumber) ?? null),
        updatedAt: now
      };
    }
    if (input.action === "addLabels") {
      const labels = mockPayloadStringArray(payload, "labels").map(mockLabelForName);
      const existingNames = new Set((pull.labels ?? []).map((label) => label.name.toLowerCase()));
      return {
        ...pull,
        labels: [
          ...(pull.labels ?? []),
          ...labels.filter((label) => !existingNames.has(label.name.toLowerCase()))
        ],
        updatedAt: now
      };
    }
    if (input.action === "removeLabel") {
      const name = mockPayloadString(payload, "name")?.trim().toLowerCase();
      return {
        ...pull,
        labels: name ? (pull.labels ?? []).filter((label) => label.name.toLowerCase() !== name) : pull.labels,
        updatedAt: now
      };
    }
    if (input.action === "setAssignees") {
      const assignees = mockPayloadStringArray(payload, "assignees").map(mockAssigneeForLogin);
      const existingLogins = new Set((pull.assignees ?? []).map((user) => user.login.toLowerCase()));
      return {
        ...pull,
        assignees: [
          ...(pull.assignees ?? []),
          ...assignees.filter((assignee) => !existingLogins.has(assignee.login.toLowerCase()))
        ],
        updatedAt: now
      };
    }
    if (input.action === "removeAssignees") {
      const logins = new Set(
        mockPayloadStringArray(payload, "assignees").map((login) => login.toLowerCase())
      );
      return {
        ...pull,
        assignees: (pull.assignees ?? []).filter((assignee) => !logins.has(assignee.login.toLowerCase())),
        updatedAt: now
      };
    }
    if (input.action === "requestReviewers") {
      const reviewers = mockPayloadStringArray(payload, "reviewers").map(mockAssigneeForLogin);
      const teams = mockPayloadStringArray(payload, "teamReviewers").map(mockTeamForSlug);
      const existingReviewers = new Set(
        pull.requestedReviewers.map((reviewer) => reviewer.login.toLowerCase())
      );
      const existingTeams = new Set(pull.requestedTeams.map((team) => team.slug.toLowerCase()));
      return {
        ...pull,
        requestedReviewers: [
          ...pull.requestedReviewers,
          ...reviewers.filter((reviewer) => !existingReviewers.has(reviewer.login.toLowerCase()))
        ],
        requestedTeams: [
          ...pull.requestedTeams,
          ...teams.filter((team) => !existingTeams.has(team.slug.toLowerCase()))
        ],
        updatedAt: now
      };
    }
    if (input.action === "removeReviewers") {
      const reviewers = new Set(
        mockPayloadStringArray(payload, "reviewers").map((login) => login.toLowerCase())
      );
      const teams = new Set(
        mockPayloadStringArray(payload, "teamReviewers").map((slug) => slug.toLowerCase())
      );
      return {
        ...pull,
        requestedReviewers: pull.requestedReviewers.filter(
          (reviewer) => !reviewers.has(reviewer.login.toLowerCase())
        ),
        requestedTeams: pull.requestedTeams.filter((team) => !teams.has(team.slug.toLowerCase())),
        updatedAt: now
      };
    }
    if (
      input.action === "approvePullRequest" ||
      input.action === "commentPullRequestReview" ||
      input.action === "requestChanges"
    ) {
      const state =
        input.action === "approvePullRequest"
          ? "APPROVED"
          : input.action === "commentPullRequestReview"
            ? "COMMENTED"
            : "CHANGES_REQUESTED";
      const body =
        mockPayloadString(payload, "body") ??
        (input.action === "approvePullRequest"
          ? "Approved from Control."
          : input.action === "commentPullRequestReview"
            ? "Reviewed from Control."
            : "Changes requested from Control.");
      const reviewId = Date.now();
      return {
        ...pull,
        reviews: [
          {
            id: reviewId,
            authorLogin: "ashleyrico",
            authorAvatarUrl: avatar,
            state,
            body,
            submittedAt: now,
            commitSha: pull.commitsList[0]?.sha ?? null,
            htmlUrl: `${pull.htmlUrl}#pullrequestreview-${reviewId}`
          },
          ...pull.reviews
        ],
        latestReviewState: state === "COMMENTED" ? pull.latestReviewState : state,
        updatedAt: now
      };
    }
    if (input.action === "addComment") {
      const body = mockPayloadString(payload, "body")?.trim();
      if (!body) {
        return pull;
      }
      return {
        ...pull,
        comments: pull.comments + 1,
        commentsList: [
          ...pull.commentsList,
          {
            id: nextCommentId,
            authorLogin: "ashleyrico",
            authorAvatarUrl: avatar,
            body,
            createdAt: now,
            updatedAt: now,
            htmlUrl: `${pull.htmlUrl}#issuecomment-${nextCommentId}`
          }
        ],
        updatedAt: now
      };
    }
    return pull;
  });
  writeMockPullRequests(nextPulls);
}

function mutateMockReleases(input: GitHubMutationInput): void {
  const payload = input.payload;
  if (input.action === "createRelease") {
    const tagName = mockPayloadString(payload, "tag_name")?.trim();
    if (!tagName) {
      return;
    }
    const draft = mockPayloadBoolean(payload, "draft");
    const prerelease = mockPayloadBoolean(payload, "prerelease");
    const createdRelease: ReleaseSummary = {
      id: Date.now(),
      name: mockPayloadString(payload, "name"),
      tagName,
      targetCommitish: mockPayloadString(payload, "target_commitish") ?? "main",
      body: mockPayloadString(payload, "body"),
      isDraft: draft,
      isPrerelease: prerelease,
      publishedAt: draft ? null : new Date().toISOString(),
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/releases/tag/${encodeURIComponent(tagName)}`,
      assets: []
    };
    writeMockReleases([createdRelease, ...readMockReleases()]);
    return;
  }

  if (input.action === "editRelease") {
    const releaseId = typeof payload?.releaseId === "number" ? payload.releaseId : null;
    if (releaseId === null) {
      return;
    }
    const draft = mockPayloadBoolean(payload, "draft");
    const nextReleases = readMockReleases().map((release) =>
      release.id === releaseId
        ? {
            ...release,
            name: mockPayloadString(payload, "name"),
            tagName: mockPayloadString(payload, "tag_name") ?? release.tagName,
            targetCommitish: mockPayloadString(payload, "target_commitish") ?? release.targetCommitish,
            body: mockPayloadString(payload, "body") ?? release.body,
            isDraft: draft,
            isPrerelease: mockPayloadBoolean(payload, "prerelease"),
            publishedAt: draft ? null : (release.publishedAt ?? new Date().toISOString())
          }
        : release
    );
    writeMockReleases(nextReleases);
    return;
  }

  if (input.action === "deleteRelease") {
    const releaseId = typeof payload?.releaseId === "number" ? payload.releaseId : null;
    if (releaseId === null) {
      return;
    }
    writeMockReleases(readMockReleases().filter((release) => release.id !== releaseId));
  }
}

function mockWorkflowActionAvailability(
  run: WorkflowRunSummary
): NonNullable<WorkflowRunSummary["actionAvailability"]> {
  const completed = run.status === null ? null : run.status === "completed";
  const failed = run.conclusion === null ? null : run.conclusion === "failure";
  const rerunUrl = `${run.htmlUrl}/rerun`;
  const rerunFailedJobsUrl = `${run.htmlUrl}/rerun-failed-jobs`;
  const cancelUrl = `${run.htmlUrl}/cancel`;
  const previousAttemptUrl = run.actionAvailability?.previousAttemptUrl
    ? run.actionAvailability.previousAttemptUrl
    : null;

  return {
    canRerun: completed === null ? null : completed,
    canRerunFailedJobs: completed === null || failed === null ? null : completed && failed,
    canCancel: completed === null ? null : !completed,
    rerunUrl,
    rerunFailedJobsUrl,
    cancelUrl,
    previousAttemptUrl:
      previousAttemptUrl && run.runAttempt && run.runAttempt > 1
        ? `${run.htmlUrl}/attempts/${run.runAttempt - 1}`
        : null
  };
}

function buildMockWorkflowRunDetail(run: WorkflowRunSummary): WorkflowRunDetail {
  const failed = run.conclusion === "failure";
  const completed = run.status === "completed";
  const queued = run.status === "queued";
  const jobStatus = completed ? "completed" : queued ? "queued" : "in_progress";
  const jobConclusion = completed ? run.conclusion : null;

  return {
    ...run,
    actionAvailability: mockWorkflowActionAvailability(run),
    jobs: queued
      ? []
      : [
          {
            id: run.id * 10 + 100,
            name: run.name === "Docs" ? "Docs build" : "macOS build",
            status: jobStatus,
            conclusion: jobConclusion,
            startedAt: run.createdAt,
            completedAt: completed ? run.updatedAt : null,
            htmlUrl: `${run.htmlUrl}/job/${run.id * 10 + 100}`,
            runnerName: run.name === "Docs" ? "ubuntu-24.04" : "macos-15",
            labels: run.name === "Docs" ? ["ubuntu", "x64"] : ["macos", "x64"],
            steps: [
              {
                name: "Checkout",
                status: jobStatus,
                conclusion: completed ? "success" : null,
                number: 1,
                startedAt: run.createdAt,
                completedAt: completed ? run.updatedAt : null
              },
              {
                name: run.name === "Docs" ? "Build docs" : "Build compiler",
                status: jobStatus,
                conclusion: jobConclusion,
                number: 2,
                startedAt: run.createdAt,
                completedAt: completed ? run.updatedAt : null
              }
            ]
          }
        ],
    jobsAvailability: { status: "available", message: null },
    artifacts:
      completed && run.conclusion !== "cancelled"
        ? [
            {
              id: run.id * 10 + 200,
              name: failed ? "build-logs" : "build-output",
              sizeInBytes: failed ? 20480 : 40960,
              expired: false,
              createdAt: run.updatedAt,
              updatedAt: run.updatedAt,
              expiresAt: new Date(Date.now() + 604_800_000).toISOString(),
              archiveDownloadUrl: `https://pipelines.actions.githubusercontent.com/artifacts/${run.id * 10 + 200}.zip`,
              archiveDownloadAvailability: { status: "available", message: null }
            }
          ]
        : [],
    artifactsAvailability: { status: "available", message: null },
    checkSuites: queued
      ? []
      : [
          {
            id: run.id * 10 + 300,
            status: run.status,
            conclusion: run.conclusion,
            headBranch: run.branch,
            headSha: run.commitSha,
            beforeSha: "123456abcdef",
            afterSha: run.commitSha,
            appName: "GitHub Actions",
            appSlug: "github-actions",
            appHtmlUrl: "https://github.com/apps/github-actions",
            latestCheckRunCount: 1,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt
          }
        ],
    checkSuitesAvailability: { status: "available", message: null },
    checkRuns: queued
      ? []
      : [
          {
            id: run.id * 10 + 400,
            name: run.name === "Docs" ? "Docs build" : "Swift build",
            status: run.status,
            conclusion: run.conclusion,
            startedAt: run.createdAt,
            completedAt: completed ? run.updatedAt : null,
            htmlUrl: `${run.htmlUrl}/job/${run.id * 10 + 100}`,
            detailsUrl: `${run.htmlUrl}/job/${run.id * 10 + 100}`,
            checkSuiteId: run.id * 10 + 300,
            appName: "GitHub Actions",
            appSlug: "github-actions",
            appHtmlUrl: "https://github.com/apps/github-actions",
            outputTitle: failed
              ? "Swift build failed"
              : completed
                ? `${run.name} passed`
                : `${run.name} running`,
            outputSummary: failed
              ? "Compiler tests failed on macOS."
              : completed
                ? "All workflow checks passed."
                : "Workflow run is still in progress.",
            outputText: failed ? "See the failing build step for details." : null,
            annotationsCount: failed ? 1 : 0,
            annotations: failed
              ? [
                  {
                    path: "Sources/Compiler/main.swift",
                    startLine: 42,
                    endLine: 42,
                    annotationLevel: "failure",
                    title: "Compiler test failed",
                    message: "Expected diagnostics did not match.",
                    rawDetails: "Assertion failed in diagnostics test.",
                    blobHref: "https://github.com/apple/swift/blob/main/Sources/Compiler/main.swift#L42"
                  }
                ]
              : [],
            annotationsAvailability: { status: "available", message: null }
          }
        ],
    checkRunsAvailability: { status: "available", message: null },
    logs: {
      apiUrl: completed ? `https://api.github.com/repos/apple/swift/actions/runs/${run.id}/logs` : null,
      downloadUrl: completed ? "https://pipelines.actions.githubusercontent.com/logs.zip" : null,
      available: completed,
      message: completed ? null : "Logs become available after the run completes.",
      availability: completed
        ? { status: "available", message: null }
        : {
            status: "feature_disabled",
            message: "Logs become available after the run completes."
          }
    }
  };
}

function readMockWorkflowRuns(): WorkflowRunDetail[] {
  const storage = localStorageOrNull();
  const serialized = storage?.getItem(mockWorkflowRunsKey);
  if (!serialized) {
    return mockActions.map(buildMockWorkflowRunDetail);
  }

  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? (parsed as WorkflowRunDetail[])
      : mockActions.map(buildMockWorkflowRunDetail);
  } catch {
    return mockActions.map(buildMockWorkflowRunDetail);
  }
}

function writeMockWorkflowRuns(items: WorkflowRunDetail[]): void {
  writeMockArray(mockWorkflowRunsKey, items);
}

function mockWorkflowJobLogs(jobId: number): WorkflowJobLogsResult {
  const text = [
    "2026-05-05T17:01:14.000Z Checkout repository",
    "2026-05-05T17:01:20.000Z Restore build cache",
    "2026-05-05T17:02:31.000Z Build compiler",
    "2026-05-05T17:07:42.000Z error: Expected diagnostics did not match.",
    "2026-05-05T17:07:42.000Z Sources/Compiler/main.swift:42: failed assertion",
    "2026-05-05T17:07:45.000Z Upload build logs"
  ].join("\n");

  return {
    jobId,
    text,
    truncated: false,
    downloadUrl: "https://pipelines.actions.githubusercontent.com/job-log.txt",
    availability: { status: "available", message: null }
  };
}

function listMockWorkflowRuns(input?: { limit?: number }): WorkflowRunSummary[] {
  return readMockWorkflowRuns()
    .slice(0, input?.limit ?? 20)
    .map(
      ({
        jobs: _jobs,
        artifacts: _artifacts,
        checkSuites: _checkSuites,
        checkRuns: _checkRuns,
        logs: _logs,
        ...run
      }) => run
    );
}

function updateMockWorkflowRunState(
  run: WorkflowRunDetail,
  status: string | null,
  conclusion: string | null,
  updatedAt: string
): WorkflowRunDetail {
  return buildMockWorkflowRunDetail({
    id: run.id,
    name: run.name,
    displayTitle: run.displayTitle,
    runNumber: run.runNumber,
    runAttempt: run.runAttempt,
    event: run.event,
    status,
    conclusion,
    branch: run.branch,
    commitSha: run.commitSha,
    headRepositoryNameWithOwner: run.headRepositoryNameWithOwner,
    actorLogin: run.actorLogin,
    actorAvatarUrl: run.actorAvatarUrl,
    triggeringActorLogin: run.triggeringActorLogin,
    runStartedAt: run.runStartedAt,
    createdAt: run.createdAt,
    updatedAt,
    htmlUrl: run.htmlUrl
  });
}

function mutateMockWorkflowRuns(input: GitHubMutationInput): void {
  const payload = input.payload;
  const now = new Date().toISOString();

  if (input.action === "dispatchWorkflow") {
    const workflowId = mockPayloadString(payload, "workflowId")?.trim();
    const ref = mockPayloadString(payload, "ref")?.trim() || "main";
    if (!workflowId) {
      return;
    }
    const workflow =
      mockWorkflows.find(
        (item) => item.path === workflowId || item.name === workflowId || String(item.id) === workflowId
      ) ?? mockWorkflows[0];
    const runId = Date.now();
    const run = buildMockWorkflowRunDetail({
      id: runId,
      name: workflow.name,
      displayTitle: `Manual ${workflow.name}`,
      runNumber: runId,
      runAttempt: 1,
      event: "workflow_dispatch",
      status: "queued",
      conclusion: null,
      branch: ref,
      commitSha: null,
      headRepositoryNameWithOwner: `${input.owner}/${input.repo}`,
      actorLogin: "ashleyrico",
      actorAvatarUrl: avatar,
      triggeringActorLogin: "ashleyrico",
      runStartedAt: now,
      createdAt: now,
      updatedAt: now,
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/actions/runs/${runId}`
    });
    writeMockWorkflowRuns([run, ...readMockWorkflowRuns()]);
    return;
  }

  const runId = mockPayloadNumber(payload, "runId");
  const jobId = mockPayloadNumber(payload, "jobId");
  if (runId === null && jobId === null) {
    return;
  }

  const runs = readMockWorkflowRuns();
  const nextRuns = runs.map((run) => {
    const runMatches = runId !== null && run.id === runId;
    const jobMatches = jobId !== null && run.jobs.some((job) => job.id === jobId);
    if (!runMatches && !jobMatches) {
      return run;
    }

    if (
      input.action === "rerunWorkflow" ||
      input.action === "rerunFailedWorkflowJobs" ||
      input.action === "rerunWorkflowJob"
    ) {
      return updateMockWorkflowRunState(run, "queued", null, now);
    }
    if (input.action === "cancelWorkflow") {
      return updateMockWorkflowRunState(run, "completed", "cancelled", now);
    }
    return run;
  });
  writeMockWorkflowRuns(nextRuns);
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

function mockRepositoryDetail(input: { owner: string; repo: string }): RepositoryDetail {
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

function mockRepositoryForks(input: { owner: string; repo: string; limit?: number }): RepositoryRef[] {
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

export const mockOrganizations: OrganizationSummary[] = [
  {
    id: "O_apple",
    login: "apple",
    name: "Apple",
    description: "Open source projects from Apple.",
    avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
    htmlUrl: "https://github.com/apple",
    websiteUrl: "https://opensource.apple.com",
    location: "Cupertino, CA",
    repositoryCount: 188,
    teamCount: 14,
    viewerIsMember: true,
    viewerMembershipRole: "member",
    viewerMembershipState: "active",
    viewerMembershipAvailability: { status: "available", message: null },
    viewerCanAdminister: false,
    viewerCanCreateRepositories: false,
    viewerCanCreateTeams: false
  },
  {
    id: "O_swiftlang",
    login: "swiftlang",
    name: "Swift",
    description: "The Swift project organization.",
    avatarUrl: "https://avatars.githubusercontent.com/u/42816656?v=4",
    htmlUrl: "https://github.com/swiftlang",
    websiteUrl: "https://swift.org",
    location: null,
    repositoryCount: 64,
    teamCount: 8,
    viewerIsMember: true,
    viewerMembershipRole: "admin",
    viewerMembershipState: "active",
    viewerMembershipAvailability: { status: "available", message: null },
    viewerCanAdminister: false,
    viewerCanCreateRepositories: true,
    viewerCanCreateTeams: false
  }
];

export const mockTeams: TeamSummary[] = [
  {
    id: "T_compiler",
    databaseId: 101,
    organizationLogin: "apple",
    name: "Compiler",
    slug: "compiler",
    description: "Maintains the Swift compiler and language implementation.",
    privacy: "closed",
    permission: "push",
    notificationSetting: "notifications_enabled",
    memberCount: 18,
    repositoryCount: 12,
    htmlUrl: "https://github.com/orgs/apple/teams/compiler",
    parent: null,
    createdAt: "2026-01-10T12:00:00.000Z",
    updatedAt: "2026-05-03T12:00:00.000Z"
  },
  {
    id: "T_tooling",
    databaseId: 102,
    organizationLogin: "apple",
    name: "Developer Tools",
    slug: "developer-tools",
    description: "Coordinates package manager, IDE, and tooling repositories.",
    privacy: "secret",
    permission: "admin",
    notificationSetting: "notifications_enabled",
    memberCount: 9,
    repositoryCount: 7,
    htmlUrl: "https://github.com/orgs/apple/teams/developer-tools",
    parent: {
      id: "T_compiler",
      name: "Compiler",
      slug: "compiler",
      htmlUrl: "https://github.com/orgs/apple/teams/compiler"
    },
    createdAt: "2026-02-10T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z"
  }
];

export const mockTeamMembers: Record<string, TeamMemberSummary[]> = {
  compiler: [
    {
      id: "U_compiler_1",
      login: "swift-ci",
      avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
      htmlUrl: "https://github.com/swift-ci",
      siteAdmin: false
    },
    {
      id: "U_compiler_2",
      login: "apple-compiler-admin",
      avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
      htmlUrl: "https://github.com/apple-compiler-admin",
      siteAdmin: false
    }
  ],
  "developer-tools": [
    {
      id: "U_tools_1",
      login: "xcode-tools",
      avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
      htmlUrl: "https://github.com/xcode-tools",
      siteAdmin: false
    },
    {
      id: "U_tools_2",
      login: "swiftpm-maintainer",
      avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
      htmlUrl: "https://github.com/swiftpm-maintainer",
      siteAdmin: false
    }
  ]
};

export const mockOrganizationMembers: Record<string, OrganizationMemberSummary[]> = {
  apple: [
    {
      id: "U_apple_1",
      login: "swift-ci",
      avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
      htmlUrl: "https://github.com/swift-ci",
      siteAdmin: false
    },
    {
      id: "U_apple_2",
      login: "apple-oss-maintainer",
      avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
      htmlUrl: "https://github.com/apple-oss-maintainer",
      siteAdmin: false
    },
    {
      id: "U_apple_3",
      login: "swiftpm-maintainer",
      avatarUrl: "https://avatars.githubusercontent.com/u/10639145?v=4",
      htmlUrl: "https://github.com/swiftpm-maintainer",
      siteAdmin: false
    }
  ],
  swiftlang: [
    {
      id: "U_swiftlang_1",
      login: "swiftlang-admin",
      avatarUrl: "https://avatars.githubusercontent.com/u/42816656?v=4",
      htmlUrl: "https://github.com/swiftlang-admin",
      siteAdmin: false
    },
    {
      id: "U_swiftlang_2",
      login: "swift-evolution",
      avatarUrl: "https://avatars.githubusercontent.com/u/42816656?v=4",
      htmlUrl: "https://github.com/swift-evolution",
      siteAdmin: false
    }
  ]
};

export const mockTeamRepositories: Record<string, OrganizationTeamRepositorySummary[]> = {
  compiler: mockRepositories.slice(0, 2).map((repository, index) => ({
    id: `TR_compiler_${repository.id}`,
    owner: repository.owner,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate,
    permission: index === 0 ? "ADMIN" : "WRITE",
    htmlUrl: `https://github.com/${repository.nameWithOwner}`,
    defaultBranch: repository.defaultBranch,
    updatedAt: repository.updatedAt,
    pushedAt: repository.pushedAt
  })),
  "developer-tools": mockRepositories.slice(1, 3).map((repository) => ({
    id: `TR_tools_${repository.id}`,
    owner: repository.owner,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate,
    permission: "MAINTAIN",
    htmlUrl: `https://github.com/${repository.nameWithOwner}`,
    defaultBranch: repository.defaultBranch,
    updatedAt: repository.updatedAt,
    pushedAt: repository.pushedAt
  }))
};

export const mockOrganizationRepositories: Record<string, OrganizationRepositorySummary[]> = {
  apple: mockRepositories.slice(0, 4).map((repository, index) => ({
    id: `OR_apple_${repository.id}`,
    owner: repository.owner,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    description: repository.description,
    visibility: repository.visibility,
    isPrivate: repository.isPrivate,
    permission: index === 0 ? "ADMIN" : index === 1 ? "MAINTAIN" : "READ",
    htmlUrl: `https://github.com/${repository.nameWithOwner}`,
    defaultBranch: repository.defaultBranch,
    updatedAt: repository.updatedAt,
    pushedAt: repository.pushedAt
  }))
};

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
  lastCommitSha: `abcdef${index}`,
  lastCommitMessage: message,
  lastCommitAuthorLogin: index % 2 === 0 ? "swift-ci" : "compiler-team",
  lastCommitAuthorName: index % 2 === 0 ? "Swift CI" : "Compiler Team",
  lastCommitAuthorAvatarUrl: avatar,
  lastAuthoredDate: date,
  lastCommittedDate: date,
  lastCommitDate: date,
  lastCommitHtmlUrl: `https://github.com/apple/swift/commit/abcdef${index}`,
  lastCommitAdditions: null,
  lastCommitDeletions: null,
  lastCommitChanges: null,
  lastCommitAvailability: { status: "available", message: null }
}));

function mockFileBlame(path: string, ref: string | null | undefined): RepoFileBlameResult {
  return {
    path,
    ref: ref ?? mockRepository.defaultBranch,
    truncated: false,
    availability: { status: "available", message: null },
    ranges: [
      {
        startingLine: 1,
        endingLine: 8,
        age: 1,
        commit: {
          sha: "7f3a2c9d0e111111111111111111111111111111",
          headline: "Add Sendable support for @MainActor types",
          authorLogin: "slightbug",
          authorName: "Slight Bug",
          authorAvatarUrl: avatar,
          authoredDate: "2026-05-03T20:00:00Z",
          committedDate: "2026-05-03T20:05:00Z",
          htmlUrl: "https://github.com/apple/swift/commit/7f3a2c9d0e111111111111111111111111111111"
        }
      },
      {
        startingLine: 9,
        endingLine: 18,
        age: 2,
        commit: {
          sha: "b1d2f70a91111111111111111111111111111111",
          headline: "Update documentation examples",
          authorLogin: "compiler-team",
          authorName: "Compiler Team",
          authorAvatarUrl: avatar,
          authoredDate: "2026-05-02T14:00:00Z",
          committedDate: "2026-05-02T14:10:00Z",
          htmlUrl: "https://github.com/apple/swift/commit/b1d2f70a91111111111111111111111111111111"
        }
      }
    ]
  };
}

function mockRepositoryWiki(pagePath?: string | null, limit?: number): RepositoryWikiResult {
  const allPages = [
    {
      path: "Home.md",
      title: "Home",
      sha: "wiki-home",
      size: 980,
      htmlUrl: "https://github.com/apple/swift/wiki/Home"
    },
    {
      path: "Contributor-Guide.md",
      title: "Contributor Guide",
      sha: "wiki-contributor-guide",
      size: 1420,
      htmlUrl: "https://github.com/apple/swift/wiki/Contributor-Guide"
    },
    {
      path: "Release-Checklist.md",
      title: "Release Checklist",
      sha: "wiki-release-checklist",
      size: 1180,
      htmlUrl: "https://github.com/apple/swift/wiki/Release-Checklist"
    }
  ];
  const pages = allPages.slice(0, limit ?? allPages.length);
  const selectedPage = allPages.find((page) => page.path === pagePath) ?? pages[0] ?? allPages[0];

  return {
    pages,
    selectedPage: {
      ...selectedPage,
      markdown: `# ${selectedPage.title}\n\nMock wiki content for ${selectedPage.title}.\n\n- Review repository settings\n- Confirm Actions status\n- Update release notes`
    },
    availability: { status: "available", message: null }
  };
}

export const mockCommits: RepositoryCommitSummary[] = [
  {
    sha: "7f3a2c9d0e111111111111111111111111111111",
    message:
      "Add Sendable support for @MainActor types\n\nIncludes runtime coverage for actor-isolated values.",
    headline: "Add Sendable support for @MainActor types",
    authorLogin: "slightbug",
    authorName: "Slight Bug",
    authorAvatarUrl: avatar,
    committerLogin: "swift-ci",
    committerName: "Swift CI",
    committerAvatarUrl: avatar,
    authoredDate: "2026-05-03T20:00:00Z",
    committedDate: "2026-05-03T20:15:00Z",
    htmlUrl: "https://github.com/apple/swift/commit/7f3a2c9d0",
    parentCount: 1,
    verificationReason: "valid",
    verified: true
  },
  {
    sha: "3b8f90aa0e222222222222222222222222222222",
    message: "Update concurrency runtime tests",
    headline: "Update concurrency runtime tests",
    authorLogin: "compiler-team",
    authorName: "Compiler Team",
    authorAvatarUrl: avatar,
    committerLogin: "swift-ci",
    committerName: "Swift CI",
    committerAvatarUrl: avatar,
    authoredDate: "2026-05-03T18:00:00Z",
    committedDate: "2026-05-03T18:20:00Z",
    htmlUrl: "https://github.com/apple/swift/commit/3b8f90aa0",
    parentCount: 1,
    verificationReason: "valid",
    verified: true
  },
  {
    sha: "9ad551bb0e333333333333333333333333333333",
    message: "Add documentation for region based isolation",
    headline: "Add documentation for region based isolation",
    authorLogin: "swift-ci",
    authorName: "Swift CI",
    authorAvatarUrl: avatar,
    committerLogin: "swift-ci",
    committerName: "Swift CI",
    committerAvatarUrl: avatar,
    authoredDate: "2026-05-03T17:00:00Z",
    committedDate: "2026-05-03T17:05:00Z",
    htmlUrl: "https://github.com/apple/swift/commit/9ad551bb0",
    parentCount: 2,
    verificationReason: "valid",
    verified: true
  }
];

export const mockBranches: BranchSummary[] = [
  { name: "main", commitSha: "abcdefmain", protected: true },
  { name: "release/6.0", commitSha: "abcdefrel", protected: true },
  { name: "feature/sendable", commitSha: "abcdeffeat", protected: false }
];

export const mockTags: TagSummary[] = [
  {
    name: "swift-6.0",
    commitSha: "abcdeftag1",
    zipballUrl: "https://github.com/apple/swift/zipball/refs/tags/swift-6.0",
    tarballUrl: "https://github.com/apple/swift/tarball/refs/tags/swift-6.0"
  },
  {
    name: "swift-5.10",
    commitSha: "abcdeftag2",
    zipballUrl: "https://github.com/apple/swift/zipball/refs/tags/swift-5.10",
    tarballUrl: "https://github.com/apple/swift/tarball/refs/tags/swift-5.10"
  }
];

export const mockTree: RepoTreeResult = {
  ref: "main",
  truncated: false,
  entries: [
    {
      path: ".github/workflows/ci.yml",
      type: "file",
      sha: "tree-ci",
      size: 2048,
      htmlUrl: "https://github.com/apple/swift/blob/main/.github/workflows/ci.yml"
    },
    {
      path: "README.md",
      type: "file",
      sha: "tree-readme",
      size: 4096,
      htmlUrl: "https://github.com/apple/swift/blob/main/README.md"
    },
    {
      path: "documentation",
      type: "dir",
      sha: "tree-docs",
      size: null,
      htmlUrl: "https://github.com/apple/swift/tree/main/documentation"
    }
  ]
};

export const mockIssues: IssueSummary[] = Array.from({ length: 18 }, (_, index) => ({
  id: index + 1,
  nodeId: `I_mock_issue_${index + 1}`,
  number: 1200 - index,
  title:
    index % 3 === 0 ? "Improve Sendable diagnostics for global actors" : "Compiler crash in async closure",
  state: index % 5 === 0 ? "closed" : "open",
  stateReason: index % 5 === 0 ? (index % 10 === 0 ? "completed" : "not_planned") : null,
  authorLogin: index % 2 === 0 ? "slightbug" : "swift-ci",
  authorAvatarUrl: avatar,
  comments: 2 + index,
  labels: [{ id: `kind-${index}`, name: index % 2 === 0 ? "compiler" : "concurrency", color: "0969da" }],
  assignees:
    index % 3 === 0
      ? [
          {
            id: `U_assignee_${index}`,
            login: index % 2 === 0 ? "slightbug" : "swift-ci",
            avatarUrl: avatar,
            htmlUrl: `https://github.com/${index % 2 === 0 ? "slightbug" : "swift-ci"}`
          }
        ]
      : [],
  milestone:
    index % 4 === 0
      ? {
          id: `M_swift_6_${index}`,
          number: 6,
          title: "Swift 6 readiness",
          description: "Language mode readiness work",
          state: "open",
          dueOn: "2026-09-01T00:00:00.000Z",
          createdAt: "2026-01-10T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
          closedAt: null,
          htmlUrl: `https://github.com/apple/swift/milestone/${index + 1}`,
          openIssues: 42,
          closedIssues: 18
        }
      : null,
  createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/issues/${1200 - index}`
}));

export const mockLabels: LabelSummary[] = [
  { id: "L_bug", name: "bug", color: "d73a4a", description: "Something is not working" },
  { id: "L_compiler", name: "compiler", color: "0969da", description: "Compiler implementation" },
  { id: "L_concurrency", name: "concurrency", color: "6f42c1", description: "Concurrency model" }
];

export const mockMilestones: MilestoneSummary[] = [
  {
    id: "M_swift_6",
    number: 6,
    title: "Swift 6 readiness",
    description: "Language mode readiness work",
    state: "open",
    dueOn: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    closedAt: null,
    htmlUrl: "https://github.com/apple/swift/milestone/6",
    openIssues: 42,
    closedIssues: 18
  },
  {
    id: "M_quality",
    number: 7,
    title: "Compiler quality",
    description: "Crash fixes and diagnostics polish",
    state: "open",
    dueOn: "2026-10-15T00:00:00.000Z",
    createdAt: "2026-02-12T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    closedAt: null,
    htmlUrl: "https://github.com/apple/swift/milestone/7",
    openIssues: 31,
    closedIssues: 9
  }
];

export const mockAssignableUsers: AssignableUserSummary[] = [
  {
    id: "U_slightbug",
    login: "slightbug",
    avatarUrl: avatar,
    htmlUrl: "https://github.com/slightbug"
  },
  {
    id: "U_swift_ci",
    login: "swift-ci",
    avatarUrl: avatar,
    htmlUrl: "https://github.com/swift-ci"
  }
];

export const mockRepositoryCollaborators: RepositoryCollaboratorSummary[] = [
  {
    id: "U_slightbug",
    login: "slightbug",
    avatarUrl: avatar,
    htmlUrl: "https://github.com/slightbug",
    type: "User",
    siteAdmin: false,
    roleName: "maintain",
    permissions: {
      admin: false,
      maintain: true,
      push: true,
      triage: true,
      pull: true
    }
  },
  {
    id: "U_swift_ci",
    login: "swift-ci",
    avatarUrl: avatar,
    htmlUrl: "https://github.com/swift-ci",
    type: "Bot",
    siteAdmin: false,
    roleName: "write",
    permissions: {
      admin: false,
      maintain: false,
      push: true,
      triage: true,
      pull: true
    }
  }
];

export const mockPullRequests: PullRequestSummary[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  nodeId: `PR_mock_pull_${index + 1}`,
  number: 520 - index,
  title: index % 2 === 0 ? "Add Sendable support for @MainActor types" : "Update concurrency runtime tests",
  state: index % 4 === 0 ? "closed" : "open",
  merged: index % 4 === 0,
  mergedAt: index % 4 === 0 ? new Date(Date.now() - index * 7_000_000).toISOString() : null,
  isDraft: index === 3,
  authorLogin: index % 2 === 0 ? "slightbug" : "applebot",
  authorAvatarUrl: avatar,
  comments: 4 + index,
  reviewComments: 2 + index,
  additions: 125 + index * 3,
  deletions: 40 + index,
  changedFiles: 5 + index,
  mergeableState: index % 2 === 0 ? "clean" : "unstable",
  reviewDecision: index % 3 === 0 ? "APPROVED" : index % 3 === 1 ? "REVIEW_REQUIRED" : null,
  mergeCommitSha: index % 4 === 0 ? `abc1234${index}def5678${index}` : null,
  maintainerCanModify: index % 5 === 0 ? false : true,
  isCrossRepository: index % 4 === 1,
  headRefName: `feature/sendable-${index}`,
  baseRefName: "main",
  headRepositoryNameWithOwner: index % 4 === 1 ? `slightbug/swift` : "apple/swift",
  baseRepositoryNameWithOwner: "apple/swift",
  createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 7_200_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/pull/${520 - index}`
}));

export const mockNotifications: NotificationSummary[] = [
  {
    id: "notification-1",
    unread: true,
    reason: "mention",
    updatedAt: new Date(Date.now() - 1_200_000).toISOString(),
    lastReadAt: null,
    participating: true,
    threadUrl: "https://api.github.com/notifications/threads/notification-1",
    subscriptionUrl: "https://api.github.com/notifications/threads/notification-1/subscription",
    subscribed: true,
    ignored: false,
    subscriptionReason: "mention",
    subscriptionCreatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    repositoryNameWithOwner: "apple/swift",
    repositoryHtmlUrl: "https://github.com/apple/swift",
    repositoryPrivate: false,
    subject: {
      title: "Improve Sendable diagnostics for global actors",
      type: "Issue",
      apiUrl: "https://api.github.com/repos/apple/swift/issues/1200",
      latestCommentApiUrl: "https://api.github.com/repos/apple/swift/issues/comments/1",
      latestCommentHtmlUrl: "https://github.com/apple/swift/issues/1200#issuecomment-1",
      htmlUrl: "https://github.com/apple/swift/issues/1200"
    },
    htmlUrl: "https://github.com/apple/swift/issues/1200"
  },
  {
    id: "notification-2",
    unread: false,
    reason: "review_requested",
    updatedAt: new Date(Date.now() - 7_200_000).toISOString(),
    lastReadAt: new Date(Date.now() - 3_600_000).toISOString(),
    participating: null,
    threadUrl: "https://api.github.com/notifications/threads/notification-2",
    subscriptionUrl: "https://api.github.com/notifications/threads/notification-2/subscription",
    subscribed: false,
    ignored: true,
    subscriptionReason: "review_requested",
    subscriptionCreatedAt: new Date(Date.now() - 172_800_000).toISOString(),
    repositoryNameWithOwner: "apple/swift",
    repositoryHtmlUrl: "https://github.com/apple/swift",
    repositoryPrivate: false,
    subject: {
      title: "Add Sendable support for @MainActor types",
      type: "PullRequest",
      apiUrl: "https://api.github.com/repos/apple/swift/pulls/520",
      latestCommentApiUrl: "https://api.github.com/repos/apple/swift/issues/comments/2",
      latestCommentHtmlUrl: "https://github.com/apple/swift/pull/520#issuecomment-2",
      htmlUrl: "https://github.com/apple/swift/pull/520"
    },
    htmlUrl: "https://github.com/apple/swift/pull/520"
  }
];

export const mockDiscussions: DiscussionSummary[] = Array.from({ length: 8 }, (_, index) => ({
  id: `D_${index}`,
  number: 200 + index,
  title: index % 2 === 0 ? "Swift 6 concurrency migration notes" : "Package manager ergonomics",
  authorLogin: index % 2 === 0 ? "swiftlang" : "community",
  authorAvatarUrl: null,
  category: index % 2 === 0 ? "Announcements" : "Q&A",
  body:
    index % 2 === 0
      ? "Tracking the migration notes and follow-up work for packages adopting Swift 6 concurrency."
      : "Collecting feedback on the package manager workflows that still take too many steps.",
  createdAt: new Date(Date.now() - index * 7_200_000).toISOString(),
  comments: 10 + index * 2,
  previewComments: [
    {
      id: `DC_${index}_1`,
      authorLogin: "maintainer",
      authorAvatarUrl: null,
      body: "This is now captured in the planning thread. Keep adding concrete migration examples here.",
      createdAt: new Date(Date.now() - index * 5_000_000).toISOString(),
      updatedAt: new Date(Date.now() - index * 5_000_000).toISOString(),
      htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}#discussioncomment-${index}1`
    },
    {
      id: `DC_${index}_2`,
      authorLogin: "contributor",
      authorAvatarUrl: null,
      body: "The latest nightly helped here, but the diagnostics still point at the wrong package target.",
      createdAt: new Date(Date.now() - index * 4_200_000).toISOString(),
      updatedAt: new Date(Date.now() - index * 4_200_000).toISOString(),
      htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}#discussioncomment-${index}2`
    }
  ],
  previewCommentsTruncated: true,
  answer:
    index % 2 === 1
      ? {
          id: `DCA_${index}`,
          authorLogin: "swiftlang",
          authorAvatarUrl: null,
          body: "Use the new package manifest setting and clear the derived data cache after upgrading.",
          createdAt: new Date(Date.now() - index * 4_000_000).toISOString(),
          updatedAt: new Date(Date.now() - index * 4_000_000).toISOString(),
          htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}#discussioncomment-answer-${index}`
        }
      : null,
  isAnswered: index % 2 === 1,
  upvotes: 14 + index,
  closed: false,
  locked: index === 3,
  updatedAt: new Date(Date.now() - index * 5_400_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/discussions/${200 + index}`
}));

export const mockDiscussionCategories: DiscussionCategorySummary[] = [
  {
    id: "DIC_announcements",
    name: "Announcements",
    emoji: ":mega:",
    description: "Project announcements and release notes",
    isAnswerable: false
  },
  {
    id: "DIC_qna",
    name: "Q&A",
    emoji: ":question:",
    description: "Questions that can have an accepted answer",
    isAnswerable: true
  }
];

export const mockActions: WorkflowRunSummary[] = Array.from({ length: 10 }, (_, index) => ({
  id: 9000 + index,
  name: index % 2 === 0 ? "Swift CI" : "Docs",
  displayTitle: index % 2 === 0 ? "Validate compiler changes" : "Publish docs preview",
  runNumber: 4200 + index,
  runAttempt: index % 3 === 0 ? 2 : 1,
  event: index % 2 === 0 ? "pull_request" : "push",
  status: "completed",
  conclusion: index % 4 === 0 ? "failure" : "success",
  branch: "main",
  commitSha: `7f3a2c${index}`,
  headRepositoryNameWithOwner: "apple/swift",
  actorLogin: index % 2 === 0 ? "swift-ci" : "docs-bot",
  actorAvatarUrl: avatar,
  triggeringActorLogin: index % 3 === 0 ? "ashleyrico" : null,
  runStartedAt: new Date(Date.now() - index * 3_600_000 - 900_000).toISOString(),
  createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  htmlUrl: `https://github.com/apple/swift/actions/runs/${9000 + index}`,
  actionAvailability: {
    canRerun: true,
    canRerunFailedJobs: index % 4 === 0,
    canCancel: false,
    rerunUrl: `https://github.com/apple/swift/actions/runs/${9000 + index}/rerun`,
    rerunFailedJobsUrl: `https://github.com/apple/swift/actions/runs/${9000 + index}/rerun-failed-jobs`,
    cancelUrl: `https://github.com/apple/swift/actions/runs/${9000 + index}/cancel`,
    previousAttemptUrl:
      index % 3 === 0 ? `https://github.com/apple/swift/actions/runs/${9000 + index}/attempts/1` : null
  }
}));

export const mockWorkflowRunDetail: WorkflowRunDetail = {
  ...mockActions[0],
  jobs: [
    {
      id: 7100,
      name: "macOS build",
      status: "completed",
      conclusion: "failure",
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      completedAt: new Date(Date.now() - 3_300_000).toISOString(),
      htmlUrl: "https://github.com/apple/swift/actions/runs/9000/job/7100",
      runnerName: "macos-15",
      labels: ["macos", "x64"],
      steps: [
        {
          name: "Checkout",
          status: "completed",
          conclusion: "success",
          number: 1,
          startedAt: new Date(Date.now() - 3_600_000).toISOString(),
          completedAt: new Date(Date.now() - 3_590_000).toISOString()
        },
        {
          name: "Build compiler",
          status: "completed",
          conclusion: "failure",
          number: 2,
          startedAt: new Date(Date.now() - 3_580_000).toISOString(),
          completedAt: new Date(Date.now() - 3_300_000).toISOString()
        }
      ]
    }
  ],
  jobsAvailability: { status: "available", message: null },
  artifacts: [
    {
      id: 8100,
      name: "build-logs",
      sizeInBytes: 20480,
      expired: false,
      createdAt: new Date(Date.now() - 3_250_000).toISOString(),
      updatedAt: new Date(Date.now() - 3_250_000).toISOString(),
      expiresAt: new Date(Date.now() + 604_800_000).toISOString(),
      archiveDownloadUrl: "https://pipelines.actions.githubusercontent.com/artifacts/8100.zip",
      archiveDownloadAvailability: { status: "available", message: null }
    }
  ],
  artifactsAvailability: { status: "available", message: null },
  checkSuites: [
    {
      id: 6100,
      status: "completed",
      conclusion: "failure",
      headBranch: "main",
      headSha: "7f3a2c0",
      beforeSha: "123456abcdef",
      afterSha: "7f3a2c0",
      appName: "GitHub Actions",
      appSlug: "github-actions",
      appHtmlUrl: "https://github.com/apps/github-actions",
      latestCheckRunCount: 1,
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      updatedAt: new Date(Date.now() - 3_300_000).toISOString()
    }
  ],
  checkSuitesAvailability: { status: "available", message: null },
  checkRuns: [
    {
      id: 6200,
      name: "Swift build",
      status: "completed",
      conclusion: "failure",
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      completedAt: new Date(Date.now() - 3_300_000).toISOString(),
      htmlUrl: "https://github.com/apple/swift/runs/6200",
      detailsUrl: "https://github.com/apple/swift/actions/runs/9000/job/7100",
      checkSuiteId: 6100,
      appName: "GitHub Actions",
      appSlug: "github-actions",
      appHtmlUrl: "https://github.com/apps/github-actions",
      outputTitle: "Swift build failed",
      outputSummary: "Compiler tests failed on macOS.",
      outputText: "See the failing build step for details.",
      annotationsCount: 1,
      annotations: [
        {
          path: "Sources/Compiler/main.swift",
          startLine: 42,
          endLine: 42,
          annotationLevel: "failure",
          title: "Compiler test failed",
          message: "Expected diagnostics did not match.",
          rawDetails: "Assertion failed in diagnostics test.",
          blobHref: "https://github.com/apple/swift/blob/main/Sources/Compiler/main.swift#L42"
        }
      ],
      annotationsAvailability: { status: "available", message: null }
    }
  ],
  checkRunsAvailability: { status: "available", message: null },
  logs: {
    apiUrl: "https://api.github.com/repos/apple/swift/actions/runs/9000/logs",
    downloadUrl: "https://pipelines.actions.githubusercontent.com/logs.zip",
    available: true,
    message: null,
    availability: { status: "available", message: null }
  }
};

export const mockWorkflows: WorkflowDefinitionSummary[] = [
  {
    id: 5100,
    nodeId: "W_ci",
    name: "Swift CI",
    path: ".github/workflows/ci.yml",
    state: "active",
    htmlUrl: "https://github.com/apple/swift/actions/workflows/ci.yml",
    badgeUrl: "https://github.com/apple/swift/actions/workflows/ci.yml/badge.svg",
    createdAt: new Date(Date.now() - 9_000_000).toISOString(),
    updatedAt: new Date(Date.now() - 3_000_000).toISOString(),
    dispatchable: true,
    inputs: [
      {
        name: "configuration",
        description: "Build configuration",
        required: true,
        type: "choice",
        defaultValue: "debug",
        options: ["debug", "release"]
      },
      {
        name: "run_tests",
        description: "Run the test suite",
        required: false,
        type: "boolean",
        defaultValue: "true",
        options: []
      }
    ],
    inputsUnavailableMessage: null
  }
];

export const mockProjects: ProjectSummary[] = [
  {
    id: "P_1",
    number: 1,
    title: "Compiler quality",
    shortDescription: "Tracks compiler reliability work across active milestones.",
    readme: "## Focus\n\nCompiler correctness, crash triage, and high-priority diagnostics.",
    ownerLogin: "apple/swift",
    ownerKind: "repository",
    ownerHtmlUrl: "https://github.com/apple/swift",
    isPublic: false,
    closed: false,
    closedAt: null,
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    itemsCount: 48,
    items: [
      {
        id: "PVTI_1",
        type: "ISSUE",
        contentId: "I_agent",
        contentType: "Issue",
        title: "Reduce compiler crash regressions",
        body: "Track high-priority crash diagnostics.",
        number: 101,
        state: "OPEN",
        repositoryNameWithOwner: "apple/swift",
        htmlUrl: "https://github.com/apple/swift/issues/101",
        createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
        fieldValues: [
          {
            id: "PVTFV_1",
            fieldId: "PF_1",
            fieldName: "Status",
            dataType: "SINGLE_SELECT",
            value: "In progress",
            optionId: "PFO_2",
            optionName: "In progress",
            options: [
              { id: "PFO_1", name: "Backlog" },
              { id: "PFO_2", name: "In progress" },
              { id: "PFO_3", name: "Done" }
            ],
            editable: true
          },
          {
            id: "PVTFV_2",
            fieldId: "PF_2",
            fieldName: "Priority",
            dataType: "SINGLE_SELECT",
            value: "High",
            optionId: "PFO_5",
            optionName: "High",
            options: [
              { id: "PFO_4", name: "Medium" },
              { id: "PFO_5", name: "High" }
            ],
            editable: true
          }
        ],
        fieldValuesTruncated: false
      },
      {
        id: "PVTI_2",
        type: "PULL_REQUEST",
        contentId: "PR_1",
        contentType: "PullRequest",
        title: "Improve type checker diagnostics",
        body: "Updates diagnostic presentation.",
        number: 202,
        state: "OPEN",
        repositoryNameWithOwner: "apple/swift",
        htmlUrl: "https://github.com/apple/swift/pull/202",
        createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        fieldValues: [
          {
            id: "PVTFV_3",
            fieldId: "PF_3",
            fieldName: "Target",
            dataType: "TEXT",
            value: "5.10.1",
            optionId: null,
            optionName: null,
            options: [],
            editable: true
          }
        ],
        fieldValuesTruncated: false
      }
    ],
    itemsTruncated: true,
    fieldsCount: 7,
    fields: [
      {
        id: "PF_1",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "PFO_1", name: "Backlog" },
          { id: "PFO_2", name: "In progress" },
          { id: "PFO_3", name: "Done" }
        ]
      },
      {
        id: "PF_2",
        name: "Priority",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "PFO_4", name: "Medium" },
          { id: "PFO_5", name: "High" }
        ]
      },
      { id: "PF_3", name: "Target", dataType: "TEXT", options: [] }
    ],
    viewerCanUpdate: true,
    htmlUrl: "https://github.com/orgs/apple/projects/1"
  },
  {
    id: "P_2",
    number: 2,
    title: "Concurrency roadmap",
    shortDescription: "Planning board for concurrency migration and runtime follow-up.",
    readme: "## Scope\n\nTracks accepted proposals, implementation status, and migration blockers.",
    ownerLogin: "apple",
    ownerKind: "organization",
    ownerHtmlUrl: "https://github.com/apple",
    isPublic: true,
    closed: false,
    closedAt: null,
    createdAt: new Date(Date.now() - 28 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 172_800_000).toISOString(),
    itemsCount: 31,
    items: [
      {
        id: "PVTI_3",
        type: "DRAFT_ISSUE",
        contentId: "DI_1",
        contentType: "DraftIssue",
        title: "Actor isolation migration notes",
        body: "Draft roadmap item for migration blockers.",
        number: null,
        state: "DRAFT_ISSUE",
        repositoryNameWithOwner: null,
        htmlUrl: null,
        createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 172_800_000).toISOString(),
        fieldValues: [
          {
            id: "PVTFV_4",
            fieldId: "PF_5",
            fieldName: "Release",
            dataType: "TEXT",
            value: "Swift 6",
            optionId: null,
            optionName: null,
            options: [],
            editable: true
          }
        ],
        fieldValuesTruncated: false
      }
    ],
    itemsTruncated: true,
    fieldsCount: 5,
    fields: [
      {
        id: "PF_4",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "PFO_6", name: "Now" },
          { id: "PFO_7", name: "Next" }
        ]
      },
      { id: "PF_5", name: "Release", dataType: "TEXT", options: [] }
    ],
    viewerCanUpdate: false,
    htmlUrl: "https://github.com/orgs/apple/projects/2"
  }
];

export const mockReleases: ReleaseSummary[] = [
  {
    id: 1,
    name: "Swift 5.10.0",
    tagName: "swift-5.10.0",
    targetCommitish: "main",
    body: "Release notes include compiler fixes, concurrency runtime updates, and package manager polish.",
    isDraft: false,
    isPrerelease: false,
    publishedAt: new Date(Date.now() - 172_800_000).toISOString(),
    htmlUrl: "https://github.com/apple/swift/releases/tag/swift-5.10.0",
    assets: [
      {
        id: 101,
        name: "swift-5.10.0-macos.pkg",
        label: "macOS installer",
        state: "uploaded",
        contentType: "application/octet-stream",
        sizeInBytes: 241_172_480,
        downloadCount: 1842,
        browserDownloadUrl: "https://github.com/apple/swift/releases/download/swift-5.10.0/swift.pkg",
        createdAt: new Date(Date.now() - 172_800_000).toISOString(),
        updatedAt: new Date(Date.now() - 172_800_000).toISOString()
      }
    ]
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
    credentialProvider: "github-oauth",
    glassMode: "glass-shell"
  },
  github: {
    available: true,
    authenticated: true,
    signInConfigured: true,
    user: mockViewer.login,
    error: null
  },
  viewer: mockViewer
};

export const mockGitHubSignInSession: GitHubSignInSession = {
  status: "pending",
  userCode: "WDJB-MJHT",
  verificationUri: "https://github.com/login/device",
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  error: null
};

export const mockControlApi: ControlApi = {
  getAppState: async () => mockAppState,
  getSettings: async () => mockAppState.settings,
  updateSettings: async (settings) => ({ ...mockAppState.settings, ...settings }),
  signInWithGitHub: async () => mockGitHubSignInSession,
  getGitHubSignIn: async () => mockGitHubSignInSession,
  cancelGitHubSignIn: async () => undefined,
  clearGitHubToken: async () => ({
    ...mockAppState,
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
  pinRepository: async (input) => pinMockRepository(input.nameWithOwner),
  unpinRepository: async (input) => unpinMockRepository(input.nameWithOwner),
  listRecentItems: async (input) => listMockRecentItems(input),
  recordRecentItem: async (input) => recordMockRecentItem(input),
  onGitHubRepositoriesUpdated: () => () => undefined,
  onGitHubAuthUpdated: () => () => undefined,
  github: {
    getViewer: async () => mockViewer,
    getAccountProfile: async () => mockAccountProfile,
    getAccountProfileWithStatus: async (): Promise<AccountProfileResult> => ({
      profile: mockAccountProfile,
      availability: { status: "available", message: null }
    }),
    listRepositories: async () => mockRepositories,
    listRepositoriesWithStatus: async (): Promise<RepositoryListResult> => ({
      items: mockRepositories,
      availability: { status: "available", message: null }
    }),
    listAccountRepositories: async () => mockRepositories,
    listAccountRepositoriesWithStatus: async (): Promise<AccountRepositoryListResult> => ({
      items: mockRepositories,
      availability: { status: "available", message: null }
    }),
    listOrganizations: async () => mockOrganizations,
    listOrganizationsWithStatus: async (): Promise<OrganizationListResult> => ({
      items: mockOrganizations,
      availability: { status: "available", message: null }
    }),
    listOrganizationTeams: async (input) =>
      mockTeams
        .filter((team) => team.organizationLogin.toLowerCase() === input.org.toLowerCase())
        .slice(0, input.limit ?? undefined),
    listOrganizationTeamsWithStatus: async (input): Promise<OrganizationTeamsResult> => ({
      items: mockTeams
        .filter((team) => team.organizationLogin.toLowerCase() === input.org.toLowerCase())
        .slice(0, input.limit ?? undefined),
      availability: { status: "available", message: null }
    }),
    listOrganizationRepositoriesWithStatus: async (input): Promise<OrganizationRepositoriesResult> => ({
      items: (mockOrganizationRepositories[input.org.toLowerCase()] ?? []).slice(0, input.limit ?? undefined),
      availability: { status: "available", message: null }
    }),
    listOrganizationTeamRepositoriesWithStatus: async (input) => ({
      items: (mockTeamRepositories[input.teamSlug] ?? []).slice(0, input.limit ?? undefined),
      availability: { status: "available", message: null }
    }),
    listOrganizationTeamMembersWithStatus: async (input): Promise<OrganizationTeamMembersResult> => ({
      items: (mockTeamMembers[input.teamSlug] ?? []).slice(0, input.limit ?? undefined),
      availability: { status: "available", message: null }
    }),
    listOrganizationMembersWithStatus: async (input): Promise<OrganizationMembersResult> => ({
      items: (mockOrganizationMembers[input.org.toLowerCase()] ?? []).slice(0, input.limit ?? undefined),
      availability: { status: "available", message: null }
    }),
    listOrganizationProjectsWithStatus: async (input) => ({
      items: mockProjects
        .filter((project) => project.ownerLogin?.toLowerCase().startsWith(input.org.toLowerCase()))
        .slice(0, input.limit ?? undefined),
      availability: { status: "available", message: null }
    }),
    listAccountIssues: async (input) => listMockIssues(input),
    listAccountIssuesWithStatus: async (input) => ({
      items: listMockIssues(input),
      availability: { status: "available", message: null }
    }),
    listAccountPullRequests: async (input) => listMockPullRequests(input),
    listAccountPullRequestsWithStatus: async (input) => ({
      items: listMockPullRequests(input),
      availability: { status: "available", message: null }
    }),
    listNotifications: async (input) => listMockNotifications(input),
    listNotificationsWithStatus: async (input): Promise<NotificationListResult> => ({
      items: listMockNotifications(input),
      availability: { status: "available", message: null }
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
    getRepository: async (input) => mockRepositoryDetail(input),
    getRepositoryWithStatus: async (input) => ({
      detail: mockRepositoryDetail(input),
      availability: { status: "available", message: null }
    }),
    listBranches: async () => mockBranches,
    listBranchesWithStatus: async () => ({
      items: mockBranches,
      availability: { status: "available", message: null }
    }),
    listTags: async () => mockTags,
    listTagsWithStatus: async () => ({
      items: mockTags,
      availability: { status: "available", message: null }
    }),
    listTree: async (input) => ({ ...mockTree, ref: input.ref ?? mockTree.ref }),
    listTreeWithStatus: async (input) => ({
      tree: { ...mockTree, ref: input.ref ?? mockTree.ref },
      availability: { status: "available", message: null }
    }),
    getReadme: async () => ({
      markdown: mockRepository.readmeMarkdown,
      availability: { status: "available", message: null }
    }),
    listContents: async () => mockContents,
    listContentsWithStatus: async () => ({
      items: mockContents,
      availability: { status: "available", message: null }
    }),
    getFileContent: async (input) => {
      const entry = mockContents.find((item) => item.path === input.path);
      return {
        path: input.path,
        name: input.path.split("/").pop() ?? input.path,
        ref: input.ref ?? mockRepository.defaultBranch,
        content: `# ${input.path}\n\nMock file content from Control.`,
        htmlUrl: `https://github.com/apple/swift/blob/main/${input.path}`,
        downloadUrl: `https://raw.githubusercontent.com/apple/swift/main/${input.path}`,
        lastCommitSha: entry?.lastCommitSha ?? "abcdef0",
        lastCommitMessage: entry?.lastCommitMessage ?? "Update mock file",
        lastCommitAuthorLogin: entry?.lastCommitAuthorLogin ?? "swift-ci",
        lastCommitAuthorName: entry?.lastCommitAuthorName ?? "Swift CI",
        lastCommitAuthorAvatarUrl: entry?.lastCommitAuthorAvatarUrl ?? avatar,
        lastAuthoredDate: entry?.lastAuthoredDate ?? "2026-05-03T11:00:00Z",
        lastCommittedDate: entry?.lastCommittedDate ?? "2026-05-03T11:00:00Z",
        lastCommitDate: entry?.lastCommitDate ?? "2026-05-03T11:00:00Z",
        lastCommitHtmlUrl: entry?.lastCommitHtmlUrl ?? "https://github.com/apple/swift/commit/abcdef0",
        lastCommitAdditions: entry?.lastCommitAdditions ?? null,
        lastCommitDeletions: entry?.lastCommitDeletions ?? null,
        lastCommitChanges: entry?.lastCommitChanges ?? null,
        lastCommitAvailability: entry?.lastCommitAvailability ?? { status: "available", message: null }
      };
    },
    getFileContentWithStatus: async (input) => {
      const entry = mockContents.find((item) => item.path === input.path);
      return {
        item: {
          path: input.path,
          name: input.path.split("/").pop() ?? input.path,
          ref: input.ref ?? mockRepository.defaultBranch,
          content: `# ${input.path}\n\nMock file content from Control.`,
          htmlUrl: `https://github.com/apple/swift/blob/main/${input.path}`,
          downloadUrl: `https://raw.githubusercontent.com/apple/swift/main/${input.path}`,
          lastCommitSha: entry?.lastCommitSha ?? "abcdef0",
          lastCommitMessage: entry?.lastCommitMessage ?? "Update mock file",
          lastCommitAuthorLogin: entry?.lastCommitAuthorLogin ?? "swift-ci",
          lastCommitAuthorName: entry?.lastCommitAuthorName ?? "Swift CI",
          lastCommitAuthorAvatarUrl: entry?.lastCommitAuthorAvatarUrl ?? avatar,
          lastAuthoredDate: entry?.lastAuthoredDate ?? "2026-05-03T11:00:00Z",
          lastCommittedDate: entry?.lastCommittedDate ?? "2026-05-03T11:00:00Z",
          lastCommitDate: entry?.lastCommitDate ?? "2026-05-03T11:00:00Z",
          lastCommitHtmlUrl: entry?.lastCommitHtmlUrl ?? "https://github.com/apple/swift/commit/abcdef0",
          lastCommitAdditions: entry?.lastCommitAdditions ?? null,
          lastCommitDeletions: entry?.lastCommitDeletions ?? null,
          lastCommitChanges: entry?.lastCommitChanges ?? null,
          lastCommitAvailability: entry?.lastCommitAvailability ?? { status: "available", message: null }
        },
        availability: { status: "available", message: null }
      };
    },
    getFileBlame: async (input) => mockFileBlame(input.path, input.ref),
    getRepositoryWiki: async (input) => mockRepositoryWiki(input.pagePath, input.limit),
    listCommits: async (input) =>
      input.path
        ? mockCommits
            .filter((commit) =>
              commit.headline.toLowerCase().includes(input.path!.split("/")[0].toLowerCase())
            )
            .concat(mockCommits)
            .slice(0, input.limit ?? 20)
        : mockCommits.slice(0, input.limit ?? 20),
    listCommitsWithStatus: async (input) => ({
      items: input.path
        ? mockCommits
            .filter((commit) =>
              commit.headline.toLowerCase().includes(input.path!.split("/")[0].toLowerCase())
            )
            .concat(mockCommits)
            .slice(0, input.limit ?? 20)
        : mockCommits.slice(0, input.limit ?? 20),
      availability: { status: "available", message: null }
    }),
    listLabels: async () => mockLabels,
    listLabelsWithStatus: async () => ({
      items: mockLabels,
      availability: { status: "available", message: null }
    }),
    listAssignableUsers: async () => mockAssignableUsers,
    listAssignableUsersWithStatus: async () => ({
      items: mockAssignableUsers,
      availability: { status: "available", message: null }
    }),
    getRepositoryAccess: async (input) => ({
      collaborators: mockRepositoryCollaborators.slice(0, input.limit ?? mockRepositoryCollaborators.length),
      teams: mockTeams.slice(0, input.limit ?? mockTeams.length),
      collaboratorsAvailability: { status: "available", message: null },
      teamsAvailability: { status: "available", message: null }
    }),
    listMilestones: async (input) =>
      mockMilestones.filter(
        (milestone) => input.state === "all" || !input.state || milestone.state === input.state
      ),
    listMilestonesWithStatus: async (input) => ({
      items: mockMilestones.filter(
        (milestone) => input.state === "all" || !input.state || milestone.state === input.state
      ),
      availability: { status: "available", message: null }
    }),
    listIssues: async (input) => listMockIssues(input),
    listIssuesWithStatus: async (input) => ({
      items: listMockIssues(input),
      availability: { status: "available", message: null }
    }),
    getIssueDetail: async (input) => {
      return (
        readMockIssues().find((item) => item.number === input.issueNumber) ??
        buildMockIssueDetail(mockIssues[0])
      );
    },
    getIssueDetailWithStatus: async (input): Promise<IssueDetailResult> => ({
      detail:
        readMockIssues().find((item) => item.number === input.issueNumber) ??
        buildMockIssueDetail(mockIssues[0]),
      availability: { status: "available", message: null }
    }),
    listPullRequests: async (input) => listMockPullRequests(input),
    listPullRequestsWithStatus: async (input) => ({
      items: listMockPullRequests(input),
      availability: { status: "available", message: null }
    }),
    getPullRequestDetail: async (input) => {
      return (
        readMockPullRequests().find((item) => item.number === input.pullNumber) ??
        buildMockPullRequestDetail(mockPullRequests[0])
      );
    },
    getPullRequestDetailWithStatus: async (input): Promise<PullRequestDetailResult> => ({
      detail:
        readMockPullRequests().find((item) => item.number === input.pullNumber) ??
        buildMockPullRequestDetail(mockPullRequests[0]),
      availability: { status: "available", message: null }
    }),
    listDiscussions: async () => mockDiscussions,
    listDiscussionsWithStatus: async (input) => ({
      items: mockDiscussions.slice(0, input.limit),
      availability: { status: "available", message: null }
    }),
    listDiscussionCategoriesWithStatus: async (input) => ({
      items: mockDiscussionCategories.slice(0, input.limit ?? mockDiscussionCategories.length),
      availability: { status: "available", message: null }
    }),
    getDiscussionDetail: async (input): Promise<DiscussionDetailResult> => {
      const discussion = mockDiscussions.find((item) => item.number === input.discussionNumber) ?? null;

      return {
        item: discussion
          ? {
              ...discussion,
              commentsList: discussion.previewComments.map((comment) => ({
                ...comment,
                replies: [],
                repliesTruncated: false
              })),
              commentsTruncated: discussion.previewCommentsTruncated
            }
          : null,
        availability: { status: "available", message: null }
      };
    },
    listActions: async (input) => listMockWorkflowRuns(input),
    listActionsWithStatus: async (input) => ({
      items: listMockWorkflowRuns(input),
      availability: { status: "available", message: null }
    }),
    listWorkflows: async (input) => mockWorkflows.slice(0, input.limit ?? mockWorkflows.length),
    listWorkflowsWithStatus: async (input): Promise<WorkflowDefinitionListResult> => ({
      items: mockWorkflows.slice(0, input.limit ?? mockWorkflows.length),
      availability: { status: "available", message: null }
    }),
    getWorkflowRunDetail: async (input) =>
      readMockWorkflowRuns().find((run) => run.id === input.runId) ??
      buildMockWorkflowRunDetail(mockActions[0]),
    getWorkflowRunDetailWithStatus: async (input): Promise<WorkflowRunDetailResult> => ({
      detail:
        readMockWorkflowRuns().find((run) => run.id === input.runId) ??
        buildMockWorkflowRunDetail(mockActions[0]),
      availability: { status: "available", message: null }
    }),
    getWorkflowJobLogs: async (input) => mockWorkflowJobLogs(input.jobId),
    listProjects: async () => mockProjects,
    listProjectsWithStatus: async (input) => ({
      items: mockProjects.slice(0, input.limit ?? mockProjects.length),
      availability: { status: "available", message: null }
    }),
    getBranchProtection: async (input) => ({
      ...mockBranchProtection,
      protection: mockBranchProtection.protection
        ? { ...mockBranchProtection.protection, branch: input.branch }
        : null
    }),
    listDependabotAlerts: async (input) => ({
      items: mockDependabotAlerts.slice(0, input.limit ?? mockDependabotAlerts.length),
      availability: { status: "available", message: null }
    }),
    listCodeScanningAlerts: async (input) => ({
      items: mockCodeScanningAlerts.slice(0, input.limit ?? mockCodeScanningAlerts.length),
      availability: { status: "available", message: null }
    }),
    listSecretScanningAlerts: async (input) => ({
      items: mockSecretScanningAlerts.slice(0, input.limit ?? mockSecretScanningAlerts.length),
      availability: { status: "available", message: null }
    }),
    listRepositoryRulesets: async (input) => ({
      items: mockRepositoryRulesets.slice(0, input.limit ?? mockRepositoryRulesets.length),
      availability: { status: "available", message: null }
    }),
    listRepositoryForks: async (input) => ({
      items: mockRepositoryForks(input),
      availability: { status: "available", message: null }
    }),
    listRepositorySecurityAdvisories: async (input) => ({
      items: mockRepositorySecurityAdvisories.slice(
        0,
        input.limit ?? mockRepositorySecurityAdvisories.length
      ),
      availability: { status: "available", message: null }
    }),
    getRepositorySecurityPolicy: async () => mockRepositorySecurityPolicy,
    getRepositoryCommunityProfile: async () => ({
      profile: mockRepositoryCommunityProfile,
      availability: { status: "available", message: null }
    }),
    listReleases: async (input) => readMockReleases().slice(0, input.limit ?? 20),
    listReleasesWithStatus: async (input): Promise<ReleaseListResult> => ({
      items: readMockReleases().slice(0, input.limit ?? 20),
      availability: { status: "available", message: null }
    }),
    listContributors: async (input) => mockContributors.slice(0, input.limit ?? 24),
    listContributorsWithStatus: async (input): Promise<ContributorListResult> => ({
      items: mockContributors.slice(0, input.limit ?? 24),
      availability: { status: "available", message: null }
    }),
    search: async (input) =>
      mockRepositories.filter((repository) =>
        repository.nameWithOwner.toLowerCase().includes(input.query.toLowerCase())
      ),
    searchWithStatus: async (input): Promise<RepositorySearchResult> => ({
      items: mockRepositories.filter((repository) =>
        repository.nameWithOwner.toLowerCase().includes(input.query.toLowerCase())
      ),
      availability: { status: "available", message: null }
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
