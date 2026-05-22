import { ChevronDown, ExternalLink, MessageSquare, Plus, Search } from "lucide-react";
import { useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  DiscussionCategoryListResult,
  DiscussionDetailResult,
  DiscussionCommentSummary,
  DiscussionSummary,
  GitHubAction,
  GitHubMutationFields,
  GitHubReadAvailability,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import {
  MarkdownBody,
  markdownRepositoryUrlContext,
  type MarkdownUrlContext
} from "@renderer/components/MarkdownBody";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryMutationDisabledReason,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";

import { useControlApi } from "@renderer/hooks/useControlApi";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
const maxDiscussionsLimit = 100;

function TimelineComment({
  authorLogin,
  authorAvatarUrl,
  createdAt,
  body,
  disabledReason,
  markdownUrlContext,
  onOpenExternal,
  onEdit,
  onDelete
}: {
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  body: string;
  disabledReason?: string | null;
  markdownUrlContext?: MarkdownUrlContext;
  onOpenExternal(url: string): void;
  onEdit?(body: string): void;
  onDelete?(): void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(body);
  const hasActions = Boolean(onEdit || onDelete);
  const editSubmitDisabledReason = disabledReason ?? (!editBody.trim() ? "Comment body is required." : null);

  return (
    <article className="timeline-comment">
      <div className="timeline-avatar">
        {authorAvatarUrl ? (
          <img src={authorAvatarUrl} alt="" />
        ) : (
          <span>{authorLogin?.slice(0, 1).toUpperCase() ?? "?"}</span>
        )}
      </div>
      <div className="timeline-card">
        <header className="timeline-card-header">
          <strong>{authorLogin ?? "unknown"}</strong>
          <span>commented {formatRelativeDate(createdAt)}</span>
          {hasActions && (
            <div className="timeline-actions">
              {onEdit && (
                <button
                  type="button"
                  disabled={Boolean(disabledReason)}
                  title={disabledReason ?? undefined}
                  onClick={() => {
                    setEditBody(body);
                    setEditing(true);
                  }}
                >
                  Edit comment
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  disabled={Boolean(disabledReason)}
                  title={disabledReason ?? undefined}
                  onClick={onDelete}
                >
                  Delete comment
                </button>
              )}
            </div>
          )}
        </header>
        {editing ? (
          <form
            className="timeline-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (editSubmitDisabledReason) {
                return;
              }
              onEdit?.(editBody.trim());
            }}
          >
            <textarea
              value={editBody}
              disabled={Boolean(disabledReason)}
              title={disabledReason ?? undefined}
              onChange={(event) => setEditBody(event.target.value)}
              placeholder="Edit comment body"
            />
            <div>
              <button
                className="dark-action"
                type="submit"
                disabled={Boolean(editSubmitDisabledReason)}
                title={editSubmitDisabledReason ?? undefined}
              >
                Save comment
              </button>
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              {editSubmitDisabledReason && (
                <small className="action-disabled-note">{editSubmitDisabledReason}</small>
              )}
            </div>
          </form>
        ) : (
          <MarkdownBody markdown={body} onOpenExternal={onOpenExternal} urlContext={markdownUrlContext} />
        )}
      </div>
    </article>
  );
}

export function DiscussionsTab({
  repository,
  discussions,
  discussionsLimit,
  focusedDiscussionNumber,
  githubReady,
  loading,
  availability,
  error,
  onOpenExternal,
  onSelectDiscussion,
  onExpandDiscussions,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onMutate
}: {
  repository: RepositoryDetail;
  discussions: DiscussionSummary[];
  discussionsLimit: number;
  focusedDiscussionNumber: number | null;
  githubReady: boolean;
  loading: boolean;
  availability: GitHubReadAvailability | null;
  error: Error | null;
  onOpenExternal(url: string): void;
  onSelectDiscussion(discussion: DiscussionSummary): void;
  onExpandDiscussions(): void;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const api = useControlApi();
  const [filter, setFilter] = useState("");
  const [composingDiscussion, setComposingDiscussion] = useState(false);
  const [editingDiscussion, setEditingDiscussion] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionBody, setDiscussionBody] = useState("");
  const [discussionCategoryId, setDiscussionCategoryId] = useState("");
  const [discussionCommentBody, setDiscussionCommentBody] = useState("");
  const [submittedDiscussionAction, setSubmittedDiscussionAction] = useState<GitHubAction | null>(null);
  const defaultDiscussionRepliesLimit = 20;
  const expandedDiscussionRepliesLimit = 100;
  const [discussionSelection, setDiscussionSelection] = useState<{
    repositoryKey: string;
    discussionNumber: number | null;
    repliesLimit: number;
  }>(() => ({
    repositoryKey: repository.nameWithOwner,
    discussionNumber: focusedDiscussionNumber ?? discussions[0]?.number ?? null,
    repliesLimit: defaultDiscussionRepliesLimit
  }));
  const fallbackDiscussionNumber = focusedDiscussionNumber ?? discussions[0]?.number ?? null;
  const selectedDiscussionNumber =
    discussionSelection.repositoryKey === repository.nameWithOwner
      ? discussionSelection.discussionNumber
      : fallbackDiscussionNumber;
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredDiscussions = normalizedFilter
    ? discussions.filter((discussion) =>
        [
          discussion.title,
          discussion.authorLogin,
          discussion.category,
          discussion.body,
          discussion.answer?.body,
          ...discussion.previewComments.map((comment) => comment.body),
          String(discussion.number)
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedFilter))
      )
    : discussions;
  const selectedDiscussion =
    filteredDiscussions.find((discussion) => discussion.number === selectedDiscussionNumber) ??
    filteredDiscussions[0] ??
    null;
  const selectedDiscussionKey = selectedDiscussion
    ? `${repository.nameWithOwner}:discussion:${selectedDiscussion.number}`
    : null;
  const selectedDiscussionRepliesLimit =
    discussionSelection.repositoryKey === repository.nameWithOwner &&
    discussionSelection.discussionNumber === selectedDiscussion?.number
      ? discussionSelection.repliesLimit
      : defaultDiscussionRepliesLimit;
  const selectedPreviewComments =
    selectedDiscussion?.previewComments.filter((comment) => comment.id !== selectedDiscussion.answer?.id) ??
    [];
  const availabilityMessage = readAvailabilityMessage("Discussions", availability);
  const disabledFeatureMessage =
    !availabilityMessage && repository.administration.features.discussions === false
      ? "Discussions are disabled for this repository."
      : null;
  const discussionsLimitHit = discussions.length >= discussionsLimit;
  const canExpandDiscussions =
    !disabledFeatureMessage && discussionsLimitHit && discussionsLimit < maxDiscussionsLimit;
  const detail = useQuery<DiscussionDetailResult>({
    queryKey: [
      "discussion-detail",
      repository.owner,
      repository.name,
      selectedDiscussion?.number ?? null,
      selectedDiscussionRepliesLimit
    ],
    queryFn: () =>
      api.github.getDiscussionDetail({
        owner: repository.owner,
        repo: repository.name,
        discussionNumber: selectedDiscussion!.number,
        commentsLimit: 100,
        repliesLimit: selectedDiscussionRepliesLimit,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedDiscussion)
  });
  const categories = useQuery<DiscussionCategoryListResult>({
    queryKey: ["discussion-categories", repository.owner, repository.name],
    queryFn: () =>
      api.github.listDiscussionCategoriesWithStatus({
        owner: repository.owner,
        repo: repository.name,
        limit: 100,
        cacheOnly: !githubReady
      })
  });
  const selectedDiscussionDetail =
    detail.data?.item && detail.data.item.number === selectedDiscussion?.number ? detail.data.item : null;
  const detailAvailabilityMessage = readAvailabilityMessage(
    "Discussion detail",
    detail.data?.availability ?? null
  );
  const categoriesAvailabilityMessage = readAvailabilityMessage(
    "Discussion categories",
    categories.data?.availability ?? null
  );
  const categoryOptions = categories.data?.items ?? [];
  const selectedCategory =
    categoryOptions.find((category) => category.id === discussionCategoryId) ?? categoryOptions[0] ?? null;
  const acceptedAnswer = selectedDiscussionDetail?.answer ?? selectedDiscussion?.answer ?? null;
  const selectedComments =
    selectedDiscussionDetail?.commentsList.filter((comment) => comment.id !== acceptedAnswer?.id) ??
    selectedPreviewComments;
  const selectedCommentsArePreview = !selectedDiscussionDetail;
  const selectedRepliesTruncated = selectedComments.some(
    (comment) => isDiscussionDetailComment(comment) && comment.repliesTruncated
  );
  const canLoadMoreReplies =
    selectedDiscussionKey !== null &&
    selectedDiscussionDetail !== null &&
    selectedDiscussionRepliesLimit === defaultDiscussionRepliesLimit &&
    selectedRepliesTruncated;
  const discussionMarkdownUrlContext = markdownRepositoryUrlContext(
    repository,
    repository.defaultBranch ?? "HEAD"
  );
  const discussionMutationAction =
    mutationAction === "createDiscussion" ||
    mutationAction === "editDiscussion" ||
    mutationAction === "closeDiscussion" ||
    mutationAction === "reopenDiscussion" ||
    mutationAction === "addDiscussionComment" ||
    mutationAction === "editDiscussionComment" ||
    mutationAction === "deleteDiscussionComment"
      ? mutationAction
      : null;
  const discussionActionPendingReason =
    mutationPending && discussionMutationAction
      ? `${githubActionLabel(discussionMutationAction)} is still running.`
      : null;
  const discussionMutationDisabledReason =
    discussionActionPendingReason ??
    (!githubReady ? "Sign in with GitHub to change discussions." : null) ??
    (repository.administration.features.discussions === false
      ? "Discussions are disabled for this repository."
      : null) ??
    repositoryMutationDisabledReason(repository);
  const selectedDiscussionDisabledReason =
    discussionMutationDisabledReason ??
    (!selectedDiscussion ? "Select a discussion first." : null) ??
    (selectedDiscussion?.locked ? "Discussion is locked." : null);
  const createDiscussionDisabledReason =
    discussionMutationDisabledReason ??
    categoriesAvailabilityMessage ??
    (categories.isLoading && categoryOptions.length === 0 ? "Loading discussion categories." : null) ??
    (!selectedCategory ? "No discussion category is available." : null) ??
    (!discussionTitle.trim() ? "Discussion title is required." : null) ??
    (!discussionBody.trim() ? "Discussion body is required." : null);
  const editDiscussionDisabledReason =
    selectedDiscussionDisabledReason ??
    (!discussionTitle.trim() ? "Discussion title is required." : null) ??
    (!discussionBody.trim() ? "Discussion body is required." : null) ??
    (selectedDiscussion &&
    discussionTitle === selectedDiscussion.title &&
    discussionBody === (selectedDiscussionDetail?.body ?? selectedDiscussion.body ?? "")
      ? "No discussion changes to save."
      : null);
  const discussionCommentDisabledReason =
    selectedDiscussionDisabledReason ?? (!discussionCommentBody.trim() ? "Comment body is required." : null);
  const discussionMutationStatusActive =
    submittedDiscussionAction !== null && discussionMutationAction === submittedDiscussionAction;

  function submitDiscussionMutation(
    action: GitHubAction,
    dangerous: boolean,
    payload?: GitHubMutationFields
  ): void {
    setSubmittedDiscussionAction(action);
    onMutate(action, dangerous, payload);
  }

  function beginDiscussionCreate(): void {
    setSubmittedDiscussionAction(null);
    setComposingDiscussion(true);
    setEditingDiscussion(false);
    setDiscussionTitle("");
    setDiscussionBody("");
    setDiscussionCategoryId(selectedCategory?.id ?? "");
  }

  function beginDiscussionEdit(): void {
    if (!selectedDiscussion) {
      return;
    }
    setSubmittedDiscussionAction(null);
    setComposingDiscussion(false);
    setEditingDiscussion(true);
    setDiscussionTitle(selectedDiscussion.title);
    setDiscussionBody(selectedDiscussionDetail?.body ?? selectedDiscussion.body ?? "");
  }

  function resetDiscussionForms(): void {
    setComposingDiscussion(false);
    setEditingDiscussion(false);
    setDiscussionTitle("");
    setDiscussionBody("");
    setDiscussionCommentBody("");
    setSubmittedDiscussionAction(null);
  }

  return (
    <section className="table-panel github-surface">
      <div className="table-action-row surface-filter-row">
        <label className="surface-filter">
          <Search size={15} />
          <input
            aria-label="Filter discussions"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter discussions"
          />
        </label>
        <button
          type="button"
          disabled={Boolean(discussionMutationDisabledReason)}
          title={discussionMutationDisabledReason ?? undefined}
          onClick={beginDiscussionCreate}
        >
          <Plus size={16} /> New discussion
        </button>
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/discussions"))}>
          <ExternalLink size={16} /> GitHub fallback
        </button>
      </div>
      <div className="github-split">
        <div className="thread-list">
          {loading && discussions.length === 0 && <div className="loading-state">Loading discussions…</div>}
          {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
          {!loading && disabledFeatureMessage && <div className="empty-state">{disabledFeatureMessage}</div>}
          {error && <div className="error-state">Discussions unavailable: {error.message}</div>}
          {canExpandDiscussions && (
            <div className="table-action-row">
              <button type="button" onClick={onExpandDiscussions}>
                <ChevronDown size={16} /> Load more discussions
              </button>
            </div>
          )}
          {!canExpandDiscussions && discussionsLimitHit && (
            <div className="muted-row">
              Showing the first {discussions.length} discussions returned by GitHub.
            </div>
          )}
          {filteredDiscussions.map((discussion) => (
            <div
              className={`issue-row thread-list-action-row ${
                selectedDiscussion?.number === discussion.number ? "active" : ""
              }`}
              key={discussion.id}
            >
              <button
                className="thread-list-row-main"
                type="button"
                onClick={() => {
                  setComposingDiscussion(false);
                  setEditingDiscussion(false);
                  setDiscussionSelection({
                    repositoryKey: repository.nameWithOwner,
                    discussionNumber: discussion.number,
                    repliesLimit: defaultDiscussionRepliesLimit
                  });
                  onSelectDiscussion(discussion);
                }}
              >
                <MessageSquare size={17} />
                <div>
                  <strong>{discussion.title}</strong>
                  <small>
                    #{discussion.number} · {discussion.authorLogin ?? "unknown"} · updated{" "}
                    {formatRelativeDate(discussion.updatedAt)} · {formatCompactNumber(discussion.comments)}{" "}
                    comments · {formatCompactNumber(discussion.upvotes)} upvotes
                  </small>
                </div>
                {discussion.category && <span className="state-chip">{discussion.category}</span>}
                {discussion.isAnswered && <span className="state-chip success">answered</span>}
                {discussion.closed && <span className="state-chip">closed</span>}
                {discussion.locked && <span className="state-chip">locked</span>}
              </button>
              <button
                className="pin-row-button"
                type="button"
                aria-label={`Open discussion ${discussion.number} GitHub fallback`}
                title={`GitHub fallback for discussion #${discussion.number}`}
                onClick={() => onOpenExternal(discussion.htmlUrl)}
              >
                <ExternalLink size={15} />
              </button>
            </div>
          ))}
          {!loading &&
            !error &&
            !availabilityMessage &&
            !disabledFeatureMessage &&
            filteredDiscussions.length === 0 && (
              <div className="empty-state">
                {filter.trim() ? "No discussions match this filter." : "No discussions returned."}
              </div>
            )}
        </div>

        <div className="thread-detail">
          {composingDiscussion || editingDiscussion ? (
            <form
              className="compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (composingDiscussion) {
                  if (createDiscussionDisabledReason || !selectedCategory) {
                    return;
                  }
                  submitDiscussionMutation("createDiscussion", false, {
                    categoryId: selectedCategory.id,
                    title: discussionTitle.trim(),
                    body: discussionBody
                  });
                  return;
                }

                if (editDiscussionDisabledReason || !selectedDiscussion) {
                  return;
                }
                submitDiscussionMutation("editDiscussion", false, {
                  discussionId: selectedDiscussion.id,
                  title: discussionTitle.trim(),
                  body: discussionBody
                });
              }}
            >
              <h2>{composingDiscussion ? "Create discussion" : "Edit discussion"}</h2>
              {discussionMutationStatusActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel(submittedDiscussionAction)} is running. The form is locked until GitHub
                  responds.
                </div>
              )}
              {discussionMutationStatusActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel(submittedDiscussionAction)} completed. Discussion data is refreshing.
                </div>
              )}
              {discussionMutationStatusActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel(submittedDiscussionAction)} failed: {mutationError.message}
                </div>
              )}
              {composingDiscussion && (
                <select
                  disabled={Boolean(discussionMutationDisabledReason ?? categoriesAvailabilityMessage)}
                  title={discussionMutationDisabledReason ?? categoriesAvailabilityMessage ?? undefined}
                  value={selectedCategory?.id ?? ""}
                  onChange={(event) => setDiscussionCategoryId(event.target.value)}
                >
                  {categoryOptions.length === 0 ? (
                    <option value="">No discussion categories returned</option>
                  ) : (
                    categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {[category.emoji, category.name, category.isAnswerable ? "answerable" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </option>
                    ))
                  )}
                </select>
              )}
              {categories.isLoading && composingDiscussion && (
                <small className="action-disabled-note">Loading discussion categories…</small>
              )}
              {categories.error instanceof Error && composingDiscussion && (
                <small className="action-disabled-note">
                  Discussion categories unavailable: {categories.error.message}
                </small>
              )}
              {categoriesAvailabilityMessage && composingDiscussion && (
                <small className="action-disabled-note">{categoriesAvailabilityMessage}</small>
              )}
              <input
                value={discussionTitle}
                disabled={Boolean(discussionMutationDisabledReason)}
                title={discussionMutationDisabledReason ?? undefined}
                onChange={(event) => setDiscussionTitle(event.target.value)}
                placeholder="Discussion title"
              />
              <textarea
                value={discussionBody}
                disabled={Boolean(discussionMutationDisabledReason)}
                title={discussionMutationDisabledReason ?? undefined}
                onChange={(event) => setDiscussionBody(event.target.value)}
                placeholder="Discussion body"
              />
              <div className="thread-actions">
                <button
                  type="submit"
                  disabled={Boolean(
                    composingDiscussion ? createDiscussionDisabledReason : editDiscussionDisabledReason
                  )}
                  title={
                    (composingDiscussion ? createDiscussionDisabledReason : editDiscussionDisabledReason) ??
                    undefined
                  }
                >
                  <MessageSquare size={16} /> {composingDiscussion ? "Create discussion" : "Save discussion"}
                </button>
                <button type="button" onClick={resetDiscussionForms}>
                  Cancel
                </button>
              </div>
              {(composingDiscussion ? createDiscussionDisabledReason : editDiscussionDisabledReason) && (
                <small className="action-disabled-note">
                  {composingDiscussion ? createDiscussionDisabledReason : editDiscussionDisabledReason}
                </small>
              )}
            </form>
          ) : selectedDiscussion ? (
            <>
              <header className="thread-header">
                <h2>{selectedDiscussion.title}</h2>
                <small>
                  #{selectedDiscussion.number} · {selectedDiscussion.authorLogin ?? "unknown"} · updated{" "}
                  {formatRelativeDate(selectedDiscussion.updatedAt)}
                </small>
                {selectedDiscussion.category && (
                  <span className="state-chip">{selectedDiscussion.category}</span>
                )}
              </header>
              <div className="workflow-summary">
                <span>{selectedDiscussion.comments} comments</span>
                <span>{selectedDiscussion.upvotes} upvotes</span>
                {selectedDiscussion.isAnswered && <span>Answered</span>}
                {selectedDiscussion.closed && <span>Closed</span>}
                {selectedDiscussion.locked && <span>Locked</span>}
                <span>Managed in Control</span>
              </div>
              <div className="timeline-thread">
                <TimelineComment
                  authorLogin={selectedDiscussion.authorLogin}
                  authorAvatarUrl={selectedDiscussion.authorAvatarUrl}
                  createdAt={selectedDiscussion.createdAt}
                  body={selectedDiscussion.body?.trim() || "No discussion body returned."}
                  markdownUrlContext={discussionMarkdownUrlContext}
                  onOpenExternal={onOpenExternal}
                />
              </div>
              <div className="thread-actions">
                <button
                  type="button"
                  disabled={Boolean(selectedDiscussionDisabledReason)}
                  title={selectedDiscussionDisabledReason ?? undefined}
                  onClick={beginDiscussionEdit}
                >
                  <MessageSquare size={16} /> Edit discussion
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedDiscussionDisabledReason)}
                  title={selectedDiscussionDisabledReason ?? undefined}
                  onClick={() =>
                    submitDiscussionMutation(
                      selectedDiscussion.closed ? "reopenDiscussion" : "closeDiscussion",
                      selectedDiscussion.closed ? false : true,
                      { discussionId: selectedDiscussion.id }
                    )
                  }
                >
                  {selectedDiscussion.closed ? "Reopen discussion" : "Close discussion"}
                </button>
                <button type="button" onClick={() => onOpenExternal(selectedDiscussion.htmlUrl)}>
                  <ExternalLink size={16} /> GitHub fallback
                </button>
                {selectedDiscussionDisabledReason && (
                  <small className="action-disabled-note">{selectedDiscussionDisabledReason}</small>
                )}
              </div>
              <form
                className="compose-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (discussionCommentDisabledReason) {
                    return;
                  }
                  submitDiscussionMutation("addDiscussionComment", false, {
                    discussionId: selectedDiscussion.id,
                    body: discussionCommentBody
                  });
                  setDiscussionCommentBody("");
                }}
              >
                <h2>Add comment</h2>
                <textarea
                  value={discussionCommentBody}
                  disabled={Boolean(selectedDiscussionDisabledReason)}
                  title={selectedDiscussionDisabledReason ?? undefined}
                  onChange={(event) => setDiscussionCommentBody(event.target.value)}
                  placeholder="Add a discussion comment"
                />
                <div className="thread-actions">
                  <button
                    type="submit"
                    disabled={Boolean(discussionCommentDisabledReason)}
                    title={discussionCommentDisabledReason ?? undefined}
                  >
                    <Plus size={16} /> Add comment
                  </button>
                </div>
                {discussionCommentDisabledReason && (
                  <small className="action-disabled-note">{discussionCommentDisabledReason}</small>
                )}
              </form>
              {discussionMutationStatusActive &&
                !composingDiscussion &&
                !editingDiscussion &&
                mutationPending && (
                  <div className="loading-state">
                    {githubActionLabel(submittedDiscussionAction)} is running. Discussion data will refresh
                    after GitHub responds.
                  </div>
                )}
              {discussionMutationStatusActive &&
                !composingDiscussion &&
                !editingDiscussion &&
                !mutationPending &&
                mutationSucceeded && (
                  <div className="success-state">
                    {githubActionLabel(submittedDiscussionAction)} completed. Discussion data is refreshing.
                  </div>
                )}
              {discussionMutationStatusActive &&
                !composingDiscussion &&
                !editingDiscussion &&
                !mutationPending &&
                mutationError && (
                  <div className="error-state">
                    {githubActionLabel(submittedDiscussionAction)} failed: {mutationError.message}
                  </div>
                )}
              {acceptedAnswer && (
                <div className="discussion-detail-section">
                  <h3>Accepted answer</h3>
                  <TimelineComment
                    authorLogin={acceptedAnswer.authorLogin}
                    authorAvatarUrl={acceptedAnswer.authorAvatarUrl}
                    createdAt={acceptedAnswer.createdAt}
                    body={acceptedAnswer.body?.trim() || "No answer body returned."}
                    markdownUrlContext={discussionMarkdownUrlContext}
                    onOpenExternal={onOpenExternal}
                  />
                </div>
              )}
              <div className="discussion-detail-section">
                <h3>{selectedDiscussionDetail ? "Comments" : "Recent comments"}</h3>
                {detail.isLoading && <div className="loading-state">Loading full discussion…</div>}
                {!detail.isLoading && detail.error && (
                  <div className="error-state">Discussion detail unavailable: {detail.error.message}</div>
                )}
                {!detail.isLoading && detailAvailabilityMessage && (
                  <div className="error-state">{detailAvailabilityMessage}</div>
                )}
                {!detail.isLoading && !detailAvailabilityMessage && detail.data && !detail.data.item && (
                  <div className="empty-state">Discussion detail was not returned.</div>
                )}
                {selectedComments.length > 0 && (
                  <small className="action-disabled-note">
                    Showing {formatCompactNumber(selectedComments.length)} of{" "}
                    {formatCompactNumber(selectedDiscussion.comments)} comments
                    {selectedCommentsArePreview ? " from the list preview" : ""}.
                  </small>
                )}
                {canLoadMoreReplies && (
                  <button
                    type="button"
                    onClick={() =>
                      setDiscussionSelection({
                        repositoryKey: repository.nameWithOwner,
                        discussionNumber: selectedDiscussion.number,
                        repliesLimit: expandedDiscussionRepliesLimit
                      })
                    }
                  >
                    Load more replies
                  </button>
                )}
                {selectedComments.length > 0 ? (
                  <div className="timeline-thread">
                    {selectedComments.map((comment) => {
                      const detailComment = isDiscussionDetailComment(comment) ? comment : null;
                      const replies = detailComment?.replies ?? [];
                      const repliesTruncated = detailComment?.repliesTruncated ?? false;

                      return (
                        <div className="discussion-comment-thread" key={comment.id}>
                          <TimelineComment
                            authorLogin={comment.authorLogin}
                            authorAvatarUrl={comment.authorAvatarUrl}
                            createdAt={comment.createdAt}
                            body={comment.body?.trim() || "No comment body returned."}
                            disabledReason={selectedDiscussionDisabledReason}
                            markdownUrlContext={discussionMarkdownUrlContext}
                            onOpenExternal={onOpenExternal}
                            onEdit={(body) =>
                              submitDiscussionMutation("editDiscussionComment", false, {
                                commentId: comment.id,
                                body
                              })
                            }
                            onDelete={() =>
                              submitDiscussionMutation("deleteDiscussionComment", true, {
                                commentId: comment.id
                              })
                            }
                          />
                          {replies.length > 0 && (
                            <div className="timeline-thread">
                              {replies.map((reply) => (
                                <TimelineComment
                                  key={reply.id}
                                  authorLogin={reply.authorLogin}
                                  authorAvatarUrl={reply.authorAvatarUrl}
                                  createdAt={reply.createdAt}
                                  body={reply.body?.trim() || "No reply body returned."}
                                  disabledReason={selectedDiscussionDisabledReason}
                                  markdownUrlContext={discussionMarkdownUrlContext}
                                  onOpenExternal={onOpenExternal}
                                  onEdit={(body) =>
                                    submitDiscussionMutation("editDiscussionComment", false, {
                                      commentId: reply.id,
                                      body
                                    })
                                  }
                                  onDelete={() =>
                                    submitDiscussionMutation("deleteDiscussionComment", true, {
                                      commentId: reply.id
                                    })
                                  }
                                />
                              ))}
                            </div>
                          )}
                          {repliesTruncated && (
                            <small className="action-disabled-note">
                              {selectedDiscussionRepliesLimit >= expandedDiscussionRepliesLimit
                                ? `Control is showing the first ${expandedDiscussionRepliesLimit} replies for this thread.`
                                : "Some replies are not shown."}{" "}
                              Use GitHub fallback for the full thread.
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">No discussion comments returned.</div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              {loading ? "Loading discussion detail…" : "Select a discussion to inspect."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function isDiscussionDetailComment(
  comment: TimelineCommentSummary | DiscussionCommentSummary
): comment is DiscussionCommentSummary {
  return "replies" in comment && Array.isArray(comment.replies);
}
