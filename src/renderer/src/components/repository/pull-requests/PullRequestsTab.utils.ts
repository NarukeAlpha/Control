import type {
  BranchProtectionSummary,
  PullRequestReviewThreadCommentSummary,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import { repositoryMutationDisabledReason } from "@renderer/components/repository/repositoryUi";
import type { PullRequestMergeMethod, PullRequestMergeMethodOption } from "./PullRequestsTab.types";

const mergeMethodOptionMetadata: Record<
  PullRequestMergeMethod,
  Omit<PullRequestMergeMethodOption, "method">
> = {
  merge: {
    label: "Create merge commit",
    detail: "Preserve the pull request commits with a merge commit on the base branch."
  },
  squash: {
    label: "Squash merge",
    detail: "Combine the pull request commits into one commit on the base branch."
  },
  rebase: {
    label: "Rebase merge",
    detail: "Replay the pull request commits onto the base branch without a merge commit."
  }
};

function mergeMethodOption(method: PullRequestMergeMethod): PullRequestMergeMethodOption {
  return { method, ...mergeMethodOptionMetadata[method] };
}

export function pullRequestMergeMethodOptions(
  repository: RepositoryDetail,
  baseProtection: BranchProtectionSummary | null
): PullRequestMergeMethodOption[] {
  const { allowMergeCommit, allowSquashMerge, allowRebaseMerge } = repository.administration.mergeSettings;
  const options: PullRequestMergeMethodOption[] = [];

  if (allowMergeCommit !== false && baseProtection?.requiredLinearHistory !== true) {
    options.push(mergeMethodOption("merge"));
  }
  if (allowSquashMerge !== false) {
    options.push(mergeMethodOption("squash"));
  }
  if (allowRebaseMerge !== false) {
    options.push(mergeMethodOption("rebase"));
  }

  return options;
}

export function pullRequestMergeMethodDisabledReason(
  repository: RepositoryDetail,
  baseProtection: BranchProtectionSummary | null
): string | null {
  if (pullRequestMergeMethodOptions(repository, baseProtection).length > 0) {
    return null;
  }
  if (
    repository.administration.mergeSettings.allowMergeCommit !== false &&
    baseProtection?.requiredLinearHistory === true
  ) {
    return "The base branch requires linear history and no linear merge methods are enabled.";
  }
  return "No pull request merge methods are enabled for this repository.";
}

export function conversationCommentDisabledReason(
  repository: RepositoryDetail,
  locked: boolean | null | undefined
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (locked) {
    return "Conversation is locked.";
  }
  return null;
}

export function githubNumericId(id: number | string): number | null {
  if (typeof id === "number" && Number.isFinite(id)) {
    return id;
  }
  if (typeof id === "string" && /^\d+$/.test(id)) {
    return Number(id);
  }
  return null;
}

export function commaSeparatedValues(value: string): string[] {
  const values = new Set<string>();
  for (const item of value.split(",")) {
    const trimmed = item.trim();
    if (trimmed) {
      values.add(trimmed);
    }
  }
  return Array.from(values);
}

export function appendCommaSeparatedValue(current: string, value: string): string {
  const values = commaSeparatedValues(current);
  if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
    values.push(value);
  }
  return values.join(", ");
}

export function mergeUniqueStrings(existing: string[], additions: string[]): string[] {
  const values = [...existing];
  for (const addition of additions) {
    if (!values.some((value) => value.toLowerCase() === addition.toLowerCase())) {
      values.push(addition);
    }
  }
  return values;
}

export function commentMutationDisabledReason(
  repository: RepositoryDetail,
  comment: TimelineCommentSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (githubNumericId(comment.id) === null) {
    return "Comment id is unavailable for this action.";
  }
  return null;
}

export function reviewCommentMutationDisabledReason(
  repository: RepositoryDetail,
  comment: PullRequestReviewThreadCommentSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (githubNumericId(comment.id) === null) {
    return "Review comment id is unavailable for this action.";
  }
  return null;
}

export function mergeDisabledReason(repository: RepositoryDetail, pull: PullRequestSummary): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (pull.merged) {
    return "Pull request is already merged.";
  }
  if (pull.state !== "open") {
    return "Pull request is not open.";
  }
  if (pull.isDraft) {
    return "Draft pull requests cannot be merged.";
  }
  if (pull.mergeableState && pull.mergeableState !== "clean") {
    return `Merge is blocked because GitHub reports ${pull.mergeableState}.`;
  }
  return null;
}

export function pullStateMutationDisabledReason(
  repository: RepositoryDetail,
  pull: PullRequestSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (pull.merged) {
    return "Merged pull requests cannot be reopened.";
  }
  return null;
}

export function reviewDisabledReason(repository: RepositoryDetail, pull: PullRequestSummary): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (pull.locked) {
    return "Pull request conversation is locked.";
  }
  if (pull.state !== "open") {
    return "Pull request is not open.";
  }
  return null;
}

export function pullRequestTimelineEventLabel(event: PullRequestTimelineEventSummary): string {
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
