import { ExternalLink, Pin, RefreshCw, Search, SquareKanban, X } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AccountProfileResult, AccountRepositoryListResult } from "@shared/github";
import { MarkdownBody, markdownOrganizationProjectUrlContext } from "../MarkdownBody";
import { useControlApi } from "../../hooks/useControlApi";
import { formatCompactNumber, formatRelativeDate } from "../../utils/format";
import { matchesCollectionFilter } from "./collectionUi";
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
import type { OrganizationsRouteState } from "./useOrganizationsRouteState";

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
}: {
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
}): JSX.Element {
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
  const normalizedCollectionFilter = collectionFilter.trim().toLowerCase();
  const actionUrl = "https://github.com/organizations";
  const filteredOrganizations = organizations.filter((organization) =>
    matchesCollectionFilter(
      [
        organization.login,
        organization.name,
        organization.description,
        organization.location,
        organization.websiteUrl
      ],
      normalizedCollectionFilter
    )
  );
  const organizationsLimitHit = organizations.length >= organizationListLimit;
  const canExpandOrganizations = organizationsLimitHit && organizationListLimit < maxOrganizationListLimit;
  const selectedOrganization =
    organizations.find((organization) => organization.login === selectedOrganizationLogin) ??
    organizations[0] ??
    null;
  const selectedOrganizationRepositories = selectedOrganizationLogin
    ? [...organizationRepositories]
        .sort((a, b) => {
          const aTime = new Date(a.pushedAt ?? a.updatedAt ?? 0).getTime();
          const bTime = new Date(b.pushedAt ?? b.updatedAt ?? 0).getTime();
          return bTime - aTime;
        })
        .filter((repository) =>
          matchesCollectionFilter(
            [
              repository.name,
              repository.owner,
              repository.nameWithOwner,
              repository.description,
              repository.visibility,
              repository.permission,
              repository.defaultBranch
            ],
            normalizedCollectionFilter
          )
        )
    : [];
  const filteredOrganizationProjects = organizationProjects.filter((project) =>
    matchesCollectionFilter(
      [
        project.title,
        project.shortDescription,
        project.ownerLogin,
        project.number ? `#${project.number}` : null,
        project.closed ? "closed" : "open",
        project.isPublic === null ? null : project.isPublic ? "public" : "private",
        ...project.fields.map((field) => `${field.name} ${field.dataType ?? ""}`)
      ],
      normalizedCollectionFilter
    )
  );
  const selectedOrganizationProject = selectedOrganizationProjectId
    ? (organizationProjects.find((project) => project.id === selectedOrganizationProjectId) ?? null)
    : null;
  const filteredOrganizationTeams = organizationTeams.filter((team) =>
    matchesCollectionFilter(
      [team.name, team.slug, team.description, team.privacy, team.permission, team.parent?.name],
      normalizedCollectionFilter
    )
  );
  const selectedOrganizationTeam =
    organizationTeams.find((team) => team.slug === selectedOrganizationTeamSlug) ??
    organizationTeams[0] ??
    null;
  const filteredOrganizationTeamRepositories = organizationTeamRepositories.filter((repository) =>
    matchesCollectionFilter(
      [
        repository.name,
        repository.owner,
        repository.nameWithOwner,
        repository.description,
        repository.visibility,
        repository.permission,
        repository.defaultBranch
      ],
      normalizedCollectionFilter
    )
  );
  const filteredOrganizationTeamMembers = organizationTeamMembers.filter((member) =>
    matchesCollectionFilter(
      [member.login, member.siteAdmin ? "site admin" : null],
      normalizedCollectionFilter
    )
  );
  const filteredOrganizationMembers = organizationMembers.filter((member) =>
    matchesCollectionFilter(
      [member.login, member.siteAdmin ? "site admin" : null],
      normalizedCollectionFilter
    )
  );
  const selectedVisibleOrganizationMember =
    filteredOrganizationMembers.find((member) => member.login === selectedOrganizationMemberLogin) ?? null;
  const selectedVisibleTeamMember =
    filteredOrganizationTeamMembers.find((member) => member.login === selectedOrganizationMemberLogin) ??
    null;
  const selectedOrganizationMember = selectedVisibleTeamMember ?? selectedVisibleOrganizationMember;
  const selectedOrganizationMemberRepositoryLimit = selectedOrganizationMember
    ? (profileRepositoryLimits[selectedOrganizationMember.login] ?? defaultMemberProfileRepositoryLimit)
    : defaultMemberProfileRepositoryLimit;
  const selectedOrganizationMemberContext = selectedOrganizationMember
    ? [
        selectedOrganization?.login ? `${selectedOrganization.login} organization` : null,
        selectedVisibleTeamMember && selectedOrganizationTeam
          ? `${selectedOrganizationTeam.name} team`
          : null,
        selectedOrganizationMember.siteAdmin ? "site admin" : "member"
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
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

  return (
    <section className="collection-view">
      <header>
        <h2>{title}</h2>
        <div className="collection-actions">
          <button
            type="button"
            title="Updated organization data"
            disabled={routeState.refreshInFlight}
            onClick={() => void onRefresh()}
          >
            <RefreshCw size={16} />{" "}
            {routeState.refreshInFlight ? "Refreshing organizations" : "Refresh organizations"}
          </button>
          <button type="button" onClick={() => onOpenExternal(actionUrl)}>
            <RefreshCw size={16} /> GitHub fallback
          </button>
        </div>
      </header>
      <div className="table-panel">
        <div className="table-action-row surface-filter-row">
          <label className="surface-filter">
            <Search size={16} />
            <input
              aria-label="Filter organizations"
              placeholder="Filter organizations"
              value={collectionFilter}
              onChange={(event) => setCollectionFilter(event.target.value)}
            />
          </label>
          {collectionFilter.trim() && (
            <button type="button" onClick={() => setCollectionFilter("")}>
              <X size={16} /> Clear
            </button>
          )}
        </div>
        {repositoryPinError && (
          <div className="error-state">Local repository pin update failed: {repositoryPinError.message}</div>
        )}
        {filteredOrganizations.map((organization) => {
          const membershipAvailabilityMessage = readAvailabilityMessage(
            "Organization membership",
            organization.viewerMembershipAvailability
          );

          return (
            <div className="issue-row organization-row" key={organization.id}>
              <button
                className={`organization-row-main ${
                  organization.login === selectedOrganizationLogin ? "selected-action" : ""
                }`}
                type="button"
                onClick={() => onSelectOrganization(organization.login)}
              >
                <span className="repo-avatar">{organization.login.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{organization.name ?? organization.login}</strong>
                  <small>
                    {organization.login} · {formatCompactNumber(organization.repositoryCount)} repositories ·{" "}
                    {formatCompactNumber(organization.teamCount)} teams ·{" "}
                    {organization.viewerMembershipRole ??
                      (organization.viewerCanAdminister
                        ? "admin"
                        : organization.viewerIsMember
                          ? "member"
                          : "visible")}
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
                onClick={() => onOpenExternal(organization.htmlUrl)}
              >
                <ExternalLink size={15} />
              </button>
            </div>
          );
        })}
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
        {selectedOrganization && (
          <section
            className="organization-profile-summary"
            aria-label={`${selectedOrganization.login} profile`}
          >
            {selectedOrganization.avatarUrl ? (
              <img src={selectedOrganization.avatarUrl} alt="" />
            ) : (
              <span className="repo-avatar">{selectedOrganization.login.slice(0, 1).toUpperCase()}</span>
            )}
            <div>
              <h3>{selectedOrganization.name ?? selectedOrganization.login}</h3>
              <small>
                {selectedOrganization.login} ·{" "}
                {selectedOrganization.viewerMembershipRole ??
                  (selectedOrganization.viewerCanAdminister
                    ? "admin"
                    : selectedOrganization.viewerIsMember
                      ? "member"
                      : "visible")}
                {selectedOrganization.viewerMembershipState
                  ? ` · ${selectedOrganization.viewerMembershipState}`
                  : ""}
              </small>
              {selectedOrganizationMembershipAvailabilityMessage && (
                <small>{selectedOrganizationMembershipAvailabilityMessage}</small>
              )}
              {selectedOrganization.description && <p>{selectedOrganization.description}</p>}
              <div className="organization-profile-meta">
                <span>{formatCompactNumber(selectedOrganization.repositoryCount)} repos</span>
                <span>{formatCompactNumber(selectedOrganization.teamCount)} teams</span>
                {selectedOrganization.location && <span>{selectedOrganization.location}</span>}
                {selectedOrganization.websiteUrl && <span>{selectedOrganization.websiteUrl}</span>}
              </div>
              <div className="organization-profile-meta">
                <span>
                  {selectedOrganization.viewerCanCreateRepositories
                    ? "can create repos"
                    : "repo creation unavailable"}
                </span>
                <span>
                  {selectedOrganization.viewerCanCreateTeams
                    ? "can create teams"
                    : "team creation unavailable"}
                </span>
              </div>
            </div>
            <button
              className="pin-row-button"
              type="button"
              aria-label={`Open ${selectedOrganization.login} on GitHub`}
              title={`Open ${selectedOrganization.login} on GitHub`}
              onClick={() => onOpenExternal(selectedOrganization.htmlUrl)}
            >
              <ExternalLink size={15} />
            </button>
          </section>
        )}
        {selectedOrganizationProject && (
          <aside className="contributor-detail-panel organization-project-detail-panel">
            <div className="contributor-detail-header">
              <SquareKanban size={22} />
              <div>
                <strong>{selectedOrganizationProject.title}</strong>
                <small>
                  {[
                    selectedOrganizationProject.number ? `#${selectedOrganizationProject.number}` : null,
                    selectedOrganizationProject.ownerLogin,
                    selectedOrganizationProject.closed ? "closed" : "open"
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              {selectedOrganizationProject.htmlUrl && (
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Open ${selectedOrganizationProject.title} on GitHub`}
                  title={`Open ${selectedOrganizationProject.title} on GitHub`}
                  onClick={() => onOpenExternal(selectedOrganizationProject.htmlUrl!)}
                >
                  <ExternalLink size={15} />
                </button>
              )}
            </div>
            <div className="workflow-summary">
              <span className={`state-chip ${selectedOrganizationProject.closed ? "" : "success"}`}>
                {selectedOrganizationProject.closed ? "closed" : "open"}
              </span>
              <span>
                {selectedOrganizationProject.isPublic === null
                  ? "Visibility unknown"
                  : selectedOrganizationProject.isPublic
                    ? "Public"
                    : "Private"}
              </span>
              <span>
                {selectedOrganizationProject.itemsCount === null
                  ? "Items unavailable"
                  : `${formatCompactNumber(selectedOrganizationProject.itemsCount)} items`}
              </span>
              <span>
                {selectedOrganizationProject.fieldsCount === null
                  ? "Fields unavailable"
                  : `${formatCompactNumber(selectedOrganizationProject.fieldsCount)} fields`}
              </span>
              {selectedOrganizationProject.viewerCanUpdate !== null && (
                <span>
                  {selectedOrganizationProject.viewerCanUpdate ? "Viewer can update" : "Viewer read-only"}
                </span>
              )}
            </div>
            <div className="muted-row">
              {[
                selectedOrganizationProject.createdAt
                  ? `Created ${formatRelativeDate(selectedOrganizationProject.createdAt)}`
                  : null,
                selectedOrganizationProject.updatedAt
                  ? `Updated ${formatRelativeDate(selectedOrganizationProject.updatedAt)}`
                  : null,
                selectedOrganizationProject.closedAt
                  ? `Closed ${formatRelativeDate(selectedOrganizationProject.closedAt)}`
                  : null
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {selectedOrganizationProject.shortDescription && (
              <p className="project-description">{selectedOrganizationProject.shortDescription}</p>
            )}
            {selectedOrganizationProject.readme ? (
              <div className="project-readme-panel">
                <MarkdownBody
                  markdown={selectedOrganizationProject.readme}
                  onOpenExternal={onOpenExternal}
                  urlContext={markdownOrganizationProjectUrlContext(selectedOrganizationProject)}
                />
              </div>
            ) : (
              <div className="empty-state">No project README returned.</div>
            )}
            <div className="project-field-list" aria-label="Organization project fields">
              {selectedOrganizationProject.fields.length > 0 ? (
                selectedOrganizationProject.fields.map((field) => (
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
              {selectedOrganizationProject.htmlUrl && (
                <button type="button" onClick={() => onOpenExternal(selectedOrganizationProject.htmlUrl!)}>
                  <ExternalLink size={16} /> Project GitHub fallback
                </button>
              )}
              {selectedOrganizationProject.ownerHtmlUrl && (
                <button
                  type="button"
                  onClick={() => onOpenExternal(selectedOrganizationProject.ownerHtmlUrl!)}
                >
                  <ExternalLink size={16} /> Owner GitHub fallback
                </button>
              )}
            </div>
          </aside>
        )}
        {selectedOrganizationMember && (
          <aside className="contributor-detail-panel organization-member-detail-panel">
            <div className="contributor-detail-header">
              {(selectedOrganizationMemberProfileData?.avatarUrl ?? selectedOrganizationMember.avatarUrl) ? (
                <img
                  src={
                    selectedOrganizationMemberProfileData?.avatarUrl ??
                    selectedOrganizationMember.avatarUrl ??
                    undefined
                  }
                  alt=""
                  onError={(event) => event.currentTarget.remove()}
                />
              ) : (
                <span className="mini-avatar">
                  {selectedOrganizationMember.login.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <strong>
                  {selectedOrganizationMemberProfileData?.name ?? `@${selectedOrganizationMember.login}`}
                </strong>
                <small>
                  @{selectedOrganizationMemberProfileData?.login ?? selectedOrganizationMember.login}
                </small>
              </div>
              {selectedOrganizationMemberProfileUrl && (
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Open @${selectedOrganizationMember.login} on GitHub`}
                  title={`Open @${selectedOrganizationMember.login} on GitHub`}
                  onClick={() => onOpenExternal(selectedOrganizationMemberProfileUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              )}
            </div>

            {!githubReady && (
              <div className="muted-row">Cached mode: showing stored member details when available.</div>
            )}
            {selectedOrganizationMemberProfile.isFetching && !selectedOrganizationMemberProfileData && (
              <div className="loading-state">Loading member profile…</div>
            )}
            {selectedOrganizationMemberProfile.error instanceof Error && (
              <div className="error-state">
                Profile unavailable: {selectedOrganizationMemberProfile.error.message}
              </div>
            )}
            {selectedOrganizationMemberProfileAvailabilityMessage && (
              <div className="error-state">{selectedOrganizationMemberProfileAvailabilityMessage}</div>
            )}
            {selectedOrganizationMemberContext && (
              <div className="muted-row">{selectedOrganizationMemberContext}</div>
            )}

            {(selectedOrganizationMemberProfileData?.bio ||
              selectedOrganizationMemberProfileData?.company ||
              selectedOrganizationMemberProfileData?.location ||
              selectedOrganizationMemberProfileData?.websiteUrl) && (
              <div className="contributor-detail-copy">
                {selectedOrganizationMemberProfileData.bio && (
                  <p>{selectedOrganizationMemberProfileData.bio}</p>
                )}
                {selectedOrganizationMemberProfileData.company && (
                  <small>{selectedOrganizationMemberProfileData.company}</small>
                )}
                {selectedOrganizationMemberProfileData.location && (
                  <small>{selectedOrganizationMemberProfileData.location}</small>
                )}
                {selectedOrganizationMemberProfileData.websiteUrl && (
                  <button
                    type="button"
                    onClick={() => onOpenExternal(selectedOrganizationMemberProfileData.websiteUrl!)}
                  >
                    {selectedOrganizationMemberProfileData.websiteUrl}
                  </button>
                )}
              </div>
            )}

            <div className="contributor-stats">
              <span>
                <strong>
                  {formatCompactNumber(
                    selectedOrganizationMemberProfileData?.repositoryCount ??
                      selectedOrganizationMemberRepositoryItems.length
                  )}
                </strong>
                <small>Repositories</small>
              </span>
              <span>
                <strong>
                  {formatCompactNumber(selectedOrganizationMemberProfileData?.starredRepositoryCount ?? 0)}
                </strong>
                <small>Starred</small>
              </span>
              <span>
                <strong>{formatCompactNumber(selectedOrganizationMemberProfileData?.followers ?? 0)}</strong>
                <small>Followers</small>
              </span>
              <span>
                <strong>{formatCompactNumber(selectedOrganizationMemberProfileData?.following ?? 0)}</strong>
                <small>Following</small>
              </span>
            </div>

            <div className="contributor-repositories">
              <div className="section-title-row">
                <span>Repositories</span>
              </div>
              {selectedOrganizationMemberRepositories.isFetching &&
                !selectedOrganizationMemberRepositories.data && (
                  <div className="loading-state">Loading repositories…</div>
                )}
              {selectedOrganizationMemberRepositories.error instanceof Error && (
                <div className="error-state">
                  Repositories unavailable: {selectedOrganizationMemberRepositories.error.message}
                </div>
              )}
              {selectedOrganizationMemberRepositoriesAvailabilityMessage && (
                <div className="error-state">{selectedOrganizationMemberRepositoriesAvailabilityMessage}</div>
              )}
              {!selectedOrganizationMemberRepositories.isFetching &&
                !selectedOrganizationMemberRepositories.error &&
                !selectedOrganizationMemberRepositoriesAvailabilityMessage &&
                selectedOrganizationMemberRepositoryItems.length === 0 && (
                  <div className="empty-state">
                    {githubReady ? "No repositories available." : "No cached repositories available."}
                  </div>
                )}
              {selectedOrganizationMemberRepositoryItems.map((repository) => {
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
              {canExpandSelectedOrganizationMemberRepositories && (
                <div className="table-action-row">
                  <button type="button" onClick={expandSelectedOrganizationMemberRepositories}>
                    Load more repositories
                  </button>
                </div>
              )}
              {!canExpandSelectedOrganizationMemberRepositories &&
                selectedOrganizationMemberRepositoriesLimitHit && (
                  <div className="muted-row">
                    Showing the first {selectedOrganizationMemberRepositoryItems.length} repositories returned
                    by GitHub.
                  </div>
                )}
            </div>
          </aside>
        )}
        {selectedOrganizationLogin && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationLogin} members</div>
            {canExpandOrganizationMembers && (
              <button type="button" onClick={onExpandOrganizationMembers}>
                Load more members
              </button>
            )}
          </div>
        )}
        {organizationMembersLoading && organizationMembers.length === 0 && (
          <div className="loading-state">Loading organization members…</div>
        )}
        {organizationMembersAvailabilityMessage && (
          <div className="error-state">{organizationMembersAvailabilityMessage}</div>
        )}
        {organizationMembersError && <div className="error-state">Could not load organization members.</div>}
        {!canExpandOrganizationMembers && organizationMembersLimitHit && (
          <div className="muted-row">
            Showing the first {organizationMembers.length} members returned by GitHub.
          </div>
        )}
        {filteredOrganizationMembers.map((member) => (
          <div
            className={`issue-row organization-member-row ${
              member.login === selectedOrganizationMember?.login ? "selected-action" : ""
            }`}
            key={`organization-member-${member.id}`}
          >
            <button
              className="organization-member-row-main"
              type="button"
              aria-pressed={member.login === selectedOrganizationMember?.login}
              onClick={() => onSelectOrganizationMember(member.login)}
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
              onClick={() => {
                if (member.htmlUrl) {
                  onOpenExternal(member.htmlUrl);
                }
              }}
            >
              <ExternalLink size={15} />
            </button>
          </div>
        ))}
        {selectedOrganizationLogin &&
          !organizationMembersLoading &&
          !organizationMembersError &&
          !organizationMembersAvailabilityMessage &&
          filteredOrganizationMembers.length === 0 && (
            <div className="empty-state">
              {organizationMembers.length === 0
                ? "No visible organization members returned."
                : "No organization members match this filter."}
            </div>
          )}
        {selectedOrganizationLogin && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationLogin} repositories</div>
            {canExpandOrganizationRepositories && (
              <button type="button" onClick={onExpandOrganizationRepositories}>
                Load more repositories
              </button>
            )}
          </div>
        )}
        {organizationRepositoriesLoading && organizationRepositories.length === 0 && (
          <div className="loading-state">Loading organization repositories…</div>
        )}
        {organizationRepositoriesAvailabilityMessage && (
          <div className="error-state">{organizationRepositoriesAvailabilityMessage}</div>
        )}
        {organizationRepositoriesError && (
          <div className="error-state">Could not load organization repositories.</div>
        )}
        {!canExpandOrganizationRepositories && organizationRepositoriesLimitHit && (
          <div className="muted-row">
            Showing the first {organizationRepositories.length} repositories returned by GitHub.
          </div>
        )}
        {selectedOrganizationRepositories.map((repository) => {
          const pinned = pinnedRepositoryNames.some(
            (nameWithOwner) => nameWithOwner.toLowerCase() === repository.nameWithOwner.toLowerCase()
          );
          const metadataParts = organizationRepositoryCollectionMetadataParts(repository);
          const chips = organizationRepositoryCollectionChips(repository, pinned);

          return (
            <div
              className="issue-row repository-row repository-row-with-actions"
              key={`org-repository-${repository.id}`}
            >
              <button
                className="repository-row-main"
                type="button"
                onClick={() => onOpenRepository(repository.nameWithOwner)}
              >
                <span className="repo-avatar">{repository.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{repository.name}</strong>
                  <small>{[repository.description, ...metadataParts].filter(Boolean).join(" · ")}</small>
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
                  title={
                    repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.nameWithOwner}`
                  }
                  onClick={() => onToggleRepositoryPin(repository.nameWithOwner)}
                >
                  <Pin size={15} />
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Open GitHub fallback for ${repository.name}`}
                  title={`Open GitHub fallback for ${repository.nameWithOwner}`}
                  onClick={() => onOpenExternal(repository.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </span>
            </div>
          );
        })}
        {selectedOrganizationLogin &&
          !organizationRepositoriesLoading &&
          !organizationRepositoriesError &&
          !organizationRepositoriesAvailabilityMessage &&
          selectedOrganizationRepositories.length === 0 && (
            <div className="empty-state">
              {normalizedCollectionFilter
                ? "No organization repositories match this filter."
                : "No organization repositories returned."}
            </div>
          )}
        {selectedOrganizationLogin && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationLogin} projects</div>
            {canExpandOrganizationProjects && (
              <button type="button" onClick={onExpandOrganizationProjects}>
                Load more projects
              </button>
            )}
          </div>
        )}
        {organizationProjectsLoading && organizationProjects.length === 0 && (
          <div className="loading-state">Loading organization projects…</div>
        )}
        {organizationProjectsAvailabilityMessage && (
          <div className="error-state">{organizationProjectsAvailabilityMessage}</div>
        )}
        {organizationProjectsError && (
          <div className="error-state">Could not load organization projects.</div>
        )}
        {!canExpandOrganizationProjects && organizationProjectsLimitHit && (
          <div className="muted-row">
            Showing the first {organizationProjects.length} projects returned by GitHub.
          </div>
        )}
        {filteredOrganizationProjects.map((project) => (
          <div
            className={`issue-row organization-project-row ${
              project.id === selectedOrganizationProject?.id ? "selected-action" : ""
            }`}
            key={project.id}
          >
            <button
              className="organization-project-row-main"
              type="button"
              aria-pressed={project.id === selectedOrganizationProject?.id}
              onClick={() => onSelectOrganizationProject(project)}
              title={`View ${project.title} in Control`}
            >
              <SquareKanban size={17} />
              <div>
                <strong>{project.title}</strong>
                <small>
                  {[
                    project.number ? `#${project.number}` : null,
                    project.itemsCount === null
                      ? "items unavailable"
                      : `${formatCompactNumber(project.itemsCount)} items`,
                    project.fieldsCount === null
                      ? "fields unavailable"
                      : `${formatCompactNumber(project.fieldsCount)} fields`,
                    project.updatedAt ? `updated ${formatRelativeDate(project.updatedAt)}` : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                {project.shortDescription && <small>{project.shortDescription}</small>}
                {project.fields.length > 0 && (
                  <small>
                    Fields:{" "}
                    {project.fields
                      .slice(0, 4)
                      .map((field) => field.name)
                      .join(", ")}
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
              onClick={() => {
                if (project.htmlUrl) {
                  onOpenExternal(project.htmlUrl);
                }
              }}
            >
              <ExternalLink size={15} />
            </button>
          </div>
        ))}
        {selectedOrganizationLogin &&
          !organizationProjectsLoading &&
          !organizationProjectsError &&
          !organizationProjectsAvailabilityMessage &&
          filteredOrganizationProjects.length === 0 && (
            <div className="empty-state">
              {organizationProjects.length === 0
                ? "No visible organization projects returned."
                : "No organization projects match this filter."}
            </div>
          )}
        {organizations.length > 0 && (
          <div className="section-title-row">
            <div className="collection-section-label">
              {selectedOrganizationLogin ? `${selectedOrganizationLogin} teams` : "Visible teams"}
            </div>
            {canExpandOrganizationTeams && (
              <button type="button" onClick={onExpandOrganizationTeams}>
                Load more teams
              </button>
            )}
          </div>
        )}
        {organizationTeamsLoading && organizationTeams.length === 0 && (
          <div className="loading-state">Loading visible teams…</div>
        )}
        {organizationTeamsAvailabilityMessage && (
          <div className="error-state">{organizationTeamsAvailabilityMessage}</div>
        )}
        {organizationTeamsError && <div className="error-state">Could not load visible teams.</div>}
        {!canExpandOrganizationTeams && organizationTeamsLimitHit && (
          <div className="muted-row">
            Showing the first {organizationTeams.length} teams returned by GitHub.
          </div>
        )}
        {filteredOrganizationTeams.map((team) => (
          <div
            className={`issue-row organization-team-row ${
              team.slug === selectedOrganizationTeam?.slug ? "selected-action" : ""
            }`}
            key={team.id}
          >
            <button
              className="organization-row-main"
              type="button"
              onClick={() => onSelectOrganizationTeam(team.slug)}
            >
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
              onClick={() => {
                if (team.htmlUrl) {
                  onOpenExternal(team.htmlUrl);
                }
              }}
            >
              <ExternalLink size={15} />
            </button>
          </div>
        ))}
        {selectedOrganizationTeam && (
          <div className="section-title-row">
            <div className="collection-section-label">Selected team members</div>
            {canExpandOrganizationTeamMembers && (
              <button type="button" onClick={onExpandOrganizationTeamMembers}>
                Load more team members
              </button>
            )}
          </div>
        )}
        {organizationTeamMembersLoading && organizationTeamMembers.length === 0 && (
          <div className="loading-state">Loading team members…</div>
        )}
        {organizationTeamMembersAvailabilityMessage && (
          <div className="error-state">{organizationTeamMembersAvailabilityMessage}</div>
        )}
        {organizationTeamMembersError && <div className="error-state">Could not load team members.</div>}
        {!canExpandOrganizationTeamMembers && organizationTeamMembersLimitHit && (
          <div className="muted-row">
            Showing the first {organizationTeamMembers.length} team members returned by GitHub.
          </div>
        )}
        {filteredOrganizationTeamMembers.map((member) => (
          <div
            className={`issue-row organization-member-row ${
              member.login === selectedOrganizationMember?.login ? "selected-action" : ""
            }`}
            key={`team-member-${member.id}`}
          >
            <button
              className="organization-member-row-main"
              type="button"
              aria-pressed={member.login === selectedOrganizationMember?.login}
              onClick={() => onSelectOrganizationMember(member.login)}
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
              onClick={() => {
                if (member.htmlUrl) {
                  onOpenExternal(member.htmlUrl);
                }
              }}
            >
              <ExternalLink size={15} />
            </button>
          </div>
        ))}
        {selectedOrganizationTeam &&
          !organizationTeamMembersLoading &&
          !organizationTeamMembersError &&
          !organizationTeamMembersAvailabilityMessage &&
          filteredOrganizationTeamMembers.length === 0 && (
            <div className="empty-state">
              {organizationTeamMembers.length === 0
                ? "No visible team members returned."
                : "No team members match this filter."}
            </div>
          )}
        {selectedOrganizationTeam && (
          <div className="section-title-row">
            <div className="collection-section-label">{selectedOrganizationTeam.name} repositories</div>
            {canExpandOrganizationTeamRepositories && (
              <button type="button" onClick={onExpandOrganizationTeamRepositories}>
                Load more team repositories
              </button>
            )}
          </div>
        )}
        {organizationTeamRepositoriesLoading && organizationTeamRepositories.length === 0 && (
          <div className="loading-state">Loading team repositories…</div>
        )}
        {organizationTeamRepositoriesAvailabilityMessage && (
          <div className="error-state">{organizationTeamRepositoriesAvailabilityMessage}</div>
        )}
        {organizationTeamRepositoriesError && (
          <div className="error-state">Could not load team repositories.</div>
        )}
        {!canExpandOrganizationTeamRepositories && organizationTeamRepositoriesLimitHit && (
          <div className="muted-row">
            Showing the first {organizationTeamRepositories.length} team repositories returned by GitHub.
          </div>
        )}
        {filteredOrganizationTeamRepositories.map((repository) => {
          const pinned = pinnedRepositoryNames.some(
            (nameWithOwner) => nameWithOwner.toLowerCase() === repository.nameWithOwner.toLowerCase()
          );
          const metadataParts = organizationRepositoryCollectionMetadataParts(repository);
          const chips = organizationRepositoryCollectionChips(repository, pinned);

          return (
            <div
              className="issue-row repository-row repository-row-with-actions"
              key={`team-repository-${repository.id}`}
            >
              <button
                className="repository-row-main"
                type="button"
                onClick={() => onOpenRepository(repository.nameWithOwner)}
              >
                <span className="repo-avatar">{repository.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{repository.name}</strong>
                  <small>{[repository.description, ...metadataParts].filter(Boolean).join(" · ")}</small>
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
                  title={
                    repositoryPinDisabledReason ?? `${pinned ? "Unpin" : "Pin"} ${repository.nameWithOwner}`
                  }
                  onClick={() => onToggleRepositoryPin(repository.nameWithOwner)}
                >
                  <Pin size={15} />
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Open GitHub fallback for ${repository.name}`}
                  title={`Open GitHub fallback for ${repository.name}`}
                  onClick={() => onOpenExternal(repository.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </span>
            </div>
          );
        })}
        {selectedOrganizationTeam &&
          !organizationTeamRepositoriesLoading &&
          !organizationTeamRepositoriesError &&
          !organizationTeamRepositoriesAvailabilityMessage &&
          filteredOrganizationTeamRepositories.length === 0 && (
            <div className="empty-state">
              {organizationTeamRepositories.length === 0
                ? "No repositories returned for this team."
                : "No team repositories match this filter."}
            </div>
          )}
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
        {organizations.length > 0 &&
          !organizationTeamsLoading &&
          !organizationTeamsError &&
          !organizationTeamsAvailabilityMessage &&
          filteredOrganizationTeams.length === 0 && (
            <div className="empty-state">
              {organizationTeams.length === 0
                ? "No visible teams returned for this organization."
                : "No teams match this filter."}
            </div>
          )}
      </div>
    </section>
  );
}
