import { ExternalLink, GitPullRequest, Plus, Search, X } from "lucide-react";
import { useState, type JSX } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  BranchProtectionResult,
  GitHubAction,
  GitHubMutationFields,
  GitHubReadAvailability,
  PullRequestDetail,
  PullRequestChecksResult,
  PullRequestCommentsResult,
  PullRequestCommitsResult,
  PullRequestFilesResult,
  PullRequestLinkedIssuesResult,
  PullRequestListResult,
  PullRequestOverviewResult,
  PullRequestReviewsResult,
  PullRequestReviewThreadsResult,
  PullRequestTimelineResult,
  PullRequestCommitSummary,
  PullRequestLinkedIssueSummary,
  PullRequestReviewSummary,
  PullRequestReviewThreadCommentSummary,
  PullRequestReviewThreadSummary,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { markdownRepositoryUrlContext, type MarkdownUrlContext } from "@renderer/components/MarkdownBody";

import {
  fieldsMatchSearchParts,
  githubActionLabel,
  normalizedSearchParts,
  readAvailabilityMessage,
  readAvailabilityStatusLabel,
  repositoryMutationDisabledReason
} from "@renderer/components/repository/repositoryUi";
import { TimelineComment } from "@renderer/components/shared/TimelineComment";
import { TimelineThread } from "@renderer/components/shared/TimelineThread";

import { useControlApi } from "@renderer/hooks/useControlApi";
import {
  repositoryAssignableUsersQueryKey,
  repositoryLabelsQueryKey,
  repositoryMilestonesQueryKey,
  useRepositoryIssueResources
} from "@renderer/hooks/useRepositoryIssueResources";
import { useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";

type PullRequestLinkedIssue =
  | NonNullable<PullRequestTimelineEventSummary["sourceIssue"]>
  | PullRequestLinkedIssueSummary;
const maxPullRequestListLimit = 100;
const notLoadedAvailability: GitHubReadAvailability = { status: "not_loaded", message: null };

export interface PullRequestsTabQueryInput {
  owner: string;
  repo: string;
  pullRequestListLimit: number;
  pullsEnabled: boolean;
  resourcesEnabled: boolean;
  githubReady: boolean;
}

export interface PullRequestsTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  pullRequestListLimit: number;
  githubReady: boolean;
}

export function pullRequestsTabQueryKey(
  owner: string,
  repo: string,
  pullRequestListLimit: number
): readonly ["pulls", string, string, number] {
  return ["pulls", owner, repo, pullRequestListLimit] as const;
}

export function usePullRequestsTabQueries({
  owner,
  repo,
  pullRequestListLimit,
  pullsEnabled,
  resourcesEnabled,
  githubReady
}: PullRequestsTabQueryInput) {
  const api = useControlApi();
  const pulls = useQuery<PullRequestListResult>({
    queryKey: pullRequestsTabQueryKey(owner, repo, pullRequestListLimit),
    queryFn: () =>
      api.github.listPullRequestsWithStatus({
        owner,
        repo,
        state: "all",
        limit: pullRequestListLimit,
        cacheOnly: !githubReady
      }),
    enabled: pullsEnabled,
    staleTime: 60_000
  });
  const resources = useRepositoryIssueResources(owner, repo, resourcesEnabled, { githubReady });

  return { pulls, ...resources };
}

export async function prefetchPullRequestsTabData(
  queryClient: QueryClient,
  { api, owner, repo, pullRequestListLimit, githubReady }: PullRequestsTabPrefetchInput
): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: pullRequestsTabQueryKey(owner, repo, pullRequestListLimit),
      queryFn: () =>
        api.github.listPullRequestsWithStatus({
          owner,
          repo,
          state: "all",
          limit: pullRequestListLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryLabelsQueryKey(owner, repo),
      queryFn: () => api.github.listLabelsWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryAssignableUsersQueryKey(owner, repo),
      queryFn: () =>
        api.github.listAssignableUsersWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryMilestonesQueryKey(owner, repo),
      queryFn: () =>
        api.github.listMilestonesWithStatus({
          owner,
          repo,
          state: "all",
          limit: 100,
          cacheOnly: !githubReady
        }),
      staleTime: 120_000
    })
  ]);
}

function conversationCommentDisabledReason(
  repository: RepositoryDetail,
  locked: boolean | null | undefined
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (locked) {
    return "Conversation is locked.";
  }
  return null;
}

function githubNumericId(id: number | string): number | null {
  if (typeof id === "number" && Number.isFinite(id)) {
    return id;
  }
  if (typeof id === "string" && /^\d+$/.test(id)) {
    return Number(id);
  }
  return null;
}

function useComposedPullRequestDetail({
  repository,
  pullNumber,
  githubReady,
  enabled
}: {
  repository: RepositoryDetail;
  pullNumber: number | null;
  githubReady: boolean;
  enabled: boolean;
}): {
  detail: PullRequestDetail | null;
  availability: GitHubReadAvailability | null;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
} {
  const api = useControlApi();
  const detailInput = {
    owner: repository.owner,
    repo: repository.name,
    pullNumber: pullNumber ?? 0,
    cacheOnly: !githubReady
  };
  const queryEnabled = enabled && pullNumber !== null;
  const overview = useQuery<PullRequestOverviewResult>({
    queryKey: ["pull-detail", "overview", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.getPullRequestOverviewWithStatus(detailInput),
    enabled: queryEnabled
  });
  const comments = useQuery<PullRequestCommentsResult>({
    queryKey: ["pull-detail", "comments", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestCommentsWithStatus(detailInput),
    enabled: queryEnabled
  });
  const files = useQuery<PullRequestFilesResult>({
    queryKey: ["pull-detail", "files", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestFilesWithStatus(detailInput),
    enabled: queryEnabled
  });
  const commits = useQuery<PullRequestCommitsResult>({
    queryKey: ["pull-detail", "commits", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestCommitsWithStatus(detailInput),
    enabled: queryEnabled
  });
  const reviews = useQuery<PullRequestReviewsResult>({
    queryKey: ["pull-detail", "reviews", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestReviewsWithStatus(detailInput),
    enabled: queryEnabled
  });
  const checks = useQuery<PullRequestChecksResult>({
    queryKey: ["pull-detail", "checks", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestChecksWithStatus(detailInput),
    enabled: queryEnabled
  });
  const reviewThreads = useQuery<PullRequestReviewThreadsResult>({
    queryKey: ["pull-detail", "review-threads", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestReviewThreadsWithStatus(detailInput),
    enabled: queryEnabled
  });
  const timeline = useQuery<PullRequestTimelineResult>({
    queryKey: ["pull-detail", "timeline", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestTimelineWithStatus(detailInput),
    enabled: queryEnabled
  });
  const linkedIssues = useQuery<PullRequestLinkedIssuesResult>({
    queryKey: ["pull-detail", "linked-issues", repository.owner, repository.name, pullNumber],
    queryFn: () => api.github.listPullRequestLinkedIssuesWithStatus(detailInput),
    enabled: queryEnabled
  });
  const queries = [
    overview,
    comments,
    files,
    commits,
    reviews,
    checks,
    reviewThreads,
    timeline,
    linkedIssues
  ];

  return {
    detail: composePullRequestDetail({
      overview: overview.data,
      comments: comments.data,
      files: files.data,
      commits: commits.data,
      reviews: reviews.data,
      checks: checks.data,
      reviewThreads: reviewThreads.data,
      timeline: timeline.data,
      linkedIssues: linkedIssues.data
    }),
    availability: overview.data?.availability ?? null,
    error: queries.find((query) => query.error instanceof Error)?.error ?? null,
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching)
  };
}

function composePullRequestDetail({
  overview,
  comments,
  files,
  commits,
  reviews,
  checks,
  reviewThreads,
  timeline,
  linkedIssues
}: {
  overview: PullRequestOverviewResult | undefined;
  comments: PullRequestCommentsResult | undefined;
  files: PullRequestFilesResult | undefined;
  commits: PullRequestCommitsResult | undefined;
  reviews: PullRequestReviewsResult | undefined;
  checks: PullRequestChecksResult | undefined;
  reviewThreads: PullRequestReviewThreadsResult | undefined;
  timeline: PullRequestTimelineResult | undefined;
  linkedIssues: PullRequestLinkedIssuesResult | undefined;
}): PullRequestDetail | null {
  if (!overview?.overview) {
    return null;
  }

  return {
    ...overview.overview,
    commentsList: comments?.items ?? [],
    commentsAvailability: comments?.availability ?? notLoadedAvailability,
    files: files?.items ?? [],
    filesAvailability: files?.availability ?? notLoadedAvailability,
    commitsList: commits?.items ?? [],
    commitsAvailability: commits?.availability ?? notLoadedAvailability,
    reviews: reviews?.items ?? [],
    reviewsAvailability: reviews?.availability ?? notLoadedAvailability,
    checks: checks?.items ?? [],
    checksAvailability: checks?.availability ?? notLoadedAvailability,
    reviewThreads: reviewThreads?.items ?? [],
    reviewThreadsAvailability: reviewThreads?.availability ?? notLoadedAvailability,
    reviewThreadStatesAvailability: reviewThreads?.statesAvailability ?? notLoadedAvailability,
    timelineEvents: timeline?.items ?? [],
    timelineAvailability: timeline?.availability ?? notLoadedAvailability,
    linkedIssues: linkedIssues?.items ?? [],
    linkedIssuesAvailability: linkedIssues?.availability ?? notLoadedAvailability
  };
}

function commaSeparatedValues(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function appendCommaSeparatedValue(current: string, value: string): string {
  const values = commaSeparatedValues(current);
  if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
    values.push(value);
  }
  return values.join(", ");
}

function mergeUniqueStrings(existing: string[], additions: string[]): string[] {
  const values = [...existing];
  for (const addition of additions) {
    if (!values.some((value) => value.toLowerCase() === addition.toLowerCase())) {
      values.push(addition);
    }
  }
  return values;
}

function commentMutationDisabledReason(
  repository: RepositoryDetail,
  comment: TimelineCommentSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (githubNumericId(comment.id) === null) {
    return "Comment id is unavailable for this action.";
  }
  return null;
}

function reviewCommentMutationDisabledReason(
  repository: RepositoryDetail,
  comment: PullRequestReviewThreadCommentSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (githubNumericId(comment.id) === null) {
    return "Review comment id is unavailable for this action.";
  }
  return null;
}

function mergeDisabledReason(repository: RepositoryDetail, pull: PullRequestSummary): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (pull.merged) {
    return "Pull request is already merged.";
  }
  if (pull.state !== "open") {
    return "Pull request is not open.";
  }
  if (pull.isDraft) {
    return "Draft pull requests cannot be merged.";
  }
  if (pull.mergeableState && pull.mergeableState !== "clean") {
    return `Merge is blocked because GitHub reports ${pull.mergeableState}.`;
  }
  return null;
}

function pullStateMutationDisabledReason(
  repository: RepositoryDetail,
  pull: PullRequestSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (pull.merged) {
    return "Merged pull requests cannot be reopened.";
  }
  return null;
}

function reviewDisabledReason(repository: RepositoryDetail, pull: PullRequestSummary): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (pull.locked) {
    return "Pull request conversation is locked.";
  }
  if (pull.state !== "open") {
    return "Pull request is not open.";
  }
  return null;
}

function formatPullRequestReviewDecision(value: string | null | undefined): string {
  switch (value) {
    case "APPROVED":
      return "Approved";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "REVIEW_REQUIRED":
      return "Review required";
    default:
      return "Review unknown";
  }
}

function pullRequestReviewDecisionTone(value: string | null | undefined): string {
  if (value === "APPROVED") {
    return "success";
  }
  if (value === "CHANGES_REQUESTED" || value === "REVIEW_REQUIRED") {
    return "attention";
  }
  return "";
}

function parseWorkflowRunIdFromUrl(url: string | null | undefined): number | null {
  const match = url?.match(/\/actions\/runs\/(\d+)(?:[/?#]|$)/);
  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]);
}

function pullRequestTimelineEventLabel(event: PullRequestTimelineEventSummary): string {
  if (event.sourceIssue) {
    const repository =
      event.sourceIssue.repositoryNameWithOwner && event.sourceIssue.repositoryNameWithOwner !== ""
        ? `${event.sourceIssue.repositoryNameWithOwner} `
        : "";
    return `${event.event} ${repository}#${event.sourceIssue.number} ${event.sourceIssue.title ?? ""}`.trim();
  }

  if (event.renameFrom || event.renameTo) {
    return `${event.event} ${event.renameFrom ?? "untitled"} to ${event.renameTo ?? "untitled"}`;
  }

  if (event.labelName) {
    return `${event.event} label ${event.labelName}`;
  }

  if (event.assigneeLogin) {
    return `${event.event} ${event.assigneeLogin}`;
  }

  if (event.requestedReviewerLogin) {
    return `${event.event} review from ${event.requestedReviewerLogin}`;
  }

  if (event.requestedTeamName) {
    return `${event.event} team review from ${event.requestedTeamName}`;
  }

  if (event.milestoneTitle) {
    return `${event.event} milestone ${event.milestoneTitle}`;
  }

  if (event.commitSha) {
    return `${event.event} ${event.commitSha.slice(0, 7)}`;
  }

  return event.event;
}

function settingStateLabel(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Enabled" : "Disabled";
}

export function PullRequestsTab({
  repository,
  githubReady,
  selectedRef,
  refListLimit,
  pullRequestListLimit,
  focusedPullNumber,
  initialFilter,
  initialCreating,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onOpenExternal,
  onSelectPullRequest,
  onOpenIssueReference,
  onOpenPullRequestCommit,
  onOpenPullRequestReviewCommit,
  onOpenPullRequestTimelineEventCommit,
  onOpenWorkflowRun,
  onOpenCodePath,
  onExpandPullRequests,
  onMutate
}: {
  repository: RepositoryDetail;
  githubReady: boolean;
  selectedRef: string | null;
  refListLimit: number;
  pullRequestListLimit: number;
  focusedPullNumber: number | null;
  initialFilter: string;
  initialCreating: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onOpenExternal(url: string): void;
  onSelectPullRequest(pullRequest: PullRequestSummary): void;
  onOpenIssueReference(issue: PullRequestLinkedIssue): void;
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
  onOpenWorkflowRun(runId: number, url?: string | null): void;
  onOpenCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onExpandPullRequests(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const [selectedPullNumber, setSelectedPullNumber] = useState<number | null>(null);
  const [filter, setFilter] = useState(initialFilter);
  const [creating, setCreating] = useState(initialCreating);
  const [title, setTitle] = useState("");
  const [head, setHead] = useState("");
  const refs = useRepositoryRefs(
    repository.owner,
    repository.name,
    { branches: true, tags: false },
    refListLimit,
    {
      githubReady
    }
  );
  const {
    pulls,
    labels: labelsQuery,
    assignableUsers: assignableUsersQuery,
    milestones: milestonesQuery,
    labelItems: labels,
    labelAvailability: labelsAvailability,
    assignableUserItems: assignableUsers,
    assignableUsersAvailability,
    milestoneItems: milestones,
    milestonesAvailability
  } = usePullRequestsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    pullRequestListLimit,
    pullsEnabled: true,
    resourcesEnabled: true,
    githubReady
  });
  const branches = refs.branchItems;
  const branchesError = refs.branches.error;
  const pullItems = pulls.data?.items ?? [];
  const availability = pulls.data?.availability ?? null;
  const loading = pulls.isLoading || pulls.isFetching;
  const labelsLoading = labelsQuery.isLoading || labelsQuery.isFetching;
  const labelsError = labelsQuery.error;
  const assignableUsersLoading = assignableUsersQuery.isLoading || assignableUsersQuery.isFetching;
  const assignableUsersError = assignableUsersQuery.error;
  const milestonesLoading = milestonesQuery.isLoading || milestonesQuery.isFetching;
  const milestonesError = milestonesQuery.error;
  const defaultBaseBranch =
    selectedRef && branches.some((branch) => branch.name === selectedRef)
      ? selectedRef
      : (repository.defaultBranch ?? "main");
  const [base, setBase] = useState(defaultBaseBranch);
  const [body, setBody] = useState("");
  const [createDraft, setCreateDraft] = useState(false);
  const [maintainerCanModify, setMaintainerCanModify] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [labelEntry, setLabelEntry] = useState("");
  const [assigneeEntry, setAssigneeEntry] = useState("");
  const [reviewerEntry, setReviewerEntry] = useState("");
  const [teamReviewerEntry, setTeamReviewerEntry] = useState("");
  const [submittedPullAction, setSubmittedPullAction] = useState<GitHubAction | null>(null);
  const [showAllPullLabels, setShowAllPullLabels] = useState(false);
  const [showAllPullAssignees, setShowAllPullAssignees] = useState(false);
  const [showAllPullReviewers, setShowAllPullReviewers] = useState(false);
  const [showAllPullMilestones, setShowAllPullMilestones] = useState(false);
  const labelsAvailabilityMessage = readAvailabilityMessage("Labels", labelsAvailability);
  const assignableUsersAvailabilityMessage = readAvailabilityMessage(
    "Assignable users",
    assignableUsersAvailability
  );
  const milestonesAvailabilityMessage = readAvailabilityMessage("Milestones", milestonesAvailability);
  const pullsAvailabilityMessage = readAvailabilityMessage("Pull requests", availability);
  const filterParts = normalizedSearchParts(filter);
  const filteredPulls = pullItems.filter((pull) =>
    fieldsMatchSearchParts(
      [
        pull.number,
        pull.title,
        pull.state,
        pull.isDraft ? "draft" : "ready",
        pull.mergeableState,
        pull.headRefName,
        pull.baseRefName,
        pull.headRepositoryNameWithOwner,
        pull.baseRepositoryNameWithOwner,
        pull.headRepositoryNameWithOwner ? `head:${pull.headRepositoryNameWithOwner}` : null,
        pull.headRepositoryNameWithOwner ? `source:${pull.headRepositoryNameWithOwner}` : null,
        pull.headRepositoryNameWithOwner ? `fork:${pull.headRepositoryNameWithOwner}` : null,
        pull.baseRepositoryNameWithOwner ? `base:${pull.baseRepositoryNameWithOwner}` : null,
        pull.isCrossRepository === null
          ? null
          : pull.isCrossRepository
            ? "cross repository cross-repo fork source head repository base repository"
            : "same repository",
        pull.authorLogin,
        pull.locked ? "locked" : null,
        `${pull.headRefName}->${pull.baseRefName}`,
        `${pull.changedFiles} files`
      ],
      filterParts
    )
  );
  const requestedPullNumber = selectedPullNumber ?? focusedPullNumber;
  const selectedPullFromList =
    (requestedPullNumber !== null
      ? filteredPulls.find((pull) => pull.number === requestedPullNumber)
      : null) ?? (requestedPullNumber === null ? (filteredPulls[0] ?? null) : null);
  const selectedPullNumberForDetail = selectedPullFromList?.number ?? requestedPullNumber;
  const api = useControlApi();
  const pullDetail = useComposedPullRequestDetail({
    repository,
    pullNumber: selectedPullNumberForDetail,
    githubReady,
    enabled: !creating
  });
  const detail = pullDetail.detail;
  const selectedPull = selectedPullFromList ?? detail;
  const selectedBaseBranchProtection = useQuery<BranchProtectionResult>({
    queryKey: ["branch-protection", repository.owner, repository.name, selectedPull?.baseRefName ?? "none"],
    queryFn: () =>
      api.github.getBranchProtection({
        owner: repository.owner,
        repo: repository.name,
        branch: selectedPull?.baseRefName ?? "",
        cacheOnly: !githubReady
      }),
    enabled: !creating && Boolean(selectedPull?.baseRefName)
  });
  const pullDetailAvailabilityMessage = readAvailabilityMessage(
    "Pull request detail",
    pullDetail.availability
  );
  const selectedPullForActions =
    selectedPull && detail
      ? {
          ...selectedPull,
          merged: detail.merged,
          mergedAt: detail.mergedAt
        }
      : selectedPull;
  const pullAction = selectedPull?.state === "closed" ? "reopenPullRequest" : "closePullRequest";
  const pullActionLabel = selectedPull?.state === "closed" ? "Reopen pull request" : "Close pull request";
  const pullMutationAction =
    mutationAction === "createPullRequest" ||
    mutationAction === "mergePullRequest" ||
    mutationAction === "closePullRequest" ||
    mutationAction === "reopenPullRequest" ||
    mutationAction === "approvePullRequest" ||
    mutationAction === "commentPullRequestReview" ||
    mutationAction === "requestChanges" ||
    mutationAction === "requestReviewers" ||
    mutationAction === "removeReviewers" ||
    mutationAction === "editIssue" ||
    mutationAction === "addComment" ||
    mutationAction === "editComment" ||
    mutationAction === "deleteComment" ||
    mutationAction === "editReviewComment" ||
    mutationAction === "deleteReviewComment" ||
    mutationAction === "addLabels" ||
    mutationAction === "removeLabel" ||
    mutationAction === "setAssignees" ||
    mutationAction === "removeAssignees"
      ? mutationAction
      : null;
  const pullActionPendingReason =
    mutationPending && pullMutationAction
      ? `${githubActionLabel(pullMutationAction)} is still running.`
      : null;
  const livePullDisabledReason = !githubReady ? "Sign in with GitHub to change pull requests." : null;
  const pullActionDisabledReason = selectedPullForActions
    ? (pullActionPendingReason ??
      livePullDisabledReason ??
      pullStateMutationDisabledReason(repository, selectedPullForActions))
    : null;
  const selectedMergeDisabledReason = selectedPullForActions
    ? (pullActionPendingReason ??
      livePullDisabledReason ??
      mergeDisabledReason(repository, selectedPullForActions))
    : null;
  const selectedReviewDisabledReason = selectedPull
    ? (pullActionPendingReason ?? livePullDisabledReason ?? reviewDisabledReason(repository, selectedPull))
    : null;
  const reviewCommentDisabledReason =
    selectedReviewDisabledReason ?? (!reviewBody.trim() ? "A review comment requires a note." : null);
  const selectedMetadataDisabledReason = selectedPull
    ? (pullActionPendingReason ?? livePullDisabledReason ?? repositoryMutationDisabledReason(repository))
    : null;
  const createPullDisabledReason =
    pullActionPendingReason ?? livePullDisabledReason ?? repositoryMutationDisabledReason(repository);
  const createPullMutationActive =
    submittedPullAction === "createPullRequest" && mutationAction === "createPullRequest";
  const pullCommentMutationActive = submittedPullAction === "addComment" && mutationAction === "addComment";
  const pullReviewMutationActive =
    submittedPullAction !== null &&
    (submittedPullAction === "approvePullRequest" ||
      submittedPullAction === "commentPullRequestReview" ||
      submittedPullAction === "requestChanges") &&
    mutationAction === submittedPullAction;
  const effectiveBaseBranch = base.trim() || defaultBaseBranch;
  const createPullSubmitDisabledReason =
    createPullDisabledReason ??
    (!title.trim()
      ? "Pull request title is required."
      : !head.trim()
        ? "Compare branch is required."
        : head.trim() === effectiveBaseBranch
          ? "Compare and base branches must differ."
          : null);
  const pullCommentDisabledReason = selectedPull
    ? (pullActionPendingReason ??
      livePullDisabledReason ??
      conversationCommentDisabledReason(repository, selectedPull.locked))
    : null;
  const selectedLabels = detail?.labels ?? [];
  const selectedAssignees = detail?.assignees ?? [];
  const parsedLabels = commaSeparatedValues(labelEntry);
  const parsedAssignees = commaSeparatedValues(assigneeEntry);
  const pullMetadataSubmitDisabledReason =
    selectedMetadataDisabledReason ??
    (parsedLabels.length === 0 && parsedAssignees.length === 0
      ? "Add at least one label or assignee."
      : null);
  const availableLabels = labels.filter(
    (label) =>
      !selectedLabels.some((selectedLabel) => selectedLabel.name.toLowerCase() === label.name.toLowerCase())
  );
  const visibleLabels = showAllPullLabels ? availableLabels : availableLabels.slice(0, 8);
  const allAssigneeSuggestions = assignableUsers.filter(
    (user) => !selectedAssignees.some((assignee) => assignee.login.toLowerCase() === user.login.toLowerCase())
  );
  const assigneeSuggestions = showAllPullAssignees
    ? allAssigneeSuggestions
    : allAssigneeSuggestions.slice(0, 8);
  const visibleMilestones = showAllPullMilestones ? milestones : milestones.slice(0, 12);
  const hiddenPullLabelCount = availableLabels.length - visibleLabels.length;
  const hiddenPullAssigneeCount = allAssigneeSuggestions.length - assigneeSuggestions.length;
  const hiddenPullMilestoneCount = milestones.length - visibleMilestones.length;
  const parsedReviewers = commaSeparatedValues(reviewerEntry);
  const parsedTeamReviewers = commaSeparatedValues(teamReviewerEntry);
  const reviewerRequestSubmitDisabledReason =
    selectedReviewDisabledReason ??
    (parsedReviewers.length === 0 && parsedTeamReviewers.length === 0
      ? "Add at least one reviewer or team."
      : null);
  const requestedReviewers = detail?.requestedReviewers ?? [];
  const requestedTeams = detail?.requestedTeams ?? [];
  const requestedReviewerLogins = new Set(requestedReviewers.map((reviewer) => reviewer.login.toLowerCase()));
  const typedReviewerLogins = new Set(parsedReviewers.map((login) => login.toLowerCase()));
  const allReviewerSuggestions = assignableUsers
    .filter((user) => !requestedReviewerLogins.has(user.login.toLowerCase()))
    .filter((user) => !typedReviewerLogins.has(user.login.toLowerCase()));
  const reviewerSuggestions = showAllPullReviewers
    ? allReviewerSuggestions
    : allReviewerSuggestions.slice(0, 8);
  const hiddenPullReviewerCount = allReviewerSuggestions.length - reviewerSuggestions.length;
  const branchOptions = branches.map((branch) => branch.name);
  const selectedBaseBranch = selectedPull
    ? (branches.find((branch) => branch.name === selectedPull.baseRefName) ?? null)
    : null;
  const selectedHeadBranch = selectedPull
    ? (branches.find((branch) => branch.name === selectedPull.headRefName) ?? null)
    : null;
  const selectedBranchSignals = [
    selectedBaseBranch
      ? `${selectedPull?.baseRefName ?? "Base"} ${selectedBaseBranch.protected ? "protected" : "unprotected"}`
      : selectedPull
        ? `${selectedPull.baseRefName} protection unknown`
        : null,
    selectedHeadBranch
      ? `${selectedPull?.headRefName ?? "Head"} ${selectedHeadBranch.protected ? "protected" : "unprotected"}`
      : null
  ].filter((signal): signal is string => Boolean(signal));
  const selectedBaseProtection = selectedBaseBranchProtection.data?.protection ?? null;
  const selectedBaseProtectionAvailabilityMessage = readAvailabilityMessage(
    "Base branch protection",
    selectedBaseBranchProtection.data?.availability ?? null
  );
  const selectedBaseProtectionAvailabilityLabel = readAvailabilityStatusLabel(
    selectedBaseBranchProtection.data?.availability ?? null
  );
  const selectedBaseProtectionStatusUnavailable =
    Boolean(selectedBaseBranchProtection.error) || Boolean(selectedBaseProtectionAvailabilityLabel);
  const selectedBaseProtectionStatusLabel =
    selectedBaseBranchProtection.isLoading && !selectedBaseBranchProtection.data
      ? "loading"
      : selectedBaseBranchProtection.error
        ? "unavailable"
        : (selectedBaseProtectionAvailabilityLabel ??
          (selectedBaseProtection
            ? "protected"
            : selectedBaseBranchProtection.data
              ? "unprotected"
              : "unknown"));
  const selectedBaseProtectionBranchLabel =
    selectedPull && selectedPull.baseRefName !== repository.defaultBranch
      ? `Base branch protection for ${selectedPull.baseRefName}`
      : "Base branch protection";
  const pullMarkdownUrlContext = markdownRepositoryUrlContext(
    repository,
    selectedPull?.baseRefName ?? repository.defaultBranch ?? "HEAD"
  );
  const selectedReviewDecision = detail?.reviewDecision ?? selectedPull?.reviewDecision ?? null;
  const reviewDecisionAvailabilityMessage = readAvailabilityMessage(
    "Pull request review decision",
    detail?.reviewDecisionAvailability ?? null
  );
  const selectedHeadRepository =
    detail?.headRepositoryNameWithOwner ?? selectedPull?.headRepositoryNameWithOwner ?? null;
  const selectedBaseRepository =
    detail?.baseRepositoryNameWithOwner ?? selectedPull?.baseRepositoryNameWithOwner ?? null;
  const selectedIsCrossRepository = detail?.isCrossRepository ?? selectedPull?.isCrossRepository ?? null;
  const selectedMaintainerCanModify =
    detail?.maintainerCanModify ?? selectedPull?.maintainerCanModify ?? null;
  const selectedMergeCommitSha = detail?.mergeCommitSha ?? selectedPull?.mergeCommitSha ?? null;
  const selectedMerged = selectedPullForActions?.merged ?? null;
  const selectedMergedAt = selectedPullForActions?.mergedAt ?? null;
  const unfilteredPullRequestListLimitHit = !filter.trim() && pullItems.length >= pullRequestListLimit;

  function addReviewerSuggestion(login: string): void {
    setReviewerEntry((current) => {
      const nextReviewers = commaSeparatedValues(current);
      if (!nextReviewers.some((reviewer) => reviewer.toLowerCase() === login.toLowerCase())) {
        nextReviewers.push(login);
      }
      return nextReviewers.join(", ");
    });
  }

  function submitPullRequestReview(action: GitHubAction, dangerous: boolean): void {
    if (!selectedPull || selectedReviewDisabledReason) {
      return;
    }
    const body = reviewBody.trim();
    if (action === "commentPullRequestReview" && reviewCommentDisabledReason) {
      return;
    }
    setSubmittedPullAction(action);
    onMutate(action, dangerous, {
      pullNumber: selectedPull.number,
      body
    });
  }

  return (
    <section className="table-panel github-surface">
      <div className="table-action-row surface-filter-row">
        <label className="surface-filter">
          <Search size={15} />
          <input
            aria-label="Filter pull requests"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter pull requests"
          />
        </label>
        <button
          type="button"
          disabled={Boolean(createPullDisabledReason)}
          title={createPullDisabledReason ?? undefined}
          onClick={() => {
            setSubmittedPullAction(null);
            setCreating(true);
          }}
        >
          <Plus size={16} /> New pull request
        </button>
      </div>
      <div className="github-split">
        <div className="thread-list">
          {loading && pullItems.length === 0 && <div className="loading-state">Loading pull requests…</div>}
          {!loading && pullsAvailabilityMessage && (
            <div className="error-state">{pullsAvailabilityMessage}</div>
          )}
          {filteredPulls.map((pull) => {
            const headRepositoryNameWithOwner = pull.headRepositoryNameWithOwner ?? null;
            const baseRepositoryNameWithOwner = pull.baseRepositoryNameWithOwner ?? null;
            const headRepositoryDiffers =
              Boolean(headRepositoryNameWithOwner) &&
              headRepositoryNameWithOwner !== repository.nameWithOwner;
            const baseRepositoryDiffers =
              Boolean(baseRepositoryNameWithOwner) &&
              baseRepositoryNameWithOwner !== repository.nameWithOwner;
            const isCrossRepository =
              pull.isCrossRepository ?? (headRepositoryDiffers || baseRepositoryDiffers);
            const sourceRepositoryLabel = headRepositoryNameWithOwner ?? "external source";
            const reviewDecisionLabel =
              pull.reviewDecision === "APPROVED"
                ? "review approved"
                : pull.reviewDecision === "REVIEW_REQUIRED"
                  ? "review required"
                  : pull.reviewDecision === "CHANGES_REQUESTED"
                    ? "changes requested"
                    : pull.reviewDecision
                      ? `review ${pull.reviewDecision.toLowerCase().replaceAll("_", " ")}`
                      : null;

            return (
              <div
                className={`issue-row thread-list-action-row ${
                  selectedPull?.number === pull.number && !creating ? "active" : ""
                }`}
                key={pull.id}
              >
                <button
                  className="thread-list-row-main"
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setSelectedPullNumber(pull.number);
                    onSelectPullRequest(pull);
                  }}
                >
                  <GitPullRequest size={17} />
                  <div>
                    <strong>{pull.title}</strong>
                    <small>
                      #{pull.number} by {pull.authorLogin ?? "unknown"} · {pull.headRefName} -&gt;{" "}
                      {pull.baseRefName} · {pull.changedFiles} files · {pull.comments} comments ·{" "}
                      {pull.reviewComments} review comments
                      {isCrossRepository ? ` · source ${sourceRepositoryLabel}` : ""}
                      {pull.mergedAt ? ` · merged ${formatRelativeDate(pull.mergedAt)}` : ""}
                    </small>
                  </div>
                  <div className="thread-list-row-badges">
                    {isCrossRepository && (
                      <span
                        className="state-chip attention"
                        title={`Source repository: ${sourceRepositoryLabel}`}
                      >
                        {headRepositoryNameWithOwner ? `fork: ${headRepositoryNameWithOwner}` : "fork"}
                      </span>
                    )}
                    <span className={`state-chip ${pull.mergeableState === "clean" ? "success" : ""}`}>
                      {pull.isDraft ? "draft" : (pull.mergeableState ?? pull.state)}
                    </span>
                    {reviewDecisionLabel && <span className="state-chip">{reviewDecisionLabel}</span>}
                    {pull.merged && <span className="state-chip success">merged</span>}
                    <span className={`state-chip ${pull.state === "open" ? "success" : ""}`}>
                      {pull.state}
                    </span>
                    {pull.locked && <span className="state-chip attention">locked</span>}
                  </div>
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Open pull request ${pull.number} GitHub fallback`}
                  title={`GitHub fallback for pull request #${pull.number}`}
                  onClick={() => onOpenExternal(pull.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </div>
            );
          })}
          {!loading && filteredPulls.length === 0 && (
            <div className="empty-state">
              {filter.trim()
                ? "No pull requests match this filter."
                : "No pull requests returned for this repository."}
            </div>
          )}
          {unfilteredPullRequestListLimitHit && pullRequestListLimit < maxPullRequestListLimit && (
            <div className="table-action-row">
              <button type="button" onClick={onExpandPullRequests}>
                Load more pull requests
              </button>
            </div>
          )}
          {unfilteredPullRequestListLimitHit && pullRequestListLimit >= maxPullRequestListLimit && (
            <div className="muted-row">
              Showing the first {pullRequestListLimit} pull requests returned by GitHub.
            </div>
          )}
        </div>

        <div className="thread-detail">
          {creating ? (
            <form
              className="compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (createPullSubmitDisabledReason) {
                  return;
                }
                setSubmittedPullAction("createPullRequest");
                onMutate("createPullRequest", false, {
                  title: title.trim(),
                  head: head.trim(),
                  base: effectiveBaseBranch,
                  body: body.trim(),
                  draft: createDraft,
                  maintainer_can_modify: maintainerCanModify
                });
              }}
            >
              <h2>Open a pull request</h2>
              {createPullMutationActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel("createPullRequest")} is running. The draft is locked until GitHub
                  responds.
                </div>
              )}
              {createPullMutationActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel("createPullRequest")} completed. Pull request data is refreshing.
                </div>
              )}
              {createPullMutationActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel("createPullRequest")} failed: {mutationError.message}
                </div>
              )}
              <input
                value={title}
                disabled={Boolean(createPullDisabledReason)}
                title={createPullDisabledReason ?? undefined}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Pull request title"
              />
              <input
                value={head}
                list={`pull-head-branches-${repository.id}`}
                disabled={Boolean(createPullDisabledReason)}
                title={createPullDisabledReason ?? undefined}
                onChange={(event) => setHead(event.target.value)}
                placeholder="compare branch"
              />
              <input
                value={base}
                list={`pull-base-branches-${repository.id}`}
                disabled={Boolean(createPullDisabledReason)}
                title={createPullDisabledReason ?? undefined}
                onChange={(event) => setBase(event.target.value)}
                placeholder="base branch"
              />
              <datalist id={`pull-head-branches-${repository.id}`}>
                {branchOptions.map((branch) => (
                  <option key={`head-${branch}`} value={branch} />
                ))}
              </datalist>
              <datalist id={`pull-base-branches-${repository.id}`}>
                {branchOptions.map((branch) => (
                  <option key={`base-${branch}`} value={branch} />
                ))}
              </datalist>
              {branchesError && (
                <small className="action-disabled-note">
                  Branch suggestions unavailable: {branchesError.message}. Enter branch names manually.
                </small>
              )}
              <textarea
                value={body}
                disabled={Boolean(createPullDisabledReason)}
                title={createPullDisabledReason ?? undefined}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Describe the changes"
              />
              <small>
                Base branch: <strong>{effectiveBaseBranch}</strong>
              </small>
              <div className="release-options">
                <label>
                  <input
                    checked={createDraft}
                    type="checkbox"
                    disabled={Boolean(createPullDisabledReason)}
                    title={createPullDisabledReason ?? undefined}
                    onChange={(event) => setCreateDraft(event.target.checked)}
                  />
                  Draft pull request
                </label>
                <label>
                  <input
                    checked={maintainerCanModify}
                    type="checkbox"
                    disabled={Boolean(createPullDisabledReason)}
                    title={createPullDisabledReason ?? undefined}
                    onChange={(event) => setMaintainerCanModify(event.target.checked)}
                  />
                  Allow maintainer edits
                </label>
              </div>
              <div>
                <button
                  className="dark-action"
                  type="submit"
                  disabled={Boolean(createPullSubmitDisabledReason)}
                  title={createPullSubmitDisabledReason ?? undefined}
                >
                  <GitPullRequest size={16} /> Create pull request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedPullAction(null);
                    setTitle("");
                    setHead("");
                    setBase(defaultBaseBranch);
                    setBody("");
                    setCreateDraft(false);
                    setMaintainerCanModify(true);
                    setCreating(false);
                  }}
                >
                  Cancel
                </button>
                {createPullSubmitDisabledReason && (
                  <small className="action-disabled-note">
                    Pull request creation unavailable: {createPullSubmitDisabledReason}
                  </small>
                )}
              </div>
            </form>
          ) : selectedPull ? (
            <>
              <header className="thread-header">
                <h2>{selectedPull.title}</h2>
                <small>
                  #{selectedPull.number} by {selectedPull.authorLogin ?? "unknown"} ·{" "}
                  {selectedPull.headRefName} -&gt; {selectedPull.baseRefName}
                </small>
                <span className={`state-chip ${selectedPull.state === "open" ? "success" : ""}`}>
                  {selectedPull.state}
                </span>
                {selectedMerged && <span className="state-chip success">Merged</span>}
                <span className={`state-chip ${pullRequestReviewDecisionTone(selectedReviewDecision)}`}>
                  {formatPullRequestReviewDecision(selectedReviewDecision)}
                </span>
                {reviewDecisionAvailabilityMessage && (
                  <small className="action-disabled-note">{reviewDecisionAvailabilityMessage}</small>
                )}
                {selectedPull.locked && <span className="state-chip attention">Locked</span>}
              </header>
              <div className="diff-summary">
                <span>{selectedPull.changedFiles} files changed</span>
                <span className="additions">+{formatCompactNumber(selectedPull.additions)}</span>
                <span className="deletions">-{formatCompactNumber(selectedPull.deletions)}</span>
                <span>{selectedPull.reviewComments} review comments</span>
                {selectedIsCrossRepository !== null && (
                  <span>{selectedIsCrossRepository ? "Cross-repository" : "Same repository"}</span>
                )}
                {selectedHeadRepository && selectedBaseRepository && (
                  <span>
                    {selectedHeadRepository} -&gt; {selectedBaseRepository}
                  </span>
                )}
                {selectedMaintainerCanModify !== null && (
                  <span>
                    {selectedMaintainerCanModify ? "Maintainer edits allowed" : "Maintainer edits disabled"}
                  </span>
                )}
                {selectedMergeCommitSha && <span>Merge {selectedMergeCommitSha.slice(0, 7)}</span>}
                {selectedMergedAt && <span>Merged {formatRelativeDate(selectedMergedAt)}</span>}
                {selectedBranchSignals.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>
              <div className="workflow-summary branch-protection-flags">
                <span
                  className={`state-chip ${
                    selectedBaseProtectionStatusUnavailable
                      ? "attention"
                      : selectedBaseProtection
                        ? "success"
                        : ""
                  }`}
                >
                  {selectedBaseProtectionBranchLabel}: <strong>{selectedBaseProtectionStatusLabel}</strong>
                </span>
                {selectedBaseBranchProtection.isLoading && !selectedBaseBranchProtection.data && (
                  <span>Loading branch protection…</span>
                )}
                {selectedBaseBranchProtection.error && (
                  <span>Branch protection unavailable: {selectedBaseBranchProtection.error.message}</span>
                )}
                {selectedBaseProtectionAvailabilityMessage && (
                  <span>{selectedBaseProtectionAvailabilityMessage}</span>
                )}
                {!selectedBaseBranchProtection.isLoading &&
                  !selectedBaseBranchProtection.error &&
                  !selectedBaseProtectionAvailabilityMessage &&
                  selectedBaseBranchProtection.data &&
                  !selectedBaseProtection && <span>No protection rules returned.</span>}
                {selectedBaseProtection && (
                  <>
                    <span>
                      Required checks:{" "}
                      {formatCompactNumber(selectedBaseProtection.requiredStatusCheckContexts.length)}
                    </span>
                    <span>Approvals: {selectedBaseProtection.requiredApprovingReviewCount ?? 0}</span>
                    <span>
                      Code owners: {settingStateLabel(selectedBaseProtection.requireCodeOwnerReviews)}
                    </span>
                    <span>
                      Conversation resolution:{" "}
                      {settingStateLabel(selectedBaseProtection.requiredConversationResolution)}
                    </span>
                    <span>
                      Linear history: {settingStateLabel(selectedBaseProtection.requiredLinearHistory)}
                    </span>
                  </>
                )}
              </div>
              {pullDetail.error && <div className="error-state">{pullDetail.error.message}</div>}
              {pullDetailAvailabilityMessage && (
                <div className="error-state">{pullDetailAvailabilityMessage}</div>
              )}
              <PullRequestInspection
                repository={repository}
                detail={detail}
                loading={pullDetail.isLoading || pullDetail.isFetching}
                markdownUrlContext={pullMarkdownUrlContext}
                onOpenExternal={onOpenExternal}
                onOpenIssueReference={onOpenIssueReference}
                onOpenPullRequestCommit={onOpenPullRequestCommit}
                onOpenPullRequestReviewCommit={onOpenPullRequestReviewCommit}
                onOpenPullRequestTimelineEventCommit={onOpenPullRequestTimelineEventCommit}
                onOpenWorkflowRun={onOpenWorkflowRun}
                onOpenCodePath={(path, ref, blobUrl, line, targetRepositoryNameWithOwner) =>
                  onOpenCodePath(path, ref, blobUrl, line, targetRepositoryNameWithOwner)
                }
                reviewCommentActions={{
                  getDisabledReason: (comment) =>
                    pullActionPendingReason ??
                    livePullDisabledReason ??
                    reviewCommentMutationDisabledReason(repository, comment),
                  onEdit: (comment, body) => {
                    const commentId = githubNumericId(comment.id);
                    if (commentId === null) {
                      return;
                    }
                    setSubmittedPullAction("editReviewComment");
                    onMutate("editReviewComment", false, { commentId, body });
                  },
                  onDelete: (comment) => {
                    const commentId = githubNumericId(comment.id);
                    if (commentId === null) {
                      return;
                    }
                    setSubmittedPullAction("deleteReviewComment");
                    onMutate("deleteReviewComment", true, { commentId });
                  }
                }}
              />
              <TimelineThread
                title={`Pull request ${selectedPull.number} discussion`}
                authorLogin={detail?.authorLogin ?? selectedPull.authorLogin}
                authorAvatarUrl={detail?.authorAvatarUrl ?? selectedPull.authorAvatarUrl}
                createdAt={detail?.createdAt ?? selectedPull.createdAt}
                body={detail?.body}
                comments={detail?.commentsList ?? []}
                loading={pullDetail.isLoading || pullDetail.isFetching}
                availabilityMessage={readAvailabilityMessage(
                  "Pull request comments",
                  detail?.commentsAvailability ?? null
                )}
                emptyBody="No pull request description provided."
                markdownUrlContext={pullMarkdownUrlContext}
                onOpenExternal={onOpenExternal}
                commentActions={{
                  getDisabledReason: (comment) =>
                    pullActionPendingReason ??
                    livePullDisabledReason ??
                    commentMutationDisabledReason(repository, comment),
                  onEdit: (comment, body) => {
                    const commentId = githubNumericId(comment.id);
                    if (commentId === null) {
                      return;
                    }
                    setSubmittedPullAction("editComment");
                    onMutate("editComment", false, { commentId, body });
                  },
                  onDelete: (comment) => {
                    const commentId = githubNumericId(comment.id);
                    if (commentId === null) {
                      return;
                    }
                    setSubmittedPullAction("deleteComment");
                    onMutate("deleteComment", true, { commentId });
                  }
                }}
              />
              <div className="issue-metadata-controls">
                <strong>Pull request metadata</strong>
                {(selectedLabels.length > 0 || selectedAssignees.length > 0 || detail?.milestone) && (
                  <div className="label-stack label-row">
                    {selectedLabels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        aria-label={`Remove label ${label.name}`}
                        title={selectedMetadataDisabledReason ?? `Remove label ${label.name}`}
                        disabled={Boolean(selectedMetadataDisabledReason)}
                        onClick={() =>
                          onMutate("removeLabel", false, {
                            issueNumber: selectedPull.number,
                            name: label.name
                          })
                        }
                      >
                        <X size={13} />
                        {label.name}
                      </button>
                    ))}
                    {selectedAssignees.map((assignee) => (
                      <button
                        key={assignee.id}
                        type="button"
                        aria-label={`Remove assignee ${assignee.login}`}
                        title={selectedMetadataDisabledReason ?? `Remove assignee ${assignee.login}`}
                        disabled={Boolean(selectedMetadataDisabledReason)}
                        onClick={() =>
                          onMutate("removeAssignees", false, {
                            issueNumber: selectedPull.number,
                            assignees: [assignee.login]
                          })
                        }
                      >
                        <X size={13} />
                        {assignee.login}
                      </button>
                    ))}
                    {detail?.milestone && <span>Milestone {detail.milestone.title}</span>}
                  </div>
                )}
                <div className="metadata-picker-options" aria-label="Available pull request labels">
                  {labelsLoading && <small>Loading labels…</small>}
                  {labelsError && <small>Could not load labels.</small>}
                  {!labelsError && labelsAvailabilityMessage && <small>{labelsAvailabilityMessage}</small>}
                  {!labelsLoading &&
                    !labelsError &&
                    visibleLabels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        disabled={Boolean(selectedMetadataDisabledReason)}
                        title={selectedMetadataDisabledReason ?? label.description ?? `Add ${label.name}`}
                        onClick={() =>
                          setLabelEntry((current) => appendCommaSeparatedValue(current, label.name))
                        }
                      >
                        <span style={{ backgroundColor: `#${label.color}` }} />
                        {label.name}
                      </button>
                    ))}
                </div>
                {!labelsLoading && !labelsError && hiddenPullLabelCount > 0 && (
                  <div className="table-action-row">
                    <button type="button" onClick={() => setShowAllPullLabels(true)}>
                      Show all labels
                    </button>
                  </div>
                )}
                <div className="metadata-picker-options" aria-label="Assignable pull request users">
                  {assignableUsersLoading && <small>Loading assignees…</small>}
                  {assignableUsersError && <small>Could not load assignees.</small>}
                  {!assignableUsersError && assignableUsersAvailabilityMessage && (
                    <small>{assignableUsersAvailabilityMessage}</small>
                  )}
                  {!assignableUsersLoading &&
                    !assignableUsersError &&
                    assigneeSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        disabled={Boolean(selectedMetadataDisabledReason)}
                        title={selectedMetadataDisabledReason ?? `Assign ${user.login}`}
                        onClick={() =>
                          setAssigneeEntry((current) => appendCommaSeparatedValue(current, user.login))
                        }
                      >
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
                        {user.login}
                      </button>
                    ))}
                </div>
                {!assignableUsersLoading && !assignableUsersError && hiddenPullAssigneeCount > 0 && (
                  <div className="table-action-row">
                    <button type="button" onClick={() => setShowAllPullAssignees(true)}>
                      Show all assignees
                    </button>
                  </div>
                )}
                <label>
                  Milestone
                  <select
                    key={`pull-milestone-${selectedPull.number}-${detail?.milestone?.number ?? "none"}`}
                    defaultValue={detail?.milestone?.number ?? ""}
                    disabled={Boolean(selectedMetadataDisabledReason) || milestonesLoading}
                    onChange={(event) =>
                      onMutate("editIssue", false, {
                        issueNumber: selectedPull.number,
                        milestone: event.currentTarget.value ? Number(event.currentTarget.value) : null
                      })
                    }
                  >
                    <option value="">No milestone</option>
                    {visibleMilestones.map((milestone) => (
                      <option key={milestone.id} value={milestone.number}>
                        {milestone.title}
                      </option>
                    ))}
                  </select>
                </label>
                {milestonesLoading && <small className="action-disabled-note">Loading milestones…</small>}
                {milestonesError && (
                  <small className="action-disabled-note">
                    Could not load milestones: {milestonesError.message}
                  </small>
                )}
                {!milestonesError && milestonesAvailabilityMessage && (
                  <small className="action-disabled-note">{milestonesAvailabilityMessage}</small>
                )}
                {!milestonesLoading && !milestonesError && hiddenPullMilestoneCount > 0 && (
                  <div className="table-action-row">
                    <button type="button" onClick={() => setShowAllPullMilestones(true)}>
                      Show all milestones
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (pullMetadataSubmitDisabledReason) {
                      return;
                    }
                    setSubmittedPullAction("editIssue");
                    onMutate("editIssue", false, {
                      issueNumber: selectedPull.number,
                      ...(parsedLabels.length > 0
                        ? {
                            labels: mergeUniqueStrings(
                              selectedLabels.map((label) => label.name),
                              parsedLabels
                            )
                          }
                        : {}),
                      ...(parsedAssignees.length > 0
                        ? {
                            assignees: mergeUniqueStrings(
                              selectedAssignees.map((assignee) => assignee.login),
                              parsedAssignees
                            )
                          }
                        : {})
                    });
                  }}
                >
                  <label>
                    Labels
                    <input
                      value={labelEntry}
                      onChange={(event) => setLabelEntry(event.target.value)}
                      placeholder="Add labels"
                      disabled={Boolean(selectedMetadataDisabledReason)}
                      title={selectedMetadataDisabledReason ?? undefined}
                    />
                  </label>
                  <label>
                    Assignees
                    <input
                      value={assigneeEntry}
                      onChange={(event) => setAssigneeEntry(event.target.value)}
                      placeholder="Add assignees"
                      disabled={Boolean(selectedMetadataDisabledReason)}
                      title={selectedMetadataDisabledReason ?? undefined}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={Boolean(pullMetadataSubmitDisabledReason)}
                    title={pullMetadataSubmitDisabledReason ?? undefined}
                  >
                    Update metadata
                  </button>
                </form>
                {pullMetadataSubmitDisabledReason && (
                  <small className="action-disabled-note">{pullMetadataSubmitDisabledReason}</small>
                )}
              </div>
              <div className="issue-metadata-controls">
                {(requestedReviewers.length > 0 || requestedTeams.length > 0) && (
                  <div className="metadata-picker-options" aria-label="Requested reviewers">
                    {requestedReviewers.map((reviewer) => (
                      <button
                        key={reviewer.id}
                        type="button"
                        aria-label={`Remove reviewer ${reviewer.login}`}
                        title={selectedReviewDisabledReason ?? `Remove reviewer ${reviewer.login}`}
                        disabled={Boolean(selectedReviewDisabledReason)}
                        onClick={() =>
                          onMutate("removeReviewers", false, {
                            pullNumber: selectedPull.number,
                            reviewers: [reviewer.login]
                          })
                        }
                      >
                        <X size={13} />
                        {reviewer.login}
                      </button>
                    ))}
                    {requestedTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        aria-label={`Remove team reviewer ${team.slug}`}
                        title={selectedReviewDisabledReason ?? `Remove team reviewer ${team.slug}`}
                        disabled={Boolean(selectedReviewDisabledReason)}
                        onClick={() =>
                          onMutate("removeReviewers", false, {
                            pullNumber: selectedPull.number,
                            teamReviewers: [team.slug]
                          })
                        }
                      >
                        <X size={13} />
                        {team.name}
                      </button>
                    ))}
                  </div>
                )}
                {assignableUsersLoading && (
                  <small className="action-disabled-note">Loading reviewer suggestions…</small>
                )}
                {assignableUsersError && (
                  <small className="action-disabled-note">
                    Reviewer suggestions unavailable: {assignableUsersError.message}
                  </small>
                )}
                {!assignableUsersError && assignableUsersAvailabilityMessage && (
                  <small className="action-disabled-note">{assignableUsersAvailabilityMessage}</small>
                )}
                {reviewerSuggestions.length > 0 && (
                  <div className="metadata-picker-options" aria-label="Reviewer suggestions">
                    {reviewerSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        disabled={Boolean(selectedReviewDisabledReason)}
                        title={selectedReviewDisabledReason ?? `Add reviewer ${user.login}`}
                        onClick={() => addReviewerSuggestion(user.login)}
                      >
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
                        {user.login}
                      </button>
                    ))}
                  </div>
                )}
                {!assignableUsersLoading && !assignableUsersError && hiddenPullReviewerCount > 0 && (
                  <div className="table-action-row">
                    <button type="button" onClick={() => setShowAllPullReviewers(true)}>
                      Show all reviewers
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (reviewerRequestSubmitDisabledReason) {
                      return;
                    }
                    setSubmittedPullAction("requestReviewers");
                    onMutate("requestReviewers", true, {
                      pullNumber: selectedPull.number,
                      reviewers: parsedReviewers,
                      teamReviewers: parsedTeamReviewers
                    });
                  }}
                >
                  <label>
                    Reviewers
                    <input
                      value={reviewerEntry}
                      onChange={(event) => setReviewerEntry(event.target.value)}
                      placeholder="GitHub usernames"
                      disabled={Boolean(selectedReviewDisabledReason)}
                      title={selectedReviewDisabledReason ?? undefined}
                    />
                  </label>
                  <label>
                    Teams
                    <input
                      value={teamReviewerEntry}
                      onChange={(event) => setTeamReviewerEntry(event.target.value)}
                      placeholder="team slugs"
                      disabled={Boolean(selectedReviewDisabledReason)}
                      title={selectedReviewDisabledReason ?? undefined}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={Boolean(reviewerRequestSubmitDisabledReason)}
                    title={reviewerRequestSubmitDisabledReason ?? undefined}
                  >
                    Request review
                  </button>
                </form>
                {reviewerRequestSubmitDisabledReason && (
                  <small className="action-disabled-note">
                    Reviewer requests unavailable: {reviewerRequestSubmitDisabledReason}
                  </small>
                )}
              </div>
              <form
                className="comment-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!commentBody.trim() || pullCommentDisabledReason) {
                    return;
                  }
                  setSubmittedPullAction("addComment");
                  onMutate("addComment", false, {
                    issueNumber: selectedPull.number,
                    body: commentBody.trim()
                  });
                }}
              >
                {pullCommentMutationActive && mutationPending && (
                  <div className="loading-state">
                    {githubActionLabel("addComment")} is running. The comment draft is locked until GitHub
                    responds.
                  </div>
                )}
                {pullCommentMutationActive && !mutationPending && mutationSucceeded && (
                  <div className="success-state">
                    {githubActionLabel("addComment")} completed. Pull request comments are refreshing.
                  </div>
                )}
                {pullCommentMutationActive && !mutationPending && mutationError && (
                  <div className="error-state">
                    {githubActionLabel("addComment")} failed: {mutationError.message}
                  </div>
                )}
                <textarea
                  value={commentBody}
                  disabled={Boolean(pullCommentDisabledReason)}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Leave a comment"
                />
                <button
                  className="dark-action"
                  type="submit"
                  disabled={!commentBody.trim() || Boolean(pullCommentDisabledReason)}
                  title={
                    pullCommentDisabledReason ??
                    (!commentBody.trim() ? "Comment body is required." : undefined)
                  }
                >
                  Comment
                </button>
                {pullCommentDisabledReason && (
                  <small className="action-disabled-note">
                    Comment unavailable: {pullCommentDisabledReason}
                  </small>
                )}
              </form>
              <div className="comment-composer">
                {pullReviewMutationActive && mutationPending && (
                  <div className="loading-state">
                    {githubActionLabel(submittedPullAction!)} is running. The review note is locked until
                    GitHub responds.
                  </div>
                )}
                {pullReviewMutationActive && !mutationPending && mutationSucceeded && (
                  <div className="success-state">
                    {githubActionLabel(submittedPullAction!)} completed. Pull request reviews are refreshing.
                  </div>
                )}
                {pullReviewMutationActive && !mutationPending && mutationError && (
                  <div className="error-state">
                    {githubActionLabel(submittedPullAction!)} failed: {mutationError.message}
                  </div>
                )}
                <textarea
                  value={reviewBody}
                  disabled={Boolean(selectedReviewDisabledReason)}
                  title={selectedReviewDisabledReason ?? undefined}
                  onChange={(event) => setReviewBody(event.target.value)}
                  placeholder="Review note"
                />
                <div>
                  <button
                    type="button"
                    disabled={Boolean(selectedReviewDisabledReason)}
                    title={selectedReviewDisabledReason ?? undefined}
                    onClick={() => submitPullRequestReview("approvePullRequest", false)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(reviewCommentDisabledReason)}
                    title={reviewCommentDisabledReason ?? undefined}
                    onClick={() => submitPullRequestReview("commentPullRequestReview", false)}
                  >
                    Comment review
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(selectedReviewDisabledReason)}
                    title={selectedReviewDisabledReason ?? undefined}
                    onClick={() => submitPullRequestReview("requestChanges", true)}
                  >
                    Request changes
                  </button>
                </div>
                {(selectedReviewDisabledReason || reviewCommentDisabledReason) && (
                  <small className="action-disabled-note">
                    Review unavailable: {selectedReviewDisabledReason ?? reviewCommentDisabledReason}
                  </small>
                )}
              </div>
              <div className="thread-actions">
                <button type="button" onClick={() => onOpenExternal(selectedPull.htmlUrl)}>
                  <ExternalLink size={16} /> GitHub fallback
                </button>
                <button
                  type="button"
                  disabled={Boolean(pullActionDisabledReason)}
                  title={pullActionDisabledReason ?? undefined}
                  onClick={() =>
                    onMutate(pullAction, pullAction === "closePullRequest", {
                      pullNumber: selectedPull.number
                    })
                  }
                >
                  {pullActionLabel}
                </button>
                <button
                  className="dark-action"
                  type="button"
                  disabled={Boolean(selectedMergeDisabledReason)}
                  title={selectedMergeDisabledReason ?? undefined}
                  onClick={() => onMutate("mergePullRequest", true, { pullNumber: selectedPull.number })}
                >
                  Merge pull request
                </button>
                {selectedMergeDisabledReason && (
                  <small className="action-disabled-note">
                    Merge unavailable: {selectedMergeDisabledReason}
                  </small>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">No pull requests found.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function PullRequestInspection({
  repository,
  detail,
  loading,
  markdownUrlContext,
  onOpenExternal,
  onOpenIssueReference,
  onOpenPullRequestCommit,
  onOpenPullRequestReviewCommit,
  onOpenPullRequestTimelineEventCommit,
  onOpenWorkflowRun,
  onOpenCodePath,
  reviewCommentActions
}: {
  repository: RepositoryDetail;
  detail: PullRequestDetail | null;
  loading: boolean;
  markdownUrlContext?: MarkdownUrlContext;
  onOpenExternal(url: string): void;
  onOpenIssueReference(issue: PullRequestLinkedIssue): void;
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
  onOpenWorkflowRun(runId: number, url?: string | null): void;
  onOpenCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  reviewCommentActions?: {
    getDisabledReason(comment: PullRequestReviewThreadCommentSummary): string | null;
    onEdit(comment: PullRequestReviewThreadCommentSummary, body: string): void;
    onDelete(comment: PullRequestReviewThreadCommentSummary): void;
  };
}): JSX.Element {
  const reviewLimit = 6;
  const timelineEventLimit = 8;
  const reviewThreadLimit = 6;
  const checkLimit = 6;
  const commitLimit = 6;
  const fileLimit = 8;
  const commits = detail?.commitsList ?? [];
  const files = detail?.files ?? [];
  const reviews = detail?.reviews ?? [];
  const checks = detail?.checks ?? [];
  const reviewThreads = detail?.reviewThreads ?? [];
  const timelineEvents = detail?.timelineEvents ?? [];
  const linkedIssues = detail?.linkedIssues ?? [];
  const detailKey = detail
    ? `${detail.repositoryNameWithOwner ?? repository.nameWithOwner}#${detail.number}`
    : null;
  const initialExpandedSections = {
    reviews: false,
    timelineEvents: false,
    reviewThreads: false,
    checks: false,
    commits: false,
    files: false
  };
  const [expandedSectionState, setExpandedSectionState] = useState({
    detailKey,
    sections: initialExpandedSections
  });
  const expandedSections =
    expandedSectionState.detailKey === detailKey ? expandedSectionState.sections : initialExpandedSections;
  const visibleReviews = expandedSections.reviews ? reviews : reviews.slice(0, reviewLimit);
  const visibleTimelineEvents = expandedSections.timelineEvents
    ? timelineEvents
    : timelineEvents.slice(0, timelineEventLimit);
  const visibleReviewThreads = expandedSections.reviewThreads
    ? reviewThreads
    : reviewThreads.slice(0, reviewThreadLimit);
  const visibleChecks = expandedSections.checks ? checks : checks.slice(0, checkLimit);
  const visibleCommits = expandedSections.commits ? commits : commits.slice(0, commitLimit);
  const visibleFiles = expandedSections.files ? files : files.slice(0, fileLimit);
  const renderExpansionToggle = (
    section: keyof typeof expandedSections,
    label: string,
    total: number,
    limit: number
  ) =>
    total > limit ? (
      <button
        type="button"
        onClick={() =>
          setExpandedSectionState((current) => ({
            detailKey,
            sections: {
              ...(current.detailKey === detailKey ? current.sections : initialExpandedSections),
              [section]: !(current.detailKey === detailKey ? current.sections : initialExpandedSections)[
                section
              ]
            }
          }))
        }
      >
        <small>{expandedSections[section] ? "Show fewer" : `Show all ${total} ${label}`}</small>
      </button>
    ) : null;
  const checksAvailabilityMessage = readAvailabilityMessage(
    "Pull request checks",
    detail?.checksAvailability ?? null
  );
  const timelineAvailabilityMessage = readAvailabilityMessage(
    "Pull request timeline",
    detail?.timelineAvailability ?? null
  );
  const linkedIssuesAvailabilityMessage = readAvailabilityMessage(
    "Linked issues",
    detail?.linkedIssuesAvailability ?? null
  );
  const reviewThreadsAvailabilityMessage = readAvailabilityMessage(
    "Pull request review threads",
    detail?.reviewThreadsAvailability ?? null
  );
  const reviewThreadStatesAvailabilityMessage = readAvailabilityMessage(
    "Review thread state",
    detail?.reviewThreadStatesAvailability ?? null
  );
  const reviewsAvailabilityMessage = readAvailabilityMessage(
    "Pull request reviews",
    detail?.reviewsAvailability ?? null
  );
  const commitsAvailabilityMessage = readAvailabilityMessage(
    "Pull request commits",
    detail?.commitsAvailability ?? null
  );
  const filesAvailabilityMessage = readAvailabilityMessage(
    "Pull request changed files",
    detail?.filesAvailability ?? null
  );
  const changedFilesRef = detail?.headRefName || detail?.baseRefName || null;
  const changedFilesRepositoryNameWithOwner =
    detail?.headRepositoryNameWithOwner ?? detail?.repositoryNameWithOwner ?? repository.nameWithOwner;

  return (
    <section className="pr-inspection" aria-label="Pull request inspection">
      <article>
        <header>
          <h3>Reviews</h3>
          <span>{detail?.latestReviewState ?? reviews.length}</span>
        </header>
        <div className="pr-inspection-list">
          {visibleReviews.map((review) => (
            <div className="pr-file-row" key={review.id}>
              <div>
                <strong>
                  {review.state} by {review.authorLogin ?? "unknown"}
                </strong>
                <small>
                  {review.submittedAt ? formatRelativeDate(review.submittedAt) : "not submitted"}
                  {review.commitSha ? ` · ${review.commitSha.slice(0, 7)}` : ""}
                  {review.body ? ` · ${review.body}` : ""}
                </small>
              </div>
              <button
                type="button"
                disabled={!review.commitSha}
                title={review.commitSha ? undefined : "Review commit SHA unavailable."}
                onClick={() => {
                  if (review.commitSha) {
                    onOpenPullRequestReviewCommit(review, changedFilesRepositoryNameWithOwner);
                  }
                }}
              >
                Open commit tree
              </button>
              <button
                type="button"
                disabled={!review.htmlUrl}
                title={review.htmlUrl ? undefined : "Review URL unavailable."}
                onClick={() => {
                  if (review.htmlUrl) {
                    onOpenExternal(review.htmlUrl);
                  }
                }}
              >
                GitHub fallback
              </button>
            </div>
          ))}
          {renderExpansionToggle("reviews", "reviews", reviews.length, reviewLimit)}
          {!loading && reviewsAvailabilityMessage && (
            <div className="error-state">{reviewsAvailabilityMessage}</div>
          )}
          {!loading && !reviewsAvailabilityMessage && reviews.length === 0 && (
            <div className="empty-state">No reviews returned.</div>
          )}
        </div>
      </article>
      <article>
        <header>
          <h3>Linked issues</h3>
          <span>{linkedIssues.length}</span>
        </header>
        <div className="pr-inspection-list">
          {loading && !detail && <div className="loading-state">Loading linked issues…</div>}
          {linkedIssues.map((issue) => {
            const repositoryNameWithOwner =
              issue.repositoryNameWithOwner ?? detail?.repositoryNameWithOwner ?? null;

            return (
              <div className="pr-file-row" key={`${repositoryNameWithOwner ?? "unknown"}#${issue.number}`}>
                <div>
                  <strong>
                    {repositoryNameWithOwner
                      ? `${repositoryNameWithOwner}#${issue.number}`
                      : `#${issue.number}`}{" "}
                    {issue.title ?? "Untitled issue"}
                  </strong>
                  <small>
                    {issue.state.toLowerCase()}
                    {issue.stateReason ? ` · ${issue.stateReason.toLowerCase()}` : ""}
                  </small>
                </div>
                <button type="button" onClick={() => onOpenIssueReference(issue)}>
                  Open issue in Control
                </button>
                <button
                  type="button"
                  disabled={!issue.htmlUrl}
                  title={issue.htmlUrl ? undefined : "Issue URL unavailable."}
                  onClick={() => {
                    if (issue.htmlUrl) {
                      onOpenExternal(issue.htmlUrl);
                    }
                  }}
                >
                  GitHub fallback
                </button>
              </div>
            );
          })}
          {!loading && linkedIssuesAvailabilityMessage && (
            <div className="error-state">{linkedIssuesAvailabilityMessage}</div>
          )}
          {!loading && !linkedIssuesAvailabilityMessage && linkedIssues.length === 0 && (
            <div className="empty-state">No closing issue references returned.</div>
          )}
        </div>
      </article>
      <article>
        <header>
          <h3>Timeline events</h3>
          <span>{timelineEvents.length}</span>
        </header>
        <div className="pr-inspection-list">
          {visibleTimelineEvents.map((event) => {
            const linkedIssue = event.sourceIssue;
            const canOpenInControl = Boolean(linkedIssue || event.commitSha);

            return (
              <button
                key={event.id}
                type="button"
                disabled={!canOpenInControl}
                title={canOpenInControl ? undefined : "This timeline event has no in-app target."}
                onClick={() => {
                  if (linkedIssue) {
                    onOpenIssueReference(linkedIssue);
                    return;
                  }
                  if (event.commitSha) {
                    onOpenPullRequestTimelineEventCommit(event, changedFilesRepositoryNameWithOwner);
                  }
                }}
              >
                <strong>{pullRequestTimelineEventLabel(event)}</strong>
                <small>
                  {event.actorLogin ?? "GitHub"} ·{" "}
                  {event.createdAt ? formatRelativeDate(event.createdAt) : "unknown time"}
                  {linkedIssue
                    ? " · open linked issue in Control"
                    : event.commitSha
                      ? " · open commit tree in Control"
                      : ""}
                </small>
              </button>
            );
          })}
          {renderExpansionToggle(
            "timelineEvents",
            "timeline events",
            timelineEvents.length,
            timelineEventLimit
          )}
          {!loading && timelineAvailabilityMessage && (
            <div className="error-state">{timelineAvailabilityMessage}</div>
          )}
          {!loading && !timelineAvailabilityMessage && timelineEvents.length === 0 && (
            <div className="empty-state">No timeline events returned.</div>
          )}
        </div>
      </article>
      <article>
        <header>
          <h3>Review threads</h3>
          <span>{reviewThreads.length}</span>
        </header>
        <div className="pr-inspection-list">
          {visibleReviewThreads.map((thread) => {
            const richThread = thread as RichPullRequestReviewThreadSummary;
            const firstComment = thread.comments[0];
            const lastComment = thread.comments[thread.comments.length - 1];
            const location = pullRequestReviewThreadLocationParts(richThread);
            const diffHunk = pullRequestReviewThreadDiffHunk(richThread);
            const diffPreview = pullRequestReviewThreadDiffPreview(diffHunk);
            const openLine =
              richThread.line ??
              firstComment?.line ??
              richThread.startLine ??
              firstComment?.startLine ??
              null;

            return (
              <div className="timeline-thread" key={thread.id}>
                <div className="pr-file-row">
                  <div>
                    <strong>{location.path}</strong>
                    <small>
                      {thread.isResolved !== null && (
                        <>
                          <span className={`state-chip ${thread.isResolved ? "success" : "attention"}`}>
                            {thread.isResolved ? "resolved" : "unresolved"}
                          </span>{" "}
                        </>
                      )}
                      {thread.isOutdated !== null && (
                        <>
                          <span className={`state-chip ${thread.isOutdated ? "attention" : "success"}`}>
                            {thread.isOutdated ? "outdated" : "current"}
                          </span>{" "}
                        </>
                      )}
                      {location.lineSummary ? `line ${location.lineSummary}` : "line unknown"}
                      {location.side ? ` · ${location.side.toLowerCase()} side` : ""}
                      {location.startSide && location.startSide !== location.side
                        ? ` · starts on ${location.startSide.toLowerCase()} side`
                        : ""}{" "}
                      · {thread.comments.length} comments
                    </small>
                  </div>
                  <button
                    type="button"
                    disabled={!changedFilesRef}
                    title={changedFilesRef ? undefined : "File reference unavailable."}
                    onClick={() =>
                      onOpenCodePath(
                        thread.path,
                        changedFilesRef,
                        null,
                        openLine,
                        changedFilesRepositoryNameWithOwner
                      )
                    }
                  >
                    Open file in Control
                  </button>
                  <button
                    type="button"
                    disabled={!lastComment?.htmlUrl}
                    title={lastComment?.htmlUrl ? undefined : "Review thread URL unavailable."}
                    onClick={() => {
                      if (lastComment?.htmlUrl) {
                        onOpenExternal(lastComment.htmlUrl);
                      }
                    }}
                  >
                    GitHub fallback
                  </button>
                </div>
                {diffPreview && (
                  <pre className="markdown-code-block">
                    <code>{diffPreview}</code>
                  </pre>
                )}
                {thread.comments.map((comment) => (
                  <TimelineComment
                    key={comment.id}
                    authorLogin={comment.authorLogin}
                    authorAvatarUrl={comment.authorAvatarUrl}
                    createdAt={comment.createdAt}
                    body={comment.body?.trim() || "No comment body."}
                    disabledReason={reviewCommentActions?.getDisabledReason(comment) ?? null}
                    markdownUrlContext={markdownUrlContext}
                    onOpenExternal={onOpenExternal}
                    onEdit={
                      reviewCommentActions ? (body) => reviewCommentActions.onEdit(comment, body) : undefined
                    }
                    onDelete={reviewCommentActions ? () => reviewCommentActions.onDelete(comment) : undefined}
                  />
                ))}
              </div>
            );
          })}
          {renderExpansionToggle("reviewThreads", "review threads", reviewThreads.length, reviewThreadLimit)}
          {!loading && reviewThreadsAvailabilityMessage && (
            <div className="error-state">{reviewThreadsAvailabilityMessage}</div>
          )}
          {!loading && reviewThreadStatesAvailabilityMessage && (
            <div className="error-state">{reviewThreadStatesAvailabilityMessage}</div>
          )}
          {!loading && !reviewThreadsAvailabilityMessage && reviewThreads.length === 0 && (
            <div className="empty-state">No review threads returned.</div>
          )}
        </div>
      </article>
      <article>
        <header>
          <h3>Checks</h3>
          <span>{checks.length}</span>
        </header>
        <div className="pr-inspection-list">
          {visibleChecks.map((check) => {
            const checkUrl = check.detailsUrl ?? check.htmlUrl;
            const workflowRunId =
              parseWorkflowRunIdFromUrl(check.detailsUrl) ?? parseWorkflowRunIdFromUrl(check.htmlUrl);

            return (
              <div className="pr-file-row" key={check.id}>
                <div>
                  <strong>{check.name}</strong>
                  <small>
                    {check.conclusion ?? check.status ?? "queued"} · {check.appName ?? "GitHub Checks"}
                    {check.outputSummary ? ` · ${check.outputSummary}` : ""}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={workflowRunId === null}
                  title={
                    workflowRunId === null
                      ? "This check does not expose a GitHub Actions run URL."
                      : undefined
                  }
                  onClick={() => {
                    if (workflowRunId !== null) {
                      onOpenWorkflowRun(workflowRunId, checkUrl);
                    }
                  }}
                >
                  Open run in Control
                </button>
                <button
                  type="button"
                  disabled={!checkUrl}
                  title={checkUrl ? undefined : "Check URL unavailable."}
                  onClick={() => {
                    if (checkUrl) {
                      onOpenExternal(checkUrl);
                    }
                  }}
                >
                  GitHub fallback
                </button>
              </div>
            );
          })}
          {renderExpansionToggle("checks", "checks", checks.length, checkLimit)}
          {!loading && checksAvailabilityMessage && (
            <div className="error-state">{checksAvailabilityMessage}</div>
          )}
          {!loading && !checksAvailabilityMessage && checks.length === 0 && (
            <div className="empty-state">No check runs returned for this pull request.</div>
          )}
        </div>
      </article>
      <article>
        <header>
          <h3>Commits</h3>
          <span>{commits.length}</span>
        </header>
        <div className="pr-inspection-list">
          {visibleCommits.map((commit) => (
            <div className="pr-file-row" key={commit.sha}>
              <div>
                <strong>{commit.message}</strong>
                <small>
                  {commit.sha.slice(0, 7)} · {commit.authorLogin ?? "unknown"} ·{" "}
                  {commit.committedAt ? formatRelativeDate(commit.committedAt) : "unknown date"}
                </small>
              </div>
              <button
                type="button"
                onClick={() => onOpenPullRequestCommit(commit, changedFilesRepositoryNameWithOwner)}
              >
                Open tree in Control
              </button>
              <button
                type="button"
                disabled={!commit.htmlUrl}
                title={commit.htmlUrl ? undefined : "Commit URL unavailable."}
                onClick={() => {
                  if (commit.htmlUrl) {
                    onOpenExternal(commit.htmlUrl);
                  }
                }}
              >
                GitHub fallback
              </button>
            </div>
          ))}
          {renderExpansionToggle("commits", "commits", commits.length, commitLimit)}
          {!loading && commitsAvailabilityMessage && (
            <div className="error-state">{commitsAvailabilityMessage}</div>
          )}
          {!loading && !commitsAvailabilityMessage && commits.length === 0 && (
            <div className="empty-state">No commits returned.</div>
          )}
        </div>
      </article>
      <article>
        <header>
          <h3>Changed files</h3>
          <span>{files.length}</span>
        </header>
        <div className="pr-inspection-list">
          {visibleFiles.map((file) => (
            <div className="pr-file-row" key={file.filename}>
              <div>
                <strong>{file.filename}</strong>
                <small>
                  {file.status} · +{formatCompactNumber(file.additions)} -
                  {formatCompactNumber(file.deletions)} · {formatCompactNumber(file.changes)} changes
                </small>
              </div>
              <button
                type="button"
                disabled={!changedFilesRef}
                title={changedFilesRef ? undefined : "File reference unavailable."}
                onClick={() =>
                  onOpenCodePath(
                    file.filename,
                    changedFilesRef,
                    file.blobUrl,
                    null,
                    changedFilesRepositoryNameWithOwner
                  )
                }
              >
                Open in Control
              </button>
              <button
                type="button"
                disabled={!file.blobUrl}
                title={file.blobUrl ? undefined : "GitHub file URL unavailable."}
                onClick={() => {
                  if (file.blobUrl) {
                    onOpenExternal(file.blobUrl);
                  }
                }}
              >
                GitHub fallback
              </button>
              <button
                type="button"
                disabled={!file.rawUrl}
                title={file.rawUrl ? undefined : "Raw file URL unavailable."}
                onClick={() => {
                  if (file.rawUrl) {
                    onOpenExternal(file.rawUrl);
                  }
                }}
              >
                Open raw
              </button>
            </div>
          ))}
          {renderExpansionToggle("files", "changed files", files.length, fileLimit)}
          {!loading && filesAvailabilityMessage && (
            <div className="error-state">{filesAvailabilityMessage}</div>
          )}
          {!loading && !filesAvailabilityMessage && files.length === 0 && (
            <div className="empty-state">No changed files returned.</div>
          )}
        </div>
      </article>
    </section>
  );
}

type RichPullRequestReviewThreadSummary = PullRequestReviewThreadSummary & {
  diffHunk?: string | null;
  line?: number | null;
  startLine?: number | null;
  side?: string | null;
  startSide?: string | null;
};

function pullRequestReviewThreadDiffHunk(thread: RichPullRequestReviewThreadSummary): string | null {
  return thread.diffHunk ?? thread.comments.find((comment) => comment.diffHunk)?.diffHunk ?? null;
}

function pullRequestReviewThreadDiffPreview(diffHunk: string | null): string | null {
  if (!diffHunk) {
    return null;
  }

  const maxDiffHunkPreviewLines = 12;
  const lines = diffHunk.split(/\r?\n/);
  const previewLines = lines.slice(0, maxDiffHunkPreviewLines);

  if (lines.length > maxDiffHunkPreviewLines) {
    previewLines.push(`... ${lines.length - maxDiffHunkPreviewLines} more lines`);
  }

  return previewLines.join("\n");
}

function pullRequestReviewThreadLocationParts(thread: RichPullRequestReviewThreadSummary): {
  path: string;
  lineSummary: string | null;
  side: string | null;
  startSide: string | null;
} {
  const firstComment = thread.comments[0];
  const startLine = thread.startLine ?? firstComment?.startLine ?? null;
  const line = thread.line ?? firstComment?.line ?? null;
  const side = thread.side ?? firstComment?.side ?? null;
  const startSide = thread.startSide ?? null;
  const lineSummary =
    startLine && line && startLine !== line
      ? `${startLine}-${line}`
      : line
        ? `${line}`
        : startLine
          ? `${startLine}`
          : null;

  return { path: thread.path, lineSummary, side, startSide };
}
