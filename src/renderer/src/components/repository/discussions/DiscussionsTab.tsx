import { ChevronDown, ExternalLink, MessageSquare, Plus, Search } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  DiscussionCategoryListResult,
  DiscussionCategorySummary,
  DiscussionCommentSummary,
  DiscussionDetail,
  DiscussionDetailResult,
  DiscussionSummary,
  GitHubAction,
  GitHubMutationFields,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import { markdownRepositoryUrlContext } from "@renderer/components/MarkdownBody";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryMutationDisabledReason,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";
import { TimelineComment } from "@renderer/components/shared/TimelineComment";

import { useControlApi } from "@renderer/hooks/useControlApi";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
import { useDiscussionsTabQueries } from "./DiscussionsTab.queries";

const maxDiscussionsLimit = 100;
const defaultDiscussionRepliesLimit = 20;
const expandedDiscussionRepliesLimit = 100;

type DiscussionFormMode = "create" | "edit";

interface DiscussionsTabProps {
  repository: RepositoryDetail;
  discussionsLimit: number;
  focusedDiscussionNumber: number | null;
  githubReady: boolean;
  onOpenExternal(url: string): void;
  onSelectDiscussion(discussion: DiscussionSummary): void;
  onExpandDiscussions(): void;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}

interface DiscussionSelection {
  repositoryKey: string;
  discussionNumber: number | null;
  repliesLimit: number;
}

interface DiscussionFormSubmitInput {
  title: string;
  body: string;
  categoryId: string | null;
}

interface DiscussionCommentsState {
  detailAvailabilityMessage: string | null;
  detailDiscussionNumber: number | null;
  detailError: Error | null;
  detailLoading: boolean;
  detailReturnedEmpty: boolean;
  canLoadMoreReplies: boolean;
  selectedComments: Array<TimelineCommentSummary | DiscussionCommentSummary>;
  selectedCommentsArePreview: boolean;
  selectedDiscussionRepliesLimit: number;
}

function isDiscussionDetailComment(
  comment: TimelineCommentSummary | DiscussionCommentSummary
): comment is DiscussionCommentSummary {
  return "replies" in comment && Array.isArray(comment.replies);
}

function filterDiscussions(discussions: DiscussionSummary[], filter: string): DiscussionSummary[] {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) {
    return discussions;
  }

  return discussions.filter((discussion) => {
    const searchableValues: Array<string | number | null | undefined> = [
      discussion.title,
      discussion.authorLogin,
      discussion.category,
      discussion.body,
      discussion.answer?.body,
      discussion.number
    ];

    for (const comment of discussion.previewComments) {
      searchableValues.push(comment.body);
    }

    return searchableValues.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedFilter)
    );
  });
}

function DiscussionMutationStatus({
  active,
  action,
  mutationPending,
  mutationSucceeded,
  mutationError,
  runningMessage
}: {
  active: boolean;
  action: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  runningMessage: string;
}): JSX.Element | null {
  if (!active || !action) {
    return null;
  }

  if (mutationPending) {
    return <div className="loading-state">{runningMessage}</div>;
  }

  if (mutationSucceeded) {
    return (
      <div className="success-state">
        {githubActionLabel(action)} completed. Discussion data is refreshing.
      </div>
    );
  }

  if (mutationError) {
    return (
      <div className="error-state">
        {githubActionLabel(action)} failed: {mutationError.message}
      </div>
    );
  }

  return null;
}

function DiscussionsToolbar({
  disabledReason,
  filter,
  onCreateDiscussion,
  onFilterChange,
  onOpenFallback
}: {
  disabledReason: string | null;
  filter: string;
  onCreateDiscussion(): void;
  onFilterChange(value: string): void;
  onOpenFallback(): void;
}): JSX.Element {
  function handleFilterChange(event: ChangeEvent<HTMLInputElement>): void {
    onFilterChange(event.target.value);
  }

  return (
    <div className="table-action-row surface-filter-row">
      <label className="surface-filter">
        <Search size={15} />
        <input
          aria-label="Filter discussions"
          value={filter}
          onChange={handleFilterChange}
          placeholder="Filter discussions"
        />
      </label>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={onCreateDiscussion}
      >
        <Plus size={16} /> New discussion
      </button>
      <button type="button" onClick={onOpenFallback}>
        <ExternalLink size={16} /> Open on GitHub
      </button>
    </div>
  );
}

function DiscussionListRow({
  active,
  discussion,
  onOpenExternal,
  onSelectDiscussion
}: {
  active: boolean;
  discussion: DiscussionSummary;
  onOpenExternal(url: string): void;
  onSelectDiscussion(discussion: DiscussionSummary): void;
}): JSX.Element {
  function handleSelectDiscussion(): void {
    onSelectDiscussion(discussion);
  }

  function handleOpenFallback(): void {
    onOpenExternal(discussion.htmlUrl);
  }

  return (
    <div className={`issue-row thread-list-action-row ${active ? "active" : ""}`}>
      <button className="thread-list-row-main" type="button" onClick={handleSelectDiscussion}>
        <MessageSquare size={17} />
        <div>
          <strong>{discussion.title}</strong>
          <small>
            #{discussion.number} · {discussion.authorLogin ?? "unknown"} · updated{" "}
            {formatRelativeDate(discussion.updatedAt)} · {formatCompactNumber(discussion.comments)} comments ·{" "}
            {formatCompactNumber(discussion.upvotes)} upvotes
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
        aria-label={`Open discussion ${discussion.number} on GitHub`}
        title={`Open discussion #${discussion.number} on GitHub`}
        onClick={handleOpenFallback}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function DiscussionList({
  availabilityMessage,
  canExpandDiscussions,
  disabledFeatureMessage,
  discussions,
  discussionsLimitHit,
  error,
  filter,
  filteredDiscussions,
  loading,
  selectedDiscussion,
  onExpandDiscussions,
  onOpenExternal,
  onSelectDiscussion
}: {
  availabilityMessage: string | null;
  canExpandDiscussions: boolean;
  disabledFeatureMessage: string | null;
  discussions: DiscussionSummary[];
  discussionsLimitHit: boolean;
  error: Error | null;
  filter: string;
  filteredDiscussions: DiscussionSummary[];
  loading: boolean;
  selectedDiscussion: DiscussionSummary | DiscussionDetail | null;
  onExpandDiscussions(): void;
  onOpenExternal(url: string): void;
  onSelectDiscussion(discussion: DiscussionSummary): void;
}): JSX.Element {
  return (
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
        <DiscussionListRow
          active={selectedDiscussion?.number === discussion.number}
          discussion={discussion}
          key={discussion.id}
          onOpenExternal={onOpenExternal}
          onSelectDiscussion={onSelectDiscussion}
        />
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
  );
}

function DiscussionCategorySelect({
  categoriesError,
  categoriesLoading,
  categoriesAvailabilityMessage,
  categoryOptions,
  disabledReason,
  selectedCategory,
  onCategoryChange
}: {
  categoriesError: Error | null;
  categoriesLoading: boolean;
  categoriesAvailabilityMessage: string | null;
  categoryOptions: DiscussionCategorySummary[];
  disabledReason: string | null;
  selectedCategory: DiscussionCategorySummary | null;
  onCategoryChange(value: string): void;
}): JSX.Element {
  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>): void {
    onCategoryChange(event.target.value);
  }

  return (
    <>
      <select
        disabled={Boolean(disabledReason ?? categoriesAvailabilityMessage)}
        title={disabledReason ?? categoriesAvailabilityMessage ?? undefined}
        value={selectedCategory?.id ?? ""}
        onChange={handleCategoryChange}
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
      {categoriesLoading && <small className="action-disabled-note">Loading discussion categories…</small>}
      {categoriesError && (
        <small className="action-disabled-note">
          Discussion categories unavailable: {categoriesError.message}
        </small>
      )}
      {categoriesAvailabilityMessage && (
        <small className="action-disabled-note">{categoriesAvailabilityMessage}</small>
      )}
    </>
  );
}

function DiscussionForm({
  body,
  categoriesAvailabilityMessage,
  categoriesError,
  categoriesLoading,
  categoryOptions,
  disabledReason,
  mode,
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  selectedCategory,
  submitDisabledReason,
  submittedDiscussionAction,
  title,
  onBodyChange,
  onCancel,
  onCategoryChange,
  onSubmit,
  onTitleChange
}: {
  body: string;
  categoriesAvailabilityMessage: string | null;
  categoriesError: Error | null;
  categoriesLoading: boolean;
  categoryOptions: DiscussionCategorySummary[];
  disabledReason: string | null;
  mode: DiscussionFormMode;
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  selectedCategory: DiscussionCategorySummary | null;
  submitDisabledReason: string | null;
  submittedDiscussionAction: GitHubAction | null;
  title: string;
  onBodyChange(value: string): void;
  onCancel(): void;
  onCategoryChange(value: string): void;
  onSubmit(input: DiscussionFormSubmitInput): void;
  onTitleChange(value: string): void;
}): JSX.Element {
  const action: GitHubAction = mode === "create" ? "createDiscussion" : "editDiscussion";
  const mutationActive = submittedDiscussionAction === action && mutationAction === action;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submitDisabledReason) {
      return;
    }

    onSubmit({
      title: title.trim(),
      body,
      categoryId: selectedCategory?.id ?? null
    });
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>): void {
    onTitleChange(event.target.value);
  }

  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onBodyChange(event.target.value);
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      <h2>{mode === "create" ? "Create discussion" : "Edit discussion"}</h2>
      <DiscussionMutationStatus
        active={mutationActive}
        action={action}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        runningMessage={`${githubActionLabel(action)} is running. The form is locked until GitHub responds.`}
      />
      {mode === "create" && (
        <DiscussionCategorySelect
          categoriesAvailabilityMessage={categoriesAvailabilityMessage}
          categoriesError={categoriesError}
          categoriesLoading={categoriesLoading}
          categoryOptions={categoryOptions}
          disabledReason={disabledReason}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
        />
      )}
      <input
        value={title}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onChange={handleTitleChange}
        placeholder="Discussion title"
      />
      <textarea
        value={body}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onChange={handleBodyChange}
        placeholder="Discussion body"
      />
      <div className="thread-actions">
        <button
          type="submit"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason ?? undefined}
        >
          <MessageSquare size={16} /> {mode === "create" ? "Create discussion" : "Save discussion"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {submitDisabledReason && <small className="action-disabled-note">{submitDisabledReason}</small>}
    </form>
  );
}

function DiscussionActions({
  disabledReason,
  discussion,
  onBeginEdit,
  onCloseOrReopen,
  onOpenExternal
}: {
  disabledReason: string | null;
  discussion: DiscussionSummary | DiscussionDetail;
  onBeginEdit(): void;
  onCloseOrReopen(discussion: DiscussionSummary | DiscussionDetail): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function handleCloseOrReopen(): void {
    onCloseOrReopen(discussion);
  }

  function handleOpenFallback(): void {
    onOpenExternal(discussion.htmlUrl);
  }

  return (
    <div className="thread-actions">
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={onBeginEdit}
      >
        <MessageSquare size={16} /> Edit discussion
      </button>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={handleCloseOrReopen}
      >
        {discussion.closed ? "Reopen discussion" : "Close discussion"}
      </button>
      <button type="button" onClick={handleOpenFallback}>
        <ExternalLink size={16} /> Open on GitHub
      </button>
      {disabledReason && <small className="action-disabled-note">{disabledReason}</small>}
    </div>
  );
}

function AddDiscussionCommentForm({
  body,
  disabledReason,
  selectedDiscussionDisabledReason,
  onBodyChange,
  onSubmit
}: {
  body: string;
  disabledReason: string | null;
  selectedDiscussionDisabledReason: string | null;
  onBodyChange(value: string): void;
  onSubmit(): void;
}): JSX.Element {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabledReason) {
      return;
    }
    onSubmit();
  }

  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onBodyChange(event.target.value);
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      <h2>Add comment</h2>
      <textarea
        value={body}
        disabled={Boolean(selectedDiscussionDisabledReason)}
        title={selectedDiscussionDisabledReason ?? undefined}
        onChange={handleBodyChange}
        placeholder="Add a discussion comment"
      />
      <div className="thread-actions">
        <button type="submit" disabled={Boolean(disabledReason)} title={disabledReason ?? undefined}>
          <Plus size={16} /> Add comment
        </button>
      </div>
      {disabledReason && <small className="action-disabled-note">{disabledReason}</small>}
    </form>
  );
}

function DiscussionTimelineEntry({
  comment,
  disabledReason,
  markdownUrlContext,
  onDeleteComment,
  onEditComment,
  onOpenExternal
}: {
  comment: TimelineCommentSummary;
  disabledReason: string | null;
  markdownUrlContext: ReturnType<typeof markdownRepositoryUrlContext>;
  onDeleteComment(comment: TimelineCommentSummary): void;
  onEditComment(comment: TimelineCommentSummary, body: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function handleEdit(body: string): void {
    onEditComment(comment, body);
  }

  function handleDelete(): void {
    onDeleteComment(comment);
  }

  return (
    <TimelineComment
      authorLogin={comment.authorLogin}
      authorAvatarUrl={comment.authorAvatarUrl}
      createdAt={comment.createdAt}
      body={comment.body?.trim() || "No comment body returned."}
      disabledReason={disabledReason}
      markdownUrlContext={markdownUrlContext}
      onOpenExternal={onOpenExternal}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
}

function DiscussionCommentThread({
  comment,
  disabledReason,
  markdownUrlContext,
  repliesLimit,
  onDeleteComment,
  onEditComment,
  onOpenExternal
}: {
  comment: TimelineCommentSummary | DiscussionCommentSummary;
  disabledReason: string | null;
  markdownUrlContext: ReturnType<typeof markdownRepositoryUrlContext>;
  repliesLimit: number;
  onDeleteComment(comment: TimelineCommentSummary): void;
  onEditComment(comment: TimelineCommentSummary, body: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const detailComment = isDiscussionDetailComment(comment) ? comment : null;
  const replies = detailComment?.replies ?? [];
  const repliesTruncated = detailComment?.repliesTruncated ?? false;

  return (
    <div className="discussion-comment-thread">
      <DiscussionTimelineEntry
        comment={comment}
        disabledReason={disabledReason}
        markdownUrlContext={markdownUrlContext}
        onDeleteComment={onDeleteComment}
        onEditComment={onEditComment}
        onOpenExternal={onOpenExternal}
      />
      {replies.length > 0 && (
        <div className="timeline-thread">
          {replies.map((reply) => (
            <DiscussionTimelineEntry
              comment={reply}
              disabledReason={disabledReason}
              key={reply.id}
              markdownUrlContext={markdownUrlContext}
              onDeleteComment={onDeleteComment}
              onEditComment={onEditComment}
              onOpenExternal={onOpenExternal}
            />
          ))}
        </div>
      )}
      {repliesTruncated && (
        <small className="action-disabled-note">
          {repliesLimit >= expandedDiscussionRepliesLimit
            ? `Control is showing the first ${expandedDiscussionRepliesLimit} replies for this thread.`
            : "Some replies are not shown."}{" "}
          Open the full thread on GitHub.
        </small>
      )}
    </div>
  );
}

function DiscussionCommentsSection({
  commentsState,
  disabledReason,
  discussion,
  markdownUrlContext,
  onDeleteComment,
  onEditComment,
  onLoadMoreReplies,
  onOpenExternal
}: {
  commentsState: DiscussionCommentsState;
  disabledReason: string | null;
  discussion: DiscussionSummary | DiscussionDetail;
  markdownUrlContext: ReturnType<typeof markdownRepositoryUrlContext>;
  onDeleteComment(comment: TimelineCommentSummary): void;
  onEditComment(comment: TimelineCommentSummary, body: string): void;
  onLoadMoreReplies(): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const {
    detailAvailabilityMessage,
    detailError,
    detailLoading,
    detailReturnedEmpty,
    canLoadMoreReplies,
    selectedComments,
    selectedCommentsArePreview,
    selectedDiscussionRepliesLimit
  } = commentsState;

  return (
    <div className="discussion-detail-section">
      <h3>{"commentsList" in discussion ? "Comments" : "Recent comments"}</h3>
      {detailLoading && <div className="loading-state">Loading full discussion…</div>}
      {!detailLoading && detailError && (
        <div className="error-state">Discussion detail unavailable: {detailError.message}</div>
      )}
      {!detailLoading && detailAvailabilityMessage && (
        <div className="error-state">{detailAvailabilityMessage}</div>
      )}
      {!detailLoading && detailReturnedEmpty && (
        <div className="empty-state">Discussion detail was not returned.</div>
      )}
      {selectedComments.length > 0 && (
        <small className="action-disabled-note">
          Showing {formatCompactNumber(selectedComments.length)} of {formatCompactNumber(discussion.comments)}{" "}
          comments{selectedCommentsArePreview ? " from the list preview" : ""}.
        </small>
      )}
      {canLoadMoreReplies && (
        <button type="button" onClick={onLoadMoreReplies}>
          Load more replies
        </button>
      )}
      {selectedComments.length > 0 ? (
        <div className="timeline-thread">
          {selectedComments.map((comment) => (
            <DiscussionCommentThread
              comment={comment}
              disabledReason={disabledReason}
              key={comment.id}
              markdownUrlContext={markdownUrlContext}
              repliesLimit={selectedDiscussionRepliesLimit}
              onDeleteComment={onDeleteComment}
              onEditComment={onEditComment}
              onOpenExternal={onOpenExternal}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">No discussion comments returned.</div>
      )}
    </div>
  );
}

function DiscussionDetail({
  acceptedAnswer,
  commentBody,
  commentsState,
  disabledReason,
  discussion,
  markdownUrlContext,
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  submittedDiscussionAction,
  onAddComment,
  onBeginEdit,
  onCloseOrReopen,
  onCommentBodyChange,
  onDeleteComment,
  onEditComment,
  onLoadMoreReplies,
  onOpenExternal
}: {
  acceptedAnswer: TimelineCommentSummary | null;
  commentBody: string;
  commentsState: DiscussionCommentsState;
  disabledReason: string | null;
  discussion: DiscussionSummary | DiscussionDetail;
  markdownUrlContext: ReturnType<typeof markdownRepositoryUrlContext>;
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  submittedDiscussionAction: GitHubAction | null;
  onAddComment(): void;
  onBeginEdit(): void;
  onCloseOrReopen(discussion: DiscussionSummary | DiscussionDetail): void;
  onCommentBodyChange(value: string): void;
  onDeleteComment(comment: TimelineCommentSummary): void;
  onEditComment(comment: TimelineCommentSummary, body: string): void;
  onLoadMoreReplies(): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const detailMutationActive =
    submittedDiscussionAction !== null &&
    submittedDiscussionAction !== "createDiscussion" &&
    submittedDiscussionAction !== "editDiscussion" &&
    mutationAction === submittedDiscussionAction;
  const commentDisabledReason = disabledReason ?? (!commentBody.trim() ? "Comment body is required." : null);

  return (
    <>
      <header className="thread-header">
        <h2>{discussion.title}</h2>
        <small>
          #{discussion.number} · {discussion.authorLogin ?? "unknown"} · updated{" "}
          {formatRelativeDate(discussion.updatedAt)}
        </small>
        {discussion.category && <span className="state-chip">{discussion.category}</span>}
      </header>
      <div className="workflow-summary">
        <span>{discussion.comments} comments</span>
        <span>{discussion.upvotes} upvotes</span>
        {discussion.isAnswered && <span>Answered</span>}
        {discussion.closed && <span>Closed</span>}
        {discussion.locked && <span>Locked</span>}
        <span>Managed in Control</span>
      </div>
      <div className="timeline-thread">
        <TimelineComment
          authorLogin={discussion.authorLogin}
          authorAvatarUrl={discussion.authorAvatarUrl}
          createdAt={discussion.createdAt}
          body={discussion.body?.trim() || "No discussion body returned."}
          markdownUrlContext={markdownUrlContext}
          onOpenExternal={onOpenExternal}
        />
      </div>
      <DiscussionActions
        disabledReason={disabledReason}
        discussion={discussion}
        onBeginEdit={onBeginEdit}
        onCloseOrReopen={onCloseOrReopen}
        onOpenExternal={onOpenExternal}
      />
      <AddDiscussionCommentForm
        body={commentBody}
        disabledReason={commentDisabledReason}
        selectedDiscussionDisabledReason={disabledReason}
        onBodyChange={onCommentBodyChange}
        onSubmit={onAddComment}
      />
      <DiscussionMutationStatus
        active={detailMutationActive}
        action={submittedDiscussionAction}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        runningMessage={`${githubActionLabel(submittedDiscussionAction)} is running. Discussion data will refresh after GitHub responds.`}
      />
      {acceptedAnswer && (
        <div className="discussion-detail-section">
          <h3>Accepted answer</h3>
          <TimelineComment
            authorLogin={acceptedAnswer.authorLogin}
            authorAvatarUrl={acceptedAnswer.authorAvatarUrl}
            createdAt={acceptedAnswer.createdAt}
            body={acceptedAnswer.body?.trim() || "No answer body returned."}
            markdownUrlContext={markdownUrlContext}
            onOpenExternal={onOpenExternal}
          />
        </div>
      )}
      <DiscussionCommentsSection
        commentsState={commentsState}
        disabledReason={disabledReason}
        discussion={discussion}
        markdownUrlContext={markdownUrlContext}
        onDeleteComment={onDeleteComment}
        onEditComment={onEditComment}
        onLoadMoreReplies={onLoadMoreReplies}
        onOpenExternal={onOpenExternal}
      />
    </>
  );
}

function useDiscussionInteractionState(
  repositoryKey: string,
  focusedDiscussionNumber: number | null,
  firstDiscussionNumber: number | null
) {
  const [filter, setFilter] = useState("");
  const [composingDiscussion, setComposingDiscussion] = useState(false);
  const [editingDiscussion, setEditingDiscussion] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionBody, setDiscussionBody] = useState("");
  const [discussionCategoryId, setDiscussionCategoryId] = useState("");
  const [discussionCommentBody, setDiscussionCommentBody] = useState("");
  const [submittedDiscussionAction, setSubmittedDiscussionAction] = useState<GitHubAction | null>(null);
  const [discussionSelection, setDiscussionSelection] = useState<DiscussionSelection>(() => ({
    repositoryKey,
    discussionNumber: focusedDiscussionNumber ?? firstDiscussionNumber,
    repliesLimit: defaultDiscussionRepliesLimit
  }));

  function beginCreate(selectedCategory: DiscussionCategorySummary | null): void {
    setSubmittedDiscussionAction(null);
    setComposingDiscussion(true);
    setEditingDiscussion(false);
    setDiscussionTitle("");
    setDiscussionBody("");
    setDiscussionCategoryId(selectedCategory?.id ?? "");
  }

  function beginEdit(discussion: DiscussionSummary | DiscussionDetail): void {
    setSubmittedDiscussionAction(null);
    setComposingDiscussion(false);
    setEditingDiscussion(true);
    setDiscussionTitle(discussion.title);
    setDiscussionBody(discussion.body ?? "");
  }

  function resetForms(): void {
    setComposingDiscussion(false);
    setEditingDiscussion(false);
    setDiscussionTitle("");
    setDiscussionBody("");
    setDiscussionCommentBody("");
    setSubmittedDiscussionAction(null);
  }

  function selectDiscussion(discussion: DiscussionSummary): void {
    setComposingDiscussion(false);
    setEditingDiscussion(false);
    setDiscussionSelection({
      repositoryKey,
      discussionNumber: discussion.number,
      repliesLimit: defaultDiscussionRepliesLimit
    });
  }

  function loadMoreReplies(discussionNumber: number): void {
    setDiscussionSelection({
      repositoryKey,
      discussionNumber,
      repliesLimit: expandedDiscussionRepliesLimit
    });
  }

  return {
    composingDiscussion,
    discussionBody,
    discussionCategoryId,
    discussionCommentBody,
    discussionSelection,
    discussionTitle,
    editingDiscussion,
    filter,
    submittedDiscussionAction,
    beginCreate,
    beginEdit,
    loadMoreReplies,
    resetForms,
    selectDiscussion,
    setDiscussionBody,
    setDiscussionCategoryId,
    setDiscussionCommentBody,
    setDiscussionTitle,
    setFilter,
    setSubmittedDiscussionAction
  };
}

function useDiscussionsTabModel({
  repository,
  discussionsLimit,
  focusedDiscussionNumber,
  githubReady,
  onOpenExternal,
  onSelectDiscussion,
  onExpandDiscussions,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onMutate
}: DiscussionsTabProps) {
  const api = useControlApi();
  const { discussions: discussionsQuery } = useDiscussionsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: discussionsLimit,
    enabled: true,
    githubReady
  });
  const discussions = discussionsQuery.data?.items ?? [];
  const availability = discussionsQuery.data?.availability ?? null;
  const loading = discussionsQuery.isLoading || discussionsQuery.isFetching;
  const error = discussionsQuery.error;
  const state = useDiscussionInteractionState(
    repository.nameWithOwner,
    focusedDiscussionNumber,
    discussions[0]?.number ?? null
  );
  const filteredDiscussions = filterDiscussions(discussions, state.filter);
  const fallbackDiscussionNumber = focusedDiscussionNumber ?? discussions[0]?.number ?? null;
  const selectedDiscussionNumber =
    state.discussionSelection.repositoryKey === repository.nameWithOwner
      ? state.discussionSelection.discussionNumber
      : fallbackDiscussionNumber;
  const selectedDiscussionSummary =
    filteredDiscussions.find((discussion) => discussion.number === selectedDiscussionNumber) ??
    filteredDiscussions[0] ??
    null;
  const detailDiscussionNumber = focusedDiscussionNumber ?? selectedDiscussionSummary?.number ?? null;
  const selectedDiscussionKey =
    detailDiscussionNumber !== null
      ? `${repository.nameWithOwner}:discussion:${detailDiscussionNumber}`
      : null;
  const selectedDiscussionRepliesLimit =
    state.discussionSelection.repositoryKey === repository.nameWithOwner &&
    state.discussionSelection.discussionNumber === detailDiscussionNumber
      ? state.discussionSelection.repliesLimit
      : defaultDiscussionRepliesLimit;
  const selectedPreviewComments =
    selectedDiscussionSummary?.previewComments.filter(
      (comment) => comment.id !== selectedDiscussionSummary.answer?.id
    ) ?? [];
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
      detailDiscussionNumber,
      selectedDiscussionRepliesLimit
    ],
    queryFn: () => {
      if (detailDiscussionNumber === null) {
        throw new Error("Discussion detail requires a discussion number.");
      }
      return api.github.getDiscussionDetail({
        owner: repository.owner,
        repo: repository.name,
        discussionNumber: detailDiscussionNumber,
        commentsLimit: 100,
        repliesLimit: selectedDiscussionRepliesLimit,
        cacheOnly: !githubReady
      });
    },
    enabled: detailDiscussionNumber !== null
  });
  const categories = useQuery<DiscussionCategoryListResult>({
    queryKey: ["discussion-categories", repository.owner, repository.name],
    queryFn: () =>
      api.github.listDiscussionCategoriesWithStatus({
        owner: repository.owner,
        repo: repository.name,
        limit: 100,
        cacheOnly: !githubReady
      }),
    enabled: state.composingDiscussion || state.editingDiscussion
  });
  const selectedDiscussionDetail =
    detail.data?.item && detail.data.item.number === detailDiscussionNumber ? detail.data.item : null;
  const selectedDiscussion = selectedDiscussionDetail ?? selectedDiscussionSummary;
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
    categoryOptions.find((category) => category.id === state.discussionCategoryId) ??
    categoryOptions[0] ??
    null;
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
    (!state.discussionTitle.trim() ? "Discussion title is required." : null) ??
    (!state.discussionBody.trim() ? "Discussion body is required." : null);
  const editDiscussionDisabledReason =
    selectedDiscussionDisabledReason ??
    (!state.discussionTitle.trim() ? "Discussion title is required." : null) ??
    (!state.discussionBody.trim() ? "Discussion body is required." : null) ??
    (selectedDiscussion &&
    state.discussionTitle === selectedDiscussion.title &&
    state.discussionBody === (selectedDiscussionDetail?.body ?? selectedDiscussion.body ?? "")
      ? "No discussion changes to save."
      : null);
  const discussionCommentDisabledReason =
    selectedDiscussionDisabledReason ??
    (!state.discussionCommentBody.trim() ? "Comment body is required." : null);

  function submitDiscussionMutation(
    action: GitHubAction,
    dangerous: boolean,
    payload?: GitHubMutationFields
  ): void {
    state.setSubmittedDiscussionAction(action);
    onMutate(action, dangerous, payload);
  }

  function openDiscussionsFallback(): void {
    onOpenExternal(repositoryPath(repository, "/discussions"));
  }

  function beginDiscussionCreate(): void {
    state.beginCreate(selectedCategory);
  }

  function beginDiscussionEdit(): void {
    if (selectedDiscussion) {
      state.beginEdit(selectedDiscussion);
    }
  }

  function selectDiscussion(discussion: DiscussionSummary): void {
    state.selectDiscussion(discussion);
    onSelectDiscussion(discussion);
  }

  function submitDiscussionForm({ title, body, categoryId }: DiscussionFormSubmitInput): void {
    if (state.composingDiscussion) {
      if (!categoryId) {
        return;
      }
      submitDiscussionMutation("createDiscussion", false, { categoryId, title, body });
      return;
    }

    if (selectedDiscussion) {
      submitDiscussionMutation("editDiscussion", false, {
        discussionId: selectedDiscussion.id,
        title,
        body
      });
    }
  }

  function closeOrReopenDiscussion(discussion: DiscussionSummary | DiscussionDetail): void {
    submitDiscussionMutation(discussion.closed ? "reopenDiscussion" : "closeDiscussion", !discussion.closed, {
      discussionId: discussion.id
    });
  }

  function addDiscussionComment(): void {
    if (!selectedDiscussion) {
      return;
    }
    submitDiscussionMutation("addDiscussionComment", false, {
      discussionId: selectedDiscussion.id,
      body: state.discussionCommentBody
    });
    state.setDiscussionCommentBody("");
  }

  function editDiscussionComment(comment: TimelineCommentSummary, body: string): void {
    submitDiscussionMutation("editDiscussionComment", false, { commentId: comment.id, body });
  }

  function deleteDiscussionComment(comment: TimelineCommentSummary): void {
    submitDiscussionMutation("deleteDiscussionComment", true, { commentId: comment.id });
  }

  function loadMoreReplies(): void {
    if (selectedDiscussion) {
      state.loadMoreReplies(selectedDiscussion.number);
    }
  }

  return {
    acceptedAnswer,
    availabilityMessage,
    beginDiscussionCreate,
    beginDiscussionEdit,
    canExpandDiscussions,
    categoryOptions,
    closeOrReopenDiscussion,
    commentsState: {
      detailAvailabilityMessage,
      detailDiscussionNumber,
      detailError: detail.error,
      detailLoading: detail.isLoading,
      detailReturnedEmpty: Boolean(detail.data && !detail.data.item),
      canLoadMoreReplies,
      selectedComments,
      selectedCommentsArePreview,
      selectedDiscussionRepliesLimit
    } satisfies DiscussionCommentsState,
    createDiscussionDisabledReason,
    deleteDiscussionComment,
    disabledFeatureMessage,
    discussionCommentDisabledReason,
    discussionMarkdownUrlContext,
    discussionMutationAction,
    discussionMutationDisabledReason,
    discussions,
    discussionsLimitHit,
    editDiscussionComment,
    editDiscussionDisabledReason,
    error,
    filteredDiscussions,
    loading,
    mutationError,
    mutationPending,
    mutationSucceeded,
    onExpandDiscussions,
    onOpenExternal,
    openDiscussionsFallback,
    resetDiscussionForms: state.resetForms,
    selectDiscussion,
    selectedCategory,
    selectedDiscussion,
    selectedDiscussionDisabledReason,
    setDiscussionBody: state.setDiscussionBody,
    setDiscussionCategoryId: state.setDiscussionCategoryId,
    setDiscussionCommentBody: state.setDiscussionCommentBody,
    setDiscussionTitle: state.setDiscussionTitle,
    setFilter: state.setFilter,
    state,
    submitDiscussionForm,
    submittedDiscussionAction: state.submittedDiscussionAction,
    addDiscussionComment,
    loadMoreReplies,
    categoriesAvailabilityMessage,
    categoriesError: categories.error instanceof Error ? categories.error : null,
    categoriesLoading: categories.isLoading
  };
}

export function DiscussionsTab(props: DiscussionsTabProps): JSX.Element {
  const model = useDiscussionsTabModel(props);
  const formMode: DiscussionFormMode | null = model.state.composingDiscussion
    ? "create"
    : model.state.editingDiscussion
      ? "edit"
      : null;
  const formSubmitDisabledReason =
    formMode === "create" ? model.createDiscussionDisabledReason : model.editDiscussionDisabledReason;

  return (
    <section className="table-panel github-surface">
      <DiscussionsToolbar
        disabledReason={model.discussionMutationDisabledReason}
        filter={model.state.filter}
        onCreateDiscussion={model.beginDiscussionCreate}
        onFilterChange={model.setFilter}
        onOpenFallback={model.openDiscussionsFallback}
      />
      <div className="github-split">
        <DiscussionList
          availabilityMessage={model.availabilityMessage}
          canExpandDiscussions={model.canExpandDiscussions}
          disabledFeatureMessage={model.disabledFeatureMessage}
          discussions={model.discussions}
          discussionsLimitHit={model.discussionsLimitHit}
          error={model.error}
          filter={model.state.filter}
          filteredDiscussions={model.filteredDiscussions}
          loading={model.loading}
          selectedDiscussion={model.selectedDiscussion}
          onExpandDiscussions={model.onExpandDiscussions}
          onOpenExternal={model.onOpenExternal}
          onSelectDiscussion={model.selectDiscussion}
        />
        <div className="thread-detail">
          {formMode ? (
            <DiscussionForm
              body={model.state.discussionBody}
              categoriesAvailabilityMessage={model.categoriesAvailabilityMessage}
              categoriesError={model.categoriesError}
              categoriesLoading={model.categoriesLoading}
              categoryOptions={model.categoryOptions}
              disabledReason={model.discussionMutationDisabledReason}
              mode={formMode}
              mutationAction={model.discussionMutationAction}
              mutationError={model.mutationError}
              mutationPending={model.mutationPending}
              mutationSucceeded={model.mutationSucceeded}
              selectedCategory={model.selectedCategory}
              submitDisabledReason={formSubmitDisabledReason}
              submittedDiscussionAction={model.submittedDiscussionAction}
              title={model.state.discussionTitle}
              onBodyChange={model.setDiscussionBody}
              onCancel={model.resetDiscussionForms}
              onCategoryChange={model.setDiscussionCategoryId}
              onSubmit={model.submitDiscussionForm}
              onTitleChange={model.setDiscussionTitle}
            />
          ) : model.selectedDiscussion ? (
            <DiscussionDetail
              acceptedAnswer={model.acceptedAnswer}
              commentBody={model.state.discussionCommentBody}
              commentsState={model.commentsState}
              disabledReason={model.selectedDiscussionDisabledReason}
              discussion={model.selectedDiscussion}
              markdownUrlContext={model.discussionMarkdownUrlContext}
              mutationAction={model.discussionMutationAction}
              mutationError={model.mutationError}
              mutationPending={model.mutationPending}
              mutationSucceeded={model.mutationSucceeded}
              submittedDiscussionAction={model.submittedDiscussionAction}
              onAddComment={model.addDiscussionComment}
              onBeginEdit={model.beginDiscussionEdit}
              onCloseOrReopen={model.closeOrReopenDiscussion}
              onCommentBodyChange={model.setDiscussionCommentBody}
              onDeleteComment={model.deleteDiscussionComment}
              onEditComment={model.editDiscussionComment}
              onLoadMoreReplies={model.loadMoreReplies}
              onOpenExternal={model.onOpenExternal}
            />
          ) : (
            <div className="empty-state">
              {model.commentsState.detailLoading && model.commentsState.detailDiscussionNumber !== null
                ? `Loading discussion #${model.commentsState.detailDiscussionNumber}…`
                : "Select a discussion to inspect."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
