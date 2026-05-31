import { ChevronDown, ExternalLink, Eye, GitFork, Lock, Pin, RefreshCw, Star } from "lucide-react";
import type { JSX, ReactNode } from "react";

import type {
  ContributorSummary,
  DiscussionSummary,
  GitHubAction,
  GitHubMutationFields,
  IssueSummary,
  ProjectSummary,
  PullRequestCommitSummary,
  PullRequestLinkedIssueSummary,
  PullRequestReviewSummary,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  ReleaseSummary,
  ReleaseAssetSummary,
  RepoEntry,
  RepositoryCollaboratorSummary,
  RepositoryDetail,
  RepositoryTabPreferenceKey,
  RepositoryRef,
  TeamSummary,
  WorkflowRunArtifactSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import type { LocalRecentSecurityItemKind } from "@shared/local";
import { useUiStore, type RepositoryTab } from "../../stores/uiStore";
import { formatCompactNumber } from "../../utils/format";
import { ActionsTab } from "./actions/ActionsTab";
import { AgentsTab } from "./agents/AgentsTab";
import { CodeTab } from "./code/CodeTab";
import { ContributorsTab } from "./contributors/ContributorsTab";
import { DiscussionsTab } from "./discussions/DiscussionsTab";
import { IssuesTab } from "./issues/IssuesTab";
import { ProjectsTab } from "./projects/ProjectsTab";
import { PullRequestsTab } from "./pull-requests/PullRequestsTab";
import { ReleasesTab } from "./releases/ReleasesTab";
import { SecurityQualityTab } from "./security/SecurityQualityTab";
import { RepositorySettingsTab } from "./settings/RepositorySettingsTab";
import { WikiTab } from "./wiki/WikiTab";
import type { RepositoryTabDescriptor } from "./repositoryTabs";
import { isRepositoryTabPreferenceKey, type RepositoryTabVisibilityResult } from "./repositoryTabVisibility";
import { getRepositoryCounts, githubActionLabel } from "./repositoryUi";

type PullRequestLinkedIssue =
  | NonNullable<PullRequestTimelineEventSummary["sourceIssue"]>
  | PullRequestLinkedIssueSummary;

interface SecurityItemRecentInput {
  kind: LocalRecentSecurityItemKind;
  id: string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  state?: string | null;
  severity?: string | null;
  path?: string | null;
  rule?: string | null;
  packageName?: string | null;
  ghsaId?: string | null;
  cveId?: string | null;
  updatedAt?: string | null;
}

interface RepositoryPageLimits {
  refListLimit: number;
  codeCommitHistoryLimit: number;
  issueListLimit: number;
  repositoryAccessLimit: number;
  forksLimit: number;
  pullRequestListLimit: number;
  discussionsLimit: number;
  actionsLimit: number;
  workflowDefinitionLimit: number;
  projectsLimit: number;
  dependabotAlertsLimit: number;
  codeScanningAlertsLimit: number;
  secretScanningAlertsLimit: number;
  repositoryRulesetsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  releasesLimit: number;
  contributorLimit: number;
}

interface RepositoryPageExpansionHandlers {
  onExpandRefs(): void;
  onExpandIssues(): void;
  onExpandPullRequests(): void;
  onExpandContributors(): void;
  onExpandForks(): void;
  onExpandRepositoryAccess(): void;
  onExpandActions(): void;
  onExpandWorkflowDefinitions(): void;
  onExpandProjects(): void;
  onExpandReleases(): void;
  onExpandDiscussions(): void;
  onExpandDependabotAlerts(): void;
  onExpandCodeScanningAlerts(): void;
  onExpandSecretScanningAlerts(): void;
  onExpandRepositoryRulesets(): void;
  onExpandRepositorySecurityAdvisories(): void;
}

interface RepositoryPageMutationState {
  action: GitHubAction | null;
  pending: boolean;
  succeeded: boolean;
  error: Error | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}

function getViewerRepositoryState(repository: RepositoryDetail): {
  isStarred: boolean;
  isWatching: boolean;
  permission: string | null;
  canSubscribe: boolean | null;
} {
  const viewerState = repository.viewerState;
  const subscription = viewerState.subscription;
  const permission = viewerState.permission ?? repository.permissions.viewerPermission;

  return {
    isStarred: viewerState.hasStarred,
    isWatching: subscription === "SUBSCRIBED",
    permission,
    canSubscribe: viewerState.canSubscribe
  };
}

function repositoryHeroMutationDisabledReason(
  repository: RepositoryDetail,
  viewerState: ReturnType<typeof getViewerRepositoryState>,
  action: "star" | "watch" | "fork",
  mutationPending: boolean
): string | null {
  if (mutationPending) {
    return "Another GitHub action is still running.";
  }
  if (repository.permissions.isDisabled) {
    return "Repository is disabled.";
  }
  if (action === "fork") {
    if (repository.permissions.isArchived) {
      return "Repository is archived.";
    }
    if (repository.administration.allowForking === false) {
      return "Forking is disabled for this repository.";
    }
  }
  if (action === "watch" && viewerState.canSubscribe === false) {
    return "This token cannot update repository watch state.";
  }
  return null;
}

function getRepositoryRefLabel(ref: RepositoryRef | null | undefined): string | null {
  if (!ref) {
    return null;
  }

  if (ref.nameWithOwner) {
    return ref.nameWithOwner;
  }

  if (ref.owner && ref.name) {
    return `${ref.owner}/${ref.name}`;
  }

  return ref.name ?? null;
}

function getRepositoryRefNameWithOwner(ref: RepositoryRef | null | undefined): string | null {
  if (!ref) {
    return null;
  }

  if (ref.nameWithOwner) {
    return ref.nameWithOwner;
  }

  if (ref.owner && ref.name) {
    return `${ref.owner}/${ref.name}`;
  }

  return null;
}

function getRepositoryRefUrl(ref: RepositoryRef | null | undefined): string | null {
  const label = getRepositoryRefLabel(ref);
  return ref?.htmlUrl ?? (label?.includes("/") ? `https://github.com/${label}` : null);
}

function getForkMetadata(repository: RepositoryDetail): {
  parentLabel: string | null;
  parentNameWithOwner: string | null;
  parentUrl: string | null;
  parentForkCount: number | null;
  parentVisibility: string | null;
  parentViewerPermission: string | null;
  sourceLabel: string | null;
  sourceNameWithOwner: string | null;
  sourceUrl: string | null;
  sourceForkCount: number | null;
  sourceVisibility: string | null;
  sourceViewerPermission: string | null;
} {
  const parent = repository.parent;
  const source = repository.source;

  return {
    parentLabel: getRepositoryRefLabel(parent),
    parentNameWithOwner: getRepositoryRefNameWithOwner(parent),
    parentUrl: getRepositoryRefUrl(parent),
    parentForkCount: parent?.forkCount ?? null,
    parentVisibility: parent?.visibility ?? null,
    parentViewerPermission: parent?.viewerPermission ?? null,
    sourceLabel: getRepositoryRefLabel(source),
    sourceNameWithOwner: getRepositoryRefNameWithOwner(source),
    sourceUrl: getRepositoryRefUrl(source),
    sourceForkCount: source?.forkCount ?? null,
    sourceVisibility: source?.visibility ?? null,
    sourceViewerPermission: source?.viewerPermission ?? null
  };
}

export function RepositoryPage({
  repository,
  availabilityMessage,
  githubReady,
  selectedRef,
  limits,
  contributorCount,
  loading,
  pinned,
  pinBusy,
  pinError,
  error,
  tabVisibility,
  onOpenCodeBrowser,
  onOpenReleaseTarget,
  onOpenPullRequestCommit,
  onOpenPullRequestReviewCommit,
  onOpenPullRequestTimelineEventCommit,
  onOpenWorkflowRunCommit,
  onOpenWorkflowCheckSuiteCommit,
  onOpenCodePath,
  onOpenExternal,
  onOpenRepository,
  onOpenTeam,
  onRefresh,
  onOpenFileFinder,
  onSelectTab,
  onShowHiddenTab,
  onOpenFilteredSurface,
  onSelectIssue,
  onSelectPullRequest,
  onOpenIssueReference,
  onSelectDiscussion,
  onSelectProject,
  onSelectRelease,
  onSelectReleaseAsset,
  onSelectWorkflowRun,
  onSelectWorkflowArtifact,
  onSelectSecurityItem,
  onSelectWikiPage,
  onOpenWorkflowRun,
  onSelectContributor,
  onSelectSecurityQualityBranch,
  onSelectRef,
  onSelectSettingsCollaborator,
  expansion,
  onTogglePin,
  mutation,
  rightRail
}: {
  repository?: RepositoryDetail;
  availabilityMessage: string | null;
  githubReady: boolean;
  selectedRef: string | null;
  limits: RepositoryPageLimits;
  contributorCount: number;
  loading: boolean;
  pinned: boolean;
  pinBusy: boolean;
  pinError: Error | null;
  error: Error | null;
  tabVisibility: RepositoryTabVisibilityResult;
  onOpenCodeBrowser(entry: RepoEntry): void;
  onOpenReleaseTarget(ref: string): void;
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
  onOpenWorkflowRunCommit(
    run: WorkflowRunSummary | WorkflowRunDetail,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenWorkflowCheckSuiteCommit(
    suite: WorkflowRunCheckSuiteSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenCodePath(
    path: string,
    entryType: "file" | "dir",
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onOpenTeam(team: TeamSummary): void;
  onRefresh(): Promise<void> | void;
  onOpenFileFinder(): void;
  onSelectTab(tab: RepositoryTab): void;
  onShowHiddenTab(tab: RepositoryTabPreferenceKey): void;
  onOpenFilteredSurface(tab: "issues" | "pulls" | "actions", filter: string): void;
  onSelectIssue(issue: IssueSummary): void;
  onSelectPullRequest(pullRequest: PullRequestSummary): void;
  onOpenIssueReference(issue: PullRequestLinkedIssue): void;
  onSelectDiscussion(discussion: DiscussionSummary): void;
  onSelectProject(project: ProjectSummary): void;
  onSelectRelease(release: ReleaseSummary): void;
  onSelectReleaseAsset(release: ReleaseSummary, asset: ReleaseAssetSummary): void;
  onSelectWorkflowRun(run: WorkflowRunSummary): void;
  onSelectWorkflowArtifact(
    run: WorkflowRunSummary | WorkflowRunDetail,
    artifact: WorkflowRunArtifactSummary
  ): void;
  onSelectSecurityItem(securityItem: SecurityItemRecentInput): void;
  onSelectWikiPage(page: WikiPageSummary | WikiPageContent): void;
  onOpenWorkflowRun(runId: number, url?: string | null): void;
  onSelectContributor(contributor: ContributorSummary): void;
  onSelectSecurityQualityBranch(ref: string): void;
  onSelectRef(ref: string | null): void;
  onSelectSettingsCollaborator(collaborator: RepositoryCollaboratorSummary): void;
  expansion: RepositoryPageExpansionHandlers;
  onTogglePin(): void;
  mutation: RepositoryPageMutationState;
  rightRail?: ReactNode;
}): JSX.Element {
  const {
    refListLimit,
    codeCommitHistoryLimit,
    issueListLimit,
    repositoryAccessLimit,
    forksLimit,
    pullRequestListLimit,
    discussionsLimit,
    actionsLimit,
    workflowDefinitionLimit,
    projectsLimit,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    releasesLimit,
    contributorLimit
  } = limits;
  const {
    onExpandRefs,
    onExpandIssues,
    onExpandPullRequests,
    onExpandContributors,
    onExpandForks,
    onExpandRepositoryAccess,
    onExpandActions,
    onExpandWorkflowDefinitions,
    onExpandProjects,
    onExpandReleases,
    onExpandDiscussions,
    onExpandDependabotAlerts,
    onExpandCodeScanningAlerts,
    onExpandSecretScanningAlerts,
    onExpandRepositoryRulesets,
    onExpandRepositorySecurityAdvisories
  } = expansion;
  const {
    action: mutationAction,
    pending: mutationPending,
    succeeded: mutationSucceeded,
    error: mutationError,
    onMutate
  } = mutation;
  const route = useUiStore((state) => state.route);
  const tab = route.kind === "repository" ? route.tab : "code";
  const routeOnlyTab = tabVisibility.routeOnlyTab;
  const navigationTabs: RepositoryTabDescriptor[] = routeOnlyTab
    ? [...tabVisibility.tabs, routeOnlyTab]
    : tabVisibility.tabs;
  const showingHiddenRouteOnlyTab = Boolean(routeOnlyTab && routeOnlyTab.key === tab);
  const focusedIssueNumber = route.kind === "repository" ? (route.issueNumber ?? null) : null;
  const focusedPullNumber = route.kind === "repository" ? (route.pullNumber ?? null) : null;
  const focusedDiscussionNumber = route.kind === "repository" ? (route.discussionNumber ?? null) : null;
  const focusedProjectId = route.kind === "repository" ? (route.projectId ?? null) : null;
  const focusedReleaseId = route.kind === "repository" ? (route.releaseId ?? null) : null;
  const focusedReleaseTagName = route.kind === "repository" ? (route.releaseTagName ?? null) : null;
  const focusedReleaseAssetId = route.kind === "repository" ? (route.releaseAssetId ?? null) : null;
  const focusedContributorLogin = route.kind === "repository" ? (route.contributorLogin ?? null) : null;
  const focusedSettingsCollaboratorLogin =
    route.kind === "repository" ? (route.settingsCollaboratorLogin ?? null) : null;
  const focusedWorkflowRunId = route.kind === "repository" ? (route.workflowRunId ?? null) : null;
  const focusedWorkflowArtifactId = route.kind === "repository" ? (route.workflowArtifactId ?? null) : null;
  const focusedSecurityItemKind = route.kind === "repository" ? (route.securityItemKind ?? null) : null;
  const focusedSecurityItemId = route.kind === "repository" ? (route.securityItemId ?? null) : null;
  const focusedWikiPagePath = route.kind === "repository" ? (route.wikiPagePath ?? null) : null;
  const issueFilter = route.kind === "repository" ? (route.issueFilter ?? "") : "";
  const pullFilter = route.kind === "repository" ? (route.pullFilter ?? "") : "";
  const workflowFilter = route.kind === "repository" ? (route.workflowFilter ?? "") : "";
  const issueComposer = route.kind === "repository" ? (route.issueComposer ?? null) : null;
  const pullComposer = route.kind === "repository" ? (route.pullComposer ?? null) : null;
  const releaseComposer = route.kind === "repository" ? (route.releaseComposer ?? null) : null;
  const workflowComposer = route.kind === "repository" ? (route.workflowComposer ?? null) : null;

  if (loading) {
    return <div className="loading-state">Loading repository…</div>;
  }

  if ((error || availabilityMessage) && !repository) {
    const routeRepositoryName = route.kind === "repository" ? route.nameWithOwner : null;

    return (
      <div className="error-state repository-load-error">
        <strong>Repository unavailable</strong>
        <span>{error?.message ?? availabilityMessage}</span>
        <div className="table-action-row">
          <button type="button" onClick={() => void onRefresh()}>
            <RefreshCw size={16} /> Retry
          </button>
          {routeRepositoryName && (
            <button type="button" onClick={() => onOpenExternal(`https://github.com/${routeRepositoryName}`)}>
              <ExternalLink size={16} /> GitHub fallback
            </button>
          )}
        </div>
      </div>
    );
  }

  const repo = repository;
  if (!repo) {
    return <div className="loading-state">No repository selected.</div>;
  }

  const counts = getRepositoryCounts(repo, { issues: [], pulls: [], discussions: [], projects: [] });
  const viewerState = getViewerRepositoryState(repo);
  const forkMetadata = getForkMetadata(repo);
  const liveMutationDisabledReason = !githubReady ? "Sign in with GitHub to run GitHub actions." : null;
  const starAction: GitHubAction = viewerState.isStarred ? "unstar" : "star";
  const watchAction: GitHubAction = viewerState.isWatching ? "unwatch" : "watch";
  const watchDisabledReason =
    liveMutationDisabledReason ??
    repositoryHeroMutationDisabledReason(repo, viewerState, "watch", mutationPending);
  const forkDisabledReason =
    liveMutationDisabledReason ??
    repositoryHeroMutationDisabledReason(repo, viewerState, "fork", mutationPending);
  const starDisabledReason =
    liveMutationDisabledReason ??
    repositoryHeroMutationDisabledReason(repo, viewerState, "star", mutationPending);
  const pinDisabledReason = pinBusy ? "Repository pin update is still running." : null;
  const tabCounts: Partial<Record<RepositoryTab, number>> = {
    issues: counts.issues,
    pulls: counts.pulls,
    discussions: counts.discussions,
    projects: counts.projects,
    releases: counts.releases,
    contributors: contributorCount
  };
  const forkSourceLabel = forkMetadata.parentLabel ?? forkMetadata.sourceLabel;
  const forkSourceNameWithOwner = forkMetadata.parentNameWithOwner ?? forkMetadata.sourceNameWithOwner;
  const forkSourceUrl = forkMetadata.parentUrl ?? forkMetadata.sourceUrl;
  const forkSourceForkCount = forkMetadata.parentForkCount ?? forkMetadata.sourceForkCount;
  const forkSourceViewerPermission =
    forkMetadata.parentViewerPermission ?? forkMetadata.sourceViewerPermission;
  const hasDistinctSource =
    Boolean(forkMetadata.parentLabel) &&
    Boolean(forkMetadata.sourceLabel) &&
    forkMetadata.sourceLabel !== forkMetadata.parentLabel;

  return (
    <article className="repo-page">
      <section className="repo-hero">
        <div className="repo-icon">
          <span>{repo.owner.slice(0, 1).toUpperCase()}</span>
          {repo.avatarUrl && (
            <img src={repo.avatarUrl} alt="" onError={(event) => event.currentTarget.remove()} />
          )}
        </div>
        <div className="repo-title-block">
          <div className="repo-title-line">
            <h1>
              {repo.owner} <span>/</span> {repo.name}
            </h1>
            <span className="visibility-pill">{repo.visibility.toLowerCase()}</span>
          </div>
          {repo.isFork && (
            <div className="fork-banner">
              <GitFork size={15} />
              <span>
                Forked from{" "}
                {forkSourceNameWithOwner && forkSourceLabel ? (
                  <button
                    type="button"
                    onClick={() => onOpenRepository(forkSourceNameWithOwner)}
                    title="Open in Control"
                  >
                    {forkSourceLabel}
                  </button>
                ) : (
                  <strong>{forkSourceLabel ?? "fork source loading"}</strong>
                )}
                {forkSourceUrl && forkSourceLabel && (
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label={`Open ${forkSourceLabel} on GitHub`}
                    title={`Open ${forkSourceLabel} on GitHub`}
                    onClick={() => onOpenExternal(forkSourceUrl)}
                  >
                    <ExternalLink size={13} />
                  </button>
                )}
                {forkSourceForkCount !== null && (
                  <span className="fork-meta">
                    {formatCompactNumber(forkSourceForkCount)} forks
                    {forkSourceViewerPermission
                      ? ` · ${forkSourceViewerPermission.toLowerCase()} access`
                      : ""}
                  </span>
                )}
                {hasDistinctSource && (
                  <>
                    {" "}
                    · source{" "}
                    {forkMetadata.sourceNameWithOwner ? (
                      <button
                        type="button"
                        onClick={() => onOpenRepository(forkMetadata.sourceNameWithOwner!)}
                        title="Open in Control"
                      >
                        {forkMetadata.sourceLabel}
                      </button>
                    ) : (
                      <strong>{forkMetadata.sourceLabel}</strong>
                    )}
                    {forkMetadata.sourceUrl && (
                      <button
                        className="pin-row-button"
                        type="button"
                        aria-label={`Open ${forkMetadata.sourceLabel} on GitHub`}
                        title={`Open ${forkMetadata.sourceLabel} on GitHub`}
                        onClick={() => onOpenExternal(forkMetadata.sourceUrl!)}
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                    {forkMetadata.sourceForkCount !== null && (
                      <span className="fork-meta">
                        {formatCompactNumber(forkMetadata.sourceForkCount)} forks
                        {forkMetadata.sourceViewerPermission
                          ? ` · ${forkMetadata.sourceViewerPermission.toLowerCase()} access`
                          : ""}
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          )}
        </div>
        <div className="repo-action-row">
          <button type="button" title="Updated repository data" onClick={() => void onRefresh()}>
            <RefreshCw size={16} /> Refresh {repo.nameWithOwner}
          </button>
          <button
            className={pinned ? "selected-action" : ""}
            type="button"
            aria-pressed={pinned}
            disabled={Boolean(pinDisabledReason)}
            title={pinDisabledReason ?? undefined}
            onClick={onTogglePin}
          >
            <Pin size={16} /> {pinned ? "Pinned" : "Pin"}
          </button>
          <button
            className={viewerState.isWatching ? "selected-action" : ""}
            type="button"
            aria-pressed={viewerState.isWatching}
            disabled={Boolean(watchDisabledReason)}
            title={watchDisabledReason ?? undefined}
            onClick={() => onMutate(watchAction, false)}
          >
            <Eye size={16} /> {viewerState.isWatching ? "Watching" : "Watch"} <ChevronDown size={14} />
          </button>
          <button
            type="button"
            disabled={Boolean(forkDisabledReason)}
            title={forkDisabledReason ?? undefined}
            onClick={() => onMutate("fork", true)}
          >
            <GitFork size={16} /> Fork <span>{formatCompactNumber(counts.forks)}</span>
          </button>
          <button
            className={viewerState.isStarred ? "selected-action dark-action" : "dark-action"}
            type="button"
            aria-pressed={viewerState.isStarred}
            disabled={Boolean(starDisabledReason)}
            title={starDisabledReason ?? undefined}
            onClick={() => onMutate(starAction, false)}
          >
            <Star size={17} /> {viewerState.isStarred ? "Starred" : "Star"}{" "}
            <span>{formatCompactNumber(counts.stars)}</span>
          </button>
          <button type="button" onClick={() => onOpenExternal(repo.htmlUrl)} title="Open on GitHub">
            <ExternalLink size={16} /> GitHub
          </button>
        </div>
        {(pinDisabledReason || watchDisabledReason || forkDisabledReason || starDisabledReason) && (
          <small className="action-disabled-note hero-action-disabled-note">
            {[pinDisabledReason, watchDisabledReason, forkDisabledReason, starDisabledReason]
              .filter(
                (reason, index, reasons): reason is string =>
                  Boolean(reason) && reasons.indexOf(reason) === index
              )
              .join(" ")}
          </small>
        )}
      </section>

      {!githubReady && (
        <div className="cached-mode-banner" role="status">
          <Lock size={16} />
          <span>
            Cached mode. Repository code and file inspection use local GitHub data when available; live
            refreshes and GitHub mutations require sign-in.
          </span>
        </div>
      )}

      {pinError && (
        <div className="mutation-feedback error-state" role="alert">
          Local repository pin update failed. {pinError.message}
        </div>
      )}
      {mutationPending && mutationAction && (
        <div className="mutation-feedback loading-state" role="status">
          GitHub action running: {githubActionLabel(mutationAction)}.
        </div>
      )}
      {!mutationPending && mutationSucceeded && mutationAction && (
        <div className="mutation-feedback success-state" role="status">
          GitHub action completed: {githubActionLabel(mutationAction)}.
        </div>
      )}
      {!mutationPending && mutationError && mutationAction && (
        <div className="mutation-feedback error-state" role="alert">
          GitHub action failed: {githubActionLabel(mutationAction)}. {mutationError.message}
        </div>
      )}

      <nav className="repo-tabs">
        {navigationTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={[tab === item.key ? "active" : "", item.routeOnly ? "route-only" : ""]
                .filter(Boolean)
                .join(" ")}
              key={item.key}
              type="button"
              onClick={() => onSelectTab(item.key)}
              title={
                item.routeOnly
                  ? (item.hiddenReason ?? "This tab is hidden by repository tab settings.")
                  : undefined
              }
            >
              <Icon size={16} />
              {item.label}
              {item.routeOnly && <span>hidden</span>}
              {tabCounts[item.key] !== undefined && (
                <span>{formatCompactNumber(tabCounts[item.key] ?? 0)}</span>
              )}
            </button>
          );
        })}
      </nav>

      {showingHiddenRouteOnlyTab && routeOnlyTab && (
        <section className="table-panel github-surface hidden-repository-tab-panel">
          <div>
            <h2>{routeOnlyTab.label} is hidden</h2>
            <p>{routeOnlyTab.hiddenReason ?? "This repository tab is hidden by your tab preferences."}</p>
          </div>
          <div className="table-action-row">
            <button
              type="button"
              onClick={() => {
                if (isRepositoryTabPreferenceKey(routeOnlyTab.key)) {
                  onShowHiddenTab(routeOnlyTab.key);
                }
              }}
            >
              Show this tab
            </button>
            <button type="button" onClick={() => onSelectTab("code")}>
              Back to Code
            </button>
          </div>
        </section>
      )}

      {!showingHiddenRouteOnlyTab && tab === "code" && (
        <CodeTab
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          refListLimit={refListLimit}
          commitHistoryLimit={codeCommitHistoryLimit}
          onOpenCodeBrowser={onOpenCodeBrowser}
          onOpenExternal={onOpenExternal}
          onOpenFileFinder={onOpenFileFinder}
          onSelectRef={onSelectRef}
          onExpandRefs={onExpandRefs}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "issues" && (
        <IssuesTab
          key={`issues-${focusedIssueNumber ?? issueComposer ?? (issueFilter || "default")}`}
          repository={repo}
          githubReady={githubReady}
          issueListLimit={issueListLimit}
          focusedIssueNumber={focusedIssueNumber}
          initialFilter={issueFilter}
          initialCreating={issueComposer === "create"}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
          onSelectIssue={onSelectIssue}
          onExpandIssues={onExpandIssues}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "pulls" && (
        <PullRequestsTab
          key={`pulls-${focusedPullNumber ?? pullComposer ?? (pullFilter || "default")}`}
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          refListLimit={refListLimit}
          pullRequestListLimit={pullRequestListLimit}
          focusedPullNumber={focusedPullNumber}
          initialFilter={pullFilter}
          initialCreating={pullComposer === "create"}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
          onSelectPullRequest={onSelectPullRequest}
          onOpenIssueReference={onOpenIssueReference}
          onOpenPullRequestCommit={onOpenPullRequestCommit}
          onOpenPullRequestReviewCommit={onOpenPullRequestReviewCommit}
          onOpenPullRequestTimelineEventCommit={onOpenPullRequestTimelineEventCommit}
          onOpenWorkflowRun={onOpenWorkflowRun}
          onOpenCodePath={(path, ref, blobUrl, line, targetRepositoryNameWithOwner) =>
            onOpenCodePath(path, "file", ref, blobUrl, line, targetRepositoryNameWithOwner)
          }
          onExpandPullRequests={onExpandPullRequests}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "discussions" && (
        <DiscussionsTab
          key={`discussions-${focusedDiscussionNumber ?? "default"}`}
          repository={repo}
          discussionsLimit={discussionsLimit}
          focusedDiscussionNumber={focusedDiscussionNumber}
          githubReady={githubReady}
          onOpenExternal={onOpenExternal}
          onSelectDiscussion={onSelectDiscussion}
          onExpandDiscussions={onExpandDiscussions}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "projects" && (
        <ProjectsTab
          key={`projects-${focusedProjectId ?? "default"}`}
          repository={repo}
          githubReady={githubReady}
          projectsLimit={projectsLimit}
          focusedProjectId={focusedProjectId}
          onOpenExternal={onOpenExternal}
          onSelectProject={onSelectProject}
          onExpandProjects={onExpandProjects}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "releases" && (
        <ReleasesTab
          key={`releases-${
            focusedReleaseId ?? focusedReleaseTagName ?? releaseComposer ?? "default"
          }-${focusedReleaseAssetId ?? "asset-default"}`}
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          refListLimit={refListLimit}
          releasesLimit={releasesLimit}
          focusedReleaseId={focusedReleaseId}
          focusedReleaseTagName={focusedReleaseTagName}
          focusedReleaseAssetId={focusedReleaseAssetId}
          initialCreating={releaseComposer === "create"}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
          onOpenReleaseTarget={onOpenReleaseTarget}
          onSelectRelease={onSelectRelease}
          onSelectReleaseAsset={onSelectReleaseAsset}
          onExpandReleases={onExpandReleases}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "actions" && (
        <ActionsTab
          key={`actions-${focusedWorkflowRunId ?? workflowComposer ?? (workflowFilter || "default")}-${
            focusedWorkflowArtifactId ?? "artifact-default"
          }`}
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          refListLimit={refListLimit}
          actionsLimit={actionsLimit}
          workflowDefinitionLimit={workflowDefinitionLimit}
          focusedWorkflowRunId={focusedWorkflowRunId}
          focusedWorkflowArtifactId={focusedWorkflowArtifactId}
          initialFilter={workflowFilter}
          initialDispatching={workflowComposer === "dispatch"}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
          onOpenWorkflowRunCommit={onOpenWorkflowRunCommit}
          onOpenWorkflowCheckSuiteCommit={onOpenWorkflowCheckSuiteCommit}
          onOpenCodePath={(path, ref, blobUrl, line, targetRepositoryNameWithOwner) =>
            onOpenCodePath(path, "file", ref, blobUrl, line, targetRepositoryNameWithOwner)
          }
          onSelectWorkflowRun={onSelectWorkflowRun}
          onSelectWorkflowArtifact={onSelectWorkflowArtifact}
          onExpandActions={onExpandActions}
          onExpandWorkflowDefinitions={onExpandWorkflowDefinitions}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "contributors" && (
        <ContributorsTab
          key={`contributors-${focusedContributorLogin ?? "default"}`}
          repository={repo}
          githubReady={githubReady}
          contributorLimit={contributorLimit}
          focusedContributorLogin={focusedContributorLogin}
          onOpenRepository={onOpenRepository}
          onOpenExternal={onOpenExternal}
          onSelectContributor={onSelectContributor}
          onExpandContributors={onExpandContributors}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "agents" && (
        <AgentsTab
          repository={repo}
          githubReady={githubReady}
          issueListLimit={issueListLimit}
          pullRequestListLimit={pullRequestListLimit}
          actionsLimit={actionsLimit}
          onOpenExternal={onOpenExternal}
          onOpenFilteredSurface={onOpenFilteredSurface}
          onSelectIssue={onSelectIssue}
          onSelectPullRequest={onSelectPullRequest}
          onSelectWorkflowRun={onSelectWorkflowRun}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "wiki" && (
        <WikiTab
          key={`wiki-${focusedWikiPagePath ?? "default"}`}
          repository={repo}
          githubReady={githubReady}
          focusedPagePath={focusedWikiPagePath}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
          onSelectWikiPage={onSelectWikiPage}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "securityQuality" && (
        <SecurityQualityTab
          key={`security-quality-${focusedSecurityItemKind ?? "default"}-${focusedSecurityItemId ?? "default"}`}
          repository={repo}
          selectedRef={selectedRef}
          refListLimit={refListLimit}
          dependabotAlertsLimit={dependabotAlertsLimit}
          codeScanningAlertsLimit={codeScanningAlertsLimit}
          secretScanningAlertsLimit={secretScanningAlertsLimit}
          repositoryRulesetsLimit={repositoryRulesetsLimit}
          repositorySecurityAdvisoriesLimit={repositorySecurityAdvisoriesLimit}
          githubReady={githubReady}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          focusedSecurityItemKind={focusedSecurityItemKind}
          focusedSecurityItemId={focusedSecurityItemId}
          onOpenExternal={onOpenExternal}
          onOpenCodePath={(path, ref, line) => onOpenCodePath(path, "file", ref, null, line)}
          onSelectSecurityItem={onSelectSecurityItem}
          onSelectSecurityQualityBranch={onSelectSecurityQualityBranch}
          onExpandDependabotAlerts={onExpandDependabotAlerts}
          onExpandCodeScanningAlerts={onExpandCodeScanningAlerts}
          onExpandSecretScanningAlerts={onExpandSecretScanningAlerts}
          onExpandRepositoryRulesets={onExpandRepositoryRulesets}
          onExpandRepositorySecurityAdvisories={onExpandRepositorySecurityAdvisories}
          onMutate={onMutate}
        />
      )}
      {!showingHiddenRouteOnlyTab && tab === "settings" && (
        <RepositorySettingsTab
          key={`settings-${repo.id}-${repo.description ?? ""}-${repo.homepageUrl ?? ""}-${JSON.stringify(
            repo.administration.features
          )}-${JSON.stringify(repo.administration.mergeSettings)}-${repo.administration.isArchived}-${
            repo.administration.allowForking
          }-${repo.administration.webCommitSignoffRequired}-${repo.topics.join(",")}`}
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          refListLimit={refListLimit}
          repositoryRulesetsLimit={repositoryRulesetsLimit}
          repositoryAccessLimit={repositoryAccessLimit}
          focusedCollaboratorLogin={focusedSettingsCollaboratorLogin}
          forksLimit={forksLimit}
          saving={mutationPending && mutationAction === "editRepository"}
          saveSucceeded={mutationSucceeded && mutationAction === "editRepository"}
          saveError={mutationAction === "editRepository" ? mutationError : null}
          mutationAction={mutationAction}
          mutationPending={mutationPending}
          mutationSucceeded={mutationSucceeded}
          mutationError={mutationError}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
          onOpenRepository={onOpenRepository}
          onOpenTeam={onOpenTeam}
          onSelectCollaborator={onSelectSettingsCollaborator}
          onExpandForks={onExpandForks}
          onExpandRepositoryAccess={onExpandRepositoryAccess}
        />
      )}
      {rightRail}
    </article>
  );
}
