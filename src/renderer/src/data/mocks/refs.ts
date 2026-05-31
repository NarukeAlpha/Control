import type { BranchSummary, RepositoryCommitSummary, RepoTreeResult, TagSummary } from "@shared/github";

import { mockAvatarUrl } from "./shared";

export const mockCommits: RepositoryCommitSummary[] = [
  {
    sha: "7f3a2c9d0e111111111111111111111111111111",
    message:
      "Add Sendable support for @MainActor types\n\nIncludes runtime coverage for actor-isolated values.",
    headline: "Add Sendable support for @MainActor types",
    authorLogin: "slightbug",
    authorName: "Slight Bug",
    authorAvatarUrl: mockAvatarUrl,
    committerLogin: "swift-ci",
    committerName: "Swift CI",
    committerAvatarUrl: mockAvatarUrl,
    authoredDate: "2026-05-03T20:00:00Z",
    committedDate: "2026-05-03T20:15:00Z",
    htmlUrl: "https://github.com/apple/swift/commit/7f3a2c9d0",
    parentCount: 1,
    verificationReason: "valid",
    verified: true
  },
  {
    sha: "3b8f90aa0e222222222222222222222222222222",
    message: "Update concurrency runtime tests",
    headline: "Update concurrency runtime tests",
    authorLogin: "compiler-team",
    authorName: "Compiler Team",
    authorAvatarUrl: mockAvatarUrl,
    committerLogin: "swift-ci",
    committerName: "Swift CI",
    committerAvatarUrl: mockAvatarUrl,
    authoredDate: "2026-05-03T18:00:00Z",
    committedDate: "2026-05-03T18:20:00Z",
    htmlUrl: "https://github.com/apple/swift/commit/3b8f90aa0",
    parentCount: 1,
    verificationReason: "valid",
    verified: true
  },
  {
    sha: "9ad551bb0e333333333333333333333333333333",
    message: "Add documentation for region based isolation",
    headline: "Add documentation for region based isolation",
    authorLogin: "swift-ci",
    authorName: "Swift CI",
    authorAvatarUrl: mockAvatarUrl,
    committerLogin: "swift-ci",
    committerName: "Swift CI",
    committerAvatarUrl: mockAvatarUrl,
    authoredDate: "2026-05-03T17:00:00Z",
    committedDate: "2026-05-03T17:05:00Z",
    htmlUrl: "https://github.com/apple/swift/commit/9ad551bb0",
    parentCount: 2,
    verificationReason: "valid",
    verified: true
  }
];

export const mockBranches: BranchSummary[] = [
  { name: "main", commitSha: "abcdefmain", protected: true },
  { name: "release/6.0", commitSha: "abcdefrel", protected: true },
  { name: "feature/sendable", commitSha: "abcdeffeat", protected: false }
];

export const mockTags: TagSummary[] = [
  {
    name: "swift-6.0",
    commitSha: "abcdeftag1",
    zipballUrl: "https://github.com/apple/swift/zipball/refs/tags/swift-6.0",
    tarballUrl: "https://github.com/apple/swift/tarball/refs/tags/swift-6.0"
  },
  {
    name: "swift-5.10",
    commitSha: "abcdeftag2",
    zipballUrl: "https://github.com/apple/swift/zipball/refs/tags/swift-5.10",
    tarballUrl: "https://github.com/apple/swift/tarball/refs/tags/swift-5.10"
  }
];

export const mockTree: RepoTreeResult = {
  ref: "main",
  truncated: false,
  entries: [
    {
      path: ".github/workflows/ci.yml",
      type: "file",
      sha: "tree-ci",
      size: 2048,
      htmlUrl: "https://github.com/apple/swift/blob/main/.github/workflows/ci.yml"
    },
    {
      path: "README.md",
      type: "file",
      sha: "tree-readme",
      size: 4096,
      htmlUrl: "https://github.com/apple/swift/blob/main/README.md"
    },
    {
      path: "documentation",
      type: "dir",
      sha: "tree-docs",
      size: null,
      htmlUrl: "https://github.com/apple/swift/tree/main/documentation"
    }
  ]
};

export function listMockCommits(input: { path?: string | null; limit?: number }): RepositoryCommitSummary[] {
  return input.path
    ? mockCommits
        .filter((commit) => commit.headline.toLowerCase().includes(input.path!.split("/")[0].toLowerCase()))
        .concat(mockCommits)
        .slice(0, input.limit ?? 20)
    : mockCommits.slice(0, input.limit ?? 20);
}
