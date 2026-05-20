import type {
  GitHubMutationInput,
  PullRequestDetail,
  PullRequestRequestedTeamSummary,
  PullRequestSummary,
  TeamSummary
} from "@shared/github";

import { readMockArray, writeMockArray } from "../mockStorage";
import { mockAssigneeForLogin, mockLabelForName, mockMilestones } from "./issues";
import {
  mockAvatarUrl,
  mockPayload,
  mockPayloadBoolean,
  mockPayloadNumber,
  mockPayloadString,
  mockPayloadStringArray,
  mockPrimaryRepository,
  mockPullRequestsKey
} from "./shared";

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
  authorAvatarUrl: mockAvatarUrl,
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
  headRepositoryNameWithOwner: index % 4 === 1 ? `slightbug/swift` : mockPrimaryRepository.nameWithOwner,
  baseRepositoryNameWithOwner: mockPrimaryRepository.nameWithOwner,
  createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 7_200_000).toISOString(),
  htmlUrl: `${mockPrimaryRepository.htmlUrl}/pull/${520 - index}`
}));

export function mockTeamForSlug(slug: string): PullRequestRequestedTeamSummary {
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

export function buildMockPullRequestDetail(pull: PullRequestSummary): PullRequestDetail {
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
        authorAvatarUrl: mockAvatarUrl,
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
        authorAvatarUrl: mockAvatarUrl,
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
        authorAvatarUrl: mockAvatarUrl,
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
        htmlUrl: `${mockPrimaryRepository.htmlUrl}/issues/1200`,
        repositoryNameWithOwner: mockPrimaryRepository.nameWithOwner
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
            authorAvatarUrl: mockAvatarUrl,
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
            authorAvatarUrl: mockAvatarUrl,
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
        actorAvatarUrl: mockAvatarUrl,
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
          htmlUrl: `${mockPrimaryRepository.htmlUrl}/issues/1200`,
          repositoryNameWithOwner: mockPrimaryRepository.nameWithOwner
        }
      }
    ],
    timelineAvailability: { status: "available", message: null }
  };
}

export function readMockPullRequests(): PullRequestDetail[] {
  return readMockArray(mockPullRequestsKey, () => mockPullRequests.map(buildMockPullRequestDetail));
}

export function writeMockPullRequests(items: PullRequestDetail[]): void {
  writeMockArray(mockPullRequestsKey, items);
}

export function listMockPullRequests(input?: {
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

export function mutateMockPullRequests(input: GitHubMutationInput): void {
  const payload = mockPayload(input);
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
      authorAvatarUrl: mockAvatarUrl,
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
            authorAvatarUrl: mockAvatarUrl,
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
            authorAvatarUrl: mockAvatarUrl,
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
