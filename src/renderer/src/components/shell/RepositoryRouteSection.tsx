import type { ComponentProps, JSX } from "react";

import type {
  GitHubAction,
  GitHubMutationFields,
  GitHubMutationInput,
  RepositoryTabPreferenceKey,
  RepositoryTabPreferenceMap
} from "@shared/github";
import { CodeBrowserPage } from "../code-browser/CodeBrowserPage";
import { RepositoryContextProvider } from "../repository/RepositoryContext";
import { RepositoryPage } from "../repository/RepositoryPage";
import { createGitHubMutationInput } from "../repository/githubMutationHelpers";
import { githubActionLabel } from "../repository/repositoryUi";
import { RightRail } from "../right-rail/RightRail";
import type { useAppNavigationActions } from "../../hooks/useAppNavigationActions";
import type { useRepositoryRouteState } from "../../hooks/useRepositoryRouteState";
import type { AppRoute } from "../../stores/uiStore";
import type { ShellDialogState } from "./useShellDialogState";

interface GitHubMutationController {
  variables?: GitHubMutationInput;
  isPending: boolean;
  isSuccess: boolean;
  error: unknown;
  reset(): void;
  mutate(input: GitHubMutationInput): void;
}

interface RepositoryRouteSectionProps {
  route: AppRoute;
  githubReady: boolean;
  routeState: ReturnType<typeof useRepositoryRouteState>;
  navigation: ReturnType<typeof useAppNavigationActions>;
  dialogs: ShellDialogState;
  mutation: GitHubMutationController;
  repositoryPinBusy: boolean;
  repositoryPinError: Error | null;
  isRepositoryPinned(nameWithOwner: string): boolean;
  toggleRepositoryPin(nameWithOwner: string): void;
  onShowRepositoryTab(tab: RepositoryTabPreferenceKey): void;
  onSaveRepositoryTabPreferences(
    nameWithOwner: string,
    preferences: RepositoryTabPreferenceMap
  ): Promise<void>;
  onOpenExternal(url: string): void;
}

type RepositoryRouteState = ReturnType<typeof useRepositoryRouteState>;
type RepositoryNavigation = ReturnType<typeof useAppNavigationActions>;
type RepositoryPageProps = ComponentProps<typeof RepositoryPage>;
type CodeBrowserPageProps = ComponentProps<typeof CodeBrowserPage>;
type CodeBrowserRoute = Extract<AppRoute, { kind: "codeBrowser" }>;

function RepositoryRouteContextFrame({
  value,
  children
}: {
  value: RepositoryRouteState["repositoryContextValue"];
  children: JSX.Element;
}): JSX.Element {
  return value ? <RepositoryContextProvider value={value}>{children}</RepositoryContextProvider> : children;
}

function RepositoryRouteRightRail({
  enabled,
  routeState,
  navigation,
  onOpenExternal
}: {
  enabled: boolean;
  routeState: RepositoryRouteState;
  navigation: RepositoryNavigation;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (!enabled) {
    return null;
  }

  const {
    effectiveRepository,
    repositoryDetail,
    repositoryTabVisibility,
    releases,
    releaseItems,
    releasesAvailability,
    contributors,
    contributorItems,
    contributorsAvailability
  } = routeState;

  function openReleasesTab(): void {
    navigation.selectRepositoryTabInApp(effectiveRepository, "releases");
  }

  function openContributorsTab(): void {
    navigation.selectRepositoryTabInApp(effectiveRepository, "contributors");
  }

  function openSettingsTab(): void {
    navigation.selectRepositoryTabInApp(effectiveRepository, "settings");
  }

  const openRelease: ComponentProps<typeof RightRail>["onOpenRelease"] = (release) => {
    navigation.selectReleaseInApp(effectiveRepository, release);
  };

  const openContributor: ComponentProps<typeof RightRail>["onOpenContributor"] = (contributor) => {
    navigation.selectContributorInApp(effectiveRepository, contributor);
  };

  return (
    <RightRail
      repository={repositoryDetail ?? undefined}
      releases={releaseItems}
      releasesLoading={releases.isLoading || releases.isFetching}
      releasesAvailability={releasesAvailability}
      releasesError={releases.error}
      showReleases={repositoryTabVisibility.queryGates.releases}
      contributors={contributorItems}
      contributorsLoading={contributors.isLoading || contributors.isFetching}
      contributorsAvailability={contributorsAvailability}
      contributorsError={contributors.error}
      showContributors={repositoryTabVisibility.queryGates.contributors}
      showSettings={repositoryTabVisibility.queryGates.settings}
      onOpenReleasesTab={openReleasesTab}
      onOpenContributorsTab={openContributorsTab}
      onOpenSettingsTab={openSettingsTab}
      onOpenRelease={openRelease}
      onOpenContributor={openContributor}
      onOpenExternal={onOpenExternal}
    />
  );
}

function createRepositoryPageLimits(limits: RepositoryRouteState["limits"]): RepositoryPageProps["limits"] {
  const {
    repositoryRefListLimit,
    repositoryContributorLimit,
    forksLimit,
    repositoryAccessLimit,
    actionsLimit,
    workflowDefinitionLimit,
    projectsLimit,
    releasesLimit,
    discussionsLimit,
    issueListLimit,
    pullRequestListLimit,
    dependabotAlertsLimit,
    codeScanningAlertsLimit,
    secretScanningAlertsLimit,
    repositoryRulesetsLimit,
    repositorySecurityAdvisoriesLimit,
    repositoryCommitHistoryLimit
  } = limits;

  return {
    refListLimit: repositoryRefListLimit,
    codeCommitHistoryLimit: repositoryCommitHistoryLimit,
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
    contributorLimit: repositoryContributorLimit
  };
}

function createRepositoryPageExpansion(
  limits: RepositoryRouteState["limits"]
): RepositoryPageProps["expansion"] {
  const {
    expandActiveRepositoryRefs,
    expandActiveRepositoryContributors,
    expandActiveRepositoryForks,
    expandActiveRepositoryAccess,
    expandActiveRepositoryActions,
    expandActiveRepositoryWorkflowDefinitions,
    expandActiveRepositoryProjects,
    expandActiveRepositoryReleases,
    expandActiveRepositoryDiscussions,
    expandActiveRepositoryIssues,
    expandActiveRepositoryPullRequests,
    expandActiveRepositorySecurityList
  } = limits;

  function expandDependabotAlerts(): void {
    expandActiveRepositorySecurityList("dependabot");
  }

  function expandCodeScanningAlerts(): void {
    expandActiveRepositorySecurityList("codeScanning");
  }

  function expandSecretScanningAlerts(): void {
    expandActiveRepositorySecurityList("secretScanning");
  }

  function expandRepositoryRulesets(): void {
    expandActiveRepositorySecurityList("rulesets");
  }

  function expandRepositorySecurityAdvisories(): void {
    expandActiveRepositorySecurityList("advisories");
  }

  return {
    onExpandRefs: expandActiveRepositoryRefs,
    onExpandIssues: expandActiveRepositoryIssues,
    onExpandPullRequests: expandActiveRepositoryPullRequests,
    onExpandContributors: expandActiveRepositoryContributors,
    onExpandForks: expandActiveRepositoryForks,
    onExpandRepositoryAccess: expandActiveRepositoryAccess,
    onExpandActions: expandActiveRepositoryActions,
    onExpandWorkflowDefinitions: expandActiveRepositoryWorkflowDefinitions,
    onExpandProjects: expandActiveRepositoryProjects,
    onExpandReleases: expandActiveRepositoryReleases,
    onExpandDiscussions: expandActiveRepositoryDiscussions,
    onExpandDependabotAlerts: expandDependabotAlerts,
    onExpandCodeScanningAlerts: expandCodeScanningAlerts,
    onExpandSecretScanningAlerts: expandSecretScanningAlerts,
    onExpandRepositoryRulesets: expandRepositoryRulesets,
    onExpandRepositorySecurityAdvisories: expandRepositorySecurityAdvisories
  };
}

function createRepositoryPageMutationState({
  owner,
  repo,
  dialogs,
  mutation
}: {
  owner: string;
  repo: string;
  dialogs: ShellDialogState;
  mutation: GitHubMutationController;
}): RepositoryPageProps["mutation"] {
  const mutate: RepositoryPageProps["mutation"]["onMutate"] = (
    action: GitHubAction,
    dangerous: boolean,
    payload: GitHubMutationFields = {}
  ): void => {
    void confirmAndMutate(action, dangerous, payload);
  };

  async function confirmAndMutate(
    action: GitHubAction,
    dangerous: boolean,
    payload: GitHubMutationFields
  ): Promise<void> {
    if (
      dangerous &&
      !(await dialogs.requestConfirmation({
        title: githubActionLabel(action),
        message: `Run this GitHub mutation on ${owner}/${repo}?`,
        confirmLabel: "Run mutation",
        tone: "danger"
      }))
    ) {
      return;
    }
    mutation.reset();
    mutation.mutate(createGitHubMutationInput(action, owner, repo, payload));
  }

  return {
    action: mutation.variables?.action ?? null,
    pending: mutation.isPending,
    succeeded: mutation.isSuccess,
    error: mutation.error instanceof Error ? mutation.error : null,
    onMutate: mutate
  };
}

function RepositoryPageRoute({
  githubReady,
  routeState,
  navigation,
  dialogs,
  mutation,
  repositoryPinBusy,
  repositoryPinError,
  isRepositoryPinned,
  toggleRepositoryPin,
  onShowRepositoryTab,
  onSaveRepositoryTabPreferences,
  onOpenExternal,
  rightRail
}: {
  githubReady: boolean;
  routeState: RepositoryRouteState;
  navigation: RepositoryNavigation;
  dialogs: ShellDialogState;
  mutation: GitHubMutationController;
  repositoryPinBusy: boolean;
  repositoryPinError: Error | null;
  isRepositoryPinned(nameWithOwner: string): boolean;
  toggleRepositoryPin(nameWithOwner: string): void;
  onShowRepositoryTab(tab: RepositoryTabPreferenceKey): void;
  onSaveRepositoryTabPreferences(
    nameWithOwner: string,
    preferences: RepositoryTabPreferenceMap
  ): Promise<void>;
  onOpenExternal(url: string): void;
  rightRail: RepositoryPageProps["rightRail"];
}): JSX.Element {
  const {
    effectiveRepository,
    owner,
    repo,
    contentsRef,
    repository,
    repositoryDetail,
    repositoryTabVisibility,
    effectiveRepositoryTabPreferences,
    repositoryAvailabilityMessage,
    contributorItems
  } = routeState;
  const { refreshRepositorySurface } = routeState.refreshActions;

  const openCodeBrowser: RepositoryPageProps["onOpenCodeBrowser"] = (entry) => {
    navigation.openCodeBrowserInApp(
      effectiveRepository,
      entry.path,
      entry.type === "dir" ? "dir" : "file",
      contentsRef ?? repositoryDetail?.defaultBranch ?? null
    );
  };

  const openReleaseTarget: RepositoryPageProps["onOpenReleaseTarget"] = (ref) => {
    navigation.selectRepositoryRefInApp(effectiveRepository, ref, navigation.repositoryRefKindForName(ref), {
      path: "",
      entryType: "dir"
    });
  };

  const openPullRequestCommit: RepositoryPageProps["onOpenPullRequestCommit"] = (
    commit,
    targetRepositoryNameWithOwner
  ) => {
    navigation.openPullRequestCommitInApp(commit, targetRepositoryNameWithOwner);
  };

  const refreshRepository: RepositoryPageProps["onRefresh"] = () => refreshRepositorySurface();

  const selectTab: RepositoryPageProps["onSelectTab"] = (tab) => {
    navigation.selectRepositoryTabInApp(effectiveRepository, tab);
  };

  const saveTabPreferences: RepositoryPageProps["onSaveTabPreferences"] = (preferences) =>
    onSaveRepositoryTabPreferences(effectiveRepository, preferences);

  const openFilteredSurface: RepositoryPageProps["onOpenFilteredSurface"] = (tab, filter) => {
    navigation.openFilteredRepositorySurfaceInApp(effectiveRepository, tab, filter);
  };

  const selectIssue: RepositoryPageProps["onSelectIssue"] = (issue) => {
    navigation.selectIssueInApp(effectiveRepository, issue);
  };

  const selectPullRequest: RepositoryPageProps["onSelectPullRequest"] = (pullRequest) => {
    navigation.selectPullRequestInApp(effectiveRepository, pullRequest);
  };

  const selectDiscussion: RepositoryPageProps["onSelectDiscussion"] = (discussion) => {
    navigation.selectDiscussionInApp(effectiveRepository, discussion);
  };

  const selectProject: RepositoryPageProps["onSelectProject"] = (project) => {
    navigation.selectProjectInApp(effectiveRepository, project);
  };

  const selectRelease: RepositoryPageProps["onSelectRelease"] = (release) => {
    navigation.selectReleaseInApp(effectiveRepository, release);
  };

  const selectReleaseAsset: RepositoryPageProps["onSelectReleaseAsset"] = (release, asset) => {
    navigation.selectReleaseAssetInApp(effectiveRepository, release, asset);
  };

  const selectWorkflowRun: RepositoryPageProps["onSelectWorkflowRun"] = (run) => {
    navigation.selectWorkflowRunInApp(effectiveRepository, run);
  };

  const selectWorkflowArtifact: RepositoryPageProps["onSelectWorkflowArtifact"] = (run, artifact) => {
    navigation.selectWorkflowArtifactInApp(effectiveRepository, run, artifact);
  };

  const selectSecurityItem: RepositoryPageProps["onSelectSecurityItem"] = (securityItem) => {
    navigation.selectSecurityItemInApp(effectiveRepository, securityItem);
  };

  const selectWikiPage: RepositoryPageProps["onSelectWikiPage"] = (page) => {
    navigation.selectWikiPageInApp(effectiveRepository, page);
  };

  const openWorkflowRun: RepositoryPageProps["onOpenWorkflowRun"] = (runId, url) => {
    navigation.openWorkflowRunReferenceInApp(effectiveRepository, runId, url);
  };

  const selectContributor: RepositoryPageProps["onSelectContributor"] = (contributor) => {
    navigation.selectContributorInApp(effectiveRepository, contributor);
  };

  const selectSecurityQualityBranch: RepositoryPageProps["onSelectSecurityQualityBranch"] = (ref) => {
    navigation.selectSecurityQualityBranchInApp(effectiveRepository, ref);
  };

  const selectSettingsCollaborator: RepositoryPageProps["onSelectSettingsCollaborator"] = (collaborator) => {
    navigation.selectRepositorySettingsCollaboratorInApp(effectiveRepository, collaborator);
  };

  const selectRef: RepositoryPageProps["onSelectRef"] = (ref) => {
    navigation.selectRepositoryRefInApp(
      effectiveRepository,
      ref,
      ref ? navigation.repositoryRefKindForName(ref) : "ref"
    );
  };

  const togglePin: RepositoryPageProps["onTogglePin"] = () => {
    toggleRepositoryPin(effectiveRepository);
  };

  return (
    <RepositoryPage
      key={effectiveRepository}
      repository={repositoryDetail ?? undefined}
      availabilityMessage={repositoryAvailabilityMessage}
      githubReady={githubReady}
      selectedRef={contentsRef}
      limits={createRepositoryPageLimits(routeState.limits)}
      contributorCount={contributorItems.length}
      loading={repository.isLoading}
      pinned={isRepositoryPinned(effectiveRepository)}
      pinBusy={repositoryPinBusy}
      pinError={repositoryPinError}
      error={repository.error}
      tabVisibility={repositoryTabVisibility}
      tabPreferences={effectiveRepositoryTabPreferences}
      onOpenCodeBrowser={openCodeBrowser}
      onOpenReleaseTarget={openReleaseTarget}
      onOpenPullRequestCommit={openPullRequestCommit}
      onOpenPullRequestReviewCommit={navigation.openPullRequestReviewCommitInApp}
      onOpenPullRequestTimelineEventCommit={navigation.openPullRequestTimelineEventCommitInApp}
      onOpenWorkflowRunCommit={navigation.openWorkflowRunCommitInApp}
      onOpenWorkflowCheckSuiteCommit={navigation.openWorkflowCheckSuiteCommitInApp}
      onOpenCodePath={navigation.openCodePathInApp}
      onOpenExternal={onOpenExternal}
      onOpenRepository={navigation.openRepositoryInApp}
      onOpenTeam={navigation.openTeamInApp}
      onRefresh={refreshRepository}
      onOpenFileFinder={dialogs.openFileFinder}
      onSelectTab={selectTab}
      onShowHiddenTab={onShowRepositoryTab}
      onSaveTabPreferences={saveTabPreferences}
      onOpenFilteredSurface={openFilteredSurface}
      onSelectIssue={selectIssue}
      onSelectPullRequest={selectPullRequest}
      onOpenIssueReference={navigation.openLinkedIssueInApp}
      onSelectDiscussion={selectDiscussion}
      onSelectProject={selectProject}
      onSelectRelease={selectRelease}
      onSelectReleaseAsset={selectReleaseAsset}
      onSelectWorkflowRun={selectWorkflowRun}
      onSelectWorkflowArtifact={selectWorkflowArtifact}
      onSelectSecurityItem={selectSecurityItem}
      onSelectWikiPage={selectWikiPage}
      onOpenWorkflowRun={openWorkflowRun}
      onSelectContributor={selectContributor}
      onSelectSecurityQualityBranch={selectSecurityQualityBranch}
      onSelectSettingsCollaborator={selectSettingsCollaborator}
      onSelectRef={selectRef}
      expansion={createRepositoryPageExpansion(routeState.limits)}
      onTogglePin={togglePin}
      mutation={createRepositoryPageMutationState({ owner, repo, dialogs, mutation })}
      rightRail={rightRail}
    />
  );
}

function CodeBrowserRoutePage({
  route,
  githubReady,
  routeState,
  navigation,
  onOpenExternal
}: {
  route: CodeBrowserRoute;
  githubReady: boolean;
  routeState: RepositoryRouteState;
  navigation: RepositoryNavigation;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const {
    effectiveRepository,
    codeBrowserRef,
    repository,
    repositoryDetail,
    branches,
    tags,
    branchItems,
    tagItems,
    refsAvailabilityMessage,
    refsError,
    codeBrowserQueries,
    repositoryAvailabilityMessage
  } = routeState;
  const {
    codeBrowserContents,
    fileContent,
    fileCommits,
    contentItems,
    contentsAvailability,
    fileCommitItems,
    fileCommitsAvailability,
    fileContentItem,
    fileContentAvailabilityMessage
  } = codeBrowserQueries;
  const { fileCommitHistoryLimit, expandFileCommitHistory } = routeState.limits;
  const { refreshRepositoryDetailNow, refreshCodeBrowserNow } = routeState.refreshActions;

  const refreshCodeBrowser: CodeBrowserPageProps["onRefresh"] = () => {
    return Promise.all([refreshRepositoryDetailNow(), refreshCodeBrowserNow()]);
  };

  const openCodeBrowser: CodeBrowserPageProps["onOpenCodeBrowser"] = (path, entryType, refOverride, line) => {
    navigation.openCodeBrowserInApp(
      effectiveRepository,
      path,
      entryType,
      refOverride ?? codeBrowserRef ?? repositoryDetail?.defaultBranch ?? null,
      line ?? route.line
    );
  };

  const openCommit: CodeBrowserPageProps["onOpenCommit"] = (commit, path, entryType, line) => {
    navigation.openCommitInApp({
      nameWithOwner: effectiveRepository,
      commit,
      path,
      entryType,
      line
    });
  };

  const selectRef: CodeBrowserPageProps["onSelectRef"] = (ref) => {
    navigation.selectRepositoryRefInApp(effectiveRepository, ref, navigation.repositoryRefKindForName(ref), {
      path: route.path,
      entryType: route.entryType,
      line: route.line
    });
  };

  return (
    <CodeBrowserPage
      repository={repositoryDetail ?? undefined}
      availabilityMessage={repositoryAvailabilityMessage}
      githubReady={githubReady}
      route={route}
      branches={branchItems}
      tags={tagItems}
      refsLoading={branches.isLoading || branches.isFetching || tags.isLoading || tags.isFetching}
      refsError={refsError}
      refsAvailabilityMessage={refsAvailabilityMessage || null}
      contents={contentItems}
      contentsLoading={codeBrowserContents.isLoading || codeBrowserContents.isFetching}
      contentsError={codeBrowserContents.error}
      contentsAvailability={contentsAvailability}
      fileContent={fileContentItem ?? undefined}
      fileLoading={fileContent.isLoading || fileContent.isFetching}
      fileError={fileContent.error}
      fileAvailabilityMessage={fileContentAvailabilityMessage}
      commits={fileCommitItems}
      commitsLimit={fileCommitHistoryLimit}
      commitsLoading={fileCommits.isLoading || fileCommits.isFetching}
      commitsError={fileCommits.error}
      commitsAvailability={fileCommitsAvailability}
      error={repository.error ?? codeBrowserContents.error ?? fileContent.error ?? fileCommits.error}
      onRefresh={refreshCodeBrowser}
      onOpenCodeBrowser={openCodeBrowser}
      onOpenCommit={openCommit}
      onSelectRef={selectRef}
      onExpandCommits={expandFileCommitHistory}
      onOpenExternal={onOpenExternal}
    />
  );
}

export function RepositoryRouteSection({
  route,
  githubReady,
  routeState,
  navigation,
  dialogs,
  mutation,
  repositoryPinBusy,
  repositoryPinError,
  isRepositoryPinned,
  toggleRepositoryPin,
  onShowRepositoryTab,
  onSaveRepositoryTabPreferences,
  onOpenExternal
}: RepositoryRouteSectionProps): JSX.Element | null {
  const repositoryRightRail = (
    <RepositoryRouteRightRail
      enabled={routeState.isRepositoryRoute}
      routeState={routeState}
      navigation={navigation}
      onOpenExternal={onOpenExternal}
    />
  );

  return (
    <>
      {route.kind === "repository" && (
        <RepositoryRouteContextFrame value={routeState.repositoryContextValue}>
          <RepositoryPageRoute
            githubReady={githubReady}
            routeState={routeState}
            navigation={navigation}
            dialogs={dialogs}
            mutation={mutation}
            repositoryPinBusy={repositoryPinBusy}
            repositoryPinError={repositoryPinError}
            isRepositoryPinned={isRepositoryPinned}
            toggleRepositoryPin={toggleRepositoryPin}
            onShowRepositoryTab={onShowRepositoryTab}
            onSaveRepositoryTabPreferences={onSaveRepositoryTabPreferences}
            onOpenExternal={onOpenExternal}
            rightRail={repositoryRightRail}
          />
        </RepositoryRouteContextFrame>
      )}

      {route.kind === "codeBrowser" && (
        <RepositoryRouteContextFrame value={routeState.repositoryContextValue}>
          <CodeBrowserRoutePage
            route={route}
            githubReady={githubReady}
            routeState={routeState}
            navigation={navigation}
            onOpenExternal={onOpenExternal}
          />
        </RepositoryRouteContextFrame>
      )}

      {route.kind === "codeBrowser" && repositoryRightRail}
    </>
  );
}
