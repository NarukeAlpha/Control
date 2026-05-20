import { useQuery } from "@tanstack/react-query";

import type { IssueDetailResult } from "@shared/github";
import { useRepositoryContext } from "../../../hooks/useRepositoryContext";

export function useIssueDetail(issueNumber: number | null, enabled: boolean) {
  const { owner, repo, githubReady, api } = useRepositoryContext();

  return useQuery<IssueDetailResult>({
    queryKey: ["issue-detail", owner, repo, issueNumber],
    queryFn: () =>
      api.github.getIssueDetailWithStatus({
        owner,
        repo,
        issueNumber: issueNumber ?? 0,
        cacheOnly: !githubReady
      }),
    enabled: enabled && issueNumber !== null
  });
}
