import type { Dispatch, SetStateAction } from "react";

import type {
  AssignableUserSummary,
  GitHubAction,
  GitHubMutationFields,
  LabelSummary,
  PullRequestReviewThreadCommentSummary,
  PullRequestSummary,
  RepositoryDetail,
  TimelineCommentSummary
} from "@shared/github";

import type { PullRequestCreateDraft } from "./PullRequestCreateForm";
import type { PullRequestDetailSection, RequestedPullRequestDetailSections } from "./PullRequestsTab.queries";
import type { PullRequestMergeMethod } from "./PullRequestsTab.types";
import {
  appendCommaSeparatedValue,
  commaSeparatedValues,
  commentMutationDisabledReason,
  githubNumericId,
  mergeUniqueStrings,
  reviewCommentMutationDisabledReason
} from "./PullRequestsTab.utils";

type PullDetailSectionState = {
  detailKey: string | null;
  sections: RequestedPullRequestDetailSections;
};

export function usePullRequestsTabActions({
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
  selectedMergeMethod,
  reviewBody,
  commentBody,
  title,
  head,
  baseBody,
  createDraft,
  maintainerCanModify,
  effectiveBaseBranch,
  parsedLabels,
  parsedAssignees,
  parsedReviewers,
  parsedTeamReviewers,
  selectedLabels,
  selectedAssignees,
  onSelectPullRequest,
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
}: {
  repository: RepositoryDetail;
  selectedPull: PullRequestSummary | null;
  selectedPullDetailKey: string | null;
  defaultBaseBranch: string;
  selectedReviewDisabledReason: string | null;
  reviewCommentDisabledReason: string | null;
  pullCommentDisabledReason: string | null;
  createPullSubmitDisabledReason: string | null;
  pullMetadataSubmitDisabledReason: string | null;
  reviewerRequestSubmitDisabledReason: string | null;
  pullActionPendingReason: string | null;
  livePullDisabledReason: string | null;
  pullAction: "closePullRequest" | "reopenPullRequest";
  selectedMergeMethod: PullRequestMergeMethod;
  reviewBody: string;
  commentBody: string;
  title: string;
  head: string;
  baseBody: string;
  createDraft: boolean;
  maintainerCanModify: boolean;
  effectiveBaseBranch: string;
  parsedLabels: string[];
  parsedAssignees: string[];
  parsedReviewers: string[];
  parsedTeamReviewers: string[];
  selectedLabels: LabelSummary[];
  selectedAssignees: AssignableUserSummary[];
  onSelectPullRequest(pullRequest: PullRequestSummary): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  setRequestedPullDetailSectionState: Dispatch<SetStateAction<PullDetailSectionState>>;
  setSelectedPullNumber: Dispatch<SetStateAction<number | null>>;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setHead: Dispatch<SetStateAction<string>>;
  setBase: Dispatch<SetStateAction<string>>;
  setBody: Dispatch<SetStateAction<string>>;
  setCreateDraft: Dispatch<SetStateAction<boolean>>;
  setMaintainerCanModify: Dispatch<SetStateAction<boolean>>;
  setCommentBody: Dispatch<SetStateAction<string>>;
  setReviewBody: Dispatch<SetStateAction<string>>;
  setLabelEntry: Dispatch<SetStateAction<string>>;
  setAssigneeEntry: Dispatch<SetStateAction<string>>;
  setReviewerEntry: Dispatch<SetStateAction<string>>;
  setTeamReviewerEntry: Dispatch<SetStateAction<string>>;
  setSubmittedPullAction: Dispatch<SetStateAction<GitHubAction | null>>;
  setShowAllPullLabels: Dispatch<SetStateAction<boolean>>;
  setShowAllPullAssignees: Dispatch<SetStateAction<boolean>>;
  setShowAllPullReviewers: Dispatch<SetStateAction<boolean>>;
  setShowAllPullMilestones: Dispatch<SetStateAction<boolean>>;
}) {
  function requestPullDetailSection(section: PullRequestDetailSection): void {
    if (!selectedPullDetailKey) {
      return;
    }

    setRequestedPullDetailSectionState((current) => ({
      detailKey: selectedPullDetailKey,
      sections: {
        ...(current.detailKey === selectedPullDetailKey ? current.sections : {}),
        [section]: true
      }
    }));
  }

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

  function submitPullComment(): void {
    if (!selectedPull || !commentBody.trim() || pullCommentDisabledReason) {
      return;
    }

    setSubmittedPullAction("addComment");
    onMutate("addComment", false, {
      issueNumber: selectedPull.number,
      body: commentBody.trim()
    });
  }

  function updateCreatePullDraft(draft: PullRequestCreateDraft): void {
    setTitle(draft.title);
    setHead(draft.head);
    setBase(draft.base);
    setBody(draft.body);
    setCreateDraft(draft.createDraft);
    setMaintainerCanModify(draft.maintainerCanModify);
  }

  function submitCreatePullRequest(): void {
    if (createPullSubmitDisabledReason) {
      return;
    }

    setSubmittedPullAction("createPullRequest");
    onMutate("createPullRequest", false, {
      title: title.trim(),
      head: head.trim(),
      base: effectiveBaseBranch,
      body: baseBody.trim(),
      draft: createDraft,
      maintainer_can_modify: maintainerCanModify
    });
  }

  function cancelCreatePullRequest(): void {
    setSubmittedPullAction(null);
    updateCreatePullDraft({
      title: "",
      head: "",
      base: defaultBaseBranch,
      body: "",
      createDraft: false,
      maintainerCanModify: true
    });
    setCreating(false);
  }

  function submitPullMetadata(): void {
    if (!selectedPull || pullMetadataSubmitDisabledReason) {
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
  }

  function submitReviewerRequest(): void {
    if (!selectedPull || reviewerRequestSubmitDisabledReason) {
      return;
    }

    setSubmittedPullAction("requestReviewers");
    onMutate("requestReviewers", true, {
      pullNumber: selectedPull.number,
      reviewers: parsedReviewers,
      teamReviewers: parsedTeamReviewers
    });
  }

  function handleStartCreating(): void {
    setSubmittedPullAction(null);
    setCreating(true);
  }

  function handleSelectPull(pull: PullRequestSummary): void {
    setCreating(false);
    setSelectedPullNumber(pull.number);
    onSelectPullRequest(pull);
  }

  function removePullLabel(name: string): void {
    if (!selectedPull) {
      return;
    }

    onMutate("removeLabel", false, {
      issueNumber: selectedPull.number,
      name
    });
  }

  function removePullAssignee(login: string): void {
    if (!selectedPull) {
      return;
    }

    onMutate("removeAssignees", false, {
      issueNumber: selectedPull.number,
      assignees: [login]
    });
  }

  function addLabelSuggestion(name: string): void {
    setLabelEntry((current) => appendCommaSeparatedValue(current, name));
  }

  function addAssigneeSuggestion(login: string): void {
    setAssigneeEntry((current) => appendCommaSeparatedValue(current, login));
  }

  function changePullMilestone(milestone: number | null): void {
    if (!selectedPull) {
      return;
    }

    onMutate("editIssue", false, {
      issueNumber: selectedPull.number,
      milestone
    });
  }

  function removeRequestedReviewer(login: string): void {
    if (!selectedPull) {
      return;
    }

    onMutate("removeReviewers", false, {
      pullNumber: selectedPull.number,
      reviewers: [login]
    });
  }

  function removeRequestedTeamReviewer(slug: string): void {
    if (!selectedPull) {
      return;
    }

    onMutate("removeReviewers", false, {
      pullNumber: selectedPull.number,
      teamReviewers: [slug]
    });
  }

  function readReviewCommentDisabledReason(comment: PullRequestReviewThreadCommentSummary): string | null {
    return (
      pullActionPendingReason ??
      livePullDisabledReason ??
      reviewCommentMutationDisabledReason(repository, comment)
    );
  }

  function editReviewComment(comment: PullRequestReviewThreadCommentSummary, body: string): void {
    const commentId = githubNumericId(comment.id);
    if (commentId === null) {
      return;
    }

    setSubmittedPullAction("editReviewComment");
    onMutate("editReviewComment", false, { commentId, body });
  }

  function deleteReviewComment(comment: PullRequestReviewThreadCommentSummary): void {
    const commentId = githubNumericId(comment.id);
    if (commentId === null) {
      return;
    }

    setSubmittedPullAction("deleteReviewComment");
    onMutate("deleteReviewComment", true, { commentId });
  }

  function readCommentDisabledReason(comment: TimelineCommentSummary): string | null {
    return (
      pullActionPendingReason ?? livePullDisabledReason ?? commentMutationDisabledReason(repository, comment)
    );
  }

  function editPullComment(comment: TimelineCommentSummary, body: string): void {
    const commentId = githubNumericId(comment.id);
    if (commentId === null) {
      return;
    }

    setSubmittedPullAction("editComment");
    onMutate("editComment", false, { commentId, body });
  }

  function deletePullComment(comment: TimelineCommentSummary): void {
    const commentId = githubNumericId(comment.id);
    if (commentId === null) {
      return;
    }

    setSubmittedPullAction("deleteComment");
    onMutate("deleteComment", true, { commentId });
  }

  function runPullAction(): void {
    if (!selectedPull) {
      return;
    }

    onMutate(pullAction, pullAction === "closePullRequest", {
      pullNumber: selectedPull.number
    });
  }

  function mergeSelectedPull(method: PullRequestMergeMethod = selectedMergeMethod): void {
    if (!selectedPull) {
      return;
    }

    onMutate("mergePullRequest", true, { pullNumber: selectedPull.number, merge_method: method });
  }

  return {
    requestPullDetailSection,
    addReviewerSuggestion,
    submitPullRequestReview,
    submitPullComment,
    updateCreatePullDraft,
    submitCreatePullRequest,
    cancelCreatePullRequest,
    submitPullMetadata,
    submitReviewerRequest,
    handleStartCreating,
    handleSelectPull,
    removePullLabel,
    removePullAssignee,
    addLabelSuggestion,
    addAssigneeSuggestion,
    changePullMilestone,
    removeRequestedReviewer,
    removeRequestedTeamReviewer,
    runPullAction,
    mergeSelectedPull,
    showAllPullLabels: () => setShowAllPullLabels(true),
    showAllPullAssignees: () => setShowAllPullAssignees(true),
    showAllPullReviewers: () => setShowAllPullReviewers(true),
    showAllPullMilestones: () => setShowAllPullMilestones(true),
    reviewCommentActions: {
      getDisabledReason: readReviewCommentDisabledReason,
      onEdit: editReviewComment,
      onDelete: deleteReviewComment
    },
    commentActions: {
      getDisabledReason: readCommentDisabledReason,
      onEdit: editPullComment,
      onDelete: deletePullComment
    },
    setCommentBody,
    setReviewBody,
    setLabelEntry,
    setAssigneeEntry,
    setReviewerEntry,
    setTeamReviewerEntry
  };
}
