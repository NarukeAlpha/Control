import type { JSX } from "react";

import type {
  PullRequestCommitSummary,
  PullRequestDetail,
  PullRequestReviewSummary,
  PullRequestTimelineEventSummary
} from "@shared/github";

import { readAvailabilityMessage } from "@renderer/components/repository/repositoryUi";
import { formatRelativeDate } from "@renderer/utils/format";

import {
  isPullRequestDetailSectionRequested,
  type RequestedPullRequestDetailSections
} from "./PullRequestsTab.queries";
import type { PullRequestLinkedIssue } from "./PullRequestsTab.types";
import { pullRequestTimelineEventLabel } from "./PullRequestsTab.utils";

type TimelineActivityKind = "commit" | "review" | "event";

interface PullRequestTimelineActivityProps {
  detail: PullRequestDetail | null;
  loading: boolean;
  requestedSections: RequestedPullRequestDetailSections;
  changedFilesRepositoryNameWithOwner: string | null;
  showEmptyNotes?: boolean;
  onRequestReviews(): void;
  onRequestTimeline(): void;
  onRequestCommits(): void;
  onOpenIssueReference(issue: PullRequestLinkedIssue): void;
  onOpenPullRequestCommit(
    commit: PullRequestCommitSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenPullRequestReviewCommit(
    review: PullRequestReviewSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenPullRequestTimelineEventCommit(
    event: PullRequestTimelineEventSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenExternal(url: string): void;
}

interface TimelineActivityRowProps {
  kind: TimelineActivityKind;
  actorLogin: string | null;
  actorAvatarUrl: string | null;
  title: string;
  meta: string;
  sha?: string | null;
  body?: string | null;
  actions?: JSX.Element;
}

function activityInitial(login: string | null): string {
  return (login?.trim()[0] ?? "G").toUpperCase();
}

function TimelineActivityRow({
  kind,
  actorLogin,
  actorAvatarUrl,
  title,
  meta,
  sha,
  body,
  actions
}: TimelineActivityRowProps): JSX.Element {
  return (
    <div className={`pr-timeline-activity-row pr-timeline-activity-row-${kind}`}>
      <div className="pr-timeline-activity-marker" aria-hidden="true" />
      <div className="timeline-avatar pr-timeline-activity-avatar">
        {actorAvatarUrl ? <img src={actorAvatarUrl} alt="" /> : activityInitial(actorLogin)}
      </div>
      <div className="pr-timeline-activity-main">
        <div className="pr-timeline-activity-copy">
          <strong>{title}</strong>
          <small>{meta}</small>
          {body?.trim() && <p>{body.trim()}</p>}
        </div>
        {sha && <span className="pr-timeline-activity-sha">{sha.slice(0, 7)}</span>}
        {actions && <div className="pr-timeline-activity-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function PullRequestTimelineActivity({
  detail,
  loading,
  requestedSections,
  changedFilesRepositoryNameWithOwner,
  showEmptyNotes = true,
  onRequestReviews,
  onRequestTimeline,
  onRequestCommits,
  onOpenIssueReference,
  onOpenPullRequestCommit,
  onOpenPullRequestReviewCommit,
  onOpenPullRequestTimelineEventCommit,
  onOpenExternal
}: PullRequestTimelineActivityProps): JSX.Element {
  const reviewsRequested = isPullRequestDetailSectionRequested(requestedSections, "reviews");
  const timelineRequested = isPullRequestDetailSectionRequested(requestedSections, "timeline");
  const commitsRequested = isPullRequestDetailSectionRequested(requestedSections, "commits");
  const reviews = detail?.reviews ?? [];
  const timelineEvents = detail?.timelineEvents ?? [];
  const commits = detail?.commitsList ?? [];
  const reviewsAvailabilityMessage = readAvailabilityMessage(
    "Pull request reviews",
    detail?.reviewsAvailability ?? null
  );
  const timelineAvailabilityMessage = readAvailabilityMessage(
    "Pull request timeline",
    detail?.timelineAvailability ?? null
  );
  const commitsAvailabilityMessage = readAvailabilityMessage(
    "Pull request commits",
    detail?.commitsAvailability ?? null
  );

  return (
    <section className="pr-timeline-activity" aria-label="Pull request timeline activity">
      {!commitsRequested && (
        <button type="button" onClick={onRequestCommits}>
          Load commits
        </button>
      )}
      {commits.map((commit) => (
        <TimelineActivityRow
          key={`commit-${commit.sha}`}
          kind="commit"
          actorLogin={commit.authorLogin}
          actorAvatarUrl={commit.authorAvatarUrl}
          title={commit.message}
          meta={`${commit.authorLogin ?? "unknown"} · ${
            commit.committedAt ? formatRelativeDate(commit.committedAt) : "unknown date"
          }`}
          sha={commit.sha}
          actions={
            <>
              <button
                type="button"
                onClick={() => onOpenPullRequestCommit(commit, changedFilesRepositoryNameWithOwner)}
              >
                Open tree
              </button>
              <button
                type="button"
                disabled={!commit.htmlUrl}
                title={commit.htmlUrl ? undefined : "Commit URL unavailable."}
                onClick={() => {
                  if (commit.htmlUrl) {
                    onOpenExternal(commit.htmlUrl);
                  }
                }}
              >
                GitHub
              </button>
            </>
          }
        />
      ))}
      {commitsRequested && !loading && commitsAvailabilityMessage && (
        <div className="error-state">{commitsAvailabilityMessage}</div>
      )}
      {showEmptyNotes &&
        commitsRequested &&
        !loading &&
        !commitsAvailabilityMessage &&
        commits.length === 0 && <div className="pr-timeline-activity-note">No commits returned.</div>}

      {!reviewsRequested && (
        <button type="button" onClick={onRequestReviews}>
          Load reviews
        </button>
      )}
      {reviews.map((review) => (
        <TimelineActivityRow
          key={`review-${review.id}`}
          kind="review"
          actorLogin={review.authorLogin}
          actorAvatarUrl={review.authorAvatarUrl}
          title={`${review.state} by ${review.authorLogin ?? "unknown"}`}
          meta={`${review.submittedAt ? formatRelativeDate(review.submittedAt) : "not submitted"}${
            review.commitSha ? ` · ${review.commitSha.slice(0, 7)}` : ""
          }`}
          body={review.body}
          sha={review.commitSha}
          actions={
            <>
              <button
                type="button"
                disabled={!review.commitSha}
                title={review.commitSha ? undefined : "Review commit SHA unavailable."}
                onClick={() => {
                  if (review.commitSha) {
                    onOpenPullRequestReviewCommit(review, changedFilesRepositoryNameWithOwner);
                  }
                }}
              >
                Open commit
              </button>
              <button
                type="button"
                disabled={!review.htmlUrl}
                title={review.htmlUrl ? undefined : "Review URL unavailable."}
                onClick={() => {
                  if (review.htmlUrl) {
                    onOpenExternal(review.htmlUrl);
                  }
                }}
              >
                GitHub
              </button>
            </>
          }
        />
      ))}
      {reviewsRequested && !loading && reviewsAvailabilityMessage && (
        <div className="error-state">{reviewsAvailabilityMessage}</div>
      )}
      {showEmptyNotes &&
        reviewsRequested &&
        !loading &&
        !reviewsAvailabilityMessage &&
        reviews.length === 0 && <div className="pr-timeline-activity-note">No reviews returned.</div>}

      {!timelineRequested && (
        <button type="button" onClick={onRequestTimeline}>
          Load timeline events
        </button>
      )}
      {timelineEvents.map((event) => {
        const linkedIssue = event.sourceIssue;
        const canOpenInControl = Boolean(linkedIssue || event.commitSha);

        return (
          <TimelineActivityRow
            key={`event-${event.id}`}
            kind="event"
            actorLogin={event.actorLogin}
            actorAvatarUrl={event.actorAvatarUrl}
            title={pullRequestTimelineEventLabel(event)}
            meta={`${event.actorLogin ?? "GitHub"} · ${
              event.createdAt ? formatRelativeDate(event.createdAt) : "unknown time"
            }`}
            sha={event.commitSha}
            actions={
              canOpenInControl ? (
                <button
                  type="button"
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
                  Open in Control
                </button>
              ) : undefined
            }
          />
        );
      })}
      {timelineRequested && !loading && timelineAvailabilityMessage && (
        <div className="error-state">{timelineAvailabilityMessage}</div>
      )}
      {showEmptyNotes &&
        timelineRequested &&
        !loading &&
        !timelineAvailabilityMessage &&
        timelineEvents.length === 0 && (
          <div className="pr-timeline-activity-note">No timeline events returned.</div>
        )}
    </section>
  );
}
