import type { JSX } from "react";

import type { PullRequestTimelineEventSummary } from "@shared/github";

import { formatRelativeDate } from "@renderer/utils/format";

import type { PullRequestLinkedIssue } from "./PullRequestsTab.types";
import { pullRequestTimelineEventLabel } from "./PullRequestsTab.utils";

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
