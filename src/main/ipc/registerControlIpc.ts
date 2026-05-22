import { shell, type IpcMain } from "electron";

import type {
  AccountIssueListInput,
  AccountProfileInput,
  AccountPullRequestListInput,
  AccountRepositoryInput,
  ActionsInput,
  AssignableUserListInput,
  BranchListInput,
  BranchProtectionInput,
  CodeScanningAlertsInput,
  ContributorsInput,
  ControlSettings,
  DependabotAlertsInput,
  DiscussionCategoryListInput,
  DiscussionDetailInput,
  DiscussionListInput,
  IssueDetailInput,
  IssueListInput,
  NotificationListInput,
  NotificationThreadInput,
  OrganizationListInput,
  OrganizationMembersInput,
  OrganizationProjectsInput,
  OrganizationRepositoriesInput,
  OrganizationTeamMembersInput,
  OrganizationTeamRepositoriesInput,
  OrganizationTeamsInput,
  ProjectsInput,
  PullRequestChecksInput,
  PullRequestCommentsInput,
  PullRequestCommitsInput,
  PullRequestDetailInput,
  PullRequestDetailReadInput,
  PullRequestFilesInput,
  PullRequestLinkedIssuesInput,
  PullRequestListInput,
  PullRequestOverviewInput,
  PullRequestReviewsInput,
  PullRequestReviewThreadsInput,
  PullRequestTimelineInput,
  ReleasesInput,
  RepoContentsInput,
  RepoDetailInput,
  RepoFileBlameInput,
  RepoFileContentInput,
  RepoReadmeInput,
  RepositoryAccessInput,
  RepositoryCommitListInput,
  RepositoryCommunityProfileInput,
  RepositoryForksInput,
  RepositoryLabelListInput,
  RepositoryMilestoneListInput,
  RepositoryRulesetsInput,
  RepositorySecurityAdvisoriesInput,
  RepositorySecurityPolicyInput,
  RepositoryWikiInput,
  RepoTreeInput,
  SearchInput,
  SecretScanningAlertsInput,
  TagListInput,
  WorkflowJobLogsInput,
  WorkflowListInput,
  WorkflowRunDetailInput
} from "@shared/github";
import { ipcChannels } from "@shared/ipc";
import type {
  LocalRecentListInput,
  LocalRecentMetadata,
  LocalRecentRecordInput,
  RepositoryPinInput,
  RepositoryPinRecord
} from "@shared/local";
import type { GitHubProviderManager } from "../github/provider";
import type { LocalStore } from "../storage";
import { registerEffectPilotIpc, type EffectIpcBridge } from "../effect/ipcBridge";
import { openExternalHttps } from "../externalLinks";
import { createGithubIpcRoutes } from "./registerGithubIpc";
import { createIpcInvokeRoute, registerIpcRoutes, type IpcInvokeRoute } from "./ipcRouter";

interface RegisterControlIpcInput {
  ipcMain: Pick<IpcMain, "handle">;
  store: LocalStore;
  github: GitHubProviderManager;
  effectBridge: EffectIpcBridge;
}

export function registerControlIpc({ ipcMain, store, github, effectBridge }: RegisterControlIpcInput): void {
  registerEffectPilotIpc(ipcMain, effectBridge);
  registerIpcRoutes(ipcMain, createControlIpcRoutes({ store, github }));
}

export function createControlIpcRoutes({
  store,
  github
}: Pick<RegisterControlIpcInput, "store" | "github">): IpcInvokeRoute[] {
  return [
    controlRoute<void, ReturnType<GitHubProviderManager["createAppState"]>>({
      channel: ipcChannels.appState,
      parse: () => undefined,
      handle: () => github.createAppState()
    }),
    controlRoute<Partial<ControlSettings>, ReturnType<LocalStore["updateSettings"]>>({
      channel: ipcChannels.updateSettings,
      parse: ([settings]) =>
        requireRecordInput<Partial<ControlSettings>>(settings, "Settings update input must be an object."),
      handle: (settings) => store.updateSettings(settings)
    }),
    controlRoute<void, ReturnType<GitHubProviderManager["signInWithBrowser"]>>({
      channel: ipcChannels.signInWithGitHub,
      parse: () => undefined,
      handle: () => github.signInWithBrowser((url) => openExternalHttps(url, shell))
    }),
    controlRoute<void, ReturnType<GitHubProviderManager["getGitHubSignInState"]>>({
      channel: ipcChannels.getGitHubSignIn,
      parse: () => undefined,
      handle: () => github.getGitHubSignInState()
    }),
    controlRoute<void, void>({
      channel: ipcChannels.cancelGitHubSignIn,
      parse: () => undefined,
      handle: () => {
        github.cancelWebSignIn();
      }
    }),
    controlRoute<void, Promise<Awaited<ReturnType<GitHubProviderManager["createAppState"]>>>>({
      channel: ipcChannels.clearGitHubToken,
      parse: () => undefined,
      handle: async () => {
        await github.clearToken();
        return github.createAppState();
      }
    }),
    controlRoute<void, ReturnType<LocalStore["listPinnedRepositories"]>>({
      channel: ipcChannels.listPinnedRepositories,
      parse: () => undefined,
      handle: () => store.listPinnedRepositories()
    }),
    controlRoute<string, ReturnType<LocalStore["listPinnedRepositories"]>>({
      channel: ipcChannels.pinRepository,
      parse: ([input]) => requireRepositoryPinInput(input as RepositoryPinInput),
      handle: (nameWithOwner) => {
        store.pinRepository(nameWithOwner);
        return store.listPinnedRepositories();
      }
    }),
    controlRoute<string, ReturnType<LocalStore["listPinnedRepositories"]>>({
      channel: ipcChannels.unpinRepository,
      parse: ([input]) => requireRepositoryPinInput(input as RepositoryPinInput),
      handle: (nameWithOwner) => {
        store.unpinRepository(nameWithOwner);
        return store.listPinnedRepositories();
      }
    }),
    controlRoute<void, ReturnType<LocalStore["listAreaRepositoryPins"]>>({
      channel: ipcChannels.listRepositoryPins,
      parse: () => undefined,
      handle: () => store.listAreaRepositoryPins()
    }),
    controlRoute<RepositoryPinRecord, ReturnType<LocalStore["listAreaRepositoryPins"]>>({
      channel: ipcChannels.pinAreaRepository,
      parse: ([input]) => requireAreaRepositoryPinInput(input as RepositoryPinInput),
      handle: (pin) => {
        store.pinAreaRepository(pin);
        return store.listAreaRepositoryPins();
      }
    }),
    controlRoute<RepositoryPinRecord, ReturnType<LocalStore["listAreaRepositoryPins"]>>({
      channel: ipcChannels.unpinAreaRepository,
      parse: ([input]) => requireAreaRepositoryPinInput(input as RepositoryPinInput),
      handle: (pin) => {
        store.unpinAreaRepository(pin);
        return store.listAreaRepositoryPins();
      }
    }),
    controlRoute<LocalRecentListInput, ReturnType<LocalStore["listRecentItems"]>>({
      channel: ipcChannels.listRecentItems,
      parse: ([input]) => requireRecentListInput(input as LocalRecentListInput),
      handle: (input) => store.listRecentItems(input)
    }),
    controlRoute<LocalRecentRecordInput, ReturnType<LocalStore["listRecentItems"]>>({
      channel: ipcChannels.recordRecentItem,
      parse: ([input]) => requireRecentRecordInput(input as LocalRecentRecordInput),
      handle: (recent) => {
        store.addRecentItem(recent.kind, recent.provider ?? "github", recent.itemKey, recent);
        return store.listRecentItems({ limit: 12 });
      }
    }),

    controlRoute<void, ReturnType<GitHubProviderManager["getViewer"]>>({
      channel: ipcChannels.githubViewer,
      parse: () => undefined,
      handle: () => github.getViewer()
    }),
    githubOptionalRoute<AccountProfileInput>(ipcChannels.githubAccountProfileWithStatus, (input) =>
      github.getAccountProfileWithStatus(input)
    ),
    ...createGithubIpcRoutes(github),
    githubOptionalRoute<AccountRepositoryInput>(ipcChannels.githubAccountRepositoriesWithStatus, (input) =>
      github.listAccountRepositoriesWithStatus(input)
    ),
    githubOptionalRoute<OrganizationListInput>(ipcChannels.githubOrganizationsWithStatus, (input) =>
      github.listOrganizationsWithStatus(input)
    ),
    githubOrgRoute<OrganizationTeamsInput>(ipcChannels.githubOrganizationTeamsWithStatus, (input) =>
      github.listOrganizationTeamsWithStatus(input)
    ),
    githubOrgRoute<OrganizationRepositoriesInput>(
      ipcChannels.githubOrganizationRepositoriesWithStatus,
      (input) => github.listOrganizationRepositoriesWithStatus(input)
    ),
    githubOrgTeamRoute<OrganizationTeamRepositoriesInput>(
      ipcChannels.githubOrganizationTeamRepositoriesWithStatus,
      (input) => github.listOrganizationTeamRepositoriesWithStatus(input)
    ),
    githubOrgTeamRoute<OrganizationTeamMembersInput>(
      ipcChannels.githubOrganizationTeamMembersWithStatus,
      (input) => github.listOrganizationTeamMembersWithStatus(input)
    ),
    githubOrgRoute<OrganizationMembersInput>(ipcChannels.githubOrganizationMembersWithStatus, (input) =>
      github.listOrganizationMembersWithStatus(input)
    ),
    githubOrgRoute<OrganizationProjectsInput>(ipcChannels.githubOrganizationProjectsWithStatus, (input) =>
      github.listOrganizationProjectsWithStatus(input)
    ),
    githubOptionalRoute<AccountIssueListInput>(ipcChannels.githubAccountIssuesWithStatus, (input) =>
      github.listAccountIssuesWithStatus(input)
    ),
    githubOptionalRoute<AccountPullRequestListInput>(
      ipcChannels.githubAccountPullRequestsWithStatus,
      (input) => github.listAccountPullRequestsWithStatus(input)
    ),
    githubOptionalRoute<NotificationListInput>(ipcChannels.githubNotificationsWithStatus, (input) =>
      github.listNotificationsWithStatus(input)
    ),
    githubThreadRoute(ipcChannels.githubNotificationThreadRead, (input) =>
      github.markNotificationThreadRead(input)
    ),
    githubThreadRoute(ipcChannels.githubNotificationThreadUnsubscribe, (input) =>
      github.unsubscribeNotificationThread(input)
    ),
    githubRepoRoute<RepoDetailInput>(ipcChannels.githubRepositoryWithStatus, (input) =>
      github.getRepositoryWithStatus(input)
    ),
    githubRepoRoute<RepositoryForksInput>(ipcChannels.githubRepositoryForks, (input) =>
      github.listRepositoryForks(input)
    ),
    githubRepoRoute<BranchListInput>(ipcChannels.githubBranchesWithStatus, (input) =>
      github.listBranchesWithStatus(input)
    ),
    githubRepoRoute<TagListInput>(ipcChannels.githubTagsWithStatus, (input) =>
      github.listTagsWithStatus(input)
    ),
    githubRepoRoute<RepoTreeInput>(ipcChannels.githubTreeWithStatus, (input) =>
      github.listTreeWithStatus(input)
    ),
    githubRepoRoute<RepoReadmeInput>(ipcChannels.githubReadme, (input) => github.getReadme(input)),
    githubRepoRoute<RepoContentsInput>(ipcChannels.githubContentsWithStatus, (input) =>
      github.listContentsWithStatus(input)
    ),
    githubRepoPathRoute<RepoFileContentInput>(ipcChannels.githubFileContentWithStatus, (input) =>
      github.getFileContentWithStatus(input)
    ),
    githubRepoPathRoute<RepoFileBlameInput>(ipcChannels.githubFileBlame, (input) =>
      github.getFileBlame(input)
    ),
    githubRepoRoute<RepositoryWikiInput>(ipcChannels.githubRepositoryWiki, (input) =>
      github.getRepositoryWiki(input)
    ),
    githubRepoRoute<RepositoryCommitListInput>(ipcChannels.githubCommitsWithStatus, (input) =>
      github.listCommitsWithStatus(input)
    ),
    githubRepoRoute<RepositoryLabelListInput>(ipcChannels.githubLabelsWithStatus, (input) =>
      github.listLabelsWithStatus(input)
    ),
    githubRepoRoute<AssignableUserListInput>(ipcChannels.githubAssignableUsersWithStatus, (input) =>
      github.listAssignableUsersWithStatus(input)
    ),
    githubRepoRoute<RepositoryAccessInput>(ipcChannels.githubRepositoryAccess, (input) =>
      github.getRepositoryAccess(input)
    ),
    githubRepoRoute<RepositoryMilestoneListInput>(ipcChannels.githubMilestonesWithStatus, (input) =>
      github.listMilestonesWithStatus(input)
    ),
    githubRepoRoute<IssueListInput>(ipcChannels.githubIssuesWithStatus, (input) =>
      github.listIssuesWithStatus(input)
    ),
    githubIssueDetailRoute<IssueDetailInput>(ipcChannels.githubIssueDetailWithStatus, (input) =>
      github.getIssueDetailWithStatus(input)
    ),
    githubRepoRoute<PullRequestListInput>(ipcChannels.githubPullRequestsWithStatus, (input) =>
      github.listPullRequestsWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestDetailInput>(
      ipcChannels.githubPullRequestDetailWithStatus,
      (input) => github.getPullRequestDetailWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestOverviewInput>(
      ipcChannels.githubPullRequestOverviewWithStatus,
      (input) => github.getPullRequestOverviewWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestCommentsInput>(
      ipcChannels.githubPullRequestCommentsWithStatus,
      (input) => github.listPullRequestCommentsWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestFilesInput>(
      ipcChannels.githubPullRequestFilesWithStatus,
      (input) => github.listPullRequestFilesWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestCommitsInput>(
      ipcChannels.githubPullRequestCommitsWithStatus,
      (input) => github.listPullRequestCommitsWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestReviewsInput>(
      ipcChannels.githubPullRequestReviewsWithStatus,
      (input) => github.listPullRequestReviewsWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestChecksInput>(
      ipcChannels.githubPullRequestChecksWithStatus,
      (input) => github.listPullRequestChecksWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestReviewThreadsInput>(
      ipcChannels.githubPullRequestReviewThreadsWithStatus,
      (input) => github.listPullRequestReviewThreadsWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestTimelineInput>(
      ipcChannels.githubPullRequestTimelineWithStatus,
      (input) => github.listPullRequestTimelineWithStatus(input)
    ),
    githubPullRequestDetailRoute<PullRequestLinkedIssuesInput>(
      ipcChannels.githubPullRequestLinkedIssuesWithStatus,
      (input) => github.listPullRequestLinkedIssuesWithStatus(input)
    ),
    githubRepoRoute<DiscussionListInput>(ipcChannels.githubDiscussionsWithStatus, (input) =>
      github.listDiscussionsWithStatus(input)
    ),
    githubRepoRoute<DiscussionCategoryListInput>(ipcChannels.githubDiscussionCategoriesWithStatus, (input) =>
      github.listDiscussionCategoriesWithStatus(input)
    ),
    githubDiscussionDetailRoute<DiscussionDetailInput>(ipcChannels.githubDiscussionDetail, (input) =>
      github.getDiscussionDetail(input)
    ),
    githubRepoRoute<ActionsInput>(ipcChannels.githubActionsWithStatus, (input) =>
      github.listActionsWithStatus(input)
    ),
    githubRepoRoute<WorkflowListInput>(ipcChannels.githubWorkflowsWithStatus, (input) =>
      github.listWorkflowsWithStatus(input)
    ),
    githubWorkflowRunDetailRoute<WorkflowRunDetailInput>(
      ipcChannels.githubWorkflowRunDetailWithStatus,
      (input) => github.getWorkflowRunDetailWithStatus(input)
    ),
    githubWorkflowJobLogsRoute<WorkflowJobLogsInput>(ipcChannels.githubWorkflowJobLogs, (input) =>
      github.getWorkflowJobLogs(input)
    ),
    githubRepoRoute<ProjectsInput>(ipcChannels.githubProjectsWithStatus, (input) =>
      github.listProjectsWithStatus(input)
    ),
    githubBranchProtectionRoute<BranchProtectionInput>(ipcChannels.githubBranchProtection, (input) =>
      github.getBranchProtection(input)
    ),
    githubRepoRoute<DependabotAlertsInput>(ipcChannels.githubDependabotAlerts, (input) =>
      github.listDependabotAlerts(input)
    ),
    githubRepoRoute<CodeScanningAlertsInput>(ipcChannels.githubCodeScanningAlerts, (input) =>
      github.listCodeScanningAlerts(input)
    ),
    githubRepoRoute<SecretScanningAlertsInput>(ipcChannels.githubSecretScanningAlerts, (input) =>
      github.listSecretScanningAlerts(input)
    ),
    githubRepoRoute<RepositoryRulesetsInput>(ipcChannels.githubRepositoryRulesets, (input) =>
      github.listRepositoryRulesets(input)
    ),
    githubRepoRoute<RepositorySecurityAdvisoriesInput>(
      ipcChannels.githubRepositorySecurityAdvisories,
      (input) => github.listRepositorySecurityAdvisories(input)
    ),
    githubRepoRoute<RepositorySecurityPolicyInput>(ipcChannels.githubRepositorySecurityPolicy, (input) =>
      github.getRepositorySecurityPolicy(input)
    ),
    githubRepoRoute<RepositoryCommunityProfileInput>(ipcChannels.githubRepositoryCommunityProfile, (input) =>
      github.getRepositoryCommunityProfile(input)
    ),
    githubRepoRoute<ReleasesInput>(ipcChannels.githubReleasesWithStatus, (input) =>
      github.listReleasesWithStatus(input)
    ),
    githubRepoRoute<ContributorsInput>(ipcChannels.githubContributorsWithStatus, (input) =>
      github.listContributorsWithStatus(input)
    ),
    controlRoute<SearchInput, ReturnType<GitHubProviderManager["searchWithStatus"]>>({
      channel: ipcChannels.githubSearchWithStatus,
      parse: ([input]) => requireSearchInput(input),
      handle: (input) => github.searchWithStatus(input)
    })
  ];
}

function controlRoute<TInput, TOutput>(route: {
  channel: string;
  parse: (args: readonly unknown[]) => TInput;
  handle: (input: TInput) => TOutput;
}): IpcInvokeRoute {
  return createIpcInvokeRoute<TInput, TOutput>(route);
}

function githubOptionalRoute<TInput extends object, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => requireOptionalRecordInput<TInput>(input),
    handle
  });
}

function githubRepoRoute<TInput extends RepoDetailInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => requireRepoScopedInput<TInput>(input),
    handle
  });
}

function githubRepoPathRoute<TInput extends RepoFileContentInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRepoScopedInput<RepoFileContentInput & { maxRanges?: number }>(input);
      return {
        ...record,
        path: requireTrimmedText(record.path, "GitHub file input requires a path."),
        maxRanges: optionalPositiveInteger(
          record.maxRanges,
          "GitHub file blame range limit must be positive."
        )
      } as unknown as TInput;
    },
    handle
  });
}

function githubBranchProtectionRoute<TInput extends BranchProtectionInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRepoScopedInput<BranchProtectionInput>(input);
      return {
        ...record,
        branch: requireTrimmedText(record.branch, "GitHub branch protection input requires a branch.")
      } as TInput;
    },
    handle
  });
}

function githubDiscussionDetailRoute<TInput extends DiscussionDetailInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRepoScopedInput<DiscussionDetailInput>(input);
      return {
        ...record,
        discussionNumber: requirePositiveInteger(
          record.discussionNumber,
          "GitHub discussion input requires a number."
        ),
        commentsLimit: optionalPositiveInteger(
          record.commentsLimit,
          "GitHub discussion comments limit must be positive."
        ),
        repliesLimit: optionalPositiveInteger(
          record.repliesLimit,
          "GitHub discussion replies limit must be positive."
        )
      } as TInput;
    },
    handle
  });
}

function githubWorkflowRunDetailRoute<TInput extends WorkflowRunDetailInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRepoScopedInput<WorkflowRunDetailInput>(input);
      return {
        ...record,
        runId: requirePositiveInteger(record.runId, "GitHub workflow run input requires a run id.")
      } as TInput;
    },
    handle
  });
}

function githubWorkflowJobLogsRoute<TInput extends WorkflowJobLogsInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRepoScopedInput<WorkflowJobLogsInput>(input);
      return {
        ...record,
        jobId: requirePositiveInteger(record.jobId, "GitHub workflow job logs input requires a job id."),
        maxCharacters: optionalPositiveInteger(
          record.maxCharacters,
          "GitHub workflow job logs maxCharacters must be positive."
        )
      } as TInput;
    },
    handle
  });
}

function githubPullRequestDetailRoute<TInput extends PullRequestDetailReadInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => requirePullRequestDetailInput<TInput>(input),
    handle
  });
}

function githubIssueDetailRoute<TInput extends IssueDetailInput, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => requireIssueDetailInput<TInput>(input),
    handle
  });
}

function githubOrgRoute<TInput extends { org: string }, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRecordInput<Record<string, unknown>>(
        input,
        "GitHub organization input must be an object."
      );
      return normalizeKnownGitHubReadFields({
        ...record,
        org: requireTrimmedText(record.org, "GitHub organization input requires an org.")
      }) as TInput;
    },
    handle
  });
}

function githubOrgTeamRoute<TInput extends { org: string; teamSlug: string }, TOutput = unknown>(
  channel: string,
  handle: (input: TInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<TInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRecordInput<Record<string, unknown>>(
        input,
        "GitHub team input must be an object."
      );
      return normalizeKnownGitHubReadFields({
        ...record,
        org: requireTrimmedText(record.org, "GitHub team input requires an org."),
        teamSlug: requireTrimmedText(record.teamSlug, "GitHub team input requires a team slug.")
      }) as TInput;
    },
    handle
  });
}

function githubThreadRoute<TOutput>(
  channel: string,
  handle: (input: NotificationThreadInput) => TOutput
): IpcInvokeRoute {
  return controlRoute<NotificationThreadInput, TOutput>({
    channel,
    parse: ([input]) => {
      const record = requireRecordInput<Record<string, unknown>>(
        input,
        "GitHub notification thread input must be an object."
      );
      return {
        threadId: requireTrimmedText(
          record.threadId,
          "GitHub notification thread input requires a thread id."
        )
      };
    },
    handle
  });
}

function requireOptionalRecordInput<TInput extends object>(input: unknown = {}): TInput {
  if (input === undefined) {
    return {} as TInput;
  }
  const record = requireRecordInput<Record<string, unknown>>(input, "IPC input must be an object.");
  return normalizeKnownGitHubReadFields(record) as TInput;
}

function requireRecordInput<TInput extends object>(input: unknown, message: string): TInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(message);
  }
  return input as TInput;
}

function requireRepoScopedInput<TInput extends RepoDetailInput>(input: unknown): TInput {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "GitHub repository input must be an object."
  );
  return normalizeKnownGitHubReadFields({
    ...record,
    owner: requireTrimmedText(record.owner, "GitHub repository input requires an owner."),
    repo: requireTrimmedText(record.repo, "GitHub repository input requires a repo.")
  }) as TInput;
}

function normalizeKnownGitHubReadFields(record: Record<string, unknown>): Record<string, unknown> {
  const normalized = {
    ...record,
    cacheOnly: optionalBoolean(record.cacheOnly, "GitHub cacheOnly must be a boolean."),
    forceRefresh: optionalBoolean(record.forceRefresh, "GitHub forceRefresh must be a boolean.")
  };

  setOptional(normalized, record, "limit", (value) =>
    optionalPositiveInteger(value, "GitHub limit must be a positive integer.")
  );
  setOptional(normalized, record, "commentsLimit", (value) =>
    optionalPositiveInteger(value, "GitHub comments limit must be a positive integer.")
  );
  setOptional(normalized, record, "repliesLimit", (value) =>
    optionalPositiveInteger(value, "GitHub replies limit must be a positive integer.")
  );
  setOptional(normalized, record, "maxRanges", (value) =>
    optionalPositiveInteger(value, "GitHub maxRanges must be a positive integer.")
  );
  setOptional(normalized, record, "maxCharacters", (value) =>
    optionalPositiveInteger(value, "GitHub maxCharacters must be a positive integer.")
  );
  setOptional(normalized, record, "ref", (value) =>
    optionalNullableText(value, "GitHub ref must be a string or null.")
  );
  setOptional(normalized, record, "path", (value) => optionalText(value, "GitHub path must be a string."));
  setOptional(normalized, record, "pagePath", (value) =>
    optionalNullableText(value, "GitHub wiki page path must be a string or null.")
  );
  setOptional(normalized, record, "since", (value) =>
    optionalNullableText(value, "GitHub since cursor must be a string or null.")
  );
  setOptional(normalized, record, "before", (value) =>
    optionalNullableText(value, "GitHub before cursor must be a string or null.")
  );
  setOptional(normalized, record, "recursive", (value) =>
    optionalBoolean(value, "GitHub recursive flag must be a boolean.")
  );
  setOptional(normalized, record, "all", (value) =>
    optionalBoolean(value, "GitHub notification all flag must be a boolean.")
  );
  setOptional(normalized, record, "participating", (value) =>
    optionalBoolean(value, "GitHub notification participating flag must be a boolean.")
  );
  setOptional(normalized, record, "includesParents", (value) =>
    optionalBoolean(value, "GitHub ruleset includesParents flag must be a boolean.")
  );
  setOptional(normalized, record, "state", (value) =>
    optionalKnownValue(value, "GitHub state is not supported.", [
      "open",
      "closed",
      "all",
      "dismissed",
      "fixed",
      "auto_dismissed",
      "resolved"
    ])
  );
  setOptional(normalized, record, "sort", (value) =>
    optionalKnownValue(value, "GitHub sort is not supported.", ["newest", "oldest", "stargazers"])
  );
  setOptional(normalized, record, "affiliation", (value) =>
    optionalKnownValue(value, "GitHub affiliation is not supported.", ["all", "direct", "outside"])
  );
  setOptional(normalized, record, "permission", (value) =>
    optionalKnownValue(value, "GitHub permission is not supported.", [
      "admin",
      "maintain",
      "push",
      "triage",
      "pull"
    ])
  );

  return normalized;
}

function requirePullRequestDetailInput<TInput extends PullRequestDetailReadInput>(input: unknown): TInput {
  const record = requireRecordInput<Record<string, unknown>>(
    input,
    "GitHub pull request input must be an object."
  );
  const repoInput = requireRepoScopedInput<PullRequestDetailReadInput>(record);
  return {
    ...record,
    owner: repoInput.owner,
    repo: repoInput.repo,
    pullNumber: requirePositiveInteger(record.pullNumber, "GitHub pull request input requires a number."),
    cacheOnly: optionalBoolean(record.cacheOnly, "GitHub pull request cacheOnly must be a boolean."),
    forceRefresh: optionalBoolean(record.forceRefresh, "GitHub pull request forceRefresh must be a boolean."),
    limit: optionalPositiveInteger(record.limit, "GitHub pull request limit must be a positive integer."),
    cursor: optionalCursor(record.cursor)
  } as unknown as TInput;
}

function requireIssueDetailInput<TInput extends IssueDetailInput>(input: unknown): TInput {
  const record = requireRecordInput<Record<string, unknown>>(input, "GitHub issue input must be an object.");
  const repoInput = requireRepoScopedInput<IssueDetailInput>(record);
  return {
    ...record,
    owner: repoInput.owner,
    repo: repoInput.repo,
    issueNumber: requirePositiveInteger(record.issueNumber, "GitHub issue input requires a number."),
    cacheOnly: optionalBoolean(record.cacheOnly, "GitHub issue cacheOnly must be a boolean."),
    forceRefresh: optionalBoolean(record.forceRefresh, "GitHub issue forceRefresh must be a boolean.")
  } as unknown as TInput;
}

function requireSearchInput(input: unknown): SearchInput {
  const record = requireRecordInput<Record<string, unknown>>(input, "GitHub search input must be an object.");
  return {
    ...record,
    query: requireTrimmedText(record.query, "GitHub search input requires a query.")
  } as SearchInput;
}

function requireRepositoryPinInput(input: RepositoryPinInput): string {
  if (!input || typeof input.nameWithOwner !== "string") {
    throw new Error("Repository pins require an owner/repo name.");
  }

  const nameWithOwner = input.nameWithOwner.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(nameWithOwner)) {
    throw new Error("Repository pins require an owner/repo name.");
  }

  return nameWithOwner;
}

function requireAreaRepositoryPinInput(input: RepositoryPinInput): RepositoryPinRecord {
  if (!input || typeof input !== "object") {
    throw new Error("Area repository pins require a repository payload.");
  }

  const areaId = optionalTrimmedText(input.areaId);
  const repositoryId = optionalTrimmedText(input.repositoryId);
  const workspaceId = optionalTrimmedText(input.workspaceId);
  const nameWithOwner = optionalTrimmedText(input.nameWithOwner);
  if (!areaId || !repositoryId) {
    throw new Error("Area repository pins require an Area id and repository id.");
  }
  if (nameWithOwner && !/^[^/\s]+\/[^/\s]+$/.test(nameWithOwner)) {
    throw new Error("Area repository GitHub names must use owner/repo format.");
  }

  return {
    areaId,
    repositoryId,
    workspaceId,
    nameWithOwner,
    createdAt: null
  };
}

function requireRecentListInput(input: LocalRecentListInput = {}): LocalRecentListInput {
  return {
    kind: input.kind ? requireRecentKind(input.kind) : undefined,
    limit: normalizeLocalLimit(input.limit)
  };
}

function requireRecentRecordInput(input: LocalRecentRecordInput): LocalRecentRecordInput {
  if (!input || typeof input !== "object") {
    throw new Error("Recent items require a GitHub item payload.");
  }

  const kind = requireRecentKind(input.kind);
  const provider = input.provider === "local" ? "local" : "github";
  const itemKey = requireTrimmedText(input.itemKey, "Recent items require an item key.");
  const title = requireTrimmedText(input.title, "Recent items require a title.");
  const subtitle = optionalTrimmedText(input.subtitle);
  const repositoryNameWithOwner = optionalTrimmedText(input.repositoryNameWithOwner);
  const areaId = optionalTrimmedText(input.areaId);
  const repositoryId = optionalTrimmedText(input.repositoryId);
  const workspaceId = optionalTrimmedText(input.workspaceId);
  const url = optionalTrimmedText(input.url);
  if (url && !url.startsWith("https://")) {
    throw new Error("Recent item URLs must be HTTPS links.");
  }

  return {
    kind,
    provider,
    itemKey,
    title,
    subtitle,
    repositoryNameWithOwner,
    areaId,
    repositoryId,
    workspaceId,
    url,
    metadata: sanitizeRecentMetadata(input.metadata)
  };
}

function requireRecentKind(kind: unknown): LocalRecentRecordInput["kind"] {
  if (
    kind === "repository" ||
    kind === "commit" ||
    kind === "issue" ||
    kind === "pullRequest" ||
    kind === "discussion" ||
    kind === "organization" ||
    kind === "team" ||
    kind === "contributor" ||
    kind === "project" ||
    kind === "release" ||
    kind === "releaseAsset" ||
    kind === "workflowRun" ||
    kind === "workflowArtifact" ||
    kind === "securityItem" ||
    kind === "wikiPage" ||
    kind === "file"
  ) {
    return kind;
  }

  throw new Error("Recent items require a supported GitHub item kind.");
}

function requireTrimmedText(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function requirePositiveInteger(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
  return value;
}

function optionalPositiveInteger(value: unknown, message: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requirePositiveInteger(value, message);
}

function optionalText(value: unknown, message: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(message);
  }
  return value;
}

function optionalNullableText(value: unknown, message: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(message);
  }
  return value;
}

function optionalBoolean(value: unknown, message: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
  return value;
}

function optionalKnownValue<TValue extends string>(
  value: unknown,
  message: string,
  supportedValues: readonly TValue[]
): TValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !supportedValues.includes(value as TValue)) {
    throw new Error(message);
  }
  return value as TValue;
}

function setOptional(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  key: string,
  parse: (value: unknown) => unknown
): void {
  if (source[key] !== undefined) {
    target[key] = parse(source[key]);
  }
}

function optionalCursor(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("GitHub pull request cursor must be a string or null.");
  }
  return value;
}

function optionalTrimmedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeLocalLimit(limit: unknown): number {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.trunc(limit)))
    : 12;
}

function sanitizeRecentMetadata(metadata: unknown): LocalRecentMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.entries(metadata as Record<string, unknown>).reduce<LocalRecentMetadata>(
    (acc, [key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );
}
