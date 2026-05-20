import type { GitHubMutationInput, GitHubMutationFields } from "@shared/github";

export type MockGitHubMutationFields = GitHubMutationInput & Partial<GitHubMutationFields>;

export const mockAvatarUrl = "https://avatars.githubusercontent.com/u/10639145?v=4";

export const mockPrimaryRepository = {
  owner: "apple",
  repo: "swift",
  nameWithOwner: "apple/swift",
  htmlUrl: "https://github.com/apple/swift"
} as const;

export const mockIssuesKey = "control:mock:issues";
export const mockPullRequestsKey = "control:mock:pull-requests";
export const mockReleasesKey = "control:mock:releases";
export const mockWorkflowRunsKey = "control:mock:workflow-runs";

export const mockAvailable = { status: "available", message: null } as const;
export const mockGitHubNotLoaded = {
  status: "not_loaded",
  message: "Mock local repository is not connected to GitHub."
} as const;

export function mockPayload(input: GitHubMutationInput): MockGitHubMutationFields {
  return input;
}

export function mockPayloadString(
  payload: MockGitHubMutationFields | GitHubMutationFields | undefined,
  key: keyof GitHubMutationFields
): string | null {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

export function mockPayloadBoolean(
  payload: MockGitHubMutationFields | GitHubMutationFields | undefined,
  key: keyof GitHubMutationFields
): boolean {
  return payload?.[key] === true;
}

export function mockPayloadNumber(
  payload: MockGitHubMutationFields | GitHubMutationFields | undefined,
  key: keyof GitHubMutationFields
): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mockPayloadStringArray(
  payload: MockGitHubMutationFields | GitHubMutationFields | undefined,
  key: keyof GitHubMutationFields
): string[] {
  const value = payload?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item !== "string") {
      return [];
    }
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  });
}

export type MockRepositoryReference = {
  id: string;
  repositoryNameWithOwner: string | null | undefined;
};

export function findMissingMockRepositoryReferences({
  repositories,
  references
}: {
  repositories: readonly { nameWithOwner: string }[];
  references: readonly MockRepositoryReference[];
}): MockRepositoryReference[] {
  const repositoryNames = new Set(repositories.map((repository) => repository.nameWithOwner.toLowerCase()));
  return references.filter((reference) => {
    const nameWithOwner = reference.repositoryNameWithOwner;
    return Boolean(nameWithOwner) && !repositoryNames.has(nameWithOwner!.toLowerCase());
  });
}
