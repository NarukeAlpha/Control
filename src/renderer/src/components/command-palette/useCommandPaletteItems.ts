import { Settings } from "lucide-react";
import type { QueryClient } from "@tanstack/react-query";

import type {
  BranchSummary,
  ContributorSummary,
  DiscussionSummary,
  IssueSummary,
  NotificationSummary,
  ProjectSummary,
  PullRequestSummary,
  ReleaseAssetSummary,
  ReleaseSummary,
  RepositoryDetail,
  RepositoryCollaboratorSummary,
  RepositorySummary,
  TagSummary,
  WorkflowRunArtifactSummary,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import type { LocalRecentItem } from "@shared/local";
import type { AppRoute } from "../../stores/uiStore";
import type { OrganizationsRouteState } from "../collection/useOrganizationsRouteState";
import { repositoryMutationDisabledReason } from "../repository/repositoryUi";
import type { SecurityItemRecentInput } from "../recent/recentRecordInputs";
import type { CommandPaletteItem } from "./CommandPalette";
import {
  appendAccountWorkCommandPaletteItems,
  appendCurrentRepositoryCommandPaletteItems,
  appendNotificationCommandPaletteItems,
  appendOrganizationCommandPaletteItems,
  appendPinnedRepositoryCommandPaletteItems,
  appendRecentCommandPaletteItems,
  appendRepositoryAdminCommandPaletteItems,
  appendRepositoryCommandPaletteItems,
  appendRepositoryContentCommandPaletteItems,
  appendRepositoryReleaseCommandPaletteItems,
  appendRepositorySecurityCommandPaletteItems,
  appendRepositoryWorkflowCommandPaletteItems,
  appendShellCommandPaletteItems,
  cachedRepositoryAccess,
  cachedRepositoryForks,
  cachedRepositorySecurityCommandItems,
  cachedRepositoryWikiPages,
  cachedWorkflowRunDetail
} from "./commandPaletteItemBuilders";

interface RepositoryQueryStatus {
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

type RepositoryRefKind = "branch" | "tag" | "ref";

interface UseCommandPaletteItemsInput {
  queryClient: QueryClient;
  route: AppRoute;
  githubReady: boolean;
  appFetching: boolean;
  accountProfileFetching: boolean;
  viewerLogin: string | null;
  repositoriesFetching: boolean;
  repositoryItems: RepositorySummary[];
  pinnedRepositoryNames: string[];
  recentItems: LocalRecentItem[];
  notificationsFetching: boolean;
  notificationsLoading: boolean;
  notificationItems: NotificationSummary[];
  accountIssuesFetching: boolean;
  accountIssueItems: IssueSummary[];
  accountPullsFetching: boolean;
  accountPullItems: PullRequestSummary[];
  markVisibleNotificationsReadPending: boolean;
  organizationsRouteState: OrganizationsRouteState;
  effectiveRepository: string;
  owner: string;
  repo: string;
  repositoryDetail: RepositoryDetail | null;
  repository: RepositoryQueryStatus;
  repositoryAvailabilityMessage: string | null;
  repositoryPinBusy: boolean;
  branchItems: BranchSummary[];
  tagItems: TagSummary[];
  branchesLoaded: boolean;
  tagsLoaded: boolean;
  discussionItems: DiscussionSummary[];
  projectItems: ProjectSummary[];
  contributorItems: ContributorSummary[];
  releaseItems: ReleaseSummary[];
  actionItems: WorkflowRunSummary[];
  repositoryAccessLimit: number;
  forksLimit: number;
  dependabotAlertsLimit: number;
  codeScanningAlertsLimit: number;
  secretScanningAlertsLimit: number;
  repositorySecurityAdvisoriesLimit: number;
  repositoryRulesetsLimit: number;
  isRepositoryPinned(nameWithOwner: string): boolean;
  onGoHome(): void;
  onOpenRepositories(): void;
  onOpenAddRepository(): void;
  onRefreshHome(): void;
  onRefreshRepositories(): void;
  onRefreshOrganizations(): void;
  onOpenMailbox(): void;
  onRefreshMailbox(): void;
  onMarkLoadedNotificationsRead(threadIds: string[]): void;
  onOpenSettings(): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenRepositoryRoute(route: Extract<AppRoute, { kind: "repository" }>): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
  onRefreshRepository(): void;
  onOpenFileFinder(nameWithOwner: string): void;
  onOpenExternalGitHub(nameWithOwner: string): void;
  onOpenRecent(item: LocalRecentItem): void;
  onOpenNotification(notification: NotificationSummary): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
  onSelectRepositoryRef(
    nameWithOwner: string,
    ref: string | null,
    refKind?: RepositoryRefKind,
    codeBrowserTarget?: { path: string; entryType: "file" | "dir"; line?: number | null }
  ): void;
  onSelectWikiPage(nameWithOwner: string, page: WikiPageSummary | WikiPageContent): void;
  onSelectDiscussion(nameWithOwner: string, discussion: DiscussionSummary): void;
  onSelectProject(nameWithOwner: string, project: ProjectSummary): void;
  onSelectContributor(nameWithOwner: string, contributor: ContributorSummary): void;
  onSelectCollaborator(nameWithOwner: string, collaborator: RepositoryCollaboratorSummary): void;
  onSelectTeam(team: Parameters<OrganizationsRouteState["openTeam"]>[0]): void;
  onSelectRelease(nameWithOwner: string, release: ReleaseSummary): void;
  onSelectReleaseAsset(nameWithOwner: string, release: ReleaseSummary, asset: ReleaseAssetSummary): void;
  onSelectWorkflowRun(nameWithOwner: string, run: WorkflowRunSummary): void;
  onSelectWorkflowArtifact(
    nameWithOwner: string,
    run: WorkflowRunSummary | WorkflowRunDetail,
    artifact: WorkflowRunArtifactSummary
  ): void;
  onSelectSecurityItem(nameWithOwner: string, securityItem: SecurityItemRecentInput): void;
  onSelectOrganizationProject(
    organization: Parameters<OrganizationsRouteState["openOrganization"]>[0],
    project: ProjectSummary
  ): void;
}

const commandPaletteGeneralSourceLimit = 50;
const commandPaletteDenseSourceLimit = 30;
const commandPaletteSecuritySourceLimit = 30;

export function useCommandPaletteItems({
  queryClient,
  route,
  githubReady,
  appFetching,
  accountProfileFetching,
  viewerLogin,
  repositoriesFetching,
  repositoryItems,
  pinnedRepositoryNames,
  recentItems,
  notificationsFetching,
  notificationsLoading,
  notificationItems,
  accountIssuesFetching,
  accountIssueItems,
  accountPullsFetching,
  accountPullItems,
  markVisibleNotificationsReadPending,
  organizationsRouteState,
  effectiveRepository,
  owner,
  repo,
  repositoryDetail,
  repository,
  repositoryAvailabilityMessage,
  repositoryPinBusy,
  branchItems,
  tagItems,
  branchesLoaded,
  tagsLoaded,
  discussionItems,
  projectItems,
  contributorItems,
  releaseItems,
  actionItems,
  repositoryAccessLimit,
  forksLimit,
  dependabotAlertsLimit,
  codeScanningAlertsLimit,
  secretScanningAlertsLimit,
  repositorySecurityAdvisoriesLimit,
  repositoryRulesetsLimit,
  isRepositoryPinned,
  onGoHome,
  onOpenRepositories,
  onOpenAddRepository,
  onRefreshHome,
  onRefreshRepositories,
  onRefreshOrganizations,
  onOpenMailbox,
  onRefreshMailbox,
  onMarkLoadedNotificationsRead,
  onOpenSettings,
  onOpenRepository,
  onOpenRepositoryRoute,
  onToggleRepositoryPin,
  onRefreshRepository,
  onOpenFileFinder,
  onOpenExternalGitHub,
  onOpenRecent,
  onOpenNotification,
  onOpenIssue,
  onOpenPullRequest,
  onSelectRepositoryRef,
  onSelectWikiPage,
  onSelectDiscussion,
  onSelectProject,
  onSelectContributor,
  onSelectCollaborator,
  onSelectTeam,
  onSelectRelease,
  onSelectReleaseAsset,
  onSelectWorkflowRun,
  onSelectWorkflowArtifact,
  onSelectSecurityItem,
  onSelectOrganizationProject
}: UseCommandPaletteItemsInput): CommandPaletteItem[] {
  const repositoriesRefreshDisabledReason = repositoriesFetching
    ? "Repositories are already refreshing."
    : null;
  const mailboxRefreshInFlight = notificationsFetching || accountIssuesFetching || accountPullsFetching;
  const mailboxRefreshDisabledReason = mailboxRefreshInFlight ? "Mailbox data is already refreshing." : null;
  const loadedUnreadNotificationIds = notificationItems
    .filter((notification) => notification.unread)
    .map((notification) => notification.id);
  const markLoadedNotificationsReadDisabledReason = markVisibleNotificationsReadPending
    ? "Notifications are already being marked as read."
    : !githubReady
      ? "Sign in with GitHub to mark notifications as read."
      : notificationsLoading
        ? "Notifications are still loading."
        : loadedUnreadNotificationIds.length === 0
          ? "No loaded unread notifications."
          : null;
  const organizationsRefreshDisabledReason = organizationsRouteState.refreshInFlight
    ? "Organization data is already refreshing."
    : null;

  const items: CommandPaletteItem[] = [];
  appendShellCommandPaletteItems(items, {
    githubReady,
    homeRefreshDisabledReason:
      appFetching || repositoriesFetching || accountProfileFetching
        ? "Home data is already refreshing."
        : null,
    repositoriesRefreshDisabledReason,
    organizationsRefreshDisabledReason,
    mailboxRefreshDisabledReason,
    markLoadedNotificationsReadDisabledReason,
    onGoHome,
    onOpenRepositories,
    onOpenAddRepository,
    onRefreshHome,
    onRefreshRepositories,
    onOpenOrganizations: organizationsRouteState.openOrganizations,
    onRefreshOrganizations,
    onOpenMailbox,
    onRefreshMailbox,
    onMarkLoadedNotificationsRead: () => {
      onMarkLoadedNotificationsRead(loadedUnreadNotificationIds);
    }
  });

  appendOrganizationCommandPaletteItems(items, {
    organizationItems: organizationsRouteState.organizationItems,
    organizationTeams: organizationsRouteState.organizationTeams,
    organizationRepositories: organizationsRouteState.organizationRepositories,
    organizationTeamRepositories: organizationsRouteState.organizationTeamRepositories,
    organizationProjects: organizationsRouteState.organizationProjects,
    organizationMembers: organizationsRouteState.organizationMembers,
    organizationTeamMembers: organizationsRouteState.organizationTeamMembers,
    selectedOrganization: organizationsRouteState.selectedOrganization,
    selectedOrganizationTeam: organizationsRouteState.selectedOrganizationTeam,
    generalSourceLimit: commandPaletteGeneralSourceLimit,
    denseSourceLimit: commandPaletteDenseSourceLimit,
    onOpenOrganization: organizationsRouteState.openOrganization,
    onOpenTeam: organizationsRouteState.openTeam,
    onOpenRepository,
    onOpenOrganizationMember: organizationsRouteState.openOrganizationMember,
    onOpenOrganizationTeamMember: organizationsRouteState.openOrganizationTeamMember,
    onSelectOrganizationProject
  });

  appendNotificationCommandPaletteItems(items, {
    notificationItems,
    limit: commandPaletteGeneralSourceLimit,
    onOpenNotification
  });
  appendAccountWorkCommandPaletteItems(items, {
    accountIssueItems,
    accountPullItems,
    limit: commandPaletteGeneralSourceLimit,
    onOpenIssue,
    onOpenPullRequest
  });

  items.push({
    id: "command-settings",
    title: "Settings",
    subtitle: "Open Control settings",
    group: "Commands",
    icon: Settings,
    keywords: ["account", "oauth", "preferences"],
    run: onOpenSettings
  });

  if (effectiveRepository) {
    const currentRepositoryMatches =
      repositoryDetail?.nameWithOwner.toLowerCase() === effectiveRepository.toLowerCase();
    const repositoryCommandDisabledReason = !githubReady
      ? "Sign in with GitHub to run repository mutations."
      : !repositoryDetail && (repository.isLoading || repository.isFetching)
        ? "Repository details are still loading."
        : !repositoryDetail && repository.error
          ? `Repository details unavailable: ${repository.error.message}`
          : !repositoryDetail && repositoryAvailabilityMessage
            ? repositoryAvailabilityMessage
            : currentRepositoryMatches
              ? repositoryMutationDisabledReason(repositoryDetail)
              : "Open the repository before running mutation commands.";
    const repositoryRefreshDisabledReason = repository.isFetching
      ? "Repository refresh is already running."
      : null;
    const currentRepositoryPinned = isRepositoryPinned(effectiveRepository);
    const repositoryPinCommandDisabledReason = repositoryPinBusy
      ? "Repository pin update is already running."
      : null;
    appendRepositoryContentCommandPaletteItems(items, {
      effectiveRepository,
      branchItems,
      tagItems,
      branchesLoaded,
      tagsLoaded,
      wikiPages: cachedRepositoryWikiPages(queryClient, effectiveRepository),
      discussionItems,
      projectItems,
      contributorItems,
      generalSourceLimit: commandPaletteGeneralSourceLimit,
      denseSourceLimit: commandPaletteDenseSourceLimit,
      onSelectRepositoryRef,
      onSelectWikiPage,
      onSelectDiscussion,
      onSelectProject,
      onSelectContributor
    });

    const commandPaletteRepositoryAccess = cachedRepositoryAccess(queryClient, {
      owner,
      repo,
      limit: repositoryAccessLimit
    });
    appendRepositoryAdminCommandPaletteItems(items, {
      effectiveRepository,
      collaborators: commandPaletteRepositoryAccess?.collaborators ?? [],
      teams: commandPaletteRepositoryAccess?.teams ?? [],
      forks: cachedRepositoryForks(queryClient, { owner, repo, limit: forksLimit }),
      currentRepositoryParent: repositoryDetail?.parent ?? null,
      currentRepositorySource: repositoryDetail?.source ?? null,
      denseSourceLimit: commandPaletteDenseSourceLimit,
      forksLimit,
      onSelectCollaborator,
      onSelectTeam,
      onOpenRepository
    });

    appendRepositoryReleaseCommandPaletteItems(items, {
      effectiveRepository,
      releaseItems,
      limit: commandPaletteGeneralSourceLimit,
      onSelectRelease,
      onSelectReleaseAsset
    });

    appendRepositoryWorkflowCommandPaletteItems(items, {
      effectiveRepository,
      actionItems,
      focusedWorkflowRunDetail: cachedWorkflowRunDetail(queryClient, {
        owner,
        repo,
        runId:
          route.kind === "repository" && route.nameWithOwner === effectiveRepository
            ? (route.workflowRunId ?? null)
            : null
      }),
      limit: commandPaletteGeneralSourceLimit,
      onSelectWorkflowRun,
      onSelectWorkflowArtifact
    });

    appendRepositorySecurityCommandPaletteItems(items, {
      effectiveRepository,
      ...cachedRepositorySecurityCommandItems(queryClient, {
        owner,
        repo,
        dependabotAlertsLimit,
        codeScanningAlertsLimit,
        secretScanningAlertsLimit,
        repositorySecurityAdvisoriesLimit,
        repositoryRulesetsLimit
      }),
      limit: commandPaletteSecuritySourceLimit,
      onSelectSecurityItem
    });

    appendCurrentRepositoryCommandPaletteItems(items, {
      effectiveRepository,
      githubReady,
      currentRepositoryPinned,
      repositoryCommandDisabledReason,
      repositoryRefreshDisabledReason,
      repositoryPinCommandDisabledReason,
      onOpenRepository,
      onToggleRepositoryPin,
      onRefreshRepository,
      onOpenFileFinder,
      onCreateIssue: (nameWithOwner) =>
        onOpenRepositoryRoute({
          kind: "repository",
          nameWithOwner,
          tab: "issues",
          issueComposer: "create"
        }),
      onCreatePullRequest: (nameWithOwner) =>
        onOpenRepositoryRoute({
          kind: "repository",
          nameWithOwner,
          tab: "pulls",
          pullComposer: "create"
        }),
      onCreateRelease: (nameWithOwner) =>
        onOpenRepositoryRoute({
          kind: "repository",
          nameWithOwner,
          tab: "releases",
          releaseComposer: "create"
        }),
      onRunWorkflow: (nameWithOwner) =>
        onOpenRepositoryRoute({
          kind: "repository",
          nameWithOwner,
          tab: "actions",
          workflowComposer: "dispatch"
        }),
      onOpenExternalGitHub
    });
  }

  appendPinnedRepositoryCommandPaletteItems(items, {
    pinnedRepositoryNames,
    repositoryItems,
    viewerLogin,
    onOpenRepository
  });
  appendRecentCommandPaletteItems(items, {
    recentItems,
    onOpenRecent
  });
  appendRepositoryCommandPaletteItems(items, {
    repositoryItems,
    viewerLogin,
    onOpenRepository
  });

  return items;
}
