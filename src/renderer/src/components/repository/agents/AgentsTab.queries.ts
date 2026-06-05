import type { QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { actionsTabQueryKey } from "../actions/ActionsTab.queries";
import { defaultIssueStateFilter, issuesTabQueryKey } from "../issues/IssuesTab.queries";
import { pullRequestsTabQueryKey } from "../pull-requests/PullRequestsTab.queries";

export interface AgentsTabRefreshInput {
  api: ControlApi;
  owner: string;
  repo: string;
  issueListLimit: number;
  pullRequestListLimit: number;
  actionsLimit: number;
  githubReady: boolean;
}

export async function refreshAgentsTabData(
  queryClient: QueryClient,
  { api, owner, repo, issueListLimit, pullRequestListLimit, actionsLimit, githubReady }: AgentsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;

  try {
    await Promise.all([
      queryClient.fetchQuery({
        queryKey: issuesTabQueryKey(owner, repo, defaultIssueStateFilter, issueListLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listIssuesWithStatus({
            owner,
            repo,
            state: defaultIssueStateFilter,
            limit: issueListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: pullRequestsTabQueryKey(owner, repo, pullRequestListLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listPullRequestsWithStatus({
            owner,
            repo,
            state: "all",
            limit: pullRequestListLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: actionsTabQueryKey(owner, repo, actionsLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listActionsWithStatus({
            owner,
            repo,
            limit: actionsLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    ]);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
