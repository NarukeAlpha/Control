import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Code2,
  ExternalLink,
  Eye,
  Folder,
  GitBranch,
  GitFork,
  GitPullRequest,
  Home,
  Inbox,
  Layers3,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Package,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Workflow,
  X
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import type {
  AppState,
  ContributorSummary,
  CredentialProvider,
  DiscussionSummary,
  GitHubAccountProfile,
  GitHubAction,
  GlassMode,
  IssueSummary,
  ProjectSummary,
  PullRequestSummary,
  ReleaseSummary,
  RepoEntry,
  RepositoryDetail,
  RepositorySummary,
  WorkflowRunSummary
} from "@shared/github";
import { getControlApi } from "./api/controlApi";
import { useUiStore, type AppRoute, type RepositoryTab } from "./stores/uiStore";
import { firstMarkdownHeading, formatCompactNumber, formatRelativeDate } from "./utils/format";

const navigation = [
  { label: "Home", icon: Home },
  { label: "Issues", icon: CircleDot, count: 12 },
  { label: "Pull requests", icon: GitPullRequest, count: 5 },
  { label: "Discussions", icon: MessageSquare },
  { label: "Projects", icon: Layers3 },
  { label: "Models", icon: Sparkles },
  { label: "Codespaces", icon: Code2 },
  { label: "Packages", icon: Package },
  { label: "Stars", icon: Star }
];

const repoTabs: Array<{ key: RepositoryTab; label: string; icon: typeof Code2 }> = [
  { key: "code", label: "Code", icon: Code2 },
  { key: "issues", label: "Issues", icon: CircleDot },
  { key: "pulls", label: "Pull requests", icon: GitPullRequest },
  { key: "actions", label: "Actions", icon: PlayCircle },
  { key: "projects", label: "Projects", icon: Layers3 },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "insights", label: "Insights", icon: Workflow }
];

type RepositoryCountKey =
  | "stars"
  | "stargazers"
  | "forks"
  | "watchers"
  | "issues"
  | "openIssues"
  | "pullRequests"
  | "openPullRequests"
  | "discussions"
  | "projects"
  | "releases"
  | "branches"
  | "tags";

type RepositoryCounts = Partial<Record<RepositoryCountKey, number>>;

interface LanguageStat {
  name: string;
  color: string | null;
  size: number | null;
  percentage: number | null;
}

interface RepositoryRef {
  name?: string;
  owner?: string;
  nameWithOwner?: string;
  htmlUrl?: string;
  url?: string;
}

interface ViewerRepositoryState {
  isStarred?: boolean;
  hasStarred?: boolean;
  isWatching?: boolean;
  subscription?: string | null;
  permission?: string | null;
  viewerPermission?: string | null;
}

type RepositoryWithParity = RepositoryDetail & {
  counts?: RepositoryCounts;
  languages?: unknown;
  parent?: RepositoryRef | null;
  source?: RepositoryRef | null;
  viewerState?: ViewerRepositoryState;
  viewer?: ViewerRepositoryState;
  viewerHasStarred?: boolean;
  viewerSubscription?: string | null;
  viewerPermission?: string | null;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
    permission?: string | null;
  };
};

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function repositoryPath(repository: RepositoryDetail, path = ""): string {
  return `${repository.htmlUrl}${path}`;
}

function getRepositoryCounts(
  repository: RepositoryDetail,
  fallback: {
    issues: IssueSummary[];
    pulls: PullRequestSummary[];
    discussions: DiscussionSummary[];
    projects: ProjectSummary[];
    releases?: ReleaseSummary[];
  }
): Record<
  "stars" | "forks" | "watchers" | "issues" | "pulls" | "discussions" | "projects" | "releases",
  number
> {
  const parityRepository = repository as RepositoryWithParity;
  const counts = parityRepository.counts ?? {};

  return {
    stars: firstNumber(counts.stars, counts.stargazers, repository.stargazerCount) ?? 0,
    forks: firstNumber(counts.forks, repository.forkCount) ?? 0,
    watchers: firstNumber(counts.watchers, repository.watcherCount) ?? 0,
    issues:
      firstNumber(counts.openIssues, counts.issues, repository.openIssuesCount, fallback.issues.length) ?? 0,
    pulls: firstNumber(counts.openPullRequests, counts.pullRequests, fallback.pulls.length) ?? 0,
    discussions: firstNumber(counts.discussions, fallback.discussions.length) ?? 0,
    projects: firstNumber(counts.projects, fallback.projects.length) ?? 0,
    releases: firstNumber(counts.releases, fallback.releases?.length) ?? 0
  };
}

function getViewerRepositoryState(repository: RepositoryDetail): {
  isStarred: boolean;
  isWatching: boolean;
  permission: string | null;
} {
  const parityRepository = repository as RepositoryWithParity;
  const viewerState = parityRepository.viewerState ?? parityRepository.viewer;
  const subscription = viewerState?.subscription ?? parityRepository.viewerSubscription ?? null;
  const permission =
    viewerState?.permission ??
    viewerState?.viewerPermission ??
    parityRepository.viewerPermission ??
    parityRepository.permissions?.permission ??
    (parityRepository.permissions?.admin
      ? "admin"
      : parityRepository.permissions?.maintain
        ? "maintain"
        : parityRepository.permissions?.push
          ? "write"
          : parityRepository.permissions?.triage
            ? "triage"
            : parityRepository.permissions?.pull
              ? "read"
              : null);

  return {
    isStarred: Boolean(
      viewerState?.isStarred ?? viewerState?.hasStarred ?? parityRepository.viewerHasStarred
    ),
    isWatching: Boolean(
      viewerState?.isWatching ??
      (typeof subscription === "string" &&
        ["subscribed", "SUBSCRIBED", "watching", "WATCHING"].includes(subscription))
    ),
    permission
  };
}

function getRepositoryRefLabel(ref: RepositoryRef | null | undefined): string | null {
  if (!ref) {
    return null;
  }

  if (ref.nameWithOwner) {
    return ref.nameWithOwner;
  }

  if (ref.owner && ref.name) {
    return `${ref.owner}/${ref.name}`;
  }

  return ref.name ?? null;
}

function getRepositoryRefUrl(ref: RepositoryRef | null | undefined): string | null {
  const label = getRepositoryRefLabel(ref);
  return ref?.htmlUrl ?? ref?.url ?? (label?.includes("/") ? `https://github.com/${label}` : null);
}

function getForkMetadata(repository: RepositoryDetail): {
  parentLabel: string | null;
  parentUrl: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
} {
  const parityRepository = repository as RepositoryWithParity;
  const parent = parityRepository.parent ?? null;
  const source = parityRepository.source ?? null;

  return {
    parentLabel: getRepositoryRefLabel(parent),
    parentUrl: getRepositoryRefUrl(parent),
    sourceLabel: getRepositoryRefLabel(source),
    sourceUrl: getRepositoryRefUrl(source)
  };
}

function normalizeLanguageStats(repository: RepositoryDetail): LanguageStat[] {
  const parityRepository = repository as RepositoryWithParity;
  const rawLanguages = parityRepository.languages;

  if (Array.isArray(rawLanguages)) {
    const items = rawLanguages
      .map((language) => {
        if (!language || typeof language !== "object") {
          return null;
        }
        const item = language as {
          name?: unknown;
          color?: unknown;
          size?: unknown;
          percent?: unknown;
          percentage?: unknown;
        };
        if (typeof item.name !== "string") {
          return null;
        }

        return {
          name: item.name,
          color: typeof item.color === "string" ? item.color : null,
          size: firstNumber(item.size) ?? null,
          percentage: firstNumber(item.percentage, item.percent) ?? null
        };
      })
      .filter((language): language is LanguageStat => Boolean(language));

    const totalSize = items.reduce((total, language) => total + (language.size ?? 0), 0);
    return items.map((language) => ({
      ...language,
      percentage:
        language.percentage ??
        (language.size !== null && totalSize > 0 ? Math.max(1, (language.size / totalSize) * 100) : null)
    }));
  }

  if (rawLanguages && typeof rawLanguages === "object") {
    const graphLanguages = rawLanguages as {
      totalSize?: unknown;
      edges?: Array<{ size?: unknown; node?: { name?: unknown; color?: unknown } }>;
      nodes?: Array<{ name?: unknown; color?: unknown; size?: unknown }>;
    };
    const edges = Array.isArray(graphLanguages.edges) ? graphLanguages.edges : [];
    const totalSize =
      firstNumber(graphLanguages.totalSize) ??
      edges.reduce((total, edge) => total + (firstNumber(edge.size) ?? 0), 0);

    if (edges.length > 0) {
      return edges
        .map((edge) => {
          const name = edge.node?.name;
          if (typeof name !== "string") {
            return null;
          }
          const size = firstNumber(edge.size) ?? null;
          return {
            name,
            color: typeof edge.node?.color === "string" ? edge.node.color : null,
            size,
            percentage: size !== null && totalSize > 0 ? Math.max(1, (size / totalSize) * 100) : null
          };
        })
        .filter((language): language is LanguageStat => Boolean(language));
    }

    if (Array.isArray(graphLanguages.nodes)) {
      const nodeLanguages: LanguageStat[] = [];
      for (const node of graphLanguages.nodes) {
        if (typeof node.name === "string") {
          nodeLanguages.push({
            name: node.name,
            color: typeof node.color === "string" ? node.color : null,
            size: firstNumber(node.size) ?? null,
            percentage: null
          });
        }
      }
      return nodeLanguages;
    }
  }

  return repository.primaryLanguage
    ? [
        {
          name: repository.primaryLanguage.name,
          color: repository.primaryLanguage.color,
          size: null,
          percentage: 100
        }
      ]
    : [];
}

function languageTotalLabel(languages: LanguageStat[]): string | null {
  const total = languages.reduce((sum, language) => sum + (language.size ?? 0), 0);
  if (total <= 0) {
    return null;
  }

  return `${formatCompactNumber(total)} bytes`;
}

function routeTitle(route: AppRoute): string {
  switch (route.kind) {
    case "globalIssues":
      return "Issues";
    case "globalPulls":
      return "Pull requests";
    case "mailbox":
      return "Mailbox";
    case "collection":
      return route.collection[0].toUpperCase() + route.collection.slice(1);
    case "repository":
      return route.nameWithOwner;
    case "home":
    default:
      return "Home";
  }
}

export function App(): JSX.Element {
  const api = useMemo(() => getControlApi(), []);
  const queryClient = useQueryClient();
  const route = useUiStore((state) => state.route);
  const selectedRepository = useUiStore((state) => state.selectedRepository);
  const setSelectedRepository = useUiStore((state) => state.setSelectedRepository);
  const goToRepository = useUiStore((state) => state.goToRepository);
  const goToGlobalIssues = useUiStore((state) => state.goToGlobalIssues);
  const goToGlobalPulls = useUiStore((state) => state.goToGlobalPulls);
  const goToMailbox = useUiStore((state) => state.goToMailbox);
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);

  const appState = useQuery({
    queryKey: ["app-state"],
    queryFn: () => api.getAppState()
  });

  const repositories = useQuery({
    queryKey: ["repositories"],
    queryFn: () => api.github.listRepositories({ limit: 80 })
  });

  const accountProfile = useQuery({
    queryKey: ["account-profile"],
    queryFn: () => api.github.getAccountProfile({})
  });

  const accountIssues = useQuery({
    queryKey: ["account-issues"],
    queryFn: () => api.github.listAccountIssues({ state: "open", limit: 30 })
  });

  const accountPulls = useQuery({
    queryKey: ["account-pulls"],
    queryFn: () => api.github.listAccountPullRequests({ state: "open", limit: 30 })
  });

  const isRepositoryRoute = route.kind === "repository";
  const effectiveRepository =
    (isRepositoryRoute ? route.nameWithOwner : selectedRepository) ??
    repositories.data?.[0]?.nameWithOwner ??
    "apple/swift";
  const [owner = "apple", repo = "swift"] = effectiveRepository.split("/");

  const repository = useQuery({
    queryKey: ["repository", owner, repo],
    queryFn: () => api.github.getRepository({ owner, repo }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const contents = useQuery({
    queryKey: ["contents", owner, repo, repository.data?.defaultBranch],
    queryFn: () => api.github.listContents({ owner, repo, ref: repository.data?.defaultBranch ?? undefined }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const issues = useQuery({
    queryKey: ["issues", owner, repo],
    queryFn: () => api.github.listIssues({ owner, repo, state: "open" }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const pulls = useQuery({
    queryKey: ["pulls", owner, repo],
    queryFn: () => api.github.listPullRequests({ owner, repo, state: "open" }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const discussions = useQuery({
    queryKey: ["discussions", owner, repo],
    queryFn: () => api.github.listDiscussions({ owner, repo, limit: 30 }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const actions = useQuery({
    queryKey: ["actions", owner, repo],
    queryFn: () => api.github.listActions({ owner, repo, limit: 20 }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const projects = useQuery({
    queryKey: ["projects", owner, repo],
    queryFn: () => api.github.listProjects({ owner, repo, limit: 20 }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const releases = useQuery({
    queryKey: ["releases", owner, repo],
    queryFn: () => api.github.listReleases({ owner, repo, limit: 20 }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const contributors = useQuery({
    queryKey: ["contributors", owner, repo],
    queryFn: () => api.github.listContributors({ owner, repo }),
    enabled: isRepositoryRoute && Boolean(owner && repo)
  });

  const mutation = useMutation({
    mutationFn: api.github.mutate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["repository", owner, repo] });
      await queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
      await queryClient.invalidateQueries({ queryKey: ["pulls", owner, repo] });
    }
  });

  const shellClass = appState.data?.settings.glassMode === "solid" ? "app-shell solid-shell" : "app-shell";

  return (
    <div className={shellClass}>
      <Sidebar
        appState={appState.data}
        repositories={repositories.data ?? []}
        selectedRepository={effectiveRepository}
        route={route}
        onSelectRepository={setSelectedRepository}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <TopBar
        viewer={appState.data?.viewer ?? null}
        selectedRepository={selectedRepository}
        onGoIssues={goToGlobalIssues}
        onGoPulls={goToGlobalPulls}
        onGoMailbox={goToMailbox}
        onGoRepository={() => goToRepository(effectiveRepository)}
        onOpenExternal={(url) => void api.openExternal(url)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <section className="workspace">
        {!appState.data?.gh.authenticated && <SetupPanel appState={appState.data} />}

        <main className="content-scroll">
          {route.kind === "home" && (
            <HomeDashboard
              appState={appState.data}
              profile={accountProfile.data}
              repositories={repositories.data ?? []}
              issues={accountIssues.data ?? []}
              pulls={accountPulls.data ?? []}
              onOpenRepository={goToRepository}
              onOpenExternal={(url) => void api.openExternal(url)}
            />
          )}

          {route.kind === "repository" && (
            <RepositoryPage
              repository={repository.data}
              contents={contents.data ?? []}
              issues={issues.data ?? []}
              pulls={pulls.data ?? []}
              discussions={discussions.data ?? []}
              actions={actions.data ?? []}
              projects={projects.data ?? []}
              loading={repository.isLoading}
              error={repository.error ?? contents.error ?? issues.error ?? pulls.error}
              onOpenExternal={(url) => void api.openExternal(url)}
              onMutate={(action, dangerous, payload = {}) => {
                if (dangerous && !window.confirm(`Run ${action} on ${owner}/${repo}?`)) {
                  return;
                }
                mutation.mutate({ action, owner, repo, payload });
              }}
            />
          )}

          {route.kind !== "home" && route.kind !== "repository" && (
            <CollectionView
              title={routeTitle(route)}
              issues={accountIssues.data ?? []}
              pulls={accountPulls.data ?? []}
              discussions={[]}
              projects={[]}
              repositories={repositories.data ?? []}
              onOpenExternal={(url) => void api.openExternal(url)}
            />
          )}
        </main>
      </section>

      <RightRail
        repository={isRepositoryRoute ? repository.data : undefined}
        releases={releases.data ?? []}
        contributors={contributors.data ?? []}
        onOpenExternal={(url) => void api.openExternal(url)}
      />

      {settingsOpen && (
        <SettingsPanel
          appState={appState.data}
          onClose={() => setSettingsOpen(false)}
          onSave={async (settings) => {
            await api.updateSettings(settings);
            await queryClient.invalidateQueries({ queryKey: ["app-state"] });
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

function isNavigationActive(route: AppRoute, label: string): boolean {
  if (label === "Home") {
    return route.kind === "home";
  }
  if (label === "Issues") {
    return route.kind === "globalIssues";
  }
  if (label === "Pull requests") {
    return route.kind === "globalPulls";
  }
  return route.kind === "collection" && route.collection === label.toLowerCase().replace(" ", "");
}

function Sidebar({
  appState,
  repositories,
  selectedRepository,
  route,
  onSelectRepository,
  onOpenSettings
}: {
  appState?: AppState;
  repositories: RepositorySummary[];
  selectedRepository: string;
  route: AppRoute;
  onSelectRepository(nameWithOwner: string): void;
  onOpenSettings(): void;
}): JSX.Element {
  const goHome = useUiStore((state) => state.goHome);
  const goToGlobalIssues = useUiStore((state) => state.goToGlobalIssues);
  const goToGlobalPulls = useUiStore((state) => state.goToGlobalPulls);
  const goToCollection = useUiStore((state) => state.goToCollection);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: repositories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 8
  });

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="traffic-spacer" />
        <div className="brand-mark">GH</div>
        <strong>GitHub</strong>
      </div>

      <nav className="nav-list">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`nav-item ${isNavigationActive(route, item.label) ? "active" : ""}`}
              key={item.label}
              type="button"
              onClick={() => {
                if (item.label === "Home") {
                  goHome();
                  return;
                }
                if (item.label === "Issues") {
                  goToGlobalIssues();
                  return;
                }
                if (item.label === "Pull requests") {
                  goToGlobalPulls();
                  return;
                }
                goToCollection(
                  item.label.toLowerCase().replace(" ", "") as Parameters<typeof goToCollection>[0]
                );
              }}
              title={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.count && <span className="count-pill">{item.count}</span>}
            </button>
          );
        })}
      </nav>

      <section className="repo-section">
        <div className="section-title-row">
          <span>Your repositories</span>
          <div className="icon-cluster">
            <button className="icon-button" type="button" title="Search repositories">
              <Search size={15} />
            </button>
            <button className="icon-button" type="button" title="Add repository">
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="repo-list" ref={parentRef}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const repository = repositories[virtualRow.index];
              return (
                <button
                  className={`repo-item ${selectedRepository === repository.nameWithOwner ? "selected" : ""}`}
                  key={repository.id}
                  type="button"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  onClick={() => onSelectRepository(repository.nameWithOwner)}
                >
                  <span className="repo-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
                  <span>{repository.nameWithOwner}</span>
                  {repository.isPrivate && <Lock size={13} />}
                </button>
              );
            })}
          </div>
        </div>

        <button className="show-more" type="button">
          Show more
        </button>
      </section>

      <button className="user-footer" type="button" onClick={onOpenSettings}>
        {appState?.viewer?.avatarUrl ? (
          <img src={appState.viewer.avatarUrl} alt="" />
        ) : (
          <span className="avatar-placeholder">C</span>
        )}
        <span>
          <strong>{appState?.viewer?.name ?? appState?.viewer?.login ?? "Set up Control"}</strong>
          <small>@{appState?.viewer?.login ?? "github"}</small>
        </span>
        <MoreHorizontal size={18} />
      </button>
    </aside>
  );
}

function TopBar({
  viewer,
  selectedRepository,
  onGoIssues,
  onGoPulls,
  onGoMailbox,
  onGoRepository,
  onOpenExternal,
  onOpenSettings
}: {
  viewer: AppState["viewer"];
  selectedRepository: string | null;
  onGoIssues(): void;
  onGoPulls(): void;
  onGoMailbox(): void;
  onGoRepository(): void;
  onOpenExternal(url: string): void;
  onOpenSettings(): void;
}): JSX.Element {
  const api = useMemo(() => getControlApi(), []);
  const goToRepository = useUiStore((state) => state.goToRepository);
  const [query, setQuery] = useState("");
  const search = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.github.search({ query, limit: 8 }),
    enabled: query.trim().length > 1
  });

  return (
    <header className="topbar">
      <div className="titlebar-left">
        <button
          className="titlebar-provider-button"
          type="button"
          onClick={() => onOpenExternal("https://github.com")}
        >
          <span className="brand-mark">GH</span>
          GitHub
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="search-wrap">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search or jump to..."
          aria-label="Search or jump to"
        />
        <kbd>Cmd K</kbd>
        {query.trim().length > 1 && (
          <div className="search-popover">
            {(search.data ?? []).map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  goToRepository(result.nameWithOwner);
                  setQuery("");
                }}
              >
                <span>{result.nameWithOwner}</span>
                <small>{result.description ?? "Repository"}</small>
              </button>
            ))}
            {search.isFetching && <div className="muted-row">Searching GitHub...</div>}
            {!search.isFetching && search.data?.length === 0 && (
              <div className="muted-row">No repositories found</div>
            )}
          </div>
        )}
      </div>

      <div className="top-actions">
        <button
          className="icon-button glass"
          type="button"
          title="Create"
          aria-label="Create"
          onClick={() => onOpenExternal("https://github.com/new")}
        >
          <Plus size={19} />
        </button>
        <button
          className="icon-button glass"
          type="button"
          title="Issues"
          aria-label="Issues"
          onClick={onGoIssues}
        >
          <CircleDot size={18} />
        </button>
        <button
          className="icon-button glass"
          type="button"
          title="Pull requests"
          aria-label="Pull requests"
          onClick={onGoPulls}
        >
          <GitPullRequest size={18} />
        </button>
        <button
          className="titlebar-action-button"
          type="button"
          title={selectedRepository ? `Open ${selectedRepository}` : "Repository"}
          onClick={onGoRepository}
        >
          <Code2 size={16} />
          <span>{selectedRepository?.split("/")[1] ?? "Repo"}</span>
        </button>
        <button
          className="icon-button glass"
          type="button"
          title="Mailbox"
          aria-label="Mailbox"
          onClick={onGoMailbox}
        >
          <Bell size={18} />
        </button>
        <button className="avatar-button" type="button" onClick={onOpenSettings} title="Account settings">
          {viewer?.avatarUrl ? <img src={viewer.avatarUrl} alt="" /> : <span>C</span>}
        </button>
      </div>
    </header>
  );
}

function SetupPanel({ appState }: { appState?: AppState }): JSX.Element {
  return (
    <div className="setup-panel">
      <Inbox size={18} />
      <span>{appState?.gh.error ?? "Connect GitHub CLI to load live GitHub data."}</span>
    </div>
  );
}

function HomeDashboard({
  appState,
  profile,
  repositories,
  issues,
  pulls,
  onOpenRepository,
  onOpenExternal
}: {
  appState?: AppState;
  profile?: GitHubAccountProfile;
  repositories: RepositorySummary[];
  issues: IssueSummary[];
  pulls: PullRequestSummary[];
  onOpenRepository(nameWithOwner: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const login = profile?.login ?? appState?.viewer?.login ?? "github";
  const displayName = profile?.name ?? appState?.viewer?.name ?? login;
  const pinnedRepositories = profile?.pinnedRepositories?.length
    ? profile.pinnedRepositories
    : repositories.slice(0, 6);

  return (
    <section className="home-dashboard">
      <header className="account-hero">
        {(profile?.avatarUrl ?? appState?.viewer?.avatarUrl) ? (
          <img src={profile?.avatarUrl ?? appState?.viewer?.avatarUrl ?? ""} alt="" />
        ) : (
          <span className="avatar-placeholder">{login.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <h1>{displayName}</h1>
          <p>@{login}</p>
          {profile?.bio && <small>{profile.bio}</small>}
        </div>
        <button
          type="button"
          onClick={() =>
            onOpenExternal(profile?.htmlUrl ?? appState?.viewer?.htmlUrl ?? "https://github.com")
          }
        >
          <ExternalLink size={16} /> Open profile
        </button>
      </header>

      <section className="home-metrics">
        <Metric label="Repositories" value={profile?.repositoryCount ?? repositories.length} />
        <Metric label="Starred" value={profile?.starredRepositoryCount ?? 0} />
        <Metric label="Followers" value={profile?.followers ?? 0} />
        <Metric label="Following" value={profile?.following ?? 0} />
      </section>

      <section className="home-grid">
        <article className="home-panel">
          <header>
            <h2>Pinned repositories</h2>
          </header>
          <div className="home-repo-grid">
            {pinnedRepositories.map((repository) => (
              <button
                key={repository.id}
                type="button"
                onClick={() => onOpenRepository(repository.nameWithOwner)}
              >
                <strong>{repository.nameWithOwner}</strong>
                <small>{repository.description ?? "Repository"}</small>
                <span>
                  {repository.primaryLanguage?.name ?? "Code"} ·{" "}
                  {formatCompactNumber(repository.counts.openIssues)} issues
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="home-panel">
          <header>
            <h2>Inbox</h2>
          </header>
          <div className="table-panel compact-table">
            {[...issues.slice(0, 4), ...pulls.slice(0, 4)].slice(0, 6).map((item) => (
              <button
                key={`${item.repositoryNameWithOwner ?? "item"}-${item.number}`}
                className="issue-row"
                type="button"
                onClick={() => onOpenExternal(item.htmlUrl)}
              >
                {"isDraft" in item ? <GitPullRequest size={17} /> : <CircleDot size={17} />}
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.repositoryNameWithOwner ?? "GitHub"} #{item.number}
                  </small>
                </div>
              </button>
            ))}
            {issues.length + pulls.length === 0 && (
              <div className="empty-state">No open assigned issues or pull requests.</div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}

function RepositoryPage({
  repository,
  contents,
  issues,
  pulls,
  discussions,
  actions,
  projects,
  loading,
  error,
  onOpenExternal,
  onMutate
}: {
  repository?: RepositoryDetail;
  contents: RepoEntry[];
  issues: IssueSummary[];
  pulls: PullRequestSummary[];
  discussions: DiscussionSummary[];
  actions: WorkflowRunSummary[];
  projects: ProjectSummary[];
  loading: boolean;
  error: Error | null;
  onOpenExternal(url: string): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  const route = useUiStore((state) => state.route);
  const tab = route.kind === "repository" ? route.tab : "code";
  const setTab = useUiStore((state) => state.setRepositoryTab);

  if (loading) {
    return <div className="loading-state">Loading repository...</div>;
  }

  if (error && !repository) {
    return <div className="error-state">{error.message}</div>;
  }

  const repo = repository;
  if (!repo) {
    return <div className="loading-state">No repository selected.</div>;
  }

  const counts = getRepositoryCounts(repo, { issues, pulls, discussions, projects });
  const viewerState = getViewerRepositoryState(repo);
  const forkMetadata = getForkMetadata(repo);
  const starAction: GitHubAction = viewerState.isStarred ? "unstar" : "star";
  const watchAction: GitHubAction = viewerState.isWatching ? "unwatch" : "watch";
  const tabCounts: Partial<Record<RepositoryTab, number>> = {
    issues: counts.issues,
    pulls: counts.pulls,
    projects: counts.projects
  };

  return (
    <article className="repo-page">
      <section className="repo-hero">
        <div className="repo-icon">{repo.owner.slice(0, 1).toUpperCase()}</div>
        <div className="repo-title-block">
          <div className="repo-title-line">
            <h1>
              {repo.owner} <span>/</span> {repo.name}
            </h1>
            <span className="visibility-pill">{repo.visibility.toLowerCase()}</span>
          </div>
          <p>{repo.description ?? "No repository description."}</p>
          {repo.isFork && (
            <div className="fork-banner">
              <GitFork size={15} />
              <span>
                Forked from{" "}
                {forkMetadata.parentUrl && forkMetadata.parentLabel ? (
                  <button type="button" onClick={() => onOpenExternal(forkMetadata.parentUrl!)}>
                    {forkMetadata.parentLabel}
                  </button>
                ) : (
                  <strong>{forkMetadata.parentLabel ?? "another repository"}</strong>
                )}
                {forkMetadata.sourceLabel && forkMetadata.sourceLabel !== forkMetadata.parentLabel && (
                  <>
                    {" "}
                    · source{" "}
                    {forkMetadata.sourceUrl ? (
                      <button type="button" onClick={() => onOpenExternal(forkMetadata.sourceUrl!)}>
                        {forkMetadata.sourceLabel}
                      </button>
                    ) : (
                      <strong>{forkMetadata.sourceLabel}</strong>
                    )}
                  </>
                )}
              </span>
            </div>
          )}
          <div className="stat-strip">
            <span>
              <Star size={15} /> {formatCompactNumber(counts.stars)}
            </span>
            <span>
              <GitFork size={15} /> {formatCompactNumber(counts.forks)}
            </span>
            <span>
              <Eye size={15} /> {formatCompactNumber(counts.watchers)}
            </span>
            {repo.licenseName && (
              <span>
                <ShieldCheck size={15} /> {repo.licenseName}
              </span>
            )}
            {viewerState.permission && <span className="viewer-permission">{viewerState.permission}</span>}
          </div>
        </div>
        <div className="repo-action-row">
          <button
            className={viewerState.isWatching ? "selected-action" : ""}
            type="button"
            aria-pressed={viewerState.isWatching}
            onClick={() => onMutate(watchAction, false)}
          >
            <Eye size={16} /> {viewerState.isWatching ? "Watching" : "Watch"} <ChevronDown size={14} />
          </button>
          <button type="button" onClick={() => onMutate("fork", true)}>
            <GitFork size={16} /> Fork <span>{formatCompactNumber(counts.forks)}</span>
          </button>
          <button
            className={viewerState.isStarred ? "selected-action dark-action" : "dark-action"}
            type="button"
            aria-pressed={viewerState.isStarred}
            onClick={() => onMutate(starAction, false)}
          >
            <Star size={17} /> {viewerState.isStarred ? "Starred" : "Star"}{" "}
            <span>{formatCompactNumber(counts.stars)}</span>
          </button>
          <button type="button" onClick={() => onOpenExternal(repo.htmlUrl)} title="Open on GitHub">
            <ExternalLink size={16} /> Open
          </button>
        </div>
      </section>

      <nav className="repo-tabs">
        {repoTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={tab === item.key ? "active" : ""}
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
            >
              <Icon size={16} />
              {item.label}
              {tabCounts[item.key] !== undefined && (
                <span>{formatCompactNumber(tabCounts[item.key] ?? 0)}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "code" && <CodeTab repository={repo} contents={contents} onOpenExternal={onOpenExternal} />}
      {tab === "issues" && (
        <IssuesTab repository={repo} issues={issues} onMutate={onMutate} onOpenExternal={onOpenExternal} />
      )}
      {tab === "pulls" && (
        <PullRequestsTab
          repository={repo}
          pulls={pulls}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
        />
      )}
      {tab === "actions" && (
        <ActionsTab repository={repo} actions={actions} onMutate={onMutate} onOpenExternal={onOpenExternal} />
      )}
      {tab === "projects" && (
        <ProjectsTab repository={repo} projects={projects} onOpenExternal={onOpenExternal} />
      )}
      {tab === "security" && <SecurityTab repository={repo} onOpenExternal={onOpenExternal} />}
      {tab === "insights" && <InsightsTab counts={counts} discussions={discussions} />}
    </article>
  );
}

function CodeTab({
  repository,
  contents,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  contents: RepoEntry[];
  onOpenExternal(url: string): void;
}): JSX.Element {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: contents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 8
  });

  return (
    <section className="code-layout">
      <div className="code-toolbar glass-panel">
        <button
          type="button"
          onClick={() =>
            onOpenExternal(repositoryPath(repository, `/tree/${repository.defaultBranch ?? "HEAD"}`))
          }
        >
          <GitBranch size={16} />
          {repository.defaultBranch ?? "main"}
          <ChevronDown size={14} />
        </button>
        <span>
          <GitBranch size={15} /> {formatCompactNumber(repository.branchCount)} branches
        </span>
        <span>
          <Tag size={15} /> {formatCompactNumber(repository.tagCount)} tags
        </span>
        <button
          className="go-to-file-button"
          type="button"
          onClick={() => onOpenExternal(repositoryPath(repository, "/find/HEAD"))}
        >
          <Search size={16} />
          <span>Go to file</span>
        </button>
        <button className="dark-action" type="button" onClick={() => onOpenExternal(repository.htmlUrl)}>
          Code <ChevronDown size={14} />
        </button>
      </div>

      <div className="file-table">
        <div className="commit-row">
          <span className="mini-avatar">S</span>
          <strong>slightbug</strong>
          <span>Add Sendable support for @MainActor types</span>
          <CheckCircle2 size={16} />
          <small>7f3a2c1</small>
          <small>2h ago</small>
          <small>1,562 commits</small>
        </div>
        <div className="virtual-file-list" ref={parentRef}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = contents[virtualRow.index];
              return (
                <button
                  className="file-row"
                  key={item.sha}
                  type="button"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  onClick={() => item.htmlUrl && onOpenExternal(item.htmlUrl)}
                  title={item.htmlUrl ? `Open ${item.path} on GitHub` : item.path}
                >
                  {item.type === "dir" ? <Folder size={18} /> : <BookOpen size={17} />}
                  <strong>{item.name}</strong>
                  <span>{item.lastCommitMessage ?? "Updated from GitHub"}</span>
                  <time>{formatRelativeDate(item.lastCommitDate)}</time>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="readme-panel">
        <header>
          <BookOpen size={17} />
          <span>README.md</span>
        </header>
        <div className="readme-content">
          <div>
            <h2>{firstMarkdownHeading(repository.readmeMarkdown)}</h2>
            <p>
              {repository.readmeMarkdown
                ?.split("\n")
                .find((line) => line.trim() && !line.startsWith("#"))
                ?.trim() ?? "README content is available from GitHub."}
            </p>
          </div>
          <div className="readme-mark">S</div>
        </div>
      </section>
    </section>
  );
}

function IssuesTab({
  repository,
  issues,
  onOpenExternal,
  onMutate
}: {
  repository: RepositoryDetail;
  issues: IssueSummary[];
  onOpenExternal(url: string): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  return (
    <section className="table-panel">
      <div className="table-action-row">
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/issues/new"))}>
          <Plus size={16} /> New issue
        </button>
      </div>
      {issues.map((issue) => (
        <div className="issue-row" key={issue.id}>
          <CircleDot size={17} />
          <div>
            <strong>{issue.title}</strong>
            <small>
              #{issue.number} opened by {issue.authorLogin ?? "unknown"} · {issue.comments} comments
            </small>
          </div>
          <div className="label-stack">
            {issue.labels.slice(0, 2).map((label) => (
              <span key={label.id}>{label.name}</span>
            ))}
          </div>
          <button type="button" onClick={() => onMutate("closeIssue", true, { issueNumber: issue.number })}>
            Close
          </button>
          <button type="button" onClick={() => onOpenExternal(issue.htmlUrl)}>
            Open
          </button>
        </div>
      ))}
    </section>
  );
}

function PullRequestsTab({
  repository,
  pulls,
  onOpenExternal,
  onMutate
}: {
  repository: RepositoryDetail;
  pulls: PullRequestSummary[];
  onOpenExternal(url: string): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  return (
    <section className="table-panel">
      <div className="table-action-row">
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/pulls"))}>
          <Plus size={16} /> New pull request
        </button>
      </div>
      {pulls.map((pull) => (
        <div className="issue-row" key={pull.id}>
          <GitPullRequest size={17} />
          <div>
            <strong>{pull.title}</strong>
            <small>
              #{pull.number} {pull.headRefName} → {pull.baseRefName} · {pull.changedFiles} files
            </small>
          </div>
          <span className={`state-chip ${pull.mergeableState === "clean" ? "success" : ""}`}>
            {pull.isDraft ? "draft" : (pull.mergeableState ?? pull.state)}
          </span>
          <button
            type="button"
            onClick={() => onMutate("mergePullRequest", true, { pullNumber: pull.number })}
          >
            Merge
          </button>
          <button type="button" onClick={() => onOpenExternal(pull.htmlUrl)}>
            Open
          </button>
        </div>
      ))}
    </section>
  );
}

function ActionsTab({
  repository,
  actions,
  onOpenExternal,
  onMutate
}: {
  repository: RepositoryDetail;
  actions: WorkflowRunSummary[];
  onOpenExternal(url: string): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  return (
    <section className="table-panel">
      <div className="table-action-row">
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/actions"))}>
          <Workflow size={16} /> Workflows
        </button>
      </div>
      {actions.map((run) => (
        <div className="issue-row" key={run.id}>
          <Workflow size={17} />
          <div>
            <strong>{run.name}</strong>
            <small>
              {run.event} on {run.branch ?? "unknown"} · {formatRelativeDate(run.updatedAt)}
            </small>
          </div>
          <span className={`state-chip ${run.conclusion === "success" ? "success" : ""}`}>
            {run.conclusion ?? run.status ?? "queued"}
          </span>
          <button type="button" onClick={() => onMutate("rerunWorkflow", true, { runId: run.id })}>
            Rerun
          </button>
          <button type="button" onClick={() => onOpenExternal(run.htmlUrl)}>
            Open
          </button>
        </div>
      ))}
    </section>
  );
}

function ProjectsTab({
  repository,
  projects,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  projects: ProjectSummary[];
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <section className="tile-grid">
      {projects.map((project) => (
        <button
          className="project-tile"
          key={project.id}
          type="button"
          onClick={() =>
            project.htmlUrl
              ? onOpenExternal(project.htmlUrl)
              : onOpenExternal(repositoryPath(repository, "/projects"))
          }
        >
          <Layers3 size={20} />
          <strong>{project.title}</strong>
          <small>{project.closed ? "Closed" : "Open"} project</small>
        </button>
      ))}
      {projects.length === 0 && (
        <div className="empty-state">No projects are available for this repository.</div>
      )}
    </section>
  );
}

function SecurityTab({
  repository,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <section className="tile-grid">
      {["Security policy", "Code scanning", "Dependabot", "Secret scanning"].map((item) => (
        <button
          className="project-tile"
          key={item}
          type="button"
          onClick={() => onOpenExternal(repositoryPath(repository, "/security"))}
        >
          <ShieldCheck size={20} />
          <strong>{item}</strong>
          <small>{repository.nameWithOwner}</small>
        </button>
      ))}
    </section>
  );
}

function InsightsTab({
  counts,
  discussions
}: {
  counts: ReturnType<typeof getRepositoryCounts>;
  discussions: DiscussionSummary[];
}): JSX.Element {
  return (
    <section className="insight-grid">
      <Metric label="Stars" value={counts.stars} />
      <Metric label="Forks" value={counts.forks} />
      <Metric label="Open issues" value={counts.issues} />
      <Metric label="Pull requests" value={counts.pulls} />
      <Metric label="Discussions" value={counts.discussions || discussions.length} />
      <Metric label="Watchers" value={counts.watchers} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="metric-tile">
      <strong>{formatCompactNumber(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

function CollectionView({
  title,
  issues,
  pulls,
  discussions,
  projects,
  repositories,
  onOpenExternal
}: {
  title: string;
  issues: IssueSummary[];
  pulls: PullRequestSummary[];
  discussions: DiscussionSummary[];
  projects: ProjectSummary[];
  repositories: RepositorySummary[];
  onOpenExternal(url: string): void;
}): JSX.Element {
  const rows =
    title === "Issues"
      ? issues.map((issue) => ({
          key: `i-${issue.id}`,
          title: issue.title,
          meta: `${issue.repositoryNameWithOwner ?? "GitHub"} #${issue.number}`,
          url: issue.htmlUrl
        }))
      : title === "Pull requests"
        ? pulls.map((pull) => ({
            key: `p-${pull.id}`,
            title: pull.title,
            meta: `${pull.repositoryNameWithOwner ?? "GitHub"} #${pull.number}`,
            url: pull.htmlUrl
          }))
        : title === "Mailbox"
          ? [...issues, ...pulls].slice(0, 30).map((item) => ({
              key: `m-${item.id}`,
              title: item.title,
              meta: `${item.repositoryNameWithOwner ?? "GitHub"} #${item.number}`,
              url: item.htmlUrl
            }))
          : title === "Discussions"
            ? discussions.map((discussion) => ({
                key: `d-${discussion.id}`,
                title: discussion.title,
                meta: discussion.category ?? "Discussion",
                url: discussion.htmlUrl
              }))
            : title === "Projects"
              ? projects.map((project) => ({
                  key: `pr-${project.id}`,
                  title: project.title,
                  meta: "Project",
                  url: project.htmlUrl ?? null
                }))
              : repositories.map((repository) => ({
                  key: repository.id,
                  title: repository.nameWithOwner,
                  meta: repository.description ?? "Repository",
                  url: `https://github.com/${repository.nameWithOwner}`
                }));

  return (
    <section className="collection-view">
      <header>
        <h2>{title}</h2>
        <button type="button">
          <Plus size={16} /> New
        </button>
      </header>
      <div className="table-panel">
        {rows.map((row) => (
          <button
            className="issue-row"
            key={row.key}
            type="button"
            onClick={() => row.url && onOpenExternal(row.url)}
          >
            <Inbox size={17} />
            <div>
              <strong>{row.title}</strong>
              <small>{row.meta}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RightRail({
  repository,
  releases,
  contributors,
  onOpenExternal
}: {
  repository?: RepositoryDetail;
  releases: ReleaseSummary[];
  contributors: ContributorSummary[];
  onOpenExternal(url: string): void;
}): JSX.Element {
  const languages = repository ? normalizeLanguageStats(repository) : [];
  const counts = repository
    ? getRepositoryCounts(repository, { issues: [], pulls: [], discussions: [], projects: [], releases })
    : null;

  return (
    <aside className="right-rail">
      <section className="rail-panel">
        <h3>About</h3>
        <p>{repository?.description ?? "Repository details load from GitHub."}</p>
        {repository?.homepageUrl && (
          <button
            className="link-button"
            type="button"
            onClick={() => onOpenExternal(repository.homepageUrl!)}
          >
            {repository.homepageUrl.replace(/^https?:\/\//, "")}
          </button>
        )}
        <div className="topic-wrap">
          {(repository?.topics ?? []).slice(0, 8).map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
        <ul className="about-list">
          <li>
            <BookOpen size={15} /> Readme
          </li>
          <li>
            <ShieldCheck size={15} /> {repository?.licenseName ?? "License"}
          </li>
          <li>
            <Star size={15} /> {formatCompactNumber(counts?.stars ?? 0)} stars
          </li>
          <li>
            <GitFork size={15} /> {formatCompactNumber(counts?.forks ?? 0)} forks
          </li>
          <li>
            <Eye size={15} /> {formatCompactNumber(counts?.watchers ?? 0)} watching
          </li>
        </ul>
      </section>

      <section className="rail-panel language-panel">
        <div className="rail-heading">
          <h3>Languages</h3>
          {languages.length > 0 && <span>{languageTotalLabel(languages) ?? `${languages.length}`}</span>}
        </div>
        {languages.length > 0 ? (
          <>
            <div className="language-bar" aria-label="Repository language breakdown">
              {languages.map((language) => (
                <span
                  key={language.name}
                  style={{
                    background: language.color ?? "#94a3b8",
                    width: `${Math.max(1, language.percentage ?? 1)}%`
                  }}
                />
              ))}
            </div>
            <div className="language-list">
              {languages.slice(0, 8).map((language) => (
                <div key={language.name}>
                  <span style={{ background: language.color ?? "#94a3b8" }} />
                  <strong>{language.name}</strong>
                  <small>
                    {language.percentage !== null ? `${language.percentage.toFixed(1)}%` : "Language"}
                  </small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <small>No language data loaded.</small>
        )}
      </section>

      <section className="rail-panel">
        <div className="rail-heading">
          <h3>Releases</h3>
          <span>{releases.length}</span>
        </div>
        {releases.slice(0, 2).map((release) => (
          <button
            className="release-row"
            key={release.id}
            type="button"
            onClick={() => onOpenExternal(release.htmlUrl)}
          >
            <Tag size={17} />
            <span>
              <strong>{release.name ?? release.tagName}</strong>
              <small>{formatRelativeDate(release.publishedAt)}</small>
            </span>
          </button>
        ))}
        {releases.length === 0 && <small>No releases loaded.</small>}
      </section>

      <section className="rail-panel">
        <div className="rail-heading">
          <h3>Contributors</h3>
          <span>{contributors.length}</span>
        </div>
        <div className="contributors">
          {contributors.slice(0, 12).map((contributor) => (
            <img
              key={`${contributor.id}-${contributor.login}`}
              src={contributor.avatarUrl ?? ""}
              alt={contributor.login}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}

function SettingsPanel({
  appState,
  onClose,
  onSave
}: {
  appState?: AppState;
  onClose(): void;
  onSave(settings: Partial<AppState["settings"]>): Promise<void>;
}): JSX.Element {
  const [credentialProvider, setCredentialProvider] = useState<CredentialProvider>(
    appState?.settings.credentialProvider ?? "gh-cli"
  );
  const [ghPath, setGhPath] = useState(appState?.settings.ghPath ?? "");
  const [githubAppClientId, setGithubAppClientId] = useState(appState?.settings.githubAppClientId ?? "");
  const [glassMode, setGlassMode] = useState<GlassMode>(appState?.settings.glassMode ?? "glass-shell");

  return (
    <div className="modal-backdrop">
      <section className="settings-panel">
        <header>
          <h2>Settings</h2>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <label>
          Credential provider
          <select
            value={credentialProvider}
            onChange={(event) => setCredentialProvider(event.target.value as CredentialProvider)}
          >
            <option value="gh-cli">GitHub CLI</option>
            <option value="github-app">GitHub App OAuth</option>
          </select>
        </label>

        <label>
          GitHub CLI path
          <input
            value={ghPath}
            onChange={(event) => setGhPath(event.target.value)}
            placeholder="/opt/homebrew/bin/gh"
          />
        </label>

        <label>
          GitHub App client ID
          <input
            value={githubAppClientId}
            onChange={(event) => setGithubAppClientId(event.target.value)}
            placeholder="Configured later for packaged OAuth"
          />
        </label>

        <label>
          Glass mode
          <select value={glassMode} onChange={(event) => setGlassMode(event.target.value as GlassMode)}>
            <option value="glass-shell">Glass shell</option>
            <option value="reduced">Reduced glass</option>
            <option value="solid">Solid</option>
          </select>
        </label>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="dark-action"
            type="button"
            onClick={() =>
              void onSave({
                credentialProvider,
                ghPath: ghPath.trim() || null,
                githubAppClientId: githubAppClientId.trim() || null,
                glassMode
              })
            }
          >
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}
