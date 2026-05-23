import { CircleDot, ExternalLink, GitPullRequest } from "lucide-react";
import type { JSX } from "react";

import type {
  AppState,
  GitHubAccountProfile,
  GitHubReadAvailability,
  IssueSummary,
  PullRequestSummary,
  RepositorySummary
} from "@shared/github";

import {
  issueStateLabel,
  mailboxIssueMetadataParts,
  mailboxPullRequestMetadataParts,
  pullRequestMergeableStateLabel,
  pullRequestReviewDecisionLabel,
  pullRequestReviewDecisionTone
} from "../collection/workItemUi";
import {
  displayRepositoryName,
  displayRepositoryShortcutName,
  maxRepositoryListLimit,
  repositoryShortcutChips,
  repositoryShortcutMetadataParts,
  repositoryShortcutsFromPins,
  sortRepositoriesByActivity
} from "../repository/repositorySearch";
import { readAvailabilityMessage, repositoryCollectionMetadataParts } from "../repository/repositoryUi";
import { Metric } from "../shared/Metric";
import { formatRelativeDate } from "../../utils/format";

export function HomeDashboard({
  appState,
  profile,
  profileAvailabilityMessage,
  repositories,
  repositoryActivityLimit,
  repositoriesLoading,
  repositoriesError,
  repositoriesAvailabilityMessage,
  pinnedRepositoryNames,
  issues,
  issuesLoading,
  issuesError,
  issuesAvailability,
  pulls,
  pullsLoading,
  pullsError,
  pullsAvailability,
  workLimit,
  maxWorkLimit,
  onOpenRepository,
  onLoadMoreRepositories,
  onLoadMoreWork,
  onOpenMailbox,
  onOpenIssue,
  onOpenPullRequest,
  onOpenExternal
}: {
  appState?: AppState;
  profile?: GitHubAccountProfile;
  profileAvailabilityMessage: string | null;
  repositories: RepositorySummary[];
  repositoryActivityLimit: number;
  repositoriesLoading: boolean;
  repositoriesError: Error | null;
  repositoriesAvailabilityMessage: string | null;
  pinnedRepositoryNames: string[];
  issues: IssueSummary[];
  issuesLoading: boolean;
  issuesError: Error | null;
  issuesAvailability: GitHubReadAvailability | null;
  pulls: PullRequestSummary[];
  pullsLoading: boolean;
  pullsError: Error | null;
  pullsAvailability: GitHubReadAvailability | null;
  workLimit: number;
  maxWorkLimit: number;
  onOpenRepository(nameWithOwner: string): void;
  onLoadMoreRepositories(): void;
  onLoadMoreWork(): void;
  onOpenMailbox(): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const login = profile?.login ?? appState?.viewer?.login ?? "github";
  const viewerLoading = Boolean(appState?.github.authenticated && !appState.viewer && !profile);
  const displayName = viewerLoading
    ? "Loading GitHub profile"
    : (profile?.name ?? appState?.viewer?.name ?? login);
  const sortedRepositories = sortRepositoriesByActivity(repositories);
  const visibleRepositoryLimit = Math.min(
    repositoryActivityLimit,
    sortedRepositories.length,
    maxRepositoryListLimit
  );
  const latestRepositories = sortedRepositories.slice(0, visibleRepositoryLimit);
  const canLoadMoreRepositories =
    sortedRepositories.length > latestRepositories.length && repositoryActivityLimit < maxRepositoryListLimit;
  const repositoriesAtLoadedLimit =
    !canLoadMoreRepositories &&
    sortedRepositories.length > 0 &&
    latestRepositories.length >= Math.min(sortedRepositories.length, maxRepositoryListLimit);
  const pinnedRepositoryNameSet = new Set(pinnedRepositoryNames.map((name) => name.toLowerCase()));
  const pinnedRepositories = repositoryShortcutsFromPins(pinnedRepositoryNames, repositories);
  const workItems = [
    ...issues.map((issue) => ({ ...issue, kind: "issue" as const })),
    ...pulls.map((pull) => ({ ...pull, kind: "pull" as const }))
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, workLimit);
  const workLoading = issuesLoading || pullsLoading;
  const workErrors = [
    issuesError ? `Issues unavailable: ${issuesError.message}` : null,
    pullsError ? `Pull requests unavailable: ${pullsError.message}` : null
  ].filter((message): message is string => Boolean(message));
  const workAvailabilityMessages = [
    readAvailabilityMessage("Account issues", issuesAvailability),
    readAvailabilityMessage("Account pull requests", pullsAvailability)
  ].filter((message): message is string => Boolean(message));
  const workRowsAvailable = issues.length + pulls.length;
  const canLoadMoreWork = workRowsAvailable > workLimit && workLimit < maxWorkLimit;
  const workAtHomeMaxLimit =
    workLimit >= maxWorkLimit &&
    (workRowsAvailable > maxWorkLimit || issues.length >= maxWorkLimit || pulls.length >= maxWorkLimit);

  return (
    <section className="home-dashboard">
      <header className="account-hero">
        {(profile?.avatarUrl ?? appState?.viewer?.avatarUrl) ? (
          <img src={profile?.avatarUrl ?? appState?.viewer?.avatarUrl ?? ""} alt="" />
        ) : (
          <span className={`avatar-placeholder ${viewerLoading ? "loading-avatar" : ""}`}>
            {login.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1>{displayName}</h1>
          <p>@{login}</p>
          {profile?.bio && <small>{profile.bio}</small>}
          {profileAvailabilityMessage && <small className="error-state">{profileAvailabilityMessage}</small>}
        </div>
        <div className="surface-header-actions">
          <button
            type="button"
            onClick={() =>
              onOpenExternal(profile?.htmlUrl ?? appState?.viewer?.htmlUrl ?? "https://github.com")
            }
          >
            <ExternalLink size={16} /> Open profile
          </button>
        </div>
      </header>

      <section className="home-metrics">
        <Metric label="Repositories" value={profile?.repositoryCount ?? repositories.length} />
        <Metric label="Starred" value={profile?.starredRepositoryCount ?? 0} />
        <Metric label="Open issues" value={issues.length} />
        <Metric label="Open PRs" value={pulls.length} />
      </section>

      <section className="home-grid">
        {pinnedRepositories.length > 0 && (
          <article className="home-panel">
            <header>
              <h2>Pinned repositories</h2>
            </header>
            <div className="home-repo-grid">
              {pinnedRepositories.map((repository) => {
                const metadataParts = repositoryShortcutMetadataParts(repository);
                const chips = repositoryShortcutChips(repository);

                return (
                  <button
                    key={repository.id}
                    type="button"
                    onClick={() => onOpenRepository(repository.nameWithOwner)}
                  >
                    <strong>{displayRepositoryShortcutName(repository, login)}</strong>
                    <small>{repository.description ?? "Pinned locally in Control"}</small>
                    {metadataParts.length > 0 && <span>{metadataParts.join(" · ")}</span>}
                    <span className="home-repo-card-chips">
                      {chips.map((chip) => (
                        <span key={chip} className={`state-chip ${chip === "pinned" ? "success" : ""}`}>
                          {chip}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        )}

        <article className="home-panel">
          <header>
            <h2>Latest repository activity</h2>
          </header>
          <div className="home-repo-grid">
            {repositoriesLoading && latestRepositories.length === 0 && (
              <div className="loading-state">Loading repositories…</div>
            )}
            {repositoriesError && (
              <div className="error-state">Repositories unavailable: {repositoriesError.message}</div>
            )}
            {repositoriesAvailabilityMessage && (
              <div className="error-state">{repositoriesAvailabilityMessage}</div>
            )}
            {latestRepositories.map((repository) => {
              const pinned = pinnedRepositoryNameSet.has(repository.nameWithOwner.toLowerCase());
              const metadataParts = repositoryCollectionMetadataParts(repository);

              return (
                <button
                  key={repository.id}
                  type="button"
                  onClick={() => onOpenRepository(repository.nameWithOwner)}
                >
                  <strong>{displayRepositoryName(repository, login)}</strong>
                  <small>{repository.description ?? "Repository"}</small>
                  {metadataParts.length > 0 && <span>{metadataParts.join(" · ")}</span>}
                  <span className="home-repo-card-chips">
                    <span className="state-chip">{repository.visibility.toLowerCase()}</span>
                    {repository.isFork && <span className="state-chip attention">fork</span>}
                    {pinned && <span className="state-chip success">pinned</span>}
                  </span>
                </button>
              );
            })}
            {!repositoriesLoading &&
              !repositoriesError &&
              !repositoriesAvailabilityMessage &&
              latestRepositories.length === 0 && <div className="empty-state">No repositories loaded.</div>}
            {canLoadMoreRepositories && (
              <div className="table-action-row">
                <button type="button" onClick={onLoadMoreRepositories}>
                  Load more repositories
                </button>
              </div>
            )}
            {repositoriesAtLoadedLimit && (
              <div className="muted-row">
                Showing {latestRepositories.length} loaded repositories for Home.
              </div>
            )}
          </div>
        </article>

        <article className="home-panel">
          <header>
            <h2>Your work</h2>
          </header>
          <div className="table-panel compact-table">
            {workLoading && workItems.length === 0 && (
              <div className="loading-state">Loading assigned issues and pull requests…</div>
            )}
            {workErrors.map((message) => (
              <div className="error-state" key={message}>
                {message}
              </div>
            ))}
            {workAvailabilityMessages.map((message) => (
              <div className="error-state" key={message}>
                {message}
              </div>
            ))}
            {workItems.map((item) => {
              const reviewDecisionLabel =
                item.kind === "pull" ? pullRequestReviewDecisionLabel(item.reviewDecision) : null;
              const reviewDecisionChipTone =
                item.kind === "pull" ? pullRequestReviewDecisionTone(item.reviewDecision) : "";
              const mergeableStateLabel =
                item.kind === "pull" ? pullRequestMergeableStateLabel(item.mergeableState) : null;
              const isCrossRepository =
                item.kind === "pull"
                  ? (item.isCrossRepository ??
                    Boolean(
                      (item.headRepositoryNameWithOwner &&
                        item.headRepositoryNameWithOwner !== item.repositoryNameWithOwner) ||
                      (item.baseRepositoryNameWithOwner &&
                        item.baseRepositoryNameWithOwner !== item.repositoryNameWithOwner)
                    ))
                  : false;
              const sourceRepositoryLabel =
                item.kind === "pull" && item.headRepositoryNameWithOwner
                  ? `fork: ${item.headRepositoryNameWithOwner}`
                  : "fork";
              const metadataParts =
                item.kind === "pull"
                  ? mailboxPullRequestMetadataParts(item)
                  : mailboxIssueMetadataParts(item);

              return (
                <div
                  key={`${item.repositoryNameWithOwner ?? "item"}-${item.kind}-${item.number}`}
                  className="issue-row mailbox-work-row"
                >
                  <button
                    className="mailbox-work-row-main"
                    type="button"
                    onClick={() => (item.kind === "pull" ? onOpenPullRequest(item) : onOpenIssue(item))}
                  >
                    {item.kind === "pull" ? <GitPullRequest size={17} /> : <CircleDot size={17} />}
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {item.repositoryNameWithOwner ?? "GitHub"} #{item.number} · updated{" "}
                        {formatRelativeDate(item.updatedAt)}
                      </small>
                      <small className="notification-detail-line">{metadataParts.join(" · ")}</small>
                    </div>
                  </button>
                  <span className="row-chip-stack">
                    <span className={`state-chip ${item.state === "open" ? "success" : "attention"}`}>
                      {item.kind === "issue" ? issueStateLabel(item) : item.state}
                    </span>
                    {item.kind === "pull" && item.isDraft && (
                      <span className="state-chip attention">draft</span>
                    )}
                    {item.kind === "pull" && mergeableStateLabel && item.mergeableState !== "clean" && (
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
                    {item.locked && <span className="state-chip attention">locked</span>}
                  </span>
                  <span className="row-action-stack">
                    <button
                      className="pin-row-button"
                      type="button"
                      aria-label={`Open GitHub fallback for ${item.title}`}
                      title={`Open GitHub fallback for ${item.kind === "pull" ? "pull request" : "issue"}`}
                      onClick={() => onOpenExternal(item.htmlUrl)}
                    >
                      <ExternalLink size={15} />
                    </button>
                  </span>
                </div>
              );
            })}
            {!workLoading &&
              workErrors.length === 0 &&
              workAvailabilityMessages.length === 0 &&
              workItems.length === 0 && (
                <div className="empty-state">No open assigned issues or pull requests.</div>
              )}
            {canLoadMoreWork && (
              <div className="table-action-row">
                <button type="button" onClick={onLoadMoreWork}>
                  Load more work
                </button>
              </div>
            )}
            {!canLoadMoreWork && workAtHomeMaxLimit && (
              <div className="muted-row">
                Showing the first {maxWorkLimit} issues and pull requests returned for Home. More may be
                available in{" "}
                <button type="button" className="link-button" onClick={onOpenMailbox}>
                  Mailbox
                </button>
                .
              </div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
