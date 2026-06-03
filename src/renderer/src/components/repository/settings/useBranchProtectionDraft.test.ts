import { describe, expect, it } from "vitest";

import type { BranchProtectionResult } from "@shared/github";

import {
  branchProtectionDraftFromResult,
  branchProtectionDraftSourceKey,
  branchProtectionMutationPayload
} from "./useBranchProtectionDraft";

const available = { status: "available", message: null } as const;

function protectedBranch(
  overrides: Partial<BranchProtectionResult["protection"]> = {}
): BranchProtectionResult {
  return {
    availability: available,
    protection: {
      branch: "main",
      url: "https://api.github.com/repos/apple/swift/branches/main/protection",
      requiredStatusCheckContexts: ["macOS build"],
      requiredStatusCheckEnforcementLevel: "non_admins",
      enforceAdmins: true,
      requiresPullRequestReviews: true,
      requiredApprovingReviewCount: 2,
      dismissStaleReviews: true,
      requireCodeOwnerReviews: true,
      requireLastPushApproval: false,
      restrictsPushes: false,
      restrictionUserCount: null,
      restrictionTeamCount: null,
      restrictionAppCount: null,
      requiredLinearHistory: true,
      allowForcePushes: false,
      allowDeletions: false,
      requiredConversationResolution: true,
      lockBranch: false,
      allowForkSyncing: false,
      ...overrides
    }
  };
}

describe("branch protection draft helpers", () => {
  it("keys and hydrates the draft from the loaded branch protection snapshot", () => {
    const result = protectedBranch();

    expect(branchProtectionDraftSourceKey("main", result)).not.toBeNull();
    expect(branchProtectionDraftFromResult(result)).toEqual({
      requiresPullRequestReviews: true,
      requiredApprovingReviewCount: "2",
      enforceAdmins: true,
      requiredLinearHistory: true,
      requiredConversationResolution: true
    });
  });

  it("does not build an update payload before branch protection data has loaded", () => {
    expect(branchProtectionDraftSourceKey("main", null)).toBeNull();
    expect(
      branchProtectionMutationPayload({
        branch: "main",
        branchProtection: null,
        draft: {
          requiresPullRequestReviews: false,
          requiredApprovingReviewCount: "1",
          enforceAdmins: false,
          requiredLinearHistory: false,
          requiredConversationResolution: false
        }
      })
    ).toBeNull();
  });

  it("omits unedited protection fields so main can preserve status checks and restrictions", () => {
    const result = protectedBranch({
      requiredStatusCheckContexts: ["macOS build", "linux build"],
      requiredStatusCheckEnforcementLevel: "everyone",
      restrictsPushes: true,
      restrictionTeamCount: 2
    });

    expect(
      branchProtectionMutationPayload({
        branch: "main",
        branchProtection: result,
        draft: {
          ...branchProtectionDraftFromResult(result),
          enforceAdmins: false,
          requiredApprovingReviewCount: "4"
        }
      })
    ).toEqual({
      branch: "main",
      enforce_admins: false,
      required_pull_request_reviews: {
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
        require_last_push_approval: false,
        required_approving_review_count: 4
      },
      required_linear_history: true,
      required_conversation_resolution: true
    });
  });

  it("builds an explicit full create payload for unprotected branches", () => {
    const result: BranchProtectionResult = {
      availability: available,
      protection: null
    };

    expect(
      branchProtectionMutationPayload({
        branch: "main",
        branchProtection: result,
        draft: {
          requiresPullRequestReviews: true,
          requiredApprovingReviewCount: "2",
          enforceAdmins: true,
          requiredLinearHistory: true,
          requiredConversationResolution: true
        }
      })
    ).toEqual({
      branch: "main",
      required_status_checks: null,
      enforce_admins: true,
      required_pull_request_reviews: {
        dismiss_stale_reviews: false,
        require_code_owner_reviews: false,
        require_last_push_approval: false,
        required_approving_review_count: 2
      },
      restrictions: null,
      required_linear_history: true,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: true,
      lock_branch: false,
      allow_fork_syncing: false
    });
  });
});
