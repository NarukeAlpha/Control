import {
  BookOpen,
  Building2,
  CircleDot,
  Code2,
  Download,
  File as FileIcon,
  GitBranch,
  GitPullRequest,
  Inbox,
  MessageSquare,
  Pin,
  ShieldCheck,
  SquareKanban,
  Tag,
  Users,
  Workflow
} from "lucide-react";

import type { RepositorySummary } from "@shared/github";
import type {
  BranchSummary,
  OrganizationMemberSummary,
  OrganizationRepositorySummary,
  OrganizationSummary,
  IssueSummary,
  NotificationSummary,
  ProjectSummary,
  PullRequestSummary,
  RepositoryWikiResult,
  TagSummary,
  TeamSummary
} from "@shared/github";
import type { QueryClient } from "@tanstack/react-query";
import type { ContributorSummary, DiscussionSummary, WikiPageContent, WikiPageSummary } from "@shared/github";
import type { LocalRecentItem } from "@shared/local";
import type { CommandPaletteItem } from "./CommandPalette";
import {
  displayRepositoryName,
  displayRepositoryShortcutName,
  repositoryShortcutsFromPins
} from "../repository/repositorySearch";
import {
  recentMetadataBooleanKeyword,
  recentMetadataKeyword,
  recentMetadataString
} from "../recent/recentRecordInputs";
import { issueStateLabel } from "../collection/workItemUi";
import { notificationInAppTarget, notificationReasonLabel } from "../collection/notificationUi";
import { repositoryNameWithOwnerFromGitHubUrl } from "../repository/githubUrlRoutes";
import { formatCompactNumber } from "../../utils/format";

export function cachedRepositoryWikiPages(
  queryClient: QueryClient,
  nameWithOwner: string
): Array<WikiPageSummary | WikiPageContent> {
  const [wikiOwner, wikiRepo] = nameWithOwner.split("/");
  const cachedWikiPagesByPath = new Map<string, WikiPageSummary | WikiPageContent>();
  if (!wikiOwner || !wikiRepo) {
    return [];
  }

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

  return [...cachedWikiPagesByPath.values()];
}

export function appendPinnedRepositoryCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    pinnedRepositoryNames: string[];
    repositoryItems: RepositorySummary[];
    viewerLogin: string | null;
    onOpenRepository(nameWithOwner: string): void;
  }
): void {
  for (const repositoryShortcut of repositoryShortcutsFromPins(
    input.pinnedRepositoryNames,
    input.repositoryItems
  )) {
    items.push({
      id: `pinned-${repositoryShortcut.nameWithOwner}`,
      title: displayRepositoryShortcutName(repositoryShortcut, input.viewerLogin),
      subtitle: repositoryShortcut.description ?? repositoryShortcut.nameWithOwner,
      group: "Pinned",
      icon: Pin,
      keywords: [
        repositoryShortcut.nameWithOwner,
        repositoryShortcut.owner,
        repositoryShortcut.name,
        repositoryShortcut.primaryLanguage?.name ?? ""
      ],
      run: () => input.onOpenRepository(repositoryShortcut.nameWithOwner)
    });
  }
}

export function appendRecentCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    recentItems: LocalRecentItem[];
    onOpenRecent(item: LocalRecentItem): void;
  }
): void {
  for (const recent of input.recentItems) {
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
      run: () => input.onOpenRecent(recent)
    });
  }
}

export function appendRepositoryCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    repositoryItems: RepositorySummary[];
    viewerLogin: string | null;
    onOpenRepository(nameWithOwner: string): void;
  }
): void {
  for (const repositorySummary of input.repositoryItems) {
    items.push({
      id: `repository-${repositorySummary.nameWithOwner}`,
      title: displayRepositoryName(repositorySummary, input.viewerLogin),
      subtitle: repositorySummary.description ?? repositorySummary.nameWithOwner,
      group: "Repositories",
      icon: Code2,
      keywords: [
        repositorySummary.nameWithOwner,
        repositorySummary.owner,
        repositorySummary.name,
        repositorySummary.primaryLanguage?.name ?? ""
      ],
      run: () => input.onOpenRepository(repositorySummary.nameWithOwner)
    });
  }
}

export function appendOrganizationCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    organizationItems: OrganizationSummary[];
    organizationTeams: TeamSummary[];
    organizationRepositories: OrganizationRepositorySummary[];
    organizationTeamRepositories: OrganizationRepositorySummary[];
    organizationProjects: ProjectSummary[];
    organizationMembers: OrganizationMemberSummary[];
    organizationTeamMembers: OrganizationMemberSummary[];
    selectedOrganization: OrganizationSummary | null;
    selectedOrganizationTeam: TeamSummary | null;
    generalSourceLimit: number;
    denseSourceLimit: number;
    onOpenOrganization(organization: OrganizationSummary): void;
    onOpenTeam(team: TeamSummary): void;
    onOpenRepository(nameWithOwner: string): void;
    onOpenOrganizationMember(organization: OrganizationSummary, member: OrganizationMemberSummary): void;
    onOpenOrganizationTeamMember(
      organization: OrganizationSummary,
      team: TeamSummary,
      member: OrganizationMemberSummary
    ): void;
    onSelectOrganizationProject(organization: OrganizationSummary, project: ProjectSummary): void;
  }
): void {
  for (const organization of input.organizationItems.slice(0, input.generalSourceLimit)) {
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
      run: () => input.onOpenOrganization(organization)
    });
  }

  for (const team of input.organizationTeams.slice(0, input.generalSourceLimit)) {
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
      run: () => input.onOpenTeam(team)
    });
  }

  if (input.selectedOrganization) {
    for (const repository of input.organizationRepositories.slice(0, input.generalSourceLimit)) {
      items.push({
        id: `organization-repository-${input.selectedOrganization.login}-${repository.id}`,
        title: repository.name,
        subtitle: `${repository.nameWithOwner} · ${repository.permission ?? "permission unknown"} · ${
          repository.visibility?.toLowerCase() ?? "visibility unknown"
        }`,
        group: "Organization repositories",
        icon: Code2,
        keywords: [
          input.selectedOrganization.login,
          input.selectedOrganization.name ?? "",
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
        run: () => input.onOpenRepository(repository.nameWithOwner)
      });
    }
  }

  if (input.selectedOrganization && input.selectedOrganizationTeam) {
    for (const repository of input.organizationTeamRepositories.slice(0, input.generalSourceLimit)) {
      items.push({
        id: `organization-team-repository-${input.selectedOrganization.login}-${input.selectedOrganizationTeam.slug}-${repository.id}`,
        title: repository.name,
        subtitle: `${input.selectedOrganizationTeam.name} · ${repository.nameWithOwner} · ${
          repository.permission ?? "permission unknown"
        } · ${repository.visibility?.toLowerCase() ?? "visibility unknown"}`,
        group: "Organization repositories",
        icon: Code2,
        keywords: [
          input.selectedOrganization.login,
          input.selectedOrganization.name ?? "",
          input.selectedOrganizationTeam.name,
          input.selectedOrganizationTeam.slug,
          input.selectedOrganizationTeam.privacy ?? "",
          input.selectedOrganizationTeam.permission ?? "",
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
        run: () => input.onOpenRepository(repository.nameWithOwner)
      });
    }
  }

  if (input.selectedOrganization) {
    for (const project of input.organizationProjects.slice(0, input.generalSourceLimit)) {
      items.push({
        id: `organization-project-${input.selectedOrganization.login}-${project.id}`,
        title: project.number ? `#${project.number} ${project.title}` : project.title,
        subtitle: `${input.selectedOrganization.login} project · ${project.closed ? "closed" : "open"} · ${
          project.isPublic === null ? "visibility unknown" : project.isPublic ? "public" : "private"
        }`,
        group: "Organization projects",
        icon: SquareKanban,
        keywords: [
          input.selectedOrganization.login,
          input.selectedOrganization.name ?? "",
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
        run: () =>
          input.onSelectOrganizationProject(input.selectedOrganization as OrganizationSummary, project)
      });
    }
  }

  if (input.selectedOrganization) {
    for (const member of input.organizationMembers.slice(0, input.denseSourceLimit)) {
      items.push({
        id: `organization-member-${input.selectedOrganization.login}-${member.id}`,
        title: member.login,
        subtitle: `${input.selectedOrganization.login} member${member.siteAdmin ? " · site admin" : ""}`,
        group: "Organization members",
        icon: Users,
        keywords: [
          input.selectedOrganization.login,
          input.selectedOrganization.name ?? "",
          member.id,
          member.login,
          member.htmlUrl ?? "",
          member.avatarUrl ?? "",
          member.siteAdmin === null ? "" : member.siteAdmin ? "site admin" : "member"
        ],
        run: () => input.onOpenOrganizationMember(input.selectedOrganization as OrganizationSummary, member)
      });
    }
  }

  if (input.selectedOrganization && input.selectedOrganizationTeam) {
    for (const member of input.organizationTeamMembers.slice(0, input.denseSourceLimit)) {
      items.push({
        id: `organization-team-member-${input.selectedOrganization.login}-${input.selectedOrganizationTeam.slug}-${member.id}`,
        title: member.login,
        subtitle: `${input.selectedOrganizationTeam.name} member${member.siteAdmin ? " · site admin" : ""}`,
        group: "Organization members",
        icon: Users,
        keywords: [
          input.selectedOrganization.login,
          input.selectedOrganization.name ?? "",
          input.selectedOrganizationTeam.name,
          input.selectedOrganizationTeam.slug,
          input.selectedOrganizationTeam.privacy ?? "",
          input.selectedOrganizationTeam.permission ?? "",
          member.id,
          member.login,
          member.htmlUrl ?? "",
          member.avatarUrl ?? "",
          member.siteAdmin === null ? "" : member.siteAdmin ? "site admin" : "member"
        ],
        run: () =>
          input.onOpenOrganizationTeamMember(
            input.selectedOrganization as OrganizationSummary,
            input.selectedOrganizationTeam as TeamSummary,
            member
          )
      });
    }
  }
}

export function appendNotificationCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    notificationItems: NotificationSummary[];
    limit: number;
    onOpenNotification(notification: NotificationSummary): void;
  }
): void {
  for (const notification of input.notificationItems.slice(0, input.limit)) {
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
      run: () => input.onOpenNotification(notification)
    });
  }
}

export function appendAccountWorkCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    accountIssueItems: IssueSummary[];
    accountPullItems: PullRequestSummary[];
    limit: number;
    onOpenIssue(issue: IssueSummary): void;
    onOpenPullRequest(pullRequest: PullRequestSummary): void;
  }
): void {
  for (const issue of input.accountIssueItems.slice(0, input.limit)) {
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
      run: () => input.onOpenIssue(issue)
    });
  }

  for (const pullRequest of input.accountPullItems.slice(0, input.limit)) {
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
      run: () => input.onOpenPullRequest(pullRequest)
    });
  }
}

export function appendRepositoryContentCommandPaletteItems(
  items: CommandPaletteItem[],
  input: {
    effectiveRepository: string;
    branchItems: BranchSummary[];
    tagItems: TagSummary[];
    branchesLoaded: boolean;
    tagsLoaded: boolean;
    wikiPages: Array<WikiPageSummary | WikiPageContent>;
    discussionItems: DiscussionSummary[];
    projectItems: ProjectSummary[];
    contributorItems: ContributorSummary[];
    generalSourceLimit: number;
    denseSourceLimit: number;
    onSelectRepositoryRef(nameWithOwner: string, ref: string, refKind: "branch" | "tag"): void;
    onSelectWikiPage(nameWithOwner: string, page: WikiPageSummary | WikiPageContent): void;
    onSelectDiscussion(nameWithOwner: string, discussion: DiscussionSummary): void;
    onSelectProject(nameWithOwner: string, project: ProjectSummary): void;
    onSelectContributor(nameWithOwner: string, contributor: ContributorSummary): void;
  }
): void {
  if (input.branchesLoaded) {
    for (const branch of input.branchItems.slice(0, input.generalSourceLimit)) {
      items.push({
        id: `reference-branch-${input.effectiveRepository}-${branch.name}`,
        title: branch.name,
        subtitle: `${input.effectiveRepository} branch · ${branch.commitSha.slice(0, 7)}${branch.protected ? " · protected" : ""}`,
        group: "References",
        icon: GitBranch,
        keywords: [
          branch.name,
          "branch",
          input.effectiveRepository,
          branch.commitSha,
          branch.protected ? "protected" : ""
        ],
        run: () => input.onSelectRepositoryRef(input.effectiveRepository, branch.name, "branch")
      });
    }
  }

  if (input.tagsLoaded) {
    for (const tag of input.tagItems.slice(0, input.generalSourceLimit)) {
      items.push({
        id: `reference-tag-${input.effectiveRepository}-${tag.name}`,
        title: tag.name,
        subtitle: `${input.effectiveRepository} tag · ${tag.commitSha.slice(0, 7)}`,
        group: "References",
        icon: Tag,
        keywords: [tag.name, "tag", input.effectiveRepository, tag.commitSha],
        run: () => input.onSelectRepositoryRef(input.effectiveRepository, tag.name, "tag")
      });
    }
  }

  for (const page of input.wikiPages) {
    items.push({
      id: `wiki-page-${input.effectiveRepository}-${page.path}`,
      title: page.title,
      subtitle: `${input.effectiveRepository} wiki · ${page.path}`,
      group: "Wiki pages",
      icon: BookOpen,
      keywords: [
        input.effectiveRepository,
        "wiki",
        "docs",
        "documentation",
        page.title,
        page.path,
        page.sha,
        page.htmlUrl ?? "",
        page.size === null ? "" : String(page.size)
      ],
      run: () => input.onSelectWikiPage(input.effectiveRepository, page)
    });
  }

  for (const discussion of input.discussionItems.slice(0, input.generalSourceLimit)) {
    items.push({
      id: `repository-discussion-${input.effectiveRepository}-${discussion.number}`,
      title: `#${discussion.number} ${discussion.title}`,
      subtitle: `${input.effectiveRepository} discussion · ${discussion.category ?? "uncategorized"} · ${
        discussion.closed ? "closed" : "open"
      }`,
      group: "Repository items",
      icon: MessageSquare,
      keywords: [
        discussion.title,
        input.effectiveRepository,
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
      run: () => input.onSelectDiscussion(input.effectiveRepository, discussion)
    });
  }

  for (const project of input.projectItems.slice(0, input.generalSourceLimit)) {
    items.push({
      id: `repository-project-${input.effectiveRepository}-${project.id}`,
      title: project.number ? `#${project.number} ${project.title}` : project.title,
      subtitle: `${input.effectiveRepository} project · ${project.closed ? "closed" : "open"}${
        project.ownerLogin ? ` · ${project.ownerLogin}` : ""
      }`,
      group: "Repository items",
      icon: SquareKanban,
      keywords: [
        project.title,
        input.effectiveRepository,
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
      run: () => input.onSelectProject(input.effectiveRepository, project)
    });
  }

  for (const contributor of input.contributorItems.slice(0, input.denseSourceLimit)) {
    const contributionCount = `${formatCompactNumber(contributor.contributions)} contributions`;
    items.push({
      id: `repository-contributor-${input.effectiveRepository}-${contributor.id}`,
      title: `@${contributor.login} in ${input.effectiveRepository}`,
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
        input.effectiveRepository,
        String(contributor.contributions),
        contributionCount
      ],
      run: () => input.onSelectContributor(input.effectiveRepository, contributor)
    });
  }
}
