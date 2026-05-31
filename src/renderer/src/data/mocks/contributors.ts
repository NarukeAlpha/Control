import type { ContributorSummary } from "@shared/github";

export const mockContributors: ContributorSummary[] = Array.from({ length: 14 }, (_, index) => ({
  id: index + 10,
  login: ["slightbug", "ashleyrico", "applebot", "swiftlang"][index % 4],
  avatarUrl: `https://i.pravatar.cc/96?img=${index + 10}`,
  htmlUrl: "https://github.com",
  contributions: 200 - index * 8
}));
