import { useState, type ChangeEvent, type JSX } from "react";

import { MarkdownBody, type MarkdownUrlContext } from "@renderer/components/MarkdownBody";

import { formatRelativeDate } from "@renderer/utils/format";

export interface TimelineCommentProps {
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  body: string;
  disabledReason?: string | null;
  markdownUrlContext?: MarkdownUrlContext;
  onOpenExternal(url: string): void;
  onEdit?(body: string): void;
  onDelete?(): void;
}

export function TimelineComment({
  authorLogin,
  authorAvatarUrl,
  createdAt,
  body,
  disabledReason,
  markdownUrlContext,
  onOpenExternal,
  onEdit,
  onDelete
}: TimelineCommentProps): JSX.Element {
  const [editBody, setEditBody] = useState<string | null>(null);
  const editing = editBody !== null;
  const currentEditBody = editBody ?? "";
  const hasActions = Boolean(onEdit || onDelete);
  const editSubmitDisabledReason =
    disabledReason ?? (!currentEditBody.trim() ? "Comment body is required." : null);

  function startEditing(): void {
    setEditBody(body);
  }

  function cancelEditing(): void {
    setEditBody(null);
  }

  function updateEditBody(event: ChangeEvent<HTMLTextAreaElement>): void {
    setEditBody(event.target.value);
  }

  function submitEdit(): void {
    if (editSubmitDisabledReason) {
      return;
    }
    onEdit?.(currentEditBody.trim());
  }

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
                  onClick={startEditing}
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
          <div className="timeline-edit-form">
            <textarea
              value={currentEditBody}
              disabled={Boolean(disabledReason)}
              title={disabledReason ?? undefined}
              onChange={updateEditBody}
              placeholder="Edit comment body"
            />
            <div>
              <button
                className="dark-action"
                type="button"
                disabled={Boolean(editSubmitDisabledReason)}
                title={editSubmitDisabledReason ?? undefined}
                onClick={submitEdit}
              >
                Save comment
              </button>
              <button type="button" onClick={cancelEditing}>
                Cancel
              </button>
              {editSubmitDisabledReason && (
                <small className="action-disabled-note">{editSubmitDisabledReason}</small>
              )}
            </div>
          </div>
        ) : (
          <MarkdownBody markdown={body} onOpenExternal={onOpenExternal} urlContext={markdownUrlContext} />
        )}
      </div>
    </article>
  );
}
