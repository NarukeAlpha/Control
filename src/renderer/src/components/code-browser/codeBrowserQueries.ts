import type { QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";

import { refreshRepositoryRefsData } from "../../hooks/useRepositoryRefs";

export function codeBrowserContentsQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  path: string,
  entryType: "file" | "dir"
): readonly ["contents", string, string, string, string, "file" | "dir"] {
  return ["contents", owner, repo, selectedRef ?? "default", path, entryType] as const;
}

export function codeBrowserFileContentQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  path: string
): readonly ["file-content", string, string, string, string] {
  return ["file-content", owner, repo, selectedRef ?? "default", path] as const;
}

export function codeBrowserFileBlameQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  path: string,
  rangeLimit: number
): readonly ["file-blame", string, string, string, string, number] {
  return ["file-blame", owner, repo, selectedRef ?? "default", path, rangeLimit] as const;
}

export function codeBrowserCommitsQueryKey(
  owner: string,
  repo: string,
  selectedRef: string | null,
  path: string,
  limit: number
): readonly ["commits", string, string, string, string, number] {
  return ["commits", owner, repo, selectedRef ?? "default", path, limit] as const;
}

export interface CodeBrowserRefreshInput {
  api: ControlApi;
  owner: string;
  repo: string;
  selectedRef: string | null;
  defaultBranch?: string | null;
  path: string;
  entryType: "file" | "dir";
  refListLimit: number;
  fileBlameRangeLimit: number;
  fileCommitHistoryLimit: number;
  githubReady: boolean;
}

export async function refreshCodeBrowserData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    selectedRef,
    defaultBranch,
    path,
    entryType,
    refListLimit,
    fileBlameRangeLimit,
    fileCommitHistoryLimit,
    githubReady
  }: CodeBrowserRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const requestRef = selectedRef ?? defaultBranch ?? undefined;
  const refreshes: Array<Promise<unknown>> = [
    refreshRepositoryRefsData(queryClient, {
      api,
      owner,
      repo,
      limit: refListLimit,
      githubReady
    })
  ];

  if (entryType === "dir") {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: codeBrowserContentsQueryKey(owner, repo, selectedRef, path, entryType),
        staleTime: 0,
        queryFn: () =>
          api.github.listContentsWithStatus({
            owner,
            repo,
            path,
            ref: requestRef,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );
  }

  if (entryType === "file" && path) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: codeBrowserFileContentQueryKey(owner, repo, selectedRef, path),
        staleTime: 0,
        queryFn: () =>
          api.github.getFileContentWithStatus({
            owner,
            repo,
            path,
            ref: requestRef,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: codeBrowserFileBlameQueryKey(owner, repo, selectedRef, path, fileBlameRangeLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.getFileBlame({
            owner,
            repo,
            path,
            ref: requestRef,
            maxRanges: fileBlameRangeLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      }),
      queryClient.fetchQuery({
        queryKey: codeBrowserCommitsQueryKey(owner, repo, selectedRef, path, fileCommitHistoryLimit),
        staleTime: 0,
        queryFn: () =>
          api.github.listCommitsWithStatus({
            owner,
            repo,
            ref: requestRef,
            path,
            limit: fileCommitHistoryLimit,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );
  }

  try {
    await Promise.all(refreshes);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}
