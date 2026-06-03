import { ExternalLink, Pin, RefreshCw, Search, SquareKanban, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChangeEvent, JSX, SyntheticEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  GitHubAccountProfile,
  OrganizationMemberSummary,
  OrganizationRepositorySummary,
  OrganizationSummary,
  OrganizationTeamRepositorySummary,
  ProjectSummary,
  RepositorySummary,
  TeamMemberSummary,
  TeamSummary
} from "@shared/github";
import { MarkdownBody, markdownOrganizationProjectUrlContext } from "../MarkdownBody";
import { useControlApi } from "../../hooks/useControlApi";
import { formatCompactNumber, formatRelativeDate } from "../../utils/format";
import {
  defaultMemberProfileRepositoryLimit,
  maxOrganizationListLimit,
  maxOrganizationMemberLimit,
  maxOrganizationProjectLimit,
  maxOrganizationRepositoryLimit,
  maxOrganizationTeamLimit,
  maxOrganizationTeamMemberLimit,
  maxOrganizationTeamRepositoryLimit,
  organizationRepositoryCollectionChips,
  organizationRepositoryCollectionMetadataParts
} from "./organizationUi";
import {
  maxProfileRepositoryLimit,
  readAvailabilityMessage,
  repositoryCollectionMetadataParts
} from "../repository/repositoryUi";
import { useOrganizationRouteDerivedState } from "./useOrganizationRouteDerivedState";
import type { OrganizationsRouteState } from "./useOrganizationsRouteState";

interface OrganizationsRouteProps {
  title: string;
  githubReady: boolean;
  routeState: OrganizationsRouteState;
  pinnedRepositoryNames: string[];
  repositoryPinBusy: boolean;
  repositoryPinError: Error | null;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
  onRefresh(): Promise<void> | void;
}

type OrganizationCollectionRepositorySummary =
  | OrganizationRepositorySummary
  | OrganizationTeamRepositorySummary;

function textParts(parts: Array<string | null | undefined>): string {
  const presentParts: string[] = [];
  for (const part of parts) {
    if (part) {
      presentParts.push(part);
    }
  }
  return presentParts.join(" · ");
}

function organizationMembershipLabel(organization: OrganizationSummary): string {
  return (
    organization.viewerMembershipRole ??
    (organization.viewerCanAdminister ? "admin" : organization.viewerIsMember ? "member" : "visible")
  );
}

function removeBrokenImage(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.remove();
}

function OrganizationsRouteHeader({
  title,
  refreshInFlight,
  onRefresh,
  onOpenExternal
}: {
  title: string;
  refreshInFlight: boolean;
  onRefresh(): Promise<void> | void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function refreshOrganizations(): void {
    void onRefresh();
  }

  function openFallback(): void {
    onOpenExternal("https://github.com/organizations");
  }

  return (
    <header>
      <h2>{title}</h2>
      <div className="collection-actions">
        <button
          type="button"
          title="Updated organization data"
          disabled={refreshInFlight}
          onClick={refreshOrganizations}
        >
          <RefreshCw size={16} /> {refreshInFlight ? "Refreshing organizations" : "Refresh organizations"}
        </button>
        <button type="button" onClick={openFallback}>
          <RefreshCw size={16} /> GitHub fallback
        </button>
      </div>
    </header>
  );
}

function OrganizationFilterRow({
  collectionFilter,
  onFilterChange
}: {
  collectionFilter: string;
  onFilterChange(value: string): void;
}): JSX.Element {
  function updateFilter(event: ChangeEvent<HTMLInputElement>): void {
    onFilterChange(event.currentTarget.value);
  }

  function clearFilter(): void {
    onFilterChange("");
  }

  return (
    <div className="table-action-row surface-filter-row">
      <label className="surface-filter">
        <Search size={16} />
        <input
          aria-label="Filter organizations"
          placeholder="Filter organizations"
          value={collectionFilter}
          onChange={updateFilter}
        />
      </label>
      {collectionFilter.trim() && (
        <button type="button" onClick={clearFilter}>
          <X size={16} /> Clear
        </button>
      )}
    </div>
  );
}

function SectionTitleRow({
  label,
  canExpand,
  expandLabel,
  onExpand
}: {
  label: string;
  canExpand: boolean;
  expandLabel: string;
  onExpand(): void;
}): JSX.Element {
  return (
    <div className="section-title-row">
      <div className="collection-section-label">{label}</div>
      {canExpand && (
        <button type="button" onClick={onExpand}>
          {expandLabel}
        </button>
      )}
    </div>
  );
}

function OrganizationRow({
  organization,
  selectedOrganizationLogin,
  onSelectOrganization,
  onOpenExternal
}: {
  organization: OrganizationSummary;
  selectedOrganizationLogin: string | null;
  onSelectOrganization(login: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const membershipAvailabilityMessage = readAvailabilityMessage(
    "Organization membership",
    organization.viewerMembershipAvailability
  );

  function selectOrganization(): void {
    onSelectOrganization(organization.login);
  }

  function openOrganization(): void {
    onOpenExternal(organization.htmlUrl);
  }

  return (
    <div className="issue-row organization-row">
      <button
        className={`organization-row-main ${
          organization.login === selectedOrganizationLogin ? "selected-action" : ""
        }`}
        type="button"
        onClick={selectOrganization}
      >
        <span className="repo-avatar">{organization.login.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{organization.name ?? organization.login}</strong>
          <small>
            {organization.login} · {formatCompactNumber(organization.repositoryCount)} repositories ·{" "}
            {formatCompactNumber(organization.teamCount)} teams · {organizationMembershipLabel(organization)}
            {organization.viewerMembershipState ? ` · ${organization.viewerMembershipState}` : ""}
          </small>
          {membershipAvailabilityMessage && <small>{membershipAvailabilityMessage}</small>}
          {organization.description && <small>{organization.description}</small>}
        </div>
      </button>
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open ${organization.login} on GitHub`}
        title={`Open ${organization.login} on GitHub`}
        onClick={openOrganization}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function OrganizationListSection({
  organizations,
  selectedOrganizationLogin,
  organizationListLimit,
  organizationsLimitHit,
  canExpandOrganizations,
  onSelectOrganization,
  onExpandOrganizations,
  onOpenExternal
}: {
  organizations: OrganizationSummary[];
  selectedOrganizationLogin: string | null;
  organizationListLimit: number;
  organizationsLimitHit: boolean;
  canExpandOrganizations: boolean;
  onSelectOrganization(login: string): void;
  onExpandOrganizations(): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <>
      {organizations.map((organization) => (
        <OrganizationRow
          key={organization.id}
          organization={organization}
          selectedOrganizationLogin={selectedOrganizationLogin}
          onSelectOrganization={onSelectOrganization}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {canExpandOrganizations && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandOrganizations}>
            Load more organizations
          </button>
        </div>
      )}
      {!canExpandOrganizations && organizationsLimitHit && (
        <div className="muted-row">
          Showing the first {organizationListLimit} organizations returned by GitHub.
        </div>
      )}
    </>
  );
}

function OrganizationProfileSummary({
  organization,
  membershipAvailabilityMessage,
  onOpenExternal
}: {
  organization: OrganizationSummary;
  membershipAvailabilityMessage: string | null;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function openOrganization(): void {
    onOpenExternal(organization.htmlUrl);
  }

  return (
    <section className="organization-profile-summary" aria-label={`${organization.login} profile`}>
      {organization.avatarUrl ? (
        <img src={organization.avatarUrl} alt="" />
      ) : (
        <span className="repo-avatar">{organization.login.slice(0, 1).toUpperCase()}</span>
      )}
      <div>
        <h3>{organization.name ?? organization.login}</h3>
        <small>
          {organization.login} · {organizationMembershipLabel(organization)}
          {organization.viewerMembershipState ? ` · ${organization.viewerMembershipState}` : ""}
        </small>
        {membershipAvailabilityMessage && <small>{membershipAvailabilityMessage}</small>}
        {organization.description && <p>{organization.description}</p>}
        <div className="organization-profile-meta">
          <span>{formatCompactNumber(organization.repositoryCount)} repos</span>
          <span>{formatCompactNumber(organization.teamCount)} teams</span>
          {organization.location && <span>{organization.location}</span>}
          {organization.websiteUrl && <span>{organization.websiteUrl}</span>}
        </div>
        <div className="organization-profile-meta">
          <span>
            {organization.viewerCanCreateRepositories ? "can create repos" : "repo creation unavailable"}
          </span>
          <span>{organization.viewerCanCreateTeams ? "can create teams" : "team creation unavailable"}</span>
        </div>
      </div>
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open ${organization.login} on GitHub`}
        title={`Open ${organization.login} on GitHub`}
        onClick={openOrganization}
      >
        <ExternalLink size={15} />
      </button>
    </section>
  );
}

function OrganizationProjectDetailPanel({
  project,
  onOpenExternal
}: {
  project: ProjectSummary;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function openProject(): void {
    if (project.htmlUrl) {
      onOpenExternal(project.htmlUrl);
    }
  }

  function openOwner(): void {
    if (project.ownerHtmlUrl) {
      onOpenExternal(project.ownerHtmlUrl);
    }
  }

  return (
    <aside className="contributor-detail-panel organization-project-detail-panel">
      <div className="contributor-detail-header">
        <SquareKanban size={22} />
        <div>
          <strong>{project.title}</strong>
          <small>
            {textParts([
              project.number ? `#${project.number}` : null,
              project.ownerLogin,
              project.closed ? "closed" : "open"
            ])}
          </small>
        </div>
        {project.htmlUrl && (
          <button
            className="icon-button"
            type="button"
            aria-label={`Open ${project.title} on GitHub`}
            title={`Open ${project.title} on GitHub`}
            onClick={openProject}
          >
            <ExternalLink size={15} />
          </button>
        )}
      </div>
      <div className="workflow-summary">
        <span className={`state-chip ${project.closed ? "" : "success"}`}>
          {project.closed ? "closed" : "open"}
        </span>
        <span>
          {project.isPublic === null ? "Visibility unknown" : project.isPublic ? "Public" : "Private"}
        </span>
        <span>
          {project.itemsCount === null
            ? "Items unavailable"
            : `${formatCompactNumber(project.itemsCount)} items`}
        </span>
        <span>
          {project.fieldsCount === null
            ? "Fields unavailable"
            : `${formatCompactNumber(project.fieldsCount)} fields`}
        </span>
        {project.viewerCanUpdate !== null && (
          <span>{project.viewerCanUpdate ? "Viewer can update" : "Viewer read-only"}</span>
        )}
      </div>
      <div className="muted-row">
        {textParts([
          project.createdAt ? `Created ${formatRelativeDate(project.createdAt)}` : null,
          project.updatedAt ? `Updated ${formatRelativeDate(project.updatedAt)}` : null,
          project.closedAt ? `Closed ${formatRelativeDate(project.closedAt)}` : null
        ])}
      </div>
      {project.shortDescription && <p className="project-description">{project.shortDescription}</p>}
      {project.readme ? (
        <div className="project-readme-panel">
          <MarkdownBody
            markdown={project.readme}
            onOpenExternal={onOpenExternal}
            urlContext={markdownOrganizationProjectUrlContext(project)}
          />
        </div>
      ) : (
        <div className="empty-state">No project README returned.</div>
      )}
      <div className="project-field-list" aria-label="Organization project fields">
        {project.fields.length > 0 ? (
          project.fields.map((field) => (
            <span className="state-chip" key={field.id}>
              {field.name}
              {field.dataType ? ` · ${field.dataType.toLowerCase().replaceAll("_", " ")}` : ""}
            </span>
          ))
        ) : (
          <span className="action-disabled-note">No project fields returned.</span>
        )}
      </div>
      <div className="thread-actions">
        {project.htmlUrl && (
          <button type="button" onClick={openProject}>
            <ExternalLink size={16} /> Project GitHub fallback
          </button>
        )}
        {project.ownerHtmlUrl && (
          <button type="button" onClick={openOwner}>
            <ExternalLink size={16} /> Owner GitHub fallback
          </button>
        )}
      </div>
    </aside>
  );
}

function MemberRepositoryRow({
  repository,
  onOpenRepository
}: {
  repository: RepositorySummary;
  onOpenRepository(nameWithOwner: string): void;
}): JSX.Element {
  const metadataParts = repositoryCollectionMetadataParts(repository);
  const visibilityLabel = repository.visibility.toLowerCase();
  const showPrivateChip = repository.isPrivate && visibilityLabel !== "private";

  function openRepository(): void {
    onOpenRepository(repository.nameWithOwner);
  }

  return (
    <button className="contributor-repository-row" type="button" onClick={openRepository}>
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
}

function OrganizationMemberDetailPanel({
  githubReady,
  member,
  profileData,
  profileUrl,
  profileLoading,
  profileError,
  profileAvailabilityMessage,
  memberContext,
  repositories,
  repositoriesLoading,
  repositoriesError,
  repositoriesAvailabilityMessage,
  canExpandRepositories,
  repositoriesLimitHit,
  onExpandRepositories,
  onOpenRepository,
  onOpenExternal
}: {
  githubReady: boolean;
  member: TeamMemberSummary | OrganizationMemberSummary;
  profileData: GitHubAccountProfile | null;
  profileUrl: string | null;
  profileLoading: boolean;
  profileError: Error | null;
  profileAvailabilityMessage: string | null;
  memberContext: string | null;
  repositories: RepositorySummary[];
  repositoriesLoading: boolean;
  repositoriesError: Error | null;
  repositoriesAvailabilityMessage: string | null;
  canExpandRepositories: boolean;
  repositoriesLimitHit: boolean;
  onExpandRepositories(): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const avatarUrl = profileData?.avatarUrl ?? member.avatarUrl;
  const profileName = profileData?.name ?? `@${member.login}`;
  const profileLogin = profileData?.login ?? member.login;
  const hasProfileCopy = Boolean(
    profileData?.bio || profileData?.company || profileData?.location || profileData?.websiteUrl
  );

  function openProfile(): void {
    if (profileUrl) {
      onOpenExternal(profileUrl);
    }
  }

  function openWebsite(): void {
    if (profileData?.websiteUrl) {
      onOpenExternal(profileData.websiteUrl);
    }
  }

  return (
    <aside className="contributor-detail-panel organization-member-detail-panel">
      <div className="contributor-detail-header">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" onError={removeBrokenImage} />
        ) : (
          <span className="mini-avatar">{member.login.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <strong>{profileName}</strong>
          <small>@{profileLogin}</small>
        </div>
        {profileUrl && (
          <button
            className="icon-button"
            type="button"
            aria-label={`Open @${member.login} on GitHub`}
            title={`Open @${member.login} on GitHub`}
            onClick={openProfile}
          >
            <ExternalLink size={15} />
          </button>
        )}
      </div>

      {!githubReady && (
        <div className="muted-row">Cached mode: showing stored member details when available.</div>
      )}
      {profileLoading && !profileData && <div className="loading-state">Loading member profile…</div>}
      {profileError && <div className="error-state">Profile unavailable: {profileError.message}</div>}
      {profileAvailabilityMessage && <div className="error-state">{profileAvailabilityMessage}</div>}
      {memberContext && <div className="muted-row">{memberContext}</div>}

      {hasProfileCopy && (
        <div className="contributor-detail-copy">
          {profileData?.bio && <p>{profileData.bio}</p>}
          {profileData?.company && <small>{profileData.company}</small>}
          {profileData?.location && <small>{profileData.location}</small>}
          {profileData?.websiteUrl && (
            <button type="button" onClick={openWebsite}>
              {profileData.websiteUrl}
            </button>
          )}
        </div>
      )}

      <div className="contributor-stats">
        <span>
          <strong>{formatCompactNumber(profileData?.repositoryCount ?? repositories.length)}</strong>
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
        {repositoriesLoading && <div className="loading-state">Loading repositories…</div>}
        {repositoriesError && (
          <div className="error-state">Repositories unavailable: {repositoriesError.message}</div>
        )}
        {repositoriesAvailabilityMessage && (
          <div className="error-state">{repositoriesAvailabilityMessage}</div>
        )}
        {!repositoriesLoading &&
          !repositoriesError &&
          !repositoriesAvailabilityMessage &&
          repositories.length === 0 && (
            <div className="empty-state">
              {githubReady ? "No repositories available." : "No cached repositories available."}
            </div>
          )}
        {repositories.map((repository) => (
          <MemberRepositoryRow
            key={repository.id}
            repository={repository}
            onOpenRepository={onOpenRepository}
          />
        ))}
        {canExpandRepositories && (
          <div className="table-action-row">
            <button type="button" onClick={onExpandRepositories}>
              Load more repositories
            </button>
          </div>
        )}
        {!canExpandRepositories && repositoriesLimitHit && (
          <div className="muted-row">
            Showing the first {repositories.length} repositories returned by GitHub.
          </div>
        )}
      </div>
    </aside>
  );
}

function OrganizationMemberRow({
  member,
  selectedMemberLogin,
  onSelectOrganizationMember,
  onOpenExternal
}: {
  member: TeamMemberSummary | OrganizationMemberSummary;
  selectedMemberLogin: string | null;
  onSelectOrganizationMember(login: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const selected = member.login === selectedMemberLogin;

  function selectMember(): void {
    onSelectOrganizationMember(member.login);
  }

  function openMember(): void {
    if (member.htmlUrl) {
      onOpenExternal(member.htmlUrl);
    }
  }

  return (
    <div className={`issue-row organization-member-row ${selected ? "selected-action" : ""}`}>
      <button
        className="organization-member-row-main"
        type="button"
        aria-pressed={selected}
        onClick={selectMember}
        title={`View @${member.login} in Control`}
      >
        {member.avatarUrl ? (
          <img className="repo-avatar" src={member.avatarUrl} alt="" />
        ) : (
          <span className="repo-avatar">{member.login.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <strong>{member.login}</strong>
          <small>{member.siteAdmin ? "site admin" : "member"}</small>
        </div>
      </button>
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open ${member.login} on GitHub`}
        disabled={!member.htmlUrl}
        title={member.htmlUrl ? `Open ${member.login} on GitHub` : "Member profile URL unavailable."}
        onClick={openMember}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function OrganizationMembersSection({
  selectedOrganizationLogin,
  members,
  allMembers,
  loading,
  error,
  availabilityMessage,
  canExpand,
  limitHit,
  selectedMemberLogin,
  onExpand,
  onSelectOrganizationMember,
  onOpenExternal
}: {
  selectedOrganizationLogin: string | null;
  members: OrganizationMemberSummary[];
  allMembers: OrganizationMemberSummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  canExpand: boolean;
  limitHit: boolean;
  selectedMemberLogin: string | null;
  onExpand(): void;
  onSelectOrganizationMember(login: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (!selectedOrganizationLogin) {
    return null;
  }

  return (
    <>
      <SectionTitleRow
        label={`${selectedOrganizationLogin} members`}
        canExpand={canExpand}
        expandLabel="Load more members"
        onExpand={onExpand}
      />
      {loading && allMembers.length === 0 && (
        <div className="loading-state">Loading organization members…</div>
      )}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {error && <div className="error-state">Could not load organization members.</div>}
      {!canExpand && limitHit && (
        <div className="muted-row">Showing the first {allMembers.length} members returned by GitHub.</div>
      )}
      {members.map((member) => (
        <OrganizationMemberRow
          key={`organization-member-${member.id}`}
          member={member}
          selectedMemberLogin={selectedMemberLogin}
          onSelectOrganizationMember={onSelectOrganizationMember}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!loading && !error && !availabilityMessage && members.length === 0 && (
        <div className="empty-state">
          {allMembers.length === 0
            ? "No visible organization members returned."
            : "No organization members match this filter."}
        </div>
      )}
    </>
  );
}

function OrganizationRepositoryRow({
  repository,
  pinned,
  repositoryPinDisabledReason,
  fallbackLabel,
  onOpenRepository,
  onToggleRepositoryPin,
  onOpenExternal
}: {
  repository: OrganizationCollectionRepositorySummary;
  pinned: boolean;
  repositoryPinDisabledReason: string | null;
  fallbackLabel: string;
  onOpenRepository(nameWithOwner: string): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const metadataParts = organizationRepositoryCollectionMetadataParts(repository);
  const chips = organizationRepositoryCollectionChips(repository, pinned);

  function openRepository(): void {
    onOpenRepository(repository.nameWithOwner);
  }

  function togglePin(): void {
    onToggleRepositoryPin(repository.nameWithOwner);
  }

  function openFallback(): void {
    onOpenExternal(repository.htmlUrl);
  }

  return (
    <div className="issue-row repository-row repository-row-with-actions">
      <button className="repository-row-main" type="button" onClick={openRepository}>
        <span className="repo-avatar">{repository.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{repository.name}</strong>
          <small>{textParts([repository.description, ...metadataParts])}</small>
        </div>
        <span className="row-chip-stack">
          {chips.map((chip) => (
            <span className="state-chip" key={`${repository.id}-${chip}`}>
              {chip}
            </span>
          ))}
        </span>
      </button>
      <span className="row-action-stack">
        <button
          className={`pin-row-button ${pinned ? "selected-action" : ""}`}
          type="button"
          aria-label={`${pinned ? "Unpin" : "Pin"} ${repository.name}`}
          aria-pressed={pinned}
          disabled={Boolean(repositoryPinDisabledReason)}
          title={repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.nameWithOwner}`}
          onClick={togglePin}
        >
          <Pin size={15} />
        </button>
        <button
          className="pin-row-button"
          type="button"
          aria-label={`Open GitHub fallback for ${repository.name}`}
          title={fallbackLabel}
          onClick={openFallback}
        >
          <ExternalLink size={15} />
        </button>
      </span>
    </div>
  );
}

function OrganizationRepositoriesSection({
  selectedOrganizationLogin,
  repositories,
  allRepositories,
  loading,
  error,
  availabilityMessage,
  canExpand,
  limitHit,
  normalizedCollectionFilter,
  pinnedRepositoryNameSet,
  repositoryPinDisabledReason,
  onExpand,
  onOpenRepository,
  onToggleRepositoryPin,
  onOpenExternal
}: {
  selectedOrganizationLogin: string | null;
  repositories: OrganizationRepositorySummary[];
  allRepositories: OrganizationRepositorySummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  canExpand: boolean;
  limitHit: boolean;
  normalizedCollectionFilter: string;
  pinnedRepositoryNameSet: Set<string>;
  repositoryPinDisabledReason: string | null;
  onExpand(): void;
  onOpenRepository(nameWithOwner: string): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (!selectedOrganizationLogin) {
    return null;
  }

  return (
    <>
      <SectionTitleRow
        label={`${selectedOrganizationLogin} repositories`}
        canExpand={canExpand}
        expandLabel="Load more repositories"
        onExpand={onExpand}
      />
      {loading && allRepositories.length === 0 && (
        <div className="loading-state">Loading organization repositories…</div>
      )}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {error && <div className="error-state">Could not load organization repositories.</div>}
      {!canExpand && limitHit && (
        <div className="muted-row">
          Showing the first {allRepositories.length} repositories returned by GitHub.
        </div>
      )}
      {repositories.map((repository) => (
        <OrganizationRepositoryRow
          key={`org-repository-${repository.id}`}
          repository={repository}
          pinned={pinnedRepositoryNameSet.has(repository.nameWithOwner.toLowerCase())}
          repositoryPinDisabledReason={repositoryPinDisabledReason}
          fallbackLabel={`Open GitHub fallback for ${repository.nameWithOwner}`}
          onOpenRepository={onOpenRepository}
          onToggleRepositoryPin={onToggleRepositoryPin}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!loading && !error && !availabilityMessage && repositories.length === 0 && (
        <div className="empty-state">
          {normalizedCollectionFilter
            ? "No organization repositories match this filter."
            : "No organization repositories returned."}
        </div>
      )}
    </>
  );
}

function OrganizationProjectRow({
  project,
  selectedProjectId,
  onSelectOrganizationProject,
  onOpenExternal
}: {
  project: ProjectSummary;
  selectedProjectId: string | null;
  onSelectOrganizationProject(project: ProjectSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const selected = project.id === selectedProjectId;
  const visibleFieldNames = project.fields
    .slice(0, 4)
    .map((field) => field.name)
    .join(", ");

  function selectProject(): void {
    onSelectOrganizationProject(project);
  }

  function openFallback(): void {
    if (project.htmlUrl) {
      onOpenExternal(project.htmlUrl);
    }
  }

  return (
    <div className={`issue-row organization-project-row ${selected ? "selected-action" : ""}`}>
      <button
        className="organization-project-row-main"
        type="button"
        aria-pressed={selected}
        onClick={selectProject}
        title={`View ${project.title} in Control`}
      >
        <SquareKanban size={17} />
        <div>
          <strong>{project.title}</strong>
          <small>
            {textParts([
              project.number ? `#${project.number}` : null,
              project.itemsCount === null
                ? "items unavailable"
                : `${formatCompactNumber(project.itemsCount)} items`,
              project.fieldsCount === null
                ? "fields unavailable"
                : `${formatCompactNumber(project.fieldsCount)} fields`,
              project.updatedAt ? `updated ${formatRelativeDate(project.updatedAt)}` : null
            ])}
          </small>
          {project.shortDescription && <small>{project.shortDescription}</small>}
          {project.fields.length > 0 && (
            <small>
              Fields: {visibleFieldNames}
              {project.fields.length > 4 ? `, +${project.fields.length - 4}` : ""}
            </small>
          )}
        </div>
        <span className={`state-chip ${project.closed ? "" : "success"}`}>
          {project.closed ? "closed" : "open"}
        </span>
      </button>
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open GitHub fallback for ${project.title}`}
        disabled={!project.htmlUrl}
        title={
          project.htmlUrl
            ? `Open GitHub fallback for ${project.title}`
            : "Organization project URL unavailable."
        }
        onClick={openFallback}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function OrganizationProjectsSection({
  selectedOrganizationLogin,
  projects,
  allProjects,
  loading,
  error,
  availabilityMessage,
  canExpand,
  limitHit,
  selectedProjectId,
  onExpand,
  onSelectOrganizationProject,
  onOpenExternal
}: {
  selectedOrganizationLogin: string | null;
  projects: ProjectSummary[];
  allProjects: ProjectSummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  canExpand: boolean;
  limitHit: boolean;
  selectedProjectId: string | null;
  onExpand(): void;
  onSelectOrganizationProject(project: ProjectSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (!selectedOrganizationLogin) {
    return null;
  }

  return (
    <>
      <SectionTitleRow
        label={`${selectedOrganizationLogin} projects`}
        canExpand={canExpand}
        expandLabel="Load more projects"
        onExpand={onExpand}
      />
      {loading && allProjects.length === 0 && (
        <div className="loading-state">Loading organization projects…</div>
      )}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {error && <div className="error-state">Could not load organization projects.</div>}
      {!canExpand && limitHit && (
        <div className="muted-row">Showing the first {allProjects.length} projects returned by GitHub.</div>
      )}
      {projects.map((project) => (
        <OrganizationProjectRow
          key={project.id}
          project={project}
          selectedProjectId={selectedProjectId}
          onSelectOrganizationProject={onSelectOrganizationProject}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!loading && !error && !availabilityMessage && projects.length === 0 && (
        <div className="empty-state">
          {allProjects.length === 0
            ? "No visible organization projects returned."
            : "No organization projects match this filter."}
        </div>
      )}
    </>
  );
}

function OrganizationTeamRow({
  team,
  selectedTeamSlug,
  onSelectOrganizationTeam,
  onOpenExternal
}: {
  team: TeamSummary;
  selectedTeamSlug: string | null;
  onSelectOrganizationTeam(slug: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const selected = team.slug === selectedTeamSlug;

  function selectTeam(): void {
    onSelectOrganizationTeam(team.slug);
  }

  function openTeam(): void {
    if (team.htmlUrl) {
      onOpenExternal(team.htmlUrl);
    }
  }

  return (
    <div className={`issue-row organization-team-row ${selected ? "selected-action" : ""}`}>
      <button className="organization-row-main" type="button" onClick={selectTeam}>
        <div>
          <strong>{team.name}</strong>
          <small>
            {team.slug} · {team.privacy ?? "team"} · {team.permission ?? "permission unknown"} ·{" "}
            {formatCompactNumber(team.memberCount ?? 0)} members ·{" "}
            {formatCompactNumber(team.repositoryCount ?? 0)} repositories
          </small>
          {team.parent && <small>Parent team: {team.parent.name}</small>}
          {team.description && <small>{team.description}</small>}
        </div>
      </button>
      <button
        className="pin-row-button"
        type="button"
        aria-label={`Open ${team.name} on GitHub`}
        disabled={!team.htmlUrl}
        title={team.htmlUrl ? `Open ${team.name} on GitHub` : "Team URL unavailable."}
        onClick={openTeam}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function OrganizationTeamsSection({
  organizations,
  selectedOrganizationLogin,
  teams,
  allTeams,
  loading,
  error,
  availabilityMessage,
  canExpand,
  limitHit,
  selectedTeamSlug,
  onExpand,
  onSelectOrganizationTeam,
  onOpenExternal
}: {
  organizations: OrganizationSummary[];
  selectedOrganizationLogin: string | null;
  teams: TeamSummary[];
  allTeams: TeamSummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  canExpand: boolean;
  limitHit: boolean;
  selectedTeamSlug: string | null;
  onExpand(): void;
  onSelectOrganizationTeam(slug: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (organizations.length === 0) {
    return null;
  }

  return (
    <>
      <SectionTitleRow
        label={selectedOrganizationLogin ? `${selectedOrganizationLogin} teams` : "Visible teams"}
        canExpand={canExpand}
        expandLabel="Load more teams"
        onExpand={onExpand}
      />
      {loading && allTeams.length === 0 && <div className="loading-state">Loading visible teams…</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {error && <div className="error-state">Could not load visible teams.</div>}
      {!canExpand && limitHit && (
        <div className="muted-row">Showing the first {allTeams.length} teams returned by GitHub.</div>
      )}
      {teams.map((team) => (
        <OrganizationTeamRow
          key={team.id}
          team={team}
          selectedTeamSlug={selectedTeamSlug}
          onSelectOrganizationTeam={onSelectOrganizationTeam}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!loading && !error && !availabilityMessage && teams.length === 0 && (
        <div className="empty-state">
          {allTeams.length === 0
            ? "No visible teams returned for this organization."
            : "No teams match this filter."}
        </div>
      )}
    </>
  );
}

function TeamMembersSection({
  selectedTeam,
  members,
  allMembers,
  loading,
  error,
  availabilityMessage,
  canExpand,
  limitHit,
  selectedMemberLogin,
  onExpand,
  onSelectOrganizationMember,
  onOpenExternal
}: {
  selectedTeam: TeamSummary | null;
  members: TeamMemberSummary[];
  allMembers: TeamMemberSummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  canExpand: boolean;
  limitHit: boolean;
  selectedMemberLogin: string | null;
  onExpand(): void;
  onSelectOrganizationMember(login: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (!selectedTeam) {
    return null;
  }

  return (
    <>
      <SectionTitleRow
        label="Selected team members"
        canExpand={canExpand}
        expandLabel="Load more team members"
        onExpand={onExpand}
      />
      {loading && allMembers.length === 0 && <div className="loading-state">Loading team members…</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {error && <div className="error-state">Could not load team members.</div>}
      {!canExpand && limitHit && (
        <div className="muted-row">
          Showing the first {allMembers.length} team members returned by GitHub.
        </div>
      )}
      {members.map((member) => (
        <OrganizationMemberRow
          key={`team-member-${member.id}`}
          member={member}
          selectedMemberLogin={selectedMemberLogin}
          onSelectOrganizationMember={onSelectOrganizationMember}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!loading && !error && !availabilityMessage && members.length === 0 && (
        <div className="empty-state">
          {allMembers.length === 0
            ? "No visible team members returned."
            : "No team members match this filter."}
        </div>
      )}
    </>
  );
}

function TeamRepositoriesSection({
  selectedTeam,
  repositories,
  allRepositories,
  loading,
  error,
  availabilityMessage,
  canExpand,
  limitHit,
  pinnedRepositoryNameSet,
  repositoryPinDisabledReason,
  onExpand,
  onOpenRepository,
  onToggleRepositoryPin,
  onOpenExternal
}: {
  selectedTeam: TeamSummary | null;
  repositories: OrganizationTeamRepositorySummary[];
  allRepositories: OrganizationTeamRepositorySummary[];
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  canExpand: boolean;
  limitHit: boolean;
  pinnedRepositoryNameSet: Set<string>;
  repositoryPinDisabledReason: string | null;
  onExpand(): void;
  onOpenRepository(nameWithOwner: string): void;
  onToggleRepositoryPin(nameWithOwner: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (!selectedTeam) {
    return null;
  }

  return (
    <>
      <SectionTitleRow
        label={`${selectedTeam.name} repositories`}
        canExpand={canExpand}
        expandLabel="Load more team repositories"
        onExpand={onExpand}
      />
      {loading && allRepositories.length === 0 && (
        <div className="loading-state">Loading team repositories…</div>
      )}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {error && <div className="error-state">Could not load team repositories.</div>}
      {!canExpand && limitHit && (
        <div className="muted-row">
          Showing the first {allRepositories.length} team repositories returned by GitHub.
        </div>
      )}
      {repositories.map((repository) => (
        <OrganizationRepositoryRow
          key={`team-repository-${repository.id}`}
          repository={repository}
          pinned={pinnedRepositoryNameSet.has(repository.nameWithOwner.toLowerCase())}
          repositoryPinDisabledReason={repositoryPinDisabledReason}
          fallbackLabel={`Open GitHub fallback for ${repository.name}`}
          onOpenRepository={onOpenRepository}
          onToggleRepositoryPin={onToggleRepositoryPin}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!loading && !error && !availabilityMessage && repositories.length === 0 && (
        <div className="empty-state">
          {allRepositories.length === 0
            ? "No repositories returned for this team."
            : "No team repositories match this filter."}
        </div>
      )}
    </>
  );
}

function OrganizationsStatus({
  organizations,
  filteredOrganizations,
  organizationsLoading,
  organizationsError,
  organizationsAvailabilityMessage
}: {
  organizations: OrganizationSummary[];
  filteredOrganizations: OrganizationSummary[];
  organizationsLoading: boolean;
  organizationsError: Error | null;
  organizationsAvailabilityMessage: string | null;
}): JSX.Element {
  return (
    <>
      {!organizationsLoading &&
        !organizationsError &&
        !organizationsAvailabilityMessage &&
        filteredOrganizations.length === 0 && (
          <div className="empty-state">
            {organizations.length === 0
              ? "No GitHub organizations returned."
              : "No organizations match this filter."}
          </div>
        )}
      {organizationsLoading && organizations.length === 0 && (
        <div className="loading-state">Loading GitHub organizations…</div>
      )}
      {organizationsError && <div className="error-state">Could not load GitHub organizations.</div>}
      {organizationsAvailabilityMessage && (
        <div className="error-state">{organizationsAvailabilityMessage}</div>
      )}
    </>
  );
}

function useOrganizationsRouteModel({
  githubReady,
  routeState,
  pinnedRepositoryNames,
  repositoryPinBusy
}: Pick<
  OrganizationsRouteProps,
  "githubReady" | "routeState" | "pinnedRepositoryNames" | "repositoryPinBusy"
>) {
  const {
    organizations,
    selectedOrganizationLogin,
    organizationListLimit,
    organizationsAvailability,
    organizationsLoading,
    organizationsError,
    organizationTeams,
    organizationTeamLimit,
    organizationTeamsAvailability,
    organizationTeamsLoading,
    organizationTeamsError,
    organizationRepositories,
    organizationRepositoriesAvailability,
    organizationRepositoryLimit,
    organizationRepositoriesLoading,
    organizationRepositoriesError,
    organizationMembers,
    organizationMembersAvailability,
    organizationMemberLimit,
    organizationMembersLoading,
    organizationMembersError,
    selectedOrganizationMemberLogin,
    selectedOrganizationTeamSlug,
    organizationTeamRepositories,
    organizationTeamRepositoriesAvailability,
    organizationTeamRepositoryLimit,
    organizationTeamRepositoriesLoading,
    organizationTeamRepositoriesError,
    organizationTeamMembers,
    organizationTeamMembersAvailability,
    organizationTeamMemberLimit,
    organizationTeamMembersLoading,
    organizationTeamMembersError,
    organizationProjects,
    organizationProjectsAvailability,
    organizationProjectLimit,
    organizationProjectsLoading,
    organizationProjectsError,
    selectedOrganizationProjectId,
    onSelectOrganization,
    onSelectOrganizationTeam,
    onSelectOrganizationMember,
    onSelectOrganizationProject,
    expandOrganizationList: onExpandOrganizations,
    expandSelectedOrganizationRepositories: onExpandOrganizationRepositories,
    expandSelectedOrganizationTeams: onExpandOrganizationTeams,
    expandSelectedOrganizationMembers: onExpandOrganizationMembers,
    expandSelectedOrganizationProjects: onExpandOrganizationProjects,
    expandSelectedOrganizationTeamRepositories: onExpandOrganizationTeamRepositories,
    expandSelectedOrganizationTeamMembers: onExpandOrganizationTeamMembers
  } = routeState;
  const api = useControlApi();
  const [collectionFilter, setCollectionFilter] = useState("");
  const [profileRepositoryLimits, setProfileRepositoryLimits] = useState<Record<string, number>>({});
  const organizationsLimitHit = organizations.length >= organizationListLimit;
  const canExpandOrganizations = organizationsLimitHit && organizationListLimit < maxOrganizationListLimit;
  const {
    normalizedCollectionFilter,
    filteredOrganizations,
    selectedOrganization,
    selectedOrganizationRepositories,
    filteredOrganizationProjects,
    selectedOrganizationProject,
    filteredOrganizationTeams,
    selectedOrganizationTeam,
    filteredOrganizationTeamRepositories,
    filteredOrganizationTeamMembers,
    filteredOrganizationMembers,
    selectedOrganizationMember,
    selectedOrganizationMemberRepositoryLimit,
    selectedOrganizationMemberContext
  } = useOrganizationRouteDerivedState({
    organizations,
    organizationRepositories,
    organizationProjects,
    organizationTeams,
    organizationTeamRepositories,
    organizationTeamMembers,
    organizationMembers,
    selectedOrganizationLogin,
    selectedOrganizationProjectId,
    selectedOrganizationTeamSlug,
    selectedOrganizationMemberLogin,
    collectionFilter,
    profileRepositoryLimits
  });
  const selectedOrganizationMemberProfile = useQuery<AccountProfileResult>({
    queryKey: ["github-account-profile", selectedOrganizationMember?.login ?? null],
    queryFn: () =>
      api.github.getAccountProfileWithStatus({
        login: selectedOrganizationMember?.login ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedOrganizationMember)
  });
  const selectedOrganizationMemberRepositories = useQuery<AccountRepositoryListResult>({
    queryKey: [
      "github-account-repositories",
      selectedOrganizationMember?.login ?? null,
      selectedOrganizationMemberRepositoryLimit
    ],
    queryFn: () =>
      api.github.listAccountRepositoriesWithStatus({
        login: selectedOrganizationMember?.login ?? undefined,
        limit: selectedOrganizationMemberRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedOrganizationMember)
  });
  const selectedOrganizationMemberRepositoryItems = selectedOrganizationMemberRepositories.data?.items ?? [];
  const selectedOrganizationMemberRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Member repositories",
    selectedOrganizationMemberRepositories.data?.availability ?? null
  );
  const selectedOrganizationMemberRepositoriesLimitHit =
    selectedOrganizationMemberRepositoryItems.length >= selectedOrganizationMemberRepositoryLimit;
  const canExpandSelectedOrganizationMemberRepositories =
    selectedOrganizationMemberRepositoriesLimitHit &&
    selectedOrganizationMemberRepositoryLimit < maxProfileRepositoryLimit;
  const selectedOrganizationMemberProfileData = selectedOrganizationMemberProfile.data?.profile ?? null;
  const selectedOrganizationMemberProfileAvailabilityMessage = readAvailabilityMessage(
    "Profile",
    selectedOrganizationMemberProfile.data?.availability ?? null
  );
  const selectedOrganizationMemberProfileUrl =
    selectedOrganizationMemberProfileData?.htmlUrl ?? selectedOrganizationMember?.htmlUrl ?? null;
  const organizationProjectsAvailabilityMessage = readAvailabilityMessage(
    "Organization projects",
    organizationProjectsAvailability
  );
  const organizationsAvailabilityMessage = readAvailabilityMessage(
    "Organizations",
    organizationsAvailability
  );
  const organizationRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Organization repositories",
    organizationRepositoriesAvailability
  );
  const organizationRepositoriesLimitHit = organizationRepositories.length >= organizationRepositoryLimit;
  const canExpandOrganizationRepositories =
    organizationRepositoriesLimitHit && organizationRepositoryLimit < maxOrganizationRepositoryLimit;
  const organizationTeamsLimitHit = organizationTeams.length >= organizationTeamLimit;
  const canExpandOrganizationTeams =
    organizationTeamsLimitHit && organizationTeamLimit < maxOrganizationTeamLimit;
  const organizationTeamsAvailabilityMessage = readAvailabilityMessage(
    "Organization teams",
    organizationTeamsAvailability
  );
  const organizationMembersAvailabilityMessage = readAvailabilityMessage(
    "Organization members",
    organizationMembersAvailability
  );
  const organizationMembersLimitHit = organizationMembers.length >= organizationMemberLimit;
  const canExpandOrganizationMembers =
    organizationMembersLimitHit && organizationMemberLimit < maxOrganizationMemberLimit;
  const organizationProjectsLimitHit = organizationProjects.length >= organizationProjectLimit;
  const canExpandOrganizationProjects =
    organizationProjectsLimitHit && organizationProjectLimit < maxOrganizationProjectLimit;
  const organizationTeamRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Team repositories",
    organizationTeamRepositoriesAvailability
  );
  const organizationTeamRepositoriesLimitHit =
    organizationTeamRepositories.length >= organizationTeamRepositoryLimit;
  const canExpandOrganizationTeamRepositories =
    organizationTeamRepositoriesLimitHit &&
    organizationTeamRepositoryLimit < maxOrganizationTeamRepositoryLimit;
  const organizationTeamMembersAvailabilityMessage = readAvailabilityMessage(
    "Team members",
    organizationTeamMembersAvailability
  );
  const organizationTeamMembersLimitHit = organizationTeamMembers.length >= organizationTeamMemberLimit;
  const canExpandOrganizationTeamMembers =
    organizationTeamMembersLimitHit && organizationTeamMemberLimit < maxOrganizationTeamMemberLimit;
  const selectedOrganizationMembershipAvailabilityMessage = readAvailabilityMessage(
    "Organization membership",
    selectedOrganization?.viewerMembershipAvailability ?? null
  );
  const repositoryPinDisabledReason = repositoryPinBusy ? "Repository pin update is still running." : null;
  const pinnedRepositoryNameSet = useMemo(
    () => new Set(pinnedRepositoryNames.map((nameWithOwner) => nameWithOwner.toLowerCase())),
    [pinnedRepositoryNames]
  );
  const selectedOrganizationMemberProfileError =
    selectedOrganizationMemberProfile.error instanceof Error ? selectedOrganizationMemberProfile.error : null;
  const selectedOrganizationMemberRepositoriesError =
    selectedOrganizationMemberRepositories.error instanceof Error
      ? selectedOrganizationMemberRepositories.error
      : null;
  const selectedOrganizationMemberProfileLoading =
    selectedOrganizationMemberProfile.isFetching && !selectedOrganizationMemberProfileData;
  const selectedOrganizationMemberRepositoriesLoading =
    selectedOrganizationMemberRepositories.isFetching && !selectedOrganizationMemberRepositories.data;

  function expandSelectedOrganizationMemberRepositories(): void {
    if (!selectedOrganizationMember) {
      return;
    }
    setProfileRepositoryLimits((limits) => {
      const currentLimit = limits[selectedOrganizationMember.login] ?? defaultMemberProfileRepositoryLimit;
      if (currentLimit >= maxProfileRepositoryLimit) {
        return limits;
      }
      const nextLimit = currentLimit < 50 ? 50 : maxProfileRepositoryLimit;
      return { ...limits, [selectedOrganizationMember.login]: nextLimit };
    });
  }

  return {
    collectionFilter,
    setCollectionFilter,
    organizations,
    selectedOrganizationLogin,
    organizationListLimit,
    organizationsLoading,
    organizationsError,
    organizationTeams,
    organizationTeamsLoading,
    organizationTeamsError,
    organizationRepositories,
    organizationRepositoriesLoading,
    organizationRepositoriesError,
    organizationMembers,
    organizationMembersLoading,
    organizationMembersError,
    organizationTeamRepositories,
    organizationTeamRepositoriesLoading,
    organizationTeamRepositoriesError,
    organizationTeamMembers,
    organizationTeamMembersLoading,
    organizationTeamMembersError,
    organizationProjects,
    organizationProjectsLoading,
    organizationProjectsError,
    onSelectOrganization,
    onSelectOrganizationTeam,
    onSelectOrganizationMember,
    onSelectOrganizationProject,
    onExpandOrganizations,
    onExpandOrganizationRepositories,
    onExpandOrganizationTeams,
    onExpandOrganizationMembers,
    onExpandOrganizationProjects,
    onExpandOrganizationTeamRepositories,
    onExpandOrganizationTeamMembers,
    normalizedCollectionFilter,
    filteredOrganizations,
    selectedOrganization,
    selectedOrganizationRepositories,
    filteredOrganizationProjects,
    selectedOrganizationProject,
    filteredOrganizationTeams,
    selectedOrganizationTeam,
    filteredOrganizationTeamRepositories,
    filteredOrganizationTeamMembers,
    filteredOrganizationMembers,
    selectedOrganizationMember,
    selectedOrganizationMemberContext,
    selectedOrganizationMemberRepositoryItems,
    selectedOrganizationMemberRepositoriesAvailabilityMessage,
    selectedOrganizationMemberRepositoriesLimitHit,
    canExpandSelectedOrganizationMemberRepositories,
    selectedOrganizationMemberProfileData,
    selectedOrganizationMemberProfileAvailabilityMessage,
    selectedOrganizationMemberProfileUrl,
    selectedOrganizationMemberProfileError,
    selectedOrganizationMemberRepositoriesError,
    selectedOrganizationMemberProfileLoading,
    selectedOrganizationMemberRepositoriesLoading,
    organizationProjectsAvailabilityMessage,
    organizationsAvailabilityMessage,
    organizationRepositoriesAvailabilityMessage,
    organizationRepositoriesLimitHit,
    canExpandOrganizationRepositories,
    organizationTeamsLimitHit,
    canExpandOrganizationTeams,
    organizationTeamsAvailabilityMessage,
    organizationMembersAvailabilityMessage,
    organizationMembersLimitHit,
    canExpandOrganizationMembers,
    organizationProjectsLimitHit,
    canExpandOrganizationProjects,
    organizationTeamRepositoriesAvailabilityMessage,
    organizationTeamRepositoriesLimitHit,
    canExpandOrganizationTeamRepositories,
    organizationTeamMembersAvailabilityMessage,
    organizationTeamMembersLimitHit,
    canExpandOrganizationTeamMembers,
    selectedOrganizationMembershipAvailabilityMessage,
    repositoryPinDisabledReason,
    organizationsLimitHit,
    canExpandOrganizations,
    pinnedRepositoryNameSet,
    expandSelectedOrganizationMemberRepositories
  };
}

export function OrganizationsRoute({
  title,
  githubReady,
  routeState,
  pinnedRepositoryNames,
  repositoryPinBusy,
  repositoryPinError,
  onOpenExternal,
  onOpenRepository,
  onToggleRepositoryPin,
  onRefresh
}: OrganizationsRouteProps): JSX.Element {
  const model = useOrganizationsRouteModel({
    githubReady,
    routeState,
    pinnedRepositoryNames,
    repositoryPinBusy
  });
  const {
    collectionFilter,
    setCollectionFilter,
    organizations,
    selectedOrganizationLogin,
    organizationListLimit,
    organizationsLoading,
    organizationsError,
    organizationTeams,
    organizationTeamsLoading,
    organizationTeamsError,
    organizationRepositories,
    organizationRepositoriesLoading,
    organizationRepositoriesError,
    organizationMembers,
    organizationMembersLoading,
    organizationMembersError,
    organizationTeamRepositories,
    organizationTeamRepositoriesLoading,
    organizationTeamRepositoriesError,
    organizationTeamMembers,
    organizationTeamMembersLoading,
    organizationTeamMembersError,
    organizationProjects,
    organizationProjectsLoading,
    organizationProjectsError,
    onSelectOrganization,
    onSelectOrganizationTeam,
    onSelectOrganizationMember,
    onSelectOrganizationProject,
    onExpandOrganizations,
    onExpandOrganizationRepositories,
    onExpandOrganizationTeams,
    onExpandOrganizationMembers,
    onExpandOrganizationProjects,
    onExpandOrganizationTeamRepositories,
    onExpandOrganizationTeamMembers,
    normalizedCollectionFilter,
    filteredOrganizations,
    selectedOrganization,
    selectedOrganizationRepositories,
    filteredOrganizationProjects,
    selectedOrganizationProject,
    filteredOrganizationTeams,
    selectedOrganizationTeam,
    filteredOrganizationTeamRepositories,
    filteredOrganizationTeamMembers,
    filteredOrganizationMembers,
    selectedOrganizationMember,
    selectedOrganizationMemberContext,
    selectedOrganizationMemberRepositoryItems,
    selectedOrganizationMemberRepositoriesAvailabilityMessage,
    selectedOrganizationMemberRepositoriesLimitHit,
    canExpandSelectedOrganizationMemberRepositories,
    selectedOrganizationMemberProfileData,
    selectedOrganizationMemberProfileAvailabilityMessage,
    selectedOrganizationMemberProfileUrl,
    selectedOrganizationMemberProfileError,
    selectedOrganizationMemberRepositoriesError,
    selectedOrganizationMemberProfileLoading,
    selectedOrganizationMemberRepositoriesLoading,
    organizationProjectsAvailabilityMessage,
    organizationsAvailabilityMessage,
    organizationRepositoriesAvailabilityMessage,
    organizationRepositoriesLimitHit,
    canExpandOrganizationRepositories,
    organizationTeamsLimitHit,
    canExpandOrganizationTeams,
    organizationTeamsAvailabilityMessage,
    organizationMembersAvailabilityMessage,
    organizationMembersLimitHit,
    canExpandOrganizationMembers,
    organizationProjectsLimitHit,
    canExpandOrganizationProjects,
    organizationTeamRepositoriesAvailabilityMessage,
    organizationTeamRepositoriesLimitHit,
    canExpandOrganizationTeamRepositories,
    organizationTeamMembersAvailabilityMessage,
    organizationTeamMembersLimitHit,
    canExpandOrganizationTeamMembers,
    selectedOrganizationMembershipAvailabilityMessage,
    repositoryPinDisabledReason,
    organizationsLimitHit,
    canExpandOrganizations,
    pinnedRepositoryNameSet,
    expandSelectedOrganizationMemberRepositories
  } = model;

  return (
    <section className="collection-view">
      <OrganizationsRouteHeader
        title={title}
        refreshInFlight={routeState.refreshInFlight}
        onRefresh={onRefresh}
        onOpenExternal={onOpenExternal}
      />
      <div className="table-panel">
        <OrganizationFilterRow collectionFilter={collectionFilter} onFilterChange={setCollectionFilter} />
        {repositoryPinError && (
          <div className="error-state">Local repository pin update failed: {repositoryPinError.message}</div>
        )}
        <OrganizationListSection
          organizations={filteredOrganizations}
          selectedOrganizationLogin={selectedOrganizationLogin}
          organizationListLimit={organizationListLimit}
          organizationsLimitHit={organizationsLimitHit}
          canExpandOrganizations={canExpandOrganizations}
          onSelectOrganization={onSelectOrganization}
          onExpandOrganizations={onExpandOrganizations}
          onOpenExternal={onOpenExternal}
        />
        {selectedOrganization && (
          <OrganizationProfileSummary
            organization={selectedOrganization}
            membershipAvailabilityMessage={selectedOrganizationMembershipAvailabilityMessage}
            onOpenExternal={onOpenExternal}
          />
        )}
        {selectedOrganizationProject && (
          <OrganizationProjectDetailPanel
            project={selectedOrganizationProject}
            onOpenExternal={onOpenExternal}
          />
        )}
        {selectedOrganizationMember && (
          <OrganizationMemberDetailPanel
            githubReady={githubReady}
            member={selectedOrganizationMember}
            profileData={selectedOrganizationMemberProfileData}
            profileUrl={selectedOrganizationMemberProfileUrl}
            profileLoading={selectedOrganizationMemberProfileLoading}
            profileError={selectedOrganizationMemberProfileError}
            profileAvailabilityMessage={selectedOrganizationMemberProfileAvailabilityMessage}
            memberContext={selectedOrganizationMemberContext}
            repositories={selectedOrganizationMemberRepositoryItems}
            repositoriesLoading={selectedOrganizationMemberRepositoriesLoading}
            repositoriesError={selectedOrganizationMemberRepositoriesError}
            repositoriesAvailabilityMessage={selectedOrganizationMemberRepositoriesAvailabilityMessage}
            canExpandRepositories={canExpandSelectedOrganizationMemberRepositories}
            repositoriesLimitHit={selectedOrganizationMemberRepositoriesLimitHit}
            onExpandRepositories={expandSelectedOrganizationMemberRepositories}
            onOpenRepository={onOpenRepository}
            onOpenExternal={onOpenExternal}
          />
        )}
        <OrganizationMembersSection
          selectedOrganizationLogin={selectedOrganizationLogin}
          members={filteredOrganizationMembers}
          allMembers={organizationMembers}
          loading={organizationMembersLoading}
          error={organizationMembersError}
          availabilityMessage={organizationMembersAvailabilityMessage}
          canExpand={canExpandOrganizationMembers}
          limitHit={organizationMembersLimitHit}
          selectedMemberLogin={selectedOrganizationMember?.login ?? null}
          onExpand={onExpandOrganizationMembers}
          onSelectOrganizationMember={onSelectOrganizationMember}
          onOpenExternal={onOpenExternal}
        />
        <OrganizationRepositoriesSection
          selectedOrganizationLogin={selectedOrganizationLogin}
          repositories={selectedOrganizationRepositories}
          allRepositories={organizationRepositories}
          loading={organizationRepositoriesLoading}
          error={organizationRepositoriesError}
          availabilityMessage={organizationRepositoriesAvailabilityMessage}
          canExpand={canExpandOrganizationRepositories}
          limitHit={organizationRepositoriesLimitHit}
          normalizedCollectionFilter={normalizedCollectionFilter}
          pinnedRepositoryNameSet={pinnedRepositoryNameSet}
          repositoryPinDisabledReason={repositoryPinDisabledReason}
          onExpand={onExpandOrganizationRepositories}
          onOpenRepository={onOpenRepository}
          onToggleRepositoryPin={onToggleRepositoryPin}
          onOpenExternal={onOpenExternal}
        />
        <OrganizationProjectsSection
          selectedOrganizationLogin={selectedOrganizationLogin}
          projects={filteredOrganizationProjects}
          allProjects={organizationProjects}
          loading={organizationProjectsLoading}
          error={organizationProjectsError}
          availabilityMessage={organizationProjectsAvailabilityMessage}
          canExpand={canExpandOrganizationProjects}
          limitHit={organizationProjectsLimitHit}
          selectedProjectId={selectedOrganizationProject?.id ?? null}
          onExpand={onExpandOrganizationProjects}
          onSelectOrganizationProject={onSelectOrganizationProject}
          onOpenExternal={onOpenExternal}
        />
        <OrganizationTeamsSection
          organizations={organizations}
          selectedOrganizationLogin={selectedOrganizationLogin}
          teams={filteredOrganizationTeams}
          allTeams={organizationTeams}
          loading={organizationTeamsLoading}
          error={organizationTeamsError}
          availabilityMessage={organizationTeamsAvailabilityMessage}
          canExpand={canExpandOrganizationTeams}
          limitHit={organizationTeamsLimitHit}
          selectedTeamSlug={selectedOrganizationTeam?.slug ?? null}
          onExpand={onExpandOrganizationTeams}
          onSelectOrganizationTeam={onSelectOrganizationTeam}
          onOpenExternal={onOpenExternal}
        />
        <TeamMembersSection
          selectedTeam={selectedOrganizationTeam}
          members={filteredOrganizationTeamMembers}
          allMembers={organizationTeamMembers}
          loading={organizationTeamMembersLoading}
          error={organizationTeamMembersError}
          availabilityMessage={organizationTeamMembersAvailabilityMessage}
          canExpand={canExpandOrganizationTeamMembers}
          limitHit={organizationTeamMembersLimitHit}
          selectedMemberLogin={selectedOrganizationMember?.login ?? null}
          onExpand={onExpandOrganizationTeamMembers}
          onSelectOrganizationMember={onSelectOrganizationMember}
          onOpenExternal={onOpenExternal}
        />
        <TeamRepositoriesSection
          selectedTeam={selectedOrganizationTeam}
          repositories={filteredOrganizationTeamRepositories}
          allRepositories={organizationTeamRepositories}
          loading={organizationTeamRepositoriesLoading}
          error={organizationTeamRepositoriesError}
          availabilityMessage={organizationTeamRepositoriesAvailabilityMessage}
          canExpand={canExpandOrganizationTeamRepositories}
          limitHit={organizationTeamRepositoriesLimitHit}
          pinnedRepositoryNameSet={pinnedRepositoryNameSet}
          repositoryPinDisabledReason={repositoryPinDisabledReason}
          onExpand={onExpandOrganizationTeamRepositories}
          onOpenRepository={onOpenRepository}
          onToggleRepositoryPin={onToggleRepositoryPin}
          onOpenExternal={onOpenExternal}
        />
        <OrganizationsStatus
          organizations={organizations}
          filteredOrganizations={filteredOrganizations}
          organizationsLoading={organizationsLoading}
          organizationsError={organizationsError}
          organizationsAvailabilityMessage={organizationsAvailabilityMessage}
        />
      </div>
    </section>
  );
}
