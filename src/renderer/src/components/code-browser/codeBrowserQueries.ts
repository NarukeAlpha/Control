import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ControlApi } from "@shared/ipc";
import type { RepoEntry } from "@shared/github";

import { refreshRepositoryRefsData } from "../../hooks/useRepositoryRefs";
import { readAvailabilityMessage } from "../repository/repositoryUi";

const emptyRepoEntries: RepoEntry[] = [];

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
  fileCommitHistoryLimit: number;
  githubReady: boolean;
}

export interface CodeBrowserQueriesInput {
  api: ControlApi;
  appReady: boolean;
  githubReady: boolean;
  owner: string;
  repo: string;
  hasRepositoryParts: boolean;
  isCodeBrowserRoute: boolean;
  codeBrowserPath: string;
  codeBrowserEntryType: "file" | "dir";
  codeBrowserRef: string | null;
  contentsRef: string | null;
  defaultBranch: string | null;
  fileCommitHistoryLimit: number;
  fileFinderOpen: boolean;
  repositoryLoaded: boolean;
}

export function useCodeBrowserQueries({
  api,
  appReady,
  githubReady,
  owner,
  repo,
  hasRepositoryParts,
  isCodeBrowserRoute,
  codeBrowserPath,
  codeBrowserEntryType,
  codeBrowserRef,
  contentsRef,
  defaultBranch,
  fileCommitHistoryLimit,
  fileFinderOpen,
  repositoryLoaded
}: CodeBrowserQueriesInput) {
  const codeBrowserContents = useQuery({
    queryKey: codeBrowserContentsQueryKey(owner, repo, codeBrowserRef, codeBrowserPath, codeBrowserEntryType),
    queryFn: () =>
      api.github.listContentsWithStatus({
        owner,
        repo,
        path: codeBrowserPath,
        ref: codeBrowserRef ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled: appReady && hasRepositoryParts && isCodeBrowserRoute && codeBrowserEntryType === "dir",
    staleTime: 120_000
  });

  const fileContent = useQuery({
    queryKey: codeBrowserFileContentQueryKey(owner, repo, contentsRef, codeBrowserPath),
    queryFn: () =>
      getCodeBrowserFileContentWithStatus(api, {
        owner,
        repo,
        path: codeBrowserPath,
        ref: contentsRef ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled:
      appReady &&
      isCodeBrowserRoute &&
      codeBrowserEntryType === "file" &&
      hasRepositoryParts &&
      Boolean(codeBrowserPath),
    staleTime: 120_000
  });

  const fileCommits = useQuery({
    queryKey: codeBrowserCommitsQueryKey(
      owner,
      repo,
      codeBrowserRef,
      codeBrowserPath,
      fileCommitHistoryLimit
    ),
    queryFn: () =>
      api.github.listCommitsWithStatus({
        owner,
        repo,
        ref: codeBrowserRef ?? defaultBranch ?? undefined,
        path: codeBrowserPath,
        limit: fileCommitHistoryLimit,
        cacheOnly: !githubReady
      }),
    enabled:
      appReady &&
      isCodeBrowserRoute &&
      codeBrowserEntryType === "file" &&
      hasRepositoryParts &&
      Boolean(codeBrowserPath),
    staleTime: 60_000
  });

  const repositoryTree = useQuery({
    queryKey: ["tree", owner, repo, contentsRef ?? "default"],
    queryFn: () =>
      api.github.listTreeWithStatus({
        owner,
        repo,
        ref: contentsRef ?? defaultBranch ?? undefined,
        recursive: true,
        cacheOnly: !githubReady
      }),
    enabled: appReady && fileFinderOpen && hasRepositoryParts && repositoryLoaded,
    staleTime: 120_000
  });

  const fileContentAvailability = fileContent.data?.availability ?? null;
  const repositoryTreeAvailability = repositoryTree.data?.availability ?? null;

  return {
    codeBrowserContents,
    fileContent,
    fileCommits,
    repositoryTree,
    contentItems: codeBrowserContents.data?.items ?? emptyRepoEntries,
    contentsAvailability: codeBrowserContents.data?.availability ?? null,
    fileCommitItems: fileCommits.data?.items ?? [],
    fileCommitsAvailability: fileCommits.data?.availability ?? null,
    fileContentItem: fileContent.data?.item ?? null,
    fileContentAvailability,
    fileContentAvailabilityMessage: readAvailabilityMessage("File content", fileContentAvailability),
    repositoryTreeItem: repositoryTree.data?.tree ?? null,
    repositoryTreeAvailability,
    repositoryTreeAvailabilityMessage: readAvailabilityMessage("Repository tree", repositoryTreeAvailability)
  };
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
          getCodeBrowserFileContentWithStatus(api, {
            owner,
            repo,
            path,
            ref: requestRef,
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

async function getCodeBrowserFileContentWithStatus(
  api: ControlApi,
  input: Parameters<ControlApi["github"]["getFileContentWithStatus"]>[0]
): ReturnType<ControlApi["github"]["getFileContentWithStatus"]> {
  const result = await api.github.getFileContentWithStatus(input);
  if (result.item) {
    return result;
  }

  throw new Error(
    readAvailabilityMessage("File content", result.availability) ?? "File content was not returned."
  );
}
