import { ArrowLeft, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type JSX, type RefObject } from "react";

import type {
  AssignableUserSummary,
  BranchProtectionSummary,
  GitHubAction,
  LabelSummary,
  MilestoneSummary,
  PullRequestCommitSummary,
  PullRequestDetail,
  PullRequestRequestedTeamSummary,
  PullRequestReviewSummary,
  PullRequestReviewThreadCommentSummary,
  PullRequestStateFilter,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import type { MarkdownUrlContext } from "@renderer/components/MarkdownBody";
import { FilterBar, StateSegmentedControl } from "@renderer/components/ui/primitives";

import { PullRequestInspection } from "./PullRequestInspection";
import { PullRequestCreateForm, type PullRequestCreateDraft } from "./PullRequestCreateForm";
import { PullRequestConversationActions } from "./PullRequestConversationActions";
import { PullRequestDetailSummary } from "./PullRequestDetailSummary";
import { PullRequestDiscussion } from "./PullRequestDiscussion";
import { PullRequestList } from "./PullRequestList";
import { PullRequestMetadataControls } from "./PullRequestMetadataControls";
import { PullRequestReviewerControls } from "./PullRequestReviewerControls";
import {
  isPullRequestDetailSectionRequested,
  type PullRequestDetailSection,
  type RequestedPullRequestDetailSections
} from "./PullRequestsTab.queries";
import type { PullRequestLinkedIssue } from "./PullRequestsTab.types";

export interface PullRequestsTabContentProps {
  repository: RepositoryDetail;
  pullState: PullRequestStateFilter;
  filter: string;
  creating: boolean;
  createPullDisabledReason: string | null;
  filteredPulls: PullRequestSummary[];
  selectedPull: PullRequestSummary | null;
  loading: boolean;
  pullsAvailabilityMessage: string | null;
  pullRequestListLimit: number;
  branchOptions: string[];
  branchesError: Error | null;
  effectiveBaseBranch: string;
  createPullSubmitDisabledReason: string | null;
  createPullDraft: PullRequestCreateDraft;
  createPullMutationActive: boolean;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  detail: PullRequestDetail | null;
  pullDetailLoading: boolean;
  pullDetailError: Error | null;
  pullDetailAvailabilityMessage: string | null;
  requestedPullDetailSections: RequestedPullRequestDetailSections;
  pullMarkdownUrlContext: MarkdownUrlContext;
  selectedMerged: boolean | null;
  selectedReviewDecision: string | null;
  reviewDecisionAvailabilityMessage: string | null;
  selectedIsCrossRepository: boolean | null;
  selectedHeadRepository: string | null;
  selectedBaseRepository: string | null;
  selectedMaintainerCanModify: boolean | null;
  selectedMergeCommitSha: string | null;
  selectedMergedAt: string | null;
  selectedBranchSignals: string[];
  selectedBaseProtection: BranchProtectionSummary | null;
  selectedBaseProtectionBranchLabel: string;
  selectedBaseProtectionStatusLabel: string;
  selectedBaseProtectionStatusUnavailable: boolean;
  selectedBaseProtectionLoading: boolean;
  selectedBaseProtectionError: Error | null;
  selectedBaseProtectionAvailabilityMessage: string | null;
  selectedBaseProtectionLoaded: boolean;
  selectedLabels: LabelSummary[];
  selectedAssignees: AssignableUserSummary[];
  visibleLabels: LabelSummary[];
  visibleMilestones: MilestoneSummary[];
  assigneeSuggestions: AssignableUserSummary[];
  labelEntry: string;
  assigneeEntry: string;
  selectedMetadataDisabledReason: string | null;
  pullMetadataSubmitDisabledReason: string | null;
  labelsLoading: boolean;
  labelsError: Error | null;
  labelsAvailabilityMessage: string | null;
  assignableUsersLoading: boolean;
  assignableUsersError: Error | null;
  assignableUsersAvailabilityMessage: string | null;
  milestonesLoading: boolean;
  milestonesError: Error | null;
  milestonesAvailabilityMessage: string | null;
  hiddenPullLabelCount: number;
  hiddenPullAssigneeCount: number;
  hiddenPullMilestoneCount: number;
  requestedReviewers: AssignableUserSummary[];
  requestedTeams: PullRequestRequestedTeamSummary[];
  reviewerSuggestions: AssignableUserSummary[];
  reviewerEntry: string;
  teamReviewerEntry: string;
  selectedReviewDisabledReason: string | null;
  reviewerRequestSubmitDisabledReason: string | null;
  hiddenPullReviewerCount: number;
  commentBody: string;
  reviewBody: string;
  pullActionLabel: string;
  pullCommentMutationActive: boolean;
  pullReviewMutationActive: boolean;
  submittedPullAction: GitHubAction | null;
  pullCommentDisabledReason: string | null;
  reviewCommentDisabledReason: string | null;
  pullActionDisabledReason: string | null;
  selectedMergeDisabledReason: string | null;
  reviewCommentActions: {
    getDisabledReason(comment: PullRequestReviewThreadCommentSummary): string | null;
    onEdit(comment: PullRequestReviewThreadCommentSummary, body: string): void;
    onDelete(comment: PullRequestReviewThreadCommentSummary): void;
  };
  commentActions: {
    getDisabledReason(comment: TimelineCommentSummary): string | null;
    onEdit(comment: TimelineCommentSummary, body: string): void;
    onDelete(comment: TimelineCommentSummary): void;
  };
  onFilterChange(value: string): void;
  onPullStateChange(value: PullRequestStateFilter): void;
  onStartCreating(): void;
  onSelectPull(pull: PullRequestSummary): void;
  onOpenPullRequestList(): void;
  onOpenExternal(url: string): void;
  onExpandPullRequests(): void;
  onDraftChange(draft: PullRequestCreateDraft): void;
  onSubmitCreatePullRequest(): void;
  onCancelCreatePullRequest(): void;
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
  onRequestPullDetailSection(section: PullRequestDetailSection): void;
  onOpenCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onRemoveLabel(name: string): void;
  onRemoveAssignee(login: string): void;
  onAddLabelSuggestion(name: string): void;
  onAddAssigneeSuggestion(login: string): void;
  onShowAllLabels(): void;
  onShowAllAssignees(): void;
  onShowAllMilestones(): void;
  onMilestoneChange(milestone: number | null): void;
  onLabelEntryChange(value: string): void;
  onAssigneeEntryChange(value: string): void;
  onRemoveReviewer(login: string): void;
  onRemoveTeamReviewer(slug: string): void;
  onAddReviewerSuggestion(login: string): void;
  onShowAllReviewers(): void;
  onReviewerEntryChange(value: string): void;
  onTeamReviewerEntryChange(value: string): void;
  onSubmitMetadata(): void;
  onSubmitReviewerRequest(): void;
  onCommentBodyChange(value: string): void;
  onReviewBodyChange(value: string): void;
  onSubmitComment(): void;
  onSubmitReview(action: GitHubAction, dangerous: boolean): void;
  onRunPullAction(): void;
  onMerge(): void;
  focusedPullNumber: number | null;
}

type PullRequestsToolbarProps = Pick<
  PullRequestsTabContentProps,
  | "pullState"
  | "filter"
  | "createPullDisabledReason"
  | "filteredPulls"
  | "onFilterChange"
  | "onPullStateChange"
  | "onStartCreating"
>;

const pullRequestStateFilterOptions: Array<{ value: PullRequestStateFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" }
];

type PullRequestSelectedDetailProps = Omit<PullRequestsTabContentProps, "selectedPull"> & {
  selectedPull: PullRequestSummary;
};

function PullRequestsToolbar({
  pullState,
  filter,
  createPullDisabledReason,
  filteredPulls,
  onFilterChange,
  onPullStateChange,
  onStartCreating
}: PullRequestsToolbarProps): JSX.Element {
  function handleFilterChange(event: ChangeEvent<HTMLInputElement>): void {
    onFilterChange(event.target.value);
  }

  const pullCountLabel = `${filteredPulls.length} ${
    filteredPulls.length === 1 ? "pull request" : "pull requests"
  }`;

  return (
    <FilterBar
      className="surface-filter-row"
      label={pullCountLabel}
      actions={
        <button
          type="button"
          disabled={Boolean(createPullDisabledReason)}
          title={createPullDisabledReason ?? undefined}
          onClick={onStartCreating}
        >
          <Plus size={16} /> New pull request
        </button>
      }
    >
      <StateSegmentedControl
        label="Pull request state"
        value={pullState}
        options={pullRequestStateFilterOptions}
        onChange={onPullStateChange}
      />
      <label className="surface-filter">
        <Search size={15} />
        <input
          aria-label="Filter pull requests"
          value={filter}
          onChange={handleFilterChange}
          placeholder="Filter pull requests"
        />
      </label>
    </FilterBar>
  );
}

export function PullRequestsTabContent(props: PullRequestsTabContentProps): JSX.Element {
  const detailPaneRef = useRef<HTMLDivElement | null>(null);
  const [detailActivationCount, setDetailActivationCount] = useState(0);
  const selectedPullNumber = props.selectedPull?.number ?? null;
  const pullDetailRoute = props.focusedPullNumber !== null && !props.creating;

  useEffect(() => {
    if (props.creating || selectedPullNumber === null) {
      return;
    }
    if (!pullDetailRoute && detailActivationCount === 0) {
      return;
    }

    const detailPane = detailPaneRef.current;
    if (!detailPane) {
      return;
    }

    detailPane.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    detailPane.focus({ preventScroll: true });
  }, [detailActivationCount, props.creating, pullDetailRoute, selectedPullNumber]);

  function handleSelectPull(pull: PullRequestSummary): void {
    setDetailActivationCount((current) => current + 1);
    props.onSelectPull(pull);
  }

  return (
    <section className="table-panel github-surface">
      {!pullDetailRoute && (
        <PullRequestsToolbar
          pullState={props.pullState}
          filter={props.filter}
          filteredPulls={props.filteredPulls}
          createPullDisabledReason={props.createPullDisabledReason}
          onFilterChange={props.onFilterChange}
          onPullStateChange={props.onPullStateChange}
          onStartCreating={props.onStartCreating}
        />
      )}
      <div className={`github-split${pullDetailRoute ? " detail-route" : ""}`}>
        {!pullDetailRoute && (
          <PullRequestList
            repository={props.repository}
            pulls={props.filteredPulls}
            selectedPullNumber={props.selectedPull?.number ?? null}
            creating={props.creating}
            loading={props.loading}
            availabilityMessage={props.pullsAvailabilityMessage}
            filter={props.filter}
            pullRequestListLimit={props.pullRequestListLimit}
            onSelect={handleSelectPull}
            onExpandPullRequests={props.onExpandPullRequests}
          />
        )}

        <PullRequestDetailPane {...props} detailPaneRef={detailPaneRef} pullDetailRoute={pullDetailRoute} />
      </div>
    </section>
  );
}

function PullRequestDetailPane({
  detailPaneRef,
  pullDetailRoute,
  ...props
}: PullRequestsTabContentProps & {
  detailPaneRef: RefObject<HTMLDivElement | null>;
  pullDetailRoute: boolean;
}): JSX.Element {
  if (props.creating) {
    return (
      <div
        ref={detailPaneRef}
        className="thread-detail"
        role="region"
        aria-label="Pull request composer"
        tabIndex={-1}
      >
        <PullRequestCreateForm
          repository={props.repository}
          branchOptions={props.branchOptions}
          branchesError={props.branchesError}
          effectiveBaseBranch={props.effectiveBaseBranch}
          disabledReason={props.createPullDisabledReason}
          submitDisabledReason={props.createPullSubmitDisabledReason}
          draft={props.createPullDraft}
          status={{
            createPullMutationActive: props.createPullMutationActive,
            mutationPending: props.mutationPending,
            mutationSucceeded: props.mutationSucceeded,
            mutationError: props.mutationError
          }}
          onDraftChange={props.onDraftChange}
          onSubmit={props.onSubmitCreatePullRequest}
          onCancel={props.onCancelCreatePullRequest}
        />
      </div>
    );
  }

  if (!props.selectedPull) {
    return (
      <div
        ref={detailPaneRef}
        className="thread-detail"
        role="region"
        aria-label="Pull request detail"
        tabIndex={-1}
      >
        <div className="empty-state">No pull requests found.</div>
      </div>
    );
  }

  return (
    <div
      ref={detailPaneRef}
      className={`thread-detail${pullDetailRoute ? " detail-page" : ""}`}
      role="region"
      aria-label={`Pull request ${props.selectedPull.number} detail`}
      tabIndex={-1}
    >
      {pullDetailRoute && (
        <PullRequestDetailRouteToolbar onOpenPullRequestList={props.onOpenPullRequestList} />
      )}
      <PullRequestSelectedDetail {...props} selectedPull={props.selectedPull} />
    </div>
  );
}

function PullRequestDetailRouteToolbar({
  onOpenPullRequestList
}: {
  onOpenPullRequestList(): void;
}): JSX.Element {
  return (
    <div className="detail-toolbar">
      <button type="button" onClick={onOpenPullRequestList}>
        <ArrowLeft size={16} /> Back to pull requests
      </button>
    </div>
  );
}

function PullRequestSelectedDetail(props: PullRequestSelectedDetailProps): JSX.Element {
  const commentsRequested = isPullRequestDetailSectionRequested(
    props.requestedPullDetailSections,
    "comments"
  );

  function handleRequestComments(): void {
    props.onRequestPullDetailSection("comments");
  }

  return (
    <>
      <PullRequestDetailSummary
        selectedPull={props.selectedPull}
        selectedMerged={props.selectedMerged}
        selectedReviewDecision={props.selectedReviewDecision}
        reviewDecisionAvailabilityMessage={props.reviewDecisionAvailabilityMessage}
        selectedIsCrossRepository={props.selectedIsCrossRepository}
        selectedHeadRepository={props.selectedHeadRepository}
        selectedBaseRepository={props.selectedBaseRepository}
        selectedMaintainerCanModify={props.selectedMaintainerCanModify}
        selectedMergeCommitSha={props.selectedMergeCommitSha}
        selectedMergedAt={props.selectedMergedAt}
        selectedBranchSignals={props.selectedBranchSignals}
        selectedBaseProtection={props.selectedBaseProtection}
        selectedBaseProtectionBranchLabel={props.selectedBaseProtectionBranchLabel}
        selectedBaseProtectionStatusLabel={props.selectedBaseProtectionStatusLabel}
        selectedBaseProtectionStatusUnavailable={props.selectedBaseProtectionStatusUnavailable}
        selectedBaseProtectionLoading={props.selectedBaseProtectionLoading}
        selectedBaseProtectionError={props.selectedBaseProtectionError}
        selectedBaseProtectionAvailabilityMessage={props.selectedBaseProtectionAvailabilityMessage}
        selectedBaseProtectionLoaded={props.selectedBaseProtectionLoaded}
      />
      {props.pullDetailError && <div className="error-state">{props.pullDetailError.message}</div>}
      {props.pullDetailAvailabilityMessage && (
        <div className="error-state">{props.pullDetailAvailabilityMessage}</div>
      )}
      <PullRequestInspection
        repository={props.repository}
        detail={props.detail}
        loading={props.pullDetailLoading}
        requestedSections={props.requestedPullDetailSections}
        markdownUrlContext={props.pullMarkdownUrlContext}
        onOpenExternal={props.onOpenExternal}
        onOpenIssueReference={props.onOpenIssueReference}
        onOpenPullRequestCommit={props.onOpenPullRequestCommit}
        onOpenPullRequestReviewCommit={props.onOpenPullRequestReviewCommit}
        onOpenPullRequestTimelineEventCommit={props.onOpenPullRequestTimelineEventCommit}
        onOpenWorkflowRun={props.onOpenWorkflowRun}
        onRequestSection={props.onRequestPullDetailSection}
        onOpenCodePath={props.onOpenCodePath}
        reviewCommentActions={props.reviewCommentActions}
      />
      <PullRequestDiscussion
        selectedPull={props.selectedPull}
        detail={props.detail}
        loading={props.pullDetailLoading}
        commentsRequested={commentsRequested}
        markdownUrlContext={props.pullMarkdownUrlContext}
        onRequestComments={handleRequestComments}
        onOpenExternal={props.onOpenExternal}
        commentActions={props.commentActions}
      />
      <PullRequestMetadataControls
        selectedPull={props.selectedPull}
        detail={props.detail}
        selectedLabels={props.selectedLabels}
        selectedAssignees={props.selectedAssignees}
        visibleLabels={props.visibleLabels}
        visibleMilestones={props.visibleMilestones}
        assigneeSuggestions={props.assigneeSuggestions}
        labelEntry={props.labelEntry}
        assigneeEntry={props.assigneeEntry}
        selectedMetadataDisabledReason={props.selectedMetadataDisabledReason}
        pullMetadataSubmitDisabledReason={props.pullMetadataSubmitDisabledReason}
        labelsLoading={props.labelsLoading}
        labelsError={props.labelsError}
        labelsAvailabilityMessage={props.labelsAvailabilityMessage}
        assignableUsersLoading={props.assignableUsersLoading}
        assignableUsersError={props.assignableUsersError}
        assignableUsersAvailabilityMessage={props.assignableUsersAvailabilityMessage}
        milestonesLoading={props.milestonesLoading}
        milestonesError={props.milestonesError}
        milestonesAvailabilityMessage={props.milestonesAvailabilityMessage}
        hiddenPullLabelCount={props.hiddenPullLabelCount}
        hiddenPullAssigneeCount={props.hiddenPullAssigneeCount}
        hiddenPullMilestoneCount={props.hiddenPullMilestoneCount}
        onRemoveLabel={props.onRemoveLabel}
        onRemoveAssignee={props.onRemoveAssignee}
        onAddLabelSuggestion={props.onAddLabelSuggestion}
        onAddAssigneeSuggestion={props.onAddAssigneeSuggestion}
        onShowAllLabels={props.onShowAllLabels}
        onShowAllAssignees={props.onShowAllAssignees}
        onShowAllMilestones={props.onShowAllMilestones}
        onMilestoneChange={props.onMilestoneChange}
        onLabelEntryChange={props.onLabelEntryChange}
        onAssigneeEntryChange={props.onAssigneeEntryChange}
        onSubmitMetadata={props.onSubmitMetadata}
      />
      <PullRequestReviewerControls
        requestedReviewers={props.requestedReviewers}
        requestedTeams={props.requestedTeams}
        reviewerSuggestions={props.reviewerSuggestions}
        reviewerEntry={props.reviewerEntry}
        teamReviewerEntry={props.teamReviewerEntry}
        selectedReviewDisabledReason={props.selectedReviewDisabledReason}
        reviewerRequestSubmitDisabledReason={props.reviewerRequestSubmitDisabledReason}
        assignableUsersLoading={props.assignableUsersLoading}
        assignableUsersError={props.assignableUsersError}
        assignableUsersAvailabilityMessage={props.assignableUsersAvailabilityMessage}
        hiddenPullReviewerCount={props.hiddenPullReviewerCount}
        onRemoveReviewer={props.onRemoveReviewer}
        onRemoveTeamReviewer={props.onRemoveTeamReviewer}
        onAddReviewerSuggestion={props.onAddReviewerSuggestion}
        onShowAllReviewers={props.onShowAllReviewers}
        onReviewerEntryChange={props.onReviewerEntryChange}
        onTeamReviewerEntryChange={props.onTeamReviewerEntryChange}
        onSubmitReviewerRequest={props.onSubmitReviewerRequest}
      />
      <PullRequestConversationActions
        commentBody={props.commentBody}
        reviewBody={props.reviewBody}
        pullActionLabel={props.pullActionLabel}
        pullCommentMutationActive={props.pullCommentMutationActive}
        pullReviewMutationActive={props.pullReviewMutationActive}
        submittedPullAction={props.submittedPullAction}
        mutationPending={props.mutationPending}
        mutationSucceeded={props.mutationSucceeded}
        mutationError={props.mutationError}
        pullCommentDisabledReason={props.pullCommentDisabledReason}
        selectedReviewDisabledReason={props.selectedReviewDisabledReason}
        reviewCommentDisabledReason={props.reviewCommentDisabledReason}
        pullActionDisabledReason={props.pullActionDisabledReason}
        selectedMergeDisabledReason={props.selectedMergeDisabledReason}
        onCommentBodyChange={props.onCommentBodyChange}
        onReviewBodyChange={props.onReviewBodyChange}
        onSubmitComment={props.onSubmitComment}
        onSubmitReview={props.onSubmitReview}
        onRunPullAction={props.onRunPullAction}
        onMerge={props.onMerge}
      />
    </>
  );
}
