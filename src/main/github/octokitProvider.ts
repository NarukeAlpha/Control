import { Octokit } from "octokit";

import type {
  AccountContributionListInput,
  AccountContributionListResult,
  AccountCommitContributionSummary,
  AccountIssueListInput,
  AccountIssueListResult,
  AccountProfileInput,
  AccountProfileResult,
  AccountPullRequestListInput,
  AccountPullRequestListResult,
  AccountRepositoryInput,
  AccountRepositoryListResult,
  ActionsInput,
  AssignableUserListInput,
  AssignableUserListResult,
  AssignableUserSummary,
  BranchListInput,
  BranchListResult,
  BranchProtectionInput,
  BranchProtectionResult,
  BranchSummary,
  CodeScanningAlertsInput,
  CodeScanningAlertsResult,
  ContributorsInput,
  ContributorListResult,
  ContributorSummary,
  DependabotAlertsInput,
  DependabotAlertsResult,
  DiscussionCategoryListInput,
  DiscussionCategoryListResult,
  DiscussionDetailInput,
  DiscussionDetailResult,
  DiscussionListInput,
  DiscussionListResult,
  DiscussionSummary,
  GitHubReadAvailability,
  GitHubAccountProfile,
  GitHubMutationInput,
  GitHubMutationResult,
  GitHubProvider,
  IssueDetail,
  IssueDetailInput,
  IssueDetailResult,
  IssueListInput,
  IssueListResult,
  IssueSummary,
  LabelSummary,
  MilestoneSummary,
  NotificationListResult,
  NotificationListInput,
  NotificationSummary,
  NotificationThreadInput,
  NotificationThreadMutationResult,
  OrganizationListInput,
  OrganizationListResult,
  OrganizationMembersInput,
  OrganizationMembersResult,
  OrganizationProjectsInput,
  OrganizationRepositoriesInput,
  OrganizationRepositoriesResult,
  OrganizationTeamMembersInput,
  OrganizationTeamMembersResult,
  OrganizationTeamRepositoriesInput,
  OrganizationTeamRepositoriesResult,
  OrganizationSummary,
  OrganizationTeamsInput,
  OrganizationTeamsResult,
  ProjectSummary,
  ProjectListResult,
  ProjectsInput,
  PullRequestDetail,
  PullRequestDetailResult,
  PullRequestDetailInput,
  PullRequestChecksInput,
  PullRequestChecksResult,
  PullRequestCommentsInput,
  PullRequestCommentsResult,
  PullRequestCommitsInput,
  PullRequestCommitsResult,
  PullRequestFilesInput,
  PullRequestFilesResult,
  PullRequestLinkedIssuesInput,
  PullRequestLinkedIssuesResult,
  PullRequestListInput,
  PullRequestListResult,
  PullRequestOverviewInput,
  PullRequestOverviewResult,
  PullRequestReviewThreadsInput,
  PullRequestReviewThreadsResult,
  PullRequestReviewsInput,
  PullRequestReviewsResult,
  PullRequestTimelineInput,
  PullRequestTimelineResult,
  PullRequestSummary,
  ReleaseDetailInput,
  ReleaseDetailResult,
  ReleaseSummary,
  ReleaseListResult,
  ReleasesInput,
  RepoContentsInput,
  RepoContentsResult,
  RepoEntry,
  RepoFileBlameInput,
  RepoFileBlameRange,
  RepoFileBlameResult,
  RepoFileContent,
  RepoFileContentInput,
  RepoFileContentResult,
  RepoListInput,
  RepoReadmeInput,
  RepoReadmeResult,
  RepoTreeInput,
  RepoTreeReadResult,
  RepoTreeResult,
  RepositoryAccessInput,
  RepositoryAccessResult,
  RepositoryCommitListInput,
  RepositoryCommitListResult,
  RepositoryCommitSummary,
  RepositoryCommunityProfileInput,
  RepositoryCommunityProfileResult,
  RepositoryWikiInput,
  RepositoryWikiResult,
  WikiPageSummary,
  RepositoryForksInput,
  RepositoryForksResult,
  RepositoryLabelListInput,
  RepositoryLabelListResult,
  RepositoryMilestoneListInput,
  RepositoryMilestoneListResult,
  RepositoryCollaboratorSummary,
  RepositoryDetail,
  RepositoryDetailResult,
  RepositoryRulesetsInput,
  RepositoryRulesetsResult,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityPolicyInput,
  RepositorySecurityPolicyResult,
  RepositoryListResult,
  RepositorySearchResult,
  RepositorySummary,
  SearchInput,
  SecretScanningAlertsInput,
  SecretScanningAlertsResult,
  TagListInput,
  TagListResult,
  TagSummary,
  TeamParentSummary,
  TeamSummary,
  Viewer,
  WorkflowDefinitionListResult,
  WorkflowDefinitionSummary,
  WorkflowJobLogsInput,
  WorkflowJobLogsResult,
  WorkflowListInput,
  WorkflowRunDetail,
  WorkflowRunDetailInput,
  WorkflowRunDetailResult,
  WorkflowRunListResult,
  WorkflowRunSummary
} from "@shared/github";
import { OctokitAccountDomain } from "./accountDomain";
import { OctokitContributorDomain } from "./contributorDomain";
import { OctokitDiscussionDomain } from "./discussionDomain";
import { OctokitIssueDomain } from "./issueDomain";
import { OctokitMutationDomain } from "./mutationDomain";
import { OctokitNotificationDomain } from "./notificationDomain";
import { OctokitOrganizationDomain } from "./organizationDomain";
import { OctokitProjectDomain } from "./projectDomain";
import { OctokitPullRequestDomain } from "./pullRequestDomain";
import { GitHubRequestLimiter } from "./rateLimit";
import { OctokitReleaseDomain } from "./releaseDomain";
import { OctokitRepositoryDomain } from "./repositoryDomain";
import { OctokitSearchDomain } from "./searchDomain";
import { OctokitSecurityDomain } from "./securityDomain";
import { OctokitWorkflowDomain } from "./workflowDomain";

const githubRestApiVersion = "2022-11-28";
const githubJsonAccept = "application/vnd.github+json";
export class OctokitProvider implements GitHubProvider {
  private readonly octokit: Octokit;
  private readonly requestLimiter = new GitHubRequestLimiter();
  private readonly accountDomain: OctokitAccountDomain;
  private readonly contributorDomain: OctokitContributorDomain;
  private readonly discussionDomain: OctokitDiscussionDomain;
  private readonly issueDomain: OctokitIssueDomain;
  private readonly mutationDomain: OctokitMutationDomain;
  private readonly notificationDomain: OctokitNotificationDomain;
  private readonly organizationDomain: OctokitOrganizationDomain;
  private readonly projectDomain: OctokitProjectDomain;
  private readonly repositoryDomain: OctokitRepositoryDomain;
  private readonly pullRequestDomain: OctokitPullRequestDomain;
  private readonly releaseDomain: OctokitReleaseDomain;
  private readonly securityDomain: OctokitSecurityDomain;
  private readonly searchDomain: OctokitSearchDomain;
  private readonly workflowDomain: OctokitWorkflowDomain;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      userAgent: "Control/0.1.0"
    });
    this.accountDomain = new OctokitAccountDomain(
      {
        graphql: (query, variables) => this.graphql(query, variables)
      },
      mapGitHubFeatureError
    );
    this.contributorDomain = new OctokitContributorDomain(
      {
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit)
      },
      mapGitHubFeatureError
    );
    this.discussionDomain = new OctokitDiscussionDomain(
      {
        graphql: (query, variables) => this.graphql(query, variables)
      },
      mapGitHubFeatureError
    );
    this.issueDomain = new OctokitIssueDomain(
      {
        rest: (route, params) => this.rest(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit)
      },
      mapGitHubFeatureError
    );
    this.mutationDomain = new OctokitMutationDomain({
      graphql: (query, variables) => this.graphql(query, variables),
      rest: (route, params) => this.rest(route, params)
    });
    this.notificationDomain = new OctokitNotificationDomain(
      {
        rest: (route, params) => this.rest(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit)
      },
      mapGitHubFeatureError
    );
    this.organizationDomain = new OctokitOrganizationDomain(
      {
        graphql: (query, variables) => this.graphql(query, variables),
        rest: (route, params) => this.rest(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit)
      },
      mapGitHubFeatureError
    );
    this.projectDomain = new OctokitProjectDomain(
      {
        graphql: (query, variables) => this.graphql(query, variables)
      },
      mapGitHubFeatureError
    );
    this.repositoryDomain = new OctokitRepositoryDomain(
      {
        graphql: (query, variables) => this.graphql(query, variables),
        rest: (route, params) => this.rest(route, params),
        restText: (route, params) => this.restText(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit)
      },
      mapGitHubFeatureError
    );
    this.pullRequestDomain = new OctokitPullRequestDomain(
      {
        graphql: (query, variables) => this.graphql(query, variables),
        rest: (route, params) => this.rest(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit),
        restPaginatedWrapped: (route, key, params, limit) =>
          this.restPaginatedWrapped(route, key, params, limit)
      },
      mapGitHubFeatureError
    );
    this.releaseDomain = new OctokitReleaseDomain(
      {
        rest: (route, params) => this.rest(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit)
      },
      mapGitHubFeatureError
    );
    this.securityDomain = new OctokitSecurityDomain(
      {
        rest: (route, params) => this.rest(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit)
      },
      mapGitHubFeatureError
    );
    this.searchDomain = new OctokitSearchDomain(
      {
        graphql: (query, variables) => this.graphql(query, variables)
      },
      mapGitHubFeatureError
    );
    this.workflowDomain = new OctokitWorkflowDomain(
      {
        rest: (route, params) => this.rest(route, params),
        restResponse: (route, params) => this.restResponse(route, params),
        restText: (route, params) => this.restText(route, params),
        restPaginatedArray: (route, params, limit) => this.restPaginatedArray(route, params, limit),
        restPaginatedWrapped: (route, key, params, limit) =>
          this.restPaginatedWrapped(route, key, params, limit)
      },
      mapGitHubFeatureError
    );
  }

  async getViewer(): Promise<Viewer> {
    return this.accountDomain.getViewer();
  }

  async getAccountProfile(input: AccountProfileInput = {}): Promise<GitHubAccountProfile> {
    return this.accountDomain.getAccountProfile(input);
  }

  async getAccountProfileWithStatus(input: AccountProfileInput = {}): Promise<AccountProfileResult> {
    return this.accountDomain.getAccountProfileWithStatus(input);
  }

  async listRepositories(input: RepoListInput = {}): Promise<RepositorySummary[]> {
    return this.repositoryDomain.listRepositories(input);
  }

  async listRepositoriesWithStatus(input: RepoListInput = {}): Promise<RepositoryListResult> {
    return this.repositoryDomain.listRepositoriesWithStatus(input);
  }

  async listAccountRepositories(input: AccountRepositoryInput = {}): Promise<RepositorySummary[]> {
    return this.accountDomain.listAccountRepositories(input);
  }

  async listAccountRepositoriesWithStatus(
    input: AccountRepositoryInput = {}
  ): Promise<AccountRepositoryListResult> {
    return this.accountDomain.listAccountRepositoriesWithStatus(input);
  }

  async listAccountContributions(
    input: AccountContributionListInput = {}
  ): Promise<AccountCommitContributionSummary[]> {
    return this.accountDomain.listAccountContributions(input);
  }

  async listAccountContributionsWithStatus(
    input: AccountContributionListInput = {}
  ): Promise<AccountContributionListResult> {
    return this.accountDomain.listAccountContributionsWithStatus(input);
  }

  async listOrganizations(input: OrganizationListInput = {}): Promise<OrganizationSummary[]> {
    return this.organizationDomain.listOrganizations(input);
  }

  async listOrganizationsWithStatus(input: OrganizationListInput = {}): Promise<OrganizationListResult> {
    return this.organizationDomain.listOrganizationsWithStatus(input);
  }

  async listOrganizationTeams(input: OrganizationTeamsInput): Promise<TeamSummary[]> {
    return this.organizationDomain.listOrganizationTeams(input);
  }

  async listOrganizationTeamsWithStatus(input: OrganizationTeamsInput): Promise<OrganizationTeamsResult> {
    return this.organizationDomain.listOrganizationTeamsWithStatus(input);
  }

  async listOrganizationRepositoriesWithStatus(
    input: OrganizationRepositoriesInput
  ): Promise<OrganizationRepositoriesResult> {
    return this.organizationDomain.listOrganizationRepositoriesWithStatus(input);
  }

  async listOrganizationTeamRepositoriesWithStatus(
    input: OrganizationTeamRepositoriesInput
  ): Promise<OrganizationTeamRepositoriesResult> {
    return this.organizationDomain.listOrganizationTeamRepositoriesWithStatus(input);
  }

  async listOrganizationTeamMembersWithStatus(
    input: OrganizationTeamMembersInput
  ): Promise<OrganizationTeamMembersResult> {
    return this.organizationDomain.listOrganizationTeamMembersWithStatus(input);
  }

  async listOrganizationMembersWithStatus(
    input: OrganizationMembersInput
  ): Promise<OrganizationMembersResult> {
    return this.organizationDomain.listOrganizationMembersWithStatus(input);
  }

  async listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult> {
    return this.projectDomain.listOrganizationProjectsWithStatus(input);
  }

  async listAccountIssues(input: AccountIssueListInput = {}): Promise<IssueSummary[]> {
    return this.accountDomain.listAccountIssues(input);
  }

  async listAccountIssuesWithStatus(input: AccountIssueListInput = {}): Promise<AccountIssueListResult> {
    return this.accountDomain.listAccountIssuesWithStatus(input);
  }

  async listAccountPullRequests(input: AccountPullRequestListInput = {}): Promise<PullRequestSummary[]> {
    return this.accountDomain.listAccountPullRequests(input);
  }

  async listAccountPullRequestsWithStatus(
    input: AccountPullRequestListInput = {}
  ): Promise<AccountPullRequestListResult> {
    return this.accountDomain.listAccountPullRequestsWithStatus(input);
  }

  async listNotifications(input: NotificationListInput = {}): Promise<NotificationSummary[]> {
    return this.notificationDomain.listNotifications(input);
  }

  async listNotificationsWithStatus(input: NotificationListInput = {}): Promise<NotificationListResult> {
    return this.notificationDomain.listNotificationsWithStatus(input);
  }

  async markNotificationThreadRead(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    return this.notificationDomain.markNotificationThreadRead(input);
  }

  async unsubscribeNotificationThread(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    return this.notificationDomain.unsubscribeNotificationThread(input);
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    return this.repositoryDomain.getRepository(owner, repo);
  }

  async getRepositoryWithStatus(owner: string, repo: string): Promise<RepositoryDetailResult> {
    return this.repositoryDomain.getRepositoryWithStatus(owner, repo);
  }

  async listBranches(input: BranchListInput): Promise<BranchSummary[]> {
    return this.repositoryDomain.listBranches(input);
  }

  async listBranchesWithStatus(input: BranchListInput): Promise<BranchListResult> {
    return this.repositoryDomain.listBranchesWithStatus(input);
  }

  async listTags(input: TagListInput): Promise<TagSummary[]> {
    return this.repositoryDomain.listTags(input);
  }

  async listTagsWithStatus(input: TagListInput): Promise<TagListResult> {
    return this.repositoryDomain.listTagsWithStatus(input);
  }

  async listTree(input: RepoTreeInput): Promise<RepoTreeResult> {
    return this.repositoryDomain.listTree(input);
  }

  async listTreeWithStatus(input: RepoTreeInput): Promise<RepoTreeReadResult> {
    return this.repositoryDomain.listTreeWithStatus(input);
  }

  async getReadme(input: RepoReadmeInput): Promise<RepoReadmeResult> {
    return this.repositoryDomain.getReadme(input);
  }

  async listContents(input: RepoContentsInput): Promise<RepoEntry[]> {
    return this.repositoryDomain.listContents(input);
  }

  async listContentsWithStatus(input: RepoContentsInput): Promise<RepoContentsResult> {
    return this.repositoryDomain.listContentsWithStatus(input);
  }

  async getFileContent(input: RepoFileContentInput): Promise<RepoFileContent> {
    return this.repositoryDomain.getFileContent(input);
  }

  async getFileContentWithStatus(input: RepoFileContentInput): Promise<RepoFileContentResult> {
    return this.repositoryDomain.getFileContentWithStatus(input);
  }

  async getFileBlame(input: RepoFileBlameInput): Promise<RepoFileBlameResult> {
    const maxRanges = Math.min(Math.max(input.maxRanges ?? 20, 1), 100);
    const ref = input.ref ?? "HEAD";
    const expression = `${ref}:${input.path}`;

    try {
      const data = await this.graphql<{
        repository: {
          object: GitHubBlobBlameNode | null;
        } | null;
      }>(
        `
        query FileBlame($owner: String!, $repo: String!, $expression: String!) {
          repository(owner: $owner, name: $repo) {
            object(expression: $expression) {
              ... on Blob {
                blame {
                  ranges {
                    startingLine
                    endingLine
                    age
                    commit {
                      oid
                      messageHeadline
                      url
                      authoredDate
                      committedDate
                      author {
                        name
                        date
                        user {
                          login
                          avatarUrl
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
        { owner: input.owner, repo: input.repo, expression }
      );
      const ranges = data.repository?.object?.blame?.ranges;

      if (!ranges) {
        return {
          path: input.path,
          ref: input.ref ?? null,
          ranges: [],
          truncated: false,
          availability: {
            status: "error",
            message: "GitHub could not return blame information for this file and ref."
          }
        };
      }

      return {
        path: input.path,
        ref: input.ref ?? null,
        ranges: ranges.slice(0, maxRanges).map(mapFileBlameRange),
        truncated: ranges.length > maxRanges,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        path: input.path,
        ref: input.ref ?? null,
        ranges: [],
        truncated: false,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getRepositoryWiki(input: RepositoryWikiInput): Promise<RepositoryWikiResult> {
    const wikiRepo = `${input.repo}.wiki`;

    try {
      const tree = await this.rest<GitHubTree>("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
        owner: input.owner,
        repo: wikiRepo,
        tree_sha: "HEAD",
        recursive: "1"
      });
      const pages = tree.tree
        .filter((entry) => entry.type === "blob" && Boolean(entry.path) && Boolean(entry.sha))
        .map((entry) => mapWikiPage(input.owner, input.repo, entry))
        .sort((a, b) => wikiPageSortKey(a).localeCompare(wikiPageSortKey(b)));
      const limitedPages = pages.slice(0, input.limit ?? 50);
      const selectedPath = input.pagePath ?? findDefaultWikiPagePath(limitedPages);
      const selectedSummary =
        (selectedPath
          ? (pages.find((page) => page.path === selectedPath) ??
            wikiPageSummaryFromPath(input.owner, input.repo, selectedPath))
          : null) ??
        limitedPages[0] ??
        null;
      const returnedPages =
        selectedSummary && !limitedPages.some((page) => page.path === selectedSummary.path)
          ? [selectedSummary, ...limitedPages]
          : limitedPages;
      const markdown = selectedSummary
        ? await this.restText("GET /repos/{owner}/{repo}/contents/{path}", {
            owner: input.owner,
            repo: wikiRepo,
            path: selectedSummary.path,
            headers: { accept: "application/vnd.github.raw" }
          })
        : null;

      return {
        pages: returnedPages,
        selectedPage:
          selectedSummary && markdown !== null
            ? {
                ...selectedSummary,
                markdown
              }
            : null,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        pages: [],
        selectedPage: null,
        availability: mapWikiError(error)
      };
    }
  }

  async listCommits(input: RepositoryCommitListInput): Promise<RepositoryCommitSummary[]> {
    const commits = await this.restPaginatedArray<GitHubCommit>(
      "GET /repos/{owner}/{repo}/commits",
      {
        owner: input.owner,
        repo: input.repo,
        sha: input.ref ?? undefined,
        path: input.path ?? undefined
      },
      input.limit ?? 20
    );

    return commits.map(mapRepositoryCommit);
  }

  async listCommitsWithStatus(input: RepositoryCommitListInput): Promise<RepositoryCommitListResult> {
    try {
      return {
        items: await this.listCommits(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listLabels(input: RepositoryLabelListInput): Promise<LabelSummary[]> {
    const data = await this.restPaginatedArray<GitHubLabel>(
      "GET /repos/{owner}/{repo}/labels",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 100
    );

    return data.map(mapLabel);
  }

  async listLabelsWithStatus(input: RepositoryLabelListInput): Promise<RepositoryLabelListResult> {
    try {
      return {
        items: await this.listLabels(input),
        availability: { status: "available", message: null } satisfies GitHubReadAvailability
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listAssignableUsers(input: AssignableUserListInput): Promise<AssignableUserSummary[]> {
    const data = await this.restPaginatedArray<GitHubAssignableUser>(
      "GET /repos/{owner}/{repo}/assignees",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 100
    );

    return data.map(mapAssignableUser);
  }

  async listAssignableUsersWithStatus(input: AssignableUserListInput): Promise<AssignableUserListResult> {
    try {
      return {
        items: await this.listAssignableUsers(input),
        availability: { status: "available", message: null } satisfies GitHubReadAvailability
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getRepositoryAccess(input: RepositoryAccessInput): Promise<RepositoryAccessResult> {
    const [collaborators, teams] = await Promise.all([
      this.restPaginatedArray<GitHubRepositoryCollaborator>(
        "GET /repos/{owner}/{repo}/collaborators",
        {
          owner: input.owner,
          repo: input.repo,
          affiliation: input.affiliation ?? "all",
          ...(input.permission ? { permission: input.permission } : {})
        },
        input.limit ?? 30
      )
        .then((items) => ({
          items: items.map(mapRepositoryCollaborator),
          availability: { status: "available", message: null } satisfies GitHubReadAvailability
        }))
        .catch((error: unknown) => ({
          items: [] as RepositoryCollaboratorSummary[],
          availability: mapRepositoryAccessError("Repository collaborators", error)
        })),
      this.restPaginatedArray<GitHubTeam>(
        "GET /repos/{owner}/{repo}/teams",
        {
          owner: input.owner,
          repo: input.repo
        },
        input.limit ?? 30
      )
        .then((items) => ({
          items: items.map((team) => mapTeam(input.owner, team)),
          availability: { status: "available", message: null } satisfies GitHubReadAvailability
        }))
        .catch((error: unknown) => ({
          items: [] as TeamSummary[],
          availability: mapRepositoryAccessError("Repository teams", error)
        }))
    ]);

    return {
      collaborators: collaborators.items,
      teams: teams.items,
      collaboratorsAvailability: collaborators.availability,
      teamsAvailability: teams.availability
    };
  }

  async listMilestones(input: RepositoryMilestoneListInput): Promise<MilestoneSummary[]> {
    const data = await this.restPaginatedArray<GitHubIssueMilestone>(
      "GET /repos/{owner}/{repo}/milestones",
      {
        owner: input.owner,
        repo: input.repo,
        state: input.state ?? "open"
      },
      input.limit ?? 100
    );

    return data
      .map(mapIssueMilestone)
      .filter((milestone): milestone is MilestoneSummary => Boolean(milestone));
  }

  async listMilestonesWithStatus(
    input: RepositoryMilestoneListInput
  ): Promise<RepositoryMilestoneListResult> {
    try {
      return {
        items: await this.listMilestones(input),
        availability: { status: "available", message: null } satisfies GitHubReadAvailability
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listIssues(input: IssueListInput): Promise<IssueSummary[]> {
    return this.issueDomain.listIssues(input);
  }

  async listIssuesWithStatus(input: IssueListInput): Promise<IssueListResult> {
    return this.issueDomain.listIssuesWithStatus(input);
  }

  async getIssueDetail(input: IssueDetailInput): Promise<IssueDetail> {
    return this.issueDomain.getIssueDetail(input);
  }

  async getIssueDetailWithStatus(input: IssueDetailInput): Promise<IssueDetailResult> {
    return this.issueDomain.getIssueDetailWithStatus(input);
  }

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]> {
    return this.pullRequestDomain.listPullRequests(input);
  }

  async listPullRequestsWithStatus(input: PullRequestListInput): Promise<PullRequestListResult> {
    return this.pullRequestDomain.listPullRequestsWithStatus(input);
  }

  async getPullRequestDetail(input: PullRequestDetailInput): Promise<PullRequestDetail> {
    return this.pullRequestDomain.getPullRequestDetail(input);
  }

  async getPullRequestDetailWithStatus(input: PullRequestDetailInput): Promise<PullRequestDetailResult> {
    return this.pullRequestDomain.getPullRequestDetailWithStatus(input);
  }

  async getPullRequestOverviewWithStatus(
    input: PullRequestOverviewInput
  ): Promise<PullRequestOverviewResult> {
    return this.pullRequestDomain.getPullRequestOverviewWithStatus(input);
  }

  async listPullRequestCommentsWithStatus(
    input: PullRequestCommentsInput
  ): Promise<PullRequestCommentsResult> {
    return this.pullRequestDomain.listPullRequestCommentsWithStatus(input);
  }

  async listPullRequestFilesWithStatus(input: PullRequestFilesInput): Promise<PullRequestFilesResult> {
    return this.pullRequestDomain.listPullRequestFilesWithStatus(input);
  }

  async listPullRequestCommitsWithStatus(input: PullRequestCommitsInput): Promise<PullRequestCommitsResult> {
    return this.pullRequestDomain.listPullRequestCommitsWithStatus(input);
  }

  async listPullRequestReviewsWithStatus(input: PullRequestReviewsInput): Promise<PullRequestReviewsResult> {
    return this.pullRequestDomain.listPullRequestReviewsWithStatus(input);
  }

  async listPullRequestChecksWithStatus(input: PullRequestChecksInput): Promise<PullRequestChecksResult> {
    return this.pullRequestDomain.listPullRequestChecksWithStatus(input);
  }

  async listPullRequestReviewThreadsWithStatus(
    input: PullRequestReviewThreadsInput
  ): Promise<PullRequestReviewThreadsResult> {
    return this.pullRequestDomain.listPullRequestReviewThreadsWithStatus(input);
  }

  async listPullRequestTimelineWithStatus(
    input: PullRequestTimelineInput
  ): Promise<PullRequestTimelineResult> {
    return this.pullRequestDomain.listPullRequestTimelineWithStatus(input);
  }

  async listPullRequestLinkedIssuesWithStatus(
    input: PullRequestLinkedIssuesInput
  ): Promise<PullRequestLinkedIssuesResult> {
    return this.pullRequestDomain.listPullRequestLinkedIssuesWithStatus(input);
  }

  async listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    return this.discussionDomain.listDiscussions(input);
  }

  async listDiscussionsWithStatus(input: DiscussionListInput): Promise<DiscussionListResult> {
    return this.discussionDomain.listDiscussionsWithStatus(input);
  }

  async listDiscussionCategoriesWithStatus(
    input: DiscussionCategoryListInput
  ): Promise<DiscussionCategoryListResult> {
    return this.discussionDomain.listDiscussionCategoriesWithStatus(input);
  }

  async getDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetailResult> {
    return this.discussionDomain.getDiscussionDetail(input);
  }

  async listActions(input: ActionsInput): Promise<WorkflowRunSummary[]> {
    return this.workflowDomain.listActions(input);
  }

  async listActionsWithStatus(input: ActionsInput): Promise<WorkflowRunListResult> {
    return this.workflowDomain.listActionsWithStatus(input);
  }

  async listWorkflows(input: WorkflowListInput): Promise<WorkflowDefinitionSummary[]> {
    return this.workflowDomain.listWorkflows(input);
  }

  async listWorkflowsWithStatus(input: WorkflowListInput): Promise<WorkflowDefinitionListResult> {
    return this.workflowDomain.listWorkflowsWithStatus(input);
  }

  async getWorkflowRunDetail(input: WorkflowRunDetailInput): Promise<WorkflowRunDetail> {
    return this.workflowDomain.getWorkflowRunDetail(input);
  }

  async getWorkflowRunDetailWithStatus(input: WorkflowRunDetailInput): Promise<WorkflowRunDetailResult> {
    return this.workflowDomain.getWorkflowRunDetailWithStatus(input);
  }

  async getWorkflowJobLogs(input: WorkflowJobLogsInput): Promise<WorkflowJobLogsResult> {
    return this.workflowDomain.getWorkflowJobLogs(input);
  }

  async listProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    return this.projectDomain.listProjects(input);
  }

  async listProjectsWithStatus(input: ProjectsInput): Promise<ProjectListResult> {
    return this.projectDomain.listProjectsWithStatus(input);
  }

  async getBranchProtection(input: BranchProtectionInput): Promise<BranchProtectionResult> {
    return this.securityDomain.getBranchProtection(input);
  }

  async listDependabotAlerts(input: DependabotAlertsInput): Promise<DependabotAlertsResult> {
    return this.securityDomain.listDependabotAlerts(input);
  }

  async listCodeScanningAlerts(input: CodeScanningAlertsInput): Promise<CodeScanningAlertsResult> {
    return this.securityDomain.listCodeScanningAlerts(input);
  }

  async listSecretScanningAlerts(input: SecretScanningAlertsInput): Promise<SecretScanningAlertsResult> {
    return this.securityDomain.listSecretScanningAlerts(input);
  }

  async listRepositoryRulesets(input: RepositoryRulesetsInput): Promise<RepositoryRulesetsResult> {
    return this.securityDomain.listRepositoryRulesets(input);
  }

  async listRepositoryForks(input: RepositoryForksInput): Promise<RepositoryForksResult> {
    return this.repositoryDomain.listRepositoryForks(input);
  }

  async listRepositorySecurityAdvisories(
    input: RepositorySecurityAdvisoriesInput
  ): Promise<RepositorySecurityAdvisoriesResult> {
    return this.securityDomain.listRepositorySecurityAdvisories(input);
  }

  async getRepositorySecurityPolicy(
    input: RepositorySecurityPolicyInput
  ): Promise<RepositorySecurityPolicyResult> {
    return this.securityDomain.getRepositorySecurityPolicy(input);
  }

  async getRepositoryCommunityProfile(
    input: RepositoryCommunityProfileInput
  ): Promise<RepositoryCommunityProfileResult> {
    return this.securityDomain.getRepositoryCommunityProfile(input);
  }

  async listReleases(input: ReleasesInput): Promise<ReleaseSummary[]> {
    return this.releaseDomain.listReleases(input);
  }

  async listReleasesWithStatus(input: ReleasesInput): Promise<ReleaseListResult> {
    return this.releaseDomain.listReleasesWithStatus(input);
  }

  async getReleaseDetailWithStatus(input: ReleaseDetailInput): Promise<ReleaseDetailResult> {
    return this.releaseDomain.getReleaseDetailWithStatus(input);
  }

  async listContributors(input: ContributorsInput): Promise<ContributorSummary[]> {
    return this.contributorDomain.listContributors(input);
  }

  async listContributorsWithStatus(input: ContributorsInput): Promise<ContributorListResult> {
    return this.contributorDomain.listContributorsWithStatus(input);
  }

  async search(input: SearchInput): Promise<RepositorySummary[]> {
    return this.searchDomain.search(input);
  }

  async searchWithStatus(input: SearchInput): Promise<RepositorySearchResult> {
    return this.searchDomain.searchWithStatus(input);
  }

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult> {
    return this.mutationDomain.mutate<TInput, TResult>(input);
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, string | number | boolean | null> = {}
  ): Promise<T> {
    return this.requestLimiter.run(() => this.octokit.graphql<T>(query, variables));
  }

  private async restPaginatedArray<T>(
    route: string,
    params: Record<string, unknown>,
    limit: number
  ): Promise<T[]> {
    const items: T[] = [];
    const requestedLimit = Math.max(0, limit);
    let page = 1;

    while (items.length < requestedLimit) {
      const perPage = Math.min(100, requestedLimit - items.length);
      const pageItems = await this.rest<T[]>(route, { ...params, page, per_page: perPage });
      items.push(...pageItems);

      if (pageItems.length < perPage) {
        break;
      }
      page += 1;
    }

    return items.slice(0, requestedLimit);
  }

  private async restPaginatedWrapped<T, K extends string>(
    route: string,
    key: K,
    params: Record<string, unknown>,
    limit: number
  ): Promise<T[]> {
    const items: T[] = [];
    const requestedLimit = Math.max(0, limit);
    let page = 1;

    while (items.length < requestedLimit) {
      const perPage = Math.min(100, requestedLimit - items.length);
      const data = await this.rest<Record<K, T[]>>(route, { ...params, page, per_page: perPage });
      const pageItems = data[key] ?? [];
      items.push(...pageItems);

      if (pageItems.length < perPage) {
        break;
      }
      page += 1;
    }

    return items.slice(0, requestedLimit);
  }

  private async rest<T>(route: string, params: Record<string, unknown> = {}): Promise<T> {
    const response = await this.requestLimiter.run(() =>
      this.octokit.request(route, withGitHubRestHeaders(params))
    );
    return response.data as T;
  }

  private async restResponse<T>(
    route: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: T; headers: Record<string, string | number | undefined> }> {
    const response = await this.requestLimiter.run(() =>
      this.octokit.request(route, withGitHubRestHeaders(params))
    );
    return {
      data: response.data as T,
      headers: response.headers as Record<string, string | number | undefined>
    };
  }

  private async restText(route: string, params: Record<string, unknown> = {}): Promise<string> {
    const response = await this.requestLimiter.run(() =>
      this.octokit.request(route, withGitHubRestHeaders(params))
    );
    return response.data as string;
  }
}

export async function validateGitHubToken(token: string): Promise<Viewer> {
  return new OctokitProvider(token).getViewer();
}

function withGitHubRestHeaders(params: Record<string, unknown>): Record<string, unknown> {
  const headers =
    params.headers && typeof params.headers === "object" && !Array.isArray(params.headers)
      ? (params.headers as Record<string, unknown>)
      : {};

  return {
    ...params,
    headers: {
      accept: githubJsonAccept,
      ...headers,
      "X-GitHub-Api-Version": githubRestApiVersion
    }
  };
}

function mapGitHubFeatureError(error: unknown): GitHubReadAvailability {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "GitHub request failed.";
  const errorRecord =
    error && typeof error === "object"
      ? (error as { errors?: unknown; status?: unknown; code?: unknown })
      : {};
  const status = typeof errorRecord.status === "number" ? errorRecord.status : null;
  const code = typeof errorRecord.code === "string" ? errorRecord.code : null;
  const normalized = message.toLowerCase();

  if (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNABORTED" ||
    normalized.includes("fetch failed")
  ) {
    return { status: "offline", message };
  }

  if (
    status === 429 ||
    (status === 403 && normalized.includes("rate limit")) ||
    normalized.includes("secondary rate")
  ) {
    return { status: "rate_limited", message };
  }

  const isFeatureDisabled =
    normalized.includes("disabled") ||
    normalized.includes("not enabled") ||
    normalized.includes("has discussions disabled") ||
    normalized.includes("projects are disabled");

  if (isFeatureDisabled) {
    return { status: "feature_disabled", message };
  }

  if (status === 401 || status === 403 || normalized.includes("resource not accessible")) {
    return { status: "permission_denied", message };
  }

  if (Array.isArray(errorRecord.errors)) {
    return { status: "graphql_error", message };
  }

  return { status: "error", message };
}

function mapWikiError(error: unknown): GitHubReadAvailability {
  const errorRecord =
    error && typeof error === "object" ? (error as { status?: unknown; message?: unknown }) : {};
  const status = typeof errorRecord.status === "number" ? errorRecord.status : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "GitHub wiki request failed.";

  if (status === 404) {
    return {
      status: "feature_disabled",
      message: "GitHub did not return a wiki repository. The wiki may be disabled, empty, or inaccessible."
    };
  }

  return mapGitHubFeatureError(error ?? message);
}

function mapTeam(org: string, team: GitHubTeam): TeamSummary {
  return {
    id: String(team.node_id ?? team.id),
    databaseId: typeof team.id === "number" ? team.id : null,
    organizationLogin: team.organization?.login ?? org,
    name: team.name,
    slug: team.slug,
    description: team.description ?? null,
    privacy: team.privacy ?? null,
    permission: team.permission ?? null,
    notificationSetting: team.notification_setting ?? null,
    memberCount: team.members_count ?? null,
    repositoryCount: team.repos_count ?? null,
    htmlUrl: team.html_url ?? null,
    parent: mapTeamParent(team.parent ?? null),
    createdAt: team.created_at ?? null,
    updatedAt: team.updated_at ?? null
  };
}

function mapTeamParent(team: GitHubTeamParent | null): TeamParentSummary | null {
  if (!team) {
    return null;
  }

  return {
    id: String(team.node_id ?? team.id),
    name: team.name,
    slug: team.slug,
    htmlUrl: team.html_url ?? null
  };
}

function mapWikiPage(owner: string, repo: string, entry: GitHubTreeEntry): WikiPageSummary {
  const path = entry.path ?? "";
  const title = wikiPageTitle(path);

  return {
    path,
    title,
    sha: entry.sha ?? path,
    size: typeof entry.size === "number" ? entry.size : null,
    htmlUrl: `https://github.com/${owner}/${repo}/wiki/${encodeWikiPageSlug(path)}`
  };
}

function wikiPageSummaryFromPath(owner: string, repo: string, path: string): WikiPageSummary {
  return {
    path,
    title: wikiPageTitle(path),
    sha: path,
    size: null,
    htmlUrl: `https://github.com/${owner}/${repo}/wiki/${encodeWikiPageSlug(path)}`
  };
}

function wikiPageTitle(path: string): string {
  const fileName = path.split("/").pop() ?? path;
  return (
    fileName
      .replace(/\.(md|markdown|mediawiki|creole|rst|textile|org|asciidoc|adoc)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim() || fileName
  );
}

function wikiPageSortKey(page: WikiPageSummary): string {
  return page.title.toLowerCase() === "home" ? `0-${page.title}` : `1-${page.title.toLowerCase()}`;
}

function findDefaultWikiPagePath(pages: WikiPageSummary[]): string | null {
  return pages.find((page) => page.title.toLowerCase() === "home")?.path ?? pages[0]?.path ?? null;
}

function encodeWikiPageSlug(path: string): string {
  return path
    .replace(/\.(md|markdown|mediawiki|creole|rst|textile|org|asciidoc|adoc)$/i, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function mapRepositoryAccessError(feature: string, error: unknown): GitHubReadAvailability {
  const errorRecord =
    error && typeof error === "object" ? (error as { status?: unknown; message?: unknown }) : {};
  const status = typeof errorRecord.status === "number" ? errorRecord.status : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof errorRecord.message === "string"
        ? errorRecord.message
        : typeof error === "string"
          ? error
          : null;

  if (status === 404) {
    return {
      status: "permission_denied",
      message: message ?? `${feature} are not accessible with the current token.`
    };
  }

  return mapGitHubFeatureError(error);
}

function mapLabel(label: GitHubLabel): LabelSummary {
  return {
    id: label.node_id ?? label.id,
    name: label.name,
    color: label.color,
    description: label.description ?? null
  };
}

function mapAssignableUser(user: GitHubAssignableUser): AssignableUserSummary {
  return {
    id: user.node_id ?? user.id,
    login: user.login,
    avatarUrl: user.avatar_url ?? null,
    htmlUrl: user.html_url ?? null
  };
}

function mapRepositoryCollaborator(user: GitHubRepositoryCollaborator): RepositoryCollaboratorSummary {
  return {
    id: user.node_id ?? user.id,
    login: user.login,
    avatarUrl: user.avatar_url ?? null,
    htmlUrl: user.html_url ?? null,
    type: user.type ?? null,
    siteAdmin: user.site_admin === true,
    roleName: user.role_name ?? null,
    permissions: {
      admin: user.permissions?.admin ?? null,
      maintain: user.permissions?.maintain ?? null,
      push: user.permissions?.push ?? null,
      triage: user.permissions?.triage ?? null,
      pull: user.permissions?.pull ?? null
    }
  };
}

function mapIssueMilestone(milestone: GitHubIssueMilestone | null | undefined): MilestoneSummary | null {
  if (!milestone) {
    return null;
  }

  return {
    id: milestone.node_id ?? milestone.id,
    number: milestone.number,
    title: milestone.title,
    description: milestone.description ?? null,
    state: milestone.state,
    dueOn: milestone.due_on ?? null,
    createdAt: milestone.created_at ?? null,
    updatedAt: milestone.updated_at ?? null,
    closedAt: milestone.closed_at ?? null,
    htmlUrl: milestone.html_url ?? null,
    openIssues: milestone.open_issues ?? null,
    closedIssues: milestone.closed_issues ?? null
  };
}

function mapFileBlameRange(range: GitHubBlameRange): RepoFileBlameRange {
  return {
    startingLine: range.startingLine,
    endingLine: range.endingLine,
    age: range.age,
    commit: {
      sha: range.commit.oid,
      headline: range.commit.messageHeadline,
      authorLogin: range.commit.author?.user?.login ?? null,
      authorName: range.commit.author?.name ?? range.commit.author?.user?.login ?? null,
      authorAvatarUrl: range.commit.author?.user?.avatarUrl ?? null,
      authoredDate: range.commit.authoredDate ?? range.commit.author?.date ?? null,
      committedDate: range.commit.committedDate ?? null,
      htmlUrl: range.commit.url ?? null
    }
  };
}

function mapRepositoryCommit(commit: GitHubCommit): RepositoryCommitSummary {
  const message = commit.commit.message.trim();
  const headline = message.split("\n")[0]?.trim() || commit.sha.slice(0, 7);
  const authoredDate = commit.commit.author?.date ?? null;
  const committedDate = commit.commit.committer?.date ?? authoredDate;

  return {
    sha: commit.sha,
    message,
    headline,
    authorLogin: commit.author?.login ?? null,
    authorName: commit.commit.author?.name ?? commit.author?.login ?? null,
    authorAvatarUrl: commit.author?.avatar_url ?? null,
    committerLogin: commit.committer?.login ?? null,
    committerName: commit.commit.committer?.name ?? commit.committer?.login ?? null,
    committerAvatarUrl: commit.committer?.avatar_url ?? null,
    authoredDate,
    committedDate,
    htmlUrl: commit.html_url ?? null,
    parentCount: commit.parents?.length ?? 0,
    verificationReason: commit.commit.verification?.reason ?? null,
    verified: commit.commit.verification?.verified ?? null
  };
}

interface GitHubTeamParent {
  id: number | string;
  node_id?: string | null;
  name: string;
  slug: string;
  html_url?: string | null;
}

interface GitHubTeam extends GitHubTeamParent {
  description?: string | null;
  privacy?: string | null;
  permission?: string | null;
  notification_setting?: string | null;
  members_count?: number | null;
  repos_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  parent?: GitHubTeamParent | null;
  organization?: { login: string } | null;
}

interface GitHubRestRepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}

interface GitHubTree {
  sha: string;
  truncated: boolean;
  tree: GitHubTreeEntry[];
}

interface GitHubTreeEntry {
  path?: string;
  mode?: string;
  type?: "blob" | "tree" | "commit";
  sha?: string;
  size?: number;
  url?: string;
}

interface GitHubLabel {
  id: number | string;
  node_id?: string | null;
  name: string;
  color: string;
  description?: string | null;
}

interface GitHubAssignableUser {
  id: number | string;
  node_id?: string | null;
  login: string;
  avatar_url?: string | null;
  html_url?: string | null;
}

interface GitHubRepositoryCollaborator extends GitHubAssignableUser {
  type?: string | null;
  site_admin?: boolean;
  role_name?: string | null;
  permissions?: GitHubRestRepositoryPermissions | null;
}

interface GitHubIssueMilestone {
  id: number | string;
  node_id?: string | null;
  number: number;
  title: string;
  description?: string | null;
  state: string;
  due_on?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  html_url?: string | null;
  open_issues?: number | null;
  closed_issues?: number | null;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author?: { name?: string | null; date?: string | null } | null;
    committer?: { name?: string | null; date?: string | null } | null;
    verification?: {
      verified?: boolean | null;
      reason?: string | null;
    } | null;
  };
  author?: GitHubUser | null;
  committer?: GitHubUser | null;
  html_url?: string | null;
  parents?: unknown[] | null;
}

interface GitHubBlobBlameNode {
  blame?: {
    ranges: GitHubBlameRange[];
  } | null;
}

interface GitHubBlameRange {
  startingLine: number;
  endingLine: number;
  age: number;
  commit: {
    oid: string;
    messageHeadline: string;
    url?: string | null;
    authoredDate?: string | null;
    committedDate?: string | null;
    author?: {
      name?: string | null;
      date?: string | null;
      user?: {
        login: string;
        avatarUrl: string | null;
      } | null;
    } | null;
  };
}

interface GitHubUser {
  login: string;
  avatar_url: string | null;
}
