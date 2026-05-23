import { CircleDot, ExternalLink, Plus, Search, X } from "lucide-react";
import { useState, type JSX } from "react";

import type {
  AssignableUserSummary,
  GitHubAction,
  GitHubMutationFields,
  GitHubReadAvailability,
  IssueSummary,
  LabelSummary,
  MilestoneSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import { markdownRepositoryUrlContext } from "@renderer/components/MarkdownBody";
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
const maxIssueListLimit = 100;

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
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
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

export function IssuesTab({
  repository,
  githubReady,
  issues,
  issueListLimit,
  availability,
  focusedIssueNumber,
  initialFilter,
  initialCreating,
  labels,
  labelsLoading,
  labelsError,
  labelsAvailability,
  assignableUsers,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailability,
  milestones,
  milestonesLoading,
  milestonesError,
  milestonesAvailability,
  loading,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onOpenExternal,
  onSelectIssue,
  onExpandIssues,
  onMutate
}: {
  repository: RepositoryDetail;
  githubReady: boolean;
  issues: IssueSummary[];
  issueListLimit: number;
  availability: GitHubReadAvailability | null;
  focusedIssueNumber: number | null;
  initialFilter: string;
  initialCreating: boolean;
  labels: LabelSummary[];
  labelsLoading: boolean;
  labelsError: Error | null;
  labelsAvailability: GitHubReadAvailability | null;
  assignableUsers: AssignableUserSummary[];
  assignableUsersLoading: boolean;
  assignableUsersError: Error | null;
  assignableUsersAvailability: GitHubReadAvailability | null;
  milestones: MilestoneSummary[];
  milestonesLoading: boolean;
  milestonesError: Error | null;
  milestonesAvailability: GitHubReadAvailability | null;
  loading: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onOpenExternal(url: string): void;
  onSelectIssue(issue: IssueSummary): void;
  onExpandIssues(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null);
  const [filter, setFilter] = useState(initialFilter);
  const [creating, setCreating] = useState(initialCreating);
  const [editingIssue, setEditingIssue] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [createLabelEntry, setCreateLabelEntry] = useState("");
  const [createAssigneeEntry, setCreateAssigneeEntry] = useState("");
  const [createMilestoneNumber, setCreateMilestoneNumber] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editMilestoneNumber, setEditMilestoneNumber] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [labelEntry, setLabelEntry] = useState("");
  const [assigneeEntry, setAssigneeEntry] = useState("");
  const [closeReason, setCloseReason] = useState<"completed" | "not_planned">("completed");
  const [submittedIssueAction, setSubmittedIssueAction] = useState<GitHubAction | null>(null);
  const [showAllIssueLabels, setShowAllIssueLabels] = useState(false);
  const [showAllIssueAssignableUsers, setShowAllIssueAssignableUsers] = useState(false);
  const [showAllIssueMilestones, setShowAllIssueMilestones] = useState(false);
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
  const selectedIssue =
    (requestedIssueNumber !== null
      ? filteredIssues.find((issue) => issue.number === requestedIssueNumber)
      : null) ??
    filteredIssues[0] ??
    null;
  const issueDetail = useIssueDetail(selectedIssue?.number ?? null, !creating && Boolean(selectedIssue));
  const detail = issueDetail.data?.detail ?? null;
  const issueDetailAvailabilityMessage = readAvailabilityMessage(
    "Issue detail",
    issueDetail.data?.availability ?? null
  );
  const selectedLabels = detail?.labels ?? selectedIssue?.labels ?? [];
  const selectedAssignees = detail?.assignees ?? selectedIssue?.assignees ?? [];
  const selectedMilestone = detail?.milestone ?? selectedIssue?.milestone ?? null;
  const issueAction = selectedIssue?.state === "closed" ? "reopenIssue" : "closeIssue";
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

  function startEditingIssue(): void {
    if (!selectedIssue) {
      return;
    }
    setSubmittedIssueAction(null);
    setEditTitle(selectedIssue.title);
    setEditBody(detail?.body ?? "");
    setEditMilestoneNumber(selectedMilestone ? String(selectedMilestone.number) : "");
    setEditingIssue(true);
  }

  return (
    <section className="table-panel github-surface">
      <div className="table-action-row surface-filter-row">
        <label className="surface-filter">
          <Search size={15} />
          <input
            aria-label="Filter issues"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter issues"
          />
        </label>
        <button
          type="button"
          disabled={Boolean(createIssueDisabledReason)}
          title={createIssueDisabledReason ?? undefined}
          onClick={() => {
            setEditingIssue(false);
            setSubmittedIssueAction(null);
            setTitle("");
            setBody("");
            setCreateLabelEntry("");
            setCreateAssigneeEntry("");
            setCreateMilestoneNumber("");
            setCreating(true);
          }}
        >
          <Plus size={16} /> New issue
        </button>
      </div>
      <div className="github-split">
        <div className="thread-list">
          {loading && issues.length === 0 && <div className="loading-state">Loading issues…</div>}
          {!loading && issuesAvailabilityMessage && (
            <div className="error-state">{issuesAvailabilityMessage}</div>
          )}
          {filteredIssues.map((issue) => {
            const visibleLabels = issue.labels.slice(0, 2);
            const hiddenLabels = issue.labels.slice(2);
            const visibleAssignees = (issue.assignees ?? []).slice(0, 2);
            const hiddenAssignees = (issue.assignees ?? []).slice(2);

            return (
              <div
                className={`issue-row thread-list-action-row ${
                  selectedIssue?.number === issue.number && !creating ? "active" : ""
                }`}
                key={issue.id}
              >
                <button
                  className="thread-list-row-main"
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditingIssue(false);
                    setSelectedIssueNumber(issue.number);
                    onSelectIssue(issue);
                  }}
                >
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
                  onClick={() => onOpenExternal(issue.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </div>
            );
          })}
          {!loading && filteredIssues.length === 0 && (
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

        <div className="thread-detail">
          {creating ? (
            <form
              className="compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (createIssueSubmitDisabledReason) {
                  return;
                }
                setSubmittedIssueAction("createIssue");
                onMutate("createIssue", false, {
                  title: title.trim(),
                  body: body.trim(),
                  ...(parsedCreateLabels.length > 0 ? { labels: parsedCreateLabels } : {}),
                  ...(parsedCreateAssignees.length > 0 ? { assignees: parsedCreateAssignees } : {}),
                  ...(createMilestoneNumber ? { milestone: Number(createMilestoneNumber) } : {})
                });
              }}
            >
              <h2>Open a new issue</h2>
              {createIssueMutationActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel("createIssue")} is running. The draft is locked until GitHub responds.
                </div>
              )}
              {createIssueMutationActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel("createIssue")} completed. Issue data is refreshing.
                </div>
              )}
              {createIssueMutationActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel("createIssue")} failed: {mutationError.message}
                </div>
              )}
              <input
                value={title}
                disabled={Boolean(createIssueDisabledReason)}
                title={createIssueDisabledReason ?? undefined}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Issue title"
              />
              <textarea
                value={body}
                disabled={Boolean(createIssueDisabledReason)}
                title={createIssueDisabledReason ?? undefined}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Describe the problem"
              />
              <label>
                Labels
                <input
                  value={createLabelEntry}
                  disabled={Boolean(createIssueDisabledReason)}
                  title={createIssueDisabledReason ?? undefined}
                  onChange={(event) => setCreateLabelEntry(event.target.value)}
                  placeholder="Labels for this issue"
                />
              </label>
              <div className="metadata-picker-options" aria-label="Issue labels for new issue">
                {labelsLoading && <small>Loading labels…</small>}
                {labelsError && <small>Could not load labels.</small>}
                {!labelsError && labelsAvailabilityMessage && <small>{labelsAvailabilityMessage}</small>}
                {!labelsLoading &&
                  !labelsError &&
                  visibleLabels.map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      disabled={Boolean(createIssueDisabledReason)}
                      title={label.description ?? `Add ${label.name}`}
                      onClick={() =>
                        setCreateLabelEntry((current) => appendCommaSeparatedValue(current, label.name))
                      }
                    >
                      <span style={{ backgroundColor: `#${label.color}` }} />
                      {label.name}
                    </button>
                  ))}
              </div>
              {!labelsLoading && !labelsError && hiddenIssueLabelCount > 0 && (
                <div className="table-action-row">
                  <button type="button" onClick={() => setShowAllIssueLabels(true)}>
                    Show all labels
                  </button>
                </div>
              )}
              {!labelsLoading && !labelsError && showAllIssueLabels && labels.length > 10 && (
                <div className="muted-row">Showing all {labels.length} labels.</div>
              )}
              <label>
                Assignees
                <input
                  value={createAssigneeEntry}
                  disabled={Boolean(createIssueDisabledReason)}
                  title={createIssueDisabledReason ?? undefined}
                  onChange={(event) => setCreateAssigneeEntry(event.target.value)}
                  placeholder="Assignees for this issue"
                />
              </label>
              <div className="metadata-picker-options" aria-label="Assignees for new issue">
                {assignableUsersLoading && <small>Loading assignable users…</small>}
                {assignableUsersError && <small>Could not load assignable users.</small>}
                {!assignableUsersError && assignableUsersAvailabilityMessage && (
                  <small>{assignableUsersAvailabilityMessage}</small>
                )}
                {!assignableUsersLoading &&
                  !assignableUsersError &&
                  visibleAssignableUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      disabled={Boolean(createIssueDisabledReason)}
                      title={`Assign ${user.login}`}
                      onClick={() =>
                        setCreateAssigneeEntry((current) => appendCommaSeparatedValue(current, user.login))
                      }
                    >
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
                      {user.login}
                    </button>
                  ))}
              </div>
              {!assignableUsersLoading && !assignableUsersError && hiddenIssueAssignableUserCount > 0 && (
                <div className="table-action-row">
                  <button type="button" onClick={() => setShowAllIssueAssignableUsers(true)}>
                    Show all assignable users
                  </button>
                </div>
              )}
              {!assignableUsersLoading &&
                !assignableUsersError &&
                showAllIssueAssignableUsers &&
                assignableUsers.length > 10 && (
                  <div className="muted-row">Showing all {assignableUsers.length} assignable users.</div>
                )}
              <label>
                Milestone
                <select
                  value={createMilestoneNumber}
                  disabled={Boolean(createIssueDisabledReason)}
                  title={createIssueDisabledReason ?? undefined}
                  onChange={(event) => setCreateMilestoneNumber(event.target.value)}
                >
                  <option value="">No milestone</option>
                  {visibleMilestones.map((milestone) => (
                    <option key={milestone.id} value={milestone.number}>
                      {milestone.title}
                    </option>
                  ))}
                </select>
              </label>
              {milestonesLoading && <small className="action-disabled-note">Loading milestones…</small>}
              {milestonesError && (
                <small className="action-disabled-note">
                  Could not load milestones: {milestonesError.message}
                </small>
              )}
              {!milestonesError && milestonesAvailabilityMessage && (
                <small className="action-disabled-note">{milestonesAvailabilityMessage}</small>
              )}
              {!milestonesLoading && !milestonesError && hiddenIssueMilestoneCount > 0 && (
                <div className="table-action-row">
                  <button type="button" onClick={() => setShowAllIssueMilestones(true)}>
                    Show all milestones
                  </button>
                </div>
              )}
              {!milestonesLoading && !milestonesError && showAllIssueMilestones && milestones.length > 10 && (
                <div className="muted-row">Showing all {milestones.length} milestones.</div>
              )}
              <div>
                <button
                  className="dark-action"
                  type="submit"
                  disabled={Boolean(createIssueSubmitDisabledReason)}
                  title={createIssueSubmitDisabledReason ?? undefined}
                >
                  <Plus size={16} /> Create issue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedIssueAction(null);
                    setTitle("");
                    setBody("");
                    setCreateLabelEntry("");
                    setCreateAssigneeEntry("");
                    setCreateMilestoneNumber("");
                    setCreating(false);
                  }}
                >
                  Cancel
                </button>
                {createIssueSubmitDisabledReason && (
                  <small className="action-disabled-note">
                    Issue creation unavailable: {createIssueSubmitDisabledReason}
                  </small>
                )}
              </div>
            </form>
          ) : selectedIssue ? (
            <>
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
              {issueDetail.error && <div className="error-state">{issueDetail.error.message}</div>}
              {issueDetailAvailabilityMessage && (
                <div className="error-state">{issueDetailAvailabilityMessage}</div>
              )}
              {editingIssue ? (
                <form
                  className="compose-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editIssueSubmitDisabledReason) {
                      return;
                    }
                    setSubmittedIssueAction("editIssue");
                    onMutate("editIssue", false, {
                      issueNumber: selectedIssue.number,
                      title: editTitle.trim(),
                      body: editBody.trim(),
                      milestone: editMilestoneNumber ? Number(editMilestoneNumber) : null
                    });
                  }}
                >
                  {editIssueMutationActive && mutationPending && (
                    <div className="loading-state">
                      {githubActionLabel("editIssue")} is running. The edit is locked until GitHub responds.
                    </div>
                  )}
                  {editIssueMutationActive && !mutationPending && mutationSucceeded && (
                    <div className="success-state">
                      {githubActionLabel("editIssue")} completed. Issue data is refreshing.
                    </div>
                  )}
                  {editIssueMutationActive && !mutationPending && mutationError && (
                    <div className="error-state">
                      {githubActionLabel("editIssue")} failed: {mutationError.message}
                    </div>
                  )}
                  <input
                    value={editTitle}
                    disabled={Boolean(issueActionDisabledReason)}
                    title={issueActionDisabledReason ?? undefined}
                    onChange={(event) => setEditTitle(event.target.value)}
                    placeholder="Edit issue title"
                  />
                  <textarea
                    value={editBody}
                    disabled={Boolean(issueActionDisabledReason)}
                    title={issueActionDisabledReason ?? undefined}
                    onChange={(event) => setEditBody(event.target.value)}
                    placeholder="Edit issue body"
                  />
                  <label>
                    Milestone
                    <select
                      value={editMilestoneNumber}
                      disabled={Boolean(issueActionDisabledReason) || milestonesLoading}
                      title={issueActionDisabledReason ?? undefined}
                      onChange={(event) => setEditMilestoneNumber(event.target.value)}
                    >
                      <option value="">No milestone</option>
                      {visibleMilestones.map((milestone) => (
                        <option key={milestone.id} value={milestone.number}>
                          {milestone.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {milestonesLoading && <small className="action-disabled-note">Loading milestones…</small>}
                  {milestonesError && (
                    <small className="action-disabled-note">
                      Could not load milestones: {milestonesError.message}
                    </small>
                  )}
                  {!milestonesError && milestonesAvailabilityMessage && (
                    <small className="action-disabled-note">{milestonesAvailabilityMessage}</small>
                  )}
                  {!milestonesLoading && !milestonesError && hiddenIssueMilestoneCount > 0 && (
                    <div className="table-action-row">
                      <button type="button" onClick={() => setShowAllIssueMilestones(true)}>
                        Show all milestones
                      </button>
                    </div>
                  )}
                  <div>
                    <button
                      className="dark-action"
                      type="submit"
                      disabled={Boolean(editIssueSubmitDisabledReason)}
                      title={editIssueSubmitDisabledReason ?? undefined}
                    >
                      Save issue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedIssueAction(null);
                        setEditingIssue(false);
                      }}
                    >
                      Cancel
                    </button>
                    {editIssueSubmitDisabledReason && (
                      <small className="action-disabled-note">{editIssueSubmitDisabledReason}</small>
                    )}
                  </div>
                </form>
              ) : (
                <TimelineThread
                  title={`Issue ${selectedIssue.number} discussion`}
                  authorLogin={detail?.authorLogin ?? selectedIssue.authorLogin}
                  authorAvatarUrl={detail?.authorAvatarUrl ?? selectedIssue.authorAvatarUrl}
                  createdAt={detail?.createdAt ?? selectedIssue.createdAt}
                  body={detail?.body}
                  comments={detail?.commentsList ?? []}
                  loading={issueDetail.isLoading || issueDetail.isFetching}
                  availabilityMessage={readAvailabilityMessage(
                    "Issue comments",
                    detail?.commentsAvailability ?? null
                  )}
                  emptyBody="No description provided."
                  markdownUrlContext={issueMarkdownUrlContext}
                  onOpenExternal={onOpenExternal}
                  commentActions={{
                    getDisabledReason: (comment) =>
                      issueActionPendingReason ??
                      liveIssueDisabledReason ??
                      commentMutationDisabledReason(repository, comment),
                    onEdit: (comment, body) => {
                      const commentId = githubNumericId(comment.id);
                      if (commentId === null) {
                        return;
                      }
                      setSubmittedIssueAction("editComment");
                      onMutate("editComment", false, { commentId, body });
                    },
                    onDelete: (comment) => {
                      const commentId = githubNumericId(comment.id);
                      if (commentId === null) {
                        return;
                      }
                      setSubmittedIssueAction("deleteComment");
                      onMutate("deleteComment", true, { commentId });
                    }
                  }}
                />
              )}
              <div className="issue-metadata-controls">
                {selectedLabels.length > 0 && (
                  <div className="metadata-picker-options" aria-label="Current labels">
                    {selectedLabels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        aria-label={`Remove label ${label.name}`}
                        title={issueActionDisabledReason ?? `Remove label ${label.name}`}
                        disabled={Boolean(issueActionDisabledReason)}
                        onClick={() =>
                          onMutate("removeLabel", false, {
                            issueNumber: selectedIssue.number,
                            name: label.name
                          })
                        }
                      >
                        <X size={13} />
                        {label.name}
                      </button>
                    ))}
                  </div>
                )}
                {selectedAssignees.length > 0 && (
                  <div className="metadata-picker-options" aria-label="Current assignees">
                    {selectedAssignees.map((assignee) => (
                      <button
                        key={assignee.id}
                        type="button"
                        aria-label={`Remove assignee ${assignee.login}`}
                        title={issueActionDisabledReason ?? `Remove assignee ${assignee.login}`}
                        disabled={Boolean(issueActionDisabledReason)}
                        onClick={() =>
                          onMutate("removeAssignees", false, {
                            issueNumber: selectedIssue.number,
                            assignees: [assignee.login]
                          })
                        }
                      >
                        <X size={13} />
                        {assignee.login}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (issueLabelSubmitDisabledReason) {
                      return;
                    }
                    setSubmittedIssueAction("addLabels");
                    onMutate("addLabels", false, {
                      issueNumber: selectedIssue.number,
                      labels: parsedLabels
                    });
                  }}
                >
                  <label>
                    Labels
                    <input
                      value={labelEntry}
                      onChange={(event) => setLabelEntry(event.target.value)}
                      placeholder="Add labels"
                      disabled={Boolean(issueActionDisabledReason)}
                      title={issueActionDisabledReason ?? undefined}
                    />
                  </label>
                  <div className="metadata-picker-options" aria-label="Available labels">
                    {labelsLoading && <small>Loading labels…</small>}
                    {labelsError && <small>Could not load labels.</small>}
                    {!labelsError && labelsAvailabilityMessage && <small>{labelsAvailabilityMessage}</small>}
                    {!labelsLoading &&
                      !labelsError &&
                      visibleLabels.map((label) => (
                        <button
                          key={label.id}
                          type="button"
                          disabled={Boolean(issueActionDisabledReason)}
                          title={issueActionDisabledReason ?? label.description ?? `Add ${label.name}`}
                          onClick={() =>
                            setLabelEntry((current) => appendCommaSeparatedValue(current, label.name))
                          }
                        >
                          <span style={{ backgroundColor: `#${label.color}` }} />
                          {label.name}
                        </button>
                      ))}
                  </div>
                  {!labelsLoading && !labelsError && hiddenIssueLabelCount > 0 && (
                    <div className="table-action-row">
                      <button type="button" onClick={() => setShowAllIssueLabels(true)}>
                        Show all labels
                      </button>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={Boolean(issueLabelSubmitDisabledReason)}
                    title={issueLabelSubmitDisabledReason ?? undefined}
                  >
                    Add labels
                  </button>
                  {issueLabelSubmitDisabledReason && (
                    <small className="action-disabled-note">{issueLabelSubmitDisabledReason}</small>
                  )}
                </form>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (issueAssigneeSubmitDisabledReason) {
                      return;
                    }
                    setSubmittedIssueAction("setAssignees");
                    onMutate("setAssignees", false, {
                      issueNumber: selectedIssue.number,
                      assignees: parsedAssignees
                    });
                  }}
                >
                  <label>
                    Assignees
                    <input
                      value={assigneeEntry}
                      onChange={(event) => setAssigneeEntry(event.target.value)}
                      placeholder="Add assignees"
                      disabled={Boolean(issueActionDisabledReason)}
                      title={issueActionDisabledReason ?? undefined}
                    />
                  </label>
                  <div className="metadata-picker-options" aria-label="Assignable users">
                    {assignableUsersLoading && <small>Loading assignable users…</small>}
                    {assignableUsersError && <small>Could not load assignable users.</small>}
                    {!assignableUsersError && assignableUsersAvailabilityMessage && (
                      <small>{assignableUsersAvailabilityMessage}</small>
                    )}
                    {!assignableUsersLoading &&
                      !assignableUsersError &&
                      visibleAssignableUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          disabled={Boolean(issueActionDisabledReason)}
                          title={issueActionDisabledReason ?? `Assign ${user.login}`}
                          onClick={() =>
                            setAssigneeEntry((current) => appendCommaSeparatedValue(current, user.login))
                          }
                        >
                          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
                          {user.login}
                        </button>
                      ))}
                  </div>
                  {!assignableUsersLoading && !assignableUsersError && hiddenIssueAssignableUserCount > 0 && (
                    <div className="table-action-row">
                      <button type="button" onClick={() => setShowAllIssueAssignableUsers(true)}>
                        Show all assignable users
                      </button>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={Boolean(issueAssigneeSubmitDisabledReason)}
                    title={issueAssigneeSubmitDisabledReason ?? undefined}
                  >
                    Add assignees
                  </button>
                  {issueAssigneeSubmitDisabledReason && (
                    <small className="action-disabled-note">{issueAssigneeSubmitDisabledReason}</small>
                  )}
                </form>
              </div>
              <form
                className="comment-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!commentBody.trim() || issueCommentDisabledReason) {
                    return;
                  }
                  setSubmittedIssueAction("addComment");
                  onMutate("addComment", false, {
                    issueNumber: selectedIssue.number,
                    body: commentBody.trim()
                  });
                }}
              >
                {issueCommentMutationActive && mutationPending && (
                  <div className="loading-state">
                    {githubActionLabel("addComment")} is running. The comment draft is locked until GitHub
                    responds.
                  </div>
                )}
                {issueCommentMutationActive && !mutationPending && mutationSucceeded && (
                  <div className="success-state">
                    {githubActionLabel("addComment")} completed. Issue comments are refreshing.
                  </div>
                )}
                {issueCommentMutationActive && !mutationPending && mutationError && (
                  <div className="error-state">
                    {githubActionLabel("addComment")} failed: {mutationError.message}
                  </div>
                )}
                <textarea
                  value={commentBody}
                  disabled={Boolean(issueCommentDisabledReason)}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Leave a comment"
                />
                <button
                  className="dark-action"
                  type="submit"
                  disabled={!commentBody.trim() || Boolean(issueCommentDisabledReason)}
                  title={
                    issueCommentDisabledReason ??
                    (!commentBody.trim() ? "Comment body is required." : undefined)
                  }
                >
                  Comment
                </button>
                {issueCommentDisabledReason && (
                  <small className="action-disabled-note">
                    Comment unavailable: {issueCommentDisabledReason}
                  </small>
                )}
              </form>
              <div className="thread-actions">
                <button type="button" onClick={() => onOpenExternal(selectedIssue.htmlUrl)}>
                  <ExternalLink size={16} /> GitHub fallback
                </button>
                <button
                  type="button"
                  disabled={Boolean(issueActionDisabledReason)}
                  title={issueActionDisabledReason ?? undefined}
                  onClick={startEditingIssue}
                >
                  Edit issue
                </button>
                <button
                  type="button"
                  disabled={Boolean(issueActionDisabledReason)}
                  title={issueActionDisabledReason ?? undefined}
                  onClick={() =>
                    onMutate(issueAction, issueAction === "closeIssue", {
                      issueNumber: selectedIssue.number,
                      ...(issueAction === "closeIssue" ? { stateReason: closeReason } : {})
                    })
                  }
                >
                  {issueActionLabel}
                </button>
                {issueAction === "closeIssue" && (
                  <select
                    aria-label="Issue close reason"
                    disabled={Boolean(issueActionDisabledReason)}
                    value={closeReason}
                    onChange={(event) =>
                      setCloseReason(event.target.value === "not_planned" ? "not_planned" : "completed")
                    }
                  >
                    <option value="completed">Completed</option>
                    <option value="not_planned">Not planned</option>
                  </select>
                )}
                {issueActionDisabledReason && (
                  <small className="action-disabled-note">{issueActionDisabledReason}</small>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">No issues found.</div>
          )}
        </div>
      </div>
    </section>
  );
}
