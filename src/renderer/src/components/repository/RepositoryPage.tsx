import { ChevronDown, ExternalLink, Eye, GitFork, Lock, Pin, RefreshCw, Star } from "lucide-react";
import type { JSX, ReactNode, SyntheticEvent } from "react";

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
  RepositoryTabPreferenceMap,
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
import { useUiStore, type AppRoute, type RepositoryTab } from "../../stores/uiStore";
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

interface RepositoryPageProps {
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
  tabPreferences: RepositoryTabPreferenceMap;
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
  onSaveTabPreferences(preferences: RepositoryTabPreferenceMap): Promise<void>;
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
}

type RepositoryCounts = ReturnType<typeof getRepositoryCounts>;
type RepositoryViewerState = ReturnType<typeof getViewerRepositoryState>;
type RepositoryForkMetadata = ReturnType<typeof getForkMetadata>;

interface RepositoryRouteModel {
  routeRepositoryName: string | null;
  tab: RepositoryTab;
  navigationTabs: RepositoryTabDescriptor[];
  routeOnlyTab: RepositoryTabDescriptor | null;
  showingHiddenRouteOnlyTab: boolean;
  focusedIssueNumber: number | null;
  focusedPullNumber: number | null;
  focusedDiscussionNumber: number | null;
  focusedProjectId: string | null;
  focusedReleaseId: number | null;
  focusedReleaseTagName: string | null;
  focusedReleaseAssetId: number | null;
  focusedContributorLogin: string | null;
  focusedSettingsCollaboratorLogin: string | null;
  focusedWorkflowRunId: number | null;
  focusedWorkflowArtifactId: number | null;
  focusedSecurityItemKind: LocalRecentSecurityItemKind | null;
  focusedSecurityItemId: string | null;
  focusedWikiPagePath: string | null;
  issueFilter: string;
  pullFilter: string;
  workflowFilter: string;
  issueComposer: "create" | null;
  pullComposer: "create" | null;
  releaseComposer: "create" | null;
  workflowComposer: "dispatch" | null;
}

interface RepositoryPageModel {
  counts: RepositoryCounts;
  viewerState: RepositoryViewerState;
  forkMetadata: RepositoryForkMetadata;
  starAction: GitHubAction;
  watchAction: GitHubAction;
  watchDisabledReason: string | null;
  forkDisabledReason: string | null;
  starDisabledReason: string | null;
  pinDisabledReason: string | null;
  tabCounts: Partial<Record<RepositoryTab, number>>;
}

interface RepositoryActiveTabSurfaceProps {
  repository: RepositoryDetail;
  routeModel: RepositoryRouteModel;
  githubReady: boolean;
  selectedRef: string | null;
  limits: RepositoryPageLimits;
  expansion: RepositoryPageExpansionHandlers;
  mutation: RepositoryPageMutationState;
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
  onOpenFileFinder(): void;
  onSelectTab(tab: RepositoryTab): void;
  tabPreferences: RepositoryTabPreferenceMap;
  onSaveTabPreferences(preferences: RepositoryTabPreferenceMap): Promise<void>;
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
}

type RepositoryTabSurfaceComponent = (props: RepositoryActiveTabSurfaceProps) => JSX.Element;

function useRepositoryRouteModel(tabVisibility: RepositoryTabVisibilityResult): RepositoryRouteModel {
  const route = useUiStore((state) => state.route);
  return getRepositoryRouteModel(route, tabVisibility);
}

function getRepositoryRouteModel(
  route: AppRoute,
  tabVisibility: RepositoryTabVisibilityResult
): RepositoryRouteModel {
  const repositoryRoute = route.kind === "repository" ? route : null;
  const tab = repositoryRoute?.tab ?? "code";
  const routeOnlyTab = tabVisibility.routeOnlyTab;
  const navigationTabs = routeOnlyTab ? [...tabVisibility.tabs, routeOnlyTab] : tabVisibility.tabs;

  return {
    routeRepositoryName: repositoryRoute?.nameWithOwner ?? null,
    tab,
    navigationTabs,
    routeOnlyTab,
    showingHiddenRouteOnlyTab: Boolean(routeOnlyTab && routeOnlyTab.key === tab),
    focusedIssueNumber: repositoryRoute?.issueNumber ?? null,
    focusedPullNumber: repositoryRoute?.pullNumber ?? null,
    focusedDiscussionNumber: repositoryRoute?.discussionNumber ?? null,
    focusedProjectId: repositoryRoute?.projectId ?? null,
    focusedReleaseId: repositoryRoute?.releaseId ?? null,
    focusedReleaseTagName: repositoryRoute?.releaseTagName ?? null,
    focusedReleaseAssetId: repositoryRoute?.releaseAssetId ?? null,
    focusedContributorLogin: repositoryRoute?.contributorLogin ?? null,
    focusedSettingsCollaboratorLogin: repositoryRoute?.settingsCollaboratorLogin ?? null,
    focusedWorkflowRunId: repositoryRoute?.workflowRunId ?? null,
    focusedWorkflowArtifactId: repositoryRoute?.workflowArtifactId ?? null,
    focusedSecurityItemKind: repositoryRoute?.securityItemKind ?? null,
    focusedSecurityItemId: repositoryRoute?.securityItemId ?? null,
    focusedWikiPagePath: repositoryRoute?.wikiPagePath ?? null,
    issueFilter: repositoryRoute?.issueFilter ?? "",
    pullFilter: repositoryRoute?.pullFilter ?? "",
    workflowFilter: repositoryRoute?.workflowFilter ?? "",
    issueComposer: repositoryRoute?.issueComposer ?? null,
    pullComposer: repositoryRoute?.pullComposer ?? null,
    releaseComposer: repositoryRoute?.releaseComposer ?? null,
    workflowComposer: repositoryRoute?.workflowComposer ?? null
  };
}

function buildRepositoryPageModel(input: {
  repository: RepositoryDetail;
  githubReady: boolean;
  contributorCount: number;
  pinBusy: boolean;
  mutationPending: boolean;
}): RepositoryPageModel {
  const counts = getRepositoryCounts(input.repository, {
    issues: [],
    pulls: [],
    discussions: [],
    projects: []
  });
  const viewerState = getViewerRepositoryState(input.repository);
  const forkMetadata = getForkMetadata(input.repository);
  const liveMutationDisabledReason = input.githubReady ? null : "Sign in with GitHub to run GitHub actions.";
  const starAction: GitHubAction = viewerState.isStarred ? "unstar" : "star";
  const watchAction: GitHubAction = viewerState.isWatching ? "unwatch" : "watch";

  return {
    counts,
    viewerState,
    forkMetadata,
    starAction,
    watchAction,
    watchDisabledReason:
      liveMutationDisabledReason ??
      repositoryHeroMutationDisabledReason(input.repository, viewerState, "watch", input.mutationPending),
    forkDisabledReason:
      liveMutationDisabledReason ??
      repositoryHeroMutationDisabledReason(input.repository, viewerState, "fork", input.mutationPending),
    starDisabledReason:
      liveMutationDisabledReason ??
      repositoryHeroMutationDisabledReason(input.repository, viewerState, "star", input.mutationPending),
    pinDisabledReason: input.pinBusy ? "Repository pin update is still running." : null,
    tabCounts: {
      issues: counts.issues,
      pulls: counts.pulls,
      discussions: counts.discussions,
      projects: counts.projects,
      releases: counts.releases,
      contributors: input.contributorCount
    }
  };
}

function repositoryPageClassName(routeModel: RepositoryRouteModel): string {
  return routeModel.focusedIssueNumber !== null ? "repo-page repo-page-focused-issue" : "repo-page";
}

function uniqueRepositoryActionDisabledNotes(notes: readonly (string | null)[]): string {
  const seen = new Set<string>();
  const uniqueNotes: string[] = [];

  for (const note of notes) {
    if (!note || seen.has(note)) {
      continue;
    }
    seen.add(note);
    uniqueNotes.push(note);
  }

  return uniqueNotes.join(" ");
}

function repositoryTabButtonClassName(active: boolean, routeOnly: boolean | undefined): string {
  const classNames: string[] = [];
  if (active) {
    classNames.push("active");
  }
  if (routeOnly) {
    classNames.push("route-only");
  }
  return classNames.join(" ");
}

function repositorySettingsTabKey(repository: RepositoryDetail): string {
  return `settings-${repository.id}-${repository.description ?? ""}-${repository.homepageUrl ?? ""}-${JSON.stringify(
    repository.administration.features
  )}-${JSON.stringify(repository.administration.mergeSettings)}-${repository.administration.isArchived}-${
    repository.administration.allowForking
  }-${repository.administration.webCommitSignoffRequired}-${repository.topics.join(",")}`;
}

function hasDistinctForkSource(metadata: RepositoryForkMetadata): boolean {
  return Boolean(
    metadata.parentLabel && metadata.sourceLabel && metadata.sourceLabel !== metadata.parentLabel
  );
}

function removeBrokenRepositoryAvatar(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.remove();
}

export function RepositoryPage(props: RepositoryPageProps): JSX.Element {
  const routeModel = useRepositoryRouteModel(props.tabVisibility);

  if (props.loading) {
    return <RepositoryPageLoadingState />;
  }

  if ((props.error || props.availabilityMessage) && !props.repository) {
    return (
      <RepositoryPageLoadError
        message={props.error?.message ?? props.availabilityMessage ?? "Repository unavailable."}
        routeRepositoryName={routeModel.routeRepositoryName}
        onRefresh={props.onRefresh}
        onOpenExternal={props.onOpenExternal}
      />
    );
  }

  const repository = props.repository;
  if (!repository) {
    return <div className="loading-state">No repository selected.</div>;
  }

  const pageModel = buildRepositoryPageModel({
    repository,
    githubReady: props.githubReady,
    contributorCount: props.contributorCount,
    pinBusy: props.pinBusy,
    mutationPending: props.mutation.pending
  });

  return (
    <article className={repositoryPageClassName(routeModel)}>
      <RepositoryHero
        repository={repository}
        pageModel={pageModel}
        pinned={props.pinned}
        onRefresh={props.onRefresh}
        onTogglePin={props.onTogglePin}
        onMutate={props.mutation.onMutate}
        onOpenExternal={props.onOpenExternal}
        onOpenRepository={props.onOpenRepository}
      />
      <RepositoryStatusBanners
        githubReady={props.githubReady}
        pinError={props.pinError}
        mutation={props.mutation}
      />
      <RepositoryTabsNav
        activeTab={routeModel.tab}
        navigationTabs={routeModel.navigationTabs}
        tabCounts={pageModel.tabCounts}
        onSelectTab={props.onSelectTab}
      />
      {routeModel.showingHiddenRouteOnlyTab && routeModel.routeOnlyTab && (
        <RepositoryHiddenTabPanel
          routeOnlyTab={routeModel.routeOnlyTab}
          onShowHiddenTab={props.onShowHiddenTab}
          onSelectTab={props.onSelectTab}
        />
      )}
      <RepositoryActiveTabSurface
        repository={repository}
        routeModel={routeModel}
        githubReady={props.githubReady}
        selectedRef={props.selectedRef}
        limits={props.limits}
        expansion={props.expansion}
        mutation={props.mutation}
        onOpenCodeBrowser={props.onOpenCodeBrowser}
        onOpenReleaseTarget={props.onOpenReleaseTarget}
        onOpenPullRequestCommit={props.onOpenPullRequestCommit}
        onOpenPullRequestReviewCommit={props.onOpenPullRequestReviewCommit}
        onOpenPullRequestTimelineEventCommit={props.onOpenPullRequestTimelineEventCommit}
        onOpenWorkflowRunCommit={props.onOpenWorkflowRunCommit}
        onOpenWorkflowCheckSuiteCommit={props.onOpenWorkflowCheckSuiteCommit}
        onOpenCodePath={props.onOpenCodePath}
        onOpenExternal={props.onOpenExternal}
        onOpenRepository={props.onOpenRepository}
        onOpenTeam={props.onOpenTeam}
        onOpenFileFinder={props.onOpenFileFinder}
        onSelectTab={props.onSelectTab}
        tabPreferences={props.tabPreferences}
        onSaveTabPreferences={props.onSaveTabPreferences}
        onOpenFilteredSurface={props.onOpenFilteredSurface}
        onSelectIssue={props.onSelectIssue}
        onSelectPullRequest={props.onSelectPullRequest}
        onOpenIssueReference={props.onOpenIssueReference}
        onSelectDiscussion={props.onSelectDiscussion}
        onSelectProject={props.onSelectProject}
        onSelectRelease={props.onSelectRelease}
        onSelectReleaseAsset={props.onSelectReleaseAsset}
        onSelectWorkflowRun={props.onSelectWorkflowRun}
        onSelectWorkflowArtifact={props.onSelectWorkflowArtifact}
        onSelectSecurityItem={props.onSelectSecurityItem}
        onSelectWikiPage={props.onSelectWikiPage}
        onOpenWorkflowRun={props.onOpenWorkflowRun}
        onSelectContributor={props.onSelectContributor}
        onSelectSecurityQualityBranch={props.onSelectSecurityQualityBranch}
        onSelectRef={props.onSelectRef}
        onSelectSettingsCollaborator={props.onSelectSettingsCollaborator}
      />
      {routeModel.focusedIssueNumber === null && props.rightRail}
    </article>
  );
}

function RepositoryPageLoadingState(): JSX.Element {
  return <div className="loading-state">Loading repository…</div>;
}

function RepositoryPageLoadError({
  message,
  routeRepositoryName,
  onRefresh,
  onOpenExternal
}: {
  message: string;
  routeRepositoryName: string | null;
  onRefresh(): Promise<void> | void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function retryRepositoryLoad(): void {
    void onRefresh();
  }

  function openRepositoryOnGitHub(): void {
    if (routeRepositoryName) {
      onOpenExternal(`https://github.com/${routeRepositoryName}`);
    }
  }

  return (
    <div className="error-state repository-load-error">
      <strong>Repository unavailable</strong>
      <span>{message}</span>
      <div className="table-action-row">
        <button type="button" onClick={retryRepositoryLoad}>
          <RefreshCw size={16} /> Retry
        </button>
        {routeRepositoryName && (
          <button type="button" onClick={openRepositoryOnGitHub}>
            <ExternalLink size={16} /> GitHub fallback
          </button>
        )}
      </div>
    </div>
  );
}

function RepositoryHero({
  repository,
  pageModel,
  pinned,
  onRefresh,
  onTogglePin,
  onMutate,
  onOpenExternal,
  onOpenRepository
}: {
  repository: RepositoryDetail;
  pageModel: RepositoryPageModel;
  pinned: boolean;
  onRefresh(): Promise<void> | void;
  onTogglePin(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
}): JSX.Element {
  return (
    <section className="repo-hero">
      <RepositoryAvatar repository={repository} />
      <div className="repo-title-block">
        <div className="repo-title-line">
          <h1>
            {repository.owner} <span>/</span> {repository.name}
          </h1>
          <span className="visibility-pill">{repository.visibility.toLowerCase()}</span>
        </div>
        {repository.isFork && (
          <RepositoryForkBanner
            metadata={pageModel.forkMetadata}
            onOpenRepository={onOpenRepository}
            onOpenExternal={onOpenExternal}
          />
        )}
      </div>
      <RepositoryHeroActions
        repository={repository}
        counts={pageModel.counts}
        viewerState={pageModel.viewerState}
        starAction={pageModel.starAction}
        watchAction={pageModel.watchAction}
        watchDisabledReason={pageModel.watchDisabledReason}
        forkDisabledReason={pageModel.forkDisabledReason}
        starDisabledReason={pageModel.starDisabledReason}
        pinDisabledReason={pageModel.pinDisabledReason}
        pinned={pinned}
        onRefresh={onRefresh}
        onTogglePin={onTogglePin}
        onMutate={onMutate}
        onOpenExternal={onOpenExternal}
      />
      <RepositoryHeroActionDisabledNote
        notes={[
          pageModel.pinDisabledReason,
          pageModel.watchDisabledReason,
          pageModel.forkDisabledReason,
          pageModel.starDisabledReason
        ]}
      />
    </section>
  );
}

function RepositoryAvatar({ repository }: { repository: RepositoryDetail }): JSX.Element {
  return (
    <div className="repo-icon">
      <span>{repository.owner.slice(0, 1).toUpperCase()}</span>
      {repository.avatarUrl && (
        <img src={repository.avatarUrl} alt="" onError={removeBrokenRepositoryAvatar} />
      )}
    </div>
  );
}

function RepositoryForkBanner({
  metadata,
  onOpenRepository,
  onOpenExternal
}: {
  metadata: RepositoryForkMetadata;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const forkSourceLabel = metadata.parentLabel ?? metadata.sourceLabel;
  const forkSourceNameWithOwner = metadata.parentNameWithOwner ?? metadata.sourceNameWithOwner;
  const forkSourceUrl = metadata.parentUrl ?? metadata.sourceUrl;
  const forkSourceForkCount = metadata.parentForkCount ?? metadata.sourceForkCount;
  const forkSourceViewerPermission = metadata.parentViewerPermission ?? metadata.sourceViewerPermission;

  return (
    <div className="fork-banner">
      <GitFork size={15} />
      <span>
        Forked from{" "}
        <RepositoryForkReference
          label={forkSourceLabel}
          nameWithOwner={forkSourceNameWithOwner}
          url={forkSourceUrl}
          forkCount={forkSourceForkCount}
          viewerPermission={forkSourceViewerPermission}
          fallbackLabel="fork source loading"
          onOpenRepository={onOpenRepository}
          onOpenExternal={onOpenExternal}
        />
        {hasDistinctForkSource(metadata) && (
          <>
            {" "}
            · source{" "}
            <RepositoryForkReference
              label={metadata.sourceLabel}
              nameWithOwner={metadata.sourceNameWithOwner}
              url={metadata.sourceUrl}
              forkCount={metadata.sourceForkCount}
              viewerPermission={metadata.sourceViewerPermission}
              fallbackLabel="source loading"
              onOpenRepository={onOpenRepository}
              onOpenExternal={onOpenExternal}
            />
          </>
        )}
      </span>
    </div>
  );
}

function RepositoryForkReference({
  label,
  nameWithOwner,
  url,
  forkCount,
  viewerPermission,
  fallbackLabel,
  onOpenRepository,
  onOpenExternal
}: {
  label: string | null;
  nameWithOwner: string | null;
  url: string | null;
  forkCount: number | null;
  viewerPermission: string | null;
  fallbackLabel: string;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function openForkInControl(): void {
    if (nameWithOwner) {
      onOpenRepository(nameWithOwner);
    }
  }

  function openForkOnGitHub(): void {
    if (url) {
      onOpenExternal(url);
    }
  }

  return (
    <>
      {nameWithOwner && label ? (
        <button type="button" onClick={openForkInControl} title="Open in Control">
          {label}
        </button>
      ) : (
        <strong>{label ?? fallbackLabel}</strong>
      )}
      {url && label && (
        <button
          className="pin-row-button"
          type="button"
          aria-label={`Open ${label} on GitHub`}
          title={`Open ${label} on GitHub`}
          onClick={openForkOnGitHub}
        >
          <ExternalLink size={13} />
        </button>
      )}
      {forkCount !== null && (
        <span className="fork-meta">
          {formatCompactNumber(forkCount)} forks
          {viewerPermission ? ` · ${viewerPermission.toLowerCase()} access` : ""}
        </span>
      )}
    </>
  );
}

function RepositoryHeroActions({
  repository,
  counts,
  viewerState,
  starAction,
  watchAction,
  watchDisabledReason,
  forkDisabledReason,
  starDisabledReason,
  pinDisabledReason,
  pinned,
  onRefresh,
  onTogglePin,
  onMutate,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  counts: RepositoryCounts;
  viewerState: RepositoryViewerState;
  starAction: GitHubAction;
  watchAction: GitHubAction;
  watchDisabledReason: string | null;
  forkDisabledReason: string | null;
  starDisabledReason: string | null;
  pinDisabledReason: string | null;
  pinned: boolean;
  onRefresh(): Promise<void> | void;
  onTogglePin(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function refreshRepositoryData(): void {
    void onRefresh();
  }

  function toggleWatchMutation(): void {
    onMutate(watchAction, false);
  }

  function forkRepository(): void {
    onMutate("fork", true);
  }

  function toggleStarMutation(): void {
    onMutate(starAction, false);
  }

  function openRepositoryOnGitHub(): void {
    onOpenExternal(repository.htmlUrl);
  }

  return (
    <div className="repo-action-row">
      <button type="button" title="Updated repository data" onClick={refreshRepositoryData}>
        <RefreshCw size={16} /> Refresh {repository.nameWithOwner}
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
        onClick={toggleWatchMutation}
      >
        <Eye size={16} /> {viewerState.isWatching ? "Watching" : "Watch"} <ChevronDown size={14} />
      </button>
      <button
        type="button"
        disabled={Boolean(forkDisabledReason)}
        title={forkDisabledReason ?? undefined}
        onClick={forkRepository}
      >
        <GitFork size={16} /> Fork <span>{formatCompactNumber(counts.forks)}</span>
      </button>
      <button
        className={viewerState.isStarred ? "selected-action dark-action" : "dark-action"}
        type="button"
        aria-pressed={viewerState.isStarred}
        disabled={Boolean(starDisabledReason)}
        title={starDisabledReason ?? undefined}
        onClick={toggleStarMutation}
      >
        <Star size={17} /> {viewerState.isStarred ? "Starred" : "Star"}{" "}
        <span>{formatCompactNumber(counts.stars)}</span>
      </button>
      <button type="button" onClick={openRepositoryOnGitHub} title="Open on GitHub">
        <ExternalLink size={16} /> GitHub
      </button>
    </div>
  );
}

function RepositoryHeroActionDisabledNote({
  notes
}: {
  notes: readonly (string | null)[];
}): JSX.Element | null {
  const message = uniqueRepositoryActionDisabledNotes(notes);
  if (!message) {
    return null;
  }

  return <small className="action-disabled-note hero-action-disabled-note">{message}</small>;
}

function RepositoryStatusBanners({
  githubReady,
  pinError,
  mutation
}: {
  githubReady: boolean;
  pinError: Error | null;
  mutation: RepositoryPageMutationState;
}): JSX.Element {
  return (
    <>
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
      {mutation.pending && mutation.action && (
        <div className="mutation-feedback loading-state" role="status">
          GitHub action running: {githubActionLabel(mutation.action)}.
        </div>
      )}
      {!mutation.pending && mutation.succeeded && mutation.action && (
        <div className="mutation-feedback success-state" role="status">
          GitHub action completed: {githubActionLabel(mutation.action)}.
        </div>
      )}
      {!mutation.pending && mutation.error && mutation.action && (
        <div className="mutation-feedback error-state" role="alert">
          GitHub action failed: {githubActionLabel(mutation.action)}. {mutation.error.message}
        </div>
      )}
    </>
  );
}

function RepositoryTabsNav({
  activeTab,
  navigationTabs,
  tabCounts,
  onSelectTab
}: {
  activeTab: RepositoryTab;
  navigationTabs: RepositoryTabDescriptor[];
  tabCounts: Partial<Record<RepositoryTab, number>>;
  onSelectTab(tab: RepositoryTab): void;
}): JSX.Element {
  return (
    <nav className="repo-tabs">
      {navigationTabs.map((item) => (
        <RepositoryTabButton
          active={activeTab === item.key}
          item={item}
          count={tabCounts[item.key]}
          key={item.key}
          onSelectTab={onSelectTab}
        />
      ))}
    </nav>
  );
}

function RepositoryTabButton({
  active,
  item,
  count,
  onSelectTab
}: {
  active: boolean;
  item: RepositoryTabDescriptor;
  count: number | undefined;
  onSelectTab(tab: RepositoryTab): void;
}): JSX.Element {
  const Icon = item.icon;

  function selectRepositoryTab(): void {
    onSelectTab(item.key);
  }

  return (
    <button
      className={repositoryTabButtonClassName(active, item.routeOnly)}
      type="button"
      onClick={selectRepositoryTab}
      title={
        item.routeOnly ? (item.hiddenReason ?? "This tab is hidden by repository tab settings.") : undefined
      }
    >
      <Icon size={16} />
      {item.label}
      {item.routeOnly && <span>hidden</span>}
      {count !== undefined && <span>{formatCompactNumber(count)}</span>}
    </button>
  );
}

function RepositoryHiddenTabPanel({
  routeOnlyTab,
  onShowHiddenTab,
  onSelectTab
}: {
  routeOnlyTab: RepositoryTabDescriptor;
  onShowHiddenTab(tab: RepositoryTabPreferenceKey): void;
  onSelectTab(tab: RepositoryTab): void;
}): JSX.Element {
  function showHiddenRepositoryTab(): void {
    if (isRepositoryTabPreferenceKey(routeOnlyTab.key)) {
      onShowHiddenTab(routeOnlyTab.key);
    }
  }

  function returnToCodeTab(): void {
    onSelectTab("code");
  }

  return (
    <section className="table-panel github-surface hidden-repository-tab-panel">
      <div>
        <h2>{routeOnlyTab.label} is hidden</h2>
        <p>{routeOnlyTab.hiddenReason ?? "This repository tab is hidden by your tab preferences."}</p>
      </div>
      <div className="table-action-row">
        <button type="button" onClick={showHiddenRepositoryTab}>
          Show this tab
        </button>
        <button type="button" onClick={returnToCodeTab}>
          Back to Code
        </button>
      </div>
    </section>
  );
}

function RepositoryActiveTabSurface(props: RepositoryActiveTabSurfaceProps): JSX.Element | null {
  if (props.routeModel.showingHiddenRouteOnlyTab) {
    return null;
  }

  const Surface = repositoryTabSurfaceComponents[props.routeModel.tab];
  return <Surface {...props} />;
}

function RepositoryCodeTabSurface({
  repository,
  githubReady,
  selectedRef,
  limits,
  expansion,
  onOpenCodeBrowser,
  onOpenExternal,
  onOpenFileFinder,
  onSelectRef
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <CodeTab
      repository={repository}
      githubReady={githubReady}
      selectedRef={selectedRef}
      refListLimit={limits.refListLimit}
      commitHistoryLimit={limits.codeCommitHistoryLimit}
      onOpenCodeBrowser={onOpenCodeBrowser}
      onOpenExternal={onOpenExternal}
      onOpenFileFinder={onOpenFileFinder}
      onSelectRef={onSelectRef}
      onExpandRefs={expansion.onExpandRefs}
    />
  );
}

function RepositoryIssuesTabSurface({
  repository,
  routeModel,
  githubReady,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onSelectIssue,
  onSelectTab
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  function openIssueList(): void {
    onSelectTab("issues");
  }

  return (
    <IssuesTab
      key={`issues-${routeModel.focusedIssueNumber ?? routeModel.issueComposer ?? (routeModel.issueFilter || "default")}`}
      repository={repository}
      githubReady={githubReady}
      issueListLimit={limits.issueListLimit}
      focusedIssueNumber={routeModel.focusedIssueNumber}
      initialFilter={routeModel.issueFilter}
      initialCreating={routeModel.issueComposer === "create"}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      onMutate={mutation.onMutate}
      onOpenExternal={onOpenExternal}
      onSelectIssue={onSelectIssue}
      onOpenIssueList={openIssueList}
      onExpandIssues={expansion.onExpandIssues}
    />
  );
}

function RepositoryPullRequestsTabSurface({
  repository,
  routeModel,
  githubReady,
  selectedRef,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onSelectPullRequest,
  onOpenIssueReference,
  onOpenPullRequestCommit,
  onOpenPullRequestReviewCommit,
  onOpenPullRequestTimelineEventCommit,
  onOpenWorkflowRun,
  onOpenCodePath
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  function openPullRequestCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    onOpenCodePath(path, "file", ref, blobUrl, line, targetRepositoryNameWithOwner);
  }

  return (
    <PullRequestsTab
      key={`pulls-${routeModel.focusedPullNumber ?? routeModel.pullComposer ?? (routeModel.pullFilter || "default")}`}
      repository={repository}
      githubReady={githubReady}
      selectedRef={selectedRef}
      refListLimit={limits.refListLimit}
      pullRequestListLimit={limits.pullRequestListLimit}
      focusedPullNumber={routeModel.focusedPullNumber}
      initialFilter={routeModel.pullFilter}
      initialCreating={routeModel.pullComposer === "create"}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      onMutate={mutation.onMutate}
      onOpenExternal={onOpenExternal}
      onSelectPullRequest={onSelectPullRequest}
      onOpenIssueReference={onOpenIssueReference}
      onOpenPullRequestCommit={onOpenPullRequestCommit}
      onOpenPullRequestReviewCommit={onOpenPullRequestReviewCommit}
      onOpenPullRequestTimelineEventCommit={onOpenPullRequestTimelineEventCommit}
      onOpenWorkflowRun={onOpenWorkflowRun}
      onOpenCodePath={openPullRequestCodePath}
      onExpandPullRequests={expansion.onExpandPullRequests}
    />
  );
}

function RepositoryDiscussionsTabSurface({
  repository,
  routeModel,
  githubReady,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onSelectDiscussion
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <DiscussionsTab
      key={`discussions-${routeModel.focusedDiscussionNumber ?? "default"}`}
      repository={repository}
      discussionsLimit={limits.discussionsLimit}
      focusedDiscussionNumber={routeModel.focusedDiscussionNumber}
      githubReady={githubReady}
      onOpenExternal={onOpenExternal}
      onSelectDiscussion={onSelectDiscussion}
      onExpandDiscussions={expansion.onExpandDiscussions}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      onMutate={mutation.onMutate}
    />
  );
}

function RepositoryProjectsTabSurface({
  repository,
  routeModel,
  githubReady,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onSelectProject
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <ProjectsTab
      key={`projects-${routeModel.focusedProjectId ?? "default"}`}
      repository={repository}
      githubReady={githubReady}
      projectsLimit={limits.projectsLimit}
      focusedProjectId={routeModel.focusedProjectId}
      onOpenExternal={onOpenExternal}
      onSelectProject={onSelectProject}
      onExpandProjects={expansion.onExpandProjects}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      onMutate={mutation.onMutate}
    />
  );
}

function RepositoryReleasesTabSurface({
  repository,
  routeModel,
  githubReady,
  selectedRef,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onOpenReleaseTarget,
  onSelectRelease,
  onSelectReleaseAsset
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <ReleasesTab
      key={`releases-${
        routeModel.focusedReleaseId ??
        routeModel.focusedReleaseTagName ??
        routeModel.releaseComposer ??
        "default"
      }-${routeModel.focusedReleaseAssetId ?? "asset-default"}`}
      repository={repository}
      githubReady={githubReady}
      selectedRef={selectedRef}
      refListLimit={limits.refListLimit}
      releasesLimit={limits.releasesLimit}
      focusedReleaseId={routeModel.focusedReleaseId}
      focusedReleaseTagName={routeModel.focusedReleaseTagName}
      focusedReleaseAssetId={routeModel.focusedReleaseAssetId}
      initialCreating={routeModel.releaseComposer === "create"}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      onMutate={mutation.onMutate}
      onOpenExternal={onOpenExternal}
      onOpenReleaseTarget={onOpenReleaseTarget}
      onSelectRelease={onSelectRelease}
      onSelectReleaseAsset={onSelectReleaseAsset}
      onExpandReleases={expansion.onExpandReleases}
    />
  );
}

function RepositoryActionsTabSurface({
  repository,
  routeModel,
  githubReady,
  selectedRef,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onOpenWorkflowRunCommit,
  onOpenWorkflowCheckSuiteCommit,
  onOpenCodePath,
  onSelectWorkflowRun,
  onSelectWorkflowArtifact
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  function openActionsCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    onOpenCodePath(path, "file", ref, blobUrl, line, targetRepositoryNameWithOwner);
  }

  return (
    <ActionsTab
      key={`actions-${
        routeModel.focusedWorkflowRunId ??
        routeModel.workflowComposer ??
        (routeModel.workflowFilter || "default")
      }-${routeModel.focusedWorkflowArtifactId ?? "artifact-default"}`}
      repository={repository}
      githubReady={githubReady}
      selectedRef={selectedRef}
      refListLimit={limits.refListLimit}
      actionsLimit={limits.actionsLimit}
      workflowDefinitionLimit={limits.workflowDefinitionLimit}
      focusedWorkflowRunId={routeModel.focusedWorkflowRunId}
      focusedWorkflowArtifactId={routeModel.focusedWorkflowArtifactId}
      initialFilter={routeModel.workflowFilter}
      initialDispatching={routeModel.workflowComposer === "dispatch"}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      onMutate={mutation.onMutate}
      onOpenExternal={onOpenExternal}
      onOpenWorkflowRunCommit={onOpenWorkflowRunCommit}
      onOpenWorkflowCheckSuiteCommit={onOpenWorkflowCheckSuiteCommit}
      onOpenCodePath={openActionsCodePath}
      onSelectWorkflowRun={onSelectWorkflowRun}
      onSelectWorkflowArtifact={onSelectWorkflowArtifact}
      onExpandActions={expansion.onExpandActions}
      onExpandWorkflowDefinitions={expansion.onExpandWorkflowDefinitions}
    />
  );
}

function RepositoryContributorsTabSurface({
  repository,
  routeModel,
  githubReady,
  limits,
  expansion,
  onOpenRepository,
  onOpenExternal,
  onSelectContributor
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <ContributorsTab
      key={`contributors-${routeModel.focusedContributorLogin ?? "default"}`}
      repository={repository}
      githubReady={githubReady}
      contributorLimit={limits.contributorLimit}
      focusedContributorLogin={routeModel.focusedContributorLogin}
      onOpenRepository={onOpenRepository}
      onOpenExternal={onOpenExternal}
      onSelectContributor={onSelectContributor}
      onExpandContributors={expansion.onExpandContributors}
    />
  );
}

function RepositoryAgentsTabSurface({
  repository,
  githubReady,
  limits,
  onOpenExternal,
  onOpenFilteredSurface,
  onSelectIssue,
  onSelectPullRequest,
  onSelectWorkflowRun
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <AgentsTab
      repository={repository}
      githubReady={githubReady}
      issueListLimit={limits.issueListLimit}
      pullRequestListLimit={limits.pullRequestListLimit}
      actionsLimit={limits.actionsLimit}
      onOpenExternal={onOpenExternal}
      onOpenFilteredSurface={onOpenFilteredSurface}
      onSelectIssue={onSelectIssue}
      onSelectPullRequest={onSelectPullRequest}
      onSelectWorkflowRun={onSelectWorkflowRun}
    />
  );
}

function RepositoryWikiTabSurface({
  repository,
  routeModel,
  githubReady,
  mutation,
  onOpenExternal,
  onSelectWikiPage
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <WikiTab
      key={`wiki-${routeModel.focusedWikiPagePath ?? "default"}`}
      repository={repository}
      githubReady={githubReady}
      focusedPagePath={routeModel.focusedWikiPagePath}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      onMutate={mutation.onMutate}
      onOpenExternal={onOpenExternal}
      onSelectWikiPage={onSelectWikiPage}
    />
  );
}

function RepositorySecurityQualityTabSurface({
  repository,
  routeModel,
  githubReady,
  selectedRef,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onOpenCodePath,
  onSelectSecurityItem,
  onSelectSecurityQualityBranch
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  function openSecurityCodePath(path: string, ref: string | null, line?: number | null): void {
    onOpenCodePath(path, "file", ref, null, line);
  }

  return (
    <SecurityQualityTab
      key={`security-quality-${routeModel.focusedSecurityItemKind ?? "default"}-${
        routeModel.focusedSecurityItemId ?? "default"
      }`}
      repository={repository}
      selectedRef={selectedRef}
      refListLimit={limits.refListLimit}
      dependabotAlertsLimit={limits.dependabotAlertsLimit}
      codeScanningAlertsLimit={limits.codeScanningAlertsLimit}
      secretScanningAlertsLimit={limits.secretScanningAlertsLimit}
      repositoryRulesetsLimit={limits.repositoryRulesetsLimit}
      repositorySecurityAdvisoriesLimit={limits.repositorySecurityAdvisoriesLimit}
      githubReady={githubReady}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      focusedSecurityItemKind={routeModel.focusedSecurityItemKind}
      focusedSecurityItemId={routeModel.focusedSecurityItemId}
      onOpenExternal={onOpenExternal}
      onOpenCodePath={openSecurityCodePath}
      onSelectSecurityItem={onSelectSecurityItem}
      onSelectSecurityQualityBranch={onSelectSecurityQualityBranch}
      onExpandDependabotAlerts={expansion.onExpandDependabotAlerts}
      onExpandCodeScanningAlerts={expansion.onExpandCodeScanningAlerts}
      onExpandSecretScanningAlerts={expansion.onExpandSecretScanningAlerts}
      onExpandRepositoryRulesets={expansion.onExpandRepositoryRulesets}
      onExpandRepositorySecurityAdvisories={expansion.onExpandRepositorySecurityAdvisories}
      onMutate={mutation.onMutate}
    />
  );
}

function RepositorySettingsTabSurface({
  repository,
  routeModel,
  githubReady,
  selectedRef,
  limits,
  mutation,
  expansion,
  onOpenExternal,
  onOpenRepository,
  onOpenTeam,
  onSelectSettingsCollaborator,
  tabPreferences,
  onSaveTabPreferences
}: RepositoryActiveTabSurfaceProps): JSX.Element {
  return (
    <RepositorySettingsTab
      key={repositorySettingsTabKey(repository)}
      repository={repository}
      githubReady={githubReady}
      selectedRef={selectedRef}
      refListLimit={limits.refListLimit}
      repositoryRulesetsLimit={limits.repositoryRulesetsLimit}
      repositoryAccessLimit={limits.repositoryAccessLimit}
      focusedCollaboratorLogin={routeModel.focusedSettingsCollaboratorLogin}
      forksLimit={limits.forksLimit}
      saving={mutation.pending && mutation.action === "editRepository"}
      saveSucceeded={mutation.succeeded && mutation.action === "editRepository"}
      saveError={mutation.action === "editRepository" ? mutation.error : null}
      mutationAction={mutation.action}
      mutationPending={mutation.pending}
      mutationSucceeded={mutation.succeeded}
      mutationError={mutation.error}
      tabPreferences={tabPreferences}
      onMutate={mutation.onMutate}
      onTabPreferencesChange={onSaveTabPreferences}
      onOpenExternal={onOpenExternal}
      onOpenRepository={onOpenRepository}
      onOpenTeam={onOpenTeam}
      onSelectCollaborator={onSelectSettingsCollaborator}
      onExpandForks={expansion.onExpandForks}
      onExpandRepositoryAccess={expansion.onExpandRepositoryAccess}
    />
  );
}

const repositoryTabSurfaceComponents = {
  code: RepositoryCodeTabSurface,
  issues: RepositoryIssuesTabSurface,
  pulls: RepositoryPullRequestsTabSurface,
  discussions: RepositoryDiscussionsTabSurface,
  projects: RepositoryProjectsTabSurface,
  releases: RepositoryReleasesTabSurface,
  contributors: RepositoryContributorsTabSurface,
  agents: RepositoryAgentsTabSurface,
  actions: RepositoryActionsTabSurface,
  wiki: RepositoryWikiTabSurface,
  securityQuality: RepositorySecurityQualityTabSurface,
  settings: RepositorySettingsTabSurface
} satisfies Record<RepositoryTab, RepositoryTabSurfaceComponent>;
