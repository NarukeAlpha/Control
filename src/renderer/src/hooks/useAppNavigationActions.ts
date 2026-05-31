import { useMemo, type Dispatch, type SetStateAction } from "react";

import type {
  ContributorSummary,
  DiscussionSummary,
  IssueSummary,
  NotificationSummary,
  OrganizationSummary,
  ProjectSummary,
  PullRequestReviewSummary,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  ReleaseAssetSummary,
  ReleaseSummary,
  RepositoryCollaboratorSummary,
  RepositoryDetail,
  RepositorySummary,
  TeamSummary,
  WorkflowRunArtifactSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import type { AreaFileEntry, AreaRepositorySummary } from "@shared/areas";
import type { LocalRecentItem, LocalRecentRecordInput } from "@shared/local";
import { notificationInAppTarget, notificationTargetUrl } from "../components/collection/notificationUi";
import { normalizeCodeLineNumber } from "../components/code-browser/codeBrowserUi";
import {
  notificationCommitRecentCommit,
  pullRequestReviewCommitRecentCommit,
  pullRequestTimelineEventCommitRecentCommit,
  workflowCheckSuiteCommitRecentCommit,
  workflowRunCommitRecentCommit,
  type CommitRecentCommit
} from "../components/repository/commitRecent";
import {
  parseGitHubBlobUrl,
  repositoryNameWithOwnerFromGitHubUrl
} from "../components/repository/githubUrlRoutes";
import { createMarkdownUrlHandler } from "../components/repository/markdownUrlNavigation";
import { openRecentItemInApp } from "../components/recent/openRecentItem";
import {
  commitRecentInput,
  contributorRecentInput,
  discussionRecentInput,
  fileRecentInput,
  issueRecentInput,
  linkedIssueRecentInput,
  notificationRecentInput,
  organizationProjectRecentInput,
  projectRecentInput,
  pullRequestRecentInput,
  releaseAssetRecentInput,
  releaseRecentInput,
  repositoryRecentInput,
  securityItemRecentInput,
  teamRecentInput,
  wikiPageRecentInput,
  workflowArtifactRecentInput,
  workflowRunRecentInput,
  workflowRunReferenceRecentInput,
  type PullRequestLinkedIssue,
  type SecurityItemRecentInput
} from "../components/recent/recentRecordInputs";
import { useRecentRecorder } from "./useRecentRecorder";
import { useControlApi } from "./useControlApi";
import { useUiStore, type AppRoute, type LocalRepositoryTab, type RepositoryTab } from "../stores/uiStore";

interface RefName {
  name: string;
}

interface MarkNotificationReadMutation {
  mutate(input: { threadId: string }): void;
}

type SetNullableString = (value: string | null) => void;

interface UseAppNavigationActionsInput {
  effectiveRepository: string;
  contentsRef: string | null;
  repositoryRefs: Record<string, string | null>;
  setRepositoryRefs: Dispatch<SetStateAction<Record<string, string | null>>>;
  repositoryDetail: RepositoryDetail | null;
  repositoryItems: RepositorySummary[];
  branchItems: RefName[];
  tagItems: RefName[];
  recentItemLimit: number;
  githubReady: boolean;
  markNotificationRead: MarkNotificationReadMutation;
  setSelectedOrganizationLogin: SetNullableString;
  setSelectedOrganizationTeamSlug: SetNullableString;
  setSelectedOrganizationMemberLogin: SetNullableString;
  setSelectedOrganizationProjectId: SetNullableString;
}

export function useAppNavigationActions({
  effectiveRepository,
  contentsRef,
  repositoryRefs,
  setRepositoryRefs,
  repositoryDetail,
  repositoryItems,
  branchItems,
  tagItems,
  recentItemLimit,
  githubReady,
  markNotificationRead,
  setSelectedOrganizationLogin,
  setSelectedOrganizationTeamSlug,
  setSelectedOrganizationMemberLogin,
  setSelectedOrganizationProjectId
}: UseAppNavigationActionsInput) {
  const api = useControlApi();
  const navigate = useUiStore((state) => state.navigate);
  const goToRepository = useUiStore((state) => state.goToRepository);
  const goToLocalRepository = useUiStore((state) => state.goToLocalRepository);
  const openCodeBrowser = useUiStore((state) => state.openCodeBrowser);
  const goToOrganizations = useUiStore((state) => state.goToOrganizations);
  const { recordRecent } = useRecentRecorder(recentItemLimit);
  const repositoriesByName = useMemo(
    () => new Map(repositoryItems.map((repository) => [repository.nameWithOwner.toLowerCase(), repository])),
    [repositoryItems]
  );

  function repositoryForRecent(nameWithOwner: string): RepositorySummary | RepositoryDetail | undefined {
    const normalized = nameWithOwner.toLowerCase();
    if (repositoryDetail?.nameWithOwner.toLowerCase() === normalized) {
      return repositoryDetail;
    }

    return repositoriesByName.get(normalized);
  }

  function resetRepositoryRefForDefaultOpen(nameWithOwner: string): void {
    setRepositoryRefs((currentRefs) => {
      if (currentRefs[nameWithOwner] === undefined || currentRefs[nameWithOwner] === null) {
        return currentRefs;
      }

      return {
        ...currentRefs,
        [nameWithOwner]: null
      };
    });
  }

  function openRepositoryInApp(nameWithOwner: string, tab?: RepositoryTab): void {
    resetRepositoryRefForDefaultOpen(nameWithOwner);
    goToRepository(nameWithOwner, tab);
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), tab ?? "code"));
  }

  function openLocalRepositoryInApp(
    repository: AreaRepositorySummary,
    tab: LocalRepositoryTab = "overview"
  ): void {
    const workspaceId = null;
    goToLocalRepository(repository.areaId, repository.id, tab, workspaceId);
    recordRecent({
      kind: "repository",
      provider: "local",
      itemKey: `${repository.areaId}:${repository.id}`,
      title: repository.displayName,
      subtitle: repository.path ?? repository.connection?.nameWithOwner ?? null,
      repositoryNameWithOwner: repository.connection?.nameWithOwner ?? null,
      areaId: repository.areaId,
      repositoryId: repository.id,
      workspaceId,
      url: repository.connection?.url ?? null,
      metadata: { vcs: repository.kind }
    });
  }

  function openLocalFileInApp(input: {
    areaId: string;
    repositoryId: string;
    workspaceId: string | null;
    path: string;
    entryType: AreaFileEntry["type"];
  }): void {
    goToLocalRepository(input.areaId, input.repositoryId, "code", input.workspaceId, input.path);
    recordRecent(localFileRecentInput(input));
  }

  function openRepositoryRouteInApp(route: Extract<AppRoute, { kind: "repository" }>): void {
    navigate(route);
    recordRecent(
      repositoryRecentInput(route.nameWithOwner, repositoryForRecent(route.nameWithOwner), route.tab)
    );
  }

  function selectRepositoryTabInApp(nameWithOwner: string, tab: RepositoryTab): void {
    navigate({ kind: "repository", nameWithOwner, tab });
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), tab));
  }

  function openFilteredRepositorySurfaceInApp(
    nameWithOwner: string,
    tab: "issues" | "pulls" | "actions",
    filter: string
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab,
      issueFilter: tab === "issues" ? filter : undefined,
      pullFilter: tab === "pulls" ? filter : undefined,
      workflowFilter: tab === "actions" ? filter : undefined
    });
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), tab));
  }

  function openCodeBrowserInApp(
    nameWithOwner: string,
    path: string,
    entryType: "file" | "dir",
    ref: string | null,
    line?: number | null
  ): void {
    const normalizedLine = normalizeCodeLineNumber(line);
    openCodeBrowser(nameWithOwner, path, entryType, ref, normalizedLine);
    if (entryType === "file" && path.trim()) {
      recordRecent(fileRecentInput({ nameWithOwner, path, entryType, ref, line: normalizedLine }));
    }
  }

  function repositoryRefKindForName(ref: string): "branch" | "tag" | "ref" {
    if (branchItems.some((branch) => branch.name === ref)) {
      return "branch";
    }
    if (tagItems.some((tag) => tag.name === ref)) {
      return "tag";
    }
    return "ref";
  }

  function selectRepositoryRefInApp(
    nameWithOwner: string,
    ref: string | null,
    refKind: "branch" | "tag" | "ref" = "ref",
    codeBrowserTarget?: { path: string; entryType: "file" | "dir"; line?: number | null }
  ): void {
    setRepositoryRefs((currentRefs) => ({
      ...currentRefs,
      [nameWithOwner]: ref
    }));
    if (ref) {
      recordRecent(
        repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "code", ref, refKind)
      );
    }
    if (codeBrowserTarget) {
      openCodeBrowserInApp(
        nameWithOwner,
        codeBrowserTarget.path,
        codeBrowserTarget.entryType,
        ref,
        codeBrowserTarget.line
      );
      return;
    }
    navigate({ kind: "repository", nameWithOwner, tab: "code" });
  }

  function selectSecurityQualityBranchInApp(nameWithOwner: string, ref: string): void {
    setRepositoryRefs((currentRefs) => ({
      ...currentRefs,
      [nameWithOwner]: ref
    }));
    recordRecent(
      repositoryRecentInput(nameWithOwner, repositoryDetail ?? undefined, "securityQuality", ref, "branch")
    );
    navigate({ kind: "repository", nameWithOwner, tab: "securityQuality" });
  }

  function openCommitInApp({
    nameWithOwner,
    commit,
    path = "",
    entryType,
    line = null
  }: {
    nameWithOwner: string;
    commit: CommitRecentCommit;
    path?: string | null;
    entryType?: "file" | "dir";
    line?: number | null;
  }): void {
    const normalizedPath = path ?? "";
    const normalizedEntryType = entryType ?? (normalizedPath.trim() ? "file" : "dir");
    const normalizedLine = normalizeCodeLineNumber(line);
    openCodeBrowser(nameWithOwner, normalizedPath, normalizedEntryType, commit.sha, normalizedLine);
    recordRecent(
      commitRecentInput({
        nameWithOwner,
        commit,
        path: normalizedPath,
        entryType: normalizedEntryType,
        line: normalizedLine
      })
    );
  }

  function openPullRequestCommitInApp(
    commit: CommitRecentCommit,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    openCommitInApp({
      nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
      commit,
      path: "",
      entryType: "dir"
    });
  }

  function openPullRequestReviewCommitInApp(
    review: PullRequestReviewSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    const commit = pullRequestReviewCommitRecentCommit(review);

    if (commit) {
      openPullRequestCommitInApp(commit, targetRepositoryNameWithOwner);
    }
  }

  function openPullRequestTimelineEventCommitInApp(
    event: PullRequestTimelineEventSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    const commit = pullRequestTimelineEventCommitRecentCommit(event);

    if (commit) {
      openPullRequestCommitInApp(commit, targetRepositoryNameWithOwner);
    }
  }

  function openWorkflowRunCommitInApp(
    run: WorkflowRunSummary | WorkflowRunDetail,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    const commit = workflowRunCommitRecentCommit(run);

    if (commit) {
      openPullRequestCommitInApp(commit, targetRepositoryNameWithOwner);
    }
  }

  function openWorkflowCheckSuiteCommitInApp(
    suite: WorkflowRunCheckSuiteSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    const commit = workflowCheckSuiteCommitRecentCommit(suite);

    if (commit) {
      openPullRequestCommitInApp(commit, targetRepositoryNameWithOwner);
    }
  }

  function openCodePathInApp(
    path: string,
    entryType: "file" | "dir",
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void {
    const parsedBlob = parseGitHubBlobUrl(blobUrl, path);
    if (parsedBlob) {
      openCodeBrowserInApp(
        parsedBlob.nameWithOwner,
        parsedBlob.path,
        "file",
        parsedBlob.ref,
        line ?? parsedBlob.line
      );
      return;
    }

    openCodeBrowserInApp(targetRepositoryNameWithOwner ?? effectiveRepository, path, entryType, ref, line);
  }

  function selectIssueInApp(nameWithOwner: string, issue: IssueSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "issues", issueNumber: issue.number });
    recordRecent(issueRecentInput(nameWithOwner, issue));
  }

  function selectPullRequestInApp(nameWithOwner: string, pullRequest: PullRequestSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "pulls", pullNumber: pullRequest.number });
    recordRecent(pullRequestRecentInput(nameWithOwner, pullRequest));
  }

  function openLinkedIssueInApp(issue: PullRequestLinkedIssue): void {
    const nameWithOwner = issue.repositoryNameWithOwner ?? effectiveRepository;
    navigate({ kind: "repository", nameWithOwner, tab: "issues", issueNumber: issue.number });
    recordRecent(linkedIssueRecentInput(nameWithOwner, issue));
  }

  function selectDiscussionInApp(nameWithOwner: string, discussion: DiscussionSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "discussions", discussionNumber: discussion.number });
    recordRecent(discussionRecentInput(nameWithOwner, discussion));
  }

  function selectProjectInApp(nameWithOwner: string, project: ProjectSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "projects", projectId: project.id });
    recordRecent(projectRecentInput(nameWithOwner, project));
  }

  function selectOrganizationProjectInApp(organization: OrganizationSummary, project: ProjectSummary): void {
    setSelectedOrganizationLogin(organization.login);
    setSelectedOrganizationTeamSlug(null);
    setSelectedOrganizationMemberLogin(null);
    setSelectedOrganizationProjectId(project.id);
    goToOrganizations();
    recordRecent(organizationProjectRecentInput(organization, project));
  }

  function openTeamInApp(team: TeamSummary): void {
    recordRecent(teamRecentInput(team));
    setSelectedOrganizationLogin(team.organizationLogin);
    setSelectedOrganizationTeamSlug(team.slug);
    setSelectedOrganizationMemberLogin(null);
    setSelectedOrganizationProjectId(null);
    goToOrganizations();
  }

  function selectWorkflowRunInApp(nameWithOwner: string, run: WorkflowRunSummary): void {
    navigate({ kind: "repository", nameWithOwner, tab: "actions", workflowRunId: run.id });
    recordRecent(workflowRunRecentInput(nameWithOwner, run));
  }

  function selectWorkflowArtifactInApp(
    nameWithOwner: string,
    run: WorkflowRunSummary | WorkflowRunDetail,
    artifact: WorkflowRunArtifactSummary
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "actions",
      workflowRunId: run.id,
      workflowArtifactId: artifact.id
    });
    recordRecent(workflowArtifactRecentInput(nameWithOwner, run, artifact));
  }

  function selectSecurityItemInApp(nameWithOwner: string, securityItem: SecurityItemRecentInput): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "securityQuality",
      securityItemKind: securityItem.kind,
      securityItemId: securityItem.id
    });
    recordRecent(securityItemRecentInput(nameWithOwner, securityItem));
  }

  function selectWikiPageInApp(nameWithOwner: string, page: WikiPageSummary | WikiPageContent): void {
    navigate({ kind: "repository", nameWithOwner, tab: "wiki", wikiPagePath: page.path });
    recordRecent(wikiPageRecentInput(nameWithOwner, page));
  }

  function openWorkflowRunReferenceInApp(nameWithOwner: string, runId: number, url?: string | null): void {
    navigate({ kind: "repository", nameWithOwner, tab: "actions", workflowRunId: runId });
    recordRecent(workflowRunReferenceRecentInput(nameWithOwner, runId, url));
  }

  function selectReleaseInApp(nameWithOwner: string, release: ReleaseSummary): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "releases",
      releaseId: release.id,
      releaseTagName: release.tagName
    });
    recordRecent(releaseRecentInput(nameWithOwner, release));
  }

  function selectReleaseAssetInApp(
    nameWithOwner: string,
    release: ReleaseSummary,
    asset: ReleaseAssetSummary
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "releases",
      releaseId: release.id,
      releaseTagName: release.tagName,
      releaseAssetId: asset.id
    });
    recordRecent(releaseAssetRecentInput(nameWithOwner, release, asset));
  }

  function selectContributorInApp(nameWithOwner: string, contributor: ContributorSummary): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "contributors",
      contributorLogin: contributor.login
    });
    recordRecent(contributorRecentInput(nameWithOwner, contributor));
  }

  function selectRepositorySettingsCollaboratorInApp(
    nameWithOwner: string,
    collaborator: RepositoryCollaboratorSummary
  ): void {
    navigate({
      kind: "repository",
      nameWithOwner,
      tab: "settings",
      settingsCollaboratorLogin: collaborator.login
    });
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "settings"));
  }

  function openIssueSummaryInApp(issue: IssueSummary): void {
    const nameWithOwner =
      issue.repositoryNameWithOwner ?? repositoryNameWithOwnerFromGitHubUrl(issue.htmlUrl);

    if (nameWithOwner) {
      selectIssueInApp(nameWithOwner, issue);
      return;
    }

    void api.openExternal(issue.htmlUrl);
  }

  function openPullRequestSummaryInApp(pullRequest: PullRequestSummary): void {
    const nameWithOwner =
      pullRequest.repositoryNameWithOwner ?? repositoryNameWithOwnerFromGitHubUrl(pullRequest.htmlUrl);

    if (nameWithOwner) {
      selectPullRequestInApp(nameWithOwner, pullRequest);
      return;
    }

    void api.openExternal(pullRequest.htmlUrl);
  }

  function openNotificationInApp(notification: NotificationSummary): void {
    const target = notificationInAppTarget(notification);
    if (target && notification.repositoryNameWithOwner) {
      if (githubReady && notification.unread) {
        markNotificationRead.mutate({ threadId: notification.id });
      }
      if (target.kind === "commit" && target.commitSha) {
        openCommitInApp({
          nameWithOwner: notification.repositoryNameWithOwner,
          commit: notificationCommitRecentCommit(notification, target.commitSha),
          path: "",
          entryType: "dir"
        });
        recordRecent(notificationRecentInput(notification, target));
        return;
      }
      navigate({
        kind: "repository",
        nameWithOwner: notification.repositoryNameWithOwner,
        tab: target.tab,
        issueNumber: target.kind === "issue" ? target.number : undefined,
        pullNumber: target.kind === "pullRequest" ? target.number : undefined,
        discussionNumber: target.kind === "discussion" ? target.number : undefined,
        releaseId: target.kind === "release" ? target.releaseId : undefined,
        releaseTagName: target.kind === "release" ? target.tagName : undefined,
        workflowRunId: target.kind === "workflowRun" ? target.runId : undefined
      });
      recordRecent(notificationRecentInput(notification, target));
      return;
    }

    if (githubReady && notification.unread) {
      markNotificationRead.mutate({ threadId: notification.id });
    }
    void api.openExternal(notificationTargetUrl(notification));
  }

  function openRecentItem(item: LocalRecentItem): void {
    openRecentItemInApp(item, {
      navigate,
      goToOrganizations,
      goToLocalRepository,
      openCodeBrowser,
      openCodeBrowserInApp,
      recordRecent,
      resetRepositoryRefForDefaultOpen,
      setSelectedOrganizationLogin,
      setSelectedOrganizationTeamSlug,
      setSelectedOrganizationMemberLogin,
      setSelectedOrganizationProjectId,
      openExternal: (url) => void api.openExternal(url)
    });
  }

  const openMarkdownUrl = createMarkdownUrlHandler({
    branchItems,
    tagItems,
    repositoryRefs,
    effectiveRepository,
    contentsRef,
    repositoryDetail,
    navigate,
    recordRecent,
    repositoryForRecent,
    openExternal: (url) => void api.openExternal(url),
    openRepositoryInApp,
    openCodeBrowserInApp,
    openCommitInApp,
    openWorkflowRunReferenceInApp,
    selectWikiPageInApp
  });

  return {
    repositoryRefs,
    openRepositoryInApp,
    openLocalRepositoryInApp,
    openLocalFileInApp,
    openRepositoryRouteInApp,
    selectRepositoryTabInApp,
    openFilteredRepositorySurfaceInApp,
    openCodeBrowserInApp,
    repositoryRefKindForName,
    selectRepositoryRefInApp,
    selectSecurityQualityBranchInApp,
    openCommitInApp,
    openPullRequestCommitInApp,
    openPullRequestReviewCommitInApp,
    openPullRequestTimelineEventCommitInApp,
    openWorkflowRunCommitInApp,
    openWorkflowCheckSuiteCommitInApp,
    openCodePathInApp,
    selectIssueInApp,
    selectPullRequestInApp,
    openLinkedIssueInApp,
    selectDiscussionInApp,
    selectProjectInApp,
    selectOrganizationProjectInApp,
    openTeamInApp,
    selectWorkflowRunInApp,
    selectWorkflowArtifactInApp,
    selectSecurityItemInApp,
    selectWikiPageInApp,
    openWorkflowRunReferenceInApp,
    selectReleaseInApp,
    selectReleaseAssetInApp,
    selectContributorInApp,
    selectRepositorySettingsCollaboratorInApp,
    openIssueSummaryInApp,
    openPullRequestSummaryInApp,
    openNotificationInApp,
    openRecentItem,
    openMarkdownUrl
  };
}

function localFileRecentInput(input: {
  areaId: string;
  repositoryId: string;
  workspaceId: string | null;
  path: string;
  entryType: AreaFileEntry["type"];
}): LocalRecentRecordInput {
  return {
    kind: "file",
    provider: "local",
    itemKey: `${input.areaId}:${input.repositoryId}:${input.workspaceId ?? "none"}:${input.path}`,
    title: input.path.split("/").pop() || input.path,
    subtitle: input.path,
    areaId: input.areaId,
    repositoryId: input.repositoryId,
    workspaceId: input.workspaceId,
    metadata: { path: input.path, entryType: input.entryType }
  };
}
