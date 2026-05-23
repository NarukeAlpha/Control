import type { NotificationSummary } from "@shared/github";

import type { RepositoryTab } from "../../stores/uiStore";
import { formatRelativeDate } from "../../utils/format";

export type MailboxNotificationFilter = "unread" | "all" | "participating";
export const defaultMailboxListLimit = 30;
export const maxMailboxListLimit = 100;

export function notificationQueryKey(
  filter: MailboxNotificationFilter,
  limit: number
): readonly ["notifications", MailboxNotificationFilter, number] {
  return ["notifications", filter, limit] as const;
}

export interface NotificationInAppTarget {
  kind: "repository" | "commit" | "issue" | "pullRequest" | "discussion" | "release" | "workflowRun";
  commitSha?: string;
  number?: number;
  releaseId?: number;
  runId?: number;
  tagName?: string;
  tab: RepositoryTab;
}

function parseNotificationSubjectNumber(
  notification: NotificationSummary,
  pathName: "issues" | "pull" | "pulls" | "discussions"
): number | null {
  const sources = [
    notification.subject.htmlUrl,
    notification.htmlUrl,
    notification.subject.apiUrl,
    notification.subject.latestCommentApiUrl
  ];
  const pattern = new RegExp(`/${pathName}/(\\d+)(?:[/?#]|$)`);

  for (const source of sources) {
    const match = source?.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function parseNotificationReleaseTagName(notification: NotificationSummary): string | null {
  const sources = [notification.subject.htmlUrl, notification.htmlUrl, notification.subject.apiUrl];

  for (const source of sources) {
    const match = source?.match(/\/releases\/tag\/([^/?#]+)(?:[/?#]|$)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

function parseNotificationReleaseId(notification: NotificationSummary): number | null {
  const sources = [notification.subject.apiUrl, notification.subject.htmlUrl, notification.htmlUrl];

  for (const source of sources) {
    const match = source?.match(/\/releases\/(\d+)(?:[/?#]|$)/);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function parseNotificationCommitSha(notification: NotificationSummary): string | null {
  const sources = [
    notification.subject.htmlUrl,
    notification.htmlUrl,
    notification.subject.apiUrl,
    notification.subject.latestCommentApiUrl
  ];

  for (const source of sources) {
    const match = source?.match(/\/commits?\/([a-f0-9]{7,40})(?:[/?#]|$)/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function parseWorkflowRunIdFromUrl(url: string | null | undefined): number | null {
  const match = url?.match(/\/actions\/runs\/(\d+)(?:[/?#]|$)/);
  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]);
}

function parseNotificationWorkflowRunId(notification: NotificationSummary): number | null {
  const sources = [notification.subject.htmlUrl, notification.htmlUrl, notification.subject.apiUrl];

  for (const source of sources) {
    const runId = parseWorkflowRunIdFromUrl(source);
    if (runId !== null) {
      return runId;
    }
  }

  return null;
}

export function notificationInAppTarget(notification: NotificationSummary): NotificationInAppTarget | null {
  const type = notification.subject.type.toLowerCase().replace(/[\s-]+/g, "_");
  const pullNumber =
    parseNotificationSubjectNumber(notification, "pull") ??
    parseNotificationSubjectNumber(notification, "pulls");

  if (pullNumber !== null && Number.isFinite(pullNumber)) {
    return { kind: "pullRequest", number: pullNumber, tab: "pulls" };
  }

  const issueNumber = parseNotificationSubjectNumber(notification, "issues");
  if ((type === "issue" || issueNumber !== null) && issueNumber !== null && Number.isFinite(issueNumber)) {
    return { kind: "issue", number: issueNumber, tab: "issues" };
  }

  const discussionNumber = parseNotificationSubjectNumber(notification, "discussions");
  if (
    (type === "discussion" || discussionNumber !== null) &&
    discussionNumber !== null &&
    Number.isFinite(discussionNumber)
  ) {
    return { kind: "discussion", number: discussionNumber, tab: "discussions" };
  }

  if (type.includes("pull_request") || type.includes("pullrequest")) {
    return { kind: "repository", tab: "pulls" };
  }

  if (type.includes("issue")) {
    return { kind: "repository", tab: "issues" };
  }

  if (type.includes("discussion")) {
    return { kind: "repository", tab: "discussions" };
  }

  const releaseTagName = parseNotificationReleaseTagName(notification);
  const releaseId = parseNotificationReleaseId(notification);
  if (
    (type === "release" || releaseTagName || releaseId !== null) &&
    (releaseTagName || releaseId !== null)
  ) {
    return {
      kind: "release",
      releaseId: releaseId ?? undefined,
      tagName: releaseTagName ?? undefined,
      tab: "releases"
    };
  }

  if (type.includes("release")) {
    return { kind: "repository", tab: "releases" };
  }

  const workflowRunId = parseNotificationWorkflowRunId(notification);
  if (
    (type.includes("workflow") || type.includes("check") || workflowRunId !== null) &&
    workflowRunId !== null
  ) {
    return { kind: "workflowRun", runId: workflowRunId, tab: "actions" };
  }

  if (type.includes("workflow") || type.includes("check")) {
    return { kind: "repository", tab: "actions" };
  }

  if (
    type.includes("security") ||
    type.includes("vulnerability") ||
    type.includes("dependabot") ||
    type.includes("secret_scanning") ||
    type.includes("code_scanning")
  ) {
    return { kind: "repository", tab: "securityQuality" };
  }

  if (type.includes("commit") || type === "repository") {
    const commitSha = parseNotificationCommitSha(notification);
    if (commitSha) {
      return { kind: "commit", commitSha, tab: "code" };
    }

    return { kind: "repository", tab: "code" };
  }

  return null;
}

export function notificationReasonLabel(reason: string): string {
  return reason.replace(/_/g, " ");
}

function notificationSubscriptionStateLabel(notification: NotificationSummary): string | null {
  if (notification.subscribed === true) {
    return "subscribed";
  }
  if (notification.subscribed === false) {
    return "not subscribed";
  }
  return null;
}

export function notificationMetadataParts(notification: NotificationSummary): string[] {
  return [
    notification.repositoryPrivate === null
      ? null
      : notification.repositoryPrivate
        ? "private repository"
        : "public repository",
    notification.participating === true ? "participating" : null,
    notificationSubscriptionStateLabel(notification),
    notification.ignored === true ? "muted" : notification.ignored === false ? "not muted" : null,
    notification.subscriptionReason
      ? `subscription reason ${notificationReasonLabel(notification.subscriptionReason)}`
      : null,
    notification.subscriptionCreatedAt
      ? `subscribed ${formatRelativeDate(notification.subscriptionCreatedAt)}`
      : null,
    notification.lastReadAt ? `last read ${formatRelativeDate(notification.lastReadAt)}` : null,
    notification.subject.latestCommentHtmlUrl
      ? "latest comment link available"
      : notification.subject.latestCommentApiUrl
        ? "latest comment API metadata"
        : null
  ].filter((item): item is string => Boolean(item));
}

export function notificationTargetUrl(notification: NotificationSummary): string {
  return notification.htmlUrl ?? notification.repositoryHtmlUrl ?? "https://github.com/notifications";
}
