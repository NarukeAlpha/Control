import { ChevronDown, Download, ExternalLink, Plus, Tag } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent, type JSX } from "react";

import type {
  GitHubAction,
  GitHubMutationFields,
  ReleaseAssetSummary,
  ReleaseSummary,
  RepositoryDetail
} from "@shared/github";

import { MarkdownBody, markdownRepositoryUrlContext } from "@renderer/components/MarkdownBody";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryMutationDisabledReason,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";

import { useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
import { useReleasesTabQueries } from "./ReleasesTab.queries";

type ReleaseMakeLatestOption = "unchanged" | "true" | "false" | "legacy";
type ReleaseFormMode = "create" | "edit";

const maxReleasesLimit = 100;
const releaseMakeLatestOptions: Array<{ value: ReleaseMakeLatestOption; label: string }> = [
  { value: "unchanged", label: "Keep latest behavior" },
  { value: "true", label: "Mark as latest" },
  { value: "false", label: "Do not mark latest" },
  { value: "legacy", label: "Use GitHub legacy rules" }
];

interface ReleasesTabProps {
  repository: RepositoryDetail;
  githubReady: boolean;
  selectedRef: string | null;
  refListLimit: number;
  releasesLimit: number;
  focusedReleaseId: number | null;
  focusedReleaseTagName: string | null;
  focusedReleaseAssetId: number | null;
  initialCreating: boolean;
  onOpenExternal(url: string): void;
  onOpenReleaseTarget(ref: string): void;
  onSelectRelease(release: ReleaseSummary): void;
  onSelectReleaseAsset(release: ReleaseSummary, asset: ReleaseAssetSummary): void;
  onExpandReleases(): void;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}

interface ReleaseTargetOption {
  label: string;
  group: string;
}

interface ReleaseFormSubmitInput {
  payload: GitHubMutationFields;
  dangerous: boolean;
}

function ReleaseMutationStatus({
  active,
  action,
  mutationPending,
  mutationSucceeded,
  mutationError,
  runningMessage
}: {
  active: boolean;
  action: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  runningMessage: string;
}): JSX.Element | null {
  if (!active || !action) {
    return null;
  }

  if (mutationPending) {
    return <div className="loading-state">{runningMessage}</div>;
  }

  if (mutationSucceeded) {
    return (
      <div className="success-state">{githubActionLabel(action)} completed. Release data is refreshing.</div>
    );
  }

  if (mutationError) {
    return (
      <div className="error-state">
        {githubActionLabel(action)} failed: {mutationError.message}
      </div>
    );
  }

  return null;
}

function ReleasesToolbar({
  disabledReason,
  onCreateRelease,
  onOpenReleasesFallback
}: {
  disabledReason: string | null;
  onCreateRelease(): void;
  onOpenReleasesFallback(): void;
}): JSX.Element {
  return (
    <div className="table-action-row surface-filter-row">
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={onCreateRelease}
      >
        <Plus size={16} /> New release
      </button>
      <button type="button" onClick={onOpenReleasesFallback}>
        <ExternalLink size={16} /> Open on GitHub
      </button>
    </div>
  );
}

function ReleaseListRow({
  active,
  release,
  onOpenExternal,
  onSelectRelease
}: {
  active: boolean;
  release: ReleaseSummary;
  onOpenExternal(url: string): void;
  onSelectRelease(release: ReleaseSummary): void;
}): JSX.Element {
  const releaseTitle = release.name || release.tagName;
  const hasReleaseNotes = Boolean(release.body?.trim());

  function handleSelectRelease(): void {
    onSelectRelease(release);
  }

  function handleOpenFallback(): void {
    onOpenExternal(release.htmlUrl);
  }

  return (
    <div className={`issue-row thread-list-action-row ${active ? "active" : ""}`}>
      <button className="thread-list-row-main" type="button" onClick={handleSelectRelease}>
        <Tag size={17} />
        <div>
          <strong>{releaseTitle}</strong>
          <small>
            {release.tagName} · {release.targetCommitish ? `${release.targetCommitish} · ` : ""}
            {release.publishedAt
              ? `published ${formatRelativeDate(release.publishedAt)}`
              : "not published"} · {release.assets.length} {release.assets.length === 1 ? "asset" : "assets"}
          </small>
        </div>
        <span className={`state-chip ${release.isDraft ? "" : "success"}`}>
          {release.isDraft ? "draft" : "published"}
        </span>
        {release.isPrerelease && <span className="state-chip">prerelease</span>}
        {hasReleaseNotes && <span className="state-chip">notes</span>}
      </button>
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open ${releaseTitle} on GitHub`}
        title={`Open ${releaseTitle} on GitHub`}
        onClick={handleOpenFallback}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function ReleaseList({
  availabilityMessage,
  canExpandReleases,
  creating,
  error,
  loading,
  releases,
  releasesLimitHit,
  selectedRelease,
  onExpandReleases,
  onOpenExternal,
  onSelectRelease
}: {
  availabilityMessage: string | null;
  canExpandReleases: boolean;
  creating: boolean;
  error: Error | null;
  loading: boolean;
  releases: ReleaseSummary[];
  releasesLimitHit: boolean;
  selectedRelease: ReleaseSummary | null;
  onExpandReleases(): void;
  onOpenExternal(url: string): void;
  onSelectRelease(release: ReleaseSummary): void;
}): JSX.Element {
  return (
    <div className="thread-list">
      {loading && releases.length === 0 && <div className="loading-state">Loading releases…</div>}
      {error && <div className="error-state">Releases unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {canExpandReleases && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandReleases}>
            <ChevronDown size={16} /> Load more releases
          </button>
        </div>
      )}
      {!canExpandReleases && releasesLimitHit && (
        <div className="muted-row">Showing the first {releases.length} releases returned by GitHub.</div>
      )}
      {releases.map((release) => (
        <ReleaseListRow
          active={selectedRelease?.id === release.id && !creating}
          key={release.id}
          release={release}
          onOpenExternal={onOpenExternal}
          onSelectRelease={onSelectRelease}
        />
      ))}
      {!loading && !error && !availabilityMessage && releases.length === 0 && (
        <div className="empty-state">No releases returned.</div>
      )}
    </div>
  );
}

function ReleaseForm({
  controlDisabledReason,
  defaultReleaseTarget,
  draft,
  makeLatest,
  mode,
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  prerelease,
  refsAvailabilityMessage,
  refsError,
  releaseBody,
  releaseName,
  selectedRelease,
  submitDisabledReason,
  submittedReleaseAction,
  tagName,
  targetCommitish,
  targetListId,
  targetOptions,
  onCancel,
  onDraftChange,
  onMakeLatestChange,
  onPrereleaseChange,
  onReleaseBodyChange,
  onReleaseNameChange,
  onSubmit,
  onTagNameChange,
  onTargetCommitishChange
}: {
  controlDisabledReason: string | null;
  defaultReleaseTarget: string;
  draft: boolean;
  makeLatest: ReleaseMakeLatestOption;
  mode: ReleaseFormMode;
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  prerelease: boolean;
  refsAvailabilityMessage: string | null;
  refsError: Error | null;
  releaseBody: string;
  releaseName: string;
  selectedRelease: ReleaseSummary | null;
  submitDisabledReason: string | null;
  submittedReleaseAction: GitHubAction | null;
  tagName: string;
  targetCommitish: string;
  targetListId: string;
  targetOptions: ReleaseTargetOption[];
  onCancel(): void;
  onDraftChange(value: boolean): void;
  onMakeLatestChange(value: ReleaseMakeLatestOption): void;
  onPrereleaseChange(value: boolean): void;
  onReleaseBodyChange(value: string): void;
  onReleaseNameChange(value: string): void;
  onSubmit(input: ReleaseFormSubmitInput): void;
  onTagNameChange(value: string): void;
  onTargetCommitishChange(value: string): void;
}): JSX.Element {
  const formAction: GitHubAction = mode === "create" ? "createRelease" : "editRelease";
  const mutationActive = submittedReleaseAction === formAction && mutationAction === formAction;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submitDisabledReason) {
      return;
    }

    const payload: GitHubMutationFields = {
      tag_name: tagName.trim(),
      target_commitish: targetCommitish.trim() || defaultReleaseTarget || undefined,
      name: releaseName.trim() || undefined,
      body: releaseBody,
      draft,
      prerelease
    };
    if (makeLatest !== "unchanged") {
      payload.make_latest = makeLatest;
    }

    onSubmit({
      payload,
      dangerous: mode === "create" ? !draft : Boolean(selectedRelease && selectedRelease.isDraft !== draft)
    });
  }

  function handleTagNameChange(event: ChangeEvent<HTMLInputElement>): void {
    onTagNameChange(event.target.value);
  }

  function handleTargetCommitishChange(event: ChangeEvent<HTMLInputElement>): void {
    onTargetCommitishChange(event.target.value);
  }

  function handleReleaseNameChange(event: ChangeEvent<HTMLInputElement>): void {
    onReleaseNameChange(event.target.value);
  }

  function handleReleaseBodyChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onReleaseBodyChange(event.target.value);
  }

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    onDraftChange(event.target.checked);
  }

  function handlePrereleaseChange(event: ChangeEvent<HTMLInputElement>): void {
    onPrereleaseChange(event.target.checked);
  }

  function handleMakeLatestChange(event: ChangeEvent<HTMLSelectElement>): void {
    onMakeLatestChange(event.target.value as ReleaseMakeLatestOption);
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      <h2>{mode === "create" ? "Create release" : "Edit release"}</h2>
      <ReleaseMutationStatus
        active={mutationActive}
        action={formAction}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        runningMessage={`${githubActionLabel(formAction)} is running. The form is locked until GitHub responds.`}
      />
      <input
        disabled={Boolean(controlDisabledReason)}
        title={controlDisabledReason ?? undefined}
        value={tagName}
        onChange={handleTagNameChange}
        placeholder="Release tag"
      />
      <input
        disabled={Boolean(controlDisabledReason)}
        title={controlDisabledReason ?? undefined}
        value={targetCommitish}
        list={targetListId}
        onChange={handleTargetCommitishChange}
        placeholder="Target branch, tag, or commit"
      />
      <datalist id={targetListId}>
        {targetOptions.map((option) => (
          <option key={`${option.group}-${option.label}`} value={option.label}>
            {option.group}
          </option>
        ))}
      </datalist>
      {refsError && (
        <small className="action-disabled-note">
          Branch and tag suggestions unavailable: {refsError.message}
        </small>
      )}
      {refsAvailabilityMessage && <small className="action-disabled-note">{refsAvailabilityMessage}</small>}
      <input
        disabled={Boolean(controlDisabledReason)}
        title={controlDisabledReason ?? undefined}
        value={releaseName}
        onChange={handleReleaseNameChange}
        placeholder="Release name"
      />
      <textarea
        disabled={Boolean(controlDisabledReason)}
        title={controlDisabledReason ?? undefined}
        value={releaseBody}
        onChange={handleReleaseBodyChange}
        placeholder="Release notes"
      />
      <div className="release-options">
        <label>
          <input
            checked={draft}
            disabled={Boolean(controlDisabledReason)}
            title={controlDisabledReason ?? undefined}
            type="checkbox"
            onChange={handleDraftChange}
          />
          Draft
        </label>
        <label>
          <input
            checked={prerelease}
            disabled={Boolean(controlDisabledReason)}
            title={controlDisabledReason ?? undefined}
            type="checkbox"
            onChange={handlePrereleaseChange}
          />
          Prerelease
        </label>
        <label>
          Latest
          <select
            disabled={Boolean(controlDisabledReason)}
            title={controlDisabledReason ?? undefined}
            value={makeLatest}
            onChange={handleMakeLatestChange}
          >
            {releaseMakeLatestOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <button
          className="dark-action"
          type="submit"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason ?? undefined}
        >
          <Tag size={16} /> {mode === "create" ? "Create release" : "Save release"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {submitDisabledReason && <small className="action-disabled-note">{submitDisabledReason}</small>}
      </div>
    </form>
  );
}

function ReleaseAssetRow({
  asset,
  disabledReason,
  release,
  selected,
  onDeleteAsset,
  onOpenExternal,
  onSelectReleaseAsset
}: {
  asset: ReleaseAssetSummary;
  disabledReason: string | null;
  release: ReleaseSummary;
  selected: boolean;
  onDeleteAsset(asset: ReleaseAssetSummary): void;
  onOpenExternal(url: string): void;
  onSelectReleaseAsset(release: ReleaseSummary, asset: ReleaseAssetSummary): void;
}): JSX.Element {
  function handleInspectAsset(): void {
    onSelectReleaseAsset(release, asset);
  }

  function handleDownloadAsset(): void {
    if (asset.browserDownloadUrl) {
      onOpenExternal(asset.browserDownloadUrl);
    }
  }

  function handleDeleteAsset(): void {
    onDeleteAsset(asset);
  }

  return (
    <article className={`workflow-artifact-row ${selected ? "active" : ""}`}>
      <div>
        <strong>{asset.name}</strong>
        <small>
          {asset.label ?? asset.contentType ?? "release asset"} · {formatCompactNumber(asset.sizeInBytes)}{" "}
          bytes · {formatCompactNumber(asset.downloadCount)} downloads
        </small>
      </div>
      <span className="state-chip">{asset.state ?? "asset"}</span>
      <button type="button" onClick={handleInspectAsset}>
        <Download size={15} /> Inspect
      </button>
      <button
        type="button"
        disabled={!asset.browserDownloadUrl}
        title={asset.browserDownloadUrl ? undefined : "Asset download URL unavailable."}
        onClick={handleDownloadAsset}
      >
        <ExternalLink size={15} /> Download
      </button>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={handleDeleteAsset}
      >
        Delete asset
      </button>
    </article>
  );
}

function ReleaseAssetsPanel({
  disabledReason,
  release,
  selectedReleaseAsset,
  onDeleteAsset,
  onOpenExternal,
  onSelectReleaseAsset
}: {
  disabledReason: string | null;
  release: ReleaseSummary;
  selectedReleaseAsset: ReleaseAssetSummary | null;
  onDeleteAsset(asset: ReleaseAssetSummary): void;
  onOpenExternal(url: string): void;
  onSelectReleaseAsset(release: ReleaseSummary, asset: ReleaseAssetSummary): void;
}): JSX.Element {
  return (
    <section className="workflow-detail-grid">
      <div>
        <h3>Assets</h3>
        {release.assets.length === 0 && <div className="empty-state">No release assets uploaded.</div>}
        {selectedReleaseAsset && (
          <div className="workflow-summary release-asset-summary">
            <span>Asset id {selectedReleaseAsset.id}</span>
            <span>{selectedReleaseAsset.contentType ?? "Type unknown"}</span>
            <span>{formatCompactNumber(selectedReleaseAsset.sizeInBytes)} bytes</span>
            <span>{formatCompactNumber(selectedReleaseAsset.downloadCount)} downloads</span>
            <span>
              {selectedReleaseAsset.updatedAt
                ? `Updated ${formatRelativeDate(selectedReleaseAsset.updatedAt)}`
                : "Update time unknown"}
            </span>
          </div>
        )}
        {release.assets.map((asset) => (
          <ReleaseAssetRow
            asset={asset}
            disabledReason={disabledReason}
            key={asset.id}
            release={release}
            selected={selectedReleaseAsset?.id === asset.id}
            onDeleteAsset={onDeleteAsset}
            onOpenExternal={onOpenExternal}
            onSelectReleaseAsset={onSelectReleaseAsset}
          />
        ))}
      </div>
    </section>
  );
}

function ReleaseDetail({
  disabledReason,
  mutationAction,
  mutationActive,
  mutationError,
  mutationPending,
  mutationSucceeded,
  release,
  repository,
  selectedReleaseAsset,
  submittedReleaseAction,
  onBeginEditingRelease,
  onDeleteAsset,
  onDeleteRelease,
  onOpenExternal,
  onOpenReleaseTarget,
  onSelectReleaseAsset,
  onToggleReleaseDraft
}: {
  disabledReason: string | null;
  mutationAction: GitHubAction | null;
  mutationActive: boolean;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  release: ReleaseSummary;
  repository: RepositoryDetail;
  selectedReleaseAsset: ReleaseAssetSummary | null;
  submittedReleaseAction: GitHubAction | null;
  onBeginEditingRelease(release: ReleaseSummary): void;
  onDeleteAsset(asset: ReleaseAssetSummary): void;
  onDeleteRelease(release: ReleaseSummary): void;
  onOpenExternal(url: string): void;
  onOpenReleaseTarget(ref: string): void;
  onSelectReleaseAsset(release: ReleaseSummary, asset: ReleaseAssetSummary): void;
  onToggleReleaseDraft(release: ReleaseSummary): void;
}): JSX.Element {
  function handleOpenTarget(): void {
    if (release.targetCommitish) {
      onOpenReleaseTarget(release.targetCommitish);
    }
  }

  function handleOpenFallback(): void {
    onOpenExternal(release.htmlUrl);
  }

  function handleBeginEditingRelease(): void {
    onBeginEditingRelease(release);
  }

  function handleToggleReleaseDraft(): void {
    onToggleReleaseDraft(release);
  }

  function handleDeleteRelease(): void {
    onDeleteRelease(release);
  }

  return (
    <>
      <header className="thread-header">
        <h2>{release.name || release.tagName}</h2>
        <small>
          {release.tagName} · {release.targetCommitish ? `${release.targetCommitish} · ` : ""}
          {release.publishedAt ? `published ${formatRelativeDate(release.publishedAt)}` : "not published"}
        </small>
        <span className={`state-chip ${release.isDraft ? "" : "success"}`}>
          {release.isDraft ? "draft" : "published"}
        </span>
        {release.isPrerelease && <span className="state-chip">prerelease</span>}
      </header>
      <ReleaseMutationStatus
        active={mutationActive}
        action={submittedReleaseAction}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        runningMessage={`${githubActionLabel(mutationAction)} is running. Release data is locked until GitHub responds.`}
      />
      <div className="workflow-summary">
        <span>Release id {release.id}</span>
        <span>{release.targetCommitish ?? "Target unknown"}</span>
        <span>{release.publishedAt ? formatRelativeDate(release.publishedAt) : "Draft"}</span>
        <span>{release.assets.length} assets</span>
      </div>
      {release.body && (
        <section className="thread-body">
          <Tag size={18} />
          <MarkdownBody
            markdown={release.body}
            onOpenExternal={onOpenExternal}
            urlContext={markdownRepositoryUrlContext(
              repository,
              release.targetCommitish ?? repository.defaultBranch ?? "HEAD"
            )}
          />
        </section>
      )}
      <ReleaseAssetsPanel
        disabledReason={disabledReason}
        release={release}
        selectedReleaseAsset={selectedReleaseAsset}
        onDeleteAsset={onDeleteAsset}
        onOpenExternal={onOpenExternal}
        onSelectReleaseAsset={onSelectReleaseAsset}
      />
      <div className="thread-actions">
        <button
          type="button"
          disabled={!release.targetCommitish}
          title={
            release.targetCommitish ? undefined : "Release target branch, tag, or commit is unavailable."
          }
          onClick={handleOpenTarget}
        >
          Open target in Control
        </button>
        <button type="button" onClick={handleOpenFallback}>
          <ExternalLink size={16} /> Open on GitHub
        </button>
        <button
          type="button"
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          onClick={handleBeginEditingRelease}
        >
          Edit release
        </button>
        <button
          type="button"
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          onClick={handleToggleReleaseDraft}
        >
          {release.isDraft ? "Publish release" : "Convert to draft"}
        </button>
        <button
          type="button"
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          onClick={handleDeleteRelease}
        >
          Delete release
        </button>
        {disabledReason && <small className="action-disabled-note">{disabledReason}</small>}
      </div>
    </>
  );
}

function useReleaseInteractionState(initialCreating: boolean, defaultReleaseTarget: string) {
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);
  const [creating, setCreating] = useState(initialCreating);
  const [editingRelease, setEditingRelease] = useState(false);
  const [tagName, setTagName] = useState("");
  const [targetCommitish, setTargetCommitish] = useState(defaultReleaseTarget);
  const [releaseName, setReleaseName] = useState("");
  const [releaseBody, setReleaseBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);
  const [makeLatest, setMakeLatest] = useState<ReleaseMakeLatestOption>("unchanged");
  const [submittedReleaseAction, setSubmittedReleaseAction] = useState<GitHubAction | null>(null);

  function resetReleaseForm(): void {
    setTagName("");
    setTargetCommitish(defaultReleaseTarget);
    setReleaseName("");
    setReleaseBody("");
    setDraft(false);
    setPrerelease(false);
    setMakeLatest("unchanged");
  }

  function beginCreatingRelease(): void {
    resetReleaseForm();
    setSubmittedReleaseAction(null);
    setCreating(true);
    setEditingRelease(false);
    setSelectedReleaseId(null);
  }

  function beginEditingRelease(release: ReleaseSummary): void {
    setSubmittedReleaseAction(null);
    setTagName(release.tagName);
    setTargetCommitish(release.targetCommitish ?? defaultReleaseTarget);
    setReleaseName(release.name ?? "");
    setReleaseBody(release.body ?? "");
    setDraft(release.isDraft);
    setPrerelease(release.isPrerelease);
    setMakeLatest("unchanged");
    setSelectedReleaseId(release.id);
    setCreating(false);
    setEditingRelease(true);
  }

  function cancelReleaseForm(): void {
    resetReleaseForm();
    setSubmittedReleaseAction(null);
    setCreating(false);
    setEditingRelease(false);
  }

  function selectRelease(release: ReleaseSummary): void {
    setCreating(false);
    setEditingRelease(false);
    setSelectedReleaseId(release.id);
  }

  return {
    selectedReleaseId,
    creating,
    editingRelease,
    tagName,
    targetCommitish,
    releaseName,
    releaseBody,
    draft,
    prerelease,
    makeLatest,
    submittedReleaseAction,
    beginCreatingRelease,
    beginEditingRelease,
    cancelReleaseForm,
    selectRelease,
    setDraft,
    setMakeLatest,
    setPrerelease,
    setReleaseBody,
    setReleaseName,
    setSubmittedReleaseAction,
    setTagName,
    setTargetCommitish
  };
}

export function ReleasesTab({
  repository,
  githubReady,
  selectedRef,
  refListLimit,
  releasesLimit,
  focusedReleaseId,
  focusedReleaseTagName,
  focusedReleaseAssetId,
  initialCreating,
  onOpenExternal,
  onOpenReleaseTarget,
  onSelectRelease,
  onSelectReleaseAsset,
  onExpandReleases,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onMutate
}: ReleasesTabProps): JSX.Element {
  const { releases: releasesQuery, releaseDetail: releaseDetailQuery } = useReleasesTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: releasesLimit,
    enabled: true,
    githubReady,
    focusedReleaseId,
    focusedReleaseTagName
  });
  const {
    branchItems: branches,
    tagItems: tags,
    error: refsError,
    availabilityMessage: refsAvailabilityMessage
  } = useRepositoryRefs(repository.owner, repository.name, true, refListLimit, { githubReady });
  const releases = releasesQuery.data?.items ?? [];
  const availability = releasesQuery.data?.availability ?? null;
  const loading = releasesQuery.isLoading || releasesQuery.isFetching;
  const error = releasesQuery.error;
  const directRelease = releaseDetailQuery.data?.item ?? null;
  const releaseDetailAvailability = releaseDetailQuery.data?.availability ?? null;
  const focusedRelease =
    directRelease ??
    (focusedReleaseId !== null ? releases.find((release) => release.id === focusedReleaseId) : null) ??
    (focusedReleaseTagName ? releases.find((release) => release.tagName === focusedReleaseTagName) : null);
  const defaultReleaseTarget = selectedRef ?? repository.defaultBranch ?? "";
  const {
    selectedReleaseId,
    creating,
    editingRelease,
    tagName,
    targetCommitish,
    releaseName,
    releaseBody,
    draft,
    prerelease,
    makeLatest,
    submittedReleaseAction,
    beginCreatingRelease,
    beginEditingRelease,
    cancelReleaseForm,
    selectRelease: selectReleaseState,
    setDraft,
    setMakeLatest,
    setPrerelease,
    setReleaseBody,
    setReleaseName,
    setSubmittedReleaseAction,
    setTagName,
    setTargetCommitish
  } = useReleaseInteractionState(initialCreating, defaultReleaseTarget);
  const selectedRelease =
    (selectedReleaseId !== null ? releases.find((release) => release.id === selectedReleaseId) : null) ??
    focusedRelease ??
    releases[0] ??
    null;
  const selectedReleaseAsset =
    selectedRelease && focusedReleaseAssetId !== null
      ? (selectedRelease.assets.find((asset) => asset.id === focusedReleaseAssetId) ?? null)
      : null;
  const liveReleaseDisabledReason = !githubReady ? "Sign in with GitHub to change releases." : null;
  const releaseMutationDisabledReason =
    liveReleaseDisabledReason ?? repositoryMutationDisabledReason(repository);
  const releaseMutationAction =
    mutationAction === "createRelease" ||
    mutationAction === "editRelease" ||
    mutationAction === "deleteRelease" ||
    mutationAction === "deleteReleaseAsset"
      ? mutationAction
      : null;
  const releaseActionPendingReason =
    mutationPending && releaseMutationAction
      ? `${githubActionLabel(releaseMutationAction)} is still running.`
      : null;
  const releaseControlDisabledReason = releaseActionPendingReason ?? releaseMutationDisabledReason;
  const releaseFormMode = creating ? "create" : editingRelease && selectedRelease ? "edit" : null;
  const releaseFormSubmitDisabledReason =
    releaseActionPendingReason ??
    releaseMutationDisabledReason ??
    (!tagName.trim() ? "Release tag is required." : null);
  const releaseFormControlDisabledReason = releaseActionPendingReason ?? releaseMutationDisabledReason;
  const releaseTargetOptions = [
    ...branches.map((branch) => ({ label: branch.name, group: "Branches" })),
    ...tags.map((tag) => ({ label: tag.name, group: "Tags" }))
  ];
  const releasesLimitHit = releases.length >= releasesLimit;
  const canExpandReleases = releasesLimitHit && releasesLimit < maxReleasesLimit;
  const availabilityMessage = readAvailabilityMessage("Releases", availability);
  const releaseDetailAvailabilityMessage = readAvailabilityMessage(
    "Release detail",
    releaseDetailAvailability
  );

  function submitReleaseMutation(
    action: GitHubAction,
    dangerous: boolean,
    payload?: GitHubMutationFields
  ): void {
    setSubmittedReleaseAction(action);
    onMutate(action, dangerous, payload);
  }

  const releaseMutationStatusActive =
    submittedReleaseAction !== null && releaseMutationAction === submittedReleaseAction;

  function openReleasesFallback(): void {
    onOpenExternal(repositoryPath(repository, "/releases"));
  }

  function selectRelease(release: ReleaseSummary): void {
    selectReleaseState(release);
    onSelectRelease(release);
  }

  function submitReleaseForm({ payload, dangerous }: ReleaseFormSubmitInput): void {
    if (releaseFormMode === "create") {
      submitReleaseMutation("createRelease", dangerous, payload);
    } else if (selectedRelease) {
      submitReleaseMutation("editRelease", dangerous, {
        releaseId: selectedRelease.id,
        ...payload
      });
    }
  }

  function deleteReleaseAsset(asset: ReleaseAssetSummary): void {
    submitReleaseMutation("deleteReleaseAsset", true, { assetId: asset.id });
  }

  function toggleReleaseDraft(release: ReleaseSummary): void {
    submitReleaseMutation("editRelease", true, {
      releaseId: release.id,
      draft: !release.isDraft
    });
  }

  function deleteRelease(release: ReleaseSummary): void {
    submitReleaseMutation("deleteRelease", true, { releaseId: release.id });
  }

  return (
    <section className="table-panel github-surface">
      <ReleasesToolbar
        disabledReason={releaseControlDisabledReason}
        onCreateRelease={beginCreatingRelease}
        onOpenReleasesFallback={openReleasesFallback}
      />
      <div className="github-split">
        <ReleaseList
          availabilityMessage={availabilityMessage}
          canExpandReleases={canExpandReleases}
          creating={creating}
          error={error}
          loading={loading}
          releases={releases}
          releasesLimitHit={releasesLimitHit}
          selectedRelease={selectedRelease}
          onExpandReleases={onExpandReleases}
          onOpenExternal={onOpenExternal}
          onSelectRelease={selectRelease}
        />
        <div className="thread-detail">
          {releaseFormMode ? (
            <ReleaseForm
              controlDisabledReason={releaseFormControlDisabledReason}
              defaultReleaseTarget={defaultReleaseTarget}
              draft={draft}
              makeLatest={makeLatest}
              mode={releaseFormMode}
              mutationAction={mutationAction}
              mutationError={mutationError}
              mutationPending={mutationPending}
              mutationSucceeded={mutationSucceeded}
              prerelease={prerelease}
              refsAvailabilityMessage={refsAvailabilityMessage}
              refsError={refsError}
              releaseBody={releaseBody}
              releaseName={releaseName}
              selectedRelease={selectedRelease}
              submitDisabledReason={releaseFormSubmitDisabledReason}
              submittedReleaseAction={submittedReleaseAction}
              tagName={tagName}
              targetCommitish={targetCommitish}
              targetListId={`release-target-refs-${repository.id}`}
              targetOptions={releaseTargetOptions}
              onCancel={cancelReleaseForm}
              onDraftChange={setDraft}
              onMakeLatestChange={setMakeLatest}
              onPrereleaseChange={setPrerelease}
              onReleaseBodyChange={setReleaseBody}
              onReleaseNameChange={setReleaseName}
              onSubmit={submitReleaseForm}
              onTagNameChange={setTagName}
              onTargetCommitishChange={setTargetCommitish}
            />
          ) : selectedRelease ? (
            <ReleaseDetail
              disabledReason={releaseControlDisabledReason}
              mutationAction={releaseMutationAction}
              mutationActive={releaseMutationStatusActive}
              mutationError={mutationError}
              mutationPending={mutationPending}
              mutationSucceeded={mutationSucceeded}
              release={selectedRelease}
              repository={repository}
              selectedReleaseAsset={selectedReleaseAsset}
              submittedReleaseAction={submittedReleaseAction}
              onBeginEditingRelease={beginEditingRelease}
              onDeleteAsset={deleteReleaseAsset}
              onDeleteRelease={deleteRelease}
              onOpenExternal={onOpenExternal}
              onOpenReleaseTarget={onOpenReleaseTarget}
              onSelectReleaseAsset={onSelectReleaseAsset}
              onToggleReleaseDraft={toggleReleaseDraft}
            />
          ) : (
            <div className="empty-state">
              {releaseDetailQuery.isLoading || releaseDetailQuery.isFetching
                ? "Loading release detail…"
                : (releaseDetailAvailabilityMessage ?? "Select a release to inspect.")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
