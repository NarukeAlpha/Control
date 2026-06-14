import {
  ArrowLeft,
  ChevronDown,
  CheckCircle2,
  FileText,
  GitCommitHorizontal,
  GitMerge,
  MessageSquare,
  Plus,
  Search
} from "lucide-react";
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
import {
  DetailLayout,
  FilterBar,
  RailSection,
  StateSegmentedControl,
  Timeline
} from "@renderer/components/ui/primitives";

import { readAvailabilityMessage } from "@renderer/components/repository/repositoryUi";
import { formatCompactNumber } from "@renderer/utils/format";
import { PullRequestInspection } from "./PullRequestInspection";
import { PullRequestCreateForm, type PullRequestCreateDraft } from "./PullRequestCreateForm";
import {
  PullRequestCommentComposer,
  PullRequestMergeActions,
  PullRequestReviewActions
} from "./PullRequestConversationActions";
import { PullRequestDetailHeader } from "./PullRequestDetailSummary";
import { PullRequestDiscussion } from "./PullRequestDiscussion";
import { PullRequestList } from "./PullRequestList";
import { PullRequestMetadataControls } from "./PullRequestMetadataControls";
import { PullRequestReviewerControls } from "./PullRequestReviewerControls";
import { PullRequestTimelineActivity } from "./PullRequestTimelineActivity";
import {
  isPullRequestDetailSectionRequested,
  type PullRequestDetailSection,
  type RequestedPullRequestDetailSections
} from "./PullRequestsTab.queries";
import type {
  PullRequestLinkedIssue,
  PullRequestMergeMethod,
  PullRequestMergeMethodOption
} from "./PullRequestsTab.types";

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
  mergeMethodOptions: PullRequestMergeMethodOption[];
  selectedMergeMethod: PullRequestMergeMethod;
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
  onMerge(method: PullRequestMergeMethod): void;
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
  const { creating, focusedPullNumber, onRequestPullDetailSection, requestedPullDetailSections } = props;
  const selectedPullNumber = props.selectedPull?.number ?? null;
  const pullDetailRoute = focusedPullNumber !== null && !creating;
  const coreTimelineSectionsRequested =
    requestedPullDetailSections.comments === true &&
    requestedPullDetailSections.commits === true &&
    requestedPullDetailSections.reviews === true &&
    requestedPullDetailSections.timeline === true;

  useEffect(() => {
    if (!pullDetailRoute || focusedPullNumber === null || coreTimelineSectionsRequested) {
      return;
    }

    onRequestPullDetailSection("comments");
    onRequestPullDetailSection("commits");
    onRequestPullDetailSection("reviews");
    onRequestPullDetailSection("timeline");
  }, [coreTimelineSectionsRequested, focusedPullNumber, onRequestPullDetailSection, pullDetailRoute]);

  useEffect(() => {
    if (creating || selectedPullNumber === null || !pullDetailRoute) {
      return;
    }

    const detailPane = detailPaneRef.current;
    if (!detailPane) {
      return;
    }

    detailPane.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    detailPane.focus({ preventScroll: true });
  }, [creating, pullDetailRoute, selectedPullNumber]);

  function handleSelectPull(pull: PullRequestSummary): void {
    props.onSelectPull(pull);
  }

  return (
    <section className="table-panel github-surface">
      {!pullDetailRoute && !props.creating && (
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
      <div
        className={`github-split${
          pullDetailRoute || props.creating ? " detail-route" : " pull-request-list-route"
        }`}
      >
        {!pullDetailRoute && !props.creating ? (
          <PullRequestList
            pulls={props.filteredPulls}
            selectedPullNumber={null}
            creating={props.creating}
            loading={props.loading}
            availabilityMessage={props.pullsAvailabilityMessage}
            filter={props.filter}
            pullRequestListLimit={props.pullRequestListLimit}
            onSelect={handleSelectPull}
            onExpandPullRequests={props.onExpandPullRequests}
          />
        ) : null}
        {(pullDetailRoute || props.creating) && (
          <PullRequestDetailPane {...props} detailPaneRef={detailPaneRef} pullDetailRoute={pullDetailRoute} />
        )}
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
        <PullRequestDetailRouteToolbar
          selectedPull={props.selectedPull}
          detail={props.detail}
          selectedReviewDecision={props.selectedReviewDecision}
          selectedMergeDisabledReason={props.selectedMergeDisabledReason}
          mergeMethodOptions={props.mergeMethodOptions}
          selectedMergeMethod={props.selectedMergeMethod}
          onOpenPullRequestList={props.onOpenPullRequestList}
          onMerge={props.onMerge}
        />
      )}
      <PullRequestSelectedDetail {...props} selectedPull={props.selectedPull} />
    </div>
  );
}

type PullRequestMergeStatusTone = "ready" | "blocked" | "pending" | "merged" | "closed";

interface PullRequestMergeStatus {
  label: string;
  detail: string;
  tone: PullRequestMergeStatusTone;
  canMerge: boolean;
}

const successfulCheckConclusions = new Set(["success", "neutral", "skipped"]);

function pullRequestMergeStatus({
  selectedPull,
  detail,
  selectedReviewDecision,
  selectedMergeDisabledReason
}: {
  selectedPull: PullRequestSummary;
  detail: PullRequestDetail | null;
  selectedReviewDecision: string | null;
  selectedMergeDisabledReason: string | null;
}): PullRequestMergeStatus {
  if (selectedPull.merged) {
    return {
      label: "Merged",
      detail: selectedMergeDisabledReason ?? "Pull request is already merged.",
      tone: "merged",
      canMerge: false
    };
  }

  if (selectedPull.state !== "open") {
    return {
      label: "Closed",
      detail: selectedMergeDisabledReason ?? "Pull request is not open.",
      tone: "closed",
      canMerge: false
    };
  }

  const reviewDecision = selectedReviewDecision?.toUpperCase() ?? null;
  if (reviewDecision === "CHANGES_REQUESTED") {
    return {
      label: "Changes requested",
      detail: "A reviewer requested changes before this pull request can merge.",
      tone: "blocked",
      canMerge: false
    };
  }

  if (reviewDecision === "REVIEW_REQUIRED") {
    return {
      label: "Pending review",
      detail: "Required review has not been completed yet.",
      tone: "pending",
      canMerge: false
    };
  }

  const checks = detail?.checks ?? [];
  const failingCheck = checks.find((check) => {
    const conclusion = check.conclusion?.toLowerCase();
    return conclusion ? !successfulCheckConclusions.has(conclusion) : false;
  });
  if (failingCheck) {
    return {
      label: "Checks failing",
      detail: `${failingCheck.name} did not pass.`,
      tone: "blocked",
      canMerge: false
    };
  }

  const pendingCheck = checks.find(
    (check) => check.status?.toLowerCase() !== "completed" || !check.conclusion
  );
  if (pendingCheck) {
    return {
      label: "Checks pending",
      detail: `${pendingCheck.name} has not completed yet.`,
      tone: "pending",
      canMerge: false
    };
  }

  if (selectedMergeDisabledReason) {
    return {
      label: "Merge blocked",
      detail: selectedMergeDisabledReason,
      tone: "blocked",
      canMerge: false
    };
  }

  return {
    label: "Ready to merge",
    detail: "This pull request can be merged from Control.",
    tone: "ready",
    canMerge: true
  };
}

function PullRequestDetailRouteToolbar({
  selectedPull,
  detail,
  selectedReviewDecision,
  selectedMergeDisabledReason,
  mergeMethodOptions,
  selectedMergeMethod,
  onOpenPullRequestList,
  onMerge
}: {
  selectedPull: PullRequestSummary;
  detail: PullRequestDetail | null;
  selectedReviewDecision: string | null;
  selectedMergeDisabledReason: string | null;
  mergeMethodOptions: PullRequestMergeMethodOption[];
  selectedMergeMethod: PullRequestMergeMethod;
  onOpenPullRequestList(): void;
  onMerge(method: PullRequestMergeMethod): void;
}): JSX.Element {
  return (
    <div className="detail-toolbar">
      <button type="button" onClick={onOpenPullRequestList}>
        <ArrowLeft size={16} /> Back to pull requests
      </button>
      <PullRequestMergeStatusMenu
        selectedPull={selectedPull}
        detail={detail}
        selectedReviewDecision={selectedReviewDecision}
        selectedMergeDisabledReason={selectedMergeDisabledReason}
        mergeMethodOptions={mergeMethodOptions}
        selectedMergeMethod={selectedMergeMethod}
        onMerge={onMerge}
      />
    </div>
  );
}

function PullRequestMergeStatusMenu({
  selectedPull,
  detail,
  selectedReviewDecision,
  selectedMergeDisabledReason,
  mergeMethodOptions,
  selectedMergeMethod,
  onMerge
}: {
  selectedPull: PullRequestSummary;
  detail: PullRequestDetail | null;
  selectedReviewDecision: string | null;
  selectedMergeDisabledReason: string | null;
  mergeMethodOptions: PullRequestMergeMethodOption[];
  selectedMergeMethod: PullRequestMergeMethod;
  onMerge(method: PullRequestMergeMethod): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const status = pullRequestMergeStatus({
    selectedPull,
    detail,
    selectedReviewDecision,
    selectedMergeDisabledReason
  });

  function handleToggle(): void {
    if (status.canMerge) {
      setOpen((current) => !current);
    }
  }

  function handleMerge(method: PullRequestMergeMethod): void {
    setOpen(false);
    onMerge(method);
  }

  return (
    <div className="pr-merge-status-menu">
      <button
        type="button"
        className={`pr-merge-status-button ${status.tone}`}
        aria-expanded={status.canMerge ? open : undefined}
        disabled={!status.canMerge}
        title={status.detail}
        onClick={handleToggle}
      >
        <GitMerge size={16} />
        <span>{status.label}</span>
        {status.canMerge && <ChevronDown size={15} aria-hidden="true" />}
      </button>
      {open && (
        <div className="pr-merge-status-popover" role="menu" aria-label="Merge options">
          <strong>Merge options</strong>
          <p>{status.detail}</p>
          {mergeMethodOptions.map((option) => (
            <button
              key={option.method}
              type="button"
              className={option.method === selectedMergeMethod ? "dark-action" : undefined}
              role="menuitem"
              title={option.detail}
              onClick={() => handleMerge(option.method)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type PullRequestDetailTab = "conversation" | "commits" | "checks" | "files";

function PullRequestDetailTabs({
  selectedPull,
  detail,
  activeTab,
  onSelectTab
}: {
  selectedPull: PullRequestSummary;
  detail: PullRequestDetail | null;
  activeTab: PullRequestDetailTab;
  onSelectTab(tab: PullRequestDetailTab): void;
}): JSX.Element {
  const tabs = [
    {
      key: "conversation" as const,
      label: "Conversation",
      count: selectedPull.comments,
      icon: MessageSquare
    },
    {
      key: "commits" as const,
      label: "Commits",
      count: detail?.commitsList.length ?? null,
      icon: GitCommitHorizontal
    },
    {
      key: "checks" as const,
      label: "Checks",
      count: detail?.checks.length ?? null,
      icon: CheckCircle2
    },
    {
      key: "files" as const,
      label: "Files changed",
      count: selectedPull.changedFiles,
      icon: FileText
    }
  ];
  const diffTotal = selectedPull.additions + selectedPull.deletions;
  const additionBars = diffTotal > 0 ? Math.round((selectedPull.additions / diffTotal) * 5) : 0;

  return (
    <div className="pr-detail-tab-row">
      <div className="pr-detail-tabs" role="tablist" aria-label="Pull request detail sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              id={`pull-request-${tab.key}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`pull-request-${tab.key}-panel`}
              className={selected ? "active" : ""}
              onClick={() => onSelectTab(tab.key)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.count !== null && <span className="tab-count">{formatCompactNumber(tab.count)}</span>}
            </button>
          );
        })}
      </div>
      <div className="pr-detail-tab-stats" aria-label="Pull request diff summary">
        <span className="additions">+{formatCompactNumber(selectedPull.additions)}</span>
        <span className="deletions">-{formatCompactNumber(selectedPull.deletions)}</span>
        <span className="pr-detail-diff-bars" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={`diff-bar-${index}`}
              className={diffTotal === 0 ? "neutral" : index < additionBars ? "addition" : "deletion"}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function PullRequestDevelopmentRail({
  detail,
  loading,
  requestedSections,
  onRequestLinkedIssues,
  onOpenIssueReference
}: {
  detail: PullRequestDetail | null;
  loading: boolean;
  requestedSections: RequestedPullRequestDetailSections;
  onRequestLinkedIssues(): void;
  onOpenIssueReference(issue: PullRequestLinkedIssue): void;
}): JSX.Element {
  const linkedIssues = detail?.linkedIssues ?? [];
  const linkedIssuesRequested = isPullRequestDetailSectionRequested(requestedSections, "linked-issues");
  const linkedIssuesAvailabilityMessage = readAvailabilityMessage(
    "Linked issues",
    detail?.linkedIssuesAvailability ?? null
  );

  return (
    <div className="pr-development-rail">
      {!linkedIssuesRequested && (
        <button type="button" onClick={onRequestLinkedIssues}>
          Load linked issues
        </button>
      )}
      {linkedIssues.map((issue) => (
        <div
          className="pr-development-issue"
          key={`${issue.repositoryNameWithOwner ?? "repo"}#${issue.number}`}
        >
          <button type="button" onClick={() => onOpenIssueReference(issue)}>
            <strong>
              {issue.repositoryNameWithOwner ? `${issue.repositoryNameWithOwner} ` : ""}#{issue.number}
            </strong>
            <span>{issue.title ?? "Untitled issue"}</span>
          </button>
        </div>
      ))}
      {linkedIssuesRequested && !loading && linkedIssuesAvailabilityMessage && (
        <div className="error-state">{linkedIssuesAvailabilityMessage}</div>
      )}
      {linkedIssuesRequested && !loading && !linkedIssuesAvailabilityMessage && linkedIssues.length === 0 && (
        <p>No linked issues.</p>
      )}
    </div>
  );
}

function PullRequestSelectedDetail(props: PullRequestSelectedDetailProps): JSX.Element {
  const [activeDetailTabState, setActiveDetailTabState] = useState<{
    pullNumber: number;
    tab: PullRequestDetailTab;
  }>({
    pullNumber: props.selectedPull.number,
    tab: "conversation"
  });
  const activeDetailTab =
    activeDetailTabState.pullNumber === props.selectedPull.number ? activeDetailTabState.tab : "conversation";
  const commentsRequested = isPullRequestDetailSectionRequested(
    props.requestedPullDetailSections,
    "comments"
  );

  function handleRequestComments(): void {
    props.onRequestPullDetailSection("comments");
  }

  function handleSelectDetailTab(tab: PullRequestDetailTab): void {
    setActiveDetailTabState({ pullNumber: props.selectedPull.number, tab });

    if (tab === "conversation") {
      props.onRequestPullDetailSection("comments");
      props.onRequestPullDetailSection("commits");
      props.onRequestPullDetailSection("reviews");
      props.onRequestPullDetailSection("timeline");
      return;
    }

    if (tab === "commits") {
      props.onRequestPullDetailSection("commits");
      return;
    }

    if (tab === "checks") {
      props.onRequestPullDetailSection("checks");
      return;
    }

    props.onRequestPullDetailSection("review-threads");
    props.onRequestPullDetailSection("files");
  }

  const changedFilesRepositoryNameWithOwner =
    props.detail?.headRepositoryNameWithOwner ??
    props.detail?.repositoryNameWithOwner ??
    props.repository.nameWithOwner;
  const mergeStatus = pullRequestMergeStatus({
    selectedPull: props.selectedPull,
    detail: props.detail,
    selectedReviewDecision: props.selectedReviewDecision,
    selectedMergeDisabledReason: props.selectedMergeDisabledReason
  });
  const timelineMergeDisabledReason = mergeStatus.canMerge ? null : mergeStatus.detail;

  const rail = (
    <>
      <RailSection title="Development">
        <PullRequestDevelopmentRail
          detail={props.detail}
          loading={props.pullDetailLoading}
          requestedSections={props.requestedPullDetailSections}
          onRequestLinkedIssues={() => props.onRequestPullDetailSection("linked-issues")}
          onOpenIssueReference={props.onOpenIssueReference}
        />
      </RailSection>
      <RailSection title="Metadata">
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
      </RailSection>
      <RailSection title="Reviewers">
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
      </RailSection>
      <RailSection title="Review">
        <PullRequestReviewActions
          reviewBody={props.reviewBody}
          pullReviewMutationActive={props.pullReviewMutationActive}
          submittedPullAction={props.submittedPullAction}
          mutationPending={props.mutationPending}
          mutationSucceeded={props.mutationSucceeded}
          mutationError={props.mutationError}
          selectedReviewDisabledReason={props.selectedReviewDisabledReason}
          reviewCommentDisabledReason={props.reviewCommentDisabledReason}
          onReviewBodyChange={props.onReviewBodyChange}
          onSubmitReview={props.onSubmitReview}
        />
      </RailSection>
    </>
  );

  return (
    <>
      <PullRequestDetailHeader
        selectedPull={props.selectedPull}
        selectedMerged={props.selectedMerged}
        selectedReviewDecision={props.selectedReviewDecision}
        reviewDecisionAvailabilityMessage={props.reviewDecisionAvailabilityMessage}
      />
      {props.pullDetailError && <div className="error-state">{props.pullDetailError.message}</div>}
      {props.pullDetailAvailabilityMessage && (
        <div className="error-state">{props.pullDetailAvailabilityMessage}</div>
      )}
      <PullRequestDetailTabs
        selectedPull={props.selectedPull}
        detail={props.detail}
        activeTab={activeDetailTab}
        onSelectTab={handleSelectDetailTab}
      />
      <DetailLayout className="pr-detail-layout" rail={rail}>
        {activeDetailTab === "conversation" && (
          <Timeline
            id="pull-request-conversation-panel"
            className="pr-detail-timeline"
            role="tabpanel"
            aria-labelledby="pull-request-conversation-tab"
          >
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
            <PullRequestTimelineActivity
              detail={props.detail}
              loading={props.pullDetailLoading}
              requestedSections={props.requestedPullDetailSections}
              changedFilesRepositoryNameWithOwner={changedFilesRepositoryNameWithOwner}
              showEmptyNotes={false}
              onRequestReviews={() => props.onRequestPullDetailSection("reviews")}
              onRequestTimeline={() => props.onRequestPullDetailSection("timeline")}
              onRequestCommits={() => props.onRequestPullDetailSection("commits")}
              onOpenIssueReference={props.onOpenIssueReference}
              onOpenPullRequestCommit={props.onOpenPullRequestCommit}
              onOpenPullRequestReviewCommit={props.onOpenPullRequestReviewCommit}
              onOpenPullRequestTimelineEventCommit={props.onOpenPullRequestTimelineEventCommit}
            />
            <PullRequestMergeActions
              pullActionLabel={props.pullActionLabel}
              pullActionDisabledReason={props.pullActionDisabledReason}
              selectedMergeDisabledReason={timelineMergeDisabledReason}
              mergeMethodOptions={props.mergeMethodOptions}
              selectedMergeMethod={props.selectedMergeMethod}
              onRunPullAction={props.onRunPullAction}
              onMerge={props.onMerge}
            />
            <PullRequestCommentComposer
              commentBody={props.commentBody}
              pullCommentMutationActive={props.pullCommentMutationActive}
              mutationPending={props.mutationPending}
              mutationSucceeded={props.mutationSucceeded}
              mutationError={props.mutationError}
              pullCommentDisabledReason={props.pullCommentDisabledReason}
              onCommentBodyChange={props.onCommentBodyChange}
              onSubmitComment={props.onSubmitComment}
            />
          </Timeline>
        )}
        {activeDetailTab === "commits" && (
          <section
            id="pull-request-commits-panel"
            className="pr-detail-tab-panel"
            role="tabpanel"
            aria-labelledby="pull-request-commits-tab"
          >
            <PullRequestInspection
              repository={props.repository}
              detail={props.detail}
              loading={props.pullDetailLoading}
              requestedSections={props.requestedPullDetailSections}
              sections={["commits"]}
              className="pr-tab-inspection pr-tab-inspection-single"
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
          </section>
        )}
        {activeDetailTab === "checks" && (
          <section
            id="pull-request-checks-panel"
            className="pr-detail-tab-panel"
            role="tabpanel"
            aria-labelledby="pull-request-checks-tab"
          >
            <PullRequestInspection
              repository={props.repository}
              detail={props.detail}
              loading={props.pullDetailLoading}
              requestedSections={props.requestedPullDetailSections}
              sections={["checks"]}
              className="pr-tab-inspection pr-tab-inspection-single"
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
          </section>
        )}
        {activeDetailTab === "files" && (
          <section
            id="pull-request-files-panel"
            className="pr-detail-tab-panel"
            role="tabpanel"
            aria-labelledby="pull-request-files-tab"
          >
            <PullRequestInspection
              repository={props.repository}
              detail={props.detail}
              loading={props.pullDetailLoading}
              requestedSections={props.requestedPullDetailSections}
              sections={["review-threads", "files"]}
              className="pr-tab-inspection"
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
          </section>
        )}
      </DetailLayout>
    </>
  );
}
