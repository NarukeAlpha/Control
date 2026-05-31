import type {
  ContributorSummary,
  DiscussionSummary,
  IssueSummary,
  NotificationSummary,
  OrganizationSummary,
  ProjectSummary,
  PullRequestLinkedIssueSummary,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  ReleaseAssetSummary,
  ReleaseSummary,
  RepositoryDetail,
  RepositorySummary,
  TeamSummary,
  WorkflowRunArtifactSummary,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import type { LocalRecentItem, LocalRecentRecordInput, LocalRecentSecurityItemKind } from "@shared/local";
import { encodeRepositoryPath, normalizeCodeLineNumber } from "../code-browser/codeBrowserUi";
import {
  notificationReasonLabel,
  notificationTargetUrl,
  type NotificationInAppTarget
} from "../collection/notificationUi";
import {
  commitRecentAuthoredDate,
  commitRecentAuthorName,
  commitRecentCommittedDate,
  commitRecentHeadline,
  type CommitRecentCommit
} from "../repository/commitRecent";
import { repoTabs } from "../repository/repositoryTabs";
import type { RepositoryTab } from "../../stores/uiStore";
import { formatCompactNumber } from "../../utils/format";

export type PullRequestLinkedIssue =
  | NonNullable<PullRequestTimelineEventSummary["sourceIssue"]>
  | PullRequestLinkedIssueSummary;

export interface SecurityItemRecentInput {
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

export function repositoryRecentInput(
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

export function contributorRecentInput(
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

export function organizationRecentInput(organization: OrganizationSummary): LocalRecentRecordInput {
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

export function teamRecentInput(team: TeamSummary): LocalRecentRecordInput {
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

export function fileRecentInput({
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

export function commitRecentInput({
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

export function issueRecentInput(nameWithOwner: string, issue: IssueSummary): LocalRecentRecordInput {
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

export function issueReferenceRecentInput(
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

export function linkedIssueRecentInput(
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

export function pullRequestRecentInput(
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

export function pullRequestReferenceRecentInput(
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

export function workflowRunRecentInput(
  nameWithOwner: string,
  run: WorkflowRunSummary
): LocalRecentRecordInput {
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

export function workflowRunReferenceRecentInput(
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

export function workflowArtifactRecentInput(
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

export function wikiPageRecentInput(
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

export function securityItemRecentInput(
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

export function releaseRecentInput(nameWithOwner: string, release: ReleaseSummary): LocalRecentRecordInput {
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

export function releaseTagReferenceRecentInput(
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

export function releaseAssetRecentInput(
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

export function discussionRecentInput(
  nameWithOwner: string,
  discussion: DiscussionSummary
): LocalRecentRecordInput {
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

export function discussionReferenceRecentInput(
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

export function projectRecentInput(nameWithOwner: string, project: ProjectSummary): LocalRecentRecordInput {
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

export function organizationProjectRecentInput(
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

export function notificationRecentInput(
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

export function recentItemRecordInput(item: LocalRecentItem): LocalRecentRecordInput {
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

export function recentMetadataString(item: LocalRecentItem, key: string): string | null {
  const value = item.metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function recentMetadataNumber(item: LocalRecentItem, key: string): number | null {
  const value = item.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function recentMetadataKeyword(item: LocalRecentItem, key: string): string {
  const value = item.metadata[key];
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

export function recentMetadataBooleanKeyword(item: LocalRecentItem, key: string): string {
  const value = item.metadata[key];
  return typeof value === "boolean" ? (value ? key : `not ${key}`) : "";
}
