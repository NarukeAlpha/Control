import type { IssueSummary, PullRequestSummary } from "@shared/github";

import { formatRelativeDate } from "../../utils/format";

export function pullRequestReviewDecisionTone(value: string | null | undefined): string {
  if (value === "APPROVED") {
    return "success";
  }
  if (value === "CHANGES_REQUESTED" || value === "REVIEW_REQUIRED") {
    return "attention";
  }
  return "";
}

export function issueStateLabel(issue: IssueSummary): string {
  return issue.stateReason ? `${issue.state} · ${issue.stateReason.replace(/_/g, " ")}` : issue.state;
}

function compactCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function pullRequestReviewDecisionLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value === "APPROVED") {
    return "review approved";
  }
  if (value === "REVIEW_REQUIRED") {
    return "review required";
  }
  if (value === "CHANGES_REQUESTED") {
    return "changes requested";
  }
  return `review ${value.toLowerCase().replaceAll("_", " ")}`;
}

export function pullRequestMergeableStateLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toLowerCase().replaceAll("_", " ");
}

export function mailboxIssueMetadataParts(issue: IssueSummary): string[] {
  const labels = issue.labels.slice(0, 2).map((label) => `label ${label.name}`);
  const hiddenLabelCount = Math.max(issue.labels.length - labels.length, 0);
  const assignees = (issue.assignees ?? []).slice(0, 2).map((assignee) => `@${assignee.login}`);
  const hiddenAssigneeCount = Math.max((issue.assignees?.length ?? 0) - assignees.length, 0);

  return [
    `opened by ${issue.authorLogin ?? "unknown"}`,
    compactCountLabel(issue.comments, "comment"),
    ...labels,
    hiddenLabelCount > 0 ? `+${hiddenLabelCount} ${hiddenLabelCount === 1 ? "label" : "labels"}` : null,
    assignees.length > 0 ? `assigned ${assignees.join(", ")}` : null,
    hiddenAssigneeCount > 0
      ? `+${hiddenAssigneeCount} ${hiddenAssigneeCount === 1 ? "assignee" : "assignees"}`
      : null,
    issue.milestone ? `milestone ${issue.milestone.title}` : null,
    `created ${formatRelativeDate(issue.createdAt)}`
  ].filter((part): part is string => Boolean(part));
}

export function mailboxPullRequestMetadataParts(pull: PullRequestSummary): string[] {
  const headRepositoryNameWithOwner = pull.headRepositoryNameWithOwner ?? null;
  const baseRepositoryNameWithOwner = pull.baseRepositoryNameWithOwner ?? null;
  const sourceRepositoryLabel =
    headRepositoryNameWithOwner && headRepositoryNameWithOwner !== pull.repositoryNameWithOwner
      ? `source ${headRepositoryNameWithOwner}`
      : null;
  const targetRepositoryLabel =
    baseRepositoryNameWithOwner && baseRepositoryNameWithOwner !== pull.repositoryNameWithOwner
      ? `target ${baseRepositoryNameWithOwner}`
      : null;

  return [
    `opened by ${pull.authorLogin ?? "unknown"}`,
    `${pull.headRefName} -> ${pull.baseRefName}`,
    sourceRepositoryLabel,
    targetRepositoryLabel,
    compactCountLabel(pull.changedFiles, "file"),
    `+${pull.additions} -${pull.deletions}`,
    compactCountLabel(pull.comments, "comment"),
    compactCountLabel(pull.reviewComments, "review comment"),
    pull.maintainerCanModify === false ? "maintainers cannot modify" : null,
    pull.mergeCommitSha ? `merge ${pull.mergeCommitSha.slice(0, 7)}` : null,
    `created ${formatRelativeDate(pull.createdAt)}`
  ].filter((part): part is string => Boolean(part));
}
