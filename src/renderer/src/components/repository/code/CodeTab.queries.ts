import { useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  RepoContentsResult,
  RepoEntry,
  RepoFileContentResult,
  RepoReadmeResult,
  RepositoryCommitListResult
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { isMarkdownPath, isReadmeMarkdownPath } from "@renderer/components/code-browser/codeBrowserUi";
import { useControlApi } from "@renderer/hooks/useControlApi";
import { refreshRepositoryRefsData } from "@renderer/hooks/useRepositoryRefs";

const emptyCodeTabEntries: RepoEntry[] = [];

export interface CodeTabQueryInput {
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch: string | null | undefined;
  commitHistoryLimit: number;
  selectedRootMarkdownPath: string | null;
  enabled: boolean;
  githubReady: boolean;
}

export interface CodeTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch?: string | null;
  commitHistoryLimit: number;
  selectedRootMarkdownPath?: string | null;
  githubReady: boolean;
}

export interface CodeTabRefreshInput extends CodeTabPrefetchInput {
  refListLimit: number;
}

export function codeTabContentsQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null
): readonly ["contents", string, string, string, "", "dir"] {
  return ["contents", owner, repo, selectedRef ?? "default", "", "dir"] as const;
}

export function codeTabReadmeQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null
): readonly ["readme", string, string, string] {
  return ["readme", owner, repo, selectedRef ?? "default"] as const;
}

export function codeTabRootMarkdownContentQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  path: string | null
): readonly ["file-content", string, string, string, string] {
  return ["file-content", owner, repo, selectedRef ?? "default", path ?? ""] as const;
}

export function codeTabCommitsQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  limit: number
): readonly ["commits", string, string, string, "", number] {
  return ["commits", owner, repo, selectedRef ?? "default", "", limit] as const;
}

function rootMarkdownItemsFor(contents: RepoEntry[]): RepoEntry[] {
  return contents.filter(
    (item) =>
      item.type === "file" &&
      !item.path.includes("/") &&
      isMarkdownPath(item.path) &&
      !isReadmeMarkdownPath(item.path)
  );
}

function selectedRootMarkdownPathFor(
  rootMarkdownItems: RepoEntry[],
  selectedRootMarkdownPath: string | null | undefined
): string | null {
  return rootMarkdownItems.some((item) => item.path === selectedRootMarkdownPath)
    ? (selectedRootMarkdownPath ?? null)
    : (rootMarkdownItems[0]?.path ?? null);
}

export function useCodeTabQueries({
  owner,
  repo,
  selectedRef,
  defaultBranch,
  commitHistoryLimit,
  selectedRootMarkdownPath,
  enabled,
  githubReady
}: CodeTabQueryInput) {
  const api = useControlApi();
  const ref = selectedRef ?? undefined;
  const commitRef = selectedRef ?? defaultBranch ?? undefined;

  const contents = useQuery<RepoContentsResult>({
    queryKey: codeTabContentsQueryKey(owner, repo, selectedRef),
    queryFn: () =>
      api.github.listContentsWithStatus({
        owner,
        repo,
        ref,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 120_000
  });

  const readme = useQuery<RepoReadmeResult>({
    queryKey: codeTabReadmeQueryKey(owner, repo, selectedRef),
    queryFn: () => api.github.getReadme({ owner, repo, ref, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  const repositoryCommits = useQuery<RepositoryCommitListResult>({
    queryKey: codeTabCommitsQueryKey(owner, repo, selectedRef, commitHistoryLimit),
    queryFn: () =>
      api.github.listCommitsWithStatus({
        owner,
        repo,
        ref: commitRef,
        limit: commitHistoryLimit,
        cacheOnly: !githubReady
      }),
    enabled,
    staleTime: 60_000
  });

  const contentItems = contents.data?.items ?? emptyCodeTabEntries;
  const rootMarkdownItems = useMemo(() => rootMarkdownItemsFor(contentItems), [contentItems]);
  const effectiveSelectedRootMarkdownPath = selectedRootMarkdownPathFor(
    rootMarkdownItems,
    selectedRootMarkdownPath
  );

  const rootMarkdownContent = useQuery<RepoFileContentResult>({
    queryKey: codeTabRootMarkdownContentQueryKey(owner, repo, selectedRef, effectiveSelectedRootMarkdownPath),
    queryFn: () =>
      api.github.getFileContentWithStatus({
        owner,
        repo,
        path: effectiveSelectedRootMarkdownPath ?? "",
        ref,
        cacheOnly: !githubReady
      }),
    enabled: enabled && Boolean(effectiveSelectedRootMarkdownPath),
    staleTime: 120_000
  });

  return {
    contents,
    readme,
    repositoryCommits,
    rootMarkdownContent,
    contentItems,
    contentsAvailability: contents.data?.availability ?? null,
    repositoryCommitItems: repositoryCommits.data?.items ?? [],
    repositoryCommitsAvailability: repositoryCommits.data?.availability ?? null,
    rootMarkdownItems,
    effectiveSelectedRootMarkdownPath
  };
}

export async function prefetchCodeTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    selectedRef,
    defaultBranch,
    commitHistoryLimit,
    selectedRootMarkdownPath,
    githubReady
  }: CodeTabPrefetchInput
): Promise<void> {
  const ref = selectedRef ?? undefined;
  const commitRef = selectedRef ?? defaultBranch ?? undefined;
  const contentsPromise = queryClient.fetchQuery({
    queryKey: codeTabContentsQueryKey(owner, repo, selectedRef),
    queryFn: () =>
      api.github.listContentsWithStatus({
        owner,
        repo,
        ref,
        cacheOnly: !githubReady
      }),
    staleTime: 120_000
  });

  await Promise.all([
    contentsPromise.then(async (contents) => {
      const rootMarkdownItems = rootMarkdownItemsFor(contents.items);
      const rootMarkdownPath = selectedRootMarkdownPathFor(rootMarkdownItems, selectedRootMarkdownPath);
      if (!rootMarkdownPath) {
        return;
      }

      await queryClient.prefetchQuery({
        queryKey: codeTabRootMarkdownContentQueryKey(owner, repo, selectedRef, rootMarkdownPath),
        queryFn: () =>
          api.github.getFileContentWithStatus({
            owner,
            repo,
            path: rootMarkdownPath,
            ref,
            cacheOnly: !githubReady
          }),
        staleTime: 120_000
      });
    }),
    queryClient.prefetchQuery({
      queryKey: codeTabReadmeQueryKey(owner, repo, selectedRef),
      queryFn: () => api.github.getReadme({ owner, repo, ref, cacheOnly: !githubReady }),
      staleTime: 120_000
    }),
    queryClient.prefetchQuery({
      queryKey: codeTabCommitsQueryKey(owner, repo, selectedRef, commitHistoryLimit),
      queryFn: () =>
        api.github.listCommitsWithStatus({
          owner,
          repo,
          ref: commitRef,
          limit: commitHistoryLimit,
          cacheOnly: !githubReady
        }),
      staleTime: 60_000
    })
  ]);
}

export async function refreshCodeTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    selectedRef,
    defaultBranch,
    commitHistoryLimit,
    refListLimit,
    githubReady
  }: CodeTabRefreshInput
): Promise<void> {
  const ref = selectedRef ?? defaultBranch ?? undefined;
  const commitRef = selectedRef ?? defaultBranch ?? undefined;
  const cachedRead = !githubReady;

  try {
    await Promise.all([
      refreshRepositoryRefsData(queryClient, { api, owner, repo, limit: refListLimit, githubReady }),
      queryClient.fetchQuery({
        queryKey: codeTabContentsQueryKey(owner, repo, selectedRef),
        staleTime: 0,
        queryFn: () =>
          api.github.listContentsWithStatus({
            owner,
            repo,
            ref,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: codeTabReadmeQueryKey(owner, repo, selectedRef),
        staleTime: 0,
        queryFn: () =>
          api.github.getReadme({
            owner,
            repo,
            ref,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: codeTabCommitsQueryKey(owner, repo, selectedRef, commitHistoryLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listCommitsWithStatus({
            owner,
            repo,
            ref: commitRef,
            limit: commitHistoryLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    ]);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
