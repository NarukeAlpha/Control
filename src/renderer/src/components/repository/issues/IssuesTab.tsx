import { ArrowLeft, CircleDot, Plus, Search } from "lucide-react";
import { useEffect, useReducer, useRef, type CSSProperties, type ChangeEvent, type JSX } from "react";

import type {
  GitHubAction,
  GitHubMutationFields,
  IssueDetail,
  IssueStateFilter,
  IssueSummary,
  LabelSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import { markdownRepositoryUrlContext, type MarkdownUrlContext } from "@renderer/components/MarkdownBody";
import { useIssueDetail } from "@renderer/components/repository/issues/useIssueDetail";
import {
  fieldsMatchSearchParts,
  githubActionLabel,
  normalizedSearchParts,
  readAvailabilityMessage,
  repositoryMutationDisabledReason
} from "@renderer/components/repository/repositoryUi";
import { TimelineThread } from "@renderer/components/shared/TimelineThread";
import {
  DetailLayout,
  FilterBar,
  RailSection,
  StateSegmentedControl,
  Timeline
} from "@renderer/components/ui";

import { formatRelativeDate } from "@renderer/utils/format";
import { IssueActionFooter } from "./IssueActionFooter";
import { IssueCommentComposer } from "./IssueCommentComposer";
import { IssueCreateForm } from "./IssueCreateForm";
import { IssueEditForm } from "./IssueEditForm";
import { IssueMetadataControls } from "./IssueMetadataControls";
import { useIssuesTabQueries } from "./IssuesTab.queries";

const maxIssueListLimit = 100;
const issueStateFilterOptions: Array<{ value: IssueStateFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" }
];
type IssueCloseReason = "completed" | "not_planned";
type IssueStateAction = "closeIssue" | "reopenIssue";

interface IssuesTabUiState {
  filter: string;
  creating: boolean;
  editingIssue: boolean;
  title: string;
  body: string;
  createLabelEntry: string;
  createAssigneeEntry: string;
  createMilestoneNumber: string;
  editTitle: string;
  editBody: string;
  editMilestoneNumber: string;
  commentBody: string;
  labelEntry: string;
  assigneeEntry: string;
  closeReason: IssueCloseReason;
  submittedIssueAction: GitHubAction | null;
  showAllIssueLabels: boolean;
  showAllIssueAssignableUsers: boolean;
  showAllIssueMilestones: boolean;
}

type IssuesTabUiAction =
  | { type: "set"; values: Partial<IssuesTabUiState> }
  | { type: "startCreating" }
  | { type: "cancelCreating" }
  | {
      type: "startEditing";
      title: string;
      body: string;
      milestoneNumber: string;
    }
  | { type: "cancelEditing" };

function createIssuesTabUiState({
  initialFilter,
  initialCreating
}: {
  initialFilter: string;
  initialCreating: boolean;
}): IssuesTabUiState {
  return {
    filter: initialFilter,
    creating: initialCreating,
    editingIssue: false,
    title: "",
    body: "",
    createLabelEntry: "",
    createAssigneeEntry: "",
    createMilestoneNumber: "",
    editTitle: "",
    editBody: "",
    editMilestoneNumber: "",
    commentBody: "",
    labelEntry: "",
    assigneeEntry: "",
    closeReason: "completed",
    submittedIssueAction: null,
    showAllIssueLabels: false,
    showAllIssueAssignableUsers: false,
    showAllIssueMilestones: false
  };
}

function issuesTabUiReducer(state: IssuesTabUiState, action: IssuesTabUiAction): IssuesTabUiState {
  switch (action.type) {
    case "set":
      return { ...state, ...action.values };
    case "startCreating":
      return {
        ...state,
        editingIssue: false,
        submittedIssueAction: null,
        title: "",
        body: "",
        createLabelEntry: "",
        createAssigneeEntry: "",
        createMilestoneNumber: "",
        creating: true
      };
    case "cancelCreating":
      return {
        ...state,
        submittedIssueAction: null,
        title: "",
        body: "",
        createLabelEntry: "",
        createAssigneeEntry: "",
        createMilestoneNumber: "",
        creating: false
      };
    case "startEditing":
      return {
        ...state,
        submittedIssueAction: null,
        editTitle: action.title,
        editBody: action.body,
        editMilestoneNumber: action.milestoneNumber,
        editingIssue: true
      };
    case "cancelEditing":
      return {
        ...state,
        submittedIssueAction: null,
        editingIssue: false
      };
  }
}

function conversationCommentDisabledReason(
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

function githubNumericId(id: number | string): number | null {
  if (typeof id === "number" && Number.isFinite(id)) {
    return id;
  }
  if (typeof id === "string" && /^\d+$/.test(id)) {
    return Number(id);
  }
  return null;
}

function commaSeparatedValues(value: string): string[] {
  const values: string[] = [];
  const seenValues = new Set<string>();

  for (const item of value.split(",")) {
    const trimmed = item.trim();
    if (!trimmed || seenValues.has(trimmed)) {
      continue;
    }
    seenValues.add(trimmed);
    values.push(trimmed);
  }

  return values;
}

function appendCommaSeparatedValue(current: string, value: string): string {
  const values = commaSeparatedValues(current);
  if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
    values.push(value);
  }
  return values.join(", ");
}

function commentMutationDisabledReason(
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

function issueStateLabel(issue: IssueSummary): string {
  return issue.stateReason ? `${issue.state} · ${issue.stateReason.replace(/_/g, " ")}` : issue.state;
}

function issueStateIconClassName(issue: IssueSummary): string {
  const closedTone = issue.stateReason === "not_planned" ? "not-planned" : "completed";
  return `issue-state-icon ${issue.state === "open" ? "open" : closedTone}`;
}

function labelColorStyle(label: LabelSummary): CSSProperties {
  return { "--issue-label-color": `#${label.color}` } as CSSProperties;
}

function IssueLabelChip({ label }: { label: LabelSummary }): JSX.Element {
  return (
    <span className="issue-label-chip" style={labelColorStyle(label)}>
      <i aria-hidden="true" />
      {label.name}
    </span>
  );
}

function IssueListRow({
  issue,
  onOpenIssue
}: {
  issue: IssueSummary;
  onOpenIssue(issue: IssueSummary): void;
}): JSX.Element {
  const visibleLabels = issue.labels.slice(0, 2);
  const hiddenLabels = issue.labels.slice(2);
  const visibleAssignees = (issue.assignees ?? []).slice(0, 2);
  const hiddenAssignees = (issue.assignees ?? []).slice(2);

  function handleOpenIssue(): void {
    onOpenIssue(issue);
  }

  return (
    <div className="issue-row thread-list-action-row">
      <button className="thread-list-row-main" type="button" onClick={handleOpenIssue}>
        <CircleDot className={issueStateIconClassName(issue)} size={17} />
        <div className="issue-row-copy">
          <strong>{issue.title}</strong>
          <small className="issue-row-meta">
            #{issue.number} opened by {issue.authorLogin ?? "unknown"} · {issue.comments} comments
          </small>
        </div>
        <div className="thread-list-row-badges">
          <div className="label-stack">
            {visibleLabels.map((label) => (
              <IssueLabelChip key={label.id} label={label} />
            ))}
            {hiddenLabels.length > 0 && (
              <span title={`Hidden labels: ${hiddenLabels.map((label) => label.name).join(", ")}`}>
                +{hiddenLabels.length} {hiddenLabels.length === 1 ? "label" : "labels"}
              </span>
            )}
            {issue.milestone && (
              <span title={`Milestone ${issue.milestone.title}`}>{issue.milestone.title}</span>
            )}
            {visibleAssignees.map((assignee) => (
              <span key={assignee.id}>@{assignee.login}</span>
            ))}
            {hiddenAssignees.length > 0 && (
              <span
                title={`Hidden assignees: ${hiddenAssignees
                  .map((assignee) => `@${assignee.login}`)
                  .join(", ")}`}
              >
                +{hiddenAssignees.length} {hiddenAssignees.length === 1 ? "assignee" : "assignees"}
              </span>
            )}
          </div>
          <span className={`state-chip ${issue.state === "open" ? "success" : ""}`}>
            {issueStateLabel(issue)}
          </span>
          {issue.locked && <span className="state-chip attention">locked</span>}
        </div>
      </button>
    </div>
  );
}

function IssueList({
  issues,
  loading,
  availabilityMessage,
  filter,
  issueListLimit,
  unfilteredIssueListLimitHit,
  onOpenIssue,
  onExpandIssues
}: {
  issues: IssueSummary[];
  loading: boolean;
  availabilityMessage: string | null;
  filter: string;
  issueListLimit: number;
  unfilteredIssueListLimitHit: boolean;
  onOpenIssue(issue: IssueSummary): void;
  onExpandIssues(): void;
}): JSX.Element {
  return (
    <div className="thread-list issues-list-content">
      {loading && issues.length === 0 && <div className="loading-state">Loading issues…</div>}
      {!loading && availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {issues.map((issue) => (
        <IssueListRow key={issue.id} issue={issue} onOpenIssue={onOpenIssue} />
      ))}
      {!loading && issues.length === 0 && (
        <div className="empty-state">
          {filter.trim() ? "No issues match this filter." : "No issues returned for this repository."}
        </div>
      )}
      {unfilteredIssueListLimitHit && issueListLimit < maxIssueListLimit && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandIssues}>
            Load more issues
          </button>
        </div>
      )}
      {unfilteredIssueListLimitHit && issueListLimit >= maxIssueListLimit && (
        <div className="muted-row">Showing the first {issueListLimit} issues returned by GitHub.</div>
      )}
    </div>
  );
}

function IssueDiscussionThread({
  repository,
  selectedIssue,
  detail,
  loading,
  markdownUrlContext,
  issueActionPendingReason,
  liveIssueDisabledReason,
  onOpenExternal,
  onEditComment,
  onDeleteComment
}: {
  repository: RepositoryDetail;
  selectedIssue: IssueSummary;
  detail: IssueDetail | null;
  loading: boolean;
  markdownUrlContext: MarkdownUrlContext;
  issueActionPendingReason: string | null;
  liveIssueDisabledReason: string | null;
  onOpenExternal(url: string): void;
  onEditComment(commentId: number, body: string): void;
  onDeleteComment(commentId: number): void;
}): JSX.Element {
  function getCommentDisabledReason(comment: TimelineCommentSummary): string | null {
    return (
      issueActionPendingReason ??
      liveIssueDisabledReason ??
      commentMutationDisabledReason(repository, comment)
    );
  }

  function handleEditComment(comment: TimelineCommentSummary, body: string): void {
    const commentId = githubNumericId(comment.id);
    if (commentId === null) {
      return;
    }
    onEditComment(commentId, body);
  }

  function handleDeleteComment(comment: TimelineCommentSummary): void {
    const commentId = githubNumericId(comment.id);
    if (commentId === null) {
      return;
    }
    onDeleteComment(commentId);
  }

  return (
    <TimelineThread
      title={`Issue ${selectedIssue.number} discussion`}
      authorLogin={detail?.authorLogin ?? selectedIssue.authorLogin}
      authorAvatarUrl={detail?.authorAvatarUrl ?? selectedIssue.authorAvatarUrl}
      createdAt={detail?.createdAt ?? selectedIssue.createdAt}
      body={detail?.body}
      comments={detail?.commentsList ?? []}
      loading={loading}
      availabilityMessage={readAvailabilityMessage("Issue comments", detail?.commentsAvailability ?? null)}
      emptyBody="No description provided."
      markdownUrlContext={markdownUrlContext}
      onOpenExternal={onOpenExternal}
      commentActions={{
        getDisabledReason: getCommentDisabledReason,
        onEdit: handleEditComment,
        onDelete: handleDeleteComment
      }}
    />
  );
}

interface IssuesTabProps {
  repository: RepositoryDetail;
  githubReady: boolean;
  issueListLimit: number;
  issueState: IssueStateFilter;
  focusedIssueNumber: number | null;
  initialFilter: string;
  initialCreating: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onOpenExternal(url: string): void;
  onOpenIssueList(): void;
  onOpenIssueDetail(issue: IssueSummary, issueState: IssueStateFilter, filter: string): void;
  onIssueStateChange(issueState: IssueStateFilter, filter: string): void;
  onExpandIssues(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}

function useIssuesTabModel({
  repository,
  githubReady,
  issueListLimit,
  issueState,
  focusedIssueNumber,
  initialFilter,
  initialCreating,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onOpenExternal,
  onOpenIssueList,
  onOpenIssueDetail,
  onIssueStateChange,
  onExpandIssues,
  onMutate
}: IssuesTabProps) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [uiState, dispatchUiState] = useReducer(
    issuesTabUiReducer,
    { initialFilter, initialCreating },
    createIssuesTabUiState
  );
  const {
    filter,
    creating,
    editingIssue,
    title,
    body,
    createLabelEntry,
    createAssigneeEntry,
    createMilestoneNumber,
    editTitle,
    editBody,
    editMilestoneNumber,
    commentBody,
    labelEntry,
    assigneeEntry,
    closeReason,
    submittedIssueAction,
    showAllIssueLabels,
    showAllIssueAssignableUsers,
    showAllIssueMilestones
  } = uiState;
  const {
    issues: issuesQuery,
    labels: labelsQuery,
    assignableUsers: assignableUsersQuery,
    milestones: milestonesQuery,
    labelItems: labels,
    labelAvailability: labelsAvailability,
    assignableUserItems: assignableUsers,
    assignableUsersAvailability,
    milestoneItems: milestones,
    milestonesAvailability
  } = useIssuesTabQueries({
    owner: repository.owner,
    repo: repository.name,
    issueState,
    issueListLimit,
    issuesEnabled: true,
    resourcesEnabled: true,
    githubReady
  });
  const issues = issuesQuery.data?.items ?? [];
  const availability = issuesQuery.data?.availability ?? null;
  const loading = issuesQuery.isLoading || issuesQuery.isFetching;
  const labelsLoading = labelsQuery.isLoading || labelsQuery.isFetching;
  const labelsError = labelsQuery.error;
  const assignableUsersLoading = assignableUsersQuery.isLoading || assignableUsersQuery.isFetching;
  const assignableUsersError = assignableUsersQuery.error;
  const milestonesLoading = milestonesQuery.isLoading || milestonesQuery.isFetching;
  const milestonesError = milestonesQuery.error;
  const labelsAvailabilityMessage = readAvailabilityMessage("Labels", labelsAvailability);
  const assignableUsersAvailabilityMessage = readAvailabilityMessage(
    "Assignable users",
    assignableUsersAvailability
  );
  const milestonesAvailabilityMessage = readAvailabilityMessage("Milestones", milestonesAvailability);
  const issuesAvailabilityMessage = readAvailabilityMessage("Issues", availability);
  const filterParts = normalizedSearchParts(filter);
  const filteredIssues = issues.filter((issue) =>
    fieldsMatchSearchParts(
      [
        issue.number,
        issue.title,
        issue.state,
        issueStateLabel(issue),
        issue.stateReason,
        issue.authorLogin,
        issue.milestone?.title,
        ...issue.labels.flatMap((label) => [label.name, `label:${label.name}`]),
        ...(issue.assignees ?? []).flatMap((assignee) => [assignee.login, `assignee:${assignee.login}`])
      ],
      filterParts
    )
  );
  const issueDetailRoute = focusedIssueNumber !== null && !creating;
  const requestedIssueNumber = focusedIssueNumber;
  const selectedIssueSummary =
    (requestedIssueNumber !== null ? issues.find((issue) => issue.number === requestedIssueNumber) : null) ??
    null;
  const issueDetailNumber = issueDetailRoute ? requestedIssueNumber : null;
  const issueDetail = useIssueDetail(issueDetailNumber, issueDetailNumber !== null);
  const detail = issueDetail.data?.detail ?? null;
  const selectedIssue = detail ?? selectedIssueSummary;
  const issueDetailAvailabilityMessage = readAvailabilityMessage(
    "Issue detail",
    issueDetail.data?.availability ?? null
  );
  const selectedLabels = detail?.labels ?? selectedIssue?.labels ?? [];
  const selectedAssignees = detail?.assignees ?? selectedIssue?.assignees ?? [];
  const selectedMilestone = detail?.milestone ?? selectedIssue?.milestone ?? null;
  const issueAction: IssueStateAction = selectedIssue?.state === "closed" ? "reopenIssue" : "closeIssue";
  const issueActionLabel = selectedIssue?.state === "closed" ? "Reopen issue" : "Close issue";
  const issueMutationAction =
    mutationAction === "createIssue" ||
    mutationAction === "editIssue" ||
    mutationAction === "closeIssue" ||
    mutationAction === "reopenIssue" ||
    mutationAction === "addComment" ||
    mutationAction === "editComment" ||
    mutationAction === "deleteComment" ||
    mutationAction === "editReviewComment" ||
    mutationAction === "deleteReviewComment" ||
    mutationAction === "addLabels" ||
    mutationAction === "removeLabel" ||
    mutationAction === "setAssignees" ||
    mutationAction === "removeAssignees"
      ? mutationAction
      : null;
  const issueActionPendingReason =
    mutationPending && issueMutationAction
      ? `${githubActionLabel(issueMutationAction)} is still running.`
      : null;
  const liveIssueDisabledReason = !githubReady ? "Sign in with GitHub to change issues." : null;
  const issueActionDisabledReason =
    issueActionPendingReason ?? liveIssueDisabledReason ?? repositoryMutationDisabledReason(repository);
  const createIssueDisabledReason =
    issueActionPendingReason ?? liveIssueDisabledReason ?? repositoryMutationDisabledReason(repository);
  const createIssueMutationActive =
    submittedIssueAction === "createIssue" && mutationAction === "createIssue";
  const editIssueMutationActive = submittedIssueAction === "editIssue" && mutationAction === "editIssue";
  const issueCommentMutationActive = submittedIssueAction === "addComment" && mutationAction === "addComment";
  const createIssueSubmitDisabledReason =
    createIssueDisabledReason ?? (!title.trim() ? "Issue title is required." : null);
  const editIssueSubmitDisabledReason =
    issueActionDisabledReason ?? (!editTitle.trim() ? "Issue title is required." : null);
  const issueCommentDisabledReason = selectedIssue
    ? (issueActionPendingReason ??
      liveIssueDisabledReason ??
      conversationCommentDisabledReason(repository, selectedIssue.locked))
    : null;
  const parsedLabels = commaSeparatedValues(labelEntry);
  const parsedAssignees = commaSeparatedValues(assigneeEntry);
  const issueLabelSubmitDisabledReason =
    issueActionDisabledReason ?? (parsedLabels.length === 0 ? "Add at least one label." : null);
  const issueAssigneeSubmitDisabledReason =
    issueActionDisabledReason ?? (parsedAssignees.length === 0 ? "Add at least one assignee." : null);
  const parsedCreateLabels = commaSeparatedValues(createLabelEntry);
  const parsedCreateAssignees = commaSeparatedValues(createAssigneeEntry);
  const visibleLabels = showAllIssueLabels ? labels : labels.slice(0, 10);
  const visibleAssignableUsers = showAllIssueAssignableUsers ? assignableUsers : assignableUsers.slice(0, 10);
  const visibleMilestones = showAllIssueMilestones ? milestones : milestones.slice(0, 10);
  const hiddenIssueLabelCount = labels.length - visibleLabels.length;
  const hiddenIssueAssignableUserCount = assignableUsers.length - visibleAssignableUsers.length;
  const hiddenIssueMilestoneCount = milestones.length - visibleMilestones.length;
  const unfilteredIssueListLimitHit = !filter.trim() && issues.length >= issueListLimit;
  const issueMarkdownUrlContext = markdownRepositoryUrlContext(
    repository,
    repository.defaultBranch ?? "HEAD"
  );

  function updateUiState(values: Partial<IssuesTabUiState>): void {
    dispatchUiState({ type: "set", values });
  }

  function setTitle(value: string): void {
    updateUiState({ title: value });
  }

  function setBody(value: string): void {
    updateUiState({ body: value });
  }

  function setCreateLabelEntry(value: string): void {
    updateUiState({ createLabelEntry: value });
  }

  function setCreateAssigneeEntry(value: string): void {
    updateUiState({ createAssigneeEntry: value });
  }

  function setCreateMilestoneNumber(value: string): void {
    updateUiState({ createMilestoneNumber: value });
  }

  function setEditTitle(value: string): void {
    updateUiState({ editTitle: value });
  }

  function setEditBody(value: string): void {
    updateUiState({ editBody: value });
  }

  function setEditMilestoneNumber(value: string): void {
    updateUiState({ editMilestoneNumber: value });
  }

  function setLabelEntry(value: string): void {
    updateUiState({ labelEntry: value });
  }

  function setAssigneeEntry(value: string): void {
    updateUiState({ assigneeEntry: value });
  }

  function setCommentBody(value: string): void {
    updateUiState({ commentBody: value });
  }

  function setCloseReason(value: IssueCloseReason): void {
    updateUiState({ closeReason: value });
  }

  function handleShowAllIssueLabels(): void {
    updateUiState({ showAllIssueLabels: true });
  }

  function handleShowAllIssueAssignableUsers(): void {
    updateUiState({ showAllIssueAssignableUsers: true });
  }

  function handleShowAllIssueMilestones(): void {
    updateUiState({ showAllIssueMilestones: true });
  }

  function startEditingIssue(): void {
    if (!selectedIssue) {
      return;
    }
    dispatchUiState({
      type: "startEditing",
      title: selectedIssue.title,
      body: detail?.body ?? "",
      milestoneNumber: selectedMilestone ? String(selectedMilestone.number) : ""
    });
  }

  function submitEditIssue(): void {
    if (!selectedIssue || editIssueSubmitDisabledReason) {
      return;
    }
    updateUiState({ submittedIssueAction: "editIssue" });
    onMutate("editIssue", false, {
      issueNumber: selectedIssue.number,
      title: editTitle.trim(),
      body: editBody.trim(),
      milestone: editMilestoneNumber ? Number(editMilestoneNumber) : null
    });
    updateUiState({ editingIssue: false });
  }

  function cancelEditIssue(): void {
    dispatchUiState({ type: "cancelEditing" });
  }

  function handleFilterChange(event: ChangeEvent<HTMLInputElement>): void {
    updateUiState({ filter: event.target.value });
  }

  function changeIssueState(value: IssueStateFilter): void {
    onIssueStateChange(value, filter);
  }

  function openIssueDetail(issue: IssueSummary): void {
    onOpenIssueDetail(issue, issueState, filter);
  }

  function startCreatingIssue(): void {
    dispatchUiState({ type: "startCreating" });
  }

  function submitCreateIssue(): void {
    if (createIssueSubmitDisabledReason) {
      return;
    }
    updateUiState({ submittedIssueAction: "createIssue" });
    onMutate("createIssue", false, {
      title: title.trim(),
      body: body.trim(),
      ...(parsedCreateLabels.length > 0 ? { labels: parsedCreateLabels } : {}),
      ...(parsedCreateAssignees.length > 0 ? { assignees: parsedCreateAssignees } : {}),
      ...(createMilestoneNumber ? { milestone: Number(createMilestoneNumber) } : {})
    });
  }

  function cancelCreateIssue(): void {
    dispatchUiState({ type: "cancelCreating" });
  }

  function addCreateLabel(labelName: string): void {
    updateUiState({ createLabelEntry: appendCommaSeparatedValue(createLabelEntry, labelName) });
  }

  function addCreateAssignee(login: string): void {
    updateUiState({ createAssigneeEntry: appendCommaSeparatedValue(createAssigneeEntry, login) });
  }

  function removeIssueLabel(name: string): void {
    if (!selectedIssue) {
      return;
    }
    onMutate("removeLabel", false, {
      issueNumber: selectedIssue.number,
      name
    });
  }

  function removeIssueAssignee(login: string): void {
    if (!selectedIssue) {
      return;
    }
    onMutate("removeAssignees", false, {
      issueNumber: selectedIssue.number,
      assignees: [login]
    });
  }

  function addIssueLabelSuggestion(name: string): void {
    updateUiState({ labelEntry: appendCommaSeparatedValue(labelEntry, name) });
  }

  function addIssueAssigneeSuggestion(login: string): void {
    updateUiState({ assigneeEntry: appendCommaSeparatedValue(assigneeEntry, login) });
  }

  function submitIssueLabels(): void {
    if (!selectedIssue || issueLabelSubmitDisabledReason) {
      return;
    }
    updateUiState({ submittedIssueAction: "addLabels" });
    onMutate("addLabels", false, {
      issueNumber: selectedIssue.number,
      labels: parsedLabels
    });
  }

  function submitIssueAssignees(): void {
    if (!selectedIssue || issueAssigneeSubmitDisabledReason) {
      return;
    }
    updateUiState({ submittedIssueAction: "setAssignees" });
    onMutate("setAssignees", false, {
      issueNumber: selectedIssue.number,
      assignees: parsedAssignees
    });
  }

  function submitIssueComment(): void {
    if (!selectedIssue || !commentBody.trim() || issueCommentDisabledReason) {
      return;
    }
    updateUiState({ submittedIssueAction: "addComment" });
    onMutate("addComment", false, {
      issueNumber: selectedIssue.number,
      body: commentBody.trim()
    });
  }

  function runIssueStateAction(): void {
    if (!selectedIssue || issueActionDisabledReason) {
      return;
    }
    onMutate(issueAction, issueAction === "closeIssue", {
      issueNumber: selectedIssue.number,
      ...(issueAction === "closeIssue" ? { stateReason: closeReason } : {})
    });
  }

  function editComment(commentId: number, commentBody: string): void {
    updateUiState({ submittedIssueAction: "editComment" });
    onMutate("editComment", false, { commentId, body: commentBody });
  }

  function deleteComment(commentId: number): void {
    updateUiState({ submittedIssueAction: "deleteComment" });
    onMutate("deleteComment", true, { commentId });
  }

  useEffect(() => {
    if (!issueDetailRoute) {
      return;
    }

    const scrollContainer = surfaceRef.current?.closest(".content-scroll");
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTop = 0;
    }
  }, [issueDetailRoute, focusedIssueNumber]);

  return {
    surfaceRef,
    issueDetailRoute,
    issueState,
    changeIssueState,
    filter,
    handleFilterChange,
    createIssueDisabledReason,
    startCreatingIssue,
    filteredIssues,
    selectedIssue,
    creating,
    loading,
    issuesAvailabilityMessage,
    issueListLimit,
    unfilteredIssueListLimitHit,
    onOpenExternal,
    onExpandIssues,
    title,
    body,
    createLabelEntry,
    createAssigneeEntry,
    createMilestoneNumber,
    createIssueSubmitDisabledReason,
    createIssueMutationActive,
    mutationPending,
    mutationSucceeded,
    mutationError,
    visibleLabels,
    labelsLoading,
    labelsError,
    labelsAvailabilityMessage,
    hiddenIssueLabelCount,
    showAllIssueLabels,
    labels,
    visibleAssignableUsers,
    assignableUsersLoading,
    assignableUsersError,
    assignableUsersAvailabilityMessage,
    hiddenIssueAssignableUserCount,
    showAllIssueAssignableUsers,
    assignableUsers,
    visibleMilestones,
    milestonesLoading,
    milestonesError,
    milestonesAvailabilityMessage,
    hiddenIssueMilestoneCount,
    showAllIssueMilestones,
    milestones,
    setTitle,
    setBody,
    setCreateLabelEntry,
    setCreateAssigneeEntry,
    setCreateMilestoneNumber,
    addCreateLabel,
    addCreateAssignee,
    handleShowAllIssueLabels,
    handleShowAllIssueAssignableUsers,
    handleShowAllIssueMilestones,
    submitCreateIssue,
    cancelCreateIssue,
    detail,
    issueDetail,
    issueDetailAvailabilityMessage,
    issueMarkdownUrlContext,
    openIssueDetail,
    onOpenIssueList,
    selectedMilestone,
    selectedAssignees,
    selectedLabels,
    editingIssue,
    editTitle,
    editBody,
    editMilestoneNumber,
    issueActionDisabledReason,
    editIssueSubmitDisabledReason,
    editIssueMutationActive,
    setEditTitle,
    setEditBody,
    setEditMilestoneNumber,
    submitEditIssue,
    cancelEditIssue,
    repository,
    issueActionPendingReason,
    liveIssueDisabledReason,
    editComment,
    deleteComment,
    labelEntry,
    assigneeEntry,
    issueLabelSubmitDisabledReason,
    issueAssigneeSubmitDisabledReason,
    removeIssueLabel,
    removeIssueAssignee,
    setLabelEntry,
    setAssigneeEntry,
    addIssueLabelSuggestion,
    addIssueAssigneeSuggestion,
    submitIssueLabels,
    submitIssueAssignees,
    commentBody,
    issueCommentDisabledReason,
    issueCommentMutationActive,
    setCommentBody,
    submitIssueComment,
    issueAction,
    issueActionLabel,
    closeReason,
    startEditingIssue,
    runIssueStateAction,
    setCloseReason,
    requestedIssueNumber
  };
}

type IssuesTabModel = ReturnType<typeof useIssuesTabModel>;
type IssueRouteProps = IssuesTabModel & {
  selectedIssue: NonNullable<IssuesTabModel["selectedIssue"]>;
};

function IssueCreatePane({
  title,
  body,
  createLabelEntry,
  createAssigneeEntry,
  createMilestoneNumber,
  createIssueDisabledReason,
  createIssueSubmitDisabledReason,
  createIssueMutationActive,
  mutationPending,
  mutationSucceeded,
  mutationError,
  visibleLabels,
  labelsLoading,
  labelsError,
  labelsAvailabilityMessage,
  hiddenIssueLabelCount,
  showAllIssueLabels,
  labels,
  visibleAssignableUsers,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailabilityMessage,
  hiddenIssueAssignableUserCount,
  showAllIssueAssignableUsers,
  assignableUsers,
  visibleMilestones,
  milestonesLoading,
  milestonesError,
  milestonesAvailabilityMessage,
  hiddenIssueMilestoneCount,
  showAllIssueMilestones,
  milestones,
  setTitle,
  setBody,
  setCreateLabelEntry,
  setCreateAssigneeEntry,
  setCreateMilestoneNumber,
  addCreateLabel,
  addCreateAssignee,
  handleShowAllIssueLabels,
  handleShowAllIssueAssignableUsers,
  handleShowAllIssueMilestones,
  submitCreateIssue,
  cancelCreateIssue
}: IssuesTabModel): JSX.Element {
  return (
    <IssueCreateForm
      title={title}
      body={body}
      labelEntry={createLabelEntry}
      assigneeEntry={createAssigneeEntry}
      milestoneNumber={createMilestoneNumber}
      disabledReason={createIssueDisabledReason}
      submitDisabledReason={createIssueSubmitDisabledReason}
      mutationActive={createIssueMutationActive}
      mutationPending={mutationPending}
      mutationSucceeded={mutationSucceeded}
      mutationError={mutationError}
      labels={visibleLabels}
      labelsLoading={labelsLoading}
      labelsError={labelsError}
      labelsAvailabilityMessage={labelsAvailabilityMessage}
      hiddenLabelCount={hiddenIssueLabelCount}
      showAllLabels={showAllIssueLabels}
      totalLabelCount={labels.length}
      assignableUsers={visibleAssignableUsers}
      assignableUsersLoading={assignableUsersLoading}
      assignableUsersError={assignableUsersError}
      assignableUsersAvailabilityMessage={assignableUsersAvailabilityMessage}
      hiddenAssignableUserCount={hiddenIssueAssignableUserCount}
      showAllAssignableUsers={showAllIssueAssignableUsers}
      totalAssignableUserCount={assignableUsers.length}
      milestones={visibleMilestones}
      milestonesLoading={milestonesLoading}
      milestonesError={milestonesError}
      milestonesAvailabilityMessage={milestonesAvailabilityMessage}
      hiddenMilestoneCount={hiddenIssueMilestoneCount}
      showAllMilestones={showAllIssueMilestones}
      totalMilestoneCount={milestones.length}
      onTitleChange={setTitle}
      onBodyChange={setBody}
      onLabelEntryChange={setCreateLabelEntry}
      onAssigneeEntryChange={setCreateAssigneeEntry}
      onMilestoneNumberChange={setCreateMilestoneNumber}
      onAddLabel={addCreateLabel}
      onAddAssignee={addCreateAssignee}
      onShowAllLabels={handleShowAllIssueLabels}
      onShowAllAssignableUsers={handleShowAllIssueAssignableUsers}
      onShowAllMilestones={handleShowAllIssueMilestones}
      onSubmit={submitCreateIssue}
      onCancel={cancelCreateIssue}
    />
  );
}

function IssueDetailHeader({
  selectedIssue,
  selectedMilestone,
  selectedAssignees
}: Pick<IssueRouteProps, "selectedIssue" | "selectedMilestone" | "selectedAssignees">): JSX.Element {
  return (
    <header className="thread-header">
      <h2>{selectedIssue.title}</h2>
      <small>
        #{selectedIssue.number} opened by {selectedIssue.authorLogin ?? "unknown"} ·{" "}
        {formatRelativeDate(selectedIssue.createdAt)}
      </small>
      <span className={`state-chip ${selectedIssue.state === "open" ? "success" : ""}`}>
        {issueStateLabel(selectedIssue)}
      </span>
      {selectedMilestone && (
        <span className="state-chip" title={selectedMilestone.description ?? undefined}>
          Milestone {selectedMilestone.title}
        </span>
      )}
      {selectedIssue.locked && <span className="state-chip attention">Locked</span>}
      {selectedAssignees.length > 0 && (
        <div className="label-stack label-row">
          {selectedAssignees.map((assignee) => (
            <span key={assignee.id}>Assigned @{assignee.login}</span>
          ))}
        </div>
      )}
    </header>
  );
}

function IssueDetailRouteView({
  selectedIssue,
  detail,
  issueDetail,
  issueDetailAvailabilityMessage,
  issueMarkdownUrlContext,
  onOpenExternal,
  selectedMilestone,
  selectedAssignees,
  selectedLabels,
  editingIssue,
  editTitle,
  editBody,
  editMilestoneNumber,
  issueActionDisabledReason,
  editIssueSubmitDisabledReason,
  editIssueMutationActive,
  mutationPending,
  mutationSucceeded,
  mutationError,
  visibleMilestones,
  milestonesLoading,
  milestonesError,
  milestonesAvailabilityMessage,
  hiddenIssueMilestoneCount,
  handleShowAllIssueMilestones,
  setEditTitle,
  setEditBody,
  setEditMilestoneNumber,
  submitEditIssue,
  cancelEditIssue,
  repository,
  issueActionPendingReason,
  liveIssueDisabledReason,
  editComment,
  deleteComment,
  visibleLabels,
  visibleAssignableUsers,
  labelEntry,
  assigneeEntry,
  issueLabelSubmitDisabledReason,
  issueAssigneeSubmitDisabledReason,
  labelsLoading,
  labelsError,
  labelsAvailabilityMessage,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailabilityMessage,
  hiddenIssueLabelCount,
  hiddenIssueAssignableUserCount,
  removeIssueLabel,
  removeIssueAssignee,
  setLabelEntry,
  setAssigneeEntry,
  addIssueLabelSuggestion,
  addIssueAssigneeSuggestion,
  handleShowAllIssueLabels,
  handleShowAllIssueAssignableUsers,
  submitIssueLabels,
  submitIssueAssignees,
  commentBody,
  issueCommentDisabledReason,
  issueCommentMutationActive,
  setCommentBody,
  submitIssueComment,
  issueAction,
  issueActionLabel,
  closeReason,
  startEditingIssue,
  runIssueStateAction,
  setCloseReason
}: IssueRouteProps): JSX.Element {
  const rail = (
    <>
      <RailSection title="Fields">
        <IssueMetadataControls
          selectedLabels={selectedLabels}
          selectedAssignees={selectedAssignees}
          visibleLabels={visibleLabels}
          visibleAssignableUsers={visibleAssignableUsers}
          labelEntry={labelEntry}
          assigneeEntry={assigneeEntry}
          disabledReason={issueActionDisabledReason}
          labelSubmitDisabledReason={issueLabelSubmitDisabledReason}
          assigneeSubmitDisabledReason={issueAssigneeSubmitDisabledReason}
          labelsLoading={labelsLoading}
          labelsError={labelsError}
          labelsAvailabilityMessage={labelsAvailabilityMessage}
          assignableUsersLoading={assignableUsersLoading}
          assignableUsersError={assignableUsersError}
          assignableUsersAvailabilityMessage={assignableUsersAvailabilityMessage}
          hiddenLabelCount={hiddenIssueLabelCount}
          hiddenAssignableUserCount={hiddenIssueAssignableUserCount}
          onRemoveLabel={removeIssueLabel}
          onRemoveAssignee={removeIssueAssignee}
          onLabelEntryChange={setLabelEntry}
          onAssigneeEntryChange={setAssigneeEntry}
          onAddLabelSuggestion={addIssueLabelSuggestion}
          onAddAssigneeSuggestion={addIssueAssigneeSuggestion}
          onShowAllLabels={handleShowAllIssueLabels}
          onShowAllAssignableUsers={handleShowAllIssueAssignableUsers}
          onSubmitLabels={submitIssueLabels}
          onSubmitAssignees={submitIssueAssignees}
        />
      </RailSection>
      <RailSection title="Actions">
        <IssueActionFooter
          issueAction={issueAction}
          issueActionLabel={issueActionLabel}
          closeReason={closeReason}
          disabledReason={issueActionDisabledReason}
          onStartEditing={startEditingIssue}
          onRunIssueAction={runIssueStateAction}
          onCloseReasonChange={setCloseReason}
        />
      </RailSection>
    </>
  );

  return (
    <>
      <IssueDetailHeader
        selectedIssue={selectedIssue}
        selectedMilestone={selectedMilestone}
        selectedAssignees={selectedAssignees}
      />
      {issueDetail.error && <div className="error-state">{issueDetail.error.message}</div>}
      {issueDetailAvailabilityMessage && <div className="error-state">{issueDetailAvailabilityMessage}</div>}
      <DetailLayout className="issue-detail-layout" rail={rail}>
        <Timeline className="issue-timeline-column">
          {editingIssue ? (
            <IssueEditForm
              title={editTitle}
              body={editBody}
              milestoneNumber={editMilestoneNumber}
              disabledReason={issueActionDisabledReason}
              submitDisabledReason={editIssueSubmitDisabledReason}
              mutationActive={editIssueMutationActive}
              mutationPending={mutationPending}
              mutationSucceeded={mutationSucceeded}
              mutationError={mutationError}
              milestones={visibleMilestones}
              milestonesLoading={milestonesLoading}
              milestonesError={milestonesError}
              milestonesAvailabilityMessage={milestonesAvailabilityMessage}
              hiddenMilestoneCount={hiddenIssueMilestoneCount}
              onTitleChange={setEditTitle}
              onBodyChange={setEditBody}
              onMilestoneNumberChange={setEditMilestoneNumber}
              onShowAllMilestones={handleShowAllIssueMilestones}
              onSubmit={submitEditIssue}
              onCancel={cancelEditIssue}
            />
          ) : (
            <IssueDiscussionThread
              repository={repository}
              selectedIssue={selectedIssue}
              detail={detail}
              loading={issueDetail.isLoading || issueDetail.isFetching}
              markdownUrlContext={issueMarkdownUrlContext}
              issueActionPendingReason={issueActionPendingReason}
              liveIssueDisabledReason={liveIssueDisabledReason}
              onOpenExternal={onOpenExternal}
              onEditComment={editComment}
              onDeleteComment={deleteComment}
            />
          )}
          <IssueCommentComposer
            commentBody={commentBody}
            disabledReason={issueCommentDisabledReason}
            mutationActive={issueCommentMutationActive}
            mutationPending={mutationPending}
            mutationSucceeded={mutationSucceeded}
            mutationError={mutationError}
            onCommentBodyChange={setCommentBody}
            onSubmit={submitIssueComment}
          />
        </Timeline>
      </DetailLayout>
    </>
  );
}

function IssueDetailPane(model: IssuesTabModel): JSX.Element {
  const { creating, selectedIssue, issueDetailRoute, issueDetail, requestedIssueNumber } = model;

  return (
    <div className={`thread-detail${issueDetailRoute ? " issue-detail-page" : " issue-create-pane"}`}>
      {creating ? (
        <IssueCreatePane {...model} />
      ) : selectedIssue ? (
        <IssueDetailRouteView {...model} selectedIssue={selectedIssue} />
      ) : issueDetail.isLoading && requestedIssueNumber !== null ? (
        <div className="loading-state">Loading issue #{requestedIssueNumber}…</div>
      ) : (
        <div className="empty-state">No issues found.</div>
      )}
    </div>
  );
}

function IssuesTabContent(model: IssuesTabModel): JSX.Element {
  const {
    surfaceRef,
    issueDetailRoute,
    issueState,
    changeIssueState,
    filter,
    handleFilterChange,
    createIssueDisabledReason,
    startCreatingIssue,
    filteredIssues,
    creating,
    loading,
    issuesAvailabilityMessage,
    issueListLimit,
    unfilteredIssueListLimitHit,
    openIssueDetail,
    onOpenIssueList,
    onExpandIssues
  } = model;
  const issueCountLabel = `${filteredIssues.length} ${filteredIssues.length === 1 ? "issue" : "issues"}`;

  return (
    <section
      className={`issues-route-shell${issueDetailRoute ? " issue-detail-route" : ""}`}
      ref={surfaceRef}
    >
      {issueDetailRoute && (
        <div className="issue-detail-route-top">
          <button className="issue-detail-back-button" type="button" onClick={onOpenIssueList}>
            <ArrowLeft size={16} /> Back to issues
          </button>
        </div>
      )}
      <section
        className={`table-panel github-surface issues-surface${issueDetailRoute ? " issue-detail-surface" : ""}`}
      >
        {!issueDetailRoute && !creating && (
          <FilterBar
            className="surface-filter-row issue-filter-bar"
            label={issueCountLabel}
            actions={
              <button
                className="dark-action issue-create-button"
                type="button"
                disabled={Boolean(createIssueDisabledReason)}
                title={createIssueDisabledReason ?? undefined}
                onClick={startCreatingIssue}
              >
                <Plus size={16} /> New issue
              </button>
            }
          >
            <StateSegmentedControl
              label="Issue state"
              value={issueState}
              options={issueStateFilterOptions}
              onChange={changeIssueState}
            />
            <label className="surface-filter">
              <Search size={15} />
              <input
                aria-label="Filter issues"
                value={filter}
                onChange={handleFilterChange}
                placeholder="Filter issues"
              />
            </label>
          </FilterBar>
        )}
        <div className={`issues-content${issueDetailRoute ? " issue-detail-route" : ""}`}>
          {!issueDetailRoute && !creating ? (
            <IssueList
              issues={filteredIssues}
              loading={loading}
              availabilityMessage={issuesAvailabilityMessage}
              filter={filter}
              issueListLimit={issueListLimit}
              unfilteredIssueListLimitHit={unfilteredIssueListLimitHit}
              onOpenIssue={openIssueDetail}
              onExpandIssues={onExpandIssues}
            />
          ) : (
            <IssueDetailPane {...model} />
          )}
        </div>
      </section>
    </section>
  );
}

export function IssuesTab(props: IssuesTabProps): JSX.Element {
  const model = useIssuesTabModel(props);
  return <IssuesTabContent {...model} />;
}
