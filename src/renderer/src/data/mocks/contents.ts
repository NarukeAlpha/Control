import type { RepoEntry, RepoFileBlameResult } from "@shared/github";

import { mockRepository } from "./repository";
import { mockAvatarUrl } from "./shared";

export const mockContents: RepoEntry[] = [
  [".github", "dir", "Improve issue template", "2026-05-01T10:00:00Z"],
  ["documentation", "dir", "Add documentation for region based isolation", "2026-05-03T17:00:00Z"],
  ["include", "dir", "Fix build on Linux", "2026-05-02T16:00:00Z"],
  ["lib", "dir", "Add Sendable support for @MainActor types", "2026-05-03T20:00:00Z"],
  ["test", "dir", "Update concurrency runtime tests", "2026-05-03T18:00:00Z"],
  [".clang-format", "file", "Format", "2026-05-01T12:00:00Z"],
  ["CMakeLists.txt", "file", "Update minimum CMake version", "2026-04-30T12:00:00Z"],
  ["LICENSE.txt", "file", "Update license year", "2026-04-20T12:00:00Z"],
  ["README.md", "file", "Update installation instructions", "2026-05-03T11:00:00Z"]
].map(([name, type, message, date], index) => ({
  name,
  path: name,
  type: type as RepoEntry["type"],
  sha: `mock-${index}`,
  size: type === "file" ? 1024 + index * 90 : null,
  htmlUrl: `https://github.com/apple/swift/${type === "dir" ? "tree" : "blob"}/main/${name}`,
  downloadUrl: null,
  lastCommitSha: `abcdef${index}`,
  lastCommitMessage: message,
  lastCommitAuthorLogin: index % 2 === 0 ? "swift-ci" : "compiler-team",
  lastCommitAuthorName: index % 2 === 0 ? "Swift CI" : "Compiler Team",
  lastCommitAuthorAvatarUrl: mockAvatarUrl,
  lastAuthoredDate: date,
  lastCommittedDate: date,
  lastCommitDate: date,
  lastCommitHtmlUrl: `https://github.com/apple/swift/commit/abcdef${index}`,
  lastCommitAdditions: null,
  lastCommitDeletions: null,
  lastCommitChanges: null,
  lastCommitAvailability: { status: "available", message: null }
}));

export function mockFileContent(input: { path: string; ref?: string | null }) {
  const entry = mockContents.find((item) => item.path === input.path);
  return {
    path: input.path,
    name: input.path.split("/").pop() ?? input.path,
    ref: input.ref ?? mockRepository.defaultBranch,
    kind: "text" as const,
    content: `# ${input.path}\n\nMock file content from Control.`,
    size: entry?.size ?? 44,
    encoding: "utf-8" as const,
    htmlUrl: `https://github.com/apple/swift/blob/main/${input.path}`,
    downloadUrl: `https://raw.githubusercontent.com/apple/swift/main/${input.path}`,
    message: null,
    lastCommitSha: entry?.lastCommitSha ?? "abcdef0",
    lastCommitMessage: entry?.lastCommitMessage ?? "Update mock file",
    lastCommitAuthorLogin: entry?.lastCommitAuthorLogin ?? "swift-ci",
    lastCommitAuthorName: entry?.lastCommitAuthorName ?? "Swift CI",
    lastCommitAuthorAvatarUrl: entry?.lastCommitAuthorAvatarUrl ?? mockAvatarUrl,
    lastAuthoredDate: entry?.lastAuthoredDate ?? "2026-05-03T11:00:00Z",
    lastCommittedDate: entry?.lastCommittedDate ?? "2026-05-03T11:00:00Z",
    lastCommitDate: entry?.lastCommitDate ?? "2026-05-03T11:00:00Z",
    lastCommitHtmlUrl: entry?.lastCommitHtmlUrl ?? "https://github.com/apple/swift/commit/abcdef0",
    lastCommitAdditions: entry?.lastCommitAdditions ?? null,
    lastCommitDeletions: entry?.lastCommitDeletions ?? null,
    lastCommitChanges: entry?.lastCommitChanges ?? null,
    lastCommitAvailability: entry?.lastCommitAvailability ?? { status: "available", message: null }
  };
}

export function mockFileBlame(path: string, ref: string | null | undefined): RepoFileBlameResult {
  return {
    path,
    ref: ref ?? mockRepository.defaultBranch,
    truncated: false,
    availability: { status: "available", message: null },
    ranges: [
      {
        startingLine: 1,
        endingLine: 8,
        age: 1,
        commit: {
          sha: "7f3a2c9d0e111111111111111111111111111111",
          headline: "Add Sendable support for @MainActor types",
          authorLogin: "slightbug",
          authorName: "Slight Bug",
          authorAvatarUrl: mockAvatarUrl,
          authoredDate: "2026-05-03T20:00:00Z",
          committedDate: "2026-05-03T20:05:00Z",
          htmlUrl: "https://github.com/apple/swift/commit/7f3a2c9d0e111111111111111111111111111111"
        }
      },
      {
        startingLine: 9,
        endingLine: 18,
        age: 2,
        commit: {
          sha: "b1d2f70a91111111111111111111111111111111",
          headline: "Update documentation examples",
          authorLogin: "compiler-team",
          authorName: "Compiler Team",
          authorAvatarUrl: mockAvatarUrl,
          authoredDate: "2026-05-02T14:00:00Z",
          committedDate: "2026-05-02T14:10:00Z",
          htmlUrl: "https://github.com/apple/swift/commit/b1d2f70a91111111111111111111111111111111"
        }
      }
    ]
  };
}
