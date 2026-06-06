import { BookOpen, CheckCircle2, Copy, ExternalLink, Plus, X } from "lucide-react";
import { useReducer, type ChangeEvent, type FormEvent, type JSX } from "react";

import type {
  GitHubAction,
  GitHubMutationFields,
  GitHubReadAvailability,
  RepositoryDetail,
  WikiPageContent,
  WikiPageSummary
} from "@shared/github";
import { MarkdownBody, markdownWikiUrlContext } from "../../MarkdownBody";
import {
  githubActionLabel,
  readAvailabilityMessage,
  readAvailabilityStatusLabel,
  repositoryPath
} from "../repositoryUi";
import { defaultWikiPageLimit, useWikiTabQueries } from "./WikiTab.queries";

const maxWikiPageLimit = 100;
type WikiFormMode = "create" | "edit";

interface WikiTabState {
  copyStatus: string | null;
  wikiPageLimit: number;
  wikiFormMode: WikiFormMode;
  wikiPageTitle: string;
  wikiPageContent: string;
}

type WikiTabStateAction =
  | { type: "set-copy-status"; status: string | null }
  | { type: "set-page-limit"; limit: number }
  | { type: "set-title"; title: string }
  | { type: "set-content"; content: string }
  | { type: "reset-create-form" }
  | { type: "start-edit"; title: string; content: string };

const initialWikiTabState: WikiTabState = {
  copyStatus: null,
  wikiPageLimit: defaultWikiPageLimit,
  wikiFormMode: "create",
  wikiPageTitle: "",
  wikiPageContent: ""
};

function wikiTabStateReducer(state: WikiTabState, action: WikiTabStateAction): WikiTabState {
  switch (action.type) {
    case "set-copy-status":
      return { ...state, copyStatus: action.status };
    case "set-page-limit":
      return { ...state, wikiPageLimit: action.limit };
    case "set-title":
      return { ...state, wikiPageTitle: action.title };
    case "set-content":
      return { ...state, wikiPageContent: action.content };
    case "reset-create-form":
      return {
        ...state,
        wikiFormMode: "create",
        wikiPageTitle: "",
        wikiPageContent: ""
      };
    case "start-edit":
      return {
        ...state,
        wikiFormMode: "edit",
        wikiPageTitle: action.title,
        wikiPageContent: action.content
      };
  }
}

function WikiSurfaceHeader({
  availability,
  hasPages,
  wikiAvailable,
  wikiErrorMessage,
  wikiFeature,
  wikiStatus,
  wikiUpdating
}: {
  availability: GitHubReadAvailability | null;
  hasPages: boolean;
  wikiAvailable: boolean;
  wikiErrorMessage: string | null;
  wikiFeature: boolean | null;
  wikiStatus: string;
  wikiUpdating: boolean;
}): JSX.Element {
  return (
    <header className="settings-surface-header">
      <div>
        <h2>Repository wiki</h2>
        <p>{wikiStatus}</p>
      </div>
      <div className="surface-header-actions">
        {wikiUpdating && hasPages && <span className="state-chip">updating</span>}
        <span className={`state-chip ${wikiAvailable ? "success" : ""}`}>
          {wikiAvailable
            ? "available"
            : wikiFeature === false
              ? "disabled"
              : wikiErrorMessage
                ? "unavailable"
                : (readAvailabilityStatusLabel(availability) ?? "unknown")}
        </span>
      </div>
    </header>
  );
}

function WikiStatusMessages({
  availabilityMessage,
  hasPages,
  hasWikiData,
  selectedPageMessage,
  wikiError,
  wikiErrorMessage,
  wikiFeature,
  wikiLoading
}: {
  availabilityMessage: string | null;
  hasPages: boolean;
  hasWikiData: boolean;
  selectedPageMessage: string | null;
  wikiError: unknown;
  wikiErrorMessage: string | null;
  wikiFeature: boolean | null;
  wikiLoading: boolean;
}): JSX.Element {
  return (
    <>
      {wikiFeature !== false && wikiLoading && !hasPages && (
        <div className="loading-state">Loading wiki pages…</div>
      )}
      {selectedPageMessage && <div className="muted-row">{selectedPageMessage}</div>}
      {wikiErrorMessage && <div className="error-state">{wikiErrorMessage}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {wikiFeature === false && <div className="empty-state">Wiki is disabled for this repository.</div>}
      {wikiFeature === null && !wikiLoading && !wikiError && !availabilityMessage && !hasWikiData && (
        <div className="empty-state">Wiki availability is unknown for this repository.</div>
      )}
      {wikiFeature !== false && !wikiLoading && !wikiError && !availabilityMessage && !hasPages && (
        <div className="empty-state">GitHub returned no wiki pages.</div>
      )}
    </>
  );
}

function WikiMutationFeedback({
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  wikiMutationBusy
}: {
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  wikiMutationBusy: boolean;
}): JSX.Element | null {
  if (wikiMutationBusy && mutationAction) {
    return (
      <div className="mutation-feedback loading-state" role="status">
        Wiki action running: {githubActionLabel(mutationAction)}.
      </div>
    );
  }

  if (!mutationPending && mutationSucceeded && mutationAction) {
    return (
      <div className="mutation-feedback success-state" role="status">
        Wiki action completed: {githubActionLabel(mutationAction)}.
      </div>
    );
  }

  if (!mutationPending && mutationError && mutationAction) {
    return (
      <div className="mutation-feedback error-state" role="alert">
        Wiki action failed: {githubActionLabel(mutationAction)}. {mutationError.message}
      </div>
    );
  }

  return null;
}

function WikiPageListItem({
  page,
  selected,
  onSelectWikiPage
}: {
  page: WikiPageSummary;
  selected: boolean;
  onSelectWikiPage(page: WikiPageSummary): void;
}): JSX.Element {
  function handleSelectPage(): void {
    onSelectWikiPage(page);
  }

  return (
    <button className={selected ? "selected-action" : ""} type="button" onClick={handleSelectPage}>
      <BookOpen size={16} />
      <span>
        <strong>{page.title}</strong>
        <small>{page.path}</small>
      </span>
    </button>
  );
}

function WikiPageList({
  pages,
  selectedPage,
  onSelectWikiPage
}: {
  pages: WikiPageSummary[];
  selectedPage: WikiPageContent | null;
  onSelectWikiPage(page: WikiPageSummary): void;
}): JSX.Element {
  return (
    <div className="wiki-page-list" aria-label="Wiki pages">
      {pages.map((page) => (
        <WikiPageListItem
          key={page.sha}
          page={page}
          selected={page.path === selectedPage?.path}
          onSelectWikiPage={onSelectWikiPage}
        />
      ))}
    </div>
  );
}

function WikiPagePreview({
  deleteDisabledReason,
  editDisabledReason,
  markdownUrlContext,
  selectedPage,
  onDeleteSelectedWikiPage,
  onOpenExternal,
  onStartWikiEdit
}: {
  deleteDisabledReason: string | null;
  editDisabledReason: string | null;
  markdownUrlContext: ReturnType<typeof markdownWikiUrlContext> | undefined;
  selectedPage: WikiPageContent | null;
  onDeleteSelectedWikiPage(): void;
  onOpenExternal(url: string): void;
  onStartWikiEdit(): void;
}): JSX.Element {
  const pageFallbackDisabledReason = selectedPage?.htmlUrl ? null : "Wiki page URL unavailable.";

  function handleOpenSelectedPageFallback(): void {
    if (selectedPage?.htmlUrl) {
      onOpenExternal(selectedPage.htmlUrl);
    }
  }

  return (
    <article className="wiki-page-preview">
      <header>
        <h3>{selectedPage?.title ?? "Wiki page"}</h3>
        <div className="table-action-row">
          <button
            type="button"
            disabled={Boolean(editDisabledReason)}
            title={editDisabledReason ?? undefined}
            onClick={onStartWikiEdit}
          >
            <BookOpen size={15} /> Edit
          </button>
          <button
            type="button"
            disabled={Boolean(deleteDisabledReason)}
            title={deleteDisabledReason ?? undefined}
            onClick={onDeleteSelectedWikiPage}
          >
            <X size={15} /> Delete
          </button>
          <button
            type="button"
            disabled={Boolean(pageFallbackDisabledReason)}
            title={pageFallbackDisabledReason ?? undefined}
            onClick={handleOpenSelectedPageFallback}
          >
            <ExternalLink size={15} /> Open wiki page on GitHub
          </button>
        </div>
      </header>
      <MarkdownBody
        markdown={selectedPage?.markdown}
        emptyText="This wiki page has no markdown content."
        onOpenExternal={onOpenExternal}
        urlContext={markdownUrlContext}
      />
    </article>
  );
}

function WikiBrowser({
  canExpandWikiPages,
  deleteDisabledReason,
  editDisabledReason,
  markdownUrlContext,
  pages,
  selectedPage,
  wikiPageLimitHit,
  onDeleteSelectedWikiPage,
  onExpandWikiPages,
  onOpenExternal,
  onSelectWikiPage,
  onStartWikiEdit
}: {
  canExpandWikiPages: boolean;
  deleteDisabledReason: string | null;
  editDisabledReason: string | null;
  markdownUrlContext: ReturnType<typeof markdownWikiUrlContext> | undefined;
  pages: WikiPageSummary[];
  selectedPage: WikiPageContent | null;
  wikiPageLimitHit: boolean;
  onDeleteSelectedWikiPage(): void;
  onExpandWikiPages(): void;
  onOpenExternal(url: string): void;
  onSelectWikiPage(page: WikiPageSummary): void;
  onStartWikiEdit(): void;
}): JSX.Element {
  return (
    <div className="wiki-browser">
      <WikiPageList pages={pages} selectedPage={selectedPage} onSelectWikiPage={onSelectWikiPage} />
      {canExpandWikiPages && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandWikiPages}>
            Load more wiki pages
          </button>
        </div>
      )}
      {wikiPageLimitHit && !canExpandWikiPages && (
        <div className="muted-row">Showing the first {pages.length} wiki pages returned by GitHub.</div>
      )}
      <WikiPagePreview
        deleteDisabledReason={deleteDisabledReason}
        editDisabledReason={editDisabledReason}
        markdownUrlContext={markdownUrlContext}
        selectedPage={selectedPage}
        onDeleteSelectedWikiPage={onDeleteSelectedWikiPage}
        onOpenExternal={onOpenExternal}
        onStartWikiEdit={onStartWikiEdit}
      />
    </div>
  );
}

function WikiEditorForm({
  deleteDisabledReason,
  editDisabledReason,
  formDisabledReason,
  selectedPage,
  submitDisabledReason,
  wikiFormMode,
  wikiPageContent,
  wikiPageTitle,
  onDeleteSelectedWikiPage,
  onResetCreateForm,
  onStartWikiEdit,
  onSubmitWikiForm,
  onWikiPageContentChange,
  onWikiPageTitleChange
}: {
  deleteDisabledReason: string | null;
  editDisabledReason: string | null;
  formDisabledReason: string | null;
  selectedPage: WikiPageContent | null;
  submitDisabledReason: string | null;
  wikiFormMode: WikiFormMode;
  wikiPageContent: string;
  wikiPageTitle: string;
  onDeleteSelectedWikiPage(): void;
  onResetCreateForm(): void;
  onStartWikiEdit(): void;
  onSubmitWikiForm(): void;
  onWikiPageContentChange(content: string): void;
  onWikiPageTitleChange(title: string): void;
}): JSX.Element {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmitWikiForm();
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>): void {
    onWikiPageTitleChange(event.target.value);
  }

  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onWikiPageContentChange(event.target.value);
  }

  return (
    <form className="compose-form wiki-editor-form" onSubmit={handleSubmit}>
      <div className="form-section-heading">
        <div>
          <h3>{wikiFormMode === "create" ? "Create wiki page" : "Edit wiki page"}</h3>
          <p>{wikiFormMode === "create" ? "Create a page in the repository wiki." : selectedPage?.path}</p>
        </div>
        <div className="table-action-row">
          <button
            className={wikiFormMode === "create" ? "selected-action" : ""}
            type="button"
            disabled={Boolean(formDisabledReason)}
            title={formDisabledReason ?? undefined}
            onClick={onResetCreateForm}
          >
            <Plus size={15} /> New
          </button>
          <button
            className={wikiFormMode === "edit" ? "selected-action" : ""}
            type="button"
            disabled={Boolean(editDisabledReason)}
            title={editDisabledReason ?? undefined}
            onClick={onStartWikiEdit}
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
          disabled={wikiFormMode === "edit" || Boolean(formDisabledReason)}
          title={wikiFormMode === "edit" ? "Rename wiki pages on GitHub." : (formDisabledReason ?? undefined)}
          onChange={handleTitleChange}
          placeholder="Home"
        />
      </label>
      <label>
        Markdown
        <textarea
          value={wikiPageContent}
          disabled={Boolean(formDisabledReason)}
          title={formDisabledReason ?? undefined}
          onChange={handleContentChange}
          placeholder="Write the wiki page markdown."
          rows={10}
        />
      </label>
      {submitDisabledReason && <small className="action-disabled-note">{submitDisabledReason}</small>}
      <div className="form-actions">
        <button
          type="submit"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason ?? undefined}
        >
          <CheckCircle2 size={16} /> {wikiFormMode === "create" ? "Create page" : "Save page"}
        </button>
        {wikiFormMode === "edit" && (
          <button
            type="button"
            disabled={Boolean(deleteDisabledReason)}
            title={deleteDisabledReason ?? undefined}
            onClick={onDeleteSelectedWikiPage}
          >
            <X size={16} /> Delete page
          </button>
        )}
      </div>
    </form>
  );
}

function WikiExternalActions({
  repository,
  wikiActionDisabledReason,
  wikiCloneUrl,
  onCopyWikiCloneUrl,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  wikiActionDisabledReason: string | null;
  wikiCloneUrl: string;
  onCopyWikiCloneUrl(): Promise<void>;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function handleOpenWiki(): void {
    onOpenExternal(repositoryPath(repository, "/wiki"));
  }

  function handleOpenNewWikiPage(): void {
    onOpenExternal(repositoryPath(repository, "/wiki/_new"));
  }

  function handleCopyWikiCloneUrl(): void {
    void onCopyWikiCloneUrl();
  }

  return (
    <div className="wiki-external-actions">
      <button className="wiki-external-action" type="button" onClick={handleOpenWiki}>
        <BookOpen size={20} />
        <strong>Open wiki on GitHub</strong>
        <small>Open the repository wiki on GitHub for {repository.nameWithOwner}.</small>
      </button>
      <button
        className="wiki-external-action"
        type="button"
        disabled={Boolean(wikiActionDisabledReason)}
        title={wikiActionDisabledReason ?? undefined}
        onClick={handleOpenNewWikiPage}
      >
        <Plus size={20} />
        <strong>New wiki page on GitHub</strong>
        <small>Create or edit long-form repository documentation on GitHub.</small>
      </button>
      <button
        className="wiki-external-action"
        type="button"
        disabled={Boolean(wikiActionDisabledReason)}
        title={wikiActionDisabledReason ?? undefined}
        onClick={handleCopyWikiCloneUrl}
      >
        <Copy size={20} />
        <strong>Copy clone URL</strong>
        <small>{wikiCloneUrl}</small>
      </button>
    </div>
  );
}

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
  const [wikiState, dispatchWikiState] = useReducer(wikiTabStateReducer, initialWikiTabState);
  const { copyStatus, wikiFormMode, wikiPageContent, wikiPageLimit, wikiPageTitle } = wikiState;
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
      dispatchWikiState({ type: "set-copy-status", status: wikiActionDisabledReason });
      return;
    }
    if (!navigator.clipboard?.writeText) {
      dispatchWikiState({ type: "set-copy-status", status: "Clipboard unavailable." });
      return;
    }

    try {
      await navigator.clipboard.writeText(wikiCloneUrl);
      dispatchWikiState({ type: "set-copy-status", status: "Wiki clone URL copied." });
    } catch {
      dispatchWikiState({ type: "set-copy-status", status: "Could not copy wiki clone URL." });
    }
  }

  const pages = wiki.data?.pages ?? [];
  const wikiPageLimitHit = pages.length >= wikiPageLimit;
  const canExpandWikiPages = wikiPageLimitHit && wikiPageLimit < maxWikiPageLimit;
  const selectedPage = wiki.data?.selectedPage ?? null;
  const selectedPageMessage =
    focusedPagePath && wiki.data && selectedPage?.path !== focusedPagePath
      ? `Selected wiki page ${focusedPagePath} is not loaded. Showing ${selectedPage?.title ?? "the first returned page"}.`
      : null;
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

  function expandWikiPages(): void {
    dispatchWikiState({ type: "set-page-limit", limit: maxWikiPageLimit });
  }

  function resetWikiCreateForm(): void {
    dispatchWikiState({ type: "reset-create-form" });
  }

  function startWikiEdit(): void {
    if (!selectedPage) {
      return;
    }

    dispatchWikiState({
      type: "start-edit",
      title: selectedPage.title,
      content: selectedPage.markdown ?? ""
    });
  }

  function updateWikiPageTitle(title: string): void {
    dispatchWikiState({ type: "set-title", title });
  }

  function updateWikiPageContent(content: string): void {
    dispatchWikiState({ type: "set-content", content });
  }

  function submitWikiForm(): void {
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
    <section className="repository-settings-panel wiki-tab-surface">
      <WikiSurfaceHeader
        availability={wiki.data?.availability ?? null}
        hasPages={pages.length > 0}
        wikiAvailable={wikiAvailable}
        wikiErrorMessage={wikiErrorMessage}
        wikiFeature={wikiFeature}
        wikiStatus={wikiStatus}
        wikiUpdating={wiki.isFetching}
      />
      <WikiStatusMessages
        availabilityMessage={wikiAvailabilityMessage}
        hasPages={pages.length > 0}
        hasWikiData={Boolean(wiki.data)}
        selectedPageMessage={selectedPageMessage}
        wikiError={wiki.error}
        wikiErrorMessage={wikiErrorMessage}
        wikiFeature={wikiFeature}
        wikiLoading={wiki.isLoading}
      />
      <WikiMutationFeedback
        mutationAction={wikiMutationAction}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        wikiMutationBusy={wikiMutationBusy}
      />
      <div className="wiki-workspace">
        {pages.length > 0 ? (
          <WikiBrowser
            canExpandWikiPages={canExpandWikiPages}
            deleteDisabledReason={wikiDeleteDisabledReason}
            editDisabledReason={wikiEditDisabledReason}
            markdownUrlContext={wikiMarkdownUrlContext}
            pages={pages}
            selectedPage={selectedPage}
            wikiPageLimitHit={wikiPageLimitHit}
            onDeleteSelectedWikiPage={deleteSelectedWikiPage}
            onExpandWikiPages={expandWikiPages}
            onOpenExternal={onOpenExternal}
            onSelectWikiPage={onSelectWikiPage}
            onStartWikiEdit={startWikiEdit}
          />
        ) : (
          <div className="wiki-empty-browser">
            <div className="empty-state">Wiki pages will appear here when GitHub returns them.</div>
          </div>
        )}
        <aside className="wiki-side-panel">
          <WikiEditorForm
            deleteDisabledReason={wikiDeleteDisabledReason}
            editDisabledReason={wikiEditDisabledReason}
            formDisabledReason={wikiFormDisabledReason}
            selectedPage={selectedPage}
            submitDisabledReason={wikiSubmitDisabledReason}
            wikiFormMode={wikiFormMode}
            wikiPageContent={wikiPageContent}
            wikiPageTitle={wikiPageTitle}
            onDeleteSelectedWikiPage={deleteSelectedWikiPage}
            onResetCreateForm={resetWikiCreateForm}
            onStartWikiEdit={startWikiEdit}
            onSubmitWikiForm={submitWikiForm}
            onWikiPageContentChange={updateWikiPageContent}
            onWikiPageTitleChange={updateWikiPageTitle}
          />
          <WikiExternalActions
            repository={repository}
            wikiActionDisabledReason={wikiActionDisabledReason}
            wikiCloneUrl={wikiCloneUrl}
            onCopyWikiCloneUrl={copyWikiCloneUrl}
            onOpenExternal={onOpenExternal}
          />
          <div className="muted-row wiki-copy-status" aria-live="polite">
            {copyStatus}
          </div>
        </aside>
      </div>
    </section>
  );
}
