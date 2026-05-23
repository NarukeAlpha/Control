import type { JSX } from "react";

import type { GitHubAction, GitHubMutationFields, GitHubMutationInput } from "@shared/github";
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
  onOpenExternal(url: string): void;
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
  onOpenExternal
}: RepositoryRouteSectionProps): JSX.Element | null {
  const {
    isRepositoryRoute,
    effectiveRepository,
    owner,
    repo,
    repositoryContextValue,
    codeBrowserRef,
    contentsRef,
    repository,
    repositoryDetail,
    repositoryAvailabilityMessage,
    branches,
    tags,
    branchItems,
    tagItems,
    refsAvailabilityMessage,
    refsError,
    codeTabQueries,
    codeBrowserQueries,
    releases,
    releaseItems,
    releasesAvailability,
    contributors,
    contributorItems,
    contributorsAvailability
  } = routeState;
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
    repositoryCommitHistoryLimit,
    fileCommitHistoryLimit,
    fileBlameRangeLimit,
    expandActiveRepositoryRefs,
    expandRepositoryCommitHistory,
    expandFileCommitHistory,
    expandFileBlamePreview,
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
  } = routeState.limits;
  const { repositoryCommits, repositoryCommitItems, repositoryCommitsAvailability } = codeTabQueries;
  const {
    codeBrowserContents,
    fileContent,
    fileBlame,
    fileCommits,
    contentItems,
    contentsAvailability,
    fileCommitItems,
    fileCommitsAvailability,
    fileContentItem,
    fileContentAvailabilityMessage
  } = codeBrowserQueries;
  const { refreshRepositoryDetailNow, refreshCodeBrowserNow, refreshRepositorySurface } =
    routeState.refreshActions;

  const repositoryRightRail = isRepositoryRoute ? (
    <RightRail
      repository={repositoryDetail ?? undefined}
      selectedRef={contentsRef}
      commits={repositoryCommitItems}
      commitsLimit={repositoryCommitHistoryLimit}
      commitsLoading={repositoryCommits.isLoading || repositoryCommits.isFetching}
      commitsError={repositoryCommits.error}
      commitsAvailability={repositoryCommitsAvailability}
      releases={releaseItems}
      releasesLoading={releases.isLoading || releases.isFetching}
      releasesAvailability={releasesAvailability}
      releasesError={releases.error}
      contributors={contributorItems}
      contributorsLoading={contributors.isLoading || contributors.isFetching}
      contributorsAvailability={contributorsAvailability}
      contributorsError={contributors.error}
      onExpandCommits={expandRepositoryCommitHistory}
      onOpenCommit={(commit) =>
        navigation.openCommitInApp({
          nameWithOwner: effectiveRepository,
          commit,
          path: "",
          entryType: "dir"
        })
      }
      onOpenReleasesTab={() => navigation.selectRepositoryTabInApp(effectiveRepository, "releases")}
      onOpenContributorsTab={() => navigation.selectRepositoryTabInApp(effectiveRepository, "contributors")}
      onOpenSettingsTab={() => navigation.selectRepositoryTabInApp(effectiveRepository, "settings")}
      onOpenRelease={(release) => navigation.selectReleaseInApp(effectiveRepository, release)}
      onOpenContributor={(contributor) => navigation.selectContributorInApp(effectiveRepository, contributor)}
      onOpenExternal={onOpenExternal}
    />
  ) : null;

  const withRepositoryContext = (node: JSX.Element): JSX.Element =>
    repositoryContextValue ? (
      <RepositoryContextProvider value={repositoryContextValue}>{node}</RepositoryContextProvider>
    ) : (
      node
    );

  const onMutate = (action: GitHubAction, dangerous: boolean, payload: GitHubMutationFields = {}): void => {
    if (dangerous && !window.confirm(`Run ${githubActionLabel(action)} on ${owner}/${repo}?`)) {
      return;
    }
    mutation.reset();
    mutation.mutate(createGitHubMutationInput(action, owner, repo, payload));
  };

  return (
    <>
      {route.kind === "repository" &&
        withRepositoryContext(
          <RepositoryPage
            key={effectiveRepository}
            repository={repositoryDetail ?? undefined}
            availabilityMessage={repositoryAvailabilityMessage}
            githubReady={githubReady}
            selectedRef={contentsRef}
            limits={{
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
            }}
            contributorCount={contributorItems.length}
            loading={repository.isLoading}
            pinned={isRepositoryPinned(effectiveRepository)}
            pinBusy={repositoryPinBusy}
            pinError={repositoryPinError}
            error={repository.error}
            onOpenCodeBrowser={(entry) =>
              navigation.openCodeBrowserInApp(
                effectiveRepository,
                entry.path,
                entry.type === "dir" ? "dir" : "file",
                contentsRef ?? repositoryDetail?.defaultBranch ?? null
              )
            }
            onOpenReleaseTarget={(ref) =>
              navigation.selectRepositoryRefInApp(
                effectiveRepository,
                ref,
                navigation.repositoryRefKindForName(ref),
                {
                  path: "",
                  entryType: "dir"
                }
              )
            }
            onOpenPullRequestCommit={(commit, targetRepositoryNameWithOwner) =>
              navigation.openPullRequestCommitInApp(commit, targetRepositoryNameWithOwner)
            }
            onOpenPullRequestReviewCommit={navigation.openPullRequestReviewCommitInApp}
            onOpenPullRequestTimelineEventCommit={navigation.openPullRequestTimelineEventCommitInApp}
            onOpenWorkflowRunCommit={navigation.openWorkflowRunCommitInApp}
            onOpenWorkflowCheckSuiteCommit={navigation.openWorkflowCheckSuiteCommitInApp}
            onOpenCodePath={navigation.openCodePathInApp}
            onOpenExternal={onOpenExternal}
            onOpenRepository={navigation.openRepositoryInApp}
            onOpenTeam={navigation.openTeamInApp}
            onRefresh={() => refreshRepositorySurface()}
            onOpenFileFinder={dialogs.openFileFinder}
            onSelectTab={(tab) => navigation.selectRepositoryTabInApp(effectiveRepository, tab)}
            onOpenFilteredSurface={(tab, filter) =>
              navigation.openFilteredRepositorySurfaceInApp(effectiveRepository, tab, filter)
            }
            onSelectIssue={(issue) => navigation.selectIssueInApp(effectiveRepository, issue)}
            onSelectPullRequest={(pullRequest) =>
              navigation.selectPullRequestInApp(effectiveRepository, pullRequest)
            }
            onOpenIssueReference={navigation.openLinkedIssueInApp}
            onSelectDiscussion={(discussion) =>
              navigation.selectDiscussionInApp(effectiveRepository, discussion)
            }
            onSelectProject={(project) => navigation.selectProjectInApp(effectiveRepository, project)}
            onSelectRelease={(release) => navigation.selectReleaseInApp(effectiveRepository, release)}
            onSelectReleaseAsset={(release, asset) =>
              navigation.selectReleaseAssetInApp(effectiveRepository, release, asset)
            }
            onSelectWorkflowRun={(run) => navigation.selectWorkflowRunInApp(effectiveRepository, run)}
            onSelectWorkflowArtifact={(run, artifact) =>
              navigation.selectWorkflowArtifactInApp(effectiveRepository, run, artifact)
            }
            onSelectSecurityItem={(securityItem) =>
              navigation.selectSecurityItemInApp(effectiveRepository, securityItem)
            }
            onSelectWikiPage={(page) => navigation.selectWikiPageInApp(effectiveRepository, page)}
            onOpenWorkflowRun={(runId, url) =>
              navigation.openWorkflowRunReferenceInApp(effectiveRepository, runId, url)
            }
            onSelectContributor={(contributor) =>
              navigation.selectContributorInApp(effectiveRepository, contributor)
            }
            onSelectSecurityQualityBranch={(ref) =>
              navigation.selectSecurityQualityBranchInApp(effectiveRepository, ref)
            }
            onSelectSettingsCollaborator={(collaborator) =>
              navigation.selectRepositorySettingsCollaboratorInApp(effectiveRepository, collaborator)
            }
            onSelectRef={(ref) =>
              navigation.selectRepositoryRefInApp(
                effectiveRepository,
                ref,
                ref ? navigation.repositoryRefKindForName(ref) : "ref"
              )
            }
            expansion={{
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
              onExpandDependabotAlerts: () => expandActiveRepositorySecurityList("dependabot"),
              onExpandCodeScanningAlerts: () => expandActiveRepositorySecurityList("codeScanning"),
              onExpandSecretScanningAlerts: () => expandActiveRepositorySecurityList("secretScanning"),
              onExpandRepositoryRulesets: () => expandActiveRepositorySecurityList("rulesets"),
              onExpandRepositorySecurityAdvisories: () => expandActiveRepositorySecurityList("advisories")
            }}
            onTogglePin={() => toggleRepositoryPin(effectiveRepository)}
            mutation={{
              action: mutation.variables?.action ?? null,
              pending: mutation.isPending,
              succeeded: mutation.isSuccess,
              error: mutation.error instanceof Error ? mutation.error : null,
              onMutate
            }}
            rightRail={repositoryRightRail}
          />
        )}

      {route.kind === "codeBrowser" &&
        withRepositoryContext(
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
            fileBlame={fileBlame.data}
            fileBlameRangeLimit={fileBlameRangeLimit}
            fileBlameLoading={fileBlame.isLoading || fileBlame.isFetching}
            fileBlameError={fileBlame.error}
            commits={fileCommitItems}
            commitsLimit={fileCommitHistoryLimit}
            commitsLoading={fileCommits.isLoading || fileCommits.isFetching}
            commitsError={fileCommits.error}
            commitsAvailability={fileCommitsAvailability}
            error={
              repository.error ??
              codeBrowserContents.error ??
              fileContent.error ??
              fileBlame.error ??
              fileCommits.error
            }
            onRefresh={() => {
              return Promise.all([refreshRepositoryDetailNow(), refreshCodeBrowserNow()]);
            }}
            onBackToRepository={() => {
              if (codeBrowserRef) {
                navigation.selectRepositoryRefInApp(
                  effectiveRepository,
                  codeBrowserRef,
                  navigation.repositoryRefKindForName(codeBrowserRef)
                );
                return;
              }
              navigation.openRepositoryInApp(effectiveRepository, "code");
            }}
            onOpenCodeBrowser={(path, entryType, refOverride, line) =>
              navigation.openCodeBrowserInApp(
                effectiveRepository,
                path,
                entryType,
                refOverride ?? codeBrowserRef ?? repositoryDetail?.defaultBranch ?? null,
                line ?? route.line
              )
            }
            onOpenCommit={(commit, path, entryType, line) =>
              navigation.openCommitInApp({
                nameWithOwner: effectiveRepository,
                commit,
                path,
                entryType,
                line
              })
            }
            onSelectRef={(ref) =>
              navigation.selectRepositoryRefInApp(
                effectiveRepository,
                ref,
                navigation.repositoryRefKindForName(ref),
                {
                  path: route.path,
                  entryType: route.entryType,
                  line: route.line
                }
              )
            }
            onExpandFileBlamePreview={expandFileBlamePreview}
            onExpandCommits={expandFileCommitHistory}
            onOpenExternal={onOpenExternal}
          />
        )}

      {route.kind === "codeBrowser" && repositoryRightRail}
    </>
  );
}
