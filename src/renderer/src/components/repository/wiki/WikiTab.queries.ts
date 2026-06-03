import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { RepositoryWikiResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { useControlApi } from "../../../hooks/useControlApi";

export const defaultWikiPageLimit = 50;

export interface WikiTabQueryInput {
  owner: string;
  repo: string;
  focusedPagePath: string | null;
  pageLimit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface WikiTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  focusedPagePath: string | null;
  pageLimit?: number;
  githubReady: boolean;
}

export type WikiTabRefreshInput = WikiTabPrefetchInput;

export function wikiTabQueryKey(
  owner: string,
  repo: string,
  focusedPagePath: string | null,
  pageLimit: number
): readonly ["repository-wiki", string, string, string, number] {
  return ["repository-wiki", owner, repo, focusedPagePath ?? "default", pageLimit] as const;
}

export function useWikiTabQueries({
  owner,
  repo,
  focusedPagePath,
  pageLimit,
  enabled,
  githubReady
}: WikiTabQueryInput) {
  const api = useControlApi();

  const wiki = useQuery<RepositoryWikiResult>({
    queryKey: wikiTabQueryKey(owner, repo, focusedPagePath, pageLimit),
    queryFn: () =>
      api.github.getRepositoryWiki({
        owner,
        repo,
        pagePath: focusedPagePath,
        limit: pageLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 120_000
  });

  return { wiki };
}

export async function prefetchWikiTabData(
  queryClient: QueryClient,
  { api, owner, repo, focusedPagePath, pageLimit = defaultWikiPageLimit, githubReady }: WikiTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: wikiTabQueryKey(owner, repo, focusedPagePath, pageLimit),
    queryFn: () =>
      api.github.getRepositoryWiki({
        owner,
        repo,
        pagePath: focusedPagePath,
        limit: pageLimit,
        cacheOnly: !githubReady
      }),
    staleTime: 120_000
  });
}

export async function refreshWikiTabData(
  queryClient: QueryClient,
  { api, owner, repo, focusedPagePath, pageLimit = defaultWikiPageLimit, githubReady }: WikiTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const wikiQueryKeys: ReturnType<typeof wikiTabQueryKey>[] = [];
  for (const [queryKey] of queryClient.getQueriesData<RepositoryWikiResult>({
    queryKey: ["repository-wiki", owner, repo]
  })) {
    if (
      queryKey.length === 5 &&
      queryKey[0] === "repository-wiki" &&
      queryKey[1] === owner &&
      queryKey[2] === repo &&
      typeof queryKey[3] === "string" &&
      typeof queryKey[4] === "number"
    ) {
      wikiQueryKeys.push(queryKey as ReturnType<typeof wikiTabQueryKey>);
    }
  }
  const keys =
    wikiQueryKeys.length > 0 ? wikiQueryKeys : [wikiTabQueryKey(owner, repo, focusedPagePath, pageLimit)];

  try {
    await Promise.all(
      keys.map((queryKey) =>
        queryClient.fetchQuery({
          queryKey,
          staleTime: 0,
          queryFn: () =>
            api.github.getRepositoryWiki({
              owner,
              repo,
              pagePath: queryKey[3] === "default" ? null : queryKey[3],
              limit: queryKey[4],
              cacheOnly: cachedRead,
              forceRefresh: !cachedRead
            })
        })
      )
    );
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
