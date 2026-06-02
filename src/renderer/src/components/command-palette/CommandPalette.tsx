import { ChevronDown, Code2, File as FileIcon, Folder, Search, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject
} from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  AreaFileEntry,
  AreaFileSearchResult,
  AreaRepositorySummary,
  AreaSummary,
  AreaWorkspaceSummary
} from "@shared/areas";
import type { RepoTreeEntry, RepositoryDetail } from "@shared/github";

import { fileFinderMatchScore } from "../file-finder/fileFinderSearch";
import { repositoryNameWithOwnerInput } from "../repository/repositorySearch";
import { readAvailabilityMessage } from "../repository/repositoryUi";
import { useControlApi } from "../../hooks/useControlApi";
import type { AppRoute } from "../../stores/uiStore";
import {
  areaHealthLabel,
  areaKindLabel,
  areaRepositorySubtitle,
  localFileSearchSubtitle,
  workspaceSubtitle
} from "../areas/areaSearchUi";

type CommandPaletteIcon = typeof Code2;

export interface CommandPaletteItem {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  icon: CommandPaletteIcon;
  keywords: string[];
  disabledReason?: string | null;
  run(): void;
}

interface CommandPaletteFileSearchContext {
  repository: RepositoryDetail;
  selectedRef: string;
  githubReady: boolean;
  onOpenEntry(entry: RepoTreeEntry): void;
}

interface CommandPaletteLocalFileSearchContext {
  route: Extract<AppRoute, { kind: "localRepository" }>;
  onOpenEntry(entry: AreaFileEntry): void;
}

interface CommandPaletteProps {
  items: CommandPaletteItem[];
  fileSearch?: CommandPaletteFileSearchContext | null;
  localFileSearch?: CommandPaletteLocalFileSearchContext | null;
  onOpenRepository?(nameWithOwner: string): void;
  onOpenArea(area: AreaSummary): void;
  onOpenAreaRepository(repository: AreaRepositorySummary): void;
  onOpenWorkspace(workspace: AreaWorkspaceSummary): void;
  onClose(): void;
}

type CommandPaletteResult =
  | { kind: "command"; item: CommandPaletteItem }
  | { kind: "githubFile"; entry: RepoTreeEntry }
  | { kind: "area"; area: AreaSummary }
  | { kind: "areaRepository"; repository: AreaRepositorySummary }
  | { kind: "workspace"; workspace: AreaWorkspaceSummary }
  | { kind: "localFile"; entry: AreaFileEntry };

interface CommandPaletteFileSearchState {
  fileSearchRef: string;
  fileSearchEntries: RepoTreeEntry[];
  matchingFileEntries: RepoTreeEntry[];
  fileResults: RepoTreeEntry[];
  fileSearchUnavailableReason: string | null;
  fileSearchTypedUnavailableReason: string | null;
  fileSearchLoading: boolean;
  fileSearchError: Error | null;
  showCachedFileResultsNotice: boolean;
  showTruncatedFileTreeNotice: boolean;
}

interface CommandPaletteAreaSearchState {
  areaResults: AreaSummary[];
  areaRepositoryResults: AreaRepositorySummary[];
  workspaceResults: AreaWorkspaceSummary[];
  areaById: Map<string, AreaSummary>;
  areaRepositoryById: Map<string, AreaRepositorySummary>;
  areaSearchError: Error | null;
}

interface CommandPaletteLocalFileSearchState {
  localFileResults: AreaFileEntry[];
  localFileSearchAvailability: AreaFileSearchResult["availability"] | null;
  localFileSearchLoading: boolean;
  localFileSearchUnavailableReason: string | null;
  localFileSearchPartialReason: string | null;
}

interface CommandPaletteResultsState {
  matchingCommandItems: CommandPaletteItem[];
  commandResults: CommandPaletteItem[];
  results: CommandPaletteResult[];
  effectiveCommandResultLimit: number;
  hiddenCommandResultCount: number;
  hiddenFileResultCount: number;
}

interface CommandPaletteResultMetadata {
  fileSearchRef: string;
  localFileSearch?: CommandPaletteLocalFileSearchContext | null;
  areaById: Map<string, AreaSummary>;
  areaRepositoryById: Map<string, AreaRepositorySummary>;
}

interface CommandPaletteLoadState {
  hiddenCommandResultCount: number;
  commandResultsLength: number;
  matchingCommandItemCount: number;
  hiddenFileResultCount: number;
  fileResultsLength: number;
  matchingFileEntryCount: number;
}

interface CommandPaletteStatusMessages {
  fileSearchLoading: boolean;
  fileSearchError: Error | null;
  areaSearchError: Error | null;
  localFileSearchLoading: boolean;
  fileSearchUnavailableReason: string | null;
  fileSearchTypedUnavailableReason: string | null;
  localFileSearchUnavailableReason: string | null;
  localFileSearchPartialReason: string | null;
  localFileSearchAvailability: AreaFileSearchResult["availability"] | null;
  showCachedFileResultsNotice: boolean;
  showTruncatedFileTreeNotice: boolean;
  showNoResults: boolean;
}

interface CommandPaletteModel {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  activeResultId: string | undefined;
  boundedActiveIndex: number;
  results: CommandPaletteResult[];
  resultMetadata: CommandPaletteResultMetadata;
  loadState: CommandPaletteLoadState;
  statusMessages: CommandPaletteStatusMessages;
  onClose(): void;
  onQueryChange(event: ChangeEvent<HTMLInputElement>): void;
  onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void;
  onSetActiveIndex(index: number): void;
  onRunResult(result: CommandPaletteResult): void;
  onLoadMoreCommands(): void;
  onLoadMoreFiles(): void;
}

const emptyRepoTreeEntries: RepoTreeEntry[] = [];
const COMMAND_PALETTE_FILE_RESULT_LIMIT = 6;
const COMMAND_PALETTE_COMMAND_RESULT_LIMIT = 12;
const COMMAND_PALETTE_COMMAND_RESULT_LIMIT_WITH_FILES = 8;

function commandPaletteMatches(item: CommandPaletteItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [item.title, item.subtitle, item.group, ...item.keywords].some((value) =>
    value.toLowerCase().includes(normalizedQuery)
  );
}

function commandPaletteResultDisabled(result: CommandPaletteResult): boolean {
  return result.kind === "command" && Boolean(result.item.disabledReason);
}

function firstEnabledCommandPaletteResultIndex(results: CommandPaletteResult[]): number {
  return results.findIndex((result) => !commandPaletteResultDisabled(result));
}

function lastEnabledCommandPaletteResultIndex(results: CommandPaletteResult[]): number {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (!commandPaletteResultDisabled(results[index])) {
      return index;
    }
  }

  return -1;
}

function enabledCommandPaletteResultIndex(
  results: CommandPaletteResult[],
  activeIndex: number,
  direction: 1 | -1
): number {
  const firstEnabledIndex = firstEnabledCommandPaletteResultIndex(results);
  if (firstEnabledIndex === -1) {
    return Math.min(Math.max(activeIndex, 0), Math.max(results.length - 1, 0));
  }

  const boundedIndex = Math.min(Math.max(activeIndex, 0), Math.max(results.length - 1, 0));
  for (let index = boundedIndex + direction; index >= 0 && index < results.length; index += direction) {
    if (!commandPaletteResultDisabled(results[index])) {
      return index;
    }
  }

  if (!commandPaletteResultDisabled(results[boundedIndex])) {
    return boundedIndex;
  }

  return direction === 1 ? firstEnabledIndex : lastEnabledCommandPaletteResultIndex(results);
}

function safeCommandPaletteResultIndex(results: CommandPaletteResult[], activeIndex: number): number {
  const boundedIndex = Math.min(Math.max(activeIndex, 0), Math.max(results.length - 1, 0));
  const firstEnabledIndex = firstEnabledCommandPaletteResultIndex(results);
  if (firstEnabledIndex === -1 || !commandPaletteResultDisabled(results[boundedIndex])) {
    return boundedIndex;
  }

  return firstEnabledIndex;
}

function directRepositoryCommandItem(
  query: string,
  items: CommandPaletteItem[],
  onOpenRepository: ((nameWithOwner: string) => void) | undefined
): CommandPaletteItem | null {
  const exactRepositoryTarget = repositoryNameWithOwnerInput(query);
  if (!exactRepositoryTarget || !onOpenRepository) {
    return null;
  }

  const normalizedTarget = exactRepositoryTarget.toLowerCase();
  const representedByExistingItem = items.some(
    (item) =>
      item.title.toLowerCase() === normalizedTarget ||
      item.keywords.some((keyword) => keyword.toLowerCase() === normalizedTarget)
  );
  if (representedByExistingItem) {
    return null;
  }

  return {
    id: `direct-repository-${normalizedTarget}`,
    title: exactRepositoryTarget,
    subtitle: "Open repository directly",
    group: "Repositories",
    icon: Code2,
    keywords: [exactRepositoryTarget],
    run: () => onOpenRepository(exactRepositoryTarget)
  };
}

function commandPaletteResultTitle(result: CommandPaletteResult): string {
  switch (result.kind) {
    case "command":
      return result.item.title;
    case "githubFile":
    case "localFile":
      return result.entry.path.split("/").pop() || result.entry.path;
    case "area":
      return result.area.label;
    case "areaRepository":
      return result.repository.displayName;
    case "workspace":
      return result.workspace.name;
  }
}

function commandPaletteResultSubtitle(
  result: CommandPaletteResult,
  metadata: CommandPaletteResultMetadata
): string {
  switch (result.kind) {
    case "command":
      return result.item.disabledReason ? `Unavailable: ${result.item.disabledReason}` : result.item.subtitle;
    case "githubFile":
      return `${result.entry.path} · ${metadata.fileSearchRef}`;
    case "localFile":
      return metadata.localFileSearch
        ? localFileSearchSubtitle(result.entry, metadata.localFileSearch.route)
        : result.entry.path;
    case "area": {
      const health = areaHealthLabel(result.area.health);
      return [areaKindLabel(result.area.kind), result.area.subtitle ?? result.area.rootPath, health]
        .filter(Boolean)
        .join(" · ");
    }
    case "areaRepository":
      return areaRepositorySubtitle(result.repository, metadata.areaById);
    case "workspace":
      return workspaceSubtitle(result.workspace, metadata.areaRepositoryById, metadata.areaById);
  }
}

function commandPaletteResultGroup(result: CommandPaletteResult): string {
  switch (result.kind) {
    case "command":
      return result.item.group;
    case "githubFile":
      return "GitHub files";
    case "localFile":
      return "Local files";
    case "area":
      return "Areas";
    case "areaRepository":
      return "Area repositories";
    case "workspace":
      return "Workspaces";
  }
}

function commandPaletteResultIcon(result: CommandPaletteResult): ReactNode {
  if (result.kind === "command") {
    const Icon = result.item.icon;
    return <Icon size={17} />;
  }

  if (result.kind === "githubFile" || result.kind === "localFile") {
    return result.entry.type === "dir" ? <Folder size={17} /> : <FileIcon size={17} />;
  }

  return <Code2 size={17} />;
}

function commandPaletteResultKey(result: CommandPaletteResult): string {
  switch (result.kind) {
    case "command":
      return result.item.id;
    case "githubFile":
      return `github-file-${result.entry.type}-${result.entry.path}`;
    case "localFile":
      return `local-file-${result.entry.type}-${result.entry.path}`;
    case "area":
      return `area-${result.area.id}`;
    case "areaRepository":
      return `area-repository-${result.repository.areaId}-${result.repository.id}`;
    case "workspace":
      return `workspace-${result.workspace.areaId}-${result.workspace.repositoryId}-${result.workspace.id}`;
  }
}

function matchingCommandPaletteFileEntries(
  entries: RepoTreeEntry[],
  normalizedQuery: string
): RepoTreeEntry[] {
  if (!normalizedQuery) {
    return [];
  }

  const scoredEntries: Array<{ entry: RepoTreeEntry; score: number }> = [];
  for (const entry of entries) {
    const score = fileFinderMatchScore(entry, normalizedQuery);
    if (score !== null) {
      scoredEntries.push({ entry, score });
    }
  }

  scoredEntries.sort((a, b) => a.score - b.score || a.entry.path.localeCompare(b.entry.path));

  return scoredEntries.map((item) => item.entry);
}

function stopCommandPaletteMouseDown(event: MouseEvent<HTMLElement>): void {
  event.stopPropagation();
}

function useCommandPaletteFileSearchState(
  fileSearch: CommandPaletteFileSearchContext | null | undefined,
  normalizedQuery: string,
  visibleFileResultLimit: number
): CommandPaletteFileSearchState {
  const api = useControlApi();
  const fileSearchRef = fileSearch?.selectedRef ?? "HEAD";
  const fileSearchTree = useQuery({
    queryKey: [
      "tree",
      fileSearch?.repository.owner ?? "none",
      fileSearch?.repository.name ?? "none",
      fileSearchRef
    ],
    queryFn: () =>
      api.github.listTreeWithStatus({
        owner: fileSearch!.repository.owner,
        repo: fileSearch!.repository.name,
        ref: fileSearchRef,
        recursive: true,
        cacheOnly: !fileSearch!.githubReady
      }),
    enabled: Boolean(fileSearch && normalizedQuery),
    staleTime: 120_000
  });
  const fileSearchTreeItem = fileSearchTree.data?.tree ?? null;
  const fileSearchAvailability = fileSearchTree.data?.availability ?? null;
  const fileSearchAvailabilityMessage = readAvailabilityMessage("Repository tree", fileSearchAvailability);
  const fileSearchEntries = fileSearchTreeItem?.entries ?? emptyRepoTreeEntries;
  const matchingFileEntries = useMemo(
    () => matchingCommandPaletteFileEntries(fileSearchEntries, normalizedQuery),
    [fileSearchEntries, normalizedQuery]
  );
  const fileResults = useMemo(
    () => matchingFileEntries.slice(0, visibleFileResultLimit),
    [matchingFileEntries, visibleFileResultLimit]
  );
  const fileSearchUnavailableReason =
    fileSearch && normalizedQuery && !fileSearch.githubReady && fileSearchTree.error
      ? "No cached repository tree is available. Sign in with GitHub to search files from the command palette."
      : null;
  const fileSearchTypedUnavailableReason =
    fileSearch &&
    normalizedQuery &&
    !fileSearchTree.error &&
    fileSearchAvailabilityMessage &&
    fileSearchEntries.length === 0
      ? fileSearchAvailabilityMessage
      : null;
  const fileSearchLoading = Boolean(
    fileSearch && normalizedQuery && fileSearchTree.isFetching && fileSearchEntries.length === 0
  );
  const fileSearchError =
    fileSearch &&
    normalizedQuery &&
    fileSearch.githubReady &&
    fileSearchTree.error &&
    fileSearchEntries.length === 0
      ? fileSearchTree.error
      : null;

  return {
    fileSearchRef,
    fileSearchEntries,
    matchingFileEntries,
    fileResults,
    fileSearchUnavailableReason,
    fileSearchTypedUnavailableReason,
    fileSearchLoading,
    fileSearchError,
    showCachedFileResultsNotice: Boolean(
      fileSearch && normalizedQuery && !fileSearch.githubReady && fileSearchEntries.length > 0
    ),
    showTruncatedFileTreeNotice: Boolean(fileSearch && normalizedQuery && fileSearchTreeItem?.truncated)
  };
}

function useCommandPaletteAreaSearchState(normalizedQuery: string): CommandPaletteAreaSearchState {
  const api = useControlApi();
  const areaSearch = useQuery({
    queryKey: ["command-palette-area-search", normalizedQuery],
    queryFn: () => api.areas.searchAreas({ query: normalizedQuery, limit: 8 }),
    enabled: normalizedQuery.length > 1
  });
  const areaResults = useMemo(() => areaSearch.data?.areas ?? [], [areaSearch.data?.areas]);
  const areaRepositoryResults = useMemo(
    () => areaSearch.data?.repositories ?? [],
    [areaSearch.data?.repositories]
  );
  const workspaceResults = useMemo(() => areaSearch.data?.workspaces ?? [], [areaSearch.data?.workspaces]);
  const areaById = useMemo(() => new Map(areaResults.map((area) => [area.id, area])), [areaResults]);
  const areaRepositoryById = useMemo(
    () => new Map(areaRepositoryResults.map((repository) => [repository.id, repository])),
    [areaRepositoryResults]
  );

  return {
    areaResults,
    areaRepositoryResults,
    workspaceResults,
    areaById,
    areaRepositoryById,
    areaSearchError: normalizedQuery.length > 1 && areaSearch.error ? areaSearch.error : null
  };
}

function useCommandPaletteLocalFileSearchState(
  localFileSearch: CommandPaletteLocalFileSearchContext | null | undefined,
  normalizedQuery: string
): CommandPaletteLocalFileSearchState {
  const api = useControlApi();
  const localFileSearchLimit = 8;
  const localFileSearchResult = useQuery({
    queryKey: [
      "area-file-search",
      localFileSearch?.route.areaId ?? "none",
      localFileSearch?.route.repositoryId ?? "none",
      localFileSearch?.route.workspaceId ?? "none",
      normalizedQuery,
      localFileSearchLimit
    ],
    queryFn: () =>
      api.areas.searchFilePaths({
        areaId: localFileSearch!.route.areaId,
        repositoryId: localFileSearch!.route.repositoryId,
        workspaceId: localFileSearch!.route.workspaceId ?? null,
        query: normalizedQuery,
        limit: localFileSearchLimit
      }),
    enabled: Boolean(localFileSearch && normalizedQuery.length > 1),
    staleTime: 5_000
  });
  const localFileResults = useMemo(
    () => localFileSearchResult.data?.matches ?? [],
    [localFileSearchResult.data?.matches]
  );
  const localFileSearchAvailability = localFileSearchResult.data?.availability ?? null;

  return {
    localFileResults,
    localFileSearchAvailability,
    localFileSearchLoading: Boolean(
      localFileSearch &&
      normalizedQuery.length > 1 &&
      localFileSearchResult.isFetching &&
      localFileResults.length === 0
    ),
    localFileSearchUnavailableReason:
      localFileSearch && normalizedQuery.length > 1 && localFileSearchAvailability?.status === "unavailable"
        ? (localFileSearchAvailability.message ?? "Local file search is unavailable.")
        : null,
    localFileSearchPartialReason:
      localFileSearch && normalizedQuery.length > 1 && localFileSearchAvailability?.status === "partial"
        ? (localFileSearchAvailability.message ??
          `Scanned ${localFileSearchAvailability.scannedEntries} entries before stopping.`)
        : null
  };
}

function useCommandPaletteResultsState({
  items,
  normalizedQuery,
  query,
  visibleCommandResultLimit,
  matchingFileEntries,
  fileResults,
  areaResults,
  areaRepositoryResults,
  workspaceResults,
  localFileResults,
  onOpenRepository
}: {
  items: CommandPaletteItem[];
  normalizedQuery: string;
  query: string;
  visibleCommandResultLimit: number | null;
  matchingFileEntries: RepoTreeEntry[];
  fileResults: RepoTreeEntry[];
  areaResults: AreaSummary[];
  areaRepositoryResults: AreaRepositorySummary[];
  workspaceResults: AreaWorkspaceSummary[];
  localFileResults: AreaFileEntry[];
  onOpenRepository?: (nameWithOwner: string) => void;
}): CommandPaletteResultsState {
  const directRepositoryItem = useMemo(
    () => directRepositoryCommandItem(normalizedQuery, items, onOpenRepository),
    [items, normalizedQuery, onOpenRepository]
  );
  const matchingCommandItems = useMemo(
    () => items.filter((item) => commandPaletteMatches(item, query)),
    [items, query]
  );
  const defaultCommandResultLimit =
    matchingFileEntries.length > 0
      ? COMMAND_PALETTE_COMMAND_RESULT_LIMIT_WITH_FILES
      : COMMAND_PALETTE_COMMAND_RESULT_LIMIT;
  const effectiveCommandResultLimit = visibleCommandResultLimit ?? defaultCommandResultLimit;
  const commandResults = useMemo(
    () => matchingCommandItems.slice(0, effectiveCommandResultLimit),
    [effectiveCommandResultLimit, matchingCommandItems]
  );
  const results: CommandPaletteResult[] = useMemo(
    () => [
      ...(directRepositoryItem ? [{ kind: "command" as const, item: directRepositoryItem }] : []),
      ...commandResults.map((item) => ({ kind: "command" as const, item })),
      ...areaResults.map((area) => ({ kind: "area" as const, area })),
      ...areaRepositoryResults.map((repository) => ({ kind: "areaRepository" as const, repository })),
      ...workspaceResults.map((workspace) => ({ kind: "workspace" as const, workspace })),
      ...fileResults.map((entry) => ({ kind: "githubFile" as const, entry })),
      ...localFileResults.map((entry) => ({ kind: "localFile" as const, entry }))
    ],
    [
      areaRepositoryResults,
      areaResults,
      commandResults,
      directRepositoryItem,
      fileResults,
      localFileResults,
      workspaceResults
    ]
  );

  return {
    matchingCommandItems,
    commandResults,
    results,
    effectiveCommandResultLimit,
    hiddenCommandResultCount: Math.max(matchingCommandItems.length - commandResults.length, 0),
    hiddenFileResultCount: Math.max(matchingFileEntries.length - fileResults.length, 0)
  };
}

function useCommandPaletteModel({
  items,
  fileSearch,
  localFileSearch,
  onOpenRepository,
  onOpenArea,
  onOpenAreaRepository,
  onOpenWorkspace,
  onClose
}: CommandPaletteProps): CommandPaletteModel {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleCommandResultLimit, setVisibleCommandResultLimit] = useState<number | null>(null);
  const [visibleFileResultLimit, setVisibleFileResultLimit] = useState(COMMAND_PALETTE_FILE_RESULT_LIMIT);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim();
  const fileSearchState = useCommandPaletteFileSearchState(
    fileSearch,
    normalizedQuery,
    visibleFileResultLimit
  );
  const areaSearchState = useCommandPaletteAreaSearchState(normalizedQuery);
  const localFileSearchState = useCommandPaletteLocalFileSearchState(localFileSearch, normalizedQuery);
  const resultsState = useCommandPaletteResultsState({
    items,
    normalizedQuery,
    query,
    visibleCommandResultLimit,
    matchingFileEntries: fileSearchState.matchingFileEntries,
    fileResults: fileSearchState.fileResults,
    areaResults: areaSearchState.areaResults,
    areaRepositoryResults: areaSearchState.areaRepositoryResults,
    workspaceResults: areaSearchState.workspaceResults,
    localFileResults: localFileSearchState.localFileResults,
    onOpenRepository
  });
  const boundedActiveIndex = safeCommandPaletteResultIndex(resultsState.results, activeIndex);
  const activeResult = resultsState.results[boundedActiveIndex];
  const activeResultId = activeResult ? `command-palette-result-${boundedActiveIndex}` : undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleRunResult(result: CommandPaletteResult): void {
    if (result.kind === "command") {
      if (result.item.disabledReason) {
        return;
      }
      result.item.run();
      onClose();
      return;
    }

    if (result.kind === "githubFile") {
      fileSearch?.onOpenEntry(result.entry);
      onClose();
      return;
    }
    if (result.kind === "area") {
      onOpenArea(result.area);
      onClose();
      return;
    }
    if (result.kind === "areaRepository") {
      onOpenAreaRepository(result.repository);
      onClose();
      return;
    }
    if (result.kind === "workspace") {
      onOpenWorkspace(result.workspace);
      onClose();
      return;
    }
    localFileSearch?.onOpenEntry(result.entry);
    onClose();
  }

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>): void {
    setQuery(event.target.value);
    setVisibleCommandResultLimit(null);
    setVisibleFileResultLimit(COMMAND_PALETTE_FILE_RESULT_LIMIT);
    setActiveIndex(0);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(enabledCommandPaletteResultIndex(resultsState.results, boundedActiveIndex, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(enabledCommandPaletteResultIndex(resultsState.results, boundedActiveIndex, -1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(firstEnabledCommandPaletteResultIndex(resultsState.results));
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(lastEnabledCommandPaletteResultIndex(resultsState.results));
      return;
    }
    if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      handleRunResult(activeResult);
    }
  }

  return {
    inputRef,
    query,
    activeResultId,
    boundedActiveIndex,
    results: resultsState.results,
    resultMetadata: {
      fileSearchRef: fileSearchState.fileSearchRef,
      localFileSearch,
      areaById: areaSearchState.areaById,
      areaRepositoryById: areaSearchState.areaRepositoryById
    },
    loadState: {
      hiddenCommandResultCount: resultsState.hiddenCommandResultCount,
      commandResultsLength: resultsState.commandResults.length,
      matchingCommandItemCount: resultsState.matchingCommandItems.length,
      hiddenFileResultCount: resultsState.hiddenFileResultCount,
      fileResultsLength: fileSearchState.fileResults.length,
      matchingFileEntryCount: fileSearchState.matchingFileEntries.length
    },
    statusMessages: {
      fileSearchLoading: fileSearchState.fileSearchLoading,
      fileSearchError: fileSearchState.fileSearchError,
      areaSearchError: areaSearchState.areaSearchError,
      localFileSearchLoading: localFileSearchState.localFileSearchLoading,
      fileSearchUnavailableReason: fileSearchState.fileSearchUnavailableReason,
      fileSearchTypedUnavailableReason: fileSearchState.fileSearchTypedUnavailableReason,
      localFileSearchUnavailableReason: localFileSearchState.localFileSearchUnavailableReason,
      localFileSearchPartialReason: localFileSearchState.localFileSearchPartialReason,
      localFileSearchAvailability: localFileSearchState.localFileSearchAvailability,
      showCachedFileResultsNotice: fileSearchState.showCachedFileResultsNotice,
      showTruncatedFileTreeNotice: fileSearchState.showTruncatedFileTreeNotice,
      showNoResults:
        resultsState.results.length === 0 &&
        !fileSearchState.fileSearchLoading &&
        !fileSearchState.fileSearchError &&
        !fileSearchState.fileSearchUnavailableReason &&
        !fileSearchState.fileSearchTypedUnavailableReason &&
        !areaSearchState.areaSearchError &&
        !localFileSearchState.localFileSearchLoading &&
        !localFileSearchState.localFileSearchUnavailableReason
    },
    onClose,
    onQueryChange: handleQueryChange,
    onSearchKeyDown: handleSearchKeyDown,
    onSetActiveIndex: setActiveIndex,
    onRunResult: handleRunResult,
    onLoadMoreCommands: () =>
      setVisibleCommandResultLimit(
        resultsState.effectiveCommandResultLimit + COMMAND_PALETTE_COMMAND_RESULT_LIMIT
      ),
    onLoadMoreFiles: () => setVisibleFileResultLimit((limit) => limit + COMMAND_PALETTE_FILE_RESULT_LIMIT)
  };
}

function CommandPaletteHeader({
  inputRef,
  query,
  activeResultId,
  onQueryChange,
  onSearchKeyDown,
  onClose
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  activeResultId: string | undefined;
  onQueryChange(event: ChangeEvent<HTMLInputElement>): void;
  onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void;
  onClose(): void;
}): JSX.Element {
  return (
    <header>
      <Search size={18} />
      <input
        ref={inputRef}
        value={query}
        onChange={onQueryChange}
        onKeyDown={onSearchKeyDown}
        placeholder="Search repositories, recents, commands, and files"
        aria-label="Command palette search"
        aria-controls="command-palette-results"
        aria-activedescendant={activeResultId}
        aria-describedby="command-palette-instructions"
      />
      <button className="icon-button" type="button" onClick={onClose} aria-label="Close command palette">
        <X size={17} />
      </button>
    </header>
  );
}

function CommandPaletteResultRow({
  result,
  index,
  active,
  metadata,
  onSetActiveIndex,
  onRunResult
}: {
  result: CommandPaletteResult;
  index: number;
  active: boolean;
  metadata: CommandPaletteResultMetadata;
  onSetActiveIndex(index: number): void;
  onRunResult(result: CommandPaletteResult): void;
}): JSX.Element {
  function activateCommandPaletteResult(): void {
    onSetActiveIndex(index);
  }

  function runCommandPaletteResult(): void {
    onRunResult(result);
  }

  return (
    <button
      className={active ? "active-finder-row" : ""}
      id={`command-palette-result-${index}`}
      key={commandPaletteResultKey(result)}
      role="option"
      aria-selected={active}
      type="button"
      disabled={commandPaletteResultDisabled(result)}
      title={
        result.kind === "command"
          ? (result.item.disabledReason ?? undefined)
          : commandPaletteResultSubtitle(result, metadata)
      }
      onMouseEnter={activateCommandPaletteResult}
      onClick={runCommandPaletteResult}
    >
      {commandPaletteResultIcon(result)}
      <span>
        <strong>{commandPaletteResultTitle(result)}</strong>
        <small>{commandPaletteResultSubtitle(result, metadata)}</small>
      </span>
      <em>{commandPaletteResultGroup(result)}</em>
    </button>
  );
}

function CommandPaletteLoadMoreCommands({
  loadState,
  onLoadMoreCommands
}: {
  loadState: CommandPaletteLoadState;
  onLoadMoreCommands(): void;
}): JSX.Element | null {
  if (loadState.hiddenCommandResultCount <= 0) {
    return null;
  }

  return (
    <>
      <button className="muted-row" type="button" onClick={onLoadMoreCommands}>
        <ChevronDown size={16} /> Load more commands
      </button>
      <div className="muted-row">
        Showing {loadState.commandResultsLength} of {loadState.matchingCommandItemCount} matching commands.
      </div>
    </>
  );
}

function CommandPaletteLoadMoreFiles({
  loadState,
  onLoadMoreFiles
}: {
  loadState: CommandPaletteLoadState;
  onLoadMoreFiles(): void;
}): JSX.Element | null {
  if (loadState.hiddenFileResultCount <= 0) {
    return null;
  }

  return (
    <>
      <button className="muted-row" type="button" onClick={onLoadMoreFiles}>
        <ChevronDown size={16} /> Load more files
      </button>
      <div className="muted-row">
        Showing {loadState.fileResultsLength} of {loadState.matchingFileEntryCount} matching files.
      </div>
    </>
  );
}

function CommandPaletteStatusMessages({ status }: { status: CommandPaletteStatusMessages }): JSX.Element {
  return (
    <>
      {status.fileSearchLoading && <div className="loading-state">Loading repository files…</div>}
      {status.fileSearchError && (
        <div className="error-state">
          Repository file search unavailable: {status.fileSearchError.message}
        </div>
      )}
      {status.areaSearchError instanceof Error && (
        <div className="error-state">Area search unavailable: {status.areaSearchError.message}</div>
      )}
      {status.localFileSearchLoading && <div className="loading-state">Searching local files…</div>}
      {status.fileSearchUnavailableReason && (
        <div className="empty-state">{status.fileSearchUnavailableReason}</div>
      )}
      {status.fileSearchTypedUnavailableReason && (
        <div className="error-state">{status.fileSearchTypedUnavailableReason}</div>
      )}
      {status.localFileSearchUnavailableReason && (
        <div className="error-state">{status.localFileSearchUnavailableReason}</div>
      )}
      {status.localFileSearchPartialReason && status.localFileSearchAvailability && (
        <div className="muted-row">
          {status.localFileSearchPartialReason} Scanned {status.localFileSearchAvailability.scannedEntries}{" "}
          entries.
        </div>
      )}
      {status.showCachedFileResultsNotice && (
        <div className="muted-row">Showing cached file results while GitHub is unavailable.</div>
      )}
      {status.showTruncatedFileTreeNotice && (
        <div className="muted-row">Large repository: showing GitHub's truncated tree.</div>
      )}
      {status.showNoResults && <div className="empty-state">No matching commands or files.</div>}
    </>
  );
}

function CommandPaletteResultsList({
  results,
  boundedActiveIndex,
  metadata,
  loadState,
  statusMessages,
  onSetActiveIndex,
  onRunResult,
  onLoadMoreCommands,
  onLoadMoreFiles
}: {
  results: CommandPaletteResult[];
  boundedActiveIndex: number;
  metadata: CommandPaletteResultMetadata;
  loadState: CommandPaletteLoadState;
  statusMessages: CommandPaletteStatusMessages;
  onSetActiveIndex(index: number): void;
  onRunResult(result: CommandPaletteResult): void;
  onLoadMoreCommands(): void;
  onLoadMoreFiles(): void;
}): JSX.Element {
  return (
    <div
      aria-label="Command palette results"
      className="command-palette-list"
      id="command-palette-results"
      role="listbox"
    >
      {results.map((result, index) => (
        <CommandPaletteResultRow
          active={index === boundedActiveIndex}
          index={index}
          key={commandPaletteResultKey(result)}
          metadata={metadata}
          result={result}
          onRunResult={onRunResult}
          onSetActiveIndex={onSetActiveIndex}
        />
      ))}
      <CommandPaletteLoadMoreCommands loadState={loadState} onLoadMoreCommands={onLoadMoreCommands} />
      <CommandPaletteLoadMoreFiles loadState={loadState} onLoadMoreFiles={onLoadMoreFiles} />
      <CommandPaletteStatusMessages status={statusMessages} />
    </div>
  );
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element {
  const model = useCommandPaletteModel(props);

  return (
    <div className="modal-backdrop command-palette-backdrop" role="presentation" onMouseDown={model.onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={stopCommandPaletteMouseDown}
      >
        <CommandPaletteHeader
          activeResultId={model.activeResultId}
          inputRef={model.inputRef}
          query={model.query}
          onClose={model.onClose}
          onQueryChange={model.onQueryChange}
          onSearchKeyDown={model.onSearchKeyDown}
        />
        <span className="visually-hidden" id="command-palette-instructions">
          Use arrow keys to choose a command or file and Enter to run it.
        </span>
        <CommandPaletteResultsList
          boundedActiveIndex={model.boundedActiveIndex}
          loadState={model.loadState}
          metadata={model.resultMetadata}
          results={model.results}
          statusMessages={model.statusMessages}
          onLoadMoreCommands={model.onLoadMoreCommands}
          onLoadMoreFiles={model.onLoadMoreFiles}
          onRunResult={model.onRunResult}
          onSetActiveIndex={model.onSetActiveIndex}
        />
      </section>
    </div>
  );
}
