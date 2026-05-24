import { BookOpen, CheckCircle2, Copy, ExternalLink, Plus, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  GitHubAction,
  GitHubMutationFields,
  RepositoryDetail,
  RepositoryWikiResult,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { MarkdownBody, markdownWikiUrlContext } from "../../MarkdownBody";
import { useControlApi } from "../../../hooks/useControlApi";
import {
  githubActionLabel,
  readAvailabilityMessage,
  readAvailabilityStatusLabel,
  repositoryPath
} from "../repositoryUi";

const defaultWikiPageLimit = 50;
const maxWikiPageLimit = 100;

export interface WikiTabProps {
  githubReady: boolean;
  repository: RepositoryDetail;
  focusedPagePath: string | null;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onOpenExternal(url: string): void;
  onSelectWikiPage(page: WikiPageSummary | WikiPageContent): void;
}

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
  const wikiQueryKeys = queryClient
    .getQueriesData<RepositoryWikiResult>({ queryKey: ["repository-wiki", owner, repo] })
    .map(([queryKey]) => queryKey)
    .filter(
      (queryKey): queryKey is ReturnType<typeof wikiTabQueryKey> =>
        queryKey[0] === "repository-wiki" &&
        queryKey[1] === owner &&
        queryKey[2] === repo &&
        typeof queryKey[3] === "string" &&
        typeof queryKey[4] === "number"
    );
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

export function WikiTab({
  githubReady,
  repository,
  focusedPagePath,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onMutate,
  onOpenExternal,
  onSelectWikiPage
}: WikiTabProps): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [wikiPageLimit, setWikiPageLimit] = useState(defaultWikiPageLimit);
  const [wikiFormMode, setWikiFormMode] = useState<"create" | "edit">("create");
  const [wikiPageTitle, setWikiPageTitle] = useState("");
  const [wikiPageContent, setWikiPageContent] = useState("");
  const wikiFeature = repository.administration?.features.wiki ?? null;
  const { wiki } = useWikiTabQueries({
    owner: repository.owner,
    repo: repository.name,
    focusedPagePath,
    pageLimit: wikiPageLimit,
    enabled: wikiFeature !== false,
    githubReady
  });
  const wikiAvailabilityMessage = readAvailabilityMessage("Repository wiki", wiki.data?.availability ?? null);
  const wikiAvailabilityStatus = wiki.data?.availability.status ?? null;
  const wikiErrorMessage = !wiki.data && wiki.error ? `Wiki unavailable: ${wiki.error.message}` : null;
  const wikiAvailable = wikiErrorMessage
    ? false
    : wikiAvailabilityStatus
      ? wikiAvailabilityStatus === "available"
      : wikiFeature === true;
  const wikiUnavailableReason =
    wikiAvailabilityMessage ?? "Wiki availability is unknown for this repository.";
  const wikiStatus =
    wikiFeature === false
      ? "Wiki is disabled for this repository."
      : wikiErrorMessage
        ? wikiErrorMessage
        : wikiAvailable
          ? "Wiki is available for this repository."
          : wikiAvailabilityStatus
            ? wikiUnavailableReason
            : wiki.isLoading
              ? "Checking wiki availability for this repository."
              : "Wiki availability is unknown for this repository.";
  const wikiCloneUrl = `${repository.htmlUrl}.wiki.git`;
  const wikiActionDisabledReason =
    wikiFeature === false
      ? "Wiki is disabled for this repository."
      : wikiErrorMessage
        ? wikiErrorMessage
        : !wikiAvailable
          ? wikiUnavailableReason
          : null;

  async function copyWikiCloneUrl(): Promise<void> {
    if (wikiActionDisabledReason) {
      setCopyStatus(wikiActionDisabledReason);
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("Clipboard unavailable.");
      return;
    }

    try {
      await navigator.clipboard.writeText(wikiCloneUrl);
      setCopyStatus("Wiki clone URL copied.");
    } catch {
      setCopyStatus("Could not copy wiki clone URL.");
    }
  }

  const pages = wiki.data?.pages ?? [];
  const wikiPageLimitHit = pages.length >= wikiPageLimit;
  const canExpandWikiPages = wikiPageLimitHit && wikiPageLimit < maxWikiPageLimit;
  const selectedPage = wiki.data?.selectedPage ?? null;
  const wikiMarkdownUrlContext = selectedPage
    ? markdownWikiUrlContext(repository, selectedPage.path, selectedPage.htmlUrl)
    : undefined;
  const wikiMutationAction =
    mutationAction === "createWikiPage" ||
    mutationAction === "editWikiPage" ||
    mutationAction === "deleteWikiPage"
      ? mutationAction
      : null;
  const wikiMutationBusy = mutationPending && Boolean(wikiMutationAction);
  const wikiFormDisabledReason = !githubReady
    ? "Sign in with GitHub to change wiki pages."
    : wikiActionDisabledReason
      ? wikiActionDisabledReason
      : wikiMutationBusy
        ? "A wiki mutation is still running."
        : null;
  const wikiEditDisabledReason =
    wikiFormDisabledReason ?? (!selectedPage ? "Select a wiki page to edit." : null);
  const wikiCreateDisabledReason =
    wikiFormDisabledReason ??
    (!wikiPageTitle.trim()
      ? "Enter a wiki page title."
      : !wikiPageContent.trim()
        ? "Enter wiki page content."
        : null);
  const wikiUpdateDisabledReason =
    wikiEditDisabledReason ??
    (!wikiPageContent.trim()
      ? "Enter wiki page content."
      : selectedPage && wikiPageContent === (selectedPage.markdown ?? "")
        ? "No wiki page changes to save."
        : null);
  const wikiDeleteDisabledReason = wikiEditDisabledReason;
  const wikiSubmitDisabledReason =
    wikiFormMode === "create" ? wikiCreateDisabledReason : wikiUpdateDisabledReason;

  function resetWikiCreateForm(): void {
    setWikiFormMode("create");
    setWikiPageTitle("");
    setWikiPageContent("");
  }

  function startWikiEdit(): void {
    if (!selectedPage) {
      return;
    }

    setWikiFormMode("edit");
    setWikiPageTitle(selectedPage.title);
    setWikiPageContent(selectedPage.markdown ?? "");
  }

  function submitWikiForm(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (wikiSubmitDisabledReason) {
      return;
    }

    if (wikiFormMode === "create") {
      onMutate("createWikiPage", false, {
        title: wikiPageTitle.trim(),
        content: wikiPageContent
      });
      return;
    }

    if (!selectedPage) {
      return;
    }

    onMutate("editWikiPage", false, {
      pagePath: selectedPage.path,
      content: wikiPageContent
    });
  }

  function deleteSelectedWikiPage(): void {
    if (wikiDeleteDisabledReason || !selectedPage) {
      return;
    }

    onMutate("deleteWikiPage", true, { pagePath: selectedPage.path });
  }

  return (
    <section className="repository-settings-panel">
      <header className="settings-surface-header">
        <div>
          <h2>Repository wiki</h2>
          <p>{wikiStatus}</p>
        </div>
        <div className="surface-header-actions">
          {wiki.isFetching && pages.length > 0 && <span className="state-chip">updating</span>}
          <span className={`state-chip ${wikiAvailable ? "success" : ""}`}>
            {wikiAvailable
              ? "available"
              : wikiFeature === false
                ? "disabled"
                : wikiErrorMessage
                  ? "unavailable"
                  : (readAvailabilityStatusLabel(wiki.data?.availability ?? null) ?? "unknown")}
          </span>
        </div>
      </header>
      {wikiFeature !== false && wiki.isLoading && pages.length === 0 && (
        <div className="loading-state">Loading wiki pages…</div>
      )}
      {wikiErrorMessage && <div className="error-state">{wikiErrorMessage}</div>}
      {wikiAvailabilityMessage && <div className="error-state">{wikiAvailabilityMessage}</div>}
      {wikiFeature === false && <div className="empty-state">Wiki is disabled for this repository.</div>}
      {wikiFeature === null && !wiki.isLoading && !wiki.error && !wikiAvailabilityMessage && !wiki.data && (
        <div className="empty-state">Wiki availability is unknown for this repository.</div>
      )}
      {wikiFeature !== false &&
        !wiki.isLoading &&
        !wiki.error &&
        !wikiAvailabilityMessage &&
        pages.length === 0 && <div className="empty-state">GitHub returned no wiki pages.</div>}
      {wikiMutationBusy && wikiMutationAction && (
        <div className="mutation-feedback loading-state" role="status">
          Wiki action running: {githubActionLabel(wikiMutationAction)}.
        </div>
      )}
      {!mutationPending && mutationSucceeded && wikiMutationAction && (
        <div className="mutation-feedback success-state" role="status">
          Wiki action completed: {githubActionLabel(wikiMutationAction)}.
        </div>
      )}
      {!mutationPending && mutationError && wikiMutationAction && (
        <div className="mutation-feedback error-state" role="alert">
          Wiki action failed: {githubActionLabel(wikiMutationAction)}. {mutationError.message}
        </div>
      )}
      {pages.length > 0 && (
        <div className="wiki-browser">
          <div className="wiki-page-list" aria-label="Wiki pages">
            {pages.map((page) => (
              <button
                className={page.path === selectedPage?.path ? "selected-action" : ""}
                key={page.sha}
                type="button"
                onClick={() => onSelectWikiPage(page)}
              >
                <BookOpen size={16} />
                <span>
                  <strong>{page.title}</strong>
                  <small>{page.path}</small>
                </span>
              </button>
            ))}
          </div>
          {canExpandWikiPages && (
            <div className="table-action-row">
              <button type="button" onClick={() => setWikiPageLimit(maxWikiPageLimit)}>
                Load more wiki pages
              </button>
            </div>
          )}
          {wikiPageLimitHit && wikiPageLimit >= maxWikiPageLimit && (
            <div className="muted-row">Showing the first {pages.length} wiki pages returned by GitHub.</div>
          )}
          <article className="wiki-page-preview">
            <header>
              <h3>{selectedPage?.title ?? "Wiki page"}</h3>
              <div className="table-action-row">
                <button
                  type="button"
                  disabled={Boolean(wikiEditDisabledReason)}
                  title={wikiEditDisabledReason ?? undefined}
                  onClick={startWikiEdit}
                >
                  <BookOpen size={15} /> Edit
                </button>
                <button
                  type="button"
                  disabled={Boolean(wikiDeleteDisabledReason)}
                  title={wikiDeleteDisabledReason ?? undefined}
                  onClick={deleteSelectedWikiPage}
                >
                  <X size={15} /> Delete
                </button>
                <button
                  type="button"
                  disabled={!selectedPage?.htmlUrl}
                  title={selectedPage?.htmlUrl ? undefined : "Wiki page URL unavailable."}
                  onClick={() => {
                    if (selectedPage?.htmlUrl) {
                      onOpenExternal(selectedPage.htmlUrl);
                    }
                  }}
                >
                  <ExternalLink size={15} /> GitHub fallback
                </button>
              </div>
            </header>
            <MarkdownBody
              markdown={selectedPage?.markdown}
              emptyText="This wiki page has no markdown content."
              onOpenExternal={onOpenExternal}
              urlContext={wikiMarkdownUrlContext}
            />
          </article>
        </div>
      )}
      <form className="compose-form wiki-editor-form" onSubmit={submitWikiForm}>
        <div className="form-section-heading">
          <div>
            <h3>{wikiFormMode === "create" ? "Create wiki page" : "Edit wiki page"}</h3>
            <p>{wikiFormMode === "create" ? "Create a page in the repository wiki." : selectedPage?.path}</p>
          </div>
          <div className="table-action-row">
            <button
              className={wikiFormMode === "create" ? "selected-action" : ""}
              type="button"
              disabled={Boolean(wikiFormDisabledReason)}
              title={wikiFormDisabledReason ?? undefined}
              onClick={resetWikiCreateForm}
            >
              <Plus size={15} /> New
            </button>
            <button
              className={wikiFormMode === "edit" ? "selected-action" : ""}
              type="button"
              disabled={Boolean(wikiEditDisabledReason)}
              title={wikiEditDisabledReason ?? undefined}
              onClick={startWikiEdit}
            >
              <BookOpen size={15} /> Edit selected
            </button>
          </div>
        </div>
        <label>
          Title
          <input
            type="text"
            value={wikiPageTitle}
            disabled={wikiFormMode === "edit" || Boolean(wikiFormDisabledReason)}
            title={
              wikiFormMode === "edit"
                ? "Rename wiki pages on GitHub fallback."
                : (wikiFormDisabledReason ?? undefined)
            }
            onChange={(event) => setWikiPageTitle(event.target.value)}
            placeholder="Home"
          />
        </label>
        <label>
          Markdown
          <textarea
            value={wikiPageContent}
            disabled={Boolean(wikiFormDisabledReason)}
            title={wikiFormDisabledReason ?? undefined}
            onChange={(event) => setWikiPageContent(event.target.value)}
            placeholder="Write the wiki page markdown."
            rows={10}
          />
        </label>
        {wikiSubmitDisabledReason && (
          <small className="action-disabled-note">{wikiSubmitDisabledReason}</small>
        )}
        <div className="form-actions">
          <button
            type="submit"
            disabled={Boolean(wikiSubmitDisabledReason)}
            title={wikiSubmitDisabledReason ?? undefined}
          >
            <CheckCircle2 size={16} /> {wikiFormMode === "create" ? "Create page" : "Save page"}
          </button>
          {wikiFormMode === "edit" && (
            <button
              type="button"
              disabled={Boolean(wikiDeleteDisabledReason)}
              title={wikiDeleteDisabledReason ?? undefined}
              onClick={deleteSelectedWikiPage}
            >
              <X size={16} /> Delete page
            </button>
          )}
        </div>
      </form>
      <div className="tile-grid">
        <button
          className="project-tile"
          type="button"
          onClick={() => onOpenExternal(repositoryPath(repository, "/wiki"))}
        >
          <BookOpen size={20} />
          <strong>GitHub wiki fallback</strong>
          <small>Use the GitHub wiki fallback for {repository.nameWithOwner}.</small>
        </button>
        <button
          className="project-tile"
          type="button"
          disabled={Boolean(wikiActionDisabledReason)}
          title={wikiActionDisabledReason ?? undefined}
          onClick={() => onOpenExternal(repositoryPath(repository, "/wiki/_new"))}
        >
          <Plus size={20} />
          <strong>New wiki page on GitHub</strong>
          <small>Create or edit long-form repository documentation on GitHub.</small>
        </button>
        <button
          className="project-tile"
          type="button"
          disabled={Boolean(wikiActionDisabledReason)}
          title={wikiActionDisabledReason ?? undefined}
          onClick={() => void copyWikiCloneUrl()}
        >
          <Copy size={20} />
          <strong>Copy clone URL</strong>
          <small>{wikiCloneUrl}</small>
        </button>
      </div>
      {copyStatus && <div className="muted-row">{copyStatus}</div>}
    </section>
  );
}
