import type {
  AssignableUserSummary,
  GitHubMutationInput,
  IssueDetail,
  IssueSummary,
  LabelSummary,
  MilestoneSummary,
  RepositoryCollaboratorSummary
} from "@shared/github";

import { readMockArray, writeMockArray } from "../mockStorage";
import {
  mockAvatarUrl,
  mockIssuesKey,
  mockPayload,
  mockPayloadNumber,
  mockPayloadString,
  mockPayloadStringArray,
  mockPrimaryRepository
} from "./shared";

export const mockIssues: IssueSummary[] = Array.from({ length: 18 }, (_, index) => ({
  id: index + 1,
  nodeId: `I_mock_issue_${index + 1}`,
  number: 1200 - index,
  title:
    index % 3 === 0 ? "Improve Sendable diagnostics for global actors" : "Compiler crash in async closure",
  state: index % 5 === 0 ? "closed" : "open",
  stateReason: index % 5 === 0 ? (index % 10 === 0 ? "completed" : "not_planned") : null,
  authorLogin: index % 2 === 0 ? "slightbug" : "swift-ci",
  authorAvatarUrl: mockAvatarUrl,
  comments: 2 + index,
  labels: [{ id: `kind-${index}`, name: index % 2 === 0 ? "compiler" : "concurrency", color: "0969da" }],
  assignees:
    index % 3 === 0
      ? [
          {
            id: `U_assignee_${index}`,
            login: index % 2 === 0 ? "slightbug" : "swift-ci",
            avatarUrl: mockAvatarUrl,
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
          htmlUrl: `${mockPrimaryRepository.htmlUrl}/milestone/${index + 1}`,
          openIssues: 42,
          closedIssues: 18
        }
      : null,
  createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  htmlUrl: `${mockPrimaryRepository.htmlUrl}/issues/${1200 - index}`
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
    htmlUrl: `${mockPrimaryRepository.htmlUrl}/milestone/6`,
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
    htmlUrl: `${mockPrimaryRepository.htmlUrl}/milestone/7`,
    openIssues: 31,
    closedIssues: 9
  }
];

export const mockAssignableUsers: AssignableUserSummary[] = [
  {
    id: "U_slightbug",
    login: "slightbug",
    avatarUrl: mockAvatarUrl,
    htmlUrl: "https://github.com/slightbug"
  },
  {
    id: "U_swift_ci",
    login: "swift-ci",
    avatarUrl: mockAvatarUrl,
    htmlUrl: "https://github.com/swift-ci"
  }
];

export const mockRepositoryCollaborators: RepositoryCollaboratorSummary[] = [
  {
    id: "U_slightbug",
    login: "slightbug",
    avatarUrl: mockAvatarUrl,
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
    avatarUrl: mockAvatarUrl,
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

export function buildMockIssueDetail(issue: IssueSummary): IssueDetail {
  const numericId = typeof issue.id === "number" ? issue.id : issue.number;
  return {
    ...issue,
    body: "This issue reproduces in the current repository view and includes enough context for in-app triage.",
    commentsList: [
      {
        id: numericId * 1000 + 1,
        authorLogin: "swift-ci",
        authorAvatarUrl: mockAvatarUrl,
        body: "I can reproduce this locally. The next step is narrowing the failing file.",
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        htmlUrl: `${issue.htmlUrl}#issuecomment-${numericId * 1000 + 1}`
      }
    ],
    commentsAvailability: { status: "available", message: null }
  };
}

export function readMockIssues(): IssueDetail[] {
  return readMockArray(mockIssuesKey, () => mockIssues.map(buildMockIssueDetail));
}

export function writeMockIssues(items: IssueDetail[]): void {
  writeMockArray(mockIssuesKey, items);
}

export function listMockIssues(input?: {
  state?: "open" | "closed" | "all";
  limit?: number;
}): IssueSummary[] {
  const state = input?.state ?? "open";
  const issues = readMockIssues().filter((issue) => state === "all" || issue.state === state);
  return issues
    .slice(0, input?.limit ?? issues.length)
    .map(({ body: _body, commentsList: _commentsList, ...issue }) => issue);
}

export function mockLabelForName(name: string): LabelSummary {
  return (
    mockLabels.find((label) => label.name.toLowerCase() === name.toLowerCase()) ?? {
      id: `L_${name.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`,
      name,
      color: "57606a",
      description: null
    }
  );
}

export function mockAssigneeForLogin(login: string): AssignableUserSummary {
  return (
    mockAssignableUsers.find((user) => user.login.toLowerCase() === login.toLowerCase()) ?? {
      id: `U_${login.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`,
      login,
      avatarUrl: mockAvatarUrl,
      htmlUrl: `https://github.com/${login}`
    }
  );
}

export function mutateMockIssues(input: GitHubMutationInput): void {
  const payload = mockPayload(input);
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
      authorAvatarUrl: mockAvatarUrl,
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
              authorAvatarUrl: mockAvatarUrl,
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
