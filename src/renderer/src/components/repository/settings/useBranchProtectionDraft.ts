import { useState } from "react";

import type { BranchProtectionResult, GitHubMutationFields } from "@shared/github";

export interface BranchProtectionDraft {
  requiresPullRequestReviews: boolean;
  requiredApprovingReviewCount: string;
  enforceAdmins: boolean;
  requiredLinearHistory: boolean;
  requiredConversationResolution: boolean;
}

export function branchProtectionDraftSourceKey(
  branch: string | null,
  branchProtection: BranchProtectionResult | null
): string | null {
  if (!branch || !branchProtection) {
    return null;
  }

  const protection = branchProtection.protection;
  return JSON.stringify([
    branch,
    protection?.requiresPullRequestReviews ?? false,
    protection?.requiredApprovingReviewCount ?? null,
    protection?.dismissStaleReviews ?? null,
    protection?.requireCodeOwnerReviews ?? null,
    protection?.requireLastPushApproval ?? null,
    protection?.enforceAdmins ?? null,
    protection?.requiredLinearHistory ?? null,
    protection?.requiredConversationResolution ?? null,
    protection?.allowForcePushes ?? null,
    protection?.allowDeletions ?? null,
    protection?.lockBranch ?? null,
    protection?.allowForkSyncing ?? null,
    protection?.restrictsPushes ?? false
  ]);
}

export function branchProtectionDraftFromResult(
  branchProtection: BranchProtectionResult | null
): BranchProtectionDraft {
  const protection = branchProtection?.protection ?? null;
  return {
    requiresPullRequestReviews: protection?.requiresPullRequestReviews === true,
    requiredApprovingReviewCount: String(protection?.requiredApprovingReviewCount ?? 1),
    enforceAdmins: protection?.enforceAdmins === true,
    requiredLinearHistory: protection?.requiredLinearHistory === true,
    requiredConversationResolution: protection?.requiredConversationResolution === true
  };
}

export function branchProtectionMutationPayload({
  branch,
  branchProtection,
  draft
}: {
  branch: string | null;
  branchProtection: BranchProtectionResult | null;
  draft: BranchProtectionDraft;
}): GitHubMutationFields | null {
  if (!branch || !branchProtection) {
    return null;
  }

  const approvalCount = Math.max(0, Number.parseInt(draft.requiredApprovingReviewCount, 10) || 0);
  const pullRequestReviews = draft.requiresPullRequestReviews
    ? {
        required_approving_review_count: approvalCount,
        dismiss_stale_reviews: branchProtection.protection?.dismissStaleReviews ?? false,
        require_code_owner_reviews: branchProtection.protection?.requireCodeOwnerReviews ?? false,
        require_last_push_approval: branchProtection.protection?.requireLastPushApproval ?? false
      }
    : null;

  if (!branchProtection.protection) {
    return {
      branch,
      required_status_checks: null,
      enforce_admins: draft.enforceAdmins,
      required_pull_request_reviews: pullRequestReviews,
      restrictions: null,
      required_linear_history: draft.requiredLinearHistory,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: draft.requiredConversationResolution,
      lock_branch: false,
      allow_fork_syncing: false
    };
  }

  return {
    branch,
    enforce_admins: draft.enforceAdmins,
    required_pull_request_reviews: pullRequestReviews,
    required_linear_history: draft.requiredLinearHistory,
    required_conversation_resolution: draft.requiredConversationResolution
  };
}

export function useBranchProtectionDraft(
  branch: string | null,
  branchProtection: BranchProtectionResult | null
) {
  const [draft, setDraft] = useState(() => branchProtectionDraftFromResult(branchProtection));
  const [draftSource, setDraftSource] = useState<string | null>(null);
  const currentDraftSource = branchProtectionDraftSourceKey(branch, branchProtection);
  const draftUsesCurrentSource = Boolean(currentDraftSource) && draftSource === currentDraftSource;
  const effectiveDraft = draftUsesCurrentSource ? draft : branchProtectionDraftFromResult(branchProtection);

  function updateDraft(patch: Partial<BranchProtectionDraft>): void {
    if (!currentDraftSource) {
      return;
    }

    setDraft((current) => ({
      ...(draftUsesCurrentSource ? current : branchProtectionDraftFromResult(branchProtection)),
      ...patch
    }));
    setDraftSource(currentDraftSource);
  }

  return {
    draft: effectiveDraft,
    draftReady: Boolean(currentDraftSource),
    draftSource: currentDraftSource,
    draftUsesCurrentSource,
    setRequiresPullRequestReviews: (value: boolean) => updateDraft({ requiresPullRequestReviews: value }),
    setRequiredApprovingReviewCount: (value: string) => updateDraft({ requiredApprovingReviewCount: value }),
    setEnforceAdmins: (value: boolean) => updateDraft({ enforceAdmins: value }),
    setRequiredLinearHistory: (value: boolean) => updateDraft({ requiredLinearHistory: value }),
    setRequiredConversationResolution: (value: boolean) =>
      updateDraft({ requiredConversationResolution: value })
  };
}
