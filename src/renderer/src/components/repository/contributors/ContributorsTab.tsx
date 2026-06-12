import { Search } from "lucide-react";
import {
  Component,
  useMemo,
  type ChangeEvent,
  type ErrorInfo,
  type JSX,
  type ReactNode,
  type SyntheticEvent
} from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  ContributorSummary,
  GitHubAccountProfile,
  RepositorySummary,
  RepositoryDetail
} from "@shared/github";
import { useControlApi } from "../../../hooks/useControlApi";
import type { RepositoryTab } from "../../../stores/uiStore";
import { formatCompactNumber } from "../../../utils/format";
import {
  clearContributorsTabStateForTests,
  useContributorsTabLocalState,
  useContributorsTabStateStore
} from "./contributorsTabState";
import {
  contributorProfileQueryKey,
  contributorRepositoriesQueryKey,
  useContributorsTabQueries
} from "./ContributorsTab.queries";
import {
  defaultContributorProfileRepositoryLimit,
  fieldsMatchSearchParts,
  maxContributorLimit,
  maxProfileRepositoryLimit,
  normalizedSearchParts,
  readAvailabilityMessage,
  repositoryCollectionMetadataParts
} from "../repositoryUi";

const emptyContributors: ContributorSummary[] = [];

export interface ContributorsTabProps {
  repository: RepositoryDetail;
  githubReady: boolean;
  contributorLimit: number;
  focusedContributorLogin: string | null;
  onOpenRepository(nameWithOwner: string, tab?: RepositoryTab): void;
  onOpenExternal(url: string): void;
  onSelectContributor(contributor: ContributorSummary): void;
  onExpandContributors(): void;
}

export { clearContributorsTabStateForTests };

function contributorsTabStateKey(
  repository: RepositoryDetail,
  focusedContributorLogin: string | null
): string {
  return `${repository.nameWithOwner}:${focusedContributorLogin ?? "default"}`;
}

export function ContributorsTab({ repository, ...props }: ContributorsTabProps): JSX.Element {
  const stateKey = contributorsTabStateKey(repository, props.focusedContributorLogin);
  return (
    <ContributorsTabBoundary resetKey={stateKey}>
      <ContributorsTabContent key={stateKey} repository={repository} {...props} />
    </ContributorsTabBoundary>
  );
}

export class ContributorsTabBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Contributors tab crashed.", error, errorInfo);
  }

  componentDidUpdate(previousProps: { resetKey: string }): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <section className="table-panel github-surface">
          <div className="error-state">Contributors unavailable: {this.state.error.message}</div>
        </section>
      );
    }

    return this.props.children;
  }
}

function removeBrokenAvatar(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.remove();
}

function ContributorsToolbar({
  canExpandContributors,
  filter,
  onExpandContributors,
  onFilterChange
}: {
  canExpandContributors: boolean;
  filter: string;
  onExpandContributors(): void;
  onFilterChange(filterValue: string): void;
}): JSX.Element {
  function handleFilterChange(event: ChangeEvent<HTMLInputElement>): void {
    onFilterChange(event.target.value);
  }

  return (
    <div className="table-action-row surface-filter-row">
      <label className="surface-filter">
        <Search size={15} />
        <input
          aria-label="Filter contributors"
          value={filter}
          onChange={handleFilterChange}
          placeholder="Filter contributors"
        />
      </label>
      {canExpandContributors && (
        <button type="button" onClick={onExpandContributors}>
          Load more contributors
        </button>
      )}
    </div>
  );
}

function ContributorsStatusMessages({
  availabilityMessage,
  canExpandContributors,
  contributorsCount,
  contributorsLimitHit,
  error,
  filteredContributorsCount,
  loading
}: {
  availabilityMessage: string | null;
  canExpandContributors: boolean;
  contributorsCount: number;
  contributorsLimitHit: boolean;
  error: Error | null;
  filteredContributorsCount: number;
  loading: boolean;
}): JSX.Element {
  return (
    <>
      {error && <div className="error-state">Contributors unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {loading && contributorsCount === 0 && <div className="loading-state">Loading contributors…</div>}
      {!loading && !error && !availabilityMessage && contributorsCount === 0 && (
        <div className="empty-state">GitHub returned no contributors for this repository.</div>
      )}
      {!loading && contributorsCount > 0 && filteredContributorsCount === 0 && (
        <div className="empty-state">No contributors match this filter.</div>
      )}
      {!canExpandContributors && contributorsLimitHit && (
        <div className="muted-row">
          Showing the first {contributorsCount} contributors returned by GitHub.
        </div>
      )}
    </>
  );
}

function ContributorCard({
  contributor,
  selected,
  onSelectContributor
}: {
  contributor: ContributorSummary;
  selected: boolean;
  onSelectContributor(contributor: ContributorSummary): void;
}): JSX.Element {
  function handleSelectContributor(): void {
    onSelectContributor(contributor);
  }

  return (
    <div className={`contributor-card ${selected ? "selected" : ""}`}>
      <button
        className="contributor-card-main"
        type="button"
        aria-pressed={selected}
        onClick={handleSelectContributor}
        title={`View @${contributor.login} in Control`}
      >
        {contributor.avatarUrl ? (
          <img src={contributor.avatarUrl} alt="" onError={removeBrokenAvatar} />
        ) : (
          <span className="mini-avatar">{contributor.login.slice(0, 1).toUpperCase()}</span>
        )}
        <span>
          <strong>@{contributor.login}</strong>
          <small>{formatCompactNumber(contributor.contributions)} contributions</small>
        </span>
      </button>
    </div>
  );
}

function ContributorGrid({
  contributors,
  selectedContributorLogin,
  onSelectContributor
}: {
  contributors: ContributorSummary[];
  selectedContributorLogin: string | null;
  onSelectContributor(contributor: ContributorSummary): void;
}): JSX.Element {
  return (
    <div className="contributor-grid">
      {contributors.map((contributor) => (
        <ContributorCard
          contributor={contributor}
          key={contributor.id}
          selected={contributor.login === selectedContributorLogin}
          onSelectContributor={onSelectContributor}
        />
      ))}
    </div>
  );
}

function ContributorDetailHeader({
  login,
  profile,
  selectedContributor
}: {
  login: string;
  profile: GitHubAccountProfile | null;
  selectedContributor: ContributorSummary | null;
}): JSX.Element {
  const avatarUrl = profile?.avatarUrl ?? selectedContributor?.avatarUrl ?? null;

  return (
    <div className="contributor-detail-header">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" onError={removeBrokenAvatar} />
      ) : (
        <span className="mini-avatar">{login.slice(0, 1).toUpperCase()}</span>
      )}
      <div>
        <strong>{profile?.name ?? `@${login}`}</strong>
        <small>@{profile?.login ?? login}</small>
      </div>
    </div>
  );
}

function ContributorProfileStatus({
  availabilityMessage,
  error,
  githubReady,
  loading,
  profile
}: {
  availabilityMessage: string | null;
  error: Error | null;
  githubReady: boolean;
  loading: boolean;
  profile: GitHubAccountProfile | null;
}): JSX.Element {
  return (
    <>
      {!githubReady && (
        <div className="muted-row">Cached mode: showing stored contributor details when available.</div>
      )}
      {loading && !profile && <div className="loading-state">Loading profile…</div>}
      {error && <div className="error-state">Profile unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
    </>
  );
}

function ContributorProfileCopy({
  profile,
  onOpenExternal
}: {
  profile: GitHubAccountProfile | null;
  onOpenExternal(url: string): void;
}): JSX.Element | null {
  if (!profile?.bio && !profile?.company && !profile?.location && !profile?.websiteUrl) {
    return null;
  }

  function handleOpenWebsite(): void {
    if (profile?.websiteUrl) {
      onOpenExternal(profile.websiteUrl);
    }
  }

  return (
    <div className="contributor-detail-copy">
      {profile.bio && <p>{profile.bio}</p>}
      {profile.company && <small>{profile.company}</small>}
      {profile.location && <small>{profile.location}</small>}
      {profile.websiteUrl && (
        <button type="button" onClick={handleOpenWebsite}>
          {profile.websiteUrl}
        </button>
      )}
    </div>
  );
}

function ContributorStats({
  profile,
  repositoryCount,
  selectedContributionCount
}: {
  profile: GitHubAccountProfile | null;
  repositoryCount: number;
  selectedContributionCount: number | null;
}): JSX.Element {
  return (
    <div className="contributor-stats">
      <span>
        <strong>{formatCompactNumber(selectedContributionCount ?? 0)}</strong>
        <small>Contributions</small>
      </span>
      <span>
        <strong>{formatCompactNumber(profile?.repositoryCount ?? repositoryCount)}</strong>
        <small>Repositories</small>
      </span>
      <span>
        <strong>{formatCompactNumber(profile?.starredRepositoryCount ?? 0)}</strong>
        <small>Starred</small>
      </span>
      <span>
        <strong>{formatCompactNumber(profile?.followers ?? 0)}</strong>
        <small>Followers</small>
      </span>
    </div>
  );
}

function ContributorRepositoryRow({
  repository,
  onOpenRepository
}: {
  repository: RepositorySummary;
  onOpenRepository(nameWithOwner: string): void;
}): JSX.Element {
  const metadataParts = repositoryCollectionMetadataParts(repository);
  const visibilityLabel = repository.visibility.toLowerCase();
  const showPrivateChip = repository.isPrivate && visibilityLabel !== "private";

  function handleOpenRepository(): void {
    onOpenRepository(repository.nameWithOwner);
  }

  return (
    <button className="contributor-repository-row" type="button" onClick={handleOpenRepository}>
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

function ContributorRepositories({
  availabilityMessage,
  canExpandRepositories,
  error,
  githubReady,
  loading,
  repositories,
  repositoriesLimitHit,
  onExpandRepositories,
  onOpenRepository
}: {
  availabilityMessage: string | null;
  canExpandRepositories: boolean;
  error: Error | null;
  githubReady: boolean;
  loading: boolean;
  repositories: RepositorySummary[];
  repositoriesLimitHit: boolean;
  onExpandRepositories(): void;
  onOpenRepository(nameWithOwner: string): void;
}): JSX.Element {
  return (
    <div className="contributor-repositories">
      <div className="section-title-row">
        <span>Repositories</span>
      </div>
      {loading && repositories.length === 0 && <div className="loading-state">Loading repositories…</div>}
      {error && <div className="error-state">Repositories unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {!loading && !error && !availabilityMessage && repositories.length === 0 && (
        <div className="empty-state">
          {githubReady ? "No repositories available." : "No cached repositories available."}
        </div>
      )}
      {repositories.map((contributorRepository) => (
        <ContributorRepositoryRow
          key={contributorRepository.id}
          repository={contributorRepository}
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
  );
}

function ContributorDetailPanel({
  contributionCount,
  githubReady,
  login,
  profile,
  profileAvailabilityMessage,
  profileError,
  profileLoading,
  repositories,
  repositoriesAvailabilityMessage,
  repositoriesCanExpand,
  repositoriesError,
  repositoriesLimitHit,
  repositoriesLoading,
  selectedContributor,
  onExpandRepositories,
  onOpenExternal,
  onOpenRepository
}: {
  contributionCount: number | null;
  githubReady: boolean;
  login: string | null;
  profile: GitHubAccountProfile | null;
  profileAvailabilityMessage: string | null;
  profileError: Error | null;
  profileLoading: boolean;
  repositories: RepositorySummary[];
  repositoriesAvailabilityMessage: string | null;
  repositoriesCanExpand: boolean;
  repositoriesError: Error | null;
  repositoriesLimitHit: boolean;
  repositoriesLoading: boolean;
  selectedContributor: ContributorSummary | null;
  onExpandRepositories(): void;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string): void;
}): JSX.Element {
  if (!login) {
    return (
      <aside className="contributor-detail-panel">
        <div className="empty-state">Select a contributor to inspect their profile.</div>
      </aside>
    );
  }

  return (
    <aside className="contributor-detail-panel">
      <ContributorDetailHeader login={login} profile={profile} selectedContributor={selectedContributor} />
      <ContributorProfileStatus
        availabilityMessage={profileAvailabilityMessage}
        error={profileError}
        githubReady={githubReady}
        loading={profileLoading}
        profile={profile}
      />
      <ContributorProfileCopy profile={profile} onOpenExternal={onOpenExternal} />
      <ContributorStats
        profile={profile}
        repositoryCount={repositories.length}
        selectedContributionCount={contributionCount}
      />
      <ContributorRepositories
        availabilityMessage={repositoriesAvailabilityMessage}
        canExpandRepositories={repositoriesCanExpand}
        error={repositoriesError}
        githubReady={githubReady}
        loading={repositoriesLoading}
        repositories={repositories}
        repositoriesLimitHit={repositoriesLimitHit}
        onExpandRepositories={onExpandRepositories}
        onOpenRepository={onOpenRepository}
      />
    </aside>
  );
}

function ContributorsLayout({
  contributionCount,
  contributors,
  githubReady,
  profile,
  profileAvailabilityMessage,
  profileError,
  profileLoading,
  repositories,
  repositoriesAvailabilityMessage,
  repositoriesCanExpand,
  repositoriesError,
  repositoriesLimitHit,
  repositoriesLoading,
  selectedContributor,
  selectedContributorLogin,
  onExpandRepositories,
  onOpenExternal,
  onOpenRepository,
  onSelectContributor
}: {
  contributionCount: number | null;
  contributors: ContributorSummary[];
  githubReady: boolean;
  profile: GitHubAccountProfile | null;
  profileAvailabilityMessage: string | null;
  profileError: Error | null;
  profileLoading: boolean;
  repositories: RepositorySummary[];
  repositoriesAvailabilityMessage: string | null;
  repositoriesCanExpand: boolean;
  repositoriesError: Error | null;
  repositoriesLimitHit: boolean;
  repositoriesLoading: boolean;
  selectedContributor: ContributorSummary | null;
  selectedContributorLogin: string | null;
  onExpandRepositories(): void;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string): void;
  onSelectContributor(contributor: ContributorSummary): void;
}): JSX.Element {
  return (
    <div className="contributors-layout">
      <ContributorGrid
        contributors={contributors}
        selectedContributorLogin={selectedContributorLogin}
        onSelectContributor={onSelectContributor}
      />
      <ContributorDetailPanel
        contributionCount={contributionCount}
        githubReady={githubReady}
        login={selectedContributorLogin}
        profile={profile}
        profileAvailabilityMessage={profileAvailabilityMessage}
        profileError={profileError}
        profileLoading={profileLoading}
        repositories={repositories}
        repositoriesAvailabilityMessage={repositoriesAvailabilityMessage}
        repositoriesCanExpand={repositoriesCanExpand}
        repositoriesError={repositoriesError}
        repositoriesLimitHit={repositoriesLimitHit}
        repositoriesLoading={repositoriesLoading}
        selectedContributor={selectedContributor}
        onExpandRepositories={onExpandRepositories}
        onOpenExternal={onOpenExternal}
        onOpenRepository={onOpenRepository}
      />
    </div>
  );
}

function ContributorsTabContent({
  repository,
  githubReady,
  contributorLimit,
  focusedContributorLogin,
  onOpenRepository,
  onOpenExternal,
  onSelectContributor,
  onExpandContributors
}: ContributorsTabProps): JSX.Element {
  const api = useControlApi();
  const { contributors: contributorsQuery } = useContributorsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: contributorLimit,
    enabled: true,
    githubReady
  });
  const contributors = contributorsQuery.data?.items ?? emptyContributors;
  const availability = contributorsQuery.data?.availability ?? null;
  const loading = contributorsQuery.isLoading || contributorsQuery.isFetching;
  const error = contributorsQuery.error;
  const stateKey = contributorsTabStateKey(repository, focusedContributorLogin);
  const { filter, selectedContributorLogin, profileRepositoryLimits } =
    useContributorsTabLocalState(stateKey);
  const updateTabState = useContributorsTabStateStore((state) => state.updateState);

  function setFilter(filterValue: string): void {
    updateTabState(stateKey, { filter: filterValue });
  }

  function setSelectedContributorLogin(login: string | null): void {
    updateTabState(stateKey, { selectedContributorLogin: login });
  }

  function updateProfileRepositoryLimit(login: string, limit: number): void {
    const currentLimits =
      useContributorsTabStateStore.getState().records[stateKey]?.profileRepositoryLimits ?? {};
    updateTabState(stateKey, {
      profileRepositoryLimits: {
        ...currentLimits,
        [login]: limit
      }
    });
  }
  const filterParts = useMemo(() => normalizedSearchParts(filter), [filter]);
  const filteredContributors = useMemo(
    () =>
      contributors.filter((contributor) =>
        fieldsMatchSearchParts([contributor.login, contributor.contributions], filterParts)
      ),
    [contributors, filterParts]
  );
  const requestedContributorLogin = selectedContributorLogin ?? focusedContributorLogin;
  const requestedContributorVisible =
    requestedContributorLogin !== null &&
    contributors.some((contributor) => contributor.login === requestedContributorLogin) &&
    (filterParts.length === 0 ||
      filteredContributors.some((contributor) => contributor.login === requestedContributorLogin));
  const effectiveSelectedContributorLogin = requestedContributorVisible
    ? requestedContributorLogin
    : (filteredContributors[0]?.login ??
      (filterParts.length === 0 ? (contributors[0]?.login ?? null) : null));
  const selectedContributor =
    contributors.find((contributor) => contributor.login === effectiveSelectedContributorLogin) ?? null;
  const selectedContributorFromFilter =
    filteredContributors.find((contributor) => contributor.login === effectiveSelectedContributorLogin) ??
    null;
  const selectedProfileRepositoryLimit = effectiveSelectedContributorLogin
    ? (profileRepositoryLimits[effectiveSelectedContributorLogin] ?? defaultContributorProfileRepositoryLimit)
    : defaultContributorProfileRepositoryLimit;
  const selectedProfile = useQuery<AccountProfileResult>({
    queryKey: contributorProfileQueryKey(effectiveSelectedContributorLogin),
    queryFn: () =>
      api.github.getAccountProfileWithStatus({
        login: effectiveSelectedContributorLogin ?? undefined,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(effectiveSelectedContributorLogin)
  });
  const selectedRepositories = useQuery<AccountRepositoryListResult>({
    queryKey: contributorRepositoriesQueryKey(
      effectiveSelectedContributorLogin,
      selectedProfileRepositoryLimit
    ),
    queryFn: () =>
      api.github.listAccountRepositoriesWithStatus({
        login: effectiveSelectedContributorLogin ?? undefined,
        limit: selectedProfileRepositoryLimit,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(effectiveSelectedContributorLogin)
  });
  const selectedRepositoryItems = selectedRepositories.data?.items ?? [];
  const selectedRepositoriesAvailabilityMessage = readAvailabilityMessage(
    "Account repositories",
    selectedRepositories.data?.availability ?? null
  );
  const selectedProfileRepositoriesLimitHit =
    selectedRepositoryItems.length >= selectedProfileRepositoryLimit;
  const canExpandSelectedProfileRepositories =
    selectedProfileRepositoriesLimitHit && selectedProfileRepositoryLimit < maxProfileRepositoryLimit;
  const profile = selectedProfile.data?.profile ?? null;
  const selectedProfileAvailabilityMessage = readAvailabilityMessage(
    "Profile",
    selectedProfile.data?.availability ?? null
  );
  const selectedContributionCount =
    selectedContributor?.contributions ?? selectedContributorFromFilter?.contributions ?? null;
  const contributorsLimitHit = contributors.length >= contributorLimit;
  const canExpandContributors = contributorsLimitHit && contributorLimit < maxContributorLimit;
  const availabilityMessage = readAvailabilityMessage("Contributors", availability);

  function expandSelectedProfileRepositories(): void {
    if (!effectiveSelectedContributorLogin) {
      return;
    }
    const currentLimit =
      profileRepositoryLimits[effectiveSelectedContributorLogin] ?? defaultContributorProfileRepositoryLimit;
    if (currentLimit >= maxProfileRepositoryLimit) {
      return;
    }
    const nextLimit = currentLimit < 50 ? 50 : maxProfileRepositoryLimit;
    updateProfileRepositoryLimit(effectiveSelectedContributorLogin, nextLimit);
  }

  function selectContributor(contributor: ContributorSummary): void {
    setSelectedContributorLogin(contributor.login);
    onSelectContributor(contributor);
  }

  return (
    <section className="table-panel github-surface">
      <ContributorsToolbar
        canExpandContributors={canExpandContributors}
        filter={filter}
        onExpandContributors={onExpandContributors}
        onFilterChange={setFilter}
      />
      <ContributorsStatusMessages
        availabilityMessage={availabilityMessage}
        canExpandContributors={canExpandContributors}
        contributorsCount={contributors.length}
        contributorsLimitHit={contributorsLimitHit}
        error={error}
        filteredContributorsCount={filteredContributors.length}
        loading={loading}
      />
      {filteredContributors.length > 0 && (
        <ContributorsLayout
          contributionCount={selectedContributionCount}
          contributors={filteredContributors}
          githubReady={githubReady}
          profile={profile}
          profileAvailabilityMessage={selectedProfileAvailabilityMessage}
          profileError={selectedProfile.error instanceof Error ? selectedProfile.error : null}
          profileLoading={selectedProfile.isFetching}
          repositories={selectedRepositoryItems}
          repositoriesAvailabilityMessage={selectedRepositoriesAvailabilityMessage}
          repositoriesCanExpand={canExpandSelectedProfileRepositories}
          repositoriesError={selectedRepositories.error instanceof Error ? selectedRepositories.error : null}
          repositoriesLimitHit={selectedProfileRepositoriesLimitHit}
          repositoriesLoading={selectedRepositories.isFetching && !selectedRepositories.data}
          selectedContributor={selectedContributor}
          selectedContributorLogin={effectiveSelectedContributorLogin}
          onExpandRepositories={expandSelectedProfileRepositories}
          onOpenExternal={onOpenExternal}
          onOpenRepository={onOpenRepository}
          onSelectContributor={selectContributor}
        />
      )}
    </section>
  );
}
