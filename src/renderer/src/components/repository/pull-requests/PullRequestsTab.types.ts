import type { PullRequestLinkedIssueSummary, PullRequestTimelineEventSummary } from "@shared/github";

export type PullRequestLinkedIssue =
  | NonNullable<PullRequestTimelineEventSummary["sourceIssue"]>
  | PullRequestLinkedIssueSummary;

export type PullRequestMergeMethod = "merge" | "squash" | "rebase";

export interface PullRequestMergeMethodOption {
  method: PullRequestMergeMethod;
  label: string;
  detail: string;
}
