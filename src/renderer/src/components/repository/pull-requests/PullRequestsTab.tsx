import { useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  BranchProtectionResult,
  GitHubAction,
  GitHubMutationFields,
  PullRequestCommitSummary,
  PullRequestReviewSummary,
  PullRequestStateFilter,
  PullRequestSummary,
  PullRequestTimelineEventSummary,
  RepositoryDetail
} from "@shared/github";

import { markdownRepositoryUrlContext } from "@renderer/components/MarkdownBody";

import {
  fieldsMatchSearchParts,
  githubActionLabel,
  normalizedSearchParts,
  readAvailabilityMessage,
  readAvailabilityStatusLabel,
  repositoryMutationDisabledReason
} from "@renderer/components/repository/repositoryUi";

import { useControlApi } from "@renderer/hooks/useControlApi";
import { useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

import {
  useComposedPullRequestDetail,
  usePullRequestsTabQueries,
  type RequestedPullRequestDetailSections
} from "./PullRequestsTab.queries";
import type { PullRequestCreateDraft } from "./PullRequestCreateForm";
import { PullRequestsTabContent, type PullRequestsTabContentProps } from "./PullRequestsTabContent";
import {
  commaSeparatedValues,
  conversationCommentDisabledReason,
  mergeDisabledReason,
  pullStateMutationDisabledReason,
  reviewDisabledReason
} from "./PullRequestsTab.utils";
import type { PullRequestLinkedIssue } from "./PullRequestsTab.types";
import { usePullRequestsTabActions } from "./usePullRequestsTabActions";

type PullRequestsTabModel = PullRequestsTabContentProps;

export interface PullRequestsTabProps {
  repository: RepositoryDetail;
  githubReady: boolean;
  selectedRef: string | null;
  refListLimit: number;
  pullRequestListLimit: number;
  pullState: PullRequestStateFilter;
  focusedPullNumber: number | null;
  initialFilter: string;
  initialCreating: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onOpenExternal(url: string): void;
  onOpenPullRequestDetail(
    pullRequest: PullRequestSummary,
    pullState: PullRequestStateFilter,
    filter: string
  ): void;
  onOpenPullRequestList(): void;
  onPullStateChange(pullState: PullRequestStateFilter, filter: string): void;
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
}

function usePullRequestsTabModel({
  repository,
  githubReady,
  selectedRef,
  refListLimit,
  pullRequestListLimit,
  pullState,
  focusedPullNumber,
  initialFilter,
  initialCreating,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onOpenExternal,
  onOpenPullRequestDetail,
  onOpenPullRequestList,
  onPullStateChange,
  onOpenIssueReference,
  onOpenPullRequestCommit,
  onOpenPullRequestReviewCommit,
  onOpenPullRequestTimelineEventCommit,
  onOpenWorkflowRun,
  onOpenCodePath,
  onExpandPullRequests,
  onMutate
}: PullRequestsTabProps): PullRequestsTabModel {
  const [selectedPullNumber, setSelectedPullNumber] = useState<number | null>(null);
  const [requestedPullDetailSectionState, setRequestedPullDetailSectionState] = useState<{
    detailKey: string | null;
    sections: RequestedPullRequestDetailSections;
  }>({ detailKey: null, sections: {} });
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
    pullState,
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
  const selectedPullDetailKey =
    selectedPullNumberForDetail !== null
      ? `${repository.nameWithOwner}#${selectedPullNumberForDetail}`
      : null;
  const requestedPullDetailSections =
    requestedPullDetailSectionState.detailKey === selectedPullDetailKey
      ? requestedPullDetailSectionState.sections
      : {};
  const api = useControlApi();
  const pullDetail = useComposedPullRequestDetail({
    repository,
    pullNumber: selectedPullNumberForDetail,
    githubReady,
    enabled: !creating,
    requestedSections: requestedPullDetailSections
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
  const allReviewerSuggestions: typeof assignableUsers = [];
  for (const user of assignableUsers) {
    const normalizedLogin = user.login.toLowerCase();
    if (!requestedReviewerLogins.has(normalizedLogin) && !typedReviewerLogins.has(normalizedLogin)) {
      allReviewerSuggestions.push(user);
    }
  }
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
  const selectedBranchSignals: string[] = [];
  if (selectedBaseBranch) {
    selectedBranchSignals.push(
      `${selectedPull?.baseRefName ?? "Base"} ${selectedBaseBranch.protected ? "protected" : "unprotected"}`
    );
  } else if (selectedPull) {
    selectedBranchSignals.push(`${selectedPull.baseRefName} protection unknown`);
  }
  if (selectedHeadBranch) {
    selectedBranchSignals.push(
      `${selectedPull?.headRefName ?? "Head"} ${selectedHeadBranch.protected ? "protected" : "unprotected"}`
    );
  }
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

  const createPullDraft: PullRequestCreateDraft = {
    title,
    head,
    base,
    body,
    createDraft,
    maintainerCanModify
  };

  function handleOpenPullRequestDetail(pull: PullRequestSummary): void {
    onOpenPullRequestDetail(pull, pullState, filter);
  }

  function changePullState(nextPullState: PullRequestStateFilter): void {
    onPullStateChange(nextPullState, filter);
  }

  const pullActions = usePullRequestsTabActions({
    repository,
    selectedPull,
    selectedPullDetailKey,
    defaultBaseBranch,
    selectedReviewDisabledReason,
    reviewCommentDisabledReason,
    pullCommentDisabledReason,
    createPullSubmitDisabledReason,
    pullMetadataSubmitDisabledReason,
    reviewerRequestSubmitDisabledReason,
    pullActionPendingReason,
    livePullDisabledReason,
    pullAction,
    reviewBody,
    commentBody,
    title,
    head,
    baseBody: body,
    createDraft,
    maintainerCanModify,
    effectiveBaseBranch,
    parsedLabels,
    parsedAssignees,
    parsedReviewers,
    parsedTeamReviewers,
    selectedLabels,
    selectedAssignees,
    onSelectPullRequest: handleOpenPullRequestDetail,
    onMutate,
    setRequestedPullDetailSectionState,
    setSelectedPullNumber,
    setCreating,
    setTitle,
    setHead,
    setBase,
    setBody,
    setCreateDraft,
    setMaintainerCanModify,
    setCommentBody,
    setReviewBody,
    setLabelEntry,
    setAssigneeEntry,
    setReviewerEntry,
    setTeamReviewerEntry,
    setSubmittedPullAction,
    setShowAllPullLabels,
    setShowAllPullAssignees,
    setShowAllPullReviewers,
    setShowAllPullMilestones
  });

  return {
    repository,
    pullState,
    filter,
    creating,
    createPullDisabledReason,
    filteredPulls,
    selectedPull,
    loading,
    pullsAvailabilityMessage,
    pullRequestListLimit,
    branchOptions,
    branchesError: branchesError instanceof Error ? branchesError : null,
    effectiveBaseBranch,
    createPullSubmitDisabledReason,
    createPullDraft,
    createPullMutationActive,
    mutationPending,
    mutationSucceeded,
    mutationError,
    detail,
    pullDetailLoading: pullDetail.isLoading || pullDetail.isFetching,
    pullDetailError: pullDetail.error,
    pullDetailAvailabilityMessage,
    requestedPullDetailSections,
    pullMarkdownUrlContext,
    selectedMerged,
    selectedReviewDecision,
    reviewDecisionAvailabilityMessage,
    selectedIsCrossRepository,
    selectedHeadRepository,
    selectedBaseRepository,
    selectedMaintainerCanModify,
    selectedMergeCommitSha,
    selectedMergedAt,
    selectedBranchSignals,
    selectedBaseProtection,
    selectedBaseProtectionBranchLabel,
    selectedBaseProtectionStatusLabel,
    selectedBaseProtectionStatusUnavailable,
    selectedBaseProtectionLoading:
      selectedBaseBranchProtection.isLoading && !selectedBaseBranchProtection.data,
    selectedBaseProtectionError:
      selectedBaseBranchProtection.error instanceof Error ? selectedBaseBranchProtection.error : null,
    selectedBaseProtectionAvailabilityMessage,
    selectedBaseProtectionLoaded: Boolean(selectedBaseBranchProtection.data),
    selectedLabels,
    selectedAssignees,
    visibleLabels,
    visibleMilestones,
    assigneeSuggestions,
    labelEntry,
    assigneeEntry,
    selectedMetadataDisabledReason,
    pullMetadataSubmitDisabledReason,
    labelsLoading,
    labelsError: labelsError instanceof Error ? labelsError : null,
    labelsAvailabilityMessage,
    assignableUsersLoading,
    assignableUsersError: assignableUsersError instanceof Error ? assignableUsersError : null,
    assignableUsersAvailabilityMessage,
    milestonesLoading,
    milestonesError: milestonesError instanceof Error ? milestonesError : null,
    milestonesAvailabilityMessage,
    hiddenPullLabelCount,
    hiddenPullAssigneeCount,
    hiddenPullMilestoneCount,
    requestedReviewers,
    requestedTeams,
    reviewerSuggestions,
    reviewerEntry,
    teamReviewerEntry,
    selectedReviewDisabledReason,
    reviewerRequestSubmitDisabledReason,
    hiddenPullReviewerCount,
    commentBody,
    reviewBody,
    pullActionLabel,
    pullCommentMutationActive,
    pullReviewMutationActive,
    submittedPullAction,
    pullCommentDisabledReason,
    reviewCommentDisabledReason,
    pullActionDisabledReason,
    selectedMergeDisabledReason,
    reviewCommentActions: pullActions.reviewCommentActions,
    commentActions: pullActions.commentActions,
    onFilterChange: setFilter,
    onPullStateChange: changePullState,
    onStartCreating: pullActions.handleStartCreating,
    onSelectPull: pullActions.handleSelectPull,
    onOpenPullRequestList,
    onOpenExternal,
    onExpandPullRequests,
    onDraftChange: pullActions.updateCreatePullDraft,
    onSubmitCreatePullRequest: pullActions.submitCreatePullRequest,
    onCancelCreatePullRequest: pullActions.cancelCreatePullRequest,
    onOpenIssueReference,
    onOpenPullRequestCommit,
    onOpenPullRequestReviewCommit,
    onOpenPullRequestTimelineEventCommit,
    onOpenWorkflowRun,
    onRequestPullDetailSection: pullActions.requestPullDetailSection,
    onOpenCodePath,
    onRemoveLabel: pullActions.removePullLabel,
    onRemoveAssignee: pullActions.removePullAssignee,
    onAddLabelSuggestion: pullActions.addLabelSuggestion,
    onAddAssigneeSuggestion: pullActions.addAssigneeSuggestion,
    onShowAllLabels: pullActions.showAllPullLabels,
    onShowAllAssignees: pullActions.showAllPullAssignees,
    onShowAllMilestones: pullActions.showAllPullMilestones,
    onMilestoneChange: pullActions.changePullMilestone,
    onLabelEntryChange: pullActions.setLabelEntry,
    onAssigneeEntryChange: pullActions.setAssigneeEntry,
    onRemoveReviewer: pullActions.removeRequestedReviewer,
    onRemoveTeamReviewer: pullActions.removeRequestedTeamReviewer,
    onAddReviewerSuggestion: pullActions.addReviewerSuggestion,
    onShowAllReviewers: pullActions.showAllPullReviewers,
    onReviewerEntryChange: pullActions.setReviewerEntry,
    onTeamReviewerEntryChange: pullActions.setTeamReviewerEntry,
    onSubmitMetadata: pullActions.submitPullMetadata,
    onSubmitReviewerRequest: pullActions.submitReviewerRequest,
    onCommentBodyChange: pullActions.setCommentBody,
    onReviewBodyChange: pullActions.setReviewBody,
    onSubmitComment: pullActions.submitPullComment,
    onSubmitReview: pullActions.submitPullRequestReview,
    onRunPullAction: pullActions.runPullAction,
    onMerge: pullActions.mergeSelectedPull,
    focusedPullNumber
  };
}

export function PullRequestsTab(props: PullRequestsTabProps): JSX.Element {
  const model = usePullRequestsTabModel(props);
  return <PullRequestsTabContent {...model} />;
}
