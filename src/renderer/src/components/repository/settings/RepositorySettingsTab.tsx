import { ExternalLink, GitFork } from "lucide-react";
import { useState, type JSX } from "react";

import type {
  GitHubAction,
  GitHubMutationFields,
  RepositoryCollaboratorSummary,
  RepositoryDetail,
  RepositoryTabPreference,
  RepositoryTabPreferenceKey,
  RepositoryTabPreferenceMap,
  TeamSummary
} from "@shared/github";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryForkMetadataLabel,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";

import type { RepositoryTab } from "@renderer/stores/uiStore";
import { repositoryTabPreferenceKeys, repositoryTabPreferenceLabels } from "../repositoryTabVisibility";
import { RepositoryAccessSection } from "./RepositoryAccessSection";
import { BranchProtectionSection } from "./BranchProtectionSection";
import {
  RepositoryFeatureSettingsForm,
  repositorySettingsMutationDisabledReason
} from "./RepositoryFeatureSettingsForm";
import { useRepositorySettingsTabQueries } from "./RepositorySettingsTab.queries";
import { RepositoryRulesetsSection } from "./RepositoryRulesetsSection";
import { useBranchProtectionDraft } from "./useBranchProtectionDraft";

const maxForksLimit = 100;

function repositoryStatusMutationDisabledReason(repository: RepositoryDetail): string | null {
  if (repository.permissions.isDisabled) {
    return "Repository is disabled.";
  }
  if (repository.administration.viewerPermissions.admin !== true) {
    return "Repository status changes require admin access.";
  }
  return null;
}

function readRepositoryTabPreference(value: string): RepositoryTabPreference {
  return value === "show" || value === "hide" ? value : "auto";
}

function RepositoryTabVisibilityPreferencesSection({
  preferences,
  onPreferencesChange
}: {
  preferences: RepositoryTabPreferenceMap;
  onPreferencesChange(preferences: RepositoryTabPreferenceMap): Promise<void>;
}): JSX.Element {
  const [draftState, setDraftState] = useState({ source: preferences, draft: preferences });
  const draft = draftState.source === preferences ? draftState.draft : preferences;
  const [savingTab, setSavingTab] = useState<RepositoryTabPreferenceKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function updatePreference(
    tab: RepositoryTabPreferenceKey,
    preference: RepositoryTabPreference
  ): Promise<void> {
    const nextPreferences = {
      ...draft,
      [tab]: preference
    };
    setDraftState({ source: preferences, draft: nextPreferences });
    setSavingTab(tab);
    setSaveError(null);

    try {
      await onPreferencesChange(nextPreferences);
    } catch (error) {
      setDraftState({ source: preferences, draft: preferences });
      setSaveError(error instanceof Error ? error.message : "Repository tab visibility could not be saved.");
    } finally {
      setSavingTab(null);
    }
  }

  function changePreference(tab: RepositoryTabPreferenceKey, value: string): void {
    void updatePreference(tab, readRepositoryTabPreference(value));
  }

  return (
    <section className="repository-tab-visibility-section">
      <header>
        <div>
          <h3>Tab visibility</h3>
          <small>Per-repository Control overrides</small>
        </div>
        {savingTab && <span className="state-chip">Saving {repositoryTabPreferenceLabels[savingTab]}</span>}
      </header>
      <div className="settings-preference-grid">
        {repositoryTabPreferenceKeys.map((tab) => (
          <label key={tab} className="settings-preference-row">
            <span>{repositoryTabPreferenceLabels[tab]}</span>
            <select
              aria-label={`${repositoryTabPreferenceLabels[tab]} tab visibility`}
              disabled={savingTab !== null}
              value={draft[tab] ?? "auto"}
              onChange={(event) => changePreference(tab, event.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="show">Show</option>
              <option value="hide">Hide</option>
            </select>
          </label>
        ))}
      </div>
      {saveError && <div className="error-state">Could not save tab visibility: {saveError}</div>}
    </section>
  );
}

export function RepositorySettingsTab({
  repository,
  githubReady,
  selectedRef,
  refListLimit,
  repositoryRulesetsLimit,
  repositoryAccessLimit,
  focusedCollaboratorLogin,
  forksLimit,
  saving,
  saveSucceeded,
  saveError,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  tabPreferences,
  onMutate,
  onTabPreferencesChange,
  onOpenExternal,
  onOpenRepository,
  onOpenTeam,
  onSelectCollaborator,
  onExpandForks,
  onExpandRepositoryAccess
}: {
  repository: RepositoryDetail;
  githubReady: boolean;
  selectedRef: string | null;
  refListLimit: number;
  repositoryRulesetsLimit: number;
  repositoryAccessLimit: number;
  focusedCollaboratorLogin: string | null;
  forksLimit: number;
  saving: boolean;
  saveSucceeded: boolean;
  saveError: Error | null;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  tabPreferences: RepositoryTabPreferenceMap;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onTabPreferencesChange(preferences: RepositoryTabPreferenceMap): Promise<void>;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onOpenTeam(team: TeamSummary): void;
  onSelectCollaborator(collaborator: RepositoryCollaboratorSummary): void;
  onExpandForks(): void;
  onExpandRepositoryAccess(): void;
}): JSX.Element {
  const administration = repository.administration;
  const {
    branches,
    branchesError,
    branchProtectionBranch,
    branchProtection: branchProtectionQuery,
    repositoryRulesets: repositoryRulesetsQuery,
    repositoryAccess: repositoryAccessQuery,
    repositoryForks: repositoryForksQuery
  } = useRepositorySettingsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    selectedRef,
    defaultBranch: repository.defaultBranch ?? null,
    refListLimit,
    repositoryAccessLimit,
    forksLimit,
    repositoryRulesetsLimit,
    enabled: true,
    githubReady
  });
  const branchProtection = branchProtectionQuery.data ?? null;
  const branchProtectionLoading = branchProtectionQuery.isLoading || branchProtectionQuery.isFetching;
  const branchProtectionError = branchProtectionQuery.error;
  const repositoryRulesets = repositoryRulesetsQuery.data?.items ?? [];
  const repositoryRulesetsLoading = repositoryRulesetsQuery.isLoading || repositoryRulesetsQuery.isFetching;
  const repositoryRulesetsAvailability = repositoryRulesetsQuery.data?.availability ?? null;
  const repositoryRulesetsError = repositoryRulesetsQuery.error;
  const repositoryAccess = repositoryAccessQuery.data ?? null;
  const repositoryAccessLoading = repositoryAccessQuery.isLoading || repositoryAccessQuery.isFetching;
  const repositoryAccessError = repositoryAccessQuery.error;
  const repositoryForks = repositoryForksQuery.data ?? null;
  const repositoryForksLoading = repositoryForksQuery.isLoading || repositoryForksQuery.isFetching;
  const repositoryForksError = repositoryForksQuery.error;
  const {
    draft: branchProtectionDraft,
    draftReady: branchProtectionDraftReady,
    setRequiresPullRequestReviews,
    setRequiredApprovingReviewCount,
    setEnforceAdmins,
    setRequiredLinearHistory,
    setRequiredConversationResolution
  } = useBranchProtectionDraft(branchProtectionBranch, branchProtection);
  const liveSettingsDisabledReason = !githubReady
    ? "Sign in with GitHub to change repository settings."
    : null;
  const liveStatusDisabledReason = !githubReady ? "Sign in with GitHub to change repository status." : null;
  const settingsDisabledReason =
    liveSettingsDisabledReason ?? repositorySettingsMutationDisabledReason(repository);
  const statusDisabledReason = liveStatusDisabledReason ?? repositoryStatusMutationDisabledReason(repository);
  const forkNetworkAvailabilityMessage = readAvailabilityMessage(
    "Fork network",
    repositoryForks?.availability ?? null
  );
  const administrationAvailabilityMessage = readAvailabilityMessage(
    "Repository settings metadata",
    repository.administrationAvailability ?? null
  );
  const forks = repositoryForks?.items ?? [];
  const forksLimitHit = forks.length >= forksLimit;
  const canExpandForks = forksLimitHit && forksLimit < maxForksLimit;
  const forkNetworkUnavailable = Boolean(repositoryForksError) || Boolean(forkNetworkAvailabilityMessage);
  const forkNetworkStatusLabel =
    repositoryForksLoading && !repositoryForks
      ? "loading"
      : forkNetworkUnavailable
        ? "unavailable"
        : String(forks.length);
  const repositoryAdminActions: GitHubAction[] = [
    "addRepositoryCollaborator",
    "removeRepositoryCollaborator",
    "updateCollaboratorPermission",
    "addRepositoryTeam",
    "removeRepositoryTeam",
    "updateTeamPermission",
    "updateBranchProtection",
    "deleteBranchProtection",
    "createRepositoryRuleset",
    "updateRepositoryRuleset",
    "deleteRepositoryRuleset"
  ];
  const repositoryAdminMutationActive =
    mutationPending && mutationAction !== null && repositoryAdminActions.includes(mutationAction);
  const repositoryAdminMutationSucceeded =
    mutationSucceeded && mutationAction !== null && repositoryAdminActions.includes(mutationAction);
  const repositoryAdminMutationError =
    mutationAction !== null && repositoryAdminActions.includes(mutationAction) ? mutationError : null;
  const adminDisabledReason = repositoryAdminMutationActive
    ? `${githubActionLabel(mutationAction)} is still running.`
    : settingsDisabledReason;
  const adminDisabled = Boolean(adminDisabledReason);
  const branchProtectionAvailabilityMessage = readAvailabilityMessage(
    "Branch protection",
    branchProtection?.availability ?? null
  );
  const repositoryRulesetsAvailabilityMessage = readAvailabilityMessage(
    "Repository rulesets",
    repositoryRulesetsAvailability
  );
  const branchProtectionDisabledReason =
    adminDisabledReason ??
    (branchProtectionBranch ? null : "Select a branch before changing branch protection.") ??
    (branchProtectionLoading && !branchProtection ? "Branch protection is still loading." : null) ??
    (!branchProtectionDraftReady ? "Branch protection draft is not ready yet." : null) ??
    (branchProtection?.protection?.restrictsPushes
      ? "Branch protection has push restrictions that Control cannot safely update yet."
      : null);
  const rulesetDisabledReason = adminDisabledReason;

  return (
    <section className="repository-settings-panel">
      <header className="settings-surface-header">
        <div>
          <h2>Repository settings</h2>
          <small>
            {administration.visibility.toLowerCase()} · default branch{" "}
            {administration.defaultBranch ?? "unknown"}
          </small>
        </div>
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/settings"))}>
          <ExternalLink size={16} /> Open GitHub fallback
        </button>
      </header>

      {administrationAvailabilityMessage && (
        <div className="error-state">{administrationAvailabilityMessage}</div>
      )}

      <RepositoryTabVisibilityPreferencesSection
        preferences={tabPreferences}
        onPreferencesChange={onTabPreferencesChange}
      />

      <RepositoryFeatureSettingsForm
        repository={repository}
        branches={branches}
        branchesError={branchesError}
        saving={saving}
        saveSucceeded={saveSucceeded}
        saveError={saveError}
        settingsDisabledReason={settingsDisabledReason}
        statusDisabledReason={statusDisabledReason}
        onMutate={onMutate}
      />

      <BranchProtectionSection
        branch={branchProtectionBranch}
        branchProtection={branchProtection}
        loading={branchProtectionLoading}
        error={branchProtectionError}
        availabilityMessage={branchProtectionAvailabilityMessage}
        disabledReason={branchProtectionDisabledReason}
        draft={branchProtectionDraft}
        onRequiresPullRequestReviewsChange={setRequiresPullRequestReviews}
        onRequiredApprovingReviewCountChange={setRequiredApprovingReviewCount}
        onEnforceAdminsChange={setEnforceAdmins}
        onRequiredLinearHistoryChange={setRequiredLinearHistory}
        onRequiredConversationResolutionChange={setRequiredConversationResolution}
        onMutate={onMutate}
      />

      <RepositoryRulesetsSection
        repositoryName={repository.name}
        defaultBranch={administration.defaultBranch ?? repository.defaultBranch}
        rulesets={repositoryRulesets}
        rulesetsLimit={repositoryRulesetsLimit}
        loading={repositoryRulesetsLoading}
        error={repositoryRulesetsError}
        availabilityMessage={repositoryRulesetsAvailabilityMessage}
        disabledReason={rulesetDisabledReason}
        onOpenExternal={onOpenExternal}
        onMutate={onMutate}
      />

      {repositoryAdminMutationSucceeded && mutationAction && (
        <div className="muted-row">{githubActionLabel(mutationAction)} completed.</div>
      )}
      {repositoryAdminMutationError && (
        <div className="error-state">
          Could not run {mutationAction ? githubActionLabel(mutationAction) : "repository admin action"}:{" "}
          {repositoryAdminMutationError.message}
        </div>
      )}

      <section className="settings-network-section">
        <header>
          <h3>Fork network</h3>
          <span className={`state-chip ${forkNetworkUnavailable ? "attention" : ""}`}>
            {forkNetworkStatusLabel}
          </span>
        </header>
        {repositoryForksLoading && !repositoryForks && <div className="loading-state">Loading forks…</div>}
        {repositoryForksError && (
          <div className="error-state">Fork network unavailable: {repositoryForksError.message}</div>
        )}
        {forkNetworkAvailabilityMessage && (
          <div className="error-state">{forkNetworkAvailabilityMessage}</div>
        )}
        {!repositoryForksLoading &&
          !repositoryForksError &&
          !forkNetworkAvailabilityMessage &&
          forks.length === 0 && <div className="empty-state">No visible forks returned.</div>}
        {forks.length > 0 && (
          <div className="fork-network-list">
            {forks.map((fork) => (
              <div key={fork.id} className="fork-network-row">
                <button type="button" onClick={() => onOpenRepository(fork.nameWithOwner)}>
                  <GitFork size={15} />
                  <span>
                    <strong>{fork.nameWithOwner}</strong>
                    <small>{repositoryForkMetadataLabel(fork)}</small>
                  </span>
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  title={`Open ${fork.nameWithOwner} on GitHub`}
                  onClick={() => onOpenExternal(fork.htmlUrl)}
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {canExpandForks && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandForks}>
              Load more forks
            </button>
          </div>
        )}
        {!canExpandForks && forksLimitHit && (
          <div className="muted-row">Showing the first {forks.length} forks returned by GitHub.</div>
        )}
      </section>

      <RepositoryAccessSection
        githubReady={githubReady}
        repositoryAccess={repositoryAccess}
        repositoryAccessLoading={repositoryAccessLoading}
        repositoryAccessError={repositoryAccessError}
        repositoryAccessLimit={repositoryAccessLimit}
        focusedCollaboratorLogin={focusedCollaboratorLogin}
        disabled={adminDisabled}
        disabledReason={adminDisabledReason}
        onMutate={onMutate}
        onOpenExternal={onOpenExternal}
        onOpenRepository={onOpenRepository}
        onOpenTeam={onOpenTeam}
        onSelectCollaborator={onSelectCollaborator}
        onExpandRepositoryAccess={onExpandRepositoryAccess}
      />
    </section>
  );
}
