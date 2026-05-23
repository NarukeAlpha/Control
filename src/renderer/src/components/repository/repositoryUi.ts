import type {
  DiscussionSummary,
  GitHubAction,
  GitHubReadAvailability,
  IssueSummary,
  LanguageStat,
  ProjectSummary,
  PullRequestSummary,
  ReleaseSummary,
  RepositoryDetail,
  RepositoryCollaboratorSummary,
  RepositoryRef,
  RepositorySummary
} from "@shared/github";
import { formatCompactNumber, formatRelativeDate } from "../../utils/format";

export const defaultContributorLimit = 24;
export const maxContributorLimit = 100;
export const defaultContributorProfileRepositoryLimit = 12;
export const maxProfileRepositoryLimit = 100;

export function repositoryPath(repository: RepositoryDetail, path = ""): string {
  return `${repository.htmlUrl}${path}`;
}

export function getRepositoryCounts(
  repository: RepositoryDetail,
  fallback: {
    issues: IssueSummary[];
    pulls: PullRequestSummary[];
    discussions: DiscussionSummary[];
    projects: ProjectSummary[];
    releases?: ReleaseSummary[];
  }
): Record<
  "stars" | "forks" | "watchers" | "issues" | "pulls" | "discussions" | "projects" | "releases",
  number
> {
  const counts = repository.counts;

  return {
    stars: counts.stars,
    forks: counts.forks,
    watchers: counts.watchers,
    issues: counts.openIssues,
    pulls: counts.openPullRequests,
    discussions: counts.discussions,
    projects: counts.projects,
    releases: counts.releases || fallback.releases?.length || 0
  };
}

export function normalizeLanguageStats(repository: RepositoryDetail): LanguageStat[] {
  if (repository.languages.length > 0) {
    return repository.languages;
  }

  return repository.primaryLanguage
    ? [
        {
          name: repository.primaryLanguage.name,
          color: repository.primaryLanguage.color,
          size: 0,
          percent: 100
        }
      ]
    : [];
}

export function languageTotalLabel(languages: LanguageStat[]): string | null {
  const total = languages.reduce((sum, language) => sum + language.size, 0);
  if (total <= 0) {
    return null;
  }

  return `${formatCompactNumber(total)} bytes`;
}

export function normalizedSearchParts(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function fieldsMatchSearchParts(
  fields: Array<string | number | null | undefined>,
  parts: string[]
): boolean {
  if (parts.length === 0) {
    return true;
  }

  const haystack = fields
    .filter((field): field is string | number => field !== null && field !== undefined)
    .map(String)
    .join(" ")
    .toLowerCase();

  return parts.every((part) => haystack.includes(part));
}

export function readAvailabilityMessage(
  feature: string,
  availability: GitHubReadAvailability | null
): string | null {
  if (!availability || availability.status === "available") {
    return null;
  }

  const reason =
    availability.status === "feature_disabled"
      ? `${feature} is disabled or not enabled for this repository.`
      : availability.status === "not_loaded"
        ? `${feature} was not loaded.`
        : availability.status === "stale"
          ? `${feature} is showing cached data.`
          : availability.status === "permission_denied"
            ? `The current GitHub token cannot access ${feature.toLowerCase()}.`
            : availability.status === "rate_limited"
              ? `GitHub rate-limited the ${feature.toLowerCase()} request.`
              : availability.status === "graphql_error"
                ? `GitHub returned a GraphQL error for ${feature.toLowerCase()}.`
                : `${feature} could not be loaded.`;

  return availability.message ? `${reason} ${availability.message}` : reason;
}

export function readAvailabilityStatusLabel(availability: GitHubReadAvailability | null): string | null {
  if (!availability || availability.status === "available") {
    return null;
  }

  if (availability.status === "feature_disabled") {
    return "not enabled";
  }
  if (availability.status === "not_loaded") {
    return "not loaded";
  }
  if (availability.status === "stale") {
    return "stale";
  }
  if (availability.status === "permission_denied") {
    return "no access";
  }
  if (availability.status === "rate_limited") {
    return "rate limited";
  }
  if (availability.status === "graphql_error") {
    return "GraphQL error";
  }

  return "unavailable";
}

export function repositoryMutationDisabledReason(repository: RepositoryDetail): string | null {
  if (repository.permissions.isDisabled) {
    return "Repository is disabled.";
  }
  if (repository.permissions.isArchived) {
    return "Repository is archived.";
  }
  return null;
}

export function accessRoleLabel(role: string | null): string {
  return role ? role.replace(/[_-]/g, " ") : "access";
}

export function collaboratorRoleLabel(collaborator: RepositoryCollaboratorSummary): string {
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

function unknownableCompactNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "unknown" : formatCompactNumber(value);
}

export function repositoryForkMetadataLabel(repository: RepositoryRef): string {
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

const githubActionLabels: Record<GitHubAction, string> = {
  star: "Star repository",
  unstar: "Unstar repository",
  watch: "Watch repository",
  unwatch: "Unwatch repository",
  fork: "Fork repository",
  editRepository: "Update repository settings",
  createIssue: "Create issue",
  editIssue: "Edit issue",
  closeIssue: "Close issue",
  reopenIssue: "Reopen issue",
  addComment: "Add comment",
  editComment: "Edit comment",
  deleteComment: "Delete comment",
  editReviewComment: "Edit review comment",
  deleteReviewComment: "Delete review comment",
  addLabels: "Add labels",
  removeLabel: "Remove label",
  setAssignees: "Update assignees",
  removeAssignees: "Remove assignees",
  mergePullRequest: "Merge pull request",
  createPullRequest: "Create pull request",
  closePullRequest: "Close pull request",
  reopenPullRequest: "Reopen pull request",
  approvePullRequest: "Approve pull request",
  commentPullRequestReview: "Comment on pull request review",
  requestChanges: "Request pull request changes",
  requestReviewers: "Request reviewers",
  removeReviewers: "Remove reviewers",
  rerunWorkflow: "Rerun workflow",
  rerunFailedWorkflowJobs: "Rerun failed workflow jobs",
  rerunWorkflowJob: "Rerun workflow job",
  dispatchWorkflow: "Dispatch workflow",
  cancelWorkflow: "Cancel workflow",
  createRelease: "Create release",
  editRelease: "Edit release",
  deleteRelease: "Delete release",
  deleteReleaseAsset: "Delete release asset",
  updateBranchProtection: "Update branch protection",
  deleteBranchProtection: "Delete branch protection",
  addRepositoryCollaborator: "Add repository collaborator",
  removeRepositoryCollaborator: "Remove repository collaborator",
  updateCollaboratorPermission: "Update collaborator permission",
  addRepositoryTeam: "Add repository team",
  removeRepositoryTeam: "Remove repository team",
  updateTeamPermission: "Update team permission",
  createRepositoryRuleset: "Create repository ruleset",
  updateRepositoryRuleset: "Update repository ruleset",
  deleteRepositoryRuleset: "Delete repository ruleset",
  createDiscussion: "Create discussion",
  editDiscussion: "Edit discussion",
  closeDiscussion: "Close discussion",
  reopenDiscussion: "Reopen discussion",
  addDiscussionComment: "Add discussion comment",
  editDiscussionComment: "Edit discussion comment",
  deleteDiscussionComment: "Delete discussion comment",
  createProjectV2: "Create project",
  updateProjectV2: "Update project",
  deleteProjectV2: "Delete project",
  addProjectV2Item: "Add project item",
  updateProjectV2Item: "Update project item",
  deleteProjectV2Item: "Delete project item",
  createWikiPage: "Create wiki page",
  editWikiPage: "Edit wiki page",
  deleteWikiPage: "Delete wiki page"
};

export function githubActionLabel(action: GitHubAction | null): string {
  return action ? githubActionLabels[action] : "GitHub action";
}

export function repositoryCollectionMetadataParts(repository: RepositorySummary): string[] {
  const counts = repository.counts;
  const stars = counts.stars;
  const forks = counts.forks;
  const watchers = counts.watchers;
  const openIssues = counts.openIssues;
  const nameWithOwner = repository.nameWithOwner.includes("/")
    ? repository.nameWithOwner
    : `${repository.owner}/${repository.name}`;
  const parts = [
    nameWithOwner,
    repository.primaryLanguage?.name ?? null,
    repository.defaultBranch ? `default ${repository.defaultBranch}` : null,
    stars > 0 ? `${formatCompactNumber(stars)} stars` : null,
    forks > 0 ? `${formatCompactNumber(forks)} forks` : null,
    openIssues > 0 ? `${formatCompactNumber(openIssues)} issues` : null,
    watchers > 0 ? `${formatCompactNumber(watchers)} watching` : null,
    repository.pushedAt ? `pushed ${formatRelativeDate(repository.pushedAt)}` : null,
    repository.updatedAt && repository.updatedAt !== repository.pushedAt
      ? `updated ${formatRelativeDate(repository.updatedAt)}`
      : null
  ];

  return parts.filter((part): part is string => Boolean(part));
}
