import { ChevronDown, Code2, File as FileIcon, Folder, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import type { RepoTreeEntry, RepositoryDetail } from "@shared/github";

import { fileFinderMatchScore } from "../file-finder/fileFinderSearch";
import { repositoryNameWithOwnerInput } from "../repository/repositorySearch";
import { readAvailabilityMessage } from "../repository/repositoryUi";
import { useControlApi } from "../../hooks/useControlApi";

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

type CommandPaletteResult =
  | { kind: "command"; item: CommandPaletteItem }
  | { kind: "file"; entry: RepoTreeEntry };

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

export function CommandPalette({
  items,
  fileSearch,
  onOpenRepository,
  onClose
}: {
  items: CommandPaletteItem[];
  fileSearch?: CommandPaletteFileSearchContext | null;
  onOpenRepository?(nameWithOwner: string): void;
  onClose(): void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleCommandResultLimit, setVisibleCommandResultLimit] = useState<number | null>(null);
  const [visibleFileResultLimit, setVisibleFileResultLimit] = useState(COMMAND_PALETTE_FILE_RESULT_LIMIT);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim();
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
    () =>
      normalizedQuery
        ? fileSearchEntries
            .map((entry) => ({ entry, score: fileFinderMatchScore(entry, normalizedQuery) }))
            .filter((item): item is { entry: RepoTreeEntry; score: number } => item.score !== null)
            .sort((a, b) => a.score - b.score || a.entry.path.localeCompare(b.entry.path))
            .map((item) => item.entry)
        : [],
    [fileSearchEntries, normalizedQuery]
  );
  const fileResults = useMemo(
    () => matchingFileEntries.slice(0, visibleFileResultLimit),
    [matchingFileEntries, visibleFileResultLimit]
  );
  const directRepositoryItem = useMemo<CommandPaletteItem | null>(() => {
    const exactRepositoryTarget = repositoryNameWithOwnerInput(normalizedQuery);
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
  }, [items, normalizedQuery, onOpenRepository]);
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
      ...fileResults.map((entry) => ({ kind: "file" as const, entry }))
    ],
    [commandResults, directRepositoryItem, fileResults]
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
  const showCachedFileResultsNotice = Boolean(
    fileSearch && normalizedQuery && !fileSearch.githubReady && fileSearchEntries.length > 0
  );
  const showTruncatedFileTreeNotice = Boolean(fileSearch && normalizedQuery && fileSearchTreeItem?.truncated);
  const hiddenCommandResultCount = Math.max(matchingCommandItems.length - commandResults.length, 0);
  const hiddenFileResultCount = Math.max(matchingFileEntries.length - fileResults.length, 0);
  const boundedActiveIndex = safeCommandPaletteResultIndex(results, activeIndex);
  const activeResult = results[boundedActiveIndex];
  const activeResultId = activeResult ? `command-palette-result-${boundedActiveIndex}` : undefined;
  const showNoResults =
    results.length === 0 &&
    !fileSearchLoading &&
    !fileSearchError &&
    !fileSearchUnavailableReason &&
    !fileSearchTypedUnavailableReason;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function runResult(result: CommandPaletteResult): void {
    if (result.kind === "command") {
      if (result.item.disabledReason) {
        return;
      }
      result.item.run();
      onClose();
      return;
    }

    fileSearch?.onOpenEntry(result.entry);
    onClose();
  }

  function resultTitle(result: CommandPaletteResult): string {
    return result.kind === "command"
      ? result.item.title
      : (result.entry.path.split("/").pop() ?? result.entry.path);
  }

  function resultSubtitle(result: CommandPaletteResult): string {
    return result.kind === "command"
      ? result.item.disabledReason
        ? `Unavailable: ${result.item.disabledReason}`
        : result.item.subtitle
      : `${result.entry.path} · ${fileSearchRef}`;
  }

  function resultGroup(result: CommandPaletteResult): string {
    return result.kind === "command" ? result.item.group : "Go to file";
  }

  function resultDisabled(result: CommandPaletteResult): boolean {
    return commandPaletteResultDisabled(result);
  }

  function resultIcon(result: CommandPaletteResult): ReactNode {
    if (result.kind === "command") {
      const Icon = result.item.icon;
      return <Icon size={17} />;
    }

    return result.entry.type === "dir" ? <Folder size={17} /> : <FileIcon size={17} />;
  }

  return (
    <div className="modal-backdrop command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCommandResultLimit(null);
              setVisibleFileResultLimit(COMMAND_PALETTE_FILE_RESULT_LIMIT);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex(enabledCommandPaletteResultIndex(results, boundedActiveIndex, 1));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex(enabledCommandPaletteResultIndex(results, boundedActiveIndex, -1));
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                setActiveIndex(() => {
                  const firstEnabledIndex = firstEnabledCommandPaletteResultIndex(results);
                  return firstEnabledIndex === -1 ? 0 : firstEnabledIndex;
                });
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                setActiveIndex(() => {
                  const lastEnabledIndex = lastEnabledCommandPaletteResultIndex(results);
                  return lastEnabledIndex === -1 ? Math.max(results.length - 1, 0) : lastEnabledIndex;
                });
                return;
              }
              if (event.key === "Enter" && activeResult) {
                event.preventDefault();
                runResult(activeResult);
              }
            }}
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
        <span className="visually-hidden" id="command-palette-instructions">
          Use arrow keys to choose a command or file and Enter to run it.
        </span>
        <div
          aria-label="Command palette results"
          className="command-palette-list"
          id="command-palette-results"
          role="listbox"
        >
          {results.map((result, index) => (
            <button
              className={index === boundedActiveIndex ? "active-finder-row" : ""}
              id={`command-palette-result-${index}`}
              key={
                result.kind === "command" ? result.item.id : `file-${result.entry.type}-${result.entry.path}`
              }
              role="option"
              aria-selected={index === boundedActiveIndex}
              type="button"
              disabled={resultDisabled(result)}
              title={
                result.kind === "command" ? (result.item.disabledReason ?? undefined) : result.entry.path
              }
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => runResult(result)}
            >
              {resultIcon(result)}
              <span>
                <strong>{resultTitle(result)}</strong>
                <small>{resultSubtitle(result)}</small>
              </span>
              <em>{resultGroup(result)}</em>
            </button>
          ))}
          {hiddenCommandResultCount > 0 && (
            <>
              <button
                className="muted-row"
                type="button"
                onClick={() =>
                  setVisibleCommandResultLimit(
                    effectiveCommandResultLimit + COMMAND_PALETTE_COMMAND_RESULT_LIMIT
                  )
                }
              >
                <ChevronDown size={16} /> Load more commands
              </button>
              <div className="muted-row">
                Showing {commandResults.length} of {matchingCommandItems.length} matching commands.
              </div>
            </>
          )}
          {hiddenFileResultCount > 0 && (
            <>
              <button
                className="muted-row"
                type="button"
                onClick={() =>
                  setVisibleFileResultLimit((limit) => limit + COMMAND_PALETTE_FILE_RESULT_LIMIT)
                }
              >
                <ChevronDown size={16} /> Load more files
              </button>
              <div className="muted-row">
                Showing {fileResults.length} of {matchingFileEntries.length} matching files.
              </div>
            </>
          )}
          {fileSearchLoading && <div className="loading-state">Loading repository files…</div>}
          {fileSearchError && (
            <div className="error-state">Repository file search unavailable: {fileSearchError.message}</div>
          )}
          {fileSearchUnavailableReason && <div className="empty-state">{fileSearchUnavailableReason}</div>}
          {fileSearchTypedUnavailableReason && (
            <div className="error-state">{fileSearchTypedUnavailableReason}</div>
          )}
          {showCachedFileResultsNotice && (
            <div className="muted-row">Showing cached file results while GitHub is unavailable.</div>
          )}
          {showTruncatedFileTreeNotice && (
            <div className="muted-row">Large repository: showing GitHub's truncated tree.</div>
          )}
          {showNoResults && <div className="empty-state">No matching commands or files.</div>}
        </div>
      </section>
    </div>
  );
}
