import { Octokit } from "octokit";

import type {
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
  BranchProtectionSummary,
  BranchSummary,
  CodeScanningAlertSummary,
  CodeScanningAlertsInput,
  CodeScanningAlertsResult,
  ContributorsInput,
  ContributorListResult,
  ContributorSummary,
  DependabotAlertSummary,
  DependabotAlertsInput,
  DependabotAlertsResult,
  DiscussionCategoryListInput,
  DiscussionCategoryListResult,
  DiscussionCategorySummary,
  DiscussionDetail,
  DiscussionDetailInput,
  DiscussionDetailResult,
  DiscussionListInput,
  DiscussionListResult,
  DiscussionSummary,
  GitHubReadAvailability,
  GitHubAccountProfile,
  GitHubMutationInput,
  GitHubMutationFields,
  GitHubMutationResult,
  GitHubProvider,
  IssueDetail,
  IssueDetailInput,
  IssueDetailResult,
  IssueListInput,
  IssueListResult,
  IssueSummary,
  LanguageStat,
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
  OrganizationMemberSummary,
  OrganizationProjectsInput,
  OrganizationRepositoriesInput,
  OrganizationRepositoriesResult,
  OrganizationRepositorySummary,
  OrganizationTeamMembersInput,
  OrganizationTeamMembersResult,
  OrganizationTeamRepositoriesInput,
  OrganizationTeamRepositoriesResult,
  OrganizationTeamRepositorySummary,
  OrganizationSummary,
  OrganizationTeamsInput,
  OrganizationTeamsResult,
  ProjectSummary,
  ProjectListResult,
  ProjectsInput,
  PullRequestCommitSummary,
  PullRequestCheckSummary,
  PullRequestDetail,
  PullRequestDetailResult,
  PullRequestFileSummary,
  PullRequestDetailInput,
  PullRequestLinkedIssueSummary,
  PullRequestListInput,
  PullRequestListResult,
  PullRequestRequestedTeamSummary,
  PullRequestReviewSummary,
  PullRequestReviewThreadCommentSummary,
  PullRequestReviewThreadSummary,
  PullRequestTimelineEventSummary,
  PullRequestSummary,
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
  RepoTreeEntry,
  RepoTreeInput,
  RepoTreeReadResult,
  RepoTreeResult,
  RepositoryAccessInput,
  RepositoryAccessResult,
  CommunityProfileFileSummary,
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
  RepositoryAdministrationMetadata,
  RepositoryCollaboratorSummary,
  RepositoryCounts,
  RepositoryDetail,
  RepositoryDetailResult,
  RepositoryRef,
  RepositoryRulesetSummary,
  RepositoryRulesetsInput,
  RepositoryRulesetsResult,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityAdvisoriesResult,
  RepositorySecurityAdvisorySummary,
  RepositorySecurityPolicy,
  RepositorySecurityPolicyInput,
  RepositorySecurityPolicyResult,
  RepositoryListResult,
  RepositorySearchResult,
  RepositorySummary,
  SearchInput,
  SecretScanningAlertSummary,
  SecretScanningAlertsInput,
  SecretScanningAlertsResult,
  TagListInput,
  TagListResult,
  TagSummary,
  TeamMemberSummary,
  TeamParentSummary,
  TeamSummary,
  Viewer,
  ViewerRepositoryState,
  WorkflowDefinitionListResult,
  WorkflowDefinitionSummary,
  WorkflowDispatchInputSummary,
  WorkflowDispatchInputType,
  WorkflowJobLogsInput,
  WorkflowJobLogsResult,
  WorkflowListInput,
  WorkflowRunArtifactSummary,
  WorkflowRunCheckAnnotationSummary,
  WorkflowRunCheckRunSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunDetailInput,
  WorkflowRunDetailResult,
  WorkflowRunJobSummary,
  WorkflowRunListResult,
  WorkflowRunLogsSummary,
  WorkflowRunSummary
} from "@shared/github";
import { GitHubRequestLimiter } from "./rateLimit";

type GitHubMutationRuntimePayload = GitHubMutationInput & Partial<GitHubMutationFields>;

const githubRestApiVersion = "2022-11-28";
const githubJsonAccept = "application/vnd.github+json";
const contentCommitMetadataLimit = 25;
const contentCommitFileStatsLimit = 8;
const securityPolicyContentLimit = 128_000;
const workflowCheckRunAnnotationLimit = 10;
const githubGraphqlConnectionPageLimit = 100;
const defaultDiscussionDetailCommentsLimit = 100;
const defaultDiscussionDetailRepliesLimit = 20;
const maxDiscussionDetailCommentsLimit = 500;
const maxDiscussionDetailRepliesLimit = 500;
const defaultWorkflowDefinitionLimit = 50;
const maxWorkflowDefinitionLimit = 100;
const securityPolicyCandidatePaths = ["SECURITY.md", ".github/SECURITY.md", "docs/SECURITY.md"];

const discussionCommentNodeSelection = `
  id
  author { login avatarUrl }
  body
  createdAt
  updatedAt
  url
`;

const pullRequestReviewThreadCommentNodeSelection = `
  databaseId
  replyTo {
    databaseId
  }
`;

const repositorySummaryFragment = `
  fragment RepositorySummaryFields on Repository {
    id
    name
    nameWithOwner
    description
    visibility
    isPrivate
    isFork
    stargazerCount
    forkCount
    updatedAt
    pushedAt
    defaultBranchRef { name }
    owner { login avatarUrl }
    watchers { totalCount }
    issues(states: OPEN) { totalCount }
    pullRequests(states: OPEN) { totalCount }
    discussions { totalCount }
    releases { totalCount }
    primaryLanguage { name color }
  }
`;

const githubProfileFragment = `
  ${repositorySummaryFragment}

  fragment GitHubProfileFields on User {
    id
    login
    name
    avatarUrl
    url
    bio
    company
    location
    websiteUrl
    followers { totalCount }
    following { totalCount }
    repositories { totalCount }
    starredRepositories { totalCount }
    status { emoji message }
    pinnedItems(first: $limit, types: REPOSITORY) {
      nodes {
        ... on Repository {
          ...RepositorySummaryFields
        }
      }
    }
  }
`;

export class OctokitProvider implements GitHubProvider {
  private readonly octokit: Octokit;
  private readonly requestLimiter = new GitHubRequestLimiter();

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      userAgent: "Control/0.1.0"
    });
  }

  async getViewer(): Promise<Viewer> {
    const data = await this.graphql<{
      viewer: {
        login: string;
        name: string | null;
        avatarUrl: string | null;
        url: string | null;
      };
    }>(`
      query Viewer {
        viewer {
          login
          name
          avatarUrl
          url
        }
      }
    `);

    return {
      login: data.viewer.login,
      name: data.viewer.name,
      avatarUrl: data.viewer.avatarUrl,
      htmlUrl: data.viewer.url
    };
  }

  async getAccountProfile(input: AccountProfileInput = {}): Promise<GitHubAccountProfile> {
    const limit = 6;

    if (input.login) {
      const data = await this.graphql<{ user: GitHubProfileNode | null }>(
        `
        query AccountProfile($login: String!, $limit: Int!) {
          user(login: $login) {
            ...GitHubProfileFields
          }
        }

        ${githubProfileFragment}
      `,
        { login: input.login, limit }
      );

      if (!data.user) {
        throw new Error(`GitHub user ${input.login} was not found.`);
      }

      return mapAccountProfile(data.user);
    }

    const data = await this.graphql<{ viewer: GitHubProfileNode }>(
      `
      query ViewerProfile($limit: Int!) {
        viewer {
          ...GitHubProfileFields
        }
      }

      ${githubProfileFragment}
    `,
      { limit }
    );

    return mapAccountProfile(data.viewer);
  }

  async getAccountProfileWithStatus(input: AccountProfileInput = {}): Promise<AccountProfileResult> {
    try {
      return {
        profile: await this.getAccountProfile(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        profile: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listRepositories(input: RepoListInput = {}): Promise<RepositorySummary[]> {
    const limit = input.limit ?? 50;
    const data = await this.graphql<{
      viewer: { repositories: { nodes: GitHubRepositoryNode[] } };
    }>(
      `
      query ViewerRepositories($limit: Int!) {
        viewer {
          repositories(
            first: $limit,
            orderBy: { field: UPDATED_AT, direction: DESC },
            affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
          ) {
            nodes {
              ...RepositorySummaryFields
            }
          }
        }
      }

      ${repositorySummaryFragment}
    `,
      { limit }
    );

    return data.viewer.repositories.nodes.map(mapRepositorySummary);
  }

  async listRepositoriesWithStatus(input: RepoListInput = {}): Promise<RepositoryListResult> {
    try {
      return {
        items: await this.listRepositories(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listAccountRepositories(input: AccountRepositoryInput = {}): Promise<RepositorySummary[]> {
    const limit = input.limit ?? 50;

    if (!input.login) {
      return this.listRepositories({ limit });
    }

    const data = await this.graphql<{
      user: { repositories: { nodes: GitHubRepositoryNode[] } } | null;
    }>(
      `
      query AccountRepositories($login: String!, $limit: Int!) {
        user(login: $login) {
          repositories(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              ...RepositorySummaryFields
            }
          }
        }
      }

      ${repositorySummaryFragment}
    `,
      { login: input.login, limit }
    );

    return data.user?.repositories.nodes.map(mapRepositorySummary) ?? [];
  }

  async listAccountRepositoriesWithStatus(
    input: AccountRepositoryInput = {}
  ): Promise<AccountRepositoryListResult> {
    try {
      return {
        items: await this.listAccountRepositories(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listOrganizations(input: OrganizationListInput = {}): Promise<OrganizationSummary[]> {
    const limit = input.limit ?? 50;
    const data = await this.graphql<{
      viewer: { login: string; organizations: { nodes: GitHubOrganizationNode[] } };
    }>(
      `
      query ViewerOrganizations($limit: Int!) {
        viewer {
          login
          organizations(first: $limit) {
            nodes {
              id
              login
              name
              description
              avatarUrl
              url
              websiteUrl
              location
              repositories { totalCount }
              teams { totalCount }
              viewerIsAMember
              viewerCanAdminister
              viewerCanCreateRepositories
              viewerCanCreateTeams
            }
          }
        }
      }
    `,
      { limit }
    );

    return Promise.all(
      data.viewer.organizations.nodes.map(async (organization) => ({
        ...mapOrganization(organization),
        ...(await this.fetchOrganizationMembership(organization.login, data.viewer.login))
      }))
    );
  }

  async listOrganizationsWithStatus(input: OrganizationListInput = {}): Promise<OrganizationListResult> {
    try {
      const items = await this.listOrganizations(input);

      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchOrganizationMembership(
    org: string,
    username: string
  ): Promise<
    Pick<
      OrganizationSummary,
      "viewerMembershipRole" | "viewerMembershipState" | "viewerMembershipAvailability"
    >
  > {
    try {
      const membership = await this.rest<GitHubOrganizationMembership>(
        "GET /orgs/{org}/memberships/{username}",
        { org, username }
      );
      return {
        viewerMembershipRole: membership.role ?? null,
        viewerMembershipState: membership.state ?? null,
        viewerMembershipAvailability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        viewerMembershipRole: null,
        viewerMembershipState: null,
        viewerMembershipAvailability: mapGitHubFeatureError(error)
      };
    }
  }

  async listOrganizationTeams(input: OrganizationTeamsInput): Promise<TeamSummary[]> {
    const data = await this.restPaginatedArray<GitHubTeam>(
      "GET /orgs/{org}/teams",
      { org: input.org },
      input.limit ?? 30
    );

    return data.map((team) => mapTeam(input.org, team));
  }

  async listOrganizationTeamsWithStatus(input: OrganizationTeamsInput): Promise<OrganizationTeamsResult> {
    try {
      const items = await this.listOrganizationTeams(input);

      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listOrganizationRepositoriesWithStatus(
    input: OrganizationRepositoriesInput
  ): Promise<OrganizationRepositoriesResult> {
    try {
      const repositories = await this.restPaginatedArray<GitHubTeamRepository>(
        "GET /orgs/{org}/repos",
        {
          org: input.org,
          type: "all",
          sort: "pushed",
          direction: "desc"
        },
        input.limit ?? 50
      );

      return {
        items: repositories.map(mapOrganizationRepository),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listOrganizationTeamRepositoriesWithStatus(
    input: OrganizationTeamRepositoriesInput
  ): Promise<OrganizationTeamRepositoriesResult> {
    try {
      const repositories = await this.restPaginatedArray<GitHubTeamRepository>(
        "GET /orgs/{org}/teams/{team_slug}/repos",
        {
          org: input.org,
          team_slug: input.teamSlug
        },
        input.limit ?? 30
      );

      return {
        items: repositories.map(mapOrganizationTeamRepository),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listOrganizationTeamMembersWithStatus(
    input: OrganizationTeamMembersInput
  ): Promise<OrganizationTeamMembersResult> {
    try {
      const members = await this.restPaginatedArray<GitHubTeamMember>(
        "GET /orgs/{org}/teams/{team_slug}/members",
        {
          org: input.org,
          team_slug: input.teamSlug
        },
        input.limit ?? 30
      );

      return {
        items: members.map(mapTeamMember),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listOrganizationMembersWithStatus(
    input: OrganizationMembersInput
  ): Promise<OrganizationMembersResult> {
    try {
      const members = await this.restPaginatedArray<GitHubOrganizationMember>(
        "GET /orgs/{org}/members",
        {
          org: input.org
        },
        input.limit ?? 30
      );

      return {
        items: members.map(mapOrganizationMember),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult> {
    try {
      const limit = input.limit ?? 20;
      const data = await this.graphql<{
        organization: {
          projectsV2: {
            nodes: GitHubProjectV2Node[];
          };
        } | null;
      }>(
        `
        query OrganizationProjects($org: String!, $limit: Int!) {
          organization(login: $org) {
            projectsV2(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                id
                number
                title
                shortDescription
                readme
                public
                closed
                closedAt
                createdAt
                updatedAt
                viewerCanUpdate
                url
                owner {
                  __typename
                  ... on Organization { login url }
                  ... on User { login url }
                  ... on Repository { nameWithOwner url }
                }
                items(first: 1) { totalCount }
                fields(first: 12) {
                  totalCount
                  nodes {
                    ... on ProjectV2FieldCommon {
                      id
                      name
                      dataType
                    }
                  }
                }
              }
            }
          }
        }
      `,
        { org: input.org, limit }
      );

      return {
        items: data.organization?.projectsV2.nodes.map(mapProjectV2) ?? [],
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listAccountIssues(input: AccountIssueListInput = {}): Promise<IssueSummary[]> {
    const limit = input.limit ?? 30;
    const login = input.login ?? (await this.getViewer()).login;
    const state = input.state ?? "open";
    const stateQualifier = state === "all" ? "" : ` is:${state}`;
    const query = `is:issue${stateQualifier} involves:${login} archived:false sort:updated-desc`;
    const data = await this.graphql<{ search: { nodes: GitHubSearchIssueNode[] } }>(
      `
      query AccountIssues($searchQuery: String!, $limit: Int!) {
        search(query: $searchQuery, type: ISSUE, first: $limit) {
          nodes {
            ... on Issue {
              id
              number
              title
              state
              stateReason
              locked
              url
              createdAt
              updatedAt
              author { login avatarUrl }
              comments { totalCount }
              labels(first: 8) {
                nodes { id name color }
              }
              assignees(first: 8) {
                nodes { id login avatarUrl url }
              }
              milestone {
                id
                number
                title
                description
                state
                dueOn
                createdAt
                updatedAt
                closedAt
                url
              }
              repository { nameWithOwner }
            }
          }
        }
      }
    `,
      { searchQuery: query, limit }
    );

    return data.search.nodes.filter(Boolean).map(mapGraphqlIssue);
  }

  async listAccountIssuesWithStatus(input: AccountIssueListInput = {}): Promise<AccountIssueListResult> {
    try {
      return {
        items: await this.listAccountIssues(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listAccountPullRequests(input: AccountPullRequestListInput = {}): Promise<PullRequestSummary[]> {
    const limit = input.limit ?? 30;
    const login = input.login ?? (await this.getViewer()).login;
    const state = input.state ?? "open";
    const stateQualifier = state === "all" ? "" : ` is:${state}`;
    const query = `is:pr${stateQualifier} involves:${login} archived:false sort:updated-desc`;
    const data = await this.graphql<{ search: { nodes: GitHubSearchPullRequestNode[] } }>(
      `
      query AccountPullRequests($searchQuery: String!, $limit: Int!) {
        search(query: $searchQuery, type: ISSUE, first: $limit) {
          nodes {
            ... on PullRequest {
              id
              number
              title
              state
              merged
              mergedAt
              isDraft
              locked
              url
              createdAt
              updatedAt
              author { login avatarUrl }
              comments { totalCount }
              reviewThreads { totalCount }
              additions
              deletions
              changedFiles
              mergeStateStatus
              headRefName
              baseRefName
              headRepository { nameWithOwner }
              baseRepository { nameWithOwner }
              repository { nameWithOwner }
            }
          }
        }
      }
    `,
      { searchQuery: query, limit }
    );

    return data.search.nodes.filter(Boolean).map(mapGraphqlPullRequest);
  }

  async listAccountPullRequestsWithStatus(
    input: AccountPullRequestListInput = {}
  ): Promise<AccountPullRequestListResult> {
    try {
      return {
        items: await this.listAccountPullRequests(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listNotifications(input: NotificationListInput = {}): Promise<NotificationSummary[]> {
    const data = await this.restPaginatedArray<GitHubNotification>(
      "GET /notifications",
      {
        all: input.all ?? false,
        participating: input.participating ?? undefined,
        since: input.since ?? undefined,
        before: input.before ?? undefined
      },
      input.limit ?? 30
    );

    return Promise.all(
      data.map(async (notification) => {
        const releaseHtmlUrl = await this.getNotificationReleaseHtmlUrl(notification);
        const subscription = await this.getNotificationSubscription(notification);
        return mapNotification(
          notification,
          input.participating === true ? true : null,
          releaseHtmlUrl,
          subscription
        );
      })
    );
  }

  async listNotificationsWithStatus(input: NotificationListInput = {}): Promise<NotificationListResult> {
    try {
      return {
        items: await this.listNotifications(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async getNotificationSubscription(
    notification: GitHubNotification
  ): Promise<GitHubNotificationSubscription | null> {
    if (!notification.subscription_url) {
      return null;
    }

    try {
      return await this.rest<GitHubNotificationSubscription>(
        "GET /notifications/threads/{thread_id}/subscription",
        { thread_id: notification.id }
      );
    } catch {
      return null;
    }
  }

  async markNotificationThreadRead(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    await this.rest<void>("PATCH /notifications/threads/{thread_id}", {
      thread_id: input.threadId
    });

    return {
      ok: true,
      threadId: input.threadId,
      message: "Notification thread marked as read."
    };
  }

  async unsubscribeNotificationThread(
    input: NotificationThreadInput
  ): Promise<NotificationThreadMutationResult> {
    await this.rest<void>("DELETE /notifications/threads/{thread_id}/subscription", {
      thread_id: input.threadId
    });
    return {
      ok: true,
      threadId: input.threadId,
      message: "Notification thread unsubscribed."
    };
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryDetail> {
    const data = await this.graphql<{
      repository: GitHubRepositoryNode & {
        url: string;
        homepageUrl: string | null;
        licenseInfo: { name: string; spdxId: string | null } | null;
        repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
        branches: { totalCount: number };
        tags: { totalCount: number };
        languages: GitHubLanguages;
        parent: GitHubRepositoryRefNode | null;
        viewerHasStarred: boolean;
        viewerSubscription: ViewerRepositoryState["subscription"];
        viewerPermission: string | null;
        isArchived: boolean;
        isDisabled: boolean;
      };
    }>(
      `
      query RepositoryDetail($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          name
          nameWithOwner
          description
          visibility
          isPrivate
          isFork
          isArchived
          isDisabled
          stargazerCount
          forkCount
          updatedAt
          pushedAt
          url
          homepageUrl
          defaultBranchRef { name }
          owner { login avatarUrl }
          watchers { totalCount }
          issues(states: OPEN) { totalCount }
          pullRequests(states: OPEN) { totalCount }
          discussions { totalCount }
          releases { totalCount }
          primaryLanguage { name color }
          languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
            totalSize
            edges {
              size
              node { name color }
            }
          }
          parent {
            id
            name
            nameWithOwner
            url
            visibility
            isPrivate
            forkCount
            stargazerCount
            viewerPermission
            defaultBranchRef { name }
            owner { login }
          }
          viewerHasStarred
          viewerSubscription
          viewerPermission
          licenseInfo { name spdxId }
          repositoryTopics(first: 16) {
            nodes { topic { name } }
          }
          branches: refs(refPrefix: "refs/heads/", first: 1) { totalCount }
          tags: refs(refPrefix: "refs/tags/", first: 1) { totalCount }
        }
      }
    `,
      { owner, repo }
    );

    const summary = mapRepositorySummary(data.repository);
    const restMetadata = await this.getRepositoryRestMetadata(owner, repo);
    return {
      ...summary,
      homepageUrl: data.repository.homepageUrl,
      licenseName: data.repository.licenseInfo?.name ?? null,
      licenseSpdxId: data.repository.licenseInfo?.spdxId ?? null,
      topics: data.repository.repositoryTopics.nodes.map((node) => node.topic.name),
      branchCount: data.repository.branches.totalCount,
      tagCount: data.repository.tags.totalCount,
      readmeMarkdown: null,
      htmlUrl: data.repository.url,
      languages: mapLanguages(data.repository.languages),
      parent: restMetadata?.parent ?? mapRepositoryRef(data.repository.parent),
      source: restMetadata?.source ?? null,
      viewerState: {
        hasStarred: data.repository.viewerHasStarred,
        subscription: data.repository.viewerSubscription,
        permission: data.repository.viewerPermission,
        canAdminister: data.repository.viewerPermission === "ADMIN",
        canSubscribe: true
      },
      permissions: {
        viewerPermission: data.repository.viewerPermission,
        isArchived: data.repository.isArchived,
        isDisabled: data.repository.isDisabled
      },
      administrationAvailability: restMetadata.availability,
      administration:
        restMetadata.administration ??
        fallbackRepositoryAdministration({
          visibility: data.repository.visibility,
          defaultBranch: data.repository.defaultBranchRef?.name ?? null,
          isPrivate: data.repository.isPrivate,
          isArchived: data.repository.isArchived,
          isDisabled: data.repository.isDisabled,
          viewerPermission: data.repository.viewerPermission
        })
    };
  }

  async getRepositoryWithStatus(owner: string, repo: string): Promise<RepositoryDetailResult> {
    try {
      return {
        detail: await this.getRepository(owner, repo),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        detail: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listBranches(input: BranchListInput): Promise<BranchSummary[]> {
    const data = await this.restPaginatedArray<GitHubBranch>(
      "GET /repos/{owner}/{repo}/branches",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 50
    );

    return data.map(mapBranch);
  }

  async listBranchesWithStatus(input: BranchListInput): Promise<BranchListResult> {
    try {
      return {
        items: await this.listBranches(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listTags(input: TagListInput): Promise<TagSummary[]> {
    const data = await this.restPaginatedArray<GitHubTag>(
      "GET /repos/{owner}/{repo}/tags",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 50
    );

    return data.map(mapTag);
  }

  async listTagsWithStatus(input: TagListInput): Promise<TagListResult> {
    try {
      return {
        items: await this.listTags(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listTree(input: RepoTreeInput): Promise<RepoTreeResult> {
    const ref = input.ref ?? "HEAD";
    const data = await this.rest<GitHubTree>("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
      owner: input.owner,
      repo: input.repo,
      tree_sha: ref,
      recursive: input.recursive === false ? undefined : "1"
    });
    const entries = data.tree
      .map((entry) => mapTreeEntry(input.owner, input.repo, ref, entry))
      .filter((entry): entry is RepoTreeEntry => Boolean(entry))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return treeEntryTypeRank(a.type) - treeEntryTypeRank(b.type);
        }
        return a.path.localeCompare(b.path);
      });

    return {
      ref,
      truncated: data.truncated,
      entries: input.limit ? entries.slice(0, input.limit) : entries
    };
  }

  async listTreeWithStatus(input: RepoTreeInput): Promise<RepoTreeReadResult> {
    try {
      return {
        tree: await this.listTree(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        tree: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async getRepositoryRestMetadata(
    owner: string,
    repo: string
  ): Promise<{
    parent: RepositoryRef | null;
    source: RepositoryRef | null;
    administration: RepositoryAdministrationMetadata | null;
    availability: GitHubReadAvailability;
  }> {
    try {
      const repository = await this.rest<GitHubRestRepository>("GET /repos/{owner}/{repo}", { owner, repo });

      return {
        parent: mapRestRepositoryRef(repository.parent ?? null),
        source: mapRestRepositoryRef(repository.source ?? null),
        administration: mapRestRepositoryAdministration(repository),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        parent: null,
        source: null,
        administration: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getReadme(input: RepoReadmeInput): Promise<RepoReadmeResult> {
    try {
      const markdown = await this.restText("GET /repos/{owner}/{repo}/readme", {
        owner: input.owner,
        repo: input.repo,
        ref: input.ref ?? undefined,
        headers: { accept: "application/vnd.github.raw" }
      });
      return { markdown, availability: { status: "available", message: null } };
    } catch (error) {
      if (isGitHubStatus(error, 404)) {
        return {
          markdown: null,
          availability: {
            status: "available",
            message: "GitHub did not return a README for this repository."
          }
        };
      }

      return {
        markdown: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listContents(input: RepoContentsInput): Promise<RepoEntry[]> {
    const route = input.path
      ? "GET /repos/{owner}/{repo}/contents/{path}"
      : "GET /repos/{owner}/{repo}/contents";
    const data = await this.rest<GitHubContentItem[] | GitHubContentItem>(route, {
      owner: input.owner,
      repo: input.repo,
      path: input.path || undefined,
      ref: input.ref ?? undefined
    });

    const items = Array.isArray(data) ? data : [data];
    const entries: RepoEntry[] = items
      .map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        sha: item.sha,
        size: typeof item.size === "number" ? item.size : null,
        htmlUrl: item.html_url ?? null,
        downloadUrl: item.download_url ?? null,
        lastCommitSha: null,
        lastCommitMessage: null,
        lastCommitAuthorLogin: null,
        lastCommitAuthorName: null,
        lastCommitAuthorAvatarUrl: null,
        lastAuthoredDate: null,
        lastCommittedDate: null,
        lastCommitDate: null,
        lastCommitHtmlUrl: null,
        lastCommitAdditions: null,
        lastCommitDeletions: null,
        lastCommitChanges: null,
        lastCommitAvailability: { status: "available", message: null } as GitHubReadAvailability
      }))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "dir" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    return this.enrichContentCommitMetadata(input, entries);
  }

  async listContentsWithStatus(input: RepoContentsInput): Promise<RepoContentsResult> {
    try {
      return {
        items: await this.listContents(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async enrichContentCommitMetadata(
    input: RepoContentsInput,
    entries: RepoEntry[]
  ): Promise<RepoEntry[]> {
    const fileStatsPaths = new Set(
      entries
        .filter((entry) => entry.type === "file")
        .slice(0, contentCommitFileStatsLimit)
        .map((entry) => entry.path)
    );
    const enriched = await Promise.all(
      entries.slice(0, contentCommitMetadataLimit).map(async (entry) => {
        const lastCommit = await this.getContentLastCommit(input, entry.path, fileStatsPaths.has(entry.path));
        return {
          ...entry,
          ...(lastCommit.metadata ?? {}),
          lastCommitAvailability: lastCommit.availability
        };
      })
    );

    const skippedAvailability = {
      status: "not_loaded",
      message: "Last-change metadata was not loaded for this large directory."
    } satisfies GitHubReadAvailability;
    const skippedEntries = entries.slice(contentCommitMetadataLimit).map((entry) => ({
      ...entry,
      lastCommitAvailability: skippedAvailability
    }));

    return [...enriched, ...skippedEntries];
  }

  private async getContentLastCommit(
    input: RepoContentsInput,
    path: string,
    includeFileStats: boolean
  ): Promise<RepoEntryCommitResult> {
    try {
      const commits = await this.restPaginatedArray<GitHubCommit>(
        "GET /repos/{owner}/{repo}/commits",
        {
          owner: input.owner,
          repo: input.repo,
          path,
          sha: input.ref ?? undefined
        },
        1
      );

      const metadata = mapRepoEntryCommit(commits[0] ?? null);
      const availability: GitHubReadAvailability = metadata
        ? { status: "available", message: null }
        : { status: "available", message: "GitHub returned no commits for this path." };
      if (!metadata?.lastCommitSha || !includeFileStats) {
        return { metadata, availability };
      }

      try {
        const commit = await this.rest<GitHubCommitDetail>("GET /repos/{owner}/{repo}/commits/{ref}", {
          owner: input.owner,
          repo: input.repo,
          ref: metadata.lastCommitSha
        });
        return {
          metadata: { ...metadata, ...mapRepoEntryCommitFileStats(commit.files ?? [], path) },
          availability
        };
      } catch {
        return { metadata, availability };
      }
    } catch (error) {
      return {
        metadata: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getFileContent(input: RepoFileContentInput): Promise<RepoFileContent> {
    const [content, metadata] = await Promise.all([
      this.restText("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: input.owner,
        repo: input.repo,
        path: input.path,
        ref: input.ref ?? undefined,
        headers: { accept: "application/vnd.github.raw" }
      }),
      this.getContentLastCommit(input, input.path, true)
    ]);
    const branch = encodeURIComponent(input.ref ?? "HEAD");
    return {
      path: input.path,
      name: input.path.split("/").pop() ?? input.path,
      ref: input.ref ?? null,
      content,
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/blob/${branch}/${encodePath(input.path)}`,
      downloadUrl: `https://raw.githubusercontent.com/${input.owner}/${input.repo}/${branch}/${encodePath(input.path)}`,
      ...(metadata.metadata ?? emptyRepoEntryCommitMetadata()),
      lastCommitAvailability: metadata.availability
    };
  }

  async getFileContentWithStatus(input: RepoFileContentInput): Promise<RepoFileContentResult> {
    try {
      return {
        item: await this.getFileContent(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        item: null,
        availability: mapGitHubFeatureError(error)
      };
    }
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
    const data = await this.restPaginatedArray<GitHubIssue>(
      "GET /repos/{owner}/{repo}/issues",
      {
        owner: input.owner,
        repo: input.repo,
        state: input.state ?? "open"
      },
      input.limit ?? 50
    );
    return data.filter((issue) => !issue.pull_request).map(mapIssue);
  }

  async listIssuesWithStatus(input: IssueListInput): Promise<IssueListResult> {
    try {
      return {
        items: await this.listIssues(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getIssueDetail(input: IssueDetailInput): Promise<IssueDetail> {
    const [issue, commentsResult] = await Promise.all([
      this.rest<GitHubIssue>("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner: input.owner,
        repo: input.repo,
        issue_number: input.issueNumber
      }),
      this.fetchIssueComments(input.owner, input.repo, input.issueNumber)
    ]);
    return {
      ...mapIssue(issue),
      body: issue.body ?? null,
      commentsList: commentsResult.items.map(mapTimelineComment),
      commentsAvailability: commentsResult.availability
    };
  }

  async getIssueDetailWithStatus(input: IssueDetailInput): Promise<IssueDetailResult> {
    try {
      return {
        detail: await this.getIssueDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        detail: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestSummary[]> {
    const data = await this.restPaginatedArray<GitHubPullRequest>(
      "GET /repos/{owner}/{repo}/pulls",
      {
        owner: input.owner,
        repo: input.repo,
        state: input.state ?? "open"
      },
      input.limit ?? 50
    );
    return data.map(mapPullRequest);
  }

  async listPullRequestsWithStatus(input: PullRequestListInput): Promise<PullRequestListResult> {
    try {
      return {
        items: await this.listPullRequests(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getPullRequestDetail(input: PullRequestDetailInput): Promise<PullRequestDetail> {
    const pullRequest = await this.rest<GitHubPullRequest>("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pullNumber
    });

    const [
      issue,
      commentsResult,
      filesResult,
      commitsResult,
      reviewsResult,
      reviewCommentsResult,
      reviewThreadStatesResult,
      checks,
      timeline,
      linkedIssues,
      reviewDecisionResult
    ] = await Promise.all([
      this.rest<GitHubIssue>("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner: input.owner,
        repo: input.repo,
        issue_number: input.pullNumber
      }),
      this.fetchIssueComments(input.owner, input.repo, input.pullNumber),
      this.fetchPullRequestFiles(input),
      this.fetchPullRequestCommits(input),
      this.fetchPullRequestReviews(input),
      this.fetchPullRequestReviewComments(input),
      this.fetchPullRequestReviewThreadStates(input),
      this.fetchPullRequestChecks(input.owner, input.repo, pullRequest.head?.sha ?? null),
      this.fetchPullRequestTimeline(input),
      this.fetchPullRequestLinkedIssues(input),
      this.fetchPullRequestReviewDecision(input)
    ]);
    const mappedReviews = reviewsResult.items.map(mapPullRequestReview);
    const reviewThreads = groupPullRequestReviewThreads(
      reviewCommentsResult.items,
      reviewThreadStatesResult.items
    );
    return {
      ...mapPullRequest(pullRequest),
      reviewDecision: reviewDecisionResult.reviewDecision,
      body: pullRequest.body ?? null,
      labels: issue.labels.map(mapLabel),
      assignees: (issue.assignees ?? []).map(mapAssignableUser),
      milestone: mapIssueMilestone(issue.milestone),
      commentsList: commentsResult.items.map(mapTimelineComment),
      commentsAvailability: commentsResult.availability,
      files: filesResult.items.map(mapPullRequestFile),
      filesAvailability: filesResult.availability,
      commitsList: commitsResult.items.map(mapPullRequestCommit),
      commitsAvailability: commitsResult.availability,
      requestedReviewers: (pullRequest.requested_reviewers ?? []).map(mapAssignableUser),
      requestedTeams: (pullRequest.requested_teams ?? []).map(mapRequestedTeam),
      reviews: mappedReviews,
      reviewsAvailability: reviewsResult.availability,
      latestReviewState: latestPullRequestReviewState(mappedReviews),
      reviewDecisionAvailability: reviewDecisionResult.availability,
      checks: checks.items,
      checksAvailability: checks.availability,
      reviewThreads,
      reviewThreadsAvailability: reviewCommentsResult.availability,
      reviewThreadStatesAvailability: reviewThreadStatesResult.availability,
      timelineEvents: timeline.items,
      timelineAvailability: timeline.availability,
      linkedIssues: linkedIssues.items,
      linkedIssuesAvailability: linkedIssues.availability
    };
  }

  async getPullRequestDetailWithStatus(input: PullRequestDetailInput): Promise<PullRequestDetailResult> {
    try {
      return {
        detail: await this.getPullRequestDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        detail: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchIssueComments(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<{ items: GitHubIssueComment[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.restPaginatedArray<GitHubIssueComment>(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner,
          repo,
          issue_number: issueNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestReviewComments(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestReviewComment[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.restPaginatedArray<GitHubPullRequestReviewComment>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestReviewThreadStates(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestReviewThreadNode[]; availability: GitHubReadAvailability }> {
    try {
      const allNodes: GitHubPullRequestReviewThreadNode[] = [];
      let hasNextPage = true;
      let after: string | null = null;

      while (hasNextPage) {
        type ReviewThreadsData = {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: GitHubPullRequestReviewThreadNode[];
                pageInfo: { hasNextPage: boolean; endCursor: string | null };
              };
            } | null;
          } | null;
        };
        const data: ReviewThreadsData = await this.graphql<ReviewThreadsData>(
          `
          query PullRequestReviewThreadStates($owner: String!, $repo: String!, $number: Int!, $after: String) {
            repository(owner: $owner, name: $repo) {
              pullRequest(number: $number) {
                reviewThreads(first: 100, after: $after) {
                  pageInfo { hasNextPage endCursor }
                  nodes {
                    id
                    isResolved
                    isOutdated
                    path
                    comments(first: 100) {
                      pageInfo { hasNextPage endCursor }
                      nodes {
                        ${pullRequestReviewThreadCommentNodeSelection}
                      }
                    }
                  }
                }
              }
            }
          }
          `,
          {
            owner: input.owner,
            repo: input.repo,
            number: input.pullNumber,
            after
          }
        );

        const threads:
          | {
              nodes: GitHubPullRequestReviewThreadNode[];
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
            }
          | undefined = data.repository?.pullRequest?.reviewThreads ?? undefined;
        if (threads?.nodes) {
          const nodes = await Promise.all(
            threads.nodes.map((thread) => this.fetchRemainingPullRequestReviewThreadComments(thread))
          );
          allNodes.push(...nodes);
        }
        hasNextPage = threads?.pageInfo?.hasNextPage ?? false;
        after = threads?.pageInfo?.endCursor ?? null;
      }

      return {
        items: allNodes,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchRemainingPullRequestReviewThreadComments(
    thread: GitHubPullRequestReviewThreadNode
  ): Promise<GitHubPullRequestReviewThreadNode> {
    const comments = [...thread.comments.nodes];
    let hasNextPage = thread.comments.pageInfo?.hasNextPage ?? false;
    let after = thread.comments.pageInfo?.endCursor ?? null;

    while (hasNextPage && after) {
      const data = await this.graphql<{
        node: {
          comments: {
            nodes: GitHubPullRequestReviewThreadCommentNode[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        } | null;
      }>(
        `
        query PullRequestReviewThreadComments($threadId: ID!, $after: String) {
          node(id: $threadId) {
            ... on PullRequestReviewThread {
              comments(first: 100, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  ${pullRequestReviewThreadCommentNodeSelection}
                }
              }
            }
          }
        }
        `,
        {
          threadId: thread.id,
          after
        }
      );
      const connection = data.node?.comments;
      comments.push(...(connection?.nodes ?? []));
      hasNextPage = connection?.pageInfo.hasNextPage ?? false;
      after = connection?.pageInfo.endCursor ?? null;
    }

    return {
      ...thread,
      comments: {
        ...thread.comments,
        nodes: comments
      }
    };
  }

  private async fetchPullRequestFiles(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestFile[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.restPaginatedArray<GitHubPullRequestFile>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestCommits(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestCommit[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.restPaginatedArray<GitHubPullRequestCommit>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestReviews(
    input: PullRequestDetailInput
  ): Promise<{ items: GitHubPullRequestReview[]; availability: GitHubReadAvailability }> {
    try {
      const items = await this.restPaginatedArray<GitHubPullRequestReview>(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
        {
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestLinkedIssues(
    input: PullRequestDetailInput
  ): Promise<{ items: PullRequestLinkedIssueSummary[]; availability: GitHubReadAvailability }> {
    try {
      const data = await this.graphql<{
        repository: {
          pullRequest: {
            closingIssuesReferences: {
              nodes: GitHubClosingIssueReferenceNode[];
            };
          } | null;
        } | null;
      }>(
        `
        query PullRequestLinkedIssues($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              closingIssuesReferences(first: 20) {
                nodes {
                  number
                  title
                  state
                  stateReason
                  url
                  repository {
                    nameWithOwner
                  }
                }
              }
            }
          }
        }
      `,
        { owner: input.owner, repo: input.repo, number: input.pullNumber }
      );
      return {
        items: (data.repository?.pullRequest?.closingIssuesReferences.nodes ?? []).map(
          mapPullRequestLinkedIssue
        ),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestTimeline(
    input: PullRequestDetailInput
  ): Promise<{ items: PullRequestTimelineEventSummary[]; availability: GitHubReadAvailability }> {
    try {
      const events = await this.restPaginatedArray<GitHubIssueTimelineEvent>(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
        {
          owner: input.owner,
          repo: input.repo,
          issue_number: input.pullNumber
        },
        Number.MAX_SAFE_INTEGER
      );
      return {
        items: events.map((event) => mapPullRequestTimelineEvent(event, input.owner, input.repo)),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestReviewDecision(
    input: PullRequestDetailInput
  ): Promise<{ reviewDecision: string | null; availability: GitHubReadAvailability }> {
    try {
      const data = await this.graphql<{
        repository: { pullRequest: { reviewDecision: string | null } | null } | null;
      }>(
        `
        query PullRequestReviewDecision($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              reviewDecision
            }
          }
        }
        `,
        { owner: input.owner, repo: input.repo, number: input.pullNumber }
      );
      return {
        reviewDecision: data.repository?.pullRequest?.reviewDecision ?? null,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        reviewDecision: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchPullRequestChecks(
    owner: string,
    repo: string,
    ref: string | null
  ): Promise<{ items: PullRequestCheckSummary[]; availability: GitHubReadAvailability }> {
    if (!ref) {
      return {
        items: [],
        availability: { status: "feature_disabled", message: "Pull request head SHA is unavailable." }
      };
    }

    try {
      const checkRuns = await this.restPaginatedWrapped<GitHubCheckRun, "check_runs">(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
        "check_runs",
        {
          owner,
          repo,
          ref
        },
        100
      );
      return {
        items: checkRuns.map(mapPullRequestCheck),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    return this.fetchDiscussions(input);
  }

  async listDiscussionsWithStatus(input: DiscussionListInput): Promise<DiscussionListResult> {
    try {
      return {
        items: await this.fetchDiscussions(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listDiscussionCategoriesWithStatus(
    input: DiscussionCategoryListInput
  ): Promise<DiscussionCategoryListResult> {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);

    try {
      const data = await this.graphql<{
        repository: {
          discussionCategories: {
            nodes: Array<{
              id: string;
              name: string;
              emoji?: string | null;
              description?: string | null;
              isAnswerable?: boolean | null;
            }>;
          };
        };
      }>(
        `
        query RepositoryDiscussionCategories($owner: String!, $repo: String!, $limit: Int!) {
          repository(owner: $owner, name: $repo) {
            discussionCategories(first: $limit) {
              nodes {
                id
                name
                emoji
                description
                isAnswerable
              }
            }
          }
        }
      `,
        { owner: input.owner, repo: input.repo, limit }
      );

      return {
        items: data.repository.discussionCategories.nodes.map(mapDiscussionCategory),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetailResult> {
    try {
      return {
        item: await this.fetchDiscussionDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        item: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchDiscussions(input: DiscussionListInput): Promise<DiscussionSummary[]> {
    const limit = input.limit ?? 30;
    const data = await this.graphql<{
      repository: {
        discussions: {
          nodes: Array<{
            id: string;
            number: number;
            title: string;
            url: string;
            body?: string | null;
            createdAt?: string;
            updatedAt: string;
            author: { login: string; avatarUrl?: string | null } | null;
            category: { name: string } | null;
            comments: {
              totalCount: number;
              nodes?: GitHubDiscussionCommentNode[];
            };
            answer?: GitHubDiscussionCommentNode | null;
            isAnswered?: boolean | null;
            upvoteCount?: number;
            closed?: boolean;
            locked?: boolean;
          }>;
        };
      };
    }>(
      `
      query RepositoryDiscussions($owner: String!, $repo: String!, $limit: Int!) {
        repository(owner: $owner, name: $repo) {
          discussions(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              url
              body
              createdAt
              updatedAt
              author { login avatarUrl }
              category { name }
              upvoteCount
              isAnswered
              closed
              locked
              answer {
                id
                author { login avatarUrl }
                body
                createdAt
                updatedAt
                url
              }
              comments(first: 20) {
                totalCount
                nodes {
                  id
                  author { login avatarUrl }
                  body
                  createdAt
                  updatedAt
                  url
                }
              }
            }
          }
        }
      }
    `,
      { owner: input.owner, repo: input.repo, limit }
    );

    return data.repository.discussions.nodes.map((discussion) => ({
      id: discussion.id,
      number: discussion.number,
      title: discussion.title,
      authorLogin: discussion.author?.login ?? null,
      authorAvatarUrl: discussion.author?.avatarUrl ?? null,
      category: discussion.category?.name ?? null,
      body: discussion.body ?? null,
      createdAt: discussion.createdAt ?? discussion.updatedAt,
      comments: discussion.comments.totalCount,
      previewComments: (discussion.comments.nodes ?? []).map(mapGraphqlDiscussionComment),
      previewCommentsTruncated: discussion.comments.totalCount > (discussion.comments.nodes ?? []).length,
      answer: discussion.answer ? mapGraphqlDiscussionComment(discussion.answer) : null,
      isAnswered: discussion.isAnswered ?? null,
      upvotes: discussion.upvoteCount ?? 0,
      closed: discussion.closed ?? false,
      locked: discussion.locked ?? false,
      updatedAt: discussion.updatedAt,
      htmlUrl: discussion.url
    }));
  }

  private async fetchDiscussionDetail(input: DiscussionDetailInput): Promise<DiscussionDetail | null> {
    const commentsLimit = boundedGitHubGraphqlConnectionLimit(
      input.commentsLimit,
      defaultDiscussionDetailCommentsLimit,
      maxDiscussionDetailCommentsLimit
    );
    const repliesLimit = boundedGitHubGraphqlConnectionLimit(
      input.repliesLimit,
      defaultDiscussionDetailRepliesLimit,
      maxDiscussionDetailRepliesLimit
    );
    const allCommentNodes: GitHubDiscussionCommentNode[] = [];
    let discussionMeta: {
      id: string;
      number: number;
      title: string;
      url: string;
      body?: string | null;
      createdAt?: string;
      updatedAt: string;
      author: { login: string; avatarUrl?: string | null } | null;
      category: { name: string } | null;
      answer?: GitHubDiscussionCommentNode | null;
      isAnswered?: boolean | null;
      upvoteCount?: number;
      closed?: boolean;
      locked?: boolean;
    } | null = null;
    let totalComments = 0;
    let hasNextPage = true;
    let after: string | null = null;

    while (hasNextPage && allCommentNodes.length < commentsLimit) {
      const commentsPageSize = Math.min(
        githubGraphqlConnectionPageLimit,
        commentsLimit - allCommentNodes.length
      );
      const repliesPageSize = Math.min(githubGraphqlConnectionPageLimit, repliesLimit);
      type DiscussionDetailData = {
        repository: {
          discussion: {
            id: string;
            number: number;
            title: string;
            url: string;
            body?: string | null;
            createdAt?: string;
            updatedAt: string;
            author: { login: string; avatarUrl?: string | null } | null;
            category: { name: string } | null;
            comments: {
              totalCount: number;
              nodes?: GitHubDiscussionCommentNode[];
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
            };
            answer?: GitHubDiscussionCommentNode | null;
            isAnswered?: boolean | null;
            upvoteCount?: number;
            closed?: boolean;
            locked?: boolean;
          } | null;
        };
      };
      const data: DiscussionDetailData = await this.graphql<DiscussionDetailData>(
        `
        query RepositoryDiscussionDetail(
          $owner: String!
          $repo: String!
          $number: Int!
          $commentsPageSize: Int!
          $commentsAfter: String
          $repliesPageSize: Int!
        ) {
          repository(owner: $owner, name: $repo) {
            discussion(number: $number) {
              id
              number
              title
              url
              body
              createdAt
              updatedAt
              author { login avatarUrl }
              category { name }
              upvoteCount
              isAnswered
              closed
              locked
              answer {
                ${discussionCommentNodeSelection}
              }
              comments(first: $commentsPageSize, after: $commentsAfter) {
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes {
                  ${discussionCommentNodeSelection}
                  replies(first: $repliesPageSize) {
                    totalCount
                    pageInfo { hasNextPage endCursor }
                    nodes {
                      ${discussionCommentNodeSelection}
                    }
                  }
                }
              }
            }
          }
        }
      `,
        {
          owner: input.owner,
          repo: input.repo,
          number: input.discussionNumber,
          commentsPageSize,
          commentsAfter: after,
          repliesPageSize
        }
      );

      const discussion: DiscussionDetailData["repository"]["discussion"] | undefined =
        data.repository.discussion ?? undefined;
      if (!discussion) {
        return null;
      }

      discussionMeta ??= discussion;
      totalComments = discussion.comments.totalCount;
      allCommentNodes.push(...(discussion.comments.nodes ?? []));
      hasNextPage =
        allCommentNodes.length < commentsLimit && (discussion.comments.pageInfo?.hasNextPage ?? false);
      after = discussion.comments.pageInfo?.endCursor ?? null;
    }

    if (!discussionMeta) {
      return null;
    }

    const commentsList = await Promise.all(
      allCommentNodes.map(async (comment) => {
        const replyNodes = await this.fetchDiscussionCommentReplies(comment, repliesLimit);
        return {
          ...mapGraphqlDiscussionComment(comment),
          replies: replyNodes.map(mapGraphqlDiscussionComment),
          repliesTruncated: (comment.replies?.totalCount ?? replyNodes.length) > replyNodes.length
        };
      })
    );

    return {
      id: discussionMeta.id,
      number: discussionMeta.number,
      title: discussionMeta.title,
      authorLogin: discussionMeta.author?.login ?? null,
      authorAvatarUrl: discussionMeta.author?.avatarUrl ?? null,
      category: discussionMeta.category?.name ?? null,
      body: discussionMeta.body ?? null,
      createdAt: discussionMeta.createdAt ?? discussionMeta.updatedAt,
      comments: totalComments,
      previewComments: commentsList,
      previewCommentsTruncated: totalComments > commentsList.length,
      commentsList,
      commentsTruncated: totalComments > commentsList.length,
      answer: discussionMeta.answer ? mapGraphqlDiscussionComment(discussionMeta.answer) : null,
      isAnswered: discussionMeta.isAnswered ?? null,
      upvotes: discussionMeta.upvoteCount ?? 0,
      closed: discussionMeta.closed ?? false,
      locked: discussionMeta.locked ?? false,
      updatedAt: discussionMeta.updatedAt,
      htmlUrl: discussionMeta.url
    };
  }

  private async fetchDiscussionCommentReplies(
    comment: GitHubDiscussionCommentNode,
    repliesLimit: number
  ): Promise<GitHubDiscussionCommentNode[]> {
    const initialReplies = comment.replies?.nodes ?? [];
    const totalReplies = comment.replies?.totalCount ?? initialReplies.length;
    const replies = initialReplies.slice(0, repliesLimit);
    let hasNextPage =
      replies.length < repliesLimit &&
      replies.length < totalReplies &&
      (comment.replies?.pageInfo?.hasNextPage ?? false);
    let after = comment.replies?.pageInfo?.endCursor ?? null;

    while (hasNextPage && after) {
      const repliesPageSize = Math.min(githubGraphqlConnectionPageLimit, repliesLimit - replies.length);
      const data = await this.graphql<{
        node: {
          replies: {
            totalCount: number;
            nodes?: GitHubDiscussionCommentNode[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        } | null;
      }>(
        `
        query DiscussionCommentReplies($commentId: ID!, $repliesPageSize: Int!, $after: String) {
          node(id: $commentId) {
            ... on DiscussionComment {
              replies(first: $repliesPageSize, after: $after) {
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes {
                  ${discussionCommentNodeSelection}
                }
              }
            }
          }
        }
        `,
        {
          commentId: comment.id,
          repliesPageSize,
          after
        }
      );
      const connection = data.node?.replies;
      const pageReplies = connection?.nodes ?? [];
      replies.push(...pageReplies);
      hasNextPage =
        replies.length < repliesLimit &&
        replies.length < (connection?.totalCount ?? totalReplies) &&
        (connection?.pageInfo?.hasNextPage ?? false);
      after = connection?.pageInfo?.endCursor ?? null;
    }

    return replies.slice(0, repliesLimit);
  }

  async listActions(input: ActionsInput): Promise<WorkflowRunSummary[]> {
    const workflowRuns = await this.restPaginatedWrapped<GitHubWorkflowRun, "workflow_runs">(
      "GET /repos/{owner}/{repo}/actions/runs",
      "workflow_runs",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 30
    );
    return workflowRuns.map(mapWorkflowRun);
  }

  async listActionsWithStatus(input: ActionsInput): Promise<WorkflowRunListResult> {
    try {
      return {
        items: await this.listActions(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listWorkflows(input: WorkflowListInput): Promise<WorkflowDefinitionSummary[]> {
    const limit = Math.min(
      Math.max(input.limit ?? defaultWorkflowDefinitionLimit, 0),
      maxWorkflowDefinitionLimit
    );
    const workflows = await this.restPaginatedWrapped<GitHubWorkflowDefinition, "workflows">(
      "GET /repos/{owner}/{repo}/actions/workflows",
      "workflows",
      {
        owner: input.owner,
        repo: input.repo
      },
      limit
    );

    return Promise.all(
      workflows.map(async (workflow) => {
        const dispatch = await this.fetchWorkflowDispatchMetadata(input, workflow.path);
        return {
          id: workflow.id,
          nodeId: workflow.node_id ?? null,
          name: workflow.name,
          path: workflow.path,
          state: workflow.state,
          htmlUrl: workflow.html_url ?? null,
          badgeUrl: workflow.badge_url ?? null,
          createdAt: workflow.created_at ?? null,
          updatedAt: workflow.updated_at ?? null,
          ...dispatch
        };
      })
    );
  }

  async listWorkflowsWithStatus(input: WorkflowListInput): Promise<WorkflowDefinitionListResult> {
    try {
      return {
        items: await this.listWorkflows(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchWorkflowDispatchMetadata(
    input: WorkflowListInput,
    path: string
  ): Promise<Pick<WorkflowDefinitionSummary, "dispatchable" | "inputs" | "inputsUnavailableMessage">> {
    try {
      const content = await this.restText("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: input.owner,
        repo: input.repo,
        path,
        ref: input.ref ?? undefined,
        headers: { accept: "application/vnd.github.raw" }
      });
      return parseWorkflowDispatchMetadata(content);
    } catch (error) {
      return {
        dispatchable: false,
        inputs: [],
        inputsUnavailableMessage:
          error instanceof Error ? error.message : "Workflow dispatch inputs could not be loaded."
      };
    }
  }

  async getWorkflowRunDetail(input: WorkflowRunDetailInput): Promise<WorkflowRunDetail> {
    const run = await this.rest<GitHubWorkflowRun>("GET /repos/{owner}/{repo}/actions/runs/{run_id}", {
      owner: input.owner,
      repo: input.repo,
      run_id: input.runId
    });

    const [jobsResult, artifactsResult, checks, logs] = await Promise.all([
      this.restPaginatedWrapped<GitHubWorkflowJob, "jobs">(
        "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
        "jobs",
        {
          owner: input.owner,
          repo: input.repo,
          run_id: input.runId
        },
        100
      )
        .then((jobs) => ({
          jobs,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          jobs: [],
          availability: mapGitHubFeatureError(error)
        })),
      this.restPaginatedWrapped<GitHubWorkflowArtifact, "artifacts">(
        "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
        "artifacts",
        {
          owner: input.owner,
          repo: input.repo,
          run_id: input.runId
        },
        100
      )
        .then((artifacts) => ({
          artifacts,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          artifacts: [],
          availability: mapGitHubFeatureError(error)
        })),
      this.fetchWorkflowChecks(input.owner, input.repo, run.head_sha),
      this.fetchWorkflowRunLogs(input.owner, input.repo, input.runId, run.logs_url ?? null)
    ]);

    const artifactSummaries = await Promise.all(
      artifactsResult.artifacts.map((artifact) => this.mapWorkflowArtifact(input.owner, input.repo, artifact))
    );

    return {
      ...mapWorkflowRun(run),
      jobs: jobsResult.jobs.map(mapWorkflowJob),
      jobsAvailability: jobsResult.availability,
      artifacts: artifactSummaries,
      artifactsAvailability: artifactsResult.availability,
      checkSuites: checks.checkSuites,
      checkSuitesAvailability: checks.checkSuitesAvailability,
      checkRuns: checks.checkRuns,
      checkRunsAvailability: checks.checkRunsAvailability,
      logs
    };
  }

  async getWorkflowRunDetailWithStatus(input: WorkflowRunDetailInput): Promise<WorkflowRunDetailResult> {
    try {
      return {
        detail: await this.getWorkflowRunDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        detail: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async getWorkflowJobLogs(input: WorkflowJobLogsInput): Promise<WorkflowJobLogsResult> {
    const maxCharacters = Math.min(Math.max(input.maxCharacters ?? 12_000, 1_000), 50_000);

    try {
      const response = await this.restResponse<void>("GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs", {
        owner: input.owner,
        repo: input.repo,
        job_id: input.jobId,
        request: { redirect: "manual" }
      });
      const downloadUrl = getResponseHeader(response.headers, "location");
      if (!downloadUrl) {
        return {
          jobId: input.jobId,
          text: "",
          truncated: false,
          downloadUrl: null,
          availability: {
            status: "error",
            message: "GitHub did not return a temporary job log URL."
          }
        };
      }

      const logResponse = await fetch(downloadUrl, { headers: { accept: "text/plain" } });
      if (!logResponse.ok) {
        return {
          jobId: input.jobId,
          text: "",
          truncated: false,
          downloadUrl,
          availability: {
            status: "error",
            message: `GitHub returned ${logResponse.status} while downloading job logs.`
          }
        };
      }

      const text = await logResponse.text();
      return {
        jobId: input.jobId,
        text: text.slice(0, maxCharacters),
        truncated: text.length > maxCharacters,
        downloadUrl,
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        jobId: input.jobId,
        text: "",
        truncated: false,
        downloadUrl: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchWorkflowChecks(
    owner: string,
    repo: string,
    ref: string | null
  ): Promise<
    Pick<WorkflowRunDetail, "checkSuites" | "checkSuitesAvailability" | "checkRuns" | "checkRunsAvailability">
  > {
    if (!ref) {
      const availability: GitHubReadAvailability = {
        status: "feature_disabled",
        message: "Workflow run check data cannot be loaded because GitHub did not return a head SHA."
      };
      return {
        checkSuites: [],
        checkSuitesAvailability: availability,
        checkRuns: [],
        checkRunsAvailability: availability
      };
    }

    const [suitesResult, runsResult] = await Promise.all([
      this.restPaginatedWrapped<GitHubCheckSuite, "check_suites">(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-suites",
        "check_suites",
        {
          owner,
          repo,
          ref
        },
        100
      )
        .then((checkSuites) => ({
          checkSuites,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          checkSuites: [],
          availability: mapGitHubFeatureError(error)
        })),
      this.restPaginatedWrapped<GitHubCheckRun, "check_runs">(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
        "check_runs",
        {
          owner,
          repo,
          ref
        },
        100
      )
        .then((checkRuns) => ({
          checkRuns,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          checkRuns: [],
          availability: mapGitHubFeatureError(error)
        }))
    ]);

    const checkRuns = await Promise.all(
      runsResult.checkRuns.map(async (checkRun) => {
        const mapped = mapWorkflowCheckRun(checkRun);
        if (mapped.annotationsCount === 0) {
          return mapped;
        }

        try {
          const annotations = await this.restPaginatedArray<GitHubCheckRunAnnotation>(
            "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations",
            {
              owner,
              repo,
              check_run_id: mapped.id
            },
            workflowCheckRunAnnotationLimit
          );
          return {
            ...mapped,
            annotations: annotations.map((annotation) =>
              mapWorkflowCheckRunAnnotation(owner, repo, ref, annotation)
            ),
            annotationsAvailability: { status: "available", message: null } as GitHubReadAvailability
          };
        } catch (error) {
          return {
            ...mapped,
            annotations: [],
            annotationsAvailability: mapGitHubFeatureError(error)
          };
        }
      })
    );

    return {
      checkSuites: suitesResult.checkSuites.map(mapWorkflowCheckSuite),
      checkSuitesAvailability: suitesResult.availability,
      checkRuns,
      checkRunsAvailability: runsResult.availability
    };
  }

  private async mapWorkflowArtifact(
    owner: string,
    repo: string,
    artifact: GitHubWorkflowArtifact
  ): Promise<WorkflowRunArtifactSummary> {
    const archiveDownload = await this.fetchWorkflowArtifactArchiveDownloadUrl(owner, repo, artifact);
    return mapWorkflowArtifact(artifact, archiveDownload.url, archiveDownload.availability);
  }

  private async fetchWorkflowArtifactArchiveDownloadUrl(
    owner: string,
    repo: string,
    artifact: GitHubWorkflowArtifact
  ): Promise<{ url: string | null; availability: GitHubReadAvailability }> {
    if (artifact.expired) {
      return {
        url: null,
        availability: {
          status: "feature_disabled",
          message: "This artifact has expired and can no longer be downloaded."
        }
      };
    }

    try {
      const response = await this.restResponse<void>(
        "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
        {
          owner,
          repo,
          artifact_id: artifact.id,
          archive_format: "zip",
          request: { redirect: "manual" }
        }
      );
      const url = getResponseHeader(response.headers, "location");
      return {
        url,
        availability: url
          ? { status: "available", message: null }
          : {
              status: "error",
              message: "GitHub did not return a temporary artifact download URL."
            }
      };
    } catch (error) {
      return {
        url: null,
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchWorkflowRunLogs(
    owner: string,
    repo: string,
    runId: number,
    apiUrl: string | null
  ): Promise<WorkflowRunLogsSummary> {
    if (!apiUrl) {
      const availability: GitHubReadAvailability = {
        status: "feature_disabled",
        message: "GitHub did not return a logs endpoint for this workflow run."
      };
      return {
        apiUrl: null,
        downloadUrl: null,
        available: false,
        message: availability.message,
        availability
      };
    }

    try {
      const response = await this.restResponse<void>("GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs", {
        owner,
        repo,
        run_id: runId,
        request: { redirect: "manual" }
      });
      const downloadUrl = getResponseHeader(response.headers, "location");
      const availability: GitHubReadAvailability = downloadUrl
        ? { status: "available", message: null }
        : {
            status: "error",
            message: "GitHub did not return a temporary log download URL."
          };
      return {
        apiUrl,
        downloadUrl,
        available: Boolean(downloadUrl),
        message: availability.message,
        availability
      };
    } catch (error) {
      const availability = mapGitHubFeatureError(error);
      return {
        apiUrl,
        downloadUrl: null,
        available: false,
        message: availability.message,
        availability
      };
    }
  }

  async listProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    return this.fetchProjects(input);
  }

  async listProjectsWithStatus(input: ProjectsInput): Promise<ProjectListResult> {
    try {
      return {
        items: await this.fetchProjects(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  private async fetchProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    const limit = input.limit ?? 20;
    const data = await this.graphql<{
      repository: {
        projectsV2: {
          nodes: GitHubProjectV2Node[];
        };
      };
    }>(
      `
      query RepositoryProjects($owner: String!, $repo: String!, $limit: Int!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              shortDescription
              readme
              public
              closed
              closedAt
              createdAt
              updatedAt
              viewerCanUpdate
              url
              owner {
                __typename
                ... on Organization { login url }
                ... on User { login url }
                ... on Repository { nameWithOwner url }
              }
              items(first: 20) {
                totalCount
                nodes {
                  id
                  type
                  createdAt
                  updatedAt
                  fieldValues(first: 20) {
                    totalCount
                    nodes {
                      __typename
                      ... on ProjectV2ItemFieldValueCommon {
                        id
                        field { ...ProjectV2FieldMetadata }
                      }
                      ... on ProjectV2ItemFieldTextValue {
                        text
                      }
                      ... on ProjectV2ItemFieldNumberValue {
                        number
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        date
                      }
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        optionId
                      }
                      ... on ProjectV2ItemFieldIterationValue {
                        title
                      }
                    }
                  }
                  content {
                    __typename
                    ... on Issue {
                      id
                      number
                      title
                      url
                      state
                      body
                      repository { nameWithOwner }
                    }
                    ... on PullRequest {
                      id
                      number
                      title
                      url
                      state
                      merged
                      isDraft
                      body
                      repository { nameWithOwner }
                    }
                    ... on DraftIssue {
                      id
                      title
                      body
                      createdAt
                      updatedAt
                    }
                  }
                }
              }
              fields(first: 12) {
                totalCount
                nodes {
                  ...ProjectV2FieldMetadata
                }
              }
            }
          }
        }
      }

      fragment ProjectV2FieldMetadata on ProjectV2FieldConfiguration {
        ... on ProjectV2Field {
          id
          name
          dataType
        }
        ... on ProjectV2SingleSelectField {
          id
          name
          dataType
          options {
            id
            name
          }
        }
        ... on ProjectV2IterationField {
          id
          name
          dataType
        }
      }
    `,
      { owner: input.owner, repo: input.repo, limit }
    );

    return data.repository.projectsV2.nodes.map(mapProjectV2);
  }

  async getBranchProtection(input: BranchProtectionInput): Promise<BranchProtectionResult> {
    try {
      const protection = await this.rest<GitHubBranchProtection>(
        "GET /repos/{owner}/{repo}/branches/{branch}/protection",
        {
          owner: input.owner,
          repo: input.repo,
          branch: input.branch
        }
      );

      return {
        protection: mapBranchProtection(input.branch, protection),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        protection: null,
        availability: mapBranchProtectionError(input.branch, error)
      };
    }
  }

  async listDependabotAlerts(input: DependabotAlertsInput): Promise<DependabotAlertsResult> {
    try {
      const alerts = await this.restPaginatedArray<GitHubDependabotAlert>(
        "GET /repos/{owner}/{repo}/dependabot/alerts",
        {
          owner: input.owner,
          repo: input.repo,
          state: input.state ?? "open"
        },
        input.limit ?? 30
      );

      return {
        items: alerts.map(mapDependabotAlert),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Dependabot alerts", error)
      };
    }
  }

  async listCodeScanningAlerts(input: CodeScanningAlertsInput): Promise<CodeScanningAlertsResult> {
    try {
      const alerts = await this.restPaginatedArray<GitHubCodeScanningAlert>(
        "GET /repos/{owner}/{repo}/code-scanning/alerts",
        {
          owner: input.owner,
          repo: input.repo,
          state: input.state ?? "open"
        },
        input.limit ?? 30
      );

      return {
        items: alerts.map(mapCodeScanningAlert),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Code scanning alerts", error)
      };
    }
  }

  async listSecretScanningAlerts(input: SecretScanningAlertsInput): Promise<SecretScanningAlertsResult> {
    try {
      const alerts = await this.restPaginatedArray<GitHubSecretScanningAlert>(
        "GET /repos/{owner}/{repo}/secret-scanning/alerts",
        {
          owner: input.owner,
          repo: input.repo,
          state: input.state ?? "open"
        },
        input.limit ?? 30
      );

      return {
        items: alerts.map(mapSecretScanningAlert),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Secret scanning alerts", error)
      };
    }
  }

  async listRepositoryRulesets(input: RepositoryRulesetsInput): Promise<RepositoryRulesetsResult> {
    try {
      const rulesets = await this.restPaginatedArray<GitHubRepositoryRuleset>(
        "GET /repos/{owner}/{repo}/rulesets",
        {
          owner: input.owner,
          repo: input.repo,
          includes_parents: input.includesParents ?? true
        },
        input.limit ?? 30
      );

      return {
        items: rulesets.map(mapRepositoryRuleset),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Repository rulesets", error)
      };
    }
  }

  async listRepositoryForks(input: RepositoryForksInput): Promise<RepositoryForksResult> {
    try {
      const forks = await this.restPaginatedArray<GitHubRestRepositoryRef>(
        "GET /repos/{owner}/{repo}/forks",
        {
          owner: input.owner,
          repo: input.repo,
          sort: input.sort ?? "newest"
        },
        input.limit ?? 30
      );

      return {
        items: forks.map(mapRestRepositoryRef).filter((item): item is RepositoryRef => Boolean(item)),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listRepositorySecurityAdvisories(
    input: RepositorySecurityAdvisoriesInput
  ): Promise<RepositorySecurityAdvisoriesResult> {
    try {
      const advisories = await this.restPaginatedArray<GitHubRepositorySecurityAdvisory>(
        "GET /repos/{owner}/{repo}/security-advisories",
        {
          owner: input.owner,
          repo: input.repo
        },
        input.limit ?? 30
      );

      return {
        items: advisories.map(mapRepositorySecurityAdvisory),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapRepositorySecurityError("Security advisories", error)
      };
    }
  }

  async getRepositorySecurityPolicy(
    input: RepositorySecurityPolicyInput
  ): Promise<RepositorySecurityPolicyResult> {
    try {
      for (const path of securityPolicyCandidatePaths) {
        try {
          const item = await this.rest<GitHubContentFile>("GET /repos/{owner}/{repo}/contents/{path}", {
            owner: input.owner,
            repo: input.repo,
            path,
            ref: input.ref ?? undefined
          });

          return {
            policy: mapRepositorySecurityPolicy(input, item),
            availability: { status: "available", message: null }
          };
        } catch (error) {
          if (isGitHubStatus(error, 404)) {
            continue;
          }
          throw error;
        }
      }

      return {
        policy: null,
        availability: {
          status: "available",
          message: "No security policy file found in SECURITY.md, .github/SECURITY.md, or docs/SECURITY.md."
        }
      };
    } catch (error) {
      return {
        policy: null,
        availability: mapRepositorySecurityError("Security policy", error)
      };
    }
  }

  async getRepositoryCommunityProfile(
    input: RepositoryCommunityProfileInput
  ): Promise<RepositoryCommunityProfileResult> {
    try {
      const profile = await this.rest<GitHubCommunityProfile>("GET /repos/{owner}/{repo}/community/profile", {
        owner: input.owner,
        repo: input.repo
      });

      return {
        profile: mapCommunityProfile(profile),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        profile: null,
        availability: mapRepositorySecurityError("Community profile", error)
      };
    }
  }

  async listReleases(input: ReleasesInput): Promise<ReleaseSummary[]> {
    const data = await this.restPaginatedArray<GitHubRelease>(
      "GET /repos/{owner}/{repo}/releases",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 20
    );
    return data.map((release) => ({
      id: release.id,
      name: release.name,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish ?? null,
      body: release.body ?? null,
      isDraft: release.draft,
      isPrerelease: release.prerelease,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      assets: (release.assets ?? []).map((asset) => ({
        id: asset.id,
        name: asset.name,
        label: asset.label ?? null,
        state: asset.state ?? null,
        contentType: asset.content_type ?? null,
        sizeInBytes: asset.size,
        downloadCount: asset.download_count ?? 0,
        browserDownloadUrl: asset.browser_download_url ?? null,
        createdAt: asset.created_at ?? null,
        updatedAt: asset.updated_at ?? null
      }))
    }));
  }

  async listReleasesWithStatus(input: ReleasesInput): Promise<ReleaseListResult> {
    try {
      return {
        items: await this.listReleases(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async listContributors(input: ContributorsInput): Promise<ContributorSummary[]> {
    const data = await this.restPaginatedArray<GitHubContributor>(
      "GET /repos/{owner}/{repo}/contributors",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 24
    );
    return data.map((contributor) => ({
      id: contributor.id,
      login: contributor.login,
      avatarUrl: contributor.avatar_url,
      htmlUrl: contributor.html_url,
      contributions: contributor.contributions
    }));
  }

  async listContributorsWithStatus(input: ContributorsInput): Promise<ContributorListResult> {
    try {
      return {
        items: await this.listContributors(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async search(input: SearchInput): Promise<RepositorySummary[]> {
    if (!input.query.trim()) {
      return [];
    }

    const limit = input.limit ?? 12;
    const data = await this.graphql<{ search: { nodes: GitHubRepositoryNode[] } }>(
      `
      query RepositorySearch($searchQuery: String!, $limit: Int!) {
        search(query: $searchQuery, type: REPOSITORY, first: $limit) {
          nodes {
            ... on Repository {
              ...RepositorySummaryFields
            }
          }
        }
      }

      ${repositorySummaryFragment}
    `,
      { searchQuery: input.query, limit }
    );

    return data.search.nodes.filter(Boolean).map(mapRepositorySummary);
  }

  async searchWithStatus(input: SearchInput): Promise<RepositorySearchResult> {
    try {
      return {
        items: await this.search(input),
        availability: { status: "available", message: null }
      };
    } catch (error) {
      return {
        items: [],
        availability: mapGitHubFeatureError(error)
      };
    }
  }

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult> {
    const data = await this.performMutation(input);
    return {
      ok: true,
      action: input.action,
      message: `${input.action} completed.`,
      data
    } as TResult;
  }

  private async performMutation(input: GitHubMutationInput): Promise<unknown> {
    const { owner, repo } = input;
    const payload = input as GitHubMutationRuntimePayload;

    switch (input.action) {
      case "star":
        return this.rest("PUT /user/starred/{owner}/{repo}", { owner, repo });
      case "unstar":
        return this.rest("DELETE /user/starred/{owner}/{repo}", { owner, repo });
      case "watch":
        return this.rest("PUT /repos/{owner}/{repo}/subscription", {
          owner,
          repo,
          subscribed: true,
          ignored: false
        });
      case "unwatch":
        return this.rest("DELETE /repos/{owner}/{repo}/subscription", { owner, repo });
      case "fork":
        return this.rest("POST /repos/{owner}/{repo}/forks", { owner, repo });
      case "editRepository": {
        const repository = await this.rest("PATCH /repos/{owner}/{repo}", {
          owner,
          repo,
          ...pick(payload, [
            "description",
            "homepage",
            "default_branch",
            "archived",
            "has_issues",
            "has_projects",
            "has_wiki",
            "has_discussions",
            "allow_merge_commit",
            "allow_squash_merge",
            "allow_rebase_merge",
            "allow_auto_merge",
            "delete_branch_on_merge",
            "allow_update_branch",
            "allow_forking",
            "web_commit_signoff_required"
          ])
        });
        if (Array.isArray(payload.topics)) {
          const topics = await this.rest("PUT /repos/{owner}/{repo}/topics", {
            owner,
            repo,
            names: stringArray(payload.topics)
          });
          return { repository, topics };
        }
        return repository;
      }
      case "createIssue":
        return this.rest("POST /repos/{owner}/{repo}/issues", {
          owner,
          repo,
          ...pick(payload, ["title", "body", "labels", "assignees", "milestone"])
        });
      case "editIssue":
        return this.rest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["title", "body", "state", "labels", "assignees", "milestone"])
        });
      case "closeIssue":
        return this.rest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          state: "closed",
          state_reason: typeof payload.stateReason === "string" ? payload.stateReason : "completed"
        });
      case "reopenIssue":
        return this.rest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          state: "open"
        });
      case "addComment":
        return this.rest("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["body"])
        });
      case "editComment":
        return this.rest("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId"),
          ...pick(payload, ["body"])
        });
      case "deleteComment":
        return this.rest("DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId")
        });
      case "editReviewComment":
        return this.rest("PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId"),
          ...pick(payload, ["body"])
        });
      case "deleteReviewComment":
        return this.rest("DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId")
        });
      case "addLabels":
        return this.rest("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["labels"])
        });
      case "removeLabel":
        return this.rest("DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          name: getString(payload, "name")
        });
      case "setAssignees":
        return this.rest("POST /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["assignees"])
        });
      case "removeAssignees":
        return this.rest("DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["assignees"])
        });
      case "createPullRequest":
        return this.rest("POST /repos/{owner}/{repo}/pulls", {
          owner,
          repo,
          ...pick(payload, ["title", "head", "base", "body", "draft", "maintainer_can_modify"])
        });
      case "mergePullRequest":
        return this.rest("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          ...pick(payload, ["commit_title", "commit_message", "merge_method", "sha"])
        });
      case "closePullRequest":
        return this.rest("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          state: "closed"
        });
      case "reopenPullRequest":
        return this.rest("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          state: "open"
        });
      case "approvePullRequest":
        return this.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          body: typeof payload.body === "string" ? payload.body : "",
          event: "APPROVE"
        });
      case "commentPullRequestReview":
        return this.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          body: typeof payload.body === "string" ? payload.body : "",
          event: "COMMENT"
        });
      case "requestChanges":
        return this.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          body: typeof payload.body === "string" ? payload.body : "Changes requested from Control.",
          event: "REQUEST_CHANGES"
        });
      case "requestReviewers":
        return this.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          reviewers: stringArray(payload.reviewers),
          team_reviewers: stringArray(payload.teamReviewers)
        });
      case "removeReviewers":
        return this.rest("DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          reviewers: stringArray(payload.reviewers),
          team_reviewers: stringArray(payload.teamReviewers)
        });
      case "rerunWorkflow":
        return this.rest("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun", {
          owner,
          repo,
          run_id: getNumber(payload, "runId")
        });
      case "rerunFailedWorkflowJobs":
        return this.rest("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs", {
          owner,
          repo,
          run_id: getNumber(payload, "runId")
        });
      case "rerunWorkflowJob":
        return this.rest("POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun", {
          owner,
          repo,
          job_id: getNumber(payload, "jobId")
        });
      case "dispatchWorkflow":
        return this.rest("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
          owner,
          repo,
          workflow_id: getString(payload, "workflowId"),
          ref: getString(payload, "ref"),
          inputs: typeof payload.inputs === "object" && payload.inputs !== null ? payload.inputs : undefined
        });
      case "cancelWorkflow":
        return this.rest("POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel", {
          owner,
          repo,
          run_id: getNumber(payload, "runId")
        });
      case "createRelease":
        return this.rest("POST /repos/{owner}/{repo}/releases", {
          owner,
          repo,
          ...pick(payload, [
            "tag_name",
            "target_commitish",
            "name",
            "body",
            "draft",
            "prerelease",
            "make_latest"
          ])
        });
      case "editRelease":
        return this.rest("PATCH /repos/{owner}/{repo}/releases/{release_id}", {
          owner,
          repo,
          release_id: getNumber(payload, "releaseId"),
          ...pick(payload, [
            "tag_name",
            "target_commitish",
            "name",
            "body",
            "draft",
            "prerelease",
            "make_latest"
          ])
        });
      case "deleteRelease":
        return this.rest("DELETE /repos/{owner}/{repo}/releases/{release_id}", {
          owner,
          repo,
          release_id: getNumber(payload, "releaseId")
        });
      case "deleteReleaseAsset":
        return this.rest("DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}", {
          owner,
          repo,
          asset_id: getNumber(payload, "assetId")
        });
      case "updateBranchProtection":
        return this.rest("PUT /repos/{owner}/{repo}/branches/{branch}/protection", {
          owner,
          repo,
          branch: getString(payload, "branch"),
          required_status_checks: payload.required_status_checks ?? null,
          enforce_admins: payload.enforce_admins ?? null,
          required_pull_request_reviews: payload.required_pull_request_reviews ?? null,
          restrictions: payload.restrictions ?? null,
          required_linear_history: payload.required_linear_history ?? false,
          allow_force_pushes: payload.allow_force_pushes ?? false,
          allow_deletions: payload.allow_deletions ?? false,
          block_creations: payload.block_creations ?? false,
          required_conversation_resolution: payload.required_conversation_resolution ?? false,
          lock_branch: payload.lock_branch ?? false,
          allow_fork_syncing: payload.allow_fork_syncing ?? false
        });
      case "deleteBranchProtection":
        return this.rest("DELETE /repos/{owner}/{repo}/branches/{branch}/protection", {
          owner,
          repo,
          branch: getString(payload, "branch")
        });
      case "addRepositoryCollaborator":
        return this.rest("PUT /repos/{owner}/{repo}/collaborators/{username}", {
          owner,
          repo,
          username: getString(payload, "username"),
          permission: payload.permission ?? "push"
        });
      case "removeRepositoryCollaborator":
        return this.rest("DELETE /repos/{owner}/{repo}/collaborators/{username}", {
          owner,
          repo,
          username: getString(payload, "username")
        });
      case "updateCollaboratorPermission":
        return this.rest("PUT /repos/{owner}/{repo}/collaborators/{username}", {
          owner,
          repo,
          username: getString(payload, "username"),
          permission: getString(payload, "permission")
        });
      case "addRepositoryTeam":
        return this.rest("PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}", {
          org: owner,
          team_slug: getString(payload, "teamSlug"),
          owner,
          repo,
          permission: payload.permission ?? "push"
        });
      case "removeRepositoryTeam":
        return this.rest("DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}", {
          org: owner,
          team_slug: getString(payload, "teamSlug"),
          owner,
          repo
        });
      case "updateTeamPermission":
        return this.rest("PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}", {
          org: owner,
          team_slug: getString(payload, "teamSlug"),
          owner,
          repo,
          permission: getString(payload, "permission")
        });
      case "createRepositoryRuleset":
        return this.rest("POST /repos/{owner}/{repo}/rulesets", {
          owner,
          repo,
          name: getString(payload, "name"),
          target: payload.target ?? "branch",
          enforcement: getString(payload, "enforcement"),
          bypass_actors: payload.bypass_actors ?? [],
          conditions: payload.conditions ?? {},
          rules: payload.rules ?? []
        });
      case "updateRepositoryRuleset":
        return this.rest("PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
          owner,
          repo,
          ruleset_id: getNumber(payload, "rulesetId"),
          name: getString(payload, "name"),
          target: payload.target ?? "branch",
          enforcement: getString(payload, "enforcement"),
          bypass_actors: payload.bypass_actors ?? [],
          conditions: payload.conditions ?? {},
          rules: payload.rules ?? []
        });
      case "deleteRepositoryRuleset":
        return this.rest("DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
          owner,
          repo,
          ruleset_id: getNumber(payload, "rulesetId")
        });
      case "createDiscussion": {
        const repoData = await this.graphql<{ repository: { id: string } }>(
          `query RepoId($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) { id }
          }`,
          { owner, repo }
        );
        return this.graphql(
          `mutation CreateDiscussion($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
            createDiscussion(input: { repositoryId: $repoId, categoryId: $categoryId, title: $title, body: $body }) {
              discussion { id number title url }
            }
          }`,
          {
            repoId: repoData.repository.id,
            categoryId: getString(payload, "categoryId"),
            title: getString(payload, "title"),
            body: getString(payload, "body")
          }
        );
      }
      case "editDiscussion":
        return this.graphql(
          `mutation UpdateDiscussion($id: ID!, $title: String!, $body: String!) {
            updateDiscussion(input: { discussionId: $id, title: $title, body: $body }) {
              discussion { id number title url }
            }
          }`,
          {
            id: getString(payload, "discussionId"),
            title: getString(payload, "title"),
            body: getString(payload, "body")
          }
        );
      case "closeDiscussion":
        return this.graphql(
          `mutation CloseDiscussion($id: ID!) {
            closeDiscussion(input: { discussionId: $id, reason: NOT_PLANNED }) {
              discussion { id number title }
            }
          }`,
          { id: getString(payload, "discussionId") }
        );
      case "reopenDiscussion":
        return this.graphql(
          `mutation ReopenDiscussion($id: ID!) {
            reopenDiscussion(input: { discussionId: $id }) {
              discussion { id number title }
            }
          }`,
          { id: getString(payload, "discussionId") }
        );
      case "addDiscussionComment":
        return this.graphql(
          `mutation AddDiscussionComment($id: ID!, $body: String!) {
            addDiscussionComment(input: { discussionId: $id, body: $body }) {
              comment { id body }
            }
          }`,
          {
            id: getString(payload, "discussionId"),
            body: getString(payload, "body")
          }
        );
      case "editDiscussionComment":
        return this.graphql(
          `mutation UpdateDiscussionComment($id: ID!, $body: String!) {
            updateDiscussionComment(input: { commentId: $id, body: $body }) {
              comment { id body }
            }
          }`,
          {
            id: getString(payload, "commentId"),
            body: getString(payload, "body")
          }
        );
      case "deleteDiscussionComment":
        return this.graphql(
          `mutation DeleteDiscussionComment($id: ID!) {
            deleteDiscussionComment(input: { commentId: $id }) {
              clientMutationId
            }
          }`,
          { id: getString(payload, "commentId") }
        );
      case "createProjectV2": {
        const ownerData = await this.graphql<{ repository: { owner: { id: string } } }>(
          `query RepoOwnerId($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) { owner { id } }
          }`,
          { owner, repo }
        );
        return this.graphql(
          `mutation CreateProjectV2($ownerId: ID!, $title: String!) {
            createProjectV2(input: { ownerId: $ownerId, title: $title }) {
              projectV2 { id number title url }
            }
          }`,
          {
            ownerId: ownerData.repository.owner.id,
            title: getString(payload, "title")
          }
        );
      }
      case "updateProjectV2": {
        const id = getString(payload, "projectId");
        const title = getString(payload, "title");
        return this.graphql(
          `mutation UpdateProjectV2($id: ID!, $title: String!, $shortDescription: String, $readme: String) {
            updateProjectV2(input: { projectId: $id, title: $title, shortDescription: $shortDescription, readme: $readme }) {
              projectV2 { id number title }
            }
          }`,
          {
            id,
            title,
            shortDescription: typeof payload.shortDescription === "string" ? payload.shortDescription : null,
            readme: typeof payload.readme === "string" ? payload.readme : null
          }
        );
      }
      case "deleteProjectV2":
        return this.graphql(
          `mutation DeleteProjectV2($id: ID!) {
            deleteProjectV2(input: { projectId: $id }) {
              clientMutationId
            }
          }`,
          { id: getString(payload, "projectId") }
        );
      case "addProjectV2Item":
        return this.graphql(
          `mutation AddProjectV2Item($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
              item { id }
            }
          }`,
          {
            projectId: getString(payload, "projectId"),
            contentId: getString(payload, "contentId")
          }
        );
      case "updateProjectV2Item":
        return this.graphql(
          `mutation UpdateProjectV2Item($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
              projectV2Item { id }
            }
          }`,
          {
            projectId: getString(payload, "projectId"),
            itemId: getString(payload, "itemId"),
            fieldId: getString(payload, "fieldId"),
            value: (payload.value as string | number | boolean | null) ?? null
          }
        );
      case "deleteProjectV2Item":
        return this.graphql(
          `mutation DeleteProjectV2Item($projectId: ID!, $itemId: ID!) {
            deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
              clientMutationId
            }
          }`,
          {
            projectId: getString(payload, "projectId"),
            itemId: getString(payload, "itemId")
          }
        );
      case "createWikiPage": {
        const wikiRepo = `${repo}.wiki`;
        const title = getString(payload, "title");
        const content = getString(payload, "content");
        const pagePath = `${title}.md`;

        const ref = await this.rest<{ object: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/ref/heads/master",
          { owner, repo: wikiRepo }
        );
        const commitSha = ref.object.sha;

        const commit = await this.rest<{ tree: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          { owner, repo: wikiRepo, commit_sha: commitSha }
        );

        const blob = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/blobs", {
          owner,
          repo: wikiRepo,
          content,
          encoding: "utf-8"
        });

        const tree = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/trees", {
          owner,
          repo: wikiRepo,
          base_tree: commit.tree.sha,
          tree: [{ path: pagePath, mode: "100644", type: "blob", sha: blob.sha }]
        });

        const newCommit = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/commits", {
          owner,
          repo: wikiRepo,
          message: `Created ${title}`,
          tree: tree.sha,
          parents: [commitSha]
        });

        return this.rest("PATCH /repos/{owner}/{repo}/git/refs/heads/master", {
          owner,
          repo: wikiRepo,
          sha: newCommit.sha,
          force: false
        });
      }
      case "editWikiPage": {
        const wikiRepo = `${repo}.wiki`;
        const pagePath = getString(payload, "pagePath");
        const content = getString(payload, "content");
        const title = pagePath.replace(/\.md$/, "");

        const ref = await this.rest<{ object: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/ref/heads/master",
          { owner, repo: wikiRepo }
        );
        const commitSha = ref.object.sha;

        const commit = await this.rest<{ tree: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          { owner, repo: wikiRepo, commit_sha: commitSha }
        );

        const blob = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/blobs", {
          owner,
          repo: wikiRepo,
          content,
          encoding: "utf-8"
        });

        const tree = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/trees", {
          owner,
          repo: wikiRepo,
          base_tree: commit.tree.sha,
          tree: [{ path: pagePath, mode: "100644", type: "blob", sha: blob.sha }]
        });

        const newCommit = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/commits", {
          owner,
          repo: wikiRepo,
          message: `Updated ${title}`,
          tree: tree.sha,
          parents: [commitSha]
        });

        return this.rest("PATCH /repos/{owner}/{repo}/git/refs/heads/master", {
          owner,
          repo: wikiRepo,
          sha: newCommit.sha,
          force: false
        });
      }
      case "deleteWikiPage": {
        const wikiRepo = `${repo}.wiki`;
        const pagePath = getString(payload, "pagePath");
        const title = pagePath.replace(/\.md$/, "");

        const ref = await this.rest<{ object: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/ref/heads/master",
          { owner, repo: wikiRepo }
        );
        const commitSha = ref.object.sha;

        const commit = await this.rest<{ tree: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          { owner, repo: wikiRepo, commit_sha: commitSha }
        );

        const tree = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/trees", {
          owner,
          repo: wikiRepo,
          base_tree: commit.tree.sha,
          tree: [{ path: pagePath, mode: "100644", type: "blob", sha: null }]
        });

        const newCommit = await this.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/commits", {
          owner,
          repo: wikiRepo,
          message: `Deleted ${title}`,
          tree: tree.sha,
          parents: [commitSha]
        });

        return this.rest("PATCH /repos/{owner}/{repo}/git/refs/heads/master", {
          owner,
          repo: wikiRepo,
          sha: newCommit.sha,
          force: false
        });
      }
      default:
        throw new Error(`Unsupported GitHub action: ${(input as { action: string }).action}`);
    }
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

  private async getNotificationReleaseHtmlUrl(notification: GitHubNotification): Promise<string | null> {
    const release = parseNotificationReleaseApiUrl(notification);
    if (!release) {
      return null;
    }

    try {
      const data = await this.rest<Pick<GitHubRelease, "html_url">>(
        "GET /repos/{owner}/{repo}/releases/{release_id}",
        release
      );
      return data.html_url ?? null;
    } catch {
      return null;
    }
  }
}

export async function validateGitHubToken(token: string): Promise<Viewer> {
  return new OctokitProvider(token).getViewer();
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
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

function getResponseHeader(
  headers: Record<string, string | number | undefined>,
  name: string
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return typeof value === "string" && value ? value : null;
}

function getNumber(payload: GitHubMutationRuntimePayload, key: keyof GitHubMutationFields): number {
  const value = payload[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`GitHub action payload requires numeric ${key}.`);
  }
  return value;
}

function getString(payload: GitHubMutationRuntimePayload, key: keyof GitHubMutationFields): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`GitHub action payload requires string ${key}.`);
  }
  return value;
}

function pick(
  payload: GitHubMutationRuntimePayload,
  keys: Array<keyof GitHubMutationFields>
): Record<string, unknown> {
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    if (payload[key] !== undefined) {
      acc[key] = payload[key];
    }
    return acc;
  }, {});
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isGitHubStatus(error: unknown, status: number): boolean {
  const errorRecord = error && typeof error === "object" ? (error as { status?: unknown }) : {};
  return errorRecord.status === status;
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

function mapRepositorySummary(node: GitHubRepositoryNode): RepositorySummary {
  return {
    id: node.id,
    owner: node.owner.login,
    name: node.name,
    nameWithOwner: node.nameWithOwner,
    description: node.description,
    visibility: node.visibility,
    isPrivate: node.isPrivate,
    isFork: node.isFork,
    stargazerCount: node.stargazerCount,
    forkCount: node.forkCount,
    watcherCount: node.watchers?.totalCount ?? 0,
    openIssuesCount: node.issues?.totalCount ?? 0,
    counts: mapRepositoryCounts(node),
    primaryLanguage: node.primaryLanguage,
    updatedAt: node.updatedAt,
    pushedAt: node.pushedAt,
    avatarUrl: node.owner.avatarUrl,
    defaultBranch: node.defaultBranchRef?.name ?? null
  };
}

function mapRepositoryCounts(node: GitHubRepositoryNode): RepositoryCounts {
  return {
    openIssues: node.issues?.totalCount ?? 0,
    openPullRequests: node.pullRequests?.totalCount ?? 0,
    discussions: node.discussions?.totalCount ?? 0,
    projects: node.projectsV2?.totalCount ?? 0,
    releases: node.releases?.totalCount ?? 0,
    forks: node.forkCount,
    stars: node.stargazerCount,
    watchers: node.watchers?.totalCount ?? 0
  };
}

function mapAccountProfile(node: GitHubProfileNode): GitHubAccountProfile {
  return {
    id: node.id,
    login: node.login,
    name: node.name,
    avatarUrl: node.avatarUrl,
    htmlUrl: node.url,
    bio: node.bio,
    company: node.company,
    location: node.location,
    websiteUrl: node.websiteUrl,
    followers: node.followers.totalCount,
    following: node.following.totalCount,
    repositoryCount: node.repositories.totalCount,
    starredRepositoryCount: node.starredRepositories.totalCount,
    status: node.status ? { emoji: node.status.emoji, message: node.status.message } : null,
    pinnedRepositories: node.pinnedItems.nodes.filter(Boolean).map(mapRepositorySummary)
  };
}

function mapOrganization(node: GitHubOrganizationNode): OrganizationSummary {
  return {
    id: node.id,
    login: node.login,
    name: node.name,
    description: node.description,
    avatarUrl: node.avatarUrl,
    htmlUrl: node.url,
    websiteUrl: node.websiteUrl,
    location: node.location,
    repositoryCount: node.repositories.totalCount,
    teamCount: node.teams.totalCount,
    viewerIsMember: node.viewerIsAMember,
    viewerMembershipRole: null,
    viewerMembershipState: null,
    viewerMembershipAvailability: { status: "available", message: null },
    viewerCanAdminister: node.viewerCanAdminister,
    viewerCanCreateRepositories: node.viewerCanCreateRepositories,
    viewerCanCreateTeams: node.viewerCanCreateTeams
  };
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

function mapOrganizationTeamRepository(repository: GitHubTeamRepository): OrganizationTeamRepositorySummary {
  return mapOrganizationRepository(repository);
}

function mapOrganizationRepository(repository: GitHubTeamRepository): OrganizationRepositorySummary {
  return {
    id: String(repository.node_id ?? repository.id),
    owner: repository.owner.login,
    name: repository.name,
    nameWithOwner: repository.full_name,
    description: repository.description ?? null,
    visibility: repository.visibility ?? (repository.private ? "private" : null),
    isPrivate: repository.private ?? null,
    permission: repository.permissions ? mapRestRepositoryPermission(repository.permissions) : null,
    htmlUrl: repository.html_url,
    defaultBranch: repository.default_branch ?? null,
    updatedAt: repository.updated_at ?? null,
    pushedAt: repository.pushed_at ?? null
  };
}

function mapTeamMember(member: GitHubTeamMember): TeamMemberSummary {
  return mapVisibleMember(member);
}

function mapOrganizationMember(member: GitHubOrganizationMember): OrganizationMemberSummary {
  return mapVisibleMember(member);
}

function mapVisibleMember(member: GitHubVisibleMember): TeamMemberSummary {
  return {
    id: String(member.id),
    login: member.login,
    avatarUrl: member.avatar_url ?? null,
    htmlUrl: member.html_url ?? null,
    siteAdmin: member.site_admin ?? null
  };
}

function mapRepositoryRef(node: GitHubRepositoryRefNode | null): RepositoryRef | null {
  if (!node) {
    return null;
  }

  return {
    id: node.id,
    owner: node.owner.login,
    name: node.name,
    nameWithOwner: node.nameWithOwner,
    htmlUrl: node.url,
    defaultBranch: node.defaultBranchRef?.name ?? null,
    visibility: node.visibility ?? null,
    isPrivate: node.isPrivate ?? null,
    forkCount: node.forkCount ?? null,
    stargazerCount: node.stargazerCount ?? null,
    viewerPermission: node.viewerPermission ?? null
  };
}

function mapRestRepositoryRef(node: GitHubRestRepositoryRef | null): RepositoryRef | null {
  if (!node) {
    return null;
  }

  return {
    id: String(node.node_id ?? node.id),
    owner: node.owner.login,
    name: node.name,
    nameWithOwner: node.full_name,
    htmlUrl: node.html_url,
    defaultBranch: node.default_branch ?? null,
    visibility: node.visibility ?? (node.private ? "PRIVATE" : "PUBLIC"),
    isPrivate: node.private ?? null,
    forkCount: node.forks_count ?? null,
    stargazerCount: node.stargazers_count ?? null,
    viewerPermission: mapRestRepositoryPermission(node.permissions)
  };
}

function mapRestRepositoryPermission(
  permissions: GitHubRestRepositoryPermissions | null | undefined
): string | null {
  if (!permissions) {
    return null;
  }

  if (permissions.admin) {
    return "ADMIN";
  }
  if (permissions.maintain) {
    return "MAINTAIN";
  }
  if (permissions.push) {
    return "WRITE";
  }
  if (permissions.triage) {
    return "TRIAGE";
  }
  if (permissions.pull) {
    return "READ";
  }

  return null;
}

function mapViewerPermissionToRepositoryAdministrationPermissions(
  viewerPermission: string | null
): RepositoryAdministrationMetadata["viewerPermissions"] {
  switch (viewerPermission?.toUpperCase()) {
    case "ADMIN":
      return {
        admin: true,
        maintain: true,
        push: true,
        triage: true,
        pull: true
      };
    case "MAINTAIN":
      return {
        admin: false,
        maintain: true,
        push: true,
        triage: true,
        pull: true
      };
    case "WRITE":
      return {
        admin: false,
        maintain: false,
        push: true,
        triage: true,
        pull: true
      };
    case "TRIAGE":
      return {
        admin: false,
        maintain: false,
        push: false,
        triage: true,
        pull: true
      };
    case "READ":
      return {
        admin: false,
        maintain: false,
        push: false,
        triage: false,
        pull: true
      };
    default:
      return {
        admin: null,
        maintain: null,
        push: null,
        triage: null,
        pull: null
      };
  }
}

function mapRestRepositoryAdministration(repository: GitHubRestRepository): RepositoryAdministrationMetadata {
  const securityAndAnalysis = repository.security_and_analysis;

  return {
    visibility: repository.visibility ?? (repository.private ? "private" : "public"),
    defaultBranch: repository.default_branch ?? null,
    isPrivate: Boolean(repository.private),
    isArchived: Boolean(repository.archived),
    isDisabled: Boolean(repository.disabled),
    isTemplate: repository.is_template ?? null,
    allowForking: repository.allow_forking ?? null,
    webCommitSignoffRequired: repository.web_commit_signoff_required ?? null,
    features: {
      issues: repository.has_issues ?? null,
      projects: repository.has_projects ?? null,
      wiki: repository.has_wiki ?? null,
      discussions: repository.has_discussions ?? null
    },
    mergeSettings: {
      allowMergeCommit: repository.allow_merge_commit ?? null,
      allowSquashMerge: repository.allow_squash_merge ?? null,
      allowRebaseMerge: repository.allow_rebase_merge ?? null,
      allowAutoMerge: repository.allow_auto_merge ?? null,
      deleteBranchOnMerge: repository.delete_branch_on_merge ?? null,
      allowUpdateBranch: repository.allow_update_branch ?? null
    },
    viewerPermissions: {
      admin: repository.permissions?.admin ?? null,
      maintain: repository.permissions?.maintain ?? null,
      push: repository.permissions?.push ?? null,
      triage: repository.permissions?.triage ?? null,
      pull: repository.permissions?.pull ?? null
    },
    securityAndAnalysis: {
      advancedSecurity: securityAndAnalysis?.advanced_security?.status ?? null,
      codeSecurity: securityAndAnalysis?.code_security?.status ?? null,
      dependabotAlerts: securityAndAnalysis?.dependabot_alerts?.status ?? null,
      dependabotSecurityUpdates: securityAndAnalysis?.dependabot_security_updates?.status ?? null,
      secretScanning: securityAndAnalysis?.secret_scanning?.status ?? null,
      secretScanningPushProtection: securityAndAnalysis?.secret_scanning_push_protection?.status ?? null,
      secretScanningNonProviderPatterns:
        securityAndAnalysis?.secret_scanning_non_provider_patterns?.status ?? null,
      secretScanningValidityChecks: securityAndAnalysis?.secret_scanning_validity_checks?.status ?? null,
      secretScanningAiDetection: securityAndAnalysis?.secret_scanning_ai_detection?.status ?? null
    }
  };
}

function fallbackRepositoryAdministration(input: {
  visibility: string;
  defaultBranch: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isDisabled: boolean;
  viewerPermission: string | null;
}): RepositoryAdministrationMetadata {
  return {
    visibility: input.visibility,
    defaultBranch: input.defaultBranch,
    isPrivate: input.isPrivate,
    isArchived: input.isArchived,
    isDisabled: input.isDisabled,
    isTemplate: null,
    allowForking: null,
    webCommitSignoffRequired: null,
    features: {
      issues: null,
      projects: null,
      wiki: null,
      discussions: null
    },
    mergeSettings: {
      allowMergeCommit: null,
      allowSquashMerge: null,
      allowRebaseMerge: null,
      allowAutoMerge: null,
      deleteBranchOnMerge: null,
      allowUpdateBranch: null
    },
    viewerPermissions: mapViewerPermissionToRepositoryAdministrationPermissions(input.viewerPermission),
    securityAndAnalysis: {
      advancedSecurity: null,
      codeSecurity: null,
      dependabotAlerts: null,
      dependabotSecurityUpdates: null,
      secretScanning: null,
      secretScanningPushProtection: null,
      secretScanningNonProviderPatterns: null,
      secretScanningValidityChecks: null,
      secretScanningAiDetection: null
    }
  };
}

function mapLanguages(languages: GitHubLanguages): LanguageStat[] {
  const total = languages.totalSize;
  return languages.edges.map((edge) => ({
    name: edge.node.name,
    color: edge.node.color,
    size: edge.size,
    percent: total > 0 ? (edge.size / total) * 100 : 0
  }));
}

function mapNotification(
  notification: GitHubNotification,
  participating: boolean | null,
  subjectHtmlUrlOverride: string | null = null,
  subscription: GitHubNotificationSubscription | null = null
): NotificationSummary {
  const subjectHtmlUrl = subjectHtmlUrlOverride ?? mapNotificationSubjectHtmlUrl(notification);
  const latestCommentHtmlUrl = mapNotificationLatestCommentHtmlUrl(notification, subjectHtmlUrl);

  return {
    id: notification.id,
    unread: notification.unread,
    reason: notification.reason,
    updatedAt: notification.updated_at,
    lastReadAt: notification.last_read_at ?? null,
    participating,
    threadUrl: notification.url ?? null,
    subscriptionUrl: notification.subscription_url ?? null,
    subscribed: subscription?.subscribed ?? null,
    ignored: subscription?.ignored ?? null,
    subscriptionReason: subscription?.reason ?? null,
    subscriptionCreatedAt: subscription?.created_at ?? null,
    repositoryNameWithOwner: notification.repository.full_name,
    repositoryHtmlUrl: notification.repository.html_url ?? null,
    repositoryPrivate: notification.repository.private ?? null,
    subject: {
      title: notification.subject.title,
      type: notification.subject.type,
      apiUrl: notification.subject.url ?? null,
      latestCommentApiUrl: notification.subject.latest_comment_url ?? null,
      latestCommentHtmlUrl,
      htmlUrl: subjectHtmlUrl
    },
    htmlUrl: subjectHtmlUrl ?? notification.repository.html_url ?? null
  };
}

function mapNotificationLatestCommentHtmlUrl(
  notification: GitHubNotification,
  subjectHtmlUrl: string | null
): string | null {
  const latestCommentApiUrl = notification.subject.latest_comment_url;
  if (!latestCommentApiUrl || !subjectHtmlUrl) {
    return null;
  }

  try {
    const pathname = new URL(latestCommentApiUrl).pathname;
    const issueCommentMatch = pathname.match(/\/issues\/comments\/(\d+)$/);
    if (issueCommentMatch?.[1]) {
      return `${subjectHtmlUrl}#issuecomment-${issueCommentMatch[1]}`;
    }

    const discussionCommentMatch = pathname.match(/\/discussions\/comments\/(\d+)$/);
    if (discussionCommentMatch?.[1]) {
      return `${subjectHtmlUrl}#discussioncomment-${discussionCommentMatch[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

function mapNotificationSubjectHtmlUrl(notification: GitHubNotification): string | null {
  const apiUrl = notification.subject.url;
  if (!apiUrl) {
    return null;
  }

  const repositoryPath = notification.repository.full_name;
  const marker = `/repos/${repositoryPath}/`;

  try {
    const pathname = new URL(apiUrl).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const suffix = pathname.slice(markerIndex + marker.length);
    if (suffix.startsWith("issues/")) {
      return `https://github.com/${repositoryPath}/${suffix}`;
    }
    if (suffix.startsWith("pulls/")) {
      return `https://github.com/${repositoryPath}/${suffix.replace(/^pulls\//, "pull/")}`;
    }
    if (suffix.startsWith("discussions/")) {
      return `https://github.com/${repositoryPath}/${suffix}`;
    }
    if (suffix.startsWith("commits/")) {
      return `https://github.com/${repositoryPath}/${suffix.replace(/^commits\//, "commit/")}`;
    }
    if (suffix.startsWith("actions/runs/")) {
      return `https://github.com/${repositoryPath}/${suffix}`;
    }
    if (suffix.startsWith("releases/")) {
      return `https://github.com/${repositoryPath}/releases`;
    }
  } catch {
    return null;
  }

  return null;
}

function parseNotificationReleaseApiUrl(
  notification: GitHubNotification
): { owner: string; repo: string; release_id: number } | null {
  const apiUrl = notification.subject.url;
  if (!apiUrl) {
    return null;
  }

  const [owner, repo] = notification.repository.full_name.split("/");
  if (!owner || !repo) {
    return null;
  }

  try {
    const pathname = new URL(apiUrl).pathname;
    const marker = `/repos/${notification.repository.full_name}/releases/`;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const releaseId = pathname.slice(markerIndex + marker.length);
    if (!/^\d+$/.test(releaseId)) {
      return null;
    }

    return { owner, repo, release_id: Number(releaseId) };
  } catch {
    return null;
  }
}

function mapBranch(branch: GitHubBranch): BranchSummary {
  return {
    name: branch.name,
    commitSha: branch.commit.sha,
    protected: branch.protected
  };
}

function mapTag(tag: GitHubTag): TagSummary {
  return {
    name: tag.name,
    commitSha: tag.commit.sha,
    zipballUrl: tag.zipball_url ?? null,
    tarballUrl: tag.tarball_url ?? null
  };
}

function mapTreeEntry(
  owner: string,
  repo: string,
  ref: string,
  entry: GitHubTreeEntry
): RepoTreeEntry | null {
  if (!entry.path || !entry.sha) {
    return null;
  }

  const type =
    entry.type === "tree"
      ? "dir"
      : entry.type === "blob"
        ? "file"
        : entry.type === "commit"
          ? "submodule"
          : null;
  if (!type) {
    return null;
  }

  const encodedPath = encodePath(entry.path);
  return {
    path: entry.path,
    type,
    sha: entry.sha,
    size: typeof entry.size === "number" ? entry.size : null,
    htmlUrl: `https://github.com/${owner}/${repo}/${type === "dir" ? "tree" : "blob"}/${encodeURIComponent(ref)}/${encodedPath}`
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

function treeEntryTypeRank(type: RepoTreeEntry["type"]): number {
  return type === "dir" ? 0 : type === "file" ? 1 : 2;
}

function mapWorkflowRun(run: GitHubWorkflowRun): WorkflowRunSummary {
  const rerunUrl = run.rerun_url ?? null;
  const rerunFailedJobsUrl = run.rerun_failed_jobs_url ?? null;
  const cancelUrl = run.cancel_url ?? null;
  const previousAttemptUrl =
    run.previous_attempt_url && run.run_attempt && run.run_attempt > 1
      ? `${run.html_url}/attempts/${run.run_attempt - 1}`
      : null;
  const completed = run.status === null ? null : run.status === "completed";
  const failed = run.conclusion === null ? null : run.conclusion === "failure";

  return {
    id: run.id,
    name: run.name,
    displayTitle: run.display_title ?? null,
    runNumber: run.run_number ?? null,
    runAttempt: run.run_attempt ?? null,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    commitSha: run.head_sha,
    headRepositoryNameWithOwner: run.head_repository?.full_name ?? null,
    actorLogin: run.actor?.login ?? null,
    actorAvatarUrl: run.actor?.avatar_url ?? null,
    triggeringActorLogin: run.triggering_actor?.login ?? null,
    runStartedAt: run.run_started_at ?? null,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
    actionAvailability: {
      canRerun: completed === null ? null : completed && Boolean(rerunUrl),
      canRerunFailedJobs:
        completed === null || failed === null ? null : completed && failed && Boolean(rerunFailedJobsUrl),
      canCancel: completed === null ? null : !completed && Boolean(cancelUrl),
      rerunUrl,
      rerunFailedJobsUrl,
      cancelUrl,
      previousAttemptUrl
    }
  };
}

function parseWorkflowDispatchMetadata(
  content: string
): Pick<WorkflowDefinitionSummary, "dispatchable" | "inputs" | "inputsUnavailableMessage"> {
  const lines = parseYamlLines(content);
  const onIndex = lines.findIndex((line) => line.indent === 0 && line.key === "on");
  if (onIndex < 0) {
    return { dispatchable: false, inputs: [], inputsUnavailableMessage: null };
  }

  const onLine = lines[onIndex]!;
  if (yamlScalarIncludesWorkflowDispatch(onLine.value)) {
    return { dispatchable: true, inputs: [], inputsUnavailableMessage: null };
  }

  const workflowDispatchIndex = findYamlChildLine(lines, onIndex, onLine.indent, "workflow_dispatch");
  if (workflowDispatchIndex < 0) {
    return { dispatchable: false, inputs: [], inputsUnavailableMessage: null };
  }

  const workflowDispatchLine = lines[workflowDispatchIndex]!;
  const inputsIndex = findYamlChildLine(lines, workflowDispatchIndex, workflowDispatchLine.indent, "inputs");
  if (inputsIndex < 0) {
    return { dispatchable: true, inputs: [], inputsUnavailableMessage: null };
  }

  return {
    dispatchable: true,
    inputs: parseWorkflowDispatchInputs(lines, inputsIndex),
    inputsUnavailableMessage: null
  };
}

interface ParsedYamlLine {
  indent: number;
  content: string;
  key: string | null;
  value: string;
}

function parseYamlLines(content: string): ParsedYamlLine[] {
  return content
    .split(/\r?\n/)
    .map((rawLine) => {
      const withoutComment = stripYamlComment(rawLine);
      if (!withoutComment.trim()) {
        return null;
      }

      const indent = withoutComment.search(/\S/);
      const lineContent = withoutComment.trim();
      const colonIndex = findYamlKeySeparator(lineContent);
      if (colonIndex < 0 || lineContent.startsWith("- ")) {
        return {
          indent,
          content: lineContent,
          key: null,
          value: ""
        };
      }

      return {
        indent,
        content: lineContent,
        key: normalizeYamlKey(lineContent.slice(0, colonIndex)),
        value: lineContent.slice(colonIndex + 1).trim()
      };
    })
    .filter((line): line is ParsedYamlLine => Boolean(line));
}

function stripYamlComment(line: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (
      char === "#" &&
      !inSingleQuote &&
      !inDoubleQuote &&
      (index === 0 || /\s/.test(line[index - 1] ?? ""))
    ) {
      return line.slice(0, index);
    }
  }

  return line;
}

function findYamlKeySeparator(content: string): number {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === ":" && !inSingleQuote && !inDoubleQuote) {
      return index;
    }
  }

  return -1;
}

function normalizeYamlKey(key: string): string {
  return stripYamlQuotes(key.trim());
}

function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function yamlScalarIncludesWorkflowDispatch(value: string): boolean {
  const scalar = value.trim();
  if (!scalar) {
    return false;
  }
  if (stripYamlQuotes(scalar) === "workflow_dispatch") {
    return true;
  }
  if (scalar.startsWith("[") && scalar.endsWith("]")) {
    return parseInlineYamlList(scalar).includes("workflow_dispatch");
  }
  return false;
}

function findYamlChildLine(
  lines: ParsedYamlLine[],
  parentIndex: number,
  parentIndent: number,
  key: string
): number {
  for (let index = parentIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.indent <= parentIndent) {
      break;
    }
    if (line.key === key) {
      return index;
    }
  }

  return -1;
}

function parseWorkflowDispatchInputs(
  lines: ParsedYamlLine[],
  inputsIndex: number
): WorkflowDispatchInputSummary[] {
  const inputsIndent = lines[inputsIndex]!.indent;
  const inputs: WorkflowDispatchInputSummary[] = [];
  let inputIndent: number | null = null;
  let current: WorkflowDispatchInputSummary | null = null;
  let optionsIndent: number | null = null;

  for (let index = inputsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.indent <= inputsIndent) {
      break;
    }

    if (inputIndent === null && line.key) {
      inputIndent = line.indent;
      current = createWorkflowDispatchInput(line.key);
      optionsIndent = null;
      continue;
    }

    if (inputIndent !== null && line.indent === inputIndent && line.key) {
      if (current) {
        inputs.push(current);
      }
      current = createWorkflowDispatchInput(line.key);
      optionsIndent = null;
      continue;
    }

    if (!current) {
      continue;
    }

    if (optionsIndent !== null && line.indent > optionsIndent && line.content.startsWith("- ")) {
      current.options.push(parseYamlScalar(line.content.slice(2)));
      continue;
    }

    if (!line.key) {
      continue;
    }

    switch (line.key) {
      case "description":
        current.description = parseYamlScalar(line.value) || null;
        break;
      case "required":
        current.required = parseYamlBoolean(line.value);
        break;
      case "type":
        current.type = normalizeWorkflowDispatchInputType(parseYamlScalar(line.value));
        break;
      case "default":
        current.defaultValue = parseYamlScalar(line.value);
        break;
      case "options":
        current.options = parseInlineYamlList(line.value);
        optionsIndent = line.indent;
        break;
      default:
        break;
    }
  }

  if (current) {
    inputs.push(current);
  }

  return inputs;
}

function createWorkflowDispatchInput(name: string): WorkflowDispatchInputSummary {
  return {
    name,
    description: null,
    required: false,
    type: "string",
    defaultValue: null,
    options: []
  };
}

function parseYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") {
    return "";
  }
  return stripYamlQuotes(trimmed);
}

function parseYamlBoolean(value: string): boolean {
  const parsed = parseYamlScalar(value).toLowerCase();
  return parsed === "true" || parsed === "yes" || parsed === "on";
}

function normalizeWorkflowDispatchInputType(value: string): WorkflowDispatchInputType {
  return value === "boolean" ||
    value === "choice" ||
    value === "number" ||
    value === "environment" ||
    value === "string"
    ? value
    : "string";
}

function parseInlineYamlList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split(",")
    .map((option) => parseYamlScalar(option))
    .filter(Boolean);
}

function mapWorkflowJob(job: GitHubWorkflowJob): WorkflowRunJobSummary {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    htmlUrl: job.html_url ?? null,
    runnerName: job.runner_name ?? null,
    labels: job.labels ?? [],
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
      startedAt: step.started_at ?? null,
      completedAt: step.completed_at ?? null
    }))
  };
}

function mapWorkflowArtifact(
  artifact: GitHubWorkflowArtifact,
  archiveDownloadUrl: string | null,
  archiveDownloadAvailability: GitHubReadAvailability
): WorkflowRunArtifactSummary {
  return {
    id: artifact.id,
    name: artifact.name,
    sizeInBytes: artifact.size_in_bytes,
    expired: artifact.expired,
    createdAt: artifact.created_at,
    updatedAt: artifact.updated_at,
    expiresAt: artifact.expires_at ?? null,
    archiveDownloadUrl,
    archiveDownloadAvailability
  };
}

function mapWorkflowCheckSuite(suite: GitHubCheckSuite): WorkflowRunCheckSuiteSummary {
  return {
    id: suite.id,
    status: suite.status ?? null,
    conclusion: suite.conclusion ?? null,
    headBranch: suite.head_branch ?? null,
    headSha: suite.head_sha ?? null,
    beforeSha: suite.before ?? null,
    afterSha: suite.after ?? null,
    appName: suite.app?.name ?? null,
    appSlug: suite.app?.slug ?? null,
    appHtmlUrl: suite.app?.html_url ?? null,
    latestCheckRunCount: suite.latest_check_runs_count ?? null,
    createdAt: suite.created_at ?? null,
    updatedAt: suite.updated_at ?? null
  };
}

function mapWorkflowCheckRun(run: GitHubCheckRun): WorkflowRunCheckRunSummary {
  return {
    id: run.id,
    name: run.name,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    startedAt: run.started_at ?? null,
    completedAt: run.completed_at ?? null,
    htmlUrl: run.html_url ?? null,
    detailsUrl: run.details_url ?? null,
    checkSuiteId: run.check_suite?.id ?? null,
    appName: run.app?.name ?? null,
    appSlug: run.app?.slug ?? null,
    appHtmlUrl: run.app?.html_url ?? null,
    outputTitle: run.output?.title ?? null,
    outputSummary: run.output?.summary ?? null,
    outputText: run.output?.text ?? null,
    annotationsCount: run.output?.annotations_count ?? 0,
    annotations: [],
    annotationsAvailability: { status: "available", message: null }
  };
}

function mapWorkflowCheckRunAnnotation(
  owner: string,
  repo: string,
  ref: string | null,
  annotation: GitHubCheckRunAnnotation
): WorkflowRunCheckAnnotationSummary {
  return {
    path: annotation.path,
    startLine: annotation.start_line ?? null,
    endLine: annotation.end_line ?? null,
    annotationLevel: annotation.annotation_level ?? null,
    title: annotation.title ?? null,
    message: annotation.message,
    rawDetails: annotation.raw_details ?? null,
    blobHref: mapWorkflowCheckRunAnnotationBlobHref(owner, repo, ref, annotation)
  };
}

function mapWorkflowCheckRunAnnotationBlobHref(
  owner: string,
  repo: string,
  ref: string | null,
  annotation: GitHubCheckRunAnnotation
): string | null {
  if (annotation.blob_href?.startsWith("https://github.com/")) {
    return annotation.blob_href;
  }

  if (!ref || !annotation.path) {
    return null;
  }

  const startLine = annotation.start_line ?? null;
  const endLine = annotation.end_line ?? null;
  const lineFragment =
    startLine === null
      ? ""
      : endLine !== null && endLine !== startLine
        ? `#L${startLine}-L${endLine}`
        : `#L${startLine}`;

  return `https://github.com/${owner}/${repo}/blob/${encodeURIComponent(ref)}/${encodePath(annotation.path)}${lineFragment}`;
}

function mapBranchProtection(branch: string, protection: GitHubBranchProtection): BranchProtectionSummary {
  return {
    branch,
    url: protection.url ?? null,
    requiredStatusCheckContexts: protection.required_status_checks?.contexts ?? [],
    requiredStatusCheckEnforcementLevel: protection.required_status_checks?.enforcement_level ?? null,
    enforceAdmins: protection.enforce_admins?.enabled ?? null,
    requiresPullRequestReviews: Boolean(protection.required_pull_request_reviews),
    requiredApprovingReviewCount:
      protection.required_pull_request_reviews?.required_approving_review_count ?? null,
    dismissStaleReviews: protection.required_pull_request_reviews?.dismiss_stale_reviews ?? null,
    requireCodeOwnerReviews: protection.required_pull_request_reviews?.require_code_owner_reviews ?? null,
    requireLastPushApproval: protection.required_pull_request_reviews?.require_last_push_approval ?? null,
    restrictsPushes: Boolean(protection.restrictions),
    restrictionUserCount: protection.restrictions?.users?.length ?? null,
    restrictionTeamCount: protection.restrictions?.teams?.length ?? null,
    restrictionAppCount: protection.restrictions?.apps?.length ?? null,
    requiredLinearHistory: protection.required_linear_history?.enabled ?? null,
    allowForcePushes: protection.allow_force_pushes?.enabled ?? null,
    allowDeletions: protection.allow_deletions?.enabled ?? null,
    requiredConversationResolution: protection.required_conversation_resolution?.enabled ?? null,
    lockBranch: protection.lock_branch?.enabled ?? null,
    allowForkSyncing: protection.allow_fork_syncing?.enabled ?? null
  };
}

function mapBranchProtectionError(branch: string, error: unknown): GitHubReadAvailability {
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
      status: "feature_disabled",
      message: message ?? `Branch protection is not enabled for ${branch}.`
    };
  }

  return mapGitHubFeatureError(error);
}

function mapRepositorySecurityError(feature: string, error: unknown): GitHubReadAvailability {
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
  const normalized = (message ?? "").toLowerCase();
  const isFeatureDisabled = normalized.includes("disabled") || normalized.includes("not enabled");

  if (status === 404) {
    return {
      status: "feature_disabled",
      message: message ?? `${feature} are not enabled or accessible for this repository.`
    };
  }

  if (isFeatureDisabled) {
    return {
      status: "feature_disabled",
      message: message ?? `${feature} are not enabled or accessible for this repository.`
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: "permission_denied",
      message: message ?? `${feature} are not accessible with the current token.`
    };
  }

  return mapGitHubFeatureError(error);
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

function mapDependabotAlert(alert: GitHubDependabotAlert): DependabotAlertSummary {
  return {
    number: alert.number,
    state: alert.state,
    severity: alert.security_advisory?.severity ?? null,
    packageName: alert.dependency?.package?.name ?? null,
    ecosystem: alert.dependency?.package?.ecosystem ?? null,
    manifestPath: alert.dependency?.manifest_path ?? null,
    scope: alert.dependency?.scope ?? null,
    summary: alert.security_advisory?.summary ?? null,
    htmlUrl: alert.html_url ?? null,
    createdAt: alert.created_at ?? null,
    updatedAt: alert.updated_at ?? null,
    dismissedAt: alert.dismissed_at ?? null,
    fixedAt: alert.fixed_at ?? null
  };
}

function mapCodeScanningAlert(alert: GitHubCodeScanningAlert): CodeScanningAlertSummary {
  const location = alert.most_recent_instance?.location;

  return {
    number: alert.number,
    state: alert.state,
    severity: alert.rule?.security_severity_level ?? alert.rule?.severity ?? null,
    ruleId: alert.rule?.id ?? null,
    ruleName: alert.rule?.name ?? null,
    ruleDescription: alert.rule?.description ?? null,
    toolName: alert.tool?.name ?? null,
    message: alert.most_recent_instance?.message?.text ?? null,
    ref: alert.most_recent_instance?.ref ?? null,
    path: location?.path ?? null,
    startLine: location?.start_line ?? null,
    endLine: location?.end_line ?? null,
    htmlUrl: alert.html_url ?? null,
    createdAt: alert.created_at ?? null,
    updatedAt: alert.updated_at ?? null,
    dismissedAt: alert.dismissed_at ?? null,
    fixedAt: alert.fixed_at ?? null
  };
}

function mapSecretScanningAlert(alert: GitHubSecretScanningAlert): SecretScanningAlertSummary {
  const firstLocation = alert.first_location_detected;

  return {
    number: alert.number,
    state: alert.state,
    secretType: alert.secret_type ?? null,
    secretTypeDisplayName: alert.secret_type_display_name ?? null,
    resolution: alert.resolution ?? null,
    validity: alert.validity ?? null,
    publiclyLeaked: alert.publicly_leaked ?? null,
    multiRepo: alert.multi_repo ?? null,
    pushProtectionBypassed: alert.push_protection_bypassed ?? null,
    pushProtectionBypassedAt: alert.push_protection_bypassed_at ?? null,
    firstLocationPath: firstLocation?.path ?? null,
    firstLocationStartLine: firstLocation?.start_line ?? null,
    firstLocationEndLine: firstLocation?.end_line ?? null,
    htmlUrl: alert.html_url ?? null,
    createdAt: alert.created_at ?? null,
    updatedAt: alert.updated_at ?? null,
    resolvedAt: alert.resolved_at ?? null
  };
}

function mapRepositoryRuleset(ruleset: GitHubRepositoryRuleset): RepositoryRulesetSummary {
  const bypassActors = mapRepositoryRulesetBypassActors(ruleset.bypass_actors);
  const conditions = mapRepositoryRulesetConditions(ruleset.conditions);
  const rules = mapRepositoryRulesetRules(ruleset.rules);

  return {
    id: ruleset.id,
    nodeId: ruleset.node_id ?? null,
    name: ruleset.name,
    target: ruleset.target ?? null,
    enforcement: ruleset.enforcement ?? null,
    sourceType: ruleset.source_type ?? ruleset.ruleset_source_type ?? null,
    source: ruleset.source ?? ruleset.ruleset_source ?? null,
    htmlUrl: ruleset._links?.html?.href ?? ruleset.html_url ?? null,
    bypassActorCount: Array.isArray(ruleset.bypass_actors) ? bypassActors.length : null,
    bypassActors,
    conditionCount: ruleset.conditions ? conditions.length : null,
    conditions,
    ruleCount: Array.isArray(ruleset.rules) ? rules.length : null,
    rules,
    currentUserCanBypass: ruleset.current_user_can_bypass ?? null,
    createdAt: ruleset.created_at ?? null,
    updatedAt: ruleset.updated_at ?? null
  };
}

function mapRepositoryRulesetBypassActors(
  value: unknown[] | null | undefined
): RepositoryRulesetSummary["bypassActors"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((actor) => {
    const record = recordFromUnknown(actor);
    return {
      actorId: numberFromUnknown(record.actor_id),
      actorType: stringFromUnknown(record.actor_type),
      bypassMode: stringFromUnknown(record.bypass_mode)
    };
  });
}

function mapRepositoryRulesetConditions(
  conditions: Record<string, unknown> | null | undefined
): RepositoryRulesetSummary["conditions"] {
  if (!conditions) {
    return [];
  }

  return Object.entries(conditions).map(([type, value]) => {
    const record = recordFromUnknown(value);
    return {
      type,
      include: stringListFromUnknown(record.include),
      exclude: stringListFromUnknown(record.exclude),
      parameters: Object.entries(record)
        .filter(([key]) => key !== "include" && key !== "exclude")
        .map(([key, parameterValue]) => `${key}: ${formatUnknownValue(parameterValue)}`)
    };
  });
}

function mapRepositoryRulesetRules(value: unknown[] | null | undefined): RepositoryRulesetSummary["rules"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((rule) => {
    const record = recordFromUnknown(rule);
    const parameters = recordFromUnknown(record.parameters);
    return {
      type: stringFromUnknown(record.type) ?? "unknown",
      parameters: Object.entries(parameters).map(
        ([key, parameterValue]) => `${key}: ${formatUnknownValue(parameterValue)}`
      )
    };
  });
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringListFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => formatUnknownValue(item)).filter((item): item is string => Boolean(item));
  }

  const formatted = formatUnknownValue(value);
  return formatted ? [formatted] : [];
}

function formatUnknownValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatUnknownValue(item))
      .filter((item): item is string => Boolean(item))
      .join(", ");
  }

  const record = recordFromUnknown(value);
  const entries = Object.entries(record)
    .map(([key, entryValue]) => {
      const formatted = formatUnknownValue(entryValue);
      return formatted ? `${key}: ${formatted}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  return entries.length > 0 ? entries.join("; ") : null;
}

function mapRepositorySecurityAdvisory(
  advisory: GitHubRepositorySecurityAdvisory
): RepositorySecurityAdvisorySummary {
  return {
    ghsaId: advisory.ghsa_id,
    cveId: advisory.cve_id ?? null,
    state: advisory.state,
    severity: advisory.severity ?? null,
    summary: advisory.summary,
    description: advisory.description ?? null,
    cvssScore: advisory.cvss?.score ?? null,
    cvssVector: advisory.cvss?.vector_string ?? null,
    cweIds: (advisory.cwes ?? []).map((cwe) => cwe.cwe_id).filter((cweId): cweId is string => Boolean(cweId)),
    vulnerabilityCount: Array.isArray(advisory.vulnerabilities) ? advisory.vulnerabilities.length : null,
    creditCount: Array.isArray(advisory.credits) ? advisory.credits.length : null,
    htmlUrl: advisory.html_url ?? null,
    createdAt: advisory.created_at ?? null,
    updatedAt: advisory.updated_at ?? null,
    publishedAt: advisory.published_at ?? null,
    withdrawnAt: advisory.withdrawn_at ?? null
  };
}

function mapRepositorySecurityPolicy(
  input: RepositorySecurityPolicyInput,
  item: GitHubContentFile
): RepositorySecurityPolicy {
  const content =
    item.encoding === "base64" &&
    typeof item.content === "string" &&
    (item.size ?? item.content.length) <= securityPolicyContentLimit
      ? Buffer.from(item.content.replace(/\n/g, ""), "base64").toString("utf8")
      : null;

  return {
    path: item.path,
    htmlUrl: item.html_url ?? null,
    downloadUrl: item.download_url ?? null,
    rawUrl:
      item.download_url ??
      `https://raw.githubusercontent.com/${input.owner}/${input.repo}/${encodeURIComponent(input.ref ?? "HEAD")}/${encodePath(item.path)}`,
    sha: item.sha ?? null,
    size: typeof item.size === "number" ? item.size : null,
    ref: input.ref ?? null,
    content
  };
}

function mapCommunityProfile(profile: GitHubCommunityProfile): RepositoryCommunityProfileResult["profile"] {
  return {
    healthPercentage: typeof profile.health_percentage === "number" ? profile.health_percentage : null,
    description: profile.description ?? null,
    documentationUrl: profile.documentation ?? null,
    files: [
      mapCommunityProfileFile("readme", "README", profile.files?.readme),
      mapCommunityProfileFile("license", "License", profile.files?.license),
      mapCommunityProfileFile("codeOfConduct", "Code of conduct", profile.files?.code_of_conduct),
      mapCommunityProfileFile("contributing", "Contributing", profile.files?.contributing),
      mapCommunityProfileFile("issueTemplate", "Issue template", profile.files?.issue_template),
      mapCommunityProfileFile(
        "pullRequestTemplate",
        "Pull request template",
        profile.files?.pull_request_template
      )
    ]
  };
}

function mapCommunityProfileFile(
  key: string,
  label: string,
  file: GitHubCommunityProfileFile | null | undefined
): CommunityProfileFileSummary {
  return {
    key,
    label,
    name: file?.name ?? null,
    path: file?.path ?? null,
    htmlUrl: file?.html_url ?? null,
    downloadUrl: file?.download_url ?? null,
    url: file?.url ?? null
  };
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

function mapGraphqlAssignableUser(user: GitHubGraphqlAssignableUser): AssignableUserSummary {
  return {
    id: user.id,
    login: user.login,
    avatarUrl: user.avatarUrl ?? null,
    htmlUrl: user.url ?? null
  };
}

function mapGraphqlIssue(issue: GitHubSearchIssueNode): IssueSummary {
  return {
    id: issue.id,
    nodeId: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.stateReason ?? null,
    locked: issue.locked ?? false,
    authorLogin: issue.author?.login ?? null,
    authorAvatarUrl: issue.author?.avatarUrl ?? null,
    comments: issue.comments.totalCount,
    labels: issue.labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color
    })),
    assignees: issue.assignees.nodes.map(mapGraphqlAssignableUser),
    milestone: mapGraphqlMilestone(issue.milestone),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    htmlUrl: issue.url,
    repositoryNameWithOwner: issue.repository.nameWithOwner
  };
}

function mapGraphqlPullRequest(pr: GitHubSearchPullRequestNode): PullRequestSummary {
  const headRepositoryNameWithOwner = pr.headRepository?.nameWithOwner ?? null;
  const baseRepositoryNameWithOwner = pr.baseRepository?.nameWithOwner ?? pr.repository.nameWithOwner;
  const isCrossRepository =
    headRepositoryNameWithOwner && baseRepositoryNameWithOwner
      ? headRepositoryNameWithOwner !== baseRepositoryNameWithOwner
      : null;

  return {
    id: pr.id,
    nodeId: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged,
    mergedAt: pr.mergedAt ?? null,
    isDraft: pr.isDraft,
    locked: pr.locked ?? false,
    authorLogin: pr.author?.login ?? null,
    authorAvatarUrl: pr.author?.avatarUrl ?? null,
    comments: pr.comments.totalCount,
    reviewComments: pr.reviewThreads.totalCount,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    mergeableState: normalizeGraphqlMergeStateStatus(pr.mergeStateStatus),
    reviewDecision: null,
    mergeCommitSha: null,
    maintainerCanModify: null,
    isCrossRepository,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    headRepositoryNameWithOwner,
    baseRepositoryNameWithOwner,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    htmlUrl: pr.url,
    repositoryNameWithOwner: pr.repository.nameWithOwner
  };
}

function normalizeGraphqlMergeStateStatus(status: string | null): string | null {
  return status?.toLowerCase() ?? null;
}

function mapIssue(issue: GitHubIssue): IssueSummary {
  return {
    id: issue.id,
    nodeId: issue.node_id ?? null,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.state_reason ?? null,
    locked: issue.locked ?? false,
    authorLogin: issue.user?.login ?? null,
    authorAvatarUrl: issue.user?.avatar_url ?? null,
    comments: issue.comments,
    labels: issue.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color
    })),
    assignees: (issue.assignees ?? []).map(mapAssignableUser),
    milestone: mapIssueMilestone(issue.milestone),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    htmlUrl: issue.html_url
  };
}

function mapGraphqlMilestone(
  milestone: GitHubSearchIssueNode["milestone"] | null | undefined
): MilestoneSummary | null {
  if (!milestone) {
    return null;
  }

  return {
    id: milestone.id,
    number: milestone.number,
    title: milestone.title,
    description: milestone.description ?? null,
    state: milestone.state,
    dueOn: milestone.dueOn ?? null,
    createdAt: milestone.createdAt ?? null,
    updatedAt: milestone.updatedAt ?? null,
    closedAt: milestone.closedAt ?? null,
    htmlUrl: milestone.url ?? null,
    openIssues: null,
    closedIssues: null
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

function mapPullRequest(pr: GitHubPullRequest): PullRequestSummary {
  const headRepositoryNameWithOwner = pr.head?.repo?.full_name ?? null;
  const baseRepositoryNameWithOwner = pr.base?.repo?.full_name ?? null;
  return {
    id: pr.id,
    nodeId: pr.node_id ?? null,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged ?? (pr.merged_at ? true : null),
    mergedAt: pr.merged_at ?? null,
    isDraft: pr.draft,
    locked: pr.locked ?? false,
    authorLogin: pr.user?.login ?? null,
    authorAvatarUrl: pr.user?.avatar_url ?? null,
    comments: pr.comments ?? 0,
    reviewComments: pr.review_comments ?? 0,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
    mergeableState: pr.mergeable_state ?? null,
    reviewDecision: null,
    mergeCommitSha: pr.merge_commit_sha ?? null,
    maintainerCanModify: pr.maintainer_can_modify ?? null,
    isCrossRepository:
      headRepositoryNameWithOwner && baseRepositoryNameWithOwner
        ? headRepositoryNameWithOwner !== baseRepositoryNameWithOwner
        : null,
    headRefName: pr.head?.ref ?? "",
    baseRefName: pr.base?.ref ?? "",
    headRepositoryNameWithOwner,
    baseRepositoryNameWithOwner,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url
  };
}

function mapTimelineComment(comment: GitHubIssueComment) {
  return {
    id: comment.id,
    authorLogin: comment.user?.login ?? null,
    authorAvatarUrl: comment.user?.avatar_url ?? null,
    body: comment.body ?? null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    htmlUrl: comment.html_url
  };
}

function mapGraphqlDiscussionComment(comment: GitHubDiscussionCommentNode) {
  return {
    id: comment.id,
    authorLogin: comment.author?.login ?? null,
    authorAvatarUrl: comment.author?.avatarUrl ?? null,
    body: comment.body ?? null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    htmlUrl: comment.url
  };
}

function boundedGitHubGraphqlConnectionLimit(
  value: number | undefined,
  fallback: number,
  max: number
): number {
  return Math.min(Math.max(value ?? fallback, 1), max);
}

function mapDiscussionCategory(category: {
  id: string;
  name: string;
  emoji?: string | null;
  description?: string | null;
  isAnswerable?: boolean | null;
}): DiscussionCategorySummary {
  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji ?? null,
    description: category.description ?? null,
    isAnswerable: category.isAnswerable ?? null
  };
}

function mapProjectV2(project: GitHubProjectV2Node): ProjectSummary {
  return {
    id: project.id,
    number: project.number ?? null,
    title: project.title,
    shortDescription: project.shortDescription ?? null,
    readme: project.readme ?? null,
    ...mapProjectV2Owner(project.owner),
    isPublic: project.public ?? null,
    closed: project.closed,
    closedAt: project.closedAt ?? null,
    createdAt: project.createdAt ?? null,
    updatedAt: project.updatedAt,
    itemsCount: project.items?.totalCount ?? null,
    items: (project.items?.nodes ?? [])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(mapProjectV2Item),
    itemsTruncated: project.items ? project.items.totalCount > (project.items.nodes?.length ?? 0) : false,
    fieldsCount: project.fields?.totalCount ?? null,
    fields: (project.fields?.nodes ?? [])
      .filter((field): field is NonNullable<typeof field> => Boolean(field))
      .map(mapProjectV2Field),
    viewerCanUpdate: project.viewerCanUpdate ?? null,
    htmlUrl: project.url
  };
}

function mapProjectV2Item(item: GitHubProjectV2ItemNode) {
  const content = item.content ?? null;
  const fallbackState = item.type ?? null;

  if (!content) {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: null,
      contentType: null,
      title: null,
      body: null,
      number: null,
      state: fallbackState,
      repositoryNameWithOwner: null,
      htmlUrl: null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  if (content.__typename === "Issue") {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: content.id,
      contentType: "Issue",
      title: content.title,
      body: content.body ?? null,
      number: content.number ?? null,
      state: content.state ?? fallbackState,
      repositoryNameWithOwner: content.repository?.nameWithOwner ?? null,
      htmlUrl: content.url ?? null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  if (content.__typename === "PullRequest") {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: content.id,
      contentType: "PullRequest",
      title: content.title,
      body: content.body ?? null,
      number: content.number ?? null,
      state: content.merged ? "MERGED" : content.isDraft ? "DRAFT" : (content.state ?? fallbackState),
      repositoryNameWithOwner: content.repository?.nameWithOwner ?? null,
      htmlUrl: content.url ?? null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  if (content.__typename === "DraftIssue") {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: content.id,
      contentType: "DraftIssue",
      title: content.title,
      body: content.body ?? null,
      number: null,
      state: fallbackState,
      repositoryNameWithOwner: null,
      htmlUrl: null,
      createdAt: content.createdAt ?? item.createdAt ?? null,
      updatedAt: content.updatedAt ?? item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  return {
    id: item.id,
    type: item.type ?? null,
    contentId: content.id ?? null,
    contentType: content.__typename,
    title: null,
    body: null,
    number: null,
    state: fallbackState,
    repositoryNameWithOwner: null,
    htmlUrl: null,
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
    fieldValues: mapProjectV2ItemFieldValues(item),
    fieldValuesTruncated: projectItemFieldValuesTruncated(item)
  };
}

function mapProjectV2Field(field: GitHubProjectV2FieldNode) {
  return {
    id: field.id,
    name: field.name,
    dataType: field.dataType ?? null,
    options: (field.options ?? []).map((option) => ({ id: option.id, name: option.name }))
  };
}

function projectItemFieldValuesTruncated(item: GitHubProjectV2ItemNode): boolean {
  return item.fieldValues ? item.fieldValues.totalCount > (item.fieldValues.nodes?.length ?? 0) : false;
}

function mapProjectV2ItemFieldValues(item: GitHubProjectV2ItemNode) {
  return (item.fieldValues?.nodes ?? [])
    .filter(
      (value): value is NonNullable<typeof value> & { id: string } =>
        value !== null && typeof value.id === "string"
    )
    .map((value) => {
      const field = value.field ?? null;
      const fieldMetadata = field ? mapProjectV2Field(field) : null;
      const base = {
        id: value.id,
        fieldId: fieldMetadata?.id ?? null,
        fieldName: fieldMetadata?.name ?? null,
        dataType: fieldMetadata?.dataType ?? null,
        optionId: null,
        optionName: null,
        options: fieldMetadata?.options ?? []
      };

      if (value.__typename === "ProjectV2ItemFieldTextValue") {
        return { ...base, value: value.text ?? null, editable: Boolean(fieldMetadata?.id) };
      }

      if (value.__typename === "ProjectV2ItemFieldNumberValue") {
        return { ...base, value: value.number ?? null, editable: Boolean(fieldMetadata?.id) };
      }

      if (value.__typename === "ProjectV2ItemFieldDateValue") {
        return { ...base, value: value.date ?? null, editable: Boolean(fieldMetadata?.id) };
      }

      if (value.__typename === "ProjectV2ItemFieldSingleSelectValue") {
        return {
          ...base,
          value: value.name ?? null,
          optionId: value.optionId ?? null,
          optionName: value.name ?? null,
          editable: Boolean(fieldMetadata?.id && value.optionId)
        };
      }

      if (value.__typename === "ProjectV2ItemFieldIterationValue") {
        return { ...base, value: value.title ?? null, editable: false };
      }

      return { ...base, value: null, editable: false };
    });
}

type ProjectV2OwnerSummary = Pick<ProjectSummary, "ownerLogin" | "ownerKind" | "ownerHtmlUrl">;

function mapProjectV2Owner(owner: GitHubProjectV2OwnerNode | null | undefined): ProjectV2OwnerSummary {
  if (!owner) {
    return mapUnknownProjectV2Owner();
  }

  if (isGitHubProjectV2RepositoryOwner(owner)) {
    return mapRepositoryProjectV2Owner(owner);
  }

  if (isGitHubProjectV2OrganizationOwner(owner)) {
    return mapOrganizationProjectV2Owner(owner);
  }

  if (isGitHubProjectV2UserOwner(owner)) {
    return mapUserProjectV2Owner(owner);
  }

  return mapUnknownProjectV2Owner();
}

function mapRepositoryProjectV2Owner(owner: GitHubProjectV2RepositoryOwnerNode): ProjectV2OwnerSummary {
  return {
    ownerLogin: owner.nameWithOwner ?? null,
    ownerKind: "repository",
    ownerHtmlUrl: owner.url ?? null
  };
}

function mapOrganizationProjectV2Owner(owner: GitHubProjectV2OrganizationOwnerNode): ProjectV2OwnerSummary {
  return {
    ownerLogin: owner.login ?? null,
    ownerKind: "organization",
    ownerHtmlUrl: owner.url ?? null
  };
}

function mapUserProjectV2Owner(owner: GitHubProjectV2UserOwnerNode): ProjectV2OwnerSummary {
  return {
    ownerLogin: owner.login ?? null,
    ownerKind: "user",
    ownerHtmlUrl: owner.url ?? null
  };
}

function mapUnknownProjectV2Owner(): ProjectV2OwnerSummary {
  return {
    ownerLogin: null,
    ownerKind: "unknown",
    ownerHtmlUrl: null
  };
}

function isGitHubProjectV2RepositoryOwner(
  owner: GitHubProjectV2OwnerNode
): owner is GitHubProjectV2RepositoryOwnerNode {
  return owner.__typename === "Repository";
}

function isGitHubProjectV2OrganizationOwner(
  owner: GitHubProjectV2OwnerNode
): owner is GitHubProjectV2OrganizationOwnerNode {
  return owner.__typename === "Organization";
}

function isGitHubProjectV2UserOwner(owner: GitHubProjectV2OwnerNode): owner is GitHubProjectV2UserOwnerNode {
  return owner.__typename === "User";
}

function mapPullRequestTimelineEvent(
  event: GitHubIssueTimelineEvent,
  owner: string,
  repo: string
): PullRequestTimelineEventSummary {
  return {
    id: event.id ?? `${event.event}-${event.created_at ?? "unknown"}`,
    event: event.event,
    actorLogin: event.actor?.login ?? null,
    actorAvatarUrl: event.actor?.avatar_url ?? null,
    createdAt: event.created_at ?? null,
    commitSha: event.commit_id ?? null,
    labelName: event.label?.name ?? null,
    assigneeLogin: event.assignee?.login ?? null,
    requestedReviewerLogin: event.requested_reviewer?.login ?? null,
    requestedTeamName: event.requested_team?.name ?? null,
    milestoneTitle: event.milestone?.title ?? null,
    renameFrom: event.rename?.from ?? null,
    renameTo: event.rename?.to ?? null,
    sourceIssue: mapTimelineSourceIssue(event.source?.issue, owner, repo)
  };
}

function mapTimelineSourceIssue(
  issue: GitHubIssueTimelineSourceIssue | null | undefined,
  owner: string,
  repo: string
): PullRequestTimelineEventSummary["sourceIssue"] {
  if (!issue?.number) {
    return null;
  }

  return {
    number: issue.number,
    title: issue.title ?? null,
    htmlUrl: issue.html_url ?? null,
    repositoryNameWithOwner: repositoryNameWithOwnerFromApiUrl(issue.repository_url) ?? `${owner}/${repo}`
  };
}

function repositoryNameWithOwnerFromApiUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const match = /\/repos\/([^/]+)\/([^/?#]+)/.exec(url);
  if (!match) {
    return null;
  }

  return `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`;
}

function mapPullRequestLinkedIssue(issue: GitHubClosingIssueReferenceNode): PullRequestLinkedIssueSummary {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.stateReason ?? null,
    htmlUrl: issue.url ?? null,
    repositoryNameWithOwner: issue.repository?.nameWithOwner ?? null
  };
}

function mapPullRequestFile(file: GitHubPullRequestFile): PullRequestFileSummary {
  return {
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch ?? null,
    blobUrl: file.blob_url ?? null,
    rawUrl: file.raw_url ?? null
  };
}

function mapPullRequestCommit(commit: GitHubPullRequestCommit): PullRequestCommitSummary {
  const messageHeadline = commit.commit.message.split("\n")[0]?.trim() || commit.commit.message;
  return {
    sha: commit.sha,
    message: messageHeadline,
    authorLogin: commit.author?.login ?? null,
    authorAvatarUrl: commit.author?.avatar_url ?? null,
    committedAt: commit.commit.committer?.date ?? commit.commit.author?.date ?? "",
    htmlUrl: commit.html_url ?? null
  };
}

function mapPullRequestReview(review: GitHubPullRequestReview): PullRequestReviewSummary {
  return {
    id: review.id,
    authorLogin: review.user?.login ?? null,
    authorAvatarUrl: review.user?.avatar_url ?? null,
    state: review.state,
    body: review.body ?? null,
    submittedAt: review.submitted_at ?? null,
    commitSha: review.commit_id ?? null,
    htmlUrl: review.html_url ?? null
  };
}

function latestPullRequestReviewState(reviews: PullRequestReviewSummary[]): string | null {
  return (
    reviews
      .filter((review) => review.state !== "COMMENTED")
      .sort((a, b) => (Date.parse(b.submittedAt ?? "") || 0) - (Date.parse(a.submittedAt ?? "") || 0))[0]
      ?.state ?? null
  );
}

function mapPullRequestCheck(run: GitHubCheckRun): PullRequestCheckSummary {
  return {
    id: run.id,
    name: run.name,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    startedAt: run.started_at ?? null,
    completedAt: run.completed_at ?? null,
    htmlUrl: run.html_url ?? null,
    detailsUrl: run.details_url ?? null,
    appName: run.app?.name ?? null,
    outputTitle: run.output?.title ?? null,
    outputSummary: run.output?.summary ?? null
  };
}

function groupPullRequestReviewThreads(
  comments: GitHubPullRequestReviewComment[],
  threadStates: GitHubPullRequestReviewThreadNode[] = []
): PullRequestReviewThreadSummary[] {
  const threadComments = comments.map(mapPullRequestReviewThreadComment);
  const byThreadId = new Map<number, PullRequestReviewThreadCommentSummary[]>();
  const stateByThreadId = new Map<number, GitHubPullRequestReviewThreadNode>();

  for (const threadState of threadStates) {
    const rootComment = threadState.comments.nodes.find((comment) => comment.replyTo === null);
    const rootCommentId = rootComment?.databaseId ?? threadState.comments.nodes[0]?.databaseId ?? null;
    if (rootCommentId !== null) {
      stateByThreadId.set(rootCommentId, threadState);
    }
  }

  for (const comment of threadComments) {
    const threadId = comment.inReplyToId ?? comment.id;
    byThreadId.set(threadId, [...(byThreadId.get(threadId) ?? []), comment]);
  }

  return Array.from(byThreadId.entries()).map(([threadId, commentsInThread]) => {
    const root = commentsInThread.find((comment) => comment.id === threadId) ?? commentsInThread[0]!;
    const threadState =
      stateByThreadId.get(threadId) ??
      commentsInThread.map((comment) => stateByThreadId.get(comment.id)).find((state) => state !== undefined);
    return {
      id: threadId,
      path: threadState?.path ?? root.path,
      isResolved: threadState?.isResolved ?? null,
      isOutdated: threadState?.isOutdated ?? null,
      comments: commentsInThread.sort(
        (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)
      )
    };
  });
}

function mapPullRequestReviewThreadComment(
  comment: GitHubPullRequestReviewComment
): PullRequestReviewThreadCommentSummary {
  return {
    id: comment.id,
    reviewId: comment.pull_request_review_id ?? null,
    authorLogin: comment.user?.login ?? null,
    authorAvatarUrl: comment.user?.avatar_url ?? null,
    body: comment.body ?? null,
    path: comment.path,
    diffHunk: comment.diff_hunk ?? null,
    position: comment.position ?? null,
    originalPosition: comment.original_position ?? null,
    startLine: comment.start_line ?? null,
    line: comment.line ?? null,
    side: comment.side ?? null,
    inReplyToId: comment.in_reply_to_id ?? null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    htmlUrl: comment.html_url ?? null
  };
}

function mapRequestedTeam(team: GitHubRequestedTeam): PullRequestRequestedTeamSummary {
  return {
    id: team.node_id ?? team.id,
    name: team.name,
    slug: team.slug,
    htmlUrl: team.html_url ?? null
  };
}

type RepoEntryCommitMetadata = Pick<
  RepoEntry,
  | "lastCommitSha"
  | "lastCommitMessage"
  | "lastCommitAuthorLogin"
  | "lastCommitAuthorName"
  | "lastCommitAuthorAvatarUrl"
  | "lastAuthoredDate"
  | "lastCommittedDate"
  | "lastCommitDate"
  | "lastCommitHtmlUrl"
  | "lastCommitAdditions"
  | "lastCommitDeletions"
  | "lastCommitChanges"
>;

interface RepoEntryCommitResult {
  metadata: RepoEntryCommitMetadata | null;
  availability: GitHubReadAvailability;
}

function mapRepoEntryCommit(commit: GitHubCommit | null): RepoEntryCommitMetadata | null {
  if (!commit) {
    return null;
  }

  const messageHeadline = commit.commit.message.split("\n")[0]?.trim() || commit.commit.message;
  const authoredDate = commit.commit.author?.date ?? null;
  const committedDate = commit.commit.committer?.date ?? authoredDate;

  return {
    lastCommitSha: commit.sha,
    lastCommitMessage: messageHeadline,
    lastCommitAuthorLogin: commit.author?.login ?? null,
    lastCommitAuthorName: commit.commit.author?.name ?? commit.author?.login ?? null,
    lastCommitAuthorAvatarUrl: commit.author?.avatar_url ?? null,
    lastAuthoredDate: authoredDate,
    lastCommittedDate: committedDate,
    lastCommitDate: committedDate,
    lastCommitHtmlUrl: commit.html_url ?? null,
    lastCommitAdditions: null,
    lastCommitDeletions: null,
    lastCommitChanges: null
  };
}

function mapRepoEntryCommitFileStats(
  files: GitHubCommitFile[],
  path: string
): Pick<RepoEntryCommitMetadata, "lastCommitAdditions" | "lastCommitDeletions" | "lastCommitChanges"> {
  const file = files.find((item) => item.filename === path || item.previous_filename === path);

  return {
    lastCommitAdditions: file?.additions ?? null,
    lastCommitDeletions: file?.deletions ?? null,
    lastCommitChanges: file?.changes ?? null
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

function emptyRepoEntryCommitMetadata(): RepoEntryCommitMetadata {
  return {
    lastCommitSha: null,
    lastCommitMessage: null,
    lastCommitAuthorLogin: null,
    lastCommitAuthorName: null,
    lastCommitAuthorAvatarUrl: null,
    lastAuthoredDate: null,
    lastCommittedDate: null,
    lastCommitDate: null,
    lastCommitHtmlUrl: null,
    lastCommitAdditions: null,
    lastCommitDeletions: null,
    lastCommitChanges: null
  };
}

interface GitHubRepositoryNode {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  visibility: string;
  isPrivate: boolean;
  isFork: boolean;
  stargazerCount: number;
  forkCount: number;
  updatedAt: string | null;
  pushedAt: string | null;
  defaultBranchRef: { name: string } | null;
  owner: { login: string; avatarUrl: string | null };
  watchers?: { totalCount: number };
  issues?: { totalCount: number };
  pullRequests?: { totalCount: number };
  discussions?: { totalCount: number };
  projectsV2?: { totalCount: number } | null;
  releases?: { totalCount: number };
  primaryLanguage: { name: string; color: string | null } | null;
}

interface GitHubRepositoryRefNode {
  id: string;
  name: string;
  nameWithOwner: string;
  url: string;
  defaultBranchRef: { name: string } | null;
  owner: { login: string };
  visibility?: string | null;
  isPrivate?: boolean | null;
  forkCount?: number | null;
  stargazerCount?: number | null;
  viewerPermission?: string | null;
}

interface GitHubOrganizationNode {
  id: string;
  login: string;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  url: string;
  websiteUrl: string | null;
  location: string | null;
  repositories: { totalCount: number };
  teams: { totalCount: number };
  viewerIsAMember: boolean;
  viewerCanAdminister: boolean;
  viewerCanCreateRepositories: boolean;
  viewerCanCreateTeams: boolean;
}

interface GitHubOrganizationMembership {
  role?: string | null;
  state?: string | null;
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

interface GitHubTeamRepository {
  id: number | string;
  node_id?: string | null;
  name: string;
  full_name: string;
  description?: string | null;
  html_url: string;
  default_branch?: string | null;
  visibility?: string | null;
  private?: boolean | null;
  updated_at?: string | null;
  pushed_at?: string | null;
  owner: { login: string };
  permissions?: GitHubRestRepositoryPermissions | null;
}

type GitHubTeamMember = GitHubVisibleMember;

type GitHubOrganizationMember = GitHubVisibleMember;

interface GitHubVisibleMember {
  id: number | string;
  login: string;
  avatar_url?: string | null;
  html_url?: string | null;
  site_admin?: boolean | null;
}

interface GitHubRestRepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}

interface GitHubRestRepositorySecurityAndAnalysisFeature {
  status?: string | null;
}

interface GitHubRestRepositorySecurityAndAnalysis {
  advanced_security?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  code_security?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  dependabot_alerts?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  dependabot_security_updates?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_push_protection?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_non_provider_patterns?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_validity_checks?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
  secret_scanning_ai_detection?: GitHubRestRepositorySecurityAndAnalysisFeature | null;
}

interface GitHubRestRepositoryRef {
  id: number | string;
  node_id?: string | null;
  name: string;
  full_name: string;
  html_url: string;
  default_branch?: string | null;
  visibility?: string | null;
  private?: boolean | null;
  forks_count?: number | null;
  stargazers_count?: number | null;
  archived?: boolean | null;
  disabled?: boolean | null;
  is_template?: boolean | null;
  has_issues?: boolean | null;
  has_projects?: boolean | null;
  has_wiki?: boolean | null;
  has_discussions?: boolean | null;
  allow_merge_commit?: boolean | null;
  allow_squash_merge?: boolean | null;
  allow_rebase_merge?: boolean | null;
  allow_auto_merge?: boolean | null;
  delete_branch_on_merge?: boolean | null;
  allow_update_branch?: boolean | null;
  allow_forking?: boolean | null;
  web_commit_signoff_required?: boolean | null;
  security_and_analysis?: GitHubRestRepositorySecurityAndAnalysis | null;
  owner: { login: string };
  permissions?: GitHubRestRepositoryPermissions | null;
}

interface GitHubRestRepository extends GitHubRestRepositoryRef {
  parent?: GitHubRestRepositoryRef | null;
  source?: GitHubRestRepositoryRef | null;
}

interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at?: string | null;
  url?: string | null;
  subscription_url?: string | null;
  repository: {
    full_name: string;
    html_url?: string | null;
    private?: boolean | null;
  };
  subject: {
    title: string;
    type: string;
    url?: string | null;
    latest_comment_url?: string | null;
  };
}

interface GitHubNotificationSubscription {
  subscribed?: boolean | null;
  ignored?: boolean | null;
  reason?: string | null;
  created_at?: string | null;
}

interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

interface GitHubTag {
  name: string;
  commit: { sha: string };
  zipball_url?: string | null;
  tarball_url?: string | null;
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

interface GitHubLanguages {
  totalSize: number;
  edges: Array<{ size: number; node: { name: string; color: string | null } }>;
}

interface GitHubProfileNode {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  websiteUrl: string | null;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: { totalCount: number };
  starredRepositories: { totalCount: number };
  status: { emoji: string | null; message: string | null } | null;
  pinnedItems: { nodes: GitHubRepositoryNode[] };
}

interface GitHubSearchIssueNode {
  id: string;
  number: number;
  title: string;
  state: string;
  stateReason?: string | null;
  locked?: boolean | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatarUrl: string | null } | null;
  comments: { totalCount: number };
  labels: { nodes: Array<{ id: string; name: string; color: string }> };
  assignees: { nodes: GitHubGraphqlAssignableUser[] };
  milestone: {
    id: string;
    number: number;
    title: string;
    description: string | null;
    state: string;
    dueOn: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    closedAt: string | null;
    url: string | null;
  } | null;
  repository: { nameWithOwner: string };
}

interface GitHubClosingIssueReferenceNode {
  number: number;
  title: string;
  state: string;
  stateReason?: string | null;
  url: string | null;
  repository: { nameWithOwner: string } | null;
}

interface GitHubSearchPullRequestNode {
  id: string;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  mergedAt?: string | null;
  isDraft: boolean;
  locked?: boolean | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatarUrl: string | null } | null;
  comments: { totalCount: number };
  reviewThreads: { totalCount: number };
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeStateStatus: string | null;
  headRefName: string;
  baseRefName: string;
  headRepository?: { nameWithOwner: string } | null;
  baseRepository?: { nameWithOwner: string } | null;
  repository: { nameWithOwner: string };
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  sha: string;
  size?: number;
  html_url?: string;
  download_url?: string | null;
}

interface GitHubContentFile extends GitHubContentItem {
  type: "file";
  content?: string;
  encoding?: string;
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

interface GitHubGraphqlAssignableUser {
  id: string;
  login: string;
  avatarUrl: string | null;
  url: string | null;
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

interface GitHubCommitDetail extends GitHubCommit {
  files?: GitHubCommitFile[];
}

interface GitHubCommitFile {
  filename: string;
  previous_filename?: string | null;
  additions?: number | null;
  deletions?: number | null;
  changes?: number | null;
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

interface GitHubIssue {
  id: number;
  node_id?: string | null;
  number: number;
  title: string;
  state: string;
  state_reason?: string | null;
  locked?: boolean | null;
  user: GitHubUser | null;
  body?: string | null;
  comments: number;
  labels: Array<{ id: number; name: string; color: string }>;
  assignees?: GitHubAssignableUser[];
  milestone?: GitHubIssueMilestone | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

interface GitHubIssueComment {
  id: number;
  user: GitHubUser | null;
  body: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubDiscussionCommentNode {
  id: string;
  author: { login: string; avatarUrl?: string | null } | null;
  body?: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
  replies?: {
    totalCount: number;
    nodes?: GitHubDiscussionCommentNode[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  } | null;
}

interface GitHubProjectV2Node {
  id: string;
  number?: number | null;
  title: string;
  shortDescription?: string | null;
  readme?: string | null;
  owner?: GitHubProjectV2OwnerNode | null;
  public?: boolean | null;
  closed: boolean;
  closedAt?: string | null;
  createdAt?: string | null;
  updatedAt: string | null;
  items?: {
    totalCount: number;
    nodes?: Array<GitHubProjectV2ItemNode | null>;
  } | null;
  fields?: {
    totalCount: number;
    nodes?: Array<GitHubProjectV2FieldNode | null>;
  } | null;
  viewerCanUpdate?: boolean | null;
  url: string | null;
}

interface GitHubProjectV2FieldNode {
  id: string;
  name: string;
  dataType?: string | null;
  options?: Array<{ id: string; name: string }>;
}

interface GitHubProjectV2ItemNode {
  id: string;
  type?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  content?: GitHubProjectV2ItemContentNode | null;
  fieldValues?: {
    totalCount: number;
    nodes?: Array<GitHubProjectV2ItemFieldValueNode | null>;
  } | null;
}

type GitHubProjectV2ItemFieldValueNode =
  | {
      __typename: "ProjectV2ItemFieldTextValue";
      id: string;
      text?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldNumberValue";
      id: string;
      number?: number | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldDateValue";
      id: string;
      date?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldSingleSelectValue";
      id: string;
      name?: string | null;
      optionId?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldIterationValue";
      id: string;
      title?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename:
        | "ProjectV2ItemFieldLabelValue"
        | "ProjectV2ItemFieldMilestoneValue"
        | "ProjectV2ItemFieldPullRequestValue"
        | "ProjectV2ItemFieldRepositoryValue"
        | "ProjectV2ItemFieldReviewerValue"
        | "ProjectV2ItemFieldUserValue"
        | "ProjectV2ItemIssueFieldValue";
      id?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    };

type GitHubProjectV2ItemContentNode =
  | {
      __typename: "Issue";
      id: string;
      number?: number | null;
      title: string;
      url?: string | null;
      state?: string | null;
      body?: string | null;
      repository?: { nameWithOwner: string } | null;
    }
  | {
      __typename: "PullRequest";
      id: string;
      number?: number | null;
      title: string;
      url?: string | null;
      state?: string | null;
      merged?: boolean | null;
      isDraft?: boolean | null;
      body?: string | null;
      repository?: { nameWithOwner: string } | null;
    }
  | {
      __typename: "DraftIssue";
      id: string;
      title: string;
      body?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }
  | {
      __typename: "Redacted";
      id?: string | null;
    };

type GitHubProjectV2OwnerNode =
  | GitHubProjectV2OrganizationOwnerNode
  | GitHubProjectV2UserOwnerNode
  | GitHubProjectV2RepositoryOwnerNode
  | GitHubProjectV2UnknownOwnerNode;

interface GitHubProjectV2OrganizationOwnerNode {
  __typename: "Organization";
  login?: string | null;
  url?: string | null;
}

interface GitHubProjectV2UserOwnerNode {
  __typename: "User";
  login?: string | null;
  url?: string | null;
}

interface GitHubProjectV2RepositoryOwnerNode {
  __typename: "Repository";
  nameWithOwner?: string | null;
  url?: string | null;
}

interface GitHubProjectV2UnknownOwnerNode {
  __typename: string;
}

interface GitHubIssueTimelineSourceIssue {
  number?: number | null;
  title?: string | null;
  html_url?: string | null;
  repository_url?: string | null;
}

interface GitHubIssueTimelineEvent {
  id?: number | string | null;
  event: string;
  actor?: GitHubUser | null;
  created_at?: string | null;
  commit_id?: string | null;
  label?: { name?: string | null } | null;
  assignee?: GitHubUser | null;
  requested_reviewer?: GitHubUser | null;
  requested_team?: GitHubRequestedTeam | null;
  milestone?: { title?: string | null } | null;
  rename?: { from?: string | null; to?: string | null } | null;
  source?: { issue?: GitHubIssueTimelineSourceIssue | null } | null;
}

interface GitHubPullRequest {
  id: number;
  node_id?: string | null;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  merged?: boolean | null;
  merged_at?: string | null;
  locked?: boolean | null;
  user: GitHubUser | null;
  body?: string | null;
  comments?: number;
  review_comments?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  mergeable_state?: string | null;
  reviewDecision?: string | null;
  merge_commit_sha?: string | null;
  maintainer_can_modify?: boolean | null;
  head?: { ref: string; sha?: string | null; repo?: { full_name?: string | null } | null };
  base?: { ref: string; repo?: { full_name?: string | null } | null };
  requested_reviewers?: GitHubAssignableUser[];
  requested_teams?: GitHubRequestedTeam[];
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubRequestedTeam {
  id: number | string;
  node_id?: string | null;
  name: string;
  slug: string;
  html_url?: string | null;
}

interface GitHubPullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | null;
  blob_url?: string | null;
  raw_url?: string | null;
}

interface GitHubPullRequestCommit {
  sha: string;
  commit: {
    message: string;
    author?: { date?: string | null } | null;
    committer?: { date?: string | null } | null;
  };
  author: GitHubUser | null;
  html_url?: string | null;
}

interface GitHubPullRequestReview {
  id: number;
  user: GitHubUser | null;
  state: string;
  body?: string | null;
  submitted_at?: string | null;
  commit_id?: string | null;
  html_url?: string | null;
}

interface GitHubPullRequestReviewComment {
  id: number;
  pull_request_review_id?: number | null;
  user: GitHubUser | null;
  body?: string | null;
  path: string;
  diff_hunk?: string | null;
  position?: number | null;
  original_position?: number | null;
  start_line?: number | null;
  line?: number | null;
  side?: string | null;
  in_reply_to_id?: number | null;
  created_at: string;
  updated_at: string;
  html_url?: string | null;
}

interface GitHubPullRequestReviewThreadNode {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  comments: {
    nodes: GitHubPullRequestReviewThreadCommentNode[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface GitHubPullRequestReviewThreadCommentNode {
  databaseId: number | null;
  replyTo: {
    databaseId: number | null;
  } | null;
}

interface GitHubWorkflowRun {
  id: number;
  name: string;
  display_title?: string | null;
  run_number?: number | null;
  run_attempt?: number | null;
  event: string;
  status: string | null;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string | null;
  head_repository?: {
    full_name?: string | null;
  } | null;
  actor?: GitHubUser | null;
  triggering_actor?: GitHubUser | null;
  run_started_at?: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  logs_url?: string | null;
  rerun_url?: string | null;
  rerun_failed_jobs_url?: string | null;
  cancel_url?: string | null;
  previous_attempt_url?: string | null;
}

interface GitHubWorkflowDefinition {
  id: number;
  node_id?: string | null;
  name: string;
  path: string;
  state: string;
  html_url?: string | null;
  badge_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GitHubWorkflowJob {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string | null;
  runner_name?: string | null;
  labels?: string[];
  steps?: Array<{
    name: string;
    status: string | null;
    conclusion: string | null;
    number: number;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
}

interface GitHubWorkflowArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  archive_download_url?: string | null;
}

interface GitHubCheckApp {
  name?: string | null;
  slug?: string | null;
  html_url?: string | null;
}

interface GitHubCheckSuite {
  id: number;
  status?: string | null;
  conclusion?: string | null;
  head_branch?: string | null;
  head_sha?: string | null;
  before?: string | null;
  after?: string | null;
  app?: GitHubCheckApp | null;
  latest_check_runs_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GitHubCheckRun {
  id: number;
  name: string;
  status?: string | null;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string | null;
  details_url?: string | null;
  check_suite?: { id?: number | null } | null;
  app?: GitHubCheckApp | null;
  output?: {
    title?: string | null;
    summary?: string | null;
    text?: string | null;
    annotations_count?: number | null;
  } | null;
}

interface GitHubCheckRunAnnotation {
  path: string;
  start_line?: number | null;
  end_line?: number | null;
  annotation_level?: string | null;
  title?: string | null;
  message: string;
  raw_details?: string | null;
  blob_href?: string | null;
}

interface GitHubBranchProtectionEnabledFlag {
  enabled?: boolean | null;
}

interface GitHubBranchProtection {
  url?: string | null;
  required_status_checks?: {
    contexts?: string[];
    enforcement_level?: string | null;
  } | null;
  enforce_admins?: GitHubBranchProtectionEnabledFlag | null;
  required_pull_request_reviews?: {
    dismiss_stale_reviews?: boolean | null;
    require_code_owner_reviews?: boolean | null;
    required_approving_review_count?: number | null;
    require_last_push_approval?: boolean | null;
  } | null;
  restrictions?: {
    users?: unknown[];
    teams?: unknown[];
    apps?: unknown[];
  } | null;
  required_linear_history?: GitHubBranchProtectionEnabledFlag | null;
  allow_force_pushes?: GitHubBranchProtectionEnabledFlag | null;
  allow_deletions?: GitHubBranchProtectionEnabledFlag | null;
  required_conversation_resolution?: GitHubBranchProtectionEnabledFlag | null;
  lock_branch?: GitHubBranchProtectionEnabledFlag | null;
  allow_fork_syncing?: GitHubBranchProtectionEnabledFlag | null;
}

interface GitHubCommunityProfileFile {
  name?: string | null;
  path?: string | null;
  html_url?: string | null;
  download_url?: string | null;
  url?: string | null;
}

interface GitHubCommunityProfile {
  health_percentage?: number | null;
  description?: string | null;
  documentation?: string | null;
  files?: {
    readme?: GitHubCommunityProfileFile | null;
    license?: GitHubCommunityProfileFile | null;
    code_of_conduct?: GitHubCommunityProfileFile | null;
    contributing?: GitHubCommunityProfileFile | null;
    issue_template?: GitHubCommunityProfileFile | null;
    pull_request_template?: GitHubCommunityProfileFile | null;
  } | null;
}

interface GitHubDependabotAlert {
  number: number;
  state: string;
  dependency?: {
    package?: {
      ecosystem?: string | null;
      name?: string | null;
    } | null;
    manifest_path?: string | null;
    scope?: string | null;
  } | null;
  security_advisory?: {
    summary?: string | null;
    severity?: string | null;
  } | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  dismissed_at?: string | null;
  fixed_at?: string | null;
}

interface GitHubCodeScanningAlert {
  number: number;
  state: string;
  rule?: {
    id?: string | null;
    name?: string | null;
    severity?: string | null;
    security_severity_level?: string | null;
    description?: string | null;
  } | null;
  tool?: {
    name?: string | null;
  } | null;
  most_recent_instance?: {
    ref?: string | null;
    message?: { text?: string | null } | null;
    location?: {
      path?: string | null;
      start_line?: number | null;
      end_line?: number | null;
    } | null;
  } | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  dismissed_at?: string | null;
  fixed_at?: string | null;
}

interface GitHubSecretScanningAlert {
  number: number;
  state: string;
  resolution?: string | null;
  resolved_at?: string | null;
  secret_type?: string | null;
  secret_type_display_name?: string | null;
  validity?: string | null;
  publicly_leaked?: boolean | null;
  multi_repo?: boolean | null;
  push_protection_bypassed?: boolean | null;
  push_protection_bypassed_at?: string | null;
  first_location_detected?: {
    path?: string | null;
    start_line?: number | null;
    end_line?: number | null;
  } | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GitHubRepositoryRuleset {
  id: number;
  node_id?: string | null;
  name: string;
  target?: string | null;
  enforcement?: string | null;
  source_type?: string | null;
  source?: string | null;
  ruleset_source_type?: string | null;
  ruleset_source?: string | null;
  html_url?: string | null;
  _links?: {
    html?: { href?: string | null } | null;
  } | null;
  bypass_actors?: unknown[] | null;
  conditions?: Record<string, unknown> | null;
  rules?: unknown[] | null;
  current_user_can_bypass?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GitHubRepositorySecurityAdvisory {
  ghsa_id: string;
  cve_id?: string | null;
  state: string;
  severity?: string | null;
  summary: string;
  description?: string | null;
  cvss?: {
    score?: number | null;
    vector_string?: string | null;
  } | null;
  cwes?: Array<{ cwe_id?: string | null; name?: string | null }> | null;
  vulnerabilities?: unknown[] | null;
  credits?: unknown[] | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  withdrawn_at?: string | null;
}

interface GitHubRelease {
  id: number;
  name: string | null;
  tag_name: string;
  target_commitish?: string | null;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  assets?: GitHubReleaseAsset[];
}

interface GitHubReleaseAsset {
  id: number;
  name: string;
  label?: string | null;
  state?: string | null;
  content_type?: string | null;
  size: number;
  download_count?: number | null;
  browser_download_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string | null;
  html_url: string | null;
  contributions: number;
}
