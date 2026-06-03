import type { JSX } from "react";

import type { PullRequestTimelineEventSummary } from "@shared/github";

import { formatRelativeDate } from "@renderer/utils/format";

import type { PullRequestLinkedIssue } from "./PullRequestsTab.types";

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

export function PullRequestTimelinePanel({
  timelineEvents,
  visibleTimelineEvents,
  timelineRequested,
  timelineAvailabilityMessage,
  loading,
  expanded,
  timelineEventLimit,
  changedFilesRepositoryNameWithOwner,
  onRequestTimeline,
  onToggleTimeline,
  onOpenIssueReference,
  onOpenPullRequestTimelineEventCommit
}: {
  timelineEvents: PullRequestTimelineEventSummary[];
  visibleTimelineEvents: PullRequestTimelineEventSummary[];
  timelineRequested: boolean;
  timelineAvailabilityMessage: string | null;
  loading: boolean;
  expanded: boolean;
  timelineEventLimit: number;
  changedFilesRepositoryNameWithOwner: string | null;
  onRequestTimeline(): void;
  onToggleTimeline(): void;
  onOpenIssueReference(issue: PullRequestLinkedIssue): void;
  onOpenPullRequestTimelineEventCommit(
    event: PullRequestTimelineEventSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
}): JSX.Element {
  return (
    <article>
      <header>
        <h3>Timeline events</h3>
        <span>{timelineRequested ? timelineEvents.length : "not loaded"}</span>
      </header>
      <div className="pr-inspection-list">
        {!timelineRequested && (
          <button type="button" onClick={onRequestTimeline}>
            <small>Load timeline events</small>
          </button>
        )}
        {visibleTimelineEvents.map((event) => {
          const linkedIssue = event.sourceIssue;
          const canOpenInControl = Boolean(linkedIssue || event.commitSha);

          return (
            <button
              key={event.id}
              type="button"
              disabled={!canOpenInControl}
              title={canOpenInControl ? undefined : "This timeline event has no in-app target."}
              onClick={() => {
                if (linkedIssue) {
                  onOpenIssueReference(linkedIssue);
                  return;
                }
                if (event.commitSha) {
                  onOpenPullRequestTimelineEventCommit(event, changedFilesRepositoryNameWithOwner);
                }
              }}
            >
              <strong>{pullRequestTimelineEventLabel(event)}</strong>
              <small>
                {event.actorLogin ?? "GitHub"} ·{" "}
                {event.createdAt ? formatRelativeDate(event.createdAt) : "unknown time"}
                {linkedIssue
                  ? " · open linked issue in Control"
                  : event.commitSha
                    ? " · open commit tree in Control"
                    : ""}
              </small>
            </button>
          );
        })}
        {timelineRequested && timelineEvents.length > timelineEventLimit && (
          <button type="button" onClick={onToggleTimeline}>
            <small>{expanded ? "Show fewer" : `Show all ${timelineEvents.length} timeline events`}</small>
          </button>
        )}
        {timelineRequested && !loading && timelineAvailabilityMessage && (
          <div className="error-state">{timelineAvailabilityMessage}</div>
        )}
        {timelineRequested && !loading && !timelineAvailabilityMessage && timelineEvents.length === 0 && (
          <div className="empty-state">No timeline events returned.</div>
        )}
      </div>
    </article>
  );
}
