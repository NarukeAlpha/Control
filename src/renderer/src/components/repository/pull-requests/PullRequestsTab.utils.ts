import type {
  PullRequestReviewThreadCommentSummary,
  PullRequestSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import { repositoryMutationDisabledReason } from "@renderer/components/repository/repositoryUi";

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
