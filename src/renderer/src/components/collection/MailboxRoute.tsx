import {
  BellOff,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  GitPullRequest,
  Inbox,
  MessageSquare,
  Search,
  X
} from "lucide-react";
import { useState } from "react";
import type { JSX } from "react";

import type { IssueSummary, NotificationSummary, PullRequestSummary } from "@shared/github";
import { useAccountWork } from "../../hooks/useAccountWork";
import { useMailboxNotifications } from "../../hooks/useMailboxNotifications";
import { formatRelativeDate } from "../../utils/format";
import { readAvailabilityMessage } from "../repository/repositoryUi";
import { matchesCollectionFilter } from "./collectionUi";
import {
  maxMailboxListLimit,
  notificationInAppTarget,
  notificationMetadataParts,
  notificationReasonLabel,
  notificationTargetUrl,
  type MailboxNotificationFilter
} from "./notificationUi";
import {
  issueStateLabel,
  mailboxIssueMetadataParts,
  mailboxPullRequestMetadataParts,
  pullRequestMergeableStateLabel,
  pullRequestReviewDecisionLabel,
  pullRequestReviewDecisionTone
} from "./workItemUi";

export interface MailboxRouteProps {
  title: string;
  appReady: boolean;
  githubReady: boolean;
  viewerLogin: string | null;
  accountWorkLimit: number;
  notificationFilter: MailboxNotificationFilter;
  notificationLimit: number;
  onOpenExternal(url: string): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
  onOpenNotification(notification: NotificationSummary): void;
  onNotificationFilterChange(filter: MailboxNotificationFilter): void;
  onExpandMailboxWork(): void;
  onExpandMailboxNotifications(): void;
}

export function MailboxRoute({
  title,
  appReady,
  githubReady,
  viewerLogin,
  accountWorkLimit,
  notificationFilter,
  notificationLimit,
  onOpenExternal,
  onOpenIssue,
  onOpenPullRequest,
  onOpenNotification,
  onNotificationFilterChange,
  onExpandMailboxWork,
  onExpandMailboxNotifications
}: MailboxRouteProps): JSX.Element {
  const [collectionFilter, setCollectionFilter] = useState("");
  const { issues: accountIssues, pulls: accountPulls } = useAccountWork(viewerLogin, accountWorkLimit, {
    enabled: appReady,
    githubReady
  });
  const accountIssueItems = accountIssues.data?.items ?? [];
  const accountIssuesAvailability = accountIssues.data?.availability ?? null;
  const accountPullItems = accountPulls.data?.items ?? [];
  const accountPullsAvailability = accountPulls.data?.availability ?? null;
  const {
    notifications,
    notificationItems,
    notificationsAvailability,
    markNotificationRead,
    markVisibleNotificationsRead,
    unsubscribeNotification
  } = useMailboxNotifications({
    filter: notificationFilter,
    limit: notificationLimit,
    enabled: appReady,
    githubReady
  });
  const normalizedCollectionFilter = collectionFilter.trim().toLowerCase();
  const workRows = [
    ...accountIssueItems.map((issue) => ({ ...issue, kind: "issue" as const })),
    ...accountPullItems.map((pull) => ({ ...pull, kind: "pull" as const }))
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const workRowsLoading =
    accountIssues.isLoading || accountIssues.isFetching || accountPulls.isLoading || accountPulls.isFetching;
  const workRowErrors = [
    accountIssues.error ? `Issues unavailable: ${accountIssues.error.message}` : null,
    accountPulls.error ? `Pull requests unavailable: ${accountPulls.error.message}` : null
  ].filter((message): message is string => Boolean(message));
  const workAvailabilityMessages = [
    readAvailabilityMessage("Account issues", accountIssuesAvailability),
    readAvailabilityMessage("Account pull requests", accountPullsAvailability)
  ].filter((message): message is string => Boolean(message));
  const filteredNotifications = notificationItems.filter((notification) =>
    matchesCollectionFilter(
      [
        notification.subject.title,
        notification.subject.type,
        notification.reason,
        notification.repositoryNameWithOwner
      ],
      normalizedCollectionFilter
    )
  );
  const filteredWorkRows = workRows.filter((row) =>
    matchesCollectionFilter(
      [row.title, row.repositoryNameWithOwner, row.authorLogin, row.state, row.kind],
      normalizedCollectionFilter
    )
  );
  const notificationsLimitHit = notificationItems.length >= notificationLimit;
  const canExpandMailboxNotifications = notificationsLimitHit && notificationLimit < maxMailboxListLimit;
  const accountWorkLimitHit =
    accountIssueItems.length >= accountWorkLimit || accountPullItems.length >= accountWorkLimit;
  const canExpandMailboxWork = accountWorkLimitHit && accountWorkLimit < maxMailboxListLimit;
  const visibleUnreadNotificationIds = filteredNotifications
    .filter((notification) => notification.unread)
    .map((notification) => notification.id);
  const notificationsAvailabilityMessage = readAvailabilityMessage(
    "Notifications",
    notificationsAvailability
  );
  const notificationBulkMarkReadDisabledReason = markVisibleNotificationsRead.isPending
    ? "Visible notifications are already being marked as read."
    : !githubReady
      ? "Sign in with GitHub to mark notifications as read."
      : visibleUnreadNotificationIds.length === 0
        ? "No visible unread notifications."
        : null;
  const notificationActionError =
    (markNotificationRead.error instanceof Error ? markNotificationRead.error : null) ??
    (markVisibleNotificationsRead.error instanceof Error ? markVisibleNotificationsRead.error : null) ??
    (unsubscribeNotification.error instanceof Error ? unsubscribeNotification.error : null);
  const notificationFilters: Array<{ value: MailboxNotificationFilter; label: string }> = [
    { value: "unread", label: "Unread" },
    { value: "all", label: "All" },
    { value: "participating", label: "Participating" }
  ];

  return (
    <section className="collection-view">
      <header>
        <h2>{title}</h2>
        <div className="collection-actions">
          <div className="notification-filter" role="group" aria-label="Notification filter">
            {notificationFilters.map((filter) => (
              <button
                className={filter.value === notificationFilter ? "selected-action" : ""}
                key={filter.value}
                type="button"
                aria-pressed={filter.value === notificationFilter}
                onClick={() => onNotificationFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={Boolean(notificationBulkMarkReadDisabledReason)}
            title={notificationBulkMarkReadDisabledReason ?? "Mark visible unread notifications as read"}
            onClick={() => markVisibleNotificationsRead.mutate({ threadIds: visibleUnreadNotificationIds })}
          >
            <CheckCircle2 size={16} />{" "}
            {markVisibleNotificationsRead.isPending ? "Marking…" : "Mark visible read"}
          </button>
          <button
            type="button"
            title="Open GitHub notifications"
            onClick={() => onOpenExternal("https://github.com/notifications")}
          >
            <ExternalLink size={16} /> Open GitHub
          </button>
        </div>
      </header>
      <div className="table-panel">
        <div className="table-action-row surface-filter-row">
          <label className="surface-filter">
            <Search size={16} />
            <input
              aria-label="Filter mailbox"
              placeholder="Filter mailbox"
              value={collectionFilter}
              onChange={(event) => setCollectionFilter(event.target.value)}
            />
          </label>
          {collectionFilter.trim() && (
            <button type="button" onClick={() => setCollectionFilter("")}>
              <X size={16} /> Clear
            </button>
          )}
        </div>
        {(notifications.isLoading || notifications.isFetching) && notificationItems.length === 0 && (
          <div className="loading-state">Loading GitHub notifications…</div>
        )}
        {notifications.error instanceof Error && (
          <div className="error-state">
            Could not load GitHub notifications: {notifications.error.message}
          </div>
        )}
        {notificationsAvailabilityMessage && (
          <div className="error-state">{notificationsAvailabilityMessage}</div>
        )}
        {notificationActionError && (
          <div className="error-state">
            Could not update GitHub notification: {notificationActionError.message}
          </div>
        )}
        {filteredNotifications.map((notification) => {
          const metadataParts = notificationMetadataParts(notification);
          const notificationTarget = notificationInAppTarget(notification);
          const notificationExternalUrl = notificationTargetUrl(notification);
          const markReadDisabledReason = !notification.unread
            ? "Notification is already read."
            : !githubReady
              ? "Sign in with GitHub to mark notifications as read."
              : markNotificationRead.isPending && markNotificationRead.variables?.threadId === notification.id
                ? "Notification is already being marked as read."
                : markVisibleNotificationsRead.isPending
                  ? "Visible notifications are being marked as read."
                  : null;
          const unsubscribeDisabledReason = !githubReady
            ? "Sign in with GitHub to unsubscribe from notifications."
            : notification.subscribed === false
              ? "Notification thread is not currently subscribed."
              : unsubscribeNotification.isPending &&
                  unsubscribeNotification.variables?.threadId === notification.id
                ? "Notification thread is already being unsubscribed."
                : null;

          return (
            <div
              className={`issue-row notification-row ${notification.unread ? "unread-row" : ""}`}
              key={notification.id}
            >
              <button
                className="notification-row-main"
                type="button"
                title={
                  notificationTarget
                    ? "Open notification target in Control"
                    : "Open notification target on GitHub"
                }
                onClick={() => onOpenNotification(notification)}
              >
                {notification.unread ? <CircleDot size={17} /> : <Inbox size={17} />}
                <div>
                  <strong>{notification.subject.title}</strong>
                  <small>
                    {notification.repositoryNameWithOwner} · {notification.subject.type} ·{" "}
                    {notificationReasonLabel(notification.reason)} · updated{" "}
                    {formatRelativeDate(notification.updatedAt)}
                  </small>
                  {metadataParts.length > 0 && (
                    <small className="notification-detail-line">{metadataParts.join(" · ")}</small>
                  )}
                </div>
              </button>
              <span className="row-chip-stack">
                <span className={`state-chip ${notification.unread ? "attention" : ""}`}>
                  {notification.unread ? "unread" : "read"}
                </span>
                <span className={`state-chip ${notificationTarget ? "success" : ""}`}>
                  {notificationTarget ? "in-app" : "external"}
                </span>
              </span>
              <span className="row-action-stack">
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label="Open notification target on GitHub"
                  title="Open notification target on GitHub"
                  onClick={() => onOpenExternal(notificationExternalUrl)}
                >
                  <ExternalLink size={15} />
                </button>
                {notification.subject.latestCommentHtmlUrl && (
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label={`Open latest comment for ${notification.subject.title} on GitHub`}
                    title="Open latest comment on GitHub"
                    onClick={() => onOpenExternal(notification.subject.latestCommentHtmlUrl!)}
                  >
                    <MessageSquare size={15} />
                  </button>
                )}
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Mark ${notification.subject.title} as read`}
                  disabled={Boolean(markReadDisabledReason)}
                  title={markReadDisabledReason ?? "Mark notification as read"}
                  onClick={() => markNotificationRead.mutate({ threadId: notification.id })}
                >
                  <CheckCircle2 size={15} />
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Unsubscribe from ${notification.subject.title}`}
                  disabled={Boolean(unsubscribeDisabledReason)}
                  title={unsubscribeDisabledReason ?? "Unsubscribe from this notification thread"}
                  onClick={() => {
                    if (window.confirm("Unsubscribe from this GitHub notification thread?")) {
                      unsubscribeNotification.mutate({ threadId: notification.id });
                    }
                  }}
                >
                  <BellOff size={15} />
                </button>
              </span>
            </div>
          );
        })}
        {canExpandMailboxNotifications && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandMailboxNotifications}>
              Load more notifications
            </button>
          </div>
        )}
        {!canExpandMailboxNotifications && notificationsLimitHit && (
          <div className="muted-row">
            Showing the first {notificationLimit} notifications returned by GitHub.
          </div>
        )}
        {(filteredWorkRows.length > 0 ||
          workRowsLoading ||
          workRowErrors.length > 0 ||
          workAvailabilityMessages.length > 0) && (
          <div className="collection-section-label">Open issues and pull requests</div>
        )}
        {workRowsLoading && workRows.length === 0 && (
          <div className="loading-state">Loading account issues and pull requests…</div>
        )}
        {workRowErrors.map((message) => (
          <div className="error-state" key={message}>
            {message}
          </div>
        ))}
        {workAvailabilityMessages.map((message) => (
          <div className="error-state" key={message}>
            {message}
          </div>
        ))}
        {filteredWorkRows.map((row) => {
          const reviewDecisionLabel =
            row.kind === "pull" ? pullRequestReviewDecisionLabel(row.reviewDecision) : null;
          const reviewDecisionChipTone =
            row.kind === "pull" ? pullRequestReviewDecisionTone(row.reviewDecision) : "";
          const mergeableStateLabel =
            row.kind === "pull" ? pullRequestMergeableStateLabel(row.mergeableState) : null;
          const isCrossRepository =
            row.kind === "pull"
              ? (row.isCrossRepository ??
                Boolean(
                  (row.headRepositoryNameWithOwner &&
                    row.headRepositoryNameWithOwner !== row.repositoryNameWithOwner) ||
                  (row.baseRepositoryNameWithOwner &&
                    row.baseRepositoryNameWithOwner !== row.repositoryNameWithOwner)
                ))
              : false;
          const sourceRepositoryLabel =
            row.kind === "pull" && row.headRepositoryNameWithOwner
              ? `fork: ${row.headRepositoryNameWithOwner}`
              : "fork";
          const metadataParts =
            row.kind === "pull" ? mailboxPullRequestMetadataParts(row) : mailboxIssueMetadataParts(row);

          return (
            <div className="issue-row mailbox-work-row" key={`${row.kind}-${row.id}`}>
              <button
                className="mailbox-work-row-main"
                type="button"
                onClick={() => (row.kind === "pull" ? onOpenPullRequest(row) : onOpenIssue(row))}
              >
                {row.kind === "pull" ? <GitPullRequest size={17} /> : <CircleDot size={17} />}
                <div>
                  <strong>{row.title}</strong>
                  <small>
                    {row.repositoryNameWithOwner ?? "GitHub"} #{row.number} · updated{" "}
                    {formatRelativeDate(row.updatedAt)}
                  </small>
                  <small className="notification-detail-line">{metadataParts.join(" · ")}</small>
                </div>
              </button>
              <span className="row-chip-stack">
                <span className={`state-chip ${row.state === "open" ? "success" : "attention"}`}>
                  {row.kind === "issue" ? issueStateLabel(row) : row.state}
                </span>
                {row.kind === "pull" && row.isDraft && <span className="state-chip attention">draft</span>}
                {row.kind === "pull" && mergeableStateLabel && row.mergeableState !== "clean" && (
                  <span className="state-chip attention">{mergeableStateLabel}</span>
                )}
                {reviewDecisionLabel && (
                  <span className={`state-chip ${reviewDecisionChipTone}`}>{reviewDecisionLabel}</span>
                )}
                {isCrossRepository && (
                  <span className="state-chip attention" title={sourceRepositoryLabel}>
                    fork
                  </span>
                )}
                {row.locked && <span className="state-chip attention">locked</span>}
                <span className="state-chip success">in-app</span>
              </span>
              <span className="row-action-stack">
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Open ${row.title} on GitHub`}
                  title={`Open ${row.kind === "pull" ? "pull request" : "issue"} on GitHub`}
                  onClick={() => onOpenExternal(row.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </span>
            </div>
          );
        })}
        {canExpandMailboxWork && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandMailboxWork}>
              Load more account work
            </button>
          </div>
        )}
        {!canExpandMailboxWork && accountWorkLimitHit && (
          <div className="muted-row">
            Showing the first {accountWorkLimit} issues and pull requests returned by GitHub.
          </div>
        )}
        {!notifications.isLoading &&
          !(notifications.error instanceof Error) &&
          !workRowsLoading &&
          workRowErrors.length === 0 &&
          filteredNotifications.length === 0 &&
          filteredWorkRows.length === 0 && (
            <div className="empty-state">
              {notificationItems.length === 0 && workRows.length === 0
                ? "No GitHub notifications or open account work."
                : "No mailbox items match this filter."}
            </div>
          )}
      </div>
    </section>
  );
}
