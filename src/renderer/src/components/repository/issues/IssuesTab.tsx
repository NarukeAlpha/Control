import { ArrowLeft, CircleDot, ExternalLink, Plus, Search } from "lucide-react";
import { useEffect, useReducer, useRef, type ChangeEvent, type JSX } from "react";

import type {
  GitHubAction,
  GitHubMutationFields,
  IssueDetail,
  IssueSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import {
  MarkdownBody,
  markdownRepositoryUrlContext,
  type MarkdownUrlContext
} from "@renderer/components/MarkdownBody";
import { useIssueDetail } from "@renderer/components/repository/issues/useIssueDetail";
import {
  fieldsMatchSearchParts,
  githubActionLabel,
  normalizedSearchParts,
  readAvailabilityMessage,
  repositoryMutationDisabledReason
} from "@renderer/components/repository/repositoryUi";
import { TimelineThread } from "@renderer/components/shared/TimelineThread";

import { formatRelativeDate } from "@renderer/utils/format";
import { IssueActionFooter } from "./IssueActionFooter";
import { IssueCommentComposer } from "./IssueCommentComposer";
import { IssueCreateForm } from "./IssueCreateForm";
import { IssueEditForm } from "./IssueEditForm";
import { IssueMetadataControls } from "./IssueMetadataControls";
import { useIssuesTabQueries } from "./IssuesTab.queries";

const maxIssueListLimit = 100;
type IssueCloseReason = "completed" | "not_planned";
type IssueStateAction = "closeIssue" | "reopenIssue";

interface IssuesTabUiState {
  selectedIssueNumber: number | null;
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
  | { type: "selectIssue"; issueNumber: number }
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
    selectedIssueNumber: null,
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
    case "selectIssue":
      return {
        ...state,
        creating: false,
        editingIssue: false,
        selectedIssueNumber: action.issueNumber
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

function IssueSummaryTile({
  issue,
  body,
  commentsAvailable,
  loading,
  availabilityMessage,
  markdownUrlContext,
  onOpenIssue,
  onOpenExternal
}: {
  issue: IssueSummary;
  body: string | null | undefined;
  commentsAvailable: number;
  loading: boolean;
  availabilityMessage: string | null;
  markdownUrlContext: MarkdownUrlContext;
  onOpenIssue(issue: IssueSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const labels = issue.labels.slice(0, 4);
  const hiddenLabelCount = issue.labels.length - labels.length;
  const assignees = (issue.assignees ?? []).slice(0, 3);
  const hiddenAssigneeCount = (issue.assignees ?? []).length - assignees.length;

  function handleOpenIssue(): void {
    onOpenIssue(issue);
  }

  function handleOpenExternal(): void {
    onOpenExternal(issue.htmlUrl);
  }

  return (
    <article className="issue-summary-tile" aria-label={`Issue ${issue.number} summary`}>
      <header className="issue-summary-header">
        <div>
          <h2>{issue.title}</h2>
          <small>
            #{issue.number} opened by {issue.authorLogin ?? "unknown"} · {formatRelativeDate(issue.createdAt)}
          </small>
        </div>
        <span className={`state-chip ${issue.state === "open" ? "success" : ""}`}>
          {issueStateLabel(issue)}
        </span>
      </header>
      <div className="issue-summary-meta">
        <span>{commentsAvailable} comments</span>
        <span>Updated {formatRelativeDate(issue.updatedAt)}</span>
        {issue.milestone && <span>Milestone {issue.milestone.title}</span>}
        {issue.locked && <span>Locked</span>}
      </div>
      {(labels.length > 0 || assignees.length > 0) && (
        <div className="label-stack issue-summary-labels">
          {labels.map((label) => (
            <span key={label.id}>{label.name}</span>
          ))}
          {hiddenLabelCount > 0 && (
            <span>
              +{hiddenLabelCount} {hiddenLabelCount === 1 ? "label" : "labels"}
            </span>
          )}
          {assignees.map((assignee) => (
            <span key={assignee.id}>@{assignee.login}</span>
          ))}
          {hiddenAssigneeCount > 0 && (
            <span>
              +{hiddenAssigneeCount} {hiddenAssigneeCount === 1 ? "assignee" : "assignees"}
            </span>
          )}
        </div>
      )}
      <section className="issue-summary-body" aria-label="Original issue comment">
        {loading ? (
          <div className="loading-state">Loading issue summary…</div>
        ) : (
          <MarkdownBody
            markdown={body}
            emptyText="No description provided."
            onOpenExternal={onOpenExternal}
            urlContext={markdownUrlContext}
          />
        )}
      </section>
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      <div className="thread-actions">
        <button className="dark-action" type="button" onClick={handleOpenIssue}>
          Open issue
        </button>
        <button type="button" onClick={handleOpenExternal}>
          <ExternalLink size={16} /> GitHub fallback
        </button>
      </div>
    </article>
  );
}

function IssueListRow({
  issue,
  active,
  onSelectIssueNumber,
  onOpenExternal
}: {
  issue: IssueSummary;
  active: boolean;
  onSelectIssueNumber(issueNumber: number): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const visibleLabels = issue.labels.slice(0, 2);
  const hiddenLabels = issue.labels.slice(2);
  const visibleAssignees = (issue.assignees ?? []).slice(0, 2);
  const hiddenAssignees = (issue.assignees ?? []).slice(2);

  function handleSelectIssue(): void {
    onSelectIssueNumber(issue.number);
  }

  function handleOpenExternal(): void {
    onOpenExternal(issue.htmlUrl);
  }

  return (
    <div className={`issue-row thread-list-action-row ${active ? "active" : ""}`}>
      <button className="thread-list-row-main" type="button" onClick={handleSelectIssue}>
        <CircleDot size={17} />
        <div>
          <strong>{issue.title}</strong>
          <small>
            #{issue.number} opened by {issue.authorLogin ?? "unknown"} · {issue.comments} comments
          </small>
        </div>
        <div className="thread-list-row-badges">
          <div className="label-stack">
            {visibleLabels.map((label) => (
              <span key={label.id}>{label.name}</span>
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
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open issue ${issue.number} GitHub fallback`}
        title={`GitHub fallback for issue #${issue.number}`}
        onClick={handleOpenExternal}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function IssueList({
  issues,
  selectedIssueNumber,
  creating,
  loading,
  availabilityMessage,
  filter,
  issueListLimit,
  unfilteredIssueListLimitHit,
  onSelectIssueNumber,
  onOpenExternal,
  onExpandIssues
}: {
  issues: IssueSummary[];
  selectedIssueNumber: number | null;
  creating: boolean;
  loading: boolean;
  availabilityMessage: string | null;
  filter: string;
  issueListLimit: number;
  unfilteredIssueListLimitHit: boolean;
  onSelectIssueNumber(issueNumber: number): void;
  onOpenExternal(url: string): void;
  onExpandIssues(): void;
}): JSX.Element {
  return (
    <div className="thread-list">
      {loading && issues.length === 0 && <div className="loading-state">Loading issues…</div>}
      {!loading && availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {issues.map((issue) => (
        <IssueListRow
          key={issue.id}
          issue={issue}
          active={selectedIssueNumber === issue.number && !creating}
          onSelectIssueNumber={onSelectIssueNumber}
          onOpenExternal={onOpenExternal}
        />
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
  focusedIssueNumber: number | null;
  initialFilter: string;
  initialCreating: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onOpenExternal(url: string): void;
  onSelectIssue(issue: IssueSummary): void;
  onOpenIssueList(): void;
  onExpandIssues(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}

function useIssuesTabModel({
  repository,
  githubReady,
  issueListLimit,
  focusedIssueNumber,
  initialFilter,
  initialCreating,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onOpenExternal,
  onSelectIssue,
  onOpenIssueList,
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
    selectedIssueNumber,
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
  const requestedIssueNumber = selectedIssueNumber ?? focusedIssueNumber;
  const selectedIssueSummary =
    (requestedIssueNumber !== null ? issues.find((issue) => issue.number === requestedIssueNumber) : null) ??
    filteredIssues[0] ??
    null;
  const issueDetailNumber = requestedIssueNumber ?? selectedIssueSummary?.number ?? null;
  const issueDetail = useIssueDetail(issueDetailNumber, !creating && issueDetailNumber !== null);
  const detail = issueDetail.data?.detail ?? null;
  const selectedIssue = detail ?? selectedIssueSummary;
  const issueDetailAvailabilityMessage = readAvailabilityMessage(
    "Issue detail",
    issueDetail.data?.availability ?? null
  );
  const issueDetailRoute = focusedIssueNumber !== null && !creating;
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

  function selectIssueNumber(issueNumber: number): void {
    dispatchUiState({ type: "selectIssue", issueNumber });
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
    selectIssueNumber,
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
    onSelectIssue,
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

function IssueSummaryPane({
  selectedIssue,
  detail,
  issueDetail,
  issueDetailAvailabilityMessage,
  issueMarkdownUrlContext,
  onSelectIssue,
  onOpenExternal
}: IssueRouteProps): JSX.Element {
  return (
    <IssueSummaryTile
      issue={selectedIssue}
      body={detail?.body}
      commentsAvailable={detail?.commentsList.length ?? selectedIssue.comments}
      loading={issueDetail.isLoading || issueDetail.isFetching}
      availabilityMessage={issueDetail.error?.message ?? issueDetailAvailabilityMessage}
      markdownUrlContext={issueMarkdownUrlContext}
      onOpenIssue={onSelectIssue}
      onOpenExternal={onOpenExternal}
    />
  );
}

function IssueDetailHeader({
  selectedIssue,
  selectedMilestone,
  selectedAssignees,
  selectedLabels,
  onOpenIssueList,
  onOpenExternal
}: Pick<
  IssueRouteProps,
  | "selectedIssue"
  | "selectedMilestone"
  | "selectedAssignees"
  | "selectedLabels"
  | "onOpenIssueList"
  | "onOpenExternal"
>): JSX.Element {
  function handleOpenExternal(): void {
    onOpenExternal(selectedIssue.htmlUrl);
  }

  return (
    <>
      <div className="issue-detail-toolbar">
        <button type="button" onClick={onOpenIssueList}>
          <ArrowLeft size={16} /> Back to issues
        </button>
        <button type="button" onClick={handleOpenExternal}>
          <ExternalLink size={16} /> GitHub fallback
        </button>
      </div>
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
        {selectedLabels.length > 0 && (
          <div className="label-stack label-row">
            {selectedLabels.map((label) => (
              <span key={label.id}>{label.name}</span>
            ))}
          </div>
        )}
      </header>
    </>
  );
}

function IssueDetailRouteView({
  selectedIssue,
  detail,
  issueDetail,
  issueDetailAvailabilityMessage,
  issueMarkdownUrlContext,
  onOpenExternal,
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
  return (
    <>
      <IssueDetailHeader
        selectedIssue={selectedIssue}
        selectedMilestone={selectedMilestone}
        selectedAssignees={selectedAssignees}
        selectedLabels={selectedLabels}
        onOpenIssueList={onOpenIssueList}
        onOpenExternal={onOpenExternal}
      />
      {issueDetail.error && <div className="error-state">{issueDetail.error.message}</div>}
      {issueDetailAvailabilityMessage && <div className="error-state">{issueDetailAvailabilityMessage}</div>}
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
      <IssueActionFooter
        issueAction={issueAction}
        issueActionLabel={issueActionLabel}
        closeReason={closeReason}
        disabledReason={issueActionDisabledReason}
        onStartEditing={startEditingIssue}
        onRunIssueAction={runIssueStateAction}
        onCloseReasonChange={setCloseReason}
      />
    </>
  );
}

function IssueDetailPane(model: IssuesTabModel): JSX.Element {
  const { creating, selectedIssue, issueDetailRoute, issueDetail, requestedIssueNumber } = model;

  return (
    <div className={`thread-detail${issueDetailRoute ? " issue-detail-page" : " issue-summary-pane"}`}>
      {creating ? (
        <IssueCreatePane {...model} />
      ) : selectedIssue && !issueDetailRoute ? (
        <IssueSummaryPane {...model} selectedIssue={selectedIssue} />
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
    selectIssueNumber,
    onOpenExternal,
    onExpandIssues
  } = model;

  return (
    <section className="table-panel github-surface" ref={surfaceRef}>
      {!issueDetailRoute && (
        <div className="table-action-row surface-filter-row">
          <label className="surface-filter">
            <Search size={15} />
            <input
              aria-label="Filter issues"
              value={filter}
              onChange={handleFilterChange}
              placeholder="Filter issues"
            />
          </label>
          <button
            type="button"
            disabled={Boolean(createIssueDisabledReason)}
            title={createIssueDisabledReason ?? undefined}
            onClick={startCreatingIssue}
          >
            <Plus size={16} /> New issue
          </button>
        </div>
      )}
      <div className={`github-split${issueDetailRoute ? " issue-detail-route" : ""}`}>
        {!issueDetailRoute && (
          <IssueList
            issues={filteredIssues}
            selectedIssueNumber={selectedIssue?.number ?? null}
            creating={creating}
            loading={loading}
            availabilityMessage={issuesAvailabilityMessage}
            filter={filter}
            issueListLimit={issueListLimit}
            unfilteredIssueListLimitHit={unfilteredIssueListLimitHit}
            onSelectIssueNumber={selectIssueNumber}
            onOpenExternal={onOpenExternal}
            onExpandIssues={onExpandIssues}
          />
        )}

        <IssueDetailPane {...model} />
      </div>
    </section>
  );
}

export function IssuesTab(props: IssuesTabProps): JSX.Element {
  const model = useIssuesTabModel(props);
  return <IssuesTabContent {...model} />;
}
