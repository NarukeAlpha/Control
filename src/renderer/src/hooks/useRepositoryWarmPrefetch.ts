import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { prefetchActionsTabData } from "../components/repository/actions/ActionsTab.queries";
import { prefetchCodeTabData } from "../components/repository/code/CodeTab.queries";
import { prefetchIssuesTabData } from "../components/repository/issues/IssuesTab.queries";
import { prefetchPullRequestsTabData } from "../components/repository/pull-requests/PullRequestsTab.queries";
import type { IssueStateFilter, PullRequestStateFilter } from "@shared/github";
import { useControlApi } from "./useControlApi";

interface UseRepositoryWarmPrefetchInput {
  appReady: boolean;
  enabled: boolean;
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch: string | null;
  commitHistoryLimit: number;
  issueState: IssueStateFilter;
  issueListLimit: number;
  pullState: PullRequestStateFilter;
  pullRequestListLimit: number;
  actionsLimit: number;
  githubReady: boolean;
}

export function useRepositoryWarmPrefetch({
  appReady,
  enabled,
  owner,
  repo,
  selectedRef,
  defaultBranch,
  commitHistoryLimit,
  issueState,
  issueListLimit,
  pullState,
  pullRequestListLimit,
  actionsLimit,
  githubReady
}: UseRepositoryWarmPrefetchInput): void {
  const api = useControlApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!appReady || !enabled) {
      return;
    }

    void Promise.all([
      prefetchCodeTabData(queryClient, {
        api,
        owner,
        repo,
        selectedRef,
        defaultBranch,
        commitHistoryLimit,
        selectedRootMarkdownPath: null,
        githubReady
      }),
      prefetchIssuesTabData(queryClient, {
        api,
        owner,
        repo,
        issueState,
        issueListLimit,
        githubReady
      }),
      prefetchPullRequestsTabData(queryClient, {
        api,
        owner,
        repo,
        pullState,
        pullRequestListLimit,
        githubReady
      }),
      prefetchActionsTabData(queryClient, {
        api,
        owner,
        repo,
        limit: actionsLimit,
        githubReady
      })
    ]).catch(() => {
      // Mounted tabs own visible error states; warm prefetch should stay silent.
    });
  }, [
    actionsLimit,
    api,
    appReady,
    commitHistoryLimit,
    defaultBranch,
    enabled,
    githubReady,
    issueState,
    issueListLimit,
    owner,
    pullState,
    pullRequestListLimit,
    queryClient,
    repo,
    selectedRef
  ]);
}
