import type { BranchSummary } from "@shared/github";

export function repositoryBranchProtectionQueryKey(
  owner: string,
  repo: string,
  branch: string | null
): readonly ["branch-protection", string, string, string] {
  return ["branch-protection", owner, repo, branch ?? "none"] as const;
}

export function repositoryRulesetsQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["repository-rulesets", string, string, number] {
  return ["repository-rulesets", owner, repo, limit] as const;
}

export function repositoryBranchProtectionBranchFor(
  selectedRef: string | null,
  branches: BranchSummary[],
  defaultBranch: string | null
): string | null {
  return selectedRef && branches.some((branch) => branch.name === selectedRef) ? selectedRef : defaultBranch;
}
