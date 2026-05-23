import { ExternalLink, Search } from "lucide-react";
import { Component, useMemo, useState, type ErrorInfo, type JSX, type ReactNode } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  AccountProfileResult,
  AccountRepositoryListResult,
  ContributorListResult,
  ContributorSummary,
  RepositoryDetail
} from "@shared/github";
import { useControlApi } from "../../../hooks/useControlApi";
import type { RepositoryTab } from "../../../stores/uiStore";
import { formatCompactNumber } from "../../../utils/format";
import {
  defaultContributorProfileRepositoryLimit,
  fieldsMatchSearchParts,
  maxContributorLimit,
  maxProfileRepositoryLimit,
  normalizedSearchParts,
  readAvailabilityMessage,
  repositoryCollectionMetadataParts,
  repositoryPath
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

export interface ContributorsTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface ContributorsTabPrefetchInput {
  api: ReturnType<typeof useControlApi>;
  githubReady: boolean;
  contributors: ContributorSummary[];
  focusedContributorLogin: string | null;
  profileRepositoryLimit?: number;
}

export interface ContributorsTabRefreshInput {
  api: ReturnType<typeof useControlApi>;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

interface ContributorsTabLocalState {
  filter: string;
  selectedContributorLogin: string | null;
  profileRepositoryLimits: Record<string, number>;
}

const contributorsTabState = new Map<string, ContributorsTabLocalState>();

export function clearContributorsTabStateForTests(): void {
  contributorsTabState.clear();
}

export function contributorsTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["contributors", string, string, number] {
  return ["contributors", owner, repo, limit] as const;
}

export function useContributorsTabQueries({
  owner,
  repo,
  limit,
  enabled,
  githubReady
}: ContributorsTabQueryInput) {
  const api = useControlApi();

  const contributors = useQuery<ContributorListResult>({
    queryKey: contributorsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listContributorsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 120_000
  });

  return { contributors };
}

function contributorsTabStateKey(
  repository: RepositoryDetail,
  focusedContributorLogin: string | null
): string {
  return `${repository.nameWithOwner}:${focusedContributorLogin ?? "default"}`;
}

function readContributorsTabState(key: string): ContributorsTabLocalState {
  return (
    contributorsTabState.get(key) ?? {
      filter: "",
      selectedContributorLogin: null,
      profileRepositoryLimits: {}
    }
  );
}

function updateContributorsTabState(key: string, patch: Partial<ContributorsTabLocalState>): void {
  contributorsTabState.set(key, {
    ...readContributorsTabState(key),
    ...patch
  });
}

export async function prefetchContributorsTabData(
  queryClient: QueryClient,
  input: ContributorsTabPrefetchInput
): Promise<void> {
  const login = firstVisibleContributorLogin(input.contributors, input.focusedContributorLogin);
  if (!login) {
    return;
  }

  const repositoryLimit = input.profileRepositoryLimit ?? defaultContributorProfileRepositoryLimit;
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: contributorProfileQueryKey(login),
      queryFn: () =>
        input.api.github.getAccountProfileWithStatus({
          login,
          cacheOnly: !input.githubReady
        })
    }),
    queryClient.prefetchQuery({
      queryKey: contributorRepositoriesQueryKey(login, repositoryLimit),
      queryFn: () =>
        input.api.github.listAccountRepositoriesWithStatus({
          login,
          limit: repositoryLimit,
          cacheOnly: !input.githubReady
        })
    })
  ]);
}

export async function refreshContributorsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ContributorsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;

  try {
    await queryClient.fetchQuery({
      queryKey: contributorsTabQueryKey(owner, repo, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listContributorsWithStatus({
          owner,
          repo,
          limit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    });
  } catch {
    // React Query owns the visible error state for this refresh.
  }
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
  const initialState = readContributorsTabState(stateKey);
  const [filter, setFilterValue] = useState(initialState.filter);
  const [selectedContributorLogin, setSelectedContributorLoginValue] = useState<string | null>(
    initialState.selectedContributorLogin
  );
  const [profileRepositoryLimits, setProfileRepositoryLimitsValue] = useState<Record<string, number>>(
    initialState.profileRepositoryLimits
  );

  function setFilter(filterValue: string): void {
    setFilterValue(filterValue);
    updateContributorsTabState(stateKey, { filter: filterValue });
  }

  function setSelectedContributorLogin(login: string | null): void {
    setSelectedContributorLoginValue(login);
    updateContributorsTabState(stateKey, { selectedContributorLogin: login });
  }

  function setProfileRepositoryLimits(limits: Record<string, number>): void {
    setProfileRepositoryLimitsValue(limits);
    updateContributorsTabState(stateKey, { profileRepositoryLimits: limits });
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
  const profileUrl =
    profile?.htmlUrl ??
    selectedContributor?.htmlUrl ??
    (effectiveSelectedContributorLogin ? `https://github.com/${effectiveSelectedContributorLogin}` : null);
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
    setProfileRepositoryLimits({
      ...profileRepositoryLimits,
      [effectiveSelectedContributorLogin]: nextLimit
    });
  }

  return (
    <section className="table-panel github-surface">
      <div className="table-action-row surface-filter-row">
        <label className="surface-filter">
          <Search size={15} />
          <input
            aria-label="Filter contributors"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter contributors"
          />
        </label>
        <button
          type="button"
          onClick={() => onOpenExternal(repositoryPath(repository, "/graphs/contributors"))}
        >
          <ExternalLink size={16} /> Insights
        </button>
        {canExpandContributors && (
          <button type="button" onClick={onExpandContributors}>
            Load more contributors
          </button>
        )}
      </div>

      {error && <div className="error-state">Contributors unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      {loading && contributors.length === 0 && <div className="loading-state">Loading contributors…</div>}
      {!loading && !error && !availabilityMessage && contributors.length === 0 && (
        <div className="empty-state">GitHub returned no contributors for this repository.</div>
      )}
      {!loading && contributors.length > 0 && filteredContributors.length === 0 && (
        <div className="empty-state">No contributors match this filter.</div>
      )}
      {!canExpandContributors && contributorsLimitHit && (
        <div className="muted-row">
          Showing the first {contributors.length} contributors returned by GitHub.
        </div>
      )}

      {filteredContributors.length > 0 && (
        <div className="contributors-layout">
          <div className="contributor-grid">
            {filteredContributors.map((contributor) => {
              const contributorProfileUrl = contributor.htmlUrl ?? `https://github.com/${contributor.login}`;
              const selected = contributor.login === effectiveSelectedContributorLogin;
              return (
                <div className={`contributor-card ${selected ? "selected" : ""}`} key={contributor.id}>
                  <button
                    className="contributor-card-main"
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedContributorLogin(contributor.login);
                      onSelectContributor(contributor);
                    }}
                    title={`View @${contributor.login} in Control`}
                  >
                    {contributor.avatarUrl ? (
                      <img
                        src={contributor.avatarUrl}
                        alt=""
                        onError={(event) => event.currentTarget.remove()}
                      />
                    ) : (
                      <span className="mini-avatar">{contributor.login.slice(0, 1).toUpperCase()}</span>
                    )}
                    <span>
                      <strong>@{contributor.login}</strong>
                      <small>{formatCompactNumber(contributor.contributions)} contributions</small>
                    </span>
                  </button>
                  <button
                    className="icon-button contributor-external"
                    type="button"
                    aria-label={`Open @${contributor.login} on GitHub`}
                    title={`Open @${contributor.login} on GitHub`}
                    onClick={() => onOpenExternal(contributorProfileUrl)}
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <aside className="contributor-detail-panel">
            {!effectiveSelectedContributorLogin && (
              <div className="empty-state">Select a contributor to inspect their profile.</div>
            )}
            {effectiveSelectedContributorLogin && (
              <>
                <div className="contributor-detail-header">
                  {(profile?.avatarUrl ?? selectedContributor?.avatarUrl) ? (
                    <img
                      src={profile?.avatarUrl ?? selectedContributor?.avatarUrl ?? undefined}
                      alt=""
                      onError={(event) => event.currentTarget.remove()}
                    />
                  ) : (
                    <span className="mini-avatar">
                      {effectiveSelectedContributorLogin.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <strong>{profile?.name ?? `@${effectiveSelectedContributorLogin}`}</strong>
                    <small>@{profile?.login ?? effectiveSelectedContributorLogin}</small>
                  </div>
                  {profileUrl && (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Open @${effectiveSelectedContributorLogin} on GitHub`}
                      title={`Open @${effectiveSelectedContributorLogin} on GitHub`}
                      onClick={() => onOpenExternal(profileUrl)}
                    >
                      <ExternalLink size={15} />
                    </button>
                  )}
                </div>

                {!githubReady && (
                  <div className="muted-row">
                    Cached mode: showing stored contributor details when available.
                  </div>
                )}
                {selectedProfile.isFetching && !profile && (
                  <div className="loading-state">Loading profile…</div>
                )}
                {selectedProfile.error instanceof Error && (
                  <div className="error-state">Profile unavailable: {selectedProfile.error.message}</div>
                )}
                {selectedProfileAvailabilityMessage && (
                  <div className="error-state">{selectedProfileAvailabilityMessage}</div>
                )}

                {(profile?.bio || profile?.company || profile?.location || profile?.websiteUrl) && (
                  <div className="contributor-detail-copy">
                    {profile.bio && <p>{profile.bio}</p>}
                    {profile.company && <small>{profile.company}</small>}
                    {profile.location && <small>{profile.location}</small>}
                    {profile.websiteUrl && (
                      <button type="button" onClick={() => onOpenExternal(profile.websiteUrl!)}>
                        {profile.websiteUrl}
                      </button>
                    )}
                  </div>
                )}

                <div className="contributor-stats">
                  <span>
                    <strong>{formatCompactNumber(selectedContributionCount ?? 0)}</strong>
                    <small>Contributions</small>
                  </span>
                  <span>
                    <strong>
                      {formatCompactNumber(profile?.repositoryCount ?? selectedRepositoryItems.length)}
                    </strong>
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

                <div className="contributor-repositories">
                  <div className="section-title-row">
                    <span>Repositories</span>
                  </div>
                  {selectedRepositories.isFetching && !selectedRepositories.data && (
                    <div className="loading-state">Loading repositories…</div>
                  )}
                  {selectedRepositories.error instanceof Error && (
                    <div className="error-state">
                      Repositories unavailable: {selectedRepositories.error.message}
                    </div>
                  )}
                  {selectedRepositoriesAvailabilityMessage && (
                    <div className="error-state">{selectedRepositoriesAvailabilityMessage}</div>
                  )}
                  {!selectedRepositories.isFetching &&
                    !selectedRepositories.error &&
                    !selectedRepositoriesAvailabilityMessage &&
                    selectedRepositoryItems.length === 0 && (
                      <div className="empty-state">
                        {githubReady ? "No repositories available." : "No cached repositories available."}
                      </div>
                    )}
                  {selectedRepositoryItems.map((contributorRepository) => {
                    const metadataParts = repositoryCollectionMetadataParts(contributorRepository);
                    const visibilityLabel = contributorRepository.visibility.toLowerCase();
                    const showPrivateChip = contributorRepository.isPrivate && visibilityLabel !== "private";

                    return (
                      <button
                        className="contributor-repository-row"
                        key={contributorRepository.id}
                        type="button"
                        onClick={() => onOpenRepository(contributorRepository.nameWithOwner)}
                      >
                        <span>
                          <strong>{contributorRepository.nameWithOwner}</strong>
                          <small>{contributorRepository.description ?? "No description."}</small>
                          {metadataParts.length > 0 && <small>{metadataParts.join(" · ")}</small>}
                        </span>
                        <span>
                          <span className="state-chip">{visibilityLabel}</span>
                          {contributorRepository.isFork && <span className="state-chip attention">fork</span>}
                          {showPrivateChip && <span className="state-chip attention">private</span>}
                        </span>
                      </button>
                    );
                  })}
                  {canExpandSelectedProfileRepositories && (
                    <div className="table-action-row">
                      <button type="button" onClick={expandSelectedProfileRepositories}>
                        Load more repositories
                      </button>
                    </div>
                  )}
                  {!canExpandSelectedProfileRepositories && selectedProfileRepositoriesLimitHit && (
                    <div className="muted-row">
                      Showing the first {selectedRepositoryItems.length} repositories returned by GitHub.
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function firstVisibleContributorLogin(
  contributors: ContributorSummary[],
  focusedContributorLogin: string | null
): string | null {
  if (
    focusedContributorLogin &&
    contributors.some((contributor) => contributor.login === focusedContributorLogin)
  ) {
    return focusedContributorLogin;
  }
  return contributors[0]?.login ?? null;
}

function contributorProfileQueryKey(
  login: string | null
): readonly ["github-account-profile", string | null] {
  return ["github-account-profile", login] as const;
}

function contributorRepositoriesQueryKey(
  login: string | null,
  limit: number
): readonly ["github-account-repositories", string | null, number] {
  return ["github-account-repositories", login, limit] as const;
}
