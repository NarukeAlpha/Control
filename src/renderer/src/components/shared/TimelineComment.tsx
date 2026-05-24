import { useState, type JSX } from "react";

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
