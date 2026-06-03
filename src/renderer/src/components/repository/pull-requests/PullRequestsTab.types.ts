import type { PullRequestLinkedIssueSummary, PullRequestTimelineEventSummary } from "@shared/github";

export type PullRequestLinkedIssue =
  | NonNullable<PullRequestTimelineEventSummary["sourceIssue"]>
  | PullRequestLinkedIssueSummary;
