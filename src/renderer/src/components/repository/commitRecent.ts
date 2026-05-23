import type {
  NotificationSummary,
  PullRequestCommitSummary,
  PullRequestReviewSummary,
  PullRequestTimelineEventSummary,
  RepoFileBlameCommit,
  RepoFileContent,
  RepositoryCommitSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunSummary
} from "@shared/github";

export type SyntheticCommitRecentCommit = {
  sha: string;
  headline: string;
  authorLogin: string | null;
  authorName: string | null;
  authoredDate: string | null;
  committedDate: string | null;
  htmlUrl: string | null;
};

export type CommitRecentCommit =
  | RepositoryCommitSummary
  | RepoFileBlameCommit
  | PullRequestCommitSummary
  | SyntheticCommitRecentCommit;

export function commitRecentHeadline(commit: CommitRecentCommit): string {
  return "headline" in commit ? commit.headline : commit.message;
}

export function commitRecentAuthoredDate(commit: CommitRecentCommit): string | null {
  return "authoredDate" in commit ? (commit.authoredDate ?? null) : null;
}

export function commitRecentCommittedDate(commit: CommitRecentCommit): string | null {
  return "committedDate" in commit ? (commit.committedDate ?? null) : commit.committedAt;
}

export function commitRecentAuthorName(commit: CommitRecentCommit): string | null {
  return "authorName" in commit ? (commit.authorName ?? null) : null;
}

export function workflowRunCommitRecentCommit(
  run: WorkflowRunSummary | WorkflowRunDetail
): SyntheticCommitRecentCommit | null {
  if (!run.commitSha) {
    return null;
  }

  return {
    sha: run.commitSha,
    headline: run.displayTitle ?? run.name,
    authorLogin: run.actorLogin ?? run.triggeringActorLogin ?? null,
    authorName: null,
    authoredDate: null,
    committedDate: run.runStartedAt ?? run.createdAt ?? run.updatedAt,
    htmlUrl: null
  };
}

export function workflowCheckSuiteCommitRecentCommit(
  suite: WorkflowRunCheckSuiteSummary
): SyntheticCommitRecentCommit | null {
  if (!suite.headSha) {
    return null;
  }

  return {
    sha: suite.headSha,
    headline: `${suite.appName ?? "GitHub check suite"} ${suite.conclusion ?? suite.status ?? "commit"}`,
    authorLogin: null,
    authorName: null,
    authoredDate: null,
    committedDate: suite.updatedAt ?? suite.createdAt,
    htmlUrl: null
  };
}

export function pullRequestReviewCommitRecentCommit(
  review: PullRequestReviewSummary
): SyntheticCommitRecentCommit | null {
  if (!review.commitSha) {
    return null;
  }

  return {
    sha: review.commitSha,
    headline: `${review.state} review`,
    authorLogin: review.authorLogin,
    authorName: null,
    authoredDate: review.submittedAt,
    committedDate: review.submittedAt,
    htmlUrl: null
  };
}

function pullRequestTimelineEventLabel(event: PullRequestTimelineEventSummary): string {
  if (event.sourceIssue) {
    const repository =
      event.sourceIssue.repositoryNameWithOwner && event.sourceIssue.repositoryNameWithOwner !== ""
        ? `${event.sourceIssue.repositoryNameWithOwner} `
        : "";
    return `${event.event} ${repository}#${event.sourceIssue.number} ${event.sourceIssue.title ?? ""}`.trim();
  }

  if (event.renameFrom || event.renameTo) {
    return `${event.event} ${event.renameFrom ?? "untitled"} to ${event.renameTo ?? "untitled"}`;
  }

  if (event.labelName) {
    return `${event.event} label ${event.labelName}`;
  }

  if (event.assigneeLogin) {
    return `${event.event} ${event.assigneeLogin}`;
  }

  if (event.requestedReviewerLogin) {
    return `${event.event} review from ${event.requestedReviewerLogin}`;
  }

  if (event.requestedTeamName) {
    return `${event.event} team review from ${event.requestedTeamName}`;
  }

  if (event.milestoneTitle) {
    return `${event.event} milestone ${event.milestoneTitle}`;
  }

  if (event.commitSha) {
    return `${event.event} ${event.commitSha.slice(0, 7)}`;
  }

  return event.event;
}

export function pullRequestTimelineEventCommitRecentCommit(
  event: PullRequestTimelineEventSummary
): SyntheticCommitRecentCommit | null {
  if (!event.commitSha) {
    return null;
  }

  return {
    sha: event.commitSha,
    headline: pullRequestTimelineEventLabel(event),
    authorLogin: event.actorLogin,
    authorName: null,
    authoredDate: event.createdAt,
    committedDate: event.createdAt,
    htmlUrl: null
  };
}

function notificationTargetUrl(notification: NotificationSummary): string {
  return notification.htmlUrl ?? notification.repositoryHtmlUrl ?? "https://github.com/notifications";
}

export function notificationCommitRecentCommit(
  notification: NotificationSummary,
  commitSha: string
): SyntheticCommitRecentCommit {
  return {
    sha: commitSha,
    headline: notification.subject.title,
    authorLogin: null,
    authorName: null,
    authoredDate: null,
    committedDate: notification.updatedAt,
    htmlUrl: notificationTargetUrl(notification)
  };
}

export function repoFileContentRecentCommit(file: RepoFileContent): SyntheticCommitRecentCommit | null {
  if (!file.lastCommitSha) {
    return null;
  }

  return {
    sha: file.lastCommitSha,
    headline: file.lastCommitMessage ?? "Last changed",
    authorLogin: file.lastCommitAuthorLogin,
    authorName: file.lastCommitAuthorName,
    authoredDate: file.lastAuthoredDate ?? file.lastCommitDate,
    committedDate: file.lastCommittedDate ?? file.lastCommitDate,
    htmlUrl: file.lastCommitHtmlUrl
  };
}
