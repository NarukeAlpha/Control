import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  GitHubReadAvailability,
  PullRequestChecksResult,
  PullRequestCommentsResult,
  PullRequestCommitsResult,
  PullRequestDetail,
  PullRequestFilesResult,
  PullRequestLinkedIssuesResult,
  PullRequestListResult,
  PullRequestOverviewResult,
  PullRequestReviewsResult,
  PullRequestReviewThreadsResult,
  PullRequestTimelineResult,
  RepositoryDetail
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "@renderer/hooks/useControlApi";
import {
  repositoryAssignableUsersQueryKey,
  repositoryLabelsQueryKey,
  repositoryMilestonesQueryKey,
  refreshRepositoryIssueResources,
  useRepositoryIssueResources
} from "@renderer/hooks/useRepositoryIssueResources";
import { repositoryBranchesQueryKey } from "@renderer/hooks/useRepositoryRefs";

export type PullRequestDetailSection =
  | "overview"
  | "comments"
  | "files"
  | "commits"
  | "reviews"
  | "checks"
  | "review-threads"
  | "timeline"
  | "linked-issues";

export type RequestedPullRequestDetailSections = Partial<Record<PullRequestDetailSection, boolean>>;

export function isPullRequestDetailSectionRequested(
  requestedSections: RequestedPullRequestDetailSections,
  section: PullRequestDetailSection
): boolean {
  return requestedSections[section] === true;
}

export interface PullRequestsTabQueryInput {
  owner: string;
  repo: string;
  pullRequestListLimit: number;
  pullsEnabled: boolean;
  resourcesEnabled: boolean;
  githubReady: boolean;
}

export interface PullRequestsTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  pullRequestListLimit: number;
  githubReady: boolean;
}

export interface PullRequestsTabRefreshInput extends PullRequestsTabPrefetchInput {
  refListLimit: number;
  focusedPullNumber: number | null;
  requestedDetailSections?: PullRequestDetailSection[];
}

export function pullRequestsTabQueryKey(
  owner: string,
  repo: string,
  pullRequestListLimit: number
): readonly ["pulls", string, string, number] {
  return ["pulls", owner, repo, pullRequestListLimit] as const;
}

export function pullRequestDetailQueryKey(
  section: PullRequestDetailSection,
  owner: string,
  repo: string,
  pullNumber: number | null
): readonly ["pull-detail", PullRequestDetailSection, string, string, number | null] {
  return ["pull-detail", section, owner, repo, pullNumber] as const;
}

function cachedPullRequestDetailSections(
  queryClient: QueryClient,
  owner: string,
  repo: string,
  pullNumber: number
): PullRequestDetailSection[] {
  const sections: PullRequestDetailSection[] = [];
  for (const [queryKey] of queryClient.getQueriesData({ queryKey: ["pull-detail"] })) {
    if (
      queryKey[0] === "pull-detail" &&
      typeof queryKey[1] === "string" &&
      queryKey[2] === owner &&
      queryKey[3] === repo &&
      queryKey[4] === pullNumber
    ) {
      sections.push(queryKey[1] as PullRequestDetailSection);
    }
  }
  return sections;
}

export function usePullRequestsTabQueries({
  owner,
  repo,
  pullRequestListLimit,
  pullsEnabled,
  resourcesEnabled,
  githubReady
}: PullRequestsTabQueryInput) {
  const api = useControlApi();
  const pulls = useQuery<PullRequestListResult>({
    queryKey: pullRequestsTabQueryKey(owner, repo, pullRequestListLimit),
    queryFn: () =>
      api.github.listPullRequestsWithStatus({
        owner,
        repo,
        state: "all",
        limit: pullRequestListLimit,
        cacheOnly: !githubReady
      }),
    enabled: pullsEnabled,
    staleTime: 60_000
  });
  const resources = useRepositoryIssueResources(owner, repo, resourcesEnabled, { githubReady });

  return { pulls, ...resources };
}

const notLoadedAvailability: GitHubReadAvailability = { status: "not_loaded", message: null };

export function useComposedPullRequestDetail({
  repository,
  pullNumber,
  githubReady,
  enabled,
  requestedSections
}: {
  repository: RepositoryDetail;
  pullNumber: number | null;
  githubReady: boolean;
  enabled: boolean;
  requestedSections: RequestedPullRequestDetailSections;
}): {
  detail: PullRequestDetail | null;
  availability: GitHubReadAvailability | null;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
} {
  const api = useControlApi();
  const detailInput = {
    owner: repository.owner,
    repo: repository.name,
    pullNumber: pullNumber ?? 0,
    cacheOnly: !githubReady
  };
  const queryEnabled = enabled && pullNumber !== null;
  const commentsEnabled = queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "comments");
  const filesEnabled = queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "files");
  const commitsEnabled = queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "commits");
  const reviewsEnabled = queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "reviews");
  const checksEnabled = queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "checks");
  const reviewThreadsEnabled =
    queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "review-threads");
  const timelineEnabled = queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "timeline");
  const linkedIssuesEnabled =
    queryEnabled && isPullRequestDetailSectionRequested(requestedSections, "linked-issues");
  const overview = useQuery<PullRequestOverviewResult>({
    queryKey: pullRequestDetailQueryKey("overview", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.getPullRequestOverviewWithStatus(detailInput),
    enabled: queryEnabled
  });
  const comments = useQuery<PullRequestCommentsResult>({
    queryKey: pullRequestDetailQueryKey("comments", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestCommentsWithStatus(detailInput),
    enabled: commentsEnabled
  });
  const files = useQuery<PullRequestFilesResult>({
    queryKey: pullRequestDetailQueryKey("files", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestFilesWithStatus(detailInput),
    enabled: filesEnabled
  });
  const commits = useQuery<PullRequestCommitsResult>({
    queryKey: pullRequestDetailQueryKey("commits", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestCommitsWithStatus(detailInput),
    enabled: commitsEnabled
  });
  const reviews = useQuery<PullRequestReviewsResult>({
    queryKey: pullRequestDetailQueryKey("reviews", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestReviewsWithStatus(detailInput),
    enabled: reviewsEnabled
  });
  const checks = useQuery<PullRequestChecksResult>({
    queryKey: pullRequestDetailQueryKey("checks", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestChecksWithStatus(detailInput),
    enabled: checksEnabled
  });
  const reviewThreads = useQuery<PullRequestReviewThreadsResult>({
    queryKey: pullRequestDetailQueryKey("review-threads", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestReviewThreadsWithStatus(detailInput),
    enabled: reviewThreadsEnabled
  });
  const timeline = useQuery<PullRequestTimelineResult>({
    queryKey: pullRequestDetailQueryKey("timeline", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestTimelineWithStatus(detailInput),
    enabled: timelineEnabled
  });
  const linkedIssues = useQuery<PullRequestLinkedIssuesResult>({
    queryKey: pullRequestDetailQueryKey("linked-issues", repository.owner, repository.name, pullNumber),
    queryFn: () => api.github.listPullRequestLinkedIssuesWithStatus(detailInput),
    enabled: linkedIssuesEnabled
  });
  const queries = [
    overview,
    ...(commentsEnabled ? [comments] : []),
    ...(filesEnabled ? [files] : []),
    ...(commitsEnabled ? [commits] : []),
    ...(reviewsEnabled ? [reviews] : []),
    ...(checksEnabled ? [checks] : []),
    ...(reviewThreadsEnabled ? [reviewThreads] : []),
    ...(timelineEnabled ? [timeline] : []),
    ...(linkedIssuesEnabled ? [linkedIssues] : [])
  ];

  return {
    detail: composePullRequestDetail({
      overview: overview.data,
      comments: commentsEnabled ? comments.data : undefined,
      files: filesEnabled ? files.data : undefined,
      commits: commitsEnabled ? commits.data : undefined,
      reviews: reviewsEnabled ? reviews.data : undefined,
      checks: checksEnabled ? checks.data : undefined,
      reviewThreads: reviewThreadsEnabled ? reviewThreads.data : undefined,
      timeline: timelineEnabled ? timeline.data : undefined,
      linkedIssues: linkedIssuesEnabled ? linkedIssues.data : undefined
    }),
    availability: overview.data?.availability ?? null,
    error: queries.find((query) => query.error instanceof Error)?.error ?? null,
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching)
  };
}

function composePullRequestDetail({
  overview,
  comments,
  files,
  commits,
  reviews,
  checks,
  reviewThreads,
  timeline,
  linkedIssues
}: {
  overview: PullRequestOverviewResult | undefined;
  comments: PullRequestCommentsResult | undefined;
  files: PullRequestFilesResult | undefined;
  commits: PullRequestCommitsResult | undefined;
  reviews: PullRequestReviewsResult | undefined;
  checks: PullRequestChecksResult | undefined;
  reviewThreads: PullRequestReviewThreadsResult | undefined;
  timeline: PullRequestTimelineResult | undefined;
  linkedIssues: PullRequestLinkedIssuesResult | undefined;
}): PullRequestDetail | null {
  if (!overview?.overview) {
    return null;
  }

  return {
    ...overview.overview,
    commentsList: comments?.items ?? [],
    commentsAvailability: comments?.availability ?? notLoadedAvailability,
    files: files?.items ?? [],
    filesAvailability: files?.availability ?? notLoadedAvailability,
    commitsList: commits?.items ?? [],
    commitsAvailability: commits?.availability ?? notLoadedAvailability,
    reviews: reviews?.items ?? [],
    reviewsAvailability: reviews?.availability ?? notLoadedAvailability,
    checks: checks?.items ?? [],
    checksAvailability: checks?.availability ?? notLoadedAvailability,
    reviewThreads: reviewThreads?.items ?? [],
    reviewThreadsAvailability: reviewThreads?.availability ?? notLoadedAvailability,
    reviewThreadStatesAvailability: reviewThreads?.statesAvailability ?? notLoadedAvailability,
    timelineEvents: timeline?.items ?? [],
    timelineAvailability: timeline?.availability ?? notLoadedAvailability,
    linkedIssues: linkedIssues?.items ?? [],
    linkedIssuesAvailability: linkedIssues?.availability ?? notLoadedAvailability
  };
}

export async function prefetchPullRequestsTabData(
  queryClient: QueryClient,
  { api, owner, repo, pullRequestListLimit, githubReady }: PullRequestsTabPrefetchInput
): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: pullRequestsTabQueryKey(owner, repo, pullRequestListLimit),
      queryFn: () =>
        api.github.listPullRequestsWithStatus({
          owner,
          repo,
          state: "all",
          limit: pullRequestListLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryLabelsQueryKey(owner, repo),
      queryFn: () => api.github.listLabelsWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryAssignableUsersQueryKey(owner, repo),
      queryFn: () =>
        api.github.listAssignableUsersWithStatus({ owner, repo, limit: 100, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: repositoryMilestonesQueryKey(owner, repo),
      queryFn: () =>
        api.github.listMilestonesWithStatus({
          owner,
          repo,
          state: "all",
          limit: 100,
          cacheOnly: !githubReady
        }),
      staleTime: 120_000
    })
  ]);
}

export async function refreshPullRequestsTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    pullRequestListLimit,
    refListLimit,
    focusedPullNumber,
    requestedDetailSections,
    githubReady
  }: PullRequestsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const refreshes: Array<Promise<unknown>> = [
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
    refreshRepositoryIssueResources(queryClient, { api, owner, repo, githubReady }),
    queryClient.fetchQuery({
      queryKey: repositoryBranchesQueryKey(owner, repo, refListLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listBranchesWithStatus({
          owner,
          repo,
          limit: refListLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    })
  ];

  if (focusedPullNumber !== null) {
    const pullDetailInput = {
      owner,
      repo,
      pullNumber: focusedPullNumber,
      cacheOnly: cachedRead,
      forceRefresh: !cachedRead
    };
    const detailSections =
      requestedDetailSections ?? cachedPullRequestDetailSections(queryClient, owner, repo, focusedPullNumber);
    const requestedSections = new Set<PullRequestDetailSection>(["overview", ...detailSections]);

    refreshes.push(
      queryClient.fetchQuery<PullRequestOverviewResult>({
        queryKey: pullRequestDetailQueryKey("overview", owner, repo, focusedPullNumber),
        staleTime: 0,
        queryFn: () => api.github.getPullRequestOverviewWithStatus(pullDetailInput)
      })
    );

    if (requestedSections.has("comments")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestCommentsResult>({
          queryKey: pullRequestDetailQueryKey("comments", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestCommentsWithStatus(pullDetailInput)
        })
      );
    }

    if (requestedSections.has("files")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestFilesResult>({
          queryKey: pullRequestDetailQueryKey("files", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestFilesWithStatus(pullDetailInput)
        })
      );
    }

    if (requestedSections.has("commits")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestCommitsResult>({
          queryKey: pullRequestDetailQueryKey("commits", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestCommitsWithStatus(pullDetailInput)
        })
      );
    }

    if (requestedSections.has("reviews")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestReviewsResult>({
          queryKey: pullRequestDetailQueryKey("reviews", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestReviewsWithStatus(pullDetailInput)
        })
      );
    }

    if (requestedSections.has("checks")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestChecksResult>({
          queryKey: pullRequestDetailQueryKey("checks", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestChecksWithStatus(pullDetailInput)
        })
      );
    }

    if (requestedSections.has("review-threads")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestReviewThreadsResult>({
          queryKey: pullRequestDetailQueryKey("review-threads", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestReviewThreadsWithStatus(pullDetailInput)
        })
      );
    }

    if (requestedSections.has("timeline")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestTimelineResult>({
          queryKey: pullRequestDetailQueryKey("timeline", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestTimelineWithStatus(pullDetailInput)
        })
      );
    }

    if (requestedSections.has("linked-issues")) {
      refreshes.push(
        queryClient.fetchQuery<PullRequestLinkedIssuesResult>({
          queryKey: pullRequestDetailQueryKey("linked-issues", owner, repo, focusedPullNumber),
          staleTime: 0,
          queryFn: () => api.github.listPullRequestLinkedIssuesWithStatus(pullDetailInput)
        })
      );
    }
  }

  try {
    await Promise.all(refreshes);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
