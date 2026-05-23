import {
  BellOff,
  Bot,
  Building2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Code2,
  Download,
  ExternalLink,
  Eye,
  File as FileIcon,
  Gauge,
  GitBranch,
  GitFork,
  GitPullRequest,
  Home,
  Inbox,
  Lock,
  MessageSquare,
  Pin,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  SquareKanban,
  Tag,
  Users,
  Workflow,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  AssignableUserSummary,
  BranchSummary,
  BranchProtectionResult,
  CodeScanningAlertSummary,
  CodeScanningAlertsResult,
  ContributorSummary,
  DependabotAlertSummary,
  DependabotAlertsResult,
  DiscussionSummary,
  GitHubAction,
  GitHubMutationInput,
  GitHubMutationFields,
  GitHubReadAvailability,
  IssueSummary,
  LabelSummary,
  MilestoneSummary,
  NotificationListResult,
  NotificationSummary,
  OrganizationMembersResult,
  OrganizationMemberSummary,
  OrganizationRepositoriesResult,
  OrganizationRepositorySummary,
  OrganizationTeamMembersResult,
  OrganizationTeamRepositoriesResult,
  OrganizationTeamRepositorySummary,
  OrganizationSummary,
  OrganizationTeamsResult,
  ProjectSummary,
  ProjectListResult,
  PullRequestCommitSummary,
  PullRequestLinkedIssueSummary,
  PullRequestReviewSummary,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  ReleaseAssetSummary,
  ReleaseSummary,
  RepoEntry,
  RepoFileBlameResult,
  RepoFileContentResult,
  RepositoryAccessResult,
  RepositoryCollaboratorSummary,
  RepositoryCommunityProfileResult,
  RepositoryDetail,
  RepositoryRef,
  RepositoryForksResult,
  RepositoryRulesetSummary,
  RepositoryRulesetsResult,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityAdvisorySummary,
  RepositorySecurityPolicyResult,
  RepositorySummary,
  RepositoryWikiResult,
  SecretScanningAlertSummary,
  SecretScanningAlertsResult,
  TagSummary,
  TeamMemberSummary,
  TeamSummary,
  WorkflowRunArtifactSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunDetailResult,
  WorkflowRunSummary,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import type { AreaRepositorySummary, AreaSummary, CreateSshAreaInput, UpdateAreaInput } from "@shared/areas";
import type {
  LocalRecentItem,
  LocalRecentRecordInput,
  LocalRecentSecurityItemKind,
  RepositoryPinInput,
  RepositoryPinRecord
} from "@shared/local";
import {
  MarkdownBody,
  MarkdownUrlHandlerContext,
  markdownOrganizationProjectUrlContext
} from "./components/MarkdownBody";
import { AreaDeleteDialog, AreaEditDialog, SshAreaDialog } from "./components/areas/AreaDialogs";
import { LocalAreaHome } from "./components/areas/LocalAreaHome";
import { areaRepositoryPinKey, isGatewayAreaKind } from "./components/areas/areaUi";
import { SetupPanel } from "./components/auth/SetupPanel";
import { CodeBrowserPage } from "./components/code-browser/CodeBrowserPage";
import {
  encodeRepositoryPath,
  isMarkdownPath,
  isReadmeMarkdownPath,
  normalizeCodeLineNumber
} from "./components/code-browser/codeBrowserUi";
import {
  issueStateLabel,
  mailboxIssueMetadataParts,
  mailboxPullRequestMetadataParts,
  pullRequestMergeableStateLabel,
  pullRequestReviewDecisionLabel,
  pullRequestReviewDecisionTone
} from "./components/collection/workItemUi";
import { RepositoriesRoute } from "./components/collection/RepositoriesRoute";
import { matchesCollectionFilter } from "./components/collection/collectionUi";
import { CommandPalette, type CommandPaletteItem } from "./components/command-palette/CommandPalette";
import { AddRepositoryDialog } from "./components/dialogs/AddRepositoryDialog";
import { FileFinder } from "./components/file-finder/FileFinder";
import { HomeDashboard } from "./components/home/HomeDashboard";
import { LocalRepositoryPage } from "./components/local-repository/LocalRepositoryPage";
import {
  RepositoryContextProvider,
  type RepositoryContextValue
} from "./components/repository/RepositoryContext";
import { AgentsTab } from "./components/repository/agents/AgentsTab";
import { maxCommitHistoryLimit } from "./components/repository/CommitHistoryPanel";
import { ContributorsTab } from "./components/repository/contributors/ContributorsTab";
import { ActionsTab, useActionsTabQueries } from "./components/repository/actions/ActionsTab";
import { CodeTab } from "./components/repository/code/CodeTab";
import {
  commitRecentAuthoredDate,
  commitRecentAuthorName,
  commitRecentCommittedDate,
  commitRecentHeadline,
  notificationCommitRecentCommit,
  pullRequestReviewCommitRecentCommit,
  pullRequestTimelineEventCommitRecentCommit,
  workflowCheckSuiteCommitRecentCommit,
  workflowRunCommitRecentCommit,
  type CommitRecentCommit
} from "./components/repository/commitRecent";
import { DiscussionsTab, useDiscussionsTabQueries } from "./components/repository/discussions/DiscussionsTab";
import { expandedFileBlameRangeLimit } from "./components/repository/FileBlamePanel";
import { IssuesTab, useIssuesTabQueries } from "./components/repository/issues/IssuesTab";
import { ProjectsTab, useProjectsTabQueries } from "./components/repository/projects/ProjectsTab";
import { PullRequestsTab } from "./components/repository/pull-requests/PullRequestsTab";
import { ReleasesTab, useReleasesTabQueries } from "./components/repository/releases/ReleasesTab";
import { SecurityQualityTab } from "./components/repository/security/SecurityQualityTab";
import { RepositorySettingsTab } from "./components/repository/settings/RepositorySettingsTab";
import { WikiTab } from "./components/repository/wiki/WikiTab";
import { RightRail } from "./components/right-rail/RightRail";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { Sidebar } from "./components/sidebar/Sidebar";
import { AppEventBridge } from "./components/shell/AppEventBridge";
import { TopBar } from "./components/topbar/TopBar";

import {
  defaultContributorLimit,
  getRepositoryCounts,
  githubActionLabel,
  maxContributorLimit,
  maxProfileRepositoryLimit,
  readAvailabilityMessage,
  repositoryCollectionMetadataParts,
  repositoryMutationDisabledReason
} from "./components/repository/repositoryUi";
import {
  displayRepositoryName,
  displayRepositoryShortcutName,
  maxRepositoryListLimit,
  repositoryShortcutsFromPins
} from "./components/repository/repositorySearch";

import { useAccountWork } from "./hooks/useAccountWork";
import { useControlApi } from "./hooks/useControlApi";
import { useRepositoryDirectory } from "./hooks/useRepositoryDirectory";
import { useRepositoryRefs } from "./hooks/useRepositoryRefs";
import { repositoryScopedQueryKeys } from "./queries/repositoryQueryKeys";
import { useUiStore, type AppRoute, type LocalRepositoryTab, type RepositoryTab } from "./stores/uiStore";
import { formatCompactNumber, formatRelativeDate } from "./utils/format";

const repoTabs: Array<{ key: RepositoryTab; label: string; icon: typeof Code2 }> = [
  { key: "code", label: "Code", icon: Code2 },
  { key: "issues", label: "Issues", icon: CircleDot },
  { key: "pulls", label: "Pull requests", icon: GitPullRequest },
  { key: "actions", label: "Actions", icon: PlayCircle },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "discussions", label: "Discussions", icon: MessageSquare },
  { key: "projects", label: "Projects", icon: SquareKanban },
  { key: "releases", label: "Releases", icon: Tag },
  { key: "contributors", label: "Contributors", icon: Users },
  { key: "wiki", label: "Wiki", icon: BookOpen },
  { key: "securityQuality", label: "Security and Quality", icon: Gauge },
  { key: "settings", label: "Settings", icon: Settings }
];

const repositoryWarmPrefetchTabs = new Set<RepositoryTab>(["code", "issues", "pulls", "actions"]);

const defaultGitHubAreaId = "github:default";

function defaultGitHubAreaRepositoryId(nameWithOwner: string): string {
  return `github:default:${nameWithOwner.toLowerCase()}`;
}

type MailboxNotificationFilter = "unread" | "all" | "participating";
type PullRequestLinkedIssue =
  | NonNullable<PullRequestTimelineEventSummary["sourceIssue"]>
  | PullRequestLinkedIssueSummary;

const repositoryRefsStorageKey = "control:repository-refs";
const emptyRepoEntries: RepoEntry[] = [];
const defaultFileBlameRangeLimit = 20;
const defaultCommitHistoryLimit = 12;
const defaultRightRailCommitHistoryLimit = 3;
const defaultRepositoryListLimit = 80;
const defaultHomeRepositoryActivityLimit = 6;
const defaultRefListLimit = 50;
const expandedRefListLimit = 200;
const commandPaletteGeneralSourceLimit = 50;
const commandPaletteDenseSourceLimit = 30;
const commandPaletteSecuritySourceLimit = 30;
const defaultMemberProfileRepositoryLimit = 8;
const defaultForksLimit = 12;
const maxForksLimit = 100;
const defaultRepositoryAccessLimit = 30;
const maxRepositoryAccessLimit = 100;
const defaultActionsLimit = 20;
const maxActionsLimit = 100;
const defaultWorkflowDefinitionLimit = 50;
const maxWorkflowDefinitionLimit = 100;
const defaultProjectsLimit = 20;
const maxProjectsLimit = 100;
const defaultReleasesLimit = 20;
const maxReleasesLimit = 100;
const defaultDiscussionsLimit = 30;
const maxDiscussionsLimit = 100;
const defaultWikiPageLimit = 50;
const defaultSecurityListLimit = 20;
const maxSecurityListLimit = 100;
const defaultOrganizationListLimit = 50;
const maxOrganizationListLimit = 100;
const defaultOrganizationRepositoryLimit = 50;
const maxOrganizationRepositoryLimit = 100;
const defaultOrganizationTeamLimit = 30;
const maxOrganizationTeamLimit = 100;
const defaultOrganizationMemberLimit = 30;
const maxOrganizationMemberLimit = 100;
const defaultOrganizationProjectLimit = 20;
const maxOrganizationProjectLimit = 100;
const defaultOrganizationTeamRepositoryLimit = 30;
const maxOrganizationTeamRepositoryLimit = 100;
const defaultOrganizationTeamMemberLimit = 30;
const maxOrganizationTeamMemberLimit = 100;
const defaultMailboxListLimit = 30;
const maxMailboxListLimit = 100;
const defaultRecentItemLimit = 12;
const defaultIssueListLimit = 50;
const maxIssueListLimit = 100;
const defaultPullRequestListLimit = 50;
const maxPullRequestListLimit = 100;

function unknownableCompactNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "unknown" : formatCompactNumber(value);
}

function repositoryForkMetadataLabel(repository: RepositoryRef): string {
  const visibility =
    repository.visibility ??
    (repository.isPrivate === null || repository.isPrivate === undefined
      ? "unknown visibility"
      : repository.isPrivate
        ? "private"
        : "public");
  const permission = repository.viewerPermission ?? "unknown permission";

  return [
    visibility.toLowerCase(),
    `${unknownableCompactNumber(repository.stargazerCount)} stars`,
    `${unknownableCompactNumber(repository.forkCount)} forks`,
    permission.toLowerCase()
  ].join(" · ");
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

function createGitHubMutationInput(
  action: GitHubAction,
  owner: string,
  repo: string,
  payload: GitHubMutationFields = {}
): GitHubMutationInput {
  return { action, owner, repo, ...payload } as GitHubMutationInput;
}

function mutationAffectsAccountIssues(action: GitHubAction): boolean {
  return (
    action === "createIssue" ||
    action === "editIssue" ||
    action === "closeIssue" ||
    action === "reopenIssue" ||
    action === "addComment" ||
    action === "editComment" ||
    action === "deleteComment" ||
    action === "addLabels" ||
    action === "removeLabel" ||
    action === "setAssignees" ||
    action === "removeAssignees" ||
    action === "editRepository"
  );
}

function mutationAffectsAccountProfile(action: GitHubAction): boolean {
  return action === "star" || action === "unstar" || action === "fork";
}

function mutationAffectsRepositoryCollections(action: GitHubAction): boolean {
  return (
    action === "star" ||
    action === "unstar" ||
    action === "watch" ||
    action === "unwatch" ||
    action === "fork" ||
    action === "editRepository" ||
    action === "createIssue" ||
    action === "closeIssue" ||
    action === "reopenIssue" ||
    action === "createPullRequest" ||
    action === "mergePullRequest" ||
    action === "closePullRequest" ||
    action === "reopenPullRequest" ||
    action === "createRelease" ||
    action === "editRelease" ||
    action === "deleteRelease" ||
    action === "deleteReleaseAsset" ||
    action === "createDiscussion" ||
    action === "editDiscussion" ||
    action === "closeDiscussion" ||
    action === "reopenDiscussion" ||
    action === "addDiscussionComment" ||
    action === "editDiscussionComment" ||
    action === "deleteDiscussionComment" ||
    action === "createProjectV2" ||
    action === "updateProjectV2" ||
    action === "deleteProjectV2" ||
    action === "addProjectV2Item" ||
    action === "updateProjectV2Item" ||
    action === "deleteProjectV2Item" ||
    action === "rerunWorkflow" ||
    action === "rerunFailedWorkflowJobs" ||
    action === "rerunWorkflowJob" ||
    action === "dispatchWorkflow" ||
    action === "cancelWorkflow"
  );
}

function mutationAffectsAccountPulls(action: GitHubAction): boolean {
  return (
    action === "createPullRequest" ||
    action === "mergePullRequest" ||
    action === "closePullRequest" ||
    action === "reopenPullRequest" ||
    action === "approvePullRequest" ||
    action === "commentPullRequestReview" ||
    action === "requestChanges" ||
    action === "requestReviewers" ||
    action === "removeReviewers" ||
    action === "editReviewComment" ||
    action === "deleteReviewComment" ||
    action === "editIssue" ||
    action === "addComment" ||
    action === "editComment" ||
    action === "deleteComment" ||
    action === "addLabels" ||
    action === "removeLabel" ||
    action === "setAssignees" ||
    action === "removeAssignees" ||
    action === "editRepository"
  );
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

function browserStorageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readRepositoryRefs(): Record<string, string | null> {
  const serialized = browserStorageOrNull()?.getItem(repositoryRefsStorageKey);
  if (!serialized) {
    return {};
  }

  try {
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string | null] =>
          typeof entry[0] === "string" && (typeof entry[1] === "string" || entry[1] === null)
      )
    );
  } catch {
    return {};
  }
}

function writeRepositoryRefs(refs: Record<string, string | null>): void {
  browserStorageOrNull()?.setItem(repositoryRefsStorageKey, JSON.stringify(refs));
}

type OrganizationCollectionRepositorySummary =
  | OrganizationRepositorySummary
  | OrganizationTeamRepositorySummary;

function organizationRepositoryCollectionMetadataParts(
  repository: OrganizationCollectionRepositorySummary
): string[] {
  const nameWithOwner = repository.nameWithOwner.includes("/")
    ? repository.nameWithOwner
    : `${repository.owner}/${repository.name}`;
  const parts = [
    nameWithOwner,
    repository.permission ? `${repository.permission} access` : null,
    repository.defaultBranch ? `default ${repository.defaultBranch}` : null,
    repository.pushedAt ? `pushed ${formatRelativeDate(repository.pushedAt)}` : null,
    repository.updatedAt && repository.updatedAt !== repository.pushedAt
      ? `updated ${formatRelativeDate(repository.updatedAt)}`
      : null,
    !repository.pushedAt && !repository.updatedAt ? "activity unknown" : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}

function organizationRepositoryCollectionChips(
  repository: OrganizationCollectionRepositorySummary,
  pinned: boolean
): string[] {
  const visibility = repository.visibility?.toLowerCase() ?? null;
  const privacy =
    typeof repository.isPrivate === "boolean" ? (repository.isPrivate ? "private" : "public") : null;
  const parts = [
    visibility ?? privacy,
    pinned ? "pinned" : null,
    privacy && visibility && visibility !== privacy ? privacy : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}

function repositoryRecentInput(
  nameWithOwner: string,
  repository?: RepositorySummary | RepositoryDetail,
  tab?: RepositoryTab | null,
  ref?: string | null,
  refKind: "branch" | "tag" | "ref" = "ref"
): LocalRecentRecordInput {
  const tabLabel = tab ? repoTabs.find((repoTab) => repoTab.key === tab)?.label : null;
  const normalizedRef = ref?.trim() || null;
  const refLabel =
    normalizedRef && refKind === "branch"
      ? `Branch ${normalizedRef}`
      : normalizedRef && refKind === "tag"
        ? `Tag ${normalizedRef}`
        : normalizedRef
          ? `Ref ${normalizedRef}`
          : null;
  const subtitle = [refLabel, repository?.description ?? "Repository", tabLabel].filter(Boolean).join(" · ");
  const resolvedNameWithOwner = repository?.nameWithOwner ?? nameWithOwner;

  return {
    kind: "repository",
    itemKey: normalizedRef ? `${resolvedNameWithOwner}:ref:${normalizedRef}` : resolvedNameWithOwner,
    title: normalizedRef ? `${resolvedNameWithOwner} @ ${normalizedRef}` : resolvedNameWithOwner,
    subtitle,
    repositoryNameWithOwner: resolvedNameWithOwner,
    url: `https://github.com/${resolvedNameWithOwner}`,
    metadata: {
      defaultBranch: repository?.defaultBranch ?? null,
      visibility: repository?.visibility ?? null,
      tab: tab ?? null,
      ref: normalizedRef,
      refKind: normalizedRef ? refKind : null
    }
  };
}

function contributorRecentInput(
  nameWithOwner: string,
  contributor: ContributorSummary
): LocalRecentRecordInput {
  return {
    kind: "contributor",
    itemKey: `${nameWithOwner}/contributors/${contributor.login}`,
    title: `@${contributor.login}`,
    subtitle: `${formatCompactNumber(contributor.contributions)} contributions · ${nameWithOwner}`,
    repositoryNameWithOwner: nameWithOwner,
    url: contributor.htmlUrl ?? `https://github.com/${contributor.login}`,
    metadata: {
      login: contributor.login,
      id: contributor.id,
      contributions: contributor.contributions,
      avatarUrl: contributor.avatarUrl ?? null,
      htmlUrl: contributor.htmlUrl ?? null
    }
  };
}

function organizationRecentInput(organization: OrganizationSummary): LocalRecentRecordInput {
  const membershipLabel =
    organization.viewerMembershipRole ??
    (organization.viewerCanAdminister
      ? "admin"
      : organization.viewerIsMember
        ? "member"
        : "outside collaborator");

  return {
    kind: "organization",
    itemKey: organization.login,
    title: organization.name ?? organization.login,
    subtitle: `${organization.login} · ${membershipLabel}`,
    url: organization.htmlUrl,
    metadata: {
      login: organization.login,
      membershipRole: organization.viewerMembershipRole ?? membershipLabel,
      membershipState: organization.viewerMembershipState ?? null
    }
  };
}

function teamRecentInput(team: TeamSummary): LocalRecentRecordInput {
  return {
    kind: "team",
    itemKey: `${team.organizationLogin}/${team.slug}`,
    title: team.name,
    subtitle: `${team.organizationLogin}/${team.slug}${team.privacy ? ` · ${team.privacy}` : ""}`,
    url: team.htmlUrl,
    metadata: {
      organizationLogin: team.organizationLogin,
      slug: team.slug,
      privacy: team.privacy ?? null,
      permission: team.permission ?? null
    }
  };
}

function fileRecentInput({
  nameWithOwner,
  path,
  ref,
  entryType,
  line
}: {
  nameWithOwner: string;
  path: string;
  ref: string | null;
  entryType: "file" | "dir";
  line?: number | null;
}): LocalRecentRecordInput {
  const [repoName = nameWithOwner] = nameWithOwner.split("/").slice(-1);
  const label = path.split("/").filter(Boolean).pop() ?? path;
  const encodedPath = encodeRepositoryPath(path);
  const branch = ref ?? "HEAD";
  const normalizedLine = normalizeCodeLineNumber(line);

  return {
    kind: "file",
    itemKey: `${nameWithOwner}:${branch}:${path}`,
    title: label,
    subtitle: `${repoName}/${path}${normalizedLine ? `:${normalizedLine}` : ""}`,
    repositoryNameWithOwner: nameWithOwner,
    url: `https://github.com/${nameWithOwner}/${entryType === "dir" ? "tree" : "blob"}/${encodeURIComponent(branch)}/${encodedPath}`,
    metadata: {
      path,
      ref,
      entryType,
      line: normalizedLine
    }
  };
}

function commitRecentInput({
  nameWithOwner,
  commit,
  path,
  entryType,
  line
}: {
  nameWithOwner: string;
  commit: CommitRecentCommit;
  path?: string | null;
  entryType?: "file" | "dir" | null;
  line?: number | null;
}): LocalRecentRecordInput {
  const normalizedPath = path?.trim() ?? "";
  const normalizedEntryType = entryType ?? (normalizedPath ? "file" : "dir");
  const normalizedLine = normalizeCodeLineNumber(line);
  const headline = commitRecentHeadline(commit);
  const authoredDate = commitRecentAuthoredDate(commit);
  const committedDate = commitRecentCommittedDate(commit);
  const authorName = commitRecentAuthorName(commit);
  const title = headline.trim() || commit.sha.slice(0, 7);
  const date = committedDate ?? authoredDate;
  const author = commit.authorLogin ?? authorName ?? "unknown";

  return {
    kind: "commit",
    itemKey: `${nameWithOwner}:commit:${commit.sha}${normalizedPath ? `:${normalizedPath}` : ""}`,
    title,
    subtitle: `${nameWithOwner} · ${commit.sha.slice(0, 7)} · ${author}`,
    repositoryNameWithOwner: nameWithOwner,
    url: commit.htmlUrl ?? `https://github.com/${nameWithOwner}/commit/${commit.sha}`,
    metadata: {
      sha: commit.sha,
      headline,
      authorLogin: commit.authorLogin ?? null,
      authorName,
      authoredDate,
      committedDate,
      date: date ?? null,
      path: normalizedPath || null,
      entryType: normalizedEntryType,
      line: normalizedLine,
      htmlUrl: commit.htmlUrl ?? null
    }
  };
}

function issueRecentInput(nameWithOwner: string, issue: IssueSummary): LocalRecentRecordInput {
  return {
    kind: "issue",
    itemKey: `${nameWithOwner}:issue:${issue.number}`,
    title: `#${issue.number} ${issue.title}`,
    subtitle: `${nameWithOwner} issue · ${issue.state}`,
    repositoryNameWithOwner: nameWithOwner,
    url: issue.htmlUrl,
    metadata: {
      number: issue.number,
      state: issue.state
    }
  };
}

function issueReferenceRecentInput(
  nameWithOwner: string,
  number: number,
  url: string
): LocalRecentRecordInput {
  return {
    kind: "issue",
    itemKey: `${nameWithOwner}:issue:${number}`,
    title: `#${number} Issue`,
    subtitle: `${nameWithOwner} issue`,
    repositoryNameWithOwner: nameWithOwner,
    url,
    metadata: {
      number
    }
  };
}

function linkedIssueRecentInput(
  nameWithOwner: string,
  issue: PullRequestLinkedIssue
): LocalRecentRecordInput {
  return {
    kind: "issue",
    itemKey: `${nameWithOwner}:issue:${issue.number}`,
    title: `#${issue.number} ${issue.title ?? "Issue"}`,
    subtitle: `${nameWithOwner} linked issue`,
    repositoryNameWithOwner: nameWithOwner,
    url: issue.htmlUrl,
    metadata: {
      number: issue.number
    }
  };
}

function pullRequestRecentInput(
  nameWithOwner: string,
  pullRequest: PullRequestSummary
): LocalRecentRecordInput {
  const headRepositoryNameWithOwner = pullRequest.headRepositoryNameWithOwner ?? null;
  const baseRepositoryNameWithOwner = pullRequest.baseRepositoryNameWithOwner ?? null;
  const sourceRepositoryNameWithOwner =
    headRepositoryNameWithOwner && headRepositoryNameWithOwner !== nameWithOwner
      ? headRepositoryNameWithOwner
      : null;
  const isCrossRepository =
    (headRepositoryNameWithOwner !== null && headRepositoryNameWithOwner !== nameWithOwner) ||
    (baseRepositoryNameWithOwner !== null && baseRepositoryNameWithOwner !== nameWithOwner);

  return {
    kind: "pullRequest",
    itemKey: `${nameWithOwner}:pull:${pullRequest.number}`,
    title: `#${pullRequest.number} ${pullRequest.title}`,
    subtitle: `${
      sourceRepositoryNameWithOwner ? `Source ${sourceRepositoryNameWithOwner} · ` : ""
    }${pullRequest.headRefName} -> ${pullRequest.baseRefName} · ${pullRequest.state}`,
    repositoryNameWithOwner: nameWithOwner,
    url: pullRequest.htmlUrl,
    metadata: {
      number: pullRequest.number,
      state: pullRequest.state,
      headRefName: pullRequest.headRefName,
      baseRefName: pullRequest.baseRefName,
      headRepositoryNameWithOwner,
      baseRepositoryNameWithOwner,
      isCrossRepository
    }
  };
}

function pullRequestReferenceRecentInput(
  nameWithOwner: string,
  number: number,
  url: string
): LocalRecentRecordInput {
  return {
    kind: "pullRequest",
    itemKey: `${nameWithOwner}:pull:${number}`,
    title: `#${number} Pull request`,
    subtitle: `${nameWithOwner} pull request`,
    repositoryNameWithOwner: nameWithOwner,
    url,
    metadata: {
      number
    }
  };
}

function workflowRunRecentInput(nameWithOwner: string, run: WorkflowRunSummary): LocalRecentRecordInput {
  const sourceRepositoryNameWithOwner =
    run.headRepositoryNameWithOwner && run.headRepositoryNameWithOwner !== nameWithOwner
      ? run.headRepositoryNameWithOwner
      : null;
  return {
    kind: "workflowRun",
    itemKey: `${nameWithOwner}:workflow:${run.id}`,
    title: run.name,
    subtitle: `${nameWithOwner}${
      sourceRepositoryNameWithOwner ? ` · Source ${sourceRepositoryNameWithOwner}` : ""
    } · ${run.event} · ${run.branch ?? "unknown branch"}`,
    repositoryNameWithOwner: nameWithOwner,
    url: run.htmlUrl,
    metadata: {
      runId: run.id,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.branch,
      headRepositoryNameWithOwner: run.headRepositoryNameWithOwner ?? null
    }
  };
}

function workflowRunReferenceRecentInput(
  nameWithOwner: string,
  runId: number,
  url?: string | null
): LocalRecentRecordInput {
  return {
    kind: "workflowRun",
    itemKey: `${nameWithOwner}:workflow:${runId}`,
    title: `Workflow run ${runId}`,
    subtitle: `${nameWithOwner} workflow run`,
    repositoryNameWithOwner: nameWithOwner,
    url: url ?? null,
    metadata: {
      runId
    }
  };
}

function workflowArtifactRecentInput(
  nameWithOwner: string,
  run: WorkflowRunSummary | WorkflowRunDetail,
  artifact: WorkflowRunArtifactSummary
): LocalRecentRecordInput {
  const runTitle = run.displayTitle ?? run.name;
  return {
    kind: "workflowArtifact",
    itemKey: `${nameWithOwner}:workflow:${run.id}:artifact:${artifact.id}`,
    title: artifact.name,
    subtitle: `${nameWithOwner} workflow artifact · ${runTitle} · ${formatCompactNumber(
      artifact.sizeInBytes
    )} bytes`,
    repositoryNameWithOwner: nameWithOwner,
    url: artifact.archiveDownloadUrl ?? run.htmlUrl,
    metadata: {
      runId: run.id,
      runName: run.name,
      runTitle,
      runNumber: run.runNumber,
      runAttempt: run.runAttempt,
      artifactId: artifact.id,
      artifactName: artifact.name,
      sizeInBytes: artifact.sizeInBytes,
      expired: artifact.expired,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
      expiresAt: artifact.expiresAt,
      branch: run.branch,
      event: run.event,
      conclusion: run.conclusion,
      status: run.status
    }
  };
}

function wikiPageRecentInput(
  nameWithOwner: string,
  page: WikiPageSummary | WikiPageContent
): LocalRecentRecordInput {
  return {
    kind: "wikiPage",
    itemKey: `${nameWithOwner}:wiki:${page.path}`,
    title: page.title,
    subtitle: `${nameWithOwner} wiki page · ${page.path}`,
    repositoryNameWithOwner: nameWithOwner,
    url: page.htmlUrl,
    metadata: {
      path: page.path,
      title: page.title,
      sha: page.sha,
      size: page.size,
      htmlUrl: page.htmlUrl
    }
  };
}

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

function securityItemRecentInput(
  repositoryNameWithOwner: string,
  item: SecurityItemRecentInput
): LocalRecentRecordInput {
  return {
    kind: "securityItem",
    itemKey: `${repositoryNameWithOwner}:security:${item.kind}:${item.id}`,
    title: item.title,
    subtitle: item.subtitle ?? `${repositoryNameWithOwner} security item`,
    repositoryNameWithOwner,
    url: item.url ?? null,
    metadata: {
      securityItemKind: item.kind,
      securityItemId: item.id,
      repositoryNameWithOwner,
      state: item.state ?? null,
      severity: item.severity ?? null,
      path: item.path ?? null,
      rule: item.rule ?? null,
      packageName: item.packageName ?? null,
      ghsaId: item.ghsaId ?? null,
      cveId: item.cveId ?? null,
      updatedAt: item.updatedAt ?? null
    }
  };
}

function releaseRecentInput(nameWithOwner: string, release: ReleaseSummary): LocalRecentRecordInput {
  return {
    kind: "release",
    itemKey: `${nameWithOwner}:release:${release.tagName}`,
    title: release.name || release.tagName,
    subtitle: `${nameWithOwner} release · ${release.isDraft ? "draft" : "published"}`,
    repositoryNameWithOwner: nameWithOwner,
    url: release.htmlUrl,
    metadata: {
      tagName: release.tagName,
      releaseId: release.id,
      draft: release.isDraft,
      prerelease: release.isPrerelease
    }
  };
}

function releaseTagReferenceRecentInput(
  nameWithOwner: string,
  tagName: string,
  url: string
): LocalRecentRecordInput {
  return {
    kind: "release",
    itemKey: `${nameWithOwner}:release:${tagName}`,
    title: tagName,
    subtitle: `${nameWithOwner} release`,
    repositoryNameWithOwner: nameWithOwner,
    url,
    metadata: {
      tagName
    }
  };
}

function releaseAssetRecentInput(
  nameWithOwner: string,
  release: ReleaseSummary,
  asset: ReleaseAssetSummary
): LocalRecentRecordInput {
  const releaseTitle = release.name || release.tagName;
  return {
    kind: "releaseAsset",
    itemKey: `${nameWithOwner}:release:${release.id}:asset:${asset.id}`,
    title: asset.name,
    subtitle: `${nameWithOwner} release asset · ${releaseTitle}`,
    repositoryNameWithOwner: nameWithOwner,
    url: asset.browserDownloadUrl ?? release.htmlUrl,
    metadata: {
      releaseId: release.id,
      tagName: release.tagName,
      releaseTitle,
      assetId: asset.id,
      assetName: asset.name,
      contentType: asset.contentType,
      state: asset.state,
      sizeInBytes: asset.sizeInBytes,
      downloadCount: asset.downloadCount,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    }
  };
}

function discussionRecentInput(nameWithOwner: string, discussion: DiscussionSummary): LocalRecentRecordInput {
  return {
    kind: "discussion",
    itemKey: `${nameWithOwner}:discussion:${discussion.number}`,
    title: `#${discussion.number} ${discussion.title}`,
    subtitle: `${nameWithOwner} discussion · ${discussion.category ?? "uncategorized"}`,
    repositoryNameWithOwner: nameWithOwner,
    url: discussion.htmlUrl,
    metadata: {
      number: discussion.number,
      closed: discussion.closed,
      answered: discussion.isAnswered,
      category: discussion.category
    }
  };
}

function discussionReferenceRecentInput(
  nameWithOwner: string,
  number: number,
  url: string
): LocalRecentRecordInput {
  return {
    kind: "discussion",
    itemKey: `${nameWithOwner}:discussion:${number}`,
    title: `#${number} Discussion`,
    subtitle: `${nameWithOwner} discussion`,
    repositoryNameWithOwner: nameWithOwner,
    url,
    metadata: {
      number
    }
  };
}

function projectRecentInput(nameWithOwner: string, project: ProjectSummary): LocalRecentRecordInput {
  return {
    kind: "project",
    itemKey: `${nameWithOwner}:project:${project.id}`,
    title: project.number ? `#${project.number} ${project.title}` : project.title,
    subtitle: `${nameWithOwner} project · ${project.closed ? "closed" : "open"}`,
    repositoryNameWithOwner: nameWithOwner,
    url: project.htmlUrl,
    metadata: {
      projectId: project.id,
      number: project.number,
      closed: project.closed,
      ownerLogin: project.ownerLogin,
      ownerKind: project.ownerKind
    }
  };
}

function organizationProjectRecentInput(
  organization: OrganizationSummary,
  project: ProjectSummary
): LocalRecentRecordInput {
  return {
    kind: "project",
    itemKey: `${organization.login}:project:${project.id}`,
    title: project.number ? `#${project.number} ${project.title}` : project.title,
    subtitle: `${organization.login} project · ${project.closed ? "closed" : "open"}`,
    url: project.htmlUrl,
    metadata: {
      organizationLogin: organization.login,
      projectId: project.id,
      number: project.number,
      title: project.title,
      closed: project.closed,
      ownerLogin: project.ownerLogin,
      ownerKind: project.ownerKind,
      isPublic: project.isPublic
    }
  };
}

function repositoryNameWithOwnerFromGitHubUrl(url: string): string | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\//);
  return match?.[1] ?? null;
}

interface GitHubBlobRoute {
  nameWithOwner: string;
  ref: string;
  path: string;
  line: number | null;
}

interface GitHubCodeUrlRoute extends GitHubBlobRoute {
  entryType: "file" | "dir";
}

const githubNonRepositoryPathRoots = new Set([
  "about",
  "apps",
  "collections",
  "contact",
  "customer-stories",
  "enterprise",
  "events",
  "explore",
  "features",
  "login",
  "marketplace",
  "mobile",
  "new",
  "notifications",
  "orgs",
  "pricing",
  "pulls",
  "readme",
  "search",
  "security",
  "settings",
  "signup",
  "sponsors",
  "team",
  "topics",
  "trending"
]);

function parseGitHubRepositoryUrl(
  url: string
): { nameWithOwner: string; segments: string[]; hash: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments.length < 2) {
      return null;
    }
    if (githubNonRepositoryPathRoots.has(segments[0])) {
      return null;
    }

    return {
      nameWithOwner: `${segments[0]}/${segments[1]}`,
      segments,
      hash: parsed.hash
    };
  } catch {
    return null;
  }
}

function parseGitHubBlobUrl(
  url: string | null | undefined,
  expectedPath?: string | null
): GitHubBlobRoute | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments.length < 5 || segments[2] !== "blob") {
      return null;
    }
    const blobSegments = segments.slice(3);
    const expectedPathSegments = expectedPath?.split("/").filter(Boolean) ?? [];
    const matchingExpectedPath =
      expectedPathSegments.length > 0 &&
      blobSegments.length > expectedPathSegments.length &&
      expectedPathSegments.every(
        (segment, index) =>
          segment === blobSegments[blobSegments.length - expectedPathSegments.length + index]
      );
    const refSegments = matchingExpectedPath
      ? blobSegments.slice(0, blobSegments.length - expectedPathSegments.length)
      : blobSegments.slice(0, 1);
    const pathSegments = matchingExpectedPath
      ? blobSegments.slice(blobSegments.length - expectedPathSegments.length)
      : blobSegments.slice(1);

    return {
      nameWithOwner: `${segments[0]}/${segments[1]}`,
      ref: refSegments.join("/"),
      path: pathSegments.join("/"),
      line: normalizeGitHubBlobLine(parsed.hash)
    };
  } catch {
    return null;
  }
}

function parseGitHubCodeUrl(
  url: string,
  refs: string[],
  fallbackRef: string | null | undefined
): GitHubCodeUrlRoute | null {
  const parsed = parseGitHubRepositoryUrl(url);
  if (!parsed || parsed.segments.length < 4) {
    return null;
  }

  const [, , kind, ...codeSegments] = parsed.segments;
  if ((kind !== "blob" && kind !== "tree") || codeSegments.length === 0) {
    return null;
  }

  const normalizedRefs = refs
    .map(normalizeGitHubCodeRef)
    .filter((ref): ref is string => Boolean(ref))
    .sort((left, right) => right.split("/").length - left.split("/").length || right.length - left.length);
  const matchedRef = normalizedRefs.find((ref) => {
    const refSegments = ref.split("/").filter(Boolean);
    return refSegments.length > 0 && refSegments.every((segment, index) => codeSegments[index] === segment);
  });
  const refSegmentCount = matchedRef?.split("/").filter(Boolean).length ?? 1;
  const ref = matchedRef ?? normalizeGitHubCodeRef(fallbackRef) ?? codeSegments[0] ?? null;
  if (!ref) {
    return null;
  }

  return {
    nameWithOwner: parsed.nameWithOwner,
    ref,
    path: codeSegments.slice(refSegmentCount).join("/"),
    entryType: kind === "blob" ? "file" : "dir",
    line: kind === "blob" ? normalizeGitHubBlobLine(parsed.hash) : null
  };
}

function normalizeGitHubBlobLine(hash: string): number | null {
  const match = hash.match(/^#L(\d+)/);
  return normalizeCodeLineNumber(match ? Number(match[1]) : null);
}

function normalizeGitHubCodeRef(ref: string | null | undefined): string | null {
  const trimmedRef = ref?.trim();
  if (!trimmedRef) {
    return null;
  }

  return trimmedRef.replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "");
}

interface NotificationInAppTarget {
  kind: "repository" | "commit" | "issue" | "pullRequest" | "discussion" | "release" | "workflowRun";
  commitSha?: string;
  number?: number;
  releaseId?: number;
  runId?: number;
  tagName?: string;
  tab: RepositoryTab;
}

function parseNotificationSubjectNumber(
  notification: NotificationSummary,
  pathName: "issues" | "pull" | "pulls" | "discussions"
): number | null {
  const sources = [
    notification.subject.htmlUrl,
    notification.htmlUrl,
    notification.subject.apiUrl,
    notification.subject.latestCommentApiUrl
  ];
  const pattern = new RegExp(`/${pathName}/(\\d+)(?:[/?#]|$)`);

  for (const source of sources) {
    const match = source?.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function parseNotificationReleaseTagName(notification: NotificationSummary): string | null {
  const sources = [notification.subject.htmlUrl, notification.htmlUrl, notification.subject.apiUrl];

  for (const source of sources) {
    const match = source?.match(/\/releases\/tag\/([^/?#]+)(?:[/?#]|$)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

function parseNotificationReleaseId(notification: NotificationSummary): number | null {
  const sources = [notification.subject.apiUrl, notification.subject.htmlUrl, notification.htmlUrl];

  for (const source of sources) {
    const match = source?.match(/\/releases\/(\d+)(?:[/?#]|$)/);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function parseNotificationCommitSha(notification: NotificationSummary): string | null {
  const sources = [
    notification.subject.htmlUrl,
    notification.htmlUrl,
    notification.subject.apiUrl,
    notification.subject.latestCommentApiUrl
  ];

  for (const source of sources) {
    const match = source?.match(/\/commits?\/([a-f0-9]{7,40})(?:[/?#]|$)/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function parseWorkflowRunIdFromUrl(url: string | null | undefined): number | null {
  const match = url?.match(/\/actions\/runs\/(\d+)(?:[/?#]|$)/);
  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]);
}

function parseNotificationWorkflowRunId(notification: NotificationSummary): number | null {
  const sources = [notification.subject.htmlUrl, notification.htmlUrl, notification.subject.apiUrl];

  for (const source of sources) {
    const runId = parseWorkflowRunIdFromUrl(source);
    if (runId !== null) {
      return runId;
    }
  }

  return null;
}

function notificationInAppTarget(notification: NotificationSummary): NotificationInAppTarget | null {
  const type = notification.subject.type.toLowerCase().replace(/[\s-]+/g, "_");
  const pullNumber =
    parseNotificationSubjectNumber(notification, "pull") ??
    parseNotificationSubjectNumber(notification, "pulls");

  if (pullNumber !== null && Number.isFinite(pullNumber)) {
    return { kind: "pullRequest", number: pullNumber, tab: "pulls" };
  }

  const issueNumber = parseNotificationSubjectNumber(notification, "issues");
  if ((type === "issue" || issueNumber !== null) && issueNumber !== null && Number.isFinite(issueNumber)) {
    return { kind: "issue", number: issueNumber, tab: "issues" };
  }

  const discussionNumber = parseNotificationSubjectNumber(notification, "discussions");
  if (
    (type === "discussion" || discussionNumber !== null) &&
    discussionNumber !== null &&
    Number.isFinite(discussionNumber)
  ) {
    return { kind: "discussion", number: discussionNumber, tab: "discussions" };
  }

  if (type.includes("pull_request") || type.includes("pullrequest")) {
    return { kind: "repository", tab: "pulls" };
  }

  if (type.includes("issue")) {
    return { kind: "repository", tab: "issues" };
  }

  if (type.includes("discussion")) {
    return { kind: "repository", tab: "discussions" };
  }

  const releaseTagName = parseNotificationReleaseTagName(notification);
  const releaseId = parseNotificationReleaseId(notification);
  if (
    (type === "release" || releaseTagName || releaseId !== null) &&
    (releaseTagName || releaseId !== null)
  ) {
    return {
      kind: "release",
      releaseId: releaseId ?? undefined,
      tagName: releaseTagName ?? undefined,
      tab: "releases"
    };
  }

  if (type.includes("release")) {
    return { kind: "repository", tab: "releases" };
  }

  const workflowRunId = parseNotificationWorkflowRunId(notification);
  if (
    (type.includes("workflow") || type.includes("check") || workflowRunId !== null) &&
    workflowRunId !== null
  ) {
    return { kind: "workflowRun", runId: workflowRunId, tab: "actions" };
  }

  if (type.includes("workflow") || type.includes("check")) {
    return { kind: "repository", tab: "actions" };
  }

  if (
    type.includes("security") ||
    type.includes("vulnerability") ||
    type.includes("dependabot") ||
    type.includes("secret_scanning") ||
    type.includes("code_scanning")
  ) {
    return { kind: "repository", tab: "securityQuality" };
  }

  if (type.includes("commit") || type === "repository") {
    const commitSha = parseNotificationCommitSha(notification);
    if (commitSha) {
      return { kind: "commit", commitSha, tab: "code" };
    }

    return { kind: "repository", tab: "code" };
  }

  return null;
}

function notificationRecentInput(
  notification: NotificationSummary,
  target: NotificationInAppTarget
): LocalRecentRecordInput {
  if (target.kind === "repository" || target.kind === "commit") {
    const tabLabel = repoTabs.find((tab) => tab.key === target.tab)?.label ?? "Repository";
    return {
      kind: "repository",
      itemKey:
        target.kind === "commit" && target.commitSha
          ? `${notification.repositoryNameWithOwner}:commit:${target.commitSha}`
          : `${notification.repositoryNameWithOwner}:notification:${target.tab}:${notification.subject.type}`,
      title: notification.subject.title,
      subtitle: `${notification.repositoryNameWithOwner} ${tabLabel} · ${notificationReasonLabel(notification.reason)}`,
      repositoryNameWithOwner: notification.repositoryNameWithOwner,
      url: notificationTargetUrl(notification),
      metadata: {
        tab: target.tab,
        ref: target.kind === "commit" ? (target.commitSha ?? null) : null,
        unread: notification.unread,
        reason: notification.reason,
        subjectType: notification.subject.type
      }
    };
  }

  if (target.kind === "release") {
    const tagName = target.tagName ?? notification.subject.title;
    const itemKey = target.releaseId
      ? `${notification.repositoryNameWithOwner}:release:${target.releaseId}`
      : `${notification.repositoryNameWithOwner}:release:${tagName}`;
    return {
      kind: "release",
      itemKey,
      title: tagName,
      subtitle: `${notification.repositoryNameWithOwner} release · ${notificationReasonLabel(notification.reason)}`,
      repositoryNameWithOwner: notification.repositoryNameWithOwner,
      url: notificationTargetUrl(notification),
      metadata: {
        tagName,
        releaseId: target.releaseId ?? null,
        unread: notification.unread,
        reason: notification.reason,
        subjectType: notification.subject.type
      }
    };
  }

  if (target.kind === "workflowRun") {
    const runId = target.runId ?? 0;
    return {
      kind: "workflowRun",
      itemKey: `${notification.repositoryNameWithOwner}:workflow:${runId}`,
      title: notification.subject.title,
      subtitle: `${notification.repositoryNameWithOwner} workflow run · ${notificationReasonLabel(notification.reason)}`,
      repositoryNameWithOwner: notification.repositoryNameWithOwner,
      url: notificationTargetUrl(notification),
      metadata: {
        runId,
        unread: notification.unread,
        reason: notification.reason,
        subjectType: notification.subject.type
      }
    };
  }

  const number = target.number ?? 0;
  const kind =
    target.kind === "issue" ? "issue" : target.kind === "discussion" ? "discussion" : "pullRequest";
  const label =
    target.kind === "issue" ? "issue" : target.kind === "discussion" ? "discussion" : "pull request";
  const keyKind = target.kind === "pullRequest" ? "pull" : target.kind;
  return {
    kind,
    itemKey: `${notification.repositoryNameWithOwner}:${keyKind}:${number}`,
    title: `#${number} ${notification.subject.title}`,
    subtitle: `${notification.repositoryNameWithOwner} ${label} · ${notificationReasonLabel(notification.reason)}`,
    repositoryNameWithOwner: notification.repositoryNameWithOwner,
    url: notificationTargetUrl(notification),
    metadata: {
      number,
      unread: notification.unread,
      reason: notification.reason,
      subjectType: notification.subject.type
    }
  };
}

function recentItemRecordInput(item: LocalRecentItem): LocalRecentRecordInput {
  return {
    kind: item.kind,
    provider: item.provider,
    itemKey: item.itemKey,
    title: item.title,
    subtitle: item.subtitle,
    repositoryNameWithOwner: item.repositoryNameWithOwner,
    areaId: item.areaId,
    repositoryId: item.repositoryId,
    workspaceId: item.workspaceId,
    url: item.url,
    metadata: item.metadata
  };
}

function recentMetadataString(item: LocalRecentItem, key: string): string | null {
  const value = item.metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function recentMetadataNumber(item: LocalRecentItem, key: string): number | null {
  const value = item.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recentMetadataKeyword(item: LocalRecentItem, key: string): string {
  const value = item.metadata[key];
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function recentMetadataBooleanKeyword(item: LocalRecentItem, key: string): string {
  const value = item.metadata[key];
  return typeof value === "boolean" ? (value ? key : `not ${key}`) : "";
}

function routeTitle(route: AppRoute): string {
  switch (route.kind) {
    case "mailbox":
      return "Mailbox";
    case "repositories":
      return "Repositories";
    case "organizations":
      return "Organizations";
    case "repository":
      return route.nameWithOwner;
    case "codeBrowser":
      return `${route.nameWithOwner}/${route.path}`;
    case "localRepository":
      return "Local repository";
    case "home":
    default:
      return "Home";
  }
}

export function App(): JSX.Element {
  const api = useControlApi();
  const queryClient = useQueryClient();
  const route = useUiStore((state) => state.route);
  const selectedAreaId = useUiStore((state) => state.selectedAreaId);
  const selectedRepository = useUiStore((state) => state.selectedRepository);
  const navigate = useUiStore((state) => state.navigate);
  const selectAreaInStore = useUiStore((state) => state.selectArea);
  const goToRepository = useUiStore((state) => state.goToRepository);
  const goToLocalRepository = useUiStore((state) => state.goToLocalRepository);
  const openCodeBrowser = useUiStore((state) => state.openCodeBrowser);
  const goHome = useUiStore((state) => state.goHome);
  const goToRepositories = useUiStore((state) => state.goToRepositories);
  const goToOrganizations = useUiStore((state) => state.goToOrganizations);
  const goToMailbox = useUiStore((state) => state.goToMailbox);
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [addRepositoryOpen, setAddRepositoryOpen] = useState(false);
  const [sshAreaOpen, setSshAreaOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaSummary | null>(null);
  const [deletingArea, setDeletingArea] = useState<AreaSummary | null>(null);
  const [repositoryRefs, setRepositoryRefs] = useState<Record<string, string | null>>(() =>
    readRepositoryRefs()
  );
  const [repositoryListLimit, setRepositoryListLimit] = useState(defaultRepositoryListLimit);
  const [commitHistoryLimits, setCommitHistoryLimits] = useState<Record<string, number>>({});
  const [repositoryRefListLimits, setRepositoryRefListLimits] = useState<Record<string, number>>({});
  const [repositoryContributorLimits, setRepositoryContributorLimits] = useState<Record<string, number>>({});
  const [repositoryForkLimits, setRepositoryForkLimits] = useState<Record<string, number>>({});
  const [repositoryAccessLimits, setRepositoryAccessLimits] = useState<Record<string, number>>({});
  const [repositoryActionsLimits, setRepositoryActionsLimits] = useState<Record<string, number>>({});
  const [repositoryWorkflowDefinitionLimits, setRepositoryWorkflowDefinitionLimits] = useState<
    Record<string, number>
  >({});
  const [repositoryProjectLimits, setRepositoryProjectLimits] = useState<Record<string, number>>({});
  const [repositoryReleaseLimits, setRepositoryReleaseLimits] = useState<Record<string, number>>({});
  const [repositoryDiscussionLimits, setRepositoryDiscussionLimits] = useState<Record<string, number>>({});
  const [repositoryIssueListLimits, setRepositoryIssueListLimits] = useState<Record<string, number>>({});
  const [repositoryPullRequestListLimits, setRepositoryPullRequestListLimits] = useState<
    Record<string, number>
  >({});
  const [repositorySecurityListLimits, setRepositorySecurityListLimits] = useState<Record<string, number>>(
    {}
  );
  const [organizationListLimit, setOrganizationListLimit] = useState(defaultOrganizationListLimit);
  const [organizationRepositoryLimits, setOrganizationRepositoryLimits] = useState<Record<string, number>>(
    {}
  );
  const [organizationTeamLimits, setOrganizationTeamLimits] = useState<Record<string, number>>({});
  const [organizationMemberLimits, setOrganizationMemberLimits] = useState<Record<string, number>>({});
  const [organizationProjectLimits, setOrganizationProjectLimits] = useState<Record<string, number>>({});
  const [organizationTeamRepositoryLimits, setOrganizationTeamRepositoryLimits] = useState<
    Record<string, number>
  >({});
  const [organizationTeamMemberLimits, setOrganizationTeamMemberLimits] = useState<Record<string, number>>(
    {}
  );
  const [homeRepositoryActivityLimit, setHomeRepositoryActivityLimit] = useState(
    defaultHomeRepositoryActivityLimit
  );
  const [homeWorkLimit, setHomeWorkLimit] = useState(8);
  const [mailboxWorkLimit, setMailboxWorkLimit] = useState(defaultMailboxListLimit);
  const [mailboxNotificationLimits, setMailboxNotificationLimits] = useState<
    Partial<Record<MailboxNotificationFilter, number>>
  >({});
  const recentItemLimit = defaultRecentItemLimit;
  const [selectedRootMarkdownPath, setSelectedRootMarkdownPath] = useState<string | null>(null);
  const [fileFinderOpen, setFileFinderOpen] = useState(false);
  const [selectedOrganizationLogin, setSelectedOrganizationLogin] = useState<string | null>(null);
  const [selectedOrganizationTeamSlug, setSelectedOrganizationTeamSlug] = useState<string | null>(null);
  const [selectedOrganizationMemberLogin, setSelectedOrganizationMemberLogin] = useState<string | null>(null);
  const [selectedOrganizationProjectId, setSelectedOrganizationProjectId] = useState<string | null>(null);
  const [notificationFilter, setNotificationFilter] = useState<MailboxNotificationFilter>("unread");
  const accountWorkLimit = route.kind === "mailbox" ? mailboxWorkLimit : defaultMailboxListLimit;
  const notificationLimit = mailboxNotificationLimits[notificationFilter] ?? defaultMailboxListLimit;

  const appState = useQuery({
    queryKey: ["app-state"],
    queryFn: () => api.getAppState()
  });
  const githubAuthenticated = appState.data?.github.authenticated ?? false;
  const githubReady = appState.isSuccess && githubAuthenticated;
  const authenticatedViewerLogin = appState.data?.github.user ?? appState.data?.viewer?.login ?? null;
  const areas = useQuery({
    queryKey: ["areas"],
    queryFn: () => api.areas.listAreas(),
    enabled: appState.isSuccess,
    staleTime: 30_000
  });
  const areaItems = areas.data ?? [];
  const selectedArea =
    areaItems.find((area) => area.id === selectedAreaId) ??
    areaItems.find((area) => area.selected) ??
    areaItems.find((area) => area.kind === "github") ??
    null;
  const selectedAreaRepositories = useQuery({
    queryKey: ["area-repositories", selectedArea?.id ?? "none"],
    queryFn: () => api.areas.listRepositories({ areaId: selectedArea?.id ?? "" }),
    enabled: Boolean(selectedArea?.id && isGatewayAreaKind(selectedArea.kind)),
    placeholderData: (previousData) => previousData
  });
  const localRepositoryItems = selectedAreaRepositories.data ?? [];

  useEffect(() => {
    if (!selectedAreaId && selectedArea?.id) {
      selectAreaInStore(selectedArea.id);
    }
  }, [selectAreaInStore, selectedArea?.id, selectedAreaId]);

  useEffect(() => {
    writeRepositoryRefs(repositoryRefs);
  }, [repositoryRefs]);

  const repositories = useRepositoryDirectory(repositoryListLimit, {
    enabled: appState.isSuccess,
    githubReady
  });
  const repositoryItems = useMemo(() => repositories.data?.items ?? [], [repositories.data]);
  const repositoriesAvailabilityMessage =
    repositories.data?.availability?.status === "stale"
      ? null
      : readAvailabilityMessage("Repositories", repositories.data?.availability ?? null);

  const repositoryPins = useQuery({
    queryKey: ["repository-pins"],
    queryFn: () => api.listRepositoryPins(),
    staleTime: Infinity
  });
  const repositoryPinRecords = useMemo(() => repositoryPins.data ?? [], [repositoryPins.data]);
  const pinnedRepositoryNames = useMemo(
    () =>
      repositoryPinRecords
        .filter((pin) => pin.areaId === defaultGitHubAreaId && pin.nameWithOwner)
        .map((pin) => pin.nameWithOwner as string),
    [repositoryPinRecords]
  );
  const pinnedRepositoryNameSet = useMemo(
    () => new Set(pinnedRepositoryNames.map((name) => name.toLowerCase())),
    [pinnedRepositoryNames]
  );
  const areaRepositoryPinSet = useMemo(
    () =>
      new Set(
        repositoryPinRecords.map((pin) =>
          areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId ?? null)
        )
      ),
    [repositoryPinRecords]
  );
  const repositoriesByName = useMemo(
    () => new Map(repositoryItems.map((repository) => [repository.nameWithOwner.toLowerCase(), repository])),
    [repositoryItems]
  );

  const recentItemsQueryKey = useMemo(() => ["local-recents", recentItemLimit] as const, [recentItemLimit]);
  const recentItems = useQuery({
    queryKey: recentItemsQueryKey,
    queryFn: () => api.listRecentItems({ limit: recentItemLimit }),
    staleTime: 30_000
  });

  const accountProfile = useQuery({
    queryKey: ["account-profile"],
    queryFn: () => api.github.getAccountProfileWithStatus({ cacheOnly: !githubReady }),
    enabled: appState.isSuccess
  });
  const accountProfileData = accountProfile.data?.profile ?? null;
  const accountProfileAvailabilityMessage = readAvailabilityMessage(
    "Account profile",
    accountProfile.data?.availability ?? null
  );

  const { issues: accountIssues, pulls: accountPulls } = useAccountWork(
    authenticatedViewerLogin,
    accountWorkLimit,
    {
      enabled: appState.isSuccess && (route.kind === "home" || route.kind === "mailbox"),
      githubReady
    }
  );
  const accountIssueItems = accountIssues.data?.items ?? [];
  const accountIssuesAvailability = accountIssues.data?.availability ?? null;
  const accountPullItems = accountPulls.data?.items ?? [];
  const accountPullsAvailability = accountPulls.data?.availability ?? null;

  const notificationQueryKey = useMemo(
    () => ["notifications", notificationFilter, notificationLimit] as const,
    [notificationFilter, notificationLimit]
  );
  const notifications = useQuery({
    queryKey: notificationQueryKey,
    queryFn: () => {
      const input = {
        all: notificationFilter === "all",
        limit: notificationLimit,
        cacheOnly: !githubReady
      };
      return api.github.listNotificationsWithStatus(
        notificationFilter === "participating" ? { ...input, participating: true } : input
      );
    },
    enabled: appState.isSuccess && route.kind === "mailbox",
    staleTime: 30_000
  });
  const notificationItems = notifications.data?.items ?? [];
  const notificationsAvailability = notifications.data?.availability ?? null;
  const markNotificationRead = useMutation({
    mutationFn: api.github.markNotificationThreadRead,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousNotifications = queryClient.getQueryData<NotificationListResult>(notificationQueryKey);
      queryClient.setQueryData<NotificationListResult>(notificationQueryKey, (current) => {
        if (!current) {
          return current;
        }
        if (notificationFilter !== "all") {
          return {
            ...current,
            items: current.items.filter((notification) => notification.id !== input.threadId)
          };
        }

        return {
          ...current,
          items: current.items.map((notification) =>
            notification.id === input.threadId
              ? {
                  ...notification,
                  unread: false,
                  lastReadAt: new Date().toISOString()
                }
              : notification
          )
        };
      });
      return { key: notificationQueryKey, previousNotifications };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(context.key, context.previousNotifications);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });
  const markVisibleNotificationsRead = useMutation({
    mutationFn: async (input: { threadIds: string[] }) => {
      await Promise.all(
        input.threadIds.map((threadId) => api.github.markNotificationThreadRead({ threadId }))
      );
    },
    onMutate: async (input) => {
      const threadIds = new Set(input.threadIds);
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousNotifications = queryClient.getQueryData<NotificationListResult>(notificationQueryKey);
      queryClient.setQueryData<NotificationListResult>(notificationQueryKey, (current) => {
        if (!current) {
          return current;
        }
        if (notificationFilter !== "all") {
          return {
            ...current,
            items: current.items.filter((notification) => !threadIds.has(notification.id))
          };
        }

        return {
          ...current,
          items: current.items.map((notification) =>
            threadIds.has(notification.id)
              ? {
                  ...notification,
                  unread: false,
                  lastReadAt: new Date().toISOString()
                }
              : notification
          )
        };
      });
      return { key: notificationQueryKey, previousNotifications };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(context.key, context.previousNotifications);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });
  const unsubscribeNotification = useMutation({
    mutationFn: api.github.unsubscribeNotificationThread,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previousNotifications = queryClient.getQueryData<NotificationListResult>(notificationQueryKey);
      queryClient.setQueryData<NotificationListResult>(notificationQueryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.filter((notification) => notification.id !== input.threadId)
            }
          : current
      );
      return { key: notificationQueryKey, previousNotifications };
    },
    onError: (_error, _input, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(context.key, context.previousNotifications);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const organizations = useQuery({
    queryKey: ["organizations", organizationListLimit],
    queryFn: () =>
      api.github.listOrganizationsWithStatus({ limit: organizationListLimit, cacheOnly: !githubReady }),
    enabled: appState.isSuccess && route.kind === "organizations",
    staleTime: 120_000,
    placeholderData: (previousData) => previousData
  });
  const organizationItems = organizations.data?.items ?? [];
  const organizationsAvailability = organizations.data?.availability ?? null;
  const selectedOrganization =
    organizationItems.find((organization) => organization.login === selectedOrganizationLogin) ??
    organizationItems[0] ??
    null;
  const organizationRepositoryLimit = selectedOrganization
    ? (organizationRepositoryLimits[selectedOrganization.login] ?? defaultOrganizationRepositoryLimit)
    : defaultOrganizationRepositoryLimit;
  const organizationTeamLimit = selectedOrganization
    ? (organizationTeamLimits[selectedOrganization.login] ?? defaultOrganizationTeamLimit)
    : defaultOrganizationTeamLimit;
  const organizationMemberLimit = selectedOrganization
    ? (organizationMemberLimits[selectedOrganization.login] ?? defaultOrganizationMemberLimit)
    : defaultOrganizationMemberLimit;
  const organizationProjectLimit = selectedOrganization
    ? (organizationProjectLimits[selectedOrganization.login] ?? defaultOrganizationProjectLimit)
    : defaultOrganizationProjectLimit;
  const organizationTeams = useQuery<OrganizationTeamsResult>({
    queryKey: ["organization-teams", selectedOrganization?.login ?? "none", organizationTeamLimit],
    queryFn: () =>
      api.github.listOrganizationTeamsWithStatus({
        org: selectedOrganization!.login,
        limit: organizationTeamLimit,
        cacheOnly: !githubReady
      }),
    enabled: appState.isSuccess && route.kind === "organizations" && Boolean(selectedOrganization),
    staleTime: 120_000
  });
  const organizationRepositories = useQuery<OrganizationRepositoriesResult>({
    queryKey: [
      "organization-repositories",
      selectedOrganization?.login ?? "none",
      organizationRepositoryLimit
    ],
    queryFn: () =>
      api.github.listOrganizationRepositoriesWithStatus({
        org: selectedOrganization!.login,
        limit: organizationRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: appState.isSuccess && route.kind === "organizations" && Boolean(selectedOrganization),
    staleTime: 120_000
  });
  const organizationMembers = useQuery<OrganizationMembersResult>({
    queryKey: ["organization-members", selectedOrganization?.login ?? "none", organizationMemberLimit],
    queryFn: () =>
      api.github.listOrganizationMembersWithStatus({
        org: selectedOrganization!.login,
        limit: organizationMemberLimit,
        cacheOnly: !githubReady
      }),
    enabled: appState.isSuccess && route.kind === "organizations" && Boolean(selectedOrganization),
    staleTime: 120_000
  });
  const selectedOrganizationTeam =
    organizationTeams.data?.items.find((team) => team.slug === selectedOrganizationTeamSlug) ??
    organizationTeams.data?.items[0] ??
    null;
  const selectedOrganizationTeamLimitKey =
    selectedOrganization && selectedOrganizationTeam
      ? `${selectedOrganization.login}/${selectedOrganizationTeam.slug}`
      : null;
  const organizationTeamRepositoryLimit = selectedOrganizationTeamLimitKey
    ? (organizationTeamRepositoryLimits[selectedOrganizationTeamLimitKey] ??
      defaultOrganizationTeamRepositoryLimit)
    : defaultOrganizationTeamRepositoryLimit;
  const organizationTeamMemberLimit = selectedOrganizationTeamLimitKey
    ? (organizationTeamMemberLimits[selectedOrganizationTeamLimitKey] ?? defaultOrganizationTeamMemberLimit)
    : defaultOrganizationTeamMemberLimit;
  const organizationTeamRepositories = useQuery<OrganizationTeamRepositoriesResult>({
    queryKey: [
      "organization-team-repositories",
      selectedOrganization?.login ?? "none",
      selectedOrganizationTeam?.slug ?? "none",
      organizationTeamRepositoryLimit
    ],
    queryFn: () =>
      api.github.listOrganizationTeamRepositoriesWithStatus({
        org: selectedOrganization!.login,
        teamSlug: selectedOrganizationTeam!.slug,
        limit: organizationTeamRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      route.kind === "organizations" &&
      Boolean(selectedOrganization) &&
      Boolean(selectedOrganizationTeam),
    staleTime: 120_000
  });
  const organizationTeamMembers = useQuery<OrganizationTeamMembersResult>({
    queryKey: [
      "organization-team-members",
      selectedOrganization?.login ?? "none",
      selectedOrganizationTeam?.slug ?? "none",
      organizationTeamMemberLimit
    ],
    queryFn: () =>
      api.github.listOrganizationTeamMembersWithStatus({
        org: selectedOrganization!.login,
        teamSlug: selectedOrganizationTeam!.slug,
        limit: organizationTeamMemberLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      route.kind === "organizations" &&
      Boolean(selectedOrganization) &&
      Boolean(selectedOrganizationTeam),
    staleTime: 120_000
  });
  const organizationProjects = useQuery<ProjectListResult>({
    queryKey: ["organization-projects", selectedOrganization?.login ?? "none", organizationProjectLimit],
    queryFn: () =>
      api.github.listOrganizationProjectsWithStatus({
        org: selectedOrganization!.login,
        limit: organizationProjectLimit,
        cacheOnly: !githubReady
      }),
    enabled: appState.isSuccess && route.kind === "organizations" && Boolean(selectedOrganization),
    staleTime: 120_000
  });

  const isRepositoryRoute = route.kind === "repository";
  const isCodeBrowserRoute = route.kind === "codeBrowser";
  const isLocalRepositoryRoute = route.kind === "localRepository";
  const isRepositoryContext = isRepositoryRoute || isCodeBrowserRoute;
  const activeRepositoryTab = isRepositoryRoute ? route.tab : "code";
  const activeLocalRepositoryTab = isLocalRepositoryRoute ? route.tab : "overview";
  const shouldLoadRepositoryTab = (tab: RepositoryTab): boolean =>
    activeRepositoryTab === tab || (isRepositoryRoute && repositoryWarmPrefetchTabs.has(tab));
  const activeLocalRepositoryPath = isLocalRepositoryRoute ? (route.path ?? ".") : ".";
  const effectiveRepository = isRepositoryContext ? route.nameWithOwner : (selectedRepository ?? "");
  const [owner = "", repo = ""] = effectiveRepository.split("/");
  const hasRepositoryParts = Boolean(owner && repo);
  const repositoryContextValue = useMemo<RepositoryContextValue | null>(
    () =>
      hasRepositoryParts
        ? {
            owner,
            repo,
            nameWithOwner: effectiveRepository,
            githubReady,
            api,
            queryClient
          }
        : null,
    [api, effectiveRepository, githubReady, hasRepositoryParts, owner, queryClient, repo]
  );
  const codeBrowserPath = isCodeBrowserRoute ? route.path : "";
  const codeBrowserEntryType = isCodeBrowserRoute ? route.entryType : "dir";
  const codeBrowserRef = isCodeBrowserRoute ? route.ref : null;
  const repositorySelectedRef = repositoryRefs[effectiveRepository] ?? null;
  const repositoryRefListLimit = repositoryRefListLimits[effectiveRepository] ?? defaultRefListLimit;
  const repositoryContributorLimit =
    repositoryContributorLimits[effectiveRepository] ?? defaultContributorLimit;
  const forksLimit = repositoryForkLimits[effectiveRepository] ?? defaultForksLimit;
  const repositoryAccessLimit = repositoryAccessLimits[effectiveRepository] ?? defaultRepositoryAccessLimit;
  const actionsLimit = repositoryActionsLimits[effectiveRepository] ?? defaultActionsLimit;
  const workflowDefinitionLimit =
    repositoryWorkflowDefinitionLimits[effectiveRepository] ?? defaultWorkflowDefinitionLimit;
  const projectsLimit = repositoryProjectLimits[effectiveRepository] ?? defaultProjectsLimit;
  const releasesLimit = repositoryReleaseLimits[effectiveRepository] ?? defaultReleasesLimit;
  const discussionsLimit = repositoryDiscussionLimits[effectiveRepository] ?? defaultDiscussionsLimit;
  const issueListLimit = repositoryIssueListLimits[effectiveRepository] ?? defaultIssueListLimit;
  const pullRequestListLimit =
    repositoryPullRequestListLimits[effectiveRepository] ?? defaultPullRequestListLimit;
  const securityListLimitKey = (listKind: string): string => `${effectiveRepository}:${listKind}`;
  const dependabotAlertsLimit =
    repositorySecurityListLimits[securityListLimitKey("dependabot")] ?? defaultSecurityListLimit;
  const codeScanningAlertsLimit =
    repositorySecurityListLimits[securityListLimitKey("codeScanning")] ?? defaultSecurityListLimit;
  const secretScanningAlertsLimit =
    repositorySecurityListLimits[securityListLimitKey("secretScanning")] ?? defaultSecurityListLimit;
  const repositoryRulesetsLimit =
    repositorySecurityListLimits[securityListLimitKey("rulesets")] ?? defaultSecurityListLimit;
  const repositorySecurityAdvisoriesLimit =
    repositorySecurityListLimits[securityListLimitKey("advisories")] ?? defaultSecurityListLimit;
  const contentsRef = isCodeBrowserRoute ? codeBrowserRef : repositorySelectedRef;
  const repositoryCommitHistoryRefKey = repositorySelectedRef ?? "default";
  const fileCommitHistoryRefKey = codeBrowserRef ?? "default";
  const repositoryCommitHistoryKey = `${effectiveRepository}:${repositoryCommitHistoryRefKey}:`;
  const fileCommitHistoryKey = `${effectiveRepository}:${fileCommitHistoryRefKey}:${codeBrowserPath}`;
  const repositoryCommitHistoryLimit =
    commitHistoryLimits[repositoryCommitHistoryKey] ?? defaultRightRailCommitHistoryLimit;
  const fileCommitHistoryLimit = commitHistoryLimits[fileCommitHistoryKey] ?? defaultCommitHistoryLimit;
  const fileBlameRangeKey = `${owner}/${repo}:${contentsRef ?? "default"}:${codeBrowserPath}`;
  const [expandedFileBlameRange, setExpandedFileBlameRange] = useState<{
    key: string;
    limit: number;
  } | null>(null);
  const fileBlameRangeLimit =
    expandedFileBlameRange?.key === fileBlameRangeKey
      ? expandedFileBlameRange.limit
      : defaultFileBlameRangeLimit;
  const expandActiveRepositoryRefs = (): void => {
    setRepositoryRefListLimits((limits) => {
      if ((limits[effectiveRepository] ?? defaultRefListLimit) >= expandedRefListLimit) {
        return limits;
      }

      return { ...limits, [effectiveRepository]: expandedRefListLimit };
    });
  };
  const expandCommitHistory = (key: string, defaultLimit = defaultCommitHistoryLimit): void => {
    setCommitHistoryLimits((limits) => {
      const currentLimit = limits[key] ?? defaultLimit;
      if (currentLimit >= maxCommitHistoryLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxCommitHistoryLimit;
      return { ...limits, [key]: nextLimit };
    });
  };
  const expandRepositoryCommitHistory = (): void =>
    expandCommitHistory(repositoryCommitHistoryKey, defaultRightRailCommitHistoryLimit);
  const expandFileCommitHistory = (): void => expandCommitHistory(fileCommitHistoryKey);
  const expandActiveRepositoryContributors = (): void => {
    setRepositoryContributorLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultContributorLimit;
      if (currentLimit >= maxContributorLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxContributorLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryForks = (): void => {
    setRepositoryForkLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultForksLimit;
      if (currentLimit >= maxForksLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxForksLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryAccess = (): void => {
    setRepositoryAccessLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultRepositoryAccessLimit;
      if (currentLimit >= maxRepositoryAccessLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxRepositoryAccessLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryActions = (): void => {
    setRepositoryActionsLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultActionsLimit;
      if (currentLimit >= maxActionsLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxActionsLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryWorkflowDefinitions = (): void => {
    setRepositoryWorkflowDefinitionLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultWorkflowDefinitionLimit;
      if (currentLimit >= maxWorkflowDefinitionLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxWorkflowDefinitionLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryProjects = (): void => {
    setRepositoryProjectLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultProjectsLimit;
      if (currentLimit >= maxProjectsLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxProjectsLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryReleases = (): void => {
    setRepositoryReleaseLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultReleasesLimit;
      if (currentLimit >= maxReleasesLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxReleasesLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryDiscussions = (): void => {
    setRepositoryDiscussionLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultDiscussionsLimit;
      if (currentLimit >= maxDiscussionsLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxDiscussionsLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryIssues = (): void => {
    setRepositoryIssueListLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultIssueListLimit;
      if (currentLimit >= maxIssueListLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxIssueListLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositoryPullRequests = (): void => {
    setRepositoryPullRequestListLimits((limits) => {
      const currentLimit = limits[effectiveRepository] ?? defaultPullRequestListLimit;
      if (currentLimit >= maxPullRequestListLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxPullRequestListLimit;
      return { ...limits, [effectiveRepository]: nextLimit };
    });
  };
  const expandActiveRepositorySecurityList = (listKind: string): void => {
    setRepositorySecurityListLimits((limits) => {
      const key = securityListLimitKey(listKind);
      const currentLimit = limits[key] ?? defaultSecurityListLimit;
      if (currentLimit >= maxSecurityListLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxSecurityListLimit;
      return { ...limits, [key]: nextLimit };
    });
  };
  const expandMailboxWork = (): void => {
    setMailboxWorkLimit((currentLimit) => {
      if (currentLimit >= maxMailboxListLimit) {
        return currentLimit;
      }

      return currentLimit < 50 ? 50 : maxMailboxListLimit;
    });
  };
  const loadMoreHomeWork = (): void => {
    setHomeWorkLimit(defaultMailboxListLimit);
  };
  const loadMoreHomeRepositoryActivity = (): void => {
    setHomeRepositoryActivityLimit((currentLimit) => {
      const loadedRepositoryLimit = Math.min(repositoryItems.length || currentLimit, maxRepositoryListLimit);
      if (currentLimit >= loadedRepositoryLimit) {
        return currentLimit;
      }

      return Math.min(currentLimit + defaultHomeRepositoryActivityLimit, loadedRepositoryLimit);
    });
  };
  const expandMailboxNotifications = (): void => {
    setMailboxNotificationLimits((limits) => {
      const currentLimit = limits[notificationFilter] ?? defaultMailboxListLimit;
      if (currentLimit >= maxMailboxListLimit) {
        return limits;
      }

      const nextLimit = currentLimit < 50 ? 50 : maxMailboxListLimit;
      return { ...limits, [notificationFilter]: nextLimit };
    });
  };
  const expandRepositoryList = (): void => {
    setRepositoryListLimit((currentLimit) => {
      if (currentLimit >= maxRepositoryListLimit) {
        return currentLimit;
      }

      return maxRepositoryListLimit;
    });
  };
  const expandOrganizationList = (): void => {
    setOrganizationListLimit((currentLimit) => {
      if (currentLimit >= maxOrganizationListLimit) {
        return currentLimit;
      }

      return maxOrganizationListLimit;
    });
  };
  const expandSelectedOrganizationRepositories = (): void => {
    if (!selectedOrganization) {
      return;
    }

    setOrganizationRepositoryLimits((limits) => {
      const currentLimit = limits[selectedOrganization.login] ?? defaultOrganizationRepositoryLimit;
      if (currentLimit >= maxOrganizationRepositoryLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganization.login]: maxOrganizationRepositoryLimit };
    });
  };
  const expandSelectedOrganizationTeams = (): void => {
    if (!selectedOrganization) {
      return;
    }

    setOrganizationTeamLimits((limits) => {
      const currentLimit = limits[selectedOrganization.login] ?? defaultOrganizationTeamLimit;
      if (currentLimit >= maxOrganizationTeamLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganization.login]: maxOrganizationTeamLimit };
    });
  };
  const expandSelectedOrganizationMembers = (): void => {
    if (!selectedOrganization) {
      return;
    }

    setOrganizationMemberLimits((limits) => {
      const currentLimit = limits[selectedOrganization.login] ?? defaultOrganizationMemberLimit;
      if (currentLimit >= maxOrganizationMemberLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganization.login]: maxOrganizationMemberLimit };
    });
  };
  const expandSelectedOrganizationProjects = (): void => {
    if (!selectedOrganization) {
      return;
    }

    setOrganizationProjectLimits((limits) => {
      const currentLimit = limits[selectedOrganization.login] ?? defaultOrganizationProjectLimit;
      if (currentLimit >= maxOrganizationProjectLimit) {
        return limits;
      }

      return { ...limits, [selectedOrganization.login]: maxOrganizationProjectLimit };
    });
  };
  const expandSelectedOrganizationTeamRepositories = (): void => {
    if (!selectedOrganization || !selectedOrganizationTeam) {
      return;
    }

    const key = `${selectedOrganization.login}/${selectedOrganizationTeam.slug}`;
    setOrganizationTeamRepositoryLimits((limits) => {
      const currentLimit = limits[key] ?? defaultOrganizationTeamRepositoryLimit;
      if (currentLimit >= maxOrganizationTeamRepositoryLimit) {
        return limits;
      }

      return { ...limits, [key]: maxOrganizationTeamRepositoryLimit };
    });
  };
  const expandSelectedOrganizationTeamMembers = (): void => {
    if (!selectedOrganization || !selectedOrganizationTeam) {
      return;
    }

    const key = `${selectedOrganization.login}/${selectedOrganizationTeam.slug}`;
    setOrganizationTeamMemberLimits((limits) => {
      const currentLimit = limits[key] ?? defaultOrganizationTeamMemberLimit;
      if (currentLimit >= maxOrganizationTeamMemberLimit) {
        return limits;
      }

      return { ...limits, [key]: maxOrganizationTeamMemberLimit };
    });
  };

  const repository = useQuery({
    queryKey: ["repository", owner, repo],
    queryFn: () => api.github.getRepositoryWithStatus({ owner, repo, cacheOnly: !githubReady }),
    enabled: appState.isSuccess && isRepositoryContext && hasRepositoryParts,
    staleTime: 120_000
  });
  const repositoryDetail = repository.data?.detail ?? null;
  const repositoryAvailabilityMessage = readAvailabilityMessage(
    "Repository detail",
    repository.data?.availability ?? null
  );

  const repositoryRefQueries = useRepositoryRefs(
    owner,
    repo,
    {
      branches:
        appState.isSuccess &&
        hasRepositoryParts &&
        ((isRepositoryRoute &&
          (shouldLoadRepositoryTab("code") ||
            shouldLoadRepositoryTab("actions") ||
            shouldLoadRepositoryTab("pulls") ||
            activeRepositoryTab === "releases" ||
            activeRepositoryTab === "securityQuality" ||
            activeRepositoryTab === "settings")) ||
          isCodeBrowserRoute),
      tags:
        appState.isSuccess &&
        hasRepositoryParts &&
        ((isRepositoryRoute &&
          (shouldLoadRepositoryTab("code") ||
            shouldLoadRepositoryTab("actions") ||
            activeRepositoryTab === "releases")) ||
          isCodeBrowserRoute)
    },
    repositoryRefListLimit,
    { githubReady }
  );
  const {
    branches,
    tags,
    branchItems,
    tagItems,
    availabilityMessage: refsAvailabilityMessage,
    error: refsError
  } = repositoryRefQueries;

  const contents = useQuery({
    queryKey: ["contents", owner, repo, contentsRef ?? "default", codeBrowserPath, codeBrowserEntryType],
    queryFn: () =>
      api.github.listContentsWithStatus({
        owner,
        repo,
        path: isCodeBrowserRoute && codeBrowserEntryType === "dir" ? codeBrowserPath : undefined,
        ref: contentsRef ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      hasRepositoryParts &&
      ((isRepositoryRoute && shouldLoadRepositoryTab("code")) ||
        (isCodeBrowserRoute && codeBrowserEntryType === "dir")),
    staleTime: 120_000
  });

  const readme = useQuery({
    queryKey: ["readme", owner, repo, contentsRef ?? "default"],
    queryFn: () =>
      api.github.getReadme({ owner, repo, ref: contentsRef ?? undefined, cacheOnly: !githubReady }),
    enabled: appState.isSuccess && isRepositoryRoute && shouldLoadRepositoryTab("code") && hasRepositoryParts,
    staleTime: 120_000
  });

  const fileContent = useQuery({
    queryKey: ["file-content", owner, repo, contentsRef ?? "default", codeBrowserPath],
    queryFn: () =>
      api.github.getFileContentWithStatus({
        owner,
        repo,
        path: codeBrowserPath,
        ref: contentsRef ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isCodeBrowserRoute &&
      codeBrowserEntryType === "file" &&
      hasRepositoryParts &&
      Boolean(codeBrowserPath),
    staleTime: 120_000
  });

  const fileBlame = useQuery<RepoFileBlameResult>({
    queryKey: ["file-blame", owner, repo, contentsRef ?? "default", codeBrowserPath, fileBlameRangeLimit],
    queryFn: () =>
      api.github.getFileBlame({
        owner,
        repo,
        path: codeBrowserPath,
        ref: contentsRef ?? undefined,
        maxRanges: fileBlameRangeLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isCodeBrowserRoute &&
      codeBrowserEntryType === "file" &&
      hasRepositoryParts &&
      Boolean(codeBrowserPath),
    staleTime: 120_000
  });

  const repositoryCommits = useQuery({
    queryKey: ["commits", owner, repo, repositoryCommitHistoryRefKey, "", repositoryCommitHistoryLimit],
    queryFn: () =>
      api.github.listCommitsWithStatus({
        owner,
        repo,
        ref: contentsRef ?? repositoryDetail?.defaultBranch ?? undefined,
        limit: repositoryCommitHistoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: appState.isSuccess && isRepositoryRoute && shouldLoadRepositoryTab("code") && hasRepositoryParts,
    staleTime: 60_000
  });

  const fileCommits = useQuery({
    queryKey: ["commits", owner, repo, fileCommitHistoryRefKey, codeBrowserPath, fileCommitHistoryLimit],
    queryFn: () =>
      api.github.listCommitsWithStatus({
        owner,
        repo,
        ref: codeBrowserRef ?? repositoryDetail?.defaultBranch ?? undefined,
        path: codeBrowserPath,
        limit: fileCommitHistoryLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isCodeBrowserRoute &&
      codeBrowserEntryType === "file" &&
      hasRepositoryParts &&
      Boolean(codeBrowserPath),
    staleTime: 60_000
  });

  const contentItems = contents.data?.items ?? emptyRepoEntries;
  const contentsAvailability = contents.data?.availability ?? null;
  const repositoryCommitItems = repositoryCommits.data?.items ?? [];
  const repositoryCommitsAvailability = repositoryCommits.data?.availability ?? null;
  const fileCommitItems = fileCommits.data?.items ?? [];
  const fileCommitsAvailability = fileCommits.data?.availability ?? null;
  const fileContentItem = fileContent.data?.item ?? null;
  const fileContentAvailability = fileContent.data?.availability ?? null;
  const fileContentAvailabilityMessage = readAvailabilityMessage("File content", fileContentAvailability);
  const rootMarkdownItems = useMemo(
    () =>
      contentItems.filter(
        (item) =>
          item.type === "file" &&
          !item.path.includes("/") &&
          isMarkdownPath(item.path) &&
          !isReadmeMarkdownPath(item.path)
      ),
    [contentItems]
  );
  const effectiveSelectedRootMarkdownPath = rootMarkdownItems.some(
    (item) => item.path === selectedRootMarkdownPath
  )
    ? selectedRootMarkdownPath
    : (rootMarkdownItems[0]?.path ?? null);
  const rootMarkdownContent = useQuery<RepoFileContentResult>({
    queryKey: [
      "file-content",
      owner,
      repo,
      contentsRef ?? "default",
      effectiveSelectedRootMarkdownPath ?? ""
    ],
    queryFn: () =>
      api.github.getFileContentWithStatus({
        owner,
        repo,
        path: effectiveSelectedRootMarkdownPath ?? "",
        ref: contentsRef ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      shouldLoadRepositoryTab("code") &&
      hasRepositoryParts &&
      Boolean(effectiveSelectedRootMarkdownPath),
    staleTime: 120_000
  });

  const repositoryTree = useQuery({
    queryKey: ["tree", owner, repo, contentsRef ?? "default"],
    queryFn: () =>
      api.github.listTreeWithStatus({
        owner,
        repo,
        ref: contentsRef ?? repositoryDetail?.defaultBranch ?? undefined,
        recursive: true,
        cacheOnly: !githubReady
      }),
    enabled: appState.isSuccess && fileFinderOpen && hasRepositoryParts && Boolean(repositoryDetail),
    staleTime: 120_000
  });
  const repositoryTreeItem = repositoryTree.data?.tree ?? null;
  const repositoryTreeAvailability = repositoryTree.data?.availability ?? null;
  const repositoryTreeAvailabilityMessage = readAvailabilityMessage(
    "Repository tree",
    repositoryTreeAvailability
  );

  const issueTabQueries = useIssuesTabQueries({
    owner,
    repo,
    issueListLimit,
    issuesEnabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      (shouldLoadRepositoryTab("issues") || activeRepositoryTab === "agents") &&
      hasRepositoryParts,
    resourcesEnabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      (shouldLoadRepositoryTab("issues") || shouldLoadRepositoryTab("pulls")) &&
      hasRepositoryParts,
    githubReady
  });
  const {
    issues,
    labels,
    assignableUsers,
    milestones,
    labelItems,
    labelAvailability,
    assignableUserItems,
    assignableUsersAvailability,
    milestoneItems,
    milestonesAvailability
  } = issueTabQueries;
  const issueItems = issues.data?.items ?? [];
  const issuesAvailability = issues.data?.availability ?? null;

  const repositoryAccess = useQuery<RepositoryAccessResult>({
    queryKey: ["repository-access", owner, repo, repositoryAccessLimit],
    queryFn: () =>
      api.github.getRepositoryAccess({ owner, repo, limit: repositoryAccessLimit, cacheOnly: !githubReady }),
    enabled:
      appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "settings" && hasRepositoryParts,
    staleTime: 120_000
  });

  const repositoryForks = useQuery<RepositoryForksResult>({
    queryKey: ["repository-forks", owner, repo, forksLimit],
    queryFn: () =>
      api.github.listRepositoryForks({
        owner,
        repo,
        sort: "stargazers",
        limit: forksLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "settings" && hasRepositoryParts,
    staleTime: 120_000
  });

  const pulls = useQuery({
    queryKey: ["pulls", owner, repo, pullRequestListLimit],
    queryFn: () =>
      api.github.listPullRequestsWithStatus({
        owner,
        repo,
        state: "all",
        limit: pullRequestListLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      (shouldLoadRepositoryTab("pulls") || activeRepositoryTab === "agents") &&
      hasRepositoryParts,
    staleTime: 60_000
  });
  const pullItems = pulls.data?.items ?? [];
  const pullsAvailability = pulls.data?.availability ?? null;

  const { discussions } = useDiscussionsTabQueries({
    owner,
    repo,
    limit: discussionsLimit,
    enabled:
      appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "discussions" && hasRepositoryParts,
    githubReady
  });

  const { actions } = useActionsTabQueries({
    owner,
    repo,
    limit: actionsLimit,
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      (shouldLoadRepositoryTab("actions") || activeRepositoryTab === "agents") &&
      hasRepositoryParts,
    githubReady
  });

  const { projects } = useProjectsTabQueries({
    owner,
    repo,
    limit: projectsLimit,
    enabled:
      appState.isSuccess && isRepositoryRoute && activeRepositoryTab === "projects" && hasRepositoryParts,
    githubReady
  });
  const branchProtectionBranch =
    repositorySelectedRef && branchItems.some((branch) => branch.name === repositorySelectedRef)
      ? repositorySelectedRef
      : (repositoryDetail?.defaultBranch ?? null);

  const branchProtection = useQuery<BranchProtectionResult>({
    queryKey: ["branch-protection", owner, repo, branchProtectionBranch ?? "none"],
    queryFn: () =>
      api.github.getBranchProtection({
        owner,
        repo,
        branch: branchProtectionBranch!,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts &&
      Boolean(branchProtectionBranch),
    staleTime: 60_000
  });

  const dependabotAlerts = useQuery<DependabotAlertsResult>({
    queryKey: ["dependabot-alerts", owner, repo, dependabotAlertsLimit],
    queryFn: () =>
      api.github.listDependabotAlerts({
        owner,
        repo,
        state: "open",
        limit: dependabotAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts,
    staleTime: 60_000
  });

  const codeScanningAlerts = useQuery<CodeScanningAlertsResult>({
    queryKey: ["code-scanning-alerts", owner, repo, codeScanningAlertsLimit],
    queryFn: () =>
      api.github.listCodeScanningAlerts({
        owner,
        repo,
        state: "open",
        limit: codeScanningAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts,
    staleTime: 60_000
  });

  const secretScanningAlerts = useQuery<SecretScanningAlertsResult>({
    queryKey: ["secret-scanning-alerts", owner, repo, secretScanningAlertsLimit],
    queryFn: () =>
      api.github.listSecretScanningAlerts({
        owner,
        repo,
        state: "open",
        limit: secretScanningAlertsLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts,
    staleTime: 60_000
  });

  const repositoryRulesets = useQuery<RepositoryRulesetsResult>({
    queryKey: ["repository-rulesets", owner, repo, repositoryRulesetsLimit],
    queryFn: () =>
      api.github.listRepositoryRulesets({
        owner,
        repo,
        includesParents: true,
        limit: repositoryRulesetsLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts,
    staleTime: 60_000
  });

  const repositorySecurityAdvisories = useQuery<RepositorySecurityAdvisoriesResult>({
    queryKey: ["repository-security-advisories", owner, repo, repositorySecurityAdvisoriesLimit],
    queryFn: () =>
      api.github.listRepositorySecurityAdvisories({
        owner,
        repo,
        limit: repositorySecurityAdvisoriesLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts,
    staleTime: 60_000
  });

  const repositorySecurityPolicy = useQuery<RepositorySecurityPolicyResult>({
    queryKey: ["repository-security-policy", owner, repo, repositoryDetail?.defaultBranch ?? "none"],
    queryFn: () =>
      api.github.getRepositorySecurityPolicy({
        owner,
        repo,
        ref: repositoryDetail?.defaultBranch ?? null,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts &&
      Boolean(repositoryDetail?.defaultBranch),
    staleTime: 120_000
  });

  const repositoryCommunityProfile = useQuery<RepositoryCommunityProfileResult>({
    queryKey: ["repository-community-profile", owner, repo],
    queryFn: () => api.github.getRepositoryCommunityProfile({ owner, repo, cacheOnly: !githubReady }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "securityQuality" &&
      hasRepositoryParts,
    staleTime: 120_000
  });

  const { releases } = useReleasesTabQueries({
    owner,
    repo,
    limit: releasesLimit,
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "releases" &&
      hasRepositoryParts &&
      repository.isSuccess,
    githubReady
  });

  const contributors = useQuery({
    queryKey: ["contributors", owner, repo, repositoryContributorLimit],
    queryFn: () =>
      api.github.listContributorsWithStatus({
        owner,
        repo,
        limit: repositoryContributorLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appState.isSuccess &&
      isRepositoryRoute &&
      activeRepositoryTab === "contributors" &&
      hasRepositoryParts &&
      repository.isSuccess,
    staleTime: 120_000
  });
  const releaseItems = releases.data?.items ?? [];
  const releasesAvailability = releases.data?.availability ?? null;
  const contributorItems = contributors.data?.items ?? [];
  const contributorsAvailability = contributors.data?.availability ?? null;
  const actionItems = actions.data?.items ?? [];
  const actionsAvailability = actions.data?.availability ?? null;

  const invalidateRepositoryScopedQueries = useCallback(
    async (targetOwner: string, targetRepo: string): Promise<void> => {
      await Promise.all(
        repositoryScopedQueryKeys(targetOwner, targetRepo).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      );
    },
    [queryClient]
  );

  const invalidateGitHubSessionQueries = useCallback(async (): Promise<void> => {
    const invalidations: Array<Promise<void>> = [
      queryClient.invalidateQueries({ queryKey: ["app-state"] }),
      queryClient.invalidateQueries({ queryKey: ["repositories"] }),
      queryClient.invalidateQueries({ queryKey: ["account-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["account-issues"] }),
      queryClient.invalidateQueries({ queryKey: ["account-pulls"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["organizations"] }),
      queryClient.invalidateQueries({ queryKey: ["github-account-repositories"] }),
      queryClient.invalidateQueries({ queryKey: ["repository-tree"] }),
      queryClient.invalidateQueries({ queryKey: ["organization-teams"] }),
      queryClient.invalidateQueries({ queryKey: ["organization-repositories"] }),
      queryClient.invalidateQueries({ queryKey: ["organization-members"] }),
      queryClient.invalidateQueries({ queryKey: ["organization-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["organization-team-repositories"] }),
      queryClient.invalidateQueries({ queryKey: ["organization-team-members"] })
    ];

    if (hasRepositoryParts) {
      invalidations.push(invalidateRepositoryScopedQueries(owner, repo));
    }

    await Promise.all(invalidations);
  }, [hasRepositoryParts, invalidateRepositoryScopedQueries, owner, queryClient, repo]);

  const handleGitHubRepositoryUpdated = useCallback(
    (nameWithOwner: string | null): void => {
      if (!nameWithOwner) {
        return;
      }

      const [updatedOwner, updatedRepo] = nameWithOwner.split("/");
      if (updatedOwner && updatedRepo) {
        void invalidateRepositoryScopedQueries(updatedOwner, updatedRepo);
      }
    },
    [invalidateRepositoryScopedQueries]
  );

  const handleGitHubAuthUpdated = useCallback((): void => {
    void invalidateGitHubSessionQueries();
  }, [invalidateGitHubSessionQueries]);

  const mutation = useMutation({
    mutationFn: api.github.mutate,
    onSuccess: async (_result, input: GitHubMutationInput) => {
      const accountInvalidations: Array<Promise<void>> = [];
      accountInvalidations.push(queryClient.invalidateQueries({ queryKey: ["notifications"] }));
      if (mutationAffectsAccountIssues(input.action)) {
        accountInvalidations.push(queryClient.invalidateQueries({ queryKey: ["account-issues"] }));
      }
      if (mutationAffectsAccountPulls(input.action)) {
        accountInvalidations.push(queryClient.invalidateQueries({ queryKey: ["account-pulls"] }));
      }
      if (mutationAffectsAccountProfile(input.action)) {
        accountInvalidations.push(queryClient.invalidateQueries({ queryKey: ["account-profile"] }));
      }
      if (mutationAffectsRepositoryCollections(input.action)) {
        accountInvalidations.push(queryClient.invalidateQueries({ queryKey: ["repositories"] }));
        accountInvalidations.push(
          queryClient.invalidateQueries({ queryKey: ["github-account-repositories"] })
        );
        accountInvalidations.push(queryClient.invalidateQueries({ queryKey: ["organizations"] }));
        accountInvalidations.push(queryClient.invalidateQueries({ queryKey: ["organization-repositories"] }));
        accountInvalidations.push(
          queryClient.invalidateQueries({ queryKey: ["organization-team-repositories"] })
        );
      }

      await Promise.all([
        invalidateRepositoryScopedQueries(input.owner, input.repo),
        ...accountInvalidations
      ]);
    }
  });
  const areaPinMutation = useMutation({
    mutationFn: ({ pinned: _pinned, ...input }: RepositoryPinInput & { pinned: boolean }) =>
      _pinned ? api.unpinAreaRepository(input) : api.pinAreaRepository(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["repository-pins"] });
      const previousPins = queryClient.getQueryData<RepositoryPinRecord[]>(["repository-pins"]) ?? [];
      const targetKey = areaRepositoryPinKey(input.areaId, input.repositoryId, input.workspaceId ?? null);
      const remainingPins = previousPins.filter(
        (pin) => areaRepositoryPinKey(pin.areaId, pin.repositoryId, pin.workspaceId ?? null) !== targetKey
      );
      const nextPins = input.pinned
        ? remainingPins
        : [
            {
              areaId: input.areaId ?? null,
              repositoryId: input.repositoryId ?? null,
              workspaceId: input.workspaceId ?? null,
              nameWithOwner: input.nameWithOwner ?? null,
              createdAt: new Date().toISOString()
            },
            ...remainingPins
          ];
      queryClient.setQueryData(["repository-pins"], nextPins);
      return { previousPins };
    },
    onError: (_error, _input, context) => {
      if (context?.previousPins) {
        queryClient.setQueryData(["repository-pins"], context.previousPins);
      }
    },
    onSuccess: (pins) => {
      queryClient.setQueryData(["repository-pins"], pins);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["repository-pins"] });
    }
  });
  const recentMutation = useMutation({
    mutationFn: api.recordRecentItem,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["local-recents"] });
      const previousItems = queryClient.getQueryData<LocalRecentItem[]>(recentItemsQueryKey) ?? [];
      const optimisticItem: LocalRecentItem = {
        kind: input.kind,
        provider: input.provider ?? "github",
        itemKey: input.itemKey,
        title: input.title,
        subtitle: input.subtitle ?? null,
        repositoryNameWithOwner: input.repositoryNameWithOwner ?? null,
        areaId: input.areaId ?? null,
        repositoryId: input.repositoryId ?? null,
        workspaceId: input.workspaceId ?? null,
        url: input.url ?? null,
        metadata: input.metadata ?? {},
        updatedAt: new Date().toISOString()
      };
      queryClient.setQueryData(
        recentItemsQueryKey,
        [
          optimisticItem,
          ...previousItems.filter((item) => item.kind !== input.kind || item.itemKey !== input.itemKey)
        ].slice(0, recentItemLimit)
      );
      return { previousItems };
    },
    onError: (_error, _input, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(recentItemsQueryKey, context.previousItems);
      }
    },
    onSuccess: (items) => {
      queryClient.setQueryData(recentItemsQueryKey, items.slice(0, recentItemLimit));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["local-recents"] });
    }
  });

  function toggleRepositoryPin(nameWithOwner: string): void {
    areaPinMutation.mutate({
      areaId: defaultGitHubAreaId,
      repositoryId: defaultGitHubAreaRepositoryId(nameWithOwner),
      workspaceId: null,
      nameWithOwner,
      pinned: pinnedRepositoryNameSet.has(nameWithOwner.toLowerCase())
    });
  }

  function toggleAreaRepositoryPin(
    repository: AreaRepositorySummary,
    workspaceId: string | null = null
  ): void {
    areaPinMutation.mutate({
      areaId: repository.areaId,
      repositoryId: repository.id,
      workspaceId,
      nameWithOwner: repository.connection?.nameWithOwner ?? undefined,
      pinned: areaRepositoryPinSet.has(areaRepositoryPinKey(repository.areaId, repository.id, workspaceId))
    });
  }

  function repositoryForRecent(nameWithOwner: string): RepositorySummary | RepositoryDetail | undefined {
    const normalized = nameWithOwner.toLowerCase();
    if (repositoryDetail?.nameWithOwner.toLowerCase() === normalized) {
      return repositoryDetail;
    }

    return repositoriesByName.get(normalized);
  }

  function recordRecent(input: LocalRecentRecordInput): void {
    recentMutation.mutate(input);
  }

  async function refreshHomeNow(): Promise<void> {
    if (!appState.isSuccess) {
      return;
    }

    const cachedRead = !githubReady;

    try {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["account-profile"],
          staleTime: 0,
          queryFn: () =>
            api.github.getAccountProfileWithStatus({
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["repositories", repositoryListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listRepositoriesWithStatus({
              limit: repositoryListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["account-issues", authenticatedViewerLogin ?? "viewer", defaultMailboxListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listAccountIssuesWithStatus({
              ...(authenticatedViewerLogin ? { login: authenticatedViewerLogin } : {}),
              state: "open",
              limit: defaultMailboxListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["account-pulls", authenticatedViewerLogin ?? "viewer", defaultMailboxListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listAccountPullRequestsWithStatus({
              ...(authenticatedViewerLogin ? { login: authenticatedViewerLogin } : {}),
              state: "open",
              limit: defaultMailboxListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: recentItemsQueryKey,
          staleTime: 0,
          queryFn: () => api.listRecentItems({ limit: recentItemLimit })
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshRepositoriesNow(): Promise<void> {
    try {
      await queryClient.fetchQuery({
        queryKey: ["repositories", repositoryListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listRepositoriesWithStatus({
            limit: repositoryListLimit,
            cacheOnly: !githubReady,
            forceRefresh: githubReady
          })
      });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshRepositoryDetailNow(): Promise<void> {
    if (!hasRepositoryParts) {
      return;
    }

    try {
      await queryClient.fetchQuery({
        queryKey: ["repository", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.getRepositoryWithStatus({
            owner,
            repo,
            cacheOnly: !githubReady,
            forceRefresh: githubReady
          })
      });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshContributorsNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;

    try {
      await queryClient.fetchQuery({
        queryKey: ["contributors", owner, repo, repositoryContributorLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listContributorsWithStatus({
            owner,
            repo,
            limit: repositoryContributorLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshCodeSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const ref = contentsRef ?? repositoryDetail?.defaultBranch ?? undefined;
    const refKey = contentsRef ?? "default";
    const cachedRead = !githubReady;

    try {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["branches", owner, repo, repositoryRefListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listBranchesWithStatus({
              owner,
              repo,
              limit: repositoryRefListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["tags", owner, repo, repositoryRefListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listTagsWithStatus({
              owner,
              repo,
              limit: repositoryRefListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["contents", owner, repo, refKey, "", "dir"],
          staleTime: 0,
          queryFn: () =>
            api.github.listContentsWithStatus({
              owner,
              repo,
              ref,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["readme", owner, repo, refKey],
          staleTime: 0,
          queryFn: () =>
            api.github.getReadme({
              owner,
              repo,
              ref,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["commits", owner, repo, refKey, "", repositoryCommitHistoryLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listCommitsWithStatus({
              owner,
              repo,
              ref,
              limit: repositoryCommitHistoryLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshCodeBrowserNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const ref = codeBrowserRef ?? repositoryDetail?.defaultBranch ?? undefined;
    const refKey = codeBrowserRef ?? "default";
    const cachedRead = !githubReady;
    const refreshes: Array<Promise<unknown>> = [
      queryClient.fetchQuery({
        queryKey: ["branches", owner, repo, repositoryRefListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listBranchesWithStatus({
            owner,
            repo,
            limit: repositoryRefListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["tags", owner, repo, repositoryRefListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listTagsWithStatus({
            owner,
            repo,
            limit: repositoryRefListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    ];

    if (codeBrowserEntryType === "dir") {
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["contents", owner, repo, refKey, codeBrowserPath, "dir"],
          staleTime: 0,
          queryFn: () =>
            api.github.listContentsWithStatus({
              owner,
              repo,
              path: codeBrowserPath,
              ref,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );
    }

    if (codeBrowserEntryType === "file" && codeBrowserPath) {
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["file-content", owner, repo, refKey, codeBrowserPath],
          staleTime: 0,
          queryFn: () =>
            api.github.getFileContentWithStatus({
              owner,
              repo,
              path: codeBrowserPath,
              ref,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["file-blame", owner, repo, refKey, codeBrowserPath, fileBlameRangeLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.getFileBlame({
              owner,
              repo,
              path: codeBrowserPath,
              ref,
              maxRanges: fileBlameRangeLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["commits", owner, repo, refKey, codeBrowserPath, fileCommitHistoryLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listCommitsWithStatus({
              owner,
              repo,
              ref,
              path: codeBrowserPath,
              limit: fileCommitHistoryLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );
    }

    try {
      await Promise.all(refreshes);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshIssueSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;
    const issueNumber = route.kind === "repository" ? (route.issueNumber ?? null) : null;
    const refreshes: Array<Promise<unknown>> = [
      queryClient.fetchQuery({
        queryKey: ["issues", owner, repo, issueListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listIssuesWithStatus({
            owner,
            repo,
            state: "all",
            limit: issueListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["labels", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.listLabelsWithStatus({
            owner,
            repo,
            limit: 100,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["assignable-users", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.listAssignableUsersWithStatus({
            owner,
            repo,
            limit: 100,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["milestones", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.listMilestonesWithStatus({
            owner,
            repo,
            state: "all",
            limit: 100,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    ];

    if (issueNumber !== null) {
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["issue-detail", owner, repo, issueNumber],
          staleTime: 0,
          queryFn: () =>
            api.github.getIssueDetailWithStatus({
              owner,
              repo,
              issueNumber,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );
    }

    try {
      await Promise.all(refreshes);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshPullSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;
    const pullNumber = route.kind === "repository" ? (route.pullNumber ?? null) : null;
    const refreshes: Array<Promise<unknown>> = [
      queryClient.fetchQuery({
        queryKey: ["pulls", owner, repo, pullRequestListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listPullRequestsWithStatus({
            owner,
            repo,
            state: "all",
            limit: pullRequestListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["labels", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.listLabelsWithStatus({
            owner,
            repo,
            limit: 100,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["assignable-users", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.listAssignableUsersWithStatus({
            owner,
            repo,
            limit: 100,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["milestones", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.listMilestonesWithStatus({
            owner,
            repo,
            state: "all",
            limit: 100,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["branches", owner, repo, repositoryRefListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listBranchesWithStatus({
            owner,
            repo,
            limit: repositoryRefListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    ];

    if (pullNumber !== null) {
      const pullDetailInput = {
        owner,
        repo,
        pullNumber,
        cacheOnly: cachedRead,
        forceRefresh: !cachedRead
      };
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "overview", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.getPullRequestOverviewWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "comments", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestCommentsWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "files", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestFilesWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "commits", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestCommitsWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "reviews", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestReviewsWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "checks", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestChecksWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "review-threads", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestReviewThreadsWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "timeline", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestTimelineWithStatus(pullDetailInput)
        }),
        queryClient.fetchQuery({
          queryKey: ["pull-detail", "linked-issues", owner, repo, pullNumber],
          staleTime: 0,
          queryFn: () => api.github.listPullRequestLinkedIssuesWithStatus(pullDetailInput)
        })
      );
    }

    try {
      await Promise.all(refreshes);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshDiscussionsSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;

    try {
      await queryClient.fetchQuery({
        queryKey: ["discussions", owner, repo, discussionsLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listDiscussionsWithStatus({
            owner,
            repo,
            limit: discussionsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshProjectsSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;

    try {
      await queryClient.fetchQuery({
        queryKey: ["projects", owner, repo, projectsLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listProjectsWithStatus({
            owner,
            repo,
            limit: projectsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      });
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshWikiSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;
    const wikiQueryKeys = queryClient
      .getQueriesData<RepositoryWikiResult>({ queryKey: ["repository-wiki", owner, repo] })
      .map(([queryKey]) => queryKey)
      .filter(
        (queryKey): queryKey is readonly ["repository-wiki", string, string, string, number?] =>
          queryKey[0] === "repository-wiki" &&
          queryKey[1] === owner &&
          queryKey[2] === repo &&
          typeof queryKey[3] === "string" &&
          (queryKey[4] === undefined || typeof queryKey[4] === "number")
      );
    const keys =
      wikiQueryKeys.length > 0
        ? wikiQueryKeys
        : [["repository-wiki", owner, repo, "default", defaultWikiPageLimit] as const];

    try {
      await Promise.all(
        keys.map((queryKey) =>
          queryClient.fetchQuery({
            queryKey,
            staleTime: 0,
            queryFn: () =>
              api.github.getRepositoryWiki({
                owner,
                repo,
                pagePath: queryKey[3] === "default" ? null : queryKey[3],
                limit: queryKey[4] ?? defaultWikiPageLimit,
                cacheOnly: cachedRead,
                forceRefresh: !cachedRead
              })
          })
        )
      );
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshReleasesSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;

    try {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["releases", owner, repo, releasesLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listReleasesWithStatus({
              owner,
              repo,
              limit: releasesLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["branches", owner, repo, repositoryRefListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listBranchesWithStatus({
              owner,
              repo,
              limit: repositoryRefListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["tags", owner, repo, repositoryRefListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listTagsWithStatus({
              owner,
              repo,
              limit: repositoryRefListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshActionsSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;
    const workflowRunId = route.kind === "repository" ? (route.workflowRunId ?? null) : null;
    const ref = contentsRef ?? repositoryDetail?.defaultBranch ?? undefined;
    const refreshes: Array<Promise<unknown>> = [
      queryClient.fetchQuery({
        queryKey: ["actions", owner, repo, actionsLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listActionsWithStatus({
            owner,
            repo,
            limit: actionsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["branches", owner, repo, repositoryRefListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listBranchesWithStatus({
            owner,
            repo,
            limit: repositoryRefListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["tags", owner, repo, repositoryRefListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listTagsWithStatus({
            owner,
            repo,
            limit: repositoryRefListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["workflows", owner, repo, ref ?? "default", workflowDefinitionLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listWorkflowsWithStatus({
            owner,
            repo,
            ref: ref ?? null,
            limit: workflowDefinitionLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    ];

    if (workflowRunId !== null) {
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["action-detail", owner, repo, workflowRunId],
          staleTime: 0,
          queryFn: () =>
            api.github.getWorkflowRunDetailWithStatus({
              owner,
              repo,
              runId: workflowRunId,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );
    }

    try {
      await Promise.all(refreshes);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshAgentsSurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;

    try {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["issues", owner, repo, issueListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listIssuesWithStatus({
              owner,
              repo,
              state: "all",
              limit: issueListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["pulls", owner, repo, pullRequestListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listPullRequestsWithStatus({
              owner,
              repo,
              state: "all",
              limit: pullRequestListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["actions", owner, repo, actionsLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listActionsWithStatus({
              owner,
              repo,
              limit: actionsLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshSecurityQualitySurfaceNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;
    const defaultBranch = repositoryDetail?.defaultBranch ?? null;
    const protectionBranch = branchProtectionBranch;
    const refreshes: Array<Promise<unknown>> = [
      queryClient.fetchQuery({
        queryKey: ["dependabot-alerts", owner, repo, dependabotAlertsLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listDependabotAlerts({
            owner,
            repo,
            state: "open",
            limit: dependabotAlertsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["code-scanning-alerts", owner, repo, codeScanningAlertsLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listCodeScanningAlerts({
            owner,
            repo,
            state: "open",
            limit: codeScanningAlertsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["secret-scanning-alerts", owner, repo, secretScanningAlertsLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listSecretScanningAlerts({
            owner,
            repo,
            state: "open",
            limit: secretScanningAlertsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["repository-rulesets", owner, repo, repositoryRulesetsLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listRepositoryRulesets({
            owner,
            repo,
            includesParents: true,
            limit: repositoryRulesetsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["repository-security-advisories", owner, repo, repositorySecurityAdvisoriesLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listRepositorySecurityAdvisories({
            owner,
            repo,
            limit: repositorySecurityAdvisoriesLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: ["repository-community-profile", owner, repo],
        staleTime: 0,
        queryFn: () =>
          api.github.getRepositoryCommunityProfile({
            owner,
            repo,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    ];

    if (protectionBranch) {
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["branch-protection", owner, repo, protectionBranch],
          staleTime: 0,
          queryFn: () =>
            api.github.getBranchProtection({
              owner,
              repo,
              branch: protectionBranch,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );
    }

    if (defaultBranch) {
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["repository-security-policy", owner, repo, defaultBranch],
          staleTime: 0,
          queryFn: () =>
            api.github.getRepositorySecurityPolicy({
              owner,
              repo,
              ref: defaultBranch,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );
    }

    try {
      await Promise.all(refreshes);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshRepositorySettingsNow(): Promise<void> {
    if (!appState.isSuccess || !hasRepositoryParts) {
      return;
    }

    const cachedRead = !githubReady;

    try {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["branches", owner, repo, repositoryRefListLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listBranchesWithStatus({
              owner,
              repo,
              limit: repositoryRefListLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["repository-access", owner, repo, repositoryAccessLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.getRepositoryAccess({
              owner,
              repo,
              limit: repositoryAccessLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["repository-forks", owner, repo, forksLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listRepositoryForks({
              owner,
              repo,
              sort: "stargazers",
              limit: forksLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshMailboxNow(): Promise<void> {
    if (!appState.isSuccess) {
      return;
    }

    const cachedRead = !githubReady;
    const notificationInput = {
      all: notificationFilter === "all",
      limit: notificationLimit,
      cacheOnly: cachedRead,
      forceRefresh: !cachedRead
    };

    try {
      await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["account-issues", authenticatedViewerLogin ?? "viewer", mailboxWorkLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listAccountIssuesWithStatus({
              ...(authenticatedViewerLogin ? { login: authenticatedViewerLogin } : {}),
              state: "open",
              limit: mailboxWorkLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["account-pulls", authenticatedViewerLogin ?? "viewer", mailboxWorkLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listAccountPullRequestsWithStatus({
              ...(authenticatedViewerLogin ? { login: authenticatedViewerLogin } : {}),
              state: "open",
              limit: mailboxWorkLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: notificationQueryKey,
          staleTime: 0,
          queryFn: () =>
            api.github.listNotificationsWithStatus(
              notificationFilter === "participating"
                ? { ...notificationInput, participating: true }
                : notificationInput
            )
        })
      ]);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  async function refreshOrganizationsNow(): Promise<void> {
    if (!appState.isSuccess) {
      return;
    }

    const cachedRead = !githubReady;
    const refreshes: Array<Promise<unknown>> = [
      queryClient.fetchQuery({
        queryKey: ["organizations", organizationListLimit],
        staleTime: 0,
        queryFn: () =>
          api.github.listOrganizationsWithStatus({
            limit: organizationListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      refreshRepositoriesNow()
    ];

    if (selectedOrganization) {
      const org = selectedOrganization.login;
      const orgRepositoryLimit = organizationRepositoryLimits[org] ?? defaultOrganizationRepositoryLimit;
      const orgTeamLimit = organizationTeamLimits[org] ?? defaultOrganizationTeamLimit;
      const orgMemberLimit = organizationMemberLimits[org] ?? defaultOrganizationMemberLimit;
      const orgProjectLimit = organizationProjectLimits[org] ?? defaultOrganizationProjectLimit;
      refreshes.push(
        queryClient.fetchQuery({
          queryKey: ["organization-teams", org, orgTeamLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listOrganizationTeamsWithStatus({
              org,
              limit: orgTeamLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["organization-repositories", org, orgRepositoryLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listOrganizationRepositoriesWithStatus({
              org,
              limit: orgRepositoryLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["organization-members", org, orgMemberLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listOrganizationMembersWithStatus({
              org,
              limit: orgMemberLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        }),
        queryClient.fetchQuery({
          queryKey: ["organization-projects", org, orgProjectLimit],
          staleTime: 0,
          queryFn: () =>
            api.github.listOrganizationProjectsWithStatus({
              org,
              limit: orgProjectLimit,
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      );

      if (selectedOrganizationTeam) {
        const teamLimitKey = `${org}/${selectedOrganizationTeam.slug}`;
        const teamRepositoryLimit =
          organizationTeamRepositoryLimits[teamLimitKey] ?? defaultOrganizationTeamRepositoryLimit;
        const teamMemberLimit =
          organizationTeamMemberLimits[teamLimitKey] ?? defaultOrganizationTeamMemberLimit;
        refreshes.push(
          queryClient.fetchQuery({
            queryKey: [
              "organization-team-repositories",
              org,
              selectedOrganizationTeam.slug,
              teamRepositoryLimit
            ],
            staleTime: 0,
            queryFn: () =>
              api.github.listOrganizationTeamRepositoriesWithStatus({
                org,
                teamSlug: selectedOrganizationTeam.slug,
                limit: teamRepositoryLimit,
                cacheOnly: cachedRead,
                forceRefresh: !cachedRead
              })
          }),
          queryClient.fetchQuery({
            queryKey: ["organization-team-members", org, selectedOrganizationTeam.slug, teamMemberLimit],
            staleTime: 0,
            queryFn: () =>
              api.github.listOrganizationTeamMembersWithStatus({
                org,
                teamSlug: selectedOrganizationTeam.slug,
                limit: teamMemberLimit,
                cacheOnly: cachedRead,
                forceRefresh: !cachedRead
              })
          })
        );
      }
    }

    try {
      await Promise.all(refreshes);
    } catch {
      // React Query owns the visible error state for this refresh.
    }
  }

  function openRepositoryInApp(nameWithOwner: string, tab?: RepositoryTab): void {
    goToRepository(nameWithOwner, tab);
    recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), tab ?? "code"));
  }

  async function selectArea(areaId: string): Promise<void> {
    selectAreaInStore(areaId);
    await api.areas.selectArea(areaId);
    await queryClient.invalidateQueries({ queryKey: ["areas"] });
  }

  async function addLocalArea(): Promise<void> {
    const rootPath = await api.areas.openLocalFolderPicker();
    if (!rootPath) {
      return;
    }
    const area = await api.areas.createLocalArea({ rootPath });
    selectAreaInStore(area.id);
    await queryClient.invalidateQueries({ queryKey: ["areas"] });
    await queryClient.invalidateQueries({ queryKey: ["area-repositories", area.id] });
  }

  async function createSshArea(input: CreateSshAreaInput): Promise<void> {
    const area = await api.areas.createSshArea(input);
    selectAreaInStore(area.id);
    await queryClient.invalidateQueries({ queryKey: ["areas"] });
    await queryClient.invalidateQueries({ queryKey: ["area-repositories", area.id] });
  }

  async function updateArea(input: UpdateAreaInput): Promise<void> {
    const area = await api.areas.updateArea(input);
    await queryClient.invalidateQueries({ queryKey: ["areas"] });
    await queryClient.invalidateQueries({ queryKey: ["area-repositories", area.id] });
  }

  async function deleteArea(area: AreaSummary): Promise<void> {
    const remainingAreas = await api.areas.removeArea(area.id);
    if (selectedAreaId === area.id) {
      const fallbackArea =
        remainingAreas.find((candidate) => candidate.selected) ??
        remainingAreas.find((candidate) => candidate.kind === "github") ??
        remainingAreas[0] ??
        null;
      if (fallbackArea) {
        selectAreaInStore(fallbackArea.id);
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["areas"] });
    await queryClient.invalidateQueries({ queryKey: ["area-repositories", area.id] });
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

  function openMarkdownUrl(url: string): void {
    const parsed = parseGitHubRepositoryUrl(url);
    if (!parsed) {
      void api.openExternal(url);
      return;
    }

    const [, , surface, rawValue] = parsed.segments;
    const nameWithOwner = parsed.nameWithOwner;
    const number = rawValue ? Number(rawValue) : null;

    if (parsed.segments.length === 2) {
      openRepositoryInApp(nameWithOwner);
      return;
    }

    if (surface === "issues" && number !== null && Number.isInteger(number) && number > 0) {
      navigate({ kind: "repository", nameWithOwner, tab: "issues", issueNumber: number });
      recordRecent(issueReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (
      (surface === "pull" || surface === "pulls") &&
      number !== null &&
      Number.isInteger(number) &&
      number > 0
    ) {
      navigate({ kind: "repository", nameWithOwner, tab: "pulls", pullNumber: number });
      recordRecent(pullRequestReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (surface === "discussions" && number !== null && Number.isInteger(number) && number > 0) {
      navigate({ kind: "repository", nameWithOwner, tab: "discussions", discussionNumber: number });
      recordRecent(discussionReferenceRecentInput(nameWithOwner, number, url));
      return;
    }

    if (surface === "actions" && parsed.segments[3] === "runs") {
      const runId = parseWorkflowRunIdFromUrl(url);
      if (runId !== null) {
        openWorkflowRunReferenceInApp(nameWithOwner, runId, url);
        return;
      }
    }

    if (surface === "releases") {
      const tagName = parsed.segments[3] === "tag" ? parsed.segments.slice(4).join("/") : null;
      navigate({
        kind: "repository",
        nameWithOwner,
        tab: "releases",
        releaseTagName: tagName || undefined
      });
      if (tagName) {
        recordRecent(releaseTagReferenceRecentInput(nameWithOwner, tagName, url));
      } else {
        recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "releases"));
      }
      return;
    }

    if ((surface === "commit" || surface === "commits") && rawValue) {
      openCommitInApp({
        nameWithOwner,
        commit: {
          sha: rawValue,
          headline: rawValue.slice(0, 7),
          authorLogin: null,
          authorName: null,
          authoredDate: null,
          committedDate: null,
          htmlUrl: `https://github.com/${nameWithOwner}/commit/${rawValue}`
        }
      });
      return;
    }

    if (surface === "blob" || surface === "tree") {
      const refCandidates = [
        ...branchItems.map((branch) => branch.name),
        ...tagItems.map((tag) => tag.name),
        repositoryRefs[nameWithOwner],
        nameWithOwner.toLowerCase() === effectiveRepository.toLowerCase() ? contentsRef : null,
        repositoryDetail?.nameWithOwner.toLowerCase() === nameWithOwner.toLowerCase()
          ? repositoryDetail.defaultBranch
          : null
      ].filter((ref): ref is string => Boolean(ref));
      const codeRoute = parseGitHubCodeUrl(url, refCandidates, rawValue);
      if (codeRoute) {
        openCodeBrowserInApp(
          codeRoute.nameWithOwner,
          codeRoute.path,
          codeRoute.entryType,
          codeRoute.ref,
          codeRoute.line
        );
        return;
      }
    }

    if (surface === "wiki") {
      const pagePath = parsed.segments.slice(3).join("/");
      if (pagePath) {
        selectWikiPageInApp(nameWithOwner, {
          path: pagePath,
          title: pagePath.split("/").at(-1) ?? pagePath,
          htmlUrl: url,
          sha: pagePath,
          size: null
        });
      } else {
        navigate({ kind: "repository", nameWithOwner, tab: "wiki" });
        recordRecent(repositoryRecentInput(nameWithOwner, repositoryForRecent(nameWithOwner), "wiki"));
      }
      return;
    }

    void api.openExternal(url);
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
    if (item.kind === "organization") {
      const organizationLogin = recentMetadataString(item, "login") ?? item.itemKey;
      if (organizationLogin) {
        setSelectedOrganizationLogin(organizationLogin);
        setSelectedOrganizationTeamSlug(null);
        setSelectedOrganizationMemberLogin(null);
        setSelectedOrganizationProjectId(null);
        goToOrganizations();
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "team") {
      const [itemKeyOrganizationLogin, itemKeyTeamSlug] = item.itemKey.split("/");
      const organizationLogin = recentMetadataString(item, "organizationLogin") ?? itemKeyOrganizationLogin;
      const teamSlug = recentMetadataString(item, "slug") ?? itemKeyTeamSlug;
      if (organizationLogin && teamSlug) {
        setSelectedOrganizationLogin(organizationLogin);
        setSelectedOrganizationTeamSlug(teamSlug);
        setSelectedOrganizationMemberLogin(null);
        setSelectedOrganizationProjectId(null);
        goToOrganizations();
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "repository" && item.provider === "local" && item.areaId && item.repositoryId) {
      goToLocalRepository(item.areaId, item.repositoryId, "overview", item.workspaceId ?? null);
      recordRecent(recentItemRecordInput(item));
      return;
    }

    if (item.kind === "repository" && item.repositoryNameWithOwner) {
      const tab = recentMetadataString(item, "tab");
      const repositoryTab = repoTabs.some((repositoryTab) => repositoryTab.key === tab)
        ? (tab as RepositoryTab)
        : undefined;
      const ref = recentMetadataString(item, "ref");
      if ((repositoryTab ?? "code") === "code" && ref) {
        openCodeBrowserInApp(item.repositoryNameWithOwner, "", "dir", ref);
        recordRecent(recentItemRecordInput(item));
        return;
      }
      navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: repositoryTab ?? "code"
      });
      recordRecent(recentItemRecordInput(item));
      return;
    }

    if (item.kind === "contributor" && item.repositoryNameWithOwner) {
      const contributorLogin = recentMetadataString(item, "login");
      if (contributorLogin) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "contributors",
          contributorLogin
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "file" && item.provider === "local" && item.areaId && item.repositoryId) {
      const path = recentMetadataString(item, "path");
      goToLocalRepository(item.areaId, item.repositoryId, "code", item.workspaceId ?? null, path ?? ".");
      recordRecent(recentItemRecordInput(item));
      return;
    }

    if (item.kind === "file" && item.repositoryNameWithOwner) {
      const path = recentMetadataString(item, "path");
      if (path) {
        openCodeBrowserInApp(
          item.repositoryNameWithOwner,
          path,
          "file",
          recentMetadataString(item, "ref"),
          recentMetadataNumber(item, "line")
        );
        return;
      }
    }

    if (item.kind === "commit" && item.repositoryNameWithOwner) {
      const sha = recentMetadataString(item, "sha") ?? item.itemKey.split(":commit:")[1]?.split(":")[0];
      if (sha) {
        const path = recentMetadataString(item, "path") ?? "";
        const entryType = recentMetadataString(item, "entryType") === "file" ? "file" : "dir";
        openCodeBrowser(
          item.repositoryNameWithOwner,
          path,
          entryType,
          sha,
          recentMetadataNumber(item, "line")
        );
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "issue" && item.repositoryNameWithOwner) {
      const issueNumber = recentMetadataNumber(item, "number");
      if (issueNumber !== null) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "issues",
          issueNumber
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "pullRequest" && item.repositoryNameWithOwner) {
      const pullNumber = recentMetadataNumber(item, "number");
      if (pullNumber !== null) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "pulls",
          pullNumber
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "discussion" && item.repositoryNameWithOwner) {
      const discussionNumber = recentMetadataNumber(item, "number");
      if (discussionNumber !== null) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "discussions",
          discussionNumber
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "release" && item.repositoryNameWithOwner) {
      const releaseTagName = recentMetadataString(item, "tagName");
      const releaseId = recentMetadataNumber(item, "releaseId");
      if (releaseTagName || releaseId !== null) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "releases",
          releaseId: releaseId ?? undefined,
          releaseTagName: releaseTagName ?? undefined
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "releaseAsset" && item.repositoryNameWithOwner) {
      const releaseTagName = recentMetadataString(item, "tagName");
      const releaseId = recentMetadataNumber(item, "releaseId");
      const releaseAssetId = recentMetadataNumber(item, "assetId");
      if ((releaseTagName || releaseId !== null) && releaseAssetId !== null) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "releases",
          releaseId: releaseId ?? undefined,
          releaseTagName: releaseTagName ?? undefined,
          releaseAssetId
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "project" && item.repositoryNameWithOwner) {
      const projectId = recentMetadataString(item, "projectId");
      if (projectId) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "projects",
          projectId
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "project") {
      const organizationLogin = recentMetadataString(item, "organizationLogin");
      const projectId = recentMetadataString(item, "projectId");
      if (organizationLogin && projectId) {
        setSelectedOrganizationLogin(organizationLogin);
        setSelectedOrganizationTeamSlug(null);
        setSelectedOrganizationMemberLogin(null);
        setSelectedOrganizationProjectId(projectId);
        goToOrganizations();
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "workflowRun" && item.repositoryNameWithOwner) {
      const workflowRunId = recentMetadataNumber(item, "runId");
      if (workflowRunId !== null) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "actions",
          workflowRunId
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "workflowArtifact" && item.repositoryNameWithOwner) {
      const workflowRunId = recentMetadataNumber(item, "runId");
      const workflowArtifactId = recentMetadataNumber(item, "artifactId");
      if (workflowRunId !== null && workflowArtifactId !== null) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "actions",
          workflowRunId,
          workflowArtifactId
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "securityItem" && item.repositoryNameWithOwner) {
      const securityItemKind = recentMetadataString(item, "securityItemKind");
      const securityItemId = recentMetadataString(item, "securityItemId");
      if (
        securityItemId &&
        (securityItemKind === "dependabot" ||
          securityItemKind === "codeScanning" ||
          securityItemKind === "secretScanning" ||
          securityItemKind === "ruleset" ||
          securityItemKind === "advisory")
      ) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "securityQuality",
          securityItemKind,
          securityItemId
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.kind === "wikiPage" && item.repositoryNameWithOwner) {
      const wikiPagePath = recentMetadataString(item, "path");
      if (wikiPagePath) {
        navigate({
          kind: "repository",
          nameWithOwner: item.repositoryNameWithOwner,
          tab: "wiki",
          wikiPagePath
        });
        recordRecent(recentItemRecordInput(item));
        return;
      }
    }

    if (item.url) {
      void api.openExternal(item.url);
    }
  }

  async function refreshRepositorySurface(): Promise<void> {
    await refreshRepositoryDetailNow();
    if (activeRepositoryTab === "code") {
      await refreshCodeSurfaceNow();
      await queryClient.invalidateQueries({ queryKey: ["tree", owner, repo] });
      return;
    }
    if (activeRepositoryTab === "issues") {
      await refreshIssueSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "pulls") {
      await refreshPullSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "discussions") {
      await refreshDiscussionsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "projects") {
      await refreshProjectsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "releases") {
      await refreshReleasesSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "actions") {
      await refreshActionsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "agents") {
      await refreshAgentsSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "contributors") {
      await refreshContributorsNow();
      return;
    }
    if (activeRepositoryTab === "wiki") {
      await refreshWikiSurfaceNow();
      return;
    }
    if (activeRepositoryTab === "securityQuality") {
      await refreshSecurityQualitySurfaceNow();
      return;
    }
    if (activeRepositoryTab === "settings") {
      await refreshRepositorySettingsNow();
      return;
    }
  }

  const commandPaletteItems = (() => {
    const repositoriesRefreshDisabledReason = repositories.isFetching
      ? "Repositories are already refreshing."
      : null;
    const mailboxRefreshInFlight =
      notifications.isFetching || accountIssues.isFetching || accountPulls.isFetching;
    const mailboxRefreshDisabledReason = mailboxRefreshInFlight
      ? "Mailbox data is already refreshing."
      : null;
    const loadedUnreadNotificationIds = notificationItems
      .filter((notification) => notification.unread)
      .map((notification) => notification.id);
    const markLoadedNotificationsReadDisabledReason = markVisibleNotificationsRead.isPending
      ? "Notifications are already being marked as read."
      : !githubReady
        ? "Sign in with GitHub to mark notifications as read."
        : notifications.isLoading
          ? "Notifications are still loading."
          : loadedUnreadNotificationIds.length === 0
            ? "No loaded unread notifications."
            : null;
    const organizationsRefreshInFlight =
      organizations.isFetching ||
      organizationTeams.isFetching ||
      organizationMembers.isFetching ||
      organizationRepositories.isFetching ||
      organizationTeamRepositories.isFetching ||
      organizationTeamMembers.isFetching ||
      organizationProjects.isFetching;
    const organizationsRefreshDisabledReason = organizationsRefreshInFlight
      ? "Organization data is already refreshing."
      : null;

    const items: CommandPaletteItem[] = [
      {
        id: "command-home",
        title: "Home",
        subtitle: "Open the account dashboard",
        group: "Commands",
        icon: Home,
        keywords: ["dashboard", "account"],
        run: goHome
      },
      {
        id: "command-refresh-home",
        title: "Refresh Home",
        subtitle: githubReady
          ? "Refresh profile, repositories, assigned work, and recents"
          : "Reload cached Home data",
        group: "Refresh",
        icon: RefreshCw,
        keywords: ["refresh home", "reload home", "sync home", "stale"],
        disabledReason:
          appState.isFetching || repositories.isFetching || accountProfile.isFetching
            ? "Home data is already refreshing."
            : null,
        run: () => {
          void refreshHomeNow();
        }
      },
      {
        id: "command-repositories",
        title: "Repositories",
        subtitle: "Browse cached GitHub repositories",
        group: "Commands",
        icon: Code2,
        keywords: ["repos", "local"],
        run: goToRepositories
      },
      {
        id: "command-add-repository",
        title: "Add repository",
        subtitle: "Search local and GitHub repositories to open in Control",
        group: "Commands",
        icon: Plus,
        keywords: ["add repository", "repository picker", "repo search", "open repository"],
        run: () => setAddRepositoryOpen(true)
      },
      {
        id: "command-refresh-repositories",
        title: "Refresh repositories",
        subtitle: githubReady ? "Refresh account repository data" : "Reload cached repository data",
        group: "Refresh",
        icon: RefreshCw,
        keywords: ["refresh repositories", "reload repositories", "sync repositories", "stale"],
        disabledReason: repositoriesRefreshDisabledReason,
        run: () => {
          void refreshRepositoriesNow();
        }
      },
      {
        id: "command-organizations",
        title: "Organizations",
        subtitle: "Open organization overview",
        group: "Commands",
        icon: Building2,
        keywords: ["orgs", "teams"],
        run: () => {
          setSelectedOrganizationTeamSlug(null);
          setSelectedOrganizationMemberLogin(null);
          setSelectedOrganizationProjectId(null);
          goToOrganizations();
        }
      },
      {
        id: "command-refresh-organizations",
        title: "Refresh organizations",
        subtitle: githubReady
          ? "Refresh organizations, repositories, teams, members, and projects"
          : "Reload cached organization data",
        group: "Refresh",
        icon: RefreshCw,
        keywords: [
          "refresh organizations",
          "reload orgs",
          "repositories",
          "teams",
          "members",
          "organization projects",
          "stale"
        ],
        disabledReason: organizationsRefreshDisabledReason,
        run: () => {
          void refreshOrganizationsNow();
        }
      },
      {
        id: "command-mailbox",
        title: "Mailbox",
        subtitle: "Open GitHub notifications and account work",
        group: "Commands",
        icon: Inbox,
        keywords: ["notifications", "inbox"],
        run: goToMailbox
      },
      {
        id: "command-refresh-mailbox",
        title: "Refresh mailbox",
        subtitle: githubReady ? "Refresh notifications and assigned work" : "Reload cached mailbox data",
        group: "Refresh",
        icon: RefreshCw,
        keywords: ["refresh mailbox", "refresh notifications", "reload inbox", "assigned work", "stale"],
        disabledReason: mailboxRefreshDisabledReason,
        run: () => {
          void refreshMailboxNow();
        }
      },
      {
        id: "command-mark-loaded-notifications-read",
        title: "Mark loaded notifications read",
        subtitle: "Mark unread GitHub notifications currently loaded in Mailbox",
        group: "Commands",
        icon: CheckCircle2,
        keywords: ["mark read", "notifications", "inbox", "mailbox", "unread"],
        disabledReason: markLoadedNotificationsReadDisabledReason,
        run: () => {
          markVisibleNotificationsRead.mutate({ threadIds: loadedUnreadNotificationIds });
        }
      }
    ];

    for (const organization of organizationItems.slice(0, commandPaletteGeneralSourceLimit)) {
      const membershipLabel =
        organization.viewerMembershipRole ??
        (organization.viewerCanAdminister
          ? "admin"
          : organization.viewerIsMember
            ? "member"
            : "outside collaborator");

      items.push({
        id: `organization-${organization.login}`,
        title: organization.name ?? organization.login,
        subtitle: `${organization.login} · ${membershipLabel}`,
        group: "Organizations",
        icon: Building2,
        keywords: [
          organization.login,
          organization.name ?? "",
          organization.description ?? "",
          organization.viewerMembershipRole ?? "",
          organization.viewerMembershipState ?? "",
          membershipLabel,
          organization.viewerCanAdminister ? "admin" : "",
          organization.viewerIsMember ? "member" : "",
          organization.viewerCanCreateRepositories ? "can create repositories" : "",
          organization.viewerCanCreateTeams ? "can create teams" : ""
        ],
        run: () => {
          recordRecent(organizationRecentInput(organization));
          setSelectedOrganizationLogin(organization.login);
          setSelectedOrganizationTeamSlug(null);
          setSelectedOrganizationMemberLogin(null);
          setSelectedOrganizationProjectId(null);
          goToOrganizations();
        }
      });
    }

    for (const team of (organizationTeams.data?.items ?? []).slice(0, commandPaletteGeneralSourceLimit)) {
      items.push({
        id: `organization-team-${team.organizationLogin}-${team.slug}`,
        title: team.name,
        subtitle: `${team.organizationLogin}/${team.slug}${team.privacy ? ` · ${team.privacy}` : ""}`,
        group: "Teams",
        icon: Users,
        keywords: [
          team.organizationLogin,
          team.name,
          team.slug,
          team.description ?? "",
          team.privacy ?? "",
          team.permission ?? "",
          team.notificationSetting ?? "",
          team.parent?.name ?? "",
          team.parent?.slug ?? ""
        ],
        run: () => {
          recordRecent(teamRecentInput(team));
          setSelectedOrganizationLogin(team.organizationLogin);
          setSelectedOrganizationTeamSlug(team.slug);
          setSelectedOrganizationMemberLogin(null);
          setSelectedOrganizationProjectId(null);
          goToOrganizations();
        }
      });
    }

    if (organizationRepositories.data?.items && selectedOrganization) {
      for (const repository of organizationRepositories.data.items.slice(
        0,
        commandPaletteGeneralSourceLimit
      )) {
        items.push({
          id: `organization-repository-${selectedOrganization.login}-${repository.id}`,
          title: repository.name,
          subtitle: `${repository.nameWithOwner} · ${repository.permission ?? "permission unknown"} · ${
            repository.visibility?.toLowerCase() ?? "visibility unknown"
          }`,
          group: "Organization repositories",
          icon: Code2,
          keywords: [
            selectedOrganization.login,
            selectedOrganization.name ?? "",
            repository.id,
            repository.owner,
            repository.name,
            repository.nameWithOwner,
            repository.description ?? "",
            repository.visibility ?? "",
            repository.isPrivate === null ? "" : repository.isPrivate ? "private" : "public",
            repository.permission ?? "",
            repository.htmlUrl,
            repository.defaultBranch ?? "",
            repository.updatedAt ?? "",
            repository.pushedAt ?? ""
          ],
          run: () => openRepositoryInApp(repository.nameWithOwner)
        });
      }
    }

    if (organizationTeamRepositories.data?.items && selectedOrganization && selectedOrganizationTeam) {
      for (const repository of organizationTeamRepositories.data.items.slice(
        0,
        commandPaletteGeneralSourceLimit
      )) {
        items.push({
          id: `organization-team-repository-${selectedOrganization.login}-${selectedOrganizationTeam.slug}-${repository.id}`,
          title: repository.name,
          subtitle: `${selectedOrganizationTeam.name} · ${repository.nameWithOwner} · ${
            repository.permission ?? "permission unknown"
          } · ${repository.visibility?.toLowerCase() ?? "visibility unknown"}`,
          group: "Organization repositories",
          icon: Code2,
          keywords: [
            selectedOrganization.login,
            selectedOrganization.name ?? "",
            selectedOrganizationTeam.name,
            selectedOrganizationTeam.slug,
            selectedOrganizationTeam.privacy ?? "",
            selectedOrganizationTeam.permission ?? "",
            repository.id,
            repository.owner,
            repository.name,
            repository.nameWithOwner,
            repository.description ?? "",
            repository.visibility ?? "",
            repository.isPrivate === null ? "" : repository.isPrivate ? "private" : "public",
            repository.permission ?? "",
            repository.htmlUrl,
            repository.defaultBranch ?? "",
            repository.updatedAt ?? "",
            repository.pushedAt ?? ""
          ],
          run: () => openRepositoryInApp(repository.nameWithOwner)
        });
      }
    }

    if (organizationProjects.data?.items && selectedOrganization) {
      for (const project of organizationProjects.data.items.slice(0, commandPaletteGeneralSourceLimit)) {
        items.push({
          id: `organization-project-${selectedOrganization.login}-${project.id}`,
          title: project.number ? `#${project.number} ${project.title}` : project.title,
          subtitle: `${selectedOrganization.login} project · ${project.closed ? "closed" : "open"} · ${
            project.isPublic === null ? "visibility unknown" : project.isPublic ? "public" : "private"
          }`,
          group: "Organization projects",
          icon: SquareKanban,
          keywords: [
            selectedOrganization.login,
            selectedOrganization.name ?? "",
            project.id,
            project.number ? String(project.number) : "",
            project.number ? `#${project.number}` : "",
            project.title,
            project.shortDescription ?? "",
            project.readme ?? "",
            project.ownerLogin ?? "",
            project.ownerKind,
            project.ownerHtmlUrl ?? "",
            project.isPublic === null ? "" : project.isPublic ? "public" : "private",
            project.closed ? "closed" : "open",
            project.closedAt ?? "",
            project.createdAt ?? "",
            project.updatedAt ?? "",
            project.itemsCount === null ? "" : `${project.itemsCount} items`,
            project.fieldsCount === null ? "" : `${project.fieldsCount} fields`,
            project.viewerCanUpdate === null ? "" : project.viewerCanUpdate ? "can update" : "read only",
            project.htmlUrl ?? "",
            ...project.fields.flatMap((field) => [field.id, field.name, field.dataType ?? ""])
          ],
          run: () => selectOrganizationProjectInApp(selectedOrganization, project)
        });
      }
    }

    if (organizationMembers.data?.items && selectedOrganization) {
      for (const member of organizationMembers.data.items.slice(0, commandPaletteDenseSourceLimit)) {
        items.push({
          id: `organization-member-${selectedOrganization.login}-${member.id}`,
          title: member.login,
          subtitle: `${selectedOrganization.login} member${member.siteAdmin ? " · site admin" : ""}`,
          group: "Organization members",
          icon: Users,
          keywords: [
            selectedOrganization.login,
            selectedOrganization.name ?? "",
            member.id,
            member.login,
            member.htmlUrl ?? "",
            member.avatarUrl ?? "",
            member.siteAdmin === null ? "" : member.siteAdmin ? "site admin" : "member"
          ],
          run: () => {
            recordRecent(organizationRecentInput(selectedOrganization));
            setSelectedOrganizationLogin(selectedOrganization.login);
            setSelectedOrganizationTeamSlug(null);
            setSelectedOrganizationMemberLogin(member.login);
            setSelectedOrganizationProjectId(null);
            goToOrganizations();
          }
        });
      }
    }

    if (organizationTeamMembers.data?.items && selectedOrganization && selectedOrganizationTeam) {
      for (const member of organizationTeamMembers.data.items.slice(0, commandPaletteDenseSourceLimit)) {
        items.push({
          id: `organization-team-member-${selectedOrganization.login}-${selectedOrganizationTeam.slug}-${member.id}`,
          title: member.login,
          subtitle: `${selectedOrganizationTeam.name} member${member.siteAdmin ? " · site admin" : ""}`,
          group: "Organization members",
          icon: Users,
          keywords: [
            selectedOrganization.login,
            selectedOrganization.name ?? "",
            selectedOrganizationTeam.name,
            selectedOrganizationTeam.slug,
            selectedOrganizationTeam.privacy ?? "",
            selectedOrganizationTeam.permission ?? "",
            member.id,
            member.login,
            member.htmlUrl ?? "",
            member.avatarUrl ?? "",
            member.siteAdmin === null ? "" : member.siteAdmin ? "site admin" : "member"
          ],
          run: () => {
            recordRecent(teamRecentInput(selectedOrganizationTeam));
            setSelectedOrganizationLogin(selectedOrganization.login);
            setSelectedOrganizationTeamSlug(selectedOrganizationTeam.slug);
            setSelectedOrganizationMemberLogin(member.login);
            setSelectedOrganizationProjectId(null);
            goToOrganizations();
          }
        });
      }
    }

    for (const notification of notificationItems.slice(0, commandPaletteGeneralSourceLimit)) {
      const target = notificationInAppTarget(notification);
      const opensInApp = Boolean(target && notification.repositoryNameWithOwner);
      const notificationIcon =
        target?.kind === "issue"
          ? CircleDot
          : target?.kind === "pullRequest"
            ? GitPullRequest
            : target?.kind === "discussion"
              ? MessageSquare
              : target?.kind === "release"
                ? Tag
                : target?.kind === "workflowRun"
                  ? Workflow
                  : Inbox;

      items.push({
        id: `notification-${notification.id}`,
        title: notification.subject.title,
        subtitle: `${notification.repositoryNameWithOwner ?? "GitHub notification"} · ${notificationReasonLabel(notification.reason)}`,
        group: "Notifications",
        icon: notificationIcon,
        keywords: [
          notification.subject.title,
          notification.subject.type,
          notification.repositoryNameWithOwner ?? "",
          notification.repositoryHtmlUrl ?? "",
          notification.reason,
          notificationReasonLabel(notification.reason),
          notification.unread ? "unread" : "read",
          notification.participating ? "participating" : "not participating",
          opensInApp ? "in app" : "external",
          opensInApp ? "in-app" : "fallback",
          opensInApp ? "control" : "github"
        ],
        run: () => openNotificationInApp(notification)
      });
    }

    for (const issue of accountIssueItems.slice(0, commandPaletteGeneralSourceLimit)) {
      const nameWithOwner =
        issue.repositoryNameWithOwner ?? repositoryNameWithOwnerFromGitHubUrl(issue.htmlUrl);

      items.push({
        id: `account-issue-${nameWithOwner ?? issue.htmlUrl}-${issue.number}`,
        title: issue.title,
        subtitle: `${nameWithOwner ?? "GitHub issue"} #${issue.number} · ${issueStateLabel(issue)}`,
        group: "Account work",
        icon: CircleDot,
        keywords: [
          issue.title,
          nameWithOwner ?? "",
          issue.htmlUrl,
          String(issue.number),
          `#${issue.number}`,
          issue.state,
          issueStateLabel(issue),
          issue.stateReason ?? "",
          issue.authorLogin ?? "",
          issue.milestone?.title ?? "",
          ...issue.labels.flatMap((label) => [label.name, `label:${label.name}`]),
          ...(issue.assignees ?? []).flatMap((assignee) => [assignee.login, `assignee:${assignee.login}`])
        ],
        run: () => openIssueSummaryInApp(issue)
      });
    }

    for (const pullRequest of accountPullItems.slice(0, commandPaletteGeneralSourceLimit)) {
      const nameWithOwner =
        pullRequest.repositoryNameWithOwner ?? repositoryNameWithOwnerFromGitHubUrl(pullRequest.htmlUrl);

      items.push({
        id: `account-pull-${nameWithOwner ?? pullRequest.htmlUrl}-${pullRequest.number}`,
        title: pullRequest.title,
        subtitle: `${nameWithOwner ?? "GitHub pull request"} #${pullRequest.number} · ${pullRequest.headRefName} -> ${pullRequest.baseRefName}`,
        group: "Account work",
        icon: GitPullRequest,
        keywords: [
          pullRequest.title,
          nameWithOwner ?? "",
          pullRequest.htmlUrl,
          String(pullRequest.number),
          `#${pullRequest.number}`,
          pullRequest.state,
          pullRequest.isDraft ? "draft" : "ready",
          pullRequest.mergeableState ?? "",
          pullRequest.headRefName,
          pullRequest.baseRefName,
          pullRequest.headRepositoryNameWithOwner ?? "",
          pullRequest.baseRepositoryNameWithOwner ?? "",
          pullRequest.isCrossRepository === null
            ? ""
            : pullRequest.isCrossRepository
              ? "cross repository cross-repo fork source"
              : "same repository",
          pullRequest.authorLogin ?? "",
          pullRequest.locked ? "locked" : "",
          `${pullRequest.headRefName}->${pullRequest.baseRefName}`,
          `${pullRequest.headRefName} -> ${pullRequest.baseRefName}`,
          `${pullRequest.changedFiles} files`
        ],
        run: () => openPullRequestSummaryInApp(pullRequest)
      });
    }

    items.push({
      id: "command-settings",
      title: "Settings",
      subtitle: "Open Control settings",
      group: "Commands",
      icon: Settings,
      keywords: ["account", "oauth", "preferences"],
      run: () => setSettingsOpen(true)
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
      const currentRepositoryPinned = pinnedRepositoryNameSet.has(effectiveRepository.toLowerCase());
      const repositoryPinCommandDisabledReason = areaPinMutation.isPending
        ? "Repository pin update is already running."
        : null;
      const currentRepositoryBranches = branchItems.slice(0, commandPaletteGeneralSourceLimit);
      const currentRepositoryTags = tagItems.slice(0, commandPaletteGeneralSourceLimit);
      const [wikiOwner, wikiRepo] = effectiveRepository.split("/");
      const cachedWikiPagesByPath = new Map<string, WikiPageSummary | WikiPageContent>();
      if (wikiOwner && wikiRepo) {
        for (const [, wikiResult] of queryClient.getQueriesData<RepositoryWikiResult>({
          queryKey: ["repository-wiki", wikiOwner, wikiRepo]
        })) {
          if (!wikiResult) {
            continue;
          }
          for (const page of wikiResult.pages) {
            cachedWikiPagesByPath.set(page.path, page);
          }
          if (wikiResult.selectedPage) {
            cachedWikiPagesByPath.set(wikiResult.selectedPage.path, wikiResult.selectedPage);
          }
        }
      }
      if (branches.data) {
        for (const branch of currentRepositoryBranches) {
          items.push({
            id: `reference-branch-${effectiveRepository}-${branch.name}`,
            title: branch.name,
            subtitle: `${effectiveRepository} branch · ${branch.commitSha.slice(0, 7)}${branch.protected ? " · protected" : ""}`,
            group: "References",
            icon: GitBranch,
            keywords: [
              branch.name,
              "branch",
              effectiveRepository,
              branch.commitSha,
              branch.protected ? "protected" : ""
            ],
            run: () => selectRepositoryRefInApp(effectiveRepository, branch.name, "branch")
          });
        }
      }

      if (tags.data) {
        for (const tag of currentRepositoryTags) {
          items.push({
            id: `reference-tag-${effectiveRepository}-${tag.name}`,
            title: tag.name,
            subtitle: `${effectiveRepository} tag · ${tag.commitSha.slice(0, 7)}`,
            group: "References",
            icon: Tag,
            keywords: [tag.name, "tag", effectiveRepository, tag.commitSha],
            run: () => selectRepositoryRefInApp(effectiveRepository, tag.name, "tag")
          });
        }
      }

      for (const page of cachedWikiPagesByPath.values()) {
        items.push({
          id: `wiki-page-${effectiveRepository}-${page.path}`,
          title: page.title,
          subtitle: `${effectiveRepository} wiki · ${page.path}`,
          group: "Wiki pages",
          icon: BookOpen,
          keywords: [
            effectiveRepository,
            "wiki",
            "docs",
            "documentation",
            page.title,
            page.path,
            page.sha,
            page.htmlUrl ?? "",
            page.size === null ? "" : String(page.size)
          ],
          run: () => selectWikiPageInApp(effectiveRepository, page)
        });
      }

      if (discussions.data?.items) {
        for (const discussion of discussions.data.items.slice(0, commandPaletteGeneralSourceLimit)) {
          items.push({
            id: `repository-discussion-${effectiveRepository}-${discussion.number}`,
            title: `#${discussion.number} ${discussion.title}`,
            subtitle: `${effectiveRepository} discussion · ${discussion.category ?? "uncategorized"} · ${
              discussion.closed ? "closed" : "open"
            }`,
            group: "Repository items",
            icon: MessageSquare,
            keywords: [
              discussion.title,
              effectiveRepository,
              String(discussion.number),
              `#${discussion.number}`,
              "discussion",
              discussion.closed ? "closed" : "open",
              discussion.locked ? "locked" : "",
              discussion.isAnswered ? "answered" : "unanswered",
              discussion.category ?? "",
              discussion.authorLogin ?? "",
              `${discussion.comments} comments`,
              `${discussion.upvotes} upvotes`
            ],
            run: () => selectDiscussionInApp(effectiveRepository, discussion)
          });
        }
      }

      if (projects.data?.items) {
        for (const project of projects.data.items.slice(0, commandPaletteGeneralSourceLimit)) {
          items.push({
            id: `repository-project-${effectiveRepository}-${project.id}`,
            title: project.number ? `#${project.number} ${project.title}` : project.title,
            subtitle: `${effectiveRepository} project · ${project.closed ? "closed" : "open"}${
              project.ownerLogin ? ` · ${project.ownerLogin}` : ""
            }`,
            group: "Repository items",
            icon: SquareKanban,
            keywords: [
              project.title,
              effectiveRepository,
              project.id,
              project.number ? String(project.number) : "",
              project.number ? `#${project.number}` : "",
              "project",
              project.closed ? "closed" : "open",
              project.shortDescription ?? "",
              project.ownerLogin ?? "",
              project.ownerKind,
              project.isPublic === null ? "" : project.isPublic ? "public" : "private",
              project.itemsCount === null ? "" : `${project.itemsCount} items`,
              project.fieldsCount === null ? "" : `${project.fieldsCount} fields`
            ],
            run: () => selectProjectInApp(effectiveRepository, project)
          });
        }
      }

      if (contributorItems.length > 0) {
        for (const contributor of contributorItems.slice(0, commandPaletteDenseSourceLimit)) {
          const contributionCount = `${formatCompactNumber(contributor.contributions)} contributions`;
          items.push({
            id: `repository-contributor-${effectiveRepository}-${contributor.id}`,
            title: `@${contributor.login} in ${effectiveRepository}`,
            subtitle: `${contributionCount} · Opens in Control`,
            group: "Contributors",
            icon: Users,
            keywords: [
              contributor.login,
              "contributor",
              "contributors",
              "people",
              "author",
              "authors",
              effectiveRepository,
              String(contributor.contributions),
              contributionCount
            ],
            run: () => selectContributorInApp(effectiveRepository, contributor)
          });
        }
      }

      if (repositoryAccess.data?.collaborators) {
        for (const collaborator of repositoryAccess.data.collaborators.slice(
          0,
          commandPaletteDenseSourceLimit
        )) {
          const roleLabel = collaboratorRoleLabel(collaborator);
          items.push({
            id: `repository-settings-collaborator-${effectiveRepository}-${collaborator.id}`,
            title: `@${collaborator.login} in ${effectiveRepository}`,
            subtitle: `${roleLabel} collaborator · Opens repository settings in Control`,
            group: "Collaborators",
            icon: Users,
            keywords: [
              collaborator.login,
              "collaborator",
              "collaborators",
              "repository settings",
              "settings",
              "access",
              "permissions",
              roleLabel,
              collaborator.type ?? "",
              collaborator.siteAdmin ? "site admin" : "",
              effectiveRepository
            ],
            run: () => selectRepositorySettingsCollaboratorInApp(effectiveRepository, collaborator)
          });
        }
      }

      if (repositoryAccess.data?.teams) {
        for (const team of repositoryAccess.data.teams.slice(0, commandPaletteDenseSourceLimit)) {
          const permissionLabel = accessRoleLabel(team.permission);
          const memberCountLabel =
            team.memberCount !== null ? `${formatCompactNumber(team.memberCount)} members` : null;
          const parentTeamLabel = team.parent ? `Parent: ${team.parent.name}` : null;
          const subtitleParts = [
            `${team.organizationLogin}/${team.slug}`,
            effectiveRepository,
            permissionLabel,
            team.privacy,
            memberCountLabel,
            parentTeamLabel
          ].filter((part): part is string => Boolean(part));

          items.push({
            id: `repository-settings-team-${effectiveRepository}-${team.id}`,
            title: `${team.name} in ${effectiveRepository}`,
            subtitle: `${subtitleParts.join(" · ")} · Opens team in Control`,
            group: "Repository teams",
            icon: Users,
            keywords: [
              team.name,
              team.organizationLogin,
              team.slug,
              team.description ?? "",
              team.permission ?? "",
              permissionLabel,
              team.privacy ?? "",
              memberCountLabel ?? "",
              team.parent?.name ?? "",
              team.parent?.slug ?? "",
              parentTeamLabel ?? "",
              effectiveRepository,
              "team",
              "teams",
              "repository settings",
              "settings",
              "access",
              "permissions"
            ],
            run: () => {
              recordRecent(teamRecentInput(team));
              setSelectedOrganizationLogin(team.organizationLogin);
              setSelectedOrganizationTeamSlug(team.slug);
              setSelectedOrganizationMemberLogin(null);
              setSelectedOrganizationProjectId(null);
              goToOrganizations();
            }
          });
        }
      }

      if (repositoryForks.data?.items) {
        const currentRepositoryParent = repositoryDetail?.parent ?? null;
        const currentRepositorySource = repositoryDetail?.source ?? null;

        for (const fork of repositoryForks.data.items.slice(0, forksLimit)) {
          const metadataLabel = repositoryForkMetadataLabel(fork);
          const parentLabel = currentRepositoryParent?.nameWithOwner ?? null;
          const sourceLabel = currentRepositorySource?.nameWithOwner ?? null;
          const networkContext = [
            `Current: ${effectiveRepository}`,
            parentLabel ? `Parent: ${parentLabel}` : null,
            sourceLabel && sourceLabel !== parentLabel ? `Source: ${sourceLabel}` : null
          ].filter((part): part is string => Boolean(part));

          items.push({
            id: `repository-fork-${effectiveRepository}-${fork.id}`,
            title: fork.nameWithOwner,
            subtitle: `${metadataLabel} · ${networkContext.join(" · ")} · Opens in Control`,
            group: "Fork network",
            icon: GitFork,
            keywords: [
              fork.nameWithOwner,
              fork.owner,
              fork.name,
              metadataLabel,
              fork.visibility ?? "",
              fork.isPrivate === null ? "" : fork.isPrivate ? "private" : "public",
              fork.viewerPermission ?? "",
              fork.forkCount === null ? "" : `${formatCompactNumber(fork.forkCount)} forks`,
              fork.stargazerCount === null ? "" : `${formatCompactNumber(fork.stargazerCount)} stars`,
              fork.htmlUrl,
              fork.defaultBranch ?? "",
              effectiveRepository,
              parentLabel ?? "",
              sourceLabel ?? "",
              "fork",
              "forks",
              "fork network",
              "repository settings",
              "opens in control"
            ],
            run: () => openRepositoryInApp(fork.nameWithOwner)
          });
        }
      }

      if (releaseItems.length > 0) {
        for (const release of releaseItems.slice(0, commandPaletteGeneralSourceLimit)) {
          const releaseTitle = release.name || release.tagName;
          items.push({
            id: `repository-release-${effectiveRepository}-${release.id}`,
            title: releaseTitle,
            subtitle: `${effectiveRepository} release · ${release.tagName} · ${
              release.isDraft ? "draft" : "published"
            }${release.isPrerelease ? " · prerelease" : ""}`,
            group: "Repository items",
            icon: Tag,
            keywords: [
              releaseTitle,
              release.name ?? "",
              release.tagName,
              effectiveRepository,
              String(release.id),
              "release",
              "tag",
              release.isDraft ? "draft" : "published",
              release.isPrerelease ? "prerelease" : "",
              release.targetCommitish ?? "",
              release.publishedAt ?? "",
              ...release.assets.flatMap((asset) => [asset.name, asset.label ?? "", asset.state ?? ""])
            ],
            run: () => selectReleaseInApp(effectiveRepository, release)
          });
          for (const asset of release.assets) {
            items.push({
              id: `repository-release-asset-${effectiveRepository}-${release.id}-${asset.id}`,
              title: asset.name,
              subtitle: `${effectiveRepository} release asset · ${releaseTitle} · ${formatCompactNumber(
                asset.sizeInBytes
              )} bytes · ${formatCompactNumber(asset.downloadCount)} downloads`,
              group: "Release assets",
              icon: Download,
              keywords: [
                asset.name,
                asset.label ?? "",
                asset.contentType ?? "",
                asset.state ?? "",
                String(asset.id),
                releaseTitle,
                release.name ?? "",
                release.tagName,
                effectiveRepository,
                "release",
                "asset",
                "download"
              ],
              run: () => selectReleaseAssetInApp(effectiveRepository, release, asset)
            });
          }
        }
      }

      if (actionItems.length > 0) {
        for (const run of actionItems.slice(0, commandPaletteGeneralSourceLimit)) {
          const runState = run.conclusion ?? run.status ?? "queued";
          items.push({
            id: `repository-workflow-run-${effectiveRepository}-${run.id}`,
            title: run.displayTitle ?? run.name,
            subtitle: `${effectiveRepository} workflow run · ${runState} · ${run.event} · ${
              run.branch ?? "unknown branch"
            }`,
            group: "Repository items",
            icon: Workflow,
            keywords: [
              run.name,
              run.displayTitle ?? "",
              effectiveRepository,
              String(run.id),
              `run ${run.id}`,
              run.runNumber === null ? "" : String(run.runNumber),
              run.runAttempt === null ? "" : `attempt ${run.runAttempt}`,
              "workflow",
              "workflow run",
              "actions",
              run.event,
              run.status ?? "",
              run.conclusion ?? "",
              runState,
              run.branch ?? "",
              run.commitSha ?? "",
              run.headRepositoryNameWithOwner ?? "",
              run.actorLogin ?? "",
              run.triggeringActorLogin ?? "",
              run.conclusion === "failure" ? "failed failure" : "",
              run.conclusion === "success" ? "passed success" : "",
              run.status === "in_progress" ? "running in progress" : ""
            ],
            run: () => selectWorkflowRunInApp(effectiveRepository, run)
          });
        }

        const focusedWorkflowRunId =
          route.kind === "repository" && route.nameWithOwner === effectiveRepository
            ? (route.workflowRunId ?? null)
            : null;
        const focusedWorkflowRunDetailResult =
          focusedWorkflowRunId !== null
            ? queryClient.getQueryData<WorkflowRunDetailResult>([
                "action-detail",
                owner,
                repo,
                focusedWorkflowRunId
              ])
            : null;
        const focusedWorkflowRunDetail = focusedWorkflowRunDetailResult?.detail ?? null;
        if (focusedWorkflowRunDetail) {
          for (const artifact of focusedWorkflowRunDetail.artifacts) {
            items.push({
              id: `repository-workflow-artifact-${effectiveRepository}-${focusedWorkflowRunDetail.id}-${artifact.id}`,
              title: artifact.name,
              subtitle: `${effectiveRepository} workflow artifact · ${
                focusedWorkflowRunDetail.displayTitle ?? focusedWorkflowRunDetail.name
              } · ${formatCompactNumber(artifact.sizeInBytes)} bytes · ${
                artifact.expired ? "expired" : "available"
              }`,
              group: "Workflow artifacts",
              icon: Download,
              keywords: [
                artifact.name,
                String(artifact.id),
                focusedWorkflowRunDetail.name,
                focusedWorkflowRunDetail.displayTitle ?? "",
                effectiveRepository,
                String(focusedWorkflowRunDetail.id),
                `run ${focusedWorkflowRunDetail.id}`,
                focusedWorkflowRunDetail.runNumber === null ? "" : String(focusedWorkflowRunDetail.runNumber),
                focusedWorkflowRunDetail.runAttempt === null
                  ? ""
                  : `attempt ${focusedWorkflowRunDetail.runAttempt}`,
                "workflow",
                "workflow artifact",
                "artifact",
                "download",
                "actions",
                focusedWorkflowRunDetail.event,
                focusedWorkflowRunDetail.status ?? "",
                focusedWorkflowRunDetail.conclusion ?? "",
                focusedWorkflowRunDetail.branch ?? "",
                artifact.expired ? "expired" : "available",
                artifact.createdAt,
                artifact.updatedAt,
                artifact.expiresAt ?? ""
              ],
              run: () => selectWorkflowArtifactInApp(effectiveRepository, focusedWorkflowRunDetail, artifact)
            });
          }
        }
      }

      if (dependabotAlerts.data?.items) {
        for (const alert of dependabotAlerts.data.items.slice(0, commandPaletteSecuritySourceLimit)) {
          items.push({
            id: `security-dependabot-${effectiveRepository}-${alert.number}`,
            title: alert.packageName ?? `Dependabot alert #${alert.number}`,
            subtitle: `${effectiveRepository} Dependabot alert #${alert.number} · ${alert.severity ?? alert.state}${
              alert.manifestPath ? ` · ${alert.manifestPath}` : ""
            }`,
            group: "Security and quality",
            icon: ShieldCheck,
            keywords: [
              effectiveRepository,
              "security",
              "quality",
              "dependabot",
              "dependency alert",
              "alert",
              String(alert.number),
              `#${alert.number}`,
              alert.state,
              alert.severity ?? "",
              alert.packageName ?? "",
              alert.ecosystem ?? "",
              alert.manifestPath ?? "",
              alert.scope ?? "",
              alert.summary ?? ""
            ],
            run: () =>
              selectSecurityItemInApp(effectiveRepository, {
                kind: "dependabot",
                id: String(alert.number),
                title: alert.packageName ?? `Dependabot alert #${alert.number}`,
                subtitle: `${effectiveRepository} Dependabot alert #${alert.number}`,
                url: alert.htmlUrl,
                state: alert.state,
                severity: alert.severity,
                path: alert.manifestPath,
                packageName: alert.packageName,
                updatedAt: alert.updatedAt
              })
          });
        }
      }

      if (codeScanningAlerts.data?.items) {
        for (const alert of codeScanningAlerts.data.items.slice(0, commandPaletteSecuritySourceLimit)) {
          const title = alert.ruleName ?? alert.ruleId ?? `Code scanning alert #${alert.number}`;
          items.push({
            id: `security-code-scanning-${effectiveRepository}-${alert.number}`,
            title,
            subtitle: `${effectiveRepository} code scanning #${alert.number} · ${alert.severity ?? alert.state}${
              alert.path ? ` · ${alert.path}${alert.startLine ? `:${alert.startLine}` : ""}` : ""
            }`,
            group: "Security and quality",
            icon: Code2,
            keywords: [
              effectiveRepository,
              "security",
              "quality",
              "code scanning",
              "codeql",
              "static analysis",
              "alert",
              String(alert.number),
              `#${alert.number}`,
              alert.state,
              alert.severity ?? "",
              alert.ruleId ?? "",
              alert.ruleName ?? "",
              alert.ruleDescription ?? "",
              alert.toolName ?? "",
              alert.message ?? "",
              alert.path ?? "",
              alert.startLine ? String(alert.startLine) : "",
              alert.ref ?? ""
            ],
            run: () =>
              selectSecurityItemInApp(effectiveRepository, {
                kind: "codeScanning",
                id: String(alert.number),
                title,
                subtitle: `${effectiveRepository} code scanning alert #${alert.number}`,
                url: alert.htmlUrl,
                state: alert.state,
                severity: alert.severity,
                path: alert.path,
                rule: alert.ruleName ?? alert.ruleId,
                updatedAt: alert.updatedAt
              })
          });
        }
      }

      if (secretScanningAlerts.data?.items) {
        for (const alert of secretScanningAlerts.data.items.slice(0, commandPaletteSecuritySourceLimit)) {
          const title =
            alert.secretTypeDisplayName ?? alert.secretType ?? `Secret scanning alert #${alert.number}`;
          items.push({
            id: `security-secret-scanning-${effectiveRepository}-${alert.number}`,
            title,
            subtitle: `${effectiveRepository} secret scanning #${alert.number} · ${alert.validity ?? alert.state}${
              alert.firstLocationPath ? ` · ${alert.firstLocationPath}` : ""
            }`,
            group: "Security and quality",
            icon: Lock,
            keywords: [
              effectiveRepository,
              "security",
              "quality",
              "secret scanning",
              "secret alert",
              "alert",
              String(alert.number),
              `#${alert.number}`,
              alert.state,
              alert.secretType ?? "",
              alert.secretTypeDisplayName ?? "",
              alert.resolution ?? "",
              alert.validity ?? "",
              alert.publiclyLeaked ? "publicly leaked" : "",
              alert.multiRepo ? "multi repo multi-repo" : "",
              alert.pushProtectionBypassed ? "push protection bypassed" : "",
              alert.firstLocationPath ?? "",
              alert.firstLocationStartLine ? String(alert.firstLocationStartLine) : ""
            ],
            run: () =>
              selectSecurityItemInApp(effectiveRepository, {
                kind: "secretScanning",
                id: String(alert.number),
                title,
                subtitle: `${effectiveRepository} secret scanning alert #${alert.number}`,
                url: alert.htmlUrl,
                state: alert.state,
                severity: alert.validity,
                path: alert.firstLocationPath,
                rule: alert.secretTypeDisplayName ?? alert.secretType,
                updatedAt: alert.updatedAt
              })
          });
        }
      }

      if (repositoryRulesets.data?.items) {
        for (const ruleset of repositoryRulesets.data.items.slice(0, commandPaletteSecuritySourceLimit)) {
          items.push({
            id: `security-ruleset-${effectiveRepository}-${ruleset.id}`,
            title: ruleset.name,
            subtitle: `${effectiveRepository} ruleset · ${ruleset.enforcement ?? "unknown enforcement"} · ${
              ruleset.target ?? "unknown target"
            }`,
            group: "Security and quality",
            icon: CircleDot,
            keywords: [
              effectiveRepository,
              "security",
              "quality",
              "ruleset",
              "repository ruleset",
              "branch protection",
              String(ruleset.id),
              ruleset.nodeId ?? "",
              ruleset.name,
              ruleset.target ?? "",
              ruleset.enforcement ?? "",
              ruleset.sourceType ?? "",
              ruleset.source ?? "",
              ruleset.currentUserCanBypass ?? "",
              ruleset.ruleCount === null ? "" : `${ruleset.ruleCount} rules`,
              ruleset.conditionCount === null ? "" : `${ruleset.conditionCount} conditions`,
              ruleset.bypassActorCount === null ? "" : `${ruleset.bypassActorCount} bypass actors`,
              ...ruleset.rules.flatMap((rule) => [rule.type, ...rule.parameters]),
              ...ruleset.conditions.flatMap((condition) => [
                condition.type,
                ...condition.include,
                ...condition.exclude,
                ...condition.parameters
              ]),
              ...ruleset.bypassActors.flatMap((actor) => [
                actor.actorType ?? "",
                actor.actorId === null ? "" : String(actor.actorId),
                actor.bypassMode ?? ""
              ])
            ],
            run: () =>
              selectSecurityItemInApp(effectiveRepository, {
                kind: "ruleset",
                id: String(ruleset.id),
                title: ruleset.name,
                subtitle: `${effectiveRepository} ruleset`,
                url: ruleset.htmlUrl,
                state: ruleset.enforcement,
                rule: ruleset.name,
                updatedAt: ruleset.updatedAt
              })
          });
        }
      }

      if (repositorySecurityAdvisories.data?.items) {
        for (const advisory of repositorySecurityAdvisories.data.items.slice(
          0,
          commandPaletteSecuritySourceLimit
        )) {
          items.push({
            id: `security-advisory-${effectiveRepository}-${advisory.ghsaId}`,
            title: advisory.summary,
            subtitle: `${effectiveRepository} advisory · ${advisory.ghsaId} · ${advisory.severity ?? advisory.state}`,
            group: "Security and quality",
            icon: ShieldCheck,
            keywords: [
              effectiveRepository,
              "security",
              "quality",
              "security advisory",
              "advisory",
              "vulnerability",
              advisory.ghsaId,
              advisory.cveId ?? "",
              advisory.state,
              advisory.severity ?? "",
              advisory.summary,
              advisory.description ?? "",
              advisory.cvssScore === null ? "" : `cvss ${advisory.cvssScore}`,
              advisory.cvssVector ?? "",
              ...advisory.cweIds
            ],
            run: () =>
              selectSecurityItemInApp(effectiveRepository, {
                kind: "advisory",
                id: advisory.ghsaId,
                title: advisory.summary,
                subtitle: `${effectiveRepository} advisory · ${advisory.ghsaId}`,
                url: advisory.htmlUrl,
                state: advisory.state,
                severity: advisory.severity,
                ghsaId: advisory.ghsaId,
                cveId: advisory.cveId,
                updatedAt: advisory.updatedAt
              })
          });
        }
      }

      items.push(
        {
          id: "command-current-repository",
          title: `Open ${effectiveRepository}`,
          subtitle: "Jump to the current repository",
          group: "Commands",
          icon: Code2,
          keywords: ["current", "repo"],
          run: () => openRepositoryInApp(effectiveRepository)
        },
        {
          id: "command-current-toggle-pin",
          title: `${currentRepositoryPinned ? "Unpin" : "Pin"} ${effectiveRepository}`,
          subtitle: `${currentRepositoryPinned ? "Remove from" : "Add to"} local pinned repositories`,
          group: "Commands",
          icon: Pin,
          keywords: ["pin", "unpin", "pinned", "favorite", "local", effectiveRepository],
          disabledReason: repositoryPinCommandDisabledReason,
          run: () => toggleRepositoryPin(effectiveRepository)
        },
        {
          id: "command-current-refresh",
          title: `Refresh ${effectiveRepository}`,
          subtitle: githubReady ? "Refresh the current repository surface" : "Reload cached repository data",
          group: "Commands",
          icon: RefreshCw,
          keywords: ["refresh", "reload", "stale", "sync", effectiveRepository],
          disabledReason: repositoryRefreshDisabledReason,
          run: () => {
            void refreshRepositorySurface();
          }
        },
        {
          id: "command-current-issues",
          title: `Issues in ${effectiveRepository}`,
          subtitle: "Open the repository issues tab",
          group: "Commands",
          icon: CircleDot,
          keywords: ["issues", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "issues")
        },
        {
          id: "command-current-go-to-file",
          title: `Go to file in ${effectiveRepository}`,
          subtitle: "Open the in-app repository file finder",
          group: "Commands",
          icon: Search,
          keywords: ["file finder", "go to file", "jump file", "tree", effectiveRepository],
          run: () => {
            openRepositoryRouteInApp({
              kind: "repository",
              nameWithOwner: effectiveRepository,
              tab: "code"
            });
            setFileFinderOpen(true);
          }
        },
        {
          id: "command-current-create-issue",
          title: `Create issue in ${effectiveRepository}`,
          subtitle: "Open the in-app issue composer",
          group: "Commands",
          icon: Plus,
          keywords: ["new issue", "create issue", "issue composer", effectiveRepository],
          disabledReason: repositoryCommandDisabledReason,
          run: () =>
            openRepositoryRouteInApp({
              kind: "repository",
              nameWithOwner: effectiveRepository,
              tab: "issues",
              issueComposer: "create"
            })
        },
        {
          id: "command-current-pulls",
          title: `Pull requests in ${effectiveRepository}`,
          subtitle: "Open the repository pull requests tab",
          group: "Commands",
          icon: GitPullRequest,
          keywords: ["pulls", "prs", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "pulls")
        },
        {
          id: "command-current-create-pull",
          title: `Create pull request in ${effectiveRepository}`,
          subtitle: "Open the in-app pull request composer",
          group: "Commands",
          icon: GitPullRequest,
          keywords: [
            "new pull request",
            "create pr",
            "create pull",
            "pull request composer",
            effectiveRepository
          ],
          disabledReason: repositoryCommandDisabledReason,
          run: () =>
            openRepositoryRouteInApp({
              kind: "repository",
              nameWithOwner: effectiveRepository,
              tab: "pulls",
              pullComposer: "create"
            })
        },
        {
          id: "command-current-discussions",
          title: `Discussions in ${effectiveRepository}`,
          subtitle: "Open the repository discussions tab",
          group: "Commands",
          icon: MessageSquare,
          keywords: ["discussions", "community", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "discussions")
        },
        {
          id: "command-current-contributors",
          title: `Contributors in ${effectiveRepository}`,
          subtitle: "Open the repository contributors tab",
          group: "Commands",
          icon: Users,
          keywords: ["contributors", "people", "authors", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "contributors")
        },
        {
          id: "command-current-agents",
          title: `Agents in ${effectiveRepository}`,
          subtitle: "Open in-app agent triage",
          group: "Commands",
          icon: Bot,
          keywords: ["agents", "agent issues", "automation", "triage", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "agents")
        },
        {
          id: "command-current-projects",
          title: `Projects in ${effectiveRepository}`,
          subtitle: "Open the repository projects tab",
          group: "Commands",
          icon: SquareKanban,
          keywords: ["projects", "planning", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "projects")
        },
        {
          id: "command-current-releases",
          title: `Releases in ${effectiveRepository}`,
          subtitle: "Open the repository releases tab",
          group: "Commands",
          icon: Tag,
          keywords: ["releases", "tags", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "releases")
        },
        {
          id: "command-current-create-release",
          title: `Create release in ${effectiveRepository}`,
          subtitle: "Open the in-app release composer",
          group: "Commands",
          icon: Tag,
          keywords: ["new release", "create release", "release composer", "tag", effectiveRepository],
          disabledReason: repositoryCommandDisabledReason,
          run: () =>
            openRepositoryRouteInApp({
              kind: "repository",
              nameWithOwner: effectiveRepository,
              tab: "releases",
              releaseComposer: "create"
            })
        },
        {
          id: "command-current-actions",
          title: `Actions in ${effectiveRepository}`,
          subtitle: "Open repository workflow runs",
          group: "Commands",
          icon: Workflow,
          keywords: ["actions", "workflow runs", "ci", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "actions")
        },
        {
          id: "command-current-run-workflow",
          title: `Run workflow in ${effectiveRepository}`,
          subtitle: "Open the in-app workflow dispatch form",
          group: "Commands",
          icon: Workflow,
          keywords: ["actions", "workflow", "dispatch", "run workflow", effectiveRepository],
          disabledReason: repositoryCommandDisabledReason,
          run: () =>
            openRepositoryRouteInApp({
              kind: "repository",
              nameWithOwner: effectiveRepository,
              tab: "actions",
              workflowComposer: "dispatch"
            })
        },
        {
          id: "command-current-wiki",
          title: `Wiki in ${effectiveRepository}`,
          subtitle: "Open repository wiki availability",
          group: "Commands",
          icon: BookOpen,
          keywords: ["wiki", "docs", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "wiki")
        },
        {
          id: "command-current-security-quality",
          title: `Security and Quality in ${effectiveRepository}`,
          subtitle: "Open alerts, scanning, and branch protection",
          group: "Commands",
          icon: Gauge,
          keywords: [
            "security",
            "quality",
            "security quality",
            "alerts",
            "branch protection",
            effectiveRepository
          ],
          run: () => openRepositoryInApp(effectiveRepository, "securityQuality")
        },
        {
          id: "command-current-settings",
          title: `Repository settings in ${effectiveRepository}`,
          subtitle: "Open in-app repository settings",
          group: "Commands",
          icon: Settings,
          keywords: ["repository settings", "admin", "features", "permissions", effectiveRepository],
          run: () => openRepositoryInApp(effectiveRepository, "settings")
        },
        {
          id: "command-current-open-github",
          title: `Open ${effectiveRepository} on GitHub`,
          subtitle: "Use the external GitHub fallback",
          group: "External",
          icon: ExternalLink,
          keywords: ["github.com", "external", "external fallback", "open in browser", effectiveRepository],
          run: () => void api.openExternal(`https://github.com/${effectiveRepository}`)
        }
      );
    }

    for (const repositoryShortcut of repositoryShortcutsFromPins(pinnedRepositoryNames, repositoryItems)) {
      items.push({
        id: `pinned-${repositoryShortcut.nameWithOwner}`,
        title: displayRepositoryShortcutName(repositoryShortcut, appState.data?.viewer?.login ?? null),
        subtitle: repositoryShortcut.description ?? repositoryShortcut.nameWithOwner,
        group: "Pinned",
        icon: Pin,
        keywords: [
          repositoryShortcut.nameWithOwner,
          repositoryShortcut.owner,
          repositoryShortcut.name,
          repositoryShortcut.primaryLanguage?.name ?? ""
        ],
        run: () => openRepositoryInApp(repositoryShortcut.nameWithOwner)
      });
    }

    for (const recent of recentItems.data ?? []) {
      items.push({
        id: `recent-${recent.kind}-${recent.itemKey}`,
        title: recent.title,
        subtitle: recent.subtitle ?? recent.repositoryNameWithOwner ?? "Recent GitHub item",
        group: "Recents",
        icon:
          recent.kind === "file"
            ? FileIcon
            : recent.kind === "commit"
              ? GitBranch
              : recent.kind === "issue"
                ? CircleDot
                : recent.kind === "pullRequest"
                  ? GitPullRequest
                  : recent.kind === "discussion"
                    ? MessageSquare
                    : recent.kind === "organization"
                      ? Building2
                      : recent.kind === "team"
                        ? Users
                        : recent.kind === "contributor"
                          ? Users
                          : recent.kind === "project"
                            ? SquareKanban
                            : recent.kind === "release"
                              ? Tag
                              : recent.kind === "releaseAsset"
                                ? Download
                                : recent.kind === "workflowRun"
                                  ? Workflow
                                  : recent.kind === "workflowArtifact"
                                    ? Download
                                    : recent.kind === "securityItem"
                                      ? ShieldCheck
                                      : recent.kind === "wikiPage"
                                        ? BookOpen
                                        : Code2,
        keywords: [
          recent.itemKey,
          recent.repositoryNameWithOwner ?? "",
          recent.kind,
          recentMetadataString(recent, "path") ?? "",
          recentMetadataKeyword(recent, "ref"),
          recentMetadataKeyword(recent, "branch"),
          recentMetadataKeyword(recent, "headRefName"),
          recentMetadataKeyword(recent, "baseRefName"),
          recentMetadataKeyword(recent, "headRepositoryNameWithOwner"),
          recentMetadataKeyword(recent, "baseRepositoryNameWithOwner"),
          recentMetadataKeyword(recent, "tagName"),
          recentMetadataKeyword(recent, "releaseTitle"),
          recentMetadataKeyword(recent, "assetId"),
          recentMetadataKeyword(recent, "assetName"),
          recentMetadataKeyword(recent, "artifactId"),
          recentMetadataKeyword(recent, "artifactName"),
          recentMetadataKeyword(recent, "securityItemKind"),
          recentMetadataKeyword(recent, "securityItemId"),
          recentMetadataKeyword(recent, "title"),
          recentMetadataKeyword(recent, "sha"),
          recentMetadataKeyword(recent, "htmlUrl"),
          recentMetadataKeyword(recent, "severity"),
          recentMetadataKeyword(recent, "rule"),
          recentMetadataKeyword(recent, "packageName"),
          recentMetadataKeyword(recent, "ghsaId"),
          recentMetadataKeyword(recent, "cveId"),
          recentMetadataKeyword(recent, "contentType"),
          recentMetadataKeyword(recent, "state"),
          recentMetadataKeyword(recent, "runId"),
          recentMetadataKeyword(recent, "runName"),
          recentMetadataKeyword(recent, "runTitle"),
          recentMetadataKeyword(recent, "runNumber"),
          recentMetadataKeyword(recent, "runAttempt"),
          recentMetadataKeyword(recent, "event"),
          recentMetadataKeyword(recent, "conclusion"),
          recentMetadataKeyword(recent, "status"),
          recentMetadataKeyword(recent, "reason"),
          recentMetadataKeyword(recent, "subjectType"),
          recentMetadataKeyword(recent, "login"),
          recentMetadataKeyword(recent, "id"),
          recentMetadataKeyword(recent, "contributions"),
          recentMetadataKeyword(recent, "avatarUrl"),
          recentMetadataKeyword(recent, "organizationLogin"),
          recentMetadataKeyword(recent, "slug"),
          recentMetadataKeyword(recent, "membershipRole"),
          recentMetadataKeyword(recent, "membershipState"),
          recentMetadataKeyword(recent, "privacy"),
          recentMetadataKeyword(recent, "permission"),
          recentMetadataKeyword(recent, "projectId"),
          recentMetadataKeyword(recent, "number"),
          recentMetadataKeyword(recent, "title"),
          recentMetadataKeyword(recent, "ownerLogin"),
          recentMetadataKeyword(recent, "ownerKind"),
          recentMetadataBooleanKeyword(recent, "closed"),
          recentMetadataBooleanKeyword(recent, "isPublic"),
          recentMetadataBooleanKeyword(recent, "unread")
        ],
        run: () => openRecentItem(recent)
      });
    }

    for (const repositorySummary of repositoryItems) {
      items.push({
        id: `repository-${repositorySummary.nameWithOwner}`,
        title: displayRepositoryName(repositorySummary, appState.data?.viewer?.login ?? null),
        subtitle: repositorySummary.description ?? repositorySummary.nameWithOwner,
        group: "Repositories",
        icon: Code2,
        keywords: [
          repositorySummary.nameWithOwner,
          repositorySummary.owner,
          repositorySummary.name,
          repositorySummary.primaryLanguage?.name ?? ""
        ],
        run: () => openRepositoryInApp(repositorySummary.nameWithOwner)
      });
    }

    return items;
  })();

  useEffect(() => {
    function handleCommandPaletteShortcut(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }

    window.addEventListener("keydown", handleCommandPaletteShortcut);
    return () => window.removeEventListener("keydown", handleCommandPaletteShortcut);
  }, []);

  const shellClass = [
    "app-shell",
    appState.data?.settings.glassMode === "solid" ? "solid-shell" : null,
    appState.data?.settings.glassMode === "reduced" ? "reduced-glass" : null
  ]
    .filter(Boolean)
    .join(" ");
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
        openCommitInApp({
          nameWithOwner: effectiveRepository,
          commit,
          path: "",
          entryType: "dir"
        })
      }
      onOpenReleasesTab={() => selectRepositoryTabInApp(effectiveRepository, "releases")}
      onOpenContributorsTab={() => selectRepositoryTabInApp(effectiveRepository, "contributors")}
      onOpenSettingsTab={() => selectRepositoryTabInApp(effectiveRepository, "settings")}
      onOpenRelease={(release) => selectReleaseInApp(effectiveRepository, release)}
      onOpenContributor={(contributor) => selectContributorInApp(effectiveRepository, contributor)}
      onOpenExternal={(url) => void api.openExternal(url)}
    />
  ) : null;
  const withRepositoryContext = useCallback(
    (node: JSX.Element): JSX.Element =>
      repositoryContextValue ? (
        <RepositoryContextProvider value={repositoryContextValue}>{node}</RepositoryContextProvider>
      ) : (
        node
      ),
    [repositoryContextValue]
  );

  return (
    <MarkdownUrlHandlerContext.Provider value={openMarkdownUrl}>
      <AppEventBridge
        onGitHubRepositoryUpdated={handleGitHubRepositoryUpdated}
        onGitHubAuthUpdated={handleGitHubAuthUpdated}
      />
      <div className={shellClass}>
        <Sidebar
          appState={appState.data}
          profile={accountProfileData ?? undefined}
          areas={areaItems}
          selectedAreaId={selectedArea?.id ?? null}
          localRepositories={localRepositoryItems}
          localRepositoriesLoading={selectedAreaRepositories.isLoading || selectedAreaRepositories.isFetching}
          repositories={repositoryItems}
          repositoriesLoading={repositories.isLoading || repositories.isFetching}
          repositoriesError={repositories.error}
          repositoriesAvailabilityMessage={repositoriesAvailabilityMessage}
          pinnedRepositoryNames={pinnedRepositoryNames}
          repositoryPinRecords={repositoryPinRecords}
          selectedRepository={effectiveRepository}
          route={route}
          onSelectLocalRepository={openLocalRepositoryInApp}
          onSelectRepository={openRepositoryInApp}
          onOpenRepositorySearch={() => setCommandPaletteOpen(true)}
          onOpenAddRepository={() => setAddRepositoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <TopBar
          viewer={appState.data?.viewer ?? null}
          route={route}
          areas={areaItems}
          selectedAreaId={selectedArea?.id ?? null}
          selectedRepository={selectedRepository}
          repositories={repositoryItems}
          githubReady={githubReady}
          onSelectArea={(areaId) => void selectArea(areaId)}
          onAddLocalArea={() => void addLocalArea()}
          onAddSshArea={() => setSshAreaOpen(true)}
          onEditArea={(area) => setEditingArea(area)}
          onDeleteArea={(area) => setDeletingArea(area)}
          onGoRepository={() => {
            if (effectiveRepository) {
              openRepositoryInApp(effectiveRepository);
            }
          }}
          onOpenRepository={openRepositoryInApp}
          onOpenLocalRepository={openLocalRepositoryInApp}
          onOpenAddRepository={() => setAddRepositoryOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenHome={goHome}
          onOpenMailbox={goToMailbox}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <section
          className={
            isRepositoryRoute || isLocalRepositoryRoute
              ? "workspace workspace-repository"
              : "workspace workspace-wide"
          }
        >
          {!appState.data?.github.authenticated && <SetupPanel appState={appState.data} />}

          <main
            className={
              isRepositoryRoute || isLocalRepositoryRoute
                ? "content-scroll repository-content-scroll"
                : "content-scroll"
            }
          >
            {route.kind === "home" && selectedArea && isGatewayAreaKind(selectedArea.kind) ? (
              <LocalAreaHome
                area={selectedArea}
                repositories={localRepositoryItems}
                repositoriesLoading={
                  selectedAreaRepositories.isLoading || selectedAreaRepositories.isFetching
                }
                recentItems={recentItems.data ?? []}
                onOpenRepository={openLocalRepositoryInApp}
                onOpenRecent={openRecentItem}
                onRefresh={async () => {
                  await api.areas.refreshArea(selectedArea.id);
                  await queryClient.invalidateQueries({ queryKey: ["areas"] });
                  await queryClient.invalidateQueries({ queryKey: ["area-repositories", selectedArea.id] });
                }}
                onStopGateway={async () => {
                  await api.areas.stopGateway({ areaId: selectedArea.id });
                  await queryClient.invalidateQueries({ queryKey: ["areas"] });
                }}
              />
            ) : route.kind === "home" ? (
              <HomeDashboard
                appState={appState.data}
                profile={accountProfileData ?? undefined}
                profileAvailabilityMessage={accountProfileAvailabilityMessage}
                repositories={repositoryItems}
                repositoryActivityLimit={homeRepositoryActivityLimit}
                repositoriesLoading={repositories.isLoading || repositories.isFetching}
                repositoriesError={repositories.error}
                repositoriesAvailabilityMessage={repositoriesAvailabilityMessage}
                pinnedRepositoryNames={pinnedRepositoryNames}
                issues={accountIssueItems}
                issuesLoading={accountIssues.isLoading || accountIssues.isFetching}
                issuesError={accountIssues.error}
                issuesAvailability={accountIssuesAvailability}
                pulls={accountPullItems}
                pullsLoading={accountPulls.isLoading || accountPulls.isFetching}
                pullsError={accountPulls.error}
                pullsAvailability={accountPullsAvailability}
                workLimit={homeWorkLimit}
                maxWorkLimit={defaultMailboxListLimit}
                onOpenRepository={openRepositoryInApp}
                onLoadMoreRepositories={loadMoreHomeRepositoryActivity}
                onLoadMoreWork={loadMoreHomeWork}
                onOpenMailbox={goToMailbox}
                onOpenIssue={openIssueSummaryInApp}
                onOpenPullRequest={openPullRequestSummaryInApp}
                onOpenExternal={(url) => void api.openExternal(url)}
              />
            ) : null}

            {route.kind === "localRepository" && (
              <LocalRepositoryPage
                route={route}
                activeTab={activeLocalRepositoryTab}
                activePath={activeLocalRepositoryPath}
                onSelectTab={(tab) =>
                  goToLocalRepository(
                    route.areaId,
                    route.repositoryId,
                    tab,
                    route.workspaceId ?? null,
                    route.path ?? null
                  )
                }
                onOpenPath={(entry) =>
                  goToLocalRepository(
                    route.areaId,
                    route.repositoryId,
                    "code",
                    route.workspaceId ?? null,
                    entry.path
                  )
                }
                pinned={areaRepositoryPinSet.has(
                  areaRepositoryPinKey(route.areaId, route.repositoryId, route.workspaceId ?? null)
                )}
                pinBusy={areaPinMutation.isPending}
                onTogglePin={toggleAreaRepositoryPin}
                onOpenGitHub={(nameWithOwner) => openRepositoryInApp(nameWithOwner)}
                onOpenExternal={(url) => void api.openExternal(url)}
              />
            )}

            {route.kind === "repository" &&
              withRepositoryContext(
                <RepositoryPage
                  key={effectiveRepository}
                  repository={repositoryDetail ?? undefined}
                  availabilityMessage={repositoryAvailabilityMessage}
                  githubReady={githubReady}
                  selectedRef={contentsRef}
                  branches={branchItems}
                  tags={tagItems}
                  refListLimit={repositoryRefListLimit}
                  refsLoading={branches.isLoading || branches.isFetching || tags.isLoading || tags.isFetching}
                  refsError={refsError}
                  refsAvailabilityMessage={refsAvailabilityMessage || null}
                  branchesError={branches.error}
                  contents={contentItems}
                  contentsLoading={contents.isLoading || contents.isFetching}
                  contentsError={contents.error}
                  contentsAvailability={contentsAvailability}
                  readmeMarkdown={readme.data?.markdown ?? repositoryDetail?.readmeMarkdown ?? null}
                  readmeAvailability={readme.data?.availability ?? null}
                  readmeLoading={readme.isLoading || readme.isFetching}
                  readmeError={readme.error}
                  rootMarkdownItems={rootMarkdownItems}
                  selectedRootMarkdownPath={effectiveSelectedRootMarkdownPath}
                  rootMarkdownContent={rootMarkdownContent.data ?? null}
                  rootMarkdownLoading={rootMarkdownContent.isLoading || rootMarkdownContent.isFetching}
                  rootMarkdownError={rootMarkdownContent.error}
                  issues={issueItems}
                  issueListLimit={issueListLimit}
                  issuesLoading={issues.isLoading || issues.isFetching}
                  issuesError={issues.error}
                  issuesAvailability={issuesAvailability}
                  labels={labelItems}
                  labelsLoading={labels.isLoading || labels.isFetching}
                  labelsError={labels.error}
                  labelsAvailability={labelAvailability}
                  assignableUsers={assignableUserItems}
                  assignableUsersLoading={assignableUsers.isLoading || assignableUsers.isFetching}
                  assignableUsersError={assignableUsers.error}
                  assignableUsersAvailability={assignableUsersAvailability}
                  milestones={milestoneItems}
                  milestonesLoading={milestones.isLoading || milestones.isFetching}
                  milestonesError={milestones.error}
                  milestonesAvailability={milestonesAvailability}
                  repositoryAccess={repositoryAccess.data ?? null}
                  repositoryAccessLimit={repositoryAccessLimit}
                  repositoryAccessLoading={repositoryAccess.isLoading || repositoryAccess.isFetching}
                  repositoryAccessError={repositoryAccess.error}
                  repositoryForks={repositoryForks.data ?? null}
                  forksLimit={forksLimit}
                  repositoryForksLoading={repositoryForks.isLoading || repositoryForks.isFetching}
                  repositoryForksError={repositoryForks.error}
                  pulls={pullItems}
                  pullRequestListLimit={pullRequestListLimit}
                  pullsLoading={pulls.isLoading || pulls.isFetching}
                  pullsError={pulls.error}
                  pullsAvailability={pullsAvailability}
                  discussions={discussions.data?.items ?? []}
                  discussionsLimit={discussionsLimit}
                  discussionsLoading={discussions.isLoading || discussions.isFetching}
                  discussionsAvailability={discussions.data?.availability ?? null}
                  discussionsError={discussions.error}
                  actions={actionItems}
                  actionsLimit={actionsLimit}
                  workflowDefinitionLimit={workflowDefinitionLimit}
                  actionsLoading={actions.isLoading || actions.isFetching}
                  actionsAvailability={actionsAvailability}
                  actionsError={actions.error}
                  projects={projects.data?.items ?? []}
                  projectsLimit={projectsLimit}
                  projectsLoading={projects.isLoading || projects.isFetching}
                  projectsAvailability={projects.data?.availability ?? null}
                  projectsError={projects.error}
                  branchProtectionBranch={branchProtectionBranch}
                  branchProtectionBranches={branchItems}
                  branchProtectionBranchesLoading={branches.isLoading || branches.isFetching}
                  branchProtectionBranchesError={branches.error}
                  branchProtection={branchProtection.data ?? null}
                  branchProtectionLoading={branchProtection.isLoading || branchProtection.isFetching}
                  branchProtectionError={branchProtection.error}
                  dependabotAlerts={dependabotAlerts.data?.items ?? []}
                  dependabotAlertsLimit={dependabotAlertsLimit}
                  dependabotAlertsLoading={dependabotAlerts.isLoading || dependabotAlerts.isFetching}
                  dependabotAlertsAvailability={dependabotAlerts.data?.availability ?? null}
                  dependabotAlertsError={dependabotAlerts.error}
                  codeScanningAlerts={codeScanningAlerts.data?.items ?? []}
                  codeScanningAlertsLimit={codeScanningAlertsLimit}
                  codeScanningAlertsLoading={codeScanningAlerts.isLoading || codeScanningAlerts.isFetching}
                  codeScanningAlertsAvailability={codeScanningAlerts.data?.availability ?? null}
                  codeScanningAlertsError={codeScanningAlerts.error}
                  secretScanningAlerts={secretScanningAlerts.data?.items ?? []}
                  secretScanningAlertsLimit={secretScanningAlertsLimit}
                  secretScanningAlertsLoading={
                    secretScanningAlerts.isLoading || secretScanningAlerts.isFetching
                  }
                  secretScanningAlertsAvailability={secretScanningAlerts.data?.availability ?? null}
                  secretScanningAlertsError={secretScanningAlerts.error}
                  repositoryRulesets={repositoryRulesets.data?.items ?? []}
                  repositoryRulesetsLimit={repositoryRulesetsLimit}
                  repositoryRulesetsLoading={repositoryRulesets.isLoading || repositoryRulesets.isFetching}
                  repositoryRulesetsAvailability={repositoryRulesets.data?.availability ?? null}
                  repositoryRulesetsError={repositoryRulesets.error}
                  repositorySecurityAdvisories={repositorySecurityAdvisories.data?.items ?? []}
                  repositorySecurityAdvisoriesLimit={repositorySecurityAdvisoriesLimit}
                  repositorySecurityAdvisoriesLoading={
                    repositorySecurityAdvisories.isLoading || repositorySecurityAdvisories.isFetching
                  }
                  repositorySecurityAdvisoriesAvailability={
                    repositorySecurityAdvisories.data?.availability ?? null
                  }
                  repositorySecurityAdvisoriesError={repositorySecurityAdvisories.error}
                  repositorySecurityPolicy={repositorySecurityPolicy.data ?? null}
                  repositorySecurityPolicyLoading={
                    repositorySecurityPolicy.isLoading || repositorySecurityPolicy.isFetching
                  }
                  repositorySecurityPolicyError={repositorySecurityPolicy.error}
                  repositoryCommunityProfile={repositoryCommunityProfile.data?.profile ?? null}
                  repositoryCommunityProfileLoading={
                    repositoryCommunityProfile.isLoading || repositoryCommunityProfile.isFetching
                  }
                  repositoryCommunityProfileAvailability={
                    repositoryCommunityProfile.data?.availability ?? null
                  }
                  repositoryCommunityProfileError={repositoryCommunityProfile.error}
                  releases={releaseItems}
                  releasesLimit={releasesLimit}
                  releasesLoading={releases.isLoading || releases.isFetching}
                  releasesAvailability={releasesAvailability}
                  releasesError={releases.error}
                  contributors={contributorItems}
                  contributorLimit={repositoryContributorLimit}
                  contributorsLoading={contributors.isLoading || contributors.isFetching}
                  contributorsAvailability={contributorsAvailability}
                  contributorsError={contributors.error}
                  loading={repository.isLoading}
                  pinned={pinnedRepositoryNameSet.has(effectiveRepository.toLowerCase())}
                  pinBusy={areaPinMutation.isPending}
                  pinError={areaPinMutation.error instanceof Error ? areaPinMutation.error : null}
                  error={
                    repository.error ??
                    (activeRepositoryTab === "code" ? contents.error : null) ??
                    (activeRepositoryTab === "issues" ? issues.error : null) ??
                    (activeRepositoryTab === "pulls" ? pulls.error : null) ??
                    (activeRepositoryTab === "discussions" ? discussions.error : null) ??
                    (activeRepositoryTab === "projects" ? projects.error : null) ??
                    (activeRepositoryTab === "releases" ? releases.error : null) ??
                    (activeRepositoryTab === "contributors" ? contributors.error : null) ??
                    (activeRepositoryTab === "actions" ? actions.error : null) ??
                    (activeRepositoryTab === "securityQuality"
                      ? (branchProtection.error ??
                        dependabotAlerts.error ??
                        codeScanningAlerts.error ??
                        secretScanningAlerts.error ??
                        repositoryRulesets.error ??
                        repositorySecurityAdvisories.error ??
                        repositorySecurityPolicy.error ??
                        repositoryCommunityProfile.error)
                      : null) ??
                    (activeRepositoryTab === "settings"
                      ? (repositoryAccess.error ?? repositoryForks.error)
                      : null)
                  }
                  onOpenCodeBrowser={(entry) =>
                    openCodeBrowserInApp(
                      effectiveRepository,
                      entry.path,
                      entry.type === "dir" ? "dir" : "file",
                      contentsRef ?? repositoryDetail?.defaultBranch ?? null
                    )
                  }
                  onOpenReleaseTarget={(ref) =>
                    selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref), {
                      path: "",
                      entryType: "dir"
                    })
                  }
                  onOpenPullRequestCommit={(commit, targetRepositoryNameWithOwner) =>
                    openCommitInApp({
                      nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                      commit,
                      path: "",
                      entryType: "dir"
                    })
                  }
                  onOpenPullRequestReviewCommit={(review, targetRepositoryNameWithOwner) => {
                    const commit = pullRequestReviewCommitRecentCommit(review);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenPullRequestTimelineEventCommit={(event, targetRepositoryNameWithOwner) => {
                    const commit = pullRequestTimelineEventCommitRecentCommit(event);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenWorkflowRunCommit={(run, targetRepositoryNameWithOwner) => {
                    const commit = workflowRunCommitRecentCommit(run);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenWorkflowCheckSuiteCommit={(suite, targetRepositoryNameWithOwner) => {
                    const commit = workflowCheckSuiteCommitRecentCommit(suite);

                    if (commit) {
                      openCommitInApp({
                        nameWithOwner: targetRepositoryNameWithOwner ?? effectiveRepository,
                        commit,
                        path: "",
                        entryType: "dir"
                      });
                    }
                  }}
                  onOpenCodePath={(path, entryType, ref, blobUrl, line, targetRepositoryNameWithOwner) => {
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

                    openCodeBrowserInApp(
                      targetRepositoryNameWithOwner ?? effectiveRepository,
                      path,
                      entryType,
                      ref,
                      line
                    );
                  }}
                  onOpenExternal={(url) => void api.openExternal(url)}
                  onOpenRepository={openRepositoryInApp}
                  onOpenTeam={(team) => {
                    recordRecent(teamRecentInput(team));
                    setSelectedOrganizationLogin(team.organizationLogin);
                    setSelectedOrganizationTeamSlug(team.slug);
                    setSelectedOrganizationMemberLogin(null);
                    setSelectedOrganizationProjectId(null);
                    goToOrganizations();
                  }}
                  onRefresh={() => refreshRepositorySurface()}
                  onOpenFileFinder={() => setFileFinderOpen(true)}
                  onSelectTab={(tab) => selectRepositoryTabInApp(effectiveRepository, tab)}
                  onSelectRootMarkdown={setSelectedRootMarkdownPath}
                  onOpenFilteredSurface={(tab, filter) =>
                    openFilteredRepositorySurfaceInApp(effectiveRepository, tab, filter)
                  }
                  onSelectIssue={(issue) => selectIssueInApp(effectiveRepository, issue)}
                  onSelectPullRequest={(pullRequest) =>
                    selectPullRequestInApp(effectiveRepository, pullRequest)
                  }
                  onOpenIssueReference={openLinkedIssueInApp}
                  onSelectDiscussion={(discussion) => selectDiscussionInApp(effectiveRepository, discussion)}
                  onSelectProject={(project) => selectProjectInApp(effectiveRepository, project)}
                  onSelectRelease={(release) => selectReleaseInApp(effectiveRepository, release)}
                  onSelectReleaseAsset={(release, asset) =>
                    selectReleaseAssetInApp(effectiveRepository, release, asset)
                  }
                  onSelectWorkflowRun={(run) => selectWorkflowRunInApp(effectiveRepository, run)}
                  onSelectWorkflowArtifact={(run, artifact) =>
                    selectWorkflowArtifactInApp(effectiveRepository, run, artifact)
                  }
                  onSelectSecurityItem={(securityItem) =>
                    selectSecurityItemInApp(effectiveRepository, securityItem)
                  }
                  onSelectWikiPage={(page) => selectWikiPageInApp(effectiveRepository, page)}
                  onOpenWorkflowRun={(runId, url) =>
                    openWorkflowRunReferenceInApp(effectiveRepository, runId, url)
                  }
                  onSelectContributor={(contributor) =>
                    selectContributorInApp(effectiveRepository, contributor)
                  }
                  onSelectSecurityQualityBranch={(ref) =>
                    selectSecurityQualityBranchInApp(effectiveRepository, ref)
                  }
                  onSelectSettingsCollaborator={(collaborator) =>
                    selectRepositorySettingsCollaboratorInApp(effectiveRepository, collaborator)
                  }
                  onSelectRef={(ref) =>
                    selectRepositoryRefInApp(
                      effectiveRepository,
                      ref,
                      ref ? repositoryRefKindForName(ref) : "ref"
                    )
                  }
                  onExpandRefs={expandActiveRepositoryRefs}
                  onExpandIssues={expandActiveRepositoryIssues}
                  onExpandPullRequests={expandActiveRepositoryPullRequests}
                  onExpandContributors={expandActiveRepositoryContributors}
                  onExpandForks={expandActiveRepositoryForks}
                  onExpandRepositoryAccess={expandActiveRepositoryAccess}
                  onExpandActions={expandActiveRepositoryActions}
                  onExpandWorkflowDefinitions={expandActiveRepositoryWorkflowDefinitions}
                  onExpandProjects={expandActiveRepositoryProjects}
                  onExpandReleases={expandActiveRepositoryReleases}
                  onExpandDiscussions={expandActiveRepositoryDiscussions}
                  onExpandDependabotAlerts={() => expandActiveRepositorySecurityList("dependabot")}
                  onExpandCodeScanningAlerts={() => expandActiveRepositorySecurityList("codeScanning")}
                  onExpandSecretScanningAlerts={() => expandActiveRepositorySecurityList("secretScanning")}
                  onExpandRepositoryRulesets={() => expandActiveRepositorySecurityList("rulesets")}
                  onExpandRepositorySecurityAdvisories={() =>
                    expandActiveRepositorySecurityList("advisories")
                  }
                  onTogglePin={() => toggleRepositoryPin(effectiveRepository)}
                  mutationAction={mutation.variables?.action ?? null}
                  mutationPending={mutation.isPending}
                  mutationSucceeded={mutation.isSuccess}
                  mutationError={mutation.error instanceof Error ? mutation.error : null}
                  rightRail={repositoryRightRail}
                  onMutate={(action, dangerous, payload = {}) => {
                    if (
                      dangerous &&
                      !window.confirm(`Run ${githubActionLabel(action)} on ${owner}/${repo}?`)
                    ) {
                      return;
                    }
                    mutation.reset();
                    mutation.mutate(createGitHubMutationInput(action, owner, repo, payload));
                  }}
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
                  contentsLoading={contents.isLoading || contents.isFetching}
                  contentsError={contents.error}
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
                    contents.error ??
                    fileContent.error ??
                    fileBlame.error ??
                    fileCommits.error
                  }
                  onRefresh={() => {
                    return Promise.all([refreshRepositoryDetailNow(), refreshCodeBrowserNow()]);
                  }}
                  onBackToRepository={() => {
                    if (codeBrowserRef) {
                      selectRepositoryRefInApp(
                        effectiveRepository,
                        codeBrowserRef,
                        repositoryRefKindForName(codeBrowserRef)
                      );
                      return;
                    }
                    openRepositoryInApp(effectiveRepository, "code");
                  }}
                  onOpenCodeBrowser={(path, entryType, refOverride, line) =>
                    openCodeBrowserInApp(
                      effectiveRepository,
                      path,
                      entryType,
                      refOverride ?? codeBrowserRef ?? repositoryDetail?.defaultBranch ?? null,
                      line ?? route.line
                    )
                  }
                  onOpenCommit={(commit, path, entryType, line) =>
                    openCommitInApp({
                      nameWithOwner: effectiveRepository,
                      commit,
                      path,
                      entryType,
                      line
                    })
                  }
                  onSelectRef={(ref) =>
                    selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref), {
                      path: route.path,
                      entryType: route.entryType,
                      line: route.line
                    })
                  }
                  onExpandFileBlamePreview={() =>
                    setExpandedFileBlameRange({
                      key: fileBlameRangeKey,
                      limit: expandedFileBlameRangeLimit
                    })
                  }
                  onExpandCommits={expandFileCommitHistory}
                  onOpenExternal={(url) => void api.openExternal(url)}
                />
              )}

            {route.kind === "codeBrowser" && repositoryRightRail}

            {route.kind === "repositories" && (
              <RepositoriesRoute
                title={routeTitle(route)}
                appReady={appState.isSuccess}
                githubReady={githubReady}
                repositoryListLimit={repositoryListLimit}
                pinnedRepositoryNames={pinnedRepositoryNames}
                repositoryPinBusy={areaPinMutation.isPending}
                repositoryPinError={areaPinMutation.error instanceof Error ? areaPinMutation.error : null}
                viewerLogin={appState.data?.viewer?.login ?? accountProfileData?.login ?? null}
                onOpenExternal={(url) => void api.openExternal(url)}
                onOpenRepository={openRepositoryInApp}
                onOpenAddRepository={() => setAddRepositoryOpen(true)}
                onExpandRepositories={expandRepositoryList}
                onToggleRepositoryPin={toggleRepositoryPin}
              />
            )}

            {(route.kind === "mailbox" || route.kind === "organizations") && (
              <CollectionView
                title={routeTitle(route)}
                routeKind={route.kind}
                githubReady={githubReady}
                issues={accountIssueItems}
                issuesLoading={accountIssues.isLoading || accountIssues.isFetching}
                issuesError={accountIssues.error}
                issuesAvailability={accountIssuesAvailability}
                pulls={accountPullItems}
                pullsLoading={accountPulls.isLoading || accountPulls.isFetching}
                pullsError={accountPulls.error}
                pullsAvailability={accountPullsAvailability}
                accountWorkLimit={accountWorkLimit}
                notifications={notificationItems}
                notificationsAvailability={notificationsAvailability}
                notificationFilter={notificationFilter}
                notificationLimit={notificationLimit}
                notificationsLoading={notifications.isLoading || notifications.isFetching}
                notificationsError={notifications.error}
                notificationMarkingReadId={
                  markNotificationRead.isPending ? (markNotificationRead.variables?.threadId ?? null) : null
                }
                notificationUnsubscribingId={
                  unsubscribeNotification.isPending
                    ? (unsubscribeNotification.variables?.threadId ?? null)
                    : null
                }
                notificationActionError={
                  (markNotificationRead.error instanceof Error ? markNotificationRead.error : null) ??
                  (markVisibleNotificationsRead.error instanceof Error
                    ? markVisibleNotificationsRead.error
                    : null) ??
                  (unsubscribeNotification.error instanceof Error ? unsubscribeNotification.error : null)
                }
                notificationBulkMarkingRead={markVisibleNotificationsRead.isPending}
                organizations={organizationItems}
                selectedOrganizationLogin={selectedOrganization?.login ?? null}
                organizationListLimit={organizationListLimit}
                organizationsAvailability={organizationsAvailability}
                organizationsLoading={organizations.isLoading || organizations.isFetching}
                organizationsError={organizations.error}
                organizationTeams={organizationTeams.data?.items ?? []}
                organizationTeamsAvailability={organizationTeams.data?.availability ?? null}
                organizationTeamLimit={organizationTeamLimit}
                organizationTeamsLoading={organizationTeams.isLoading || organizationTeams.isFetching}
                organizationTeamsError={organizationTeams.error}
                organizationRepositories={organizationRepositories.data?.items ?? []}
                organizationRepositoriesAvailability={organizationRepositories.data?.availability ?? null}
                organizationRepositoryLimit={organizationRepositoryLimit}
                organizationRepositoriesLoading={
                  organizationRepositories.isLoading || organizationRepositories.isFetching
                }
                organizationRepositoriesError={organizationRepositories.error}
                organizationMembers={organizationMembers.data?.items ?? []}
                organizationMembersAvailability={organizationMembers.data?.availability ?? null}
                organizationMemberLimit={organizationMemberLimit}
                organizationMembersLoading={organizationMembers.isLoading || organizationMembers.isFetching}
                organizationMembersError={organizationMembers.error}
                selectedOrganizationMemberLogin={selectedOrganizationMemberLogin}
                selectedOrganizationTeamSlug={selectedOrganizationTeam?.slug ?? null}
                organizationTeamRepositories={organizationTeamRepositories.data?.items ?? []}
                organizationTeamRepositoriesAvailability={
                  organizationTeamRepositories.data?.availability ?? null
                }
                organizationTeamRepositoryLimit={organizationTeamRepositoryLimit}
                organizationTeamRepositoriesLoading={
                  organizationTeamRepositories.isLoading || organizationTeamRepositories.isFetching
                }
                organizationTeamRepositoriesError={organizationTeamRepositories.error}
                organizationTeamMembers={organizationTeamMembers.data?.items ?? []}
                organizationTeamMembersAvailability={organizationTeamMembers.data?.availability ?? null}
                organizationTeamMemberLimit={organizationTeamMemberLimit}
                organizationTeamMembersLoading={
                  organizationTeamMembers.isLoading || organizationTeamMembers.isFetching
                }
                organizationTeamMembersError={organizationTeamMembers.error}
                organizationProjects={organizationProjects.data?.items ?? []}
                organizationProjectsAvailability={organizationProjects.data?.availability ?? null}
                organizationProjectLimit={organizationProjectLimit}
                organizationProjectsLoading={
                  organizationProjects.isLoading || organizationProjects.isFetching
                }
                organizationProjectsError={organizationProjects.error}
                selectedOrganizationProjectId={selectedOrganizationProjectId}
                pinnedRepositoryNames={pinnedRepositoryNames}
                repositoryPinBusy={areaPinMutation.isPending}
                repositoryPinError={areaPinMutation.error instanceof Error ? areaPinMutation.error : null}
                onOpenExternal={(url) => void api.openExternal(url)}
                onOpenRepository={openRepositoryInApp}
                onOpenIssue={openIssueSummaryInApp}
                onOpenPullRequest={openPullRequestSummaryInApp}
                onOpenNotification={openNotificationInApp}
                onNotificationFilterChange={setNotificationFilter}
                onMarkNotificationRead={(threadId) => {
                  if (githubReady) {
                    markNotificationRead.mutate({ threadId });
                  }
                }}
                onMarkVisibleNotificationsRead={(threadIds) => {
                  if (githubReady) {
                    markVisibleNotificationsRead.mutate({ threadIds });
                  }
                }}
                onUnsubscribeNotification={(threadId) => {
                  if (githubReady && window.confirm("Unsubscribe from this GitHub notification thread?")) {
                    unsubscribeNotification.mutate({ threadId });
                  }
                }}
                onSelectOrganization={(login) => {
                  const organization = organizationItems.find((item) => item.login === login);
                  if (organization) {
                    recordRecent(organizationRecentInput(organization));
                  }
                  setSelectedOrganizationLogin(login);
                  setSelectedOrganizationTeamSlug(null);
                  setSelectedOrganizationMemberLogin(null);
                  setSelectedOrganizationProjectId(null);
                }}
                onSelectOrganizationTeam={(slug) => {
                  const team = organizationTeams.data?.items.find((item) => item.slug === slug);
                  if (team) {
                    recordRecent(teamRecentInput(team));
                  }
                  setSelectedOrganizationTeamSlug(slug);
                  setSelectedOrganizationMemberLogin(null);
                  setSelectedOrganizationProjectId(null);
                }}
                onSelectOrganizationMember={(login) => {
                  setSelectedOrganizationMemberLogin(login);
                  setSelectedOrganizationProjectId(null);
                }}
                onSelectOrganizationProject={(project) => {
                  if (selectedOrganization) {
                    selectOrganizationProjectInApp(selectedOrganization, project);
                  }
                }}
                onExpandOrganizations={expandOrganizationList}
                onExpandOrganizationRepositories={expandSelectedOrganizationRepositories}
                onExpandOrganizationTeams={expandSelectedOrganizationTeams}
                onExpandOrganizationMembers={expandSelectedOrganizationMembers}
                onExpandOrganizationProjects={expandSelectedOrganizationProjects}
                onExpandOrganizationTeamRepositories={expandSelectedOrganizationTeamRepositories}
                onExpandOrganizationTeamMembers={expandSelectedOrganizationTeamMembers}
                onExpandMailboxWork={expandMailboxWork}
                onExpandMailboxNotifications={expandMailboxNotifications}
                onToggleRepositoryPin={toggleRepositoryPin}
              />
            )}
          </main>
        </section>

        {commandPaletteOpen && (
          <CommandPalette
            items={commandPaletteItems}
            fileSearch={
              repositoryDetail && isRepositoryContext
                ? {
                    repository: repositoryDetail,
                    selectedRef: contentsRef ?? repositoryDetail.defaultBranch ?? "HEAD",
                    githubReady,
                    onOpenEntry: (entry) =>
                      openCodeBrowserInApp(
                        effectiveRepository,
                        entry.path,
                        entry.type === "dir" ? "dir" : "file",
                        contentsRef ?? repositoryDetail.defaultBranch ?? null
                      )
                  }
                : null
            }
            onOpenRepository={openRepositoryInApp}
            onClose={() => setCommandPaletteOpen(false)}
          />
        )}

        {addRepositoryOpen && (
          <AddRepositoryDialog
            repositories={repositoryItems}
            viewerLogin={appState.data?.viewer?.login ?? accountProfileData?.login ?? null}
            githubReady={githubReady}
            onClose={() => setAddRepositoryOpen(false)}
            onOpenRepository={openRepositoryInApp}
          />
        )}

        {sshAreaOpen && (
          <SshAreaDialog
            onClose={() => setSshAreaOpen(false)}
            onCreate={async (input) => {
              await createSshArea(input);
              setSshAreaOpen(false);
            }}
          />
        )}

        {editingArea && (
          <AreaEditDialog
            area={editingArea}
            onClose={() => setEditingArea(null)}
            onSave={async (input) => {
              await updateArea(input);
              setEditingArea(null);
            }}
          />
        )}

        {deletingArea && (
          <AreaDeleteDialog
            area={deletingArea}
            onClose={() => setDeletingArea(null)}
            onDelete={async () => {
              await deleteArea(deletingArea);
              setDeletingArea(null);
            }}
          />
        )}

        {fileFinderOpen && repositoryDetail && (
          <FileFinder
            repository={repositoryDetail}
            tree={repositoryTreeItem}
            githubReady={githubReady}
            loading={repositoryTree.isLoading || repositoryTree.isFetching}
            error={repositoryTree.error}
            availabilityMessage={repositoryTreeAvailabilityMessage}
            branches={branchItems}
            tags={tagItems}
            refListLimit={repositoryRefListLimit}
            maxRefListLimit={expandedRefListLimit}
            refsLoading={branches.isLoading || branches.isFetching || tags.isLoading || tags.isFetching}
            refsError={refsError}
            refsAvailabilityMessage={refsAvailabilityMessage || null}
            selectedRef={contentsRef ?? repositoryDetail.defaultBranch ?? "HEAD"}
            onClose={() => setFileFinderOpen(false)}
            onSelectRef={(ref) => {
              if (route.kind === "codeBrowser") {
                selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref), {
                  path: route.path,
                  entryType: route.entryType,
                  line: route.line
                });
                return;
              }
              selectRepositoryRefInApp(effectiveRepository, ref, repositoryRefKindForName(ref));
            }}
            onExpandRefs={expandActiveRepositoryRefs}
            onOpenEntry={(entry) => {
              setFileFinderOpen(false);
              openCodeBrowserInApp(
                effectiveRepository,
                entry.path,
                entry.type === "dir" ? "dir" : "file",
                contentsRef ?? repositoryDetail.defaultBranch ?? null
              );
            }}
          />
        )}

        {settingsOpen && (
          <SettingsPanel
            appState={appState.data}
            onClose={() => setSettingsOpen(false)}
            onOpenExternal={(url) => void api.openExternal(url)}
            onSave={async (settings) => {
              await api.updateSettings(settings);
              await queryClient.invalidateQueries({ queryKey: ["app-state"] });
            }}
            onSignInWithGitHub={() => api.signInWithGitHub()}
            onGetGitHubSignIn={() => api.getGitHubSignIn()}
            onCompleteGitHubSignIn={async () => {
              await invalidateGitHubSessionQueries();
              setSettingsOpen(false);
            }}
            onCancelGitHubSignIn={() => api.cancelGitHubSignIn()}
            onClearToken={async () => {
              await api.clearGitHubToken();
              await invalidateGitHubSessionQueries();
            }}
          />
        )}
      </div>
    </MarkdownUrlHandlerContext.Provider>
  );
}

function RepositoryPage({
  repository,
  availabilityMessage,
  githubReady,
  selectedRef,
  branches,
  tags,
  refListLimit,
  refsLoading,
  refsError,
  refsAvailabilityMessage,
  branchesError,
  contents,
  contentsLoading,
  contentsError,
  contentsAvailability,
  readmeMarkdown,
  readmeAvailability,
  readmeLoading,
  readmeError,
  rootMarkdownItems,
  selectedRootMarkdownPath,
  rootMarkdownContent,
  rootMarkdownLoading,
  rootMarkdownError,
  issues,
  issueListLimit,
  issuesLoading,
  issuesError,
  issuesAvailability,
  labels,
  labelsLoading,
  labelsError,
  labelsAvailability,
  assignableUsers,
  assignableUsersLoading,
  assignableUsersError,
  assignableUsersAvailability,
  milestones,
  milestonesLoading,
  milestonesError,
  milestonesAvailability,
  repositoryAccess,
  repositoryAccessLimit,
  repositoryAccessLoading,
  repositoryAccessError,
  repositoryForks,
  forksLimit,
  repositoryForksLoading,
  repositoryForksError,
  pulls,
  pullRequestListLimit,
  pullsLoading,
  pullsError,
  pullsAvailability,
  discussions,
  discussionsLimit,
  discussionsLoading,
  discussionsAvailability,
  discussionsError,
  actions,
  actionsLimit,
  workflowDefinitionLimit,
  actionsLoading,
  actionsAvailability,
  actionsError,
  projects,
  projectsLimit,
  projectsLoading,
  projectsAvailability,
  projectsError,
  branchProtectionBranch,
  branchProtectionBranches,
  branchProtectionBranchesLoading,
  branchProtectionBranchesError,
  branchProtection,
  branchProtectionLoading,
  branchProtectionError,
  dependabotAlerts,
  dependabotAlertsLimit,
  dependabotAlertsLoading,
  dependabotAlertsAvailability,
  dependabotAlertsError,
  codeScanningAlerts,
  codeScanningAlertsLimit,
  codeScanningAlertsLoading,
  codeScanningAlertsAvailability,
  codeScanningAlertsError,
  secretScanningAlerts,
  secretScanningAlertsLimit,
  secretScanningAlertsLoading,
  secretScanningAlertsAvailability,
  secretScanningAlertsError,
  repositoryRulesets,
  repositoryRulesetsLimit,
  repositoryRulesetsLoading,
  repositoryRulesetsAvailability,
  repositoryRulesetsError,
  repositorySecurityAdvisories,
  repositorySecurityAdvisoriesLimit,
  repositorySecurityAdvisoriesLoading,
  repositorySecurityAdvisoriesAvailability,
  repositorySecurityAdvisoriesError,
  repositorySecurityPolicy,
  repositorySecurityPolicyLoading,
  repositorySecurityPolicyError,
  repositoryCommunityProfile,
  repositoryCommunityProfileLoading,
  repositoryCommunityProfileAvailability,
  repositoryCommunityProfileError,
  releases,
  releasesLimit,
  releasesLoading,
  releasesAvailability,
  releasesError,
  contributors,
  contributorLimit,
  contributorsLoading,
  contributorsAvailability,
  contributorsError,
  loading,
  pinned,
  pinBusy,
  pinError,
  error,
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
  onSelectRootMarkdown,
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
  onExpandRepositorySecurityAdvisories,
  onTogglePin,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  rightRail,
  onMutate
}: {
  repository?: RepositoryDetail;
  availabilityMessage: string | null;
  githubReady: boolean;
  selectedRef: string | null;
  branches: BranchSummary[];
  tags: TagSummary[];
  refListLimit: number;
  refsLoading: boolean;
  refsError: Error | null;
  refsAvailabilityMessage: string | null;
  branchesError: Error | null;
  contents: RepoEntry[];
  contentsLoading: boolean;
  contentsError: Error | null;
  contentsAvailability: GitHubReadAvailability | null;
  readmeMarkdown: string | null;
  readmeAvailability: GitHubReadAvailability | null;
  readmeLoading: boolean;
  readmeError: Error | null;
  rootMarkdownItems: RepoEntry[];
  selectedRootMarkdownPath: string | null;
  rootMarkdownContent: RepoFileContentResult | null;
  rootMarkdownLoading: boolean;
  rootMarkdownError: Error | null;
  issues: IssueSummary[];
  issueListLimit: number;
  issuesLoading: boolean;
  issuesError: Error | null;
  issuesAvailability: GitHubReadAvailability | null;
  labels: LabelSummary[];
  labelsLoading: boolean;
  labelsError: Error | null;
  labelsAvailability: GitHubReadAvailability | null;
  assignableUsers: AssignableUserSummary[];
  assignableUsersLoading: boolean;
  assignableUsersError: Error | null;
  assignableUsersAvailability: GitHubReadAvailability | null;
  milestones: MilestoneSummary[];
  milestonesLoading: boolean;
  milestonesError: Error | null;
  milestonesAvailability: GitHubReadAvailability | null;
  repositoryAccess: RepositoryAccessResult | null;
  repositoryAccessLimit: number;
  repositoryAccessLoading: boolean;
  repositoryAccessError: Error | null;
  repositoryForks: RepositoryForksResult | null;
  forksLimit: number;
  repositoryForksLoading: boolean;
  repositoryForksError: Error | null;
  pulls: PullRequestSummary[];
  pullRequestListLimit: number;
  pullsLoading: boolean;
  pullsError: Error | null;
  pullsAvailability: GitHubReadAvailability | null;
  discussions: DiscussionSummary[];
  discussionsLimit: number;
  discussionsLoading: boolean;
  discussionsAvailability: GitHubReadAvailability | null;
  discussionsError: Error | null;
  actions: WorkflowRunSummary[];
  actionsLimit: number;
  workflowDefinitionLimit: number;
  actionsLoading: boolean;
  actionsAvailability: GitHubReadAvailability | null;
  actionsError: Error | null;
  projects: ProjectSummary[];
  projectsLimit: number;
  projectsLoading: boolean;
  projectsAvailability: GitHubReadAvailability | null;
  projectsError: Error | null;
  branchProtectionBranch: string | null;
  branchProtectionBranches: BranchSummary[];
  branchProtectionBranchesLoading: boolean;
  branchProtectionBranchesError: Error | null;
  branchProtection: BranchProtectionResult | null;
  branchProtectionLoading: boolean;
  branchProtectionError: Error | null;
  dependabotAlerts: DependabotAlertSummary[];
  dependabotAlertsLimit: number;
  dependabotAlertsLoading: boolean;
  dependabotAlertsAvailability: GitHubReadAvailability | null;
  dependabotAlertsError: Error | null;
  codeScanningAlerts: CodeScanningAlertSummary[];
  codeScanningAlertsLimit: number;
  codeScanningAlertsLoading: boolean;
  codeScanningAlertsAvailability: GitHubReadAvailability | null;
  codeScanningAlertsError: Error | null;
  secretScanningAlerts: SecretScanningAlertSummary[];
  secretScanningAlertsLimit: number;
  secretScanningAlertsLoading: boolean;
  secretScanningAlertsAvailability: GitHubReadAvailability | null;
  secretScanningAlertsError: Error | null;
  repositoryRulesets: RepositoryRulesetSummary[];
  repositoryRulesetsLimit: number;
  repositoryRulesetsLoading: boolean;
  repositoryRulesetsAvailability: GitHubReadAvailability | null;
  repositoryRulesetsError: Error | null;
  repositorySecurityAdvisories: RepositorySecurityAdvisorySummary[];
  repositorySecurityAdvisoriesLimit: number;
  repositorySecurityAdvisoriesLoading: boolean;
  repositorySecurityAdvisoriesAvailability: GitHubReadAvailability | null;
  repositorySecurityAdvisoriesError: Error | null;
  repositorySecurityPolicy: RepositorySecurityPolicyResult | null;
  repositorySecurityPolicyLoading: boolean;
  repositorySecurityPolicyError: Error | null;
  repositoryCommunityProfile: RepositoryCommunityProfileResult["profile"];
  repositoryCommunityProfileLoading: boolean;
  repositoryCommunityProfileAvailability: GitHubReadAvailability | null;
  repositoryCommunityProfileError: Error | null;
  releases: ReleaseSummary[];
  releasesLimit: number;
  releasesLoading: boolean;
  releasesAvailability: GitHubReadAvailability | null;
  releasesError: Error | null;
  contributors: ContributorSummary[];
  contributorLimit: number;
  contributorsLoading: boolean;
  contributorsAvailability: GitHubReadAvailability | null;
  contributorsError: Error | null;
  loading: boolean;
  pinned: boolean;
  pinBusy: boolean;
  pinError: Error | null;
  error: Error | null;
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
  onSelectRootMarkdown(path: string): void;
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
  onTogglePin(): void;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  rightRail?: ReactNode;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const route = useUiStore((state) => state.route);
  const tab = route.kind === "repository" ? route.tab : "code";
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

  const counts = getRepositoryCounts(repo, { issues, pulls, discussions, projects });
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
    contributors: contributors.length
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
          <p>{repo.description ?? "No repository description."}</p>
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
          <button type="button" onClick={() => onOpenExternal(repo.htmlUrl)} title="Open on GitHub fallback">
            <ExternalLink size={16} /> GitHub fallback
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
        {repoTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={tab === item.key ? "active" : ""}
              key={item.key}
              type="button"
              onClick={() => onSelectTab(item.key)}
            >
              <Icon size={16} />
              {item.label}
              {tabCounts[item.key] !== undefined && (
                <span>{formatCompactNumber(tabCounts[item.key] ?? 0)}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "code" && (
        <CodeTab
          repository={repo}
          selectedRef={selectedRef}
          branches={branches}
          tags={tags}
          refListLimit={refListLimit}
          refsLoading={refsLoading}
          refsError={refsError}
          refsAvailabilityMessage={refsAvailabilityMessage}
          contents={contents}
          contentsLoading={contentsLoading}
          contentsError={contentsError}
          contentsAvailability={contentsAvailability}
          readmeMarkdown={readmeMarkdown}
          readmeAvailability={readmeAvailability}
          readmeLoading={readmeLoading}
          readmeError={readmeError}
          rootMarkdownItems={rootMarkdownItems}
          selectedRootMarkdownPath={selectedRootMarkdownPath}
          rootMarkdownContent={rootMarkdownContent}
          rootMarkdownLoading={rootMarkdownLoading}
          rootMarkdownError={rootMarkdownError}
          onOpenCodeBrowser={onOpenCodeBrowser}
          onOpenExternal={onOpenExternal}
          onOpenFileFinder={onOpenFileFinder}
          onSelectRef={onSelectRef}
          onSelectRootMarkdown={onSelectRootMarkdown}
          onExpandRefs={onExpandRefs}
        />
      )}
      {tab === "issues" && (
        <IssuesTab
          key={`issues-${focusedIssueNumber ?? issueComposer ?? (issueFilter || "default")}`}
          repository={repo}
          githubReady={githubReady}
          issues={issues}
          issueListLimit={issueListLimit}
          availability={issuesAvailability}
          focusedIssueNumber={focusedIssueNumber}
          initialFilter={issueFilter}
          initialCreating={issueComposer === "create"}
          labels={labels}
          labelsLoading={labelsLoading}
          labelsError={labelsError}
          labelsAvailability={labelsAvailability}
          assignableUsers={assignableUsers}
          assignableUsersLoading={assignableUsersLoading}
          assignableUsersError={assignableUsersError}
          assignableUsersAvailability={assignableUsersAvailability}
          milestones={milestones}
          milestonesLoading={milestonesLoading}
          milestonesError={milestonesError}
          milestonesAvailability={milestonesAvailability}
          loading={issuesLoading}
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
      {tab === "pulls" && (
        <PullRequestsTab
          key={`pulls-${focusedPullNumber ?? pullComposer ?? (pullFilter || "default")}`}
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          branches={branches}
          branchesError={branchesError}
          pulls={pulls}
          pullRequestListLimit={pullRequestListLimit}
          availability={pullsAvailability}
          focusedPullNumber={focusedPullNumber}
          initialFilter={pullFilter}
          initialCreating={pullComposer === "create"}
          labels={labels}
          labelsLoading={labelsLoading}
          labelsError={labelsError}
          labelsAvailability={labelsAvailability}
          assignableUsers={assignableUsers}
          assignableUsersLoading={assignableUsersLoading}
          assignableUsersError={assignableUsersError}
          assignableUsersAvailability={assignableUsersAvailability}
          milestones={milestones}
          milestonesLoading={milestonesLoading}
          milestonesError={milestonesError}
          milestonesAvailability={milestonesAvailability}
          loading={pullsLoading}
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
      {tab === "discussions" && (
        <DiscussionsTab
          key={`discussions-${focusedDiscussionNumber ?? "default"}`}
          repository={repo}
          discussions={discussions}
          discussionsLimit={discussionsLimit}
          focusedDiscussionNumber={focusedDiscussionNumber}
          githubReady={githubReady}
          loading={discussionsLoading}
          availability={discussionsAvailability}
          error={discussionsError}
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
      {tab === "projects" && (
        <ProjectsTab
          key={`projects-${focusedProjectId ?? "default"}`}
          repository={repo}
          githubReady={githubReady}
          issues={issues}
          pulls={pulls}
          projects={projects}
          projectsLimit={projectsLimit}
          focusedProjectId={focusedProjectId}
          loading={projectsLoading}
          availability={projectsAvailability}
          error={projectsError}
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
      {tab === "releases" && (
        <ReleasesTab
          key={`releases-${
            focusedReleaseId ?? focusedReleaseTagName ?? releaseComposer ?? "default"
          }-${focusedReleaseAssetId ?? "asset-default"}`}
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          branches={branches}
          tags={tags}
          refsError={refsError}
          refsAvailabilityMessage={refsAvailabilityMessage}
          releases={releases}
          releasesLimit={releasesLimit}
          availability={releasesAvailability}
          focusedReleaseId={focusedReleaseId}
          focusedReleaseTagName={focusedReleaseTagName}
          focusedReleaseAssetId={focusedReleaseAssetId}
          initialCreating={releaseComposer === "create"}
          loading={releasesLoading}
          error={releasesError}
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
      {tab === "actions" && (
        <ActionsTab
          key={`actions-${focusedWorkflowRunId ?? workflowComposer ?? (workflowFilter || "default")}-${
            focusedWorkflowArtifactId ?? "artifact-default"
          }`}
          repository={repo}
          githubReady={githubReady}
          selectedRef={selectedRef}
          branches={branches}
          tags={tags}
          refsError={refsError}
          refsAvailabilityMessage={refsAvailabilityMessage}
          actions={actions}
          actionsLimit={actionsLimit}
          workflowDefinitionLimit={workflowDefinitionLimit}
          availability={actionsAvailability}
          focusedWorkflowRunId={focusedWorkflowRunId}
          focusedWorkflowArtifactId={focusedWorkflowArtifactId}
          initialFilter={workflowFilter}
          initialDispatching={workflowComposer === "dispatch"}
          loading={actionsLoading}
          error={actionsError}
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
      {tab === "contributors" && (
        <ContributorsTab
          key={`contributors-${focusedContributorLogin ?? "default"}`}
          repository={repo}
          githubReady={githubReady}
          contributors={contributors}
          contributorLimit={contributorLimit}
          availability={contributorsAvailability}
          focusedContributorLogin={focusedContributorLogin}
          loading={contributorsLoading}
          error={contributorsError}
          onOpenRepository={onOpenRepository}
          onOpenExternal={onOpenExternal}
          onSelectContributor={onSelectContributor}
          onExpandContributors={onExpandContributors}
        />
      )}
      {tab === "agents" && (
        <AgentsTab
          repository={repo}
          issues={issues}
          issuesLoading={issuesLoading}
          issuesError={issuesError}
          pulls={pulls}
          pullsLoading={pullsLoading}
          pullsError={pullsError}
          actions={actions}
          actionsLoading={actionsLoading}
          actionsError={actionsError}
          onOpenExternal={onOpenExternal}
          onOpenFilteredSurface={onOpenFilteredSurface}
          onSelectIssue={onSelectIssue}
          onSelectPullRequest={onSelectPullRequest}
          onSelectWorkflowRun={onSelectWorkflowRun}
        />
      )}
      {tab === "wiki" && (
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
      {tab === "securityQuality" && (
        <SecurityQualityTab
          key={`security-quality-${focusedSecurityItemKind ?? "default"}-${focusedSecurityItemId ?? "default"}`}
          repository={repo}
          branchProtectionBranch={branchProtectionBranch}
          branchProtectionBranches={branchProtectionBranches}
          branchProtectionBranchesLoading={branchProtectionBranchesLoading}
          branchProtectionBranchesError={branchProtectionBranchesError}
          branchProtection={branchProtection}
          branchProtectionLoading={branchProtectionLoading}
          branchProtectionError={branchProtectionError}
          dependabotAlerts={dependabotAlerts}
          dependabotAlertsLimit={dependabotAlertsLimit}
          dependabotAlertsLoading={dependabotAlertsLoading}
          dependabotAlertsAvailability={dependabotAlertsAvailability}
          dependabotAlertsError={dependabotAlertsError}
          codeScanningAlerts={codeScanningAlerts}
          codeScanningAlertsLimit={codeScanningAlertsLimit}
          codeScanningAlertsLoading={codeScanningAlertsLoading}
          codeScanningAlertsAvailability={codeScanningAlertsAvailability}
          codeScanningAlertsError={codeScanningAlertsError}
          secretScanningAlerts={secretScanningAlerts}
          secretScanningAlertsLimit={secretScanningAlertsLimit}
          secretScanningAlertsLoading={secretScanningAlertsLoading}
          secretScanningAlertsAvailability={secretScanningAlertsAvailability}
          secretScanningAlertsError={secretScanningAlertsError}
          repositoryRulesets={repositoryRulesets}
          repositoryRulesetsLimit={repositoryRulesetsLimit}
          repositoryRulesetsLoading={repositoryRulesetsLoading}
          repositoryRulesetsAvailability={repositoryRulesetsAvailability}
          repositoryRulesetsError={repositoryRulesetsError}
          repositorySecurityAdvisories={repositorySecurityAdvisories}
          repositorySecurityAdvisoriesLimit={repositorySecurityAdvisoriesLimit}
          repositorySecurityAdvisoriesLoading={repositorySecurityAdvisoriesLoading}
          repositorySecurityAdvisoriesAvailability={repositorySecurityAdvisoriesAvailability}
          repositorySecurityAdvisoriesError={repositorySecurityAdvisoriesError}
          repositorySecurityPolicy={repositorySecurityPolicy}
          repositorySecurityPolicyLoading={repositorySecurityPolicyLoading}
          repositorySecurityPolicyError={repositorySecurityPolicyError}
          repositoryCommunityProfile={repositoryCommunityProfile}
          repositoryCommunityProfileLoading={repositoryCommunityProfileLoading}
          repositoryCommunityProfileAvailability={repositoryCommunityProfileAvailability}
          repositoryCommunityProfileError={repositoryCommunityProfileError}
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
      {tab === "settings" && (
        <RepositorySettingsTab
          key={`settings-${repo.id}-${repo.description ?? ""}-${repo.homepageUrl ?? ""}-${JSON.stringify(
            repo.administration.features
          )}-${JSON.stringify(repo.administration.mergeSettings)}-${repo.administration.isArchived}-${
            repo.administration.allowForking
          }-${repo.administration.webCommitSignoffRequired}-${repo.topics.join(",")}`}
          repository={repo}
          githubReady={githubReady}
          branches={branches}
          branchesError={branchesError}
          branchProtectionBranch={branchProtectionBranch}
          branchProtection={branchProtection}
          branchProtectionLoading={branchProtectionLoading}
          branchProtectionError={branchProtectionError}
          repositoryRulesets={repositoryRulesets}
          repositoryRulesetsLimit={repositoryRulesetsLimit}
          repositoryRulesetsLoading={repositoryRulesetsLoading}
          repositoryRulesetsAvailability={repositoryRulesetsAvailability}
          repositoryRulesetsError={repositoryRulesetsError}
          repositoryAccess={repositoryAccess}
          repositoryAccessLimit={repositoryAccessLimit}
          repositoryAccessLoading={repositoryAccessLoading}
          repositoryAccessError={repositoryAccessError}
          focusedCollaboratorLogin={focusedSettingsCollaboratorLogin}
          repositoryForks={repositoryForks}
          forksLimit={forksLimit}
          repositoryForksLoading={repositoryForksLoading}
          repositoryForksError={repositoryForksError}
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

function accessRoleLabel(role: string | null): string {
  return role ? role.replace(/[_-]/g, " ") : "access";
}

function collaboratorRoleLabel(collaborator: RepositoryCollaboratorSummary): string {
  if (collaborator.roleName) {
    return accessRoleLabel(collaborator.roleName);
  }

  if (collaborator.permissions.admin) {
    return "admin";
  }
  if (collaborator.permissions.maintain) {
    return "maintain";
  }
  if (collaborator.permissions.push) {
    return "write";
  }
  if (collaborator.permissions.triage) {
    return "triage";
  }
  if (collaborator.permissions.pull) {
    return "read";
  }
  return "access";
}

function notificationReasonLabel(reason: string): string {
  return reason.replace(/_/g, " ");
}

function notificationSubscriptionStateLabel(notification: NotificationSummary): string | null {
  if (notification.subscribed === true) {
    return "subscribed";
  }
  if (notification.subscribed === false) {
    return "not subscribed";
  }
  return null;
}

function notificationMetadataParts(notification: NotificationSummary): string[] {
  return [
    notification.repositoryPrivate === null
      ? null
      : notification.repositoryPrivate
        ? "private repository"
        : "public repository",
    notification.participating === true ? "participating" : null,
    notificationSubscriptionStateLabel(notification),
    notification.ignored === true ? "muted" : notification.ignored === false ? "not muted" : null,
    notification.subscriptionReason
      ? `subscription reason ${notificationReasonLabel(notification.subscriptionReason)}`
      : null,
    notification.subscriptionCreatedAt
      ? `subscribed ${formatRelativeDate(notification.subscriptionCreatedAt)}`
      : null,
    notification.lastReadAt ? `last read ${formatRelativeDate(notification.lastReadAt)}` : null,
    notification.subject.latestCommentHtmlUrl
      ? "latest comment link available"
      : notification.subject.latestCommentApiUrl
        ? "latest comment API metadata"
        : null
  ].filter((item): item is string => Boolean(item));
}

function notificationTargetUrl(notification: NotificationSummary): string {
  return notification.htmlUrl ?? notification.repositoryHtmlUrl ?? "https://github.com/notifications";
}

function CollectionView({
  title,
  routeKind,
  githubReady,
  issues,
  issuesLoading,
  issuesError,
  issuesAvailability,
  pulls,
  pullsLoading,
  pullsError,
  pullsAvailability,
  accountWorkLimit,
  notifications,
  notificationsAvailability,
  notificationFilter,
  notificationLimit,
  notificationsLoading,
  notificationsError,
  notificationMarkingReadId,
  notificationUnsubscribingId,
  notificationActionError,
  notificationBulkMarkingRead,
  organizations,
  selectedOrganizationLogin,
  organizationListLimit,
  organizationsAvailability,
  organizationsLoading,
  organizationsError,
  organizationTeams,
  organizationTeamLimit,
  organizationTeamsAvailability,
  organizationTeamsLoading,
  organizationTeamsError,
  organizationRepositories,
  organizationRepositoriesAvailability,
  organizationRepositoryLimit,
  organizationRepositoriesLoading,
  organizationRepositoriesError,
  organizationMembers,
  organizationMembersAvailability,
  organizationMemberLimit,
  organizationMembersLoading,
  organizationMembersError,
  selectedOrganizationMemberLogin,
  selectedOrganizationTeamSlug,
  organizationTeamRepositories,
  organizationTeamRepositoriesAvailability,
  organizationTeamRepositoryLimit,
  organizationTeamRepositoriesLoading,
  organizationTeamRepositoriesError,
  organizationTeamMembers,
  organizationTeamMembersAvailability,
  organizationTeamMemberLimit,
  organizationTeamMembersLoading,
  organizationTeamMembersError,
  organizationProjects,
  organizationProjectsAvailability,
  organizationProjectLimit,
  organizationProjectsLoading,
  organizationProjectsError,
  selectedOrganizationProjectId,
  pinnedRepositoryNames,
  repositoryPinBusy,
  repositoryPinError,
  onOpenExternal,
  onOpenRepository,
  onOpenIssue,
  onOpenPullRequest,
  onOpenNotification,
  onNotificationFilterChange,
  onMarkNotificationRead,
  onMarkVisibleNotificationsRead,
  onUnsubscribeNotification,
  onSelectOrganization,
  onSelectOrganizationTeam,
  onSelectOrganizationMember,
  onSelectOrganizationProject,
  onExpandOrganizations,
  onExpandOrganizationRepositories,
  onExpandOrganizationTeams,
  onExpandOrganizationMembers,
  onExpandOrganizationProjects,
  onExpandOrganizationTeamRepositories,
  onExpandOrganizationTeamMembers,
  onExpandMailboxWork,
  onExpandMailboxNotifications,
  onToggleRepositoryPin
}: {
  title: string;
  routeKind: "mailbox" | "organizations";
  githubReady: boolean;
  issues: IssueSummary[];
  issuesLoading: boolean;
  issuesError: Error | null;
  issuesAvailability: GitHubReadAvailability | null;
  pulls: PullRequestSummary[];
  pullsLoading: boolean;
  pullsError: Error | null;
  pullsAvailability: GitHubReadAvailability | null;
  accountWorkLimit: number;
  notifications: NotificationSummary[];
  notificationsAvailability: GitHubReadAvailability | null;
  notificationFilter: MailboxNotificationFilter;
  notificationLimit: number;
  notificationsLoading: boolean;
  notificationsError: Error | null;
  notificationMarkingReadId: string | null;
  notificationUnsubscribingId: string | null;
  notificationActionError: Error | null;
  notificationBulkMarkingRead: boolean;
  organizations: OrganizationSummary[];
  selectedOrganizationLogin: string | null;
  organizationListLimit: number;
  organizationsAvailability: GitHubReadAvailability | null;
  organizationsLoading: boolean;
  organizationsError: Error | null;
  organizationTeams: TeamSummary[];
  organizationTeamLimit: number;
  organizationTeamsAvailability: GitHubReadAvailability | null;
  organizationTeamsLoading: boolean;
  organizationTeamsError: Error | null;
  organizationRepositories: OrganizationRepositorySummary[];
  organizationRepositoriesAvailability: GitHubReadAvailability | null;
  organizationRepositoryLimit: number;
  organizationRepositoriesLoading: boolean;
  organizationRepositoriesError: Error | null;
  organizationMembers: OrganizationMemberSummary[];
  organizationMembersAvailability: GitHubReadAvailability | null;
  organizationMemberLimit: number;
  organizationMembersLoading: boolean;
  organizationMembersError: Error | null;
  selectedOrganizationMemberLogin: string | null;
  selectedOrganizationTeamSlug: string | null;
  organizationTeamRepositories: OrganizationTeamRepositorySummary[];
  organizationTeamRepositoriesAvailability: GitHubReadAvailability | null;
  organizationTeamRepositoryLimit: number;
  organizationTeamRepositoriesLoading: boolean;
  organizationTeamRepositoriesError: Error | null;
  organizationTeamMembers: TeamMemberSummary[];
  organizationTeamMembersAvailability: GitHubReadAvailability | null;
  organizationTeamMemberLimit: number;
  organizationTeamMembersLoading: boolean;
  organizationTeamMembersError: Error | null;
  organizationProjects: ProjectSummary[];
  organizationProjectsAvailability: GitHubReadAvailability | null;
  organizationProjectLimit: number;
  organizationProjectsLoading: boolean;
  organizationProjectsError: Error | null;
  selectedOrganizationProjectId: string | null;
  pinnedRepositoryNames: string[];
  repositoryPinBusy: boolean;
  repositoryPinError: Error | null;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
  onOpenNotification(notification: NotificationSummary): void;
  onNotificationFilterChange(filter: MailboxNotificationFilter): void;
  onMarkNotificationRead(threadId: string): void;
  onMarkVisibleNotificationsRead(threadIds: string[]): void;
  onUnsubscribeNotification(threadId: string): void;
  onSelectOrganization(login: string): void;
  onSelectOrganizationTeam(slug: string): void;
  onSelectOrganizationMember(login: string): void;
  onSelectOrganizationProject(project: ProjectSummary): void;
  onExpandOrganizations(): void;
  onExpandOrganizationRepositories(): void;
  onExpandOrganizationTeams(): void;
  onExpandOrganizationMembers(): void;
  onExpandOrganizationProjects(): void;
  onExpandOrganizationTeamRepositories(): void;
  onExpandOrganizationTeamMembers(): void;
  onExpandMailboxWork(): void;
  onExpandMailboxNotifications(): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
}): JSX.Element {
  const api = useControlApi();
  const [collectionFilter, setCollectionFilter] = useState("");
  const [profileRepositoryLimits, setProfileRepositoryLimits] = useState<Record<string, number>>({});
  const normalizedCollectionFilter = collectionFilter.trim().toLowerCase();
  const workRows = [
    ...issues.map((issue) => ({ ...issue, kind: "issue" as const })),
    ...pulls.map((pull) => ({ ...pull, kind: "pull" as const }))
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const workRowsLoading = issuesLoading || pullsLoading;
  const workRowErrors = [
    issuesError ? `Issues unavailable: ${issuesError.message}` : null,
    pullsError ? `Pull requests unavailable: ${pullsError.message}` : null
  ].filter((message): message is string => Boolean(message));
  const workAvailabilityMessages = [
    readAvailabilityMessage("Account issues", issuesAvailability),
    readAvailabilityMessage("Account pull requests", pullsAvailability)
  ].filter((message): message is string => Boolean(message));

  const actionUrl =
    routeKind === "organizations" ? "https://github.com/organizations" : "https://github.com/notifications";
  const notificationFilters: Array<{ value: MailboxNotificationFilter; label: string }> = [
    { value: "unread", label: "Unread" },
    { value: "all", label: "All" },
    { value: "participating", label: "Participating" }
  ];
  const filteredNotifications =
    routeKind === "mailbox"
      ? notifications.filter((notification) =>
          matchesCollectionFilter(
            [
              notification.subject.title,
              notification.subject.type,
              notification.reason,
              notification.repositoryNameWithOwner
            ],
            normalizedCollectionFilter
          )
        )
      : [];
  const filteredWorkRows =
    routeKind === "mailbox"
      ? workRows.filter((row) =>
          matchesCollectionFilter(
            [row.title, row.repositoryNameWithOwner, row.authorLogin, row.state, row.kind],
            normalizedCollectionFilter
          )
        )
      : [];
  const notificationsLimitHit = routeKind === "mailbox" && notifications.length >= notificationLimit;
  const canExpandMailboxNotifications = notificationsLimitHit && notificationLimit < maxMailboxListLimit;
  const accountWorkLimitHit =
    routeKind === "mailbox" && (issues.length >= accountWorkLimit || pulls.length >= accountWorkLimit);
  const canExpandMailboxWork = accountWorkLimitHit && accountWorkLimit < maxMailboxListLimit;
  const visibleUnreadNotificationIds =
    routeKind === "mailbox"
      ? filteredNotifications
          .filter((notification) => notification.unread)
          .map((notification) => notification.id)
      : [];
  const filteredOrganizations =
    routeKind === "organizations"
      ? organizations.filter((organization) =>
          matchesCollectionFilter(
            [
              organization.login,
              organization.name,
              organization.description,
              organization.location,
              organization.websiteUrl
            ],
            normalizedCollectionFilter
          )
        )
      : [];
  const organizationsLimitHit =
    routeKind === "organizations" && organizations.length >= organizationListLimit;
  const canExpandOrganizations = organizationsLimitHit && organizationListLimit < maxOrganizationListLimit;
  const selectedOrganization =
    routeKind === "organizations"
      ? (organizations.find((organization) => organization.login === selectedOrganizationLogin) ??
        organizations[0] ??
        null)
      : null;
  const selectedOrganizationRepositories =
    routeKind === "organizations" && selectedOrganizationLogin
      ? [...organizationRepositories]
          .sort((a, b) => {
            const aTime = new Date(a.pushedAt ?? a.updatedAt ?? 0).getTime();
            const bTime = new Date(b.pushedAt ?? b.updatedAt ?? 0).getTime();
            return bTime - aTime;
          })
          .filter((repository) =>
            matchesCollectionFilter(
              [
                repository.name,
                repository.owner,
                repository.nameWithOwner,
                repository.description,
                repository.visibility,
                repository.permission,
                repository.defaultBranch
              ],
              normalizedCollectionFilter
            )
          )
      : [];
  const filteredOrganizationProjects =
    routeKind === "organizations"
      ? organizationProjects.filter((project) =>
          matchesCollectionFilter(
            [
              project.title,
              project.shortDescription,
              project.ownerLogin,
              project.number ? `#${project.number}` : null,
              project.closed ? "closed" : "open",
              project.isPublic === null ? null : project.isPublic ? "public" : "private",
              ...project.fields.map((field) => `${field.name} ${field.dataType ?? ""}`)
            ],
            normalizedCollectionFilter
          )
        )
      : [];
  const selectedOrganizationProject =
    routeKind === "organizations" && selectedOrganizationProjectId
      ? (organizationProjects.find((project) => project.id === selectedOrganizationProjectId) ?? null)
      : null;
  const filteredOrganizationTeams =
    routeKind === "organizations"
      ? organizationTeams.filter((team) =>
          matchesCollectionFilter(
            [team.name, team.slug, team.description, team.privacy, team.permission, team.parent?.name],
            normalizedCollectionFilter
          )
        )
      : [];
  const selectedOrganizationTeam =
    organizationTeams.find((team) => team.slug === selectedOrganizationTeamSlug) ??
    organizationTeams[0] ??
    null;
  const filteredOrganizationTeamRepositories =
    routeKind === "organizations"
      ? organizationTeamRepositories.filter((repository) =>
          matchesCollectionFilter(
            [
              repository.name,
              repository.owner,
              repository.nameWithOwner,
              repository.description,
              repository.visibility,
              repository.permission,
              repository.defaultBranch
            ],
            normalizedCollectionFilter
          )
        )
      : [];
  const filteredOrganizationTeamMembers =
    routeKind === "organizations"
      ? organizationTeamMembers.filter((member) =>
          matchesCollectionFilter(
            [member.login, member.siteAdmin ? "site admin" : null],
            normalizedCollectionFilter
          )
        )
      : [];
  const filteredOrganizationMembers =
    routeKind === "organizations"
      ? organizationMembers.filter((member) =>
          matchesCollectionFilter(
            [member.login, member.siteAdmin ? "site admin" : null],
            normalizedCollectionFilter
          )
        )
      : [];
  const selectedVisibleOrganizationMember =
    filteredOrganizationMembers.find((member) => member.login === selectedOrganizationMemberLogin) ?? null;
  const selectedVisibleTeamMember =
    filteredOrganizationTeamMembers.find((member) => member.login === selectedOrganizationMemberLogin) ??
    null;
  const selectedOrganizationMember = selectedVisibleTeamMember ?? selectedVisibleOrganizationMember;
  const selectedOrganizationMemberRepositoryLimit = selectedOrganizationMember
    ? (profileRepositoryLimits[selectedOrganizationMember.login] ?? defaultMemberProfileRepositoryLimit)
    : defaultMemberProfileRepositoryLimit;
  const selectedOrganizationMemberContext = selectedOrganizationMember
    ? [
        selectedOrganization?.login ? `${selectedOrganization.login} organization` : null,
        selectedVisibleTeamMember && selectedOrganizationTeam
          ? `${selectedOrganizationTeam.name} team`
          : null,
        selectedOrganizationMember.siteAdmin ? "site admin" : "member"
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const selectedOrganizationMemberProfile = useQuery<AccountProfileResult>({
    queryKey: ["github-account-profile", selectedOrganizationMember?.login ?? null],
    queryFn: () =>
      api.github.getAccountProfileWithStatus({
        login: selectedOrganizationMember?.login ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedOrganizationMember)
  });
  const selectedOrganizationMemberRepositories = useQuery<AccountRepositoryListResult>({
    queryKey: [
      "github-account-repositories",
      selectedOrganizationMember?.login ?? null,
      selectedOrganizationMemberRepositoryLimit
    ],
    queryFn: () =>
      api.github.listAccountRepositoriesWithStatus({
        login: selectedOrganizationMember?.login ?? undefined,
        limit: selectedOrganizationMemberRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedOrganizationMember)
  });
  const selectedOrganizationMemberRepositoryItems = selectedOrganizationMemberRepositories.data?.items ?? [];
  const selectedOrganizationMemberRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Member repositories",
    selectedOrganizationMemberRepositories.data?.availability ?? null
  );
  const selectedOrganizationMemberRepositoriesLimitHit =
    selectedOrganizationMemberRepositoryItems.length >= selectedOrganizationMemberRepositoryLimit;
  const canExpandSelectedOrganizationMemberRepositories =
    selectedOrganizationMemberRepositoriesLimitHit &&
    selectedOrganizationMemberRepositoryLimit < maxProfileRepositoryLimit;
  const selectedOrganizationMemberProfileData = selectedOrganizationMemberProfile.data?.profile ?? null;
  const selectedOrganizationMemberProfileAvailabilityMessage = readAvailabilityMessage(
    "Profile",
    selectedOrganizationMemberProfile.data?.availability ?? null
  );
  const selectedOrganizationMemberProfileUrl =
    selectedOrganizationMemberProfileData?.htmlUrl ?? selectedOrganizationMember?.htmlUrl ?? null;
  const organizationProjectsAvailabilityMessage = readAvailabilityMessage(
    "Organization projects",
    organizationProjectsAvailability
  );
  const organizationsAvailabilityMessage = readAvailabilityMessage(
    "Organizations",
    organizationsAvailability
  );
  const organizationRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Organization repositories",
    organizationRepositoriesAvailability
  );
  const organizationRepositoriesLimitHit = organizationRepositories.length >= organizationRepositoryLimit;
  const canExpandOrganizationRepositories =
    organizationRepositoriesLimitHit && organizationRepositoryLimit < maxOrganizationRepositoryLimit;
  const organizationTeamsLimitHit = organizationTeams.length >= organizationTeamLimit;
  const canExpandOrganizationTeams =
    organizationTeamsLimitHit && organizationTeamLimit < maxOrganizationTeamLimit;
  const organizationTeamsAvailabilityMessage = readAvailabilityMessage(
    "Organization teams",
    organizationTeamsAvailability
  );
  const organizationMembersAvailabilityMessage = readAvailabilityMessage(
    "Organization members",
    organizationMembersAvailability
  );
  const organizationMembersLimitHit = organizationMembers.length >= organizationMemberLimit;
  const canExpandOrganizationMembers =
    organizationMembersLimitHit && organizationMemberLimit < maxOrganizationMemberLimit;
  const organizationProjectsLimitHit = organizationProjects.length >= organizationProjectLimit;
  const canExpandOrganizationProjects =
    organizationProjectsLimitHit && organizationProjectLimit < maxOrganizationProjectLimit;
  const organizationTeamRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Team repositories",
    organizationTeamRepositoriesAvailability
  );
  const organizationTeamRepositoriesLimitHit =
    organizationTeamRepositories.length >= organizationTeamRepositoryLimit;
  const canExpandOrganizationTeamRepositories =
    organizationTeamRepositoriesLimitHit &&
    organizationTeamRepositoryLimit < maxOrganizationTeamRepositoryLimit;
  const organizationTeamMembersAvailabilityMessage = readAvailabilityMessage(
    "Team members",
    organizationTeamMembersAvailability
  );
  const organizationTeamMembersLimitHit = organizationTeamMembers.length >= organizationTeamMemberLimit;
  const canExpandOrganizationTeamMembers =
    organizationTeamMembersLimitHit && organizationTeamMemberLimit < maxOrganizationTeamMemberLimit;
  const selectedOrganizationMembershipAvailabilityMessage = readAvailabilityMessage(
    "Organization membership",
    selectedOrganization?.viewerMembershipAvailability ?? null
  );
  const notificationsAvailabilityMessage = readAvailabilityMessage(
    "Notifications",
    notificationsAvailability
  );
  const repositoryPinDisabledReason = repositoryPinBusy ? "Repository pin update is still running." : null;
  const notificationBulkMarkReadDisabledReason = notificationBulkMarkingRead
    ? "Visible notifications are already being marked as read."
    : !githubReady
      ? "Sign in with GitHub to mark notifications as read."
      : visibleUnreadNotificationIds.length === 0
        ? "No visible unread notifications."
        : null;

  function expandSelectedOrganizationMemberRepositories(): void {
    if (!selectedOrganizationMember) {
      return;
    }
    setProfileRepositoryLimits((limits) => {
      const currentLimit = limits[selectedOrganizationMember.login] ?? defaultMemberProfileRepositoryLimit;
      if (currentLimit >= maxProfileRepositoryLimit) {
        return limits;
      }
      const nextLimit = currentLimit < 50 ? 50 : maxProfileRepositoryLimit;
      return { ...limits, [selectedOrganizationMember.login]: nextLimit };
    });
  }

  return (
    <section className="collection-view">
      <header>
        <h2>{title}</h2>
        <div className="collection-actions">
          {routeKind === "mailbox" && (
            <>
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
                onClick={() => onMarkVisibleNotificationsRead(visibleUnreadNotificationIds)}
              >
                <CheckCircle2 size={16} /> {notificationBulkMarkingRead ? "Marking…" : "Mark visible read"}
              </button>
            </>
          )}
          <button
            type="button"
            title={routeKind === "mailbox" ? "Open GitHub notifications fallback" : undefined}
            onClick={() => onOpenExternal(actionUrl)}
          >
            {routeKind === "organizations" ? <RefreshCw size={16} /> : <ExternalLink size={16} />} GitHub
            fallback
          </button>
        </div>
      </header>
      <div className="table-panel">
        <div className="table-action-row surface-filter-row">
          <label className="surface-filter">
            <Search size={16} />
            <input
              aria-label={`Filter ${routeKind}`}
              placeholder={`Filter ${routeKind}`}
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
        {repositoryPinError && (
          <div className="error-state">Local repository pin update failed: {repositoryPinError.message}</div>
        )}
        {routeKind === "mailbox" && notificationsLoading && notifications.length === 0 && (
          <div className="loading-state">Loading GitHub notifications…</div>
        )}
        {routeKind === "mailbox" && notificationsError && (
          <div className="error-state">Could not load GitHub notifications: {notificationsError.message}</div>
        )}
        {routeKind === "mailbox" && notificationsAvailabilityMessage && (
          <div className="error-state">{notificationsAvailabilityMessage}</div>
        )}
        {routeKind === "mailbox" && notificationActionError && (
          <div className="error-state">
            Could not update GitHub notification: {notificationActionError.message}
          </div>
        )}
        {routeKind === "mailbox" &&
          filteredNotifications.map((notification) => {
            const metadataParts = notificationMetadataParts(notification);
            const notificationTarget = notificationInAppTarget(notification);
            const notificationExternalUrl = notificationTargetUrl(notification);
            const markReadDisabledReason = !notification.unread
              ? "Notification is already read."
              : !githubReady
                ? "Sign in with GitHub to mark notifications as read."
                : notificationMarkingReadId === notification.id
                  ? "Notification is already being marked as read."
                  : notificationBulkMarkingRead
                    ? "Visible notifications are being marked as read."
                    : null;
            const unsubscribeDisabledReason = !githubReady
              ? "Sign in with GitHub to unsubscribe from notifications."
              : notification.subscribed === false
                ? "Notification thread is not currently subscribed."
                : notificationUnsubscribingId === notification.id
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
                    {notificationTarget ? "in-app" : "fallback"}
                  </span>
                </span>
                <span className="row-action-stack">
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label="Open notification target GitHub fallback"
                    title="Open notification target GitHub fallback"
                    onClick={() => onOpenExternal(notificationExternalUrl)}
                  >
                    <ExternalLink size={15} />
                  </button>
                  {notification.subject.latestCommentHtmlUrl && (
                    <button
                      className="pin-row-button"
                      type="button"
                      aria-label={`Open latest comment for ${notification.subject.title} GitHub fallback`}
                      title="Open latest comment GitHub fallback"
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
                    onClick={() => onMarkNotificationRead(notification.id)}
                  >
                    <CheckCircle2 size={15} />
                  </button>
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label={`Unsubscribe from ${notification.subject.title}`}
                    disabled={Boolean(unsubscribeDisabledReason)}
                    title={unsubscribeDisabledReason ?? "Unsubscribe from this notification thread"}
                    onClick={() => onUnsubscribeNotification(notification.id)}
                  >
                    <BellOff size={15} />
                  </button>
                </span>
              </div>
            );
          })}
        {routeKind === "mailbox" && canExpandMailboxNotifications && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandMailboxNotifications}>
              Load more notifications
            </button>
          </div>
        )}
        {routeKind === "mailbox" && !canExpandMailboxNotifications && notificationsLimitHit && (
          <div className="muted-row">
            Showing the first {notificationLimit} notifications returned by GitHub.
          </div>
        )}
        {routeKind === "mailbox" &&
          (filteredWorkRows.length > 0 ||
            workRowsLoading ||
            workRowErrors.length > 0 ||
            workAvailabilityMessages.length > 0) && (
            <div className="collection-section-label">Open issues and pull requests</div>
          )}
        {routeKind === "mailbox" && workRowsLoading && workRows.length === 0 && (
          <div className="loading-state">Loading account issues and pull requests…</div>
        )}
        {routeKind === "mailbox" &&
          workRowErrors.map((message) => (
            <div className="error-state" key={message}>
              {message}
            </div>
          ))}
        {routeKind === "mailbox" &&
          workAvailabilityMessages.map((message) => (
            <div className="error-state" key={message}>
              {message}
            </div>
          ))}
        {routeKind === "mailbox" &&
          filteredWorkRows.map((row) => {
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
                    aria-label={`Open GitHub fallback for ${row.title}`}
                    title={`Open GitHub fallback for ${row.kind === "pull" ? "pull request" : "issue"}`}
                    onClick={() => onOpenExternal(row.htmlUrl)}
                  >
                    <ExternalLink size={15} />
                  </button>
                </span>
              </div>
            );
          })}
        {routeKind === "mailbox" && canExpandMailboxWork && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandMailboxWork}>
              Load more account work
            </button>
          </div>
        )}
        {routeKind === "mailbox" && !canExpandMailboxWork && accountWorkLimitHit && (
          <div className="muted-row">
            Showing the first {accountWorkLimit} issues and pull requests returned by GitHub.
          </div>
        )}
        {routeKind === "organizations" &&
          filteredOrganizations.map((organization) => {
            const membershipAvailabilityMessage = readAvailabilityMessage(
              "Organization membership",
              organization.viewerMembershipAvailability
            );

            return (
              <div className="issue-row organization-row" key={organization.id}>
                <button
                  className={`organization-row-main ${
                    organization.login === selectedOrganizationLogin ? "selected-action" : ""
                  }`}
                  type="button"
                  onClick={() => onSelectOrganization(organization.login)}
                >
                  <span className="repo-avatar">{organization.login.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{organization.name ?? organization.login}</strong>
                    <small>
                      {organization.login} · {formatCompactNumber(organization.repositoryCount)} repositories
                      · {formatCompactNumber(organization.teamCount)} teams ·{" "}
                      {organization.viewerMembershipRole ??
                        (organization.viewerCanAdminister
                          ? "admin"
                          : organization.viewerIsMember
                            ? "member"
                            : "visible")}
                      {organization.viewerMembershipState ? ` · ${organization.viewerMembershipState}` : ""}
                    </small>
                    {membershipAvailabilityMessage && <small>{membershipAvailabilityMessage}</small>}
                    {organization.description && <small>{organization.description}</small>}
                  </div>
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Open ${organization.login} on GitHub`}
                  title={`Open ${organization.login} on GitHub`}
                  onClick={() => onOpenExternal(organization.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </div>
            );
          })}
        {routeKind === "organizations" && canExpandOrganizations && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandOrganizations}>
              Load more organizations
            </button>
          </div>
        )}
        {routeKind === "organizations" && !canExpandOrganizations && organizationsLimitHit && (
          <div className="muted-row">
            Showing the first {organizationListLimit} organizations returned by GitHub.
          </div>
        )}
        {routeKind === "organizations" && selectedOrganization && (
          <section
            className="organization-profile-summary"
            aria-label={`${selectedOrganization.login} profile`}
          >
            {selectedOrganization.avatarUrl ? (
              <img src={selectedOrganization.avatarUrl} alt="" />
            ) : (
              <span className="repo-avatar">{selectedOrganization.login.slice(0, 1).toUpperCase()}</span>
            )}
            <div>
              <h3>{selectedOrganization.name ?? selectedOrganization.login}</h3>
              <small>
                {selectedOrganization.login} ·{" "}
                {selectedOrganization.viewerMembershipRole ??
                  (selectedOrganization.viewerCanAdminister
                    ? "admin"
                    : selectedOrganization.viewerIsMember
                      ? "member"
                      : "visible")}
                {selectedOrganization.viewerMembershipState
                  ? ` · ${selectedOrganization.viewerMembershipState}`
                  : ""}
              </small>
              {selectedOrganizationMembershipAvailabilityMessage && (
                <small>{selectedOrganizationMembershipAvailabilityMessage}</small>
              )}
              {selectedOrganization.description && <p>{selectedOrganization.description}</p>}
              <div className="organization-profile-meta">
                <span>{formatCompactNumber(selectedOrganization.repositoryCount)} repos</span>
                <span>{formatCompactNumber(selectedOrganization.teamCount)} teams</span>
                {selectedOrganization.location && <span>{selectedOrganization.location}</span>}
                {selectedOrganization.websiteUrl && <span>{selectedOrganization.websiteUrl}</span>}
              </div>
              <div className="organization-profile-meta">
                <span>
                  {selectedOrganization.viewerCanCreateRepositories
                    ? "can create repos"
                    : "repo creation unavailable"}
                </span>
                <span>
                  {selectedOrganization.viewerCanCreateTeams
                    ? "can create teams"
                    : "team creation unavailable"}
                </span>
              </div>
            </div>
            <button
              className="pin-row-button"
              type="button"
              aria-label={`Open ${selectedOrganization.login} on GitHub`}
              title={`Open ${selectedOrganization.login} on GitHub`}
              onClick={() => onOpenExternal(selectedOrganization.htmlUrl)}
            >
              <ExternalLink size={15} />
            </button>
          </section>
        )}
        {routeKind === "organizations" && selectedOrganizationProject && (
          <aside className="contributor-detail-panel organization-project-detail-panel">
            <div className="contributor-detail-header">
              <SquareKanban size={22} />
              <div>
                <strong>{selectedOrganizationProject.title}</strong>
                <small>
                  {[
                    selectedOrganizationProject.number ? `#${selectedOrganizationProject.number}` : null,
                    selectedOrganizationProject.ownerLogin,
                    selectedOrganizationProject.closed ? "closed" : "open"
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              {selectedOrganizationProject.htmlUrl && (
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Open ${selectedOrganizationProject.title} on GitHub`}
                  title={`Open ${selectedOrganizationProject.title} on GitHub`}
                  onClick={() => onOpenExternal(selectedOrganizationProject.htmlUrl!)}
                >
                  <ExternalLink size={15} />
                </button>
              )}
            </div>
            <div className="workflow-summary">
              <span className={`state-chip ${selectedOrganizationProject.closed ? "" : "success"}`}>
                {selectedOrganizationProject.closed ? "closed" : "open"}
              </span>
              <span>
                {selectedOrganizationProject.isPublic === null
                  ? "Visibility unknown"
                  : selectedOrganizationProject.isPublic
                    ? "Public"
                    : "Private"}
              </span>
              <span>
                {selectedOrganizationProject.itemsCount === null
                  ? "Items unavailable"
                  : `${formatCompactNumber(selectedOrganizationProject.itemsCount)} items`}
              </span>
              <span>
                {selectedOrganizationProject.fieldsCount === null
                  ? "Fields unavailable"
                  : `${formatCompactNumber(selectedOrganizationProject.fieldsCount)} fields`}
              </span>
              {selectedOrganizationProject.viewerCanUpdate !== null && (
                <span>
                  {selectedOrganizationProject.viewerCanUpdate ? "Viewer can update" : "Viewer read-only"}
                </span>
              )}
            </div>
            <div className="muted-row">
              {[
                selectedOrganizationProject.createdAt
                  ? `Created ${formatRelativeDate(selectedOrganizationProject.createdAt)}`
                  : null,
                selectedOrganizationProject.updatedAt
                  ? `Updated ${formatRelativeDate(selectedOrganizationProject.updatedAt)}`
                  : null,
                selectedOrganizationProject.closedAt
                  ? `Closed ${formatRelativeDate(selectedOrganizationProject.closedAt)}`
                  : null
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {selectedOrganizationProject.shortDescription && (
              <p className="project-description">{selectedOrganizationProject.shortDescription}</p>
            )}
            {selectedOrganizationProject.readme ? (
              <div className="project-readme-panel">
                <MarkdownBody
                  markdown={selectedOrganizationProject.readme}
                  onOpenExternal={onOpenExternal}
                  urlContext={markdownOrganizationProjectUrlContext(selectedOrganizationProject)}
                />
              </div>
            ) : (
              <div className="empty-state">No project README returned.</div>
            )}
            <div className="project-field-list" aria-label="Organization project fields">
              {selectedOrganizationProject.fields.length > 0 ? (
                selectedOrganizationProject.fields.map((field) => (
                  <span className="state-chip" key={field.id}>
                    {field.name}
                    {field.dataType ? ` · ${field.dataType.toLowerCase().replaceAll("_", " ")}` : ""}
                  </span>
                ))
              ) : (
                <span className="action-disabled-note">No project fields returned.</span>
              )}
            </div>
            <div className="thread-actions">
              {selectedOrganizationProject.htmlUrl && (
                <button type="button" onClick={() => onOpenExternal(selectedOrganizationProject.htmlUrl!)}>
                  <ExternalLink size={16} /> Project GitHub fallback
                </button>
              )}
              {selectedOrganizationProject.ownerHtmlUrl && (
                <button
                  type="button"
                  onClick={() => onOpenExternal(selectedOrganizationProject.ownerHtmlUrl!)}
                >
                  <ExternalLink size={16} /> Owner GitHub fallback
                </button>
              )}
            </div>
          </aside>
        )}
        {routeKind === "organizations" && selectedOrganizationMember && (
          <aside className="contributor-detail-panel organization-member-detail-panel">
            <div className="contributor-detail-header">
              {(selectedOrganizationMemberProfileData?.avatarUrl ?? selectedOrganizationMember.avatarUrl) ? (
                <img
                  src={
                    selectedOrganizationMemberProfileData?.avatarUrl ??
                    selectedOrganizationMember.avatarUrl ??
                    undefined
                  }
                  alt=""
                  onError={(event) => event.currentTarget.remove()}
                />
              ) : (
                <span className="mini-avatar">
                  {selectedOrganizationMember.login.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <strong>
                  {selectedOrganizationMemberProfileData?.name ?? `@${selectedOrganizationMember.login}`}
                </strong>
                <small>
                  @{selectedOrganizationMemberProfileData?.login ?? selectedOrganizationMember.login}
                </small>
              </div>
              {selectedOrganizationMemberProfileUrl && (
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Open @${selectedOrganizationMember.login} on GitHub`}
                  title={`Open @${selectedOrganizationMember.login} on GitHub`}
                  onClick={() => onOpenExternal(selectedOrganizationMemberProfileUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              )}
            </div>

            {!githubReady && (
              <div className="muted-row">Cached mode: showing stored member details when available.</div>
            )}
            {selectedOrganizationMemberProfile.isFetching && !selectedOrganizationMemberProfileData && (
              <div className="loading-state">Loading member profile…</div>
            )}
            {selectedOrganizationMemberProfile.error instanceof Error && (
              <div className="error-state">
                Profile unavailable: {selectedOrganizationMemberProfile.error.message}
              </div>
            )}
            {selectedOrganizationMemberProfileAvailabilityMessage && (
              <div className="error-state">{selectedOrganizationMemberProfileAvailabilityMessage}</div>
            )}
            {selectedOrganizationMemberContext && (
              <div className="muted-row">{selectedOrganizationMemberContext}</div>
            )}

            {(selectedOrganizationMemberProfileData?.bio ||
              selectedOrganizationMemberProfileData?.company ||
              selectedOrganizationMemberProfileData?.location ||
              selectedOrganizationMemberProfileData?.websiteUrl) && (
              <div className="contributor-detail-copy">
                {selectedOrganizationMemberProfileData.bio && (
                  <p>{selectedOrganizationMemberProfileData.bio}</p>
                )}
                {selectedOrganizationMemberProfileData.company && (
                  <small>{selectedOrganizationMemberProfileData.company}</small>
                )}
                {selectedOrganizationMemberProfileData.location && (
                  <small>{selectedOrganizationMemberProfileData.location}</small>
                )}
                {selectedOrganizationMemberProfileData.websiteUrl && (
                  <button
                    type="button"
                    onClick={() => onOpenExternal(selectedOrganizationMemberProfileData.websiteUrl!)}
                  >
                    {selectedOrganizationMemberProfileData.websiteUrl}
                  </button>
                )}
              </div>
            )}

            <div className="contributor-stats">
              <span>
                <strong>
                  {formatCompactNumber(
                    selectedOrganizationMemberProfileData?.repositoryCount ??
                      selectedOrganizationMemberRepositoryItems.length
                  )}
                </strong>
                <small>Repositories</small>
              </span>
              <span>
                <strong>
                  {formatCompactNumber(selectedOrganizationMemberProfileData?.starredRepositoryCount ?? 0)}
                </strong>
                <small>Starred</small>
              </span>
              <span>
                <strong>{formatCompactNumber(selectedOrganizationMemberProfileData?.followers ?? 0)}</strong>
                <small>Followers</small>
              </span>
              <span>
                <strong>{formatCompactNumber(selectedOrganizationMemberProfileData?.following ?? 0)}</strong>
                <small>Following</small>
              </span>
            </div>

            <div className="contributor-repositories">
              <div className="section-title-row">
                <span>Repositories</span>
              </div>
              {selectedOrganizationMemberRepositories.isFetching &&
                !selectedOrganizationMemberRepositories.data && (
                  <div className="loading-state">Loading repositories…</div>
                )}
              {selectedOrganizationMemberRepositories.error instanceof Error && (
                <div className="error-state">
                  Repositories unavailable: {selectedOrganizationMemberRepositories.error.message}
                </div>
              )}
              {selectedOrganizationMemberRepositoriesAvailabilityMessage && (
                <div className="error-state">{selectedOrganizationMemberRepositoriesAvailabilityMessage}</div>
              )}
              {!selectedOrganizationMemberRepositories.isFetching &&
                !selectedOrganizationMemberRepositories.error &&
                !selectedOrganizationMemberRepositoriesAvailabilityMessage &&
                selectedOrganizationMemberRepositoryItems.length === 0 && (
                  <div className="empty-state">
                    {githubReady ? "No repositories available." : "No cached repositories available."}
                  </div>
                )}
              {selectedOrganizationMemberRepositoryItems.map((repository) => {
                const metadataParts = repositoryCollectionMetadataParts(repository);
                const visibilityLabel = repository.visibility.toLowerCase();
                const showPrivateChip = repository.isPrivate && visibilityLabel !== "private";

                return (
                  <button
                    className="contributor-repository-row"
                    key={repository.id}
                    type="button"
                    onClick={() => onOpenRepository(repository.nameWithOwner)}
                  >
                    <span>
                      <strong>{repository.nameWithOwner}</strong>
                      <small>{repository.description ?? "No description."}</small>
                      {metadataParts.length > 0 && <small>{metadataParts.join(" · ")}</small>}
                    </span>
                    <span>
                      <span className="state-chip">{visibilityLabel}</span>
                      {repository.isFork && <span className="state-chip attention">fork</span>}
                      {showPrivateChip && <span className="state-chip attention">private</span>}
                    </span>
                  </button>
                );
              })}
              {canExpandSelectedOrganizationMemberRepositories && (
                <div className="table-action-row">
                  <button type="button" onClick={expandSelectedOrganizationMemberRepositories}>
                    Load more repositories
                  </button>
                </div>
              )}
              {!canExpandSelectedOrganizationMemberRepositories &&
                selectedOrganizationMemberRepositoriesLimitHit && (
                  <div className="muted-row">
                    Showing the first {selectedOrganizationMemberRepositoryItems.length} repositories returned
                    by GitHub.
                  </div>
                )}
            </div>
          </aside>
        )}
        {routeKind === "organizations" && selectedOrganizationLogin && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationLogin} members</div>
            {canExpandOrganizationMembers && (
              <button type="button" onClick={onExpandOrganizationMembers}>
                Load more members
              </button>
            )}
          </div>
        )}
        {routeKind === "organizations" && organizationMembersLoading && organizationMembers.length === 0 && (
          <div className="loading-state">Loading organization members…</div>
        )}
        {routeKind === "organizations" && organizationMembersAvailabilityMessage && (
          <div className="error-state">{organizationMembersAvailabilityMessage}</div>
        )}
        {routeKind === "organizations" && organizationMembersError && (
          <div className="error-state">Could not load organization members.</div>
        )}
        {routeKind === "organizations" && !canExpandOrganizationMembers && organizationMembersLimitHit && (
          <div className="muted-row">
            Showing the first {organizationMembers.length} members returned by GitHub.
          </div>
        )}
        {routeKind === "organizations" &&
          filteredOrganizationMembers.map((member) => (
            <div
              className={`issue-row organization-member-row ${
                member.login === selectedOrganizationMember?.login ? "selected-action" : ""
              }`}
              key={`organization-member-${member.id}`}
            >
              <button
                className="organization-member-row-main"
                type="button"
                aria-pressed={member.login === selectedOrganizationMember?.login}
                onClick={() => onSelectOrganizationMember(member.login)}
                title={`View @${member.login} in Control`}
              >
                {member.avatarUrl ? (
                  <img className="repo-avatar" src={member.avatarUrl} alt="" />
                ) : (
                  <span className="repo-avatar">{member.login.slice(0, 1).toUpperCase()}</span>
                )}
                <div>
                  <strong>{member.login}</strong>
                  <small>{member.siteAdmin ? "site admin" : "member"}</small>
                </div>
              </button>
              <button
                className="pin-row-button"
                type="button"
                aria-label={`Open ${member.login} on GitHub`}
                disabled={!member.htmlUrl}
                title={member.htmlUrl ? `Open ${member.login} on GitHub` : "Member profile URL unavailable."}
                onClick={() => {
                  if (member.htmlUrl) {
                    onOpenExternal(member.htmlUrl);
                  }
                }}
              >
                <ExternalLink size={15} />
              </button>
            </div>
          ))}
        {routeKind === "organizations" &&
          selectedOrganizationLogin &&
          !organizationMembersLoading &&
          !organizationMembersError &&
          !organizationMembersAvailabilityMessage &&
          filteredOrganizationMembers.length === 0 && (
            <div className="empty-state">
              {organizationMembers.length === 0
                ? "No visible organization members returned."
                : "No organization members match this filter."}
            </div>
          )}
        {routeKind === "organizations" && selectedOrganizationLogin && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationLogin} repositories</div>
            {canExpandOrganizationRepositories && (
              <button type="button" onClick={onExpandOrganizationRepositories}>
                Load more repositories
              </button>
            )}
          </div>
        )}
        {routeKind === "organizations" &&
          organizationRepositoriesLoading &&
          organizationRepositories.length === 0 && (
            <div className="loading-state">Loading organization repositories…</div>
          )}
        {routeKind === "organizations" && organizationRepositoriesAvailabilityMessage && (
          <div className="error-state">{organizationRepositoriesAvailabilityMessage}</div>
        )}
        {routeKind === "organizations" && organizationRepositoriesError && (
          <div className="error-state">Could not load organization repositories.</div>
        )}
        {routeKind === "organizations" &&
          !canExpandOrganizationRepositories &&
          organizationRepositoriesLimitHit && (
            <div className="muted-row">
              Showing the first {organizationRepositories.length} repositories returned by GitHub.
            </div>
          )}
        {routeKind === "organizations" &&
          selectedOrganizationRepositories.map((repository) => {
            const pinned = pinnedRepositoryNames.some(
              (nameWithOwner) => nameWithOwner.toLowerCase() === repository.nameWithOwner.toLowerCase()
            );
            const metadataParts = organizationRepositoryCollectionMetadataParts(repository);
            const chips = organizationRepositoryCollectionChips(repository, pinned);

            return (
              <div
                className="issue-row repository-row repository-row-with-actions"
                key={`org-repository-${repository.id}`}
              >
                <button
                  className="repository-row-main"
                  type="button"
                  onClick={() => onOpenRepository(repository.nameWithOwner)}
                >
                  <span className="repo-avatar">{repository.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{repository.name}</strong>
                    <small>{[repository.description, ...metadataParts].filter(Boolean).join(" · ")}</small>
                  </div>
                  <span className="row-chip-stack">
                    {chips.map((chip) => (
                      <span className="state-chip" key={`${repository.id}-${chip}`}>
                        {chip}
                      </span>
                    ))}
                  </span>
                </button>
                <span className="row-action-stack">
                  <button
                    className={`pin-row-button ${pinned ? "selected-action" : ""}`}
                    type="button"
                    aria-label={`${pinned ? "Unpin" : "Pin"} ${repository.name}`}
                    aria-pressed={pinned}
                    disabled={Boolean(repositoryPinDisabledReason)}
                    title={
                      repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.nameWithOwner}`
                    }
                    onClick={() => onToggleRepositoryPin(repository.nameWithOwner)}
                  >
                    <Pin size={15} />
                  </button>
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label={`Open GitHub fallback for ${repository.name}`}
                    title={`Open GitHub fallback for ${repository.nameWithOwner}`}
                    onClick={() => onOpenExternal(repository.htmlUrl)}
                  >
                    <ExternalLink size={15} />
                  </button>
                </span>
              </div>
            );
          })}
        {routeKind === "organizations" &&
          selectedOrganizationLogin &&
          !organizationRepositoriesLoading &&
          !organizationRepositoriesError &&
          !organizationRepositoriesAvailabilityMessage &&
          selectedOrganizationRepositories.length === 0 && (
            <div className="empty-state">
              {normalizedCollectionFilter
                ? "No organization repositories match this filter."
                : "No organization repositories returned."}
            </div>
          )}
        {routeKind === "organizations" && selectedOrganizationLogin && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationLogin} projects</div>
            {canExpandOrganizationProjects && (
              <button type="button" onClick={onExpandOrganizationProjects}>
                Load more projects
              </button>
            )}
          </div>
        )}
        {routeKind === "organizations" &&
          organizationProjectsLoading &&
          organizationProjects.length === 0 && (
            <div className="loading-state">Loading organization projects…</div>
          )}
        {routeKind === "organizations" && organizationProjectsAvailabilityMessage && (
          <div className="error-state">{organizationProjectsAvailabilityMessage}</div>
        )}
        {routeKind === "organizations" && organizationProjectsError && (
          <div className="error-state">Could not load organization projects.</div>
        )}
        {routeKind === "organizations" && !canExpandOrganizationProjects && organizationProjectsLimitHit && (
          <div className="muted-row">
            Showing the first {organizationProjects.length} projects returned by GitHub.
          </div>
        )}
        {routeKind === "organizations" &&
          filteredOrganizationProjects.map((project) => (
            <div
              className={`issue-row organization-project-row ${
                project.id === selectedOrganizationProject?.id ? "selected-action" : ""
              }`}
              key={project.id}
            >
              <button
                className="organization-project-row-main"
                type="button"
                aria-pressed={project.id === selectedOrganizationProject?.id}
                onClick={() => onSelectOrganizationProject(project)}
                title={`View ${project.title} in Control`}
              >
                <SquareKanban size={17} />
                <div>
                  <strong>{project.title}</strong>
                  <small>
                    {[
                      project.number ? `#${project.number}` : null,
                      project.itemsCount === null
                        ? "items unavailable"
                        : `${formatCompactNumber(project.itemsCount)} items`,
                      project.fieldsCount === null
                        ? "fields unavailable"
                        : `${formatCompactNumber(project.fieldsCount)} fields`,
                      project.updatedAt ? `updated ${formatRelativeDate(project.updatedAt)}` : null
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  {project.shortDescription && <small>{project.shortDescription}</small>}
                  {project.fields.length > 0 && (
                    <small>
                      Fields:{" "}
                      {project.fields
                        .slice(0, 4)
                        .map((field) => field.name)
                        .join(", ")}
                      {project.fields.length > 4 ? `, +${project.fields.length - 4}` : ""}
                    </small>
                  )}
                </div>
                <span className={`state-chip ${project.closed ? "" : "success"}`}>
                  {project.closed ? "closed" : "open"}
                </span>
              </button>
              <button
                className="pin-row-button"
                type="button"
                aria-label={`Open GitHub fallback for ${project.title}`}
                disabled={!project.htmlUrl}
                title={
                  project.htmlUrl
                    ? `Open GitHub fallback for ${project.title}`
                    : "Organization project URL unavailable."
                }
                onClick={() => {
                  if (project.htmlUrl) {
                    onOpenExternal(project.htmlUrl);
                  }
                }}
              >
                <ExternalLink size={15} />
              </button>
            </div>
          ))}
        {routeKind === "organizations" &&
          selectedOrganizationLogin &&
          !organizationProjectsLoading &&
          !organizationProjectsError &&
          !organizationProjectsAvailabilityMessage &&
          filteredOrganizationProjects.length === 0 && (
            <div className="empty-state">
              {organizationProjects.length === 0
                ? "No visible organization projects returned."
                : "No organization projects match this filter."}
            </div>
          )}
        {routeKind === "organizations" && organizations.length > 0 && (
          <div className="section-title-row">
            <div className="collection-section-label">
              {selectedOrganizationLogin ? `${selectedOrganizationLogin} teams` : "Visible teams"}
            </div>
            {canExpandOrganizationTeams && (
              <button type="button" onClick={onExpandOrganizationTeams}>
                Load more teams
              </button>
            )}
          </div>
        )}
        {routeKind === "organizations" && organizationTeamsLoading && organizationTeams.length === 0 && (
          <div className="loading-state">Loading visible teams…</div>
        )}
        {routeKind === "organizations" && organizationTeamsAvailabilityMessage && (
          <div className="error-state">{organizationTeamsAvailabilityMessage}</div>
        )}
        {routeKind === "organizations" && organizationTeamsError && (
          <div className="error-state">Could not load visible teams.</div>
        )}
        {routeKind === "organizations" && !canExpandOrganizationTeams && organizationTeamsLimitHit && (
          <div className="muted-row">
            Showing the first {organizationTeams.length} teams returned by GitHub.
          </div>
        )}
        {routeKind === "organizations" &&
          filteredOrganizationTeams.map((team) => (
            <div
              className={`issue-row organization-team-row ${
                team.slug === selectedOrganizationTeam?.slug ? "selected-action" : ""
              }`}
              key={team.id}
            >
              <button
                className="organization-row-main"
                type="button"
                onClick={() => onSelectOrganizationTeam(team.slug)}
              >
                <div>
                  <strong>{team.name}</strong>
                  <small>
                    {team.slug} · {team.privacy ?? "team"} · {team.permission ?? "permission unknown"} ·{" "}
                    {formatCompactNumber(team.memberCount ?? 0)} members ·{" "}
                    {formatCompactNumber(team.repositoryCount ?? 0)} repositories
                  </small>
                  {team.parent && <small>Parent team: {team.parent.name}</small>}
                  {team.description && <small>{team.description}</small>}
                </div>
              </button>
              <button
                className="pin-row-button"
                type="button"
                aria-label={`Open ${team.name} on GitHub`}
                disabled={!team.htmlUrl}
                title={team.htmlUrl ? `Open ${team.name} on GitHub` : "Team URL unavailable."}
                onClick={() => {
                  if (team.htmlUrl) {
                    onOpenExternal(team.htmlUrl);
                  }
                }}
              >
                <ExternalLink size={15} />
              </button>
            </div>
          ))}
        {routeKind === "organizations" && selectedOrganizationTeam && (
          <div className="section-title-row">
            <div className="collection-section-label">Selected team members</div>
            {canExpandOrganizationTeamMembers && (
              <button type="button" onClick={onExpandOrganizationTeamMembers}>
                Load more team members
              </button>
            )}
          </div>
        )}
        {routeKind === "organizations" &&
          organizationTeamMembersLoading &&
          organizationTeamMembers.length === 0 && <div className="loading-state">Loading team members…</div>}
        {routeKind === "organizations" && organizationTeamMembersAvailabilityMessage && (
          <div className="error-state">{organizationTeamMembersAvailabilityMessage}</div>
        )}
        {routeKind === "organizations" && organizationTeamMembersError && (
          <div className="error-state">Could not load team members.</div>
        )}
        {routeKind === "organizations" &&
          !canExpandOrganizationTeamMembers &&
          organizationTeamMembersLimitHit && (
            <div className="muted-row">
              Showing the first {organizationTeamMembers.length} team members returned by GitHub.
            </div>
          )}
        {routeKind === "organizations" &&
          filteredOrganizationTeamMembers.map((member) => (
            <div
              className={`issue-row organization-member-row ${
                member.login === selectedOrganizationMember?.login ? "selected-action" : ""
              }`}
              key={`team-member-${member.id}`}
            >
              <button
                className="organization-member-row-main"
                type="button"
                aria-pressed={member.login === selectedOrganizationMember?.login}
                onClick={() => onSelectOrganizationMember(member.login)}
                title={`View @${member.login} in Control`}
              >
                {member.avatarUrl ? (
                  <img className="repo-avatar" src={member.avatarUrl} alt="" />
                ) : (
                  <span className="repo-avatar">{member.login.slice(0, 1).toUpperCase()}</span>
                )}
                <div>
                  <strong>{member.login}</strong>
                  <small>{member.siteAdmin ? "site admin" : "member"}</small>
                </div>
              </button>
              <button
                className="pin-row-button"
                type="button"
                aria-label={`Open ${member.login} on GitHub`}
                disabled={!member.htmlUrl}
                title={member.htmlUrl ? `Open ${member.login} on GitHub` : "Member profile URL unavailable."}
                onClick={() => {
                  if (member.htmlUrl) {
                    onOpenExternal(member.htmlUrl);
                  }
                }}
              >
                <ExternalLink size={15} />
              </button>
            </div>
          ))}
        {routeKind === "organizations" &&
          selectedOrganizationTeam &&
          !organizationTeamMembersLoading &&
          !organizationTeamMembersError &&
          !organizationTeamMembersAvailabilityMessage &&
          filteredOrganizationTeamMembers.length === 0 && (
            <div className="empty-state">
              {organizationTeamMembers.length === 0
                ? "No visible team members returned."
                : "No team members match this filter."}
            </div>
          )}
        {routeKind === "organizations" && selectedOrganizationTeam && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationTeam.name} repositories</div>
            {canExpandOrganizationTeamRepositories && (
              <button type="button" onClick={onExpandOrganizationTeamRepositories}>
                Load more team repositories
              </button>
            )}
          </div>
        )}
        {routeKind === "organizations" &&
          organizationTeamRepositoriesLoading &&
          organizationTeamRepositories.length === 0 && (
            <div className="loading-state">Loading team repositories…</div>
          )}
        {routeKind === "organizations" && organizationTeamRepositoriesAvailabilityMessage && (
          <div className="error-state">{organizationTeamRepositoriesAvailabilityMessage}</div>
        )}
        {routeKind === "organizations" && organizationTeamRepositoriesError && (
          <div className="error-state">Could not load team repositories.</div>
        )}
        {routeKind === "organizations" &&
          !canExpandOrganizationTeamRepositories &&
          organizationTeamRepositoriesLimitHit && (
            <div className="muted-row">
              Showing the first {organizationTeamRepositories.length} team repositories returned by GitHub.
            </div>
          )}
        {routeKind === "organizations" &&
          filteredOrganizationTeamRepositories.map((repository) => {
            const pinned = pinnedRepositoryNames.some(
              (nameWithOwner) => nameWithOwner.toLowerCase() === repository.nameWithOwner.toLowerCase()
            );
            const metadataParts = organizationRepositoryCollectionMetadataParts(repository);
            const chips = organizationRepositoryCollectionChips(repository, pinned);

            return (
              <div
                className="issue-row repository-row repository-row-with-actions"
                key={`team-repository-${repository.id}`}
              >
                <button
                  className="repository-row-main"
                  type="button"
                  onClick={() => onOpenRepository(repository.nameWithOwner)}
                >
                  <span className="repo-avatar">{repository.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{repository.name}</strong>
                    <small>{[repository.description, ...metadataParts].filter(Boolean).join(" · ")}</small>
                  </div>
                  <span className="row-chip-stack">
                    {chips.map((chip) => (
                      <span className="state-chip" key={`${repository.id}-${chip}`}>
                        {chip}
                      </span>
                    ))}
                  </span>
                </button>
                <span className="row-action-stack">
                  <button
                    className={`pin-row-button ${pinned ? "selected-action" : ""}`}
                    type="button"
                    aria-label={`${pinned ? "Unpin" : "Pin"} ${repository.name}`}
                    aria-pressed={pinned}
                    disabled={Boolean(repositoryPinDisabledReason)}
                    title={
                      repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.nameWithOwner}`
                    }
                    onClick={() => onToggleRepositoryPin(repository.nameWithOwner)}
                  >
                    <Pin size={15} />
                  </button>
                  <button
                    className="pin-row-button"
                    type="button"
                    aria-label={`Open GitHub fallback for ${repository.name}`}
                    title={`Open GitHub fallback for ${repository.name}`}
                    onClick={() => onOpenExternal(repository.htmlUrl)}
                  >
                    <ExternalLink size={15} />
                  </button>
                </span>
              </div>
            );
          })}
        {routeKind === "organizations" &&
          selectedOrganizationTeam &&
          !organizationTeamRepositoriesLoading &&
          !organizationTeamRepositoriesError &&
          !organizationTeamRepositoriesAvailabilityMessage &&
          filteredOrganizationTeamRepositories.length === 0 && (
            <div className="empty-state">
              {organizationTeamRepositories.length === 0
                ? "No repositories returned for this team."
                : "No team repositories match this filter."}
            </div>
          )}
        {routeKind === "mailbox" &&
          !notificationsLoading &&
          !notificationsError &&
          !workRowsLoading &&
          workRowErrors.length === 0 &&
          filteredNotifications.length === 0 &&
          filteredWorkRows.length === 0 && (
            <div className="empty-state">
              {notifications.length === 0 && workRows.length === 0
                ? "No GitHub notifications or open account work."
                : "No mailbox items match this filter."}
            </div>
          )}
        {routeKind === "organizations" &&
          !organizationsLoading &&
          !organizationsError &&
          !organizationsAvailabilityMessage &&
          filteredOrganizations.length === 0 && (
            <div className="empty-state">
              {organizations.length === 0
                ? "No GitHub organizations returned."
                : "No organizations match this filter."}
            </div>
          )}
        {routeKind === "organizations" && organizationsLoading && organizations.length === 0 && (
          <div className="loading-state">Loading GitHub organizations…</div>
        )}
        {routeKind === "organizations" && organizationsError && (
          <div className="error-state">Could not load GitHub organizations.</div>
        )}
        {routeKind === "organizations" && organizationsAvailabilityMessage && (
          <div className="error-state">{organizationsAvailabilityMessage}</div>
        )}
        {routeKind === "organizations" &&
          organizations.length > 0 &&
          !organizationTeamsLoading &&
          !organizationTeamsError &&
          !organizationTeamsAvailabilityMessage &&
          filteredOrganizationTeams.length === 0 && (
            <div className="empty-state">
              {organizationTeams.length === 0
                ? "No visible teams returned for this organization."
                : "No teams match this filter."}
            </div>
          )}
      </div>
    </section>
  );
}
