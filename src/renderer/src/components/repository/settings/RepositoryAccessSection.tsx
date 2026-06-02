import { ExternalLink } from "lucide-react";
import { useState, type FormEvent, type JSX, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  GitHubAction,
  GitHubMutationFields,
  RepositoryAccessResult,
  RepositoryCollaboratorSummary,
  TeamSummary
} from "@shared/github";

import type { RepositoryTab } from "@renderer/stores/uiStore";
import { formatCompactNumber } from "@renderer/utils/format";
import { useControlApi } from "@renderer/hooks/useControlApi";
import {
  accessRoleLabel,
  collaboratorRoleLabel,
  maxProfileRepositoryLimit,
  readAvailabilityMessage,
  repositoryCollectionMetadataParts
} from "@renderer/components/repository/repositoryUi";

const defaultMemberProfileRepositoryLimit = 8;
const maxRepositoryAccessLimit = 100;

function collaboratorPermissionForMutation(collaborator: RepositoryCollaboratorSummary): string {
  const role = collaborator.roleName?.toLowerCase();
  if (role === "admin" || role === "maintain" || role === "triage" || role === "pull") {
    return role;
  }
  if (role === "write" || role === "push") {
    return "push";
  }
  if (collaborator.permissions.admin) {
    return "admin";
  }
  if (collaborator.permissions.maintain) {
    return "maintain";
  }
  if (collaborator.permissions.push) {
    return "push";
  }
  if (collaborator.permissions.triage) {
    return "triage";
  }
  if (collaborator.permissions.pull) {
    return "pull";
  }
  return "push";
}

function TeamAccessCard({
  teams,
  loading,
  error,
  availabilityMessage,
  disabled,
  disabledReason,
  canExpandTeams,
  limitHit,
  onMutate,
  onOpenExternal,
  onOpenTeam,
  onExpandRepositoryAccess
}: {
  teams: TeamSummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  disabled: boolean;
  disabledReason: string | null;
  canExpandTeams: boolean;
  limitHit: boolean;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onOpenExternal(url: string): void;
  onOpenTeam(team: TeamSummary): void;
  onExpandRepositoryAccess(): void;
}): JSX.Element {
  const [teamSlug, setTeamSlug] = useState("");
  const [teamPermission, setTeamPermission] = useState("push");
  const statusUnavailable = Boolean(error) || Boolean(availabilityMessage);
  const statusLabel =
    loading && teams.length === 0 ? "loading" : statusUnavailable ? "unavailable" : String(teams.length);

  function submitAddTeam(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const slug = teamSlug.trim();
    if (disabled || slug.length === 0) {
      return;
    }
    onMutate("addRepositoryTeam", false, { teamSlug: slug, permission: teamPermission });
    setTeamSlug("");
  }

  function updateTeamPermission(team: TeamSummary, permission: string): void {
    if (disabled) {
      return;
    }
    onMutate("updateTeamPermission", false, { teamSlug: team.slug, permission });
  }

  function removeTeam(team: TeamSummary): void {
    if (disabled) {
      return;
    }
    onMutate("removeRepositoryTeam", true, { teamSlug: team.slug });
  }

  return (
    <section>
      <header>
        <h3>Team access</h3>
        <span className={`state-chip ${statusUnavailable ? "attention" : ""}`}>{statusLabel}</span>
      </header>
      <form className="repository-admin-inline-form" onSubmit={submitAddTeam}>
        <input
          aria-label="Team slug"
          placeholder="team-slug"
          value={teamSlug}
          disabled={disabled}
          title={disabledReason ?? undefined}
          onChange={(event) => setTeamSlug(event.target.value)}
        />
        <select
          aria-label="Team permission"
          value={teamPermission}
          disabled={disabled}
          title={disabledReason ?? undefined}
          onChange={(event) => setTeamPermission(event.target.value)}
        >
          <option value="pull">read</option>
          <option value="triage">triage</option>
          <option value="push">write</option>
          <option value="maintain">maintain</option>
          <option value="admin">admin</option>
        </select>
        <button
          className="dark-action"
          type="submit"
          disabled={disabled || teamSlug.trim().length === 0}
          title={disabledReason ?? "Enter a team slug."}
        >
          Add
        </button>
      </form>
      {loading && teams.length === 0 && <div className="loading-state">Loading repository teams…</div>}
      {error && <div className="error-state">Repository access unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && teams.length === 0 && (
        <div className="empty-state">No teams returned.</div>
      )}
      {teams.length > 0 && (
        <div className="access-list">
          {teams.map((team) => (
            <div className="issue-row organization-team-row" key={team.id}>
              <button
                className="organization-row-main"
                type="button"
                title={`Open ${team.name} in Control`}
                onClick={() => onOpenTeam(team)}
              >
                <span className="mini-avatar">{team.name.slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{team.name}</strong>
                  <small>
                    {accessRoleLabel(team.permission)}
                    {team.privacy ? ` · ${team.privacy}` : ""}
                    {team.memberCount !== null ? ` · ${team.memberCount} members` : ""}
                  </small>
                </span>
              </button>
              <button
                className="pin-row-button"
                type="button"
                aria-label={`Open ${team.name} on GitHub`}
                disabled={!team.htmlUrl}
                title={team.htmlUrl ? `Open ${team.name} on GitHub` : "Team URL unavailable."}
                onClick={() => {
                  if (team.htmlUrl) {
                    onOpenExternal(team.htmlUrl);
                  }
                }}
              >
                <ExternalLink size={14} />
              </button>
              <div className="repository-admin-row-actions">
                <select
                  aria-label={`Permission for ${team.name}`}
                  value={team.permission ?? "push"}
                  disabled={disabled}
                  title={disabledReason ?? undefined}
                  onChange={(event) => updateTeamPermission(team, event.target.value)}
                >
                  <option value="pull">read</option>
                  <option value="triage">triage</option>
                  <option value="push">write</option>
                  <option value="maintain">maintain</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  type="button"
                  disabled={disabled}
                  title={disabledReason ?? `Remove ${team.name}`}
                  onClick={() => removeTeam(team)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {canExpandTeams && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandRepositoryAccess}>
            Load more teams
          </button>
        </div>
      )}
      {!canExpandTeams && limitHit && (
        <div className="muted-row">Showing the first {teams.length} teams returned by GitHub.</div>
      )}
    </section>
  );
}

function CollaboratorDetailPanel({
  selectedCollaborator,
  githubReady,
  profileData,
  profileUrl,
  profileFetching,
  profileError,
  profileAvailabilityMessage,
  permissionContext,
  repositoryItems,
  repositoriesFetching,
  repositoriesError,
  repositoriesAvailabilityMessage,
  canExpandRepositories,
  repositoryLimitHit,
  onOpenExternal,
  onOpenRepository,
  onExpandRepositories
}: {
  selectedCollaborator: RepositoryCollaboratorSummary;
  githubReady: boolean;
  profileData: AccountProfileResult["profile"] | null;
  profileUrl: string | null;
  profileFetching: boolean;
  profileError: Error | null;
  profileAvailabilityMessage: string | null;
  permissionContext: string | null;
  repositoryItems: AccountRepositoryListResult["items"];
  repositoriesFetching: boolean;
  repositoriesError: Error | null;
  repositoriesAvailabilityMessage: string | null;
  canExpandRepositories: boolean;
  repositoryLimitHit: boolean;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onExpandRepositories(): void;
}): JSX.Element {
  return (
    <aside className="contributor-detail-panel repository-collaborator-detail-panel">
      <div className="contributor-detail-header">
        {(profileData?.avatarUrl ?? selectedCollaborator.avatarUrl) ? (
          <img
            src={profileData?.avatarUrl ?? selectedCollaborator.avatarUrl ?? undefined}
            alt=""
            onError={(event) => event.currentTarget.remove()}
          />
        ) : (
          <span className="mini-avatar">{selectedCollaborator.login.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <strong>{profileData?.name ?? `@${selectedCollaborator.login}`}</strong>
          <small>@{profileData?.login ?? selectedCollaborator.login}</small>
        </div>
        {profileUrl && (
          <button
            className="icon-button"
            type="button"
            aria-label={`Open @${selectedCollaborator.login} on GitHub`}
            title={`Open @${selectedCollaborator.login} on GitHub`}
            onClick={() => onOpenExternal(profileUrl)}
          >
            <ExternalLink size={15} />
          </button>
        )}
      </div>

      {!githubReady && (
        <div className="muted-row">Cached mode: showing stored collaborator details when available.</div>
      )}
      {profileFetching && !profileData && <div className="loading-state">Loading collaborator profile…</div>}
      {profileError && <div className="error-state">Profile unavailable: {profileError.message}</div>}
      {profileAvailabilityMessage && <div className="error-state">{profileAvailabilityMessage}</div>}
      {permissionContext && <div className="muted-row">{permissionContext}</div>}

      {(profileData?.bio || profileData?.company || profileData?.location || profileData?.websiteUrl) && (
        <div className="contributor-detail-copy">
          {profileData.bio && <p>{profileData.bio}</p>}
          {profileData.company && <small>{profileData.company}</small>}
          {profileData.location && <small>{profileData.location}</small>}
          {profileData.websiteUrl && (
            <button type="button" onClick={() => onOpenExternal(profileData.websiteUrl!)}>
              {profileData.websiteUrl}
            </button>
          )}
        </div>
      )}

      <div className="contributor-stats">
        <span>
          <strong>{formatCompactNumber(profileData?.repositoryCount ?? repositoryItems.length)}</strong>
          <small>Repositories</small>
        </span>
        <span>
          <strong>{formatCompactNumber(profileData?.starredRepositoryCount ?? 0)}</strong>
          <small>Starred</small>
        </span>
        <span>
          <strong>{formatCompactNumber(profileData?.followers ?? 0)}</strong>
          <small>Followers</small>
        </span>
        <span>
          <strong>{formatCompactNumber(profileData?.following ?? 0)}</strong>
          <small>Following</small>
        </span>
      </div>

      <div className="contributor-repositories">
        <div className="section-title-row">
          <span>Repositories</span>
        </div>
        {repositoriesFetching && <div className="loading-state">Loading repositories…</div>}
        {repositoriesError && (
          <div className="error-state">Repositories unavailable: {repositoriesError.message}</div>
        )}
        {repositoriesAvailabilityMessage && (
          <div className="error-state">{repositoriesAvailabilityMessage}</div>
        )}
        {!repositoriesFetching &&
          !repositoriesError &&
          !repositoriesAvailabilityMessage &&
          repositoryItems.length === 0 && (
            <div className="empty-state">
              {githubReady ? "No repositories available." : "No cached repositories available."}
            </div>
          )}
        {repositoryItems.map((repository) => {
          const metadataParts = repositoryCollectionMetadataParts(repository);
          const visibilityLabel = repository.visibility.toLowerCase();
          const showPrivateChip = repository.isPrivate && visibilityLabel !== "private";

          return (
            <button
              className="contributor-repository-row"
              key={repository.id}
              type="button"
              onClick={() => onOpenRepository(repository.nameWithOwner)}
            >
              <span>
                <strong>{repository.nameWithOwner}</strong>
                <small>{repository.description ?? "No description."}</small>
                {metadataParts.length > 0 && <small>{metadataParts.join(" · ")}</small>}
              </span>
              <span>
                <span className="state-chip">{visibilityLabel}</span>
                {repository.isFork && <span className="state-chip attention">fork</span>}
                {showPrivateChip && <span className="state-chip attention">private</span>}
              </span>
            </button>
          );
        })}
        {canExpandRepositories && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandRepositories}>
              Load more repositories
            </button>
          </div>
        )}
        {!canExpandRepositories && repositoryLimitHit && (
          <div className="muted-row">
            Showing the first {repositoryItems.length} repositories returned by GitHub.
          </div>
        )}
      </div>
    </aside>
  );
}

function CollaboratorsAccessCard({
  collaborators,
  selectedCollaboratorLogin,
  loading,
  error,
  availabilityMessage,
  disabled,
  disabledReason,
  collaboratorLogin,
  collaboratorPermission,
  canExpandCollaborators,
  limitHit,
  onCollaboratorLoginChange,
  onCollaboratorPermissionChange,
  onSubmitAddCollaborator,
  onUpdateCollaboratorPermission,
  onRemoveCollaborator,
  onOpenExternal,
  onSelectCollaborator,
  onExpandRepositoryAccess,
  children
}: {
  collaborators: RepositoryCollaboratorSummary[];
  selectedCollaboratorLogin: string | null;
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  disabled: boolean;
  disabledReason: string | null;
  collaboratorLogin: string;
  collaboratorPermission: string;
  canExpandCollaborators: boolean;
  limitHit: boolean;
  onCollaboratorLoginChange(value: string): void;
  onCollaboratorPermissionChange(value: string): void;
  onSubmitAddCollaborator(event: FormEvent<HTMLFormElement>): void;
  onUpdateCollaboratorPermission(collaborator: RepositoryCollaboratorSummary, permission: string): void;
  onRemoveCollaborator(collaborator: RepositoryCollaboratorSummary): void;
  onOpenExternal(url: string): void;
  onSelectCollaborator(collaborator: RepositoryCollaboratorSummary): void;
  onExpandRepositoryAccess(): void;
  children?: ReactNode;
}): JSX.Element {
  const statusUnavailable = Boolean(error) || Boolean(availabilityMessage);
  const statusLabel = loading ? "loading" : statusUnavailable ? "unavailable" : String(collaborators.length);

  return (
    <section>
      <header>
        <h3>Collaborators</h3>
        <span className={`state-chip ${statusUnavailable ? "attention" : ""}`}>{statusLabel}</span>
      </header>
      <form className="repository-admin-inline-form" onSubmit={onSubmitAddCollaborator}>
        <input
          aria-label="Collaborator username"
          placeholder="username"
          value={collaboratorLogin}
          disabled={disabled}
          title={disabledReason ?? undefined}
          onChange={(event) => onCollaboratorLoginChange(event.target.value)}
        />
        <select
          aria-label="Collaborator permission"
          value={collaboratorPermission}
          disabled={disabled}
          title={disabledReason ?? undefined}
          onChange={(event) => onCollaboratorPermissionChange(event.target.value)}
        >
          <option value="pull">read</option>
          <option value="triage">triage</option>
          <option value="push">write</option>
          <option value="maintain">maintain</option>
          <option value="admin">admin</option>
        </select>
        <button
          className="dark-action"
          type="submit"
          disabled={disabled || collaboratorLogin.trim().length === 0}
          title={disabledReason ?? "Enter a username."}
        >
          Add
        </button>
      </form>
      {loading && <div className="loading-state">Loading collaborators…</div>}
      {error && <div className="error-state">Repository access unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && collaborators.length === 0 && (
        <div className="empty-state">No collaborators returned.</div>
      )}
      {collaborators.length > 0 && (
        <div className="access-list">
          {collaborators.map((collaborator) => {
            const selected = collaborator.login === selectedCollaboratorLogin;
            return (
              <div
                className={`issue-row organization-member-row ${selected ? "selected-action" : ""}`}
                key={collaborator.id}
              >
                <button
                  className="organization-member-row-main"
                  type="button"
                  aria-pressed={selected}
                  title={`View @${collaborator.login} in Control`}
                  onClick={() => onSelectCollaborator(collaborator)}
                >
                  {collaborator.avatarUrl ? (
                    <img src={collaborator.avatarUrl} alt="" />
                  ) : (
                    <span className="mini-avatar">{collaborator.login.slice(0, 1).toUpperCase()}</span>
                  )}
                  <span>
                    <strong>{collaborator.login}</strong>
                    <small>
                      {collaboratorRoleLabel(collaborator)}
                      {collaborator.type ? ` · ${collaborator.type}` : ""}
                      {collaborator.siteAdmin ? " · site admin" : ""}
                    </small>
                  </span>
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Open ${collaborator.login} on GitHub`}
                  disabled={!collaborator.htmlUrl}
                  title={
                    collaborator.htmlUrl
                      ? `Open ${collaborator.login} on GitHub`
                      : "Collaborator profile URL unavailable."
                  }
                  onClick={() => {
                    if (collaborator.htmlUrl) {
                      onOpenExternal(collaborator.htmlUrl);
                    }
                  }}
                >
                  <ExternalLink size={14} />
                </button>
                <div className="repository-admin-row-actions">
                  <select
                    aria-label={`Permission for ${collaborator.login}`}
                    value={collaboratorPermissionForMutation(collaborator)}
                    disabled={disabled}
                    title={disabledReason ?? undefined}
                    onChange={(event) => onUpdateCollaboratorPermission(collaborator, event.target.value)}
                  >
                    <option value="pull">read</option>
                    <option value="triage">triage</option>
                    <option value="push">write</option>
                    <option value="maintain">maintain</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="button"
                    disabled={disabled}
                    title={disabledReason ?? `Remove ${collaborator.login}`}
                    onClick={() => onRemoveCollaborator(collaborator)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {canExpandCollaborators && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandRepositoryAccess}>
            Load more collaborators
          </button>
        </div>
      )}
      {!canExpandCollaborators && limitHit && (
        <div className="muted-row">
          Showing the first {collaborators.length} collaborators returned by GitHub.
        </div>
      )}
      {children}
    </section>
  );
}

export function RepositoryAccessSection({
  githubReady,
  repositoryAccess,
  repositoryAccessLoading,
  repositoryAccessError,
  repositoryAccessLimit,
  focusedCollaboratorLogin,
  disabled,
  disabledReason,
  onMutate,
  onOpenExternal,
  onOpenRepository,
  onOpenTeam,
  onSelectCollaborator,
  onExpandRepositoryAccess
}: {
  githubReady: boolean;
  repositoryAccess: RepositoryAccessResult | null;
  repositoryAccessLoading: boolean;
  repositoryAccessError: Error | null;
  repositoryAccessLimit: number;
  focusedCollaboratorLogin: string | null;
  disabled: boolean;
  disabledReason: string | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onOpenTeam(team: TeamSummary): void;
  onSelectCollaborator(collaborator: RepositoryCollaboratorSummary): void;
  onExpandRepositoryAccess(): void;
}): JSX.Element {
  const api = useControlApi();
  const [profileRepositoryLimits, setProfileRepositoryLimits] = useState<Record<string, number>>({});
  const [collaboratorLogin, setCollaboratorLogin] = useState("");
  const [collaboratorPermission, setCollaboratorPermission] = useState("push");
  const collaborators = repositoryAccess?.collaborators ?? [];
  const accessTeams = repositoryAccess?.teams ?? [];
  const collaboratorsLimitHit = collaborators.length >= repositoryAccessLimit;
  const canExpandCollaborators = collaboratorsLimitHit && repositoryAccessLimit < maxRepositoryAccessLimit;
  const accessTeamsLimitHit = accessTeams.length >= repositoryAccessLimit;
  const canExpandAccessTeams = accessTeamsLimitHit && repositoryAccessLimit < maxRepositoryAccessLimit;
  const collaboratorsAvailabilityMessage = readAvailabilityMessage(
    "Repository collaborators",
    repositoryAccess?.collaboratorsAvailability ?? null
  );
  const teamsAvailabilityMessage = readAvailabilityMessage(
    "Repository team access",
    repositoryAccess?.teamsAvailability ?? null
  );
  const selectedCollaborator =
    collaborators.find((collaborator) => collaborator.login === focusedCollaboratorLogin) ?? null;
  const selectedCollaboratorRepositoryLimit = selectedCollaborator
    ? (profileRepositoryLimits[selectedCollaborator.login] ?? defaultMemberProfileRepositoryLimit)
    : defaultMemberProfileRepositoryLimit;
  const selectedCollaboratorProfile = useQuery<AccountProfileResult>({
    queryKey: ["github-account-profile", selectedCollaborator?.login ?? null],
    queryFn: () =>
      api.github.getAccountProfileWithStatus({
        login: selectedCollaborator?.login ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedCollaborator)
  });
  const selectedCollaboratorRepositories = useQuery<AccountRepositoryListResult>({
    queryKey: [
      "github-account-repositories",
      selectedCollaborator?.login ?? null,
      selectedCollaboratorRepositoryLimit
    ],
    queryFn: () =>
      api.github.listAccountRepositoriesWithStatus({
        login: selectedCollaborator?.login ?? undefined,
        limit: selectedCollaboratorRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedCollaborator)
  });
  const selectedCollaboratorRepositoryItems = selectedCollaboratorRepositories.data?.items ?? [];
  const selectedCollaboratorRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Collaborator repositories",
    selectedCollaboratorRepositories.data?.availability ?? null
  );
  const selectedCollaboratorRepositoriesLimitHit =
    selectedCollaboratorRepositoryItems.length >= selectedCollaboratorRepositoryLimit;
  const canExpandSelectedCollaboratorRepositories =
    selectedCollaboratorRepositoriesLimitHit &&
    selectedCollaboratorRepositoryLimit < maxProfileRepositoryLimit;
  const selectedCollaboratorProfileData = selectedCollaboratorProfile.data?.profile ?? null;
  const selectedCollaboratorProfileAvailabilityMessage = readAvailabilityMessage(
    "Profile",
    selectedCollaboratorProfile.data?.availability ?? null
  );
  const selectedCollaboratorProfileUrl =
    selectedCollaboratorProfileData?.htmlUrl ?? selectedCollaborator?.htmlUrl ?? null;
  const selectedCollaboratorPermissionContext = selectedCollaborator
    ? [
        `Role: ${collaboratorRoleLabel(selectedCollaborator)}`,
        selectedCollaborator.permissions.admin ? "admin" : null,
        selectedCollaborator.permissions.maintain ? "maintain" : null,
        selectedCollaborator.permissions.push ? "push" : null,
        selectedCollaborator.permissions.triage ? "triage" : null,
        selectedCollaborator.permissions.pull ? "pull" : null,
        selectedCollaborator.type,
        selectedCollaborator.siteAdmin ? "site admin" : null
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  function expandSelectedCollaboratorRepositories(): void {
    if (!selectedCollaborator) {
      return;
    }
    setProfileRepositoryLimits((limits) => {
      const currentLimit = limits[selectedCollaborator.login] ?? defaultMemberProfileRepositoryLimit;
      if (currentLimit >= maxProfileRepositoryLimit) {
        return limits;
      }
      const nextLimit = currentLimit < 50 ? 50 : maxProfileRepositoryLimit;
      return { ...limits, [selectedCollaborator.login]: nextLimit };
    });
  }

  function submitAddCollaborator(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const username = collaboratorLogin.trim();
    if (disabled || username.length === 0) {
      return;
    }
    onMutate("addRepositoryCollaborator", false, { username, permission: collaboratorPermission });
    setCollaboratorLogin("");
  }

  function updateCollaboratorPermission(
    collaborator: RepositoryCollaboratorSummary,
    permission: string
  ): void {
    if (disabled) {
      return;
    }
    onMutate("updateCollaboratorPermission", false, { username: collaborator.login, permission });
  }

  function removeCollaborator(collaborator: RepositoryCollaboratorSummary): void {
    if (disabled) {
      return;
    }
    onMutate("removeRepositoryCollaborator", true, { username: collaborator.login });
  }

  return (
    <div className="settings-access-grid">
      <CollaboratorsAccessCard
        collaborators={collaborators}
        selectedCollaboratorLogin={selectedCollaborator?.login ?? null}
        loading={repositoryAccessLoading && !repositoryAccess}
        error={repositoryAccessError}
        availabilityMessage={collaboratorsAvailabilityMessage}
        disabled={disabled}
        disabledReason={disabledReason}
        collaboratorLogin={collaboratorLogin}
        collaboratorPermission={collaboratorPermission}
        canExpandCollaborators={canExpandCollaborators}
        limitHit={collaboratorsLimitHit}
        onCollaboratorLoginChange={setCollaboratorLogin}
        onCollaboratorPermissionChange={setCollaboratorPermission}
        onSubmitAddCollaborator={submitAddCollaborator}
        onUpdateCollaboratorPermission={updateCollaboratorPermission}
        onRemoveCollaborator={removeCollaborator}
        onOpenExternal={onOpenExternal}
        onSelectCollaborator={onSelectCollaborator}
        onExpandRepositoryAccess={onExpandRepositoryAccess}
      >
        {selectedCollaborator && (
          <CollaboratorDetailPanel
            selectedCollaborator={selectedCollaborator}
            githubReady={githubReady}
            profileData={selectedCollaboratorProfileData}
            profileUrl={selectedCollaboratorProfileUrl}
            profileFetching={selectedCollaboratorProfile.isFetching}
            profileError={
              selectedCollaboratorProfile.error instanceof Error ? selectedCollaboratorProfile.error : null
            }
            profileAvailabilityMessage={selectedCollaboratorProfileAvailabilityMessage}
            permissionContext={selectedCollaboratorPermissionContext}
            repositoryItems={selectedCollaboratorRepositoryItems}
            repositoriesFetching={
              selectedCollaboratorRepositories.isFetching && !selectedCollaboratorRepositories.data
            }
            repositoriesError={
              selectedCollaboratorRepositories.error instanceof Error
                ? selectedCollaboratorRepositories.error
                : null
            }
            repositoriesAvailabilityMessage={selectedCollaboratorRepositoriesAvailabilityMessage}
            canExpandRepositories={canExpandSelectedCollaboratorRepositories}
            repositoryLimitHit={selectedCollaboratorRepositoriesLimitHit}
            onOpenExternal={onOpenExternal}
            onOpenRepository={onOpenRepository}
            onExpandRepositories={expandSelectedCollaboratorRepositories}
          />
        )}
      </CollaboratorsAccessCard>
      <TeamAccessCard
        teams={accessTeams}
        loading={repositoryAccessLoading}
        error={repositoryAccessError}
        availabilityMessage={teamsAvailabilityMessage}
        disabled={disabled}
        disabledReason={disabledReason}
        canExpandTeams={canExpandAccessTeams}
        limitHit={accessTeamsLimitHit}
        onMutate={onMutate}
        onOpenExternal={onOpenExternal}
        onOpenTeam={onOpenTeam}
        onExpandRepositoryAccess={onExpandRepositoryAccess}
      />
    </div>
  );
}
