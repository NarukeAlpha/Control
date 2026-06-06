import { type ChangeEvent, type FormEvent, type JSX, useReducer } from "react";

import type { BranchSummary, GitHubAction, GitHubMutationFields, RepositoryDetail } from "@shared/github";

import { repositoryMutationDisabledReason } from "@renderer/components/repository/repositoryUi";

function commaSeparatedValues(value: string): string[] {
  const values = new Set<string>();
  for (const item of value.split(",")) {
    const trimmed = item.trim();
    if (trimmed) {
      values.add(trimmed);
    }
  }
  return Array.from(values);
}

function settingStateLabel(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Enabled" : "Disabled";
}

function securityFeatureStatusLabel(value: string | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value.replace(/[_-]/g, " ");
}

function repositorySecurityFeatureRows(
  securityAndAnalysis: RepositoryDetail["administration"]["securityAndAnalysis"]
): Array<[string, string | null]> {
  return [
    ["Advanced Security", securityAndAnalysis.advancedSecurity],
    ["Code security", securityAndAnalysis.codeSecurity],
    ["Dependabot alerts", securityAndAnalysis.dependabotAlerts],
    ["Dependabot security updates", securityAndAnalysis.dependabotSecurityUpdates],
    ["Secret scanning", securityAndAnalysis.secretScanning],
    ["Push protection", securityAndAnalysis.secretScanningPushProtection],
    ["Non-provider patterns", securityAndAnalysis.secretScanningNonProviderPatterns],
    ["Validity checks", securityAndAnalysis.secretScanningValidityChecks],
    ["AI detection", securityAndAnalysis.secretScanningAiDetection]
  ];
}

function permissionStateLabel(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Allowed" : "Not allowed";
}

export function repositorySettingsMutationDisabledReason(repository: RepositoryDetail): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (repository.administration.viewerPermissions.admin !== true) {
    return "Repository settings require admin access.";
  }
  return null;
}

type RepositorySettingsFeaturesState = {
  issues: boolean;
  projects: boolean;
  wiki: boolean;
  discussions: boolean;
};

type RepositorySettingsMergeState = {
  allowMergeCommit: boolean;
  allowSquashMerge: boolean;
  allowRebaseMerge: boolean;
  allowAutoMerge: boolean;
  deleteBranchOnMerge: boolean;
  allowUpdateBranch: boolean;
};

type RepositorySettingsTextField = "description" | "homepage" | "defaultBranch" | "topics";
type RepositorySettingsStatusField = "allowForking" | "webCommitSignoffRequired";

type RepositorySettingsFormState = {
  description: string;
  homepage: string;
  defaultBranch: string;
  topics: string;
  allowForking: boolean;
  webCommitSignoffRequired: boolean;
  features: RepositorySettingsFeaturesState;
  mergeSettings: RepositorySettingsMergeState;
};

type RepositorySettingsFormAction =
  | { type: "text"; field: RepositorySettingsTextField; value: string }
  | { type: "status"; field: RepositorySettingsStatusField; value: boolean }
  | { type: "feature"; field: keyof RepositorySettingsFeaturesState; value: boolean }
  | { type: "merge"; field: keyof RepositorySettingsMergeState; value: boolean };

function repositorySettingsFormState(repository: RepositoryDetail): RepositorySettingsFormState {
  const administration = repository.administration;
  return {
    description: repository.description ?? "",
    homepage: repository.homepageUrl ?? "",
    defaultBranch: administration.defaultBranch ?? repository.defaultBranch ?? "",
    topics: repository.topics.join(", "),
    allowForking: administration.allowForking === true,
    webCommitSignoffRequired: administration.webCommitSignoffRequired === true,
    features: {
      issues: administration.features.issues === true,
      projects: administration.features.projects === true,
      wiki: administration.features.wiki === true,
      discussions: administration.features.discussions === true
    },
    mergeSettings: {
      allowMergeCommit: administration.mergeSettings.allowMergeCommit === true,
      allowSquashMerge: administration.mergeSettings.allowSquashMerge === true,
      allowRebaseMerge: administration.mergeSettings.allowRebaseMerge === true,
      allowAutoMerge: administration.mergeSettings.allowAutoMerge === true,
      deleteBranchOnMerge: administration.mergeSettings.deleteBranchOnMerge === true,
      allowUpdateBranch: administration.mergeSettings.allowUpdateBranch === true
    }
  };
}

function repositorySettingsFormReducer(
  state: RepositorySettingsFormState,
  action: RepositorySettingsFormAction
): RepositorySettingsFormState {
  switch (action.type) {
    case "text":
      return { ...state, [action.field]: action.value };
    case "status":
      return { ...state, [action.field]: action.value };
    case "feature":
      return { ...state, features: { ...state.features, [action.field]: action.value } };
    case "merge":
      return { ...state, mergeSettings: { ...state.mergeSettings, [action.field]: action.value } };
  }
}

function settingControlDisabledReason(
  formDisabledReason: string | null,
  value: boolean | null,
  label: string
): string | null {
  return formDisabledReason ?? (value === null ? `${label} setting is unavailable from GitHub.` : null);
}

function repositorySettingsSaveRequiresConfirmation(
  repository: RepositoryDetail,
  state: RepositorySettingsFormState
): boolean {
  const administration = repository.administration;
  const currentDefaultBranch = administration.defaultBranch ?? repository.defaultBranch ?? null;
  const nextDefaultBranch = state.defaultBranch.trim();
  if (
    currentDefaultBranch !== null &&
    nextDefaultBranch !== "" &&
    nextDefaultBranch !== currentDefaultBranch
  ) {
    return true;
  }

  if (administration.allowForking === true && !state.allowForking) {
    return true;
  }
  if (administration.webCommitSignoffRequired === false && state.webCommitSignoffRequired) {
    return true;
  }

  if (
    (administration.features.issues === true && !state.features.issues) ||
    (administration.features.projects === true && !state.features.projects) ||
    (administration.features.wiki === true && !state.features.wiki) ||
    (administration.features.discussions === true && !state.features.discussions)
  ) {
    return true;
  }

  return (
    (administration.mergeSettings.allowMergeCommit === true && !state.mergeSettings.allowMergeCommit) ||
    (administration.mergeSettings.allowSquashMerge === true && !state.mergeSettings.allowSquashMerge) ||
    (administration.mergeSettings.allowRebaseMerge === true && !state.mergeSettings.allowRebaseMerge) ||
    (administration.mergeSettings.allowAutoMerge === true && !state.mergeSettings.allowAutoMerge) ||
    (administration.mergeSettings.deleteBranchOnMerge === true && !state.mergeSettings.deleteBranchOnMerge) ||
    (administration.mergeSettings.allowUpdateBranch === true && !state.mergeSettings.allowUpdateBranch)
  );
}

function repositorySettingsMutationPayload(
  repository: RepositoryDetail,
  state: RepositorySettingsFormState
): GitHubMutationFields {
  const administration = repository.administration;
  const payload: GitHubMutationFields = {
    description: state.description.trim() || null,
    homepage: state.homepage.trim() || null,
    default_branch: state.defaultBranch.trim() || undefined,
    topics: commaSeparatedValues(state.topics)
  };

  if (administration.allowForking !== null) {
    payload.allow_forking = state.allowForking;
  }
  if (administration.webCommitSignoffRequired !== null) {
    payload.web_commit_signoff_required = state.webCommitSignoffRequired;
  }
  if (administration.features.issues !== null) {
    payload.has_issues = state.features.issues;
  }
  if (administration.features.projects !== null) {
    payload.has_projects = state.features.projects;
  }
  if (administration.features.wiki !== null) {
    payload.has_wiki = state.features.wiki;
  }
  if (administration.features.discussions !== null) {
    payload.has_discussions = state.features.discussions;
  }
  if (administration.mergeSettings.allowMergeCommit !== null) {
    payload.allow_merge_commit = state.mergeSettings.allowMergeCommit;
  }
  if (administration.mergeSettings.allowSquashMerge !== null) {
    payload.allow_squash_merge = state.mergeSettings.allowSquashMerge;
  }
  if (administration.mergeSettings.allowRebaseMerge !== null) {
    payload.allow_rebase_merge = state.mergeSettings.allowRebaseMerge;
  }
  if (administration.mergeSettings.allowAutoMerge !== null) {
    payload.allow_auto_merge = state.mergeSettings.allowAutoMerge;
  }
  if (administration.mergeSettings.deleteBranchOnMerge !== null) {
    payload.delete_branch_on_merge = state.mergeSettings.deleteBranchOnMerge;
  }
  if (administration.mergeSettings.allowUpdateBranch !== null) {
    payload.allow_update_branch = state.mergeSettings.allowUpdateBranch;
  }

  return payload;
}

export function RepositorySettingsOverview({
  administration
}: {
  administration: RepositoryDetail["administration"];
}): JSX.Element {
  const featureRows = [
    ["Issues", administration.features.issues],
    ["Projects", administration.features.projects],
    ["Wiki", administration.features.wiki],
    ["Discussions", administration.features.discussions]
  ] as const;
  const mergeRows = [
    ["Merge commits", administration.mergeSettings.allowMergeCommit],
    ["Squash merge", administration.mergeSettings.allowSquashMerge],
    ["Rebase merge", administration.mergeSettings.allowRebaseMerge],
    ["Auto-merge", administration.mergeSettings.allowAutoMerge],
    ["Delete branch on merge", administration.mergeSettings.deleteBranchOnMerge],
    ["Update branch button", administration.mergeSettings.allowUpdateBranch]
  ] as const;
  const permissionRows = [
    ["Admin", administration.viewerPermissions.admin],
    ["Maintain", administration.viewerPermissions.maintain],
    ["Push", administration.viewerPermissions.push],
    ["Triage", administration.viewerPermissions.triage],
    ["Pull", administration.viewerPermissions.pull]
  ] as const;
  const securityFeatureRows = repositorySecurityFeatureRows(administration.securityAndAnalysis);

  return (
    <>
      <div className="settings-summary-grid">
        <div>
          <span>Archived</span>
          <strong>{settingStateLabel(administration.isArchived)}</strong>
        </div>
        <div>
          <span>Disabled</span>
          <strong>{settingStateLabel(administration.isDisabled)}</strong>
        </div>
        <div>
          <span>Template</span>
          <strong>{settingStateLabel(administration.isTemplate)}</strong>
        </div>
        <div>
          <span>Forking</span>
          <strong>{settingStateLabel(administration.allowForking)}</strong>
        </div>
        <div>
          <span>Web signoff</span>
          <strong>{settingStateLabel(administration.webCommitSignoffRequired)}</strong>
        </div>
      </div>

      <div className="settings-list-grid">
        <section>
          <h3>Features</h3>
          {featureRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{settingStateLabel(value)}</strong>
            </div>
          ))}
        </section>
        <section>
          <h3>Merge policy</h3>
          {mergeRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{settingStateLabel(value)}</strong>
            </div>
          ))}
        </section>
        <section>
          <h3>Your access</h3>
          {permissionRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{permissionStateLabel(value)}</strong>
            </div>
          ))}
        </section>
        <section>
          <h3>Security features</h3>
          {securityFeatureRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{securityFeatureStatusLabel(value)}</strong>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function RepositoryTextSettingsFields({
  state,
  branches,
  branchesError,
  formDisabled,
  formDisabledReason,
  onTextChange
}: {
  state: RepositorySettingsFormState;
  branches: BranchSummary[];
  branchesError: Error | null;
  formDisabled: boolean;
  formDisabledReason: string | null;
  onTextChange(field: RepositorySettingsTextField, value: string): void;
}): JSX.Element {
  function handleTextChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void {
    onTextChange(event.currentTarget.name as RepositorySettingsTextField, event.currentTarget.value);
  }

  return (
    <>
      <div>
        <label htmlFor="repository-settings-description">Description</label>
        <textarea
          id="repository-settings-description"
          name="description"
          placeholder="Repository description"
          value={state.description}
          disabled={formDisabled}
          title={formDisabledReason ?? undefined}
          onChange={handleTextChange}
        />
      </div>
      <div>
        <label htmlFor="repository-settings-homepage">Homepage</label>
        <input
          id="repository-settings-homepage"
          name="homepage"
          placeholder="https://example.com"
          value={state.homepage}
          disabled={formDisabled}
          title={formDisabledReason ?? undefined}
          onChange={handleTextChange}
        />
      </div>
      <div>
        <label htmlFor="repository-settings-default-branch">Default branch</label>
        {branches.length > 0 ? (
          <select
            id="repository-settings-default-branch"
            name="defaultBranch"
            value={state.defaultBranch}
            disabled={formDisabled}
            title={formDisabledReason ?? undefined}
            onChange={handleTextChange}
          >
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="repository-settings-default-branch"
            name="defaultBranch"
            placeholder="main"
            value={state.defaultBranch}
            disabled={formDisabled}
            title={formDisabledReason ?? undefined}
            onChange={handleTextChange}
          />
        )}
        {branchesError && (
          <small className="action-disabled-note">
            Branch list unavailable: {branchesError.message}. Enter a branch name manually.
          </small>
        )}
      </div>
      <div>
        <label htmlFor="repository-settings-topics">Topics</label>
        <input
          id="repository-settings-topics"
          name="topics"
          placeholder="swift, compiler, concurrency"
          value={state.topics}
          disabled={formDisabled}
          title={formDisabledReason ?? undefined}
          onChange={handleTextChange}
        />
      </div>
    </>
  );
}

function RepositoryStatusActions({
  administration,
  saving,
  statusActionDisabled,
  statusActionDisabledReason,
  statusDisabledReason,
  onToggleArchive
}: {
  administration: RepositoryDetail["administration"];
  saving: boolean;
  statusActionDisabled: boolean;
  statusActionDisabledReason: string | null;
  statusDisabledReason: string | null;
  onToggleArchive(): void;
}): JSX.Element {
  const archiveActionLabel = administration.isArchived ? "Unarchive repository" : "Archive repository";

  return (
    <section className="settings-danger-zone">
      <header>
        <div>
          <h4>Danger zone</h4>
          <small>Destructive repository status actions that require confirmation.</small>
        </div>
      </header>
      <div className="settings-status-actions">
        <button
          className="dark-action"
          type="button"
          disabled={statusActionDisabled}
          title={statusActionDisabledReason ?? undefined}
          onClick={onToggleArchive}
        >
          {saving ? "Saving…" : archiveActionLabel}
        </button>
        <small>
          {administration.isArchived
            ? "Archived repositories are read-only until restored."
            : "Archive when active repository work should stop."}
        </small>
      </div>
      {statusDisabledReason && <small className="action-disabled-note">{statusDisabledReason}</small>}
    </section>
  );
}

function RepositoryCommitPolicyOptions({
  administration,
  state,
  formDisabledReason,
  onStatusChange
}: {
  administration: RepositoryDetail["administration"];
  state: RepositorySettingsFormState;
  formDisabledReason: string | null;
  onStatusChange(field: RepositorySettingsStatusField, value: boolean): void;
}): JSX.Element {
  function handleStatusChange(event: ChangeEvent<HTMLInputElement>): void {
    onStatusChange(event.currentTarget.name as RepositorySettingsStatusField, event.currentTarget.checked);
  }

  const forkingDisabledReason = settingControlDisabledReason(
    formDisabledReason,
    administration.allowForking,
    "Forking"
  );
  const signoffDisabledReason = settingControlDisabledReason(
    formDisabledReason,
    administration.webCommitSignoffRequired,
    "Web commit signoff"
  );

  return (
    <div className="release-options" aria-label="Repository commit policy">
      <label>
        <input
          type="checkbox"
          name="allowForking"
          checked={state.allowForking}
          disabled={Boolean(forkingDisabledReason)}
          title={forkingDisabledReason ?? undefined}
          onChange={handleStatusChange}
        />
        Allow forking
      </label>
      <label>
        <input
          type="checkbox"
          name="webCommitSignoffRequired"
          checked={state.webCommitSignoffRequired}
          disabled={Boolean(signoffDisabledReason)}
          title={signoffDisabledReason ?? undefined}
          onChange={handleStatusChange}
        />
        Require web commit signoff
      </label>
    </div>
  );
}

const featureToggleRows = [
  ["issues", "Issues"],
  ["projects", "Projects"],
  ["wiki", "Wiki"],
  ["discussions", "Discussions"]
] as const satisfies ReadonlyArray<readonly [keyof RepositorySettingsFeaturesState, string]>;

const mergeToggleRows = [
  ["allowMergeCommit", "Merge commits"],
  ["allowSquashMerge", "Squash merge"],
  ["allowRebaseMerge", "Rebase merge"],
  ["allowAutoMerge", "Auto-merge"],
  ["deleteBranchOnMerge", "Delete branch on merge"],
  ["allowUpdateBranch", "Update branch button"]
] as const satisfies ReadonlyArray<readonly [keyof RepositorySettingsMergeState, string]>;

function RepositoryFeatureOptions({
  administration,
  features,
  formDisabledReason,
  onFeatureChange
}: {
  administration: RepositoryDetail["administration"];
  features: RepositorySettingsFeaturesState;
  formDisabledReason: string | null;
  onFeatureChange(field: keyof RepositorySettingsFeaturesState, value: boolean): void;
}): JSX.Element {
  function handleFeatureChange(event: ChangeEvent<HTMLInputElement>): void {
    onFeatureChange(
      event.currentTarget.name as keyof RepositorySettingsFeaturesState,
      event.currentTarget.checked
    );
  }

  return (
    <div className="release-options" aria-label="Repository feature toggles">
      {featureToggleRows.map(([field, label]) => {
        const disabledReason = settingControlDisabledReason(
          formDisabledReason,
          administration.features[field],
          label
        );
        return (
          <label key={field}>
            <input
              type="checkbox"
              name={field}
              checked={features[field]}
              disabled={Boolean(disabledReason)}
              title={disabledReason ?? undefined}
              onChange={handleFeatureChange}
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

function RepositoryMergePolicyOptions({
  administration,
  mergeSettings,
  formDisabledReason,
  onMergeSettingChange
}: {
  administration: RepositoryDetail["administration"];
  mergeSettings: RepositorySettingsMergeState;
  formDisabledReason: string | null;
  onMergeSettingChange(field: keyof RepositorySettingsMergeState, value: boolean): void;
}): JSX.Element {
  function handleMergeSettingChange(event: ChangeEvent<HTMLInputElement>): void {
    onMergeSettingChange(
      event.currentTarget.name as keyof RepositorySettingsMergeState,
      event.currentTarget.checked
    );
  }

  return (
    <div className="release-options" aria-label="Repository merge policy">
      {mergeToggleRows.map(([field, label]) => {
        const disabledReason = settingControlDisabledReason(
          formDisabledReason,
          administration.mergeSettings[field],
          label
        );
        return (
          <label key={field}>
            <input
              type="checkbox"
              name={field}
              checked={mergeSettings[field]}
              disabled={Boolean(disabledReason)}
              title={disabledReason ?? undefined}
              onChange={handleMergeSettingChange}
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

export function RepositoryFeatureSettingsForm({
  repository,
  branches,
  branchesError,
  saving,
  saveSucceeded,
  saveError,
  settingsDisabledReason,
  statusDisabledReason,
  onMutate
}: {
  repository: RepositoryDetail;
  branches: BranchSummary[];
  branchesError: Error | null;
  saving: boolean;
  saveSucceeded: boolean;
  saveError: Error | null;
  settingsDisabledReason: string | null;
  statusDisabledReason: string | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const administration = repository.administration;
  const [state, dispatch] = useReducer(
    repositorySettingsFormReducer,
    repository,
    repositorySettingsFormState
  );
  const formDisabledReason = saving ? "Repository settings save is still running." : settingsDisabledReason;
  const statusActionDisabledReason = saving
    ? "Repository status update is still running."
    : statusDisabledReason;
  const formDisabled = Boolean(formDisabledReason);
  const statusActionDisabled = Boolean(statusActionDisabledReason);

  function updateTextField(field: RepositorySettingsTextField, value: string): void {
    dispatch({ type: "text", field, value });
  }

  function updateStatusField(field: RepositorySettingsStatusField, value: boolean): void {
    dispatch({ type: "status", field, value });
  }

  function updateFeature(field: keyof RepositorySettingsFeaturesState, value: boolean): void {
    dispatch({ type: "feature", field, value });
  }

  function updateMergeSetting(field: keyof RepositorySettingsMergeState, value: boolean): void {
    dispatch({ type: "merge", field, value });
  }

  function toggleArchive(): void {
    onMutate("editRepository", true, { archived: !administration.isArchived });
  }

  function saveRepositorySettings(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (formDisabled) {
      return;
    }
    const payload = repositorySettingsMutationPayload(repository, state);
    const dangerous = repositorySettingsSaveRequiresConfirmation(repository, state);
    onMutate("editRepository", dangerous, payload);
  }

  return (
    <>
      <form className="compose-form repository-settings-form" onSubmit={saveRepositorySettings}>
        <RepositoryTextSettingsFields
          state={state}
          branches={branches}
          branchesError={branchesError}
          formDisabled={formDisabled}
          formDisabledReason={formDisabledReason}
          onTextChange={updateTextField}
        />
        <RepositoryStatusActions
          administration={administration}
          saving={saving}
          statusActionDisabled={statusActionDisabled}
          statusActionDisabledReason={statusActionDisabledReason}
          statusDisabledReason={statusDisabledReason}
          onToggleArchive={toggleArchive}
        />
        <RepositoryCommitPolicyOptions
          administration={administration}
          state={state}
          formDisabledReason={formDisabledReason}
          onStatusChange={updateStatusField}
        />
        <RepositoryFeatureOptions
          administration={administration}
          features={state.features}
          formDisabledReason={formDisabledReason}
          onFeatureChange={updateFeature}
        />
        <RepositoryMergePolicyOptions
          administration={administration}
          mergeSettings={state.mergeSettings}
          formDisabledReason={formDisabledReason}
          onMergeSettingChange={updateMergeSetting}
        />
        <button
          className="dark-action"
          type="submit"
          disabled={formDisabled}
          title={formDisabledReason ?? undefined}
        >
          {saving ? "Saving…" : "Save repository settings"}
        </button>
        {settingsDisabledReason && <small className="action-disabled-note">{settingsDisabledReason}</small>}
        {saveSucceeded && !saving && <div className="muted-row">Repository settings saved.</div>}
        {saveError && (
          <div className="error-state">Could not save repository settings: {saveError.message}</div>
        )}
      </form>
    </>
  );
}
