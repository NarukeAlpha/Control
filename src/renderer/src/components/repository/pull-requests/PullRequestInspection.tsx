import { useState, type JSX } from "react";

import type {
  PullRequestCommitSummary,
  PullRequestDetail,
  PullRequestReviewSummary,
  PullRequestReviewThreadCommentSummary,
  PullRequestTimelineEventSummary,
  RepositoryDetail
} from "@shared/github";

import type { MarkdownUrlContext } from "@renderer/components/MarkdownBody";
import { readAvailabilityMessage } from "@renderer/components/repository/repositoryUi";

import { PullRequestChecksPanel } from "./PullRequestChecksPanel";
import { PullRequestCommitsPanel } from "./PullRequestCommitsPanel";
import { PullRequestFilesPanel } from "./PullRequestFilesPanel";
import { PullRequestLinkedIssuesPanel } from "./PullRequestLinkedIssuesPanel";
import { PullRequestReviewThreadsPanel } from "./PullRequestReviewThreadsPanel";
import { PullRequestReviewsPanel } from "./PullRequestReviewsPanel";
import { PullRequestTimelinePanel } from "./PullRequestTimelinePanel";
import {
  isPullRequestDetailSectionRequested,
  type PullRequestDetailSection,
  type RequestedPullRequestDetailSections
} from "./PullRequestsTab.queries";
import type { PullRequestLinkedIssue } from "./PullRequestsTab.types";

type PullRequestInspectionSection =
  | "reviews"
  | "linked-issues"
  | "timeline"
  | "review-threads"
  | "checks"
  | "commits"
  | "files";

export function PullRequestInspection({
  repository,
  detail,
  loading,
  requestedSections,
  sections,
  className,
  markdownUrlContext,
  onOpenExternal,
  onOpenIssueReference,
  onOpenPullRequestCommit,
  onOpenPullRequestReviewCommit,
  onOpenPullRequestTimelineEventCommit,
  onOpenWorkflowRun,
  onRequestSection,
  onOpenCodePath,
  reviewCommentActions
}: {
  repository: RepositoryDetail;
  detail: PullRequestDetail | null;
  loading: boolean;
  requestedSections: RequestedPullRequestDetailSections;
  sections?: PullRequestInspectionSection[];
  className?: string;
  markdownUrlContext?: MarkdownUrlContext;
  onOpenExternal(url: string): void;
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
  onOpenWorkflowRun(runId: number, url?: string | null): void;
  onRequestSection(section: PullRequestDetailSection): void;
  onOpenCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  reviewCommentActions?: {
    getDisabledReason(comment: PullRequestReviewThreadCommentSummary): string | null;
    onEdit(comment: PullRequestReviewThreadCommentSummary, body: string): void;
    onDelete(comment: PullRequestReviewThreadCommentSummary): void;
  };
}): JSX.Element {
  const reviewLimit = 6;
  const timelineEventLimit = 8;
  const reviewThreadLimit = 6;
  const checkLimit = 6;
  const commitLimit = 6;
  const fileLimit = 8;
  const commits = detail?.commitsList ?? [];
  const files = detail?.files ?? [];
  const reviews = detail?.reviews ?? [];
  const checks = detail?.checks ?? [];
  const reviewThreads = detail?.reviewThreads ?? [];
  const timelineEvents = detail?.timelineEvents ?? [];
  const linkedIssues = detail?.linkedIssues ?? [];
  const reviewsRequested = isPullRequestDetailSectionRequested(requestedSections, "reviews");
  const linkedIssuesRequested = isPullRequestDetailSectionRequested(requestedSections, "linked-issues");
  const timelineRequested = isPullRequestDetailSectionRequested(requestedSections, "timeline");
  const reviewThreadsRequested = isPullRequestDetailSectionRequested(requestedSections, "review-threads");
  const checksRequested = isPullRequestDetailSectionRequested(requestedSections, "checks");
  const commitsRequested = isPullRequestDetailSectionRequested(requestedSections, "commits");
  const filesRequested = isPullRequestDetailSectionRequested(requestedSections, "files");
  const detailKey = detail
    ? `${detail.repositoryNameWithOwner ?? repository.nameWithOwner}#${detail.number}`
    : null;
  const initialExpandedSections = {
    reviews: false,
    timelineEvents: false,
    reviewThreads: false,
    checks: false,
    commits: false,
    files: false
  };
  const [expandedSectionState, setExpandedSectionState] = useState({
    detailKey,
    sections: initialExpandedSections
  });
  const expandedSections =
    expandedSectionState.detailKey === detailKey ? expandedSectionState.sections : initialExpandedSections;
  const visibleReviews = reviewsRequested
    ? expandedSections.reviews
      ? reviews
      : reviews.slice(0, reviewLimit)
    : [];
  const visibleTimelineEvents =
    timelineRequested && expandedSections.timelineEvents
      ? timelineEvents
      : timelineRequested
        ? timelineEvents.slice(0, timelineEventLimit)
        : [];
  const visibleReviewThreads =
    reviewThreadsRequested && expandedSections.reviewThreads
      ? reviewThreads
      : reviewThreadsRequested
        ? reviewThreads.slice(0, reviewThreadLimit)
        : [];
  const visibleChecks = checksRequested
    ? expandedSections.checks
      ? checks
      : checks.slice(0, checkLimit)
    : [];
  const visibleCommits = commitsRequested
    ? expandedSections.commits
      ? commits
      : commits.slice(0, commitLimit)
    : [];
  const visibleFiles = filesRequested ? (expandedSections.files ? files : files.slice(0, fileLimit)) : [];
  const toggleExpandedSection = (section: keyof typeof expandedSections) =>
    setExpandedSectionState((current) => ({
      detailKey,
      sections: {
        ...(current.detailKey === detailKey ? current.sections : initialExpandedSections),
        [section]: !(current.detailKey === detailKey ? current.sections : initialExpandedSections)[section]
      }
    }));
  const checksAvailabilityMessage = readAvailabilityMessage(
    "Pull request checks",
    detail?.checksAvailability ?? null
  );
  const timelineAvailabilityMessage = readAvailabilityMessage(
    "Pull request timeline",
    detail?.timelineAvailability ?? null
  );
  const linkedIssuesAvailabilityMessage = readAvailabilityMessage(
    "Linked issues",
    detail?.linkedIssuesAvailability ?? null
  );
  const reviewThreadsAvailabilityMessage = readAvailabilityMessage(
    "Pull request review threads",
    detail?.reviewThreadsAvailability ?? null
  );
  const reviewThreadStatesAvailabilityMessage = readAvailabilityMessage(
    "Review thread state",
    detail?.reviewThreadStatesAvailability ?? null
  );
  const reviewsAvailabilityMessage = readAvailabilityMessage(
    "Pull request reviews",
    detail?.reviewsAvailability ?? null
  );
  const commitsAvailabilityMessage = readAvailabilityMessage(
    "Pull request commits",
    detail?.commitsAvailability ?? null
  );
  const filesAvailabilityMessage = readAvailabilityMessage(
    "Pull request changed files",
    detail?.filesAvailability ?? null
  );
  const changedFilesRef = detail?.headRefName || detail?.baseRefName || null;
  const changedFilesRepositoryNameWithOwner =
    detail?.headRepositoryNameWithOwner ?? detail?.repositoryNameWithOwner ?? repository.nameWithOwner;
  const visibleSectionSet = new Set<PullRequestInspectionSection>(
    sections ?? ["reviews", "linked-issues", "timeline", "review-threads", "checks", "commits", "files"]
  );

  return (
    <section
      className={`pr-inspection${className ? ` ${className}` : ""}`}
      aria-label="Pull request inspection"
    >
      {visibleSectionSet.has("reviews") && (
        <PullRequestReviewsPanel
          reviews={reviews}
          visibleReviews={visibleReviews}
          reviewStatus={detail?.latestReviewState ?? reviews.length}
          reviewsRequested={reviewsRequested}
          reviewsAvailabilityMessage={reviewsAvailabilityMessage}
          loading={loading}
          expanded={expandedSections.reviews}
          reviewLimit={reviewLimit}
          changedFilesRepositoryNameWithOwner={changedFilesRepositoryNameWithOwner}
          onRequestReviews={() => onRequestSection("reviews")}
          onToggleReviews={() => toggleExpandedSection("reviews")}
          onOpenPullRequestReviewCommit={onOpenPullRequestReviewCommit}
          onOpenExternal={onOpenExternal}
        />
      )}
      {visibleSectionSet.has("linked-issues") && (
        <PullRequestLinkedIssuesPanel
          linkedIssues={linkedIssues}
          linkedIssuesRequested={linkedIssuesRequested}
          linkedIssuesAvailabilityMessage={linkedIssuesAvailabilityMessage}
          loading={loading}
          repositoryNameWithOwner={detail?.repositoryNameWithOwner ?? null}
          onRequestLinkedIssues={() => onRequestSection("linked-issues")}
          onOpenIssueReference={onOpenIssueReference}
          onOpenExternal={onOpenExternal}
        />
      )}
      {visibleSectionSet.has("timeline") && (
        <PullRequestTimelinePanel
          timelineEvents={timelineEvents}
          visibleTimelineEvents={visibleTimelineEvents}
          timelineRequested={timelineRequested}
          timelineAvailabilityMessage={timelineAvailabilityMessage}
          loading={loading}
          expanded={expandedSections.timelineEvents}
          timelineEventLimit={timelineEventLimit}
          changedFilesRepositoryNameWithOwner={changedFilesRepositoryNameWithOwner}
          onRequestTimeline={() => onRequestSection("timeline")}
          onToggleTimeline={() => toggleExpandedSection("timelineEvents")}
          onOpenIssueReference={onOpenIssueReference}
          onOpenPullRequestTimelineEventCommit={onOpenPullRequestTimelineEventCommit}
        />
      )}
      {visibleSectionSet.has("review-threads") && (
        <PullRequestReviewThreadsPanel
          reviewThreads={reviewThreads}
          visibleReviewThreads={visibleReviewThreads}
          reviewThreadsRequested={reviewThreadsRequested}
          reviewThreadsAvailabilityMessage={reviewThreadsAvailabilityMessage}
          reviewThreadStatesAvailabilityMessage={reviewThreadStatesAvailabilityMessage}
          loading={loading}
          expanded={expandedSections.reviewThreads}
          reviewThreadLimit={reviewThreadLimit}
          changedFilesRef={changedFilesRef}
          changedFilesRepositoryNameWithOwner={changedFilesRepositoryNameWithOwner}
          markdownUrlContext={markdownUrlContext}
          reviewCommentActions={reviewCommentActions}
          onRequestReviewThreads={() => onRequestSection("review-threads")}
          onToggleReviewThreads={() => toggleExpandedSection("reviewThreads")}
          onOpenExternal={onOpenExternal}
          onOpenCodePath={onOpenCodePath}
        />
      )}
      {visibleSectionSet.has("checks") && (
        <PullRequestChecksPanel
          checks={checks}
          visibleChecks={visibleChecks}
          checksRequested={checksRequested}
          checksAvailabilityMessage={checksAvailabilityMessage}
          loading={loading}
          expanded={expandedSections.checks}
          checkLimit={checkLimit}
          onRequestChecks={() => onRequestSection("checks")}
          onToggleChecks={() => toggleExpandedSection("checks")}
          onOpenWorkflowRun={onOpenWorkflowRun}
          onOpenExternal={onOpenExternal}
        />
      )}
      {visibleSectionSet.has("commits") && (
        <PullRequestCommitsPanel
          commits={commits}
          visibleCommits={visibleCommits}
          commitsRequested={commitsRequested}
          commitsAvailabilityMessage={commitsAvailabilityMessage}
          loading={loading}
          expanded={expandedSections.commits}
          commitLimit={commitLimit}
          changedFilesRepositoryNameWithOwner={changedFilesRepositoryNameWithOwner}
          onRequestCommits={() => onRequestSection("commits")}
          onToggleCommits={() => toggleExpandedSection("commits")}
          onOpenPullRequestCommit={onOpenPullRequestCommit}
          onOpenExternal={onOpenExternal}
        />
      )}
      {visibleSectionSet.has("files") && (
        <PullRequestFilesPanel
          files={files}
          visibleFiles={visibleFiles}
          filesRequested={filesRequested}
          filesAvailabilityMessage={filesAvailabilityMessage}
          loading={loading}
          expanded={expandedSections.files}
          fileLimit={fileLimit}
          changedFilesRef={changedFilesRef}
          changedFilesRepositoryNameWithOwner={changedFilesRepositoryNameWithOwner}
          onRequestFiles={() => onRequestSection("files")}
          onToggleFiles={() => toggleExpandedSection("files")}
          onOpenExternal={onOpenExternal}
          onOpenCodePath={onOpenCodePath}
        />
      )}
    </section>
  );
}
