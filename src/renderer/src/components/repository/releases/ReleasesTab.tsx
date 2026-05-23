import { ChevronDown, Download, ExternalLink, Plus, Tag } from "lucide-react";
import { useState, type JSX } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  GitHubAction,
  GitHubMutationFields,
  ReleaseListResult,
  ReleaseAssetSummary,
  ReleaseSummary,
  RepositoryDetail
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { MarkdownBody, markdownRepositoryUrlContext } from "@renderer/components/MarkdownBody";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryMutationDisabledReason,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";

import { useControlApi } from "@renderer/hooks/useControlApi";
import { useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
type ReleaseMakeLatestOption = "unchanged" | "true" | "false" | "legacy";
const maxReleasesLimit = 100;
const releaseMakeLatestOptions: Array<{ value: ReleaseMakeLatestOption; label: string }> = [
  { value: "unchanged", label: "Keep latest behavior" },
  { value: "true", label: "Mark as latest" },
  { value: "false", label: "Do not mark latest" },
  { value: "legacy", label: "Use GitHub legacy rules" }
];

export interface ReleasesTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface ReleasesTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export function releasesTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["releases", string, string, number] {
  return ["releases", owner, repo, limit] as const;
}

export function useReleasesTabQueries({ owner, repo, limit, enabled, githubReady }: ReleasesTabQueryInput) {
  const api = useControlApi();

  const releases = useQuery<ReleaseListResult>({
    queryKey: releasesTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listReleasesWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  return { releases };
}

export async function prefetchReleasesTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ReleasesTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: releasesTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listReleasesWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    staleTime: 120_000
  });
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
}: {
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
}): JSX.Element {
  const { releases: releasesQuery } = useReleasesTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: releasesLimit,
    enabled: true,
    githubReady
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
  const focusedRelease =
    (focusedReleaseId !== null ? releases.find((release) => release.id === focusedReleaseId) : null) ??
    (focusedReleaseTagName ? releases.find((release) => release.tagName === focusedReleaseTagName) : null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);
  const defaultReleaseTarget = selectedRef ?? repository.defaultBranch ?? "";
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
  const releaseFormAction = releaseFormMode === "create" ? "createRelease" : "editRelease";
  const releaseFormMutationActive =
    submittedReleaseAction === releaseFormAction && mutationAction === releaseFormAction;
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

  return (
    <section className="table-panel github-surface">
      <div className="table-action-row surface-filter-row">
        <button
          type="button"
          disabled={Boolean(releaseControlDisabledReason)}
          title={releaseControlDisabledReason ?? undefined}
          onClick={beginCreatingRelease}
        >
          <Plus size={16} /> New release
        </button>
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/releases"))}>
          <ExternalLink size={16} /> GitHub fallback
        </button>
      </div>
      <div className="github-split">
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
          {releases.map((release) => {
            const hasReleaseNotes = Boolean(release.body?.trim());

            return (
              <div
                className={`issue-row thread-list-action-row ${
                  selectedRelease?.id === release.id && !creating ? "active" : ""
                }`}
                key={release.id}
              >
                <button
                  className="thread-list-row-main"
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditingRelease(false);
                    setSelectedReleaseId(release.id);
                    onSelectRelease(release);
                  }}
                >
                  <Tag size={17} />
                  <div>
                    <strong>{release.name || release.tagName}</strong>
                    <small>
                      {release.tagName} · {release.targetCommitish ? `${release.targetCommitish} · ` : ""}
                      {release.publishedAt
                        ? `published ${formatRelativeDate(release.publishedAt)}`
                        : "not published"}{" "}
                      · {release.assets.length} {release.assets.length === 1 ? "asset" : "assets"}
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
                  aria-label={`Open GitHub fallback for ${release.name || release.tagName}`}
                  title={`Open GitHub fallback for ${release.name || release.tagName}`}
                  onClick={() => onOpenExternal(release.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </div>
            );
          })}
          {!loading && !error && !availabilityMessage && releases.length === 0 && (
            <div className="empty-state">No releases returned.</div>
          )}
        </div>

        <div className="thread-detail">
          {releaseFormMode ? (
            <form
              className="compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (releaseFormSubmitDisabledReason) {
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
                const releaseFormDangerous =
                  releaseFormMode === "create"
                    ? !draft
                    : Boolean(selectedRelease && selectedRelease.isDraft !== draft);

                if (releaseFormMode === "create") {
                  setSubmittedReleaseAction("createRelease");
                  onMutate("createRelease", releaseFormDangerous, payload);
                } else if (selectedRelease) {
                  setSubmittedReleaseAction("editRelease");
                  onMutate("editRelease", releaseFormDangerous, {
                    releaseId: selectedRelease.id,
                    ...payload
                  });
                }
              }}
            >
              <h2>{releaseFormMode === "create" ? "Create release" : "Edit release"}</h2>
              {releaseFormMutationActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel(releaseFormAction)} is running. The form is locked until GitHub responds.
                </div>
              )}
              {releaseFormMutationActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel(releaseFormAction)} completed. Release data is refreshing.
                </div>
              )}
              {releaseFormMutationActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel(releaseFormAction)} failed: {mutationError.message}
                </div>
              )}
              <input
                disabled={Boolean(releaseFormControlDisabledReason)}
                title={releaseFormControlDisabledReason ?? undefined}
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                placeholder="Release tag"
              />
              <input
                disabled={Boolean(releaseFormControlDisabledReason)}
                title={releaseFormControlDisabledReason ?? undefined}
                value={targetCommitish}
                list={`release-target-refs-${repository.id}`}
                onChange={(event) => setTargetCommitish(event.target.value)}
                placeholder="Target branch, tag, or commit"
              />
              <datalist id={`release-target-refs-${repository.id}`}>
                {releaseTargetOptions.map((option) => (
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
              {refsAvailabilityMessage && (
                <small className="action-disabled-note">{refsAvailabilityMessage}</small>
              )}
              <input
                disabled={Boolean(releaseFormControlDisabledReason)}
                title={releaseFormControlDisabledReason ?? undefined}
                value={releaseName}
                onChange={(event) => setReleaseName(event.target.value)}
                placeholder="Release name"
              />
              <textarea
                disabled={Boolean(releaseFormControlDisabledReason)}
                title={releaseFormControlDisabledReason ?? undefined}
                value={releaseBody}
                onChange={(event) => setReleaseBody(event.target.value)}
                placeholder="Release notes"
              />
              <div className="release-options">
                <label>
                  <input
                    checked={draft}
                    disabled={Boolean(releaseFormControlDisabledReason)}
                    title={releaseFormControlDisabledReason ?? undefined}
                    type="checkbox"
                    onChange={(event) => setDraft(event.target.checked)}
                  />
                  Draft
                </label>
                <label>
                  <input
                    checked={prerelease}
                    disabled={Boolean(releaseFormControlDisabledReason)}
                    title={releaseFormControlDisabledReason ?? undefined}
                    type="checkbox"
                    onChange={(event) => setPrerelease(event.target.checked)}
                  />
                  Prerelease
                </label>
                <label>
                  Latest
                  <select
                    disabled={Boolean(releaseFormControlDisabledReason)}
                    title={releaseFormControlDisabledReason ?? undefined}
                    value={makeLatest}
                    onChange={(event) => setMakeLatest(event.target.value as ReleaseMakeLatestOption)}
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
                  disabled={Boolean(releaseFormSubmitDisabledReason)}
                  title={releaseFormSubmitDisabledReason ?? undefined}
                >
                  <Tag size={16} /> {releaseFormMode === "create" ? "Create release" : "Save release"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetReleaseForm();
                    setSubmittedReleaseAction(null);
                    setCreating(false);
                    setEditingRelease(false);
                  }}
                >
                  Cancel
                </button>
                {releaseFormSubmitDisabledReason && (
                  <small className="action-disabled-note">{releaseFormSubmitDisabledReason}</small>
                )}
              </div>
            </form>
          ) : selectedRelease ? (
            <>
              <header className="thread-header">
                <h2>{selectedRelease.name || selectedRelease.tagName}</h2>
                <small>
                  {selectedRelease.tagName} ·{" "}
                  {selectedRelease.targetCommitish ? `${selectedRelease.targetCommitish} · ` : ""}
                  {selectedRelease.publishedAt
                    ? `published ${formatRelativeDate(selectedRelease.publishedAt)}`
                    : "not published"}
                </small>
                <span className={`state-chip ${selectedRelease.isDraft ? "" : "success"}`}>
                  {selectedRelease.isDraft ? "draft" : "published"}
                </span>
                {selectedRelease.isPrerelease && <span className="state-chip">prerelease</span>}
              </header>
              {releaseMutationStatusActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel(submittedReleaseAction)} is running. Release data is locked until GitHub
                  responds.
                </div>
              )}
              {releaseMutationStatusActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel(submittedReleaseAction)} completed. Release data is refreshing.
                </div>
              )}
              {releaseMutationStatusActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel(submittedReleaseAction)} failed: {mutationError.message}
                </div>
              )}
              <div className="workflow-summary">
                <span>Release id {selectedRelease.id}</span>
                <span>{selectedRelease.targetCommitish ?? "Target unknown"}</span>
                <span>
                  {selectedRelease.publishedAt ? formatRelativeDate(selectedRelease.publishedAt) : "Draft"}
                </span>
                <span>{selectedRelease.assets.length} assets</span>
              </div>
              {selectedRelease.body && (
                <section className="thread-body">
                  <Tag size={18} />
                  <MarkdownBody
                    markdown={selectedRelease.body}
                    onOpenExternal={onOpenExternal}
                    urlContext={markdownRepositoryUrlContext(
                      repository,
                      selectedRelease.targetCommitish ?? repository.defaultBranch ?? "HEAD"
                    )}
                  />
                </section>
              )}
              <section className="workflow-detail-grid">
                <div>
                  <h3>Assets</h3>
                  {selectedRelease.assets.length === 0 && (
                    <div className="empty-state">No release assets uploaded.</div>
                  )}
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
                  {selectedRelease.assets.map((asset) => (
                    <article
                      className={`workflow-artifact-row ${
                        selectedReleaseAsset?.id === asset.id ? "active" : ""
                      }`}
                      key={asset.id}
                    >
                      <div>
                        <strong>{asset.name}</strong>
                        <small>
                          {asset.label ?? asset.contentType ?? "release asset"} ·{" "}
                          {formatCompactNumber(asset.sizeInBytes)} bytes ·{" "}
                          {formatCompactNumber(asset.downloadCount)} downloads
                        </small>
                      </div>
                      <span className="state-chip">{asset.state ?? "asset"}</span>
                      <button type="button" onClick={() => onSelectReleaseAsset(selectedRelease, asset)}>
                        <Download size={15} /> Inspect
                      </button>
                      <button
                        type="button"
                        disabled={!asset.browserDownloadUrl}
                        title={asset.browserDownloadUrl ? undefined : "Asset download URL unavailable."}
                        onClick={() => {
                          if (asset.browserDownloadUrl) {
                            onOpenExternal(asset.browserDownloadUrl);
                          }
                        }}
                      >
                        <ExternalLink size={15} /> Download
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(releaseControlDisabledReason)}
                        title={releaseControlDisabledReason ?? undefined}
                        onClick={() =>
                          submitReleaseMutation("deleteReleaseAsset", true, {
                            assetId: asset.id
                          })
                        }
                      >
                        Delete asset
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <div className="thread-actions">
                <button
                  type="button"
                  disabled={!selectedRelease.targetCommitish}
                  title={
                    selectedRelease.targetCommitish
                      ? undefined
                      : "Release target branch, tag, or commit is unavailable."
                  }
                  onClick={() => {
                    if (selectedRelease.targetCommitish) {
                      onOpenReleaseTarget(selectedRelease.targetCommitish);
                    }
                  }}
                >
                  Open target in Control
                </button>
                <button type="button" onClick={() => onOpenExternal(selectedRelease.htmlUrl)}>
                  <ExternalLink size={16} /> GitHub fallback
                </button>
                <button
                  type="button"
                  disabled={Boolean(releaseControlDisabledReason)}
                  title={releaseControlDisabledReason ?? undefined}
                  onClick={() => beginEditingRelease(selectedRelease)}
                >
                  Edit release
                </button>
                <button
                  type="button"
                  disabled={Boolean(releaseControlDisabledReason)}
                  title={releaseControlDisabledReason ?? undefined}
                  onClick={() =>
                    submitReleaseMutation("editRelease", true, {
                      releaseId: selectedRelease.id,
                      draft: !selectedRelease.isDraft
                    })
                  }
                >
                  {selectedRelease.isDraft ? "Publish release" : "Convert to draft"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(releaseControlDisabledReason)}
                  title={releaseControlDisabledReason ?? undefined}
                  onClick={() =>
                    submitReleaseMutation("deleteRelease", true, { releaseId: selectedRelease.id })
                  }
                >
                  Delete release
                </button>
                {releaseControlDisabledReason && (
                  <small className="action-disabled-note">{releaseControlDisabledReason}</small>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              {loading ? "Loading release detail…" : "Select a release to inspect."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
