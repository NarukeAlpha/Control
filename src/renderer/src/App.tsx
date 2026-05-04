import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Code2,
  Folder,
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
  Users,
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
import { useUiStore, type RepositoryTab } from "./stores/uiStore";
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

const repoTabs: Array<{ key: RepositoryTab; label: string; icon: typeof Code2; count?: number }> = [
  { key: "code", label: "Code", icon: Code2 },
  { key: "issues", label: "Issues", icon: CircleDot, count: 1200 },
  { key: "pulls", label: "Pull requests", icon: GitPullRequest, count: 5 },
  { key: "actions", label: "Actions", icon: PlayCircle },
  { key: "projects", label: "Projects", icon: Layers3, count: 3 },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "insights", label: "Insights", icon: Workflow }
];

export function App(): JSX.Element {
  const api = useMemo(() => getControlApi(), []);
  const queryClient = useQueryClient();
  const activeView = useUiStore((state) => state.activeView);
  const selectedRepository = useUiStore((state) => state.selectedRepository);
  const setSelectedRepository = useUiStore((state) => state.setSelectedRepository);
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

  const effectiveRepository = selectedRepository ?? repositories.data?.[0]?.nameWithOwner ?? "apple/swift";
  const [owner = "apple", repo = "swift"] = effectiveRepository.split("/");

  const repository = useQuery({
    queryKey: ["repository", owner, repo],
    queryFn: () => api.github.getRepository({ owner, repo }),
    enabled: Boolean(owner && repo)
  });

  const contents = useQuery({
    queryKey: ["contents", owner, repo, repository.data?.defaultBranch],
    queryFn: () => api.github.listContents({ owner, repo, ref: repository.data?.defaultBranch ?? undefined }),
    enabled: Boolean(owner && repo)
  });

  const issues = useQuery({
    queryKey: ["issues", owner, repo],
    queryFn: () => api.github.listIssues({ owner, repo, state: "open" }),
    enabled: Boolean(owner && repo)
  });

  const pulls = useQuery({
    queryKey: ["pulls", owner, repo],
    queryFn: () => api.github.listPullRequests({ owner, repo, state: "open" }),
    enabled: Boolean(owner && repo)
  });

  const discussions = useQuery({
    queryKey: ["discussions", owner, repo],
    queryFn: () => api.github.listDiscussions({ owner, repo, limit: 30 }),
    enabled: Boolean(owner && repo)
  });

  const actions = useQuery({
    queryKey: ["actions", owner, repo],
    queryFn: () => api.github.listActions({ owner, repo, limit: 20 }),
    enabled: Boolean(owner && repo)
  });

  const projects = useQuery({
    queryKey: ["projects", owner, repo],
    queryFn: () => api.github.listProjects({ owner, repo, limit: 20 }),
    enabled: Boolean(owner && repo)
  });

  const releases = useQuery({
    queryKey: ["releases", owner, repo],
    queryFn: () => api.github.listReleases({ owner, repo, limit: 20 }),
    enabled: Boolean(owner && repo)
  });

  const contributors = useQuery({
    queryKey: ["contributors", owner, repo],
    queryFn: () => api.github.listContributors({ owner, repo }),
    enabled: Boolean(owner && repo)
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
        onSelectRepository={setSelectedRepository}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <TopBar
        viewer={appState.data?.viewer ?? null}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <section className="workspace">
        {!appState.data?.gh.authenticated && <SetupPanel appState={appState.data} />}

        <main className="content-scroll">
          {activeView === "Repository" || activeView === "Home" ? (
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
              onMutate={(action, dangerous, payload = {}) => {
                if (dangerous && !window.confirm(`Run ${action} on ${owner}/${repo}?`)) {
                  return;
                }
                mutation.mutate({ action, owner, repo, payload });
              }}
            />
          ) : (
            <CollectionView
              title={activeView}
              issues={issues.data ?? []}
              pulls={pulls.data ?? []}
              discussions={discussions.data ?? []}
              projects={projects.data ?? []}
              repositories={repositories.data ?? []}
            />
          )}
        </main>
      </section>

      <RightRail
        repository={repository.data}
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

function Sidebar({
  appState,
  repositories,
  selectedRepository,
  onSelectRepository,
  onOpenSettings
}: {
  appState?: AppState;
  repositories: RepositorySummary[];
  selectedRepository: string;
  onSelectRepository(nameWithOwner: string): void;
  onOpenSettings(): void;
}): JSX.Element {
  const setActiveView = useUiStore((state) => state.setActiveView);
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
              className="nav-item"
              key={item.label}
              type="button"
              onClick={() => setActiveView(item.label)}
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
                  className={`repo-item ${
                    selectedRepository === repository.nameWithOwner ? "selected" : ""
                  }`}
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
  onOpenSettings
}: {
  viewer: AppState["viewer"];
  onOpenSettings(): void;
}): JSX.Element {
  const api = useMemo(() => getControlApi(), []);
  const setSelectedRepository = useUiStore((state) => state.setSelectedRepository);
  const [query, setQuery] = useState("");
  const search = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.github.search({ query, limit: 8 }),
    enabled: query.trim().length > 1
  });

  return (
    <header className="topbar">
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
                  setSelectedRepository(result.nameWithOwner);
                  setQuery("");
                }}
              >
                <span>{result.nameWithOwner}</span>
                <small>{result.description ?? "Repository"}</small>
              </button>
            ))}
            {search.isFetching && <div className="muted-row">Searching GitHub...</div>}
            {!search.isFetching && search.data?.length === 0 && <div className="muted-row">No repositories found</div>}
          </div>
        )}
      </div>

      <div className="top-actions">
        <button className="icon-button glass" type="button" title="Create">
          <Plus size={19} />
        </button>
        <button className="icon-button glass" type="button" title="Notifications">
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
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  const tab = useUiStore((state) => state.repositoryTab);
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
          <div className="stat-strip">
            <span>
              <Star size={15} /> {formatCompactNumber(repo.stargazerCount)}
            </span>
            <span>
              <GitFork size={15} /> {formatCompactNumber(repo.forkCount)}
            </span>
            <span>
              <Users size={15} /> {formatCompactNumber(repo.watcherCount)}
            </span>
            {repo.licenseName && (
              <span>
                <ShieldCheck size={15} /> {repo.licenseName}
              </span>
            )}
          </div>
        </div>
        <div className="repo-action-row">
          <button type="button" onClick={() => onMutate("watch", false)}>
            <Users size={16} /> Watch <ChevronDown size={14} />
          </button>
          <button type="button" onClick={() => onMutate("fork", true)}>
            <GitFork size={16} /> Fork
          </button>
          <button className="dark-action" type="button" onClick={() => onMutate("star", false)}>
            <Star size={17} /> Star <span>{formatCompactNumber(repo.stargazerCount)}</span>
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
              {item.count && <span>{formatCompactNumber(item.count)}</span>}
            </button>
          );
        })}
      </nav>

      {tab === "code" && <CodeTab repository={repo} contents={contents} />}
      {tab === "issues" && <IssuesTab issues={issues} onMutate={onMutate} />}
      {tab === "pulls" && <PullRequestsTab pulls={pulls} onMutate={onMutate} />}
      {tab === "actions" && <ActionsTab actions={actions} onMutate={onMutate} />}
      {tab === "projects" && <ProjectsTab projects={projects} />}
      {tab === "security" && <SecurityTab repository={repo} />}
      {tab === "insights" && (
        <InsightsTab repository={repo} issues={issues} pulls={pulls} discussions={discussions} />
      )}
    </article>
  );
}

function CodeTab({ repository, contents }: { repository: RepositoryDetail; contents: RepoEntry[] }): JSX.Element {
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
        <button type="button">
          <GitFork size={16} />
          {repository.defaultBranch ?? "main"}
          <ChevronDown size={14} />
        </button>
        <span>
          <GitFork size={15} /> {formatCompactNumber(repository.branchCount)} branches
        </span>
        <span>
          <Tag size={15} /> {formatCompactNumber(repository.tagCount)} tags
        </span>
        <label>
          <Search size={16} />
          <input placeholder="Go to file" />
        </label>
        <button className="dark-action" type="button">
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
                <div
                  className="file-row"
                  key={item.sha}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {item.type === "dir" ? <Folder size={18} /> : <BookOpen size={17} />}
                  <strong>{item.name}</strong>
                  <span>{item.lastCommitMessage ?? "Updated from GitHub"}</span>
                  <time>{formatRelativeDate(item.lastCommitDate)}</time>
                </div>
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
  issues,
  onMutate
}: {
  issues: IssueSummary[];
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  return (
    <section className="table-panel">
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
        </div>
      ))}
    </section>
  );
}

function PullRequestsTab({
  pulls,
  onMutate
}: {
  pulls: PullRequestSummary[];
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  return (
    <section className="table-panel">
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
            {pull.isDraft ? "draft" : pull.mergeableState ?? pull.state}
          </span>
          <button type="button" onClick={() => onMutate("mergePullRequest", true, { pullNumber: pull.number })}>
            Merge
          </button>
        </div>
      ))}
    </section>
  );
}

function ActionsTab({
  actions,
  onMutate
}: {
  actions: WorkflowRunSummary[];
  onMutate(action: GitHubAction, dangerous: boolean, payload?: Record<string, unknown>): void;
}): JSX.Element {
  return (
    <section className="table-panel">
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
        </div>
      ))}
    </section>
  );
}

function ProjectsTab({ projects }: { projects: ProjectSummary[] }): JSX.Element {
  return (
    <section className="tile-grid">
      {projects.map((project) => (
        <article className="project-tile" key={project.id}>
          <Layers3 size={20} />
          <strong>{project.title}</strong>
          <small>{project.closed ? "Closed" : "Open"} project</small>
        </article>
      ))}
      {projects.length === 0 && <div className="empty-state">No projects are available for this repository.</div>}
    </section>
  );
}

function SecurityTab({ repository }: { repository: RepositoryDetail }): JSX.Element {
  return (
    <section className="tile-grid">
      {["Security policy", "Code scanning", "Dependabot", "Secret scanning"].map((item) => (
        <article className="project-tile" key={item}>
          <ShieldCheck size={20} />
          <strong>{item}</strong>
          <small>{repository.nameWithOwner}</small>
        </article>
      ))}
    </section>
  );
}

function InsightsTab({
  repository,
  issues,
  pulls,
  discussions
}: {
  repository: RepositoryDetail;
  issues: IssueSummary[];
  pulls: PullRequestSummary[];
  discussions: DiscussionSummary[];
}): JSX.Element {
  return (
    <section className="insight-grid">
      <Metric label="Stars" value={repository.stargazerCount} />
      <Metric label="Forks" value={repository.forkCount} />
      <Metric label="Open issues" value={issues.length || repository.openIssuesCount} />
      <Metric label="Pull requests" value={pulls.length} />
      <Metric label="Discussions" value={discussions.length} />
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
  repositories
}: {
  title: string;
  issues: IssueSummary[];
  pulls: PullRequestSummary[];
  discussions: DiscussionSummary[];
  projects: ProjectSummary[];
  repositories: RepositorySummary[];
}): JSX.Element {
  const rows =
    title === "Issues"
      ? issues.map((issue) => ({ key: `i-${issue.id}`, title: issue.title, meta: `#${issue.number}` }))
      : title === "Pull requests"
        ? pulls.map((pull) => ({ key: `p-${pull.id}`, title: pull.title, meta: `#${pull.number}` }))
        : title === "Discussions"
          ? discussions.map((discussion) => ({
              key: `d-${discussion.id}`,
              title: discussion.title,
              meta: discussion.category ?? "Discussion"
            }))
          : title === "Projects"
            ? projects.map((project) => ({ key: `pr-${project.id}`, title: project.title, meta: "Project" }))
            : repositories.map((repository) => ({
                key: repository.id,
                title: repository.nameWithOwner,
                meta: repository.description ?? "Repository"
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
          <div className="issue-row" key={row.key}>
            <Inbox size={17} />
            <div>
              <strong>{row.title}</strong>
              <small>{row.meta}</small>
            </div>
          </div>
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
  return (
    <aside className="right-rail">
      <section className="rail-panel">
        <h3>About</h3>
        <p>{repository?.description ?? "Repository details load from GitHub."}</p>
        {repository?.homepageUrl && (
          <button className="link-button" type="button" onClick={() => onOpenExternal(repository.homepageUrl!)}>
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
            <Star size={15} /> {formatCompactNumber(repository?.stargazerCount ?? 0)} stars
          </li>
          <li>
            <GitFork size={15} /> {formatCompactNumber(repository?.forkCount ?? 0)} forks
          </li>
          <li>
            <Users size={15} /> {formatCompactNumber(repository?.watcherCount ?? 0)} watching
          </li>
        </ul>
      </section>

      <section className="rail-panel">
        <div className="rail-heading">
          <h3>Releases</h3>
          <span>{releases.length}</span>
        </div>
        {releases.slice(0, 2).map((release) => (
          <button className="release-row" key={release.id} type="button" onClick={() => onOpenExternal(release.htmlUrl)}>
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
            <img key={`${contributor.id}-${contributor.login}`} src={contributor.avatarUrl ?? ""} alt={contributor.login} />
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
          <input value={ghPath} onChange={(event) => setGhPath(event.target.value)} placeholder="/opt/homebrew/bin/gh" />
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
